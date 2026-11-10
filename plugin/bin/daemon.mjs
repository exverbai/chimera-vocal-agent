var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// no-wasm-url:./chimera.wasm?url
var exports_chimera = {};
__export(exports_chimera, {
  default: () => chimera_default
});
var chimera_default = "";

// src/wasm/chimera.ts
var exports_chimera2 = {};
__export(exports_chimera2, {
  initChimera: () => initChimera,
  chimeraReady: () => chimeraReady,
  chimeraModule: () => chimeraModule,
  call: () => call
});
function initChimera(source) {
  if (loading)
    return loading;
  loading = (async () => {
    let mod;
    if (source && typeof source !== "string")
      mod = await WebAssembly.compile(source);
    else {
      const url = source ?? (await Promise.resolve().then(() => exports_chimera)).default;
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`engine: ${url}: HTTP ${res.status}`);
      mod = await WebAssembly.compile(await res.arrayBuffer());
    }
    if (WebAssembly.Module.imports(mod).length)
      throw new Error("engine: the wasm module must not have imports");
    exports = (await WebAssembly.instantiate(mod, {})).exports;
    module = mod;
  })();
  loading.catch(() => loading = null);
  return loading;
}
function chimeraReady() {
  return exports !== null;
}
function chimeraModule() {
  if (!module)
    throw new Error("engine not loaded (await initChimera())");
  return module;
}
function x() {
  if (!exports)
    throw new Error("engine not loaded (await initChimera())");
  return exports;
}
function call(fn, args = {}) {
  const e = x();
  const bytes = enc.encode(JSON.stringify({ fn, ...args }));
  const p = e.chimera_alloc(bytes.length);
  new Uint8Array(e.memory.buffer, p, bytes.length).set(bytes);
  const status = e.chimera_call(p, bytes.length);
  e.chimera_free(p, bytes.length);
  const out = dec.decode(new Uint8Array(e.memory.buffer, e.chimera_result_ptr(), e.chimera_result_len()));
  const v = JSON.parse(out);
  if (status !== 0)
    throw new Error(`engine ${fn}: ${v.error}`);
  return v;
}
var module = null, exports = null, loading = null, enc, dec;
var init_chimera = __esm(() => {
  enc = new TextEncoder;
  dec = new TextDecoder;
});

// src/ui/creatureVisuals.ts
var CREATURE_VISUALS;
var init_creatureVisuals = __esm(() => {
  CREATURE_VISUALS = {
    songbird: {
      view: { x0: -4, x1: 14, y0: -6, y1: 8 },
      silhouette: [[-3.2, -1.2], [-1.6, -3.4], [1.6, -4.6], [5.2, -4.4], [7.8, -2.6], [9, -0.4], [9.6, 1.8], [10.4, 2.4], [12.8, 2.6], [10.6, 3], [9.8, 3.6], [9.2, 4.6], [7.6, 5.2], [6, 4.6], [4.2, 2.8], [2, 2], [-0.2, 1.6], [-3.6, 1.4], [-3.4, 0.2]],
      parts: [{ shade: 0.2, pts: [[8.6, 4], [8.95, 4.3], [9.2, 4], [8.95, 3.7]] }],
      tubes: [
        { tube: "bronchusL", path: [[3.4, -1.9], [4.4, -1.4]], label: "Left bronchus", inView: false },
        { tube: "bronchusR", path: [[3.4, -0.9], [4.4, -1.2]], label: "Right bronchus", inView: false },
        { tube: "trachea", path: [[4.4, -1.3], [5.6, -0.4], [6.8, 0.8], [7.8, 1.9], [8.6, 2.5]], label: "Trachea" },
        { tube: "beak", path: [[9.4, 2.75], [10.6, 2.75], [12.4, 2.7]], label: "Beak" }
      ],
      tubeScale: 1.6,
      sources: [{ key: "left", at: [4.2, -1.6], label: "Left voice" }, { key: "right", at: [4.2, -1], label: "Right voice" }]
    },
    seal: {
      view: { x0: -60, x1: 60, y0: -30, y1: 30 },
      silhouette: [[-58, -2], [-50, -8], [-30, -14], [-5, -16], [20, -14], [38, -10], [48, -6], [55, -3], [58, 1], [56, 5], [50, 8], [42, 10], [30, 11], [10, 13], [-15, 13], [-35, 10], [-50, 6], [-56, 3], [-62, 8], [-64, 4], [-60, 0], [-64, -4], [-62, -8]],
      parts: [{ shade: 0.15, pts: [[47, 4], [48.5, 5], [50, 4], [48.5, 3]] }],
      tubes: [
        { tube: "trachea", path: [[8, -4], [20, -3], [30, -2]], label: "Trachea" },
        { tube: "pharynx", path: [[30, -2], [38, 0], [44, 1.5]], label: "Pharynx" },
        { tube: "oral", path: [[44, 1.5], [50, 0.5], [57, -0.5]], label: "Mouth" }
      ],
      tubeScale: 1.3,
      sources: [{ key: "glottis", at: [30, -2], label: "Larynx" }]
    },
    alligator: {
      view: { x0: -120, x1: 120, y0: -40, y1: 40 },
      silhouette: [[-118, 2], [-90, -4], [-60, -8], [-30, -14], [0, -16], [30, -14], [50, -10], [70, -8], [95, -5], [114, -3], [118, 0], [115, 3], [98, 5], [75, 7], [52, 9], [40, 12], [20, 14], [-10, 14], [-40, 11], [-70, 7], [-100, 4]],
      parts: [{ shade: 0.15, pts: [[54, 9], [56, 11], [58, 9], [56, 8]] }],
      tubes: [
        { tube: "trachea", path: [[0, -6], [18, -5], [36, -4]], label: "Trachea" },
        { tube: "pharynx", path: [[36, -4], [46, -2], [54, 0]], label: "Pharynx" },
        { tube: "oral", path: [[54, 0], [80, -1], [112, -1]], label: "Mouth" },
        { tube: "nasal", path: [[54, 2], [80, 4], [113, 2]], label: "Nostrils" }
      ],
      tubeScale: 1.05,
      sources: [{ key: "glottis", at: [36, -4], label: "Larynx" }]
    },
    elephant: {
      view: { x0: -170, x1: 170, y0: -170, y1: 130 },
      silhouette: [[-160, 20], [-150, 70], [-110, 105], [-40, 118], [30, 115], [70, 100], [95, 112], [120, 108], [140, 85], [148, 55], [146, 25], [140, 5], [132, -20], [128, -60], [122, -110], [118, -150], [108, -152], [112, -100], [110, -50], [104, -20], [96, -5], [80, 0], [70, -10], [66, -90], [40, -95], [44, -30], [-90, -30], [-95, -95], [-125, -95], [-122, -10], [-150, -5]],
      parts: [{ shade: 0.15, pts: [[118, 62], [122, 66], [126, 62], [122, 58]] }, { shade: 0.62, pts: [[70, 100], [40, 60], [55, 25], [85, 40], [95, 80]] }],
      tubes: [
        { tube: "trachea", path: [[40, 20], [70, 30], [95, 38]], label: "Trachea" },
        { tube: "pharynx", path: [[95, 38], [112, 50], [124, 58]], label: "Pharynx" },
        { tube: "oral", path: [[124, 58], [130, 42], [134, 30]], label: "Mouth" },
        { tube: "trunk", path: [[136, 70], [142, 40], [136, 0], [128, -50], [120, -100], [113, -148]], label: "Trunk" }
      ],
      tubeScale: 3,
      sources: [{ key: "glottis", at: [95, 38], label: "Vocal folds" }, { key: "lips", at: [136, 70], label: "Trunk valve" }]
    }
  };
});

