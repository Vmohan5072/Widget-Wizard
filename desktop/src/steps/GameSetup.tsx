import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { StepProps } from "../App";
import { generateBootstrapScript, parseCredentialsBlob, setApplicationIcon, validateCredentials } from "../discord";
import { gameIcons } from "../gameIcons";
import { getProvider } from "../providers";

function GameCard({ cfg, update, providerId }: Pick<StepProps, "cfg" | "update"> & { providerId: string }): JSX.Element {
  const provider = getProvider(providerId);
  const app = cfg.apps[providerId] ?? { appName: provider.displayName, applicationId: "", token: "", verified: false };
  const [copied, setCopied] = useState(false);
  const [blob, setBlob] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(
    app.verified ? { ok: true, msg: "Verified ✓" } : null,
  );
  const [iconStatus, setIconStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setApp = (patch: Partial<typeof app>) => {
    update({ apps: { ...cfg.apps, [providerId]: { ...app, ...patch } } });
  };

  const applyBlob = (text: string) => {
    setBlob(text);
    const parsed = parseCredentialsBlob(text);
    setApp({
      ...(parsed.token ? { token: parsed.token } : {}),
      ...(parsed.applicationId ? { applicationId: parsed.applicationId } : {}),
      verified: false,
    });
  };

  const verify = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const name = await validateCredentials(app.token.trim(), app.applicationId.trim());
      setApp({ token: app.token.trim(), applicationId: app.applicationId.trim(), verified: true });
      setStatus({ ok: true, msg: `Connected to "${name}" ✓` });
      // Apply the bundled game icon automatically; the upload below overrides.
      const bundled = gameIcons[providerId];
      if (bundled) {
        try {
          await setApplicationIcon(app.token.trim(), bundled);
          setIconStatus("Bundled game icon applied ✓ — upload below to override");
        } catch {
          setIconStatus("Couldn't auto-apply the bundled icon — upload one below");
        }
      }
    } catch (err) {
      setApp({ verified: false });
      setStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const uploadIcon = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIconStatus("Uploading…");
        await setApplicationIcon(app.token, String(reader.result));
        setIconStatus("Icon set ✓ (may take a minute to show)");
      } catch (err) {
        setIconStatus(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="panel">
      <h2 style={{ fontSize: 16 }}>
        {provider.displayName} {app.verified ? <span className="status-ok">✓</span> : null}
      </h2>
      <label>Application name (widget header, top-left)</label>
      <input type="text" value={app.appName} maxLength={100} onChange={(e) => setApp({ appName: e.target.value, verified: app.verified })} />
      <div style={{ marginTop: 8 }}>
        <button
          className="secondary"
          onClick={async () => {
            await writeText(generateBootstrapScript(app.appName.trim() || provider.displayName));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied ✓" : "Copy setup script"}
        </button>
        <span className="muted"> paste in the portal console (F12), solve captcha/2FA</span>
      </div>
      <label>Paste the credentials it copies back</label>
      <textarea rows={2} value={blob} onChange={(e) => applyBlob(e.target.value)} placeholder={"DISCORD_TOKEN=...\nAPPLICATION_ID=..."} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>Application ID</label>
          <input type="text" value={app.applicationId} onChange={(e) => setApp({ applicationId: e.target.value, verified: false })} />
        </div>
        <div style={{ flex: 2 }}>
          <label>Bot token</label>
          <input type="password" value={app.token} onChange={(e) => setApp({ token: e.target.value, verified: false })} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={() => void verify()} disabled={busy || !app.token.trim() || !app.applicationId.trim()}>
          {busy ? "Checking…" : "Verify"}
        </button>
        {status && <span className={status.ok ? "status-ok" : "status-err"}> {status.msg}</span>}
      </div>
      {app.verified && (
        <div style={{ marginTop: 10 }}>
          <label>
            Game icon (shows next to the name — square PNG/JPG){" "}
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadIcon(f);
            }}
          />
          {iconStatus && <p className="muted">{iconStatus}</p>}
        </div>
      )}
    </div>
  );
}

export function GameSetupStep({ cfg, update, next, back }: StepProps): JSX.Element {
  const verifiedCount = cfg.enabledGames.filter((id) => cfg.apps[id]?.verified).length;

  return (
    <div>
      <div className="panel">
        <h2>Discord apps — one per game</h2>
        <p>
          Each game gets its own Discord application so the widget header carries the game's name and icon. For each
          game below: copy its script, paste it in the{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              void openUrl("https://discord.com/developers/applications");
            }}
          >
            Developer Portal
          </a>{" "}
          console, then paste the credentials back here. If the script can't reset the bot token (2FA), grab it from
          the app's Bot page.
        </p>
        <label>Your Discord user ID (Settings → Advanced → Developer Mode on, then right-click yourself → Copy User ID)</label>
        <input type="text" value={cfg.discordUserId} onChange={(e) => update({ discordUserId: e.target.value })} />
      </div>

      {cfg.enabledGames.map((id) => (
        <GameCard key={id} cfg={cfg} update={update} providerId={id} />
      ))}

      <div className="nav">
        <button className="secondary" onClick={back}>
          Back
        </button>
        <button onClick={next} disabled={verifiedCount === 0 || cfg.discordUserId.trim().length < 10}>
          Continue ({verifiedCount}/{cfg.enabledGames.length} verified)
        </button>
      </div>
    </div>
  );
}
