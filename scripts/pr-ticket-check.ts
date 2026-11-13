#!/usr/bin/env node
// Factory tooling, not part of the tracenotes product: the ticket-link check that
// .github/workflows/ticket-link.yml runs on every pull request.
//
// A pull request for a ticket must leave nothing to do by hand after the merge: it closes the
// ticket's own issue, and BACKLOG.md already says `done (PR <this number>)` for the ticket.
// Both were missed on PR 21 (journal/day-09.md). A pull request is "for a ticket" when its title
// names one (T-NNN) or when it closes an issue whose title starts with a ticket id.
//
// Which issues a pull request closes is asked from GitHub (closingIssuesReferences), not read
// out of the body: only GitHub knows what it will act on (journal/day-10.md).
//
// Usage: PR_TITLE=... PR_NUMBER=... GITHUB_REPOSITORY=owner/name GITHUB_TOKEN=...
//        node scripts/pr-ticket-check.ts [backlog-path]
// Exit codes: 0 nothing to check or all good, 1 a problem was found, 2 bad input or GitHub
// could not be asked.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** An issue that GitHub will close when the pull request is merged. */
export interface ClosingIssue {
  number: number;
  title: string;
}

export interface PrTicketInput {
  /** Pull request title. */
  title: string;
  /** Pull request number, a positive integer. */
  number: number;
  /** Text of BACKLOG.md at the pull request's head. */
  backlog: string;
  /** The issues GitHub lists as closed by this pull request. */
  closingIssues: readonly ClosingIssue[];
}

export interface PrTicketResult {
  /**
   * The tickets the pull request is for: the ids named in its title, then the tickets of the
   * issues it closes, without duplicates.
   */
  tickets: string[];
  /** One message per unmet requirement. Empty means the check passes. */
  problems: string[];
}

/** Returns the issues a pull request will close, as GitHub lists them. Rejects on failure. */
export type ClosingIssuesLookup = (pullRequestNumber: number) => Promise<ClosingIssue[]>;

/** What `run` decided: the exit code and the text for each stream. */
export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

// How many closing issues one request reads. A pull request that closes more is an error.
const MAX_CLOSING_ISSUES = 20;

// A ticket id standing alone: `T-008`, not `AT-008`, `T-0081` or `t-008`.
const TICKET_ID = /(?<![A-Za-z0-9-])T-\d{3}(?![A-Za-z0-9])/g;

// An issue belongs to the ticket its title starts with: `T-008: Config file ...`. A ticket id
// further into the title (`T-027: work split from T-008`) is a mention, not ownership.
const ISSUE_TICKET = /^(T-\d{3}):/;

/** Makes text safe to print on one line: everything outside printable ASCII becomes an escape. */
function visible(text: string): string {
  return text.replace(/[^ -~]/gu, ch => {
    const code = ch.codePointAt(0) ?? 0;
    return code <= 0xffff ? `\\u${code.toString(16).padStart(4, '0')}` : `\\u{${code.toString(16)}}`;
  });
}

function issueTicket(issue: ClosingIssue): string | undefined {
  return ISSUE_TICKET.exec(issue.title)?.[1];
}

function ticketsOf(title: string, closingIssues: readonly ClosingIssue[]): string[] {
  const fromIssues = closingIssues.flatMap(issue => issueTicket(issue) ?? []);
  return [...new Set([...(title.match(TICKET_ID) ?? []), ...fromIssues])];
}

/**
 * Reads the Status cell of every ticket row in BACKLOG.md. A row is a line of the form
 * `| T-NNN | title | day | status |` with one space inside each cell border. Cells are taken as
 * written (no trimming), so a status with stray spaces does not compare equal. Every row is
 * kept: a ticket with two rows has two statuses.
 */
function backlogStatuses(backlog: string): Map<string, string[]> {
  const statuses = new Map<string, string[]>();
  for (const line of backlog.split(/\r?\n/)) {
    if (!line.startsWith('| ') || !line.endsWith(' |')) continue;
    const cells = line.slice(2, -2).split(' | ');
    const id = cells[0];
    const status = cells.at(-1);
    if (cells.length < 4 || id === undefined || status === undefined) continue;
    if (!/^T-\d{3}$/.test(id)) continue;
    statuses.set(id, [...(statuses.get(id) ?? []), status]);
  }
  return statuses;
}

