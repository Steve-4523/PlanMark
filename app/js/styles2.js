/* PlanMark — styles2: markup layers & PDF layers, rich text & text layout, line styles & custom hatches (PAT),
   blend modes, stamp designer (dynamic / interactive stamps, folders, review sets), camera / crop / 360° / video capture,
   capture summary, file-attachment markups, squiggly, copy-highlighted-text, pop-ups, translate, snapshot options. */
(function(){
'use strict';
const PL=PDFLib;
const S2={exp:null,clip:null,pressure:null};
const pref=(k,d)=>{const p=LS.get('pm:s2prefs',{});return p[k]===undefined?d:p[k]};
const setPref=(k,v)=>{const p=LS.get('pm:s2prefs',{});p[k]=v;LS.set('pm:s2prefs',p)};
window.PM_EXTRA_SYNC_KEYS_ST=['pm:linestyles','pm:hatches','pm:stamps2','pm:s2prefs'];

/* ================================================================== tool registrations */
Object.assign(T,{squiggly:{label:'Squiggly',kind:'drag',textm:1},cstamp:{label:'Stamp+',kind:'click'},fattach:{label:'Attach File',kind:'click'},
 vsnap:{label:'Vector Snapshot',kind:'drag',box:1,closed:1}});
Object.assign(BASE_DEF,{squiggly:{stroke:'#16a34a',width:1.2,opacity:1},cstamp:{stroke:'#c62828',width:2,opacity:.95,scale:1},fattach:{stroke:'#1d4ed8',width:1.2,opacity:1,fill:'#dbeafe',fillOpacity:1},vsnap:{stroke:'#000000',width:0,opacity:1}});
for(const k of['squiggly','cstamp','fattach','vsnap'])if(!S.defaults[k])S.defaults[k]=clone(BASE_DEF[k]);
Object.assign(IC,{squiggly:'<path d="M5 6v5a4 4 0 008 0V6"/><path d="M3 18l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2"/>',
 cstamp:'<path d="M9.5 3h5l-.8 7H18l1 5H5l1-5h4.3zM5 19h14"/><path d="M18 3v4M16 5h4"/>',
 fattach:'<path d="M15.5 7.5l-6.4 6.4a1.8 1.8 0 002.6 2.6l6.6-6.6a3.6 3.6 0 00-5.1-5.1L6.4 11.6a5.4 5.4 0 007.6 7.6l5.5-5.5"/>',
 vsnap:'<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M7 15l3-4 3 3 4-5"/>'});
Object.assign(KEYS,{squiggly:'Shift+U',fattach:'F'});
Object.assign(HINTS,{squiggly:'Drag across PDF text to squiggly-underline it',cstamp:'Click to place the stamp',fattach:'Click where the attachment icon goes',vsnap:'Vector snapshot'});
RIBBON[1][1].push('squiggly','cstamp','fattach');

/* ================================================================== helpers */
const readURL=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src});
const b64bytes=u=>Uint8Array.from(atob(u.split(',')[1]),c=>c.charCodeAt(0));
const bytesB64=b=>{let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return btoa(s)};
function pickFile(accept,multiple,capture){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept||'';i.multiple=!!multiple;if(capture)i.setAttribute('capture',capture);i.onchange=()=>res([...i.files]);i.click()})}
function rotPt(p,c,a){const r=a*Math.PI/180,co=Math.cos(r),si=Math.sin(r),dx=p[0]-c[0],dy=p[1]-c[1];return[c[0]+dx*co-dy*si,c[1]+dx*si+dy*co]}
function pathPts(d){const out=[];let cur=null;const tk=String(d).match(/[MLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[];let i=0;while(i<tk.length){const c=tk[i++];if(c==='M'||c==='L'){const p=[+tk[i],+tk[i+1]];i+=2;if(c==='M'){cur=[p];out.push(cur)}else cur&&cur.push(p)}else if(c==='Z'||c==='z'){if(cur&&cur.length)cur.closed=true}else i++}return out}
function geomOf(m){const p=m.pts||[];
 if(['line','arrow','polyline','length','polylength','dimension','calibrate'].includes(m.type))return{pts:p,closed:false};
 if(['polygon','area','perimeter','volume','space'].includes(m.type))return{pts:p,closed:true};
 if(['rect','text','redact'].includes(m.type)&&p.length>1){const b=normBox(p[0],p[1]);return{pts:[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],closed:true}}
 if(m.type==='ellipse'&&p.length>1){const b=normBox(p[0],p[1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,rx=(b[2]-b[0])/2,ry=(b[3]-b[1])/2,a=[];for(let i=0;i<72;i++){const t=i/72*Math.PI*2;a.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t)])}return{pts:a,closed:true}}
 return null}
function along(pts,closed,every,offset){const P=closed?[...pts,pts[0]]:pts,out=[];let acc=-(offset??every/2);for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],L=dist(a,b);if(L<1e-6)continue;let t=-acc;while(t<=L){if(t>=0)out.push({p:[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L],ang:Math.atan2(b[1]-a[1],b[0]-a[0])});t+=every}acc=L-(t-every)}return out}

/* ================================================================== 1. MARKUP LAYERS + PDF LAYERS (OCGs) */
const ML=()=>{if(!S.scales)S.scales={};if(!S.scales.mlayers)S.scales.mlayers=[];return S.scales.mlayers};
const layerOf=m=>m&&m.layer?ML().find(l=>l.id===m.layer):null;
function layerChain(l){const ch=[];let g=0;while(l&&g++<20){ch.push(l);l=l.parent?ML().find(x=>x.id===l.parent):null}return ch}
const effVisible=m=>{const l=layerOf(m);return!l||layerChain(l).every(x=>x.visible!==false)};
const effPrint=m=>{const l=layerOf(m);return!l||layerChain(l).every(x=>x.print!==false)};
const effLocked=m=>{const l=layerOf(m);return!!l&&layerChain(l).some(x=>x.locked)};
function syncLocks(){for(const m of S.markups){const L=effLocked(m);if(L&&!m.locked){m.locked=true;m._layerLock=true}else if(!L&&m._layerLock){delete m.locked;delete m._layerLock}}}
function layerChanged(){syncLocks();if(S.sel&&S.sel.size){const keep=[...S.sel].filter(id=>{const m=byId(id);return m&&effVisible(m)});if(keep.length!==S.sel.size)setSel(keep)}saveScales();commit();renderMLayers()}
// hide markups on hidden layers (screen)
const _msvg=markupSvg;markupSvg=function(m,prev){if(!prev&&!effVisible(m))return'';return _msvg.apply(this,arguments)};
// paste: optionally drop layer assignment
const _paste=paste;paste=function(){const before=new Set(S.markups.map(m=>m.id));const r=_paste.apply(this,arguments);if(!pref('retainLayer',true)){for(const m of S.markups)if(!before.has(m.id)&&m.layer)delete m.layer;commit()}return r};
function renderMLayers(){const pane=$('#pane-layers');if(!pane)return;let sec=$('#s2Layers');if(!sec){sec=document.createElement('div');sec.id='s2Layers';pane.appendChild(sec)}
 const L=ML(),cnt=id=>S.markups.filter(m=>(m.layer||'')===id).length,states=(S.scales&&S.scales.mlstates)||[];
 const rows=[];const walk=(par,d)=>{for(const l of L.filter(x=>(x.parent||'')===par)){rows.push([l,d]);walk(l.id,d+1)}};walk('',0);
 sec.innerHTML=`<div class="sec" style="margin-top:14px">Markup layers</div>
 <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px"><button class="btn" data-ml="new" style="border:1px solid var(--line)">+ Layer</button>
 <select class="ti" id="s2Assign" style="flex:1;min-width:110px"><option value="">Assign selected to…</option><option value="__none">(no layer)</option>${L.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></div>
 ${rows.map(([l,d])=>`<div class="row" data-lid="${esc(l.id)}" style="gap:4px;padding:3px 0 3px ${d*14}px;border-bottom:1px solid #30363f">
  <input type="checkbox" data-ml="vis" ${l.visible!==false?'checked':''} title="Visible" style="flex:0"><span data-ml="ren" style="flex:1;cursor:text;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Double-click to rename">${esc(l.name)} <small style="color:var(--mut)">${cnt(l.id)}</small></span>
  <button class="btn" data-ml="lock" title="Lock" style="flex:0;padding:0 4px;height:22px;opacity:${l.locked?1:.4}">🔒</button><button class="btn" data-ml="print" title="Print" style="flex:0;padding:0 4px;height:22px;opacity:${l.print!==false?1:.35}">🖨</button>
  <button class="btn" data-ml="sub" title="New sub-layer" style="flex:0;padding:0 4px;height:22px">+</button><button class="btn" data-ml="del" title="Delete layer" style="flex:0;padding:0 4px;height:22px">✕</button></div>`).join('')||'<div class="hint">No markup layers yet. Layers let you show, hide, lock or skip printing groups of markups, and they become real PDF layers in saved files.</div>'}
 <div class="hint" style="margin:4px 0">Unassigned markups: ${cnt('')}</div>
 <div class="row" style="gap:4px;flex-wrap:wrap"><select class="ti" id="s2States" style="flex:1;min-width:110px"><option value="">Layer states…</option>${states.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('')}</select>
 <button class="btn" data-ml="ssave" style="border:1px solid var(--line)">Save state</button><button class="btn" data-ml="sreset" style="border:1px solid var(--line)">Reset</button></div>
 <label class="chk" style="margin-top:6px"><input type="checkbox" id="s2Retain" ${pref('retainLayer',true)?'checked':''}> Keep layer when copying markups</label>
 <div class="sec">PDF layers (in the file)</div><div id="s2Ocg"><div class="hint">…</div></div>
 <div class="row" style="gap:4px;margin-top:6px"><button class="btn" data-ml="layered" style="border:1px solid var(--line)">Insert layered pages…</button></div>`;
 renderOcgList()}
function mlClick(e){const b=e.target.closest('[data-ml]');if(!b)return;const a=b.dataset.ml,row=b.closest('[data-lid]'),l=row&&ML().find(x=>x.id===row.dataset.lid);
 if(a==='new'||a==='sub')return modalPrompt(a==='sub'?'New sub-layer':'New markup layer','Layer name',a==='sub'?l.name+' – detail':'Layer '+(ML().length+1),n=>{ML().push({id:'L'+uid().slice(1),name:n,parent:a==='sub'?l.id:'',visible:true,print:true,locked:false});layerChanged()});
 if(!l&&!['ssave','sreset','layered'].includes(a))return;
 if(a==='lock'){l.locked=!l.locked;layerChanged()}if(a==='print'){l.print=l.print===false;layerChanged()}
 if(a==='del')return modal('Delete layer "'+l.name+'"?','<div class="hint">Markups on it (and its sub-layers) stay on the sheet, unassigned.</div>',[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:()=>{const ids=new Set(layerChainDown(l).map(x=>x.id));pushUndo();for(const m of S.markups)if(ids.has(m.layer))delete m.layer;S.scales.mlayers=ML().filter(x=>!ids.has(x.id));layerChanged()}}]);
 if(a==='ssave')return modalPrompt('Save layer state','Name','State '+(((S.scales.mlstates)||[]).length+1),n=>{S.scales.mlstates=(S.scales.mlstates||[]).concat({name:n,v:Object.fromEntries(ML().map(x=>[x.id,{visible:x.visible!==false,print:x.print!==false,locked:!!x.locked}]))});layerChanged();toast('Layer state saved')});
 if(a==='sreset'){ML().forEach(x=>{x.visible=true;x.print=true;x.locked=false});layerChanged();toast('All layers visible')}
 if(a==='layered')layeredDialog()}
function layerChainDown(l){const out=[l];for(const c of ML().filter(x=>x.parent===l.id))out.push(...layerChainDown(c));return out}
function mlChange(e){const t=e.target;if(t.id==='s2Assign'&&t.value){const ids=[...S.sel];if(!ids.length){toast('Select markups first');t.value='';return}pushUndo();for(const id of ids){const m=byId(id);if(!m)continue;if(t.value==='__none')delete m.layer;else m.layer=t.value;m.modified=Date.now()}layerChanged();toast('Assigned '+ids.length);return}
 if(t.id==='s2States'&&t.value!==''){const st=S.scales.mlstates[+t.value];for(const l of ML()){const v=st.v[l.id];if(v)Object.assign(l,v)}layerChanged();toast('Layer state "'+st.name+'" restored');return}
 if(t.id==='s2Retain'){setPref('retainLayer',t.checked);return}
 const row=t.closest('[data-lid]');if(row&&t.dataset.ml==='vis'){const l=ML().find(x=>x.id===row.dataset.lid);l.visible=t.checked;layerChanged();return}
 if(t.dataset.ocg){ocToggle(t.dataset.ocg,t.checked)}}
function mlDbl(e){const s=e.target.closest('[data-ml="ren"]');if(!s)return;const l=ML().find(x=>x.id===s.closest('[data-lid]').dataset.lid);modalPrompt('Rename layer','Name',l.name,n=>{l.name=n;layerChanged()})}
// ---- PDF optional content (OCGs) in the open document
const OCT=new WeakMap();// transport -> {cfg,dirty}
async function ocInfo(){if(!S.pdf)return null;const tr=S.pdf._transport;let st=OCT.get(tr);if(!st){let cfg=null;try{cfg=await S.pdf.getOptionalContentConfig()}catch(e){}st={cfg,dirty:false};OCT.set(tr,st)}return st}
async function renderOcgList(){const el=$('#s2Ocg');if(!el)return;const st=await ocInfo();const cfg=st&&st.cfg;const groups=[];
 if(cfg){try{for(const[id,g]of cfg)groups.push([id,g])}catch(e){try{const order=cfg.getOrder()||[];const flat=o=>o.forEach(x=>typeof x==='string'?groups.push([x,cfg.getGroup(x)]):x&&x.order?flat(x.order):null);flat(order)}catch(_){}}}
 el.innerHTML=groups.length?groups.map(([id,g])=>`<label class="chk"><input type="checkbox" data-ocg="${esc(id)}" ${g.visible!==false?'checked':''}> ${esc(g.name||id)}</label>`).join(''):'<div class="hint">This PDF has no layers of its own.</div>'}
async function ocToggle(id,v){const st=await ocInfo();if(!st||!st.cfg)return;st.cfg.setVisibility(id,v);st.dirty=true;for(const p of S.pages)p.rs=0;renderVisible()}
// make pdf.js render with our optional-content state once the user has toggled something
(async function patchRender(){const t=setInterval(async()=>{if(!S.pdf)return;clearInterval(t);try{const pg=await S.pdf.getPage(1),proto=Object.getPrototypeOf(pg);if(proto.__pmOC)return;const orig=proto.render;proto.__pmOC=true;
  proto.render=function(params){try{if(params&&!params.optionalContentConfigPromise){const st=OCT.get(this._transport);if(st&&st.dirty&&st.cfg)params=Object.assign({},params,{optionalContentConfigPromise:Promise.resolve(st.cfg)})}}catch(e){}return orig.call(this,params)}}catch(e){}},400)})();
