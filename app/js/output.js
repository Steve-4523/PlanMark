/* PlanMark — printing (fit / to scale / tiled / region), summary reports (PDF), Excel export */
(function(){
const PAPERS={Letter:[8.5,11],Legal:[8.5,14],Tabloid:[11,17],'ARCH A':[9,12],'ARCH B':[12,18],'ARCH C':[18,24],'ARCH D':[24,36],'ARCH E':[36,48],'ANSI C':[17,22],'ANSI D':[22,34],'ANSI E':[34,44],A4:[8.27,11.69],A3:[11.69,16.54],A1:[23.39,33.11],A0:[33.11,46.81]};
/* capture the bytes of a marked-up / flattened PDF without saving a file */
async function markedPdf(flat){const orig=saveFile;let out=null;saveFile=async(name,data)=>{out=new Uint8Array(await (data instanceof Blob?data.arrayBuffer():new Blob([data]).arrayBuffer()))};
 try{await exportPDF(flat)}finally{saveFile=orig}if(!out)throw new Error('Could not build the PDF');return out}
window.PMOutput={markedPdf};
/* ---------- print ---------- */
function printDialog(){if(!S.pages.length)return toast('Open a PDF first');const dv=window.pmDesktop&&window.pmDesktop.printImages;
 modal('Print',`<div class="fld"><label>Pages</label><select class="ti" id="prP"><option value="cur">Current page (${S.cur})</option><option value="all">All pages (${S.pages.length})</option><option value="rng">Range…</option><option value="region">A region of the current page…</option></select><input class="ti" id="prR" placeholder="e.g. 1-3, 7" style="margin-top:6px;display:none"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Paper</label><select class="ti" id="prPa"><option value="auto">Same as drawing</option>${Object.keys(PAPERS).map(k=>`<option ${k==='Letter'?'':''}>${k}</option>`).join('')}</select></div>
 <div><label style="font-size:11px;color:var(--mut)">Orientation</label><select class="ti" id="prO"><option value="auto">Auto</option><option value="p">Portrait</option><option value="l">Landscape</option></select></div></div>
 <div class="fld"><label>Scaling</label><select class="ti" id="prS"><option value="fit">Fit to paper</option><option value="actual">Actual size (prints to scale)</option><option value="tile">Tile — actual size across several sheets</option><option value="pct">Custom %…</option></select><input class="ti" id="prPct" type="number" value="50" style="margin-top:6px;display:none"></div>
 <div class="row fld"><label class="chk"><input type="checkbox" id="prM" checked> Include markups</label><label class="chk"><input type="checkbox" id="prG"> Grayscale</label><label class="chk"><input type="checkbox" id="prC" checked> Tile crop marks</label></div>
 <div class="hint">${dv?'Opens the Windows print dialog (choose any printer, or "Microsoft Print to PDF").':'In the browser version this makes a print-ready PDF to open and print from your PDF viewer. The Windows app prints directly.'}</div>`,
 [{label:'Cancel',cancel:1},{label:dv?'Print…':'Make print PDF',pri:1,fn:md=>{const o={pages:md.querySelector('#prP').value,rng:md.querySelector('#prR').value,paper:md.querySelector('#prPa').value,orient:md.querySelector('#prO').value,scale:md.querySelector('#prS').value,pct:+md.querySelector('#prPct').value||100,marks:md.querySelector('#prM').checked,gray:md.querySelector('#prG').checked,crop:md.querySelector('#prC').checked};
  setTimeout(()=>runPrint(o),0)}}]);
 $('#prP').onchange=e=>{$('#prR').style.display=e.target.value==='rng'?'block':'none'};$('#prS').onchange=e=>{$('#prPct').style.display=e.target.value==='pct'?'block':'none'}}
async function runPrint(o){try{let region=null;if(o.pages==='region'){const r=await PMAuto.pickRegion('Print: pick the area to print');region=r}
 toast('Preparing pages…');const src=await PDFLib.PDFDocument.load(o.marks?await markedPdf(true):S.bytes,{ignoreEncryption:true});
 const pages=region?[region.page]:o.pages==='cur'?[S.cur]:o.pages==='all'?S.pages.map(p=>p.num):parseRange(o.rng);if(!pages.length)return toast('No pages selected');
 const out=await PDFLib.PDFDocument.create(),font=await out.embedFont(PDFLib.StandardFonts.Helvetica);
 for(const n of pages){const sp=src.getPage(n-1),vp=S.pages[n-1].vp;let box=region?region.box:[0,0,vp.width,vp.height];
  // embed the (rotated) page region; boundingBox is in PDF user space
  const c1=vp.convertToPdfPoint(box[0],box[1]),c2=vp.convertToPdfPoint(box[2],box[3]);const bb={left:Math.min(c1[0],c2[0]),bottom:Math.min(c1[1],c2[1]),right:Math.max(c1[0],c2[0]),top:Math.max(c1[1],c2[1])};
  const ep=await out.embedPage(sp,bb);const rot=(vp.rotation||0)%360,cw=box[2]-box[0],ch=box[3]-box[1];// content size as viewed
  let pw,ph;if(o.paper==='auto'){pw=cw;ph=ch}else{const[a,b]=PAPERS[o.paper];pw=a*72;ph=b*72;const land=o.orient==='l'||(o.orient==='auto'&&cw>ch);if(land!==(pw>ph))[pw,ph]=[ph,pw]}
  const place=(page,sx,dx,dy)=>{// draw page content scaled by sx, its viewed top-left at (dx,dy) from page top-left
   const W=cw*sx,Hh=ch*sx,ph_=page.getHeight();const opts={xScale:sx,yScale:sx,rotate:PDFLib.degrees(-rot)};
   let x=dx,y=ph_-dy-Hh;if(rot===90){x=dx;y=ph_-dy}else if(rot===180){x=dx+W;y=ph_-dy}else if(rot===270){x=dx+W;y=ph_-dy-Hh}
   page.drawPage(ep,Object.assign(opts,{x,y}))};
  if(o.scale==='tile'){const m=18,ov=36,uw=pw-2*m,uh=ph-2*m,step=[uw-ov,uh-ov],nx=Math.max(1,Math.ceil((cw-ov)/step[0])),ny=Math.max(1,Math.ceil((ch-ov)/step[1]));
   for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const pg=out.addPage([pw,ph]);place(pg,1,m-i*step[0],m-j*step[1]);
    pg.drawRectangle({x:0,y:0,width:pw,height:m,color:PDFLib.rgb(1,1,1)});pg.drawRectangle({x:0,y:ph-m,width:pw,height:m,color:PDFLib.rgb(1,1,1)});pg.drawRectangle({x:0,y:0,width:m,height:ph,color:PDFLib.rgb(1,1,1)});pg.drawRectangle({x:pw-m,y:0,width:m,height:ph,color:PDFLib.rgb(1,1,1)});
    if(o.crop){const k=PDFLib.rgb(.4,.4,.4);for(const[x,y]of[[m,m],[pw-m,m],[m,ph-m],[pw-m,ph-m]]){pg.drawLine({start:{x:x-10,y},end:{x:x+10,y},thickness:.4,color:k});pg.drawLine({start:{x,y:y-10},end:{x,y:y+10},thickness:.4,color:k})}}
    pg.drawText(`Page ${n} · tile ${String.fromCharCode(65+j)}${i+1} of ${ny}×${nx} · overlap 1/2"`,{x:m,y:5,size:7,font,color:PDFLib.rgb(.35,.35,.35)})}}
  else{let sx=1;if(o.paper!=='auto'||o.scale==='pct'){if(o.scale==='fit')sx=Math.min((pw-36)/cw,(ph-36)/ch);else if(o.scale==='pct')sx=o.pct/100;else sx=1}
   if(o.paper==='auto'&&o.scale==='pct'){pw=cw*sx;ph=ch*sx}const pg=out.addPage([pw,ph]);place(pg,sx,(pw-cw*sx)/2,(ph-ch*sx)/2)}}
 const bytes=await out.save();
 if(window.pmDesktop&&window.pmDesktop.printImages){toast('Rendering for the printer…');const doc=await pdfjsLib.getDocument({data:bytes.slice()}).promise,imgs=[];
  for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i),v1=pg.getViewport({scale:1}),k=Math.min(200/72,Math.sqrt(40e6/(v1.width*v1.height))),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;if(o.gray){ctx.globalCompositeOperation='saturation';ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height)}
   imgs.push({dataUrl:c.toDataURL('image/png'),wIn:v1.width/72,hIn:v1.height/72})}doc.destroy();
  const r=await window.pmDesktop.printImages(imgs);if(r&&r.ok===false&&r.reason!=='cancelled')toast('Printing failed: '+(r.reason||''));else if(r&&r.ok)toast('Sent to printer')}
 else await saveFile(baseName()+'-print.pdf',new Blob([bytes],{type:'application/pdf'}))}
 catch(e){console.error(e);toast('Print failed: '+(e.message||e))}}
