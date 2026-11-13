// Factory tooling, not part of the tracenotes product: the detector behind AGENTS.md rule 7
// (Show the Invisible) and tests/source-hygiene.test.ts. Ticket: tickets/T-028-source-hygiene.md.
//
// The rule and the idea of a test that prints the escape to write come from pasokh
// (https://github.com/TheNickRubin/pasokh). No code is copied.

/** One raw character that should have been written as an escape. */
export interface RawInvisible {
  /** 1-based line. Only a line feed ends a line. */
  line: number;
  /** 1-based column, counted in UTF-16 code units. */
  column: number;
  /** The character's Unicode code point. */
  codePoint: number;
  /** What to write instead, for example a backslash, `u` and four hex digits. */
  escape: string;
}

const TAB = 0x09;
const LINE_FEED = 0x0a;
const SPACE = 0x20;
const REPLACEMENT_CHARACTER = 0xfffd;
const BRAILLE_PATTERN_BLANK = 0x2800;

// Controls, format characters (byte order mark, zero-width and direction marks, soft hyphen),
// space separators, the line and paragraph separators, and Unicode's own list of characters
// that are normally displayed as nothing (Default_Ignorable_Code_Point: the Hangul fillers,
// which are letters and valid in an identifier, the combining grapheme joiner, the variation
// selectors).
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;

function isForbidden(codePoint: number, character: string): boolean {
  if (codePoint === TAB || codePoint === LINE_FEED || codePoint === SPACE) return false;
  if (codePoint === REPLACEMENT_CHARACTER || codePoint === BRAILLE_PATTERN_BLANK) return true;
  return INVISIBLE.test(character);
}

function hex(codePoint: number): string {
  return codePoint.toString(16).toUpperCase();
}

function escapeFor(codePoint: number): string {
  return codePoint <= 0xffff ? `\\u${hex(codePoint).padStart(4, '0')}` : `\\u{${hex(codePoint)}}`;
}

/**
 * Finds every raw invisible or control character in a source text.
 *
 * Input: the text of a file, already decoded. Output: one entry per forbidden character, in the
 * order they appear. Forbidden are the Unicode categories Cc (except tab and line feed), Cf, Zs
 * (except the ordinary space), Zl and Zp, every Default_Ignorable_Code_Point, U+2800 (braille
 * pattern blank) and U+FFFD. Visible characters outside ASCII are allowed. Failure: none; any
 * string is accepted, and a lone surrogate is not reported.
 */
export function findRawInvisible(text: string): RawInvisible[] {
  const hits: RawInvisible[] = [];
  let line = 1;
  let column = 1;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (isForbidden(codePoint, character)) {
      hits.push({ line, column, codePoint, escape: escapeFor(codePoint) });
    }
    if (codePoint === LINE_FEED) {
      line += 1;
      column = 1;
    } else {
      column += character.length;
    }
  }
  return hits;
}

/**
 * Formats one finding as a single line: `<path>:<line>:<column> raw U+XXXX, write <escape>`.
 *
 * Input: the file's path as it should be shown (relative, forward slashes) and a finding from
 * `findRawInvisible`. Output: the line, without a trailing newline. The path goes through
 * `showPath`, so the line stays one line whatever the file is called. Failure: none.
 */
export function describeRawInvisible(file: string, hit: RawInvisible): string {
  return `${showPath(file)}:${hit.line}:${hit.column} raw U+${hex(hit.codePoint).padStart(4, '0')}, write ${hit.escape}`;
}

/**
 * Checks the bytes of one source file.
 *
 * Input: the file's path as it should be shown and its raw bytes. Output: one line per problem:
 * `<path>: not valid UTF-8` (the path through `showPath`) when the bytes do not decode, otherwise one `describeRawInvisible`
 * line per raw forbidden character. A byte order mark at the start of the file is kept and
 * reported like any other. Failure: none.
 */
export function sourceProblems(file: string, bytes: Uint8Array): string[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return [`${showPath(file)}: not valid UTF-8`];
  }
  return findRawInvisible(text).map(hit => describeRawInvisible(file, hit));
}

/**
 * Makes a file path safe to print inside a one-line report.
 *
 * Input: a path, taken from the file system as it is. Output: the same path with every
 * character that `findRawInvisible` forbids, and tab and line feed, replaced by the text of
 * its escape. A file name is not source text: a line feed in it would split the report, and a
 * direction mark would reorder it. Visible characters, ASCII or not, are kept. Failure: none.
 */
export function showPath(file: string): string {
  let shown = '';
  for (const character of file) {
    const codePoint = character.codePointAt(0) ?? 0;
    const hide = codePoint === TAB || codePoint === LINE_FEED || isForbidden(codePoint, character);
    shown += hide ? escapeFor(codePoint) : character;
  }
  return shown;
}
