# T-041: Publish tracenotes' own release notes to GitHub Pages on every push to main

**Goal.** Every push to `main` runs tracenotes on the repository's own history and publishes the
result to GitHub Pages, so there is a deployed output of the product that a monitor can check.

**Why.** Day 20 ("Monitor your factory's output") asks for a scheduled check with a real
assertion against a deployed environment. tracenotes is a command-line tool and nothing is
deployed today: the repository is public, GitHub Pages is off (`gh api repos/.../pages` answers
404, Nov 27). The human chose Pages (Nov 27). The monitors themselves (Checkly on `notes.json`,
Better Stack on `notes.md`) are set up in those tools after this ticket is merged; they are not
code in this repository. This pull request adds a workflow and a script, so it is inside the
approval guard on `.github/workflows/**` and `scripts/**`.

**Investigation.** Done Nov 27 on `main` at `ebb67dd`, with Qodo Codebase Wisdom (raw output in
`evidence/day20/raw/`) and by running the commands below in the work tree.

- What already constrains a new workflow (`codebase grep` for `github/workflows` in `scripts/`
  and `tests/`; `pull-request by-file` on `check.yml`: PRs 22, 34, 36): `scripts/action-pins.ts`
  (every `uses:` is a full commit SHA with its release in a comment, fails closed on any other
  spelling) and `scripts/checkout-credentials.ts` (every checkout step sets
  `persist-credentials: false`; the `with:` block may hold other plain `key: value` lines, so
  `fetch-depth: 0` is accepted). Both read every `.yml` file in the directory, so the new
  workflow is checked without a change to either test. The repository setting
  `sha_pinning_required` is `true` (`gh api repos/UBayouski/tracenotes/actions/permissions`).
- Pages actions, latest releases resolved with `gh api` on Nov 27:
  `actions/upload-pages-artifact` v5.0.0 `fc324d3547104276b827a68afc52ff2a11cc49c9`,
  `actions/deploy-pages` v5.0.1 `368f82528645a54fb793d4d04e342629a3f51346`. The first is a
  composite action; its one nested step is `actions/upload-artifact` pinned by SHA
  (`bbbca2dd...` v7.0.0), so the pinning setting does not block it. `actions/configure-pages` is
  not needed for a static folder.
- `render` exits 0 on input it could not fully read (`codebase grep` for
  `exitCode|process\.exit|malformed` in `src/`): malformed records are counted in
  `counts.malformed` (`src/render.ts:125`) and the exit code is 0 either way; only `check`
  exits 1 on them (`src/cli.ts:401`). "The build fails when tracenotes fails" is therefore not
  enough: the build has to look at the counts itself.
- `actions/checkout` fetches one commit by default. A stream of one commit renders without an
  error, so a shallow checkout would publish notes with a single entry and a green run. The
  build needs the full history and has to refuse a shallow one.
- Run on the work tree: `git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' | node src/cli.ts render
  --format json --repo-url https://github.com/UBayouski/tracenotes` exits 0: 122 commits,
  95 shown, 27 ignored (the 27 merge commits), 0 malformed. The document has no date and no
  machine-dependent field, so one commit always gives the same bytes. The entry for PR 19 is
  there: `sections[title=Features].entries[shortSha=7a1d606]`, subject
  `add JSON output with --format json (T-007)`, `prNumber: 19`.
- Reuse: `renderJson`, `renderMarkdown`, `groupGitLog`, `parseGitLog` are exported from
  `src/index.ts`; `checkRepoUrl` from `src/render.ts`. Nothing new is needed in `src/`.
  `cross-repo relations` returned no edges for this repository.
- Alternatives. A plain pipe in the workflow (`git log | node src/cli.ts render > notes.json`)
  is the least code but cannot fail on malformed records or a wrong history, and nothing tests
  it. A build script in `scripts/` with tests is chosen. `npm ci` is not needed in the workflow:
  there is no runtime dependency and Node 24 runs the TypeScript files directly.