// src/wasm/engine.ts
var exports_engine = {};
__export(exports_engine, {
  tokenizeIpa: () => tokenizeIpa,
  restTip: () => restTip,
  plannedCounts: () => plannedCounts,
  planUtterance: () => planUtterance,
  planSong: () => planSong,
  planPhrases: () => planPhrases,
  planNoteOn: () => planNoteOn,
  planNoteOff: () => planNoteOff,
  planMelisma: () => planMelisma,
  parseBeat: () => parseBeat,
  lyricsToSyllables: () => lyricsToSyllables,
  formatBeat: () => formatBeat,
  dropAirwayModel: () => dropAirwayModel,
  creaturePreview: () => creaturePreview,
  creatureById: () => creatureById,
  beatReady: () => beatReady,
  airwayTransfer: () => airwayTransfer,
  airwayModel: () => airwayModel,
  airwayFrame: () => airwayFrame,
  airwayAreas: () => airwayAreas,
  activation: () => activation,
  VOWEL_TARGETS: () => VOWEL_TARGETS,
  VOWELS: () => VOWELS,
  TractMap: () => TractMap,
  NEUTRAL: () => NEUTRAL,
  EnglishG2P: () => EnglishG2P,
  EXHALE_LABEL: () => EXHALE_LABEL,
  DEMO_SONGS: () => DEMO_SONGS,
  DEFAULT_SOURCE: () => DEFAULT_SOURCE,
  CREATURES: () => CREATURES,
  BODY_MALE: () => BODY_MALE,
  BODY_FEMALE: () => BODY_FEMALE,
  BODY_CHILD: () => BODY_CHILD,
  BEAT_SOUNDS: () => BEAT_SOUNDS,
  BEAT_PRESETS: () => BEAT_PRESETS,
  BASS_NOTE: () => BASS_NOTE,
  ARTIC_SPECS: () => ARTIC_SPECS,
  ARTIC_KEYS: () => ARTIC_KEYS
});
function tokenizeIpa(text) {
  return call("tokenizeIpa", { text });
}

