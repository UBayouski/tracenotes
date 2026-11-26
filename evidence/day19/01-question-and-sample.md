# Day 19: question, scope and sample

## Access

Checked Nov 26 in the Qodo portal (app.qodo.ai), signed in, on the paid "Qodo subscription"
plan (2,000 credits a month), a workspace with no team and no other members.

- The left navigation has no Analytics item (Home, Repositories, Software map, Review standards,
  Findings, PR Triage, Workflows, Configurations, Integrations).
- `app.qodo.ai/analytics` redirects to Home. The Home page's "Code review analytics dashboard"
  link opens the documentation, not a dashboard.
- Configurations, "Search settings" for `analytics`: no results. Account menu, Settings: no
  "Grant Analytics access".
- Billing has an "Analytics" tab: credit, review and PR usage per day, not the code review
  dashboard.

So the Analytics dashboard was not available to this workspace. The **Findings** page was
(`screens/01-findings-page.jpg`): All time, all filters at All, **62 findings**, 13 high severity,
69.2 % of them resolved, 1.9 per PR. The CLI read below gives the same 62.

## Question

Rule 6 of `AGENTS.md`, Validate Before You Normalize, was written on Day 5 (`e12a599`, Nov 6) from
three Qodo findings in PRs 1 and 3. **Did it stop the mistake it was written for?**

## Scope

- Repository: UBayouski/tracenotes. Qodo PR review findings, raised Nov 5 to Nov 26 (all the
  repository's reviews), read Nov 26, ~15:00 CET.
- Severity, category, finding type, state: all left at All. Local review findings are not in
  the sample (neither Analytics nor this read counts them).
- Source: `qodo read pr-review-session findings --pr-url <PR> --extended --json` for every PR
  (`02-all-findings.tsv`) and the portal's Findings page.
- Counts: 25 PRs with a completed review, 20 of them with findings; 62 findings: 13 action
  required (High on the Findings page), 37 remediation recommended, 12 informational; 53
  implemented, 9 dismissed, 0 pending. Categories: Correctness 30, Maintainability 12,
  Reliability 8, Security 8, Observability 3, Performance 1. High resolved: 9 of 13 (the four
  others were dismissed by the human: three on PR 22, one on PR 26), which is the 69.2 % card.

## How the rule-6 findings were picked

Every finding's title, description, evidence explanation and citations were searched for
`trim`, `normaliz`, `strip`, `rule 6`, `validate before`, `before validat`, `leading
whitespace` and `trailing`: 11 matches. Each was then read in the finding, the code at its
commit, and the PR.

| Finding | PR | Raised on | Outcome | What it shows |
|---|---|---|---|---|
| `d76dd4f9` | 1 | before the rule | implemented | `( )` scope trimmed to empty and accepted. One of the rule's three sources. |
| `1e1fa382` | 1 | before | implemented | Paragraph trim deleted code-block indentation. Source. |
| `3912dcc7` | 3 | before | implemented | Leading whitespace stripped before the SHA check. Source. |
| `5c693540` | 2 | before | dismissed | Line endings in existing files; not a parser. Not this rule. |
| `cd584e42` | 9 | the rule's own PR | implemented | The rule as first written forbade the CRLF normalization the parser needs. **The rule was too strict**; the allowed-framing list was added. |
| `e7e44ef3` | 12 | after | dismissed (intentional) | Merge detection reads the raw header on purpose. **Design, not a violation.** |
| `636a05fd` | 14 | after | implemented | Claims `$` matches before a final newline. **False in JavaScript** (`/a$/.test('a\n')` is `false`, checked with `node`). The `\n` case was already in the rejection test before the fix commit `eb0dce7`, which added `\r\n`. Recorded as implemented anyway. |
| `69b1fa82` | 26 | after | dismissed (false positive) | The same `$` claim; the human dismissed it Nov 16, "same mix-up as PR 14". |
| `88effe66` | 28 | after | implemented | **Real.** `src/commit.ts:128` trims the header before the match, so `  feat: x` passed `check`. The line dates from Nov 4 (`git blame`: `81eb447`), before the rule; the rule names the file, but nobody swept it. PR 28 worked around it in `src/check.ts`; T-030 stayed `planned`. |
| `28bcc7c0` | 34 | after | implemented | **Real, new code.** `scripts/action-pins.ts` trimmed the `uses` value before the pin check, so a hidden trailing character passed. The rule's "Applies to" does not name `scripts/`. Qodo cited "Rule 6, Validate Before You Normalize" anyway (type "Rule violation" on the Findings page). |
| `3a2670fe` | 34 | after | implemented | Matched only on "before validating" wording; a YAML explicit key escapes the pin check. Not normalization. Not this rule. |

## What it supports

- New parser code in the files the rule names (render in PR 14, config in PR 21, remote in
  PR 26) had no real violation after Nov 6.
- Both real violations after the rule are at its edges: code older than the rule (`88effe66`)
  and a kind of file the rule does not name (`28bcc7c0`). Both were caught by Qodo's PR review
  before merge.
- Counterexample to reading the numbers: `636a05fd` counts as an implemented High finding, but
  the claim was false and the "fix" only added a case to a test that already passed. Acceptance
  measures what authors did, not whether the finding was right.
