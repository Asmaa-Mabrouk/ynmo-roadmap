import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Ynmo Flow email notifications: what the app asks flow-notify to send, and when it stays quiet: cascade delete, ticket links, sorting, labels and due dates, product and Monthly card, bug and report fields, quick create, shortcuts, saved filters, bulk edit, workflow designer (rules, reasons), key repair. Fake test database only."""
import json
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('fk3'));s.flow_issues.t1={key:'YNMO-1',n:1,rk:10,type:'task',t:'Pay by card',d:'',st:'open',pr:'medium',as:'',rp:'Omar',par:'',ep:'',pts:null,lb:[],bl:'',sp:'',prod:'',card:'',sev:'',env:'',steps:'',rn:'',req:'',oe:null,cr:'2026-11-01T08:00:00.000Z',up:'2026-11-01T08:00:00.000Z',hist:[{at:'2026-11-01T08:00:00.000Z',by:'Omar',f:'created',a:'',b:'YNMO-1'}]};localStorage.setItem('fk3',JSON.stringify(s))}""")
    A.reload(); A.wait_for_timeout(2200); A.click('#nav button[data-p="flow"]'); A.wait_for_timeout(300)
    calls=lambda: A.evaluate("window.__notifyCalls||[]")
    def openit():
        A.click('.flowitem[data-view="issues"]'); A.wait_for_timeout(300); A.locator('.flowrow',has_text='Pay by card').click(); A.wait_for_timeout(300)
    openit()
    M=A.locator('#fi-as option').nth(1).get_attribute('value')
    A.select_option('#fi-as',M); A.click('#fi-save'); A.wait_for_timeout(3200)
    ok('N1 assigning to someone else asks flow-notify to email them (ids only)', len(calls())==1 and calls()[0]=={'type':'assigned','issue':'t1'})
    openit(); A.select_option('#fi-as','Admin'); A.click('#fi-save'); A.wait_for_timeout(3200)
    ok('N2 assigning to myself sends nothing', len(calls())==1)
    openit(); A.select_option('#fi-st','progress'); A.click('#fi-save'); A.wait_for_timeout(3200)
    ok('N3 a status change on a ticket reported by someone else asks for a status email', len(calls())==2 and calls()[1]['type']=='status' and calls()[1]['issue']=='t1')
    openit(); A.fill('#fi-cm','Hello @'+M+' please look'); A.click('#fi-cm-send'); A.wait_for_timeout(3200)
    c=calls()
    ok('N4 a comment asks for an email with only the ids (no text)', len(c)==3 and c[2]['type']=='comment' and c[2]['issue']=='t1' and 'comment' in c[2] and 'please look' not in str(c))
    A.evaluate("window.__notifySkip=true"); A.fill('#fi-cm','Another one'); A.click('#fi-cm-send'); A.wait_for_timeout(9500)
    ok('N5 "not saved yet" is retried once, then it stops', len(calls())==5)
    A.evaluate("window.__notifySkip=false"); A.evaluate("window.__aiStatus=0")
    A.keyboard.press('Escape'); A.wait_for_timeout(200); A.click('.flowitem[data-view="inbox"]'); A.wait_for_timeout(300)
    ok('N6 the inbox has an "Email me" choice, default Everything', A.locator('#in-email').input_value()=='all')
    A.select_option('#in-email','mine'); A.wait_for_timeout(300)
    saved=A.evaluate("Object.entries(JSON.parse(localStorage.getItem('fk3')).flow_cfg).filter(([k])=>k.startsWith('np_')).map(([k,v])=>v)")
    ok('N7 my choice is saved for me only', saved==[{'m':'mine'}])
    A.reload(); A.wait_for_timeout(2200); A.click('#nav button[data-p="flow"]'); A.wait_for_timeout(300); A.click('.flowitem[data-view="inbox"]'); A.wait_for_timeout(300)
    ok('N8 and remembered after a reload', A.locator('#in-email').input_value()=='mine')
    ok('N9 no script errors', not errs)
    if errs: print(errs)
    b.close()
bad=[n for n,c in R if not c]; print('TOTAL',len(R),'PASS',len(R)-len(bad),'FAIL',len(bad)); sys.exit(1 if bad else 0)
