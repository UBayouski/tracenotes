/**
 * Recommend the next semantic version (tickets/T-005, project rule 3: Explain Every Bump).
 *
 * Works on `ReleaseGroups`, so merge-commit and malformed-record accounting matches
 * `group` and `render`. Pure: no I/O, no clock, no environment.
 */
import type { Entry, ReleaseGroups } from './group.ts';

export type Bump = 'major' | 'minor' | 'patch' | 'none';
export type RuleId = 'breaking' | 'breaking-pre-1.0' | 'feat' | 'fix' | 'none';

export interface VersionTrigger {
  sha: string;
  shortSha: string;
  type: string | null;
  subject: string;
}

export interface VersionRecommendation {
  current: string;
  next: string;
  bump: Bump;
  rule: { id: RuleId; description: string };
  /**
   * Every entry matching the winning rule; empty only when the rule is `none`. Section order,
   * then input order within a section: the order `render` prints them.
   */
  triggers: VersionTrigger[];
  counts: {
    total: number;
    triggering: number;
    /** Entries that matched no rule or a lower-priority rule. */
    notTriggering: number;
    /** Merge commits. */
    ignored: number;
    malformed: number;
  };
}

const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Validates `MAJOR.MINOR.PATCH` on the raw value (no trimming, no `v` prefix, no suffix).
 *
 * @param current The version string as received.
 * @returns The three parts as numbers.
 * @throws RangeError naming the value when it is not a valid version or a part exceeds
 *         Number.MAX_SAFE_INTEGER.
 */
export function parseVersion(current: string): [number, number, number] {
  const match = typeof current === 'string' ? VERSION_PATTERN.exec(current) : null;
  if (!match || match.slice(1).some(p => BigInt(p) > MAX)) {
    throw new RangeError(
      `invalid version ${JSON.stringify(current)}: expected MAJOR.MINOR.PATCH (non-negative integers, no leading zeros, no prefix or suffix)`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function trigger(e: Entry): VersionTrigger {
  return { sha: e.sha, shortSha: e.shortSha, type: e.type, subject: e.subject };
}

function increment(n: number, current: string): number {
  if (n >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`cannot bump ${JSON.stringify(current)}: result would exceed Number.MAX_SAFE_INTEGER`);
  }
  return n + 1;
}

/**
 * Recommend the next version and say why.
 *
 * @param groups Output of `groupGitLog`/`groupCommits`.
 * @param current Current version, `MAJOR.MINOR.PATCH`.
 * @returns The recommendation with the winning rule, its triggering entries (section order,
 *          then input order within a section; `ReleaseGroups` does not keep global order) and counts.
 * @throws RangeError when `current` is invalid or the bump would exceed Number.MAX_SAFE_INTEGER.
 */
export function recommendVersion(groups: ReleaseGroups, current: string): VersionRecommendation {
  const [major, minor, patch] = parseVersion(current);
  const entries = groups.sections.flatMap(s => s.entries as Entry[]);
  const breaking = groups.sections.filter(s => s.title === 'Breaking changes').flatMap(s => s.entries as Entry[]);
  const feats = entries.filter(e => e.type === 'feat');
  const fixes = entries.filter(e => e.type === 'fix' || e.type === 'perf' || e.type === 'revert');

  let id: RuleId;
  let bump: Bump;
  let description: string;
  let matched: Entry[];
  let next: string;

  if (breaking.length > 0) {
    matched = breaking;
    if (major === 0) {
      id = 'breaking-pre-1.0';
      bump = 'minor';
      description = 'A breaking change in a 0.x.y version bumps the minor version (initial development, SemVer item 4).';
      next = `0.${increment(minor, current)}.0`;
    } else {
      id = 'breaking';
      bump = 'major';
      description = 'A breaking change bumps the major version.';
      next = `${increment(major, current)}.0.0`;
    }
  } else if (feats.length > 0) {
    matched = feats;
    id = 'feat';
    bump = 'minor';
    description = 'A new feature (type feat) with no breaking change bumps the minor version.';
    next = `${major}.${increment(minor, current)}.0`;
  } else if (fixes.length > 0) {
    matched = fixes;
    id = 'fix';
    bump = 'patch';
    description = 'A fix, performance improvement or revert with no feature or breaking change bumps the patch version.';
    next = `${major}.${minor}.${increment(patch, current)}`;
  } else {
    matched = [];
    id = 'none';
    bump = 'none';
    description = 'No commit is a breaking change, feature, fix, performance improvement or revert, so the version stays the same.';
    next = current;
  }

  return {
    current,
    next,
    bump,
    rule: { id, description },
    triggers: matched.map(trigger),
    counts: {
      total: groups.total,
      triggering: matched.length,
      notTriggering: entries.length - matched.length,
      ignored: groups.ignored.length,
      malformed: groups.malformed.length,
    },
  };
}
