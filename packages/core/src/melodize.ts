/**
 * Auto-melody: plain text → a melody, with no model in the loop, so a reply can be sung the
 * moment it ends. Rhythm follows the words' stress and punctuation; pitch is a walk on a
 * pentatonic scale, seeded by the text (the same text always gets the same tune).
 */
import type { Engine, Syl } from "./engine.ts";
import type { BodyName, Melody } from "./score.ts";
import { singable } from "./text.ts";

export type Style = "tune" | "chant";

export interface MelodizeOptions {
  style?: Style;
  body?: BodyName;
  maxWords?: number;
  title?: string;
}

/** the scale's tonic per body (MIDI): a comfortable middle of each range */
const TONIC: Record<BodyName, number> = { male: 48, female: 60, child: 62 };
/** major pentatonic, as semitones above the tonic, for scale steps -2..7 */
const PENTA = [0, 2, 4, 7, 9];
const pitch = (tonic: number, step: number) => tonic + 12 * Math.floor(step / 5) + PENTA[((step % 5) + 5) % 5];

/** words that pass quickly in speech */
const WEAK = new Set("a an the of to in on at by for from with and or but as is are was were be been am it its this that these those i you he she we they me my your his her our their so if not no do does did have has had will would can could than then there here into up out".split(" "));

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Phrase {
  syls: { stress: boolean; weak: boolean }[];
  /** the mark that ends it */
  end: string;
}

/** The text's phrases, each a run of syllables up to a punctuation mark. */
function phrases(text: string, engine: Engine): Phrase[] {
  const out: Phrase[] = [];
  let cur: Phrase = { syls: [], end: "." };
  for (const tok of text.match(/[A-Za-z']+|[.,;:!?]/g) ?? []) {
    if (/^[.,;:!?]$/.test(tok)) {
      if (cur.syls.length) {
        cur.end = tok;
        out.push(cur);
        cur = { syls: [], end: "." };
      }
      continue;
    }
    const syl: Syl[] = engine.syllables(tok);
    const weak = syl.length === 1 && WEAK.has(tok.toLowerCase());
    for (const s of syl) cur.syls.push({ stress: !weak && s.stress === 1, weak });
  }
  if (cur.syls.length) out.push(cur);
  return out;
}

/** Text (a reply, markdown and all) → a melody. Null when nothing in it can be sung. */
export function melodize(source: string, engine: Engine, opts: MelodizeOptions = {}): Melody | null {
  const style = opts.style ?? "tune";
  const body = opts.body ?? "female";
  const text = singable(source, { maxWords: opts.maxWords ?? 28 });
  const ph = phrases(text, engine);
  if (!ph.length) return null;
  const rand = rng(text);
  const tonic = TONIC[body];
  const chant = style === "chant";
  const bpm = chant ? 152 : 112;
  const [lo, hi] = chant ? [0, 3] : [-1, 6];
  const notes: [number, number][] = [];

  ph.forEach((p, pi) => {
    const n = p.syls.length;
    const last = pi === ph.length - 1;
    const question = p.end === "?";
    const closing = p.end === "." || p.end === "!" || last;
    // where the phrase lands: home for a statement, up for a question, open for a comma
    const target = question ? 3 : closing ? 0 : 2;
    // a chant recites on one tone; a tune starts near home and arches
    let step = chant ? 2 : pi === 0 ? 0 : Math.round(rand() * 2);
    const peak = chant ? 3 : 3 + Math.round(rand() * 3);
    p.syls.forEach((s, i) => {
      const left = n - 1 - i;
      if (left === 0) step = target;
      else if (left === 1 && n > 2) step = question ? target - 1 : target + (rand() < 0.5 || target === lo ? 1 : -1);
      else if (chant) step = s.stress ? 3 : 2;
      else {
        // rise towards the peak over the first half, fall after; stressed syllables lean up
        const rising = i < n / 2;
        const lean = (rising ? 0.62 : 0.3) + (s.stress ? 0.2 : -0.1);
        const r = rand();
        const move = r < lean ? 1 : r < lean + 0.18 ? 0 : -1;
        const jump = s.stress && rand() < 0.15 ? 1 : 0;
        step = Math.min(rising ? peak : hi, Math.max(lo, step + move + (move > 0 ? jump : 0)));
      }
      const beats = left === 0 ? (closing ? 2 : 1.5) : chant ? (s.stress ? 1 : 0.5) : s.weak ? 0.5 : s.stress ? 1 : 0.5;
      notes.push([pitch(tonic, Math.min(hi + 1, Math.max(lo - 1, step))), beats]);
    });
    if (!last) notes.push([0, closing || question ? 1 : 0.5]);
  });

  const melody: Melody = { bpm, lyrics: text, notes, body };
  if (opts.title) melody.title = opts.title;
  return melody;
}
