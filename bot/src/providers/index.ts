import type { LinkSlot, Provider } from "./types.js";
import { counterstrike } from "./counterstrike.js";
import { dota } from "./dota.js";
import { deadlock } from "./deadlock.js";
import { isSteam32, isSteam64 } from "./steam.js";

export const providers: Provider[] = [counterstrike, dota, deadlock];

export function getProvider(id: string): Provider {
  const p = providers.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown game: ${id}`);
  return p;
}

/** Picks which link slot an account belongs to. `service` (slot label,
 *  lowercase) wins when given; otherwise single-slot providers are trivial
 *  and multi-slot ones are guessed from the account shape. */
export function resolveSlot(provider: Provider, account: string, service?: string | null): LinkSlot {
  if (provider.slots.length === 1) return provider.slots[0];

  if (service) {
    const slot = provider.slots.find((s) => s.label.toLowerCase() === service.toLowerCase());
    if (slot) return slot;
  }

  const looksLikeSteam =
    isSteam64(account) || isSteam32(account) || /steamcommunity\.com\//.test(account);
  const guess = provider.slots.find((s) => (s.label === "Steam") === looksLikeSteam);
  return guess ?? provider.slots[0];
}
