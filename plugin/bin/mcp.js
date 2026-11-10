#!/usr/bin/env bun
// @bun

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
var TEXT_TOOL_DESCRIPTION = "Sing some plain text out loud to the user, to an automatic tune (no score needed). The CHIMERA voice sings it at once in its window. Use it when the user asks you to sing or say something aloud and the melody does not matter. English words; about 30 words at most are sung.";
var STOP_TOOL_DESCRIPTION = "Stop the CHIMERA voice: cut the song being sung and drop any queued ones.";
var SCORE_SCHEMA = {
  type: "object",
  properties: {
    bpm: { type: "number", description: "Tempo, 30 to 240" },
    body: { type: "string", enum: ["male", "female", "child"], description: "The voice (default: the user's chosen voice)" },
    title: { type: "string", description: "Shown above the singer" },
    notes: {
      type: "array",
      description: 'One [pitch, beats, lyric] per note, e.g. ["E4", 1, "Breathe"]; a rest is ["-", 1]',
      items: { type: "array", items: { type: ["string", "number"] } }
    }
  },
  required: ["bpm", "notes"]
};

// packages/core/src/score.ts
function issueText(issues) {
  return [...issues].sort((a, b) => a.level === b.level ? 0 : a.level === "error" ? -1 : 1).map((i) => `${i.level}: ${i.message}`).join(`
`);
}

// packages/core/src/settings.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync2, rmSync, statSync, writeFileSync as writeFileSync2 } from "fs";
import { homedir as homedir2 } from "os";
import { dirname as dirname2, join as join3 } from "path";
var cacheDir = () => join3(process.env.XDG_CACHE_HOME || join3(homedir2(), ".cache"), "chimera-vocal-agent");
var sangPath = () => join3(cacheDir(), "sang");
function put(path, text) {
  try {
    mkdirSync3(dirname2(path), { recursive: true });
    writeFileSync2(path, text);
  } catch {}
}
function markSang() {
  put(sangPath(), String(Date.now()));
}

// packages/mcp/src/server.ts
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
  { name: "stop_singing", description: STOP_TOOL_DESCRIPTION, inputSchema: { type: "object", properties: {} } }
];
var text = (t, isError = false) => ({ content: [{ type: "text", text: t }], ...isError ? { isError } : {} });
async function call(name, args) {
  try {
    if (name === "stop_singing") {
      await stopSinging();
      return text("Stopped.");
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
        serverInfo: { name: "chimera-sing", version: "0.0.1" },
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
