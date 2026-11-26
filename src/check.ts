/**
 * Commit message check (tickets/T-009).
 *
 * Says, for every commit in a parsed git log stream, whether its header follows Conventional
 * Commits. The parser already decides that (`ParsedCommit.conventional`); this module only sorts
 * the commits and counts them. Merge commits are skipped, not failed, and every record in the
 * stream is accounted for (AGENTS.md, "The Nothing Vanishes Rule").
 */

import type { GitLogResult, MalformedRecord } from './gitlog.ts';

export interface CheckedCommit {
  /** Full SHA as the stream gave it. */
  sha: string;
  /** First seven characters of the SHA. */
  shortSha: string;
  /**
   * First line of the parsed message (`ParsedCommit.raw`): line endings and trailing whitespace
   * are already normalized by the parser (AGENTS.md rule 6), nothing else is changed.
   */
  header: string;
  /** `pass`: conventional header. `fail`: not conventional. `skip`: merge commit. */
  verdict: 'pass' | 'fail' | 'skip';
  /** Why a commit failed or was skipped; null for `pass`. */
  reason: 'not a conventional commit header' | 'merge commit' | null;
}

export interface CheckResult {
  /** Every commit, in stream order. */
  commits: CheckedCommit[];
  /** Records that could not be read, carried over unchanged with their reason. */
  malformed: MalformedRecord[];
  /** commits.length + malformed.length. */
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/** The first line of `raw`, without its line ending. */
function firstLine(raw: string): string {
  const newline = raw.indexOf('\n');
  return newline === -1 ? raw : raw.slice(0, newline);
}

/**
 * Check every commit of a parsed git log stream against the Conventional Commits header grammar.
 *
 * @param result The output of `parseGitLog()`.
 * @returns One `CheckedCommit` per commit in stream order, the malformed records unchanged, and
 *          the counts, where `passed + failed + skipped + malformed.length === total`. A message
 *          that starts with `Merge ` is a merge commit (the same test as `groupCommits()`) and is
 *          skipped whatever its header. A header passes when the parser calls it
 *          conventional; the parser reads the header as received, so a first line that starts
 *          with whitespace fails. Pure; never throws.
 */
export function checkGitLog(result: GitLogResult): CheckResult {
  const commits = result.commits.map((commit): CheckedCommit => {
    const message = commit.message;
    const base = { sha: commit.sha, shortSha: commit.sha.slice(0, 7), header: firstLine(message.raw) };
    if (message.raw.startsWith('Merge ')) return { ...base, verdict: 'skip', reason: 'merge commit' };
    // parseCommit() matches the header as received (AGENTS.md rule 6), so a header with leading
    // whitespace is not conventional (T-039; Qodo PR review finding 88effe66).
    if (message.conventional) return { ...base, verdict: 'pass', reason: null };
    return { ...base, verdict: 'fail', reason: 'not a conventional commit header' };
  });
  const count = (verdict: CheckedCommit['verdict']) => commits.filter(c => c.verdict === verdict).length;
  return {
    commits,
    malformed: [...result.malformed],
    total: commits.length + result.malformed.length,
    passed: count('pass'),
    failed: count('fail'),
    skipped: count('skip'),
  };
}
