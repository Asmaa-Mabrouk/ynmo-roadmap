import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""By-person view: reorder rows by drag & drop, Move up/down and Hide-from-this-roadmap via the row ⋯ menu."""
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
    # hide from THIS roadmap only
    empty=A.evaluate("[...__ynmo.directory().keys()].find(n=>!__ynmo.items().some(i=>i.res.includes(n)))")
    busy=A.evaluate("[...__ynmo.directory().keys()].find(n=>__ynmo.items().some(i=>i.res.includes(n)))")
    ok('test data has an empty and a busy person', bool(empty) and bool(busy))
    A.locator('.c1.pn[data-person="%s"] .pmore'%busy).click(); A.click('#ctx :text("Hide")'); A.wait_for_timeout(300)
    ok('person with features cannot be hidden', busy in names() and 'feature' in A.locator('#save').inner_text())
    A.locator('.c1.pn[data-person="%s"] .pmore'%empty).click(); A.click('#ctx :text("Hide")'); A.wait_for_timeout(500)
    ok('empty person hidden from this roadmap', empty not in names() and len(names())==len(n0)-1)
    ok('still on the team', A.evaluate("n=>__ynmo.directory().has(n)",empty))
    ok('Show hidden button counts 1', 'Show hidden (1)' in A.locator('#showhidden').inner_text())
    A.reload(); A.wait_for_timeout(1500); ok('hiding persists after reload', empty not in names())
    # another roadmap still shows the person
    A.click('#nav button[data-p="roadmaps"]'); f=A.locator('#pg-roadmaps form'); s=f.locator('select')
    s.nth(0).select_option('2027'); s.nth(1).select_option('Q1'); f.locator('input[type=text]').fill('Other RM'); f.locator('button:text-is("Create roadmap")').click(); A.wait_for_timeout(700)
    ok('other roadmap keeps the row', empty in names())
    A.click('#nav button[data-p="roadmaps"]'); A.locator('.rmcard:has-text("H2 2026") button:has-text("Open")').click(); A.wait_for_timeout(500)
    ok('back on H2 the row is still hidden', empty not in names())
    A.click('#showhidden'); A.wait_for_timeout(300); ok('dialog lists the person', empty in A.locator('#xdlg').inner_text())
    A.click('#xdlg button:text-is("Show")'); A.wait_for_timeout(500); ok('row is back after Show', empty in names() and A.locator('#showhidden').count()==0)
    A.click('#nav button[data-p="log"]'); A.wait_for_timeout(400); t=A.locator('#pg-log').inner_text()
    ok('log has hide, show and reorder', 'hid '+empty in t and 'showed '+empty in t and 'reordered' in t)
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(300)
    A.set_viewport_size({'width':390,'height':800}); A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(500)
    ok('no overflow on phone', not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
