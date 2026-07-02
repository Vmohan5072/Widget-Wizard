import { useEffect, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { StepProps } from "../App";
import { generateBoardRepairSnippet } from "../discord";
import { readyGames, refreshAll, startScheduler, stopScheduler, type RefreshResult } from "../refresh";
import { startGateways, stopGateways } from "../gateway";
import { getProvider } from "../providers";

const INTERVALS = [
  { label: "Off", minutes: 0 },
  { label: "Every hour", minutes: 60 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Every 12 hours", minutes: 720 },
  { label: "Every 24 hours", minutes: 1440 },
  { label: "Every 7 days", minutes: 10080 },
];

export function DashboardStep({ cfg, update, back }: StepProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [repairCopied, setRepairCopied] = useState(false);
  const [log, setLog] = useState<RefreshResult[]>([]);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const addLog = (rs: RefreshResult[]) => setLog((l) => [...rs, ...l].slice(0, 30));

  const pushNow = async () => {
    setBusy(true);
    addLog(await refreshAll(cfgRef.current));
    update({ lastRefreshAt: Date.now() });
    setBusy(false);
  };

  useEffect(() => {
    startScheduler(() => cfgRef.current, addLog);
    return stopScheduler;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.refreshMinutes]);

  const ready = readyGames(cfg);
  const readyKey = ready.join(",");

  useEffect(() => {
    if (cfg.discordCommand) {
      void startGateways(ready, () => cfgRef.current, (r) => addLog([r]));
    }
    return stopGateways;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.discordCommand, readyKey]);

  const active = ready.map((id) => getProvider(id).displayName);

  return (
    <div>
      <div className="panel">
        <h2>Dashboard</h2>
        <p>
          Active widgets: <b>{active.length ? active.join(", ") : "none yet"}</b>
        </p>
        <label>Auto refresh</label>
        <select
          value={cfg.refreshMinutes}
          onChange={(e) => update({ refreshMinutes: Number(e.target.value) })}
          style={{ maxWidth: 220 }}
        >
          {INTERVALS.map((i) => (
            <option key={i.minutes} value={i.minutes}>
              {i.label}
            </option>
          ))}
        </select>
        <div style={{ margin: "10px 0" }}>
          <label style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>
            <input type="checkbox" checked={cfg.refreshOnOpen} onChange={(e) => update({ refreshOnOpen: e.target.checked })} />{" "}
            Refresh when the app opens (at most every 3 hours)
          </label>
        </div>
        <div style={{ margin: "10px 0" }}>
          <label style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>
            <input type="checkbox" checked={cfg.discordCommand} onChange={(e) => update({ discordCommand: e.target.checked })} />{" "}
            Enable <code>/refresh</code> in Discord (works while this app is running)
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => void pushNow()} disabled={busy}>
            {busy ? "Pushing…" : "Push all now"}
          </button>
          <button className="secondary" onClick={() => update({ wizardStep: 3 })}>
            Edit widget content
          </button>
          <button className="secondary" onClick={() => update({ wizardStep: 2 })}>
            Edit accounts and keys
          </button>
          <button className="secondary" onClick={() => update({ wizardStep: 1 })}>
            Manage game apps
          </button>
        </div>
        <h2 style={{ marginTop: 20, fontSize: 15 }}>Activity</h2>
        {log.length === 0 && <p className="muted">Nothing yet — hit "Push all now".</p>}
        {log.map((r, i) => (
          <p key={i} className={r.ok ? "status-ok" : "status-err"} style={{ margin: "4px 0", fontSize: 13 }}>
            {r.at.toLocaleTimeString()} — {r.game}: {r.message}
          </p>
        ))}
      </div>
      <div className="panel">
        <h2 style={{ fontSize: 15 }}>Profile board repair</h2>
        <p className="muted">
          If your profile shows "There was a problem updating your profile", or widgets won't attach (usually after
          deleting an app whose widget was still on the board), copy this snippet and run it in the <b>Discord
          client's</b> console (discord.com/app → F12 → Console). It removes broken entries and re-attaches all your
          verified game widgets, keeping your game lists.
        </p>
        <button
          className="secondary"
          onClick={async () => {
            await writeText(generateBoardRepairSnippet(readyGames(cfgRef.current).map((id) => cfgRef.current.apps[id].applicationId)));
            setRepairCopied(true);
            setTimeout(() => setRepairCopied(false), 2000);
          }}
        >
          {repairCopied ? "Copied ✓" : "Copy board repair snippet"}
        </button>
      </div>
      <div className="panel">
        <p className="muted">
          Not seeing changes on your profile? Widgets only render on desktop, and each game's config must be published
          (the setup script publishes it). Other viewers need Discord's widgets experiment rolled out to them. Full
          list of fixes: docs/troubleshooting.md in the repo.
        </p>
      </div>
      <div className="nav">
        <button className="secondary" onClick={back}>
          Back
        </button>
        <span />
      </div>
    </div>
  );
}
