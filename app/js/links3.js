/* PlanMark — links, actions, layout, bookmarks and navigation extras (round 3)
   1  Markup actions on any markup (page, view/snapshot area, another file, web address) + Edit Action (Ctrl+Shift+E),
      Actions section in Properties, follow with Ctrl+click (or a plain click on a Hyperlink), real PDF link annotations on save.
   2  Layout section in Properties: exact X / Y / width / height / rotation, lock aspect, one or many markups.
   3  Hyperlink options (visible border / invisible / print visible), links from URLs in the text, auto-detected URLs,
      hyperlink checked search results, area (snapshot) targets, links redirected when pages are replaced or moved.
   4  Select Text tool + right-click "Search for …" / "Copy" / "Hyperlink …"; page right-click "Search for word".
   5  Bookmarks: actions, nesting, keep in page order, import/export (CSV, XML), bookmarks from file names on combine/insert.
   6  Drag page thumbnails onto another document tab to copy those pages (with their markups) into it.
   7  Split view: Toggle Split flips orientation (Ctrl+I), Balance (Shift+F12), click into either pane to edit it,
      tear a tab away into its own window.
   8  Preferences: tab name length, Alt-key menus, rotate scope, drag-to-rectangle for polygon tools, scale grouped
      appearance, persist measurement subject/label, startup, cursor coordinates format, reset hidden messages.
   9  First-run guided tour (Help → Take the tour).
   10 Pen pressure for Pen/Highlight; leader length / extension for lines and dimensions. */
