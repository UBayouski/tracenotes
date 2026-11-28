#!/usr/bin/env node
/**
 * Site build (T-041): the files GitHub Pages serves for this repository, made by tracenotes from
 * the repository's own history. `.github/workflows/pages.yml` runs it on every push to `main`.
 *
 * Usage: `git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' | node scripts/build-site.ts
 * --commit <sha> --repo-url <url> --out <dir>`. Makes `<dir>` (it must not exist; its parent
 * must) and writes `notes.json`, `notes.md`, `build.json`
 * and `index.html` into `<dir>`.
 * Exit codes: 0 the files are written, 1 the input was refused and nothing was written, 2 usage.
 *
 * `render` exits 0 on a stream it could not fully read (it counts malformed records) and on a
 * history of one commit, so a plain pipe would publish both. This script refuses them.
 */
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupGitLog, parseGitLog, RECORD_SEPARATOR, renderJson, renderMarkdown } from '../src/index.ts';

/** The names of the files a build produces, in the order they are written. */
export const SITE_FILES = ['notes.json', 'notes.md', 'build.json', 'index.html'] as const;

/** What a build is made from. */
export interface SiteInput {
  /** A git log stream in the format `tracenotes log` documents, newest commit first. */
  stream: string;
  /** The commit being published: 40 lower-case hex characters, as received. */
  commit: string;
  /** Link base, `https://<host>/<owner>/<repo>`, as `render --repo-url` takes it. */
  repoUrl: string;
}

const COMMIT = /^[0-9a-f]{40}$/;
const USAGE = 'Usage: git log --format=<log format> | node scripts/build-site.ts --commit <sha> --repo-url <url> --out <dir>\n';

