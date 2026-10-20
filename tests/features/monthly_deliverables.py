import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Weekly report: monthly deliverables with percent complete (weighted, +change since last week), ad hoc requests with the requester,
the list carried into the next weekly report of the same month, read-only after submit, copy text, and starting a new month from the unfinished ones."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def sprint_with(A, end, start):
    A.click('#nav button[data-p="sprints"]'); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(400)
    A.locator('input[aria-label="Sprint end date"]').fill(end); A.wait_for_timeout(300); A.locator('input[aria-label="Sprint start date"]').fill(start); A.wait_for_timeout(500)
def new_report(A):
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(300); A.click('button:has-text("New report for week of")'); A.wait_for_timeout(900)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    sprint_with(A,'2031-01-14','2031-01-01'); new_report(A)
    ok('report has a monthly deliverables section for the month of the week', A.locator('.rmonth').count()==1 and 'January 2031' in A.locator('.rmonth .rmmonth').inner_text())
    ok('empty list explains what to do', 'List what the business expects' in A.locator('.rmonth .rmhint').inner_text())
    tf=lambda: A.locator('.rmonth .rmp[data-k="tifli"]')
    tf().locator('input[aria-label="Add a deliverable for Tifli"]').fill('  Parent   onboarding v2 '); tf().locator('input[aria-label="Add a deliverable for Tifli"]').press('Enter'); A.wait_for_timeout(500)
    ok('deliverable added (trimmed) at 0%', tf().locator('.mrow:not(.adhoc)').count()==1 and tf().locator('input[aria-label="Deliverable"]').input_value()=='Parent onboarding v2' and tf().locator('input[aria-label="Percent complete"]').input_value()=='0')
    pi=tf().locator('.mrow:not(.adhoc) input[aria-label="Percent complete"]').first; pi.fill('40'); pi.press('Tab'); A.wait_for_timeout(500)
    ok('percent updates the month progress', A.locator('.rmonth .rmpct').inner_text()=='40%' and A.locator('.rmonth .rmall .mbar').get_attribute('aria-valuenow')=='40')
    tf().locator('input[aria-label="Add a deliverable for Tifli"]').fill('Wallet top-up'); tf().locator('input[aria-label="Add a deliverable for Tifli"]').press('Enter'); A.wait_for_timeout(500)
    row2=tf().locator('.mrow:not(.adhoc)').nth(1); row2.locator('select[aria-label="Importance"]').select_option('3'); A.wait_for_timeout(400)
    tf().locator('.mrow:not(.adhoc)').nth(1).locator('button:text-is("100%")').click(); A.wait_for_timeout(500)
    ok('progress is weighted by importance (40% x1 and 100% x3 = 85%)', A.locator('.rmonth .rmpct').inner_text()=='85%' and 'Critical' in tf().locator('.mrow:not(.adhoc)').nth(1).locator('select[aria-label="Importance"]').evaluate("e=>e.options[e.selectedIndex].text"))
    ok('a finished deliverable shows Done and counts', tf().locator('.mrow:not(.adhoc)').nth(1).locator('button:has-text("Done")').is_disabled() and '1 of 2 deliverables done' in A.locator('.rmonth .rmsub').inner_text())
    # ad hoc
    tf().locator('input[aria-label="Add an ad hoc request for Tifli"]').fill('Urgent CSV export'); tf().locator('input[aria-label="Requested by for the new request"]').fill('Business team'); tf().locator('input[aria-label="Add an ad hoc request for Tifli"]').press('Enter'); A.wait_for_timeout(500)
    ar=tf().locator('.mrow.adhoc')
    ok('ad hoc request added with who asked', ar.count()==1 and ar.locator('input[aria-label="Ad hoc request"]').input_value()=='Urgent CSV export' and ar.locator('input[aria-label="Requested by"]').input_value()=='Business team')
    ok('ad hoc requests do not change the planned percentage', A.locator('.rmonth .rmpct').inner_text()=='85%' and '1 ad hoc request (0 done)' in A.locator('.rmonth .rmsub').inner_text())
    A.locator('.rmonth .rmp[data-k="tifli"] .mrow.adhoc button:text-is("100%")').click(); A.wait_for_timeout(400)
    ok('ad hoc request can be completed', '1 ad hoc request (1 done)' in A.locator('.rmonth .rmsub').inner_text())
    # undo
    A.locator('#pg-reports h1').click(); A.keyboard.press('Control+z'); A.wait_for_timeout(500)
    ok('Ctrl+Z undoes the last change on the monthly list', 'Undo' in A.locator('#toasts').inner_text() and '1 ad hoc request (0 done)' in A.locator('.rmonth .rmsub').inner_text())
    A.keyboard.press('Control+Shift+z'); A.wait_for_timeout(500)
    # copy text
    A.evaluate("()=>{window.__clip='';Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:t=>{window.__clip=t;return Promise.resolve();}});}")
    A.click('button:text-is("Copy text")'); A.wait_for_timeout(400)
    txt=A.evaluate("window.__clip")
    ok('copied text has the monthly section', 'MONTHLY DELIVERABLES - January 2031 - 85% complete' in txt and 'Ad hoc requests:' in txt and 'requested by Business team' in txt)
    # list card
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(400)
    ok('list card shows the month progress', 'January 2031 deliverables: 85% complete' in A.locator('.rpcard').first.inner_text())
    # next week of the same month carries the list
    A.click('button:has-text("New report for week of")'); A.wait_for_timeout(900)
    ok('next week starts from the same list', tf().locator('.mrow:not(.adhoc)').count()==2 and tf().locator('.mrow.adhoc').count()==1 and A.locator('.rmonth .rmpct').inner_text()=='85%' and A.locator('.mdelta').count()==0)
    pi=tf().locator('.mrow:not(.adhoc) input[aria-label="Percent complete"]').first; pi.fill('60'); pi.press('Tab'); A.wait_for_timeout(500)
    ok('percentage change shows as points since last week', '+20 pts this week' in tf().locator('.mrow:not(.adhoc)').first.locator('.mdelta').inner_text())
    ok('week 2 total moved to 90%', A.locator('.rmonth .rmpct').inner_text()=='90%')
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(400); A.locator('.rpcard a.splink').nth(1).click(); A.wait_for_timeout(500)
    ok('the earlier week keeps its own percentages', A.locator('.rmonth .rmpct').inner_text()=='85%')
    # read-only after submit (week 2)
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(400); A.locator('.rpcard a.splink').first.click(); A.wait_for_timeout(500)
    A.click('button:text-is("Submit to executives")'); A.wait_for_timeout(600)
    ok('submitted report shows the list read-only with bars and changes', A.locator('.rmonth input, .rmonth select, .rmonth .madd').count()==0 and A.locator('.rmonth .mbar').count()>=4 and '+20 pts this week' in A.locator('.rmonth').inner_text() and 'requested by Business team' in A.locator('.rmonth').inner_text())
    # a new month starts from the unfinished ones
    sprint_with(A,'2031-02-14','2031-02-01'); new_report(A)
    ok('a new month starts empty with an offer to copy the unfinished', 'February 2031' in A.locator('.rmonth .rmmonth').inner_text() and A.locator('.rmonth .mrow').count()==0 and A.locator('.rmonth button:has-text("unfinished from January 2031")').count()==1)
    A.click('.rmonth button:has-text("unfinished from January 2031")'); A.wait_for_timeout(600)
    ok('only unfinished items were copied (finished ones stay behind)', A.locator('.rmonth .mrow').count()==1 and 'Wallet' not in A.locator('.rmonth').inner_text() and A.locator('.rmonth input[aria-label="Deliverable"]').input_value()=='Parent onboarding v2' and A.locator('.rmonth input[aria-label="Percent complete"]').input_value()=='60' and A.locator('.mdelta').count()==0)
    A.set_viewport_size({'width':390,'height':800}); A.wait_for_timeout(300)
    ok('no horizontal overflow on a phone', not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
