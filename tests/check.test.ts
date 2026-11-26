import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkGitLog } from '../src/check.ts';
import { parseGitLog, RECORD_SEPARATOR as RS, FIELD_SEPARATOR as FS } from '../src/gitlog.ts';

const sha = (digit: string) => digit.repeat(40);
const record = (s: string, message: string) => `${s}${FS}Ada${FS}2026-11-18T10:00:00Z${FS}${message}${RS}\n`;
const check = (...records: string[]) => checkGitLog(parseGitLog(records.join('')));

describe('checkGitLog (T-009)', () => {
  test('every conventional header passes (criterion 1)', () => {
    const result = check(record(sha('1'), 'feat: a\n'), record(sha('2'), 'fix(cli)!: b\n\nbody\n'));
    assert.deepEqual(result.commits.map(c => c.verdict), ['pass', 'pass']);
    assert.deepEqual(result.commits.map(c => c.reason), [null, null]);
    assert.equal(result.failed, 0);
    assert.equal(result.passed, 2);
  });

  test('pass, fail, skip and malformed keep stream order and add up (criteria 1, 2)', () => {
    const result = check(
      record(sha('1'), 'Journl day 11 update\n'),
      record(sha('2'), 'feat: a\n'),
      'not-a-sha' + FS + 'x' + FS + 'y' + FS + 'chore: z' + RS + '\n',
      record(sha('3'), 'Merge pull request #26 from o/b\n'),
    );
    assert.deepEqual(result.commits.map(c => [c.shortSha, c.verdict, c.reason]), [
      ['1111111', 'fail', 'not a conventional commit header'],
      ['2222222', 'pass', null],
      ['3333333', 'skip', 'merge commit'],
    ]);
    assert.equal(result.malformed.length, 1);
    assert.equal(result.total, 4);
    assert.equal(result.passed + result.failed + result.skipped + result.malformed.length, result.total);
    assert.equal(result.commits[0]!.header, 'Journl day 11 update');
  });

  // Qodo PR review finding 88effe66: a header with leading whitespace must fail. Since T-039 the
  // parser itself decides on the header as received (rule 6); this test keeps the CLI behaviour.
  test('a header with leading whitespace fails (finding 88effe66)', () => {
    for (const header of ['  feat: x', '\tfeat: x', '\u00a0feat: x']) {
      const commit = check(record(sha('1'), `${header}\n`)).commits[0]!;
      assert.equal(commit.verdict, 'fail', JSON.stringify(header));
      assert.equal(commit.reason, 'not a conventional commit header');
    }
    assert.equal(check(record(sha('1'), 'feat: x  \n')).commits[0]!.verdict, 'pass');
  });

  test('an empty scope fails (criterion 6)', () => {
    assert.equal(check(record(sha('1'), 'feat(): x\n')).commits[0]!.verdict, 'fail');
  });

  test('a merge commit is skipped, not failed, whatever its header (criterion 6)', () => {
    const result = check(record(sha('1'), "Merge branch 'day-05-addendum'\n"));
    assert.equal(result.commits[0]!.verdict, 'skip');
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 1);
  });

  test('the header is the first line only (criterion 4)', () => {
    assert.equal(check(record(sha('1'), 'bad header\n\nfeat: not the header\n')).commits[0]!.header, 'bad header');
  });
});
