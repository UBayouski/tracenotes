# Day 02 — Nov 03 — Your factory, your rules

Done on Nov 04 (catching up).

## What was written

`AGENTS.md` at the repository root: project description, setup and verification commands, five
project rules with where each applies and why, code conventions, and process rules.

## Most opinionated rule

**The No Orphan Notes Rule.** Every release-note entry carries a link to its source commit or
pull request. A renderer or tool that emits an entry without a source is a bug, even if the text
is correct.

**The story.** Most changelog generators are summarizers. They read commit subjects, tidy them
up, and print a list. The list looks authoritative and is unverifiable: you cannot tell which
commit a line came from, whether two lines came from one commit, or whether a commit was
silently dropped. The moment an agent is writing the notes, that gap becomes dangerous, because
the agent can produce a plausible line for a change that never happened. This rule makes the
product's identity structural rather than aspirational. If the source link is not there, the
output is wrong by definition, and a test can say so.

Runner-up: **The Nothing Vanishes Rule** (no commit in a range is dropped silently). It exists
for the same reason, from the other side: the first rule guards against invented lines, the
second guards against missing ones.

## Qodo review of the PR

PR 2 carried only documentation, and the review still produced two findings:

| # | Level | Finding | Verdict |
|---|---|---|---|
| 1 | recommended | The Day 1 journal says CLI coverage rules belong in AGENTS.md, but AGENTS.md had no such rule. | Real. A cross-document consistency check, which a diff-only reviewer would not make. Added a code convention requiring child-process CLI tests. |
| 2 | informational | Files already committed with CRLF would stay mixed after the LF policy. | False positive for this repository. `core.autocrlf=true` normalized every commit; `git ls-files --eol` shows all 19 tracked files as LF in the index. Correct reasoning, wrong premise. |

**Useful.** Finding 1 shows the reviewer reads the whole PR as a set of claims, not only the
diff. The journal made a promise and the rules did not keep it.

**Questioned.** Finding 2. The fix was to verify, not to change anything. Worth noting because
a less careful response would have been a pointless renormalize commit.

## Qodo Review Standards

Merging AGENTS.md to `main` did **not** import the rules by itself. Background activity showed
repository sync and PR indexing complete, but no rule import. "Import rules and skills" was
required, as the Day 2 brief anticipated.

The import read `AGENTS.md` and produced **14 active rules**, not 5. Qodo split compound rules
into atomic, checkable statements and also picked up the code conventions and the verification
section:

| Source in AGENTS.md | Rules Qodo created | Severity |
|---|---|---|
| Rule 1, No Orphan Notes | Link every emitted release-note entry to its source | High |
| Rule 2, Nothing Vanishes | Account for every commit instead of silently dropping | High |
| Rule 3, Explain Every Bump | Return the determining rule with every version recommendation; Return triggering commits with every version recommendation | High, High |
| Rule 4, Zero Runtime Dependencies | Do not add runtime dependencies without a built-in justification ticket; Limit development dependencies to type checking | High, Medium |
| Rule 5, Tests never touch network or live repo | Keep tests free of HTTP requests; Do not run git against the real repository from tests; Put git and GitHub access behind an interface with a fake | High, High, Medium |
| Code conventions | Use `.ts` extensions for local module imports; Use only erasable TypeScript syntax; Confine process output and exit-code mutation to `cli.ts`; Test CLI boundary changes through a real child process | High, High, High, High |
| Setup and verification | Cover code changes with tests in `tests/` | Medium |

All 14 were active immediately; no manual activation was needed. Categories were assigned
automatically (Correctness, Testability, Maintainability, Security). The CLI child-process rule
added during PR 2's review round was imported too, so the import reads the merged file, not the
original.

Observations for Day 6 and Day 7:
- The split is useful: "Explain Every Bump" is really two checks, and the import made that
  explicit.
- Two imported rules are weaker than intended. "Limit development dependencies to type checking"
  reads as Maintainability/Medium, but it is the enforcement half of rule 4. And "Cover code
  changes with tests" came from a sentence in the setup section, not from a rule. Worth deciding
  whether the setup section should be rule-shaped or not.
- Nothing from the Process rules section (human commits, one ticket per PR, journal per day) was
  imported. Those are not code-reviewable, which is the right outcome.

## Evidence

- AGENTS.md: https://github.com/UBayouski/tracenotes/blob/main/AGENTS.md
- PR: https://github.com/UBayouski/tracenotes/pull/2
- Day 2 Discussion post: _TODO_
