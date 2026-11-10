# chimera-vocal-agent

Coding agents that sing. A reply, or a song the agent composes, is sung live by
[CHIMERA](https://github.com/jamesondh/chimera-vocal-synth), Jameson Hodge's physical-modelling
voice, in a small window with its animated head. First target: [Oh My Pi](https://github.com/can1357/oh-my-pi).

```
agent (omp extension, CLI) → daemon (127.0.0.1:5318) → WebSocket → stage window → CHIMERA sings
```

Nothing is rendered ahead of time: the stage page plans the song and the engine sings it in real
time, so a song starts well under a second after it is asked for.

## Set up

Needs [Bun](https://bun.sh) and a Chromium browser (Chrome or Edge; on WSL the Windows one is used).

```sh
git clone --recurse-submodules https://github.com/exverbai/chimera-vocal-agent && cd chimera-vocal-agent
bun run setup                     # engine, stage page, plugin bundles; remembers this checkout
bun run sing examples/air.json    # opens the window and sings
```

`bun run setup` records where this checkout is (`~/.config/chimera-vocal-agent/home`). Plugins an
agent installs are small copies; they find the daemon and the stage here.

## From a shell

```sh
bun run sing --text "The build is green. Shall I ship it?"   # any text, to an automatic tune
bun run sing examples/build-passed.json                      # a composed score
bun run sing check my-score.json                             # check without singing
bun run sing last                                            # the agent's last reply
bun run sing auto on                                         # every agent sings the start of each reply
bun run sing voice male chant                                # default voice and tune style
bun run sing stop | status | quit
```

## In your agent

There is no single plugin format that covers every agent, so one core (the daemon and its
client) sits behind three thin adapters:

| | tool the model calls | sing each reply, `/sing` |
|---|---|---|
| Claude Code | MCP server | shell hooks (`plugin/hooks`) |
| Codex | MCP server | shell hooks (the same script) |
| Oh My Pi, Pi | registered by the extension | the extension (`packages/omp`) |

The settings (`auto`, voice) are shared: turn auto on in one agent and all of them sing.

### Claude Code

```sh
claude --plugin-dir /path/to/chimera-vocal-agent/plugin          # for one session
# or install it for good:
claude plugin marketplace add /path/to/chimera-vocal-agent
claude plugin install chimera-sing@chimera-vocal-agent
```

- "Sing me a song about this bug" makes Claude compose with the `sing` tool.
- `/chimera-sing:sing` (or `/sing`) sings the last reply; add words to sing those instead.
  Also `song <topic>`, `auto on|off`, `stop`, `voice <male|female|child> [tune|chant]`, `status`.

### Codex

```sh
codex mcp add chimera -- bun /path/to/chimera-vocal-agent/plugin/bin/mcp.js    # the sing tools
# or the whole plugin (tools, skill and hooks):
codex plugin marketplace add /path/to/chimera-vocal-agent
codex plugin add chimera-sing@chimera-vocal-agent
```

Codex runs a plugin's hooks only after you approve them: open `/hooks` in Codex and trust the two
chimera-sing entries. Without them the tools still work; auto mode needs the hooks. Codex has no
plugin slash commands, so ask in words ("sing that") and toggle with `bun run sing auto on`.

### Oh My Pi and Pi

```sh
omp plugin link packages/omp      # Oh My Pi; or for one session: omp -e packages/omp/index.ts
pi install ./packages/omp         # Pi (the same extension; not yet run inside Pi itself)
```

- The agent gets a `sing` tool and writes scores itself.
- `/sing` sings the last reply. `/sing <text>` sings that text. `/sing song [topic]` asks for a composed song.
- `/sing auto on` sings the opening of every reply the moment it ends. `/sing stop`, `/sing voice child`.

## Scores

One syllable per note, `[pitch, beats, lyric]`:

```json
{"bpm": 96, "body": "female", "notes": [["E4", 1, "Breathe"], ["C4", 1, "in,"], ["D4", 0.5, "an-"], ["E4", 0.5, "y-"], ["G4", 2, "where."], ["-", 1]]}
```

See `plugin/skills/compose-song/SKILL.md` for the rules and worked examples.

## Layout

- `vendor/chimera`: upstream, a git submodule. The stage imports its engine and views unchanged.
- `packages/stage`: the window (one 3D head, the words at its mouth, a piano roll).
- `packages/daemon`: the local server and the `chimera-sing` command.
- `packages/core`: score compiler, automatic melody, text clean-up, window opener, shared
  settings, and the one `/sing` handler every adapter uses.
- `packages/mcp`, `packages/hooks`: the MCP server and the hook script, bundled into `plugin/bin`.
- `plugin/`: what Claude Code and Codex install (manifests, hooks, command, skill, bundles).
- `packages/omp`: the Oh My Pi / Pi extension.

## Checks

```sh
bun run test                          # score, melody, daemon, MCP, hooks, extension, plugin copy
bun run typecheck
bun packages/stage/tools/e2e.ts       # headless: daemon + stage sing a song end to end
```

## Credits

The voice, the engine and the views are [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth)
by Jameson Hodge (MIT). The per-note lyric score and the check-with-fixes idea follow
[GottZ/hermes-chimera](https://github.com/GottZ/hermes-chimera). The pronouncing dictionary is
CMUdict (see `vendor/chimera/public/data/CMUDICT-LICENSE.txt`).
