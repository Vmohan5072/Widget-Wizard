import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig } from "../config";
import type { CoverOption, GameStats, Provider, StatCandidate } from "./types";
import { getPlaytimeHours, resolveSteam64, steam64To32 } from "./steam";

const DEADLOCK_APP_ID = 1422450;
const BASE = "https://api.deadlock-api.com";
const ASSETS = "https://assets.deadlock-api.com";

interface DlMatch {
  match_id: number;
  match_result?: number;
  player_team?: number;
  player_kills?: number;
  player_deaths?: number;
  player_assists?: number;
  hero_id?: number;
}

interface DlHero {
  id: number;
  name: string;
  images?: Record<string, string | null>;
}

async function api<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (res.status === 404) throw new Error("No Deadlock data for that account.");
  if (!res.ok) throw new Error(`Deadlock API error ${res.status}`);
  return (await res.json()) as T;
}

function heroImage(hero: DlHero): string | undefined {
  const imgs = hero.images ?? {};
  // Prefer card-style art, fall back to anything that looks like a URL.
  const preferred = Object.entries(imgs).find(([k, v]) => v && k.includes("card"))?.[1];
  return preferred ?? Object.values(imgs).find((v): v is string => typeof v === "string" && v.startsWith("http"));
}

export const deadlock: Provider = {
  id: "deadlock",
  displayName: "Deadlock",
  slots: [{ key: "steam", label: "Steam", hint: "steam64 ID, friend ID, or profile URL", placeholder: "https://steamcommunity.com/id/you" }],
  neededKeys: [{ field: "steamApiKey", label: "Steam Web API key (hours + vanity URLs)", required: false, url: "https://steamcommunity.com/dev/apikey" }],

  async fetchStats(links: Record<string, string>, cfg: AppConfig): Promise<GameStats> {
    const account = links["steam"];
    if (!account) throw new Error("Link your Steam account first.");

    const steam64 = await resolveSteam64(account, cfg.steamApiKey);
    const id32 = steam64To32(steam64);

    const [history, hours] = await Promise.all([
      api<DlMatch[]>(BASE, `/v1/players/${id32}/match-history`),
      getPlaytimeHours(steam64, DEADLOCK_APP_ID, cfg.steamApiKey),
    ]);
    if (!history.length) throw new Error("No Deadlock matches found for that account.");

    const recent = history.slice(0, 20);
    const wins = recent.filter((m) => m.match_result != null && m.match_result === m.player_team).length;
    const k = recent.reduce((s, m) => s + (m.player_kills ?? 0), 0);
    const d = recent.reduce((s, m) => s + (m.player_deaths ?? 0), 0);
    const a = recent.reduce((s, m) => s + (m.player_assists ?? 0), 0);

    const stats: StatCandidate[] = [
      { key: "matches", label: "Matches", value: String(history.length) },
      { key: "recent_wl", label: "Recent W-L", value: `${wins}-${recent.length - wins}` },
      { key: "winrate20", label: "Winrate (20)", value: `${Math.round((wins / recent.length) * 100)}%` },
      { key: "kda", label: "KDA (recent)", value: d ? ((k + a) / d).toFixed(2) : "∞" },
      { key: "kills_avg", label: "Kills avg", value: (k / recent.length).toFixed(1) },
      { key: "deaths_avg", label: "Deaths avg", value: (d / recent.length).toFixed(1) },
    ];

    // Most-played hero in recent history.
    const counts = new Map<number, number>();
    for (const m of recent) if (m.hero_id != null) counts.set(m.hero_id, (counts.get(m.hero_id) ?? 0) + 1);
    const topHeroId = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    if (topHeroId != null) {
      try {
        const heroes = await api<DlHero[]>(ASSETS, "/v2/heroes");
        const hero = heroes.find((h) => h.id === topHeroId);
        if (hero) stats.push({ key: "top_hero", label: "Top Hero", value: hero.name });
      } catch {
        // assets API unavailable; skip
      }
    }
    if (hours != null) stats.push({ key: "hours", label: "Hours", value: hours.toLocaleString("en-US") });

    return { game: "Deadlock", title: account.replace(/^https?:\/\/\S+\//, ""), stats };
  },

  async coverOptions(links: Record<string, string>, cfg: AppConfig): Promise<CoverOption[]> {
    const account = links["steam"];
    if (!account) return [];
    const steam64 = await resolveSteam64(account, cfg.steamApiKey);
    const id32 = steam64To32(steam64);
    const [history, heroes] = await Promise.all([
      api<DlMatch[]>(BASE, `/v1/players/${id32}/match-history`).catch(() => [] as DlMatch[]),
      api<DlHero[]>(ASSETS, "/v2/heroes"),
    ]);

    const counts = new Map<number, number>();
    for (const m of history.slice(0, 100)) if (m.hero_id != null) counts.set(m.hero_id, (counts.get(m.hero_id) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    const ordered = [...ranked.map((id) => heroes.find((h) => h.id === id)).filter((h): h is DlHero => h != null), ...heroes];
    const seen = new Set<number>();
    const options: CoverOption[] = [];
    for (const hero of ordered) {
      if (seen.has(hero.id)) continue;
      seen.add(hero.id);
      const url = heroImage(hero);
      if (url) options.push({ label: hero.name, url });
      if (options.length >= 16) break;
    }
    return options;
  },
};
