import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "../../daemon/src/server.ts";
import { ROOT } from "../../core/src/paths.ts";
import { markSang } from "../../core/src/settings.ts";
import { lastAssistantText, slashArgs } from "../src/on-event.ts";

const home = mkdtempSync(join(tmpdir(), "chimera-home-"));
process.env.XDG_CONFIG_HOME = join(home, "config");
process.env.XDG_CACHE_HOME = join(home, "cache");
delete process.env.CHIMERA_SING_AUTO;

const PORT = 5391;
const base = `http://127.0.0.1:${PORT}`;
let stopDaemon: () => void;
const songs: string[] = [];

beforeAll(async () => {
  const stageDir = mkdtempSync(join(tmpdir(), "stage-"));
  writeFileSync(join(stageDir, "index.html"), "<!doctype html><title>stage</title>");
  ({ stop: stopDaemon } = await startDaemon({ port: PORT, open: false, idleMinutes: 0, stageDir, log: (l) => l.startsWith("song ") && songs.push(l.replace(/^song \d+: [^:]+: /, "")) }));
});
afterAll(() => stopDaemon());

/** run the hook script as an agent would: JSON on stdin, a fresh process */
async function hook(input: unknown, env: Record<string, string> = {}): Promise<{ out: string; code: number }> {
  const p = Bun.spawn(["bun", join(ROOT, "packages/hooks/src/on-event.ts")], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { ...process.env, CHIMERA_SING_PORT: String(PORT), ...env } });
  p.stdin.write(typeof input === "string" ? input : JSON.stringify(input));
  p.stdin.end();
  const out = await new Response(p.stdout).text();
  return { out: out.trim(), code: await p.exited };
}
const AUTO = { CHIMERA_SING_AUTO: "1" };
const queue = async () => (await (await fetch(base + "/health")).json()).queue as number;
const clear = () => fetch(base + "/stop", { method: "POST", body: "{}" });

test("the /sing command is recognised as typed and as its command file expands it", () => {
  expect(slashArgs("/sing hello there")).toBe("hello there");
  expect(slashArgs("/sing")).toBe("");
  expect(slashArgs("/chimera-sing:sing auto on")).toBe("auto on");
  expect(slashArgs("<chimera-sing>stop</chimera-sing>\n\nThe chimera-sing hook carries out…")).toBe("stop");
  expect(slashArgs("<chimera-sing></chimera-sing>\nmore")).toBe("");
  expect(slashArgs("please /sing for me")).toBeNull();
  expect(slashArgs("/singing lessons")).toBeNull();
  expect(slashArgs(undefined)).toBeNull();
});

test("the last assistant text is found in Claude Code and Codex transcripts", () => {
  const claude = join(home, "claude.jsonl");
  writeFileSync(claude, [
    { type: "user", message: { role: "user", content: "hi" } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "First answer." }] } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "thinking", thinking: "hm" }, { type: "text", text: "Final answer." }] } },
    { type: "assistant", isSidechain: true, message: { role: "assistant", content: [{ type: "text", text: "A subagent." }] } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: {} }] } },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n");
  expect(lastAssistantText(claude)).toBe("Final answer.");
  const codex = join(home, "codex.jsonl");
  writeFileSync(codex, [
    { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] } },
    { type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Codex says done." }] } },
    { type: "event_msg", payload: { type: "token_count" } },
  ].map((l) => JSON.stringify(l)).join("\n") + "\nnot json\n");
  expect(lastAssistantText(codex)).toBe("Codex says done.");
  expect(lastAssistantText(join(home, "missing.jsonl"))).toBe("");
  expect(lastAssistantText(null)).toBe("");
});

test("Stop with auto off: silent, nothing sung, but the reply is remembered", async () => {
  const r = await hook({ hook_event_name: "Stop", last_assistant_message: "All done. The tests pass.", stop_hook_active: false });
  expect(r).toEqual({ out: "", code: 0 });
  expect(await queue()).toBe(0);
  expect(readFileSync(join(home, "cache/chimera-vocal-agent/last-reply.txt"), "utf8")).toBe("All done. The tests pass.");
});

