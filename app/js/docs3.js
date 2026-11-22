/* PlanMark — documents & review (round 3)
   1. Review Text (Shift+Alt+R): insert / replace / delete proofreading marks, saved as real PDF Caret + StrikeOut annotations
   2. Spelling in the drawing's own text: list misspellings, jump to them, mark them
   3. PDF packages (portfolios): create, open, open files inside as tabs, extract
   4. Revert / Revert As: earlier saved versions of each document (kept on this computer)
   5. File locks (Windows app): "~$name.pmlock" next to a file; read-only copy / notify / open anyway
   6. Batch Repair PDF
   7. Embed fonts on save (metric-compatible PMDraft subsets of Liberation), default image encoding
   8. PDF/A-1b / 2b / 3b archive with output intent, XMP pdfaid, trailer ID, embedded fonts, no JavaScript
   9. Email the document (templates with {file} {project} {date} {author} {pages})
  10. Preferences: comment persistence, image encoding, reset hidden messages, usage data, language (Spanish)
  11. Web tab (Ctrl+T)
*/
(function(){
const DEF_TPL=[{name:'Send for review',subject:'{file} — for review',body:'Hi,\n\nPlease find {file} ({pages} pages) for {project} attached for your review.\n\nThanks,\n{author}\n{date}'},
 {name:'Issued drawings',subject:'{project}: {file} issued {date}',body:'Attached: {file}\n\n{author}'}];
const DC=Object.assign({embedFonts:true,imgEnc:'auto',jpegQ:85,pdfaLevel:'2b',revKeep:20,emailTpl:DEF_TPL,emailHow:'app',webHome:'https://www.google.com/'},LS.get('pm:dc',{}));
const saveDC=()=>LS.set('pm:dc',DC);
window.PM_EXTRA_SYNC_KEYS_DC=['pm:dc'];
const N=n=>PDFLib.PDFName.of(n);
const D3={exp:null,fontsOn:false,embedded:new Set(),ro:{},locks:{},pendingPath:{},lastEmail:null,web:[],webOn:null};
const f6=v=>(+v).toFixed(3).replace(/\.?0+$/,'')||'0';
const b64u8=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const pdfDate=d=>{const p=n=>String(n).padStart(2,'0');return`D:${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`};
const pickFiles=(accept,multi)=>new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept||'';i.multiple=!!multi;i.style.display='none';document.body.appendChild(i);
 let done=false;const fin=v=>{if(done)return;done=true;res(v);i.remove()};i.onchange=()=>fin([...i.files]);i.addEventListener('cancel',()=>fin([]));i.click()});
