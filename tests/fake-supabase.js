(function(){
const T=['items','people','daysoff','roadmaps','ideas','vacations','activity','baselines','share_links','sprints','sprint_items','reports'];
const fresh=()=>{const s={profiles:[]};T.forEach(t=>s[t]={});return s};
const rd=()=>{const s=JSON.parse(localStorage.getItem('fk3')||'null')||fresh();T.forEach(t=>{if(!s[t])s[t]={}});return s};
const wr=s=>localStorage.setItem('fk3',JSON.stringify(s));
const cbs=[];
window.addEventListener('storage',e=>{ if(e.key==='fk3') cbs.forEach(c=>c()); });
let sess=sessionStorage.getItem('fs3')?JSON.parse(sessionStorage.getItem('fs3')):null;
window.__net={down:false,delay:+localStorage.getItem('dly')||0,fail:null}; // test hooks
const gate=async()=>{ if(window.__net.delay) await new Promise(r=>setTimeout(r,window.__net.delay)); if(window.__net.down) throw new TypeError('Failed to fetch'); };
const mkUser=(email,md)=>({id:'u_'+email.replace(/\W/g,''),email,user_metadata:md||{}});
const setSess=u=>{sess={user:u};sessionStorage.setItem('fs3',JSON.stringify(sess));return sess;};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:sess}}),
  signInWithPassword:async({email,password})=>{ await gate(); const s=rd(); const p=s.profiles.find(x=>x.email===email); if(!p||password!==(p.__pw||'good1234')) return {error:{message:'Invalid login credentials'}}; return {data:{session:setSess(Object.assign(mkUser(email),{id:p.id}))}};},
  signUp:async({email,password,options})=>{ await gate(); const s=rd(); if(s.profiles.find(x=>x.email===email)) return {error:{message:'User already registered'}}; const u=mkUser(email,options&&options.data); const first=s.profiles.length===0; s.profiles.push({id:u.id,email,name:u.user_metadata.name,role:u.user_metadata.role,avatar:u.user_metadata.avatar,approved:first,is_admin:first,created_at:new Date().toISOString(),__pw:password});wr(s); if(window.__confirmEmail) return {data:{session:null,user:u}}; return {data:{session:setSess(u),user:u}};},
  signOut:async(o)=>{window.__signout=o||null;localStorage.setItem('fk3_signout',JSON.stringify(o||null));sess=null;sessionStorage.removeItem('fs3');return {};},
  onAuthStateChange:()=>{}, resetPasswordForEmail:async(e)=>{await gate(); window.__reset=e; return {};}, updateUser:async()=>({}), resend:async()=>({})},
 from:t=>{
  if(t==='profiles'){ let f=[],upd=null,op='sel';
   const b={select(){return b},order(){return b},eq(c,v){f.push([c,v]);return b},limit(){return b},
    maybeSingle(){return run(true)},
    insert:async r=>{const s=rd();s.profiles.push({approved:false,is_admin:false,created_at:new Date().toISOString(),...r});wr(s);return {}},
    update(p){upd=p;op='upd';return b}, then(res,rej){return run(false).then(res,rej)}};
   async function run(one){ await gate(); const s=rd(); let rows=s.profiles.filter(r=>f.every(([c,v])=>r[c]===v));
     if(op==='upd'){rows.forEach(r=>Object.assign(r,upd));wr(s);return {};}
     return {data:one?(rows[0]||null):rows}; }
   return b; }
  let want=null,rng=null;const q={select(){return q},order(){return q},limit(){return q},range(a,b){rng=[a,b];return q},eq(c,v){want=v;return q},maybeSingle(){return gate().then(()=>{const s=rd();return {data:s[t][want]!==undefined?{id:want,data:s[t][want]}:null}})},then(res,rej){return gate().then(()=>{let rows=Object.keys(rd()[t]).map(id=>({id,data:rd()[t][id]})); if(t==='activity') rows.sort((a,b)=>(a.data.at<b.data.at?1:-1)); if(window.__page&&t==='activity'&&!rng) rows=rows.slice(0,window.__page); if(rng) rows=rows.slice(rng[0],rng[1]+1); return {data:rows}}).then(res,rej)}};
  return {select:()=>q,
   upsert:async r=>{await gate(); if((window.__missing||[]).includes(t)) return {error:{message:'Could not find the table in the schema cache',code:'PGRST205'}}; if(window.__net.fail) return {error:{message:window.__net.fail,code:'42501'}}; const s=rd();s[t][r.id]=r.data;wr(s);return {};},
   insert:async r=>{await gate(); const s=rd();s[t][r.id]=r.data;wr(s);return {}},
   delete:()=>({eq:async(c,id)=>{await gate(); const s=rd();delete s[t][id];wr(s);return {};}})};},
 rpc:async(fn,args)=>{ await gate(); const s=rd(); if(fn==='shared_snapshot'){ const l=s.share_links[args.t]; if(!l) return {data:null}; const items={}; Object.keys(s.items).forEach(id=>{ if((s.items[id].rm||'h2-2026')===l.rm) items[id]=s.items[id]; }); return {data:{rm:l.rm,roadmap:s.roadmaps[l.rm]||null,items,people:s.people,daysoff:s.daysoff}}; } return {error:{message:'no such function'}}; },
 functions:{invoke:async(name,o)=>{ await gate(); if(window.__aiFail) return {error:{message:'AI unavailable'}}; const b=(o&&o.body)||{}; const out={products:{}}; (b.products||[]).forEach(p=>{ out.products[p.key]={summary:'AI summary for '+p.name+' ('+p.items.length+' items)',items:p.items.map(i=>({id:i.id,text:'AI: '+i.t}))}; }); window.__aiCalls=(window.__aiCalls||0)+1; return {data:out}; }},
 channel:(name,cfg)=>{ const key=cfg&&cfg.config&&cfg.config.presence&&cfg.config.presence.key; const k='fp3:'+name; let sync=null;
  const ch={on(ev,c,cb){ if(ev==='presence') sync=cb; else cbs.push(cb); return ch; },
   subscribe(cb){ window.addEventListener('storage',e=>{ if(e.key===k&&sync) sync(); }); window.addEventListener('pagehide',()=>{ try{const s=JSON.parse(localStorage.getItem(k)||'{}'); delete s[key]; localStorage.setItem(k,JSON.stringify(s));}catch(e){} }); setTimeout(()=>{ cb&&cb('SUBSCRIBED'); if(sync) sync(); },10); return ch; },
   async track(meta){ const s=JSON.parse(localStorage.getItem(k)||'{}'); s[key]=[meta]; localStorage.setItem(k,JSON.stringify(s)); if(sync) sync(); },
   presenceState(){ return JSON.parse(localStorage.getItem(k)||'{}'); } };
  return ch; }
})};
})();
