import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describeRawInvisible, findRawInvisible, showPath, sourceProblems } from '../scripts/source-hygiene.ts';

// tickets/T-028-source-hygiene.md, AGENTS.md rule 7 (Show the Invisible).
// Every character under test is built from its code point, so this file passes its own check.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cp = (code: number) => String.fromCodePoint(code);

describe('findRawInvisible', () => {
  test('criteria 2, 4, 7: each forbidden character is reported with its position and escape', () => {
    const cases: Array<[number, string]> = [
      [0xfeff, '\\uFEFF'], // byte order mark (Cf)
      [0x2028, '\\u2028'], // line separator (Zl)
      [0x2029, '\\u2029'], // paragraph separator (Zp)
      [0x200b, '\\u200B'], // zero-width space (Cf)
      [0x202e, '\\u202E'], // right-to-left override (Cf)
      [0x00ad, '\\u00AD'], // soft hyphen (Cf)
      [0x00a0, '\\u00A0'], // no-break space (Zs)
      [0x3000, '\\u3000'], // ideographic space (Zs)
      [0x000d, '\\u000D'], // carriage return (Cc)
      [0x0000, '\\u0000'], // null (Cc)
      [0x001b, '\\u001B'], // escape (Cc)
      [0x007f, '\\u007F'], // delete (Cc)
      [0x0085, '\\u0085'], // next line (Cc, C1)
      [0xfffd, '\\uFFFD'], // replacement character
      [0xe0001, '\\u{E0001}'], // language tag (Cf, astral)
      // Qodo local review finding 719768a3: blank characters outside those categories.
      [0x3164, '\\u3164'], // Hangul filler (Lo, valid in an identifier)
      [0x115f, '\\u115F'], // Hangul choseong filler (Lo)
      [0xffa0, '\\uFFA0'], // halfwidth Hangul filler (Lo)
      [0x034f, '\\u034F'], // combining grapheme joiner (Mn)
      [0xfe0f, '\\uFE0F'], // variation selector 16 (Mn)
      [0xe0100, '\\u{E0100}'], // variation selector 17 (Mn, astral)
      [0x2800, '\\u2800'], // braille pattern blank (So)
    ];
    for (const [codePoint, escape] of cases) {
      const text = `ab\n  x${cp(codePoint)}y`;
      assert.deepEqual(findRawInvisible(text), [{ line: 2, column: 4, codePoint, escape }], escape);
    }
  });

  test('criteria 2, 3, 7: tab, line feed, space and visible non-ASCII are allowed', () => {
    // The last three: a combining acute accent, a braille dot, a Hangul syllable. Each is
    // next to a forbidden character in Unicode and is itself visible.
    const allowed = [0x09, 0x0a, 0x20, 0x7e, 0xb1, 0xe9, 0x2014, 0x4e2d, 0x1f600, 0x0301, 0x2801, 0xd55c];
    for (const codePoint of allowed) {
      assert.deepEqual(findRawInvisible(`a${cp(codePoint)}b`), [], codePoint.toString(16));
    }
    assert.deepEqual(findRawInvisible(''), []);
    assert.deepEqual(findRawInvisible('const a = 1;\n\tconst b = "x y";\n'), []);
  });

  test('criterion 4: several characters come back in order; columns count UTF-16 code units', () => {
    const text = `a${cp(0xe0001)}${cp(0x200b)}\n${cp(0xfeff)}`;
    assert.deepEqual(findRawInvisible(text), [
      { line: 1, column: 2, codePoint: 0xe0001, escape: '\\u{E0001}' },
      { line: 1, column: 4, codePoint: 0x200b, escape: '\\u200B' },
      { line: 2, column: 1, codePoint: 0xfeff, escape: '\\uFEFF' },
    ]);
  });

  test('criterion 2: a carriage return is reported; only the line feed ends a line', () => {
    const text = `a${cp(0x0d)}\nb${cp(0x0d)}\n`;
    assert.deepEqual(findRawInvisible(text), [
      { line: 1, column: 2, codePoint: 0x0d, escape: '\\u000D' },
      { line: 2, column: 2, codePoint: 0x0d, escape: '\\u000D' },
    ]);
  });

  test('criterion 2: U+2028 does not start a new line for the position', () => {
    const text = `a${cp(0x2028)}b${cp(0x200b)}`;
    assert.deepEqual(findRawInvisible(text).map(hit => [hit.line, hit.column]), [[1, 2], [1, 4]]);
  });

  test('criterion 4: a lone surrogate does not throw and is not reported', () => {
    assert.deepEqual(findRawInvisible(`a${String.fromCharCode(0xd800)}b`), []);
  });
});

