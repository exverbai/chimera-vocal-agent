---
description: Sing the last reply, or some text, on the CHIMERA voice
argument-hint: "[text | song <topic> | auto on|off | stop | voice <male|female|child> [tune|chant] | status]"
---
<chimera-sing>$ARGUMENTS</chimera-sing>

The chimera-sing hook carries out this command and adds its outcome to this prompt as context.

- If the context holds a line starting with `[chimera-sing result]`, reply with only the text after that marker, and call no tools.
- If the context asks you to compose a song, do that with the `sing` tool.
- If there is no such context (the hook did not run), do it yourself: for words, call the `sing_text` tool with the text between the tags; for `stop`, call `stop_singing`; otherwise say that the chimera-sing hooks need enabling.
