#!/usr/bin/env bun
// @bun

// packages/hooks/src/on-event.ts
import { appendFileSync, closeSync, openSync as openSync2, readSync, statSync as statSync2 } from "fs";

// packages/core/src/client.ts
import { spawn } from "child_process";
import { mkdirSync as mkdirSync2, openSync } from "fs";
import { join as join2 } from "path";

// packages/core/src/paths.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { dirname, join } from "path";
var isRoot = (dir) => existsSync(join(dir, "packages/daemon/src/main.ts"));
var configDir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "chimera-vocal-agent");
var pointer = () => join(configDir(), "home");
function findRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0;i < 5; i++) {
    if (isRoot(dir))
      return dir;
    dir = dirname(dir);
  }
  const env = process.env.CHIMERA_SING_HOME;
  if (env && isRoot(env))
    return env;
  try {
    const p = readFileSync(pointer(), "utf8").trim();
    if (p && isRoot(p))
      return p;
  } catch {}
  return "";
}
var ROOT = findRoot();
var CHIMERA = join(ROOT, "vendor/chimera");
var PREBUILT_WASM = join(ROOT, "prebuilt/chimera.wasm");
var STAGE_DIST = join(ROOT, "packages/stage/dist");
var DAEMON_MAIN = join(ROOT, "packages/daemon/src/main.ts");
var CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "chimera-vocal-agent");
var NOT_SET_UP = "chimera-sing is not set up on this machine: clone chimera-vocal-agent and run `bun run setup` in it";
var DEFAULT_PORT = 5318;
var port = () => Number(process.env.CHIMERA_SING_PORT) || DEFAULT_PORT;

// packages/core/src/client.ts
var base = () => `http://127.0.0.1:${port()}`;
async function request(path, body, timeout = 4000) {
  const res = await fetch(base() + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout)
  });
  return await res.json();
}
async function health(timeout = 600) {
  try {
    return await request("/health", undefined, timeout);
  } catch {
    return null;
  }
}
var starting = null;
function ensureDaemon() {
  starting ??= (async () => {
    if (await health())
      return;
    if (!ROOT)
      throw new Error(NOT_SET_UP);
    mkdirSync2(CACHE, { recursive: true });
    const log = openSync(join2(CACHE, "daemon.log"), "a");
    const bun = Bun.which("bun") ?? process.execPath;
    const child = spawn(bun, [DAEMON_MAIN], { detached: true, stdio: ["ignore", log, log], env: { ...process.env } });
    child.on("error", () => {});
    child.unref();
    for (let i = 0;i < 60; i++) {
      await Bun.sleep(100);
      if (await health(300))
        return;
    }
    throw new Error(`the chimera-sing daemon did not start; see ${join2(CACHE, "daemon.log")}`);
  })().finally(() => {
    starting = null;
  });
  return starting;
}
async function sing(req) {
  await ensureDaemon();
  return request("/sing", req);
}
async function stopSinging() {
  if (await health())
    await request("/stop", {});
}

// packages/core/src/guide.ts
var SCORE_FORMAT = `Score: {"bpm": 96, "body": "female", "title": "...", "notes": [[pitch, beats, lyric], ...]}
- pitch: note name ("C4" is middle C, "F#3", "Bb4") or "-" for a rest (a breath).
- beats: length in beats (1 = a quarter note at bpm).
- lyric: ONE syllable per note. A trailing hyphen continues the word on the next note ("an-", "y-", "where"). "-" holds the previous vowel on a new pitch. End phrases with , . ! or ? and put a rest after them.
- body: "male" (sing C3-E4), "female" (A3-E5) or "child" (B3-D5). English words only; spell numbers out.
Example: {"bpm":96,"body":"female","notes":[["E4",1,"Breathe"],["C4",1,"in,"],["D4",1,"breathe"],["A3",1.5,"out,"],["-",0.5],["A3",0.5,"I"],["C4",0.5,"am"],["E4",1,"made"],["D4",0.5,"of"],["C4",2,"air."]]}`;
var TOOL_DESCRIPTION = `Sing out loud to the user: a physically modelled voice (CHIMERA) sings your score in a window with an animated head. Use it when the user asks you to sing, or to celebrate or announce something in song. Keep songs short (2-4 lines, under 20 s). It returns at once while the song plays; warnings tell you what was repaired.
${SCORE_FORMAT}`;
var SONG_PROMPT = (topic) => `Sing me a short song${topic ? ` about: ${topic}` : " about what we just did"}. Write 2 to 4 rhyming lines with a simple, singable melody that moves mostly by step and ends on its home note, then call the \`sing\` tool once with the score. Do not explain the score; after the tool call, reply with just the lyrics.`;

