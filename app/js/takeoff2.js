/* PlanMark — takeoff depth: separate X/Y scale, scale presets/protection/temporary scales, 3-point radius, quick Measure tool,
   centroid & width/height, snap types/sensitivity/colour/orthogonal, Dynamic Fill settings, scaled tool sets, sequences,
   Tool Chest views/flyouts/manager, nested Spaces & space summaries, configurable Legends, Markups List grouping/scope/
   stepping/summaries/templates/extra columns, and Quantity Link (stable Excel export, live file on desktop). */
(function(){
window.PM_EXTRA_SYNC_KEYS_TO=['pm:to'];
const DEF_TO={snapTypes:{end:true,mid:true,int:true,perp:true,center:true,near:true},snapTol:9,snapColor:'#ff00ff',ortho:false,centroid:false,hlSpaces:true,hlVp:false,defUnit:'',
 groupBy:'',collapsed:[],scope:'all',sumBy:'subject',latestOnly:false,chestSize:22,chestView:'detail',collapsedSets:[],updateOnReuse:false,keepComment:true,
 presets:[],seqs:{},setScales:{},setOrder:[],tpls:[],dfill:{dpi:144,gap:1.5,edge:175,useMarkups:true},dfillOut:'area'};
let TO=load();
function load(){const v=Object.assign(clone(DEF_TO),LS.get('pm:to',{}));v.snapTypes=Object.assign({},DEF_TO.snapTypes,v.snapTypes||{});v.dfill=Object.assign({},DEF_TO.dfill,v.dfill||{});return v}
const saveTO=()=>LS.set('pm:to',TO);
const QL=()=>LS.get('pm:qlink',{});const saveQL=v=>LS.set('pm:qlink',v);
window.PMTakeoff={get TO(){return TO}};
/* ===================================================================== scale helpers */
function vpScale(pg,pt){const L=(S.scales&&S.scales.vp&&S.scales.vp[pg])||[];if(!pt)return null;for(let i=L.length-1;i>=0;i--){const b=L[i].box;if(pt[0]>=b[0]&&pt[0]<=b[2]&&pt[1]>=b[1]&&pt[1]<=b[3])return L[i].scale||null}return null}
const baseScale=m=>vpScale(m.page,m.pts&&m.pts[0])||scaleFor(m.page);
const scOf=m=>m.scale||baseScale(m);
const sxy=sc=>[sc.perPt,sc.perPtY||sc.perPt];
const realPts=(pts,sc)=>{const[a,b]=sxy(sc);return pts.map(q=>[q[0]*a,q[1]*b])};
const fmtA=(m2,sc)=>{const U=UNITS[sc.unit]||UNITS.ft;return fmtNum(m2/U.aream,sc.dec??2)+' '+U.area};
const nonUniform=sc=>sc&&sc.perPtY&&Math.abs(sc.perPtY-sc.perPt)/sc.perPt>1e-9;
// temporary (session-only) scales and default units for uncalibrated pages
const TEMP={};
const _sf=scaleFor;scaleFor=function(pg){const t=TEMP[S.fileKey]&&TEMP[S.fileKey][pg];if(t)return t;const r=_sf.apply(this,arguments);
 if(r&&r.none&&TO.defUnit&&UNITS[TO.defUnit]&&r.unit!==TO.defUnit)return Object.assign({},r,{unit:TO.defUnit});return r};
// protected scales: refuse changes made through the scale / calibrate dialogs
const _as=applyScale;applyScale=function(sc,md,page){let ap='page';try{ap=md.querySelector('input[name=cAp]:checked').value}catch(e){}
 const targets=ap==='all'?S.pages.map(p=>p.num):[page];const locked=targets.filter(n=>S.scales[n]&&S.scales[n].locked||(ap==='all'&&S.scales.all&&S.scales.all.locked));
 if(locked.length){toast(`Page ${locked.join(', ')} has a protected scale — unprotect it in Takeoff → Scale tools first`);return}
 const keepY=(S.scales[page]||{}).perPtY;const r=_as.apply(this,arguments);return r};
function setPageScale(pages,sc){const bad=pages.filter(n=>S.scales[n]&&S.scales[n].locked);if(bad.length){toast('Protected scale on page '+bad.join(', '));return false}
 for(const n of pages)S.scales[n]=Object.assign({},sc,{locked:false});saveScales();commit();updateScaleBtn();return true}
function scaleMismatch(m){if(!m.scale||!T[m.type]||!T[m.type].meas)return false;const b=baseScale(m);if(!b||b.none)return false;return Math.abs(b.perPt-m.scale.perPt)/b.perPt>1e-6||Math.abs((b.perPtY||b.perPt)-(m.scale.perPtY||m.scale.perPt))/b.perPt>1e-6}
/* ===================================================================== measurement: X/Y scale, 3-point radius */
T.rad3={label:'3-Pt Radius',kind:'multi',max:3,meas:'rad3'};T.qmeasure={label:'Measure',kind:'qm'};
BASE_DEF.rad3={stroke:'#0e7490',width:1.5,opacity:1,fontSize:10};if(!S.defaults.rad3)S.defaults.rad3=clone(BASE_DEF.rad3);
IC.rad3='<circle cx="12" cy="12" r="8" stroke-dasharray="3 2"/><path d="M12 12l5.6-5.6"/><circle cx="4" cy="12" r="1.3"/><circle cx="12" cy="4" r="1.3"/><circle cx="20" cy="12" r="1.3"/>';
IC.qmeasure='<path d="M3 17l14-14 4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/><circle cx="19" cy="19" r="2"/>';
HINTS.rad3='Click 3 points on the arc or circle';HINTS.qmeasure='Click points to measure (nothing is saved) · double-click/Enter to finish · Esc clears';
KEYS.rad3='Shift+Alt+3';KEYS.qmeasure='Shift+M';
RIBBON[2][1].push('rad3','qmeasure');
function circ3(a,b,c){const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-9)return null;const A=a[0]**2+a[1]**2,B=b[0]**2+b[1]**2,C=c[0]**2+c[1]**2;
 const ux=(A*(b[1]-c[1])+B*(c[1]-a[1])+C*(a[1]-b[1]))/d,uy=(A*(c[0]-b[0])+B*(a[0]-c[0])+C*(b[0]-a[0]))/d;return{c:[ux,uy],r:Math.hypot(a[0]-ux,a[1]-uy)}}
const _mo=measOf;
measOf=function(m){if(!m)return null;
 if(m.type==='rad3'){if(!m.pts||m.pts.length<3)return null;const sc=scOf(m),rp=realPts(m.pts,sc),g=circ3(rp[0],rp[1],rp[2]);if(!g)return null;
  return{kind:'len',raw:g.r,v:lenNum(g.r,sc),unit:lenUnit(sc),text:'R '+fmtLen(g.r,sc),sc,extra:{kind:'diam',raw:2*g.r,v:lenNum(2*g.r,sc),unit:lenUnit(sc),text:'Ø '+fmtLen(2*g.r,sc)}}}
 const t=T[m.type];if(t&&t.meas&&t.meas!=='count'&&m.pts){const sc=scOf(m);if(nonUniform(sc)){const[a,b]=sxy(sc),f=q=>[q[0]*a,q[1]*b];
   const m2=Object.assign({},m,{pts:m.pts.map(f),holes:m.holes&&m.holes.map(h=>h.map(f)),rects:undefined,scale:Object.assign({},sc,{perPt:1,perPtY:undefined})});const r=_mo(m2);if(r)r.sc=sc;return r}}
 return _mo(m)};
const CENT=['area','perimeter','volume','polygon','space','cloud','cloudplus'];
const _pr=prims;
prims=function(m){if(m.type==='rad3')return rad3Prims(m);let out=_pr(m);
 if(m.type==='space'&&!TO.hlSpaces)out=out.map(p=>p.k==='p'&&p.fill?Object.assign({},p,{fill:null,w:Math.max(.5,(p.w||1)*.7)}):p);
 if((TO.centroid||(m.style&&m.style.centroid))&&CENT.includes(m.type)&&m.pts&&m.pts.length>2){const c=centroid(m.pts),r=Math.max(4,(m.style.fontSize||10)*.6),st=m.style.stroke||'#111';
  out=out.concat([{k:'p',d:dPoly([[c[0]-r,c[1]],[c[0]+r,c[1]]])+' '+dPoly([[c[0],c[1]-r],[c[0],c[1]+r]]),stroke:st,w:1,so:1,fill:null,fo:1,dash:''},{k:'p',d:dCircle(c,r*.45),stroke:st,w:1,so:1,fill:null,fo:1,dash:''}])}
 return out};
function rad3Prims(m){const s=m.style||{},pts=m.pts||[],fs=s.fontSize||10,o=s.opacity??1,out=[];const L=(d,x={})=>out.push(Object.assign({k:'p',d,stroke:s.stroke||'#0e7490',w:s.width??1.5,so:o,fill:null,fo:1,dash:''},x));
 pts.forEach(q=>L(dCircle(q,Math.max(1.2,fs*.15)),{fill:s.stroke||'#0e7490',fo:1}));
 if(pts.length<3){if(pts.length>1)L(dPoly(pts),{dash:'dash'});return out}
 const g=circ3(pts[0],pts[1],pts[2]);if(!g){L(dPoly(pts));return out}
 L(dCircle(g.c,g.r),{dash:'dash',w:Math.max(.6,(s.width??1.5)*.6)});L(dPoly([g.c,pts[0]]));L(dCircle(g.c,Math.max(1,fs*.15)),{fill:s.stroke||'#0e7490',fo:1});
 const lab=measLabel(m);if(lab){const a=Math.atan2(pts[0][1]-g.c[1],pts[0][0]-g.c[0]),mx=(g.c[0]+pts[0][0])/2,my=(g.c[1]+pts[0][1])/2,ang=readable(g.c,pts[0]),rr=ang*Math.PI/180;
  out.push({k:'t',x:mx+Math.sin(rr)*fs*.85,y:my-Math.cos(rr)*fs*.85,s:lab,size:fs,color:s.stroke||'#0e7490',bold:true,ang,align:'middle',halo:true,o})}
 return out}
function geomInfo(m){const sc=scOf(m),pts=m.type==='rect'||T[m.type]&&T[m.type].box?(()=>{const b=normBox(m.pts[0],m.pts[1]);return[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]})():m.pts;if(!pts||!pts.length)return null;
 const b=ptsBox(pts),[a,bb]=sxy(sc),o={sc,w:(b[2]-b[0])*a,h:(b[3]-b[1])*bb,cx:(b[0]+b[2])/2*a,cy:(b[1]+b[3])/2*bb};
 if(pts.length>2&&CENT.concat(['rect','ellipse']).includes(m.type)){const c=centroid(pts);o.gx=c[0]*a;o.gy=c[1]*bb;o.gpt=c}return o}
/* ===================================================================== quick Measure tool (nothing saved) */
const QM={pts:[],cur:null,page:0,done:false,last:0};
function qmText(){const pts=QM.cur&&!QM.done?[...QM.pts,QM.cur]:QM.pts;if(pts.length<2)return'';const m={type:'polylength',page:QM.page,pts};const sc=scOf(m),rp=realPts(pts,sc);
 let s='Length '+fmtLen(polyLen(rp),sc);if(pts.length>2){s+=' · Area '+fmtA(Math.abs(polyArea(rp)),sc)+' · Perimeter '+fmtLen(polyLen(rp,true),sc);const n=pts.length,a=pts[n-3],v=pts[n-2],c=pts[n-1];
  let d=Math.atan2(c[1]-v[1],c[0]-v[0])-Math.atan2(a[1]-v[1],a[0]-v[0]);while(d>Math.PI)d-=2*Math.PI;while(d<=-Math.PI)d+=2*Math.PI;s+=' · Angle '+(Math.abs(d)*180/Math.PI).toFixed(1)+'°'}
 const dx=Math.abs(rp[rp.length-1][0]-rp[rp.length-2][0]),dy=Math.abs(rp[rp.length-1][1]-rp[rp.length-2][1]);s+=` · ΔX ${fmtLen(dx,sc)} ΔY ${fmtLen(dy,sc)}`;return s}
H.over.push(n=>{if(S.tool!=='qmeasure'||QM.page!==n||!QM.pts.length)return'';const pts=QM.cur&&!QM.done?[...QM.pts,QM.cur]:QM.pts,k=1/S.zoom;let h=`<path d="${dPoly(pts,QM.done&&pts.length>2)}" fill="${pts.length>2?'rgba(236,72,153,.08)':'none'}" stroke="#ec4899" stroke-width="${1.6*k}" stroke-dasharray="${6*k} ${4*k}"/>`;
 pts.forEach(q=>h+=`<circle cx="${q[0]}" cy="${q[1]}" r="${3*k}" fill="#ec4899"/>`);const t=qmText();if(t){const q=pts[pts.length-1];h+=`<text x="${q[0]+8*k}" y="${q[1]-8*k}" font-size="${11*k}" fill="#be185d" font-weight="bold" font-family="Helvetica,Arial,sans-serif" paint-order="stroke" stroke="#fff" stroke-width="${3*k}">${esc(t)}</text>`}
 return`<g pointer-events="none">${h}</g>`});
viewer.addEventListener('pointermove',e=>{if(S.tool!=='qmeasure'||QM.done||!QM.pts.length)return;const p=pageFromEvent(e);if(!p||p.num!==QM.page)return;QM.cur=sp(p,toPt(e,p),e);redrawPage(p.num);$('#live').textContent=qmText()});
document.addEventListener('keydown',e=>{if(S.tool!=='qmeasure'||(e.target.closest&&e.target.closest('input,textarea,select')))return;
 if(e.key==='Escape'){QM.pts=[];QM.cur=null;QM.done=false;redrawAll();$('#live').textContent='';e.stopImmediatePropagation();}
 if(e.key==='Enter'){QM.done=true;QM.cur=null;redrawPage(QM.page);$('#live').textContent=qmText();e.stopImmediatePropagation()}},true);
/* ===================================================================== snapping: types, sensitivity, colour, orthogonal */
const SEG={};async function segData(n){if(SEG[n]&&SEG[n]!=='loading')return SEG[n];if(SEG[n])return null;SEG[n]='loading';const doc=S.pdf;
 try{const page=await doc.getPage(n),ol=await page.getOperatorList(),O=pdfjsLib.OPS,vp=S.pages[n-1].vp;let ctm=vp.transform.slice();const st=[],segs=[];
  const mul=(m1,m2)=>[m1[0]*m2[0]+m1[2]*m2[1],m1[1]*m2[0]+m1[3]*m2[1],m1[0]*m2[2]+m1[2]*m2[3],m1[1]*m2[2]+m1[3]*m2[3],m1[0]*m2[4]+m1[2]*m2[5]+m1[4],m1[1]*m2[4]+m1[3]*m2[5]+m1[5]];
  const ap=(x,y)=>[ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]],add=(a,b)=>{if(segs.length<1.6e6&&Math.hypot(a[0]-b[0],a[1]-b[1])>.3)segs.push(a[0],a[1],b[0],b[1])};
  for(let i=0;i<ol.fnArray.length;i++){const fn=ol.fnArray[i],args=ol.argsArray[i];if(fn===O.save)st.push(ctm.slice());else if(fn===O.restore)ctm=st.pop()||ctm;else if(fn===O.transform)ctm=mul(ctm,args);
   else if(fn===O.paintFormXObjectBegin){st.push(ctm.slice());if(args&&args[0])ctm=mul(ctm,args[0])}else if(fn===O.paintFormXObjectEnd)ctm=st.pop()||ctm;
   else if(fn===O.constructPath){const ops=args[0],c=args[1];let j=0,cur=null,s0=null;for(const op of ops){if(op===O.moveTo){cur=ap(c[j],c[j+1]);s0=cur;j+=2}else if(op===O.lineTo){const q=ap(c[j],c[j+1]);j+=2;if(cur)add(cur,q);cur=q}
     else if(op===O.curveTo){const q=ap(c[j+4],c[j+5]);j+=6;if(cur)add(cur,q);cur=q}else if(op===O.curveTo2||op===O.curveTo3){const q=ap(c[j+2],c[j+3]);j+=4;if(cur)add(cur,q);cur=q}
     else if(op===O.closePath){if(cur&&s0)add(cur,s0);cur=s0}else if(op===O.rectangle){const x=c[j],y=c[j+1],w=c[j+2],h=c[j+3];j+=4;const a=ap(x,y),b=ap(x+w,y),cc=ap(x+w,y+h),d=ap(x,y+h);add(a,b);add(b,cc);add(cc,d);add(d,a);cur=a;s0=a}}}}
  const cell=16,grid=new Map(),f=new Float32Array(segs),key=(i,j)=>i*100003+j;
  for(let s=0;s<f.length;s+=4){const i0=Math.floor(Math.min(f[s],f[s+2])/cell),i1=Math.floor(Math.max(f[s],f[s+2])/cell),j0=Math.floor(Math.min(f[s+1],f[s+3])/cell),j1=Math.floor(Math.max(f[s+1],f[s+3])/cell);if((i1-i0+1)*(j1-j0+1)>400)continue;
   for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(s)}}
  if(doc===S.pdf)SEG[n]={f,grid,key,cell};return SEG[n]}catch(e){SEG[n]={f:new Float32Array(0),grid:new Map(),key:()=>0,cell:16};return SEG[n]}}
