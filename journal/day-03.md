# Day 03 — Nov 04 — Feed your agent a ticket

Done on Nov 05 (catching up).

## Ticket

`tickets/T-002-read-git-log-stream.md`: read commits from a `git log` stream on stdin, with a
fixed field and record separator contract, SHA validation, and a `malformed` list so nothing
vanishes. Nine acceptance criteria, each independently checkable.

## Process

1. Ticket written first, with a definition of done per criterion.
2. Agent (Claude Code) implemented it from the ticket text, with AGENTS.md as the only other
   instruction. No extra hints during implementation.
3. Result compared against each criterion before the PR was opened.
4. PR opened for Qodo review.

## Result against the acceptance criteria

| # | Criterion | Met? | Notes |
|---|---|---|---|
| 1 | Splits on 0x1E / 0x1F, returns commits in order | yes | `parseGitLog` in `src/gitlog.ts`; order test on the fixture. |
| 2 | Invalid SHA goes to `malformed` with reason | yes | Reason includes the offending value. Commits list excludes it. |
| 3 | Fewer than four fields reported, not thrown | yes | Reason is exactly `missing fields`; separate fixture. |
| 4 | Empty input returns empty result | yes | Also whitespace-only and separator-only input. |
| 5 | Message content untouched by splitter | yes | Multi-paragraph body with indentation, breaking footer, and refs survive. Only the framing newline before the SHA is stripped. |
| 6 | `count` equals commits + malformed | yes | 6 on the basic fixture: 5 commits + 1 malformed. |
| 7 | Date kept as string, shape warning only | yes | A `git log` default-format date yields a warning, not a malformed record. |
| 8 | CLI `log` command, exit codes | yes | Exit 0 with malformed records present, exit 2 on empty stdin. |
| 9 | Fixture with the required record kinds, no git in tests | yes | `tests/fixtures/log-basic.bin`, six records. No test shells out. |

Verification: `npm run check` passes, 44 tests (24 parser, 9 git log, 11 CLI). The repository's
own history piped through `tracenotes log` returns 7 commits and 0 malformed records, from both
Git Bash and PowerShell 5.1.

## What the agent missed, or decided without being told

- **Criterion 8 tests live in `tests/cli.test.ts`, not `tests/gitlog.test.ts`.** The ticket's
  verification section said all new tests go in `gitlog.test.ts`. The agent followed the
  AGENTS.md convention instead (CLI behavior is tested as a child process in `cli.test.ts`).
  Right call, but a deviation from the ticket as written. The ticket should not have specified
  the file.
- **More than four fields.** The ticket defined behavior for fewer than four fields and said the
  message "may contain any text except the two separator bytes", but did not say what to do if
  a separator does appear inside a message. The agent chose to join the extra fields back into
  the message rather than report the record as malformed, and added a test. A reasonable
  reading, but the ticket left it open.
- **Framing whitespace.** Git prints a newline after each record, so every record after the
  first begins with `\n`. The ticket did not mention this. The agent stripped leading whitespace
  before the SHA field. Without that, every record after the first would have failed the SHA
  check. The ticket author (me) had not noticed it either.
- **Fixture file marked binary.** `.gitattributes` got a `*.bin binary` line so the LF policy
  cannot touch the control characters. Not in the ticket; necessary.
- **Still missing, and not in the ticket:** `tracenotes log` with a TTY on stdin blocks instead
  of printing usage. Same gap as `parse`. Carried forward from Day 1.

## Lesson

The ticket was clear enough that eight of nine criteria mapped one-to-one onto tests. The two
gaps were both about the input contract's edges, not the logic: the framing newline and
separator collisions. Writing a fixture by hand before the ticket would have exposed both.
Next ticket: produce the fixture first, then write the criteria against it.

## Qodo review

_TODO after the PR review._

## Evidence

- PR: _TODO_
- Qodo review: _TODO_