// packages/core/src/score.ts
function issueText(issues) {
  return [...issues].sort((a, b) => a.level === b.level ? 0 : a.level === "error" ? -1 : 1).map((i) => `${i.level}: ${i.message}`).join(`
`);
}

// packages/core/src/settings.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync2, rmSync, statSync, writeFileSync as writeFileSync2 } from "fs";
import { homedir as homedir2 } from "os";
import { dirname as dirname2, join as join3 } from "path";
var BODIES = ["male", "female", "child"];
var STYLES = ["tune", "chant"];
var AUTO_WORDS = 18;
var configDir2 = () => join3(process.env.XDG_CONFIG_HOME || join3(homedir2(), ".config"), "chimera-vocal-agent");
var cacheDir = () => join3(process.env.XDG_CACHE_HOME || join3(homedir2(), ".cache"), "chimera-vocal-agent");
var settingsPath = () => join3(configDir2(), "settings.json");
function readSettings() {
  let s = {};
  try {
    s = JSON.parse(readFileSync2(settingsPath(), "utf8"));
  } catch {}
  const env = process.env.CHIMERA_SING_AUTO;
  return {
    voice: {
      body: BODIES.includes(s.voice?.body ?? "") ? s.voice.body : "female",
      style: STYLES.includes(s.voice?.style ?? "") ? s.voice.style : "tune"
    },
    auto: env ? env !== "0" : s.auto === true
  };
}
function writeSettings(patch) {
  const s = readSettings();
  if (patch.body && BODIES.includes(patch.body))
    s.voice.body = patch.body;
  if (patch.style && STYLES.includes(patch.style))
    s.voice.style = patch.style;
  if (typeof patch.auto === "boolean")
    s.auto = patch.auto;
  if (patch.auto === undefined && process.env.CHIMERA_SING_AUTO) {
    try {
      s.auto = JSON.parse(readFileSync2(settingsPath(), "utf8")).auto === true;
    } catch {
      s.auto = false;
    }
  }
  mkdirSync3(configDir2(), { recursive: true });
  writeFileSync2(settingsPath(), JSON.stringify(s, null, 2) + `
`);
  return readSettings();
}
var lastReplyPath = () => join3(cacheDir(), "last-reply.txt");
var sangPath = () => join3(cacheDir(), "sang");
function put(path, text) {
  try {
    mkdirSync3(dirname2(path), { recursive: true });
    writeFileSync2(path, text);
  } catch {}
}
function saveLastReply(text) {
  put(lastReplyPath(), text.slice(0, 20000));
}
function lastReply() {
  try {
    return readFileSync2(lastReplyPath(), "utf8");
  } catch {
    return "";
  }
}
function markSang() {
  put(sangPath(), String(Date.now()));
}
function takeSang(maxAgeMs = 10 * 60 * 1000) {
  const p = sangPath();
  if (!existsSync2(p))
    return false;
  let fresh = false;
  try {
    fresh = Date.now() - statSync(p).mtimeMs < maxAgeMs;
    rmSync(p);
  } catch {}
  return fresh;
}

