import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Monthly: a save never wipes cards another person added in the meantime (stale screen). Fake database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def add(P,mo,text):
    c=P.locator('.mdcol[data-mo="%s"]'%mo); (c.locator('.mdopen').click() if c.locator('.mdopen').count() and c.locator('.mdopen').first.is_visible() else None); ta=c.locator('.mdadd textarea'); ta.fill(text); ta.press('Enter'); P.wait_for_timeout(600); P.keyboard.press('Escape'); P.wait_for_timeout(250)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    add(A,'2026-10','mine-1')
    # another person (Dr Abdullah) adds two cards straight into the stored month; this screen has not refreshed yet
    A.evaluate("""()=>{const k=JSON.parse(localStorage.getItem('fk3')); const d=k.reports.mo202610; d.lines.push({id:'ext1',t:'cto-card-1',k:'tifli',no:201,st:'planned'},{id:'ext2',t:'cto-card-2',k:'ai',no:202,st:'planned'}); localStorage.setItem('fk3',JSON.stringify(k)); window.__noRefresh=1;}""")
    add(A,'2026-10','mine-2')
    names=A.evaluate("()=>JSON.parse(localStorage.getItem('fk3')).reports.mo202610.lines.map(l=>l.t)")
    ok('M1 the stored month keeps both cards added by the other person %s'%names, 'cto-card-1' in names and 'cto-card-2' in names and 'mine-1' in names and 'mine-2' in names)
    ok('M2 no card appears twice', len(names)==len(set(names)))
    A.wait_for_timeout(400)
    ok('M3 the board shows them and says so', A.locator('.mdcard:has-text("cto-card-1")').count()==1)
    A.evaluate("""()=>{const k=JSON.parse(localStorage.getItem('fk3')); const d=k.reports.mo202610; d.lines=d.lines.filter(l=>l.t!=='mine-1'); localStorage.setItem('fk3',JSON.stringify(k));}""")
    add(A,'2026-10','mine-3')
    n2=A.evaluate("()=>JSON.parse(localStorage.getItem('fk3')).reports.mo202610.lines.map(l=>l.t)")
    ok('M4 normal saves still work (new card added, nothing else duplicated)', 'mine-3' in n2 and len(n2)==len(set(n2)))
    ok('no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R))
