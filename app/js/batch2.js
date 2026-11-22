/* PlanMark — batch2.js: multi-file batch processing, compare/overlay depth, printing depth,
   Sets depth (tags, revisions, search, print), digital signatures (PKCS#7) and PDF encryption.
   Libraries (lazy-loaded from lib/batch2/): node-forge 1.4.3 (BSD-3-Clause / GPL-2.0, dual — used under BSD),
   qpdf compiled to WebAssembly (@neslinesli93/qpdf-wasm 0.3.1, ISC; qpdf itself Apache-2.0). */
(function(){
const B2={raw:new WeakMap(),sec:new WeakMap()};
const abs=p=>new URL(p,location.href).href;
const enc=new TextEncoder();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tickb=()=>new Promise(r=>setTimeout(r,0));
window.PM_EXTRA_SYNC_KEYS_B2=['pm:b2:print','pm:b2:batch','pm:b2:cmp','pm:b2:setview','pm:b2:sign','pm:b2:tagregions','pm:trusted'];
/* ---------- library loaders ---------- */
function loadJs(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
async function getForge(){if(!window.forge)await loadJs('lib/batch2/forge.min.js');return window.forge}
let qp=null;async function getQpdf(){if(qp)return qp;if(!window.PMQpdfModule)await loadJs('lib/batch2/qpdf.js');qp=await window.PMQpdfModule({locateFile:()=>abs('lib/batch2/qpdf.wasm'),print:()=>{},printErr:()=>{}});return qp}
/* ---------- small helpers ---------- */
function bin(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return s}
function unbin(s){const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u}
function cat(parts){let n=0;for(const p of parts)n+=p.length;const o=new Uint8Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length}return o}
const toU8=async d=>d instanceof Uint8Array?d:d instanceof Blob?new Uint8Array(await d.arrayBuffer()):d instanceof ArrayBuffer?new Uint8Array(d):enc.encode(String(d));
function pickFiles(accept,multiple){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept||'application/pdf,.pdf';i.multiple=!!multiple;i.onchange=()=>res([...i.files]);i.click()})}
const stem=n=>String(n||'document').replace(/\.[a-z0-9]+$/i,'');
const inch=v=>(+v||0)*72;
function progress(title){let cancel=false;modal(title,`<div class="hint" id="b2Msg">Starting…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="b2Bar" style="height:100%;width:0;background:var(--acc)"></div></div><div class="hint" id="b2Log" style="max-height:160px;overflow:auto;margin-top:8px;font-size:11px"></div>`,[{label:'Cancel',cancel:1,fn:()=>{cancel=true}}]);
 return{get cancelled(){return cancel},msg(t){const e=$('#b2Msg');if(e)e.textContent=t},bar(f){const e=$('#b2Bar');if(e)e.style.width=Math.round(clamp(f,0,1)*100)+'%'},log(t){const e=$('#b2Log');if(e){e.insertAdjacentHTML('beforeend',`<div>${esc(t)}</div>`);e.scrollTop=1e9}},done(){if($('#b2Msg'))closeModal()}}}
/* deliver outputs: one file → save it; several → zip (or a folder on the desktop app when available) */
async function deliver(files,zipName){if(!files.length){toast('Nothing was produced');return}
 const dv=window.pmDesktop;if(files.length>1&&dv&&dv.chooseFolder&&dv.writeFiles){try{const dir=await dv.chooseFolder();if(dir){await dv.writeFiles(dir,files.map(f=>({name:f.name,bytes:f.bytes})));toast(`Saved ${files.length} files`);return}}catch(e){console.warn(e)}}
 if(files.length===1)return saveFile(files[0].name,new Blob([files[0].bytes],{type:/\.pdf$/i.test(files[0].name)?'application/pdf':'application/octet-stream'}));
 const z=new JSZip(),used=new Set();for(const f of files){let n=f.name,i=2;while(used.has(n))n=stem(f.name)+` (${i++})`+(f.name.match(/\.[a-z0-9]+$/i)||[''])[0];used.add(n);z.file(n,f.bytes)}
 await saveFile(zipName,await z.generateAsync({type:'blob'}))}
/* ---------- geometry: viewed (rotated) page coordinates ↔ PDF user space ---------- */
function boxOf(page){const b=page.getCropBox?page.getCropBox():page.getMediaBox();return[b.x,b.y,b.x+b.width,b.y+b.height]}
function rotOf(page){return(((page.getRotation().angle||0)%360)+360)%360}
function viewSize(page){const[x0,y0,x1,y1]=boxOf(page),r=rotOf(page);return r%180?[y1-y0,x1-x0]:[x1-x0,y1-y0]}
function v2p(page,vx,vy){const[x0,y0,x1,y1]=boxOf(page),r=rotOf(page);
 if(r===90)return[vy+x0,vx+y0];if(r===180)return[x1-vx,vy+y0];if(r===270)return[x1-vy,y1-vx];return[vx+x0,y1-vy]}
/* draw text in viewed orientation: (vx,vy) = baseline start, ang = clockwise degrees in view */
function vText(page,str,vx,vy,o){const r=rotOf(page),[px,py]=v2p(page,vx,vy);page.drawText(safeTxt(str),Object.assign({x:px,y:py,rotate:PDFLib.degrees(r-(o.ang||0))},o,{ang:undefined}))}
function vRect(page,vx,vy,w,h,o){const c=[[vx,vy+h],[vx+w,vy+h],[vx+w,vy],[vx,vy]].map(q=>v2p(page,q[0],q[1]));const d='M'+c.map(q=>q[0]+' '+(-q[1])).join(' L')+' Z';page.drawSvgPath(d,Object.assign({x:0,y:0},o))}
/* place an embedded page (content box cw×ch, rotation rot) so its viewed top-left is at (dx,dy) from the sheet's top-left, scaled sx */
function place(sheet,emb,rot,cw,ch,sx,dx,dy,extra){const ph=sheet.getHeight(),W=cw*sx,Hh=ch*sx;let x=dx,y=ph-dy-Hh;
 if(rot===90){x=dx;y=ph-dy}else if(rot===180){x=dx+W;y=ph-dy}else if(rot===270){x=dx+W;y=ph-dy-Hh}
 sheet.drawPage(emb,Object.assign({x,y,xScale:sx,yScale:sx,rotate:PDFLib.degrees(-rot)},extra||{}))}
/* ---------- reading PlanMark data from any PDF ---------- */
async function pdfjsOpen(bytes,password){return pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false,password}).promise}
async function readPM(bytes,name){let orig=bytes,markups=null,scales={},embedded=false;
 try{const d=await pdfjsOpen(bytes);const att=await d.getAttachments();if(att){const v=Object.values(att),o=v.find(a=>/planmark-original\.pdf$/.test(a.filename)),j=v.find(a=>/planmark-markups\.json$/.test(a.filename));
  if(o&&j){orig=new Uint8Array(o.content);const J=JSON.parse(new TextDecoder().decode(j.content));markups=J.markups||[];scales=J.scales||{};embedded=true}}d.destroy()}catch(e){}
 if(!markups){const st=LS.get('pm:doc:'+name+':'+bytes.length,null);if(st){markups=st.markups||[];scales=st.scales||{}}}
 return{orig,markups:markups||[],scales,embedded}}
async function viewportsOf(bytes){const d=await pdfjsOpen(bytes),v=[];for(let i=1;i<=d.numPages;i++)v.push((await d.getPage(i)).getViewport({scale:1}));d.destroy();return v}
/* draw markups onto a pdf-lib document (same drawing rules as Save) — prims are computed with this file's scales */
async function drawMarkups(doc,vps,markups,scales,opt={}){if(!markups.length)return;const{StandardFonts,degrees,BlendMode,LineCapStyle,pushGraphicsState,popGraphicsState}=PDFLib;
 const keep=S.scales;let list=[];try{S.scales=scales||{};for(const m of markups){if(m.hidden||(!opt.links&&m.type==='hlink'))continue;if(opt.pages&&!opt.pages.has(m.page))continue;let ps=[];try{ps=prims(m)}catch(e){}list.push({m,ps})}}finally{S.scales=keep}
 const FC={},FM={Helvetica:['Helvetica','HelveticaBold','HelveticaOblique','HelveticaBoldOblique'],Times:['TimesRoman','TimesRomanBold','TimesRomanItalic','TimesRomanBoldItalic'],Courier:['Courier','CourierBold','CourierOblique','CourierBoldOblique']};
 const fontFor=async p=>{const f=FM[p.font]||FM.Helvetica,k=f[(p.bold?1:0)+(p.italic?2:0)];return FC[k]||(FC[k]=await doc.embedFont(StandardFonts[k]))};const IC={},pages=doc.getPages(),wrapped=new Set();
 for(const{m,ps}of list){const page=pages[m.page-1],vp=vps[m.page-1];if(!page||!vp)continue;
  if(!wrapped.has(m.page)){wrapped.add(m.page);try{const c=doc.context;page.node.wrapContentStreams(c.register(c.contentStream([pushGraphicsState()])),c.register(c.contentStream([popGraphicsState()])))}catch(e){}}
  for(const p of ps){try{
   if(p.k==='p'){const o={x:0,y:0,borderLineCap:LineCapStyle.Round};if(p.stroke&&p.w>0){o.borderColor=hexRgb(p.stroke);o.borderWidth=p.w;o.borderOpacity=p.so;const da=p.dash&&dashArr(p);if(da)o.borderDashArray=da}else o.borderWidth=0;
    if(p.fill){o.color=hexRgb(p.fill);o.opacity=p.fo*p.so}else o.color=undefined;if(p.blend)o.blendMode=BlendMode.Multiply;if(!p.fill&&!(p.stroke&&p.w>0))continue;page.drawSvgPath(xfPath(p.d,vp),o)}
   else if(p.k==='img'){if(!p.src)continue;let im=IC[p.src];if(!im){const b=Uint8Array.from(atob(p.src.split(',')[1]),c=>c.charCodeAt(0));im=IC[p.src]=/^data:image\/png/.test(p.src)?await doc.embedPng(b):await doc.embedJpg(b)}
    const c=[[p.b[0],p.b[3]],[p.b[2],p.b[3]],[p.b[0],p.b[1]]].map(q=>vp.convertToPdfPoint(q[0],q[1]));page.drawImage(im,{x:c[0][0],y:c[0][1],width:Math.hypot(c[1][0]-c[0][0],c[1][1]-c[0][1]),height:Math.hypot(c[2][0]-c[0][0],c[2][1]-c[0][1]),rotate:degrees(vp.rotation||0),opacity:p.o})}
   else if(p.k==='t'){const f=await fontFor(p),str=safeTxt(p.s);if(!str.trim())continue;const w=f.widthOfTextAtSize(str,p.size),a=(p.ang||0)*Math.PI/180,dir=[Math.cos(a),Math.sin(a)],dn=[-Math.sin(a),Math.cos(a)];let x=p.x,y=p.y;if(p.align==='middle'){x-=dir[0]*w/2;y-=dir[1]*w/2}
    if(p.halo){const pad=p.size*.18,c=[[x-dir[0]*pad-dn[0]*p.size*.6,y-dir[1]*pad-dn[1]*p.size*.6]];c.push([c[0][0]+dir[0]*(w+2*pad),c[0][1]+dir[1]*(w+2*pad)]);c.push([c[1][0]+dn[0]*p.size*1.2,c[1][1]+dn[1]*p.size*1.2]);c.push([c[0][0]+dn[0]*p.size*1.2,c[0][1]+dn[1]*p.size*1.2]);page.drawSvgPath(xfPath(dPoly(c,true),vp),{x:0,y:0,color:PDFLib.rgb(1,1,1),opacity:.8*p.o,borderWidth:0})}
    x+=dn[0]*p.size*.35;y+=dn[1]*p.size*.35;const[px,py]=vp.convertToPdfPoint(x,y);page.drawText(str,{x:px,y:py,size:p.size,font:f,color:hexRgb(p.color),opacity:p.o,rotate:degrees((vp.rotation||0)-(p.ang||0))})}
  }catch(e){console.warn('b2 prim',e)}}
  if(opt.popups&&m.type==='note'&&m.comment){try{const f=await fontFor({}),lines=String(m.comment).split('\n').flatMap(l=>wrap(l,170,8)).slice(0,12),[x,y]=m.pts[0],b=[x+22,y,x+200,y+10+lines.length*10];
   page.drawSvgPath(xfPath(dBox(b),vp),{x:0,y:0,color:PDFLib.rgb(1,1,.85),borderColor:PDFLib.rgb(.6,.5,.1),borderWidth:.6});lines.forEach((l,i)=>{const[px,py]=vp.convertToPdfPoint(b[0]+4,b[1]+12+i*10);page.drawText(safeTxt(l),{x:px,y:py,size:8,font:f,rotate:degrees(vp.rotation||0)})})}catch(e){}}}}
async function flattenBytes(bytes,markups,scales,opt){const vps=await viewportsOf(bytes),doc=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true});await drawMarkups(doc,vps,markups,scales,opt);return new Uint8Array(await doc.save())}
/* blank clone with identical page boxes/rotation (for "markups only" output) */
async function blankClone(bytes){const src=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true}),out=await PDFLib.PDFDocument.create();
 for(const p of src.getPages()){const mb=p.getMediaBox(),cb=p.getCropBox(),n=out.addPage([mb.width,mb.height]);n.setMediaBox(mb.x,mb.y,mb.width,mb.height);n.setCropBox(cb.x,cb.y,cb.width,cb.height);n.setRotation(p.getRotation())}return new Uint8Array(await out.save())}
/* ---------- encryption (qpdf) ---------- */
async function encryptBytes(bytes,o){const q=await getQpdf(),id=Math.random().toString(36).slice(2),inp='/in'+id+'.pdf',out='/out'+id+'.pdf';q.FS.writeFile(inp,bytes);
 const bits=String(o.bits||256),args=['--encrypt',o.user||'',o.owner||o.user||'',bits];
 if(bits==='128')args.push('--use-aes=y');args.push('--print='+(o.print||'full'),'--modify='+(o.modify||'all'),'--extract='+(o.extract===false?'n':'y'));args.push('--',inp,out);
 let rc;try{rc=q.callMain(args)}catch(e){rc=e&&e.status!=null?e.status:1}
 let res=null;try{res=q.FS.readFile(out)}catch(e){}try{q.FS.unlink(inp)}catch(e){}try{q.FS.unlink(out)}catch(e){}
 if(!res||(rc!==0&&rc!==3))throw new Error('Encryption failed (qpdf exit '+rc+')');return new Uint8Array(res)}
async function decryptBytes(bytes,pw){const q=await getQpdf(),id=Math.random().toString(36).slice(2),inp='/in'+id+'.pdf',out='/out'+id+'.pdf';q.FS.writeFile(inp,bytes);let rc;try{rc=q.callMain(['--password='+pw,'--decrypt',inp,out])}catch(e){rc=1}
 let res=null;try{res=q.FS.readFile(out)}catch(e){}try{q.FS.unlink(inp);q.FS.unlink(out)}catch(e){}if(!res||(rc!==0&&rc!==3))throw new Error('Wrong password or not decryptable');return new Uint8Array(res)}
window.PMSecurity={encryptBytes,decryptBytes};
/* ---------- multi-file batch ---------- */
const PAPERS={Letter:[8.5,11],Legal:[8.5,14],Tabloid:[11,17],'ARCH A':[9,12],'ARCH B':[12,18],'ARCH C':[18,24],'ARCH D':[24,36],'ARCH E':[36,48],'ANSI C':[17,22],'ANSI D':[22,34],'ANSI E':[34,44],A4:[8.27,11.69],A3:[11.69,16.54],A1:[23.39,33.11],A0:[33.11,46.81]};
function parseRangeN(t,N){t=String(t||'').trim().toLowerCase();if(!t||t==='all')return Array.from({length:N},(_,i)=>i+1);const out=new Set();
 for(const part of t.split(',')){const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+|end))?$/);if(!m)continue;let a=+m[1],b=m[2]==='end'?N:+(m[2]||m[1]);if(a>b)[a,b]=[b,a];for(let i=a;i<=b;i++)if(i>=1&&i<=N)out.add(i)}return[...out].sort((a,b)=>a-b)}
const loadDoc=b=>PDFLib.PDFDocument.load(b,{ignoreEncryption:true});
const saved=async d=>new Uint8Array(await d.save());
async function opHF(f,o,st){const doc=await loadDoc(f.bytes),font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),pages=doc.getPages(),N=pages.length,rng=new Set(parseRangeN(o.range,N));
 const col=hexRgb(o.color||'#000000'),sz=+o.size||9,m=inch(o.margin??0.5);
 pages.forEach((pg,i)=>{if(!rng.has(i+1))return;const[W,Hh]=viewSize(pg);let usedB=false;
  const bates=(o.bprefix||'')+String(st.bates).padStart(+o.bdigits||6,'0')+(o.bsuffix||'');
  const tok=t=>String(t||'').replace(/\{page\}/g,i+1).replace(/\{pages\}/g,N).replace(/\{file\}/g,stem(f.name)).replace(/\{date\}/g,new Date().toLocaleDateString()).replace(/\{bates\}/g,()=>{usedB=true;return bates});
  for(const[k,pos]of[['hl','tl'],['hc','tc'],['hr','tr'],['fl','bl'],['fc','bc'],['fr','br']]){if(!o[k])continue;const t=safeTxt(tok(o[k])),w=font.widthOfTextAtSize(t,sz);
   const x=pos[1]==='l'?m:pos[1]==='c'?(W-w)/2:W-m-w,y=pos[0]==='t'?m+sz*.8:Hh-m;vText(pg,t,x,y,{size:sz,font,color:col})}
  if(o.wm){const t=safeTxt(tok(o.wm)),ws=+o.wmsize||72,w=font.widthOfTextAtSize(t,ws),a=o.wmang===''||o.wmang==null?-45:+o.wmang,ar=a*Math.PI/180,dir=[Math.cos(ar),Math.sin(ar)],dn=[-Math.sin(ar),Math.cos(ar)];
   vText(pg,t,W/2-dir[0]*w/2+dn[0]*ws*.35,Hh/2-dir[1]*w/2+dn[1]*ws*.35,{size:ws,font,color:hexRgb(o.wmcolor||'#888888'),opacity:+(o.wmop||.25),ang:a})}
  if(usedB)st.bates++});
 return[{name:stem(f.name)+'.pdf',bytes:await saved(doc)}]}
async function opCrop(f,o){let doc=await loadDoc(f.bytes);const t=inch(o.ct),r=inch(o.cr),b=inch(o.cb),l=inch(o.cl);
 if(t||r||b||l)for(const pg of doc.getPages()){const[W,Hh]=viewSize(pg);const a=v2p(pg,l,t),c=v2p(pg,W-r,Hh-b);pg.setCropBox(Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.abs(c[0]-a[0]),Math.abs(c[1]-a[1]))}
 if(o.paper&&PAPERS[o.paper]){const out=await PDFLib.PDFDocument.create();for(const pg of doc.getPages()){const[cw,ch]=viewSize(pg),rot=rotOf(pg),bb=boxOf(pg);const emb=await out.embedPage(pg,{left:bb[0],bottom:bb[1],right:bb[2],top:bb[3]});
   let[pw,ph]=PAPERS[o.paper].map(v=>v*72);if(o.orient==='p'&&pw>ph||o.orient==='l'&&pw<ph||(!o.orient||o.orient==='auto')&&(cw>ch)!==(pw>ph))[pw,ph]=[ph,pw];const mg=inch(o.pmargin||0);
   const sx=o.fit==='none'?1:Math.min((pw-2*mg)/cw,(ph-2*mg)/ch);const sh=out.addPage([pw,ph]);place(sh,emb,rot,cw,ch,sx,(pw-cw*sx)/2,(ph-ch*sx)/2)}doc=out}
 return[{name:stem(f.name)+'.pdf',bytes:await saved(doc)}]}
async function opRotate(f,o){const doc=await loadDoc(f.bytes),N=doc.getPageCount(),rng=new Set(parseRangeN(o.range,N));doc.getPages().forEach((pg,i)=>{if(rng.has(i+1))pg.setRotation(PDFLib.degrees((rotOf(pg)+(+o.deg||90)+360)%360))});return[{name:stem(f.name)+'.pdf',bytes:await saved(doc)}]}
async function opSplit(f,o){const src=await loadDoc(f.bytes),N=src.getPageCount(),k=Math.max(1,+o.every||1),out=[];
 for(let i=0;i<N;i+=k){const d=await PDFLib.PDFDocument.create(),idx=[];for(let j=i;j<Math.min(N,i+k);j++)idx.push(j);(await d.copyPages(src,idx)).forEach(p=>d.addPage(p));out.push({name:`${stem(f.name)}-p${i+1}${k>1?'-'+(idx[idx.length-1]+1):''}.pdf`,bytes:await saved(d)})}return out}
async function opReduce(f,o,st,pg){let best=f.bytes;try{const d=await loadDoc(f.bytes);const b=await d.save({useObjectStreams:true});if(b.length<best.length)best=new Uint8Array(b)}catch(e){}
 if(o.mode==='raster'){const pdf=await pdfjsOpen(f.bytes),d=await PDFLib.PDFDocument.create(),dpi=+o.dpi||150,q=+(o.q||.7);
  for(let i=1;i<=pdf.numPages;i++){if(pg&&pg.cancelled)break;const p=await pdf.getPage(i),v1=p.getViewport({scale:1}),k=Math.min(dpi/72,Math.sqrt(30e6/(v1.width*v1.height))),vp=p.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await p.render({canvasContext:ctx,viewport:vp}).promise;
   const jpg=await new Promise(r=>c.toBlob(async b=>r(new Uint8Array(await b.arrayBuffer())),'image/jpeg',q)),im=await d.embedJpg(jpg),sh=d.addPage([v1.width,v1.height]);sh.drawImage(im,{x:0,y:0,width:v1.width,height:v1.height})}
  pdf.destroy();const b=await saved(d);if(b.length<best.length)best=b}
 if(pg)pg.log(`${f.name}: ${(f.bytes.length/1048576).toFixed(2)} MB → ${(best.length/1048576).toFixed(2)} MB`);return[{name:stem(f.name)+'.pdf',bytes:best}]}
