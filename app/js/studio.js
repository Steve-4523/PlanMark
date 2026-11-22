/* PlanMark — Studio sessions: live, shared markup sessions (web version on claude.ai) */
(function(){
const ST={db:null,room:null,user:null,assets:null,me:null,canEdit:false,list:[],sess:null,peers:[],names:{},avail:false,checked:false};
const COLORS=['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
const colorOf=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return COLORS[Math.abs(h)%COLORS.length]};
function canon(o){if(Array.isArray(o))return'['+o.map(canon).join(',')+']';if(o&&typeof o==='object')return'{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';return JSON.stringify(o)}
const ago=t=>{const s=(Date.now()-t)/1000;return s<60?'just now':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+' h ago':new Date(t).toLocaleDateString()};
async function nameOf(ids){ids=ids.filter(i=>i&&!(i in ST.names));if(ids.length&&ST.user){try{const ps=await ST.user.profiles(ids);for(const id of ids)ST.names[id]=(ps&&ps[id]&&ps[id].name)||'Someone'}catch(e){}}}
const nm=id=>ST.names[id]||'Someone';
/* ---------- panel ---------- */
function render(){const pane=$('#pane-studio');if(!pane)return;const draft=$('#stuMsg')?$('#stuMsg').value:'',hadFocus=document.activeElement&&document.activeElement.id==='stuMsg';try{render0(pane)}finally{const i=$('#stuMsg');if(i&&draft){i.value=draft}if(i&&hadFocus)i.focus()}lockBanner()}
function render0(pane){
 if(!ST.checked){pane.innerHTML='<div class="hint">Connecting…</div>';return}
 if(!ST.avail){pane.innerHTML=`<div class="hint"><b style="color:var(--text)">Studio sessions</b><br><br>Live sessions let your team mark up the same drawing together — everyone sees markups and cursors as they happen.<br><br>${window.pmDesktop?'Sessions run in the <b>web version</b> of PlanMark on claude.ai (they need your Claude sign-in to share data). Open the PlanMark link in your browser, start a session there, and share the artifact with your team.':'Sessions need you to be signed in to claude.ai with this artifact open there. Share the artifact with teammates (Contributor access) so they can join.'}</div>`;return}
 const s=ST.sess;
 if(s){const peers=ST.peers.filter(p=>p.kind==='viewer');
  pane.innerHTML=`<div class="meas"><b style="font-size:14px;color:var(--text)">● Live session ${esc(s.code)}</b><small>${esc(s.data.file||'')}</small></div>
  ${s.data.locked?`<div class="hint" style="color:#fbbf24;margin-bottom:8px">🔒 ${s.data.host===ST.me?'You locked this session: attendees can view but not change markups.':'The host has made this session view-only.'}</div>`:''}
  <div class="row" style="gap:6px;margin-bottom:10px;flex-wrap:wrap"><button class="btn" id="stuInvite" style="border:1px solid var(--line)">Invite</button><button class="btn" id="stuCopy" style="border:1px solid var(--line)">Copy ID</button><button class="btn" id="stuLeave" style="border:1px solid var(--line)">Leave</button>${s.data.host===ST.me?`<button class="btn" id="stuLock" style="border:1px solid var(--line)">${s.data.locked?'Unlock session':'Lock (view-only)'}</button><button class="btn" id="stuEnd" style="border:1px solid #7f1d1d;color:#fca5a5">End</button>`:''}</div>
  <div class="sec">Attendees (${peers.length})</div>${peers.map(p=>{const id=p.by||p.presence.u;const c=p.presence.c||colorOf(p.peer);return`<div class="chest" data-peer="${esc(p.peer)}"><span class="dot" style="background:${c};border-radius:50%"></span><span class="nm">${esc(nm(id))}${p.isMe?' (you)':''}${p.guest?' · guest':''}<br><small style="color:var(--mut)">${p.presence.p?'Page '+p.presence.p:'idle'}</small></span>${!p.isMe&&p.presence.p?'<button class="btn" data-go style="height:24px;border:1px solid var(--line)">Go to</button>':''}</div>`}).join('')}
  <div class="sec">Chat</div><div id="stuChat" style="max-height:220px;overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px;font-size:12px">${chatHtml(s)}</div>
  <div class="row" style="gap:6px;margin-top:6px"><input class="ti" id="stuMsg" placeholder="Message the session…" maxlength="1000"><button class="btn pri" id="stuSend" style="flex:0">Send</button></div>
  <div class="sec">Activity</div><div id="stuAct" style="font-size:12px">${(s.activity||[]).slice(0,30).map(a=>`<div class="res" ${a.mid?`data-mid="${esc(a.mid)}"`:''}>${esc(a.text)} <small style="color:var(--mut)">${ago(a.at)}</small></div>`).join('')||'<div class="hint">Changes by other attendees show up here.</div>'}</div>
  <div class="sec">Record</div><div id="stuRec">${S.markups.slice().sort((a,b)=>b.modified-a.modified).slice(0,40).map(m=>`<div class="res" data-mid="${m.id}"><span class="dot" style="background:${m.style.stroke}"></span> ${esc(m.subject)} <small style="color:var(--mut)">p${m.page} · ${esc(m.author)} · ${ago(m.modified)}</small></div>`).join('')||'<div class="hint">No markups yet.</div>'}</div>`;
  $('#stuCopy').onclick=async()=>{try{await navigator.clipboard.writeText(s.code);toast('Session ID copied')}catch(e){toast('Session ID: '+s.code)}};
  $('#stuLeave').onclick=()=>leave(true);if($('#stuEnd'))$('#stuEnd').onclick=endSession;
  $('#stuInvite').onclick=async()=>{const t=`Join my PlanMark Studio session "${s.data.name||s.data.file||''}": open PlanMark, go to the Studio tab, and enter session ID ${s.code} (or pick it under Active sessions).`;try{await navigator.clipboard.writeText(t);toast('Invitation copied — paste it into an email or chat')}catch(e){modal('Invite to session',`<div class="hint">Send this to your team:</div><textarea class="ti" rows="4" readonly>${esc(t)}</textarea>`,[{label:'Close',cancel:1}])}};
  if($('#stuLock'))$('#stuLock').onclick=async()=>{try{await ST.db.doc('sessions/'+s.code).update({locked:!s.data.locked});toast(s.data.locked?'Session unlocked':'Session is now view-only for attendees')}catch(e){toast('Could not change the lock')}};
  $('#stuSend').onclick=()=>sendChat();$('#stuMsg').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();sendChat()}};
  $('#stuAct').onclick=e=>{const r=e.target.closest('[data-mid]');const m=r&&byId(r.dataset.mid);if(m){setSel([m.id]);scrollToBox(m.page,bboxOf(m))}};
  const ch=$('#stuChat');if(ch)ch.scrollTop=ch.scrollHeight;
  pane.querySelectorAll('[data-go]').forEach(b=>b.onclick=e=>{const pr=ST.peers.find(p=>p.peer===e.target.closest('[data-peer]').dataset.peer);if(pr&&pr.presence.p)scrollToBox(pr.presence.p,[pr.presence.x,pr.presence.y,pr.presence.x,pr.presence.y])});
  $('#stuRec').onclick=e=>{const r=e.target.closest('[data-mid]');const m=r&&byId(r.dataset.mid);if(m){setSel([m.id]);scrollToBox(m.page,bboxOf(m))}};return}
 const act=ST.list.filter(x=>x.status==='active');
 pane.innerHTML=`<div class="hint" style="margin-bottom:10px">Mark up the same drawing together, live. Everyone with access to this PlanMark link can join.</div>
 <button class="btn pri" id="stuStart" style="width:100%;justify-content:center;height:34px;margin-bottom:6px" ${S.bytes&&ST.assets?'':'disabled'}>Start session with open PDF</button>
 ${!ST.assets?'<div class="hint">Only Editors of this artifact can start sessions; anyone with Contributor access can join.</div>':!S.bytes?'<div class="hint">Open a PDF to start a session.</div>':''}
 <div class="row" style="gap:6px;margin:10px 0"><input class="ti" id="stuCode" placeholder="Session ID" style="text-transform:uppercase"><button class="btn" id="stuJoinC" style="flex:0;border:1px solid var(--line)">Join</button></div>
 <div class="sec">Active sessions</div>${act.map(x=>`<div class="chest" data-sid="${esc(x.id)}"><span class="nm"><b>${esc(x.name||x.file)}</b><br><small style="color:var(--mut)">${esc(x.id)} · ${esc(nm(x.host))} · ${ago(x.created)}</small></span><button class="btn" data-join style="height:26px;border:1px solid var(--line)">Join</button></div>`).join('')||'<div class="hint">No active sessions.</div>'}`;
 $('#stuStart').onclick=startDialog;$('#stuJoinC').onclick=()=>{const c=$('#stuCode').value.trim().toUpperCase();if(c)join(c)};
 pane.querySelectorAll('[data-join]').forEach(b=>b.onclick=e=>join(e.target.closest('[data-sid]').dataset.sid))}
