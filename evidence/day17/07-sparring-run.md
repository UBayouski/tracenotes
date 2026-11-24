# Day 17: cross-vendor challenge run (Sparring plugin)

Date: 2026-11-24. Orchestrator: Claude Code, model Claude Opus 5.5 (interactive session).

## What ran, and what did not

| Step | Ran? | Notes |
|---|---|---|
| `sparring:check` (prerequisites) | Yes | `RESULT: ready`, `READY_REVIEWERS: codex agy`. git 2.53.0, Claude Code 2.1.331, Codex CLI 0.171.0 (signed in with ChatGPT), Antigravity CLI 1.5.16 (beta, sign-in not checked: `--deep` was not run). Warning: the workspace root is not a git repo (the repo is `dark_factory/`). |
| `sparring:run` (developer/reviewer loop) | **No** | Only the human can start it (`disable-model-invocation: true`), and it is a loop for building code. Day 17 had no code to write. Its `review.sh`, `review.schema.json`, tiers, rounds and tie-breaker were **not** used. |
| Cross-vendor challenge | Yes, by hand | The orchestrator called both reviewer CLIs directly, using the same commands the check script uses, with one shared brief. |

So this run tests the Sparring **prerequisites check** and the **idea** behind it (another vendor's agent reviews Claude's work). It does not test the Sparring loop.

## The delegated task

"Try to refute this conclusion." The conclusion: PR #16 (T-005, head `3e538a2`) is acceptable. In a 0.x range with a breaking commit and a plain `feat`, the recommender picks `breaking-pre-1.0`, bumps minor, lists only the breaking commit in `triggers`, and counts the `feat` as `notTriggering`.

The brief (`03-challenge-brief.md`, 1,251 words, public repo content only) held:
- T-005 criteria 3 to 5, verbatim
- `src/version.ts` lines 81 to 140 and `src/group.ts` lines 70 to 100, both at `3e538a2`
- the pre-1.0 test
- the behaviour-check output

Reviewers were asked for four things: mismatches with the ticket, surprising inputs, ticket ambiguity with the exact question for the product owner, and a verdict.

## Runs

| | Codex | Antigravity |
|---|---|---|
| Command | `codex exec --sandbox read-only --skip-git-repo-check -` (brief on stdin) | `agy -p "<brief>" --sandbox --effort high --print-timeout 500s` |
| Model | `gpt-6.2-sol` (config default), reasoning effort medium; stated in the CLI header | Not printed by the CLI. `--model` was not passed. `cli.log` shows "Gemini 4 Neon (High)" selected around that time, but the run's own output does not confirm it |
| Sandbox | read-only | `--sandbox` |
| Wall time | about 30 s (09:51:3x to 09:52:03 local) | about 1 min 30 s (09:51:39 to 09:53:06) |
| Tokens | 13,531 (CLI report) | not reported |
| Tool use | 1 web search (semver.org), 1 failed `rg --files` in the scratch folder (exit 1: no repo there) | none visible |
| Verdict | **Accept** | **Need more information** |

Both ran in parallel. Answers: `04-codex-answer.md`, `05-antigravity-answer.md`.

## Findings, checked against the code at `3e538a2`

