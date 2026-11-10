import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGitLog } from '../src/gitlog.ts';
import { groupGitLog } from '../src/group.ts';
import { recommendVersion } from '../src/version.ts';
import type { VersionRecommendation } from '../src/version.ts';
import * as api from '../src/index.ts';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(path.join(fixtureDir, name), 'utf8');

function record(n: number, message: string): string {
  const sha = String(n % 10).repeat(40);
  return `${sha}\u001fA\u001f2026-11-01T00:00:00Z\u001f${message}\u001e\n`;
}
const stream = (...messages: string[]) => messages.map((m, i) => record(i + 1, m)).join('');
const recommend = (s: string, current: string) => recommendVersion(groupGitLog(parseGitLog(s)), current);

function assertInvariants(r: VersionRecommendation, malformed: number) {
  assert.equal(r.counts.triggering + r.counts.notTriggering + r.counts.ignored, r.counts.total);
  assert.equal(r.counts.malformed, malformed);
  assert.equal(r.counts.triggering, r.triggers.length);
  assert.ok(r.rule.description.length > 0);
  if (r.bump !== 'none') assert.ok(r.triggers.length > 0);
  assert.equal(r.triggers.length === 0, r.rule.id === 'none');
}

describe('recommendVersion', () => {
  test('criterion 1: exported from the index and pure', () => {
    assert.equal(api.recommendVersion, recommendVersion);
    const g = groupGitLog(parseGitLog(fixture('log-basic.bin')));
    assert.deepEqual(recommendVersion(g, '1.2.3'), recommendVersion(g, '1.2.3'));
  });

  test('fixture: breaking wins, counts and identities hold', () => {
    const log = parseGitLog(fixture('log-basic.bin'));
    const r = recommendVersion(groupGitLog(log), '1.4.2');
    assert.equal(r.rule.id, 'breaking');
    assert.equal(r.bump, 'major');
    assert.equal(r.next, '2.0.0');
    assert.deepEqual(r.triggers.map(t => t.shortSha), ['5555555']);
    assert.equal(r.triggers[0]!.type, 'feat');
    assert.equal(r.counts.ignored, 1);
    assert.equal(r.counts.malformed, log.malformed.length);
    assert.ok(log.malformed.length > 0);
    assertInvariants(r, log.malformed.length);
  });

  test('rule breaking-pre-1.0: breaking in 0.x bumps minor', () => {
    const r = recommend(stream('feat!: boom', 'feat: x'), '0.3.7');
    assert.equal(r.rule.id, 'breaking-pre-1.0');
    assert.equal(r.bump, 'minor');
    assert.equal(r.next, '0.4.0');
    assert.equal(r.triggers.length, 1);
    assertInvariants(r, 0);
  });

  test('a breaking commit marked only with ! triggers major', () => {
    const r = recommend(stream('fix!: drop flag'), '1.4.2');
    assert.equal(r.rule.id, 'breaking');
    assert.equal(r.next, '2.0.0');
    assert.equal(r.triggers[0]!.type, 'fix');
  });

  test('rule feat: minor, resets patch, lower entries are not triggers', () => {
    const r = recommend(stream('fix: a', 'feat: b', 'feat(x): c', 'docs: d'), '1.4.2');
    assert.equal(r.rule.id, 'feat');
    assert.equal(r.bump, 'minor');
    assert.equal(r.next, '1.5.0');
    assert.deepEqual(r.triggers.map(t => t.subject), ['b', 'c']);
    assert.equal(r.counts.notTriggering, 2);
    assertInvariants(r, 0);
  });

  test('rule fix: fix, perf and revert all trigger patch', () => {
    const r = recommend(stream('fix: a', 'perf: b', 'revert: c', 'chore: d'), '1.4.2');
    assert.equal(r.rule.id, 'fix');
    assert.equal(r.bump, 'patch');
    assert.equal(r.next, '1.4.3');
    assert.deepEqual(r.triggers.map(t => t.type).sort(), ['fix', 'perf', 'revert']);
    assertInvariants(r, 0);
  });

  test('rule none: only docs/chore keeps the version', () => {
    const r = recommend(stream('docs: a', 'chore: b', 'not conventional'), '1.4.2');
    assert.equal(r.rule.id, 'none');
    assert.equal(r.bump, 'none');
    assert.equal(r.next, '1.4.2');
    assert.deepEqual(r.triggers, []);
    assert.equal(r.counts.notTriggering, 3);
    assertInvariants(r, 0);
  });

  test('only merge commits: none, all ignored', () => {
    const r = recommend(stream('Merge pull request #1 from a/b', 'Merge branch x'), '0.1.0');
    assert.equal(r.rule.id, 'none');
    assert.equal(r.counts.ignored, 2);
    assert.equal(r.counts.total, 2);
    assertInvariants(r, 0);
  });

  test('a malformed record is counted, not dropped', () => {
    const s = stream('fix: a') + 'garbage\u001e\n';
    const log = parseGitLog(s);
    assert.equal(log.malformed.length, 1);
    const r = recommendVersion(groupGitLog(log), '1.0.0');
    assert.equal(r.counts.malformed, 1);
    assertInvariants(r, 1);
  });

  test('criterion 2: invalid versions throw RangeError naming the value', () => {
    const g = groupGitLog(parseGitLog(stream('fix: a')));
    const big = String(Number.MAX_SAFE_INTEGER + 2);
    const bad = ['v1.2.3', '1.2', '01.2.3', '1.2.3-rc.1', ' 1.2.3', '1.2.3 ', '1.2.3\n', '', `${big}.0.0`, `0.${big}.0`, `0.0.${big}`, '1.2.3+b', '1.-2.3'];
    for (const v of bad) {
      assert.throws(() => recommendVersion(g, v), (e: unknown) =>
        e instanceof RangeError && e.message.includes(JSON.stringify(v)), JSON.stringify(v));
    }
    assert.equal(recommendVersion(g, '0.0.0').next, '0.0.1');
    assert.equal(recommendVersion(g, `0.0.${Number.MAX_SAFE_INTEGER - 1}`).next, `0.0.${Number.MAX_SAFE_INTEGER}`);
  });

  test('criterion 3: overflow on bump throws RangeError', () => {
    const max = Number.MAX_SAFE_INTEGER;
    assert.throws(() => recommend(stream('fix: a'), `1.1.${max}`), RangeError);
    assert.throws(() => recommend(stream('feat: a'), `1.${max}.0`), RangeError);
    assert.throws(() => recommend(stream('feat!: a'), `${max}.0.0`), RangeError);
    assert.throws(() => recommend(stream('feat!: a'), `0.${max}.0`), RangeError);
    // no bump, no overflow
    assert.equal(recommend(stream('docs: a'), `${max}.${max}.${max}`).bump, 'none');
  });
});