const readU8=f=>f.arrayBuffer().then(b=>new Uint8Array(b));
const toBlob=(data,type)=>data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});
const needDoc=fn=>(...a)=>{if(!S.pages.length){toast('Open a PDF first');return}return fn(...a)};
function loadScript(src,test){return new Promise((res,rej)=>{if(test&&test())return res();const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
async function zipLib(){await loadScript('lib/jszip.min.js',()=>!!window.JSZip);return window.JSZip}
const projectName=()=>{try{const p=window.PMProjects&&PMProjects.current&&PMProjects.current();if(p&&p.name)return p.name}catch(e){}return(settings.project||'')||''};

/* ================================================================== 1. REVIEW TEXT */
Object.assign(T,{review:{label:'Review Text',kind:'drag',textm:1}});
Object.assign(BASE_DEF,{review:{stroke:'#1d4ed8',width:1.4,opacity:1}});
if(!S.defaults.review)S.defaults.review=clone(BASE_DEF.review);
IC.review='<path d="M3 10h9"/><path d="M14 17l3.5-7 3.5 7"/><path d="M3 17h7"/><path d="M3 6h18"/>';
Object.assign(KEYS,{review:'Shift+Alt+R'});
Object.assign(HINTS,{review:'Drag across PDF text, then choose Insert, Replace or Delete'});
try{RIBBON[1][1].push('review')}catch(e){}
const RV_SUBJ={insert:'Inserted Text',replace:'Replacement Text',delete:'Cross-Out'};
async function textIn(page,rects){const{items,vp}=await pageText(page);const parts=[];
 for(const it of items){let r;if(it.vb)r=it.vb;else{const q=vp.convertToViewportRectangle([it.x,it.y-it.h*.2,it.x+it.w,it.y+it.h*.85]);r=normBox([q[0],q[1]],[q[2],q[3]])}
  for(const b of rects){if(!(r[0]<b[2]-.3&&r[2]>b[0]+.3&&r[1]<b[3]&&r[3]>b[1]))continue;const s=it.str||'';
   if(it.vb||it.rot){parts.push({y:r[1],x:r[0],s});break}const L=s.length||1,cw=(r[2]-r[0])/L;const i0=Math.max(0,Math.round((b[0]-r[0])/cw)),i1=Math.min(L,Math.round((b[2]-r[0])/cw));
   if(i1>i0)parts.push({y:r[1],x:r[0]+i0*cw,s:s.slice(i0,i1)});break}}
 parts.sort((a,b)=>Math.abs(a.y-b.y)>3?a.y-b.y:a.x-b.x);return parts.map(p=>p.s).join(' ').replace(/\s+/g,' ').trim()}
function removeMarkup(m){const i=S.markups.indexOf(m);if(i>=0){S.markups.splice(i,1);S.sel.delete(m.id);commit();redrawPage(m.page);renderList();renderProps()}}
async function reviewDialog(m,isNew){if(m.orig==null){try{m.orig=await textIn(m.page,m.rects||[normBox(m.pts[0],m.pts[1])])}catch(e){m.orig=''}}
 const mode=m.mode||'replace';
 modal('Review Text',`<div class="hint" style="margin-bottom:8px">Selected text: <b>${esc(m.orig||'(none found)')}</b></div>
 <div class="fld" style="display:flex;gap:14px;flex-wrap:wrap">${['insert','replace','delete'].map(k=>`<label class="chk"><input type="radio" name="rvM" value="${k}" ${mode===k?'checked':''}> ${({insert:'Insert text after it',replace:'Replace it with',delete:'Delete it'})[k]}</label>`).join('')}</div>
 <div class="fld" id="rvTf"><label>Text to insert / replacement</label><textarea class="ti" id="rvT" rows="3" placeholder="Type the new text">${esc(m.repl||'')}</textarea></div>`,
 [{label:'Cancel',cancel:1,fn:()=>{if(isNew)removeMarkup(m)}},{label:'OK',pri:1,fn:md=>{const k=md.querySelector('[name=rvM]:checked').value,t=md.querySelector('#rvT').value;
   if(k!=='delete'&&!t.trim()){toast('Type the text to '+(k==='insert'?'insert':'use instead'));return false}
   pushUndo();m.mode=k;m.repl=k==='delete'?'':t;m.subject=RV_SUBJ[k];m.comment=k==='delete'?('Delete: '+(m.orig||'')):m.repl;m.modified=Date.now();commit();redrawPage(m.page);renderList();renderProps()}}]);
 const upd=()=>{const k=$('#modal [name=rvM]:checked').value;$('#rvTf').style.display=k==='delete'?'none':''};$$('#modal [name=rvM]').forEach(r=>r.onchange=upd);upd()}
const _ac=afterCreate;afterCreate=function(m){if(m&&m.type==='review'){if(!m.comment)m.comment=' ';const r=_ac.apply(this,arguments);reviewDialog(m,true);return r}return _ac.apply(this,arguments)};
function reviewGeom(m){const R=m.rects||[normBox(m.pts[0],m.pts[1])],mode=m.mode||'replace',out={lines:[],caret:null};
 if(mode!=='insert')for(const r of R){const y=(r[1]+r[3])/2;out.lines.push([[r[0],y],[r[2],y]])}
 if(mode!=='delete'){const r=R[R.length-1],h=Math.max(4,r[3]-r[1]),x=r[2];out.caret=[[x-h*.3,r[3]+h*.34],[x,r[3]-h*.16],[x+h*.3,r[3]+h*.34]]}return out}
function reviewPrims(m){const s=m.style||{},o=s.opacity??1,g=reviewGeom(m),out=[];for(const l of g.lines)out.push({k:'p',d:dPoly(l),stroke:s.stroke,w:s.width||1.4,so:o,fill:null,fo:1,dash:''});
 if(g.caret)out.push({k:'p',d:dPoly(g.caret,true),stroke:s.stroke,w:.6,so:o,fill:s.stroke,fo:o,dash:''});return out}
const _pr=prims;prims=function(m){const out=_pr.apply(this,arguments);if(!m||m.type!=='review')return out;if(D3.exp&&!D3.exp.flat)return[];return reviewPrims(m)};
// real annotations in editable saves (flattened copies and prints draw the marks instead)
H.exportPage.push(async(doc,pages)=>{if(!D3.exp||D3.exp.flat)return;const ctx=doc.context,P=PDFLib;
 for(const m of S.markups){if(m.type!=='review')continue;const page=pages[m.page-1],vp=S.pages[m.page-1]&&S.pages[m.page-1].vp;if(!page||!vp)continue;
  try{const col=hexRgb(m.style.stroke||'#1d4ed8'),C=[col.red,col.green,col.blue],mode=m.mode||'replace',g=reviewGeom(m),cv=p=>vp.convertToPdfPoint(p[0],p[1]);
   const bb=pts=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};const pad=(b,d)=>[b[0]-d,b[1]-d,b[2]+d,b[3]+d];
   const who=P.PDFHexString.fromText(m.author||settings.author||''),date=P.PDFString.of(pdfDate(new Date(m.modified||Date.now())));
   const base=o=>Object.assign({Type:'Annot',C,T:who,M:date,CreationDate:date,F:4,CA:m.style.opacity??1,NM:P.PDFString.of('pm-'+m.id+o.Subtype)},o);
   const form=(ops,b)=>ctx.register(ctx.stream(ops,{Type:'XObject',Subtype:'Form',BBox:b,Resources:{}}));
   const popup=(ref,b)=>{const pr=ctx.register(ctx.obj({Type:'Annot',Subtype:'Popup',Parent:ref,Rect:[b[2],b[3]-80,b[2]+180,b[3]],Open:false,F:28}));ctx.lookup(ref).set(N('Popup'),pr);page.node.addAnnot(pr)};
   let caretRef=null;
   if(g.caret){const pts=g.caret.map(cv),rect=pad(bb(pts),1);const ops=`q ${C.map(f6).join(' ')} rg ${f6(pts[0][0])} ${f6(pts[0][1])} m ${f6(pts[1][0])} ${f6(pts[1][1])} l ${f6(pts[2][0])} ${f6(pts[2][1])} l h f Q`;
    caretRef=ctx.register(ctx.obj(base({Subtype:'Caret',Rect:rect,RD:[0,0,0,0],Sy:'None',Contents:P.PDFHexString.fromText(m.repl||''),Subj:P.PDFHexString.fromText(m.subject||RV_SUBJ[mode]),AP:{N:form(ops,rect)}})));
    page.node.addAnnot(caretRef);popup(caretRef,rect)}
   if(g.lines.length){const qp=[];let all=[];const rot=(vp.rotation||0)%180!==0;
    for(const r of(m.rects||[normBox(m.pts[0],m.pts[1])])){const c=[[r[0],r[1]],[r[2],r[1]],[r[0],r[3]],[r[2],r[3]]].map(cv);all=all.concat(c);
     // QuadPoints: upper-left, upper-right, lower-left, lower-right of the text, in reading direction
     qp.push(c[0][0],c[0][1],c[1][0],c[1][1],c[2][0],c[2][1],c[3][0],c[3][1])}
    const rect=pad(bb(all),1),lw=Math.max(.5,m.style.width||1.4);let ops=`q ${C.map(f6).join(' ')} RG ${f6(lw)} w `;for(const l of g.lines){const a=cv(l[0]),b=cv(l[1]);ops+=`${f6(a[0])} ${f6(a[1])} m ${f6(b[0])} ${f6(b[1])} l S `}ops+='Q';
    const so=base({Subtype:'StrikeOut',Rect:rect,QuadPoints:qp,Contents:P.PDFHexString.fromText(mode==='delete'?(m.comment||''):(m.orig||'')),Subj:P.PDFHexString.fromText(mode==='delete'?RV_SUBJ.delete:'Replace'),AP:{N:form(ops,rect)}});
    if(caretRef){so.IRT=caretRef;so.RT='Group'}const soRef=ctx.register(ctx.obj(so));page.node.addAnnot(soRef);if(!caretRef)popup(soRef,rect)}
  }catch(e){console.warn('review export',e)}}});
document.addEventListener('dblclick',e=>{if(!e.target.closest||!e.target.closest('.page'))return;if(S.tool!=='select'||S.sel.size!==1)return;const m=S.markups.find(x=>S.sel.has(x.id));if(m&&m.type==='review'){e.preventDefault();e.stopImmediatePropagation();reviewDialog(m,false)}},true);
H.props.push(m=>m&&m.type==='review'?`<div class="sec">Review</div><div class="hint" style="margin-bottom:4px">${esc(RV_SUBJ[m.mode||'replace'])}${m.orig?': “'+esc(m.orig)+'”':''}${m.repl?' → “'+esc(m.repl)+'”':''}</div><button class="btn" data-d3rv="${m.id}" style="border:1px solid var(--line)">Edit review mark…</button>`:'');
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-d3rv]');if(!b)return;const m=S.markups.find(x=>String(x.id)===b.dataset.d3rv);if(m)reviewDialog(m,false)});

/* ================================================================== 2. SPELLING IN THE DRAWING'S TEXT */
const SP={hits:[],ignore:new Set(),busy:false};
const pane=addTab('cspell','Spelling',`<div style="padding:10px;display:flex;flex-direction:column;gap:8px;min-height:0;height:100%">
 <div class="hint">Checks the spelling of the drawing's own text (not your markups — Tools → Check spelling does those).</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri" id="csRun">Check document</button><button class="btn" id="csRunP" style="border:1px solid var(--line)">This page</button><button class="btn" id="csMarkAll" style="border:1px solid var(--line)">Mark all</button>
 <select class="ti" id="csStyle" style="width:auto"><option value="squiggly">Squiggly</option><option value="underline">Underline</option></select></div>
 <div id="csSum" class="hint"></div><div id="csList" style="overflow:auto;flex:1;min-height:0"></div></div>`);
async function dictApi(){const W=window.PMWorkspace;if(!W||!W.loadDict)throw new Error('Spelling is not available');await W.loadDict();return W}
async function contentSpell(pagesToCheck){if(SP.busy)return;if(!S.pages.length)return toast('Open a PDF first');SP.busy=true;$('#csSum').textContent='Checking…';
 try{const W=await dictApi();const hits=[];
  for(const n of pagesToCheck){const{items,vp}=await pageText(n);
   for(const it of items){const s=it.str||'';const re=/[A-Za-z][A-Za-z’']*[A-Za-z]|[A-Za-z]/g;let mt;while((mt=re.exec(s))){const w=mt[0];if(W.okWord(w)||SP.ignore.has(w.toLowerCase()))continue;
     let r;if(it.vb){const cw=(it.vb[2]-it.vb[0])/(s.length||1);r=[it.vb[0]+cw*mt.index,it.vb[1],it.vb[0]+cw*(mt.index+w.length),it.vb[3]]}
     else if(it.rot){const q=vp.convertToViewportRectangle([it.x,it.y-it.h*.2,it.x+it.w,it.y+it.h*.85]);r=normBox([q[0],q[1]],[q[2],q[3]])}
     else{const cw=it.w/(s.length||1),x0=it.x+cw*mt.index,x1=x0+cw*w.length,q=vp.convertToViewportRectangle([x0,it.y-it.h*.2,x1,it.y+it.h*.85]);r=normBox([q[0],q[1]],[q[2],q[3]])}
     hits.push({page:n,w,r,sugg:W.suggest(w)})}}}
  SP.hits=hits;renderSpell()}catch(e){$('#csSum').textContent=e.message||'Could not check spelling'}finally{SP.busy=false}}
function renderSpell(){const L=$('#csList');if(!L)return;const h=SP.hits;$('#csSum').textContent=h.length?`${h.length} possible misspelling${h.length>1?'s':''}`:'No spelling mistakes found';
 L.innerHTML=h.map((x,i)=>`<div class="csRow" data-i="${i}" style="padding:6px 2px;border-bottom:1px solid var(--line)"><div style="display:flex;gap:6px;align-items:baseline"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(x.w)}</b><span class="hint">p${x.page}</span></div><div class="hint" style="font-size:11px;margin:1px 0 4px">${x.sugg.length?esc(x.sugg.slice(0,4).join(', ')):'no suggestions'}</div>
  <div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn" data-a="go" title="Show it on the drawing" style="height:24px;padding:0 8px;border:1px solid var(--line)">Show</button><button class="btn" data-a="mark" title="Mark it with a markup" style="height:24px;padding:0 8px;border:1px solid var(--line)">Mark</button><button class="btn" data-a="ign" title="Ignore this word" style="height:24px;padding:0 8px;border:1px solid var(--line)">Ignore</button><button class="btn" data-a="add" title="Add to your dictionary" style="height:24px;padding:0 8px;border:1px solid var(--line)">Add</button></div></div>`).join('')}
function markSpell(x){const type=($('#csStyle')&&$('#csStyle').value)||'squiggly',t=T[type]?type:'underline';const m=newMarkup(t,x.page,[[x.r[0],x.r[1]],[x.r[2],x.r[3]]],S.defaults[t]||BASE_DEF[t]);m.rects=[x.r];m.subject='Spelling';
 m.comment=`Spelling: “${x.w}”`+(x.sugg[0]?` — did you mean “${x.sugg[0]}”?`:'');S.markups.push(m);return m}
pane.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
 if(b.id==='csRun')return contentSpell(S.pages.map(p=>p.num));if(b.id==='csRunP')return contentSpell([S.cur]);
 if(b.id==='csMarkAll'){if(!SP.hits.length)return toast('Check the document first');pushUndo();SP.hits.forEach(markSpell);commit();redrawAll();renderList();toast(`Marked ${SP.hits.length} word${SP.hits.length>1?'s':''}`);return}
 const row=b.closest('[data-i]');if(!row)return;const x=SP.hits[+row.dataset.i];if(!x)return;const a=b.dataset.a;
 if(a==='go'){gotoPage(x.page);setTimeout(()=>{scrollToBox(x.page,x.r);S.flash={page:x.page,r:x.r};redrawPage(x.page);setTimeout(()=>{S.flash=null;redrawPage(x.page)},1600)},120)}
 else if(a==='mark'){pushUndo();markSpell(x);commit();redrawPage(x.page);renderList();SP.hits.splice(+row.dataset.i,1);renderSpell()}
 else if(a==='ign'){SP.ignore.add(x.w.toLowerCase());SP.hits=SP.hits.filter(y=>y.w.toLowerCase()!==x.w.toLowerCase());renderSpell()}
 else if(a==='add'){try{(await dictApi()).addDictWord(x.w)}catch(err){}SP.hits=SP.hits.filter(y=>y.w.toLowerCase()!==x.w.toLowerCase());renderSpell();toast(`Added “${x.w}” to your dictionary`)}});
H.open.push(()=>{SP.hits=[];const l=$('#csList');if(l){l.innerHTML='';$('#csSum').textContent=''}});

