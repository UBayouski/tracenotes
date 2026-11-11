# Day 8 evidence — Qodo local review of uncommitted T-007

Raw output from `qodo review` (skill `qodo-review` 1.10.11, Qodo CLI 2.2.0). See `journal/day-08.md`.
Base for every run: `25903fb` (`main`, pushed). Nothing was committed between runs. Common flags:
`--base 25903fb... --ticket https://github.com/UBayouski/tracenotes/issues/18 --json --extended`.

| File | Run | State of the working tree | Result |
|---|---|---|---|
| `context-1.json` | context for runs 1 and 2 | | 8 decisions, notes, recent work |
| `review-1.json` | run 1, auto depth (effective: standard) | 30,650 B: `src/*` and the ticket staged, `tests/*` unstaged | 0 findings, "Nothing to comment", coverage complete |
| `review-2-deep.json` | run 2, `--deep` (effective: extended), paths `src tests tickets` | same tree as run 1 | 0 findings, 3 optional comments |
| `context-2.json` | context for run 3 | | adds the human's choice (union type only) |
| `review-3-rerun.json` | run 3, `--deep` | 30,663 B: union type for `format`; `src/cli.ts` both staged and unstaged | 1 finding introduced: 277d5eae, repeated `--format` |
| `context-3.json` | context for run 4 | | adds the human's choice to fix 277d5eae |
| `review-4-rerun.json` | run 4, `--deep` | 32,286 B: last `--format` wins, new test | no new finding; 277d5eae `still_open` with its run-3 text and a code snippet that no longer exists; 1 optional comment |
| `mark-implemented-result.json` | `qodo pr-review-session mark-implemented --finding-ids 277d5eae-... --local-review-id 78909a70-...` | same tree as run 4 | `implemented`, `reconciled: true` |

`*.stderr.txt` files hold the CLI's scope line for each run (bytes reviewed, depth, trace id).
Runs 2 to 4 were limited to `src tests tickets` so this evidence folder stayed out of the diff.
