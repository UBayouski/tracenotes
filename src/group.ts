/**
 * Group parsed commits into release-note sections (tickets/T-003-group-commits-into-sections.md).
 *
 * No Orphan Notes: every entry is built from a LoggedCommit and always carries `sha`.
 * Nothing Vanishes: every input commit lands in exactly one section or in `ignored`, and an
 * ignored commit says why (merge commit, or the config pattern that matched; tickets/T-008).
 */
import { compileIgnorePattern } from './config.ts';
import type { GitLogResult, LoggedCommit, MalformedRecord } from './gitlog.ts';

export interface Entry {
  /** Full 40-character SHA of the source commit. */
  sha: string;
  /** First 7 characters of `sha`. */
  shortSha: string;
  subject: string;
  scope: string | null;
  prNumber: number | null;
  issueRefs: number[];
  breaking: boolean;
  /** Conventional type, or null for non-conventional messages. */
  type: string | null;
}

export interface BreakingEntry extends Entry {
  /** Values of BREAKING CHANGE footers; empty when only `!` marked the commit. */
  breakingNotes: string[];
}

export interface Section {
  title: string;
  entries: Entry[] | BreakingEntry[];
}

export interface IgnoredEntry extends Entry {
  /** `ignore pattern: <pattern>` carries the first matching config pattern, as written. */
  reason: 'merge commit' | `ignore pattern: ${string}`;
}

export interface GroupOptions {
  /**
   * Regular expressions (source text, compiled with the `u` flag) from the config file. A commit
   * whose first message line matches one is moved to `ignored`. Breaking commits never are.
   */
  ignore?: string[];
}

export interface ReleaseGroups {
  sections: Section[];
  ignored: IgnoredEntry[];
  /** Records that `parseGitLog` could not parse; only filled by the CLI pass-through. */
  malformed: MalformedRecord[];
  /** Equals the number of input commits. */
  total: number;
}

const FIXED_TYPE_TITLES: [string, string][] = [
  ['feat', 'Features'],
  ['fix', 'Bug fixes'],
  ['perf', 'Performance'],
  ['revert', 'Reverts'],
];

function toEntry(commit: LoggedCommit): Entry {
  const m = commit.message;
  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    subject: m.subject,
    scope: m.scope,
    prNumber: m.prNumber,
    issueRefs: [...m.issueRefs],
    breaking: m.breaking,
    type: m.type,
  };
}

/** Source of the first pattern, in file order, that matches the first line of `raw`, untrimmed. */
function firstMatch(patterns: { source: string; regex: RegExp }[], raw: string): string | undefined {
  if (patterns.length === 0) return undefined;
  const newline = raw.indexOf('\n');
  const firstLine = newline === -1 ? raw : raw.slice(0, newline);
  return patterns.find(p => p.regex.test(firstLine))?.source;
}

/**
 * Group commits into sections.
 *
 * @param commits Commits as produced by `parseGitLog`.
 * @param malformed Optional malformed records to pass through unchanged.
 * @param options `ignore` patterns from the config file; none by default.
 * @returns Sections in the fixed order from the ticket (empty ones omitted), merge commits and
 *          commits matching an ignore pattern in `ignored` with their reason, and
 *          `total === commits.length`. Entries are plain data.
 * @throws RangeError when an ignore pattern is empty or not a valid regular expression.
 */
export function groupCommits(
  commits: LoggedCommit[],
  malformed: MalformedRecord[] = [],
  options: GroupOptions = {},
): ReleaseGroups {
  const patterns = (options.ignore ?? []).map((source, index) => ({
    source,
    regex: compileIgnorePattern(source, `ignore[${index}]`),
  }));
  const breaking: BreakingEntry[] = [];
  const byType = new Map<string, Entry[]>();
  const unclassified: Entry[] = [];
  const ignored: IgnoredEntry[] = [];

  for (const commit of commits) {
    const entry = toEntry(commit);
    let matched: string | undefined;
    // Checked on the raw first line as parsed; no trimming before the test.
    if (commit.message.raw.startsWith('Merge ')) {
      ignored.push({ ...entry, reason: 'merge commit' });
    } else if (commit.message.breaking) {
      // Before the ignore patterns on purpose: a config file cannot hide a breaking change.
      breaking.push({ ...entry, breakingNotes: [...commit.message.breakingNotes] });
    } else if ((matched = firstMatch(patterns, commit.message.raw)) !== undefined) {
      ignored.push({ ...entry, reason: `ignore pattern: ${matched}` });
    } else if (entry.type === null) {
      unclassified.push(entry);
    } else {
      const list = byType.get(entry.type);
      if (list) list.push(entry);
      else byType.set(entry.type, [entry]);
    }
  }

  const sections: Section[] = [];
  if (breaking.length > 0) sections.push({ title: 'Breaking changes', entries: breaking });
  const fixed = new Set(FIXED_TYPE_TITLES.map(([type]) => type));
  for (const [type, title] of FIXED_TYPE_TITLES) {
    const entries = byType.get(type);
    if (entries) sections.push({ title, entries });
  }
  const rest = [...byType.keys()].filter(t => !fixed.has(t)).sort();
  for (const type of rest) sections.push({ title: type, entries: byType.get(type) as Entry[] });
  if (unclassified.length > 0) sections.push({ title: 'Unclassified', entries: unclassified });

  return { sections, ignored, malformed, total: commits.length };
}

/**
 * Convenience for the CLI: group a `parseGitLog` result and keep its malformed records.
 * `options` and the RangeError are those of `groupCommits`.
 */
export function groupGitLog(result: GitLogResult, options: GroupOptions = {}): ReleaseGroups {
  return groupCommits(result.commits, result.malformed, options);
}
