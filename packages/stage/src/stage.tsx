/**
 * The stage: one head that sings whatever melody the daemon hands it (link.ts). `?hello` sings a
 * built-in melody on load; `window.__stage` is a handle for tests and the console.
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { engine } from "@chimera/audio/AudioEngine.ts";
import { useStore } from "@chimera/ui/store.ts";
import { AnatomyView3D } from "@chimera/ui/components/AnatomyView3D.tsx";
import { PianoRoll } from "@chimera/ui/components/PianoRoll.tsx";
import { Screen } from "@chimera/ui/components/Screen.tsx";
import { mouthWords } from "@chimera/ui/mouthWords.ts";
import { V } from "@chimera/ui/colors.ts";
import { bodyLabel } from "@chimera/ui/body.ts";
import { sing, stop, sungNow, tick, singing, type Melody } from "./player.ts";
import { connect } from "./link.ts";

const words = mouthWords(sungNow, V.green);

/** an original tune for the first run */
const HELLO: Melody = {
  title: "Hello",
  bpm: 96,
  body: "female",
  lyrics: "Hello there, I am your agent. Now I sing everything.",
  notes: [
    [64, 1], [67, 1], [69, 2], [0, 0.5],
    [67, 0.5], [65, 0.5], [64, 0.5], [62, 1], [60, 1.5], [0, 1],
    [60, 0.5], [62, 0.5], [64, 1], [65, 0.5], [64, 0.5], [60, 2],
  ],
};

type Status = "idle" | "loading" | "singing" | "error";

/** the latest request: an earlier song cut short by it must not touch the status line */
let latest = 0;
/** ?hello sings once, also when React runs the effect twice in development */
let greeted = false;

function Stage() {
  const started = useStore((s) => s.started);
  const body = useStore((s) => s.body);
  const [status, setStatus] = useState<Status>("idle");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [linked, setLinked] = useState(false);
  const [retired, setRetired] = useState(false);

  useEffect(() => {
    const play = async (m: Melody) => {
      const mine = ++latest;
      setError(null);
      setTitle(m.title ?? "");
      setStatus("loading");
      // audio that needs a click never resolves start(): say so instead of waiting silently
      const hint = setTimeout(() => setBlocked(!useStore.getState().started), 600);
      try {
        const p = sing(m);
        setStatus("singing");
        const how = await p;
        if (mine === latest) setStatus("idle");
        return how;
      } catch (e) {
        if (mine === latest) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
        throw e;
      } finally {
        clearTimeout(hint);
      }
    };
    (window as unknown as { __stage: unknown }).__stage = { sing: play, stop, singing, engine, sungNow };
    const unlink = connect({ sing: play, stop, state: setLinked, retired: () => setRetired(true) });
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    if (!greeted && new URLSearchParams(location.search).has("hello")) {
      greeted = true;
      void play(HELLO).catch(() => {});
    }
    return () => {
      cancelAnimationFrame(raf);
      unlink();
    };
  }, []);

  useEffect(() => {
    if (started) setBlocked(false);
  }, [started]);

  return (
    <main className="duet stage">
      <header className="duet-top">
        <span className="duet-title">{title || "CHIMERA stage"}</span>
        <span className="stage-status">{error ?? (status === "singing" ? "Singing" : status === "loading" ? "Loading" : retired ? "Another window is singing: close this one" : linked ? "Waiting for a song" : "No agent connected")}</span>
      </header>
      <div className="duet-heads">
        <Screen className="duet-head" focus title="Voice" sub={bodyLabel(body)} label="The singing voice, in 3D">
          <AnatomyView3D readouts={false} overlay={words} />
        </Screen>
      </div>
      <Screen className="stage-roll" title="Notes" sub="As sung">
        <PianoRoll />
      </Screen>
      {blocked && (
        <div className="stage-unlock">
          <button className="primary large" onClick={() => void engine.ctx?.resume()}>
            Click to let it sing
          </button>
        </div>
      )}
    </main>
  );
}

export function mount(root: HTMLElement): void {
  useStore.getState().setMode("sing");
  root.replaceChildren();
  createRoot(root).render(
    <StrictMode>
      <Stage />
    </StrictMode>,
  );
}
