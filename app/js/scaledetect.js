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
const IN_W='INCH(?:ES)?|IN\\.?',FT_W='FOOT|FEET|FT\\.?';
const RX_ARCH=new RegExp(`(\\d+\\s*[- ]\\s*\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(?:${Q}|${IN_W})?\\s*=\\s*1\\s*(?:${F}|${FT_W})\\s*-?\\s*0?\\s*(?:${Q})?`,'gi');
const RX_ENG=new RegExp(`\\b1\\s*(?:${Q}|${IN_W})\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*(?:${F}|${FT_W})(?!\\s*-?\\s*[1-9])(?:\\s*-\\s*0\\s*(?:${Q})?)?`,'gi');
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
  const f=found.get(key)||{sc,weight:0,count:0,where:l,wheres:[]};f.weight+=wgt;f.count++;f.wheres.push(l);found.set(key,f)};
 for(const l of L){const s=l.s.replace(/\s+/g,' ');if(RX_NTS.test(s)&&/SCALE|N\.?T\.?S/i.test(s))nts=true;
  for(const m of s.matchAll(RX_ARCH)){const n=frac(m[1]);if(n>0&&n<=12)add('a'+n,mk('a',n),l)}
  if(!/=/.test(s)){const m=RX_ARCHS.exec(s);if(m){const n=frac(m[1]);if(n>0&&n<=3)add('a'+n,mk('a',n),l)}}
  for(const m of s.matchAll(RX_ENG)){const n=+m[1];if(n>=1&&n<=1000&&!/=\s*1\s*['’′]\s*-?\s*0/.test(m[0]))add('e'+n,mk('e',n),l)}
  for(const m of s.matchAll(RX_MET)){const n=+m[1];if(n>=2&&n<=5000)add('m'+n,mk('m',n),l,true)}}
 const all=[...found.values()].sort((a,b)=>b.weight-a.weight);
 // the title block's own entry ("SCALE: AS NOTED" or a scale) — tells us whether the sheet has several scales
 const tb=scaleWords.find(l=>l.x>rd.W*.6&&l.y>rd.H*.55&&/AS\s+(NOTED|SHOWN|INDICATED)|VARIES/i.test(l.s+' '+(L.find(k=>k!==l&&Math.abs(k.y-l.y)<l.h&&k.x>l.x&&k.x-l.x2<l.h*8)||{s:''}).s));
 return{best:all[0]||null,all,nts,asNoted:!!tb,lines:L}}

// ---- 2. the independent test: written dimensions against the lines they sit on
// what a written dimension says, in inches: 12'-6", 12' - 6 1/2", 8", 1 1/2", 180.00' (site plans), 3600 (millimetres, metric sheets only)
const RX_IN=new RegExp(`^\\s*(\\d{1,2}(?:\\s*[- ]\\s*\\d+\\/\\d+)?|\\d+\\/\\d+)\\s*(?:${Q})\\s*$`),RX_DECFT=new RegExp(`^\\s*(\\d{1,5}\\.\\d{1,2})\\s*(?:${F})\\s*$`),RX_MM=/^\s*(\d{3,5})\s*$/;
function parseDim(t,mm){t=String(t).replace(/\s+(?=['’′"”″])/g,'').replace(/(['’′])\s*-\s*/,"$1-").trim();let m=RX_DIM.exec(t);if(m)return{inches:(+m[1])*12+(m[2]?frac(m[2]):0),kind:'ftin'};
 if((m=RX_IN.exec(t)))return{inches:frac(m[1]),kind:'in'};if((m=RX_DECFT.exec(t)))return{inches:+m[1]*12,kind:'decft'};
 if(mm&&(m=RX_MM.exec(t)))return{inches:+m[1]/25.4,kind:'mm'};return null}
// dimension text is sometimes split into pieces (12' and -6", or a stacked fraction): join the pieces on one line too
function dimTexts(rd,mm){if(rd._dt&&rd._dt.mm===mm)return rd._dt.L;const out=rd.items.slice();
 for(const l of lines(rd.items)){if(l.items.length<2||Math.abs(l.ang)>.02||l.items.some(it=>parseDim(it.s,mm)))continue;if(!parseDim(l.s,mm))continue;
  out.push({s:l.s,x:l.x,y:l.y,x2:l.x2,y2:l.y,w:l.x2-l.x,h:Math.max(...l.items.map(i=>i.h)),ang:0})}
 rd._dt={mm,L:out};return out}
// segments in a band along a line of text (rows for level text, columns for vertical text): keeps big sheets fast
function bandIndex(rd,vert){const k=vert?'_cols':'_rows';if(rd[k])return rd[k];const m=new Map(),C=8;
 rd.segs.forEach((g,i)=>{const a=vert?Math.min(g[0],g[2]):Math.min(g[1],g[3]),b=vert?Math.max(g[0],g[2]):Math.max(g[1],g[3]);for(let c=Math.floor(a/C);c<=Math.floor(b/C);c++){let L=m.get(c);if(!L)m.set(c,L=[]);L.push(i)}});return rd[k]=m}
function band(rd,ux,uy,cx,cy,r){const vert=Math.abs(ux)<.02,lev=Math.abs(uy)<.02;if(!vert&&!lev)return rd.segs;const m=bandIndex(rd,vert),C=8,v=vert?cx:cy,seen=new Set(),out=[];
 for(let c=Math.floor((v-r)/C);c<=Math.floor((v+r)/C);c++)for(const i of m.get(c)||[])if(!seen.has(i)){seen.add(i);out.push(rd.segs[i])}return out}
function dimensions(rd,opt){const res=[],mm=!!(opt&&opt.mm),dbg=opt&&opt.dbg;const no=(it,w)=>{if(dbg)dbg.push([it.s,w])};
 for(const it of dimTexts(rd,mm)){const pd=parseDim(it.s,mm);if(!pd||!(pd.inches>0))continue;const inches=pd.inches;
  const cx=(it.x+it.x2)/2+Math.sin(it.ang)*it.h*.35,cy=(it.y+it.y2)/2-Math.cos(it.ang)*it.h*.35;   // middle of the text
  const ux=Math.cos(it.ang),uy=Math.sin(it.ang);
  const nx=-uy,ny=ux;
  // pieces of line running the same way as the text, close to it (the dimension line; often split around the text)
  const near=band(rd,ux,uy,cx,cy,it.h*2.6);
  const par=[];for(const sg of near){const dx=sg[2]-sg[0],dy=sg[3]-sg[1],len=Math.hypot(dx,dy);if(len<2)continue;
   if(Math.abs((dx*uy-dy*ux)/len)>.035)continue;
   const o0=(sg[0]-cx)*nx+(sg[1]-cy)*ny,o1=(sg[2]-cx)*nx+(sg[3]-cy)*ny;if(Math.abs(o0-o1)>1)continue;const off=(o0+o1)/2;if(Math.abs(off)>it.h*2.2)continue;
   const t0=(sg[0]-cx)*ux+(sg[1]-cy)*uy,t1=(sg[2]-cx)*ux+(sg[3]-cy)*uy;par.push({a:Math.min(t0,t1),b:Math.max(t0,t1),off})}
  if(!par.length){no(it,'noline');continue}
  // the dimension line = the offset whose pieces come nearest to the middle of the text
  par.sort((p,q)=>Math.min(Math.abs(p.a),Math.abs(p.b),p.a<0&&p.b>0?0:1e9)-Math.min(Math.abs(q.a),Math.abs(q.b),q.a<0&&q.b>0?0:1e9)||Math.abs(p.off)-Math.abs(q.off));
  const off=par[0].off,on=par.filter(q=>Math.abs(q.off-off)<.8);
  const half0=it.w/2;if(!on.some(q=>q.a<-half0+1)||!on.some(q=>q.b>half0-1)){no(it,['oneside',on.map(q=>[q.a|0,q.b|0]),half0|0]);continue}   // a dimension line runs out on both sides of its text
  // where it ends: the nearest extension line / tick / arrow crossing it on each side of the text
  const half=it.w/2;let lo=-Infinity,hi=Infinity;
  for(const sg of near){const dx=sg[2]-sg[0],dy=sg[3]-sg[1],len=Math.hypot(dx,dy);if(len<Math.max(3,it.h*.4))continue;
   const sin=Math.abs((dx*uy-dy*ux)/len);if(sin<.34)continue;                                   // more than ~20° off the line
   const o0=(sg[0]-cx)*nx+(sg[1]-cy)*ny-off,o1=(sg[2]-cx)*nx+(sg[3]-cy)*ny-off;if(o0*o1>0&&Math.min(Math.abs(o0),Math.abs(o1))>1)continue;   // must cross (or touch) the line
   if(sin<.9&&Math.abs(o0+o1)>len*.4)continue;   // a slanted tick sits centred on the line (extension lines are square to it)
   const k=Math.abs(o0-o1)<1e-9?0:o0/(o0-o1);const t=((sg[0]+dx*k)-cx)*ux+((sg[1]+dy*k)-cy)*uy;
   if(t<-half&&t>lo)lo=t;if(t>half&&t<hi)hi=t}
  // ends must lie on the drawn line (allow the gap the text sits in)
  const covered=t=>on.some(q=>t>=q.a-2&&t<=q.b+2);
  if(!isFinite(lo)||!isFinite(hi)||!covered(lo)||!covered(hi)){   // no ticks found: fall back to the drawn line's own ends, without joining neighbours
   const pieces=on.filter(q=>q.b>-half*3&&q.a<half*3);if(!pieces.length){no(it,'nopieces');continue}lo=Math.min(...pieces.map(q=>q.a));hi=Math.max(...pieces.map(q=>q.b))}
  const L=hi-lo;if(!(L>it.w*1.6)||L<14){no(it,['short',L|0,it.w|0]);continue}
  // the drawn line must actually run from end to end (it may break only where the text sits)
  {const iv=on.map(q=>[Math.max(q.a,lo),Math.min(q.b,hi)]).filter(q=>q[1]>q[0]).sort((p,q)=>p[0]-q[0]);const gaps=[];let e=lo;for(const[a,b]of iv){if(a>e+.5)gaps.push([e,a]);e=Math.max(e,b)}if(hi>e+.5)gaps.push([e,hi]);
   // the gap the text sits in is allowed (up to most of the line); any other breaks must be small
   const other=gaps.filter(g=>!(g[0]<=half0+2&&g[1]>=-half0-2&&g[1]-g[0]<L*.85)).reduce((t,g)=>t+g[1]-g[0],0);if(other>L*.15){no(it,['gaps',other|0,L|0]);continue}}
  const at=t=>[cx+ux*t+nx*off,cy+uy*t+ny*off];
  res.push({text:it.s.trim(),inches,kind:pd.kind,lenPt:L,inPerPt:inches/L,a:at(lo),b:at(hi),c:[cx,cy]})}
 return res}
const agrees=(d,sc)=>Math.abs(d.inPerPt/inPerPt(sc)-1)<=.04;
function test(sc,dims){if(!dims.length)return{tested:0,agree:0};const ok=dims.filter(d=>agrees(d,sc));return{tested:dims.length,agree:ok.length,dims}}
function fromDims(dims,metric){if(dims.length<3)return null;const v=dims.map(d=>d.inPerPt).sort((a,b)=>a-b),med=v[v.length>>1];
 const agree=v.filter(x=>Math.abs(x/med-1)<=.04).length;if(agree<3||agree<dims.length*.5)return null;
 const cands=metric?METRIC.map(n=>mk('m',n)):[...ARCH.map(([,n])=>mk('a',n)),...ENG.map(n=>mk('e',n)),...METRIC.map(n=>mk('m',n))];
 let best=null;for(const sc of cands){const r=Math.abs(inPerPt(sc)/med-1);if(r<=.03&&(!best||r<best.r))best={sc,r}}return best?{sc:best.sc,agree}:null}

// ---- details drawn at their own scale: find the area each one covers, to offer it as a viewport
// Line work is grouped into clusters of touching / nearby lines; a detail's area is the clusters its own dimensions
// and its title sit in, grown over the line work right next to them, but never over a dimension of the main drawing.
function clusters(rd){if(rd._cl)return rd._cl;const big=Math.max(rd.W,rd.H)*.35,segs=rd.segs.filter(g=>Math.hypot(g[2]-g[0],g[3]-g[1])<big);
 if(segs.length>80000)return rd._cl=null;const G=10,cell=24,grid=new Map(),par=segs.map((_,i)=>i);const fd=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i};
 const bb=segs.map(g=>[Math.min(g[0],g[2])-G/2,Math.min(g[1],g[3])-G/2,Math.max(g[0],g[2])+G/2,Math.max(g[1],g[3])+G/2]);
 bb.forEach((b,i)=>{for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let y=Math.floor(b[1]/cell);y<=Math.floor(b[3]/cell);y++){const k=x+','+y;let L=grid.get(k);if(!L)grid.set(k,L=[]);
  for(const j of L){const c=bb[j];if(c[0]<=b[2]&&c[2]>=b[0]&&c[1]<=b[3]&&c[3]>=b[1]){const a=fd(i),d=fd(j);if(a!==d)par[a]=d}}L.push(i)}});
 const m=new Map();segs.forEach((g,i)=>{const r=fd(i);let c=m.get(r);if(!c)m.set(r,c=[1e9,1e9,-1e9,-1e9]);c[0]=Math.min(c[0],g[0],g[2]);c[1]=Math.min(c[1],g[1],g[3]);c[2]=Math.max(c[2],g[0],g[2]);c[3]=Math.max(c[3],g[1],g[3])});
 return rd._cl=[...m.values()]}
