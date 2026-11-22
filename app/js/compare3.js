/* PlanMark — Search & compare, round 3:
   1. VisualSearch with a results list: color filter (colors picked from the sample, with tolerance), Limit by selection
      (ignore matches whose lines run outside the box), Apply markup to checked results (any shape, count or Tool Chest item,
      sized to each hit), Hyperlink checked results to a page, Count checked.
   2. Stitch Sheets: join matchline drawings into one continuous vector page (2 point pairs per joint, or auto-align when the
      sheets overlap), keep-areas cropped at the matchlines, optional region labels and markups; new page or new document.
   3. Smart Overlay: set-to-set overlay. Sheets matched by sheet number (page labels → title-block text → page order),
      each pair auto-aligned, old/new or discipline colors, changed-area % per sheet, optional clouds, CSV summary.
   4. Make Annotations from Measurements: measurements made in a Studio Session can stay session-only (not saved into the
      PDF) until you turn them into permanent annotations.
   5. Copy Page to Snapshot (Ctrl+Alt+C, also feeds Paste vector snapshot) and Snapshot Content (Shift+G, no markups).
   Not included: placing a drawing on a map (needs an online map tile service). */
(function(){
const C3={vs:null,stitch:null,so:null,prefs:Object.assign({tol:60,limit:false,colorOn:false},LS.get('pm:c3',{}))};
window.PM_EXTRA_SYNC_KEYS_CP=['pm:c3'];
const savePrefs=()=>LS.set('pm:c3',C3.prefs);
const B2=()=>window.PMBatch2;
const tick=()=>new Promise(r=>setTimeout(r,0));
const ICO_VS='<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/><rect x="7.5" y="7.5" width="5" height="5"/>';
const ICO_ST='<rect x="3" y="5" width="8" height="14"/><rect x="13" y="5" width="8" height="14"/><path d="M11 9h2M11 12h2M11 15h2"/>';
const ICO_SO='<rect x="3" y="3" width="13" height="13" rx="1"/><rect x="8" y="8" width="13" height="13" rx="1"/>';

/* ======================================================================= shared raster helpers */
async function renderRGB(pdf,n,k,W,Hh,M){const pg=await pdf.getPage(n),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=W||Math.ceil(vp.width);c.height=Hh||Math.ceil(vp.height);
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);const tr=M?[M[0],M[1],M[2],M[3],M[4]*k,M[5]*k]:null;
 await pg.render(Object.assign({canvasContext:ctx,viewport:vp,background:'white'},tr?{transform:tr}:{})).promise;return{c,ctx,W:c.width,H:c.height,vp,pg}}
const lum=(r,g,b)=>(r*.3+g*.59+b*.11)/255;
// gray image (1 = paper). With colors, only ink of those colors counts (including anti-aliased blends of the color with the
// paper); everything else becomes paper.
function grayFrom(R,colors,tol){const d=R.ctx.getImageData(0,0,R.W,R.H).data,N=R.W*R.H,g=new Float32Array(N);
 if(!colors||!colors.length){for(let i=0,j=0;i<N;i++,j+=4)g[i]=lum(d[j],d[j+1],d[j+2]);return g}
 const C=colors.map(c=>{const v=[255-c[0],255-c[1],255-c[2]],n2=v[0]*v[0]+v[1]*v[1]+v[2]*v[2]||1;return{v,n2}}),t2=tol*tol;
 for(let i=0,j=0;i<N;i++,j+=4){const w=[255-d[j],255-d[j+1],255-d[j+2]];let best=0;
  if(w[0]+w[1]+w[2]>12)for(const c of C){let a=(w[0]*c.v[0]+w[1]*c.v[1]+w[2]*c.v[2])/c.n2;a=a<0?0:a>1?1:a;const e0=w[0]-a*c.v[0],e1=w[1]-a*c.v[1],e2=w[2]-a*c.v[2];
   // distance from the white→color blend line, scaled up for faint pixels so near-white noise doesn't pass
   if((e0*e0+e1*e1+e2*e2)<=t2*Math.max(.15,a)&&a>best)best=a}
  g[i]=1-best}return g}
function blur(g,W,Hh,passes=2){let a=g.slice(),b=new Float32Array(g.length);for(let p=0;p<passes;p++){for(let y=0;y<Hh;y++){const r=y*W;for(let x=0;x<W;x++){const l=x>0?a[r+x-1]:a[r+x],c=a[r+x],rr=x<W-1?a[r+x+1]:c;b[r+x]=(l+c+rr)/3}}
 for(let y=0;y<Hh;y++){const u=y>0?(y-1)*W:y*W,c=y*W,d=y<Hh-1?(y+1)*W:y*W;for(let x=0;x<W;x++)a[c+x]=(b[u+x]+b[c+x]+b[d+x])/3}}return a}
function tmplFrom(g,W,x0,y0,w,h){const t=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)t[y*w+x]=g[(y0+y)*W+x0+x];return t}
function rot90(t,w,h){const o=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)o[x*h+(h-1-y)]=t[y*w+x];return o}
function prepT(t){let m=0;for(const v of t)m+=v;m/=t.length;let ss=0;const z=new Float32Array(t.length);for(let i=0;i<t.length;i++){z[i]=t[i]-m;ss+=z[i]*z[i]}return{z,norm:Math.sqrt(ss)}}
function integral(g,W,Hh){const I=new Float64Array((W+1)*(Hh+1)),I2=new Float64Array((W+1)*(Hh+1));for(let y=1;y<=Hh;y++){let s=0,s2=0;for(let x=1;x<=W;x++){const v=g[(y-1)*W+x-1];s+=v;s2+=v*v;I[y*(W+1)+x]=I[(y-1)*(W+1)+x]+s;I2[y*(W+1)+x]=I2[(y-1)*(W+1)+x]+s2}}return{I,I2}}
function nccAt(g,W,it,x,y,T,tw,th){const W1=W+1,n=tw*th,{I,I2}=it,s=I[(y+th)*W1+x+tw]-I[y*W1+x+tw]-I[(y+th)*W1+x]+I[y*W1+x],s2=I2[(y+th)*W1+x+tw]-I2[y*W1+x+tw]-I2[(y+th)*W1+x]+I2[y*W1+x];
 const v=s2-s*s/n;if(v<1e-3*n)return -1;let c=0,k=0;for(let j=0;j<th;j++){const row=(y+j)*W+x;for(let i=0;i<tw;i++)c+=T.z[k++]*g[row+i]}return c/(T.norm*Math.sqrt(v))}
// ink pixels in a band just outside box [x0,y0,x1,y1] (pixels) of gray image g
function bandInk(g,W,Hh,x0,y0,x1,y1,bw){let ink=0;const X0=Math.max(0,x0-bw),Y0=Math.max(0,y0-bw),X1=Math.min(W-1,x1+bw),Y1=Math.min(Hh-1,y1+bw);
 for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){if(x>=x0&&x<=x1&&y>=y0&&y<=y1)continue;if(g[y*W+x]<.7)ink++}return ink}
// dominant ink colors inside a region of an RGB render
function sampleColors(R,x0,y0,w,h){const d=R.ctx.getImageData(x0,y0,w,h).data,bins=new Map();let ink=0;
 for(let j=0;j<d.length;j+=4){const r=d[j],g=d[j+1],b=d[j+2];if(lum(r,g,b)>.86)continue;ink++;const key=(r>>5)<<6|(g>>5)<<3|(b>>5);const e=bins.get(key)||{n:0,r:0,g:0,b:0};e.n++;e.r+=r;e.g+=g;e.b+=b;bins.set(key,e)}
 return[...bins.values()].filter(e=>e.n>=Math.max(3,ink*.04)).sort((a,b)=>b.n-a.n).slice(0,6).map(e=>[Math.round(e.r/e.n),Math.round(e.g/e.n),Math.round(e.b/e.n)])}
const rgbHex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
const hexRgb3=h=>{const n=parseInt(String(h).replace('#',''),16);return[n>>16&255,n>>8&255,n&255]};

