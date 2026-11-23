# Day 16 — Nov 23 — Scan your repo with Arnica

Brief: https://github.com/orgs/qodo-hackathon/discussions/18. Connect one repository to Arnica
(code, dependencies, infrastructure configuration, secrets) in scan-only mode, confirm the
analysis finished, investigate one finding with the agent and decide (fix, investigate further,
or dismiss with a reason), and add the scan to the Day 10 diagram. A completed scan with no
findings is a valid result. A fix is optional. (The plan said "Wire up the factory" for today;
the thread is canonical. T-015 and T-029 move to a free slot.)

Status: done except the post. T-035 (PR 36) and T-037 (PR 38) merged; Arnica: 5 findings resolved automatically, 3 dismissed with a reason, none open.

## Setup constraint

Arnica connects GitHub organizations only (its GitHub guide, and confirmed by Arnica in the
thread: a free organization works). `UBayouski/tracenotes` belongs to a personal account. Plan:
a free organization used only for this, holding a fork of the repository at the same commit;
only that fork is selected in Arnica. The fork runs no workflows and carries no secrets.

- Original: `UBayouski/tracenotes`, `main` at `b349b8b`.
- Fork: `IoT-Forge-Labs/tracenotes` (organization, free plan, public, `main` only), `main` at
  `b349b8b`. Same commit and same tree (`fbc2bdd`) as the original, read with `gh api` at
  17:59 UTC: `evidence/day16/01-fork-same-commit.txt`. The fork has 0 workflow runs and 0
  secrets; the organization had no GitHub app installed at that time.

## Predictions, written before the scan

Written on Nov 23 before the repository was connected, from the code at `b349b8b`.

| Arnica job | Prediction | Why |
|---|---|---|
| SCA / licenses | 0 findings | No runtime dependencies. Dev dependencies are `typescript` (Apache-2.0) and `@types/node` (MIT). |
| Secrets | 0 real secrets; a false alarm is possible | No tokens in the tree (rule 4). Test fixtures hold synthetic URLs with credentials for the `render --origin` tests, which a pattern scanner may flag. |
| IaC | 0 findings | No infrastructure files, unless Arnica counts workflows here. |
| SAST | 1 to 5 findings, the most likely one on `actions/checkout` | No workflow sets `persist-credentials: false`: five checkout steps in four files (`check.yml` has one step run on two systems). Another participant got this rule as a Medium. Less likely: `execFileSync` in `src/cli.ts`, and a `RegExp` built from the configuration file in `src/config.ts:30`. |

What would be worth a fix if it is reported: the checkout credential in `check.yml` and
`ticket-link.yml`, which never push. The two agent workflows push to `agent/*` branches, so the
same line there needs an investigation of what the action uses to push before anything changes.

## Scan

Arnica's GitHub app was installed on the organization at 18:22 UTC
(`evidence/day16/02-arnica-installation.txt`; access "all repositories", and the organization
holds only the fork). All four scans completed within three minutes; none failed, none was still
running (`evidence/day16/03-arnica-jobs.png` and `.txt`).

| Arnica job | Scope shown | Completed (UTC) | Result shown |
|---|---|---|---|
| SCA/License Scan | `tracenotes#main` | 18:24:53 | Done (0 findings) |
| IAC Scan | `tracenotes#main` | 18:25:26 | Done (0 findings) |
| Secrets Scan | `tracenotes#main` | 18:25:26 | Done (1 findings) |
| SAST Scan | `tracenotes#main` | 18:25:39 | Done (6 findings) |

The job cards name the branch, not a commit. The fork's `main` was at `b349b8b` before the
installation and after it, so that is the commit scanned.

