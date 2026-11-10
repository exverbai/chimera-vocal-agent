#!/usr/bin/env bun
/**
 * The command hook for agents that run shell hooks (Claude Code, Codex): one script for every
 * event, told apart by `hook_event_name` in the JSON on stdin.
 *
 *   Stop              the reply ended: remember it, and in auto mode sing its opening
 *   UserPromptSubmit  a `/sing …` command is carried out here; any other prompt stops the song
 *
 * It must never hold the agent up or change what it does: it always exits 0, prints nothing on
 * Stop (Codex reads Stop's stdout as JSON), and on UserPromptSubmit prints only the one line
 * the model should relay (both agents add that event's stdout to the model's context).
 */
import { appendFileSync, closeSync, openSync, readSync, statSync } from "node:fs";
import { health, sing, stopSinging } from "../../core/src/client.ts";
import { runSlash } from "../../core/src/slash.ts";
import { AUTO_WORDS, markSang, readSettings, saveLastReply, takeSang } from "../../core/src/settings.ts";

interface HookInput {
  hook_event_name?: string;
  transcript_path?: string | null;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
  prompt?: string;
}

/** the text of a transcript line when it is an assistant message of the main conversation */
function assistantText(line: string): string {
  let o: any;
  try {
    o = JSON.parse(line);
  } catch {
    return "";
  }
  if (!o || o.isSidechain) return "";
  // Claude Code: {type: "assistant", message: {role, content}}; Codex: {payload: {type: "message", role, content}}
  const m = o.message ?? o.payload ?? o;
  if (m?.role !== "assistant") return "";
  if (typeof m.content === "string") return m.content;
  if (!Array.isArray(m.content)) return "";
  return m.content.map((b: any) => ((b?.type === "text" || b?.type === "output_text") && typeof b.text === "string" ? b.text : "")).filter(Boolean).join("\n\n");
}

/** The last assistant text in a JSONL transcript (read from its tail: transcripts get long). */
export function lastAssistantText(path: string | null | undefined): string {
  if (!path) return "";
  try {
    const size = statSync(path).size;
    const len = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(len);
    const fd = openSync(path, "r");
    try {
      readSync(fd, buf, 0, len, size - len);
    } finally {
      closeSync(fd);
    }
    const lines = buf.toString("utf8").split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = assistantText(lines[i]);
      if (t.trim()) return t;
    }
  } catch {
    // no transcript
  }
  return "";
}

/** The words after `/sing`, when the prompt is that command (as typed, or as its command file expands it). */
export function slashArgs(prompt: string | undefined): string | null {
  if (!prompt) return null;
  const tagged = prompt.match(/<chimera-sing>([\s\S]*?)<\/chimera-sing>/);
  if (tagged) return tagged[1].trim();
  const typed = prompt.match(/^\s*\/(?:[\w.-]+:)?sing(?:\s+([\s\S]*))?$/);
  return typed ? (typed[1] ?? "").trim() : null;
}

export async function onEvent(input: HookInput): Promise<string> {
  switch (input.hook_event_name) {
    case "Stop": {
      const text = (input.last_assistant_message ?? "").trim() || lastAssistantText(input.transcript_path);
      if (text.trim()) saveLastReply(text);
      // a song started on purpose during this turn is not sung over
      const sang = takeSang();
      if (input.stop_hook_active || sang || !text.trim() || !readSettings().auto) return "";
      await sing({ text, replace: true, maxWords: AUTO_WORDS });
      return "";
    }
    case "UserPromptSubmit": {
      const args = slashArgs(input.prompt);
      if (args === null) {
        // the user has moved on
        if ((await health())?.singing) await stopSinging();
        return "";
      }
      const r = await runSlash(args);
      if (r.prompt) return r.prompt;
      markSang();
      return `[chimera-sing result] ${r.say}`;
    }
  }
  return "";
}

if (import.meta.main) {
  // whatever happens, the agent goes on
  const bail = setTimeout(() => process.exit(0), 8000);
  try {
    const raw = await Bun.stdin.text();
    // CHIMERA_SING_DEBUG=<file>: keep what the agent sent, to see how a new agent version differs
    if (process.env.CHIMERA_SING_DEBUG) appendFileSync(process.env.CHIMERA_SING_DEBUG, raw.trim() + "\n");
    const out = await onEvent(raw.trim() ? JSON.parse(raw) : {});
    if (out) process.stdout.write(out + "\n");
  } catch {
    // silent
  }
  clearTimeout(bail);
  process.exit(0);
}