test("Stop with auto on sings the reply (Codex field, or the transcript for Claude Code)", async () => {
  songs.length = 0;
  expect(await hook({ hook_event_name: "Stop", last_assistant_message: "All done. The tests pass." }, AUTO)).toEqual({ out: "", code: 0 });
  expect(songs).toEqual(["All done. The tests pass."]);
  const t = join(home, "t.jsonl");
  writeFileSync(t, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "From the transcript." }] } }) + "\n");
  await hook({ hook_event_name: "Stop", transcript_path: t }, AUTO);
  expect(songs.at(-1)).toBe("From the transcript.");
  // replace: the newer reply took the older one's place
  expect(await queue()).toBe(1);
  await clear();
});

test("Stop stays quiet when it would loop, has no text, or a song was just started on purpose", async () => {
  await hook({ hook_event_name: "Stop", last_assistant_message: "Again.", stop_hook_active: true }, AUTO);
  await hook({ hook_event_name: "Stop", last_assistant_message: "   " }, AUTO);
  await hook({ hook_event_name: "Stop", last_assistant_message: "```\ncode only\n```" }, AUTO);
  expect(await queue()).toBe(0);
  markSang();
  await hook({ hook_event_name: "Stop", last_assistant_message: "Here are the lyrics." }, AUTO);
  expect(await queue()).toBe(0);
  // the mark is taken once
  await hook({ hook_event_name: "Stop", last_assistant_message: "A normal reply." }, AUTO);
  expect(await queue()).toBe(1);
  await clear();
});

test("UserPromptSubmit carries out /sing and tells the model the outcome", async () => {
  songs.length = 0;
  const r = await hook({ hook_event_name: "UserPromptSubmit", prompt: "/sing hello there" });
  expect(r).toEqual({ out: "[chimera-sing result] ♪ hello there.", code: 0 });
  expect(songs).toEqual(["hello there."]);
  // the reply to a /sing command is not sung over the song
  await hook({ hook_event_name: "Stop", last_assistant_message: "♪ hello there." }, AUTO);
  expect(songs.length).toBe(1);

  // no words: the last reply
  const last = await hook({ hook_event_name: "UserPromptSubmit", prompt: "<chimera-sing></chimera-sing>\n\nThe chimera-sing hook…" });
  expect(last.out).toBe("[chimera-sing result] ♪ hello there.");

  expect((await hook({ hook_event_name: "UserPromptSubmit", prompt: "/sing auto on" })).out).toContain("I will sing the start of every reply");
  expect(JSON.parse(readFileSync(join(home, "config/chimera-vocal-agent/settings.json"), "utf8")).auto).toBe(true);
  expect((await hook({ hook_event_name: "UserPromptSubmit", prompt: "/sing auto off" })).out).toContain("Auto singing is off");
  expect((await hook({ hook_event_name: "UserPromptSubmit", prompt: "/sing voice child chant" })).out).toBe("[chimera-sing result] Voice: child, chant.");
  expect((await hook({ hook_event_name: "UserPromptSubmit", prompt: "/sing stop" })).out).toBe("[chimera-sing result] Stopped.");
  expect(await queue()).toBe(0);

  const song = await hook({ hook_event_name: "UserPromptSubmit", prompt: "/sing song the daemon" });
  expect(song.out).toContain("Sing me a short song about: the daemon");
  expect(song.out).toContain("`sing` tool");
});

test("any other prompt stops a song that is playing, and says nothing", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const got: any[] = [];
  ws.onmessage = (e) => got.push(JSON.parse(String(e.data)));
  await new Promise((r) => (ws.onopen = r));
  ws.send(JSON.stringify({ type: "hello" }));
  await fetch(base + "/sing", { method: "POST", body: JSON.stringify({ text: "A long song goes here." }) });
  await Bun.sleep(50);
  expect(got.map((m) => m.type)).toEqual(["sing"]);
  expect(await hook({ hook_event_name: "UserPromptSubmit", prompt: "now fix the bug" })).toEqual({ out: "", code: 0 });
  expect(got.map((m) => m.type)).toEqual(["sing", "stop"]);
  ws.close();
});

test("garbage in: still silent, still exit 0", async () => {
  expect(await hook("{not json")).toEqual({ out: "", code: 0 });
  expect(await hook({ hook_event_name: "SessionStart" })).toEqual({ out: "", code: 0 });
  expect(await hook("")).toEqual({ out: "", code: 0 });
});
