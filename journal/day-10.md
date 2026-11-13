# Day 10 — Nov 13 — Factory with verification

Brief: https://github.com/orgs/qodo-hackathon/discussions/12. Put the whole path from ticket to
main on one diagram with its verification steps (before work starts, while the code is
uncommitted, before the merge), with the paths back to a fix and the points that need a human
decision; then check the diagram against one small real ticket. (The plan said "Test your
standards" for today; the thread is canonical.)

Status: in progress. Two pieces of work are in the tree, both uncommitted: the gap fixes
(local review gate stopped NOT MET after three fix rounds, then MET after a redesign the human
chose) and T-028 (built, not yet reviewed). The diagram (`FACTORY.md`) and the post are still
to do.

## Gaps the draft diagram exposed

Writing down each gate with "what must pass" and "what evidence" showed three boxes with nothing
behind them.

1. **No required checks.** The brief asks for passing required checks before the merge. The
   repository had two workflows, both for the agent; nothing ran `npm run check` on a pull
   request, and `main` has no branch protection. Every "green" so far was a local run on Windows.
2. **Nothing verified the steps after the merge.** On PR 21 the body said `(#20)`, not
   `Closes #20`, so the issue stayed open, and `BACKLOG.md` said `done (issue #20)` (Qodo's Low
   cf1c4585; the same kind of finding as 75293ebe on PR 19). Both were noticed by a person.
3. **The label lane skipped two gates.** `agent-ticket.yml` starts from a label, with no check
   of the ticket against the code, and the bot commits before any review ("gate pending").

## Gap fixes (local branch `day-10-required-checks`, uncommitted)

| Gap | What is in the tree now | Verified |
|---|---|---|
| 1 | `.github/workflows/check.yml`: `npm run check` on Ubuntu and Windows for every pull request and for `main`. Quality gate point 9 in `AGENTS.md`. | Not run, not even parsed (no YAML parser here). |
| 2 | `scripts/pr-ticket-check.ts`, `.github/workflows/ticket-link.yml`: a ticket pull request must close the ticket's own issue and carry the `BACKLOG.md` row `done (PR <number>)`. | Tests, written first each round; the real GitHub lookup run read-only on PRs 17, 19, 21. The workflow is not run. |
| 3a | `scripts/ticket-ready.ts` and a guard step in `agent-ticket.yml`: the label lane refuses an issue without a non-empty `**Investigation.**` section, removes the label and says why. Ticket format and `AGENTS.md` ask for the section. | Tests; run against the real T-028 ticket (exit 0). The step is not run. |
| 3b | Nothing. A Qodo review before the bot commits was built and then removed, see finding 1c731999. The lane still ends with "Implemented, gate pending". | — |

`npm run check` on the final tree: typecheck clean, `tests 215, pass 215, fail 0` (165 on
`main`; 10 of the 215 belong to T-028).

## The quality gate on the gap fixes: first NOT MET, stopped after three fix rounds

Qodo local review of the uncommitted change (CLI 2.3.1, skill 1.10.11), base `6dc9a90`, limited
to the gap-fix files, context file each round. Evidence: `evidence/day10/gapfix-*`.

| Review | Depth (effective) | New findings | Earlier findings |
|---|---|---|---|
| 1 | auto (standard) | 5: 2 High, 3 Medium | — |
| 2, after fix round 1 | deep (extended, two reviewers) | 5: 1 High, 3 Medium, 1 Low | all 5 `resolved` |
| 3, after fix round 2 | deep, full (path scope changed) | 6: 1 High, 3 Medium, 2 Low | not listed again |
| 4, after fix round 3 | deep, full (path scope changed) | 8: 1 High, 5 Medium, 2 Low | not listed again |

Fix rounds used: 3 of 3. The gate says stop, and the agent stopped.

Findings and decisions, by round:

| Finding | `action_level` → severity | Decision | Evidence |
|---|---|---|---|
| bb44ea06, 49bf2faa, e582e45f: factory scripts touch process streams outside `src/cli.ts` (Rule violation, rule 4522070) | High, High, then Medium | **Human decided: amend the rule.** `run()` returns the exit code and stream text; only the entry block writes. `AGENTS.md` now scopes the convention to `src/` and states the entry-block rule for `scripts/`. | Still listed in review 4 because Qodo's copy of the rule has the old text until the rules are imported again after the merge. |
| aad38bfd: `Closes #1` passed for T-008 | High | fixed | The closed issue's title is looked up through an injectable `IssueLookup`. |
| 0cc845e7: a second backlog row hid a stale one | Medium | fixed | Two rows for one ticket are a problem. |
| 8e3e55d2: the guard left the label on, so "add it again" did nothing | Medium | fixed | The guard removes the label. |
| 7626e3f0: a failed Qodo install stopped the ticket work | Medium | moot | The step was removed (1c731999). |
| 47242917: `ticket-link` gives an issue-reading token to a script from the pull request | High | **disputed by the agent**; not listed again in reviews 3 and 4 | On `pull_request` the workflow file itself comes from the pull request, so its author controls what runs with the token either way; the token is read-only on a public repository. Written above the permissions block in `ticket-link.yml`. Never decided by the human. |
| 1c731999: the agent's whole run could read `QODO_API_KEY` | Medium | fixed by removal | The optional Qodo review in `agent-ticket.yml` was taken out. Gap 3b is open again. |
| fc8fffff: `Closes #20` inside a comment or code counted | Medium | fixed | `visibleText()` in `scripts/markdown-text.ts`. This fix is where the loop started to grow. |
| e4ed609b: the guard was a `grep` in YAML with no test | Medium | fixed | `scripts/ticket-ready.ts` with tests. |
| 823561fb: a ticket PR without `T-NNN` in its title skipped the check | Medium | fixed | A pull request is a ticket PR also when it closes a ticket's issue. |
| 48562f07: `T-027: work split from T-008` counted as T-008's issue | Medium | fixed | The issue title must start with the id and a colon. |
| c6db41d9: an indented code line counted | Medium | fixed | Lines indented by four spaces or a tab are ignored. |
| d2451e51, 8b2a81e1, c51f36de | Low | reported, unchanged | A title that mentions an earlier ticket cannot pass; the guard rejects an indented heading and a section that starts with a sub-heading. |
| **Open after review 4:** | | | |
| 08503f66: an inline code span across a line break still counts | High | open | Not reproduced yet; no fix round left. |
| 62be8fe5: `<!--` inside code hides a later real keyword | Medium | open | |
| bad0f152: a long run of backticks can stall the regex | Medium | open | |
| ae243ccc: no limit on issue lookups per PR body | Medium | open | |
| 2569a9e5: if the comment fails after the label is removed, the ticket is stranded | Medium | open | |
| 4c47c944, fb5e3784 | Low | reported | Stale comments in the script header; any guard crash reads as "no investigation". |

**Quality gate: NOT MET.** A High and four Mediums are open, and three fix rounds did not clear
the gate. Nothing is committed.

## After the stop: the human chose the redesign, and the gate was met

The agent stopped and gave three options: redesign the closing check to ask GitHub, ship only
`check.yml` and the guard, or accept the open findings. The human chose the redesign, knowing it
needed a review beyond the three-round limit.

- `scripts/pr-ticket-check.ts` no longer reads the pull request body. One GraphQL request for
  `closingIssuesReferences` (at most 20 issues, more is an error) through an injectable lookup.
  The keyword regex, the Markdown reading of PR bodies and the per-issue lookups are deleted.
- `scripts/markdown-text.ts` shrank to one linear pass used only by the ticket guard.
- `agent-ticket.yml`: a comment that cannot be posted no longer hides the instruction (2569a9e5).
- Checked against GitHub for real, read-only, from this machine: PR 19 exit 0 (`T-007: closes its
  issue, BACKLOG.md says done (PR 19)`), PR 21 exit 1 (`GitHub lists no issue that this pull
  request closes`), PR 17 (docs) exit 0, a bad token exit 2 (`GitHub answered 401`).
- `tests 215, pass 215, fail 0` (222 before: the tests of the deleted parser went with it).

Review 5 (deep, full, coverage complete, `evidence/day10/gapfix-review-5-deep.json`):
`introduced: []`; `resolved`: 08503f66, 62be8fe5, bad0f152, ae243ccc, 2569a9e5, 4c47c944;
`still_open`: e582e45f and fb5e3784. The reviewer's comment: "Using GitHub's closing-issue
references is easier to trust than parsing the PR body by hand."

| Still listed | Severity | Decision |
|---|---|---|
| e582e45f: script entry blocks touch process streams | Medium | Settled by the human's rule amendment. The code follows `AGENTS.md` as it now reads; Qodo's copy of rule 4522070 has the old text until the rules are imported again after the merge. Recording that in Qodo needs the human. |
| fb5e3784: any guard crash reads as "no investigation" | Low | Reported, unchanged. |

**Quality gate on the gap fixes: MET, on two human decisions** (amend the stream rule; redesign
after the stop), with one thing still his to confirm: the disputed token finding 47242917, which
the reviewer has not listed since review 2. Five reviews, three fix rounds and one redesign.
Not verified by any of this: no workflow has run, and nobody knows how soon
`closingIssuesReferences` reflects an edited PR body.

## What the loop showed

- **The findings did not converge: 5, 5, 6, 8.** Each review confirmed the previous fixes and
  found new problems in the code those fixes added. From round 2 on, most of them are about one
  thing: the check reads Markdown by hand to decide whether GitHub would act on `Closes #20`.
  Every fix made that reader larger, and four of the five open findings are in it.
- **The agent's proposal, for the human: stop imitating GitHub and ask it.** The GraphQL field
  `closingIssuesReferences` on a pull request returns the issues it will close, with their
  titles. Checked read-only on three merged pull requests: PR 19 gives #18, PR 16 gives #15, and
  PR 21, the one that started this, gives nothing. That would delete the keyword regex, the
  Markdown reader for PR bodies and the per-issue lookups, and with them four open findings.
  Not done: it is a redesign, and the gate says a stalled loop stops for the human.
- **A fix that was a retreat.** Gap 3b (a Qodo review before the bot commits) was "fixed" in the
  morning by handing the agent an API key. The review was right that every test the agent runs
  for a ticket could then read it. The honest state is that the gap is open.
- **Two decisions needed a person, and only one got one.** The stream rule was put to the human
  as a question with three options and answered. The disputed token finding was argued in the
  review context instead, and the reviewer stopped listing it; by the gate a disputed High waits
  for the human, so it is still his to confirm.
- **Three full reviews instead of incremental ones.** Adding files to the path list each round
  changed the review scope, so Qodo could not reuse its checkpoint and reviewed everything again.

## PR 22: the gate before the merge

The human committed the gap fixes as `1433e3d` and opened PR 22.

**Required checks, first real run.** `check (ubuntu-latest)` passed in 15 s: the first time these
tests ran on Linux. `check (windows-latest)` passed in 44 s. `ticket-link` passed in 5 s with
`neither the PR title nor an issue it closes names a ticket (T-NNN); nothing to check`, so the
GraphQL lookup works with the job token.

**Qodo PR review** at head `1433e3d`, read with the Review Resolver skill
(`evidence/day10/pr22-review-1.json`): `completed`, `review_complete: true`, 11 findings, all
open. Five local reviews had ended with nothing new; the PR review still found 3 Highs and
5 Mediums. **Quality gate on the PR at `1433e3d`: NOT MET.**

| Finding | Severity | Decision | Evidence |
|---|---|---|---|
| 282b3a84: a PR author can edit the script or workflow so that `ticket-link` passes | High | **Human: dismiss as intentional.** | `AGENTS.md` already says the check catches slips, not intent; the human reads every PR. Hardening (run the script from `main`) is material for Day 20. |
| ee02db53: nothing makes the checks required | High | **Human approved branch protection now**; the agent turned it on. | Read back from the API: required contexts `check (ubuntu-latest)`, `check (windows-latest)`, `ticket-link`; admin bypass on; force pushes and deletions off. A repository setting, so no diff. |
| 49bf2faa, e582e45f: script entry blocks touch process streams | High, Medium | **Human: dismiss both as intentional.** | The rule was amended in this PR; Qodo's copy changes only when the rules are imported from `main` after the merge. |
| b6787850: the tests read the live `BACKLOG.md` | Medium | fixed | `tests/fixtures/backlog.md`; a backlog cleanup can no longer fail `npm test`. |
| 8f27403d: `ticket-link` read `BACKLOG.md` from the merge commit | Medium | fixed | The job checks out the pull request's head commit. |
| 842081ab: the guard judged the issue body from the label event | Medium | fixed | The step reads the current body with `gh issue view`. |
| b791ae9e: a guard crash was reported as a missing investigation | Medium | fixed | Exit 1 is the verdict; any other exit leaves the label on and posts nothing. This was Low fb5e3784 in the local review, left alone as the gate says, and came back as a Medium. |
| 641e42e4, c51f36de, d2451e51 | Low | reported, unchanged | A line that starts with three backticks and continues hides the rest of a ticket; sub-headings inside the section; a title that mentions an earlier ticket. |

The two workflow fixes cannot be tested by a test in `tests/`, so the guard step's script was
extracted from the workflow file and run locally against stand-in `gh` and `node` commands, six
outcomes (`evidence/day10/guard-step-simulation.txt`). `tests 215, pass 215, fail 0`.

## Gate 1 on T-028: the ticket checked against the code

Ticket `tickets/T-028-source-hygiene.md`, the rule borrowed from pasokh on Day 2. Investigated
with Codebase Wisdom on `main` at `6dc9a90` before anything was built; raw results in
`evidence/day10/raw/`. The backlog row was wrong in two places and the ticket changed:

- **The rule is already broken on `main`.** A raw byte order mark (U+FEFF) sits in a string
  literal at `src/gitlog.ts:99` and `tests/gitlog.test.ts:122`. Blame dates it to `f8e9b11`,
  Nov 5: the BOM fix from the review of PR 3. It passed every review since. The ticket gained a
  criterion to replace both.
- **"`src/` and `tests/`" was too wide.** `tests/fixtures/` holds raw bytes on purpose. Scope is
  `.ts` files, plus the new `scripts/`.
- **The evidence lied once.** The first grep, with the path filter `{src,tests}/**/*.ts`,
  returned `found: false` with no error; the tool does not expand braces. Caught only because the
  working tree was scanned too. An empty result needs a control query that must match.
- **PR history was not available.** `pull-request similar` and `by-file`: `MT-UPSTREAM-DOWN`,
  as on Day 6.

Human decision at gate 1: visible non-ASCII stays allowed ("agree"). Two more choices in the
ticket are the agent's and not yet confirmed (fix the two marks in the same pull request; the
detector lives in `scripts/`).

