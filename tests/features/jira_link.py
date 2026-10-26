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
    ok('line options offer to change the Jira link', any('Jira link' in i and 'DYC-1' in i for i in items))
    A.locator('[role=dialog].cmenu .copt', has_text='Jira link').click(); A.wait_for_timeout(300)
    ok('the dialog starts with the task title as the search', A.locator('#xdlg input').first.input_value()=='Storage limit')
    A.locator('#xdlg input').first.fill('storage'); A.wait_for_timeout(900)
    opts=[e.get_attribute('data-key') for e in A.locator('#xdlg .jkopt').all()]
    ok('typing lists matching tickets live (and not other ones)', opts==['DYC-7','DYC-8'])
    ok('the call sent the text', A.evaluate("()=>window.__searchCalls[window.__searchCalls.length-1].q")=='storage')
    A.locator('#xdlg .jkopt[data-key="DYC-7"]').click(); A.wait_for_timeout(600)
    d=A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s').map(x=>[x.jk,x.st])")
    ok('picking links the task and takes the Jira status', d==[['DYC-7','progress']])
    ok('the chip now shows the new key', chip().inner_text()=='DYC-7')
    menu(); A.locator('[role=dialog].cmenu .copt', has_text='Jira link').click(); A.wait_for_timeout(300)
    A.locator('#xdlg input').first.fill('DYC-8'); A.keyboard.press('Enter'); A.wait_for_timeout(700)
    ok('a key can be typed directly', [e.get_attribute('data-key') for e in A.locator('#xdlg .jkopt').all()]==['DYC-8'])
    A.locator('#xdlg .jkopt').first.click(); A.wait_for_timeout(500)
    ok('a done ticket marks the task done', A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s')[0].st")=='done')
    menu(); A.locator('[role=dialog].cmenu .copt', has_text='Jira link').click(); A.wait_for_timeout(300)
    A.locator('#xdlg input').first.fill('zzzz'); A.wait_for_timeout(800)
    ok('no match is explained', 'no ticket' in A.locator('#xdlg').inner_text().lower())
    A.evaluate("window.__jiraFail=true"); A.locator('#xdlg input').first.fill('storage'); A.wait_for_timeout(800)
    ok('a Jira error is explained', '401' in A.locator('#xdlg').inner_text())
    A.evaluate("window.__jiraFail=false"); A.click('#xdlg button:has-text("Unlink")'); A.wait_for_timeout(500)
    ok('Unlink removes the link and the chip', A.locator('.blk.k-s .jkchip').count()==0 and A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprint_items).filter(x=>x.k==='s')[0].jk||''")=='')
    menu(); ok('with no link the menu says Link to Jira…', any(e.inner_text().startswith('Link to Jira') for e in A.locator('[role=dialog].cmenu .copt').all())); A.keyboard.press('Escape')
    ok('no page errors', errs==[]); print('errors:',errs[:3]); print(sum(1 for _,c in R if c),'/',len(R))
