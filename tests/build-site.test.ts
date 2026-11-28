import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildSite, main, SITE_FILES } from '../scripts/build-site.ts';

// tickets/T-041-publish-own-notes.md
// The site is what tracenotes prints for the repository's own history, plus the commit it was
// built from. The build refuses anything it could not fully read instead of publishing it.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repoRoot, 'scripts', 'build-site.ts');
const cli = path.join(repoRoot, 'src', 'cli.ts');
const repoUrl = 'https://github.com/example/project';
const head = 'a'.repeat(40);
const older = 'b'.repeat(40);

const record = (sha: string, message: string) => `${sha}\u001fAda\u001f2026-11-27T10:00:00+00:00\u001f${message}\u001e\n`;
const stream = record(head, 'feat(render): add a thing (#7)') + record(older, 'fix: mend a thing');

function run(file: string, args: string[], input: string) {
  return spawnSync(process.execPath, [file, ...args], { input, encoding: 'utf8' });
}

function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'tracenotes-site-'));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('buildSite', () => {
  test('produces the four files, the notes exactly as render prints them (criterion 1)', () => {
    const files = buildSite({ stream, commit: head, repoUrl });
    assert.deepEqual([...files.keys()].sort(), [...SITE_FILES].sort());
    assert.deepEqual([...SITE_FILES].sort(), ['build.json', 'index.html', 'notes.json', 'notes.md']);

    const json = run(cli, ['render', '--format', 'json', '--repo-url', repoUrl], stream);
    const markdown = run(cli, ['render', '--format', 'markdown', '--repo-url', repoUrl], stream);
    assert.equal(json.status, 0);
    assert.equal(markdown.status, 0);
    assert.equal(files.get('notes.json'), json.stdout);
    assert.equal(files.get('notes.md'), markdown.stdout);
  });

  test('build.json names the commit and the number of commits, and no time (criterion 3)', () => {
    const files = buildSite({ stream, commit: head, repoUrl });
    assert.equal(files.get('build.json'), `${JSON.stringify({ schemaVersion: 1, commit: head, commits: 2 }, null, 2)}\n`);
    assert.deepEqual(buildSite({ stream, commit: head, repoUrl }), files);
  });

  test('index.html links the three files and holds nothing from the history (criterion 4)', () => {
    const one = buildSite({ stream, commit: head, repoUrl }).get('index.html')!;
    const other = buildSite({ stream: record(older, 'feat: <script>alert(1)</script>'), commit: older, repoUrl }).get('index.html');
    assert.equal(one, other);
    for (const name of ['notes.json', 'notes.md', 'build.json']) assert.ok(one.includes(`href="${name}"`), name);
  });

  test('refuses a stream without a commit (criterion 2)', () => {
    assert.throws(() => buildSite({ stream: '', commit: head, repoUrl }), /no commit/);
  });

  test('refuses a stream with a malformed record (criterion 2)', () => {
    const broken = stream + 'not a record\u001e\n';
    assert.throws(() => buildSite({ stream: broken, commit: head, repoUrl }), /1 malformed record/);
  });

  test('refuses a stream that does not start at the commit being published (criterion 2)', () => {
    assert.throws(
      () => buildSite({ stream, commit: older, repoUrl }),
      new RegExp(`starts at ${head}, not at ${older}`),
    );
  });

  // Qodo local review finding 7cb90af9: the parser drops a whitespace-only record (T-040) and reads
  // a last record without its terminator, so "no malformed record" did not mean "all of it read".
  test('refuses a stream whose records are not all commits (criterion 2)', () => {
    const [first, second] = [record(head, 'feat: a'), record(older, 'fix: b')];
    for (const blank of [' ', '\n', '\t\n', '']) {
      const extra = `${blank}\u001e\n`;
      for (const framed of [extra + first + second, first + extra + second, first + second + extra]) {
        assert.throws(() => buildSite({ stream: framed, commit: head, repoUrl }), /3 records but 2 commits/, JSON.stringify(framed));
      }
    }
  });

  test('refuses a stream that does not end with a terminated record (criterion 2)', () => {
    const cut = stream.slice(0, stream.lastIndexOf('\u001e'));
    for (const tail of [cut, `${stream}x`, `${stream}\n`, `${stream} `]) {
      assert.throws(() => buildSite({ stream: tail, commit: head, repoUrl }), /does not end with a record terminator/, JSON.stringify(tail));
    }
    assert.equal(buildSite({ stream: stream.replace(/\n$/, ''), commit: head, repoUrl }).size, 4);
  });

  test('refuses a repository URL that render rejects (criterion 2)', () => {
    assert.throws(() => buildSite({ stream, commit: head, repoUrl: `${repoUrl}.git` }), /invalid repoUrl/);
  });

  test('refuses a commit that is not 40 lower-case hex characters, as received (criterion 2)', () => {
    for (const commit of [` ${head}`, `${head}\n`, head.toUpperCase(), head.slice(1), '']) {
      assert.throws(() => buildSite({ stream, commit, repoUrl }), /invalid commit/, JSON.stringify(commit));
    }
  });
});

