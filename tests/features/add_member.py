import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Resources > Add member: choose the roadmaps that get a row; a person already added from the roadmap is not duplicated."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    rows=lambda n: A.evaluate("n=>[...document.querySelectorAll('.c1.pn[data-person]')].some(e=>e.dataset.person===n)",n)
    # added from the roadmap first
    A.click('#addp'); A.fill('#ap-n','Nora Test'); A.click('#pop button:text-is("Add")'); A.wait_for_timeout(500)
    ok('added from the roadmap shows a row', rows('Nora Test'))
    A.click('#nav button[data-p="resources"]'); A.wait_for_timeout(400)
    ok('form offers the roadmaps', A.locator('#pg-resources form.card button.pill[aria-pressed="true"]', has_text='H2').count()>=1 or A.locator('#pg-resources form.card .formrow').nth(2).locator('.pill').count()>=1)
    n0=A.evaluate("__ynmo.directory().size")
    A.fill('#pg-resources form.card input[type=text]','nora test'); A.click('#pg-resources form.card button:text-is("Add member")'); A.wait_for_timeout(500)
    ok('same person typed again is not duplicated', A.evaluate("__ynmo.directory().size")==n0 and A.locator('#toasts .toast', has_text='no duplicate').count()>=1)
    # new member, unticked roadmap => no row there
    A.fill('#pg-resources form.card input[type=text]','Omar Fresh')
    A.locator('#pg-resources form.card .pill[aria-pressed="true"]').filter(has_text='').last.evaluate("e=>e.click()")
    A.click('#pg-resources form.card button:text-is("Add member")'); A.wait_for_timeout(600)
    ok('member added to the team', A.evaluate("__ynmo.directory().has('Omar Fresh')"))
    ok('hidden on the roadmap that was unticked', A.evaluate("n=>Object.values(__ynmo.S.ideas.peoplehide.byRm).some(l=>l.includes(n))",'Omar Fresh'))
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
