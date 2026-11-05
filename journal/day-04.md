# Day 04 — Nov 05 — Automate your factory's first job

Brief: https://github.com/orgs/qodo-hackathon/discussions/6. Set up a trigger (a schedule or a
label on a ticket) so the agent picks up one small ticket without a human opening a session: read
the ticket and the project rules, implement, run checks, open a PR for Qodo review, fix confirmed
findings, retry with a limit, stop for help when stuck. The human decides whether to merge.

## Trigger

GitHub Actions, `.github/workflows/agent-ticket.yml`. A human adds the label `ready-for-agent` to
an issue. The job runs `anthropics/claude-code-action@v1` with a fixed prompt: read AGENTS.md and
the issue, implement, `npm run check`, three attempts, commit on `agent/issue-<n>-<slug>`.
Retry budget is `--max-turns 40` plus a 30-minute job timeout.

Review fixes: `.github/workflows/agent-fix.yml`, triggered by a human writing `@claude ...` on the
PR. Deliberately not fully automatic; see "What still needed me".

## Ticket

`tickets/T-026-usage-when-stdin-is-a-terminal.md`, mirrored as a GitHub issue. Small, seven
criteria, carried forward from the Day 1 and Day 3 journals.

## Run log

| # | Time (UTC) | What happened | Outcome |
|---|---|---|---|
| 1 | 16:47 | Label added. Run queued 4 seconds later. | Never started. GitHub Actions incident opened at 16:50 ("workflow runs may experience delays or errors when starting"), resolved 17:42. The run stayed `queued` with zero jobs and could not be cancelled from the UI or the API. A zombie. |
| 2 | 17:45 | Label removed and re-added by hand. New run started in seconds. | Failed in 26 s: "Claude Code is not installed on this repository." The action needs the Claude GitHub App for its bot identity; the OAuth secret only covers the model side. Fixed by installing the app on the repo. |
| 2b | 17:48 | Re-run of the same event after the app install. | "Success" with nothing to show: 19 turns, 47 s, 6 permission denials, no branch, no comment, no commit. Cost 0.20 USD. |

Why 2b did nothing: giving the action a `prompt` selects its **agent mode**. Agent mode does not
create a branch, does not post a tracking comment, does not inject the issue text, and does not
allow git add/commit/push. Our prompt said "read the issue you were triggered from" and the agent
had no issue number and no tool to fetch one; its six denied tool calls were attempts to get at
the issue or at git. It then reported success because, from its point of view, it had done what
it could. The fix is `track_progress: true`, which forces **tag mode** on issue events: tag mode
fetches the issue, creates the `agent/*` branch, posts a progress comment, allows the git
commands, and appends our prompt as custom instructions.

Lesson for the brief's "set a retry limit and stop for help": a green check is not evidence.
The run log said success; the repository said nothing happened. The journal and the issue
comment are the evidence, not the workflow status.

## What still needed me

- Opening the PR. The action commits to a branch and leaves a prefilled "create PR" link. This
  is a deliberate fit with the workspace rule that a human owns every PR and merge.
- Un-sticking the first run after the GitHub incident: remove and re-add the label.
- Installing the Claude GitHub App. Not mentioned in the action's quickstart unless you use
  `/install-github-app` from the CLI, which we did not.
- Diagnosing the silent no-op run: reading the action's source (`modes/detector.ts`,
  `modes/agent/index.ts`, `modes/tag/index.ts`) to learn that `prompt` alone means agent mode.
- Every workflow change is a PR to `main`, since issue events only run workflows from the
  default branch. Three human round trips for one automated job so far.

## Qodo review

PR 5 (the workflows themselves, no product code). One finding on `71fb0c8`, recommended,
correctness: **bot fixes can land on human branches**. `agent-fix.yml` accepted `@claude` on any
pull request, so a maintainer asking for a fix on a human branch would have produced a bot
commit outside the `agent/*` exception written into AGENTS.md in the same PR.

Correct, and the same class of finding as PR 2: the reviewer read the rule and the workflow as
one set of claims and found the contradiction. Fix: a guard step resolves the PR's head branch
(from the event for review comments, via `gh pr view` for issue comments) and every later step
runs only when it starts with `agent/`. Comments on plain issues are skipped too.

**Missed, or not in scope:** nothing on `agent-ticket.yml`. The prompt there allows
`Bash(git log:*)` and friends but the action's own git handling is what commits; worth watching
in the first run whether the agent can actually commit with that tool list.

## Lesson

_TODO._

## Evidence

- Workflow: https://github.com/UBayouski/tracenotes/blob/main/.github/workflows/agent-ticket.yml
- Issue: https://github.com/UBayouski/tracenotes/issues/4 (created with `gh issue create --body-file`, label `ready-for-agent` created with `gh label create`)
- PR: _TODO_
- Run: _TODO_
