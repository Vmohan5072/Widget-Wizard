import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { StepProps } from "../App";
import { providers } from "../providers";

export function AccountsStep({ cfg, update, next, back }: StepProps): JSX.Element {
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const enabled = providers.filter((p) => cfg.enabledGames.includes(p.id));

  const test = async (providerId: string) => {
    const provider = enabled.find((p) => p.id === providerId)!;
    setTesting(providerId);
    try {
      const stats = await provider.fetchStats(cfg.links, cfg);
      setResults((r) => ({
        ...r,
        [providerId]: { ok: true, msg: `${stats.title} — ${stats.stats.length} stats available ✓` },
      }));
    } catch (err) {
      setResults((r) => ({
        ...r,
        [providerId]: { ok: false, msg: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setTesting(null);
    }
  };

  const anyLinked = Object.values(results).some((r) => r.ok);

  // Union of API keys the enabled games can use.
  const keyFields = new Map<string, { label: string; url: string }>();
  for (const p of enabled) {
    for (const k of p.neededKeys) {
      if (!keyFields.has(k.field as string)) keyFields.set(k.field as string, { label: k.label, url: k.url });
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>API keys</h2>
        <p className="muted">
          All free and self-serve. Only fill in what you need: Faceit key for Faceit stats, Steam key for hours and
          vanity URLs, Leetify key just raises rate limits (Premier rating works without it if you have a Leetify
          profile).
        </p>
        {[...keyFields.entries()].map(([field, meta]) => (
          <div key={field}>
            <label>
              {meta.label}{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void openUrl(meta.url);
                }}
              >
                (get one)
              </a>
            </label>
            <input
              type="password"
              value={String(cfg[field as keyof typeof cfg] ?? "")}
              onChange={(e) => update({ [field]: e.target.value } as Partial<typeof cfg>)}
            />
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Game accounts</h2>
        {(() => {
          // Shared slots (like "steam") appear once, listing which games use them.
          const uniqueSlots = new Map<string, { label: string; hint: string; placeholder: string; games: string[] }>();
          for (const p of enabled) {
            for (const slot of p.slots) {
              const existing = uniqueSlots.get(slot.key);
              if (existing) existing.games.push(p.displayName);
              else uniqueSlots.set(slot.key, { ...slot, games: [p.displayName] });
            }
          }
          return [...uniqueSlots.entries()].map(([key, slot]) => (
            <div key={key}>
              <label>
                {slot.label} — {slot.hint}
                {slot.games.length > 1 ? ` (shared by ${slot.games.join(", ")})` : ` (${slot.games[0]})`}
              </label>
              <input
                type="text"
                placeholder={slot.placeholder}
                value={cfg.links[key] ?? ""}
                onChange={(e) => {
                  const links = { ...cfg.links };
                  if (e.target.value.trim()) links[key] = e.target.value.trim();
                  else delete links[key];
                  update({ links });
                }}
              />
            </div>
          ));
        })()}
        <div style={{ marginTop: 14 }}>
          {enabled.map((p) => (
            <div key={p.id} style={{ marginBottom: 6 }}>
              <button
                className="secondary"
                disabled={testing !== null || !p.slots.some((s) => cfg.links[s.key])}
                onClick={() => void test(p.id)}
              >
                {testing === p.id ? "Testing…" : `Test ${p.displayName}`}
              </button>
              {results[p.id] && (
                <span className={results[p.id].ok ? "status-ok" : "status-err"}> {results[p.id].msg}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="nav">
        <button className="secondary" onClick={back}>
          Back
        </button>
        <button onClick={next} disabled={!anyLinked}>
          Continue
        </button>
      </div>
    </div>
  );
}
