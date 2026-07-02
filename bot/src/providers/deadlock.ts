import type { Config } from "../config.js";
import type { GameStats, Provider, StatLine } from "./types.js";
import { getPlaytimeHours, resolveSteam64, steam64To32 } from "./steam.js";

// Community API: https://deadlock-api.com (no official Valve API exists).
// Endpoint shapes can drift — check https://api.deadlock-api.com/docs if
// something breaks.

const DEADLOCK_APP_ID = 1422450;
const BASE = "https://api.deadlock-api.com";

interface DlMatch {
  match_id: number;
  match_result?: number; // team that won
  player_team?: number;
  player_kills?: number;
  player_deaths?: number;
  player_assists?: number;
  hero_id?: number;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 404) throw new Error("No Deadlock data for that account.");
  if (!res.ok) throw new Error(`Deadlock API error ${res.status}`);
  return (await res.json()) as T;
}

export const deadlock: Provider = {
  id: "deadlock",
  displayName: "Deadlock",
  slots: [{ key: "deadlock", label: "Steam", hint: "your steam64 ID, friend ID, or steamcommunity.com profile URL" }],

  async fetchStats(links: Record<string, string>, cfg: Config): Promise<GameStats> {
    const account = links["deadlock"];
    if (!account) throw new Error("Link your account first: /widget link game:Deadlock");

    const steam64 = await resolveSteam64(account, cfg.steamApiKey);
    const id32 = steam64To32(steam64);

    const [history, hours] = await Promise.all([
      api<DlMatch[]>(`/v1/players/${id32}/match-history`),
      getPlaytimeHours(steam64, DEADLOCK_APP_ID, cfg.steamApiKey),
    ]);
    if (!history.length) throw new Error("No Deadlock matches found for that account.");

    const recent = history.slice(0, 20);
    const wins = recent.filter((m) => m.match_result != null && m.match_result === m.player_team).length;
    const k = recent.reduce((s, m) => s + (m.player_kills ?? 0), 0);
    const d = recent.reduce((s, m) => s + (m.player_deaths ?? 0), 0);
    const a = recent.reduce((s, m) => s + (m.player_assists ?? 0), 0);
    const kda = d ? ((k + a) / d).toFixed(2) : "∞";

    const stats: StatLine[] = [
      { label: "Matches", value: String(history.length) },
      { label: "Recent W-L", value: `${wins}-${recent.length - wins}` },
      { label: "Winrate (20)", value: `${Math.round((wins / recent.length) * 100)}%` },
      { label: "KDA (recent)", value: kda },
      { label: "Kills avg", value: (k / recent.length).toFixed(1) },
    ];
    stats.push(
      hours != null
        ? { label: "Hours", value: hours.toLocaleString("en-US") }
        : { label: "Deaths avg", value: (d / recent.length).toFixed(1) },
    );

    return {
      game: "Deadlock",
      title: account.replace(/^https?:\/\/\S+\//, ""),
      stats,
    };
  },
};
