# Day 05 — Nov 06 — Make your factory self-improve

Brief: https://github.com/orgs/qodo-hackathon/discussions/7. Find a rule worth adding, from
Qodo's mined suggestions or from the coding agent reading the repo and the review history.
Ground it in evidence, refine it (what, where, why), save it through a PR, post the decision.

## Path

Coding-agent proposal. Qodo had nothing to offer yet: `qodo read rules list --state pending`
returned zero rules, and all 14 active rules have source type "Repository File" (the AGENTS.md
import from Day 2). No "Mined Pattern" entries. The brief anticipates this for a new repository.

The agent (Claude Code) ran the brief's prompt against the repository and the nine findings from
PRs 1 to 8, read through the Qodo CLI (`qodo read pr-review-session findings --extended`).

## Candidates proposed

| # | Rule | Evidence | Existing coverage | Verdict |
|---|---|---|---|---|
| 1 | Validate before you normalize | PR 1 blank scope `( )` trimmed to null and accepted; PR 1 paragraph `.trim()` removed code-block indentation; PR 3 leading whitespace stripped before the SHA check | None. Nothing Vanishes is about dropping input, not accepting bad input. | **Kept.** Three independent findings, same mistake, in two modules. |
| 2 | A rule and its enforcement change together | PR 2 journal promised a rule AGENTS.md lacked; PR 5 fix workflow contradicted the `agent/*` exception in the same PR; PR 8 config comment did not match the shipped defaults | None, but half of it is process, which Qodo did not import on Day 2. | Rejected for today. Real pattern, but the code-reviewable half is thin and Qodo already performs this check without being told. |
| 3 | Process access is injected, never patched | PR 7 test helper monkeypatched `process.stdout.write` | Convention 3 covers the library side; the test side was the gap. | Rejected as a new rule. It is a refinement of an existing convention, and the `CliIo` sinks from PR 7 already enforce it. Worth a one-line addition to convention 3 later. |

Deliberate versus incidental: candidate 1 was never a convention. It emerged as the same slip
three times, which is a stronger reason for a rule than a convention nobody has broken.

## The rule as saved

AGENTS.md project rule 6, "Validate Before You Normalize": check the raw field, strip only
documented framing (record separator, git's trailing newline, BOM) before the check, never
`.trim()` then validate, never let normalization make an invalid value look valid. Applies to
`src/commit.ts`, `src/gitlog.ts`, and every future parser including MCP input. The why section
cites the three findings.

Refinements made to the agent's first wording: "documented framing" was listed explicitly so the
rule cannot be read as "never strip anything" (the BOM strip from Day 3 is correct and must stay
allowed); MCP tool input was added to the scope because Day 14 and 15 will parse it.

## Evidence I could not access

Qodo's portal UI. The CLI confirms the same facts (zero pending, 14 active, all from
AGENTS.md), and that is what the post cites.

## Qodo review

PR 9, two findings on the first review, both recommended, both about wording in AGENTS.md:

1. **Ticket agents may stop before pushing** (reliability). The new "push only with explicit
   approval" rule would be read by the workflow agent too, since it reads AGENTS.md first, and
   the workflow exception mentioned bot commits but not pushes. A literal agent would implement
   the ticket and then wait for an approval nobody is there to give. Fixed: the exception now
   says the workflows commit *and push* without per-push approval, and names the label or the
   `@claude` comment as the approval for that run.
2. **Valid commit messages fail the new rule** (maintainability). Rule 6 listed the framing a
   parser may remove before validating, and the list missed one thing `parseCommit` already
   does: `\r\n` to `\n` normalization before the header check (`src/commit.ts`). As written, a
   valid CRLF commit message could not satisfy both rule 6 and the T-001 acceptance criteria.
   Fixed: line-ending normalization is on the list, plus a sentence that new framing is added to
   the list, with a test, before a parser removes it.

Both are the rejected candidate 2 in action: a rule changed and the thing it governs did not
match. The reviewer applies that check whether or not it is written down, which was the reason
for rejecting it as a rule, and this PR is the evidence. Candidate 2 goes back on the list for
a later day in a narrower form: "when a rule names what is allowed, the list must match the
code that exists".

## Import check

PR 9 merged as `02ce479`. "Import rules and skills" run by hand in the portal, as on Day 2.
`qodo read rules list` then showed 15 rules, one new:

- **4578695, "Validate raw parser fields before normalization"**: active, severity error,
  category Correctness, scope `/ubayouski/tracenotes/`, source type Repository File.
- Qodo rewrote the rule as a check procedure: trace each field from input to validation, verify
  that trimming, stripping, or case conversion cannot make invalid input pass, allow only the
  framing listed in AGENTS.md, and probe with whitespace-padded scopes, indented headers, and
  junk before a SHA. The bad example is a `.trim()` before a SHA regex, which is the PR 3 finding
  exactly.
- The process-rule amendment (push with approval) was not imported. Right outcome; it is not
  code-reviewable.

## Lesson

A rule proposed from review history was itself caught twice by review, for the pattern I had
just declined to make a rule. The reviewer does not need the rule to apply the check, but the
author did. Rules written for the agent are also rules written for me.

## Evidence

- PR: https://github.com/UBayouski/tracenotes/pull/9 (2 findings on `e12a599`, both fixed in
  `190db54`, re-review clean)
- Rule: https://app.qodo.ai/rules/4578695
- CLI evidence: `qodo read rules list --state pending --json` → `{"totalCount":0}` before;
  `qodo read rules list --json` → 15 rules after import
- Post: https://github.com/orgs/qodo-hackathon/discussions/7

## Addendum, same evening: T-003 through the factory

Issue #11 created from `tickets/T-003-group-commits-into-sections.md`, label added by hand.
The run took 53 s on the second attempt (the first was a no-op; see the Day 4 note on agent
mode) and produced `src/group.ts`, a `group` CLI command, 66 tests, and a 9/9 criteria table
with six documented decisions on things the ticket left open. PR 12.

Two firsts:

- **Qodo re-reviewed a bot push on its own.** The `.pr_agent.toml` change from PR 8 works: the
  second review started 19 seconds after `claude[bot]` pushed, no `/review` needed. The Day 4
  gap is closed.
- **The agent disagreed with the reviewer.** Qodo's one finding said an indented `  Merge ...`
  header should be ignored as a merge; the code checks the raw header and sends it to
  Unclassified. The agent read both files, decided the finding was wrong, added a test pinning
  the behavior, and wrote "please overrule me if you disagree" instead of changing the code.
  Its stated reason, rule 6, over-reaches: classification is not validation. The better reasons
  are that git never indents a merge subject, and that surfacing an odd commit under
  Unclassified with its SHA is safer than silently ignoring it. Human decision: keep the code,
  dismiss as intentional with that explanation, recorded through the Qodo CLI.

The ticket said "subject starts with `Merge `". The agent read "subject" as the raw header,
the reviewer read it as the parsed, trimmed subject. Both readings were defensible; the ticket
should have said which. Same lesson as Day 3: the edges of the input contract are where
tickets go vague.
