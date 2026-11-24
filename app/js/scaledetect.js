/* PlanMark — proposed scale, read from the sheet and checked independently.
   When a page has no scale yet, PlanMark reads the sheet's own text for a printed scale ("SCALE: 1/4" = 1'-0"",
   "1" = 20'", "1:100"), then tests it on its own: it finds written dimensions on the drawing (12'-6", 24'-0"…),
   measures the dimension line each one sits on, and works out the scale each implies. The proposal is shown with
   the result of that test — how many dimensions agree — and is only applied when you click Use.
   With no printed scale, a scale is proposed from the dimensions alone when they agree with each other.
   Tools > Check scale runs the same test on a page that already has a scale. Nothing changes until you choose. */
(function(){
const IN_PER_PT_1=1/72;                         // paper inches per PDF point
const inPerPt=sc=>sc.perPt/0.0254;              // real inches per point for a PlanMark scale
const frac=s=>{s=String(s).trim().replace(/-/g,' ');let v=0;for(const p of s.split(/\s+/)){if(!p)continue;if(p.includes('/')){const[a,b]=p.split('/').map(Number);if(b)v+=a/b}else v+=+p}return v};
const Q='["”″]|\'\'',F='[\'’′]';
const RX_ARCH=new RegExp(`(\\d+\\s*[- ]\\s*\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(?:${Q}|IN\\.?)?\\s*=\\s*1\\s*(?:${F}|FT\\.?)\\s*-?\\s*0?\\s*(?:${Q})?`,'gi');
const RX_ENG=new RegExp(`\\b1\\s*(?:${Q}|IN\\.?)\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*(?:${F}|FT\\.?|FEET)(?!\\s*-?\\s*\\d)`,'gi');
const RX_ARCHS=new RegExp(`SCALE\\s*:?\\s*(\\d+\\/\\d+|\\d+\\s+\\d+\\/\\d+)\\s*(?:${Q})`,'i');
const RX_MET=/\b1\s*:\s*(\d{1,4})\b/g;
const RX_NTS=/\bN\.?\s?T\.?\s?S\b|NOT\s+TO\s+SCALE/i;
const RX_DIM=new RegExp(`^\\s*(\\d{1,4})\\s*${F}\\s*-?\\s*(\\d{1,2}(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+)?\\s*(?:${Q})?\\s*$`);
const archLabel=n=>{const k=(window.ARCH||ARCH).find(([,v])=>Math.abs(v-n)<1e-6);return(k?k[0]:fmtFrac(n))+'" = 1\'-0"'};
function fmtFrac(n){const w=Math.floor(n),r=n-w;if(r<1e-6)return String(w);const d=[2,4,8,16,32,64].find(d=>Math.abs(r*d-Math.round(r*d))<1e-6)||64;const t=Math.round(r*d);return(w?w+'-':'')+t+'/'+d}
// a scale found in text, as a PlanMark scale object
function mk(kind,n){if(kind==='a')return{perPt:12/n*0.0254/72,unit:'ftin',label:archLabel(n),dec:2,prec:16};
 if(kind==='e')return{perPt:12*n*0.0254/72,unit:'ft',label:`1" = ${n}'`,dec:2,prec:16};
 return{perPt:n*0.0254/72,unit:n>=50?'m':'mm',label:'1:'+n,dec:2,prec:16}}

// ---- read the page: text lines and straight line segments, in page points from the top-left
const cache=new Map();
async function readPage(n){const key=S.fileKey+'|'+n;if(cache.has(key))return cache.get(key);
 const pg=await S.pdf.getPage(n),vp=pg.getViewport({scale:1});const tc=await pg.getTextContent();
 const items=[];for(const it of tc.items){if(!it.str||!it.str.trim())continue;const t=it.transform;const p0=vp.convertToViewportPoint(t[4],t[5]);
  const ux=t[0],uy=t[1],L=Math.hypot(ux,uy)||1,h=Math.hypot(t[2],t[3])||L;const p1=vp.convertToViewportPoint(t[4]+ux/L*(it.width||0),t[5]+uy/L*(it.width||0));
  const ang=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]);items.push({s:it.str,x:p0[0],y:p0[1],x2:p1[0],y2:p1[1],w:Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),h,ang})}
 const segs=await segments(pg,vp);const r={items,segs,W:vp.width,H:vp.height};cache.set(key,r);return r}
