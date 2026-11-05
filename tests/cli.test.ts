import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

  test('--help exits 0 and prints usage', () => {
    const { code, stdout } = runCli(['--help']);
    assert.equal(code, 0);
    assert.match(stdout, /Usage:/);
  });
});
