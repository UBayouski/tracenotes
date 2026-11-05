# T-003: Group commits into release-note sections

**Goal.** Turn a list of parsed commits into the sections a release note is made of, with every
entry carrying its source and every input commit accounted for.

**Input.** `LoggedCommit[]` as produced by `parseGitLog` (T-002).

**Acceptance criteria.**

1. `groupCommits(commits: LoggedCommit[]): ReleaseGroups` returns `sections: Section[]` in this
   fixed order, omitting empty sections: `Breaking changes`, `Features` (type `feat`),
   `Bug fixes` (`fix`), `Performance` (`perf`), `Reverts` (`revert`), then one section per
   remaining conventional type in alphabetical order titled by the type name
   (`build`, `chore`, `ci`, `docs`, `refactor`, `style`, `test`, and any other type),
   then `Unclassified` for non-conventional messages.
2. Every entry has `sha` (40 hex), `shortSha` (first 7), `subject`, `scope` (or null),
   `prNumber` (or null), `issueRefs`, `breaking`, and `type` (or null). An entry without `sha`
   is impossible by construction (No Orphan Notes).
3. A commit appears in exactly one section. A breaking commit goes to `Breaking changes` with
   its `breakingNotes` attached and does not also appear under its type.
4. Merge commits (subject starts with `Merge `) are not placed in a section. They are returned
   in `ignored: IgnoredEntry[]` with `reason: "merge commit"` and the same entry fields.
5. `total` equals `commits.length`, and the sum of all section entry counts plus `ignored.length`
   equals `total` (Nothing Vanishes). This is checked by a test on every fixture.
6. Order inside a section is the input order.
7. Entries are plain data, no functions, so the result can be serialized with `JSON.stringify`
   unchanged.
8. CLI: `node src/cli.ts group` reads a git log stream from stdin (same contract as `log`) and
   prints `ReleaseGroups` as JSON. Exit 0 when the stream parses, including when `malformed`
   records exist; those are passed through as `malformed` in the output so they stay visible.
   Exit 2 on empty stdin.
9. Edge cases covered by tests: a stream containing only merge commits (no sections, all
   ignored, totals match); a `feat!` commit with no `BREAKING CHANGE` footer (lands in
   `Breaking changes` with an empty notes list); a type never seen before such as `wip` (gets
   its own section, not dropped).

**Out of scope.** Markdown rendering (T-004), version calculation (T-005), configurable section
names and ignore patterns (T-008), source links as URLs (T-010).

**Verification.** `npm run check`. Tests in `tests/group.test.ts` driven by
`tests/fixtures/log-basic.bin` plus inline streams for the edge cases. CLI behavior tested in
`tests/cli.test.ts`.

**Status.** Ticket written on Day 3.
