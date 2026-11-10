#!/usr/bin/env bun
/**
 * MCP server (stdio): the `sing` tools for any agent that speaks MCP (Claude Code, Codex, Pi…).
 * A thin caller of the daemon client, like every adapter.
 *
 * Written against the protocol directly (newline-delimited JSON-RPC, tools only) rather than
 * with the SDK: a plugin directory is copied around without its node_modules, and this file
 * must still start.
 */
import { sing, stopSinging } from "../../core/src/client.ts";
import { SCORE_SCHEMA, STOP_TOOL_DESCRIPTION, TEXT_TOOL_DESCRIPTION, TOOL_DESCRIPTION } from "../../core/src/guide.ts";
import { issueText } from "../../core/src/score.ts";
import { markSang } from "../../core/src/settings.ts";

const TOOLS = [
  { name: "sing", description: TOOL_DESCRIPTION, inputSchema: SCORE_SCHEMA },
  {
    name: "sing_text",
    description: TEXT_TOOL_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The words to sing" },
        style: { type: "string", enum: ["tune", "chant"], description: "tune: a melody; chant: fast, on few notes" },
        body: { type: "string", enum: ["male", "female", "child"], description: "The voice (default: the user's chosen voice)" },
      },
      required: ["text"],
    },
  },
  { name: "stop_singing", description: STOP_TOOL_DESCRIPTION, inputSchema: { type: "object", properties: {} } },
];

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string, isError = false): Result => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });

async function call(name: string, args: Record<string, unknown>): Promise<Result> {
  try {
    if (name === "stop_singing") {
      await stopSinging();
      return text("Stopped.");
    }
    if (name !== "sing" && name !== "sing_text") return text(`Unknown tool: ${name}`, true);
    const r = name === "sing" ? await sing({ score: args }) : await sing({ text: String(args.text ?? ""), style: args.style as never, body: args.body as never, replace: true });
    const notes = issueText(r.issues);
    if (!r.ok) return text(`${name === "sing" ? "The score could not be sung. Fix it and call sing again." : "That could not be sung."}\n${notes}`, true);
    // the reply that follows this call is not to be sung over the song (auto mode)
    markSang();
    const how = r.queued ? `Queued behind ${r.queued} song${r.queued > 1 ? "s" : ""}` : "Singing now";
    return text(`${how} (${r.notes} notes, ${r.seconds} s): ${r.lyrics}${notes ? `\n${notes}` : ""}`);
  } catch (e) {
    return text(`The singer is not available: ${e instanceof Error ? e.message : e}`, true);
  }
}

const send = (m: unknown): void => void process.stdout.write(JSON.stringify(m) + "\n");

async function handle(msg: { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> }): Promise<void> {
  const { id, method, params } = msg;
  // notifications (no id) need no answer
  if (id === undefined || id === null || !method) return;
  const ok = (result: unknown) => send({ jsonrpc: "2.0", id, result });
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "chimera-sing", version: "0.0.1" },
        instructions: "A physically modelled voice that sings out loud to the user. `sing` takes a score you compose; `sing_text` sings plain words to an automatic tune.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call":
      return ok(await call(String(params?.name ?? ""), (params?.arguments as Record<string, unknown>) ?? {}));
    default:
      return void send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

let buffer = "";
let pending = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let nl: number;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg: Parameters<typeof handle>[0];
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    // answer in order
    pending = pending.then(() => handle(msg)).catch(() => {});
  }
});
process.stdin.on("end", () => void pending.then(() => process.exit(0)));
