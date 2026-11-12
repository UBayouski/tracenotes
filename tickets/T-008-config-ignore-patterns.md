# T-008: Config file with ignore patterns

**Goal.** A maintainer lists commit subjects that should stay out of the release notes (dependency
bumps, release chores) in a config file, and passes it with `--config`. Commits that match are
moved out of the sections but stay counted and stay visible in `group` output with the pattern
that matched (Nothing Vanishes, rule 2).

**Input.** A JSON file, by convention `.tracenotes.json`, given explicitly:

```json
{ "ignore": ["^chore\\(deps\\)", "^docs: typo"] }
```

Each string is a regular expression tested against the first line of the commit message.

**Why this shape.** The path is explicit (`--config <path>`) so that a run is reproducible from
its command line and no test depends on the working directory. Patterns are regular expressions
because the things people ignore are prefixes with a scope (`chore(deps)`), which a plain type
list cannot express. The file is strict (unknown keys are errors) because a misspelled key that
is silently skipped means commits the maintainer wanted hidden are shown, or the reverse.

**Acceptance criteria.**

1. `parseConfig(text: string): Config` in new `src/config.ts`, exported from `src/index.ts` with
   the `Config` type (`{ ignore: string[] }`). Pure: no file access, no environment. It throws
   `RangeError` with a message naming the problem when: the text is not valid JSON; the top level
   is not an object (an array, `null`, a string and a number are all rejected); a key other than
   `ignore` is present (the message names the key); `ignore` is not an array; an element is not a
   string (the message gives its index); an element is the empty string; an element is not a
   valid regular expression under the `u` flag (the message gives the index and the pattern).
   `{}` is valid and means no patterns.
2. Validate Before You Normalize (rule 6): pattern strings are used exactly as written. Nothing is
   trimmed, lower-cased or repaired, so `" ^chore"` is a pattern that starts with a space. The
   only framing removed before parsing is one leading byte order mark, which rule 6 already
   lists. A test covers a file with a BOM and a pattern with surrounding spaces.
3. `groupCommits(commits, malformed?, options?)` in `src/group.ts` takes
   `options.ignore?: string[]`. Called without it, the result is identical to today for every
   existing test. Patterns are compiled with the `u` flag and no other flag, and tested against
   the first line of `commit.message.raw`, untrimmed.
4. Order of checks per commit: merge commit first (reason `merge commit`, as today), then
   breaking, then ignore patterns, then type. **A breaking commit is never ignored by a
   pattern**: it stays in `Breaking changes`, so a config file cannot hide a breaking change or
   lower the version recommendation below major.
5. Nothing Vanishes: a commit that matches goes to `ignored` with reason
   `ignore pattern: <pattern>`, where `<pattern>` is the first matching pattern in file order,
   as written. `ignored.length + (entries in sections) === total` still holds. A test checks the
   identity with merge commits, pattern matches and a breaking commit that matches a pattern.
6. `render` Markdown: when no commit was ignored by a pattern, the output is byte-for-byte what
   it is today. When at least one was, the closing line reads
   `_S of T commits shown; M merge commits ignored; P ignored by config; X malformed records skipped._`
   with `M` counting merge commits only and `P` the pattern matches.
7. `render --format json`: the document keeps exactly the T-007 keys and `schemaVersion` 1.
   `counts.ignored` is `M + P`, so `shown + ignored === total` holds. The doc comment on
   `NotesCounts.ignored` says so.
8. `version` with a config: commits ignored by a pattern do not trigger a bump and are counted in
   the existing `ignored` number of its output. Combined with criterion 4, a `feat!` commit that
   matches a pattern still gives a major recommendation; a test proves it.
9. CLI: `--config <path>` is accepted by `group`, `render` and `version`, and documented in
   `USAGE`. The file is read and parsed after the other options are validated and before stdin
   is read. A missing value after `--config`, a file that cannot be read, or a `parseConfig`
   error exits 2 with one `error:` line on stderr that names the path and the problem, and prints
   nothing on stdout. When `--config` is given more than once, only the last file is read (the
   behavior of repeated `--repo-url` and `--format`, verified by running both before this ticket
   was written; see Status). Without `--config` no file is read: there is no auto-discovery.
   Behavior change in `group`: today it ignores every argument (`group --x` exits 0). With its
   own option loop, an argument other than `--config <path>` exits 2 with
   `error: unknown option` and usage, as `render` and `version` already do.
10. Only `src/cli.ts` reads the file. The read is injectable through `CliIo` so an in-process
    test can prove that a bad config fails before stdin is read. `dependencies` stays empty
    (rule 4).
11. Tests: `tests/config.test.ts` for criteria 1 and 2 (one case per rejection listed in
    criterion 1); `tests/group.test.ts` for 3 to 5; `tests/render.test.ts` for 6 and 7;
    `tests/version.test.ts` for 8; `tests/cli.test.ts` child-process cases for 9 on all three
    commands (success, missing value, missing file, invalid JSON, unknown key, invalid regex,
    repeated `--config`) with fixture files under `tests/fixtures/`, plus the in-process case of
    criterion 10. No test reads a file outside `tests/fixtures/` (rule 5).

**Must not break.** `parse`, `log`, `group`, `render` and `version` without `--config` keep their
output and exit codes, with the one exception stated in criterion 9: `group` with an unknown
argument now exits 2. All 123 existing tests pass unchanged.

**Out of scope.**
- Custom section names (T-027).
- Finding `.tracenotes.json` automatically in the working directory or a parent.
- Ignoring by author, path or body text; regular-expression flags.
- Listing ignored commits in the rendered notes; `group` prints them with their reason.
- A split of `counts.ignored` by reason in the JSON document (it would change the T-007 contract).
- Protection against slow regular expressions: the file is the maintainer's own.
- Duplicate keys inside the JSON file (`JSON.parse` keeps the last one).
- README documentation of `render` and `--config` (the README does not cover `render` yet).

**Verification.** `npm run check`. Manual:
`git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' -10 | node src/cli.ts render --config tests/fixtures/config-ignore-docs.json`
prints notes whose closing line counts the commits ignored by config, and
`... | node src/cli.ts group --config tests/fixtures/config-ignore-docs.json` lists each of them
under `ignored` with its pattern.

**Status.** Backlog line written on Day 1 as "config file with ignore patterns and section
names". Narrowed on Day 9 to ignore patterns for the "Set up quality gates" challenge; section
names moved to T-027. Implemented in an interactive session and held to the quality gate in
`AGENTS.md` with Qodo local review on the uncommitted code.
