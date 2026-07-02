import type { Config } from "../config.js";
import type { GameStats, Provider, StatLine } from "./types.js";
import { getPlaytimeHours, resolveSteam64 } from "./steam.js";

// One Counter-Strike widget. Shows Faceit stats, Premier, or both, depending
// on which accounts the user linked.
//
// Faceit Data API: https://docs.faceit.com/docs/data-api/
// Premier rating comes from Leetify's public profile endpoint (there is no
// official Valve API for it) — used purely as a data source, no
// Leetify-branded metrics are shown.

const CS2_APP_ID = 730;
const FACEIT_BASE = "https://open.faceit.com/data/v4";

interface FaceitSide {
  nickname: string;
  avatar?: string;
  elo?: number;
  level?: number;
  winrate?: string;
  matches?: string;
  kd?: string;
  recent?: string;
}

interface SteamSide {
  name?: string;
  premier?: number;
  winrate?: number; // 0..1
  matches?: number;
  hours?: number;
}

async function faceitApi<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${FACEIT_BASE}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 404) throw new Error("Faceit player not found.");
  if (!res.ok) throw new Error(`Faceit API error ${res.status}`);
  return (await res.json()) as T;
}

async function fetchFaceit(nickname: string, cfg: Config): Promise<FaceitSide> {
  if (!cfg.faceitApiKey) throw new Error("FACEIT_API_KEY is not set.");

  interface FaceitPlayer {
    player_id: string;
    nickname: string;
    avatar?: string;
    games?: Record<string, { faceit_elo?: number; skill_level?: number }>;
  }
  const player = await faceitApi<FaceitPlayer>(`/players?nickname=${encodeURIComponent(nickname)}`, cfg.faceitApiKey);
  const cs = player.games?.cs2 ?? player.games?.csgo;
  if (!cs) throw new Error(`${player.nickname} has no CS profile on Faceit.`);

  const stats = await faceitApi<{ lifetime?: Record<string, unknown> }>(`/players/${player.player_id}/stats/cs2`, cfg.faceitApiKey);
  const life = stats.lifetime ?? {};
  const str = (k: string) => (life[k] != null ? String(life[k]) : undefined);
  const recentRaw = life["Recent Results"];

  return {
    nickname: player.nickname,
    avatar: player.avatar || undefined,
    elo: cs.faceit_elo,
    level: cs.skill_level,
    winrate: str("Win Rate %"),
    matches: str("Matches"),
    kd: str("Average K/D Ratio"),
    recent: Array.isArray(recentRaw) ? recentRaw.map((r) => (String(r) === "1" ? "W" : "L")).join("") : undefined,
  };
}

async function fetchSteam(account: string, cfg: Config): Promise<SteamSide> {
  const steam64 = await resolveSteam64(account, cfg.steamApiKey);
  const side: SteamSide = {};

  side.hours = await getPlaytimeHours(steam64, CS2_APP_ID, cfg.steamApiKey);

  // Premier rating via Leetify's public API — the only practical source.
  // Missing profile just means no Premier stat, not a failure.
  try {
    const headers: Record<string, string> = {};
    if (cfg.leetifyApiKey) headers["Authorization"] = `Bearer ${cfg.leetifyApiKey}`;
    const res = await fetch(`https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${steam64}`, { headers });
    if (res.ok) {
      const p = (await res.json()) as {
        name?: string;
        total_matches?: number;
        winrate?: number;
        ranks?: { premier?: number };
      };
      side.name = p.name;
      side.premier = p.ranks?.premier;
      side.winrate = p.winrate;
      side.matches = p.total_matches;
    }
  } catch {
    // fine — steam side degrades to hours only
  }

  return side;
}

export const counterstrike: Provider = {
  id: "cs",
  displayName: "Counter-Strike",
  slots: [
    { key: "cs_faceit", label: "Faceit", hint: "your Faceit nickname" },
    { key: "cs_steam", label: "Steam", hint: "your steam64 ID or steamcommunity.com profile URL" },
  ],

  async fetchStats(links: Record<string, string>, cfg: Config): Promise<GameStats> {
    const faceitAccount = links["cs_faceit"];
    const steamAccount = links["cs_steam"];
    if (!faceitAccount && !steamAccount) {
      throw new Error("Link a Faceit or Steam account first: /widget link game:Counter-Strike");
    }

    const [f, s] = await Promise.all([
      faceitAccount ? fetchFaceit(faceitAccount, cfg) : Promise.resolve(undefined),
      steamAccount ? fetchSteam(steamAccount, cfg) : Promise.resolve(undefined),
    ]);

    const stats: StatLine[] = [];
    if (s?.premier != null) stats.push({ label: "Premier", value: s.premier.toLocaleString("en-US") });
    if (f?.elo != null) stats.push({ label: "Faceit Elo", value: String(f.elo) });
    if (f?.level != null) stats.push({ label: "Level", value: String(f.level) });

    if (f?.winrate != null) stats.push({ label: "Winrate", value: `${f.winrate}%` });
    else if (s?.winrate != null) stats.push({ label: "Winrate", value: `${Math.round(s.winrate * 100)}%` });

    if (f?.kd != null) stats.push({ label: "Avg K/D", value: f.kd });

    if (f?.matches != null) stats.push({ label: "Matches", value: f.matches });
    else if (s?.matches != null) stats.push({ label: "Matches", value: String(s.matches) });

    if (s?.hours != null) stats.push({ label: "Hours", value: s.hours.toLocaleString("en-US") });
    if (f?.recent) stats.push({ label: "Recent", value: f.recent });

    return {
      game: "Counter-Strike 2",
      title: f?.nickname ?? s?.name ?? "Unknown",
      imageUrl: f?.avatar,
      stats: stats.slice(0, 6),
    };
  },
};