function chatHtml(s){const c=s.chat||[];return c.map(x=>`<div style="margin-bottom:4px"><b style="color:${colorOf(x.by||'')}">${esc(x.by&&ST.names[x.by]&&ST.names[x.by]!=='Someone'?ST.names[x.by]:(x.name||'Someone'))}${x.by===ST.me?' (you)':''}</b> <small style="color:var(--mut)">${ago(x.at)}</small><br>${esc(x.text)}</div>`).join('')||'<div class="hint">No messages yet.</div>'}
async function sendChat(){const s=ST.sess,i=$('#stuMsg');if(!s||!i)return;const text=i.value.trim();if(!text)return;i.value='';const id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 try{await ST.db.doc(`sessions/${s.code}/chat/${id}`).set({by:ST.me,name:settings.author,text,at:Date.now()})}catch(e){i.value=text;toast('Message not sent')}}
function lockBanner(){const s=ST.sess,on=!!(s&&s.data&&s.data.locked&&s.data.host!==ST.me);let b=$('#stuLockBan');
 if(on&&!b){b=document.createElement('div');b.id='stuLockBan';b.style.cssText='position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:20;background:#422006;color:#fde68a;border:1px solid #a16207;border-radius:8px;padding:5px 12px;font-size:12px;pointer-events:none';b.textContent='🔒 View-only session — the host has locked markups';$('#main').appendChild(b)}
 if(!on&&b)b.remove()}
