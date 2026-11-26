# Rule 6 sweep (T-039), Nov 26

The sweep the new process rule asks for, run once on the code rule 6 now applies to: `src/`,
`scripts/` and `.claude/skills/*/scripts/`, on branch `t-039-rule-6-sweep` after the parser fix.

## Searched

```
grep -n -E "\.trim(Start|End)?\(\)|\.replace\(|\.toLowerCase\(\)|\.normalize\(" \
  src/*.ts scripts/*.ts .claude/skills/*/scripts/*.ts
```

Comment lines left out. Each hit was read in context and sorted by what the normalized value is
used for.

## Found

| Hit | What it does | Verdict |
|---|---|---|
| `src/commit.ts:66` `normalize()` | `\r\n` to `\n`, trailing whitespace per line, blank lines at the start and end of the message | Allowed framing (listed in rule 6) |
| `src/commit.ts:73` paragraph split | removes only the separating newlines | Allowed; indentation kept (PR 1 fix) |
| `src/commit.ts:142` `trimEnd()` after the `(#123)` suffix | trailing whitespace before the suffix | Allowed (trailing whitespace) |
| `src/commit.ts:148`, `:172` `toLowerCase()` | type and footer token, after the header and footer matched | After validation; fine |
| `src/commit.ts:151` subject `.trim()` | display text, after the header matched or failed | After validation; a non-conventional header keeps its text, minus the outer spaces, in `subject`; `raw` is unchanged |
| `src/commit.ts:128` header `.trim()` | **removed in T-039**: the header was matched after leading whitespace was stripped | Was the violation (88effe66) |
| `src/check.ts:63` `trimStart()` workaround | **removed in T-039**: no longer needed | — |
| `src/gitlog.ts:58` | leading newlines before a record's first field | Allowed ("the newline git prints after a record") |
| `src/gitlog.ts:103` `raw.trim().length === 0` | **skips any whitespace-only record**, not only the final newline | **Wider than the rule allows.** See below. |
| `src/cli.ts:211, 225, 262, 364, 385, 453` | whitespace-only stdin counts as empty and prints usage | Not validation of what is left: nothing is accepted |
| `src/cli.ts:130`, `src/render.ts:22, 173`, `scripts/pr-ticket-check.ts:71`, `audit.ts:320` | escaping for output | Output, not input normalization |
| `audit.ts:248` `unescape` | reverses render's Markdown escapes to read the notes back | Exact inverse of render; fine |

`scripts/` and the skill scripts have no `.trim()` left (PR 34 removed the one in
`scripts/action-pins.ts`, finding 28bcc7c0).

## The one new case: `src/gitlog.ts:103`

```
node --input-type=module -e "import { parseGitLog } from './src/gitlog.ts'; ..."
"\n"     commits 2 malformed 0 count 2
"   "    commits 2 malformed 0 count 2
"\t"     commits 2 malformed 0 count 2
"\u00a0" commits 2 malformed 0 count 2
"junk"   commits 2 malformed 1 count 3
```

A record that is only spaces, tabs or a no-break space between two record separators is
dropped without a word; the same position with `junk` is reported as malformed. Rule 6 allows
"the newline git prints after a record", not any whitespace. `git log` with the documented
format never writes such a record, so the effect is limited to hand-made or damaged streams.
Not fixed here (one ticket per pull request): opened as **T-040** in `BACKLOG.md`.
