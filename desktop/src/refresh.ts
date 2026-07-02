import type { AppConfig } from "./config";
import { getProvider } from "./providers";
import { pushIdentity } from "./discord";

export interface RefreshResult {
  game: string;
  ok: boolean;
  message: string;
  at: Date;
}

/** Games that are enabled, have verified credentials, and have a linked account. */
export function readyGames(cfg: AppConfig): string[] {
  return cfg.enabledGames.filter((id) => {
    const app = cfg.apps[id];
    if (!app?.verified || !app.applicationId || !app.token) return false;
    return getProvider(id).slots.some((s) => cfg.links[s.key]);
  });
}

export async function refreshGame(cfg: AppConfig, providerId: string): Promise<RefreshResult> {
  const provider = getProvider(providerId);
  try {
    const app = cfg.apps[providerId];
    if (!app?.verified) throw new Error("No verified app for this game.");
    const stats = await provider.fetchStats(cfg.links, cfg);
    await pushIdentity(cfg, providerId, app, stats);
    return { game: provider.displayName, ok: true, message: `pushed for ${stats.title}`, at: new Date() };
  } catch (err) {
    return { game: provider.displayName, ok: false, message: err instanceof Error ? err.message : String(err), at: new Date() };
  }
}

export async function refreshAll(cfg: AppConfig): Promise<RefreshResult[]> {
  const results: RefreshResult[] = [];
  for (const id of readyGames(cfg)) {
    results.push(await refreshGame(cfg, id));
  }
  return results;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(getConfig: () => AppConfig, onResults: (r: RefreshResult[]) => void): void {
  stopScheduler();
  const cfg = getConfig();
  if (!cfg.refreshMinutes) return;
  timer = setInterval(async () => {
    onResults(await refreshAll(getConfig()));
  }, cfg.refreshMinutes * 60 * 1000);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