/**
 * Checks that a pull request for a ticket closes that ticket's issue and has updated the backlog.
 *
 * Input: the pull request's title and number, the text of BACKLOG.md at its head, and the
 * issues GitHub lists as closed by it. Output: the tickets the pull request is for and a list
 * of problems. For each ticket: one of the closed issues must have a title that starts with
 * `<id>:`, and BACKLOG.md must have exactly one row for it, with the status
 * `done (PR <number>)`. A pull request that names no ticket in its title and closes no ticket's
 * issue gives no tickets and no problems: docs and factory pull requests have nothing to link.
 * Failure: throws RangeError when `number` is not a positive integer.
 */
export function checkPrTicket(input: PrTicketInput): PrTicketResult {
  if (!Number.isSafeInteger(input.number) || input.number < 1) {
    throw new RangeError('the pull request number must be a positive integer');
  }
  const tickets = ticketsOf(input.title, input.closingIssues);
  const problems: string[] = [];
  if (tickets.length === 0) return { tickets, problems };

  if (input.closingIssues.length === 0) {
    problems.push(
      'GitHub lists no issue that this pull request closes; write a closing keyword in the body ' +
        '(for example "Closes #20"): a bare "(#20)" leaves the issue open after the merge',
    );
  } else {
    const closedList = input.closingIssues.map(issue => `#${issue.number}`).join(', ');
    for (const ticket of tickets) {
      if (!input.closingIssues.some(issue => issueTicket(issue) === ticket)) {
        problems.push(
          `this pull request closes ${closedList}, but none of them is the issue for ${ticket}: its title must start with "${ticket}:"`,
        );
      }
    }
  }

  const statuses = backlogStatuses(input.backlog);
  const expected = `done (PR ${input.number})`;
  for (const ticket of tickets) {
    const rows = statuses.get(ticket) ?? [];
    const status = rows[0];
    if (status === undefined) {
      problems.push(`BACKLOG.md has no row for ${ticket}`);
    } else if (rows.length > 1) {
      problems.push(`BACKLOG.md has ${rows.length} rows for ${ticket}, expected one`);
    } else if (status !== expected) {
      problems.push(`BACKLOG.md row for ${ticket} says "${visible(status)}", expected "${expected}"`);
    }
  }
  return { tickets, problems };
}

const CLOSING_ISSUES_QUERY = `query ($owner: String!, $name: String!, $number: Int!, $first: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      closingIssuesReferences(first: $first) { totalCount nodes { number title } }
    }
  }
}`;

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Reads GitHub's answer to the closing-issues query.
 *
 * Input: the parsed JSON body of the GraphQL response. Output: number and title of each issue.
 * Failure: throws Error when the response carries GraphQL errors, when the pull request is not
 * found, when any field has the wrong shape, or when the pull request closes more issues than
 * one request reads. Nothing is skipped or defaulted: a list that might be incomplete is an error.
 */
export function parseClosingIssues(response: unknown): ClosingIssue[] {
  const errors = field(response, 'errors');
  if (Array.isArray(errors) && errors.length > 0) {
    const message = field(errors[0], 'message');
    throw new Error(`GitHub reported an error: ${typeof message === 'string' ? message : 'no message'}`);
  }
  const pullRequest = field(field(field(response, 'data'), 'repository'), 'pullRequest');
  if (typeof pullRequest !== 'object' || pullRequest === null) throw new Error('GitHub did not find the pull request');
  const references = field(pullRequest, 'closingIssuesReferences');
  const totalCount = field(references, 'totalCount');
  const nodes = field(references, 'nodes');
  if (typeof totalCount !== 'number' || !Array.isArray(nodes)) throw new Error('GitHub sent no list of closing issues');
  if (totalCount > nodes.length) {
    throw new Error(`the pull request closes ${totalCount} issues, more than this check reads (${MAX_CLOSING_ISSUES})`);
  }
  return nodes.map(node => {
    const number = field(node, 'number');
    const title = field(node, 'title');
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1 || typeof title !== 'string') {
      throw new Error('GitHub sent a closing issue without a number and a title');
    }
    return { number, title };
  });
}

