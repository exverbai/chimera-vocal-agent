/**
 * End to end, headless: a daemon on a spare port, a song posted before any window exists, then a
 * browser opens the stage. Checks that the song is heard from its first word to its last, in
 * order, and that the daemon goes quiet afterwards.
 *   bun packages/stage/tools/e2e.ts [score.json] [screenshot.png]
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startDaemon } from "../../daemon/src/server.ts";
import { ROOT, STAGE_DIST } from "../../core/src/paths.ts";

const PORT = 5397;
const base = `http://127.0.0.1:${PORT}`;
const score = readFileSync(process.argv[2] ?? join(ROOT, "examples/air.json"), "utf8");
const shot = process.argv[3];
const logs: string[] = [];
const daemon = await startDaemon({ port: PORT, open: false, idleMinutes: 0, stageDir: STAGE_DIST, log: (l) => logs.push(l) });

const posted = await (await fetch(base + "/sing", { method: "POST", body: JSON.stringify({ score }) })).json();
if (!posted.ok) throw new Error(JSON.stringify(posted.issues));

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 520, height: 760 } });
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(base + "/");
await page.waitForFunction(() => (window as any).__stage, null, { timeout: 15000 });

const words: string[] = [];
/** per word at the mouth: the loudest level heard while it was shown */
const level = new Map<string, number>();
let peak = 0, firstSound = -1, sang = false, n = 0;
while (Date.now() - t0 < (posted.seconds + 12) * 1000) {
  const s = await page.evaluate(() => {
    const st = (window as any).__stage;
    let p = 0;
    if (st.engine.analyserFast) {
      const buf = new Float32Array(2048);
      st.engine.analyserFast.getFloatTimeDomainData(buf);
      for (const x of buf) p = Math.max(p, Math.abs(x));
    }
    return { singing: st.singing(), peak: p, word: st.sungNow()?.text ?? null };
  });
  n++;
  peak = Math.max(peak, s.peak);
  if (s.peak > 0.02 && firstSound < 0) firstSound = Date.now() - t0;
  if (s.word) {
    if (words.at(-1) !== s.word) words.push(s.word);
    level.set(s.word, Math.max(level.get(s.word) ?? 0, s.peak));
  }
  if (s.singing) sang = true;
  if (shot && sang && n % 60 === 0) await page.screenshot({ path: shot });
  if (sang && !s.singing) break;
  await page.waitForTimeout(40);
}
await page.waitForTimeout(300);
const health = await (await fetch(base + "/health")).json();
const silent = words.filter((w) => (level.get(w) ?? 0) < 0.02);
const result = {
  lyrics: posted.lyrics,
  wordsAtMouth: words.join(" "),
  silentWords: silent,
  peak: +peak.toFixed(3),
  firstSoundMs: firstSound,
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
  daemon: { singing: health.singing, queue: health.queue, windows: health.windows },
  errors,
  logs,
};
console.log(JSON.stringify(result, null, 1));
await browser.close();
daemon.stop();
const ok = peak > 0.05 && !errors.length && !silent.length && words.length >= posted.notes * 0.8 && !health.singing && health.windows === 1;
process.exit(ok ? 0 : 1);