// ---- OCG writing (export)
function ocReg(doc){if(!doc.__pmOC)doc.__pmOC={byKey:new Map(),list:[]};return doc.__pmOC}
function ocgRef(doc,key,name,visible,print){const R=ocReg(doc);if(R.byKey.has(key))return R.byKey.get(key).ref;const ctx=doc.context;
 const d=ctx.obj({Type:'OCG',Name:PL.PDFHexString.fromText(name),Usage:{Print:{PrintState:print?'ON':'OFF'},View:{ViewState:visible?'ON':'OFF'}}});const ref=ctx.register(d);R.byKey.set(key,{ref,visible,print,name});R.list.push(ref);return ref}
function ocTag(page,ref){const ctx=page.doc.context;const{Resources}=page.node.normalizedEntries();let props=Resources.lookupMaybe(PL.PDFName.of('Properties'),PL.PDFDict);if(!props){props=ctx.obj({});Resources.set(PL.PDFName.of('Properties'),props)}
 for(const[k,v]of props.entries())if(v===ref)return k.decodeText?k.decodeText():String(k).slice(1);let n=1;while(props.get(PL.PDFName.of('PMOC'+n)))n++;const tag='PMOC'+n;props.set(PL.PDFName.of(tag),ref);return tag}
const BDC=tag=>PL.PDFOperator.of(PL.PDFOperatorNames.BeginMarkedContentSequence,[PL.PDFName.of('OC'),PL.PDFName.of(tag)]);
const EMC=()=>PL.PDFOperator.of(PL.PDFOperatorNames.EndMarkedContent);
function finishOC(doc){const R=doc.__pmOC;if(!R||!R.list.length)return;const ctx=doc.context,N=n=>PL.PDFName.of(n);let ocp=doc.catalog.lookupMaybe(N('OCProperties'),PL.PDFDict);
 if(!ocp){ocp=ctx.obj({OCGs:[],D:{Name:PL.PDFHexString.fromText('PlanMark layers'),Order:[],ON:[],OFF:[]}});doc.catalog.set(N('OCProperties'),ocp)}
 let ocgs=ocp.lookupMaybe(N('OCGs'),PL.PDFArray);if(!ocgs){ocgs=ctx.obj([]);ocp.set(N('OCGs'),ocgs)}
 let D=ocp.lookupMaybe(N('D'),PL.PDFDict);if(!D){D=ctx.obj({});ocp.set(N('D'),D)}
 const arr=k=>{let a=D.lookupMaybe(N(k),PL.PDFArray);if(!a){a=ctx.obj([]);D.set(N(k),a)}return a};const order=arr('Order'),on=arr('ON'),off=arr('OFF'),printOff=[];
 for(const[,v]of R.byKey){ocgs.push(v.ref);order.push(v.ref);(v.visible?on:off).push(v.ref);if(!v.print)printOff.push(v.ref)}
 const AS=arr('AS');AS.push(ctx.obj({Event:'Print',Category:['Print'],OCGs:R.list}));AS.push(ctx.obj({Event:'View',Category:['View'],OCGs:R.list}))}
// patch pdf-lib drawing so a markup's operators are wrapped in its layer and get its blend mode
(function patchPdfLib(){const PP=PL.PDFPage.prototype;if(PP.__pmS2)return;PP.__pmS2=true;
 for(const fn of['drawSvgPath','drawText','drawImage','drawPage','drawRectangle','drawLine','drawEllipse','drawCircle']){const o=PP[fn];if(!o)continue;
  PP[fn]=function(...a){const X=S2.exp;if(!X||(!X.cur&&!X.blend))return o.apply(this,a);
   if(X.blend&&a.length>1&&a[1]&&typeof a[1]==='object'&&!a[1].blendMode&&PL.BlendMode[X.blend])a[1].blendMode=PL.BlendMode[X.blend];
   if(!X.cur)return o.apply(this,a);let tag;try{tag=ocTag(this,X.cur)}catch(e){return o.apply(this,a)}this.pushOperators(BDC(tag));try{return o.apply(this,a)}finally{this.pushOperators(EMC())}}}})();
// export wrapper: knows when an export is running and whether it is for printing
const _exp=exportPDF;exportPDF=async function(flat){const printing=!!flat&&/out\s*=\s*new Uint8Array/.test(String(saveFile));
 S2.exp={cur:null,blend:null,print:printing,flat:!!flat,doc:null};const ld=PL.PDFDocument.load;PL.PDFDocument.load=async function(){const d=await ld.apply(this,arguments);if(S2.exp&&!S2.exp.doc)S2.exp.doc=d;return d};
 try{return await _exp.apply(this,arguments)}finally{PL.PDFDocument.load=ld;S2.exp=null}};
H.exportPage.unshift(async(doc)=>{if(S2.exp){S2.exp.cur=null;S2.exp.blend=null;S2.exp.doc=doc}});
// layered pages: draw another PDF's page into this document as a separate PDF layer
function layeredDialog(){if(!S.bytes)return toast('Open a PDF first');
 modal('Insert layered pages',`<div class="hint" style="margin-bottom:8px">Adds a page from another PDF on top of a page of this one, as a PDF layer you (or anyone) can switch on and off — e.g. a consultant's sheet over the architectural plan.</div>
 <div class="fld"><label>Other PDF</label><input type="file" class="ti" id="lyF" accept="application/pdf,.pdf"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">This document's page</label><input class="ti" type="number" id="lyA" min="1" max="${S.pages.length}" value="${S.cur}"></div><div><label style="font-size:11px;color:var(--mut)">Other PDF's page</label><input class="ti" type="number" id="lyB" min="1" value="1"></div></div>
 <div class="fld"><label>Layer names</label><div class="row"><input class="ti" id="lyN1" value="Base"><input class="ti" id="lyN2" placeholder="defaults to the file name"></div></div>`,
 [{label:'Cancel',cancel:1},{label:'Insert',pri:1,fn:md=>{const f=md.querySelector('#lyF').files[0];if(!f){toast('Choose the other PDF');return false}const o={f,a:+md.querySelector('#lyA').value||1,b:+md.querySelector('#lyB').value||1,n1:md.querySelector('#lyN1').value||'Base',n2:md.querySelector('#lyN2').value||f.name.replace(/\.pdf$/i,'')};setTimeout(()=>insertLayered(o),0)}}])}
async function insertLayered(o){try{const other=await PL.PDFDocument.load(new Uint8Array(await o.f.arrayBuffer()),{ignoreEncryption:true});
 await PMBatch.rebuild(async doc=>{const pg=doc.getPage(clamp(o.a,1,doc.getPageCount())-1),src=other.getPage(clamp(o.b,1,other.getPageCount())-1),emb=await doc.embedPage(src);
  // existing page content -> base layer
  const ctx=doc.context,base=ocgRef(doc,'base:'+o.a,o.n1,true,true),over=ocgRef(doc,'ovl:'+o.a+':'+o.n2,o.n2,true,true);
  const tB=ocTag(pg,base),tO=ocTag(pg,over);pg.node.wrapContentStreams(ctx.register(ctx.contentStream([BDC(tB)])),ctx.register(ctx.contentStream([EMC()])));
  const w=pg.getWidth(),h=pg.getHeight(),s=Math.min(w/emb.width,h/emb.height);pg.pushOperators(BDC(tO));pg.drawPage(emb,{x:(w-emb.width*s)/2,y:(h-emb.height*s)/2,xScale:s,yScale:s});pg.pushOperators(EMC());if(emb.embed)await emb.embed();// embed now: page rebuilds garbage-collect before save
  finishOC(doc);return Array.from({length:doc.getPageCount()},(_,i)=>i)},'Inserting layered page');
 setTimeout(renderMLayers,800);toast('Layered page added — toggle it under PDF layers')}catch(e){console.error(e);toast('Could not insert: '+(e.message||e))}}

/* ================================================================== 2. TEXT: rich text, layout, borders, leaders */
const TEXTT=['text','callout','typewriter'];
function baseSpan(m){const s=m.style;return{b:!!s.bold,i:!!s.italic,u:false,s:false,c:s.color||s.stroke,sz:s.fontSize||12,f:s.font||'Helvetica'}}
function richSpans(m){if(m.rich&&m.rich.length)return m.rich;const b=baseSpan(m);return[Object.assign({t:String(m.text||'')},b)]}
const sameStyle=(a,b)=>a.b===b.b&&a.i===b.i&&a.u===b.u&&a.s===b.s&&a.c===b.c&&a.sz===b.sz&&a.f===b.f;
function layoutRich(spans,maxW,lh,vertical){const lines=[];let line={runs:[],w:0,h:0};const push=()=>{if(!line.h)line.h=(spans[0]?spans[0].sz:12)*lh;lines.push(line);line={runs:[],w:0,h:0}};
 const add=(text,sp)=>{const w=tw(text,sp.sz,sp.b,sp.f,sp.i),last=line.runs[line.runs.length-1];if(last&&sameStyle(last,sp)){last.t+=text;last.w+=w}else line.runs.push(Object.assign({},sp,{t:text,w}));line.w+=w;line.h=Math.max(line.h,sp.sz*lh)};
 for(const sp of spans){const txt=String(sp.t||'');
  if(vertical){for(const ch of txt){if(ch==='\n'){push();push();continue}add(ch,sp);push()}continue}
  for(const piece of txt.split(/(\n|\s+)/)){if(piece==='')continue;if(piece==='\n'){push();continue}
   const w=tw(piece,sp.sz,sp.b,sp.f,sp.i),ws=/^\s+$/.test(piece);if(ws&&!line.runs.length)continue;
   if(line.runs.length&&line.w+w>maxW&&!ws){// trim trailing space then wrap
    const lr=line.runs[line.runs.length-1];if(lr&&/\s$/.test(lr.t)){const t2=lr.t.replace(/\s+$/,''),d=lr.w-tw(t2,lr.sz,lr.b,lr.f,lr.i);lr.t=t2;lr.w-=d;line.w-=d}push()}
   add(piece,sp)}}
 if(line.runs.length||!lines.length)push();const W=Math.max(0,...lines.map(l=>l.w)),Hh=lines.reduce((a,l)=>a+l.h,0);return{lines,W,H:Hh}}
const needsLayout=m=>TEXTT.includes(m.type)&&((m.rich&&m.rich.length)||['trot','vert','lh','pad','align','wrapOff'].some(k=>m.style[k]!==undefined&&m.style[k]!==''&&m.style[k]!==0&&m.style[k]!==false));
function textBox(m){const p=m.pts;if(m.type==='text'&&p.length>1)return normBox(p[0],p[1]);if(m.type==='callout'&&p.length>2)return normBox(p[1],p[2]);return null}
function typewriterLayout(m){const s=m.style,L=layoutRich(richSpans(m),s.wrapW?+s.wrapW:Infinity,+s.lh||1.2,!!s.vert),[x,y]=m.pts[0];return{L,b:[x,y,x+Math.max(L.W,4),y+Math.max(L.H,4)]}}
function emitText(m,box,L,pad,out){const s=m.style,innerW=box[2]-box[0]-2*pad,al=s.align||'left',rot=+s.trot||0,o=s.opacity??1;
 const c=m.type==='typewriter'?[box[0],box[1]]:[(box[0]+box[2])/2,(box[1]+box[3])/2];let y=box[1]+pad;
 for(const ln of L.lines){let x=box[0]+pad;if(al==='center')x+=(innerW-ln.w)/2;else if(al==='right')x+=innerW-ln.w;const yc=y+ln.h/2;
  for(const r of ln.runs){if(r.t){const at=rot?rotPt([x,yc],c,rot):[x,yc];out.push({k:'t',x:at[0],y:at[1],s:r.t,size:r.sz,color:r.c,bold:r.b,italic:r.i,font:r.f,ang:rot,align:'start',halo:false,o});
    const deco=(yy)=>{const a=rotPt([x,yy],c,rot),b=rotPt([x+r.w,yy],c,rot);out.push({k:'p',d:dPoly([a,b]),stroke:r.c,w:Math.max(.5,r.sz*.06),so:o,fill:null,fo:1,dash:''})};
    if(r.u)deco(yc+r.sz*.42);if(r.s)deco(yc+r.sz*.02)}x+=r.w}y+=ln.h}}
function applyTextLayout(m,out){if(!needsLayout(m))return out;const s=m.style;const keep=out.filter(p=>p.k!=='t');
 if(m.type==='typewriter'){const g=typewriterLayout(m);const res=keep.filter(p=>!(p.d&&p.d===dBox(typeGeom(m).b)));if((s.width||0)>0)res.push({k:'p',d:dBox(g.b),stroke:s.stroke,w:s.width,so:s.opacity??1,fill:null,fo:1,dash:''});emitText(m,g.b,g.L,0,res);return res}
 const box=textBox(m);if(!box)return out;const pad=s.pad!=null&&s.pad!==''?+s.pad:Math.max(3,(s.fontSize||12)*.35);
 const L=layoutRich(richSpans(m),s.wrapOff?Infinity:box[2]-box[0]-2*pad,+s.lh||1.2,!!s.vert);emitText(m,box,L,pad,keep);return keep}
function applyBorder(m,out){const s=m.style;if(!s.border||!['text','callout'].includes(m.type))return out;const box=textBox(m);if(!box)return out;const d=dBox(box),i=out.findIndex(p=>p.k==='p'&&p.d===d);if(i<0)return out;const p=Object.assign({},out[i]);
 if(s.border==='none')p.stroke=null;else if(s.border==='cloud'){p.d=dCloud([[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]],Math.max(4,+s.cloud||7));p.dash=''}else if(['dash','dot','dashdot'].includes(s.border))p.dash=s.border;else p.dash='';out[i]=p;return out}
function applyLeader(m,out){const s=m.style;if(m.type!=='callout'||m.pts.length<3||!(+s.knee>0||s.leadHead))return out;const tip=m.pts[0],b=normBox(m.pts[1],m.pts[2]),e=leaderEnd(tip,b),dl=dPoly([e,tip]);
 const i=out.findIndex(p=>p.k==='p'&&p.d===dl);if(i<0)return out;const res=out.slice();res.splice(i,res[i+1]&&res[i+1].fill===s.stroke?2:1);
 const kn=+s.knee||0;let pts=[e,tip];if(kn>0){const sx=e[0]===b[0]?-1:e[0]===b[2]?1:0,sy=sx?0:(e[1]===b[1]?-1:1);const k=[e[0]+sx*kn,e[1]+sy*kn];pts=[e,k,tip]}
 res.splice(i,0,{k:'p',d:dPoly(pts),stroke:s.stroke,w:s.width??1,so:s.opacity??1,fill:null,fo:1,dash:''});const hp=[];const head=s.leadHead||'arrow';if(head!=='none')headPrim(hp,pts[pts.length-2],tip,s,head);res.splice(i+1,0,...hp);return res}
