import { config } from "./config.js";
import { allUsers } from "./store.js";
import { getProvider } from "./providers/index.js";
import { pushIdentity } from "./identity.js";

export async function refreshUser(discordId: string): Promise<string> {
  const user = allUsers()[discordId];
  if (!user?.activeGame) {
    throw new Error("No linked account. Use /widget link first.");
  }
  const provider = getProvider(user.activeGame);
  const stats = await provider.fetchStats(user.links, config);
  await pushIdentity(discordId, stats, config);
  return `${provider.displayName} — ${stats.stats.map((s) => `${s.label}: ${s.value}`).join(" · ")}`;
}

export function startAutoRefresh(): void {
  if (!config.refreshMinutes) return;
  const ms = config.refreshMinutes * 60 * 1000;
  setInterval(async () => {
    for (const discordId of Object.keys(allUsers())) {
      try {
        await refreshUser(discordId);
      } catch (err) {
        console.error(`auto-refresh failed for ${discordId}:`, err instanceof Error ? err.message : err);
      }
      // Space requests out a little to be polite to the game APIs.
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, ms);
  console.log(`Auto-refresh every ${config.refreshMinutes} min.`);
}
