# Day 07 — Nov 10 — Close the feedback loop

Brief: https://github.com/orgs/qodo-hackathon/discussions/9. Pick an open PR with Qodo findings,
have the coding agent fetch them with the Review Resolver skill, investigate each one against the
code, let the human choose the scope, apply the chosen corrections, keep a reason for anything left
unchanged, and check the latest review against the updated code. (The plan said "Remove what isn't
helping" for today; the thread is canonical.)

## What changed in the loop

On Days 4 to 6, review findings went to the `@claude` workflow: a PR comment, a bot run, a bot
commit. The bot read the comment and decided alone. Today the findings were worked in the
interactive session through `qodo-review-resolver` 1.4.9 (Qodo CLI 2.2.0): structured read,
freshness check, investigation, a single choice by the human, then the outcome recorded in Qodo.
No `@claude` comment was posted on the PR.

## The PR

No PR was open this morning, so the factory built one.

| Step | Evidence | Result |
|---|---|---|
| Ticket | `tickets/T-005-recommend-next-version.md`, issue #15 | 8 criteria; written today |
| Implement | label `ready-for-agent` (human approved), run 42870198062, 1 min 29 s | branch `agent/issue-15-...`, commit `b2910fe`, 100 tests |
| PR | PR 16, opened by the human | |
| Review 1 | Qodo run 1893958 at `b2910fe`, standard effort | 1 finding |
| Correction | human commit `3e538a2` | ticket and test, no logic change, 101 tests |
| Review 2 | Qodo run 1894133 at `3e538a2`, lite effort | finding 1 still open, 1 new finding |
| Outcome | `dismiss --reason intentional`, both, human approved | both `dismissed`, reconciled |

Two "Agent fixes review findings" runs fired on Qodo's own PR comments (42870784547,
42871053543). Both skipped: no `@claude` in the comment. The guard works.

## Findings and decisions

**Finding 06d9643f** (remediation recommended, Correctness, `src/version.ts:80-83`): fix-rule
triggers come out in section order, not input order; the fix-rule test sorts before comparing, so
it hides this.

- What the code showed: reproduced with three commits `perf, revert, fix` → triggers
  `fix, perf, revert`. `ReleaseGroups` (T-003) keeps input order only within a section. The agent
  had seen this and said so in its issue comment ("Decisions the ticket left open"), but the ticket
  said "in input order", so the code broke criterion 4.
- Options put to the human: (a) amend the ticket to section order and pin it in a test; (b) add an
  input index to every entry (changes `group` JSON, which the ticket's *Must not break* forbids);
  (c) pass the raw commits to `recommendVersion` (changes the criterion 1 signature); (d) leave it
  open.
- Decision (human): (a). Section order is the order `render` prints, so the notes and the
  recommendation agree, and every trigger still carries its SHA and type. Criterion 4 amended with
  a note naming the finding; issue #15 body updated (human approved); `.sort()` removed from the
  test; a new test feeds `perf, revert, fix, perf` and checks `a, b1, b2, c` exactly.

**Finding e5462b0d** (remediation recommended, Maintainability, the ticket, criterion 4), new in
review 2: "Ticket now ratifies the out-of-spec trigger order." The spec was changed to fit the code
in the same PR that adds the code, so the original requirement is never checked against it.

- Assessment: the observation is accurate, not a false positive. The agent chose section order
  first and the spec followed. What makes it acceptable is that a person made the call after
  weighing the alternatives, and the change is visible (amendment note, issue #15, finding id).
- Qodo did not close finding 06d9643f after the push: the code it flagged did not change, and
  re-attribution looks at code, not at the ticket.

Both dismissed in one call as `intentional`, with the explanation in `evidence/day07/dismiss-result.json`.
`false_positive` would have been wrong: neither finding was wrong.

## Checks

- `npm run check` at `3e538a2`: typecheck clean, tests 101, pass 101, fail 0.
- Same four commits through both commands: `render` lists `a, b1, b2, c`; `version` triggers
  `a, b1, b2, c`.
- Read-back after the dismissal: review run 1894133, `completed`, commit `3e538a2` = PR head; both
  findings `dismissed`, none open.

## What the agent or review missed

- **The ticket was wrong first.** I wrote "in input order" without checking that `ReleaseGroups`
  keeps it. Day 6's lesson (check the title's promise against the code) applied again and was not
  used.
- **The factory agent noticed and went ahead.** It listed the deviation under "Decisions the ticket
  left open" while marking criterion 4 *met*. The ticket had not left it open. A conflict with a
  criterion should be *not met, needs decision*, not a quiet choice.
- **The agent's test hid the deviation.** Sorting before comparing made the test pass for any
  order.
- **Review 2 ran at lite effort** and did not re-check the new test; it reasoned about the ticket
  change instead. That was the more useful finding of the two.

## Lesson

When a finding says the code breaks the spec, there are two ways to make it go away, and only one
of them changes the code. Amending the spec is legitimate only as a human decision with a visible
record. Qodo flagged the amendment itself, which is the check you want on an agent that can edit
its own acceptance criteria.

## Links

- PR: https://github.com/UBayouski/tracenotes/pull/16
- Issue: https://github.com/UBayouski/tracenotes/issues/15
- Ticket: `tickets/T-005-recommend-next-version.md`
- Evidence: `evidence/day07/`
- Post: _TODO_
