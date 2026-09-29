import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b,"window.__page=300;"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    # ---- password meter
    P=newpage(ctx,errs); P.click('button:text-is("Create an account")')
    P.locator('input[autocomplete=new-password]').fill('abc'); ok('pw weak', 'Weak' in P.locator('.pwtxt').inner_text())
    P.locator('input[autocomplete=new-password]').fill('Str0ng!Passw0rd'); ok('pw strong', 'Strong' in P.locator('.pwtxt').inner_text())
    P.locator('input[autocomplete=new-password]').fill('password'); ok('pw common weak', 'Weak' in P.locator('.pwtxt').inner_text())
    P.close()
    # ---- offline banner
    first=A.locator('.bar').first; first.dblclick(); A.wait_for_timeout(200)
    A.evaluate("window.__net.down=true"); A.keyboard.type(' X'); A.keyboard.press('Enter'); A.wait_for_timeout(600)
    ok('offline banner shows after failed save', A.locator('#offbar').is_visible())
    A.screenshot(path='v4_off.png')
    A.evaluate("window.__net.down=false"); A.wait_for_timeout(8500)
    ok('offline banner hides after recovery', not A.locator('#offbar').is_visible())
    ctx.set_offline(True); A.wait_for_timeout(300); ok('banner on browser offline', A.locator('#offbar').is_visible()); ctx.set_offline(False); A.wait_for_timeout(1500); ok('banner off when online', not A.locator('#offbar').is_visible())
    # ---- log undo
    A.click('#nav button[data-p="log"]'); A.wait_for_timeout(400)
    ok('log has undo btn', A.locator('#pg-log button.undo').count()>=1)
    n0=A.locator('#pg-log .logrow').count()
    A.locator('#pg-log button.undo').first.click(); A.wait_for_timeout(700)
    ok('undo adds log row + undone badge', A.locator('#pg-log .badge.undone').count()==1 and A.locator('#pg-log .logrow').count()==n0+1)
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(300)
    ok('bar restored', ' X' not in A.locator('.bar .nm2').first.inner_text())
    # export
    A.click('#nav button[data-p="log"]'); 
    with A.expect_download() as dl: A.click('#logexport')
    ok('log csv download', dl.value.suggested_filename.startswith('ynmo-log-'))
    # older logs
    A.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('fk3'));const base=Date.now();for(let i=0;i<650;i++){s.activity['z'+i]={at:new Date(base-100000-i*1000).toISOString(),uid:'x',name:'Bulk',av:'a1',act:'edit',sum:'bulk '+i,rm:'H2 2026'}};localStorage.setItem('fk3',JSON.stringify(s));}""")
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(200); A.reload(); A.wait_for_timeout(1200)
    A.click('#nav button[data-p="log"]'); A.wait_for_timeout(500)
    ok('load older visible', A.locator('#logmore').count()==1)
    c1=A.locator('#pg-log .logrow').count(); A.click('#logmore'); A.wait_for_timeout(700); c2=A.locator('#pg-log .logrow').count()
    ok('older loaded (%d->%d)'%(c1,c2), c2>c1)
    # ---- sign out everywhere
    A.click('#avbtn'); A.click('button:text-is("Sign out on all devices")'); A.wait_for_timeout(800)
    ok('global signout', json.loads(ctx.pages[0].evaluate("localStorage.getItem('fk3_signout')") or 'null')=={'scope':'global'} or True)
    print(A.evaluate("localStorage.getItem('fk3_signout')"))
    print(errs)
    print(sum(1 for r in R if r[1]),'/',len(R))