## T-028 built (uncommitted, not yet reviewed)

`scripts/source-hygiene.ts` (`findRawInvisible`, `describeRawInvisible`),
`tests/source-hygiene.test.ts` (10 tests), the two byte order marks replaced with escapes, a
line in `README.md`. Test-first: `evidence/day10/red-t028-1.txt` (no detector), then
`red-t028-2-raw-boms.txt`, where the new test failed on exactly the two lines the investigation
had found:

```
src/gitlog.ts:99:36 raw U+FEFF, write \uFEFF
tests/gitlog.test.ts:122:33 raw U+FEFF, write \uFEFF
```

Not done yet: rule 7 in `AGENTS.md` (criterion 1), the issue, the local review, the PR.

## What the agent missed

- **Raw invisible characters, four times in one day.** The agent's file writes turned intended
  escapes into the literal characters: U+2028 in a new test, U+FEFF twice in the T-028 ticket
  itself, U+2028 in this journal. Tests passed each time. Found by scanning for non-ASCII after
  every write. From then on the agent built such characters with `String.fromCharCode`.
- **The gate was skipped at first.** The gap fixes were reported as finished, with a suggested
  commit message, before any Qodo review. The human asked whether to commit or wait; the review
  then found two Highs.
- **A red run that proved nothing.** In fix round 1 the new tests failed on a missing export,
  not on the behavior. Rounds 2 and 3 have real red runs.

## Links

- Thread: https://github.com/orgs/qodo-hackathon/discussions/12
- Evidence: `evidence/day10/`
- PR: _TODO_
- Post: _TODO_
