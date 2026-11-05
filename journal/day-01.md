# Day 01 — Nov 02 — Your factory's first delivery

Done on Nov 04 (catching up).

## Project

**tracenotes**: release notes where every line links to its source commit or pull request, and
every version bump explains the rule behind it.

**Who it helps.** Maintainers who want release notes they can audit, and agent pipelines that
need a deterministic, explainable version bump. It is also this factory's own release-notes
writer, so by the end of the hackathon the product describes the repository that built it.

**First capability.** Parse one Conventional Commits message into structured data: type, scope,
subject, breaking flag, body, footers, breaking notes, issue references, and PR number from
squash-merge subjects. Ticket: `tickets/T-001-parse-conventional-commit.md`.

## What was built

- `src/commit.ts`: parser, no dependencies, never throws on string input.
- `src/cli.ts`: `parse` command, JSON output, stdin support.
- `tests/commit.test.ts`: 24 tests covering the grammar, non-conventional input, footers, and normalization.
- Toolchain: Node 24 native TypeScript, `node --test`, `tsc --noEmit`. Zero runtime dependencies.

## Evidence

- Repository: _TODO add link after push_
- Pull request: _TODO add link_
- Screenshot or demo: _TODO: output of `node src/cli.ts parse "feat(parser)!: drop legacy footer syntax (#17)"` and `npm run check`_

## Qodo review

_TODO after the first review: what it found, what was useful, what I questioned, what it missed._

## Lesson or decision

Decision: keep git invocation outside the tool for now and accept a `git log` stream on stdin
(T-002). This keeps tests free of any live repository from day one and turns the input format
into a contract that fixtures can target.

_TODO: add one lesson from the Qodo review once it has run._
