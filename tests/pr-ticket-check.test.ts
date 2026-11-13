import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkPrTicket, parseClosingIssues, run } from '../scripts/pr-ticket-check.ts';
import type { ClosingIssue, ClosingIssuesLookup } from '../scripts/pr-ticket-check.ts';

// The factory's ticket-link check (FACTORY gate 5). It exists because of PR 21: the body said
// "(#20)" instead of "Closes #20", so the issue stayed open after the merge, and BACKLOG.md said
// "done (issue #20)" (Qodo finding cf1c4585). Nothing checked either.
//
// Which issues a pull request closes is GitHub's decision, so the check asks GitHub
// (closingIssuesReferences) instead of reading the body. An earlier version parsed closing
// keywords out of the Markdown itself and collected a new finding with every fix
// (journal/day-10.md). No network, no git here: every test passes a fake lookup.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repoRoot, 'scripts', 'pr-ticket-check.ts');

const backlog = [
  '# Backlog',
  '',
  '| ID | Title | Day | Status |',
  '|---|---|---|---|',
  '| T-007 | JSON output mode | 08 Nov 11 | done (PR 19) |',
  '| T-008 | Config file with ignore patterns | 09 Nov 12 | done (PR 21) |',
  '| T-009 | `check` command | 10 Nov 13 | planned |',
  '',
].join('\n');

const issue1: ClosingIssue = { number: 1, title: 'Unrelated bug report' };
const issue18: ClosingIssue = { number: 18, title: 'T-007: JSON output mode for machine consumers' };
const issue20: ClosingIssue = { number: 20, title: 'T-008: Config file with ignore patterns' };
const issue30: ClosingIssue = { number: 30, title: 'T-009: `check` command' };

function check(title: string, closingIssues: ClosingIssue[], number: number, backlogText = backlog) {
  return checkPrTicket({ title, number, backlog: backlogText, closingIssues });
}

