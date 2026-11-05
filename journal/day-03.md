# Day 03 — Nov 04 — Feed your agent a ticket

## Ticket

`tickets/T-002-read-git-log-stream.md`: read commits from a `git log` stream on stdin, with a
fixed field and record separator contract, SHA validation, and a `malformed` list so nothing
vanishes. Nine acceptance criteria, each independently checkable.

## Plan

1. Repository is pushed and connected to Qodo (Day 1 and 2 evidence).
2. Branch `t-002-git-log-stream`.
3. Agent implements T-002 from the ticket alone, without extra hints.
4. Compare the result against each of the nine criteria. Record which were met, which were
   missed, and which the ticket itself left ambiguous.
5. Open the PR, run Qodo review, note what the review caught that the criteria check did not.

## Result

_TODO after implementation._

| # | Criterion | Met? | Notes |
|---|---|---|---|
| 1 | Splits on 0x1E / 0x1F, returns commits in order | | |
| 2 | Invalid SHA goes to `malformed` with reason | | |
| 3 | Fewer than four fields reported, not thrown | | |
| 4 | Empty input returns empty result | | |
| 5 | Message content untouched by splitter | | |
| 6 | `count` equals commits + malformed | | |
| 7 | Date kept as string, shape warning only | | |
| 8 | CLI `log` command, exit codes | | |
| 9 | Fixture with the five required record kinds, no git in tests | | |

## What the agent missed

_TODO._

## Evidence

- PR: _TODO_
- Qodo review: _TODO_