(function(){
const PL=()=>window.PDFLib;
const D=()=>window.PMDoc||{};
const PREF_KEY='pm:lk3:prefs',PERSIST_KEY='pm:lk3:persist';
const DEF={tabTrunc:28,altMenus:true,rotAll:false,polyDrag:'rect',scaleGroup:true,persistSL:false,startup:'none',coordUnits:'scale',coordOrigin:'tl',coordDec:2,autoUrls:true,bmFromFiles:true,bmAutoSort:false,pressure:true,editBoth:true};
const P3=Object.assign({},DEF,LS.get(PREF_KEY,{})||{});
const setP=(k,v)=>{P3[k]=v;LS.set(PREF_KEY,P3);applyP3()};
window.PM_EXTRA_SYNC_KEYS_LK=[PREF_KEY,PERSIST_KEY];
const L3={pending:null,pick:null,tsel:null,urls:{},dragRect:null};
window.PMLinks3=L3;
const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
const W=()=>window.PMWorkspace||{};
const Vw=()=>window.PMViews||{};
const sel=()=>[...S.sel].map(byId).filter(Boolean);
const labelOf=n=>{try{return D().labelOf?D().labelOf(n):String(n)}catch(e){return String(n)}};
const hasLab=n=>{const l=labelOf(n);return l&&l!==String(n)};
const pageName=n=>'Page '+n+(hasLab(n)?' ('+labelOf(n)+')':'');
const newId=()=>'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

const css=document.createElement('style');css.textContent=`
#lk3Tour{position:fixed;inset:0;z-index:120;pointer-events:none}
#lk3Tour .spot{position:fixed;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,.55);border:2px solid #3d8bfd;transition:all .25s;pointer-events:none}
#lk3Tour .card{position:fixed;width:300px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:14px 16px;box-shadow:0 18px 50px rgba(0,0,0,.6);pointer-events:auto;font-size:13px;line-height:1.45}
#lk3Tour .card h4{margin:0 0 6px;font-size:15px}
#lk3Tour .card .row{display:flex;gap:6px;justify-content:flex-end;margin-top:10px;align-items:center}
#lk3Tour .card .stp{color:var(--mut);font-size:11px;margin-right:auto}
body.lk3Alt #wsMenu .wm::first-letter{text-decoration:underline}
body.lk3Alt #wsMenu{box-shadow:inset 0 -2px 0 #3d8bfd}
#splitBox.on #viewer.lk3Act,#splitBox.on #viewer2.lk3Act{box-shadow:inset 0 0 0 2px #3d8bfd}
.thumb.lk3Drag{opacity:.5}
#tabBar .dtab.lk3Drop{outline:2px dashed #3d8bfd;outline-offset:-2px;color:var(--text)}
#sRes .res .lk3c{float:right;margin:2px 0 0 6px}
#lk3SBar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.lk3sec .row input.ti{min-width:0}
`;document.head.appendChild(css);

/* =========================== 1. ACTIONS =========================== */
function linkText(l){if(!l)return'(none)';if(l.type==='url')return l.url;if(l.type==='file')return'File: '+l.name+(l.page?' · page '+l.page:'');if(l.type==='page')return(l.rect?'View on ':'')+pageName(l.page);return'(none)'}
L3.linkText=linkText;
async function zoomRect(n,r){const vr=viewer.getBoundingClientRect(),w=Math.max(4,r[2]-r[0]),h=Math.max(4,r[3]-r[1]);
 const z=clampN(Math.min((vr.width-60)/w,(vr.height-60)/h),.05,24);setZoom(z);await new Promise(res=>setTimeout(res,80));scrollToBox(n,r);
 S.flash={page:n,r};redrawPage(n);clearTimeout(L3.flT);L3.flT=setTimeout(()=>{S.flash=null;redrawPage(n)},1600)}
// recent files kept on this device (same store as File Access)
let rdb=null;const ridb=()=>rdb||(rdb=new Promise((res,rej)=>{try{const r=indexedDB.open('planmark-recent',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'key'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
async function rtx(mode,fn){const d=await ridb();return new Promise((res,rej)=>{const t=d.transaction('files',mode),st=t.objectStore('files'),r=fn(st);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})}
async function recentFiles(){try{return((await rtx('readonly',st=>st.getAll()))||[]).sort((a,b)=>b.at-a.at)}catch(e){return[]}}
function pickPdfFile(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='application/pdf,.pdf';i.onchange=()=>res(i.files[0]||null);i.click()})}
async function rememberFile(name,bytes){try{await rtx('readwrite',st=>st.put({key:name+':'+bytes.length,name,size:bytes.length,bytes,at:Date.now(),pages:0}))}catch(e){}}
async function follow(l){if(!l)return;
 if(l.type==='url'){if(D().followLink)return D().followLink(l);window.open(l.url,'_blank','noopener');return}
 if(l.type==='page'){if(!(l.page>=1&&l.page<=S.pages.length))return toast('Page '+l.page+' does not exist');gotoPage(l.page,true);if(l.rect)setTimeout(()=>zoomRect(l.page,l.rect),120);toast('→ '+linkText(l));return}
 if(l.type==='file'){const tabs=Vw().tabs||[];const t=tabs.find(t=>(t.name||'')===l.name);
  const go=()=>{if(l.page&&l.page<=S.pages.length){gotoPage(l.page,true);if(l.rect)setTimeout(()=>zoomRect(l.page,l.rect),150)}};
  if(S.fileName===l.name){go();return}if(t){Vw().switchTo(t.id);setTimeout(go,120);return}
  const f=(await recentFiles()).find(x=>x.name===l.name);
  if(f){await openBytes(new Uint8Array(f.bytes),f.name);setTimeout(go,250);return}
  toast(l.name+' is not on this device yet — choose it once');const pf=await pickPdfFile();if(!pf)return;const b=new Uint8Array(await pf.arrayBuffer());await rememberFile(l.name,b);await openBytes(b,pf.name);setTimeout(go,250)}}
L3.follow=follow;
// Edit Action dialog — works for every markup type
function actionDialog(m,draft,onApply){const l=draft||m.link||{type:S.pages.length>1?'page':'url',page:Math.min(S.cur+1,S.pages.length)};const typ=l.type==='page'&&l.rect?'view':l.type||'none';
 const pageOpts=sel=>S.pages.map(p=>`<option value="${p.num}" ${sel===p.num?'selected':''}>${esc(pageName(p.num))}</option>`).join('');
 modal('Action',`<div class="hint" style="margin-bottom:8px">What happens when this markup is clicked. A Hyperlink follows on a plain click; any other markup follows on <b>Ctrl+click</b> (or a plain click in View mode).</div>
 <div class="fld"><label class="chk"><input type="radio" name="a3t" value="none" ${typ==='none'?'checked':''}> No action</label></div>
 <div class="fld"><label class="chk"><input type="radio" name="a3t" value="page" ${typ==='page'?'checked':''}> Go to a page / sheet</label><select class="ti" id="a3P" style="margin-top:4px">${pageOpts(typ==='page'?l.page:Math.min(S.cur+1,S.pages.length))}</select></div>
 <div class="fld"><label class="chk"><input type="radio" name="a3t" value="view" ${typ==='view'?'checked':''}> Go to an area (snapshot view)</label><div class="row" style="gap:6px;margin-top:4px"><select class="ti" id="a3VP">${pageOpts(l.page||S.cur)}</select><button class="btn" id="a3Pick" style="border:1px solid var(--line);white-space:nowrap">Pick area…</button></div><div class="hint" id="a3VR" style="margin-top:3px">${typ==='view'&&l.rect?'Area chosen ('+Math.round(l.rect[2]-l.rect[0])+' × '+Math.round(l.rect[3]-l.rect[1])+' pt)':'No area chosen yet'}</div></div>
 <div class="fld"><label class="chk"><input type="radio" name="a3t" value="file" ${typ==='file'?'checked':''}> Open another PDF</label><div class="row" style="gap:6px;margin-top:4px"><select class="ti" id="a3F"><option value="">Loading…</option></select><button class="btn" id="a3FB" style="border:1px solid var(--line);white-space:nowrap">Choose…</button><input class="ti" id="a3FP" type="number" min="1" placeholder="page" value="${typ==='file'&&l.page?l.page:''}" style="width:70px"></div></div>
 <div class="fld"><label class="chk"><input type="radio" name="a3t" value="url" ${typ==='url'?'checked':''}> Open a web address</label><input class="ti" id="a3U" placeholder="https://…" value="${esc(typ==='url'?l.url||'':'')}" style="margin-top:4px"></div>`,
 [{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>applyFromDialog(m,md,l,onApply)}]);
 const md=$('#modal');md._a3rect=typ==='view'?l.rect:null;
 const sel3=v=>{const r=md.querySelector(`input[name=a3t][value=${v}]`);if(r)r.checked=true};
 md.querySelector('#a3P').onfocus=()=>sel3('page');md.querySelector('#a3U').onfocus=()=>sel3('url');md.querySelector('#a3VP').onfocus=()=>sel3('view');md.querySelector('#a3F').onfocus=()=>sel3('file');
 (async()=>{const files=await recentFiles();const names=[...new Set([...(Vw().tabs||[]).map(t=>t.name).filter(Boolean),...files.map(f=>f.name)])];if(typ==='file'&&l.name&&!names.includes(l.name))names.unshift(l.name);
  const s=md.querySelector('#a3F');if(s)s.innerHTML=names.length?names.map(n=>`<option ${typ==='file'&&l.name===n?'selected':''}>${esc(n)}</option>`).join(''):'<option value="">(no recent files — Choose…)</option>'})();
 md.querySelector('#a3FB').onclick=async()=>{sel3('file');const f=await pickPdfFile();if(!f)return;const b=new Uint8Array(await f.arrayBuffer());await rememberFile(f.name,b);const s=md.querySelector('#a3F');s.insertAdjacentHTML('afterbegin',`<option selected>${esc(f.name)}</option>`)};
 md.querySelector('#a3Pick').onclick=()=>{const draftL={type:'page',page:+md.querySelector('#a3VP').value,rect:null};closeModal();gotoPage(draftL.page,true);
  L3.pick={cb:(page,rect)=>{actionDialog(m,{type:'page',page,rect},onApply)},cancel:()=>actionDialog(m,m.link,onApply)};$('#hint').textContent='Drag a box around the area this action should show · Esc cancels';toast('Drag a box around the target area')}}
function readDialog(md,l){const t=md.querySelector('input[name=a3t]:checked').value;
 if(t==='none')return null;if(t==='page')return{type:'page',page:+md.querySelector('#a3P').value};
 if(t==='view'){const r=md._a3rect;if(!r){toast('Pick the area first');return false}return{type:'page',page:l&&l.rect&&l.page?l.page:+md.querySelector('#a3VP').value,rect:r,zoom:true}}
 if(t==='file'){const n=md.querySelector('#a3F').value;if(!n){toast('Choose the PDF to open');return false}const pg=+md.querySelector('#a3FP').value||0;const o={type:'file',name:n};if(pg)o.page=pg;return o}
 let u=md.querySelector('#a3U').value.trim();if(!u){toast('Enter a web address');return false}if(!/^[a-z]+:/i.test(u))u='https://'+u;return{type:'url',url:u}}
function applyFromDialog(m,md,l,onApply){const nl=readDialog(md,l);if(nl===false)return false;if(onApply){onApply(nl);return}
 pushUndo();if(nl)m.link=nl;else delete m.link;m.modified=Date.now();if(m.type==='hlink'&&nl&&(!m.comment||/^→|^https?:|^Page \d|^File:|^View on/.test(m.comment)))m.comment=linkText(nl);commit();renderProps();toast(nl?'Action set: '+linkText(nl):'Action removed')}
L3.actionDialog=actionDialog;
function editAction(){const s=sel();if(s.length!==1)return toast('Select one markup first');actionDialog(s[0])}
// area picking + Select Text tool + link following — all on pointerdown before the other tools
const _down=H.down;
H.down=function(e,p,pt){
 if(L3.pick&&p){L3.dragRect={k:'pick',page:p.num,a:pt,b:pt};return true}
 if(S.tool==='seltext'&&p){L3.tsel=null;L3.dragRect={k:'tsel',page:p.num,a:pt,b:pt};redrawPage(p.num);return true}
 let mine=null;
 if(p&&(S.tool==='select'||S.tool==='pan')){const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);const vm=W().P&&W().P.viewMode;
  if(m&&m.link){if(m.type==='hlink'&&!(e.shiftKey||e.ctrlKey||e.metaKey))mine={l:m.link,x:e.clientX,y:e.clientY};
   else if(m.type!=='hlink'&&((e.ctrlKey||e.metaKey)&&!e.shiftKey||vm)){L3.pending={l:m.link,x:e.clientX,y:e.clientY};return true}}
  else if(!mk&&P3.autoUrls){const u=urlAt(p.num,pt);if(u)mine={l:{type:'url',url:u.url},x:e.clientX,y:e.clientY}}}
 const r=_down?_down(e,p,pt):false;if(mine){L3.pending=mine;if(D())D().pending=null}return r};
window.addEventListener('pointermove',e=>{const d=L3.dragRect;if(!d)return;const p=S.pages[d.page-1];if(!p)return;d.b=toPt(e,p);redrawPage(d.page)});
window.addEventListener('pointerup',e=>{const d=L3.dragRect;if(d){L3.dragRect=null;const r=normBox(d.a,d.b);redrawPage(d.page);
  if(d.k==='pick'){const pk=L3.pick;L3.pick=null;$('#hint').textContent=HINTS[S.tool]||'';if(r[2]-r[0]<4||r[3]-r[1]<4){toast('Area too small — try again');L3.pick=pk;return}pk.cb(d.page,r.map(v=>Math.round(v*10)/10))}
  if(d.k==='tsel')selectTextIn(d.page,r);return}
 const pd=L3.pending;L3.pending=null;if(pd&&Math.hypot(e.clientX-pd.x,e.clientY-pd.y)<5)setTimeout(()=>follow(pd.l),0)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&L3.pick){const pk=L3.pick;L3.pick=null;L3.dragRect=null;$('#hint').textContent=HINTS[S.tool]||'';if(pk.cancel)pk.cancel()}},true);
H.over.push(n=>{let s='';const d=L3.dragRect;if(d&&d.page===n){const b=normBox(d.a,d.b);s+=`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="rgba(61,139,253,.12)" stroke="#3d8bfd" stroke-width="${1.5/S.zoom}" stroke-dasharray="${4/S.zoom}" pointer-events="none"/>`}
 const t=L3.tsel;if(t&&t.page===n)for(const r of t.rects)s+=`<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="rgba(61,139,253,.35)" pointer-events="none"/>`;
 const hv=L3.hoverUrl;if(hv&&hv.page===n){const b=hv.r;s+=`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="none" stroke="#2563eb" stroke-width="${1/S.zoom}" pointer-events="none"/><line x1="${b[0]}" y1="${b[3]}" x2="${b[2]}" y2="${b[3]}" stroke="#2563eb" stroke-width="${1/S.zoom}" pointer-events="none"/>`}
 return s});
// hover: tell people a markup has an action
viewer.addEventListener('pointermove',e=>{if(!S.pages.length||e.buttons||(S.tool!=='select'&&S.tool!=='pan'))return;const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);
 if(m&&m.link&&m.type!=='hlink'){viewer.style.cursor=(e.ctrlKey||e.metaKey)?'pointer':'';$('#hint').textContent='Action → '+linkText(m.link)+'  (Ctrl+click to follow)';return}
 if(m&&m.type==='hlink'&&m.link&&(m.link.type==='file'||m.link.rect)){$('#hint').textContent='Link → '+linkText(m.link)+'  (Shift+click to select)'}
 if(!mk&&P3.autoUrls){const p=pageFromEvent(e);if(!p)return;const u=urlAt(p.num,toPt(e,p));const before=L3.hoverUrl;
  if((before&&before.r)!==(u&&u.r)){L3.hoverUrl=u?Object.assign({page:p.num},u):null;if(before)redrawPage(before.page);if(u)redrawPage(p.num)}
  if(u){viewer.style.cursor='pointer';$('#hint').textContent='Link → '+u.url}}});
// Properties: Action section for every markup, hyperlink appearance, Layout section
H.props.push((m,mode)=>{if(mode!=='sel'||!m)return'';const ss=sel();let h='';
 if(ss.length===1&&m.type!=='hlink'){h+=`<div class="sec lk3sec">Action</div><div class="hint" style="margin-bottom:6px">${m.link?'→ '+esc(linkText(m.link)):'None'}</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" data-lk3a="edit">${m.link?'Edit action…':'Add action…'}</button>${m.link?'<button class="btn" style="border:1px solid var(--line)" data-lk3a="go">Follow</button><button class="btn" style="border:1px solid var(--line)" data-lk3a="rm">Remove</button>':''}</div>`}
 if(ss.length===1&&m.type==='hlink'){{const st=m.style||{};h+=`<div class="row fld" style="margin-top:8px;gap:8px"><div style="flex:1"><label style="font-size:11px;color:var(--mut)">Link appearance in the saved PDF</label><select class="ti" data-lk3h="hlVis"><option value="invisible" ${st.hlVis!=='visible'?'selected':''}>Invisible rectangle</option><option value="visible" ${st.hlVis==='visible'?'selected':''}>Visible border</option></select></div><label class="chk" style="margin-top:16px"><input type="checkbox" data-lk3h="hlPrint" ${st.hlPrint?'checked':''}> Print</label></div>`}}
 h+=layoutHtml(ss);return h});
const _rp=renderProps;renderProps=function(){const r=_rp.apply(this,arguments);try{const b=$('#props [data-dp="editlink"]');const s1=sel();if(b&&s1.length===1){const row=b.closest('.row'),hint=row&&row.previousElementSibling;if(hint&&hint.classList.contains('hint'))hint.textContent='→ '+linkText(s1[0].link)}}catch(e){}return r};
$('#props').addEventListener('click',e=>{const b=e.target.closest('[data-dp="editlink"],[data-dp="golink"]');if(!b)return;const s1=sel();if(s1.length!==1)return;e.stopImmediatePropagation();e.preventDefault();if(b.dataset.dp==='editlink')actionDialog(s1[0]);else follow(s1[0].link)},true);
$('#props').addEventListener('click',e=>{const b=e.target.closest('[data-lk3a]');if(!b)return;const s=sel();if(s.length!==1)return;const m=s[0];const a=b.dataset.lk3a;
 if(a==='edit')actionDialog(m);if(a==='go')follow(m.link);if(a==='rm'){pushUndo();delete m.link;m.modified=Date.now();commit();renderProps()}});
$('#props').addEventListener('change',e=>{const t=e.target;if(t.dataset.lk3h){const s=sel();if(s.length!==1)return;pushUndo();const m=s[0];m.style[t.dataset.lk3h]=t.type==='checkbox'?t.checked:t.value;m.modified=Date.now();commit()}
 if(t.dataset.lk3l)applyLayout(t)});

/* =========================== 2. LAYOUT =========================== */
const ONEPT=new Set(['note','stamp','typewriter','count','symbol','legend','flag']);
const NOROT=new Set(['ellipse','text','image','hlink','stamp','typewriter','note','count','symbol','legend','callout','texthl','underline','strikeout','squiggly','circle','flag','redact']);
const ROT_AS_POLY=new Set(['rect']);
function unionBox(ms){let b=null;for(const m of ms){const q=bboxOf(m);if(!q)continue;b=b?[Math.min(b[0],q[0]),Math.min(b[1],q[1]),Math.max(b[2],q[2]),Math.max(b[3],q[3])]:q.slice()}return b}
function layoutHtml(ss){if(!ss.length)return'';const pages=new Set(ss.map(m=>m.page));if(pages.size>1)return`<div class="sec lk3sec">Layout</div><div class="hint">Select markups on one page to edit their layout.</div>`;
 const b=unionBox(ss);if(!b)return'';const f=v=>(+v/72).toFixed(3).replace(/\.?0+$/,'')||'0';const one=ss.length===1?ss[0]:null;
 const canSize=!ss.some(m=>ONEPT.has(m.type)),canRot=!ss.some(m=>NOROT.has(m.type)),rot=one?(one.rotDeg||0):0,lock=LS.get('pm:lk3:lockAR',false);
 const sc=scaleFor(ss[0].page);const scaled=!sc.none?`<div class="hint" style="margin-top:3px">At this page's scale: ${esc(fmtLen((b[2]-b[0])*sc.perPt,sc))} × ${esc(fmtLen((b[3]-b[1])*sc.perPt,sc))}</div>`:'';
 return`<div class="sec lk3sec">Layout${ss.length>1?' (selection)':''}</div>
 <div class="row fld" style="gap:6px"><div><label style="font-size:11px;color:var(--mut)">X (in)</label><input class="ti" type="number" step="0.01" data-lk3l="x" value="${f(b[0])}"></div><div><label style="font-size:11px;color:var(--mut)">Y (in)</label><input class="ti" type="number" step="0.01" data-lk3l="y" value="${f(b[1])}"></div></div>
 <div class="row fld" style="gap:6px"><div><label style="font-size:11px;color:var(--mut)">Width (in)</label><input class="ti" type="number" step="0.01" min="0.01" data-lk3l="w" value="${f(b[2]-b[0])}" ${canSize?'':'disabled title="This markup sizes itself from its text or symbol"'}></div><div><label style="font-size:11px;color:var(--mut)">Height (in)</label><input class="ti" type="number" step="0.01" min="0.01" data-lk3l="h" value="${f(b[3]-b[1])}" ${canSize?'':'disabled'}></div></div>
 <div class="row fld" style="gap:8px;align-items:flex-end"><div><label style="font-size:11px;color:var(--mut)">Rotation (°)</label><input class="ti" type="number" step="1" data-lk3l="rot" value="${rot}" ${canRot?'':'disabled title="This markup type can\'t be rotated"'}></div><label class="chk" style="margin-bottom:6px"><input type="checkbox" data-lk3l="lock" ${lock?'checked':''}> Lock aspect ratio</label></div>${scaled}`}
function xformMarkup(m,fn){const tf=q=>{const r=fn(q[0],q[1]);return[r[0],r[1]]};m.pts=m.pts.map(tf);
 if(Array.isArray(m.holes))m.holes=m.holes.map(h=>Array.isArray(h)?h.map(tf):h);
 if(Array.isArray(m.curves))m.curves=m.curves.map(c=>Array.isArray(c)&&c.length===2&&typeof c[0]==='number'?tf(c):Array.isArray(c)?c.map(x=>Array.isArray(x)&&typeof x[0]==='number'?tf(x):x):c);
 if(Array.isArray(m.rects))m.rects=m.rects.map(r=>{const a=tf([r[0],r[1]]),b=tf([r[2],r[3]]);return normBox(a,b)})}
function applyLayout(t){const ss=sel();if(!ss.length)return;const k=t.dataset.lk3l;const box=$('#props');
 if(k==='lock'){LS.set('pm:lk3:lockAR',t.checked);return}
 const b=unionBox(ss);if(!b)return;const val=n=>parseFloat(box.querySelector(`[data-lk3l="${n}"]`).value);
 const bw=Math.max(1e-6,b[2]-b[0]),bh=Math.max(1e-6,b[3]-b[1]);let nx=val('x')*72,ny=val('y')*72,nw=val('w')*72,nh=val('h')*72;
 if(!(nx>=-1e6)||!(ny>=-1e6))return;
 if(k==='w'||k==='h'){if(!(nw>0)||!(nh>0)){toast('Size must be more than zero');renderProps();return}if(LS.get('pm:lk3:lockAR',false)){if(k==='w')nh=nw*bh/bw;else nw=nh*bw/bh}}
 pushUndo();
 if(k==='rot'){const one=ss.length===1?ss[0]:null;const target=parseFloat(t.value)||0,cur=one?(one.rotDeg||0):0,delta=target-cur;if(!delta){return}
  const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,a=delta*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
  for(const m of ss){if(NOROT.has(m.type))continue;if(ROT_AS_POLY.has(m.type)){const q=normBox(m.pts[0],m.pts[1]);m.pts=[[q[0],q[1]],[q[2],q[1]],[q[2],q[3]],[q[0],q[3]]];m.type='polygon';if(!m.subject||m.subject==='Rectangle')m.subject='Rectangle'}
   xformMarkup(m,(x,y)=>[cx+(x-cx)*co-(y-cy)*si,cy+(x-cx)*si+(y-cy)*co]);m.rotDeg=(((m.rotDeg||0)+delta)%360+360)%360;if(m.rotDeg>180)m.rotDeg-=360;m.modified=Date.now()}}
 else{const sx=(k==='w'||k==='h')?nw/bw:1,sy=(k==='w'||k==='h')?nh/bh:1,ox=k==='x'?nx:b[0],oy=k==='y'?ny:b[1];
  for(const m of ss){if(ONEPT.has(m.type)||m.type==='circle'&&sx!==sy){const c=bboxOf(m);const dx=ox+(c[0]-b[0])*sx-c[0],dy=oy+(c[1]-b[1])*sy-c[1];xformMarkup(m,(x,y)=>[x+dx,y+dy])}
   else xformMarkup(m,(x,y)=>[ox+(x-b[0])*sx,oy+(y-b[1])*sy]);
   if((sx!==1||sy!==1)&&ss.length>1&&P3.scaleGroup){const f=Math.sqrt(sx*sy);if(m.style.width)m.style.width=+(m.style.width*f).toFixed(2);if(m.style.fontSize)m.style.fontSize=+(m.style.fontSize*f).toFixed(1)}
   m.modified=Date.now()}}
 commit();renderProps()}
L3.applyLayoutValues=(o)=>{const box=$('#props');for(const[k,v]of Object.entries(o)){const el=box.querySelector(`[data-lk3l="${k}"]`);if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v;applyLayout(el)}};

/* ============ 1b/3. SAVE: real link annotations for every markup with an action ============ */
H.exportPage.push(async(doc,pages)=>{const{PDFName,PDFString,PDFArray,PDFDict,PDFNumber}=PL();const ctx=doc.context;
 const rectOf=(m)=>{const vp=S.pages[m.page-1]&&S.pages[m.page-1].vp;if(!vp)return null;const b=m.type==='hlink'?normBox(m.pts[0],m.pts[1]):bboxOf(m);const a=vp.convertToPdfPoint(b[0],b[1]),c=vp.convertToPdfPoint(b[2],b[3]);return[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[0],c[0]),Math.max(a[1],c[1])]};
 const near=(a,b)=>a.length===4&&a.every((v,i)=>Math.abs(v-b[i])<.6);
 for(const m of S.markups){if(!m.link)continue;const page=pages[m.page-1];if(!page)continue;const rect=rectOf(m);if(!rect)continue;
  // replace the plain link written for Hyperlink markups so the action, border and print options are exact
  let ex=page.node.lookup(PDFName.of('Annots'));
  if(ex&&ex.size&&m.type==='hlink'){for(let i=ex.size()-1;i>=0;i--){const an=ex.lookup(i);try{if(an&&an.lookup(PDFName.of('Subtype'))===PDFName.of('Link')){const R=an.lookup(PDFName.of('Rect'));const rv=R&&R.asArray?R.asArray().map(x=>x.asNumber?x.asNumber():+x):[];if(near(rv,rect)){ex.remove(i)}}}catch(e){}}}
  const l=m.link,st=m.style||{};const vis=m.type==='hlink'?st.hlVis==='visible':false;const col=(st.stroke||'#2563eb').replace('#','');const rgb=[0,2,4].map(i=>parseInt(col.substr(i,2),16)/255||0);
  const d={Type:'Annot',Subtype:'Link',Rect:rect,Border:[0,0,vis?Math.max(.5,st.width||1):0],C:rgb,F:(m.type==='hlink'?st.hlPrint:false)?4:0,NM:PDFString.of('planmark-'+m.id)};
  if(l.type==='url')d.A={S:'URI',URI:PDFString.of(l.url)};
  else if(l.type==='page'){const tp=pages[l.page-1];if(!tp)continue;if(l.rect){const vp=S.pages[l.page-1].vp;const a=vp.convertToPdfPoint(l.rect[0],l.rect[1]),c=vp.convertToPdfPoint(l.rect[2],l.rect[3]);d.Dest=[tp.ref,'FitR',Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[0],c[0]),Math.max(a[1],c[1])]}else d.Dest=[tp.ref,'Fit']}
  else if(l.type==='file')d.A={S:'GoToR',F:PDFString.of(l.name),D:[Math.max(0,(l.page||1)-1),'Fit'],NewWindow:false};else continue;
  const ar=ctx.register(ctx.obj(d));ex=page.node.lookup(PDFName.of('Annots'));if(ex&&ex.push)ex.push(ar);else page.node.set(PDFName.of('Annots'),ctx.obj([ar]))}
 // bookmarks: nesting and actions (replaces the flat outline when needed)
 const bm=userBM();if(bm.some(b=>b.level>0||b.action)){const own=(D().outline||[]);const tree=bmTree(bm);
  const build=(items,parent)=>{const refs=items.map(()=>ctx.nextRef());items.forEach((it,i)=>{const dd={Title:PL().PDFHexString.fromText(it.title||'Untitled'),Parent:parent};if(i>0)dd.Prev=refs[i-1];if(i<items.length-1)dd.Next=refs[i+1];
    const a=it.action;if(a&&a.type==='url')dd.A={S:'URI',URI:PDFString.of(a.url)};else if(a&&a.type==='file')dd.A={S:'GoToR',F:PDFString.of(a.name),D:[Math.max(0,(a.page||1)-1),'Fit']};
    else if(a&&a.type==='page'&&a.rect&&pages[a.page-1]){const vp=S.pages[a.page-1].vp;const p1=vp.convertToPdfPoint(a.rect[0],a.rect[1]),p2=vp.convertToPdfPoint(a.rect[2],a.rect[3]);dd.Dest=[pages[a.page-1].ref,'FitR',Math.min(p1[0],p2[0]),Math.min(p1[1],p2[1]),Math.max(p1[0],p2[0]),Math.max(p1[1],p2[1])]}
    else if(it.page&&pages[it.page-1])dd.Dest=[pages[it.page-1].ref,'Fit'];else if(it.url)dd.A={S:'URI',URI:PDFString.of(it.url)};
    if(it.items&&it.items.length){const kk=build(it.items,refs[i]);dd.First=kk[0];dd.Last=kk[kk.length-1];dd.Count=kk.length}ctx.assign(refs[i],ctx.obj(dd))});return refs};
  const all=[...own,...tree];const root=ctx.nextRef(),kids=build(all,root);ctx.assign(root,ctx.obj({Type:'Outlines',First:kids[0],Last:kids[kids.length-1],Count:kids.length}));doc.catalog.set(PDFName.of('Outlines'),root);doc.catalog.set(PDFName.of('PageMode'),PDFName.of('UseOutlines'))}});

