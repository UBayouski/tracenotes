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

const USAGE = `tracenotes - release notes with receipts

Usage:
  tracenotes parse <message>    Parse a commit message and print JSON.
  tracenotes parse              Read the message from stdin.
  tracenotes --help             Show this help.
`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return command ? 0 : 2;
  }

  if (command === 'parse') {
    const message = rest.length > 0 ? rest.join(' ') : await readStdin();
    if (message.trim().length === 0) {
      process.stderr.write('error: empty commit message\n');
      return 2;
    }
    process.stdout.write(`${JSON.stringify(parseCommit(message), null, 2)}\n`);
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
