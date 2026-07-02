import type { Config } from "../config.js";

export interface StatLine {
  label: string;
  value: string;
}

export interface GameStats {
  game: string; // display name, e.g. "Dota 2"
  title: string; // account nickname
  stats: StatLine[]; // up to 6, in display order
  imageUrl?: string;
}

// A provider can have more than one link slot (Counter-Strike: Faceit and/or
// Steam). Slot keys are what gets stored per user.
export interface LinkSlot {
  key: string;
  label: string;
  hint: string;
}

export interface Provider {
  id: string; // used in /widget choices and as activeGame in the store
  displayName: string;
  slots: LinkSlot[];
  /** Receives the user's full link map; reads its own slot keys from it. */
  fetchStats(links: Record<string, string>, cfg: Config): Promise<GameStats>;
}
