/* PlanMark — user accounts and settings sync.
   Desktop app: the same Olympia account as the portal (app.olympiaholdings.com); settings in the portal database's planmark_settings table.
   Web version on claude.ai: your Claude account; settings saved privately in this artifact's storage. */
(function(){
const SYNC_KEYS=[...new Set(['pm:settings','pm:defaults','pm:chest','pm:recent','pm:snapopts','pm:layout','pm:profiles','pm:sigs','pm:cols','pm:statuses','pm:filters','pm:keys',...(window.PM_EXTRA_SYNC_KEYS||[]),...(window.PM_EXTRA_SYNC_KEYS2||[]),...['PDFEDIT','WS','TO','ST','B2','CL','FM','LK','CP','DC'].flatMap(k=>window['PM_EXTRA_SYNC_KEYS_'+k]||[])])];
H.ready.unshift(()=>{for(const k of Object.keys(window))if(/^PM_EXTRA_SYNC_KEYS/.test(k)&&Array.isArray(window[k]))for(const x of window[k])if(!SYNC_KEYS.includes(x))SYNC_KEYS.push(x)});
const AC={provider:null,user:null,cfg:null,applying:false,tok:null,tokExp:0,status:'',remoteUnsub:null};
const _set=LS.set.bind(LS);
LS.set=function(k,v){_set(k,v);if(!AC.applying&&SYNC_KEYS.includes(k)){_set('pm:sync:at',Date.now());schedulePush()}};
function snapshot(){const o={};for(const k of SYNC_KEYS){const v=LS.get(k,undefined);if(v!==undefined)o[k]=v}return o}
function applyData(data){AC.applying=true;try{for(const k of SYNC_KEYS)if(data[k]!==undefined)_set(k,data[k])}finally{AC.applying=false}
 Object.assign(settings,LS.get('pm:settings',{}));const d=clone(BASE_DEF),u=LS.get('pm:defaults',{});for(const k in u)if(d[k])Object.assign(d[k],u[k]);S.defaults=d;
 S.chest=LS.get('pm:chest',S.chest);S.recent=LS.get('pm:recent',[]);hook('prefs');renderChest();renderProps();redrawAll();renderAcct()}
let pT=0;function schedulePush(){if(!AC.user)return;clearTimeout(pT);pT=setTimeout(push,1500)}
async function push(){if(!AC.user)return;const body={json:JSON.stringify(snapshot()),updated:LS.get('pm:sync:at',Date.now())};
 try{if(AC.provider==='claude')await AC.db.doc(`data/users/${AC.user.uid}/profile`).set(body);else if(/^(olympia|portal)$/.test(AC.provider))await fsWrite(body);AC.status='Synced '+new Date().toLocaleTimeString();_set('pm:sync:pushed',body.updated)}
 catch(e){AC.status='Sync failed — will retry';console.warn('sync',e);clearTimeout(pT);pT=setTimeout(push,30000)}renderAcct()}
async function reconcile(remote){
 // First sync for this person on this computer (or someone else used it before): the account's saved settings win,
 // so local defaults never overwrite them and one person's settings never land in another's account.
 if(AC.user&&LS.get('pm:sync:user',null)!==AC.user.uid){_set('pm:sync:user',AC.user.uid);_set('pm:sync:at',0);_set('pm:sync:pushed',0);
  if(remote&&remote.updated){let data={};try{data=JSON.parse(remote.json||'{}')}catch(e){}_set('pm:sync:at',remote.updated);_set('pm:sync:pushed',remote.updated);applyData(data);AC.status='Settings loaded from your account';toast('Your settings and tools were loaded from your account');renderAcct();return}
  _set('pm:sync:at',Date.now());await push();renderAcct();return}
 const localAt=LS.get('pm:sync:at',0),pushed=LS.get('pm:sync:pushed',0);
 if(remote&&remote.updated&&(remote.updated>pushed||!localAt)&&remote.updated!==localAt){let data={};try{data=JSON.parse(remote.json||'{}')}catch(e){}
  if(localAt>pushed&&localAt>remote.updated){await push();return}_set('pm:sync:at',remote.updated);_set('pm:sync:pushed',remote.updated);applyData(data);AC.status='Settings loaded from your account';toast('Your settings and tools were loaded from your account')}
 else if(!remote||localAt>(remote.updated||0))await push();else AC.status='Up to date';renderAcct()}
/* ---------- web: Claude account ---------- */
async function initClaude(){const use=n=>Promise.resolve(window.claude.use(n)).catch(()=>null);const[user,db]=await Promise.all([use('user'),use('db')]);if(!user||!db)return false;
 const uid=await user.id();if(!uid)return false;let name='';try{const ps=await user.profiles([uid]);name=(ps&&ps[uid]&&ps[uid].name)||''}catch(e){}
 AC.provider='claude';AC.db=db;AC.user={uid,name:name||'You',email:''};if(name&&(settings.author==='User'||!settings.author)){settings.author=name;_set('pm:settings',settings)}
 const ref=db.doc(`data/users/${uid}/profile`);let first=true;
 AC.remoteUnsub=ref.onSnapshot(snap=>{const v=snap.exists?snap.data():null;if(first){first=false;reconcile(v);return}if(v&&v.updated>LS.get('pm:sync:pushed',0)&&!(snap.metadata&&snap.metadata.hasPendingWrites))reconcile(v)},e=>{AC.status='Sync unavailable';renderAcct()});
 renderAcct();return true}
/* ---------- Olympia account (same login as the portal at app.olympiaholdings.com; Supabase auth + REST, no SDK) ---------- */
async function xfetch(url,opt={}){if(window.pmDesktop&&window.pmDesktop.netFetch){const r=await window.pmDesktop.netFetch(url,{method:opt.method||'GET',headers:opt.headers||{},body:opt.body||null});if(r.status===0){let m='Failed to fetch';try{m=JSON.parse(r.body).error.message}catch(e){}if(m!=='blocked')throw new Error(m)}else return{ok:r.status>=200&&r.status<300,status:r.status,json:async()=>JSON.parse(r.body||'null')}}
 const r=await fetch(url,opt);return{ok:r.ok,status:r.status,json:async()=>{const t=await r.text();return t?JSON.parse(t):null}}}
const base=()=>AC.cfg.url.replace(/\/$/,'');
function friendly(j,status){const c=String((j&&(j.error_code||j.code||j.error||''))+' '+(j&&(j.msg||j.error_description||j.message)||''));
 if(/invalid_credentials|invalid_grant|Invalid login/i.test(c))return'Email or password is incorrect';if(/email_not_confirmed/i.test(c))return'Confirm your email first (check your inbox), then sign in';
 if(/user_banned|banned/i.test(c))return'This account has been turned off — ask the office';if(/over_request_rate_limit|rate limit|429/i.test(c)||status===429)return'Too many attempts — try again in a few minutes';
 if(/refresh_token_not_found|refresh_token_already_used|session_not_found/i.test(c))return'Your sign-in expired — please sign in again';return (j&&(j.msg||j.error_description||j.message))||'Something went wrong'}
async function authCall(path,body){const r=await xfetch(base()+'/auth/v1/'+path,{method:'POST',headers:{apikey:AC.cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok){const e=new Error(friendly(j,r.status));e.auth=r.status>=400&&r.status<500&&r.status!==429;throw e}return j}
function setSession(j){const u=j.user||{},old=LS.get('pm:auth',{})||{};const a={uid:u.id||old.uid,email:u.email||old.email,name:old.name||(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||'',refresh:j.refresh_token};
 _set('pm:auth',a);AC.tok=j.access_token;AC.tokExp=Date.now()+((+j.expires_in||3600)-120)*1000;return a}
/* Inside the portal (app.olympiaholdings.com/planmark) the person is already signed in: PlanMark uses the portal's
   own session cookie and never renews it itself (that would sign the portal out). When it is about to expire, any
   request to the portal renews it, so PlanMark asks for a small file and reads the cookie again. */
function portalSession(){try{const ref=(new URL(AC.cfg.url)).hostname.split('.')[0],base='sb-'+ref+'-auth-token';
 const jar=Object.fromEntries(document.cookie.split(/;\s*/).filter(Boolean).map(c=>{const i=c.indexOf('=');return[c.slice(0,i),decodeURIComponent(c.slice(i+1))]}));
 let v=jar[base];if(v==null){const parts=[];for(let i=0;jar[base+'.'+i]!=null;i++)parts.push(jar[base+'.'+i]);if(parts.length)v=parts.join('')}
 if(!v)return null;if(v.startsWith('base64-')){const b=v.slice(7).replace(/-/g,'+').replace(/_/g,'/');v=decodeURIComponent(escape(atob(b+'==='.slice((b.length+3)%4))))}
 const j=JSON.parse(v);const sess=j.access_token?j:(j.currentSession||j.session||null);if(!sess||!sess.access_token)return null;return sess}catch(e){return null}}
async function portalToken(){let s=portalSession();if(s&&(s.expires_at*1000-Date.now())>60000)return s.access_token;
 try{await fetch(new URL('config.json?renew='+Date.now(),document.baseURI),{cache:'no-store',credentials:'same-origin'})}catch(e){}
 s=portalSession();if(s&&s.expires_at*1000>Date.now())return s.access_token;const e=new Error('Your portal sign-in has ended — reloading');e.auth=true;setTimeout(()=>location.reload(),1500);throw e}
async function token(){if(AC.provider==='portal')return portalToken();if(AC.tok&&Date.now()<AC.tokExp)return AC.tok;const a=LS.get('pm:auth',null);if(!a||!a.refresh){const e=new Error('signed out');e.auth=true;throw e}
 setSession(await authCall('token?grant_type=refresh_token',{refresh_token:a.refresh}));return AC.tok}
async function rest(path,opt={}){const h=Object.assign({apikey:AC.cfg.anonKey,Authorization:'Bearer '+await token(),'Content-Type':'application/json'},opt.headers||{});
 const r=await xfetch(base()+'/rest/v1/'+path,{method:opt.method||'GET',headers:h,body:opt.body||null});const j=await r.json().catch(()=>null);
 if(r.status===401){AC.tok=null;const e=new Error('Your sign-in expired — please sign in again');e.auth=true;throw e}
 if(r.status===404||(j&&/PGRST205|42P01/.test(j.code||'')))throw new Error("Settings sync isn't switched on at the Olympia server yet — your settings stay on this computer for now");
 if(!r.ok)throw new Error(r.status===403?"Your Olympia account doesn't have PlanMark access":(j&&(j.message||j.msg))||('HTTP '+r.status));return j}
const DEVICE=(()=>{let d=localStorage.getItem('pm:device');if(!d){d=(window.pmDesktop?'PC-':'Web-')+Math.random().toString(36).slice(2,8);localStorage.setItem('pm:device',d)}return d})();
async function fsRead(){const rows=await rest('planmark_settings?select=data,updated_at&user_id=eq.'+AC.user.uid);const row=rows&&rows[0];if(!row)return null;const d=row.data||{};return{json:d.json,updated:+d.updated||0}}
async function fsWrite(b){await rest('planmark_settings?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:AC.user.uid,data:{json:b.json,updated:b.updated},device:DEVICE})})}
async function loadName(){try{const p=await rest('profiles?select=full_name,email&id=eq.'+AC.user.uid);const n=p&&p[0]&&p[0].full_name;if(n){const au=settings.author,auto=!au||au==='User'||au===AC.user.name||au===n||au===String(AC.user.email||'').split('@')[0];AC.user.name=n;if(AC.provider!=='portal'){const a=LS.get('pm:auth',{})||{};a.name=n;_set('pm:auth',a)}if(auto){settings.author=n;_set('pm:settings',settings)}renderAcct()}}catch(e){}}
async function signedIn(a){if(AC.provider!=='portal')AC.provider='olympia';AC.user={uid:a.uid,email:a.email,name:a.name||String(a.email||'').split('@')[0]};if(a.name){const au=settings.author;if(!au||au==='User'||au===String(a.email||'').split('@')[0]){settings.author=a.name;_set('pm:settings',settings)}}
 hideGate();renderAcct();loadName();
 try{await reconcile(await fsRead())}catch(e){if(e.auth){signOut();toast(e.message);return}AC.status=/access|switched on/.test(e.message)?e.message:'Offline — changes will sync later';renderAcct()}
 clearInterval(AC.poll);AC.poll=setInterval(async()=>{try{const r=await fsRead();if(r&&r.updated>LS.get('pm:sync:pushed',0))reconcile(r)}catch(e){}},60000)}
async function initOlympia(){const a=LS.get('pm:auth',null);AC.provider='olympia';
 if(a&&a.refresh){try{await token();await signedIn(LS.get('pm:auth'))}catch(e){if(e.auth){_set('pm:auth',null);showGate()}else{AC.user={uid:a.uid,email:a.email,name:a.name||a.email};AC.status='Offline — working with your saved settings';renderAcct();
   clearInterval(AC.retry);AC.retry=setInterval(async()=>{try{await token();clearInterval(AC.retry);signedIn(LS.get('pm:auth'))}catch(_){}},60000)}}}
 else if(AC.public){AC.user=null;AC.status='Not signed in — your settings stay on this computer';renderAcct()}else showGate();return true}
function signOut(){if(AC.provider==='portal'){location.href='/';return}clearInterval(AC.poll);clearInterval(AC.retry);if(AC.remoteUnsub)try{AC.remoteUnsub()}catch(e){}const a=LS.get('pm:auth',null);
 if(/^(olympia|portal)$/.test(AC.provider)&&AC.tok)xfetch(base()+'/auth/v1/logout',{method:'POST',headers:{apikey:AC.cfg.anonKey,Authorization:'Bearer '+AC.tok}}).catch(()=>{});
 // Settings are safe in the account; take them off this computer so the next person starts clean
 // (signatures, tool sets and profiles never carry over to someone else).
 if(/^(olympia|portal)$/.test(AC.provider)){AC.applying=true;try{for(const k of SYNC_KEYS)localStorage.removeItem(k);['pm:sync:at','pm:sync:pushed','pm:sync:user'].forEach(k=>localStorage.removeItem(k))}finally{AC.applying=false}}
 _set('pm:auth',null);AC.tok=null;AC.user=null;renderAcct();if(/^(olympia|portal)$/.test(AC.provider)){if(!AC.public)showGate();setTimeout(()=>location.reload(),50)}}
const PORTAL=()=>(AC.cfg&&AC.cfg.portal)||'https://app.olympiaholdings.com';
/* ---------- sign-in screen ---------- */
function showGate(){let g=$('#pmGate');if(!g){g=document.createElement('div');g.id='pmGate';g.style.cssText='position:fixed;inset:0;z-index:80;background:radial-gradient(circle at 30% 20%,#23324a,#12151a 70%);display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(g)}
 const cf=AC.cfg||{};g.innerHTML=`<form id="gF" style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;width:100%;max-width:360px;box-shadow:0 30px 80px rgba(0,0,0,.5)">
 <div class="brand" style="font-size:18px;padding:0;margin-bottom:4px"><i></i>PlanMark</div><div class="hint" style="margin-bottom:16px">Sign in with your Olympia account — the same email and password as ${esc(PORTAL().replace(/^https?:\/\//,''))}</div>
 <div class="fld"><label>Email</label><input class="ti" id="gE" type="email" autocomplete="username" required value="${esc((LS.get('pm:lastEmail','')))}"></div>
 <div class="fld"><label>Password</label><input class="ti" id="gP" type="password" autocomplete="current-password" required></div>
 <div id="gErr" style="color:#fca5a5;font-size:12px;min-height:16px;margin-bottom:6px"></div>
 <button class="btn pri" type="submit" style="width:100%;justify-content:center;height:36px">Sign in</button>
 <div class="hint" style="margin-top:12px;font-size:11.5px;line-height:1.5">Forgot your password, or never set one? Sign in at <a href="${esc(PORTAL())}/login" target="_blank" rel="noopener" style="color:#7dd3fc">${esc(PORTAL().replace(/^https?:\/\//,''))}</a> with an emailed link, then set a password under Account.</div>
 <div class="hint" style="margin-top:8px;font-size:11px"><a href="#" data-g="off" style="color:#7dd3fc">Continue without signing in</a> — settings stay on this computer only</div></form>`;
 g.onclick=e=>{const a=e.target.closest('[data-g]');if(!a)return;e.preventDefault();if(a.dataset.g==='off'){hideGate();AC.status='Offline — not signed in';renderAcct()}};
 $('#gF').onsubmit=async e=>{e.preventDefault();const em=$('#gE').value.trim(),pw=$('#gP').value,err=$('#gErr');err.textContent='';_set('pm:lastEmail',em);const btn=$('#gF button[type=submit]');btn.disabled=true;
  try{const j=await authCall('token?grant_type=password',{email:em,password:pw});_set('pm:offlineOk',true);await signedIn(setSession(j));if(AC.user)toast('Welcome, '+(AC.user.name||em))}
  catch(ex){err.textContent=/Failed to fetch|NetworkError|net::|ENOTFOUND|ECONN/i.test(ex.message)?"Can't reach the Olympia server — check your internet":ex.message;btn.disabled=false}};
 setTimeout(()=>{const f=$('#gE');(f&&f.value?$('#gP'):f).focus()},30)}
function hideGate(){const g=$('#pmGate');if(g)g.remove()}
/* ---------- account button & menu ---------- */
function renderAcct(){let b=$('#bAcct');if(!b){b=document.createElement('button');b.id='bAcct';b.className='btn';b.title='Account';$('#topbar').appendChild(b);b.onclick=acctDialog}
 const u=AC.user,ini=u?(u.name||u.email||'?').split(/[\s@.]+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join(''):'';
 b.innerHTML=u?`<span style="width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${esc(ini)}</span><span class="hide-m">${esc(u.name||u.email)}</span>`:`<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg><span class="hide-m">${AC.provider?'Sign in':'Account'}</span>`}
function acctDialog(){const u=AC.user,dv=window.pmDesktop;
 const prov=AC.provider==='claude'?'Claude account (web)':/^(olympia|portal)$/.test(AC.provider)?'Olympia account':'Not set up';
 modal('Account',`${u?`<div class="meas"><b style="font-size:14px;color:var(--text)">${esc(u.name||'')}</b><small>${esc(u.email||'')}${u.email?' · ':''}${prov}</small><small style="display:block">${esc(AC.status||'')}</small></div>`:
  /^(olympia|portal)$/.test(AC.provider)?'<div class="hint">You are working offline without signing in.</div>':`<div class="hint">${dv?'Accounts aren\'t switched on for this installation yet. Once the Olympia account server is connected (an update from your PlanMark admin), everyone signs in here and their settings, tools and profiles follow them to any computer.':'Open PlanMark on claude.ai while signed in to sync your settings with your Claude account.'}</div>`}
 <div class="hint" style="margin:8px 0">What follows you: author name, tool defaults, Tool Chest, recent tools, snap & grid, panel layout, and saved profiles.</div>
 <div class="row" style="gap:6px;flex-wrap:wrap">${u?'<button class="btn" id="acSync" style="border:1px solid var(--line)">Sync now</button>':''}${u&&/^(olympia|portal)$/.test(AC.provider)?'<button class="btn" id="acOut" style="border:1px solid var(--line)">Sign out</button>':''}${!u&&/^(olympia|portal)$/.test(AC.provider)?'<button class="btn pri" id="acIn">Sign in</button>':''}</div>
 ${dv?`<div class="sec">App</div><div class="hint">PlanMark for Windows ${esc(dv.version||'')} · app files ${esc(dv.webVersion||window.PM_VERSION||'')}</div><div class="row" style="margin-top:6px"><button class="btn" id="acUpd" style="border:1px solid var(--line)">Check for updates</button></div><div class="hint" id="acUpdMsg" style="margin-top:4px"></div>`:''}`,[{label:'Close',cancel:1}]);
 if($('#acSync'))$('#acSync').onclick=async()=>{AC.status='Syncing…';await (/^(olympia|portal)$/.test(AC.provider)?fsRead().then(reconcile):push());closeModal();toast(AC.status)};
 if($('#acOut'))$('#acOut').onclick=()=>{closeModal();signOut()};if($('#acIn'))$('#acIn').onclick=()=>{closeModal();showGate()};
 if($('#acUpd'))$('#acUpd').onclick=async()=>{const m=$('#acUpdMsg');m.textContent='Checking…';try{const r=await dv.checkForUpdates();m.textContent=r.state==='ready'?'Update '+r.version+' downloaded — reload to use it':r.state==='up-to-date'?'You have the latest version ('+r.version+')':r.state==='shell-too-old'?'A newer installer is needed for this update — ask your admin':'Could not check: '+(r.message||r.state)}catch(e){m.textContent='Could not check'}}}
/* ---------- boot ---------- */
H.ready.push(async()=>{renderAcct();
 try{const r=await fetch('config.json',{cache:'no-store'});if(r.ok){const c=await r.json();if(c&&c.olympia&&c.olympia.url&&c.olympia.anonKey)AC.cfg=Object.assign({},c.olympia,{org:c.org})}}catch(e){}
 // The desktop app and the company website (any host listed in config "webHosts", e.g. planmark.olympiaholdings.com)
 // sign in with the Olympia account; other copies (Claude artifact, local test copies) don't.
 if(AC.cfg&&AC.cfg.portalHost&&location.hostname===AC.cfg.portalHost){const ps=portalSession();if(ps){AC.provider='portal';const u=ps.user||{};
   const a={uid:u.id,email:u.email,name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||''};await signedIn(a);AC.provider='portal';renderAcct();return}}
 // The public PlanMark site (planmark.olympiaholdings.com) works without signing in; signing in there is optional
 // (Account → Sign in) and only carries settings between computers.
 const pubHost=AC.cfg&&(AC.cfg.publicHosts||[]).some(h=>location.hostname===h);
 if(pubHost){AC.public=true;await initOlympia();return}
 const webHost=AC.cfg&&(AC.cfg.webHosts||[]).some(h=>location.hostname===h||location.hostname.endsWith('.'+h));
 if(AC.cfg&&(window.pmDesktop||webHost)){await initOlympia();return}
 if(window.claude&&typeof window.claude.use==='function'){try{if(await initClaude())return}catch(e){}}
 renderAcct()});  // plain browser copies (no desktop app, no Claude account) run without sign-in
window.PMAccount={AC,push,signOut,showGate,token};
})();
