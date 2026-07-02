// Portal bootstrap — run in the Discord Developer Portal's devtools console.
//
// Does the whole one-time setup in a single paste:
//   1. creates a new application (solve the captcha if one appears)
//   2. enables the Social SDK on it
//   3. creates + publishes a game-stats widget config pre-wired to the
//      data field names the bot in this repo pushes
//   4. sets the OAuth redirect and self-authorizes the sdk scope
//   5. attaches the widget to your profile (owner-only since June 2026)
//   6. resets the bot token and copies a ready-to-paste bot/.env snippet
//   7. unlocks the widget editor and opens it so you can restyle
//
// Technique from the Discord Previews community (see docs/widget-setup.md
// for credits and the manual flow). The portal bundle is minified, so the
// module lookups below can break whenever Discord redeploys — if a lookup
// fails, fall back to the manual steps.
//
// The widget will show "syncing" until the bot pushes your first stats:
// fill bot/.env with the copied snippet, then /widget link + /widget refresh.

(async () => {
  const APP_NAME = "Widget Wizard"; // rename if you like

  // Resuming a previous run that failed partway? Put its IDs here and the
  // script skips creation and finishes the remaining steps. Leave empty for
  // a fresh run.
  const EXISTING_APP_ID = "";
  const EXISTING_CONFIG_ID = "";

  // Capture the devtools copy() utility now - it stops existing after awaits.
  const clipboardCopy = typeof copy === "function" ? copy : null;

  // Pull the portal's own modules out of webpack so every call runs with
  // your session, exactly like clicking the UI.
  const cache = webpackChunkdiscord_developers.push([[Symbol()], {}, (r) => r.c]);
  webpackChunkdiscord_developers.pop();
  const mods = Object.values(cache);
  // Discord's i18n proxy answers to every property name, so it false-matches
  // any duck-type test. It has to be excluded by its tag before probing.
  const pick = (test) => {
    for (const m of mods) {
      try {
        const ex = m.exports;
        if (!ex || ex === window) continue;
        const candidates = [ex];
        for (const k in ex) {
          try {
            if (ex[k]) candidates.push(ex[k]);
          } catch {}
        }
        for (const c of candidates) {
          try {
            if (c[Symbol.toStringTag] === "IntlMessagesProxy") continue;
            if (test(c)) return c;
          } catch {}
        }
      } catch {}
    }
    return undefined;
  };

  const pickAll = (test) => {
    const found = [];
    for (const m of mods) {
      try {
        const ex = m.exports;
        if (!ex || ex === window) continue;
        const candidates = [ex];
        for (const k in ex) {
          try {
            if (ex[k]) candidates.push(ex[k]);
          } catch {}
        }
        for (const c of candidates) {
          try {
            if (c[Symbol.toStringTag] === "IntlMessagesProxy") continue;
            if (test(c) && !found.includes(c)) found.push(c);
          } catch {}
        }
      } catch {}
    }
    return found;
  };

  const experiments = pick((x) => typeof x.createOverride === "function");
  const dispatcher = pick((x) => typeof x.__proto__?.flushWaitQueue === "function" && typeof x.dispatch === "function");

  // Several modules look like HTTP clients. Probe each with a harmless
  // authenticated request and keep the one that actually works.
  const restCandidates = pickAll((x) => ["get", "post", "patch", "put"].every((k) => typeof x[k] === "function"));
  let rest;
  let me;
  for (const c of restCandidates) {
    try {
      const r = await c.get({ url: "/users/@me" });
      if (r?.body?.id) {
        rest = c;
        me = r.body.id;
        break;
      }
    } catch {}
  }

  if (!experiments || !rest) {
    throw new Error("[bootstrap] Couldn't locate portal modules (found " + restCandidates.length + " client candidates, none worked). Discord likely changed their bundle - use the manual flow in docs/widget-setup.md.");
  }
  console.log("[bootstrap] Found the API client. Logged in as user " + me);

  let app;
  if (EXISTING_APP_ID) {
    console.log("[bootstrap] Resuming with existing application " + EXISTING_APP_ID);
    app = { id: EXISTING_APP_ID };
  } else {
    console.log("[bootstrap] Creating application… solve the captcha if prompted");
    const appRes = await rest.post({ url: "/applications", body: { name: APP_NAME, team_id: null } });
    app = appRes.body;
    if (!app?.id) {
      console.error("[bootstrap] Raw create response for debugging:", appRes);
      throw new Error("[bootstrap] Application create returned no id - captcha declined or API changed. Nothing was created; reload and retry.");
    }
    dispatcher?.dispatch({ type: "APPLICATION_CREATE_SUCCESS", application: app });

    console.log("[bootstrap] Enabling Social SDK…");
    await rest.post({
      url: `/applications/${app.id}/social-sdk/enable`,
      body: {
        name: APP_NAME,
        business_email: "widgets@example.com",
        game_or_studio_name: APP_NAME,
        game_or_studio_url: "",
        email_updates_consent: false,
        country_or_region: "United States",
        title_role: "Founder",
        target_platforms: [],
        form_type: "Dev Solutions",
        sfdc_leadsource: "Dev Portal",
        utm_campaign: "SDK Enable Form",
      },
    });
  }

  console.log("[bootstrap] Creating the widget config…");
  const config = EXISTING_CONFIG_ID
    ? { config_id: EXISTING_CONFIG_ID }
    : (await rest.post({ url: `/applications/${app.id}/widget-configs`, body: { display_name: APP_NAME } })).body;

  // Field names here must stay in sync with bot/src/identity.ts.
  // Note on the hero image: widget_top_hero is designed for tall transparent
  // portraits that overflow the frame. Square game avatars can look odd in
  // it - if yours does, switch the header to the contained image type in the
  // editor that opens at the end.
  // Per the widget-config schema, "fallback" is a nested field object, not a
  // plain string.
  const dataText = (name, fallback) => ({
    presentation_type: "text",
    value_type: "data",
    value: name,
    fallback: { presentation_type: "text", value_type: "custom_string", value: fallback },
  });
  const statSlots = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((i) => [
      `stat_${i}`,
      { fields: { label: dataText(`stat_${i}_label`, "—"), value: dataText(`stat_${i}_value`, "—") } },
    ]),
  );
  const surfaces = (withSubtitles) => ({
    widget_top: {
      layout: "widget_top_hero",
      components: {
        hero_image: { fields: { image: { presentation_type: "image", value_type: "data", value: "avatar" } } },
        title: { fields: { text: dataText("title", "Game stats") } },
        ...(withSubtitles
          ? {
              subtitle_1: { fields: { text: dataText("subtitle_1", "") } },
              subtitle_2: { fields: { text: dataText("subtitle_2", "") } },
            }
          : {}),
      },
    },
    widget_bottom: { layout: "widget_bottom_stats", components: statSlots },
    add_widget_preview: {
      layout: "add_widget_preview_hero",
      components: {
        hero_image: { fields: { image: { presentation_type: "image", value_type: "data", value: "avatar" } } },
      },
    },
  });
  try {
    await rest.patch({ url: `/applications/${app.id}/widget-configs/${config.config_id}`, body: { surfaces: surfaces(true) } });
  } catch (e) {
    console.warn("[bootstrap] Subtitle fields rejected (layout schema may differ) - retrying without them. Add subtitles in the editor and bind them to the subtitle_1/subtitle_2 data fields.", e);
    await rest.patch({ url: `/applications/${app.id}/widget-configs/${config.config_id}`, body: { surfaces: surfaces(false) } });
  }

  try {
    await rest.post({ url: `/applications/${app.id}/widget-configs/${config.config_id}/publish` });
    console.log("[bootstrap] Widget config published.");
  } catch (e) {
    console.warn("[bootstrap] Publish failed - finish the config in the editor that opens at the end, then publish there.", e);
  }

  console.log("[bootstrap] Authorizing the sdk scope…");
  await rest.patch({ url: `/applications/${app.id}`, body: { redirect_uris: ["https://discord.com"] } });
  await rest.post({
    url: `/oauth2/authorize?client_id=${app.id}&response_type=token&scope=sdk.social_layer_presence`,
    body: { authorize: true },
  });

  console.log("[bootstrap] Attaching the widget to your profile…");
  try {
    const profile = (await rest.get({ url: `/users/${me}/profile` })).body;
    const widgets = [{ data: { type: "application", application_id: app.id } }, ...(profile.widgets ?? [])];
    await rest.put({ url: `/users/@me/widgets`, body: { widgets } });
  } catch (e) {
    // A 401 here usually means the board holds widgets from apps you don't
    // own (or from a deleted app) - the board can't be saved while those are
    // on it - or your account isn't in the widgets rollout yet.
    console.warn(
      "[bootstrap] Couldn't attach the widget. If your profile board has widgets from apps you don't own or ones you deleted, wipe it and re-run this script from the applications list:\n" +
        "  api.put({url: `/users/@me/widgets`, body: {widgets: []}})\n" +
        "(run in the Discord app's console, not the portal - see docs/troubleshooting.md). " +
        "If the board is empty and this still fails, your account may not be in the widgets experiment rollout.",
      e,
    );
  }

  console.log("[bootstrap] Resetting bot token… enter your 2FA if prompted");
  let token;
  try {
    token = (await rest.post({ url: `/applications/${app.id}/bot/reset` })).body?.token;
  } catch {}
  if (!token) {
    console.warn(
      "[bootstrap] Couldn't reset the bot token from here (accounts with 2FA usually need the UI). " +
        "Go to your application's Bot page, press Reset Token, and put it in bot/.env as DISCORD_TOKEN.",
    );
  }

  const env = [
    `DISCORD_TOKEN=${token ?? "PASTE_FROM_BOT_PAGE"}`,
    `APPLICATION_ID=${app.id}`,
    `OAUTH_URL=https://discord.com/oauth2/authorize?client_id=${app.id}&response_type=token&scope=sdk.social_layer_presence`,
  ].join("\n");
  // Always print the credentials - clipboard writes from the console are
  // unreliable (navigator.clipboard needs page focus, which devtools steals).
  console.log("[bootstrap] Your credentials (paste these back):\n" + env);
  try {
    if (clipboardCopy) {
      clipboardCopy(env); // devtools console utility, works without page focus
    } else {
      await navigator.clipboard.writeText(env);
    }
    console.log("[bootstrap] Also copied to your clipboard.");
  } catch {
    console.log("[bootstrap] Clipboard copy failed - select and copy the credentials above manually.");
  }

  console.log("[bootstrap] Opening the widget editor…");
  experiments.createOverride("2026-03-widget-config-editor", 1);
  document.querySelector(`a[href="/developers/applications/${app.id}"]`)?.click();
  for (let i = 0; i < 50 && !document.querySelector(`a[href="/developers/applications/${app.id}/widget"]`); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  document.querySelector(`a[href="/developers/applications/${app.id}/widget"]`)?.click();
  console.log("[bootstrap] Done. Restyle the widget here, then set up the bot (bot/README.md).");
})();
