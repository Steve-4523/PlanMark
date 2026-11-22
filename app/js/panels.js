/* PlanMark — view panels, bookmarks, measurements, recent files, view modes, workspace profiles */
(function(){
const PANELS=[['pages','Thumbnails'],['bookmarks','Bookmarks'],['search','Search'],['chest','Tool Chest'],['measure','Measurements'],['layers','Layers'],['sets','Sets'],['files','File Access'],['studio','Studio']];
const DEF_LAYOUT={tabs:Object.fromEntries(PANELS.map(([k])=>[k,true])),left:true,right:true,list:true,listH:210,mode:'continuous',labels:true,canvas:'#50565f',tab:'pages'};
let L=Object.assign(clone(DEF_LAYOUT),LS.get('pm:layout',{}));L.tabs=Object.assign({},DEF_LAYOUT.tabs,L.tabs||{});
const css=document.createElement('style');document.head.appendChild(css);
function apply(){const m=innerWidth<=820;
 $$('#left .tabs button').forEach(b=>{b.style.display=L.tabs[b.dataset.tab]===false?'none':''});
 if(!m){$('#left').classList.toggle('hide',!L.left);$('#right').classList.toggle('hide',!L.right)}
 $('#mlist').style.height=$('#mlist').classList.contains('col')?'':L.listH+'px';if(!m)$('#mlist').style.display=L.list?'':'none';
 css.textContent=`#viewer{background:${L.canvas}}${L.labels?'':'.tb span{display:none}.tb{height:36px}'}${L.mode==='single'?'#pages .page:not(.curp){display:none}':''}`;
 $$('#pages .page').forEach(el=>el.classList.toggle('curp',+el.dataset.p===S.cur));scheduleRender()}
function save(){LS.set('pm:layout',L);apply()}
window.PMLayout={get:()=>L,set:v=>{L=Object.assign(clone(DEF_LAYOUT),v);L.tabs=Object.assign({},DEF_LAYOUT.tabs,v.tabs||{});save()}};
// keep single-page mode in step with navigation
const _uc=updateCurUI;updateCurUI=function(){_uc.apply(this,arguments);if(L.mode==='single')$$('#pages .page').forEach(el=>el.classList.toggle('curp',+el.dataset.p===S.cur))};
document.addEventListener('keydown',e=>{if(L.mode!=='single'||e.target.closest('input,textarea,select')||modalCb)return;if(e.key==='ArrowRight'&&!S.sel.size){gotoPage(S.cur+1,true)}if(e.key==='ArrowLeft'&&!S.sel.size){gotoPage(S.cur-1,true)}});
// track panel toggles made with the top-bar buttons
$('#bLeft').addEventListener('click',()=>{L.left=!$('#left').classList.contains('hide');LS.set('pm:layout',L)});
$('#bRight').addEventListener('click',()=>{L.right=!$('#right').classList.contains('hide');LS.set('pm:layout',L)});
// resizable markups list
function listResizer(){const h=document.createElement('div');h.style.cssText='height:5px;margin-top:-3px;cursor:ns-resize;position:relative;z-index:5';$('#mlist').before(h);
 h.addEventListener('pointerdown',e=>{e.preventDefault();const y0=e.clientY,h0=$('#mlist').offsetHeight;const mv=ev=>{L.listH=clamp(h0-(ev.clientY-y0),80,innerHeight*.7);$('#mlist').style.height=L.listH+'px'};const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);save()};addEventListener('pointermove',mv);addEventListener('pointerup',up)})}
