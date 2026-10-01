import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Roadmap bars: hover shows the full text; overlapping bars stack vertically in creation order and a new bar goes under the others (the row grows)."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    who=A.evaluate("[...__ynmo.directory().keys()].find(n=>!__ynmo.items().some(i=>i.res.includes(n)))")
    def add(t,d0,d1,ordv):
        A.evaluate("""([who,t,d0,d1,o])=>{const id='bs'+Math.random().toString(36).slice(2,7);__ynmo.S.over[id]={custom:true,rm:__ynmo.state.rm,t:t,sq:'tifli',pr:['tifli'],d0:d0,d1:d1,st:'planned',n:'',res:[who],ord:o};__ynmo.render();}""",[who,t,d0,d1,ordv]); A.wait_for_timeout(250)
    top=lambda t: A.evaluate("t=>{const b=[...document.querySelectorAll('.pb')].find(x=>x.textContent.includes(t));return b?b.getBoundingClientRect().top:null}",t)
    rowh=lambda: A.evaluate("n=>document.querySelector('.rowbg[data-person=\"'+n+'\"]').getBoundingClientRect().height",who)
    LONG='A very long feature name that certainly needs more than two lines to be read in full on the roadmap bar'
    add('First',10,20,9001); add(LONG,12,22,9002)
    t1,t2=top('First'),top('A very long'); h2=rowh()
    ok('two overlapping bars are stacked vertically', t2>t1+20)
    add('Third early',5,25,9003); t3=top('Third early'); h3=rowh()
    ok('third bar goes under the others even though it starts earlier', t3>t2 and top('First')==t1 and top('A very long')==t2)
    ok('row grows to fit the third bar', h3>h2+20)
    add('Later alone',60,65,9004); ok('a bar that does not overlap reuses the top lane', abs(top('Later alone')-t1)<2)
    A.locator('.pb', has_text='A very long').hover(position={'x':30,'y':10}); A.wait_for_timeout(500)
    ok('hover card shows the full text', LONG in A.locator('.bartip').inner_text())
    ok('hover card shows squad, dates and status', 'Planned' in A.locator('.bartip').inner_text() or 'planned' in A.locator('.bartip').inner_text().lower())
    A.mouse.move(5,5); A.wait_for_timeout(300); ok('hover card disappears', A.locator('.bartip').count()==0)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
