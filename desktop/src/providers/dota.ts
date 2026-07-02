import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig } from "../config";
import type { CoverOption, GameStats, Provider, StatCandidate } from "./types";
import { getPlaytimeHours, resolveSteam64, steam64To32 } from "./steam";

const DOTA_APP_ID = 570;
const BASE = "https://api.opendota.com/api";
const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";

const MEDALS = ["Uncalibrated", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];

function rankName(rankTier: number | null | undefined, leaderboard?: number | null): string {
  if (!rankTier) return "Uncalibrated";
  const medal = MEDALS[Math.floor(rankTier / 10)] ?? "?";
  const stars = rankTier % 10;
  if (medal === "Immortal") return leaderboard ? `Immortal #${leaderboard}` : "Immortal";
  return stars ? `${medal} ${stars}` : medal;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`OpenDota API error ${res.status}`);
  return (await res.json()) as T;
}

interface HeroConstant {
  id: number;
  localized_name: string;
  img?: string;
}

async function heroConstants(): Promise<Record<string, HeroConstant>> {
  return api<Record<string, HeroConstant>>("/constants/heroes");
}

export const dota: Provider = {
  id: "dota2",
  displayName: "Dota 2",
  slots: [{ key: "steam", label: "Steam", hint: "steam64 ID, friend ID, or profile URL", placeholder: "https://steamcommunity.com/id/you" }],
  neededKeys: [{ field: "steamApiKey", label: "Steam Web API key (hours + vanity URLs)", required: false, url: "https://steamcommunity.com/dev/apikey" }],

  async fetchStats(links: Record<string, string>, cfg: AppConfig): Promise<GameStats> {
    const account = links["steam"];
    if (!account) throw new Error("Link your Steam account first.");

    const steam64 = await resolveSteam64(account, cfg.steamApiKey);
    const id32 = steam64To32(steam64);

    interface OdPlayer {
      profile?: { personaname?: string; avatarfull?: string };
      rank_tier?: number | null;
      leaderboard_rank?: number | null;
    }
    interface OdRecent {
      kills: number;
      deaths: number;
      assists: number;
      gold_per_min?: number;
      xp_per_min?: number;
    }
    const [player, wl, allWl, recent, topHeroes, totals, hours] = await Promise.all([
      api<OdPlayer>(`/players/${id32}`),
      api<{ win: number; lose: number }>(`/players/${id32}/wl?limit=20`),
      api<{ win: number; lose: number }>(`/players/${id32}/wl`),
      api<OdRecent[]>(`/players/${id32}/recentMatches`),
      api<{ hero_id: number; games: number; win: number }[]>(`/players/${id32}/heroes`).catch(() => []),
      api<{ field: string; n: number; sum: number }[]>(`/players/${id32}/totals`).catch(() => []),
      getPlaytimeHours(steam64, DOTA_APP_ID, cfg.steamApiKey),
    ]);

    if (!player.profile) {
      throw new Error("OpenDota has no data for that account. Expose match data in Dota 2 settings and try again.");
    }

    const g20 = wl.win + wl.lose;
    const gAll = allWl.win + allWl.lose;
    const k = recent.reduce((s, m) => s + m.kills, 0);
    const d = recent.reduce((s, m) => s + m.deaths, 0);
    const a = recent.reduce((s, m) => s + m.assists, 0);
    const gpmVals = recent.map((m) => m.gold_per_min).filter((v): v is number => v != null);

    const stats: StatCandidate[] = [
      { key: "rank", label: "Rank", value: rankName(player.rank_tier, player.leaderboard_rank) },
      { key: "recent_wl", label: "Recent W-L", value: `${wl.win}-${wl.lose}` },
      { key: "winrate20", label: "Winrate (20)", value: g20 ? `${Math.round((wl.win / g20) * 100)}%` : "?" },
      { key: "winrate_all", label: "Winrate (all)", value: gAll ? `${Math.round((allWl.win / gAll) * 100)}%` : "?" },
      { key: "total_games", label: "Total Games", value: gAll.toLocaleString("en-US") },
      { key: "kda", label: "KDA (recent)", value: d ? ((k + a) / d).toFixed(2) : "∞" },
      { key: "kills_avg", label: "Kills avg", value: recent.length ? (k / recent.length).toFixed(1) : "?" },
    ];
    if (gpmVals.length) {
      stats.push({ key: "gpm", label: "GPM (recent)", value: String(Math.round(gpmVals.reduce((s, v) => s + v, 0) / gpmVals.length)) });
    }
    const xpmVals = recent.map((m) => m.xp_per_min).filter((v): v is number => v != null);
    if (xpmVals.length) {
      stats.push({ key: "xpm", label: "XPM (recent)", value: String(Math.round(xpmVals.reduce((s, v) => s + v, 0) / xpmVals.length)) });
    }

    // All-time sums from OpenDota's totals endpoint.
    const total = (field: string) => totals.find((t) => t.field === field)?.sum;
    const durationSec = total("duration");
    if (durationSec) {
      stats.push({ key: "hours_ingame", label: "Hours (in-match)", value: Math.round(durationSec / 3600).toLocaleString("en-US") });
    }
    const tKills = total("kills");
    if (tKills != null) stats.push({ key: "total_kills", label: "Total Kills", value: Math.round(tKills).toLocaleString("en-US") });
    const tDeaths = total("deaths");
    const tAssists = total("assists");
    if (tKills != null && tDeaths && tAssists != null) {
      stats.push({ key: "kda_alltime", label: "KDA (all-time)", value: ((tKills + tAssists) / tDeaths).toFixed(2) });
    }

    if (topHeroes.length) {
      try {
        const consts = await heroConstants();
        const top = topHeroes[0];
        const hero = consts[String(top.hero_id)];
        if (hero) stats.push({ key: "top_hero", label: "Top Hero", value: hero.localized_name });
        // Best-winrate hero among heroes with 20+ games.
        const seasoned = topHeroes.filter((h) => h.games >= 20);
        if (seasoned.length) {
          const best = seasoned.reduce((a, b) => (b.win / b.games > a.win / a.games ? b : a));
          const bestHero = consts[String(best.hero_id)];
          if (bestHero) {
            stats.push({
              key: "best_hero",
              label: "Best Hero",
              value: `${bestHero.localized_name} ${Math.round((best.win / best.games) * 100)}%`,
            });
          }
        }
      } catch {
        // constants unavailable; skip
      }
    }
    if (hours != null) stats.push({ key: "hours", label: "Hours (Steam)", value: hours.toLocaleString("en-US") });

    return {
      game: "Dota 2",
      title: player.profile.personaname ?? "Unknown",
      imageUrl: player.profile.avatarfull,
      stats,
    };
  },

  async coverOptions(links: Record<string, string>, cfg: AppConfig): Promise<CoverOption[]> {
    const account = links["steam"];
    if (!account) return [];
    const steam64 = await resolveSteam64(account, cfg.steamApiKey);
    const id32 = steam64To32(steam64);
    const [topHeroes, consts] = await Promise.all([
      api<{ hero_id: number; games: number }[]>(`/players/${id32}/heroes`),
      heroConstants(),
    ]);
    return topHeroes
      .slice(0, 12)
      .map((h) => {
        const hero = consts[String(h.hero_id)];
        if (!hero?.img) return null;
        return { label: `${hero.localized_name} (${h.games} games)`, url: `${STEAM_CDN}${hero.img}` };
      })
      .filter((o): o is CoverOption => o != null);
  },
};
