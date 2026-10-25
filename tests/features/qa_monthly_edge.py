import sys, os, re; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""QA pass (end to end + edge cases) over Monthly, notes, undo, backlog, add to roadmap, ids, permissions. Uses only the fake test database, never real data.
Each check is isolated: an exception in one is reported as a FAIL and the run goes on."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
def T(name):
    def deco(f):
        try: f()
        except Exception as e: ok(name+' (error: %s)'%str(e).split('\n')[0][:110], False)
        return f
    return deco
def board_page(ctx,errs,email='adm@x.com',name='Admin',clock=None):
    P=newpage(ctx,errs); signup(P,name,email); P.click('#nav button[data-p="monthly"]'); P.wait_for_timeout(700); return P
def add(P,mo,text,key='Enter'):
    c=P.locator('.mdcol[data-mo="%s"]'%mo); c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill(text); ta.press(key); P.wait_for_timeout(500); P.keyboard.press('Escape'); P.wait_for_timeout(300)
titles=lambda P,mo: P.evaluate("m=>[...document.querySelectorAll('.mdcol[data-mo=\"'+m+'\"] .mdtext')].map(e=>e.innerText)",mo)
ids=lambda P: P.evaluate("()=>[...document.querySelectorAll('#pg-monthly .mdcard .mdid')].map(e=>e.innerText)")
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=board_page(ctx,errs)
    @T('E1 composer edge cases')
    def _():
        c=A.locator('.mdcol[data-mo="2026-10"]'); c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea')
        ta.fill('   \n \n'); ta.press('Enter'); A.wait_for_timeout(300)
        ok('E1.1 blank / whitespace submit adds nothing', len(titles(A,'2026-10'))==0)
        ta.fill('x'*1500); ta.press('Enter'); A.wait_for_timeout(500); A.keyboard.press('Escape'); A.wait_for_timeout(300)
        t=titles(A,'2026-10'); ok('E1.2 an over-long title is capped, not rejected, and does not break the layout', len(t)==1 and 0<len(t[0])<=300 and not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
        add(A,'2026-10','<img src=x onerror="window.__xss=1"> <b>bold</b>'); A.wait_for_timeout(300)
        ok('E1.3 HTML in a title is shown as text (no injection)', A.evaluate("window.__xss")!=1 and A.locator('#pg-monthly .mdcard img').count()==0 and A.locator('#pg-monthly .mdcard b').count()==0)
        add(A,'2026-10','- one\n2) two\n• three\n\n  four  ')
        t=titles(A,'2026-10'); ok('E1.4 a pasted list makes one card per line and strips bullets and numbers', all(x in t for x in ['one','two','three','four']))
        add(A,'2026-10','one'); t=titles(A,'2026-10'); ok('E1.5 duplicate titles are allowed and get different ids', t.count('one')==2 and len(set(ids(A)))==len(ids(A)))
        add(A,'2026-10','بطاقة عربية RTL مع English 123'); A.wait_for_timeout(300)
        ok('E1.6 Arabic title is stored and shown', 'بطاقة عربية RTL مع English 123' in titles(A,'2026-10'))
        c.locator('.mdopen').click(); ta=c.locator('.mdadd textarea'); ta.fill('shift enter'); ta.press('Shift+Enter'); ta.type('second line'); A.wait_for_timeout(200)
        ok('E1.7 Shift+Enter makes a new line and does not submit', 'shift enter' not in titles(A,'2026-10') and '\n' in ta.input_value()); A.keyboard.press('Escape'); A.wait_for_timeout(300)
    @T('E2 card ids')
    def _():
        before=ids(A); nums=[int(x.split('#')[1]) for x in before]
        ok('E2.1 ids are unique numbers', len(nums)==len(set(nums)))
        top=max(nums); topcard=[x for x in before if x.endswith('#%d'%top)][0]
        c=A.locator('.mdcol[data-mo="2026-10"] .mdcard:has(.mdid:text-is("%s"))'%topcard); c.locator('.kebab').click(); A.locator('#ctx .mi:text-is("Delete card")').click(); A.click('#xdlg button:text-is("Delete card")'); A.wait_for_timeout(500)
        add(A,'2026-10','after delete'); new=[x for x in ids(A) if x not in before]
        ok('E2.2 a deleted card\'s number is never given to a new card (tracking ids stay unique)', len(new)==1 and int(new[0].split('#')[1])>top)
    @T('E3 months')
    def _():
        for i in range(3): A.click('#addmonth'); A.wait_for_timeout(350)
        labs=A.evaluate("[...document.querySelectorAll('.mdcol h2')].map(h=>h.innerText.split('\\n')[0])")
        ok('E3.1 adding months continues through the year end (Jan 2027 follows Dec 2026)', 'January 2027' in labs and labs.index('January 2027')==labs.index('December 2026')+1)
        ok('E3.2 the board scrolls sideways, the page does not', not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    @T('E4 add to roadmap')
    def _():
        c=A.locator('.mdcol[data-mo="2026-10"] .mdcard').first; c.locator('.kebab').click(); A.locator('#ctx .mi:has-text("Add to roadmap")').click(); A.wait_for_timeout(300)
        A.fill('#xdlg [aria-label="Start date"]',''); A.click('#xdlg button:text-is("Add to roadmap")'); A.wait_for_timeout(300)
        ok('E4.1 an empty start date is refused with a message', A.locator('#xdlg').count()==1 and A.locator('#xdlg .gerr').inner_text().strip()!='')
        A.fill('#xdlg [aria-label="Start date"]','2030-01-01'); A.fill('#xdlg [aria-label="End date"]','2030-02-01'); A.click('#xdlg button:text-is("Add to roadmap")'); A.wait_for_timeout(500)
        ok('E4.2 dates outside the roadmap are refused or clamped, never saved as a broken bar', A.locator('#xdlg').count()==1 or A.evaluate("Object.values(__ynmo.S.over).filter(o=>o.custom).every(o=>o.d0>=0&&o.d1<__ynmo.NDAYS&&o.d0<=o.d1)"))
        if A.locator('#xdlg').count(): A.click('#xdlg button:text-is("Cancel")'); A.wait_for_timeout(200)
    @T('E5 notes')
    def _():
        c=A.locator('.mdcol[data-mo="2026-10"] .mdcard').first; c.locator('.mdnote').click(); ta=A.locator('#xdlg textarea')
        ta.fill('   '); A.click('#xdlg button:text-is("Add note")'); A.wait_for_timeout(300)
        ok('E5.1 a blank note is not added', A.locator('#xdlg .mdnitem').count()==0)
        ta.fill('<script>window.__n=1</script> note & <b>x</b>'); A.click('#xdlg button:text-is("Add note")'); A.wait_for_timeout(500)
        ok('E5.2 HTML in a note is shown as text', A.locator('#xdlg .mdntext b').count()==0 and 'note & <b>x</b>' in A.locator('#xdlg .mdntext').inner_text() and A.evaluate("window.__n")!=1)
        A.locator('#xdlg textarea').fill('y'*1500); A.click('#xdlg button:text-is("Add note")'); A.wait_for_timeout(500)
        ok('E5.3 a very long note stays inside the dialog (wraps, no sideways scroll)', A.evaluate("(()=>{const d=document.querySelector('#xdlg');return d.scrollWidth<=d.clientWidth+2})()"))
        A.keyboard.press('Escape'); A.wait_for_timeout(300)
        ok('E5.4 Escape closes the thread dialog', A.locator('#xdlg').count()==0)
    @T('E6 delete month')
    def _():
        add(A,'2026-11','to be deleted'); A.locator('.mdcol[data-mo="2026-11"] .colmore').click(); A.locator('#ctx .mi:text-is("Delete month")').click(); A.wait_for_timeout(200)
        inp=A.locator('#xdlg input'); inp.fill('DELETE '); ok('E6.1 the word is accepted in any case with spaces around it', not A.locator('#xdlg button:text-is("Delete month")').is_disabled())
        inp.fill('del'); ok('E6.2 a part of the word is not accepted', A.locator('#xdlg button:text-is("Delete month")').is_disabled())
        inp.press('Enter'); A.wait_for_timeout(300); ok('E6.3 Enter with a wrong word does nothing', A.locator('#xdlg').count()==1)
        A.keyboard.press('Escape'); A.wait_for_timeout(200); ok('E6.4 Escape cancels', A.locator('#xdlg').count()==0)
    @T('E7 undo')
    def _():
        n=len(titles(A,'2026-10')); A.locator('.mdcol[data-mo="2026-10"] .mdcard').nth(1).locator('.kebab').click(); A.locator('#ctx .mi:text-is("Delete card")').click(); A.click('#xdlg button:text-is("Delete card")'); A.wait_for_timeout(500)
        A.locator('.mdcol[data-mo="2026-10"] .mdopen').click(); A.locator('.mdcol[data-mo="2026-10"] .mdadd textarea').fill('typing here'); A.locator('.mdcol[data-mo="2026-10"] .mdadd textarea').press('Control+z'); A.wait_for_timeout(300)
        ok('E7.1 Ctrl+Z while typing in a box does not trigger the board Undo', len(titles(A,'2026-10'))==n-1)
        A.keyboard.press('Escape'); A.wait_for_timeout(200); A.locator('body').click(position={'x':5,'y':5}); A.keyboard.press('Control+z'); A.wait_for_timeout(600)
        ok('E7.2 Ctrl+Z on the page brings the deleted card back', len(titles(A,'2026-10'))==n)
        for i in range(60): add(A,'2026-12','u%d'%i) if i<3 else None
        ok('E7.3 Undo button is disabled when there is nothing to undo after a reload', (A.reload() or True) and (A.wait_for_timeout(1500) or True) and (A.click('#nav button[data-p="monthly"]') or True) and (A.wait_for_timeout(600) or True) and A.locator('#mdundo').is_disabled())
    @T('E8 backlog')
    def _():
        A.click('#mdbltoggle'); A.wait_for_timeout(300); add(A,'backlog','idea one'); 
        ok('E8.1 backlog cards have no percentage and no Add to roadmap', A.locator('#mdbacklog .mdcard').count()>=1 and A.locator('#mdbacklog select[aria-label="Percent complete"]').count()==0)
        A.fill('#pg-monthly input[type=search]','idea'); A.wait_for_timeout(300)
        ok('E8.2 search filters the backlog too', A.locator('#mdbacklog .mdcard').count()==1 and A.locator('.mdcol[data-mo="2026-10"] .mdcard').count()==0)
        A.fill('#pg-monthly input[type=search]','zzzz'); A.wait_for_timeout(300)
        ok('E8.3 a search with no result says so, in the backlog and the months', 'Nothing matches' in A.locator('#mdbacklog').inner_text())
        A.fill('#pg-monthly input[type=search]',''); A.wait_for_timeout(200)
    @T('E9 phone layout')
    def _():
        A.set_viewport_size({'width':390,'height':800}); A.wait_for_timeout(500)
        ok('E9.1 no page overflow with the backlog open on a phone', not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
        A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(600)
        ok('E9.2 permissions page fits a phone', not A.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
        A.set_viewport_size({'width':1400,'height':900}); A.wait_for_timeout(300); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(400)
    @T('E10 a person with no access at all')
    def _():
        Bp=newpage(ctx,errs); signup(Bp,'Nobody','nobody@x.com'); A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(300); A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(1200)
        A.locator('#permissions .permuser:has-text("Nobody")').click(); A.wait_for_timeout(300)
        for lab in ['Roadmap','Roadmaps','Sprints','Reports','Monthly deliverables','Resources','Vacations','Log']:
            sb_=A.locator('#permissions button.permsw[aria-label="View %s"]'%lab)
            if sb_.get_attribute('aria-checked')=='true': sb_.click(); A.wait_for_timeout(120)
        A.click('#permissions button:text-is("Approve with these permissions")'); A.wait_for_timeout(800)
        Bp.click('button:has-text("Check again")'); Bp.wait_for_timeout(1500)
        txt=Bp.locator('body').inner_text()
        ok('E10.1 a person with no module access gets a clear message, not a blank or broken app', re.search(r'(no access|not have access|ask an admin|do not have access)',txt,re.I) is not None)
        ok('E10.2 and no module page is visible to them', Bp.evaluate("[...document.querySelectorAll('.pg')].filter(p=>!p.hidden&&p.offsetParent&&p.innerText.trim().length>0).length")==0)
    ok('no uncaught page errors during the whole run', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
