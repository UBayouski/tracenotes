# Day 09 — Nov 12 — Set up quality gates

Brief: https://github.com/orgs/qodo-hackathon/discussions/11. Save a quality gate where the factory
reads it (which findings must be fixed, which are only flagged), try it on a small change with
Qodo's Reviewer or Review Resolver, let the agent fix what the gate covers and review again until
the gate is met, and have it report "not done" when it is not. (The plan said "Write the missing
skill" for today; the thread is canonical.)

## The gate

Saved in `AGENTS.md`, section "Quality gate", before any code was written. Both the interactive
agent and the workflow bot already read that file in full. In short:

- Qodo's tools report `action_level`, not High/Medium/Low. The gate reads `action_required` as
  High, `remediation_recommended` as Medium, `informational` as Low. Anything else: stop and ask.
- Every valid High or Medium finding is fixed, whatever its type (Bug, Rule violation,
  Requirement gap). Every Low is reported and left alone, Low Rule violations included.
- Valid means reproduced: a failing test, or a cited line that contradicts a rule or a criterion.
- A finding the agent thinks is wrong is disputed with evidence and still blocks until the human
  decides. The agent does not dismiss findings and does not edit the ticket to fit the code.
- Fixes are test-first. The last review must cover the final tree, one review is deep, and there
  are at most three fix rounds.
- A finding listed again after its fix counts as fixed only with a red-then-green test, the cited
  code gone and no new description (the Day 8 `still_open` case).
- On a PR the latest completed review must be for the head commit.
- Otherwise the task is NOT DONE. An agent that cannot run a review says "implemented, gate
  pending". `agent-ticket.yml` now tells the bot exactly that (prompt step 7).

The three `action_level` values and their order come from the Review Resolver skill
(`action_required` > `remediation_recommended` > `informational`). That they correspond to the
High/Medium/Low labels of the PR comment is this project's reading, not something Qodo's docs state.

## The task

`tickets/T-008-config-ignore-patterns.md`, issue #20 (no label, nothing triggered): a JSON config
file given with `--config <path>` lists regular expressions; commits whose first line matches are
moved out of the notes but stay counted, and `group` lists them with the pattern. Eleven criteria.
The backlog item also had custom section names; those moved to T-027.

Built in an interactive session on local branch `t-008-config-ignore`, nothing committed:
`src/config.ts` (`parseConfig`), `options.ignore` in `groupCommits`, `--config` on `group`,
`render` and `version`, the closing line of the Markdown notes, tests and fixtures. Three choices
were the agent's and were approved by the human before implementation: a breaking commit is never
hidden by a pattern; `group` now rejects unknown arguments; the Markdown line changes only when a
pattern matched.

## Review loop

Base `280c2fd` (`main`, pushed). Scope: every changed and new file except `evidence/` and
`journal/`, so `AGENTS.md` with the gate itself was reviewed too. Nothing was staged: all changes
were unstaged or untracked, and the CLI listed the untracked files it included. Context: issue #20
as `--ticket` and a context file with ten decisions and who made each.

| Run | Depth (effective) | Tree | Result |
|---|---|---|---|
| 1 | auto (standard) | first implementation, 161 tests, 57,776 B | 2 findings, both `remediation_recommended` |
| 2 | deep (extended, two reviewers) | after fix round 1, 164 tests, 61,683 B | 0 new; both findings `resolved` / `implemented`; coverage complete |

## Gate report

| Finding | Type, `category` | `action_level` → severity | Decision | Evidence |
|---|---|---|---|---|
| e7cc6b40 Invalid UTF-8 in a config file silently alters its patterns (`src/cli.ts`) | Rule violation (cites rule 4578695, Validate Before You Normalize), Correctness | `remediation_recommended` → Medium | fixed | Red: `--config tests/fixtures/config-invalid-utf8.json` exited 0. Now the reader decodes with a fatal UTF-8 decoder and exits 2 with `the file is not valid UTF-8`. |
| 9f986931 A config path can forge error lines (`src/cli.ts`) | Bug, Observability | `remediation_recommended` → Medium | fixed | Red: `--config $'nope\nerror: forged line'` printed two lines. Now every reader and parser message goes through `oneLine()`, which escapes control characters. |

- What the code showed for e7cc6b40: `readFileSync(path, 'utf8')` replaces invalid bytes with
  U+FFFD before `parseConfig` sees the text, so a pattern is accepted in a form that is not in the
  file. That is rule 6 exactly. The agent had listed this case under "not tested or uncertain" in
  its own context notes instead of fixing it; the reviewer quoted that note back.
- What the code showed for 9f986931: valid, and wider than reported. The same failing test showed
  that an ordinary multi-line file that is not JSON also printed several lines, because V8 quotes
  the source text in its message. The ticket asks for one `error:` line (criterion 9); the agent's
  test for it used a single-line fixture. The fix covers path, system message, JSON message and
  regex message.
- Disputed findings: none. Low findings: none. Unmapped labels: none.
- Reviewer comments (not findings, reported, not changed): (1) check on Linux that a directory as
  the config path gives one `error:` line (EISDIR); only run on Windows here, and the repository
  has no CI job that runs the tests, so this is unverified. (2) For later: keep `groupGitLog`
  outside the `try` in `version` that turns `RangeError` into an error line.
- Checks: `npm run check` on the final tree: typecheck clean; `tests 164, pass 164, fail 0`
  (123 before the ticket, 161 after the first implementation). Red run: `evidence/day09/red-round1.txt`.
- Latest review: run 2, deep, full review of the final tree (`tree_sha 696edd6f`), coverage
  complete, `introduced: []`, `still_open: []`, `resolved: [9f986931, e7cc6b40]`.
- Fix rounds used: 1 of 3.

**Quality gate: MET** for the local loop. No High or Medium finding is open, the checks pass, and
the last review covers the code that will be committed. The PR review below reopened it.

## PR review (the gate's PR clause)

PR 21, head `501f983`. Qodo's review, read with the Review Resolver skill
(`evidence/day09/pr21-review-1.json`): `completed`, `commit_sha` = head, two findings, both open.

| Finding | Type, `category` | `action_level` → severity | Decision | Evidence |
|---|---|---|---|---|
| fa44bb08 Config path can still break the one-line error (`src/cli.ts`) | Bug, Observability | `remediation_recommended` → Medium | fixed locally, not yet pushed | Red (`evidence/day09/red-pr-round1.txt`): a path with DEL, U+0085, U+2028 and U+2029 came out raw in the error line, 164 of 165. `JSON.stringify` escapes only C0 controls. Now the quoted path goes through `oneLine()` too. `tests 165, pass 165, fail 0`. |
| cf1c4585 Backlog marks T-008 done before it is merged (`BACKLOG.md`) | Maintainability, no rule cited | `informational` → Low | reported, unchanged | Valid: the row says `done (issue #20)` and every other finished row cites the merged PR. Left for the human, as the gate says for Lows. |

This is the same class as 9f986931: round 1 escaped the message detail and left the path to
`JSON.stringify`, on the untested belief that it escapes everything `oneLine()` does. The local deep
review accepted that fix; the PR review did not.

**Quality gate on the PR at `501f983`: NOT MET.** A valid Medium was open at the head commit.

The human then allowed the agent to commit and push review-finding fixes to an open PR when it
has no open question (now a process rule in `AGENTS.md`). The agent pushed `931d447` (fix round 2
of 3). Qodo's next review (`evidence/day09/pr21-review-2.json`): `completed`, `commit_sha`
`931d447` = head; fa44bb08 `implemented`, set by Qodo itself; cf1c4585 still `pending`, Low,
reported and unchanged.

**Quality gate on the PR at `931d447`: MET.** No High or Medium finding is open, the checks pass
(165 of 165), and the latest completed review is for the head commit. Any later commit moves the
head and needs a completed review again before merge.

**Then the head moved twice and Qodo skipped both commits.** `e3684e4` (human: rule, journal,
evidence) and `f3dc67b` (agent: rule wording) each got a run with `review_effort: skip` and
`review_complete: false` (`evidence/day09/pr21-review-3-extended.json`). The gate text did not
cover this: read literally, a skipped review at the head is incomplete verification, NOT MET. The
agent stopped and asked. The human's decision: amend the gate. A skipped review at the head
counts when every commit since the last complete review changes only Markdown and `evidence/`,
and the report lists the files (`AGENTS.md`, point 8). Known cost, accepted: `AGENTS.md` is
Markdown, so a rule change can pass without a Qodo review.

Under the amended gate, at the head after this note is pushed: last completely reviewed commit
`931d447`; changed since: `AGENTS.md`, `journal/day-09.md`, `evidence/day09/README.md`,
`evidence/day09/pr21-review-2.json`, `evidence/day09/pr21-review-3-extended.json`; no code
change; `tests 165, pass 165, fail 0`; no High or Medium open. Qodo also set the Low cf1c4585 to
`implemented` although the `BACKLOG.md` row still says `done (issue #20)`: the status contradicts
the file, so it stays reported for the human.

**Quality gate on the PR: MET**, on condition that Qodo's run for the final head is again a skip
or a complete review without a High or Medium.

Final head `ca9f87e`: Qodo's run was again a skip, as the condition required. The human merged
PR 21 (`138b35e`). Issue #20 stayed open because the PR body said `(#20)`, not `Closes #20`; it
was closed by hand. The `BACKLOG.md` row now says `done (PR 21)`, which settles the Low cf1c4585.

## What the agent or review missed

- **The gate did not know that a review can be skipped.** It asked for a completed review of the
  head and treated anything incomplete as NOT DONE. Docs-only commits made the PR fail its own
  gate until the human amended it.

- **The ticket draft claimed something false about the code.** It said `group` "keeps rejecting"
  unknown arguments; running `group --x` printed JSON and exited 0. Caught before implementation
  only because the Day 8 lesson (run it before writing "as X behaves") was in the plan.
- **"Not tested" was treated as a disclosure, not a task.** Invalid UTF-8 sat in the agent's notes
  as an uncertainty. Under a gate, a known gap in the area of a project rule should be closed or
  put in the ticket's out-of-scope list before review.
- **The one-line test proved less than the criterion said.** Single-line fixtures only. The review
  found the path case; the multi-line file case, the common one, was found while reproducing.
- **Invisible characters in source.** The agent's file writes turned `\uFEFF`, `\u2028` and
  `\u00e9` escapes into the literal characters, so `src/config.ts` held an invisible BOM inside a
  string. Tests passed and neither review mentioned it. Found by scanning the changed files for
  non-ASCII characters; replaced with escapes before run 2.
- **Only one branch of the gate was exercised.** Two Mediums, both valid, both fixed. Report-only
  Lows, a disputed finding, an unmapped label, the stale-finding clause and the three-round stop
  did not occur. This time Qodo marked both findings `implemented` by itself on the rerun, unlike
  Day 8, where the fixed finding stayed `still_open`; run 2 was a full review after a depth change,
  run 4 on Day 8 was not.
- **The mapping is unverified against a PR.** No finding has yet been seen with both an
  `action_level` and a High/Medium/Low label side by side.
- **The bot's "gate pending" line is untested.** No workflow was triggered today.

## Lesson

A gate is only as precise as the labels the tool actually returns. The brief speaks of High,
Medium and Low; the API returns `action_level`. Writing the gate meant writing that mapping down
and deciding what happens when a label does not fit, which is the part an agent would otherwise
improvise. And a met gate describes the findings that came up: today that was the fix path only.

## Links

- Issue: https://github.com/UBayouski/tracenotes/issues/20
- Ticket: `tickets/T-008-config-ignore-patterns.md`
- Gate: `AGENTS.md`, section "Quality gate"
- Evidence: `evidence/day09/`
- PR: https://github.com/UBayouski/tracenotes/pull/21
- Post: https://github.com/orgs/qodo-hackathon/discussions/11#discussioncomment-19573939
