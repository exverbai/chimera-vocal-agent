import { beforeAll, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEngine, type Engine } from "../src/engine.ts";
import { compile, numberWords, parsePitch } from "../src/score.ts";
import { ROOT } from "../src/paths.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

const errors = (c: ReturnType<typeof compile>) => c.issues.filter((i) => i.level === "error").map((i) => i.message);
const warnings = (c: ReturnType<typeof compile>) => c.issues.filter((i) => i.level === "warning").map((i) => i.message);

test("pitches: names, accidentals, MIDI numbers and rests", () => {
  expect(parsePitch("C4")).toBe(60);
  expect(parsePitch("F#3")).toBe(54);
  expect(parsePitch("Bb4")).toBe(70);
  expect(parsePitch(67)).toBe(67);
  expect(parsePitch("-")).toBe(0);
  expect(parsePitch("rest")).toBe(0);
  expect(parsePitch("H2")).toBeNull();
});

test("numbers are spelled out", () => {
  expect(numberWords(42)).toBe("forty two");
  expect(numberWords(300)).toBe("three hundred");
  expect(numberWords(1234)).toBe("one thousand two hundred thirty four");
});

test("every example compiles without errors or warnings, to one syllable per note", () => {
  const dir = join(ROOT, "examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  expect(files.length).toBeGreaterThanOrEqual(3);
  for (const f of files) {
    const c = compile(readFileSync(join(dir, f), "utf8"), engine);
    expect({ f, issues: c.issues }).toEqual({ f, issues: [] });
    expect(c.ok).toBe(true);
    expect(engine.syllables(c.melody!.lyrics).length).toBe(c.melody!.notes.filter((n) => n[0] > 0).length);
  }
});

test("a score compiles to upstream's melody: joined words, holds, rests, phrase ends", () => {
  const c = compile({ bpm: 120, body: "female", notes: [["E4", 1, "an-"], ["F4", 1, "y-"], ["G4", 1, "where,"], ["-", 1], ["A4", 2, "ah"], ["G4", 1, "-"], ["E4", 1]] }, engine);
  expect(errors(c)).toEqual([]);
  expect(c.melody!.lyrics).toBe("anywhere , ah - -");
  expect(c.melody!.notes).toEqual([[64, 1], [65, 1], [67, 1], [0, 1], [69, 2], [67, 1], [64, 1]]);
  expect(c.seconds).toBeCloseTo(0.35 + 8 * 0.5 + 0.4, 5);
});

test("a word with more syllables than notes has its last note split, with a warning", () => {
  const c = compile({ bpm: 100, notes: [["E4", 2, "everything"]] }, engine);
  expect(c.ok).toBe(true);
  expect(c.melody!.notes.length).toBe(3);
  expect(c.melody!.notes.every((n) => n[0] === 64)).toBe(true);
  expect(c.melody!.notes.reduce((t, n) => t + n[1], 0)).toBeCloseTo(2, 9);
  expect(warnings(c)[0]).toContain("3 syllables");
});

test("a word with fewer syllables than notes holds its last vowel", () => {
  const c = compile({ bpm: 100, notes: [["E4", 1, "ye-"], ["F4", 1, "s"]] }, engine);
  expect(c.ok).toBe(true);
  expect(c.melody!.lyrics).toBe("yes -");
  expect(warnings(c).length).toBe(1);
});

test("several words on one note share it; digits are sung as words", () => {
  const c = compile({ bpm: 100, notes: [["E4", 2, "I am"], ["G4", 2, "42"]] }, engine);
  expect(c.ok).toBe(true);
  expect(c.melody!.lyrics).toBe("I am forty two");
  expect(c.melody!.notes).toEqual([[64, 1], [64, 1], [67, 0.5], [67, 0.5], [67, 1]]);
});

test("a ready melody is checked: syllables must match notes", () => {
  expect(compile({ bpm: 90, lyrics: "hello there", notes: [[60, 1], [62, 1], [64, 1]] }, engine).ok).toBe(true);
  const bad = compile({ bpm: 90, lyrics: "hello there", notes: [[60, 1], [62, 1]] }, engine);
  expect(bad.ok).toBe(false);
  expect(errors(bad)[0]).toContain("3 syllables for 2 notes");
});

test("errors say how to fix the score", () => {
  expect(errors(compile("{nope", engine))[0]).toContain("not valid JSON");
  expect(errors(compile({ bpm: 500, notes: [["C4", 1, "la"]] }, engine))[0]).toContain("between 30 and 240");
  expect(errors(compile({ notes: [["X9", 1, "la"]] }, engine))[0]).toContain("cannot read the pitch");
  expect(errors(compile({ notes: [["C4", 0, "la"]] }, engine))[0]).toContain("beats must be");
  expect(errors(compile({ notes: [["C4", 1, "!!!"]] }, engine))[0]).toContain("nothing to sing");
  expect(errors(compile({ notes: [["-", 1]] }, engine))[0]).toContain("no notes");
  expect(errors(compile({ bpm: 60, notes: Array(60).fill(["C4", 1, "la"]) }, engine))[0]).toContain("keep it under");
});

test("a melody outside the voice's comfortable range is a warning, not an error", () => {
  const c = compile({ body: "male", notes: [["C6", 1, "la"]] }, engine);
  expect(c.ok).toBe(true);
  expect(warnings(c)[0]).toContain("comfortable");
});
