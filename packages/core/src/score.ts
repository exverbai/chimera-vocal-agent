/**
 * The score an agent writes, and its compiler to the melody CHIMERA sings.
 *
 * Score (one lyric syllable per note; the per-note lyric idea is GottZ/hermes-chimera's):
 *   {"bpm": 96, "body": "female", "notes": [["E4", 1, "Breathe"], ["C4", 1, "in,"],
 *     ["D4", 0.5, "an-"], ["E4", 0.5, "y-"], ["G4", 2, "where."], ["-", 1]]}
 *   - pitch: a note name ("C4" is middle C, "F#3", "Bb4") or a MIDI number; "-" is a rest
 *   - lyric: one syllable; a trailing hyphen continues the word on the next note; "-" (or no
 *     lyric) holds the previous vowel on the new pitch; , . ; : ! ? end the phrase
 *
 * Melody (upstream's `chimera render notes` file, which the stage sings):
 *   {"bpm", "lyrics", "notes": [[midi, beats], ...]}, a note with midi 0 is a rest.
 *
 * The engine's dictionary decides how many syllables a word has, so a word is joined back up
 * and counted by the engine (as upstream's tools/musicxml-to-notes.ts does). Where the score
 * and the dictionary disagree the compiler repairs the score and says so in a warning, instead
 * of sending the agent round again: too few notes for a word splits its last note, too many
 * holds the last vowel.
 */
import type { Engine } from "./engine.ts";

export type BodyName = "male" | "female" | "child";
export type Body = BodyName | { female: number; child: number };

export interface Melody {
  title?: string;
  bpm: number;
  lyrics: string;
  notes: [number, number][];
  vibrato?: number;
  body?: Body;
}

export interface Issue {
  level: "error" | "warning";
  /** index of the score note it is about */
  note?: number;
  message: string;
}

export interface Compiled {
  ok: boolean;
  melody?: Melody;
  /** length of the song (s), with the lead-in */
  seconds: number;
  /** sounding notes */
  notes: number;
  issues: Issue[];
}

export interface Limits {
  maxSeconds: number;
}

export const DEFAULT_LIMITS: Limits = { maxSeconds: 45 };

