import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Sprint planning without typing: slips are forgiven, a line can be picked from the plan and linked to its card. Fake test database only."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); ctx.clock.set_fixed_time("2026-10-20T10:00:00"); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(600)
    sp=A.evaluate("()=>Object.keys(JSON.parse(localStorage.getItem('fk3')).sprints)[0]")
    A.evaluate("""sp=>{const j=JSON.parse(localStorage.getItem('fk3')); j.reports=j.reports||{};
      j.reports.mo202611={mo:'2026-11',status:'submitted',lines:[{id:'c1',k:'tifli',no:35,t:'Sanar Integration - Production Integration',pct:90,who:{be:{'Aya Fathy':2}}},{id:'c2',k:'daycare',no:2,t:'Reports export',pct:0,who:{be:{'Mona':3}}}]};
      const add=(id,o)=>{j.sprint_items[id]=Object.assign({sp:sp,tags:[],dn:'',st:'planned'},o)};
      add('h1',{k:'h',sq:'tifli',t:'',ord:1});add('p1',{k:'p',t:'Aya Fathy',ord:2});
      add('s1',{k:'s',t:'Sanar Integratoin - Production Integraton',ord:3});add('s2',{k:'s',t:'Sanar prod',ord:4});add('s3',{k:'s',t:'Wallet idea nobody planned',ord:5});
      localStorage.setItem('fk3',JSON.stringify(j))}""",sp)
    A.reload(); A.wait_for_timeout(1500); A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(500)
    A.evaluate("id=>{location.hash='#/sprints/'+id}",sp); A.wait_for_timeout(900)
    chips=lambda: A.evaluate("()=>[...document.querySelectorAll('.blk .covchip')].map(c=>[c.closest('.blk').querySelector('.bt').textContent.trim(),c.dataset.state])")
    c=chips()
    ok('K1 a title with typing slips is still found on the plan', not any(t.startswith('Sanar Integratoin') for t,s in c))
    ok('K2 a short, different name is marked', ['Sanar prod','missing'] in c and ['Wallet idea nobody planned','missing'] in c)
    A.locator('.blk[data-id="s2"] .covchip').click(); A.wait_for_timeout(400)
    d=A.locator('#xdlg'); t=d.inner_text()
    ok('K3 clicking the mark offers the closest cards from the plan', 'Sanar Integration - Production Integration' in t and 'TF#35' in t and '2 pt for Aya' in t)
    ok('K3b the row has the product colour and tag', 'Tifli' in t and A.evaluate("()=>getComputedStyle(document.querySelector('.ppickrow')).getPropertyValue('--c').trim()")!='' and A.evaluate("()=>getComputedStyle(document.querySelector('.ppickrow')).textAlign") in ('start','left'))
    A.screenshot(path='/home/claude/ynmo-roadmap/tests/out/pick.png')
    ok('K4 the search box starts with the typed text and can be changed', d.locator('input[type=search]').input_value()=='Sanar prod')
    d.locator('input[type=search]').fill('reports'); A.wait_for_timeout(250)
    ok('K5 searching shows other cards', 'Reports export' in d.inner_text() and 'Nobody assigned' not in d.inner_text() and 'Assigned to Mona' in d.inner_text())
    d.locator('input[type=search]').fill('sanar'); A.wait_for_timeout(250)
    d.locator('.ppickrow').first.click(); A.wait_for_timeout(700)
    ok('K6 picking a card renames the line, links it and clears the mark', A.locator('.blk[data-id="s2"] .bt').inner_text().strip()=='Sanar Integration - Production Integration (TF#35)' and A.locator('.blk[data-id="s2"] .cardchip').count()==1 and A.locator('.blk[data-id="s2"] .covchip').count()==0)
    A.locator('.blk[data-id="s3"] .blkh').focus(); A.keyboard.press('Enter'); A.wait_for_timeout(250)
    ok('K7 the line menu has Pick from the plan', A.locator('[role=dialog].cmenu .copt', has_text='Pick from the plan').count()==1)
    A.locator('[role=dialog].cmenu .copt', has_text='Pick from the plan').click(); A.wait_for_timeout(300)
    A.fill('#xdlg input[type=search]','zzzz nothing'); A.wait_for_timeout(250)
    ok('K8 nothing close says what to do', 'Nothing on the plan looks like this' in A.locator('#xdlg').inner_text()); A.click('#xdlg button:text-is("Cancel")'); A.wait_for_timeout(300)
    ok('K9 no page errors', errs==[]); print('errors:',errs[:3])
    print(sum(1 for _,c in R if c),'/',len(R))
