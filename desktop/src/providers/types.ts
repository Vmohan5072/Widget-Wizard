import type { AppConfig } from "../config";

export interface StatCandidate {
  key: string; // stable id used in config
  label: string;
  value: string;
}

export interface GameStats {
  game: string;
  title: string;
  stats: StatCandidate[]; // everything available; user assembles their board from these
  imageUrl?: string; // default cover (account avatar etc.)
}

export interface CoverOption {
  label: string;
  url: string;
}

export interface LinkSlot {
  key: string;
  label: string;
  hint: string;
  placeholder: string;
}

export interface Provider {
  id: string;
  displayName: string;
  slots: LinkSlot[];
  neededKeys: { field: keyof AppConfig; label: string; required: boolean; url: string }[];
  fetchStats(links: Record<string, string>, cfg: AppConfig): Promise<GameStats>;
  /** Optional gallery of cover images (hero icons etc.) the user can pick from. */
  coverOptions?(links: Record<string, string>, cfg: AppConfig): Promise<CoverOption[]>;
}