/* ============ page rebuilds: keep links, bookmarks and PDF destinations on the right pages ============ */
let lastPicked=null;try{const _ab=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){try{if(/pdf$/i.test(this.name||''))lastPicked={names:[this.name],t:Date.now()}}catch(e){}return _ab.apply(this,arguments)}}catch(e){}
function fixDests(doc,oldRefs,map){const{PDFName,PDFArray,PDFRef}=PL();const now=doc.getPages().map(p=>p.ref);const live=new Set(now.map(r=>r.toString()));
 const remap=ref=>{if(!ref||!ref.toString||live.has(ref.toString()))return null;const i=oldRefs.findIndex(r=>r.toString()===ref.toString());if(i<0)return null;const ni=map[i];if(ni==null||ni<0||!now[ni])return null;return now[ni]};
 const fixArr=arr=>{try{if(!arr||!arr.get)return false;const r0=arr.get(0);const nr=remap(r0);if(nr){arr.set(0,nr);return true}}catch(e){}return false};let n=0;
 for(const pg of doc.getPages()){const an=pg.node.lookup(PDFName.of('Annots'));if(!an||!an.size)continue;for(let i=0;i<an.size();i++){try{const a=an.lookup(i);if(!a||!a.lookup)continue;const dst=a.lookup(PDFName.of('Dest'));if(dst&&dst.get&&fixArr(dst))n++;const A=a.lookup(PDFName.of('A'));if(A&&A.lookup){const dd=A.lookup(PDFName.of('D'));if(dd&&dd.get&&fixArr(dd))n++}}catch(e){}}}
 try{const ol=doc.catalog.lookup(PDFName.of('Outlines'));const walk=node=>{let it=node&&node.lookup(PDFName.of('First'));let guard=0;while(it&&guard++<5000){const dst=it.lookup(PDFName.of('Dest'));if(dst&&dst.get&&fixArr(dst))n++;walk(it);it=it.lookup(PDFName.of('Next'))}};if(ol)walk(ol)}catch(e){}
 L3.lastRedirected=n;return n}