async function segments(pg,vp){const O=pdfjsLib.OPS;let ol;try{ol=await pg.getOperatorList()}catch(e){return[]}
 const out=[],st=[];let m=[1,0,0,1,0,0];const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const P=(x,y)=>vp.convertToViewportPoint(m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]);
 const fn=ol.fnArray,ar=ol.argsArray;for(let i=0;i<fn.length&&out.length<250000;i++){const f=fn[i],a=ar[i];
  if(f===O.save)st.push(m.slice());else if(f===O.restore){m=st.pop()||[1,0,0,1,0,0]}
  else if(f===O.transform)m=mul(m,a);
  else if(f===O.paintFormXObjectBegin){st.push(m.slice());if(a&&a[0])m=mul(m,a[0])}else if(f===O.paintFormXObjectEnd){m=st.pop()||m}
  else if(f===O.constructPath){const ops=a[0],c=a[1];let k=0,cur=null,start=null;
   for(const op of ops){if(op===O.moveTo){cur=P(c[k],c[k+1]);start=cur;k+=2}
    else if(op===O.lineTo){const q=P(c[k],c[k+1]);k+=2;if(cur)out.push([cur[0],cur[1],q[0],q[1]]);cur=q}
    else if(op===O.curveTo){cur=P(c[k+4],c[k+5]);k+=6}else if(op===O.curveTo2||op===O.curveTo3){cur=P(c[k+2],c[k+3]);k+=4}
    else if(op===O.rectangle){const x=c[k],y=c[k+1],w=c[k+2],h=c[k+3];k+=4;const p=[P(x,y),P(x+w,y),P(x+w,y+h),P(x,y+h)];for(let j=0;j<4;j++)out.push([p[j][0],p[j][1],p[(j+1)%4][0],p[(j+1)%4][1]]);cur=p[0]}
    else if(op===O.closePath){if(cur&&start&&(cur[0]!==start[0]||cur[1]!==start[1]))out.push([cur[0],cur[1],start[0],start[1]]);cur=start}}}}
 return out}
// group text pieces that sit on one baseline into lines ("SCALE:", "1/4\"", "= 1'-0\"" are often separate pieces)
function lines(items){const L=[];const sorted=items.slice().sort((a,b)=>a.ang-b.ang||a.y-b.y||a.x-b.x);
 for(const it of sorted){const l=L.find(l=>Math.abs(l.ang-it.ang)<.05&&Math.abs(l.y-it.y)<it.h*.45&&it.x>=l.x2-it.h*1.5&&it.x<=l.x2+it.h*3);
  if(l){l.s+=(it.x-l.x2>it.h*.15?' ':'')+it.s;l.x2=Math.max(l.x2,it.x2);l.items.push(it)}else L.push({s:it.s,x:it.x,y:it.y,x2:it.x2,h:it.h,ang:it.ang,items:[it]})}
 return L}