/** comfortable ranges (MIDI), after hermes-chimera's table; outside them the voice strains */
export const RANGES: Record<BodyName, [number, number]> = { male: [38, 69], female: [53, 84], child: [57, 81] };
/** what the engine will sing at all */
const HARD: [number, number] = [28, 100];
const LEAD = 0.35;
const TAIL = 0.4;

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const noteName = (midi: number) => `${NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;

/** A pitch as MIDI: 0 for a rest, null when it cannot be read. */
export function parsePitch(p: unknown): number | null {
  if (p === null || p === undefined) return 0;
  if (typeof p === "number") return Number.isFinite(p) ? (p <= 0 ? 0 : p) : null;
  if (typeof p !== "string") return null;
  const s = p.trim();
  if (s === "" || s === "-" || s === "_" || /^(r|rest)$/i.test(s)) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^([A-Ga-g])([#♯b♭]?)(-?\d)$/);
  if (!m) return null;
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + STEP[m[1].toUpperCase()] + acc;
}

export function parseBody(b: unknown): Body | null {
  if (b === "male" || b === "female" || b === "child") return b;
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    const f = Number(o.female ?? 0), c = Number(o.child ?? 0);
    if (Number.isFinite(f) && Number.isFinite(c)) return { female: Math.min(1, Math.max(0, f)), child: Math.min(1, Math.max(0, c)) };
  }
  return null;
}

interface Item {
  index: number;
  midi: number;
  beats: number;
  lyric: string | null;
}

/** [pitch, beats, lyric?] | {pitch, beats, lyric?} | {rest: beats} → an item, or an error text */
function readItem(raw: unknown, index: number): Item | string {
  let pitch: unknown, beats: unknown, lyric: unknown;
  if (Array.isArray(raw)) [pitch, beats, lyric] = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if ("rest" in o) [pitch, beats] = [0, o.rest];
    else [pitch, beats, lyric] = [o.pitch ?? o.midi, o.beats, o.lyric ?? o.syllable ?? o.text];
  } else return `note ${index + 1}: write a note as ["E4", 1, "word"] and a rest as ["-", 1]`;
  const midi = parsePitch(pitch);
  if (midi === null) return `note ${index + 1}: cannot read the pitch ${JSON.stringify(pitch)}; use a name like "C4" or "F#3", a MIDI number, or "-" for a rest`;
  const b = Number(beats);
  if (!Number.isFinite(b) || b <= 0) return `note ${index + 1}: beats must be a number above 0, not ${JSON.stringify(beats)}`;
  if (b > 16) return `note ${index + 1}: ${b} beats is too long for one note (16 at most)`;
  if (lyric !== undefined && lyric !== null && typeof lyric !== "string") return `note ${index + 1}: the lyric must be text`;
  return { index, midi, beats: b, lyric: typeof lyric === "string" ? lyric : null };
}

const PUNCT = /[.,;:!?]+$/;
const isHold = (l: string | null) => l === null || /^\s*[-~_]?\s*$/.test(l);

/** small numbers as words, so "3 files" can be sung */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999999) return String(n).split("").map((d) => (/\d/.test(d) ? ONES[Number(d)] : d === "." ? "point" : "")).filter(Boolean).join(" ");
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numberWords(n % 100) : "");
  return numberWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numberWords(n % 1000) : "");
}

/** Compile a score (or check a ready melody) into the melody the stage sings. */
export function compile(input: unknown, engine: Engine, limits: Limits = DEFAULT_LIMITS): Compiled {
  const issues: Issue[] = [];
  const err = (message: string, note?: number) => void issues.push({ level: "error", message, note });
  const warn = (message: string, note?: number) => void issues.push({ level: "warning", message, note });
  const fail = (): Compiled => ({ ok: false, seconds: 0, notes: 0, issues });

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
  const s = input as Record<string, unknown>;
  const bpm = Number(s.bpm ?? 96);
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 240) err(`bpm must be between 30 and 240, not ${JSON.stringify(s.bpm)}`);
  let body: Body | undefined;
  if (s.body !== undefined && s.body !== null) {
    const b = parseBody(s.body);
    if (!b) err(`body must be "male", "female" or "child", not ${JSON.stringify(s.body)}`);
    else body = b;
  }
  const vibrato = s.vibrato === undefined ? undefined : Number(s.vibrato);
  if (vibrato !== undefined && !(vibrato >= 0 && vibrato <= 100)) err("vibrato is in cents, 0 to 100");
  if (!Array.isArray(s.notes) || !s.notes.length) {
    err('the score needs "notes": [["E4", 1, "word"], ...]');
    return fail();
  }

  const items: Item[] = [];
  s.notes.forEach((raw, i) => {
    const it = readItem(raw, i);
    if (typeof it === "string") err(it, i);
    else items.push(it);
  });
  if (issues.some((i) => i.level === "error")) return fail();

  const out: [number, number][] = [];
  const tokens: string[] = [];
  const count = (word: string) => engine.syllables(word).filter((x) => !x.melisma).length;

  if (typeof s.lyrics === "string") {
    // a ready melody: lyrics as one text, notes without their own
    for (const it of items) out.push([it.midi, it.beats]);
    tokens.push(s.lyrics.replace(/\d+(\.\d+)?/g, (d) => numberWords(Number(d))));
  } else {
    /** the word being collected: its pieces' notes (indices into out), and holds between them */
    let word: { text: string; notes: number[]; holds: number; first: number; punct: string } | null = null;
    let sung = false;

    const finish = () => {
      const w = word;
      word = null;
      if (!w) return;
      const joined = w.text.replace(/[^A-Za-z']/g, "");
      if (!/[A-Za-z]/.test(joined)) return err(`the lyric ${JSON.stringify(w.text)} has nothing to sing: write words, with numbers spelled out`, w.first);
      const n = count(joined);
      if (!n) return err(`cannot pronounce ${JSON.stringify(joined)}: respell it the way it sounds`, w.first);
      let holds = w.holds;
      if (holds) warn(`a held note inside "${joined}" moved to the word's end`, w.first);
      if (n < w.notes.length) {
        holds += w.notes.length - n;
        warn(`"${joined}" is ${n} syllable${n > 1 ? "s" : ""} but has ${w.notes.length} notes: the last vowel is held over the rest`, w.first);
      } else if (n > w.notes.length) {
        // split the word's last note evenly, on its pitch
        const at = w.notes[w.notes.length - 1];
        const parts = n - w.notes.length + 1;
        const [midi, beats] = out[at];
        out.splice(at, 1, ...Array.from({ length: parts }, (): [number, number] => [midi, beats / parts]));
        warn(`"${joined}" is ${n} syllables (${engine.syllables(joined).map((x) => x.text).join("·")}) but has ${w.notes.length} note${w.notes.length > 1 ? "s" : ""}: its last note was split in ${parts}. Give each syllable its own note.`, w.first);
      }
      tokens.push(joined, ...Array<string>(holds).fill("-"));
      if (w.punct) tokens.push(w.punct[0]);
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
        if (word) word.holds++;
        else if (sung) tokens.push("-");
        else {
          tokens.push("ah");
          sung = true;
        }
        continue;
      }
      // several words on one note share it
      // (digits are spelled out first: the engine does not sing them)
      const spelled = it.lyric!.replace(/\d+(\.\d+)?/g, (d) => ` ${numberWords(Number(d))} `).trim();
      const words = spelled.split(/\s+/).filter((x) => !/^[-~_]$/.test(x));
      if (words.length > 1) warn(`note ${it.index + 1} carries ${words.length} words ("${spelled}"): they share its beats. Write one syllable per note.`, it.index);
      for (const piece of words) {
        const cont = piece.length > 1 && /[-_]$/.test(piece);
        const punct = cont ? "" : (piece.match(PUNCT)?.[0] ?? "");
        const text = piece.replace(PUNCT, "").replace(/^[-_]+|[-_]+$/g, "");
        if (!/[A-Za-z]/.test(text)) {
          err(`the lyric ${JSON.stringify(piece)} has nothing to sing: write words, with numbers spelled out`, it.index);
          continue;
        }
        out.push([it.midi, it.beats / words.length]);
        if (!word) word = { text: "", notes: [], holds: 0, first: it.index, punct: "" };
        word.text += text;
        word.notes.push(out.length - 1);
        word.punct = punct;
        if (!cont) finish();
      }
    }
    finish();
  }
  if (issues.some((i) => i.level === "error")) return fail();

  const lyrics = tokens.join(" ");
  const sounding = out.filter((n) => n[0] > 0);
  if (!sounding.length) {
    err("the score has no notes to sing");
    return fail();
  }
  const syl = engine.syllables(lyrics);
  if (syl.length !== sounding.length) {
    err(`${syl.length} syllables for ${sounding.length} notes: ${syl.map((x) => x.text).join(" ")}. Give every syllable one note.`);
    return fail();
  }

  const beat = 60 / bpm;
  const seconds = LEAD + out.reduce((t, n) => t + n[1], 0) * beat + TAIL;
  if (seconds > limits.maxSeconds) err(`the song is ${seconds.toFixed(0)} s long; keep it under ${limits.maxSeconds} s`);
  for (const [midi] of sounding) {
    if (midi < HARD[0] || midi > HARD[1]) {
      err(`${noteName(midi)} is outside what the voice can sing (${noteName(HARD[0])} to ${noteName(HARD[1])})`);
      break;
    }
  }
  if (typeof body === "string" || body === undefined) {
    const [lo, hi] = RANGES[body ?? "female"];
    const low = Math.min(...sounding.map((n) => n[0])), high = Math.max(...sounding.map((n) => n[0]));
    if (low < lo || high > hi) warn(`the melody spans ${noteName(low)} to ${noteName(high)}; the ${body ?? "female"} voice is comfortable from ${noteName(lo)} to ${noteName(hi)}`);
  }
  if (sounding.some((n) => n[1] * beat < 0.09)) warn("some notes are shorter than 0.09 s and will blur: use longer notes or a slower tempo");
  if (issues.some((i) => i.level === "error")) return fail();

  const melody: Melody = { bpm, lyrics, notes: out };
  if (typeof s.title === "string" && s.title.trim()) melody.title = s.title.trim().slice(0, 80);
  if (body) melody.body = body;
  if (vibrato !== undefined) melody.vibrato = vibrato;
  return { ok: true, melody, seconds, notes: sounding.length, issues };
}

/** One line per issue, errors first: what a tool hands back to the model. */
export function issueText(issues: Issue[]): string {
  return [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1)).map((i) => `${i.level}: ${i.message}`).join("\n");
}
