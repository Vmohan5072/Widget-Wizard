# Widget Wizard

Desktop app that walks anyone through putting game-stats widgets on their Discord profile — no terminal, no Node, no bot hosting. It generates per-game portal setup scripts, validates credentials, links game accounts, lets you assemble each widget's stat board (subtitles, cover image, up to 6 ordered stats), and keeps every widget refreshed while the app runs.

Each game gets its **own Discord application**, named and iconed after the game, so the widget header shows proper game branding — and all your game widgets can sit on the profile board at once. Since Discord only lets an application's owner attach its widget, you own every app; tokens never leave your machine.

## Development

Prereqs: Node 20+, Rust (rustup.rs), and on Windows the "Desktop development with C++" workload from VS Build Tools.

```sh
cd desktop
npm install
npm run tauri dev
```

## Building the installer

```sh
npm run tauri build
```

Outputs land in `src-tauri/target/release/bundle/` — `.msi`/`.exe` (NSIS) on Windows, `.dmg` on macOS, `.deb`/`.AppImage` on Linux. Installers must be built on their target OS; a GitHub Actions matrix can cover all three per release.

## Architecture

- Tauri 2 shell (Rust is boilerplate only — plugins: http, store, clipboard, opener)
- React + Vite frontend, wizard-style: Welcome → Discord setup → Credentials → Game accounts → Widget content → Dashboard
- Game API calls go through the Tauri http plugin (no CORS restrictions); allowed hosts are pinned in `src-tauri/capabilities/default.json`
- `src/assets/bootstrap-template.js` is a copy of `../scripts/portal-bootstrap.js` — keep them in sync when the portal script changes
- Config (including the bot token) is stored via the store plugin in the app's data dir. Moving the token to the OS keychain is a planned hardening step.
- Stat selection: providers return all available stats with stable keys; the picker stores an ordered list of up to 6 per game, and only those are pushed to the widget

## Notes

- The refresh loop runs only while the app is open. Tray/background mode is on the roadmap.
- The `bot/` folder in this repo is the alternative for people who want slash commands or server hosting; the app and bot push identical identity payloads, so they're interchangeable.
