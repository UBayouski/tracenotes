# Day 17 — Nov 24 — What did your agent decide?

Brief: https://github.com/orgs/qodo-hackathon/discussions/19. Pick one agent-built PR and its
ticket, open it in Qodo's Agent Session Review, choose one implementation decision, check one
observable consequence with code references and real output, and conclude: accept, request a
correction, or ask for more information. (The plan said "Add judgment", T-016/T-017, for today;
the thread is canonical. Those move to a free slot.)

Status: investigation complete, decision **accepted**, one question recorded for the product
owner. No code change. Not yet posted.

## PR and source

- PR: https://github.com/UBayouski/tracenotes/pull/16 (T-005, "recommend the next version"),
  merged Nov 10. Built by the factory's label-triggered workflow: commit `b2910fe` by
  `claude[bot]`. The head commit `3e538a2` is the Day 7 review-fix round (trigger order); in
  `src/version.ts` it changes only comments, so the decision code below is the bot's.
- Commit investigated: `3e538a2` (PR head). `src/version.ts` on `main` differs from it by one
  comment line, so the behaviour is the same today.
- Source: issue https://github.com/UBayouski/tracenotes/issues/15, created before the workflow ran.
  - Criterion 3: "When the current major is `0`, the bump is minor instead (initial
    development, SemVer item 4), and the rule id is `breaking-pre-1.0`."
  - Criterion 4: "Entries that match a lower rule are not triggers."
- Expected behaviour: at `0.4.2`, a range with one breaking commit and one plain `feat` gives
  `0.5.0` under `breaking-pre-1.0`, lists only the breaking commit in `triggers`, and counts the
  `feat` as `notTriggering`.

## Agent Session Review

- Installed with `qodo skills install qodo-agent-session-review --agent claude-code --yes`
  (Qodo CLI 2.6.0, Python 3.13). Reads worked although the trial credits are used up.
- Collected PR 16 as session `20261124-094708-f5f9`: collection complete, 45 managed reads.
  It found the closing reference `#15`, but not the ticket text: the Requirements cards and the
  Decisions page were empty, as other participants reported.
- The agent added the ticket, the decision, the reading layers and the behaviour lines with the
  skill's `enrich` step (`evidence/day17/06-session-enrich.json`).
- After that, the Decisions page listed the decision as **According to plan**, with criteria 3
  and 4 as the human instruction (`evidence/day17/screens/02-decision-planned.jpg`).

What the session showed, and what it didn't:

| Page | Observed |
|---|---|
| Requirements | Tickets card: issue 15. PRD card: the T-005 criteria at `3e538a2`. "Primary behaviors" stayed empty although answers were supplied. |
| Decisions | The default filter is "Unplanned and deviations": it shows 0 and hides a planned decision. Switching it to "According to plan" shows the card. |
| Code map | "Coverage incomplete" notice; Read 42 %, Skim 58 % of 478 lines; `version.ts` 141 lines to read. The code panel was empty: it comes from a separate skill (code-review-master) that was not run. |
| Review walkthrough | Step 1: the contract (`src/version.ts:1-80`, the index export). Step 2: the rule order and the 0.x branch (`81-141`). |
| Findings | "0 open findings"; no triage page built. The two Day 7 Qodo findings (both dismissed) are counted on the Overview, not listed here. |
| Overview | "Not ready to merge … awaiting human review" for a PR merged two weeks earlier: it did not check the PR's merge state. |

## The check

