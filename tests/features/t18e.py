import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b,"window.__idleMs=5000;window.__idleWarn=3000;"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.wait_for_timeout(2500)
    ok('idle warning', A.locator('#xdlg:has-text("Still there?")').count()==1)
    print(A.locator('#idlemsg').inner_text())
    A.click('button:text-is("Stay signed in")'); A.wait_for_timeout(600)
    ok('stay signed in closes', A.locator('#xdlg').count()==0 and A.locator('#nav button').count()>0)
    A.wait_for_timeout(5800)
    ok('auto sign-out after idle', A.locator('#gate').is_visible() and 'Sign in' in A.locator('#gate').inner_text())
    ctx.close()
    # capacity with leave + undo clash
    ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('fk3'));s.vacations.v1={p:'Emad',a0:'2026-10-04',a1:'2026-10-08',t:'Annual',n:''};localStorage.setItem('fk3',JSON.stringify(s));}""")
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="capacity"]'); A.wait_for_timeout(500)
    row=A.locator('.captable tbody tr:has-text("Emad")').first.inner_text()
    ok('capacity leave week flagged', 'Leave!' in row); print(row[:80])
    # undo clash
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(300)
    bar=A.locator('.bar').first; bid=bar.get_attribute('data-id')
    bar.press('ArrowRight'); A.wait_for_timeout(300)
    A.locator('.bar[data-id="%s"]'%bid).first.press('ArrowRight'); A.wait_for_timeout(400)
    A.click('#nav button[data-p="log"]'); A.wait_for_timeout(400)
    A.locator('#pg-log button.undo').last.click(); A.wait_for_timeout(300)
    ok('clash dialog', A.locator('#xdlg:has-text("Undo this change")').count()==1)
    A.click('button:text-is("Keep current")'); A.wait_for_timeout(200)
    A.locator('#pg-log button.undo').first.click(); A.wait_for_timeout(500)
    ok('latest undo no dialog', A.locator('#xdlg').count()==0 and A.locator('.badge.undone').count()==1)
    print(errs); print(sum(1 for r in R if r[1]),'/',len(R))
