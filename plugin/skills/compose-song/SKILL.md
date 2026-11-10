---
name: compose-song
description: Compose a score for the `sing` tool (CHIMERA voice). Format, vocal ranges, the one-syllable-per-note rule, arranging for a band (harmony, bass, beatbox), writing a parody, worked examples. Read before writing a song longer than a couple of lines, a band, or a parody.
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

## A band

When the user wants music, not just a voice, write a band: up to four voices, each with its own
head on the stage. There are no instruments: every part is a voice, as in an a cappella group.

```json
{"title":"Made of air (band)","bpm":100,"voices":[
{"name":"lead","body":"female","notes":"E4/1/Breathe C4/1/in, D4/1/breathe A3/1.5/out, -/0.5 A3/0.5/I C4/0.5/am E4/1/made D4/0.5/of C4/2/air. -/1 F4/1/Sing- E4/0.5/ing D4/0.5/an- C4/0.5/y- D4/2.5/where."},
{"name":"low","body":"male","notes":"C4/1/Breathe A3/1/in, B3/1/breathe F3/1.5/out, -/0.5 F3/0.5/I A3/0.5/am C4/1/made B3/0.5/of A3/2/air. -/1 A3/1/Sing- C4/0.5/ing B3/0.5/an- A3/0.5/y- B3/2.5/where."},
{"name":"bass","body":"male","notes":"A2/1/dum A2/1/dum G2/1/dum F2/1/doo","repeat":4},
{"name":"beat","beat":"B . t . | Pf . t . | B . t B | Pf . t ."}]}
```

- Write notes as the string `pitch/beats/lyric` with spaces between notes (`-/1` is a rest).
  It is the same as the list form and much shorter.
- **lead** (name it so): the tune, in the middle of its range.
- **harmony**: the lead's rhythm and words, a third or a sixth below. Same syllables, same
  beats, so it moves with the lead.
- **bass**: chord roots, two octaves under the lead, on "dum", "doo", "bom". Write one bar or
  two and loop it with `"repeat"`.
- **beat**: a pattern of sixteenth steps, `.` for a rest, `|` only for reading.
  `B` kick, `t` and `tss` hi-hat, `Pf` and `K` snare, `kch` open hat. One or two bars; it loops
  for the whole song. The band starts with one bar of beat alone.
  - Pop: `B . t . | Pf . t . | B . t B | Pf . t .`
  - Four on the floor: `B . t . | B . tss . | B . t . | B . tss .`
- Every voice uses the same `bpm`. Make the voices about the same length in beats.
- Under 60 s. Two choruses, or a verse and a chorus, fit; a whole song does not.

## A parody

New words on a known tune. To make it land:

1. Keep the original's **syllable count and stresses** line by line, so the new words fit the
   tune's rhythm. Count before you write the notes.
2. Keep its **whole rhyme scheme**, not just the obvious end rhymes:
   - write the scheme down first, line by line (A A B C C D, …);
   - every pair of line endings that rhymes in the original rhymes in yours, including long
     lines that rhyme across a gap (line 3 with line 6);
   - a word in the middle of a line that rhymes with the lines before it (an internal rhyme)
     rhymes in yours too;
   - before you call the tool, read your lines' endings aloud in order and fix any that fail.
3. Keep its **hook** recognizable: the short signature phrase that opens its best-known lines (two or
   three words, such as a title's first words) may stay as it is, sung on the same notes, so
   listeners know the song at once. Everything after it is new.
4. Apart from that signature phrase, write **every word new**. Reuse no line of the original lyrics.
5. Give the melody your best recollection of the tune, simplified: the hook's rhythm matters
   more than every pitch. A second chorus can reuse the first one's notes with new words.
6. In your reply, give the new lyrics only, not the original ones.

Example, on "Daisy Bell" (1892), scheme A B C D, lines 2 and 4 rhyme:
> Daisy, Daisy, give me your answer, do → Merge it, merge it, give me your approval, do
> I'm half crazy all for the love of you → My PR's been waiting since half past two

## Commands the user has

`/sing on` turns sing mode on: every reply is sung as it ends (its chat text, never code);
`/sing off` stops that. `/sing` sings your last reply to an automatic tune, `/sing <text>` sings
that text, `/sing song [topic]` asks you for a composed song. Also `/sing stop`,
`/sing length short|normal|full`, `/sing voice male|female|child [tune|chant]`.
