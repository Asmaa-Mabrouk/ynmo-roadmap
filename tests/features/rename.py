import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Resources: rename squads and team members; the new name follows everywhere and duplicates are rejected."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    lane=lambda k: A.evaluate("k=>__ynmo.LANES.find(l=>l.k===k).n",k)
    ok('squads card lists the four squads', A.locator('#pg-resources .sqrow input').count()==4)
    inp=A.locator('#pg-resources .sqrow input').first; inp.fill('Tifli Core'); inp.press('Enter'); A.wait_for_timeout(500)
    ok('squad renamed in LANES', lane('tifli')=='Tifli Core')
    ok('team chips show the new squad name', A.locator('#pg-resources .tbl .pill', has_text='Tifli Core').count()>0)
    ok('saved in ideas/squadnames', A.evaluate("JSON.parse(localStorage.getItem('fk3')).ideas.squadnames.names.tifli")=='Tifli Core')
    ok('toast confirms', A.locator('#toasts .toast', has_text='Squad renamed').count()>=1)
    inp=A.locator('#pg-resources .sqrow input').nth(1); inp.fill('tifli core'); inp.press('Enter'); A.wait_for_timeout(400)
    ok('duplicate squad name rejected', lane('ai')=='AI' and A.locator('#toasts .toast.err').count()>=1)
    A.reload(); A.wait_for_timeout(1500); ok('squad name survives reload', lane('tifli')=='Tifli Core')
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(500)
    ok('roadmap shows the new squad name', 'Tifli Core' in A.locator('#pg-roadmap').inner_text())
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    A.locator('#pg-resources .sqrow button', has_text='Reset to Tifli').click(); A.wait_for_timeout(500)
    ok('Reset restores the default name', lane('tifli')=='Tifli' and A.evaluate("!JSON.parse(localStorage.getItem('fk3')).ideas.squadnames.names.tifli"))
    # ---- member rename
    busy=A.evaluate("[...__ynmo.directory().keys()].find(n=>__ynmo.items().some(i=>i.res.includes(n)))")
    other=A.evaluate("[...__ynmo.directory().keys()].find(n=>n!=='%s')"%busy)
    row=A.locator('#pg-resources .tbl tbody tr', has=A.locator('b', has_text=busy)).first
    row.locator('button[aria-label^="Rename"]').click(); ri=A.locator('#pg-resources .tbl tbody input[aria-label^="New name"]'); ri.fill('Zed Renamed'); ri.press('Enter'); A.wait_for_timeout(700)
    ok('member shown with new name', A.evaluate("n=>__ynmo.directory().has(n)",'Zed Renamed') and not A.evaluate("n=>__ynmo.directory().has(n)",busy))
    ok('roadmap features follow the rename', A.evaluate("([o,n])=>__ynmo.items().some(i=>i.res.includes(n))&&!__ynmo.items().some(i=>i.res.includes(o))",[busy,'Zed Renamed']))
    ok('toast mentions features updated', A.locator('#toasts .toast', has_text='feature').count()>=1)
    A.reload(); A.wait_for_timeout(1500)
    ok('rename survives reload', A.evaluate("n=>__ynmo.directory().has(n)",'Zed Renamed') and A.evaluate("o=>!__ynmo.directory().has(o)",busy) and A.evaluate("n=>__ynmo.items().some(i=>i.res.includes(n))",'Zed Renamed'))
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    row=A.locator('#pg-resources .tbl tbody tr', has=A.locator('b', has_text=other)).first
    row.locator('button[aria-label^="Rename"]').click(); ri=A.locator('#pg-resources .tbl tbody input[aria-label^="New name"]'); ri.fill('zed renamed'); ri.press('Enter'); A.wait_for_timeout(500)
    ok('duplicate member name rejected', A.evaluate("n=>__ynmo.directory().has(n)",other) and A.locator('#toasts .toast.err', has_text='already').count()>=1)
    A.click('#nav button[data-p="log"]'); A.wait_for_timeout(400); t=A.locator('#pg-log').inner_text()
    ok('log records both renames', 'renamed the squad Tifli' in t and 'is now' not in t and 'renamed '+busy+' to Zed Renamed' in t)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
