/**
 * Sings a melody live on upstream's engine, the way its Sing mode plays a demo song
 * (vendor/chimera/src/ui/singing.ts `playDemo`), but for any melody and with rests
 * (as `chimera render notes` does: a rest splits the melody into separately planned phrases).
 *
 * A melody is upstream's own file format: {"bpm", "lyrics", "notes": [[midi, beats], ...]},
 * one lyric syllable per sounding note, a note with midi <= 0 is a rest.
 */
import { engine } from "@chimera/audio/AudioEngine.ts";
import { lyricsToSyllables, planSong } from "@chimera/wasm/engine.ts";
import type { Gesture, PlannedSegment, SungNote, Syllable } from "@chimera/wasm/types.ts";
import { g2p } from "@chimera/ui/speech.ts";
import { roll } from "@chimera/ui/singing.ts";
import { useStore } from "@chimera/ui/store.ts";
import { PRESETS, sameBody, type BodyMix } from "@chimera/ui/body.ts";

export interface Melody {
  bpm: number;
  lyrics: string;
  notes: [number, number][];
  vibrato?: number;
  body?: "male" | "female" | "child" | BodyMix;
  title?: string;
}

interface Run {
  id: number;
  /** each sounding note's [start, end) in plan time (s) */
  times: [number, number][];
  midi: number[];
  text: string[];
  /** what is written at the mouth for each note */
  shown: string[];
  /** index of the note whose syllable a melisma continues */
  parent: number[];
  end: number;
  /** voice-clock time of the plan's time 0, once the worklet confirms */
  offset: number | null;
  done: (how: "ended" | "stopped") => void;
}

let run: Run | null = null;
/** bumped by every stop: a song still waiting for audio or the dictionary then gives up */
let token = 0;

const now = () => engine.voiceClock() ?? 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** silence before the first song of a window (ms) */
const FIRST_SONG_LEAD = 500;
const written = (s: Syllable) => s.text + (s.wordEnd ? "" : "-");

engine.onPlanned((m) => {
  const r = run;
  if (!r || m.id !== r.id) return;
  r.offset = m.t0;
  r.times.forEach(([a, b], k) => roll.notes.push({ midi: r.midi[k], t0: m.t0 + a, t1: m.t0 + b - 0.02, text: r.text[k], demo: true }));
  if (roll.notes.length > 400) roll.notes = roll.notes.slice(-400);
});

/** The syllable being sung now, for the words at the mouth. */
export function sungNow(): { key: unknown; text: string } | null {
  const r = run;
  if (!r || r.offset === null) return null;
  const t = now() - r.offset;
  const k = r.times.findIndex(([a, b]) => t >= a && t < b);
  return k < 0 ? null : { key: `${r.id}:${r.parent[k]}`, text: r.shown[k] };
}

export function bodyOf(b: Melody["body"]): BodyMix | null {
  if (!b) return null;
  return typeof b === "string" ? (PRESETS[b] ?? null) : b;
}

/** Stop the song being sung (or still loading). */
export function stop(): void {
  token++;
  const r = run;
  if (!r) return;
  run = null;
  engine.stopSpeech();
  const t = now();
  roll.notes = roll.notes.filter((n) => !(n.demo && n.t0 > t));
  for (const n of roll.notes) if (n.demo && n.t1 !== null && n.t1 > t) n.t1 = t;
  r.done("stopped");
}

/** Called every frame: ends the run once its last note has been heard. */
export function tick(): void {
  const r = run;
  if (!r || r.offset === null) return;
  if (now() - r.offset > r.end + 0.4) {
    run = null;
    r.done("ended");
  }
}

/**
 * Sing `m`. Resolves when the song has been heard ("ended") or was cut ("stopped");
 * rejects when the melody cannot be sung (the message says how to fix it).
 */
export async function sing(m: Melody): Promise<"ended" | "stopped"> {
  stop();
  const mine = token;
  const fresh = !useStore.getState().started;
  await useStore.getState().start();
  try {
    await g2p.load();
  } catch {
    // no dictionary: the letter-to-sound rules still work
  }
  if (mine !== token) return "stopped";

  const body = bodyOf(m.body) ?? useStore.getState().body;
  if (!sameBody(body, useStore.getState().body)) useStore.getState().setBody(body);
  // A new body rebuilds the voice and restarts its clock: wait until the worklet reports that
  // body, or the song's first notes are planned against the old clock and lost. A just-opened
  // output device also swallows its first moments (Windows, Bluetooth), so the first song of
  // a window waits a little longer.
  const until = performance.now() + 1500;
  while (!(engine.latest && sameBody(engine.latest.body, body)) && performance.now() < until) await sleep(20);
  if (fresh) await sleep(FIRST_SONG_LEAD);
  if (mine !== token) return "stopped";

  const syl = lyricsToSyllables(m.lyrics);
  const sounding = m.notes.filter((n) => n[0] > 0).length;
  if (!sounding) throw new Error("the melody has no notes");
  if (syl.length !== sounding) throw new Error(`${syl.length} syllables for ${sounding} notes: ${syl.map((s) => s.text).join(" ")}`);

  const beat = 60 / m.bpm;
  const vibrato = m.vibrato ?? 35;
  const gestures: Gesture[] = [];
  const segments: PlannedSegment[] = [];
  const times: [number, number][] = [];
  const sung: SungNote[] = [];
  let end = 0;
  let t = 0.35;
  let k = 0;
  let phrase: SungNote[] = [];
  let start = t;
  const flush = () => {
    if (!phrase.length) return;
    const plan = planSong(phrase, { body, bpm: m.bpm, t0: start, vibrato });
    gestures.push(...plan.gestures);
    segments.push(...plan.segments);
    end = Math.max(end, plan.end);
    phrase = [];
  };
  for (const [midi, beats] of m.notes) {
    if (midi > 0) {
      if (!phrase.length) start = t;
      const note = { midi, beats, syl: syl[k++] };
      phrase.push(note);
      sung.push(note);
      times.push([t, t + beats * beat]);
    } else flush();
    t += beats * beat;
  }
  flush();

  const parent: number[] = [];
  sung.forEach((n, i) => parent.push(n.syl.melisma && i > 0 ? parent[i - 1] : i));
  const shown = parent.map((p) => written(sung[p].syl));

  return new Promise((done) => {
    const id = engine.schedule({ gestures, segments, end });
    run = { id, times, midi: sung.map((n) => n.midi), text: sung.map((n) => n.syl.text), shown, parent, end, offset: null, done };
  });
}

export const singing = () => run !== null;
