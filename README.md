# chimera-sing

Your coding agent sings its replies, and songs it composes, on the CHIMERA physical-model voice.

Install the plugin, say `/sing on`, and a small window opens with a singing head: from then on
your agent's chat replies are sung (its words, never its code). `/sing off` ends it.

The voice is [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) by Jameson Hodge, a
physical model of the vocal tract. It sings live in the window; nothing leaves your machine.

Needs Node 18 or later (or Bun) and Chrome or Edge. Without those browsers the window opens in
your default browser and asks for one click.

## Claude Code

```
/plugin marketplace add exverbai/chimera-vocal-agent
/plugin install chimera-sing@chimera-vocal-agent
/sing on
```

## Codex

```sh
codex plugin marketplace add exverbai/chimera-vocal-agent
codex plugin add chimera-sing@chimera-vocal-agent
```

Codex runs a plugin's hooks only once you approve them: open `/hooks` and trust the two
chimera-sing entries. Then type `sing on`.

## Oh My Pi

```sh
omp plugin marketplace add exverbai/chimera-vocal-agent
omp plugin install chimera-sing@chimera-vocal-agent
```

Then `/sing on`.

## Pi

```sh
pi install git:github.com/exverbai/chimera-vocal-agent
```

Then `/sing on`.

## What you can say

| | |
|---|---|
| `/sing on`, `/sing off` | sing mode: every reply is sung as it ends |
| `/sing` | sing the last reply again |
| `/sing <words>` | sing those words |
| `/sing song <topic>` | the agent composes a short song and sings it |
| `/sing length short\|normal\|full` | the opening of a reply, about half a minute (default), or all of it |
| `/sing voice male\|female\|child [tune\|chant]` | the singer and the style of the automatic tune |
| `/sing stop`, `/sing status` | |

Or just ask: "sing me a song about this bug", "turn on sing mode", "sing it with a band". A new
prompt stops the song.

A band (lead, harmony, bass and a beatboxer, each with its own head) is new in 0.2. Every voice
is a whole simulated airway running live in your browser, so a band needs a fast machine: on a
slower one the voices can drift apart. One voice runs anywhere.

## About this repository

This is the built plugin (version 0.2.0). Its source is the `agent/` folder of
[CHIMERA](https://github.com/jamesondh/chimera-vocal-synth); `plugin/LICENSES` holds the
licences of what it carries (the engine, the CMU Pronouncing Dictionary, the fonts).
