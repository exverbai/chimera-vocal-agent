/**
 * Where things are. The adapters also run as small bundles copied into an agent's plugin cache
 * (plugin/bin/*.js), far from this checkout; they find it again through a pointer file that the
 * daemon and `bun run setup` write.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const isRoot = (dir: string) => existsSync(join(dir, "packages/daemon/src/main.ts"));
const configDir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "chimera-vocal-agent");
const pointer = () => join(configDir(), "home");

/** The checkout: around this file, named by CHIMERA_SING_HOME, or where the pointer says. */
function findRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    if (isRoot(dir)) return dir;
    dir = dirname(dir);
  }
  const env = process.env.CHIMERA_SING_HOME;
  if (env && isRoot(env)) return env;
  try {
    const p = readFileSync(pointer(), "utf8").trim();
    if (p && isRoot(p)) return p;
  } catch {
    // not set up
  }
  return "";
}

/** the repository root ("" when this copy cannot find it) */
export const ROOT = findRoot();
/** the upstream checkout (jamesondh/chimera-vocal-synth, a git submodule) */
export const CHIMERA = join(ROOT, "vendor/chimera");
export const PREBUILT_WASM = join(ROOT, "prebuilt/chimera.wasm");
export const STAGE_DIST = join(ROOT, "packages/stage/dist");
export const DAEMON_MAIN = join(ROOT, "packages/daemon/src/main.ts");
export const CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "chimera-vocal-agent");

export const NOT_SET_UP = "chimera-sing is not set up on this machine: clone chimera-vocal-agent and run `bun run setup` in it";

/** Remember this checkout for copies of the adapters that live elsewhere. */
export function rememberRoot(): void {
  if (!ROOT) return;
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(pointer(), ROOT + "\n");
  } catch {
    // copies will ask for setup
  }
}

export const DEFAULT_PORT = 5318;
export const port = () => Number(process.env.CHIMERA_SING_PORT) || DEFAULT_PORT;
