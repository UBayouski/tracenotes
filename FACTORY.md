# The factory: from a ticket to main

How a change gets from a ticket into `main` in this repository, and what is verified on the
way. The rules behind the gates are in `AGENTS.md` ("Working with tickets", "Quality gate",
"Process rules"); this file is the map. Drawn on Day 10 of the Qodo Hackathon 2026 and checked
against one real ticket, T-028 (`journal/day-10.md`).

## Diagram

Thick border: a step T-028 actually went through on Nov 13, or, for the Qodo workflow (Day 14)
and the Arnica scan (Day 16), a step that was actually run on that day. Dashed: planned, not built.
Hexagon: a decision only the human makes. Plain: exists, not used by T-028. The publish step
and its monitors (Day 20) are plain until they have run.

```mermaid
flowchart TD
  T["Ticket: tickets/T-NNN-*.md<br/>and a GitHub issue titled T-NNN: ..."]:::taken
  T --> G1{"Gate 1, before work<br/>Is every claim the ticket makes<br/>about the code true?<br/>Codebase Wisdom, or run the command"}:::taken
  G1 -- "a claim is wrong" --> REV["Ticket revised:<br/>criteria changed, Investigation section written"]:::taken
  REV --> HT{{"Human reads the revised ticket<br/>and decides the open choices"}}:::taken
  HT --> LANE{{"Human picks the lane"}}:::taken
  G1 -- "all hold" --> LANE

  LANE -- "session" --> IMP["Agent implements test-first<br/>nothing committed"]:::taken
  IMP --> G2{"Gate 2<br/>npm run check"}:::taken
  G2 -- "red" --> IMP
  G2 -- "green" --> G3{"Gate 3, uncommitted code<br/>Qodo local review: staged, unstaged, new files<br/>one deep review, last review covers the final tree"}:::taken
  G3 -- "valid High or Medium<br/>fix round 1 to 3" --> IMP
  G3 -- "agent disputes a High or Medium" --> HD{{"Human decides:<br/>fix, amend the rule, or dismiss"}}
  HD --> IMP
  G3 -- "3 fix rounds, still open" --> STOP["Stop: gate NOT MET<br/>report with the open findings"]
  STOP --> HS{{"Human decides what the stop means"}}
  HS -- "redesign or cut scope" --> IMP
  HS -- "exception: the gate stays NOT MET,<br/>that is recorded, and the open<br/>findings go on to the pull request" --> G4
  G3 -- "no High or Medium open<br/>Lows listed" --> G4{{"Gate 4, the human<br/>reads the gate report,<br/>commits and opens the pull request"}}:::taken

  LANE -- "label" --> LBL{{"Human adds ready-for-agent"}}
  LBL --> GL{"Guard<br/>issue has a non-empty Investigation?<br/>scripts/ticket-ready.ts"}
  GL -- "no: label removed,<br/>comment says why" --> T
  GL -- "yes" --> BOT["Bot implements on agent/issue-N-*<br/>npm run check, 3 attempts, then stop and report"]
  BOT --> PEND["Bot comments: Implemented, gate pending<br/>no Qodo review has run yet"]
  BOT -. "planned" .-> BREV["PLANNED, T-029<br/>Qodo review of the branch in a separate job<br/>that never runs ticket-written code"]:::planned
  BREV -. "planned" .-> PEND
  PEND --> HO{{"Gate 4, the human<br/>opens the pull request"}}

  G4 --> G5A{"Gate 5a, enforced by GitHub<br/>except for an administrator bypass<br/>branch protection requires, on the head:<br/>check on Linux, check on Windows, ticket-link"}:::taken
  HO --> G5A
  G5A -- "a check is red" --> FIX["Fix test-first, new commit on the PR branch<br/>session: the agent commits on its own<br/>label lane: the human comments @claude,<br/>the bot pushes, agent/* branches only"]:::taken
  FIX -- "new head: checks and review run again" --> G5A
  G5A -- "green" --> G5B{"Gate 5b, by procedure, not enforced<br/>the agent reads Qodo's review with Review Resolver:<br/>completed for the head, no High or Medium open"}:::taken
  G5B -- "valid High or Medium" --> FIX
  G5B -- "a finding needs a decision:<br/>dispute, dismissal, any Low" --> HP{{"Human decides per finding"}}
  HP -- "fix it" --> FIX
  HP -- "no code change: dismissed with a reason,<br/>or a Low left as it is" --> G5B
  G5B -- "gate report says MET" --> HM{{"Human merges<br/>GitHub refuses a head that fails 5a,<br/>unless an administrator bypasses protection<br/>5b rests on the gate report"}}:::taken

  G5A -. "in parallel, after every Qodo PR review" .-> QW{"Qodo workflow (Day 14)<br/>tracenotes gate: no Medium+ findings<br/>complete review of the head,<br/>no finding of Medium or higher, any category"}:::taken
  QW -- "a Medium+ finding" --> NOL["No label<br/>the fix loop of 5a and 5b applies"]:::taken
  QW -- "none" --> QG{"Approval guard, workspace-wide<br/>does the PR change .github/workflows/**<br/>or scripts/** (since Nov 20)?"}:::taken
  QG -- "no" --> QL["Qodo adds the label Qodo approved<br/>a label, not an approval vote:<br/>5a and 5b still decide the merge"]:::taken
  QG -- "yes: guarded" --> HG{{"Human reads the guarded change<br/>workflows hold the agent key,<br/>write tokens and the required checks;<br/>scripts hold the check logic;<br/>Qodo never labels or approves it"}}:::taken
  QL --> HM
  HG --> HM
  HM --> MAIN["main"]:::taken
  MAIN --> AFTER["After the merge<br/>GitHub closes the issue<br/>Qodo updates its copy of the rules<br/>observed on Nov 13, verified by no gate"]:::taken
  MAIN --> AR["Security scan, after the merge, by hand (Day 16)<br/>the human syncs the organization fork of main<br/>Arnica scans it: dependencies and licenses,<br/>secrets, infrastructure files, code"]:::taken
  AR --> AF{{"Human reads the findings in Arnica's dashboard<br/>the agent investigates against the code and run logs<br/>human decides: fix, investigate further,<br/>or dismiss with a reason"}}:::taken
  AF -- "fix: a new ticket" --> T
  MAIN --> PUB["Publish, on every push to main (Day 20)<br/>pages.yml: tracenotes renders the notes of this repository<br/>from its full history; the build refuses a shallow clone,<br/>a malformed record, a history that starts elsewhere<br/>GitHub Pages serves notes.json, notes.md, build.json"]
  PUB --> MON["Two outside monitors, on a schedule<br/>Checkly: notes.json holds a known entry (PR 19)<br/>Better Stack: notes.md holds that entry's link<br/>a failed check sends an email"]
  MON --> MR{{"Human reads the alert<br/>first: build.json and the response body,<br/>then the last Pages run on main,<br/>then GitHub Pages status"}}
  MR -- "fix: a new ticket" --> T
  G4 -. "planned" .-> AP["PLANNED<br/>Arnica checks and comments on the pull request<br/>needs the repository itself in an organization"]:::planned

  classDef taken stroke-width:3px
  classDef planned stroke-dasharray: 5 5
```