/* ================================================================== 3. PDF PACKAGES */
const PK={files:null,isColl:false,building:[]};
const pkgPane=addTab('pkg','Package',`<div style="padding:10px;display:flex;flex-direction:column;gap:8px;height:100%;min-height:0"><div id="pkHead" class="hint">PDF packages hold several files in one PDF.</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri" id="pkNew">Create package…</button><button class="btn" id="pkAll" style="border:1px solid var(--line)">Extract all</button></div><div id="pkList" style="overflow:auto;flex:1;min-height:0"></div></div>`);
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':n>1024?Math.round(n/1024)+' KB':n+' B';
function renderPkg(){const L=$('#pkList');if(!L)return;const f=PK.files||[];$('#pkHead').textContent=PK.isColl?`This PDF is a package with ${f.length} file${f.length===1?'':'s'}.`:f.length?`This PDF has ${f.length} embedded file${f.length===1?'':'s'}.`:'PDF packages hold several files in one PDF. Open one, or create one from files on your computer.';
 L.innerHTML=f.map((x,i)=>`<div data-i="${i}" style="display:flex;align-items:center;gap:6px;padding:6px 2px;border-bottom:1px solid var(--line)"><div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.name)}"><b>${esc(x.name)}</b><div class="hint" style="font-size:11px">${fmtSize(x.bytes.length)}${x.desc?' · '+esc(x.desc):''}</div></div>${/\.pdf$/i.test(x.name)?'<button class="btn" data-a="open">Open</button>':''}<button class="btn" data-a="save">Extract</button></div>`).join('')}
async function detectPackage(){PK.files=null;PK.isColl=false;const pdf=S.pdf;if(!pdf){renderPkg();return}let att=null;try{att=await pdf.getAttachments()}catch(e){}
 if(pdf!==S.pdf)return;const vals=att?Object.values(att):[];
 if(vals.length){try{const d=await PDFLib.PDFDocument.load(S.bytes,{ignoreEncryption:true,updateMetadata:false,throwOnInvalidObject:false});PK.isColl=!!d.catalog.get(N('Collection'))}catch(e){}
  PK.files=vals.map(a=>({name:a.filename||'file',bytes:a.content instanceof Uint8Array?a.content:new Uint8Array(a.content||[]),desc:a.description||''}))}
 renderPkg();if(PK.isColl){switchTab('pkg');toast(`Package: ${PK.files.length} file${PK.files.length===1?'':'s'} inside — see the Package panel`)}}
H.open.push(()=>setTimeout(detectPackage,150));
pkgPane.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='pkNew')return packageDialog();
 if(b.id==='pkAll'){if(!PK.files||!PK.files.length)return toast('No files in this PDF');const Z=await zipLib(),z=new Z();PK.files.forEach(f=>z.file(f.name,f.bytes));return saveFile(baseName()+'-files.zip',await z.generateAsync({type:'blob'}))}
 const row=b.closest('[data-i]');if(!row)return;const f=PK.files[+row.dataset.i];if(!f)return;
 if(b.dataset.a==='open')openBytes(f.bytes.slice(),f.name);else saveFile(f.name,toBlob(f.bytes,/\.pdf$/i.test(f.name)?'application/pdf':''))});
