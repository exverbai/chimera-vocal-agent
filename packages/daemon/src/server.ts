/**
 * The daemon: takes songs over HTTP, checks them with the engine, and hands them one at a time
 * to the stage window over a WebSocket. The stage sings live, so nothing is rendered here.
 *
 *   GET  /health            what is going on
 *   POST /sing              {score | text, style?, body?, replace?, dryRun?} → SingReply
 *   POST /stop              cut the song and drop the queue
 *   POST /voice             {body?, style?}: the defaults for songs that do not say (settings file)
 *   POST /shutdown
 *   WS   /ws                the stage: ← sing/stop, → hello/started/ended/error
 *   GET  /*                 the built stage page
 */
import type { Server, ServerWebSocket } from "bun";
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import { loadEngine, type Engine } from "../../core/src/engine.ts";
import { compile, DEFAULT_LIMITS, type BodyName, type Issue, type Melody } from "../../core/src/score.ts";
import { melodize, type Style } from "../../core/src/melodize.ts";
import { openWindow } from "../../core/src/openWindow.ts";
import { BODIES, STYLES, readSettings, writeSettings } from "../../core/src/settings.ts";
import type { Health, SingReply, SingRequest } from "../../core/src/client.ts";

export interface DaemonOptions {
  port: number;
  /** open the stage window when a song arrives and none is connected */
  open: boolean;
  /** exit after this long with no window and no requests (minutes; 0: never) */
  idleMinutes: number;
  /** where the built stage is */
  stageDir: string;
  log: (line: string) => void;
}

interface Song {
  id: number;
  melody: Melody;
  seconds: number;
}

type FromStage = { type: "hello" } | { type: "started"; id: number } | { type: "ended"; id: number; how?: string } | { type: "error"; id: number; message: string };