/* ======================================================================= 1. VisualSearch */
async function visualSearch(){if(!S.pages.length)return toast('Open a PDF first');const r=await PMAuto.pickRegion('VisualSearch: draw a box tightly around ONE symbol');
 const sb=r.box;if(sb[2]-sb[0]<3||sb[3]-sb[1]<3)return toast('That box is too small');
 const k=clamp(40/Math.max(sb[2]-sb[0],sb[3]-sb[1]),.3,5),R=await renderRGB(S.pdf,r.page,k);
 const cols=sampleColors(R,Math.round(sb[0]*k),Math.round(sb[1]*k),Math.max(1,Math.round((sb[2]-sb[0])*k)),Math.max(1,Math.round((sb[3]-sb[1])*k)));
 const P=C3.prefs;
 modal('VisualSearch',`<div class="hint" style="margin-bottom:8px">Finds every place that looks like the symbol you boxed. Review the results, then count them, mark them or link them.</div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Search</label><select class="ti" id="vsP"><option value="cur">This page</option><option value="all">All pages</option></select></div>
 <div><label style="font-size:11px;color:var(--mut)">Match</label><select class="ti" id="vsT"><option value=".9">Exact (90%)</option><option value=".82" selected>Close (82%)</option><option value=".74">Loose (74%)</option></select></div></div>
 <label class="chk fld"><input type="checkbox" id="vsR" checked> Also find it rotated 90° / 180° / 270°</label>
 <label class="chk fld"><input type="checkbox" id="vsL" ${P.limit?'checked':''}> Limit by selection — ignore matches whose lines run outside the box</label>
 <label class="chk fld"><input type="checkbox" id="vsC" ${P.colorOn&&cols.length?'checked':''} ${cols.length?'':'disabled'}> Only match these colors</label>
 <div class="row fld" id="vsCols" style="gap:6px;flex-wrap:wrap">${cols.length?cols.map((c,i)=>`<label class="chk" title="${rgbHex(c)}"><input type="checkbox" data-vc="${i}" checked><span style="display:inline-block;width:18px;height:18px;border-radius:4px;border:1px solid var(--line);background:${rgbHex(c)}"></span></label>`).join(''):'<span class="hint">No ink found in the box.</span>'}</div>
 <div class="fld"><label style="font-size:11px;color:var(--mut)">Color tolerance <span id="vsTolV">${P.tol}</span></label><input type="range" id="vsTol" min="10" max="160" value="${P.tol}" style="width:100%"></div>`,
 [{label:'Cancel',cancel:1},{label:'Search',pri:1,fn:md=>{const useC=md.querySelector('#vsC').checked;const o={all:md.querySelector('#vsP').value==='all',thr:+md.querySelector('#vsT').value,rot:md.querySelector('#vsR').checked,limit:md.querySelector('#vsL').checked,
   colors:useC?cols.filter((c,i)=>{const e=md.querySelector(`[data-vc="${i}"]`);return e&&e.checked}):null,tol:+md.querySelector('#vsTol').value};
   P.limit=o.limit;P.colorOn=useC;P.tol=o.tol;savePrefs();setTimeout(()=>runVisualSearch(r.page,sb,o).then(showResults),0)}}]);
 const tl=$('#vsTol');if(tl)tl.oninput=()=>{$('#vsTolV').textContent=tl.value}}
async function runVisualSearch(srcPage,sb,o){const bw=sb[2]-sb[0],bh=sb[3]-sb[1];
 const kc=clamp(16/Math.max(bw,bh),.15,3),kf=clamp(40/Math.max(bw,bh),.3,5);let cancel=false;
 if(!o.silent)modal('VisualSearch',`<div class="hint" id="vsMsg">Preparing…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="vsBar" style="height:100%;width:0;background:var(--acc)"></div></div>`,[{label:'Cancel',cancel:1,fn:()=>{cancel=true}}]);
 const msg=t=>{const e=$('#vsMsg');if(e)e.textContent=t},bar=f=>{const e=$('#vsBar');if(e)e.style.width=Math.round(f*100)+'%'};
 const colors=o.colors&&o.colors.length?o.colors:null,tol=o.tol||60;
 const page=async(n,k)=>{const R=await renderRGB(S.pdf,n,k),raw=grayFrom(R,colors,tol);return{W:R.W,H:R.H,raw,g:blur(raw,R.W,R.H)}};
 const mk=async k=>{const R=await page(srcPage,k),x0=Math.round(sb[0]*k),y0=Math.round(sb[1]*k),w=Math.max(4,Math.round(bw*k)),h=Math.max(4,Math.round(bh*k));let t=tmplFrom(R.g,R.W,x0,y0,w,h);const out=[{t:prepT(t),w,h}];
  if(o.rot){let tt=t,ww=w,hh=h;for(let i=0;i<3;i++){tt=rot90(tt,ww,hh);[ww,hh]=[hh,ww];out.push({t:prepT(tt),w:ww,h:hh})}}
  const band=Math.max(2,Math.round(Math.min(w,h)*.15));return{T:out,band,base:bandInk(R.raw,R.W,R.H,x0,y0,x0+w-1,y0+h-1,band)}};
 const hits=[];
 try{const TCo=await mk(kc),TFo=await mk(kf),TC=TCo.T,TF=TFo.T;if(TC[0].t.norm<0.5)throw new Error(colors?'No ink of the chosen colors in the box':"The box looks empty — draw it around the symbol's lines");
  const pages=o.all?S.pages.map(p=>p.num):[srcPage];
  for(let pi=0;pi<pages.length;pi++){if(cancel)break;const n=pages[pi];msg(`Searching page ${n}${pages.length>1?` (${pi+1} of ${pages.length})`:''}…`);
   const Cp=await page(n,kc),itc=integral(Cp.g,Cp.W,Cp.H);const cand=[];
   for(const tc of TC){for(let y=0;y+tc.h<=Cp.H;y++){if(y%40===0){bar((pi+y/Cp.H)/pages.length);await tick();if(cancel)break}for(let x=0;x+tc.w<=Cp.W;x++){const v=nccAt(Cp.g,Cp.W,itc,x,y,tc.t,tc.w,tc.h);if(v>o.thr-.17)cand.push([v,x,y,tc])}}}
   cand.sort((a,b)=>b[0]-a[0]);const top=[];for(const c of cand){const cx=(c[1]+c[3].w/2)/kc,cy=(c[2]+c[3].h/2)/kc;if(top.some(q=>Math.hypot(q[0]-cx,q[1]-cy)<Math.min(bw,bh)*.6))continue;top.push([cx,cy]);if(top.length>800)break}
   if(!top.length)continue;const F=await page(n,kf),itf=integral(F.g,F.W,F.H);
   for(const[cx,cy]of top){let best=-1,bp=null,bt=null;for(const tf of TF){const bx=Math.round(cx*kf-tf.w/2),by=Math.round(cy*kf-tf.h/2),rr=Math.ceil(kf/kc)+2;
     for(let dy=-rr;dy<=rr;dy++)for(let dx=-rr;dx<=rr;dx++){const x=bx+dx,y=by+dy;if(x<0||y<0||x+tf.w>F.W||y+tf.h>F.H)continue;const v=nccAt(F.g,F.W,itf,x,y,tf.t,tf.w,tf.h);if(v>best){best=v;bp=[x,y];bt=tf}}}
    if(best<o.thr)continue;const box=[bp[0]/kf,bp[1]/kf,(bp[0]+bt.w)/kf,(bp[1]+bt.h)/kf],c=[(box[0]+box[2])/2,(box[1]+box[3])/2];
    if(hits.some(q=>q.page===n&&Math.hypot(q.c[0]-c[0],q.c[1]-c[1])<Math.min(bw,bh)*.6))continue;
    if(o.limit){const ink=bandInk(F.raw,F.W,F.H,bp[0],bp[1],bp[0]+bt.w-1,bp[1]+bt.h-1,TFo.band);if(ink>TFo.base+TFo.band*.6)continue}
    hits.push({page:n,box,c,score:best,on:true})}}
  if(!o.silent)closeModal()}
 catch(e){console.error(e);if(!o.silent)closeModal();toast('VisualSearch failed: '+(e.message||e));return null}
 hits.sort((a,b)=>a.page-b.page||a.c[1]-b.c[1]||a.c[0]-b.c[0]);C3.vs={hits,src:{page:srcPage,box:sb},o};return C3.vs}
