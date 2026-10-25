import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Assertive checks: hash routes, loading overlay, mobile layout, no page errors."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs,URL+'#/vacations')
    ok('signed-out deep link lands on login route', A.evaluate("location.hash")=='#/login')
    A.click('button:text-is("Create an account")'); ok('signup route', A.evaluate("location.hash")=='#/signup')
    A.evaluate("location.hash='#/forgot'"); A.wait_for_timeout(200); ok('forgot route renders', A.evaluate("location.hash")=='#/forgot' and A.locator('#gate h1').count()==1)
    A.evaluate("location.hash='#/login'"); A.wait_for_timeout(200)
    signup(A,'Admin','adm@x.com')
    ok('app shell after signup', A.locator('#nav button').count()==9)
    # loader visible while data is slow, hidden afterwards
    A.evaluate("localStorage.setItem('dly','1500')"); A.reload(); A.wait_for_timeout(300)
    ok('loader visible during slow load', A.locator('#ldg').is_visible())
    A.wait_for_timeout(5000); ok('loader hidden afterwards', A.locator('#ldg').is_hidden())
    A.evaluate("localStorage.removeItem('dly')")
    # mobile
    A.set_viewport_size({'width':390,'height':800}); A.wait_for_timeout(400)
    for pg in ['roadmap','resources','vacations','monthly','log']:
        A.click('#nav button[data-p="%s"]'%pg); A.wait_for_timeout(250)
        ok('no page overflow on phone: '+pg, not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    ok('no uncaught page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
