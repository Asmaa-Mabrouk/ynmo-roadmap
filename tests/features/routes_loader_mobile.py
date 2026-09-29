import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Assertive checks: hash routes, loading overlay, ideas card drag between products, mobile layout, no page errors."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs,URL+'#/capacity')
    ok('signed-out deep link lands on login route', A.evaluate("location.hash")=='#/login')
    A.click('button:text-is("Create an account")'); ok('signup route', A.evaluate("location.hash")=='#/signup')
    A.evaluate("location.hash='#/forgot'"); A.wait_for_timeout(200); ok('forgot route renders', A.evaluate("location.hash")=='#/forgot' and A.locator('#gate h1').count()==1)
    A.evaluate("location.hash='#/login'"); A.wait_for_timeout(200)
    signup(A,'Admin','adm@x.com')
    ok('app shell after signup', A.locator('#nav button').count()==9)
    # ideas: add + drag card between products; Clear-all removed
    A.click('#nav button[data-p="ideas"]'); A.wait_for_timeout(300)
    A.locator('.col').first.locator('input[type=text]').fill('Idea X'); A.keyboard.press('Enter'); A.wait_for_timeout(500)
    cnt=lambda: [A.locator('.col').nth(i).locator('.icard').count() for i in range(4)]
    c0=cnt(); ok('idea added to first column', c0[0]==1)
    A.locator('.col').first.locator('.grip').first.drag_to(A.locator('.col').nth(2), source_position={'x':10,'y':6}); A.wait_for_timeout(500)
    c1=cnt(); ok('card dragged to third column', c1[0]==0 and c1[2]==1)
    ok('Clear-all button is gone', A.locator('#clearbtn').count()==0)
    # loader visible while data is slow, hidden afterwards
    A.evaluate("localStorage.setItem('dly','1500')"); A.reload(); A.wait_for_timeout(300)
    ok('loader visible during slow load', A.locator('#ldg').is_visible())
    A.wait_for_timeout(5000); ok('loader hidden afterwards', A.locator('#ldg').is_hidden())
    A.evaluate("localStorage.removeItem('dly')")
    # mobile
    A.set_viewport_size({'width':390,'height':800}); A.wait_for_timeout(400)
    for pg in ['roadmap','ideas','resources','vacations','capacity','baselines','log']:
        A.click('#nav button[data-p="%s"]'%pg); A.wait_for_timeout(250)
        ok('no page overflow on phone: '+pg, not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    ok('no uncaught page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
