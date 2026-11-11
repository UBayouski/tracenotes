# Day 08 — Nov 11 — Review before you commit

Brief: https://github.com/orgs/qodo-hackathon/discussions/10. Have the agent implement a small
backlog task and leave it uncommitted, run Qodo local review on the staged and unstaged changes
with the task requirements and implementation decisions as context, read the findings together,
fix the ones the human agrees with, rerun on the still-uncommitted code. (The plan said "Bring the
spec into review" for today; the thread is canonical.)

## What changed in the loop

Days 4 to 7 reviewed code after it was committed and pushed: the bot commits on `agent/*`, a human
opens the PR, Qodo reviews the PR. Today the review ran before any commit existed, so the factory
bot could not do the work (it commits). T-007 was implemented in an interactive Claude Code session
on a local branch, and the review was `qodo review` from the `qodo-review` skill 1.10.11 (Qodo CLI
2.2.0). The only thing Qodo needed on the remote was the base commit `25903fb`.

## The task

`tickets/T-007-json-output.md`, issue #18 (no label, nothing triggered): `render --format json`
prints the release notes as a JSON document with the same content as the Markdown notes. Ten
criteria. Built: `notesDocument()` and `renderJson()` in `src/render.ts`, `renderMarkdown()`
rebuilt on the same document so the formats cannot drift, `--format markdown|json` in
`src/cli.ts`, exports, tests. The 101 existing tests were not edited and still pass.

## Review scope

Six files against `25903fb`: `src/cli.ts`, `src/index.ts`, `src/render.ts` and the ticket staged;
`tests/cli.test.ts` and `tests/render.test.ts` unstaged. From run 3 on, `src/cli.ts` was both
staged and unstaged. The CLI reported 30,650 bytes of local changes for run 1, which is exactly
`git diff HEAD | wc -c`, so staged and unstaged were both sent. Context: issue #18 as `--ticket`,
plus a context file with eight decisions (who made each and why), the upstream constraints the
reviewer cannot see in the diff, and the checks run.

| Run | Depth (effective) | Tree | Result |
|---|---|---|---|
| 1 | auto (standard) | first implementation, 122 tests | 0 findings, "Nothing to comment" |
| 2 | deep (extended, two reviewers) | same | 0 findings, 3 optional comments |
| 3 | deep | + union type for `format` | 1 finding: 277d5eae |
| 4 | deep | + last `--format` wins, 123 tests | nothing new; 277d5eae listed `still_open`, stale |

## Comments, the finding, and decisions

Run 2's three optional comments, read together before any change:

1. `format` typed `string` instead of `'markdown' | 'json'`. Correct and free. **Human: apply.**
2. `--format` errors do not print usage. The error line already says `expected markdown or json`,
   criterion 9 asks for an error naming the value, and `--repo-url` errors behave the same.
   **Human: no change.**
3. Every repeated `--format` value is validated, not only the last. The agent reproduced it:
   `--format yaml --format json` exits 2, while `--repo-url http://bad --repo-url https://github.com/a/b`
   exits 0. Criterion 9 says both "any other value exits 2" and "the last one wins, as `--repo-url`
   already behaves". The agent recommended keeping the strict behavior and amending the ticket.
   **Human: not selected.**

**Finding 277d5eae** (Correctness, remediation recommended, `src/cli.ts:146-148`), run 3: "A bad
--format blocks a later valid one." Same subject as comment 3. Run 3's context said the human had
chosen not to change it; the reviewer answered that the behavior conflicts with the ticket's
repeated-options rule and called it "a decision for the team rather than a clear bug".

- What the code and the ticket showed: the finding is right. The ticket as written says last wins,
  the neighbouring option already works that way, and a wrapper that sets a default format and
  then overrides it is a realistic caller. The agent's tests covered only repeated *valid* values.
- The agent changed its recommendation from "amend the ticket" to "fix the code": the ticket was
  not wrong, the code was, and Day 7 showed what happens when the spec is edited to fit the code.
- Decision (human): fix. Red test first (`--format yaml --format json` → `2 !== 0`), then the
  option loop keeps the raw value and the last one is validated after the loop, still before stdin
  is read. `--format json --format yaml` and a missing value still exit 2.
- Recorded in Qodo as `implemented` before any commit (`evidence/day08/mark-implemented-result.json`,
  `reconciled: true`).

## Checks

- `npm run check` on the final uncommitted tree: typecheck clean, tests 123, pass 123, fail 0
  (101 before the ticket, 122 after the first implementation).
- Manual: `git log ... -4 | node src/cli.ts render --format json --repo-url https://github.com/UBayouski/tracenotes`
  printed a valid document with full SHAs and commit URLs.
- Run 4 covered the final tree (32,286 bytes, coverage complete) and raised nothing new.

## What the agent or review missed

- **The agent wrote the contradiction into the ticket** and then implemented one half of it.
  "Last wins, as `--repo-url` behaves" was written without running `--repo-url` twice.
- **The agent's first recommendation was to bend the ticket.** The review, not the agent, made
  the case for the caller who overrides a default.
- **Two clean passes were not the end.** Standard depth saw nothing; deep saw the issue but filed
  it as an optional comment. It became a finding only in run 3, after the context said the
  behavior was being kept. A clean local review means "nothing at this depth with this context".
- **The rerun did not close the finding.** Run 4 lists 277d5eae as `still_open` with run 3's
  description and a code snippet that is no longer in the file (`grep` for it returns nothing).
  Another participant in the thread saw the same. The agent stopped rerunning, as the skill says,
  and the outcome was recorded by hand.
- **Unresolved, small:** run 4's optional comment asks to word `NotesCounts.total` as "parsed input
  commits", since malformed records are outside `total`. Not applied; it would change the reviewed
  tree. `--repo-url` errors and README coverage of `render` are untouched and out of scope.

## After the commit: the PR review

The human committed everything as `3673123` and opened PR 19. Qodo's PR review (run 1915739,
extended effort, completed at `3673123` = PR head) did not raise the repeated-`--format` issue
again. It had two informational findings, both right, both in what the local loop left behind:

