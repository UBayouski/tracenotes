# T-002: Read commits from a git log stream on stdin

**Goal.** Let tracenotes consume real history without shelling out to git itself. The user (or CI) pipes `git log` output in a fixed format; tracenotes parses it into a list of commits, each with a SHA and a parsed message.

**Why this shape.** Keeping git invocation outside the tool keeps rule 5 (tests never touch a live repo) trivially true for now, and makes the input format a stable contract that fakes and fixtures can target. Shelling out to git is a later ticket (T-010, T-011).

**Input contract.** The stream is what this command produces:

```sh
git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' <range>
```

Fields are separated by the ASCII unit separator (0x1F): full SHA, author name, author date in ISO 8601, then the full message body (`%B`). Records are terminated by the ASCII record separator (0x1E). The message may contain blank lines and any text except the two separator bytes.

**Acceptance criteria.**

1. `parseGitLog(stream: string): GitLogResult` splits the input into records on 0x1E and fields on 0x1F, returning `commits: LoggedCommit[]` in input order, where `LoggedCommit` has `sha`, `author`, `date`, and `message: ParsedCommit` (from T-001).
2. `sha` is validated as 40 lowercase hex characters. A record with an invalid SHA is not dropped: it is placed in `result.malformed` with a reason string and its raw text, and `commits` excludes it.
3. A record with fewer than four fields is reported in `malformed` with the reason `missing fields`, not thrown.
4. Empty input, or input that is only whitespace and separators, returns `commits: []` and `malformed: []` without error.
5. CRLF inside messages is handled by T-001's normalization; the splitter itself does not alter message content apart from the record terminator.
6. `result.count` equals `commits.length + malformed.length`, so nothing vanishes (rule 2).
7. `date` is kept as the ISO string from git; no Date object construction, so invalid dates cannot throw. A date that fails a basic ISO 8601 shape check is recorded as a warning on the commit (`warnings: string[]`), not as a malformed record.
8. CLI: `node src/cli.ts log` reads the stream from stdin and prints the `GitLogResult` as JSON. Exit code 0 even when `malformed` is non-empty; exit 2 on empty stdin.
9. A fixture file `tests/fixtures/log-basic.bin` with at least five records, including one non-conventional message, one squash-merge subject with a PR number, one record with a bad SHA, and one with a multi-paragraph body plus footers, drives the tests. No test invokes git.

**Out of scope.** Running git, selecting ranges, grouping, rendering.

**Verification.** `npm run check`. New tests in `tests/gitlog.test.ts`, one per criterion. The README gains a "From git history" section showing the pipe command.

**Status.** Ticket written on Day 3. Implementation follows on a branch once the repository is on GitHub, so the pull request can carry the Qodo review.
