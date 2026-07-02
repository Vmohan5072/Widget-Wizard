# Widget setup (one time, per application owner)

This walks through creating the Discord application, building the widget config, and attaching the widget to your profile. Based on the guide at [chloecinders.com/blog/discord-widgets](https://chloecinders.com/blog/discord-widgets) — read that too, and join [Discord Previews](https://discord.gg/discord-603970300668805120) (#widget-faq) if you get stuck.

> Widgets v2 is an unreleased experiment. Since June 4th 2026 only the application **owner** can add its widget to their profile. All of the below is done on your own account, for your own app.

## Fast path (one paste)

`scripts/portal-bootstrap.js` does steps 1–4 and 6 of the manual flow below in one go: open the [Developer Portal](https://discord.com/developers/applications), open devtools (F12) → Console, paste the script, solve the captcha/2FA when prompted. It creates the app, enables the Social SDK, publishes a widget config already wired to this bot's field names, self-authorizes the sdk scope, attaches the widget to your profile, and copies a ready `bot/.env` snippet to your clipboard. Then finish with steps in `bot/README.md` — the widget shows "syncing" until the bot's first `/widget refresh`.

Two caveats: the portal's minified module names change when Discord redeploys, so the script can break at any time (fall back to the manual flow); still enable **User Install** manually (Installation page) so `/widget` works everywhere. To restyle the widget later, the script leaves you in the editor.

## Manual flow

## 1. Create the application + Social SDK access

1. Go to the [Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Sidebar → **Installation**: enable **User Install** as an installation context. Then install the app to your own account (open the install link from that page and pick "Add to my apps") so `/widget` works everywhere.
3. Sidebar → Games → **Social SDK**. Fill out the form (you don't need a real game). Access is instant.

## 2. Unlock the widget editor

The widget editor is behind a Dev Portal experiment. Open devtools (F12) on the Developer Portal, Console tab, and run:

```js
let _mods = webpackChunkdiscord_developers.push([[Symbol()],{},r=>r.c]);
webpackChunkdiscord_developers.pop();

let findByProps = (...props) => {
    for (let m of Object.values(_mods)) {
        try {
            if (!m.exports || m.exports === window) continue;
            if (props.every((x) => m.exports?.[x])) return m.exports;

            for (let ex in m.exports) {
                if (props.every((x) => m.exports?.[ex]?.[x]) && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') return m.exports[ex];
            }
        } catch {}
    }
}

findByProps("getAll").getAll().find(e=>e.getName() === "ApexExperimentStore").createOverride("2026-03-widget-config-editor", 1)
```

The override is in-memory — navigate back and reopen your application **without refreshing**. You'll now see **Widget** under Games in the sidebar.

## 3. Build the widget config

Create a widget and fill out all three required surfaces: **Widget Top**, **Widget Bottom**, **Add Widget Preview**.

The bot pushes a fixed set of data field names. When you add a User Data field in the editor, use these names exactly:

| Data Field name | What the bot sends            | Suggested placement |
|-----------------|-------------------------------|---------------------|
| `title`         | Account name / nickname       | Widget Top title    |
| `game`          | Game name (e.g. "Dota 2")     | Widget Top subtitle |
| `avatar`        | Image URL (when available)    | Widget Top image    |
| `stat_1_label` … `stat_6_label` | Stat labels ("Elo", "Winrate", …) | Widget Bottom stats |
| `stat_1_value` … `stat_6_value` | Stat values ("2140", "62%", …)    | Widget Bottom stats |

Set text fields to Text → User Data, give each a sensible fallback. Numbers work fine as text.

Use the **Sample Data** tab to preview, then **Save Changes** and **Publish**.

## 4. OAuth authorization

1. Sidebar → OAuth2. Add a redirect URI — `https://discord.com` is fine.
2. Build the URL manually (the generator may not list the sdk scope): `https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=sdk.social_layer_presence&response_type=token`
3. `response_type` must be `token`, not `code`. Do **not** request `application_identities.write` — that makes the authorization fail (error 50025/50026 usually means wrong scopes, missing Social SDK enrollment, or `response_type=code`).
4. Open it and authorize. The consent screen lists a lot of permissions — that's the SDK scope bundle. The bot never stores or uses the token.

`/widget setup` in the bot hands out this same URL, so put it in the bot's `.env` (`OAUTH_URL`).

## 5. Push your first identity

Run the bot and use `/widget link` + `/widget refresh` (see `bot/README.md`). Until an identity has been pushed, the widget shows "Your game stats are still syncing. Keep playing!" and won't display to others.

## 6. Attach the widget to your profile

There's no UI for this. Snippets that call the client API live in the Discord Previews thread:
https://discord.com/channels/603970300668805120/1509942620762276011

You also need the client experiment `2026-03-application-widget-v2-renderer` set to Variant 1 to see the result (ask in Discord Previews if you don't know how).

Widgets only render on desktop/browser, never mobile.

## Don't be that person

Abuse gets this pulled for everyone. No staff impersonation, no spam widgets.
