# Day 6 evidence: Qodo Codebase Wisdom calls

Raw JSON output of every Qodo CLI call made while investigating T-004 on Nov 9, 2026.
Qodo CLI 2.1.0, skill `qodo-codebase-wisdom` 1.1.7. Every call ran as
`qodo read <group> <tool> <flags> --repo UBayouski/tracenotes --json`. The identity check
(`qodo read whoami`) is not saved because it contains account details.

| File | Call | Used for |
|---|---|---|
| `raw/01-search-repos.json` | `codebase search-repos --query tracenotes` | Resolve the repo slug |
| `raw/02-pr-stats.json` | `pull-request stats` | Failed: `MT-UPSTREAM-DOWN` |
| `raw/03-cross-repo.json` | `cross-repo relations` | No relations (single repo) |
| `raw/04-ls-src.json` | `codebase ls --path src` | Module layout, indexed SHA `76ca0e7` |
| `raw/05-issues.json` | `codebase list-issues --state all` | Ticket history (#4, #11) |
| `raw/06-prs.json` | `codebase list-prs --state all` | PR history (1 to 12) |
| `raw/10-grep-T004.json` | `codebase grep --pattern T-004` | Original wording and deferrals |
| `raw/11-grep-T010.json` | `codebase grep --pattern T-010` | URLs deferred to T-010 (fact 1) |
| `raw/12-grep-unclassified.json` | `codebase grep --pattern Unclassified` | T-006 overlap with T-003 |
| `raw/13-grep-url.json` | `codebase grep --pattern "https?://\|[Uu][Rr][Ll]" --regex extended --path-glob "src/**"` | No link base in `src/` (fact 1) |
| `raw/14-index.json` | `codebase read-file --path src/index.ts` | Grouping not exported (fact 3) |
| `raw/15-grep-markdown.json` | `codebase grep --pattern "[Mm]arkdown\|render" --regex extended` | Downstream tickets (T-016, T-022) |
| `raw/16-gitlog-types.json` | `codebase read-file --path src/gitlog.ts --start-line 14 --limit-lines 50` | `warnings` on `LoggedCommit` (fact 6) |
| `raw/17-readme-usage.json` | `codebase grep --pattern "repo\|link\|source" --path-glob README.md` | Product promise of links |
| `raw/18-similar.json` | `pull-request similar --query "render release notes markdown with commit links"` | Failed: `MT-UPSTREAM-DOWN` |
| `raw/19-grep-warnings.json` | `codebase grep --pattern warnings --path-glob "src/**"` | Warnings never reach `group.ts` (fact 6) |
| `raw/20-commits-group.json` | `codebase list-commits --path src/group.ts` | One commit, `d3b0d31` (PR 12) |
| `raw/21-pr12.json` | `codebase get-pr --number 12` | T-003 review: one finding, dismissed |
| `raw/22-review-pr12.json` | `codebase read-review-data --kind review_comments` | Failed: wrong `--kind` value |
| `raw/23-pr12-threads.json` | `codebase read-review-data --kind threads --change-number 12` | Failed: `MT-VALIDATION` |
