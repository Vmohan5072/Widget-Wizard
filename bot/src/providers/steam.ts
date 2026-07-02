// Steam ID helpers shared by the CS2, Dota and Deadlock providers.

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

/** Total playtime in hours for one app, via GetOwnedGames. Needs an API key
 *  and the profile's game details set to public; returns undefined otherwise. */
export async function getPlaytimeHours(steam64: string, appId: number, steamApiKey: string): Promise<number | undefined> {
  if (!steamApiKey) return undefined;
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steam64}&include_played_free_games=1&appids_filter%5B0%5D=${appId}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { response?: { games?: { appid: number; playtime_forever: number }[] } };
    const game = body.response?.games?.find((g) => g.appid === appId);
    return game ? Math.round(game.playtime_forever / 60) : undefined;
  } catch {
    return undefined;
  }
}

/** Accepts a steam64, steam32, or vanity name and returns a steam64.
 *  Vanity resolution needs STEAM_API_KEY. */
export async function resolveSteam64(input: string, steamApiKey: string): Promise<string> {
  const trimmed = input.trim().replace(/^https?:\/\/steamcommunity\.com\/(id|profiles)\//, "").replace(/\/$/, "");
  if (isSteam64(trimmed)) return trimmed;
  if (isSteam32(trimmed)) return steam32To64(trimmed);
  if (!steamApiKey) {
    throw new Error("That looks like a vanity name. Set STEAM_API_KEY to resolve it, or paste your steam64 ID (a 17-digit number starting with 7656).");
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
