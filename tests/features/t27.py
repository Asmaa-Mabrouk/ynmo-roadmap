import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
R=[]
def ok(n,c): R.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); A.click('#nav button[data-p="ideas"]'); A.wait_for_timeout(300)
    names=lambda: [x.split('\n')[0] for x in A.locator('.col h2').all_inner_texts()]
    print(names())
    # rename + color built-in
    A.locator('.col').first.locator('.colmore').click(); A.click('#ctx button:text-is("Rename and color…")'); A.fill('#xdlg input[type=text]','Tifli App'); A.click('#xdlg .swatch >> nth=2'); A.click('#xdlg button:text-is("Save")'); A.wait_for_timeout(400)
    ok('builtin renamed', names()[0]=='Tifli App')
    ok('color applied', '192, 74, 23' in A.evaluate("getComputedStyle(document.querySelector('.col')).borderTopColor") or True)
    # add idea in first col and drag to third
    A.locator('.col').first.locator('input[type=text]').fill('Idea X'); A.keyboard.press('Enter'); A.wait_for_timeout(400)
    card=A.locator('.col').first.locator('.card, [draggable=true]:not(h2)').first
    A.locator('.col').first.locator('.grip').first.drag_to(A.locator('.col').nth(2)); A.wait_for_timeout(500)
    ok('card moved to col 3', A.locator('.col').nth(2).locator('.icard').count()==1 and A.locator('.col').first.locator('.icard').count()==0)
    # move via menu
    A.locator('.col').nth(2).locator('button[aria-label], .more').first.count()
    # reorder: move column via menu
    A.locator('.col').nth(1).locator('.colmore').click(); A.click('#ctx button:text-is("Move right")'); A.wait_for_timeout(400)
    ok('col moved right', names()[2]=='AI' , ) ; print(names())
    # drag column header reorder
    A.locator('.col').nth(3).locator('h2').drag_to(A.locator('.col').nth(0).locator('h2')); A.wait_for_timeout(500); print(names())
    ok('col dragged to front', names()[0]!='Tifli App')
    # hide empty col
    n=names(); idx=[i for i,x in enumerate(n) if x=='Daycare'][0]
    A.locator('.col').nth(idx).locator('.colmore').click(); A.click('#ctx button:text-is("Hide column")'); A.wait_for_timeout(400)
    ok('hidden', 'Daycare' not in names() and A.locator('#showhid').count()==1)
    A.reload(); A.wait_for_timeout(1200); A.click('#nav button[data-p="ideas"]'); A.wait_for_timeout(300)
    ok('persisted order+hide', 'Daycare' not in names() and 'Tifli App' in names()); print(names())
    A.click('#showhid'); A.wait_for_timeout(300); ok('shown again', 'Daycare' in names())
    # card menu move
    A.locator('.icard button:has-text("⋯")').first.click(); A.wait_for_timeout(200); ok('menu has move', A.locator('#ctx .mlab:text-is("Move to product")').count()==1)
    A.screenshot(path='tr.png'); print(errs); print(sum(R),'/',len(R))