const mimeOf=n=>({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',dwg:'application/acad',dxf:'application/dxf',txt:'text/plain',csv:'text/csv',zip:'application/zip'})[(n.split('.').pop()||'').toLowerCase()]||'application/octet-stream';
function packageDialog(){PK.building=[];const render=()=>{const L=$('#pkB');if(L)L.innerHTML=PK.building.length?PK.building.map((f,i)=>`<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span><span class="hint">${fmtSize(f.bytes.length)}</span><button class="btn" data-rm="${i}">✕</button></div>`).join(''):'<div class="hint">No files yet.</div>'};
 modal('Create PDF package',`<div class="fld"><label>Files in the package</label><div id="pkB" style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div><div style="display:flex;gap:6px;margin-top:6px"><button class="btn" id="pkAdd" style="border:1px solid var(--line)">Add files…</button>${S.pages.length?'<label class="chk"><input type="checkbox" id="pkCur" checked> Include the open document (with markups)</label>':''}</div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Cover page</label><select class="ti" id="pkCov"><option value="gen">List of the files</option>${S.pages.length?'<option value="cur">The open document</option>':''}</select></div><div><label style="font-size:11px;color:var(--mut)">Show files as</label><select class="ti" id="pkView"><option value="D">Details</option><option value="T">Tiles</option></select></div></div>
 <div class="fld"><label>Package name</label><input class="ti" id="pkName" value="${esc((S.pages.length?baseName():'Package')+'-package')}"></div>`,
 [{label:'Cancel',cancel:1},{label:'Create',pri:1,fn:md=>{const o={cur:!!(md.querySelector('#pkCur')&&md.querySelector('#pkCur').checked),cover:md.querySelector('#pkCov').value,view:md.querySelector('#pkView').value,name:md.querySelector('#pkName').value.trim()||'package'};
   if(!PK.building.length&&!o.cur){toast('Add at least one file');return false}setTimeout(()=>buildPackage(PK.building.slice(),o).catch(e=>toast('Package failed: '+e.message)),0)}}]);
 render();$('#pkAdd').onclick=async()=>{const fs=await pickFiles('',true);for(const f of fs)PK.building.push({name:f.name,bytes:await readU8(f),mod:new Date(f.lastModified||Date.now())});render()};
 $('#pkB').onclick=e=>{const b=e.target.closest('[data-rm]');if(b){PK.building.splice(+b.dataset.rm,1);render()}}}
async function buildPackage(files,o={}){toast('Building package…');const P=PDFLib;let list=files.slice();
 if(o.cur&&S.pages.length){const by=await PMOutput.markedPdf(false);list.unshift({name:S.fileName.replace(/\.pdf$/i,'')+'.pdf',bytes:by,mod:new Date()})}
 let doc;if(o.cover==='cur'&&S.pages.length){doc=await P.PDFDocument.load(await PMOutput.markedPdf(true),{updateMetadata:false})}
 else{doc=await P.PDFDocument.create();const font=await doc.embedFont(P.StandardFonts.Helvetica),bold=await doc.embedFont(P.StandardFonts.HelveticaBold);let pg=doc.addPage([612,792]),y=730;
  pg.drawText(o.name||'PDF package',{x:54,y,size:20,font:bold});y-=24;pg.drawText(`${list.length} file${list.length===1?'':'s'} · ${new Date().toLocaleDateString()}`,{x:54,y,size:11,font,color:P.rgb(.35,.35,.35)});y-=30;
  pg.drawText('This PDF is a package. Open it in PlanMark or a PDF reader to see the files inside.',{x:54,y,size:10,font});y-=26;
  for(const f of list){if(y<60){pg=doc.addPage([612,792]);y=740}pg.drawText(safeTxt(f.name).slice(0,80),{x:66,y,size:11,font});pg.drawText(fmtSize(f.bytes.length),{x:470,y,size:10,font,color:P.rgb(.4,.4,.4)});y-=18}}
 for(const f of list)await doc.attach(f.bytes,f.name,{mimeType:mimeOf(f.name),description:f.desc||f.name,creationDate:f.mod||new Date(),modificationDate:f.mod||new Date()});
 const ctx=doc.context,S_=x=>P.PDFString.of(x);
 doc.catalog.set(N('Collection'),ctx.obj({Type:'Collection',View:o.view==='T'?'T':'D',
  Schema:{Type:'CollectionSchema',FileName:{Type:'CollectionField',Subtype:'F',N:S_('Name'),O:0},Desc:{Type:'CollectionField',Subtype:'Desc',N:S_('Description'),O:1},Size:{Type:'CollectionField',Subtype:'Size',N:S_('Size'),O:2},Mod:{Type:'CollectionField',Subtype:'ModDate',N:S_('Modified'),O:3}},
  Sort:{Type:'CollectionSort',S:'FileName',A:true}}));
 doc.catalog.set(N('PageMode'),N('UseAttachments'));
 const out=await doc.save();await saveFile((o.name||'package').replace(/\.pdf$/i,'')+'.pdf',toBlob(out,'application/pdf'));toast(`Package saved with ${list.length} file${list.length===1?'':'s'}`);return out}

/* ================================================================== 4. REVERT / REVERT AS */
const RDB={p:null};
function revDb(){if(RDB.p)return RDB.p;RDB.p=new Promise((res,rej)=>{const r=indexedDB.open('planmark-revisions',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('revs',{keyPath:'id',autoIncrement:true});s.createIndex('doc','doc')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return RDB.p}
const tx=(mode,fn)=>revDb().then(db=>new Promise((res,rej)=>{const t=db.transaction('revs',mode),st=t.objectStore('revs');let out;Promise.resolve(fn(st)).then(v=>out=v);t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error)}));
const reqP=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const docKey=()=>(S.fileName||'').replace(/-(markup|flattened)(?=\.pdf$)/i,'')+':'+(S.bytes?S.bytes.length:0);
async function listRevs(key){return tx('readonly',st=>reqP(st.index('doc').getAll(key||docKey()))).then(a=>(a||[]).sort((x,y)=>y.time-x.time))}
async function addRev(bytes){if(!DC.revKeep||!S.pdf)return;const key=docKey();
 const rec={doc:key,time:Date.now(),name:S.fileName,author:settings.author||'',bytes,markups:JSON.stringify(S.markups),scales:JSON.stringify(S.scales||{}),count:S.markups.length,size:bytes.length};
 await tx('readwrite',st=>{st.add(rec)});const all=await listRevs(key);const extra=all.slice(DC.revKeep);if(extra.length)await tx('readwrite',st=>{for(const r of extra)st.delete(r.id)});return rec}
const _sf=saveFile;saveFile=async function(name,data){if(D3.saving&&/\.pdf$/i.test(name)){D3.saving=false;try{const by=new Uint8Array(await toBlob(data).arrayBuffer());await addRev(by)}catch(e){console.warn('revision',e)}}return _sf.apply(this,arguments)};
function restoreRev(r){pushUndo();S.markups=JSON.parse(r.markups||'[]');try{S.scales=JSON.parse(r.scales||'{}')}catch(e){}S.sel.clear();commit();saveScales&&saveScales();redrawAll();renderList();renderProps();toast('Restored the version saved '+new Date(r.time).toLocaleString())}
async function revert(){if(!S.pdf)return toast('Open a PDF first');const rs=await listRevs();const r=rs[0];
 modal('Revert',r?`<div>Go back to the version you saved <b>${esc(new Date(r.time).toLocaleString())}</b> (${r.count} markup${r.count===1?'':'s'})? Changes made since then are discarded (Undo brings them back).</div>`:'<div>This document has not been saved from PlanMark on this computer yet. Revert to the original with no markups? (Undo brings them back.)</div>',
  [{label:'Cancel',cancel:1},{label:'Revert',pri:1,fn:()=>{if(r)restoreRev(r);else restoreRev({markups:'[]',scales:JSON.stringify(S.scales||{}),time:Date.now()})}}])}
async function revertAs(){if(!S.pdf)return toast('Open a PDF first');const rs=await listRevs();
 modal('Revert to a saved version',rs.length?`<div class="hint" style="margin-bottom:6px">PlanMark keeps the last ${DC.revKeep} saves of each document on this computer (Preferences → Saving).</div><div style="max-height:320px;overflow:auto">${rs.map((r,i)=>`<div style="display:flex;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)" data-r="${r.id}"><div style="flex:1"><b>${esc(new Date(r.time).toLocaleString())}</b>${i===0?' <span class="hint">(latest)</span>':''}<div class="hint" style="font-size:11px">${r.count} markup${r.count===1?'':'s'} · ${fmtSize(r.size)}${r.author?' · '+esc(r.author):''}</div></div><button class="btn" data-a="restore">Restore</button><button class="btn" data-a="open">Open in new tab</button><button class="btn" data-a="del" title="Delete this version">✕</button></div>`).join('')}</div>`:'<div class="hint">No saved versions of this document yet. Each time you save, a version is kept here.</div>',[{label:'Close',cancel:1}]);
 $('#modal').onclick=async e=>{const b=e.target.closest('[data-a]');if(!b)return;const id=+b.closest('[data-r]').dataset.r,r=rs.find(x=>x.id===id);if(!r)return;
  if(b.dataset.a==='restore'){closeModal();restoreRev(r)}else if(b.dataset.a==='open'){closeModal();const t=new Date(r.time),nm=baseName().replace(/-(markup|flattened)$/,'')+` (saved ${t.getMonth()+1}-${t.getDate()} ${String(t.getHours()).padStart(2,'0')}${String(t.getMinutes()).padStart(2,'0')}).pdf`;openBytes(r.bytes.slice(),nm)}
  else if(b.dataset.a==='del'){await tx('readwrite',st=>{st.delete(id)});b.closest('[data-r]').remove()}}}

/* ================================================================== 5. FILE LOCKS (Windows app) */
const desk=()=>window.pmDesktop&&window.pmDesktop.lockCheck?window.pmDesktop:null;
// registered in the ready phase, after desktop.js's own handler: registering earlier would make the main process deliver
// a launch file before anything is ready to open it
H.ready.push(()=>{if(window.pmDesktop&&pmDesktop.onOpenFile)pmDesktop.onOpenFile(f=>{if(f&&f.path)D3.pendingPath[f.name]=f.path})});
const _of=openFile;openFile=async function(f){try{if(f&&window.pmDesktop&&pmDesktop.pathForFile){const p=pmDesktop.pathForFile(f);if(p)D3.pendingPath[f.name]=p}}catch(e){}return _of.apply(this,arguments)};
H.open.push(()=>{const nm=S.fileName,p=D3.pendingPath[nm];if(!p||!desk())return;delete D3.pendingPath[nm];D3.ro[S.fileKey]&&applyRo();lockFlow(p,S.fileKey,nm)});
function setRo(key,on,who){if(on)D3.ro[key]=who||{};else delete D3.ro[key];applyRo()}
function applyRo(){const W=window.PMWorkspace,ro=D3.ro[S.fileKey];if(W&&W.P){if(ro){if(!W.P.__d3prev)W.P.__d3prev={viewMode:W.P.viewMode};W.P.viewMode=true;setTool('select')}else if(W.P.__d3prev){W.P.viewMode=W.P.__d3prev.viewMode;delete W.P.__d3prev}}
 let b=$('#d3Ro');if(ro&&!b){b=document.createElement('div');b.id='d3Ro';b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:84px;z-index:40;background:#7c2d12;color:#fff;padding:6px 12px;border-radius:6px;font-size:12.5px;box-shadow:0 6px 20px rgba(0,0,0,.4)';document.body.appendChild(b)}
 if(b){if(ro)b.innerHTML=`Read-only copy — ${esc(ro.user||'someone')} has this file open${ro.computer?' on '+esc(ro.computer):''}. ${ro.notify?'You\'ll be told when it\'s free.':''}`;else b.remove()}}
H.open.push(()=>setTimeout(applyRo,0));
async function lockFlow(path,key,name){const d=desk();let L=null;try{L=await d.lockCheck(path)}catch(e){return}
 const take=async()=>{try{await d.lockAcquire(path,settings.author||'');D3.locks[path]={key,name}}catch(e){}};
 if(!L||L.mine||L.stale)return take();
 const who=`<b>${esc(L.user||'Someone')}</b>${L.computer?' on '+esc(L.computer):''}`,since=L.time?new Date(L.time).toLocaleString():'';
 modal('File in use',`<div>${esc(name)} is open by ${who}${since?' since '+esc(since):''}.</div><div class="hint" style="margin-top:6px">Editing it at the same time can overwrite their changes.</div>`,
  [{label:'Open anyway',fn:()=>{setRo(key,false);take()}},{label:'Notify me when it\'s free',fn:()=>{setRo(key,true,Object.assign({notify:true},L));watchLock(path,key,name)}},{label:'Open read-only copy',pri:1,fn:()=>setRo(key,true,L)}])}
function watchLock(path,key,name){const d=desk();const iv=setInterval(async()=>{let L=null;try{L=await d.lockCheck(path)}catch(e){}if(L&&!L.mine&&!L.stale)return;clearInterval(iv);
  toast(name+' is free now');modal('File available',`<div>${esc(name)} is no longer open by anyone else.</div>`,[{label:'Stay read-only',cancel:1},{label:'Edit now',pri:1,fn:async()=>{await d.lockAcquire(path,settings.author||'');D3.locks[path]={key,name};setRo(key,false)}}])},D3.lockPoll||15000)}
function releaseClosed(){const d=desk();if(!d)return;const open=new Set();try{for(const t of(PMViews.tabs||[])){const k=t.st?t.st.fileKey:null;if(k)open.add(k)}}catch(e){}if(S.fileKey)open.add(S.fileKey);
 for(const[p,l]of Object.entries(D3.locks))if(!open.has(l.key)){d.lockRelease(p).catch(()=>{});delete D3.locks[p]}}
addEventListener('beforeunload',()=>{const d=desk();if(d)for(const p of Object.keys(D3.locks))try{d.lockRelease(p)}catch(e){}});

/* ================================================================== 6. BATCH REPAIR */
async function repairBytes(bytes,name){const P=PDFLib;
 try{const d=await P.PDFDocument.load(bytes,{ignoreEncryption:true,throwOnInvalidObject:false,updateMetadata:false});if(!d.getPageCount())throw new Error('no pages');const out=await d.save({useObjectStreams:true});
  const t=await pdfjsLib.getDocument({data:out.slice(),isEvalSupported:false}).promise;const n=t.numPages;await t.destroy();if(!n)throw new Error('no pages');return{bytes:out,how:'rebuilt the file structure',pages:n}}
 catch(e){let src;try{src=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false,stopAtErrors:false}).promise}catch(e2){console.warn('repair',name,e&&e.message,e2&&e2.message);return{err:'could not be read at all'}}
  const d=await P.PDFDocument.create();for(let i=1;i<=src.numPages;i++){try{const pg=await src.getPage(i),v=pg.getViewport({scale:150/72}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:cx,viewport:v}).promise;
    const jb=await new Promise(r=>c.toBlob(r,'image/jpeg',.88));const im=await d.embedJpg(new Uint8Array(await jb.arrayBuffer()));const w=v.width*72/150,h=v.height*72/150;d.addPage([w,h]).drawImage(im,{x:0,y:0,width:w,height:h})}catch(e3){}}
  const n=src.numPages;await src.destroy();if(!d.getPageCount())return{err:'no pages could be recovered'};return{bytes:await d.save(),how:'re-created the pages from their rendered images',pages:n}}}
async function batchRepair(files){if(!files){files=await pickFiles('application/pdf,.pdf',true)}if(!files||!files.length)return;toast(`Repairing ${files.length} file${files.length>1?'s':''}…`);const res=[];
 for(const f of files){const by=f instanceof Blob?await readU8(f):u8of(f.bytes);const r=await repairBytes(by,f.name);res.push(Object.assign({name:f.name},r))}
 const ok=res.filter(r=>r.bytes),out=n=>n.replace(/\.pdf$/i,'')+'-repaired.pdf';
 if(ok.length===1)await saveFile(out(ok[0].name),toBlob(ok[0].bytes,'application/pdf'));else if(ok.length>1){const Z=await zipLib(),z=new Z();ok.forEach(r=>z.file(out(r.name),r.bytes));await saveFile('repaired-pdfs.zip',await z.generateAsync({type:'blob'}))}
 modal('Batch repair',`<div style="max-height:300px;overflow:auto">${res.map(r=>`<div style="padding:4px 0;border-bottom:1px solid var(--line)"><b>${esc(r.name)}</b><div class="hint" style="font-size:11.5px">${r.bytes?'Repaired: '+esc(r.how)+` (${r.pages} page${r.pages===1?'':'s'})`:'Not repaired: '+esc(r.err)}</div></div>`).join('')}</div>`,[{label:'Close',cancel:1}]);D3.lastRepair=res;return res}

/* ================================================================== 7. EMBEDDED FONTS + IMAGE ENCODING (applied while saving) */
const STDMAP={'Helvetica':'Sans-Regular','Helvetica-Bold':'Sans-Bold','Helvetica-Oblique':'Sans-Italic','Helvetica-BoldOblique':'Sans-BoldItalic','Times-Roman':'Serif-Regular','Times-Bold':'Serif-Bold','Times-Italic':'Serif-Italic','Times-BoldItalic':'Serif-BoldItalic','Courier':'Mono-Regular','Courier-Bold':'Mono-Bold','Courier-Oblique':'Mono-Italic','Courier-BoldOblique':'Mono-BoldItalic'};
async function loadFonts(){await loadScript('js/d3fontkit.js',()=>!!window.fontkit);await loadScript('js/d3fonts.js',()=>!!window.PM_D3FONTS);const c=D3.fcache||(D3.fcache={});return c}
const proto=PDFLib.PDFDocument.prototype,_ef=proto.embedFont,_png=proto.embedPng,_jpg=proto.embedJpg;
proto.embedFont=async function(font,opts){if(D3.fontsOn&&typeof font==='string'&&STDMAP[font]&&window.PM_D3FONTS&&window.fontkit){try{const k=STDMAP[font];this.__d3f=this.__d3f||{};if(this.__d3f[k])return this.__d3f[k];
  if(!this.__d3fk){this.registerFontkit(window.fontkit);this.__d3fk=true}const c=D3.fcache||(D3.fcache={});const by=c[k]||(c[k]=b64u8(PM_D3FONTS[k]));const f=await _ef.call(this,by,{subset:true});
  // keep the familiar name in the PDF
  this.__d3f[k]=f;D3.embedded.add(k);return f}catch(e){console.warn('embed font',font,e)}}return _ef.apply(this,arguments)};
function u8of(d){if(d instanceof Uint8Array)return d;if(d instanceof ArrayBuffer)return new Uint8Array(d);if(typeof d==='string'){const s=d.startsWith('data:')?d.split(',')[1]:d;return b64u8(s)}return null}
async function reencode(data,fromType,toType,q){try{const u=u8of(data);if(!u)return null;const bm=await createImageBitmap(new Blob([u],{type:fromType}));const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const cx=c.getContext('2d');
  if(toType==='image/jpeg'){cx.drawImage(bm,0,0);const id=cx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<id.length;i+=4*7)if(id[i]<255)return null;cx.globalCompositeOperation='destination-over';cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height)}else cx.drawImage(bm,0,0);
  const b=await new Promise(r=>c.toBlob(r,toType,q));return b?new Uint8Array(await b.arrayBuffer()):null}catch(e){return null}}
