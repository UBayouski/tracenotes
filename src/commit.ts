/**
 * Conventional Commits parser.
 *
 * Follows the Conventional Commits 1.0.0 spec (https://www.conventionalcommits.org/en/v1.0.0/):
 *
 *   <type>[optional scope][!]: <description>
 *
 *   [optional body]
 *
 *   [optional footer(s)]
 *
 * Non-conventional messages are still parsed (header, body, footers, PR number) and
 * returned with `conventional: false`. Nothing is dropped. See AGENTS.md, "The Nothing
 * Vanishes Rule".
 */

export interface Footer {
  /** Footer token, e.g. "BREAKING CHANGE", "Refs", "Reviewed-by". Case preserved. */
  token: string;
  /** Footer value with the separator removed. Multi-line values are joined with "\n". */
  value: string;
}

export interface ParsedCommit {
  /** The original message, with line endings normalized to "\n" and trailing whitespace trimmed. */
  raw: string;
  /** True when the header matches the Conventional Commits grammar. */
  conventional: boolean;
  /** Commit type such as "feat" or "fix". Lower-cased. Null for non-conventional messages. */
  type: string | null;
  /** Scope inside the parentheses, if any. */
  scope: string | null;
  /** True when the header has a "!" or a BREAKING CHANGE / BREAKING-CHANGE footer exists. */
  breaking: boolean;
  /** Description after "type(scope): ". For non-conventional messages, the whole header line. */
  subject: string;
  /** Pull request number from a trailing "(#123)" in the header, as produced by GitHub squash merges. */
  prNumber: number | null;
  /** Body paragraphs between the header and the footers, or null when absent. */
  body: string | null;
  /** All footers in order of appearance. */
  footers: Footer[];
  /** Values of BREAKING CHANGE / BREAKING-CHANGE footers. */
  breakingNotes: string[];
  /** Issue numbers referenced by closing / referencing footers such as "Closes #12" or "Refs: #3, #4". */
  issueRefs: number[];
}

// Scope must be non-empty and must not start or end with whitespace, so "feat(): x" and
// "feat( ): x" are both non-conventional rather than silently scope-less.
const HEADER_RE = /^(?<type>[A-Za-z][A-Za-z0-9-]*)(?:\((?<scope>[^()\s](?:[^()]*[^()\s])?)\))?(?<bang>!)?: (?<subject>\S.*)$/;
const PR_SUFFIX_RE = /\s*\(#(?<pr>\d+)\)\s*$/;
// A footer line is either "Token: value" or "Token #value". Tokens use "-" instead of spaces,
// except the special "BREAKING CHANGE".
const FOOTER_RE = /^(?<token>BREAKING CHANGE|[A-Za-z][A-Za-z0-9-]*)(?:: (?<colonValue>.*)| (?<hashValue>#.*))$/;

const BREAKING_TOKENS = new Set(['BREAKING CHANGE', 'BREAKING-CHANGE']);
const ISSUE_REF_TOKENS = new Set([
  'close', 'closes', 'closed',
  'fix', 'fixes', 'fixed',
  'resolve', 'resolves', 'resolved',
  'ref', 'refs',
]);

function normalize(message: string): string {
  return message.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '').replace(/^\n+/, '');
}

// Paragraphs are separated by blank lines. Only the separating newlines are removed;
// leading indentation inside a paragraph (for example an indented code block) is kept.
// Trailing whitespace on each line was already removed by normalize().
function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map(p => p.replace(/^\n+|\n+$/g, '')).filter(p => p.length > 0);
}

interface FooterMatch {
  token: string;
  value: string;
}

function matchFooterLine(line: string): FooterMatch | null {
  const m = FOOTER_RE.exec(line);
  if (!m || !m.groups) return null;
  const token = m.groups['token'] as string;
  const value = m.groups['colonValue'] ?? m.groups['hashValue'] ?? '';
  return { token, value };
}

/**
 * Parse a paragraph as a footer block. Returns null if the first line is not a footer.
 * Lines that do not start a new footer are continuation lines of the previous footer.
 */
function parseFooterParagraph(paragraph: string): Footer[] | null {
  const lines = paragraph.split('\n');
  const first = matchFooterLine(lines[0] ?? '');
  if (!first) return null;
  const footers: Footer[] = [{ token: first.token, value: first.value }];
  for (const line of lines.slice(1)) {
    const next = matchFooterLine(line);
    if (next) {
      footers.push({ token: next.token, value: next.value });
    } else {
      const last = footers[footers.length - 1];
      if (last) last.value = last.value.length > 0 ? `${last.value}\n${line}` : line;
    }
  }
  return footers;
}

function extractIssueNumbers(value: string): number[] {
  const numbers: number[] = [];
  for (const m of value.matchAll(/#(\d+)/g)) {
    const n = Number(m[1]);
    if (Number.isSafeInteger(n) && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/**
 * Parse a single commit message.
 *
 * @param message Full commit message (header, optional body, optional footers).
 * @returns Structured commit. Never throws on malformed input; sets `conventional: false` instead.
 */
export function parseCommit(message: string): ParsedCommit {
  const raw = normalize(message);
  const newline = raw.indexOf('\n');
  const headerLine = (newline === -1 ? raw : raw.slice(0, newline)).trim();
  const rest = newline === -1 ? '' : raw.slice(newline + 1);

  // Pull request number from a trailing "(#123)".
  let header = headerLine;
  let prNumber: number | null = null;
  const prMatch = PR_SUFFIX_RE.exec(header);
  // A number beyond the safe-integer range would be rounded into a different PR, so it is
  // not treated as a PR reference; the "(#...)" text stays in the subject, visible.
  if (prMatch?.groups?.['pr'] && Number.isSafeInteger(Number(prMatch.groups['pr']))) {
    prNumber = Number(prMatch.groups['pr']);
    header = header.slice(0, prMatch.index).trimEnd();
  }

  // Header grammar.
  const h = HEADER_RE.exec(header);
  const conventional = h !== null;
  const type = h?.groups?.['type']?.toLowerCase() ?? null;
  const scope = h?.groups?.['scope'] ?? null;
  const bang = h?.groups?.['bang'] === '!';
  const subject = (h?.groups?.['subject'] ?? header).trim();

  // Body and footers: walk paragraphs from the end while they parse as footer blocks.
  const paragraphs = splitParagraphs(rest);
  const footers: Footer[] = [];
  let bodyEnd = paragraphs.length;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const block = parseFooterParagraph(paragraphs[i] as string);
    if (!block) break;
    footers.unshift(...block);
    bodyEnd = i;
  }
  const bodyParagraphs = paragraphs.slice(0, bodyEnd);
  const body = bodyParagraphs.length > 0 ? bodyParagraphs.join('\n\n') : null;

  const breakingNotes = footers
    .filter(f => BREAKING_TOKENS.has(f.token.toUpperCase()))
    .map(f => f.value);

  const issueRefs: number[] = [];
  for (const footer of footers) {
    if (!ISSUE_REF_TOKENS.has(footer.token.toLowerCase())) continue;
    for (const n of extractIssueNumbers(footer.value)) {
      if (!issueRefs.includes(n)) issueRefs.push(n);
    }
  }

  return {
    raw,
    conventional,
    type,
    scope,
    breaking: bang || breakingNotes.length > 0,
    subject,
    prNumber,
    body,
    footers,
    breakingNotes,
    issueRefs,
  };
}