Seven findings, all open (`evidence/day16/04-arnica-code-findings.csv`,
`05-arnica-secrets-finding.png`, cropped above the panel that shows the author's email):

| # | Arnica severity | Type | Where | Description |
|---|---|---|---|---|
| 1 | Medium | SAST | `.github/workflows/agent-ticket.yml#L50` | GitHub actions artipacked vulnerability |
| 2 | Medium | SAST | `.github/workflows/agent-fix.yml#L53` | same rule |
| 3 | Medium | SAST | `.github/workflows/check.yml#L40` | same rule |
| 4 | Medium | SAST | `.github/workflows/ticket-link.yml#L45` | same rule |
| 5 | Low | SAST | `src/config.ts#L30` | Detect non literal regexp |
| 6 | Low | SAST | `.claude/skills/release-notes-audit/scripts/audit.ts` (the `RegExp` built from the repository URL) | Detect non literal regexp |
| 7 | Info | Secret | `tests/remote.test.ts#L106` | Credentials in URL; validation "Invalid" (Arnica tried it: "The response code is 4XX") |

Arnica's links point at the commit that last touched each line, not at the scanned head.

## Finding investigated

Findings 1 to 4, one rule: `actions/checkout` without `persist-credentials: false` leaves the
job's token in the work tree's git configuration for every later step. The rule is named after
the case where a later step uploads the work tree as an artifact and the token leaves with it.

What the agent inspected (`evidence/day16/06-artipacked-investigation.txt`):

- No workflow uploads an artifact, a Pages bundle or a cache of the work tree. The leak the rule
  is named after cannot happen here.
- The run logs confirm the mechanism: `persist-credentials: true`, and
  `git config --local http.https://github.com/.extraheader AUTHORIZATION: basic ***` in
  `.git/config`, on Linux and on Windows.
- `check.yml` and `ticket-link.yml`: the token is read-only on a public repository
  (`Contents: read`). The steps after the checkout run the pull request's own code
  (`npm run check`), which can read the token, but the token reads nothing a visitor cannot.
  Neither job runs git after the checkout, so the stored credential has no use.
- `agent-ticket.yml` and `agent-fix.yml`: here the token can write (`Contents`, `Issues`,
  `PullRequests`). Between the checkout and the agent step it sits in `.git/config` while the
  guard script and `npm ci` run. On an issue label and on a pull request comment those come
  from `main`. On a review comment (`pull_request_review_comment`) the checkout is the pull
  request's merge commit, so `npm ci` installs what an `agent/*` branch asks for with the write
  token in reach: the one place where this finding is more than hygiene.
  The agent action then removes it itself ("Removing existing git authentication headers") and
  puts its own app token into the remote URL to push. So the checkout credential is not what
  the bot pushes with, and `persist-credentials: false` should not break the lane. That is
  read from the log of a Nov 10 run on the `v1` tag; it has not been run on the pinned version
  with the option set.
- What the scanner does not see: the action's own write token sits in the remote URL while the
  agent runs `npm run check`, that is, tests a ticket asked for. It is revoked when the job
  ends. Removing the checkout credential does not change that; it is the same family as the
  Day 10 finding that kept the Qodo key out of this job.

Severity as Arnica gives it: Medium for all four. The agent's reading: low for the two check
workflows (read-only token, public repository), real but narrow for the two agent workflows
(write token for a few steps; trusted code except on the review-comment path).

Decision (human, Nov 23): fix all four. Reason: one line per workflow, no job uses the stored
credential, and the two agent workflows hold a write token.

Decisions on the other three are still open; the agent's proposal is to dismiss all three in
Arnica with the reasons below, without a code change.

The other three, read but not the finding of the day:

- 5: `src/config.ts:30` compiles the user's own ignore patterns from `.tracenotes.json`. That
  is the feature (T-008). A slow pattern can only stall the run of the person who wrote it.
- 6: the audit script builds one expression from the repository URL after escaping every
  special character in it.
- 7: the value on that line (a URL with a made-up user, password and `token` parameter) is a
  fixture in a test that
  proves a rejected remote never appears in an error message. Arnica marked it Invalid itself.
  Other made-up credential URLs in `tests/cli.test.ts` were not flagged.

## The fix: T-035

Ticket `tickets/T-035-checkout-credentials.md`, issue #35 (no label), local branch
`t-035-checkout-credentials`, built in the session, pull request 36.

- Test first: `scripts/checkout-credentials.ts` and `tests/checkout-credentials.test.ts`. The
  repository test was red on exactly Arnica's four lines (`evidence/day16/t035/tests-red.txt`):
  `agent-fix.yml:53`, `agent-ticket.yml:50`, `check.yml:40`, `ticket-link.yml:45`. The check
  fails closed, like the pin check.
- Fix: `persist-credentials: false` in the four checkout steps, five added lines, nothing else
  changed in the workflows. `AGENTS.md` process rule, `BACKLOG.md` rows T-035 and T-036.

Qodo local reviews of the uncommitted tree (CLI 2.4.0, deep, issue #35 as the ticket), all
under `evidence/day16/t035/`:

| Review | Result | What followed |
|---|---|---|
| 1 | Did not run: `AGENT-QUOTA-EXCEEDED`, credit balance exhausted. | Stop, reported to the human. The human restored credits. |
| 2 | 3 findings; coverage incomplete (two screenshots skipped). High ea881e83: a comment set the block's indentation, so text inside a multi-line value counted as the option. Medium 5dcf1618: a `uses` value with a YAML escape spells the action without its name. Medium a73703d7: the `BACKLOG.md` row says `planned`, so `ticket-link` is red. | Fix round 1, red first (`tests-red-review-2.txt`): every line of the `with:` block must be `key: plain value` at one indentation; a `uses` line with a quote or backslash is reported. a73703d7 left for the human. |
| 3 | First attempt failed upstream (stream closed), one retry. Coverage complete (screenshots excluded by path). ea881e83 and 5dcf1618 not listed again. New Medium 4397bda9: `Actions/Checkout` in another letter case is skipped. d6f052b6: the `BACKLOG.md` row again. | Fix round 2, red first (`tests-red-review-3.txt`): the mention is matched without regard to case. |
| 4 | Coverage complete. 4397bda9 `implemented`. New Medium 140b01cb: the script's entry block and exit status had no test. Low 14bdfd21: this journal section described the state before the reviews. d6f052b6 still open. | Fix round 3, the last one allowed: three child-process tests; this section rewritten. |
| 5 | Coverage complete, the final tree. Nothing new. 140b01cb and 14bdfd21 `implemented`. d6f052b6 still open. | Stop: three fix rounds used, one Medium open and disputed. |

Disputed, waiting for the human: d6f052b6 (a73703d7 in review 2), Medium. The finding is right
that `ticket-link` is red on the first commit. That is how the check was designed on Day 10:
the pull request number does not exist before the pull request, so the row is set to
`done (PR n)` in the second commit, as on pull requests 24, 33 and 34.

Gate report, uncommitted tree, after review 5 (run `4ee88574`, deep, full, coverage complete):

| Finding | Category | `action_level` / severity | Status | Decision |
|---|---|---|---|---|
| ea881e83 | Security | `action_required` / High | fixed in round 1; not listed since review 3 | valid, fixed test-first |
| 5dcf1618 | Correctness | `remediation_recommended` / Medium | fixed in round 1; not listed since review 3 | valid, fixed test-first |
| 4397bda9 | Security | `remediation_recommended` / Medium | `implemented` (review 4) | valid, fixed test-first |
| 140b01cb | Testability | `remediation_recommended` / Medium | `implemented` (review 5) | valid, tests added |
| 14bdfd21 | Maintainability | `informational` / Low | `implemented` (review 5) | journal rewritten |
| d6f052b6 (a73703d7) | Correctness | `remediation_recommended` / Medium | open | disputed by the agent: by design, set on the pull request; the human decides |

`npm run check`: 384 pass, 0 fail. Fix rounds: 3 of 3. Deep reviews completed: 4, the last one
on the final tree. This section's row 5 and this report were written after review 5, in
Markdown only.

**Quality gate: NOT MET.** One Medium is open and disputed; a disputed finding blocks until the
human decides. (Decided the same hour: by design, see "Pull request 36".)

Unresolved verification, stated before the pull request exists:

- The two check workflows are verified by their own runs on the pull request.
- The two agent workflows are not run by this ticket. Unverified until a labelled ticket and
  an `@claude` comment have each run with the pinned action and pushed successfully. Qodo's
  reviewer asked for the same in reviews 2, 3 and 4.
- The check reads `.github/workflows/` only. A checkout step in a composite action under
  `.github/actions/` would not be seen; there is none today.
- Arnica: after the merge the fork is synced and the findings are read again.

## Pull request 36

The human accepted d6f052b6 as by design, made the first commit (`fae957a`) and opened
https://github.com/UBayouski/tracenotes/pull/36 (`Closes #35`).

| Head | Checks | Qodo review |
|---|---|---|
| `fae957a` (human) | `ticket-link` failed, as designed: the row said `planned`. `check` was cancelled by the next push. | run 2119543, superseded |
| `44fe418` (agent: `BACKLOG.md` row `done (PR 36)`) | `check (ubuntu-latest)`, `check (windows-latest)`, `ticket-link`: all pass. 384 tests on Windows; 383 and one skip on Linux (a Windows-only test). | run 2119561: completed for `44fe418`, `review_complete: true`, **0 findings** |

- The option took effect in the pull request's own run (45245253974): the log shows
  `persist-credentials: false`, and the credential is removed inside the checkout step
  (`git config --local --unset-all http.https://github.com/.extraheader`) before `setup-node`
  starts. Before the fix it stayed until the post-job cleanup. That verifies `check.yml`;
  `ticket-link.yml` ran green with the same option.
- Prediction in the pull request body: no "Qodo approved" label, because the change is inside
  the approval guard. Observed: clean complete review at the head, no label, no `labeled` event
  (`evidence/day16/pr36/issue-events.json`). The guard held, as on pull request 34.
- d6f052b6 did not come back in the PR review: the row was `done (PR 36)` at the reviewed head.

**Gate on pull request 36: MET at `44fe418`.** Checks green on the head, Qodo's review completed
for the head with no finding open, merge state clean. The human merges. Evidence:
`evidence/day16/pr36/`.

Still open after the merge: sync the fork and read Arnica again (criterion 7); run both agent
paths once before the label lane is relied on (criterion 6).

## After the merge: Arnica again

The human fixed the pull request's title (two leading spaces) and body (a bare mention of the
`claude` account, from the agent's draft), then merged pull request 36 as `1a6f865` at 19:15:09
UTC; issue #35 closed; `Check` green on `main`. The fork was synced: `IoT-Forge-Labs/tracenotes`
and `main` are both at `1a6f865`, tree `66ec99c`. Arnica rescanned on the push, with nothing
started by hand. Exports read at 19:37 UTC: `evidence/day16/07-arnica-followup-code.csv` and
`07-arnica-followup-secrets.csv`.

| Finding | Before (`b349b8b`) | After (`1a6f865`) |
|---|---|---|
| 4 Medium, checkout keeps the token | Open | **Resolved Automatically**, all four |
| Low, `src/config.ts#L30` | Open | Open |
| Low, audit script | Open | Open |
| Info, credential URL in `tests/remote.test.ts#L106` | Open | Open, "Present in HEAD: false" |
| Info, credential URL in `journal/day-16.md#L121` | did not exist | **new**, Open, Invalid, first detected 19:16:16 UTC |

- Criterion 7 of T-035: met. With the status filter widened, Arnica lists six code findings:
  the four Mediums as "Resolved Automatically", last updated a minute after the merge, and the
  two Lows open (`evidence/day16/08-arnica-followup-code.png`,
  `09-arnica-resolved-automatically.png`, read at 19:41 UTC). The audit-script finding now
  points at line 236, its place on the merged `main`.
- The new finding is the agent's own doing: this journal quoted the made-up credential URL from
  the test in full, in the paragraph that explains why the first secret finding is harmless,
  and the scanner found the quote one minute after the merge. The line now describes the value
  without repeating it; the next sync should clear it.
- The export says the test fixture is no longer present in HEAD. The file and the line are
  unchanged on `main`; not explained.

## The two Lows: one dismissed, one fixed (T-037)

After the follow-up scan the human asked whether both Low findings could be fixed.

- `src/config.ts#L30`: not without changing the product. The line compiles the ignore patterns
  a user writes in `.tracenotes.json` (T-008). Any expression built from input is flagged, so
  the finding closes only if patterns stop being regular expressions. Decision (human): dismiss
  in Arnica as intentional.
- The audit script: fixable. Decision (human): fix it, ticket T-037, issue #37 (no label).

T-037, local branch `t-037-audit-fixed-link-pattern`, built in the session:

- `audit.ts` built one expression from the repository URL, with its special characters escaped,
  to find an entry line's own commit links. It now uses a fixed pattern for any commit link with
  a full SHA and compares the link's base to the repository URL with `===`. No `RegExp(` call
  is left in the file.
- A guard test for what the escaping was for: a base that differs only where the URL has a dot
  is another repository. It passed before the change and passes after it
  (`evidence/day16/t037/tests-before-change.txt`).
- Same report before and after, byte for byte, on three saved input sets: the Day 16 range
  `b349b8b..8f88b60` (5 commits, `audit-before.txt`, `audit-after.txt`) and the two Day 13
  histories of 76 commits (`audit-saved-ranges.txt`, old script against new on the same inputs).
- `npm run check`: 385 pass, 0 fail.

Qodo local reviews (deep, issue #37 as the ticket), under `evidence/day16/t037/`:

| Review | Result |
|---|---|
| 1 (run `d8069e44`) | Nothing on the code. Coverage incomplete: `audit-inputs/stream.bin` skipped as binary. One finding, e8894004, High, Reliability: "Saved audit lacks its input stream". |
| 2 (run `790d2336`) | That directory excluded by path; coverage complete. Nothing on the code. One Low, daf8384b: the review-2 output files looked empty. |

Both findings describe the review's own view, not the tree:

- e8894004: `stream.bin` is in `evidence/day16/t037/audit-inputs/`, next to the files derived
  from it. The reviewer could not see a file it had skipped. Disputed by the agent as a false
  positive; a disputed High blocks until the human decides.
- daf8384b: the two files are the output of the review that was running; they are written when
  it ends and are not empty now.

The reviewer's note on review 2 is right and kept: for a hand-edited line with an unescaped `](`
before a valid link, the verdict is the same (the audit fails) but the detail text can differ
from the old script's. Lines the renderer writes are not affected.

Gate report, uncommitted tree, after review 2:

| Finding | Category | `action_level` / severity | Status | Decision |
|---|---|---|---|---|
| e8894004 | Reliability | `action_required` / High | open (review 1), not re-evaluated in review 2 | disputed: the file exists; the human decides |
| daf8384b | Observability | `informational` / Low | open | reported: the files are filled when the review ends |

`npm run check`: 385 pass. Fix rounds: 0 (one comment added after review 1, no code path
changed). Deep reviews completed: 2, the last one on the final tree without the binary inputs.

**Quality gate: NOT MET** until the human decides e8894004.

## Pull request 38

The human made the first commit (`8e15dc9`, with this journal in it) and opened
https://github.com/UBayouski/tracenotes/pull/38 (`Closes #37`) without ruling on e8894004; the
agent took that as the go-ahead, as on pull request 36. The finding did not come back.

| Head | Checks | Qodo review | Label |
|---|---|---|---|
| `8e15dc9` (human) | superseded by the next push | run 2120538, aborted | |
| `6ab70d6` (agent: `BACKLOG.md` row `done (PR 38)`) | `check` on Linux and Windows, `ticket-link`: pass | run 2120562 (lite): completed for the head, `review_complete: true`, no High or Medium, 2 Lows | "Qodo approved" added by `qodo-code-review[bot]` at 20:05:50 UTC (the change is outside the approval guard) |

Gate MET at `6ab70d6`. The two Lows were both about the pattern this ticket introduced:

- 2d187faa, Performance: every `](` started a scan to the end of the line, so a long line of
  them cost time in the square of its length. The expression it replaced did not.
- af1da7c7, Correctness: the base could run across an earlier unescaped `](`, so on a
  hand-edited line the entry's own link was swallowed and reported as "entry not linked". Same
  verdict as before, different detail text. Qodo's local review 2 had said the same in a note.

Decision (human): fix both. One change: the base stops at `]` and `(` as well as at `)` and
whitespace, in both link patterns. Red first (`evidence/day16/pr38/tests-red.txt`: the detail
text, and 1124 ms for a line of 30 000 unclosed `](`; the test now uses 60 000 and takes about a
millisecond). 387 tests. The original script (`8f88b60`) and the new one still give
byte-identical reports on the three saved input sets (`evidence/day16/pr38/audit-old-vs-new.txt`).

The fix for a scanner's "non literal regexp" finding had put a slow path into the fixed
expression that replaced it; the next reviewer found it. The review of the head that carries
this section is read after the push and recorded on `main` with the merge note.

## After the merge of pull request 38

The fix commit `62fd843` (agent) went through the same gate: checks green, Qodo run 2120687
(standard) completed for the head, both Lows `implemented`, nothing new. Qodo removed the
"Qodo approved" label when the commit arrived (20:11:44 UTC) and added it again after the review
(20:13:11 UTC). Gate MET at `62fd843`. The human merged pull request 38 as `f453e5b` at 20:16:06
UTC; issue #37 closed; `Check` green on `main`; the fork synced to the same commit and tree
(`96f949a`). Evidence: `evidence/day16/pr38/`.

Arnica, read at about 20:21 UTC (`evidence/day16/10-arnica-final-secrets.png`,
`11-arnica-final-code.png`) and, after the human dismissed the two secret findings, at about
20:25 UTC (`12-arnica-secrets-dismissed.png`):

| Finding | Arnica severity | Final status | How |
|---|---|---|---|
| Checkout keeps the token, 4 workflows | Medium | Resolved Automatically | T-035, pull request 36 |
| Non-literal regexp, audit script | Low | Resolved Automatically | T-037, pull request 38 |
| Non-literal regexp, `src/config.ts#L30` | Low | Dismissed | the human, as intentional: user-written ignore patterns are the feature |
| Credentials in URL, `tests/remote.test.ts#L106` | Info | Dismissed | the human: not a secret, a made-up fixture |
| Credentials in URL, `journal/day-16.md#L121` | Info | Dismissed | the human: not a secret; see below |

The journal finding did not clear by itself, although `main` no longer holds the value (the line
was reworded in `8e15dc9`; `git grep` on `main` finds it only in the tests). At the 20:21 read
Arnica still showed it Open and "Present in HEAD"; at the 20:25 read that mark was gone, but
the finding had stayed open until it was dismissed by hand. The value is in the history of `main` (commit `fae957a`), and a secret
that was once committed stays a finding until someone rules on it: for a real secret that is
the right behaviour, since rewording the file would not un-leak it. Code findings resolve when
the code changes; secret findings do not.

Day 16 in numbers: 7 findings from the first scan, 1 more caused by this journal. 5 resolved by
two pull requests, 3 dismissed by the human with a reason (one intended behaviour, two made-up
values). Nothing is open. None of the eight was a real secret.

## Predictions against the result

| Job | Predicted | Observed |
|---|---|---|
| SCA / licenses | 0 | 0 |
| IaC | 0 | 0 |
| Secrets | 0 real, a false alarm possible on test fixtures | 1, a test fixture, marked Invalid by Arnica. Right kind, wrong file: I named `tests/cli.test.ts`, it was `tests/remote.test.ts`. |
| SAST | 1 to 5, most likely the checkout credential | 6: the checkout credential in all four workflows, the `RegExp` in `src/config.ts:30` as predicted, and one I did not list, the `RegExp` in the audit script. `execFileSync` was not flagged. |

## Where this fits

`FACTORY.md`: after `main`, a security scan step drawn as taken (the human syncs the
organization fork, Arnica scans it), then the human reads the findings and decides, and a fix
goes back to the top as a new ticket. Arnica checks on the pull request are dashed: they need
the repository itself in an organization. A gate-table row, a "Checked against the Arnica scan
and T-035" section and two new known gaps: the scan sees a copy, after the merge, when a person
syncs it; and the agent action's own write token is in reach of ticket-written tests (T-036).

Status line at the top of this file: the scan, the investigation and the fix are done; the
pull request, the follow-up Arnica read and the post are not.

## What I missed

- The agent quoted a credential-shaped fixture into the journal, and the scan after the merge
  reported it as a new secret. Rule 4 (no secrets) was not broken, the value is made up, but a
  scanner cannot know that, and evidence written about a finding became a finding.
- The agent's draft of the pull request body held a bare mention that GitHub turned into a
  notification for a real account. No workflow ran (the agent workflow listens to comments, not
  bodies). In text that goes to GitHub, a handle goes in backticks.
- The first prediction for the secrets scan named the wrong test file.
- Qodo's local review found five holes in the check written around a five-line fix, one of them
  High. The fix was right from the start; the guard for it was not.
- The Arnica app was installed with access to all repositories of the organization, not a
  selected one. Read back with `gh api`; harmless today, since the fork is alone there.
- The secrets screenshot showed the account email in the details panel. Cropped before it went
  into `evidence/`.
- The agent reported the journal as committed on `main` (`8f88b60`) after checking only that the
  working tree was clean. The commit held the evidence files; the journal edits (the follow-up
  section, this section, the reworded credential line) were in a stash made when the branch was
  switched. So the fork was synced with the quoted value still in the journal, and that Arnica
  finding could not clear. Found later in the same session while adding the T-037 section; the journal now
  travels with the T-037 pull request. "Clean tree" is not "committed": read the commit.

Not verified: the two agent workflows with the option set (no labelled run, no `@claude` run);
the job list of the rescan (the page was not found again; the detection times stand in for it);
the Mermaid diagram as GitHub renders it.

## Lesson

A scanner's finding is a place to look, not a verdict. Arnica said Medium four times for one
line; the run logs said two of the four were worth nothing and one path in the other two was
real, and next to it sat an exposure no scanner had reported. And what is written about a
finding gets scanned too: describe a credential-shaped value, never quote it.
