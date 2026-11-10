/**
 * The stage's line to the daemon: songs come in over a WebSocket, one at a time, and the stage
 * says when each started and ended. It reconnects by itself (the daemon may start after the page).
 */
import type { Melody } from "./player.ts";

export interface LinkHandlers {
  sing: (m: Melody) => Promise<"ended" | "stopped">;
  stop: () => void;
  state: (connected: boolean) => void;
  /** another window has taken over: this one stops listening */
  retired: () => void;
}

/** where the daemon listens: the page's own host when the daemon serves it, else ?daemon= or the default */
function daemonHost(): string {
  const q = new URLSearchParams(location.search).get("daemon");
  if (q) return q;
  return import.meta.env.DEV ? "127.0.0.1:5318" : location.host;
}

const RETRY_MS = 700;

export function connect(h: LinkHandlers): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    if (closed) return;
    const sock = new WebSocket(`ws://${daemonHost()}/ws`);
    ws = sock;
    const send = (m: unknown) => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify(m));
    sock.onopen = () => {
      h.state(true);
      send({ type: "hello" });
    };
    sock.onmessage = (e) => {
      let m: { type: string; id?: number; melody?: Melody };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.type === "stop") h.stop();
      else if (m.type === "retire") {
        closed = true;
        h.stop();
        sock.close();
        h.retired();
        // an app window may close itself; a browser tab stays and says why it is quiet
        window.close();
      }
      else if (m.type === "sing" && m.melody && m.id !== undefined) {
        const id = m.id;
        send({ type: "started", id });
        h.sing(m.melody).then(
          (how) => send({ type: "ended", id, how }),
          (err) => send({ type: "error", id, message: err instanceof Error ? err.message : String(err) }),
        );
      }
    };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      h.state(false);
      if (closed) return;
      // steady and quick: a restarted daemon waits about a second for its window before opening another
      timer = setTimeout(open, RETRY_MS);
    };
    sock.onerror = () => sock.close();
  };
  open();

  return () => {
    closed = true;
    clearTimeout(timer);
    ws?.close();
  };
}
