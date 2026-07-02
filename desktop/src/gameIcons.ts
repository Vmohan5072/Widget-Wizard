// Bundled per-game application icons, applied automatically after a game's
// app is verified. Replace the PNGs in assets/game-icons/ with real game art
// (square, 512x512 works well) — keep the filenames.
import cs from "./assets/game-icons/cs.png?inline";
import dota2 from "./assets/game-icons/dota2.png?inline";
import deadlock from "./assets/game-icons/deadlock.png?inline";

export const gameIcons: Record<string, string> = { cs, dota2, deadlock };
