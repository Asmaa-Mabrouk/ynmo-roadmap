import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Link a sprint task to a Jira issue by searching as you type (fake Jira only)."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    team=A.evaluate("()=>[...__ynmo.directory().keys()]"); p1=team[0]
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(500)
    tk=lambda key,t,who='',st='new',sn='To Do': {'key':key,'t':t,'type':'Story','sub':False,'parent':'','project':key.split('-')[0],'statusName':sn,'cat':st,'assignee':who,'email':'','done':''}
    A.evaluate("d=>{window.__jira=d}",[tk('DYC-1','Storage limit',p1)])
    A.click('button:text-is("Pull from Jira")'); A.wait_for_timeout(300); A.click('#xdlg button:text-is("Pull tickets")'); A.wait_for_timeout(900)
    A.evaluate("d=>{window.__jira=d}",[tk('DYC-7','Storage quota screen','','indeterminate','In Progress'),tk('DYC-8','Storage export','','done','Done'),tk('FAS-2','Login screen')])
    chip=lambda: A.locator('.blk.k-s .jkchip').first
    ok('a pulled task shows its Jira key as a link to the issue', A.locator('.blk.k-s a.jkchip').count()==1 and chip().inner_text()=='DYC-1' and chip().get_attribute('href')=='https://x.atlassian.net/browse/DYC-1')
    def menu():
        h=A.locator('.blk.k-s .blkh').first; h.focus(); A.keyboard.press('Enter'); A.wait_for_timeout(250)
    menu(); items=[e.inner_text() for e in A.locator('[role=dialog].cmenu .copt').all()]
    ok('line options offer the Jira tickets with their number', any('Jira tickets (1)' in i for i in items))
    A.locator('[role=dialog].cmenu .copt', has_text='Jira tickets').click(); A.wait_for_timeout(300)
    ok('the dialog lists the linked ticket and starts with the task title as the search', A.locator('#xdlg .jkl').count()==1 and A.locator('#xdlg input[aria-label="Search Jira"]').input_value()=='Storage limit')
    A.locator('#xdlg input[aria-label="Search Jira"]').fill('storage'); A.wait_for_timeout(900)
    opts=[e.get_attribute('data-key') for e in A.locator('#xdlg .jkopt').all()]
    ok('typing lists matching tickets live (and not other ones)', opts==['DYC-7','DYC-8'])
    ok('the call sent the text', A.evaluate("()=>window.__searchCalls[window.__searchCalls.length-1].q")=='storage')
    A.locator('#xdlg .jkopt[data-key="DYC-7"]').click(); A.wait_for_timeout(600)
    d=A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s').map(x=>[x.jk,x.jx,x.st])")
    ok('picking ADDS a second ticket, the main one and its status stay, and the dialog stays open', d==[['DYC-1',['DYC-7'],'planned']] and A.locator('#xdlg .jkl').count()==2 and A.locator('#xdlg').count()==1)
    A.locator('#xdlg .jkopt[data-key="DYC-8"]').click(); A.wait_for_timeout(500)
    ok('a third ticket can be added the same way and the line shows all three chips', A.locator('.blk.k-s .jkchip').count()==3 and [c.inner_text() for c in A.locator('.blk.k-s .jkchip').all()]==['DYC-1','DYC-7','DYC-8'])
    A.click('#xdlg button[aria-label="Remove DYC-1"]'); A.wait_for_timeout(500)
    d=A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s').map(x=>[x.jk,x.jx])")
    ok('removing the main ticket promotes the next one', d==[['DYC-7',['DYC-8']]])
    A.locator('#xdlg .jkl:has-text("DYC-8") button:text-is("Make main")').click(); A.wait_for_timeout(400)
    ok('Make main changes the order', A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s')[0].jk")=='DYC-8')
    A.click('#xdlg button[aria-label="Remove DYC-8"]'); A.wait_for_timeout(300); A.click('#xdlg button[aria-label="Remove DYC-7"]'); A.wait_for_timeout(400)
    ok('removing every ticket leaves the line unlinked', A.locator('.blk.k-s .jkchip').count()==0 and 'No ticket linked yet' in A.locator('#xdlg').inner_text())
    A.locator('#xdlg input[aria-label="Search Jira"]').fill('DYC-7'); A.keyboard.press('Enter'); A.wait_for_timeout(700)
    A.locator('#xdlg .jkopt[data-key="DYC-7"]').click(); A.wait_for_timeout(500)
    ok('the first ticket added takes its Jira status', A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s')[0].st")=='progress')
    A.fill('#jkpaste','dyc-9, https://x.atlassian.net/browse/FAS-2 and DYC-7'); A.click('#jkpastego'); A.wait_for_timeout(500)
    ok('several keys and links can be pasted at once; repeats are ignored', A.evaluate("()=>{const x=Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s')[0];return [x.jk,x.jx]}")==['DYC-7',['DYC-9','FAS-2']])
    A.click('#xdlg button:text-is("Done")'); A.wait_for_timeout(300)
    ok('Done closes the dialog and the line shows all chips', A.locator('#xdlg').count()==0 and A.locator('.blk.k-s .jkchip').count()==3)
    A.evaluate("window.__jiraFail=true"); menu(); A.locator('[role=dialog].cmenu .copt', has_text='Jira tickets').click(); A.wait_for_timeout(300)
    A.locator('#xdlg input[aria-label="Search Jira"]').fill('zzzz'); A.wait_for_timeout(800)
    ok('a Jira error is explained', '401' in A.locator('#xdlg').inner_text())
    A.evaluate("window.__jiraFail=false")
    A.locator('#xdlg input[aria-label="Search Jira"]').fill('zzzz2'); A.wait_for_timeout(800)
    ok('no match is explained', 'no ticket' in A.locator('#xdlg').inner_text().lower())
    for k in ['DYC-7','DYC-9','FAS-2']: A.click('#xdlg button[aria-label="Remove %s"]'%k); A.wait_for_timeout(250)
    A.click('#xdlg button:text-is("Done")'); A.wait_for_timeout(300)
    menu(); ok('with no link the menu says Link to Jira…', any(e.inner_text().startswith('Link to Jira') for e in A.locator('[role=dialog].cmenu .copt').all())); A.keyboard.press('Escape')
    ok('no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R))
