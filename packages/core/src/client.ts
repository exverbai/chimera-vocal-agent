/**
 * What an agent adapter needs: make sure the daemon runs, then ask it to sing.
 */
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { CACHE, DAEMON_MAIN, NOT_SET_UP, port, ROOT } from "./paths.ts";
import type { Issue } from "./score.ts";

export interface SingRequest {
  /** a score or a ready melody */
  score?: unknown;
  /** or text to set to an automatic melody */
  text?: string;
  style?: "tune" | "chant";
  body?: "male" | "female" | "child";
  maxWords?: number;
  title?: string;
  /** cut what is being sung and drop the queue first */
  replace?: boolean;
  /** only check the score */
  dryRun?: boolean;
}

export interface SingReply {
  ok: boolean;
  seconds?: number;
  notes?: number;
  lyrics?: string;
  /** songs waiting before this one */
  queued?: number;
  /** whether a stage window is connected (one is opened when not) */
  window?: boolean;
  issues: Issue[];
}

export interface Health {
  ok: true;
  pid: number;
  windows: number;
  queue: number;
  singing: boolean;
  voice: { body: string; style: string };
  auto: boolean;
}

const base = () => `http://127.0.0.1:${port()}`;

async function request<T>(path: string, body?: unknown, timeout = 4000): Promise<T> {
  const res = await fetch(base() + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  return (await res.json()) as T;
}

export async function health(timeout = 600): Promise<Health | null> {
  try {
    return await request<Health>("/health", undefined, timeout);
  } catch {
    return null;
  }
}

let starting: Promise<void> | null = null;

/** Start the daemon unless it answers already. It outlives the caller. */
export function ensureDaemon(): Promise<void> {
  starting ??= (async () => {
    if (await health()) return;
    if (!ROOT) throw new Error(NOT_SET_UP);
    mkdirSync(CACHE, { recursive: true });
    const log = openSync(join(CACHE, "daemon.log"), "a");
    const bun = Bun.which("bun") ?? process.execPath;
    const child = spawn(bun, [DAEMON_MAIN], { detached: true, stdio: ["ignore", log, log], env: { ...process.env } });
    child.on("error", () => {});
    child.unref();
    for (let i = 0; i < 60; i++) {
      await Bun.sleep(100);
      if (await health(300)) return;
    }
    throw new Error(`the chimera-sing daemon did not start; see ${join(CACHE, "daemon.log")}`);
  })().finally(() => {
    starting = null;
  });
  return starting;
}

export async function sing(req: SingRequest): Promise<SingReply> {
  await ensureDaemon();
  return request<SingReply>("/sing", req);
}

export async function stopSinging(): Promise<void> {
  if (await health()) await request("/stop", {});
}

export async function setVoice(v: { body?: string; style?: string }): Promise<Health["voice"]> {
  await ensureDaemon();
  return (await request<{ voice: Health["voice"] }>("/voice", v)).voice;
}

export async function shutdown(): Promise<void> {
  if (await health()) await request("/shutdown", {}).catch(() => {});
}
