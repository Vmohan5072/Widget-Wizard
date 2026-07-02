import type { Config } from "./config.js";
import type { GameStats } from "./providers/types.js";

// Pushes a widget identity to Discord:
// PATCH /applications/{app}/users/{user}/identities/{id}/profile
// Field names here must match the User Data field names in the widget config
// (see docs/widget-setup.md). identityId 0 works fine.

const API = "https://discord.com/api/v9";

interface DynamicField {
  type: 1 | 2 | 3; // 1 text, 2 number, 3 image
  name: string;
  value: string | number | { url: string };
}

export async function pushIdentity(discordUserId: string, stats: GameStats, cfg: Config): Promise<void> {
  const dynamic: DynamicField[] = [
    { type: 1, name: "title", value: stats.title },
    { type: 1, name: "game", value: stats.game },
  ];

  stats.stats.slice(0, 6).forEach((s, i) => {
    dynamic.push({ type: 1, name: `stat_${i + 1}_label`, value: s.label });
    dynamic.push({ type: 1, name: `stat_${i + 1}_value`, value: s.value });
  });

  if (stats.imageUrl) {
    dynamic.push({ type: 3, name: "avatar", value: { url: stats.imageUrl } });
  }

  const res = await fetch(
    `${API}/applications/${cfg.applicationId}/users/${discordUserId}/identities/0/profile`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${cfg.token}`,
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)",
      },
      body: JSON.stringify({ username: stats.title, data: { dynamic } }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new Error("Discord rejected the identity push (401): the bot token is invalid. Check DISCORD_TOKEN in .env.");
    }
    if (res.status === 403) {
      throw new Error("Discord rejected the identity push (403). Make sure you authorized the app with the sdk.social_layer_presence scope — run /widget setup.");
    }
    if (res.status === 400) {
      throw new Error(`Discord rejected the identity payload (400) — usually a malformed field or an unreachable image URL. Details: ${text}`);
    }
    throw new Error(`Discord identity API error ${res.status}: ${text}`);
  }
}
