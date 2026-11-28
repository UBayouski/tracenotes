# Day 20 — Nov 27 — Monitor your factory's output

Brief: https://github.com/orgs/qodo-hackathon/discussions/22. Extend the factory past the merge:
one capability on a deployed environment, one scheduled check with a real assertion (not a bare
HTTP 200), a saved scheduled pass, a controlled failure from a separate temporary monitor on the
same alert route, the saved notification, restore, and a note on what to investigate first.
(The plan said "Try to fool your factory", T-020, for today; the thread is canonical. T-020 moves
to a free slot.)

Status: complete, not posted yet. Deployed, both monitors passing on schedule, a controlled
failure and its e-mail captured for each, temporary monitors removed.

- Reply in the thread: _TODO_

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
  output path that already exists, empty or not; a missing parent directory.
- `tests/build-site.test.ts`: 13 tests at first (22 after the review rounds below), red before the script existed
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

PR 44, https://github.com/UBayouski/tracenotes/pull/44, opened by the human with commit `7c7a61d`,
body `Closes #43`. `ticket-link` was red on that commit, as designed (the backlog row still said
`planned`); the agent set the row to `done (PR 44)` in the next commit.

Prediction, written before the Qodo review of the pull request: no "Qodo approved" label, even
on a clean review, because the change touches `.github/workflows/**` and `scripts/**`, which the
approval guard covers.

Checks at `e5e29d9`: `check` on Ubuntu and Windows and `ticket-link` green.

Qodo review 1 (run 2200141, extended, complete at `e5e29d9`; the run on `7c7a61d` was aborted
by the push): three Mediums and one Low, all on the build script the four local reviews had
passed. Read with the Review Resolver, `evidence/day20/pr44/review-1-extended.json`. Gate on
the pull request: NOT MET.

| Finding | Level | What it said | Outcome |
|---|---|---|---|
| 7ab639c8 | Medium | `existsSync` follows links, so a link to nothing looked free and the rename replaced it; a file made between the check and the rename, too. | Valid; reproduced on Linux. The check and the rename are gone: one `mkdir` without `recursive` takes the path or fails. |
| da4c1646 | Medium | Only the directory got its mode; under umask 077 the files stay 600 and Pages could refuse them. | Valid; reproduced on Linux (384 instead of 420). Directory 755 and files 644 are set explicitly. |
| f553217c | Medium | The framing check took LF only after the last terminator; the parser also reads CR LF from a Windows shell. | Valid: `src/gitlog.ts` reads that framing on purpose. The build accepts the same. |
| a8b63c45 | Low | This journal still said "not empty" and "13 tests". | Fixed. |

All three fixes started red in a Linux container (`evidence/day20/pr44/tests-red-review-1-linux.txt`,
then `tests-green-review-1-linux.txt`: 22 of 22). `npm run check` on Windows: 418 tests, 415
pass, 3 skipped (the three that need file modes or links).

The output directory is now on its third design. Staging and rename (round 2) existed to fix
the cleanup of round 1, and brought the mode problem and the link problem with it. A plain
`mkdir` that fails when the path is taken needs neither.

Fix commit `fa898d8` (agent, second exception). Checks green on Ubuntu and Windows, so the
mode and link tests have now also run on GitHub's Linux runner. Qodo review 2 (run 2200168,
standard, complete at `fa898d8`): all four findings `implemented`, nothing new
(`evidence/day20/pr44/review-2-extended.json`). No label and no `labeled` event on a clean,
complete review: the prediction held, the approval guard kept the pull request for a person.

Quality gate on the pull request: **MET at `fa898d8`**, merge state clean.

## Deployment

All times below are UTC on Nov 28; the tools show Pacific time, eight hours behind.

- The human turned GitHub Pages on before the merge: source GitHub Actions, HTTPS enforced. The
  `github-pages` environment lets only `main` deploy (read back with `gh api`).
- The human fixed the cut-off title and merged PR 44 as `6f0e2a1` at 00:20:30. Issue #43 closed.
- Pages run 46087365156 for `6f0e2a1`: build 00:20:36 to 00:20:56, deploy 00:20:59 to 00:21:10,
  both green. `Check` on `main` green too.
- Read back from https://ubayouski.github.io/tracenotes/ (`evidence/day20/deploy/`): all four
  files answer 200. `build.json` names `6f0e2a1` and 126 commits. `notes.json` has the PR 19
  entry (`7a1d606`, "add JSON output with --format json (T-007)", `prNumber` 19) and
  `counts.malformed` 0. Criterion 10 of the ticket is met.

Environment: production. It is the one deployment the project has.

## Monitors

One capability, checked by two tools on two files: **the published release notes still hold
the entry for PR 19**, with its subject and its source. That entry exists only if the whole
chain worked: the workflow ran on `main`, read the full history, tracenotes parsed and grouped
it, rendered it, and Pages served the result. A page that answers 200 with an empty or broken
document fails both checks. Both read a public file with an anonymous GET; there is no test
identity, no test data and nothing to clean up on the site.

### Better Stack: keyword on `notes.md`

Free account, no card. Set up by the human, corrected and finished by the agent in Chrome with
the human's go-ahead. Record: `evidence/day20/betterstack-incident-1059338140.txt`.

