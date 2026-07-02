import type { Config } from "../config.js";
import type { GameStats, Provider, StatLine } from "./types.js";
import { getPlaytimeHours, resolveSteam64, steam64To32 } from "./steam.js";

// OpenDota: https://docs.opendota.com — no key needed on the free tier.

const DOTA_APP_ID = 570;
const BASE = "https://api.opendota.com/api";

const MEDALS = ["Uncalibrated", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];

function rankName(rankTier: number | null | undefined, leaderboard?: number | null): string {
  if (!rankTier) return "Uncalibrated";
  const medal = MEDALS[Math.floor(rankTier / 10)] ?? "?";
  const stars = rankTier % 10;
  if (medal === "Immortal") return leaderboard ? `Immortal #${leaderboard}` : "Immortal";
  return stars ? `${medal} ${stars}` : medal;
}

interface OdPlayer {
  profile?: { personaname?: string; avatarfull?: string };
  rank_tier?: number | null;
  leaderboard_rank?: number | null;
}

interface OdWl {
  win: number;
  lose: number;
}

interface OdMatch {
  kills: number;
  deaths: number;
  assists: number;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`OpenDota API error ${res.status}`);
  return (await res.json()) as T;
}

export const dota: Provider = {
  id: "dota2",
  displayName: "Dota 2",
  slots: [{ key: "dota2", label: "Steam", hint: "your steam64 ID, friend ID, or steamcommunity.com profile URL" }],

  async fetchStats(links: Record<string, string>, cfg: Config): Promise<GameStats> {
    const account = links["dota2"];
    if (!account) throw new Error("Link your account first: /widget link game:Dota 2");

    const steam64 = await resolveSteam64(account, cfg.steamApiKey);
    const id32 = steam64To32(steam64);

    const [player, wl, recent, hours] = await Promise.all([
      api<OdPlayer>(`/players/${id32}`),
      api<OdWl>(`/players/${id32}/wl?limit=20`),
      api<OdMatch[]>(`/players/${id32}/recentMatches`),
      getPlaytimeHours(steam64, DOTA_APP_ID, cfg.steamApiKey),
    ]);

    if (!player.profile) {
      throw new Error("OpenDota has no data for that account. Expose match data in Dota 2 settings and try again.");
    }

    const games = wl.win + wl.lose;
    const winrate = games ? Math.round((wl.win / games) * 100) : 0;

    const k = recent.reduce((s, m) => s + m.kills, 0);
    const d = recent.reduce((s, m) => s + m.deaths, 0);
    const a = recent.reduce((s, m) => s + m.assists, 0);
    const kda = d ? ((k + a) / d).toFixed(2) : "∞";

    const stats: StatLine[] = [
      { label: "Rank", value: rankName(player.rank_tier, player.leaderboard_rank) },
      { label: "Recent W-L", value: `${wl.win}-${wl.lose}` },
      { label: "Winrate (20)", value: `${winrate}%` },
      { label: "KDA (recent)", value: kda },
      { label: "Kills avg", value: recent.length ? (k / recent.length).toFixed(1) : "?" },
    ];
    stats.push(
      hours != null
        ? { label: "Hours", value: hours.toLocaleString("en-US") }
        : { label: "Matches pulled", value: String(recent.length) },
    );

    return {
      game: "Dota 2",
      title: player.profile.personaname ?? "Unknown",
      imageUrl: player.profile.avatarfull,
      stats,
    };
  },
};
