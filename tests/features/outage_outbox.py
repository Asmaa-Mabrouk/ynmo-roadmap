import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Data-API outage (503 PGRST002 'schema cache'): saves are treated as temporary, kept in the browser, and sent again by themselves. Fake database only."""
R=[]
SRV="()=>JSON.stringify((JSON.parse(localStorage.getItem('fk3'))||{}).reports||{}).includes('survives-outage')"   # the month documents on the (fake) server; the activity log may name the card even while saves wait
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    A.evaluate("window.__api503=true")
    c=A.locator('.mdcol').first; c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill('survives-outage'); ta.press('Enter'); A.wait_for_timeout(2500)
    ok('O1 the outage message is not mistaken for a missing table', 'setup needed' not in A.locator('#save').inner_text().lower())
    ok('O2 the card shows on the board', A.locator('.mdcard:has-text("survives-outage")').count()==1)
    ob=A.evaluate("()=>JSON.parse(localStorage.getItem('ynmo-outbox')||'{}')")
    ok('O3 the unsaved month is kept in the browser outbox', any(k.startswith('reports/mo') for k in ob))
    ok('O4 the server does not have it yet', not A.evaluate(SRV))
    ok('O5 closing the tab asks for confirmation', A.evaluate("()=>{const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented}"))
    A.wait_for_timeout(9000)
    ok('O6 still kept while the API is down', not A.evaluate(SRV) and A.locator('.mdcard:has-text("survives-outage")').count()==1)
    A.evaluate("window.__api503=false")
    A.reload(); A.wait_for_timeout(2500); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(1500)
    A.wait_for_timeout(2500); ok('O7 after a reload the card is still there', A.locator('.mdcard:has-text("survives-outage")').count()==1)
    ok('O8 and it reached the server by itself', A.evaluate(SRV))
    ok('O9 the outbox is empty once confirmed', A.evaluate("()=>localStorage.getItem('ynmo-outbox')")  in (None,'{}'))
    ok('O10 closing the tab no longer asks', not A.evaluate("()=>{const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented}"))
    ok('no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R))
