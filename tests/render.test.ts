import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGitLog } from '../src/gitlog.ts';
import { groupGitLog } from '../src/group.ts';
import { groupCommits } from '../src/group.ts';
import { notesDocument, renderJson, renderMarkdown } from '../src/render.ts';
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
      `${URL_}/`, `${URL_}.git`, `${URL_}?a=b`, `${URL_}#frag`, ` ${URL_}`, `${URL_} `, `${URL_}\n`, `${URL_}\r\n`,
      'https://github.com:99999/o/r', 'https://github.com:0/o/r', 'https://github.com:65536/o/r',
      'http://github.com/a/b', 'https://github.com/a', 'https://github.com/a/b/c', '', 'github.com/a/b',
    ];
    for (const repoUrl of bad) {
      assert.throws(() => render(basic, repoUrl), (e: unknown) =>
        e instanceof RangeError && e.message.includes(JSON.stringify(repoUrl)), repoUrl);
    }
  });

  test('oversized PR number is not rendered as a rounded, wrong PR link', () => {
    const out = render(record(1, 'feat: big (#9007199254740993)'), URL_);
    assert.ok(!out.includes('/pull/'));
    assert.ok(!out.includes('9007199254740992'));
    assert.ok(out.includes('9007199254740993'));
  });

  test('criterion 7: valid forms accepted', () => {
    for (const repoUrl of [URL_, 'https://git.example.com:65535/o/r', 'https://git.example.com:8443/o/r.js', 'https://github.com/a/b.github.io']) {
      assert.doesNotThrow(() => render(basic, repoUrl));
    }
  });
});