H.open.push(()=>{for(const k in SEG)delete SEG[k]});
const defaultSnap=()=>{const t=TO.snapTypes;return t.end&&t.mid&&t.int&&t.near&&!t._custom&&TO.snapTol===9&&!TO.ortho};
function projSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;return{t,q:[a[0]+Math.max(0,Math.min(1,t))*dx,a[1]+Math.max(0,Math.min(1,t))*dy],raw:[a[0]+t*dx,a[1]+t*dy]}}
function inter(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-9)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;if(t<-1e-6||t>1+1e-6||u<-1e-6||u>1+1e-6)return null;return[a[0]+t*r[0],a[1]+t*r[1]]}
function refPoint(){const d=S.drawing;if(!d||!d.pts||!d.pts.length)return S.tool==='qmeasure'&&QM.pts.length&&!QM.done?QM.pts[QM.pts.length-1]:null;return T[d.type].kind==='drag'?d.pts[0]:d.pts[d.pts.length-1]}
function ownSnap(p,pt){SNAPI=null;const P=window.PMSnap||{};const ty=TO.snapTypes,tol=(+TO.snapTol||9)/S.zoom;let best=null,bd=tol,kind='';
 const tryP=(q,k,w=1)=>{if(!q)return;const d=dist(q,pt)*w;if(d<bd){bd=d;best=q;kind=k}};const ref=refPoint();
 if(P.markup)for(const m of S.markups){if(m.page!==p.num||(G&&G.m===m)||!m.pts)continue;if(ty.end)for(const q of m.pts)tryP(q,'end');
  if(ty.center){if(['ellipse','rect','text','image'].includes(m.type)&&m.pts.length>1){const b=normBox(m.pts[0],m.pts[1]);tryP([(b[0]+b[2])/2,(b[1]+b[3])/2],'center',.9)}if(m.type==='circle'&&m.pts.length)tryP(m.pts[0],'center',.9);
   if(m.type==='rad3'&&m.pts.length>2){const g=circ3(m.pts[0],m.pts[1],m.pts[2]);if(g)tryP(g.c,'center',.9)}}}
 if(S.drawing&&S.drawing.page===p.num&&T[S.drawing.type].closed&&S.drawing.pts.length>2&&ty.end)tryP(S.drawing.pts[0],'end');
 const d=P.content?SEG[p.num]&&SEG[p.num]!=='loading'?SEG[p.num]:(segData(p.num),null):null;
 if(d){const{f,grid,key,cell}=d,ci=Math.floor(pt[0]/cell),cj=Math.floor(pt[1]/cell),r=Math.ceil(tol/cell),seen=new Set(),cand=[];
  for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){const a=grid.get(key(i,j));if(!a)continue;for(const s of a){if(seen.has(s))continue;seen.add(s);const A=[f[s],f[s+1]],B=[f[s+2],f[s+3]];
   if(ty.end){tryP(A,'end');tryP(B,'end')}if(ty.mid)tryP([(A[0]+B[0])/2,(A[1]+B[1])/2],'mid',1.15);const pr=projSeg(pt,A,B);if(dist(pr.q,pt)<tol)cand.push([A,B,pr.q]);
   if(ty.perp&&ref){const pp=projSeg(ref,A,B);if(pp.t>=0&&pp.t<=1&&dist(pp.raw,ref)>1)tryP(pp.raw,'perp',1.05)}}}
  if(ty.int&&(!best||kind!=='end')){const lim=Math.min(cand.length,60);for(let x=0;x<lim;x++)for(let y=x+1;y<lim;y++){const q=inter(cand[x][0],cand[x][1],cand[y][0],cand[y][1]);if(q)tryP(q,'int',1.05)}}
  if(!best&&ty.near){let bl=tol;for(const c of cand){const dd=dist(c[2],pt);if(dd<bl){bl=dd;best=c[2];kind='on'}}}}
 if(!best&&P.grid&&window.gridStep){const g=gridStep(p);if(g){best=[Math.round(pt[0]/g)*g,Math.round(pt[1]/g)*g];kind='grid'}}
 if(!best)return pt;SNAPI={page:p.num,x:best[0],y:best[1],k:kind};return[best[0],best[1]]}
const _snap=H.snap;
H.snap=function(p,pt,e){let r=defaultSnap()?_snap(p,pt,e):ownSnap(p,pt,e);
 if(TO.ortho&&!(e&&e.shiftKey)){const ref=refPoint();if(ref&&(S.drawing&&S.drawing.page===p.num||S.tool==='qmeasure'&&QM.page===p.num)&&!(S.drawing&&T[S.drawing.type].box)){const dx=Math.abs(r[0]-ref[0]),dy=Math.abs(r[1]-ref[1]);r=dx>=dy?[r[0],ref[1]]:[ref[0],r[1]];if(SNAPI){SNAPI.x=r[0];SNAPI.y=r[1]}}}
 return r};
