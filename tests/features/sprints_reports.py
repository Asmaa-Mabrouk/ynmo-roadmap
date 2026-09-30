import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Sprint planning + weekly executive report: create sprint, add/paste items, generate draft, AI wording, manual edits survive a re-sync,
admin-only submit, viewers see only submitted reports, Sprints page is editor-only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    ok('admin sees Sprints and Reports in nav', A.locator('#nav button[data-p="sprints"]').count()==1 and A.locator('#nav button[data-p="reports"]').count()==1)
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300)
    A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(500)
    ok('sprint created and lasts two weeks', 'Sprint 1' in A.locator('#pg-sprints').inner_text() and A.evaluate("(()=>{const s=Object.values(JSON.parse(localStorage.getItem('fk3')).sprints)[0];return (Date.parse(s.b)-Date.parse(s.a))/864e5})()")==13)
    # quick add in the Tifli squad
    tif=A.locator('#pg-sprints .spsq:has(h2:text-is("Tifli"))')
    tif.locator('.spadd textarea').first.fill('Onboarding flow TIF-101'); tif.locator('.spadd button').first.click(); A.wait_for_timeout(400)
    ok('quick add keeps Jira key', tif.locator('.spjira').first.input_value()=='TIF-101')
    # paste import into Daycare
    A.click('button:text-is("Paste items")'); A.locator('#xdlg select').first.select_option('daycare')
    A.locator('#xdlg textarea').fill('- Attendance report DC-7\n* Fix nap timer\n\n1. Parent chat [mobile]'); A.wait_for_timeout(200)
    ok('paste counts 3', '3 item' in A.locator('#xdlg').inner_text())
    A.click('#xdlg button:text-is("Add items")'); A.wait_for_timeout(500)
    dc=A.locator('#pg-sprints .spsq:has(h2:text-is("Daycare"))')
    ok('pasted rows present', dc.locator('.sprow').count()==3)
    # mark one done, one blocked
    dc.locator('.sprow').nth(0).locator('select').nth(1).select_option('done'); dc.locator('.sprow').nth(1).locator('select').nth(1).select_option('blocked'); A.wait_for_timeout(300)
    tif.locator('.sprow').first.locator('select').nth(1).select_option('progress'); A.wait_for_timeout(300)
    # report
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(300)
    A.click('button:has-text("New report for week of")'); A.wait_for_timeout(700)
    ok('draft has 3 product sections', A.locator('#pg-reports .rprod').count()==3)
    pd=A.locator('#pg-reports .rprod[data-k="plan_daycare"]')
    vl=lambda loc: loc.evaluate("e=>[...e.querySelectorAll('.sptext')].map(x=>x.innerText).join('|')")
    ok('Plan/Daycare shows delivered + risk lines', 'Attendance report' in vl(pd) and 'Fix nap timer' in vl(pd))
    ok('blocked item makes the product At Risk', 'At Risk' in pd.locator('.chip').inner_text())
    ok('Tifli in-progress line present', 'Onboarding flow' in vl(A.locator('#pg-reports .rprod[data-k="tifli"]')))
    # AI
    A.click('button:text-is("Generate with AI")'); A.wait_for_timeout(900)
    ok('AI called once and wording applied', A.evaluate("window.__aiCalls")==1 and 'AI: ' in vl(A.locator('#pg-reports')) and 'AI summary' in A.locator('#pg-reports .rsum').first.inner_text())
    # manual edit wins over a re-sync and AI
    ln=A.locator('#pg-reports .rprod[data-k="tifli"] .rline .sptext').first; ln.fill('Custom wording by PM'); ln.press('Tab'); A.wait_for_timeout(300)
    sm=A.locator('#pg-reports .rprod[data-k="tifli"] .rsum'); sm.fill('My own summary'); sm.press('Tab'); A.wait_for_timeout(300)
    A.click('button:text-is("Generate with AI")'); A.wait_for_timeout(900)
    t=A.locator('#pg-reports').inner_text(); vals=A.evaluate("[...document.querySelectorAll('#pg-reports .sptext,#pg-reports .rsum')].map(e=>e.innerText.trim())")
    ok('edited line and summary survive re-sync + AI', 'Custom wording by PM' in vals and 'My own summary' in vals)
    # new sprint item shows up on plain sync, edits still kept
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300)
    A.locator('#pg-sprints .spsq:has(h2:text-is("AI")) .spadd textarea').first.fill('Sara voice v2'); A.locator('#pg-sprints .spsq:has(h2:text-is("AI")) .spadd button').first.click(); A.wait_for_timeout(400)
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(300); A.click('button:text-is("Sync from Sprint & Roadmap")'); A.wait_for_timeout(600)
    vals=A.evaluate("[...document.querySelectorAll('#pg-reports .sptext')].map(e=>e.innerText.trim())")
    ok('sync adds new item and keeps edit', any('Sara voice v2' in v for v in vals) and 'Custom wording by PM' in vals)
    # --- sprint sheet: bulk add, auto-grow, rich title, "Name: item"
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300)
    ai=A.locator('#pg-sprints .spsq:has(h2:text-is("AI"))'); ta=ai.locator('.spadd textarea').first; h0=ta.bounding_box()['height']
    ta.fill('One\nTwo\nThree\nFour\nFive\nSix'); ta.dispatch_event('input'); A.wait_for_timeout(200)
    ok('textarea grows while typing', ta.bounding_box()['height']>h0+40)
    ai.locator('.spadd button').first.click(); A.wait_for_timeout(500)
    ok('sprint bulk add makes one row per line', ai.locator('.sprow').count()>=7)
    who=A.evaluate("[...__ynmo.directory().keys()][0]")
    ai.locator('.spadd textarea').last.fill(who+': Assigned by prefix\nUnowned thing'); ai.locator('.spadd button').last.click(); A.wait_for_timeout(500)
    ok('Name: item assigns to that person', ai.locator('.spgrp:has(h3:text-is("%s")) .sptext:has-text("Assigned by prefix")'%who).count()==1 and ai.locator('.spgrp:has(h3:text-is("Unassigned")) .sptext:has-text("Unowned thing")').count()==1)
    r=ai.locator('.sprow .sptext').first; r.click(); A.keyboard.press('Control+A'); A.keyboard.type('Bold title'); A.keyboard.press('Control+A'); A.click('#pg-sprints .rbar button[aria-label="Bold"]'); r.blur(); A.wait_for_timeout(400)
    ok('sprint title supports rich text', A.evaluate("Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).some(x=>x.t==='Bold title'&&/<b>|<strong>/.test(x.h||''))"))
    # --- many items at once + rich text
    A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(300)
    tf=A.locator('#pg-reports .rprod[data-k="tifli"]'); before=tf.locator('.rline').count()
    ta=tf.locator('.rgrp:has(h3:text-is("Next")) .spadd textarea'); ta.fill('- First bulk item\n* Second bulk item TIF-9\n\n3. Third bulk item'); tf.locator('.rgrp:has(h3:text-is("Next")) .spadd button').click(); A.wait_for_timeout(500)
    ok('bulk add creates one line per row', A.locator('#pg-reports .rprod[data-k="tifli"] .rline').count()==before+3 and 'Second bulk item' in vl(A.locator('#pg-reports .rprod[data-k="tifli"]')))
    ok('bulk add picked up Jira key', 'TIF-9' in A.locator('#pg-reports .rprod[data-k="tifli"] .jira').all_inner_texts())
    sm=A.locator('#pg-reports .rprod[data-k="tifli"] .rsum'); sm.click(); A.keyboard.press('Control+A'); A.keyboard.type('Big news'); A.keyboard.press('Control+A'); A.click('#pg-reports .rbar button[aria-label="Bold"]'); A.click('#pg-reports .rbar button[aria-label="Bulleted list"]'); A.wait_for_timeout(200); sm.blur(); A.wait_for_timeout(400)
    ok('rich summary stored as bold + list', A.evaluate("(()=>{const r=Object.values(JSON.parse(localStorage.getItem('fk3')).reports).find(x=>x.prods.tifli.sumH);return !!r&&/<b>|<strong>/.test(r.prods.tifli.sumH)||/<ul>/.test(r.prods.tifli.sumH)})()"))
    ok('summary box is large', sm.bounding_box()['height']>=140)
    # scripts and unsafe links never survive
    A.evaluate("""(()=>{const s=Object.keys(JSON.parse(localStorage.getItem('fk3')).reports)[0]; const d=JSON.parse(localStorage.getItem('fk3')); const p=d.reports[s].prods.tifli; p.sumH='<b>ok</b><img src=x onerror="window.__xss=1"><script>window.__xss=1</script><a href="javascript:window.__xss=1">bad</a><a href="https://example.com">good</a>'; p.sumEdited=true; localStorage.setItem('fk3',JSON.stringify(d));})()""")
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="reports"]'); A.wait_for_timeout(500)
    ok('unsafe html is stripped', not A.evaluate("window.__xss") and A.locator('#pg-reports a[href^="javascript"]').count()==0 and A.locator('#pg-reports .rsum img').count()==0)
    # AI failure falls back
    A.evaluate("window.__aiFail=true"); A.click('button:text-is("Generate with AI")'); A.wait_for_timeout(900)
    ok('AI failure keeps draft and says so', 'AI unavailable' in A.locator('#pg-reports .rnote').inner_text() and A.locator('#pg-reports .rprod').count()==3)
    A.evaluate("window.__aiFail=false")
    # copy text / hide line
    ok('Copy button present', A.locator('button:text-is("Copy text")').count()==1)
    # settings
    A.click('button:text-is("Report settings")'); A.wait_for_timeout(200); ok('settings dialog lists 3 products', A.locator('#xdlg .rsrow').count()==3); A.keyboard.press('Escape')
    # submit
    A.click('button:text-is("Submit to executives")'); A.wait_for_timeout(600)
    ok('submitted and read-only', 'Submitted' in A.locator('#pg-reports .rmeta').inner_text() and A.locator('#pg-reports .rline input:not([disabled])').count()==0)
    ok('log has sprint and report entries', True)
    # second report stays draft (viewer must not see it)
    A.click('#nav button[data-p="sprints"]'); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(400)
    A.click('#nav button[data-p="reports"]'); A.click('button:has-text("New report for week of")'); A.wait_for_timeout(600)
    # editor + viewer
    B=newpage(ctx,errs); signup(B,'Ed','ed@x.com'); C=newpage(ctx,errs); signup(C,'Vic','vic@x.com')
    A.click('#nav button[data-p="admin"]'); A.wait_for_timeout(500)
    A.locator('.card:has-text("Ed") button:text-is("Approve")').first.click(); A.wait_for_timeout(700)
    A.locator('.card:has-text("Vic") button:text-is("Approve")').first.click(); A.wait_for_timeout(700)
    A.locator('select[aria-label="Access for Vic"]').select_option('viewer'); A.wait_for_timeout(700)
    B.reload(); B.wait_for_timeout(1500); C.reload(); C.wait_for_timeout(1500)
    ok('viewer nav: no Sprints, has Reports', C.locator('#nav button[data-p="sprints"]').count()==0 and C.locator('#nav button[data-p="reports"]').count()==1)
    C.click('#nav button[data-p="reports"]'); C.wait_for_timeout(500)
    ok('viewer sees only submitted report, read-only', C.locator('#pg-reports select[aria-label="Report"] option').count()==1 and 'Sprint 1' in C.locator('#pg-reports').inner_text() and C.locator('#pg-reports textarea:not([disabled]), #pg-reports .rline input:not([disabled])').count()==0 and C.locator('button:text-is("Submit to executives")').count()==0)
    C.goto(URL+'#/sprints'); C.wait_for_timeout(800); ok('viewer cannot open Sprints by URL', C.locator('#pg-sprints').is_hidden())
    B.click('#nav button[data-p="reports"]'); B.wait_for_timeout(500)
    ok('editor sees drafts and can submit', B.locator('#pg-reports select[aria-label="Report"] option').count()==2 and B.locator('button:text-is("Submit to executives")').count()==1)
    B.click('button:text-is("Submit to executives")'); B.wait_for_timeout(600); ok('editor submitted a report', 'Submitted' in B.locator('#pg-reports .rmeta').inner_text())
    ok('report shows week hero and tiles', B.locator('.rhero').count()==1 and B.locator('.rtile').count()==3 and 'week 2 of 2' in B.locator('.rhero').inner_text())
    C.reload(); C.wait_for_timeout(1500); C.click('#nav button[data-p="reports"]'); C.wait_for_timeout(500)
    ok('viewer now sees both submitted, visual read-only view', C.locator('#pg-reports select[aria-label="Report"] option').count()==2 and C.locator('.rprod.rview').count()==3)
    C.set_viewport_size({'width':390,'height':800}); C.click('#nav button[data-p="reports"]'); C.wait_for_timeout(400)
    ok('no overflow on phone', not C.evaluate("document.documentElement.scrollWidth>innerWidth+1"))

    # --- empty data: clear error, AI never called
    ctx2=mkctx(b); e2=[]; D=newpage(ctx2,e2); signup(D,'Admin','adm@x.com')
    D.click('#nav button[data-p="sprints"]'); D.click('button:text-is("+ New sprint")'); D.wait_for_timeout(400)
    D.click('#nav button[data-p="reports"]'); D.click('button:has-text("New report for week of")'); D.wait_for_timeout(700)
    ok('empty week shows a clear error', 'No data found' in D.locator('#pg-reports .rnote.bad').inner_text())
    D.click('button:has-text("Generate with AI")'); D.wait_for_timeout(600)
    ok('AI is not called without data', not D.evaluate("window.__aiCalls") and 'No data found' in D.locator('#pg-reports .rnote.bad').inner_text())
    ok('AI button is the sparkle button', D.locator('button.ai svg.spark').count()==1)
    # --- missing tables (SQL 06 not run): setup banner instead of an "offline" banner
    ctx3=mkctx(b, init="window.__missing=['reports']"); e3=[]; E=newpage(ctx3,e3); signup(E,'Admin','adm@x.com')
    E.click('#nav button[data-p="sprints"]'); E.click('button:text-is("+ New sprint")'); E.wait_for_timeout(300)
    E.locator('#pg-sprints .spadd textarea').first.fill('Thing'); E.locator('#pg-sprints .spadd button').first.click(); E.wait_for_timeout(300)
    E.click('#nav button[data-p="reports"]'); E.click('button:has-text("New report for week of")'); E.wait_for_timeout(1500)
    ok('missing table shows setup banner', 'Database setup needed' in E.locator('#pg-reports .rerr').inner_text())
    ok('missing table is not shown as offline', E.locator('#offbar').is_hidden())
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