const inB=(b,p,m=0)=>p[0]>=b[0]-m&&p[0]<=b[2]+m&&p[1]>=b[1]-m&&p[1]<=b[3]+m;
const hit=(a,b,m=0)=>a[0]<=b[2]+m&&a[2]>=b[0]-m&&a[1]<=b[3]+m&&a[3]>=b[1]-m;
function detailBox(rd,dims,titles,avoid){const C=clusters(rd);if(!C)return null;const huge=rd.W*rd.H*.3;
 let R=null;const grow=b=>{R=R?[Math.min(R[0],b[0]),Math.min(R[1],b[1]),Math.max(R[2],b[2]),Math.max(R[3],b[3])]:b.slice()};
 for(const d of dims)grow([Math.min(d.a[0],d.b[0]),Math.min(d.a[1],d.b[1]),Math.max(d.a[0],d.b[0]),Math.max(d.a[1],d.b[1])]);
 for(const t of titles)grow([t.x,t.y-t.h,t.x2,t.y+t.h*.3]);if(!R)return null;
 for(let k=0;k<4;k++){let ch=false;for(const c of C){if((c[2]-c[0])*(c[3]-c[1])>huge)continue;if(inB(R,[c[0],c[1]])&&inB(R,[c[2],c[3]]))continue;
   if(hit(c,R,k<2?24:8)){const n=[Math.min(R[0],c[0]),Math.min(R[1],c[1]),Math.max(R[2],c[2]),Math.max(R[3],c[3])];if(avoid.some(p=>inB(n,p)))continue;R=n;ch=true}}if(!ch)break}
 if(avoid.some(p=>inB(R,p)))return null;const m=8;return[R[0]-m,R[1]-m,R[2]+m,R[3]+m]}
