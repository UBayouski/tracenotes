# Day 20 — Nov 27 — Monitor your factory's output

Brief: https://github.com/orgs/qodo-hackathon/discussions/22. Extend the factory past the merge:
one capability on a deployed environment, one scheduled check with a real assertion (not a bare
HTTP 200), a saved scheduled pass, a controlled failure from a separate temporary monitor on the
same alert route, the saved notification, restore, and a note on what to investigate first.
(The plan said "Try to fool your factory", T-020, for today; the thread is canonical. T-020 moves
to a free slot.)

Status: in progress. The deployment is built and not yet merged; no monitor exists yet.

## Starting point

tracenotes is a command-line tool. Nothing was deployed: the repository is public and GitHub
Pages was off (`gh api repos/UBayouski/tracenotes/pages` answered 404 on Nov 27).

Decisions by the human (Nov 27):

- Deployment: GitHub Pages, serving the release notes tracenotes writes for this repository.
  That is the product's real output for a real history, in production.
- Monitors: both Checkly and Better Stack. Checkly reads `notes.json` and asserts one known
  entry by its fields; Better Stack reads `notes.md` and looks for that entry's link. Two tools,
  two files, one alert route (email).

## Investigation (gate 1)

Qodo Codebase Wisdom plus commands in the work tree; raw output in `evidence/day20/raw/`. The
full record is the Investigation section of `tickets/T-041-publish-own-notes.md`. What it
changed:

- `render` exits 0 on a stream with malformed records; it only counts them
  (`src/render.ts:125`). `actions/checkout` fetches one commit by default, and a one-commit
  history also renders without an error. A plain `git log | tracenotes render > notes.json` in
  the workflow would publish both with a green run. The first draft of the ticket said "the
  build fails if tracenotes exits non-zero"; that criterion would have passed and protected
  nothing. The ticket now names each refusal.
- The two existing workflow checks (action pins, checkout credentials) read every `.yml` file,
  so the new workflow is covered without touching them. `actions/upload-pages-artifact` is a
  composite action; its nested `actions/upload-artifact` step is pinned by SHA, so the
  repository's `sha_pinning_required` setting does not block it.

## What was built (T-041, issue #43)

Branch `t-041-publish-own-notes`.

- `scripts/build-site.ts`: from a git log stream, a commit and a repository URL, the four files
  Pages serves: `notes.json` and `notes.md` (byte-identical to `tracenotes render`),
  `build.json` (the commit and the number of commits, no time) and a fixed `index.html`. It
  refuses a history with no commit, with a malformed record, or that does not start at the
  commit being published; input that is not valid UTF-8; a repository URL `render` rejects; an
  output directory that is not empty.
- `tests/build-site.test.ts`: 13 tests, red before the script existed
  (`evidence/day20/t041/tests-red.txt`).
- `.github/workflows/pages.yml`: on a push to `main` only. The build job reads the repository
  (full history, no stored credential), refuses a shallow clone and runs the script; the deploy
  job holds the two Pages permissions and runs nothing from the repository.
- `README.md`, `FACTORY.md` (publish step, monitors, gate row, one known gap), `BACKLOG.md`.

Checks after the review rounds below: `npm run check` on Windows, 415 tests, 414 pass, 1 skipped
(396 before; the skipped one checks file modes, which Windows does not have). The build-site
tests on Linux, in a `node:24-slim` container: 19 of 19. By hand on `main` at `ebb67dd`: the
build exits 0 with 122 commits, and `cmp` finds `notes.json` and `notes.md` identical to the
output of `node src/cli.ts render`.

Not verified yet: the workflow has never run. It runs on a push to `main` only, and Pages has to
be turned on first (a repository setting, the human's approval). The whole suite has not run on
Linux locally; `check.yml` does that on the pull request.

## Qodo local review (gate 3)

Four deep reviews of the uncommitted change, issue #43 attached as the ticket, context file with
the decisions and what was and was not verified. Raw results:
`evidence/day20/t041/local-review-1.json` to `-4.json`. Every fix started with a red test
(`tests-red-review-1.txt`, `-2.txt`, `-3-linux.txt`).

| Review | Finding | Level | What it said | Outcome |
|---|---|---|---|---|
| 1 | 7cb90af9 | Medium | "No malformed record" is not "all of it read": the parser drops a whitespace-only record (T-040) and reads a last record without its terminator, so such a history would be published. | Valid. The build now checks the framing on the stream as received: it ends with a terminator, and terminated records equal parsed commits. Resolved in review 2. |
| 1 | c03742ea | Medium | A write that fails part-way leaves half a site, which the next run then refuses. | Valid. First fix: remove what was written. Resolved in review 2, and replaced in round 2. |
| 2 | afdf2ca4 | Medium | My cleanup removed the leaf directory but left parents that `mkdir` had created. | Valid, and about the round-1 fix. |
| 2 | 51e2696c | Medium | My cleanup decided ownership with `existsSync` and then deleted fixed file names: two builds on one directory could delete each other's files. | Valid in the letter; the one caller is a single job on a fresh runner. Fixed with afdf2ca4 by a different design: the output path must not exist, the files go into a `mkdtemp` directory next to it, and that directory is renamed into place. Nothing else is ever created or removed. Both resolved in review 3. |
| 3 | 723eb8cd | High | `mkdtemp` makes the directory owner-only, the rename keeps that, and GitHub Pages refuses an artifact whose directory others cannot read: the first deploy would fail. | Valid, and caused by the round-2 fix. Reproduced on Linux in a container (mode 700). Fixed with `chmod 755` before the rename. Resolved in review 4. |
| 4 | none | | Coverage complete, nothing open, five findings resolved. | |

Quality gate on the uncommitted change: **MET** after three fix rounds, the limit. Two of the
three rounds fixed what the round before had introduced.

The ticket's criteria 2 and 5 were rewritten along the way (framing; the output directory). That
makes them stricter, not looser, and the issue body was kept in step with the file.

## Pull request

_To be filled in._

## Deployment

_To be filled in: Pages turned on, the first run, `build.json` against the merge commit._

## Monitors

_To be filled in: Checkly and Better Stack configuration (redacted), schedule, assertion, the
scheduled pass, the controlled failure, the two emails, the restored state._

## First response

_To be filled in after the controlled failure._

## What I missed

_To be filled in._

## Lesson

_To be filled in._
