import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Ynmo Flow, phase 0: the menu icon and the planning page. Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    nb=A.locator('#nav button[data-p="flow"]')
    ok('F1 the menu has a Ynmo Flow button with an icon', nb.count()==1 and nb.get_attribute('aria-label')=='Ynmo Flow' and nb.locator('svg').count()==1)
    nb.click(); A.wait_for_timeout(500)
    ok('F2 it opens the Flow page with the title', A.locator('#pg-flow h1').inner_text()=='Ynmo Flow' and A.locator('#ptitle').inner_text()=='Ynmo Flow')
    ok('F3 the page lists the six phases in order', A.locator('#flowhero .flowphases li').count()==6 and A.locator('#flowhero .flowphases li b').first.inner_text()=='Issues' and A.locator('#flowhero .flowphases li b').last.inner_text()=='Jira import')
    ok('F4 the address shows #/flow and the button is current', A.evaluate("location.hash")=='#/flow' and nb.get_attribute('aria-current')=='page')
    A.reload(); A.wait_for_timeout(1500)
    ok('F5 a reload stays on Flow', A.locator('#pg-flow:not([hidden])').count()==1)
    ok('F6 no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R))
