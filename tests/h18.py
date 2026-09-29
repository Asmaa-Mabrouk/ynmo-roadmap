"""Shared Playwright helpers for the feature scripts in tests/features (fake Supabase, signup/login/approve)."""
from playwright.sync_api import sync_playwright
import os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); URL="file://"+ROOT+"/index.html"; FAKE=open(HERE+"/fake-supabase.js").read()
def mkctx(b, init=None, **kw):
    ctx=b.new_context(viewport={'width':1400,'height':900}, accept_downloads=True, **kw)
    ctx.route("**/vendor/supabase-js.js",lambda r:r.fulfill(body=FAKE,content_type='application/javascript'))
    ctx.route("**/fonts.g*/**",lambda r:r.abort())
    if init: ctx.add_init_script(init)
    return ctx
def newpage(ctx, errs, url=URL):
    p=ctx.new_page(); p.on('pageerror',lambda e:errs.append(str(e))); p.goto(url); p.wait_for_timeout(300); return p
def signup(p,name,email):
    p.click('button:text-is("Create an account")'); p.locator('input[autocomplete=name]').fill(name); p.locator('input[type=email]').fill(email); p.locator('input[autocomplete=new-password]').fill('good1234'); p.click('button:text-is("Create account")'); p.wait_for_timeout(900)
def login(p,email):
    p.locator('input[type=email]').fill(email); p.locator('input[autocomplete=current-password]').fill('good1234'); p.click('button:text-is("Sign in")'); p.wait_for_timeout(900)
def approve(admin, n=0):
    admin.click('#nav button[data-p="admin"]'); admin.wait_for_timeout(500); admin.click('button:text-is("Approve")'); admin.wait_for_timeout(600)
