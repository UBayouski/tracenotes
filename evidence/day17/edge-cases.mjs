const r=(sha,m)=>`${sha.repeat(40)}\x1fSynthetic\x1f2026-11-01T00:00:00Z\x1f${m}\x1e\n`;
const c=process.argv[2];
if(c==='footer') process.stdout.write(r('a','fix: change output\n\nBREAKING CHANGE: the JSON shape changed')+r('b','feat: add --since'));
if(c==='revert') process.stdout.write(r('a','feat!: drop --old')+r('b','revert: feat!: drop --old\n\nThis reverts commit aaaaaaa.'));
if(c==='plain') process.stdout.write(r('b','feat: add --since'));
