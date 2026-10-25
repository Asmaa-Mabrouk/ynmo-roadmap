import sys, os, re; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""QA pass over permissions edge cases: view-only modules, a change made by an admin while the person is signed in, accessibility names. Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def T(name):
    def deco(f):
        try: f()
        except Exception as e: ok(name+' (error: %s)'%str(e).split('\n')[0][:110], False)
        return f
    return deco
sw=lambda P,label: P.locator('#permissions button.permsw[aria-label="%s"]'%label)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); B=newpage(ctx,errs); signup(B,'Bea','bea@x.com')
    A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(700); A.locator('#permissions .permuser:has-text("Bea")').click(); A.wait_for_timeout(300)
    A.click('#permissions button:text-is("Approve with these permissions")'); A.wait_for_timeout(800)
    B.click('button:has-text("Check again")'); B.wait_for_timeout(1300); B.click('#nav button[data-p="monthly"]'); B.wait_for_timeout(700)
    @T('P1 view-only on Monthly')
    def _():
        ok('P1.1 a Viewer sees the board without any editing control', B.locator('.mdopen').count()==0 and B.locator('#mdundo').count()==0 and B.locator('.mdcard .kebab').count()==0 and B.locator('.addcol, #addmonth').count()==0)
        ok('P1.2 the backlog bar still opens for a Viewer, read-only', (B.click('#mdbltoggle') or True) and (B.wait_for_timeout(300) or True) and B.locator('#mdbacklog').count()==1 and B.locator('#mdbacklog .mdopen').count()==0)
        B.click('#mdbltoggle'); B.wait_for_timeout(200)
    @T('P2 live change of access')
    def _():
        A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(500); A.locator('#permissions .permuser:has-text("Bea")').click(); A.wait_for_timeout(300)
        sw(A,'Edit Monthly deliverables').click(); A.click('#permissions button:text-is("Save permissions")'); A.wait_for_timeout(800)
        B.wait_for_timeout(22000)
        ok('P2.1 Bea gets Edit on Monthly without reloading (within the member refresh)', B.locator('#pg-monthly .mdopen').count()>=1)
        A.locator('#permissions .permuser:has-text("Bea")').click(); A.wait_for_timeout(300)
        sw(A,'View Monthly deliverables').click(); A.click('#permissions button:text-is("Save permissions")'); A.wait_for_timeout(800)
        B.wait_for_timeout(22000)
        ok('P2.2 when View is taken away the module disappears from her menu and she is moved to a page she may see', B.locator('#nav button[data-p="monthly"]').count()==0 and B.locator('#pg-monthly').is_hidden())
    @T('P3 accessibility')
    def _():
        A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(500)
        bad=A.evaluate("""(()=>{const bad=[];document.querySelectorAll('#pg-admin button,#pg-admin input,#pg-admin select,#pg-admin textarea').forEach(e=>{if(e.offsetParent===null)return;const n=(e.getAttribute('aria-label')||e.innerText||e.value||e.placeholder||e.title||'').trim();if(!n)bad.push(e.className||e.tagName)});return bad})()""")
        ok('P3.1 every control on Users & permissions has a name %s'%bad[:3], not bad)
        ok('P3.2 switches are real switches with a state', all(x in ('true','false') for x in A.evaluate("[...document.querySelectorAll('#permissions .permsw')].map(b=>b.getAttribute('aria-checked'))")) and A.locator('#permissions .permsw[role=switch]').count()>=8)
    ok('no uncaught page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
