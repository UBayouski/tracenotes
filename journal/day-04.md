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

_TODO after the run: what started, what it delivered, checks, review results, retries, blockers._

## What still needed me

- Opening the PR. The action commits to a branch and leaves a prefilled "create PR" link. This
  is a deliberate fit with the workspace rule that a human owns every PR and merge.
- _TODO after the run._

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