// rich text editor
function rtHtml(spans){return spans.map(sp=>{const st=[sp.b?'font-weight:bold':'',sp.i?'font-style:italic':'',(sp.u||sp.s)?`text-decoration:${sp.u?'underline ':''}${sp.s?'line-through':''}`:'',`color:${sp.c}`,`font-size:${(sp.sz*1.3).toFixed(1)}px`,`font-family:${FONTS[sp.f]||FONTS.Helvetica}`].filter(Boolean).join(';');return`<span style="${esc(st)}">${esc(sp.t).replace(/\n/g,'<br>')}</span>`}).join('')}
function rgbHex(c){const m=String(c).match(/\d+(\.\d+)?/g);if(!m)return'#000000';return'#'+m.slice(0,3).map(v=>(+v|0).toString(16).padStart(2,'0')).join('')}
function famKey(f){f=String(f);return/times|serif(?!-)|georgia/i.test(f)&&!/sans/i.test(f)?'Times':/courier|mono/i.test(f)?'Courier':'Helvetica'}
function parseRich(root){const out=[];const pushT=(t,el,deco)=>{if(!t)return;const cs=getComputedStyle(el);const sp={t,b:(+cs.fontWeight||400)>=600,i:cs.fontStyle==='italic',u:deco.u,s:deco.s,c:rgbHex(cs.color),sz:Math.round(parseFloat(cs.fontSize)/1.3*2)/2,f:famKey(cs.fontFamily)};const last=out[out.length-1];if(last&&sameStyle(last,sp))last.t+=t;else out.push(sp)};
 const walk=(n,deco,first)=>{for(const c of n.childNodes){if(c.nodeType===3){pushT(c.nodeValue.replace(/ /g,' '),c.parentElement,deco);continue}if(c.nodeType!==1)continue;const tag=c.tagName;
   if(tag==='BR'){pushT('\n',c.parentElement||root,deco);continue}const block=/^(DIV|P|LI)$/.test(tag);if(block&&out.length&&!/\n$/.test(out[out.length-1].t))pushT('\n',c,deco);
   const td=String(c.style&&c.style.textDecoration||'')+' '+String(c.style&&c.style.textDecorationLine||'');const d2={u:deco.u||tag==='U'||/underline/.test(td),s:deco.s||tag==='S'||tag==='STRIKE'||tag==='DEL'||/line-through/.test(td)};walk(c,d2)}};
 walk(root,{u:false,s:false});while(out.length&&/^\n*$/.test(out[out.length-1].t)&&out.length>1)out.pop();return out}
function richEditor(m){const spans=richSpans(m);const sizes=[6,7,8,9,10,11,12,14,16,18,20,24,28,32,36,48];
 modal('Rich text',`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px">${[['bold','<b>B</b>'],['italic','<i>I</i>'],['underline','<u>U</u>'],['strikeThrough','<s>S</s>']].map(([c,l])=>`<button class="btn" data-rc="${c}" style="flex:0;border:1px solid var(--line);min-width:30px;justify-content:center">${l}</button>`).join('')}
  <input type="color" id="rtC" value="${spans[0].c||'#e0312b'}" style="flex:0;width:40px;height:30px"><select class="ti" id="rtS" style="flex:0;width:70px">${sizes.map(z=>`<option ${z===(spans[0].sz|0)?'selected':''}>${z}</option>`).join('')}</select>
  <select class="ti" id="rtF" style="flex:0;width:110px">${Object.keys(FONTS).map(f=>`<option>${f}</option>`).join('')}</select><button class="btn" data-rc="removeFormat" style="flex:0;border:1px solid var(--line)">Clear</button></div>
  <div id="rtEd" contenteditable="true" style="min-height:130px;max-height:50vh;overflow:auto;background:#fff;color:#111;padding:10px;border-radius:6px;outline:none;line-height:1.3">${rtHtml(spans)}</div>
  <div class="hint" style="margin-top:6px">Select text, then use the buttons. Sizes are in points.</div>`,
 [{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{const r=parseRich($('#rtEd'));pushUndo();m.rich=r;m.text=r.map(x=>x.t).join('');if(m.style.autosize)autosize(m);m.modified=Date.now();commit();renderProps()}}]);
 const ed=$('#rtEd');ed.focus();try{document.execCommand('styleWithCSS',false,true)}catch(e){}
 const md=$('#modal');md.querySelectorAll('[data-rc]').forEach(b=>b.onmousedown=e=>{e.preventDefault();document.execCommand(b.dataset.rc,false,null)});
 $('#rtC').oninput=e=>{ed.focus();document.execCommand('foreColor',false,e.target.value)};
 $('#rtF').onchange=e=>{ed.focus();document.execCommand('fontName',false,FONTS[e.target.value])};
 $('#rtS').onchange=e=>{ed.focus();document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');document.execCommand('styleWithCSS',false,true);
  ed.querySelectorAll('font[size="7"]').forEach(f=>{const sp=document.createElement('span');sp.style.fontSize=(+e.target.value*1.3)+'px';sp.innerHTML=f.innerHTML;f.replaceWith(sp)});
  ed.querySelectorAll('span').forEach(s=>{if(s.style.fontSize==='xxx-large'||s.style.fontSize==='-webkit-xxx-large')s.style.fontSize=(+e.target.value*1.3)+'px'})}}
function autosize(m){if(m.type==='text'&&m.pts.length>1){const b=normBox(m.pts[0],m.pts[1]),s=m.style,pad=s.pad!=null&&s.pad!==''?+s.pad:Math.max(3,(s.fontSize||12)*.35);
  const L=layoutRich(richSpans(m),s.wrapOff?Infinity:b[2]-b[0]-2*pad,+s.lh||1.2,!!s.vert);const w=s.wrapOff||s.vert?L.W+2*pad:b[2]-b[0];m.pts=[[b[0],b[1]],[b[0]+Math.max(w,10),b[1]+Math.max(L.H+2*pad,10)]]}
 else if(m.type==='callout'&&m.pts.length>2){const b=normBox(m.pts[1],m.pts[2]),s=m.style,pad=s.pad!=null&&s.pad!==''?+s.pad:Math.max(3,(s.fontSize||12)*.35);const L=layoutRich(richSpans(m),b[2]-b[0]-2*pad,+s.lh||1.2,!!s.vert);m.pts[1]=[b[0],b[1]];m.pts[2]=[b[2],b[1]+Math.max(L.H+2*pad,10)]}}
const _bbox=bboxOf;bboxOf=function(m){if(m&&m.type==='typewriter'&&needsLayout(m)){const g=typewriterLayout(m);if(+m.style.trot){const c=[g.b[0],g.b[1]],pts=[[g.b[0],g.b[1]],[g.b[2],g.b[1]],[g.b[2],g.b[3]],[g.b[0],g.b[3]]].map(p=>rotPt(p,c,+m.style.trot));return ptsBox(pts)}return g.b}
 if(m&&m.type==='cstamp')return stampBox(m);if(m&&m.type==='fattach'){const[x,y]=m.pts[0];return[x,y,x+14,y+20]}return _bbox.apply(this,arguments)};
// pop-ups
function popupPrims(m,out){if(!m.popup)return;if(S2.exp&&!(S2.exp.print?pref('printPopups',false):pref('savePopups',true)))return;const b=bboxOf(m),x=b[2]+8,y=b[1],w=170,fs=8,op=+(m.style.popOp??.92);
 const head=`${m.author||''} · ${fmtDT(m.modified||m.created)}`,lines=wrap(m.comment||m.text||'(no comment)',w-10,fs).slice(0,14),h=fs*2+lines.length*fs*1.25+10;
 out.push({k:'p',d:dBox([x,y,x+w,y+h]),stroke:'#a16207',w:.8,so:op,fill:'#fffbea',fo:op,dash:''},{k:'p',d:dPoly([[b[2],b[1]+4],[x,y+6]]),stroke:'#a16207',w:.6,so:op,fill:null,fo:1,dash:'dot'});
 out.push({k:'t',x:x+5,y:y+fs*.9,s:head,size:fs*.9,color:'#78350f',bold:true,ang:0,align:'start',halo:false,o:op});lines.forEach((l,i)=>out.push({k:'t',x:x+5,y:y+fs*2.2+i*fs*1.25,s:l,size:fs,color:'#1f2937',bold:false,ang:0,align:'start',halo:false,o:op}))}
// squiggly + copy highlighted text into comment
function squigglyPrims(m,out){const s=m.style;for(const r of(m.rects||[normBox(m.pts[0],m.pts[1])])){const hgt=r[3]-r[1],a=Math.max(.6,hgt*.08),per=Math.max(2,hgt*.32),y=r[3]-a*1.2,pts=[];let k=0;for(let x=r[0];x<=r[2];x+=per/2,k++)pts.push([x,y+(k%2?a:-a)]);if(pts.length>1)out.push({k:'p',d:dPoly(pts),stroke:s.stroke,w:s.width??1.2,so:s.opacity??1,fill:null,fo:1,dash:''})}}
async function textUnder(m){const{items,vp}=await pageText(m.page);const hits=[];for(const it of items){let r;if(it.vb)r=it.vb;else{const q=vp.convertToViewportRectangle([it.x,it.y-it.h*.2,it.x+it.w,it.y+it.h*.85]);r=normBox([q[0],q[1]],[q[2],q[3]])}
  for(const R of m.rects||[]){if(r[0]<R[2]&&r[2]>R[0]&&r[1]<R[3]&&r[3]>R[1]){const str=it.str||'',L=str.length||1,cw=(r[2]-r[0])/L,i0=Math.max(0,Math.round((R[0]-r[0])/cw)),i1=Math.min(L,Math.round((R[2]-r[0])/cw));const t=(it.vb?str:str.slice(i0,Math.max(i0,i1))).trim();if(t)hits.push({t,y:(r[1]+r[3])/2,x:r[0]+i0*cw});break}}}
 hits.sort((a,b)=>Math.abs(a.y-b.y)>3?a.y-b.y:a.x-b.x);return hits.map(h=>h.t).join(' ').replace(/\s+/g,' ').trim()}
const _ac=afterCreate;afterCreate=function(m){const r=_ac.apply(this,arguments);
 if(T[m.type]&&T[m.type].textm&&m.rects&&pref('copyText',true)&&!m.comment){textUnder(m).then(t=>{if(t&&!m.comment){m.comment=t;commit();renderProps()}}).catch(()=>{})}
 if(m.type==='cstamp')setTimeout(()=>stampFieldsPrompt(m),0);
 if(m.type==='fattach'&&!m.att){S.markups=S.markups.filter(x=>x!==m);commit();toast('Choose a file first (Attach File)')}
 if(m.layer==null&&pref('curLayer','')&&ML().some(l=>l.id===pref('curLayer','')))m.layer=pref('curLayer','');
 return r};

/* ================================================================== 3. LINE STYLES & CUSTOM HATCHES */
const BUILTIN_LS=[{id:'hidden',name:'Hidden',dash:[3,2]},{id:'center',name:'Centerline',dash:[12,3,3,3]},{id:'phantom',name:'Phantom',dash:[12,3,3,3,3,3]},{id:'property',name:'Property line',dash:[16,3,3,3,3,3]},
 {id:'row',name:'Right-of-way',dash:[20,6]},{id:'fence',name:'Fence',dash:[],sym:{t:'x',every:28,size:4}},{id:'gas',name:'Gas line',dash:[],sym:{t:'text',text:'G',every:60,size:8}},{id:'water',name:'Water line',dash:[],sym:{t:'text',text:'W',every:60,size:8}},
 {id:'sewer',name:'Sanitary sewer',dash:[],sym:{t:'text',text:'SS',every:70,size:8}},{id:'elec',name:'Underground electric',dash:[8,3],sym:{t:'text',text:'E',every:60,size:8}},{id:'tel',name:'Telecom',dash:[8,3],sym:{t:'text',text:'T',every:60,size:8}},
 {id:'silt',name:'Silt fence',dash:[],sym:{t:'circle',every:16,size:2.4}},{id:'fire',name:'Fire-rated wall',dash:[10,3],sym:{t:'tick',every:18,size:5}},{id:'tree',name:'Tree line',dash:[],sym:{t:'scallop',every:12,size:4}},{id:'dots',name:'Dotted',dash:[],sym:{t:'dot',every:6,size:1}}];
const allLS=()=>[...BUILTIN_LS,...LS.get('pm:linestyles',[])];
function syncDash(){for(const l of allLS())if(l.dash&&l.dash.length)DASH['ls:'+l.id]=l.dash}syncDash();
function lineSymbols(m,ls,out){const g=geomOf(m);if(!g||g.pts.length<2||!ls.sym)return;const s=m.style,sy=ls.sym,sz=+sy.size||4,col=s.stroke,o=s.opacity??1,w=s.width??1;
 for(const{p,ang}of along(g.pts,g.closed,Math.max(3,+sy.every||40))){const c=Math.cos(ang),sn=Math.sin(ang),n=[-sn,c];
  if(sy.t==='text')out.push({k:'t',x:p[0],y:p[1],s:sy.text||'?',size:sz,color:col,bold:true,ang:readable([0,0],[c,sn]),align:'middle',halo:true,o});
  else if(sy.t==='x'){const a=sz;out.push({k:'p',d:`M${P2([p[0]-a,p[1]-a])} L${P2([p[0]+a,p[1]+a])} M${P2([p[0]+a,p[1]-a])} L${P2([p[0]-a,p[1]+a])}`,stroke:col,w,so:o,fill:null,fo:1,dash:''})}
  else if(sy.t==='circle')out.push({k:'p',d:dCircle(p,sz),stroke:col,w,so:o,fill:'#ffffff',fo:1,dash:''});
  else if(sy.t==='dot')out.push({k:'p',d:dCircle(p,sz),stroke:null,w:0,so:1,fill:col,fo:o,dash:''});
  else if(sy.t==='tick')out.push({k:'p',d:dPoly([p,[p[0]+n[0]*sz,p[1]+n[1]*sz]]),stroke:col,w,so:o,fill:null,fo:1,dash:''});
  else if(sy.t==='scallop'){const a=[p[0]-c*sz,p[1]-sn*sz],b=[p[0]+c*sz,p[1]+sn*sz];out.push({k:'p',d:`M${P2(a)} A${sz} ${sz} 0 0 1 ${P2(b)}`,stroke:col,w,so:o,fill:null,fo:1,dash:''})}}}
function applyLineStyle(m,out){const id=m.style.lineStyle;if(!id)return out;const ls=allLS().find(l=>l.id===id);if(!ls)return out;const g=geomOf(m);if(!g)return out;
 const i=out.findIndex(p=>p.k==='p'&&p.stroke);if(i<0)return out;const p=Object.assign({},out[i]);
 if(ls.sym&&(!ls.dash||!ls.dash.length)&&ls.sym.t!=='text'&&ls.sym.t!=='x'&&ls.sym.t!=='tick'&&ls.sym.t!=='circle')p.stroke=null;// pure symbol lines (scallop / dots) replace the stroke
 p.dash=ls.dash&&ls.dash.length?'ls:'+ls.id:'';if(p.stroke===null&&!p.fill)out.splice(i,1);else out[i]=p;lineSymbols(m,ls,out);return out}
// ---- PAT hatches
function parsePAT(text){const pats=[];let cur=null;for(let raw of String(text).split(/\r?\n/)){const line=raw.replace(/;.*$/,'').trim();if(!line)continue;
  if(line[0]==='*'){const[n,...d]=line.slice(1).split(',');cur={id:'pat-'+n.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:n.trim(),desc:d.join(',').trim(),families:[]};pats.push(cur);continue}
  if(!cur)continue;const v=line.split(',').map(x=>parseFloat(x));if(v.length<5||v.some(isNaN))continue;cur.families.push({ang:v[0],ox:v[1],oy:v[2],dx:v[3],dy:v[4],dash:v.slice(5)})}
 return pats.filter(p=>p.families.length)}
