/**
 * The `/sing` command, once, for every agent: what the words after it mean and what to do.
 * An adapter passes the argument text and shows `say`; when `prompt` comes back it hands that
 * to the model (a composed song needs the model).
 */
import { health, sing, stopSinging } from "./client.ts";
import { SONG_PROMPT } from "./guide.ts";
import { issueText } from "./score.ts";
import { BODIES, STYLES, lastReply, readSettings, writeSettings } from "./settings.ts";

export interface SlashResult {
  ok: boolean;
  /** one line for the user */
  say: string;
  /** a request for the model (compose a song) */
  prompt?: string;
  /** a song was started, this long (s) */
  seconds?: number;
}

export const SLASH_USAGE = "/sing [text | song <topic> | auto on|off | stop | voice <male|female|child> [tune|chant] | status]";
export const SLASH_COMPLETIONS = ["song", "auto on", "auto off", "stop", "voice male", "voice female", "voice child", "status"];

async function singText(text: string): Promise<SlashResult> {
  const r = await sing({ text, replace: true });
  if (!r.ok) return { ok: false, say: issueText(r.issues) || "Could not sing that." };
  return { ok: true, say: `♪ ${r.lyrics}`, seconds: r.seconds };
}

export async function runSlash(args: string, ctx: { lastReply?: string } = {}): Promise<SlashResult> {
  const text = args.trim();
  const [cmd, ...rest] = text.split(/\s+/);
  try {
    if (!text) {
      const reply = (ctx.lastReply ?? lastReply()).trim();
      return reply ? await singText(reply) : { ok: false, say: "Nothing to sing yet. Try: /sing hello there" };
    }
    if (cmd === "stop" && !rest.length) {
      await stopSinging();
      return { ok: true, say: "Stopped." };
    }
    if (cmd === "auto" && rest.length <= 1 && (!rest[0] || rest[0] === "on" || rest[0] === "off")) {
      const s = writeSettings({ auto: rest[0] ? rest[0] === "on" : !readSettings().auto });
      return { ok: true, say: s.auto ? "I will sing the start of every reply. /sing auto off stops that." : "Auto singing is off." };
    }
    if (cmd === "voice" && rest.length >= 1 && rest.length <= 2 && BODIES.includes(rest[0]) && (!rest[1] || STYLES.includes(rest[1]))) {
      const s = writeSettings({ body: rest[0], style: rest[1] });
      return { ok: true, say: `Voice: ${s.voice.body}, ${s.voice.style}.` };
    }
    if (cmd === "status" && !rest.length) {
      const [h, s] = [await health(), readSettings()];
      const voice = `voice ${s.voice.body}/${s.voice.style}, auto ${s.auto ? "on" : "off"}`;
      return { ok: true, say: h ? `Singer running: ${h.windows} window${h.windows === 1 ? "" : "s"}, ${h.singing ? "singing" : "quiet"}, ${voice}.` : `Singer not running yet (it starts with the first song); ${voice}.` };
    }
    if (cmd === "song") return { ok: true, say: "Composing a song…", prompt: SONG_PROMPT(rest.join(" ")) };
    return await singText(text);
  } catch (e) {
    return { ok: false, say: `chimera-sing: ${e instanceof Error ? e.message : e}` };
  }
}
