# T-028: Source hygiene: no raw invisible or control characters in TypeScript sources

**Goal.** A character a reviewer cannot see never sits raw in a `.ts` file: it is written as an
escape, a test fails when one slips in, and the failure names the file, the position and the
escape to write instead.

**Why.** Twice an agent's file write turned an intended escape into the literal character: a
byte order mark and U+2028 inside string literals in `src/config.ts` (Day 9), and U+2028 in a new
test (Day 10). Tests pass, because the character means the same to JavaScript, and no review
mentioned either; both were found by scanning for non-ASCII by hand. A diff with an invisible
character in it cannot be reviewed, and the direction marks among them can make code read
differently from what runs.

**Origin.** The rule and the idea of a test that prints the escape are borrowed from pasokh
("Show the Invisible", https://github.com/TheNickRubin/pasokh/blob/main/AGENTS.md), as promised in
https://github.com/orgs/qodo-hackathon/discussions/4#discussioncomment-19574198. No code is
copied. tracenotes has no Persian text, so the adaptation is narrower: invisible and control
characters only.

**Acceptance criteria.**

1. `AGENTS.md` has project rule 7, "Show the Invisible", in the form of rules 1 to 6 (what,
   applies to, why): in `.ts` files under `src/`, `tests/` and `scripts/`, the characters of
   criterion 2 are written as `\uXXXX` (or `\u{XXXXX}`) escapes, or built with
   `String.fromCodePoint`, never raw.
2. Forbidden raw: every character in the Unicode categories Cc (controls) except tab and line
   feed, Cf (format characters: byte order mark, zero-width and direction marks, soft hyphen),
   Zs except the ordinary space U+0020 (no-break and other spaces), Zl and Zp (U+2028, U+2029),
   every character with the Unicode property Default_Ignorable_Code_Point (Hangul fillers,
   which are letters and valid in an identifier; variation selectors; the combining grapheme
   joiner), U+2800 (braille pattern blank), and U+FFFD (the replacement character, the trace of
   a wrong decoding). Carriage return is forbidden: `.gitattributes` keeps sources at LF.
3. Visible non-ASCII characters (for example the plus-minus sign in a comment in
   `src/gitlog.ts`, or an em dash) are allowed.
4. A function `findRawInvisible(text)` returns one entry per forbidden character, in order, with
   1-based line, 1-based column counted in UTF-16 code units, the code point, and the escape to
   write. It has a doc comment (inputs, outputs, failure behavior) and does not throw on any string.
5. `tests/source-hygiene.test.ts` checks every `.ts` file under `src/`, `tests/` and `scripts/`,
   found by walking those directories from the test's own location (no git, no network, rule 5).
   A file that is not valid UTF-8 fails the test with its path. Files under `tests/fixtures/` are
   not `.ts` and are not checked: `config-bom.json` and `config-invalid-utf8.json` hold raw
   bytes on purpose.
6. On a violation the test fails with one line per character:
   `<path>:<line>:<column> raw U+XXXX, write \uXXXX`, with the path relative to the repository
   root and forward slashes on every platform. The message itself contains no raw forbidden
   character.
7. The test proves the detector on its own inputs, built with `String.fromCodePoint` so the test
   file passes its own check: a byte order mark, U+2028, U+200B, U+202E, U+00A0, a carriage
   return, U+0085, U+FFFD and an astral format character (U+E0001) are each reported with the
   right position and escape; tab, line feed, the ordinary space, U+00B1 and U+2014 are not.
8. The two raw byte order marks on `main` are replaced with `\uFEFF`: `src/gitlog.ts` line 99
   and `tests/gitlog.test.ts` line 122. Behavior does not change; the existing BOM tests still
   pass.
9. `README.md`, "Reuse and licensing", names pasokh as the source of the rule.
10. `npm run check` passes.

**Out of scope.**
- Markdown, JSON, YAML and workflow files. `AGENTS.md` and the journal use em dashes; evidence
  files are raw tool output.
- Look-alike letters (Cyrillic a for Latin a) and an ASCII-only policy.
- A pre-commit hook or a separate CI job: the test runs inside `npm run check`, which `check.yml`
  runs on every pull request.
- Importing rule 7 into Qodo Review Standards (a manual step after the merge).

**Verification.**
- Criteria 1, 9: read the diff.
- Criteria 2 to 7: `node --test tests/source-hygiene.test.ts`.
- Criterion 6, by hand once: put a raw U+200B into a scratch `.ts` file under `tests/`, run the
  test, read the line, remove the file.
- Criterion 8: `git diff` shows only the two literals changed; `node --test tests/gitlog.test.ts`.
- Criterion 10: `npm run check`.

**Investigation.** Done Nov 13 with Codebase Wisdom (Qodo CLI 2.3.1, skill 1.1.7) on `main` at
`6dc9a90`, and cross-checked against the working tree. Raw results: `evidence/day10/raw/`.

- *Is the tree clean today, as the backlog row assumed?* No. `codebase grep` (perl,
  `[^\x00-\x7F]`, `*.ts`) finds three lines: `src/gitlog.ts:47` (a plus-minus sign in a comment),
  `src/gitlog.ts:99` and `tests/gitlog.test.ts:122` (a raw byte order mark in a string literal).
  `codebase blame` dates line 99 to commit `f8e9b11`, Nov 5: the BOM fix from the review of PR 3
  put the BOM into the source raw, and it passed every review from PR 3 to PR 21. The ticket
  therefore has criterion 8, and criterion 3 decides the plus-minus sign.
- *Can the rule cover all of `tests/`, as the backlog row said?* No. `codebase find` lists
  `tests/fixtures/config-bom.json`, `config-invalid-utf8.json` and two `.bin` logs, which hold raw
  bytes on purpose. Scope is `.ts` files (criterion 5). `scripts/` is added: it did not exist when
  the row was written.
- *Is there an existing convention for writing these characters?* Yes. `codebase grep` for
  `\uXXXX` finds 19 lines in 8 `.ts` files, among them `const BOM = '\uFEFF'` in
  `src/config.ts:14` and the separators in `src/gitlog.ts:16-17`. The rule writes down what most
  of the code already does; `gitlog.ts:99` is the exception.
- *Has this been fixed or discussed in a pull request before?* Not answered:
  `pull-request similar` and `pull-request by-file` both returned `MT-UPSTREAM-DOWN`
  (context-retriever unreachable). From the journal: fixed by hand on Day 9, never in a review.
- *A warning about the evidence itself.* The first grep used the path filter
  `{src,tests}/**/*.ts` and returned `found: false`, no error. The same pattern with `*.ts`
  returned the three lines. A brace glob matches nothing in this tool, silently. An empty result
  was only believed after a second query that had to match something (the `\uXXXX` grep) also
  came back empty.

**Decisions.**
- A. Visible non-ASCII stays allowed (criterion 3). Proposed by the agent, confirmed by the
  human on Nov 13 ("agree"). The alternative, ASCII only in `.ts`, was simpler to state but went
  beyond the borrowed rule.
- B. The two existing byte order marks are fixed in this pull request (criterion 8), not in a
  separate one: the new test cannot pass without it. The agent's choice; the human read it and told the agent to continue (Nov 13).
- C. `findRawInvisible` lives in `scripts/source-hygiene.ts` (factory tooling, next to
  `pr-ticket-check.ts`), not in `src/`: it is not part of the product's API. The agent's choice;
  the human read it and told the agent to continue (Nov 13).
- D. After the first local review (Nov 13, three informational findings, `evidence/day10/`),
  the human chose to fix all three: criterion 2 widened with Default_Ignorable_Code_Point and
  U+2800 (finding 719768a3: an invisible Hangul filler is a valid identifier character and
  passed); `String.fromCodePoint` instead of `String.fromCharCode` in criteria 1 and 7 (finding
  eff38ef9: the latter cuts code points above U+FFFF to 16 bits); a file that cannot be read is
  reported as that, not as invalid UTF-8 (finding 7cb5aca3). Known cost of the wider set: an
  emoji that carries a variation selector must have the selector written as an escape.
