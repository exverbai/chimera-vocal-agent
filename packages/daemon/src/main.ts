#!/usr/bin/env bun
/** Runs the daemon in the foreground (the client starts it detached, logging to the cache). */
import { startDaemon } from "./server.ts";
import { port, rememberRoot, STAGE_DIST } from "../../core/src/paths.ts";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

try {
  const { server } = await startDaemon({
    port: Number(arg("--port")) || port(),
    open: !process.argv.includes("--no-open") && process.env.CHIMERA_SING_OPEN !== "0",
    idleMinutes: Number(arg("--idle-minutes") ?? 30),
    stageDir: STAGE_DIST,
    log: (line) => console.log(`${new Date().toISOString()} ${line}`),
  });
  rememberRoot();
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  void server;
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
