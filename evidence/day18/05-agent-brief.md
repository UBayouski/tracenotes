You are investigating one failed GitHub Actions job. You have a read-only copy of the repository at the failed commit in the current directory. Do not modify files. Answer in under 350 words.

Repository: UBayouski/tracenotes (public). Pull request #38, title "Fixing Arnica findings".
Failed job: https://github.com/UBayouski/tracenotes/actions/runs/45255214509/job/137975120905
Workflow "Ticket link", job "ticket-link", attempt 1, commit 8e15dc9. Attempt 2 of the same job on the same commit failed with the same lines.
Steps: Set up job (success), checkout (success), setup-node (success), "A ticket PR closes its own issue and has updated the backlog" (failure).

Verified source log excerpt (the failing step, token masked by GitHub):
  Run node scripts/pr-ticket-check.ts BACKLOG.md
  env: GITHUB_TOKEN: *** / PR_TITLE: Fixing Arnica findings / PR_NUMBER: 38
  ticket-link: BACKLOG.md row for T-037 says "planned", expected "done (PR 38)"
  ##[error]Process completed with exit code 1.

Qodo CI failure feedback: requested with `/checks "<job URL>"` on the PR. Qodo replied: "The /checks command by Qodo was deprecated on the 1st of October 2026 and is no longer available." So there is no Qodo diagnosis.

Task:
1. Investigate ONE cause. Separate what the log proves from what you infer.
2. Cite the files and lines in this checkout that support it (workflow, script, tests, backlog, any docs on the process).
3. Say whether this is a bug in the application code, in the check, in the process, or in the environment.
4. Propose a change only if the evidence justifies one. If no code change is needed, say what the next step is instead. If you think the check's message could be more useful, say exactly how, without weakening the check.