describe('checkPrTicket', () => {
  test('a ticket PR that closes its own issue and has the backlog row set passes', () => {
    assert.deepEqual(check('feat(config): add --config with ignore patterns (T-008)', [issue20], 21), {
      tickets: ['T-008'],
      problems: [],
    });
  });

  test('the PR 21 case: the title names a ticket and GitHub lists no issue to close', () => {
    const result = check('feat(config): add --config with ignore patterns and a quality gate (T-008) (#20)', [], 21);
    assert.deepEqual(result.tickets, ['T-008']);
    assert.deepEqual(result.problems, [
      'GitHub lists no issue that this pull request closes; write a closing keyword in the body ' +
        '(for example "Closes #20"): a bare "(#20)" leaves the issue open after the merge',
    ]);
  });

  // Qodo local review finding aad38bfd: `Closes #1` passed for T-008, whose issue is #20.
  test('closing an issue that is not the ticket\'s is a problem', () => {
    assert.deepEqual(check('feat: x (T-008)', [issue1], 21).problems, [
      'this pull request closes #1, but none of them is the issue for T-008: its title must start with "T-008:"',
    ]);
  });

  // Qodo local review finding 48562f07: "T-027: work split from T-008" is T-027's issue.
  test('an issue is the ticket\'s own only when its title starts with the id and a colon', () => {
    const titles = ['T-0081: something else', 'about T-008', ' T-008: leading space', 'T-008 without the colon', 't-008: lower case'];
    for (const title of titles) {
      const result = check('feat: x (T-008)', [{ number: 5, title }], 21);
      assert.deepEqual(result.problems, [
        'this pull request closes #5, but none of them is the issue for T-008: its title must start with "T-008:"',
      ], title);
    }
    const split = check('feat: x (T-008)', [{ number: 7, title: 'T-027: work split from T-008' }], 21);
    assert.deepEqual(split.tickets, ['T-008', 'T-027']);
    assert.equal(split.problems[0], 'this pull request closes #7, but none of them is the issue for T-008: its title must start with "T-008:"');
  });

  test('the ticket\'s issue among other closed issues is enough', () => {
    assert.deepEqual(check('feat: x (T-008)', [issue1, issue20], 21).problems, []);
  });

  // Qodo local review finding 823561fb: PRs 7, 12, 14 and 16 had titles with only an issue
  // number, "feat(version): ... (#15)". The issue they close says which ticket they are for.
  test('a PR that closes a ticket\'s issue is a ticket PR even when its title has no id', () => {
    assert.deepEqual(check('feat(check): lint a range (#30)', [issue30], 31), {
      tickets: ['T-009'],
      problems: ['BACKLOG.md row for T-009 says "planned", expected "done (PR 31)"'],
    });
    const done = backlog.replace('| planned |', '| done (PR 31) |');
    assert.deepEqual(check('feat(check): lint a range (#30)', [issue30], 31, done), { tickets: ['T-009'], problems: [] });
  });

  test('a PR that names no ticket and closes no ticket\'s issue has nothing to check', () => {
    assert.deepEqual(check('docs: Day 7 journal and Review Resolver evidence', [], 17), { tickets: [], problems: [] });
    assert.deepEqual(check('fix: typo', [issue1], 40), { tickets: [], problems: [] });
  });

  test('a ticket from the title and one from a closed issue are both checked', () => {
    // A T-008 pull request that closes T-007's issue: wrong issue for T-008, and it would
    // close T-007, whose backlog row does not belong to this pull request.
    assert.deepEqual(check('feat: x (T-008)', [issue18], 21), {
      tickets: ['T-008', 'T-007'],
      problems: [
        'this pull request closes #18, but none of them is the issue for T-008: its title must start with "T-008:"',
        'BACKLOG.md row for T-007 says "done (PR 19)", expected "done (PR 21)"',
      ],
    });
  });

  test('the backlog row must say done with this PR number', () => {
    assert.deepEqual(check('feat(check): lint a range (T-009)', [issue30], 31).problems, [
      'BACKLOG.md row for T-009 says "planned", expected "done (PR 31)"',
    ]);
    assert.deepEqual(check('fix(config): follow-up (T-008)', [issue20], 22).problems, [
      'BACKLOG.md row for T-008 says "done (PR 21)", expected "done (PR 22)"',
    ]);
  });

  test('a ticket with no backlog row is a problem', () => {
    const result = check('feat: x (T-099)', [{ number: 2, title: 'T-099: something' }], 3);
    assert.deepEqual(result.problems, ['BACKLOG.md has no row for T-099']);
  });

  // Qodo local review finding 0cc845e7: an appended second row hid the stale first one.
  test('two backlog rows for one ticket are a problem, whatever they say', () => {
    const appended = `${backlog}| T-009 | \`check\` command | 10 Nov 13 | done (PR 31) |\n`;
    assert.deepEqual(check('feat(check): lint a range (T-009)', [issue30], 31, appended).problems, [
      'BACKLOG.md has 2 rows for T-009, expected one',
    ]);
  });

  test('two tickets in one title are both checked, each once', () => {
    const result = check('feat: x (T-007, T-008) T-007', [issue18], 19);
    assert.deepEqual(result.tickets, ['T-007', 'T-008']);
    assert.deepEqual(result.problems, [
      'this pull request closes #18, but none of them is the issue for T-008: its title must start with "T-008:"',
      'BACKLOG.md row for T-008 says "done (PR 21)", expected "done (PR 19)"',
    ]);
  });

  test('an id that is part of a longer token is not a ticket', () => {
    for (const title of ['feat: x (T-0081)', 'feat: x (AT-008)', 'feat: x (t-008)']) {
      assert.deepEqual(check(title, [], 1).tickets, [], title);
    }
  });

  test('CRLF line endings in BACKLOG.md are read as line endings', () => {
    const crlf = backlog.replaceAll('\n', String.fromCharCode(0x0d, 0x0a));
    assert.deepEqual(check('feat: x (T-008)', [issue20], 21, crlf).problems, []);
  });

  test('a status is compared as written: extra spaces or other text do not pass', () => {
    const padded = backlog.replace('| done (PR 21) |', '|  done (PR 21) |');
    assert.deepEqual(check('feat: x (T-008)', [issue20], 21, padded).problems, [
      'BACKLOG.md row for T-008 says " done (PR 21)", expected "done (PR 21)"',
    ]);
  });

  test('control and invisible characters in a status are printed as escapes, on one line', () => {
    const forged = backlog.replace('| planned |', '| planned' + String.fromCharCode(0x2028) + '::error::forged' + String.fromCharCode(0x7f) + ' |');
    assert.deepEqual(check('feat: x (T-009)', [issue30], 31, forged).problems, [
      'BACKLOG.md row for T-009 says "planned\\u2028::error::forged\\u007f", expected "done (PR 31)"',
    ]);
  });

  test('a PR number that is not a positive integer is rejected', () => {
    for (const number of [0, -1, 1.5, Number.NaN]) {
      assert.throws(() => check('', [], number), RangeError);
    }
  });
});

