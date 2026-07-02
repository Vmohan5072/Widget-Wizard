import { Client, GatewayIntentBits, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { config } from "./config.js";
import { getUser, setLink, setActiveGame } from "./store.js";
import { getProvider, providers, resolveSlot } from "./providers/index.js";
import { refreshUser, startAutoRefresh } from "./refresh.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);
  startAutoRefresh();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "widget") return;
  try {
    await handle(interaction);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ ${msg}` });
    } else {
      await interaction.reply({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral });
    }
  }
});

async function handle(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    const authLine = config.oauthUrl
      ? `1. [Authorize the app](${config.oauthUrl}). The permission list looks scary — that's the SDK scope bundle; the token is never stored or used.`
      : "1. Ask the app owner for the authorization link (OAUTH_URL isn't configured).";
    await interaction.reply({
      content: [
        "**Widget setup**",
        authLine,
        "2. `/widget link` a game account.",
        "3. `/widget refresh` to push your stats.",
        "4. Attach the widget to your profile — see docs/widget-setup.md in the repo.",
        "",
        "-# Note: Discord currently only lets the *application owner* attach the widget. Anyone can still link and push data.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "link") {
    const game = interaction.options.getString("game", true);
    const account = interaction.options.getString("account", true);
    const service = interaction.options.getString("service");
    const provider = getProvider(game);
    const slot = resolveSlot(provider, account, service);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Validate by fetching once before saving.
    const candidate = { ...getUser(interaction.user.id).links, [slot.key]: account };
    const stats = await provider.fetchStats(candidate, config);
    setLink(interaction.user.id, slot.key, account, provider.id);
    const slotNote = provider.slots.length > 1 ? ` (${slot.label})` : "";
    await interaction.editReply(
      `✅ Linked **${provider.displayName}**${slotNote} as **${stats.title}**. Run \`/widget refresh\` to push it to your widget.`,
    );
    return;
  }

  if (sub === "show") {
    const game = interaction.options.getString("game", true);
    const provider = getProvider(game);
    const user = getUser(interaction.user.id);
    if (!provider.slots.some((s) => user.links[s.key])) {
      throw new Error(`You haven't linked ${provider.displayName} yet. Use /widget link first.`);
    }
    setActiveGame(interaction.user.id, game);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshUser(interaction.user.id);
    await interaction.editReply(`✅ Widget now shows **${getProvider(game).displayName}**.`);
    return;
  }

  if (sub === "refresh") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const summary = await refreshUser(interaction.user.id);
    await interaction.editReply(`✅ Widget updated.\n-# ${summary}`);
    return;
  }

  if (sub === "status") {
    const user = getUser(interaction.user.id);
    const lines = providers.map((p) => {
      const linkedSlots = p.slots.filter((s) => user.links[s.key]);
      const active = user.activeGame === p.id ? " ← shown on widget" : "";
      if (!linkedSlots.length) {
        return `▫️ **${p.displayName}** — link with ${p.slots.map((s) => s.hint).join(" and/or ")}`;
      }
      const detail = linkedSlots
        .map((s) => (p.slots.length > 1 ? `${s.label}: ${user.links[s.key]}` : user.links[s.key]))
        .join(" · ");
      return `✅ **${p.displayName}**: ${detail}${active}`;
    });
    await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
    return;
  }
}

client.login(config.token);
