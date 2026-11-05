# T-001: Parse a Conventional Commits message

**Goal.** Turn one raw commit message into structured data that later steps can group, link, and reason about.

**Acceptance criteria.**

1. `parseCommit(message)` returns type, scope, subject, and a breaking flag for a header of the form `type(scope)!: subject`, following Conventional Commits 1.0.0.
2. A trailing `(#123)` in the header is extracted as `prNumber` and removed from the subject. A `(#N)` elsewhere in the subject is left alone.
3. Body paragraphs are returned as `body`; footers at the end of the message are returned as `footers` in order, supporting both `Token: value` and `Token #value` forms and multi-line values.
4. `BREAKING CHANGE:` and `BREAKING-CHANGE:` footers set `breaking` and populate `breakingNotes`.
5. Issue numbers in closing or referencing footers (`Closes`, `Fixes`, `Resolves`, `Refs`, and their variants, case-insensitive) are collected into `issueRefs` without duplicates.
6. A message that does not match the grammar is still returned with `conventional: false`, its header as `subject`, and body, footers, and PR number parsed as usual. The function never throws on string input.
7. CRLF line endings and trailing whitespace are normalized.
8. A CLI entry `node src/cli.ts parse <message>` prints the result as JSON, reads stdin when no argument is given, and exits 2 on empty input or unknown command.

**Out of scope.** Reading from git, grouping, rendering, version calculation.

**Verification.** `npm run check`. Tests in `tests/commit.test.ts` cover each criterion.

**Status.** Done on Day 1.