describe('describeRawInvisible', () => {
  test('criterion 6: one line with path, position, code point and the escape to write', () => {
    const [hit] = findRawInvisible(`ab\n  x${cp(0xfeff)}y`);
    assert.ok(hit);
    assert.equal(describeRawInvisible('src/gitlog.ts', hit), 'src/gitlog.ts:2:4 raw U+FEFF, write \\uFEFF');
    const [astral] = findRawInvisible(cp(0xe0001));
    assert.ok(astral);
    assert.equal(describeRawInvisible('tests/a.test.ts', astral), 'tests/a.test.ts:1:1 raw U+E0001, write \\u{E0001}');
  });

  // Qodo PR review finding 9fb45c26: a path is printed inside a one-line report, so the
  // characters the rule forbids, and tab and line feed, are shown as escapes there too.
  test('criterion 6: a path with control or invisible characters cannot split or spoof the line', () => {
    const [hit] = findRawInvisible(cp(0xfeff));
    assert.ok(hit);
    const odd = `src/a${cp(0x0a)}b${cp(0x09)}c${cp(0x202e)}d${cp(0x1b)}.ts`;
    const line = describeRawInvisible(odd, hit);
    assert.equal(line, 'src/a\\u000Ab\\u0009c\\u202Ed\\u001B.ts:1:1 raw U+FEFF, write \\uFEFF');
    assert.deepEqual(findRawInvisible(line), []);
    assert.equal(line.includes(cp(0x0a)), false);
    assert.equal(showPath('src/plain-name.test.ts'), 'src/plain-name.test.ts');
    assert.equal(showPath(`src/caf${cp(0xe9)}.ts`), `src/caf${cp(0xe9)}.ts`, 'visible non-ASCII stays');
  });

  test('criterion 5: the not-valid-UTF-8 line shows such a path the same way', () => {
    const odd = `tests/x${cp(0x0a)}error: forged.ts`;
    assert.deepEqual(sourceProblems(odd, new Uint8Array([0xff])), ['tests/x\\u000Aerror: forged.ts: not valid UTF-8']);
  });

  test('criterion 6: the message itself contains no raw forbidden character', () => {
    for (const codePoint of [0xfeff, 0x2028, 0x0d, 0x1b, 0xe0001, 0x3164]) {
      const [hit] = findRawInvisible(cp(codePoint));
      assert.ok(hit);
      assert.deepEqual(findRawInvisible(describeRawInvisible('src/x.ts', hit)), []);
    }
  });
});

describe('sourceProblems', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  test('criterion 5: bytes that are not valid UTF-8 give one problem with the path', () => {
    assert.deepEqual(sourceProblems('src/x.ts', bytes(0x61, 0xff, 0x62)), ['src/x.ts: not valid UTF-8']);
    assert.deepEqual(sourceProblems('src/x.ts', bytes(0xc3)), ['src/x.ts: not valid UTF-8']);
  });

  test('criteria 5, 6: valid UTF-8 gives one line per raw character, or nothing', () => {
    assert.deepEqual(sourceProblems('src/x.ts', bytes(0x61, 0x0a, 0x62)), []);
    assert.deepEqual(sourceProblems('src/x.ts', bytes()), []);
    // 0xC2 0xA0 is U+00A0, a no-break space.
    assert.deepEqual(sourceProblems('src/x.ts', bytes(0x61, 0xc2, 0xa0)), ['src/x.ts:1:2 raw U+00A0, write \\u00A0']);
  });

  test('a byte order mark at the start of a file is reported, not swallowed by the decoder', () => {
    assert.deepEqual(sourceProblems('src/x.ts', bytes(0xef, 0xbb, 0xbf, 0x61)), ['src/x.ts:1:1 raw U+FEFF, write \\uFEFF']);
  });
});

describe('source hygiene of this repository', () => {
  const roots = ['src', 'tests', 'scripts'];
  const files = roots
    .flatMap(root =>
      readdirSync(path.join(repoRoot, root), { recursive: true, encoding: 'utf8' })
        .filter(name => name.endsWith('.ts'))
        .map(name => `${root}/${name.split(path.sep).join('/')}`),
    )
    .sort();

  test('criterion 5: the walk finds the TypeScript sources, and no fixture', () => {
    // An empty or partial walk would pass the next test without checking anything.
    for (const expected of ['src/cli.ts', 'src/gitlog.ts', 'tests/gitlog.test.ts', 'tests/source-hygiene.test.ts', 'scripts/source-hygiene.ts']) {
      assert.ok(files.includes(expected), `${expected} was not found by the walk`);
    }
    assert.deepEqual(files.filter(file => !file.endsWith('.ts') || file.startsWith('tests/fixtures/')), []);
  });

  test('criteria 5, 6, 8: no .ts file under src/, tests/ or scripts/ has a raw invisible or control character', () => {
    const problems: string[] = [];
    for (const file of files) {
      let bytes: Uint8Array;
      try {
        bytes = readFileSync(path.join(repoRoot, file));
      } catch (error) {
        // A file that cannot be read is its own problem, not an encoding problem
        // (Qodo local review finding 7cb5aca3).
        const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown error';
        problems.push(`${showPath(file)}: cannot be read (${code})`);
        continue;
      }
      problems.push(...sourceProblems(file, bytes));
    }
    assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
  });
});
