# Day 06 — Nov 09 — Ask your codebase before you build

Brief: https://github.com/orgs/qodo-hackathon/discussions/8. Connect the Qodo Agentic Toolbox,
explore the project with the Codebase Wisdom skill, pick one backlog ticket, investigate how it
fits the current code (reuse, affected components, alternatives), and revise the work order.
(The website schedule said "Discover unwritten standards" for today; the thread is canonical.)

## Setup

- Qodo CLI 2.1.0 (installed Day 1), signed in from the keychain. `qodo read whoami` succeeded.
- Skill `qodo-codebase-wisdom` 1.1.7 installed user-scoped for Claude Code
  (`~/.claude/skills/qodo-codebase-wisdom`), loaded in the interactive session.
- Repo resolved with `codebase search-repos --query tracenotes` → `UBayouski/tracenotes`.
  Qodo's index was at `76ca0e7` (PR 12 merge); local `main` is one docs-only merge later.

Every call and its raw JSON output is in `evidence/day06/` (index in its README).

## What worked and what did not

| Tool group | Result |
|---|---|
| `codebase` (search-repos, ls, grep, read-file, list-issues, list-prs, list-commits, get-pr) | Worked on every call. |
| `pull-request` (stats, similar) | `MT-UPSTREAM-DOWN: context-retriever unreachable` on every call. Another participant hit the same error today. No semantic search of past PRs or past review suggestions was possible. |
| `cross-repo relations` | Empty, as expected for a single-repo project. |
| `codebase read-review-data --kind threads` | `MT-VALIDATION (dependentRequired)`; `get-pr` returned the same review comments, so nothing was lost. |

## Triage: which ticket deserves a closer look

Candidates were the next three planned tickets.

| Ticket | Original wording (BACKLOG.md) | What the investigation found | Verdict |
|---|---|---|---|
| T-004 | "Render Markdown notes with a source link on every entry" | No repository URL anywhere in `src/` (grep `https?://\|url`: only `pathToFileURL` and a spec link). T-003's own ticket put "source links as URLs" out of scope **to T-010**, five days later. The title promises something the code cannot do yet. | **Investigated.** |
| T-005 | "Recommend the next version with the rule that produced it" | Self-contained: needs `type`, `breaking`, and a current version input. | Fine as worded. |
| T-006 | "Never drop a commit: Unclassified section and ignored counts" | Already mostly done. `src/group.ts:106` builds `Unclassified`; `ignored` and `malformed` exist in `ReleaseGroups` (T-003). What is left (counts for ignore patterns) depends on T-008. | Needs rescoping, not investigation. Flagged for the human. |

## T-004 investigation

Question asked: how well does "render Markdown with a source link on every entry" fit the code as
it is after T-003? Reuse, affected components, alternatives.

### Verified facts (Qodo call, then checked against the local code)

1. **There is no link base.** `src/` has no repo URL and no remote detection (`13-grep-url`).
   `tickets/T-003-...md:38` and `tickets/T-002-...md:5` both defer URLs and git invocation to
   T-010 / T-011 (`11-grep-T010`). → The renderer must accept a URL as an option and render a
   plain short SHA without one. AGENTS.md rule 1 counts "a commit SHA" as a source, so plain SHA
   text satisfies No Orphan Notes; links are an upgrade T-010 switches on.
2. **Grouping is reusable as is.** `groupGitLog(result)` in `src/group.ts:112` returns ordered,
   non-empty sections with `sha`, `shortSha`, `scope`, `prNumber`, `breakingNotes` on every entry
   (`04-ls-src`, PR 12 summary in `21-pr12`). → The renderer is a pure function of
   `ReleaseGroups`; it does not reorder or re-parse.
3. **`index.ts` does not export grouping** (`14-index`: only `parseCommit` and `parseGitLog`).
   → Added to criterion 1, because the renderer's input type must be public too.
4. **The PR number is removed from the subject.** Local check: `parse "feat(cli): add x (#42)"`
   gives `subject: "add x"`, `prNumber: 42`. → The renderer must put `#42` back as part of the
   source, or the PR link is lost.
5. **Subjects are raw text.** Same check with `add *bold* [x](http://e) <b>`: the subject keeps
   the Markdown and HTML untouched. → Without escaping, a commit message could inject a link
   (pointing anywhere) into release notes. Criterion 4 added. Escaping only adds characters, so
   it does not conflict with rule 6.
6. **`group` drops per-commit warnings.** `src/gitlog.ts:74-79` records a warning for a bad date;
   `toEntry` in `src/group.ts:53` does not copy `warnings`, `author` or `date`. Local check: the
   same stream shows the warning through `log` and not through `group`. → A renderer built on
   `group` cannot surface them. Not fixed in T-004 (see follow-ups).
7. **Merge-only and malformed input produce no entries.** `ignored` and `malformed` are separate
   lists (T-003 criteria 4 and 8). → Nothing Vanishes needs a visible count line, criterion 6.

### Components affected

`src/render.ts` (new), `src/index.ts` (exports), `src/cli.ts` (new `render` command, option
parsing for the first time: every command so far takes no flags), `tests/render.test.ts`,
`tests/cli.test.ts`. Downstream: T-012 (CHANGELOG writer, needs deterministic bytes), T-016
(traceability verifier, needs a fixed entry-line format to find the SHA), T-013 MCP
`draft_release_notes` (will call `renderMarkdown`). Criteria 2 and 3 fix the format for them.

### Alternatives considered