/* ---------- markup summary report (PDF) ---------- */
function reportDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Markup summary report',`<div class="fld"><label>Title</label><input class="ti" id="rpT" value="${esc(baseName())} — Markup Summary"></div>
 <div class="fld"><label>Markups</label><select class="ti" id="rpW"><option value="list">As filtered in the Markups list</option><option value="sel">Selected only</option><option value="all">All</option></select></div>
 <div class="fld"><label>Group by</label><select class="ti" id="rpG"><option value="page">Page</option><option value="subject">Subject</option><option value="status">Status</option><option value="none">None</option></select></div>
 <div class="row fld"><label class="chk"><input type="checkbox" id="rpTh" checked> Thumbnails</label><label class="chk"><input type="checkbox" id="rpS" checked> Quantity totals</label><label class="chk"><input type="checkbox" id="rpPg"> Append marked-up pages</label></div>`,
 [{label:'Cancel',cancel:1},{label:'Create PDF',pri:1,fn:md=>{const o={title:md.querySelector('#rpT').value,which:md.querySelector('#rpW').value,group:md.querySelector('#rpG').value,thumbs:md.querySelector('#rpTh').checked,sums:md.querySelector('#rpS').checked,pages:md.querySelector('#rpPg').checked};setTimeout(()=>makeReport(o),0)}}])}
async function pageCanvas(n,k){const pg=await S.pdf.getPage(n),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 await pg.render({canvasContext:ctx,viewport:vp}).promise;ctx.save();ctx.scale(k,k);for(const m of S.markups){if(m.page!==n||m.hidden)continue;drawPrimsCanvas(ctx,prims(m))}ctx.restore();return c}
function drawPrimsCanvas(ctx,ps){for(const p of ps){ctx.save();if(p.k==='p'){const path=new Path2D(p.d);if(p.fill){ctx.globalAlpha=(p.fo??1)*(p.so??1);ctx.fillStyle=p.fill;ctx.fill(path,'evenodd')}if(p.stroke&&p.w>0){ctx.globalAlpha=p.so??1;ctx.strokeStyle=p.stroke;ctx.lineWidth=p.w;ctx.lineJoin=ctx.lineCap='round';const da=dashArr(p);if(da)ctx.setLineDash(da);if(p.blend)ctx.globalCompositeOperation='multiply';ctx.stroke(path)}}
 else if(p.k==='t'){ctx.globalAlpha=p.o??1;ctx.translate(p.x,p.y);if(p.ang)ctx.rotate(p.ang*Math.PI/180);ctx.font=`${p.italic?'italic ':''}${p.bold?'bold ':''}${p.size}px ${FONTS[p.font]||FONTS.Helvetica}`;ctx.textAlign=p.align==='middle'?'center':'left';ctx.textBaseline='middle';if(p.halo){ctx.lineWidth=p.size*.28;ctx.strokeStyle='#fff';ctx.strokeText(p.s,0,0)}ctx.fillStyle=p.color;ctx.fillText(p.s,0,0)}
 ctx.restore()}}
window.drawPrimsCanvas=drawPrimsCanvas;
async function makeReport(o){try{toast('Building report…');const ids=o.which==='sel'?new Set(S.sel):null;let rows=o.which==='list'?listRows():S.markups.map(m=>({m,r:measOf(m)}));if(ids)rows=rows.filter(r=>ids.has(r.m.id));
 if(!rows.length)return toast('No markups to report');
 const gk=r=>o.group==='page'?'Page '+r.m.page:o.group==='subject'?r.m.subject:o.group==='status'?(r.m.status||'No status'):'';rows.sort((a,b)=>String(gk(a)).localeCompare(String(gk(b)),undefined,{numeric:true})||a.m.page-b.m.page);
 const D=await PDFLib.PDFDocument.create(),F=await D.embedFont(PDFLib.StandardFonts.Helvetica),FB=await D.embedFont(PDFLib.StandardFonts.HelveticaBold),W=792,Hh=612,M=36,gray=PDFLib.rgb(.4,.4,.4),line=PDFLib.rgb(.85,.85,.85);
 let page,y;const pages=[];const np=()=>{page=D.addPage([W,Hh]);pages.push(page);y=Hh-M;page.drawText(safeTxt(o.title),{x:M,y,size:14,font:FB});y-=14;page.drawText(safeTxt(`${S.fileName} · ${rows.length} markups · ${new Date().toLocaleString()} · ${settings.author}`),{x:M,y,size:8,font:F,color:gray});y-=16};np();
 const fit=(s,w,f,sz)=>{s=safeTxt(s);if(f.widthOfTextAtSize(s,sz)<=w)return s;while(s.length>1&&f.widthOfTextAtSize(s+'…',sz)>w)s=s.slice(0,-1);return s+'…'};
 const wrapT=(s,w,f,sz)=>{const out=[];for(const para of safeTxt(s).split('\n')){let l='';for(const wd of para.split(' ')){const t=l?l+' '+wd:wd;if(!l||f.widthOfTextAtSize(t,sz)<=w)l=t;else{out.push(l);l=wd}}out.push(l)}return out.filter((x,i)=>x||i===0)};
 if(o.sums){const sr=summaryRows(rows).filter(s=>s.text||s.count);page.drawText('Quantities',{x:M,y,size:11,font:FB});y-=14;
  for(const s of sr){if(y<M+20)np();page.drawRectangle({x:M,y:y-2,width:8,height:8,color:hexRgb(s.color||'#888')});page.drawText(fit(s.subject,300,F,9),{x:M+14,y,size:9,font:F});page.drawText(String(s.count),{x:M+330,y,size:9,font:F});page.drawText(fit((s.text||'')+(s.extext?'  ·  '+s.extext:''),300,F,9),{x:M+380,y,size:9,font:F});y-=13}y-=10}
 const cache={};const thumbK=1.2;const TH=o.thumbs?90:0;let lastG=null;
 for(const{m,r}of rows){const g=gk({m});const lines=wrapT([m.label||m.text,m.comment].filter(Boolean).join(' — ')||'',o.thumbs?420:560,F,8.5).slice(0,4);const need=Math.max(TH,28+lines.length*11)+10;
  if(y-need<M)np();if(o.group!=='none'&&g!==lastG){if(y-need-18<M)np();lastG=g;page.drawText(safeTxt(g),{x:M,y,size:11,font:FB});y-=16}
  let x=M;if(o.thumbs){if(!cache[m.page])cache[m.page]=await pageCanvas(m.page,thumbK);const pc=cache[m.page],b=bboxOf(m),pad=24,bx=[Math.max(0,b[0]-pad),Math.max(0,b[1]-pad),Math.min(S.pages[m.page-1].w,b[2]+pad),Math.min(S.pages[m.page-1].h,b[3]+pad)];
   const sw=(bx[2]-bx[0])*thumbK,sh=(bx[3]-bx[1])*thumbK,c=document.createElement('canvas'),sc=Math.min(1,600/Math.max(sw,sh));c.width=Math.max(1,sw*sc);c.height=Math.max(1,sh*sc);c.getContext('2d').drawImage(pc,bx[0]*thumbK,bx[1]*thumbK,sw,sh,0,0,c.width,c.height);
   const png=await D.embedPng(await new Promise(res=>c.toBlob(async bl=>res(new Uint8Array(await bl.arrayBuffer())),'image/png'))),s=Math.min(150/png.width,TH/png.height);page.drawRectangle({x:M,y:y-TH+8,width:150,height:TH,borderColor:line,borderWidth:.6});
   page.drawImage(png,{x:M+(150-png.width*s)/2,y:y-TH+8+(TH-png.height*s)/2,width:png.width*s,height:png.height*s});x=M+162}
  page.drawRectangle({x,y:y-1,width:8,height:8,color:hexRgb(m.style.stroke||'#888')});page.drawText(fit(m.subject||T[m.type].label,260,FB,10),{x:x+13,y,size:10,font:FB});
  page.drawText(fit(`p${m.page}${m.status?' · '+m.status:''} · ${m.author||''} · ${fmtDT(m.created)}`,260,F,8),{x:x+290,y:y+1,size:8,font:F,color:gray});
  let yy=y-13;if(r){page.drawText(fit(r.text+(r.extra?'  ·  '+r.extra.text:''),500,F,9),{x:x+13,y:yy,size:9,font:F,color:PDFLib.rgb(.1,.3,.6)});yy-=12}
  for(const l of lines){page.drawText(l,{x:x+13,y:yy,size:8.5,font:F});yy-=11}
  y=Math.min(y-TH-4,yy-8);page.drawLine({start:{x:M,y:y+4},end:{x:W-M,y:y+4},thickness:.4,color:line})}
 pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:W-M-30,y:18,size:8,font:F,color:gray}));
 if(o.pages){const mk=await PDFLib.PDFDocument.load(await markedPdf(true),{ignoreEncryption:true});const used=[...new Set(rows.map(r=>r.m.page))].sort((a,b)=>a-b);(await D.copyPages(mk,used.map(n=>n-1))).forEach(p=>D.addPage(p))}
 await saveFile(baseName()+'-markup-summary.pdf',new Blob([await D.save()],{type:'application/pdf'}))}
 catch(e){console.error(e);toast('Report failed: '+(e.message||e))}}
/* ---------- Excel (.xlsx) export ---------- */
const xesc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
function colName(i){let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
function sheetXml(rows){const w=rows[0].map((_,ci)=>Math.min(60,Math.max(8,...rows.map(r=>String(r[ci]??'').length+2))));
 return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x,i)=>`<col min="${i+1}" max="${i+1}" width="${x}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{const ref=colName(ci)+(ri+1);if(typeof v==='number'&&isFinite(v))return`<c r="${ref}"${ri===0?' s="1"':''}><v>${v}</v></c>`;return`<c r="${ref}" t="inlineStr"${ri===0?' s="1"':''}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${colName(rows[0].length-1)}${rows.length}"/></worksheet>`}
async function xlsx(sheets){const z=new JSZip();z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 z.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xesc(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 z.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 z.file('xl/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`);
 sheets.forEach((s,i)=>z.file(`xl/worksheets/sheet${i+1}.xml`,sheetXml(s.rows)));return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
