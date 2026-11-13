# AGENTS.md — tracenotes

Instructions for coding agents and reviewers working in this repository.

## What this is

**tracenotes** turns a range of git commits into release notes where every line links to its
source commit or pull request, and every version recommendation explains the rule that produced
it. It is a command line tool first, an MCP server second, and a CI gate third. It is being built
during the Qodo Hackathon 2026 ("Build a Software Factory in 30 Days"). The product is also the
factory's own release-notes writer.

Target users: maintainers who want release notes they can audit, and agent pipelines that need
a deterministic, explainable version bump.

## Setup and verification

Requires Node 24 or newer. TypeScript runs natively through Node's type stripping, so there is
no build step.

```sh
npm install              # dev dependencies only (typescript, @types/node)
npm run check            # typecheck + tests; this is the definition of "green"
npm test                 # tests only: node --test "tests/**/*.test.ts"
npm run typecheck        # tsc --noEmit
node src/cli.ts parse "feat(cli): add parse command (#42)"
```

A change is not done until `npm run check` passes and the change is covered by a test in `tests/`.

## Project rules

### 1. The No Orphan Notes Rule
Every release-note entry carries a link to its source: a commit SHA, a pull request, or both.
A renderer, MCP tool, or changelog writer that emits an entry without a source is a bug, even
if the text is correct.
- Applies to: anything that produces user-facing notes (`src/render*`, MCP tool responses, `CHANGELOG.md` writers).
- Why: traceability is the product. An unsourced line is a claim the reader cannot verify.

### 2. The Nothing Vanishes Rule
No commit in the requested range is dropped silently. Commits that are not conventional, or that
match an ignore pattern, are still counted and surfaced (an "Unclassified" section, or an
explicit ignored count in the output).
- Applies to: the parser, grouping, filters, and any range selection logic.
- Why: notes that quietly omit work cannot be trusted, and silent drops are the hardest bugs to notice in review.

### 3. Explain Every Bump
A version recommendation is always returned together with the rule that produced it and the
commits that triggered it. "Bump minor" alone is not an acceptable output.
- Applies to: `src/version*` and any tool exposing version recommendations.
- Why: a bump without reasoning cannot be reviewed by a human or checked by a test.

### 4. Zero Runtime Dependencies
`dependencies` in `package.json` stays empty. Dev dependencies are limited to type checking.
Adding a runtime dependency requires a ticket that explains why Node built-ins cannot do the job.
- Applies to: `package.json`, imports in `src/`.
- Why: the tool runs inside CI and agent sandboxes. Every dependency is setup friction, attack surface, and a reproducibility risk.

### 5. Tests Never Touch the Network or a Live Repository
Parsing and rendering are tested from in-repo fixtures. Git and GitHub access sit behind a small
interface with a fake implementation in tests. No test may shell out to `git` against the real
repository or make an HTTP request.
- Applies to: `tests/`, and the design of any module that reads git or GitHub.
- Why: tests must be deterministic and run in any sandbox in under a few seconds.

### 6. Validate Before You Normalize
A parser checks a field on the raw text it received, then normalizes. The only changes allowed
before validation are documented framing: the record separator, the newline git prints after a
record, a leading byte order mark, `\r\n` to `\n` line-ending normalization, trailing whitespace
at the end of a line, and blank lines at the start or end of a whole message. Never `.trim()`
or strip a field and then validate what is left, and never let normalization turn an invalid
value into a valid-looking one. A new kind of framing is added to this list, with a test, before
a parser removes it.
- Applies to: `src/commit.ts`, `src/gitlog.ts`, and every future parser of commit messages, git
  output, config files, or MCP tool input.
- Why: three of the first nine review findings were this one mistake. A scope of `( )` was trimmed
  to empty and accepted (PR 1). A paragraph `.trim()` deleted the indentation of a code block
  (PR 1). All leading whitespace was stripped before the SHA check, so junk before the hash
  passed as a commit (PR 3). Each time the fixture had no such input, so no test caught it.
  Nothing Vanishes forbids dropping input; this rule forbids quietly accepting it.