// the drawing's name: the bolder line just above its "SCALE:" line
function titleOf(L,where){const c=L.filter(l=>l!==where&&Math.abs(l.ang-where.ang)<.05&&l.y<where.y&&where.y-l.y<where.h*4&&l.x<where.x2&&l.x2>where.x-where.h*2&&!/SCALE/i.test(l.s)).sort((a,b)=>b.y-a.y)[0];
 return c?c.s.replace(/\s+/g,' ').trim().slice(0,40):''}

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
const last=new Map();   // fileKey|page -> the latest proposal (for the scale dialog, menu and Measure panel)
async function propose(n){if(!S.pdf)return null;let rd=await readPage(n);let scanned=false;
 if(!rd.items.length){scanned=true;const items=await scanText(n,rd);rd=Object.assign({},rd,{items})}
 const pr=printed(rd),metric=pr.all.some(x=>/^1:/.test(x.sc.label)&&!pr.all.some(y=>!/^1:/.test(y.sc.label)));
 let dims=scanned?await rasterDims(n,rd.items):dimensions(rd,{mm:metric});
 if(!scanned&&!pr.all.length&&!dims.length)dims=dimensions(rd,{mm:true});   // no scale and no feet-and-inch dimensions: try millimetres
 const res={page:n,nts:pr.nts,scanned,details:[]};
 if(pr.all.length){
  // which printed scale does each dimension belong to? The main scale is the one most dimensions agree with
  const by=pr.all.map(f=>({f,dims:dims.filter(d=>agrees(d,f.sc))}));
  by.sort((a,b)=>b.dims.length-a.dims.length||b.f.weight-a.f.weight);
  const main=by[0],explained=new Set(by.flatMap(x=>x.dims));
  res.source='sheet';res.sc=main.f.sc;res.others=by.slice(1).map(x=>x.f.sc.label);
  res.test={tested:dims.length,agree:main.dims.length,other:[...explained].length-main.dims.length,dims};
  const rest=dims.filter(d=>!explained.has(d));
  if(dims.length>=3&&explained.size<dims.length*.5){const f=fromDims(rest,metric);if(f&&Math.abs(inPerPt(f.sc)/inPerPt(main.f.sc)-1)>.04)res.alt=f}
  // details at other scales -> proposed viewports (only where the detail's own dimensions or title place it)
  if(!scanned){const avoid=main.dims.map(d=>d.c);
   for(const x of by.slice(1)){if(!x.dims.length)continue;   // a detail is only offered when its own dimensions confirm its scale
    const titles=x.f.wheres.filter(l=>!(l.x>rd.W*.72&&l.y>rd.H*.6));   // (not the title block)
    const box=detailBox(rd,x.dims,titles,avoid);if(!box)continue;
    const nm=titles.length?titleOf(pr.lines,titles[0]):'';res.details.push({name:nm||('Detail at '+x.f.sc.label),sc:x.f.sc,box,dims:x.dims.length})}}}
 else{const f=fromDims(dims,metric);if(f){res.source='dims';res.sc=f.sc;res.test={tested:dims.length,agree:f.agree,other:0,dims}}else{res.source=null;res.test={tested:dims.length,agree:0,other:0}}}
 last.set(S.fileKey+'|'+n,res);return res}

