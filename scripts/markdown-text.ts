// Factory tooling, not part of the tracenotes product: the small part of Markdown that the
// ticket guard needs to understand. An issue body is text someone else wrote; what sits in an
// HTML comment or in a fenced code block is a template or an example, not the ticket.

// A backtick fence may not have a backtick after its opening run: "```npm test``` passes" is
// inline code. A tilde fence has no such limit.
const FENCE_OPEN = /^ {0,3}(?:(`{3,})[^`]*$|(~{3,}))/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * Returns the lines of a Markdown text with HTML comments and fenced code blocks blanked out.
 *
 * Input: a Markdown body (line endings may be LF or CRLF). Output: one string per line, in
 * order, so line numbers stay the same. Text inside an HTML comment is removed; every line of
 * a fenced code block (three or more backticks or tildes, up to three spaces of indent) becomes
 * empty. The text is read once, top to bottom: a comment marker inside a fence is code, and a
 * fence marker inside a comment is comment. An unterminated comment or fence hides everything
 * after it, which is how GitHub renders it. Inline code and indented code blocks are left as
 * they are. Failure: none; any string is accepted, and the work is linear in its length.
 */
export function visibleLines(markdown: string): string[] {
  const lines: string[] = [];
  let fence: { character: string; length: number } | undefined;
  let inComment = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (fence !== undefined) {
      const close = FENCE_CLOSE.exec(line)?.[1];
      if (close !== undefined && close.charAt(0) === fence.character && close.length >= fence.length) {
        fence = undefined;
      }
      lines.push('');
      continue;
    }
    if (!inComment) {
      const match = FENCE_OPEN.exec(line);
      const open = match?.[1] ?? match?.[2];
      if (open !== undefined) {
        fence = { character: open.charAt(0), length: open.length };
        lines.push('');
        continue;
      }
    }
    let kept = '';
    let rest = line;
    for (;;) {
      if (inComment) {
        const end = rest.indexOf('-->');
        if (end === -1) break;
        rest = rest.slice(end + 3);
        inComment = false;
      } else {
        const start = rest.indexOf('<!--');
        if (start === -1) {
          kept += rest;
          break;
        }
        kept += rest.slice(0, start);
        rest = rest.slice(start + 4);
        inComment = true;
      }
    }
    lines.push(kept);
  }
  return lines;
}