## Code conventions

- ESM TypeScript executed directly by Node. Import local modules with the `.ts` extension.
- Only erasable TypeScript syntax: no `enum`, no `namespace`, no parameter properties, no `const enum`. `tsconfig.json` enforces this with `erasableSyntaxOnly`.
- Under `src/`, `cli.ts` is the only module that may touch `process.stdout`, `process.stderr`, or `process.exitCode`. Library code returns values or throws. Factory scripts under `scripts/` are entry points of their own: each touches the process only in its entry block at the end of the file, and every function in it returns values (for a command, the exit code and the text for each stream) or throws.
- The CLI is tested as a child process in `tests/cli.test.ts`. Any change to argument handling, stdin reading, exit codes, or the direct-invocation check adds or updates a case there. Function-level tests of what the CLI calls do not count as CLI coverage. (Day 1 review lesson: an entry-point bug passed every unit test and would have made the CLI a no-op on Linux.)
- Prefer small pure functions. Keep I/O at the edges.
- Public functions have a doc comment stating inputs, outputs, and failure behavior.
- Commit messages follow Conventional Commits. The project parses its own history, so malformed messages show up in its own notes.

## Working with tickets

Work items live in `tickets/` as `T-NNN-<slug>.md`, each with acceptance criteria. When
implementing a ticket, restate each criterion and show how the change satisfies it. The ordered
backlog is `BACKLOG.md`.

- **Investigate before building.** Before a ticket is implemented, its requirements and its
  claims about the existing code are checked against the code (Codebase Wisdom, or by running
  the command the ticket describes), and the result is written into the ticket as an
  `**Investigation.**` section: what was checked, what was found, what changed in the ticket.
  The label workflow refuses an issue whose body has no such section, or an empty one
  (`scripts/ticket-ready.ts`).
- **A ticket pull request finishes its own paperwork.** Its body closes the ticket's own issue
  with a closing keyword (`Closes #20`; a bare `(#20)` closes nothing), and `BACKLOG.md` has
  one row for the ticket that says `done (PR <number>)` before the merge. An issue is a
  ticket's own when its title starts with the id and a colon (`T-008: Config file ...`); write
  issue titles that way. The `ticket-link` check (`scripts/pr-ticket-check.ts`) enforces this
  for every ticket named in the pull request title and for every ticket whose issue the pull
  request closes. It does not read the body: it asks GitHub which issues the pull request will
  close. The check is red on a new ticket pull request until a follow-up commit sets the
  backlog row, because the number is not known earlier. It catches slips, not intent: a pull
  request that neither names a ticket nor closes a ticket's issue is not checked, and a pull
  request can change the check itself, which the human reviewing it sees.

## Quality gate

A coding task is done only when this gate is met. It applies to every agent that changes code
here: an interactive session reviewing uncommitted work with Qodo local review (`qodo review`),
and any agent resolving Qodo findings on a pull request. The agent applies the gate itself and
ends its work with the gate report below.

**Severity.** Qodo's tools report `action_level`, not High, Medium or Low. This project reads
them as:

| `action_level` | Severity | Gate |
|---|---|---|
| `action_required` | High | must be fixed |
| `remediation_recommended` | Medium | must be fixed |
| `informational` | Low | reported, not changed |

Any other value, or a finding with no `action_level`, is not guessed: the agent stops and asks.
A reviewer comment that is not a finding (`review_agent_comment`) is reported and never blocks.

**Type.** The gate covers all three finding types: Bug, Rule violation (the evidence cites a
rule from this file) and Requirement gap (the evidence cites the ticket). The report gives the
type together with Qodo's own `category`, unchanged.

1. **Fix every valid High and Medium finding**, of any type, including Medium Bugs.
2. **Report every Low finding and leave the code as it is**, Low Rule violations included. The
   human decides whether a Low is worth a change.
3. **Valid means reproduced.** A finding is valid when a test fails because of it, or when the
   cited line contradicts a rule in this file or a criterion in the ticket. Read the code and the
   ticket before deciding; the reviewer's text alone is not evidence either way.
