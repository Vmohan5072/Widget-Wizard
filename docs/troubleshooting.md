# Troubleshooting

Distilled from the Discord Previews #widget-faq (thanks to the folks there). Two consoles are involved — don't mix them up: **portal console** = devtools on discord.com/developers/applications; **client console** = devtools in the Discord app/browser client. Snippets that touch your profile or the Add Widget menu go in the *client* console.

Both consoles use the same module-finder helper. Client version:

```js
let _mods = webpackChunkdiscord_app.push([[Symbol()],{},e=>e.c]); webpackChunkdiscord_app.pop();
let findByProps = (...props) => { for (let m of Object.values(_mods)) { try {
  if (!m.exports || m.exports === window) continue;
  if (props.every((x) => m.exports?.[x])) return m.exports;
  for (let ex in m.exports) if (props.every((x) => m.exports?.[ex]?.[x]) && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') return m.exports[ex];
} catch {} } };
```

(For the portal console, replace `webpackChunkdiscord_app` with `webpackChunkdiscord_developers`.)

## "Your game stats are still syncing"

No identity has been pushed yet. Run `/widget refresh` in the bot. If doing it by hand, the PATCH body must contain at least `{"data":{"dynamic":[]}}` or the widget won't display to others.

## Widget missing from the Add Widget menu

The bootstrap script attaches directly, so you normally don't need the menu. To surface it anyway, in the **client** console:

```js
findByProps("getFeaturedApplicationIds").getFeaturedApplicationIds().push("YOUR_APPLICATION_ID");
```

## 401 when saving the profile board / attaching

In order of likelihood:

1. **You don't own the application.** Only owners can add a widget since June 4th 2026. Check you're signed into the right account and the app appears in your applications list. (Team workaround: adding a friend to a team that owns the app lets them use its widget.)
2. **Your board holds widgets you can't save** — from apps you don't own, or from an app you deleted. Wipe the board in the **client** console, then re-attach:

   ```js
   let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]); webpackChunkdiscord_app.pop();
   let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;
   api.put({url: `/users/@me/widgets`, body: {widgets: []}})
   ```

3. **You're not in the widgets experiment rollout.** Nothing to do but wait.

## Error 50025 / 50026 / "requested scope is invalid"

Social SDK form not filled out, wrong scope, or wrong response type. The URL must use `scope=sdk.social_layer_presence` and `response_type=token`. Never request `application_identities.write` explicitly.

## Widget editor tab missing on the portal

Run the editor-unlock snippet (`docs/widget-setup.md` step 2) in the **portal** console. Then: don't reload the page (the override is in-memory), and open the application *after* running the script — run it from the applications list, not while already inside the app page.

## Other people can't see my widget

In order: publish the config (editor → Publish, top right); make sure an identity has been pushed (`/widget refresh`); have them check on **desktop** — widgets never render on mobile. If all that's in place and they still see nothing, their client likely isn't in the widgets-v2 renderer experiment rollout yet — confirmed in practice (owner with the experiment sees the widget fine while others don't). Nothing to fix; visibility spreads as Discord rolls the experiment out.

## Identity push returns 400

Malformed JSON, or a placeholder/unreachable image URL. Image fields must be public URLs that Discord's media proxy can fetch — the bot only sends images when it has a real avatar URL, so this mostly bites manual pushes.

## Identity push returns 401

Invalid bot token. Reset it on the portal's Bot page and update `bot/.env`.

## Widget image spills outside the frame

Intentional — the hero layout is built for tall transparent character portraits. For square game avatars, switch the header to the contained image type in the widget editor.

## Widget config changes not showing

Save in the editor, then restart the client (Ctrl+R). If you renamed or added data field keys, push a fresh identity afterwards (`/widget refresh`).
