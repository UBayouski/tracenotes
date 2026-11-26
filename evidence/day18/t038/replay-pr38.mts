// Day 18 replay: the PR 38 failure (backlog at 8e15dc9, title, number 38, closes #37) through the T-038 check.
// Usage: git show 8e15dc9:BACKLOG.md > b.md && node evidence/day18/t038/replay-pr38.mts b.md
import { run } from '../../../scripts/pr-ticket-check.ts';
const r = await run([process.argv[2]!], { PR_TITLE: 'Fixing Arnica findings', PR_NUMBER: '38' },
  async () => [{ number: 37, title: 'T-037: (title not printed)' }]);
process.stdout.write(`exit ${r.code}\n--- stderr\n${r.stderr}`);
