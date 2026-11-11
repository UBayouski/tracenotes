/**
 * Render release groups as Markdown (tickets/T-004) or as a JSON document (tickets/T-007).
 *
 * No Orphan Notes: every entry line carries its short SHA (and PR number when known).
 * Nothing Vanishes: a closing line accounts for ignored merges and malformed records.
 * Validate Before You Normalize: `repoUrl` is checked as given and never repaired.
 */
import type { BreakingEntry, Entry, ReleaseGroups } from './group.ts';

export interface RenderOptions {
  /** `https://<host>/<owner>/<repo>`; enables links to commits and pull requests. */
  repoUrl?: string;
}

const REPO_URL = /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const ESCAPED = /[\\`*_[\]<>#|&~]/g;

/** Backslash-escape Markdown and HTML significant characters. Only adds characters. */
function escapeText(text: string): string {
  return text.replace(ESCAPED, ch => `\\${ch}`);
}

/**
 * Check a repository URL exactly as given; nothing is repaired.
 *
 * @param repoUrl Candidate `https://<host>/<owner>/<repo>`, port (if any) in 1-65535.
 * @throws RangeError when the value does not match that shape.
 */
export function checkRepoUrl(repoUrl: string): void {
  const port = /^https:\/\/[^/:]+:([0-9]+)\//.exec(repoUrl)?.[1];
  const portOk = port === undefined || (Number(port) >= 1 && Number(port) <= 65535);
  if (!REPO_URL.test(repoUrl) || repoUrl.endsWith('.git') || !portOk) {
    throw new RangeError(
      `invalid repoUrl ${JSON.stringify(repoUrl)}: expected https://<host>/<owner>/<repo> ` +
      'with no trailing slash, .git suffix, query or fragment',
    );
  }
}

/** Where an entry comes from. `sha` is always set; the URLs are null without `repoUrl`. */
export interface NotesSource {
  /** Full 40-character SHA of the source commit. */
  sha: string;
  shortSha: string;
  commitUrl: string | null;
  prNumber: number | null;
  prUrl: string | null;
}

export interface NotesEntry {
  scope: string | null;
  /** Parsed subject, not escaped for any output format. */
  subject: string;
  /** BREAKING CHANGE footer values; empty outside the `Breaking changes` section. */
  breakingNotes: string[];
  source: NotesSource;
}

export interface NotesSection {
  title: string;
  entries: NotesEntry[];
}

export interface NotesCounts {
  /** Entries in `sections`. `shown + ignored === total`. */
  shown: number;
  /** Parsed input commits; malformed records are counted in `malformed` only. */
  total: number;
  /** Merge commits left out of the sections. */
  ignored: number;
  /** Records `parseGitLog` could not parse; not part of `total`. */
  malformed: number;
}

/** Release notes as data (tickets/T-007). Key order is part of the contract. */
export interface NotesDocument {
  schemaVersion: 1;
  title: 'Unreleased';
  sections: NotesSection[];
  counts: NotesCounts;
}

function toSource(entry: Entry, repoUrl: string | undefined): NotesSource {
  return {
    sha: entry.sha,
    shortSha: entry.shortSha,
    commitUrl: repoUrl === undefined ? null : `${repoUrl}/commit/${entry.sha}`,
    prNumber: entry.prNumber,
    prUrl: repoUrl === undefined || entry.prNumber === null ? null : `${repoUrl}/pull/${entry.prNumber}`,
  };
}

/**
 * Build the release notes document that both output formats print.
 *
 * @param groups Result of `groupCommits` / `groupGitLog`.
 * @param options `repoUrl` fills `commitUrl` and `prUrl` on every source.
 * @returns Plain data: sections and entries in `groups` order, raw (unescaped) text, a source on
 *          every entry and the four counts. Pure and deterministic; shares no arrays with `groups`.
 * @throws RangeError when `repoUrl` is given but is not `https://<host>/<owner>/<repo>`.
 */
export function notesDocument(groups: ReleaseGroups, options: RenderOptions = {}): NotesDocument {
  const { repoUrl } = options;
  if (repoUrl !== undefined) checkRepoUrl(repoUrl);

  let shown = 0;
  const sections: NotesSection[] = groups.sections.map(section => ({
    title: section.title,
    entries: (section.entries as (Entry | BreakingEntry)[]).map(entry => {
      shown++;
      return {
        scope: entry.scope,
        subject: entry.subject,
        breakingNotes: 'breakingNotes' in entry ? [...entry.breakingNotes] : [],
        source: toSource(entry, repoUrl),
      };
    }),
  }));
  return {
    schemaVersion: 1,
    title: 'Unreleased',
    sections,
    counts: { shown, total: groups.total, ignored: groups.ignored.length, malformed: groups.malformed.length },
  };
}

/**
 * Render grouped commits as a JSON release notes document.
 *
 * @param groups Result of `groupCommits` / `groupGitLog`.
 * @param options Same as `notesDocument`.
 * @returns `notesDocument` as JSON with a 2-space indent, `\n` line endings and exactly one
 *          trailing newline. Pure and deterministic.
 * @throws RangeError when `repoUrl` is given but is not `https://<host>/<owner>/<repo>`.
 */
export function renderJson(groups: ReleaseGroups, options: RenderOptions = {}): string {
  return `${JSON.stringify(notesDocument(groups, options), null, 2)}\n`;
}

function sourceText(source: NotesSource): string {
  const parts: string[] = [];
  if (source.commitUrl === null) {
    parts.push(`\`${source.shortSha}\``);
    if (source.prNumber !== null) parts.push(`#${source.prNumber}`);
  } else {
    parts.push(`[${source.shortSha}](${source.commitUrl})`);
    if (source.prNumber !== null) parts.push(`[#${source.prNumber}](${source.prUrl})`);
  }
  return parts.join(', ');
}

/**
 * Render grouped commits as Markdown release notes.
 *
 * @param groups Result of `groupCommits` / `groupGitLog`.
 * @param options `repoUrl` turns SHAs and PR numbers into links.
 * @returns Markdown with `\n` line endings and exactly one trailing newline. Pure and deterministic.
 * @throws RangeError when `repoUrl` is given but is not `https://<host>/<owner>/<repo>`.
 */
export function renderMarkdown(groups: ReleaseGroups, options: RenderOptions = {}): string {
  const doc = notesDocument(groups, options);

  const blocks: string[] = [`## ${doc.title}`];
  for (const section of doc.sections) {
    const lines: string[] = [`### ${escapeText(section.title)}`, ''];
    for (const entry of section.entries) {
      const scope = entry.scope === null ? '' : `**${escapeText(entry.scope)}:** `;
      lines.push(`- ${scope}${escapeText(entry.subject)} (${sourceText(entry.source)})`);
      for (const note of entry.breakingNotes) {
        // A note may span lines; continuation lines stay inside the sub-item.
        lines.push(`  - ${escapeText(note).replace(/\r?\n/g, '\n    ')}`);
      }
    }
    blocks.push(lines.join('\n'));
  }
  const { shown, total, ignored, malformed } = doc.counts;
  blocks.push(
    `_${shown} of ${total} commits shown; ${ignored} merge commits ignored; ` +
    `${malformed} malformed records skipped._`,
  );
  return `${blocks.join('\n\n')}\n`;
}
