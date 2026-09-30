import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""By-person view: reorder rows by drag & drop, Move up/down and Remove-from-chart via the row's ⋯ menu."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    names=lambda: A.evaluate("[...document.querySelectorAll('.c1.pn[data-person]')].map(e=>e.dataset.person)")
    n0=names(); ok('rows have grip and menu', A.locator('.pn .pgrip').count()==len(n0) and A.locator('.pn .pmore').count()==len(n0) and len(n0)>=20)
    ok('Unassigned row has no controls', A.locator('.pn:has-text("Unassigned") .pgrip').count()==0)
    # drag first row's grip onto the lower half of the third row
    first,third=n0[0],n0[2]
    A.locator('.c1.pn[data-person="%s"] .pgrip'%first).drag_to(A.locator('.c1.pn[data-person="%s"]'%third), target_position={'x':80,'y':int(A.locator('.c1.pn[data-person="%s"]'%third).bounding_box()['height'])-8}); A.wait_for_timeout(600)
    n1=names(); ok('drag reorders rows', n1.index(first)>n1.index(third) and n1[0]!=first)
    A.reload(); A.wait_for_timeout(1500); ok('order persists after reload', names()[:5]==n1[:5])
    # move up via menu
    who=names()[3]; A.locator('.c1.pn[data-person="%s"] .pmore'%who).click(); A.click('#ctx :text("Move up")'); A.wait_for_timeout(500)
    ok('menu Move up', names().index(who)==2)
    # remove: cancel first, then confirm
    victim=names()[1]; A.locator('.c1.pn[data-person="%s"] .pmore'%victim).click(); A.click('#ctx :text("from the chart")'); A.wait_for_timeout(300)
    ok('confirm dialog names the person', victim in A.locator('#xdlg').inner_text())
    A.keyboard.press('Escape'); A.wait_for_timeout(200); ok('Esc cancels removal', victim in names() and A.locator('#xdlg').count()==0)
    A.locator('.c1.pn[data-person="%s"] .pmore'%victim).click(); A.click('#ctx :text("from the chart")'); A.click('#xdlg button.danger'); A.wait_for_timeout(700)
    ok('person removed from chart', victim not in names())
    ok('no one else lost', len(names())==len(n0)-1)
    A.reload(); A.wait_for_timeout(1500); ok('removal persists', victim not in names())
    A.click('#nav button[data-p="log"]'); A.wait_for_timeout(400); t=A.locator('#pg-log').inner_text()
    ok('log has both actions', 'removed '+victim in t and 'reordered' in t)
    A.set_viewport_size({'width':390,'height':800}); A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(500)
    ok('no overflow on phone', not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
