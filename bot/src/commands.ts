import { SlashCommandBuilder } from "discord.js";
import { providers } from "./providers/index.js";

const gameChoices = providers.map((p) => ({ name: p.displayName, value: p.id }));

export const widgetCommand = new SlashCommandBuilder()
  .setName("widget")
  .setDescription("Game stats widget for your profile")
  .addSubcommand((sub) =>
    sub.setName("setup").setDescription("How to authorize the app and get started"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("link")
      .setDescription("Link a game account")
      .addStringOption((o) =>
        o.setName("game").setDescription("Which game").setRequired(true).addChoices(...gameChoices),
      )
      .addStringOption((o) =>
        o.setName("account").setDescription("Account (nickname / steam ID / profile URL)").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("service")
          .setDescription("Counter-Strike only: which service this account is for")
          .addChoices({ name: "Faceit", value: "faceit" }, { name: "Steam", value: "steam" }),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("show")
      .setDescription("Choose which game the widget displays")
      .addStringOption((o) =>
        o.setName("game").setDescription("Which game").setRequired(true).addChoices(...gameChoices),
      ),
  )
  .addSubcommand((sub) => sub.setName("refresh").setDescription("Refresh your widget stats now"))
  .addSubcommand((sub) => sub.setName("status").setDescription("Show your linked accounts"));

// Raw command JSON with user-install support. discord.js builders don't cover
// integration_types/contexts on all versions, so they're added here directly.
export function commandJson(): object {
  return {
    ...widgetCommand.toJSON(),
    integration_types: [0, 1], // guild install + user install
    contexts: [0, 1, 2], // guild, bot DM, private channel
  };
}
