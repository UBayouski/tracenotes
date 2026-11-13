import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hasInvestigation } from '../scripts/ticket-ready.ts';

// The guard in .github/workflows/agent-ticket.yml (FACTORY gate 1 on the label lane): the agent
// does not start on a ticket that was not checked against the code. Qodo local review finding
// e4ed609b: the guard was a grep inside the workflow, with no test.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repoRoot, 'scripts', 'ticket-ready.ts');
const CRLF = String.fromCharCode(0x0d, 0x0a);

describe('hasInvestigation', () => {
  test('the ticket format\'s bold label at the start of a line counts', () => {
    assert.equal(hasInvestigation('# T-028: x\n\n**Goal.** y\n\n**Investigation.** Checked with grep.'), true);
    assert.equal(hasInvestigation('**Investigation.** first line'), true);
  });

  test('a Markdown heading named Investigation counts', () => {
    assert.equal(hasInvestigation('# T-028: x\n\n## Investigation\n\nChecked.'), true);
    assert.equal(hasInvestigation('### Investigation\nChecked.'), true);
  });

  test('a body as GitHub sends it, with CRLF line endings, is read line by line', () => {
    assert.equal(hasInvestigation(['# T-028: x', '', '**Investigation.** Checked.', ''].join(CRLF)), true);
    assert.equal(hasInvestigation(['# T-028: x', '', '## Investigation', '', 'Checked.'].join(CRLF)), true);
  });

  test('the word alone, mid-line, or in another form does not count', () => {
    for (const body of [
      '',
      'No investigation was needed.',
      'See the **Investigation.** section of another ticket.',
      '**Investigation** without the full stop',
      '**investigation.** lower case',
      '## Investigations',
      '## Investigation notes',
      '#Investigation',
      '    **Investigation.** indented as code',
      '> **Investigation.** quoted',
    ]) {
      assert.equal(hasInvestigation(body), false, body);
    }
  });

  test('a section with nothing in it does not count', () => {
    assert.equal(hasInvestigation('**Investigation.**'), false);
    assert.equal(hasInvestigation('**Investigation.**   \n\n**Decisions.** none'), false);
    assert.equal(hasInvestigation('## Investigation\n\n## Next'), false);
    assert.equal(hasInvestigation('## Investigation\n\n'), false);
    assert.equal(hasInvestigation('## Investigation\n\nChecked the code.'), true);
    assert.equal(hasInvestigation('**Investigation.**\nChecked the code.'), true);
  });

  // Qodo PR review finding c51f36de.
  test('a heading section may start with a sub-heading or a bold phrase', () => {
    assert.equal(hasInvestigation('## Investigation\n\n### What was checked\n\nThe code.'), true);
    assert.equal(hasInvestigation('## Investigation\n\n**Checked.** The code.'), true);
    assert.equal(hasInvestigation('### Investigation\n\n#### Detail\ntext\n\n## Next'), true);
  });

  test('a heading section ends at a heading of the same or a higher level', () => {
    assert.equal(hasInvestigation('### Investigation\n\n### Next\ntext'), false);
    assert.equal(hasInvestigation('### Investigation\n\n## Higher\ntext'), false);
    assert.equal(hasInvestigation('## Investigation\n   \n# Top\ntext'), false);
  });

  // Qodo PR review finding 641e42e4: three backticks followed by more backticks on the same
  // line are inline code, not the start of a fence.
  test('a line that starts with an inline triple-backtick span does not hide the ticket', () => {
    assert.equal(hasInvestigation('```npm test``` passes\n\n**Investigation.** Checked.'), true);
    assert.equal(hasInvestigation('```ts\nconst a = 1;\n```\n\n**Investigation.** Checked.'), true);
    assert.equal(hasInvestigation('~~~ `x`\n**Investigation.** inside a tilde fence\n~~~'), false);
  });

  test('the section inside an HTML comment or a code fence does not count', () => {
    assert.equal(hasInvestigation('<!--\n**Investigation.** template text\n-->'), false);
    assert.equal(hasInvestigation('```\n**Investigation.** example\n```'), false);
  });

  test('a ticket of this repository written before the section existed is refused', () => {
    const ticket = readFileSync(path.join(repoRoot, 'tickets', 'T-008-config-ignore-patterns.md'), 'utf8');
    assert.equal(hasInvestigation(ticket), false);
  });
});

describe('ticket-ready as a child process', () => {
  function runScript(body: string | undefined) {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env['ISSUE_BODY'];
    if (body !== undefined) env['ISSUE_BODY'] = body;
    const result = spawnSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8', env });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  test('a ticket with an investigation: exit 0', () => {
    const { code, stdout, stderr } = runScript('# T: x\n\n**Investigation.** Checked.');
    assert.equal(code, 0, stderr);
    assert.equal(stdout, 'ticket-ready: the ticket has an Investigation section\n');
  });

  test('a ticket without one: exit 1, one line on stderr', () => {
    const { code, stdout, stderr } = runScript('# T: x\n\n**Goal.** y');
    assert.equal(code, 1);
    assert.equal(stdout, '');
    assert.equal(stderr, 'ticket-ready: the ticket has no Investigation section\n');
  });

  test('an empty or missing body is a ticket without one: exit 1', () => {
    assert.equal(runScript('').code, 1);
    assert.equal(runScript(undefined).code, 1);
  });
});
