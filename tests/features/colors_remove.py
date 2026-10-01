import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Bar colours: wide palette + any colour; Remove member: confirm dialog, blocked with a warning while the member owns roadmap features."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    bar=A.locator('.pb').nth(3); id0=bar.get_attribute('data-id'); bar.scroll_into_view_if_needed(); bar.click(button='right',position={'x':100,'y':12}); A.wait_for_timeout(250)
    ok('menu offers a wide palette', A.locator('#ctx .swatch').count()>=50 and A.locator('#ctx .swatch.any input[type=color]').count()==1)
    A.locator('#ctx .swatch[aria-label="Color #2563eb"]').click(); A.wait_for_timeout(400)
    ok('palette colour applied to the bar', A.evaluate("id=>__ynmo.items().find(i=>i.id===id).c",id0)=='#2563eb' and '37, 99, 235' in A.evaluate("id=>getComputedStyle(document.querySelector('.pb[data-id=\"'+id+'\"]')).backgroundColor",id0))
    A.locator('.pb[data-id="%s"]'%id0).scroll_into_view_if_needed(); A.locator('.pb[data-id="%s"]'%id0).click(button='right',position={'x':100,'y':12}); A.wait_for_timeout(250)
    A.locator('#ctx .swatch.any input').evaluate("e=>{e.value='#facc15';e.dispatchEvent(new Event('change',{bubbles:true}))}"); A.wait_for_timeout(400)
    ok('any colour from the picker applied, text stays readable', A.evaluate("id=>__ynmo.items().find(i=>i.id===id).c",id0)=='#facc15' and A.evaluate("id=>getComputedStyle(document.querySelector('.pb[data-id=\"'+id+'\"]')).color",id0)=='rgb(20, 22, 31)')
    A.reload(); A.wait_for_timeout(1500); ok('colour survives reload', A.evaluate("id=>__ynmo.items().find(i=>i.id===id).c",id0)=='#facc15')
    A.evaluate("id=>{__ynmo.S.over[id].c='red;x';__ynmo.render()}",id0); ok('invalid stored colour falls back to the product colour', A.locator('.pb[data-id="%s"]'%id0).count()==1)
    # ---- remove member
    busy=A.evaluate("[...__ynmo.directory().keys()].find(n=>__ynmo.items().some(i=>i.res.includes(n)))")
    free=A.evaluate("[...__ynmo.directory().keys()].find(n=>!__ynmo.items().some(i=>i.res.includes(n)))")
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    rowof=lambda n: A.locator('#pg-resources .tbl tbody tr', has=A.locator('b', has_text=n)).first
    rowof(busy).locator('button:text-is("Remove")').click(); A.wait_for_timeout(300)
    ok('Remove asks for confirmation', 'Remove '+busy in A.locator('#xdlg').inner_text() and A.evaluate("n=>__ynmo.directory().has(n)",busy))
    A.locator('#xdlg button:text-is("Cancel")').click(); ok('Cancel keeps the member', A.evaluate("n=>__ynmo.directory().has(n)",busy) and A.locator('#xdlg').count()==0)
    rowof(busy).locator('button:text-is("Remove")').click(); A.locator('#xdlg button:text-is("Remove")').click(); A.wait_for_timeout(400)
    t=A.locator('#xdlg').inner_text()
    ok('member with features: warning asks to edit the roadmap first', 'Edit the roadmap first' in t and 'Cannot remove' in t and A.evaluate("n=>__ynmo.directory().has(n)",busy))
    A.locator('#xdlg button:has-text("Open")').first.click(); A.wait_for_timeout(600)
    ok('warning opens the roadmap filtered to that person', A.evaluate("location.hash")=='#/roadmap' and A.locator('#person').input_value()==busy)
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    rowof(free).locator('button:text-is("Remove")').click(); A.locator('#xdlg button:text-is("Remove")').click(); A.wait_for_timeout(500)
    ok('member without features is removed after confirming', not A.evaluate("n=>__ynmo.directory().has(n)",free) and A.locator('#xdlg').count()==0)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