const BUILTIN_PAT=`*ANSI31, ANSI iron, brick, stone masonry
45, 0,0, 0,.125
*ANSI37, ANSI lead, zinc, magnesium, sound/heat/elec insulation
45, 0,0, 0,.125
135, 0,0, 0,.125
*AR-BRSTD, Standard brick pattern
0, 0,0, 0,2.667
90, 0,0, 2.667,4, 2.667,-2.667
*DASH, Dashed lines
0, 0,0, .125,.125, .125,-.125
*GRAVEL, Gravel-ish dashes
63.4, 0,0, .45,.2, .2,-.3
-63.4, .1,0, .45,.2, .2,-.3
*SQUARE, Small squares
0, 0,0, 0,.125, .125,-.125
90, 0,0, 0,.125, .125,-.125
*STEEL, Steel material
45, 0,0, 0,.125
45, 0,.0625, 0,.125, .125,-.125`;
const allHatch=()=>[...parsePAT(BUILTIN_PAT).map(p=>Object.assign(p,{builtin:true})),...LS.get('pm:hatches',[])];
function patSegs(rings,pat,scale){const b=ptsBox(rings.flat()),segs=[],MAX=24000;
 for(const f of pat.families){const a=-f.ang*Math.PI/180,u=[Math.cos(a),Math.sin(a)],n=[-u[1],u[0]],ox=f.ox*scale,oy=-f.oy*scale,dx=f.dx*scale,dy=f.dy*scale;
  if(Math.abs(dy)<1e-6)continue;const corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];
  const pn=corners.map(c=>(c[0]-ox)*n[0]+(c[1]-oy)*n[1]),pu=corners.map(c=>(c[0]-ox)*u[0]+(c[1]-oy)*u[1]);
  // successive lines are offset by (dx along, dy perpendicular). PAT's perpendicular is to the left of the direction; y is flipped here
  const step=-dy,k0=Math.floor(Math.min(...pn)/step),k1=Math.ceil(Math.max(...pn)/step);const ka=Math.min(k0,k1),kb=Math.max(k0,k1);
  const L=f.dash.length?f.dash.reduce((s,v)=>s+Math.abs(v),0)*scale:0;
  for(let k=ka;k<=kb&&segs.length<MAX;k++){const base=[ox+n[0]*k*step+u[0]*k*dx,oy+n[1]*k*step+u[1]*k*dx];const t0=Math.min(...pu)-Math.abs(k*dx)-L-2,t1=Math.max(...pu)+Math.abs(k*dx)+L+2;
   const P=t=>[base[0]+u[0]*t,base[1]+u[1]*t];
   if(!L){segs.push(...PMClip.clipSeg(P(t0),P(t1),rings));continue}
   let t=Math.floor((t0)/L)*L;while(t<t1&&segs.length<MAX){for(const dv of f.dash){const len=Math.abs(dv)*scale;if(dv>0)segs.push(...PMClip.clipSeg(P(t),P(t+len),rings));else if(dv===0){const q=P(t);if(PMClip.ptIn(q,rings))segs.push([q,[q[0]+u[0]*.3,q[1]+u[1]*.3]])}t+=len}}}}
 return segs}
function applyCustomHatch(m,out){const h=m.style.hatch;if(!h||!String(h).startsWith('c:'))return out;const pat=allHatch().find(p=>'c:'+p.id===h);if(!pat||!window.PMHatch)return out;const rings=PMHatch.shapeRings(m);if(!rings)return out;
 const s=m.style,segs=patSegs(rings,pat,Math.max(1,+s.hatchScale||12));if(!segs.length)return out;
 out.splice(Math.min(1,out.length),0,{k:'p',d:segs.map(q=>'M'+P2(q[0])+' L'+P2(q[1])).join(' '),stroke:s.hatchColor||s.stroke,w:+s.hatchW||.6,so:s.hatchOp??.8,fill:null,fo:1,dash:''});return out}
function lineStyleManager(){const own=LS.get('pm:linestyles',[]);
 modal('Line styles',`<div class="hint" style="margin-bottom:8px">Built-in: ${BUILTIN_LS.map(l=>esc(l.name)).join(', ')}. Add your own below — dash pattern in multiples of the line width (e.g. "10,3,2,3"), plus an optional symbol repeated along the line.</div>
 ${own.map((l,i)=>`<div class="res" style="display:flex;justify-content:space-between"><span>${esc(l.name)} <small style="color:var(--mut)">${(l.dash||[]).join(',')||'solid'}${l.sym?' · '+esc(l.sym.t)+(l.sym.text?' "'+esc(l.sym.text)+'"':''):''}</small></span><span data-lsx="${i}" style="cursor:pointer;opacity:.6">✕</span></div>`).join('')}
 <div class="fld" style="margin-top:8px"><label>Name</label><input class="ti" id="lsN" placeholder="e.g. Storm drain"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Dash pattern</label><input class="ti" id="lsD" placeholder="10,3"></div><div><label style="font-size:11px;color:var(--mut)">Symbol</label><select class="ti" id="lsT"><option value="">None</option><option value="text">Text</option><option value="x">X</option><option value="circle">Circle</option><option value="dot">Dot</option><option value="tick">Tick</option><option value="scallop">Scallop</option></select></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Symbol text</label><input class="ti" id="lsX" placeholder="SD"></div><div><label style="font-size:11px;color:var(--mut)">Every (pt)</label><input class="ti" id="lsE" type="number" value="50"></div><div><label style="font-size:11px;color:var(--mut)">Size (pt)</label><input class="ti" id="lsS" type="number" value="8"></div></div>
 <div class="row" style="gap:6px"><button class="btn" id="lsExp" style="border:1px solid var(--line)">Export</button><button class="btn" id="lsImp" style="border:1px solid var(--line)">Import…</button></div>`,
 [{label:'Close',cancel:1},{label:'Add style',pri:1,fn:md=>{const n=md.querySelector('#lsN').value.trim();if(!n){toast('Name it');return false}const d=md.querySelector('#lsD').value.split(/[ ,]+/).map(Number).filter(v=>v>0);const t=md.querySelector('#lsT').value;
   const st={id:'u'+uid().slice(1),name:n,dash:d,sym:t?{t,text:md.querySelector('#lsX').value||'?',every:+md.querySelector('#lsE').value||50,size:+md.querySelector('#lsS').value||8}:null};LS.set('pm:linestyles',[...LS.get('pm:linestyles',[]),st]);syncDash();toast('Line style added');renderProps()}}]);
 $('#modal').querySelectorAll('[data-lsx]').forEach(x=>x.onclick=()=>{const a=LS.get('pm:linestyles',[]);a.splice(+x.dataset.lsx,1);LS.set('pm:linestyles',a);closeModal();lineStyleManager()});
 $('#lsExp').onclick=()=>saveFile('planmark-line-styles.json',JSON.stringify({app:'PlanMark',lineStyles:LS.get('pm:linestyles',[])},null,1));
 $('#lsImp').onclick=async()=>{const[f]=await pickFile('.json,application/json');if(!f)return;try{const j=JSON.parse(await f.text());const add=(j.lineStyles||[]).filter(x=>x&&x.name);LS.set('pm:linestyles',[...LS.get('pm:linestyles',[]),...add.map(x=>Object.assign({},x,{id:'u'+uid().slice(1)}))]);syncDash();closeModal();toast(`Imported ${add.length} line styles`)}catch(e){toast('Not a line-style file')}}}
function hatchManager(){const own=LS.get('pm:hatches',[]);
 modal('Hatch patterns',`<div class="hint" style="margin-bottom:8px">Import AutoCAD hatch patterns (.pat) or build your own from line families. Use them from a shape's Properties → Hatch.</div>
 ${allHatch().map(p=>`<div class="res" style="display:flex;justify-content:space-between"><span>${esc(p.name)} <small style="color:var(--mut)">${p.families.length} line famil${p.families.length>1?'ies':'y'}${p.builtin?' · built-in':''}</small></span>${p.builtin?'':`<span data-hx="${esc(p.id)}" style="cursor:pointer;opacity:.6">✕</span>`}</div>`).join('')}
 <div class="row" style="gap:6px;margin:8px 0"><button class="btn" id="hpImp" style="border:1px solid var(--line)">Import .pat…</button><button class="btn" id="hpExp" style="border:1px solid var(--line)">Export mine (.pat)</button></div>
 <div class="sec">New pattern</div><div class="fld"><label>Name</label><input class="ti" id="hpN" placeholder="e.g. Rigid insulation"></div>
 <div class="fld"><label>Line families — one per line: angle, spacing, offset along, dash pattern (e.g. "45, 6, 0, 4 -2")</label><textarea class="ti" id="hpF" rows="3" placeholder="45, 6, 0&#10;135, 6, 0, 3 -3"></textarea></div>`,
 [{label:'Close',cancel:1},{label:'Create',pri:1,fn:md=>{const n=md.querySelector('#hpN').value.trim();const fams=md.querySelector('#hpF').value.split(/\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const[a,sp,off,...rest]=l.split(',');return{ang:+a||0,ox:0,oy:0,dx:+off||0,dy:+sp||6,dash:(rest.join(' ')||'').trim().split(/\s+/).filter(Boolean).map(Number)}}).filter(f=>f.dy);
   if(!n||!fams.length){toast('Give it a name and at least one line family');return false}// families entered in pt; store with unit scale 1/12 so the default scale (12) gives pt
   const p={id:'h'+uid().slice(1),name:n,families:fams.map(f=>Object.assign(f,{dx:f.dx/12,dy:f.dy/12,dash:f.dash.map(v=>v/12)}))};LS.set('pm:hatches',[...LS.get('pm:hatches',[]),p]);toast('Hatch pattern created');renderProps()}}]);
 $('#modal').querySelectorAll('[data-hx]').forEach(x=>x.onclick=()=>{LS.set('pm:hatches',LS.get('pm:hatches',[]).filter(p=>p.id!==x.dataset.hx));closeModal();hatchManager()});
 $('#hpImp').onclick=async()=>{const fs=await pickFile('.pat,text/plain',true);let n=0;for(const f of fs){const pats=parsePAT(await f.text());const cur=LS.get('pm:hatches',[]);for(const p of pats){p.id='h-'+p.id;if(!cur.some(c=>c.id===p.id)){cur.push(p);n++}}LS.set('pm:hatches',cur)}closeModal();toast(`Imported ${n} hatch pattern${n===1?'':'s'}`);hatchManager()};
 $('#hpExp').onclick=()=>saveFile('planmark-hatches.pat',LS.get('pm:hatches',[]).map(p=>`*${p.name.toUpperCase().replace(/[ ,]/g,'_')}, ${p.desc||p.name}\n`+p.families.map(f=>[f.ang,f.ox,f.oy,f.dx,f.dy,...f.dash].map(v=>+(+v).toFixed(5)).join(', ')).join('\n')).join('\n')+'\n')}
window.PMStyles2={parsePAT,patSegs,layoutRich,allLS,allHatch};

/* ================================================================== 5. STAMP DESIGNER (dynamic + interactive) */
const fieldVal=(m,k)=>{const f=m.fields||{};if(f[k]!=null)return f[k];return''};
function fillTokens(str,m){return String(str||'').replace(/\{(\w+)\}/g,(_,k)=>fieldVal(m,k)||'')}
const REVIEW=(title,col)=>({name:title,folder:'Review',w:190,h:74,fields:['reviewer','comments'],color:col,elements:[
 {k:'rrect',x:2,y:2,w:186,h:70,stroke:col,width:2.4,fill:'none'},{k:'rrect',x:6,y:6,w:178,h:62,stroke:col,width:.8,fill:'none'},
 {k:'text',x:95,y:24,text:title,size:title.length>14?14:18,bold:true,color:col,align:'center'},{k:'line',x:14,y:37,w:162,h:0,stroke:col,width:.6},
 {k:'text',x:14,y:48,text:'BY: {reviewer}',size:8,color:col},{k:'text',x:110,y:48,text:'DATE: {date}',size:8,color:col},{k:'text',x:14,y:60,text:'{comments}',size:7,color:col}]});
const DEFAULT_STAMPS=[REVIEW('APPROVED','#15803d'),REVIEW('APPROVED AS NOTED','#1d4ed8'),REVIEW('REVISE & RESUBMIT','#c2410c'),REVIEW('REJECTED','#b91c1c'),
 {name:'RECEIVED',folder:'Office',w:150,h:56,fields:[],color:'#7c3aed',elements:[{k:'ellipse',x:2,y:2,w:146,h:52,stroke:'#7c3aed',width:2,fill:'none'},{k:'text',x:75,y:22,text:'RECEIVED',size:15,bold:true,color:'#7c3aed',align:'center'},{k:'text',x:75,y:38,text:'{date} {time}',size:8,color:'#7c3aed',align:'center'}]},
 {name:'FIELD VERIFY',folder:'Field',w:150,h:46,fields:['location'],color:'#d97706',elements:[{k:'rect',x:2,y:2,w:146,h:42,stroke:'#d97706',width:2,fill:'#fffbeb'},{k:'text',x:75,y:18,text:'FIELD VERIFY',size:13,bold:true,color:'#b45309',align:'center'},{k:'text',x:75,y:33,text:'{author} · {location}',size:7.5,color:'#b45309',align:'center'}]},
 {name:'SHOP DRAWING REVIEW',folder:'Review',w:210,h:96,fields:['status','reviewer','spec'],color:'#0f766e',elements:[{k:'rect',x:2,y:2,w:206,h:92,stroke:'#0f766e',width:2,fill:'none'},{k:'text',x:105,y:16,text:'SHOP DRAWING REVIEW',size:11,bold:true,color:'#0f766e',align:'center'},{k:'line',x:8,y:25,w:194,h:0,stroke:'#0f766e',width:.6},
  {k:'text',x:10,y:38,text:'STATUS: {status}',size:8.5,bold:true,color:'#0f766e'},{k:'text',x:10,y:52,text:'SPEC SECTION: {spec}',size:8,color:'#0f766e'},{k:'text',x:10,y:66,text:'REVIEWED BY: {reviewer}',size:8,color:'#0f766e'},{k:'text',x:10,y:80,text:'DATE: {date}  PROJECT FILE: {file}',size:7,color:'#0f766e'}]}];
function stampLib(){let lib=LS.get('pm:stamps2',null);if(!lib||!lib.stamps){lib={stamps:DEFAULT_STAMPS.map(s=>Object.assign({id:'st'+uid().slice(1)},clone(s)))};LS.set('pm:stamps2',lib)}return lib}
function stampBox(m){const d=m.stampDef||{w:100,h:40},k=+(m.style.scale||1),[cx,cy]=m.pts[0];return[cx-d.w*k/2,cy-d.h*k/2,cx+d.w*k/2,cy+d.h*k/2]}
function stampPrims(m,out){const d=m.stampDef;if(!d)return;const k=+(m.style.scale||1),b=stampBox(m),o=m.style.opacity??1,X=x=>b[0]+x*k,Y=y=>b[1]+y*k;
 for(const e of d.elements||[]){const st=e.stroke||e.color||d.color||'#c62828',fill=e.fill&&e.fill!=='none'?e.fill:null,w=(+e.width||1)*k;
  if(e.k==='rect')out.push({k:'p',d:dBox([X(e.x),Y(e.y),X(e.x+e.w),Y(e.y+e.h)]),stroke:st,w,so:o,fill,fo:o,dash:''});
  else if(e.k==='rrect'){const x0=X(e.x),y0=Y(e.y),x1=X(e.x+e.w),y1=Y(e.y+e.h),r=Math.min(6*k,(x1-x0)/4,(y1-y0)/4);out.push({k:'p',d:`M${P2([x0+r,y0])} L${P2([x1-r,y0])} A${r} ${r} 0 0 1 ${P2([x1,y0+r])} L${P2([x1,y1-r])} A${r} ${r} 0 0 1 ${P2([x1-r,y1])} L${P2([x0+r,y1])} A${r} ${r} 0 0 1 ${P2([x0,y1-r])} L${P2([x0,y0+r])} A${r} ${r} 0 0 1 ${P2([x0+r,y0])} Z`,stroke:st,w,so:o,fill,fo:o,dash:''})}
  else if(e.k==='ellipse')out.push({k:'p',d:dEll([X(e.x),Y(e.y),X(e.x+e.w),Y(e.y+e.h)]),stroke:st,w,so:o,fill,fo:o,dash:''});
  else if(e.k==='line')out.push({k:'p',d:dPoly([[X(e.x),Y(e.y)],[X(e.x+e.w),Y(e.y+e.h)]]),stroke:st,w,so:o,fill:null,fo:1,dash:''});
  else if(e.k==='text'){const s=fillTokens(e.text,m);if(s)out.push({k:'t',x:X(e.x),y:Y(e.y),s,size:(+e.size||10)*k,color:e.color||st,bold:!!e.bold,italic:!!e.italic,ang:0,align:e.align==='center'?'middle':'start',halo:false,o})}
  else if(e.k==='image'&&e.src)out.push({k:'img',b:[X(e.x),Y(e.y),X(e.x+e.w),Y(e.y+e.h)],src:e.src,o})}}
