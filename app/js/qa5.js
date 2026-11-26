/* QA area 5 (documents & pages): small behaviour fixes so dialogs and pages act like Bluebeam. */
(function(){
// Esc closes the open dialog even when focus isn't inside it (e.g. right after choosing a menu item).
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const bg=document.querySelector('#modalBg');if(!bg||!bg.classList.contains('on'))return;const m=document.querySelector('#modal');if(m&&m.contains(e.target))return;
 e.preventDefault();e.stopImmediatePropagation();const i=typeof modalCb!=='undefined'&&modalCb?modalCb.findIndex(b=>b.cancel):-1;const btn=i>=0&&document.querySelector(`#modal [data-b="${i}"]`);if(btn)btn.click();else closeModal()},true);
})();
/* Thumbnails like Bluebeam: Ctrl/Shift-click to select several pages; right-click acts on the selection
   and offers the page tools (insert, insert blank, replace, crop, labels, headers/footers). */
(function(){
const sel=new Set();let anchor=0;
const thumbs=()=>[...document.querySelectorAll('#pane-pages .thumb')];
const paint=()=>thumbs().forEach(t=>t.classList.toggle('qa5Sel',sel.has(+t.dataset.p)));
const st=document.createElement('style');st.textContent='#pane-pages .thumb.qa5Sel{outline:2px solid var(--acc);outline-offset:1px;background:color-mix(in srgb,var(--acc) 14%,transparent)}';document.head.appendChild(st);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#pane-pages .thumb');if(!t)return;const n=+t.dataset.p;
 if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();if(!sel.size&&S.cur)sel.add(S.cur);sel.has(n)?sel.delete(n):sel.add(n);anchor=n;paint();return}
 if(e.shiftKey){e.preventDefault();e.stopImmediatePropagation();const a=anchor||S.cur||1;sel.clear();for(let i=Math.min(a,n);i<=Math.max(a,n);i++)sel.add(i);paint();return}
 sel.clear();anchor=n;paint()},true);
const pick=n=>sel.size>1&&sel.has(n)?[...sel].sort((a,b)=>a-b):[n];
const rng=l=>l.length===1?'page '+l[0]:l.length+' pages';
function delPages(l){modal(`Delete ${rng(l)}?`,'<div class="hint">Markups on '+(l.length>1?'these pages':'this page')+' are removed too.</div>',[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:()=>{sel.clear();PMBatch.deletePages(l)}}])}
function thumbMenu(x,y,n){const l=pick(n),W=PMWorkspace,D=window.PMDoc||{},go=f=>()=>{if(S.cur!==n)gotoPage(n,true);setTimeout(f,30)};
 const fit=it=>{try{return(window.PMQuick&&PMQuick.menu&&PMQuick.menu('thumb',it,{n,pages:l}))||it}catch(e){return it}};
 W.ctx(x,y,fit([{label:'Go to page '+n,run:()=>gotoPage(n)},'-',
  {label:'Insert pages…',run:()=>PMBatch.insertFrom(n)},{label:'Insert blank page…',run:go(()=>D.blankDialog())},{label:'Replace pages…',run:go(()=>D.replaceDialog())},
  {label:'Extract '+rng(l),run:()=>PMBatch.extract(l)},{label:'Delete '+rng(l)+'…',run:()=>delPages(l)},'-',
  {label:'Rotate ↻',run:()=>{sel.clear();PMBatch.rotatePages(l,90)}},{label:'Rotate ↺',run:()=>{sel.clear();PMBatch.rotatePages(l,-90)}},
  {label:'Move up',dis:n<=1||l.length>1,run:()=>W.movePageTo(n,n-1)},{label:'Move down',dis:n>=S.pages.length||l.length>1,run:()=>W.movePageTo(n,n+1)},{label:'Move to…',dis:l.length>1,run:()=>modalPrompt('Move page '+n,'New position (1–'+S.pages.length+')',String(n),v=>W.movePageTo(n,clamp(parseInt(v)||n,1,S.pages.length)))},'-',
  {label:'Crop pages…',run:go(()=>D.cropDialog())},{label:'Page labels…',run:()=>D.labelsDialog()},{label:'Headers, footers & Bates…',run:()=>D.hfDialog()},'-',
  {label:'Add bookmark',run:()=>{gotoPage(n,true);addBookmark()}},{label:'Select all pages',run:()=>{sel.clear();S.pages.forEach(p=>sel.add(p.num));paint()}}]))}
