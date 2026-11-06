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

_TODO after the PR._

## Import check

_TODO after merge: run "Import rules and skills", confirm rule 6 appears with repository scope and
active state, record the rule id._

## Evidence

- PR: _TODO_
- CLI evidence: `qodo read rules list --state pending --json` → `{"totalCount":0}`
- Post: _TODO_