// ---------- View dialog ----------
function viewDialog(){const prof=LS.get('pm:profiles',{});
 modal('View & panels',`<div class="sec" style="margin-top:0">Panels</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${PANELS.map(([k,l])=>`<label class="chk"><input type="checkbox" data-tb="${k}" ${L.tabs[k]!==false?'checked':''}> ${l}</label>`).join('')}
  <label class="chk"><input type="checkbox" id="vwR" ${L.right?'checked':''}> Properties</label><label class="chk"><input type="checkbox" id="vwM" ${L.list?'checked':''}> Markups list</label><label class="chk"><input type="checkbox" id="vwLft" ${L.left?'checked':''}> Side panel</label><label class="chk"><input type="checkbox" id="vwLb" ${L.labels?'checked':''}> Toolbar labels</label></div>
  <div class="sec">Page display</div><div class="row fld"><select class="ti" id="vwMode"><option value="continuous" ${L.mode!=='single'?'selected':''}>Continuous (scroll through pages)</option><option value="single" ${L.mode==='single'?'selected':''}>Single page (← → to flip)</option></select>
  <div style="flex:0 0 110px"><input type="color" id="vwBg" value="${L.canvas}" title="Background"></div></div>
  <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" id="vwFs">Full screen</button><button class="btn" style="border:1px solid var(--line)" id="vwRst">Reset layout</button></div>
  <div class="sec">Profiles</div><div class="hint" style="margin-bottom:6px">A profile saves this whole workspace — panels, view, snap/grid, and tool defaults — so you can switch between setups (e.g. "Estimating", "Review"). Profiles follow your login.</div>
  <div class="row" style="gap:6px"><select class="ti" id="vwP">${Object.keys(prof).map(n=>`<option>${esc(n)}</option>`).join('')||'<option value="">No saved profiles</option>'}</select><button class="btn" id="vwPL" style="flex:0;border:1px solid var(--line)">Load</button><button class="btn" id="vwPD" style="flex:0;border:1px solid var(--line)">Delete</button></div>
  <div class="row" style="gap:6px;margin-top:6px"><input class="ti" id="vwPN" placeholder="New profile name"><button class="btn" id="vwPS" style="flex:0;border:1px solid var(--line)">Save current</button></div>`,
 [{label:'Close',cancel:1},{label:'Apply',pri:1,fn:md=>{md.querySelectorAll('[data-tb]').forEach(c=>L.tabs[c.dataset.tb]=c.checked);L.right=md.querySelector('#vwR').checked;L.list=md.querySelector('#vwM').checked;L.left=md.querySelector('#vwLft').checked;L.labels=md.querySelector('#vwLb').checked;L.mode=md.querySelector('#vwMode').value;L.canvas=md.querySelector('#vwBg').value;save();if(L.mode==='single')gotoPage(S.cur,true)}}]);
 $('#vwFs').onclick=()=>{closeModal();try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(e){toast('Full screen not available here')}};
 $('#vwRst').onclick=()=>{L=clone(DEF_LAYOUT);closeModal();save()};
 $('#vwPS').onclick=()=>{const n=$('#vwPN').value.trim();if(!n)return;const p=LS.get('pm:profiles',{});p[n]={layout:clone(L),snap:clone(window.PMSnap||{}),defaults:clone(S.defaults),settings:{wheelZoom:settings.wheelZoom},saved:Date.now()};LS.set('pm:profiles',p);closeModal();toast('Profile "'+n+'" saved')};
 $('#vwPL').onclick=()=>{const n=$('#vwP').value,p=LS.get('pm:profiles',{})[n];if(!p)return;loadProfile(n,p);closeModal()};
 $('#vwPD').onclick=()=>{const n=$('#vwP').value,p=LS.get('pm:profiles',{});if(!p[n])return;delete p[n];LS.set('pm:profiles',p);closeModal();toast('Deleted')}}
function loadProfile(n,p){if(p.layout){L=Object.assign(clone(DEF_LAYOUT),p.layout);LS.set('pm:layout',L)}if(p.snap&&window.PMSnap){Object.assign(PMSnap,p.snap);LS.set('pm:snapopts',PMSnap)}
 if(p.defaults){S.defaults=Object.assign(clone(BASE_DEF),p.defaults);LS.set('pm:defaults',S.defaults)}if(p.settings){Object.assign(settings,p.settings);LS.set('pm:settings',settings)}
 apply();hook('prefs');renderProps();redrawAll();toast('Profile "'+n+'" loaded')}
