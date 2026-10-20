import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Drag a bar UP to the person above, product picker + product colours on the roadmap, Deployments / Quality scope sections in a sprint and report."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.set_viewport_size({'width':1300,'height':800})
    # ---- drag up
    names=A.evaluate("()=>[...document.querySelectorAll('.c1.pn[data-person]')].map(e=>e.dataset.person).filter(n=>n!=='Unassigned')")
    # a bar owned by someone who is not first in the list, with the person above visible
    pair=A.evaluate("""()=>{const l=[...document.querySelectorAll('.c1.pn[data-person]')].map(e=>e.dataset.person);
      for(const b of document.querySelectorAll('.pb')){const i=l.indexOf(b.dataset.person); if(i>0&&l[i-1]!=='Unassigned'&&b.dataset.person!=='Unassigned') return [b.dataset.id,b.dataset.person,l[i-1]];} return null}""")
    id0,own,above=pair
    res=lambda: A.evaluate("id=>__ynmo.items().find(i=>i.id===id).res",id0)
    bar=A.locator('.pb[data-id="%s"][data-person="%s"]'%(id0,own)).first; bar.scroll_into_view_if_needed(); bb=bar.bounding_box()
    tb=A.locator('.rowbg[data-person="%s"]'%above).first.bounding_box(); x=bb['x']+min(100,bb['width']/2)
    A.mouse.move(x,bb['y']+bb['height']/2); A.mouse.down(); A.mouse.move(x+3,bb['y']-4,steps=4); A.mouse.move(x+3,tb['y']+tb['height']/2,steps=8)
    ok('dragging UP highlights the row above and names it', A.locator('.rowbg.drop[data-person="%s"]'%above).count()==1 and ('to '+above) in A.locator('#dtip').inner_text())
    A.mouse.up(); A.wait_for_timeout(500)
    ok('bar moved to the person above', above in res() and own not in res())
    # ---- product picker and product colours
    id1,sq1=A.evaluate("()=>{const it=__ynmo.items().find(i=>i.sq!=='daycare');return [it.id,it.sq]}")
    A.evaluate("([id])=>__ynmo.commit(id,{c:'#dc2626'})",[id1]); A.wait_for_timeout(300)
    colr=lambda: A.evaluate("id=>getComputedStyle(document.querySelector('.bar[data-id=\"'+id+'\"]')).getPropertyValue('--c').trim()",id1)
    ok('bar always shows its product colour, own colour ignored, no toolbar button', colr()!='#dc2626' and A.locator('#colorbtn').count()==0)
    A.locator('.bar[data-id="%s"]'%id1).first.scroll_into_view_if_needed(); A.locator('.bar[data-id="%s"]'%id1).first.click(button='right'); A.wait_for_timeout(250)
    ok('bar menu lists the products', A.locator('#ctx .prodrow .pchip.pick').count()>=3)
    A.locator('#ctx .prodrow .pchip.pick[aria-pressed=false]').first.click(); A.wait_for_timeout(500)
    now=A.evaluate("id=>{const it=__ynmo.items().find(i=>i.id===id);return [it.sq,it.c||null]}",id1)
    ok('choosing a product moves the epic and clears its own colour', now[0]!=sq1 and now[1] is None)
    ok('and the bar takes the new product colour', A.evaluate("id=>document.querySelector('.bar[data-id=\"'+id+'\"]').style.getPropertyValue('--c').trim()",id1)==A.evaluate("k=>__ynmo.LANES.find(l=>l.k===k).c",now[0]))
    # ---- sprint sections
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300)
    A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(500)
    P=A
    def key(*ks):
        for k in ks: P.keyboard.press(k); P.wait_for_timeout(120)
    def typ(t): P.keyboard.type(t); P.wait_for_timeout(120)
    P.locator('.sdoc .ghost .bt').click(); key('/'); typ('Product'); key('Enter'); P.wait_for_timeout(250)
    menu=P.locator('.cmenu').first.inner_text() if P.locator('.cmenu').count() else ''
    ok('section picker offers Deployments and Quality scope', 'Deployments' in menu and 'Quality scope' in menu)
    typ('Deploy'); key('Enter'); typ('Release Bot'); key('Enter'); typ('Ship build 1.2 to production'); P.wait_for_timeout(500)
    ok('Deployments section was added', P.locator('.sdoc .blk.k-h', has_text='Deployments').count()==1)
    ok('scope saved under the section', P.evaluate("Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).some(x=>x.t&&x.t.startsWith('Ship build'))"))
    P.locator('.sdoc .ghost .bt').click(); key('/'); typ('Product'); key('Enter'); typ('Quality'); key('Enter'); typ('Release Bot'); key('Enter'); typ('Regression pass on payments'); P.wait_for_timeout(500)
    ok('Quality scope section added too', P.locator('.sdoc .blk.k-h', has_text='Quality scope').count()==1)
    # ---- report picks them up
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(400)
    nb=A.locator('#pg-reports button', has_text='New report').first
    if nb.count(): nb.click(); A.wait_for_timeout(900)
    txt=A.locator('#pg-reports').inner_text()
    ok('weekly report has Deployments and Quality scope sections', 'Deployments' in txt and 'Quality scope' in txt)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
