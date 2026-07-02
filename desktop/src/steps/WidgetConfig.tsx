import { useEffect, useState } from "react";
import type { StepProps } from "../App";
import { GAME_NAME_KEY } from "../discord";
import { getProvider, providers } from "../providers";
import type { CoverOption, GameStats } from "../providers/types";

export function WidgetConfigStep({ cfg, update, next, back }: StepProps): JSX.Element {
  const configurable = providers.filter(
    (p) => cfg.enabledGames.includes(p.id) && p.slots.some((s) => cfg.links[s.key]),
  );
  const [game, setGame] = useState(configurable[0]?.id ?? "");
  const [stats, setStats] = useState<GameStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [covers, setCovers] = useState<CoverOption[] | null>(null);
  const [coversLoading, setCoversLoading] = useState(false);

  const provider = game ? getProvider(game) : null;

  useEffect(() => {
    if (!game) return;
    setLoading(true);
    setError(null);
    setStats(null);
    setCovers(null);
    getProvider(game)
      .fetchStats(cfg.links, cfg)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const selected = cfg.selectedStats[game] ?? stats?.stats.slice(0, 6).map((s) => s.key) ?? [];
  const subtitles = cfg.subtitleStats[game] ?? [];
  const cover = cfg.covers[game] ?? { mode: "auto" as const };

  const setSelected = (keys: string[]) => update({ selectedStats: { ...cfg.selectedStats, [game]: keys } });
  const setSubtitles = (keys: string[]) => update({ subtitleStats: { ...cfg.subtitleStats, [game]: keys } });
  const setCover = (c: typeof cover) => update({ covers: { ...cfg.covers, [game]: c } });

  const toggle = (key: string) => {
    if (selected.includes(key)) setSelected(selected.filter((k) => k !== key));
    else if (selected.length < 6) setSelected([...selected, key]);
  };

  const move = (key: string, dir: -1 | 1) => {
    const i = selected.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const copy = [...selected];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setSelected(copy);
  };

  const loadCovers = async () => {
    if (!provider?.coverOptions) return;
    setCoversLoading(true);
    try {
      setCovers(await provider.coverOptions(cfg.links, cfg));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCoversLoading(false);
    }
  };

  const subtitleChoices = [
    { key: GAME_NAME_KEY, label: "Game name" },
    ...(stats?.stats.map((s) => ({ key: s.key, label: `${s.label} (${s.value})` })) ?? []),
  ];

  const subtitlePreview = (key: string): string => {
    if (key === GAME_NAME_KEY) return stats?.game ?? "";
    const s = stats?.stats.find((x) => x.key === key);
    return s ? `${s.value} ${s.label}` : "";
  };

  const shown = selected.map((k) => stats?.stats.find((s) => s.key === k)).filter((s) => s != null);
  const previewCover = cover.mode === "url" && cover.url ? cover.url : stats?.imageUrl;
  const headerName = cfg.apps[game]?.appName ?? provider?.displayName ?? "";

  return (
    <div>
      <div className="panel">
        <h2>Widget content</h2>
        <p className="muted">Each game has its own widget — configure them one at a time.</p>
        <div className="steps" style={{ marginTop: 8 }}>
          {configurable.map((p) => (
            <span
              key={p.id}
              className={`step-chip ${game === p.id ? "active" : ""}`}
              style={{ cursor: "pointer", fontSize: 13, padding: "6px 14px" }}
              onClick={() => setGame(p.id)}
            >
              {p.displayName}
            </span>
          ))}
        </div>

        {loading && <p className="muted">Fetching stats…</p>}
        {error && <p className="status-err">{error}</p>}

        {stats && (
          <>
            <h2 style={{ fontSize: 15, marginTop: 16 }}>Header</h2>
            <p className="muted">Big title is your account name. Add up to two lines under it.</p>
            {[0, 1].map((i) => (
              <select
                key={i}
                style={{ marginBottom: 6 }}
                value={subtitles[i] ?? ""}
                onChange={(e) => {
                  const next = [...subtitles];
                  if (e.target.value) next[i] = e.target.value;
                  else next.splice(i, 1);
                  setSubtitles(next.filter(Boolean).slice(0, 2));
                }}
              >
                <option value="">— none —</option>
                {subtitleChoices.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            ))}

            <h2 style={{ fontSize: 15, marginTop: 16 }}>Cover image</h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ margin: 0 }}>
                <input type="radio" checked={cover.mode === "auto"} onChange={() => setCover({ mode: "auto" })} /> Account
                avatar
              </label>
              <label style={{ margin: 0 }}>
                <input type="radio" checked={cover.mode === "url"} onChange={() => setCover({ mode: "url", url: cover.url ?? "" })} />{" "}
                Custom
              </label>
              {provider?.coverOptions && (
                <button className="secondary" onClick={() => void loadCovers()} disabled={coversLoading}>
                  {coversLoading ? "Loading…" : "Pick a hero icon"}
                </button>
              )}
            </div>
            {cover.mode === "url" && (
              <input
                type="text"
                placeholder="https://… image URL (must be publicly reachable)"
                value={cover.url ?? ""}
                onChange={(e) => setCover({ mode: "url", url: e.target.value })}
              />
            )}
            {covers && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {covers.map((c) => (
                  <img
                    key={c.url}
                    src={c.url}
                    title={c.label}
                    style={{
                      width: 72,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: cover.url === c.url ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                    onClick={() => setCover({ mode: "url", url: c.url, label: c.label })}
                  />
                ))}
              </div>
            )}

            <h2 style={{ fontSize: 15, marginTop: 16 }}>Stats board</h2>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p className="muted">Pick up to 6 stats. Use the arrows to order them.</p>
                {stats.stats.map((s) => {
                  const on = selected.includes(s.key);
                  return (
                    <div className="stat-row" key={s.key}>
                      <input type="checkbox" checked={on} onChange={() => toggle(s.key)} />
                      <span className="grow">
                        {s.label}: <b>{s.value}</b>
                      </span>
                      {on && (
                        <>
                          <button className="secondary" style={{ padding: "2px 8px" }} onClick={() => move(s.key, -1)}>
                            ↑
                          </button>
                          <button className="secondary" style={{ padding: "2px 8px" }} onClick={() => move(s.key, 1)}>
                            ↓
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="muted">Preview</p>
                <div className="widget-preview">
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    ▣ {headerName}
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div className="wp-title">{stats.title}</div>
                      {subtitles.map((k) => (
                        <div key={k} className="muted" style={{ fontSize: 13 }}>
                          {subtitlePreview(k)}
                        </div>
                      ))}
                    </div>
                    {previewCover && (
                      <img src={previewCover} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                    )}
                  </div>
                  <div className="wp-grid" style={{ marginTop: 12 }}>
                    {shown.map((s) => (
                      <div className="wp-stat" key={s.key}>
                        <b>{s.value}</b>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="nav">
        <button className="secondary" onClick={back}>
          Back
        </button>
        <button onClick={next} disabled={!stats || shown.length === 0}>
          Continue
        </button>
      </div>
    </div>
  );
}
