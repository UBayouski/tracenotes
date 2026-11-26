# Day 18 — Nov 25 — Turn a red build into useful feedback

Brief: https://github.com/orgs/qodo-hackathon/discussions/20. Pick one real failed GitHub Actions
job, ask Qodo for CI failure feedback (`/checks "<job URL>"`), check it against the source logs,
hand the checked evidence to a coding agent, take the next step and record the follow-up run.
(The plan said "Delegate verification", T-018, for today; the thread is canonical. T-018 moves to
a free slot.) Done Nov 26.

Status: complete and posted.

- Reply in the thread (Nov 26): https://github.com/orgs/qodo-hackathon/discussions/20#discussioncomment-19931777

## The failed job

- PR: https://github.com/UBayouski/tracenotes/pull/38 (T-037, the Day 16 Arnica Low finding),
  merged.
- Job: https://github.com/UBayouski/tracenotes/actions/runs/45255214509/job/137975120905, workflow
  "Ticket link", job `ticket-link`, attempt 1, commit `8e15dc9` (the PR's first commit), Nov 23.
- Steps (`evidence/day18/01-failed-job-steps.json`): set up job, checkout and setup-node succeed;
  "A ticket PR closes its own issue and has updated the backlog" fails.
- Source log (`evidence/day18/01-failed-job-log.txt:152-161`):

  ```
  Run node scripts/pr-ticket-check.ts BACKLOG.md
    PR_TITLE: Fixing Arnica findings
    PR_NUMBER: 38
  ticket-link: BACKLOG.md row for T-037 says "planned", expected "done (PR 38)"
  ##[error]Process completed with exit code 1.
  ```

Why this job: every failed run in the repository's history, 7 of 7 (PRs 24, 26, 28, 30, 33, 36,
38), is this same `ticket-link` failure on a ticket PR's first commit. There is no test or build
failure to pick. It is not a lint job, so `excluded_checks_list` does not apply.

## Qodo feedback

