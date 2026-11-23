/* PlanMark — Windows app saving like a desktop program (QA6):
   Ctrl+S saves back to the same PDF on disk, Ctrl+Shift+S is Save As, unsaved changes show "*" on the tab and are
   asked about when a tab or the window closes, and a crash-recovery copy of each document's markups is kept on disk. */
(function(){
const dv=window.pmDesktop;if(!dv||!dv.saveFile)return;
const REG='pm:qa6:docs';let R=LS.get(REG,{})||{};
const QA={capture:null,saving:false,allowUnload:false,pend:{},baseOverride:null,recovered:{}};window.PMQA6=QA;
// defaults other modules fill in on open (empty form state etc.) are not changes
function prune(v){if(Array.isArray(v))return v.length?v:undefined;if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort()){const x=prune(v[k]);if(x!==undefined)o[k]=x}return Object.keys(o).length?o:undefined}
 return v===null||v===false||v===''?undefined:v}
const sig=(m,s)=>JSON.stringify({m:m||[],s:prune(s||{})||{}});
const curSig=()=>sig(S.markups,S.scales);
const ent=k=>R[k]||(R[k]={});
function saveReg(){const ks=Object.keys(R);if(ks.length>300){ks.sort((a,b)=>(R[a].t||0)-(R[b].t||0)).slice(0,ks.length-300).forEach(k=>delete R[k])}LS.set(REG,R)}
function persist(k,data){const e=ent(k);e.t=Date.now();saveReg();try{dv.recoveryPut(k,JSON.stringify({t:e.t,entry:e,data:data||{markups:S.markups,scales:S.scales}}))}catch(err){}}

/* ---- crash recovery: a newer copy on disk than what localStorage kept means the app did not close normally */
try{for(const r of dv.recoveryAll()){let o;try{o=JSON.parse(r.json)}catch(e){continue}const k=r.key,cur=R[k];
 if(cur&&(cur.t||0)>=(o.t||0))continue;
 try{LS.set(k,o.data)}catch(e){}R[k]=Object.assign({},o.entry||{},{t:o.t});if(R[k].dirty)QA.recovered[k]=1}saveReg()}catch(e){console.warn('recovery',e)}

/* ---- where each open document lives on disk */
function track(name,p){if(!p||!/\.pdf$/i.test(p))return;QA.pend[name]=p;try{dv.trackPath(p)}catch(e){}}
const _of=openFile;openFile=async function(f){try{if(f&&dv.pathForFile){const p=dv.pathForFile(f);if(p)track(f.name,p)}}catch(e){}return _of.apply(this,arguments)};
H.ready.push(()=>{try{dv.onOpenFile(f=>{if(f&&f.path)track(f.name,f.path)})}catch(e){}});
// Reopening a document that had unsaved changes when the app last stopped (crash, update) brings those changes back
const _ob=openBytes;openBytes=async function(bytes,name,restored){
 if(restored&&bytes&&name){const k='pm:doc:'+name+':'+bytes.length,e=R[k],ls=LS.get(k,null);
  if(e&&e.dirty&&ls&&sig(ls.markups,ls.scales)!==sig(restored.markups,restored.scales)){QA.baseOverride=sig(restored.markups,restored.scales);if(QA.recovered[k])QA.recoveredNow=k;restored=ls}}
 return _ob.call(this,bytes,name,restored)};
H.open.push(o=>{const k=S.fileKey;if(!k)return;const e=ent(k),p=QA.pend[S.fileName];delete QA.pend[S.fileName];
 const rest=o&&o.restored;
 if(p){e.path=p;e.base=QA.baseOverride||(rest?sig(rest.markups,rest.scales):sig([],{}))}   // fresh from disk: the file is the truth
 else{if(e.path)try{dv.trackPath(e.path)}catch(err){}if(e.base==null)e.base=QA.baseOverride||(rest?sig(rest.markups,rest.scales):curSig())}
 QA.baseOverride=null;e.name=S.fileName;e.dirty=curSig()!==e.base;persist(k);
 if(QA.recoveredNow===k||(QA.recovered[k]&&e.dirty)){delete QA.recovered[k];QA.recoveredNow=null;setTimeout(()=>toast('Recovered unsaved changes to '+S.fileName+' from your last session'),900)}
 refresh()});

/* ---- dirty tracking */
let cT=0;H.change.push(()=>{clearTimeout(cT);cT=setTimeout(onChange,200)});
function onChange(){const k=S.fileKey;if(!k||!S.pdf)return;const e=R[k];if(!e||e.base==null)return;const d=curSig()!==e.base;e.dirty=d;e.name=S.fileName;persist(k);refresh()}
function openDocs(){const V=window.PMViews,out=[];const tabs=(V&&V.tabs)||[];
 for(const t of tabs){const cur=t.id===V.curTab,k=cur?S.fileKey:(t.st&&t.st.fileKey);if(k)out.push({tid:t.id,key:k,name:t.name||(cur?S.fileName:''),cur})}
 if(!tabs.length&&S.fileKey)out.push({tid:null,key:S.fileKey,name:S.fileName,cur:true});return out}
