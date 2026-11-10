/**
 * The extension loads in both hosts' API shapes. This is a stand-in for the hosts, not a run
 * inside them: Oh My Pi injects a Zod-style builder and ends a reply with `agent_end`; Pi takes
 * plain JSON Schema and ends with `agent_settled`.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "../../daemon/src/server.ts";
import { SCORE_SCHEMA } from "../../core/src/guide.ts";

const home = mkdtempSync(join(tmpdir(), "chimera-home-"));
process.env.XDG_CONFIG_HOME = join(home, "config");
process.env.XDG_CACHE_HOME = join(home, "cache");
delete process.env.CHIMERA_SING_AUTO;
const PORT = 5392;
process.env.CHIMERA_SING_PORT = String(PORT);

let stopDaemon: () => void;
const songs: string[] = [];
beforeAll(async () => {
  const stageDir = mkdtempSync(join(tmpdir(), "stage-"));
  writeFileSync(join(stageDir, "index.html"), "<!doctype html><title>stage</title>");
  ({ stop: stopDaemon } = await startDaemon({ port: PORT, open: false, idleMinutes: 0, stageDir, log: (l) => l.startsWith("song ") && songs.push(l.replace(/^song \d+: [^:]+: /, "")) }));
});
afterAll(() => stopDaemon());

/** a schema builder that accepts any chain of calls, like the injected Zod */
const anyBuilder: any = new Proxy(function () {}, { get: () => anyBuilder, apply: () => anyBuilder });

function host(kind: "omp" | "pi") {
  const handlers = new Map<string, Function>();
  const said: string[] = [];
  const sent: string[] = [];
  let tool: any, command: any;
  const pi: any = {
    registerTool: (t: any) => (tool = t),
    registerCommand: (_name: string, c: any) => (command = c),
    on: (event: string, h: Function) => handlers.set(event, h),
    sendUserMessage: (t: string) => sent.push(t),
  };
  if (kind === "omp") pi.zod = anyBuilder;
  const status: Record<string, string | undefined> = {};
  const ctx: any = { hasUI: true, ui: { notify: (m: string) => said.push(m), setStatus: (k: string, v?: string) => (status[k] = v) } };
  if (kind === "omp") Object.assign(ctx, { mode: "tui", agent: { kind: "main" }, setTimeout: () => 1, clearTimer: () => {} });
  return { pi, ctx, handlers, said, sent, status, tool: () => tool, command: () => command };
}

const assistant = (text: string) => ({ role: "assistant", content: [{ type: "text", text }] });
const settle = () => Bun.sleep(80);

for (const kind of ["omp", "pi"] as const) {
  test(`${kind}: registers the tool, the command and the events, and sings`, async () => {
    const { default: extension } = await import("../index.ts");
    const h = host(kind);
    extension(h.pi);
    expect(h.tool().name).toBe("sing");
    if (kind === "pi") expect(h.tool().parameters).toBe(SCORE_SCHEMA);
    expect([...h.handlers.keys()]).toContain(kind === "omp" ? "agent_end" : "agent_settled");
    expect(h.handlers.has(kind === "omp" ? "agent_settled" : "agent_end")).toBe(false);

    // the tool
    songs.length = 0;
    const ok = await h.tool().execute("1", { bpm: 120, notes: [["C4", 1, "Hi"], ["E4", 1, "there."]] }, undefined, undefined, h.ctx);
    expect(ok.content[0].text).toContain("Hi there .");
    expect(h.status.chimera).toBe("♪ singing");
    const bad = await h.tool().execute("2", { bpm: 120, notes: [["Q9", 1, "la"]] }, undefined, undefined, h.ctx);
    expect(bad.isError).toBe(true);

    // /sing: text, the last reply, a composed song, settings
    await h.command().handler("good morning", h.ctx);
    expect(h.said.at(-1)).toBe("♪ good morning.");
    await h.command().handler("", h.ctx);
    expect(h.said.at(-1)).toContain("Nothing to sing yet");
    h.handlers.get("message_end")!({ message: assistant("The build is green.") }, h.ctx);
    await h.command().handler("", h.ctx);
    expect(h.said.at(-1)).toBe("♪ The build is green.");
    await h.command().handler("song the build", h.ctx);
    expect(h.sent.at(-1)).toContain("Sing me a short song about: the build");
    expect(h.command().getArgumentCompletions("au").map((x: any) => x.value)).toEqual(["auto on", "auto off"]);

    // auto mode: off says nothing, on sings the reply when it ends, but not over a tool's song
    const end = async (text: string) => {
      h.handlers.get("agent_start")!({}, h.ctx);
      h.handlers.get("message_end")!({ message: assistant(text) }, h.ctx);
      h.handlers.get(kind === "omp" ? "agent_end" : "agent_settled")!({ messages: [assistant(text)] }, h.ctx);
      await settle();
    };
    songs.length = 0;
    await end("Quiet, please.");
    expect(songs).toEqual([]);
    await h.command().handler("auto on", h.ctx);
    expect(h.status.chimera).toBe("♪ auto");
    await end("Now I sing this.");
    expect(songs).toEqual(["Now I sing this."]);
    h.handlers.get("agent_start")!({}, h.ctx);
    await h.tool().execute("3", { bpm: 120, notes: [["C4", 1, "la"]] }, undefined, undefined, h.ctx);
    h.handlers.get("message_end")!({ message: assistant("la") }, h.ctx);
    h.handlers.get(kind === "omp" ? "agent_end" : "agent_settled")!({ messages: [assistant("la")] }, h.ctx);
    await settle();
    expect(songs).toEqual(["Now I sing this.", "la"]);
    if (kind === "omp") {
      h.handlers.get("agent_end")!({ messages: [assistant("More is coming.")], willContinue: true }, h.ctx);
      h.handlers.get("agent_end")!({ messages: [assistant("A subagent speaks.")] }, { ...h.ctx, agent: { kind: "sub" } });
      await settle();
      expect(songs.length).toBe(2);
    }
    await h.command().handler("auto off", h.ctx);
    expect(h.status.chimera).toBeUndefined();
  });
}