| Option | Why not |
|---|---|
| Wait for T-010 and build links only | Blocks the most visible feature on remote detection; T-010 then has nothing to plug into. |
| `render` reads `group` JSON from stdin | A second input contract, and JSON input is a new parser that rule 6 would apply to. One stream format is enough. |
| Hard-code `https://github.com/UBayouski/tracenotes` | Wrong for every other user and untestable for other hosts. |
| Rename the ticket to drop "link" | The title is right once "source" means SHA text or link. Kept the title, made the meaning explicit. |

### What the original approach got right

The ticket's intent holds: rendering is the next step after grouping, and "source on every entry"
is the right acceptance bar. The investigation changed the *how*, not the *what*.

## Resulting decision

`tickets/T-004-render-markdown-notes.md`, nine criteria. Changes against the one-line original:

- "Source link" is defined: short SHA always, plus `#PR`; both become links only when `--repo-url`
  is given. T-010 will supply that value later.
- Escaping of subject and scope (new, from fact 5).
- An accounting line for ignored and malformed commits (new, from fact 7).
- A fixed, line-per-entry format so T-012 and T-016 can rely on it.
- `repoUrl` validated as given, never repaired (rule 6 applied to a new input).
- Exports in `index.ts` fixed as part of the ticket (fact 3).
- Explicitly out of scope: URL detection, version heading, other hosts, issue links, warnings.

## Unanswered questions

1. **Warnings.** Should `groupCommits` carry `warnings` so `group` and `render` show them? It is a
   Nothing Vanishes question about information, not commits. Proposed: a small follow-up ticket
   before T-016.
2. **T-006 scope.** Most of it shipped in T-003. Rescope to "counts for ignore patterns" after
   T-008, or merge into T-008? The Day 7 plan uses T-006, so this needs a decision now.
3. **Other hosts.** GitLab uses `/-/commit/` and `/-/merge_requests/`. Out of scope until someone
   needs it; T-010 should record the host so a later ticket can choose the format.
4. **Past review history.** Could not search earlier review suggestions on rendering or links
   (`pull-request` tools down). Worth rerunning `pull-request similar-suggestions` before the
   T-004 PR.

## What the agent or review missed

- The first grep failed on a wrong flag value (`--regex true`; the tool wants
  `fixed|basic|extended|perl`). The catalog from `qodo read tools codebase --json` lists
  parameter names but the agent guessed the value; the error message named the valid ones.
- `get-pr` output contains non-ASCII; reading it on Windows with Python's default code page
  failed until the file was opened as UTF-8.
- The Codebase tools answered questions about *current code* well. The two most useful findings
  (facts 1 and 5) came from combining a Qodo grep with a local run of the CLI; neither alone
  showed the problem.

## Lesson

A one-line backlog item can promise a capability that a later ticket owns. Grepping for the thing
the title promises (here: a URL) is the cheapest check there is, and it reshaped the ticket before
any code was written.

## Outcome: the factory built the revised ticket

Same day. Issue #13 created from the revised ticket, `ready-for-agent` label added by the human.

| Step | Evidence | Result |
|---|---|---|
| Implement | run 42665926001, 17:34 to 17:36 UTC, commit `7f7af10` | `src/render.ts`, `render` command, exports, tests |
| Qodo review | PR 14 | 5 findings |
| Fix round | `@claude` comment, run 42666752403 (45 s), commit `eb0dce7` | 4 fixed, 1 disputed with a test added, 83 tests pass |
| Re-review | Qodo review session at `eb0dce7`, complete | all 5 resolved |
| Merge | human, 17:42 UTC | `05bc8cb` |

The five findings, against the ticket:

| # | Finding | Did the revised ticket cover it? |
|---|---|---|
| 1 | Empty-stdin `render` error lacks usage | **The ticket contradicted itself.** Criterion 8 said "same contract as `group`" *and* "empty stdin exits 2 with the usage text", but `group` prints no usage on empty stdin (`src/cli.ts:106-108`). The investigation read that code and did not notice. |
| 2 | Trailing newline in a URL breaks links | Agent disputed: in JavaScript `$` without the `m` flag matches only at the end of input. Added a `\r\n` regression case, no code change. Correct. |
| 3 | Large `(#N)` links to the wrong pull request | No. The ticket assumed `prNumber` is always safe; `parseCommit` accepted numbers above `Number.MAX_SAFE_INTEGER`. The fix changed `src/commit.ts`, a module the ticket did not list. |
| 4 | Invalid `--repo-url` waits for the whole git log | No. Criterion 7 said "validated before use" but not before reading stdin. |
| 5 | Ports out of range produce unusable links | No. Criterion 7's URL shape did not mention ports. |

Checked by hand on merged `main` (scratch copy, `npm run check` 83/83): the injection subject from
criterion 4 renders as `add \[x\](http://e) \<b\>`, the count line reads
`1 of 2 commits shown; 1 merge commits ignored; 0 malformed records skipped.`, links appear only
with `--repo-url`, and `https://github.com/o/r/` is rejected with exit 2.

What this says about the investigation: it caught the design problems (no link base, injection,
the vanishing count) and the agent built those right the first time. It did not catch the edges
of the new input it added (`--repo-url`) or a numeric limit in an existing field. Investigation
before the build and review after it found different kinds of problems; neither replaced the other.

Finding 3 also broke the ticket's *Must not break* line in a small way: `parse` output changes for
`(#9007199254740993)`, which now stays in the subject. Accepted at merge as the right fix.

## Links

- PR: https://github.com/UBayouski/tracenotes/pull/14
- Ticket: `tickets/T-004-render-markdown-notes.md` (issue: https://github.com/UBayouski/tracenotes/issues/13)
- Evidence: `evidence/day06/`
- Post: _TODO_