// ---- the Measure panel: when the page has no scale, show what the sheet says, with Use
function measNote(){clearTimeout(measNote.t);measNote.t=setTimeout(()=>{const pane=document.getElementById('pane-measure');if(!pane||!S.pdf)return;let el=document.getElementById('sdMeas');
 const sc=scaleFor(S.cur),p=last.get(S.fileKey+'|'+S.cur);if(!sc.none||!p||!p.sc){if(el)el.remove();return}
 const meas=pane.querySelector('.meas');if(!meas)return;if(!el){el=document.createElement('div');el.id='sdMeas';el.style.cssText='margin:-2px 0 8px;font-size:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap'}
 if(el.previousElementSibling!==meas)meas.after(el);const ok=passes(p),t=p.test||{};
 el.innerHTML=`<span>${p.source==='sheet'?'Sheet says':'Dimensions say'} <b>${esc(p.sc.label)}</b> ${t.tested?(ok?'<span style="color:#3fb950">✓</span>':'<span style="color:#e3a008">⚠</span>'):''}</span><button class="btn" style="border:1px solid var(--line);height:24px">Use</button>`;
 el.querySelector('button').onclick=()=>{const v=applyProposal(p);if(v===false)return toast('This page has a protected scale');hideBar();afterApply();toast(`Scale set: ${p.sc.label}${v?` · ${v} detail viewport${v>1?'s':''} added`:''}`)}},260)}
{const _u=updateScaleBtn;updateScaleBtn=function(){const r=_u.apply(this,arguments);measNote();return r}}

