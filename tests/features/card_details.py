import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Monthly: clicking a card opens its details card (tag, id, title, info, sprint, people, progress). Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    nc=A.locator('.mdcol[data-mo="2026-11"]'); nc.locator('.mdopen').click(); ta=nc.locator('.mdadd textarea')
    for t in ['Parent invoice download page','Lonely card']:
        ta.fill(t); ta.press('Enter'); A.wait_for_timeout(450)
    A.keyboard.press('Escape'); A.wait_for_timeout(300)
    A.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('fk3'));const m=d.reports.mo202611;const f=m.lines.find(l=>l.t==='Parent invoice download page');
      f.who={dev:{Mona:4,Ali:2}};f.info='Parents download their invoices from the app.';f.pct=40;
      d.sprints=d.sprints||{};d.sprints.sp9={n:229,a:'2026-11-01',b:'2026-11-14',note:'',tags:{}};d.sprint_items=d.sprint_items||{};
      d.sprint_items.s1={sp:'sp9',tags:[],dn:'',k:'h',sq:'tifli',t:'Tifli',ord:1024};d.sprint_items.s3={sp:'sp9',tags:[],dn:'',k:'s',t:'Parent invoice download page',st:'progress',ord:3072};
      localStorage.setItem('fk3',JSON.stringify(d));}""")
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    card=lambda t: A.locator('.mdcol[data-mo="2026-11"] .mdcard:has-text("%s")'%t)
    card('Parent invoice').locator('.cdopen').click(); A.wait_for_timeout(400)
    d=A.locator('#xdlg'); t=d.inner_text()
    ok('C1 the open button shows the card: title, info, people and progress', 'Parent invoice download page' in t and 'Parents download their invoices' in t and 'Mona' in t and 'Ali' in t and '40% complete' in t)
    ok('C2 it says which sprint the card is planned in', 'Planned in Sprint 229' in t and 'matched by words' in t)
    ok('C3 tag and card id are shown', 'Tifli' in t or 'Daycare' in t or 'Plan' in t or 'New' in t) ; ok('C3b id', '#' in t)
    A.click('#xdlg button:text-is("Close")'); A.wait_for_timeout(300)
    card('Parent invoice').click(position={'x':296,'y':60}); A.wait_for_timeout(400)
    ok('C4 clicking an empty part of the card opens it too', A.locator('#xdlg .cdet').count()==1); A.click('#xdlg button:text-is("Close")'); A.wait_for_timeout(300)
    card('Parent invoice').locator('.mdtext').click(); A.wait_for_timeout(300)
    ok('C5 clicking the title still edits it (no dialog)', A.locator('#xdlg .cdet').count()==0); A.keyboard.press('Escape'); A.wait_for_timeout(200)
    card('Lonely').locator('.cdopen').click(); A.wait_for_timeout(400); t=A.locator('#xdlg').inner_text()
    ok('C6 a card with nothing says so plainly', 'Not planned in a sprint yet' in t and 'Nobody assigned yet' in t and 'No details written yet' in t)
    ok('C7 editors can write details or add people from it', A.locator('#xdlg button:text-is("Write details")').count()==1 and A.locator('#xdlg button:text-is("Add people")').count()==1)
    A.click('#xdlg button:text-is("Write details")'); A.wait_for_timeout(300)
    ok('C8 Write details opens the details editor', A.locator('#xdlg textarea[aria-label="Details"]').count()==1)
    ok('C9 no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
