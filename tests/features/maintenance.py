import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Maintenance screen: on = the app does not start; off or unreadable = normal: cascade delete, ticket links, sorting, labels and due dates, product and Monthly card, bug and report fields, quick create, shortcuts, saved filters, bulk edit, workflow designer (rules, reasons), key repair. Fake test database only."""
import json
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); errs=[]
    def page(init):
        c=mkctx(b, init=init); p=newpage(c, errs); p.wait_for_timeout(900); return p
    P=page("window.__maintenanceTest={on:true,until:'Expected back: Thursday'}")
    t=P.inner_text('body')
    ok('M1 maintenance on: English message and title shown', 'under maintenance' in t and 'Nothing is lost' in t and P.title()=='Ynmo Roadmaps is under maintenance')
    ok('M2 Arabic message shown, right to left', 'الصيانة' in t and P.locator('.mt-ar').get_attribute('lang')=='ar' and P.evaluate("getComputedStyle(document.querySelector('.mt-ar')).direction")=='rtl')
    ok('M3 the optional "until" line is shown', 'Expected back: Thursday' in t)
    ok('M4 the app did not start: no menu, no sign-in form, no data', P.locator('#nav').count()==0 and P.locator('#email').count()==0 and P.locator('#pg-flow').count()==0)
    ok('M5 a Check again button is there', P.locator('#mt-retry').count()==1)
    Q=page("window.__maintenanceTest={on:true,title:'Custom title',message:'Custom words'}")
    ok('M6 title and message can be changed in the file', 'Custom title' in Q.inner_text('body') and 'Custom words' in Q.inner_text('body'))
    Roff=page("window.__maintenanceTest={on:false}")
    ok('M7 maintenance off: the normal app starts', Roff.locator('.mt').count()==0 and Roff.locator('body *').count()>5)
    S2=page("window.__maintenanceTest=null")
    ok('M8 an unreadable file never locks people out', S2.locator('.mt').count()==0)
    T=page(None)
    ok('M9 no hook and no file (test files are opened locally): the app starts', T.locator('.mt').count()==0)
    ok('M10 no script errors', not errs)
    if errs: print(errs)
    b.close()
bad=[n for n,c in R if not c]; print('TOTAL',len(R),'PASS',len(R)-len(bad),'FAIL',len(bad)); sys.exit(1 if bad else 0)
