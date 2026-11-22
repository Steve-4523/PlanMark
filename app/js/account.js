/* PlanMark — user accounts and settings sync.
   Desktop app: email/password accounts on the company's Firebase project (config.json, delivered by auto-update).
   Web version on claude.ai: your Claude account; settings saved privately in this artifact's storage. */
(function(){
const SYNC_KEYS=[...new Set(['pm:settings','pm:defaults','pm:chest','pm:recent','pm:snapopts','pm:layout','pm:profiles','pm:sigs','pm:cols','pm:statuses','pm:filters','pm:keys',...(window.PM_EXTRA_SYNC_KEYS||[]),...(window.PM_EXTRA_SYNC_KEYS2||[]),...['PDFEDIT','WS','TO','ST','B2','CL'].flatMap(k=>window['PM_EXTRA_SYNC_KEYS_'+k]||[])])];
const AC={provider:null,user:null,cfg:null,applying:false,tok:null,tokExp:0,status:'',remoteUnsub:null};
const _set=LS.set.bind(LS);
LS.set=function(k,v){_set(k,v);if(!AC.applying&&SYNC_KEYS.includes(k)){_set('pm:sync:at',Date.now());schedulePush()}};
function snapshot(){const o={};for(const k of SYNC_KEYS){const v=LS.get(k,undefined);if(v!==undefined)o[k]=v}return o}
function applyData(data){AC.applying=true;try{for(const k of SYNC_KEYS)if(data[k]!==undefined)_set(k,data[k])}finally{AC.applying=false}
 Object.assign(settings,LS.get('pm:settings',{}));const d=clone(BASE_DEF),u=LS.get('pm:defaults',{});for(const k in u)if(d[k])Object.assign(d[k],u[k]);S.defaults=d;
 S.chest=LS.get('pm:chest',S.chest);S.recent=LS.get('pm:recent',[]);hook('prefs');renderChest();renderProps();redrawAll();renderAcct()}
let pT=0;function schedulePush(){if(!AC.user)return;clearTimeout(pT);pT=setTimeout(push,1500)}
async function push(){if(!AC.user)return;const body={json:JSON.stringify(snapshot()),updated:LS.get('pm:sync:at',Date.now())};
 try{if(AC.provider==='claude')await AC.db.doc(`data/users/${AC.user.uid}/profile`).set(body);else if(AC.provider==='firebase')await fsWrite(body);AC.status='Synced '+new Date().toLocaleTimeString();_set('pm:sync:pushed',body.updated)}
 catch(e){AC.status='Sync failed — will retry';console.warn('sync',e);clearTimeout(pT);pT=setTimeout(push,30000)}renderAcct()}
async function reconcile(remote){const localAt=LS.get('pm:sync:at',0),pushed=LS.get('pm:sync:pushed',0);
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
/* ---------- desktop: Firebase (REST, no SDK) ---------- */
async function xfetch(url,opt={}){if(window.pmDesktop&&window.pmDesktop.netFetch){const r=await window.pmDesktop.netFetch(url,{method:opt.method||'GET',headers:opt.headers||{},body:opt.body||null});return{ok:r.status>=200&&r.status<300,status:r.status,json:async()=>JSON.parse(r.body||'{}')}}
 const r=await fetch(url,opt);return{ok:r.ok,status:r.status,json:()=>r.json()}}
const IDT='https://identitytoolkit.googleapis.com/v1/accounts:',STK='https://securetoken.googleapis.com/v1/token?key=';
async function idt(op,body){const r=await xfetch(IDT+op+'?key='+AC.cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(friendly(j&&j.error&&j.error.message));return j}
function friendly(c){c=String(c||'');if(/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(c))return'Email or password is incorrect';if(/EMAIL_EXISTS/.test(c))return'An account with that email already exists';if(/WEAK_PASSWORD/.test(c))return'Password must be at least 6 characters';
 if(/TOO_MANY_ATTEMPTS/.test(c))return'Too many attempts — try again later';if(/USER_DISABLED/.test(c))return'This account has been disabled';if(/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(c))return'New sign-ups are turned off — ask your admin to add you';return c||'Something went wrong'}
function setSession(j){const a={uid:j.localId||j.user_id,email:j.email||(LS.get('pm:auth',{})||{}).email,name:j.displayName||(LS.get('pm:auth',{})||{}).name||'',refresh:j.refreshToken||j.refresh_token};_set('pm:auth',a);AC.tok=j.idToken||j.id_token;AC.tokExp=Date.now()+((+(j.expiresIn||j.expires_in)||3600)-120)*1000;return a}
async function token(){if(AC.tok&&Date.now()<AC.tokExp)return AC.tok;const a=LS.get('pm:auth',null);if(!a||!a.refresh)throw new Error('signed out');
 const r=await xfetch(STK+AC.cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(a.refresh)});const j=await r.json();if(!r.ok){const e=new Error(friendly(j&&j.error&&j.error.message));e.auth=true;throw e}setSession(j);return AC.tok}
const docUrl=()=>`https://firestore.googleapis.com/v1/projects/${AC.cfg.projectId}/databases/(default)/documents/users/${AC.user.uid}`;
async function fsRead(){const r=await xfetch(docUrl(),{headers:{Authorization:'Bearer '+await token()}});if(r.status===404)return null;const j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||'read failed');const f=j.fields||{};return{json:f.json&&f.json.stringValue,updated:f.updated&&+f.updated.integerValue}}
async function fsWrite(b){const fields={json:{stringValue:b.json},updated:{integerValue:String(b.updated)},email:{stringValue:AC.user.email||''},name:{stringValue:AC.user.name||''}};
 const r=await xfetch(docUrl(),{method:'PATCH',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify({fields})});if(!r.ok){const j=await r.json();throw new Error((j.error&&j.error.message)||'write failed')}}
async function signedIn(a){AC.provider='firebase';AC.user={uid:a.uid,email:a.email,name:a.name||a.email.split('@')[0]};if(AC.user.name){settings.author=AC.user.name;_set('pm:settings',settings)}
 hideGate();renderAcct();try{await reconcile(await fsRead())}catch(e){AC.status='Offline — changes will sync later';renderAcct()}
 clearInterval(AC.poll);AC.poll=setInterval(async()=>{try{const r=await fsRead();if(r&&r.updated>LS.get('pm:sync:pushed',0))reconcile(r)}catch(e){}},120000)}
async function initFirebase(){const a=LS.get('pm:auth',null);AC.provider='firebase';
 if(a&&a.refresh){try{await token();await signedIn(LS.get('pm:auth'))}catch(e){if(e.auth){_set('pm:auth',null);showGate()}else{AC.user={uid:a.uid,email:a.email,name:a.name||a.email};AC.status='Offline — working with your saved settings';renderAcct();
   clearInterval(AC.retry);AC.retry=setInterval(async()=>{try{await token();clearInterval(AC.retry);signedIn(LS.get('pm:auth'))}catch(_){}},60000)}}}
 else showGate();return true}
function signOut(){clearInterval(AC.poll);if(AC.remoteUnsub)try{AC.remoteUnsub()}catch(e){}_set('pm:auth',null);AC.tok=null;AC.user=null;renderAcct();if(AC.provider==='firebase')showGate()}
/* ---------- sign-in screen ---------- */
function showGate(mode='in'){let g=$('#pmGate');if(!g){g=document.createElement('div');g.id='pmGate';g.style.cssText='position:fixed;inset:0;z-index:80;background:radial-gradient(circle at 30% 20%,#23324a,#12151a 70%);display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(g)}
 const cf=AC.cfg||{};g.innerHTML=`<form id="gF" style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;width:100%;max-width:360px;box-shadow:0 30px 80px rgba(0,0,0,.5)">
 <div class="brand" style="font-size:18px;padding:0;margin-bottom:4px"><i></i>PlanMark</div><div class="hint" style="margin-bottom:16px">${mode==='up'?'Create your account':mode==='reset'?'Reset your password':'Sign in to your account'}${cf.org?' · '+esc(cf.org):''}</div>
 ${mode==='up'?'<div class="fld"><label>Full name</label><input class="ti" id="gN" autocomplete="name" required></div>':''}
 <div class="fld"><label>Email</label><input class="ti" id="gE" type="email" autocomplete="username" required value="${esc((LS.get('pm:lastEmail','')))}"></div>
 ${mode!=='reset'?`<div class="fld"><label>Password</label><input class="ti" id="gP" type="password" autocomplete="${mode==='up'?'new-password':'current-password'}" required minlength="6"></div>`:''}
 <div id="gErr" style="color:#fca5a5;font-size:12px;min-height:16px;margin-bottom:6px"></div>
 <button class="btn pri" type="submit" style="width:100%;justify-content:center;height:36px">${mode==='up'?'Create account':mode==='reset'?'Send reset email':'Sign in'}</button>
 <div class="row" style="justify-content:space-between;margin-top:12px;font-size:12px">${mode==='in'?`<a href="#" data-g="reset" style="color:#7dd3fc">Forgot password?</a>${cf.allowSignup===false?'':'<a href="#" data-g="up" style="color:#7dd3fc">Create account</a>'}`:'<a href="#" data-g="in" style="color:#7dd3fc">← Back to sign in</a>'}</div>
 ${LS.get('pm:offlineOk',false)&&mode==='in'?'<div class="hint" style="margin-top:12px;font-size:11px">No internet? <a href="#" data-g="off" style="color:#7dd3fc">Work offline</a></div>':''}</form>`;
 g.onclick=e=>{const a=e.target.closest('[data-g]');if(!a)return;e.preventDefault();if(a.dataset.g==='off'){hideGate();AC.status='Offline — not signed in';renderAcct();return}showGate(a.dataset.g)};
 $('#gF').onsubmit=async e=>{e.preventDefault();const em=$('#gE').value.trim(),pw=$('#gP')&&$('#gP').value,err=$('#gErr');err.textContent='';_set('pm:lastEmail',em);const btn=$('#gF button[type=submit]');btn.disabled=true;
  try{if(mode==='reset'){await idt('sendOobCode',{requestType:'PASSWORD_RESET',email:em});err.style.color='#86efac';err.textContent='Check your email for a reset link.';btn.disabled=false;return}
   let j;if(mode==='up'){j=await idt('signUp',{email:em,password:pw,returnSecureToken:true});const nm=$('#gN').value.trim();if(nm){const u=await idt('update',{idToken:j.idToken,displayName:nm,returnSecureToken:true});j.displayName=nm;if(u.idToken)j.idToken=u.idToken}}
   else j=await idt('signInWithPassword',{email:em,password:pw,returnSecureToken:true});_set('pm:offlineOk',true);await signedIn(setSession(j));toast('Welcome, '+(AC.user.name||em))}
  catch(ex){err.style.color='#fca5a5';err.textContent=/Failed to fetch|NetworkError|net::/i.test(ex.message)?"Can't reach the sign-in server — check your internet":ex.message;btn.disabled=false}};
 setTimeout(()=>{const f=$('#gE');(f&&f.value&&$('#gP')?$('#gP'):f).focus()},30)}
function hideGate(){const g=$('#pmGate');if(g)g.remove()}
/* ---------- account button & menu ---------- */
function renderAcct(){let b=$('#bAcct');if(!b){b=document.createElement('button');b.id='bAcct';b.className='btn';b.title='Account';$('#topbar').appendChild(b);b.onclick=acctDialog}
 const u=AC.user,ini=u?(u.name||u.email||'?').split(/[\s@.]+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join(''):'';
 b.innerHTML=u?`<span style="width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${esc(ini)}</span><span class="hide-m">${esc(u.name||u.email)}</span>`:`<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg><span class="hide-m">${AC.provider?'Sign in':'Account'}</span>`}
function acctDialog(){const u=AC.user,dv=window.pmDesktop;
 const prov=AC.provider==='claude'?'Claude account (web)':AC.provider==='firebase'?'PlanMark account':'Not set up';
 modal('Account',`${u?`<div class="meas"><b style="font-size:14px;color:var(--text)">${esc(u.name||'')}</b><small>${esc(u.email||'')}${u.email?' · ':''}${prov}</small><small style="display:block">${esc(AC.status||'')}</small></div>`:
  AC.provider==='firebase'?'<div class="hint">You are working offline without signing in.</div>':`<div class="hint">${dv?'Accounts aren\'t switched on for this installation yet. Once your company account server is connected (an update from your PlanMark admin), everyone signs in here and their settings, tools and profiles follow them to any computer.':'Open PlanMark on claude.ai while signed in to sync your settings with your Claude account.'}</div>`}
 <div class="hint" style="margin:8px 0">What follows you: author name, tool defaults, Tool Chest, recent tools, snap & grid, panel layout, and saved profiles.</div>
 <div class="row" style="gap:6px;flex-wrap:wrap">${u?'<button class="btn" id="acSync" style="border:1px solid var(--line)">Sync now</button>':''}${u&&AC.provider==='firebase'?'<button class="btn" id="acName" style="border:1px solid var(--line)">Change name</button><button class="btn" id="acOut" style="border:1px solid var(--line)">Sign out</button>':''}${!u&&AC.provider==='firebase'?'<button class="btn pri" id="acIn">Sign in</button>':''}</div>
 ${dv?`<div class="sec">App</div><div class="hint">PlanMark for Windows ${esc(dv.version||'')} · app files ${esc(dv.webVersion||window.PM_VERSION||'')}</div><div class="row" style="margin-top:6px"><button class="btn" id="acUpd" style="border:1px solid var(--line)">Check for updates</button></div><div class="hint" id="acUpdMsg" style="margin-top:4px"></div>`:''}`,[{label:'Close',cancel:1}]);
 if($('#acSync'))$('#acSync').onclick=async()=>{AC.status='Syncing…';await (AC.provider==='firebase'?fsRead().then(reconcile):push());closeModal();toast(AC.status)};
 if($('#acOut'))$('#acOut').onclick=()=>{closeModal();signOut()};if($('#acIn'))$('#acIn').onclick=()=>{closeModal();showGate()};
 if($('#acName'))$('#acName').onclick=()=>modalPrompt('Your name','Shown as the author on your markups',u.name||'',async n=>{try{await idt('update',{idToken:await token(),displayName:n,returnSecureToken:true});AC.user.name=n;const a=LS.get('pm:auth',{});a.name=n;_set('pm:auth',a);settings.author=n;LS.set('pm:settings',settings);renderAcct();toast('Name updated')}catch(e){toast(e.message)}});
 if($('#acUpd'))$('#acUpd').onclick=async()=>{const m=$('#acUpdMsg');m.textContent='Checking…';try{const r=await dv.checkForUpdates();m.textContent=r.state==='ready'?'Update '+r.version+' downloaded — reload to use it':r.state==='up-to-date'?'You have the latest version ('+r.version+')':r.state==='shell-too-old'?'A newer installer is needed for this update — ask your admin':'Could not check: '+(r.message||r.state)}catch(e){m.textContent='Could not check'}}}
/* ---------- boot ---------- */
H.ready.push(async()=>{renderAcct();
 try{const r=await fetch('config.json',{cache:'no-store'});if(r.ok){const c=await r.json();if(c&&c.firebase&&c.firebase.apiKey&&c.firebase.projectId)AC.cfg=Object.assign({},c.firebase,{org:c.org,allowSignup:c.allowSignup})}}catch(e){}
 if(AC.cfg&&window.pmDesktop){await initFirebase();return}
 if(window.claude&&typeof window.claude.use==='function'){try{if(await initClaude())return}catch(e){}}
 if(AC.cfg){await initFirebase();return}renderAcct()});
window.PMAccount={AC,push,signOut,showGate};
})();
