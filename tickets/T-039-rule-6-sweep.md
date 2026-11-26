# T-039: Rule 6 learns from its findings: wider scope, a sweep, and the header fix

**Goal.** Close the two gaps in rule 6 (Validate Before You Normalize) that Qodo's findings show,
and fix the one violation still in the code: the parser matches a commit header as received, the
rule names the check scripts, and a rule that is added or widened comes with a sweep of the code
it applies to. Takes over T-030.

**Why.** Day 19 (Nov 26), "What is your factory learning?". Rule 6 was written on Day 5
(`e12a599`, Nov 6) from three Qodo findings in PRs 1 and 3. From Nov 6 to 26 Qodo raised the same
kind of finding five more times (`evidence/day19/`):

- `88effe66` (PR 28, High), real: `src/commit.ts:128` has trimmed the header since Nov 4, before
  the rule existed. The rule names that file, but nobody swept it. PR 28 worked around it in
  `src/check.ts`; T-030 (the real fix) stayed `planned`.
- `28bcc7c0` (PR 34, High), real, new code: `scripts/action-pins.ts` trimmed before the pin check.
  The rule's "Applies to" does not name `scripts/`; Qodo applied the rule anyway.
- `cd584e42` (PR 9): the rule as first written was too strict (CRLF); fixed then.
- `69b1fa82` (PR 26), false positive, dismissed; `e7e44ef3` (PR 12), intentional, dismissed.

New parser code in the files the rule names had no real violation. Both real ones are at the
rule's edges: code older than the rule, and a kind of file it does not name.

**Investigation.** Done Nov 26 on `main` at `2b8529a`, by reading `src/commit.ts`, `src/check.ts`,
`tests/commit.test.ts`, `tests/check.test.ts`, `tests/group.test.ts`, `AGENTS.md` rule 6 and its
history (`git log -S`, `git blame -L 128,128 src/commit.ts`: `81eb447`, Nov 4), and Qodo's
findings for every PR (`qodo read pr-review-session findings --extended`).

- `normalize()` already removes everything rule 6 allows (line endings, trailing whitespace per
  line, blank lines at the start and end). The `.trim()` on the header adds only the forbidden
  part: leading whitespace, including `\u00a0` and `\ufeff`, which `normalize()` does not touch.
- Removing it changes one behaviour: a header that starts with whitespace is no longer
  conventional, so it goes to Unclassified in the notes (still visible, with its SHA; rule 2)
  instead of its type's section. `check` already fails such a header since PR 28, so its output
  does not change; its workaround becomes redundant.
- `subject` for a non-conventional message is still the header text with its outer spaces
  trimmed (display only, after the match); `raw` keeps the leading spaces.
- What changed in the ticket: T-030 alone fixed the parser; the findings show the rule itself
  needs the wider scope and the sweep, so both are one ticket.

**Acceptance criteria.**

1. `parseCommit()` matches the header line as received after `normalize()`. A header that starts
   with a space, a tab, `\u00a0` or `\ufeff` is not conventional (type null, not breaking).
   Trailing whitespace and `\r\n` stay framing: `feat: x  `, `feat: x\r\n` and
   `feat: x (#12)  ` are still conventional.
2. A message `  feat: x` groups as Unclassified, counted, not as a feature.
3. `checkGitLog()` passes a header when the parser calls it conventional, without its own
   leading-whitespace test; the existing test for finding 88effe66 passes unchanged.
4. `AGENTS.md` rule 6: "Applies to" also names the checks in `scripts/` and
   `.claude/skills/*/scripts/`; a short "What happened next" line records the two findings.
5. `AGENTS.md` Process rules: a rule that is added or widened comes with a sweep of the code it
   applies to, in the same pull request, with what was searched and found in its evidence.
6. The sweep is run for rule 6 and saved (`evidence/day19/t039/03-rule-6-sweep.md`). Each hit has
   a verdict; anything that breaks the rule and is not fixed here gets a ticket.
7. `BACKLOG.md`: T-030 points to T-039; a ticket for each new sweep case.
8. `npm run check` passes.

**Out of scope.** Qodo's rules and severities; the subject's display trim; fixing cases the sweep
finds beyond the header (they become tickets); any other project rule.

**Verification.** `node --test tests/commit.test.ts tests/group.test.ts` (red before, green after,
`evidence/day19/t039/01-red.txt`, `02-green.txt`); `node --test tests/check.test.ts`;
`npm run check`; the sweep file; Qodo local review and PR review at the head.
