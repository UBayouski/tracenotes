# Day 9 evidence — quality gate on uncommitted T-008

Raw output from `qodo review` (skill `qodo-review` 1.10.11, Qodo CLI 2.3.0). See `journal/day-09.md`.
Base for both runs: `280c2fd` (`main`, pushed). Nothing was committed or staged between runs.
Common flags: `--base 280c2fd... --ticket https://github.com/UBayouski/tracenotes/issues/20 --json --extended`,
pathspec `. ":(exclude)evidence" ":(exclude)journal"`.

| File | What | State of the working tree | Result |
|---|---|---|---|
| `context-1.json` | context for run 1 | | 10 decisions with their owner, notes, recent work |
| `review-1.json` | run 1, auto depth (effective: standard) | 57,776 B: first implementation, 161 tests | 2 findings, both `remediation_recommended`: e7cc6b40 (invalid UTF-8 accepted), 9f986931 (newline in the path forges error lines); coverage complete |
| `red-round1.txt` | `npm test` after adding the tests for both findings, before the fix | same tree plus three tests | 3 failing, 161 passing |
| `context-2.json` | context for run 2 | | adds the fix decisions and the fix round |
| `review-2-deep.json` | run 2, `--deep` (effective: extended, two issue reviewers) | 61,683 B: after fix round 1, 164 tests | full review; 0 introduced, 0 still open, both findings `resolved` with `attribution_status: implemented`; two reviewer comments; coverage complete |

`*.stderr.txt` files hold the CLI's scope line for each run (untracked files included, bytes
reviewed, depth, trace id).