const MARK_KINDS=[['rect','Rectangle'],['ellipse','Ellipse'],['cloud','Cloud'],['hilite','Highlight box'],['count','Count symbol']];
function showResults(res){if(!res)return;const h=res.hits;if(!h.length){toast('No matches found — try "Loose" matching or turn off the color filter');return}
 const chest=(S.chest||LS.get('pm:chest',[])||[]).filter(c=>c&&c.type&&T[c.type]);
 const list=()=>h.map((x,i)=>`<label class="chk" style="display:flex;gap:8px;align-items:center;padding:3px 4px;border-radius:4px" data-vi="${i}"><input type="checkbox" data-vk="${i}" ${x.on?'checked':''}> <span style="flex:1">Page ${x.page} · (${Math.round(x.c[0])}, ${Math.round(x.c[1])})</span><span class="hint">${Math.round(x.score*100)}%</span></label>`).join('');
 modal(`VisualSearch — ${h.length} result${h.length>1?'s':''}`,`<div class="row" style="gap:6px;margin-bottom:6px"><button class="btn" id="vsAll" style="border:1px solid var(--line)">Check all</button><button class="btn" id="vsNone" style="border:1px solid var(--line)">Check none</button><span class="hint" style="align-self:center">Click a result to go to it</span></div>
 <div id="vsList" style="max-height:34vh;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:4px">${list()}</div>
 <div class="sec">Count checked</div><div class="row fld" style="gap:6px"><input class="ti" id="vsSub" value="Count" placeholder="Subject"><input type="color" id="vsCol" value="#f08c00"><button class="btn" id="vsCount" style="border:1px solid var(--line)">Add count</button></div>
 <div class="sec">Apply markup to checked</div><div class="row fld" style="gap:6px"><select class="ti" id="vsMk">${MARK_KINDS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}${chest.length?`<optgroup label="Tool Chest">${chest.map((c,i)=>`<option value="chest:${i}">${esc(c.name||c.subject||T[c.type].label)}</option>`).join('')}</optgroup>`:''}</select><button class="btn" id="vsApply" style="border:1px solid var(--line)">Apply</button></div>
 <div class="sec">Hyperlink checked</div><div class="row fld" style="gap:6px"><span class="hint" style="align-self:center">to page</span><input class="ti" type="number" id="vsPg" min="1" max="${S.pages.length}" value="${Math.min(S.pages.length,(res.src.page%S.pages.length)+1)}" style="width:80px"><button class="btn" id="vsLink" style="border:1px solid var(--line)">Create links</button></div>`,[{label:'Close',cancel:1}]);
 const md=$('#modal');md.querySelectorAll('[data-vk]').forEach(cb=>cb.onchange=()=>{h[+cb.dataset.vk].on=cb.checked});
 md.querySelectorAll('[data-vi]').forEach(l=>l.onclick=e=>{if(e.target.matches('input'))return;const x=h[+l.dataset.vi];flashHit(x)});
 $('#vsAll').onclick=()=>{h.forEach(x=>x.on=true);md.querySelectorAll('[data-vk]').forEach(c=>c.checked=true)};$('#vsNone').onclick=()=>{h.forEach(x=>x.on=false);md.querySelectorAll('[data-vk]').forEach(c=>c.checked=false)};
 $('#vsCount').onclick=()=>{const n=countChecked({subject:$('#vsSub').value.trim()||'Count',color:$('#vsCol').value});if(n)closeModal()};
 $('#vsApply').onclick=()=>{const n=applyToChecked($('#vsMk').value);if(n)closeModal()};
 $('#vsLink').onclick=()=>{const n=linkChecked(+$('#vsPg').value);if(n)closeModal()}}
function flashHit(x){gotoPage(x.page);const p=S.pages[x.page-1];if(!p)return;const r=document.createElementNS('http://www.w3.org/2000/svg','rect');const b=x.box;
 r.setAttribute('x',b[0]-3);r.setAttribute('y',b[1]-3);r.setAttribute('width',b[2]-b[0]+6);r.setAttribute('height',b[3]-b[1]+6);r.setAttribute('fill','none');r.setAttribute('stroke','#3d8bfd');r.setAttribute('stroke-width','2.5');
 const svg=p.el.querySelector('svg');if(svg){svg.appendChild(r);setTimeout(()=>r.remove(),1600)}}
const checked=()=>(C3.vs&&C3.vs.hits||[]).filter(x=>x.on);
function countChecked(o={}){const hs=checked();if(!hs.length){toast('Check some results first');return 0}const by={};hs.forEach(x=>(by[x.page]=by[x.page]||[]).push(x.c));
 const made=Object.entries(by).map(([pg,pts])=>{const st=Object.assign({},S.defaults.count,{stroke:o.color||'#f08c00',fill:o.color||'#f08c00'});const m=newMarkup('count',+pg,pts,st);m.subject=o.subject||'Count';m.comment='VisualSearch';return m});
 pushUndo();S.markups.push(...made);commit();setSel(made.map(m=>m.id));toast(`Counted ${hs.length}`);return hs.length}
function applyToChecked(kind){const hs=checked();if(!hs.length){toast('Check some results first');return 0}const made=[];let base=null,ctype=kind;
 if(String(kind).startsWith('chest:')){const ch=(S.chest||LS.get('pm:chest',[])||[]).filter(c=>c&&c.type&&T[c.type])[+kind.slice(6)];if(!ch){toast('Tool Chest item not found');return 0}base=ch;ctype=ch.type}
 for(const x of hs){const b=x.box,pad=Math.max(1.5,(b[2]-b[0])*.08),bb=[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];let m;
  const style=Object.assign({},S.defaults[ctype==='hilite'?'rect':ctype]||{},base?base.style:{});
  if(ctype==='count'){m=newMarkup('count',x.page,[x.c],Object.assign({},S.defaults.count,base?base.style:{}))}
  else if(ctype==='hilite'){m=newMarkup('rect',x.page,[[bb[0],bb[1]],[bb[2],bb[3]]],Object.assign({},S.defaults.rect,{stroke:'#facc15',fill:'#fde047',fillOpacity:.35,width:0}));m.subject='Highlight'}
  else if(['cloud','polygon','area','perimeter'].includes(ctype)){m=newMarkup(ctype,x.page,[[bb[0],bb[1]],[bb[2],bb[1]],[bb[2],bb[3]],[bb[0],bb[3]]],style)}
  else if(T[ctype]&&(T[ctype].box||['rect','ellipse'].includes(ctype)||T[ctype].kind==='drag')){m=newMarkup(ctype,x.page,[[bb[0],bb[1]],[bb[2],bb[3]]],style)}
  else if(T[ctype]&&T[ctype].kind==='click'){m=newMarkup(ctype,x.page,[x.c],style)}
  else{m=newMarkup(ctype,x.page,[[bb[0],bb[1]],[bb[2],bb[3]]],style)}
  if(base){if(base.subject)m.subject=base.subject;if(base.text!==undefined)m.text=base.text;if(base.comment)m.comment=base.comment}
  if(!m.comment)m.comment='VisualSearch';made.push(m)}
 pushUndo();S.markups.push(...made);commit();setSel(made.map(m=>m.id));toast(`Added ${made.length} markup${made.length>1?'s':''}`);return made.length}
function linkChecked(page){const hs=checked();if(!hs.length){toast('Check some results first');return 0}if(!(page>=1&&page<=S.pages.length)){toast('Pick a page between 1 and '+S.pages.length);return 0}
 const made=hs.map(x=>{const b=x.box,m=newMarkup('hlink',x.page,[[b[0]-1,b[1]-1],[b[2]+1,b[3]+1]],S.defaults.hlink||S.defaults.rect);m.subject='VisualSearch Link';m.link={type:'page',page};m.comment='→ page '+page;return m});
 pushUndo();S.markups.push(...made);commit();toast(`Created ${made.length} link${made.length>1?'s':''} to page ${page}`);return made.length}

/* ======================================================================= point picking */
let pickPt=null;
function pickPoint(msg,page){return new Promise(res=>{if(page)gotoPage(page);if(S.tool!=='select')setTool('select');pickPt={msg,page,res};$('#hint').textContent=msg;toast(msg)})}
H.down=(prev=>(e,p,pt)=>{if(pickPt&&p){if(pickPt.page&&p.num!==pickPt.page){toast('Click on page '+pickPt.page);return true}const r=pickPt.res;pickPt=null;try{updateRibbon()}catch(e){}SNAPI={page:p.num,x:pt[0],y:pt[1],k:'end'};redrawPage(p.num);setTimeout(()=>{SNAPI=null;redrawPage(p.num)},700);r({page:p.num,pt});return true}
 return prev?prev(e,p,pt):false})(H.down);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pickPt){const r=pickPt.res;pickPt=null;r(null)}},true);

