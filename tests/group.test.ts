import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGitLog } from '../src/gitlog.ts';
import { groupCommits } from '../src/group.ts';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(path.join(fixtureDir, name), 'utf8');

function record(n: number, message: string): string {
  const sha = String(n % 10).repeat(40);
  return `${sha}\u001fA\u001f2026-11-01T00:00:00Z\u001f${message}\u001e\n`;
}
const groupStream = (s: string) => groupCommits(parseGitLog(s).commits);
const count = (g: ReturnType<typeof groupCommits>) =>
  g.sections.reduce((n, s) => n + s.entries.length, 0) + g.ignored.length;

describe('groupCommits', () => {
  const log = parseGitLog(fixture('log-basic.bin'));
  const groups = groupCommits(log.commits);

  test('criterion 1: fixed section order, empty sections omitted', () => {
    assert.deepEqual(groups.sections.map(s => s.title), ['Breaking changes', 'Features', 'Bug fixes', 'docs']);
  });

  test('criterion 1: full ordering of known and unknown types', () => {
    const g = groupStream([
      'zzz: z', 'not conventional', 'test: t', 'revert: r', 'perf: p', 'fix: f', 'feat: e',
      'build: b', 'feat!: boom', 'docs: d',
    ].map((m, i) => record(i + 1, m)).join(''));
    assert.deepEqual(g.sections.map(s => s.title), [
      'Breaking changes', 'Features', 'Bug fixes', 'Performance', 'Reverts',
      'build', 'docs', 'test', 'zzz', 'Unclassified',
    ]);
  });

  test('criterion 2: entry fields', () => {
    const fix = groups.sections.find(s => s.title === 'Bug fixes')!.entries[0]!;
    assert.deepEqual(fix, {
      sha: '2'.repeat(40), shortSha: '2222222', subject: 'detect direct invocation',
      scope: 'cli', prNumber: 1, issueRefs: [], breaking: false, type: 'fix',
    });
  });

  test('criterion 3: breaking commit only under Breaking changes, with notes', () => {
    const b = groups.sections[0]!;
    assert.equal(b.title, 'Breaking changes');
    assert.equal(b.entries.length, 1);
    const e = b.entries[0] as unknown as { breakingNotes: string[]; issueRefs: number[] };
    assert.deepEqual(e.breakingNotes, ['colon must be followed by a space']);
    assert.deepEqual(e.issueRefs, [4, 5]);
    const shas = groups.sections.flatMap(s => s.entries.map(x => x.sha));
    assert.equal(new Set(shas).size, shas.length);
  });

  test('criterion 4: merge commits are ignored with a reason', () => {
    assert.equal(groups.ignored.length, 1);
    assert.equal(groups.ignored[0]!.reason, 'merge commit');
    assert.equal(groups.ignored[0]!.sha, '3'.repeat(40));
    assert.equal(groups.ignored[0]!.type, null);
  });

  test('criterion 5: totals add up on every fixture', () => {
    for (const name of ['log-basic.bin', 'log-missing-fields.bin']) {
      const g = groupCommits(parseGitLog(fixture(name)).commits);
      assert.equal(g.total, parseGitLog(fixture(name)).commits.length, name);
      assert.equal(count(g), g.total, name);
    }
    assert.equal(count(groups), groups.total);
  });

  test('criterion 6: order inside a section is input order', () => {
    const g = groupStream([record(1, 'feat: a'), record(2, 'feat: b'), record(3, 'feat: c')].join(''));
    assert.deepEqual(g.sections[0]!.entries.map(e => e.subject), ['a', 'b', 'c']);
  });

  test('criterion 7: JSON round trip is lossless', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(groups)), groups);
  });

  test('criterion 9: only merge commits', () => {
    const g = groupStream([record(1, 'Merge branch x'), record(2, 'Merge pull request #3 from a/b')].join(''));
    assert.deepEqual(g.sections, []);
    assert.equal(g.ignored.length, 2);
    assert.equal(g.total, 2);
  });

  test('criterion 9: feat! without footer has empty notes', () => {
    const g = groupStream(record(1, 'feat!: drop api'));
    assert.equal(g.sections[0]!.title, 'Breaking changes');
    assert.deepEqual((g.sections[0]!.entries[0] as unknown as { breakingNotes: string[] }).breakingNotes, []);
    assert.equal(g.sections.length, 1);
  });

  test('criterion 9: unseen type gets its own section', () => {
    const g = groupStream(record(1, 'wip: half done'));
    assert.deepEqual(g.sections.map(s => s.title), ['wip']);
  });

  test('a conventional commit whose subject starts with Merge is not ignored', () => {
    const g = groupStream(record(1, 'fix: Merge logic'));
    assert.equal(g.ignored.length, 0);
    assert.equal(g.sections[0]!.title, 'Bug fixes');
  });

  test('rule 6: an indented "Merge " header is not a merge commit; it stays visible as Unclassified', () => {
    const g = groupStream(record(1, '  Merge branch x'));
    assert.equal(g.ignored.length, 0);
    assert.deepEqual(g.sections.map(s => s.title), ['Unclassified']);
    assert.equal(g.total, 1);
  });
});

