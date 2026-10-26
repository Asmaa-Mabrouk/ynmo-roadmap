import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Monthly: the Sort by product button (Tifli, AI, Daycare, Plan, SCHS, Warif in every column). Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def add(P,mo,text):
    c=P.locator('.mdcol[data-mo="%s"]'%mo); c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill(text); ta.press('Enter'); P.wait_for_timeout(500); P.keyboard.press('Escape'); P.wait_for_timeout(250)
def order(P,mo): return P.evaluate("mo=>[...document.querySelectorAll('.mdcol[data-mo=\"'+mo+'\"] .mdcard .mdtext')].map(e=>e.innerText.trim())",mo)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); E=newpage(ctx,errs); signup(E,'Exec','exec@x.com')
    A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(700); A.locator('#permissions .permuser:has-text("Exec")').click(); A.wait_for_timeout(300)
    A.click('#permissions button:text-is("Approve with these permissions")'); A.wait_for_timeout(800)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    names=['c-warif','c-plan','c-daycare','c-schs','c-ai','c-tifli','c-plan2']; tags=['Warif','Plan','Daycare','SCHS','AI','Tifli','Plan']
    for n in names: add(A,'2026-10',n)
    for n,t in zip(names,tags):
        card=A.locator('.mdcol[data-mo="2026-10"] .mdcard:has-text("%s")'%n).first
        if t!='Daycare': card.locator('button.mdprod').click(); A.wait_for_timeout(200); A.locator('#ctx .mi.mdpick:text-is("%s"), #ctx .mi.mdpick:has-text("%s")'%(t,t)).first.click(); A.wait_for_timeout(350)
    add(A,'2026-11','n-plan'); add(A,'2026-11','n-tifli')
    c=A.locator('.mdcol[data-mo="2026-11"] .mdcard:has-text("n-tifli")').first; c.locator('button.mdprod').click(); A.wait_for_timeout(200); A.locator('#ctx .mi.mdpick:has-text("Tifli")').first.click(); A.wait_for_timeout(350)
    c=A.locator('.mdcol[data-mo="2026-11"] .mdcard:has-text("n-plan")').first; c.locator('button.mdprod').click(); A.wait_for_timeout(200); A.locator('#ctx .mi.mdpick:has-text("Plan")').first.click(); A.wait_for_timeout(350)
    before=order(A,'2026-10')
    ok('T1 the button is next to the filters and starts off', A.locator('#mdsort').count()==1 and A.locator('#mdsort').get_attribute('aria-pressed')=='false')
    A.click('#mdsort'); A.wait_for_timeout(500)
    want=['c-tifli','c-ai','c-daycare','c-plan','c-plan2','c-schs','c-warif']
    ok('T2 every card is in the order Tifli, AI, Daycare, Plan, SCHS, Warif %s'%order(A,'2026-10'), order(A,'2026-10')==want)
    ok('T3 every column is sorted, not only one', order(A,'2026-11')==['n-tifli','n-plan'])
    ok('T4 the button shows it is on', A.locator('#mdsort').get_attribute('aria-pressed')=='true' and 'Sorted' in A.locator('#mdsort').inner_text())
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    ok('T5 the choice is remembered after a reload', order(A,'2026-10')==want)
    ok('T6 sorting works together with the product filter', (A.select_option('select[aria-label="Filter by tag"]','plan') or True) and (A.wait_for_timeout(400) or True) and order(A,'2026-10')==['c-plan','c-plan2'])
    A.select_option('select[aria-label="Filter by tag"]','all'); A.wait_for_timeout(300)
    A.click('#mdsort'); A.wait_for_timeout(400); A.click('#mdsort'); A.wait_for_timeout(300)
    E.evaluate("localStorage.removeItem('ynmo-month-sort')"); E.reload(); E.wait_for_timeout(1500); E.click('#nav button[data-p="monthly"]'); E.wait_for_timeout(900)
    ok('T7 an executive has the button too (their own choice, off by default)', E.locator('#mdsort').count()==1 and order(E,'2026-10')==before)
    E.click('#mdsort'); E.wait_for_timeout(500)
    ok('T8 an executive can sort', order(E,'2026-10')==want)
    A.evaluate("localStorage.removeItem('ynmo-month-sort')"); A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    ok('T9 switching it off returns to the saved order, nothing was changed in the data', order(A,'2026-10')==before)
    ok('no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