const _nm=newMarkup;newMarkup=function(type,page,pts,style){const m=_nm.apply(this,arguments);
 if(type==='cstamp'&&S.cstamp){m.stampDef=clone(S.cstamp);m.subject=S.cstamp.name;const now=new Date();m.fields={date:now.toLocaleDateString(),time:now.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),author:settings.author,file:S.fileName||'',page:String(page),pages:String(S.pages.length)};for(const f of S.cstamp.fields||[])if(m.fields[f]==null)m.fields[f]=f==='reviewer'?settings.author:''}
 if(type==='fattach'&&S.fattach){m.att=S.fattach;m.subject='File Attachment';m.comment=S.fattach.name}
 if(type==='vsnap'&&S2.clip){m.vsnap=S2.clip.pdf;m.img=S2.clip.png;m.subject='Vector snapshot'}
 if(pref('curLayer','')&&ML().some(l=>l.id===pref('curLayer','')))m.layer=pref('curLayer','');
 return m};
function stampFieldsPrompt(m){const d=m.stampDef;const ask=(d&&d.fields||[]).filter(f=>!['date','time','author','file','page','pages'].includes(f));if(!ask.length)return;
 modal(d.name+' — stamp details',ask.map(f=>`<div class="fld"><label>${esc(f[0].toUpperCase()+f.slice(1))}</label>${f==='status'?`<select class="ti" data-sf="${f}"><option>Approved</option><option>Approved as noted</option><option>Revise & resubmit</option><option>Rejected</option><option>For record only</option></select>`:`<input class="ti" data-sf="${f}" value="${esc(m.fields[f]||'')}">`}</div>`).join(''),
 [{label:'Skip',cancel:1},{label:'Apply',pri:1,fn:md=>{md.querySelectorAll('[data-sf]').forEach(i=>m.fields[i.dataset.sf]=i.value);m.modified=Date.now();commit();renderProps()}}])}
function stampPicker(){const lib=stampLib(),folders=[...new Set(lib.stamps.map(s=>s.folder||'My stamps'))];
 const prev=s=>{const m={type:'cstamp',pts:[[s.w/2,s.h/2]],style:{scale:1,opacity:1},stampDef:s,fields:{date:new Date().toLocaleDateString(),time:'',author:settings.author,reviewer:settings.author,file:'',page:'1',comments:'',status:'Approved',location:'',spec:''}};const ps=[];stampPrims(m,ps);return`<svg viewBox="0 0 ${s.w} ${s.h}" style="width:100%;max-height:60px;background:#fff;border-radius:4px">${ps.map(primSvg).join('')}</svg>`};
 modal('Stamps',folders.map(f=>`<div class="sec">${esc(f)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${lib.stamps.filter(s=>(s.folder||'My stamps')===f).map(s=>`<div class="res" data-sid="${esc(s.id)}" style="border:1px solid var(--line);border-radius:6px">${prev(s)}<div class="row" style="justify-content:space-between;margin-top:4px"><small>${esc(s.name)}${(s.fields||[]).length?' · asks':''}</small><span><span data-se="${esc(s.id)}" title="Edit" style="cursor:pointer">✎</span> <span data-sd="${esc(s.id)}" title="Delete" style="cursor:pointer;opacity:.6">✕</span></span></div></div>`).join('')}</div>`).join('')+
 `<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="spNew" style="border:1px solid var(--line)">New stamp…</button><button class="btn" id="spExp" style="border:1px solid var(--line)">Export library</button><button class="btn" id="spImp" style="border:1px solid var(--line)">Import…</button><button class="btn" id="spRst" style="border:1px solid var(--line)">Restore defaults</button></div>`,[{label:'Close',cancel:1}]);
 const md=$('#modal');md.addEventListener('click',e=>{const ed=e.target.closest('[data-se]'),dl=e.target.closest('[data-sd]');if(ed){e.stopPropagation();closeModal();return stampEditor(lib.stamps.find(s=>s.id===ed.dataset.se))}
  if(dl){e.stopPropagation();lib.stamps=lib.stamps.filter(s=>s.id!==dl.dataset.sd);LS.set('pm:stamps2',lib);closeModal();return stampPicker()}
  const it=e.target.closest('[data-sid]');if(it){S.cstamp=lib.stamps.find(s=>s.id===it.dataset.sid);closeModal();setTool('cstamp');toast(S.cstamp.name+': click to place')}});
 $('#spNew').onclick=()=>{closeModal();stampEditor(null)};$('#spExp').onclick=()=>saveFile('planmark-stamps.json',JSON.stringify({app:'PlanMark',stamps:lib.stamps},null,1));
 $('#spImp').onclick=async()=>{const[f]=await pickFile('.json,application/json');if(!f)return;try{const j=JSON.parse(await f.text());const add=(j.stamps||[]).filter(s=>s&&s.elements);add.forEach(s=>s.id='st'+uid().slice(1));lib.stamps.push(...add);LS.set('pm:stamps2',lib);closeModal();toast(`Imported ${add.length} stamps`);stampPicker()}catch(e){toast('Not a stamp library')}};
 $('#spRst').onclick=()=>{lib.stamps=[...lib.stamps.filter(s=>!DEFAULT_STAMPS.some(d=>d.name===s.name)),...DEFAULT_STAMPS.map(s=>Object.assign({id:'st'+uid().slice(1)},clone(s)))];LS.set('pm:stamps2',lib);closeModal();stampPicker()}}
function stampEditor(src){const s=src?clone(src):{id:'st'+uid().slice(1),name:'MY STAMP',folder:'My stamps',w:170,h:60,fields:[],color:'#c62828',elements:[{k:'rrect',x:2,y:2,w:166,h:56,stroke:'#c62828',width:2,fill:'none'},{k:'text',x:85,y:24,text:'MY STAMP',size:16,bold:true,color:'#c62828',align:'center'},{k:'text',x:85,y:44,text:'{author} · {date}',size:8,color:'#c62828',align:'center'}]};
 const K=['text','rect','rrect','ellipse','line','image'];
 const row=(e,i)=>`<div class="res" data-ei="${i}" style="border:1px solid var(--line);border-radius:6px;margin-bottom:6px"><div class="row" style="gap:4px;flex-wrap:wrap"><select class="ti" data-ef="k" style="flex:0;width:84px">${K.map(k=>`<option ${k===e.k?'selected':''}>${k}</option>`).join('')}</select>
  ${['x','y','w','h'].map(k=>`<input class="ti" data-ef="${k}" type="number" step="1" value="${e[k]??0}" title="${k}" style="flex:0;width:58px">`).join('')}<button class="btn" data-ed="${i}" style="flex:0">✕</button></div>
  <div class="row" style="gap:4px;margin-top:4px;flex-wrap:wrap">${e.k==='text'?`<input class="ti" data-ef="text" value="${esc(e.text||'')}" placeholder="Text, e.g. DATE: {date}" style="flex:3"><input class="ti" data-ef="size" type="number" value="${e.size||10}" title="size" style="flex:0;width:56px"><label class="chk" style="flex:0"><input type="checkbox" data-ef="bold" ${e.bold?'checked':''}>B</label><select class="ti" data-ef="align" style="flex:0;width:80px"><option ${e.align!=='center'?'selected':''} value="left">left</option><option ${e.align==='center'?'selected':''} value="center">center</option></select><input type="color" data-ef="color" value="${e.color||s.color}" style="flex:0;width:38px">`:
   e.k==='image'?`<button class="btn" data-eimg="${i}" style="border:1px solid var(--line)">${e.src?'Replace image':'Choose image'}…</button>`:`<input type="color" data-ef="stroke" value="${e.stroke||s.color}" title="line" style="flex:0;width:38px"><input class="ti" data-ef="width" type="number" step=".2" value="${e.width??1}" title="line width" style="flex:0;width:56px"><label class="chk" style="flex:0"><input type="checkbox" data-ef="fillOn" ${e.fill&&e.fill!=='none'?'checked':''}>fill</label><input type="color" data-ef="fill" value="${e.fill&&e.fill!=='none'?e.fill:'#ffffff'}" style="flex:0;width:38px">`}</div></div>`;
 const draw=()=>{const m={type:'cstamp',pts:[[s.w/2,s.h/2]],style:{scale:1,opacity:1},stampDef:s,fields:{date:new Date().toLocaleDateString(),time:new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),author:settings.author,file:S.fileName||'file.pdf',page:'1',pages:'1'}};(s.fields||[]).forEach(f=>{if(!m.fields[f])m.fields[f]='‹'+f+'›'});const ps=[];stampPrims(m,ps);
  const pv=$('#seP');if(pv)pv.innerHTML=`<svg viewBox="-4 -4 ${s.w+8} ${s.h+8}" style="width:100%;max-height:150px;background:#fff;border-radius:6px">${ps.map(primSvg).join('')}</svg>`};
 const body=()=>`<div id="seP"></div><div class="row fld" style="margin-top:8px"><div style="flex:2"><label style="font-size:11px;color:var(--mut)">Name</label><input class="ti" id="seN" value="${esc(s.name)}"></div><div><label style="font-size:11px;color:var(--mut)">Folder</label><input class="ti" id="seFo" value="${esc(s.folder||'')}"></div></div>
  <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Width</label><input class="ti" id="seW" type="number" value="${s.w}"></div><div><label style="font-size:11px;color:var(--mut)">Height</label><input class="ti" id="seH" type="number" value="${s.h}"></div><div style="flex:2"><label style="font-size:11px;color:var(--mut)">Ask when placing (fields)</label><input class="ti" id="seQ" value="${esc((s.fields||[]).join(', '))}" placeholder="reviewer, comments"></div></div>
  <div class="hint" style="margin-bottom:6px">Fields fill automatically: {date} {time} {author} {file} {page} {pages}. Any other {name} listed above is asked for when the stamp is placed.</div>
  <div id="seEl">${s.elements.map(row).join('')}</div><div class="row" style="gap:4px;flex-wrap:wrap">${K.map(k=>`<button class="btn" data-eadd="${k}" style="border:1px solid var(--line)">+ ${k}</button>`).join('')}</div>`;
 modal(src?'Edit stamp':'New stamp',body(),[{label:'Cancel',cancel:1},{label:'Save stamp',pri:1,fn:()=>{const lib=stampLib();const i=lib.stamps.findIndex(x=>x.id===s.id);if(i>=0)lib.stamps[i]=s;else lib.stamps.push(s);LS.set('pm:stamps2',lib);toast('Stamp saved');setTimeout(stampPicker,0)}}]);
 const md=$('#modal');const rerender=()=>{md.querySelector('.mb').innerHTML=body();draw()};draw();
 md.addEventListener('input',e=>{const t=e.target;if(t.id==='seN')s.name=t.value;if(t.id==='seFo')s.folder=t.value;if(t.id==='seW')s.w=+t.value||10;if(t.id==='seH')s.h=+t.value||10;if(t.id==='seQ')s.fields=t.value.split(',').map(x=>x.trim()).filter(Boolean);
  const r=t.closest('[data-ei]');if(r&&t.dataset.ef){const el=s.elements[+r.dataset.ei],k=t.dataset.ef;let v=t.type==='checkbox'?t.checked:t.type==='number'?+t.value:t.value;if(k==='fillOn'){el.fill=v?(r.querySelector('[data-ef=fill]').value):'none'}else if(k==='fill'){el.fill=v}else el[k]=v;if(k==='k'){rerender();return}}draw()});
 md.addEventListener('click',async e=>{const a=e.target.closest('[data-eadd]'),d=e.target.closest('[data-ed]'),im=e.target.closest('[data-eimg]');
  if(a){const k=a.dataset.eadd;s.elements.push(k==='text'?{k,x:10,y:s.h/2,text:'TEXT',size:10,color:s.color}:k==='line'?{k,x:8,y:s.h/2,w:s.w-16,h:0,stroke:s.color,width:.8}:{k,x:6,y:6,w:Math.min(60,s.w-12),h:Math.min(30,s.h-12),stroke:s.color,width:1,fill:'none'});rerender()}
  if(d){s.elements.splice(+d.dataset.ed,1);rerender()}
  if(im){const[f]=await pickFile('image/png,image/jpeg');if(!f)return;s.elements[+im.dataset.eimg].src=await readURL(f);rerender()}})}

/* ================================================================== 6. IMAGES & MEDIA */
async function cameraDialog(target){// target: 'place' | markup
 const fallback=async()=>{const[f]=await pickFile('image/*,video/*',false,'environment');if(!f)return null;return{name:f.name,type:f.type,dataUrl:await readURL(f)}};
 let stream=null;try{if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})}catch(e){stream=null}
 let shot=null;if(!stream){toast('Camera not available here — choose a photo instead');shot=await fallback()}
 else shot=await new Promise(res=>{modal('Camera',`<video id="camV" autoplay playsinline style="width:100%;border-radius:6px;background:#000"></video>`,[{label:'Cancel',cancel:1,fn:()=>res(null)},{label:'Take photo',pri:1,fn:()=>{const v=$('#camV'),c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);res({name:'Photo '+new Date().toLocaleString().replace(/[/:]/g,'-')+'.jpg',type:'image/jpeg',dataUrl:c.toDataURL('image/jpeg',.85)})}}]);$('#camV').srcObject=stream});
 if(stream)stream.getTracks().forEach(t=>t.stop());if(!shot)return;
 if(target&&target!=='place'){addMedia(target,[shot]);return}
 if(/^video\//.test(shot.type)){toast('Videos attach to markups — select a markup and use Media → Add');return}
 const im=await loadImg(shot.dataUrl);S.imageSrc=shot.dataUrl;S.imageAR=im.naturalHeight/im.naturalWidth||1;setTool('image');toast('Drag a box or click to place the photo')}
