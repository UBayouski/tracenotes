# Backlog

Ordered work items for tracenotes, mapped to hackathon challenge days where a day has a natural
fit. Days without a ticket are process days (standards, skills, docs) that still produce a small
change through one of these tickets. Tickets are specified in `tickets/` as they come up.

| ID | Title | Day | Status |
|---|---|---|---|
| T-001 | Parse a Conventional Commits message | 01 Nov 02 | done |
| T-002 | Read commits from a git log stream on stdin | 03 Nov 04 | done |
| T-003 | Group commits into release-note sections | 03 Nov 04 (built Nov 06 via issue #11) | done |
| T-004 | Render Markdown notes with a source link on every entry | 05 Nov 06 | planned |
| T-005 | Recommend the next version with the rule that produced it | 06 Nov 09 | planned |
| T-006 | Never drop a commit: Unclassified section and ignored counts | 07 Nov 10 | planned |
| T-007 | JSON output mode for machine consumers | 08 Nov 11 | planned |
| T-008 | Config file `.tracenotes.json` with ignore patterns and section names | 09 Nov 12 | planned |
| T-009 | `check` command: lint commit messages in a range against the convention | 10 Nov 13 | planned |
| T-010 | Detect repository URL from the origin remote to build links | 11 Nov 16 | planned |
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

Process-only days: Day 02 (AGENTS.md), Day 22 (reproducibility pass), Day 23 (submission).

## Ticket format

```
# T-NNN: Title

**Goal.** One sentence.

**Acceptance criteria.** Numbered, each independently checkable.

**Out of scope.** What this ticket does not do.

**Verification.** Commands or tests that prove each criterion.
```
