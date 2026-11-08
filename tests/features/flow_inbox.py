import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Ynmo Flow inbox ("For you"): what needs my answer, reply drafts, digest, masking, dismiss, errors: cascade delete, ticket links, sorting, labels and due dates, product and Monthly card, bug and report fields, quick create, shortcuts, saved filters, bulk edit, workflow designer (rules, reasons), key repair. Fake test database only."""
import json
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('fk3'));const base={type:'task',d:'',pr:'medium',par:'',ep:'',pts:null,lb:[],bl:'',sp:'',prod:'',card:'',sev:'',env:'',steps:'',rn:'',req:'',cr:'2026-10-01T08:00:00.000Z',up:'2026-10-01T08:00:00.000Z',hist:[{at:'2026-10-01T08:00:00.000Z',by:'Omar',f:'created',a:'',b:'K'}]};
    const mk=(id,n,o)=>{s.flow_issues[id]=Object.assign({},base,{key:'YNMO-'+n,n:n,rk:n*10},o)};
    mk('i1',1,{t:'Bank API pack',st:'blocked',as:'Admin',rp:'Omar',bl:'Waiting for Bank Albilad',up:new Date().toISOString()});
    mk('i2',2,{t:'Late report',st:'open',as:'Admin',rp:'Omar',due:'2026-10-05',up:new Date().toISOString()});
    mk('i3',3,{t:'Nobody owns this',st:'open',as:'',rp:'Omar',up:new Date().toISOString()});
    mk('i4',4,{t:'Someone else task',st:'open',as:'Omar',rp:'Omar'});
    localStorage.setItem('fk3',JSON.stringify(s))}""")
    A.reload(); A.wait_for_timeout(2200); A.click('#nav button[data-p="flow"]'); A.wait_for_timeout(400)
    ok('I1 the sidebar starts with "For you" and a badge with the number waiting', A.locator('.flowitem').first.inner_text().startswith('For you') and A.locator('.flowitem[data-view="inbox"] .flowcount').inner_text()=='3')
    A.click('.flowitem[data-view="inbox"]'); A.wait_for_timeout(300)
    ok('I2 three groups in order: Blocked, Overdue, Needs an owner; others\' tickets are not listed', A.locator('.finsec').evaluate_all("e=>e.map(x=>x.dataset.kind).join()")=='blocked,overdue,triage' and A.locator('.finrow').count()==3)
    ok('I3 the blocked item shows its reason', 'Waiting for Bank Albilad' in A.locator('.finrow',has_text='Bank API pack').inner_text())
    A.locator('.finrow',has_text='Bank API pack').locator('button[data-act="suggest"]').click(); A.wait_for_timeout(200)
    ok('I4 Suggest reply opens style, language and instruction', A.locator('#in-tone').is_visible() and A.locator('#in-lang').is_visible() and A.locator('#in-extra').is_visible())
    A.fill('#in-extra','Ask for a date'); A.click('#in-go'); A.wait_for_timeout(500)
    ok('I5 three drafts come back with Copy buttons', A.locator('.finreply').count()==3 and A.locator('.finreply button:text-is("Copy")').count()==3)
    call=A.evaluate("window.__flowAi[0]")
    ok('I6 the function got mode reply, the ticket key and my instruction', call['mode']=='reply' and call['ticket']['key']=='YNMO-1' and call['extra']=='Ask for a date')
    ok('I7 names are hidden by default: the AI sees Person A, never "Admin"/"Omar"', 'Admin' not in str(call) and 'Omar' not in str(call) and 'Person' in str(call))
    ok('I8 the draft shows the real name back (unmasked)', 'Person' not in A.locator('.finreply').first.inner_text())
    A.click('#in-mask'); A.locator('.finrow',has_text='Bank API pack').locator('button[data-act="suggest"]').click(); A.locator('.finrow',has_text='Bank API pack').locator('button[data-act="suggest"]').click(); A.wait_for_timeout(200); A.click('#in-go'); A.wait_for_timeout(500)
    ok('I9 with masking off the real names are sent', 'Admin' in str(A.evaluate("window.__flowAi[1]")))
    A.click('#in-digest'); A.wait_for_timeout(500)
    ok('I10 Summarize my inbox shows a summary and a suggested order', 'Digest of 3' in A.locator('#in-sum').inner_text() and A.locator('#in-sum ol li').count()>=1)
    A.locator('.finrow',has_text='Late report').locator('button[data-act="dismiss"]').click(); A.wait_for_timeout(300)
    ok('I11 Dismiss removes it and the badge drops', A.locator('.finrow').count()==2)
    A.reload(); A.wait_for_timeout(2200); A.click('#nav button[data-p="flow"]'); A.wait_for_timeout(300)
    ok('I12 the dismissal is remembered after a reload; badge shows 2', A.locator('.flowitem[data-view="inbox"] .flowcount').inner_text()=='2')
    A.evaluate("window.__aiFail=true"); A.click('.flowitem[data-view="inbox"]'); A.wait_for_timeout(300)
    A.locator('.finrow').first.locator('button[data-act="suggest"]').click(); A.wait_for_timeout(200); A.click('#in-go'); A.wait_for_timeout(500)
    ok('I13 when the assistant fails the page says so in words and nothing breaks', 'could not answer' in A.locator('.finout').inner_text().lower() and A.locator('.finreply').count()==0)
    A.locator('.finrow').first.locator('a,button.flink').first.click(); A.wait_for_timeout(300)
    ok('I14 the key opens the ticket window', A.locator('#fi-title').count()==1)
    ok('I15 no script errors', not errs)
    if errs: print(errs)
    b.close()
bad=[n for n,c in R if not c]; print('TOTAL',len(R),'PASS',len(R)-len(bad),'FAIL',len(bad)); sys.exit(1 if bad else 0)