const isDirty=k=>!!(R[k]&&R[k].dirty);
let lastSent='';
function refresh(){const docs=openDocs(),names=docs.filter(d=>isDirty(d.key)).map(d=>d.name);
 const s=JSON.stringify(names);if(s!==lastSent){lastSent=s;try{dv.setDirty(names)}catch(e){}}
 for(const d of docs){const el=d.tid!=null&&document.querySelector(`#tabBar .dtab[data-tid="${d.tid}"]`);if(el)el.classList.toggle('qa6dirty',isDirty(d.key))}
 const cur=docs.find(d=>d.cur);if(cur&&S.fileName){const want=(isDirty(cur.key)?'*':'')+S.fileName+' — PlanMark';if(document.title!==want&&/PlanMark$/.test(document.title))document.title=want}}
const st=document.createElement('style');st.textContent='#tabBar .dtab.qa6dirty .nm::after{content:" *";font-weight:700}';document.head.appendChild(st);
H.ready.push(()=>{const bar=$('#tabBar');if(bar)new MutationObserver(()=>refresh()).observe(bar,{childList:true});setInterval(refresh,1500)});

/* ---- Save (same file) and Save As */
const SF0=()=>QA.sf0;
const _fdl=fallbackDL;fallbackDL=function(name,data){if(QA.capture&&/\.pdf$/i.test(name)){QA.capture.data=data;return}return _fdl.apply(this,arguments)};
const _gdl=getDL;getDL=function(){return QA.capture?Promise.resolve(null):_gdl.apply(this,arguments)};
async function build(){QA.capture={};QA.saving=true;try{await QA.ex(false);const d=QA.capture.data;if(!d)return null;return new Uint8Array(await (d instanceof Blob?d:new Blob([d])).arrayBuffer())}finally{QA.capture=null;QA.saving=false}}
function readOnly(){const b=$('#d3Ro');return !!(b&&b.offsetParent!==null)}
async function save(asNew){if(!S.bytes||QA.saving)return false;const k=S.fileKey,e=ent(k),name=S.fileName||'document.pdf';
 let path=!asNew&&e.path;if(path&&readOnly()){toast('This is a read-only copy — choose where to save your own copy');path=null}
 let bytes;try{bytes=await build()}catch(err){toast('Could not build the PDF: '+(err.message||err));return false}if(!bytes)return false;
 let r;if(path){r=await dv.saveFile(path,bytes)}else{r=await dv.saveFileAs({name:/\.pdf$/i.test(name)?name:name+'.pdf',path:e.path||'',bytes});if(r&&r.canceled)return false}
 if(!r||!r.ok){const why=(r&&r.reason)||'unknown error';
  return new Promise(res=>modal('Could not save',`<div>PlanMark couldn't save <b>${esc(path||name)}</b>: ${esc(why)}.</div><div class="hint" style="margin-top:6px">Your markups are safe in PlanMark. Use Save As to save a copy somewhere else.</div>`,[{label:'Cancel',cancel:1,fn:()=>res(false)},{label:'Save As…',pri:1,fn:()=>{setTimeout(()=>save(true).then(res),50)}}]))}
 const s=curSig();if(S.fileKey===k){e.base=s;e.dirty=false}
 if(r.path&&r.path!==e.path){e.path=r.path;const nm=r.name||r.path.split(/[\\/]/).pop();if(nm&&nm!==S.fileName&&S.fileKey===k){S.fileName=nm;e.name=nm;try{const V=window.PMViews,t=(V.tabs||[]).find(t=>t.id===V.curTab);if(t)t.name=nm;const el=document.querySelector(`#tabBar .dtab[data-tid="${V.curTab}"] .nm`);if(el)el.textContent=nm}catch(err){}document.title=nm+' — PlanMark'}}
 persist(k);refresh();toast('Saved '+(r.path||name));return true}
