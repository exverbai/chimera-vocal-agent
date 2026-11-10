/**
 * Opens the stage in its own small browser window, also from inside WSL (where the browser is
 * the Windows one). A Chromium browser is started as an app window with autoplay allowed and a
 * profile of its own: without the separate profile an already running browser takes the window
 * over and ignores the autoplay flag, and the page would need a click before it can sing.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE } from "./paths.ts";

export interface Opened {
  /** what opened it, for the log */
  how: string;
  /** false when the page will need a click before it can sing */
  autoplay: boolean;
}

export function isWsl(): boolean {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

const WIN_BROWSERS = [
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
];
const MAC_BROWSERS = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium"];
const LINUX_BROWSERS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];

/** %LOCALAPPDATA% as Windows writes it, asked from inside WSL */
function winLocalAppData(): string | null {
  const cmd = ["/mnt/c/Windows/System32/cmd.exe", "cmd.exe"].find((c) => c === "cmd.exe" || existsSync(c))!;
  // run from a Windows directory: cmd.exe complains about a \\wsl$ working directory
  const r = spawnSync(cmd, ["/c", "echo %LOCALAPPDATA%"], { cwd: existsSync("/mnt/c") ? "/mnt/c" : undefined, encoding: "utf8", timeout: 5000 });
  const out = (r.stdout ?? "").trim().split(/\r?\n/).pop()?.trim();
  return out && /^[A-Za-z]:\\/.test(out) ? out : null;
}

function launch(cmd: string, args: string[]): boolean {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", cwd: isWsl() && existsSync("/mnt/c") ? "/mnt/c" : undefined });
    child.on("error", () => {});
    child.unref();
    return child.pid !== undefined;
  } catch {
    return false;
  }
}

const appArgs = (url: string, profile: string) => [`--app=${url}`, "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "--window-size=520,760", "--no-first-run", "--no-default-browser-check"];

/** Open `url` in a window. Null when nothing could open it. */
export function openWindow(url: string): Opened | null {
  const chosen = process.env.CHIMERA_SING_BROWSER;
  if (isWsl()) {
    const browser = chosen ?? WIN_BROWSERS.find((b) => existsSync(b));
    const local = browser ? winLocalAppData() : null;
    if (browser && local && launch(browser, appArgs(url, `${local}\\chimera-stage`))) return { how: browser, autoplay: true };
    for (const opener of ["wslview", "/mnt/c/Windows/explorer.exe"]) {
      if ((opener.startsWith("/") ? existsSync(opener) : Bun.which(opener)) && launch(opener, [url])) return { how: opener, autoplay: false };
    }
    return null;
  }
  const profile = join(CACHE, "browser-profile");
  if (process.platform === "darwin") {
    const browser = chosen ?? MAC_BROWSERS.find((b) => existsSync(b));
    if (browser && launch(browser, appArgs(url, profile))) return { how: browser, autoplay: true };
    return launch("open", [url]) ? { how: "open", autoplay: false } : null;
  }
  if (process.platform === "win32") {
    const browser = chosen ?? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((b) => existsSync(b));
    if (browser && launch(browser, appArgs(url, join(process.env.LOCALAPPDATA ?? CACHE, "chimera-stage")))) return { how: browser, autoplay: true };
    return launch("cmd.exe", ["/c", "start", "", url]) ? { how: "start", autoplay: false } : null;
  }
  const browser = chosen ?? LINUX_BROWSERS.map((b) => Bun.which(b)).find(Boolean);
  if (browser && launch(browser, appArgs(url, profile))) return { how: browser, autoplay: true };
  return Bun.which("xdg-open") && launch("xdg-open", [url]) ? { how: "xdg-open", autoplay: false } : null;
}
