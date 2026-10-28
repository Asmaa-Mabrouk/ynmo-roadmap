import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Sprint planning: lines not on the roadmap or Monthly (or not assigned to the person) are highlighted; a Jira link or key can be pasted. Fake database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(600)
    f=A.evaluate("()=>{const it=__ynmo.items().find(i=>i.res&&i.res.length); return {t:it.t,p:it.res[0]}}")
    other=A.evaluate("p=>[...__ynmo.directory().keys()].find(n=>n!==p&&!__ynmo.items().some(i=>i.t&&(i.res||[]).includes(n)))",f['p'])
    sp=A.evaluate("()=>Object.keys(JSON.parse(localStorage.getItem('fk3')).sprints)[0]")
    seed={'h1':{'sp':sp,'k':'h','sq':'tifli','t':'','st':'planned','dn':'','tags':[],'ord':1},
      'p1':{'sp':sp,'k':'p','sq':'','t':f['p'],'st':'planned','dn':'','tags':[],'ord':2},
      's1':{'sp':sp,'k':'s','sq':'','t':f['t'],'st':'planned','dn':'','tags':[],'ord':3},
      's2':{'sp':sp,'k':'s','sq':'','t':'Brand new wallet idea nobody planned','st':'planned','dn':'','tags':[],'ord':4},
      's3':{'sp':sp,'k':'s','sq':'','t':'Urgent thing from support','st':'planned','dn':'','tags':['support'],'ord':5},
      'p2':{'sp':sp,'k':'p','sq':'','t':other,'st':'planned','dn':'','tags':[],'ord':6},
      's4':{'sp':sp,'k':'s','sq':'','t':f['t'],'st':'planned','dn':'','tags':[],'ord':7},
      's5':{'sp':sp,'k':'s','sq':'','t':'Done wallet idea','st':'done','dn':'2026-10-20','tags':[],'ord':8}}
    A.evaluate("d=>{const j=JSON.parse(localStorage.getItem('fk3')); Object.assign(j.sprint_items,d); localStorage.setItem('fk3',JSON.stringify(j))}",seed)
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(500)
    A.evaluate("id=>{location.hash='#/sprints/'+id}",sp); A.wait_for_timeout(900)
    chips=A.evaluate("()=>[...document.querySelectorAll('.blk .covchip')].map(c=>[c.closest('.blk').querySelector('.bt').textContent.trim(),c.dataset.state])")
    ok('S1 a line that is on the roadmap and assigned to its person has no chip', not any(t==f['t'] and s=='missing' for t,s in chips) and sum(1 for t,s in chips if t==f['t'])==1)
    ok('S2 a line nobody planned is marked "Not on the plan"', ['Brand new wallet idea nobody planned','missing'] in chips)
    ok('S3 the same feature under someone who is not assigned is marked as not assigned', [f['t'],'unassigned'] in chips)
    ok('S4 a #support line and a done line are not marked', not any(t in ('Urgent thing from support','Done wallet idea') for t,s in chips))
    ok('S5 the top bar counts them', '1 not on any roadmap' in A.locator('#covbar').inner_text() and '1 on the plan but not assigned' in A.locator('#covbar').inner_text())
    ok('S6 hovering explains what to do', 'Add it to the roadmap or to Monthly' in A.locator('.covchip.cov-missing').first.get_attribute('title'))
    # a Monthly card with the same words and the person assigned makes the line ok
    A.evaluate("()=>{const j=JSON.parse(localStorage.getItem('fk3')); j.reports=j.reports||{}; const d=j.reports.mo202611||{mo:'2026-11',lines:[],status:'draft'}; d.lines=d.lines||[]; d.lines.push({id:'c9',t:'Brand new wallet idea nobody planned',who:{be:{'%s':3}},pts:{be:3}}); j.reports.mo202611=d; localStorage.setItem('fk3',JSON.stringify(j))}"%f['p'])
    A.reload(); A.wait_for_timeout(1500); A.evaluate("id=>{location.hash='#/sprints/'+id}",sp); A.wait_for_timeout(900)
    chips=A.evaluate("()=>[...document.querySelectorAll('.blk .covchip')].map(c=>[c.closest('.blk').querySelector('.bt').textContent.trim(),c.dataset.state])")
    ok('S7 adding the card to Monthly with that person clears the mark', not any(t=='Brand new wallet idea nobody planned' for t,s in chips))
    # pasting a Jira address links the line
    A.evaluate("()=>{const j=JSON.parse(localStorage.getItem('fk3')); localStorage.setItem('fk3',JSON.stringify(j))}")
    h=A.locator('.blk.k-s .blkh').first; h.focus(); A.keyboard.press('Enter'); A.wait_for_timeout(250)
    A.locator('[role=dialog].cmenu .copt', has_text='Link to Jira').click(); A.wait_for_timeout(300)
    ok('S8 the Jira dialog opens on a paste field', A.locator('#jkpaste').count()==1 and A.evaluate("document.activeElement.id")=='jkpaste')
    A.fill('#jkpaste','https://ynmo.atlassian.net/browse/DYC-321'); A.click('#jkpastego'); A.wait_for_timeout(600)
    chip=A.locator('.blk.k-s a.jkchip').first
    ok('S9 the pasted address links the line: key shown and the chip opens that ticket', chip.inner_text()=='DYC-321' and chip.get_attribute('href')=='https://ynmo.atlassian.net/browse/DYC-321')
    ok('S10 no page errors', errs==[]); print('errors:',errs[:3])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
