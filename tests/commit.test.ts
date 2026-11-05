import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommit } from '../src/commit.ts';

describe('header', () => {
  test('parses type and subject', () => {
    const c = parseCommit('feat: add parser');
    assert.equal(c.conventional, true);
    assert.equal(c.type, 'feat');
    assert.equal(c.scope, null);
    assert.equal(c.subject, 'add parser');
    assert.equal(c.breaking, false);
  });

  test('parses scope', () => {
    const c = parseCommit('fix(parser): handle CRLF');
    assert.equal(c.type, 'fix');
    assert.equal(c.scope, 'parser');
    assert.equal(c.subject, 'handle CRLF');
  });

  test('lower-cases the type but keeps the subject as written', () => {
    const c = parseCommit('Feat: Add Parser');
    assert.equal(c.type, 'feat');
    assert.equal(c.subject, 'Add Parser');
  });

  test('bang marks a breaking change', () => {
    const c = parseCommit('refactor(api)!: drop v1 endpoints');
    assert.equal(c.breaking, true);
    assert.equal(c.type, 'refactor');
    assert.equal(c.scope, 'api');
    assert.equal(c.subject, 'drop v1 endpoints');
  });

  test('extracts a trailing PR number from squash merges', () => {
    const c = parseCommit('feat(cli): add parse command (#42)');
    assert.equal(c.prNumber, 42);
    assert.equal(c.subject, 'add parse command');
  });

  test('does not treat a PR-like token in the middle of the subject as the PR number', () => {
    const c = parseCommit('fix: revert (#7) regression in grouping');
    assert.equal(c.prNumber, null);
    assert.equal(c.subject, 'revert (#7) regression in grouping');
  });

  test('requires a space after the colon', () => {
    const c = parseCommit('feat:no space');
    assert.equal(c.conventional, false);
    assert.equal(c.type, null);
    assert.equal(c.subject, 'feat:no space');
  });

  test('rejects an empty scope', () => {
    const c = parseCommit('feat(): empty scope');
    assert.equal(c.conventional, false);
  });

  test('rejects an empty description', () => {
    const c = parseCommit('feat: ');
    assert.equal(c.conventional, false);
  });
});

describe('non-conventional messages', () => {
  test('are kept with the header as subject', () => {
    const c = parseCommit('Merge branch main into dev');
    assert.equal(c.conventional, false);
    assert.equal(c.type, null);
    assert.equal(c.subject, 'Merge branch main into dev');
    assert.equal(c.breaking, false);
  });

  test('still get PR number, body and footers', () => {
    const c = parseCommit('Update README (#9)\n\nSome words.\n\nRefs: #3');
    assert.equal(c.conventional, false);
    assert.equal(c.prNumber, 9);
    assert.equal(c.subject, 'Update README');
    assert.equal(c.body, 'Some words.');
    assert.deepEqual(c.issueRefs, [3]);
  });

  test('empty input yields an empty, non-conventional commit', () => {
    const c = parseCommit('');
    assert.equal(c.conventional, false);
    assert.equal(c.subject, '');
    assert.equal(c.body, null);
    assert.deepEqual(c.footers, []);
  });
});

describe('body', () => {
  test('is null when absent', () => {
    assert.equal(parseCommit('feat: x').body, null);
  });

  test('keeps multiple paragraphs', () => {
    const c = parseCommit('feat: x\n\nFirst paragraph.\n\nSecond paragraph\nwith two lines.');
    assert.equal(c.body, 'First paragraph.\n\nSecond paragraph\nwith two lines.');
    assert.deepEqual(c.footers, []);
  });

  test('a paragraph that looks like prose is not a footer', () => {
    const c = parseCommit('fix: y\n\nNote: this is prose, not a footer, because the footer section is only at the end.\n\nMore body.');
    assert.equal(c.footers.length, 0);
    assert.match(c.body ?? '', /^Note: this is prose/);
  });
});

describe('footers', () => {
  test('parses "Token: value" and "Token #value" forms', () => {
    const c = parseCommit('fix: z\n\nReviewed-by: Ada\nFixes #12');
    assert.deepEqual(c.footers, [
      { token: 'Reviewed-by', value: 'Ada' },
      { token: 'Fixes', value: '#12' },
    ]);
    assert.deepEqual(c.issueRefs, [12]);
    assert.equal(c.body, null);
  });

  test('BREAKING CHANGE footer marks breaking and records the note', () => {
    const c = parseCommit('feat: new config\n\nBREAKING CHANGE: the old .rc file is no longer read.');
    assert.equal(c.breaking, true);
    assert.deepEqual(c.breakingNotes, ['the old .rc file is no longer read.']);
  });

  test('BREAKING-CHANGE is a synonym', () => {
    const c = parseCommit('feat: new config\n\nBREAKING-CHANGE: see docs');
    assert.equal(c.breaking, true);
    assert.deepEqual(c.breakingNotes, ['see docs']);
  });

  test('multi-line footer values are joined', () => {
    const c = parseCommit('feat: a\n\nBREAKING CHANGE: first line\nsecond line\nRefs: #1');
    assert.deepEqual(c.breakingNotes, ['first line\nsecond line']);
    assert.deepEqual(c.issueRefs, [1]);
  });

  test('collects several issue numbers from one footer and dedupes', () => {
    const c = parseCommit('fix: b\n\nCloses #4, #5\nRefs: #5 #6');
    assert.deepEqual(c.issueRefs, [4, 5, 6]);
  });

  test('issue tokens are matched case-insensitively', () => {
    const c = parseCommit('fix: c\n\nRESOLVES #8');
    assert.deepEqual(c.issueRefs, [8]);
  });

  test('footers separated by blank lines are all collected and body stays separate', () => {
    const c = parseCommit('feat: d\n\nBody here.\n\nSigned-off-by: X\n\nCo-authored-by: Y');
    assert.equal(c.body, 'Body here.');
    assert.deepEqual(c.footers.map(f => f.token), ['Signed-off-by', 'Co-authored-by']);
  });
});

describe('normalization', () => {
  test('handles CRLF line endings', () => {
    const c = parseCommit('fix: e\r\n\r\nBody.\r\n\r\nRefs: #2\r\n');
    assert.equal(c.body, 'Body.');
    assert.deepEqual(c.issueRefs, [2]);
    assert.equal(c.raw.includes('\r'), false);
  });

  test('trims trailing whitespace and blank lines', () => {
    const c = parseCommit('fix: f   \n\n\n');
    assert.equal(c.raw, 'fix: f');
    assert.equal(c.subject, 'f');
  });
});