function alertChanges(s,list){if(!list.length)return;s.activity=s.activity||[];for(const a of list)s.activity.unshift(a);s.activity=s.activity.slice(0,60);
 toast(list.length===1?list[0].text:`${list.length} changes from other attendees`)}
/* ---------- sessions ---------- */
function startDialog(){modalPrompt('Start Studio session','Session name',baseName(),name=>start(name))}
async function start(name){if(!S.bytes)return;if(S.bytes.length>20*1024*1024){toast('PDF is over 20 MB — too large for a session');return}
 try{toast('Uploading drawing…');const a=await ST.assets.upload(new Blob([S.bytes],{type:'application/pdf'}));
  const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
  const data={name,file:S.fileName,asset:a.id,host:ST.me,created:Date.now(),status:'active',scales:JSON.parse(JSON.stringify(S.scales))};
  await ST.db.doc('sessions/'+code).set(data);
  for(const m of S.markups)await ST.db.doc(`sessions/${code}/markups/${m.id}`).set(JSON.parse(JSON.stringify(m)));
  await enter(code,data,true);toast('Session '+code+' started — share the ID with your team')}
 catch(e){console.error(e);toast('Could not start session: '+(e.message||e.code||e))}}
async function join(code){if(ST.sess&&ST.sess.code===code)return;
 try{const snap=await ST.db.doc('sessions/'+code).get();if(!snap.exists){toast('No session '+code);return}const data=snap.data();if(data.status!=='active'){toast('That session has ended');return}
  toast('Joining '+code+'…');const r=await fetch('/_blob/'+data.asset);if(!r.ok)throw new Error('Could not download the drawing ('+r.status+')');
  const bytes=new Uint8Array(await r.arrayBuffer());if(ST.sess)leave(false);ST.joining=true;try{await openBytes(bytes,data.file||'Session.pdf',{markups:[],scales:data.scales||{}})}finally{ST.joining=false}
  await enter(code,data,false)}
 catch(e){console.error(e);toast('Could not join: '+(e.message||e.code||e))}}
