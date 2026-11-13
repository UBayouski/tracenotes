#!/usr/bin/env node
// Factory tooling, not part of the tracenotes product: the guard that
// .github/workflows/agent-ticket.yml runs before the agent starts on a labelled issue.
//
// A ticket is ready for the agent only when it carries an Investigation section: the record of
// its requirements and assumptions checked against the code (AGENTS.md, "Working with tickets").
// The guard checks that the section exists and is not empty. It cannot judge whether the
// investigation is good; the human who adds the label has read it.
//
// Usage: ISSUE_BODY=... node scripts/ticket-ready.ts
// Exit codes: 0 the section is there, 1 it is not.
import { pathToFileURL } from 'node:url';
import { visibleLines } from './markdown-text.ts';

// The two ways a ticket names the section: the ticket format's bold label, or a heading.
const LABEL = /^\*\*Investigation\.\*\*(.*)$/;
const HEADING = /^#{1,6} Investigation[ \t]*$/;
// Where the section ends: the next bold label of the ticket format, or the next heading.
const NEXT_SECTION = /^(?:\*\*[^*\n]+\.\*\*|#{1,6} )/;

/**
 * Tells whether a ticket body has an Investigation section with something in it.
 *
 * Input: the issue body as Markdown (LF or CRLF). Output: `true` when a line starts with
 * `**Investigation.**` or is a heading `## Investigation` (any level), outside HTML comments
 * and fenced code blocks, and the section has at least one non-blank character before the next
 * section starts. Failure: none; any string is accepted.
 */
export function hasInvestigation(body: string): boolean {
  const lines = visibleLines(body);
  for (const [index, line] of lines.entries()) {
    const label = LABEL.exec(line);
    if (label === null && !HEADING.test(line)) continue;
    if (label !== null && /\S/.test(label[1] ?? '')) return true;
    for (const next of lines.slice(index + 1)) {
      if (NEXT_SECTION.test(next)) break;
      if (/\S/.test(next)) return true;
    }
  }
  return false;
}

/** What `run` decided: the exit code and the text for each stream. */
export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs the guard on `ISSUE_BODY` from the given environment, without touching the process.
 * A missing body is a ticket without the section. Failure: none.
 */
export function run(env: Record<string, string | undefined>): RunResult {
  if (hasInvestigation(env['ISSUE_BODY'] ?? '')) {
    return { code: 0, stdout: 'ticket-ready: the ticket has an Investigation section\n', stderr: '' };
  }
  return { code: 1, stdout: '', stderr: 'ticket-ready: the ticket has no Investigation section\n' };
}

// The only place this script touches the process.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const result = run(process.env);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.code;
}