H.ready.push(()=>{if(!window.PMBatch)return;
 const _rb=PMBatch.rebuild;PMBatch.rebuild=async function(op,label){const n0=S.pages.length,picked=lastPicked&&Date.now()-lastPicked.t<120000?lastPicked:null;lastPicked=null;let map=null;
  const r=await _rb.call(this,async doc=>{const oldRefs=doc.getPages().map(p=>p.ref);map=await op(doc);if(map){try{await doc.flush()}catch(e){}/* finish lazy page embeds before old pages lose their last reference */try{fixDests(doc,oldRefs,map)}catch(e){console.warn('fixDests',e)}}return map},label);
  if(map){let ch=0;for(const m of S.markups){const l=m.link;if(l&&l.type==='page'&&l.page>=1){const ni=map[l.page-1];if(ni!=null&&ni>=0&&ni+1!==l.page){l.page=ni+1;ch++}}}
   const bm=userBM();let bch=false;for(const b of bm){if(b.action&&b.action.type==='page'){const ni=map[b.action.page-1];if(ni!=null&&ni>=0){b.action.page=ni+1;bch=true}}}
   if(/^Insert/i.test(label||'')&&picked&&P3.bmFromFiles){const used=new Set(map.filter(x=>x>=0));const fresh=[];for(let i=0;i<S.pages.length;i++)if(!used.has(i))fresh.push(i);if(fresh.length){bm.push({title:picked.names[0].replace(/\.pdf$/i,''),page:fresh[0]+1});bch=true}}
   if(bch)setBM(bm);else if(P3.bmAutoSort)setBM(bm);if(ch)commit()}return r};
 const _rot=PMBatch.rotatePages;PMBatch.rotatePages=function(pages,deg){if(P3.rotAll&&pages&&pages.length===1&&S.pages.length>1)pages=S.pages.map(p=>p.num);return _rot.call(this,pages,deg)};
 const _cmb=PMBatch.combine;PMBatch.combine=async function(files,includeCurrent){const parts=[];try{if(P3.bmFromFiles){if(includeCurrent&&S.bytes)parts.push({name:S.fileName,n:S.pages.length});for(const f of files){const d=await PL().PDFDocument.load(new Uint8Array(await f.arrayBuffer()),{ignoreEncryption:true});parts.push({name:f.name,n:d.getPageCount()})}}}catch(e){}
  lastPicked=null;const r=await _cmb.apply(this,arguments);if(parts.length&&S.pages.length){let p=1;const bm=[];for(const x of parts){bm.push({title:x.name.replace(/\.pdf$/i,''),page:p});p+=x.n}setBM(bm)}return r}});

/* =========================== 3. FIND / CREATE LINKS =========================== */
const URL_RE=/\b((?:https?:\/\/|www\.)[^\s<>"')\]]+[^\s<>"'.,;:)\]]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
function itemRect(it,vp,idx,len){const n=(it.str||'').length||1;if(it.vb){const w=it.vb[2]-it.vb[0];return[it.vb[0]+w*idx/n,it.vb[1],it.vb[0]+w*(idx+len)/n,it.vb[3]]}
 const c=vp.convertToViewportRectangle([it.x+it.w*idx/n,it.y-it.h*.2,it.x+it.w*(idx+len)/n,it.y+it.h*.85]);return normBox([c[0],c[1]],[c[2],c[3]])}
const normUrl=u=>/@/.test(u)&&!/^https?:/i.test(u)?'mailto:'+u:/^www\./i.test(u)?'https://'+u:u;
async function pageUrls(n){if(L3.urls[n])return L3.urls[n];L3.urls[n]=[];try{const{items,vp}=await pageText(n);const out=[];for(const it of items){const s=it.str||'';URL_RE.lastIndex=0;let mm;while((mm=URL_RE.exec(s))){out.push({url:normUrl(mm[1]),r:itemRect(it,vp,mm.index,mm[1].length)})}}L3.urls[n]=out}catch(e){}return L3.urls[n]}
function urlAt(n,pt){const list=L3.urls[n];if(!list){if(S.pdf)pageUrls(n);return null}for(const u of list)if(pt[0]>=u.r[0]-1&&pt[0]<=u.r[2]+1&&pt[1]>=u.r[1]-1&&pt[1]<=u.r[3]+1)return u;return null}
H.open.push(()=>{L3.urls={};L3.tsel=null;L3.hoverUrl=null});
async function createLinksFromContent(o={}){if(!S.pdf)return toast('Open a PDF first');let made=0;pushUndo();
 if(o.urls!==false){for(const p of S.pages){for(const u of await pageUrls(p.num)){if(S.markups.some(m=>m.type==='hlink'&&m.page===p.num&&m.link&&m.link.url===u.url&&Math.abs(m.pts[0][0]-u.r[0])<2))continue;
   const m=newMarkup('hlink',p.num,[[u.r[0]-1,u.r[1]-1],[u.r[2]+1,u.r[3]+1]],S.defaults.hlink||{stroke:'#2563eb',width:1});m.subject='Auto Link';m.link={type:'url',url:u.url};m.comment=u.url;S.markups.push(m);made++}}}
 commit();let sheets=0;if(o.sheets&&D().runBatchLink&&S.pages.some(p=>hasLab(p.num))){const before=S.markups.length;await D().runBatchLink('labels',true);sheets=S.markups.length-before}
 toast(`Created ${made} web/e-mail link${made===1?'':'s'}${o.sheets?` and ${Math.max(0,sheets)} sheet link${sheets===1?'':'s'}`:''}`);return made}
L3.createLinksFromContent=createLinksFromContent;
function findLinksDialog(){if(!S.pdf)return toast('Open a PDF first');modal('Find hyperlinks in content',`<div class="hint" style="margin-bottom:8px">Scans the text of every page and turns what it finds into clickable Hyperlink markups (they save as real PDF links).</div>
 <label class="chk fld"><input type="checkbox" id="flU" checked> Web addresses and e-mail addresses</label><label class="chk fld"><input type="checkbox" id="flS" ${S.pages.some(p=>hasLab(p.num))?'checked':'disabled'}> Sheet numbers (like "SEE A-201") → that sheet${S.pages.some(p=>hasLab(p.num))?'':' — needs page labels'}</label>`,
 [{label:'Cancel',cancel:1},{label:'Create links',pri:1,fn:md=>{const o={urls:md.querySelector('#flU').checked,sheets:md.querySelector('#flS').checked};setTimeout(()=>createLinksFromContent(o),0)}}])}

/* =========================== 4. SELECT TEXT + SEARCH =========================== */
T.seltext={label:'Select Text',kind:'nav'};IC.seltext='<path d="M5 6h10M10 6v12M3 20h4M17 9v10M14 9h6M14 19h6"/>';HINTS.seltext='Drag across PDF text to select it · right-click it to search, copy or link · Ctrl+C copies';
try{const nav=RIBBON.find(r=>r[0]==='Nav');if(nav&&!nav[1].includes('seltext'))nav[1].push('seltext')}catch(e){}
async function selectTextIn(n,box){try{const{items,vp}=await pageText(n);const rects=[],parts=[];let lastY=null;
  const hits=items.map(it=>({it,r:itemRect(it,vp,0,(it.str||'').length)})).filter(o=>o.it.str&&o.r[2]>box[0]&&o.r[0]<box[2]&&o.r[3]>box[1]&&o.r[1]<box[3]).sort((a,b)=>Math.abs(a.r[1]-b.r[1])>3?a.r[1]-b.r[1]:a.r[0]-b.r[0]);
  for(const{it,r}of hits){const s=it.str,n2=s.length||1,w=r[2]-r[0];let i0=0,i1=n2;if(r[0]<box[0])i0=Math.max(0,Math.floor((box[0]-r[0])/w*n2));if(r[2]>box[2])i1=Math.min(n2,Math.ceil((box[2]-r[0])/w*n2));if(i1<=i0)continue;
   const piece=s.slice(i0,i1);if(!piece.trim())continue;rects.push(itemRect(it,vp,i0,i1-i0));if(lastY!=null&&Math.abs(r[1]-lastY)>3)parts.push('\n');else if(parts.length)parts.push(' ');parts.push(piece);lastY=r[1]}
  L3.tsel=rects.length?{page:n,rects,text:parts.join('').replace(/ +\n/g,'\n').replace(/[ \t]+/g,' ').trim()}:null;redrawPage(n);
  $('#hint').textContent=L3.tsel?`Selected: “${L3.tsel.text.slice(0,60)}${L3.tsel.text.length>60?'…':''}” · right-click for Search / Copy / Hyperlink`:'No text there';}catch(e){console.warn(e)}}
L3.selectTextIn=selectTextIn;
function searchFor(q){q=String(q||'').replace(/\s+/g,' ').trim();if(!q)return;const tab=$('#left .tabs [data-tab="search"]');if(tab)tab.click();const box=$('#sq');if(!box)return;box.value=q.slice(0,200);try{doSearch()}catch(e){box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))}toast('Searching for “'+q.slice(0,40)+'”')}
L3.searchFor=searchFor;
// opens in your web browser (the Windows app hands web links to the default browser)
function searchGoogle(t){const q=String(t||'').replace(/\s+/g,' ').trim().slice(0,500);if(!q)return;window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener')}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copied')}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Copied')}catch(_){toast('Copy failed')}ta.remove()}L3.clip=t}
function linkFromSelection(){const t=L3.tsel;if(!t)return;const b=t.rects.reduce((a,r)=>a?[Math.min(a[0],r[0]),Math.min(a[1],r[1]),Math.max(a[2],r[2]),Math.max(a[3],r[3])]:r.slice(),null);
 const m=newMarkup('hlink',t.page,[[b[0]-1,b[1]-1],[b[2]+1,b[3]+1]],S.defaults.hlink||{stroke:'#2563eb',width:1});pushUndo();S.markups.push(m);m.subject='Hyperlink';commit();setTool('select');setSel([m.id]);actionDialog(m,{type:'page',page:matchLabel(t.text)||Math.min(S.cur+1,S.pages.length)})}
function matchLabel(text){const q=String(text||'').trim().toUpperCase();if(!q)return 0;for(const p of S.pages)if(hasLab(p.num)&&labelOf(p.num).toUpperCase()===q)return p.num;for(const p of S.pages)if(hasLab(p.num)&&q.includes(labelOf(p.num).toUpperCase()))return p.num;return 0}
L3.matchLabel=matchLabel;
document.addEventListener('keydown',e=>{if(!L3.tsel||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='c')return;const tg=e.target;if(tg&&tg.closest&&tg.closest('input,textarea,[contenteditable]'))return;e.preventDefault();e.stopImmediatePropagation();copyText(L3.tsel.text)},true);
function ctxRows(items){const c=$('#wsCtx');if(!c)return;const sep=document.createElement('div');sep.style.cssText='height:1px;background:var(--line);margin:4px 0';c.appendChild(sep);
 for(const it of items){const d=document.createElement('div');d.className='wmi';d.setAttribute('data-lk3m','1');d.style.cssText='padding:5px 14px;cursor:pointer;white-space:nowrap;display:flex;gap:16px;justify-content:space-between';d.innerHTML=`<span>${esc(it.label)}</span>${it.key?`<small style="color:var(--mut)">${esc(it.key)}</small>`:''}`;
  d.onmouseover=()=>d.style.background='var(--accbg,#2b4c7e)';d.onmouseout=()=>d.style.background='';d.onclick=ev=>{ev.stopPropagation();c.remove();it.run()};c.appendChild(d)}
 const r=c.getBoundingClientRect();if(r.bottom>innerHeight-4)c.style.top=Math.max(4,innerHeight-4-r.height)+'px'}
function inTsel(n,pt){const t=L3.tsel;return t&&t.page===n&&t.rects.some(r=>pt[0]>=r[0]-2&&pt[0]<=r[2]+2&&pt[1]>=r[1]-2&&pt[1]<=r[3]+2)}
viewer.addEventListener('contextmenu',e=>{const p=S.pages.length?pageFromEvent(e):null;if(!p)return;const pt=toPt(e,p);
 if(inTsel(p.num,pt)){e.preventDefault();e.stopImmediatePropagation();const t=L3.tsel.text;W().ctx&&W().ctx(e.clientX,e.clientY,[]);
  setTimeout(()=>{if(!$('#wsCtx')){const c=document.createElement('div');c.id='wsCtx';c.style.cssText=`position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:95;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 0;box-shadow:0 10px 30px rgba(0,0,0,.5);font-size:13px;min-width:200px`;document.body.appendChild(c)}
   const c=$('#wsCtx');c.innerHTML='';ctxRows([{label:`Search for “${t.slice(0,30)}${t.length>30?'…':''}”`,run:()=>searchFor(t)},{label:`Search Google for “${t.slice(0,30)}${t.length>30?'…':''}”`,run:()=>searchGoogle(t)},{label:'Copy text',key:'Ctrl+C',run:()=>copyText(t)},{label:'Create hyperlink here…',run:linkFromSelection}]);c.firstChild&&c.firstChild.remove()},0);return}},true);