async function opFlatten(f,o,st,pg){const r=await readPM(f.bytes,f.name);if(!r.markups.length){if(pg)pg.log(f.name+': no PlanMark markups found — copied unchanged');return[{name:stem(f.name)+'.pdf',bytes:r.orig}]}
 const b=await flattenBytes(r.orig,r.markups,r.scales,{links:false});if(pg)pg.log(`${f.name}: ${r.markups.length} markups burned in`);return[{name:stem(f.name)+'-flattened.pdf',bytes:b}]}
async function opStamp(f,o){const doc=await loadDoc(f.bytes),font=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold),N=doc.getPageCount(),rng=new Set(parseRangeN(o.range,N)),txt=safeTxt((o.text||'APPROVED').toUpperCase()),sz=+o.size||20,col=hexRgb(o.color||'#c62828');
 doc.getPages().forEach((pg,i)=>{if(!rng.has(i+1))return;const[W,Hh]=viewSize(pg),w=font.widthOfTextAtSize(txt,sz)+sz*1.2,h=sz*1.7,ins=36,pos=o.pos||'tr';
  const x=pos.includes('l')?ins:pos.includes('r')?W-ins-w:(W-w)/2,y=pos.includes('t')?ins:pos.includes('b')?Hh-ins-h:(Hh-h)/2;
  vRect(pg,x,y,w,h,{borderColor:col,borderWidth:2,opacity:0,borderOpacity:.9});vRect(pg,x+3,y+3,w-6,h-6,{borderColor:col,borderWidth:.7,borderOpacity:.9});vText(pg,txt,x+sz*.6,y+h/2+sz*.35,{size:sz,font,color:col,opacity:.9})});
 return[{name:stem(f.name)+'.pdf',bytes:await saved(doc)}]}
/* OCR any file: temporarily points PMOCR at the file's pages, then writes invisible text into it */
async function opOcr(f,o,st,prog){if(!window.PMOCR)throw new Error('OCR module missing');const pdf=await pdfjsOpen(f.bytes),N=pdf.numPages,pages=[];for(let i=1;i<=N;i++){const vp=(await pdf.getPage(i)).getViewport({scale:1});pages.push({num:i,vp,w:vp.width,h:vp.height,el:document.createElement('div'),canvas:document.createElement('canvas'),rs:0,vis:false})}
 const keep={pdf:S.pdf,pages:S.pages,ocr:S.ocr,textCache:S.textCache};const words={};
 try{S.pdf=pdf;S.pages=pages;S.ocr={};S.textCache={};for(let i=1;i<=N;i++){if(prog&&prog.cancelled)break;if(o.skip){const tc=await (await pdf.getPage(i)).getTextContent();if(tc.items.filter(t=>t.str&&t.str.trim()).length>8)continue}
   if(prog)prog.msg(`OCR ${f.name} — page ${i} of ${N}`);await PMOCR.ocrPage(i);words[i]=S.ocr[i]||[]}}
 finally{Object.assign(S,keep);pdf.destroy()}
 const doc=await loadDoc(f.bytes),font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),pgs=doc.getPages();let n=0;
 for(const k in words){const page=pgs[k-1],rot=pages[k-1].vp.rotation||0;for(const w of words[k]){const s=safeTxt(w.str);const wd=font.widthOfTextAtSize(s,1);if(!s||!wd)continue;const size=Math.max(1,Math.min(w.h*1.15,w.w/wd));try{page.drawText(s,{x:w.x,y:w.y+w.h*.15,size,font,opacity:0,rotate:PDFLib.degrees(rot)});n++}catch(e){}}}
 if(prog)prog.log(`${f.name}: ${n} words recognised`);return[{name:stem(f.name)+'.pdf',bytes:await saved(doc)}]}
async function opSecurity(f,o){return[{name:stem(f.name)+'.pdf',bytes:await encryptBytes(f.bytes,o)}]}
/* aggregated: markup summary across many PlanMark PDFs */
async function aggSummary(files,o,prog){const rows=[['File','Page','Subject','Type','Label','Comments','Measurement','Value','Unit','Extra','Extra value','Extra unit','Author','Date','Status']],agg=new Map();
 for(let i=0;i<files.length;i++){if(prog.cancelled)break;const f=files[i];prog.msg('Reading '+f.name);prog.bar(i/files.length);const r=await readPM(f.bytes,f.name);const keep=S.scales;
  try{S.scales=r.scales||{};for(const m of r.markups){if(!T[m.type])continue;let me=null;try{me=measOf(m)}catch(e){}rows.push([f.name,m.page,m.subject||'',T[m.type].label,m.label||m.text||'',m.comment||'',me?me.text:'',me?+me.v.toFixed(4):'',me?me.unit:'',me&&me.extra?me.extra.text:'',me&&me.extra?+me.extra.v.toFixed(4):'',me&&me.extra?me.extra.unit:'',m.author||'',m.created?new Date(m.created).toISOString():'',m.status||'']);
    const k=(m.subject||T[m.type].label)+'|'+(me?me.unit:'');const a=agg.get(k)||{subject:m.subject||T[m.type].label,unit:me?me.unit:'',count:0,total:0,files:new Set()};a.count+=m.type==='count'?m.pts.length:1;if(me&&me.kind!=='angle')a.total+=me.v;a.files.add(f.name);agg.set(k,a)}}finally{S.scales=keep}
  prog.log(`${f.name}: ${r.markups.length} markups${r.embedded?'':' (from this device)'}`)}
 const q=[['Subject','Count','Total','Unit','Files'],...[...agg.values()].map(a=>[a.subject,a.count,+a.total.toFixed(4),a.unit,[...a.files].join('; ')])];
 const xl=await PMOutput.xlsx([{name:'Markups',rows},{name:'Quantities',rows:q},{name:'Files',rows:[['File','Size (MB)'],...files.map(f=>[f.name,+(f.bytes.length/1048576).toFixed(2)])]}]);
 return[{name:'batch-markup-summary.xlsx',bytes:await toU8(xl)}]}
async function aggImages(files,o,prog){const out=[],mk=async()=>PDFLib.PDFDocument.create();let one=await mk();
 for(let i=0;i<files.length;i++){if(prog.cancelled)break;const f=files[i];prog.msg('Adding '+f.name);prog.bar(i/files.length);
  let b=f.bytes,png=/\.png$/i.test(f.name)||f.type==='image/png';if(!png&&!/\.jpe?g$/i.test(f.name)&&!/jpeg/.test(f.type||'')){const im=await createImageBitmap(new Blob([b]));const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);b=await new Promise(r=>c.toBlob(async x=>r(new Uint8Array(await x.arrayBuffer())),'image/png'));png=true}
  const d=o.single?one:await mk(),img=png?await d.embedPng(b):await d.embedJpg(b);let pw,ph;
  if(o.paper&&PAPERS[o.paper]){[pw,ph]=PAPERS[o.paper].map(v=>v*72);if((img.width>img.height)!==(pw>ph))[pw,ph]=[ph,pw]}else{const dpi=+o.dpi||150;pw=img.width/dpi*72;ph=img.height/dpi*72}
  const m=o.paper?18:0,s=Math.min((pw-2*m)/img.width,(ph-2*m)/img.height),pg=d.addPage([pw,ph]);pg.drawImage(img,{x:(pw-img.width*s)/2,y:(ph-img.height*s)/2,width:img.width*s,height:img.height*s});
  if(!o.single)out.push({name:stem(f.name)+'.pdf',bytes:await saved(d)})}
 if(o.single&&one.getPageCount())out.push({name:'images.pdf',bytes:await saved(one)});return out}
async function aggPrint(files,o,prog){const d=await PDFLib.PDFDocument.create();
 for(let i=0;i<files.length;i++){if(prog.cancelled)break;const f=files[i];prog.msg('Preparing '+f.name);prog.bar(i/files.length);let b=f.bytes;if(o.marks){const r=await readPM(b,f.name);b=r.markups.length?await flattenBytes(r.orig,r.markups,r.scales,{}):r.orig}
  const s=await loadDoc(b);(await d.copyPages(s,s.getPageIndices())).forEach(p=>d.addPage(p))}
 const bytes=await saved(d);await printBytes(bytes,{dpi:+o.dpi||200,gray:o.gray});return[]}
/* print finished PDF bytes: desktop → system print dialog via page images; web → print-ready PDF */
async function printBytes(bytes,o={}){const dv=window.pmDesktop;if(dv&&dv.printImages){const doc=await pdfjsOpen(bytes),imgs=[];
  for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i),v1=pg.getViewport({scale:1}),k=Math.min((o.dpi||200)/72,Math.sqrt(40e6/(v1.width*v1.height))),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;if(o.gray){ctx.globalCompositeOperation='saturation';ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height)}
   imgs.push({dataUrl:c.toDataURL('image/png'),wIn:v1.width/72,hIn:v1.height/72})}doc.destroy();const r=await dv.printImages(imgs);if(r&&r.ok)toast('Sent to printer');else if(r&&r.reason&&r.reason!=='cancelled')toast('Printing failed: '+r.reason);return r}
 await saveFile((o.name||baseName()+'-print')+'.pdf',new Blob([bytes],{type:'application/pdf'}));return{ok:true,web:true}}
const OPS={
 hf:{label:'Headers, footers, Bates & watermark',run:opHF,form:o=>`<div class="hint" style="margin-bottom:6px">Tokens: {page} {pages} {file} {date} {bates}. Bates numbers continue across all files in order.</div>
  <div class="row fld" style="gap:4px"><input class="ti" data-b="hl" placeholder="Header left" value="${esc(o.hl||'')}"><input class="ti" data-b="hc" placeholder="Header center" value="${esc(o.hc||'')}"><input class="ti" data-b="hr" placeholder="Header right" value="${esc(o.hr||'')}"></div>
  <div class="row fld" style="gap:4px"><input class="ti" data-b="fl" placeholder="Footer left" value="${esc(o.fl||'')}"><input class="ti" data-b="fc" placeholder="Footer center" value="${esc(o.fc??'Page {page} of {pages}')}"><input class="ti" data-b="fr" placeholder="Footer right" value="${esc(o.fr??'{bates}')}"></div>
  <div class="row fld" style="gap:4px"><input class="ti" data-b="bprefix" placeholder="Bates prefix" value="${esc(o.bprefix??'PM')}"><input class="ti" type="number" data-b="bstart" placeholder="Start" value="${esc(o.bstart??1)}"><input class="ti" type="number" data-b="bdigits" placeholder="Digits" value="${esc(o.bdigits??6)}"><input class="ti" data-b="bsuffix" placeholder="Suffix" value="${esc(o.bsuffix||'')}"></div>
  <div class="row fld" style="gap:4px"><input class="ti" type="number" data-b="size" value="${esc(o.size??9)}" title="Font size"><input type="color" data-b="color" value="${esc(o.color||'#000000')}"><input class="ti" type="number" step="0.05" data-b="margin" value="${esc(o.margin??.5)}" title="Margin (in)"><input class="ti" data-b="range" placeholder="Pages (all)" value="${esc(o.range||'')}"></div>
  <div class="row fld" style="gap:4px"><input class="ti" data-b="wm" placeholder="Watermark text (optional)" value="${esc(o.wm||'')}"><input class="ti" type="number" data-b="wmsize" value="${esc(o.wmsize??72)}" title="Size"><input class="ti" type="number" data-b="wmang" value="${esc(o.wmang??-45)}" title="Angle"><input class="ti" type="number" step="0.05" data-b="wmop" value="${esc(o.wmop??.2)}" title="Opacity"><input type="color" data-b="wmcolor" value="${esc(o.wmcolor||'#888888')}"></div>`},
 crop:{label:'Crop & page setup',run:opCrop,form:o=>`<div class="hint">Crop margins in inches (as the page is viewed), and/or fit each page onto a paper size.</div><div class="row fld" style="gap:4px">${['ct','cr','cb','cl'].map((k,i)=>`<input class="ti" type="number" step="0.05" data-b="${k}" placeholder="${['Top','Right','Bottom','Left'][i]}" value="${esc(o[k]||'')}">`).join('')}</div>
  <div class="row fld" style="gap:4px"><select class="ti" data-b="paper"><option value="">Keep page size</option>${Object.keys(PAPERS).map(k=>`<option ${o.paper===k?'selected':''}>${k}</option>`).join('')}</select><select class="ti" data-b="orient"><option value="auto">Auto orientation</option><option value="p" ${o.orient==='p'?'selected':''}>Portrait</option><option value="l" ${o.orient==='l'?'selected':''}>Landscape</option></select><select class="ti" data-b="fit"><option value="fit">Scale to fit</option><option value="none" ${o.fit==='none'?'selected':''}>Center, no scaling</option></select><input class="ti" type="number" step="0.05" data-b="pmargin" placeholder="Margin" value="${esc(o.pmargin||'')}"></div>`},
 rotate:{label:'Rotate pages',run:opRotate,form:o=>`<div class="row fld" style="gap:4px"><select class="ti" data-b="deg"><option value="90">Clockwise 90°</option><option value="-90" ${o.deg==-90?'selected':''}>Counter-clockwise 90°</option><option value="180" ${o.deg==180?'selected':''}>180°</option></select><input class="ti" data-b="range" placeholder="Pages (all)" value="${esc(o.range||'')}"></div>`},
 split:{label:'Split documents',run:opSplit,form:o=>`<div class="fld"><label>Pages per file</label><input class="ti" type="number" min="1" data-b="every" value="${esc(o.every??1)}"></div>`},
 reduce:{label:'Reduce file size',run:opReduce,form:o=>`<div class="row fld" style="gap:4px"><select class="ti" data-b="mode"><option value="lossless">Lossless clean-up</option><option value="raster" ${o.mode==='raster'?'selected':''}>Convert pages to compressed images</option></select><input class="ti" type="number" data-b="dpi" value="${esc(o.dpi??150)}" title="DPI"><input class="ti" type="number" step="0.05" data-b="q" value="${esc(o.q??.7)}" title="JPEG quality"></div><div class="hint">The original is kept when a result would be larger.</div>`},
 flatten:{label:'Flatten markups',run:opFlatten,form:()=>`<div class="hint">Burns PlanMark markups into each PDF (from PlanMark-saved files, or files whose markups are stored on this device).</div>`},
 stamp:{label:'Apply stamp',run:opStamp,form:o=>`<div class="row fld" style="gap:4px"><input class="ti" data-b="text" value="${esc(o.text||'APPROVED')}"><select class="ti" data-b="pos">${[['tr','Top right'],['tl','Top left'],['br','Bottom right'],['bl','Bottom left'],['c','Center']].map(([v,l])=>`<option value="${v}" ${o.pos===v?'selected':''}>${l}</option>`).join('')}</select><input type="color" data-b="color" value="${esc(o.color||'#c62828')}"><input class="ti" type="number" data-b="size" value="${esc(o.size??20)}"><input class="ti" data-b="range" placeholder="Pages (all)" value="${esc(o.range||'')}"></div>`},
 ocr:{label:'OCR (make searchable)',run:opOcr,form:o=>`<label class="chk fld"><input type="checkbox" data-b="skip" ${o.skip!==false?'checked':''}> Skip pages that already contain text</label>`},
 security:{label:'Password protect (encrypt)',run:opSecurity,form:o=>secForm(o,'data-b')},
 sign:{label:'Digitally sign',run:(f,o,st,p)=>opSign(f,o,st,p),form:o=>signBatchForm(o)},
 summary:{label:'Markup summary (Excel)',agg:aggSummary,form:()=>`<div class="hint">One spreadsheet of every markup and quantity across all the files (PlanMark-saved PDFs, or files whose markups are stored on this device).</div>`},
 print:{label:'Print all',agg:aggPrint,form:o=>`<label class="chk fld"><input type="checkbox" data-b="marks" ${o.marks!==false?'checked':''}> Include markups</label><label class="chk fld"><input type="checkbox" data-b="gray" ${o.gray?'checked':''}> Grayscale</label><div class="fld"><label>Max print DPI</label><input class="ti" type="number" data-b="dpi" value="${esc(o.dpi??200)}"></div><div class="hint">${window.pmDesktop&&window.pmDesktop.printImages?'Opens the Windows print dialog once for all files.':'In the browser this makes one print-ready PDF of all files.'}</div>`},
};
function secForm(o,attr){const a=attr||'data-s';return`<div class="row fld" style="gap:4px"><input class="ti" type="password" ${a}="user" placeholder="Password to open (optional)" value="${esc(o.user||'')}"><input class="ti" type="password" ${a}="owner" placeholder="Permissions password" value="${esc(o.owner||'')}"></div>
 <div class="row fld" style="gap:4px"><select class="ti" ${a}="bits"><option value="256">AES-256</option><option value="128" ${o.bits==128?'selected':''}>AES-128</option></select><select class="ti" ${a}="print"><option value="full">Printing allowed</option><option value="low" ${o.print==='low'?'selected':''}>Low-res printing</option><option value="none" ${o.print==='none'?'selected':''}>No printing</option></select>
 <select class="ti" ${a}="modify"><option value="all">Changes allowed</option><option value="annotate" ${o.modify==='annotate'?'selected':''}>Comments & forms only</option><option value="form" ${o.modify==='form'?'selected':''}>Form filling only</option><option value="none" ${o.modify==='none'?'selected':''}>No changes</option></select></div>
 <label class="chk fld"><input type="checkbox" ${a}="extract" ${o.extract!==false?'checked':''}> Allow copying text and images</label>`}
function readOpts(root,attr){const o={};root.querySelectorAll(`[${attr}]`).forEach(el=>{const k=el.getAttribute(attr);o[k]=el.type==='checkbox'?el.checked:el.value});return o}
let BF=[];
function batchFilesDialog(preset){const saved_=LS.get('pm:b2:batch',{});let op=(OPS[preset]&&preset)||(OPS[saved_.op]&&saved_.op)||'hf';const opts=saved_.opts||{};
 const render=()=>{const md=$('#modal');if(!md||!$('#b2Files'))return;$('#b2Files').innerHTML=BF.length?BF.map((f,i)=>`<div class="row" style="gap:4px;align-items:center;padding:3px 0;border-bottom:1px solid var(--line)"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i+1}. ${esc(f.name)} <small style="color:var(--mut)">${(f.bytes.length/1048576).toFixed(2)} MB</small></span><button class="btn" data-up="${i}" style="flex:0;padding:0 5px">↑</button><button class="btn" data-dn="${i}" style="flex:0;padding:0 5px">↓</button><button class="btn" data-rm="${i}" style="flex:0;padding:0 5px">✕</button></div>`).join(''):'<div class="hint">No files yet.</div>';
  $('#b2Opts').innerHTML=OPS[op].form(opts[op]||{})};
 modal('Batch — process many files',`<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap"><button class="btn" id="b2Add" style="border:1px solid var(--line)">Add PDFs…</button>${S.bytes?'<button class="btn" id="b2Cur" style="border:1px solid var(--line)">Add open document</button>':''}<button class="btn" id="b2Img" style="border:1px solid var(--line)">Images → PDF…</button><button class="btn" id="b2Clr" style="border:1px solid var(--line)">Clear</button></div>
 <div id="b2Files" style="max-height:150px;overflow:auto;margin-bottom:8px"></div>
 <div class="fld"><label>Action</label><select class="ti" id="b2Op">${Object.entries(OPS).map(([k,v])=>`<option value="${k}" ${k===op?'selected':''}>${v.label}</option>`).join('')}</select></div><div id="b2Opts"></div>`,
 [{label:'Close',cancel:1},{label:'Run',pri:1,fn:md=>{const o=readOpts(md,'data-b');opts[op]=o;LS.set('pm:b2:batch',{op,opts:Object.fromEntries(Object.entries(opts).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).filter(([kk])=>!/user|owner|pass/.test(kk)))]))});if(!BF.length){toast('Add some files first');return false}setTimeout(()=>runBatch(op,o,BF.slice()),0)}}]);
 render();const md=$('#modal');
 $('#b2Op').onchange=e=>{opts[op]=readOpts(md,'data-b');op=e.target.value;render()};
 $('#b2Add').onclick=async()=>{for(const f of await pickFiles('application/pdf,.pdf',true))BF.push({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())});render()};
 if($('#b2Cur'))$('#b2Cur').onclick=()=>{BF.push({name:S.fileName,bytes:S.bytes});render()};
 $('#b2Img').onclick=async()=>{const fs=await pickFiles('image/*',true);if(!fs.length)return;const im=[];for(const f of fs)im.push({name:f.name,type:f.type,bytes:new Uint8Array(await f.arrayBuffer())});
  closeModal();modal('Images → PDF',`<div class="hint">${im.length} image${im.length>1?'s':''}</div><label class="chk fld"><input type="checkbox" id="b2One" checked> Combine into one PDF</label><div class="row fld" style="gap:4px"><select class="ti" id="b2Pa"><option value="">Page size from image (DPI)</option>${Object.keys(PAPERS).map(k=>`<option>${k}</option>`).join('')}</select><input class="ti" type="number" id="b2Dpi" value="150"></div>`,
   [{label:'Cancel',cancel:1},{label:'Create',pri:1,fn:m2=>{const o={single:m2.querySelector('#b2One').checked,paper:m2.querySelector('#b2Pa').value,dpi:m2.querySelector('#b2Dpi').value};setTimeout(async()=>{const pg=progress('Images → PDF');try{const out=await aggImages(im,o,pg);pg.done();await deliver(out,'images.zip')}catch(e){pg.done();toast('Failed: '+e.message)}},0)}}])};
 $('#b2Clr').onclick=()=>{BF=[];render()};
 md.addEventListener('click',e=>{const u=e.target.closest('[data-up]'),d=e.target.closest('[data-dn]'),r=e.target.closest('[data-rm]');if(u){const i=+u.dataset.up;if(i>0)[BF[i-1],BF[i]]=[BF[i],BF[i-1]];render()}if(d){const i=+d.dataset.dn;if(i<BF.length-1)[BF[i+1],BF[i]]=[BF[i],BF[i+1]];render()}if(r){BF.splice(+r.dataset.rm,1);render()}})}