/* ======================================================================= 2. Stitch sheets */
// similarity transform (scale, rotation, translation) from two point pairs: maps P (sheet b) onto Q (sheet a); y-up PDF space
function similarity(P,Q){const[p1,p2]=P,[q1,q2]=Q,dp=[p2[0]-p1[0],p2[1]-p1[1]],dq=[q2[0]-q1[0],q2[1]-q1[1]],lp=Math.hypot(...dp),lq=Math.hypot(...dq);if(lp<1e-6)return null;
 const s=lq/lp,th=Math.atan2(dq[1],dq[0])-Math.atan2(dp[1],dp[0]),c=Math.cos(th)*s,sn=Math.sin(th)*s;return{a:c,b:sn,c:-sn,d:c,e:q1[0]-(c*p1[0]-sn*p1[1]),f:q1[1]-(sn*p1[0]+c*p1[1]),s,th}}
const ap=(M,p)=>[M.a*p[0]+M.c*p[1]+M.e,M.b*p[0]+M.d*p[1]+M.f];
const compose=(M,N)=>({a:M.a*N.a+M.c*N.b,b:M.b*N.a+M.d*N.b,c:M.a*N.c+M.c*N.d,d:M.b*N.c+M.d*N.d,e:M.a*N.e+M.c*N.f+M.e,f:M.b*N.e+M.d*N.f+M.f,s:(M.s||1)*(N.s||1),th:(M.th||0)+(N.th||0)});
const IDM={a:1,b:0,c:0,d:1,e:0,f:0,s:1,th:0};
const toPdf=(n,q)=>S.pages[n-1].vp.convertToPdfPoint(q[0],q[1]);
// FFT cross-correlation: best translation of sheet b onto sheet a when they overlap (same scale)
function fft1(re,im,inv){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let len=2;len<=n;len<<=1){const ang=2*Math.PI/len*(inv?1:-1),wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}
 if(inv)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n}}
function fft2(re,im,N,inv){const r=new Float64Array(N),i_=new Float64Array(N);for(let y=0;y<N;y++){for(let x=0;x<N;x++){r[x]=re[y*N+x];i_[x]=im[y*N+x]}fft1(r,i_,inv);for(let x=0;x<N;x++){re[y*N+x]=r[x];im[y*N+x]=i_[x]}}
 for(let x=0;x<N;x++){for(let y=0;y<N;y++){r[y]=re[y*N+x];i_[y]=im[y*N+x]}fft1(r,i_,inv);for(let y=0;y<N;y++){re[y*N+x]=r[y];im[y*N+x]=i_[y]}}}
async function inkGrid(n,k,box){const R=await renderRGB(S.pdf,n,k),g=grayFrom(R,null),W=R.W,Hh=R.H,a=new Float32Array(W*Hh),m=new Float32Array(W*Hh);const kb=box?box.map(v=>v*k):[0,0,W,Hh];
 for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){if(x<kb[0]||x>kb[2]||y<kb[1]||y>kb[3])continue;a[y*W+x]=g[y*W+x]<.75?1:0}
 // compare only where each sheet actually has drawing: the box around its linework inside the keep area
 let x0=W,y0=Hh,x1=-1,y1=-1;for(let y=0;y<Hh;y++)for(let x=0;x<W;x++)if(a[y*W+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 for(let y=Math.max(0,y0);y<=y1;y++)for(let x=Math.max(0,x0);x<=x1;x++)m[y*W+x]=1;return{a,m,W,H:Hh}}
async function autoOffset(na,nb,keepA,keepB){// translation t (viewport pt): a point v on sheet b is v+t on sheet a. Needs the sheets to overlap.
 const pa=S.pages[na-1],pb=S.pages[nb-1],N=512,k=(N/2)/Math.max(pa.w,pa.h,pb.w,pb.h);const A=await inkGrid(na,k,keepA),B=await inkGrid(nb,k,keepB);
 const dil=G=>{const o=new Float32Array(G.a.length);for(let y=1;y<G.H-1;y++)for(let x=1;x<G.W-1;x++){const i=y*G.W+x;if(G.a[i]||G.a[i-1]||G.a[i+1]||G.a[i-G.W]||G.a[i+G.W])o[i]=1}return o};
 const F=(G,arr)=>{const re=new Float64Array(N*N),im=new Float64Array(N*N);for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++)re[y*N+x]=arr[y*G.W+x];fft2(re,im,N,false);return[re,im]};
 // c(s) = Σ X(p+s)·Y(p) via IFFT(FFT(X)·conj(FFT(Y)))
 const xc=(X,Y)=>{const r=new Float64Array(N*N),i_=new Float64Array(N*N);for(let q=0;q<N*N;q++){r[q]=X[0][q]*Y[0][q]+X[1][q]*Y[1][q];i_[q]=X[1][q]*Y[0][q]-X[0][q]*Y[1][q]}fft2(r,i_,N,true);return r};
 const fa=F(A,dil(A)),fb=F(B,dil(B)),ma=F(A,A.m),mb=F(B,B.m);const c=xc(fa,fb),sa=xc(fa,mb),sb=xc(ma,fb),ov=xc(ma,mb);
 const minOv=.03*Math.min(A.m.reduce((s,v)=>s+v,0),B.m.reduce((s,v)=>s+v,0));
 // coarse candidates: local maxima of the overlap score
 const cand=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++){const q=y*N+x,cc=c[q];if(cc<12||ov[q]<minOv)continue;const dx=x>N/2?x-N:x,dy=y>N/2?y-N:y;cand.push([cc/Math.max(1,sa[q],sb[q])*(1-Math.exp(-cc/40)),dx,dy])}
 cand.sort((a,b)=>b[0]-a[0]);const top=[];for(const cd of cand){if(top.some(t=>Math.abs(t[1]-cd[1])<=3&&Math.abs(t[2]-cd[2])<=3))continue;top.push(cd);if(top.length>=150)break}
 if(!top.length)throw new Error("Couldn't find where the sheets overlap — use matching points instead");
 // fine check: share of each sheet's linework in the overlap that lands on the other sheet's linework
 const k2=Math.min(2,k*3),f=k2/k,A2=await inkGrid(na,k2,keepA),B2=await inkGrid(nb,k2,keepB);
 const dl=(G,r)=>{const o=new Uint8Array(G.a.length);for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){if(!G.a[y*G.W+x])continue;for(let yy=Math.max(0,y-r);yy<=Math.min(G.H-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(G.W-1,x+r);xx++)o[yy*G.W+xx]=1}return o};
 const dA=dl(A2,2),dB=dl(B2,2),dA1=dl(A2,1),dB1=dl(B2,1);
 const areaA=A2.m.reduce((s,v)=>s+v,0),areaB=B2.m.reduce((s,v)=>s+v,0),minArea=.03*Math.min(areaA,areaB);
 const evalAt=(tx,ty,DA,DB,st)=>{let nA=0,mA=0,nB=0,mB=0,ov=0;for(let y=0;y<B2.H;y+=st){const ya=y+ty;if(ya<0||ya>=A2.H)continue;for(let x=0;x<B2.W;x+=st){const xa=x+tx;if(xa<0||xa>=A2.W)continue;const ib=y*B2.W+x,ia=ya*A2.W+xa;
   if(!B2.m[ib]||!A2.m[ia])continue;ov++;if(B2.a[ib]){nB++;if(DA[ia])mB++}if(A2.a[ia]){nA++;if(DB[ib])mA++}}}if(nA<40||nB<40||ov*st*st<minArea)return 0;evalAt.ev=mA+mB;return Math.min(mA/nA,mB/nB)};
 const scored=top.map(t=>{const tx=Math.round(t[1]*f),ty=Math.round(t[2]*f);evalAt.ev=0;const sc=evalAt(tx,ty,dA,dB,2);return{sc,ev:evalAt.ev,tx,ty}});
 // periodic linework (grids) can line up at several offsets; among equally clean fits keep the one with the most matching linework
 const best=Math.max(...scored.map(x=>x.sc)),near=scored.filter(x=>x.sc>=best-.015).sort((a,b)=>b.ev-a.ev)[0];let bx=near.tx,by=near.ty;
 if(best<.5)throw new Error("Couldn't find where the sheets overlap — use matching points instead");
 const offs=[];for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)offs.push([dx,dy]);offs.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
 let rb=-1,rx=bx,ry=by;for(const[dx,dy]of offs){const sc=evalAt(bx+dx,by+dy,dA1,dB1,1);if(sc>rb+1e-9){rb=sc;rx=bx+dx;ry=by+dy}}
 return{t:[rx/k2,ry/k2],score:rb}}
