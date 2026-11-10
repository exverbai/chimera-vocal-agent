/**
 * One-time setup of a checkout: the engine (prebuilt unless you built your own), the stage page,
 * the plugin's bundles, and the pointer that lets installed plugin copies find this checkout.
 *   bun run setup
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CHIMERA, PREBUILT_WASM, rememberRoot, ROOT } from "../packages/core/src/paths.ts";

const run = (cmd: string[]) => {
  const r = Bun.spawnSync(cmd, { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
  if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed`);
};

if (!existsSync(join(CHIMERA, "src/wasm/chimera.ts"))) run(["git", "submodule", "update", "--init", "--recursive"]);
const wasm = join(CHIMERA, "src/wasm/chimera.wasm");
if (!existsSync(wasm)) {
  copyFileSync(PREBUILT_WASM, wasm);
  console.log("engine: using prebuilt/chimera.wasm (run `bun run wasm` to build your own; needs Rust)");
}
if (!existsSync(join(ROOT, "node_modules"))) run(["bun", "install"]);
run(["bun", "run", "build"]);
rememberRoot();
console.log(`\nReady. Try: bun run sing examples/air.json\nThis checkout is now the home of every installed chimera-sing plugin: ${ROOT}`);
