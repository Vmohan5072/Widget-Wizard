import type { StepProps } from "../App";
import { providers } from "../providers";

export function WelcomeStep({ cfg, update, next }: StepProps): JSX.Element {
  const toggle = (id: string) => {
    const on = cfg.enabledGames.includes(id);
    update({ enabledGames: on ? cfg.enabledGames.filter((g) => g !== id) : [...cfg.enabledGames, id] });
  };

  return (
    <div className="panel">
      <h2>Welcome</h2>
      <p>
        Widget Wizard puts live game-stats widgets on your Discord profile. Each game gets its own Discord application
        — named and iconed after the game — so every widget shows proper branding, and they can all sit on your profile
        at once. You assemble each widget's stat board yourself from everything the game APIs offer.
      </p>
      <p className="muted">
        Heads up: profile widgets are an unreleased Discord experiment. Setup involves pasting one script per game into
        the Developer Portal's browser console, and Discord can change or remove the feature at any time. Widgets only
        render on desktop, and other viewers need the experiment rolled out to see them.
      </p>
      <label>Which games do you want widgets for?</label>
      {providers.map((p) => (
        <div key={p.id} style={{ margin: "6px 0" }}>
          <label style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>
            <input type="checkbox" checked={cfg.enabledGames.includes(p.id)} onChange={() => toggle(p.id)} />{" "}
            {p.displayName}
          </label>
        </div>
      ))}
      <div className="nav">
        <span />
        <button onClick={next} disabled={cfg.enabledGames.length === 0}>
          Get started
        </button>
      </div>
    </div>
  );
}
