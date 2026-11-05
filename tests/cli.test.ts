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
  const origOut = process.stdout.write;
  const origErr = process.stderr.write;
  let out = '';
  let err = '';
  process.stdout.write = ((c: string) => { out += c; return true; }) as typeof process.stdout.write;
  process.stderr.write = ((c: string) => { err += c; return true; }) as typeof process.stderr.write;
  try {
    const code = await main(argv, io);
    return { code, out, err };
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
}

describe('cli with a terminal stdin', () => {
  const failRead = async (): Promise<string> => { throw new Error('stdin must not be read'); };

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
