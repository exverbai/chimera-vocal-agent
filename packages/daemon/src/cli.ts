#!/usr/bin/env bun
/**
 * chimera-sing: sing a score or some text on the stage, from a shell or from any agent's hook.
 */
import { readFileSync } from "node:fs";
import { ensureDaemon, shutdown, sing, type SingRequest } from "../../core/src/client.ts";
import { issueText } from "../../core/src/score.ts";
import { runSlash } from "../../core/src/slash.ts";

const USAGE = `chimera-sing: a physical-model voice sings for you (CHIMERA)

  chimera-sing <score.json | ->        sing a score (or a melody file); - reads stdin
  chimera-sing --text "words to sing"  set text to an automatic melody
  chimera-sing check <score.json>      check a score without singing it
  chimera-sing last                    sing the agent's last reply
  chimera-sing auto [on|off]           sing the start of every reply, in every agent
  chimera-sing stop                    cut the song and drop the queue
  chimera-sing voice <male|female|child> [tune|chant]
  chimera-sing status | quit

options: --body male|female|child   --style tune|chant   --replace   --max-words N   --title T`;

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const [, v] = argv.splice(i, 2);
  return v ?? "";
};
const has = (name: string) => {
  const i = argv.indexOf(name);
  if (i >= 0) argv.splice(i, 1);
  return i >= 0;
};

const req: SingRequest = {};
const text = flag("--text");
const body = flag("--body");
const style = flag("--style");
const maxWords = flag("--max-words");
const title = flag("--title");
if (body) req.body = body as SingRequest["body"];
if (style) req.style = style as SingRequest["style"];
if (maxWords) req.maxWords = Number(maxWords);
if (title) req.title = title;
if (has("--replace")) req.replace = true;

async function run(): Promise<number> {
  const [cmd, ...rest] = argv;
  if (has("--help") || has("-h") || (!cmd && text === undefined)) {
    console.log(USAGE);
    return cmd || text !== undefined ? 0 : 1;
  }
  switch (cmd) {
    case "quit":
      await shutdown();
      return 0;
    case "stop":
    case "status":
    case "auto":
    case "voice":
    case "last": {
      // the same words mean the same in every agent's /sing
      const r = await runSlash(cmd === "last" ? "" : [cmd, ...rest].join(" "));
      (r.ok ? console.log : console.error)(r.say);
      return r.ok ? 0 : 2;
    }
    case "daemon":
      await ensureDaemon();
      return 0;
  }
  if (text !== undefined) req.text = text;
  else {
    const path = cmd === "check" ? rest[0] : cmd;
    if (!path) {
      console.error(USAGE);
      return 1;
    }
    req.score = readFileSync(path === "-" ? 0 : path, "utf8");
    if (cmd === "check") req.dryRun = true;
  }
  const r = await sing(req);
  if (r.issues.length) console.error(issueText(r.issues));
  if (!r.ok) return 2;
  console.log(`${req.dryRun ? "ok" : r.queued ? `queued behind ${r.queued}` : r.window ? "singing" : "opening the stage"}: ${r.notes} notes, ${r.seconds} s: ${r.lyrics}`);
  return 0;
}

process.exit(await run().catch((e) => (console.error(e instanceof Error ? e.message : e), 1)));
