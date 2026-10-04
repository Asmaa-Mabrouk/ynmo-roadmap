"""Serve ./dist with the exact vercel.json headers on a local port and fail on any CSP violation / page error
while visiting every page. Run `node build.mjs --dist` first."""
import json, threading, http.server, socketserver, os, functools, sys
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); R=os.path.dirname(HERE)
H=json.load(open(R+'/vercel.json'))['headers'][0]['headers']
class Hd(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        for h in H: self.send_header(h['key'],h['value'])
        super().end_headers()
    def log_message(self,*a): pass
srv=socketserver.TCPServer(('127.0.0.1',0),functools.partial(Hd,directory=R+'/dist')); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
FAKE=open(HERE+'/fake-supabase.js').read()
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':1300,'height':900})
    ctx.route("**/vendor/supabase-js.js",lambda r:r.fulfill(body=FAKE,content_type='application/javascript'))
    ctx.route("**/fonts.g*/**",lambda r:r.abort())
    logs=[]; P=ctx.new_page(); P.on('console',lambda m:logs.append(m.text)); P.on('pageerror',lambda e:logs.append('ERR '+str(e)))
    P.goto('http://127.0.0.1:%d/index.html'%port); P.wait_for_timeout(500)
    P.click('button:text-is("Create an account")'); P.locator('input[autocomplete=name]').fill('A'); P.locator('input[type=email]').fill('a@x.com'); P.locator('input[autocomplete=new-password]').fill('good1234'); P.click('button:text-is("Create account")'); P.wait_for_timeout(1000)
    for pg in ['ideas','roadmaps','resources','vacations','capacity','baselines','log','roadmap']: P.click('#nav button[data-p="%s"]'%pg); P.wait_for_timeout(250)
    P.evaluate('()=>{window.print=()=>{}}'); P.click('#exportpdf'); P.wait_for_timeout(400)
    P.click('#nav button[data-p="roadmaps"]'); P.wait_for_timeout(250); P.locator('.rmcard button:text-is("Share")').first.click(); P.wait_for_timeout(300); P.keyboard.press('Escape')
    bad=[l for l in logs if 'Content Security Policy' in l or l.startswith('ERR') or 'Refused' in l]
    print('bars',P.locator('.bar').count(),'| violations/errors:',bad)
    sys.exit(1 if bad or P.locator('.bar').count()==0 else 0)
