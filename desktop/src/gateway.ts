// Minimal Discord gateway client, one connection per game app, so each
// widget's application answers a /refresh slash command while Widget Wizard
// is running. Interactions arrive over the gateway (no public URL needed).
import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig } from "./config";
import { refreshGame, type RefreshResult } from "./refresh";

const API = "https://discord.com/api/v9";
const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";

function headers(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bot ${token}`,
    "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)",
  };
}

/** Registers the /refresh command on one game's app (idempotent overwrite). */
export async function registerRefreshCommand(applicationId: string, token: string): Promise<void> {
  const res = await fetch(`${API}/applications/${applicationId}/commands`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify([
      {
        name: "refresh",
        description: "Refresh this game's stats widget now",
        integration_types: [0, 1],
        contexts: [0, 1, 2],
      },
    ]),
  });
  if (!res.ok) throw new Error(`Command registration failed (${res.status}): ${await res.text()}`);
}

interface GatewayHandle {
  close: () => void;
}

function connectOne(
  providerId: string,
  applicationId: string,
  token: string,
  getConfig: () => AppConfig,
  onResult: (r: RefreshResult) => void,
): GatewayHandle {
  let ws: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let seq: number | null = null;
  let closed = false;
  let retryDelay = 5000;

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    ws = null;
  };

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(GATEWAY);

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data as string) as { op: number; d?: unknown; s?: number | null; t?: string | null };
      if (msg.s != null) seq = msg.s;

      if (msg.op === 10) {
        // Hello: start heartbeating and identify.
        const interval = (msg.d as { heartbeat_interval: number }).heartbeat_interval;
        heartbeat = setInterval(() => ws?.send(JSON.stringify({ op: 1, d: seq })), interval);
        ws?.send(
          JSON.stringify({
            op: 2,
            d: {
              token,
              intents: 0,
              properties: { os: "windows", browser: "widget-wizard", device: "widget-wizard" },
            },
          }),
        );
        retryDelay = 5000;
        return;
      }

      if (msg.op === 0 && msg.t === "INTERACTION_CREATE") {
        const it = msg.d as { id: string; token: string; data?: { name?: string } };
        if (it.data?.name !== "refresh") return;
        // Ack immediately (deferred, ephemeral), then do the work.
        await fetch(`${API}/interactions/${it.id}/${it.token}/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: 5, data: { flags: 64 } }),
        });
        const result = await refreshGame(getConfig(), providerId);
        onResult(result);
        await fetch(`${API}/webhooks/${applicationId}/${it.token}/messages/@original`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: result.ok ? `✅ ${result.game} widget updated — ${result.message}` : `❌ ${result.message}`,
          }),
        });
      }
    };

    ws.onclose = () => {
      cleanup();
      if (!closed) {
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 120000);
      }
    };
    ws.onerror = () => ws?.close();
  };

  connect();
  return {
    close: () => {
      closed = true;
      cleanup();
      try {
        ws?.close();
      } catch {
        // already closed
      }
    },
  };
}

let handles: GatewayHandle[] = [];

/** (Re)connects gateways for every ready game. Call again when config changes. */
export async function startGateways(
  readyIds: string[],
  getConfig: () => AppConfig,
  onResult: (r: RefreshResult) => void,
): Promise<void> {
  stopGateways();
  const cfg = getConfig();
  for (const id of readyIds) {
    const app = cfg.apps[id];
    if (!app?.verified) continue;
    try {
      await registerRefreshCommand(app.applicationId, app.token);
    } catch (err) {
      onResult({ game: id, ok: false, message: `couldn't register /refresh: ${err instanceof Error ? err.message : err}`, at: new Date() });
      continue;
    }
    handles.push(connectOne(id, app.applicationId, app.token, getConfig, onResult));
  }
}

export function stopGateways(): void {
  for (const h of handles) h.close();
  handles = [];
}
