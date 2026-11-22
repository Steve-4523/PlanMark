/* PlanMark — Sets: group many PDFs into one sheet list (stored on this device) */
(function(){
const DBN='planmark-sets';let dbp=null;
function idb(){if(!dbp)dbp=new Promise((res,rej)=>{try{const r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('files',{keyPath:'id'});d.createObjectStore('sets',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}});return dbp}
async function tx(store,mode,fn){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction(store,mode),s=t.objectStore(store);const r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})}
const put=(st,o)=>tx(st,'readwrite',s=>s.put(o)),get=(st,id)=>tx(st,'readonly',s=>s.get(id)),all=st=>tx(st,'readonly',s=>s.getAll()),del=(st,id)=>tx(st,'readwrite',s=>s.delete(id));
const SET={sets:[],cur:LS.get('pm:set:cur',null),sheet:-1,docs:{},ok:true};
const curSet=()=>SET.sets.find(s=>s.id===SET.cur)||null;
async function load(){try{SET.sets=(await all('sets')).sort((a,b)=>a.created-b.created)}catch(e){SET.ok=false}if(!curSet()&&SET.sets[0])SET.cur=SET.sets[0].id;render()}
async function saveSet(s){s.modified=Date.now();await put('sets',s);render()}
async function addFiles(files,s){let n=0;for(const f of files){const bytes=new Uint8Array(await f.arrayBuffer());await addBytes(bytes,f.name,s);n++}await saveSet(s);toast(`Added ${n} file${n===1?'':'s'} to "${s.name}"`)}
async function addBytes(bytes,name,s){const id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);await put('files',{id,name,bytes,size:bytes.length});
 const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;let labels=null;try{labels=await doc.getPageLabels()}catch(e){}
 for(let i=1;i<=doc.numPages;i++)s.items.push({fileId:id,file:name,page:i,label:(labels&&labels[i-1])||name.replace(/\.pdf$/i,'')+(doc.numPages>1?' — p'+i:'')});doc.destroy()}
async function newSet(){modalPrompt('New set','Set name','Project drawings',async name=>{const s={id:'s'+Date.now().toString(36),name,items:[],created:Date.now()};SET.sets.push(s);SET.cur=s.id;LS.set('pm:set:cur',s.id);await saveSet(s)})}
async function openSheet(i){const s=curSet();if(!s)return;const it=s.items[i];if(!it)return;
 if(S.setFile!==it.fileId){const f=await get('files',it.fileId);if(!f){toast('File missing from this device');return}await openBytes(new Uint8Array(f.bytes),f.name);S.setFile=it.fileId}
 SET.sheet=i;gotoPage(it.page,true);render()}
async function docFor(fileId){if(SET.docs[fileId])return SET.docs[fileId];const f=await get('files',fileId);if(!f)return null;return SET.docs[fileId]=await pdfjsLib.getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false}).promise}
// Auto-label: user picks the sheet-number box on the current page (2 clicks); we read the text inside it on every sheet
let pick=null;
function startAutoLabel(){const s=curSet();if(!s||!s.items.length){toast('Add sheets first');return}if(!S.pages.length){toast('Open a sheet of this set first');return}
 if(S.tool!=='select')setTool('select');pick={pts:[]};$('#hint').textContent='Auto-label: click one corner of the sheet-number box in the title block';toast('Click two corners around the sheet number')}
H.down=(prev=>(e,p,pt)=>{if(pick&&p){pick.pts.push({p:p.num,x:pt[0],y:pt[1]});if(pick.pts.length<2){$('#hint').textContent='Auto-label: click the opposite corner';return true}
  const[a,b]=pick.pts,pg=S.pages[a.p-1],r=[Math.min(a.x,b.x)/pg.w,Math.min(a.y,b.y)/pg.h,Math.max(a.x,b.x)/pg.w,Math.max(a.y,b.y)/pg.h];pick=null;updateRibbon();runAutoLabel(r);return true}
 return prev?prev(e,p,pt):false})(H.down);
async function runAutoLabel(r){const s=curSet();let n=0;toast('Reading sheet labels…');
 for(const it of s.items){try{const d=await docFor(it.fileId);if(!d)continue;const pg=await d.getPage(it.page),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();
   const box=[r[0]*vp.width,r[1]*vp.height,r[2]*vp.width,r[3]*vp.height],hits=[];
   for(const t of tc.items){if(!t.str||!t.str.trim())continue;const[x,y]=vp.convertToViewportPoint(t.transform[4],t.transform[5]);if(x>=box[0]-2&&x<=box[2]+2&&y>=box[1]-2&&y<=box[3]+4)hits.push({s:t.str.trim(),x,y})}
   hits.sort((a,b)=>Math.abs(a.y-b.y)>3?a.y-b.y:a.x-b.x);const lab=hits.map(h=>h.s).join(' ').replace(/\s+/g,' ').trim().slice(0,80);if(lab){it.label=lab;n++}}catch(e){console.warn("autolabel",e)}}
 await saveSet(s);toast(n?`Labeled ${n} of ${s.items.length} sheets`:'No text found in that box (scanned sheets need OCR first)')}