proto.embedPng=async function(data){if(D3.exp&&DC.imgEnc==='jpeg'){const j=await reencode(data,'image/png','image/jpeg',(DC.jpegQ||85)/100);if(j){D3.imgConv=(D3.imgConv||0)+1;return _jpg.call(this,j)}}return _png.apply(this,arguments)};
proto.embedJpg=async function(data){if(D3.exp&&DC.imgEnc==='flate'){const p=await reencode(data,'image/jpeg','image/png');if(p){D3.imgConv=(D3.imgConv||0)+1;return _png.call(this,p)}}
 if(D3.exp&&DC.imgEnc==='jpeg'&&(DC.jpegQ||85)<90){const j=await reencode(data,'image/jpeg','image/jpeg',(DC.jpegQ||85)/100);const u=u8of(data);if(j&&u&&j.length<u.length*.9){D3.imgConv=(D3.imgConv||0)+1;return _jpg.call(this,j)}}return _jpg.apply(this,arguments)};
// every export: real annotations for review marks, embedded fonts, image encoding, and a saved version for Revert
const _ex=exportPDF;exportPDF=async function(flat){const outer=!D3.exp;if(outer){D3.exp={flat:!!flat};D3.embedded=new Set();D3.imgConv=0;if(DC.embedFonts||D3.forceFonts){try{await loadFonts();D3.fontsOn=true}catch(e){console.warn(e)}}if(!flat)D3.saving=true}
 try{return await _ex.apply(this,arguments)}finally{if(outer){D3.lastExport={embedded:[...D3.embedded],imgConv:D3.imgConv,flat:!!flat};D3.exp=null;D3.fontsOn=false;D3.saving=false}}};

/* ================================================================== 8. PDF/A */
function loadIcc(){return loadScript('lib/pdfedit/srgb-icc.js',()=>!!window.PM_SRGB_ICC).then(()=>b64u8(window.PM_SRGB_ICC))}
const xe=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);
function streamText(ctx,st){const P=PDFLib;try{const o=st instanceof P.PDFRef?ctx.lookup(st):st;if(!o)return'';if(o instanceof P.PDFRawStream)return new TextDecoder('latin1').decode(P.decodePDFRawStream(o).decode());if(o.getUnencodedContents)return new TextDecoder('latin1').decode(o.getUnencodedContents());if(o.getContents)return new TextDecoder('latin1').decode(o.getContents())}catch(e){}return null}
function usedFontNames(ctx,contents){const P=PDFLib,L=x=>x instanceof P.PDFRef?ctx.lookup(x):x;const c=L(contents);if(!c)return new Set();const arr=c instanceof P.PDFArray?c.asArray():[c];let txt='';for(const x of arr){const t=streamText(ctx,x);if(t==null)return null;txt+=t+'\n'}
 const out=new Set();const re=/\/([^\s\/\[\]<>(){}%]+)\s+[-+\d.]+\s+Tf\b/g;let m;while((m=re.exec(txt)))out.add(m[1]);return out}
// true when every font the content actually uses has its font file embedded
function fontsOk(ctx,dict,seen=new Set(),contents){const P=PDFLib,L=x=>x instanceof P.PDFRef?ctx.lookup(x):x;let ok=true;const res=L(dict.get(N('Resources')));if(!res||!res.get)return true;
 const used=usedFontNames(ctx,contents!==undefined?contents:dict.get(N('Contents')));
 const F=L(res.get(N('Font')));if(F&&F.entries)for(const[k,v]of F.entries()){if(used&&!used.has(k.decodeText?k.decodeText():String(k).slice(1)))continue;const fd=L(v);if(!fd||!fd.get)continue;let desc=L(fd.get(N('FontDescriptor')));const st=L(fd.get(N('Subtype')));
  if(st&&String(st)==='/Type3')continue;if(st&&String(st)==='/Type0'){const da=L(fd.get(N('DescendantFonts')));const df=da&&L(da.get(0));desc=df&&L(df.get(N('FontDescriptor')))}
  if(!(desc&&desc.get&&(desc.get(N('FontFile'))||desc.get(N('FontFile2'))||desc.get(N('FontFile3')))))ok=false}
 const X=L(res.get(N('XObject')));if(X&&X.entries)for(const[,v]of X.entries()){const key=String(v);if(seen.has(key))continue;seen.add(key);const xo=L(v);const d=xo&&xo.dict;if(d&&String(L(d.get(N('Subtype'))))==='/Form'&&!fontsOk(ctx,d,seen,v))ok=false}return ok}
function transparent(ctx,page){const P=PDFLib,L=x=>x instanceof P.PDFRef?ctx.lookup(x):x;const res=L(page.node.get(N('Resources')));if(page.node.get(N('Group')))return true;if(!res||!res.get)return false;
 const G=L(res.get(N('ExtGState')));if(G&&G.entries)for(const[,v]of G.entries()){const g=L(v);if(!g||!g.get)continue;for(const k of['CA','ca']){const x=L(g.get(N(k)));if(x&&x.asNumber&&x.asNumber()<1)return true}const sm=L(g.get(N('SMask')));if(sm&&String(sm)!=='/None')return true;const bm=L(g.get(N('BM')));if(bm&&!['/Normal','/Compatible'].includes(String(bm)))return true}
 const X=L(res.get(N('XObject')));if(X&&X.entries)for(const[,v]of X.entries()){const xo=L(v);const d=xo&&xo.dict;if(d&&(d.get(N('SMask'))||d.get(N('Group'))))return true}return false}
async function rasterPages(d,base,idx){const pdfjs=await pdfjsLib.getDocument({data:base.slice(),isEvalSupported:false}).promise;for(const i of[...idx].sort((a,b)=>b-a)){const pg=await pdfjs.getPage(i+1),v=pg.getViewport({scale:200/72}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:cx,viewport:v}).promise;
  const jb=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));const img=await d.embedJpg(new Uint8Array(await jb.arrayBuffer()));const w=v.width*72/200,h=v.height*72/200;const np=d.insertPage(i+1,[w,h]);np.drawImage(img,{x:0,y:0,width:w,height:h});d.removePage(i)}await pdfjs.destroy()}
