import { useEffect, useState } from "react";
import { type AppConfig, defaultConfig, loadConfig, saveConfig } from "./config";
import { readyGames, refreshAll } from "./refresh";
import { WelcomeStep } from "./steps/Welcome";
import { GameSetupStep } from "./steps/GameSetup";
import { AccountsStep } from "./steps/Accounts";
import { WidgetConfigStep } from "./steps/WidgetConfig";
import { DashboardStep } from "./steps/Dashboard";

export interface StepProps {
  cfg: AppConfig;
  update: (patch: Partial<AppConfig>) => void;
  next: () => void;
  back: () => void;
}

const steps: { name: string; component: (p: StepProps) => JSX.Element }[] = [
  { name: "Welcome", component: WelcomeStep },
  { name: "Game apps", component: GameSetupStep },
  { name: "Accounts", component: AccountsStep },
  { name: "Widget content", component: WidgetConfigStep },
  { name: "Dashboard", component: DashboardStep },
];

export default function App(): JSX.Element {
  const [cfg, setCfg] = useState<AppConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadConfig().then((c) => {
      setCfg(c);
      setLoaded(true);
      // Refresh-on-open with a 3 hour cooldown.
      const THREE_HOURS = 3 * 60 * 60 * 1000;
      if (c.refreshOnOpen && Date.now() - c.lastRefreshAt > THREE_HOURS && readyGames(c).length) {
        void refreshAll(c).then(() => setCfg((cur) => ({ ...cur, lastRefreshAt: Date.now() })));
      }
    });
  }, []);

  useEffect(() => {
    if (loaded) void saveConfig(cfg);
  }, [cfg, loaded]);

  if (!loaded) return <p className="muted">Loading…</p>;

  const step = Math.min(cfg.wizardStep, steps.length - 1);
  const update = (patch: Partial<AppConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const go = (n: number) => update({ wizardStep: Math.max(0, Math.min(n, steps.length - 1)) });
  const Step = steps[step].component;

  return (
    <div>
      <h1>Widget Wizard</h1>
      <p className="muted">Game-stats widgets on your Discord profile — one per game.</p>
      <div className="steps">
        {steps.map((s, i) => (
          <span
            key={s.name}
            className={`step-chip ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            style={{ cursor: i < step ? "pointer" : "default" }}
            onClick={() => i < step && go(i)}
          >
            {i < step ? "✓ " : ""}
            {s.name}
          </span>
        ))}
      </div>
      <Step cfg={cfg} update={update} next={() => go(step + 1)} back={() => go(step - 1)} />
    </div>
  );
}