async function shrink(url,max=1600){const im=await loadImg(url),k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.85)}
async function addMedia(m,files){const add=[];for(const f of files){let{name,type,dataUrl}=f;if(f instanceof File){name=f.name;type=f.type;if(f.size>40e6){toast(name+' is over 40 MB — skipped');continue}dataUrl=await readURL(f)}
  let pano=false;if(/^image\//.test(type)&&!/svg/.test(type)){const im=await loadImg(dataUrl);pano=Math.abs(im.naturalWidth/im.naturalHeight-2)<.05;dataUrl=await shrink(dataUrl,pano?4096:1600);type='image/jpeg';name=name.replace(/\.\w+$/,'')+'.jpg'}
  add.push({name,type,dataUrl,added:Date.now(),pano})}if(!add.length)return;pushUndo();m.files=(m.files||[]).concat(add);m.modified=Date.now();commit();renderProps();toast(`Added ${add.length} item${add.length>1?'s':''}`)}
function view360(f){modal('360° photo — drag to look around',`<canvas id="pnC" width="720" height="420" style="width:100%;border-radius:6px;background:#000;cursor:grab;touch-action:none"></canvas><div class="hint">Drag to turn · wheel to zoom</div>`,[{label:'Close',cancel:1,pri:1}]);
 const cv=$('#pnC'),ctx=cv.getContext('2d');let src=null,yaw=0,pitch=0,fov=85,busy=false;const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');x.drawImage(im,0,0);src={w:c.width,h:c.height,d:x.getImageData(0,0,c.width,c.height).data};draw(2)};im.src=f.dataUrl;
 function draw(q){if(!src)return;const W=cv.width/q|0,Hh=cv.height/q|0,out=ctx.createImageData(W,Hh),o=out.data,t=Math.tan(fov*Math.PI/360),asp=W/Hh,cy=Math.cos(pitch),sy=Math.sin(pitch),cY=Math.cos(yaw),sY=Math.sin(yaw);
  for(let y=0;y<Hh;y++){const ny=(1-2*(y+.5)/Hh)*t;for(let x=0;x<W;x++){const nx=(2*(x+.5)/W-1)*t*asp;let dx=nx,dy=ny,dz=1;const y2=dy*cy+dz*sy,z2=-dy*sy+dz*cy;dy=y2;dz=z2;const x3=dx*cY+dz*sY,z3=-dx*sY+dz*cY;dx=x3;dz=z3;
    const L=Math.hypot(dx,dy,dz),lon=Math.atan2(dx,dz),lat=Math.asin(dy/L);let u=((lon/(2*Math.PI)+.5)*src.w)|0,v=((.5-lat/Math.PI)*src.h)|0;u=(u%src.w+src.w)%src.w;v=Math.max(0,Math.min(src.h-1,v));const si=(v*src.w+u)*4,di=(y*W+x)*4;o[di]=src.d[si];o[di+1]=src.d[si+1];o[di+2]=src.d[si+2];o[di+3]=255}}
  if(q===1)ctx.putImageData(out,0,0);else{const tmp=document.createElement('canvas');tmp.width=W;tmp.height=Hh;tmp.getContext('2d').putImageData(out,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(tmp,0,0,cv.width,cv.height)}}
 let drag=null;cv.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch};cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(!drag)return;yaw=drag.yaw-(e.clientX-drag.x)*.005;pitch=Math.max(-1.45,Math.min(1.45,drag.pitch+(e.clientY-drag.y)*.005));if(!busy){busy=true;requestAnimationFrame(()=>{draw(3);busy=false})}};
 cv.onpointerup=()=>{drag=null;draw(1)};cv.onwheel=e=>{e.preventDefault();fov=Math.max(30,Math.min(110,fov+e.deltaY*.05));draw(2)};window.PMStyles2.pano={get yaw(){return yaw},draw}}
function playVideo(f){modal(f.name,`<video src="${f.dataUrl}" controls autoplay style="width:100%;border-radius:6px;background:#000"></video>`,[{label:'Close',cancel:1,pri:1}])}
function annotatePhoto(m,i){const f=m.files[i];modal('Mark up photo',`<div class="row" style="gap:4px;margin-bottom:6px;flex-wrap:wrap">${['pen','arrow','rect','text'].map(t=>`<button class="btn" data-at="${t}" style="border:1px solid var(--line)">${t}</button>`).join('')}<input type="color" id="apC" value="#ff2d2d" style="flex:0;width:40px;height:30px"><button class="btn" id="apU" style="border:1px solid var(--line)">Undo</button></div><canvas id="apCv" style="width:100%;border-radius:6px;touch-action:none;background:#000"></canvas>`,
 [{label:'Cancel',cancel:1},{label:'Save as new photo',pri:1,fn:()=>{const url=$('#apCv').toDataURL('image/jpeg',.88);pushUndo();m.files.push({name:f.name.replace(/\.\w+$/,'')+' (marked).jpg',type:'image/jpeg',dataUrl:url,added:Date.now()});m.modified=Date.now();commit();renderProps();toast('Marked-up photo saved')}}]);
 const cv=$('#apCv'),ctx=cv.getContext('2d');let tool='pen',ops=[],cur=null,bg=null;loadImg(f.dataUrl).then(im=>{bg=im;cv.width=im.naturalWidth;cv.height=im.naturalHeight;redraw()});
 const lw=()=>Math.max(3,cv.width/250);function redraw(){if(!bg)return;ctx.drawImage(bg,0,0);for(const o of[...ops,cur].filter(Boolean)){ctx.strokeStyle=ctx.fillStyle=o.c;ctx.lineWidth=lw();ctx.lineCap=ctx.lineJoin='round';
   if(o.t==='pen'){ctx.beginPath();o.p.forEach((q,j)=>j?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke()}
   if(o.t==='rect'){ctx.strokeRect(o.a[0],o.a[1],o.b[0]-o.a[0],o.b[1]-o.a[1])}
   if(o.t==='arrow'){const[a,b]=[o.a,o.b],an=Math.atan2(b[1]-a[1],b[0]-a[0]),s=lw()*5;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.beginPath();ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-s*Math.cos(an-.4),b[1]-s*Math.sin(an-.4));ctx.lineTo(b[0]-s*Math.cos(an+.4),b[1]-s*Math.sin(an+.4));ctx.closePath();ctx.fill()}
   if(o.t==='text'){ctx.font=`bold ${lw()*8}px Helvetica,Arial`;ctx.lineWidth=lw()*1.2;ctx.strokeStyle='#fff';ctx.strokeText(o.s,o.a[0],o.a[1]);ctx.fillText(o.s,o.a[0],o.a[1])}}}
 const P=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*cv.width,(e.clientY-r.top)/r.height*cv.height]};
 $('#modal').querySelectorAll('[data-at]').forEach(b=>b.onclick=()=>{tool=b.dataset.at});$('#apU').onclick=()=>{ops.pop();redraw()};
 cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);const p=P(e),c=$('#apC').value;if(tool==='text'){const s=prompt?null:null;const t=window.__pmPhotoText||'NOTE';ops.push({t:'text',a:p,s:t,c});redraw();return}cur=tool==='pen'?{t:'pen',p:[p],c}:{t:tool,a:p,b:p,c}};
 cv.onpointermove=e=>{if(!cur)return;const p=P(e);if(cur.t==='pen')cur.p.push(p);else cur.b=p;redraw()};cv.onpointerup=()=>{if(cur){ops.push(cur);cur=null;redraw()}};
 window.PMStyles2.photo={get ops(){return ops},canvas:cv}}
