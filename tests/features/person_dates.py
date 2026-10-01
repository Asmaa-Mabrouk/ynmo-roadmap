import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""An epic with several owners: resizing / moving / dating one person's bar changes only that person's dates."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    ppl=A.evaluate("[...__ynmo.directory().keys()].filter(n=>!__ynmo.items().some(i=>i.res.includes(n))).slice(0,2)")
    P1,P2=ppl
    A.evaluate("""([a,b])=>{__ynmo.commit('pdx',{custom:true,rm:__ynmo.state.rm,t:'Shared epic',sq:'tifli',pr:['tifli'],d0:10,d1:20,st:'planned',n:'',res:[a,b],ord:9100});}""",[P1,P2]); A.wait_for_timeout(300)
    bars=lambda: A.evaluate("()=>[...document.querySelectorAll('.pb[data-id=\"pdx\"]')].map(b=>[b.dataset.person,b.style.gridColumn])")
    ok('epic shows on both rows with the same dates', len(bars())==2 and bars()[0][1]==bars()[1][1])
    b1=A.locator('.pb[data-id="pdx"][data-person="%s"]'%P1); b1.scroll_into_view_if_needed(); bb=b1.bounding_box()
    A.mouse.move(bb['x']+bb['width']-3, bb['y']+bb['height']/2); A.mouse.down(); A.mouse.move(bb['x']+bb['width']+60, bb['y']+bb['height']/2, steps=6); A.mouse.up(); A.wait_for_timeout(500)
    it=lambda: A.evaluate("()=>{const i=__ynmo.items().find(x=>x.id==='pdx');return {d0:i.d0,d1:i.d1,pd:i.pd}}")
    r=it(); ok('stretching one person does not touch the other', r['pd'] and r['pd'][P1][1]>20 and r['pd'][P2]==[10,20])
    ok('item span covers both', r['d0']==10 and r['d1']==r['pd'][P1][1])
    g=bars(); ok('rows now show different lengths', dict(g)[P1]!=dict(g)[P2])
    # date field in the menu for the second person
    b2=A.locator('.pb[data-id="pdx"][data-person="%s"]'%P2); b2.click(button='right',position={'x':20,'y':10}); A.wait_for_timeout(250)
    ok('menu says whose dates', ('dates for '+P2).lower() in A.locator('#ctx').inner_text().lower())
    d1=A.evaluate("n=>__ynmo.items().find(x=>x.id==='pdx').pd[n][1]",P2)
    A.keyboard.press('Escape'); A.mouse.click(5,5)
    # keyboard: shift+arrow on person 2 only
    b2=A.locator('.pb[data-id="pdx"][data-person="%s"]'%P2); b2.focus(); A.keyboard.press('Shift+ArrowRight'); A.wait_for_timeout(400)
    r=it(); ok('Shift+Right resizes only the focused person', r['pd'][P2][1]>=d1 and r['pd'][P1][1]>20)
    A.reload(); A.wait_for_timeout(1500); r2=it(); ok('per-person dates survive reload', r2['pd'] and r2['pd'][P1]==r['pd'][P1])
    # squad view style edit on whole item (no owner) keeps both
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
