import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Sprint page: link a Google Doc and "Copy for Docs" (formatted copy + open the doc, no Google sign-in)."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.grant_permissions(['clipboard-read','clipboard-write']); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(500)
    A.evaluate("()=>{window.__open=[];window.open=(u)=>{window.__open.push(u);return null}}")
    P=A
    def key(*ks):
        for k in ks: P.keyboard.press(k); P.wait_for_timeout(120)
    def typ(t): P.keyboard.type(t); P.wait_for_timeout(120)
    P.locator('.sdoc .ghost .bt').click(); key('/'); typ('Product'); key('Enter'); typ('Tifli'); key('Enter'); typ('Mona Ali'); key('Enter'); typ('Home sessions <phase> 1 #fix'); key('Enter'); P.wait_for_timeout(300)
    key('Tab'); typ('Sub step & check'); P.wait_for_timeout(500)
    ok('buttons are on the sprint page', A.locator('button:text-is("Copy for Docs")').count()==1 and A.locator('button.gdexp').count()==1 and A.locator('input[aria-label="Google Doc link"]').count()==1 and not A.locator('button:text-is("Open linked doc")').is_visible())
    gi=A.locator('input[aria-label="Google Doc link"]')
    gi.fill('https://example.com/not-a-doc'); gi.press('Tab'); A.wait_for_timeout(400)
    ok('a non-Google link is rejected', A.locator('#toasts .toast.err').count()>=1 and gi.input_value()=='')
    gi.fill('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing'); gi.press('Tab'); A.wait_for_timeout(500)
    ok('Google Doc link is normalised and saved on the sprint', gi.input_value()=='https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit' and A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprints)[0].gdoc")=='https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit')
    ok('Open linked doc appears and opens the doc', A.locator('button:text-is("Open linked doc")').is_visible())
    A.click('button:text-is("Open linked doc")'); ok('opens in a new tab', A.evaluate("window.__open")[-1].endswith('/edit'))
    A.click('button:text-is("Copy for Docs")'); A.wait_for_timeout(700)
    ok('export opens the linked doc', A.evaluate("window.__open.length")==2 and A.evaluate("window.__open")[-1].startswith('https://docs.google.com/document/d/1AbC'))
    clip=A.evaluate("async()=>{const it=(await navigator.clipboard.read())[0]; const h=await (await it.getType('text/html')).text(); const t=await (await it.getType('text/plain')).text(); return [h,t]}")
    h,t=clip
    ok('copied as formatted text: title, product heading, person heading, list', '<h1>Sprint 1</h1>' in h and '<h2>Tifli</h2>' in h and '<h3>Mona Ali</h3>' in h and '<ul><li>' in h)
    ok('text is escaped and sub-steps are nested', '&lt;phase&gt;' in h and 'Sub step &amp; check' in h and h.count('<ul>')>=2)
    ok('status and tag are shown', '[Planned]' in h and '#fix' in h)
    ok('plain-text twin is readable', 'TIFLI' in t and 'Mona Ali' in t and '  - Home sessions' in t)
    ok('success message tells you to paste', A.locator('#toasts .toast', has_text='press Ctrl/Cmd+V').count()>=1)
    # unlink, then export opens a new empty doc
    gi.fill(''); gi.press('Tab'); A.wait_for_timeout(400)
    ok('link can be removed', not A.locator('button:text-is("Open linked doc")').is_visible() and A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprints)[0].gdoc")==None)
    A.click('button:text-is("Copy for Docs")'); A.wait_for_timeout(600)
    ok('without a link, export opens a new Google Doc', A.evaluate("window.__open")[-1]=='https://docs.new')
    A.reload(); A.wait_for_timeout(1500)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
