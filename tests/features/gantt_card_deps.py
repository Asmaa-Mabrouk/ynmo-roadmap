import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Gantt: a line joins two roadmap bars when their Monthly cards are linked with Needs card (dashed), next to the lines of Depends on…; the dependency chip counts them."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def to_roadmap(P,col,title,a,b):
    col.locator('.mdcard:has-text("%s") .kebab'%title).click(); P.wait_for_timeout(200); P.locator('#ctx .mi:has-text("Add to roadmap")').click(); P.wait_for_timeout(300)
    P.fill('#xdlg [aria-label="Start date"]',a); P.fill('#xdlg [aria-label="End date"]',b); P.click('#xdlg button:text-is("Add to roadmap")'); P.wait_for_timeout(700)
with sync_playwright() as pw:
    br=pw.chromium.launch(); ctx=mkctx(br); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    oc=A.locator('.mdcol[data-mo="2026-10"]'); oc.locator('.mdopen').click(); ta=oc.locator('.mdadd textarea'); ta.fill('Gantt one\nGantt two'); ta.press('Enter'); A.wait_for_timeout(500); A.keyboard.press('Escape'); A.wait_for_timeout(300)
    to_roadmap(A,oc,'Gantt one','2026-10-05','2026-10-10'); ctx.clock.set_fixed_time('2026-10-20T10:05:00'); to_roadmap(A,oc,'Gantt two','2026-10-12','2026-10-20')  # the clock is fixed, so move it: bar ids are made from the time
    one=oc.locator('.mdcard:has-text("Gantt one") .mdid').inner_text()
    oc.locator('.mdcard:has-text("Gantt two") .kebab').click(); A.wait_for_timeout(200); A.locator('#ctx .mi:has-text("Points and people")').click(); A.wait_for_timeout(300)
    A.locator('#xdlg input[aria-label="Needs card"]').fill(one); A.click('#xdlg .ptrack[data-k="be"]'); r=A.locator('#xdlg .pperson[data-track="be"]').first; r.locator('input[type=checkbox]').check(); r.locator('select').select_option('2'); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(600)
    ok('G0 the card now needs the first card', 'Gantt one' in A.evaluate("()=>JSON.stringify(JSON.parse(localStorage.getItem('fk3')).reports)") and '"needs"' in A.evaluate("()=>JSON.stringify(JSON.parse(localStorage.getItem('fk3')).reports)"))
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(1500)
    n=A.locator('svg.ovl path.dep.card').count()
    ok('G1 a dashed line joins the two bars of cards that need each other', n==1)
    ok('G2 the line has a tooltip naming both bars', 'Gantt one' in A.locator('svg.ovl path.dep.card title').text_content() and 'Gantt two' in A.locator('svg.ovl path.dep.card title').text_content())
    ok('G3 the dependency chip counts it', A.locator('.depchip').count()==1 and '1 dependency' in A.locator('.depchip').inner_text())
    ok('no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R)); br.close()
