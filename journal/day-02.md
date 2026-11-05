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

## Qodo Review Standards

_TODO: after push, check Qodo Review Standards for the imported rules. Note whether all five
appeared, whether any needed activation, and whether "Import rules and skills" was required._

## Evidence

- AGENTS.md link: _TODO after push_
- Day 2 Discussion post: _TODO_