async function stitchDialog(){if(S.pages.length<2)return toast('Stitching needs a document with at least 2 sheets');const lab=n=>window.PMDoc&&PMDoc.labelOf?PMDoc.labelOf(n):String(n);
 modal('Stitch sheets',`<div class="hint" style="margin-bottom:8px">Joins drawings that continue across sheets (matchlines) into one continuous page. Sheets are joined in the order listed; the first sheet stays in place.</div>
 <div class="fld"><label>Sheets (in order)</label><input class="ti" id="stPg" value="${S.cur},${Math.min(S.pages.length,S.cur+1)}" placeholder="e.g. 1,2 or 3-5"><div class="hint">${S.pages.map(p=>p.num+(lab(p.num)!==String(p.num)?' = '+esc(lab(p.num)):'')).join(' · ')}</div></div>
 <div class="fld"><label>Line up the sheets</label><select class="ti" id="stAl"><option value="pts">Pick 2 matching points on each pair of sheets</option><option value="auto">Automatically (sheets must overlap a little)</option></select></div>
 <label class="chk fld"><input type="checkbox" id="stK" checked> Draw the area to keep on each sheet (crop at the matchlines)</label>
 <div class="row fld"><label class="chk"><input type="checkbox" id="stL" checked> Region labels</label><div><label style="font-size:11px;color:var(--mut)">Label text size</label><input class="ti" type="number" id="stLs" value="14" min="4" max="96" style="width:80px"></div></div>
 <label class="chk fld"><input type="checkbox" id="stM"> Include markups</label>
 <div class="fld"><label>Put the result</label><select class="ti" id="stO"><option value="new">In a new document</option><option value="append">At the end of this document</option></select></div>`,
 [{label:'Cancel',cancel:1},{label:'Start',pri:1,fn:md=>{const pages=parseList(md.querySelector('#stPg').value);if(pages.length<2){toast('Pick at least 2 sheets');return false}
   const o={pages,align:md.querySelector('#stAl').value,keepPick:md.querySelector('#stK').checked,labels:md.querySelector('#stL').checked,labelSize:+md.querySelector('#stLs').value||14,markups:md.querySelector('#stM').checked,output:md.querySelector('#stO').value};
   setTimeout(()=>stitchInteractive(o),0)}}])}
function parseList(s){const out=[];for(const part of String(s).split(',')){const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)continue;const a=+m[1],b=m[2]?+m[2]:a;for(let i=a;a<=b?i<=b:i>=b;i+=a<=b?1:-1)if(i>=1&&i<=S.pages.length)out.push(i)}return out}
async function stitchInteractive(o){const keep={},points=[];
 try{if(o.keepPick)for(const n of o.pages){gotoPage(n);const r=await PMAuto.pickRegion(`Stitch: on sheet ${n}, box the area to keep`);if(!r)return;if(r.page!==n){toast('Draw the box on sheet '+n);return}keep[n]=r.box}
  if(o.align==='pts')for(let i=1;i<o.pages.length;i++){const a=o.pages[i-1],b=o.pages[i],q=[];
   for(const[n,which]of[[a,1],[b,1],[a,2],[b,2]]){const r=await pickPoint(`Stitch: click matching point ${which} on sheet ${n}${n===b?' (the same spot as on sheet '+a+')':''} · Esc cancels`,n);if(!r){toast('Stitch cancelled');return}q.push(r.pt)}
   points.push(q)}
  try{updateRibbon()}catch(e){}
  const res=await stitch(Object.assign({},o,{keep,points}));if(res)toast(`Stitched ${o.pages.length} sheets into one ${Math.round(res.size[0]/72)}" × ${Math.round(res.size[1]/72)}" page`)}
 catch(e){console.error(e);toast('Stitch failed: '+(e.message||e))}}
/* o = {pages:[..], points:[[a1,b1,a2,b2] per pair, viewport pt], keep:{n:box}, align:'pts'|'auto', labels, labelSize, markups, output:'new'|'append'|'bytes'} */
async function stitch(o){const PL=PDFLib,pages=o.pages;if(!pages||pages.length<2)throw new Error('Pick at least 2 sheets');
 const keepBox=n=>o.keep&&o.keep[n]||[0,0,S.pages[n-1].w,S.pages[n-1].h];
 // transform of each sheet into sheet 1's PDF space
 const X=[IDM];const offsets=[];
 for(let i=1;i<pages.length;i++){const a=pages[i-1],b=pages[i];let Mi;
  if(o.align==='auto'){const r=await autoOffset(a,b,o.keep&&o.keep[a],o.keep&&o.keep[b]);offsets.push(r);
   const p1=[0,0],p2=[100,0],P=[toPdf(b,p1),toPdf(b,p2)],Q=[toPdf(a,[p1[0]+r.t[0],p1[1]+r.t[1]]),toPdf(a,[p2[0]+r.t[0],p2[1]+r.t[1]])];Mi=similarity(P,Q)}
  else{const q=o.points&&o.points[i-1];if(!q||q.length<4)throw new Error('Two matching points are needed on each pair of sheets');
   Mi=similarity([toPdf(b,q[1]),toPdf(b,q[3])],[toPdf(a,q[0]),toPdf(a,q[2])]);if(!Mi)throw new Error('The two points on a sheet must be apart')}
  X.push(compose(X[i-1],Mi))}
 // keep areas in each sheet's PDF space, mapped into sheet 1 space → output bounds
 const clips=pages.map(n=>{const b=keepBox(n),c=[toPdf(n,[b[0],b[1]]),toPdf(n,[b[2],b[3]])];return{left:Math.min(c[0][0],c[1][0]),bottom:Math.min(c[0][1],c[1][1]),right:Math.max(c[0][0],c[1][0]),top:Math.max(c[0][1],c[1][1])}});
 let mnx=1e18,mny=1e18,mxx=-1e18,mxy=-1e18;clips.forEach((c,i)=>{for(const p of[[c.left,c.bottom],[c.right,c.bottom],[c.right,c.top],[c.left,c.top]]){const q=ap(X[i],p);mnx=Math.min(mnx,q[0]);mny=Math.min(mny,q[1]);mxx=Math.max(mxx,q[0]);mxy=Math.max(mxy,q[1])}});
 const margin=18,W=mxx-mnx+margin*2,Hh=mxy-mny+margin*2;if(W>14400||Hh>14400)throw new Error('The stitched page would be larger than 200 inches — check the matching points');
 const srcBytes=o.markups?await PMOutput.markedPdf(true):S.bytes,src=await PL.PDFDocument.load(srcBytes,{ignoreEncryption:true}),out=await PL.PDFDocument.create(),pg=out.addPage([W,Hh]);
 const font=await out.embedFont(PL.StandardFonts.HelveticaBold);const lab=n=>window.PMDoc&&PMDoc.labelOf?PMDoc.labelOf(n):String(n);const placed=[];
 for(let i=0;i<pages.length;i++){const n=pages[i],c=clips[i],emb=await out.embedPage(src.getPage(n-1),c),M=X[i],o0=ap(M,[c.left,c.bottom]);
  const x=o0[0]-mnx+margin,y=o0[1]-mny+margin;pg.drawPage(emb,{x,y,xScale:M.s,yScale:M.s,rotate:PL.degrees(M.th*180/Math.PI)});placed.push({page:n,x,y,s:M.s,rot:M.th*180/Math.PI,clip:c});
  if(o.labels){const ctr=ap(M,[(c.left+c.right)/2,c.top]),t=(lab(n)===String(n)?'Sheet ':'')+lab(n),sz=o.labelSize||14,w=font.widthOfTextAtSize(t,sz);
   pg.drawText(t,{x:ctr[0]-mnx+margin-w/2,y:Math.min(Hh-sz-2,ctr[1]-mny+margin+4),size:sz,font,color:PL.rgb(.11,.31,.85)})}}
 const bytes=new Uint8Array(await out.save());C3.stitch={size:[W,Hh],placed,transforms:X,offsets,bytes};
 if(o.output==='append'){await PMBatch.rebuild(async doc=>{const part=await PL.PDFDocument.load(bytes),cnt=doc.getPageCount(),[cp]=await doc.copyPages(part,[0]);doc.addPage(cp);return Array.from({length:cnt},(_,i)=>i)},'Adding stitched page');gotoPage(S.pages.length)}
 else if(o.output==='new')await openBytes(bytes,baseName()+'-stitched.pdf');
 return C3.stitch}

