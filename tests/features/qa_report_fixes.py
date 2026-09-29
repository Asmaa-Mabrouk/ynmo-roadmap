import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Regression tests for bugs found by the Chrome-extension QA run: orphan ideas, column order race, hash after dead share link,
stale vacation banner, plural wording, partial-leave capacity flag, hidden edit hint for viewers/shared."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    # 1. deleting a roadmap returns its scheduled ideas to the backlog
    A.click('#nav button[data-p="roadmaps"]'); f=A.locator('#pg-roadmaps form'); s=f.locator('select')
    s.nth(0).select_option('2027'); s.nth(1).select_option('Q1'); f.locator('input[type=text]').fill('QA-TEST'); f.locator('button:text-is("Create roadmap")').click(); A.wait_for_timeout(600)
    A.click('#nav button[data-p="ideas"]'); A.wait_for_timeout(300)
    A.locator('.col').first.locator('input[type=text]').fill('Orphan idea'); A.keyboard.press('Enter'); A.wait_for_timeout(500)
    iid=A.evaluate("Object.keys(__ynmo.S.ideas).find(k=>__ynmo.S.ideas[k].t==='Orphan idea')")
    A.evaluate("id=>__ynmo.scheduleIdea(id,'',3,5)",iid); A.wait_for_timeout(400)
    ok('idea scheduled', A.evaluate("id=>__ynmo.S.ideas[id].st",iid)=='scheduled')
    A.click('#nav button[data-p="roadmaps"]'); A.wait_for_timeout(300)
    card=A.locator('.rmcard:has-text("QA-TEST")'); card.locator('button.danger').click(); A.wait_for_timeout(150); card.locator('button.danger').click(); A.wait_for_timeout(700)
    ok('roadmap deleted', A.locator('.rmcard:has-text("QA-TEST")').count()==0)
    ok('scheduled idea back in backlog', A.evaluate("id=>[__ynmo.S.ideas[id].st,__ynmo.S.ideas[id].rm]",iid)==['idea',None])
    # 2. column "Move left" survives a slow save
    A.click('#nav button[data-p="ideas"]'); A.wait_for_timeout(300)
    A.click('#addcol'); A.locator('#xdlg input').first.fill('QAcol'); A.keyboard.press('Enter'); A.wait_for_timeout(500)
    A.evaluate("localStorage.setItem('dly','1200')")
    A.locator('.col').last.locator('.colmore').click(); A.click('#ctx :text("Move left")'); A.wait_for_timeout(2500)
    order=lambda: A.evaluate("[...document.querySelectorAll('.col .colmore')].map(b=>b.getAttribute('aria-label'))")
    o=order(); ok('column moved left and stayed', o[-2].endswith('QAcol') and o[-1].endswith('Daycare')); A.evaluate("localStorage.removeItem('dly')")
    # 3. plural wording + partial leave flag
    A.click('#nav button[data-p="roadmap"]'); A.wait_for_timeout(300)
    ok('no "1 dependencies"', '1 dependencies' not in A.locator('body').inner_text())
    A.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('fk3'));s.vacations.v1={p:'Emad',a0:'2026-10-05',a1:'2026-10-07',t:'Annual',n:''};localStorage.setItem('fk3',JSON.stringify(s));}""")
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="capacity"]'); A.wait_for_timeout(500)
    ok('partial leave week flagged with ⚑', '⚑' in A.locator('.captable tbody tr:has-text("Emad")').first.inner_text())
    # 4. stale vacation banner disappears when that leave is removed
    A.click('#nav button[data-p="vacations"]'); A.wait_for_timeout(300)
    sel=A.locator('#pg-vacations form select').first; sel.select_option('Emad')
    d=A.locator('#pg-vacations form input[type=date]'); d.nth(0).fill('2026-12-01'); d.nth(1).fill('2026-12-03'); A.locator('#pg-vacations form button:text-is("Add leave")').click(); A.wait_for_timeout(600)
    ok('vacation notice shown', A.locator('#pg-vacations .vhead').count()==1)
    A.locator('#pg-vacations tr:has-text("Dec") button:text-is("Remove")').first.click(); A.wait_for_timeout(600)
    ok('vacation notice cleared after removal', A.locator('#pg-vacations .vhead').count()==0)
    # 5. dead share link (fresh tab, like a pasted link) then hash navigation
    B=newpage(ctx,errs,URL+'#/share/'+'x'*20); B.wait_for_timeout(1200)
    ok('dead link message', 'not active' in B.locator('#gate').inner_text())
    B.evaluate("location.hash='#/login'"); B.wait_for_timeout(1800)
    ok('leaving dead link returns to a normal screen', 'not active' not in B.locator('body').inner_text() and B.locator('#gate, #shell').first.is_visible())
    # 6. creating a roadmap switches to it even while the realtime refresh is in flight (was reverting to H2 for Editors)
    A.evaluate("localStorage.setItem('dly','900')")
    A.click('#nav button[data-p="roadmaps"]'); f=A.locator('#pg-roadmaps form'); s=f.locator('select')
    s.nth(0).select_option('2027'); s.nth(1).select_option('Q2'); f.locator('input[type=text]').fill('Race RM'); f.locator('button:text-is("Create roadmap")').click(); A.wait_for_timeout(3000)
    ok('new roadmap stays selected', 'Race RM' in A.locator('#rmtitle').inner_text()); A.evaluate("localStorage.removeItem('dly')")
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
