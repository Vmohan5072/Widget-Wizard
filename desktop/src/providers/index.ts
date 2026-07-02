import type { Provider } from "./types";
import { counterstrike } from "./counterstrike";
import { dota } from "./dota";
import { deadlock } from "./deadlock";

export const providers: Provider[] = [counterstrike, dota, deadlock];

export function getProvider(id: string): Provider {
  const p = providers.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown game: ${id}`);
  return p;
}