// tickets/T-007-json-output.md
describe('notesDocument and renderJson', () => {
  const basic = fixture('log-basic.bin');
  const groupsOf = (stream: string) => groupGitLog(parseGitLog(stream));
  const json = (stream: string, repoUrl?: string) =>
    renderJson(groupsOf(stream), repoUrl === undefined ? {} : { repoUrl });

  const expectedEntry = (
    digit: string, scope: string | null, subject: string, prNumber: number | null, breakingNotes: string[], repoUrl?: string,
  ) => ({
    scope,
    subject,
    breakingNotes,
    source: {
      sha: digit.repeat(40),
      shortSha: digit.repeat(7),
      commitUrl: repoUrl === undefined ? null : `${repoUrl}/commit/${digit.repeat(40)}`,
      prNumber,
      prUrl: repoUrl === undefined || prNumber === null ? null : `${repoUrl}/pull/${prNumber}`,
    },
  });
  const expectedBasic = (repoUrl?: string) => ({
    schemaVersion: 1,
    title: 'Unreleased',
    sections: [
      { title: 'Breaking changes', entries: [expectedEntry('5', 'parser', 'drop legacy footer syntax', null, ['colon must be followed by a space'], repoUrl)] },
      { title: 'Features', entries: [expectedEntry('1', null, 'add parser', null, [], repoUrl)] },
      { title: 'Bug fixes', entries: [expectedEntry('2', 'cli', 'detect direct invocation', 1, [], repoUrl)] },
      { title: 'docs', entries: [expectedEntry('6', null, 'readme', null, [], repoUrl)] },
    ],
    counts: { shown: 4, total: 5, ignored: 1, malformed: 1 },
  });

  test('criterion 1: pure, exported from index, 2-space JSON with one trailing newline', () => {
    const groups = groupsOf(basic);
    assert.deepEqual(notesDocument(groups), notesDocument(groups));
    assert.equal(api.notesDocument, notesDocument);
    assert.equal(api.renderJson, renderJson);
    const out = renderJson(groups);
    assert.equal(out, `${JSON.stringify(notesDocument(groups), null, 2)}\n`);
    assert.ok(out.endsWith('}\n') && !out.endsWith('\n\n'));
    assert.ok(!out.includes('\r'));
    assert.ok(out.startsWith('{\n  "schemaVersion": 1,\n'));
  });

  test('criterion 1: the document shares no arrays with the groups', () => {
    const groups = groupsOf(record(2, 'feat: x\n\nBREAKING CHANGE: note\n'));
    const before = JSON.stringify(groups);
    const doc = notesDocument(groups);
    doc.sections[0]!.entries[0]!.breakingNotes.push('mutated');
    doc.sections.pop();
    assert.equal(JSON.stringify(groups), before);
  });

  test('criteria 2, 3, 6: exact document for the fixture without repoUrl', () => {
    assert.deepEqual(JSON.parse(json(basic)), expectedBasic());
  });

  test('criterion 3: exact document for the fixture with repoUrl', () => {
    assert.deepEqual(JSON.parse(json(basic, URL_)), expectedBasic(URL_));
  });

  test('criterion 2: key order is fixed at every level', () => {
    const doc = JSON.parse(json(basic, URL_));
    assert.deepEqual(Object.keys(doc), ['schemaVersion', 'title', 'sections', 'counts']);
    assert.deepEqual(Object.keys(doc.counts), ['shown', 'total', 'ignored', 'malformed']);
    for (const section of doc.sections) {
      assert.deepEqual(Object.keys(section), ['title', 'entries']);
      for (const entry of section.entries) {
        assert.deepEqual(Object.keys(entry), ['scope', 'subject', 'breakingNotes', 'source']);
        assert.deepEqual(Object.keys(entry.source), ['sha', 'shortSha', 'commitUrl', 'prNumber', 'prUrl']);
      }
    }
  });

  test('criterion 3: every entry has a 40-character sha, with and without repoUrl', () => {
    for (const repoUrl of [undefined, URL_]) {
      const doc = JSON.parse(json(basic, repoUrl));
      const entries = doc.sections.flatMap((s: { entries: unknown[] }) => s.entries);
      assert.equal(entries.length, 4);
      for (const entry of entries) assert.match(entry.source.sha, /^[0-9a-f]{40}$/);
    }
  });

  test('criterion 3: URLs are the ones the Markdown links use', () => {
    const groups = groupsOf(basic);
    const markdown = renderMarkdown(groups, { repoUrl: URL_ });
    for (const section of notesDocument(groups, { repoUrl: URL_ }).sections) {
      for (const { source } of section.entries) {
        assert.ok(markdown.includes(`[${source.shortSha}](${source.commitUrl})`));
        if (source.prNumber !== null) assert.ok(markdown.includes(`[#${source.prNumber}](${source.prUrl})`));
      }
    }
  });

  test('criterion 3: oversized PR number gives null prNumber and prUrl, subject keeps the text', () => {
    const doc = JSON.parse(json(record(1, 'feat: big (#9007199254740993)'), URL_));
    const entry = doc.sections[0].entries[0];
    assert.equal(entry.source.prNumber, null);
    assert.equal(entry.source.prUrl, null);
    assert.ok(entry.subject.includes('9007199254740993'));
  });

  test('criterion 4: sections and entries in the order Markdown prints them', () => {
    const stream = record(1, 'docs: d1') + record(2, 'fix: f1') + record(3, 'feat: a1') + record(4, 'no convention') +
      record(5, 'feat!: b1') + record(6, 'fix: f2') + record(7, 'chore: c1');
    const groups = groupsOf(stream);
    const doc = notesDocument(groups);
    assert.deepEqual(doc.sections.map(s => s.title), ['Breaking changes', 'Features', 'Bug fixes', 'chore', 'docs', 'Unclassified']);
    assert.deepEqual(doc.sections[2]!.entries.map(e => e.subject), ['f1', 'f2']);
    const markdown = renderMarkdown(groups);
    let at = -1;
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        const next = markdown.indexOf(`(\`${entry.source.shortSha}\`)`);
        assert.ok(next > at, entry.subject);
        at = next;
      }
    }
  });

  test('criterion 5: text is raw and round-trips through JSON.parse', () => {
    const subject = 'add [x](http://e) <b> * _ ` # | & ~ "q" \\ back \u0007 bell';
    const groups = groupsOf(record(1, `feat(a_b): ${subject}`) + record(2, 'fix!: y\n\nBREAKING CHANGE: a <i> *note*\n'));
    const text = renderJson(groups);
    const doc = JSON.parse(text);
    const feat = doc.sections.find((s: { title: string }) => s.title === 'Features').entries[0];
    assert.equal(feat.subject, subject);
    assert.equal(feat.scope, 'a_b');
    assert.deepEqual(doc.sections[0].entries[0].breakingNotes, ['a <i> *note*']);
    assert.ok(!text.includes('\\<') && !text.includes('\\*'));
    assert.ok(!text.includes('\u0007'));
  });

  test('criterion 5: nothing is trimmed', () => {
    const doc = JSON.parse(json(record(1, 'feat: spaced  out')));
    assert.equal(doc.sections[0].entries[0].subject, 'spaced  out');
  });

  test('criterion 6: count identities, and the numbers match the Markdown closing line', () => {
    const groups = groupsOf(basic);
    const { counts, sections } = notesDocument(groups);
    assert.equal(counts.shown, sections.reduce((n, s) => n + s.entries.length, 0));
    assert.equal(counts.shown + counts.ignored, counts.total);
    assert.equal(counts.total, groups.total);
    assert.equal(counts.malformed, groups.malformed.length);
    assert.ok(renderMarkdown(groups).includes(
      `_${counts.shown} of ${counts.total} commits shown; ${counts.ignored} merge commits ignored; ${counts.malformed} malformed records skipped._`,
    ));
  });

  test('criterion 7: merge-only range and empty input give a valid document', () => {
    assert.deepEqual(JSON.parse(json(record(1, 'Merge pull request #1 from a/b'))), {
      schemaVersion: 1, title: 'Unreleased', sections: [], counts: { shown: 0, total: 1, ignored: 1, malformed: 0 },
    });
    assert.deepEqual(JSON.parse(renderJson(groupCommits([]))), {
      schemaVersion: 1, title: 'Unreleased', sections: [], counts: { shown: 0, total: 0, ignored: 0, malformed: 0 },
    });
  });

  test('criterion 8: invalid repoUrl throws RangeError naming the value', () => {
    const groups = groupsOf(basic);
    for (const repoUrl of [`${URL_}/`, `${URL_}.git`, ` ${URL_}`, 'http://github.com/a/b', '']) {
      for (const call of [() => notesDocument(groups, { repoUrl }), () => renderJson(groups, { repoUrl })]) {
        assert.throws(call, (e: unknown) => e instanceof RangeError && e.message.includes(JSON.stringify(repoUrl)), repoUrl);
      }
    }
  });
});

