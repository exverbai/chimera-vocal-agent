import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "../src/server.ts";

// settings and state go to a scratch home, never the user's
const home = mkdtempSync(join(tmpdir(), "chimera-home-"));
process.env.XDG_CONFIG_HOME = join(home, "config");
process.env.XDG_CACHE_HOME = join(home, "cache");
delete process.env.CHIMERA_SING_AUTO;

const PORT = 5388;
const base = `http://127.0.0.1:${PORT}`;
let stop: () => void;
const logs: string[] = [];

beforeAll(async () => {
  const stageDir = mkdtempSync(join(tmpdir(), "stage-"));
  writeFileSync(join(stageDir, "index.html"), "<!doctype html><title>stage</title>");
  ({ stop } = await startDaemon({ port: PORT, open: false, idleMinutes: 0, stageDir, log: (l) => logs.push(l) }));
});
afterAll(() => stop());

const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const SCORE = { bpm: 120, notes: [["C4", 1, "la"], ["D4", 1, "la"]] };

/** a stand-in for the stage page */
function stage(): Promise<{ ws: WebSocket; got: any[]; next: () => Promise<any> }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const got: any[] = [];
    const waiting: ((m: any) => void)[] = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      const w = waiting.shift();
      if (w) w(m);
      else got.push(m);
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello" }));
      resolve({ ws, got, next: () => (got.length ? Promise.resolve(got.shift()) : new Promise((r) => waiting.push(r))) });
    };
  });
}

test("serves the stage page and its health", async () => {
  expect(await (await fetch(base + "/")).text()).toContain("stage");
  expect(await (await fetch(base + "/../../etc/passwd")).text()).toContain("stage");
  const h = await (await fetch(base + "/health")).json();
  expect(h).toMatchObject({ ok: true, windows: 0, queue: 0, singing: false });
});

test("a bad score comes back with its errors and is not queued", async () => {
  const res = await post("/sing", { score: { bpm: 120, notes: [["Z9", 1, "la"]] } });
  expect(res.status).toBe(422);
  const r = await res.json();
  expect(r.ok).toBe(false);
  expect(r.issues[0].message).toContain("cannot read the pitch");
  expect((await (await fetch(base + "/health")).json()).queue).toBe(0);
});

test("a dry run checks without queueing", async () => {
  const r = await (await post("/sing", { score: SCORE, dryRun: true })).json();
  expect(r).toMatchObject({ ok: true, notes: 2, lyrics: "la la" });
  expect((await (await fetch(base + "/health")).json()).queue).toBe(0);
});

test("songs wait for a stage, then play one at a time in order; stop clears the queue", async () => {
  await post("/sing", { score: { ...SCORE, title: "one" } });
  await post("/sing", { text: "Hello there.", title: "two" });
  expect((await (await fetch(base + "/health")).json()).queue).toBe(2);

  const s = await stage();
  const first = await s.next();
  expect(first).toMatchObject({ type: "sing", melody: { title: "one", lyrics: "la la", body: "female" } });
  // the second waits for the first to end
  await Bun.sleep(50);
  expect(s.got.length).toBe(0);
  s.ws.send(JSON.stringify({ type: "ended", id: first.id, how: "ended" }));
  const second = await s.next();
  expect(second).toMatchObject({ type: "sing", melody: { title: "two", lyrics: "Hello there." } });
  expect(second.id).not.toBe(first.id);

  await post("/sing", { score: SCORE });
  await post("/stop", {});
  expect(await s.next()).toEqual({ type: "stop" });
  expect(await (await fetch(base + "/health")).json()).toMatchObject({ queue: 0, singing: false, windows: 1 });

  // replace: cut the song, then sing the new one at once
  await post("/sing", { score: { ...SCORE, title: "a" } });
  expect((await s.next()).melody.title).toBe("a");
  await post("/sing", { score: { ...SCORE, title: "b" }, replace: true });
  expect(await s.next()).toEqual({ type: "stop" });
  expect((await s.next()).melody.title).toBe("b");
  s.ws.close();
  await Bun.sleep(50);
  expect(await (await fetch(base + "/health")).json()).toMatchObject({ windows: 0, singing: false });
});

test("the voice is a shared setting: unknown values are ignored, a new one applies to the next song", async () => {
  expect((await (await post("/voice", { body: "nobody" })).json()).voice).toEqual({ body: "female", style: "tune" });
  expect((await (await post("/voice", { body: "male", style: "chant" })).json()).voice).toEqual({ body: "male", style: "chant" });
  expect(await (await fetch(base + "/health")).json()).toMatchObject({ voice: { body: "male", style: "chant" }, auto: false });
  const s = await stage();
  await post("/sing", { text: "Hello there." });
  expect((await s.next()).melody.body).toBe("male");
  await post("/voice", { body: "female", style: "tune" });
  s.ws.close();
  await Bun.sleep(50);
});

test("a newer stage retires the older one", async () => {
  const a = await stage();
  const b = await stage();
  expect(await a.next()).toEqual({ type: "retire" });
  await post("/sing", { score: SCORE });
  expect((await b.next()).type).toBe("sing");
  expect(a.got.length).toBe(0);
  await post("/stop", {});
  a.ws.close();
  b.ws.close();
  await Bun.sleep(50);
});

test("a web page cannot drive the daemon", async () => {
  expect((await post("/sing", { score: SCORE }, { origin: "https://example.com" })).status).toBe(403);
  expect((await post("/stop", {}, { origin: "https://example.com" })).status).toBe(403);
});
