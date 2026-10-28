// Sprint lines against the plan: parseJira, sameWords, cover.
import { parseJira, sameWords, cover } from '../src/esm/features/sprint-cover.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const j1 = parseJira('https://ynmo.atlassian.net/browse/DYC-123'), j2 = parseJira('dyc-45'), j3 = parseJira('https://ynmo.atlassian.net/jira/software/projects/DYC/boards/1?selectedIssue=DYC-9');
ok('parse: an address gives the key and the site', j1 && j1.key === 'DYC-123' && j1.base === 'https://ynmo.atlassian.net');
ok('parse: a bare key in lower case works and has no site', j2 && j2.key === 'DYC-45' && j2.base === '');
ok('parse: a board address with selectedIssue gives that key', j3 && j3.key === 'DYC-9' && j3.base === 'https://ynmo.atlassian.net');
ok('parse: text without a key gives nothing', parseJira('hello world') === null && parseJira('') === null);
ok('words: same title with a Jira key and a tag matches', sameWords('Storage limit screen (DYC-1) #fix', 'storage limit screen'));
ok('words: one title contains the other', sameWords('Home sessions phase 1', 'Home sessions'));
ok('words: three of four words match', sameWords('Parent invoice download page', 'Invoice download page for parents') === true);
ok('words: unrelated titles do not match', !sameWords('Blue zone', 'Payment screen redesign'));
ok('words: one short word does not match a longer title', !sameWords('Fix', 'Fix login'));
const pool = [
  { kind: 'feature', t: 'Home Sessions Phase 1', where: 'H2', names: ['Ahmed Soliman', 'Mona Mohamed'] },
  { kind: 'card', t: 'Invoice download page', where: 'Monthly 2026-11', names: ['Aya Fathy'] },
  { kind: 'card', t: 'Child journey DYC-77', where: 'Monthly 2027-01', names: [] }
];
ok('cover: on the roadmap and assigned to the person is ok', cover({ t: 'Home sessions phase 1' }, 'Ahmed Soliman', pool).state === 'ok');
ok('cover: the short first name of the person is enough', cover({ t: 'Home sessions phase 1' }, 'Mona', pool).state === 'ok');
ok('cover: on the plan but the person is not assigned', cover({ t: 'Home sessions phase 1' }, 'Aya Fathy', pool).state === 'unassigned');
ok('cover: a Monthly card with the person counts', cover({ t: 'Invoice download page' }, 'Aya Fathy', pool).state === 'ok');
ok('cover: nothing matches means missing', cover({ t: 'Totally new idea about wallets' }, 'Aya Fathy', pool).state === 'missing');
ok('cover: a Jira key in the card title matches', cover({ t: 'Anything', jk: 'DYC-77' }, 'Aya Fathy', pool).state === 'unassigned');
ok('cover: a card with nobody assigned is not assigned to anyone', cover({ t: 'Child journey' }, 'Aya Fathy', pool).state === 'unassigned');
process.exit(bad ? 1 : 0);