// ---- 1. the printed scale
function printed(rd){const L=lines(rd.items),found=new Map();let nts=false;
 const scaleWords=L.filter(l=>/SCALE/i.test(l.s));
 const near=l=>scaleWords.some(w=>w===l||Math.hypot(w.x-l.x,w.y-l.y)<Math.max(80,l.h*8));
 const add=(key,sc,l,isMet)=>{if(isMet&&!near(l))return;let wgt=1+(/SCALE/i.test(l.s)?4:near(l)?2:0)+(l.x>rd.W*.6&&l.y>rd.H*.6?1:0);
  const f=found.get(key)||{sc,weight:0,count:0,where:l};f.weight+=wgt;f.count++;found.set(key,f)};
 for(const l of L){const s=l.s.replace(/\s+/g,' ');if(RX_NTS.test(s)&&/SCALE|N\.?T\.?S/i.test(s))nts=true;
  for(const m of s.matchAll(RX_ARCH)){const n=frac(m[1]);if(n>0&&n<=12)add('a'+n,mk('a',n),l)}
  if(!/=/.test(s)){const m=RX_ARCHS.exec(s);if(m){const n=frac(m[1]);if(n>0&&n<=3)add('a'+n,mk('a',n),l)}}
  for(const m of s.matchAll(RX_ENG)){const n=+m[1];if(n>=1&&n<=1000&&!/=\s*1\s*['’′]\s*-?\s*0/.test(m[0]))add('e'+n,mk('e',n),l)}
  for(const m of s.matchAll(RX_MET)){const n=+m[1];if(n>=2&&n<=5000)add('m'+n,mk('m',n),l,true)}}
 const all=[...found.values()].sort((a,b)=>b.weight-a.weight);return{best:all[0]||null,all,nts}}

// ---- 2. the independent test: written dimensions against the lines they sit on
function dimensions(rd){const res=[];
 for(const it of rd.items){const m=RX_DIM.exec(it.s);if(!m)continue;const inches=(+m[1])*12+(m[2]?frac(m[2]):0);if(inches<12)continue;
  const cx=(it.x+it.x2)/2+Math.sin(it.ang)*it.h*.35,cy=(it.y+it.y2)/2-Math.cos(it.ang)*it.h*.35;   // middle of the text
  const ux=Math.cos(it.ang),uy=Math.sin(it.ang);
  const nx=-uy,ny=ux;
  // pieces of line running the same way as the text, close to it (the dimension line; often split around the text)
  const par=[];for(const sg of rd.segs){const dx=sg[2]-sg[0],dy=sg[3]-sg[1],len=Math.hypot(dx,dy);if(len<2)continue;
   if(Math.abs((dx*uy-dy*ux)/len)>.035)continue;
   const o0=(sg[0]-cx)*nx+(sg[1]-cy)*ny,o1=(sg[2]-cx)*nx+(sg[3]-cy)*ny;if(Math.abs(o0-o1)>1)continue;const off=(o0+o1)/2;if(Math.abs(off)>it.h*2.2)continue;
   const t0=(sg[0]-cx)*ux+(sg[1]-cy)*uy,t1=(sg[2]-cx)*ux+(sg[3]-cy)*uy;par.push({a:Math.min(t0,t1),b:Math.max(t0,t1),off})}
  if(!par.length)continue;
  // the dimension line = the offset whose pieces come nearest to the middle of the text
  par.sort((p,q)=>Math.min(Math.abs(p.a),Math.abs(p.b),p.a<0&&p.b>0?0:1e9)-Math.min(Math.abs(q.a),Math.abs(q.b),q.a<0&&q.b>0?0:1e9)||Math.abs(p.off)-Math.abs(q.off));
  const off=par[0].off,on=par.filter(q=>Math.abs(q.off-off)<.8);
  // where it ends: the nearest extension line / tick / arrow crossing it on each side of the text
  const half=it.w/2;let lo=-Infinity,hi=Infinity;
  for(const sg of rd.segs){const dx=sg[2]-sg[0],dy=sg[3]-sg[1],len=Math.hypot(dx,dy);if(len<2)continue;
   const sin=Math.abs((dx*uy-dy*ux)/len);if(sin<.34)continue;                                   // more than ~20° off the line
   const o0=(sg[0]-cx)*nx+(sg[1]-cy)*ny-off,o1=(sg[2]-cx)*nx+(sg[3]-cy)*ny-off;if(o0*o1>0&&Math.min(Math.abs(o0),Math.abs(o1))>1)continue;   // must cross (or touch) the line
   const k=Math.abs(o0-o1)<1e-9?0:o0/(o0-o1);const t=((sg[0]+dx*k)-cx)*ux+((sg[1]+dy*k)-cy)*uy;
   if(t<-half&&t>lo)lo=t;if(t>half&&t<hi)hi=t}
  // ends must lie on the drawn line (allow the gap the text sits in)
  const covered=t=>on.some(q=>t>=q.a-2&&t<=q.b+2);
  if(!isFinite(lo)||!isFinite(hi)||!covered(lo)||!covered(hi)){   // no ticks found: fall back to the drawn line's own ends, without joining neighbours
   const pieces=on.filter(q=>q.b>-half*3&&q.a<half*3);if(!pieces.length)continue;lo=Math.min(...pieces.map(q=>q.a));hi=Math.max(...pieces.map(q=>q.b))}
  const best={L:hi-lo};if(!(best.L>it.w*1.2))continue;
  if(best)res.push({text:it.s.trim(),inches,lenPt:best.L,inPerPt:inches/best.L})}
 return res}
function test(sc,dims){if(!dims.length)return{tested:0,agree:0};const want=inPerPt(sc);const ok=dims.filter(d=>Math.abs(d.inPerPt/want-1)<=.04);return{tested:dims.length,agree:ok.length,dims}}
function fromDims(dims){if(dims.length<3)return null;const v=dims.map(d=>d.inPerPt).sort((a,b)=>a-b),med=v[v.length>>1];
 const agree=v.filter(x=>Math.abs(x/med-1)<=.04).length;if(agree<3||agree<dims.length*.5)return null;
 const cands=[...ARCH.map(([,n])=>mk('a',n)),...ENG.map(n=>mk('e',n)),...METRIC.map(n=>mk('m',n))];
 let best=null;for(const sc of cands){const r=Math.abs(inPerPt(sc)/med-1);if(r<=.03&&(!best||r<best.r))best={sc,r}}return best?{sc:best.sc,agree}:null}

// ---- scanned sheets (no text in the PDF): read the words with OCR, and measure dimension lines in the picture
const ocrDone=new Map();
// common OCR slips on drawings: 1"-0" for 1'-0", and dimensions read without their foot / inch marks (16-0 for 16'-0")
const fixOcr=t=>{t=String(t).trim().replace(/(\d)\s*["”″]\s*-\s*(\d)/g,"$1'-$2");
 const m=/^(\d{1,3})\s*[-–]\s*(\d{1,2})["”″]?$/.exec(t);if(m&&+m[2]<12)return`${m[1]}'-${m[2]}"`;return t};
async function scanText(n,rd){const key=S.fileKey+'|'+n;if(ocrDone.has(key))return ocrDone.get(key);
 let words=(S.ocr&&S.ocr[n])||null;if(!words){try{if(window.PMOCR&&PMOCR.ocrPage){await PMOCR.ocrPage(n);words=(S.ocr&&S.ocr[n])||[]}}catch(e){console.warn(e)}}if(!Array.isArray(words))words=[];
 const items=words.filter(w=>w.vb).map(w=>({s:fixOcr(w.str),x:w.vb[0],y:w.vb[3],x2:w.vb[2],y2:w.vb[3],w:w.vb[2]-w.vb[0],h:Math.max(4,w.vb[3]-w.vb[1]),ang:0}));
 ocrDone.set(key,items);return items}
async function rasterDims(n,items){const res=[],dbg=window.__sdDbg=[];const clean=t=>t.replace(/\s+(?=['’′"”″-])/g,'').replace(/(['’′])\s*-\s*/,"$1-");
 const L=items.filter(it=>RX_DIM.test(clean(it.s)));if(!L.length)return res;
 const pg=await S.pdf.getPage(n),v1=pg.getViewport({scale:1}),k=Math.min(3,Math.sqrt(40e6/(v1.width*v1.height)));const vp=pg.getViewport({scale:k});
 const cv=document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
 await pg.render({canvasContext:ctx,viewport:vp}).promise;const W=cv.width,Hh=cv.height,px=ctx.getImageData(0,0,W,Hh).data;cv.width=cv.height=1;
 const dk=(x,y)=>{if(x<0||y<0||x>=W||y>=Hh)return false;const i=(y*W+x)*4;return px[i]*.3+px[i+1]*.59+px[i+2]*.11<150};
 for(const it of L){const m=RX_DIM.exec(clean(it.s));const inches=(+m[1])*12+(m[2]?frac(m[2]):0);if(inches<12)continue;
  const vert=it.h>it.w*1.3;   // text running up the sheet: work along the columns instead of the rows
  // u = along the text, v = across it
  const D=vert?(u,v)=>dk(v,u):(u,v)=>dk(u,v);const UMAX=vert?Hh:W;
  const ux0=Math.round((vert?it.y-it.h:it.x)*k),ux1=Math.round((vert?it.y:it.x2)*k);
  const vx0=Math.round((vert?it.x:it.y-it.h)*k),vx1=Math.round((vert?it.x2:it.y)*k);
  const th=Math.max(5,vx1-vx0),tl=Math.max(5,ux1-ux0);
  const D3=(u,v)=>D(u,v)||D(u,v-1)||D(u,v+1);
  // the dimension line: a line of dark pixels running along the text, just beside it or through it, on both sides
  let row=-1,bestScore=0;const span=Math.max(th*4,tl);
  for(let v=vx0-Math.round(th*1.6);v<=vx1+Math.round(th*1.6);v++){let a=0,b=0;
   for(let u=ux0-span;u<ux0-2;u++)if(D3(u,v))a++;for(let u=ux1+2;u<ux1+span;u++)if(D3(u,v))b++;const sc=Math.min(a,b);if(sc>bestScore){bestScore=sc;row=v}}
  if(row<0||bestScore<th*1.5){dbg.push([it.s,'noline',bestScore,th]);continue}
  // walk out along it to the first extension line / tick crossing it
  const across=(u)=>{let a=row,b=row;while(row-a<th*3&&(D(u,a-1)||D(u-1,a-1)||D(u+1,a-1)))a--;while(b-row<th*3&&(D(u,b+1)||D(u-1,b+1)||D(u+1,b+1)))b++;return b-a};
  const walk=(u,dir)=>{let gap=0,last=u,seen=false;for(;u>0&&u<UMAX-1;u+=dir){if(D3(u,row)){seen=true;gap=0;last=u;if(across(u)>=th*.9)return u}else if(seen&&++gap>Math.max(3,th*.4))break;else if(!seen&&Math.abs(u-(dir<0?ux0:ux1))>th*3)break}return last};
  const lo=walk(ux0-2,-1),hi=walk(ux1+2,1);const Lpt=(hi-lo)/k;dbg.push([it.s,Lpt,inches/Lpt]);
  if(Lpt>tl/k*1.2)res.push({text:clean(it.s).trim(),inches,lenPt:Lpt,inPerPt:inches/Lpt,scan:true})}
 return res}

// ---- the proposal for a page
async function propose(n){if(!S.pdf)return null;let rd=await readPage(n);let scanned=false;
 if(!rd.items.length){scanned=true;const items=await scanText(n,rd);rd=Object.assign({},rd,{items})}
 const pr=printed(rd),dims=scanned?await rasterDims(n,rd.items):dimensions(rd);
 if(pr.best){const t=test(pr.best.sc,dims);let alt=null;
  if(t.tested>=3&&t.agree<t.tested*.5){const f=fromDims(dims);if(f&&Math.abs(inPerPt(f.sc)/inPerPt(pr.best.sc)-1)>.04)alt=f}
  return{page:n,source:'sheet',sc:pr.best.sc,others:pr.all.slice(1).map(x=>x.sc.label),test:t,alt,nts:pr.nts}}
 const f=fromDims(dims);if(f)return{page:n,source:'dims',sc:f.sc,test:{tested:dims.length,agree:f.agree},nts:pr.nts};
 return{page:n,source:null,nts:pr.nts,test:{tested:dims.length,agree:0}}}

// ---- the offer, a small bar over the drawing (only for pages without a scale)
const dismissed=new Set();let busy=0;
const css=document.createElement('style');css.textContent=`#sdBar{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:30;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.35);padding:5px 8px;font-size:12px;display:flex;align-items:center;gap:6px;max-width:calc(100% - 40px);white-space:nowrap}#sdBar>span{min-width:0;overflow:hidden;text-overflow:ellipsis}#sdBar .btn{height:24px;padding:0 8px}
#sdBar b{font-weight:600}#sdBar .ok{color:#3fb950}#sdBar .warn{color:#e3a008}#sdBar .mut{color:var(--mut)}#sdBar button{white-space:nowrap}`;document.head.appendChild(css);
const _usb=updateScaleBtn;updateScaleBtn=function(){const r=_usb.apply(this,arguments);try{const sc=scaleFor(S.cur);if(sc&&!sc.none)hideBar()}catch(e){}return r};
function hideBar(){const b=document.getElementById('sdBar');if(b)b.remove()}
function verdict(p){const t=p.test||{};if(!t.tested)return`<span class="mut">no written dimensions to test it against</span>`;
 if(t.agree>=Math.max(1,Math.ceil(t.tested*.5)))return`<span class="ok">✓ checked: ${t.agree} of ${t.tested} dimension${t.tested>1?'s':''} on the sheet match</span>`;
 return`<span class="warn">⚠ only ${t.agree} of ${t.tested} dimensions match</span>`}
function showBar(p){hideBar();const host=document.getElementById('mainPane')||viewer.parentElement;if(!host)return;
 const d=document.createElement('div');d.id='sdBar';
 const what=p.source==='sheet'?`Scale on this sheet: <b>${esc(p.sc.label)}</b>`:`Scale from the dimensions on this sheet: <b>${esc(p.sc.label)}</b>`;
 const extra=p.alt?` <span class="warn">— the dimensions point to ${esc(p.alt.sc.label)}</span>`:p.others&&p.others.length?` <span class="mut">(also on the sheet: ${p.others.slice(0,3).map(esc).join(', ')})</span>`:'';
 d.innerHTML=`<span>${what} · ${verdict(p)}${extra}</span><button class="btn pri" data-a="page">Use for this page</button><button class="btn" data-a="all">All pages</button>${p.alt?`<button class="btn" data-a="alt">Use ${esc(p.alt.sc.label)}</button>`:''}<button class="btn" data-a="cal">Calibrate</button><button class="btn" data-a="x" title="Not now">✕</button>`;
 host.appendChild(d);   // a small card at the bottom of the drawing
 d.onclick=e=>{const a=e.target.closest('[data-a]');if(!a)return;const k=a.dataset.a;dismissed.add(S.fileKey+'|'+p.page);hideBar();
  if(k==='page'||k==='all'||k==='alt'){const sc=Object.assign({},k==='alt'?p.alt.sc:p.sc);if(k==='all')S.scales={all:sc};else S.scales[p.page]=sc;saveScales();commit();updateScaleBtn();renderProps();
   toast(`Scale set: ${sc.label}${k==='all'?' (all pages)':''}`);if(window.PMRevu)PMRevu.status()}
  else if(k==='cal'){setTool('calibrate');toast('Draw a line over a known dimension')}}}
async function check(){hideBar();if(!S.pdf||!S.pages.length)return;const n=S.cur,key=S.fileKey+'|'+n;if(S.scales[n]||S.scales.all||dismissed.has(key))return;
 const my=++busy;let p;try{p=await propose(n)}catch(e){return}if(my!==busy||S.cur!==n||S.scales[n]||S.scales.all)return;if(p&&p.sc)showBar(p)}
let t=0;const later=()=>{clearTimeout(t);t=setTimeout(check,700)};
H.open.push(()=>{cache.clear();hideBar();later()});
setInterval(()=>{const b=document.getElementById('sdBar');if(b&&S.pdf){try{const sc=scaleFor(S.cur);if(sc&&!sc.none)hideBar()}catch(e){}}if(S.pdf&&!document.getElementById('sdBar'))later.last!==S.cur&&(later.last=S.cur,later())},1000);
// Tools > Check scale: runs the same test on the current page whatever its scale is
async function checkNow(){if(!S.pdf)return;const n=S.cur,cur=scaleFor(n);let rd=await readPage(n),dims;
 if(!rd.items.length){toast('Reading the scanned sheet…');const items=await scanText(n,rd);rd=Object.assign({},rd,{items});dims=await rasterDims(n,items)}else dims=dimensions(rd);
 if(cur.none){dismissed.delete(S.fileKey+'|'+n);const p=await propose(n);if(p&&p.sc)return showBar(p);return toast(p&&p.nts?'This sheet is marked not to scale':'No scale found on this sheet. Calibrate over a known dimension.')}
 const t=test(cur,dims);if(!t.tested)return toast(`Scale ${cur.label}: no written dimensions on this page to check it against`);
 const ok=t.agree>=Math.ceil(t.tested*.5);const f=!ok&&fromDims(dims);
 modal('Check scale',`<div>Page ${n} is set to <b>${esc(cur.label)}</b>.</div><div style="margin:8px 0">${ok?'<span style="color:#3fb950">✓</span>':'<span style="color:#e3a008">⚠</span>'} ${t.agree} of ${t.tested} written dimensions match it.${f?` They point to <b>${esc(f.sc.label)}</b>.`:''}</div>
  <table style="font-size:12px;border-collapse:collapse;width:100%">${t.dims.slice(0,12).map(d=>`<tr><td style="padding:2px 6px">${esc(d.text)}</td><td style="padding:2px 6px;color:var(--mut)">measures ${esc(fmtLen(d.lenPt*cur.perPt,cur))}</td><td style="padding:2px 6px">${Math.abs(d.inPerPt/inPerPt(cur)-1)<=.04?'✓':'✗'}</td></tr>`).join('')}</table>`,
  f?[{label:'Close',cancel:1},{label:'Use '+f.sc.label,pri:1,fn:()=>{S.scales[n]=Object.assign({},f.sc);saveScales();commit();updateScaleBtn();renderProps();toast('Scale set: '+f.sc.label)}}]:[{label:'OK',pri:1}])}

window.PM_EXTRA_CMDS_SD=()=>[{id:'sd:check',menu:'Tools',label:'Check scale',key:'',run:checkNow}];
window.PMScaleDetect={propose,readPage,printed,dimensions,test,checkNow,check};
})();
