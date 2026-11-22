/* PlanMark — desktop (Windows app) integration: open-with files and live updates */
(function(){
if(!window.pmDesktop)return;
function banner(st){let b=$('#pmUpd');if(!b){b=document.createElement('div');b.id='pmUpd';b.style.cssText='position:fixed;right:14px;bottom:40px;z-index:70;background:var(--panel);border:1px solid var(--acc);border-radius:10px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;gap:10px;align-items:center;max-width:360px';document.body.appendChild(b)}
 b.innerHTML=`<div style="flex:1"><b>PlanMark ${esc(st.version)} is ready</b>${st.notes?`<div class="hint" style="font-size:11.5px">${esc(st.notes)}</div>`:''}<div class="hint" style="font-size:11px">Your work is saved. Reload to update.</div></div><button class="btn pri" id="pmUpdGo">Reload</button><button class="btn" id="pmUpdX" title="Later">✕</button>`;
 $('#pmUpdGo').onclick=()=>{try{if(window.PMAccount&&PMAccount.AC.user)PMAccount.push()}catch(e){}setTimeout(()=>window.pmDesktop.reload(),300)};$('#pmUpdX').onclick=()=>b.remove()}

/* Automatic updates: apply as soon as the user pauses (not mid-drawing, typing, or in a dialog). */
let lastAct=Date.now(),pend=null,tries=0;
['pointerdown','pointermove','keydown','wheel'].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now()},true));
function busy(){const a=document.activeElement;
 return (window.S&&(S.drawing||S.countId))||(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))||
  !!document.querySelector('#modalBg.on, dialog[open]')||Date.now()-lastAct<2500}
function applySoon(st){pend=st;tries=0;tick()}
function tick(){if(!pend)return;if(localStorage.getItem('pm:upd:auto')==='0')return banner(pend);
 if(busy()&&tries++<240)return setTimeout(tick,1000);   // wait for a pause, up to ~4 minutes
 try{if(window.S&&S.fileKey&&typeof saveScales==='function')saveScales()}catch(e){}
 try{if(window.PMAccount&&PMAccount.AC.user)PMAccount.push()}catch(e){}
 try{localStorage.setItem('pm:upd:resume',JSON.stringify({at:Date.now(),notes:pend.notes||''}))}catch(e){}
 setTimeout(()=>window.pmDesktop.reload(),250)}
H.ready.push(()=>{try{window.pmDesktop.onOpenFile(f=>{if(f&&f.bytes)openBytes(new Uint8Array(f.bytes),f.name||'Document.pdf')})}catch(e){console.warn(e)}
 try{window.pmDesktop.onUpdateReady&&window.pmDesktop.onUpdateReady(st=>{if(st&&st.state==='ready')applySoon(st)})}catch(e){}
 // Coming back from an automatic update: reopen the same files (page and zoom come back per file).
 try{const r=JSON.parse(localStorage.getItem('pm:upd:resume')||'null');localStorage.removeItem('pm:upd:resume');
  if(r&&Date.now()-r.at<120000){if(window.PMWorkspace)PMWorkspace.P.reopenLast=true;setTimeout(()=>toast('Updated to PlanMark '+(window.pmDesktop.webVersion||'')+(r.notes?' — '+r.notes:'')),1500)}}catch(e){}
 const b=$('.brand');if(b)b.title='PlanMark for Windows '+(window.pmDesktop.version||'')+' · app '+(window.pmDesktop.webVersion||'')});
})();
