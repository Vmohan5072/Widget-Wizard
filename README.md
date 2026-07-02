# Widget Wizard

Live game-stats widgets on your Discord profile. Each game gets its own Discord application — named and iconed after the game — so every widget carries proper branding, and they all sit on your profile board at once. You assemble each widget's stat board yourself from everything the game APIs offer.

Supported games:

- **Counter-Strike 2** — Faceit elo/level/winrate/K/D, best-winrate map, Premier rating, hours, lifetime Steam stats
- **Dota 2** — rank, winrates, KDA, GPM/XPM, top/best hero, in-match and Steam hours, all-time totals
- **Deadlock** — matches, winrate, KDA, top hero, hours

## How it works

Discord's Profile Board has a "Game Stats" widget type, officially limited to a few partner games. The widgets v2 experiment lets any application define one — this project builds on that. Since June 2026 only an application's *owner* can attach its widget, so Widget Wizard makes you the owner: it walks you through creating your own app per game, then keeps the widgets filled with your live stats.

> **Fair warning:** widgets v2 is an unreleased Discord experiment. Setup involves running a script in the Developer Portal's browser console, widgets only render on desktop, other viewers need the experiment rolled out to them, and Discord can change or pull the feature at any time.

## The app (start here)

**`desktop/`** — the Widget Wizard desktop app (Tauri + React). A wizard walks you through the whole setup: per-game Discord app creation, credentials, game accounts, and a stat-board editor (pick and order up to 6 stats, two subtitle lines, cover image with hero-icon galleries). Refresh modes: interval presets, refresh-on-launch, and a `/refresh` slash command in Discord. Build instructions in [`desktop/README.md`](desktop/README.md).

## Other pieces

- **`scripts/portal-bootstrap.js`** — the Developer Portal console script the app generates; can also be used standalone. Creates the application, enables the Social SDK, publishes the widget layout, authorizes, attaches the widget, and hands back credentials.
- **`bot/`** — a standalone Discord bot alternative (Node/discord.js) for one application, with `/widget` slash commands. Predates the desktop app; useful for server-hosted setups.
- **`docs/widget-setup.md`** — the manual setup flow, for understanding what the script automates or when Discord changes their bundle and the script breaks.
- **`docs/troubleshooting.md`** — every failure mode we've hit, with fixes. Read this before asking anything.

## Credits

The widget technique comes from the community around the [Discord Previews](https://discord.gg/discord-603970300668805120) server. Guide that started it all: [chloecinders.com/blog/discord-widgets](https://chloecinders.com/blog/discord-widgets).

Not affiliated with Discord, Valve, Faceit, or Leetify.
