/**
 * Parse a `git log` stream into commits.
 *
 * Input contract (see tickets/T-002-read-git-log-stream.md):
 *
 *   git log --format='%H%x1f%an%x1f%aI%x1f%B%x1e' <range>
 *
 * Fields are separated by the ASCII unit separator (0x1F): full SHA, author name, author date
 * in ISO 8601, full message body. Records are terminated by the ASCII record separator (0x1E).
 *
 * Nothing vanishes: records that cannot be parsed are reported in `malformed` with a reason,
 * and `count` always equals `commits.length + malformed.length`.
 */
import { parseCommit, type ParsedCommit } from './commit.ts';

export const RECORD_SEPARATOR = '\u001e';
export const FIELD_SEPARATOR = '\u001f';

export interface LoggedCommit {
  /** Full 40-character lowercase hex SHA. */
  sha: string;
  /** Author name as git printed it. */
  author: string;
  /** Author date as the ISO 8601 string git printed it. Never converted to a Date. */
  date: string;
  /** The parsed commit message. */
  message: ParsedCommit;
  /** Non-fatal problems with this record, such as a date that does not look like ISO 8601. */
  warnings: string[];
}

export interface MalformedRecord {
  /** The record text as it appeared in the stream, without the record terminator. */
  raw: string;
  /** Why it could not be turned into a commit. */
  reason: string;
}

export interface GitLogResult {
  commits: LoggedCommit[];
  malformed: MalformedRecord[];
  /** commits.length + malformed.length. */
  count: number;
}

const SHA_RE = /^[0-9a-f]{40}$/;
// Basic shape check only: YYYY-MM-DDTHH:MM:SS with optional fraction and a Z or ±HH:MM offset.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parse one record (the text between two record separators) into a commit or a malformed entry.
 */
function parseRecord(raw: string): LoggedCommit | MalformedRecord {
  // git prints a newline after each record, so the next record starts with "\n". That
  // leading whitespace belongs to the stream framing, not to the SHA field.
  const text = raw.replace(/^\s+/, '');
  const fields = text.split(FIELD_SEPARATOR);
  if (fields.length < 4) {
    return { raw, reason: 'missing fields' };
  }
  const sha = fields[0] as string;
  const author = fields[1] as string;
  const date = fields[2] as string;
  // The message is everything after the third separator. Joining preserves content even if a
  // message somehow contains the field separator; the contract says it should not.
  const body = fields.slice(3).join(FIELD_SEPARATOR);

  if (!SHA_RE.test(sha)) {
    return { raw, reason: `invalid sha: ${JSON.stringify(sha)}` };
  }

  const warnings: string[] = [];
  if (!ISO_DATE_RE.test(date)) {
    warnings.push(`date does not look like ISO 8601: ${JSON.stringify(date)}`);
  }

  return { sha, author, date, message: parseCommit(body), warnings };
}

function isMalformed(entry: LoggedCommit | MalformedRecord): entry is MalformedRecord {
  return 'reason' in entry;
}

/**
 * Parse a git log stream.
 *
 * @param stream The raw text produced by the git command in the module comment.
 * @returns Commits in input order plus any records that could not be parsed. Never throws on
 *          string input. Empty or whitespace-only input yields an empty result.
 */
export function parseGitLog(stream: string): GitLogResult {
  const commits: LoggedCommit[] = [];
  const malformed: MalformedRecord[] = [];

  for (const raw of stream.split(RECORD_SEPARATOR)) {
    // The text after the final terminator is framing (usually "\n"), not a record.
    if (raw.trim().length === 0) continue;
    const entry = parseRecord(raw);
    if (isMalformed(entry)) malformed.push(entry);
    else commits.push(entry);
  }

  return { commits, malformed, count: commits.length + malformed.length };
}
