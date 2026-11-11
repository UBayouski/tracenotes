# T-007: JSON output mode for machine consumers

**Goal.** `render` can print the release notes as a JSON document with the same content as the
Markdown notes, so an agent pipeline or a script reads entries, sources and counts without parsing
Markdown. Every entry carries its source (No Orphan Notes, rule 1) and every input commit is
accounted for (Nothing Vanishes, rule 2).

**Input.** The same git log stream `render` already reads, plus a `--format` option. The document
is built from `ReleaseGroups` (T-003); nothing is parsed twice.

**Why this shape.** `group` already prints JSON, but it is the grouping stage's internal data: no
links, no shown count, no schema version. A machine consumer of the *notes* needs what a human
reader of the Markdown gets: the same sections and entries in the same order, a source per entry
(with URLs when `--repo-url` is given), and the same accounting line as numbers. Building both
formats from one document keeps them from drifting apart.

**Acceptance criteria.**

1. `notesDocument(groups: ReleaseGroups, options?: RenderOptions): NotesDocument` in
   `src/render.ts`. Pure: no I/O, no clock, no environment. `renderJson(groups, options?)` returns
   that document as a string: `JSON.stringify` with a 2-space indent, `\n` line endings and exactly
   one trailing newline. Both are exported from `src/index.ts` with the document types.
2. `NotesDocument` has exactly these keys, in this order: `schemaVersion` (the number `1`), `title`
   (`"Unreleased"`), `sections`, `counts`. Each section is `{ title, entries }`. Each entry is
   `{ scope, subject, breakingNotes, source }` with every key always present: `scope` is a string
   or `null`; `breakingNotes` is an array, empty for entries outside `Breaking changes`.
3. No Orphan Notes: `source` is `{ sha, shortSha, commitUrl, prNumber, prUrl }`, every key always
   present. `sha` is the full 40-character SHA and is never empty. Without `repoUrl`, `commitUrl`
   and `prUrl` are `null`. With `repoUrl`, `commitUrl` is `<repoUrl>/commit/<sha>` and `prUrl` is
   `<repoUrl>/pull/<prNumber>` when `prNumber` is not `null`, else `null`. The URLs are the same
   ones the Markdown links use.
4. Same content as Markdown: sections and entries appear in the order `renderMarkdown` prints
   them. `renderMarkdown` is built from the same document; its output does not change by a single
   byte (all existing render tests pass unchanged).
5. Text is raw. `subject`, `scope`, section titles and `breakingNotes` are the parsed values with
   no Markdown escaping; `JSON.stringify` does the only escaping. A subject containing `*`, `<`,
   `"`, a backslash or a control character round-trips through `JSON.parse` to the parsed value.
6. Nothing Vanishes: `counts` is `{ shown, total, ignored, malformed }`, every key always present.
   `shown + ignored === total`, and `malformed` equals `groups.malformed.length`. The numbers are
   the ones in the closing line of the Markdown notes. A test checks both identities.
7. A range with nothing to show (only merge commits, or `groupCommits([])`) gives a valid document
   with `sections: []` and all four counts present.
8. `repoUrl` is validated by `checkRepoUrl` exactly as in `renderMarkdown`; an invalid value throws
   `RangeError` from `notesDocument` and `renderJson`.
9. CLI: `node src/cli.ts render [--repo-url <url>] [--format markdown|json]`. Without `--format`
   the output is Markdown, as today. `--format json` prints `renderJson` output and exits 0. The
   value must be exactly `markdown` or `json`; it is compared as given, never trimmed or
   lower-cased (rule 6). Any other value, or a missing value after `--format`, exits 2 with an
   error on stderr that names the value, and nothing on stdout. The value is validated before stdin
   is read. Stdin handling (terminal, empty) is unchanged for both formats. When an option is
   given more than once the last one wins, as `--repo-url` already behaves. `USAGE` documents the
   option.
10. Tests: `tests/render.test.ts` for criteria 1 to 8 from `tests/fixtures/log-basic.bin` and
    inline streams, including the exact document for the fixture with and without `repoUrl`, the
    key order, a subject with Markdown, HTML, quote, backslash and control characters, a
    merge-only range, an empty `groupCommits([])`, and an invalid `repoUrl`. `tests/cli.test.ts`
    gets child-process cases for criterion 9 (json success with and without `--repo-url`, default
    still Markdown, explicit `markdown`, invalid value, wrong case, missing value) and an in-process
    case proving an invalid `--format` fails before stdin is read.

**Must not break.** `parse`, `log`, `group`, `version` and `render` without `--format` keep their
output and exit codes; all existing tests pass unchanged.

**Out of scope.**
- Listing ignored merge commits or malformed records in the document; `group` and `log` already
  print them. The document carries their counts, like the Markdown closing line.
- A JSON Schema file for the document.
- JSON for `version`, `group`, `log` or `parse` (they already print JSON).
- A version number or date in `title` (T-012).
- Rejecting repeated options.
- An MCP tool that returns the document (T-013).

**Verification.** `npm run check`. Manual:
`git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' -10 | node src/cli.ts render --format json --repo-url https://github.com/UBayouski/tracenotes`
prints a document whose entries match the Markdown notes for the same range.

**Status.** Backlog line written on Day 1. Ticket written on Day 8 for the "Review before you
commit" challenge: implemented in an interactive session, reviewed with Qodo local review while
uncommitted.
