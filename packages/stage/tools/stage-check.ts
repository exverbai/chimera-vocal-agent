/**
 * Headless check of the stage: loads it with ?hello, waits for the song, and reports whether
 * the voice sounded (peak level, voicing) and the page logged errors.
 *   bun packages/stage/tools/stage-check.ts [url] [screenshot.png]
 */
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://127.0.0.1:5319/?hello";
const shot = process.argv[3];
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 520, height: 760 } });
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => (window as any).__stage, null, { timeout: 15000 });
const t0 = Date.now();
let peak = 0, voiced = 0, frames = 0, sangAt = -1;
let words = new Set<string>();
while (Date.now() - t0 < 14000) {
  const s = await page.evaluate(() => {
    const st = (window as any).__stage;
    const e = st.engine;
    let p = 0;
    if (e.analyserScope) {
      const buf = new Float32Array(2048);
      e.analyserScope.getFloatTimeDomainData(buf);
      for (const x of buf) p = Math.max(p, Math.abs(x));
    }
    return { singing: st.singing(), peak: p, voicing: e.latest?.t.voicing ?? 0, ctx: e.ctx?.state ?? "none", status: document.querySelector(".stage-status")?.textContent };
  });
  frames++;
  peak = Math.max(peak, s.peak);
  if (s.voicing > 0.3) voiced++;
  if (s.peak > 0.02 && sangAt < 0) sangAt = Date.now() - t0;
  words.add(String(s.status));
  if (shot && frames === 40) await page.screenshot({ path: shot });
  if (!s.singing && frames > 20 && sangAt >= 0) break;
  await page.waitForTimeout(100);
}
console.log(JSON.stringify({ peak: +peak.toFixed(3), voicedFrames: voiced, frames, firstSoundMs: sangAt, seconds: (Date.now() - t0) / 1000, statuses: [...words], errors }, null, 1));
await browser.close();
process.exit(peak > 0.02 && !errors.length ? 0 : 1);
