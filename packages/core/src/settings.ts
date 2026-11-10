/**
 * The few choices every adapter shares (the voice, whether replies are sung), in one file, and
 * the small state they pass between each other (the last reply, "a song was just started").
 * Read from disk each time: an agent's hook is a new process on every event.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { BodyName } from "./score.ts";
import type { Style } from "./melodize.ts";

export interface Settings {
  voice: { body: BodyName; style: Style };
  /** sing the opening of every reply when it ends */
  auto: boolean;
}

export const BODIES: readonly string[] = ["male", "female", "child"];
export const STYLES: readonly string[] = ["tune", "chant"];
/** how much of a reply auto mode sings (words): about ten seconds */
export const AUTO_WORDS = 18;

const configDir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "chimera-vocal-agent");
const cacheDir = () => join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "chimera-vocal-agent");
export const settingsPath = () => join(configDir(), "settings.json");

export function readSettings(): Settings {
  let s: { voice?: { body?: string; style?: string }; auto?: unknown } = {};
  try {
    s = JSON.parse(readFileSync(settingsPath(), "utf8"));
  } catch {
    // defaults
  }
  const env = process.env.CHIMERA_SING_AUTO;
  return {
    voice: {
      body: (BODIES.includes(s.voice?.body ?? "") ? s.voice!.body : "female") as BodyName,
      style: (STYLES.includes(s.voice?.style ?? "") ? s.voice!.style : "tune") as Style,
    },
    auto: env ? env !== "0" : s.auto === true,
  };
}

export function writeSettings(patch: { body?: string; style?: string; auto?: boolean }): Settings {
  const s = readSettings();
  if (patch.body && BODIES.includes(patch.body)) s.voice.body = patch.body as BodyName;
  if (patch.style && STYLES.includes(patch.style)) s.voice.style = patch.style as Style;
  if (typeof patch.auto === "boolean") s.auto = patch.auto;
  if (patch.auto === undefined && process.env.CHIMERA_SING_AUTO) {
    // the environment's override is for this process, not for the file
    try {
      s.auto = JSON.parse(readFileSync(settingsPath(), "utf8")).auto === true;
    } catch {
      s.auto = false;
    }
  }
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2) + "\n");
  return readSettings();
}

// ---- state between processes (cache: losing it costs nothing)

const lastReplyPath = () => join(cacheDir(), "last-reply.txt");
const sangPath = () => join(cacheDir(), "sang");

function put(path: string, text: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  } catch {
    // best effort
  }
}

/** The agent's last reply, kept so `/sing` with no words has something to sing. */
export function saveLastReply(text: string): void {
  put(lastReplyPath(), text.slice(0, 20000));
}

export function lastReply(): string {
  try {
    return readFileSync(lastReplyPath(), "utf8");
  } catch {
    return "";
  }
}

/**
 * A song was just started on purpose (a tool call, a /sing command). Auto mode must not sing
 * the reply that follows over it: the next end-of-reply takes this mark and stays quiet.
 */
export function markSang(): void {
  put(sangPath(), String(Date.now()));
}

/** True once per mark, while the mark is fresh (a turn can be long, a forgotten mark must fade). */
export function takeSang(maxAgeMs = 10 * 60 * 1000): boolean {
  const p = sangPath();
  if (!existsSync(p)) return false;
  let fresh = false;
  try {
    fresh = Date.now() - statSync(p).mtimeMs < maxAgeMs;
    rmSync(p);
  } catch {
    // someone else took it
  }
  return fresh;
}
