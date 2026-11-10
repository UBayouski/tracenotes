import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { main } from '../src/cli.ts';

// These tests run the CLI as a real child process, which is the only way to
// cover the "invoked directly" entry check across platforms. No network, no git.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(repoRoot, 'src', 'cli.ts');

function runCli(args: string[], input?: string) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: input ?? '',
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('cli', () => {
  test('parse with an argument prints JSON and exits 0', () => {
    const { code, stdout, stderr } = runCli(['parse', 'feat(cli): add parse command (#42)']);
    assert.equal(code, 0, stderr);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.type, 'feat');
    assert.equal(parsed.scope, 'cli');
    assert.equal(parsed.prNumber, 42);
  });

  test('parse reads the message from stdin when no argument is given', () => {
    const { code, stdout } = runCli(['parse'], 'fix: from stdin\n\nRefs: #3\n');
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.subject, 'from stdin');
    assert.deepEqual(parsed.issueRefs, [3]);
  });

  test('empty input exits 2 with an error', () => {
    const { code, stdout, stderr } = runCli(['parse'], '');
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /empty commit message/);
  });

  test('unknown command exits 2 and prints usage', () => {
    const { code, stderr } = runCli(['bogus']);
    assert.equal(code, 2);
    assert.match(stderr, /unknown command "bogus"/);
    assert.match(stderr, /Usage:/);
  });

  // T-002 criterion 8
  test('log parses a stream from stdin, reports malformed records, and exits 0', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const { code, stdout } = runCli(['log'], stream);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.count, 6);
    assert.equal(result.commits.length, 5);
    assert.equal(result.malformed.length, 1);
  });

  test('log with empty stdin exits 2', () => {
    const { code, stderr } = runCli(['log'], '');
    assert.equal(code, 2);
    assert.match(stderr, /empty git log stream/);
  });

  // T-003 criterion 8
  test('group prints ReleaseGroups, passes malformed through, exits 0', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const { code, stdout } = runCli(['group'], stream);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.total, 5);
    assert.equal(result.malformed.length, 1);
    assert.equal(result.ignored.length, 1);
    assert.equal(result.sections[0].title, 'Breaking changes');
  });

  test('group with empty stdin exits 2', () => {
    const { code, stdout, stderr } = runCli(['group'], '');
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /empty git log stream/);
  });

  // T-004 criterion 8
  test('render prints Markdown with and without --repo-url, exits 0', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const plain = runCli(['render'], stream);
    assert.equal(plain.code, 0, plain.stderr);
    assert.ok(plain.stdout.startsWith('## Unreleased\n'));
    assert.match(plain.stdout, /\(`2222222`, #1\)/);
    const url = 'https://github.com/UBayouski/tracenotes';
    const linked = runCli(['render', '--repo-url', url], stream);
    assert.equal(linked.code, 0, linked.stderr);
    assert.ok(linked.stdout.includes(`[#1](${url}/pull/1)`));
  });

  test('render rejects an invalid URL, a missing value and unknown options with nothing on stdout', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    for (const args of [['--repo-url', 'https://github.com/a/b/'], ['--repo-url'], ['--bogus']]) {
      const { code, stdout, stderr } = runCli(['render', ...args], stream);
      assert.equal(code, 2, args.join(' '));
      assert.equal(stdout, '');
      assert.match(stderr, /^error: /);
    }
    assert.match(runCli(['render', '--repo-url', 'http://x/a/b'], stream).stderr, /http:\/\/x\/a\/b/);
  });

  test('render with empty stdin exits 2', () => {
    const { code, stdout, stderr } = runCli(['render'], '');
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /empty git log stream/);
    assert.match(stderr, /Usage:/);
  });

  // T-005 criterion 7
  test('version prints the recommendation as JSON and exits 0', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const { code, stdout, stderr } = runCli(['version', '--current', '1.4.2'], stream);
    assert.equal(code, 0, stderr);
    assert.ok(stdout.endsWith('}\n') && !stdout.endsWith('\n\n'));
    const r = JSON.parse(stdout);
    assert.equal(stdout, `${JSON.stringify(r, null, 2)}\n`);
    assert.equal(r.next, '2.0.0');
    assert.equal(r.rule.id, 'breaking');
    assert.equal(r.triggers[0].shortSha, '5555555');
  });

  test('version rejects bad arguments with nothing on stdout, before reading stdin', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    for (const args of [[], ['--current'], ['--current', 'v1.2.3'], ['--current', '1.2.3 '], ['--current', '1.2.3', '--bogus']]) {
      const { code, stdout, stderr } = runCli(['version', ...args], stream);
      assert.equal(code, 2, args.join(' '));
      assert.equal(stdout, '');
      assert.match(stderr, /^error: /);
    }
    assert.match(runCli(['version', '--current', 'v1.2.3'], stream).stderr, /v1\.2\.3/);
  });

  test('version with empty stdin exits 2 with usage', () => {
    const { code, stdout, stderr } = runCli(['version', '--current', '1.0.0'], '');
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /Usage:/);
  });

  test('usage lists the version command', () => {
    assert.match(runCli(['--help']).stdout, /tracenotes version --current <x\.y\.z>/);
  });

  test('--help exits 0 and prints usage', () => {
    const { code, stdout } = runCli(['--help']);
    assert.equal(code, 0);
    assert.match(stdout, /Usage:/);
  });

  test('piped stdin still parses (T-026 criterion 3)', () => {
    const { code, stdout } = runCli(['parse'], 'feat(x): piped\n');
    assert.equal(code, 0);
    assert.equal(JSON.parse(stdout).subject, 'piped');
  });
});