describe('parseClosingIssues', () => {
  const response = (pullRequest: unknown) => ({ data: { repository: { pullRequest } } });
  const references = (nodes: unknown, totalCount: unknown) => response({ closingIssuesReferences: { totalCount, nodes } });

  test('reads number and title of each issue GitHub lists', () => {
    assert.deepEqual(parseClosingIssues(references([{ number: 18, title: 'T-007: JSON output' }], 1)), [
      { number: 18, title: 'T-007: JSON output' },
    ]);
    assert.deepEqual(parseClosingIssues(references([], 0)), []);
  });

  test('more issues than one page holds is an error, not a shorter list', () => {
    assert.throws(() => parseClosingIssues(references([{ number: 1, title: 'a' }], 2)), /closes 2 issues, more than this check reads/);
  });

  test('a GraphQL error, a missing pull request or a malformed answer is an error', () => {
    const malformed: unknown[] = [
      null,
      'text',
      {},
      { errors: [{ message: 'Bad credentials' }] },
      { data: null },
      { data: { repository: null } },
      response(null),
      response({}),
      references(null, 0),
      references([{ number: '18', title: 'x' }], 1),
      references([{ number: 18 }], 1),
      references([{ number: 0, title: 'x' }], 1),
      references([null], 1),
      references([], '0'),
    ];
    for (const value of malformed) {
      assert.throws(() => parseClosingIssues(value), Error, JSON.stringify(value));
    }
  });

  test('the message of a GraphQL error is passed on', () => {
    assert.throws(() => parseClosingIssues({ errors: [{ message: 'Bad credentials' }] }), /Bad credentials/);
  });
});

