import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Monthly Undo takes back only the person's OWN last action, never a colleague's."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); B=newpage(ctx,errs); signup(B,'Edd','edd@x.com'); approve(A)
    B.click('button:has-text("Check again")'); B.wait_for_timeout(1200)
    for P in (A,B): P.click('#nav button[data-p="monthly"]'); P.wait_for_timeout(800)
    col=lambda P: P.locator('.mdcol[data-mo="2026-10"]')
    titles=lambda P: P.evaluate("()=>[...document.querySelectorAll('.mdcol[data-mo=\"2026-10\"] .mdtext')].map(e=>e.innerText)")
    def add(P,t):
        c=col(P); c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill(t); ta.press('Enter'); P.wait_for_timeout(600); P.keyboard.press('Escape'); P.wait_for_timeout(1300)
    add(A,'Alice card'); add(B,'Edd card'); A.wait_for_timeout(1500)
    ok('both cards are on both screens', set(titles(A))=={'Alice card','Edd card'} and set(titles(B))=={'Alice card','Edd card'})
    A.click('#mdundo'); A.wait_for_timeout(1500)
    ok("Alice's Undo removes her card only, not Edd's later one", titles(A)==['Edd card'] and titles(B)==['Edd card'])
    ok("Alice has nothing else to undo: Undo is greyed out and Edd's card is untouched", A.locator('#mdundo').is_disabled() and titles(A)==['Edd card'])
    # percentage: Edd sets 50 on his card, Alice sets a flag on it; Edd undoes: pct back, Alice's flag stays
    col(A).locator('.mdcard:has-text("Edd card") .mdhp').click(); A.wait_for_timeout(1200)
    col(B).locator('.mdcard:has-text("Edd card") select[aria-label="Percent complete"]').select_option('50'); B.wait_for_timeout(1500)
    B.click('#mdundo'); B.wait_for_timeout(1500)
    ok("Edd's Undo takes back his percentage and keeps Alice's flag", col(B).locator('.mdcard:has-text("Edd card") select[aria-label="Percent complete"]').input_value()=='0' and col(B).locator('.mdcard.hp').count()==1 and col(A).locator('.mdcard.hp').count()==1)
    ok('no page errors', errs==[])
    print(sum(1 for _,c in R if c),'/',len(R))
