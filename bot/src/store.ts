import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Tiny JSON-file store. Good enough for a handful of users; swap for a real
// DB if this ever grows. Nothing fetched from game APIs is persisted here,
// only account links (Leetify's guidelines forbid storing their API data).

export interface UserRecord {
  activeGame?: string;
  links: Record<string, string>; // provider id -> account identifier
}

interface StoreShape {
  users: Record<string, UserRecord>;
}

const FILE = join(process.cwd(), "data", "store.json");

function load(): StoreShape {
  if (!existsSync(FILE)) return { users: {} };
  return JSON.parse(readFileSync(FILE, "utf8")) as StoreShape;
}

function save(data: StoreShape): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getUser(discordId: string): UserRecord {
  return load().users[discordId] ?? { links: {} };
}

export function setLink(discordId: string, slotKey: string, account: string, providerId: string): void {
  const data = load();
  const user = data.users[discordId] ?? { links: {} };
  user.links[slotKey] = account;
  user.activeGame ??= providerId;
  data.users[discordId] = user;
  save(data);
}

export function setActiveGame(discordId: string, provider: string): void {
  const data = load();
  const user = data.users[discordId] ?? { links: {} };
  user.activeGame = provider;
  data.users[discordId] = user;
  save(data);
}

export function allUsers(): Record<string, UserRecord> {
  return load().users;
}
