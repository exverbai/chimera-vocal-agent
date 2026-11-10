// agent/core/client.ts
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { basename, join as join2 } from "node:path";

// agent/core/paths.ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
var BUNDLED = true;
var BUILD = "79709ccb6dfb";
var here = dirname(fileURLToPath(import.meta.url));
var root = BUNDLED ? dirname(here) : dirname(dirname(here));
var STAGE_DIR = BUNDLED ? join(root, "stage") : join(root, "dist");
var WASM = BUNDLED ? join(root, "engine/chimera.wasm") : join(root, "src/wasm/chimera.wasm");
var DICT = BUNDLED ? join(root, "stage/data/cmudict.txt.gz") : join(root, "public/data/cmudict.txt.gz");
var DAEMON_ENTRY = BUNDLED ? join(root, "bin/daemon.mjs") : join(root, "agent/daemon/main.ts");
var CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "chimera-sing");
var DEFAULT_PORT = 5319;
var port = () => Number(process.env.CHIMERA_SING_PORT) || DEFAULT_PORT;
function which(name) {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir)
      continue;
    for (const ext of process.platform === "win32" ? ["", ".exe", ".cmd"] : [""]) {
      const p = join(dir, name + ext);
      if (existsSync(p))
        return p;
    }
  }
  return null;
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// agent/core/client.ts
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
function runtime() {
  const name = basename(process.execPath).toLowerCase().replace(/\.exe$/, "");
  if (BUNDLED && (name === "node" || name === "bun"))
    return process.execPath;
  if (!BUNDLED && name === "bun")
    return process.execPath;
  const found = BUNDLED ? which("node") ?? which("bun") : which("bun");
  if (!found)
    throw new Error(BUNDLED ? "chimera-sing needs Node 18+ (or Bun) on the PATH" : "running chimera-sing from source needs Bun on the PATH");
  return found;
}
var starting = null;
function ensureDaemon() {
  starting ??= (async () => {
    const h = await health();
    if (h && (h.build === BUILD || process.env.CHIMERA_SING_ANY_BUILD))
      return;
    if (h) {
      await request("/shutdown", {}).catch(() => {});
      for (let i = 0;i < 30 && await health(200); i++)
        await sleep(100);
    }
    mkdirSync(CACHE, { recursive: true });
    const log = openSync(join2(CACHE, "daemon.log"), "a");
    const child = spawn(runtime(), [DAEMON_ENTRY], { detached: true, stdio: ["ignore", log, log], env: { ...process.env } });
    child.on("error", () => {});
    child.unref();
    for (let i = 0;i < 60; i++) {
      await sleep(100);
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

// agent/core/guide.ts
var SCORE_FORMAT = `Score: {"bpm": 96, "body": "female", "title": "...", "notes": [[pitch, beats, lyric], ...]}
- pitch: note name ("C4" is middle C, "F#3", "Bb4") or "-" for a rest (a breath).
- beats: length in beats (1 = a quarter note at bpm).
- lyric: ONE syllable per note. A trailing hyphen continues the word on the next note ("an-", "y-", "where"). "-" holds the previous vowel on a new pitch. End phrases with , . ! or ? and put a rest after them.
- body: "male" (sing C3-E4), "female" (A3-E5) or "child" (B3-D5). English words only; spell numbers out.
Example: {"bpm":96,"body":"female","notes":[["E4",1,"Breathe"],["C4",1,"in,"],["D4",1,"breathe"],["A3",1.5,"out,"],["-",0.5],["A3",0.5,"I"],["C4",0.5,"am"],["E4",1,"made"],["D4",0.5,"of"],["C4",2,"air."]]}`;
var BAND_FORMAT = `Band (up to 4 voices, 60 s): {"bpm": 100, "title": "...", "voices": [
  {"name": "lead", "body": "female", "notes": "E4/1/Breathe C4/1/in, D4/1/breathe A3/1.5/out, -/0.5"},
  {"name": "low", "body": "male", "notes": "C4/1/Breathe A3/1/in, B3/1/breathe F3/1.5/out, -/0.5"},
  {"name": "bass", "body": "male", "notes": "A2/1/dum A2/1/dum G2/2/doo", "repeat": 2},
  {"name": "beat", "beat": "B . t . | Pf . t ."}]}
- notes: the [pitch, beats, lyric] list, or the shorter string "pitch/beats/lyric ..." (a rest is -/1). "repeat" loops a voice's notes.
- beat: sixteenth steps, "." a rest; sounds B (kick), t and tss (hat), Pf and K (snare). It loops for the whole song, after one bar alone to count the band in.
- The voice named "lead" carries the tune; give the others a third or sixth below it, or the chord roots. Optional per voice: "volume" (dB, -30 to 6), "pan" (-1 to 1).`;
var TOOL_DESCRIPTION = `Sing out loud to the user: a physically modelled voice (CHIMERA) sings your score in a window with an animated head; a band score adds harmony, bass and a beatboxer, each with a head. Use it when the user asks you to sing, or to celebrate or announce something in song. Keep songs short (one voice: 2-4 lines, under 20 s; a band: under 60 s). It returns at once while the song plays; warnings tell you what was repaired. Read the compose-song skill before writing a band or a parody.
${SCORE_FORMAT}
${BAND_FORMAT}`;
var TEXT_TOOL_DESCRIPTION = "Sing some plain text out loud to the user, to an automatic tune (no score needed). The CHIMERA voice sings it at once in its window. Use it when the user asks you to sing or say something aloud and the melody does not matter. English words; about 30 words at most are sung.";
var STOP_TOOL_DESCRIPTION = "Stop the CHIMERA voice: cut the song being sung and drop any queued ones.";
var MODE_TOOL_DESCRIPTION = "Turn sing mode on or off. While it is on, every reply you give the user is sung aloud by the CHIMERA voice (the chat text only, never code). Use it when the user asks you to sing your answers, or to stop doing so.";
var NOTES_SCHEMA = {
  description: 'One [pitch, beats, lyric] per note, e.g. ["E4", 1, "Breathe"], a rest ["-", 1]; or the string "E4/1/Breathe C4/1/in, -/1"',
  anyOf: [{ type: "array", items: { type: "array", items: { type: ["string", "number"] } } }, { type: "string" }]
};
var SCORE_SCHEMA = {
  type: "object",
  properties: {
    bpm: { type: "number", description: "Tempo, 30 to 240" },
    body: { type: "string", enum: ["male", "female", "child"], description: "The voice (default: the user's chosen voice)" },
    title: { type: "string", description: "Shown above the singer" },
    notes: NOTES_SCHEMA,
    voices: {
      type: "array",
      description: "A band instead of `notes`: up to 4 voices. The one named lead carries the tune.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          body: { type: "string", enum: ["male", "female", "child"] },
          notes: NOTES_SCHEMA,
          repeat: { type: "number", description: "Play the notes this many times" },
          beat: { type: "string", description: 'A beatbox pattern instead of notes, e.g. "B . t . | Pf . t ."' },
          volume: { type: "number", description: "dB, -30 to 6" },
          pan: { type: "number", description: "-1 (left) to 1 (right)" }
        }
      }
    }
  },
  required: ["bpm"]
};

// agent/core/score.ts
function issueText(issues) {
  return [...issues].sort((a, b) => a.level === b.level ? 0 : a.level === "error" ? -1 : 1).map((i) => `${i.level}: ${i.message}`).join(`
`);
}

// agent/core/settings.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname2, join as join3 } from "node:path";
var BODIES = ["male", "female", "child"];
var STYLES = ["tune", "chant"];
var LENGTHS = ["short", "normal", "full"];
var configDir = () => join3(process.env.XDG_CONFIG_HOME || join3(homedir2(), ".config"), "chimera-sing");
var cacheDir = () => join3(process.env.XDG_CACHE_HOME || join3(homedir2(), ".cache"), "chimera-sing");
var settingsPath = () => join3(configDir(), "settings.json");
function readSettings() {
  let s = {};
  try {
    s = JSON.parse(readFileSync(settingsPath(), "utf8"));
  } catch {}
  const env = process.env.CHIMERA_SING_AUTO;
  return {
    voice: {
      body: BODIES.includes(s.voice?.body ?? "") ? s.voice.body : "female",
      style: STYLES.includes(s.voice?.style ?? "") ? s.voice.style : "tune"
    },
    auto: env ? env !== "0" : s.auto === true,
    length: LENGTHS.includes(s.length ?? "") ? s.length : "normal"
  };
}
function writeSettings(patch) {
  const s = readSettings();
  if (patch.body && BODIES.includes(patch.body))
    s.voice.body = patch.body;
  if (patch.style && STYLES.includes(patch.style))
    s.voice.style = patch.style;
  if (patch.length && LENGTHS.includes(patch.length))
    s.length = patch.length;
  if (typeof patch.auto === "boolean")
    s.auto = patch.auto;
  if (patch.auto === undefined && process.env.CHIMERA_SING_AUTO) {
    try {
      s.auto = JSON.parse(readFileSync(settingsPath(), "utf8")).auto === true;
    } catch {
      s.auto = false;
    }
  }
  mkdirSync2(configDir(), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2) + `
`);
  return readSettings();
}
var sangPath = () => join3(cacheDir(), "sang");
function put(path, text) {
  try {
    mkdirSync2(dirname2(path), { recursive: true });
    writeFileSync(path, text);
  } catch {}
}
function markSang() {
  put(sangPath(), String(Date.now()));
}

// agent/core/slash.ts
async function singModeOn() {
  writeSettings({ auto: true });
  const r = await sing({ text: "Sing mode on.", replace: true });
  const window = r.ok && r.window === false ? " Opening the singer's window." : "";
  return { ok: true, say: `Sing mode is on: I will sing my replies.${window} Say "sing off" to stop.`, seconds: r.seconds };
}
async function singModeOff() {
  writeSettings({ auto: false });
  await stopSinging().catch(() => {});
  return { ok: true, say: "Sing mode is off." };
}

// agent/mcp/server.ts
var TOOLS = [
  { name: "sing", description: TOOL_DESCRIPTION, inputSchema: SCORE_SCHEMA },
  {
    name: "sing_text",
    description: TEXT_TOOL_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The words to sing" },
        style: { type: "string", enum: ["tune", "chant"], description: "tune: a melody; chant: fast, on few notes" },
        body: { type: "string", enum: ["male", "female", "child"], description: "The voice (default: the user's chosen voice)" }
      },
      required: ["text"]
    }
  },
  { name: "stop_singing", description: STOP_TOOL_DESCRIPTION, inputSchema: { type: "object", properties: {} } },
  {
    name: "sing_mode",
    description: MODE_TOOL_DESCRIPTION,
    inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["on", "off"] } }, required: ["mode"] }
  }
];
var text = (t, isError = false) => ({ content: [{ type: "text", text: t }], ...isError ? { isError } : {} });
async function call(name, args) {
  try {
    if (name === "stop_singing") {
      await stopSinging();
      return text("Stopped.");
    }
    if (name === "sing_mode") {
      if (args.mode !== "on" && args.mode !== "off")
        return text('mode must be "on" or "off"', true);
      const r2 = args.mode === "on" ? await singModeOn() : await singModeOff();
      if (args.mode === "on")
        markSang();
      return text(args.mode === "on" ? `${r2.say} Replies are sung by the agent's hooks: if they stay silent, the chimera-sing hooks need approving (in Codex: /hooks).` : r2.say);
    }
    if (name !== "sing" && name !== "sing_text")
      return text(`Unknown tool: ${name}`, true);
    const r = name === "sing" ? await sing({ score: args }) : await sing({ text: String(args.text ?? ""), style: args.style, body: args.body, replace: true });
    const notes = issueText(r.issues);
    if (!r.ok)
      return text(`${name === "sing" ? "The score could not be sung. Fix it and call sing again." : "That could not be sung."}
${notes}`, true);
    markSang();
    const how = r.queued ? `Queued behind ${r.queued} song${r.queued > 1 ? "s" : ""}` : "Singing now";
    return text(`${how} (${r.notes} notes, ${r.seconds} s): ${r.lyrics}${notes ? `
${notes}` : ""}`);
  } catch (e) {
    return text(`The singer is not available: ${e instanceof Error ? e.message : e}`, true);
  }
}
var send = (m) => void process.stdout.write(JSON.stringify(m) + `
`);
async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null || !method)
    return;
  const ok = (result) => send({ jsonrpc: "2.0", id, result });
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "chimera-sing", version: "0.2.2" },
        instructions: "A physically modelled voice that sings out loud to the user. `sing` takes a score you compose; `sing_text` sings plain words to an automatic tune."
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call":
      return ok(await call(String(params?.name ?? ""), params?.arguments ?? {}));
    default:
      return void send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}
var buffer = "";
var pending = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf(`
`)) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line)
      continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    pending = pending.then(() => handle(msg)).catch(() => {});
  }
});
process.stdin.on("end", () => void pending.then(() => process.exit(0)));
