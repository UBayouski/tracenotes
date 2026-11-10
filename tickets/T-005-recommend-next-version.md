# T-005: Recommend the next version with the rule that produced it

**Goal.** Given the current version and a git log stream, recommend the next semantic version and
say why: which rule fired and which commits triggered it (Explain Every Bump, rule 3). Every input
commit is accounted for in the answer (Nothing Vanishes, rule 2).

**Input.** The same git log stream `log`, `group` and `render` read, plus the current version as a
CLI option. The recommender works on `ReleaseGroups` from `groupGitLog` (T-003); nothing is parsed
twice.

**Why this shape.** A bump is only reviewable if it names its rule and its commits. Working from
`ReleaseGroups` reuses the merge-commit and malformed-record accounting that `group` and `render`
already have, so the three commands agree on what was in the range.

**Acceptance criteria.**

1. `recommendVersion(groups: ReleaseGroups, current: string): VersionRecommendation` in
   `src/version.ts`. Pure: no I/O, no clock, no environment; the same input gives the same output.
   Exported from `src/index.ts` with its types.
2. `current` must match `MAJOR.MINOR.PATCH`: three non-negative decimal integers without leading
   zeros (`0` is fine, `01` is not), separated by `.`, each at most `Number.MAX_SAFE_INTEGER`.
   No `v` prefix, no pre-release or build suffix, no surrounding whitespace. It is checked on the
   raw value, never trimmed or repaired first (rule 6). Anything else throws `RangeError` naming
   the value.
3. Bump rules, checked in this order; the first rule with at least one triggering commit wins:
   - `breaking`: any entry in the `Breaking changes` section → major. When the current major is
     `0`, the bump is minor instead (initial development, SemVer item 4), and the rule id is
     `breaking-pre-1.0`.
   - `feat`: any entry of type `feat` → minor.
   - `fix`: any entry of type `fix`, `perf` or `revert` → patch.
   - `none`: no commit triggered a rule → the version stays the same.
   A higher bump resets the lower parts (`1.4.2` + minor → `1.5.0`; + major → `2.0.0`). If the
   result would pass `Number.MAX_SAFE_INTEGER` in any part, throw `RangeError`.
4. `VersionRecommendation` has: `current`, `next` (strings), `bump`
   (`'major' | 'minor' | 'patch' | 'none'`), `rule` (`{ id, description }`, where `id` is one of
   `breaking`, `breaking-pre-1.0`, `feat`, `fix`, `none`, and `description` is one plain English
   sentence stating the rule), and `triggers`: every entry that matches the winning rule, each with
   `sha`, `shortSha`, `type` and `subject`. `triggers` is empty only when the rule is `none`.
   Entries that match a lower rule are not triggers. Order: the order `render` prints the entries,
   that is, section order from `groupCommits` (for the `fix` rule: Bug fixes, then Performance, then
   Reverts), then input order within each section. `ReleaseGroups` does not keep the order across
   sections, and this keeps the recommendation and the notes in the same order. *(Amended on Day 7
   after Qodo finding 06d9643f on PR 16; the first version said "in input order".)*
5. Nothing Vanishes: the recommendation also has `counts` with `total`, `triggering`,
   `notTriggering` (entries that matched no rule or a lower rule), `ignored` (merge commits) and
   `malformed`, every count always present. `triggering + notTriggering + ignored === total`, and
   `malformed` equals `groups.malformed.length`. A test checks both identities.
6. Explain Every Bump: there is no code path that returns a `bump` other than `none` with an empty
   `triggers`, or a `rule` without a `description`. A test covers each rule id.
7. CLI: `node src/cli.ts version --current <x.y.z>` reads a git log stream from stdin, prints the
   recommendation as JSON (2-space indent, one trailing newline) and exits 0. Stdin handling is the
   same as `render`: terminal stdin and empty stdin exit 2 with the usage text. A missing
   `--current`, a missing value after it, an invalid version, or an unknown option exits 2 with an
   error on stderr and nothing on stdout. The version is validated before stdin is read, so a bad
   value fails fast. `USAGE` lists the command.
8. Tests: `tests/version.test.ts` for criteria 1 to 6 from `tests/fixtures/log-basic.bin` and
   inline streams, including: each rule id; a breaking commit marked only with `!`; a pre-1.0
   breaking change; the exact trigger order for a `fix` rule whose input has `perf`, `revert`
   and `fix` out of section order (compared without sorting); a range with only merge commits; a range with only `docs`/`chore` commits
   (`none`); a malformed record; each invalid version form from criterion 2 (`v1.2.3`, `1.2`,
   `01.2.3`, `1.2.3-rc.1`, ` 1.2.3`, `1.2.3 `, an empty string, a part above
   `Number.MAX_SAFE_INTEGER`); and overflow on bump. `tests/cli.test.ts` gets child-process cases
   for criterion 7 (success, missing `--current`, missing value, invalid version, unknown option,
   terminal stdin).

**Must not break.** `parse`, `log`, `group` and `render` output and exit codes stay as they are;
all existing tests pass unchanged.

**Out of scope.**
- Reading the current version from `package.json` or from git tags (T-011 selects ranges by tag).
- Pre-release and build metadata (`1.2.3-rc.1`, `+build`), both as input and as output.
- A version number in the `render` heading or in `CHANGELOG.md` (T-012).
- Configurable rules or type lists (T-008).
- An MCP tool for the recommendation (T-013).

**Verification.** `npm run check`. Manual:
`git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' -10 | node src/cli.ts version --current 0.1.0`
prints JSON whose `rule` and `triggers` match the commits in the range.

**Status.** Backlog line written on Day 1 ("Recommend the next version with the rule that produced
it"). Day 6 triage (`journal/day-06.md`) found it self-contained. Ticket written on Day 7 to give
the factory a PR whose Qodo findings are worked through with Review Resolver.