describe('build-site command', () => {
  const args = (dir: string) => ['--commit', head, '--repo-url', repoUrl, '--out', dir];

  test('writes the four files into a new directory (criteria 1, 5)', () => {
    inTempDir(dir => {
      const out = path.join(dir, 'site');
      const result = run(script, args(out), stream);
      assert.equal(result.stderr, '');
      assert.equal(result.status, 0);
      assert.deepEqual(readdirSync(out).sort(), [...SITE_FILES].sort());
      const files = buildSite({ stream, commit: head, repoUrl });
      for (const name of SITE_FILES) assert.equal(readFileSync(path.join(out, name), 'utf8'), files.get(name), name);
    });
  });

  test('a refusal prints one line, exits 1 and writes nothing (criterion 2)', () => {
    inTempDir(dir => {
      const out = path.join(dir, 'site');
      const result = run(script, args(out), stream + 'not a record\u001e\n');
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /^error: .*1 malformed record.*\n$/);
      assert.equal(existsSync(out), false);
    });
  });

  // Qodo local review finding 723eb8cd: mkdtemp makes its directory for the owner only, and
  // GitHub Pages refuses an artifact whose directory others cannot read. Windows has no such
  // mode bits, so there the test has nothing to check.
  test('the directory and its files are readable by everyone (criterion 5)', { skip: process.platform === 'win32' }, () => {
    inTempDir(dir => {
      const out = path.join(dir, 'site');
      const result = run(script, args(out), stream);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(statSync(out).mode & 0o777, 0o755);
      for (const name of SITE_FILES) {
        assert.equal(statSync(path.join(out, name)).mode & 0o777, 0o644, name);
      }
    });
  });

  // The build never writes into a directory it did not make, so it has nothing of anyone else's
  // to clean up (Qodo local review findings afdf2ca4 and 51e2696c).
  test('refuses an output directory that exists, empty or not (criterion 5)', () => {
    inTempDir(dir => {
      const empty = path.join(dir, 'empty');
      mkdirSync(empty);
      writeFileSync(path.join(dir, 'keep.txt'), 'mine');
      for (const out of [dir, empty, path.join(dir, 'keep.txt')]) {
        const result = run(script, args(out), stream);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /^error: output directory .* already exists\n$/);
      }
      assert.deepEqual(readdirSync(dir).sort(), ['empty', 'keep.txt']);
      assert.deepEqual(readdirSync(empty), []);
    });
  });

  test('does not create missing parent directories (criterion 5)', () => {
    inTempDir(dir => {
      const result = run(script, args(path.join(dir, 'a', 'b', 'site')), stream);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^error: cannot write to .*\n$/);
      assert.deepEqual(readdirSync(dir), []);
    });
  });

  // Qodo local review finding c03742ea: a write that fails part-way must not leave half a site.
  test('a write that fails part-way leaves nothing behind (criterion 5)', () => {
    inTempDir(dir => {
      const out = path.join(dir, 'new');
      let calls = 0;
      const result = main(args(out), Buffer.from(stream), (file, text) => {
        if (++calls === 3) throw new Error('disk full');
        writeFileSync(file, text);
      });
      assert.equal(result.code, 1);
      assert.match(result.stderr, /^error: cannot write to .*disk full\n$/);
      assert.equal(calls, 3);
      assert.deepEqual(readdirSync(dir), []);
    });
  });

  test('a stream with a leading byte order mark builds like the parser reads it (criterion 1)', () => {
    const files = buildSite({ stream: `\ufeff${stream}`, commit: head, repoUrl });
    assert.deepEqual(files, buildSite({ stream, commit: head, repoUrl }));
  });

  test('input that is not valid UTF-8 is refused, not repaired (criterion 2, rule 6)', () => {
    inTempDir(dir => {
      const out = path.join(dir, 'site');
      const bytes = Buffer.concat([Buffer.from(record(head, 'feat: a thing')), Buffer.from([0xff, 0x1e])]);
      const result = spawnSync(process.execPath, [script, ...args(out)], { input: bytes, encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^error: .*not valid UTF-8.*\n$/);
      assert.equal(existsSync(out), false);
    });
  });

  test('usage errors exit 2 and keep the value on one line (criteria 2, 5)', () => {
    inTempDir(dir => {
      const out = path.join(dir, 'site');
      const cases: string[][] = [
        [],
        ['--commit', head, '--repo-url', repoUrl],
        ['--commit', head, '--repo-url', repoUrl, '--out'],
        ['--commit', head, '--commit', head, '--repo-url', repoUrl, '--out', out],
        ['--commit', head, '--repo-url', repoUrl, '--out', out, '--force'],
        ['--commit', `${head}\nerror: forged`, '--repo-url', repoUrl, '--out', out],
      ];
      for (const argv of cases) {
        const result = run(script, argv, stream);
        assert.equal(result.status, 2, JSON.stringify(argv));
        assert.equal(result.stdout, '');
        assert.equal(result.stderr.split('\n').filter(line => line.startsWith('error:')).length, 1, result.stderr);
        assert.equal(existsSync(out), false);
      }
    });
  });
});
