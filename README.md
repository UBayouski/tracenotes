# tracenotes

Release notes with receipts. Every line links to the commit or pull request it came from, and
every version bump explains the rule behind it.

Built during the [Qodo Hackathon 2026](https://hackathon.qodo.ai/), "Build a Software Factory
in 30 Days". The tool is also the factory's own release-notes writer.

## Status

Day 3 of 23. Current capabilities: parse a single Conventional Commits message into structured
data (scope, breaking-change markers, footers, issue references, PR number from squash-merge
subjects), and parse a whole `git log` stream into commits with SHA, author, and date.

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

### From git history

tracenotes does not run git itself. Pipe a log stream in a fixed format and it returns every
commit in the range, parsed, plus any record it could not read:

```sh
git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' v0.1.0..HEAD | node src/cli.ts log
```

The fields are SHA, author, ISO 8601 date, and full message, separated by the ASCII unit
separator; records end with the record separator. Output has `commits`, `malformed` (with a
reason per record), and `count`, which always equals the two lengths added together. Nothing
in the range is dropped silently.

## Development

```sh
npm run check      # typecheck + tests
npm test
npm run typecheck
```

Rules for contributors and agents are in `AGENTS.md`. How a ticket gets to `main`, with every
verification gate on one diagram, is in `FACTORY.md`.

## Reuse and licensing

- Conventional Commits specification 1.0.0 (CC BY 3.0) as the grammar reference.
- AGENTS.md rule 7 ("Show the Invisible") and the idea of a source-hygiene test that prints the
  escape to write are borrowed from [pasokh](https://github.com/TheNickRubin/pasokh) by
  TheNickRubin, narrowed to invisible and control characters. The rule text and the code are
  written for this project; nothing is copied.
- No third-party code is vendored. Dev dependencies: `typescript`, `@types/node`.

License: MIT.