- **83cdca80** `NotesCounts.total` was documented as "Input commits", but malformed records are
  outside `total`. This is the run-4 comment that was left unapplied to keep the reviewed tree
  unchanged; the PR review cited that evidence file. Fixed: the doc comment now says so.
- **75293ebe** `BACKLOG.md` said `built, uncommitted` in the commit that delivers the ticket.
  Fixed: `done (PR 19)`.

The human pushed the fixes as `dedc5fa`. Qodo re-reviewed on its own (run 1915915, standard
effort, completed at `dedc5fa` = PR head): both findings attributed `implemented`, no new ones,
0 open. Nobody had to mark them by hand, unlike the local finding.

Neither review noticed that the commit subject starts with `     - ` (a pasted list marker), so
tracenotes files its own T-007 commit under *Unclassified*. AGENTS.md asks for Conventional
Commits; no rule enforces it on the commit message itself. Raw PR findings:
`evidence/day08/pr19-findings.json`.

## Lesson

The context file decides what the review argues with. Eight written decisions gave two clean
passes; one more sentence ("the user chose to keep this") turned a side comment into a finding,
because it gave the reviewer a decision to disagree with. Write down what was decided and by whom,
including the choices you are least sure of, and record each finding's outcome before the commit,
while the local review reference is still valid.

## Links

- Issue: https://github.com/UBayouski/tracenotes/issues/18
- Ticket: `tickets/T-007-json-output.md`
- Evidence: `evidence/day08/`
- PR: https://github.com/UBayouski/tracenotes/pull/19 (squash-merged by the human as `7a1d606`
  with a clean `feat(render): ...` subject, so tracenotes lists it under Features with its PR
  link; issue #18 closed by the merge)
- Post: https://github.com/orgs/qodo-hackathon/discussions/10#discussioncomment-19549395