// tickets/T-008-config-ignore-patterns.md
describe('groupCommits with ignore patterns', () => {
  const messages = [
    'feat: add parser', 'chore(deps): bump typescript', 'docs: typo in readme',
    'Merge pull request #1 from a/b', 'chore(deps)!: drop node 22', 'chore: tidy', 'not conventional',
  ];
  const commits = parseGitLog(messages.map((m, i) => record(i + 1, m)).join('')).commits;
  const ignore = ['^chore\\(deps\\)', '^docs: typo', '^chore'];
  const g = groupCommits(commits, [], { ignore });

  test('criterion 3: without options, and with an empty list, the result is unchanged', () => {
    assert.deepEqual(groupCommits(commits, []), groupCommits(commits));
    assert.deepEqual(groupCommits(commits, [], {}), groupCommits(commits));
    assert.deepEqual(groupCommits(commits, [], { ignore: [] }), groupCommits(commits));
  });

  test('criterion 5: a match goes to ignored with the first matching pattern, as written', () => {
    assert.deepEqual(g.ignored.map(e => [e.subject, e.reason]), [
      ['bump typescript', 'ignore pattern: ^chore\\(deps\\)'],
      ['typo in readme', 'ignore pattern: ^docs: typo'],
      ['Merge pull request #1 from a/b', 'merge commit'],
      ['tidy', 'ignore pattern: ^chore'],
    ]);
    assert.equal(g.ignored[0]!.sha, '2'.repeat(40));
  });

  test('criterion 4: a merge commit keeps its reason even when a pattern matches it', () => {
    const merged = groupCommits(commits, [], { ignore: ['^Merge', '.'] });
    assert.equal(merged.ignored.find(e => e.subject.startsWith('Merge'))!.reason, 'merge commit');
  });

  test('criterion 4: a breaking commit is never ignored by a pattern', () => {
    assert.deepEqual(g.sections[0]!.title, 'Breaking changes');
    assert.deepEqual(g.sections[0]!.entries.map(e => e.subject), ['drop node 22']);
    const all = groupCommits(commits, [], { ignore: ['.'] });
    assert.deepEqual(all.sections.map(s => s.title), ['Breaking changes']);
    assert.equal(all.ignored.length, commits.length - 1);
    // A BREAKING CHANGE footer counts the same as `!`.
    const footer = parseGitLog(record(1, 'fix: x\n\nBREAKING CHANGE: y')).commits;
    assert.equal(groupCommits(footer, [], { ignore: ['^fix'] }).ignored.length, 0);
  });

  test('criterion 5: nothing vanishes with merges, matches and a matching breaking commit', () => {
    assert.equal(g.total, commits.length);
    assert.equal(count(g), g.total);
    assert.deepEqual(g.sections.map(s => [s.title, s.entries.length]), [
      ['Breaking changes', 1], ['Features', 1], ['Unclassified', 1],
    ]);
  });

  test('criterion 3: the pattern sees the first line only, untrimmed, case-sensitive, u flag only', () => {
    const one = (message: string, pattern: string) =>
      groupCommits(parseGitLog(record(1, message)).commits, [], { ignore: [pattern] }).ignored.length;
    assert.equal(one('feat: a\n\nfix: mentioned in the body', 'fix: mentioned'), 0);
    assert.equal(one('feat: a\n\nbody', '^feat: a$'), 1);
    assert.equal(one('feat: a', '^FEAT'), 0);
    assert.equal(one('feat: a', ' ^feat'), 0);
    assert.equal(one('feat: caf\u00e9 \u{1F600}', '^feat: caf\\u{e9} \\u{1F600}$'), 1);
  });

  test('criterion 3: the same pattern list gives the same result twice (no regex state)', () => {
    assert.deepEqual(groupCommits(commits, [], { ignore }), g);
  });

  test('an invalid or empty pattern given to the library throws RangeError', () => {
    assert.throws(() => groupCommits(commits, [], { ignore: ['^ok', '('] }), RangeError);
    assert.throws(() => groupCommits(commits, [], { ignore: [''] }), /ignore\[0\] is an empty pattern/);
  });
});
