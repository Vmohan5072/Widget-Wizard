import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commandJson } from "./commands.js";

// One-off: registers the /widget command globally. Run with `npm run register`.

const rest = new REST().setToken(config.token);

await rest.put(Routes.applicationCommands(config.applicationId), {
  body: [commandJson()],
});

console.log("Registered /widget. Global commands can take a few minutes to show up.");