async function runBatch(op,o,files){const def=OPS[op],pg=progress(def.label);const st={bates:Math.max(0,parseInt(o.bstart||1,10)||1)};let out=[];
 try{if(def.agg)out=await def.agg(files,o,pg);else for(let i=0;i<files.length;i++){if(pg.cancelled)break;const f=files[i];pg.msg(`${def.label}: ${f.name} (${i+1} of ${files.length})`);pg.bar(i/files.length);
   try{out.push(...await def.run(f,o,st,pg))}catch(e){console.error(e);pg.log(`✗ ${f.name}: ${e.message||e}`)}await tickb()}
  pg.bar(1);const cancelled=pg.cancelled;pg.done();if(cancelled)toast('Cancelled');if(out.length)await deliver(out,'batch-'+op+'.zip');B2.lastBatch={op,out};return out}
 catch(e){console.error(e);pg.done();toast('Batch failed: '+(e.message||e));return[]}}
window.PMBatch2={OPS,runBatch,batchFilesDialog,flattenBytes,readPM,deliver,printBytes,parseRangeN,viewSize,v2p,B2};
/* ---------- compare / overlay depth ---------- */
async function renderGray(pdf,n,k,W,Hh,M){const pg=await pdf.getPage(n),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=W||Math.ceil(vp.width);c.height=Hh||Math.ceil(vp.height);
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);const tr=M?[M[0],M[1],M[2],M[3],M[4]*k,M[5]*k]:null;
 await pg.render(Object.assign({canvasContext:ctx,viewport:vp,background:'white'},tr?{transform:tr}:{})).promise;return{c,ctx,vp,pg}}
function grayOf(c){const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data,g=new Float32Array(c.width*c.height);for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=1-(d[j]*.3+d[j+1]*.59+d[j+2]*.11)/255;return g}
function profiles(g,W,Hh){const px=new Float64Array(W),py=new Float64Array(Hh);for(let y=0;y<Hh;y++){let s=0;const r=y*W;for(let x=0;x<W;x++){const v=g[r+x];px[x]+=v;s+=v}py[y]=s}
 const z=a=>{let m=0;for(const v of a)m+=v;m/=a.length;for(let i=0;i<a.length;i++)a[i]-=m;return a};return[z(px),z(py)]}
/* best (shift t) so that pA(s*x+t) ≈ pB(x); returns {t,score} in pixels for a given scale s */
function corr1(pA,pB,s,tmin,tmax,step){let best={t:0,score:-1e18};const nA=pA.length,nB=pB.length;let nB2=0;for(const v of pB)nB2+=v*v;
 for(let t=tmin;t<=tmax;t+=step||1){let sc=0,nA2=0;for(let x=0;x<nB;x++){const xa=Math.round(s*x+t);if(xa<0||xa>=nA)continue;sc+=pA[xa]*pB[x];nA2+=pA[xa]*pA[xa]}const v=nA2>0?sc/Math.sqrt(nA2*nB2+1e-9):-1;if(v>best.score)best={t,score:v}}return best}
/* estimate matrix [s,0,0,s,tx,ty] (pt) mapping canvas-B content onto canvas-A, both rendered at k px/pt */
function alignGray(gA,WA,HA,gB,WB,HB,k,opt={}){const[ax,ay]=profiles(gA,WA,HA),[bx,by]=profiles(gB,WB,HB);const scales=opt.scale===false?[1]:Array.from({length:61},(_,i)=>.85+i*.005);
 const mx=Math.round(Math.max(WA,WB)*.35),my=Math.round(Math.max(HA,HB)*.35);let best=null;
 for(const s of scales){const X=corr1(ax,bx,s,-mx,mx,1),Y=corr1(ay,by,s,-my,my,1),sc=X.score+Y.score;if(!best||sc>best.sc)best={s,tx:X.t,ty:Y.t,sc}}
 return{m:[best.s,0,0,best.s,best.tx/k,best.ty/k],score:best.sc/2}}
async function autoAlignPages(pdfA,nA,pdfB,nB,opt={}){const pa=await pdfA.getPage(nA),va=pa.getViewport({scale:1}),k1=600/Math.max(va.width,va.height);
 const A1=await renderGray(pdfA,nA,k1),B1=await renderGray(pdfB,nB,k1);const r1=alignGray(grayOf(A1.c),A1.c.width,A1.c.height,grayOf(B1.c),B1.c.width,B1.c.height,k1,opt);
 // refine translation at higher resolution around the coarse answer
 const k2=Math.min(2,1800/Math.max(va.width,va.height)),s=r1.m[0];const A2=await renderGray(pdfA,nA,k2),B2_=await renderGray(pdfB,nB,k2);const[ax,ay]=profiles(grayOf(A2.c),A2.c.width,A2.c.height),[bx,by]=profiles(grayOf(B2_.c),B2_.c.width,B2_.c.height);
 const w=Math.ceil(k2/k1)*3+2,cx=Math.round(r1.m[4]*k2),cy=Math.round(r1.m[5]*k2);let bs=s,X=corr1(ax,bx,s,cx-w,cx+w,1),Y=corr1(ay,by,s,cy-w,cy+w,1);
 if(opt.scale!==false)for(let ds=-.006;ds<=.006;ds+=.0005){const s2=s+ds,X2=corr1(ax,bx,s2,cx-w,cx+w,1),Y2=corr1(ay,by,s2,cy-w,cy+w,1);if(X2.score+Y2.score>X.score+Y.score){X=X2;Y=Y2;bs=s2}}
 return{m:[bs,0,0,bs,X.t/k2,Y.t/k2],score:(X.score+Y.score)/2}}
function solveAffine(P,Q){// P = overlay points, Q = base points (3 each): returns SVG matrix [a,b,c,d,e,f] with Q = M·P
 const[x1,y1]=P[0],[x2,y2]=P[1],[x3,y3]=P[2],det=x1*(y2-y3)-y1*(x2-x3)+(x2*y3-x3*y2);if(Math.abs(det)<1e-6)return null;
 const sol=v=>{const[v1,v2,v3]=v;return[(v1*(y2-y3)-y1*(v2-v3)+(v2*y3-v3*y2))/det,(x1*(v2-v3)-v1*(x2-x3)+(x2*v3-x3*v2))/det,(x1*(y2*v3-y3*v2)-y1*(x2*v3-x3*v2)+v1*(x2*y3-x3*y2))/det]};
 const[a,c,e]=sol(Q.map(q=>q[0])),[b,d,f]=sol(Q.map(q=>q[1]));return[a,b,c,d,e,f]}
const mulM=(M,L)=>[M[0]*L[0]+M[2]*L[1],M[1]*L[0]+M[3]*L[1],M[0]*L[2]+M[2]*L[3],M[1]*L[2]+M[3]*L[3],M[0]*L[4]+M[2]*L[5]+M[4],M[1]*L[4]+M[3]*L[5]+M[5]];
const applyM=(M,p)=>[M[0]*p[0]+M[2]*p[1]+M[4],M[1]*p[0]+M[3]*p[1]+M[5]];
function recolorCanvas(src,hex){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d');ctx.drawImage(src,0,0);const id=ctx.getImageData(0,0,c.width,c.height),d=id.data,n=parseInt(hex.replace('#',''),16),R=n>>16&255,G=n>>8&255,B=n&255;
 for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11,a=255-l;d[i]=R;d[i+1]=G;d[i+2]=B;d[i+3]=a<18?0:Math.min(255,a*1.4)}ctx.putImageData(id,0,0);return c}
const blobUrl=c=>new Promise(r=>c.toBlob(b=>r(URL.createObjectURL(b)),'image/png'));
const pngBytes=c=>new Promise(r=>c.toBlob(async b=>r(new Uint8Array(await b.arrayBuffer())),'image/png'));
/* full compare with options; A = current document page, B = other document page */
async function compareCore(pdfA,nA,pdfB,nB,o){const pa=await pdfA.getPage(nA),va=pa.getViewport({scale:1}),k=Math.min(2.2,Math.sqrt(9e6/(va.width*va.height))),W=Math.round(va.width*k),Hh=Math.round(va.height*k);
 const M=o.align?(await autoAlignPages(pdfA,nA,pdfB,nB,{scale:o.alignScale!==false})).m:null;
 const ra=await renderGray(pdfA,nA,k,W,Hh),rb=await renderGray(pdfB,nB,k,W,Hh,M);
 if(o.ignoreText){for(const[r,pg,m]of[[ra,pa,null],[rb,rb.pg,M]]){const tc=await pg.getTextContent(),v1=pg.getViewport({scale:1});r.ctx.fillStyle='#fff';
   for(const it of tc.items){if(!it.str||!it.str.trim())continue;const[a,b,c2,d,e,f]=it.transform,h=Math.hypot(c2,d)||Math.hypot(a,b);const q=v1.convertToViewportRectangle([e,f-h*.25,e+it.width,f+h]);let p1=[Math.min(q[0],q[2]),Math.min(q[1],q[3])],p2=[Math.max(q[0],q[2]),Math.max(q[1],q[3])];
    if(m){p1=applyM(m,p1);p2=applyM(m,p2)}r.ctx.fillRect(p1[0]*k-1,p1[1]*k-1,(p2[0]-p1[0])*k+2,(p2[1]-p1[1])*k+2)}}}
 const da=ra.ctx.getImageData(0,0,W,Hh).data,db=rb.ctx.getImageData(0,0,W,Hh).data,N=W*Hh,A=new Uint8Array(N),B=new Uint8Array(N);
 for(let i=0,j=0;i<N;i++,j+=4){A[i]=(da[j]*.3+da[j+1]*.59+da[j+2]*.11)<190?1:0;B[i]=(db[j]*.3+db[j+1]*.59+db[j+2]*.11)<190?1:0}
 const dil=(X,r)=>{const T1=new Uint8Array(N),T2=new Uint8Array(N);for(let y=0;y<Hh;y++){let run=-1e9;for(let x=0;x<W;x++){if(X[y*W+x])run=x;if(x-run<=r)T1[y*W+x]=1}run=1e9;for(let x=W-1;x>=0;x--){if(X[y*W+x])run=x;if(run-x<=r)T1[y*W+x]=1}}
  for(let x=0;x<W;x++){let run=-1e9;for(let y=0;y<Hh;y++){if(T1[y*W+x])run=y;if(y-run<=r)T2[y*W+x]=1}run=1e9;for(let y=Hh-1;y>=0;y--){if(T1[y*W+x])run=y;if(run-y<=r)T2[y*W+x]=1}}return T2};
 const rr=Math.max(1,Math.round(k*(o.tol||0.9))),dA=dil(A,rr),dB=dil(B,rr);const reg=o.region?[o.region[0]*k,o.region[1]*k,o.region[2]*k,o.region[3]*k]:null;
 const cell=Math.max(4,Math.round(4*k)),gw=Math.ceil(W/cell),gh=Math.ceil(Hh/cell),cnt=new Uint16Array(gw*gh),img=new ImageData(W,Hh),id=img.data;
 const ca=hexToRgb3(o.addColor||'#00aa3c'),cr=hexToRgb3(o.remColor||'#e61e1e');let changed=0;
 for(let i=0;i<N;i++){const x=i%W,y=(i/W)|0;if(reg&&(x<reg[0]||x>reg[2]||y<reg[1]||y>reg[3]))continue;const add=A[i]&&!dB[i],rem=B[i]&&!dA[i],j=i*4;
  if(add){id[j]=ca[0];id[j+1]=ca[1];id[j+2]=ca[2];id[j+3]=255}else if(rem){id[j]=cr[0];id[j+1]=cr[1];id[j+2]=cr[2];id[j+3]=255}else if(A[i]){id[j]=id[j+1]=id[j+2]=150;id[j+3]=70}
  if(add||rem){changed++;cnt[((y/cell)|0)*gw+((x/cell)|0)]++}}
 const thr=+o.sens||5,on=new Uint8Array(gw*gh);for(let i=0;i<on.length;i++)on[i]=cnt[i]>=thr?1:0;const gap=3,lab=new Int32Array(gw*gh).fill(-1),boxes=[];
 for(let i=0;i<on.length;i++){if(!on[i]||lab[i]>=0)continue;const st=[i];lab[i]=boxes.length;let b=[1e9,1e9,-1,-1],n=0;while(st.length){const c=st.pop(),cx=c%gw,cy=(c/gw)|0;n+=cnt[c];b=[Math.min(b[0],cx),Math.min(b[1],cy),Math.max(b[2],cx),Math.max(b[3],cy)];
   for(let dy=-gap;dy<=gap;dy++)for(let dx=-gap;dx<=gap;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const ni=ny*gw+nx;if(on[ni]&&lab[ni]<0){lab[ni]=boxes.length;st.push(ni)}}}boxes.push({b,n})}
 const pad=8,out=[];for(const{b,n}of boxes){if(n<thr*2)continue;out.push([b[0]*cell/k-pad,b[1]*cell/k-pad,(b[2]+1)*cell/k+pad,(b[3]+1)*cell/k+pad])}
 return{boxes:out,img,W,Hh,k,M,changed}}
function hexToRgb3(h){const n=parseInt(String(h).replace('#',''),16);return[n>>16&255,n>>8&255,n&255]}
function compareDialog2(){if(!S.pages.length)return toast('Open a PDF first');const o0=LS.get('pm:b2:cmp',{});
 modal('Compare documents',`<div class="fld"><label>Other revision (PDF)</label><input type="file" id="cpF" class="ti" accept="application/pdf,.pdf"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Page of this document</label><input class="ti" type="number" id="cpA" min="1" max="${S.pages.length}" value="${S.cur}"></div><div><label style="font-size:11px;color:var(--mut)">Page of other</label><input class="ti" type="number" id="cpB" min="1" value="${S.cur}"></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Sensitivity</label><select class="ti" id="c2S"><option value="2">High</option><option value="5" selected>Normal</option><option value="12">Low</option></select></div><div><label style="font-size:11px;color:var(--mut)">Tolerance (pt)</label><input class="ti" type="number" step="0.1" id="c2T" value="${o0.tol??0.9}"></div></div>
 <label class="chk fld"><input type="checkbox" id="c2Al" ${o0.align!==false?'checked':''}> Auto-align the revisions first (fixes shifted/scaled sheets)</label>
 <label class="chk fld"><input type="checkbox" id="c2Tx" ${o0.ignoreText?'checked':''}> Ignore text-only changes</label>
 <label class="chk fld"><input type="checkbox" id="c2R"> Compare only a region (pick it next)</label>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Clouds</label><input type="color" id="c2C" value="${o0.cloud||'#e0312b'}"></div><div><label style="font-size:11px;color:var(--mut)">Added</label><input type="color" id="c2Ad" value="${o0.addColor||'#00aa3c'}"></div><div><label style="font-size:11px;color:var(--mut)">Removed</label><input type="color" id="c2Rm" value="${o0.remColor||'#e61e1e'}"></div></div>
 <label class="chk fld"><input type="checkbox" id="c2L" checked> Add color difference layer</label>`,
 [{label:'Cancel',cancel:1},{label:'Compare',pri:1,fn:md=>{const f=md.querySelector('#cpF').files[0];if(!f){toast('Choose the other PDF');return false}const o={file:f,a:clamp(+md.querySelector('#cpA').value||1,1,S.pages.length),b:Math.max(1,+md.querySelector('#cpB').value||1),sens:+md.querySelector('#c2S').value,tol:+md.querySelector('#c2T').value||.9,align:md.querySelector('#c2Al').checked,ignoreText:md.querySelector('#c2Tx').checked,region:md.querySelector('#c2R').checked,cloud:md.querySelector('#c2C').value,addColor:md.querySelector('#c2Ad').value,remColor:md.querySelector('#c2Rm').value,layer:md.querySelector('#c2L').checked};
  LS.set('pm:b2:cmp',Object.assign({},o,{file:undefined,region:false}));setTimeout(()=>runCompare2(o),0)}}])}
async function runCompare2(o){try{let region=null;if(o.region){const r=await PMAuto.pickRegion('Compare: pick the area to compare');region=r.box;o.a=r.page}
 toast('Comparing…');const other=await pdfjsOpen(new Uint8Array(await o.file.arrayBuffer())),bn=Math.min(o.b,other.numPages);
 const r=await compareCore(S.pdf,o.a,other,bn,Object.assign({},o,{region}));other.destroy();const ms=[];
 for(const b of r.boxes){const st=Object.assign({},S.defaults.cloud,{stroke:o.cloud,fill:'none'});const m=newMarkup('cloud',o.a,[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],st);m.subject='Compare: change';m.comment=`vs ${o.file.name} p${bn}${r.M?' (auto-aligned)':''}`;ms.push(m)}
 if(ms.length){pushUndo();S.markups.push(...ms);commit()}
 if(o.layer){const c=document.createElement('canvas');c.width=r.W;c.height=r.Hh;c.getContext('2d').putImageData(r.img,0,0);addLayer2({kind:'diff',name:'Compare: '+o.file.name,page:o.a,url:await blobUrl(c),opacity:.9,note:'colors: added / removed',blend:true})}
 gotoPage(o.a);toast(ms.length?`Found ${ms.length} changed area${ms.length>1?'s':''}${r.M?` (aligned: shift ${r.M[4].toFixed(1)}, ${r.M[5].toFixed(1)} pt, scale ${r.M[0].toFixed(3)})`:''}`:(r.changed?'Only tiny differences found':'No differences found'));return r}
 catch(e){console.error(e);toast('Compare failed: '+(e.message||e))}}