// after the regular right-click menus open, add our items
document.addEventListener('contextmenu',e=>{if(!S.pages.length)return;const inViewer=(e.composedPath?e.composedPath():[]).includes(viewer)||viewer.contains(e.target);if(!inViewer)return;
 const mk=e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);
 if(m){setTimeout(()=>ctxRows([{label:m.link?'Edit action…':'Add action…',key:'Ctrl+Shift+E',run:()=>actionDialog(m)},...(m.link?[{label:'Follow action → '+linkText(m.link).slice(0,40),run:()=>follow(m.link)}]:[])]),0);return}
 const p=pageFromEvent(e);if(!p)return;const pt=toPt(e,p);
 (async()=>{try{const{items,vp}=await pageText(p.num);let best=null;for(const it of items){if(!it.str)continue;const r=itemRect(it,vp,0,it.str.length);if(pt[0]>=r[0]&&pt[0]<=r[2]&&pt[1]>=r[1]-1&&pt[1]<=r[3]+1){const n=it.str.length,i=clampN(Math.floor((pt[0]-r[0])/(r[2]-r[0])*n),0,n-1);const s=it.str;let a=i,b=i;while(a>0&&/\S/.test(s[a-1]))a--;while(b<n&&/\S/.test(s[b]))b++;best={word:s.slice(a,b).replace(/^[^\w]+|[^\w]+$/g,''),line:s.trim()};break}}
  if(best&&best.word&&$('#wsCtx'))ctxRows([{label:`Search for “${best.word.slice(0,30)}”`,run:()=>searchFor(best.word)},{label:'Copy text “'+best.line.slice(0,24)+(best.line.length>24?'…':'')+'”',run:()=>copyText(best.line)}])}catch(_){}})()});
// search results: check boxes + "Hyperlink checked"
function decorateResults(){const res=$('#sRes');if(!res)return;const rows=[...res.querySelectorAll('.res[data-i]')];
 for(const r of rows)if(!r.querySelector('.lk3c')){const c=document.createElement('input');c.type='checkbox';c.className='lk3c';c.title='Check to include';c.addEventListener('click',ev=>{ev.stopPropagation();updBar()});r.prepend(c)}
 let bar=$('#lk3SBar');if(!rows.length){if(bar)bar.remove();return}
 if(!bar){bar=document.createElement('div');bar.id='lk3SBar';bar.innerHTML=`<label class="chk"><input type="checkbox" id="lk3All"> All</label><button class="btn" id="lk3HL" style="border:1px solid var(--line)">Hyperlink checked…</button><span class="hint" id="lk3Cnt"></span>`;res.parentNode.insertBefore(bar,res);
  bar.querySelector('#lk3All').onchange=ev=>{$$('#sRes .lk3c').forEach(c=>c.checked=ev.target.checked);updBar()};bar.querySelector('#lk3HL').onclick=hyperlinkChecked}
 updBar()}
function updBar(){const n=$$('#sRes .lk3c:checked').length,c=$('#lk3Cnt');if(c)c.textContent=n?n+' checked':''}
L3.checkedHits=()=>$$('#sRes .res[data-i]').filter(r=>{const c=r.querySelector('.lk3c');return c&&c.checked}).map(r=>searchHits[+r.dataset.i]).filter(Boolean);
window.PMSearchChecked=L3.checkedHits;
function hyperlinkChecked(){const hits=L3.checkedHits();if(!hits.length)return toast('Check the results to link first');const q=($('#sq').value||'').trim();const auto=matchLabel(q);
 modal('Hyperlink checked results',`<div class="hint" style="margin-bottom:8px">Creates a Hyperlink over each of the ${hits.length} checked result${hits.length===1?'':'s'}.</div>
 <div class="fld"><label class="chk"><input type="radio" name="hcT" value="label" ${auto?'checked':''}> The sheet whose page label matches the text${auto?` (→ ${esc(pageName(auto))})`:' — no matching page label'}</label></div>
 <div class="fld"><label class="chk"><input type="radio" name="hcT" value="page" ${auto?'':'checked'}> This page</label><select class="ti" id="hcP" style="margin-top:4px">${S.pages.map(p=>`<option value="${p.num}" ${(auto||S.cur)===p.num?'selected':''}>${esc(pageName(p.num))}</option>`).join('')}</select></div>
 <div class="fld"><label class="chk"><input type="radio" name="hcT" value="url"> A web address</label><input class="ti" id="hcU" placeholder="https://…" style="margin-top:4px"></div>`,
 [{label:'Cancel',cancel:1},{label:'Create links',pri:1,fn:md=>{const t=md.querySelector('input[name=hcT]:checked').value;let mk;
  if(t==='url'){let u=md.querySelector('#hcU').value.trim();if(!u){toast('Enter a web address');return false}if(!/^[a-z]+:/i.test(u))u='https://'+u;mk=()=>({type:'url',url:u})}
  else if(t==='label')mk=h=>{const s=(h.str||'').substr(h.idx,h.ql);const pg=matchLabel(s)||auto;return pg?{type:'page',page:pg}:null};else{const pg=+md.querySelector('#hcP').value;mk=()=>({type:'page',page:pg})}
  pushUndo();let n=0;for(const h of hits){const l=mk(h);if(!l)continue;const m=newMarkup('hlink',h.page,[[h.r[0]-1,h.r[1]-1],[h.r[2]+1,h.r[3]+1]],S.defaults.hlink||{stroke:'#2563eb',width:1});m.subject='Search Link';m.link=l;m.comment=linkText(l);S.markups.push(m);n++}
  commit();toast(`Created ${n} hyperlink${n===1?'':'s'}`)}}])}
L3.hyperlinkChecked=hyperlinkChecked;
H.ready.push(()=>{const res=$('#sRes');if(res)new MutationObserver(decorateResults).observe(res,{childList:true})});

/* =========================== 5. BOOKMARKS =========================== */
const bmKey=()=>'pm:bm:'+S.fileKey;
function userBM(){return LS.get(bmKey(),[])||[]}
function setBM(b){if(P3.bmAutoSort)b=sortBM(b);LS.set(bmKey(),b);const box=$('#pane-bookmarks [data-dpbm]');if(box)box.remove();setTimeout(decorateBM,30)}
L3.userBM=userBM;L3.setBM=setBM;
function bmTree(list){const root=[],stack=[{level:-1,items:root}];for(const b of list){const lv=Math.max(0,b.level|0);while(stack.length>1&&stack[stack.length-1].level>=lv)stack.pop();const node={title:b.title,page:b.page,url:b.url,action:b.action,items:[]};stack[stack.length-1].items.push(node);stack.push({level:lv,items:node.items})}return root}
function blocks(list,lv){const out=[];let cur=null;for(const b of list){if((b.level|0)<=lv){cur=[b];out.push(cur)}else if(cur)cur.push(b);else{cur=[b];out.push(cur)}}return out}
function sortBM(list){const sortLv=(arr,lv)=>{const bl=blocks(arr,lv);bl.forEach(x=>{const head=x[0],rest=x.slice(1);x.splice(0,x.length,head,...(rest.length?sortLv(rest,lv+1):[]))});bl.sort((a,b)=>(a[0].action&&a[0].action.page||a[0].page||1e9)-(b[0].action&&b[0].action.page||b[0].page||1e9));return bl.flat()};return sortLv(list,0)}
L3.sortBM=sortBM;
function decorateBM(){const pane=$('#pane-bookmarks');if(!pane)return;const box=pane.querySelector('[data-dpbm]');if(!box)return;const bm=userBM();
 if(!box.querySelector('#lk3BmBar')){const bar=document.createElement('div');bar.id='lk3BmBar';bar.className='row';bar.style.cssText='gap:6px;flex-wrap:wrap;margin:0 0 8px';
  bar.innerHTML=`<button class="btn" data-lk3b="imp" style="border:1px solid var(--line)">Import…</button><button class="btn" data-lk3b="exp" style="border:1px solid var(--line)">Export…</button><label class="chk" title="Keep bookmarks in the same order as the pages they point to"><input type="checkbox" data-lk3b="sort" ${P3.bmAutoSort?'checked':''}> Keep in page order</label>`;box.prepend(bar)}
 box.querySelectorAll('[data-dpbmrow]').forEach(row=>{const i=+row.dataset.dpbmrow,b=bm[i];if(!b)return;row.style.paddingLeft=(8+(b.level|0)*16)+'px';
  if(!row.querySelector('[data-lk3bi]')){const span=row.querySelector('[data-bgo]');if(span&&b.action){const sm=span.querySelector('small');if(sm)sm.textContent=linkText(b.action)}
   const mk=(k,t,tx)=>{const s=document.createElement('span');s.setAttribute(k,i);s.title=t;s.textContent=tx;s.style.opacity='.7';s.style.cursor='pointer';return s};
   const del=row.querySelector('[data-bdel]');const out=mk('data-lk3bo','Outdent (move left)','←'),ind=mk('data-lk3bi','Indent under the bookmark above','→'),act=mk('data-lk3ba','Action (page, area, file or web address)','⚙');row.insertBefore(out,del);row.insertBefore(ind,del);row.insertBefore(act,del)}})}
H.ready.push(()=>{const pane=$('#pane-bookmarks');if(!pane)return;new MutationObserver(()=>{if(pane.querySelector('[data-dpbm]')&&!pane.querySelector('#lk3BmBar'))decorateBM()}).observe(pane,{childList:true,subtree:true});
 pane.addEventListener('click',e=>{const g=k=>{const el=e.target.closest('['+k+']');return el?+el.getAttribute(k):null};let i;const bm=userBM();
  if((i=g('data-lk3bi'))!=null&&bm[i]){e.stopPropagation();if(i===0)return toast('The first bookmark can\'t be indented');bm[i].level=Math.min((bm[i-1].level|0)+1,(bm[i].level|0)+1);setBM(bm);return}
  if((i=g('data-lk3bo'))!=null&&bm[i]){e.stopPropagation();bm[i].level=Math.max(0,(bm[i].level|0)-1);setBM(bm);return}
  if((i=g('data-lk3ba'))!=null&&bm[i]){e.stopPropagation();bmActionDialog(i);return}
  if((i=g('data-bgo'))!=null&&bm[i]&&bm[i].action){e.stopPropagation();e.preventDefault();follow(bm[i].action);return}
  const b=e.target.closest('[data-lk3b]');if(b){if(b.dataset.lk3b==='imp')bmImport();if(b.dataset.lk3b==='exp')bmExport()}},true);
 pane.addEventListener('change',e=>{const b=e.target.closest('[data-lk3b="sort"]');if(b){setP('bmAutoSort',b.checked);if(b.checked)setBM(userBM())}});
 // re-indent after the bookmarks module moves rows up/down (levels travel with their rows)
});
function bmActionDialog(i){const bm=userBM(),b=bm[i];if(!b)return;
 actionDialog({type:'bookmark'},b.action||{type:'page',page:b.page},nl=>{const list=userBM();if(!list[i])return;if(nl&&!(nl.type==='page'&&!nl.rect)){list[i].action=nl;if(nl.type==='page')list[i].page=nl.page}else{delete list[i].action;if(nl&&nl.type==='page')list[i].page=nl.page}setBM(list);toast(nl?'Bookmark → '+linkText(nl):'Bookmark action removed')})}
L3.bmActionDialog=bmActionDialog;
function bmExport(){const bm=userBM();if(!bm.length)return toast('No bookmarks to export');
 modal('Export bookmarks',`<div class="hint">Saves your ${bm.length} bookmark${bm.length===1?'':'s'} (with nesting and actions).</div>`,[{label:'Cancel',cancel:1},
  {label:'CSV',fn:()=>{saveFile(baseName()+'-bookmarks.csv',bmCsv(bm))}},{label:'XML',pri:1,fn:()=>{saveFile(baseName()+'-bookmarks.xml',bmXml(bm))}}])}