- What changed in the ticket: the first draft said "the build fails if tracenotes exits
  non-zero". Criteria 2 and 5 replace it with explicit refusals (malformed records, empty
  history, a stream that does not start at the published commit, a shallow checkout).

**Acceptance criteria.**

1. `scripts/build-site.ts` builds the site from a git log stream (the format `tracenotes log`
   documents), a commit SHA and a repository URL. It produces four files: `notes.json` and
   `notes.md`, byte-identical to what `tracenotes render --format json` and
   `--format markdown` print for the same stream and `--repo-url`; `build.json`; `index.html`.
2. It refuses, with one line on stderr and exit 1, and writes nothing, when: the stream has no
   commit; the stream has a malformed record, or a record that is not a commit (the parser drops
   a whitespace-only record, T-040), or does not end with a record terminator followed by at
   most one line feed; the first record of the stream is not the commit
   given (the stream is not the history of what is being published); the repository URL is one
   `render --repo-url` rejects. The commit argument is matched as received against 40 lower-case
   hex characters, nothing trimmed first (rule 6); anything else is a usage error, exit 2.
   Values from the input are escaped in messages the way the CLI does it.
3. `build.json` is `{"schemaVersion": 1, "commit": "<sha>", "commits": <total>}` and holds no
   time, so the same commit always produces the same four files.
4. `index.html` is a fixed page with links to the three files. It contains no text taken from
   the commit history.
5. Usage: `git log --format=<log format> | node scripts/build-site.ts --commit <sha>
   --repo-url <url> --out <dir>`. The run makes the output directory itself: a path that already
   exists is refused, empty or not, and a missing parent is not created (both exit 1). The files
   are written to a directory of the run's own next to the destination and renamed into place,
   so a failed run leaves nothing behind and removes nothing it did not make. Unknown or repeated
   options and a missing value are usage errors (exit 2).
6. `.github/workflows/pages.yml` runs on a push to `main` and on nothing else. Its build job has
   `contents: read` only, checks out the full history (`fetch-depth: 0`,
   `persist-credentials: false`), fails when the repository is shallow, runs the build script
   for the pushed commit and uploads the directory as the Pages artifact. Its deploy job has
   `pages: write` and `id-token: write`, the `github-pages` environment, and only the deploy
   step. No job has a write permission on contents. A deployment that has started is never
   cancelled; of several pushes in a row the newest is deployed last.
7. Every action in the new workflow is pinned by commit SHA with its release in a comment, and
   the existing tests for action pins and checkout credentials pass with the new file present.
8. The tests for the build script are shown red before the script exists (test-first).
9. GitHub Pages is turned on for the repository with the workflow as its source, by the human or
   with the human's approval for that one call. Not part of the diff; recorded in
   `journal/day-20.md`.
10. After the merge: the Pages run for the merge commit is green, and
    `https://ubayouski.github.io/tracenotes/build.json` names the merge commit while
    `notes.json` holds the PR 19 entry. Recorded in `journal/day-20.md`, whatever the result.
11. `README.md` names the published address and says what is there. `FACTORY.md` shows the
    publish step after `main`.
12. `npm run check` passes.

**Out of scope.** The monitors as code (they are configured in Checkly and Better Stack; the
redacted configuration goes into the journal); an assertion that the published notes are fresh;
a `CHANGELOG.md` in the repository or notes per tag (T-012, T-025, T-011); an HTML rendering of
the notes; a custom domain; a manual trigger for the workflow.

**Verification.** `npm run check` (new `tests/build-site.test.ts`; `tests/action-pins.test.ts`
and `tests/checkout-credentials.test.ts` read the new workflow). By hand in the work tree: build
into a temporary directory, compare `notes.json` and `notes.md` with the output of
`node src/cli.ts render`. On the pull request: `check` on Linux and Windows. After the merge:
criterion 10, read with `gh run list --workflow pages.yml` and `curl` of the three files.
