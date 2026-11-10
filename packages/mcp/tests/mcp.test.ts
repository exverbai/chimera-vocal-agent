import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "../../daemon/src/server.ts";
import { ROOT } from "../../core/src/paths.ts";

const home = mkdtempSync(join(tmpdir(), "chimera-home-"));
process.env.XDG_CONFIG_HOME = join(home, "config");
process.env.XDG_CACHE_HOME = join(home, "cache");
delete process.env.CHIMERA_SING_AUTO;

const PORT = 5390;
let stopDaemon: () => void;
let proc: ReturnType<typeof Bun.spawn>;
const lines: any[] = [];
const waiting: ((m: any) => void)[] = [];
let nextId = 1;

/** one JSON-RPC request over the server's stdio */
function rpc(method: string, params?: unknown): Promise<any> {
  const id = nextId++;
  (proc.stdin as any).write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  (proc.stdin as any).flush?.();
  return new Promise((resolve) => {
    const take = (m: any) => (m.id === id ? resolve(m) : waiting.push(take));
    const i = lines.findIndex((m) => m.id === id);
    if (i >= 0) resolve(lines.splice(i, 1)[0]);
    else waiting.push(take);
  });
}

const health = async () => (await fetch(`http://127.0.0.1:${PORT}/health`)).json();

beforeAll(async () => {
  const stageDir = mkdtempSync(join(tmpdir(), "stage-"));
  writeFileSync(join(stageDir, "index.html"), "<!doctype html><title>stage</title>");
  ({ stop: stopDaemon } = await startDaemon({ port: PORT, open: false, idleMinutes: 0, stageDir, log: () => {} }));
  proc = Bun.spawn(["bun", join(ROOT, "packages/mcp/src/server.ts")], { stdin: "pipe", stdout: "pipe", stderr: "inherit", env: { ...process.env, CHIMERA_SING_PORT: String(PORT) } });
  (async () => {
    let buf = "";
    for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
      buf += new TextDecoder().decode(chunk);
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const m = JSON.parse(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
        const w = waiting.splice(0);
        if (w.length) w.forEach((f) => f(m));
        else lines.push(m);
      }
    }
  })();
});
afterAll(() => {
  proc.kill();
  stopDaemon();
});

test("initialize, then list the three tools", async () => {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  expect(init.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "chimera-sing" } });
  (proc.stdin as any).write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const list = await rpc("tools/list");
  expect(list.result.tools.map((t: any) => t.name)).toEqual(["sing", "sing_text", "stop_singing"]);
  for (const t of list.result.tools) {
    expect(t.description.length).toBeGreaterThan(20);
    expect(t.inputSchema.type).toBe("object");
  }
  expect((await rpc("ping")).result).toEqual({});
  expect((await rpc("resources/list")).error.code).toBe(-32601);
});

test("sing queues a score; a bad score comes back as an error the model can fix", async () => {
  const ok = await rpc("tools/call", { name: "sing", arguments: { bpm: 120, notes: [["C4", 1, "It"], ["E4", 1, "works."]] } });
  expect(ok.result.isError).toBeUndefined();
  expect(ok.result.content[0].text).toContain("2 notes");
  expect(ok.result.content[0].text).toContain("It works .");
  expect((await health()).queue).toBe(1);

  const bad = await rpc("tools/call", { name: "sing", arguments: { bpm: 120, notes: [["Q9", 1, "la"]] } });
  expect(bad.result.isError).toBe(true);
  expect(bad.result.content[0].text).toContain("cannot read the pitch");
  expect((await health()).queue).toBe(1);
});

test("sing_text replaces what was queued; stop_singing clears it", async () => {
  const r = await rpc("tools/call", { name: "sing_text", arguments: { text: "Hello there, **world**.", body: "male" } });
  expect(r.result.content[0].text).toContain("Hello there, world.");
  expect((await health()).queue).toBe(1);
  expect((await rpc("tools/call", { name: "stop_singing", arguments: {} })).result.content[0].text).toBe("Stopped.");
  expect((await health()).queue).toBe(0);
  expect((await rpc("tools/call", { name: "nope", arguments: {} })).result.isError).toBe(true);
});