async function buildPdfa(level){level=level||DC.pdfaLevel||'2b';const part=+level[0],P=PDFLib;D3.forceFonts=true;let base;try{base=await PMOutput.markedPdf(true)}finally{D3.forceFonts=false}
 const d=await P.PDFDocument.load(base,{updateMetadata:false});const ctx=d.context,L=x=>x instanceof P.PDFRef?ctx.lookup(x):x,cat=d.catalog;const notes=[];
 // no JavaScript, no actions that run code, no encryption (markedPdf output is never encrypted)
 const names=L(cat.get(N('Names')));if(names&&names.delete){if(names.get(N('JavaScript'))){names.delete(N('JavaScript'));notes.push('removed document JavaScript')}if(part<3&&names.get(N('EmbeddedFiles'))){names.delete(N('EmbeddedFiles'));notes.push('removed attached files (PDF/A-'+part+' does not allow them)')}}
 for(const k of['OpenAction','AA']){const v=L(cat.get(N(k)));if(v&&(k==='AA'||(v.get&&String(L(v.get(N('S'))))==='/JavaScript'))){cat.delete(N(k))}}
 // which pages must become images: fonts that can't be embedded (from the original drawing), and transparency for PDF/A-1
 const bad=new Set();d.getPages().forEach((p,i)=>{if(!fontsOk(ctx,p.node))bad.add(i);if(part===1&&transparent(ctx,p))bad.add(i);p.node.delete(N('AA'))});
 if(bad.size){await rasterPages(d,base,bad);notes.push(`page${bad.size>1?'s':''} ${[...bad].map(i=>i+1).sort((a,b)=>a-b).join(', ')} converted to images (${part===1?'non-embedded fonts or transparency':'non-embedded fonts in the original drawing'})`)}
 // annotations: printable, no hidden flags; drop annotation types PDF/A forbids
 for(const p of d.getPages()){const A=L(p.node.get(N('Annots')));if(!A||!A.size)continue;const keep=[];for(let i=0;i<A.size();i++){const r=A.get(i),a=L(r);if(!a||!a.get)continue;const st=String(L(a.get(N('Subtype'))));if(['/Sound','/Movie','/FileAttachment','/3D','/RichMedia','/Screen'].includes(st)&&!(st==='/FileAttachment'&&part===3))continue;if(st!=='/Popup')a.set(N('F'),P.PDFNumber.of(4));keep.push(r)}p.node.set(N('Annots'),ctx.obj(keep))}
 const title=d.getTitle()||baseName(),now=new Date(),cd=d.getCreationDate()||now,iso=x=>x.toISOString().replace(/\.\d+Z$/,'Z');d.setTitle(title);d.setProducer('PlanMark');d.setCreator('PlanMark');d.setModificationDate(now);d.setCreationDate(cd);if(!d.getAuthor()&&settings.author)d.setAuthor(settings.author);
 const xmp=`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdfaid:part>${part}</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xe(title)}</rdf:li></rdf:Alt></dc:title>${d.getAuthor()?`<dc:creator><rdf:Seq><rdf:li>${xe(d.getAuthor())}</rdf:li></rdf:Seq></dc:creator>`:''}<xmp:CreateDate>${iso(cd)}</xmp:CreateDate><xmp:ModifyDate>${iso(now)}</xmp:ModifyDate><xmp:MetadataDate>${iso(now)}</xmp:MetadataDate><xmp:CreatorTool>PlanMark</xmp:CreatorTool><pdf:Producer>PlanMark</pdf:Producer></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
 cat.set(N('Metadata'),ctx.register(ctx.stream(new TextEncoder().encode(xmp),{Type:'Metadata',Subtype:'XML'})));
 const icc=await loadIcc();const oi=ctx.obj({Type:'OutputIntent',S:'GTS_PDFA1',OutputConditionIdentifier:P.PDFString.of('sRGB IEC61966-2.1'),RegistryName:P.PDFString.of('http://www.color.org'),Info:P.PDFString.of('sRGB IEC61966-2.1'),DestOutputProfile:ctx.register(ctx.flateStream(icc,{N:3}))});cat.set(N('OutputIntents'),ctx.obj([ctx.register(oi)]));
 const id=P.PDFHexString.of([...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''));ctx.trailerInfo.ID=ctx.obj([id,id]);
 const bytes=await d.save({useObjectStreams:false,updateFieldAppearances:false});
 // PDF/A-1 is based on PDF 1.4: the header says so (same length, offsets unchanged)
 if(part===1&&new TextDecoder('latin1').decode(bytes.subarray(0,8))==='%PDF-1.7')bytes.set(new TextEncoder().encode('%PDF-1.4'),0);return{bytes,notes,level,check:checkPdfa(bytes,part)}}
function checkPdfa(bytes,part){const s=new TextDecoder('latin1').decode(bytes.subarray(0,Math.min(bytes.length,60e6)));const r={header:s.slice(0,8),outputIntent:/\/OutputIntents/.test(s)&&/\/GTS_PDFA1/.test(s),xmp:new RegExp('<pdfaid:part>'+part+'</pdfaid:part>').test(s),id:/\/ID\s*\[/.test(s),noJS:!/\/JavaScript|\/JS\s*[(<]/.test(s),noEncrypt:!/\/Encrypt\s/.test(s),noObjStm:part>1||!/\/ObjStm/.test(s)};r.ok=Object.entries(r).every(([k,v])=>k==='header'||v)&&(part!==1||r.header==='%PDF-1.4');return r}
async function pdfaDialog(){if(!S.pages.length)return toast('Open a PDF first');modal('Save as PDF/A (archive)',`<div class="fld"><label>Conformance level</label><select class="ti" id="paL">${[['1b','PDF/A-1b — oldest, widest support (no transparency)'],['2b','PDF/A-2b — recommended'],['3b','PDF/A-3b — allows any attached files']].map(([v,l])=>`<option value="${v}" ${DC.pdfaLevel===v?'selected':''}>${l}</option>`).join('')}</select></div>
 <div class="hint">Markups are flattened into the pages, fonts are embedded, an sRGB output intent and PDF/A metadata are added, and JavaScript is removed. Pages whose original fonts aren't embedded become images. PlanMark checks the structure; for a certified result, run the file through a PDF/A validator such as veraPDF.</div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:md=>{const lv=md.querySelector('#paL').value;DC.pdfaLevel=lv;saveDC();setTimeout(async()=>{toast('Building PDF/A…');try{const r=await buildPdfa(lv);D3.lastPdfa=r;await saveFile(baseName()+`-PDFA-${lv}.pdf`,toBlob(r.bytes,'application/pdf'));
   toast(`Saved PDF/A-${lv}${r.notes.length?' — '+r.notes.join('; '):''}${r.check.ok?'':' (structure check found issues)'}`)}catch(e){console.error(e);toast('PDF/A failed: '+e.message)}},0)}}])}
new MutationObserver(()=>{const b=$('#ceA');if(b&&!b.dataset.d3){b.dataset.d3=1;b.querySelector('small')&&(b.querySelector('small').textContent='PDF/A-1b, 2b or 3b archive copy');b.onclick=()=>{closeModal();pdfaDialog()}}}).observe($('#modal'),{childList:true,subtree:true});

/* ================================================================== 9. EMAIL */
const fill=(t,v)=>String(t||'').replace(/\{(\w+)\}/g,(m,k)=>v[k]!=null?v[k]:m);
async function emailDialog(){if(!S.pages.length)return toast('Open a PDF first');const tp=DC.emailTpl.length?DC.emailTpl:DEF_TPL;const v={file:baseName()+'.pdf',project:projectName()||baseName(),date:new Date().toLocaleDateString(),author:settings.author||'',pages:S.pages.length};
 const desktop=!!(window.pmDesktop&&pmDesktop.emailFile);
 modal('Email',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Template</label><select class="ti" id="emT">${tp.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('')}</select></div><div><label style="font-size:11px;color:var(--mut)">Attach</label><select class="ti" id="emA"><option value="edit">PDF with editable markups</option><option value="flat">Flattened copy</option></select></div></div>
 <div class="fld"><label>To</label><input class="ti" id="emTo" placeholder="name@company.com; …"></div><div class="fld"><label>Subject</label><input class="ti" id="emS"></div><div class="fld"><label>Message</label><textarea class="ti" id="emB" rows="6"></textarea></div>
 ${desktop?'':`<div class="fld"><label>Send with</label><select class="ti" id="emH"><option value="app" ${DC.emailHow==='app'?'selected':''}>My email app</option><option value="gmail" ${DC.emailHow==='gmail'?'selected':''}>Gmail in the browser</option></select></div>`}
 <div class="hint">${desktop?'Outlook (if installed) opens a new message with the PDF attached. Otherwise your email app opens and the PDF is shown in its folder, ready to drag into the message.':'Browsers can\'t attach files to an email: the PDF is downloaded, then your email opens with the subject and message filled in — attach the downloaded PDF.'}</div>`,
 [{label:'Edit templates…',fn:()=>{setTimeout(tplDialog,0)}},{label:'Cancel',cancel:1},{label:'Create email',pri:1,fn:md=>{const o={to:md.querySelector('#emTo').value.trim(),subject:md.querySelector('#emS').value,body:md.querySelector('#emB').value,flat:md.querySelector('#emA').value==='flat',how:md.querySelector('#emH')?md.querySelector('#emH').value:'app'};if(!desktop){DC.emailHow=o.how;saveDC()}setTimeout(()=>sendEmail(o).catch(e=>toast('Email failed: '+e.message)),0)}}]);
 const ap=()=>{const t=tp[+$('#emT').value]||tp[0];$('#emS').value=fill(t.subject,v);$('#emB').value=fill(t.body,v)};$('#emT').onchange=ap;ap()}
async function sendEmail(o){const by=await PMOutput.markedPdf(!!o.flat);const name=baseName()+(o.flat?'-flattened':'')+'.pdf';const q=`subject=${encodeURIComponent(o.subject)}&body=${encodeURIComponent(o.body)}`;
 if(window.pmDesktop&&pmDesktop.emailFile){const r=await pmDesktop.emailFile({name,bytes:by,to:o.to,subject:o.subject,body:o.body});D3.lastEmail=Object.assign({name,size:by.length},r);toast(r.method==='outlook'?'Outlook opened a new message with the PDF attached':r.method==='mailto'?'Your email app opened — the PDF is in the folder that just opened; drag it into the message':'Could not open an email app: '+(r.reason||''));return r}
 await saveFile(name,toBlob(by,'application/pdf'));const url=o.how==='gmail'?`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(o.to)}&su=${encodeURIComponent(o.subject)}&body=${encodeURIComponent(o.body)}`:`mailto:${encodeURIComponent(o.to).replace(/%40/g,'@').replace(/%3B/gi,';')}?${q}`;
 D3.lastEmail={name,size:by.length,url,method:o.how};if(!D3.noOpen){if(o.how==='gmail')window.open(url,'_blank','noopener');else location.href=url}toast('PDF downloaded — attach it to the email that opened');return D3.lastEmail}
function tplDialog(){const list=clone(DC.emailTpl.length?DC.emailTpl:DEF_TPL);let cur=0;const draw=()=>{const t=list[cur]||{name:'',subject:'',body:''};$('#tpSel').innerHTML=list.map((x,i)=>`<option value="${i}" ${i===cur?'selected':''}>${esc(x.name)}</option>`).join('');$('#tpN').value=t.name;$('#tpS').value=t.subject;$('#tpB').value=t.body};
 modal('Email templates',`<div class="row fld"><select class="ti" id="tpSel"></select><button class="btn" id="tpAdd" style="border:1px solid var(--line)">New</button><button class="btn" id="tpDel" style="border:1px solid var(--line)">Delete</button></div>
 <div class="fld"><label>Name</label><input class="ti" id="tpN"></div><div class="fld"><label>Subject</label><input class="ti" id="tpS"></div><div class="fld"><label>Message</label><textarea class="ti" id="tpB" rows="6"></textarea></div><div class="hint">Placeholders: {file} {project} {date} {author} {pages}</div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:()=>{sync();DC.emailTpl=list.filter(t=>t.name.trim());saveDC();toast('Templates saved')}}]);
 const sync=()=>{const t=list[cur];if(t){t.name=$('#tpN').value;t.subject=$('#tpS').value;t.body=$('#tpB').value}};
 $('#tpSel').onchange=e=>{sync();cur=+e.target.value;draw()};$('#tpAdd').onclick=()=>{sync();list.push({name:'New template',subject:'{file}',body:''});cur=list.length-1;draw()};$('#tpDel').onclick=()=>{list.splice(cur,1);cur=Math.max(0,cur-1);draw()};draw()}

