/* PlanMark — page tools and batch processing */
(function(){
const ICO='<rect x="3" y="7" width="12" height="14" rx="1"/><path d="M7 7V4h11a1 1 0 011 1v12h-4"/><path d="M6 12h6M6 16h4"/>';
const readFile=f=>f.arrayBuffer().then(b=>new Uint8Array(b));
function pickFiles(multiple){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='application/pdf,.pdf';i.multiple=!!multiple;i.onchange=()=>res([...i.files]);i.click()})}
/* Rebuild the open document with pdf-lib, keeping markups attached to their pages */
async function rebuild(op,label){if(!S.bytes)return;toast(label+'…');
 try{const keep=S.markups.map(m=>{const vp=S.pages[m.page-1].vp;return{m,pdf:m.pts.map(q=>vp.convertToPdfPoint(q[0],q[1]))}});
  const oldScales=S.scales;const doc=await PDFLib.PDFDocument.load(S.bytes,{ignoreEncryption:true});
  const map=await op(doc);if(!map)return;const bytes=new Uint8Array(await doc.save());
  const scales={};if(oldScales.all)scales.all=oldScales.all;for(const k in oldScales){if(k==='all')continue;const ni=map[+k-1];if(ni>=0)scales[ni+1]=oldScales[k]}
  const cur=S.cur;await openBytes(bytes,S.fileName,{markups:[],scales});
  const ms=[];for(const{m,pdf}of keep){const ni=map[m.page-1];if(ni==null||ni<0)continue;const p=S.pages[ni];if(!p)continue;m.page=ni+1;m.pts=pdf.map(([x,y])=>p.vp.convertToViewportPoint(x,y));ms.push(m)}
  S.markups=ms;commit();gotoPage(Math.min(map[cur-1]>=0?map[cur-1]+1:cur,S.pages.length),true);toast(label+' — done')}
 catch(e){console.error(e);toast(label+' failed: '+(e.message||e))}}
const ident=n=>Array.from({length:n},(_,i)=>i);
function rotatePages(pages,deg){return PMBatch.rebuild(doc=>{for(const n of pages){const pg=doc.getPage(n-1);pg.setRotation(PDFLib.degrees(((pg.getRotation().angle||0)+deg+360)%360))}return ident(doc.getPageCount())},'Rotating')}
function deletePages(pages){if(pages.length>=S.pages.length){toast("Can't delete every page");return}
 return PMBatch.rebuild(doc=>{const n=doc.getPageCount(),del=new Set(pages.map(x=>x-1));[...del].sort((a,b)=>b-a).forEach(i=>doc.removePage(i));let k=0;return ident(n).map(i=>del.has(i)?-1:k++)},'Deleting pages')}
function movePage(n,dir){const to=n-1+dir;if(to<0||to>=S.pages.length)return;
 return PMBatch.rebuild(doc=>{const cnt=doc.getPageCount(),pg=doc.getPage(n-1);doc.removePage(n-1);doc.insertPage(to,pg);const order=ident(cnt);order.splice(n-1,1);order.splice(to,0,n-1);const map=new Array(cnt);order.forEach((old,ni)=>map[old]=ni);return map},'Moving page')}
async function insertFrom(after){const[f]=await pickFiles(false);if(!f)return;const src=await readFile(f);
 return PMBatch.rebuild(async doc=>{const other=await PDFLib.PDFDocument.load(src,{ignoreEncryption:true}),cnt=doc.getPageCount(),cp=await doc.copyPages(other,other.getPageIndices());cp.forEach((pg,i)=>doc.insertPage(after+i,pg));return ident(cnt).map(i=>i<after?i:i+cp.length)},'Inserting pages')}
async function extract(pages){if(!pages.length)return;const src=await PDFLib.PDFDocument.load(S.bytes,{ignoreEncryption:true}),out=await PDFLib.PDFDocument.create();
 (await out.copyPages(src,pages.map(n=>n-1))).forEach(p=>out.addPage(p));await saveFile(baseName()+`-pages-${pages.length===1?pages[0]:pages[0]+'-'+pages[pages.length-1]}.pdf`,new Blob([await out.save()],{type:'application/pdf'}))}
async function combine(files,includeCurrent){const out=await PDFLib.PDFDocument.create();let n=0;
 const add=async bytes=>{const d=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true});(await out.copyPages(d,d.getPageIndices())).forEach(p=>{out.addPage(p);n++})};
 if(includeCurrent&&S.bytes)await add(S.bytes);for(const f of files)await add(await readFile(f));
 await openBytes(new Uint8Array(await out.save()),'Combined.pdf');toast(`Combined ${n} pages — use Save to keep it`)}