// ---- putting a proposal to use
const pgName=n=>{const p=S.pages[n-1];return p&&p.label?`${p.label} (page ${n})`:'Page '+n};
function locked(n){return S.scales[n]&&S.scales[n].locked}
// a proposal sets the page scale and adds a viewport for each detail drawn at its own scale (existing viewports are kept)
function applyProposal(p,opts){const n=p.page;if(locked(n))return false;const sc=Object.assign({},opts&&opts.alt?p.alt.sc:p.sc);
 if(S.scales.all&&!S.scales[n]){const a=S.scales.all;delete S.scales.all;for(const q of S.pages)if(q.num!==n&&!S.scales[q.num])S.scales[q.num]=Object.assign({},a)}
 S.scales[n]=sc;let added=0;
 if(!(opts&&opts.alt)&&p.details&&p.details.length){S.scales.vp=S.scales.vp||{};const L=S.scales.vp[n]=S.scales.vp[n]||[];
  for(const d of p.details){if(L.some(v=>hit(v.box,d.box)&&Math.abs(v.scale.perPt/d.sc.perPt-1)<.01))continue;L.push({id:uid(),box:d.box.map(v=>Math.round(v*10)/10),name:d.name,scale:Object.assign({},d.sc),auto:true});added++}}
 return added}
function afterApply(){saveScales();commit();updateScaleBtn();renderProps();try{window.PMRevu&&PMRevu.status()}catch(e){}for(const q of S.pages)try{redrawPage(q.num)}catch(e){}}
// proposed viewports are shown dashed on the sheet while the offer is open
let preview=null;
H.over.push((n)=>{if(!preview||preview.page!==n||!preview.details.length)return'';const k=1/S.zoom;
 return'<g pointer-events="none">'+preview.details.map(d=>{const b=d.box;return`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="rgba(245,158,11,.06)" stroke="#f59e0b" stroke-width="${1.5*k}" stroke-dasharray="${7*k} ${4*k}"/><text x="${b[0]+3*k}" y="${b[1]-5*k}" font-size="${11*k}" fill="#d97706" font-family="Helvetica,Arial,sans-serif">${esc(d.name)} · ${esc(d.sc.label)} (proposed)</text>`}).join('')+'</g>'});
function setPreview(p){const old=preview&&preview.page;preview=p&&p.details&&p.details.length?p:null;try{if(old)redrawPage(old);if(preview)redrawPage(preview.page)}catch(e){}}

