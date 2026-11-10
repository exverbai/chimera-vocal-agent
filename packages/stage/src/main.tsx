/**
 * Entry: the engine (wasm) loads first, because upstream's UI modules call into it as they load.
 */
import "@chimera/ui/styles.css";
import "./stage.css";
import { initChimera } from "@chimera/wasm/chimera.ts";

const root = document.getElementById("root")!;

async function boot(): Promise<void> {
  try {
    await initChimera();
  } catch (err) {
    root.textContent = `The voice engine could not load: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  const { mount } = await import("./stage.tsx");
  mount(root);
}

void boot();
