/* PlanMark — Overlay layers, Compare Documents */
(function(){
S.layers=[];S.align=null;
const ICO_CMP='<path d="M4 4h7v16H4zM13 4h7v16h-7z"/><path d="M7 9h1M7 13h1M16 9h1M16 13h2"/>';
const ICO_OVL='<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>';
async function loadPdfFile(file){const b=new Uint8Array(await file.arrayBuffer());return pdfjsLib.getDocument({data:b,isEvalSupported:false}).promise}
// render a page of any pdf to a canvas of given pixel size (fits page into target width)
async function renderTo(doc,num,W,H){const pg=await doc.getPage(num),vp1=pg.getViewport({scale:1}),s=W/vp1.width,vp=pg.getViewport({scale:s});
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
 await pg.render({canvasContext:ctx,viewport:vp,background:'white'}).promise;return c}
function workSize(p){const k=Math.min(2.2,Math.sqrt(9e6/(p.w*p.h)));return{k,W:Math.round(p.w*k),H:Math.round(p.h*k)}}
function hexToRgb(h){const n=parseInt(h.replace('#',''),16);return[n>>16&255,n>>8&255,n&255]}
function canvasUrl(c){return new Promise(r=>c.toBlob(b=>r(URL.createObjectURL(b)),'image/png'))}
function recolor(c,hex){const ctx=c.getContext('2d'),id=ctx.getImageData(0,0,c.width,c.height),d=id.data,[R,G,B]=hexToRgb(hex);
 for(let i=0;i<d.length;i+=4){const l=(d[i]*.3+d[i+1]*.59+d[i+2]*.11),a=255-l;d[i]=R;d[i+1]=G;d[i+2]=B;d[i+3]=a<18?0:Math.min(255,a*1.4)}ctx.putImageData(id,0,0);return c}
function addLayer(o){const L=Object.assign({id:uid(),visible:true,opacity:.85,matrix:[1,0,0,1,0,0],blend:true},o);S.layers.push(L);renderLayers();redrawPage(L.page);switchTab('layers');return L}
H.under.push(n=>{let h='';for(const L of S.layers){if(L.page!==n||!L.visible)continue;const p=S.pages[n-1];
 h+=`<image href="${L.url}" x="0" y="0" width="${p.w}" height="${p.h}" preserveAspectRatio="none" opacity="${L.opacity}" transform="matrix(${L.matrix.join(' ')})" pointer-events="none"${L.blend?' style="mix-blend-mode:multiply"':''}/>`}return h});
H.over.push(n=>{const a=S.align;if(!a||!a.pts.length)return'';let h='';const r=6/S.zoom,w=1.5/S.zoom;a.pts.forEach((q,i)=>{if(q.page!==n)return;const c=i%2?'#0ea5e9':'#ef4444';h+=`<circle cx="${q.x}" cy="${q.y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/><text x="${q.x+r*1.4}" y="${q.y-r}" font-size="${11/S.zoom}" fill="${c}" font-weight="bold">${['A','A′','B','B′'][i]}</text>`});return`<g pointer-events="none">${h}</g>`});
const STEPS=['Click point A on the CURRENT sheet','Click the same point A on the OVERLAY','Click point B on the CURRENT sheet (far from A)','Click the same point B on the OVERLAY'];
H.down=(prev=>(e,p,pt)=>{if(S.align&&p){const a=S.align;if(p.num!==a.layer.page){toast('Click on page '+a.layer.page);return true}const q=sp(p,pt,e);a.pts.push({page:p.num,x:q[0],y:q[1]});
  if(a.pts.length<4){$('#hint').textContent='Align overlay: '+STEPS[a.pts.length];redrawPage(p.num);return true}
  const[A,A2,B,B2]=a.pts,v1=[B2.x-A2.x,B2.y-A2.y],v2=[B.x-A.x,B.y-A.y],L1=Math.hypot(...v1);if(L1<1){toast('Points too close');S.align=null;redrawPage(p.num);return true}
  let s=Math.hypot(...v2)/L1,th=Math.atan2(v2[1],v2[0])-Math.atan2(v1[1],v1[0]);if(!a.rotate){th=0}if(!a.scale)s=1;
  const ca=s*Math.cos(th),sa=s*Math.sin(th),M=[ca,sa,-sa,ca,0,0];M[4]=A.x-(M[0]*A2.x+M[2]*A2.y);M[5]=A.y-(M[1]*A2.x+M[3]*A2.y);
  const Lm=a.layer.matrix;a.layer.matrix=[M[0]*Lm[0]+M[2]*Lm[1],M[1]*Lm[0]+M[3]*Lm[1],M[0]*Lm[2]+M[2]*Lm[3],M[1]*Lm[2]+M[3]*Lm[3],M[0]*Lm[4]+M[2]*Lm[5]+M[4],M[1]*Lm[4]+M[3]*Lm[5]+M[5]];
  S.align=null;updateRibbon();redrawPage(p.num);renderLayers();toast('Overlay aligned');return true}
 return prev?prev(e,p,pt):false})(H.down);
function startAlign(L){if(S.tool!=='select')setTool('select');S.align={layer:L,pts:[],scale:$('#alScale')?.checked??true,rotate:$('#alRot')?.checked??true};gotoPage(L.page);$('#hint').textContent='Align overlay: '+STEPS[0];toast('Align: click 4 points (Esc to cancel)')}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.align){const pg=S.align.layer.page;S.align=null;updateRibbon();redrawPage(pg)}},true);
let tintOn=false;
function renderLayers(){const pane=$('#pane-layers');if(!pane)return;
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn" style="border:1px solid var(--line)" id="lyOv">+ Overlay</button><button class="btn" style="border:1px solid var(--line)" id="lyCmp">Compare</button></div>
 <label class="chk" style="margin-bottom:6px"><input type="checkbox" id="lyTint" ${tintOn?'checked':''}> Show current sheets in red</label>
 <div class="row" style="gap:10px;margin-bottom:8px"><label class="chk"><input type="checkbox" id="alScale" checked> Align scale</label><label class="chk"><input type="checkbox" id="alRot" checked> Align rotation</label></div>
 ${S.layers.length?'':'<div class="hint">No layers yet. Add an overlay to lay another drawing (an older revision, another trade) over this sheet, or run Compare to cloud the differences.</div>'}
 ${S.layers.map(L=>`<div style="border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:8px" data-l="${L.id}">
  <div class="row" style="gap:6px"><label class="chk" style="flex:1;min-width:0"><input type="checkbox" data-lv ${L.visible?'checked':''}><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(L.name)}</span></label>
  ${L.color?`<input type="color" data-lc value="${L.color}" style="width:34px;flex:0;height:24px">`:''}<button class="btn" data-lx title="Remove" style="flex:0;padding:0 6px">✕</button></div>
  <div class="hint" style="margin:3px 0">Page ${L.page}${L.note?' · '+esc(L.note):''}</div>
  <input type="range" min="5" max="100" value="${Math.round(L.opacity*100)}" data-lo>
  ${L.kind==='overlay'?`<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" data-la>Align…</button><button class="btn" style="border:1px solid var(--line)" data-lr>Reset</button><span class="hint" style="flex:1">Nudge:</span><button class="btn" data-ln="-1,0">←</button><button class="btn" data-ln="1,0">→</button><button class="btn" data-ln="0,-1">↑</button><button class="btn" data-ln="0,1">↓</button></div>`:''}</div>`).join('')}`;
 $('#lyOv').onclick=overlayDialog;$('#lyCmp').onclick=compareDialog;
 $('#lyTint').onchange=e=>{tintOn=e.target.checked;applyTint()};}
function applyTint(){S.pages.forEach(p=>p.el.classList.toggle('tint',tintOn))}
H.open.push(()=>{S.layers.forEach(L=>URL.revokeObjectURL(L.url));S.layers=[];S.align=null;renderLayers();setTimeout(applyTint,50)});
H.ready.push(()=>{
 const pane=addTab('layers','Layers');renderLayers();
 pane.addEventListener('input',e=>{const box=e.target.closest('[data-l]');if(!box)return;const L=S.layers.find(x=>x.id===box.dataset.l);if(!L)return;
  if(e.target.matches('[data-lo]')){L.opacity=e.target.value/100;redrawPage(L.page)}
  if(e.target.matches('[data-lc]')&&L.src){L.color=e.target.value;clearTimeout(L.t);L.t=setTimeout(async()=>{const c=document.createElement('canvas');c.width=L.src.width;c.height=L.src.height;c.getContext('2d').drawImage(L.src,0,0);recolor(c,L.color);URL.revokeObjectURL(L.url);L.url=await canvasUrl(c);redrawPage(L.page)},150)}});
 pane.addEventListener('change',e=>{const box=e.target.closest('[data-l]');if(!box)return;const L=S.layers.find(x=>x.id===box.dataset.l);if(L&&e.target.matches('[data-lv]')){L.visible=e.target.checked;redrawPage(L.page)}});
 pane.addEventListener('click',e=>{const box=e.target.closest('[data-l]');if(!box)return;const L=S.layers.find(x=>x.id===box.dataset.l);if(!L)return;
  if(e.target.closest('[data-lx]')){S.layers=S.layers.filter(x=>x!==L);URL.revokeObjectURL(L.url);renderLayers();redrawPage(L.page)}
  if(e.target.closest('[data-la]'))startAlign(L);
  if(e.target.closest('[data-lr]')){L.matrix=[1,0,0,1,0,0];redrawPage(L.page)}
  const nb=e.target.closest('[data-ln]');if(nb){const[dx,dy]=nb.dataset.ln.split(',').map(Number),st=e.shiftKey?10:1;L.matrix[4]+=dx*st;L.matrix[5]+=dy*st;redrawPage(L.page)}});
 const f=document.createElementNS('http://www.w3.org/2000/svg','svg');f.setAttribute('width','0');f.setAttribute('height','0');f.style.position='absolute';
 f.innerHTML='<filter id="pmTintRed" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  .3 .59 .11 0 0  .3 .59 .11 0 0  0 0 0 1 0"/></filter>';document.body.appendChild(f);const stl=document.createElement('style');stl.textContent='.page.tint canvas{filter:url(#pmTintRed)}';document.head.appendChild(stl);
 H.ribbon.length; // ribbon buttons registered below before buildRibbon
});
H.ribbon.push({label:'Compare',title:'Compare two revisions and cloud the differences',icon:ICO_CMP,fn:()=>compareDialog()});
H.ribbon.push({label:'Overlay',title:'Overlay another drawing on this sheet',icon:ICO_OVL,fn:()=>overlayDialog()});
function pickDialog(title,extra,okLabel,run){if(!S.pages.length){toast('Open a PDF first');return}
 modal(title,`<div class="fld"><label>Other PDF</label><input type="file" id="cpF" accept="application/pdf,.pdf" class="ti"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Page of this document</label><input class="ti" type="number" id="cpA" min="1" max="${S.pages.length}" value="${S.cur}"></div>
 <div><label style="font-size:11px;color:var(--mut)">Page of other PDF</label><input class="ti" type="number" id="cpB" min="1" value="${S.cur}"></div></div>${extra}`,
 [{label:'Cancel',cancel:1},{label:okLabel,pri:1,fn:md=>{const f=md.querySelector('#cpF').files[0];if(!f){toast('Choose the other PDF');return false}
  const opts={file:f,a:clamp(+md.querySelector('#cpA').value||1,1,S.pages.length),b:Math.max(1,+md.querySelector('#cpB').value||1)};md.querySelectorAll('[data-o]').forEach(el=>opts[el.dataset.o]=el.type==='checkbox'?el.checked:el.value);run(opts)}}]);
}
function overlayDialog(){pickDialog('Overlay drawing',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Overlay color</label><input type="color" data-o="color" value="#1d4ed8"></div><div><label class="chk" style="margin-top:18px"><input type="checkbox" data-o="tint" checked> Show this sheet in red</label></div></div>
 <div class="hint">After adding, use <b>Align…</b> in the Layers panel to line up two common points (grid line intersections work well).</div>`,'Add overlay',async o=>{
 try{toast('Rendering overlay…');const doc=await loadPdfFile(o.file);const bn=Math.min(o.b,doc.numPages),p=S.pages[o.a-1],{W,H}=workSize(p);const c=await renderTo(doc,bn,W,H);
  const src=document.createElement('canvas');src.width=W;src.height=H;src.getContext('2d').drawImage(c,0,0);recolor(c,o.color);
  addLayer({kind:'overlay',name:o.file.name+' p'+bn,page:o.a,url:await canvasUrl(c),color:o.color,src});if(o.tint){tintOn=true;applyTint();renderLayers()}gotoPage(o.a);doc.destroy()}catch(e){toast('Overlay failed: '+(e.message||e))}})}
function compareDialog(){pickDialog('Compare documents',`<div class="hint" style="margin-bottom:8px">Pick the OTHER revision (usually the older one). Differences are clouded on this document's page.</div>
 <div class="fld"><label>Sensitivity</label><select class="ti" data-o="sens"><option value="2">High (small changes)</option><option value="5" selected>Normal</option><option value="12">Low (ignore tiny shifts)</option></select></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Cloud color</label><input type="color" data-o="color" value="#e0312b"></div><div><label class="chk" style="margin-top:18px"><input type="checkbox" data-o="layer" checked> Add color diff layer</label></div></div>`,'Compare',runCompare)}
async function runCompare(o){
 try{toast('Comparing…');const doc=await loadPdfFile(o.file),bn=Math.min(o.b,doc.numPages),p=S.pages[o.a-1],{k,W,H}=workSize(p);
  const ca=await renderTo(S.pdf,o.a,W,H),cb=await renderTo(doc,bn,W,H);doc.destroy();
  const da=ca.getContext('2d').getImageData(0,0,W,H).data,db=cb.getContext('2d').getImageData(0,0,W,H).data;
  const N=W*H,A=new Uint8Array(N),B=new Uint8Array(N);for(let i=0,j=0;i<N;i++,j+=4){A[i]=(da[j]*.3+da[j+1]*.59+da[j+2]*.11)<190?1:0;B[i]=(db[j]*.3+db[j+1]*.59+db[j+2]*.11)<190?1:0}
  const dil=(X,r)=>{const T1=new Uint8Array(N),T2=new Uint8Array(N);for(let y=0;y<H;y++){let run=-1e9;for(let x=0;x<W;x++){if(X[y*W+x])run=x;if(x-run<=r)T1[y*W+x]=1}run=1e9;for(let x=W-1;x>=0;x--){if(X[y*W+x])run=x;if(run-x<=r)T1[y*W+x]=1}}
   for(let x=0;x<W;x++){let run=-1e9;for(let y=0;y<H;y++){if(T1[y*W+x])run=y;if(y-run<=r)T2[y*W+x]=1}run=1e9;for(let y=H-1;y>=0;y--){if(T1[y*W+x])run=y;if(run-y<=r)T2[y*W+x]=1}}return T2};
  const r=Math.max(1,Math.round(k*0.9)),dA=dil(A,r),dB=dil(B,r);
  const cell=Math.max(4,Math.round(4*k)),gw=Math.ceil(W/cell),gh=Math.ceil(H/cell),cnt=new Uint16Array(gw*gh);
  const img=new ImageData(W,H),id=img.data;let changed=0;
  for(let i=0;i<N;i++){const added=A[i]&&!dB[i],removed=B[i]&&!dA[i],j=i*4;
   if(added){id[j]=0;id[j+1]=170;id[j+2]=60;id[j+3]=255}else if(removed){id[j]=230;id[j+1]=30;id[j+2]=30;id[j+3]=255}else if(A[i]){id[j]=id[j+1]=id[j+2]=150;id[j+3]=70}
   if(added||removed){changed++;const x=i%W,y=(i/W)|0;cnt[((y/cell)|0)*gw+((x/cell)|0)]++}}
  const thr=+o.sens||5,on=new Uint8Array(gw*gh);for(let i=0;i<on.length;i++)on[i]=cnt[i]>=thr?1:0;
  // connected components with a gap tolerance
  const gap=3,lab=new Int32Array(gw*gh).fill(-1),boxes=[];
  for(let i=0;i<on.length;i++){if(!on[i]||lab[i]>=0)continue;const st=[i];lab[i]=boxes.length;let b=[1e9,1e9,-1,-1],n=0;
   while(st.length){const c=st.pop(),cx=c%gw,cy=(c/gw)|0;n+=cnt[c];b=[Math.min(b[0],cx),Math.min(b[1],cy),Math.max(b[2],cx),Math.max(b[3],cy)];
    for(let dy=-gap;dy<=gap;dy++)for(let dx=-gap;dx<=gap;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const ni=ny*gw+nx;if(on[ni]&&lab[ni]<0){lab[ni]=boxes.length;st.push(ni)}}}
   boxes.push({b,n})}
  const pad=8,ms=[];for(const{b,n}of boxes){if(n<thr*2)continue;const x0=b[0]*cell/k-pad,y0=b[1]*cell/k-pad,x1=(b[2]+1)*cell/k+pad,y1=(b[3]+1)*cell/k+pad;
   const st=Object.assign({},S.defaults.cloud,{stroke:o.color,fill:'none'});const m=newMarkup('cloud',o.a,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],st);m.subject='Compare: change';m.comment=`vs ${o.file.name} p${bn}`;ms.push(m)}
  if(ms.length){pushUndo();S.markups.push(...ms);commit()}
  if(o.layer){const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(img,0,0);addLayer({kind:'diff',name:'Compare: '+o.file.name,page:o.a,url:await canvasUrl(c),opacity:.9,note:'red = only in other · green = only in this',blend:true})}
  gotoPage(o.a);toast(ms.length?`Found ${ms.length} changed area${ms.length>1?'s':''} — clouded`:(changed?'Only tiny differences found':'No differences found'))}
 catch(e){console.error(e);toast('Compare failed: '+(e.message||e))}}
window.PMLayers={renderTo,loadPdfFile,canvasUrl};
})();
