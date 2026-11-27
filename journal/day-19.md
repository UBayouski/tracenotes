# Day 19 — Nov 26 — What is your factory learning?

Brief: https://github.com/orgs/qodo-hackathon/discussions/21. Open Qodo Analytics for one
repository, ask one focused question, follow the numbers down to two or three real findings and
PRs (with a counterexample), then make one small change to how the factory works, or explain why
not. Test the change and keep every gate. (The plan said "Earn automatic approval", T-019, for
today; the thread is canonical. T-019 moves to a free slot.)

Status: complete and posted, with one stated limit: the Analytics dashboard is not available to
this workspace.

- Reply in the thread (Nov 26): https://github.com/orgs/qodo-hackathon/discussions/21#discussioncomment-19936241

## Analytics access

Checked in the portal with Claude in Chrome on the human's signed-in session
(`evidence/day19/01-question-and-sample.md`). The workspace is on the paid "Qodo subscription"
plan (2,000 credits a month), with no team and no other members.

- No Analytics item in the left navigation; `app.qodo.ai/analytics` redirects to Home; the Home
  page's "Code review analytics dashboard" link opens the docs; no "Grant Analytics access" in
  Settings; "Search settings" for `analytics` finds nothing.
- Billing has an "Analytics" tab, but it shows credit usage, not code review analytics.
- The **Findings** page works (`evidence/day19/screens/01-findings-page.jpg`, the account email
  cropped out): All time, 62 findings, 13 high severity, 69.2 % of them resolved, 1.9 per PR.
- Reading the absence: the dashboard looks like a feature for organization workspaces with
  admins and members. That is an inference; nothing on screen says why.

## Question and scope

Rule 6 in `AGENTS.md`, Validate Before You Normalize, was written on Day 5 (`e12a599`, Nov 6) from
three Qodo findings in PRs 1 and 3. **Did it stop the mistake it was written for?**

- tracenotes, Qodo PR review findings Nov 5 to 26, every filter at All; local review findings
  not included. Read with `qodo read pr-review-session findings --extended` for every PR
  (`evidence/day19/02-all-findings.tsv`) and on the Findings page: the same 62.
- 25 reviewed PRs, 20 with findings. 13 action required (High), 37 remediation recommended, 12
  informational. 53 implemented, 9 dismissed, 0 pending. High resolved 9 of 13; the other four
  are human dismissals, which is the 69.2 % card.
- Candidates: every finding's text and evidence searched for trim, normalize, strip, rule 6,
  validate before, leading whitespace, trailing: 11 matches, each read in the finding, the code
  and the PR.

## What the findings show

- Before the rule: `d76dd4f9`, `1e1fa382` (PR 1), `3912dcc7` (PR 3), its three sources.
- After the rule, five more:
  - `cd584e42` (PR 9): the rule as first written forbade CRLF normalization. The rule was too
    strict; the allowed-framing list was added.
  - `e7e44ef3` (PR 12): intentional, dismissed by the human (raw-header merge test).
  - `69b1fa82` (PR 26): false positive, dismissed ("`$` matches before a final newline" is not
    true in JavaScript; checked with `node`).
  - **`88effe66` (PR 28, High): real.** `src/commit.ts:128` trimmed the header before the match,
    so `  feat: x` passed `check`. The line dates from Nov 4, before the rule; the rule names
    that file, but nobody swept it. PR 28 worked around it in `check.ts`; T-030 stayed planned.
  - **`28bcc7c0` (PR 34, High): real, new code.** `scripts/action-pins.ts` trimmed before the pin
    check. The rule's "Applies to" did not name `scripts/`; Qodo cited rule 6 anyway.
- **Counterexample:** `636a05fd` (PR 14, High) made the same false `$` claim as `69b1fa82` and is
  recorded as implemented: the fix commit `eb0dce7` added `\r\n` to a rejection test that
  already had `\n` and already passed. An acceptance count reads it as a good catch.

Answer: mostly yes. New parser code in the files the rule names had no real violation after
Nov 6. The two real ones were at the rule's edges, and Qodo's PR review caught both before
merge.

## Decision: change made (human chose option B)

T-039 (issue https://github.com/UBayouski/tracenotes/issues/41, PR
https://github.com/UBayouski/tracenotes/pull/42), taking over T-030:

- `src/commit.ts`: the header is matched as received after `normalize()`, which already removes
  the framing the rule allows. A header that starts with whitespace is not conventional and goes
  to Unclassified, still visible.
- `src/check.ts`: the PR 28 workaround is removed; the 88effe66 test passes unchanged.
- `AGENTS.md` rule 6: "Applies to" names the checks in `scripts/` and `.claude/skills/*/scripts/`,
  with a "What happened next" note.
- `AGENTS.md` Process rules: a rule that is added or widened comes with a sweep of the code it
  applies to, in the same pull request, with what was searched and found.

Observed vs suspected: the two findings and the code are observed. That the gap was the missing
sweep and the missing file kind is the agent's reading of them.

## Test of the change

- The sweep itself, run once for rule 6 (`evidence/day19/t039/03-rule-6-sweep.md`): every
  `trim`, `replace`, `toLowerCase` and `normalize` call in `src/`, `scripts/` and the skill
  scripts, each with a verdict. Expected: only the header trim. Observed: the header trim, plus
  **one new case**: `src/gitlog.ts:103` skips any whitespace-only record, so `"   "`, `"\t"` or
  a no-break space between two separators vanishes, while `junk` in the same place is reported
  as malformed. Opened as **T-040**, not fixed here.
- Test-first: red (`t039/01-red.txt`, 3 new tests fail), green (`02-green.txt`); `npm run check`
  396/396 (`04-npm-run-check.txt`).
- Qodo local review, full: 0 findings (`05-qodo-local-review-1.json`).
- PR 42: first commit `6a8d58b` red on `ticket-link` by design, with T-038's line ("T-039 is
  checked because this pull request closes #41; ... If this is the pull request's first commit,
  this is expected"). `17b3ad3` (row `done (PR 42)`): `ticket-link` and `check` green.
- Qodo PR review (`t039/06-pr42-qodo-review.json`): run 2185929 at `17b3ad3`, standard,
  `review_complete: true`, **0 findings**. The run at the head `bb917d0` (the human's Day 18
  journal commit) was a skip, `review_complete: false`, as a docs-only change.
- Merged by the human Nov 26 (`b438a8c`); issue #41 closed.

## What remains unknown

- Whether the sweep rule changes behaviour: it is tested once, on the rule that prompted it.
- Why Analytics is missing on this workspace (inference: plan or organization feature).
- Whether the other rules (1 to 5, 7) have code older than them that was never swept.

## What the agent or the review missed

- The agent first called the workspace a "trial" one; it is a paid subscription.
- The Edit tool wrote a raw no-break space and a raw BOM into the test file instead of the escapes
  the agent typed. The source-hygiene test caught it. A Perl fix then turned `\u` into its
  upper-case operator and mangled the line; fixed from character codes.
- The agent's PR body claimed the approval guard applied; it covers only `.github/workflows/**`
  and `scripts/**`. Removed with the human's approval; the first edit used a wrong pattern and
  changed nothing, so the `edited` event ran `ticket-link` twice.

## Lesson

A rule learned from findings covers the code written after it, not the code that was already
there, and only the files it names. Rule 6 worked where it pointed; both later misses were where
it didn't. Writing a rule is half the change; the sweep is the other half, and the first sweep
already found a case nobody had reported.
