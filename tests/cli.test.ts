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

  // T-007 criterion 9
  test('render --format json prints the notes document, with and without --repo-url', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const plain = runCli(['render', '--format', 'json'], stream);
    assert.equal(plain.code, 0, plain.stderr);
    assert.equal(plain.stderr, '');
    assert.ok(plain.stdout.endsWith('}\n'));
    const doc = JSON.parse(plain.stdout);
    assert.equal(doc.schemaVersion, 1);
    assert.deepEqual(doc.counts, { shown: 4, total: 5, ignored: 1, malformed: 1 });
    assert.equal(doc.sections[2].entries[0].source.sha, '2'.repeat(40));
    assert.equal(doc.sections[2].entries[0].source.commitUrl, null);
    const url = 'https://github.com/UBayouski/tracenotes';
    for (const args of [['--format', 'json', '--repo-url', url], ['--repo-url', url, '--format', 'json']]) {
      const linked = runCli(['render', ...args], stream);
      assert.equal(linked.code, 0, linked.stderr);
      const source = JSON.parse(linked.stdout).sections[2].entries[0].source;
      assert.equal(source.commitUrl, `${url}/commit/${'2'.repeat(40)}`);
      assert.equal(source.prUrl, `${url}/pull/1`);
    }
  });

  test('render output is Markdown by default and with --format markdown; the last --format wins', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const byDefault = runCli(['render'], stream);
    const explicit = runCli(['render', '--format', 'markdown'], stream);
    assert.equal(explicit.code, 0, explicit.stderr);
    assert.ok(explicit.stdout.startsWith('## Unreleased\n'));
    assert.equal(explicit.stdout, byDefault.stdout);
    assert.equal(runCli(['render', '--format', 'json', '--format', 'markdown'], stream).stdout, byDefault.stdout);
    assert.equal(
      runCli(['render', '--format', 'markdown', '--format', 'json'], stream).stdout,
      runCli(['render', '--format', 'json'], stream).stdout,
    );
  });

  test('render rejects an invalid, wrong-case, padded or missing --format with nothing on stdout', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    for (const value of ['yaml', 'JSON', 'Json', ' json', 'json ', '', 'md']) {
      const { code, stdout, stderr } = runCli(['render', '--format', value], stream);
      assert.equal(code, 2, JSON.stringify(value));
      assert.equal(stdout, '');
      assert.ok(stderr.startsWith(`error: invalid --format ${JSON.stringify(value)}: expected markdown or json\n`), stderr);
    }
    const missing = runCli(['render', '--format'], stream);
    assert.equal(missing.code, 2);
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /^error: --format needs a value/);
  });

  // Qodo local review finding 277d5eae: only the last --format value counts, like --repo-url.
  test('render: an invalid --format before a valid one is overridden; an invalid last one fails', () => {
    const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
    const overridden = runCli(['render', '--format', 'yaml', '--format', 'json'], stream);
    assert.equal(overridden.code, 0, overridden.stderr);
    assert.equal(overridden.stderr, '');
    assert.equal(overridden.stdout, runCli(['render', '--format', 'json'], stream).stdout);
    const toMarkdown = runCli(['render', '--format', 'JSON', '--format', 'markdown'], stream);
    assert.equal(toMarkdown.code, 0, toMarkdown.stderr);
    assert.equal(toMarkdown.stdout, runCli(['render'], stream).stdout);
    for (const args of [['--format', 'json', '--format', 'yaml'], ['--format', 'json', '--format']]) {
      const { code, stdout, stderr } = runCli(['render', ...args], stream);
      assert.equal(code, 2, args.join(' '));
      assert.equal(stdout, '');
      assert.match(stderr, /^error: /);
    }
  });

  test('render --format json with empty stdin exits 2', () => {
    const { code, stdout, stderr } = runCli(['render', '--format', 'json'], '');
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /empty git log stream/);
  });

  test('usage documents --format', () => {
    assert.match(runCli(['--help']).stdout, /tracenotes render \[--repo-url <url>\] \[--format markdown\|json\]/);
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

// tickets/T-008-config-ignore-patterns.md criterion 9
describe('cli --config', () => {
  const stream = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'log-basic.bin'), 'utf8');
  const cfg = (name: string) => path.join('tests', 'fixtures', name);
  const commands: string[][] = [['group'], ['render'], ['version', '--current', '1.4.2']];

  test('group lists commits ignored by config with their pattern', () => {
    const { code, stdout, stderr } = runCli(['group', '--config', cfg('config-ignore-docs.json')], stream);
    assert.equal(code, 0, stderr);
    assert.equal(stderr, '');
    const result = JSON.parse(stdout);
    assert.deepEqual(result.ignored.map((e: { reason: string }) => e.reason), ['merge commit', 'ignore pattern: ^docs']);
    assert.equal(result.total, 5);
    assert.ok(!result.sections.some((s: { title: string }) => s.title === 'docs'));
  });

  test('render counts commits ignored by config in Markdown and JSON', () => {
    const md = runCli(['render', '--config', cfg('config-ignore-docs.json')], stream);
    assert.equal(md.code, 0, md.stderr);
    assert.ok(md.stdout.endsWith('_3 of 5 commits shown; 1 merge commits ignored; 1 ignored by config; 1 malformed records skipped._\n'), md.stdout);
    const json = runCli(['render', '--format', 'json', '--config', cfg('config-ignore-docs.json')], stream);
    assert.equal(json.code, 0, json.stderr);
    assert.deepEqual(JSON.parse(json.stdout).counts, { shown: 3, total: 5, ignored: 2, malformed: 1 });
  });

  test('version ignores matching commits but never a breaking one', () => {
    const { code, stdout, stderr } = runCli(['version', '--current', '1.4.2', '--config', cfg('config-ignore-fix.json')], stream);
    assert.equal(code, 0, stderr);
    const r = JSON.parse(stdout);
    // The fixture's breaking commit is `feat(parser)!`, which matches ^feat and must still count.
    assert.equal(r.next, '2.0.0');
    assert.equal(r.rule.id, 'breaking');
    assert.equal(r.counts.ignored, 3);
  });

  test('without --config the output is what it was', () => {
    for (const command of commands) {
      const bom = runCli([...command, '--config', cfg('config-bom.json')], stream);
      assert.equal(bom.code, 0, bom.stderr);
      // ' ^docs' (leading space kept) matches nothing, so the result equals a run without config.
      assert.equal(bom.stdout, runCli(command, stream).stdout, command.join(' '));
    }
  });

  test('a missing value, a missing file and invalid files exit 2 with one error line naming the path', () => {
    const bad: [string, RegExp][] = [
      ['does-not-exist.json', /^error: cannot read config "tests[\\/]+fixtures[\\/]+does-not-exist\.json": .*ENOENT/],
      ['config-not-json.json', /^error: config "[^"]+config-not-json\.json": invalid config: not valid JSON/],
      ['config-unknown-key.json', /^error: config "[^"]+config-unknown-key\.json": invalid config: unknown key "sections"/],
      ['config-bad-regex.json', /^error: config "[^"]+config-bad-regex\.json": invalid config: ignore\[1\] is not a valid regular expression/],
    ];
    for (const command of commands) {
      const missing = runCli([...command, '--config'], stream);
      assert.equal(missing.code, 2, command.join(' '));
      assert.equal(missing.stdout, '');
      assert.equal(missing.stderr, 'error: --config needs a value\n');
      for (const [name, pattern] of bad) {
        const { code, stdout, stderr } = runCli([...command, '--config', cfg(name)], stream);
        assert.equal(code, 2, `${command.join(' ')} ${name}`);
        assert.equal(stdout, '');
        assert.match(stderr, pattern);
        assert.equal(stderr.trimEnd().split('\n').length, 1, stderr);
      }
    }
  });

  test('a directory given as the config file is an error, not a crash', () => {
    const { code, stdout, stderr } = runCli(['render', '--config', path.join('tests', 'fixtures')], stream);
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /^error: cannot read config /);
  });

  test('when --config is repeated only the last file is read', () => {
    for (const command of commands) {
      const last = runCli([...command, '--config', 'does-not-exist.json', '--config', cfg('config-ignore-docs.json')], stream);
      assert.equal(last.code, 0, last.stderr);
      assert.equal(last.stdout, runCli([...command, '--config', cfg('config-ignore-docs.json')], stream).stdout);
      const bad = runCli([...command, '--config', cfg('config-ignore-docs.json'), '--config', cfg('config-not-json.json')], stream);
      assert.equal(bad.code, 2, command.join(' '));
      assert.equal(bad.stdout, '');
    }
  });

  test('group now rejects an unknown argument with usage', () => {
    for (const args of [['--bogus'], ['extra'], ['--config', cfg('config-ignore-docs.json'), '--repo-url', 'x']]) {
      const { code, stdout, stderr } = runCli(['group', ...args], stream);
      assert.equal(code, 2, args.join(' '));
      assert.equal(stdout, '');
      assert.match(stderr, /^error: unknown option /);
      assert.match(stderr, /Usage:/);
    }
  });

  // Qodo local review finding e7cc6b40: bytes that are not UTF-8 must not be replaced and accepted.
  test('a config file that is not valid UTF-8 is rejected, not repaired', () => {
    for (const command of commands) {
      const { code, stdout, stderr } = runCli([...command, '--config', cfg('config-invalid-utf8.json')], stream);
      assert.equal(code, 2, command.join(' '));
      assert.equal(stdout, '');
      assert.match(stderr, /^error: cannot read config "[^"]+config-invalid-utf8\.json": the file is not valid UTF-8\n$/);
    }
  });

  // Qodo local review finding 9f986931: the diagnostic stays one line whatever the path or file holds.
  test('a newline in the path or in the file cannot add lines to the error', () => {
    const forged = runCli(['render', '--config', 'nope\nerror: forged line'], stream);
    assert.equal(forged.code, 2);
    assert.equal(forged.stdout, '');
    assert.match(forged.stderr, /^error: cannot read config "nope\\nerror: forged line": /);
    assert.equal(forged.stderr.trimEnd().split('\n').length, 1, forged.stderr);
    const multiline = runCli(['render', '--config', cfg('config-not-json-multiline.json')], stream);
    assert.equal(multiline.code, 2);
    assert.match(multiline.stderr, /^error: config "[^"]+": invalid config: not valid JSON/);
    assert.equal(multiline.stderr.trimEnd().split('\n').length, 1, multiline.stderr);
  });

  test('usage documents --config on group, render and version', () => {
    const usage = runCli(['--help']).stdout;
    assert.match(usage, /tracenotes group \[--config <path>\]/);
    assert.match(usage, /tracenotes render \[--repo-url <url>\] \[--format markdown\|json\] \[--config <path>\]/);
    assert.match(usage, /tracenotes version --current <x\.y\.z> \[--config <path>\]/);
    assert.match(usage, /No config file is read unless --config is given/);
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

  test('render validates --format before reading stdin (T-007 criterion 9)', async () => {
    const { code, err, out } = await runMain(['render', '--format', 'yaml'], { stdinIsTTY: false, readStdin: failRead });
    assert.equal(code, 2);
    assert.equal(out, '');
    assert.match(err, /invalid --format "yaml"/);
  });

  test('render --format json on a terminal prints error and usage, does not read stdin', async () => {
    const { code, err, out } = await runMain(['render', '--format', 'json'], { stdinIsTTY: true, readStdin: failRead });
    assert.equal(code, 2);
    assert.equal(out, '');
    assert.match(err, /Usage:/);
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

// tickets/T-008-config-ignore-patterns.md criteria 9 and 10: the config is read through CliIo,
// after the other options and before stdin.
describe('cli --config with an injected reader', () => {
  const failRead = async (): Promise<string> => { throw new Error('stdin must not be read'); };
  const failFile = (): string => { throw new Error('the config file must not be read'); };
  const commands: string[][] = [['group'], ['render'], ['version', '--current', '1.0.0']];

  async function run(argv: string[], readFile: (path: string) => string, readStdin: () => Promise<string> = failRead) {
    let out = '';
    let err = '';
    const code = await main(argv, {
      stdinIsTTY: false,
      readStdin,
      readFile,
      stdout: text => { out += text; },
      stderr: text => { err += text; },
    });
    return { code, out, err };
  }

  test('an invalid config fails before stdin is read', async () => {
    for (const command of commands) {
      const { code, out, err } = await run([...command, '--config', 'c.json'], () => '{"ignore": [""]}');
      assert.equal(code, 2, command.join(' '));
      assert.equal(out, '');
      assert.equal(err, 'error: config "c.json": invalid config: ignore[0] is an empty pattern, which would match every commit\n');
    }
  });

  test('an unreadable config fails before stdin is read', async () => {
    const denied = (): string => { throw new Error('EACCES: permission denied'); };
    const { code, err } = await run(['render', '--config', 'c.json'], denied);
    assert.equal(code, 2);
    assert.equal(err, 'error: cannot read config "c.json": EACCES: permission denied\n');
  });

  // Qodo local review finding 9f986931, without a file system: reader and parser messages.
  test('control characters in a reader or parser message are escaped, one line out', async () => {
    const thrower = (): string => { throw new Error('first\nerror: second\r\u001b[31m\u2028x'); };
    const read = await run(['group', '--config', 'c.json'], thrower);
    assert.equal(read.code, 2);
    assert.equal(read.err, 'error: cannot read config "c.json": first\\u000aerror: second\\u000d\\u001b[31m\\u2028x\n');
    const regex = await run(['group', '--config', 'c.json'], () => '{"ignore": ["a\\nb("]}');
    assert.equal(regex.code, 2);
    assert.equal(regex.err.trimEnd().split('\n').length, 1, regex.err);
    assert.match(regex.err, /^error: config "c\.json": invalid config: ignore\[0\] is not a valid regular expression: "a\\nb\("/);
  });

  test('the config is not read when another option is invalid, or without --config', async () => {
    const badFormat = await run(['render', '--format', 'yaml', '--config', 'c.json'], failFile);
    assert.equal(badFormat.code, 2);
    assert.match(badFormat.err, /invalid --format/);
    const badVersion = await run(['version', '--current', 'v1', '--config', 'c.json'], failFile);
    assert.equal(badVersion.code, 2);
    assert.match(badVersion.err, /invalid version/);
    const stdin = async () => '1'.repeat(40) + '\u001fA\u001f2026-11-01T00:00:00Z\u001ffeat: a\u001e\n';
    const none = await run(['group'], failFile, stdin);
    assert.equal(none.code, 0, none.err);
  });

  test('only the last --config path is passed to the reader, exactly as given', async () => {
    const seen: string[] = [];
    const reader = (p: string): string => { seen.push(p); return '{"ignore": ["^feat"]}'; };
    const stdin = async () => '1'.repeat(40) + '\u001fA\u001f2026-11-01T00:00:00Z\u001ffeat: a\u001e\n';
    const { code, out } = await run(['group', '--config', 'first.json', '--config', ' second.json '], reader, stdin);
    assert.equal(code, 0);
    assert.deepEqual(seen, [' second.json ']);
    assert.equal(JSON.parse(out).ignored[0].reason, 'ignore pattern: ^feat');
  });
  // Qodo PR review finding fa44bb08: the path itself, beyond what JSON.stringify escapes.
  test('DEL, C1 controls and line separators in the path are escaped in both error lines', async () => {
    const path = 'a\u007fb\u0085c\u2028d\u2029e.json';
    const shown = '"a\\u007fb\\u0085c\\u2028d\\u2029e.json"';
    const denied = (): string => { throw new Error('EACCES: permission denied'); };
    const read = await run(['group', '--config', path], denied);
    assert.equal(read.code, 2);
    assert.equal(read.err, `error: cannot read config ${shown}: EACCES: permission denied\n`);
    const parsed = await run(['group', '--config', path], () => '[]');
    assert.equal(parsed.code, 2);
    assert.ok(parsed.err.startsWith(`error: config ${shown}: invalid config: `), parsed.err);
    assert.doesNotMatch(parsed.err, /[\u007f-\u009f\u2028\u2029]/);
  });
});