/* ---------- overlay layers: add, 3-point align, auto align, multi-overlay, layered PDF ---------- */
function addLayer2(o){const L=Object.assign({id:uid(),visible:true,opacity:.85,matrix:[1,0,0,1,0,0],blend:true},o);S.layers.push(L);renderLayersPane();redrawPage(L.page);switchTab('layers');return L}
function renderLayersPane(){const pane=$('#pane-layers');if(!pane)return;const tint=S.pages.some(p=>p.el.classList.contains('tint'));
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" id="lyOv">+ Overlay</button><button class="btn" style="border:1px solid var(--line)" id="lyCmp">Compare</button></div>
 <label class="chk" style="margin-bottom:6px"><input type="checkbox" id="lyTint" ${tint?'checked':''}> Show current sheets in red</label>
 <div class="row" style="gap:10px;margin-bottom:8px"><label class="chk"><input type="checkbox" id="alScale" checked> Align scale</label><label class="chk"><input type="checkbox" id="alRot" checked> Align rotation</label></div>
 ${S.layers.length?'':'<div class="hint">No layers yet.</div>'}
 ${S.layers.map(L=>`<div style="border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:8px" data-l="${L.id}"><div class="row" style="gap:6px"><label class="chk" style="flex:1;min-width:0"><input type="checkbox" data-lv ${L.visible?'checked':''}><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(L.name)}</span></label>${L.color?`<input type="color" data-lc value="${L.color}" style="width:34px;flex:0;height:24px">`:''}<button class="btn" data-lx title="Remove" style="flex:0;padding:0 6px">✕</button></div>
  <div class="hint" style="margin:3px 0">Page ${L.page}${L.note?' · '+esc(L.note):''}</div><input type="range" min="5" max="100" value="${Math.round(L.opacity*100)}" data-lo>
  ${L.kind==='overlay'?`<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" data-la>Align…</button><button class="btn" style="border:1px solid var(--line)" data-lr>Reset</button><span class="hint" style="flex:1">Nudge:</span><button class="btn" data-ln="-1,0">←</button><button class="btn" data-ln="1,0">→</button><button class="btn" data-ln="0,-1">↑</button><button class="btn" data-ln="0,1">↓</button></div>`:''}</div>`).join('')}`;
 const ov=(H.ribbon.find(r=>r.label==='Overlay')||{}).fn,cp=(H.ribbon.find(r=>r.label==='Compare')||{}).fn;$('#lyOv').onclick=()=>ov&&ov();$('#lyCmp').onclick=()=>cp&&cp();
 $('#lyTint').onchange=e=>S.pages.forEach(p=>p.el.classList.toggle('tint',e.target.checked));decorateLayers()}
function decorateLayers(){const pane=$('#pane-layers');if(!pane||pane.__b2busy)return;pane.__b2busy=true;try{
 if(!pane.querySelector('#b2LyBar')&&pane.firstElementChild){const bar=document.createElement('div');bar.id='b2LyBar';bar.className='row';bar.style.cssText='gap:6px;margin-bottom:8px;flex-wrap:wrap';
  bar.innerHTML=`<button class="btn" style="border:1px solid var(--line)" id="b2Multi">Overlay several…</button><button class="btn" style="border:1px solid var(--line)" id="b2LPdf" ${S.layers.some(l=>l.page===S.cur&&l.kind==='overlay')?'':'disabled'}>Save layered PDF</button>`;pane.firstElementChild.after(bar);
  bar.querySelector('#b2Multi').onclick=multiOverlayDialog;bar.querySelector('#b2LPdf').onclick=saveLayeredCurrent}
 pane.querySelectorAll('[data-l]').forEach(box=>{const L=S.layers.find(x=>x.id===box.dataset.l);if(!L||L.kind!=='overlay'||box.querySelector('[data-b2a3]'))return;const r=document.createElement('div');r.className='row';r.style.cssText='gap:6px;margin-top:6px;flex-wrap:wrap';
  r.innerHTML=`<button class="btn" style="border:1px solid var(--line)" data-b2a3>3-point align</button><button class="btn" style="border:1px solid var(--line)" data-b2aa>Auto align</button>`;box.appendChild(r);
  r.querySelector('[data-b2a3]').onclick=()=>start3pt(L);r.querySelector('[data-b2aa]').onclick=()=>autoAlignLayer(L)})}finally{pane.__b2busy=false}}
async function autoAlignLayer(L){if(!L.src)return toast('This layer has no source image');toast('Aligning…');try{const p=S.pages[L.page-1],k=L.src.width/p.w;const A=await renderGray(S.pdf,L.page,k,L.src.width,L.src.height);
 const r=alignGray(grayOf(A.c),A.c.width,A.c.height,grayOf(L.src),L.src.width,L.src.height,k,{scale:true});L.matrix=r.m;redrawPage(L.page);toast(`Aligned: shift ${r.m[4].toFixed(1)}, ${r.m[5].toFixed(1)} pt · scale ${r.m[0].toFixed(3)}`);return r}catch(e){toast('Auto align failed: '+e.message)}}
let A3=null;const A3STEP=['point 1 on the CURRENT sheet','point 1 on the OVERLAY','point 2 on the CURRENT sheet','point 2 on the OVERLAY','point 3 on the CURRENT sheet','point 3 on the OVERLAY'];
function start3pt(L){if(S.tool!=='select')setTool('select');A3={L,pts:[]};gotoPage(L.page);$('#hint').textContent='3-point align: click '+A3STEP[0]+' (Esc cancels)';toast('Click 3 matching point pairs — spread them apart')}
H.down=(prev=>(e,p,pt)=>{if(A3&&p){if(p.num!==A3.L.page){toast('Click on page '+A3.L.page);return true}const q=sp(p,pt,e);A3.pts.push(q);redrawPage(p.num);
  if(A3.pts.length<6){$('#hint').textContent='3-point align: click '+A3STEP[A3.pts.length];return true}
  const P=[A3.pts[1],A3.pts[3],A3.pts[5]],Q=[A3.pts[0],A3.pts[2],A3.pts[4]],M=solveAffine(P,Q),L=A3.L;A3=null;updateRibbon();if(!M){toast('Points are in a line — pick spread-out points');redrawPage(p.num);return true}
  L.matrix=mulM(M,L.matrix);redrawPage(p.num);toast('Overlay aligned (3 points)');return true}
 return prev?prev(e,p,pt):false})(H.down);
H.over.push(n=>{if(!A3||A3.L.page!==n)return'';const r=6/S.zoom,w=1.5/S.zoom;return'<g pointer-events="none">'+A3.pts.map((q,i)=>{const c=i%2?'#0ea5e9':'#ef4444';return`<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/><text x="${q[0]+r*1.4}" y="${q[1]-r}" font-size="${11/S.zoom}" fill="${c}" font-weight="bold">${(i>>1)+1}${i%2?'′':''}</text>`}).join('')+'</g>'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&A3){const pg=A3.L.page;A3=null;updateRibbon();redrawPage(pg)}},true);
const PALETTE=['#1d4ed8','#16a34a','#d97706','#9333ea','#0891b2','#db2777','#65a30d','#b91c1c'];
function multiOverlayDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Overlay several drawings',`<div class="fld"><label>Drawings to overlay (PDF, one or more)</label><input type="file" id="moF" class="ti" multiple accept="application/pdf,.pdf"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">On page of this document</label><input class="ti" type="number" id="moA" value="${S.cur}"></div><div><label style="font-size:11px;color:var(--mut)">Page of each overlay</label><input class="ti" type="number" id="moB" value="${S.cur}"></div></div>
 <label class="chk fld"><input type="checkbox" id="moAl" checked> Auto-align each overlay</label><label class="chk fld"><input type="checkbox" id="moT" checked> Show this sheet in red</label><div class="hint">Each overlay gets its own color (change it in the Layers panel).</div>`,
 [{label:'Cancel',cancel:1},{label:'Add overlays',pri:1,fn:md=>{const fs=[...md.querySelector('#moF').files];if(!fs.length){toast('Choose PDFs');return false}const o={files:fs,a:clamp(+md.querySelector('#moA').value||1,1,S.pages.length),b:Math.max(1,+md.querySelector('#moB').value||1),align:md.querySelector('#moAl').checked,tint:md.querySelector('#moT').checked};setTimeout(()=>multiOverlay(o),0)}}])}
async function overlayLayerFrom(bytes,name,a,b,color,align){const p=S.pages[a-1],k=Math.min(2.2,Math.sqrt(9e6/(p.w*p.h))),W=Math.round(p.w*k),Hh=Math.round(p.h*k),doc=await pdfjsOpen(bytes),bn=Math.min(b,doc.numPages);
 const r=await renderGray(doc,bn,k,W,Hh);let M=[1,0,0,1,0,0];if(align)M=(await autoAlignPages(S.pdf,a,doc,bn,{scale:true})).m;doc.destroy();
 const src=document.createElement('canvas');src.width=W;src.height=Hh;src.getContext('2d').drawImage(r.c,0,0);const rc=recolorCanvas(r.c,color);
 return{kind:'overlay',name:name+' p'+bn,page:a,url:await blobUrl(rc),color,src,matrix:M}}
async function multiOverlay(o){const pg=progress('Overlaying');try{const used=S.layers.filter(l=>l.kind==='overlay').length;const added=[];
 for(let i=0;i<o.files.length;i++){if(pg.cancelled)break;const f=o.files[i];pg.msg('Adding '+f.name);pg.bar(i/o.files.length);const L=await overlayLayerFrom(new Uint8Array(await f.arrayBuffer()),f.name,o.a,o.b,PALETTE[(used+i)%PALETTE.length],o.align);S.layers.push(Object.assign({id:uid(),visible:true,opacity:.85,blend:true},L));added.push(L);pg.log(`${f.name}: ${o.align?`aligned (shift ${L.matrix[4].toFixed(1)}, ${L.matrix[5].toFixed(1)} pt, scale ${L.matrix[0].toFixed(3)})`:'added'}`)}
 pg.done();if(o.tint)S.pages.forEach(p=>p.el.classList.add('tint'));renderLayersPane();redrawPage(o.a);gotoPage(o.a);switchTab('layers');toast(`Added ${added.length} overlay${added.length>1?'s':''}`)}catch(e){pg.done();console.error(e);toast('Overlay failed: '+e.message)}}
/* layered PDF: base page (vector) + each raster layer in its own optional-content group */
async function layeredPdf(baseBytes,pageIdx,layers,o={}){const{PDFDocument,PDFName,PDFString,PDFOperator,PDFOperatorNames,pushGraphicsState,popGraphicsState,concatTransformationMatrix,drawObject}=PDFLib;
 const src=await PDFDocument.load(baseBytes,{ignoreEncryption:true}),sp=src.getPage(pageIdx),[W,Hh]=viewSize(sp),rot=rotOf(sp),bb=boxOf(sp);
 const out=await PDFDocument.create(),pg=out.addPage([W,Hh]),ctx=out.context,ocgs=[];const mkOcg=(name,on)=>{const ref=ctx.register(ctx.obj({Type:'OCG',Name:PDFString.of(name)}));ocgs.push({ref,on,name});return ref};
 const props={};const res=pg.node.Resources();const bdc=tag=>PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence,[PDFName.of('OC'),PDFName.of(tag)]),emc=()=>PDFOperator.of(PDFOperatorNames.EndMarkedContent);
 if(o.base!==false){const r=mkOcg(o.baseName||'Base drawing',true);props.oc0=r;const emb=await out.embedPage(sp,{left:bb[0],bottom:bb[1],right:bb[2],top:bb[3]});pg.pushOperators(bdc('oc0'));place(pg,emb,rot,bb[2]-bb[0],bb[3]-bb[1],1,0,0);pg.pushOperators(emc())}
 if(o.tintBase){/* nothing extra: base stays vector */}
 let i=1;for(const L of layers){const tag='oc'+i++,r=mkOcg(L.name,L.visible!==false);props[tag]=r;const png=await out.embedPng(L.png),M=L.matrix||[1,0,0,1,0,0],[a,b,c,d,e,f]=M;
  const nm=pg.node.newXObject('Im',png.ref);pg.pushOperators(bdc(tag),pushGraphicsState(),PDFLib.setGraphicsState(pg.node.newExtGState('GS',ctx.obj({Type:'ExtGState',ca:L.opacity??.85,CA:L.opacity??.85,BM:"Multiply"}))),
   concatTransformationMatrix(a*W,-b*W,-c*Hh,d*Hh,c*Hh+e,Hh-d*Hh-f),drawObject(nm),popGraphicsState(),emc())}
 res.set(PDFName.of('Properties'),ctx.obj(props));
 out.catalog.set(PDFName.of('OCProperties'),ctx.obj({OCGs:ocgs.map(x=>x.ref),D:{Name:PDFString.of('Layers'),Order:ocgs.map(x=>x.ref),ON:ocgs.filter(x=>x.on).map(x=>x.ref),OFF:ocgs.filter(x=>!x.on).map(x=>x.ref)}}));
 return new Uint8Array(await out.save())}
async function saveLayeredCurrent(){const ls=S.layers.filter(l=>l.page===S.cur&&(l.kind==='overlay'||l.kind==='diff'));if(!ls.length)return toast('No overlays on this page');toast('Building layered PDF…');
 try{const arr=[];for(const L of ls){const im=await fetch(L.url).then(r=>r.blob());arr.push({name:L.name,png:new Uint8Array(await im.arrayBuffer()),matrix:L.matrix,opacity:L.opacity,visible:L.visible})}
  const b=await layeredPdf(S.bytes,S.cur-1,arr,{baseName:S.fileName+' p'+S.cur});await saveFile(baseName()+'-overlay-p'+S.cur+'.pdf',new Blob([b],{type:'application/pdf'}));return b}catch(e){console.error(e);toast('Layered PDF failed: '+e.message)}}
/* ---------- batch compare / overlay (pairs of files) ---------- */
const normName=n=>stem(n).toLowerCase().replace(/\s*\(\d+\)$/,'').replace(/[\s_.-]*(rev|r|v|revision)[\s_.-]*[0-9a-z]{1,3}$/i,'').replace(/[\s_.-]+/g,' ').trim();
function pairFiles(A,B,mode){if(mode==='order')return A.map((a,i)=>[a,B[i]]).filter(p=>p[1]);const m=new Map(B.map(b=>[normName(b.name),b]));return A.map(a=>[a,m.get(normName(a.name))]).filter(p=>p[1])}
function batchCompareDialog(){let LA=[],LB=[];const draw=()=>{$('#bcA').innerHTML=LA.map(f=>`<div>${esc(f.name)}</div>`).join('')||'<span class="hint">none</span>';$('#bcB').innerHTML=LB.map(f=>`<div>${esc(f.name)}</div>`).join('')||'<span class="hint">none</span>'};
 modal('Batch compare / overlay',`<div class="row" style="gap:10px;align-items:flex-start"><div><b>Older revisions</b><br><button class="btn" id="bcAA" style="border:1px solid var(--line);margin:4px 0">Add…</button><div id="bcA" style="font-size:12px;max-height:110px;overflow:auto"></div></div><div><b>Newer revisions</b><br><button class="btn" id="bcBB" style="border:1px solid var(--line);margin:4px 0">Add…</button><div id="bcB" style="font-size:12px;max-height:110px;overflow:auto"></div></div></div>
 <div class="row fld" style="margin-top:8px"><div><label style="font-size:11px;color:var(--mut)">Pair files by</label><select class="ti" id="bcP"><option value="name">File name (ignores rev suffixes)</option><option value="order">List order</option></select></div><div><label style="font-size:11px;color:var(--mut)">Make</label><select class="ti" id="bcM"><option value="compare">Compare (cloud changes)</option><option value="overlay">Overlay (layered PDF)</option></select></div></div>
 <div class="row fld"><label class="chk"><input type="checkbox" id="bcAl" checked> Auto-align</label><label class="chk"><input type="checkbox" id="bcTx"> Ignore text-only</label><select class="ti" id="bcS" style="max-width:120px"><option value="2">High</option><option value="5" selected>Normal</option><option value="12">Low</option></select></div>`,
 [{label:'Cancel',cancel:1},{label:'Run',pri:1,fn:md=>{const pairs=pairFiles(LA,LB,md.querySelector('#bcP').value);if(!pairs.length){toast('No matching pairs');return false}const o={mode:md.querySelector('#bcM').value,align:md.querySelector('#bcAl').checked,ignoreText:md.querySelector('#bcTx').checked,sens:+md.querySelector('#bcS').value};setTimeout(()=>runBatchCompare(pairs,o),0)}}]);
 draw();$('#bcAA').onclick=async()=>{for(const f of await pickFiles('application/pdf,.pdf',true))LA.push({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())});draw()};$('#bcBB').onclick=async()=>{for(const f of await pickFiles('application/pdf,.pdf',true))LB.push({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())});draw()}}
async function runBatchCompare(pairs,o){const pg=progress(o.mode==='compare'?'Batch compare':'Batch overlay'),out=[];
 try{for(let i=0;i<pairs.length;i++){if(pg.cancelled)break;const[a,b]=pairs[i];pg.msg(`${a.name} ↔ ${b.name}`);pg.bar(i/pairs.length);const pA=await pdfjsOpen(b.bytes),pB=await pdfjsOpen(a.bytes),n=Math.min(pA.numPages,pB.numPages);
   if(o.mode==='compare'){const doc=await loadDoc(b.bytes),pages=doc.getPages(),font=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);let tot=0;
    for(let k=1;k<=n;k++){if(pg.cancelled)break;const r=await compareCore(pA,k,pB,k,o),vp=(await pA.getPage(k)).getViewport({scale:1});tot+=r.boxes.length;
     for(const bx of r.boxes){const d=dCloud([[bx[0],bx[1]],[bx[2],bx[1]],[bx[2],bx[3]],[bx[0],bx[3]]],9);pages[k-1].drawSvgPath(xfPath(d,vp),{x:0,y:0,borderColor:PDFLib.rgb(.88,.19,.17),borderWidth:2})}
     if(r.boxes.length){const[px,py]=vp.convertToPdfPoint(20,20);pages[k-1].drawText(`${r.boxes.length} change(s) vs ${safeTxt(a.name)}`,{x:px,y:py-10,size:10,font,color:PDFLib.rgb(.88,.19,.17),rotate:PDFLib.degrees(vp.rotation||0)})}}
    out.push({name:stem(b.name)+'-compare.pdf',bytes:await saved(doc)});pg.log(`${b.name}: ${tot} changed area(s)`)}
   else{const merged=await PDFLib.PDFDocument.create();for(let k=1;k<=n;k++){const vp=(await pA.getPage(k)).getViewport({scale:1}),kk=Math.min(2,Math.sqrt(9e6/(vp.width*vp.height))),W=Math.round(vp.width*kk),Hh=Math.round(vp.height*kk);
     const M=o.align?(await autoAlignPages(pA,k,pB,k,{scale:true})).m:[1,0,0,1,0,0];const ra=await renderGray(pA,k,kk,W,Hh),rb=await renderGray(pB,k,kk,W,Hh);
     const bytes=await layeredPdf(b.bytes,k-1,[{name:'Older: '+a.name,png:await pngBytes(recolorCanvas(rb.c,'#e61e1e')),matrix:M,opacity:.85},{name:'Newer: '+b.name,png:await pngBytes(recolorCanvas(ra.c,'#1d4ed8')),matrix:[1,0,0,1,0,0],opacity:.85}],{baseName:'Newer (original colors)'});
     const part=await loadDoc(bytes);if(k===1){/* keep layers from the first page's document */}const[cp]=await merged.copyPages(part,[0]);merged.addPage(cp);
     if(k===1){const oc=part.catalog.get(PDFLib.PDFName.of('OCProperties'));if(oc){/* copy OCG config: refs were copied with the page resources */}}}
    // rebuild OCProperties from the copied pages' resources
    const ocgRefs=new Set();merged.getPages().forEach(p=>{const pr=p.node.Resources().get(PDFLib.PDFName.of('Properties'));if(pr)for(const[,v]of pr.entries())ocgRefs.add(v)});const refs=[...ocgRefs];
    merged.catalog.set(PDFLib.PDFName.of('OCProperties'),merged.context.obj({OCGs:refs,D:{Name:PDFLib.PDFString.of('Layers'),Order:refs,ON:refs}}));
    out.push({name:stem(b.name)+'-overlay.pdf',bytes:await saved(merged)});pg.log(`${b.name}: overlay of ${n} page(s)`)}
   pA.destroy();pB.destroy()}
  pg.done();if(out.length)await deliver(out,'batch-'+o.mode+'.zip');return out}catch(e){console.error(e);pg.done();toast('Batch '+o.mode+' failed: '+e.message);return[]}}
/* ---------- printing depth ---------- */
/* content bytes for print/export: 'both' | 'doc' | 'markups'; dim (0..0.9) washes the drawing so markups stand out */
async function contentBytes(o,srcBytes,markups,scales){srcBytes=srcBytes||S.bytes;markups=markups||S.markups;scales=scales||S.scales;
 const base=o.content==='markups'?await blankClone(srcBytes):srcBytes;if(o.content==='doc'&&!o.dim)return base;
 const vps=await viewportsOf(base),doc=await PDFLib.PDFDocument.load(base,{ignoreEncryption:true});
 if(o.dim&&o.content!=='markups')for(const p of doc.getPages()){const mb=p.getMediaBox();p.drawRectangle({x:mb.x,y:mb.y,width:mb.width,height:mb.height,color:PDFLib.rgb(1,1,1),opacity:Math.min(.9,+o.dim)})}
 if(o.content!=='doc')await drawMarkups(doc,vps,markups,scales,{links:!!o.links,popups:!!o.popups,pages:o.pages?new Set(o.pages):undefined});
 return new Uint8Array(await doc.save())}
function gridOf(n,land){const g={1:[1,1],2:[2,1],4:[2,2],6:[3,2],9:[3,3],16:[4,4]}[n]||[1,1];return land?g:[g[1],g[0]]}
/* lay pages out on sheets: N-up, paper, orientation, auto-rotate, fit/actual/%, center/offset, borders, order */
async function layoutPrint(bytes,pages,o){const src=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true}),out=await PDFLib.PDFDocument.create();const N=+o.nup||1;
 const info=pages.map(n=>{const p=src.getPage(n-1),[w,h]=viewSize(p);return{n,p,w,h,rot:rotOf(p),bb:boxOf(p)}});if(!info.length)throw new Error('No pages selected');
 let sheet=null,cols=1,rows=1,pw=0,ph=0;const m=N>1?18:(o.paper==='auto'?0:18),gap=N>1?8:0;const embs=new Map();
 for(let i=0;i<info.length;i++){const it=info[i];const slot=i%N;
  if(slot===0){// new sheet: paper decided by the first page on it
   const cl=it.w>it.h,autoLand=N===2?!cl:cl,land=o.orient==='l'||(o.orient==='auto'&&autoLand);
   if(o.paper==='auto'){pw=it.w;ph=it.h;if(N>1||o.orient!=='auto'){if(land!==(pw>ph))[pw,ph]=[ph,pw]}}
   else{const[a,b]=PAPERS[o.paper]||PAPERS.Letter;pw=a*72;ph=b*72;if(land!==(pw>ph))[pw,ph]=[ph,pw]}
   [cols,rows]=gridOf(N,pw>=ph);sheet=out.addPage([pw,ph])}
  const cw=(pw-2*m-gap*(cols-1))/cols,ch=(ph-2*m-gap*(rows-1))/rows;let col,row;if(o.order==='v'){row=slot%rows;col=(slot/rows)|0}else{col=slot%cols;row=(slot/cols)|0}
  const cx=m+col*(cw+gap),cy=m+row*(ch+gap);let rot=it.rot,vw=it.w,vh=it.h;
  if(o.autoRotate&&Math.abs(vw-vh)>1&&((cw>ch)!==(vw>vh))){rot=(rot+90)%360;[vw,vh]=[vh,vw]}
  let sx=1;if(o.scale==='fit'||N>1)sx=Math.min(cw/vw,ch/vh);else if(o.scale==='pct')sx=(+o.pct||100)/100;if(N>1&&o.scale==='pct')sx=Math.min(sx,cw/vw,ch/vh);
  let dx=cx+(o.center!==false?(cw-vw*sx)/2:0)+(+o.offX||0)*72,dy=cy+(o.center!==false?(ch-vh*sx)/2:0)+(+o.offY||0)*72;
  let emb=embs.get(it.n);if(!emb){emb=await out.embedPage(it.p,{left:it.bb[0],bottom:it.bb[1],right:it.bb[2],top:it.bb[3]});embs.set(it.n,emb)}
  place(sheet,emb,rot,vw,vh,sx,dx,dy);
  if(o.borders&&N>1)sheet.drawRectangle({x:cx,y:ph-cy-ch,width:cw,height:ch,borderColor:PDFLib.rgb(.45,.45,.45),borderWidth:.6});
  sheet.__cells=(sheet.__cells||[]).concat([{n:it.n,cell:[cx,cy,cw,ch],placed:[dx,dy,vw*sx,vh*sx],rot}])}
 const meta=out.getPages().map(p=>p.__cells);return{bytes:new Uint8Array(await out.save()),meta}}
async function rasterizePdf(bytes,o){const d=await pdfjsOpen(bytes),out=await PDFLib.PDFDocument.create();
 for(let i=1;i<=d.numPages;i++){const pg=await d.getPage(i),v1=pg.getViewport({scale:1}),k=Math.min((o.dpi||150)/72,Math.sqrt(60e6/(v1.width*v1.height))),c=await pageCanvas(pg,k,o.gray);
  const jpg=await new Promise(r=>c.toBlob(async b=>r(new Uint8Array(await b.arrayBuffer())),'image/jpeg',.9)),im=await out.embedJpg(jpg),p=out.addPage([v1.width,v1.height]);p.drawImage(im,{x:0,y:0,width:v1.width,height:v1.height})}
 d.destroy();return new Uint8Array(await out.save())}
async function pageCanvas(pg,k,gray){const vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,Math.round(vp.height));const ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp,background:'white'}).promise;
 if(gray){const id=ctx.getImageData(0,0,c.width,c.height),d=id.data;for(let j=0;j<d.length;j+=4){const l=d[j]*.299+d[j+1]*.587+d[j+2]*.114;d[j]=d[j+1]=d[j+2]=l}ctx.putImageData(id,0,0)}return c}
async function buildPrint(o){o=Object.assign({},PRINT_DEF,o);const N=S.pages.length;let pages;
 if(o.pages==='cur')pages=[S.cur];else if(o.pages==='all')pages=S.pages.map(p=>p.num);else if(o.pages==='set')pages=o.setPages||[];else pages=parseRangeN(o.rng,N);
 if(o.reverse)pages=pages.slice().reverse();if(!pages.length)throw new Error('No pages selected');
 const cb=await contentBytes(Object.assign({},o,{pages}));let r=await layoutPrint(cb,pages,o);
 if(o.raster||o.gray)r.bytes=await rasterizePdf(r.bytes,{dpi:o.dpi||150,gray:o.gray});return r}
const PRINT_DEF={pages:'cur',content:'both',paper:'auto',orient:'auto',scale:'fit',pct:100,nup:1,order:'h',borders:true,autoRotate:true,center:true,offX:0,offY:0,dim:0,links:false,popups:false,dpi:300,gray:false,raster:false,reverse:false};
function printDialog2(preset){if(!S.pages.length)return toast('Open a PDF first');const o=Object.assign({},PRINT_DEF,LS.get('pm:b2:print',{}),preset||{});const dv=!!(window.pmDesktop&&window.pmDesktop.printImages);const sel=(v,a)=>a.map(([k,l])=>`<option value="${k}" ${String(v)===String(k)?'selected':''}>${l}</option>`).join('');
 const L=(t,h)=>`<div><label style="font-size:11px;color:var(--mut)">${t}</label>${h}</div>`;
 modal('Print',`<div class="row fld">${L('Pages',`<select class="ti" id="p2P">${sel(o.pages==='set'?'cur':o.pages,[['cur',`Current page (${S.cur})`],['all',`All pages (${S.pages.length})`],['rng','Range…'],['region','Region of current page…'],['tile','Tile current page…']])}</select>`)}${L('Range',`<input class="ti" id="p2R" value="${esc(o.rng||'')}" placeholder="1-3, 7">`)}</div>
 <div class="row fld">${L('Content',`<select class="ti" id="p2C">${sel(o.content,[['both','Document and markups'],['doc','Document only'],['markups','Markups only']])}</select>`)}${L('Pages per sheet',`<select class="ti" id="p2N">${sel(o.nup,[[1,'1'],[2,'2'],[4,'4'],[6,'6'],[9,'9'],[16,'16']])}</select>`)}</div>
 <div class="row fld">${L('Page order',`<select class="ti" id="p2O">${sel(o.order,[['h','Across, then down'],['v','Down, then across']])}</select>`)}<label class="chk" style="margin-top:16px"><input type="checkbox" id="p2B" ${o.borders?'checked':''}> Page borders</label></div>
 <div class="row fld">${L('Paper',`<select class="ti" id="p2Pa"><option value="auto">Auto (same as drawing)</option>${Object.keys(PAPERS).map(k=>`<option ${o.paper===k?'selected':''}>${k}</option>`).join('')}</select>`)}${L('Orientation',`<select class="ti" id="p2Or">${sel(o.orient,[['auto','Auto'],['p','Portrait'],['l','Landscape']])}</select>`)}</div>
 <div class="row fld">${L('Scaling',`<select class="ti" id="p2S">${sel(o.scale,[['fit','Fit to paper'],['actual','Actual size'],['pct','Custom %']])}</select>`)}${L('%',`<input class="ti" type="number" id="p2Pc" value="${o.pct}">`)}</div>
 <div class="row fld"><label class="chk"><input type="checkbox" id="p2AR" ${o.autoRotate?'checked':''}> Auto-rotate</label><label class="chk"><input type="checkbox" id="p2Ce" ${o.center?'checked':''}> Center</label>${L('Offset X (in)',`<input class="ti" type="number" step="0.05" id="p2X" value="${o.offX}">`)}${L('Offset Y (in)',`<input class="ti" type="number" step="0.05" id="p2Y" value="${o.offY}">`)}</div>
 <div class="row fld">${L('Dim document',`<select class="ti" id="p2D">${sel(o.dim,[[0,'Off'],[.3,'30%'],[.5,'50%'],[.7,'70%']])}</select>`)}${L('Max DPI',`<select class="ti" id="p2Dp">${sel(o.dpi,[[150,'150'],[200,'200'],[300,'300'],[600,'600']])}</select>`)}</div>
 <div class="row fld" style="flex-wrap:wrap"><label class="chk"><input type="checkbox" id="p2L" ${o.links?'checked':''}> Print hyperlink boxes</label><label class="chk"><input type="checkbox" id="p2Po" ${o.popups?'checked':''}> Print pop-up notes</label><label class="chk"><input type="checkbox" id="p2G" ${o.gray?'checked':''}> Grayscale</label><label class="chk"><input type="checkbox" id="p2Ra" ${o.raster?'checked':''}> Print as image</label><label class="chk"><input type="checkbox" id="p2Rv" ${o.reverse?'checked':''}> Reverse order</label></div>
 <div class="hint">${dv?'Sends to the Windows print dialog.':'Browser version: makes a print-ready PDF. The Windows app prints directly.'} Tile and region printing use the classic print engine.</div>`,
 [{label:'Cancel',cancel:1},{label:'Export images…',fn:md=>{const v=readPrint(md);setTimeout(()=>exportImagesDialog({pages:v.pages,rng:v.rng,content:v.content,dpi:v.dpi,gray:v.gray}),0)}},{label:dv?'Print…':'Make print PDF',pri:1,fn:md=>{const v=readPrint(md);LS.set('pm:b2:print',Object.assign({},v,{rng:''}));
  if(v.pages==='region'||v.pages==='tile'){const P=window.PMOutput&&PMOutput.runPrint;if(P)setTimeout(()=>P({pages:v.pages==='tile'?'cur':'region',rng:'',paper:v.paper==='auto'&&v.pages==='tile'?'Letter':v.paper,orient:v.orient,scale:v.pages==='tile'?'tile':v.scale,pct:v.pct,marks:v.content!=='doc',gray:v.gray,crop:true}),0);return}
  setTimeout(()=>runPrint2(v),0)}}])}
function readPrint(md){const q=s=>md.querySelector(s);return Object.assign({},PRINT_DEF,{pages:q('#p2P').value,rng:q('#p2R').value,content:q('#p2C').value,nup:+q('#p2N').value,order:q('#p2O').value,borders:q('#p2B').checked,paper:q('#p2Pa').value,orient:q('#p2Or').value,scale:q('#p2S').value,pct:+q('#p2Pc').value||100,autoRotate:q('#p2AR').checked,center:q('#p2Ce').checked,offX:+q('#p2X').value||0,offY:+q('#p2Y').value||0,dim:+q('#p2D').value,dpi:+q('#p2Dp').value,links:q('#p2L').checked,popups:q('#p2Po').checked,gray:q('#p2G').checked,raster:q('#p2Ra').checked,reverse:q('#p2Rv').checked})}
async function runPrint2(o){try{toast('Preparing pages…');const r=await buildPrint(o);B2.lastPrint=r;await printBytes(r.bytes,{dpi:o.dpi,gray:o.gray,name:(o.name||baseName())+'-print'});return r}catch(e){console.error(e);toast('Print failed: '+(e.message||e))}}
/* ---------- export pages as PNG / JPEG / TIFF ---------- */
function packBits(src,off,len,out){let i=0;while(i<len){let run=1;while(i+run<len&&run<128&&src[off+i+run]===src[off+i])run++;
  if(run>=3){out.push((257-run)&255,src[off+i]);i+=run;continue}let j=i,lit=0;while(j<len&&lit<128){let r=1;while(j+r<len&&r<3&&src[off+j+r]===src[off+j])r++;if(r>=3)break;j++;lit++}
  out.push(lit-1);for(let k=0;k<lit;k++)out.push(src[off+i+k]);i+=lit}}
/* TIFF writer (little-endian, baseline): pages = [{w,h,data:Uint8ClampedArray RGBA,dpi,gray}] ; PackBits or none */
function encodeTiff(pages,o={}){const comp=o.compress===false?1:32773,chunks=[];let pos=8;const head=new Uint8Array(8);head.set([0x49,0x49,42,0]);chunks.push(head);const ifdPatch=[];
 const u32=v=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v,true);return b};let prevNext=4;// offset where "next IFD" pointer lives (header first)
 const patches=[];
 for(const pg of pages){const spp=pg.gray?1:3,rowBytes=pg.w*spp,rps=Math.max(1,Math.min(pg.h,Math.floor(65536/rowBytes)||1)),strips=Math.ceil(pg.h/rps),offs=[],cnts=[];
  const row=new Uint8Array(rowBytes);
  for(let s=0;s<strips;s++){const parts=[];const y0=s*rps,y1=Math.min(pg.h,y0+rps);
   for(let y=y0;y<y1;y++){for(let x=0;x<pg.w;x++){const j=(y*pg.w+x)*4;if(spp===1)row[x]=Math.round(pg.data[j]*.299+pg.data[j+1]*.587+pg.data[j+2]*.114);else{row[x*3]=pg.data[j];row[x*3+1]=pg.data[j+1];row[x*3+2]=pg.data[j+2]}}
    if(comp===1)parts.push(...row);else packBits(row,0,rowBytes,parts)}
   const b=new Uint8Array(parts);offs.push(pos);cnts.push(b.length);chunks.push(b);pos+=b.length;if(pos&1){chunks.push(new Uint8Array(1));pos++}}
  // extra data: bits-per-sample, strip arrays, resolution
  const ext=[];const extOff={};const addExt=(k,bytes)=>{extOff[k]=pos;chunks.push(bytes);pos+=bytes.length;if(pos&1){chunks.push(new Uint8Array(1));pos++}};
  if(spp===3){const b=new Uint8Array(6);const dv=new DataView(b.buffer);dv.setUint16(0,8,true);dv.setUint16(2,8,true);dv.setUint16(4,8,true);addExt('bps',b)}
  if(strips>1){const a=new Uint8Array(strips*4),c=new Uint8Array(strips*4),da=new DataView(a.buffer),dc=new DataView(c.buffer);offs.forEach((v,i)=>da.setUint32(i*4,v,true));cnts.forEach((v,i)=>dc.setUint32(i*4,v,true));addExt('so',a);addExt('sc',c)}
  const res=new Uint8Array(8),dr=new DataView(res.buffer);dr.setUint32(0,Math.round(pg.dpi||150),true);dr.setUint32(4,1,true);addExt('res',res);
  const E=[[256,4,1,pg.w],[257,4,1,pg.h],[258,3,spp,spp===3?extOff.bps:8],[259,3,1,comp],[262,3,1,spp===3?2:1],[273,4,strips,strips>1?extOff.so:offs[0]],[277,3,1,spp],[278,4,1,rps],[279,4,strips,strips>1?extOff.sc:cnts[0]],[282,5,1,extOff.res],[283,5,1,extOff.res],[284,3,1,1],[296,3,1,2]];
  const ifd=new Uint8Array(2+E.length*12+4),dv=new DataView(ifd.buffer);dv.setUint16(0,E.length,true);E.forEach(([tag,type,count,val],i)=>{const o2=2+i*12;dv.setUint16(o2,tag,true);dv.setUint16(o2+2,type,true);dv.setUint32(o2+4,count,true);if(type===3&&count===1)dv.setUint16(o2+8,val,true);else dv.setUint32(o2+8,val,true)});
  patches.push([prevNext,pos]);prevNext=pos+2+E.length*12;chunks.push(ifd);pos+=ifd.length}
 const all=cat(chunks),dv=new DataView(all.buffer,all.byteOffset);for(const[at,v]of patches)dv.setUint32(at,v,true);return all}
async function exportImages(o){const N=S.pages.length;let pages=o.pages==='cur'?[S.cur]:o.pages==='all'?S.pages.map(p=>p.num):o.pages==='set'?(o.setPages||[]):parseRangeN(o.rng,N);if(!pages.length)throw new Error('No pages selected');
 const cb=await contentBytes(Object.assign({},o,{pages})),d=await pdfjsOpen(cb),files=[],tif=[],pg=progress('Exporting images');
 try{for(let i=0;i<pages.length;i++){if(pg.cancelled)break;pg.msg('Page '+pages[i]);pg.bar(i/pages.length);const p=await d.getPage(pages[i]),v1=p.getViewport({scale:1}),k=Math.min((o.dpi||150)/72,Math.sqrt(80e6/(v1.width*v1.height))),c=await pageCanvas(p,k,o.gray);const nm=baseName()+'-p'+pages[i];
   if(o.fmt==='tiff'){const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const t={w:c.width,h:c.height,data,dpi:Math.round(k*72),gray:o.gray};if(o.multi)tif.push(t);else files.push({name:nm+'.tif',bytes:encodeTiff([t],{compress:o.compress!==false})})}
   else{const type=o.fmt==='jpeg'?'image/jpeg':'image/png';const b=await new Promise(r=>c.toBlob(async bl=>r(new Uint8Array(await bl.arrayBuffer())),type,(o.q||90)/100));files.push({name:nm+(o.fmt==='jpeg'?'.jpg':'.png'),bytes:o.fmt==='png'?pngDpi(b,k*72):b})}}
  if(tif.length)files.push({name:baseName()+'.tif',bytes:encodeTiff(tif,{compress:o.compress!==false})})}finally{d.destroy();pg.done()}
 if(files.length)await deliver(files,baseName()+'-images.zip');return files}
function crc32(u8){let c,crc=0xFFFFFFFF;const T=crc32.t||(crc32.t=Array.from({length:256},(_,n)=>{c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0}));for(let i=0;i<u8.length;i++)crc=T[(crc^u8[i])&255]^(crc>>>8);return(crc^0xFFFFFFFF)>>>0}
function pngDpi(png,dpi){// insert a pHYs chunk after IHDR so the DPI travels with the image
 const ppm=Math.round(dpi/0.0254),ch=new Uint8Array(21),dv=new DataView(ch.buffer);dv.setUint32(0,9);ch.set([112,72,89,115],4);dv.setUint32(8,ppm);dv.setUint32(12,ppm);ch[16]=1;dv.setUint32(17,crc32(ch.subarray(4,17)));
 const at=8+25;return cat([png.subarray(0,at),ch,png.subarray(at)])}
function exportImagesDialog(preset){if(!S.pages.length)return toast('Open a PDF first');const o=Object.assign({pages:'cur',rng:'',content:'both',dpi:150,gray:false,fmt:'png',multi:true,q:90},preset||{});
 modal('Export pages as images',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Pages</label><select class="ti" id="eiP"><option value="cur" ${o.pages==='cur'?'selected':''}>Current page</option><option value="all" ${o.pages==='all'?'selected':''}>All pages</option><option value="rng" ${o.pages==='rng'?'selected':''}>Range</option></select></div><div><label style="font-size:11px;color:var(--mut)">Range</label><input class="ti" id="eiR" value="${esc(o.rng||'')}"></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Format</label><select class="ti" id="eiF"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="tiff">TIFF</option></select></div><div><label style="font-size:11px;color:var(--mut)">Resolution (DPI)</label><select class="ti" id="eiD"><option>72</option><option selected>150</option><option>200</option><option>300</option><option>600</option></select></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Content</label><select class="ti" id="eiC"><option value="both">Document and markups</option><option value="doc">Document only</option><option value="markups">Markups only</option></select></div><div><label style="font-size:11px;color:var(--mut)">JPEG quality</label><input class="ti" type="number" id="eiQ" value="90" min="10" max="100"></div></div>
 <div class="row fld"><label class="chk"><input type="checkbox" id="eiG" ${o.gray?'checked':''}> Grayscale</label><label class="chk"><input type="checkbox" id="eiM" checked> TIFF: all pages in one file</label></div>`,
 [{label:'Cancel',cancel:1},{label:'Export',pri:1,fn:md=>{const q=s=>md.querySelector(s);const v={pages:q('#eiP').value,rng:q('#eiR').value,fmt:q('#eiF').value,dpi:+q('#eiD').value,content:q('#eiC').value,q:+q('#eiQ').value||90,gray:q('#eiG').checked,multi:q('#eiM').checked};setTimeout(()=>exportImages(v).catch(e=>toast('Export failed: '+e.message)),0)}}]);
 $('#eiC').value=o.content;$('#eiD').value=String(o.dpi)}
