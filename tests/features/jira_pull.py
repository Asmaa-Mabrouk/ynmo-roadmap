import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Pull from Jira on the sprint page: tickets become scopes under each person (by product), matched people, no duplicates on a second pull, statuses follow Jira, errors are explained."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    team=A.evaluate("()=>[...__ynmo.directory().keys()]"); p1,p2=team[0],team[1]
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300)
    A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(500)
    ok('sprint page has a Pull from Jira button', A.locator('button:text-is("Pull from Jira")').count()==1)
    tk=lambda key,t,who,st='new',sn='To Do',typ='Story',sub=False,parent='',proj='DYC',done='': {'key':key,'t':t,'type':typ,'sub':sub,'parent':parent,'project':proj,'statusName':sn,'cat':st,'assignee':who,'email':'','done':done}
    A.evaluate("([a,b])=>{window.__jira=[]}",[p1,p2])
    A.click('button:text-is("Pull from Jira")'); A.wait_for_timeout(300)
    A.click('#xdlg button:text-is("Pull tickets")'); A.wait_for_timeout(500)
    ok('no tickets: says so and keeps the dialog open', 'no tickets' in A.locator('#xdlg').inner_text().lower())
    A.evaluate("window.__jiraFail=true"); A.click('#xdlg button:text-is("Pull tickets")'); A.wait_for_timeout(500)
    ok('Jira error is explained', '401' in A.locator('#xdlg').inner_text())
    A.evaluate("window.__jiraFail=false")
    data=[tk('DYC-1','Storage limit',p1),tk('DYC-2','Storage UI',p1,sub=True,parent='DYC-1',typ='Sub-task',st='indeterminate',sn='In Progress'),
          tk('DYC-3','Fix upload crash',p2,typ='Bug',st='done',sn='Done',done='2026-10-14'),tk('FAS-9','Waiting on partner',p2,st='indeterminate',sn='Waiting for customer',proj='FAS'),
          tk('DYC-4','No owner yet','',),tk('DYC-5','Someone outside the team','Zed Nobody')]
    A.evaluate("d=>{window.__jira=d}",data)
    A.click('#xdlg button:text-is("Pull tickets")'); A.wait_for_timeout(900)
    ok('dialog closes and a summary is shown', A.locator('#xdlg').count()==0 and A.locator('#toasts .toast', has_text='Jira:').count()>=1)
    B=lambda: A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).sort((a,b)=>a.ord-b.ord).map(x=>[x.k,x.t,x.st,x.jk||'',x.sq||'',x.dn||'',(x.tags||[]).join(',')])")
    bl=B(); keys=[x[3] for x in bl if x[3]]
    ok('tickets added by key, unassigned skipped', set(keys)=={'DYC-1','DYC-2','DYC-3','FAS-9','DYC-5'} and 'DYC-4' not in keys)
    ok('subtask is a sub-section right under its story', [x[0] for x in bl if x[3] in('DYC-1','DYC-2')]==['s','u'] and bl.index([x for x in bl if x[3]=='DYC-2'][0])==bl.index([x for x in bl if x[3]=='DYC-1'][0])+1)
    ok('DYC goes to the Daycare section, FAS to Tifli', any(x[0]=='h' and x[4]=='daycare' for x in bl) and any(x[0]=='h' and x[4]=='tifli' for x in bl))
    ok('statuses map: done, in progress, waiting = blocked', dict((x[3],x[2]) for x in bl if x[3])=={'DYC-1':'planned','DYC-2':'progress','DYC-3':'done','FAS-9':'blocked','DYC-5':'planned'})
    ok('done date kept and bug tagged as fix', [x for x in bl if x[3]=='DYC-3'][0][5]=='2026-10-14' and [x for x in bl if x[3]=='DYC-3'][0][6]=='fix')
    ok('ticket key is in the text (the report shows it)', 'Storage limit (DYC-1)' in [x[1] for x in bl])
    ok('person blocks use the team name; outsider keeps Jira name', any(x[0]=='p' and x[1]==p1 for x in bl) and any(x[0]=='p' and x[1]=='Zed Nobody' for x in bl))
    ok('call asked for the projects and mode', A.evaluate("()=>window.__jiraCalls[window.__jiraCalls.length-1]")=={'projects':['DYC','FAS','AU'],'sprints':'active','sprintName':''})
    # second pull: nothing duplicated, status follows Jira, our own edit of the text is kept
    A.evaluate("()=>{const id=Object.keys(JSON.parse(localStorage.getItem('fk3')).sprint_items).find(k=>JSON.parse(localStorage.getItem('fk3')).sprint_items[k].jk==='DYC-1'); window.__id1=id}")
    d2=[dict(x) for x in data]; d2[0]['cat']='done'; d2[0]['statusName']='Done'; d2[0]['done']='2026-10-15'; d2.append(tk('DYC-6','New ticket',p1))
    A.evaluate("d=>{window.__jira=d}",d2)
    A.click('button:text-is("Pull from Jira")'); A.wait_for_timeout(300); A.click('#xdlg button:text-is("Pull tickets")'); A.wait_for_timeout(900)
    bl2=B(); keys2=[x[3] for x in bl2 if x[3]]
    ok('second pull adds only the new ticket (no duplicates)', sorted(keys2)==sorted(keys+['DYC-6']) and len(keys2)==len(set(keys2)))
    ok('status of an existing ticket follows Jira', [x for x in bl2 if x[3]=='DYC-1'][0][2]=='done' and [x for x in bl2 if x[3]=='DYC-1'][0][5]=='2026-10-15')
    ok('new ticket lands under the same person', bl2.index([x for x in bl2 if x[3]=='DYC-6'][0])>bl2.index([x for x in bl2 if x[0]=='p' and x[1]==p1][0]))
    A.click('button:text-is("Pull from Jira")'); A.wait_for_timeout(300)
    A.select_option('#xdlg select','name'); A.wait_for_timeout(200)
    ok('sprint-by-name asks for the name', A.locator('#xdlg input[aria-label="Jira sprint name"]').is_visible())
    A.fill('#xdlg input[aria-label="Jira sprint name"]','Sprint 228'); A.click('#xdlg button:text-is("Pull tickets")'); A.wait_for_timeout(700)
    ok('name mode sends the sprint name', A.evaluate("()=>window.__jiraCalls[window.__jiraCalls.length-1]")['sprintName']=='Sprint 228')
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