/* ================================================================== 10. PREFERENCES + LANGUAGE */
window.PM_LANGS=[['en','English'],['es','Español (Spanish)']];
function resetHidden(){let n=0;for(const k of Object.keys(localStorage))if(/^pm:.*(seen|dismiss|hidden|hint|tip|banner)/i.test(k)){localStorage.removeItem(k);n++}try{sessionStorage.clear()}catch(e){}toast(n?`Reset ${n} hidden message setting${n>1?'s':''} — tips and what's-new notes will show again`:'No hidden messages to reset')}
window.PM_EXTRA_PREFS_DC=()=>{const TO=()=>(window.PMTakeoff&&PMTakeoff.TO)||{};return[
 {s:'Saving',l:'Embed fonts in saved PDFs (recommended; needed for PDF/A)',t:'bool',g:()=>DC.embedFonts,v:x=>{DC.embedFonts=!!x;saveDC()}},
 {s:'Saving',l:'Image encoding when saving',t:'select',o:[['auto','Keep as is'],['jpeg','JPEG (smaller files)'],['flate','Lossless (Flate/PNG)']],g:()=>DC.imgEnc,v:x=>{DC.imgEnc=x;saveDC()}},
 {s:'Saving',l:'JPEG quality (50–100)',t:'number',min:50,max:100,g:()=>DC.jpegQ,v:x=>{DC.jpegQ=Math.max(50,Math.min(100,+x||85));saveDC()}},
 {s:'Saving',l:'Saved versions to keep per document (for Revert)',t:'number',min:0,max:50,g:()=>DC.revKeep,v:x=>{DC.revKeep=Math.max(0,Math.min(50,+x||0));saveDC()}},
 {s:'Saving',l:'PDF/A conformance level',t:'select',o:[['1b','PDF/A-1b'],['2b','PDF/A-2b'],['3b','PDF/A-3b']],g:()=>DC.pdfaLevel,v:x=>{DC.pdfaLevel=x;saveDC()}},
 {s:'Markups',l:"Copy a tool's comment text to new markups (Tool Chest)",t:'bool',g:()=>TO().keepComment!==false,v:x=>{const t=TO();t.keepComment=!!x;LS.set('pm:to',t)}},
 {s:'Email',l:'Email templates…',t:'button',run:tplDialog},
 {s:'General',l:'Reset hidden messages',t:'button',run:resetHidden},
 {s:'General',l:'Usage data…',t:'button',run:()=>modal('Usage data','<div>PlanMark does not collect or send usage data, analytics or crash reports. Your files stay on your computer; only your settings sync to your Olympia account when you sign in.</div>',[{label:'Close',cancel:1}])},
 {s:'Advanced',l:'Web tab home page',t:'text',g:()=>DC.webHome,v:x=>{DC.webHome=x||'about:blank';saveDC()}}]};
window.PM_EXTRA_CMDS=()=>[
 {id:'dc:review',menu:'Tools',label:'Review Text',key:'Shift+Alt+R',run:needDoc(()=>setTool('review'))},
 {id:'dc:cspell',menu:'Tools',label:'Check spelling in drawing text…',key:'',run:needDoc(()=>{switchTab('cspell');contentSpell(S.pages.map(p=>p.num))})},
 {id:'dc:email',menu:'File',label:'Email…',key:'',run:needDoc(emailDialog)},
 {id:'dc:revert',menu:'File',label:'Revert',key:'',run:needDoc(revert)},
 {id:'dc:revertas',menu:'File',label:'Revert to a saved version…',key:'',run:needDoc(revertAs)},
 {id:'dc:pdfa',menu:'File',label:'Save as PDF/A…',key:'',run:needDoc(pdfaDialog)},
 {id:'dc:pkg',menu:'File',label:'Create PDF package…',key:'',run:packageDialog},
 {id:'dc:web',menu:'File',label:'New web tab',key:'Ctrl+T',run:()=>openWeb()},
 {id:'dc:brepair',menu:'Batch',label:'Batch repair PDFs…',key:'',run:()=>batchRepair()}];

/* ---- Spanish ---- */
const ES=window.PM_I18N_ES||{};
const I18N={orig:new WeakMap(),attrs:new WeakMap(),on:false,busy:false};
const SKIP='#pages,#viewer .page,#mlBody tbody,#dlDoc,#tabBar .nm,.ti,textarea,input,select option[value=""],#csList b,#pkList b,script,style,svg text,#toast';
function lang(){try{return(window.PMWorkspace&&PMWorkspace.P&&PMWorkspace.P.language)||'en'}catch(e){return'en'}}
function patTr(k){for(const[re,fn]of(window.PM_I18N_ES_PATTERNS||[])){const m=k.match(re);if(m){const r=fn(...m);if(r!=null)return r}}return null}
function trNode(n){if(n.nodeType===3){const v=n.nodeValue,k=v.trim();if(!k||k.length>90)return;const p=n.parentElement;if(!p||p.closest(SKIP))return;let t=ES[k];if(t==null){const m=k.match(/^(.*?)(…|\.\.\.|:)$/);if(m&&ES[m[1]]!=null)t=ES[m[1]]+m[2]}if(t==null)t=patTr(k);
  if(t!=null&&t!==k){if(!I18N.orig.has(n))I18N.orig.set(n,v);n.nodeValue=v.replace(k,t)}return}
 if(n.nodeType===1){if(n.closest&&n.closest(SKIP)&&!n.matches('input[placeholder],textarea[placeholder]'))return;for(const a of['title','placeholder','aria-label']){const v=n.getAttribute&&n.getAttribute(a);if(!v)continue;const t=ES[v.trim()]!=null?ES[v.trim()]:patTr(v.trim());if(t!=null){const o=I18N.attrs.get(n)||{};if(!(a in o))o[a]=v;I18N.attrs.set(n,o);n.setAttribute(a,t)}}}}
function trTree(root){if(!root)return;if(root.nodeType===3)return trNode(root);trNode(root);const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode()))trNode(n)}
let trQ=new Set(),trT=0;const mo=new MutationObserver(ms=>{if(!I18N.on)return;for(const m of ms){if(m.type==='characterData')trQ.add(m.target);else m.addedNodes.forEach(n=>trQ.add(n))}if(!trT)trT=requestAnimationFrame(()=>{trT=0;const q=[...trQ];trQ.clear();q.forEach(n=>n.isConnected&&trTree(n))})});
function applyLang(){const on=lang()==='es'&&Object.keys(ES).length>0;if(on===I18N.on&&!on)return;I18N.on=on;document.documentElement.lang=on?'es':'en';
 if(on){trTree(document.body);mo.observe(document.body,{childList:true,subtree:true,characterData:true})}
 else{mo.disconnect();const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode())){if(n.nodeType===3&&I18N.orig.has(n)){n.nodeValue=I18N.orig.get(n);I18N.orig.delete(n)}else if(n.nodeType===1&&I18N.attrs.has(n)){for(const[a,v]of Object.entries(I18N.attrs.get(n)))n.setAttribute(a,v);I18N.attrs.delete(n)}}}}
