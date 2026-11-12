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
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseCommit } from './commit.ts';
import { parseConfig } from './config.ts';
import type { Config } from './config.ts';
import { parseGitLog } from './gitlog.ts';
import { groupGitLog } from './group.ts';
import { checkRepoUrl, renderJson, renderMarkdown } from './render.ts';
import { parseVersion, recommendVersion } from './version.ts';

const USAGE = `tracenotes - release notes with receipts

Usage:
  tracenotes parse <message>    Parse a commit message and print JSON.
  tracenotes parse              Read the message from stdin.
  tracenotes log                Parse a git log stream from stdin and print JSON.
                                Produce it with:
                                git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' <range>
  tracenotes group [--config <path>]
                                Group a git log stream (same input as log) into
                                release-note sections and print JSON.
  tracenotes render [--repo-url <url>] [--format markdown|json] [--config <path>]
                                Render a git log stream (same input as log) as
                                Markdown release notes. With --repo-url
                                https://<host>/<owner>/<repo>, SHAs and PRs are links.
                                With --format json, print the same notes as a JSON
                                document: sections, entries with their source, counts.
  tracenotes version --current <x.y.z> [--config <path>]
                                Recommend the next version from a git log stream
                                (same input as log) and print JSON with the rule
                                and the commits that triggered it.
  tracenotes --help             Show this help.

--config <path> names a JSON file such as {"ignore": ["^chore\\\\(deps\\\\)"]}. Each pattern is a
regular expression tested against the first line of a commit message. A commit that matches is
left out of the notes and counted as ignored; group lists it with the pattern. A breaking change
is never ignored. No config file is read unless --config is given.

parse (without a message), log, group, render and version read stdin only when it is not a terminal.
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
  /** Where normal output goes; defaults to process.stdout. */
  stdout?: (text: string) => void;
  /** Where errors go; defaults to process.stderr. */
  stderr?: (text: string) => void;
  /**
   * Reads the --config file as text; defaults to the file system with strict UTF-8 decoding.
   * Throws when the file cannot be read or decoded.
   */
  readFile?: (path: string) => string;
}

/**
 * Read and parse the file given with --config. Inputs: the path as given (undefined when the
 * option is absent) and the reader. Returns the config (no patterns without a path), or
 * `{ error }` with one line that names the path and the problem. Never throws for a missing,
 * unreadable or invalid file.
 */
function loadConfig(configPath: string | undefined, readFile: (path: string) => string): Config | { error: string } {
  if (configPath === undefined) return { ignore: [] };
  let text: string;
  try {
    text = readFile(configPath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `error: cannot read config ${JSON.stringify(configPath)}: ${oneLine(detail)}\n` };
  }
  try {
    return parseConfig(text);
  } catch (error) {
    if (error instanceof RangeError) {
      return { error: `error: config ${JSON.stringify(configPath)}: ${oneLine(error.message)}\n` };
    }
    throw error;
  }
}

/**
 * Escape control characters and line separators as `\uXXXX` so a message built from a path, a
 * system error or file content stays on one line and cannot forge a second `error:` line.
 * Only adds characters; printable text is returned unchanged.
 */
function oneLine(text: string): string {
  return text.replace(
    /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,
    ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * Default config reader: the file's bytes decoded as strict UTF-8. Throws the system error when
 * the file cannot be read, and an Error when the bytes are not valid UTF-8; invalid bytes are
 * never replaced (Validate Before You Normalize). A leading byte order mark is kept for
 * `parseConfig`, which owns that piece of framing.
 */
function readConfigFile(path: string): string {
  const bytes = readFileSync(path);
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('the file is not valid UTF-8');
  }
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
  const stdout = io.stdout ?? ((text: string) => { process.stdout.write(text); });
  const stderr = io.stderr ?? ((text: string) => { process.stderr.write(text); });
  const readFile = io.readFile ?? readConfigFile;
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    stdout(USAGE);
    return command ? 0 : 2;
  }

  if (command === 'parse') {
    if (rest.length === 0 && io.stdinIsTTY) {
      stderr(`error: no commit message given and stdin is a terminal\n\n${USAGE}`);
      return 2;
    }
    const message = rest.length > 0 ? rest.join(' ') : await io.readStdin();
    if (message.trim().length === 0) {
      stderr('error: empty commit message\n');
      return 2;
    }
    stdout(`${JSON.stringify(parseCommit(message), null, 2)}\n`);
    return 0;
  }

  if (command === 'log') {
    if (io.stdinIsTTY) {
      stderr(`error: no git log stream on stdin (stdin is a terminal)\n\n${USAGE}`);
      return 2;
    }
    const stream = await io.readStdin();
    if (stream.trim().length === 0) {
      stderr('error: empty git log stream on stdin\n');
      return 2;
    }
    // Malformed records are reported in the output, not as a failure: nothing vanishes.
    stdout(`${JSON.stringify(parseGitLog(stream), null, 2)}\n`);
    return 0;
  }

  if (command === 'group') {
    let configPath: string | undefined;
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i]!;
      if (arg === '--config') {
        const value = rest[++i];
        if (value === undefined) {
          stderr('error: --config needs a value\n');
          return 2;
        }
        // A repeated option overrides the earlier one, so only the last file is read.
        configPath = value;
      } else {
        stderr(`error: unknown option "${arg}"\n\n${USAGE}`);
        return 2;
      }
    }
    // The config is read before stdin so a bad file fails immediately.
    const config = loadConfig(configPath, readFile);
    if ('error' in config) {
      stderr(config.error);
      return 2;
    }
    if (io.stdinIsTTY) {
      stderr(`error: no git log stream on stdin (stdin is a terminal)\n\n${USAGE}`);
      return 2;
    }
    const stream = await io.readStdin();
    if (stream.trim().length === 0) {
      stderr('error: empty git log stream on stdin\n');
      return 2;
    }
    // Malformed records are passed through so they stay visible.
    stdout(`${JSON.stringify(groupGitLog(parseGitLog(stream), { ignore: config.ignore }), null, 2)}\n`);
    return 0;
  }

  if (command === 'render') {
    let repoUrl: string | undefined;
    let formatArg: string | undefined;
    let configPath: string | undefined;
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i]!;
      if (arg === '--repo-url') {
        const value = rest[++i];
        if (value === undefined) {
          stderr('error: --repo-url needs a value\n');
          return 2;
        }
        repoUrl = value;
      } else if (arg === '--format') {
        const value = rest[++i];
        if (value === undefined) {
          stderr('error: --format needs a value: markdown or json\n');
          return 2;
        }
        // A repeated option overrides the earlier one, so only the last value is validated below.
        formatArg = value;
      } else if (arg === '--config') {
        const value = rest[++i];
        if (value === undefined) {
          stderr('error: --config needs a value\n');
          return 2;
        }
        configPath = value;
      } else {
        stderr(`error: unknown option "${arg}"\n\n${USAGE}`);
        return 2;
      }
    }
    // Validate the options before touching stdin so a bad value fails immediately.
    // The format is compared as given: no trimming, no lower-casing (Validate Before You Normalize).
    let format: 'markdown' | 'json' = 'markdown';
    if (formatArg !== undefined) {
      if (formatArg !== 'markdown' && formatArg !== 'json') {
        stderr(`error: invalid --format ${JSON.stringify(formatArg)}: expected markdown or json\n`);
        return 2;
      }
      format = formatArg;
    }
    if (repoUrl !== undefined) {
      try {
        checkRepoUrl(repoUrl);
      } catch (error) {
        if (error instanceof RangeError) {
          stderr(`error: ${error.message}\n`);
          return 2;
        }
        throw error;
      }
    }
    // After the other options, before stdin: only the last --config file is read.
    const config = loadConfig(configPath, readFile);
    if ('error' in config) {
      stderr(config.error);
      return 2;
    }
    if (io.stdinIsTTY) {
      stderr(`error: no git log stream on stdin (stdin is a terminal)\n\n${USAGE}`);
      return 2;
    }
    const stream = await io.readStdin();
    if (stream.trim().length === 0) {
      stderr(`error: empty git log stream on stdin\n\n${USAGE}`);
      return 2;
    }
    const groups = groupGitLog(parseGitLog(stream), { ignore: config.ignore });
    const options = repoUrl === undefined ? {} : { repoUrl };
    stdout(format === 'json' ? renderJson(groups, options) : renderMarkdown(groups, options));
    return 0;
  }

  if (command === 'version') {
    let current: string | undefined;
    let versionConfigPath: string | undefined;
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i]!;
      if (arg === '--current') {
        const value = rest[++i];
        if (value === undefined) {
          stderr('error: --current needs a value\n');
          return 2;
        }
        current = value;
      } else if (arg === '--config') {
        const value = rest[++i];
        if (value === undefined) {
          stderr('error: --config needs a value\n');
          return 2;
        }
        versionConfigPath = value;
      } else {
        stderr(`error: unknown option "${arg}"\n\n${USAGE}`);
        return 2;
      }
    }
    if (current === undefined) {
      stderr('error: --current <x.y.z> is required\n');
      return 2;
    }
    // Validate before touching stdin so a bad version fails immediately.
    try {
      parseVersion(current);
    } catch (error) {
      if (error instanceof RangeError) {
        stderr(`error: ${error.message}\n`);
        return 2;
      }
      throw error;
    }
    const config = loadConfig(versionConfigPath, readFile);
    if ('error' in config) {
      stderr(config.error);
      return 2;
    }
    if (io.stdinIsTTY) {
      stderr(`error: no git log stream on stdin (stdin is a terminal)\n\n${USAGE}`);
      return 2;
    }
    const stream = await io.readStdin();
    if (stream.trim().length === 0) {
      stderr(`error: empty git log stream on stdin\n\n${USAGE}`);
      return 2;
    }
    try {
      const groups = groupGitLog(parseGitLog(stream), { ignore: config.ignore });
      stdout(`${JSON.stringify(recommendVersion(groups, current), null, 2)}\n`);
    } catch (error) {
      // Bump overflow: a RangeError from the library is a usage-level failure, not a crash.
      if (error instanceof RangeError) {
        stderr(`error: ${error.message}\n`);
        return 2;
      }
      throw error;
    }
    return 0;
  }

  stderr(`error: unknown command "${command}"\n\n${USAGE}`);
  return 2;
}

// pathToFileURL handles both POSIX paths and Windows drive letters; a hand-built
// `file:///` prefix does not, because POSIX paths already start with `/`.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
