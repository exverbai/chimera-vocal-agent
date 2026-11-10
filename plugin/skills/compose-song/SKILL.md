---
name: compose-song
description: Compose a score for the `sing` tool (CHIMERA voice). Format, vocal ranges, the one-syllable-per-note rule and worked examples. Read before writing a song longer than a couple of lines.
---

# Singing with CHIMERA

The `sing` tool plays a score on a physically modelled voice, live, in a window with an animated
head. Nothing is rendered ahead of time, so the song starts as soon as the tool returns.

## Score

```json
{"bpm": 96, "body": "female", "title": "Made of air", "notes": [["E4", 1, "Breathe"], ["C4", 1, "in,"]]}
```

Each note is `[pitch, beats, lyric]`:

- **pitch**: a note name (`C4` is middle C, `F#3`, `Bb4`) or a MIDI number. `"-"` is a rest.
- **beats**: the note's length in beats. At `bpm` 120 one beat is half a second.
- **lyric**: one syllable.
  - A trailing hyphen continues the word on the next note: `"an-"`, `"y-"`, `"where"`.
  - `"-"` (or no lyric) holds the previous vowel on a new pitch.
  - End a phrase with `,` `.` `!` or `?`, and follow it with a rest so the voice can breathe.

Other fields: `bpm` (30 to 240, one tempo), `body` (`male`, `female`, `child`), `title`,
`vibrato` (cents, 0 to 100, default 35).

## Rules that keep it sounding good

1. **One syllable per note.** The pronouncing dictionary decides how many syllables a word has.
   If you give a word too few notes its last note is split, and too many holds the last vowel.
   Both come back as warnings: fix the score next time.
2. **Stay in range.** Outside it the voice strains.

   | body | comfortable | best |
   |---|---|---|
   | male | D2 to A4 | C3 to E4 |
   | female | F3 to C6 | A3 to E5 |
   | child | A3 to A5 | B3 to D5 |

3. **Move by step, leap rarely**, and end on the home note of the key.
4. **Stressed syllables get the beat and the longer note.** Short words like "the" and "of" get
   half beats.
5. **Keep it short**: two to four lines, under 20 seconds. Notes under 0.1 s blur.
6. English words only. Spell numbers out ("forty two"). No code, paths or symbols in lyrics.

## Example 1: a calm line (female, C major)

```json
{"title":"Made of air","bpm":96,"body":"female","notes":[
["E4",1,"Breathe"],["C4",1,"in,"],["D4",1,"breathe"],["A3",1.5,"out,"],["-",0.5],
["A3",0.5,"I"],["C4",0.5,"am"],["E4",1,"made"],["D4",0.5,"of"],["C4",2,"air."],["-",1],
["F4",1,"Sing-"],["E4",0.5,"ing"],["D4",0.5,"an-"],["C4",0.5,"y-"],["D4",2,"where."]]}
```

## Example 2: good news, with a held note (male, C major)

```json
{"title":"The build passed","bpm":120,"body":"male","notes":[
["C3",0.5,"All"],["E3",0.5,"the"],["G3",1,"tests"],["A3",1,"are"],["G3",2,"green,"],["-",0.5],
["E3",0.5,"the"],["G3",1,"build"],["C4",1.5,"went"],["B3",0.5,"-"],["A3",2,"through."],["-",1],
["F3",0.5,"No-"],["A3",0.5,"thing"],["G3",1,"left"],["E3",1,"to"],["D3",1,"do,"],
["E3",0.5,"ex-"],["D3",0.5,"cept"],["C3",3,"ship."]]}
```

## Example 3: a question that rises (child, D major)

```json
{"title":"A question","bpm":88,"body":"child","notes":[
["D4",1,"Shall"],["E4",0.5,"I"],["F#4",0.5,"run"],["A4",1,"the"],["B4",0.5,"mi-"],["A4",0.5,"gra-"],["F#4",1,"tion"],["A4",1,"now,"],["-",0.5],
["B4",0.5,"or"],["A4",1,"wait"],["F#4",0.5,"for"],["E4",0.5,"your"],["F#4",1,"re-"],["A4",3,"view?"]]}
```

## Commands the user has

`/sing` sings your last reply to an automatic tune. `/sing <text>` sings that text.
`/sing song [topic]` asks you for a composed song. `/sing auto on|off` sings every reply.
`/sing stop`, `/sing voice male|female|child [tune|chant]`.