async function exportExcel(){if(!S.markups.length)return toast('No markups to export');const keep=S.summary;
 try{S.summary=false;const det=tableData();S.summary=true;const sum=tableData();S.summary=keep;
  const sheets=[{name:'Markups',rows:det},{name:'Quantities',rows:sum}];
  const sc=S.pages.map(p=>{const s=scaleFor(p.num);return[p.num,s.label,s.unit==='ftin'?'ft-in':UNITS[s.unit].abbr]});sheets.push({name:'Pages',rows:[['Page','Scale','Units'],...sc]});
  await saveFile(baseName()+'-takeoff.xlsx',await xlsx(sheets))}catch(e){S.summary=keep;console.error(e);toast('Excel export failed: '+(e.message||e))}}
window.PMOutput.exportExcel=exportExcel;window.PMOutput.xlsx=xlsx;
/* ---------- wiring ---------- */
H.ribbon.splice(1,0,{label:'Print',title:'Print, print to scale, tile, print a region (Ctrl+P)',icon:'<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',fn:printDialog},
 {label:'Report',title:'Markup summary report (PDF) and Excel takeoff export',icon:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 15h6M9 18h4"/>',fn:()=>{modal('Reports & export',`<div style="display:flex;flex-direction:column;gap:8px"><button class="btn" id="rxP" style="border:1px solid var(--line);justify-content:flex-start">Markup summary report (PDF, with thumbnails)</button><button class="btn" id="rxX" style="border:1px solid var(--line);justify-content:flex-start">Takeoff to Excel (.xlsx — markups, quantities, scales)</button><button class="btn" id="rxC" style="border:1px solid var(--line);justify-content:flex-start">Markups list as CSV</button></div>`,[{label:'Close',cancel:1}]);$('#rxP').onclick=()=>{closeModal();reportDialog()};$('#rxX').onclick=()=>{closeModal();exportExcel()};$('#rxC').onclick=()=>{closeModal();$('#mlCsv').click()}}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'&&!e.shiftKey){e.preventDefault();if(!modalCb)printDialog()}},true);
H.ready.push(()=>{const b=document.createElement('button');b.className='btn';b.id='mlXlsx';b.textContent='Excel';b.title='Export takeoff to Excel';b.onclick=exportExcel;const c=$('#mlCsv');if(c)c.after(b)});
Object.assign(window.PMOutput,{printDialog,runPrint,reportDialog,makeReport});
})();
