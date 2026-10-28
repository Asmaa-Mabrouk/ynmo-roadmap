import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""A new resource shows up everywhere: Resources, Vacations, Roadmap rows and assign menus, Sprints, Monthly points (by track) and the Dashboard. Fake database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def add(P,mo,text):
    c=P.locator('.mdcol[data-mo="%s"]'%mo); c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill(text); ta.press('Enter'); P.wait_for_timeout(500); P.keyboard.press('Escape'); P.wait_for_timeout(250)
def open_points(P,t): P.locator('.mdcard:has-text("%s")'%t).first.locator('.kebab').click(); P.locator('#ctx .mi:has-text("Points and people")').click(); P.wait_for_timeout(300)
def in_points(P,card,track,name):
    open_points(P,card); P.click('#xdlg .ptrack[data-k="%s"]'%track); n=P.locator('#xdlg .pperson[data-track="%s"][data-name="%s"]'%(track,name)).count(); P.keyboard.press('Escape'); P.wait_for_timeout(250)
    if P.locator('#xdlg').count() and P.locator('#xdlg').is_visible(): P.click('#xdlg button:text-is("Cancel")'); P.wait_for_timeout(200)
    return n==1
T=[0]
def tick(c):
    T[0]+=1; c.clock.set_fixed_time('2026-10-20T10:%02d:00'%T[0])   # ids are built from the clock
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(600); add(A,'2026-11','probe card')
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(700)
    f='#pg-resources form.card'
    A.locator(f+' select').first.select_option('QA'); A.wait_for_timeout(200)
    ok('R1 choosing QA as the domain pre-selects the Quality track', A.locator(f+' .trackrow .pill[data-track="qa"][aria-pressed="true"]').count()==1 and A.locator(f+' .trackrow .pill[aria-pressed="true"]').count()==1)
    tick(ctx); A.fill(f+' input[type=text]','Nora Quality'); A.click(f+' button:text-is("Add member")'); A.wait_for_timeout(700)
    ok('R2 she is in Resources', A.evaluate("__ynmo.directory().has('Nora Quality')"))
    A.click('#nav button[data-p="vacations"]'); A.wait_for_timeout(500)
    ok('R3 she is in the Vacations list', A.evaluate("[...document.querySelectorAll('#pg-vacations form select')[0].options].some(o=>o.textContent==='Nora Quality')"))
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(600)
    ok('R4 she has a row on the roadmap', A.evaluate("[...document.querySelectorAll('.c1.pn[data-person]')].some(e=>e.dataset.person==='Nora Quality')"))
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(600)
    ok('R5 Monthly "Points and people" lists her under Quality', in_points(A,'probe card','qa','Nora Quality'))
    ok('R6 she is not listed under Backend', not in_points(A,'probe card','be','Nora Quality'))
    A.click('#nav button[data-p="capacity"]'); A.wait_for_timeout(600)
    ok('R7 the Dashboard team lists her', A.locator('#cpheatp .cprl[data-name="Nora Quality"]').count()==1)
    ok('R8 the Quality track can take her 28 points more (112 + 28)', A.locator('#cpheat .cpcell[data-lane="qa"][data-m="2026-11"] .cpnum').inner_text().strip()=='0 / 140')
    # ambiguous domain: nothing pre-selected, choose Backend by hand
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(600)
    A.locator(f+' select').first.select_option('Engineering'); A.wait_for_timeout(200)
    ok('R9 an Engineering domain does not guess a track', A.locator(f+' .trackrow .pill[aria-pressed="true"]').count()==0)
    tick(ctx); A.fill(f+' input[type=text]','Omar Backend'); A.locator(f+' .trackrow .pill[data-track="be"]').click(); A.click(f+' button:text-is("Add member")'); A.wait_for_timeout(700)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(600)
    ok('R10 a person given the Backend track is listed under Backend in Monthly', in_points(A,'probe card','be','Omar Backend'))
    # a person with no track (PM)
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(600)
    A.locator(f+' select').first.select_option('PM'); tick(ctx); A.fill(f+' input[type=text]','Pam Manager'); A.click(f+' button:text-is("Add member")'); A.wait_for_timeout(700)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(600)
    ok('R11 a PM with no track is in no points list', not in_points(A,'probe card','qa','Pam Manager') and not in_points(A,'probe card','be','Pam Manager'))
    # Manage pop-up: change the tracks of an existing person
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(600)
    A.locator('button[data-manage="Pam Manager"]').click(); A.wait_for_timeout(300)
    ok('R12 the Manage pop-up shows the tracks, none ticked for her', A.locator('#xdlg .trackrow .pill[aria-pressed="true"]').count()==0)
    A.locator('#xdlg .trackrow .pill[data-track="des"]').click(); A.wait_for_timeout(500); A.click('#xdlg button:text-is("Close")'); A.wait_for_timeout(300)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(600)
    ok('R13 after ticking Design in the pop-up she is listed under Design', in_points(A,'probe card','des','Pam Manager'))
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(600)
    A.locator('button[data-manage="Nora Quality"]').click(); A.wait_for_timeout(300)
    ok('R14 Nora is ticked on Quality in the pop-up', A.locator('#xdlg .trackrow .pill[data-track="qa"][aria-pressed="true"]').count()==1)
    A.locator('#xdlg .trackrow .pill[data-track="qa"]').click(); A.wait_for_timeout(500); A.click('#xdlg button:text-is("Close")'); A.wait_for_timeout(300)
    A.click('#nav button[data-p="capacity"]'); A.wait_for_timeout(600)
    ok('R15 unticking the track takes her out of the Dashboard team and capacity', A.locator('#cpheatp .cprl[data-name="Nora Quality"]').count()==0 and A.locator('#cpheat .cpcell[data-lane="qa"][data-m="2026-11"] .cpnum').inner_text().strip()=='0 / 112')
    # roadmap "+ Add person" with role Quality
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(600)
    tick(ctx); A.click('#addp'); A.fill('#ap-n','Quin Tester'); A.select_option('#ap-role','qa'); A.click('#pop button:text-is("Add")'); A.wait_for_timeout(700)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(600)
    ok('R16 a Quality person added from the roadmap is listed under Quality in Monthly', in_points(A,'probe card','qa','Quin Tester'))
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(600)
    ok('no page errors', errs==[]); print('errors:',errs[:3])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