## The gates

| Gate | What must pass | Evidence the agent uses | When it fails | Who decides |
|---|---|---|---|---|
| 1. Before work | Every claim the ticket makes about the existing code is checked. The result is the ticket's `**Investigation.**` section. | Codebase Wisdom results saved as raw JSON under `evidence/`, or the output of the command the ticket describes. An empty search result counts only with a control query that had to match. | The ticket is revised before any code is written. | The human reads the revised ticket and settles the choices it lists. |
| Guard (label lane) | The issue body has a non-empty Investigation section. | `scripts/ticket-ready.ts` on the current issue body. | The label is removed and a comment says why. A guard that fails to run leaves the label on and blames nothing on the ticket. | The human adds the label again after fixing the ticket. |
| 2. Checks | `npm run check`: typecheck and tests. Code fixes start with a failing test. | Test output; the red run is kept under `evidence/`. | Back to implementation. The bot stops after three attempts and reports. | The agent. |
| 3. Uncommitted code | The quality gate in `AGENTS.md`: every valid High and Medium finding fixed, at least one deep review, the last review covers the final tree including new files. | `qodo review` JSON: findings, `finding_state`, coverage; the gate report in the journal. | Fix test-first and review again, at most three rounds. Then stop with NOT MET. | The agent fixes. The human decides a disputed High or Medium and every Low. After a stop the human either sends the work back (redesign, smaller scope) or lets it go on as a recorded exception: the gate stays NOT MET and the open findings travel to the pull request. A stop never turns into a pass. |
| 4. Commit and pull request | The human has read the gate report. | The gate report: one row per finding, the checks, the last review, `Quality gate: MET` or `NOT MET`. | — | The human makes the first commit and opens the pull request. On the label lane the bot has committed already and the human only opens it. Since Day 12 the human may instead ask the interactive agent, for one named task, to make the first commit and open the pull request (AGENTS.md, third exception); the agent then waits for the human's go-ahead after the gate report, and the human still merges. |
| 5a. Pull request head, enforced | `check (ubuntu-latest)`, `check (windows-latest)` and `ticket-link` are green on the head commit. | `gh pr checks`. | A fix on the PR branch moves the head and reruns everything. | GitHub: branch protection on `main` refuses the merge, unless an administrator bypasses protection. The human is an administrator here, so for everyone else nobody has to remember this one, and for the human it is a warning to click through, not a wall. |
| 5b. Pull request head, by procedure | Qodo's latest completed review is for the head commit (a skipped review counts only after Markdown-and-evidence-only commits) and no High or Medium finding is open. | The review session read with the Review Resolver skill: status, `commit_sha`, each finding's `attribution_status`. | Valid High or Medium: a fix, as in 5a. A dispute, a dismissal or a Low goes to the human, who either asks for a fix or settles it without a code change (a dismissal with a reason, a Low left as it is); the gate is then evaluated again. | The agent reports; the human decides. **Nothing in GitHub enforces 5b.** A pull request with an open High can be merged if the human ignores the gate report. |
| Qodo workflow and approval guard (Day 14) | Qodo's complete review of the head has no finding of Medium or higher (every category and finding type), and no approval guard matches. The guard covers `.github/workflows/**` and, since Nov 20, `scripts/**` in this repository. | The `labeled` event on the pull request (`gh api repos/<repo>/issues/<n>/events`, actor `qodo-code-review[bot]`) and the PR Triage panel ("Reviewed on <sha>", findings open). PR Triage shows no workflow or guard entry of its own. | No label. A Medium+ finding goes through the fix loop of 5a and 5b; a guarded change waits for the human whatever the review says. | Qodo adds the label; the human reads every guarded change and still merges every pull request. The label is the workflow's verdict only: it says nothing about 5a, about a disputed or stale finding, or about the acceptance criteria. |
| Merge | 5a green and the gate report says MET. | The gate report. | — | The human. |
| Security scan (Day 16) | Arnica's four scans of `main` have completed (SCA/license, secrets, IaC, SAST), and every finding has a decision. Not a merge gate: it runs after the merge, on a copy. | Arnica's job list (status, time and count per scan) and findings table, saved under `evidence/`; `gh api` proof that the fork and `main` are the same commit and tree. | A finding is investigated against the code and the run logs before it is believed. A fix is a new ticket and goes through every gate above. | The human: fix, investigate further, or dismiss with a reason. |
| Published notes (Day 20) | The Pages run for the commit on `main` is green, and the two monitors find the known entry in the published files. Not a merge gate: it runs after the merge, on the deployed files. | The Pages run; `build.json` (which commit is live); the monitors' run history and alert emails, saved under `evidence/`. | An alert is read against `build.json` and the response body first, then the last Pages run. A fix is a new ticket and goes through every gate above. | The human. |