export async function startDaemon(o: DaemonOptions): Promise<{ server: Server<unknown>; stop: () => void }> {
  const engine: Engine = await loadEngine();
  const clients = new Set<ServerWebSocket<unknown>>();
  let queue: Song[] = [];
  let current: { song: Song; timer: ReturnType<typeof setTimeout> } | null = null;
  let nextId = 1;
  let lastOpen = 0;
  let lastActivity = Date.now();
  const startedAt = Date.now();
  /** a window left open by an earlier daemon reconnects within about a second: wait that long before opening another */
  const RECONNECT_GRACE = 1300;
  const self = [`http://127.0.0.1:${o.port}`, `http://localhost:${o.port}`];
  /** the stage served by `vite dev` may connect too */
  const devStage = ["http://127.0.0.1:5319", "http://localhost:5319"];

  const json = (data: unknown, status = 200) => Response.json(data, { status });
  const primary = () => [...clients].at(-1);

  const done = (id: number) => {
    if (current?.song.id !== id) return;
    clearTimeout(current.timer);
    current = null;
    pump();
  };

  function ensureWindow(): void {
    if (clients.size || !o.open || Date.now() - lastOpen < 15000) return;
    const wait = startedAt + RECONNECT_GRACE - Date.now();
    if (wait > 0) return void setTimeout(pump, wait);
    lastOpen = Date.now();
    const opened = openWindow(`http://127.0.0.1:${o.port}/`);
    o.log(opened ? `opened the stage with ${opened.how}${opened.autoplay ? "" : " (it will need a click to sing)"}` : `could not open a browser: open http://127.0.0.1:${o.port}/ yourself`);
  }

  function pump(): void {
    if (current || !queue.length) return;
    const ws = primary();
    if (!ws) return ensureWindow();
    const song = queue.shift()!;
    // a stage that never answers (closed lid, crashed tab) must not hold the queue for ever
    const timer = setTimeout(() => done(song.id), (song.seconds + 25) * 1000);
    current = { song, timer };
    ws.send(JSON.stringify({ type: "sing", id: song.id, melody: song.melody }));
  }

  function stopAll(): void {
    queue = [];
    if (current) {
      clearTimeout(current.timer);
      current = null;
    }
    for (const ws of clients) ws.send(JSON.stringify({ type: "stop" }));
  }

  function sing(req: SingRequest): SingReply {
    const issues: Issue[] = [];
    const voice = readSettings().voice;
    let input: unknown = req.score;
    if (input === undefined && typeof req.text === "string") {
      const body = (BODIES.includes(req.body ?? "") ? req.body : voice.body) as BodyName;
      const style = (STYLES.includes(req.style ?? "") ? req.style : voice.style) as Style;
      const m = melodize(req.text, engine, { body, style, maxWords: req.maxWords, title: req.title });
      if (!m) return { ok: false, issues: [{ level: "error", message: "there are no words to sing in that text" }] };
      input = m;
    }
    if (input === undefined) return { ok: false, issues: [{ level: "error", message: 'send {"score": {...}} or {"text": "..."}' }] };
    const c = compile(input, engine, DEFAULT_LIMITS);
    issues.push(...c.issues);
    if (!c.ok || !c.melody) return { ok: false, issues };
    const melody = c.melody;
    melody.body ??= (BODIES.includes(req.body ?? "") ? req.body : voice.body) as BodyName;
    if (req.title && !melody.title) melody.title = req.title;
    const reply: SingReply = { ok: true, seconds: +c.seconds.toFixed(2), notes: c.notes, lyrics: melody.lyrics, issues };
    if (req.dryRun) return reply;
    if (req.replace) stopAll();
    reply.queued = queue.length + (current ? 1 : 0);
    reply.window = clients.size > 0;
    queue.push({ id: nextId++, melody, seconds: c.seconds });
    o.log(`song ${nextId - 1}: ${c.notes} notes, ${c.seconds.toFixed(1)} s: ${melody.lyrics}`);
    pump();
    return reply;
  }

  function file(pathname: string): Response {
    if (!existsSync(join(o.stageDir, "index.html"))) return new Response("The stage is not built yet. Run: bun run build", { status: 503 });
    const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
    let path = join(o.stageDir, rel);
    if (!path.startsWith(o.stageDir) || rel === "/" || !existsSync(path)) path = join(o.stageDir, "index.html");
    return new Response(Bun.file(path), { headers: { "cache-control": path.endsWith("index.html") ? "no-store" : "public, max-age=3600" } });
  }

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: o.port,
    async fetch(req, srv) {
      const url = new URL(req.url);
      const origin = req.headers.get("origin");
      if (url.pathname === "/ws") {
        // only the stage page may listen in
        if (origin && ![...self, ...devStage].includes(origin)) return new Response("forbidden", { status: 403 });
        return srv.upgrade(req) ? undefined : new Response("expected a WebSocket", { status: 400 });
      }
      if (req.method === "POST") {
        // a web page in the user's browser must not be able to drive this
        if (origin && !self.includes(origin)) return new Response("forbidden", { status: 403 });
        lastActivity = Date.now();
        let body: Record<string, unknown> = {};
        try {
          const text = await req.text();
          if (text.trim()) body = JSON.parse(text);
        } catch {
          return json({ ok: false, issues: [{ level: "error", message: "the request body is not JSON" }] }, 400);
        }
        switch (url.pathname) {
          case "/sing": {
            const reply = sing(body as SingRequest);
            return json(reply, reply.ok ? 200 : 422);
          }
          case "/stop":
            stopAll();
            return json({ ok: true });
          case "/voice":
            return json({ ok: true, voice: writeSettings({ body: String(body.body ?? ""), style: String(body.style ?? "") }).voice });
          case "/shutdown":
            setTimeout(() => stop(), 50);
            return json({ ok: true });
        }
        return json({ ok: false }, 404);
      }
      if (url.pathname === "/health") {
        const st = readSettings();
        const h: Health = { ok: true, pid: process.pid, windows: clients.size, queue: queue.length, singing: current !== null, voice: st.voice, auto: st.auto };
        return json(h);
      }
      return file(url.pathname);
    },
    websocket: {
      open(ws) {
        // one stage at a time: the newest sings, older windows step aside
        for (const old of clients) old.send(JSON.stringify({ type: "retire" }));
        clients.add(ws);
        lastActivity = Date.now();
        o.log(`stage connected (${clients.size})`);
      },
      close(ws) {
        clients.delete(ws);
        lastActivity = Date.now();
        o.log(`stage closed (${clients.size} left)`);
        if (!clients.size) {
          // the window was closed: that is a stop
          queue = [];
          if (current) {
            clearTimeout(current.timer);
            current = null;
          }
        } else if (current) done(current.song.id);
      },
      message(ws, raw) {
        let m: FromStage;
        try {
          m = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (m.type === "hello") pump();
        else if (m.type === "ended") done(m.id);
        else if (m.type === "error") {
          o.log(`stage could not sing song ${m.id}: ${m.message}`);
          done(m.id);
        }
      },
    },
  });

  const idle = o.idleMinutes
    ? setInterval(() => {
        if (!clients.size && !queue.length && Date.now() - lastActivity > o.idleMinutes * 60000) {
          o.log("idle: stopping");
          stop();
        }
      }, 30000)
    : null;

  function stop(): void {
    if (idle) clearInterval(idle);
    stopAll();
    server.stop(true);
  }

  o.log(`chimera-sing daemon on http://127.0.0.1:${server.port}/`);
  return { server, stop };
}