// ---- the offer, a small bar at the bottom of the drawing (only for pages without a scale)
const dismissed=new Set();let busy=0;
const css=document.createElement('style');css.textContent=`#sdBar{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:30;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.35);padding:5px 8px;font-size:12px;display:flex;align-items:center;gap:6px;max-width:calc(100% - 40px);white-space:nowrap}#sdBar>span{min-width:0;overflow:hidden;text-overflow:ellipsis}#sdBar .btn{height:24px;padding:0 8px}
#sdBar b{font-weight:600}#sdBar .ok{color:#3fb950}#sdBar .warn{color:#e3a008}#sdBar .mut{color:var(--mut)}#sdBar button{white-space:nowrap}
#sdBar .sdQ{display:inline-flex;width:15px;height:15px;border-radius:50%;border:1px solid var(--mut);color:var(--mut);font-size:10px;align-items:center;justify-content:center;cursor:pointer;margin-left:2px}`;document.head.appendChild(css);
const _usb=updateScaleBtn;updateScaleBtn=function(){const r=_usb.apply(this,arguments);try{const sc=scaleFor(S.cur);if(sc&&!sc.none)hideBar()}catch(e){}return r};
function hideBar(){const b=document.getElementById('sdBar');if(b){b.remove();setPreview(null)}}
// a scale passes when most dimensions agree — or when at least 3 agree and the rest don't agree on anything else (stray text)
function passes(p){const t=p.test||{};if(!t.tested)return true;const tot=t.agree+(t.other||0);if(tot>=Math.ceil(t.tested*.5))return true;
 if(tot>=3&&!p.alt){const rest=(t.dims||[]).filter(d=>!agrees(d,p.sc)&&!(p.details||[]).some(x=>agrees(d,x.sc)));return!fromDims(rest)}return false}
function verdict(p){const t=p.test||{};if(!t.tested)return`<span class="mut">no written dimensions to check it against</span>`;
 const tot=t.agree+(t.other||0);
 if(passes(p)){const all=tot===t.tested?(t.tested>1?`all ${t.tested} dimensions`:'the dimension'):tot>=Math.ceil(t.tested*.5)?`${tot} of ${t.tested} dimensions`:`${tot} dimensions`;
  return`<span class="ok">✓ ${all} match</span>`}
 return`<span class="warn">⚠ only ${tot} of ${t.tested} dimensions match</span>`}
function detailsTxt(p){const d=p.details||[];if(!d.length)return'';return` · + ${d.length} detail viewport${d.length>1?'s':''} <span class="mut">(dashed)</span>`}
function showBar(p){hideBar();const host=document.getElementById('mainPane')||viewer.parentElement;if(!host)return;
 const d=document.createElement('div');d.id='sdBar';
 const what=p.source==='sheet'?`Sheet scale <b>${esc(p.sc.label)}</b>`:`Dimensions point to <b>${esc(p.sc.label)}</b>`;
 const extra=p.alt?` <span class="warn">— the dimensions point to ${esc(p.alt.sc.label)}</span>`:'';
 d.innerHTML=`<span>${what} · ${verdict(p)}${extra}${p.alt?'':detailsTxt(p)}</span><span class="sdQ" data-a="why" title="How this was worked out">?</span><button class="btn pri" data-a="page">Use</button><button class="btn" data-a="all" title="Read the scale printed on every page and set each page to its own">All pages…</button>${p.alt?`<button class="btn" data-a="alt">Use ${esc(p.alt.sc.label)}</button>`:''}<button class="btn" data-a="cal">Calibrate</button><button class="btn" data-a="x" title="Not now">✕</button>`;
 host.appendChild(d);setPreview(p.alt?null:p);
 d.onclick=e=>{const a=e.target.closest('[data-a]');if(!a)return;const k=a.dataset.a;if(k==='why')return why(p);dismissed.add(S.fileKey+'|'+p.page);hideBar();
  if(k==='page'||k==='alt'){const v=applyProposal(p,{alt:k==='alt'});if(v===false)return toast('This page has a protected scale');afterApply();
   toast(`Scale set: ${(k==='alt'?p.alt.sc:p.sc).label}${v?` · ${v} detail viewport${v>1?'s':''} added`:''}`)}
  else if(k==='all')allPages();
  else if(k==='cal'){setTool('calibrate');toast('Draw a line over a known dimension')}}}