- Requested Nov 26 with `/checks "<job URL>"` on PR 38
  (https://github.com/UBayouski/tracenotes/pull/38#issuecomment-7184907526). Qodo replied:
  "The /checks command by Qodo was deprecated on the 1st of October 2026 and is no longer
  available." (`evidence/day18/03-qodo-checks-reply.json`). So there is no Qodo CI failure
  feedback to check.
- The first comment was posted from Git Bash, which rewrote `/checks` into a Windows path. The
  agent edited it to say "Posted by mistake" and posted the right one through `gh api` with path
  conversion off.
- Also tried Qodo's managed read `qodo read codebase read-review-data` for the run and the job
  (`evidence/day18/02-qodo-read-review-data.txt`): `CI_REVISION_MISMATCH`. It reads CI data only
  for the PR's current head (`62fd843`), and the failed run is on `8e15dc9`.

## Checked against the source logs

- Attempt 2 of the same job, rerun Nov 26 with the human's approval
  (https://github.com/UBayouski/tracenotes/actions/runs/45255214509/job/139745038559): same
  commit, another runner region, the same line and exit 1 (`evidence/day18/04-rerun-attempt2-log.txt:160-161`).
  Not transient.
- `BACKLOG.md` at `8e15dc9` says `planned` for T-037. The PR title names no ticket; the ticket was
  selected through the issue the PR closes (#37). `AGENTS.md` at that commit: "The check is red on
  a new ticket pull request until a follow-up commit sets the backlog row, because the number is
  not known earlier." The PR body said the same.
- What the log shows: which ticket, which row, the expected status, exit 1. What it doesn't: why
  the ticket was checked, that the red is expected, and what to do. A reader sent to "fix the red
  build" gets one line.

## The coding agent

- Codex CLI (`gpt-6.2-sol`, read-only sandbox, a copy of the repository at `8e15dc9`), given the
  job URL, commit, steps, the verified log excerpt and Qodo's reply, and asked to investigate one
  cause and propose a change only if justified (`evidence/day18/05-agent-brief.md`).
- Its diagnosis (`evidence/day18/06-codex-diagnosis.md`): the backlog row was not yet updated, a
  process step, not a bug. No code change; update the row in a follow-up commit. It cited the
  workflow, the script, the backlog row, `AGENTS.md` and the two tests, kept the closing-issue
  selection as an inference, and proposed that the message name the issue that selected the
  ticket.
- Then the diagnosis was challenged with Sparring's `challenge` skill: Codex (`gpt-6.2-sol`,
  medium, 107 s) and Antigravity (high, 139 s) each tried to refute "a missed backlog step, by
  design, no code change needed" (`evidence/day18/10-sparring-challenge.md`). Both: right on cause
  and code, wrong word: not *missed* but expected, because the number does not exist yet.
  Antigravity: every red run in the history is this one, and nothing in it says so.

## The next step: T-038

The rules of the check stay. The failure should explain itself. T-038 (issue
https://github.com/UBayouski/tracenotes/issues/39, PR https://github.com/UBayouski/tracenotes/pull/40):
on a wrong backlog status, `ticket-link` also prints why the ticket is checked and the next step.
Same rules, same problem line, same exit code.

- Built test-first: red (`evidence/day18/t038/01-red.txt`, `nextSteps` not exported), green,
  `npm run check` 392 pass (`t038/10-npm-run-check-3.txt`). Replayed on the PR 38 input
  (`t038/04-replay-pr38.txt`).
- Qodo local review, three rounds (`t038/05`, `08`, `11`): one finding, `a3c7163b`
  (informational): a row that already names another PR got "this is expected" too. Fixed
  test-first (`t038/06-red-a3c7163b.txt`); the next round marked it implemented; the third round
  found nothing.
- Qodo PR review at `849171a` (`evidence/day18/08-pr40-qodo-review.json`): `df3ba3d9`
  (remediation recommended): the line said the red was expected "on the first commit" as a fact,
  but the script cannot tell the first commit from a later one. Fixed test-first in `5aac37f`
  (`t038/09-red-df3ba3d9.txt`): the sentence is now conditional, "If this is the pull request's
  first commit, this is expected: its number did not exist yet." Qodo's review at `5aac37f`
  (`evidence/day18/09-pr40-qodo-review-2.json`): completed, `df3ba3d9` implemented by the review
  itself, nothing new.
- Merged by the human Nov 26 (`d1fd1f4`). Issue #39 closed.

## Follow-up run

- PR 40's first commit `aa96299`, `ticket-link`, attempt 1
  (https://github.com/UBayouski/tracenotes/actions/runs/45775677642/job/139758655328): **failure,
  by design**, and the log now says why (`evidence/day18/07-followup-pr40-ticket-link-log.txt:160-161`):

  ```
  ticket-link: BACKLOG.md row for T-038 says "planned", expected "done (PR 40)"
  ticket-link: T-038 is checked because this pull request closes #39; set its BACKLOG.md row to "done (PR 40)" in a commit on this branch. On the first commit of a ticket pull request this is expected: the number did not exist yet.
  ```

  That is the first version of the sentence; `df3ba3d9` changed it later.
- `849171a` (row set to `done (PR 40)`): `ticket-link` success
  (https://github.com/UBayouski/tracenotes/actions/runs/45776208912). An earlier run on the same
  commit was cancelled by the PR body edit (concurrency, `cancel-in-progress`).
- `5aac37f` (the `df3ba3d9` fix): `ticket-link` and `check` on Linux and Windows pass
  (Ticket link https://github.com/UBayouski/tracenotes/actions/runs/45777131205, Check https://github.com/UBayouski/tracenotes/actions/runs/45777131264).

What stays unresolved: every ticket PR's first commit is still red. That is the check's design
(the backlog records the PR number, which the first commit cannot know). T-038 makes the red
cheaper to read, not green.

## What the agent or the review missed

- The agent's first wording for the problem, and the human's claim, said "missed". Both outside
  reviewers corrected it: the step could not be done yet.
- The agent's first version of the new line stated "this is expected" as a fact. Qodo's local
  review caught one wrong case (`a3c7163b`); the agent fixed that case and kept the claim. Qodo's
  PR review caught the claim itself (`df3ba3d9`).
- The agent posted a mangled `/checks` comment (Git Bash path conversion) before checking it.
- Qodo's CI failure feedback is retired, and its managed CI read works only at the PR head, so a
  failure on an older commit of a PR gets no Qodo diagnosis at all.

## Lesson

A red that is red by design still has to say so. Seven runs failed the same way, and each time the
only explanation was in `AGENTS.md`, not in the failure. The failure message is the one piece of
feedback every reader, human or agent, is sure to see; it should say why, and what to do, and
claim only what the script can actually know.