// packages/core/src/slash.ts
async function singText(text) {
  const r = await sing({ text, replace: true });
  if (!r.ok)
    return { ok: false, say: issueText(r.issues) || "Could not sing that." };
  return { ok: true, say: `\u266A ${r.lyrics}`, seconds: r.seconds };
}
async function runSlash(args, ctx = {}) {
  const text = args.trim();
  const [cmd, ...rest] = text.split(/\s+/);
  try {
    if (!text) {
      const reply = (ctx.lastReply ?? lastReply()).trim();
      return reply ? await singText(reply) : { ok: false, say: "Nothing to sing yet. Try: /sing hello there" };
    }
    if (cmd === "stop" && !rest.length) {
      await stopSinging();
      return { ok: true, say: "Stopped." };
    }
    if (cmd === "auto" && rest.length <= 1 && (!rest[0] || rest[0] === "on" || rest[0] === "off")) {
      const s = writeSettings({ auto: rest[0] ? rest[0] === "on" : !readSettings().auto });
      return { ok: true, say: s.auto ? "I will sing the start of every reply. /sing auto off stops that." : "Auto singing is off." };
    }
    if (cmd === "voice" && rest.length >= 1 && rest.length <= 2 && BODIES.includes(rest[0]) && (!rest[1] || STYLES.includes(rest[1]))) {
      const s = writeSettings({ body: rest[0], style: rest[1] });
      return { ok: true, say: `Voice: ${s.voice.body}, ${s.voice.style}.` };
    }
    if (cmd === "status" && !rest.length) {
      const [h, s] = [await health(), readSettings()];
      const voice = `voice ${s.voice.body}/${s.voice.style}, auto ${s.auto ? "on" : "off"}`;
      return { ok: true, say: h ? `Singer running: ${h.windows} window${h.windows === 1 ? "" : "s"}, ${h.singing ? "singing" : "quiet"}, ${voice}.` : `Singer not running yet (it starts with the first song); ${voice}.` };
    }
    if (cmd === "song")
      return { ok: true, say: "Composing a song\u2026", prompt: SONG_PROMPT(rest.join(" ")) };
    return await singText(text);
  } catch (e) {
    return { ok: false, say: `chimera-sing: ${e instanceof Error ? e.message : e}` };
  }
}

// packages/hooks/src/on-event.ts
function assistantText(line) {
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    return "";
  }
  if (!o || o.isSidechain)
    return "";
  const m = o.message ?? o.payload ?? o;
  if (m?.role !== "assistant")
    return "";
  if (typeof m.content === "string")
    return m.content;
  if (!Array.isArray(m.content))
    return "";
  return m.content.map((b) => (b?.type === "text" || b?.type === "output_text") && typeof b.text === "string" ? b.text : "").filter(Boolean).join(`

`);
}
function lastAssistantText(path) {
  if (!path)
    return "";
  try {
    const size = statSync2(path).size;
    const len = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(len);
    const fd = openSync2(path, "r");
    try {
      readSync(fd, buf, 0, len, size - len);
    } finally {
      closeSync(fd);
    }
    const lines = buf.toString("utf8").split(`
`);
    for (let i = lines.length - 1;i >= 0; i--) {
      const t = assistantText(lines[i]);
      if (t.trim())
        return t;
    }
  } catch {}
  return "";
}
function slashArgs(prompt) {
  if (!prompt)
    return null;
  const tagged = prompt.match(/<chimera-sing>([\s\S]*?)<\/chimera-sing>/);
  if (tagged)
    return tagged[1].trim();
  const typed = prompt.match(/^\s*\/(?:[\w.-]+:)?sing(?:\s+([\s\S]*))?$/);
  return typed ? (typed[1] ?? "").trim() : null;
}
async function onEvent(input) {
  switch (input.hook_event_name) {
    case "Stop": {
      const text = (input.last_assistant_message ?? "").trim() || lastAssistantText(input.transcript_path);
      if (text.trim())
        saveLastReply(text);
      const sang = takeSang();
      if (input.stop_hook_active || sang || !text.trim() || !readSettings().auto)
        return "";
      await sing({ text, replace: true, maxWords: AUTO_WORDS });
      return "";
    }
    case "UserPromptSubmit": {
      const args = slashArgs(input.prompt);
      if (args === null) {
        if ((await health())?.singing)
          await stopSinging();
        return "";
      }
      const r = await runSlash(args);
      if (r.prompt)
        return r.prompt;
      markSang();
      return `[chimera-sing result] ${r.say}`;
    }
  }
  return "";
}
if (import.meta.main) {
  const bail = setTimeout(() => process.exit(0), 8000);
  try {
    const raw = await Bun.stdin.text();
    if (process.env.CHIMERA_SING_DEBUG)
      appendFileSync(process.env.CHIMERA_SING_DEBUG, raw.trim() + `
`);
    const out = await onEvent(raw.trim() ? JSON.parse(raw) : {});
    if (out)
      process.stdout.write(out + `
`);
  } catch {}
  clearTimeout(bail);
  process.exit(0);
}
export {
  slashArgs,
  onEvent,
  lastAssistantText
};