/* Ctrl+P → new print dialog (window capture runs before output.js's document listener) */
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='p'){e.preventDefault();e.stopImmediatePropagation();if(!modalCb)printDialog2()}},true);
/* ---------- Sets depth: tags, auto-tag, sort/filter, revision stacking, set search, print set ---------- */
const SX={arr:null,view:LS.get('pm:b2:setview',{sort:'order',disc:'',stack:true}),docs:{}};
(()=>{const og=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(){const r=og.apply(this,arguments);try{if(this.name==='sets'&&this.transaction.db.name==='planmark-sets')r.addEventListener('success',()=>{SX.arr=r.result})}catch(e){}return r}})();
let sdb=null;const setDb=()=>sdb||(sdb=new Promise((res,rej)=>{const r=indexedDB.open('planmark-sets',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('files'))d.createObjectStore('files',{keyPath:'id'});if(!d.objectStoreNames.contains('sets'))d.createObjectStore('sets',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
const sTx=async(st,mode,fn)=>{const d=await setDb();return new Promise((res,rej)=>{const t=d.transaction(st,mode),r=fn(t.objectStore(st));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})};
function curSet2(){const id=LS.get('pm:set:cur',null),sel=$('#stSel'),sid=(sel&&sel.value)||id;return(SX.arr||[]).find(s=>s.id===sid)||(SX.arr||[])[0]||null}
async function saveSet2(s){s.modified=Date.now();await sTx('sets','readwrite',st=>st.put(s));rerenderSets()}
function rerenderSets(){const sel=$('#stSel');if(sel)sel.dispatchEvent(new Event('change'))}
async function setFile(id){return sTx('files','readonly',st=>st.get(id))}
async function setDoc(id){if(SX.docs[id])return SX.docs[id];const f=await setFile(id);if(!f)return null;return SX.docs[id]=await pdfjsOpen(new Uint8Array(f.bytes))}
const DISC={A:'Architectural',S:'Structural',M:'Mechanical',E:'Electrical',P:'Plumbing',C:'Civil',L:'Landscape',G:'General',T:'Telecom',I:'Interiors',FP:'Fire Protection',F:'Fire Protection',Q:'Equipment',V:'Survey',X:'Other'};
const discOf=num=>{const m=String(num||'').trim().toUpperCase().match(/^([A-Z]{1,2})/);if(!m)return'';return DISC[m[1]]||DISC[m[1][0]]||''};
const tagsOf=it=>it.tags||(it.tags={number:'',title:'',discipline:'',revision:'',date:'',custom:''});
function revKey(v){const s=String(v||'').trim();if(/^\d+$/.test(s))return[0,+s,''];return[1,0,s.toUpperCase()]}
function cmpRev(a,b){const x=revKey(a),y=revKey(b);return x[0]-y[0]||x[1]-y[1]||(x[2]<y[2]?-1:x[2]>y[2]?1:0)}
/* stacks: sheet number → items sorted oldest→newest (revision tag, then date, then the order added) */
function stacks(s){const m=new Map();s.items.forEach((it,i)=>{const t=tagsOf(it),k=(t.number||'').trim().toUpperCase()||('#'+i);if(!m.has(k))m.set(k,[]);m.get(k).push(i)});
 for(const v of m.values())v.sort((a,b)=>{const A=tagsOf(s.items[a]),B=tagsOf(s.items[b]);return(A.revision||B.revision)?cmpRev(A.revision,B.revision)||a-b:(A.date&&B.date&&A.date!==B.date?(Date.parse(A.date)||0)-(Date.parse(B.date)||0):a-b)});return m}
function latestIdx(s){const set=new Set();for(const v of stacks(s).values())set.add(v[v.length-1]);return set}
async function readRegion(it,r){const d=await setDoc(it.fileId);if(!d)return'';const pg=await d.getPage(it.page),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();const box=[r[0]*vp.width,r[1]*vp.height,r[2]*vp.width,r[3]*vp.height],hits=[];
 for(const t of tc.items){if(!t.str||!t.str.trim())continue;const[x,y]=vp.convertToViewportPoint(t.transform[4],t.transform[5]);if(x>=box[0]-2&&x<=box[2]+2&&y>=box[1]-2&&y<=box[3]+4)hits.push({s:t.str.trim(),x,y})}
 hits.sort((a,b)=>Math.abs(a.y-b.y)>3?a.y-b.y:a.x-b.x);return hits.map(h=>h.s).join(' ').replace(/\s+/g,' ').trim().slice(0,120)}
/* regions: {number,title,revision,date} each [x0,y0,x1,y1] as fractions of the page */
async function autoTag(regions,s){s=s||curSet2();if(!s)throw new Error('No set');let n=0;const pg=progress('Auto-tagging sheets');
 try{for(let i=0;i<s.items.length;i++){if(pg.cancelled)break;const it=s.items[i],t=tagsOf(it);pg.bar(i/s.items.length);pg.msg(it.file+' p'+it.page);let any=false;
   for(const k of['number','title','revision','date']){if(!regions[k])continue;const v=await readRegion(it,regions[k]);if(v){t[k]=k==='revision'?v.replace(/^(rev(ision)?\.?\s*)/i,''):v;any=true}}
   if(t.number&&!t.discipline)t.discipline=discOf(t.number);if(t.number){it.label=t.number+(t.title?' — '+t.title:'');}if(any)n++}
  // no revision region: number revisions by the order the files were added
  if(!regions.revision){const fo=[...new Set(s.items.map(i=>i.fileId))];for(const v of stacks(s).values())if(v.length>1)v.slice().sort((a,b)=>fo.indexOf(s.items[a].fileId)-fo.indexOf(s.items[b].fileId)||a-b).forEach((ix,j)=>{const t=tagsOf(s.items[ix]);if(!t.revision)t.revision=String(j)})}
 }finally{pg.done()}await saveSet2(s);toast(`Tagged ${n} of ${s.items.length} sheets`);return n}
async function autoTagDialog(){const s=curSet2();if(!s||!s.items.length)return toast('Add sheets to the set first');if(!S.pages.length)return toast('Open a sheet of this set first');
 const regions={};for(const[k,lab]of[['number','the SHEET NUMBER box'],['title','the SHEET TITLE box (Esc to skip)'],['revision','the REVISION box (Esc to skip)'],['date','the DATE box (Esc to skip)']]){
  const r=await Promise.race([PMAuto.pickRegion('Auto-tag: draw a box around '+lab),new Promise(res=>{const h=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',h,true);res(null)}};document.addEventListener('keydown',h,true)})]);
  if(!r){if(k==='number')return;continue}const p=S.pages[r.page-1];regions[k]=[r.box[0]/p.w,r.box[1]/p.h,r.box[2]/p.w,r.box[3]/p.h]}
 LS.set('pm:b2:tagregions',regions);return autoTag(regions,s)}
function editTagsDialog(){const s=curSet2();if(!s||!s.items.length)return toast('Add sheets to the set first');const F=['number','title','discipline','revision','date','custom'];
 modal('Edit tags — '+s.name,`<div class="row fld" style="gap:6px;flex-wrap:wrap"><span class="hint">Set on checked rows:</span><select class="ti" id="etF" style="max-width:120px">${F.map(f=>`<option>${f}</option>`).join('')}</select><input class="ti" id="etV" placeholder="value" style="max-width:140px"><button class="btn" id="etApply" style="border:1px solid var(--line)">Apply</button><label class="chk"><input type="checkbox" id="etAll"> all</label></div>
 <div style="max-height:52vh;overflow:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><tr><th></th><th>File · page</th>${F.map(f=>`<th style="text-align:left">${f}</th>`).join('')}</tr>
 ${s.items.map((it,i)=>{const t=tagsOf(it);return`<tr data-r="${i}"><td><input type="checkbox" data-ck></td><td style="white-space:nowrap">${esc(it.file)} · p${it.page}</td>${F.map(f=>`<td><input class="ti" data-f="${f}" value="${esc(t[f]||'')}" style="min-width:60px;padding:2px 4px"></td>`).join('')}</tr>`}).join('')}</table></div>
 <label class="chk fld"><input type="checkbox" id="etLab" checked> Update sheet labels from number — title</label>`,
 [{label:'Cancel',cancel:1},{label:'Save tags',pri:1,fn:md=>{md.querySelectorAll('tr[data-r]').forEach(tr=>{const it=s.items[+tr.dataset.r],t=tagsOf(it);tr.querySelectorAll('[data-f]').forEach(inp=>t[inp.dataset.f]=inp.value.trim());if(t.number&&!t.discipline)t.discipline=discOf(t.number);if(md.querySelector('#etLab').checked&&t.number)it.label=t.number+(t.title?' — '+t.title:'')});saveSet2(s);toast('Tags saved')}}]);
 $('#etAll').onchange=e=>$$('[data-ck]').forEach(c=>c.checked=e.target.checked);
 $('#etApply').onclick=()=>{const f=$('#etF').value,v=$('#etV').value;$$('tr[data-r]').forEach(tr=>{if(tr.querySelector('[data-ck]').checked)tr.querySelector(`[data-f="${f}"]`).value=v})}}
function openSetItem(i){const el=$(`#stList [data-i="${i}"]`);if(el){el.style.display='';el.click();return true}return false}
function decorateSets(){const pane=$('#pane-sets'),list=$('#stList'),s=curSet2();if(!pane||!list||!s||pane.__b2busy)return;pane.__b2busy=true;try{
 if(!pane.querySelector('#b2SetBar')){const bar=document.createElement('div');bar.id='b2SetBar';bar.style.cssText='margin-bottom:8px';
  const discs=[...new Set(s.items.map(i=>tagsOf(i).discipline).filter(Boolean))].sort();
  bar.innerHTML=`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px"><button class="btn" id="b2Tags" style="border:1px solid var(--line)">Edit tags…</button><button class="btn" id="b2AutoTag" style="border:1px solid var(--line)">Auto-tag…</button><button class="btn" id="b2SSearch" style="border:1px solid var(--line)">Search set…</button><button class="btn" id="b2PSet" style="border:1px solid var(--line)">Print set…</button></div>
  <div class="row" style="gap:4px"><select class="ti" id="b2Sort" title="Sort sheets">${[['order','Order added'],['number','Sheet number'],['title','Title'],['discipline','Discipline'],['revision','Revision'],['date','Date'],['file','File']].map(([k,l])=>`<option value="${k}" ${SX.view.sort===k?'selected':''}>Sort: ${l}</option>`).join('')}</select>
  <select class="ti" id="b2Disc"><option value="">All disciplines</option>${discs.map(d=>`<option ${SX.view.disc===d?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
  <label class="chk" style="margin-top:4px"><input type="checkbox" id="b2Stack" ${SX.view.stack?'checked':''}> Stack revisions (show latest; switch with the Rev list)</label>`;
  const anchor=pane.querySelector('#stQ');anchor?anchor.before(bar):list.before(bar);
  bar.querySelector('#b2Tags').onclick=editTagsDialog;bar.querySelector('#b2AutoTag').onclick=()=>autoTagDialog().catch(e=>toast('Auto-tag failed: '+e.message));bar.querySelector('#b2SSearch').onclick=setSearchDialog;bar.querySelector('#b2PSet').onclick=()=>printSetDialog();
  const upd=()=>{SX.view={sort:$('#b2Sort').value,disc:$('#b2Disc').value,stack:$('#b2Stack').checked};LS.set('pm:b2:setview',SX.view);arrangeSetList()};bar.querySelector('#b2Sort').onchange=upd;bar.querySelector('#b2Disc').onchange=upd;bar.querySelector('#b2Stack').onchange=upd}
 arrangeSetList()}finally{pane.__b2busy=false}}
function arrangeSetList(){const list=$('#stList'),s=curSet2();if(!list||!s)return;const st=stacks(s),latest=latestIdx(s),v=SX.view;const rows=[...list.querySelectorAll('[data-i]')];
 for(const r of rows){const i=+r.dataset.i,it=s.items[i];if(!it)continue;const t=tagsOf(it);let meta=r.querySelector('.b2tags');if(!meta){meta=document.createElement('div');meta.className='b2tags';meta.style.cssText='font-size:11px;color:var(--mut);margin-top:2px';r.appendChild(meta)}
  const k=(t.number||'').trim().toUpperCase()||('#'+i),stack=st.get(k)||[i];
  meta.innerHTML=[t.discipline,t.revision!==''&&t.revision!=null?'Rev '+esc(t.revision):'',t.date,t.custom].filter(Boolean).map(x=>`<span style="border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-right:3px">${esc(x)}</span>`).join('')+
   (stack.length>1?` <select data-b2rev title="Revisions of this sheet" style="font-size:11px">${stack.slice().reverse().map(j=>`<option value="${j}" ${j===i?'selected':''}>Rev ${esc(tagsOf(s.items[j]).revision||'?')} · ${esc(s.items[j].file)}</option>`).join('')}</select>`:'');
  const sel=meta.querySelector('[data-b2rev]');if(sel){sel.onclick=e=>e.stopPropagation();sel.onchange=e=>{e.stopPropagation();openSetItem(+sel.value)}}
  r.dataset.b2hide=((v.stack&&!latest.has(i))||(v.disc&&t.discipline!==v.disc))?'1':'';r.style.display=r.dataset.b2hide?'none':''}
 const key=i=>{const it=s.items[i],t=tagsOf(it);switch(v.sort){case'number':return[t.number||it.label];case'title':return[t.title||it.label];case'discipline':return[t.discipline,t.number];case'revision':return[revKey(t.revision).join('|'),t.number];case'date':return[t.date?String(Date.parse(t.date)||t.date).padStart(15,'0'):'~',t.number];case'file':return[it.file,String(it.page).padStart(5,'0')];default:return[String(i).padStart(6,'0')]}};
 const nat=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{numeric:true,sensitivity:'base'});rows.sort((a,b)=>{const A=key(+a.dataset.i),B=key(+b.dataset.i);for(let j=0;j<Math.max(A.length,B.length);j++){const c=nat(A[j],B[j]);if(c)return c}return 0});rows.forEach(r=>list.appendChild(r));
 const q=$('#stQ');if(q&&!q.__b2){q.__b2=1;q.addEventListener('input',()=>setTimeout(()=>rows.forEach(r=>{if(r.dataset.b2hide)r.style.display='none'}),0))}}
function visibleSetItems(s){s=s||curSet2();const list=$('#stList');if(list){const v=[...list.querySelectorAll('[data-i]')].filter(r=>r.style.display!=='none').map(r=>+r.dataset.i);if(v.length)return v}return s.items.map((_,i)=>i)}
async function searchSet(q,s){s=s||curSet2();const res=[],ql=q.toLowerCase();for(let i=0;i<s.items.length;i++){const it=s.items[i];try{const d=await setDoc(it.fileId);if(!d)continue;const pg=await d.getPage(it.page),tc=await pg.getTextContent(),txt=tc.items.map(t=>t.str).join(' ');let at=txt.toLowerCase().indexOf(ql),n=0;const first=at;while(at>=0){n++;at=txt.toLowerCase().indexOf(ql,at+ql.length)}
  if(n)res.push({i,n,label:it.label,file:it.file,page:it.page,snip:txt.slice(Math.max(0,first-30),first+q.length+30)})}catch(e){}}return res}
function setSearchDialog(){const s=curSet2();if(!s||!s.items.length)return toast('No sheets in this set');
 modal('Search the whole set',`<div class="row fld"><input class="ti" id="ssQ" placeholder="Text to find on every sheet"><button class="btn" id="ssGo" style="flex:0;border:1px solid var(--line)">Search</button></div><div id="ssR" style="max-height:50vh;overflow:auto"></div>`,[{label:'Close',cancel:1}]);
 const go=async()=>{const q=$('#ssQ').value.trim();if(!q)return;$('#ssR').innerHTML='<div class="hint">Searching…</div>';const r=await searchSet(q,s);
  $('#ssR').innerHTML=r.length?`<div class="hint">${r.reduce((a,x)=>a+x.n,0)} hit(s) on ${r.length} sheet(s)</div>`+r.map(x=>`<div class="res" data-ssi="${x.i}"><b>${esc(x.label)}</b> <small>(${x.n})</small><br><small style="color:var(--mut)">…${esc(x.snip)}…</small></div>`).join(''):'<div class="hint">No matches.</div>';
  $('#ssR').onclick=async e=>{const el=e.target.closest('[data-ssi]');if(!el)return;closeModal();openSetItem(+el.dataset.ssi);setTimeout(()=>{const box=$('#q')||$('#findQ')||document.querySelector('input[type=search]');if(box){box.value=q;box.dispatchEvent(new Event('input'))}},600)}};
 $('#ssGo').onclick=go;$('#ssQ').onkeydown=e=>{if(e.key==='Enter')go()};setTimeout(()=>$('#ssQ').focus(),50)}
/* Print Set: merge chosen sheets (with each file's markups) and run them through the print layout */
async function buildSetPdf(idx,o,s){s=s||curSet2();const out=await PDFLib.PDFDocument.create(),cache=new Map();
 for(const i of idx){const it=s.items[i];let c=cache.get(it.fileId);if(!c){const f=await setFile(it.fileId);if(!f)continue;const bytes=new Uint8Array(f.bytes),pm=await readPM(bytes,f.name);
   const cb=await contentBytes({content:o.content||'both',dim:o.dim,links:o.links,popups:o.popups},pm.orig,pm.markups,pm.scales);c=await PDFLib.PDFDocument.load(cb,{ignoreEncryption:true});cache.set(it.fileId,c)}
  const[p]=await out.copyPages(c,[it.page-1]);out.addPage(p)}return new Uint8Array(await out.save())}
function printSetDialog(){const s=curSet2();if(!s||!s.items.length)return toast('No sheets in this set');const idx=visibleSetItems(s);
 modal('Print set — '+s.name,`<div class="hint fld">${idx.length} sheet(s) currently listed (filters and revision stacking apply).</div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Content</label><select class="ti" id="psC"><option value="both">Document and markups</option><option value="doc">Document only</option><option value="markups">Markups only</option></select></div><div><label style="font-size:11px;color:var(--mut)">Pages per sheet</label><select class="ti" id="psN"><option>1</option><option>2</option><option>4</option><option>6</option><option>9</option></select></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Paper</label><select class="ti" id="psPa"><option value="auto">Auto</option>${Object.keys(PAPERS).map(k=>`<option>${k}</option>`).join('')}</select></div><label class="chk" style="margin-top:16px"><input type="checkbox" id="psG"> Grayscale</label></div>`,
 [{label:'Cancel',cancel:1},{label:'Print set',pri:1,fn:md=>{const o=Object.assign({},PRINT_DEF,LS.get('pm:b2:print',{}),{content:md.querySelector('#psC').value,nup:+md.querySelector('#psN').value,paper:md.querySelector('#psPa').value,gray:md.querySelector('#psG').checked});setTimeout(()=>printSet(idx,o,s),0)}}])}
async function printSet(idx,o,s){try{toast('Preparing set…');const b=await buildSetPdf(idx,o,s),n=idx.length;const r=await layoutPrint(b,Array.from({length:n},(_,i)=>i+1),Object.assign({},o,{scale:o.scale||'fit'}));if(o.gray||o.raster)r.bytes=await rasterizePdf(r.bytes,{dpi:o.dpi||150,gray:o.gray});
 B2.lastPrint=r;await printBytes(r.bytes,{dpi:o.dpi,gray:o.gray,name:(s||curSet2()).name.replace(/[^\w.-]+/g,'_')+'-print'});return r}catch(e){console.error(e);toast('Print set failed: '+e.message)}}
const setObs=new MutationObserver(()=>{const l=$('#stList');if(l&&!l.__b2seen){l.__b2seen=1;decorateSets()}});
H.ready.push(()=>{const p=$('#pane-sets');if(p){setObs.observe(p,{childList:true});decorateSets()}const lp=$('#pane-layers');if(lp){new MutationObserver(()=>{if(!lp.querySelector('#b2LyBar'))decorateLayers()}).observe(lp,{childList:true});decorateLayers()}});
window.PMSets2={autoTag,stacks,latestIdx,searchSet,buildSetPdf,printSet,curSet:curSet2,saveSet:saveSet2,openSetItem,visibleSetItems,arrangeSetList,editTagsDialog};
/* ---------- Digital IDs, digital signatures (PKCS#7 detached, SHA-256), certify (DocMDP), validation ---------- */
const IDS_KEY='pm:digitalids',TRUST_KEY='pm:trusted';
const getIds=()=>LS.get(IDS_KEY,[]),setIds=v=>LS.set(IDS_KEY,v),getTrusted=()=>LS.get(TRUST_KEY,[]),setTrusted=v=>LS.set(TRUST_KEY,v);
const b64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)},unb64=s=>unbin(atob(s));
async function sha256(u8){return new Uint8Array(await crypto.subtle.digest('SHA-256',u8))}
const hex=u8=>[...u8].map(b=>b.toString(16).padStart(2,'0')).join('');
async function certFingerprint(forge,cert){return hex(await sha256(unbin(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())))}
function certInfo(forge,cert){const g=(a,k)=>{const f=a.getField(k);return f?f.value:''};return{name:g(cert.subject,'CN'),email:g(cert.subject,'E')||(cert.subject.getField({name:'emailAddress'})||{}).value||'',org:g(cert.subject,'O'),issuer:g(cert.issuer,'CN'),from:cert.validity.notBefore.toISOString(),to:cert.validity.notAfter.toISOString(),serial:cert.serialNumber,selfSigned:cert.isIssuer(cert)}}
async function genKeys(forge){try{const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const p8=new Uint8Array(await crypto.subtle.exportKey('pkcs8',kp.privateKey)),pk=forge.pki.privateKeyFromAsn1(forge.asn1.fromDer(bin(p8)));return{privateKey:pk,publicKey:forge.pki.setRsaPublicKey(pk.n,pk.e)}}
 catch(e){return new Promise((res,rej)=>forge.pki.rsa.generateKeyPair({bits:2048,e:0x10001},(er,kp)=>er?rej(er):res(kp)))}}
async function createDigitalId(o){const forge=await getForge(),kp=await genKeys(forge),cert=forge.pki.createCertificate();cert.publicKey=kp.publicKey;
 cert.serialNumber='01'+hex(crypto.getRandomValues(new Uint8Array(15)));cert.validity.notBefore=new Date(Date.now()-60000);cert.validity.notAfter=new Date(Date.now()+(o.years||5)*365.25*864e5);
 const attrs=[{name:'commonName',value:o.name}];if(o.org)attrs.push({name:'organizationName',value:o.org});if(o.unit)attrs.push({name:'organizationalUnitName',value:o.unit});if(o.country)attrs.push({name:'countryName',value:o.country.slice(0,2).toUpperCase()});if(o.email)attrs.push({name:'emailAddress',value:o.email});
 cert.setSubject(attrs);cert.setIssuer(attrs);cert.setExtensions([{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true,nonRepudiation:true},{name:'extKeyUsage',emailProtection:true},{name:'subjectKeyIdentifier'}]);cert.sign(kp.privateKey,forge.md.sha256.create());
 const p12=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(kp.privateKey,[cert],o.password,{algorithm:'3des',friendlyName:o.name})).getBytes();return storeId(forge,cert,unbin(p12))}
async function storeId(forge,cert,p12){const fp=await certFingerprint(forge,cert),inf=certInfo(forge,cert),ids=getIds().filter(x=>x.fp!==fp);const rec=Object.assign({id:'d'+fp.slice(0,12),fp,p12:b64(p12),cert:forge.pki.certificateToPem(cert),added:Date.now()},inf);ids.push(rec);setIds(ids);return rec}
function parseP12(forge,p12u8,password){const p=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bin(p12u8)),false,password);const kb=(p.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]).concat(p.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[]);
 const cb=p.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];if(!kb.length||!cb.length)throw new Error('No private key / certificate in this file');const key=kb[0].key;
 const certs=cb.map(b=>b.cert);const mine=certs.find(c=>c.publicKey.n&&c.publicKey.n.equals(key.n))||certs[0];return{key,cert:mine,chain:certs}}
async function importDigitalId(bytes,password){const forge=await getForge(),{cert}=parseP12(forge,bytes,password);return storeId(forge,cert,bytes)}
async function unlockId(rec,password){const forge=await getForge();try{return Object.assign({rec},parseP12(forge,unb64(rec.p12),password))}catch(e){throw new Error('Wrong password for this digital ID')}}
/* --- PDF helpers --- */
const pdfStr=s=>'('+safeTxt(String(s)).replace(/[\\()]/g,m=>'\\'+m).replace(/[\r\n]+/g,' ')+')';
function pdfDate(d=new Date()){const p=n=>String(n).padStart(2,'0'),off=-d.getTimezoneOffset(),sg=off>=0?'+':'-',a=Math.abs(off);return`D:${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${sg}${p(a/60|0)}'${p(a%60)}'`}
const isSigned=u8=>bin(u8).includes('/ByteRange');
function lastStartxref(s){const i=s.lastIndexOf('startxref');if(i<0)throw new Error('No startxref');return parseInt(s.slice(i+9).trim(),10)}
async function deflateU8(u8){const cs=new CompressionStream('deflate'),w=cs.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
async function imageRGBA(src){const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data,rgb=new Uint8Array(c.width*c.height*3),a=new Uint8Array(c.width*c.height);
 for(let i=0,j=0;i<a.length;i++,j+=4){rgb[i*3]=d[j];rgb[i*3+1]=d[j+1];rgb[i*3+2]=d[j+2];a[i]=d[j+3]}return{w:c.width,h:c.height,rgb,a}}
const SIG_BYTES=16000;
/* prepare: incremental update with signature field + placeholder; returns {bytes, range:[a,b,c,d], hexAt} */
async function prepareSigned(bytes,o){const s0=bin(bytes);
 const{PDFName,PDFArray,PDFDict,PDFRef}=PDFLib;const doc=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false,ignoreEncryption:true}),ctx=doc.context;if(ctx.trailerInfo.Encrypt)throw new Error('This PDF is encrypted — remove its security before signing');
 let next=ctx.largestObjectNumber+1;const alloc=()=>PDFRef.of(next++,0),upd=new Map();
 const catRef=ctx.trailerInfo.Root,catD=ctx.lookup(catRef,PDFDict),page=doc.getPage(o.page-1),pageRef=page.ref;
 const sigRef=alloc(),widRef=alloc(),apRef=alloc(),fontRef=alloc();let imgRef=null,maskRef=null;
 // fields
 let acro=catD.get(PDFName.of('AcroForm')),acroDict=acro instanceof PDFRef?ctx.lookup(acro,PDFDict):acro;if(!acroDict){acroDict=ctx.obj({});catD.set(PDFName.of('AcroForm'),acroDict)}
 let fields=acroDict.get(PDFName.of('Fields'));let fieldsArr=fields instanceof PDFRef?ctx.lookup(fields,PDFArray):fields;if(!fieldsArr){fieldsArr=ctx.obj([]);acroDict.set(PDFName.of('Fields'),fieldsArr)}
 const nSig=fieldsArr.asArray().length+1;fieldsArr.push(widRef);acroDict.set(PDFName.of('SigFlags'),ctx.obj(3));
 if(acro instanceof PDFRef)upd.set(acro,acroDict);else upd.set(catRef,catD);if(fields instanceof PDFRef)upd.set(fields,fieldsArr);
 let annots=page.node.get(PDFName.of('Annots'));if(annots instanceof PDFRef){const arr=ctx.lookup(annots,PDFArray);arr.push(widRef);upd.set(annots,arr)}else{if(!annots){annots=ctx.obj([]);page.node.set(PDFName.of('Annots'),annots)}annots.push(widRef);upd.set(pageRef,page.node)}
 if(o.certify){catD.set(PDFName.of('Perms'),ctx.obj({DocMDP:sigRef}));upd.set(catRef,catD)}
 // appearance
 const vis=!!o.box,[vw,vh]=vis?[o.box[2]-o.box[0],o.box[3]-o.box[1]]:[0,0];let rect='[0 0 0 0]',ap='',matrix='';
 if(vis){const c=[[o.box[0],o.box[1]],[o.box[2],o.box[3]]].map(q=>v2p(page,q[0],q[1]));rect=`[${Math.min(c[0][0],c[1][0]).toFixed(2)} ${Math.min(c[0][1],c[1][1]).toFixed(2)} ${Math.max(c[0][0],c[1][0]).toFixed(2)} ${Math.max(c[0][1],c[1][1]).toFixed(2)}]`;
  const r=rotOf(page),rad=r*Math.PI/180,co=Math.round(Math.cos(rad)),si=Math.round(Math.sin(rad));matrix=r?`/Matrix [${co} ${si} ${-si} ${co} 0 0]`:'';
  const lines=[o.showName!==false?'Digitally signed by '+o.name:'',o.showDate!==false?'Date: '+o.dateText:'',o.reason?'Reason: '+o.reason:'',o.location?'Location: '+o.location:'',o.certify?'Certified document':''].filter(Boolean);
  let tx=4,tw=vw-8;if(o.image){const im=o.image,ih=vh-6,iw=Math.min(vw*.45,ih*im.w/im.h);ap+=`q ${iw.toFixed(2)} 0 0 ${(iw*im.h/im.w).toFixed(2)} 3 ${((vh-iw*im.h/im.w)/2).toFixed(2)} cm /Img Do Q\n`;tx=iw+8;tw=vw-tx-4}
  const longest=Math.max(1,...lines.map(l=>l.length));let fs=Math.min(vh/(lines.length*1.25+.6),tw/(longest*.5),14);fs=Math.max(fs,2);
  ap=`q 0.12 0.3 0.65 RG 0.8 w 0.4 0.4 ${(vw-.8).toFixed(2)} ${(vh-.8).toFixed(2)} re S Q\n`+ap+`BT /F1 ${fs.toFixed(2)} Tf 0.08 0.08 0.1 rg ${tx.toFixed(2)} ${(vh-fs*1.1-2).toFixed(2)} Td ${(fs*1.2).toFixed(2)} TL\n`+lines.map((l,i)=>(i?'T* ':'')+pdfStr(l)+' Tj').join('\n')+'\nET'}
 const objs=[];// [ref, text]
 const ser=(ref,body)=>objs.push([ref,`${ref.objectNumber} ${ref.generationNumber} obj\n${body}\nendobj\n`]);
 for(const[ref,ob]of upd)ser(ref,ob.toString());
 if(o.image){imgRef=alloc();maskRef=alloc();const z=await deflateU8(o.image.rgb),za=await deflateU8(o.image.a);
  ser(maskRef,`<< /Type /XObject /Subtype /Image /Width ${o.image.w} /Height ${o.image.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${za.length} >>\nstream\n${bin(za)}\nendstream`);
  ser(imgRef,`<< /Type /XObject /Subtype /Image /Width ${o.image.w} /Height ${o.image.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask ${maskRef.objectNumber} 0 R /Filter /FlateDecode /Length ${z.length} >>\nstream\n${bin(z)}\nendstream`)}
 ser(fontRef,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 ser(apRef,`<< /Type /XObject /Subtype /Form /BBox [0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}] ${matrix} /Resources << /Font << /F1 ${fontRef.objectNumber} 0 R >>${imgRef?` /XObject << /Img ${imgRef.objectNumber} 0 R >>`:''} >> /Length ${ap.length} >>\nstream\n${ap}\nendstream`);
 ser(widRef,`<< /Type /Annot /Subtype /Widget /FT /Sig /T ${pdfStr('Signature'+nSig+'_'+Date.now().toString(36))} /V ${sigRef.objectNumber} 0 R /F 132 /P ${pageRef.objectNumber} ${pageRef.generationNumber} R /Rect ${rect} /AP << /N ${apRef.objectNumber} 0 R >> >>`);
 const ref=o.certify?` /Reference [<< /Type /SigRef /TransformMethod /DocMDP /TransformParams << /Type /TransformParams /P ${o.perm||2} /V /1.2 >> >>]`:'';
 const BRPH='/ByteRange ['+' '.repeat(44)+']',CPH='/Contents <'+'0'.repeat(SIG_BYTES*2)+'>';
 ser(sigRef,`<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ${BRPH} ${CPH} /M ${pdfStr(pdfDate(o.date))} /Name ${pdfStr(o.name)}${o.reason?' /Reason '+pdfStr(o.reason):''}${o.location?' /Location '+pdfStr(o.location):''}${o.contact?' /ContactInfo '+pdfStr(o.contact):''}${ref} /Prop_Build << /App << /Name /PlanMark >> >> >>`);
 // write update
 let out=s0.endsWith('\n')?'':'\n';const base=bytes.length;const offs=new Map();for(const[r,t]of objs){offs.set(r.objectNumber,{off:base+out.length,gen:r.generationNumber});out+=t}
 const nums=[...offs.keys()].sort((a,b)=>a-b);let xref='xref\n',i=0;while(i<nums.length){let j=i;while(j+1<nums.length&&nums[j+1]===nums[j]+1)j++;xref+=`${nums[i]} ${j-i+1}\n`;for(let k=i;k<=j;k++){const e=offs.get(nums[k]);xref+=`${String(e.off).padStart(10,'0')} ${String(e.gen).padStart(5,'0')} n\r\n`}i=j+1}
 const info=ctx.trailerInfo.Info,id=ctx.trailerInfo.ID;const idStr=id?id.toString():`[<${hex(crypto.getRandomValues(new Uint8Array(16)))}> <${hex(crypto.getRandomValues(new Uint8Array(16)))}>]`;
 const xrefAt=base+out.length;out+=xref+`trailer\n<< /Size ${next} /Root ${catRef.objectNumber} ${catRef.generationNumber} R${info?` /Info ${info.toString()}`:''} /ID ${idStr} /Prev ${lastStartxref(s0)} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
 const sigStart=out.indexOf(CPH,out.indexOf(`${sigRef.objectNumber} 0 obj`)),a=base+sigStart+'/Contents '.length,b=a+SIG_BYTES*2+2,full=base+out.length,range=[0,a,b,full-b];
 const brStr=`/ByteRange [${range.join(' ')}`.padEnd(BRPH.length-1,' ')+']';const brAt=out.indexOf(BRPH,out.indexOf(`${sigRef.objectNumber} 0 obj`));out=out.slice(0,brAt)+brStr+out.slice(brAt+BRPH.length);
 const res=cat([bytes,unbin(out)]);return{bytes:res,range,hexAt:a+1}}
/* RFC 3161 request (sent through the desktop app, which can reach any TSA) */
function tsaReq(forge,sigValueBytes){const A=forge.asn1,md=forge.md.sha256.create();md.update(sigValueBytes);
 return A.toDer(A.create(A.Class.UNIVERSAL,A.Type.SEQUENCE,true,[A.create(A.Class.UNIVERSAL,A.Type.INTEGER,false,A.integerToDer(1).getBytes()),
  A.create(A.Class.UNIVERSAL,A.Type.SEQUENCE,true,[A.create(A.Class.UNIVERSAL,A.Type.SEQUENCE,true,[A.create(A.Class.UNIVERSAL,A.Type.OID,false,A.oidToDer(forge.pki.oids.sha256).getBytes()),A.create(A.Class.UNIVERSAL,A.Type.NULL,false,'')]),A.create(A.Class.UNIVERSAL,A.Type.OCTETSTRING,false,md.digest().getBytes())]),
  A.create(A.Class.UNIVERSAL,A.Type.INTEGER,false,A.integerToDer(Math.floor(Math.random()*2147483647)).getBytes()),A.create(A.Class.UNIVERSAL,A.Type.BOOLEAN,false,String.fromCharCode(0xff))])).getBytes()}
const OID_TST='1.2.840.113549.1.9.16.2.14';
function signerInfoOf(forge,ci){const sd=ci.value[1].value[0];const si=sd.value[sd.value.length-1];return{sd,si:si.value[0]}}
async function signPdf(bytes,o){const forge=await getForge(),id=o.id;if(!id||!id.key)throw new Error('Unlock a digital ID first');
 if(!isSigned(bytes)){const d=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false,ignoreEncryption:true});bytes=new Uint8Array(await d.save({useObjectStreams:false}))}
 else if(o.certify)throw new Error('Only the first signature can certify a document');
 const date=new Date(),name=certInfo(forge,id.cert).name||'Signer';const prep=await prepareSigned(bytes,Object.assign({},o,{name:o.name||name,date,dateText:date.toLocaleString()}));const[a0,a1,b0,b1]=prep.range,u=prep.bytes;
 const data=bin(u.subarray(a0,a0+a1))+bin(u.subarray(b0,b0+b1));const p7=forge.pkcs7.createSignedData();p7.content=forge.util.createBuffer(data);
 for(const c of(id.chain||[id.cert]))p7.addCertificate(c);
 p7.addSigner({key:id.key,certificate:id.cert,digestAlgorithm:forge.pki.oids.sha256,authenticatedAttributes:[{type:forge.pki.oids.contentType,value:forge.pki.oids.data},{type:forge.pki.oids.messageDigest},{type:forge.pki.oids.signingTime,value:date}]});
 p7.sign({detached:true});let ci=p7.toAsn1();
 if(o.tsa){if(!(window.pmDesktop&&window.pmDesktop.tsaRequest))throw new Error('Time stamps need the Windows app (the browser cannot reach a time-stamp server)');
  const{si}=signerInfoOf(forge,ci),sigVal=si.value.find(x=>x.type===forge.asn1.Type.OCTETSTRING&&x.tagClass===forge.asn1.Class.UNIVERSAL).value;
  const resp=await window.pmDesktop.tsaRequest(o.tsa,unbin(tsaReq(forge,sigVal)));if(!resp)throw new Error('No reply from the time-stamp server');
  const R=forge.asn1.fromDer(bin(resp instanceof Uint8Array?resp:new Uint8Array(resp)));const status=forge.asn1.derToInteger(R.value[0].value[0].value);if(status>1)throw new Error('Time-stamp server refused (status '+status+')');const token=R.value[1];
  const A=forge.asn1;si.value.push(A.create(A.Class.CONTEXT_SPECIFIC,1,true,[A.create(A.Class.UNIVERSAL,A.Type.SEQUENCE,true,[A.create(A.Class.UNIVERSAL,A.Type.OID,false,A.oidToDer(OID_TST).getBytes()),A.create(A.Class.UNIVERSAL,A.Type.SET,true,[token])])]))}
 const der=forge.asn1.toDer(ci).getBytes();if(der.length>SIG_BYTES)throw new Error('Signature too large');const hx=hex(unbin(der)).padEnd(SIG_BYTES*2,'0');for(let i=0;i<hx.length;i++)u[prep.hexAt+i]=hx.charCodeAt(i);return u}
/* validation */
async function validateSignatures(bytes){const forge=await getForge(),s=bin(bytes),out=[],re=/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;let m;const trusted=getTrusted(),mine=getIds();
 while((m=re.exec(s))){const r=[+m[1],+m[2],+m[3],+m[4]],v={range:r,at:m.index,errors:[]};out.push(v);
  try{// dictionary around this ByteRange
   const sd=s.slice(s.lastIndexOf(' obj',m.index),s.indexOf('endobj',m.index));const g=k=>{const mm=sd.match(new RegExp('/'+k+'\\s*\\(((?:\\\\.|[^\\\\)])*)\\)'));return mm?mm[1].replace(/\\(.)/g,'$1'):''};
   v.name=g('Name');v.reason=g('Reason');v.location=g('Location');v.m=g('M');v.certify=/\/TransformMethod\s*\/DocMDP/.test(sd);const pm=sd.match(/\/P\s+(\d)/);v.perm=v.certify&&pm?+pm[1]:null;
   const hexs=s.slice(r[1]+1,r[2]-1).replace(/[^0-9a-fA-F]/g,'');const derBytes=new Uint8Array(hexs.length>>1);for(let i=0;i<derBytes.length;i++)derBytes[i]=parseInt(hexs.substr(i*2,2),16);
   const asn=forge.asn1.fromDer(forge.util.createBuffer(bin(derBytes)),{strict:false,parseAllBytes:false});const msg=forge.pkcs7.messageFromAsn1(asn);
   const{si}=signerInfoOf(forge,asn);const A=forge.asn1;const kids=si.value;const sAttrs=kids.find(k=>k.tagClass===A.Class.CONTEXT_SPECIFIC&&k.type===0),uAttrs=kids.find(k=>k.tagClass===A.Class.CONTEXT_SPECIFIC&&k.type===1);
   const sigVal=kids.filter(k=>k.tagClass===A.Class.UNIVERSAL&&k.type===A.Type.OCTETSTRING).pop().value;const isn=kids[1],serial=forge.util.bytesToHex(isn.value[1].value).replace(/^0+/,'');
   const cert=msg.certificates.find(c=>c.serialNumber.replace(/^0+/,'')===serial)||msg.certificates[0];v.cert=cert;Object.assign(v,{signer:certInfo(forge,cert)});
   const data=bin(bytes.subarray(r[0],r[0]+r[1]))+bin(bytes.subarray(r[2],r[2]+r[3]));const dg=forge.md.sha256.create();dg.update(data);const digest=dg.digest().getBytes();
   let mdOk=false,tsOk=false;if(sAttrs){for(const at of sAttrs.value){const oid=A.derToOid(at.value[0].value),val=at.value[1].value[0];
     if(oid===forge.pki.oids.messageDigest)mdOk=val.value===digest;if(oid===forge.pki.oids.signingTime)v.time=val.type===A.Type.UTCTIME?A.utcTimeToDate(val.value):A.generalizedTimeToDate(val.value)}
    const set=A.create(A.Class.UNIVERSAL,A.Type.SET,true,sAttrs.value),md=forge.md.sha256.create();md.update(A.toDer(set).getBytes());
    try{v.sigOk=cert.publicKey.verify(md.digest().getBytes(),sigVal)}catch(e){v.sigOk=false}}
   else{try{v.sigOk=cert.publicKey.verify(digest,sigVal);mdOk=true}catch(e){v.sigOk=false}}
   if(uAttrs)for(const at of uAttrs.value){if(A.derToOid(at.value[0].value)===OID_TST){v.timestamp=true;tsOk=true;try{const tok=forge.pkcs7.messageFromAsn1(at.value[1].value[0]);const raw=tok.rawCapture&&tok.rawCapture.content;if(raw){const tst=A.fromDer(raw.value[0].value);const gt=tst.value.find(x=>x.type===A.Type.GENERALIZEDTIME);if(gt)v.tsTime=A.generalizedTimeToDate(gt.value)}}catch(e){}}}
   v.digestOk=mdOk;v.intact=mdOk&&v.sigOk;v.coversAll=r[2]+r[3]===bytes.length;v.fp=await certFingerprint(forge,cert);
   v.trusted=trusted.some(t=>t.fp===v.fp)||mine.some(t=>t.fp===v.fp);const now=v.time||new Date();v.expired=now>cert.validity.notAfter||now<cert.validity.notBefore;
   v.status=!v.intact?'invalid':(!v.trusted||v.expired)?'unknown':'valid';
   v.summary=!v.intact?'INVALID — the document was altered after it was signed, or the signature is corrupt':v.status==='unknown'?(v.expired?'Signature intact, but the certificate was not valid at signing time':'Signature intact; signer identity is not trusted yet'):'Valid — signed by a trusted identity and unchanged'+(v.coversAll?'':' (later changes were appended after signing)')}
  catch(e){v.status='invalid';v.errors.push(e.message||String(e));v.summary='INVALID — '+(e.message||e)}}
 // certification (DocMDP): changes after a certifying signature must be allowed by its permission level
 const ends=out.map(v=>v.range[2]+v.range[3]);for(const v of out){if(!v.certify||v.status==='invalid'||v.coversAll)continue;const later=out.filter(w=>w!==v&&w.range[2]+w.range[3]>v.range[2]+v.range[3]),onlySigs=Math.max(...ends)===bytes.length;
  if(v.perm===1||(v.perm===2&&!onlySigs)){v.status='invalid';v.mdpViolation=true;v.summary='INVALID — the document was changed after it was certified, which the certification does not allow'}
  else if(v.perm===3&&!onlySigs){v.status='unknown';v.summary='Certified; later changes were made (comments allowed by the certification)'}}
 return out}
/* ---------- signing UI ---------- */
B2.unlocked=new Map();
async function ensureUnlocked(rec,pw){if(B2.unlocked.has(rec.id))return B2.unlocked.get(rec.id);const u=await unlockId(rec,pw);B2.unlocked.set(rec.id,u);return u}
function idsDialog(){const ids=getIds();
 modal('Digital IDs',`<div class="hint fld">A digital ID is a certificate + private key used to sign PDFs. IDs are kept on this device only (password-protected .p12) and are not synced.</div>
 <div style="max-height:40vh;overflow:auto">${ids.map(r=>`<div class="res" style="cursor:default" data-did="${r.id}"><b>${esc(r.name)}</b>${r.email?' &lt;'+esc(r.email)+'&gt;':''}${r.org?' · '+esc(r.org):''}<br><small style="color:var(--mut)">${r.selfSigned?'Self-signed':'Issued by '+esc(r.issuer)} · expires ${esc(r.to.slice(0,10))} · SHA-256 ${esc(r.fp.slice(0,16))}…</small>
  <div class="row" style="gap:4px;margin-top:4px"><button class="btn" data-dexp style="border:1px solid var(--line)">Export certificate</button><button class="btn" data-dp12 style="border:1px solid var(--line)">Export .p12</button><button class="btn" data-ddel style="border:1px solid #fca5a5;color:#b91c1c">Delete</button></div></div>`).join('')||'<div class="hint">No digital IDs yet.</div>'}</div>`,
 [{label:'Close',cancel:1},{label:'Import .pfx/.p12…',fn:()=>{setTimeout(importIdFlow,0)}},{label:'Create self-signed ID…',pri:1,fn:()=>{setTimeout(createIdDialog,0)}}]);
 document.querySelectorAll('[data-did]').forEach(el=>{const r=ids.find(x=>x.id===el.dataset.did);
  el.querySelector('[data-dexp]').onclick=async()=>{const forge=await getForge(),c=forge.pki.certificateFromPem(r.cert),der=unbin(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes());await saveFile(r.name.replace(/[^\w.-]+/g,'_')+'.cer',new Blob([der]))};
  el.querySelector('[data-dp12]').onclick=()=>saveFile(r.name.replace(/[^\w.-]+/g,'_')+'.p12',new Blob([unb64(r.p12)]));
  el.querySelector('[data-ddel]').onclick=()=>{setIds(getIds().filter(x=>x.id!==r.id));B2.unlocked.delete(r.id);closeModal();idsDialog()}})}
function createIdDialog(){modal('Create self-signed digital ID',`<div class="fld"><label>Name</label><input class="ti" id="ciN" value="${esc((window.PM_USER&&PM_USER.name)||'')}"></div><div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Email</label><input class="ti" id="ciE"></div><div><label style="font-size:11px;color:var(--mut)">Organization</label><input class="ti" id="ciO"></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Password</label><input class="ti" type="password" id="ciP"></div><div><label style="font-size:11px;color:var(--mut)">Confirm</label><input class="ti" type="password" id="ciP2"></div></div><div class="hint">RSA 2048-bit, SHA-256, valid 5 years.</div>`,
 [{label:'Cancel',cancel:1},{label:'Create',pri:1,fn:md=>{const q=s=>md.querySelector(s).value;if(!q('#ciN').trim()){toast('Enter a name');return false}if(q('#ciP').length<4){toast('Use a password of 4+ characters');return false}if(q('#ciP')!==q('#ciP2')){toast('Passwords do not match');return false}
  const o={name:q('#ciN').trim(),email:q('#ciE').trim(),org:q('#ciO').trim(),password:q('#ciP')};toast('Generating keys…');setTimeout(async()=>{try{const r=await createDigitalId(o);toast('Created digital ID for '+r.name);idsDialog()}catch(e){toast('Could not create ID: '+e.message)}},0)}}])}
async function importIdFlow(){const[f]=await pickFiles('.pfx,.p12,application/x-pkcs12');if(!f)return;const bytes=new Uint8Array(await f.arrayBuffer());
 modal('Import '+f.name,`<div class="fld"><label>Password</label><input class="ti" type="password" id="imP"></div>`,[{label:'Cancel',cancel:1},{label:'Import',pri:1,fn:md=>{const pw=md.querySelector('#imP').value;setTimeout(async()=>{try{const r=await importDigitalId(bytes,pw);toast('Imported '+r.name);idsDialog()}catch(e){toast('Import failed: '+(/MAC|password|Invalid/i.test(e.message)?'wrong password or damaged file':e.message))}},0)}}])}
function signDialog(certify){if(!S.pages.length)return toast('Open a PDF first');const ids=getIds();if(!ids.length){toast('Create or import a digital ID first');return idsDialog()}
 const raw=B2.raw.get(S.pdf)||S.bytes,signed=isSigned(raw);if(certify&&signed)return toast('Only an unsigned document can be certified');const o0=LS.get('pm:b2:sign',{});const tsa=!!(window.pmDesktop&&window.pmDesktop.tsaRequest);const pics=LS.get('pm:sigs',[]);
 modal(certify?'Certify document':'Sign document',`<div class="fld"><label>Digital ID</label><select class="ti" id="sgI">${ids.map(r=>`<option value="${r.id}" ${o0.id===r.id?'selected':''}>${esc(r.name)}${r.email?' <'+esc(r.email)+'>':''}</option>`).join('')}</select></div>
 <div class="fld"><label>Password</label><input class="ti" type="password" id="sgP" placeholder="${'Digital ID password'}"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Reason</label><input class="ti" id="sgR" value="${esc(o0.reason||(certify?'I am the author of this document':'I approve this document'))}"></div><div><label style="font-size:11px;color:var(--mut)">Location</label><input class="ti" id="sgL" value="${esc(o0.location||'')}"></div></div>
 ${certify?`<div class="fld"><label>Allowed changes after certifying</label><select class="ti" id="sgM"><option value="1">No changes</option><option value="2" selected>Form fill-in and signing</option><option value="3">Form fill-in, signing and comments</option></select></div>`:''}
 <div class="row fld" style="flex-wrap:wrap"><label class="chk"><input type="checkbox" id="sgV" ${o0.invisible?'':'checked'}> Visible signature (draw its box next)</label><label class="chk"><input type="checkbox" id="sgN" checked> Show name</label><label class="chk"><input type="checkbox" id="sgD" checked> Show date</label></div>
 <div class="fld"><label>Appearance image</label><select class="ti" id="sgImg"><option value="">None (text only)</option>${pics.map((p,i)=>`<option value="${i}">${esc(p.name||'Signature '+(i+1))}</option>`).join('')}<option value="file">Choose an image file…</option></select></div>
 ${tsa?`<div class="fld"><label>Time-stamp server (optional)</label><input class="ti" id="sgT" value="${esc(o0.tsa||'')}" placeholder="http://timestamp.digicert.com"></div>`:''}
 ${signed?'<div class="hint">This PDF is already signed: the new signature is added as an incremental update so earlier signatures stay valid. Markups made since opening it are not included.</div>':S.markups.length?'<div class="hint">Your markups are flattened into the signed copy.</div>':''}`,
 [{label:'Cancel',cancel:1},{label:certify?'Certify':'Sign',pri:1,fn:md=>{const q=s=>md.querySelector(s);const o={id:q('#sgI').value,pass:q('#sgP').value,reason:q('#sgR').value.trim(),location:q('#sgL').value.trim(),certify:!!certify,perm:certify?+q('#sgM').value:0,visible:q('#sgV').checked,showName:q('#sgN').checked,showDate:q('#sgD').checked,img:q('#sgImg').value,tsa:tsa?q('#sgT').value.trim():''};
  LS.set('pm:b2:sign',{id:o.id,reason:o.reason,location:o.location,invisible:!o.visible,tsa:o.tsa});setTimeout(()=>signCurrent(o),0)}}])}
async function signCurrent(o){try{const rec=getIds().find(r=>r.id===o.id);if(!rec)throw new Error('Digital ID not found');const id=await ensureUnlocked(rec,o.pass);
 const raw=B2.raw.get(S.pdf)||S.bytes;let base=raw;if(!isSigned(raw)&&S.markups.length)base=await PMOutput.markedPdf(true);
 if(isSigned(raw)&&/\/TransformMethod\s*\/DocMDP[\s\S]{0,200}?\/P\s+1\b/.test(bin(raw)))throw new Error('This document is certified with no changes allowed');
 let box=null,page=1;if(o.box){box=o.box;page=o.page||1}else if(o.visible){const r=await PMAuto.pickRegion('Draw the signature box');box=r.box;page=r.page}
 let image=null;if(o.img==='file'){const[f]=await pickFiles('image/*');if(f)image=await imageRGBA(URL.createObjectURL(f))}else if(o.img!==''&&o.img!=null){const p=LS.get('pm:sigs',[])[+o.img];if(p)image=await imageRGBA(p.dataUrl)}
 toast(o.certify?'Certifying…':'Signing…');const out=await signPdf(base,{id,box,page,image,reason:o.reason,location:o.location,certify:o.certify,perm:o.perm,showName:o.showName,showDate:o.showDate,tsa:o.tsa});
 const name=baseName().replace(/-signed(-\d+)?$/,'')+'-signed.pdf';B2.lastSigned=out;if(o.save!==false)await saveFile(name,new Blob([out],{type:'application/pdf'}));if(o.open!==false)await openBytes(out,name);toast(o.certify?'Document certified':'Document signed');return out}
 catch(e){console.error(e);toast((o.certify?'Certify':'Sign')+' failed: '+(e.message||e));throw e}}
/* signatures panel */
let sigPane=null;
async function refreshSigPane(){if(!sigPane)return;const raw=S.pdf&&(B2.raw.get(S.pdf)||S.bytes);if(!raw){sigPane.innerHTML='<div class="hint">Open a PDF.</div>';return}
 const head=`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" style="border:1px solid var(--line)" data-sx="sign">Sign…</button><button class="btn" style="border:1px solid var(--line)" data-sx="certify">Certify…</button><button class="btn" style="border:1px solid var(--line)" data-sx="ids">Digital IDs…</button><button class="btn" style="border:1px solid var(--line)" data-sx="trust">Trusted identities…</button><button class="btn" style="border:1px solid var(--line)" data-sx="val">Validate</button></div>`;
 if(!isSigned(raw)){sigPane.innerHTML=head+'<div class="hint">This document has no digital signatures.</div>';wireSig([]);return}
 sigPane.innerHTML=head+'<div class="hint">Validating…</div>';const vs=await validateSignatures(raw);B2.lastValidation=vs;const col={valid:'#16a34a',unknown:'#d97706',invalid:'#dc2626'},ico={valid:'✔',unknown:'?',invalid:'✖'};
 sigPane.innerHTML=head+vs.map((v,i)=>`<div style="border:1px solid var(--line);border-left:4px solid ${col[v.status]};border-radius:8px;padding:8px;margin-bottom:8px" data-sv="${i}"><b style="color:${col[v.status]}">${ico[v.status]} ${v.certify?'Certified by':'Signed by'} ${esc((v.signer&&v.signer.name)||v.name||'unknown')}</b>
  <div style="font-size:12px;margin-top:3px">${esc(v.summary)}</div><div class="hint" style="margin-top:3px">${v.time?'Signed '+esc(v.time.toLocaleString())+(v.timestamp?' (time-stamped'+(v.tsTime?' '+esc(v.tsTime.toLocaleString()):'')+')':' (computer clock)'):''}${v.reason?' · Reason: '+esc(v.reason):''}${v.location?' · '+esc(v.location):''}${v.certify?' · Allowed changes: '+(['','none','form fill & signing','form fill, signing & comments'][v.perm]||'?'):''}</div>
  <div class="hint">Integrity: ${v.intact?'unchanged':'FAILED'} · Identity: ${v.trusted?'trusted':'not trusted'}${v.signer&&v.signer.email?' · '+esc(v.signer.email):''}${v.fp?' · SHA-256 '+esc(v.fp.slice(0,16))+'…':''}</div>
  <div class="row" style="gap:4px;margin-top:6px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" data-sv-open>Open signed version</button><button class="btn" style="border:1px solid var(--line)" data-sv-save>Save signed version</button>${v.cert&&!v.trusted?'<button class="btn" style="border:1px solid var(--line)" data-sv-trust>Trust this signer</button>':''}</div></div>`).join('');wireSig(vs,raw)}
function wireSig(vs,raw){sigPane.querySelectorAll('[data-sx]').forEach(b=>b.onclick=()=>({sign:()=>signDialog(false),certify:()=>signDialog(true),ids:idsDialog,trust:trustDialog,val:refreshSigPane})[b.dataset.sx]());
 sigPane.querySelectorAll('[data-sv]').forEach(el=>{const v=vs[+el.dataset.sv],ver=()=>raw.slice(0,v.range[2]+v.range[3]);
  const o=el.querySelector('[data-sv-open]');if(o)o.onclick=()=>openBytes(ver(),baseName()+'-signed-version-'+(+el.dataset.sv+1)+'.pdf');
  const sv=el.querySelector('[data-sv-save]');if(sv)sv.onclick=()=>saveFile(baseName()+'-signed-version-'+(+el.dataset.sv+1)+'.pdf',new Blob([ver()],{type:'application/pdf'}));
  const t=el.querySelector('[data-sv-trust]');if(t)t.onclick=async()=>{await trustCert(v.cert);refreshSigPane()}})}
async function trustCert(cert){const forge=await getForge(),fp=await certFingerprint(forge,cert),inf=certInfo(forge,cert),t=getTrusted().filter(x=>x.fp!==fp);t.push({fp,name:inf.name,email:inf.email,org:inf.org,to:inf.to,pem:forge.pki.certificateToPem(cert),added:Date.now()});setTrusted(t);toast('Trusted '+inf.name);return fp}
function trustDialog(){const t=getTrusted();modal('Trusted identities',`<div class="hint fld">Signatures by these certificates show as valid. Your own digital IDs are always trusted.</div><div style="max-height:40vh;overflow:auto">${t.map(x=>`<div class="res" style="cursor:default" data-tf="${x.fp}"><b>${esc(x.name)}</b>${x.email?' &lt;'+esc(x.email)+'&gt;':''}<br><small style="color:var(--mut)">SHA-256 ${esc(x.fp.slice(0,24))}… · expires ${esc((x.to||'').slice(0,10))}</small> <button class="btn" data-trm style="border:1px solid #fca5a5;color:#b91c1c;float:right">Remove</button></div>`).join('')||'<div class="hint">None yet.</div>'}</div>`,
 [{label:'Close',cancel:1},{label:'Import certificate…',pri:1,fn:()=>{setTimeout(async()=>{const[f]=await pickFiles('.cer,.crt,.pem,.der');if(!f)return;try{const forge=await getForge(),u=new Uint8Array(await f.arrayBuffer()),s=bin(u);const c=/-----BEGIN CERTIFICATE/.test(s)?forge.pki.certificateFromPem(s):forge.pki.certificateFromAsn1(forge.asn1.fromDer(s));await trustCert(c);trustDialog();refreshSigPane()}catch(e){toast('Not a certificate file')}},0)}}]);
 document.querySelectorAll('[data-tf]').forEach(el=>el.querySelector('[data-trm]').onclick=()=>{setTrusted(getTrusted().filter(x=>x.fp!==el.dataset.tf));closeModal();trustDialog();refreshSigPane()})}
/* batch sign */
function signBatchForm(o){const ids=getIds();return ids.length?`<div class="fld"><label>Digital ID</label><select class="ti" data-b="id">${ids.map(r=>`<option value="${r.id}" ${o.id===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div><div class="fld"><label>Password</label><input class="ti" type="password" data-b="pass"></div>
 <div class="row fld"><input class="ti" data-b="reason" placeholder="Reason" value="${esc(o.reason||'I approve this document')}"><input class="ti" data-b="location" placeholder="Location" value="${esc(o.location||'')}"></div>
 <div class="row fld"><select class="ti" data-b="spage"><option value="last">Last page</option><option value="first" ${o.spage==='first'?'selected':''}>First page</option></select><select class="ti" data-b="spos">${['br','bl','tr','tl'].map(k=>`<option value="${k}" ${o.spos===k?'selected':''}>${{br:'Bottom right',bl:'Bottom left',tr:'Top right',tl:'Top left'}[k]}</option>`).join('')}</select><label class="chk"><input type="checkbox" data-b="svis" ${o.svis!==false?'checked':''}> Visible</label></div><label class="chk fld"><input type="checkbox" data-b="certify" ${o.certify?'checked':''}> Certify (no changes after)</label>`:'<div class="hint">Create or import a digital ID first (Sign ▸ Digital IDs).</div>'}
async function opSign(f,o,st){const rec=getIds().find(r=>r.id===o.id);if(!rec)throw new Error('Pick a digital ID');if(!st.id)st.id=await ensureUnlocked(rec,o.pass);
 let bytes=f.bytes;if(!isSigned(bytes)){const pm=await readPM(bytes,f.name);bytes=pm.markups.length?await flattenBytes(pm.orig,pm.markups,pm.scales,{}):pm.orig}
 const d=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true,updateMetadata:false}),n=o.spage==='first'?1:d.getPageCount(),[w,h]=viewSize(d.getPage(n-1)),bw=Math.min(216,w*.4),bh=Math.min(64,h*.15),m=24;
 const box=o.svis===false||o.svis==='false'?null:[o.spos&&o.spos[1]==='l'?m:w-m-bw,o.spos&&o.spos[0]==='t'?m:h-m-bh,0,0];if(box){box[2]=box[0]+bw;box[3]=box[1]+bh}
 const out=await signPdf(bytes,{id:st.id,box,page:n,reason:o.reason,location:o.location,certify:!!o.certify&&o.certify!=='false',perm:1});return[{name:stem(f.name)+'-signed.pdf',bytes:out}]}
/* ---------- security on save ---------- */
function securityDialog(){if(!S.pages.length)return toast('Open a PDF first');const cur=B2.sec.get(S.pdf)||{};
 modal('Document security',`<div class="hint fld">Applied every time you save this document as a PDF (Save / Save flattened), and to "Save secured copy".</div>${secForm(cur,'data-s')}
 <label class="chk fld"><input type="checkbox" data-s="extract" ${cur.extract===false?'':'checked'}> Allow copying text and images</label>`,
 [{label:'Cancel',cancel:1},{label:'Remove security',fn:()=>{B2.sec.delete(S.pdf);toast('Security removed — saves will not be encrypted')}},{label:'Save secured copy',fn:md=>{const o=readSec(md);if(!o)return false;B2.sec.set(S.pdf,o);setTimeout(()=>saveSecuredCopy(),0)}},{label:'Apply',pri:1,fn:md=>{const o=readSec(md);if(!o)return false;B2.sec.set(S.pdf,o);toast('Security will be applied when you save')}}])}
function readSec(md){const o=readOpts(md,'data-s');o.bits=+o.bits||256;if(!o.user&&!o.owner){toast('Enter an open password and/or a permissions password');return null}if(!o.owner)o.owner=o.user;return o}
async function saveSecuredCopy(){try{const cfg=B2.sec.get(S.pdf);if(!cfg)return toast('Set security first');const raw=B2.raw.get(S.pdf)||S.bytes;if(isSigned(raw)&&!S.markups.length){toast('Signed PDFs cannot be encrypted without breaking their signatures');return}
 const b=S.markups.length?await PMOutput.markedPdf(false):raw;const e=await encryptBytes(b,cfg);B2.bypass=true;try{await saveFile(baseName()+'-secured.pdf',new Blob([e],{type:'application/pdf'}))}finally{B2.bypass=false}return e}catch(e){toast('Could not secure: '+e.message)}}
{const _sf=saveFile;saveFile=async function(name,data){const cfg=S.pdf&&B2.sec.get(S.pdf);
 if(cfg&&!B2.bypass&&/-(markup|flattened)\.pdf$/i.test(name)){try{let u=data instanceof Blob?new Uint8Array(await data.arrayBuffer()):data instanceof Uint8Array?data:new Uint8Array(data);if(!isSigned(u)){u=await encryptBytes(u,cfg);data=new Blob([u],{type:'application/pdf'});B2.lastEncrypted=u}}catch(e){toast('Encryption failed: '+e.message);return}}
 return _sf.apply(this,[name,data])}}
/* raw bytes of each opened file (signature validation needs the exact bytes) */
{const _ob=openBytes;openBytes=async function(bytes,name,restored){if(!restored)B2.lastRaw=bytes;const r=await _ob.apply(this,arguments);if(!restored&&S.pdf){B2.raw.set(S.pdf,B2.lastRaw);refreshSigPane().catch(e=>console.warn(e));
  if(isSigned(B2.lastRaw))validateSignatures(B2.lastRaw).then(vs=>{const bad=vs.filter(v=>v.status==='invalid').length,ok=vs.filter(v=>v.status==='valid').length;toast(`${vs.length} signature${vs.length>1?'s':''}: ${bad?bad+' INVALID':ok===vs.length?'all valid':'valid, signer not trusted'}`)}).catch(()=>{})}return r}}
/* ---------- wiring ---------- */
const ICO_B2='<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M15 17h6M18 14v6"/>';
const ICO_SEC='<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>';
function menu(title,items){modal(title,`<div style="display:grid;gap:6px">${items.map((it,i)=>`<button class="btn" data-mi="${i}" style="border:1px solid var(--line);justify-content:flex-start;text-align:left;height:auto;padding:8px 10px"><b>${esc(it[0])}</b>${it[2]?`<br><small style="color:var(--mut)">${esc(it[2])}</small>`:''}</button>`).join('')}</div>`,[{label:'Close',cancel:1}]);
 document.querySelectorAll('[data-mi]').forEach(b=>b.onclick=()=>{closeModal();setTimeout(items[+b.dataset.mi][1],0)})}
H.ribbon.push({label:'Batch Files',title:'Batch: headers/Bates, crop, rotate, split, reduce, flatten, stamp, OCR, security, sign, summary, images→PDF, print, compare/overlay',icon:ICO_B2,fn:()=>menu('Batch on many files',[['Batch process files…',()=>batchFilesDialog(),'Headers, footers & Bates, watermark, crop, rotate, split, reduce, flatten, stamp, OCR, security, sign, summary, print'],['Images to PDF…',()=>{batchFilesDialog();setTimeout(()=>{const b=$('#b2Img');if(b)b.click()},50)},'Combine images into PDFs'],['Batch compare / overlay…',batchCompareDialog,'Two lists of revisions paired by name'],['Export pages as images…',()=>exportImagesDialog(),'PNG, JPEG or TIFF']])});
H.ribbon.push({label:'Secure',title:'Digital IDs, sign, certify, validate signatures, trusted identities, password security',icon:ICO_SEC,fn:()=>menu('Digital signatures & security',[['Sign with a digital ID…',()=>signDialog(false),'Certificate-based signature (PKCS#7, SHA-256)'],['Certify document…',()=>signDialog(true),'Author signature that limits later changes'],['Validate signatures',()=>{switchTab('signatures');refreshSigPane()}],['Digital IDs…',idsDialog,'Create self-signed or import .pfx/.p12'],['Trusted identities…',trustDialog],['Password security…',securityDialog,'AES-256/128, open & permissions passwords']])});
H.ready.push(()=>{const rp=H.ribbon.find(r=>r.label==='Print');if(rp){rp.fn=()=>printDialog2();rp.title='Print: content, N-up, paper, auto-rotate, dim, links, DPI, export images (Ctrl+P)'}
 const rc=H.ribbon.find(r=>r.label==='Compare');if(rc)rc.fn=compareDialog2;
 sigPane=addTab('signatures','Signatures');refreshSigPane()});
H.open.push(()=>{A3=null});
Object.assign(window.PMBatch2,{compareCore,autoAlignPages,alignGray,solveAffine,mulM,applyM,layeredPdf,overlayLayerFrom,multiOverlay,start3pt,autoAlignLayer,runCompare2,compareDialog2,pairFiles,normName,runBatchCompare,batchCompareDialog,
 aggImages,contentBytes,layoutPrint,buildPrint,runPrint2,printDialog2,rasterizePdf,encodeTiff,packBits,exportImages,exportImagesDialog,
 createDigitalId,importDigitalId,unlockId,ensureUnlocked,signPdf,validateSignatures,signCurrent,signDialog,idsDialog,trustDialog,trustCert,refreshSigPane,securityDialog,saveSecuredCopy,opSign,getIds,getTrusted,A3:()=>A3});
})();