// snap marker in the chosen colour (replaces snap.js's marker drawer)
(function(){const i=H.over.findIndex(f=>{try{return f.toString().includes("'#ff00ff'")&&f.toString().includes('SNAPI')}catch(e){return false}});
 const mine=n=>{if(!SNAPI||SNAPI.page!==n)return'';const{x,y,k}=SNAPI,r=5/S.zoom,w=1.6/S.zoom,c=TO.snapColor||'#ff00ff';let g='';
  if(k==='end')g=`<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  else if(k==='mid')g=`<path d="M${x} ${y-r*1.2} L${x+r*1.1} ${y+r*.8} L${x-r*1.1} ${y+r*.8}Z" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  else if(k==='int')g=`<path d="M${x-r} ${y-r}L${x+r} ${y+r}M${x+r} ${y-r}L${x-r} ${y+r}" stroke="${c}" stroke-width="${w}"/>`;
  else if(k==='grid')g=`<path d="M${x-r} ${y}L${x+r} ${y}M${x} ${y-r}L${x} ${y+r}" stroke="${c}" stroke-width="${w}"/>`;
  else if(k==='perp')g=`<path d="M${x-r} ${y+r}H${x+r}M${x} ${y+r}V${y-r}M${x} ${y+r*.3}H${x+r*.7}V${y+r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  else if(k==='center')g=`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/><path d="M${x-r*.5} ${y}H${x+r*.5}M${x} ${y-r*.5}V${y+r*.5}" stroke="${c}" stroke-width="${w}"/>`;
  else g=`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/><circle cx="${x}" cy="${y}" r="${r*.25}" fill="${c}"/>`;return`<g pointer-events="none">${g}</g>`};
 if(i>=0)H.over[i]=mine;else H.over.push(mine)})();
/* ===================================================================== Dynamic Fill with settings */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#modal .btn.pri');if(b&&$('#dfO')){TO.dfillOut=$('#dfO').value;saveTO()}},true);
/* push a traced outline out by d pixels along each edge's normal (mitred), so straight walls move square, not toward a centre point */
function fillOutset(pts,d){for(let i=0;pts.length>3&&i<pts.length;){const a=pts[(i-1+pts.length)%pts.length],p=pts[i],b=pts[(i+1)%pts.length],x1=p[0]-a[0],y1=p[1]-a[1],x2=b[0]-p[0],y2=b[1]-p[1];if(Math.abs(x1*y2-y1*x2)<.02*Math.hypot(x1,y1)*Math.hypot(x2,y2)&&x1*x2+y1*y2>0)pts=pts.filter((_,j)=>j!==i);else i++}const n=pts.length;if(n<3||!d)return pts;let A=0;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];A+=a[0]*b[1]-b[0]*a[1]}const sg=A>0?1:-1;
 return pts.map((p,i)=>{const a=pts[(i-1+n)%n],b=pts[(i+1)%n];const e1=[p[0]-a[0],p[1]-a[1]],e2=[b[0]-p[0],b[1]-p[1]],l1=Math.hypot(...e1)||1,l2=Math.hypot(...e2)||1;
  const n1=[e1[1]/l1*sg,-e1[0]/l1*sg],n2=[e2[1]/l2*sg,-e2[0]/l2*sg];let nx=n1[0]+n2[0],ny=n1[1]+n2[1];const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;const c=Math.max(.35,n1[0]*nx+n1[1]*ny);return[p[0]+nx*d/c,p[1]+ny*d/c]})}
async function fill2(p,pt){toast('Filling…');try{const D=TO.dfill,k=Math.min(Math.max(.5,(+D.dpi||144)/72),Math.sqrt(9e6/(p.w*p.h)));const pg=await S.pdf.getPage(p.num),vp=pg.getViewport({scale:k}),W=Math.ceil(vp.width),Hh=Math.ceil(vp.height);
 const c=document.createElement('canvas');c.width=W;c.height=Hh;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,W,Hh);await pg.render({canvasContext:ctx,viewport:vp}).promise;
 if(D.useMarkups){ctx.save();ctx.scale(k,k);ctx.strokeStyle='#000';ctx.lineWidth=Math.max(1.5/k,1);for(const m of S.markups){if(m.page!==p.num||['count','note','stamp','typewriter','symbol','legend','texthl','image','space'].includes(m.type)||m.hidden)continue;for(const q of prims(m))if(q.k==='p'&&q.stroke)try{ctx.stroke(new Path2D(q.d))}catch(_){}}ctx.restore()}
 const d=ctx.getImageData(0,0,W,Hh).data,N=W*Hh,ink=new Uint8Array(N),thr=+D.edge||175;for(let i=0,j=0;i<N;i++,j+=4)ink[i]=(d[j]*.3+d[j+1]*.59+d[j+2]*.11)<thr?1:0;
 const gap=Math.max(0,Math.round((+D.gap||0)*k/2));const wall=gap?new Uint8Array(N):ink;if(gap){for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){if(!ink[y*W+x])continue;for(let dy=-gap;dy<=gap;dy++){const yy=y+dy;if(yy<0||yy>=Hh)continue;for(let dx=-gap;dx<=gap;dx++){const xx=x+dx;if(xx>=0&&xx<W)wall[yy*W+xx]=1}}}}
 const sx=Math.round(pt[0]*k),sy=Math.round(pt[1]*k);if(sx<0||sy<0||sx>=W||sy>=Hh)return;if(wall[sy*W+sx]){toast('Click inside the room, not on a line');return}
 const fl=new Uint8Array(N),st=[sy*W+sx];fl[sy*W+sx]=1;let cnt=0,edge=false;while(st.length){const i=st.pop();cnt++;const x=i%W,y=(i/W)|0;if(x===0||y===0||x===W-1||y===Hh-1){edge=true;break}for(const j of[i-1,i+1,i-W,i+W])if(!wall[j]&&!fl[j]){fl[j]=1;st.push(j)}}
 if(edge||cnt>N*.8){toast("That area isn't closed — draw a line across openings, increase the gap size in Fill settings, then click again");return}
 let start=-1;for(let i=0;i<N;i++)if(fl[i]){start=i;break}const F=(x,y)=>x>=0&&y>=0&&x<W&&y<Hh&&fl[y*W+x]===1,nb=[[-1,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1]];
 const x0=start%W,y0=(start/W)|0;let cx=x0,cy=y0,bx=cx-1,by=cy;const path=[[cx,cy]];for(let gd=0;gd<4e6;gd++){let kk=nb.findIndex(q=>cx+q[0]===bx&&cy+q[1]===by);if(kk<0)kk=0;let ok=false;for(let i=1;i<=8;i++){const q=nb[(kk+i)%8],nx=cx+q[0],ny=cy+q[1];if(F(nx,ny)){const pq=nb[(kk+i-1)%8];bx=cx+pq[0];by=cy+pq[1];cx=nx;cy=ny;ok=true;break}}if(!ok||(cx===x0&&cy===y0))break;path.push([cx,cy])}
 const grow=gap*.9+1;let poly=fillOutset(simplify(path,1.3),grow).map(q=>[q[0]/k,q[1]/k]);
 if(poly.length>3&&dist(poly[0],poly[poly.length-1])<1)poly.pop();if(poly.length<3){toast('Could not trace that area');return}
 const out=TO.dfillOut||'area',m=newMarkup(out,p.num,poly,toolStyle(out));if(out==='volume')m.depth=S.defaults.volume.depth||0.3048;pushUndo();S.markups.push(m);commit();if(out==='space')textDialog(m,true,'text');else toast(measLabel(m)||'Area added')}
 catch(e){console.error(e);toast('Fill failed: '+(e.message||e))}}
/* ===================================================================== pointer routing (outermost H.down) */
let pickPts=null;function pickPoints(n,msg){return new Promise(res=>{if(S.tool!=='select')setTool('select');pickPts={n,msg,pts:[],res};$('#hint').textContent=msg;toast(msg)})}
H.down=(prev=>(e,p,pt)=>{
 if(pickPts&&p){const q=sp(p,pt,e);pickPts.pts.push({page:p.num,pt:q});if(pickPts.pts.length>=pickPts.n){const r=pickPts;pickPts=null;updateRibbon();r.res(r.pts)}else $('#hint').textContent=pickPts.msg+` (${pickPts.pts.length}/${pickPts.n})`;return true}
 if(S.tool==='qmeasure'&&p){const now=performance.now();if(QM.done||QM.page!==p.num){QM.pts=[];QM.done=false;QM.page=p.num}
  if(QM.pts.length&&now-QM.last<350&&Math.hypot(pt[0]-QM.pts[QM.pts.length-1][0],pt[1]-QM.pts[QM.pts.length-1][1])*S.zoom<=6){QM.done=true;QM.cur=null;redrawPage(p.num);$('#live').textContent=qmText();QM.last=0;return true}QM.last=now;QM.pts.push(sp(p,pt,e));QM.cur=null;redrawPage(p.num);$('#live').textContent=qmText();return true}
 if(S.tool==='dfill'&&p){fill2(p,pt);return true}
 return prev?prev(e,p,pt):false})(H.down);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pickPts){pickPts=null;updateRibbon();toast('Cancelled')}},true);
/* ===================================================================== Tool Chest: scaled sets, sequences, views, manager, reuse */
function combinedTools(){return[...S.chest.map(c=>Object.assign({set:c.set||'My Tools'},c)),...((window.PMToolbox&&PMToolbox.BUILTIN)||[]),...(S.recent||[]).map(c=>Object.assign({},c,{set:'Recent Tools'}))]}
const toolKey=c=>(c.set||'My Tools')+'|'+c.name;
const seqVal=q=>(q.prefix||'')+String(q.next).padStart(+q.pad||0,'0')+(q.suffix||'');
const _ac=afterCreate;
afterCreate=function(m){const c=S.chestItem;
 if(c&&S.chestSel!=null&&c.type===m.type){const key=toolKey(c),q=TO.seqs[key];if(q&&q.on){const v=seqVal(q);if(q.target==='label')m.label=v;else m.text=v;q.next=(+q.next||0)+(+q.step||1);saveTO()}
  const scl=TO.setScales[c.set];if(scl&&T[m.type]&&T[m.type].meas&&T[m.type].meas!=='count'&&T[m.type].meas!=='angle')m.scale=clone(scl);
  if(TO.keepComment&&c.comment&&!m.comment)m.comment=c.comment;if(c.lg&&m.type==='legend')m.lg=clone(c.lg);m.chestKey=key}
 return _ac.apply(this,arguments)};
H.change.push(()=>{if(!TO.updateOnReuse)return;const m=byId([...S.sel][0]);if(!m||!m.chestKey)return;const i=S.chest.findIndex(c=>toolKey(Object.assign({set:c.set||'My Tools'},c))===m.chestKey);
 if(i<0||S.chest[i].type!==m.type)return;const ns=JSON.stringify(m.style);if(JSON.stringify(S.chest[i].style)!==ns){S.chest[i].style=JSON.parse(ns);LS.set('pm:chest',S.chest);clearTimeout(window.__toRc);window.__toRc=setTimeout(renderChest,300)}});
function addSelToChest(ids,setName){const ms=ids.map(byId).filter(Boolean);if(!ms.length)return toast('Select markups first');for(const m of ms)S.chest.push({set:setName||'My Tools',name:m.subject||T[m.type].label,type:m.type,subject:m.subject,comment:m.comment||undefined,text:['stamp','symbol','typewriter'].includes(m.type)?m.text:undefined,sym:m.sym,depth:m.depth,height:m.height,lg:m.lg?clone(m.lg):undefined,style:clone(m.style)});
 LS.set('pm:chest',S.chest);renderChest();switchTab('chest');toast(`Added ${ms.length} tool${ms.length>1?'s':''} to "${setName||'My Tools'}"`)}
const _rc=renderChest;
renderChest=function(){_rc.apply(this,arguments);const pane=$('#pane-chest');if(!pane)return;
 const bar=document.createElement('div');bar.className='row';bar.style.cssText='gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center';
 bar.innerHTML=`<select class="ti" id="tcView" style="flex:0 0 96px"><option value="detail" ${TO.chestView!=='symbol'?'selected':''}>Detail</option><option value="symbol" ${TO.chestView==='symbol'?'selected':''}>Symbols</option></select><input type="range" id="tcSize" min="16" max="44" value="${TO.chestSize}" style="flex:1" title="Tool size"><button class="btn" id="tcMgr" style="flex:0;border:1px solid var(--line)" title="Manage tool sets">Manage</button><button class="btn" id="tcAddSel" style="flex:0;border:1px solid var(--line)" title="Add the selected markups as tools">+ Selected</button>`;
 pane.insertBefore(bar,pane.firstChild);
 const sz=+TO.chestSize||22;pane.querySelectorAll('.chest svg').forEach(s=>{s.style.width=sz+'px';s.style.height=sz+'px'});pane.querySelectorAll('.chest > span:first-child').forEach(s=>{s.style.width=sz+'px';s.style.height=sz+'px'});
 if(TO.chestView==='symbol'){pane.querySelectorAll('.chest').forEach(c=>{c.style.display='inline-flex';c.style.width=(sz+20)+'px';c.style.justifyContent='center';c.title=(c.querySelector('.nm')||{}).textContent||'';const nm=c.querySelector('.nm');if(nm)nm.style.display='none';const x=c.querySelector('.x');if(x)x.style.display='none'})}
 // set headers: collapse + scale badge
 pane.querySelectorAll('.sec').forEach(h=>{const name=h.textContent.trim();h.style.cursor='pointer';const sc=TO.setScales[name];const col=TO.collapsedSets.includes(name);h.innerHTML=`${col?'▸':'▾'} ${esc(name)}${sc?` <span title="Tools in this set measure at ${esc(sc.label)}" style="color:#7dd3fc;text-transform:none;letter-spacing:0">📏 ${esc(sc.label)}</span>`:''}`;h.dataset.set=name;
  if(col){let n=h.nextElementSibling;while(n&&!n.classList.contains('sec')&&!n.classList.contains('hint')){if(n.classList.contains('chest'))n.style.display='none';n=n.nextElementSibling}}});
 pane.querySelectorAll('.chest').forEach(c=>{const t=combinedTools()[+c.dataset.i];if(!t)return;const q=TO.seqs[toolKey(t)];if(q&&q.on){const b=document.createElement('small');b.style.cssText='color:#fbbf24;margin-left:4px';b.textContent='#'+seqVal(q);(c.querySelector('.nm')||c).appendChild(b)}});
 $('#tcView').onchange=e=>{TO.chestView=e.target.value;saveTO();renderChest()};$('#tcSize').oninput=e=>{TO.chestSize=+e.target.value;saveTO();clearTimeout(window.__tcs);window.__tcs=setTimeout(renderChest,120)};
 $('#tcMgr').onclick=manageSets;$('#tcAddSel').onclick=()=>{const sets=[...new Set(S.chest.map(c=>c.set||'My Tools'))];if(!sets.includes('My Tools'))sets.unshift('My Tools');
  modal('Add selected markups as tools',`<div class="fld"><label>Tool set</label><input class="ti" id="asS" list="asSL" value="My Tools"><datalist id="asSL">${sets.map(s=>`<option value="${esc(s)}">`).join('')}</datalist></div><div class="hint">${S.sel.size} markup(s) selected. Their colours, subjects, comments, depth/height and text are saved with the tools.</div>`,[{label:'Cancel',cancel:1},{label:'Add',pri:1,fn:md=>{addSelToChest([...S.sel],md.querySelector('#asS').value.trim()||'My Tools')}}])};
 pane.ondragover=e=>{if([...e.dataTransfer.types].includes('text/pm-ids')){e.preventDefault();pane.style.outline='2px dashed var(--acc)'}};pane.ondragleave=()=>{pane.style.outline=''};
 pane.ondrop=e=>{pane.style.outline='';const raw=e.dataTransfer.getData('text/pm-ids');if(!raw)return;e.preventDefault();const h=e.target.closest&&e.target.closest('[data-set]');let set=h?h.dataset.set:'My Tools';if(set==='Recent Tools'||(window.PMToolbox&&PMToolbox.BUILTIN.some(b=>b.set===set)))set='My Tools';addSelToChest(JSON.parse(raw),set)}};
document.addEventListener('click',e=>{const h=e.target.closest&&e.target.closest('#pane-chest .sec[data-set]');if(!h)return;const n=h.dataset.set,i=TO.collapsedSets.indexOf(n);if(i>=0)TO.collapsedSets.splice(i,1);else TO.collapsedSets.push(n);saveTO();renderChest()});
function userSets(){const seen=[];for(const c of S.chest){const s=c.set||'My Tools';if(!seen.includes(s))seen.push(s)}return seen}
function scaleOptions(sel){return`<option value="">No set scale (use the page)</option><optgroup label="Architectural">${ARCH.map(([l,v])=>`<option value="a:${v}" ${sel==='a:'+v?'selected':''}>${l}" = 1'-0"</option>`).join('')}</optgroup><optgroup label="Engineering">${ENG.map(n=>`<option value="e:${n}" ${sel==='e:'+n?'selected':''}>1" = ${n}'</option>`).join('')}</optgroup><optgroup label="Metric">${METRIC.map(n=>`<option value="m:${n}" ${sel==='m:'+n?'selected':''}>1:${n}</option>`).join('')}</optgroup>${TO.presets.length?`<optgroup label="My presets">${TO.presets.map((p,i)=>`<option value="p:${i}" ${sel==='p:'+i?'selected':''}>${esc(p.name)}</option>`).join('')}</optgroup>`:''}`}
function scaleFromCode(code,unit){if(!code)return null;const[k,v]=code.split(':'),n=+v;if(k==='p'){const p=TO.presets[n];return p?clone(p.scale):null}let perPt,label,u;
 if(k==='a'){perPt=12/n*PT_M;label=(ARCH.find(a=>a[1]===n)||[v])[0]+'" = 1\'-0"';u='ftin'}else if(k==='e'){perPt=12*n*PT_M;label=`1" = ${n}'`;u='ft'}else{perPt=n*PT_M;label='1:'+n;u='m'}return{perPt,unit:unit||u,label,prec:8,dec:2,code}}
function manageSets(){const us=userSets(),bs=[...new Set(((window.PMToolbox&&PMToolbox.BUILTIN)||[]).map(b=>b.set))];
 const row=(s,user)=>`<div class="res" data-ms="${esc(s)}" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="flex:1;min-width:120px">${esc(s)}</b><select class="ti" data-msc style="flex:0 0 150px;font-size:11px">${scaleOptions((TO.setScales[s]||{}).code||'')}</select>
  ${user?`<button class="btn" data-mop="up" style="height:24px;border:1px solid var(--line)">↑</button><button class="btn" data-mop="dn" style="height:24px;border:1px solid var(--line)">↓</button><button class="btn" data-mop="ren" style="height:24px;border:1px solid var(--line)">Rename</button><button class="btn" data-mop="del" style="height:24px;border:1px solid var(--line)">Delete</button>`:''}<button class="btn" data-mop="dup" style="height:24px;border:1px solid var(--line)">Duplicate</button><button class="btn" data-mop="exp" style="height:24px;border:1px solid var(--line)">Export</button></div>`;
 modal('Manage tool sets',`<div class="sec" style="margin-top:0">My tool sets</div>${us.map(s=>row(s,true)).join('')||'<div class="hint">None yet.</div>'}<div class="sec">Built-in sets</div>${bs.map(s=>row(s,false)).join('')}
 <div class="sec">Options</div><label class="chk fld"><input type="checkbox" id="moU" ${TO.updateOnReuse?'checked':''}> Update a tool when I change a markup made with it</label><label class="chk fld"><input type="checkbox" id="moK" ${TO.keepComment?'checked':''}> Keep each tool's comment on new markups</label>
 <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" id="moImp" style="border:1px solid var(--line)">Import a set…</button><button class="btn" id="moSeq" style="border:1px solid var(--line)">Sequences…</button></div>
 <div class="hint" style="margin-top:6px">A set scale makes that set's measuring tools use the chosen scale no matter what the page scale is (handy for details drawn at a different scale).</div>`,[{label:'Close',cancel:1}]);
 const md=$('#modal');
 md.querySelectorAll('[data-msc]').forEach(sel=>sel.onchange=()=>{const s=sel.closest('[data-ms]').dataset.ms,sc=scaleFromCode(sel.value);if(sc)TO.setScales[s]=sc;else delete TO.setScales[s];saveTO();renderChest();toast(sc?`"${s}" measures at ${sc.label}`:`"${s}" uses the page scale`)});
 md.querySelectorAll('[data-mop]').forEach(b=>b.onclick=()=>{const s=b.closest('[data-ms]').dataset.ms,op=b.dataset.mop,items=combinedTools().filter(c=>c.set===s);
  if(op==='up'||op==='dn'){const order=userSets(),i=order.indexOf(s),j=op==='up'?i-1:i+1;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];S.chest.sort((a,b)=>order.indexOf(a.set||'My Tools')-order.indexOf(b.set||'My Tools'));LS.set('pm:chest',S.chest);renderChest();closeModal();manageSets()}
  if(op==='ren')modalPrompt('Rename tool set','New name',s,n=>{S.chest.forEach(c=>{if((c.set||'My Tools')===s)c.set=n});if(TO.setScales[s]){TO.setScales[n]=TO.setScales[s];delete TO.setScales[s]}saveTO();LS.set('pm:chest',S.chest);renderChest()});
  if(op==='del')modal(`Delete "${s}"?`,`<div class="hint">Removes ${items.length} tool(s).</div>`,[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:()=>{S.chest=S.chest.filter(c=>(c.set||'My Tools')!==s);LS.set('pm:chest',S.chest);renderChest()}}]);
  if(op==='dup')modalPrompt('Duplicate tool set','Name for the copy',s+' (copy)',n=>{for(const c of items){const x=clone(c);x.set=n;S.chest.push(x)}LS.set('pm:chest',S.chest);renderChest();toast('Copied to "'+n+'"')});
  if(op==='exp')saveFile(s.replace(/[^\w\- ]+/g,'_')+'.planmark-tools.json',JSON.stringify({app:'PlanMark',set:s,scale:TO.setScales[s]||null,tools:items.map(c=>Object.assign({},c,{set:s}))},null,1))});
 $('#moU').onchange=e=>{TO.updateOnReuse=e.target.checked;saveTO()};$('#moK').onchange=e=>{TO.keepComment=e.target.checked;saveTO()};$('#moSeq').onclick=()=>{closeModal();seqDialog()};
 $('#moImp').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const j=JSON.parse(await i.files[0].text());const ts=(j.tools||[]).filter(t=>T[t.type]);const s=j.set||'Imported';ts.forEach(t=>{t.set=s;S.chest.push(t)});if(j.scale)TO.setScales[s]=j.scale;saveTO();LS.set('pm:chest',S.chest);renderChest();closeModal();toast(`Imported ${ts.length} tools into "${s}"`)}catch(e){toast('Not a tool set file')}};i.click()}}