async function enter(code,data,isHost){const s=ST.sess={code,data,synced:new Map(),q:new Map(),unsub:[],scalesJ:canon(S.scales)};
 if(!s.prevAuthor)s.prevAuthor=settings.author;await nameOf([ST.me]);if(ST.names[ST.me]&&ST.names[ST.me]!=='Someone')settings.author=ST.names[ST.me];
 if(isHost)for(const m of S.markups)s.synced.set(m.id,canon(m));
 s.unsub.push(ST.db.collection(`sessions/${code}/markups`).onSnapshot(snap=>{applyRemote(snap);s.initDone=true},e=>toast('Session sync stopped: '+e.code)));
 s.unsub.push(ST.db.collection(`sessions/${code}/chat`).orderBy('at','desc').limit(200).onSnapshot(snap=>{if(ST.sess!==s)return;const prev=(s.chat||[]).length;s.chat=snap.docs.map(d=>Object.assign({id:d.id},d.data())).reverse();
  nameOf(s.chat.map(x=>x.by)).then(()=>{const el=$('#stuChat');if(el){el.innerHTML=chatHtml(s);el.scrollTop=el.scrollHeight}});const el=$('#stuChat');if(el){el.innerHTML=chatHtml(s);el.scrollTop=el.scrollHeight}
  const last=s.chat[s.chat.length-1];if(s.chatInit&&s.chat.length>prev&&last&&last.by!==ST.me)toast('💬 '+(last.name||'Someone')+': '+String(last.text).slice(0,80));s.chatInit=true},e=>console.warn('chat',e)));
 s.unsub.push(ST.db.doc('sessions/'+code).onSnapshot(d=>{if(!ST.sess||ST.sess!==s)return;const v=d.data();if(!d.exists||v.status!=='active'){toast('The host ended the session');leave(false);return}
  const wasLocked=!!(s.data&&s.data.locked);s.data=v;if(!!v.locked!==wasLocked){render();if(v.host!==ST.me)toast(v.locked?'The host made this session view-only':'The host unlocked the session')}const j=canon(v.scales||{});if(j!==s.scalesJ){s.scalesJ=j;S.scales=JSON.parse(JSON.stringify(v.scales||{}));saveScales();redrawAll();renderList();updateScaleBtn()}}));
 try{s.r=await ST.room.join('pm-'+code.toLowerCase());s.unsub.push(s.r.onPeers(ch=>{ST.peers=ch.peers;nameOf(ch.peers.map(p=>p.by||p.presence.u));redrawCursors();const sig=ch.peers.filter(p=>p.kind==='viewer').map(p=>p.peer+':'+(p.presence.p||'')+':'+(p.by||p.presence.u||'')+':'+(p.guest?1:0)).sort().join('|');if(sig!==s.peerSig){s.peerSig=sig;clearTimeout(s.rt);s.rt=setTimeout(render,150)}}));
  s.r.presence({u:ST.me,c:colorOf(ST.me||Math.random()),p:S.cur,x:null,y:null})}catch(e){console.warn('room',e)}
 switchTab('studio');render()}
function leave(manual){const s=ST.sess;if(!s)return;ST.sess=null;s.unsub.forEach(u=>{try{u()}catch(e){}});try{s.r&&s.r.leave()}catch(e){}ST.peers=[];
 if(s.prevAuthor)settings.author=s.prevAuthor;redrawAll();render();if(manual)toast('Left session — your copy stays open')}