describe('run (in process, with a fake lookup)', () => {
  const backlogPath = path.join(repoRoot, 'BACKLOG.md');
  const closes = (...issues: ClosingIssue[]): ClosingIssuesLookup => async () => issues;
  const env = (title: string, number: string) => ({ PR_TITLE: title, PR_NUMBER: number });
  const nothingToCheck = {
    code: 0,
    stdout: 'ticket-link: neither the PR title nor an issue it closes names a ticket (T-NNN); nothing to check\n',
    stderr: '',
  };

  test('writes nothing itself: the result carries the exit code and both streams', async () => {
    // T-001 is done in the real BACKLOG.md with the plain status "done".
    const result = await run([backlogPath], env('feat: x (T-001)', '999999'), closes(issue1));
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(result.stderr.trimEnd().split('\n'), [
      'ticket-link: this pull request closes #1, but none of them is the issue for T-001: its title must start with "T-001:"',
      'ticket-link: BACKLOG.md row for T-001 says "done", expected "done (PR 999999)"',
    ]);
  });

  test('GitHub is asked once, for this pull request', async () => {
    const asked: number[] = [];
    const counting: ClosingIssuesLookup = async number => { asked.push(number); return []; };
    assert.deepEqual(await run([backlogPath], env('docs: journal', '5'), counting), nothingToCheck);
    assert.deepEqual(asked, [5]);
  });

  test('a PR without a ticket id that closes an ordinary issue has nothing to check', async () => {
    assert.deepEqual(await run([backlogPath], env('fix: typo', '5'), closes(issue1)), nothingToCheck);
  });

  test('a PR without a ticket id that closes a ticket\'s issue is checked', async () => {
    // Issue 18 is T-007's; the real BACKLOG.md says "done (PR 19)" for it.
    const result = await run([backlogPath], env('feat(render): JSON output (#18)', '19'), closes(issue18));
    assert.deepEqual(result, { code: 0, stdout: 'ticket-link: T-007: closes its issue, BACKLOG.md says done (PR 19)\n', stderr: '' });
    const other = await run([backlogPath], env('feat(render): JSON output (#18)', '20'), closes(issue18));
    assert.equal(other.code, 1);
    assert.equal(other.stderr, 'ticket-link: BACKLOG.md row for T-007 says "done (PR 19)", expected "done (PR 20)"\n');
  });

  test('a lookup that fails is an error, not a pass: exit 2, one line', async () => {
    const failing: ClosingIssuesLookup = async () => { throw new Error('GitHub answered 503\nerror: forged'); };
    const result = await run([backlogPath], env('feat: x (T-001)', '5'), failing);
    assert.equal(result.code, 2);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'error: cannot ask GitHub which issues pull request 5 closes: GitHub answered 503\\u000aerror: forged\n');
  });

  test('an unreadable backlog path: exit 2 with one error line', async () => {
    const result = await run(['no-such-dir/BACKLOG\n.md'], env('feat: x (T-001)', '1'), closes());
    assert.equal(result.code, 2);
    assert.equal(result.stderr.trimEnd().split('\n').length, 1, result.stderr);
    assert.match(result.stderr, /^error: cannot read /);
  });
});

describe('pr-ticket-check as a child process', () => {
  function runScript(env: Record<string, string>) {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, PR_TITLE: '', PR_NUMBER: '', GITHUB_REPOSITORY: '', GITHUB_TOKEN: '', ...env },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  // Each case stops before any request is made, so no network is used.
  test('PR_NUMBER is validated as received: exit 2', () => {
    for (const value of ['', ' 21', '21 ', '021', 'abc', '2.0']) {
      const { code, stdout, stderr } = runScript({ PR_TITLE: 'feat: x (T-001)', PR_NUMBER: value });
      assert.equal(code, 2, JSON.stringify(value));
      assert.equal(stdout, '');
      assert.equal(stderr, 'error: PR_NUMBER must be a positive integer\n');
    }
  });

  test('GITHUB_REPOSITORY must be owner/name: exit 2', () => {
    for (const repository of ['', 'not a repo', 'a/b/c', 'owner/repo?x=1']) {
      const { code, stderr } = runScript({ PR_TITLE: 'feat: x (T-001)', PR_NUMBER: '5', GITHUB_REPOSITORY: repository, GITHUB_TOKEN: 'x' });
      assert.equal(code, 2, repository);
      assert.equal(stderr, 'error: GITHUB_REPOSITORY must be owner/name\n');
    }
  });

  test('a missing GITHUB_TOKEN is an error: exit 2', () => {
    const { code, stderr } = runScript({ PR_TITLE: 'docs: journal', PR_NUMBER: '5', GITHUB_REPOSITORY: 'owner/name' });
    assert.equal(code, 2);
    assert.equal(stderr, 'error: GITHUB_TOKEN is required to ask GitHub which issues the pull request closes\n');
  });
});
