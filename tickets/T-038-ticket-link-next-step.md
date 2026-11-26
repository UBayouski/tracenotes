# T-038: ticket-link says why a ticket is checked and what to do next

**Goal.** When `ticket-link` fails because a ticket's `BACKLOG.md` row has the wrong status, it
also prints one next-step line for that ticket: why the ticket is checked (the pull request
closes its issue, or the title names it), the row to write, and that this failure is expected on
the first commit of a ticket pull request. The check itself does not change: same rules, same
problem lines, same exit code.

**Why.** Day 18 (Nov 25): every failed GitHub Actions run in this repository, 7 of 7 (PRs 24,
26, 28, 30, 33, 36, 38), is `ticket-link` on a pull request's first commit, with
`BACKLOG.md row for T-NNN says "planned", expected "done (PR n)"`. That red is by design
(`AGENTS.md`: the number is not known before the pull request exists). Nothing in the failure
says so. A person or an agent sent to "fix the red build" sees one line and an exit code, and
may start changing code. Qodo's CI failure feedback (`/checks`) is retired since Oct 1, 2026,
so the job's own output is the only explanation a reader gets. Codex, asked blind to diagnose
the PR 38 failure, found the cause from `AGENTS.md` and the backlog, and proposed that the
message name the issue that selected the ticket.

**Investigation.** Done Nov 26 on `main` at `5e9d05a`, by reading `scripts/pr-ticket-check.ts`,
`tests/pr-ticket-check.test.ts`, `.github/workflows/ticket-link.yml`, `AGENTS.md` and the logs of
the 7 failed runs (`gh run view --log-failed`).

- The status problem is built in `checkPrTicket()` (`expected` and the `says "…", expected "…"`
  line). Nine tests compare these problem lines exactly, and `FACTORY.md` quotes one. Changing
  the line would churn all of them for no gain, so the problem lines stay as they are.
- `run()` prints the problems to stderr with exit 1 and has everything the new line needs: the
  closing issues, the backlog text and the result. Ticket selection is `claimedTickets()`: from
  the closing issues (title starts with `T-NNN:`) and from the title.
- The script prints no pull request title and no issue title (workflow comment); the new line
  prints only the ticket id, an issue number, the expected status and fixed text.
- What changed in the ticket: the next step goes on its own line instead of into the problem
  line (first idea), so the problem lines and their tests stay unchanged.

**Acceptance criteria.**

1. `nextSteps(input, result)` in `scripts/pr-ticket-check.ts`, pure, exported. For each ticket in
   `result.tickets` whose `BACKLOG.md` has exactly one row and that row is not
   `done (PR <number>)`, one line:
   `<T-NNN> is checked because this pull request closes #<n>; set its BACKLOG.md row to "done (PR <number>)" in a commit on this branch. On the first commit of a ticket pull request this is expected: the number did not exist yet.`
   When no closing issue belongs to the ticket, the reason is `because the pull request title names it`.
   When the row is already a `done (PR <other n>)`, the last sentence is left out: the number
   was known, so that is a slip, not the first-commit case. *(Added Nov 26 after Qodo local
   review finding a3c7163b.)*
   No line for a ticket with no row or with several rows (a different fix), and none for a
   ticket whose row is right.
2. `run()` prints those lines to stderr after the problem lines, each prefixed `ticket-link: `.
   Exit code and the problem lines are unchanged; nothing changes on success or on "nothing to check".
3. The new line prints no pull request title and no issue title.
4. Tests: closes-issue reason, title reason, a wrong `done (PR n)` number, no line for a missing
   row or duplicate rows, no line when the row is right, and the CLI's stderr in order. The two
   CLI tests that compare stderr exactly are updated for the new line; no other existing test
   changes.
5. `npm run check` passes.

**Out of scope.** The rules of the check; the problem lines; the workflow; making the first
commit green (the number is still unknown then).

**Verification.** `node --test tests/pr-ticket-check.test.ts` (red before, green after);
`npm run check`; the pull request's own first commit is red on `ticket-link`, and its log shows
the new line (the Day 18 follow-up run).