QA.save=save;
// Every Save (Ctrl+S, Save button, File ▸ Save, list Ctrl+S) goes through exportPDF(false); other modules that call exportPDF
// to build bytes for themselves swap saveFile first, so those pass straight through.
H.ready.push(()=>{QA.sf0=window.saveFile;QA.ex=exportPDF;exportPDF=async function(flat){if(flat||QA.saving||window.saveFile!==QA.sf0)return QA.ex.apply(this,arguments);return save(false)}});
addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!e.shiftKey||e.altKey||e.code!=='KeyS')return;if(modalCb)return;e.preventDefault();e.stopImmediatePropagation();if(S.bytes)save(true)},true);
// Ctrl+S also works while the cursor is in a box (page number, a Properties field…): the box's value is applied first
addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.shiftKey||e.altKey||e.code!=='KeyS'||modalCb)return;const t=e.target;
 if(!(t&&t.closest&&t.closest('input,textarea,select,[contenteditable]'))||t.closest('#modal'))return;e.preventDefault();e.stopImmediatePropagation();
 try{t.blur()}catch(err){}setTimeout(()=>{if(S.bytes)exportPDF(false)},60)},true);
// File ▸ Save As… right under Save (the command list is built a moment after start-up, and again if rebuilt)
function addCmd(){try{const W=window.PMWorkspace,C=W&&W.CMDS;if(!C||!C.length||C.some(c=>c.id==='saveas'))return;const i=C.findIndex(c=>c.id==='save');
 C.splice(i<0?C.length:i+1,0,{id:'saveas',menu:'File',label:'Save As…',key:'Ctrl+Shift+S',run:()=>{if(S.bytes)save(true)}})}catch(e){}}
H.ready.push(()=>{addCmd();setInterval(addCmd,1000)});

/* ---- closing a tab with unsaved changes */
function revert(k){const e=R[k];if(!e||e.base==null)return;let b;try{b=JSON.parse(e.base)}catch(err){return}const data={markups:b.m||[],scales:b.s||{}};
 if(!b.m.length&&!Object.keys(b.s||{}).length)localStorage.removeItem(k);else LS.set(k,data);e.dirty=false;persist(k,data)}
function ask(name){return new Promise(res=>modal('PlanMark',`<div>Save changes to <b>${esc(name)}</b> before closing?</div><div class="hint" style="margin-top:6px">Your changes will be lost if you don't save them.</div>`,
 [{label:'Save',pri:1,fn:()=>res('save')},{label:"Don't Save",fn:()=>res('discard')},{label:'Cancel',cancel:1,fn:()=>res('cancel')}]))}
async function guardClose(tid){const V=window.PMViews;const d=openDocs().find(x=>x.tid===tid);if(!d||!isDirty(d.key))return true;
 if(V.curTab!==tid){V.switchTo(tid);await new Promise(r=>setTimeout(r,200))}
 const a=await ask(d.name);if(a==='cancel')return false;if(a==='discard'){revert(d.key);return true}return save(false)}
H.ready.push(()=>{const V=window.PMViews;if(!V||!V.closeTab)return;const raw=V.closeTab;V.closeTabNow=raw;
 V.closeTab=async function(id){if(id==null)return;if(await guardClose(id))return raw(id)};
 addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey;if(!mod||e.shiftKey||e.altKey||!(e.key==='w'||e.key==='W'||e.key==='F4'))return;
  if(e.target.closest&&e.target.closest('textarea,[contenteditable],#modal'))return;if(modalCb||V.curTab==null)return;try{if(e.target.blur)e.target.blur()}catch(err){}e.preventDefault();e.stopImmediatePropagation();V.closeTab(V.curTab)},true);
 document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('#tabBar [data-close]');if(!c)return;e.stopPropagation();e.preventDefault();V.closeTab(+c.dataset.close)},true);
 document.addEventListener('auxclick',e=>{if(e.button!==1)return;const t=e.target.closest&&e.target.closest('#tabBar [data-tid]');if(!t)return;e.stopPropagation();e.preventDefault();V.closeTab(+t.dataset.tid)},true)});

/* ---- closing the window: the app asks Save / Don't Save / Cancel, the page does the work */
addEventListener('beforeunload',e=>{if(QA.allowUnload)return;if(openDocs().some(d=>isDirty(d.key))){e.preventDefault();e.returnValue=''}});
try{dv.onCloseRequest(async a=>{const dirty=openDocs().filter(d=>isDirty(d.key));
 if(a==='discard'){dirty.forEach(d=>revert(d.key))}
 else if(a==='save'){for(const d of dirty){const V=window.PMViews;if(d.tid!=null&&V.curTab!==d.tid){V.switchTo(d.tid);await new Promise(r=>setTimeout(r,250))}if(!await save(false)){refresh();return}}}
 else return;
 QA.allowUnload=true;refresh();setTimeout(()=>dv.closeWindow(),50)})}catch(e){}

/* ---- menus from the keyboard, the Windows way: tap Alt, then the letter (Alt, F = File); arrows, Enter and Esc work in
   open menus. Alt+letter itself stays with PlanMark's Revu-style panel shortcuts (Alt+T Thumbnails, Alt+L Markups list…). */