async function endSession(){const s=ST.sess;if(!s)return;try{await ST.db.doc('sessions/'+s.code).update({status:'ended',ended:Date.now()})}catch(e){}leave(false);toast('Session ended')}
/* ---------- sync ---------- */
function applyRemote(snap){const s=ST.sess;if(!s)return;let ch=false;const alerts=[];const lbl=d=>(T[d.type]?T[d.type].label:d.type)+(d.subject&&d.subject!==(T[d.type]&&T[d.type].label)?' ('+d.subject+')':'');
 for(const c of snap.docChanges()){const id=c.doc.id;
  if(c.type==='removed'){if(s.synced.has(id)){s.synced.delete(id);const i=S.markups.findIndex(m=>m.id===id);if(i>=0){const old=S.markups[i];if(s.initDone)alerts.push({text:`Someone removed ${lbl(old)} on p${old.page}`,at:Date.now()});S.markups.splice(i,1);S.sel.delete(id);ch=true}}continue}
  const d=c.doc.data();if(!d||!d.type)continue;const j=canon(d);if(s.synced.get(id)===j)continue;
  const busy=G&&((G.m&&G.m.id===id)||(G.orig&&G.orig.has&&G.orig.has(id)));if(busy)continue;
  const existed=s.synced.has(id);s.synced.set(id,j);const m=JSON.parse(JSON.stringify(d));m.id=id;const i=S.markups.findIndex(x=>x.id===id);if(s.initDone)alerts.push({text:`${d.author||'Someone'} ${existed||i>=0?'edited':'added'} ${lbl(d)} on p${d.page}`,at:Date.now(),mid:id});if(i>=0)S.markups[i]=m;else S.markups.push(m);ch=true}
 if(ch){redrawAll();clearTimeout(lT);lT=setTimeout(renderList,60);if(!$('#props').contains(document.activeElement))renderProps();clearTimeout(s.rt);s.rt=setTimeout(render,200);
  clearTimeout(sT);sT=setTimeout(()=>{if(S.fileKey)LS.set(S.fileKey,{markups:S.markups,scales:S.scales})},400)}
 alertChanges(s,alerts)}
function write(id,fn){const s=ST.sess;const prev=s.q.get(id)||Promise.resolve();const p=prev.then(fn).catch(e=>{console.warn('sync',e);if(e&&e.code==='invalid_argument'&&!s.warned){s.warned=1;toast("You can view this session but don't have permission to change it")}});s.q.set(id,p)}
let pT=0;
function push(){const s=ST.sess;if(!s)return;
 if(s.data&&s.data.locked&&s.data.host!==ST.me){const cur=canon(S.markups.map(m=>m.id).sort()),changed=S.markups.some(m=>s.synced.get(m.id)!==canon(m))||S.markups.length!==s.synced.size;
  if(changed){S.markups=[...s.synced.entries()].map(([id,j])=>Object.assign(JSON.parse(j),{id}));S.sel=new Set([...S.sel].filter(id=>s.synced.has(id)));redrawAll();clearTimeout(lT);lT=setTimeout(renderList,60);renderProps();toast('This session is view-only — your change was not saved')}return}
 const cur=new Map(S.markups.map(m=>[m.id,m]));
 for(const[id,m]of cur){const j=canon(m);if(s.synced.get(id)!==j){s.synced.set(id,j);const body=JSON.parse(JSON.stringify(m));write(id,()=>ST.db.doc(`sessions/${s.code}/markups/${id}`).set(body))}}
 for(const id of[...s.synced.keys()])if(!cur.has(id)){s.synced.delete(id);write(id,()=>ST.db.doc(`sessions/${s.code}/markups/${id}`).delete())}
 const sj=canon(S.scales);if(sj!==s.scalesJ){s.scalesJ=sj;const sc=JSON.parse(JSON.stringify(S.scales));write('__scales',()=>ST.db.doc('sessions/'+s.code).update({scales:sc}))}
 clearTimeout(s.rt);s.rt=setTimeout(render,300)}
