#!/usr/bin/env node
/**
 * tracenotes command line.
 *
 *   tracenotes parse "<commit message>"   Parse one message given as an argument.
 *   tracenotes parse < message.txt        Parse one message from stdin.
 *   tracenotes --help
 *
 * Exit codes: 0 success, 2 usage error.
 * This is the only module allowed to call process.exit or write to stdout/stderr directly.
 */
import { pathToFileURL } from 'node:url';
import { parseCommit } from './commit.ts';
import { parseGitLog } from './gitlog.ts';

const USAGE = `tracenotes - release notes with receipts

Usage:
  tracenotes parse <message>    Parse a commit message and print JSON.
  tracenotes parse              Read the message from stdin.
  tracenotes log                Parse a git log stream from stdin and print JSON.
                                Produce it with:
                                git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' <range>
  tracenotes --help             Show this help.

parse (without a message) and log read stdin only when it is not a terminal.
Pipe or redirect input to them; in an interactive shell they print this usage and exit 2.
`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Process input seen by the CLI; injectable so the terminal branch is testable without a pty. */
export interface CliIo {
  stdinIsTTY: boolean;
  readStdin: () => Promise<string>;
}

const defaultIo: CliIo = {
  get stdinIsTTY() { return process.stdin.isTTY === true; },
  readStdin,
};

/**
 * Runs the CLI. Inputs: argv without the node/script entries, and an optional `io`
 * (defaults to the real process stdin). Returns the exit code (0 ok, 2 usage error);
 * never reads stdin when a message argument is given or when stdin is a terminal.
 */
export async function main(argv: string[], io: CliIo = defaultIo): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return command ? 0 : 2;
  }

  if (command === 'parse') {
    if (rest.length === 0 && io.stdinIsTTY) {
      process.stderr.write(`error: no commit message given and stdin is a terminal\n\n${USAGE}`);
      return 2;
    }
    const message = rest.length > 0 ? rest.join(' ') : await io.readStdin();
    if (message.trim().length === 0) {
      process.stderr.write('error: empty commit message\n');
      return 2;
    }
    process.stdout.write(`${JSON.stringify(parseCommit(message), null, 2)}\n`);
    return 0;
  }

  if (command === 'log') {
    if (io.stdinIsTTY) {
      process.stderr.write(`error: no git log stream on stdin (stdin is a terminal)\n\n${USAGE}`);
      return 2;
    }
    const stream = await io.readStdin();
    if (stream.trim().length === 0) {
      process.stderr.write('error: empty git log stream on stdin\n');
      return 2;
    }
    // Malformed records are reported in the output, not as a failure: nothing vanishes.
    process.stdout.write(`${JSON.stringify(parseGitLog(stream), null, 2)}\n`);
    return 0;
  }

  process.stderr.write(`error: unknown command "${command}"\n\n${USAGE}`);
  return 2;
}

// pathToFileURL handles both POSIX paths and Windows drive letters; a hand-built
// `file:///` prefix does not, because POSIX paths already start with `/`.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
