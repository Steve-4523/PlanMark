/* PlanMark — desktop (Windows app) integration: open-with files and live updates */
(function(){
if(!window.pmDesktop)return;
function banner(st){let b=$('#pmUpd');if(!b){b=document.createElement('div');b.id='pmUpd';b.style.cssText='position:fixed;right:14px;bottom:40px;z-index:70;background:var(--panel);border:1px solid var(--acc);border-radius:10px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;gap:10px;align-items:center;max-width:360px';document.body.appendChild(b)}
 b.innerHTML=`<div style="flex:1"><b>PlanMark ${esc(st.version)} is ready</b>${st.notes?`<div class="hint" style="font-size:11.5px">${esc(st.notes)}</div>`:''}<div class="hint" style="font-size:11px">Your work is saved. Reload to update.</div></div><button class="btn pri" id="pmUpdGo">Reload</button><button class="btn" id="pmUpdX" title="Later">✕</button>`;
 $('#pmUpdGo').onclick=()=>{try{if(window.PMAccount&&PMAccount.AC.user)PMAccount.push()}catch(e){}setTimeout(()=>window.pmDesktop.reload(),300)};$('#pmUpdX').onclick=()=>b.remove()}
H.ready.push(()=>{try{window.pmDesktop.onOpenFile(f=>{if(f&&f.bytes)openBytes(new Uint8Array(f.bytes),f.name||'Document.pdf')})}catch(e){console.warn(e)}
 try{window.pmDesktop.onUpdateReady&&window.pmDesktop.onUpdateReady(st=>{if(st&&st.state==='ready')banner(st)})}catch(e){}
 const b=$('.brand');if(b)b.title='PlanMark for Windows '+(window.pmDesktop.version||'')+' · app '+(window.pmDesktop.webVersion||'')});
})();
