import { fetch } from "@tauri-apps/plugin-http";

const STEAM64_BASE = 76561197960265728n;

export function isSteam64(s: string): boolean {
  return /^7656\d{13}$/.test(s);
}

export function isSteam32(s: string): boolean {
  return /^\d{1,10}$/.test(s);
}

export function steam64To32(steam64: string): string {
  return (BigInt(steam64) - STEAM64_BASE).toString();
}

export function steam32To64(steam32: string): string {
  return (BigInt(steam32) + STEAM64_BASE).toString();
}

// One owned-games fetch per session per account; the per-app filter param of
// GetOwnedGames proved unreliable, so we pull the full list and look up
// locally.
const ownedGamesCache = new Map<string, { appid: number; playtime_forever: number }[]>();

export async function getPlaytimeHours(steam64: string, appId: number, steamApiKey: string): Promise<number | undefined> {
  if (!steamApiKey) return undefined;
  try {
    let games = ownedGamesCache.get(steam64);
    if (!games) {
      const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steam64}&include_played_free_games=1`;
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const body = (await res.json()) as { response?: { games?: { appid: number; playtime_forever: number }[] } };
      games = body.response?.games ?? [];
      ownedGamesCache.set(steam64, games);
      // Refetch on the next refresh cycle rather than never.
      setTimeout(() => ownedGamesCache.delete(steam64), 30 * 60 * 1000);
    }
    const game = games.find((g) => g.appid === appId);
    return game ? Math.round(game.playtime_forever / 60) : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveSteam64(input: string, steamApiKey: string): Promise<string> {
  const trimmed = input.trim().replace(/^https?:\/\/steamcommunity\.com\/(id|profiles)\//, "").replace(/\/$/, "");
  if (isSteam64(trimmed)) return trimmed;
  if (isSteam32(trimmed)) return steam32To64(trimmed);
  if (!steamApiKey) {
    throw new Error("That looks like a vanity name. Add a Steam API key to resolve it, or paste your steam64 ID (17 digits starting with 7656).");
  }
  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${steamApiKey}&vanityurl=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  const body = (await res.json()) as { response?: { success?: number; steamid?: string } };
  if (body.response?.success !== 1 || !body.response.steamid) {
    throw new Error(`Could not resolve Steam vanity name "${trimmed}".`);
  }
  return body.response.steamid;
}
