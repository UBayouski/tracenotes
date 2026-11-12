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
- `tests/commit.test.ts` and `tests/cli.test.ts`: 33 tests after the review round.
- Toolchain: Node 24 native TypeScript, `node --test`, `tsc --noEmit`. Zero runtime dependencies.

## Evidence

- Repository: https://github.com/UBayouski/tracenotes
- Pull request: https://github.com/UBayouski/tracenotes/pull/1
- Commits: `81eb447` first delivery, `3450ffa` review fixes.
- Demo:

```
$ node src/cli.ts parse "feat(parser)!: drop legacy footer syntax (#17)"
{
  "conventional": true,
  "type": "feat",
  "scope": "parser",
  "breaking": true,
  "subject": "drop legacy footer syntax",
  "prNumber": 17,
  ...
}
$ npm run check
ℹ tests 33  ℹ pass 33  ℹ fail 0
```

## Qodo review

Preset: Recall (every check on, no automated fixes). First review on `81eb447` returned three
findings, all correctness:

| # | Level | Finding | Verdict |
|---|---|---|---|
| 1 | action required | CLI entry check built a `file:///` URL by hand; on POSIX paths this yields four slashes, never matches `import.meta.url`, and `main()` silently never runs. | Real. Only worked on Windows, which is where I tested. Would have shipped a CLI that does nothing in CI. |
| 2 | recommended | Body paragraphs were trimmed, so an indented first line lost its indentation. | Real, minor. Fixed by stripping only separator newlines. |
| 3 | recommended | `feat( ): x` passed as conventional with a null scope while `feat(): x` was rejected. | Real, inconsistent behavior. Fixed in the header regex. |

All three were fixed in `3450ffa` with tests. The re-review on that commit attributed all three as
implemented and raised nothing new.

**Useful.** Finding 1 was a platform bug that the test suite could not see, because nothing
tested the CLI as a process. The review found a class of bug (environment-specific entry logic)
that unit tests of pure functions never will.

**Questioned.** Nothing. All three findings described real behavior, and the descriptions
included a concrete input that reproduced each one.

**Missed.**
- `tracenotes parse` with no argument and no piped input blocks waiting on stdin. It should
  detect a TTY and print usage. Deferred to a later ticket.
- A trailing body paragraph such as `Note: see the docs.` is classified as a footer because it
  matches the `Token: value` shape. This is defensible per the spec but will surprise users and
  needs a documented decision.
- The absence of any CLI test was the root cause of finding 1, and the review flagged the
  symptom, not the gap. Rules about test coverage belong in AGENTS.md (Day 2).

## Lesson or decision

**Lesson.** "It works on my machine" was literally true. The entry-point check passed on Windows
and would have failed on every Linux CI runner. The review caught it before any CI existed. From
now on the CLI is tested as a child process, not only through its functions.

**Decision.** Keep git invocation outside the tool for now and accept a `git log` stream on stdin
(T-002). This keeps tests free of any live repository from day one and turns the input format
into a contract that fixtures can target.

## Tooling notes

- Qodo CLI 2.1.0 installed on Windows. The one-line `irm | iex` installer was blocked by Windows
  Defender as a heuristic match on the command pattern; running the same script from a saved
  file succeeded. Installed with Standards enabled, wired to Claude Code only.
- Qodo review was read through the CLI (`qodo read pr-review-session findings`) rather than by
  scraping PR comments, which gives the reviewed commit SHA and attribution status per finding.

## Evidence

- Post: https://github.com/orgs/qodo-hackathon/discussions/2#discussioncomment-19410155
