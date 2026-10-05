import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Timeline notes: person ribbons, period notes with bands, automatic leave strip; never counted as features; saved, draggable, in the PDF."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    who=A.evaluate("document.querySelector('.pb').dataset.person")
    n0=A.locator('#summary').inner_text(); top0=A.evaluate("p=>document.querySelector('.pb[data-person=\"'+p+'\"]').getBoundingClientRect().top-document.querySelector('.rowbg[data-person=\"'+p+'\"]').getBoundingClientRect().top",who)
    ok('no notes row when there is nothing to show', A.locator('.notesrow').count()==0)
    # person note through the row menu
    A.locator('.c1.pn[data-person="%s"]'%who).click(button='right'); A.wait_for_timeout(250)
    A.click('#ctx :text("Add note for")'); A.wait_for_timeout(300)
    A.fill('#xdlg input[type=text]','Full stack: backend + frontend'); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(600)
    rib=A.locator('.tribbon', has_text='Full stack')
    ok('person note shows as a ribbon on that row', rib.count()==1)
    ok('the note is not counted as a feature', A.locator('#summary').inner_text()==n0)
    top1=A.evaluate("p=>document.querySelector('.pb[data-person=\"'+p+'\"]').getBoundingClientRect().top-document.querySelector('.rowbg[data-person=\"'+p+'\"]').getBoundingClientRect().top",who)
    ok('bars of that person move down to make room', top1>top0+10)
    ok('saved as a meta doc in ideas (hidden from the ideas board)', A.evaluate("Object.values(JSON.parse(localStorage.getItem('fk3')).ideas).some(i=>i.tn&&i.k==='person'&&i.p===arguments[0])".replace('arguments[0]',repr(who))) )
    # drag it
    d0=A.evaluate("()=>Object.values(__ynmo.S.ideas).find(i=>i.tn).a0"); bb=rib.bounding_box()
    A.mouse.move(bb['x']+bb['width']/2, bb['y']+8); A.mouse.down(); A.mouse.move(bb['x']+bb['width']/2+90, bb['y']+8, steps=6); A.mouse.up(); A.wait_for_timeout(500)
    d1=A.evaluate("()=>Object.values(__ynmo.S.ideas).find(i=>i.tn).a0"); ok('dragging moves the note', d1>d0)
    # click opens editor, edit text
    A.locator('.tribbon').first.click(); A.wait_for_timeout(300)
    ok('click opens the editor with a delete button', A.locator('#xdlg button:text-is("Delete note")').count()==1)
    A.fill('#xdlg input[type=text]','Full stack across Tifli'); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(500)
    ok('note text can be edited', A.locator('.tribbon', has_text='across Tifli').count()==1)
    # leave strip from vacations
    A.evaluate("p=>{__ynmo.S.vacs['vz1']={p:p,a0:'2026-10-12',a1:'2026-10-16',t:'Annual',n:''};__ynmo.S.vacs['vz2']={p:__ynmo.directory().keys().next().value===p?[...__ynmo.directory().keys()][1]:__ynmo.directory().keys().next().value,a0:'2026-10-14',a1:'2026-10-15',t:'Annual',n:''};__ynmo.render();}",who); A.wait_for_timeout(400)
    ok('leave strip appears from vacations with counts', A.locator('.notesrow').count()==1 and A.locator('.vheat').count()>=2 and 'on leave' in (A.locator('.vheat').first.get_attribute('title') or ''))
    # period note from the header
    A.locator('.wk').nth(25).click(button='right'); A.wait_for_timeout(250); A.click('#ctx :text("Add period note")'); A.wait_for_timeout(300)
    A.fill('#xdlg input[type=text]','Eid: many vacations'); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(600)
    ok('period note is a chip in the Notes row', A.locator('.tchip', has_text='Eid').count()==1)
    ok('and a band across the rows', A.locator('.tband').count()==1)
    ok('summary still unchanged', A.locator('#summary').inner_text()==n0)
    # filters: person with a note stays visible when a filter hides rows
    A.locator('#status').select_option('done'); A.wait_for_timeout(400)
    ok('person with a note keeps their row under a filter', A.locator('.c1.pn[data-person="%s"]'%who).count()==1)
    A.locator('#status').select_option('all'); A.wait_for_timeout(300)
    # pdf print view
    A.evaluate("()=>{window.print=()=>{}}"); A.click('#exportpdf'); A.wait_for_timeout(500)
    ok('PDF view includes ribbons, period chip and leave heat', A.locator('#printrm .prm-rib').count()==1 and A.locator('#printrm .prm-chip').count()==1 and A.locator('#printrm .prm-heat').count()>=2 and A.locator('#printrm .prm-band').count()>=3)
    A.evaluate("()=>{document.body.classList.remove('print-roadmap');const v=document.getElementById('printrm');if(v)v.remove()}")
    # reload keeps notes
    A.reload(); A.wait_for_timeout(1600)
    ok('notes survive reload', A.locator('.tribbon').count()==1 and A.locator('.tchip').count()==1)
    # delete via context menu
    A.locator('.tchip').first.click(button='right'); A.wait_for_timeout(250); A.click('#ctx :text("Delete note")'); A.wait_for_timeout(500)
    ok('period note can be deleted', A.locator('.tchip').count()==0 and A.locator('.tband').count()==0)
    # rename person follows
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    row=A.locator('#pg-resources .tbl tbody tr', has=A.locator('b', has_text=who)).first; row.locator('button[aria-label^="Rename"]').click(); ri=A.locator('#pg-resources .tbl tbody input[aria-label^="New name"]'); ri.fill('Renamed Person'); ri.press('Enter'); A.wait_for_timeout(700)
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(500)
    ok('renaming the person keeps their note', A.locator('.tribbon').count()==1 and A.evaluate("()=>Object.values(__ynmo.S.ideas).find(i=>i.tn).p")=='Renamed Person')
    # discoverability: toolbar button and bar menu
    A.click('#addnote'); A.wait_for_timeout(300)
    ok('toolbar Add note opens the dialog', A.locator('#xdlg input[type=text]').count()==1)
    A.keyboard.press('Escape'); A.wait_for_timeout(200)
    if A.locator('#xdlg').count() and A.locator('#xdlg').is_visible():
        A.click('#xdlg button:text-is("Cancel")'); A.wait_for_timeout(200)
    A.locator('.pb').first.click(button='right'); A.wait_for_timeout(250)
    ok('bar menu has Add note items', A.locator('#ctx :text("Add note for")').count()==1 and A.locator('#ctx :text("Add period note")').count()==1)
    A.click('#ctx :text("Add period note")'); A.wait_for_timeout(300)
    ok('bar menu note dialog opens', A.locator('#xdlg input[type=text]').count()==1)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
