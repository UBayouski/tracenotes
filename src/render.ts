/**
 * Render release groups as Markdown (tickets/T-004).
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

function checkRepoUrl(repoUrl: string): void {
  if (!REPO_URL.test(repoUrl) || repoUrl.endsWith('.git')) {
    throw new RangeError(
      `invalid repoUrl ${JSON.stringify(repoUrl)}: expected https://<host>/<owner>/<repo> ` +
      'with no trailing slash, .git suffix, query or fragment',
    );
  }
}

function source(entry: Entry, repoUrl: string | undefined): string {
  const parts: string[] = [];
  if (repoUrl === undefined) {
    parts.push(`\`${entry.shortSha}\``);
    if (entry.prNumber !== null) parts.push(`#${entry.prNumber}`);
  } else {
    parts.push(`[${entry.shortSha}](${repoUrl}/commit/${entry.sha})`);
    if (entry.prNumber !== null) parts.push(`[#${entry.prNumber}](${repoUrl}/pull/${entry.prNumber})`);
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
  const { repoUrl } = options;
  if (repoUrl !== undefined) checkRepoUrl(repoUrl);

  const blocks: string[] = ['## Unreleased'];
  let shown = 0;
  for (const section of groups.sections) {
    const lines: string[] = [`### ${escapeText(section.title)}`, ''];
    for (const entry of section.entries as (Entry | BreakingEntry)[]) {
      shown++;
      const scope = entry.scope === null ? '' : `**${escapeText(entry.scope)}:** `;
      lines.push(`- ${scope}${escapeText(entry.subject)} (${source(entry, repoUrl)})`);
      if ('breakingNotes' in entry) {
        for (const note of entry.breakingNotes) {
          // A note may span lines; continuation lines stay inside the sub-item.
          lines.push(`  - ${escapeText(note).replace(/\r?\n/g, '\n    ')}`);
        }
      }
    }
    blocks.push(lines.join('\n'));
  }
  blocks.push(
    `_${shown} of ${groups.total} commits shown; ${groups.ignored.length} merge commits ignored; ` +
    `${groups.malformed.length} malformed records skipped._`,
  );
  return `${blocks.join('\n\n')}\n`;
}
