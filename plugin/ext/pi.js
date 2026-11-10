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
var BUILD = "7dc10f16398c";
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
var SONG_PROMPT = (topic) => `Sing me a short song${topic ? ` about: ${topic}` : " about what we just did"}. Write 2 to 4 rhyming lines with a simple, singable melody that moves mostly by step and ends on its home note, then call the \`sing\` tool once with the score. Do not explain the score; after the tool call, reply with just the lyrics.`;
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
var WORDS = { short: 18, normal: 60, full: 600 };
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
var lastReplyPath = () => join3(cacheDir(), "last-reply.txt");
function put(path, text) {
  try {
    mkdirSync2(dirname2(path), { recursive: true });
    writeFileSync(path, text);
  } catch {}
}
function saveLastReply(text) {
  put(lastReplyPath(), text.slice(0, 20000));
}
function lastReply() {
  try {
    return readFileSync(lastReplyPath(), "utf8");
  } catch {
    return "";
  }
}

// agent/core/slash.ts
var SLASH_COMPLETIONS = ["on", "off", "song", "stop", "length short", "length normal", "length full", "voice male", "voice female", "voice child", "status"];
async function singModeOn() {
  writeSettings({ auto: true });
  const r = await sing({ text: "Sing mode on.", replace: true });
  const window = r.ok && r.window === false ? " Opening the singer's window." : "";
  return { ok: true, say: `Sing mode is on: I will sing my replies.${window} /sing off stops it.`, seconds: r.seconds };
}
async function singModeOff() {
  writeSettings({ auto: false });
  await stopSinging().catch(() => {});
  return { ok: true, say: "Sing mode is off." };
}
async function singText(text) {
  const r = await sing({ text, replace: true });
  if (!r.ok)
    return { ok: false, say: issueText(r.issues) || "Could not sing that." };
  return { ok: true, say: `♪ ${r.lyrics}`, seconds: r.seconds };
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
    if ((cmd === "on" || cmd === "off") && !rest.length)
      return cmd === "on" ? await singModeOn() : await singModeOff();
    if (cmd === "auto" && rest.length <= 1 && (!rest[0] || rest[0] === "on" || rest[0] === "off")) {
      return (rest[0] ? rest[0] === "on" : !readSettings().auto) ? await singModeOn() : await singModeOff();
    }
    if (cmd === "length" && rest.length === 1 && LENGTHS.includes(rest[0])) {
      const s = writeSettings({ length: rest[0] });
      return { ok: true, say: { short: "I will sing the opening of each reply.", normal: "I will sing most of each reply (about half a minute).", full: "I will sing each reply in full." }[s.length] };
    }
    if (cmd === "voice" && rest.length >= 1 && rest.length <= 2 && BODIES.includes(rest[0]) && (!rest[1] || STYLES.includes(rest[1]))) {
      const s = writeSettings({ body: rest[0], style: rest[1] });
      return { ok: true, say: `Voice: ${s.voice.body}, ${s.voice.style}.` };
    }
    if (cmd === "status" && !rest.length) {
      const [h, s] = [await health(), readSettings()];
      const voice = `sing mode ${s.auto ? "on" : "off"}, length ${s.length}, voice ${s.voice.body}/${s.voice.style}`;
      return { ok: true, say: h ? `Singer running: ${h.windows} window${h.windows === 1 ? "" : "s"}, ${h.singing ? "singing" : "quiet"}, ${voice}.` : `Singer not running yet (it starts with the first song); ${voice}.` };
    }
    if (cmd === "song")
      return { ok: true, say: "Composing a song…", prompt: SONG_PROMPT(rest.join(" ")) };
    return await singText(text);
  } catch (e) {
    return { ok: false, say: `chimera-sing: ${e instanceof Error ? e.message : e}` };
  }
}

