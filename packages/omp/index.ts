/**
 * Extension for Oh My Pi and Pi: the agent sings.
 *
 * - a `sing` tool: the model writes a score, CHIMERA sings it (in a window with an animated head)
 * - `/sing`: sing the last reply, some text, or ask for a composed song; `/sing auto on` sings
 *   the opening of every reply the moment it ends
 *
 * The singing itself happens in the stage window, fed by a small local daemon that this
 * extension starts on demand (packages/daemon). What `/sing` means, the settings and the tool's
 * wording are shared with the other agents' adapters (packages/core). Nothing here may throw
 * into the session.
 *
 * The two hosts differ in a few places, each handled where it shows:
 *   - tool parameters: Oh My Pi injects a Zod-style builder, Pi takes plain JSON Schema
 *   - end of a reply: Oh My Pi's `agent_end` says whether more follows, Pi has `agent_settled`
 *   - Oh My Pi tells subagents apart and has managed timers
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { sing, stopSinging, type SingReply } from "../core/src/client.ts";
import { SCORE_SCHEMA, TOOL_DESCRIPTION } from "../core/src/guide.ts";
import { issueText } from "../core/src/score.ts";
import { AUTO_WORDS, readSettings, saveLastReply } from "../core/src/settings.ts";
import { runSlash, SLASH_COMPLETIONS } from "../core/src/slash.ts";

/** the text blocks of an assistant message */
function textOf(message: unknown): string {
  const m = message as { role?: string; content?: unknown };
  if (m?.role !== "assistant") return "";
  if (typeof m.content === "string") return m.content;
  if (!Array.isArray(m.content)) return "";
  return m.content.map((b: { type?: string; text?: string }) => (b?.type === "text" && typeof b.text === "string" ? b.text : "")).filter(Boolean).join("\n\n");
}