| # | Raised by | Claim | Checked how | Result |
|---|---|---|---|---|
| 1 | Both | The conclusion overstates SemVer item 4. It only says anything may change in 0.y.z; it does not say "bump minor". | Read the spec item | **Correct.** The orchestrator's own brief made this overclaim, and so does the rule's description string in `src/version.ts:99`. The minor bump is the ticket's choice. |
| 2 | Both | In 0.x, "lower rule" is ambiguous: `breaking-pre-1.0` and `feat` give the same bump. Should `triggers` list both? | Ticket criteria 4 and 5 | **Valid product question.** The code matches the literal ticket. |
| 3 | Both | A breaking commit and its own revert in one range still get the breaking bump. | Ran `edge-cases.mjs revert` | **Confirmed** (`breaking-pre-1.0 0.5.0`). Matches the ticket, which looks at each entry on its own. A product question, not a bug. |
| 4 | Codex | A breaking change written only in a footer may not be detected. | Ran `edge-cases.mjs footer` | **Not a problem.** A `fix` with a `BREAKING CHANGE:` footer triggers `breaking-pre-1.0`. |
| 5 | Both | Overflow handling is unverified (helpers left out of the brief). | `tests/version.test.ts:135-143`, plus runs at `0.9007199254740991.0` and `0.4.9007199254740991` | **Already covered.** The test includes the `0.${max}.0` case; the CLI exits 2 with a clear error; a patch reset does not overflow. The "unverified" points came from a gap in the brief, not in the code. |
| 6 | Antigravity | A `chore`, or a commit with no conventional type, that has a `BREAKING CHANGE` footer wins the breaking rule, and the trigger output carries no breaking flag, so it reads as if a chore caused the bump. | Ran both forms at 0.4.2 | **Confirmed.** Triggers `{type:"chore"}` and `{type:null, subject:"update stuff"}`. A commit with no type is counted as an entry, not as malformed. The trigger fields are exactly what criterion 4 asked for, so this is a limit of the ticket and a UX point, not a code bug. **The best finding of the run, and only one reviewer raised it.** |
| 7 | Antigravity | `0.0.x` plus a breaking change jumps to `0.1.0`; some ecosystems stay in 0.0.x. | Behaviour check at 0.0.5 | **Confirmed** behaviour; a product question. |

Incorrect claims: **none found.** Two claims were stated as "unverified" (4, 5) and turned out fine once checked.

## Observations

- **Different strengths.** Codex was faster and more decisive and cited the spec. Antigravity was slower, more sceptical, and found the one item neither Claude nor Codex had (6).
- **Two reviewers beat one.** Items 6 and 7 came from only one of them. One verdict alone would have given either "accept" or "need more information" with no tie-breaker. Here the orchestrator settled the split with real runs.
- **The challenge corrected the orchestrator.** The SemVer overclaim (1) was in Claude's own conclusion, and both outside reviewers caught it.
- **Anchoring risk.** The brief contained Claude's conclusion. Asking the reviewers to *refute* it worked: one of them disagreed. A blind brief (the evidence without the conclusion) would be a stronger test.
- **The brief's scope shaped the answers.** Leaving out `parseVersion` and `increment` made both reviewers flag overflow as unverified. Including the helpers, or the test file, would have saved a round of checks.
- **Every claim was checked by running the code.** No reviewer claim was accepted without a command run at the PR head.

## Feedback on the Sparring plugin

1. The check script is good: real versions, the reviewer list, and it finds the `agy` install folder that Windows doesn't add to PATH yet. But that PATH fix lives only inside the script. Later calls from Git Bash failed (`agy: command not found`) until the orchestrator added `%LOCALAPPDATA%/agy/bin` itself. Suggest printing that export line, or putting it in the run scripts.
2. Without `--deep`, Antigravity's sign-in isn't checked, yet the result still says `ready`. Suggest `ready (agy sign-in unverified)`.
3. `sparring:run` covers implement-and-review only. A **review-only or "challenge" mode** (one artifact, N reviewers, a fixed answer schema, no developer) would fit investigation days like this one, and Day 18 "Delegate verification".
4. Antigravity doesn't print the model it used; Codex does (model, effort, tokens). For evidence, the review script should record the reviewer's model and wall time for each run.
5. `disable-model-invocation` on `run` is reasonable, since it is costly and loops on its own. Note it in the check output so an orchestrator doesn't promise the user a run it can't start.

## Orchestrator mistakes in the same session (for the record)

- `qodo skills install qodo-agent-session-review` failed without `--agent claude-code --yes` (it wanted an interactive prompt); fixed on the second try.
- The first session enrichment used an invalid test verdict (`ok`; the valid values are `fine` and `concern`). Two attention-override warnings ("every override needs a reason") and the read/skim ratio warnings were left unresolved.
- The review server printed nothing to the captured output, so the orchestrator couldn't give the browser address. The human found it at `127.0.0.1:8765`.
