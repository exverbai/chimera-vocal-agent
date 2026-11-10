---
description: "Have the agent compose a short song and sing it"
argument-hint: "<topic>"
---
<chimera-sing>song $ARGUMENTS</chimera-sing>

The sing plugin's hook carries out this command and adds its outcome to this prompt as context.

- If the context holds a line starting with `[chimera-sing result]`, reply with only the text after that marker, and call no tools.
- If the context asks you to compose a song, do that with the `sing` tool.
- If there is no such context (the hook did not run), do it yourself with the sing tools (`sing_mode` for on and off, `sing_text` for words, `stop_singing` for stop), or say that the plugin's hooks need enabling.