class EnglishG2P {
  loading = null;
  isLoaded = false;
  get loaded() {
    return this.isLoaded;
  }
  load(url = "/data/cmudict.txt.gz") {
    if (this.isLoaded)
      return Promise.resolve();
    if (this.loading)
      return this.loading;
    this.loading = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`dictionary ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        let text;
        if (bytes[0] === 31 && bytes[1] === 139) {
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
          text = await new Response(stream).text();
        } else
          text = new TextDecoder().decode(bytes);
        this.setDictionaryText(text);
      } catch (e) {
        this.loading = null;
        throw e;
      }
    })();
    return this.loading;
  }
  setDictionaryText(text) {
    call("g2pLoad", { text });
    this.isLoaded = true;
  }
  toPhrases(text) {
    return call("g2pPhrases", { text });
  }
  word(w, reduce = true) {
    return call("g2pWord", { word: w, reduce });
  }
}
function lyricsToSyllables(text) {
  return call("lyricsToSyllables", { text });
}
function planUtterance(segments, options) {
  return call("planUtterance", { segments, options });
}
function plannedCounts(ipa) {
  return call("plannedCounts", { ipa });
}
function planPhrases(phrases, options) {
  return call("planPhrases", { phrases: phrases.map((p) => ({ segments: p.segments, intonation: p.intonation, pause: p.pause })), options });
}
function planSong(notes, options) {
  return call("planSong", { notes, options });
}
function planNoteOn(syl, midi, options) {
  return call("planNoteOn", { syl, midi, options });
}
function planMelisma(midi, options) {
  return call("planMelisma", { midi, options });
}
function planNoteOff(syl, midi, body) {
  return call("planNoteOff", { syl, midi, body });
}
function activation(g, t) {
  if (t <= g.t0 - g.rampIn || t >= g.t1 + g.rampOut)
    return 0;
  if (t < g.t0)
    return 0.5 - 0.5 * Math.cos(Math.PI * (t - (g.t0 - g.rampIn)) / Math.max(0.000001, g.rampIn));
  if (t > g.t1)
    return 0.5 + 0.5 * Math.cos(Math.PI * (t - g.t1) / Math.max(0.000001, g.rampOut));
  return 1;
}
function parseBeat(text) {
  return call("parseBeat", { text });
}
function formatBeat(steps) {
  return call("formatBeat", { steps });
}
function beatReady(body) {
  return call("beatReady", { body });
}
function restTip(jaw, tbX, tbY) {
  return call("restTip", { jaw, tbX, tbY });
}

class TractMap {
  scale;
  ph;
  constructor(body) {
    this.scale = body.scale;
    this.ph = body.pharynx;
  }
  P(x2, y) {
    const k = this.scale;
    const xx = x2 > 0.5 ? 0.5 + (x2 - 0.5) * 0.86 : x2;
    const yy = y < 7 ? 7 - (7 - y) * this.ph : y;
    return { x: xx * k, y: yy * k };
  }
  unP(x2, y) {
    const k = this.scale;
    let xx = x2 / k, yy = y / k;
    if (xx > 0.5)
      xx = 0.5 + (xx - 0.5) / 0.86;
    if (yy < 7)
      yy = 7 - (7 - yy) / this.ph;
    return { x: xx, y: yy };
  }
}
function airwayModel(body, sampleRate) {
  return call("model", { body, sampleRate });
}
function dropAirwayModel(m) {
  call("dropModel", { model: m.model });
}
function airwayFrame(m, artic) {
  return call("frame", { model: m.model, artic });
}
function airwayAreas(m, artic) {
  return call("apply", { model: m.model, artic });
}
function airwayTransfer(m, artic) {
  return call("transfer", { model: m.model, artic });
}
function creaturePreview(id, params) {
  return call("creaturePreview", { id, params: params ?? {} });
}
var CATALOG, NEUTRAL, BODY_MALE, BODY_FEMALE, BODY_CHILD, ARTIC_KEYS, ARTIC_SPECS, DEFAULT_SOURCE, EXHALE_LABEL, BASS_NOTE, BEAT_SOUNDS, BEAT_PRESETS, VOWEL_TARGETS, DEMO_SONGS, VOWELS, CREATURES, creatureById = (id) => CREATURES.find((c) => c.id === id);
var init_engine = __esm(() => {
  init_chimera();
  init_creatureVisuals();
  CATALOG = call("catalog");
  NEUTRAL = CATALOG.neutral;
  BODY_MALE = CATALOG.bodies.male;
  BODY_FEMALE = CATALOG.bodies.female;
  BODY_CHILD = CATALOG.bodies.child;
  ARTIC_KEYS = CATALOG.articKeys;
  ARTIC_SPECS = CATALOG.articSpecs;
  DEFAULT_SOURCE = CATALOG.defaultSource;
  EXHALE_LABEL = CATALOG.exhaleLabel;
  BASS_NOTE = CATALOG.bassNote;
  BEAT_SOUNDS = CATALOG.beatSounds;
  BEAT_PRESETS = CATALOG.beatPresets;
  VOWEL_TARGETS = CATALOG.vowelTargets;
  DEMO_SONGS = CATALOG.demoSongs;
  VOWELS = CATALOG.vowels;
  CREATURES = CATALOG.creatures.map((c) => ({ ...c, visual: CREATURE_VISUALS[c.id] }));
});

// agent/daemon/server.ts
import { createReadStream, existsSync as existsSync4, statSync as statSync2 } from "node:fs";
import { createServer } from "node:http";
import { extname, join as join4, normalize } from "node:path";

// agent/core/engine.ts
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

// agent/core/paths.ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
var BUNDLED = true;
var BUILD = "38bfef586d66";
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

// agent/core/engine.ts
var loading2 = null;
function loadEngine() {
  loading2 ??= (async () => {
    const { initChimera: initChimera2 } = await Promise.resolve().then(() => (init_chimera(), exports_chimera2));
    await initChimera2(readFileSync(WASM));
    const up = await Promise.resolve().then(() => (init_engine(), exports_engine));
    new up.EnglishG2P().setDictionaryText(gunzipSync(readFileSync(DICT)).toString());
    return {
      beatSounds: up.BEAT_SOUNDS.map((s) => ({ id: s.id, role: s.role })),
      syllables: (text) => up.lyricsToSyllables(text).map((s) => ({
        text: s.text,
        stress: s.nucleus.stress ?? 0,
        melisma: !!s.melisma,
        wordEnd: s.wordEnd,
        phraseEnd: s.phraseEnd
      }))
    };
  })();
  return loading2;
}

// agent/core/score.ts
var DEFAULT_LIMITS = { maxSeconds: 45 };
var BAND_LIMITS = { maxSeconds: 60 };
var MAX_VOICES = 4;
var RANGES = { male: [38, 69], female: [53, 84], child: [57, 81] };
var HARD = [28, 100];
var LEAD = 0.35;
var TAIL = 0.4;
var STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
var NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var noteName = (midi) => `${NAMES[(Math.round(midi) % 12 + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;
function parsePitch(p) {
  if (p === null || p === undefined)
    return 0;
  if (typeof p === "number")
    return Number.isFinite(p) ? p <= 0 ? 0 : p : null;
  if (typeof p !== "string")
    return null;
  const s = p.trim();
  if (s === "" || s === "-" || s === "_" || /^(r|rest)$/i.test(s))
    return 0;
  if (/^\d+(\.\d+)?$/.test(s))
    return Number(s);
  const m = s.match(/^([A-Ga-g])([#♯b♭]?)(-?\d)$/);
  if (!m)
    return null;
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + STEP[m[1].toUpperCase()] + acc;
}
function parseBody(b) {
  if (b === "male" || b === "female" || b === "child")
    return b;
  if (b && typeof b === "object") {
    const o = b;
    const f = Number(o.female ?? 0), c = Number(o.child ?? 0);
    if (Number.isFinite(f) && Number.isFinite(c))
      return { female: Math.min(1, Math.max(0, f)), child: Math.min(1, Math.max(0, c)) };
  }
  return null;
}
function readItem(raw, index) {
  let pitch, beats, lyric;
  if (Array.isArray(raw))
    [pitch, beats, lyric] = raw;
  else if (raw && typeof raw === "object") {
    const o = raw;
    if ("rest" in o)
      [pitch, beats] = [0, o.rest];
    else
      [pitch, beats, lyric] = [o.pitch ?? o.midi, o.beats, o.lyric ?? o.syllable ?? o.text];
  } else
    return `note ${index + 1}: write a note as ["E4", 1, "word"] and a rest as ["-", 1]`;
  const midi = parsePitch(pitch);
  if (midi === null)
    return `note ${index + 1}: cannot read the pitch ${JSON.stringify(pitch)}; use a name like "C4" or "F#3", a MIDI number, or "-" for a rest`;
  const b = Number(beats);
  if (!Number.isFinite(b) || b <= 0)
    return `note ${index + 1}: beats must be a number above 0, not ${JSON.stringify(beats)}`;
  if (b > 16)
    return `note ${index + 1}: ${b} beats is too long for one note (16 at most)`;
  if (lyric !== undefined && lyric !== null && typeof lyric !== "string")
    return `note ${index + 1}: the lyric must be text`;
  return { index, midi, beats: b, lyric: typeof lyric === "string" ? lyric : null };
}
var PUNCT = /[.,;:!?]+$/;
var isHold = (l) => l === null || /^\s*[-~_]?\s*$/.test(l);
var ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
var TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numberWords(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999999)
    return String(n).split("").map((d) => /\d/.test(d) ? ONES[Number(d)] : d === "." ? "point" : "").filter(Boolean).join(" ");
  if (n < 20)
    return ONES[n];
  if (n < 100)
    return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000)
    return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numberWords(n % 100) : "");
  return numberWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numberWords(n % 1000) : "");
}
function compile(input, engine, limits = DEFAULT_LIMITS) {
  const issues = [];
  const err = (message, note) => void issues.push({ level: "error", message, note });
  const warn = (message, note) => void issues.push({ level: "warning", message, note });
  const fail = () => ({ ok: false, seconds: 0, notes: 0, issues });
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch (e) {
      err(`the score is not valid JSON: ${e instanceof Error ? e.message : e}`);
      return fail();
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    err('a score is an object: {"bpm": 96, "notes": [["E4", 1, "word"], ...]}');
    return fail();
  }
  const s = { ...input };
  if (s.voices !== undefined)
    return compileBand(s, engine, limits === DEFAULT_LIMITS ? BAND_LIMITS : limits);
  const bpm = Number(s.bpm ?? 96);
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 240)
    err(`bpm must be between 30 and 240, not ${JSON.stringify(s.bpm)}`);
  let body;
  if (s.body !== undefined && s.body !== null) {
    const b = parseBody(s.body);
    if (!b)
      err(`body must be "male", "female" or "child", not ${JSON.stringify(s.body)}`);
    else
      body = b;
  }
  const vibrato = s.vibrato === undefined ? undefined : Number(s.vibrato);
  if (vibrato !== undefined && !(vibrato >= 0 && vibrato <= 100))
    err("vibrato is in cents, 0 to 100");
  if (typeof s.notes === "string") {
    const parsed = parseNoteString(s.notes);
    if (typeof parsed === "string") {
      err(parsed);
      return fail();
    }
    s.notes = parsed;
  }
  if (!Array.isArray(s.notes) || !s.notes.length) {
    err('the score needs "notes": [["E4", 1, "word"], ...]');
    return fail();
  }
  const items = [];
  s.notes.forEach((raw, i) => {
    const it = readItem(raw, i);
    if (typeof it === "string")
      err(it, i);
    else
      items.push(it);
  });
  if (issues.some((i) => i.level === "error"))
    return fail();
  const out = [];
  const tokens = [];
  const count = (word) => engine.syllables(word).filter((x2) => !x2.melisma).length;
  if (typeof s.lyrics === "string") {
    for (const it of items)
      out.push([it.midi, it.beats]);
    tokens.push(s.lyrics.replace(/\d+(\.\d+)?/g, (d) => numberWords(Number(d))));
  } else {
    let word = null;
    let sung = false;
    const finish = () => {
      const w = word;
      word = null;
      if (!w)
        return;
      const joined = w.text.replace(/[^A-Za-z']/g, "");
      if (!/[A-Za-z]/.test(joined))
        return err(`the lyric ${JSON.stringify(w.text)} has nothing to sing: write words, with numbers spelled out`, w.first);
      const n = count(joined);
      if (!n)
        return err(`cannot pronounce ${JSON.stringify(joined)}: respell it the way it sounds`, w.first);
      let holds = w.holds;
      if (holds)
        warn(`a held note inside "${joined}" moved to the word's end`, w.first);
      if (n < w.notes.length) {
        holds += w.notes.length - n;
        warn(`"${joined}" is ${n} syllable${n > 1 ? "s" : ""} but has ${w.notes.length} notes: the last vowel is held over the rest`, w.first);
      } else if (n > w.notes.length) {
        const at = w.notes[w.notes.length - 1];
        const parts = n - w.notes.length + 1;
        const [midi, beats] = out[at];
        out.splice(at, 1, ...Array.from({ length: parts }, () => [midi, beats / parts]));
        warn(`"${joined}" is ${n} syllables (${engine.syllables(joined).map((x2) => x2.text).join("·")}) but has ${w.notes.length} note${w.notes.length > 1 ? "s" : ""}: its last note was split in ${parts}. Give each syllable its own note.`, w.first);
      }
      tokens.push(joined, ...Array(holds).fill("-"));
      if (w.punct)
        tokens.push(w.punct[0]);
      sung = true;
    };
    for (const it of items) {
      if (it.midi === 0) {
        finish();
        out.push([0, it.beats]);
        continue;
      }
      if (isHold(it.lyric)) {
        out.push([it.midi, it.beats]);
        if (word)
          word.holds++;
        else if (sung)
          tokens.push("-");
        else {
          tokens.push("ah");
          sung = true;
        }
        continue;
      }
      const spelled = it.lyric.replace(/\d+(\.\d+)?/g, (d) => ` ${numberWords(Number(d))} `).trim();
      const words = spelled.split(/\s+/).filter((x2) => !/^[-~_]$/.test(x2));
      if (words.length > 1)
        warn(`note ${it.index + 1} carries ${words.length} words ("${spelled}"): they share its beats. Write one syllable per note.`, it.index);
      for (const piece of words) {
        const cont = piece.length > 1 && /[-_]$/.test(piece);
        const punct = cont ? "" : piece.match(PUNCT)?.[0] ?? "";
        const text = piece.replace(PUNCT, "").replace(/^[-_]+|[-_]+$/g, "");
        if (!/[A-Za-z]/.test(text)) {
          err(`the lyric ${JSON.stringify(piece)} has nothing to sing: write words, with numbers spelled out`, it.index);
          continue;
        }
        out.push([it.midi, it.beats / words.length]);
        if (!word)
          word = { text: "", notes: [], holds: 0, first: it.index, punct: "" };
        word.text += text;
        word.notes.push(out.length - 1);
        word.punct = punct;
        if (!cont)
          finish();
      }
    }
    finish();
  }
  if (issues.some((i) => i.level === "error"))
    return fail();
  const lyrics = tokens.join(" ");
  const sounding = out.filter((n) => n[0] > 0);
  if (!sounding.length) {
    err("the score has no notes to sing");
    return fail();
  }
  const syl = engine.syllables(lyrics);
  if (syl.length !== sounding.length) {
    err(`${syl.length} syllables for ${sounding.length} notes: ${syl.map((x2) => x2.text).join(" ")}. Give every syllable one note.`);
    return fail();
  }
  const beat = 60 / bpm;
  const seconds = LEAD + out.reduce((t, n) => t + n[1], 0) * beat + TAIL;
  if (seconds > limits.maxSeconds)
    err(`the song is ${seconds.toFixed(0)} s long; keep it under ${limits.maxSeconds} s`);
  for (const [midi] of sounding) {
    if (midi < HARD[0] || midi > HARD[1]) {
      err(`${noteName(midi)} is outside what the voice can sing (${noteName(HARD[0])} to ${noteName(HARD[1])})`);
      break;
    }
  }
  if (typeof body === "string" || body === undefined) {
    const [lo, hi] = RANGES[body ?? "female"];
    const low = Math.min(...sounding.map((n) => n[0])), high = Math.max(...sounding.map((n) => n[0]));
    if (low < lo || high > hi)
      warn(`the melody spans ${noteName(low)} to ${noteName(high)}; the ${body ?? "female"} voice is comfortable from ${noteName(lo)} to ${noteName(hi)}`);
  }
  if (sounding.some((n) => n[1] * beat < 0.09))
    warn("some notes are shorter than 0.09 s and will blur: use longer notes or a slower tempo");
  if (issues.some((i) => i.level === "error"))
    return fail();
  const melody = { bpm, lyrics, notes: out };
  if (typeof s.title === "string" && s.title.trim())
    melody.title = s.title.trim().slice(0, 80);
  if (body)
    melody.body = body;
  if (vibrato !== undefined)
    melody.vibrato = vibrato;
  return { ok: true, melody, seconds, notes: sounding.length, issues };
}
function parseNoteString(text) {
  const out = [];
  for (const [i, tok] of text.trim().split(/\s+/).filter(Boolean).entries()) {
    const parts = tok.split("/");
    if (parts.length < 2 || parts.length > 3)
      return `note ${i + 1} "${tok}": write pitch/beats/lyric, e.g. E4/1/love or -/1 for a rest`;
    out.push([parts[0], Number(parts[1]), ...parts[2] !== undefined && parts[2] !== "" ? [parts[2]] : []]);
  }
  return out;
}
function voiceNotes(v) {
  let notes = v.notes;
  if (typeof notes === "string")
    notes = parseNoteString(notes);
  if (typeof notes === "string")
    return notes;
  if (!Array.isArray(notes))
    return 'a singing voice needs "notes"';
  const times = v.repeat === undefined ? 1 : Number(v.repeat);
  if (!Number.isInteger(times) || times < 1 || times > 32)
    return '"repeat" is a whole number from 1 to 32';
  return Array.from({ length: times }, () => notes).flat();
}
function checkBeat(text, engine) {
  if (typeof text !== "string" || !text.trim())
    return 'a beat is a pattern like "B . t . | Pf . t ."';
  const known = new Set(engine.beatSounds.map((b) => b.id));
  const tokens = text.split(/\s+/).filter((t) => t && t !== "|");
  const unknown = [...new Set(tokens.filter((t) => t !== "." && !known.has(t)))];
  if (unknown.length)
    return `the beat has sounds the beatboxer does not know: ${unknown.join(" ")}. Use ${engine.beatSounds.map((b) => `${b.id} (${b.role})`).join(", ")}, and "." for a rest`;
  if (!tokens.some((t) => t !== "."))
    return "the beat has no sounds in it";
  if (tokens.length > 128)
    return "the beat pattern is longer than 128 steps: write one or two bars, it loops";
  return null;
}
function compileBand(input, engine, limits = DEFAULT_LIMITS) {
  const issues = [];
  const fail = () => ({ ok: false, seconds: 0, notes: 0, issues });
  const voices = input.voices;
  if (!Array.isArray(voices) || !voices.length) {
    issues.push({ level: "error", message: '"voices" is a list: [{"name": "lead", "notes": ...}, {"name": "beat", "beat": "B . t ."}]' });
    return fail();
  }
  const objects = voices.map((v) => v && typeof v === "object" && !Array.isArray(v) ? v : {});
  if (voices.length > MAX_VOICES)
    issues.push({ level: "error", message: `a band has at most ${MAX_VOICES} voices (the lead and ${MAX_VOICES - 1} more); this one has ${voices.length}` });
  const singing = objects.filter((v) => v.beat === undefined);
  if (!singing.length)
    issues.push({ level: "error", message: "a band needs at least one singing voice" });
  if (issues.length)
    return fail();
  const lead = singing.find((v) => v.name === "lead") ?? singing[0];
  const countIn = Math.max(0, ...objects.map((v) => typeof v.beat === "string" ? v.beat.split(/\s+/).filter((t) => t && t !== "|").length : 0));
  const backing = [];
  let melody;
  let notes = 0;
  let longest = 0;
  const pans = [-0.45, 0.45, 0];
  objects.forEach((v, i) => {
    const name = typeof v.name === "string" && v.name.trim() ? v.name.trim().slice(0, 24) : `voice ${i + 1}`;
    const tag = (m) => `${name}: ${m}`;
    const level = (key, lo, hi) => {
      if (v[key] === undefined)
        return;
      const x2 = Number(v[key]);
      if (Number.isFinite(x2) && x2 >= lo && x2 <= hi)
        return x2;
      issues.push({ level: "error", message: tag(`${key} is from ${lo} to ${hi}`) });
      return;
    };
    const volume = level("volume", -30, 6);
    const pan = level("pan", -1, 1);
    if (v.beat !== undefined) {
      const bad = checkBeat(v.beat, engine);
      if (bad)
        issues.push({ level: "error", message: tag(bad) });
      else
        backing.push({ name, beat: String(v.beat), volume: volume ?? -3, pan: pan ?? 0 });
      return;
    }
    const n = voiceNotes(v);
    if (typeof n === "string")
      return void issues.push({ level: "error", message: tag(n) });
    const c = compile({ bpm: input.bpm, body: v.body ?? input.body, notes: n, vibrato: v.vibrato ?? input.vibrato }, engine, { maxSeconds: Infinity });
    for (const x2 of c.issues)
      issues.push({ ...x2, message: tag(x2.message) });
    if (!c.ok || !c.melody)
      return;
    longest = Math.max(longest, c.melody.notes.reduce((t, x2) => t + x2[1], 0));
    notes += c.notes;
    if (v === lead) {
      melody = c.melody;
      if (typeof input.title === "string" && input.title.trim())
        melody.title = input.title.trim().slice(0, 80);
    } else
      backing.push({ name, body: c.melody.body ?? "male", lyrics: c.melody.lyrics, notes: c.melody.notes, vibrato: c.melody.vibrato, volume: volume ?? -5, pan: pan ?? pans[backing.length % pans.length] });
  });
  if (issues.some((x2) => x2.level === "error") || !melody)
    return fail();
  const beat = 60 / melody.bpm;
  const seconds = (countIn ? countIn / 4 * beat : 0.35) + longest * beat + 0.4;
  if (seconds > limits.maxSeconds) {
    issues.push({ level: "error", message: `the band plays for ${seconds.toFixed(0)} s; keep it under ${limits.maxSeconds} s (fewer repeats, or a faster tempo)` });
    return fail();
  }
  melody.backing = backing;
  return { ok: true, melody, seconds, notes, issues };
}

// agent/core/text.ts
function codeLike(line) {
  const dense = line.replace(/\s/g, "");
  if (dense.length < 4)
    return false;
  if (/^\s*[$❯%]\s+\S/.test(line))
    return true;
  if (/^\s*[+-]\s{2,}\S/.test(line) || /^\s*(@@|diff --git|[+-]{3} )/.test(line))
    return true;
  if (/[;{}]\s*$/.test(line) || /^\s*[{[]\s*(["{[\d]|$)/.test(line))
    return true;
  const symbols = dense.match(/[(){}[\]=<>|&$\\;]/g)?.length ?? 0;
  if (symbols >= 3 && symbols / dense.length >= 0.08)
    return true;
  return dense.length >= 8 && (dense.match(/[A-Za-z]/g)?.length ?? 0) / dense.length < 0.6;
}
function plainText(md) {
  let t = md.replace(/\r/g, "");
  t = t.replace(/```[\s\S]*?(```|$)/g, " ").replace(/~~~[\s\S]*?(~~~|$)/g, " ");
  t = t.replace(/<[^>\n]{1,200}>/g, " ");
  t = t.split(`
`).filter((line) => !codeLike(line)).join(`
`);
  t = t.replace(/^\s*\|.*\|\s*$/gm, " ");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  t = t.replace(/\bhttps?:\/\/\S+/g, " ");
  t = t.replace(/`([^`\n]*)`/g, (_m, c) => /^[A-Za-z][A-Za-z' ]*$/.test(c) ? c : " ");
  t = t.replace(/(^|\s)[~.]?\/?(?:[\w.@-]+\/)+[\w.@-]*/g, "$1 ");
  t = t.replace(/\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|json|md|rs|py|toml|yaml|yml|html|css|sh|txt|lock|wasm)\b/g, " ");
  t = t.replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, "$1.");
  t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/gm, "$1.");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1");
  t = t.replace(/&/g, " and ").replace(/%/g, " percent ").replace(/\+/g, " plus ").replace(/=/g, " is ");
  t = t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  t = t.replace(/\d+(\.\d+)?/g, (d) => ` ${numberWords(Number(d))} `);
  t = t.replace(/[—–]/g, ", ").replace(/\n{2,}/g, ". ").replace(/\n/g, " ");
  t = t.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  t = t.replace(/[’‘]/g, "'").replace(/[^A-Za-z' .,;:!?]/g, " ");
  t = t.replace(/(^|\s)'+|'+(?=\s|$|[.,;:!?])/g, "$1");
  t = t.replace(/\s+([.,;:!?])/g, "$1").replace(/([.,;:!?])(?:\s*[.,;:!?])+/g, "$1").replace(/\s+/g, " ").trim();
  return t.replace(/^[.,;:!?\s]+/, "");
}
function excerpt(text, { maxWords }) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [];
  const out = [];
  let n = 0;
  for (const raw of sentences) {
    const sen = raw.trim();
    if (!/[A-Za-z]/.test(sen))
      continue;
    const words = sen.split(/\s+/);
    if (n + words.length > maxWords) {
      if (!out.length) {
        let cut = words.slice(0, maxWords);
        let clause = cut.length - 2;
        while (clause >= 0 && !/[,;:]$/.test(cut[clause]))
          clause--;
        if (clause + 1 >= maxWords / 2)
          cut = cut.slice(0, clause + 1);
        out.push(cut.join(" ").replace(/[,;:]$/, "") + ".");
      }
      break;
    }
    out.push(/[.!?]$/.test(sen) ? sen : sen + ".");
    n += words.length;
  }
  return out.join(" ");
}
function singable(md, opts = { maxWords: 28 }) {
  return excerpt(plainText(md), opts);
}
function chunks(text, maxWords) {
  const out = [];
  let cur = [];
  let n = 0;
  const flush = () => {
    if (cur.length)
      out.push(cur.join(" "));
    cur = [];
    n = 0;
  };
  for (const raw of text.match(/[^.!?]+[.!?]?/g) ?? []) {
    const sen = raw.trim();
    if (!/[A-Za-z]/.test(sen))
      continue;
    const words = sen.split(/\s+/);
    if (words.length > maxWords) {
      flush();
      let part = [];
      for (const clause of sen.match(/[^,;:]+[,;:]?/g) ?? [sen]) {
        const w = clause.trim().split(/\s+/).filter(Boolean);
        if (part.length && part.length + w.length > maxWords) {
          out.push(part.join(" ").replace(/[,;:]$/, "") + ".");
          part = [];
        }
        part.push(...w);
        while (part.length > maxWords)
          out.push(part.splice(0, maxWords).join(" ").replace(/[,;:]$/, "") + ".");
      }
      if (part.length)
        out.push(/[.!?]$/.test(part.at(-1)) ? part.join(" ") : part.join(" ") + ".");
      continue;
    }
    if (n + words.length > maxWords)
      flush();
    cur.push(sen);
    n += words.length;
  }
  flush();
  return out;
}

// agent/core/melodize.ts
var TONIC = { male: 48, female: 60, child: 62 };
var PENTA = [0, 2, 4, 7, 9];
var pitch = (tonic, step) => tonic + 12 * Math.floor(step / 5) + PENTA[(step % 5 + 5) % 5];
var WEAK = new Set("a an the of to in on at by for from with and or but as is are was were be been am it its this that these those i you he she we they me my your his her our their so if not no do does did have has had will would can could than then there here into up out".split(" "));
function rng(seed) {
  let h = 2166136261;
  for (let i = 0;i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 1831565813;
    let t = h;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function phrases(text, engine) {
  const out = [];
  let cur = { syls: [], end: "." };
  for (const tok of text.match(/[A-Za-z']+|[.,;:!?]/g) ?? []) {
    if (/^[.,;:!?]$/.test(tok)) {
      if (cur.syls.length) {
        cur.end = tok;
        out.push(cur);
        cur = { syls: [], end: "." };
      }
      continue;
    }
    const syl = engine.syllables(tok);
    const weak = syl.length === 1 && WEAK.has(tok.toLowerCase());
    for (const s of syl)
      cur.syls.push({ stress: !weak && s.stress === 1, weak });
  }
  if (cur.syls.length)
    out.push(cur);
  return out;
}
var SONG_WORDS = 30;
function melodizeAll(source, engine, opts = {}) {
  const text = singable(source, { maxWords: opts.maxWords ?? 28 });
  return chunks(text, SONG_WORDS).map((c) => tune(c, engine, opts)).filter((m) => m !== null);
}
function tune(text, engine, opts) {
  const style = opts.style ?? "tune";
  const body = opts.body ?? "female";
  const ph = phrases(text, engine);
  if (!ph.length)
    return null;
  const rand = rng(text);
  const tonic = TONIC[body];
  const chant = style === "chant";
  const bpm = chant ? 152 : 112;
  const [lo, hi] = chant ? [0, 3] : [-1, 6];
  const notes = [];
  ph.forEach((p, pi) => {
    const n = p.syls.length;
    const last = pi === ph.length - 1;
    const question = p.end === "?";
    const closing = p.end === "." || p.end === "!" || last;
    const target = question ? 3 : closing ? 0 : 2;
    let step = chant ? 2 : pi === 0 ? 0 : Math.round(rand() * 2);
    const peak = chant ? 3 : 3 + Math.round(rand() * 3);
    p.syls.forEach((s, i) => {
      const left = n - 1 - i;
      if (left === 0)
        step = target;
      else if (left === 1 && n > 2)
        step = question ? target - 1 : target + (rand() < 0.5 || target === lo ? 1 : -1);
      else if (chant)
        step = s.stress ? 3 : 2;
      else {
        const rising = i < n / 2;
        const lean = (rising ? 0.62 : 0.3) + (s.stress ? 0.2 : -0.1);
        const r = rand();
        const move = r < lean ? 1 : r < lean + 0.18 ? 0 : -1;
        const jump = s.stress && rand() < 0.15 ? 1 : 0;
        step = Math.min(rising ? peak : hi, Math.max(lo, step + move + (move > 0 ? jump : 0)));
      }
      const beats = left === 0 ? closing ? 2 : 1.5 : chant ? s.stress ? 1 : 0.5 : s.weak ? 0.5 : s.stress ? 1 : 0.5;
      notes.push([pitch(tonic, Math.min(hi + 1, Math.max(lo - 1, step))), beats]);
    });
    if (!last)
      notes.push([0, closing || question ? 1 : 0.5]);
  });
  const melody = { bpm, lyrics: text, notes, body };
  if (opts.title)
    melody.title = opts.title;
  return melody;
}

// agent/core/openWindow.ts
import { spawn, spawnSync } from "node:child_process";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
function isWsl() {
  if (process.platform !== "linux")
    return false;
  if (process.env.WSL_DISTRO_NAME)
    return true;
  try {
    return /microsoft/i.test(readFileSync2("/proc/version", "utf8"));
  } catch {
    return false;
  }
}
var WIN_BROWSERS = [
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
];
var MAC_BROWSERS = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium"];
var LINUX_BROWSERS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];
function winLocalAppData() {
  const cmd = ["/mnt/c/Windows/System32/cmd.exe", "cmd.exe"].find((c) => c === "cmd.exe" || existsSync2(c));
  const r = spawnSync(cmd, ["/c", "echo %LOCALAPPDATA%"], { cwd: existsSync2("/mnt/c") ? "/mnt/c" : undefined, encoding: "utf8", timeout: 5000 });
  const out = (r.stdout ?? "").trim().split(/\r?\n/).pop()?.trim();
  return out && /^[A-Za-z]:\\/.test(out) ? out : null;
}
function launch(cmd, args) {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", cwd: isWsl() && existsSync2("/mnt/c") ? "/mnt/c" : undefined });
    child.on("error", () => {});
    child.unref();
    return child.pid !== undefined;
  } catch {
    return false;
  }
}
var appArgs = (url, profile) => [`--app=${url}`, "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "--window-size=520,760", "--no-first-run", "--no-default-browser-check"];
function openWindow(url) {
  const chosen = process.env.CHIMERA_SING_BROWSER;
  if (isWsl()) {
    const browser2 = chosen ?? WIN_BROWSERS.find((b) => existsSync2(b));
    const local = browser2 ? winLocalAppData() : null;
    if (browser2 && local && launch(browser2, appArgs(url, `${local}\\chimera-stage`)))
      return { how: browser2, autoplay: true };
    for (const opener of ["wslview", "/mnt/c/Windows/explorer.exe"]) {
      if ((opener.startsWith("/") ? existsSync2(opener) : which(opener)) && launch(opener, [url]))
        return { how: opener, autoplay: false };
    }
    return null;
  }
  const profile = join2(CACHE, "browser-profile");
  if (process.platform === "darwin") {
    const browser2 = chosen ?? MAC_BROWSERS.find((b) => existsSync2(b));
    if (browser2 && launch(browser2, appArgs(url, profile)))
      return { how: browser2, autoplay: true };
    return launch("open", [url]) ? { how: "open", autoplay: false } : null;
  }
  if (process.platform === "win32") {
    const browser2 = chosen ?? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((b) => existsSync2(b));
    if (browser2 && launch(browser2, appArgs(url, join2(process.env.LOCALAPPDATA ?? CACHE, "chimera-stage"))))
      return { how: browser2, autoplay: true };
    return launch("cmd.exe", ["/c", "start", "", url]) ? { how: "start", autoplay: false } : null;
  }
  const browser = chosen ?? LINUX_BROWSERS.map((b) => which(b)).find(Boolean);
  if (browser && launch(browser, appArgs(url, profile)))
    return { how: browser, autoplay: true };
  return which("xdg-open") && launch("xdg-open", [url]) ? { how: "xdg-open", autoplay: false } : null;
}

// agent/daemon/server.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";

// agent/core/settings.ts
import { existsSync as existsSync3, mkdirSync, readFileSync as readFileSync3, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname2, join as join3 } from "node:path";
var BODIES = ["male", "female", "child"];
var STYLES = ["tune", "chant"];
var LENGTHS = ["short", "normal", "full"];
var configDir = () => join3(process.env.XDG_CONFIG_HOME || join3(homedir2(), ".config"), "chimera-sing");
var settingsPath = () => join3(configDir(), "settings.json");
function readSettings() {
  let s = {};
  try {
    s = JSON.parse(readFileSync3(settingsPath(), "utf8"));
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
      s.auto = JSON.parse(readFileSync3(settingsPath(), "utf8")).auto === true;
    } catch {
      s.auto = false;
    }
  }
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2) + `
`);
  return readSettings();
}

// agent/daemon/server.ts
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".map": "application/json"
};
async function startDaemon(o) {
  const engine = await loadEngine();
  const clients = new Set;
  let nextClient = 1;
  let queue = [];
  let current = null;
  let nextId = 1;
  let lastOpen = 0;
  let lastActivity = Date.now();
  const startedAt = Date.now();
  const RECONNECT_GRACE = 1300;
  const self = [`http://127.0.0.1:${o.port}`, `http://localhost:${o.port}`];
  const devStage = [5317, 5318].flatMap((p) => [`http://127.0.0.1:${p}`, `http://localhost:${p}`]);
  const primary = () => [...clients].at(-1);
  const done = (id) => {
    if (current?.song.id !== id)
      return;
    clearTimeout(current.timer);
    current = null;
    pump();
  };
  function ensureWindow() {
    if (clients.size || !o.open || Date.now() - lastOpen < 15000)
      return;
    const wait = startedAt + RECONNECT_GRACE - Date.now();
    if (wait > 0)
      return void setTimeout(pump, wait);
    lastOpen = Date.now();
    const opened = openWindow(`http://127.0.0.1:${o.port}/?stage`);
    o.log(opened ? `opened the stage with ${opened.how}${opened.autoplay ? "" : " (it will need a click to sing)"}` : `could not open a browser: open http://127.0.0.1:${o.port}/?stage yourself`);
  }
  function pump() {
    if (current || !queue.length)
      return;
    const ws = primary();
    if (!ws)
      return ensureWindow();
    const song = queue.shift();
    const timer = setTimeout(() => done(song.id), (song.seconds * (song.melody.backing?.length ? 2 : 1) + 25) * 1000);
    current = { song, timer };
    ws.send({ type: "sing", id: song.id, melody: song.melody });
  }
  function stopAll() {
    queue = [];
    if (current) {
      clearTimeout(current.timer);
      current = null;
    }
    for (const ws of clients)
      ws.send({ type: "stop" });
  }
  function sing(req) {
    const issues = [];
    const voice = readSettings().voice;
    const body = BODIES.includes(req.body ?? "") ? req.body : voice.body;
    let inputs;
    if (req.score !== undefined)
      inputs = [req.score];
    else if (typeof req.text === "string") {
      const style = STYLES.includes(req.style ?? "") ? req.style : voice.style;
      inputs = melodizeAll(req.text, engine, { body, style, maxWords: req.maxWords, title: req.title });
      if (!inputs.length)
        return { ok: false, issues: [{ level: "error", message: "there are no words to sing in that text" }] };
    } else
      return { ok: false, issues: [{ level: "error", message: 'send {"score": {...}} or {"text": "..."}' }] };
    const songs = [];
    for (const input of inputs) {
      const c = compile(input, engine, DEFAULT_LIMITS);
      issues.push(...c.issues);
      if (!c.ok || !c.melody) {
        if (req.score !== undefined)
          return { ok: false, issues };
        continue;
      }
      c.melody.body ??= body;
      if (req.title && !c.melody.title)
        c.melody.title = req.title;
      songs.push({ melody: c.melody, seconds: c.seconds, notes: c.notes });
    }
    if (!songs.length)
      return { ok: false, issues };
    const seconds = songs.reduce((t, x2) => t + x2.seconds, 0);
    const reply = { ok: true, seconds: +seconds.toFixed(2), notes: songs.reduce((t, x2) => t + x2.notes, 0), lyrics: songs.map((x2) => x2.melody.lyrics).join(" "), issues };
    if (req.dryRun)
      return reply;
    if (req.replace)
      stopAll();
    reply.queued = queue.length + (current ? 1 : 0);
    reply.window = clients.size > 0;
    try {
      mkdirSync2(CACHE, { recursive: true });
      writeFileSync2(join4(CACHE, "last-song.json"), JSON.stringify({ at: new Date().toISOString(), songs: songs.map((x2) => x2.melody) }));
    } catch {}
    for (const x2 of songs) {
      queue.push({ id: nextId++, melody: x2.melody, seconds: x2.seconds });
      o.log(`song ${nextId - 1}: ${x2.notes} notes, ${x2.seconds.toFixed(1)} s: ${x2.melody.lyrics}`);
    }
    pump();
    return reply;
  }
  function file(pathname, res) {
    if (!existsSync4(join4(o.stageDir, "index.html"))) {
      res.writeHead(503, { "content-type": "text/plain" });
      return void res.end("The page is not built yet. Run: bun run build");
    }
    const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
    let path = join4(o.stageDir, rel);
    if (!path.startsWith(o.stageDir) || rel === "/" || !existsSync4(path) || !statSync2(path).isFile())
      path = join4(o.stageDir, "index.html");
    const index = path.endsWith("index.html");
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "cache-control": index ? "no-store" : "public, max-age=3600" });
    createReadStream(path).pipe(res);
  }
  const json = (res, data, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const parts = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > 4 << 20)
          req.destroy();
        else
          parts.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
      req.on("error", reject);
    });
  }
  function listen(req, res, cors) {
    res.writeHead(200, { ...cors, "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    const client = { id: nextClient++, send: (m) => void res.write(`data: ${JSON.stringify(m)}

`) };
    for (const old of clients)
      old.send({ type: "retire" });
    clients.add(client);
    lastActivity = Date.now();
    o.log(`stage connected (${clients.size})`);
    res.write(`retry: 600

`);
    client.send({ type: "hello", client: client.id });
    const beat = setInterval(() => res.write(`: still here

`), 20000);
    req.on("close", () => {
      clearInterval(beat);
      if (!clients.delete(client))
        return;
      lastActivity = Date.now();
      o.log(`stage closed (${clients.size} left)`);
      if (!clients.size) {
        queue = [];
        if (current) {
          clearTimeout(current.timer);
          current = null;
        }
      } else if (current)
        done(current.song.id);
    });
    pump();
  }
  async function handle(req, res) {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${o.port}`);
    const origin = req.headers.origin;
    const fromPage = !origin || [...self, ...devStage].includes(origin);
    const cors = origin && devStage.includes(origin) ? { "access-control-allow-origin": origin } : {};
    if (url.pathname === "/events" || url.pathname === "/stage") {
      if (!fromPage) {
        res.writeHead(403);
        return void res.end("forbidden");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, { ...cors, "access-control-allow-headers": "content-type" });
        return void res.end();
      }
      if (url.pathname === "/events")
        return listen(req, res, cors);
      let m;
      try {
        m = JSON.parse(await readBody(req));
      } catch {
        res.writeHead(400, cors);
        return void res.end();
      }
      lastActivity = Date.now();
      if (m.client === primary()?.id) {
        if (m.type === "report") {
          const { client: _c, type: _t, ...rest } = m;
          o.log(`stage: ${JSON.stringify(rest)}`);
        } else if (m.type === "ended")
          done(m.id);
        else if (m.type === "error") {
          o.log(`stage could not sing song ${m.id}: ${m.message}`);
          done(m.id);
        }
      }
      res.writeHead(204, cors);
      return void res.end();
    }
    if (req.method === "POST") {
      if (origin && !self.includes(origin)) {
        res.writeHead(403);
        return void res.end("forbidden");
      }
      lastActivity = Date.now();
      let body = {};
      try {
        const text = await readBody(req);
        if (text.trim())
          body = JSON.parse(text);
      } catch {
        return json(res, { ok: false, issues: [{ level: "error", message: "the request body is not JSON" }] }, 400);
      }
      switch (url.pathname) {
        case "/sing": {
          const reply = sing(body);
          return json(res, reply, reply.ok ? 200 : 422);
        }
        case "/stop":
          stopAll();
          return json(res, { ok: true });
        case "/voice":
          return json(res, { ok: true, voice: writeSettings({ body: String(body.body ?? ""), style: String(body.style ?? "") }).voice });
        case "/shutdown":
          setTimeout(() => stop(), 50);
          return json(res, { ok: true });
      }
      return json(res, { ok: false }, 404);
    }
    if (url.pathname === "/health") {
      const st = readSettings();
      const h = { ok: true, pid: process.pid, windows: clients.size, queue: queue.length, singing: current !== null, voice: st.voice, auto: st.auto, build: BUILD };
      return json(res, h);
    }
    file(url.pathname, res);
  }
  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent)
        res.writeHead(500);
      res.end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(o.port, "127.0.0.1", () => resolve());
  });
  const idle = o.idleMinutes ? setInterval(() => {
    if (!clients.size && !queue.length && Date.now() - lastActivity > o.idleMinutes * 60000) {
      o.log("idle: stopping");
      stop();
    }
  }, 30000) : null;
  let down = false;
  let whenDown = () => {};
  const stopped = new Promise((r) => whenDown = r);
  function stop() {
    if (down)
      return;
    down = true;
    if (idle)
      clearInterval(idle);
    stopAll();
    for (const ws of clients)
      ws.send({ type: "retire" });
    server.close();
    server.closeAllConnections?.();
    whenDown();
  }
  o.log(`chimera-sing daemon (${BUILD}) on http://127.0.0.1:${o.port}/`);
  return { port: o.port, stop, stopped };
}

// agent/daemon/main.ts
var arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
try {
  const d = await startDaemon({
    port: Number(arg("--port")) || port(),
    open: !process.argv.includes("--no-open") && process.env.CHIMERA_SING_OPEN !== "0",
    idleMinutes: Number(arg("--idle-minutes") ?? 30),
    stageDir: STAGE_DIR,
    log: (line) => console.log(`${new Date().toISOString()} ${line}`)
  });
  d.stopped.then(() => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
