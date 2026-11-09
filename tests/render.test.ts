import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGitLog } from '../src/gitlog.ts';
import { groupGitLog } from '../src/group.ts';
import { renderMarkdown } from '../src/render.ts';
import * as api from '../src/index.ts';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(path.join(fixtureDir, name), 'utf8');
const render = (stream: string, repoUrl?: string) =>
  renderMarkdown(groupGitLog(parseGitLog(stream)), repoUrl === undefined ? {} : { repoUrl });

function record(n: number, message: string): string {
  const sha = String(n % 10).repeat(40);
  return `${sha}\u001fA\u001f2026-11-01T00:00:00Z\u001f${message}\u001e\n`;
}

const URL_ = 'https://github.com/UBayouski/tracenotes';

describe('renderMarkdown', () => {
  const basic = fixture('log-basic.bin');

  test('criterion 1: pure and exported from index', () => {
    assert.equal(render(basic), render(basic));
    assert.equal(api.renderMarkdown, renderMarkdown);
    assert.equal(typeof api.groupCommits, 'function');
    assert.equal(typeof api.groupGitLog, 'function');
  });

  test('criteria 2, 3, 5, 6: fixture without repoUrl', () => {
    const out = render(basic);
    assert.equal(out, [
      '## Unreleased',
      '',
      '### Breaking changes',
      '',
      '- **parser:** drop legacy footer syntax (`5555555`)',
      '  - colon must be followed by a space',
      '',
      '### Features',
      '',
      '- add parser (`1111111`)',
      '',
      '### Bug fixes',
      '',
      '- **cli:** detect direct invocation (`2222222`, #1)',
      '',
      '### docs',
      '',
      '- readme (`6666666`)',
      '',
      '_4 of 5 commits shown; 1 merge commits ignored; 1 malformed records skipped._',
      '',
    ].join('\n'));
    assert.ok(out.endsWith('\n') && !out.endsWith('\n\n'));
    assert.ok(!out.includes('\r'));
  });

  test('criterion 3: links with repoUrl', () => {
    const out = render(basic, URL_);
    assert.match(out, new RegExp(`- \\*\\*cli:\\*\\* detect direct invocation \\(\\[2222222\\]\\(${URL_}/commit/${'2'.repeat(40)}\\), \\[#1\\]\\(${URL_}/pull/1\\)\\)\n`));
    assert.match(out, /- add parser \(\[1111111\]\(https:\/\/github\.com\/UBayouski\/tracenotes\/commit\/1{40}\)\)\n/);
  });

  test('criterion 4: injection subject renders as text', () => {
    const out = render(record(1, 'feat: add [x](http://e) <b>'));
    assert.ok(out.includes('- add \\[x\\](http://e) \\<b\\> (`1111111`)'));
    const all = render(record(1, 'feat(a_b): \\ ` * _ [ ] < > # | & ~'));
    assert.ok(all.includes('- **a\\_b:** \\\\ \\` \\* \\_ \\[ \\] \\< \\> \\# \\| \\& \\~ ('));
  });

  test('criterion 4: nothing is trimmed', () => {
    const out = render(record(1, 'feat: spaced  out '));
    assert.ok(out.includes('- spaced  out'));
  });

  test('criterion 5: breaking with and without notes', () => {
    const out = render(
      record(1, 'feat!: no notes') + record(2, 'feat: x\n\nBREAKING CHANGE: a <i> note\n'),
    );
    assert.ok(out.includes('- no notes (`1111111`)\n- x (`2222222`)\n  - a \\<i\\> note\n'));
  });

  test('criterion 6: merge-only stream', () => {
    const out = render(record(1, 'Merge pull request #1 from a/b'));
    assert.equal(out, '## Unreleased\n\n_0 of 1 commits shown; 1 merge commits ignored; 0 malformed records skipped._\n');
  });

  test('criterion 6: counts match total and malformed', () => {
    const groups = groupGitLog(parseGitLog(basic));
    const out = renderMarkdown(groups);
    const shown = groups.sections.reduce((n, s) => n + s.entries.length, 0);
    assert.ok(out.includes(`_${shown} of ${groups.total} commits shown; ${groups.ignored.length} merge commits ignored; ${groups.malformed.length} malformed records skipped._`));
    assert.equal(shown + groups.ignored.length, groups.total);
    assert.equal(groups.malformed.length, 1);
  });

  test('criterion 7: invalid repoUrl throws RangeError naming the value', () => {
    const bad = [
      `${URL_}/`, `${URL_}.git`, `${URL_}?a=b`, `${URL_}#frag`, ` ${URL_}`, `${URL_} `, `${URL_}\n`,
      'http://github.com/a/b', 'https://github.com/a', 'https://github.com/a/b/c', '', 'github.com/a/b',
    ];
    for (const repoUrl of bad) {
      assert.throws(() => render(basic, repoUrl), (e: unknown) =>
        e instanceof RangeError && e.message.includes(JSON.stringify(repoUrl)), repoUrl);
    }
  });

  test('criterion 7: valid forms accepted', () => {
    for (const repoUrl of [URL_, 'https://git.example.com:8443/o/r.js', 'https://github.com/a/b.github.io']) {
      assert.doesNotThrow(() => render(basic, repoUrl));
    }
  });
});