/**
 * The real lookup: one GitHub GraphQL request for the pull request's closing issues.
 *
 * Input: the repository as `owner/name` (already validated) and a token; GraphQL does not answer
 * anonymous requests. Output: a `ClosingIssuesLookup`. Failure: the lookup rejects on a network
 * error, on any status other than 200, and on everything `parseClosingIssues` rejects.
 */
export function githubClosingIssues(repository: string, token: string): ClosingIssuesLookup {
  const [owner, name] = repository.split('/');
  return async pullRequestNumber => {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'tracenotes-ticket-link',
      },
      body: JSON.stringify({
        query: CLOSING_ISSUES_QUERY,
        variables: { owner, name, number: pullRequestNumber, first: MAX_CLOSING_ISSUES },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 200) throw new Error(`GitHub answered ${response.status}`);
    return parseClosingIssues(await response.json());
  };
}

function errorLine(message: string): RunResult {
  return { code: 2, stdout: '', stderr: `error: ${message}\n` };
}

function detailOf(error: unknown): string {
  return visible(error instanceof Error ? error.message : String(error));
}

/**
 * Runs the check from command line arguments and environment variables, without touching the
 * process: the caller prints the streams and sets the exit code.
 *
 * Input: `args[0]` is the path of BACKLOG.md (default `BACKLOG.md`); `env` gives `PR_TITLE` and
 * `PR_NUMBER`, and, when no `lookup` is passed, `GITHUB_REPOSITORY` and `GITHUB_TOKEN`. `lookup`
 * replaces the GitHub request (tests pass a fake).
 * Output: exit code 0 with one line on stdout, 1 with one `ticket-link:` line per problem on
 * stderr, or 2 with one `error:` line on stderr for bad input, an unreadable backlog, or a
 * GitHub request that failed. Failure: never rejects.
 */
export async function run(
  args: string[],
  env: Record<string, string | undefined>,
  lookup?: ClosingIssuesLookup,
): Promise<RunResult> {
  const rawNumber = env['PR_NUMBER'] ?? '';
  if (!/^[1-9]\d*$/.test(rawNumber)) return errorLine('PR_NUMBER must be a positive integer');
  const number = Number(rawNumber);
  const title = env['PR_TITLE'] ?? '';

  let ask = lookup;
  if (ask === undefined) {
    const repository = env['GITHUB_REPOSITORY'] ?? '';
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      return errorLine('GITHUB_REPOSITORY must be owner/name');
    }
    const token = env['GITHUB_TOKEN'] ?? '';
    if (token === '') return errorLine('GITHUB_TOKEN is required to ask GitHub which issues the pull request closes');
    ask = githubClosingIssues(repository, token);
  }
  let closingIssues: ClosingIssue[];
  try {
    closingIssues = await ask(number);
  } catch (error) {
    return errorLine(`cannot ask GitHub which issues pull request ${number} closes: ${detailOf(error)}`);
  }

  if (ticketsOf(title, closingIssues).length === 0) {
    return {
      code: 0,
      stdout: 'ticket-link: neither the PR title nor an issue it closes names a ticket (T-NNN); nothing to check\n',
      stderr: '',
    };
  }

  const backlogPath = args[0] ?? 'BACKLOG.md';
  let backlog: string;
  try {
    backlog = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(backlogPath));
  } catch (error) {
    return errorLine(`cannot read ${visible(backlogPath)}: ${detailOf(error)}`);
  }

  let result: PrTicketResult;
  try {
    result = checkPrTicket({ title, number, backlog, closingIssues });
  } catch (error) {
    return errorLine(detailOf(error));
  }
  if (result.problems.length > 0) {
    return { code: 1, stdout: '', stderr: result.problems.map(problem => `ticket-link: ${problem}\n`).join('') };
  }
  return {
    code: 0,
    stdout: `ticket-link: ${result.tickets.join(', ')}: closes its issue, BACKLOG.md says done (PR ${rawNumber})\n`,
    stderr: '',
  };
}

// The only place this script touches the process (AGENTS.md, code conventions). Same entry
// check as src/cli.ts: pathToFileURL handles POSIX paths and Windows drive letters.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  run(process.argv.slice(2), process.env).then(result => {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.code;
  });
}
