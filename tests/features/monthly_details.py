import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Card details (info icon) on the Monthly board, and the name shown when hovering the avatars of people who are online. Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def add(P,mo,text):
    c=P.locator('.mdcol[data-mo="%s"]'%mo); c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill(text); ta.press('Enter'); P.wait_for_timeout(500); P.keyboard.press('Escape'); P.wait_for_timeout(250)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); E=newpage(ctx,errs); signup(E,'Exec','exec@x.com')
    A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(700); A.locator('#permissions .permuser:has-text("Exec")').click(); A.wait_for_timeout(300)
    A.click('#permissions button:text-is("Approve with these permissions")'); A.wait_for_timeout(800)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    add(A,'2026-10','Smart reminders'); add(A,'2026-10','No details here')
    card=lambda P,t: P.locator('.mdcol[data-mo="2026-10"] .mdcard:has-text("%s")'%t)
    ok('D1 an editor sees a dim info icon on every card (Add details)', card(A,'Smart reminders').locator('.mdinfo').count()==1 and 'has' not in (card(A,'Smart reminders').locator('.mdinfo').get_attribute('class') or '').split())
    card(A,'Smart reminders').locator('.mdinfo').click(); A.wait_for_timeout(300)
    ok('D2 the dialog has a details box and Save', A.locator('#xdlg textarea[aria-label="Details"]').count()==1 and A.locator('#xdlg button:text-is("Save")').count()==1)
    txt='Parents get a nudge the evening before an appointment.\nSent by push and SMS.\nOnly for Tifli families.'
    A.fill('#xdlg textarea[aria-label="Details"]',txt); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(600)
    ic=card(A,'Smart reminders').locator('.mdinfo')
    ok('D3 after saving the icon is highlighted and its tooltip carries the text', 'has' in (ic.get_attribute('class') or '').split() and 'Only for Tifli families.' in (ic.get_attribute('data-tip') or ''))
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    ok('D4 the details survive a reload', 'Sent by push and SMS.' in (card(A,'Smart reminders').locator('.mdinfo').get_attribute('data-tip') or ''))
    # executive
    E.reload(); E.wait_for_timeout(1500); E.click('#nav button[data-p="monthly"]'); E.wait_for_timeout(1000)
    ok('D5 the executive sees the info icon only on the card that has details', card(E,'Smart reminders').locator('.mdinfo:visible').count()==1 and card(E,'No details here').locator('.mdinfo:visible').count()==0)
    card(E,'Smart reminders').locator('.mdinfo').click(); E.wait_for_timeout(300)
    ok('D6 the executive reads the full text in a read-only dialog (line breaks kept)', E.locator('#xdlg .mdinfotxt').inner_text()==txt and E.locator('#xdlg textarea').count()==0 and E.locator('#xdlg button:text-is("Save")').count()==0)
    E.keyboard.press('Escape'); E.wait_for_timeout(200)
    if E.locator('#xdlg').count(): E.click('#xdlg button:text-is("Close")')
    card(E,'Smart reminders').locator('.mdinfo').hover(); E.wait_for_timeout(300)
    ok('D7 hovering shows the details as a tooltip', 'Parents get a nudge' in E.evaluate("e=>getComputedStyle(e,'::after').content", card(E,'Smart reminders').locator('.mdinfo').element_handle()))
    # undo / remove / copy text
    card(A,'Smart reminders').locator('.mdinfo').click(); A.wait_for_timeout(300); A.click('#xdlg button:text-is("Remove details")'); A.wait_for_timeout(600)
    ok('D8 removing the details dims the icon again', 'has' not in (card(A,'Smart reminders').locator('.mdinfo').get_attribute('class') or '').split())
    A.click('#mdundo'); A.wait_for_timeout(700)
    ok('D9 Undo brings the details back', 'Only for Tifli families.' in (card(A,'Smart reminders').locator('.mdinfo').get_attribute('data-tip') or ''))
    long='x'*400
    card(A,'No details here').locator('.mdinfo').click(); A.wait_for_timeout(300); A.fill('#xdlg textarea[aria-label="Details"]',long); A.keyboard.press('Control+Enter'); A.wait_for_timeout(600)
    tip=card(A,'No details here').locator('.mdinfo').get_attribute('data-tip') or ''
    ok('D10 Ctrl+Enter saves; a long text is cut in the tooltip but complete in the dialog', tip.endswith('(click to read all)') and len(tip)<400)
    card(A,'No details here').locator('.mdinfo').click(); A.wait_for_timeout(300)
    ok('D11 the dialog keeps the full 400 characters', len(A.input_value('#xdlg textarea[aria-label="Details"]'))==400); A.click('#xdlg button:text-is("Cancel")'); A.wait_for_timeout(200)
    # people online: name on hover
    B=A  # Admin sees Exec online
    A.wait_for_timeout(800)
    pav=A.locator('#presence .pav')
    ok('D12 the admin sees the executive online', pav.count()==1)
    pav.first.hover(); A.wait_for_timeout(300)
    t=A.evaluate("e=>getComputedStyle(e,'::after').content", pav.first.element_handle())
    ok('D13 hovering the avatar shows the name instantly %s'%t, 'Exec' in t and 'online' in t)
    ok('D13b the tooltip is not clipped: its owner does not hide overflow (the round avatar inside does)', A.evaluate("e=>getComputedStyle(e).overflow", pav.first.element_handle())!='hidden' and pav.first.locator('.av').count()==1)
    ok('D14 the avatar can be focused with the keyboard and has an accessible name', pav.first.get_attribute('tabindex')=='0' and 'Exec' in (pav.first.get_attribute('aria-label') or ''))
    ok('no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