// "?" — what was read and how each dimension measured
function why(p){const t=p.test||{},ds=(t.dims||[]).slice(0,40);const scs=[p.sc,...(p.details||[]).map(d=>d.sc)];
 modal('How the scale was found',`<div style="margin-bottom:6px">${p.source==='sheet'?`Printed on the sheet: <b>${esc(p.sc.label)}</b>${p.others&&p.others.length?` (also printed: ${p.others.map(esc).join(', ')})`:''}.`:`No scale is printed on this sheet; the written dimensions all point to <b>${esc(p.sc.label)}</b>.`}</div>
  <div class="hint" style="margin-bottom:8px">Each written dimension was measured along its dimension line and compared with the scale.${p.scanned?' This is a scanned sheet, so the words were read with text recognition.':''}</div>
  ${ds.length?`<table style="font-size:12px;border-collapse:collapse;width:100%"><tr style="color:var(--mut)"><td style="padding:2px 6px">Written</td><td style="padding:2px 6px">Measures at ${esc(p.sc.label)}</td><td></td></tr>${ds.map(d=>{const okS=scs.find(sc=>agrees(d,sc));return`<tr><td style="padding:2px 6px">${esc(d.text)}</td><td style="padding:2px 6px;color:var(--mut)">${esc(fmtLen(d.lenPt*p.sc.perPt,p.sc))}</td><td style="padding:2px 6px">${okS?(okS===p.sc?'✓':'✓ <span style="color:var(--mut)">at '+esc(okS.label)+'</span>'):'✗'}</td></tr>`}).join('')}</table>`:'<div class="hint">No written dimensions were found to check against.</div>'}
  ${(p.details||[]).length?`<div style="margin-top:8px">Details at their own scale (shown dashed): ${p.details.map(d=>`<b>${esc(d.name)}</b> ${esc(d.sc.label)}`).join(' · ')}. Using the scale adds them as viewports, so measurements inside each one use its scale.</div>`:''}`,[{label:'OK',pri:1}])}
// set every page from its own sheet
async function allPages(){if(!S.pdf)return;const N=S.pages.length,res=[];let stop=false;
 const prog=document.createElement('div');prog.id='sdBar';prog.innerHTML='<span>Reading the scale on every page… <b>0</b> of '+N+'</span><button class="btn" data-a="stop">Stop</button>';(document.getElementById('mainPane')||viewer.parentElement).appendChild(prog);prog.onclick=e=>{if(e.target.closest('[data-a=stop]'))stop=true};
 for(let n=1;n<=N&&!stop;n++){prog.querySelector('b').textContent=n;let p=null;try{p=await propose(n)}catch(e){}res.push({n,p})}
 prog.remove();
 let set=0,vps=0;const rows=res.map(({n,p})=>{const has=!!S.scales[n]&&!S.scales[n].none;
  if(!p||!p.sc)return[n,p&&p.nts?'Marked not to scale — left as is':'No scale found — left as is','mut'];
  const t=p.test||{},ok=passes(p);
  if(!ok)return[n,`${esc(p.sc.label)} printed, but only ${t.agree+(t.other||0)} of ${t.tested} dimensions match${p.alt?' (they point to '+esc(p.alt.sc.label)+')':''} — left as is, check it`,'warn'];
  if(has||S.scales.all){const c=scaleFor(n);return Math.abs(c.perPt/p.sc.perPt-1)<.002?[n,`Already ${esc(c.label)} ✓`,'mut']:[n,`Kept your scale ${esc(c.label)} — the sheet says ${esc(p.sc.label)}`,'warn']}   // never overwrite a scale someone set
  const v=applyProposal(p);if(v===false)return[n,'Protected scale — left as is','mut'];set++;vps+=v;
  return[n,`<b>${esc(p.sc.label)}</b>${t.tested?' ✓':''}${v?` + ${v} detail viewport${v>1?'s':''}`:''}`,'ok']});
 if(stop)rows.push(['','Stopped — the rest were not read','mut']);
 if(set)afterApply();
 modal('Scale on every page',`<div style="margin-bottom:8px">${set} of ${N} pages set from their own sheet${vps?`, with ${vps} detail viewport${vps>1?'s':''}`:''}.</div><div style="max-height:50vh;overflow:auto"><table style="font-size:12px;border-collapse:collapse;width:100%">${rows.map(([n,t,c])=>`<tr><td style="padding:3px 8px;white-space:nowrap;color:var(--mut)">${n?esc(pgName(n)):''}</td><td style="padding:3px 8px;${c==='warn'?'color:#e3a008':''}">${t}</td></tr>`).join('')}</table></div>`,[{label:'OK',pri:1}])}
async function check(){hideBar();if(!S.pdf||!S.pages.length)return;const n=S.cur,key=S.fileKey+'|'+n;if(S.scales[n]||S.scales.all||dismissed.has(key))return;
 const my=++busy;let p;try{p=await propose(n)}catch(e){return}if(my!==busy||S.cur!==n||S.scales[n]||S.scales.all)return;if(p&&p.sc)showBar(p);measNote()}
