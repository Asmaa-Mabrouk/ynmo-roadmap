import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Products: Tifli is no longer the colour of Daycare; products can be recoloured and added (colour + name), shown on the roadmap chips and rows."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    lane=lambda k: A.evaluate("k=>__ynmo.LANES.find(l=>l.k===k)",k)
    ok('Tifli colour differs from Daycare and is not a blue/violet lookalike', lane('tifli')['c']!=lane('daycare')['c'] and A.evaluate("()=>getComputedStyle(document.documentElement).getPropertyValue('--tifli').trim()")=='#c2257f')
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    # recolour Daycare
    A.locator('#pg-resources .colbtn input').nth(3).evaluate("e=>{e.value='#16a34a';e.dispatchEvent(new Event('change',{bubbles:true}))}"); A.wait_for_timeout(500)
    ok('colour of a product can be changed', lane('daycare')['c']=='#16a34a' and A.evaluate("JSON.parse(localStorage.getItem('fk3')).ideas.squadnames.colors.daycare")=='#16a34a')
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(400)
    ok('roadmap chip shows the new colour', A.evaluate("()=>[...document.querySelectorAll('#chips .chip')].find(c=>c.textContent.includes('Daycare')).style.getPropertyValue('--c')")=='#16a34a')
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    # add a product
    A.fill('.sqnew input[type=text]','Wasl Plus'); A.locator('.sqnew .colbtn input').evaluate("e=>{e.value='#0891b2';e.dispatchEvent(new Event('change',{bubbles:true}))}"); A.click('.sqnew button:text-is("Add product")'); A.wait_for_timeout(600)
    ok('new product added to LANES with its colour', A.evaluate("()=>__ynmo.LANES.length")==5 and A.evaluate("()=>__ynmo.LANES[4].n")=='Wasl Plus' and A.evaluate("()=>__ynmo.LANES[4].c")=='#0891b2')
    ok('new product visible in filters (not filtered out)', A.evaluate("()=>__ynmo.state.sq.has(__ynmo.LANES[4].k)"))
    A.fill('.sqnew input[type=text]','wasl plus'); A.click('.sqnew button:text-is("Add product")'); A.wait_for_timeout(300)
    ok('duplicate product name rejected', A.evaluate("()=>__ynmo.LANES.length")==5 and 'already exists' in A.locator('.sqnew').inner_text())
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(400)
    ok('roadmap has a chip for the new product', A.locator('#chips .chip', has_text='Wasl Plus').count()==1)
    # a member in the new product, a bar for it
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    ok('member form offers the new product', A.locator('#pg-resources form.card button.pill', has_text='Wasl Plus').count()>=1)
    k=A.evaluate("()=>__ynmo.LANES[4].k")
    A.evaluate("""k=>{const who=[...__ynmo.directory().keys()][0];__ynmo.commit('wpx',{custom:true,rm:__ynmo.state.rm,t:'Wasl feature',sq:k,pr:[k],d0:5,d1:12,st:'planned',n:'',res:[who],ord:9200});}""",k); A.wait_for_timeout(400)
    ok('bar of the new product uses its colour', A.evaluate("()=>getComputedStyle(document.querySelector('.pb[data-id=\"wpx\"]')).backgroundColor")=='rgb(8, 145, 178)' if A.locator('.pb[data-id="wpx"]').count() else False)
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    A.locator('.sqrow', has=A.locator('input[aria-label="Name of the Wasl Plus product"]')).locator('button:text-is("Remove")').click(); A.wait_for_timeout(300)
    ok('product with features cannot be removed', A.evaluate("()=>__ynmo.LANES.length")==5 and A.locator('#toasts .toast.err', has_text='still has').count()>=1)
    A.evaluate("()=>__ynmo.removeItem('wpx')"); A.wait_for_timeout(300)
    A.locator('.sqrow', has=A.locator('input[aria-label="Name of the Wasl Plus product"]')).locator('button:text-is("Remove")').click(); A.wait_for_timeout(500)
    ok('empty product can be removed', A.evaluate("()=>__ynmo.LANES.length")==4)
    # reset
    A.locator('.sqrow', has=A.locator('input[aria-label="Name of the Daycare product"]')).locator('button:text-is("Reset")').click(); A.wait_for_timeout(500)
    ok('Reset restores name and colour', lane('daycare')['c']=='var(--daycare)')
    A.reload(); A.wait_for_timeout(1500); ok('survives reload', A.evaluate("()=>__ynmo.LANES.length")==4)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