// The page never changes with the history: it holds no commit subject, author or SHA, so no
// text from a commit message can end up in HTML.
const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tracenotes: release notes of this repository</title>
</head>
<body>
<h1>tracenotes</h1>
<p>Release notes of the tracenotes repository, written by tracenotes from its own history on every push to main.</p>
<ul>
<li><a href="notes.md">notes.md</a>: the notes as Markdown</li>
<li><a href="notes.json">notes.json</a>: the same notes as a JSON document</li>
<li><a href="build.json">build.json</a>: the commit these files were built from</li>
</ul>
</body>
</html>
`;

/**
 * Shows a value from the input inside a one-line message: JSON quoting, and every character
 * outside printable ASCII as a `\uXXXX` escape, so the value cannot start a second line.
 */
function shown(value: string): string {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * Builds the site in memory.
 *
 * @param input The stream, the commit it must start at and the link base. Nothing is trimmed.
 * @returns File name to content, one entry per name in `SITE_FILES`. `notes.json` and
 *          `notes.md` are what `tracenotes render` prints for the same stream and URL;
 *          `build.json` holds the commit and the number of commits and no time, so one commit
 *          always gives the same files.
 * @throws RangeError when the commit is not 40 lower-case hex characters, the URL is one
 *         `render` rejects, the stream is empty, does not end with a record terminator (and at
 *         most one line feed after it), has a malformed record or a record that is not a commit,
 *         or its first commit is not `input.commit`.
 */
export function buildSite(input: SiteInput): Map<string, string> {
  const { stream, commit, repoUrl } = input;
  if (!COMMIT.test(commit)) {
    throw new RangeError(`invalid commit ${shown(commit)}: expected 40 lower-case hex characters`);
  }
  if (stream === '') throw new RangeError('the history has no commit');
  // The framing is checked here, on the stream as received, because the parser is lenient in two
  // places: it drops a record that is only whitespace (T-040) and it reads a last record that
  // has no terminator. Either would let a history through that was not read in full (Qodo local
  // review finding 7cb90af9). `git log` ends every record with the terminator and a line feed.
  // A leading byte order mark is left to the parser, which drops it on purpose (a PowerShell
  // pipe adds one, Day 3); it sits inside the first record and changes no count here.
  const records = stream.split(RECORD_SEPARATOR);
  const tail = records.pop();
  // After the last terminator: nothing, or the one line break `git log` prints, which a Windows
  // shell may have turned into CR LF. The parser reads both (PR 44 review finding f553217c).
  if (records.length === 0 || (tail !== '' && tail !== '\n' && tail !== '\r\n')) {
    throw new RangeError('the history does not end with a record terminator');
  }
  const log = parseGitLog(stream);
  if (log.malformed.length > 0) {
    const first = log.malformed[0]!;
    const noun = log.malformed.length === 1 ? 'record' : 'records';
    throw new RangeError(`the history has ${log.malformed.length} malformed ${noun}; first: ${shown(first.reason)}`);
  }
  if (log.commits.length !== records.length) {
    throw new RangeError(`the history has ${records.length} records but ${log.commits.length} commits`);
  }
  const first = log.commits[0];
  if (first === undefined) throw new RangeError('the history has no commit');
  if (first.sha !== commit) {
    throw new RangeError(`the history starts at ${first.sha}, not at ${commit}`);
  }
  const groups = groupGitLog(log);
  const build = { schemaVersion: 1, commit, commits: log.commits.length };
  return new Map<string, string>([
    ['notes.json', renderJson(groups, { repoUrl })],
    ['notes.md', renderMarkdown(groups, { repoUrl })],
    ['build.json', `${JSON.stringify(build, null, 2)}\n`],
    ['index.html', INDEX_HTML],
  ]);
}

/** The three options of the command, each given exactly once. */
interface Options {
  commit: string;
  repoUrl: string;
  out: string;
}

/** Reads the arguments. Returns the options, or the one-line reason they are not usable. */
function readOptions(argv: string[]): Options | string {
  const names = new Map([['--commit', 'commit'], ['--repo-url', 'repoUrl'], ['--out', 'out']] as const);
  const values: Partial<Options> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const arg = argv[i]!;
    const key = names.get(arg as '--commit');
    if (key === undefined) return `unknown option ${shown(arg)}`;
    if (values[key] !== undefined) return `${arg} given twice`;
    const value = argv[i + 1];
    if (value === undefined) return `${arg} needs a value`;
    values[key] = value;
  }
  const { commit, repoUrl, out } = values;
  if (commit === undefined || repoUrl === undefined || out === undefined) {
    return '--commit, --repo-url and --out are all required';
  }
  if (!COMMIT.test(commit)) return `invalid commit ${shown(commit)}: expected 40 lower-case hex characters`;
  return { commit, repoUrl, out };
}

/** The error's own message on one line; a system error keeps its code. */
function reason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/[^\x20-\x7e]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * The command. Reads the stream from `stdin` as strict UTF-8, builds, then writes.
 *
 * @param write Writes one file; the tests pass one that fails.
 * @returns The exit code and the text for stderr. The output directory must not exist and its
 *          parent must: the run makes the directory itself, complete or not at all. A failed
 *          run leaves nothing behind.
 */
export function main(
  argv: string[],
  stdin: Uint8Array,
  write: (file: string, text: string) => void = writeFileSync,
): { code: number; stderr: string } {
  const options = readOptions(argv);
  if (typeof options === 'string') return { code: 2, stderr: `error: ${options}\n\n${USAGE}` };

  let files: Map<string, string>;
  try {
    let stream: string;
    try {
      stream = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(stdin);
    } catch {
      throw new RangeError('the history on stdin is not valid UTF-8');
    }
    files = buildSite({ stream, commit: options.commit, repoUrl: options.repoUrl });
  } catch (error) {
    return { code: 1, stderr: `error: ${reason(error)}\n` };
  }

  // One call both checks that the path is free and takes it: `mkdir` without `recursive` fails
  // when anything is there, a link to nothing included, and makes no parent. There is no moment
  // between a check and a use, and what the call made is this run's own, so a failed run may
  // remove it whole (Qodo local review findings c03742ea, afdf2ca4, 51e2696c; PR 44 review
  // finding 7ab639c8, which the earlier check-then-rename had left open).
  const out = path.resolve(options.out);
  try {
    mkdirSync(out);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return { code: 1, stderr: `error: output directory ${shown(options.out)} already exists\n` };
    }
    return { code: 1, stderr: `error: cannot write to ${shown(options.out)}: ${reason(error)}\n` };
  }
  try {
    // The modes are set, not left to the umask of the caller: GitHub Pages refuses an artifact
    // whose directory or files others cannot read, and a site is public anyway (Qodo local
    // review finding 723eb8cd, PR 44 review finding da4c1646). Windows ignores these bits.
    chmodSync(out, 0o755);
    for (const name of SITE_FILES) {
      const file = path.join(out, name);
      write(file, files.get(name)!);
      chmodSync(file, 0o644);
    }
  } catch (error) {
    // Best effort: a failure to clean up must not hide the first error.
    try { rmSync(out, { recursive: true, force: true }); } catch { /* reported below */ }
    return { code: 1, stderr: `error: cannot write to ${shown(options.out)}: ${reason(error)}\n` };
  }
  return { code: 0, stderr: '' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chunks: Uint8Array[] = [];
  if (!process.stdin.isTTY) for await (const chunk of process.stdin) chunks.push(chunk as Uint8Array);
  const result = main(process.argv.slice(2), Buffer.concat(chunks));
  process.stderr.write(result.stderr);
  process.exitCode = result.code;
}