function seqDialog(){const tools=combinedTools().filter(c=>c.set!=='Recent Tools');
 modal('Sequences',`<div class="hint" style="margin-bottom:8px">Each time you place a markup with the tool, its text (or label) gets the next number — e.g. door tags 101, 102, 103…</div>
 <div class="fld"><label>Tool</label><select class="ti" id="sqT">${tools.map((c,i)=>`<option value="${i}">${esc(c.set)} › ${esc(c.name)}</option>`).join('')}</select></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Prefix</label><input class="ti" id="sqP"></div><div><label style="font-size:11px;color:var(--mut)">Next number</label><input class="ti" type="number" id="sqN" value="1"></div><div><label style="font-size:11px;color:var(--mut)">Step</label><input class="ti" type="number" id="sqS" value="1"></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Digits (pad)</label><input class="ti" type="number" id="sqD" value="0" min="0" max="6"></div><div><label style="font-size:11px;color:var(--mut)">Suffix</label><input class="ti" id="sqX"></div><div><label style="font-size:11px;color:var(--mut)">Put it in</label><select class="ti" id="sqW"><option value="text">Text</option><option value="label">Label</option></select></div></div>
 <label class="chk"><input type="checkbox" id="sqO" checked> Sequence on</label>`,[{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:md=>{const c=tools[+md.querySelector('#sqT').value];if(!c)return;
  TO.seqs[toolKey(c)]={on:md.querySelector('#sqO').checked,prefix:md.querySelector('#sqP').value,next:+md.querySelector('#sqN').value||0,step:+md.querySelector('#sqS').value||1,pad:+md.querySelector('#sqD').value||0,suffix:md.querySelector('#sqX').value,target:md.querySelector('#sqW').value};saveTO();renderChest();toast('Sequence saved')}}]);
 const fillF=()=>{const c=tools[+$('#sqT').value],q=c&&TO.seqs[toolKey(c)];if(!q)return;$('#sqP').value=q.prefix||'';$('#sqN').value=q.next;$('#sqS').value=q.step;$('#sqD').value=q.pad||0;$('#sqX').value=q.suffix||'';$('#sqW').value=q.target||'text';$('#sqO').checked=!!q.on};$('#sqT').onchange=fillF;fillF()}