// T-026: terminal branch via injected io (no pseudo-terminal needed).
async function runMain(argv: string[], io: { stdinIsTTY: boolean; readStdin: () => Promise<string> }) {
  let out = '';
  let err = '';
  const code = await main(argv, {
    ...io,
    stdout: text => { out += text; },
    stderr: text => { err += text; },
  });
  return { code, out, err };
}

describe('cli with a terminal stdin', () => {
  const failRead = async (): Promise<string> => { throw new Error('stdin must not be read'); };

  test('render validates --repo-url before reading stdin', async () => {
    const { code, err } = await runMain(['render', '--repo-url', 'https://github.com:99999/o/r'], { stdinIsTTY: false, readStdin: failRead });
    assert.equal(code, 2);
    assert.match(err, /invalid repoUrl/);
  });

  test('parse without argument prints error and usage, exits 2, does not read stdin', async () => {
    const { code, err } = await runMain(['parse'], { stdinIsTTY: true, readStdin: failRead });
    assert.equal(code, 2);
    assert.match(err, /^error: no commit message given and stdin is a terminal\n/);
    assert.match(err, /Usage:/);
  });

  test('log prints error and usage, exits 2, does not read stdin', async () => {
    const { code, err } = await runMain(['log'], { stdinIsTTY: true, readStdin: failRead });
    assert.equal(code, 2);
    assert.match(err, /^error: no git log stream on stdin \(stdin is a terminal\)\n/);
    assert.match(err, /Usage:/);
  });

  test('group prints error and usage, exits 2, does not read stdin', async () => {
    const { code, err } = await runMain(['group'], { stdinIsTTY: true, readStdin: failRead });
    assert.equal(code, 2);
    assert.match(err, /^error: no git log stream on stdin \(stdin is a terminal\)\n/);
    assert.match(err, /Usage:/);
  });

  test('render prints error and usage, exits 2, does not read stdin', async () => {
    const { code, err, out } = await runMain(['render'], { stdinIsTTY: true, readStdin: failRead });
    assert.equal(code, 2);
    assert.equal(out, '');
    assert.match(err, /^error: no git log stream on stdin \(stdin is a terminal\)\n/);
    assert.match(err, /Usage:/);
  });

  test('version prints error and usage on a terminal, does not read stdin', async () => {
    const { code, err, out } = await runMain(['version', '--current', '1.0.0'], { stdinIsTTY: true, readStdin: failRead });
    assert.equal(code, 2);
    assert.equal(out, '');
    assert.match(err, /^error: no git log stream on stdin \(stdin is a terminal\)\n/);
    assert.match(err, /Usage:/);
  });

  test('version validates --current before reading stdin', async () => {
    const { code, err } = await runMain(['version', '--current', '01.2.3'], { stdinIsTTY: false, readStdin: failRead });
    assert.equal(code, 2);
    assert.match(err, /01\.2\.3/);
  });

  test('parse with an argument never consults stdin', async () => {
    for (const stdinIsTTY of [true, false]) {
      const { code, out } = await runMain(['parse', 'fix: arg'], { stdinIsTTY, readStdin: failRead });
      assert.equal(code, 0);
      assert.equal(JSON.parse(out).subject, 'arg');
    }
  });

  test('usage says stdin is read only when not a terminal', async () => {
    const { out } = await runMain(['--help'], { stdinIsTTY: true, readStdin: failRead });
    assert.match(out, /read stdin only when it is not a terminal/);
  });
});