Who makes the fix commit on a pull request depends on the lane. In a session the agent commits
and pushes on its own once the human has opened the pull request (`AGENTS.md`, process rules).
On the label lane nothing happens until the human comments `@claude` on the pull request; the
bot then pushes, and only to `agent/*` branches (`.github/workflows/agent-fix.yml`).

Gate numbers follow the order of the path: 4 is the human's commit, which is why the automatic
gates jump from 3 to 5.

What `ticket-link` checks: a pull request that names a ticket in its title, or closes a ticket's
issue, must close that ticket's own issue (GitHub is asked which issues the pull request will
close) and must carry the `BACKLOG.md` row `done (PR <number>)`.

Where the loop stops: three failed check attempts (bot), three fix rounds (any review loop), a
finding the agent disputes, a label it cannot map to a severity, a review that failed or could
not run. Each of these ends in a report and a question, not in a guess.

## Checked against T-028 (Nov 13)

Ticket: `tickets/T-028-source-hygiene.md`, issue #23, pull request #24. Session lane.

| Step | What happened | Evidence |
|---|---|---|
| Gate 1 | The backlog row was wrong twice. The rule was already broken on `main` (a raw byte order mark since Nov 5), and "all of `tests/`" would have caught fixtures that hold raw bytes on purpose. The ticket was rewritten before any code. One search returned an empty result that was false; a second query exposed it. | `evidence/day10/raw/`, the ticket's Investigation section |
| Human | Settled the ticket's open choice (visible non-ASCII stays allowed) and told the agent to go on. | the ticket, Decisions |
| Gate 2 | Red first: the new test failed on exactly the two lines the investigation had found. Then 222 tests green. | `evidence/day10/red-t028-*.txt` |
| Gate 3 | Two deep reviews of the uncommitted change. Review 1: no High or Medium, three Lows: the gate was met at once. The human chose to fix all three; review 2: nothing new, all resolved. One fix round of three. | `evidence/day10/t028-review-*.json` |
| Gate 4 | The human committed and opened the pull request. | `3b09408` |
| Gate 5a | `ticket-link` was red on the first commit, as designed (`BACKLOG.md row for T-028 says "planned", expected "done (PR 24)"`), and green after the agent set the row. Both `check` jobs green on every head. | the pull request's checks |
| Gate 5b | Qodo's PR review found one Medium the local reviews had not (a file name with a control character could split the report); the agent fixed it test-first and pushed; the next review marked it implemented. No finding open at the head. | `evidence/day10/pr24-review-*.json` |
| Merge | The human's. | pull request #24 |
| After | GitHub closed issue #23 by itself. Qodo's rule list showed rule 7 a minute after the merge; nobody had checked for it. | `journal/day-10.md` |

