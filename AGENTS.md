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

## Code conventions

- ESM TypeScript executed directly by Node. Import local modules with the `.ts` extension.
- Only erasable TypeScript syntax: no `enum`, no `namespace`, no parameter properties, no `const enum`. `tsconfig.json` enforces this with `erasableSyntaxOnly`.
- `src/cli.ts` is the only module that may touch `process.stdout`, `process.stderr`, or `process.exitCode`. Library code returns values or throws.
- The CLI is tested as a child process in `tests/cli.test.ts`. Any change to argument handling, stdin reading, exit codes, or the direct-invocation check adds or updates a case there. Function-level tests of what the CLI calls do not count as CLI coverage. (Day 1 review lesson: an entry-point bug passed every unit test and would have made the CLI a no-op on Linux.)
- Prefer small pure functions. Keep I/O at the edges.
- Public functions have a doc comment stating inputs, outputs, and failure behavior.
- Commit messages follow Conventional Commits. The project parses its own history, so malformed messages show up in its own notes.

## Working with tickets

Work items live in `tickets/` as `T-NNN-<slug>.md`, each with acceptance criteria. When
implementing a ticket, restate each criterion and show how the change satisfies it. The ordered
backlog is `BACKLOG.md`.

## Process rules

- Humans make every commit in interactive sessions. Agents prepare changes and a suggested commit
  message, then stop. Exception: the workflows in `.github/workflows/` commit as a bot on `agent/*`
  branches only. A human opens the pull request from such a branch and decides whether to merge.
- One ticket per pull request where possible.
- Each hackathon day gets a note in `journal/day-NN.md`.
