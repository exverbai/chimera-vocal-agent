#!/bin/sh
# Runs one of the plugin's bundles (daemon, mcp, hook) with Node or Bun, whichever is here.
# Hooks and MCP servers are started by the agent with whatever PATH it has, so look around.
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
script="$dir/$1.mjs"
shift
if command -v node >/dev/null 2>&1; then exec node "$script" "$@"; fi
if command -v bun >/dev/null 2>&1; then exec bun "$script" "$@"; fi
for candidate in "$HOME/.bun/bin/bun" /usr/local/bin/node /opt/homebrew/bin/node /usr/bin/node; do
  if [ -x "$candidate" ]; then exec "$candidate" "$script" "$@"; fi
done
echo "chimera-sing needs Node 18 or later (or Bun) on the PATH: https://nodejs.org" >&2
exit 127
