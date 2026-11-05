import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGitLog, RECORD_SEPARATOR, FIELD_SEPARATOR } from '../src/gitlog.ts';

// Fixtures are byte-for-byte captures of the stream contract. No test runs git.
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const basic = readFileSync(path.join(fixturesDir, 'log-basic.bin'), 'utf8');
const missingFields = readFileSync(path.join(fixturesDir, 'log-missing-fields.bin'), 'utf8');

const SHA1 = '1'.repeat(40);
const SHA5 = '5'.repeat(40);

describe('parseGitLog', () => {
  // Criterion 1
  test('splits records and fields and keeps input order', () => {
    const result = parseGitLog(basic);
    assert.equal(result.commits.length, 5);
    assert.deepEqual(
      result.commits.map(c => c.sha[0]),
      ['1', '2', '3', '5', '6'],
    );
    const first = result.commits[0];
    assert.ok(first);
    assert.equal(first.sha, SHA1);
    assert.equal(first.author, 'Ada Lovelace');
    assert.equal(first.date, '2026-11-02T09:00:00+01:00');
    assert.equal(first.message.type, 'feat');
    assert.equal(first.message.subject, 'add parser');
  });

  // Criterion 2
  test('a record with an invalid SHA goes to malformed with a reason, not dropped', () => {
    const result = parseGitLog(basic);
    assert.equal(result.malformed.length, 1);
    const bad = result.malformed[0];
    assert.ok(bad);
    assert.match(bad.reason, /invalid sha/);
    assert.match(bad.raw, /ABCDEF/);
    assert.ok(result.commits.every(c => /^[0-9a-f]{40}$/.test(c.sha)));
  });

  // Criterion 3
  test('a record with fewer than four fields is reported as missing fields', () => {
    const result = parseGitLog(missingFields);
    assert.equal(result.commits.length, 0);
    assert.equal(result.malformed.length, 1);
    assert.equal(result.malformed[0]?.reason, 'missing fields');
  });

  // Criterion 4
  test('empty or whitespace-and-separator-only input yields an empty result', () => {
    for (const input of ['', '   \n', `${RECORD_SEPARATOR}\n${RECORD_SEPARATOR}`, `\n${RECORD_SEPARATOR}  \n`]) {
      const result = parseGitLog(input);
      assert.deepEqual(result, { commits: [], malformed: [], count: 0 });
    }
  });

  // Criterion 5
  test('message content is passed through untouched apart from framing', () => {
    const result = parseGitLog(basic);
    const rich = result.commits.find(c => c.sha === SHA5);
    assert.ok(rich);
    assert.equal(rich.message.breaking, true);
    assert.equal(rich.message.scope, 'parser');
    assert.equal(
      rich.message.body,
      'The old syntax allowed a colon without a space.\n\n    indented example\n    kept as is',
    );
    assert.deepEqual(rich.message.breakingNotes, ['colon must be followed by a space']);
    assert.deepEqual(rich.message.issueRefs, [4, 5]);
  });

  // Criterion 6
  test('count equals commits plus malformed', () => {
    const result = parseGitLog(basic);
    assert.equal(result.count, result.commits.length + result.malformed.length);
    assert.equal(result.count, 6);
  });

  // Criterion 7
  test('date is kept as a string and a non-ISO shape only produces a warning', () => {
    const result = parseGitLog(basic);
    const odd = result.commits.find(c => c.sha === '6'.repeat(40));
    assert.ok(odd);
    assert.equal(odd.date, 'Tue Nov 4 14:00:00 2026');
    assert.equal(odd.warnings.length, 1);
    assert.match(odd.warnings[0] ?? '', /ISO 8601/);
    const fine = result.commits.find(c => c.sha === SHA1);
    assert.deepEqual(fine?.warnings, []);
  });

  // Criterion 9 (fixture composition)
  test('fixture covers non-conventional and squash-merge records', () => {
    const result = parseGitLog(basic);
    const merge = result.commits.find(c => c.sha === '3'.repeat(40));
    assert.equal(merge?.message.conventional, false);
    const squash = result.commits.find(c => c.sha === '2'.repeat(40));
    assert.equal(squash?.message.prNumber, 1);
    assert.equal(squash?.message.subject, 'detect direct invocation');
  });

  test('only framing newlines are stripped; a space or tab before the SHA makes the record malformed', () => {
    const record = (prefix: string) =>
      `${prefix}${SHA1}${FIELD_SEPARATOR}A${FIELD_SEPARATOR}2026-01-01T00:00:00Z${FIELD_SEPARATOR}fix: a${RECORD_SEPARATOR}`;
    for (const framing of ['\n', '\r\n', '\n\n']) {
      const ok = parseGitLog(record(framing));
      assert.equal(ok.commits.length, 1, `framing ${JSON.stringify(framing)}`);
      assert.equal(ok.malformed.length, 0);
    }
    for (const junk of [' ', '\t', '\n ']) {
      const bad = parseGitLog(record(junk));
      assert.equal(bad.commits.length, 0, `prefix ${JSON.stringify(junk)}`);
      assert.equal(bad.malformed.length, 1);
      assert.match(bad.malformed[0]?.reason ?? '', /invalid sha/);
    }
  });

  test('a leading UTF-8 byte order mark (PowerShell pipes) is ignored', () => {
    const result = parseGitLog(`﻿${basic}`);
    assert.equal(result.commits.length, 5);
    assert.equal(result.malformed.length, 1);
    assert.equal(result.commits[0]?.sha, SHA1);
  });

  test('a message containing an extra field separator is kept whole', () => {
    const stream = `${SHA1}${FIELD_SEPARATOR}A${FIELD_SEPARATOR}2026-01-01T00:00:00Z${FIELD_SEPARATOR}fix: a${FIELD_SEPARATOR}b${RECORD_SEPARATOR}\n`;
    const result = parseGitLog(stream);
    assert.equal(result.commits[0]?.message.subject, `a${FIELD_SEPARATOR}b`);
  });
});