Code: `src/version.ts:94-106` (breaking first; major 0 picks `breaking-pre-1.0` and a minor bump),
`127-140` (only the winning rule's entries become triggers, the rest count as `notTriggering`),
`src/group.ts:86-87` (a breaking commit goes into the Breaking changes section only). Test:
`tests/version.test.ts:52-58`.

Run on an exact copy of `3e538a2` (`git archive`), Node 24.22.1:

- `node --test tests/version.test.ts`: 12 pass, 0 fail.
- Synthetic stream (`evidence/day17/make-stream.mjs`): `feat(api)!`, `feat`, `fix`, `docs`, piped
  to `node src/cli.ts version --current <v>` (`evidence/day17/01-check-output.txt`):

| `--current` | `rule.id` | `next` | `triggers` | `notTriggering` |
|---|---|---|---|---|
| 0.4.2 | `breaking-pre-1.0` | 0.5.0 | `aaaaaaa` (the breaking feat) | 3 |
| 1.4.2 | `breaking` | 2.0.0 | `aaaaaaa` | 3 |
| 0.0.5 | `breaking-pre-1.0` | 0.1.0 | `aaaaaaa` | 3 |

The expected behaviour holds.

## A second opinion from two other vendors

The agent asked Codex (`gpt-6.2-sol`, medium effort, read-only sandbox, about 30 s) and
Antigravity (`--effort high`, sandboxed, about 1.5 min; the model is not printed) to refute the
conclusion. Both got the same brief: the ticket criteria, the code, the test, the output
(`evidence/day17/03-challenge-brief.md`). Codex: accept. Antigravity: need more information.
Every claim was then checked by running the code (`evidence/day17/02-edge-cases-output.txt`):

- Both: the "SemVer item 4" wording overclaims. The spec item says anything may change in 0.y.z;
  the minor bump is the ticket's choice. **Correct.** The same overclaim is in the rule
  description, `src/version.ts:99`, and was in the agent's own first conclusion.
- Both: in 0.x, should `triggers` also list the `feat`, which alone gives the same version?
  **Product question;** the code follows the ticket text.
- Both: a breaking commit and its own revert in one range still bump. **Confirmed;** the ticket
  looks at each entry on its own.
- Codex: a breaking change marked only in the footer may be missed. **Not so:** detected.
- Both: overflow not verified. **Already tested** (`tests/version.test.ts:135-143`, including
  `0.${max}.0`); the CLI exits 2.
- Antigravity only: a `chore`, or a commit with no conventional type, with a `BREAKING CHANGE`
  footer becomes the trigger, and nothing in the output says it was breaking. **Confirmed**
  (`type: "chore"`, `type: null`). It's a limit of what criterion 4 asked for, not a code bug.

Write-up of the run: `evidence/day17/07-sparring-run.md`. The `sparring:check` prerequisites
check ran; the Sparring implement/review loop did not (nothing to implement).

## Conclusion

**Accept.** The behaviour is what the ticket asked for, the real output shows it, and both
reviewers agree that the code matches the ticket. Accepted in the session's Decisions page by the
human, 19:40 UTC: saved locally as a note (`"post": false`); nothing went to GitHub or Qodo.

Remaining unknowns, for the product owner (the human):
1. In 0.x, should `triggers` list only the winning rule's commits, or every commit that would
   give the same bump?
2. Should a trigger say that it is breaking (a `breaking` flag or the breaking notes), so a
   `chore` with a breaking footer doesn't read like a chore that bumped the version?
3. Should `0.0.x` plus a breaking change go to `0.1.0`?

A possible small ticket: drop "SemVer item 4" from the rule description. Not opened; the
human's call.

## What the agent or the review missed

- The session didn't load the ticket text, so it had no plan to compare against until an agent
  added one. Without that step, Decisions would have shown nothing.
- The Decisions page hides planned decisions by default.
- The Overview's merge status was wrong for a merged PR.
- The agent's first conclusion repeated the ticket's SemVer overclaim; both outside reviewers
  caught it.
- The agent's brief left out `parseVersion`/`increment`, so both reviewers flagged overflow as
  unverified: a round of checks the brief could have saved.
- The agent first said the Findings page would list the two Day 7 findings; it doesn't.
- Pressing Next in the walkthrough marked step 1 as read in the human's local progress.

## Lesson

A decision is only "according to plan" against a plan someone actually loaded. The session found
the ticket number but not its text, and every card below depends on that. The useful work
today was putting the source in front of the review, then checking one output by running it.
