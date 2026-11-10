/**
 * The plugin as an agent installs it: its folder copied somewhere else, with none of the
 * checkout around it. The bundles must find the checkout through the pointer, and say what to
 * do when there is none.
 */
import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../../core/src/paths.ts";

const copy = join(mkdtempSync(join(tmpdir(), "plugin-copy-")), "chimera-sing");
cpSync(join(ROOT, "plugin"), copy, { recursive: true, dereference: true });

async function mcp(env: Record<string, string>, calls: unknown[]): Promise<any[]> {
  const p = Bun.spawn(["bun", join(copy, "bin/mcp.js")], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { PATH: process.env.PATH!, HOME: process.env.HOME!, ...env } });
  for (const c of calls) p.stdin.write(JSON.stringify(c) + "\n");
  p.stdin.end();
  const out = await new Response(p.stdout).text();
  await p.exited;
  return out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const CALLS = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
  { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "sing_text", arguments: { text: "hello" } } },
];

test("the plugin folder is complete and its bundles are current", async () => {
  for (const f of ["plugin.json", "mcp.json", ".claude-plugin/plugin.json", "hooks/hooks.json", "commands/sing.md", "skills/compose-song/SKILL.md", "bin/mcp.js", "bin/hook.js"]) expect({ f, there: existsSync(join(copy, f)) }).toEqual({ f, there: true });
  for (const f of ["plugin.json", "mcp.json", ".claude-plugin/plugin.json", "hooks/hooks.json"]) JSON.parse(readFileSync(join(copy, f), "utf8"));
  // rebuilt from source, the bundles are byte for byte what is committed (`bun run build:plugin`)
  const fresh = mkdtempSync(join(tmpdir(), "bundle-"));
  for (const [src, name] of [["packages/mcp/src/server.ts", "mcp.js"], ["packages/hooks/src/on-event.ts", "hook.js"]]) {
    const r = Bun.spawnSync(["bun", "build", join(ROOT, src), "--target", "bun", "--outfile", join(fresh, name)], { cwd: ROOT });
    expect(r.exitCode).toBe(0);
    expect({ name, same: readFileSync(join(fresh, name), "utf8") === readFileSync(join(copy, "bin", name), "utf8") }).toEqual({ name, same: true });
  }
});

test("a copy with no checkout to be found says how to set up", async () => {
  const empty = mkdtempSync(join(tmpdir(), "no-home-"));
  const out = await mcp({ XDG_CONFIG_HOME: empty, XDG_CACHE_HOME: empty, CHIMERA_SING_PORT: "5393" }, CALLS);
  expect(out[0].result.serverInfo.name).toBe("chimera-sing");
  expect(out[1].result.isError).toBe(true);
  expect(out[1].result.content[0].text).toContain("bun run setup");
});

test("a copy finds the checkout through the pointer and starts its daemon", async () => {
  const cfg = mkdtempSync(join(tmpdir(), "with-home-"));
  mkdirSync(join(cfg, "chimera-vocal-agent"), { recursive: true });
  writeFileSync(join(cfg, "chimera-vocal-agent/home"), ROOT + "\n");
  const env = { XDG_CONFIG_HOME: cfg, XDG_CACHE_HOME: cfg, CHIMERA_SING_PORT: "5394", CHIMERA_SING_OPEN: "0" };
  try {
    const out = await mcp(env, CALLS);
    expect(out[1].result.isError).toBeUndefined();
    expect(out[1].result.content[0].text).toContain("hello.");
  } finally {
    await fetch("http://127.0.0.1:5394/shutdown", { method: "POST", body: "{}" }).catch(() => {});
  }
});
