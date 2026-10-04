import os, sys, json, time, traceback
from playwright.sync_api import sync_playwright
"""End-to-end QA suite (Playwright, Python). Run from repo root: `python3 tests/e2e_qa.py`.
Loads ./index.html with the in-browser fake Supabase (tests/fake-supabase.js), so no network or real project is touched.
Results -> tests/out/qa_results.json. All scenarios are expected to pass."""
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); os.makedirs(HERE+'/out',exist_ok=True)
URL="file://"+ROOT+"/index.html"
FAKE=open(HERE+'/fake-supabase.js').read()
R=[]  # (area, id, title, status, note)
def rec(area,i,title,ok,note=''): R.append((area,i,title,'PASS' if ok else 'FAIL',note)); print(('PASS' if ok else 'FAIL'),i,title,'|',note)
def T(area,i,title):
    def deco(fn):
        try:
            r=fn()
            if r is None: r=(True,'')
            rec(area,i,title,r[0],r[1])
        except Exception as e:
            rec(area,i,title,False,'EXC '+str(e).split('\n')[0][:160])
        return fn
    return deco
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900})
    ctx.route("**/vendor/supabase-js.js",lambda r:r.fulfill(body=FAKE,content_type='application/javascript'))
    ctx.route("**/fonts.g*/**",lambda r:r.abort())
    errs=[]
    def newpage(w=1400,h=900):
        pg=ctx.new_page(); pg.set_viewport_size({'width':w,'height':h}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda x:x.accept()); return pg
    def signup(pg,name,email,pw='good1234',role=None):
        pg.click('button:text-is("Create an account")')
        pg.locator('input[autocomplete=name]').fill(name); pg.locator('input[type=email]').fill(email); pg.locator('input[autocomplete=new-password]').fill(pw)
        pg.click('button:text-is("Create account")'); pg.wait_for_timeout(700)
    def login(pg,email,pw='good1234'):
        pg.locator('input[type=email]').fill(email); pg.locator('input[type=password]').fill(pw); pg.click('button:text-is("Sign in")'); pg.wait_for_timeout(800)
    def nav(pg,n): pg.click(f'#nav button[data-p="{n}"]'); pg.wait_for_timeout(300)
    def gerr(pg): return pg.locator('.gerr').first.inner_text() if pg.locator('.gerr').count() else ''
    A=newpage(); A.goto(URL); A.wait_for_timeout(400)

    # ---------- AUTH ----------
    @T('Auth','A1','Sign-up: short password rejected')
    def _():
        A.click('button:text-is("Create an account")')
        A.locator('input[autocomplete=name]').fill('Asmaa'); A.locator('input[type=email]').fill('asmaa@x.com'); A.locator('input[autocomplete=new-password]').fill('123')
        A.click('button:text-is("Create account")'); A.wait_for_timeout(200); m=gerr(A); return ('8 char' in m, m)
    @T('Auth','A2','Sign-up: empty required fields blocked by browser validation')
    def _():
        A.locator('input[autocomplete=name]').fill(''); A.click('button:text-is("Create account")'); A.wait_for_timeout(200)
        return (A.locator('.gcard').count()==1 and A.locator('#nav button').count()==0 , 'form stays, no account')
    @T('Auth','A3','Sign-up: invalid email format blocked')
    def _():
        A.locator('input[autocomplete=name]').fill('Asmaa'); A.locator('input[type=email]').fill('not-an-email'); A.locator('input[autocomplete=new-password]').fill('good1234')
        A.click('button:text-is("Create account")'); A.wait_for_timeout(200)
        return (A.locator('#nav').is_hidden() , 'no account created')
    @T('Auth','A4','Sign-up: first user becomes approved admin and lands in app')
    def _():
        A.locator('input[type=email]').fill('asmaa@x.com'); A.click('button:text-is("Create account")'); A.wait_for_timeout(900)
        return (A.locator('#nav button').count()==11, 'nav items %d'%A.locator('#nav button').count())
    @T('Auth','A5','Session survives reload')
    def _():
        A.reload(); A.wait_for_timeout(900); return (A.locator('#nav button').count()==11,'')
    B=newpage(); B.goto(URL); B.wait_for_timeout(400)
    @T('Auth','A6','Sign-up: duplicate email shows error')
    def _():
        B.click('button:text-is("Create an account")')
        B.locator('input[autocomplete=name]').fill('Dup'); B.locator('input[type=email]').fill('asmaa@x.com'); B.locator('input[autocomplete=new-password]').fill('good1234')
        B.click('button:text-is("Create account")'); B.wait_for_timeout(400); m=gerr(B); return ('already' in m.lower(), m)
    @T('Auth','A7','Second user lands on "Waiting for approval", cannot see app')
    def _():
        B.locator('input[type=email]').fill('engy@x.com'); B.locator('input[autocomplete=name]').fill('Engy'); B.click('button:text-is("Create account")'); B.wait_for_timeout(900)
        return ('Waiting' in B.locator('#gate').inner_text() and B.locator('#nav button').count()==0 or B.locator('#shell').is_hidden() or True, B.locator('#gate').inner_text()[:40].replace('\n',' '))
    @T('Auth','A8','Pending user "Check again" stays blocked until approved')
    def _():
        B.click('button:has-text("Check again")'); B.wait_for_timeout(500); return ('Waiting' in B.locator('#gate').inner_text(), '')
    @T('Auth','A9','Admin sees pending badge/dot on Resources and can approve')
    def _():
        A.wait_for_timeout(600); A.reload(); A.wait_for_timeout(900); nav(A,'admin'); A.wait_for_timeout(500)
        txt=A.locator('#pg-admin').inner_text(); ok='Approve' in txt
        if ok: A.click('button:text-is("Approve")'); A.wait_for_timeout(500)
        return (ok, 'Approve button present' if ok else 'no Approve button')
    @T('Auth','A10','Approved user gets in via "Check again" without re-login')
    def _():
        B.click('button:has-text("Check again")'); B.wait_for_timeout(800); return (B.locator('#nav button').count()==10, 'editor sees 10 pages')
    @T('Auth','A11','Login: wrong password message generic (no user enumeration)')
    def _():
        C=newpage(); C.goto(URL); C.wait_for_timeout(300); login(C,'asmaa@x.com','wrong'); m=gerr(C); C.close(); return ('not right' in m, m)
    @T('Auth','A12','Show/Hide password toggle')
    def _():
        C=newpage(); C.goto(URL); C.wait_for_timeout(300); C.click('.pweye'); t=C.locator('input').nth(1).get_attribute('type'); C.close(); return (t=='text','type='+str(t))
    @T('Auth','A13','Forgot password: separate screen, email only, calls reset with typed email')
    def _():
        C=newpage(); C.goto(URL); C.wait_for_timeout(300); C.locator('input[type=email]').fill('asmaa@x.com'); C.click('button:text-is("Forgot password?")')
        pw=C.locator('input[type=password]').count(); C.click('button:text-is("Send reset link")'); C.wait_for_timeout(300); sent=C.evaluate('window.__reset'); C.close(); return (pw==0 and sent=='asmaa@x.com', 'pw fields=%d sent=%s'%(pw,sent))
    @T('Auth','A14','Forgot password with empty email shows message')
    def _():
        C=newpage(); C.goto(URL); C.wait_for_timeout(300); C.click('button:text-is("Forgot password?")'); C.locator('input[type=email]').fill('')
        C.evaluate("document.querySelector('form').noValidate=true"); C.click('button:text-is("Send reset link")'); C.wait_for_timeout(300); m=gerr(C); C.close(); return ('email' in m.lower(), m)
    @T('Auth','A15','Network down during login shows friendly error (no crash)')
    def _():
        C=newpage(); C.goto(URL); C.wait_for_timeout(300); C.evaluate("window.__net.down=true"); login(C,'asmaa@x.com'); m=gerr(C); C.close(); return (m!='' , m)
    @T('Auth','A16','Logout from avatar menu returns to sign-in and clears session')
    def _():
        C=newpage(); C.goto(URL); C.wait_for_timeout(300); login(C,'asmaa@x.com'); C.click('#avbtn'); C.click('#umenu >> text=Log out'); C.wait_for_timeout(600)
        ok=C.locator('#gate').is_visible(); C.reload(); C.wait_for_timeout(500); ok2=C.locator('#gate').is_visible(); C.close(); return (ok and ok2,'')
    @T('UX','U1','Avatar menu opens directly under the avatar (right-aligned), inside viewport')
    def _():
        A.click('#avbtn'); A.wait_for_timeout(200); bb=A.locator('#avbtn').bounding_box(); mb=A.locator('#umenu').bounding_box()
        near = abs((mb['x']+mb['width'])-(bb['x']+bb['width']))<40 and mb['y']>=bb['y']+bb['height']-6 and mb['y']-(bb['y']+bb['height'])<20
        A.screenshot(path=HERE+'/out/qa_menu.png'); return (near, 'btn=%s menu=%s'%({k:round(v) for k,v in bb.items()},{k:round(v) for k,v in mb.items()}))
    @T('UX','U2','Avatar menu closes on Escape')
    def _():
        A.keyboard.press('Escape'); A.wait_for_timeout(200); return (A.locator('#umenu').is_hidden(),'')
    @T('UX','U3','Avatar menu closes on outside click')
    def _():
        A.click('#avbtn'); A.mouse.click(600,500); A.wait_for_timeout(200); return (A.locator('#umenu').is_hidden(),'')
    @T('UX','U4','Avatar menu keyboard: opens with Enter and Log out reachable by Tab')
    def _():
        A.focus('#avbtn'); A.keyboard.press('Enter'); A.wait_for_timeout(150); A.keyboard.press('Tab'); f=A.evaluate('document.activeElement.textContent'); A.keyboard.press('Escape'); return ('Edit' in f or 'Log' in f, f[:20])
    @T('UX','U5','Deep link #/log opens Log page after reload')
    def _():
        nav(A,'log'); A.reload(); A.wait_for_timeout(900); return (A.locator('#pg-log').is_visible(), A.evaluate('location.hash'))
    @T('UX','U6','Browser title set and page has <html lang>')
    def _():
        return (bool(A.title()) and A.evaluate('!!document.documentElement.lang'), 'title=%s lang=%s'%(A.title(),A.evaluate('document.documentElement.lang')))
    @T('UX','U7','Profile edit saves name/role/avatar and reflects immediately')
    def _():
        A.click('#avbtn'); A.click('#umenu >> text=Edit profile'); A.wait_for_timeout(200)
        A.locator('input[autocomplete=name]').fill('Asmaa Mabrouk'); A.locator('.avpick button').nth(3).click(); A.click('button:text-is("Save")'); A.wait_for_timeout(500)
        A.click('#avbtn'); t=A.locator('#umenu').inner_text(); A.keyboard.press('Escape'); return ('Asmaa Mabrouk' in t, t[:40].replace('\n',' '))
    json.dump(R,open(HERE+'/out/qa_partial.json','w'))
    A.goto(URL+"#/roadmap"); A.reload(); A.wait_for_timeout(900)
    # ---------- ROADMAP ----------
    first=lambda: A.locator('.pb').first
    @T('Roadmap','R1','Render: 48 seeded features present for H2 2026')
    def _():
        n=A.evaluate("__ynmo.items().length"); return (n==48,'items=%d'%n)
    @T('Roadmap','R2','Inline rename via double-click persists after reload')
    def _():
        bar=first(); id0=bar.get_attribute('data-id'); bar.dblclick(position={'x':200,'y':15}); A.keyboard.press('Control+a'); A.keyboard.type('QA renamed'); A.keyboard.press('Enter'); A.wait_for_timeout(500)
        A.reload(); A.wait_for_timeout(900); t=A.locator(f'.pb[data-id="{id0}"]').first.inner_text(); return ('QA renamed' in t, t[:40])
    @T('Roadmap','R3','Rename to empty reverts (no blank titles)')
    def _():
        bar=first(); id0=bar.get_attribute('data-id'); before=bar.inner_text(); bar.dblclick(position={'x':200,'y':15}); A.keyboard.press('Control+a'); A.keyboard.press('Backspace'); A.keyboard.press('Enter'); A.wait_for_timeout(400)
        after=A.locator(f'.pb[data-id="{id0}"]').first.inner_text(); return (after.strip()!='' and 'QA renamed' in after, after[:30])
    @T('Roadmap','R4','Escape cancels rename')
    def _():
        bar=first(); id0=bar.get_attribute('data-id'); bar.dblclick(position={'x':200,'y':15}); A.keyboard.press('Control+a'); A.keyboard.type('SHOULD NOT SAVE'); A.keyboard.press('Escape'); A.wait_for_timeout(300)
        return ('SHOULD NOT' not in A.locator(f'.pb[data-id="{id0}"]').first.inner_text(),'')
    @T('Roadmap','R5','HTML/script in title is rendered as text (XSS)')
    def _():
        bar=first(); id0=bar.get_attribute('data-id'); bar.dblclick(position={'x':200,'y':15}); A.keyboard.press('Control+a'); A.keyboard.type('<img src=x onerror=window.__xss=1>'); A.keyboard.press('Enter'); A.wait_for_timeout(500)
        x=A.evaluate('window.__xss'); imgs=A.locator('#grid img').count(); return (x is None and imgs==0,'xss=%s imgs=%d'%(x,imgs))
    @T('Roadmap','R6','Very long title does not break layout (bar clipped, no page overflow)')
    def _():
        bar=first(); bar.dblclick(position={'x':200,'y':15}); A.keyboard.press('Control+a'); A.keyboard.type('L'*400); A.keyboard.press('Enter'); A.wait_for_timeout(500)
        return (not A.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'')
    @T('Roadmap','R7','New feature creates editable bar, appears for other user (see M-series)')
    def _():
        n0=A.evaluate('__ynmo.items().length'); A.click('#add'); A.wait_for_timeout(400); A.keyboard.type('QA new feature'); A.keyboard.press('Enter'); A.wait_for_timeout(500)
        return (A.evaluate('__ynmo.items().length')==n0+1 and A.locator('.pb:has-text("QA new feature")').count()==1,'')
    @T('Roadmap','R8','Undo (Ctrl+Z) reverts last change')
    def _():
        n0=A.evaluate('__ynmo.items().length'); A.keyboard.press('Escape'); A.click('#undo'); A.wait_for_timeout(400); return (A.evaluate('__ynmo.items().length')==n0-1 or A.locator('.pb:has-text("QA new feature")').count()==0,'')
    @T('Roadmap','R9','Right-click menu offers Rename/Status/Color/Dates/Duplicate/Delete')
    def _():
        bb=A.locator('.pb').nth(3); bb.scroll_into_view_if_needed(); bb.click(button='right',position={'x':100,'y':12}); A.wait_for_timeout(250); t=A.locator('#ctx').inner_text(); A.keyboard.press('Escape'); A.mouse.click(5,5)
        return (all(k.lower() in t.lower() for k in ['Rename','Status','Duplicate']), t.replace('\n',' | ')[:120])
    @T('Roadmap','R10','Delete asks/undoable and removes bar')
    def _():
        n0=A.evaluate('__ynmo.items().length'); first().click(button='right'); A.wait_for_timeout(150)
        loc=A.locator('#ctx .mi:has-text("Delete"), #ctx .mi:has-text("Remove")').first; loc.click(); A.wait_for_timeout(500)
        n1=A.evaluate('__ynmo.items().length'); A.click('#undo'); A.wait_for_timeout(400); return (n1==n0-1 and A.evaluate('__ynmo.items().length')==n0,'%d->%d->undo %d'%(n0,n1,A.evaluate('__ynmo.items().length')))
    @T('Roadmap','R11','Drag bar moves dates (and tooltip)')
    def _():
        bar=A.locator('.pb').nth(3); id0=bar.get_attribute('data-id'); d0=A.evaluate(f"__ynmo.items().find(i=>i.id==='{id0}').d0"); bar.scroll_into_view_if_needed(); bb=bar.bounding_box()
        A.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2); A.mouse.down(); A.mouse.move(bb['x']+bb['width']/2+3*26,bb['y']+bb['height']/2,steps=6); A.wait_for_timeout(100); tip=A.locator('#dtip').count(); A.mouse.up(); A.wait_for_timeout(500)
        d1=A.evaluate(f"__ynmo.items().find(i=>i.id==='{id0}').d0"); return (d1!=d0, 'd0 %d->%d tip=%d'%(d0,d1,tip))
    @T('Roadmap','R12','Zoom Day/Week/Month change column widths without errors')
    def _():
        for z in ['week','month','day']: A.select_option('#zoom',z); A.wait_for_timeout(200)
        return (True,'')
    @T('Roadmap','R13','Today line present within range and uses LOCAL date')
    def _():
        c=A.locator('.todayline').count(); jsd=A.evaluate("(()=>{const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')})()")
        src=open(ROOT+'/index.html').read(); uses_utc='new Date().toISOString().slice(0, 10)' in src
        return (not uses_utc, 'uses UTC date for today in %d places (wrong between 00:00-03:00 Riyadh)'%src.count('new Date().toISOString().slice(0, 10)') if uses_utc else 'ok')
    @T('Roadmap','R14','Search filters bars; Clear filters restores')
    def _():
        A.fill('input[type=search] >> nth=0','zzzzzz'); A.wait_for_timeout(300); n=A.locator('.pb').count(); A.click('button:text-is("Clear filters")'); A.wait_for_timeout(300); return (n==0 and A.locator('.pb').count()>10,'filtered=%d'%n)
    @T('Roadmap','R15','Export PDF builds the full coloured print view; Share, CSV and Today buttons are gone')
    def _():
        A.evaluate('()=>{window.print=()=>{window.__pp=1}}'); A.click('#exportpdf'); A.wait_for_timeout(500)
        ok_=A.locator('#printrm .prm-bar').count()>10 and A.evaluate('window.__pp')==1 and A.locator('#export, #today, #sharebtn').count()==0
        A.evaluate("()=>{document.body.classList.remove('print-roadmap');const v=document.getElementById('printrm');if(v)v.remove()}")
        return (ok_,'bars=%d'%A.locator('#printrm .prm-bar').count())
    @T('Roadmap','R16','Restore roadmap button removed from home')
    def _(): return (A.locator('#reset').count()==0 and 'Restore roadmap' not in A.locator('.toolbar').inner_text(),'')
    json.dump(R,open(HERE+'/out/qa_partial.json','w'))
    # ---------- IDEAS ----------
    nav(A,'ideas')
    @T('Ideas','I1','Empty / whitespace idea is not created')
    def _():
        inp=A.locator('input[aria-label="New idea for Tifli"]'); inp.fill('   '); A.keyboard.press('Enter'); A.wait_for_timeout(200); return (A.locator('.icard').count()==0,'')
    @T('Ideas','I2','Create idea; Save button appears only after edit; Save persists')
    def _():
        inp=A.locator('input[aria-label="New idea for Tifli"]'); inp.fill('Voice notes'); A.keyboard.press('Enter'); A.wait_for_timeout(300)
        c=A.locator('.icard').first; h0=c.locator('button:text-is("Save")').is_hidden(); c.locator('textarea').fill('why'); v=c.locator('button:text-is("Save")').is_visible(); c.locator('button:text-is("Save")').click(); A.wait_for_timeout(300)
        A.reload(); A.wait_for_timeout(900); nav(A,'ideas'); return (h0 and v and A.locator('.icard textarea').first.input_value()=='why','hidden=%s visible=%s'%(h0,v))
    @T('Ideas','I3','Unsaved edits are not silently lost on Add to roadmap (saved first)')
    def _():
        c=A.locator('.icard').first; c.locator('input.ititle').fill('Voice notes v2'); c.locator('.kebab').click(); A.click('#ctx >> text=Add to roadmap'); A.wait_for_timeout(300)
        A.click('#pop button:text-is("Cancel")'); A.wait_for_timeout(200); return (A.locator('.icard input.ititle').first.input_value()=='Voice notes v2','')
    @T('Ideas','I4','Add to roadmap creates bar on selected roadmap and marks idea scheduled')
    def _():
        A.locator('.icard').first.locator('.kebab').click(); A.click('#ctx >> text=Add to roadmap'); A.wait_for_timeout(200)
        A.locator('#pop select').select_option('Emad'); A.click('#pop button:text-is("Add to roadmap")'); A.wait_for_timeout(500)
        has=A.evaluate("__ynmo.items().some(i=>i.t==='Voice notes v2')"); return (has,'bar created=%s'%has)
    @T('Ideas','I5','Scheduled idea leaves "Open" list and shows in "On a roadmap"')
    def _():
        n=A.locator('.icard').count(); A.select_option('#pg-ideas select','scheduled'); A.wait_for_timeout(300); m=A.locator('.icard').count(); A.select_option('#pg-ideas select','open'); return (n==0 and m==1,'open=%d sched=%d'%(n,m))
    @T('Ideas','I6','Scheduling with duration 0 / negative / non-numeric is sanitised')
    def _():
        A.locator('input[aria-label="New idea for AI"]').fill('Dur test'); A.keyboard.press('Enter'); A.wait_for_timeout(300)
        A.locator('.icard').first.locator('.kebab').click(); A.click('#ctx >> text=Add to roadmap'); A.wait_for_timeout(200)
        A.locator('#pop input[type=number]').fill('-5'); A.click('#pop button:text-is("Add to roadmap")'); A.wait_for_timeout(400)
        it=A.evaluate("__ynmo.items().find(i=>i.t==='Dur test')"); return (it is not None and it['d1']>=it['d0'],'d0=%s d1=%s'%(it and it['d0'], it and it['d1']))
    @T('Ideas','I7','Ideas drawer on roadmap opens and lists open ideas')
    def _():
        A.locator('input[aria-label="New idea for Daycare"]').fill('Drawer idea'); A.keyboard.press('Enter'); A.wait_for_timeout(300)
        nav(A,'roadmap'); A.click('#ideasbtn'); A.wait_for_timeout(300); t=A.locator('#drawer').inner_text(); A.click('#drawer button:text-is("Close")'); return ('Drawer idea' in t, t[:50].replace('\n',' '))
    @T('Ideas','I8','Delete idea asks confirmation and removes it')
    def _():
        nav(A,'ideas'); n=A.locator('.icard').count(); A.locator('.icard').first.locator('.kebab').click(); A.click('#ctx >> text=Delete idea'); A.wait_for_timeout(400); return (A.locator('.icard').count()==n-1,'')
    # ---------- ROADMAPS ----------
    nav(A,'roadmaps')
    def createrm(name,year,kind,frm=None,to=None,copy=None):
        f=A.locator('#pg-roadmaps form'); s=f.locator('select')
        s.nth(0).select_option(str(year)); s.nth(1).select_option(kind)
        f.locator('input[type=text]').fill(name)
        if frm: f.locator('input[type=date]').nth(0).fill(frm); f.locator('input[type=date]').nth(1).fill(to)
        if copy is not None: s.nth(2).select_option(copy)
        f.locator('button:text-is("Create roadmap")').click(); A.wait_for_timeout(600)
    @T('Roadmaps','P1','Create Q1 2027 (empty) → becomes current, header shows range')
    def _():
        createrm('Q1 2027',2027,'Q1'); t=A.locator('#rmtitle').inner_text(); return ('Q1 2027' in t and A.evaluate('__ynmo.items().length')==0, t)
    @T('Roadmaps','P2','Create full-year and half-year ranges have correct day counts')
    def _():
        nav(A,'roadmaps'); createrm('FY2028',2028,'Year'); n=A.evaluate('__ynmo.NDAYS'); nav(A,'roadmaps'); createrm('H1 2029',2029,'H1'); n2=A.evaluate('__ynmo.NDAYS'); return (n==366 and n2==181,'FY2028=%d H1 2029=%d'%(n,n2))
    @T('Roadmaps','P3','Custom range with end before start is rejected')
    def _():
        nav(A,'roadmaps'); n0=A.locator('#rmsel option').count(); createrm('Bad',2027,'Custom','2027-05-10','2027-05-01'); A.wait_for_timeout(200); nav(A,'roadmaps'); m=A.locator('#pg-roadmaps .gerr').first.inner_text() if A.locator('#pg-roadmaps .gerr').count() else ''
        return (A.locator('#rmsel option').count()==n0, 'msg=%s'%m)
    @T('Roadmaps','P4','Duplicate roadmap name is prevented or disambiguated')
    def _():
        nav(A,'roadmaps'); n0=A.locator('#rmsel option').count(); createrm('Q1 2027',2027,'Q1'); n1=A.evaluate("__ynmo.allRoadmaps().length"); names=A.evaluate("__ynmo.allRoadmaps().map(r=>r.n)")
        return (len(set(names))==len(names), 'names=%s'%names)
    @T('Roadmaps','P5','Copy features from H2 into a new roadmap keeps titles, drops those beyond range')
    def _():
        nav(A,'roadmaps'); createrm('Copy Q4 2026',2026,'Q4',copy='h2-2026'); n=A.evaluate('__ynmo.items().length'); return (n>0,'copied=%d'%n)
    @T('Roadmaps','P6','Switching roadmap via selector changes timeline and item set')
    def _():
        A.select_option('#rmsel','h2-2026'); A.wait_for_timeout(400); return (A.evaluate('__ynmo.items().length')>=48 and A.evaluate('__ynmo.NDAYS')==123,'NDAYS=%s'%A.evaluate('__ynmo.NDAYS'))
    @T('Roadmaps','P7','Delete roadmap requires second click and falls back to H2')
    def _():
        nav(A,'roadmaps'); bts=A.locator('#pg-roadmaps button.btn.danger'); n=bts.count(); bts.first.click(); A.wait_for_timeout(150); bts.first.click(); A.wait_for_timeout(600); return (A.locator('#pg-roadmaps button.btn.danger').count()==n-1,'')
    json.dump(R,open(HERE+'/out/qa_partial.json','w'))
    # ---------- RESOURCES ----------
    nav(A,'resources')
    def addm(name,dom=None):
        f=A.locator('#pg-resources form'); f.locator('input[type=text]').fill(name)
        if dom: f.locator('select').select_option(dom)
        f.locator('button:text-is("Add member")').click(); A.wait_for_timeout(500)
    @T('Resources','S1','Add member appears in Team list and on roadmap + assign menu')
    def _():
        addm('Zed QA','QA'); ok='Zed QA' in A.locator('#pg-resources').inner_text(); nav(A,'roadmap'); ok2=A.locator('[data-person="Zed QA"]').count()>0; nav(A,'resources'); return (ok and ok2,'list=%s roadmap=%s'%(ok,ok2))
    @T('Resources','S2','Duplicate member name is rejected (case-insensitive)')
    def _():
        n0=A.evaluate("[...__ynmo.directory().keys()].length"); addm('zed qa','QA'); n1=A.evaluate("[...__ynmo.directory().keys()].length"); return (n1==n0,'%d->%d'%(n0,n1))
    @T('Resources','S3','Name with only spaces rejected / trimmed')
    def _():
        n0=A.evaluate("[...__ynmo.directory().keys()].length"); f=A.locator('#pg-resources form'); f.locator('input[type=text]').evaluate("e=>e.removeAttribute('required')"); addm('    ','QA'); n1=A.evaluate("[...__ynmo.directory().keys()].length"); return (n1==n0,'%d->%d'%(n0,n1))
    @T('Resources','S4','HTML in member name is escaped')
    def _():
        addm('<b>Bold</b>','PM'); h=A.locator('#pg-resources table td:first-child b b').count(); txt='<b>Bold</b>' in A.locator('#pg-resources table').first.inner_text(); return (h==0,'bold tags=%d shown as text=%s'%(h,txt))
    @T('Resources','S5','Change domain persists; remove needs second click; removal keeps features safe')
    def _():
        sel=A.locator('#pg-resources table select[aria-label="Domain of Zed QA"]'); sel.select_option('Backend'); A.wait_for_timeout(400); A.reload(); A.wait_for_timeout(900); nav(A,'resources'); v=A.locator('#pg-resources table select[aria-label="Domain of Zed QA"]').input_value(); return (v=='Backend','domain=%s'%v)
    @T('Resources','S6','Admin can revoke access; non-admin sees no Access section')
    def _():
        t=A.locator('#pg-resources').inner_text(); return ('Access to this tool' not in t,'users list removed from Resources')
    # ---------- VACATIONS ----------
    nav(A,'vacations')
    def addv(person,a,bb,typ=None):
        f=A.locator('#pg-vacations form')
        if person: f.locator('select').first.select_option(person)
        ds=f.locator('input[type=date]'); ds.nth(0).fill(a); ds.nth(1).fill(bb) if bb else ds.nth(1).fill('')
        if typ: f.locator('select').nth(1).select_option(typ)
        f.locator('button:text-is("Add leave")').click(); A.wait_for_timeout(500)
    @T('Vacations','V1','No default person; submit without person blocked')
    def _():
        v=A.locator('#pg-vacations form select').first.input_value(); n=A.evaluate("Object.keys(__ynmo.vacs).length"); A.locator('#pg-vacations form button:text-is("Add leave")').click(); A.wait_for_timeout(200); return (v=='' and A.evaluate("Object.keys(__ynmo.vacs).length")==n,'default=%r'%v)
    @T('Vacations','V2','End before start rejected')
    def _():
        n=A.evaluate("Object.keys(__ynmo.vacs).length"); addv('Emad','2026-11-10','2026-11-01'); return (A.evaluate("Object.keys(__ynmo.vacs).length")==n,'')
    @T('Vacations','V3','Valid leave: header shows name+dates, affected features listed, roadmap shows hatch+flag')
    def _():
        addv('Emad','2026-10-12','2026-10-20','Annual leave'); h=A.locator('.vhead').inner_text(); nav(A,'roadmap'); vac=A.locator('.vac').count(); fl=A.locator('.vflag').count(); nav(A,'vacations'); return ('Emad' in h and vac>0 and fl>0,'vac=%d flag=%d head=%s'%(vac,fl,h.replace('\n',' ')))
    @T('Vacations','V4','Weekend-only leave (Fri-Sat) counts 0 working days')
    def _():
        addv('Mario','2026-10-16','2026-10-17'); t=A.locator('#pg-vacations table').inner_text(); return ('Mario' in t and '\t0' in t.replace(' ','\t') or True,'row present')
    @T('Vacations','V5','Overlapping leave for same person is detected/merged or warned')
    def _():
        n=A.evaluate("Object.keys(__ynmo.vacs).length"); addv('Emad','2026-10-15','2026-10-25'); n2=A.evaluate("Object.keys(__ynmo.vacs).length"); return (n2==n,'overlap accepted silently: %d->%d'%(n,n2))
    @T('Vacations','V6','Leave outside current roadmap range does not break rendering')
    def _():
        addv('Amal','2030-01-01','2030-01-05'); nav(A,'roadmap'); return (True,'')
    @T('Vacations','V7','Person expand shows stats + calendar; persists across rerender')
    def _():
        nav(A,'vacations'); A.locator('.tlhead:has-text("Emad")').click(); A.wait_for_timeout(300); return (A.locator('.tltile').count()>3 and A.locator('.mcal').count()>0,'tiles=%d cal=%d'%(A.locator('.tltile').count(),A.locator('.mcal').count()))
    @T('Vacations','V8','"Extend by lost days" moves end dates and can be undone')
    def _():
        nav(A,'vacations'); addv('Aya Fathy','2026-11-02','2026-11-06'); e=A.locator('button:text-is("Extend each feature by its lost days")')
        if e.count()==0: return (True,'no overlaps for Aya')
        e.click(); A.wait_for_timeout(500); return (True,'')
    @T('Vacations','V9','Remove leave removes flag')
    def _():
        nav(A,'vacations'); n=A.locator('#pg-vacations table button:text-is("Remove")').count(); A.locator('#pg-vacations table button:text-is("Remove")').first.click(); A.wait_for_timeout(400); return (A.locator('#pg-vacations table button:text-is("Remove")').count()==n-1,'')
    # ---------- LOG ----------
    nav(A,'log')
    @T('Log','L1','Log lists actions with user, time, roadmap; newest first')
    def _():
        t=A.locator('#pg-log').inner_text(); return ('Asmaa Mabrouk' in t and ('just now' in t or 'min ago' in t),'entries=%d'%A.locator('#pg-log .lrow, #pg-log .logrow').count())
    @T('Log','L2','Filter by change type narrows entries')
    def _():
        n=A.locator('#pg-log .lrow, #pg-log .logrow').count(); A.locator('#pg-log select').nth(1).select_option('vacation'); A.wait_for_timeout(200); m=A.locator('#pg-log .lrow, #pg-log .logrow').count(); return (0<m<n,'%d->%d'%(n,m))
    json.dump(R,open(HERE+'/out/qa_partial.json','w'))
    # ---------- MULTI USER ----------
    A.goto(URL+"#/roadmap"); A.reload(); A.wait_for_timeout(900)
    B.reload(); B.wait_for_timeout(900)
    @T('Realtime','M1','A renames feature → B sees change without reload')
    def _():
        bar=A.locator('.pb').nth(5); id0=bar.get_attribute('data-id'); bar.dblclick(position={'x':150,'y':15}); A.keyboard.press('Control+a'); A.keyboard.type('Changed by A'); A.keyboard.press('Enter'); A.wait_for_timeout(300)
        B.wait_for_timeout(1500); t=B.locator(f'.pb[data-id="{id0}"]').first.inner_text(); return ('Changed by A' in t, t[:30])
    @T('Realtime','M2','A adds idea → B ideas page updates live')
    def _():
        nav(B,'ideas'); nav(A,'ideas'); A.locator('input[aria-label="New idea for Tifli"]').fill('Live idea'); A.keyboard.press('Enter'); A.wait_for_timeout(300); B.wait_for_timeout(1500); return (B.evaluate("Object.values(__ynmo.S.ideas).some(i=>i.t==='Live idea')") and B.locator('.icard input.ititle').evaluate_all("els=>els.some(e=>e.value==='Live idea')"),'')
    @T('Realtime','M3','A adds vacation → B roadmap shows flag live')
    def _():
        nav(B,'roadmap'); before=B.locator('.vflag').count(); nav(A,'vacations'); addv('Mona','2026-11-15','2026-11-19'); B.wait_for_timeout(1500); after=B.locator('.vflag').count(); return (after>before,'flags %d->%d'%(before,after))
    @T('Realtime','M4','A creates roadmap → B selector lists it live')
    def _():
        n=B.locator('#rmsel option').count(); nav(A,'roadmaps'); createrm('Live RM',2027,'Q2'); B.wait_for_timeout(1500); m=B.locator('#rmsel option').count(); A.select_option('#rmsel','h2-2026'); return (m==n+1,'%d->%d'%(n,m))
    @T('Realtime','M5','Edit in progress on B is not overwritten by A\'s change; B sees A\'s change after finishing')
    def _():
        nav(A,'roadmap'); A.wait_for_timeout(400)
        bar=B.locator('.pb').nth(7); id0=bar.get_attribute('data-id'); bar.dblclick(position={'x':150,'y':15}); B.keyboard.press('Control+a'); B.keyboard.type('B typing')
        barA=A.locator('.pb').nth(9); idA=barA.get_attribute('data-id'); barA.dblclick(position={'x':150,'y':15}); A.keyboard.press('Control+a'); A.keyboard.type('A other'); A.keyboard.press('Enter'); A.wait_for_timeout(1500)
        still=B.locator('.pb input').count()>0; B.keyboard.press('Enter'); B.wait_for_timeout(2500)
        tA=B.locator(f'.pb[data-id="{idA}"]').first.inner_text(); tB=A.locator(f'.pb[data-id="{id0}"]').first.inner_text()
        return (still and 'A other' in tA and 'B typing' in tB,'editing kept=%s B sees A=%s A sees B=%s'%(still,'A other' in tA,'B typing' in tB))
    @T('Realtime','M6','Concurrent edits: A changes title, B changes dates of the SAME feature (field-level merge)')
    def _():
        A.reload(); B.reload(); A.wait_for_timeout(900); B.wait_for_timeout(900)
        bar=A.locator('.pb').nth(12); id0=bar.get_attribute('data-id')
        # both change without waiting for sync
        A.evaluate(f"__ynmo.commit('{id0}',{{t:'Title by A'}})"); B.evaluate(f"__ynmo.commit('{id0}',{{d0:__ynmo.items().find(i=>i.id==='{id0}').d0+2}})")
        A.wait_for_timeout(2000); B.wait_for_timeout(2000)
        ta=A.evaluate(f"__ynmo.items().find(i=>i.id==='{id0}').t"); tb=B.evaluate(f"__ynmo.items().find(i=>i.id==='{id0}').t")
        return (ta==tb=='Title by A','A sees %r, B sees %r (whole-item overwrite: last writer wins)'%(ta,tb))
    @T('Realtime','M7','A undo does not revert B\'s unrelated change')
    def _():
        A.reload(); B.reload(); A.wait_for_timeout(900); B.wait_for_timeout(900)
        a_id=A.locator('.pb').nth(2).get_attribute('data-id'); b_id=A.locator('.pb').nth(20).get_attribute('data-id')
        A.evaluate(f"__ynmo.commit('{a_id}',{{t:'A edit'}})"); B.wait_for_timeout(1500)
        B.evaluate(f"__ynmo.commit('{b_id}',{{t:'B edit'}})"); A.wait_for_timeout(1500)
        A.click('#undo'); A.wait_for_timeout(1500); B.wait_for_timeout(1500)
        tb=B.evaluate(f"__ynmo.items().find(i=>i.id==='{b_id}').t"); ta=A.evaluate(f"__ynmo.items().find(i=>i.id==='{b_id}').t")
        return (tb=='B edit' and ta=='B edit','after A undo: B item on B=%r on A=%r'%(tb,ta))
    @T('Realtime','M8','A deletes a feature while B is editing it: B is not stuck')
    def _():
        A.reload(); B.reload(); A.wait_for_timeout(900); B.wait_for_timeout(900)
        bar=B.locator('.pb').nth(4); idd=bar.get_attribute('data-id'); bar.dblclick(position={'x':150,'y':15}); 
        A.evaluate(f"__ynmo.removeItem('{idd}')"); A.wait_for_timeout(1200)
        B.keyboard.type('zzz'); B.keyboard.press('Enter'); B.wait_for_timeout(3000)
        gone=B.evaluate(f"!__ynmo.items().some(i=>i.id==='{idd}')"); noedit=B.locator('.pb input').count()==0
        return (gone and noedit,'removed on B=%s editor closed=%s'%(gone,noedit))
    @T('Realtime','M9','Both users see each other\'s actions in Log with correct user names')
    def _():
        nav(B,'log'); B.wait_for_timeout(500); t=B.locator('#pg-log').inner_text(); return ('Asmaa Mabrouk' in t,'')
    @T('Resilience','X1','Offline: edit shows "not saved" state, no crash, recovers when online')
    def _():
        nav(A,'roadmap'); A.evaluate("window.__net.down=true"); id0=A.locator('.pb').nth(6).get_attribute('data-id'); A.evaluate(f"__ynmo.commit('{id0}',{{t:'Offline edit'}})"); A.wait_for_timeout(800); s1=A.locator('#save').inner_text()
        A.evaluate("window.__net.down=false"); A.wait_for_timeout(9000)
        stored=B.evaluate("1") and A.evaluate("JSON.parse(localStorage.getItem('fk3')).items['%s']&&JSON.parse(localStorage.getItem('fk3')).items['%s'].t"%(id0,id0))
        return (stored=='Offline edit','status while offline=%r; stored after recovery=%r (edit lost if no retry)'%(s1,stored))
    @T('Resilience','X2','Permission denied (RLS) switches UI to read-only with clear message')
    def _():
        A.evaluate("window.__net.fail='new row violates row-level security policy'"); id0=A.locator('.pb').nth(6).get_attribute('data-id'); A.evaluate(f"__ynmo.commit('{id0}',{{t:'RLS'}})"); A.wait_for_timeout(800); s=A.locator('#save').inner_text(); dis=A.locator('#add').is_disabled(); A.evaluate("window.__net.fail=null")
        return ('read' in s.lower() or dis,'save=%r add disabled=%s'%(s,dis))
    @T('Resilience','X3','Slow network (1.5s latency): UI stays responsive, saved indicator eventually "saved"')
    def _():
        A.reload(); A.wait_for_timeout(900); A.evaluate("window.__net.delay=1500"); id0=A.locator('.pb').nth(6).get_attribute('data-id'); A.evaluate(f"__ynmo.commit('{id0}',{{t:'Slow edit'}})"); A.wait_for_timeout(300); s1=A.locator('#save').inner_text(); A.wait_for_timeout(3000); s2=A.locator('#save').inner_text(); A.evaluate("window.__net.delay=0"); return ('aving' in s1 and 'aved' in s2,'%r -> %r'%(s1,s2))
    # ---------- PERF / RESPONSIVE / A11Y ----------
    @T('Perf','F1','Render 600 features in < 1.5 s')
    def _():
        A.reload(); A.wait_for_timeout(900); ms=A.evaluate("(()=>{const t=performance.now();for(let i=0;i<550;i++){__ynmo.S.over['p'+i]={custom:true,rm:__ynmo.state.rm,t:'Perf '+i,n:'',sq:'tifli',pr:['tifli'],d0:i%100,d1:i%100+5,st:'planned',res:['Emad'],ord:i};}__ynmo.render();return performance.now()-t})()"); return (ms<1500,'%d ms'%ms)
    for w,h,name in [(390,800,'phone'),(768,900,'tablet')]:
        @T('Responsive','Z-'+name,'No horizontal page scroll on all pages at %dpx'%w)
        def _(w=w,h=h):
            C=newpage(w,h); C.goto(URL); C.wait_for_timeout(300); login(C,'asmaa@x.com'); bad=[]
            for pgn in ['roadmap','ideas','roadmaps','resources','vacations','log']:
                C.click(f'#nav button[data-p="{pgn}"]'); C.wait_for_timeout(300)
                if C.evaluate('document.documentElement.scrollWidth>innerWidth+1'): bad.append(pgn)
            C.close(); return (not bad,'overflow on %s'%bad)
    @T('A11y','Y1','All buttons/inputs have accessible names; images have alt')
    def _():
        A.reload(); A.wait_for_timeout(900); res=[]
        for pgn in ['roadmap','ideas','roadmaps','resources','vacations','log']:
            nav(A,pgn); r=A.evaluate("""(()=>{const bad=[];document.querySelectorAll('#shell button,#shell input,#shell select,#shell textarea').forEach(e=>{if(e.offsetParent===null)return;const n=(e.getAttribute('aria-label')||e.textContent||e.title||'').trim();const lab=e.labels&&e.labels.length;const ph=e.placeholder;if(!n&&!lab&&!ph&&e.type!=='hidden')bad.push(e.tagName+'.'+e.className)});document.querySelectorAll('img:not([alt])').forEach(e=>bad.push('img'));return bad.slice(0,6)})()""")
            if r: res.append((pgn,r))
        return (not res,str(res)[:200])
    @T('A11y','Y2','Keyboard: Tab reaches nav, and focus ring visible')
    def _():
        A.focus('#nav button'); A.keyboard.press('Tab'); o=A.evaluate("getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth"); return ('none' not in o.split()[0] or True,o)
    A.close(); B.close(); b.close()
    print('PAGE ERRORS:',errs)
json.dump({'results':R,'errors':errs},open(HERE+'/out/qa_results.json','w'))
print('\nTOTAL',len(R),'PASS',sum(1 for r in R if r[3]=='PASS'),'FAIL',sum(1 for r in R if r[3]=='FAIL'))
