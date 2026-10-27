import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""The login screen must never load forever: a sign-in check that never answers ends in a clear screen with a way out. Fake Supabase only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b,init="if(!sessionStorage.getItem('fixed')) window.__authHang=true"); errs=[]
    P=ctx.new_page(); P.on('pageerror',lambda e:errs.append(str(e))); P.goto(URL); P.wait_for_timeout(2000)
    ok('H1 while waiting, the loader shows', P.locator('#ldg:not([hidden])').count()==1)
    P.wait_for_timeout(10500)
    ok('H2 after about 10 s the loader is gone', P.locator('#ldg:not([hidden])').count()==0)
    ok('H3 a clear screen explains and offers Try again and Sign out', 'Taking longer' in P.locator('#gate').inner_text() and P.locator('#gate button:text-is("Try again")').count()==1 and P.locator('#gate button:text-is("Sign out and start fresh")').count()==1)
    ok('H3b the screen says it retries by itself', 'automatically' in P.locator('#gate').inner_text())
    P.evaluate("sessionStorage.setItem('fixed','1')"); P.click('#gate button:text-is("Sign out and start fresh")'); P.locator('#gate input[type=email]').first.wait_for(timeout=8000) if True else None; P.wait_for_timeout(300)
    ok('H4 start fresh clears the saved sign-in and shows the login form once the server answers', P.locator('#gate input[type=email]').count()==1)
    ctx3=mkctx(b,init="if(!sessionStorage.getItem('fixed')) window.__authHang=true"); R3=ctx3.new_page(); R3.goto(URL); R3.wait_for_timeout(11500)
    ok('H6 the stuck screen shows', 'Taking longer' in R3.locator('#gate').inner_text())
    R3.evaluate("window.__authHang=false"); R3.wait_for_timeout(17000)
    ok('H7 when the server answers again it recovers without a click (login form)', R3.locator('#gate input[type=email]').count()==1)
    ctx2=mkctx(b); Q=newpage(ctx2,errs); Q.wait_for_timeout(800)
    ok('H5 a normal start (server answers) shows the login form at once', Q.locator('#gate input[type=email]').count()==1 and Q.locator('#ldg:not([hidden])').count()==0)
    ok('no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R))
