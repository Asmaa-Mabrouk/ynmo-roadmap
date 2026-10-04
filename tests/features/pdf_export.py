import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Roadmap toolbar: no Share / Export CSV / Today; Export PDF builds a coloured full-timeline print view (respects filters); dropdown search hardening."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    ok('Share, Export CSV and Today buttons are gone from the roadmap', A.locator('#sharebtn, #export, #today').count()==0 and A.locator('#exportpdf').count()==1)
    A.click('#nav button[data-p="roadmaps"]'); A.wait_for_timeout(300)
    ok('sharing moved to the roadmap cards', A.locator('.rmcard button:text-is("Share")').count()>=1)
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(300)
    A.evaluate("()=>{window.print=()=>{window.__pp=(window.__pp||0)+1}}")
    n=A.evaluate("__ynmo.items().length")
    A.click('#exportpdf'); A.wait_for_timeout(500)
    ok('print dialog opened once', A.evaluate("window.__pp")==1 and A.evaluate("document.body.classList.contains('print-roadmap')"))
    ok('every feature has a bar in the print view', A.locator('#printrm .prm-bar').count()>=n)
    ok('print view has title, summary tiles and legend', 'Ynmo roadmap' in A.locator('#printrm h1').inner_text() and A.locator('#printrm .prm-tile').count()==5 and A.locator('#printrm .prm-legend span').count()>=6)
    ok('bars are coloured by product', len(set(A.evaluate("[...document.querySelectorAll('#printrm .prm-bar')].map(b=>b.style.getPropertyValue('--c'))")))>=3)
    A.emulate_media(media='print'); A.pdf(path='roadmap-test.pdf', prefer_css_page_size=True, print_background=True)
    from pypdf import PdfReader
    pr=PdfReader('roadmap-test.pdf'); w=float(pr.pages[0].mediabox.width); h=float(pr.pages[0].mediabox.height)
    ok('PDF is A3 landscape and has text', w>h and w>1100 and 'Ynmo roadmap' in pr.pages[0].extract_text())
    A.emulate_media(media='screen')
    A.evaluate("()=>{document.body.classList.remove('print-roadmap');const v=document.getElementById('printrm');if(v)v.remove()}")
    A.evaluate("()=>{document.body.classList.remove('print-roadmap');const v=document.getElementById('printrm');if(v)v.remove()}")
    # filter is honoured and noted
    A.locator('#status').select_option('done'); A.wait_for_timeout(300)
    A.click('#exportpdf'); A.wait_for_timeout(400)
    ok('filtered view exports only matching features and says so', A.locator('#printrm .prm-bar').count()==A.evaluate("__ynmo.items().filter(i=>i.st==='done').reduce((n,i)=>n+Math.max(1,i.res.length),0)") and 'Filtered view' in A.locator('#printrm').inner_text())
    A.evaluate("()=>{document.body.classList.remove('print-roadmap');const v=document.getElementById('printrm');if(v)v.remove()}")
    # dropdown search: typing on a focused dropdown opens it with the text; accents / Arabic folding
    A.locator('#status').select_option('all')
    A.locator('#person').focus(); A.keyboard.type('mo'); A.wait_for_timeout(300)
    ok('typing on a focused dropdown opens it and searches', A.locator('.cpop').count()==1 and A.input_value('.cpop .csearch')=='mo' and A.evaluate("[...document.querySelectorAll('.cpop .copt[data-opt]')].filter(r=>!r.hidden).length")<5)
    A.keyboard.press('Escape')
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