let t=0;const later=()=>{clearTimeout(t);t=setTimeout(check,700)};
H.open.push(()=>{cache.clear();last.clear();hideBar();later()});
setInterval(()=>{const b=document.getElementById('sdBar');if(b&&S.pdf&&!b.querySelector('[data-a=stop]')){try{const sc=scaleFor(S.cur);if(sc&&!sc.none)hideBar()}catch(e){}if(preview&&preview.page!==S.cur)hideBar()}if(S.pdf&&!document.getElementById('sdBar'))later.last!==S.cur&&(later.last=S.cur,later())},1000);
// Tools > Check scale: runs the same test on the current page whatever its scale is (viewports use their own scale)
async function checkNow(){if(!S.pdf)return;const n=S.cur,cur=scaleFor(n);let rd=await readPage(n),dims;
 if(!rd.items.length){toast('Reading the scanned sheet…');const items=await scanText(n,rd);rd=Object.assign({},rd,{items});dims=await rasterDims(n,items)}else dims=dimensions(rd,{mm:/^1:/.test(cur.label||'')});
 if(cur.none){dismissed.delete(S.fileKey+'|'+n);const p=await propose(n);if(p&&p.sc)return showBar(p);return toast(p&&p.nts?'This sheet is marked not to scale':'No scale found on this sheet. Calibrate over a known dimension.')}
 if(!dims.length)return toast(`Scale ${cur.label}: no written dimensions on this page to check it against`);
 const scOf=d=>{try{const v=window.vpScaleAt&&vpScaleAt(n,d.c);return v||cur}catch(e){return cur}};
 const rows=dims.map(d=>{const sc=scOf(d);return{d,sc,ok:agrees(d,sc)}}),agree=rows.filter(r=>r.ok).length,ok=agree>=Math.ceil(dims.length*.5);
 const f=!ok&&fromDims(rows.filter(r=>r.sc===cur).map(r=>r.d));
 modal('Check scale',`<div>Page ${n} is set to <b>${esc(cur.label)}</b>.</div><div style="margin:8px 0">${ok?'<span style="color:#3fb950">✓</span>':'<span style="color:#e3a008">⚠</span>'} ${agree} of ${dims.length} written dimensions match${rows.some(r=>r.sc!==cur)?' (inside viewports, their own scale is used)':''}.${f?` They point to <b>${esc(f.sc.label)}</b>.`:''}</div>
  <div style="max-height:45vh;overflow:auto"><table style="font-size:12px;border-collapse:collapse;width:100%">${rows.slice(0,40).map(({d,sc,ok})=>`<tr><td style="padding:2px 6px">${esc(d.text)}</td><td style="padding:2px 6px;color:var(--mut)">measures ${esc(fmtLen(d.lenPt*sc.perPt,sc))}${sc!==cur?' · '+esc(sc.label):''}</td><td style="padding:2px 6px">${ok?'✓':'✗'}</td></tr>`).join('')}</table></div>`,
  f?[{label:'Close',cancel:1},{label:'Use '+f.sc.label,pri:1,fn:()=>{S.scales[n]=Object.assign({},f.sc);afterApply();toast('Scale set: '+f.sc.label)}}]:[{label:'OK',pri:1}])}
// a written dimension under a line someone drew (to fill in the Calibrate box): its dimension line must match the drawn one
async function dimUnder(n,a,b){try{const rd=await readPage(n);if(!rd.items.length)return null;const dims=dimensions(rd,{mm:true}),L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<5)return null;
 let best=null;for(const d of dims){if(d.kind==='mm'&&!/^1:/.test(scaleFor(n).label||''))continue;const r=Math.abs(d.lenPt/L-1);if(r>.06)continue;
  const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);const e=Math.min(near(d.a,a)+near(d.b,b),near(d.a,b)+near(d.b,a));if(e>Math.max(30,L*.12))continue;if(!best||e<best.e)best={d,e}}
 return best&&best.d}catch(e){return null}}
window.PM_EXTRA_CMDS_SD=()=>[{id:'sd:check',menu:'Tools',label:'Check scale',key:'',run:checkNow},{id:'sd:all',menu:'Tools',label:'Set scale on every page from its sheet…',key:'',run:allPages}];
window.PMScaleDetect={passes,propose,readPage,printed,dimensions,test,checkNow,check,allPages,applyProposal,afterApply,dimUnder,parseDim,get last(){return last},lastFor:n=>last.get(S.fileKey+'|'+n)};
})();
