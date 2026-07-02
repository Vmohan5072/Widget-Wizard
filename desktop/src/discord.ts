import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig, GameApp } from "./config";
import type { GameStats } from "./providers/types";
import bootstrapTemplate from "./assets/bootstrap-template.js?raw";

const API = "https://discord.com/api/v9";

function headers(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bot ${token}`,
    "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)",
  };
}

/** Validates a bot token + application id pair. Returns the app's name. */
export async function validateCredentials(token: string, applicationId: string): Promise<string> {
  const res = await fetch(`${API}/applications/@me`, { headers: headers(token) });
  if (res.status === 401) throw new Error("That bot token is invalid.");
  if (!res.ok) throw new Error(`Discord API error ${res.status}`);
  const app = (await res.json()) as { id: string; name: string };
  if (app.id !== applicationId.trim()) {
    throw new Error(`Token belongs to application ${app.id}, but you entered ${applicationId}.`);
  }
  return app.name;
}

/** Sets the application's icon (shows top-left on the widget). dataUri: data:image/png;base64,... */
export async function setApplicationIcon(token: string, dataUri: string): Promise<void> {
  const res = await fetch(`${API}/applications/@me`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ icon: dataUri }),
  });
  if (!res.ok) throw new Error(`Setting the icon failed (${res.status}): ${await res.text()}`);
}

/** Synthetic stat available in pickers alongside real API stats. */
export const GAME_NAME_KEY = "_game";

function resolveStat(stats: GameStats, key: string): { label: string; value: string } | undefined {
  if (key === GAME_NAME_KEY) return { label: "Game", value: stats.game };
  return stats.stats.find((s) => s.key === key);
}

/** Pushes the assembled board for one game to that game's own application. */
export async function pushIdentity(cfg: AppConfig, providerId: string, app: GameApp, stats: GameStats): Promise<void> {
  const statKeys = cfg.selectedStats[providerId];
  const chosen = (statKeys?.length ? statKeys : stats.stats.map((s) => s.key))
    .map((key) => resolveStat(stats, key))
    .filter((s) => s != null);

  const dynamic: { type: 1 | 2 | 3; name: string; value: string | { url: string } }[] = [
    { type: 1, name: "title", value: stats.title },
    { type: 1, name: "game", value: stats.game },
  ];

  // Subtitle lines under the title (e.g. "Silver 4" / "3,250 RP").
  // Unused slots get a single space: leaving the field unset shows the
  // config's fallback (a dash line), and empty strings can render the same.
  const subtitleKeys = cfg.subtitleStats[providerId] ?? [];
  for (let i = 0; i < 2; i++) {
    const key = subtitleKeys[i];
    const s = key ? resolveStat(stats, key) : undefined;
    dynamic.push({
      type: 1,
      name: `subtitle_${i + 1}`,
      value: s ? (key === GAME_NAME_KEY ? s.value : `${s.value} ${s.label}`) : " ",
    });
  }

  for (let i = 0; i < 6; i++) {
    const s = chosen[i];
    dynamic.push({ type: 1, name: `stat_${i + 1}_label`, value: s?.label ?? " " });
    dynamic.push({ type: 1, name: `stat_${i + 1}_value`, value: s?.value ?? " " });
  }

  const cover = cfg.covers[providerId];
  const coverUrl = cover?.mode === "url" && cover.url ? cover.url : stats.imageUrl;
  if (coverUrl) dynamic.push({ type: 3, name: "avatar", value: { url: coverUrl } });

  const res = await fetch(`${API}/applications/${app.applicationId}/users/${cfg.discordUserId}/identities/0/profile`, {
    method: "PATCH",
    headers: headers(app.token),
    body: JSON.stringify({ username: stats.title, data: { dynamic } }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("Identity push failed (401): bot token invalid.");
    if (res.status === 403) throw new Error("Identity push failed (403): authorize this game's app first (its setup script does this).");
    throw new Error(`Identity push failed (${res.status}): ${text}`);
  }
}

/** Personalized portal console script for one game's application. */
export function generateBootstrapScript(appName: string): string {
  return bootstrapTemplate.replace(
    'const APP_NAME = "Widget Wizard"; // rename if you like',
    `const APP_NAME = ${JSON.stringify(appName)};`,
  );
}

/** Console snippet (Discord client, not portal) that rebuilds the profile
 *  board: drops ghost/foreign application widgets, keeps game lists, and
 *  attaches every verified game app. Written without template literals so
 *  it survives copy-paste mangling. */
export function generateBoardRepairSnippet(appIds: string[]): string {
  const ids = appIds.map((id) => JSON.stringify(id)).join(", ");
  return [
    "let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]); webpackChunkdiscord_app.pop();",
    "let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;",
    'let me = (await api.get({url: "/users/@me"})).body.id;',
    'let widgets = (await api.get({url: "/users/" + me + "/profile"})).body.widgets;',
    "const MY_APPS = [" + ids + "];",
    "const alive = [];",
    "for (const id of MY_APPS) {",
    '  try { await api.get({url: "/applications/" + id + "/rpc"}); alive.push(id); }',
    '  catch { console.log("app " + id + " not found - skipped"); }',
    "}",
    'const keep = widgets.filter(w => w.data.type !== "application");',
    'const board = alive.map(id => ({data: {type: "application", application_id: id}})).concat(keep);',
    'await api.put({url: "/users/@me/widgets", body: {widgets: board}});',
    'console.log("Board rebuilt: " + board.length + " widgets");',
  ].join("\n");
}

/** Parses the .env-style blob the bootstrap script puts in the clipboard. */
export function parseCredentialsBlob(blob: string): { token?: string; applicationId?: string } {
  const get = (k: string) => blob.match(new RegExp(`${k}=([^\\s]+)`))?.[1];
  const token = get("DISCORD_TOKEN");
  return {
    token: token === "PASTE_FROM_BOT_PAGE" ? undefined : token,
    applicationId: get("APPLICATION_ID"),
  };
}