const menus=()=>[...document.querySelectorAll('#wsMenu .wm[data-m]')].filter(x=>x.offsetParent!==null);
let arm=false,altOnly=false;
function setArm(on){arm=on;const b=$('#wsMenu');if(!b)return;b.classList.toggle('qa6arm',on);
 if(on)for(const m of menus())if(!m.querySelector('.qa6ak')){const t=m.textContent;m.innerHTML=`<span class="qa6ak">${esc(t.slice(0,1))}</span>${esc(t.slice(1))}`}}
function drops(){return [...document.querySelectorAll('.wsDrop')]}
function items(d){return d?[...d.querySelectorAll('.wsI:not(.dis)')]:[]}
function hl(d,k){const it=items(d);if(!it.length)return;let i=it.findIndex(x=>x.classList.contains('qa6hl'));it.forEach(x=>x.classList.remove('qa6hl'));
 i=k==='first'?0:k==='last'?it.length-1:(i<0?(k>0?0:it.length-1):(i+k+it.length)%it.length);it[i].classList.add('qa6hl');it[i].scrollIntoView({block:'nearest'})}
function openTop(el){if(!el)return;if(!el.classList.contains('on'))el.click();setTimeout(()=>{const d=document.querySelector('.wsDrop:not(.subm)');if(d)hl(d,'first')},0)}
const stop=e=>{e.preventDefault();e.stopImmediatePropagation()};
addEventListener('keydown',e=>{
 if(e.key==='Alt'){altOnly=!e.ctrlKey&&!e.shiftKey&&!e.metaKey;return}
 altOnly=false;
 const ds=drops(),main=ds.find(d=>!d.classList.contains('subm')),sub=ds.find(d=>d.classList.contains('subm'));
 if(arm&&!main){setArm(false);if(e.ctrlKey||e.altKey||e.metaKey)return;
  if(e.key==='Escape'){stop(e);return}
  if(/^Key[A-Z]$/.test(e.code||'')){const L=e.code.slice(3),el=menus().find(x=>x.textContent.trim().toUpperCase().startsWith(L));if(el){stop(e);openTop(el)}return}
  if(e.key==='ArrowDown'||e.key==='Enter'){stop(e);openTop(menus()[0])}return}
 if(!main||modalCb)return;
 const cur=sub&&items(sub).some(x=>x.classList.contains('qa6hl'))?sub:main,ms=menus(),on=ms.findIndex(x=>x.classList.contains('on'));
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){stop(e);hl(cur,e.key==='ArrowDown'?1:-1);return}
 if(e.key==='Home'||e.key==='End'){stop(e);hl(cur,e.key==='Home'?'first':'last');return}
 if(e.key==='Enter'||e.key===' '){const h=cur.querySelector('.qa6hl');if(h){stop(e);h.click();if(h.classList.contains('sub'))setTimeout(()=>{const s2=document.querySelector('.wsDrop.subm');if(s2)hl(s2,'first')},0)}return}
 if(e.key==='ArrowRight'){stop(e);const h=cur.querySelector('.qa6hl');if(cur===main&&h&&h.classList.contains('sub')){h.click();setTimeout(()=>{const s2=document.querySelector('.wsDrop.subm');if(s2)hl(s2,'first')},0)}else if(on>=0)openTop(ms[(on+1)%ms.length]);return}
 if(e.key==='ArrowLeft'){stop(e);if(cur===sub){sub.remove();return}if(on>=0)openTop(ms[(on-1+ms.length)%ms.length]);return}
},true);
addEventListener('keyup',e=>{if(e.key!=='Alt')return;const go=altOnly;altOnly=false;if(!go||modalCb||!menus().length)return;
 if(drops().length){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));setArm(false);return}
 e.preventDefault();setArm(!arm)},true);
addEventListener('pointerdown',()=>{altOnly=false;if(arm)setArm(false)},true);
addEventListener('blur',()=>{altOnly=false;setArm(false)});
st.textContent+='#wsMenu.qa6arm .qa6ak{text-decoration:underline;text-underline-offset:2px}#wsMenu.qa6arm .wm:first-child{outline:1px solid var(--acc);outline-offset:-1px}.wsDrop .wsI.qa6hl{background:var(--acc);color:#fff}';

/* ---- PDFs dropped anywhere in the window open (not only on the page area) */
addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
addEventListener('drop',e=>{if(e.defaultPrevented)return;const fs=[...((e.dataTransfer&&e.dataTransfer.files)||[])].filter(f=>/\.pdf$/i.test(f.name));if(!fs.length)return;e.preventDefault();fs.forEach((f,i)=>setTimeout(()=>openFile(f),i*400))});
})();