// agent/pi/index.ts
function textOf(message) {
  const m = message;
  if (m?.role !== "assistant")
    return "";
  if (typeof m.content === "string")
    return m.content;
  if (!Array.isArray(m.content))
    return "";
  return m.content.map((b) => b?.type === "text" && typeof b.text === "string" ? b.text : "").filter(Boolean).join(`

`);
}
var MCP_TWIN = /^mcp__.*chimera.*_(sing|sing_text|stop_singing|sing_mode)$/;
function chimeraSing(pi) {
  const z = pi.zod;
  const isOmp = !!z;
  let lastReply2 = "";
  let sangThisRun = false;
  let mayBeSinging = false;
  let statusTimer;
  const isMain = (ctx) => ctx.agent?.kind !== "sub";
  const idleStatus = () => readSettings().auto ? "♪ sing mode" : undefined;
  function setStatus(ctx, text) {
    try {
      ctx.ui.setStatus("chimera", text);
    } catch {}
  }
  function showSinging(ctx, seconds) {
    mayBeSinging = true;
    setStatus(ctx, "♪ singing");
    const ms = ((seconds ?? 5) + 1) * 1000;
    const done = () => setStatus(ctx, idleStatus());
    try {
      if (typeof ctx.setTimeout === "function") {
        if (statusTimer)
          ctx.clearTimer?.(statusTimer);
        statusTimer = ctx.setTimeout(done, ms);
      } else {
        clearTimeout(statusTimer);
        statusTimer = setTimeout(done, ms);
        statusTimer.unref?.();
      }
    } catch {}
  }
  async function autoSing(text, ctx) {
    try {
      const r = await sing({ text, replace: true, maxWords: WORDS[readSettings().length] });
      if (r.ok)
        showSinging(ctx, r.seconds);
    } catch {}
  }
  pi.registerTool({
    name: "sing",
    label: "Sing",
    description: TOOL_DESCRIPTION,
    loadMode: "essential",
    approval: "read",
    parameters: z ? (() => {
      const notes = z.union([z.array(z.array(z.union([z.string(), z.number()]))), z.string()]).describe('One [pitch, beats, lyric] per note, e.g. ["E4", 1, "Breathe"], a rest ["-", 1]; or the string "E4/1/Breathe C4/1/in, -/1"');
      const body = z.enum(["male", "female", "child"]);
      return z.object({
        bpm: z.number().describe("Tempo, 30 to 240"),
        body: body.optional().describe("The voice (default: the user's chosen voice)"),
        title: z.string().optional().describe("Shown above the singer"),
        notes: notes.optional(),
        voices: z.array(z.object({
          name: z.string().optional(),
          body: body.optional(),
          notes: notes.optional(),
          repeat: z.number().optional().describe("Play the notes this many times"),
          beat: z.string().optional().describe('A beatbox pattern instead of notes, e.g. "B . t . | Pf . t ."'),
          volume: z.number().optional().describe("dB, -30 to 6"),
          pan: z.number().optional().describe("-1 (left) to 1 (right)")
        })).optional().describe("A band instead of notes: up to 4 voices. The one named lead carries the tune.")
      });
    })() : SCORE_SCHEMA,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const r = await sing({ score: params });
        const notes = issueText(r.issues);
        if (!r.ok)
          return { content: [{ type: "text", text: `The score could not be sung. Fix it and call sing again.
${notes}` }], details: { ok: false }, isError: true };
        sangThisRun = true;
        showSinging(ctx, r.seconds);
        const how = r.queued ? `Queued behind ${r.queued} song${r.queued > 1 ? "s" : ""}` : "Singing now";
        return { content: [{ type: "text", text: `${how} (${r.notes} notes, ${r.seconds} s): ${r.lyrics}${notes ? `
${notes}` : ""}` }], details: { ok: true, seconds: r.seconds, notes: r.notes } };
      } catch (e) {
        return { content: [{ type: "text", text: `The singer is not available: ${e instanceof Error ? e.message : e}` }], details: { ok: false }, isError: true };
      }
    }
  });
  pi.registerCommand("sing", {
    description: "on | off: sing every reply. Or: <text> | song [topic] | stop | length <short|normal|full> | voice <male|female|child> [tune|chant] | status. Alone: sing the last reply.",
    getArgumentCompletions: (prefix) => {
      const items = SLASH_COMPLETIONS.filter((x) => x.startsWith(prefix.trimStart()));
      return items.length ? items.map((value) => ({ value, label: value })) : null;
    },
    handler: async (args, ctx) => {
      try {
        const r = await runSlash(args, { lastReply: lastReply2 });
        if (r.prompt)
          return void pi.sendUserMessage(r.prompt);
        if (r.seconds !== undefined)
          showSinging(ctx, r.seconds);
        else
          setStatus(ctx, idleStatus());
        ctx.ui.notify(r.say, r.ok ? "info" : "warning");
      } catch (e) {
        ctx.ui.notify(`chimera: ${e instanceof Error ? e.message : e}`, "error");
      }
    }
  });
  pi.on("session_start", (_event, ctx) => {
    if (isMain(ctx))
      setStatus(ctx, idleStatus());
    try {
      const active = pi.getActiveTools?.();
      if (active?.some((n) => MCP_TWIN.test(n)))
        pi.setActiveTools?.(active.filter((n) => !MCP_TWIN.test(n)));
    } catch {}
  });
  pi.on("agent_start", (_event, ctx) => {
    if (isMain(ctx))
      sangThisRun = false;
  });
  pi.on("message_end", (event, ctx) => {
    if (!isMain(ctx))
      return;
    const text = textOf(event.message);
    if (!text.trim())
      return;
    lastReply2 = text;
    saveLastReply(text);
  });
  if (isOmp) {
    pi.on("agent_end", (event, ctx) => {
      if (!isMain(ctx) || event.willContinue || sangThisRun || !readSettings().auto)
        return;
      const text = [...event.messages ?? []].reverse().map(textOf).find((t) => t.trim()) ?? "";
      if (text.trim())
        autoSing(text, ctx);
    });
  } else {
    pi.on("agent_settled", (_event, ctx) => {
      if (sangThisRun || !lastReply2.trim() || !readSettings().auto)
        return;
      const text = lastReply2;
      lastReply2 = "";
      autoSing(text, ctx);
    });
  }
  pi.on("input", (event) => {
    if (mayBeSinging && !event.text.trimStart().startsWith("/sing")) {
      mayBeSinging = false;
      stopSinging().catch(() => {});
    }
  });
  pi.on("session_shutdown", (_event, ctx) => {
    const interactive = ctx.mode ? ctx.mode === "tui" : ctx.hasUI;
    if (mayBeSinging && interactive)
      stopSinging().catch(() => {});
  });
}
export {
  chimeraSing as default
};
