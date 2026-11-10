import { beforeAll, expect, test } from "bun:test";
import { loadEngine, type Engine } from "../src/engine.ts";
import { melodize } from "../src/melodize.ts";
import { compile, RANGES } from "../src/score.ts";
import { plainText, singable } from "../src/text.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

const REPLY = `## Done

I fixed the **race** in \`src/stage.tsx\` and added 3 tests; see [the docs](https://example.com/x).

\`\`\`ts
const x = 1;
\`\`\`

- The status line no longer says "Waiting" mid-song.
- Nothing is committed yet. Shall I commit?`;

test("plain text: no code, markup, paths or links; numbers as words", () => {
  const t = plainText(REPLY);
  expect(t).toBe("Done. I fixed the race in and added three tests; see the docs. The status line no longer says Waiting mid song. Nothing is committed yet. Shall I commit?");
  expect(t).toMatch(/^[A-Za-z' .,;:!?]+$/);
});

test("the excerpt stops at a sentence end near the word limit", () => {
  expect(singable(REPLY, { maxWords: 16 })).toBe("Done. I fixed the race in and added three tests; see the docs.");
  expect(singable("one two three four five six", { maxWords: 3 })).toBe("one two three.");
  expect(singable("A git hook is a script that Git runs at specific points in its workflow, such as before a commit.", { maxWords: 18 })).toBe("A git hook is a script that Git runs at specific points in its workflow.");
  expect(singable("```\ncode only\n```")).toBe("");
});

test("a melody from text always compiles, for every style and body", () => {
  const texts = [REPLY, "Yes.", "Is it done? Not yet, but soon!", "The API's WebSocket daemon re-validated 1,024 JSON files: fine.", "don't stop, it's fine; we're nearly there"];
  for (const text of texts)
    for (const style of ["tune", "chant"] as const)
      for (const body of ["male", "female", "child"] as const) {
        const m = melodize(text, engine, { style, body });
        expect(m).not.toBeNull();
        const c = compile(m, engine);
        expect({ text, style, body, issues: c.issues.filter((i) => i.level === "error") }).toEqual({ text, style, body, issues: [] });
        const [lo, hi] = RANGES[body];
        for (const [midi] of m!.notes) if (midi > 0) expect(midi >= lo && midi <= hi).toBe(true);
      }
});

test("the same text gets the same tune; statements come home, questions rise", () => {
  const a = melodize("The build is green.", engine)!;
  expect(melodize("The build is green.", engine)).toEqual(a);
  expect(a.notes.at(-1)![0]).toBe(60);
  const q = melodize("Is the build green?", engine)!;
  expect(q.notes.at(-1)![0]).toBeGreaterThan(q.notes.at(-2)![0]);
});

test("text with nothing to sing gives no melody", () => {
  expect(melodize("```\nls -la\n```", engine)).toBeNull();
  expect(melodize("  ", engine)).toBeNull();
});
