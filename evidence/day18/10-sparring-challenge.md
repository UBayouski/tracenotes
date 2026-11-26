# Day 18: the diagnosis challenged by two other vendors

Run Nov 26 with the Sparring plugin's `challenge` skill, after Codex's blind diagnosis
(`06-codex-diagnosis.md`). The working files are in `.sparring/challenge/`, which is git-ignored;
this note keeps what matters for tracenotes.

## The question

"Why did this GitHub Actions job fail, and does the failure call for a change to the code, to the
check, to the process, or to nothing?" The job: PR 38, workflow "Ticket link", attempt 1, commit
`8e15dc9`. The claim to refute, stated by the human: *"A missed backlog step on the PR's first
commit, by design; no code change needed."*

The brief gave both job logs (attempts 1 and 2), the job's steps, Qodo's `/checks` reply, the PR
38 commits and body, and the workflow, script, backlog and `AGENTS.md` as they were at `8e15dc9`.
It ruled out a transient failure (attempt 2 printed the same lines) and kept later work out of
scope. It did not include the agent's own conclusion.

## The reviewers

| Reviewer | Model | Effort | Seconds | Tokens | Result |
|---|---|---|---|---|---|
| Codex CLI (read-only sandbox) | `gpt-6.2-sol` | medium | 107 | 67,012 | ok, confidence high |
| Antigravity CLI (sandboxed, reads files only) | default (not printed) | high | 139 | 105,966 | ok, confidence high |

One round: both agreed with the agent's conclusion, so no reply round was needed.

## What they found about tracenotes

Both reviewers:

- The cause is in the log: `ticket-link: BACKLOG.md row for T-037 says "planned", expected
  "done (PR 38)"`, exit 1, at `8e15dc9`. `BACKLOG.md` at that commit says `planned`.
- It is deterministic: attempt 2, on another runner, checked out the same commit and printed the
  same line.
- The PR title ("Fixing Arnica findings") names no ticket, so T-037 was selected through the
  issue the PR closes (`closingIssuesReferences`, an issue titled `T-037: ...`). Inferred from
  the script and `Closes #37` in the PR body; the GraphQL response is not in the log.
- Neither the workflow nor the script has a bug. The next step is the one-line backlog commit,
  which `6ab70d6` made.
- **"Missed" is the wrong word.** The PR number does not exist before the PR is opened, and both
  `AGENTS.md` ("The check is red on a new ticket pull request until a follow-up commit sets the
  backlog row") and the PR body said the first run would be red. The step was not forgotten; it
  could not be done yet.

Antigravity only:

- "By design" still has a cost: all 7 failed runs in the repository's history (PRs 24, 26, 28,
  30, 33, 36, 38) are this first-commit red, and the follow-up push cancels the first `Check`
  run. Nothing in the failure says the red is expected. (This became T-038: the failure now says
  why the ticket is checked and what to do.)
- The commit subject "Fixing Arnica findings" is not a Conventional Commit, which `AGENTS.md`
  asks for; tracenotes parses its own history, so it shows up in its own notes. Unrelated to the
  failure.

## Result

The claim stands, with one correction: not a missed step but an expected one. No change to the
product code or the check's rules. The agent's own conclusion, stated to the human before the
reviewers ran, was the same, including that the check's message could say more.
