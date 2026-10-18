import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/out")
from h18 import *
"""Sprint page: clicking next to a line, hovering and a redraw caused by someone else's change must not make the page jump."""
R=[]
def ok(n,c): R.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=mkctx(b); errs=[]
    A=newpage(ctx,errs); signup(A,'Admin','adm@x.com'); A.set_viewport_size({'width':1300,'height':720})
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.click('button:text-is("+ New sprint")'); A.wait_for_timeout(600)
    A.evaluate("""()=>{const db=JSON.parse(localStorage.getItem('fk3')); const sp=Object.keys(db.sprints)[0]; db.sprint_items={}; let o=1;
      const add=(k,t,x)=>{db.sprint_items['si'+(o)]=Object.assign({sp:sp,k:k,t:t,st:'planned',dn:'',tags:[],ord:o++},x||{})};
      add('h','Tifli',{sq:'tifli'}); for(let p=0;p<4;p++){ add('p','Person '+p); for(let i=0;i<14;i++) add('s','Scope '+p+'-'+i); }
      localStorage.setItem('fk3',JSON.stringify(db));}""")
    A.reload(); A.wait_for_timeout(1500)
    A.click('#nav button[data-p="sprints"]'); A.wait_for_timeout(300); A.locator('.spcard a.splink').first.click(); A.wait_for_timeout(800)
    Y=lambda: A.evaluate("Math.round(window.scrollY)")
    ok('long sprint is scrollable', A.evaluate("document.scrollingElement.scrollHeight")>A.evaluate("innerHeight")+800)
    A.mouse.move(700,400); A.mouse.wheel(0,700); A.wait_for_timeout(300); y0=Y()
    for y in range(150,600,40): A.mouse.move(600,y); A.wait_for_timeout(40)
    ok('hovering lines does not scroll', abs(Y()-y0)<=1)
    A.mouse.click(600,300); A.wait_for_timeout(300)
    ok('clicking beside a line keeps the scroll position', abs(Y()-y0)<=1)
    ok('and puts the caret in the nearest line', A.evaluate("document.activeElement.classList.contains('bt') && !document.activeElement.closest('.ghost')"))
    A.mouse.click(300,450); A.wait_for_timeout(300)
    ok('clicking in the gap on the left keeps it too', abs(Y()-y0)<=1)
    A.keyboard.press('ArrowDown'); A.keyboard.type('x'); A.wait_for_timeout(400)
    ok('typing keeps the position', abs(Y()-y0)<=60)
    # a redraw because someone else changed the sprint keeps the scroll position
    A.evaluate("document.activeElement.blur()"); y1=Y()
    A.evaluate("()=>__ynmo.renderSprints({keep:true})"); A.wait_for_timeout(300)
    ok('a redraw from someone else\'s change keeps the scroll position', abs(Y()-y1)<=1 and A.locator('.sdoc .blk').count()>=60)
    ok('no page errors', errs==[])
p=sum(1 for _,c in R if c); print(p,'/',len(R)); sys.exit(0 if p==len(R) else 1)
