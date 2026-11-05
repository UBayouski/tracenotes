# T-026: Print usage instead of blocking when stdin is a terminal

**Goal.** `tracenotes parse` and `tracenotes log` must not hang waiting for input when a user runs
them in a terminal with no argument and no pipe. Carried forward from the Day 1 and Day 3 journals.

**Context.** Today `readStdin()` in `src/cli.ts` awaits `process.stdin` unconditionally. In an
interactive shell that blocks until Ctrl-D, with no hint of what went wrong.

**Acceptance criteria.**

1. When `parse` has no message argument and stdin is a terminal (`process.stdin.isTTY === true`),
   the CLI prints a one-line error (`error: no commit message given and stdin is a terminal`)
   followed by the usage text to stderr, and exits 2 without reading stdin.
2. When `log` is run and stdin is a terminal, same behavior with
   `error: no git log stream on stdin (stdin is a terminal)`.
3. Piped and redirected stdin keep working exactly as before: every existing test in
   `tests/cli.test.ts` passes unchanged.
4. `parse <message>` with an argument never consults stdin, TTY or not.
5. `main(argv, io?)` accepts an optional `io` object
   `{ stdinIsTTY: boolean, readStdin: () => Promise<string> }` so the TTY branch is testable
   without a pseudo-terminal. The default `io` reads the real process. No other module gains access
   to process streams (AGENTS.md: process output stays in `cli.ts`).
6. Tests: one test each for criteria 1, 2 and 4 using an injected `io`; criterion 3 is covered by
   the existing child-process tests; one new child-process test confirms piped stdin still parses.
7. `USAGE` text says that `parse` and `log` read stdin only when it is not a terminal.

**Out of scope.** Interactive prompting, reading a message from an editor, Windows console
specifics beyond `isTTY`.

**Verification.** `npm run check` passes. Manual: `node src/cli.ts log` in a terminal returns
immediately with exit code 2; `git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' -3 | node src/cli.ts log`
still prints JSON.

**Status.** Ticket written on Day 4 as the first job to run through the automation trigger.