async function split(every){const src=await PDFLib.PDFDocument.load(S.bytes,{ignoreEncryption:true}),cnt=src.getPageCount(),zip=new JSZip();
 for(let i=0;i<cnt;i+=every){const out=await PDFLib.PDFDocument.create(),idx=ident(Math.min(every,cnt-i)).map(k=>i+k);(await out.copyPages(src,idx)).forEach(p=>out.addPage(p));
  zip.file(`${baseName()}-${every===1?'p'+(i+1):'p'+(i+1)+'-'+(idx[idx.length-1]+1)}.pdf`,await out.save())}
 await saveFile(baseName()+'-split.zip',await zip.generateAsync({type:'blob'}))}
function batchStamp(text,pos,pages,color){pushUndo();const ids=[];for(const n of pages){const p=S.pages[n-1],st=Object.assign({},S.defaults.stamp,{stroke:color});
  const m=newMarkup('stamp',n,[[0,0]],st);m.text=text;const g=stampGeom(m),w=g.b[2]-g.b[0],h=g.b[3]-g.b[1],ins=36;
  const x=pos.includes('l')?ins+w/2:pos.includes('r')?p.w-ins-w/2:p.w/2,y=pos.includes('t')?ins+h/2:pos.includes('b')?p.h-ins-h/2:p.h/2;m.pts=[[x,y]];S.markups.push(m);ids.push(m.id)}
 commit();toast(`Stamped ${ids.length} page${ids.length===1?'':'s'}`)}