const csvQ=s=>/[",\n]/.test(s)?'"'+String(s).replace(/"/g,'""')+'"':String(s);
function bmCsv(bm){return'Title,Page,Level,Action,Target\n'+bm.map(b=>{const a=b.action;return[csvQ(b.title||''),b.page||'',b.level|0,a?a.type==='page'&&a.rect?'view':a.type:'page',a?csvQ(a.type==='url'?a.url:a.type==='file'?a.name+(a.page?'#'+a.page:''):a.rect?a.rect.join(' '):''):''].join(',')}).join('\n')+'\n'}
const xq=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
function bmXml(bm){const tree=bmTree(bm);const rec=(items,ind)=>items.map(n=>{const a=n.action;let at=` title="${xq(n.title||'')}"`+(n.page?` page="${n.page}"`:'');if(a){if(a.type==='url')at+=` url="${xq(a.url)}"`;if(a.type==='file')at+=` file="${xq(a.name)}"`+(a.page?` filePage="${a.page}"`:'');if(a.rect)at+=` area="${a.rect.join(' ')}"`}
  return n.items.length?`${ind}<bookmark${at}>\n${rec(n.items,ind+'  ')}\n${ind}</bookmark>`:`${ind}<bookmark${at}/>`}).join('\n');return`<?xml version="1.0" encoding="UTF-8"?>\n<bookmarks app="PlanMark" file="${xq(S.fileName)}">\n${rec(tree,'  ')}\n</bookmarks>\n`}
function parseCsv(t){const rows=[];let row=[],cell='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'&&t[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(x=>x.trim()))}
function bmFromCsv(t){const rows=parseCsv(t);if(!rows.length)return[];const head=rows[0].map(h=>h.trim().toLowerCase());const hasHead=head.includes('title');const ix=k=>head.indexOf(k);const body=hasHead?rows.slice(1):rows;
 return body.map(r=>{const g=k=>hasHead?(r[ix(k)]||'').trim():'';const title=hasHead?g('title'):(r[0]||'').trim(),page=+(hasHead?g('page'):r[1])||1,level=+(hasHead?g('level'):r[2])||0,act=(g('action')||'').toLowerCase(),tgt=g('target');const b={title,page:clampN(page,1,Math.max(1,S.pages.length)),level};
  if(act==='url'&&tgt)b.action={type:'url',url:tgt};else if(act==='file'&&tgt){const[n,p]=tgt.split('#');b.action={type:'file',name:n};if(+p)b.action.page=+p}else if(act==='view'&&tgt){const r4=tgt.split(/\s+/).map(Number);if(r4.length===4)b.action={type:'page',page:b.page,rect:r4,zoom:true}}return b}).filter(b=>b.title)}
function bmFromXml(t){const doc=new DOMParser().parseFromString(t,'application/xml');if(doc.querySelector('parsererror'))throw new Error('Not valid XML');const out=[];
 const rec=(el,lv)=>{for(const n of el.children){if(n.tagName.toLowerCase()!=='bookmark')continue;const page=clampN(+n.getAttribute('page')||1,1,Math.max(1,S.pages.length));const b={title:n.getAttribute('title')||'Untitled',page,level:lv};
   if(n.getAttribute('url'))b.action={type:'url',url:n.getAttribute('url')};else if(n.getAttribute('file')){b.action={type:'file',name:n.getAttribute('file')};if(+n.getAttribute('filePage'))b.action.page=+n.getAttribute('filePage')}else if(n.getAttribute('area')){const r4=n.getAttribute('area').split(/\s+/).map(Number);if(r4.length===4)b.action={type:'page',page,rect:r4,zoom:true}}
   out.push(b);rec(n,lv+1)}};rec(doc.documentElement,0);return out}
L3.bmCsv=bmCsv;L3.bmXml=bmXml;L3.bmFromCsv=bmFromCsv;L3.bmFromXml=bmFromXml;
function bmImport(){const i=document.createElement('input');i.type='file';i.accept='.csv,.xml,text/csv,application/xml,text/xml';i.onchange=async()=>{const f=i.files[0];if(!f)return;const t=await f.text();let list;try{list=/\.xml$/i.test(f.name)||/^\s*</.test(t)?bmFromXml(t):bmFromCsv(t)}catch(e){toast('Could not read bookmarks: '+e.message);return}
  if(!list.length)return toast('No bookmarks found in that file');const cur=userBM();modal('Import bookmarks',`<div class="hint">${list.length} bookmark${list.length===1?'':'s'} found in ${esc(f.name)}.</div>`,[{label:'Cancel',cancel:1},{label:'Add to mine',fn:()=>setBM([...cur,...list])},{label:'Replace mine',pri:1,fn:()=>setBM(list)}])};i.click()}
L3.importBookmarks=list=>setBM(list);
const baseName=()=>(S.fileName||'document').replace(/\.pdf$/i,'');

/* =========================== 6. DRAG THUMBNAILS TO ANOTHER DOCUMENT =========================== */
function armThumbs(){$$('#pane-pages .thumb').forEach(t=>{if(t.dataset.lk3d)return;t.dataset.lk3d='1';t.draggable=true;
 t.addEventListener('dragstart',e=>{const n=+t.dataset.p;const chosen=$$('#pane-pages .thumb.sel,#pane-pages .thumb.wsSel').map(x=>+x.dataset.p);const pages=chosen.includes(n)&&chosen.length>1?chosen.sort((a,b)=>a-b):[n];
  e.dataTransfer.setData('application/x-pm-pages',JSON.stringify({tab:Vw().curTab,pages}));e.dataTransfer.setData('text/plain','PlanMark pages '+pages.join(','));e.dataTransfer.effectAllowed='copyMove';t.classList.add('lk3Drag');L3.dragPages={tab:Vw().curTab,pages}});
 t.addEventListener('dragend',()=>{t.classList.remove('lk3Drag');setTimeout(()=>{L3.dragPages=null},50);$$('#tabBar .lk3Drop').forEach(x=>x.classList.remove('lk3Drop'))})})}
H.ready.push(()=>{const pp=$('#pane-pages');if(pp)new MutationObserver(armThumbs).observe(pp,{childList:true,subtree:false});armThumbs()});
const isPages=e=>L3.dragPages||(e.dataTransfer&&[...e.dataTransfer.types||[]].includes('application/x-pm-pages'));
document.addEventListener('dragover',e=>{if(!isPages(e))return;const t=e.target.closest&&e.target.closest('#tabBar .dtab[data-tid]');$$('#tabBar .lk3Drop').forEach(x=>{if(x!==t)x.classList.remove('lk3Drop')});
 if(t&&+t.dataset.tid!==Vw().curTab){e.preventDefault();e.stopPropagation();const ea=e.dataTransfer.effectAllowed;e.dataTransfer.dropEffect=/copy|all|uninitialized/i.test(ea)?'copy':'move';t.classList.add('lk3Drop')}},true);
document.addEventListener('drop',e=>{if(!isPages(e))return;const t=e.target.closest&&e.target.closest('#tabBar .dtab[data-tid]');if(!t)return;e.preventDefault();e.stopPropagation();t.classList.remove('lk3Drop');
 let d=L3.dragPages;try{const raw=e.dataTransfer.getData('application/x-pm-pages');if(raw)d=JSON.parse(raw)}catch(_){}if(!d||+t.dataset.tid===d.tab)return;copyPagesTo(+t.dataset.tid,d.pages)},true);
async function copyPagesTo(tid,pages){if(!S.bytes)return;pages=[...new Set(pages)].filter(n=>n>=1&&n<=S.pages.length).sort((a,b)=>a-b);if(!pages.length)return;
 const src=S.bytes,srcName=S.fileName,keep=S.markups.filter(m=>pages.includes(m.page)).map(m=>{const vp=S.pages[m.page-1].vp;return{m:JSON.parse(JSON.stringify(m)),idx:pages.indexOf(m.page),pdf:m.pts.map(q=>vp.convertToPdfPoint(q[0],q[1])),rects:m.rects?m.rects.map(r=>[vp.convertToPdfPoint(r[0],r[1]),vp.convertToPdfPoint(r[2],r[3])]):null}});
 Vw().switchTo(tid);await new Promise(r=>setTimeout(r,150));if(Vw().curTab!==tid)return toast('Could not switch to that document');const n0=S.pages.length;
 await PMBatch.rebuild(async doc=>{const s=await PL().PDFDocument.load(src,{ignoreEncryption:true});const cp=await doc.copyPages(s,pages.map(n=>n-1));cp.forEach(p=>doc.addPage(p));return Array.from({length:n0},(_,i)=>i)},'Copying pages');
 let added=0;for(const k of keep){const np=n0+k.idx+1,p=S.pages[np-1];if(!p)continue;const m=k.m;m.id=newId();m.page=np;m.pts=k.pdf.map(([x,y])=>p.vp.convertToViewportPoint(x,y));if(k.rects)m.rects=k.rects.map(([a,b])=>normBox(p.vp.convertToViewportPoint(a[0],a[1]),p.vp.convertToViewportPoint(b[0],b[1])));delete m.link;S.markups.push(m);added++}
 if(added)commit();if(P3.bmFromFiles){const bm=userBM();bm.push({title:srcName.replace(/\.pdf$/i,'')+(pages.length===1?' p'+pages[0]:' p'+pages[0]+'–'+pages[pages.length-1]),page:n0+1});setBM(bm)}
 gotoPage(n0+1,true);toast(`Copied ${pages.length} page${pages.length===1?'':'s'} from ${srcName}${added?` with ${added} markup${added===1?'':'s'}`:''}`)}
L3.copyPagesTo=copyPagesTo;

/* =========================== 7. SPLIT VIEW =========================== */
function splitOn(){const b=$('#splitBox');return!!(b&&b.classList.contains('on'))}
function toggleSplit(){const v=Vw();if(!S.pdf)return toast('Open a PDF first');if(!splitOn()){v.openSplit&&v.openSplit();return}const o=(v.V&&v.V.orient)==='h'?'v':'h';v.openSplit(o);toast(o==='h'?'Split: top / bottom':'Split: side by side')}
function balance(){const v=Vw();if(!splitOn())return toast('Split the view first (Ctrl+2 or Ctrl+3)');if(v.balance){v.balance();toast('Panes balanced');return}if(v.V)v.V.splitRatio=.5;const w=$('#viewer2wrap');if(w)w.style.flex='0 0 50%';try{v.setDim(v.V.dim)}catch(e){}setTimeout(()=>{window.dispatchEvent(new Event('resize'));try{scheduleRender()}catch(e){}},30);toast('Panes balanced')}
L3.toggleSplit=toggleSplit;L3.balance=balance;
// click into the other pane to work in it (it becomes the editable pane)
function markActive(){const a=$('#viewer'),b=$('#viewer2');if(!a||!b)return;a.classList.toggle('lk3Act',splitOn()&&!Vw().activatePane);b.classList.remove('lk3Act')}
H.ready.push(()=>{const v2=$('#viewer2');if(!v2)return;
 v2.addEventListener('pointerdown',e=>{if(Vw().activatePane||!P3.editBoth||e.button!==0||e.pointerType==='touch'||!splitOn())return;const t=T[S.tool];if(!t||t.kind==='nav')return;e.preventDefault();e.stopPropagation();activatePane2()},true);
 v2.addEventListener('dblclick',e=>{if(Vw().activatePane||!P3.editBoth||!splitOn())return;e.preventDefault();activatePane2()});setInterval(markActive,800)});
function activatePane2(){const v=Vw();if(v.activatePane)v.activatePane();else if(v.swapPanes)v.swapPanes();else return;markActive();toast('Now working in this pane')}
L3.activatePane2=activatePane2;
// tear a tab away into its own window
async function tearOff(tid){const v=Vw();if(tid!=null&&tid!==v.curTab){v.switchTo(tid);await new Promise(r=>setTimeout(r,150))}if(!S.bytes)return;const id=v.curTab,name=S.fileName;
 let bytes;try{bytes=window.PMOutput&&PMOutput.markedPdf?await PMOutput.markedPdf(false):S.bytes}catch(e){bytes=S.bytes}if(!bytes)return toast('Could not prepare the document');
 if(window.pmDesktop&&pmDesktop.newWindow){await pmDesktop.newWindow({name,bytes});(v.closeTabNow||v.closeTab)&&(v.closeTabNow||v.closeTab)(id);toast(name+' moved to a new window');return}
 const key='t'+Date.now().toString(36);try{await tearPut({key,name,bytes,at:Date.now()})}catch(e){return toast('This browser blocks moving documents between windows')}
 const w=window.open(location.pathname+'?tear='+key,'_blank');if(!w){toast('Allow pop-ups to open documents in new windows');return}v.closeTab&&v.closeTab(id);toast(name+' moved to a new window');return key}
L3.tearOff=tearOff;
let tdb=null;const tidb=()=>tdb||(tdb=new Promise((res,rej)=>{try{const r=indexedDB.open('planmark-tear',1);r.onupgradeneeded=()=>r.result.createObjectStore('docs',{keyPath:'key'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
async function ttx(mode,fn){const d=await tidb();return new Promise((res,rej)=>{const t=d.transaction('docs',mode),st=t.objectStore('docs'),r=fn(st);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})}
const tearPut=o=>ttx('readwrite',st=>st.put(o));
H.ready.push(()=>{const k=new URLSearchParams(location.search).get('tear');if(!k)return;setTimeout(async()=>{try{const o=await ttx('readonly',st=>st.get(k));if(o){await openBytes(new Uint8Array(o.bytes),o.name);await ttx('readwrite',st=>st.delete(k))}else toast('That document was already opened')}catch(e){toast('Could not open the moved document')}try{history.replaceState(null,'',location.pathname)}catch(e){}},400)});
document.addEventListener('dragend',e=>{const t=e.target.closest&&e.target.closest('#tabBar .dtab[data-tid]');if(!t)return;const bar=$('#tabBar').getBoundingClientRect();const x=e.clientX,y=e.clientY;
 const outside=(x<=0&&y<=0)?false:(x<0||y<0||x>innerWidth||y>innerHeight||y>bar.bottom+140);if(outside&&e.dataTransfer&&e.dataTransfer.dropEffect==='none')tearOff(+t.dataset.tid)},true);
document.addEventListener('contextmenu',e=>{const t=e.target.closest&&e.target.closest('#tabBar [data-tid]');if(!t)return;setTimeout(()=>ctxRows([{label:'Move to a new window',run:()=>tearOff(+t.dataset.tid)}]),0)});

/* =========================== 8. PREFERENCES =========================== */
window.PM_EXTRA_PREFS_LK=()=>[
 {s:'Tabs',l:'Shorten document tab names after (characters, 0 = never)',t:'number',min:0,max:120,g:()=>P3.tabTrunc,v:x=>setP('tabTrunc',clampN(+x||0,0,120))},
 {s:'Keyboard',l:'Alt key opens the menu bar (then press the underlined letter)',t:'bool',g:()=>P3.altMenus,v:x=>setP('altMenus',x)},
 {s:'Pages',l:'Rotate page commands rotate every page',t:'bool',g:()=>P3.rotAll,v:x=>setP('rotAll',x)},
 {s:'Markups',l:'Dragging with Polygon / Cloud / Area / Perimeter draws a rectangle',t:'select',o:[['rect','Rectangle'],['off','Off (click points only)']],g:()=>P3.polyDrag,v:x=>setP('polyDrag',x)},
 {s:'Markups',l:'Resizing several markups also scales line widths and text',t:'bool',g:()=>P3.scaleGroup,v:x=>setP('scaleGroup',x)},
 {s:'Markups',l:'Pen pressure changes line width (tablet pens)',t:'bool',g:()=>P3.pressure,v:x=>setP('pressure',x)},
 {s:'Measurements',l:'New measurements reuse the last subject and label (legacy)',t:'bool',g:()=>P3.persistSL,v:x=>setP('persistSL',x)},
 {s:'Links',l:'Web and e-mail addresses in the PDF text are clickable',t:'bool',g:()=>P3.autoUrls,v:x=>{setP('autoUrls',x);L3.hoverUrl=null;redrawAll()}},
 {s:'Bookmarks',l:'Add a bookmark for each file when combining or inserting',t:'bool',g:()=>P3.bmFromFiles,v:x=>setP('bmFromFiles',x)},
 {s:'Bookmarks',l:'Keep bookmarks in page order',t:'bool',g:()=>P3.bmAutoSort,v:x=>{setP('bmAutoSort',x);if(x&&S.pdf)setBM(userBM())}},
 {s:'Split view',l:'Clicking into either pane with a markup tool makes it the editing pane',t:'bool',g:()=>P3.editBoth,v:x=>setP('editBoth',x)},
 {s:'Startup',l:'When PlanMark starts',t:'select',o:[['none','Show the start screen'],['last','Reopen the files I had open'],['blank','Start with a new blank sheet']],g:()=>P3.startup,v:x=>{setP('startup',x);const wp=W().P;if(wp){wp.reopenLast=x==='last';LS.set('pm:ws:prefs',wp)}}},
 {s:'Status bar',l:'Cursor position units',t:'select',o:[['scale','Drawing scale units'],['in','Inches on the page'],['mm','Millimetres on the page'],['pt','PDF points']],g:()=>P3.coordUnits,v:x=>setP('coordUnits',x)},
 {s:'Status bar',l:'Cursor position measured from',t:'select',o:[['tl','Top-left corner'],['bl','Bottom-left corner (PDF style)']],g:()=>P3.coordOrigin,v:x=>setP('coordOrigin',x)},
 {s:'Status bar',l:'Cursor position decimals',t:'number',min:0,max:4,g:()=>P3.coordDec,v:x=>setP('coordDec',clampN(+x|0,0,4))},
 {s:'Messages',l:'Show hidden tips, banners and the tour again',t:'button',run:resetHidden},
 {s:'Help',l:'Take the tour',t:'button',run:()=>setTimeout(()=>startTour(true),50)}];
function resetHidden(){let n=0;for(const k of Object.keys(localStorage)){if(/^pm:(ws:seen|ws:news|dl:seen|lk3:toured)|:(seen|dismiss|dismissed|hideTip|hidden-msg)/.test(k)||/never.?show|dont.?show/i.test(k)){localStorage.removeItem(k);n++}}toast('Hidden messages will show again'+(n?` (${n} reset)`:''))}
L3.resetHidden=resetHidden;
let tabCss=null;function applyP3(){if(!tabCss){tabCss=document.createElement('style');document.head.appendChild(tabCss)}tabCss.textContent=P3.tabTrunc>0?`#tabBar .dtab{max-width:none!important}#tabBar .dtab .nm{max-width:${P3.tabTrunc}ch}`:`#tabBar .dtab{max-width:none!important}#tabBar .dtab .nm{max-width:none;overflow:visible}`}
applyP3();L3.P3=P3;L3.setP=setP;
// Alt-key menu access
let altDown=false,altUsed=false,altMode=false;
let sink=null;const exitAlt=()=>{altMode=false;document.body.classList.remove('lk3Alt');if(sink&&document.activeElement===sink)sink.blur()};
const enterAlt=()=>{altMode=true;document.body.classList.add('lk3Alt');if(!sink){sink=document.createElement('input');sink.id='lk3AltSink';sink.setAttribute('aria-hidden','true');sink.style.cssText='position:fixed;left:-50px;top:0;width:1px;height:1px;opacity:0';document.body.appendChild(sink)}sink.value='';sink.focus()};
window.addEventListener('keydown',e=>{if(e.key==='Alt'){altDown=true;altUsed=false;return}if(altDown)altUsed=true;
 if(altMode){if(e.key==='Escape'){exitAlt();e.preventDefault();return}const k=(e.key||'').toUpperCase();const el=[...$$('#wsMenu .wm')].find(x=>x.textContent.trim()[0].toUpperCase()===k);exitAlt();if(el&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();el.click()}}},true);
window.addEventListener('keyup',e=>{if(e.key!=='Alt'){if(altDown)altUsed=true;return}const tap=altDown&&!altUsed&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey;altDown=false;if(!tap||!P3.altMenus||!$('#wsMenu')||$('#wsMenu').style.display==='none')return;
 const tg=e.target;if(tg&&tg.closest&&tg.closest('input,textarea,[contenteditable]'))return;e.preventDefault();if(altMode)exitAlt();else enterAlt()},true);
window.addEventListener('pointerdown',()=>{if(altMode)exitAlt()},true);
L3.altMode=()=>altMode;
window.addEventListener('blur',()=>{altDown=false;exitAlt()});
// polygon-type tools: drag to draw a rectangle
const RECT_TOOLS=new Set(['polygon','cloud','area','perimeter','cloudplus','space','volume']);let pdg=null;
viewer.addEventListener('pointerdown',e=>{pdg=null;if(P3.polyDrag!=='rect'||e.button!==0||e.pointerType==='touch'||S.drawing||!RECT_TOOLS.has(S.tool)||!T[S.tool]||L3.pick)return;const p=pageFromEvent(e);if(!p)return;pdg={tool:S.tool,page:p.num,a:toPt(e,p),b:null,x:e.clientX,y:e.clientY,on:false}},true);
window.addEventListener('pointermove',e=>{if(!pdg||!(e.buttons&1))return;if(!pdg.on&&Math.hypot(e.clientX-pdg.x,e.clientY-pdg.y)<8)return;const p=S.pages[pdg.page-1];pdg.on=true;pdg.b=toPt(e,p);L3.dragRect={k:'poly',page:pdg.page,a:pdg.a,b:pdg.b};redrawPage(pdg.page)});
window.addEventListener('pointerup',e=>{const g=pdg;pdg=null;if(!g||!g.on)return;L3.dragRect=null;setTimeout(()=>{if(S.drawing&&S.drawing.page===g.page)cancelActive();const r=normBox(g.a,g.b);if(r[2]-r[0]<3||r[3]-r[1]<3){redrawPage(g.page);return}
  const m=newMarkup(g.tool,g.page,[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]],toolStyle(g.tool));pushUndo();S.markups.push(m);afterCreate(m)},0)},true);
// legacy: measurements remember the last subject and label
H.change.push(()=>{if(!P3.persistSL||S.sel.size!==1)return;const m=byId([...S.sel][0]);if(!m||!T[m.type]||!T[m.type].meas||m.type==='calibrate')return;const ps=LS.get(PERSIST_KEY,{})||{};const cur=ps[m.type]||{};
 const def=T[m.type].label;if((m.subject&&m.subject!==def&&m.subject!==cur.subject)||((m.label||'')!==(cur.label||'')&&m._lk3seen)){ps[m.type]={subject:m.subject,label:m.label||''};LS.set(PERSIST_KEY,ps)}m._lk3seen=1});
const _ac=afterCreate;afterCreate=function(m){try{if(P3.persistSL&&T[m.type]&&T[m.type].meas){const ps=(LS.get(PERSIST_KEY,{})||{})[m.type];if(ps){if(ps.subject)m.subject=ps.subject;if(ps.label)m.label=ps.label}}}catch(e){}
 try{if(L3.press&&(m.type==='pen'||m.type==='highlight')&&P3.pressure){const s=L3.press;L3.press=null;if(s.length>1&&s.some(x=>Math.abs(x.p-.5)>.02)){m.press=m.pts.map(q=>{let best=.5,bd=1e18;for(const o of s){const d=(o.pt[0]-q[0])**2+(o.pt[1]-q[1])**2;if(d<bd){bd=d;best=o.p}}return+best.toFixed(3)})}}}catch(e){}
 return _ac.apply(this,arguments)};
// cursor position format
window.addEventListener('pointermove',e=>{if(P3.coordUnits==='scale'&&P3.coordOrigin==='tl'&&P3.coordDec===2)return;if(!S.pages.length)return;const hp=pageFromEvent(e);if(!hp)return;const q=toPt(e,hp);const y=P3.coordOrigin==='bl'?hp.h-q[1]:q[1];const c=$('#coords');if(!c)return;
 if(P3.coordUnits==='scale'){const sc=scaleFor(hp.num);c.textContent=`x ${fmtLen(q[0]*sc.perPt,sc)}  y ${fmtLen(y*sc.perPt,sc)}`;return}
 const f=P3.coordUnits==='in'?1/72:P3.coordUnits==='mm'?25.4/72:1,u=P3.coordUnits==='in'?' in':P3.coordUnits==='mm'?' mm':' pt';c.textContent=`x ${(q[0]*f).toFixed(P3.coordDec)}${u}  y ${(y*f).toFixed(P3.coordDec)}${u}`});
// startup
H.ready.push(()=>{if(P3.startup==='last'){const wp=W().P;if(wp&&!wp.reopenLast){wp.reopenLast=true;LS.set('pm:ws:prefs',wp)}}
 if(P3.startup==='blank'&&!new URLSearchParams(location.search).get('tear'))setTimeout(()=>{if(S.pdf)return;const c=(W().CMDS||[]).find(x=>x.id==='blank');if(c)try{c.run()}catch(e){}},1600)});

/* =========================== 9. GUIDED TOUR =========================== */
const isDL=()=>document.body.classList.contains('dl');
function tourSteps(){return[
 {sel:'#wsMenu',t:'Menu bar',b:'Every command lives here. Tap Alt, then the underlined letter, to open a menu from the keyboard. Ctrl+K opens Preferences.'},
 {sel:'#left .tabs',t:'Panels',b:isDL()?'Thumbnails, bookmarks, search, layers, measurements, Tool Chest and more. Click an icon to open its panel; click it again to hide it.':'Thumbnails, bookmarks, search, layers, measurements, Tool Chest and more — pick a tab to switch panels.'},
 {sel:'#ribbon',t:'Markup and measure tools',b:'Pick a tool, then draw on the drawing. Tools have single-key shortcuts (R rectangle, C cloud, T text, Q callout, Shift+Alt+L length…).'},
 {sel:isDL()?'#dlNav':'#topbar',t:'Navigation',b:isDL()?'Split screen, Pan / Select / Select Text / Zoom, page arrows and the page box, back/forward, the dimmer, page size and scale.':'Open and save, zoom, page arrows and split screen.'},
 {sel:isDL()?'#dlMLBtn':'#mlist',t:'Markups list',b:'Every markup in a sortable, filterable table with totals for takeoff — export it to Excel or CSV.'},
 {sel:isDL()?'#topbar':'#right',t:'Properties',b:isDL()?'Select a markup and its colors, line width, style, opacity and font appear on this Properties toolbar. Alt+P opens the full Properties panel.':'Select a markup to change its colors, text, scale, layout and actions.'},
 {sel:'#bAcct',t:'Your account',b:'Sign in once and your settings, tools and profiles follow you to any computer.'},
 {sel:'#wsMenu [data-m="Help"]',t:'Help',b:'Keyboard shortcuts, what\'s new, and this tour again any time.'}].filter(s=>{const el=$(s.sel);if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0})}
let tour=null;
function startTour(force){if(tour)endTour();const steps=tourSteps();if(!steps.length)return;tour={i:0,steps};const ov=document.createElement('div');ov.id='lk3Tour';ov.innerHTML='<div class="spot"></div><div class="card"></div>';document.body.appendChild(ov);showStep();LS.set('pm:lk3:toured',true)}
function showStep(){if(!tour)return;const ov=$('#lk3Tour'),s=tour.steps[tour.i],el=$(s.sel);if(!el){return next()}const r=el.getBoundingClientRect(),pad=6;const sp=ov.querySelector('.spot');Object.assign(sp.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
 const c=ov.querySelector('.card');c.innerHTML=`<h4>${esc(s.t)}</h4><div>${esc(s.b)}</div><div class="row"><span class="stp">${tour.i+1} of ${tour.steps.length}</span><button class="btn" data-tr="skip">Skip tour</button>${tour.i?'<button class="btn" data-tr="back" style="border:1px solid var(--line)">Back</button>':''}<button class="btn pri" data-tr="next">${tour.i===tour.steps.length-1?'Done':'Next'}</button></div>`;
 const cw=300,ch=c.offsetHeight||150;let x=r.right+14,y=r.top;if(x+cw>innerWidth-8)x=r.left-cw-14;if(x<8){x=Math.min(Math.max(8,r.left),innerWidth-cw-8);y=r.bottom+14;if(y+ch>innerHeight-8)y=r.top-ch-14}y=clampN(y,8,innerHeight-ch-8);Object.assign(c.style,{left:x+'px',top:y+'px'});
 c.onclick=e=>{const b=e.target.closest('[data-tr]');if(!b)return;e.stopPropagation();if(b.dataset.tr==='next')next();else if(b.dataset.tr==='back'){tour.i=Math.max(0,tour.i-1);showStep()}else endTour()}}
function next(){if(!tour)return;tour.i++;if(tour.i>=tour.steps.length)return endTour();showStep()}
function endTour(){tour=null;const o=$('#lk3Tour');if(o)o.remove()}
L3.startTour=startTour;L3.endTour=endTour;L3.tourState=()=>tour?{i:tour.i,n:tour.steps.length,title:tour.steps[tour.i].t}:null;
window.addEventListener('pointerdown',e=>{if(tour&&!(e.target.closest&&e.target.closest('#lk3Tour .card')))endTour()},true);
window.addEventListener('keydown',e=>{if(tour&&e.key==='Escape'){endTour()}},true);
window.addEventListener('resize',()=>{if(tour)showStep()});
H.ready.push(()=>{if(navigator.webdriver||LS.get('pm:lk3:toured',false))return;let tries=0;const t=setInterval(()=>{if(++tries>40){clearInterval(t);return}if($('#pmGate')||$('#modal.on')||document.querySelector('#modalBg.on'))return;clearInterval(t);setTimeout(()=>{if(!LS.get('pm:lk3:toured',false))startTour()},600)},500)});

/* =========================== 10. PEN PRESSURE + LEADER LENGTH =========================== */
let lastDraw=null;
window.addEventListener('pointermove',e=>{const d=S.drawing;if(!d||(d.type!=='pen'&&d.type!=='highlight')||e.pointerType!=='pen'||!P3.pressure)return;if(lastDraw!==d){lastDraw=d;L3.press=[]}const p=S.pages[d.page-1];if(!p)return;L3.press.push({pt:toPt(e,p),p:e.pressure||.5})});
viewer.addEventListener('pointerdown',e=>{if(e.pointerType==='pen'&&(S.tool==='pen'||S.tool==='highlight')&&P3.pressure){const p=pageFromEvent(e);if(p){L3.press=[{pt:toPt(e,p),p:e.pressure||.5}];setTimeout(()=>{lastDraw=S.drawing},0)}}else if(e.pointerType!=='pen')L3.press=null},true);
const LEAD=new Set(['line','arrow','length','dimension']);
const _prims=prims;prims=function(m){
 if(m&&m.press&&m.press.length===m.pts.length&&m.pts.length>1&&(m.type==='pen'||m.type==='highlight')){const base=_prims.apply(this,arguments);const st=m.style||{};const w=Math.max(.5,st.width||(m.type==='highlight'?12:2));const pts=m.pts,L=[],R=[];
  for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dy=b[1]-a[1];const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;const hw=w/2*(.25+1.5*clampN(m.press[i],0,1));L.push([pts[i][0]-dy*hw,pts[i][1]+dx*hw]);R.push([pts[i][0]+dy*hw,pts[i][1]-dx*hw])}
  const poly=[...L,...R.reverse()];const col=st.stroke||'#e0312b';const main=base.find(q=>q.k==='p');const op=main&&main.so!=null?main.so:(st.opacity??1);
  return[{k:'p',d:dPoly(poly,true),stroke:'none',w:0,fill:col,fo:op},...base.filter(q=>q!==main)]}
 if(m&&LEAD.has(m.type)&&m.style&&+m.style.leadLen&&m.pts.length>=2){const ll=+m.style.leadLen,le=+m.style.leadExt||0;const a=m.pts[0],b=m.pts[1];let dx=b[0]-a[0],dy=b[1]-a[1];const len=Math.hypot(dx,dy)||1;const nx=-dy/len,ny=dx/len;
  const off=q=>[q[0]+nx*ll,q[1]+ny*ll];const shifted=Object.assign({},m,{pts:[off(a),off(b),...m.pts.slice(2)]});const base=_prims.call(this,shifted);
  const sg=Math.sign(ll),ext=q=>[q[0]+nx*(ll+sg*le),q[1]+ny*(ll+sg*le)];const st=m.style;const leg={k:'p',d:dPoly([a,ext(a)])+' '+dPoly([b,ext(b)]),stroke:st.stroke||'#e0312b',w:Math.max(.5,(st.width||1)*.75),so:st.opacity??1};
  return[leg,...base]}
 return _prims.apply(this,arguments)};
H.props.push((m,mode,type)=>{if(!LEAD.has(type))return'';const st=mode==='sel'&&m?m.style:(S.defaults[type]||{});return`<div class="row fld" style="gap:6px"><div><label style="font-size:11px;color:var(--mut)">Leader length (pt)</label><input class="ti" type="number" step="1" data-lk3s="leadLen" value="${+st.leadLen||0}"></div><div><label style="font-size:11px;color:var(--mut)">Leader extension (pt)</label><input class="ti" type="number" step="1" min="0" data-lk3s="leadExt" value="${+st.leadExt||0}"></div></div>`});
$('#props').addEventListener('change',e=>{const k=e.target.dataset.lk3s;if(!k)return;const v=+e.target.value||0;const s=sel();if(s.length){pushUndo();for(const m of s)if(LEAD.has(m.type)){if(v)m.style[k]=v;else delete m.style[k];m.modified=Date.now()}commit()}else if(S.defaults[S.tool]){if(v)S.defaults[S.tool][k]=v;else delete S.defaults[S.tool][k];LS.set('pm:defaults',S.defaults)}});

/* =========================== commands =========================== */
H.ready.push(()=>{setTimeout(()=>{const C=W().CMDS;if(!C)return;const c=(id,menu,label,key,run,o={})=>Object.assign({id,menu,label,key:key||'',run},o);const need=f=>()=>{if(!S.pdf)return toast('Open a PDF first');f()};
 const tg=C.find(x=>x.id==='togsplit');if(tg){tg.run=toggleSplit;tg.label='Toggle split (flip side-by-side / top-bottom)'}
 C.push(c('lk3:action','Edit','Edit action…','Ctrl+Shift+E',editAction),c('lk3:balance','View','Balance split panes','Shift+F12',balance),c('lk3:tear','Window','Move this tab to a new window','',need(()=>tearOff(Vw().curTab))),
  c('lk3:findlinks','Document','Find hyperlinks in content…','',need(findLinksDialog)),c('lk3:seltext','Tools','Select Text','Shift+Alt+T',need(()=>setTool('seltext'))),c('lk3:tour','Help','Take the tour','',()=>startTour(true)),
  c('lk3:bmexp','Document','Export bookmarks…','',need(bmExport)),c('lk3:bmimp','Document','Import bookmarks…','',need(bmImport)));
 if(W().P&&P3.startup==='last'&&!W().P.reopenLast){W().P.reopenLast=true}},60)});
L3.version=1;
})();
