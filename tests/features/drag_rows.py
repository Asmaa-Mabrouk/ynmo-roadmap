import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Dragging a roadmap bar to another person's row (also one that starts out of view: the chart scrolls while the bar is held near the edge)."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.set_viewport_size({'width':1300,'height':700})
    id0,own=A.evaluate("()=>{const b=document.querySelector('.pb');return [b.dataset.id,b.dataset.person]}")
    names=A.evaluate("o=>[...document.querySelectorAll('.c1.pn[data-person]')].map(e=>e.dataset.person).filter(n=>n!==o&&n!=='Unassigned')",own)
    res=lambda: A.evaluate("id=>__ynmo.items().find(i=>i.id===id).res",id0)
    bar=A.locator('.pb[data-id="%s"][data-person="%s"]'%(id0,own)); bar.scroll_into_view_if_needed(); bb=bar.bounding_box()
    # 1) a row that is visible
    near=A.evaluate("o=>{const l=[...document.querySelectorAll('.c1.pn[data-person]')].map(e=>e.dataset.person);return l[l.indexOf(o)+1]}",own)
    tb=A.locator('.rowbg[data-person="%s"]'%near).bounding_box(); x=bb['x']+120
    A.mouse.move(x,bb['y']+bb['height']/2); A.mouse.down(); A.mouse.move(x+3,(bb['y']+tb['y'])/2,steps=4); A.mouse.move(x+3,tb['y']+tb['height']/2,steps=8)
    ok('target row highlighted while dragging', A.locator('.rowbg.drop[data-person="%s"]'%near).count()==1 and ('to '+near) in A.locator('#dtip').inner_text())
    A.mouse.up(); A.wait_for_timeout(500)
    ok('bar moved to the other person (and left the first)', res()==[near] or (near in res() and own not in res()))
    # 2) a row far below: hold the bar near the bottom edge so the chart scrolls
    far=A.evaluate("()=>{const l=[...document.querySelectorAll('.c1.pn[data-person]')].map(e=>e.dataset.person).filter(n=>n!=='Unassigned');return l[l.length-1]}")
    bar=A.locator('.pb[data-id="%s"]'%id0).first; bar.scroll_into_view_if_needed(); bb=bar.bounding_box(); cw=A.locator('.chartwrap').bounding_box()
    s0=A.evaluate("document.querySelector('.chartwrap').scrollTop")
    A.mouse.move(bb['x']+100,bb['y']+bb['height']/2); A.mouse.down(); A.mouse.move(bb['x']+103,bb['y']+bb['height']/2+30,steps=3); A.mouse.move(bb['x']+103,cw['y']+cw['height']-10,steps=5)
    A.wait_for_timeout(2500)
    s1=A.evaluate("document.querySelector('.chartwrap').scrollTop"); ok('chart scrolls while the bar is held near the bottom', s1>s0+100)
    ty=A.evaluate("n=>{const r=document.querySelector('.rowbg[data-person=\"'+n+'\"]').getBoundingClientRect();return r.top+r.height/2}",far)
    A.mouse.move(bb['x']+103,ty,steps=6); A.wait_for_timeout(200); A.mouse.up(); A.wait_for_timeout(600)
    ok('bar dropped on a row that started out of view', far in res())
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