window.PMQA5=Object.assign(window.PMQA5||{},{thumbMenu,selPages:()=>[...sel]});
H.open.push(()=>{sel.clear();anchor=0});
})();
/* File menu like Bluebeam: Save As… (Ctrl+Shift+S) and an Export group (Word, Excel, images, XFDF). */
(function(){
let asName=null;const _sf=saveFile;saveFile=async function(name,data){if(asName&&/\.pdf$/i.test(name)){name=asName;asName=null}return _sf.apply(this,[name,data])};
function saveAs(){if(!S.bytes)return toast('Open a PDF first');modalPrompt('Save As','File name',(S.fileName||'document.pdf'),v=>{v=(v||'').trim().replace(/[\\/:*?"<>|]+/g,'-');if(!v)return;if(!/\.pdf$/i.test(v))v+='.pdf';asName=v;Promise.resolve(exportPDF(false)).finally(()=>{asName=null})})}
const need=f=>()=>S.pages.length?f():toast('Open a PDF first');const E=()=>window.PMPdfEdit||{};
function wordDialog(){modal('Export to Word',`<label class="chk"><input type="checkbox" id="dxI"> Also include an image of each page (with markups)</label>`,[{label:'Cancel',cancel:1},{label:'Export',pri:1,fn:md=>{const im=md.querySelector('#dxI').checked;setTimeout(()=>E().exportDocx({images:im}),0)}}])}
function imagesDialog(){const B=window.PMBatch2;if(B&&B.exportImagesDialog)return B.exportImagesDialog({pages:'all',rng:'',content:'both',dpi:150});toast('Not available')}
window.PM_EXTRA_CMDS_QA5=()=>[
 {id:'qa5:saveas',menu:'File',label:'Save As…',key:'Ctrl+Shift+S',run:need(saveAs)},
 {id:'qa5:xword',menu:'File',label:'Export ▸ Word (.docx)…',key:'',run:need(wordDialog)},
 {id:'qa5:xexcel',menu:'File',label:'Export ▸ Excel (text tables)',key:'',run:need(()=>E().exportXlsx())},
 {id:'qa5:ximg',menu:'File',label:'Export ▸ Images (PNG / JPEG / TIFF)…',key:'',run:need(imagesDialog)},
 {id:'qa5:xxfdf',menu:'File',label:'Export ▸ Markups as XFDF',key:'',run:need(()=>E().exportXfdf())},
 {id:'qa5:ixfdf',menu:'File',label:'Import ▸ Markups from XFDF…',key:'',run:need(()=>{const i=document.createElement('input');i.type='file';i.accept='.xfdf,.xml,application/xml';i.onchange=async()=>{const f=i.files[0];if(!f)return;try{E().importXfdfText(await f.text())}catch(e){toast(e.message||'Could not read that XFDF')}};i.click()})}];
window.PMQA5=Object.assign(window.PMQA5||{},{saveAs});
})();
/* Edit ▸ Replace text… (Ctrl+H) opens the page-content Search & Replace. */
window.PM_EXTRA_CMDS_QA5B=()=>[{id:'qa5:replace',menu:'Edit',label:'Replace text in the PDF…',key:'Ctrl+H',run:()=>S.pages.length?(window.PMPdfEdit&&PMPdfEdit.replaceDialog()):toast('Open a PDF first')}];
/* Ctrl+S / Ctrl+Shift+S also work while typing in a box (search, properties…), like Bluebeam.
   The box is blurred first so its value is committed before saving. */
window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.key.toLowerCase()!=='s')return;const t=e.target;if(!(t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"]')))return;if(t.closest('#modal'))return;
 e.preventDefault();e.stopImmediatePropagation();try{t.blur()}catch(_){}if(!S.bytes)return;setTimeout(()=>{if(e.shiftKey)PMQA5.saveAs();else exportPDF(false)},30)},true);
/* Saving a password-protected PDF keeps its protection (same passwords and permissions), like Bluebeam:
   qpdf copies the encryption of the file as it was opened. Explicit Security settings still win. */
(function(){
const encOf=new WeakMap();
H.open.push(info=>{const D=window.PMDoc;const e=D&&D.encrypted;if(S.pdf&&e&&!e.fallback&&e.raw&&e.name===S.fileName)encOf.set(S.pdf,{raw:e.raw,pw:e.pw||''})});
async function copyEnc(bytes,src){const q=await PMSecurity.getQpdf(),id=Math.random().toString(36).slice(2),a='/qa5a'+id+'.pdf',e='/qa5e'+id+'.pdf',o='/qa5o'+id+'.pdf';
 q.FS.writeFile(a,bytes);q.FS.writeFile(e,src.raw);let rc;try{rc=q.callMain(['--copy-encryption='+e,'--encryption-file-password='+src.pw,'--',a,o])}catch(x){rc=x&&x.status!=null?x.status:1}
 let r=null;try{r=q.FS.readFile(o)}catch(x){}for(const f of[a,e,o])try{q.FS.unlink(f)}catch(x){}if(!r||(rc!==0&&rc!==3))throw new Error('qpdf '+rc);return r}
const _sf=saveFile;saveFile=async function(name,data){const src=S.pdf&&encOf.get(S.pdf),B=window.PMBatch2&&PMBatch2.B2;
 if(src&&/-(markup|flattened)\.pdf$/i.test(name)&&!(B&&B.sec&&B.sec.get(S.pdf))&&window.PMSecurity&&PMSecurity.getQpdf){try{const u=data instanceof Blob?new Uint8Array(await data.arrayBuffer()):new Uint8Array(data);data=new Blob([await copyEnc(u,src)],{type:'application/pdf'})}catch(x){console.warn('keep encryption',x);toast("Couldn't re-apply the password to the saved copy")}}
 return _sf.apply(this,[name,data])};
})();
/* Home / End = first / last sheet, Page Up / Page Down = previous / next sheet (Bluebeam navigation keys),
   wherever focus is except text boxes and dialogs. */
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||!S.pages.length)return;const k=e.key;if(!['Home','End','PageUp','PageDown'].includes(k))return;
 const t=e.target;if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"],#modal'))return;const bg=document.querySelector('#modalBg');if(bg&&bg.classList.contains('on'))return;
 e.preventDefault();e.stopImmediatePropagation();const base=performance.now()-(window.__qa5nav||{t:0}).t<700?window.__qa5nav.n:S.cur;const n=k==='Home'?1:k==='End'?S.pages.length:clamp(base+(k==='PageDown'?1:-1),1,S.pages.length);window.__qa5nav={t:performance.now(),n};gotoPage(n,true)},true);
/* Paging fast through a big set: stop drawing sheets that have already scrolled out of view. */
{const _rv=renderVisible;renderVisible=function(){for(const p of S.pages)if(!p.vis&&p.task){try{p.task.cancel()}catch(e){}p.task=null}return _rv.apply(this,arguments)}}
/* Region pickers (crop, compare region, print region…) also take a drag, like Bluebeam:
   press at one corner, release at the other. Two clicks still work. */
(function(){let st=null;const hint=()=>((document.querySelector('#hint')||{}).textContent||'');
viewer.addEventListener('pointerdown',e=>{st=(e.isTrusted&&e.button===0&&/click the first corner/.test(hint()))?{x:e.clientX,y:e.clientY}:null},true);
window.addEventListener('pointerup',e=>{if(!st||!e.isTrusted)return;const s0=st;st=null;if(Math.hypot(e.clientX-s0.x,e.clientY-s0.y)<8||!/click the opposite corner/.test(hint()))return;
 const el=document.elementFromPoint(e.clientX,e.clientY);if(!el||!viewer.contains(el))return;const o={clientX:e.clientX,clientY:e.clientY,bubbles:true,cancelable:true,button:0,buttons:1,pointerId:e.pointerId,pointerType:e.pointerType||'mouse',isPrimary:true};
 setTimeout(()=>{el.dispatchEvent(new PointerEvent('pointerdown',o));el.dispatchEvent(new PointerEvent('pointerup',Object.assign({},o,{buttons:0})))},0)},true);
})();
/* Edit Text: the caret stays in the clicked text so you can type, like Bluebeam
   (the end of the click used to take focus back to the page). */
{const grab=()=>{const t=document.querySelector('#pePanel textarea#peT');const a=document.activeElement;if(t&&(!a||a===document.body||!(a.closest&&a.closest('#pePanel,input,textarea,select'))))try{t.focus()}catch(e){}};
 new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.id==='pePanel'){[0,80,200,400].forEach(d=>setTimeout(grab,d));return}}).observe(document.body,{childList:true});
 window.addEventListener('click',()=>{if(document.querySelector('#pePanel'))setTimeout(grab,0)},true);}
/* Tools menu: Edit Text (Ctrl+Shift+T) and Add Text (Ctrl+Shift+A, shown as its shortcut but never wired). */
window.PM_EXTRA_CMDS_QA5C=()=>[{id:'qa5:edittext',menu:'Tools',label:'Edit PDF text',key:'Ctrl+Shift+T',run:()=>S.pages.length?setTool('edittext'):toast('Open a PDF first')},
 {id:'qa5:addtext',menu:'Tools',label:'Add PDF text',key:'Ctrl+Shift+A',run:()=>S.pages.length?setTool('addtext'):toast('Open a PDF first')}];
