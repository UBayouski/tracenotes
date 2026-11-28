## Unreleased

### Features

- **pages:** publish tracenotes' own release notes on every push to main (T-041) ([7c7a61d](https://github.com/UBayouski/tracenotes/commit/7c7a61dd9469c3cae4648beacf9811d96292e616))
- **parser:** match the commit header as received; rule 6 covers checks and needs a sweep (T-039) ([6a8d58b](https://github.com/UBayouski/tracenotes/commit/6a8d58b7eeed2e3c670563ab5c9c017c13de725f))
- **ci:** ticket-link says why a ticket is checked and what to do next (T-038) ([aa96299](https://github.com/UBayouski/tracenotes/commit/aa962990137a99683bb19458aed2de3e91d5d13a))
- **skills:** release-notes-audit skill with a tested audit script (T-032) ([9ba1863](https://github.com/UBayouski/tracenotes/commit/9ba1863d161bb912803101321623e8dddf069791))
- **check:** lint commit headers in a git log stream (T-009) ([d52ba69](https://github.com/UBayouski/tracenotes/commit/d52ba6901d8324b7f0db5d5db0b063048a788836))
- **render:** add --origin, link base from the origin remote without its credentials (T-010) ([03d4a17](https://github.com/UBayouski/tracenotes/commit/03d4a17d4ce6eca1f0a885181631b5653847e93e))
- **config:** add --config with ignore patterns and a quality gate (T-008) ([501f983](https://github.com/UBayouski/tracenotes/commit/501f9838e2321b5e616b8a2d4d34d2bcf85897c0), [#20](https://github.com/UBayouski/tracenotes/pull/20))
- **render:** add JSON output with --format json (T-007) ([7a1d606](https://github.com/UBayouski/tracenotes/commit/7a1d606f87b01c1bc8674d54af92190c783df311), [#19](https://github.com/UBayouski/tracenotes/pull/19))
- **version:** recommend the next version with the rule that produced it ([b2910fe](https://github.com/UBayouski/tracenotes/commit/b2910fecf52231fa7e2d8da34a182a085a5681d4), [#15](https://github.com/UBayouski/tracenotes/pull/15))
- **render:** render Markdown notes with a source link on every entry ([7f7af10](https://github.com/UBayouski/tracenotes/commit/7f7af10857fe20a1c0b42d245e5a7d4871e320c3), [#13](https://github.com/UBayouski/tracenotes/pull/13))
- **group:** group commits into release-note sections ([d3b0d31](https://github.com/UBayouski/tracenotes/commit/d3b0d315f0dac49c17f7ef0d988fc8aae225f41c), [#11](https://github.com/UBayouski/tracenotes/pull/11))
- parse git log streams from stdin (T-002) ([db554e5](https://github.com/UBayouski/tracenotes/commit/db554e520a47d3d14553640df0d02142fc412950))
- parse Conventional Commits messages (T-001) ([81eb447](https://github.com/UBayouski/tracenotes/commit/81eb4479a880cc19b2b493e4c3a472d9b84a89d2))

### Bug fixes

- **pages:** take the output path in one step, fixed modes, CR LF framing (T-041) ([fa898d8](https://github.com/UBayouski/tracenotes/commit/fa898d8f952f1de6075be05ef181201427c054ed))
- **ci:** say the first-commit red is expected only conditionally (T-038) ([5aac37f](https://github.com/UBayouski/tracenotes/commit/5aac37fe13e8d824414be5dfc3a67cfb32625697))
- **skills:** keep the audit's link scan linear and a stray bracket from hiding a link (T-037) ([62fd843](https://github.com/UBayouski/tracenotes/commit/62fd843f499e95d9720aa68393035539f4bc10e9))
- **ci:** fail closed on every line that mentions uses (T-034) ([4099677](https://github.com/UBayouski/tracenotes/commit/4099677592f4934ebb67fdd8c361a7835e6308e9))
- **cli:** escape user-supplied values in every usage error (T-031) ([f942ab5](https://github.com/UBayouski/tracenotes/commit/f942ab5d8c156d048d1615e8f1e57f9f018d2f8d))
- **skills:** without --config, only merge commits may be ignored (T-032) ([8b70fb8](https://github.com/UBayouski/tracenotes/commit/8b70fb816e57c7fdf8b754bbad81908548a90be1))
- **skills:** audit the breaking-change notes of each entry (T-032) ([37b35aa](https://github.com/UBayouski/tracenotes/commit/37b35aab6e240ec0919eb3f5cf03a6dde59a42c5))
- **skills:** accept only safe characters in pasted audit values (T-032) ([cc014f9](https://github.com/UBayouski/tracenotes/commit/cc014f95697e8a2e87dc91a06a01d9e7d8bce45d))
- **skills:** audit the exact note lines, footer and PR links; fresh-session evidence (T-032) ([73f8a1e](https://github.com/UBayouski/tracenotes/commit/73f8a1eece784e12bf8889388f340578fde5b012))
- **check:** list skipped merges, fail leading whitespace, escape more (T-009) ([3bb2f6c](https://github.com/UBayouski/tracenotes/commit/3bb2f6c54ce07dd086d827bab4b838b26f7fcbe8))
- **origin:** say which origin read failure happened, never git's output (T-010) ([5077949](https://github.com/UBayouski/tracenotes/commit/50779493f268d3166ecdbeca2514ee27071c9b4a))
- **origin:** never run a git.exe from the working folder; isolate test git config (T-010) ([21bc1b1](https://github.com/UBayouski/tracenotes/commit/21bc1b1e2e3c167018d244463dd0791bcd37891e))
- **hygiene:** show odd file names as escapes in the report (T-028) ([85dffae](https://github.com/UBayouski/tracenotes/commit/85dffae575dc3440eeaf8cc23207e3755d4de50e))
- **ci:** resolve the three informational findings on PR 22 ([e286eb9](https://github.com/UBayouski/tracenotes/commit/e286eb930d8f256ed22e249c1a85a0e7092bfc09))
- **ci:** resolve the PR 22 review findings on the ticket checks ([435b12e](https://github.com/UBayouski/tracenotes/commit/435b12e842d9a18ce3d85d5fee25b9907b069604))
- **config:** escape the config path in error lines (T-008) ([931d447](https://github.com/UBayouski/tracenotes/commit/931d447b6d21646af4427a63d90a079332253129), [#20](https://github.com/UBayouski/tracenotes/pull/20))
- **render:** validate repo URL port and up front, show usage on empty stdin, reject unsafe PR numbers (Qodo PR 14) ([eb0dce7](https://github.com/UBayouski/tracenotes/commit/eb0dce77ec906edb7556cc65ce945f9a864e3511))
- **cli:** print usage when stdin is a terminal ([8a5c41a](https://github.com/UBayouski/tracenotes/commit/8a5c41a3dc576ab090c78ff5f84cdf6e53cc56eb), [#4](https://github.com/UBayouski/tracenotes/pull/4))
- **gitlog:** report junk before the SHA as malformed; strip PowerShell BOM ([f8e9b11](https://github.com/UBayouski/tracenotes/commit/f8e9b11aa21d3b2bf8a3d4016ac376f7ff05d89f))
- address Qodo review findings on T-001 ([3450ffa](https://github.com/UBayouski/tracenotes/commit/3450ffa6a211640cf8183c4a5d4981f5cf5677e5))

### chore

- project scaffold, backlog, tickets, and journal ([3e332b1](https://github.com/UBayouski/tracenotes/commit/3e332b16354c76311078c4b9cb294c9cbf1af636))

### ci

- pin every workflow action to a commit SHA (T-034) ([8c87663](https://github.com/UBayouski/tracenotes/commit/8c8766342bd4d63af2b55548eed4e6aa68ed2120))
- required checks, ticket-link check and ticket guard (Day 10) ([1433e3d](https://github.com/UBayouski/tracenotes/commit/1433e3d4863bf0e2571ba2cea7925bbb82266497))
- **agent-ticket:** force tag mode with track\_progress so the agent gets the issue, a branch, and git ([2a74c31](https://github.com/UBayouski/tracenotes/commit/2a74c314bb8cfe41b9d95b00945f12830b9257cd))
- **agent-fix:** only push fixes to agent/\* branches; no AI trailers on human commits ([f9880ec](https://github.com/UBayouski/tracenotes/commit/f9880ec9ccf491bb0fe5cc2fce4e32a6e2d03132))
- label-triggered agent workflow, T-026 ticket, bot-commit exception on agent/\* (Day 4) ([71fb0c8](https://github.com/UBayouski/tracenotes/commit/71fb0c848f93d9325d10d995374780dac3169d09))

### docs

- **backlog:** T-041 done (PR 44) ([e5e29d9](https://github.com/UBayouski/tracenotes/commit/e5e29d9c8f19437cc5d35845d2f43a7e137905d7))
- **journal:** Day 19, rule 6 learns from its findings ([b804b04](https://github.com/UBayouski/tracenotes/commit/b804b04799f19ea269bf755af20ed77e6cd80450))
- **backlog:** T-039 done (PR 42) ([17b3ad3](https://github.com/UBayouski/tracenotes/commit/17b3ad3351cdc99efbd22cb07adf9f68c6856d65))
- **journal:** Day 18, a red build that explains itself ([a7b21d4](https://github.com/UBayouski/tracenotes/commit/a7b21d42c6afa34b134839100149df3a6ece9a53))
- **backlog:** T-038 done (PR 40) ([849171a](https://github.com/UBayouski/tracenotes/commit/849171a7fa523e6ed73c38a0b2c399c08f80a8b0))
- **day-17:** post link and accepted-decision screenshot ([5e9d05a](https://github.com/UBayouski/tracenotes/commit/5e9d05a20998ed6bf4baa4123ba864b136a5cd59))
- **day-17:** journal and evidence for the PR 16 decision review ([c48e791](https://github.com/UBayouski/tracenotes/commit/c48e791dba8fece934cbefc88e8c4a0f2cf973e6))
- **day-16:** post link ([2c4fc93](https://github.com/UBayouski/tracenotes/commit/2c4fc9331b7bbd5072e9718d3ef00394677987d0))
- **day-16:** journal and evidence after PR 38 ([35eb303](https://github.com/UBayouski/tracenotes/commit/35eb303c578aec829f53860b9662bede70d9588b))
- **backlog:** T-037 done (PR 38) ([6ab70d6](https://github.com/UBayouski/tracenotes/commit/6ab70d6a536c0a3a3e85722e6bd0bc7130c10fe2))
- **day-16:** journal and evidence for PR 36 ([99aa0a4](https://github.com/UBayouski/tracenotes/commit/99aa0a43bac1c02f2f103596e8566b7a4d56221d))
- **backlog:** T-035 done (PR 36) ([44fe418](https://github.com/UBayouski/tracenotes/commit/44fe418085a075be0b66b8bbf63686530297a19a))
- **day-15:** journal ([b349b8b](https://github.com/UBayouski/tracenotes/commit/b349b8b51f646db1fba59cf48ebb9f9fa9dc686c))
- **day-14:** approval step in FACTORY.md, journal and evidence ([17765f9](https://github.com/UBayouski/tracenotes/commit/17765f91a1b230a538e6513676d84c3b8d7ae30c))
- **backlog:** drop the T-034 row, PR 34 added it as done ([e7720ea](https://github.com/UBayouski/tracenotes/commit/e7720eac6a38dbfa6d088095720a63d31a9fb4dd))
- **backlog:** T-034 done (PR 34) ([024a686](https://github.com/UBayouski/tracenotes/commit/024a686132e9405e01151c84fd8ed8e6945b5d82))
- **backlog:** T-031 done (PR 33) ([d4bae4c](https://github.com/UBayouski/tracenotes/commit/d4bae4c9182dc0337b82d6b79f8f0a936f9c39a2))
- **journal:** Day 12 and 13 merged, post links ([532219f](https://github.com/UBayouski/tracenotes/commit/532219fc7eb311fce8090200d8c642a6b9fe0356))
- **backlog:** T-032 done (PR 30) ([4ad7bdd](https://github.com/UBayouski/tracenotes/commit/4ad7bddeb7051c774a3ae2327529d8f6ce327762))
- **journal:** Day 12, PR 28 gate met, lesson ([2142d2a](https://github.com/UBayouski/tracenotes/commit/2142d2ae5719ffe810f2728734a4e0e4f15ff2ac))
- **backlog:** T-009 done (PR 28) ([ef866b2](https://github.com/UBayouski/tracenotes/commit/ef866b218050e8a75200e49e2c21ad74f1a7d073))
- **journal:** Day 11, make the reviewer yours (PR 26 before/after) ([e211fe7](https://github.com/UBayouski/tracenotes/commit/e211fe7df7bd9dc7d3f4a7f4e1e5ae701047e32e))
- **review:** keep the Day 11 review guidelines in .pr\_agent.toml; evidence ([272cc47](https://github.com/UBayouski/tracenotes/commit/272cc4777b72f1f0c3b6151b2642c0a205410e02))
- correct FACTORY.md after review, README status for Day 10 ([38c8978](https://github.com/UBayouski/tracenotes/commit/38c897839b1b1bf3e455e768a74f09d5ce2846c3))
- correct FACTORY.md after review, README status for Day 10 ([ef500c8](https://github.com/UBayouski/tracenotes/commit/ef500c8c0f94eeb6cef188c6d047f0f954f6ad27))
- **factory:** FACTORY.md, the path from a ticket to main with its gates ([a2ac51e](https://github.com/UBayouski/tracenotes/commit/a2ac51e5b823b81d1979894d42f7c5a85e835bd1))
- **backlog:** mark T-028 done (PR 24) ([bb6c03e](https://github.com/UBayouski/tracenotes/commit/bb6c03ebfdc6c95a2c08b846ebfdf7c2430642a7))
- **journal:** record the PR 22 gate result and the dismissals ([9019690](https://github.com/UBayouski/tracenotes/commit/9019690b272f4baeccbd5a73538801b12d9ba7e8))
- add T-028 source hygiene to the backlog ([6dc9a90](https://github.com/UBayouski/tracenotes/commit/6dc9a90e17e8b454f24bdb685db76b20c48b19b8))
- **gate:** count a skipped review for docs-only commits, record the PR 21 result ([ca9f87e](https://github.com/UBayouski/tracenotes/commit/ca9f87e925a30d1cc538cff2080c6191f4ddc7fe))
- **agents:** let the agent act on its own on an open PR, stop on any question ([f3dc67b](https://github.com/UBayouski/tracenotes/commit/f3dc67b1f6b35e657dccd4e338b99927c2d57a58))
- Day 8 journal merge note and post link ([280c2fd](https://github.com/UBayouski/tracenotes/commit/280c2fd2f3d5123ffdea0a2cadb7c184688c6c9a))
- link Day 7 post in journal ([25903fb](https://github.com/UBayouski/tracenotes/commit/25903fb23322e41386ea52167494dba82d9375e5))
- T-005 done; Day 7 journal merge note ([3576d56](https://github.com/UBayouski/tracenotes/commit/3576d568f7bfbbab5bbeefc0c9a2cbc287bcab8d))
- Day 7 journal and Review Resolver evidence for PR 16 ([9a70ea3](https://github.com/UBayouski/tracenotes/commit/9a70ea37cde50664439956d86e97d43b64493562))
- Day 6 journal, T-004 ticket and Codebase Wisdom evidence; T-004 done ([04b7611](https://github.com/UBayouski/tracenotes/commit/04b761142b561a6804532c9ce011edee95698c9c))
- Day 5 addendum, T-003 via the factory; T-003 and T-026 done in backlog ([100c490](https://github.com/UBayouski/tracenotes/commit/100c4904b9ecbbdd34081c7dedd5b13561597a2a))
- Day 5 journal, import result and rule id ([89f9bc4](https://github.com/UBayouski/tracenotes/commit/89f9bc4149b996bdc96198d46b93583fbedff847))
- **agents:** rule 6 lists all existing framing; workflows push without per-push approval (Qodo PR 9) ([190db54](https://github.com/UBayouski/tracenotes/commit/190db54db339835910085338797c6cc2f696e1fd))
- **agents:** rule 6 Validate Before You Normalize from review history; push needs explicit approval (Day 5) ([e12a599](https://github.com/UBayouski/tracenotes/commit/e12a5994f2a0b0e19a5a042f65ef9a5bb495f993))
- **review:** set ignore\_bot\_pr in both sections; record the guard test ([91d3e81](https://github.com/UBayouski/tracenotes/commit/91d3e81770851f3a25a00ab21b89a68cddb78ecf))
- Day 4 journal; let Qodo review bot pushes on agent branches ([200e023](https://github.com/UBayouski/tracenotes/commit/200e023829b33fb0c90806e59e8bc56a0adf562d))
- require child-process CLI tests in AGENTS.md; record PR 2 review ([fa5e41a](https://github.com/UBayouski/tracenotes/commit/fa5e41ab7f80562b881d19e470ae4da4b559c05b))
- add AGENTS.md factory rules, Day 1 journal, and LF line-ending policy ([3af11aa](https://github.com/UBayouski/tracenotes/commit/3af11aadac003837acea5bc9c26023c09cf2a614))

### refactor

- **cli:** inject stdout/stderr sinks so tests stop patching process streams ([4ee70d0](https://github.com/UBayouski/tracenotes/commit/4ee70d041cf521dafffb7e97f440cee294fca5f1), [#4](https://github.com/UBayouski/tracenotes/pull/4))

### test

- **hygiene:** forbid raw invisible characters in TypeScript sources (T-028) ([3b09408](https://github.com/UBayouski/tracenotes/commit/3b09408388dcf62d0e2db238c1366215e4da0867))
- **version:** pin trigger order to render's section order; amend T-005 criterion 4 (Qodo PR 16) ([3e538a2](https://github.com/UBayouski/tracenotes/commit/3e538a2c2c057964f010b4b28eb5e0020a1daac9))
- **group:** pin that an indented Merge header is not ignored (Qodo PR 12) ([49c8632](https://github.com/UBayouski/tracenotes/commit/49c8632878e2d34547e0ae58d2a7d5876baba78d))

### Unclassified

- Journal updates. ([ebb67dd](https://github.com/UBayouski/tracenotes/commit/ebb67dd424ddef2c6959e947ee10a396a201b1e5))
- Journal updates ([bb917d0](https://github.com/UBayouski/tracenotes/commit/bb917d000b0a73ac7aeda6adbc52c04290dc91eb))
- Fixing Arnica findings ([8e15dc9](https://github.com/UBayouski/tracenotes/commit/8e15dc9a5a920b1c4ca6c5e29c5b1d06792a5daf))
- Arnica report ([8f88b60](https://github.com/UBayouski/tracenotes/commit/8f88b60d25e4e2aab258bc9212f6f4f18426b59e))
- fix(ci): do not keep the job token after checkout (T-035) ([fae957a](https://github.com/UBayouski/tracenotes/commit/fae957aa4b6d0daf6c4d38aca1f3f440ef722589))
- Journal updates ([9ccf4ec](https://github.com/UBayouski/tracenotes/commit/9ccf4ecac550bdc2ec1cdbaea65233deca151a5b))
- Journal updates ([76fe68c](https://github.com/UBayouski/tracenotes/commit/76fe68c2a6102556f766d5a5e546c868a307fefe))
- journal update ([dc33624](https://github.com/UBayouski/tracenotes/commit/dc3362453ad8306c17e1da5ae4cbc335376f5e52))
- Journl day 11 update ([d0b3721](https://github.com/UBayouski/tracenotes/commit/d0b3721ad0bb46c3c6a21e8e8489f57f5baad95a))
- Updating on journal entries ([05ab5f1](https://github.com/UBayouski/tracenotes/commit/05ab5f192ec5d448a63665ec323f00671b28d8b6))
- PR commit to resolve issue ([e3684e4](https://github.com/UBayouski/tracenotes/commit/e3684e441398c91cd8bf16a211137720b35005bf))

_98 of 126 commits shown; 28 merge commits ignored; 0 malformed records skipped._