4. **A finding the agent believes is wrong is disputed, not dropped.** The report gives the
   evidence (file and line, command output, or the criterion). A disputed High or Medium blocks
   the gate until the human decides. The agent does not dismiss a finding in Qodo on its own, and
   does not edit the ticket so that the code passes.
5. **Fix test-first.** Add a test that fails for the reported reason, then fix, then run
   `npm run check`.
6. **Review again after fixes.** The last review must cover the final tree (for local review:
   coverage complete, staged and unstaged changes and new files included). At least one review of
   the task runs at deep depth. At most three fix rounds; then stop.
7. **A finding listed again after its fix** counts as fixed only when all three hold: the test
   from point 5 failed before and passes now, the code the finding cites is no longer in the
   file, and the reviewer gave no new description. It is reported as "fixed, reviewer stale".
   Recording that outcome in Qodo needs the human's approval.
8. **On a pull request**, the latest completed review must be for the head commit. A review of an
   older commit says nothing about the code that would be merged. One allowance: Qodo may skip a
   commit (`review_effort: skip`, `review_complete: false`). A skipped review at the head counts
   when every commit since the last complete review changes only Markdown files and files under
   `evidence/`, nothing under `src/`, `tests/` or `.github/` and no package or config file. The
   gate report then names the last completely reviewed commit and lists the files changed since.
   This file is Markdown, so a rule change can pass without a review; the human reads those.
9. **Required checks pass on the head commit.** Before a merge, the workflows `check.yml` and
   `ticket-link.yml` have succeeded for the pull request's head: `check` on Linux and on
   Windows, and `ticket-link`. A local `npm run check` does not replace it; the tests
   had only ever run on Windows. A red or missing check sends the pull request back to a fix.

**Not done.** The agent reports the task as NOT DONE, and says why, when any of these is true: a
valid or disputed High or Medium finding is open; `npm run check` fails; on a pull request, a
required check is red or has not run for the head commit; the last review does not
cover the final code; the review failed, was partial, or could not run; three fix rounds did not
clear the gate; a label could not be mapped. An agent that cannot run a Qodo review reports
"implemented, gate pending", never "done". The workflow agent is in that position: it has no
Qodo credentials, on purpose, because every command it runs for a ticket could read them.

**Gate report.** One row per finding: id, type and `category`, `action_level` and severity,
decision (fixed, disputed, reported, fixed with reviewer stale), evidence. Then the checks run
with their result, the latest review and what it covered, the Low findings, any question for the
human, and one line: `Quality gate: MET` or `Quality gate: NOT MET`, with the reason.

## Process rules

- Humans make every commit in interactive sessions. Agents prepare changes and a suggested commit
  message, then stop. In an interactive session an agent may push a branch only with the human's
  explicit approval for that specific push. Exception: the workflows in `.github/workflows/`
  commit and push as a bot on `agent/*` branches without per-push approval; the human's
  `ready-for-agent` label or `@claude` comment is the approval for that run. A human opens the
  pull request from such a branch and decides whether to merge.
- Second exception (Day 9): once an interactive agent is working on a pull request the human has
  opened, it may commit and push to that PR's branch on its own, without asking each time: fixes
  for review findings, their tests, and the journal, evidence and docs that belong to that PR. If
  the agent has any question or concern, or needs the human's input (a disputed finding, an
  unclear label, a change of ticket or scope, anything it is unsure about), it stops and asks
  before committing. Limits: `npm run check` passes; code fixes are test-first; new commits only,
  never an amend, force-push or rebase; never on `main`; no merge; labels and other triggers still
  need approval. The first commit of a task, opening the pull request and merging stay human.
- Suggested commit messages carry no `Co-Authored-By` or other AI attribution trailer. Human
  commits are the human's. Agent commits (bot commits on `agent/*` branches and review-fix
  commits under the second exception) name the agent in a trailer.
- One ticket per pull request where possible.
- Each hackathon day gets a note in `journal/day-NN.md`.