/* ======================================================================= 3. Smart Overlay */
const DISC={A:'#2563eb',S:'#16a34a',M:'#c026d3',E:'#ea580c',P:'#0891b2',C:'#92400e',L:'#65a30d',F:'#dc2626',G:'#57534e',T:'#7c3aed'};
const SHEET_RE=/^[A-Z]{1,3}[-.\s]?\d{1,4}(?:\.\d{1,3})?[A-Z]?$/;
const normLabel=s=>String(s||'').toUpperCase().replace(/\s+/g,'').replace(/^([A-Z]+)[.\s]?(\d)/,'$1-$2').replace(/^([A-Z]+)(\d)/,'$1-$2');
function readSets(){return new Promise(res=>{try{const r=indexedDB.open('planmark-sets',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('files',{keyPath:'id'});d.createObjectStore('sets',{keyPath:'id'})};
 r.onsuccess=()=>{try{const t=r.result.transaction('sets','readonly').objectStore('sets').getAll();t.onsuccess=()=>res((t.result||[]).sort((a,b)=>a.created-b.created));t.onerror=()=>res([])}catch(e){res([])}};r.onerror=()=>res([])}catch(e){res([])}})}
async function sheetLabels(pdf,given){const out=[];let pl=null;try{pl=await pdf.getPageLabels()}catch(e){}
 for(let n=1;n<=pdf.numPages;n++){let l=given&&given[n-1];if(l&&SHEET_RE.test(String(l).trim())){out.push({label:normLabel(l),how:'label'});continue}
  if(pl&&pl[n-1]&&SHEET_RE.test(pl[n-1].trim())){out.push({label:normLabel(pl[n-1]),how:'label'});continue}
  try{const pg=await pdf.getPage(n),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();let best=null;
   for(const it of tc.items){const s=(it.str||'').trim();if(!SHEET_RE.test(s))continue;const h=Math.hypot(it.transform[2],it.transform[3]),q=vp.convertToViewportPoint(it.transform[4],it.transform[5]);
    const sc=h*2+(q[0]/vp.width+q[1]/vp.height)*6;if(!best||sc>best.sc)best={sc,s}}
   out.push(best?{label:normLabel(best.s),how:'title block'}:{label:null,how:'none'})}catch(e){out.push({label:null,how:'none'})}}
 return out}
async function srcFrom(kind,file,setId){
 if(kind==='current')return{name:S.fileName,bytes:S.bytes,given:S.pages.map(p=>window.PMDoc&&PMDoc.labelOf?(PMDoc.labels&&PMDoc.labels[p.num-1])||null:null)};
 if(kind==='file'){if(!file)throw new Error('Choose a PDF');return{name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}}
 if(kind==='set'){const s=(await readSets()).find(x=>x.id===setId)||(window.PMSets2&&PMSets2.curSet&&PMSets2.curSet());
  if(!s||!s.items||!s.items.length)throw new Error('That set is empty');const bytes=await PMSets2.buildSetPdf(s.items.map((_,i)=>i),{content:'doc'},s);return{name:s.name,bytes,given:s.items.map(it=>it.label||null)}}
 throw new Error('Unknown source')}
function matchSheets(A,B){// A old, B new: arrays of {label}
 const pairs=[],usedA=new Set();const haveLabels=A.some(x=>x.label)&&B.some(x=>x.label);
 if(haveLabels){B.forEach((b,j)=>{if(!b.label)return;const i=A.findIndex((a,ii)=>!usedA.has(ii)&&a.label===b.label);if(i>=0){usedA.add(i);pairs.push({old:i+1,nw:j+1,label:b.label,by:'sheet number'})}})}
 else{const n=Math.min(A.length,B.length);for(let i=0;i<n;i++){usedA.add(i);pairs.push({old:i+1,nw:i+1,label:B[i].label||('Page '+(i+1)),by:'page order'})}}
 const unNew=B.map((b,j)=>j+1).filter(j=>!pairs.some(p=>p.nw===j)),unOld=A.map((a,i)=>i+1).filter(i=>!usedA.has(i-1));return{pairs,unNew,unOld}}
function tint(srcCanvas,hex,alpha){const c=document.createElement('canvas');c.width=srcCanvas.width;c.height=srcCanvas.height;const ctx=c.getContext('2d');ctx.drawImage(srcCanvas,0,0);const id=ctx.getImageData(0,0,c.width,c.height),d=id.data,[R,G,Bb]=hexRgb3(hex);
 for(let i=0;i<d.length;i+=4){const a=255-(d[i]*.3+d[i+1]*.59+d[i+2]*.11);d[i]=R;d[i+1]=G;d[i+2]=Bb;d[i+3]=a<18?0:Math.min(255,a*1.4*(alpha??1))}ctx.putImageData(id,0,0);return c}