// tickets/T-008-config-ignore-patterns.md
describe('render with ignore patterns', () => {
  const stream = fixture('log-basic.bin');
  const plain = groupGitLog(parseGitLog(stream));
  const ignoring = groupGitLog(parseGitLog(stream), { ignore: ['^docs', '^fix\\(cli\\)'] });

  test('criterion 6: no pattern match leaves the Markdown byte-identical', () => {
    const noMatch = groupGitLog(parseGitLog(stream), { ignore: ['^nothing matches this'] });
    assert.equal(renderMarkdown(noMatch), renderMarkdown(plain));
    assert.equal(renderJson(noMatch), renderJson(plain));
  });

  test('criterion 6: the closing line splits merge commits from commits ignored by config', () => {
    const out = renderMarkdown(ignoring);
    assert.ok(
      out.endsWith('\n\n_2 of 5 commits shown; 1 merge commits ignored; 2 ignored by config; 1 malformed records skipped._\n'),
      out,
    );
    assert.ok(!out.includes('readme'));
    assert.ok(!out.includes('detect direct invocation'));
  });

  test('criterion 6: only pattern matches, no merge commit', () => {
    const g = groupGitLog(parseGitLog(record(1, 'docs: a') + record(2, 'feat: b')), { ignore: ['^docs'] });
    assert.ok(renderMarkdown(g).endsWith('_1 of 2 commits shown; 0 merge commits ignored; 1 ignored by config; 0 malformed records skipped._\n'));
  });

  test('criterion 7: the JSON document keeps its keys; counts.ignored is merges plus matches', () => {
    const doc = notesDocument(ignoring);
    assert.deepEqual(Object.keys(doc), ['schemaVersion', 'title', 'sections', 'counts']);
    assert.equal(doc.schemaVersion, 1);
    assert.deepEqual(doc.counts, { shown: 2, total: 5, ignored: 3, malformed: 1 });
    assert.equal(doc.counts.shown + doc.counts.ignored, doc.counts.total);
    assert.deepEqual(doc.sections.map(s => s.title), ['Breaking changes', 'Features']);
  });
});
