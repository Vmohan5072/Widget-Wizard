import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig } from "../config";
import type { GameStats, Provider, StatCandidate } from "./types";
import { getPlaytimeHours, resolveSteam64 } from "./steam";

const CS2_APP_ID = 730;
const FACEIT_BASE = "https://open.faceit.com/data/v4";

async function faceitApi<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${FACEIT_BASE}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 404) throw new Error("Faceit player not found.");
  if (!res.ok) throw new Error(`Faceit API error ${res.status}`);
  return (await res.json()) as T;
}

interface FaceitStatsResponse {
  lifetime?: Record<string, unknown>;
  segments?: { label?: string; type?: string; mode?: string; stats?: Record<string, unknown> }[];
}

/** Map with the highest winrate among maps with 10+ matches. */
function bestMap(segments: FaceitStatsResponse["segments"]): string | undefined {
  if (!segments) return undefined;
  let best: { label: string; wr: number } | undefined;
  for (const seg of segments) {
    if (!seg.label || !seg.stats) continue;
    const matches = Number(seg.stats["Matches"] ?? 0);
    const wr = Number(seg.stats["Win Rate %"] ?? NaN);
    if (matches >= 10 && !Number.isNaN(wr) && (!best || wr > best.wr)) {
      best = { label: seg.label, wr };
    }
  }
  return best ? `${best.label} ${best.wr}%` : undefined;
}

async function steamLifetime(steam64: string, key: string): Promise<{ kills?: number; kd?: string; hs?: string }> {
  if (!key) return {};
  try {
    const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${CS2_APP_ID}&key=${key}&steamid=${steam64}`;
    const res = await fetch(url);
    if (!res.ok) return {}; // 500 when profile/game details are private
    const body = (await res.json()) as { playerstats?: { stats?: { name: string; value: number }[] } };
    const get = (n: string) => body.playerstats?.stats?.find((s) => s.name === n)?.value;
    const kills = get("total_kills");
    const deaths = get("total_deaths");
    const hsKills = get("total_kills_headshot");
    return {
      kills,
      kd: kills != null && deaths ? (kills / deaths).toFixed(2) : undefined,
      hs: kills && hsKills != null ? `${Math.round((hsKills / kills) * 100)}%` : undefined,
    };
  } catch {
    return {};
  }
}

export const counterstrike: Provider = {
  id: "cs",
  displayName: "Counter-Strike 2",
  slots: [
    { key: "cs_faceit", label: "Faceit", hint: "Faceit nickname", placeholder: "s1mple" },
    { key: "steam", label: "Steam", hint: "steam64 ID or profile URL", placeholder: "https://steamcommunity.com/id/you" },
  ],
  neededKeys: [
    { field: "faceitApiKey", label: "Faceit API key (server-side)", required: false, url: "https://developers.faceit.com" },
    { field: "steamApiKey", label: "Steam Web API key", required: false, url: "https://steamcommunity.com/dev/apikey" },
    { field: "leetifyApiKey", label: "Leetify API key (Premier rating source)", required: false, url: "https://leetify.com/app/developer" },
  ],

  async fetchStats(links: Record<string, string>, cfg: AppConfig): Promise<GameStats> {
    const faceitAccount = links["cs_faceit"];
    const steamAccount = links["steam"];
    if (!faceitAccount && !steamAccount) throw new Error("Link a Faceit or Steam account first.");

    const stats: StatCandidate[] = [];
    let title = "Unknown";
    let imageUrl: string | undefined;

    if (faceitAccount) {
      if (!cfg.faceitApiKey) throw new Error("A Faceit API key is needed for Faceit stats.");
      interface FaceitPlayer {
        player_id: string;
        nickname: string;
        avatar?: string;
        games?: Record<string, { faceit_elo?: number; skill_level?: number }>;
      }
      const player = await faceitApi<FaceitPlayer>(`/players?nickname=${encodeURIComponent(faceitAccount)}`, cfg.faceitApiKey);
      const cs = player.games?.cs2 ?? player.games?.csgo;
      if (!cs) throw new Error(`${player.nickname} has no CS profile on Faceit.`);
      const full = await faceitApi<FaceitStatsResponse>(`/players/${player.player_id}/stats/cs2`, cfg.faceitApiKey);
      const lifetime = full.lifetime ?? {};
      const str = (k: string) => (lifetime[k] != null ? String(lifetime[k]) : undefined);

      title = player.nickname;
      imageUrl = player.avatar || undefined;
      if (cs.faceit_elo != null) stats.push({ key: "faceit_elo", label: "Faceit Elo", value: String(cs.faceit_elo) });
      if (cs.skill_level != null) stats.push({ key: "faceit_level", label: "Faceit Level", value: String(cs.skill_level) });
      const wr = str("Win Rate %");
      if (wr) stats.push({ key: "faceit_winrate", label: "Winrate", value: `${wr}%` });
      const kd = str("Average K/D Ratio");
      if (kd) stats.push({ key: "faceit_kd", label: "Avg K/D", value: kd });
      const matches = str("Matches");
      if (matches) stats.push({ key: "faceit_matches", label: "Matches", value: matches });
      const recentRaw = lifetime["Recent Results"];
      if (Array.isArray(recentRaw)) {
        stats.push({ key: "faceit_recent", label: "Recent", value: recentRaw.map((r) => (String(r) === "1" ? "W" : "L")).join("") });
      }
      const map = bestMap(full.segments);
      if (map) stats.push({ key: "faceit_best_map", label: "Best Map", value: map });
    }

    if (steamAccount) {
      const steam64 = await resolveSteam64(steamAccount, cfg.steamApiKey);

      // Premier rating via Leetify's public profile (no official Valve source).
      try {
        const headers: Record<string, string> = {};
        if (cfg.leetifyApiKey) headers["Authorization"] = `Bearer ${cfg.leetifyApiKey}`;
        const res = await fetch(`https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${steam64}`, { headers });
        if (res.ok) {
          const p = (await res.json()) as { name?: string; total_matches?: number; winrate?: number; ranks?: { premier?: number } };
          if (title === "Unknown" && p.name) title = p.name;
          if (p.ranks?.premier != null) stats.unshift({ key: "premier", label: "Premier", value: p.ranks.premier.toLocaleString("en-US") });
          if (!faceitAccount) {
            if (p.winrate != null) stats.push({ key: "mm_winrate", label: "Winrate", value: `${Math.round(p.winrate * 100)}%` });
            if (p.total_matches != null) stats.push({ key: "mm_matches", label: "Matches", value: String(p.total_matches) });
          }
        }
      } catch {
        // no Leetify profile -> no Premier stat
      }

      const [hours, life] = await Promise.all([
        getPlaytimeHours(steam64, CS2_APP_ID, cfg.steamApiKey),
        steamLifetime(steam64, cfg.steamApiKey),
      ]);
      if (hours != null) stats.push({ key: "hours", label: "Hours", value: hours.toLocaleString("en-US") });
      if (life.kills != null) stats.push({ key: "steam_kills", label: "Lifetime Kills", value: life.kills.toLocaleString("en-US") });
      if (life.kd) stats.push({ key: "steam_kd", label: "Lifetime K/D", value: life.kd });
      if (life.hs) stats.push({ key: "steam_hs", label: "HS%", value: life.hs });
    }

    return { game: "Counter-Strike 2", title, imageUrl, stats };
  },
};
