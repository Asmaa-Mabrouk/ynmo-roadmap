import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Gantt: "Sync from Monthly" brings the Monthly cards and their people onto the roadmap as bars. Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    nc=A.locator('.mdcol[data-mo="2026-11"]'); nc.locator('.mdopen').click(); ta=nc.locator('.mdadd textarea')
    for t in ['Parent invoice page','Reports export card','Unassigned idea']:
        ta.fill(t); ta.press('Enter'); A.wait_for_timeout(450)
    A.keyboard.press('Escape'); A.wait_for_timeout(300)
    A.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('fk3'));const m=d.reports.mo202611;
      const f=t=>m.lines.find(l=>l.t===t);f('Parent invoice page').who={dev:{Mona:4,Ali:2}};f('Reports export card').who={dev:{Ali:6}};f('Reports export card').pct=40;
      localStorage.setItem('fk3',JSON.stringify(d));}""")
    A.reload(); A.wait_for_timeout(1500)
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(700)
    ok('S1 the Gantt has a Sync from Monthly button', A.locator('#syncmonthly').count()==1 and A.locator('#syncmonthly').is_enabled())
    n0=A.evaluate("()=>Object.keys(JSON.parse(localStorage.getItem('fk3')).items||{}).length")
    A.click('#syncmonthly'); A.wait_for_timeout(400)
    rows=A.locator('#xdlg .srrow'); t=A.locator('#xdlg').inner_text()
    ok('S2 the dialog lists the three cards grouped by person', rows.count()==3 and 'Unassigned' in t and 'Ali' in t and 'Mona' in t)
    ok('S3 people and dates are shown', 'Mona, Ali' in t and '40%' in t)
    ok('S4 nothing is saved before Apply', A.evaluate("()=>Object.keys(JSON.parse(localStorage.getItem('fk3')).items||{}).length")==n0)
    rows.filter(has_text='Unassigned idea').locator('input').uncheck(); A.wait_for_timeout(150)
    ok('S5 the button counts the ticked cards', A.locator('#rmsyncok').inner_text()=='Add 2 bars')
    A.click('#rmsyncok'); A.wait_for_timeout(900)
    ov=A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).items||{}).filter(x=>x&&x.card)")
    ok('S6 two bars were made with the people on them', len(ov)==2 and sorted(sorted(x['res']) for x in ov)==[['Ali'],['Ali','Mona']] and all(x['d0']<x['d1'] for x in ov))
    mo=A.evaluate("()=>JSON.parse(localStorage.getItem('fk3')).reports.mo202611.lines.map(l=>[l.t,!!l.rid])")
    ok('S7 the cards are linked to their bars', dict(mo)['Parent invoice page'] and dict(mo)['Reports export card'] and not dict(mo)['Unassigned idea'])
    ok('S8 the bars are on the Gantt', A.locator('.bar:has-text("Parent invoice page")').count()>=1)
    A.click('#syncmonthly'); A.wait_for_timeout(400)
    ok('S9 syncing again lists only the card that is not on the roadmap', A.locator('#xdlg .srrow').count()==1 and 'Unassigned idea' in A.locator('#xdlg').inner_text())
    A.click('#xdlg button:text-is("Cancel")'); A.wait_for_timeout(300)
    A.click('#undo'); A.wait_for_timeout(500)
    ok('S10 Undo takes the new bars off the Gantt', A.locator('.bar:has-text("Parent invoice page")').count()==0)
    ok('S11 no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