function setLang(l){const W=window.PMWorkspace;if(!W||!W.P)return;W.P.language=l;LS.set('pm:ws:prefs',W.P);hook('prefs')}
window.PMI18n={apply:applyLang,setLang,t:k=>I18N.on&&ES[k]!=null?ES[k]:k,get on(){return I18N.on},dict:ES};
H.ready.push(()=>setTimeout(applyLang,0));H.prefs=H.prefs||[];H.prefs.push(()=>setTimeout(applyLang,0));
// the Preferences dialog saves language through the workspace prefs; re-apply after it closes
addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('#modal'))setTimeout(applyLang,50)},true);

/* ================================================================== 11. WEB TAB */
const webCss=document.createElement('style');webCss.textContent=`#d3Web{display:none;flex-direction:column;flex:1;min-height:0;background:var(--panel)}body.d3web #d3Web{display:flex}body.d3web #splitBox{display:none!important}
#d3Web .wbar{display:flex;gap:4px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--line)}#d3Web .wbar input{flex:1;height:28px}#d3Web .wv{flex:1;min-height:0;border:0;width:100%;background:#fff}
#d3Web .wnote{padding:4px 10px;font-size:11.5px;color:var(--mut)}body.d3web #tabBar .dtab[data-tid].on{background:transparent;border-color:transparent;color:var(--mut)}#tabBar .d3wt{display:inline-flex;align-items:center;gap:6px;cursor:pointer}#tabBar .d3wt.on{background:var(--panel2);color:var(--text)}`;document.head.appendChild(webCss);
let webSeq=1;
function webBox(){let b=$('#d3Web');if(b)return b;const sb=$('#splitBox');if(!sb)return null;b=document.createElement('div');b.id='d3Web';sb.after(b);return b}
function renderWebTabs(){const bar=$('#tabBar');if(!bar)return;bar.querySelectorAll('.d3wt').forEach(e=>e.remove());const plus=bar.querySelector('.tplus');
 for(const w of D3.web){const d=document.createElement('div');d.className='dtab d3wt'+(D3.webOn===w.id?' on':'');d.dataset.wt=w.id;d.title=w.url;d.innerHTML=`<span>🌐</span><span class="wn" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.title||w.url||'Web')}</span><button class="cx" data-wclose="${w.id}" title="Close">✕</button>`;bar.insertBefore(d,plus)}}
function showWeb(id){const w=D3.web.find(x=>x.id===id);const box=webBox();if(!w||!box)return;D3.webOn=id;document.body.classList.add('d3web');
 box.querySelectorAll('.wv').forEach(v=>v.style.display=v.dataset.wt==id?'':'none');$('#d3Url').value=w.url||'';renderWebTabs()}
function hideWeb(){D3.webOn=null;document.body.classList.remove('d3web');renderWebTabs()}
function normUrl(u){u=(u||'').trim();if(!u)return'about:blank';if(/^(https?:|about:)/i.test(u))return u;if(/^(localhost|127\.\d+\.\d+\.\d+|\d+\.\d+\.\d+\.\d+)(:\d+)?(\/|$)/i.test(u))return'http://'+u;if(/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(u))return'https://'+u;return'https://www.google.com/search?q='+encodeURIComponent(u)}
function openWeb(url){attachTabBar();const box=webBox();if(!box)return toast('Web tabs need the document area');// <webview> needs the 1.2.4+ Windows app (webviewTag on); older installs fall back to an embedded frame
 const desktop=!!(window.pmDesktop&&pmDesktop.lockCheck);
 if(!box.querySelector('.wbar')){box.innerHTML=`<div class="wbar"><button class="btn" id="d3Wb" title="Back">←</button><button class="btn" id="d3Wf" title="Forward">→</button><button class="btn" id="d3Wr" title="Reload">⟳</button><input class="ti" id="d3Url" placeholder="Address or search"><button class="btn" id="d3Wx" title="Open in your browser">↗</button></div>${desktop?'':'<div class="wnote">Many websites refuse to be shown inside other apps; use ↗ to open those in your browser. In the Windows app every site works.</div>'}`;
  const cur=()=>box.querySelector(`.wv[data-wt="${D3.webOn}"]`);
  $('#d3Url').onkeydown=e=>{if(e.key==='Enter'){const w=D3.web.find(x=>x.id===D3.webOn);if(!w)return;w.url=normUrl(e.target.value);const v=cur();if(v){if(v.loadURL)try{v.loadURL(w.url)}catch(err){v.src=w.url}else v.src=w.url}w.title=w.url.replace(/^https?:\/\//,'').split('/')[0];renderWebTabs()}};
  $('#d3Wb').onclick=()=>{const v=cur();try{v.goBack?v.goBack():v.contentWindow.history.back()}catch(e){}};$('#d3Wf').onclick=()=>{const v=cur();try{v.goForward?v.goForward():v.contentWindow.history.forward()}catch(e){}};
  $('#d3Wr').onclick=()=>{const v=cur();try{v.reload?v.reload():(v.src=v.src)}catch(e){v.src=v.src}};$('#d3Wx').onclick=()=>{const w=D3.web.find(x=>x.id===D3.webOn);if(w&&/^https?:/.test(w.url))window.open(w.url,'_blank','noopener')}}
 const id=webSeq++,u=normUrl(url||DC.webHome||'about:blank'),w={id,url:u,title:u==='about:blank'?'New tab':u.replace(/^https?:\/\//,'').split('/')[0]};D3.web.push(w);
 let v;if(desktop){v=document.createElement('webview');v.setAttribute('partition','persist:webtab');v.setAttribute('allowpopups','');v.setAttribute('src',u);
  v.addEventListener('page-title-updated',e=>{w.title=e.title;renderWebTabs()});v.addEventListener('did-navigate',e=>{w.url=e.url;if(D3.webOn===id)$('#d3Url').value=e.url});v.addEventListener('did-navigate-in-page',e=>{if(e.isMainFrame){w.url=e.url;if(D3.webOn===id)$('#d3Url').value=e.url}})}
 else{v=document.createElement('iframe');v.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');v.setAttribute('referrerpolicy','no-referrer');v.src=u;v.onload=()=>{try{const t=v.contentDocument&&v.contentDocument.title;if(t){w.title=t;renderWebTabs()}}catch(e){}}}
 v.className='wv';v.dataset.wt=id;box.appendChild(v);showWeb(id);setTimeout(()=>{if(u==='about:blank')$('#d3Url').focus()},50);return w}
function closeWeb(id){const i=D3.web.findIndex(x=>x.id===id);if(i<0)return;D3.web.splice(i,1);const v=$(`#d3Web .wv[data-wt="${id}"]`);if(v)v.remove();if(D3.webOn===id){const n=D3.web[i]||D3.web[i-1];if(n)showWeb(n.id);else hideWeb()}else renderWebTabs()}
// tab bar: keep web tabs in it, switch between web and documents, and let go of file locks when a document tab closes
function attachTabBar(){const bar=$('#tabBar');if(!bar)return false;if(bar.__d3)return true;bar.__d3=1;
 new MutationObserver(()=>{if(D3.web.length&&!bar.querySelector('.d3wt'))renderWebTabs();setTimeout(releaseClosed,300)}).observe(bar,{childList:true});
 bar.addEventListener('click',e=>{const c=e.target.closest('[data-wclose]');if(c){e.stopPropagation();closeWeb(+c.dataset.wclose);return}const t=e.target.closest('.d3wt');if(t){e.stopPropagation();showWeb(+t.dataset.wt);return}
  if(e.target.closest('[data-tid]')&&D3.webOn)hideWeb()},true);return true}
setTimeout(attachTabBar,0);H.ready.push(()=>setTimeout(attachTabBar,0));H.open.push(attachTabBar);
(function retry(i){if(!attachTabBar()&&i<40)setTimeout(()=>retry(i+1),250)})(0);
H.open.push(()=>{if(D3.webOn)hideWeb()});
document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]')&&!(e.target.id==='d3Url'))return;const k=e.key.toLowerCase();
 if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&k==='t'){e.preventDefault();e.stopImmediatePropagation();openWeb()}
 else if(e.shiftKey&&e.altKey&&!e.ctrlKey&&e.code==='KeyR'){if(modalCb)return;e.preventDefault();e.stopImmediatePropagation();if(S.pages.length)setTool('review')}},true);

// icons for the new panels in the drafting layout's panel strip
const TAB_IC={cspell:'<path d="M4 15l3-9 3 9M5 12h4"/><path d="M13 13l3 3 5-7"/>',pkg:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'};
function tabIcons(){for(const[k,p]of Object.entries(TAB_IC)){const b=document.querySelector(`#left .tabs [data-tab="${k}"]`);if(!b)continue;if(b.parentElement&&b.parentElement.lastElementChild!==b&&!b.dataset.d3moved){b.dataset.d3moved=1;b.parentElement.appendChild(b)}if(!b.dataset.dl)continue;const sv=b.querySelector('svg');if(sv&&!sv.dataset.d3){sv.innerHTML=p;sv.dataset.d3=1}}}
H.ready.push(()=>{setTimeout(tabIcons,50);setTimeout(tabIcons,400)});
window.PMDocs3={DC,D3,saveDC,textIn,reviewDialog,reviewGeom,contentSpell,detectPackage,buildPackage,packageDialog,listRevs,addRev,revert,revertAs,restoreRev,docKey,lockFlow,setRo,repairBytes,batchRepair,loadFonts,buildPdfa,checkPdfa,pdfaDialog,emailDialog,sendEmail,tplDialog,resetHidden,applyLang,openWeb,closeWeb,showWeb,hideWeb,get SP(){return SP},get PK(){return PK}};
})();
