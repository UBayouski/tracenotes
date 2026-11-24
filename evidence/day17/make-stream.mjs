// Synthetic git log stream: sha \x1f author \x1f date \x1f message \x1e
const msgs = ['feat(api)!: rename the render option', 'feat: add --since', 'fix: keep trailing newline', 'docs: readme'];
const shas = ['a','b','c','d'];
process.stdout.write(msgs.map((m,i)=>`${shas[i].repeat(40)}\x1fSynthetic\x1f2026-11-01T00:00:00Z\x1f${m}\x1e\n`).join(''));