/* ===================================================================== Spaces: nesting, properties, summaries */
const spacesOn=pg=>S.markups.filter(s=>s.type==='space'&&s.page===pg&&s.pts&&s.pts.length>2);
function inPoly(c,P){let ins=false;for(let i=0,j=P.length-1;i<P.length;j=i++){if((P[i][1]>c[1])!==(P[j][1]>c[1])&&c[0]<(P[j][0]-P[i][0])*(c[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])ins=!ins}return ins}
const spArea=s=>Math.abs(polyArea(s.pts));
function chainAt(pg,c,exclude){return spacesOn(pg).filter(s=>s!==exclude&&inPoly(c,s.pts)).sort((a,b)=>spArea(b)-spArea(a))}
const spName=s=>((s.spaceNo?s.spaceNo+' ':'')+(s.text||'Space')).trim();
const mCenter=m=>{const b=bboxOf(m);return[(b[0]+b[2])/2,(b[1]+b[3])/2]};
function parentOf(s){const ch=chainAt(s.page,centroid(s.pts),s).filter(x=>spArea(x)>spArea(s));return ch.length?ch[ch.length-1]:null}
spaceOf=function(m){if(!m||!m.pts||m.type==='space')return'';const ch=chainAt(m.page,mCenter(m));return ch.length?spName(ch[ch.length-1]):''};
function spacePath(m){if(!m||!m.pts)return'';if(m.type==='space'){const ch=chainAt(m.page,centroid(m.pts),m).filter(x=>spArea(x)>spArea(m));return[...ch,m].map(spName).join(' > ')}const ch=chainAt(m.page,mCenter(m));return ch.map(spName).join(' > ')}
function countSplit(m){const o={};for(const q of m.pts){const ch=chainAt(m.page,q);const k=ch.length?spName(ch[ch.length-1]):'(no space)';o[k]=(o[k]||0)+1}return o}
window.spacePath=spacePath;window.countSplit=countSplit;
function spaceSummary(){const rows=[];const sp=S.markups.filter(s=>s.type==='space');
 const groups=new Map();const keyOf=(m,q)=>{const ch=chainAt(m.page,q);return ch.length?ch[ch.length-1]:null};
 for(const m of S.markups){if(m.type==='space'||m.type==='legend')continue;const r=measOf(m);
  if(m.type==='count'){for(const q of m.pts){const s=keyOf(m,q);const g=gget(groups,s);const k=m.subject+'|ea';g[k]=g[k]||{subject:m.subject,unit:'ea',n:0,v:0};g[k].n++;g[k].v++}continue}
  const s=keyOf(m,mCenter(m)),g=gget(groups,s),k=m.subject+'|'+(r?r.unit:'');g[k]=g[k]||{subject:m.subject,unit:r?r.unit:'',n:0,v:0,kind:r&&r.kind,raw:0,sc:r&&r.sc};g[k].n++;if(r){g[k].v+=r.v;g[k].raw+=r.raw}}
 for(const[s,g]of groups){for(const k in g){const o=g[k];rows.push({space:s?spacePath(s):'(no space)',page:s?s.page:'',spaceObj:s,subject:o.subject,count:o.n,total:o.unit==='ea'?o.v+' ea':o.kind==='len'?fmtLen(o.raw,o.sc):o.kind==='area'?fmtNum(o.v,(o.sc&&o.sc.dec)??2)+' '+o.unit:o.kind?fmtNum(o.v,2)+' '+o.unit:'',value:+o.v.toFixed(4),unit:o.unit})}}
 rows.sort((a,b)=>a.space.localeCompare(b.space,undefined,{numeric:true})||a.subject.localeCompare(b.subject));return rows}
function gget(m,k){if(!m.has(k))m.set(k,{});return m.get(k)}
function spacesPane(){const pane=$('#pane-spaces');if(!pane)return;const sp=S.markups.filter(s=>s.type==='space').sort((a,b)=>a.page-b.page||spArea(b)-spArea(a));
 const depth=s=>{let d=0,p=parentOf(s);while(p&&d<8){d++;p=parentOf(p)}return d};
 pane.innerHTML=`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" id="spNew" style="border:1px solid var(--line)">+ Space</button><button class="btn" id="spFill" style="border:1px solid var(--line)" title="Click inside rooms">Fill rooms</button><button class="btn" id="spSum" style="border:1px solid var(--line)">Summary</button><button class="btn" id="spMore" style="border:1px solid var(--line)">More…</button></div>
 <label class="chk" style="margin-bottom:6px"><input type="checkbox" id="spHl" ${TO.hlSpaces?'checked':''}> Highlight spaces</label>
 ${sp.map(s=>{const r=measOf(Object.assign({},s,{type:'area'}));return`<div class="res" data-sp="${s.id}" style="padding-left:${7+depth(s)*14}px;${S.sel.has(s.id)?'background:var(--accbg)':''}"><span class="dot" style="background:${s.style.stroke}"></span> <b style="font-weight:600">${esc(spName(s))}</b> <small style="color:var(--mut)">p${s.page}${r?' · '+esc(r.text):''}</small></div>`}).join('')||'<div class="hint">No spaces yet. Spaces name rooms or zones; every markup inside one is tagged with it (nested spaces give a full path like Building › Floor 2 › Room 201).</div>'}`;
 $('#spNew').onclick=()=>{setTool('space');toast('Click the room outline · Enter to finish')};$('#spFill').onclick=()=>{TO.dfillOut='space';saveTO();setTool('dfill',{lock:true});toast('Click inside rooms to create spaces · Esc to stop')};
 $('#spSum').onclick=spaceSummaryDialog;$('#spMore').onclick=spaceMore;$('#spHl').onchange=e=>{TO.hlSpaces=e.target.checked;saveTO();redrawAll()};
 pane.querySelectorAll('[data-sp]').forEach(r=>r.onclick=()=>{const m=byId(r.dataset.sp);if(!m)return;if(S.tool!=='select')setTool('select');setSel([m.id]);scrollToBox(m.page,bboxOf(m))})}
function spaceSummaryDialog(){const rows=spaceSummary();let last='';
 modal('Space summary',`<div style="max-height:55vh;overflow:auto"><table class="ml"><thead><tr><th>Space</th><th>Subject</th><th>Count</th><th>Total</th></tr></thead><tbody>${rows.map(r=>{const h=r.space!==last;last=r.space;return`<tr><td>${h?esc(r.space):''}</td><td>${esc(r.subject)}</td><td class="num">${r.count}</td><td class="num">${esc(r.total)}</td></tr>`}).join('')}</tbody></table></div>`,
 [{label:'Close',cancel:1},{label:'Export Excel',fn:()=>{exportSpaceSummary();return false}}])}
async function exportSpaceSummary(){const rows=spaceSummary();const data=[['Space','Page','Subject','Count','Quantity','Unit','Total'],...rows.map(r=>[r.space,r.page,r.subject,r.count,r.value,r.unit,r.total])];
 const sp=S.markups.filter(s=>s.type==='space').map(s=>{const r=measOf(Object.assign({},s,{type:'area'})),sc=scOf(s),pr=fmtLen(polyLen(realPts(s.pts,sc),true),sc);return[spacePath(s),s.spaceNo||'',s.text||'',s.page,r?+r.v.toFixed(4):'',r?r.unit:'',pr,s.comment||'']});
 await saveFile(baseName()+'-spaces.xlsx',await PMOutput.xlsx([{name:'By space',rows:data},{name:'Spaces',rows:[['Path','Number','Name','Page','Area','Unit','Perimeter','Notes'],...sp]}]))}
function spaceMore(){modal('Spaces',`<div style="display:flex;flex-direction:column;gap:8px">
 <button class="btn" id="smArea" style="border:1px solid var(--line);justify-content:flex-start">Create Area measurements from selected spaces</button>
 <button class="btn" id="smCopy" style="border:1px solid var(--line);justify-content:flex-start">Copy spaces to other pages…</button>
 <button class="btn" id="smExpJ" style="border:1px solid var(--line);justify-content:flex-start">Export spaces (JSON)</button><button class="btn" id="smExpC" style="border:1px solid var(--line);justify-content:flex-start">Export spaces (CSV)</button>
 <button class="btn" id="smImp" style="border:1px solid var(--line);justify-content:flex-start">Import spaces (JSON)…</button><button class="btn" id="smXl" style="border:1px solid var(--line);justify-content:flex-start">Space summary to Excel</button></div>`,[{label:'Close',cancel:1}]);
 $('#smArea').onclick=()=>{const sp=[...S.sel].map(byId).filter(m=>m&&m.type==='space');if(!sp.length)return toast('Select one or more spaces first');pushUndo();const ids=[];
  for(const s of sp){const a=newMarkup('area',s.page,s.pts.map(q=>q.slice()),S.defaults.area);a.subject='Area: '+spName(s);S.markups.push(a);ids.push(a.id)}commit();closeModal();setSel(ids);toast(`Created ${ids.length} area measurement(s)`)};
 $('#smCopy').onclick=()=>{closeModal();modal('Copy spaces',`<div class="fld"><label>Which spaces</label><select class="ti" id="scW"><option value="page">All spaces on page ${S.cur}</option><option value="sel">Selected spaces</option></select></div><div class="fld"><label>To pages (e.g. 2-5 or all)</label><input class="ti" id="scP"></div>`,
  [{label:'Cancel',cancel:1},{label:'Copy',pri:1,fn:md=>{const src=md.querySelector('#scW').value==='sel'?[...S.sel].map(byId).filter(m=>m&&m.type==='space'):S.markups.filter(m=>m.type==='space'&&m.page===S.cur);const v=md.querySelector('#scP').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v);
   if(!src.length||!pages.length){toast('Nothing to copy');return false}pushUndo();let n=0;for(const pg of pages)for(const s of src){if(pg===s.page)continue;const c=clone(s);c.id=uid();c.page=pg;c.created=c.modified=Date.now();S.markups.push(c);n++}commit();toast(`Copied ${n} space(s)`)}}])};
 $('#smExpJ').onclick=()=>saveFile(baseName()+'-spaces.json',JSON.stringify({app:'PlanMark',spaces:S.markups.filter(m=>m.type==='space').map(s=>({page:s.page,name:s.text,number:s.spaceNo||'',notes:s.comment||'',color:s.style.stroke,fill:s.style.fill,pts:s.pts}))},null,1));
 $('#smExpC').onclick=()=>{const rows=[['Path','Number','Name','Page','Area','Unit','Notes']];for(const s of S.markups.filter(m=>m.type==='space')){const r=measOf(Object.assign({},s,{type:'area'}));rows.push([spacePath(s),s.spaceNo||'',s.text||'',s.page,r?r.v.toFixed(4):'',r?r.unit:'',s.comment||''])}
  saveFile(baseName()+'-spaces.csv','﻿'+rows.map(r=>r.map(c=>{c=String(c??'');return/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n'))};
 $('#smImp').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const j=JSON.parse(await i.files[0].text());const L=(j.spaces||[]).filter(s=>s.pts&&s.pts.length>2&&s.page<=S.pages.length);pushUndo();
  for(const s of L){const m=newMarkup('space',s.page,s.pts,Object.assign({},S.defaults.space,s.color?{stroke:s.color}:{},s.fill?{fill:s.fill}:{}));m.text=s.name||'Space';m.spaceNo=s.number||'';m.comment=s.notes||'';S.markups.push(m)}commit();closeModal();toast(`Imported ${L.length} spaces`)}catch(e){toast('Not a spaces file')}};i.click()};
 $('#smXl').onclick=()=>{closeModal();exportSpaceSummary()}}
/* ===================================================================== Legends (configurable) */
const LG_COLS=[['symbol','Symbol'],['subject','Subject'],['count','Count'],['length','Length'],['area','Area'],['volume','Volume']];
function legendData(m){const lg=m.lg;let ms=S.markups.filter(x=>x.type!=='legend'&&x.type!=='space'&&x.type!=='hlink');
 if(lg.scope!=='all')ms=ms.filter(x=>x.page===m.page);if(lg.space)ms=ms.filter(x=>spacePath(x).split(' > ').includes(lg.space)||spaceOf(x)===lg.space);if(lg.subjects&&lg.subjects.length)ms=ms.filter(x=>lg.subjects.includes(x.subject));
 const g=new Map();for(const x of ms){const k=x.subject||T[x.type].label;if(!g.has(k))g.set(k,{subject:k,color:x.style.stroke,fill:x.style.fill,type:x.type,count:0,len:0,area:0,vol:0,sc:null,has:{}});const o=g.get(k),r=measOf(x);
  o.count+=x.type==='count'?x.pts.length:1;if(r){o.sc=o.sc||r.sc;if(r.kind==='len'){o.len+=r.raw;o.has.length=1}if(r.kind==='area'){o.area+=r.raw;o.has.area=1}if(r.extra&&r.extra.kind==='vol'){o.vol+=r.extra.raw;o.has.volume=1}}}
 const rows=[...g.values()];if(lg.subjects&&lg.subjects.length)rows.sort((a,b)=>lg.subjects.indexOf(a.subject)-lg.subjects.indexOf(b.subject));return rows}
function legendCells(o,c){const sc=o.sc||scaleFor(S.cur);switch(c){case'subject':return o.subject;case'count':return String(o.count);case'length':return o.has.length?fmtLen(o.len,sc):'';case'area':return o.has.area?fmtA(o.area,sc):'';case'volume':return o.has.volume&&window.volOf?volOf(o.vol,sc).text:'';default:return''}}
function legendGeom2(m){const lg=m.lg,fs=+lg.fontSize||9,rows=legendData(m),cols=(lg.cols||['symbol','subject','count']).filter(c=>LG_COLS.some(x=>x[0]===c)),pad=fs*.6,lh=fs*1.7,titleH=lg.title?fs*1.9:0;
 const widths=cols.map(c=>c==='symbol'?fs*1.8:Math.max(tw(LG_COLS.find(x=>x[0]===c)[1],fs,true),...rows.map(o=>tw(legendCells(o,c),fs)))+fs*.8);
 const W=pad*2+widths.reduce((a,b)=>a+b,0),Hh=pad*2+titleH+fs*1.5+Math.max(1,rows.length)*lh,[x,y]=m.pts[0];return{b:[x,y,x+W,y+Hh],rows,cols,widths,fs,pad,lh,titleH}}
const _lb=H.legendBox,_lp=H.legendPrims;
H.legendBox=m=>m.lg?legendGeom2(m).b:_lb(m);
H.legendPrims=(m,out,L,TX)=>{if(!m.lg)return _lp(m,out,L,TX);const g=legendGeom2(m),b=g.b,lg=m.lg,tc=lg.textColor||'#111827';
 L(dBox(b),{fill:lg.bg||'#ffffff',fo:1,stroke:lg.border===false?null:(lg.borderColor||'#111827'),w:lg.border===false?0:1,dash:''});
 if(lg.title)TX(b[0]+g.pad,b[1]+g.pad+g.fs*.8,lg.title,{align:'start',halo:false,size:g.fs*1.25,color:lg.titleColor||tc});
 let x=b[0]+g.pad;const hy=b[1]+g.pad+g.titleH+g.fs*.6;g.cols.forEach((c,i)=>{if(c!=='symbol')TX(x,hy,LG_COLS.find(q=>q[0]===c)[1],{align:'start',halo:false,size:g.fs*.9,color:tc});x+=g.widths[i]});
 g.rows.forEach((o,ri)=>{const y=b[1]+g.pad+g.titleH+g.fs*1.5+g.lh*(ri+.5);let xx=b[0]+g.pad;g.cols.forEach((c,i)=>{if(c==='symbol'){const s=g.fs*.55,cx=xx+g.fs*.8;
    if(o.type==='count')out.push({k:'p',d:dCircle([cx,y],s*.8),stroke:o.color,w:1,so:1,fill:o.fill&&o.fill!=='none'?o.fill:o.color,fo:.5});
    else if(['line','arrow','polyline','length','polylength','dimension','pen','arc','arclen'].includes(o.type))out.push({k:'p',d:dPoly([[cx-s*1.4,y],[cx+s*1.4,y]]),stroke:o.color,w:2,so:1,fill:null,fo:1});
    else out.push({k:'p',d:dBox([cx-s*1.2,y-s*.8,cx+s*1.2,y+s*.8]),stroke:o.color,w:1,so:1,fill:o.fill&&o.fill!=='none'?o.fill:o.color,fo:.45})}
   else TX(xx,y,legendCells(o,c),{align:'start',halo:false,bold:false,color:tc,size:g.fs});xx+=g.widths[i]})});
 if(!g.rows.length)TX(b[0]+g.pad,b[1]+g.pad+g.titleH+g.fs*2.3,'(no matching markups)',{align:'start',halo:false,bold:false,color:'#6b7280',size:g.fs})};
function legendDialog(existing,source){const lg=existing?clone(existing.lg||{}):{title:'Legend',scope:'page',cols:['symbol','subject','count','length','area'],fontSize:9,border:true,bg:'#ffffff',textColor:'#111827',subjects:source||[]};
 const sps=[...new Set(S.markups.filter(s=>s.type==='space').map(spName))];
 modal(existing?'Edit legend':'New legend',`<div class="fld"><label>Title</label><input class="ti" id="lgT" value="${esc(lg.title||'')}"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Markups from</label><select class="ti" id="lgS"><option value="page" ${lg.scope!=='all'?'selected':''}>This page</option><option value="all" ${lg.scope==='all'?'selected':''}>All pages</option></select></div><div><label style="font-size:11px;color:var(--mut)">Space</label><select class="ti" id="lgSp"><option value="">Any</option>${sps.map(s=>`<option ${lg.space===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div></div>
 <div class="fld"><label>Subjects (one per line; blank = all)</label><textarea class="ti" id="lgSu" rows="4">${esc((lg.subjects||[]).join('\n'))}</textarea></div>
 <div class="fld"><label>Columns</label><div class="row" style="flex-wrap:wrap;gap:8px">${LG_COLS.map(([k,l])=>`<label class="chk"><input type="checkbox" data-lgc="${k}" ${(lg.cols||[]).includes(k)?'checked':''}> ${l}</label>`).join('')}</div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Font size</label><input class="ti" type="number" id="lgF" value="${lg.fontSize||9}" min="5" max="40"></div><div><label style="font-size:11px;color:var(--mut)">Text</label><input type="color" id="lgC" value="${lg.textColor||'#111827'}"></div><div><label style="font-size:11px;color:var(--mut)">Background</label><input type="color" id="lgB" value="${lg.bg||'#ffffff'}"></div></div>
 <label class="chk fld"><input type="checkbox" id="lgBo" ${lg.border!==false?'checked':''}> Border</label><label class="chk fld"><input type="checkbox" id="lgCh"> Also save this legend to the Tool Chest</label>`,
 [{label:'Cancel',cancel:1},{label:existing?'Save':'Place legend',pri:1,fn:md=>{const v={title:md.querySelector('#lgT').value,scope:md.querySelector('#lgS').value,space:md.querySelector('#lgSp').value,subjects:md.querySelector('#lgSu').value.split('\n').map(s=>s.trim()).filter(Boolean),
   cols:[...md.querySelectorAll('[data-lgc]')].filter(c=>c.checked).map(c=>c.dataset.lgc),fontSize:+md.querySelector('#lgF').value||9,textColor:md.querySelector('#lgC').value,bg:md.querySelector('#lgB').value,border:md.querySelector('#lgBo').checked};
  if(md.querySelector('#lgCh').checked){S.chest.push({set:'My Tools',name:'Legend: '+(v.title||'Legend'),type:'legend',subject:'Legend',lg:clone(v),style:clone(S.defaults.legend)});LS.set('pm:chest',S.chest);renderChest()}
  if(existing){pushUndo();existing.lg=v;existing.modified=Date.now();commit();return}
  const p=S.pages[S.cur-1],m=newMarkup('legend',S.cur,[[p.w*.05,p.h*.05]],S.defaults.legend);m.lg=v;m.subject='Legend';pushUndo();S.markups.push(m);commit();setSel([m.id]);scrollToBox(m.page,bboxOf(m));toast('Legend placed — drag it where you want it')}}])}
/* ===================================================================== Markups List extras */
const AUTO_COLS=[['to_path','Space path'],['to_cx','Center X'],['to_cy','Center Y'],['to_w','Width'],['to_h','Height'],['to_gx','Centroid X'],['to_gy','Centroid Y'],['to_split','Count by space'],['to_scale','Scale'],['to_lock','Locked']];
const LPc=()=>window.PMListPro&&PMListPro.LP;
function fillAuto(){const lp=LPc();if(!lp)return;const ids=new Set(lp.cols.custom.map(c=>c.id));if(!AUTO_COLS.some(([k])=>ids.has(k)))return;
 for(const m of S.markups){m.cols=m.cols||{};const g=geomInfo(m),sc=g&&g.sc;const set=(k,v)=>{if(ids.has(k))m.cols[k]=v};
  set('to_path',spacePath(m));if(g){set('to_cx',fmtLen(g.cx,sc));set('to_cy',fmtLen(g.cy,sc));set('to_w',fmtLen(g.w,sc));set('to_h',fmtLen(g.h,sc));set('to_gx',g.gx!=null?fmtLen(g.gx,sc):'');set('to_gy',g.gy!=null?fmtLen(g.gy,sc):'')}
  set('to_split',m.type==='count'?Object.entries(countSplit(m)).map(([k,v])=>`${k}: ${v}`).join('; '):'');const s=scOf(m);set('to_scale',(s?s.label:'')+(scaleMismatch(m)?' ⚠':''));set('to_lock',m.locked?'Yes':'')}}
function addAutoCols(keys){const lp=LPc();if(!lp)return toast('Markups list module not loaded');let n=0;for(const[k,l]of AUTO_COLS){if(keys&&!keys.includes(k))continue;if(!lp.cols.custom.some(c=>c.id===k)){lp.cols.custom.push({id:k,name:l,type:'text',auto:1});n++}}LS.set('pm:cols',lp.cols);renderList();toast(n?`Added ${n} column(s)`:'Columns already present')}
const grpKey={subject:m=>m.subject||'(none)',page:m=>'Page '+m.page,status:m=>m.status||'(no status)',space:m=>spaceOf(m)||'(no space)',type:m=>T[m.type]?T[m.type].label:m.type,author:m=>m.author||'(none)'};
const _lr=listRows;listRows=function(){let rows=_lr.apply(this,arguments);if(TO.scope==='page')rows=rows.filter(({m})=>m.page===S.cur);return rows};
const _td=tableData;tableData=function(){fillAuto();return _td.apply(this,arguments)};
const _rl=renderList;
renderList=function(){fillAuto();if(TO.scope==='tabs'||TO.scope==='set'){crossDocList();return}
 if(S.summary&&TO.sumBy!=='subject'){altSummary();return}
 _rl.apply(this,arguments);if(S.summary||!TO.groupBy||!grpKey[TO.groupBy])return groupRowsDraggable();
 const body=$('#mlBody'),tb=body&&body.querySelector('tbody');if(!tb)return;const rows=listRows(),ncol=(body.querySelector('thead tr')||{}).children?.length||8;
 const trs=new Map();[...tb.children].forEach(tr=>{if(tr.dataset.id){const nx=tr.nextElementSibling&&tr.nextElementSibling.classList.contains('lprep')?tr.nextElementSibling:null;trs.set(tr.dataset.id,[tr,nx])}});
 const groups=new Map();for(const r of rows){const k=grpKey[TO.groupBy](r.m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 const keys=[...groups.keys()].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));tb.innerHTML='';
 for(const k of keys){const g=groups.get(k),col=TO.collapsed.includes(TO.groupBy+':'+k),sums=summaryRows(g).filter(o=>o.text).map(o=>`${o.subject}: ${o.text}`).join(' · ');
  const h=document.createElement('tr');h.className='tgrp';h.dataset.g=k;h.innerHTML=`<td colspan="${ncol}" style="background:var(--panel2);font-weight:600;cursor:pointer">${col?'▸':'▾'} ${esc(k)} <small style="color:var(--mut);font-weight:400">(${g.length}) ${esc(sums)}</small></td>`;tb.appendChild(h);
  if(!col)for(const r of g){const x=trs.get(r.m.id);if(x){tb.appendChild(x[0]);if(x[1])tb.appendChild(x[1])}}}
 groupRowsDraggable()};
function groupRowsDraggable(){$$('#mlBody tbody tr[data-id]').forEach(tr=>{tr.draggable=true;tr.ondragstart=e=>{const id=tr.dataset.id,ids=S.sel.has(id)?[...S.sel]:[id];e.dataTransfer.setData('text/pm-ids',JSON.stringify(ids));e.dataTransfer.effectAllowed='copy'}})}
document.addEventListener('click',e=>{const h=e.target.closest&&e.target.closest('#mlBody tr.tgrp');if(!h)return;const k=TO.groupBy+':'+h.dataset.g,i=TO.collapsed.indexOf(k);if(i>=0)TO.collapsed.splice(i,1);else TO.collapsed.push(k);saveTO();renderList()});
function altSummary(){const body=$('#mlBody');const rows=listRows();const gk=TO.sumBy==='status'?(m=>TO.latestOnly&&m.statusLog&&m.statusLog.length?(m.statusLog[m.statusLog.length-1].status||'(no status)'):(m.status||'(no status)')):(m=>spacePath(m)||'(no space)');
 const groups=new Map();for(const r of rows){if(TO.sumBy==='space'&&r.m.type==='count'){for(const[k,v]of Object.entries(countSplit(r.m))){const kk=k==='(no space)'?k:(()=>{const ch=chainAt(r.m.page,r.m.pts.find(q=>{const c=chainAt(r.m.page,q);return c.length&&spName(c[c.length-1])===k})||r.m.pts[0]);return ch.map(spName).join(' > ')||k})();
    if(!groups.has(kk))groups.set(kk,[]);groups.get(kk).push({m:Object.assign({},r.m,{pts:r.m.pts.filter(q=>{const c=chainAt(r.m.page,q);return(c.length?spName(c[c.length-1]):'(no space)')===k})}),r:null})}continue}
  const k=gk(r.m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 const keys=[...groups.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 body.innerHTML=`<table class="ml"><thead><tr><th>${TO.sumBy==='status'?'Status':'Space'}</th><th></th><th>Subject</th><th>Count</th><th>Total</th><th>Volume / Wall area</th></tr></thead><tbody>${keys.map(k=>{const sr=summaryRows(groups.get(k).map(x=>({m:x.m,r:measOf(x.m)})));
   return sr.map((o,i)=>`<tr><td>${i?'':'<b>'+esc(k)+'</b>'}</td><td><span class="dot" style="background:${o.color}"></span></td><td>${esc(o.subject)}</td><td class="num">${o.count}</td><td class="num">${esc(o.text)}</td><td class="num">${esc(o.extext||'')}</td></tr>`).join('')}).join('')}</tbody></table>`;
 $('#mlCount').textContent=S.markups.length}
async function setDocs(){const cur=LS.get('pm:set:cur',null);if(!cur)return[];const db=await new Promise((res,rej)=>{const r=indexedDB.open('planmark-sets',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onupgradeneeded=()=>{r.transaction.abort();rej(new Error('no sets'))}});
 const get=(st,k)=>new Promise(res=>{const t=db.transaction(st,'readonly').objectStore(st).get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>res(null)});const set=await get('sets',cur);if(!set)return[];const out=[],seen=new Set();
 for(const it of set.items){if(seen.has(it.fileId))continue;seen.add(it.fileId);const f=await get('files',it.fileId);if(!f)continue;const sv=LS.get('pm:doc:'+f.name+':'+f.size,null);out.push({name:f.name,markups:(sv&&sv.markups)||[],scales:(sv&&sv.scales)||{}})}db.close();return out}
function withDoc(d,fn){const k={markups:S.markups,scales:S.scales,fileKey:S.fileKey};S.markups=d.markups;S.scales=d.scales||{};S.fileKey=d.fileKey||'';try{return fn()}finally{S.markups=k.markups;S.scales=k.scales;S.fileKey=k.fileKey}}
async function crossDocList(){const body=$('#mlBody');let docs=[];
 if(TO.scope==='tabs'){const V=window.PMViews;if(V&&V.tabs)for(const t of V.tabs){if(t.id===V.curTab)docs.push({name:S.fileName,markups:S.markups,scales:S.scales,fileKey:S.fileKey,tab:t.id});else if(t.st)docs.push({name:t.name,markups:t.st.markups||[],scales:t.st.scales||{},fileKey:t.st.fileKey,tab:t.id})}else docs.push({name:S.fileName,markups:S.markups,scales:S.scales,fileKey:S.fileKey})}
 else{try{docs=await setDocs()}catch(e){docs=[]}if(!docs.length){body.innerHTML='<div class="hint" style="padding:12px">No Set selected — open the Sets panel and pick or create a set.</div>';return}}
 const rows=[],agg=[];for(const d of docs)withDoc(d,()=>{for(const m of d.markups){const r=measOf(m);rows.push({doc:d,m,text:r?r.text+(r.extra?' · '+r.extra.text:''):''});agg.push({m,r})}});
 const sr=[];for(const d of docs)withDoc(d,()=>{for(const o of summaryRows(d.markups.map(m=>({m,r:measOf(m)}))))sr.push(Object.assign({doc:d.name},o))});
 const tot=new Map();for(const o of sr){const k=o.subject+'|'+o.unit;if(!tot.has(k))tot.set(k,{subject:o.subject,unit:o.unit,count:0,v:0,color:o.color,kind:o.kind});const t=tot.get(k);t.count+=o.count;t.v+=o.total||0}
 body.innerHTML=`<div class="hint" style="padding:6px 8px">${rows.length} markups in ${docs.length} document(s) — ${TO.scope==='tabs'?'all open tabs':'the current Set'}. Click a row to go to it.</div>
 <table class="ml"><thead><tr><th></th><th>Document</th><th>Subject</th><th>Page</th><th>Measurement</th><th>Status</th></tr></thead><tbody>${rows.map((x,i)=>`<tr data-xi="${i}"><td><span class="dot" style="background:${x.m.style.stroke}"></span></td><td>${esc(x.doc.name)}</td><td>${esc(x.m.subject)}</td><td class="num">${x.m.page}</td><td class="num">${esc(x.text)}</td><td>${esc(x.m.status||'')}</td></tr>`).join('')}</tbody></table>
 <div class="sec" style="padding:0 8px">Totals across documents</div><table class="ml"><tbody>${[...tot.values()].map(t=>`<tr><td><span class="dot" style="background:${t.color}"></span> ${esc(t.subject)}</td><td class="num">${t.count}</td><td class="num">${t.kind?fmtNum(t.v,2)+' '+esc(t.unit):''}</td></tr>`).join('')}</tbody></table>`;
 $('#mlCount').textContent=rows.length;
 body.querySelectorAll('[data-xi]').forEach(tr=>tr.onclick=()=>{const x=rows[+tr.dataset.xi];if(x.doc.tab!=null&&window.PMViews){PMViews.switchTo(x.doc.tab);setTimeout(()=>{setSel([x.m.id]);scrollToBox(x.m.page,bboxOf(x.m))},300)}else if(x.doc.fileKey===S.fileKey){setSel([x.m.id]);scrollToBox(x.m.page,bboxOf(x.m))}else toast('Open '+x.doc.name+' from the Sets panel to edit it')})}
// arrow-key stepping through the list
let listFocus=false;document.addEventListener('pointerdown',e=>{listFocus=!!(e.target.closest&&e.target.closest('#mlist'))},true);
document.addEventListener('keydown',e=>{if(!listFocus||(e.key!=='ArrowDown'&&e.key!=='ArrowUp')||(e.target.closest&&e.target.closest('input,textarea,select'))||modalCb)return;
 const trs=[...$$('#mlBody tbody tr[data-id]')].filter(t=>t.offsetParent!==null);if(!trs.length)return;e.preventDefault();e.stopImmediatePropagation();
 const cur=[...S.sel][0];let i=trs.findIndex(t=>t.dataset.id===cur);i=i<0?0:clamp(i+(e.key==='ArrowDown'?1:-1),0,trs.length-1);const id=trs[i].dataset.id,m=byId(id);if(!m)return;
 if(S.tool!=='select')setTool('select');setSel([id]);scrollToBox(m.page,bboxOf(m));setTimeout(()=>{const t=$(`#mlBody tr[data-id="${id}"]`);if(t)t.scrollIntoView({block:'nearest'})},30)},true);
// re-render page-scoped list when the page changes
const _uci=updateCurUI;updateCurUI=function(){_uci.apply(this,arguments);if(TO.scope==='page'){clearTimeout(window.__tol);window.__tol=setTimeout(renderList,80)}};
/* --- summary templates & column definitions --- */
const TCOLS=()=>{const lp=LPc();const b=[['subject','Subject'],['type','Type'],['page','Page'],['space','Space'],['spath','Space path'],['label','Label'],['comment','Comments'],['measure','Measurement'],['value','Value'],['unit','Unit'],['extra','Volume / Wall'],['author','Author'],['date','Date'],['status','Status'],['cx','Center X'],['cy','Center Y'],['w','Width'],['h','Height']];
 return b.concat(lp?lp.cols.custom.filter(c=>!c.auto).map(c=>['c:'+c.id,c.name]):[])};
function tcell(m,r,k){const g=['cx','cy','w','h'].includes(k)?geomInfo(m):null;switch(k){case'subject':return m.subject;case'type':return T[m.type]?T[m.type].label:m.type;case'page':return m.page;case'space':return spaceOf(m);case'spath':return spacePath(m);case'label':return m.label||m.text||'';case'comment':return m.comment||'';
 case'measure':return r?r.text:'';case'value':return r?+r.v.toFixed(4):'';case'unit':return r?r.unit:'';case'extra':return r&&r.extra?r.extra.text:'';case'author':return m.author;case'date':return new Date(m.created).toISOString();case'status':return m.status||'';
 case'cx':return g?fmtLen(g.cx,g.sc):'';case'cy':return g?fmtLen(g.cy,g.sc):'';case'w':return g?fmtLen(g.w,g.sc):'';case'h':return g?fmtLen(g.h,g.sc):'';
 default:if(k.startsWith('c:')&&window.PMListPro){const c=LPc().cols.custom.find(x=>'c:'+x.id===k);return c?PMListPro.colDisplay(m,c):''}return''}}
function tplRows(t){let rows=listRows();if(t.group&&grpKey[t.group])rows=rows.slice().sort((a,b)=>String(grpKey[t.group](a.m)).localeCompare(String(grpKey[t.group](b.m)),undefined,{numeric:true}));
 if(t.sort){const[k,d]=t.sort.split(':');rows=rows.slice().sort((a,b)=>{const x=tcell(a.m,a.r,k),y=tcell(b.m,b.r,k);return(x<y?-1:x>y?1:0)*(d==='desc'?-1:1)})}
 const hdr=(t.group?['Group']:[]).concat(t.cols.map(k=>(TCOLS().find(c=>c[0]===k)||[k,k])[1]));return[hdr,...rows.map(({m,r})=>(t.group?[grpKey[t.group](m)]:[]).concat(t.cols.map(k=>tcell(m,r,k))))]}
function tplDialog(){const cols=TCOLS();const t0=TO.tpls[0]||{name:'',cols:['subject','page','measure','status'],group:'',sort:'',images:true};
 modal('Summary templates',`<div class="row fld"><select class="ti" id="tpS"><option value="">— new template —</option>${TO.tpls.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('')}</select><input class="ti" id="tpN" placeholder="Template name"></div>
 <div class="fld"><label>Columns (in order)</label><div id="tpC" style="display:grid;grid-template-columns:1fr 1fr;gap:3px;max-height:180px;overflow:auto">${cols.map(([k,l])=>`<label class="chk"><input type="checkbox" data-tc="${k}"> ${esc(l)}</label>`).join('')}</div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Group by</label><select class="ti" id="tpG"><option value="">None</option>${Object.keys(grpKey).map(k=>`<option value="${k}">${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></div>
 <div><label style="font-size:11px;color:var(--mut)">Sort by</label><select class="ti" id="tpO"><option value="">List order</option>${cols.map(([k,l])=>`<option value="${k}:asc">${esc(l)} ↑</option><option value="${k}:desc">${esc(l)} ↓</option>`).join('')}</select></div></div>
 <label class="chk fld"><input type="checkbox" id="tpI" checked> Include thumbnails in PDF reports</label><div class="hint">Templates use the Markups list's current filter. Exports follow the column order shown.</div>`,
 [{label:'Close',cancel:1},{label:'Delete',fn:md=>{const i=md.querySelector('#tpS').value;if(i==='')return false;TO.tpls.splice(+i,1);saveTO();toast('Deleted')}},{label:'Save',fn:md=>{const t=read(md);if(!t.name){toast('Name the template');return false}const i=TO.tpls.findIndex(x=>x.name===t.name);if(i>=0)TO.tpls[i]=t;else TO.tpls.push(t);saveTO();toast('Template saved')}},
  {label:'Export Excel',fn:md=>{const t=read(md);PMOutput.xlsx([{name:'Markups',rows:tplRows(t)}]).then(b=>saveFile(baseName()+'-'+(t.name||'summary').replace(/[^\w\- ]+/g,'_')+'.xlsx',b));return false}},
  {label:'Export CSV',fn:md=>{const t=read(md);const rows=tplRows(t);saveFile(baseName()+'-'+(t.name||'summary').replace(/[^\w\- ]+/g,'_')+'.csv','﻿'+rows.map(r=>r.map(c=>{c=String(c??'');return/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n'));return false}},
  {label:'PDF report',pri:1,fn:md=>{const t=read(md);const keep=S.listSort;if(t.sort){const[k,d]=t.sort.split(':');if(['subject','page','status','author','date','label'].includes(k))S.listSort={k,dir:d==='desc'?-1:1}}
   PMOutput.makeReport({title:baseName()+' — '+(t.name||'Summary'),which:'list',group:['page','subject','status'].includes(t.group)?t.group:'none',thumbs:t.images,sums:true,pages:false}).finally(()=>{S.listSort=keep})}}]);
 const set=t=>{$('#tpN').value=t.name||'';$$('#tpC [data-tc]').forEach(c=>c.checked=t.cols.includes(c.dataset.tc));$('#tpG').value=t.group||'';$('#tpO').value=t.sort||'';$('#tpI').checked=t.images!==false};set(t0);
 $('#tpS').onchange=e=>set(e.target.value===''?{name:'',cols:['subject','page','measure'],group:'',sort:'',images:true}:TO.tpls[+e.target.value]);
 function read(md){const order=[...md.querySelectorAll('[data-tc]')].filter(c=>c.checked).map(c=>c.dataset.tc);return{name:md.querySelector('#tpN').value.trim(),cols:order.length?order:['subject','measure'],group:md.querySelector('#tpG').value,sort:md.querySelector('#tpO').value,images:md.querySelector('#tpI').checked}}}
function colDefsDialog(){modal('Column definitions',`<div class="hint" style="margin-bottom:8px">Share your custom columns (including formulas) between computers or with your team.</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" id="cdE" style="border:1px solid var(--line)">Export columns…</button><button class="btn" id="cdI" style="border:1px solid var(--line)">Import columns…</button><button class="btn" id="cdA" style="border:1px solid var(--line)">Add takeoff columns…</button></div>`,[{label:'Close',cancel:1}]);
 $('#cdE').onclick=()=>{const lp=LPc();if(!lp)return;saveFile('planmark-columns.json',JSON.stringify({app:'PlanMark',columns:lp.cols},null,1))};
 $('#cdI').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const j=JSON.parse(await i.files[0].text()),lp=LPc(),c=j.columns||j;if(!c||!Array.isArray(c.custom))throw 0;
  for(const x of c.custom){const e=lp.cols.custom.findIndex(y=>y.id===x.id);if(e>=0)lp.cols.custom[e]=x;else lp.cols.custom.push(x)}if(Array.isArray(c.hidden))lp.cols.hidden=c.hidden;if(c.order)lp.cols.order=c.order;LS.set('pm:cols',lp.cols);renderList();closeModal();toast(`Imported ${c.custom.length} column(s)`)}catch(e){toast('Not a columns file')}};i.click()};
 $('#cdA').onclick=()=>{closeModal();modal('Add takeoff columns',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${AUTO_COLS.map(([k,l])=>`<label class="chk"><input type="checkbox" data-ac="${k}" checked> ${l}</label>`).join('')}</div><div class="hint" style="margin-top:6px">These fill in automatically (sizes in each markup's scale).</div>`,[{label:'Cancel',cancel:1},{label:'Add',pri:1,fn:md=>addAutoCols([...md.querySelectorAll('[data-ac]')].filter(c=>c.checked).map(c=>c.dataset.ac))}])}}
/* ===================================================================== Quantity Link */
function qlKey(o){return o.subject+'|'+o.unit+'|'+(o.kind||'')}
function qlRows(){const ql=QL(),f=ql[S.fileKey]||{rows:[]};const sr=summaryRows(S.markups.filter(m=>m.type!=='legend').map(m=>({m,r:measOf(m)})));const by=new Map(sr.map(o=>[qlKey(o),o]));
 for(const o of sr){const k=qlKey(o);if(!f.rows.includes(k))f.rows.push(k)}ql[S.fileKey]=f;saveQL(ql);
 return f.rows.map((k,i)=>{const o=by.get(k),[subj,unit]=k.split('|');return[i+1,subj,unit,o?o.count:0,o?(typeof o.total==='number'?+o.total.toFixed(4):0):0,o&&o.ex?+o.ex.v.toFixed(4):'',o&&o.ex?o.ex.unit:'',o?o.text:'(none now)']})}
async function qlBytes(){const rows=qlRows();const b=await PMOutput.xlsx([{name:'Quantities',rows:[['Row','Item (subject)','Unit','Count','Quantity','Volume / Wall','Volume / Wall unit','Display'],...rows]},{name:'Info',rows:[['File',S.fileName],['Updated',new Date().toLocaleString()],['Note','Rows never move: each subject keeps its row number, so formulas in your estimate can point at fixed cells (Quantities!E2, E3…).']]}]);return new Uint8Array(await b.arrayBuffer())}
let qlT=0;H.change.push(()=>{const f=QL()[S.fileKey];if(!f||!f.path||!(window.pmDesktop&&pmDesktop.writeLinkedFile))return;clearTimeout(qlT);qlT=setTimeout(async()=>{try{const r=await pmDesktop.writeLinkedFile(f.path,await qlBytes());if(r&&r.ok===false)toast('Quantity Link: could not update '+f.path+(r.reason?' ('+r.reason+')':''))}catch(e){}},1500)});
function qlDialog(){const dv=window.pmDesktop&&pmDesktop.saveLinkedFile,f=QL()[S.fileKey]||{};
 modal('Quantity Link (Excel)',`<div class="hint" style="margin-bottom:8px">Makes an Excel workbook of quantities where every subject keeps the same row forever (new subjects are added at the bottom). Point your estimate at those cells.</div>
 ${dv?`<div class="meas"><b style="font-size:13px;color:var(--text)">${f.path?'Linked file':'Not linked yet'}</b><small>${esc(f.path||'Choose where to save; PlanMark rewrites it automatically whenever quantities change. In Excel use Data → Refresh All (or reopen) to pull the new numbers.')}</small></div>`:'<div class="hint">In the browser the workbook is downloaded; re-export after changes and replace the old file. The Windows app can keep a file updated automatically.</div>'}`,
 [{label:'Close',cancel:1},...(dv&&f.path?[{label:'Unlink',fn:()=>{const q=QL();if(q[S.fileKey])delete q[S.fileKey].path;saveQL(q);toast('Unlinked')}}]:[]),{label:'Export now',fn:()=>{qlBytes().then(b=>saveFile(baseName()+'-quantities.xlsx',new Blob([b])));return false}},
  ...(dv?[{label:f.path?'Choose new file…':'Link to a file…',pri:1,fn:()=>{(async()=>{try{const r=await pmDesktop.saveLinkedFile({name:baseName()+'-quantities.xlsx',bytes:await qlBytes()});if(r&&r.path){const q=QL();q[S.fileKey]=Object.assign(q[S.fileKey]||{rows:[]},{path:r.path});saveQL(q);toast('Linked: '+r.path)}}catch(e){toast('Link failed: '+(e.message||e))}})()}}]:[])])}
/* ===================================================================== scale tools dialogs */
function scaleTools(){const pg=S.cur,sc=scaleFor(pg),locked=S.scales[pg]&&S.scales[pg].locked,temp=TEMP[S.fileKey]&&TEMP[S.fileKey][pg];
 modal('Scale tools',`<div class="meas"><b style="font-size:13px;color:var(--text)">Page ${pg}: ${esc(sc.label)}${locked?' 🔒':''}${temp?' (temporary)':''}</b><small>${nonUniform(sc)?'Separate vertical scale: 1 pt = '+fmtLen(sc.perPtY,sc)+' vertically':'Same scale horizontally and vertically'}</small></div>
 <div style="display:flex;flex-direction:column;gap:6px">
 <button class="btn" id="stPre" style="border:1px solid var(--line);justify-content:flex-start">Scale presets — save, apply, manage…</button>
 <button class="btn" id="stRng" style="border:1px solid var(--line);justify-content:flex-start">Apply this page's scale to other pages…</button>
 <button class="btn" id="stY" style="border:1px solid var(--line);justify-content:flex-start">Calibrate a separate vertical (Y) scale…</button>${nonUniform(sc)?'<button class="btn" id="stY0" style="border:1px solid var(--line);justify-content:flex-start">Remove the separate vertical scale</button>':''}
 <button class="btn" id="stLock" style="border:1px solid var(--line);justify-content:flex-start">${locked?'Unprotect':'Protect'} this page's scale</button>
 <button class="btn" id="stTmp" style="border:1px solid var(--line);justify-content:flex-start">${temp?'Clear temporary scale':'Use a temporary scale (this session only)…'}</button>
 <button class="btn" id="stMis" style="border:1px solid var(--line);justify-content:flex-start">Find measurements whose scale differs from their page</button></div>
 <div class="row fld" style="margin-top:10px"><label class="chk"><input type="checkbox" id="stHv" ${TO.hlVp?'checked':''}> Highlight viewports</label></div>
 <div class="fld"><label>Units on pages without a scale</label><select class="ti" id="stDu"><option value="">Inches (default)</option>${Object.entries(UNITS).filter(([k])=>k!=='ftin').map(([k,u])=>`<option value="${k}" ${TO.defUnit===k?'selected':''}>${u.name}</option>`).join('')}</select></div>`,[{label:'Close',cancel:1}]);
 $('#stHv').onchange=e=>{TO.hlVp=e.target.checked;saveTO();redrawAll()};$('#stDu').onchange=e=>{TO.defUnit=e.target.value;saveTO();commit();updateScaleBtn()};
 $('#stPre').onclick=()=>{closeModal();presetDialog()};
 $('#stRng').onclick=()=>{closeModal();modal('Apply scale to pages',`<div class="hint">Copies "${esc(sc.label)}" from page ${pg}.</div><div class="fld"><label>Pages (e.g. 2-6, 9 or all)</label><input class="ti" id="arP"></div>`,[{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{const v=md.querySelector('#arP').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v);if(!pages.length)return false;if(setPageScale(pages,Object.assign({},sc,{none:undefined})))toast(`Scale applied to ${pages.length} page(s)`)}}])};
 $('#stY').onclick=async()=>{closeModal();if(sc.none){toast('Set the page scale first (horizontal), then calibrate the vertical scale');return}const pts=await pickPoints(2,'Vertical scale: click both ends of a known vertical dimension');if(pts[0].page!==pts[1].page)return toast('Both points must be on one page');
  const a=pts[0].pt,b=pts[1].pt;modal('Vertical scale',`<div class="hint" style="margin-bottom:8px">Enter the real length of the line you picked.</div><div class="row fld"><input class="ti" type="number" step="any" id="yF" placeholder="feet"><input class="ti" type="number" step="any" id="yI" placeholder="inches"></div><div class="fld"><label>…or metres</label><input class="ti" type="number" step="any" id="yM"></div>`,[{label:'Cancel',cancel:1},{label:'Set',pri:1,fn:md=>{
   const real=(+md.querySelector('#yM').value)||(((+md.querySelector('#yF').value||0)*12+(+md.querySelector('#yI').value||0))*0.0254);const dx=Math.abs(b[0]-a[0]),dy=Math.abs(b[1]-a[1]);if(!(real>0)||dy<1){toast('Pick a mostly vertical line and enter its length');return false}
   const rx=dx*sc.perPt;if(real<=rx){toast('That length is shorter than the horizontal part of the line');return false}const sy=Math.sqrt(real*real-rx*rx)/dy;const p0=pts[0].page;const cur=S.scales[p0]||Object.assign({},scaleFor(p0));if(cur.locked){toast('This page scale is protected');return false}
   S.scales[p0]=Object.assign({},cur,{perPtY:sy,label:(cur.label||'Custom').replace(/ \(Y.*\)$/,'')+' (Y '+(sy/PT_M>=10?'1:'+Math.round(sy/PT_M):(sy/PT_M).toFixed(2))+')'});saveScales();commit();updateScaleBtn();toast('Vertical scale set')}}])};
 if($('#stY0'))$('#stY0').onclick=()=>{const c=S.scales[pg];if(c){if(c.locked)return toast('Protected');delete c.perPtY;c.label=(c.label||'').replace(/ \(Y.*\)$/,'');saveScales();commit();updateScaleBtn();closeModal()}};
 $('#stLock').onclick=()=>{if(!S.scales[pg]){if(sc.none)return toast('Set a scale first');S.scales[pg]=Object.assign({},sc)}S.scales[pg].locked=!locked;saveScales();updateScaleBtn();closeModal();toast(locked?'Scale unprotected':'Scale protected — it can\'t be changed until you unprotect it')};
 $('#stTmp').onclick=()=>{closeModal();if(temp){delete TEMP[S.fileKey][pg];commit();updateScaleBtn();return toast('Temporary scale cleared')}
  modal('Temporary scale',`<div class="hint" style="margin-bottom:8px">Used until you close PlanMark; it isn't saved with the file.</div><div class="fld"><select class="ti" id="tsP">${scaleOptions('a:0.25')}</select></div>`,[{label:'Cancel',cancel:1},{label:'Use',pri:1,fn:md=>{const s=scaleFromCode(md.querySelector('#tsP').value);if(!s)return false;s.label+=' (temporary)';TEMP[S.fileKey]=TEMP[S.fileKey]||{};TEMP[S.fileKey][pg]=s;commit();updateScaleBtn();toast('Temporary scale on page '+pg)}}])};
 $('#stMis').onclick=()=>{const ms=S.markups.filter(scaleMismatch);closeModal();if(!ms.length)return toast('Every measurement matches its page/viewport scale');setSel(ms.map(m=>m.id));scrollToBox(ms[0].page,bboxOf(ms[0]));toast(`${ms.length} measurement(s) use a different scale — selected`)}}
function presetDialog(){const sc=scaleFor(S.cur);
 modal('Scale presets',`${TO.presets.map((p,i)=>`<div class="res" data-pi="${i}" style="display:flex;gap:6px;align-items:center"><b style="flex:1">${esc(p.name)}</b><small style="color:var(--mut)">${esc(p.scale.label)}</small><button class="btn" data-pa="apply" style="height:24px;border:1px solid var(--line)">Apply…</button><button class="btn" data-pa="del" style="height:24px;border:1px solid var(--line)">✕</button></div>`).join('')||'<div class="hint">No presets yet.</div>'}
 <div class="row fld" style="margin-top:10px"><input class="ti" id="prN" placeholder="Name for page ${S.cur}'s scale (${esc(sc.label)})"><button class="btn" id="prS" style="flex:0;border:1px solid var(--line)">Save current</button></div>`,[{label:'Close',cancel:1}]);
 $('#prS').onclick=()=>{if(sc.none)return toast('This page has no scale to save');const n=$('#prN').value.trim()||sc.label;TO.presets.push({name:n,scale:Object.assign({},sc,{locked:undefined,none:undefined})});saveTO();closeModal();presetDialog()};
 $$('#modal [data-pa]').forEach(b=>b.onclick=()=>{const i=+b.closest('[data-pi]').dataset.pi,p=TO.presets[i];if(b.dataset.pa==='del'){TO.presets.splice(i,1);saveTO();closeModal();presetDialog();return}
  closeModal();modal('Apply "'+p.name+'"',`<div class="fld"><label>Pages (e.g. ${S.cur}, 2-6 or all)</label><input class="ti" id="paP" value="${S.cur}"></div>`,[{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{const v=md.querySelector('#paP').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(x=>x.num):parseRange(v);if(!pages.length)return false;if(setPageScale(pages,clone(p.scale)))toast(`${p.name} applied to ${pages.length} page(s)`)}}])})}
H.under.push((n,p)=>{if(!TO.hlVp)return'';const L=(S.scales&&S.scales.vp&&S.scales.vp[n])||[];return L.map(v=>`<rect x="${v.box[0]}" y="${v.box[1]}" width="${v.box[2]-v.box[0]}" height="${v.box[3]-v.box[1]}" fill="rgba(14,165,233,.10)" stroke="#0ea5e9" stroke-width="${1.5/S.zoom}" pointer-events="none"/>`).join('')});
function snapDialog(){const t=TO.snapTypes;
 modal('Snap options',`<div class="fld"><label>Snap to</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${[['end','Endpoints'],['mid','Midpoints'],['int','Intersections'],['perp','Perpendicular'],['center','Centers'],['near','Nearest point on line']].map(([k,l])=>`<label class="chk"><input type="checkbox" data-sn="${k}" ${t[k]?'checked':''}> ${l}</label>`).join('')}</div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Sensitivity (pixels)</label><input class="ti" type="number" id="snT" min="2" max="40" value="${TO.snapTol}"></div><div><label style="font-size:11px;color:var(--mut)">Marker colour</label><input type="color" id="snK" value="${TO.snapColor}"></div></div>
 <label class="chk fld"><input type="checkbox" id="snO" ${TO.ortho?'checked':''}> Orthogonal (lines go only horizontal / vertical) <kbd>Shift+F7</kbd></label><div class="hint">Turn snapping to content, markups and grid on or off with the Snap button in the status bar.</div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:md=>{md.querySelectorAll('[data-sn]').forEach(c=>TO.snapTypes[c.dataset.sn]=c.checked);TO.snapTypes._custom=!['end','mid','int','near','perp','center'].every(k=>TO.snapTypes[k]);TO.snapTol=clamp(+md.querySelector('#snT').value||9,2,40);TO.snapColor=md.querySelector('#snK').value;TO.ortho=md.querySelector('#snO').checked;saveTO();updOrtho()}}])}
function fillDialog(){const D=TO.dfill;modal('Dynamic Fill settings',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Detail (dpi)</label><select class="ti" id="dfD">${[72,108,144,200,300].map(v=>`<option ${+D.dpi===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label style="font-size:11px;color:var(--mut)">Close gaps up to (pt)</label><input class="ti" type="number" step="0.5" min="0" max="20" id="dfG" value="${D.gap}"></div></div>
 <div class="fld"><label>Edge sensitivity (higher = faint lines count as walls)</label><input type="range" min="80" max="240" id="dfE" value="${D.edge}"></div><label class="chk fld"><input type="checkbox" id="dfM" ${D.useMarkups?'checked':''}> Treat my markups (lines, shapes) as walls</label>
 <div class="fld"><label>Create</label><select class="ti" id="dfO">${[['area','Area'],['perimeter','Perimeter'],['volume','Volume'],['space','Space'],['polygon','Polygon']].map(([v,l])=>`<option value="${v}" ${TO.dfillOut===v?'selected':''}>${l}</option>`).join('')}</select></div>`,
 [{label:'Cancel',cancel:1},{label:'Save & fill',pri:1,fn:md=>{TO.dfill={dpi:+md.querySelector('#dfD').value,gap:+md.querySelector('#dfG').value,edge:+md.querySelector('#dfE').value,useMarkups:md.querySelector('#dfM').checked};TO.dfillOut=md.querySelector('#dfO').value;saveTO();setTool('dfill',{lock:true});toast('Click inside rooms · Esc to stop')}}])}
/* ===================================================================== properties additions */
H.props.push((m,mode,type)=>{if(mode!=='sel'||!m)return'';let h='';const g=geomInfo(m);
 if(scaleMismatch(m))h+=`<div class="meas" style="border-color:#f59e0b"><b style="font-size:12px;color:#fbbf24">⚠ Different scale than its page</b><small>This markup measures at ${esc(m.scale.label)}; the ${baseScale(m)===scaleFor(m.page)?'page':'viewport'} is ${esc(baseScale(m).label)}.</small></div>`;
 if(g&&(T[m.type]&&T[m.type].meas||['rect','ellipse','polygon','cloud','space'].includes(m.type))&&m.type!=='count')h+=`<div class="hint" style="margin-bottom:8px">W ${esc(fmtLen(g.w,g.sc))} × H ${esc(fmtLen(g.h,g.sc))}${g.gx!=null?`<br>Centroid X ${esc(fmtLen(g.gx,g.sc))}, Y ${esc(fmtLen(g.gy,g.sc))} <label class="chk" style="display:inline-flex;margin-left:6px"><input type="checkbox" data-to="centroid" ${m.style.centroid?'checked':''}> show</label>`:''}</div>`;
 if(m.type==='count'){const sp=countSplit(m),ks=Object.keys(sp);if(ks.length>1||ks[0]!=='(no space)')h+=`<div class="hint" style="margin-bottom:8px">By space: ${ks.map(k=>esc(k)+' '+sp[k]).join(' · ')}</div>`}
 if(m.type==='space'){const par=parentOf(m),r=measOf(Object.assign({},m,{type:'area'})),sc=scOf(m);h+=`<div class="sec">Space</div><div class="row fld"><div style="flex:0 0 80px"><label style="font-size:11px;color:var(--mut)">Number</label><input class="ti" data-to="spaceNo" value="${esc(m.spaceNo||'')}"></div><div><label style="font-size:11px;color:var(--mut)">Name</label><input class="ti" data-to="text" value="${esc(m.text||'')}"></div></div>
  <div class="hint" style="margin-bottom:8px">${r?'Area '+esc(r.text)+' · ':''}Perimeter ${esc(fmtLen(polyLen(realPts(m.pts,sc),true),sc))}${par?'<br>Inside: '+esc(spacePath(par)):''}<br>Drag the corner handles to edit the boundary.</div>
  <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" data-toa="sparea" style="border:1px solid var(--line)">Create Area from space</button><button class="btn" data-toa="spsum" style="border:1px solid var(--line)">Space summary</button></div>`}
 if(m.type==='legend')h+=`<div class="row" style="margin-bottom:8px"><button class="btn" data-toa="lgedit" style="border:1px solid var(--line)">Edit legend…</button></div>`;
 if(m.chestKey&&S.chest.some(c=>toolKey(Object.assign({set:c.set||'My Tools'},c))===m.chestKey))h+=`<div class="row" style="margin-bottom:8px"><button class="btn" data-toa="updtool" style="border:1px solid var(--line)">Update its Tool Chest tool</button></div>`;
 return h});
$('#props').addEventListener('change',e=>{const el=e.target.closest('[data-to]');if(!el)return;const m=byId([...S.sel][0]);if(!m)return;pushUndo();const f=el.dataset.to;if(f==='centroid')m.style.centroid=el.checked;else m[f]=el.value;m.modified=Date.now();commit();spacesPane()});
$('#props').addEventListener('click',e=>{const b=e.target.closest('[data-toa]');if(!b)return;const m=byId([...S.sel][0]);if(!m)return;const a=b.dataset.toa;
 if(a==='sparea'){const x=newMarkup('area',m.page,m.pts.map(q=>q.slice()),S.defaults.area);x.subject='Area: '+spName(m);pushUndo();S.markups.push(x);commit();setSel([x.id]);toast('Area created from space')}
 if(a==='spsum')spaceSummaryDialog();if(a==='lgedit')legendDialog(m);
 if(a==='updtool'){const i=S.chest.findIndex(c=>toolKey(Object.assign({set:c.set||'My Tools'},c))===m.chestKey);if(i>=0){S.chest[i].style=clone(m.style);if(m.comment)S.chest[i].comment=m.comment;LS.set('pm:chest',S.chest);renderChest();toast('Tool updated')}}});
/* ===================================================================== hub, list header controls, keys, status */
function hub(){const b=(id,t,d)=>`<button class="btn" id="${id}" style="border:1px solid var(--line);justify-content:flex-start;height:auto;padding:7px 10px;flex-direction:column;align-items:flex-start;white-space:normal;text-align:left"><b>${t}</b><small style="color:var(--mut)">${d}</small></button>`;
 modal('Takeoff tools',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${b('hbSc','Scale tools','Presets, page ranges, Y scale, protect, temporary')}${b('hbSn','Snap options','Types, sensitivity, colour, orthogonal')}
 ${b('hbR3','3-Point Radius','Radius from three points on an arc')}${b('hbQm','Measure (Shift+M)','Quick measure — nothing saved')}
 ${b('hbCe','Centroids '+(TO.centroid?'on':'off'),'Show centroid marks on areas')}${b('hbDf','Dynamic Fill settings','Detail, gaps, edges, output')}
 ${b('hbSp','Spaces','Nested rooms, summaries, import/export')}${b('hbLg','New legend','From tool set, selection or list filter')}
 ${b('hbTp','Summary templates','Columns, grouping, sort, images')}${b('hbCd','List columns','Import/export, takeoff columns')}
 ${b('hbQl','Quantity Link','Stable Excel quantities'+(window.pmDesktop&&pmDesktop.saveLinkedFile?' — live file':''))}${b('hbTs','Tool sets','Manage, set scales, sequences')}</div>`,[{label:'Close',cancel:1}]);
 const go=(id,f)=>{$('#'+id).onclick=()=>{closeModal();f()}};go('hbSc',scaleTools);go('hbSn',snapDialog);go('hbR3',()=>setTool('rad3'));go('hbQm',()=>setTool('qmeasure'));go('hbCe',()=>{TO.centroid=!TO.centroid;saveTO();redrawAll();toast('Centroids '+(TO.centroid?'shown':'hidden'))});
 go('hbDf',fillDialog);go('hbSp',()=>switchTab('spaces'));go('hbLg',legendSourceDialog);go('hbTp',tplDialog);go('hbCd',colDefsDialog);go('hbQl',qlDialog);go('hbTs',manageSets)}
function legendSourceDialog(){const sets=[...new Set(combinedTools().map(c=>c.set))];
 modal('New legend from…',`<div style="display:flex;flex-direction:column;gap:8px"><button class="btn" id="lsAll" style="border:1px solid var(--line);justify-content:flex-start">All markups on this page</button><button class="btn" id="lsSel" style="border:1px solid var(--line);justify-content:flex-start">The selected markups (${S.sel.size})</button><button class="btn" id="lsList" style="border:1px solid var(--line);justify-content:flex-start">What the Markups list currently shows</button>
 <div class="row"><select class="ti" id="lsSet">${sets.map(s=>`<option>${esc(s)}</option>`).join('')}</select><button class="btn" id="lsSetB" style="flex:0;border:1px solid var(--line)">From tool set</button></div></div>`,[{label:'Close',cancel:1}]);
 $('#lsAll').onclick=()=>{closeModal();legendDialog(null,[])};$('#lsSel').onclick=()=>{closeModal();legendDialog(null,[...new Set([...S.sel].map(byId).filter(Boolean).map(m=>m.subject))])};
 $('#lsList').onclick=()=>{closeModal();legendDialog(null,[...new Set(listRows().map(r=>r.m.subject))])};$('#lsSetB').onclick=()=>{const s=$('#lsSet').value;closeModal();legendDialog(null,[...new Set(combinedTools().filter(c=>c.set===s).map(c=>c.subject||c.name))])}}
H.ribbon.push({label:'Takeoff',title:'Scale tools, snap options, spaces, legends, summary templates, Quantity Link',icon:'<path d="M3 20h18M5 20V9l4-3 4 3v11M15 20v-7h4v7"/><path d="M8 12h2M8 15h2"/>',fn:hub});
function updOrtho(){const b=$('#orthoBtn');if(b){b.textContent='Ortho: '+(TO.ortho?'On':'Off');b.style.borderColor=TO.ortho?'var(--acc)':'var(--line)'}}
document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select')||modalCb)return;
 if(e.key==='F7'&&e.shiftKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();TO.ortho=!TO.ortho;saveTO();updOrtho();toast('Orthogonal '+(TO.ortho?'on':'off'))}
 if(e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&e.code==='KeyM'&&S.pages.length){e.preventDefault();e.stopImmediatePropagation();setTool('qmeasure')}
 if(e.shiftKey&&e.altKey&&e.code==='Digit3'&&S.pages.length){e.preventDefault();setTool('rad3')}},true);
H.ready.push(()=>{addTab('spaces','Spaces');spacesPane();
 const st=$('#status'),ob=document.createElement('button');ob.id='orthoBtn';ob.title='Orthogonal: lines only horizontal/vertical (F7)';ob.style.cssText='background:none;border:1px solid var(--line);border-radius:4px;padding:1px 7px;cursor:pointer;color:var(--text)';ob.onclick=()=>{TO.ortho=!TO.ortho;saveTO();updOrtho()};st.insertBefore(ob,$('#scaleBtn'));updOrtho();
 const hd=$('#mlist .mlhead');if(hd){const w=document.createElement('span');w.style.cssText='display:inline-flex;gap:4px;align-items:center;flex-shrink:0';
  w.innerHTML=`<select class="ti" id="toScope" title="Show markups for" style="height:28px;width:auto;font-size:12px"><option value="all">All pages</option><option value="page">This page</option><option value="tabs">All open tabs</option><option value="set">Current Set</option></select>
  <select class="ti" id="toGroup" title="Group rows" style="height:28px;width:auto;font-size:12px"><option value="">No grouping</option>${Object.keys(grpKey).map(k=>`<option value="${k}">Group: ${k}</option>`).join('')}</select>
  <select class="ti" id="toSumBy" title="Summary by" style="height:28px;width:auto;font-size:12px"><option value="subject">Summary: subject</option><option value="status">Summary: status</option><option value="space">Summary: space</option></select>
  <label class="chk" title="In status summaries, count each markup by its latest status change" style="font-size:11px;white-space:nowrap"><input type="checkbox" id="toLatest" ${TO.latestOnly?'checked':''}>Latest status</label>
  <button class="btn" id="toTpl" title="Summary templates">Templates</button>`;hd.appendChild(w);
  $('#toScope').value=TO.scope;$('#toGroup').value=TO.groupBy;$('#toSumBy').value=TO.sumBy;
  $('#toScope').onchange=e=>{TO.scope=e.target.value;saveTO();renderList()};$('#toGroup').onchange=e=>{TO.groupBy=e.target.value;saveTO();renderList()};$('#toSumBy').onchange=e=>{TO.sumBy=e.target.value;saveTO();if(!S.summary)$('#mlSum').click();else renderList()};
  $('#toLatest').onchange=e=>{TO.latestOnly=e.target.checked;saveTO();renderList()};$('#toTpl').onclick=tplDialog}
 H.prefs.push(()=>{TO=load();updOrtho();renderChest();renderList()})});
H.change.push(()=>{clearTimeout(window.__tosp);window.__tosp=setTimeout(spacesPane,250)});H.open.push(()=>setTimeout(spacesPane,100));
Object.assign(window.PMTakeoff,{scaleTools,presetDialog,snapDialog,fillDialog,fill2,legendDialog,legendSourceDialog,spaceSummary,spaceSummaryDialog,exportSpaceSummary,spacePath,countSplit,qlRows,qlBytes,qlDialog,tplDialog,tplRows,colDefsDialog,addAutoCols,manageSets,seqDialog,addSelToChest,circ3,geomInfo,scaleMismatch,setPageScale,pickPoints,QM,TEMP,hub});
})();