H.ribbon.unshift({label:'View',title:'Panels, page display and workspace profiles',icon:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 4v16M3 9h6"/>',fn:viewDialog});
// ---------- Bookmarks ----------
let bmUser=[];
async function renderBookmarks(){const pane=$('#pane-bookmarks');if(!pane)return;if(!S.pdf){pane.innerHTML='<div class="hint">Open a PDF to see its bookmarks.</div>';return}
 let outline=null;try{outline=await S.pdf.getOutline()}catch(e){}
 bmUser=LS.get('pm:bm:'+S.fileKey,[]);
 const tree=(items,d)=>items.map((it,i)=>`<div class="res" data-ol="${d}.${i}" style="padding-left:${7+d.split('.').length*10}px">${esc(it.title||'(untitled)')}</div>${it.items&&it.items.length?tree(it.items,d+'.'+i):''}`).join('');
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn" id="bmAdd" style="border:1px solid var(--line)">+ Bookmark this page</button></div>
 ${bmUser.length?'<div class="sec">My bookmarks</div>'+bmUser.map((b,i)=>`<div class="res" data-ub="${i}" style="display:flex;justify-content:space-between"><span>${esc(b.title)} <small style="color:var(--mut)">p${b.page}</small></span><span data-ubx="${i}" style="opacity:.6">✕</span></div>`).join(''):''}
 <div class="sec">In this PDF</div>${outline&&outline.length?tree(outline,'0'):'<div class="hint">This PDF has no bookmarks.</div>'}`;
 pane._ol=outline;
 $('#bmAdd').onclick=()=>modalPrompt('Add bookmark','Name','Page '+S.cur,t=>{bmUser.push({title:t,page:S.cur});LS.set('pm:bm:'+S.fileKey,bmUser);renderBookmarks()})}
async function gotoOutline(path,ol){const ix=path.split('.').slice(1).map(Number);let it={items:ol};for(const i of ix)it=it.items[i];if(!it)return;
 try{let dest=it.dest;if(typeof dest==='string')dest=await S.pdf.getDestination(dest);if(!dest){if(it.url)toast('Link: '+it.url);return}const idx=await S.pdf.getPageIndex(dest[0]);gotoPage(idx+1)}catch(e){toast("Couldn't follow that bookmark")}}
// ---------- Measurements panel ----------
function renderMeasure(){const pane=$('#pane-measure');if(!pane)return;if(!S.pages.length){pane.innerHTML='<div class="hint">Open a PDF to measure.</div>';return}
 const sc=scaleFor(S.cur),ms=S.markups.filter(m=>T[m.type]&&T[m.type].meas),pg=ms.filter(m=>m.page===S.cur);
 const rows=a=>summaryRows(a.map(m=>({m,r:measOf(m)})));
 const tbl=a=>{const r=rows(a);return r.length?`<table class="ml" style="font-size:11.5px"><tbody>${r.map(o=>`<tr><td><span class="dot" style="background:${o.color}"></span> ${esc(o.subject)}</td><td class="num">${esc(o.text)}${o.extext?'<br><small>'+esc(o.extext)+'</small>':''}</td></tr>`).join('')}</tbody></table>`:'<div class="hint">None yet.</div>'};
 pane.innerHTML=`<div class="meas"><b style="font-size:13px;color:var(--text)">Page ${S.cur} scale</b><small>${esc(sc.label)} · ${sc.unit==='ftin'?'ft-in':UNITS[sc.unit].abbr}${sc.unit==='ftin'?' · 1/'+(sc.prec||8)+'"':' · '+(sc.dec??2)+' decimals'}</small></div>
 <div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><button class="btn" id="msSc" style="border:1px solid var(--line)">Set scale…</button><button class="btn" id="msCal" style="border:1px solid var(--line)">Calibrate</button></div>
 <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px">${['length','polylength','area','perimeter','volume','circle','count','angle'].map(t=>`<button class="btn" data-mt="${t}" title="${T[t].label}" style="border:1px solid var(--line);padding:0 5px">${icon(t)}</button>`).join('')}</div>
 <div class="sec">This page</div>${tbl(pg)}<div class="sec">Whole document</div>${tbl(ms)}`;
 $('#msSc').onclick=scaleDialog;$('#msCal').onclick=()=>setTool('calibrate');pane.querySelectorAll('[data-mt]').forEach(b=>b.onclick=()=>setTool(b.dataset.mt))}
// ---------- File Access (recent files, stored on this device) ----------
let rdb=null;function ridb(){if(!rdb)rdb=new Promise((res,rej)=>{try{const r=indexedDB.open('planmark-recent',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'key'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}});return rdb}
async function rtx(mode,fn){const d=await ridb();return new Promise((res,rej)=>{const t=d.transaction('files',mode),st=t.objectStore('files'),r=fn(st);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})}
async function remember(){if(!S.bytes||S.bytes.length>80e6||/^Combined\.pdf$/.test(S.fileName))return;try{const key=S.fileName+':'+S.bytes.length;await rtx('readwrite',st=>st.put({key,name:S.fileName,size:S.bytes.length,bytes:S.bytes,at:Date.now(),pages:S.pages.length}));
 const all=(await rtx('readonly',st=>st.getAll())).sort((a,b)=>b.at-a.at);for(const x of all.slice(12))await rtx('readwrite',st=>st.delete(x.key));renderFiles()}catch(e){}}
async function renderFiles(){const pane=$('#pane-files');if(!pane)return;let all=[];try{all=(await rtx('readonly',st=>st.getAll())).sort((a,b)=>b.at-a.at)}catch(e){pane.innerHTML='<div class="hint">Recent files need browser storage, which isn\'t available here.</div>';return}
 pane.innerHTML=`<div class="hint" style="margin-bottom:8px">Recently opened PDFs, kept on this device for quick reopening (markups come back too).</div>`+(all.map(f=>`<div class="res" data-rk="${esc(f.key)}" style="display:flex;justify-content:space-between;gap:6px"><span><b style="font-weight:600">${esc(f.name)}</b><br><small style="color:var(--mut)">${f.pages||'?'} pages · ${(f.size/1048576).toFixed(1)} MB · ${new Date(f.at).toLocaleString()}</small></span><span data-rx="${esc(f.key)}" title="Remove" style="opacity:.6">✕</span></div>`).join('')||'<div class="hint">Nothing yet.</div>');
 pane.onclick=async e=>{const x=e.target.closest('[data-rx]');if(x){e.stopPropagation();await rtx('readwrite',st=>st.delete(x.dataset.rx));renderFiles();return}const r=e.target.closest('[data-rk]');if(!r)return;const f=await rtx('readonly',st=>st.get(r.dataset.rk));if(f)openBytes(new Uint8Array(f.bytes),f.name)}}
// ---------- wiring ----------
H.open.push(()=>{renderBookmarks();renderMeasure();setTimeout(remember,1500);apply()});
H.change.push(()=>{clearTimeout(window.__msT);window.__msT=setTimeout(renderMeasure,300)});
const _ucur=updateScaleBtn;updateScaleBtn=function(){_ucur.apply(this,arguments);clearTimeout(window.__msT2);window.__msT2=setTimeout(renderMeasure,150)};
H.ready.push(()=>{const p=$('#pane-pages');
 addTab('bookmarks','Bookmarks');addTab('measure','Measure');addTab('files','Files');
 // order tabs like the panel list
 const bar=$('#left .tabs');for(const[k]of PANELS){const b=bar.querySelector(`[data-tab="${k}"]`);if(b)bar.appendChild(b)}
 renderBookmarks();renderMeasure();renderFiles();listResizer();
 $('#pane-bookmarks').addEventListener('click',e=>{const o=e.target.closest('[data-ol]');if(o)return gotoOutline(o.dataset.ol,$('#pane-bookmarks')._ol);const x=e.target.closest('[data-ubx]');if(x){bmUser.splice(+x.dataset.ubx,1);LS.set('pm:bm:'+S.fileKey,bmUser);renderBookmarks();return}const u=e.target.closest('[data-ub]');if(u)gotoPage(bmUser[+u.dataset.ub].page)});
 apply();if(L.tab&&L.tab!=='pages'&&L.tabs[L.tab]!==false&&TABS.includes(L.tab)&&innerWidth>820)switchTab(L.tab);
 H.prefs=H.prefs||[];H.prefs.push(()=>{const v=LS.get('pm:layout',null);if(v){L=Object.assign(clone(DEF_LAYOUT),v);L.tabs=Object.assign({},DEF_LAYOUT.tabs,v.tabs||{})}apply()})});
const _sw=switchTab;switchTab=function(n){_sw.apply(this,arguments);L.tab=n;LS.set('pm:layout',L)};
window.addEventListener('resize',()=>apply());
})();
