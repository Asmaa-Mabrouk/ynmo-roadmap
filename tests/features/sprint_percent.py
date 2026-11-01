import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Sprint items have a completion percentage; Monthly offers "Review sprint updates" (cards that would change, tick, Apply). Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(800)
    nc=A.locator('.mdcol[data-mo="2026-11"]'); nc.locator('.mdopen').click(); ta=nc.locator('.mdadd textarea')
    for t in ['Parent invoice download page','Reports export card']:
        ta.fill(t); ta.press('Enter'); A.wait_for_timeout(450)
    A.keyboard.press('Escape'); A.wait_for_timeout(300)
    A.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('fk3'));const m=d.reports.mo202611;const k2=m.lines.find(l=>l.t==='Reports export card').id;
      d.sprints=d.sprints||{};d.sprints.sp9={n:229,a:'2026-11-01',b:'2026-11-14',note:'',tags:{}};d.sprint_items=d.sprint_items||{};
      const add=(id,o)=>{d.sprint_items[id]=Object.assign({sp:'sp9',tags:[],dn:''},o)};
      add('s1',{k:'h',sq:'tifli',t:'Tifli',ord:1024});add('s2',{k:'p',t:'Lea',ord:2048});
      add('s3',{k:'s',t:'Parent invoice download page',st:'progress',pc:60,ord:3072});
      add('s4',{k:'s',t:'Export work',st:'progress',pc:70,fid:k2,ord:4096});
      localStorage.setItem('fk3',JSON.stringify(d));}""")
    A.reload(); A.wait_for_timeout(1500)
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(500); A.goto(URL+'#/sprints/sp9'); A.wait_for_timeout(1200)
    ok('P1 each scope shows its percentage', A.locator('.blk[data-id="s3"] .pcp').inner_text()=='60%' and A.locator('.blk[data-id="s4"] .pcp').inner_text()=='70%')
    ok('P2 a line linked to a card shows the card and its percentage', '⛓' in A.locator('.blk[data-id="s4"] .cardchip').inner_text() and '0%' in A.locator('.blk[data-id="s4"] .cardchip').inner_text())
    A.locator('.blk[data-id="s3"] .pcp').click(); A.wait_for_timeout(250); A.locator('.cmenu .mi:text-is("80%")').click() if A.locator('.cmenu .mi:text-is("80%")').count() else A.get_by_text('80%', exact=True).last.click(); A.wait_for_timeout(500)
    ok('P3 changing the percentage saves it and starts the item', A.locator('.blk[data-id="s3"] .pcp').inner_text()=='80%')
    A.locator('.blk[data-id="s3"] .pcp').click(); A.wait_for_timeout(250); A.get_by_text('100%', exact=True).last.click(); A.wait_for_timeout(500)
    ok('P4 100% marks the item done', 'Done' in A.locator('.blk[data-id="s3"] .stp').inner_text())
    A.locator('.blk[data-id="s3"] .pcp').click(); A.wait_for_timeout(250); A.get_by_text('80%', exact=True).last.click(); A.wait_for_timeout(500)
    ok('P5 lowering it from done reopens the item', 'In progress' in A.locator('.blk[data-id="s3"] .stp').inner_text())
    A.locator('.blk[data-id="s4"] .cardchip').click(); A.wait_for_timeout(300)
    ok('P5b the card chip opens the link dialog with the current card, and a wrong id is refused', A.locator('#xdlg input[aria-label="Monthly card id"]').input_value()!='')
    A.fill('#xdlg input[aria-label="Monthly card id"]','XX#99'); A.click('#xdlg button:text-is("Link")'); A.wait_for_timeout(300)
    ok('P5c an unknown id shows a message', 'No Monthly card has the id' in A.locator('#xdlg').inner_text()); A.click('#xdlg button:text-is("Cancel")'); A.wait_for_timeout(300)
    A.click('#nav button[data-p="monthly"]'); A.wait_for_timeout(900)
    ok('P6 Monthly offers Review sprint updates (2)', A.locator('#mdsprint').count()==1 and A.locator('#mdsprint').inner_text()=='Review sprint updates (2)')
    A.click('#mdsprint'); A.wait_for_timeout(400)
    rows=A.locator('#xdlg .srrow')
    ok('P7 the dialog lists both cards with old and new percentage', rows.count()==2 and '0% → 70%' in A.locator('#xdlg').inner_text() and '0% → 80%' in A.locator('#xdlg').inner_text())
    ok('P8 the card linked by id is ticked, the one matched only by words is not', rows.filter(has_text='Reports export card').locator('input').is_checked() and not rows.filter(has_text='Parent invoice').locator('input').is_checked() and 'matched by words' in rows.filter(has_text='Parent invoice').inner_text())
    A.click('#xdlg button:has-text("Apply")'); A.wait_for_timeout(700)
    pc=lambda t: A.locator('.mdcol[data-mo="2026-11"] .mdcard:has-text("%s") select[aria-label="Percent complete"]'%t).input_value()
    ok('P9 Apply updates only the ticked card', pc('Reports export card')=='70' and pc('Parent invoice')=='0')
    ok('P10 one proposal is left', A.locator('#mdsprint').inner_text()=='Review sprint updates (1)')
    A.click('#mdsprint'); A.wait_for_timeout(300); A.locator('#xdlg .srrow input').check(); A.click('#xdlg button:has-text("Apply")'); A.wait_for_timeout(700)
    ok('P11 ticking the word match and applying updates it too', pc('Parent invoice')=='80' and A.locator('#mdsprint').count()==0)
    ok('P12 no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
