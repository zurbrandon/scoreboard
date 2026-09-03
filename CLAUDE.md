# Showboard

## Comms — collect screen recordings every turn

Brandon sends feedback as screen recordings (narration + drawings) through
Comms. They are **not** pushed into the conversation; they wait until asked for.
So, every turn:

```
/Applications/Comms.app/Contents/Helpers/comms next
```

Run it **when you start work, and again before you say you are done** — he may
have recorded something while you were busy. It prints one folder per waiting
recording, or nothing. Read each one before doing anything else:

```
/Applications/Comms.app/Contents/Helpers/comms session "<folder>"
```

That is the brief: annotations first (what was drawn, when, and what was said
over it), then the timed transcript. `comms frames "<folder>" 12.5` gets a still
at any second if the brief doesn't cover something.

**Staying reachable.** This harness can be woken by a background process, so the
better form here is to leave a listener running:

```
comms listen   # via Bash with run_in_background: true
```

It exits the moment a recording is addressed to this session, which arrives as a
task notification carrying the folder path. Re-arm it after each delivery — a
listener that has fired is no longer listening. If no listener is up, `next`
still works but only reaches him for 15 minutes after the last run.

**When replying to a recording**, open by quoting one line of what he said,
marked as his. His words never appear in the transcript — only mine — so without
a quote the conversation reads as a monologue and he can't tell where his
feedback landed.