function step(d){const s=curSet();if(!s||!s.items.length)return;openSheet(clamp((SET.sheet<0?0:SET.sheet+d),0,s.items.length-1))}
function render(){const pane=$('#pane-sets');if(!pane)return;const s=curSet();
 if(!SET.ok){pane.innerHTML='<div class="hint">Sets need browser storage, which isn\'t available in this view.</div>';return}
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><select class="ti" id="stSel" style="flex:1">${SET.sets.map(x=>`<option value="${x.id}" ${x.id===SET.cur?'selected':''}>${esc(x.name)}</option>`).join('')||'<option>No sets yet</option>'}</select><button class="btn" id="stNew" style="flex:0;border:1px solid var(--line)" title="New set">+</button></div>
 ${s?`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" id="stAdd" style="border:1px solid var(--line)">Add PDFs…</button>${S.bytes?'<button class="btn" id="stCur" style="border:1px solid var(--line)">Add open doc</button>':''}<button class="btn" id="stAuto" style="border:1px solid var(--line)" title="Read sheet numbers from the title block">Auto-label</button></div>
  <div class="row" style="gap:4px;margin-bottom:8px"><button class="btn" id="stPrev" style="border:1px solid var(--line)">◀ Prev sheet</button><button class="btn" id="stNext" style="border:1px solid var(--line)">Next sheet ▶</button></div>
  <input class="ti" id="stQ" placeholder="Filter sheets…" style="margin-bottom:6px">
  <div id="stList">${s.items.map((it,i)=>`<div class="res" data-i="${i}" style="${i===SET.sheet?'background:var(--accbg)':''}"><b style="font-weight:600">${esc(it.label)}</b><br><small style="color:var(--mut)">${esc(it.file)} · p${it.page}</small></div>`).join('')||'<div class="hint">Add PDFs to build the sheet list. Files are stored on this device.</div>'}</div>
  <div class="row" style="gap:6px;margin-top:10px"><button class="btn" id="stRen" style="border:1px solid var(--line)">Rename set</button><button class="btn" id="stDel" style="border:1px solid #7f1d1d;color:#fca5a5">Delete set</button></div>
  <div class="hint" style="margin-top:6px">Double-click a sheet to rename it. Markups save per file automatically.</div>`:'<div class="hint">A set gathers many PDFs (architectural, structural, MEP…) into one sheet list you can flip through.</div>'}`;
 $('#stNew').onclick=newSet;const sel=$('#stSel');sel.onchange=()=>{SET.cur=sel.value;LS.set('pm:set:cur',SET.cur);SET.sheet=-1;render()};if(!s)return;
 $('#stAdd').onclick=()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='application/pdf,.pdf';i.onchange=()=>addFiles([...i.files],s);i.click()};
 if($('#stCur'))$('#stCur').onclick=async()=>{await addBytes(S.bytes,S.fileName,s);await saveSet(s);toast('Added '+S.fileName)};
 $('#stAuto').onclick=startAutoLabel;$('#stPrev').onclick=()=>step(-1);$('#stNext').onclick=()=>step(1);
 $('#stQ').oninput=e=>{const q=e.target.value.toLowerCase();$$('#stList .res').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'})};
 $('#stList').onclick=e=>{const r=e.target.closest('[data-i]');if(r)openSheet(+r.dataset.i)};
 $('#stList').ondblclick=e=>{const r=e.target.closest('[data-i]');if(!r)return;const it=s.items[+r.dataset.i];modalPrompt('Sheet label','Label',it.label,v=>{it.label=v;saveSet(s)})};
 $('#stRen').onclick=()=>modalPrompt('Rename set','Set name',s.name,v=>{s.name=v;saveSet(s)});
 $('#stDel').onclick=()=>modal('Delete set "'+s.name+'"?','<div class="hint">Removes the set and its stored copies of the PDFs from this device. Your original files are not touched.</div>',[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:async()=>{const ids=new Set(s.items.map(i=>i.fileId));for(const id of ids){if(!SET.sets.some(o=>o!==s&&o.items.some(i=>i.fileId===id)))await del('files',id).catch(()=>{})}await del('sets',s.id);SET.sets=SET.sets.filter(x=>x!==s);SET.cur=SET.sets[0]?.id||null;render()}}])}
H.open.push(()=>{S.setFile=null;SET.sheet=-1;render()});
H.ready.push(()=>{addTab('sets','Sets');load();document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.altKey&&(e.key==='PageDown'||e.key==='PageUp')){e.preventDefault();step(e.key==='PageDown'?1:-1)}})});
})();
