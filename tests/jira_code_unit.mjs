// A line with a Monthly card code and Jira tickets: export shows each once; a pull does not duplicate an extra ticket.
import { sprintDoc } from '../src/esm/features/sprint-export.js';
import { mergeJira } from '../src/esm/features/jira-merge.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const blocks = [{ id: 'h', k: 'h', sq: 'tifli' }, { id: 'p', k: 'p', t: 'Mona' }, { id: 's', k: 's', t: 'Sanar Integration (DYC-1) (TF#35)', jk: 'DYC-1', jx: ['DYC-2', 'FAS-3'], st: 'progress', tags: [] }];
const d = sprintDoc({ n: 1, a: '2026-11-01', b: '2026-11-14' }, blocks, { laneName: k => k, jiraUrl: k => 'https://x/browse/' + k, fmt: x => x });
const html = d.html || d.h || '', text = d.text || d.t || '';
ok('export: the main ticket is not repeated in the title, the card code stays, every ticket is a link', (html.match(/DYC-1/g) || []).length === 2 && html.includes('(TF#35)') && html.includes('browse/DYC-2') && html.includes('browse/FAS-3') && !html.includes('(DYC-1)'));
ok('export: the text version lists all keys once', /Sanar Integration \(TF#35\) \[[^\]]+\] DYC-1 DYC-2 FAS-3/.test(text));
const tk = (key, as) => ({ key, t: 'T ' + key, type: 'Story', sub: false, parent: '', project: key.split('-')[0], statusName: 'To Do', cat: 'new', assignee: as || 'Mona', email: '', done: '' });
const r = mergeJira(blocks, [tk('DYC-2'), tk('FAS-3'), tk('DYC-9')], { names: ['Mona'], squadOf: () => 'tifli', squadName: x => x });
ok('pull: an extra ticket of a line is known (no new line), a really new ticket is added', r.added === 1 && r.inserts.length === 1 && JSON.stringify(r.inserts[0].specs).includes('DYC-9') && !JSON.stringify(r.inserts).includes('DYC-2'));
process.exit(bad ? 1 : 0);