const png=c=>new Promise(r=>c.toBlob(async b=>r(new Uint8Array(await b.arrayBuffer())),'image/png'));
async function smartOverlayDialog(){const sets=await readSets();
 const opt=(p)=>`<select class="ti" id="${p}K"><option value="file">A PDF file</option>${S.pages.length?'<option value="current">This document</option>':''}${sets.length?'<option value="set">A Set</option>':''}</select><input type="file" class="ti" id="${p}F" accept="application/pdf,.pdf" style="margin-top:4px">${sets.length?`<select class="ti" id="${p}S" style="margin-top:4px">${sets.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`:''}`;
 modal('Smart Overlay',`<div class="hint" style="margin-bottom:8px">Overlays a whole older set on a newer set. Sheets are paired by sheet number (page labels, then the sheet number in the title block, then page order), each pair is lined up automatically, and you get one overlay page per sheet with a summary of what changed.</div>
 <div class="fld"><label>Older set</label>${opt('soA')}</div><div class="fld"><label>Newer set</label>${opt('soB')}</div>
 <div class="fld"><label>Colors</label><select class="ti" id="soC"><option value="rb">Older red · newer blue</option><option value="disc">By discipline (older gray · newer A blue, S green, M magenta, E orange, P teal…)</option></select></div>
 <label class="chk fld"><input type="checkbox" id="soCl" checked> Cloud the changed areas</label>
 <div class="hint">Preview limits: overlay layers are images (about 150 dpi) on top of the newer sheet's vectors; alignment corrects shift and small scale differences but not rotation; changed-area % is measured on the rendered linework.</div>`,
 [{label:'Cancel',cancel:1},{label:'Overlay',pri:1,fn:md=>{const g=p=>({kind:md.querySelector('#'+p+'K').value,file:md.querySelector('#'+p+'F').files[0],set:md.querySelector('#'+p+'S')&&md.querySelector('#'+p+'S').value});
   const a=g('soA'),b=g('soB');const o={colors:md.querySelector('#soC').value,clouds:md.querySelector('#soCl').checked};
   setTimeout(async()=>{try{const A=await srcFrom(a.kind,a.file,a.set),B=await srcFrom(b.kind,b.file,b.set);const r=await smartOverlay(A,B,o);if(r)showSO(r)}catch(e){console.error(e);toast('Smart Overlay failed: '+(e.message||e))}},0)}}])}
async function smartOverlay(A,B,o={}){let cancel=false;
 if(!o.silent)modal('Smart Overlay',`<div class="hint" id="soMsg">Reading sheets…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="soBar" style="height:100%;width:0;background:var(--acc)"></div></div>`,[{label:'Cancel',cancel:1,fn:()=>{cancel=true}}]);
 const msg=t=>{const e=$('#soMsg');if(e)e.textContent=t},bar=f=>{const e=$('#soBar');if(e)e.style.width=Math.round(f*100)+'%'};
 const pdfA=await pdfjsLib.getDocument({data:A.bytes.slice(),isEvalSupported:false}).promise,pdfB=await pdfjsLib.getDocument({data:B.bytes.slice(),isEvalSupported:false}).promise;
 try{const LA=await sheetLabels(pdfA,A.given),LB=await sheetLabels(pdfB,B.given);const mt=matchSheets(LA,LB);if(!mt.pairs.length)throw new Error('No sheets could be paired');
  const outDoc=await PDFLib.PDFDocument.create(),srcB=await PDFLib.PDFDocument.load(B.bytes,{ignoreEncryption:true}),font=await outDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);const rows=[];
  for(let i=0;i<mt.pairs.length;i++){if(cancel)break;const p=mt.pairs[i];msg(`Overlaying ${p.label} (${i+1} of ${mt.pairs.length})…`);bar(i/mt.pairs.length);
   const al=await B2().autoAlignPages(pdfB,p.nw,pdfA,p.old,{scale:true}),M=al.m;
   const vp=(await pdfB.getPage(p.nw)).getViewport({scale:1}),k=Math.min(150/72,Math.sqrt(9e6/(vp.width*vp.height))),W=Math.round(vp.width*k),Hh=Math.round(vp.height*k);
   const rn=await renderRGB(pdfB,p.nw,k,W,Hh),ro=await renderRGB(pdfA,p.old,k,W,Hh,M);
   // changed linework: ink in one and not near ink in the other
   const ga=grayFrom(rn,null),gb=grayFrom(ro,null),N=W*Hh,inA=new Uint8Array(N),inB=new Uint8Array(N);for(let j=0;j<N;j++){inA[j]=ga[j]<.75?1:0;inB[j]=gb[j]<.75?1:0}
   const r=Math.max(1,Math.round(k*1.2)),dil=X=>{const o2=new Uint8Array(N);for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){if(!X[y*W+x])continue;for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=Hh)continue;for(let dx=-r;dx<=r;dx++){const xx=x+dx;if(xx>=0&&xx<W)o2[yy*W+xx]=1}}}return o2};
   const dA=dil(inA),dB=dil(inB);let ch=0,ink=0;for(let j=0;j<N;j++){if(inA[j]||inB[j])ink++;if((inA[j]&&!dB[j])||(inB[j]&&!dA[j]))ch++}const pct=ink?ch/ink*100:0;
   const dc=o.colors==='disc'?(DISC[(p.label.match(/^[A-Z]/)||['A'])[0]]||'#7c3aed'):'#1d4ed8',oc=o.colors==='disc'?'#6b7280':'#e61e1e';
   const lay=await B2().layeredPdf(B.bytes,p.nw-1,[{name:'Older: '+(A.name||'old')+' '+p.label,png:await png(tint(ro.c,oc)),matrix:[1,0,0,1,0,0],opacity:.85},{name:'Newer: '+(B.name||'new')+' '+p.label,png:await png(tint(rn.c,dc)),matrix:[1,0,0,1,0,0],opacity:.85}],{base:false});
   const part=await PDFLib.PDFDocument.load(lay),[cp]=await outDoc.copyPages(part,[0]);outDoc.addPage(cp);const page=outDoc.getPage(outDoc.getPageCount()-1);
   let boxes=[];if(o.clouds!==false){try{const cr=await B2().compareCore(pdfB,p.nw,pdfA,p.old,{align:true,alignScale:true,tol:.9,sens:5});boxes=cr.boxes||[]}catch(e){console.warn(e)}
    for(const bx of boxes){const d=dCloud([[bx[0],bx[1]],[bx[2],bx[1]],[bx[2],bx[3]],[bx[0],bx[3]]],9);page.drawSvgPath(xfPath(d,vp),{x:0,y:0,borderColor:PDFLib.rgb(.88,.19,.17),borderWidth:2})}}
   const[tx,ty]=vp.convertToPdfPoint(20,24);page.drawText(`Smart Overlay ${safeTxt(p.label)} · ${pct.toFixed(1)}% of linework changed · ${boxes.length} area(s)`,{x:tx,y:ty,size:10,font,color:PDFLib.rgb(.88,.19,.17),rotate:PDFLib.degrees(vp.rotation||0)});
   rows.push({label:p.label,oldPage:p.old,newPage:p.nw,by:p.by,changedPct:+pct.toFixed(2),areas:boxes.length,align:{scale:+M[0].toFixed(4),dx:+M[4].toFixed(1),dy:+M[5].toFixed(1)}});await tick()}
  // one Layers list for the whole document
  const refs=new Set();outDoc.getPages().forEach(pg=>{const pr=pg.node.Resources().get(PDFLib.PDFName.of('Properties'));if(pr)for(const[,v]of pr.entries())refs.add(v)});const rr=[...refs];
  if(rr.length)outDoc.catalog.set(PDFLib.PDFName.of('OCProperties'),outDoc.context.obj({OCGs:rr,D:{Name:PDFLib.PDFString.of('Smart Overlay'),Order:rr,ON:rr}}));
  const bytes=new Uint8Array(await outDoc.save());
  const csv=['Sheet,Old page,New page,Matched by,Changed linework %,Changed areas,Align scale,Align dx (pt),Align dy (pt)',...rows.map(r=>[r.label,r.oldPage,r.newPage,r.by,r.changedPct,r.areas,r.align.scale,r.align.dx,r.align.dy].map(v=>/[,"]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v).join(',')),
   ...mt.unNew.map(n=>`${LB[n-1].label||'Page '+n},,${n},unmatched (new only),,,,,`),...mt.unOld.map(n=>`${LA[n-1].label||'Page '+n},${n},,unmatched (old only),,,,,`)].join('\n');
  C3.so={rows,unNew:mt.unNew.map(n=>({page:n,label:LB[n-1].label})),unOld:mt.unOld.map(n=>({page:n,label:LA[n-1].label})),bytes,csv,labelsOld:LA,labelsNew:LB};if(!o.silent)closeModal();return C3.so}
 catch(e){if(!o.silent)closeModal();throw e}finally{pdfA.destroy();pdfB.destroy()}}
function showSO(r){modal('Smart Overlay results',`<div class="hint" style="margin-bottom:6px">${r.rows.length} sheet${r.rows.length===1?'':'s'} overlaid${r.unNew.length||r.unOld.length?` · ${r.unNew.length} new-only · ${r.unOld.length} old-only`:''}</div>
 <div style="max-height:40vh;overflow:auto;border:1px solid var(--line);border-radius:6px"><table class="tbl" style="width:100%;font-size:12px"><tr><th align="left">Sheet</th><th>Old</th><th>New</th><th>Changed</th><th>Areas</th><th align="left">Paired by</th></tr>
 ${r.rows.map(x=>`<tr><td>${esc(x.label)}</td><td align="center">${x.oldPage}</td><td align="center">${x.newPage}</td><td align="center">${x.changedPct}%</td><td align="center">${x.areas}</td><td>${esc(x.by)}</td></tr>`).join('')}
 ${r.unNew.map(x=>`<tr style="color:var(--mut)"><td>${esc(x.label||'Page '+x.page)}</td><td></td><td align="center">${x.page}</td><td colspan="3">only in the newer set</td></tr>`).join('')}${r.unOld.map(x=>`<tr style="color:var(--mut)"><td>${esc(x.label||'Page '+x.page)}</td><td align="center">${x.page}</td><td></td><td colspan="3">only in the older set</td></tr>`).join('')}</table></div>`,
 [{label:'Save CSV',fn:()=>{saveFile('smart-overlay-summary.csv',new Blob([r.csv],{type:'text/csv'}));return false}},{label:'Save PDF',fn:()=>{saveFile('smart-overlay.pdf',new Blob([r.bytes],{type:'application/pdf'}));return false}},{label:'Open overlay',pri:1,fn:()=>{openBytes(r.bytes,'smart-overlay.pdf')}}])}

/* ======================================================================= 4. Session measurements → annotations */
const isMeas=m=>!!(T[m.type]&&T[m.type].meas);
const inSess=()=>!!(window.PMStudio&&PMStudio.ST&&PMStudio.ST.sess);
const keepInSess=()=>LS.get('pm:c3:sessMeas',false);
const _ac=afterCreate;afterCreate=function(m){if(m&&inSess()&&keepInSess()&&isMeas(m))m.sessionOnly=true;return _ac.apply(this,arguments)};
function sessionOnly(){return S.markups.filter(m=>m.sessionOnly)}
function makeAnnotations(ids){const list=(ids?S.markups.filter(m=>ids.includes(m.id)):sessionOnly()).filter(m=>m.sessionOnly);if(!list.length){toast('No session measurements to convert');return 0}
 pushUndo();list.forEach(m=>{delete m.sessionOnly;m.modified=Date.now()});commit();renderSessBox();toast(`${list.length} measurement${list.length>1?'s are':' is'} now part of the document`);return list.length}
// session-only measurements are not written into saved or exported PDFs
const _exp=exportPDF;exportPDF=async function(){const keep=S.markups;if(!keep.some(m=>m.sessionOnly))return _exp.apply(this,arguments);S.markups=keep.filter(m=>!m.sessionOnly);try{return await _exp.apply(this,arguments)}finally{S.markups=keep}};
function renderSessBox(){const pane=$('#pane-studio');if(!pane)return;let box=$('#c3Sess');const show=inSess()||sessionOnly().length;if(!show){if(box)box.remove();return}
 if(!box){box=document.createElement('div');box.id='c3Sess';box.style.cssText='border-top:1px solid var(--line);margin-top:10px;padding-top:8px';pane.appendChild(box)}
 const n=sessionOnly().length;box.innerHTML=`<div class="sec" style="margin-top:0">Session measurements</div>
 <label class="chk"><input type="checkbox" id="c3Keep" ${keepInSess()?'checked':''}> Keep measurements in the session only (not saved into the PDF)</label>
 <div class="hint" style="margin:6px 0">${n} session-only measurement${n===1?'':'s'}</div><button class="btn" id="c3Make" style="border:1px solid var(--line)" ${n?'':'disabled'}>Make annotations from measurements</button>`;
 $('#c3Keep').onchange=e=>{LS.set('pm:c3:sessMeas',e.target.checked)};$('#c3Make').onclick=()=>{const sel=[...S.sel].filter(id=>{const m=byId(id);return m&&m.sessionOnly});makeAnnotations(sel.length?sel:null)}}
H.change.push(()=>{clearTimeout(C3.sT);C3.sT=setTimeout(renderSessBox,150)});
H.ready.push(()=>{const p=$('#pane-studio');if(p)new MutationObserver(()=>{if(!$('#c3Sess')&&(inSess()||sessionOnly().length))renderSessBox()}).observe(p,{childList:true})});
if(!window.PM_EXTRA_SYNC_KEYS_CP.includes('pm:c3:sessMeas'))window.PM_EXTRA_SYNC_KEYS_CP.push('pm:c3:sessMeas');

/* ======================================================================= 5. Copy Page to Snapshot · Snapshot Content */
async function copyPageSnapshot(n){n=n||S.cur;if(!S.pages.length)return toast('Open a PDF first');const p=S.pages[n-1],b=[0,0,p.w,p.h],S2x=window.PMStyles2;
 const bytes=await S2x.vectorRegion(n,b,true),c=await S2x.rasterRegion(n,b,150/72,true);S2x.setClip({pdf:b64(bytes),png:c.toDataURL('image/png'),w:p.w,h:p.h});C3.lastClip={page:n,w:p.w,h:p.h,content:false};return C3.lastClip}
async function snapshotContent(box,page){if(!S.pages.length)return toast('Open a PDF first');let r;if(box)r={page:page||S.cur,box};else{r=await PMAuto.pickRegion('Snapshot Content: pick the area (markups are left out)');if(!r)return}
 const b=r.box;if(b[2]-b[0]<3||b[3]-b[1]<3)return toast('Area too small');const S2x=window.PMStyles2,k=Math.min(4,Math.sqrt(16e6/((b[2]-b[0])*(b[3]-b[1]))));
 const c=await S2x.rasterRegion(r.page,b,k,false),bytes=await S2x.vectorRegion(r.page,b,false);S2x.setClip({pdf:b64(bytes),png:c.toDataURL('image/png'),w:b[2]-b[0],h:b[3]-b[1]});
 const url=c.toDataURL('image/png');C3.lastClip={page:r.page,w:b[2]-b[0],h:b[3]-b[1],content:true,box:b,png:url};
 if(box)return C3.lastClip;
 modal('Snapshot Content',`<img src="${url}" style="max-width:100%;max-height:50vh;border:1px solid var(--line);border-radius:6px;background:#fff"><div class="hint" style="margin-top:6px">Drawing only — markups left out. Also copied as a vector snapshot (Styles → Paste vector snapshot).</div>`,
 [{label:'Copy image',fn:()=>{c.toBlob(async bl=>{try{await navigator.clipboard.write([new ClipboardItem({'image/png':bl})]);toast('Copied')}catch(e){toast("Copying images isn't allowed here — use Save PNG")}},'image/png');return false}},
  {label:'Save PNG',fn:()=>{c.toBlob(bl=>saveFile(baseName()+'-content.png',bl),'image/png');return false}},
  {label:'Place as image',pri:1,fn:()=>{const m=newMarkup('image',S.cur,[[b[0],b[1]],[b[2],b[3]]],Object.assign({},S.defaults.image||{}));m.img=url;m.subject='Snapshot';pushUndo();S.markups.push(m);commit();setSel([m.id])}}]);return C3.lastClip}
const b64=u=>{let s='';const CH=0x8000;for(let i=0;i<u.length;i+=CH)s+=String.fromCharCode.apply(null,u.subarray(i,i+CH));return btoa(s)};
const typing=e=>{const t=e.target;return t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))};
// Ctrl+Alt+C already runs "Copy page as image" in the shortcut handler; make that command also copy the page as a vector snapshot
function wrapCopyPage(){try{const W=window.PMWorkspace,c=W&&W.CMDS&&W.CMDS.find(x=>x.id==='copyimg');if(c&&!c.__c3){const r=c.run;c.run=function(){copyPageSnapshot().then(()=>toast('Page copied as an image and as a snapshot (Styles → Paste vector snapshot)')).catch(err=>console.warn(err));return r.apply(this,arguments)};c.__c3=1;return true}}catch(e){}return false}
H.ready.push(()=>{setTimeout(wrapCopyPage,400);setTimeout(wrapCopyPage,2000)});
window.addEventListener('keydown',e=>{if(typing(e)||!S.pages.length)return;const k=e.key.toLowerCase();
 if(e.ctrlKey&&e.altKey)wrapCopyPage();   // also re-applied if the shortcut list was rebuilt
 if(e.ctrlKey&&e.altKey&&!e.shiftKey&&k==='c'&&!(window.PMWorkspace&&PMWorkspace.CMDS&&PMWorkspace.CMDS.some(x=>x.id==='copyimg'))){copyPageSnapshot().then(()=>toast('Page copied as a snapshot')).catch(err=>console.warn(err))}
 if(e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&k==='g'){e.preventDefault();e.stopPropagation();snapshotContent()}},true);

