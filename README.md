# chimera-sing 🎤

Your coding agent sings: its replies, and songs it composes, on the
[CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) physical-model voice, with a 3D head
whose tongue, lips and jaw move with the sound.

https://github.com/user-attachments/assets/9147c2ef-1e6e-4331-862b-6ff918f2bce5

## Install

Needs Node 18 or later (or Bun) and Chrome or Edge. The singing runs on your machine.

**Claude Code**

```
/plugin marketplace add exverbai/chimera-vocal-agent
/plugin install chimera-sing@chimera-vocal-agent
/sing on
```

**Codex**

```sh
codex plugin marketplace add exverbai/chimera-vocal-agent
codex plugin add chimera-sing@chimera-vocal-agent
```

Codex runs a plugin's hooks only once you approve them: open `/hooks` and trust the two
chimera-sing entries. Then type `sing on`.

**Oh My Pi**

```sh
omp plugin marketplace add exverbai/chimera-vocal-agent
omp plugin install chimera-sing@chimera-vocal-agent
```

Then `/sing on`.

**Pi** (the same extension; not yet tried in Pi itself)

```sh
pi install git:github.com/exverbai/chimera-vocal-agent
```

Then `/sing on`.

## Use

`/sing on` opens a small window with the singer: from then on your agent's chat replies are sung
(its words, never its code). `/sing off` ends it.

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

Without Chrome or Edge the window opens in your default browser and asks for one click before
it can sing.

## About this repository

This is the built plugin (version 0.2.0). Its source is the `agent/` folder of
[CHIMERA](https://github.com/jamesondh/chimera-vocal-synth), by Jameson Hodge (MIT);
`plugin/LICENSES` holds the licences of what it carries (the engine, the CMU Pronouncing
Dictionary, the fonts).
