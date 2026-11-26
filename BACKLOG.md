# Backlog

Ordered work items for tracenotes, mapped to hackathon challenge days where a day has a natural
fit. Days without a ticket are process days (standards, skills, docs) that still produce a small
change through one of these tickets. Tickets are specified in `tickets/` as they come up.

| ID | Title | Day | Status |
|---|---|---|---|
| T-001 | Parse a Conventional Commits message | 01 Nov 02 | done |
| T-002 | Read commits from a git log stream on stdin | 03 Nov 04 | done |
| T-003 | Group commits into release-note sections | 03 Nov 04 (built Nov 06 via issue #11) | done |
| T-004 | Render Markdown notes with a source link on every entry | 06 Nov 09 (investigated; built via issue #13, PR 14) | done |
| T-005 | Recommend the next version with the rule that produced it | 07 Nov 10 | done (PR 16) |
| T-006 | Never drop a commit: Unclassified section and ignored counts (mostly delivered by T-003; rescope, see journal/day-06.md) | 07 Nov 10 | needs rescope |
| T-007 | JSON output mode for machine consumers | 08 Nov 11 (issue #18; built in session, Qodo local review before commit) | done (PR 19) |
| T-008 | Config file `.tracenotes.json` with ignore patterns (section names moved to T-027) | 09 Nov 12 (issue #20; built in session, held to the AGENTS.md quality gate) | done (PR 21) |
| T-009 | `check` command: lint commit messages in a range against the convention | 12 Nov 17 (issue #27; built in session) | done (PR 28) |
| T-010 | Repository URL from the origin remote (`render --origin`, credentials dropped) | 11 Nov 16 (issue #25; built in session) | done (PR 26) |
| T-011 | Select ranges by tag: since last tag, between two tags, by date | 12 Nov 17 | planned |
| T-012 | Update `CHANGELOG.md` in place, idempotently | 13 Nov 18 | planned |
| T-013 | MCP server with `draft_release_notes` and `next_version` tools | 14 Nov 19 | planned |
| T-014 | MCP `classify_commit` tool with strict input validation | 15 Nov 20 | planned |
| T-015 | GitHub Actions workflow: check, tests, dry-run notes, readiness summary | 16 Nov 23 | planned |
| T-016 | Traceability verifier: every rendered entry resolves to a real commit | 17 Nov 24 | planned |
| T-017 | Routing policy: fix, human review, or approve, based on check results | 17 Nov 24 | planned |
| T-018 | Verification agent brief and evidence format | 18 Nov 25 | planned |
| T-019 | Auto-approval policy for docs-only and test-only changes | 19 Nov 26 | planned |
| T-020 | Failure drills: stale review, failing test, missing git binary | 20 Nov 27 | planned |
| T-021 | Pre-release versions: alpha, beta, rc | spare | planned |
| T-022 | Issue reference linking in rendered notes | spare | planned |
| T-023 | Author attribution with opt-out | spare | planned |
| T-024 | Monorepo: filter commits by path and scope | spare | planned |
| T-025 | Self-hosting: tracenotes generates its own CHANGELOG on tag | 21 Nov 30 | planned |
| T-026 | Print usage instead of blocking when stdin is a terminal | 04 Nov 05 | done |
| T-027 | Config: custom section names (split from T-008) | spare | planned |
| T-028 | Source hygiene: no raw invisible or control characters in `.ts` files under `src/`, `tests/` and `scripts/`, rule in AGENTS.md plus a test that prints the escape to use (borrowed from pasokh, Day 2 reply) | 10 Nov 13 (built in session, checked against the factory diagram) | done (PR 24) |
| T-029 | Label lane: Qodo review of the agent's branch before a pull request is opened, in a separate job that never runs ticket-written code and so can hold the Qodo key (the in-job version was removed on Day 10, journal/day-10.md) | 16 Nov 23 | planned |
| T-030 | Parser: decide `conventional` on the raw header, no `.trim()` before the match (rule 6; `src/commit.ts:128`); found by Qodo on PR 28 (88effe66), worked around in `check` only | spare | planned |
| T-031 | Escape every user-supplied value in usage errors with `oneLine()`: unknown option and command in all commands, and the `--format`, `--repo-url`, `--current` messages (only `check` did, PR 28 finding 731e5dee) | 14 Nov 19 (Day 14 outside-guard PR) | done (PR 33) |
| T-032 | Skill `release-notes-audit`: render a git range and prove every commit is accounted for once and linked | 13 Nov 18 (issue #29; built in session) | done (PR 30) |
| T-033 | Skill `pr-gate-check`: the quality gate at a PR head from Qodo's review session, findings and checks (split from T-032 on Day 13 with three open local findings) | spare | planned |
| T-034 | Pin every action in `.github/workflows/` to a commit SHA, with a test that fails on an unpinned `uses:` | 14 Nov 19 (Day 14 inside-guard PR) | done (PR 34) |
| T-035 | Every `actions/checkout` step sets `persist-credentials: false`, with a test that fails on a checkout step without it (Arnica, 4 Medium findings) | 16 Nov 23 (Day 16, inside the approval guard) | done (PR 36) |
| T-036 | Label lane: the agent action's own write token sits in the remote URL while ticket-written tests run; decide whether to split the push into a step the agent's commands cannot reach (found while investigating T-035) | spare | planned |
| T-037 | Audit script: find commit links with a fixed pattern and compare the base as text, no expression built from the repository URL (Arnica Low finding, Day 16) | 16 Nov 23 (Day 16) | done (PR 38) |
| T-038 | `ticket-link`: on a wrong backlog status, also print why the ticket is checked and the next step (7 of 7 failed CI runs are this by-design red; Day 18) | 18 Nov 25 (Day 18) | done (PR 40) |

Process-only days: Day 02 (AGENTS.md), Day 22 (reproducibility pass), Day 23 (submission).

## Ticket format

```
# T-NNN: Title

**Goal.** One sentence.

**Acceptance criteria.** Numbered, each independently checkable.

**Out of scope.** What this ticket does not do.

**Investigation.** What was checked against the code before building (Codebase Wisdom or a
command that was run), what was found, and what it changed in this ticket. Required: the label
workflow does not start without it.

**Verification.** Commands or tests that prove each criterion.
```
