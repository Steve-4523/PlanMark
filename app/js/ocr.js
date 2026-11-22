/* PlanMark — OCR (tesseract.js, fully offline: lib/tesseract) */
(function(){
S.ocr={};let worker=null,cancel=false;
const abs=p=>new URL(p,location.href).href;
function loadScript(src){return new Promise((res,rej)=>{if(window.Tesseract)return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load OCR engine'));document.head.appendChild(s)})}
let progressCb=null;
function loadJs(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
// Language data: served as a .gz file in the desktop app; on the web it ships as a JS file and is handed to the OCR worker through its IndexedDB cache
async function langMode(){try{const r=await fetch(abs('lib/tesseract/eng.traineddata.gz'),{method:'HEAD'});if(r.ok)return'file'}catch(e){}
 if(!window.PM_ENG_GZ)await loadJs('lib/tesseract/eng-data.js');const bin=atob(window.PM_ENG_GZ),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
 await new Promise((res,rej)=>{const rq=indexedDB.open('keyval-store');rq.onupgradeneeded=()=>rq.result.createObjectStore('keyval');rq.onerror=()=>rej(rq.error);
  rq.onsuccess=()=>{const db=rq.result,t=db.transaction('keyval','readwrite');t.objectStore('keyval').put(u,'./eng.traineddata');t.oncomplete=()=>{db.close();res()};t.onerror=()=>rej(t.error)}});return'cache'}
async function getWorker(){if(worker)return worker;await loadScript('lib/tesseract/tesseract.min.js');const mode=await langMode();
 worker=await Tesseract.createWorker('eng',1,{workerPath:abs('lib/tesseract/worker.min.js'),corePath:abs('lib/tesseract'),langPath:abs('lib/tesseract'),workerBlobURL:false,cacheMethod:mode==='file'?'none':'readOnly',gzip:true,
  logger:m=>{if(progressCb&&m.status==='recognizing text')progressCb(m.progress)}});
 try{await worker.setParameters({tessedit_pageseg_mode:'12',preserve_interword_spaces:'1'})}catch(e){}return worker}
async function hasText(n){const pg=await S.pdf.getPage(n);const tc=await pg.getTextContent();return tc.items.filter(i=>i.str&&i.str.trim()).length>8}
async function ocrPage(n){const w=await getWorker(),p=S.pages[n-1],pg=await S.pdf.getPage(n);
 const s=Math.min(300/72,Math.sqrt(22e6/(p.w*p.h)));const vp=pg.getViewport({scale:s});const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
 const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;
 const{data}=await w.recognize(c,{},{text:true,blocks:true});const words=[];
 const walk=o=>{if(!o)return;if(Array.isArray(o)){o.forEach(walk);return}if(o.words){for(const wd of o.words)addW(wd)}else for(const k of['blocks','paragraphs','lines'])if(o[k])walk(o[k])};
 const addW=wd=>{if(!wd.text||!wd.text.trim()||wd.confidence<35)return;const b=wd.bbox,vx0=b.x0/s,vy0=b.y0/s,vx1=b.x1/s,vy1=b.y1/s;const[px,py]=p.vp.convertToPdfPoint(vx0,vy1);
  words.push({str:wd.text.trim(),x:px,y:py,w:vx1-vx0,h:vy1-vy0,rot:false,ocr:1,vb:[vx0,vy0,vx1,vy1]})};
 if(data.words&&data.words.length)data.words.forEach(addW);else walk(data.blocks);
 S.ocr[n]=words;delete S.textCache[n];return words.length}
async function run(pages,skipText){cancel=false;let done=0,total=0;
 modal('OCR in progress',`<div class="hint" id="ocrMsg">Starting OCR engine…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="ocrBar" style="height:100%;width:0;background:var(--acc)"></div></div>`,[{label:'Cancel',cancel:1,fn:()=>{cancel=true}}]);
 const msg=t=>{const e=$('#ocrMsg');if(e)e.textContent=t},bar=f=>{const e=$('#ocrBar');if(e)e.style.width=Math.round(f*100)+'%'};
 try{for(let i=0;i<pages.length;i++){if(cancel)break;const n=pages[i];
   if(skipText&&await hasText(n)){msg(`Page ${n} already has text — skipped`);continue}
   msg(`Recognizing page ${n} (${i+1} of ${pages.length})…`);progressCb=f=>bar((i+f)/pages.length);
   const c=await ocrPage(n);total+=c;done++;bar((i+1)/pages.length)}
  closeModal();toast(cancel?'OCR cancelled':`OCR done: ${total} words on ${done} page${done===1?'':'s'} — now searchable, and saved PDFs include the text`);
  S.ocrDirty=true}
 catch(e){console.error(e);closeModal();toast('OCR failed: '+(e.message||e))}finally{progressCb=null}}
function dialog(){if(!S.pages.length){toast('Open a PDF first');return}
 modal('OCR — make scanned drawings searchable',`<div class="fld"><label>Pages</label><select class="ti" id="ocP"><option value="cur">Current page (${S.cur})</option><option value="all">All pages (${S.pages.length})</option><option value="rng">Range…</option></select></div>
 <div class="fld" id="ocRw" style="display:none"><label>Range (e.g. 1-3, 7)</label><input class="ti" id="ocR" placeholder="1-${S.pages.length}"></div>
 <label class="chk fld"><input type="checkbox" id="ocS" checked> Skip pages that already contain text</label>
 <div class="hint">Recognized text becomes searchable here and is embedded (invisibly) when you save the PDF. Runs on this device — nothing is uploaded.</div>`,
 [{label:'Cancel',cancel:1},{label:'Run OCR',pri:1,fn:md=>{const v=md.querySelector('#ocP').value,skip=md.querySelector('#ocS').checked;let pages=v==='cur'?[S.cur]:v==='all'?S.pages.map(p=>p.num):parseRange(md.querySelector('#ocR').value);
  if(!pages.length){toast('Enter a page range');return false}setTimeout(()=>run(pages,skip),0)}}]);
 $('#ocP').onchange=e=>{$('#ocRw').style.display=e.target.value==='rng'?'block':'none'}}
function parseRange(t){const out=new Set();for(const part of String(t).split(',')){const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)continue;let a=+m[1],b=+(m[2]||m[1]);if(a>b)[a,b]=[b,a];for(let i=a;i<=b;i++)if(i>=1&&i<=S.pages.length)out.add(i)}return[...out].sort((a,b)=>a-b)}
window.parseRange=parseRange;
H.exportPage.push(async(doc,pages,font)=>{for(const k in S.ocr){const n=+k,page=pages[n-1],p=S.pages[n-1];if(!page||!p)continue;
 for(const w of S.ocr[n]){const str=safeTxt(w.str);if(!str)continue;const wd=font.widthOfTextAtSize(str,1);if(!wd)continue;const size=Math.max(1,Math.min(w.h*1.15,w.w/wd));
  try{page.drawText(str,{x:w.x,y:w.y+w.h*0.15,size,font,opacity:0,rotate:PDFLib.degrees(p.vp.rotation||0)})}catch(e){}}}});
H.open.push(()=>{S.ocr={}});
H.ribbon.push({label:'OCR',title:'Recognize text in scanned pages',icon:'<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>',fn:dialog});
window.PMOCR={run,dialog,ocrPage};
})();