async function captureSummary(){const ms=S.markups.filter(m=>(m.files||[]).length);if(!ms.length)return toast('No markups have photos or files attached');toast('Building capture summary…');
 try{const D=await PL.PDFDocument.create(),F=await D.embedFont(PL.StandardFonts.Helvetica),FB=await D.embedFont(PL.StandardFonts.HelveticaBold),W=612,Hh=792,M=40;let page=null,y=0;const np=()=>{page=D.addPage([W,Hh]);y=Hh-M};np();
  page.drawText(safeTxt(baseName()+' — Capture Summary'),{x:M,y,size:15,font:FB});y-=16;page.drawText(safeTxt(`${ms.length} markups · ${new Date().toLocaleString()} · ${settings.author}`),{x:M,y,size:8,font:F,color:PL.rgb(.4,.4,.4)});y-=22;
  for(const m of ms){if(y<M+150)np();page.drawText(safeTxt(`${m.subject||T[m.type].label} — page ${m.page}`),{x:M,y,size:11,font:FB});y-=13;if(m.comment){page.drawText(safeTxt(m.comment).slice(0,120),{x:M,y,size:8.5,font:F});y-=12}
   let x=M,rowH=0;for(const f of m.files){let thumb=null;try{if(/^image\//.test(f.type))thumb=f.dataUrl;else if(/^video\//.test(f.type))thumb=await videoFrame(f.dataUrl)}catch(e){}
    const tw_=160,th=thumb?110:20;if(x+tw_>W-M){x=M;y-=rowH+16;rowH=0}if(y-th<M){np();x=M}
    if(thumb){const im=/png/.test(thumb.slice(0,30))?await D.embedPng(b64bytes(thumb)):await D.embedJpg(b64bytes(thumb)),s=Math.min(tw_/im.width,th/im.height);page.drawImage(im,{x,y:y-im.height*s,width:im.width*s,height:im.height*s});rowH=Math.max(rowH,im.height*s)}else rowH=Math.max(rowH,th);
    page.drawText(safeTxt((f.pano?'[360] ':/^video/.test(f.type)?'[video] ':'')+f.name).slice(0,40),{x,y:y-rowH-10,size:7,font:F,color:PL.rgb(.3,.3,.3)});x+=tw_+12}
   y-=rowH+28}
  await saveFile(baseName()+'-capture-summary.pdf',new Blob([await D.save()],{type:'application/pdf'}))}catch(e){console.error(e);toast('Capture summary failed: '+(e.message||e))}}
function videoFrame(url){return new Promise((res,rej)=>{const v=document.createElement('video');v.muted=true;v.src=url;v.onloadeddata=()=>{v.currentTime=Math.min(.5,(v.duration||1)/3)};v.onseeked=()=>{const c=document.createElement('canvas');c.width=v.videoWidth||320;c.height=v.videoHeight||180;c.getContext('2d').drawImage(v,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};v.onerror=rej;setTimeout(()=>rej(new Error('timeout')),6000)})}
async function exportMedia(){const ms=S.markups.filter(m=>(m.files||[]).length);if(!ms.length)return toast('No attached media');const z=new JSZip();let n=0;
 for(const m of ms)for(const f of m.files){const safe=(`p${m.page}-${(m.subject||m.type)}-${f.name}`).replace(/[\\/:*?"<>|]+/g,'_');z.file(safe,b64bytes(f.dataUrl));n++}
 await saveFile(baseName()+'-capture-media.zip',await z.generateAsync({type:'blob'}));toast(`Exported ${n} files`)}
// crop image markups
function cropImage(m){modal('Crop image',`<div style="position:relative"><img id="crI" src="${m.imgOrig||m.img}" style="width:100%;display:block;border-radius:4px"><div id="crB" style="position:absolute;border:2px solid #3d8bfd;background:rgba(61,139,253,.12);cursor:move"></div></div><div class="hint">Drag the box; drag its edges/corners to resize.</div>`,
 [{label:'Cancel',cancel:1},m.imgOrig?{label:'Reset crop',fn:()=>{pushUndo();m.img=m.imgOrig;delete m.imgOrig;delete m.crop;commit();renderProps()}}:null,{label:'Crop',pri:1,fn:async()=>{const im=$('#crI'),r=crop,nw=im.naturalWidth,nh=im.naturalHeight;const c=document.createElement('canvas');c.width=Math.max(1,Math.round(r.w*nw));c.height=Math.max(1,Math.round(r.h*nh));c.getContext('2d').drawImage(im,r.x*nw,r.y*nh,r.w*nw,r.h*nh,0,0,c.width,c.height);
  pushUndo();if(!m.imgOrig)m.imgOrig=m.img;m.crop=r;m.img=c.toDataURL(/png/.test(m.imgOrig.slice(0,30))?'image/png':'image/jpeg',.9);const b=normBox(m.pts[0],m.pts[1]),w=b[2]-b[0],h=b[3]-b[1];const sw=w/((m.lastCrop||{w:1}).w),sh=h/((m.lastCrop||{h:1}).h);
  m.pts=[[b[0],b[1]],[b[0]+sw*r.w,b[1]+sh*r.h]];m.lastCrop=r;m.modified=Date.now();commit();renderProps()}}].filter(Boolean));
 let crop=Object.assign({x:.1,y:.1,w:.8,h:.8},m.crop||{});const B=$('#crB'),I=$('#crI');const place=()=>{B.style.left=crop.x*100+'%';B.style.top=crop.y*100+'%';B.style.width=crop.w*100+'%';B.style.height=crop.h*100+'%'};place();
 let dr=null;B.onpointerdown=e=>{e.preventDefault();B.setPointerCapture(e.pointerId);const r=B.getBoundingClientRect(),ex=e.clientX,ey=e.clientY,edge=8;dr={ex,ey,c:Object.assign({},crop),l:ex-r.left<edge,r:r.right-ex<edge,t:ey-r.top<edge,b:r.bottom-ey<edge}};
 B.onpointermove=e=>{if(!dr)return;const R=I.getBoundingClientRect(),dx=(e.clientX-dr.ex)/R.width,dy=(e.clientY-dr.ey)/R.height,c=dr.c;let{x,y,w,h}=c;const any=dr.l||dr.r||dr.t||dr.b;
  if(!any){x=c.x+dx;y=c.y+dy}else{if(dr.l){x=c.x+dx;w=c.w-dx}if(dr.r)w=c.w+dx;if(dr.t){y=c.y+dy;h=c.h-dy}if(dr.b)h=c.h+dy}w=clamp(w,.02,1);h=clamp(h,.02,1);x=clamp(x,0,1-w);y=clamp(y,0,1-h);crop={x,y,w,h};place()};B.onpointerup=()=>{dr=null};
 window.PMStyles2.cropSet=r=>{crop=Object.assign({},r);place()}}
// file attachment markup
async function fileAttachStart(){const[f]=await pickFile('');if(!f)return;if(f.size>25e6)return toast('Files over 25 MB can\'t be attached');S.fattach={name:f.name,type:f.type||'application/octet-stream',size:f.size,data:await readURL(f)};setTool('fattach');toast('Click where the attachment icon goes')}
function fattachPrims(m,out){const[x,y]=m.pts[0],s=m.style,o=s.opacity??1;out.push({k:'p',d:dBox([x,y,x+14,y+20]),stroke:s.stroke,w:.8,so:o,fill:s.fill||'#dbeafe',fo:o,dash:''});
 out.push({k:'p',d:`M${x+9.5} ${y+5} L${x+5} ${y+11} A2 2 0 0 0 ${x+8} ${y+13} L${x+11} ${y+8} A3.2 3.2 0 0 0 ${x+5.5} ${y+4.6} L${x+3.6} ${y+13} A4.6 4.6 0 0 0 ${x+10} ${y+16.5}`,stroke:s.stroke,w:1.1,so:o,fill:null,fo:1,dash:''})}
H.exportPage.push(async(doc,pages)=>{const ctx=doc.context;for(const m of S.markups){if(m.type!=='fattach'||!m.att)continue;if(S2.exp&&S2.exp.print)continue;const page=pages[m.page-1],vp=S.pages[m.page-1]&&S.pages[m.page-1].vp;if(!page||!vp)continue;
  try{const bytes=b64bytes(m.att.data),ef=ctx.flateStream(bytes,{Type:'EmbeddedFile',Params:{Size:bytes.length}}),efRef=ctx.register(ef);
   const fs=ctx.obj({Type:'Filespec',F:PL.PDFString.of(m.att.name.replace(/[^\x20-\x7e]/g,'_')),UF:PL.PDFHexString.fromText(m.att.name),EF:{F:efRef,UF:efRef},Desc:PL.PDFHexString.fromText(m.comment||m.att.name)});const fsRef=ctx.register(fs);
   const[x,y]=m.pts[0],a=vp.convertToPdfPoint(x,y),b=vp.convertToPdfPoint(x+14,y+20),col=hexRgb(m.style.stroke||'#1d4ed8');
   const an=ctx.obj({Type:'Annot',Subtype:'FileAttachment',Rect:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])],FS:fsRef,Name:'Paperclip',Contents:PL.PDFHexString.fromText(m.comment||m.att.name),T:PL.PDFHexString.fromText(m.author||''),C:[col.red,col.green,col.blue],F:4});
   page.node.addAnnot(ctx.register(an))}catch(e){console.warn('attach',e)}}});
/* ================================================================== 7. SNAPSHOT OPTIONS (raster / vector) */
async function snapshotPro(){if(!S.pages.length)return toast('Open a PDF first');const r=await PMAuto.pickRegion('Snapshot: pick the area');const b=r.box;if(b[2]-b[0]<3||b[3]-b[1]<3)return toast('Area too small');
 modal('Snapshot',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Resolution</label><select class="ti" id="snR"><option value="96">96 dpi</option><option value="150" selected>150 dpi</option><option value="300">300 dpi</option><option value="600">600 dpi</option></select></div><div><label class="chk" style="margin-top:18px"><input type="checkbox" id="snM" checked> Include markups</label></div></div>
 <div style="display:flex;flex-direction:column;gap:6px"><button class="btn" id="snPng" style="border:1px solid var(--line);justify-content:flex-start">Save as PNG image</button><button class="btn" id="snCp" style="border:1px solid var(--line);justify-content:flex-start">Copy image to clipboard</button>
 <button class="btn" id="snPdf" style="border:1px solid var(--line);justify-content:flex-start">Save as vector PDF (stays sharp at any zoom)</button><button class="btn" id="snVec" style="border:1px solid var(--line);justify-content:flex-start">Copy as vector — paste into any document (Styles → Paste vector snapshot)</button></div>`,[{label:'Close',cancel:1}]);
 const opt=()=>({dpi:+$('#snR').value,mk:$('#snM').checked});
 $('#snPng').onclick=async()=>{const o=opt(),c=await rasterRegion(r.page,b,o.dpi/72,o.mk);c.toBlob(bl=>saveFile(baseName()+'-snapshot.png',bl),'image/png')};
 $('#snCp').onclick=async()=>{const o=opt(),c=await rasterRegion(r.page,b,o.dpi/72,o.mk);c.toBlob(async bl=>{try{await navigator.clipboard.write([new ClipboardItem({'image/png':bl})]);toast('Copied')}catch(e){toast('Clipboard images are blocked here — use Save as PNG')}},'image/png')};
 $('#snPdf').onclick=async()=>{const o=opt();const bytes=await vectorRegion(r.page,b,o.mk);await saveFile(baseName()+'-snapshot.pdf',new Blob([bytes],{type:'application/pdf'}))};
 $('#snVec').onclick=async()=>{const o=opt();const bytes=await vectorRegion(r.page,b,o.mk),c=await rasterRegion(r.page,b,150/72,o.mk);S2.clip={pdf:bytesB64(bytes),png:c.toDataURL('image/png'),w:b[2]-b[0],h:b[3]-b[1]};closeModal();toast('Vector snapshot copied — open any document and use Styles → Paste vector snapshot')}}
async function rasterRegion(pg,box,k,withMarkups){const page=await S.pdf.getPage(pg),W=Math.max(1,Math.round((box[2]-box[0])*k)),Hh=Math.max(1,Math.round((box[3]-box[1])*k)),vp=page.getViewport({scale:k,offsetX:-box[0]*k,offsetY:-box[1]*k});
 const c=document.createElement('canvas');c.width=W;c.height=Hh;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,Hh);await page.render({canvasContext:ctx,viewport:vp}).promise;
 if(withMarkups){ctx.save();ctx.setTransform(k,0,0,k,-box[0]*k,-box[1]*k);for(const m of S.markups){if(m.page!==pg||m.hidden||!effVisible(m))continue;const ps=prims(m);drawPrimsCanvas(ctx,ps.filter(p=>p.k!=='img'));for(const p of ps.filter(p=>p.k==='img'&&p.src)){try{const im=await loadImg(p.src);ctx.globalAlpha=p.o??1;ctx.drawImage(im,p.b[0],p.b[1],p.b[2]-p.b[0],p.b[3]-p.b[1]);ctx.globalAlpha=1}catch(e){}}}ctx.restore()}return c}
async function vectorRegion(pg,box,withMarkups){const src=await PL.PDFDocument.load(withMarkups?await PMOutput.markedPdf(true):S.bytes,{ignoreEncryption:true}),vp=S.pages[pg-1].vp;
 const a=vp.convertToPdfPoint(box[0],box[1]),b=vp.convertToPdfPoint(box[2],box[3]),bb={left:Math.min(a[0],b[0]),bottom:Math.min(a[1],b[1]),right:Math.max(a[0],b[0]),top:Math.max(a[1],b[1])};
 const out=await PL.PDFDocument.create(),emb=await out.embedPage(src.getPage(pg-1),bb),w=bb.right-bb.left,h=bb.top-bb.bottom,rot=(vp.rotation||0)%360;
 const p=out.addPage(rot%180?[h,w]:[w,h]);if(!rot)p.drawPage(emb,{x:0,y:0});else if(rot===90)p.drawPage(emb,{x:0,y:w,rotate:PL.degrees(-90)});else if(rot===180)p.drawPage(emb,{x:w,y:h,rotate:PL.degrees(180)});else p.drawPage(emb,{x:h,y:0,rotate:PL.degrees(90)});
 return out.save()}
function pasteVector(){if(!S2.clip)return toast('Copy a vector snapshot first (Snapshot → Copy as vector)');if(!S.pages.length)return toast('Open a PDF first');const p=S.pages[S.cur-1],c=S2.clip;
 const vr=viewer.getBoundingClientRect(),an=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);const cx=an&&an.p===p?an.pt[0]:p.w/2,cy=an&&an.p===p?an.pt[1]:p.h/2;
 const m=newMarkup('vsnap',p.num,[[cx-c.w/2,cy-c.h/2],[cx+c.w/2,cy+c.h/2]],toolStyle('vsnap'));pushUndo();S.markups.push(m);commit();setSel([m.id]);toast('Pasted — drag to position; it saves as crisp vector content')}
H.exportPage.push(async(doc,pages)=>{if(S2.exp&&S2.exp.print&&false)return;for(const m of S.markups){if(m.type!=='vsnap'||!m.vsnap||!effVisible(m))continue;const page=pages[m.page-1],vp=S.pages[m.page-1]&&S.pages[m.page-1].vp;if(!page||!vp)continue;
  try{const src=await PL.PDFDocument.load(Uint8Array.from(atob(m.vsnap),c=>c.charCodeAt(0))),[emb]=await doc.embedPdf(src,[0]);const b=normBox(m.pts[0],m.pts[1]),a=vp.convertToPdfPoint(b[0],b[3]),c2=vp.convertToPdfPoint(b[2],b[1]);
   const lay=m.layer&&layerOf(m);if(lay){const ref=ocgRef(doc,'ml:'+lay.id,layerPath(lay),effVisible(m),effPrint(m));page.pushOperators(BDC(ocTag(page,ref)))}
   page.drawPage(emb,{x:Math.min(a[0],c2[0]),y:Math.min(a[1],c2[1]),width:Math.abs(c2[0]-a[0]),height:Math.abs(c2[1]-a[1])});if(lay)page.pushOperators(EMC())}catch(e){console.warn('vsnap',e)}}});
const layerPath=l=>layerChain(l).reverse().map(x=>x.name).join(' / ');
H.exportPage.push(async(doc)=>{finishOC(doc)});

/* ================================================================== pen pressure */
viewer.addEventListener('pointermove',e=>{if(S.drawing&&S.drawing.type==='pen'&&e.pointerType==='pen'&&e.buttons){const p=S.pages[S.drawing.page-1];if(!p)return;(S2.pressure=S2.pressure||[]).push([...toPt(e,p),e.pressure||.5])}},true);
viewer.addEventListener('pointerdown',()=>{S2.pressure=null},true);
const _fd=finishDrawing;finishDrawing=function(){const d=S.drawing,pr=S2.pressure;S2.pressure=null;const n0=S.markups.length;const r=_fd.apply(this,arguments);
 if(d&&d.type==='pen'&&pr&&pr.length>2&&S.markups.length>n0){const m=S.markups[S.markups.length-1];const vals=pr.map(q=>q[2]);if(Math.max(...vals)-Math.min(...vals)>.05){m.press=m.pts.map(p=>{let best=pr[0],bd=1e18;for(const q of pr){const dd=(q[0]-p[0])**2+(q[1]-p[1])**2;if(dd<bd){bd=dd;best=q}}return+best[2].toFixed(3)});commit()}}return r};
function pressurePrims(m,out){if(m.type!=='pen'||!m.press||m.press.length!==m.pts.length)return out;const i=out.findIndex(p=>p.k==='p'&&p.stroke);if(i<0)return out;const base=out[i],w=base.w||2,res=[];
 for(let j=1;j<m.pts.length;j++){const pp=(m.press[j-1]+m.press[j])/2;res.push(Object.assign({},base,{d:dPoly([m.pts[j-1],m.pts[j]]),w:+(w*(.25+1.5*pp)).toFixed(2)}))}out.splice(i,1,...res);return out}

/* ================================================================== prims / primSvg wrappers */
const _prims=prims;prims=function(m){let out=_prims.apply(this,arguments);if(!m||!m.style)return out;
 if(S2.exp){if(S2.exp.print&&(!effPrint(m)||!effVisible(m)))return[];if(m.type==='vsnap')return[];const lay=layerOf(m);S2.exp.cur=lay&&S2.exp.doc?ocgRef(S2.exp.doc,'ml:'+lay.id,layerPath(lay),effVisible(m),effPrint(m)):null;S2.exp.blend=m.style.blend&&m.style.blend!=='normal'?(m.style.blend[0].toUpperCase()+m.style.blend.slice(1)):null}
 try{out=out.slice();
  if(m.type==='squiggly')squigglyPrims(m,out);
  else if(m.type==='cstamp')stampPrims(m,out);
  else if(m.type==='fattach')fattachPrims(m,out);
  else if(m.type==='vsnap'){const b=normBox(m.pts[0],m.pts[1]);out.push({k:'img',b,src:m.img,o:m.style.opacity??1})}
  out=applyTextLayout(m,out);out=applyBorder(m,out);out=applyLeader(m,out);out=applyCustomHatch(m,out);out=applyLineStyle(m,out);out=pressurePrims(m,out);popupPrims(m,out);
  if(m.style.blend&&m.style.blend!=='normal')out.forEach(p=>p.bm=m.style.blend)}catch(e){console.warn('styles2 prims',e)}
 return out};
const _psvg=primSvg;primSvg=function(p){const h=_psvg.apply(this,arguments);if(p&&p.bm&&p.bm!=='normal')return h.replace(/^<(\w+)/,`<$1 style="mix-blend-mode:${p.bm}"`);return h};
const _hof=handlesOf;handlesOf=function(m){if(m&&(m.type==='cstamp'||m.type==='fattach'))return[];return _hof.apply(this,arguments)};

/* ================================================================== PROPERTIES PANEL additions */
const sel1=()=>{const ids=[...S.sel];return ids.length===1?byId(ids[0]):null};
const _rp=renderProps;renderProps=function(){const r=_rp.apply(this,arguments);try{propsExtra()}catch(e){console.warn(e)}return r};
function propsExtra(){const box=$('#props');if(!box)return;const m=sel1();const tool=!m&&T[S.tool]&&T[S.tool].kind!=='nav'?S.tool:null;const type=m?m.type:tool;if(!type)return;const st=m?m.style:toolStyle(type);
 // custom hatches into measpro's hatch dropdown
 const hs=box.querySelector('select[data-mp="hatch"]');if(hs&&!hs.querySelector('[data-s2pat]')){const og=document.createElement('optgroup');og.label='Patterns (.pat)';og.setAttribute('data-s2pat','1');for(const p of allHatch()){const o=document.createElement('option');o.value='c:'+p.id;o.textContent=p.name;og.appendChild(o)}hs.appendChild(og);if(String(st.hatch||'').startsWith('c:'))hs.value=st.hatch}
 let h='';const sec=t=>`<div class="sec">${t}</div>`;
 const isText=TEXTT.includes(type),isLine=!!geomOf({type,pts:[[0,0],[1,1],[2,2]],style:{}})||['rect','ellipse','text'].includes(type);
 if(isText){h+=sec('Text layout')+(m?`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn" data-s2a="rich" style="border:1px solid var(--line)">Rich text…</button>${m.rich?'<button class="btn" data-s2a="plain" style="border:1px solid var(--line)">Plain text</button>':''}</div>`:'')+
  `<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Align</label><select class="ti" data-s2="align">${['left','center','right'].map(a=>`<option ${(st.align||'left')===a?'selected':''}>${a}</option>`).join('')}</select></div><div><label style="font-size:11px;color:var(--mut)">Rotate °</label><input class="ti" type="number" step="15" data-s2="trot" value="${+st.trot||0}"></div><div><label style="font-size:11px;color:var(--mut)">Line spacing</label><input class="ti" type="number" step=".1" min=".8" data-s2="lh" value="${+st.lh||1.2}"></div></div>
  <div class="row fld">${type!=='typewriter'?`<div><label style="font-size:11px;color:var(--mut)">Margin (pt)</label><input class="ti" type="number" step=".5" min="0" data-s2="pad" value="${st.pad??''}" placeholder="auto"></div>`:''}<label class="chk" style="margin-top:16px"><input type="checkbox" data-s2="vert" ${st.vert?'checked':''}> Vertical</label>${type!=='typewriter'?`<label class="chk" style="margin-top:16px"><input type="checkbox" data-s2="wrapOff" ${st.wrapOff?'checked':''}> No wrap</label><label class="chk" style="margin-top:16px"><input type="checkbox" data-s2="autosize" ${st.autosize?'checked':''}> Auto-size</label>`:''}</div>`;
  if(type!=='typewriter')h+=`<div class="fld"><label>Border</label><select class="ti" data-s2="border">${[['solid','Solid'],['dash','Dashed'],['dot','Dotted'],['cloud','Cloud'],['none','None']].map(([v,l])=>`<option value="${v}" ${(st.border||'solid')===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
  if(type==='callout')h+=`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Leader end</label><select class="ti" data-s2="leadHead">${[['arrow','Arrow'],['open','Open arrow'],['dot','Dot'],['tick','Slash'],['none','None']].map(([v,l])=>`<option value="${v}" ${(st.leadHead||'arrow')===v?'selected':''}>${l}</option>`).join('')}</select></div><div><label style="font-size:11px;color:var(--mut)">Landing (pt)</label><input class="ti" type="number" min="0" step="2" data-s2="knee" value="${+st.knee||0}"></div></div>`}
 if(isLine&&!isText||type==='text'){h+=sec('Line style')+`<div class="row fld"><select class="ti" data-s2="lineStyle"><option value="">Plain (use dash setting)</option>${allLS().map(l=>`<option value="${esc(l.id)}" ${st.lineStyle===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select><button class="btn" data-s2a="lsman" style="flex:0;border:1px solid var(--line)">Manage…</button></div>`}
 if(st.hatch!==undefined||T[type]&&T[type].closed)h+=`<div class="row" style="gap:6px;margin-bottom:6px">${String(st.hatch||'').startsWith('c:')?`<div style="flex:1"><label style="font-size:11px;color:var(--mut)">Pattern scale</label><input class="ti" type="number" min="1" step="1" data-s2="hatchScale" value="${+st.hatchScale||12}"></div>`:''}<button class="btn" data-s2a="hman" style="border:1px solid var(--line)">Hatch patterns…</button></div>`;
 h+=sec('Blend')+`<div class="fld"><select class="ti" data-s2="blend">${['normal','multiply','screen','darken','lighten','overlay'].map(b=>`<option ${(st.blend||'normal')===b?'selected':''}>${b}</option>`).join('')}</select></div>`;
 if(type==='cstamp'&&m)h+=sec('Stamp')+`<div class="fld"><label>Scale</label><input class="ti" type="number" step=".1" min=".2" data-s2="scale" value="${+st.scale||1}"></div>`+Object.keys(m.fields||{}).map(k=>`<div class="fld"><label>${esc(k)}</label><input class="ti" data-s2f="${esc(k)}" value="${esc(m.fields[k])}"></div>`).join('');
 if(type==='image'&&m)h+=sec('Image')+`<div class="row" style="gap:6px"><button class="btn" data-s2a="crop" style="border:1px solid var(--line)">Crop…</button></div>`;
 if(type==='fattach'&&m&&m.att)h+=sec('Attachment')+`<div class="hint">${esc(m.att.name)} · ${Math.round((m.att.size||0)/1024)} KB</div><div class="row" style="gap:6px;margin-top:6px"><button class="btn" data-s2a="attsave" style="border:1px solid var(--line)">Save file</button><button class="btn" data-s2a="attrep" style="border:1px solid var(--line)">Replace…</button></div>`;
 if(m){h+=sec('Pop-up note')+`<div class="row fld"><label class="chk"><input type="checkbox" data-s2m="popup" ${m.popup?'checked':''}> Show pop-up</label><div><label style="font-size:11px;color:var(--mut)">Opacity</label><input type="range" min="20" max="100" data-s2="popOp" value="${Math.round((+(st.popOp??.92))*100)}"></div></div>`;
  h+=sec('Layer')+`<div class="fld"><select class="ti" data-s2m="layer"><option value="">(none)</option>${ML().map(l=>`<option value="${esc(l.id)}" ${m.layer===l.id?'selected':''}>${esc(layerPath(l))}</option>`).join('')}</select></div>`;
  const files=m.files||[];h+=sec('Media')+`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px"><button class="btn" data-s2a="madd" style="border:1px solid var(--line)">Add photo / video / 360°…</button><button class="btn" data-s2a="mcam" style="border:1px solid var(--line)">Camera</button></div>`+
   files.map((f,i)=>`<div class="row" style="gap:4px;align-items:center;margin-bottom:4px">${/^image\//.test(f.type)?`<img src="${f.dataUrl}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;flex:0">`:`<span style="flex:0;width:34px;text-align:center">${/^video\//.test(f.type)?'🎬':'📄'}</span>`}<small style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</small>
    ${f.pano?`<button class="btn" data-s2v="${i}" data-kind="360" style="flex:0;height:24px;border:1px solid var(--line)">360°</button>`:/^video\//.test(f.type)?`<button class="btn" data-s2v="${i}" data-kind="video" style="flex:0;height:24px;border:1px solid var(--line)">Play</button>`:/^image\//.test(f.type)?`<button class="btn" data-s2v="${i}" data-kind="ann" style="flex:0;height:24px;border:1px solid var(--line)">Mark up</button><button class="btn" data-s2v="${i}" data-kind="pano" title="Treat as 360° photo" style="flex:0;height:24px;border:1px solid var(--line)">360?</button>`:''}</div>`).join('')}
 if(!h)return;const d=document.createElement('div');d.id='s2Props';d.innerHTML=h;box.appendChild(d)}
let s2Undo=false;
function onPropsInput(e){const t=e.target;const k=t.dataset.s2,km=t.dataset.s2m,kf=t.dataset.s2f;if(!k&&!km&&!kf)return;let v=t.type==='checkbox'?t.checked:t.type==='range'?(+t.value)/100:t.type==='number'?(t.value===''?'':+t.value):t.value;
 const m=sel1();if(!m){if(k&&T[S.tool]&&S.defaults[S.tool]){S.defaults[S.tool][k]=v;LS.set('pm:defaults',S.defaults)}return}
 if(!s2Undo){pushUndo();s2Undo=true}if(k){if(v===''||v===false)delete m.style[k];else m.style[k]=v;if((k==='autosize'&&v)||(m.style.autosize&&['lh','pad','vert','wrapOff'].includes(k)))autosize(m)}
 if(km==='popup'){m.popup=v||undefined}if(km==='layer'){if(v)m.layer=v;else delete m.layer;syncLocks()}if(kf){m.fields[kf]=v}m.modified=Date.now();redrawPage(m.page);hook('change');clearTimeout(lT);lT=setTimeout(renderList,250)}
async function onPropsClick(e){const a=e.target.closest('[data-s2a]'),v=e.target.closest('[data-s2v]');const m=sel1();
 if(a){const k=a.dataset.s2a;if(k==='lsman')return lineStyleManager();if(k==='hman')return hatchManager();if(!m)return;
  if(k==='rich')return richEditor(m);if(k==='plain'){pushUndo();delete m.rich;commit();renderProps();return}if(k==='crop')return cropImage(m);
  if(k==='madd'){const fs=await pickFile('image/*,video/*,.jpg,.jpeg,.png,.mp4,.mov,.webm',true);if(fs.length)addMedia(m,fs);return}if(k==='mcam')return cameraDialog(m);
  if(k==='attsave')return saveFile(m.att.name,new Blob([b64bytes(m.att.data)],{type:m.att.type}));
  if(k==='attrep'){const[f]=await pickFile('');if(!f)return;pushUndo();m.att={name:f.name,type:f.type||'application/octet-stream',size:f.size,data:await readURL(f)};m.comment=f.name;commit();renderProps();return}}
 if(v&&m){const i=+v.dataset.s2v,f=m.files[i],kind=v.dataset.kind;if(kind==='360')return view360(f);if(kind==='video')return playVideo(f);if(kind==='ann')return annotatePhoto(m,i);if(kind==='pano'){pushUndo();f.pano=true;commit();renderProps();view360(f)}}}

/* ================================================================== Translate markups (web: Claude) */
let sampleNs=null;H.ready.push(async()=>{try{if(window.claude&&window.claude.use)sampleNs=await window.claude.use('sample')}catch(e){}});
function translateDialog(){if(!sampleNs){modal('Translate markups','<div class="hint">Translating markups uses Claude, so it works in the web version of PlanMark on claude.ai. Open the same PlanMark link there to translate.</div>',[{label:'OK',cancel:1}]);return}
 const n=S.sel.size;modal('Translate markups',`<div class="fld"><label>Translate into</label><select class="ti" id="trL">${['Spanish','English','Hebrew','Yiddish','Russian','Polish','Portuguese','Chinese (Simplified)','French','Arabic','Korean','Vietnamese'].map(l=>`<option>${l}</option>`).join('')}</select></div>
 <div class="fld"><label>Which markups</label><select class="ti" id="trW"><option value="sel" ${n?'':'disabled'}>Selected (${n})</option><option value="page">This page</option><option value="all" ${n?'':'selected'}>All</option></select></div>
 <div class="fld"><label>Result</label><select class="ti" id="trM"><option value="append">Add translation under the original</option><option value="replace">Replace the original text</option></select></div>`,
 [{label:'Cancel',cancel:1},{label:'Translate',pri:1,fn:md=>{const o={lang:md.querySelector('#trL').value,w:md.querySelector('#trW').value,mode:md.querySelector('#trM').value};setTimeout(()=>runTranslate(o),0)}}])}
async function runTranslate(o){const ms=S.markups.filter(m=>o.w==='sel'?S.sel.has(m.id):o.w==='page'?m.page===S.cur:true).filter(m=>(m.text&&m.text.trim())||(m.comment&&m.comment.trim()));if(!ms.length)return toast('Nothing to translate');
 toast('Translating '+ms.length+' markups…');try{const items=ms.slice(0,150).map(m=>({id:m.id,text:m.text||'',comment:m.comment||''}));
  const res=await sampleNs.json(`Translate the "text" and "comment" fields of these construction-drawing markups into ${o.lang}. Keep sheet numbers, dimensions, abbreviations like RFI/HVAC and product names unchanged. Return ONLY JSON {"items":[{"id":"...","text":"...","comment":"..."}]} with the same ids; leave empty fields empty.\n${JSON.stringify(items)}`,{modelTier:'default'});
  pushUndo();let n=0;for(const it of(res&&res.items)||[]){const m=byId(it.id);if(!m)continue;const put=(k,v)=>{if(!v||!m[k])return;m[k]=o.mode==='replace'?v:m[k]+'\n— '+v;n++};put('text',it.text);put('comment',it.comment);if(m.rich&&it.text){if(o.mode==='replace')m.rich=[Object.assign({},m.rich[0],{t:it.text})];else m.rich=m.rich.concat([Object.assign({},m.rich[0],{t:'\n'+it.text})])}m.modified=Date.now()}
  commit();renderProps();toast(`Translated ${n} field${n===1?'':'s'}`)}catch(e){toast(e&&e.code==='rate_limited'?'Claude is busy — try again shortly':'Translation failed: '+(e.message||e.code||e))}}

/* ================================================================== hub + wiring */
function hub(){const b=(id,t,d)=>`<button class="btn" id="${id}" style="border:1px solid var(--line);justify-content:flex-start;height:auto;padding:8px 10px;flex-direction:column;align-items:flex-start;white-space:normal;text-align:left"><b>${t}</b><small style="color:var(--mut)">${d}</small></button>`;
 modal('Styles, stamps & media',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${b('hbSt','Stamp library','Dynamic & interactive stamps, review sets, designer')}${b('hbLs','Line styles','Fence, gas, property line… or your own')}
 ${b('hbHp','Hatch patterns','Import AutoCAD .pat or build your own')}${b('hbLy','Markup layers','Show / hide / lock / print groups of markups')}
 ${b('hbCam','Camera','Take a photo and place it on the sheet')}${b('hbSn','Snapshot','Raster or vector, with or without markups')}
 ${b('hbPv','Paste vector snapshot','Paste the last vector snapshot here')}${b('hbCs','Capture summary','PDF of every attached photo & video')}
 ${b('hbEx','Export capture media','All attached photos/videos/files as a zip')}${b('hbTr','Translate markups','Translate comments & text with Claude')}
 ${b('hbLay','Insert layered pages','Overlay another PDF\'s page as a PDF layer')}${b('hbPr','Preferences','Copy highlighted text, pop-ups, layers')}</div>`,[{label:'Close',cancel:1}]);
 const go=(id,fn)=>{$('#'+id).onclick=()=>{closeModal();fn()}};go('hbSt',stampPicker);go('hbLs',lineStyleManager);go('hbHp',hatchManager);go('hbLy',()=>switchTab('layers'));go('hbCam',()=>cameraDialog('place'));go('hbSn',snapshotPro);go('hbPv',pasteVector);go('hbCs',captureSummary);go('hbEx',exportMedia);go('hbTr',translateDialog);go('hbLay',layeredDialog);go('hbPr',prefsDialog)}
function prefsDialog(){modal('Styles preferences',`<label class="chk fld"><input type="checkbox" id="pfC" ${pref('copyText',true)?'checked':''}> Copy highlighted PDF text into the markup's comment</label>
 <label class="chk fld"><input type="checkbox" id="pfP" ${pref('printPopups',false)?'checked':''}> Print pop-up notes</label><label class="chk fld"><input type="checkbox" id="pfS" ${pref('savePopups',true)?'checked':''}> Include open pop-ups in saved PDFs</label>
 <div class="fld"><label>New markups go on layer</label><select class="ti" id="pfL"><option value="">(none)</option>${ML().map(l=>`<option value="${esc(l.id)}" ${pref('curLayer','')===l.id?'selected':''}>${esc(layerPath(l))}</option>`).join('')}</select></div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:md=>{setPref('copyText',md.querySelector('#pfC').checked);setPref('printPopups',md.querySelector('#pfP').checked);setPref('savePopups',md.querySelector('#pfS').checked);setPref('curLayer',md.querySelector('#pfL').value);toast('Saved')}}])}
H.ribbon.push({label:'Styles',title:'Stamps, line styles, hatches, layers, camera, snapshot, capture',icon:'<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 7l3 3M3 4h7M3 8h4"/>',fn:hub});
// ribbon: Stamp+ and Attach File need a pick before the tool is armed
H.ready.push(()=>{const rb=$('#ribbon');if(rb)rb.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;if(b.dataset.tool==='cstamp'){e.stopImmediatePropagation();stampPicker()}else if(b.dataset.tool==='fattach'){e.stopImmediatePropagation();fileAttachStart()}},true);
 const pr=$('#props');pr.addEventListener('input',onPropsInput);pr.addEventListener('change',e=>{s2Undo=false;if(e.target.dataset.s2==='lineStyle'||e.target.dataset.s2==='border'||e.target.dataset.mp==='hatch')renderProps();if(e.target.dataset.s2m==='layer')renderMLayers()});pr.addEventListener('click',onPropsClick);
 const pane=$('#pane-layers');if(pane){pane.addEventListener('click',mlClick);pane.addEventListener('change',mlChange);pane.addEventListener('dblclick',mlDbl);new MutationObserver(()=>{if(!$('#s2Layers'))renderMLayers()}).observe(pane,{childList:true});renderMLayers()}
 // keep layer + optional content data through page rebuilds
 if(window.PMBatch&&PMBatch.rebuild){const _rb=PMBatch.rebuild;PMBatch.rebuild=async function(){const keep={ml:clone(S.scales.mlayers||[]),st:clone(S.scales.mlstates||[])};const r=await _rb.apply(this,arguments);if(!S.scales.mlayers||!S.scales.mlayers.length)S.scales.mlayers=keep.ml;if(!S.scales.mlstates)S.scales.mlstates=keep.st;saveScales();renderMLayers();return r}}
 document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]'))return;if(modalCb)return;if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyU'){e.preventDefault();setTool('squiggly')}if(!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyF'&&S.pages.length){e.preventDefault();fileAttachStart()}})});
H.open.push(()=>{setTimeout(()=>{syncLocks();renderMLayers()},60)});
Object.assign(window.PMStyles2,{setClip:c=>{S2.clip=c},getClip:()=>S2.clip,stampPicker,stampEditor,stampLib,lineStyleManager,hatchManager,cameraDialog,view360,annotatePhoto,captureSummary,exportMedia,cropImage,fileAttachStart,snapshotPro,vectorRegion,rasterRegion,pasteVector,translateDialog,insertLayered,renderMLayers,richEditor,parseRich,ML,S2,textUnder,autosize,setPref});
})();
