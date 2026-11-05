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

_TODO after merge: check Review Standards for the imported rules. Note whether all five
appeared, whether any needed activation, and whether "Import rules and skills" was required._

## Evidence

- AGENTS.md: https://github.com/UBayouski/tracenotes/blob/main/AGENTS.md
- PR: https://github.com/UBayouski/tracenotes/pull/2
- Day 2 Discussion post: _TODO_