/* ======================================================================= hub + commands */
function hub(){modal('Search & compare',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
 ${[['c3VS','VisualSearch','Find a symbol, filter by color, then count, mark or link the results'],['c3ST','Stitch sheets','Join matchline drawings into one page'],['c3SO','Smart Overlay','Overlay a whole old set on a new set, sheet by sheet'],['c3CP','Copy page to snapshot','Ctrl+Alt+C — the whole page as a vector snapshot'],['c3SC','Snapshot content','Shift+G — an area without markups'],['c3MA','Make annotations from measurements','Keep session measurements in the document']].map(([id,t,d])=>`<button class="btn" id="${id}" style="border:1px solid var(--line);flex-direction:column;align-items:flex-start;height:auto;padding:10px;text-align:left;white-space:normal"><b>${t}</b><span class="hint" style="font-size:11px">${d}</span></button>`).join('')}</div>`,[{label:'Close',cancel:1}]);
 const go=(id,fn)=>{$('#'+id).onclick=()=>{closeModal();fn()}};go('c3VS',visualSearch);go('c3ST',stitchDialog);go('c3SO',smartOverlayDialog);go('c3CP',()=>copyPageSnapshot().then(()=>toast('Page copied as a snapshot')));go('c3SC',()=>snapshotContent());go('c3MA',()=>{switchTab('studio');renderSessBox();makeAnnotations()})}
H.ribbon.push({label:'Search+',title:'VisualSearch, Stitch sheets, Smart Overlay, page snapshots',icon:ICO_VS,fn:hub});
H.ready.push(()=>{try{const W=window.PMWorkspace;if(W&&Array.isArray(W.CMDS)){W.CMDS.push({id:'c3:vs',label:'VisualSearch…',menu:'Tools',run:visualSearch},{id:'c3:stitch',label:'Stitch sheets…',menu:'Document',run:stitchDialog},{id:'c3:so',label:'Smart Overlay…',menu:'Document',run:smartOverlayDialog})}}catch(e){}});
window.PMCompare3={C3,visualSearch,runVisualSearch,showResults,countChecked,applyToChecked,linkChecked,stitchDialog,stitch,autoOffset,similarity,smartOverlayDialog,smartOverlay,sheetLabels,matchSheets,srcFrom,
 makeAnnotations,sessionOnly,renderSessBox,copyPageSnapshot,snapshotContent,sampleColors,hub};
})();