H.change.push(()=>{if(!ST.sess)return;clearTimeout(pT);pT=setTimeout(push,250)});
H.open.push(()=>{if(ST.sess&&!ST.joining)leave(false);render()});
/* ---------- live cursors ---------- */
let raf=0,lastP=null;
viewer.addEventListener('pointermove',e=>{const s=ST.sess;if(!s||!s.r)return;const p=pageFromEvent(e);if(!p)return;const q=toPt(e,p);lastP={p:p.num,x:Math.round(q[0]*10)/10,y:Math.round(q[1]*10)/10};
 if(!raf)raf=requestAnimationFrame(()=>{raf=0;try{s.r.presence(lastP)}catch(_){}})});
viewer.addEventListener('scroll',()=>{const s=ST.sess;if(s&&s.r&&!lastP){try{s.r.presence({p:S.cur})}catch(_){}}},{passive:true});
let curT=0;function redrawCursors(){clearTimeout(curT);curT=setTimeout(()=>{const pg=new Set();ST.peers.forEach(p=>{if(p.presence&&p.presence.p)pg.add(p.presence.p)});(ST.lastCurPages||[]).forEach(n=>pg.add(n));ST.lastCurPages=[...pg];pg.forEach(n=>redrawPage(n))},30)}
H.over.push(n=>{if(!ST.sess)return'';let h='';const k=1/S.zoom;
 for(const p of ST.peers){if(p.isMe||p.kind!=='viewer')continue;const pr=p.presence||{};if(pr.p!==n||pr.x==null)continue;const c=pr.c||colorOf(p.peer),name=nm(p.by||pr.u);
  h+=`<g transform="translate(${pr.x} ${pr.y}) scale(${k})" pointer-events="none"><path d="M0 0 L0 16 L4.5 12 L7.5 19 L10 18 L7 11 L13 11 Z" fill="${c}" stroke="#fff" stroke-width="1.2"/><rect x="14" y="14" rx="3" width="${name.length*6.6+10}" height="17" fill="${c}"/><text x="19" y="26.5" font-size="11" fill="#fff" font-family="Helvetica,Arial,sans-serif">${esc(name)}</text></g>`}
 return h});
/* ---------- boot ---------- */
H.ready.push(async()=>{addTab('studio','Studio');render();
 if(!(window.claude&&typeof window.claude.use==='function')){ST.checked=true;render();return}
 const use=n=>Promise.resolve(window.claude.use(n)).catch(()=>null);
 [ST.db,ST.room,ST.user,ST.assets]=await Promise.all([use('db'),use('room'),use('user'),use('assets')]);
 ST.avail=!!(ST.db&&ST.room);ST.checked=true;
 if(ST.user){try{ST.me=await ST.user.id();ST.canEdit=!!(await ST.user.canEdit());await nameOf([ST.me]);if(settings.author==='User'&&ST.names[ST.me]&&ST.names[ST.me]!=='Someone'){settings.author=ST.names[ST.me];LS.set('pm:settings',settings)}}catch(e){}}
 render();
 if(ST.db){const t=setTimeout(()=>{if(!ST.list.length){const pane=$('#pane-studio');}},10000);
  ST.db.collection('sessions').orderBy('created','desc').limit(25).onSnapshot(snap=>{clearTimeout(t);ST.list=snap.docs.map(d=>Object.assign({id:d.id},d.data()));nameOf(ST.list.map(x=>x.host)).then(()=>{if(!ST.sess)render()});if(!ST.sess)render()},e=>console.warn('sessions',e))}});
window.PMStudio={ST,join,leave};
H.ribbon.push({label:'Studio',title:'Live shared markup sessions',icon:'<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c.6-3 2.6-5 5-5s4.4 2 5 5M11 19c.6-3 2.6-5 5-5s4.4 2 5 5"/>',fn:()=>switchTab('studio')});
})();
