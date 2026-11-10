# Day 7 evidence — Review Resolver on PR 16

Raw JSON from `qodo-review-resolver` 1.4.9, Qodo CLI 2.2.0. See `journal/day-07.md`.

| File | Command | State |
|---|---|---|
| `findings-1-extended.json` | `qodo read pr-review-session findings --pr-url .../pull/16 --extended --json` | run 1893958, completed at `b2910fe`, 1 open finding (06d9643f) |
| `findings-2-extended.json` | same | run 1894133, completed at `3e538a2`, 2 open findings (06d9643f, e5462b0d) |
| `dismiss-result.json` | `qodo pr-review-session dismiss --finding-ids 06d9643f-...,e5462b0d-... --reason intentional --explanation "..." --json` | both `dismissed`, `reconciled: true` |
| `findings-3-after-dismiss.json` | same read as above | run 1894133 at `3e538a2`, both findings `dismissed`, none open |
