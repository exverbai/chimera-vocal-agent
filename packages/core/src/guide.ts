/** How to write a score, short enough to ride along in a tool description. Shared by every adapter. */
export const SCORE_FORMAT = `Score: {"bpm": 96, "body": "female", "title": "...", "notes": [[pitch, beats, lyric], ...]}
- pitch: note name ("C4" is middle C, "F#3", "Bb4") or "-" for a rest (a breath).
- beats: length in beats (1 = a quarter note at bpm).
- lyric: ONE syllable per note. A trailing hyphen continues the word on the next note ("an-", "y-", "where"). "-" holds the previous vowel on a new pitch. End phrases with , . ! or ? and put a rest after them.
- body: "male" (sing C3-E4), "female" (A3-E5) or "child" (B3-D5). English words only; spell numbers out.
Example: {"bpm":96,"body":"female","notes":[["E4",1,"Breathe"],["C4",1,"in,"],["D4",1,"breathe"],["A3",1.5,"out,"],["-",0.5],["A3",0.5,"I"],["C4",0.5,"am"],["E4",1,"made"],["D4",0.5,"of"],["C4",2,"air."]]}`;

export const TOOL_DESCRIPTION = `Sing out loud to the user: a physically modelled voice (CHIMERA) sings your score in a window with an animated head. Use it when the user asks you to sing, or to celebrate or announce something in song. Keep songs short (2-4 lines, under 20 s). It returns at once while the song plays; warnings tell you what was repaired.
${SCORE_FORMAT}`;

export const TEXT_TOOL_DESCRIPTION = "Sing some plain text out loud to the user, to an automatic tune (no score needed). The CHIMERA voice sings it at once in its window. Use it when the user asks you to sing or say something aloud and the melody does not matter. English words; about 30 words at most are sung.";

export const STOP_TOOL_DESCRIPTION = "Stop the CHIMERA voice: cut the song being sung and drop any queued ones.";

export const SONG_PROMPT = (topic: string) =>
  `Sing me a short song${topic ? ` about: ${topic}` : " about what we just did"}. Write 2 to 4 rhyming lines with a simple, singable melody that moves mostly by step and ends on its home note, then call the \`sing\` tool once with the score. Do not explain the score; after the tool call, reply with just the lyrics.`;

/** JSON Schema of the `sing` tool's arguments (a score) */
export const SCORE_SCHEMA = {
  type: "object",
  properties: {
    bpm: { type: "number", description: "Tempo, 30 to 240" },
    body: { type: "string", enum: ["male", "female", "child"], description: "The voice (default: the user's chosen voice)" },
    title: { type: "string", description: "Shown above the singer" },
    notes: {
      type: "array",
      description: 'One [pitch, beats, lyric] per note, e.g. ["E4", 1, "Breathe"]; a rest is ["-", 1]',
      items: { type: "array", items: { type: ["string", "number"] } },
    },
  },
  required: ["bpm", "notes"],
} as const;