What worked: every gate on the session lane ran, and each one caught something the gate
before it had not. What the human did: decided the ticket's open choice, decided the Lows,
made the first commit, opened the pull request, merged. What was not exercised by this ticket:
a disputed finding, the three-round stop (the gap fixes hit it the same morning,
`journal/day-10.md`), and the whole label lane.

Missing verification found on the way: nothing in the factory noticed that the agent's own
file writes kept inserting raw invisible characters into Markdown files (ticket, journal). Rule
7 covers `.ts` files only; the Markdown was scanned by hand.

## Checked against T-031 and T-034 (Nov 19)

The approval step, added on Day 14. One Qodo workflow scoped to this repository ("tracenotes
gate: no Medium+ findings → Qodo approved label") and one approval guard
(`ubayouski/tracenotes`, only `.github/workflows/**`). Predictions were written in each pull
request body before its first review.

| Pull request | Guarded? | Prediction | Final review at the head | Observed |
|---|---|---|---|---|
| #33, T-031 (`src/`, `tests/`) | no | label | complete, 0 findings (`d4bae4c`) | label "Qodo approved" by `qodo-code-review[bot]` |
| #34, T-034 (`.github/workflows/`, `scripts/`, `tests/`) | yes | no label, even when clean | complete, 3 findings implemented, 0 open (`4099677`) | no label, no `labeled` event |

The first review of #34 had a High and two Mediums, so its missing label proved nothing about
the guard; only the clean re-review did. Evidence: `evidence/day14/`.

## Checked against the Arnica scan and T-035 (Nov 23)

The security scan, added on Day 16. Arnica connects GitHub organizations only, so the scan ran
on `IoT-Forge-Labs/tracenotes`, a fork at the same commit and tree as `main` (`b349b8b`),
scan-only, no policies. Predictions were written in `journal/day-16.md` before the repository
was connected.

| Scan | Completed (UTC) | Result | Predicted |
|---|---|---|---|
| SCA/License | 18:24:53 | 0 findings | 0 |
| IaC | 18:25:26 | 0 findings | 0 |
| Secrets | 18:25:26 | 1 Info, a made-up credential in a test, marked Invalid by Arnica | 0 real, a false alarm possible |
| SAST | 18:25:39 | 4 Medium (one rule, the four checkout steps), 2 Low | 1 to 5, the checkout step most likely |

The four Mediums became T-035: `actions/checkout` left the job's token in `.git/config`. The
investigation (run logs, `evidence/day16/06-artipacked-investigation.txt`) showed no artifact
upload anywhere, a read-only token in the two check workflows, and a write token in the two
agent workflows that the agent action removes before it pushes with its own. The human chose to
fix all four. Evidence: `evidence/day16/`.

## Known gaps

- **The monitors check one known entry, not freshness.** A Pages build that stops running leaves
  the old files in place, and both monitors stay green. `build.json` names the commit that is
  live; nothing compares it with `main` yet. The monitors' configuration lives in Checkly and
  Better Stack, not in this repository.
- **The security scan sees a copy, after the merge, when a person syncs it.** Arnica does not
  connect a personal account, so nothing scans a pull request and nothing rescans `main` on a
  merge. Until the fork is synced, Arnica's dashboard describes an older commit.
- **Label lane: the agent's own write token is in reach of ticket-written tests.** The agent
  action puts its app token into the remote URL to push, and the agent then runs
  `npm run check`. No scanner reported this; it was read from a run log on Day 16 (T-036).

- **Label lane, before the commit: no Qodo review.** The bot has no Qodo credentials on
  purpose: every test it runs for a ticket could read them. T-029 (Day 16) plans a review of the
  bot's branch in a separate job. Until then the lane ends with "Implemented, gate pending" and
  the first Qodo review is the one on the pull request.
- **Label lane, gate 1 is a presence check.** The guard sees that an Investigation section
  exists, not that it is right.
- **The checks can be edited by the pull request they check.** On a `pull_request` event the
  workflow and the scripts come from the pull request. They catch slips, not intent; the human
  reviews changes to them. Since Day 14 the approval guard on `.github/workflows/**` makes that
  review mandatory in Qodo's terms (no label for such a change), and every action is pinned by
  commit with GitHub's `sha_pinning_required` on (T-034). Since Nov 20 the guard also covers
  `scripts/**`, where the check logic lives (`pr-ticket-check.ts`, `ticket-ready.ts`,
  `source-hygiene.ts`, `action-pins.ts`); read back after a reload
  (`evidence/day15/01-guard-scripts-after-reload.png`). `tests/` stays unguarded on purpose:
  guarding it would send almost every pull request to a person. A pull request can still weaken
  a script's test without touching the script and get the label; the human's review of the diff
  is the only defence there.
- **The "Qodo approved" label is not the gate.** It reads one condition (no Medium+ finding at
  the head). Branch protection does not require it, and it does not see the checks, a disputed
  finding, a local-review finding, or the acceptance criteria. The gate report stays the
  record.
- **Workflow configuration lives only in the Qodo portal.** Nothing in this repository shows the
  workflow, the guard or their scope; a change there is invisible to review. Day 14 caught two
  silent misconfigurations by reading the portal back (`journal/day-14.md`).
- **After the merge, nothing checks that Qodo's copy of the rules followed `AGENTS.md`.** Qodo
  imported the changed rules by itself within a minute of both merges on Nov 13 (it had not on
  Day 2), but that was noticed by reading the rule list, not by a gate. Until the import runs,
  the reviewer judges a pull request by the old text.
- **Admins can bypass branch protection.** That is how the human pushes journal commits to
  `main`; it also means the protection does not bind the human.
