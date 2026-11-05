# tracenotes

Release notes with receipts. Every line links to the commit or pull request it came from, and
every version bump explains the rule behind it.

Built during the [Qodo Hackathon 2026](https://hackathon.qodo.ai/), "Build a Software Factory
in 30 Days". The tool is also the factory's own release-notes writer.

## Status

Day 1 of 23. Current capability: parse a single Conventional Commits message into structured
data, including scope, breaking-change markers, footers, issue references, and the pull request
number from squash-merge subjects.

See `BACKLOG.md` for the plan and `journal/` for the daily log.

## Usage

Requires Node 24 or newer. No build step, no runtime dependencies.

```sh
npm install
node src/cli.ts parse "feat(parser)!: drop legacy footer syntax (#17)"
```

```json
{
  "raw": "feat(parser)!: drop legacy footer syntax (#17)",
  "conventional": true,
  "type": "feat",
  "scope": "parser",
  "breaking": true,
  "subject": "drop legacy footer syntax",
  "prNumber": 17,
  "body": null,
  "footers": [],
  "breakingNotes": [],
  "issueRefs": []
}
```

Multi-line messages can be piped on stdin:

```sh
git log -1 --format=%B | node src/cli.ts parse
```

## Development

```sh
npm run check      # typecheck + tests
npm test
npm run typecheck
```

Rules for contributors and agents are in `AGENTS.md`.

## Reuse and licensing

- Conventional Commits specification 1.0.0 (CC BY 3.0) as the grammar reference.
- No third-party code is vendored. Dev dependencies: `typescript`, `@types/node`.

License: MIT.
