# Widget bot

Keeps a Discord profile widget filled with live game stats. Supports Counter-Strike (Faceit and/or Premier), Dota 2 (OpenDota), and Deadlock (deadlock-api.com).

Counter-Strike is a single widget with two optional account links: link Faceit for elo/level/winrate, link Steam for Premier rating and hours, or link both. The widget adapts to whatever is linked.

Do the one-time widget/application setup first: [`../docs/widget-setup.md`](../docs/widget-setup.md).

## Setup

Needs Node 20+.

```sh
cd bot
npm install
cp .env.example .env   # fill it in
npm run register       # registers /widget (once, and after command changes)
npm run dev
```

For a long-running deploy: `npm run build && npm start` (pm2/systemd/Docker, whatever you like).

## Commands

| Command | What it does |
|---|---|
| `/widget setup` | Authorization link + getting started |
| `/widget link game account [service]` | Link a game account (validates it immediately). For Counter-Strike, `service` picks Faceit vs Steam; without it the bot guesses from the account format |
| `/widget show game` | Pick which linked game the widget displays |
| `/widget refresh` | Push fresh stats to the widget now |
| `/widget status` | List linked accounts |

Linked users are auto-refreshed every `REFRESH_MINUTES` (default 60, 0 to disable).

## API keys

- **Faceit** — required for Faceit stats. Free: [developers.faceit.com](https://developers.faceit.com), App Studio, server-side key.
- **Steam** — optional but recommended: [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey). Enables the Hours stat (CS2, Dota 2, Deadlock) and vanity URL resolution. Hours require the profile's game details to be public.
- **Leetify** — optional, raises rate limits: [leetify.com/app/developer](https://leetify.com/app/developer). Used only as the data source for Premier rating (no official Valve API exposes it); requires a Leetify profile for that Steam account. Their guidelines forbid storing API data — the bot persists nothing.
- OpenDota and deadlock-api.com need no keys at hobby volume.

## Notes

- Account links live in `data/store.json`. No stats are stored, only the account identifiers.
- Deadlock has no official API; deadlock-api.com is a community project and can break or get cut off by Valve at any time.
- The widget's User Data field names must match what the bot sends — table in `docs/widget-setup.md`.