function rangeOrAll(v,txt){return v==='all'?S.pages.map(p=>p.num):v==='cur'?[S.cur]:parseRange(txt)}
const rangeFld=(id)=>`<div class="fld"><label>Pages</label><select class="ti" id="${id}"><option value="cur">Current page (${S.cur})</option><option value="all">All pages</option><option value="rng">Range…</option></select><input class="ti" id="${id}R" placeholder="e.g. 1-3, 7" style="margin-top:6px;display:none"></div>`;
const wireRange=id=>{$('#'+id).onchange=e=>{$('#'+id+'R').style.display=e.target.value==='rng'?'block':'none'}};
const getRange=(md,id)=>rangeOrAll(md.querySelector('#'+id).value,md.querySelector('#'+id+'R').value);
function batchDialog(){
 const need=!S.pages.length;const b=(id,t,d,dis)=>`<button class="btn" id="${id}" style="border:1px solid var(--line);justify-content:flex-start;height:auto;padding:8px 10px;flex-direction:column;align-items:flex-start;white-space:normal;text-align:left" ${dis?'disabled':''}><b>${t}</b><small style="color:var(--mut)">${d}</small></button>`;
 modal('Batch & page tools',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
 ${b('bxCombine','Combine PDFs','Merge several files into one set')}${b('bxSplit','Split document','One PDF per page or per N pages (zip)',need)}
 ${b('bxStamp','Batch stamp','Stamp many pages at once',need)}${b('bxOcr','Batch OCR','OCR every page without text',need)}
 ${b('bxRot','Rotate pages','Rotate a range 90°',need)}${b('bxDel','Delete pages','Remove a range of pages',need)}
 ${b('bxExt','Extract pages','Save a range as a new PDF',need)}${b('bxIns','Insert pages','Insert another PDF after a page',need)}</div>`,[{label:'Close',cancel:1}]);
 $('#bxCombine').onclick=()=>{modal('Combine PDFs',`<div class="fld"><label>Files to add (in order)</label><input type="file" class="ti" id="cbF" multiple accept="application/pdf,.pdf"></div>${S.bytes?'<label class="chk"><input type="checkbox" id="cbC" checked> Start with the open document</label>':''}`,
  [{label:'Cancel',cancel:1},{label:'Combine',pri:1,fn:md=>{const fs=[...md.querySelector('#cbF').files];const inc=md.querySelector('#cbC')?.checked;if(!fs.length){toast('Choose files');return false}combine(fs,inc).catch(e=>toast('Combine failed: '+e.message))}}])};
 if(need)return;
 $('#bxSplit').onclick=()=>{modal('Split document',`<div class="fld"><label>Pages per file</label><input class="ti" type="number" id="spN" min="1" value="1"></div><div class="hint">Saves a .zip of the parts. Markups are not included (save the marked-up PDF first if you need them).</div>`,
  [{label:'Cancel',cancel:1},{label:'Split',pri:1,fn:md=>{split(Math.max(1,+md.querySelector('#spN').value||1)).catch(e=>toast('Split failed: '+e.message))}}])};
 $('#bxStamp').onclick=()=>{modal('Batch stamp',`<div class="fld"><label>Stamp</label><select class="ti" id="bsT">${STAMPS.map(s=>`<option>${esc(s)}</option>`).join('')}<option value="__c">Custom…</option></select><input class="ti" id="bsC" placeholder="Custom text" style="margin-top:6px;display:none"></div>
  <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Position</label><select class="ti" id="bsP"><option value="tr">Top right</option><option value="tl">Top left</option><option value="br">Bottom right</option><option value="bl">Bottom left</option><option value="c">Center</option></select></div><div><label style="font-size:11px;color:var(--mut)">Color</label><input type="color" id="bsK" value="#c62828"></div></div>${rangeFld('bsR')}`,
  [{label:'Cancel',cancel:1},{label:'Stamp',pri:1,fn:md=>{let t=md.querySelector('#bsT').value;if(t==='__c')t=md.querySelector('#bsC').value.trim().toUpperCase();const pg=getRange(md,'bsR');if(!t||!pg.length){toast('Pick a stamp and pages');return false}batchStamp(t,md.querySelector('#bsP').value,pg,md.querySelector('#bsK').value)}}]);
  wireRange('bsR');$('#bsT').onchange=e=>{$('#bsC').style.display=e.target.value==='__c'?'block':'none'}};
 $('#bxOcr').onclick=()=>{closeModal();PMOCR.run(S.pages.map(p=>p.num),true)};
 $('#bxRot').onclick=()=>{modal('Rotate pages',`${rangeFld('roR')}<div class="fld"><label>Direction</label><select class="ti" id="roD"><option value="90">Clockwise 90°</option><option value="-90">Counter-clockwise 90°</option><option value="180">180°</option></select></div>`,
  [{label:'Cancel',cancel:1},{label:'Rotate',pri:1,fn:md=>{const pg=getRange(md,'roR');if(!pg.length)return false;rotatePages(pg,+md.querySelector('#roD').value)}}]);wireRange('roR')};
 $('#bxDel').onclick=()=>{modal('Delete pages',`${rangeFld('dlR')}<div class="hint">Markups on deleted pages are removed. Ctrl+Z won't bring pages back — save first if unsure.</div>`,
  [{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:md=>{const pg=getRange(md,'dlR');if(!pg.length)return false;deletePages(pg)}}]);wireRange('dlR')};
 $('#bxExt').onclick=()=>{modal('Extract pages',rangeFld('exR'),[{label:'Cancel',cancel:1},{label:'Extract',pri:1,fn:md=>{const pg=getRange(md,'exR');if(!pg.length)return false;extract(pg)}}]);wireRange('exR')};
 $('#bxIns').onclick=()=>{modal('Insert pages',`<div class="fld"><label>Insert after page (0 = at the start)</label><input class="ti" type="number" id="inA" min="0" max="${S.pages.length}" value="${S.cur}"></div>`,
  [{label:'Cancel',cancel:1},{label:'Choose PDF…',pri:1,fn:md=>{insertFrom(clamp(+md.querySelector('#inA').value||0,0,S.pages.length))}}])};
}
H.ribbon.push({label:'Batch',title:'Combine, split, stamp, OCR and page tools',icon:ICO,fn:batchDialog});
// page toolbar in the Pages panel
function pageBar(){const pane=$('#pane-pages');if(!pane||!S.pages.length||$('#pgBar'))return;const d=document.createElement('div');d.id='pgBar';
 d.style.cssText='display:flex;flex-wrap:wrap;gap:2px;margin:-2px 0 10px;position:sticky;top:-8px;background:var(--panel);padding:4px 0;z-index:2';
 const bt=(a,t,l)=>`<button class="btn" data-pa="${a}" title="${t}" style="padding:0 6px;height:26px;border:1px solid var(--line)">${l}</button>`;
 d.innerHTML=bt('rl','Rotate current page left','⟲')+bt('rr','Rotate current page right','⟳')+bt('up','Move page up','↑')+bt('dn','Move page down','↓')+bt('ins','Insert pages after current','+ Ins')+bt('ext','Extract current page','Ext')+bt('del','Delete current page','Del');
 d.onclick=e=>{const a=e.target.closest('[data-pa]')?.dataset.pa;if(!a)return;const n=S.cur;
  if(a==='rl')rotatePages([n],-90);if(a==='rr')rotatePages([n],90);if(a==='up')movePage(n,-1);if(a==='dn')movePage(n,1);if(a==='ins')insertFrom(n);if(a==='ext')extract([n]);
  if(a==='del')modal('Delete page '+n+'?',`<div class="hint">Markups on this page will be removed too.</div>`,[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:()=>{deletePages([n])}}])};
 pane.prepend(d)}
const _bt=buildThumbs;buildThumbs=async function(){const r=_bt.apply(this,arguments);setTimeout(pageBar,0);return r};
window.PMBatch={rebuild,rotatePages,deletePages,extract,combine,split,batchStamp};
})();
