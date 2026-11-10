/**
 * The CHIMERA engine in Bun, for what the daemon needs off the audio path: turning lyrics into
 * syllables with the pronouncing dictionary (the same call the stage page makes before it sings).
 * Loaded the way upstream's tools/musicxml-to-notes.ts loads it.
 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { CHIMERA, PREBUILT_WASM } from "./paths.ts";

export interface Syl {
  text: string;
  /** 0 unstressed, 1 primary, 2 secondary */
  stress: number;
  melisma: boolean;
  wordEnd: boolean;
  phraseEnd: boolean;
}

export interface Engine {
  syllables(text: string): Syl[];
}

let loading: Promise<Engine> | null = null;

export function loadEngine(): Promise<Engine> {
  loading ??= (async () => {
    const built = join(CHIMERA, "src/wasm/chimera.wasm");
    const wasm = existsSync(built) ? built : PREBUILT_WASM;
    const { initChimera } = await import(join(CHIMERA, "src/wasm/chimera.ts"));
    await initChimera(readFileSync(wasm));
    // engine.ts reads the engine's catalog when it is imported: only after initChimera
    const up = await import(join(CHIMERA, "src/wasm/engine.ts"));
    new up.EnglishG2P().setDictionaryText(gunzipSync(readFileSync(join(CHIMERA, "public/data/cmudict.txt.gz"))).toString());
    return {
      syllables: (text: string) =>
        (up.lyricsToSyllables(text) as { text: string; nucleus: { stress?: number }; melisma?: boolean; wordEnd: boolean; phraseEnd: boolean }[]).map((s) => ({
          text: s.text,
          stress: s.nucleus.stress ?? 0,
          melisma: !!s.melisma,
          wordEnd: s.wordEnd,
          phraseEnd: s.phraseEnd,
        })),
    };
  })();
  return loading;
}
