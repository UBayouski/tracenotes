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

| # | Time (UTC) | What happened | Outcome |
|---|---|---|---|
| 3 | 18:11 | PR 6 merged (`track_progress: true`). Label toggled again. | **Worked.** 53 s. `claude[bot]` posted a progress comment on issue #4, created `agent/issue-4-t-026-print-usage-instead-of`, committed `8a5c41a` (`src/cli.ts` +30/-3, `tests/cli.test.ts` +55), `npm run check` 51/51, and left a "Create PR" link. Its comment had a 7-row criteria table with the proving test per row and four decisions the ticket left open. |
| 4 | 18:24 | Human opened PR 7 from the link. Qodo reviewed within a minute. | One finding, recommended, maintainability: the test helper patched `process.stdout.write` and `process.stderr.write`, which puts process-stream access outside `src/cli.ts`, against the imported AGENTS.md rule. Fair: the agent injected input and then reached for global mutation for output. |
| 5 | 18:25 | Human commented `@claude address the Qodo review findings on this PR`. | Fix workflow ran; the `agent/*` guard passed. 51 s later `claude[bot]` pushed `4ee70d0`: optional `stdout`/`stderr` sinks on `CliIo`, `main` writes through them, tests pass capturing sinks, the `try/finally` global restore is gone. 51/51. Qodo's own comments also fired the workflow and were skipped by the `@claude` condition, as designed. |
| 6 | 18:27 | Waited for Qodo to re-review the bot's push. | **Nothing.** Qodo re-reviewed human pushes on PRs 3 and 5 within a minute; it did not react to a push by `claude[bot]`. A human `/review` comment ran it on `4ee70d0`: finding attributed as implemented, zero new findings. |

Manual check the agent could not run (no TTY in CI): `node src/cli.ts log` in Git Bash on the
agent branch returned immediately with the error line and usage. Criterion 2 confirmed by hand.

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
- Opening PR 7 from the bot's link, and commenting `@claude` to start the fix. Both deliberate.
- Commenting `/review` so Qodo would look at the bot's fix commit. Not deliberate: Qodo does
  not auto-review pushes by a bot account, so the fix loop has a human step in the middle that
  the brief's "fix confirmed problems, then repeat the checks and review" assumes away.
  Cause, from the reviewer's open-source code (`pr_agent/servers/github_app.py`): with the
  default `ignore_bot_pr = true` every webhook event from a bot sender is dropped before any
  handler runs, and `push_trigger_ignore_bot_commits = true` skips push triggers for bot commits
  on top of that. Posting `/review` from the workflow would not help either, since that comment
  would come from a bot too. Fix: `.pr_agent.toml` at the repo root sets both to `false`. To be
  verified on the next agent PR.
- The manual terminal check for criterion 2.

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

The automation itself took one run to work once the mode was right. Everything else was the
seams between tools: a platform incident, a missing app install, a mode detector that reads
`prompt` as "scripted, not conversational", and a reviewer that ignores bots. None of those are
visible from the workflow file, and all of them produced a green or silent result rather than
an error. Design the loop so each hop leaves a human-readable trace (comment, commit, review)
and check the traces, not the statuses.

## Evidence

- Workflows: https://github.com/UBayouski/tracenotes/blob/main/.github/workflows/agent-ticket.yml and `agent-fix.yml`
- Issue: https://github.com/UBayouski/tracenotes/issues/4 (created with `gh issue create --body-file`, label `ready-for-agent` created with `gh label create`)
- Runs: zombie https://github.com/UBayouski/tracenotes/actions/runs/42068078500, no-op https://github.com/UBayouski/tracenotes/actions/runs/42077789414, working https://github.com/UBayouski/tracenotes/actions/runs/42081802646, fix https://github.com/UBayouski/tracenotes/actions/runs/42084151374
- PRs: workflows https://github.com/UBayouski/tracenotes/pull/5 and https://github.com/UBayouski/tracenotes/pull/6, the agent's work https://github.com/UBayouski/tracenotes/pull/7
