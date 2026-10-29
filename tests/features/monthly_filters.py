import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Monthly: filter the cards by the person they are assigned to (people given points) and by points. Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    oc=A.locator('.mdcol[data-mo="2026-10"]'); oc.locator('.mdopen').click(); ta=oc.locator('.mdadd textarea')
    for t in ['Card one','Card two','Card three']:
        ta.fill(t); ta.press('Enter'); A.wait_for_timeout(450)
    A.keyboard.press('Escape'); A.wait_for_timeout(300)
    A.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('fk3'));const m=d.reports.mo202610;const by={'Card one':{fe:{'Amal Saleem':5},be:{'Ahmed Soliman':3}},'Card two':{fe:{'Amal Saleem':8}}};
      m.lines.forEach(l=>{if(by[l.t]){l.who=by[l.t];l.pts={};Object.keys(by[l.t]).forEach(k=>{l.pts[k]=Object.values(by[l.t][k]).reduce((a,v)=>a+v,0)})}});localStorage.setItem('fk3',JSON.stringify(d));}""")
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(700)
    n=lambda: A.locator('.mdcol[data-mo="2026-10"] .mdcard').count()
    ok('F1 three cards at first', n()==3)
    who=A.locator('select[aria-label="Filter by assigned person"]'); pts=A.locator('select[aria-label="Filter by points"]')
    ok('F2 the person list has only people with points', 'Amal Saleem' in who.inner_text() and 'Ahmed Soliman' in who.inner_text() and who.locator('option').count()==3)
    who.select_option('Ahmed Soliman'); A.wait_for_timeout(400)
    ok('F3 Ahmed Soliman: only Card one', n()==1 and A.locator('.mdcol[data-mo="2026-10"] .mdcard:has-text("Card one")').count()==1)
    who.select_option('Amal Saleem'); A.wait_for_timeout(400)
    ok('F4 Amal Saleem: Card one and Card two', n()==2)
    A.locator('select[aria-label="Filter by points"]').select_option('8'); A.wait_for_timeout(400)
    ok('F5 Amal with 8 points: only Card two', n()==1 and A.locator('.mdcol[data-mo="2026-10"] .mdcard:has-text("Card two")').count()==1)
    A.locator('select[aria-label="Filter by assigned person"]').select_option('all'); A.locator('select[aria-label="Filter by points"]').select_option('none'); A.wait_for_timeout(400)
    ok('F6 no points yet: only Card three', n()==1 and A.locator('.mdcol[data-mo="2026-10"] .mdcard:has-text("Card three")').count()==1)
    A.locator('select[aria-label="Filter by points"]').select_option('with'); A.wait_for_timeout(400)
    ok('F7 with points: Card one and Card two', n()==2)
    ok('F8 no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