```text
Monitor:        tracenotes notes.md has the PR 19 entry
Alert us when:  URL doesn't contain keyword
URL:            https://ubayouski.github.io/tracenotes/notes.md
Keyword:        7a1d606f87b01c1bc8674d54af92190c783df311
Notify:         primary responder, e-mail only
Frequency:      3 minutes
```

The keyword is the commit SHA of the PR 19 entry. It occurs once in `notes.md`, inside that
entry's link.

- Scheduled pass: Up on the 3-minute schedule after the keyword was set at about 00:32
  (`screens/06`, `screens/10` at 00:45).
- Controlled failure: a second, temporary monitor on the same URL and e-mail route, keyword
  `day-20-entry-that-does-not-exist` (`screens/02`). Incident 1059338140 started at 00:26:
  "Keyword not found", response code 200, seen from three regions.
- Notification: the e-mail "New incident started" arrived at 00:26 with the checked URL and the
  cause (`screens/09`). A test alert Better Stack had sent at 00:22 ("New test incident
  started", `example.com`, status 500) is not this evidence and is not used.
- Restored: the temporary monitor was removed with the human's approval at about 00:35; the
  e-mail "Incident resolved" followed (`screens/08`); the list shows one monitor, Up
  (`screens/07`). The site was never touched.

### Checkly: JSON assertion on `notes.json`

Account on the 14-day Team trial without a card; it drops to the free Hobby plan on Dec 11. Set
up by the agent in Chrome at the human's request. Record: `evidence/day20/checkly-checks.txt`.

```text
Check:        API check, "tracenotes notes.json has the PR 19 entry"
Request:      GET https://ubayouski.github.io/tracenotes/notes.json
Assertion 1:  Status code  Equals  200
Assertion 2:  JSON body
              $..entries[?(@.source.sha=="7a1d606f87b01c1bc8674d54af92190c783df311")].subject
              Equals  add JSON output with --format json (T-007)
Frequency:    10 minutes, round-robin, N. Virginia and N. California
Retries:      linear, 2
Alerts:       e-mail, on failure and on recovery
```

The entry is found by its commit SHA, not by its position: a new feature moves every entry down
one place, and an assertion on `entries[7]` would fail on the next merge for no reason.

- Scheduled pass: created at about 00:47, both assertions green; the run the schedule made at
  about 00:57 passed too (`screens/13`).
- Controlled failure: a temporary check with the same request and e-mail channel, the same JSON
  path, expecting "day 20 subject that does not exist"; every minute, no retries. Its test
  request failed as intended with response 200. The event history shows the failure at
  00:49:18 from N. Virginia and "Sent 1 notifications" (`screens/12`).
- Notification: the e-mail "[Checkly] Failure alert for TEMP failure test: expects a subject
  that does not exist" arrived at 00:49 (`screens/14`): request, status 200, location
  N. Virginia, timestamp Nov 28 00:48 +00:00, and the failed JSON body assertion. Checkly's own
  analysis in the mail calls it "an intentional negative test, not a service failure".
- Restored: the temporary check was deleted with the human's approval at about 01:01; the list
  shows one check, passing, 100 % (`screens/15`). The site was never touched.

## First response

When one of these alerts fires for real, in this order:

1. **`build.json` and the response body the alert links to.** Is it our page, and which commit
   is live? This splits the cases at once: not our page (GitHub Pages or DNS), our page from an
   old commit (the publish stopped), or our page from the newest commit without the entry (the
   product or the history changed).
2. **The last `Pages` run on `main`** (`gh run list --workflow pages.yml`). The site changes
   only when that workflow deploys, so the newest merge is the first suspect. A red build step
   names its reason in one line: a malformed record, a shallow clone, a history that does not
   start at the pushed commit.
3. **If the run is green and the entry is gone:** run the same pipe locally for that commit and
   compare with `node src/cli.ts render`. Then the change is in parsing, grouping or rendering,
   or someone rewrote history and `7a1d606` no longer exists.
4. **If it is not our page:** githubstatus.com for Pages, then the resolved addresses in the
   alert.

Which alert fired matters too. Only Checkly: the JSON document changed shape or the subject
changed. Only Better Stack: the Markdown link format changed. Both: the entry or the site.

## What I missed

- **The real Better Stack monitor was the wrong type for its first twelve minutes.** The
  onboarding form created it as "URL becomes unavailable". It showed Up, I saved that
  screenshot as evidence, and only the configuration page showed there was no keyword at all:
  the exact "homepage answers 200" check the brief warns about. I had asked the human to
  confirm the type and then did not wait for the answer before treating the green dot as a pass.
- **The first failure e-mail I was shown was a test alert,** and it looks almost the same as a
  real one. The brief separates the two for a reason: the test proves the channel, not that a
  failed check reaches it.
- **Three designs for one output directory.** Each review round fixed what the round before
  had introduced: cleanup code, then staging and rename, then a plain `mkdir`. Four deep local
  reviews passed a script in which the pull-request review still found three Mediums.
- **A scripted edit turned escape sequences into raw characters twice** (a line feed inside a
  string, a byte order mark). The source-hygiene test caught the second one.

## Lesson

A green monitor says what its configuration says, nothing more. Read the saved configuration
back before believing the dot, and make the check fail once on purpose: the controlled failure
is the only moment the whole path from assertion to inbox is actually seen working.
