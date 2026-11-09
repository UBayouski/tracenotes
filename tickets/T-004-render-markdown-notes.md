# T-004: Render Markdown notes with a source link on every entry

**Goal.** Turn a git log stream into Markdown release notes where every entry names its source
commit (and pull request when known), every input commit is accounted for, and no commit text can
inject Markdown or HTML.

**Input.** The same git log stream `log` and `group` read. The renderer works on `ReleaseGroups`
from `groupGitLog` (T-003); nothing is parsed twice.

**Why this shape.** Investigated on Day 6 before implementation; see `journal/day-06.md`. Short
version: no repository URL exists in the code until T-010, so links are optional and the bare
short SHA is the always-present source; `group` already builds sections, so this ticket only
renders; and commit subjects are raw text, so they are escaped.

**Acceptance criteria.**

1. `renderMarkdown(groups: ReleaseGroups, options?: { repoUrl?: string }): string` in
   `src/render.ts`. Pure: no I/O, no clock, no environment. The same input gives the same bytes.
   Exported from `src/index.ts`, together with `groupCommits`, `groupGitLog` and the group types,
   which `index.ts` does not export today.
2. Output starts with `## Unreleased`, then one `### <section title>` per non-empty section in the
   order `groupCommits` returns, then one list item per entry in input order. Line endings are
   `\n`; the output ends with exactly one `\n`.
3. Entry line format, one line per entry, nothing else on the line:
   `- **<scope>:** <subject> (<source>)`, with the `**<scope>:** ` part only when scope is not
   null. `<source>` is the short SHA, then `, #<prNumber>` when `prNumber` is not null.
   Without `repoUrl` both are plain text: `` (`abc1234`, #42) ``. With `repoUrl` both are links:
   `([abc1234](<repoUrl>/commit/<full sha>), [#42](<repoUrl>/pull/42))`. An entry with no source
   cannot be produced (No Orphan Notes): the SHA part is always there.
4. Subject and scope are escaped so they render as the literal text of the commit: the characters
   `` \ ` * _ [ ] < > # | & `` and `~` are backslash-escaped. Escaping only adds characters; nothing
   is removed or trimmed (rule 6). A subject `add [x](http://e) <b>` renders as text, not as a
   link or a tag.
5. Entries in `Breaking changes` list each `breakingNotes` value as an indented sub-item
   (`  - <note>`, escaped the same way). A breaking commit with no notes gets no sub-items.
6. Nothing Vanishes: after the sections, a final paragraph accounts for everything not rendered
   as an entry: `_<n> of <total> commits shown; <i> merge commits ignored; <m> malformed records
   skipped._` with each count always present, even when zero. A stream with only merge commits
   renders the heading, no sections, and that line. The counts are checked by a test against
   `total` and `malformed.length`.
7. `repoUrl` is validated as given, before use, and never repaired: it must match
   `https://<host>/<owner>/<repo>` with no trailing slash, no `.git` suffix, no query or fragment.
   Anything else throws `RangeError` naming the value. It is not trimmed first (rule 6).
8. CLI: `node src/cli.ts render [--repo-url <url>]` reads a git log stream from stdin with the same
   contract as `group` (terminal stdin and empty stdin exit 2 with the usage text), prints the
   Markdown and exits 0. An invalid `--repo-url`, a missing value after it, or an unknown option
   exits 2 with an error on stderr and nothing on stdout. `USAGE` lists the command.
9. Tests: `tests/render.test.ts` for criteria 1 to 7 from `tests/fixtures/log-basic.bin` and inline
   streams, including: the injection subject from criterion 4; a merge-only stream; a malformed
   record; a breaking commit with and without notes; output with and without `repoUrl`; and each
   invalid URL form from criterion 7. `tests/cli.test.ts` gets child-process cases for criterion 8
   (success with and without `--repo-url`, invalid URL, missing value, terminal stdin).

**Must not break.** `parse`, `log` and `group` output and exit codes stay as they are; all
existing tests pass unchanged.

**Out of scope.**
- Detecting the repository URL from the origin remote (T-010). This ticket only accepts it.
- A version number in the heading (T-005 recommends one; T-012 writes `CHANGELOG.md`).
- Link formats other than GitHub's `/commit/` and `/pull/` paths.
- Linking issue references (T-022).
- Per-commit `warnings` from `parseGitLog` (for example a date that is not ISO 8601). `groupCommits`
  does not carry them today; see the follow-up in `journal/day-06.md`.
- Reading `group` JSON from stdin as an alternative input.

**Verification.** `npm run check`. Manual:
`git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' -10 | node src/cli.ts render --repo-url https://github.com/UBayouski/tracenotes`
prints Markdown whose links open the right commits.

**Status.** Backlog line written on Day 1 ("Render Markdown notes with a source link on every
entry"). Ticket written and investigated on Day 6 with Qodo Codebase Wisdom.
