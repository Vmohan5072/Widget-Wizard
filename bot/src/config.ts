import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  applicationId: required("APPLICATION_ID"),
  oauthUrl: process.env.OAUTH_URL ?? "",
  faceitApiKey: process.env.FACEIT_API_KEY ?? "",
  leetifyApiKey: process.env.LEETIFY_API_KEY ?? "",
  steamApiKey: process.env.STEAM_API_KEY ?? "",
  refreshMinutes: Number(process.env.REFRESH_MINUTES ?? "60"),
};

export type Config = typeof config;