export default function chimeraSing(pi: ExtensionAPI) {
  const z = (pi as { zod?: ExtensionAPI["zod"] }).zod;
  const isOmp = !!z;
  /** the last assistant text of the main session */
  let lastReply = "";
  /** the model sang with the tool during this run: auto mode stays out of the way */
  let sangThisRun = false;
  /** a song this session started may still be playing */
  let mayBeSinging = false;
  let statusTimer: unknown;

  const isMain = (ctx: ExtensionContext) => ctx.agent?.kind !== "sub";
  const idleStatus = () => (readSettings().auto ? "♪ auto" : undefined);

  function setStatus(ctx: ExtensionContext, text: string | undefined): void {
    try {
      ctx.ui.setStatus("chimera", text);
    } catch {
      // a host without a status line
    }
  }

  function showSinging(ctx: ExtensionContext, seconds: number | undefined): void {
    mayBeSinging = true;
    setStatus(ctx, "♪ singing");
    const ms = ((seconds ?? 5) + 1) * 1000;
    const done = () => setStatus(ctx, idleStatus());
    try {
      if (typeof ctx.setTimeout === "function") {
        if (statusTimer) ctx.clearTimer(statusTimer as never);
        statusTimer = ctx.setTimeout(done, ms);
      } else {
        clearTimeout(statusTimer as never);
        statusTimer = setTimeout(done, ms);
        (statusTimer as { unref?: () => void }).unref?.();
      }
    } catch {
      // the status line just stays
    }
  }

  /** the opening of the reply, not all of it: about ten seconds of song */
  async function autoSing(text: string, ctx: ExtensionContext): Promise<void> {
    try {
      const r: SingReply = await sing({ text, replace: true, maxWords: AUTO_WORDS });
      if (r.ok) showSinging(ctx, r.seconds);
    } catch {
      // auto mode never complains
    }
  }

  pi.registerTool({
    name: "sing",
    label: "Sing",
    description: TOOL_DESCRIPTION,
    loadMode: "essential",
    approval: "read",
    parameters: (z
      ? z.object({
          bpm: z.number().describe("Tempo, 30 to 240"),
          body: z.enum(["male", "female", "child"]).optional().describe("The voice (default: the user's chosen voice)"),
          title: z.string().optional().describe("Shown above the singer"),
          notes: z.array(z.array(z.union([z.string(), z.number()]))).describe('One [pitch, beats, lyric] per note, e.g. ["E4", 1, "Breathe"]; a rest is ["-", 1]'),
        })
      : SCORE_SCHEMA) as never,
    async execute(_id: string, params: unknown, _signal: unknown, _onUpdate: unknown, ctx: ExtensionContext) {
      try {
        const r = await sing({ score: params });
        const notes = issueText(r.issues);
        if (!r.ok) return { content: [{ type: "text" as const, text: `The score could not be sung. Fix it and call sing again.\n${notes}` }], details: { ok: false }, isError: true };
        sangThisRun = true;
        showSinging(ctx, r.seconds);
        const how = r.queued ? `Queued behind ${r.queued} song${r.queued > 1 ? "s" : ""}` : "Singing now";
        return { content: [{ type: "text" as const, text: `${how} (${r.notes} notes, ${r.seconds} s): ${r.lyrics}${notes ? `\n${notes}` : ""}` }], details: { ok: true, seconds: r.seconds, notes: r.notes } };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `The singer is not available: ${e instanceof Error ? e.message : e}` }], details: { ok: false }, isError: true };
      }
    },
  });

  pi.registerCommand("sing", {
    description: "Sing the last reply, or: <text> | song [topic] | auto on|off | stop | voice <male|female|child> [tune|chant] | status",
    getArgumentCompletions: (prefix: string) => {
      const items = SLASH_COMPLETIONS.filter((x) => x.startsWith(prefix.trimStart()));
      return items.length ? items.map((value) => ({ value, label: value })) : null;
    },
    handler: async (args: string, ctx: ExtensionContext) => {
      try {
        const r = await runSlash(args, { lastReply });
        if (r.prompt) return void pi.sendUserMessage(r.prompt);
        if (r.seconds !== undefined) showSinging(ctx, r.seconds);
        else setStatus(ctx, idleStatus());
        ctx.ui.notify(r.say, r.ok ? "info" : "warning");
      } catch (e) {
        ctx.ui.notify(`chimera: ${e instanceof Error ? e.message : e}`, "error");
      }
    },
  });

  pi.on("session_start", (_event, ctx) => {
    if (isMain(ctx)) setStatus(ctx, idleStatus());
  });

  pi.on("agent_start", (_event, ctx) => {
    if (isMain(ctx)) sangThisRun = false;
  });

  pi.on("message_end", (event, ctx) => {
    if (!isMain(ctx)) return;
    const text = textOf(event.message);
    if (!text.trim()) return;
    lastReply = text;
    saveLastReply(text);
  });

  // a reply has ended: in auto mode, sing it at once
  if (isOmp) {
    pi.on("agent_end", (event, ctx) => {
      if (!isMain(ctx) || event.willContinue || sangThisRun || !readSettings().auto) return;
      const text = [...(event.messages ?? [])].reverse().map(textOf).find((t) => t.trim()) ?? "";
      if (text.trim()) void autoSing(text, ctx);
    });
  } else {
    // Pi: agent_end may be followed by a retry or queued work; agent_settled is the real end
    (pi.on as (event: string, handler: (event: unknown, ctx: ExtensionContext) => void) => void)("agent_settled", (_event, ctx) => {
      if (sangThisRun || !lastReply.trim() || !readSettings().auto) return;
      const text = lastReply;
      lastReply = "";
      void autoSing(text, ctx);
    });
  }

  // a new prompt: the user has moved on, stop the song
  pi.on("input", (event) => {
    if (mayBeSinging && !event.text.trimStart().startsWith("/sing")) {
      mayBeSinging = false;
      void stopSinging().catch(() => {});
    }
  });

  // leaving the interactive session stops the song; a one-shot run (-p) lets it finish
  pi.on("session_shutdown", (_event, ctx) => {
    const interactive = (ctx as { mode?: string }).mode ? (ctx as { mode?: string }).mode === "tui" : ctx.hasUI;
    if (mayBeSinging && interactive) void stopSinging().catch(() => {});
  });
}
