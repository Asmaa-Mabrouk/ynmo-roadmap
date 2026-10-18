import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Export to Google Docs through Google Drive: admin sets the Client ID once, one click signs in to Google (faked here) and creates a real
Google Doc; exporting again updates it; a doc the tool cannot edit is replaced by a new one; errors are explained."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
CID='123456789012-abcdefghijklmnop.apps.googleusercontent.com'
GIS="window.__gis=0;window.google={accounts:{oauth2:{initTokenClient:function(o){window.__gisCfg={client_id:o.client_id,scope:o.scope};return {requestAccessToken:function(){window.__gis++;setTimeout(function(){ if(window.__denied){o.error_callback({type:'popup_closed'});} else o.callback({access_token:'tok-'+window.__gis,expires_in:3600}); },10);}};},revoke:function(){}}}};"
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]; calls=[]; mode={'patch':200,'post':200}
    ctx.route("https://accounts.google.com/gsi/client",lambda r:r.fulfill(body=GIS,content_type='application/javascript'))
    def drive(r):
        q=r.request; calls.append({'m':q.method,'u':q.url,'a':q.headers.get('authorization'),'ct':q.headers.get('content-type'),'body':q.post_data or ''})
        if q.method=='PATCH': return r.fulfill(status=mode['patch'],content_type='application/json',body=json.dumps({'id':'X'} if mode['patch']==200 else {'error':{'message':'File not found'}}))
        if mode['post']!=200: return r.fulfill(status=mode['post'],content_type='application/json',body=json.dumps({'error':{'message':'Google Drive API has not been used in project 1 before or it is disabled.'}}))
        return r.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'NEWDOC1234567890abcdef'}))
    ctx.route("https://www.googleapis.com/**",drive)
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com')
    A.evaluate("()=>{window.__open=[];window.open=(u)=>{window.__open.push(u);return null}}")
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(500)
    P=A
    def key(*ks):
        for k in ks: P.keyboard.press(k); P.wait_for_timeout(120)
    def typ(t): P.keyboard.type(t); P.wait_for_timeout(120)
    P.locator('.sdoc .ghost .bt').click(); key('/'); typ('Product'); key('Enter'); typ('Daycare'); key('Enter'); typ('Mona Ali'); key('Enter'); typ('Storage limit'); P.wait_for_timeout(500)
    ok('Drive icon button is there', A.locator('button.gdexp svg.gdi').count()==1 and 'Export to Google Docs' in A.locator('button.gdexp').inner_text())
    A.click('button.gdexp'); A.wait_for_timeout(400)
    ok('first time an admin is asked for the Client ID', A.locator('#xdlg input[aria-label="Google OAuth Client ID"]').count()==1 and 'Google Drive API' in A.locator('#xdlg').inner_text())
    A.fill('#xdlg input[aria-label="Google OAuth Client ID"]','not-a-client-id'); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(200)
    ok('a wrong Client ID is rejected', 'does not look like' in A.locator('#xdlg').inner_text())
    A.fill('#xdlg input[aria-label="Google OAuth Client ID"]',CID); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(500)
    ok('Client ID saved in the shared settings', A.evaluate("()=>JSON.parse(localStorage.getItem('fk3')).ideas.googlecfg.cid")==CID and A.locator('#xdlg').count()==0)
    A.click('button.gdexp'); A.wait_for_timeout(900)
    ok('one click: Google sign-in with the Drive file scope and our Client ID', A.evaluate("window.__gisCfg")=={'client_id':CID,'scope':'https://www.googleapis.com/auth/drive.file'} and A.evaluate("window.__gis")==1)
    post=[c for c in calls if c['m']=='POST']
    ok('a Google Doc is created from the plan (HTML converted by Drive)', len(post)==1 and 'uploadType=multipart' in post[0]['u'] and post[0]['a']=='Bearer tok-1' and 'application/vnd.google-apps.document' in post[0]['body'] and '<h2>Daycare</h2>' in post[0]['body'] and 'Storage limit' in post[0]['body'])
    link=A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprints)[0]")
    ok('the new doc is linked to the sprint', link['gdoc']=='https://docs.google.com/document/d/NEWDOC1234567890abcdef/edit' and link['gdocId']=='NEWDOC1234567890abcdef' and A.locator('button:text-is("Open linked doc")').is_visible())
    ok('success message', A.locator('#toasts .toast', has_text='Exported to a new Google Doc').count()>=1)
    # second export updates the same doc, no new sign-in popup (token kept in memory)
    A.click('button.gdexp'); A.wait_for_timeout(800)
    pa=[c for c in calls if c['m']=='PATCH']
    ok('exporting again updates the same doc without signing in again', len(pa)==1 and '/files/NEWDOC1234567890abcdef' in pa[0]['u'] and 'text/html' in pa[0]['ct'] and A.evaluate("window.__gis")==1 and len([c for c in calls if c['m']=='POST'])==1)
    ok('update message', A.locator('#toasts .toast', has_text='Google Doc updated').count()>=1)
    # a doc the tool cannot edit (pasted by hand) is replaced by a new one
    gi=A.locator('input[aria-label="Google Doc link"]'); gi.fill('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit'); gi.press('Tab'); A.wait_for_timeout(400)
    mode['patch']=404; n0=len(calls); A.click('button.gdexp'); A.wait_for_timeout(900)
    ok('an uneditable linked doc is replaced by a new linked doc, and you are told', [c['m'] for c in calls[n0:]]==['PATCH','POST'] and A.locator('#toasts .toast', has_text='could not be edited').count()>=1 and A.evaluate("()=>Object.values(JSON.parse(localStorage.getItem('fk3')).sprints)[0].gdoc").endswith('NEWDOC1234567890abcdef/edit'))
    # errors are explained
    gi.fill(''); gi.press('Tab'); A.wait_for_timeout(300); mode['post']=403
    A.click('button.gdexp'); A.wait_for_timeout(900)
    ok('Drive API not enabled is explained', A.locator('#toasts .toast.err', has_text='Google Drive API is not enabled').count()>=1 and A.locator('button.gdexp').is_enabled())
    mode['post']=200
    # closing the Google window is explained (new page: no cached token)
    A.reload(); A.wait_for_timeout(1500); A.evaluate("()=>{window.open=()=>null}"); A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300)
    A.locator('.spcard a.splink').first.click(); A.wait_for_timeout(600)
    A.evaluate("window.__denied=true"); A.click('button.gdexp'); A.wait_for_timeout(900)
    ok('closing the Google window is explained', A.locator('#toasts .toast.err', has_text='window was closed').count()>=1)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
