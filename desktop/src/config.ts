import { load, type Store } from "@tauri-apps/plugin-store";

export interface GameApp {
  appName: string;
  applicationId: string;
  token: string;
  verified: boolean;
}

export interface CoverChoice {
  mode: "auto" | "url";
  url?: string;
  label?: string;
}

export interface AppConfig {
  wizardStep: number;
  discordUserId: string;
  // provider ids the user wants widgets for
  enabledGames: string[];
  // provider id -> its own Discord application (one app per game, so the
  // widget header shows the game's name and icon)
  apps: Record<string, GameApp>;
  faceitApiKey: string;
  steamApiKey: string;
  leetifyApiKey: string;
  links: Record<string, string>; // slot key -> account ("steam" is shared)
  // provider id -> ordered stat keys for the bottom grid (max 6)
  selectedStats: Record<string, string[]>;
  // provider id -> stat keys for the two subtitle lines under the title (max 2)
  subtitleStats: Record<string, string[]>;
  // provider id -> cover image choice
  covers: Record<string, CoverChoice>;
  // 0 = off; otherwise minutes between auto refreshes
  refreshMinutes: number;
  // refresh once on app launch, at most every 3 hours
  refreshOnOpen: boolean;
  // register and serve a /refresh slash command on each game's app
  discordCommand: boolean;
  // epoch ms of the last successful refresh (for the on-open cooldown)
  lastRefreshAt: number;
}

export const defaultConfig: AppConfig = {
  wizardStep: 0,
  discordUserId: "",
  enabledGames: [],
  apps: {},
  faceitApiKey: "",
  steamApiKey: "",
  leetifyApiKey: "",
  links: {},
  selectedStats: {},
  subtitleStats: {},
  covers: {},
  refreshMinutes: 360,
  refreshOnOpen: true,
  discordCommand: true,
  lastRefreshAt: 0,
};

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) store = await load("config.json", { autoSave: true, defaults: {} });
  return store;
}

export async function loadConfig(): Promise<AppConfig> {
  const s = await getStore();
  const saved = await s.get<AppConfig>("config");
  const cfg = { ...defaultConfig, ...(saved ?? {}) };
  // Migration: older configs stored one Steam account per game.
  if (!cfg.links["steam"]) {
    const legacy = cfg.links["cs_steam"] ?? cfg.links["dota2"] ?? cfg.links["deadlock"];
    if (legacy) cfg.links["steam"] = legacy;
  }
  return cfg;
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  const s = await getStore();
  await s.set("config", cfg);
  await s.save();
}
