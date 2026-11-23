/* PlanMark — advanced measurement & document tools:
   Viewports, Sketch to Scale, slope / rise / segment lengths / captions, count marker shapes, hatch patterns,
   Arc & Arc Length, Radius, Forms (fill, create, auto-detect), Signatures & seals (incl. batch),
   Capture (attachments on markups), Snapshot. */
(function(){
/* =====================================================================================
   0. Tool registration (runs before 'load', so the ribbon picks them up)
   ===================================================================================== */
Object.assign(T,{
 arc:{label:'Arc',kind:'multi',max:3}, arclen:{label:'Arc Length',kind:'multi',max:3,meas:'arc'},
 radius:{label:'Radius',kind:'drag',meas:'radius'}, viewport:{label:'Viewport',kind:'drag',box:1},
 vpcal:{label:'Calibrate Viewport',kind:'drag'}, formfield:{label:'Form Field',kind:'drag',box:1}});
const NEWDEF={arc:{stroke:'#e0312b',width:2,opacity:1},arclen:{stroke:'#1f6fe5',width:1.5,opacity:1,fontSize:10},radius:{stroke:'#0891b2',width:1.5,opacity:1,fontSize:10},
 viewport:{stroke:'#0ea5e9',width:1,opacity:1,dash:'dash',fontSize:10},vpcal:{stroke:'#ff00aa',width:1.5,opacity:1,fontSize:10},formfield:{stroke:'#2563eb',width:1,opacity:1,dash:'dash'}};
for(const k in NEWDEF){BASE_DEF[k]=NEWDEF[k];if(!S.defaults[k])S.defaults[k]=clone(NEWDEF[k])}
RIBBON[1][1].push('arc');RIBBON[2][1].push('arclen','radius','viewport');
Object.assign(IC,{arc:'<path d="M4 18A10 10 0 0120 18"/><circle cx="4" cy="18" r="1.2"/><circle cx="20" cy="18" r="1.2"/>',
 arclen:'<path d="M4 17A9 9 0 0120 17"/><path d="M3 20h4M17 20h4"/>',radius:'<circle cx="12" cy="12" r="8" stroke-dasharray="3 2"/><path d="M12 12l6-5"/><circle cx="12" cy="12" r="1"/>',
 viewport:'<rect x="3" y="5" width="18" height="14" stroke-dasharray="3 2"/><path d="M7 15h5M7 15v-1.5M12 15v-1.5"/>',formfield:'<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M6 10v4"/>'});
Object.assign(KEYS,{arc:'Shift+A',arclen:'Shift+Alt+B',radius:'Shift+Alt+U',viewport:'Shift+Alt+W'});
Object.assign(HINTS,{arc:'Click start, a point on the arc, then the end',arclen:'Click start, a point on the arc, then the end',radius:'Drag from the center to the edge',
 viewport:'Drag a box around a detail drawn at its own scale',vpcal:'Draw a line over a known dimension inside the viewport',formfield:'Drag a box where the form field goes'});
const ls=(k,d)=>LS.get(k,d);
window.PM_EXTRA_SYNC_KEYS2=['pm:sigs','pm:vpshow','pm:anglesnap','pm:formshow'];

/* =====================================================================================
   1. Viewports — regions of a page with their own scale (stored in S.scales.vp[page])
   ===================================================================================== */
let vpShow=ls('pm:vpshow',true);
const vpList=pg=>(S.scales.vp&&S.scales.vp[pg])||[];
function vpAt(pg,pt){if(!pt)return null;const L=vpList(pg);for(let i=L.length-1;i>=0;i--){const b=L[i].box;if(pt[0]>=b[0]&&pt[0]<=b[2]&&pt[1]>=b[1]&&pt[1]<=b[3])return L[i]}return null}
function vpScaleAt(pg,pt){const v=vpAt(pg,pt);return v?v.scale:null}
window.vpScaleAt=vpScaleAt;
const scaleOfMarkup=m=>m.scale||vpScaleAt(m.page,m.pts&&m.pts[0])||scaleFor(m.page);
function scaleFromPreset(v,label){const[k,n0]=v.split(':'),n=+n0;if(k==='a')return{perPt:12/n*PT_M,label};if(k==='e')return{perPt:12*n*PT_M,label:`1" = ${n}'`};if(k==='m')return{perPt:n*PT_M,label:'1:'+n};return{perPt:PT_M,label:'1:1'}}
const presetOpts=()=>`<optgroup label="Architectural">${ARCH.map(([l,v])=>`<option value="a:${v}">${l}" = 1'-0"</option>`).join('')}</optgroup><optgroup label="Engineering">${ENG.map(n=>`<option value="e:${n}">1" = ${n}'</option>`).join('')}</optgroup><optgroup label="Metric">${METRIC.map(n=>`<option value="m:${n}">1:${n}</option>`).join('')}</optgroup><optgroup label="Other"><option value="f:1">Full size 1:1</option></optgroup>`;
function vpDialog(pg,box,existing){const cur=existing?existing.scale:scaleFor(pg);
 modal(existing?'Edit viewport':'New viewport',`<div class="hint" style="margin-bottom:8px">Measurements that start inside this box use its scale instead of the page scale.</div>
 <div class="fld"><label>Name</label><input class="ti" id="vpN" value="${esc(existing?existing.name:'Detail '+(vpList(pg).length+1))}"></div>
 <div class="fld"><label>Scale</label><select class="ti" id="vpP">${existing?`<option value="keep">Keep current (${esc(existing.scale.label)})</option>`:''}${presetOpts()}<option value="cal">Calibrate by drawing a known dimension…</option></select></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Display unit</label><select class="ti" id="vpU">${unitOpts(cur.none?'ftin':cur.unit)}</select></div>
 <div><label style="font-size:11px;color:var(--mut)">Precision</label><select class="ti" id="vpPr">${[2,4,8,16,32].map(d=>`<option value="${d}" ${d===(cur.prec||8)?'selected':''}>1/${d}"</option>`).join('')}</select></div></div>`,
 [{label:'Cancel',cancel:1},...(existing?[{label:'Delete',fn:()=>{S.scales.vp[pg]=vpList(pg).filter(v=>v!==existing);saveScales();commit()}}]:[]),{label:existing?'Save':'Create',pri:1,fn:md=>{
  const name=md.querySelector('#vpN').value.trim()||'Viewport',pv=md.querySelector('#vpP').value,unit=md.querySelector('#vpU').value,prec=+md.querySelector('#vpPr').value;
  S.scales.vp=S.scales.vp||{};const L=S.scales.vp[pg]=S.scales.vp[pg]||[];
  const v=existing||{id:uid(),box};v.name=name;
  if(pv==='keep'){v.scale=Object.assign({},v.scale,{unit,prec});saveScales();commit();updateScaleBtn();return}
  if(pv==='cal'){v.scale=Object.assign({},cur,{unit,prec,label:'(calibrating…)'});if(!existing)L.push(v);saveScales();commit();vpCalTarget=v;setTool('vpcal');toast('Draw a line over a known dimension inside "'+name+'"');return}
  const sel=md.querySelector('#vpP').selectedOptions[0];v.scale=Object.assign(scaleFromPreset(pv,sel.textContent),{unit,prec,dec:cur.dec??2});if(!existing)L.push(v);saveScales();commit();updateScaleBtn();toast('Viewport "'+name+'" set to '+v.scale.label)}}]);
 $('#vpP').value=existing?'keep':'a:0.125'}
let vpCalTarget=null;
function vpCalDialog(pt){const v=vpCalTarget;vpCalTarget=null;if(!v)return;
 modal('Calibrate viewport',`<div class="hint" style="margin-bottom:8px">Line drawn: ${(pt/72).toFixed(3)}" on paper. Enter its real length.</div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Feet</label><input class="ti" id="vcF" type="number" step="any" value="1"></div><div><label style="font-size:11px;color:var(--mut)">Inches</label><input class="ti" id="vcI" type="number" step="any" value="0"></div></div>
 <div class="fld"><label>…or metres</label><input class="ti" id="vcM" type="number" step="any" placeholder="leave blank for ft/in"></div>`,
 [{label:'Cancel',cancel:1},{label:'Calibrate',pri:1,fn:md=>{const mm=+md.querySelector('#vcM').value;const meters=mm>0?mm:((+md.querySelector('#vcF').value||0)*12+(+md.querySelector('#vcI').value||0))*0.0254;if(!(meters>0)){toast('Enter a length');return false}
  const perPt=meters/pt;v.scale=Object.assign({},v.scale,{perPt,label:'Custom 1:'+Math.round(perPt/PT_M)});saveScales();commit();toast('Viewport "'+v.name+'" calibrated')}}])}
H.over.push((n,p)=>{if(!vpShow)return'';const L=vpList(n);if(!L.length)return'';const k=1/S.zoom;
 return'<g pointer-events="none">'+L.map(v=>{const b=v.box;return`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="none" stroke="#0ea5e9" stroke-width="${1.2*k}" stroke-dasharray="${6*k} ${4*k}"/><text x="${b[0]+3*k}" y="${b[1]-4*k}" font-size="${11*k}" fill="#0284c7" font-family="Helvetica,Arial,sans-serif" font-weight="bold">${esc(v.name)} · ${esc(v.scale.label)}</text>`}).join('')+'</g>'});
// status bar reflects the viewport under the cursor
let sbRaf=0,sbLast='';
viewer.addEventListener('pointermove',e=>{if(sbRaf)return;sbRaf=requestAnimationFrame(()=>{sbRaf=0;if(!S.pages.length)return;const p=pageFromEvent(e);const v=p&&vpAt(p.num,toPt(e,p));const key=v?v.id:'';if(key===sbLast)return;sbLast=key;
 if(v)$('#scaleBtn').textContent=`Scale: ${v.name} — ${v.scale.label} · ${v.scale.unit==='ftin'?'ft-in':UNITS[v.scale.unit].abbr}`;else updateScaleBtn()})});
// keep viewports / form data when the page scale is applied to all pages
const _applyScale=applyScale;applyScale=function(){const keep={vp:S.scales.vp,forms:S.scales.forms};const r=_applyScale.apply(this,arguments);let ch=false;for(const k in keep)if(keep[k]!==undefined&&S.scales[k]===undefined){S.scales[k]=keep[k];ch=true}if(ch)saveScales();return r};
// remember viewports/forms across page operations that rebuild the document (same page count only)
const memo={};H.change.push(()=>{if(S.fileName)memo[S.fileName]={n:S.pages.length,vp:S.scales.vp,forms:S.scales.forms}});
H.open.push(()=>{const mm=memo[S.fileName];if(mm&&mm.n===S.pages.length){if(!S.scales.vp&&mm.vp)S.scales.vp=mm.vp;if(!S.scales.forms&&mm.forms)S.scales.forms=mm.forms}});

/* =====================================================================================
   2. Measurement maths: viewports, arc, radius, slope, rise, captions
   ===================================================================================== */
function arcGeom(p0,p1,p2){const[ax,ay]=p0,[bx,by]=p1,[cx,cy]=p2,d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-9)return null;
 const ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d,uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d,r=Math.hypot(ax-ux,ay-uy);
 const nrm=x=>{x%=2*Math.PI;return x<0?x+2*Math.PI:x},a0=Math.atan2(ay-uy,ax-ux),d1=nrm(Math.atan2(by-uy,bx-ux)-a0),d2=nrm(Math.atan2(cy-uy,cx-ux)-a0),sweep=d1<d2?d2:d2-2*Math.PI;
 return{c:[ux,uy],r,a0,sweep,len:Math.abs(sweep)*r}}
function arcPts(g){const n=clamp(Math.ceil(Math.abs(g.sweep)*g.r/3),12,240),o=[];for(let i=0;i<=n;i++){const a=g.a0+g.sweep*i/n;o.push([g.c[0]+g.r*Math.cos(a),g.c[1]+g.r*Math.sin(a)])}return o}
window.arcGeom=arcGeom;
function slopeFactor(s){if(!s)return 1;s=String(s).trim();let m;if((m=s.match(/^(-?\d*\.?\d+)\s*[\/:]\s*(\d*\.?\d+)$/)))return Math.sqrt(1+Math.pow(+m[1]/(+m[2]||1),2));
 if((m=s.match(/^(-?\d*\.?\d+)\s*(°|deg|d)$/i)))return 1/Math.cos(+m[1]*Math.PI/180);if((m=s.match(/^(-?\d*\.?\d+)\s*%$/)))return Math.sqrt(1+Math.pow(+m[1]/100,2));return 1}
window.slopeFactor=slopeFactor;
const riseMeters=st=>{if(!st||!(+st.rise))return 0;const u=st.riseUnit||'ft';return(+st.rise)*(u==='ft'?0.3048:(UNITS[u]?UNITS[u].m:1))};
const _measOf=measOf;
measOf=function(m){const t=T[m.type];if(!t||!t.meas)return null;const sc=scaleOfMarkup(m),pts=m.pts||[];
 if(t.meas==='arc'){if(pts.length<3)return pts.length===2?{kind:'len',raw:dist(pts[0],pts[1])*sc.perPt,v:lenNum(dist(pts[0],pts[1])*sc.perPt,sc),unit:lenUnit(sc),text:fmtLen(dist(pts[0],pts[1])*sc.perPt,sc),sc}:null;
  const g=arcGeom(pts[0],pts[1],pts[2]);const L=(g?g.len:polyLen(pts))*sc.perPt;return{kind:'len',raw:L,v:lenNum(L,sc),unit:lenUnit(sc),text:fmtLen(L,sc),sc,extra:g?{kind:'radius',raw:g.r*sc.perPt,v:lenNum(g.r*sc.perPt,sc),unit:lenUnit(sc),text:'R '+fmtLen(g.r*sc.perPt,sc)}:undefined}}
 if(t.meas==='radius'){if(pts.length<2)return null;const r=dist(pts[0],pts[1])*sc.perPt;return{kind:'len',raw:r,v:lenNum(r,sc),unit:lenUnit(sc),text:'R '+fmtLen(r,sc),sc}}
 const mm=(!m.scale&&sc!==scaleFor(m.page))?Object.assign({},m,{scale:sc}):m;const r=_measOf(mm);if(!r)return r;const st=m.style||{};
 const f=slopeFactor(st.slope),rise=riseMeters(st);
 if(r.kind==='len'&&(f!==1||rise)&&['length','polylength','dimension','perimeter','arclen'].includes(m.type)){r.plan=r.text;let L=r.raw*f;if(rise)L=Math.sqrt(L*L+rise*rise);r.raw=L;r.v=lenNum(L,sc);r.text=fmtLen(L,sc)}
 else if(r.kind==='area'&&f!==1){r.plan=r.text;r.raw*=f;r.v*=f;r.text=fmtNum(r.v,sc.dec??2)+' '+r.unit}
 return r};
function capTokens(m,r){const sc=r.sc,closed=['area','perimeter','volume','polygon'].includes(m.type)&&m.pts.length>2,U=UNITS[sc.unit];
 return{value:r.text,subject:m.subject||'',label:m.label||'',plan:r.plan||r.text,length:r.kind==='len'?r.text:'',area:r.kind==='area'?r.text:(closed?fmtNum(Math.abs(polyArea(m.pts))*sc.perPt*sc.perPt/U.aream,sc.dec??2)+' '+U.area:''),
  perimeter:closed?fmtLen(polyLen(m.pts,true)*sc.perPt,sc):'',volume:r.extra&&r.extra.kind==='vol'?r.extra.text:'',count:m.type==='count'?String(m.pts.length):'',depth:m.depth>0?fmtLen(m.depth,sc):'',slope:(m.style&&m.style.slope)||''}}
const _measLabel=measLabel;
measLabel=function(m){const r=measOf(m);if(!r)return'';const cap=m.style&&m.style.caption;
 if(cap&&String(cap).trim()){const tk=capTokens(m,r);return String(cap).replace(/\{(\w+)\}/g,(a,k)=>k in tk?tk[k]:a)}
 return _measLabel(m)+(r.plan?` (plan ${r.plan})`:'')};
// Shift-angle snapping step (default 45°)
let angleStep=ls('pm:anglesnap',45);
snap45=function(a,p){const st=(angleStep||45)*Math.PI/180,ang=Math.atan2(p[1]-a[1],p[0]-a[0]),s=Math.round(ang/st)*st,L=dist(a,p);return[a[0]+Math.cos(s)*L,a[1]+Math.sin(s)*L]};

/* =====================================================================================
   3. Drawing: arc / radius / helper tools, count markers, segment labels, hatching
   ===================================================================================== */
const P_=(d,s,x={})=>Object.assign({k:'p',d,stroke:s.stroke,w:s.width??1,so:s.opacity??1,fill:null,fo:1,dash:''},x);
const T_=(x,y,str,s,e={})=>Object.assign({k:'t',x,y,s:str,size:s.fontSize||10,color:s.stroke,bold:true,ang:0,align:'middle',halo:true,o:s.opacity??1},e);
function alongT(a,b,str,s,off){const ang=readable(a,b),r=ang*Math.PI/180,fs=(s.fontSize||10)*(off?.85:1),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,o=fs*(off||.85);return T_(mx+Math.sin(r)*o,my-Math.cos(r)*o,str,s,{ang,size:fs})}
function shapeRings(m){const p=m.pts||[];if(!p.length)return null;
 if(['rect','text','redact'].includes(m.type)&&p.length>=2){const b=normBox(p[0],p[1]);return[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]]}
 if(m.type==='ellipse'&&p.length>=2){const b=normBox(p[0],p[1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,rx=(b[2]-b[0])/2,ry=(b[3]-b[1])/2;return[Array.from({length:72},(_,i)=>[cx+rx*Math.cos(i/72*Math.PI*2),cy+ry*Math.sin(i/72*Math.PI*2)])]}
 if(m.type==='circle'&&p.length>=2){const r=dist(p[0],p[1]);return[Array.from({length:72},(_,i)=>[p[0][0]+r*Math.cos(i/72*Math.PI*2),p[0][1]+r*Math.sin(i/72*Math.PI*2)])]}
 if(['polygon','area','perimeter','volume','space','cloud','cloudplus'].includes(m.type)&&p.length>=3)return[p,...(m.holes||[])];return null}
// clip a segment a→b against polygon rings (even-odd); returns inside sub-segments
function ptIn(pt,rings){let ins=false;for(const P of rings)for(let i=0,j=P.length-1;i<P.length;j=i++){if((P[i][1]>pt[1])!==(P[j][1]>pt[1])&&pt[0]<(P[j][0]-P[i][0])*(pt[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])ins=!ins}return ins}
function clipSeg(a,b,rings){const ts=[0,1],dx=b[0]-a[0],dy=b[1]-a[1];
 for(const P of rings)for(let i=0,j=P.length-1;i<P.length;j=i++){const ex=P[i][0]-P[j][0],ey=P[i][1]-P[j][1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;
  const t=((P[j][0]-a[0])*ey-(P[j][1]-a[1])*ex)/den,u=((P[j][0]-a[0])*dy-(P[j][1]-a[1])*dx)/den;if(t>0&&t<1&&u>=0&&u<1)ts.push(t)}
 ts.sort((x,y)=>x-y);const out=[];for(let i=0;i<ts.length-1;i++){const t0=ts[i],t1=ts[i+1];if(t1-t0<1e-6)continue;const mid=[a[0]+dx*(t0+t1)/2,a[1]+dy*(t0+t1)/2];if(ptIn(mid,rings))out.push([[a[0]+dx*t0,a[1]+dy*t0],[a[0]+dx*t1,a[1]+dy*t1]])}return out}
window.PMClip={clipSeg,ptIn};
function hatchLines(rings,ang,sp,keep){const b=ptsBox(rings.flat()),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,R=Math.hypot(b[2]-b[0],b[3]-b[1])/2+sp,c=Math.cos(ang),s=Math.sin(ang),segs=[];
 for(let k=-Math.ceil(R/sp),i=0;k<=Math.ceil(R/sp);k++,i++){if(keep&&!keep(i))continue;const ox=cx-s*k*sp,oy=cy+c*k*sp;segs.push(...clipSeg([ox-c*R,oy-s*R],[ox+c*R,oy+s*R],rings))}return segs}
function seeded(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function hatchSegs(m,rings){const st=m.style,sp=Math.max(1.5,+st.hatchSp||6),pat=st.hatch,D=Math.PI/180;let segs=[],dots=[];
 if(pat==='diag')segs=hatchLines(rings,-45*D,sp);else if(pat==='bdiag')segs=hatchLines(rings,45*D,sp);else if(pat==='cross')segs=[...hatchLines(rings,-45*D,sp),...hatchLines(rings,45*D,sp)];
 else if(pat==='horiz')segs=hatchLines(rings,0,sp);else if(pat==='vert')segs=hatchLines(rings,90*D,sp);else if(pat==='grid')segs=[...hatchLines(rings,0,sp),...hatchLines(rings,90*D,sp)];
 else if(pat==='earth')segs=hatchLines(rings,-45*D,sp/3,i=>i%4!==3);
 else if(pat==='brick'){const b=ptsBox(rings.flat());segs=hatchLines(rings,0,sp);for(let y=b[1]-sp,row=0;y<b[3];y+=sp,row++)for(let x=b[0]-2*sp+(row%2)*sp;x<b[2]+sp;x+=2*sp)segs.push(...clipSeg([x,y],[x,y+sp],rings))}
 else if(pat==='insul'){const b=ptsBox(rings.flat()),h=sp*1.5;for(let y=b[1];y<b[3];y+=h)for(let x=b[0]-h;x<b[2]+h;x+=h){segs.push(...clipSeg([x,y],[x+h/2,y+h],rings),...clipSeg([x+h/2,y+h],[x+h,y],rings))}}
 else if(pat==='dots'||pat==='concrete'){const b=ptsBox(rings.flat()),rnd=seeded([...String(m.id||'x')].reduce((a,c)=>a*31+c.charCodeAt(0),7));
  if(pat==='dots'){for(let y=b[1]+sp/2,row=0;y<b[3];y+=sp,row++)for(let x=b[0]+sp/2+(row%2)*sp/2;x<b[2];x+=sp)if(ptIn([x,y],rings))dots.push([x,y])}
  else{const area=(b[2]-b[0])*(b[3]-b[1]),n=Math.min(6000,Math.round(area/(sp*sp)*1.4));for(let i=0;i<n;i++){const x=b[0]+rnd()*(b[2]-b[0]),y=b[1]+rnd()*(b[3]-b[1]);if(!ptIn([x,y],rings))continue;
   if(rnd()<.22){const r=sp*.28,a=rnd()*Math.PI*2,tri=[0,1,2].map(j=>[x+r*Math.cos(a+j*2.094),y+r*Math.sin(a+j*2.094)]);for(let j=0;j<3;j++)segs.push(...clipSeg(tri[j],tri[(j+1)%3],rings))}else dots.push([x,y])}}}
 return{segs,dots}}
window.PMHatch={hatchSegs,shapeRings};
function countMarker(p,mk,r,s,fill,fo){const[x,y]=p,o=[];const poly=(pts,cl,ex={})=>o.push(P_(dPoly(pts,cl),s,Object.assign({fill:cl?fill:null,fo},ex)));
 switch(mk){case'circle':o.push(P_(dCircle(p,r),s,{fill,fo}));break;case'square':poly([[x-r,y-r],[x+r,y-r],[x+r,y+r],[x-r,y+r]],true);break;
 case'triangle':poly([[x,y-r*1.15],[x+r*1.05,y+r*.7],[x-r*1.05,y+r*.7]],true);break;case'diamond':poly([[x,y-r*1.2],[x+r*1.2,y],[x,y+r*1.2],[x-r*1.2,y]],true);break;
 case'check':poly([[x-r,y],[x-r*.25,y+r*.75],[x+r*1.1,y-r*.85]],false,{w:(s.width||1.5)*1.5});break;
 case'x':poly([[x-r,y-r],[x+r,y+r]],false,{w:(s.width||1.5)*1.5});poly([[x+r,y-r],[x-r,y+r]],false,{w:(s.width||1.5)*1.5});break;
 case'cross':poly([[x-r,y],[x+r,y]],false,{w:(s.width||1.5)*1.5});poly([[x,y-r],[x,y+r]],false,{w:(s.width||1.5)*1.5});break;
 case'star':poly(Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r*1.15;return[x+rr*Math.cos(a),y+rr*Math.sin(a)]}),true);break;
 default:if(mk&&mk.startsWith('sym:')&&H.symbolPrims){const fake={type:'symbol',sym:mk.slice(4),pts:[p],style:Object.assign({},s,{fontSize:r/.77,fill:s.fill&&s.fill!=='none'?'#ffffff':'#ffffff'}),text:''};
   H.symbolPrims(fake,o,(d,x2={})=>o.push(P_(d,fake.style,x2)),(xx,yy,str,e={})=>o.push(T_(xx,yy,str,fake.style,e)))}else o.push(P_(dCircle(p,r),s,{fill,fo}))}
 return o}
const _prims=prims;
prims=function(m){const s=m.style||{},pts=m.pts||[];let out;
 if(m.type==='arc'||m.type==='arclen'){out=[];if(pts.length<3)out.push(P_(dPoly(pts),s));else{const g=arcGeom(pts[0],pts[1],pts[2]);const ap=g?arcPts(g):pts;out.push(P_(dPoly(ap),s));
   if(m.type==='arclen'){const t=measLabel(m),mid=ap[Math.floor(ap.length/2)],c=g?g.c:centroid(pts),dx=mid[0]-c[0],dy=mid[1]-c[1],L=Math.hypot(dx,dy)||1,fs=s.fontSize||10;out.push(T_(mid[0]+dx/L*fs*1.1,mid[1]+dy/L*fs*1.1,t,s));
    for(const e of[ap[0],ap[ap.length-1]]){const ex=e[0]-(g?g.c[0]:0),ey=e[1]-(g?g.c[1]:0),el=Math.hypot(ex,ey)||1,t2=fs*.6;out.push(P_(dPoly([[e[0]-ex/el*t2,e[1]-ey/el*t2],[e[0]+ex/el*t2,e[1]+ey/el*t2]]),s))}}}}
 else if(m.type==='radius'){out=[];if(pts.length>=2){const[c,e]=pts,r=dist(c,e);out.push(P_(dCircle(c,r),s,{dash:'dash',w:Math.max(.5,(s.width||1)*.6)}),P_(dPoly([c,e]),s),P_(dCircle(c,Math.max(1,(s.fontSize||10)*.12)),s,{fill:s.stroke,fo:1}));out.push(alongT(c,e,measLabel(m),s))}}
 else if(m.type==='viewport'||m.type==='formfield'){out=pts.length>=2?[P_(dBox(normBox(pts[0],pts[1])),s,{dash:'dash',fill:m.type==='formfield'?'#2563eb':null,fo:.08})]:[]}
 else if(m.type==='vpcal'){out=pts.length>=2?[P_(dPoly(pts),s),T_((pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2-8,((dist(pts[0],pts[1]))/72).toFixed(2)+'" paper',s)]:[]}
 else if(m.type==='count'&&s.marker&&s.marker!=='default'){out=[];const r=(s.fontSize||8)*.7,fill=(s.fill&&s.fill!=='none')?s.fill:null,fo=s.fillOpacity??1;for(const p of pts)out.push(...countMarker(p,s.marker,r,s,fill,fo));
  if(pts.length)out.push(T_(pts[0][0]+r*1.3,pts[0][1]-r*1.5,(m.label?m.label+' ':'')+pts.length,s,{align:'start',size:(s.fontSize||8)*1.1}))}
 else out=_prims(m);
 // segment lengths
 if(s.segs&&['polylength','perimeter','area','volume'].includes(m.type)&&pts.length>=2){const sc=scaleOfMarkup(m),f=slopeFactor(s.slope),cl=m.type!=='polylength'&&pts.length>2,n=pts.length;
  for(let i=0;i<(cl?n:n-1);i++){const a=pts[i],b=pts[(i+1)%n];const L=dist(a,b);if(L*S.zoom<12&&!S.exporting)continue;out.push(alongT(a,b,fmtLen(L*sc.perPt*(m.type==='area'||m.type==='volume'?1:f),sc),s,.75))}}
 // hatch patterns (clipped to the shape — identical on screen and in exported PDFs)
 if(s.hatch&&s.hatch!=='none'){const rings=shapeRings(m);if(rings){const col=s.hatchColor||s.stroke,op=s.hatchOp??.8,hw=+s.hatchW||.6;
  if(s.hatch==='solid'){out.splice(1,0,{k:'p',d:rings.map(r=>dPoly(r,true)).join(' '),stroke:null,w:0,so:1,fill:col,fo:op})}
  else{const{segs,dots}=hatchSegs(m,rings);const hp=[];if(segs.length)hp.push({k:'p',d:segs.map(q=>'M'+P2(q[0])+' L'+P2(q[1])).join(' '),stroke:col,w:hw,so:op,fill:null,fo:1,dash:''});
   if(dots.length){const rr=Math.max(.35,(+s.hatchSp||6)*.07);hp.push({k:'p',d:dots.map(q=>dCircle(q,rr)).join(' '),stroke:null,w:0,so:1,fill:col,fo:op})}out.splice(Math.min(1,out.length),0,...hp)}}}
 return out};
const _handlesOf=handlesOf;handlesOf=function(m){if(m.locked)return[];return _handlesOf(m)};

/* =====================================================================================
   4. Finishing special tools (viewport, viewport calibration, form field)
   ===================================================================================== */
const _finish=finishDrawing;
finishDrawing=function(){const d=S.drawing;if(d&&['viewport','vpcal','formfield'].includes(d.type)){S.drawing=null;hideFinish();$('#live').textContent='';redrawPage(d.page);const pts=d.pts.filter(Boolean);
  if(pts.length<2||dist(pts[0],pts[1])*S.zoom<4)return;
  if(d.type==='viewport'){setTool('select');vpDialog(d.page,normBox(pts[0],pts[1]))}
  else if(d.type==='vpcal'){setTool('select');vpCalDialog(dist(pts[0],pts[1]))}
  else{setTool('select');fieldDialog(d.page,normBox(pts[0],pts[1]))}return}
 return _finish.apply(this,arguments)};

/* =====================================================================================
   5. Sketch to Scale — type a length (and angle) while drawing
   ===================================================================================== */
const SKETCH=['line','arrow','polyline','polygon','rect','length','polylength','area','perimeter','volume','dimension','cloud','space'];
let lastMouse={x:innerWidth/2,y:innerHeight/2};addEventListener('pointermove',e=>{lastMouse={x:e.clientX,y:e.clientY}},{passive:true});
function parseLen(str,sc){str=String(str||'').trim().toLowerCase().replace(/′/g,"'").replace(/″/g,'"');if(!str)return NaN;let m;
 if((m=str.match(/^(-?\d+(?:\.\d+)?)\s*'\s*-?\s*(?:(\d+(?:\.\d+)?)?(?:\s*(\d+)\s*\/\s*(\d+))?\s*(?:"|in)?)?$/)))return((+m[1])*12+(+m[2]||0)+(m[3]?(+m[3])/(+m[4]||1):0))*0.0254;
 if((m=str.match(/^(\d+(?:\.\d+)?)?(?:\s*(\d+)\s*\/\s*(\d+))?\s*(?:"|in)$/))&&(m[1]||m[2]))return((+m[1]||0)+(m[2]?(+m[2])/(+m[3]||1):0))*0.0254;
 if((m=str.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|ft|yd|in)$/))){const f={mm:.001,cm:.01,m:1,ft:.3048,yd:.9144,in:.0254}[m[2]];return(+m[1])*f}
 if((m=str.match(/^-?\d+(?:\.\d+)?$/))){const u=sc.unit==='ftin'?'ft':sc.unit;return(+str)*(u==='ft'?.3048:UNITS[u].m)}return NaN}
window.parseLen=parseLen;
function sketchEligible(){const d=S.drawing;if(!d||!SKETCH.includes(d.type)||!d.pts.length)return false;const k=T[d.type].kind;return k==='multi'||(k==='drag'&&d.clickMode)}
function curDir(d){const last=d.pts[T[d.type].kind==='multi'?d.pts.length-1:0],c=T[d.type].kind==='multi'?d.cursor:d.pts[1];if(c&&dist(c,last)>0.5)return Math.atan2(c[1]-last[1],c[0]-last[0]);return 0}
function openSketch(first){let box=$('#pmSketch');if(box)box.remove();const d=S.drawing,isRect=d.type==='rect';
 box=document.createElement('div');box.id='pmSketch';box.style.cssText=`position:fixed;left:${Math.min(lastMouse.x+14,innerWidth-250)}px;top:${Math.min(lastMouse.y+14,innerHeight-90)}px;z-index:65;background:var(--panel);border:1px solid var(--acc);border-radius:8px;padding:8px;display:flex;gap:6px;align-items:flex-end;box-shadow:0 8px 24px rgba(0,0,0,.4)`;
 const ang=Math.round(-curDir(d)*180/Math.PI*10)/10;
 box.innerHTML=`<div><label style="font-size:10px;color:var(--mut)">${isRect?'Width x Height':'Length'}</label><input class="ti" id="skL" style="width:${isRect?150:110}px" placeholder="${isRect?"20' x 12'":"12'6\" or 3.2m"}"></div>${isRect?'':`<div><label style="font-size:10px;color:var(--mut)">Angle °</label><input class="ti" id="skA" style="width:62px" value="${ang}"></div>`}<button class="btn pri" id="skGo" style="height:28px">↵</button>`;
 document.body.appendChild(box);const L=$('#skL');L.value=first||'';L.focus();L.setSelectionRange(L.value.length,L.value.length);
 const go=()=>{applySketch($('#skL').value,$('#skA')?$('#skA').value:'');};
 box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();go()}if(e.key==='Escape'){e.preventDefault();box.remove()}});$('#skGo').onclick=go}
function applySketch(lenStr,angStr){const d=S.drawing,box=$('#pmSketch');if(!d){if(box)box.remove();return}
 const base=T[d.type].kind==='multi'?d.pts[d.pts.length-1]:d.pts[0],sc=vpScaleAt(d.page,d.pts[0])||scaleFor(d.page);
 if(d.type==='rect'){const mm=String(lenStr).split(/\s*[x×*]\s*/i);if(mm.length!==2){toast('Type width x height, e.g. 20\' x 12\'');return}const w=parseLen(mm[0],sc),h=parseLen(mm[1],sc);if(!(w>0&&h>0)){toast("Couldn't read those sizes");return}
  const c=d.pts[1]||base,sx=c[0]>=base[0]?1:-1,sy=c[1]>=base[1]?1:-1;d.pts[1]=[base[0]+sx*w/sc.perPt,base[1]+sy*h/sc.perPt];if(box)box.remove();finishDrawing();return}
 const meters=parseLen(lenStr,sc);if(!(meters>0)){toast("Couldn't read that length");return}
 let a=angStr!==''&&angStr!=null&&isFinite(+angStr)?-(+angStr)*Math.PI/180:curDir(d);const Lpt=meters/sc.perPt,np=[base[0]+Math.cos(a)*Lpt,base[1]+Math.sin(a)*Lpt];
 if(box)box.remove();
 if(T[d.type].kind==='multi'){d.pts.push(np);d.cursor=null;redrawPage(d.page);liveMeasure();showFinish()}else{d.pts[1]=np;finishDrawing()}}
document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(modalCb||e.ctrlKey||e.metaKey||e.altKey)return;
 if(/^[0-9.]$/.test(e.key)&&sketchEligible()){e.preventDefault();e.stopImmediatePropagation();openSketch(e.key)}},true);
window.PMSketch={applySketch,openSketch,parseLen};

/* =====================================================================================
   6. Properties panel additions
   ===================================================================================== */
const MARKERS=[['default','Circle + check'],['circle','Circle'],['square','Square'],['triangle','Triangle'],['diamond','Diamond'],['check','Check'],['x','X'],['cross','Cross'],['star','Star']];
const HATCHES=[['none','None'],['solid','Solid'],['diag','Diagonal'],['bdiag','Back diagonal'],['cross','Cross-hatch'],['horiz','Horizontal'],['vert','Vertical'],['grid','Grid'],['dots','Dots'],['brick','Brick'],['concrete','Concrete'],['insul','Insulation'],['earth','Earth']];
H.props.push((m,mode,type)=>{const t=T[type];if(!t)return'';const st=m?m.style:toolStyle(type);let h='';const sel=v=>v;
 const opt=(arr,cur)=>arr.map(([v,l])=>`<option value="${v}" ${String(cur??'')===v?'selected':''}>${l}</option>`).join('');
 if(m&&m.locked)h+=`<div class="meas"><b style="font-size:13px;color:#fbbf24">🔒 Locked</b><small>Can't be moved or reshaped.</small><label class="chk" style="margin-top:4px"><input type="checkbox" data-mpl checked> Locked</label></div>`;
 if(['length','polylength','dimension','perimeter','area','arclen'].includes(type)){h+=`<div class="sec">Measurement options</div><div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Slope / pitch</label><input class="ti" data-mp="slope" placeholder="6/12, 30°, 25%" value="${esc(st.slope||'')}"></div>`;
  if(['length','polylength','dimension'].includes(type)){const sc=m?scaleOfMarkup(m):scaleFor(S.cur),u=lenUnit(sc);h+=`<div><label style="font-size:11px;color:var(--mut)">Rise / drop (${u})</label><input class="ti" type="number" step="any" data-mp="rise" data-ru="${u}" value="${st.rise||''}" placeholder="0"></div>`}h+='</div>';
  if(['polylength','perimeter','area'].includes(type))h+=`<label class="chk fld"><input type="checkbox" data-mp="segs" ${st.segs?'checked':''}> Show segment lengths</label>`}
 if(t.meas&&t.meas!=='angle')h+=`<div class="fld"><label>Caption <small style="color:var(--mut)">{value} {subject} {label} {area} {perimeter} {volume} {count} {depth} {plan}</small></label><input class="ti" data-mp="caption" placeholder="default" value="${esc(st.caption||'')}"></div>`;
 if(type==='count'){const sy=window.PMToolbox?Object.entries(PMToolbox.SYM).map(([k,v])=>['sym:'+k,'Symbol: '+v.name]):[];h+=`<div class="fld"><label>Marker</label><select class="ti" data-mp="marker">${opt([...MARKERS,...sy],st.marker||'default')}</select></div>`}
 if(t.closed||['rect','ellipse','circle','text'].includes(type)){if(type!=='image'&&type!=='viewport'&&type!=='formfield'){h+=`<div class="sec">Hatch</div><div class="row fld"><div style="flex:2"><select class="ti" data-mp="hatch">${opt(HATCHES,st.hatch||'none')}</select></div><div><input type="color" data-mp="hatchColor" value="${st.hatchColor||st.stroke||'#000000'}"></div></div>`;
  if(st.hatch&&st.hatch!=='none')h+=`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Spacing (pt)</label><input class="ti" type="number" min="1.5" step="0.5" data-mp="hatchSp" value="${st.hatchSp||6}"></div><div><label style="font-size:11px;color:var(--mut)">Line (pt)</label><input class="ti" type="number" min="0.1" step="0.1" data-mp="hatchW" value="${st.hatchW||.6}"></div><div><label style="font-size:11px;color:var(--mut)">Opacity</label><input class="ti" type="number" min="0.05" max="1" step="0.05" data-mp="hatchOp" value="${st.hatchOp??.8}"></div></div>`}}
 if(m&&mode==='sel'){const fs=m.files||[];h+=`<div class="sec">Attachments (${fs.length})</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">${fs.map((f,i)=>`<div style="position:relative;width:64px" title="${esc(f.name)}"><div data-mpfile="${i}" style="cursor:pointer;width:64px;height:52px;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--bg);display:flex;align-items:center;justify-content:center">${/^image\//.test(f.type)?`<img src="${f.dataUrl}" style="max-width:100%;max-height:100%">`:`<span style="font-size:10px;color:var(--mut);padding:2px;text-align:center;word-break:break-all">${esc(f.name.slice(0,18))}</span>`}</div><span data-mpfx="${i}" style="position:absolute;top:-6px;right:-6px;background:#7f1d1d;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span></div>`).join('')}</div>
  <div class="row" style="gap:6px"><button class="btn" data-mpact="attach" style="border:1px solid var(--line)">📎 Attach photo / file…</button>${!m.locked?'<button class="btn" data-mpact="lock" style="border:1px solid var(--line)">🔒 Lock</button>':''}</div>`}
 return h});
let mpUndo=false;
function setMp(key,val){const sel=[...S.sel].map(byId).filter(Boolean);
 if(sel.length){if(!mpUndo){pushUndo();mpUndo=true}for(const m of sel){m.style[key]=val;if(key==='rise'){const el=$('#props [data-mp=rise]');m.style.riseUnit=el?el.dataset.ru:'ft'}m.modified=Date.now()}
  new Set(sel.map(m=>m.page)).forEach(redrawPage);updMeasBox();hook('change');clearTimeout(lT);lT=setTimeout(renderList,250);clearTimeout(sT);sT=setTimeout(()=>LS.set(S.fileKey,{markups:S.markups,scales:S.scales}),400)}
 else if(S.defaults[S.tool]){(S.chestStyle||S.defaults[S.tool])[key]=val;if(key==='rise'){const el=$('#props [data-mp=rise]');(S.chestStyle||S.defaults[S.tool]).riseUnit=el?el.dataset.ru:'ft'}if(!S.chestStyle)LS.set('pm:defaults',S.defaults)}}
H.ready.push(()=>{const pr=$('#props');
 pr.addEventListener('input',e=>{const k=e.target.dataset.mp;if(!k)return;let v=e.target.type==='checkbox'?e.target.checked:e.target.value;if(['hatchSp','hatchW','hatchOp','rise'].includes(k))v=+v;setMp(k,v)});
 pr.addEventListener('change',e=>{mpUndo=false;if(e.target.dataset.mp==='hatch'||e.target.dataset.mp==='marker')renderProps();if(e.target.matches('[data-mpl]')){const m=byId([...S.sel][0]);if(m){pushUndo();m.locked=e.target.checked;commit();renderProps()}}});
 pr.addEventListener('click',async e=>{const m=byId([...S.sel][0]);if(!m)return;const a=e.target.closest('[data-mpact]');
  if(a&&a.dataset.mpact==='attach')attachFiles(m);if(a&&a.dataset.mpact==='lock'){pushUndo();m.locked=true;commit();renderProps()}
  const x=e.target.closest('[data-mpfx]');if(x){pushUndo();m.files.splice(+x.dataset.mpfx,1);commit();renderProps();return}
  const f=e.target.closest('[data-mpfile]');if(f)viewFile(m,+f.dataset.mpfile)})});

/* =====================================================================================
   7. Capture — photos & files attached to markups
   ===================================================================================== */
function readURL(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
async function shrinkImage(url,max=1600){const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
 const c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82)}
function attachFiles(m){const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';i.onchange=async()=>{const add=[];
 for(const f of i.files){if(f.size>15e6){toast(f.name+' is over 15 MB — skipped');continue}let url=await readURL(f),type=f.type||'application/octet-stream',name=f.name;if(/^image\//.test(type)&&!/svg/.test(type)){url=await shrinkImage(url);type='image/jpeg';name=name.replace(/\.\w+$/,'')+'.jpg'}add.push({name,type,dataUrl:url,added:Date.now()})}
 if(!add.length)return;pushUndo();m.files=(m.files||[]).concat(add);m.modified=Date.now();commit();renderProps();const tot=S.markups.reduce((s,x)=>s+(x.files||[]).reduce((a,f)=>a+f.dataUrl.length,0),0);
 toast(`Attached ${add.length} file${add.length>1?'s':''}`+(tot>3e6?' — large attachments: save the PDF to keep them safe':''))};i.click()}
window.PMCapture={attachFiles};
function viewFile(m,i){const f=m.files[i];if(!f)return;
 modal(f.name,/^image\//.test(f.type)?`<img src="${f.dataUrl}" style="max-width:100%;border-radius:6px">`:`<div class="hint">${esc(f.type)} · ${Math.round(f.dataUrl.length*.75/1024)} KB</div>`,
 [{label:'Save file',fn:()=>{const b64=f.dataUrl.split(',')[1],bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));saveFile(f.name,new Blob([bytes],{type:f.type}));return false}},{label:'Close',pri:1,cancel:1}])}
H.over.push(n=>{let h='';const k=1/S.zoom;for(const m of S.markups){if(m.page!==n||!(m.files&&m.files.length))continue;const b=bboxOf(m),x=b[2]+2*k,y=b[1]-14*k;
 h+=`<g transform="translate(${x} ${y}) scale(${k})" pointer-events="none"><circle cx="7" cy="7" r="8" fill="#1f2937" opacity=".85"/><path d="M9.5 5l-4 4a1.4 1.4 0 002 2l4.3-4.3a2.6 2.6 0 00-3.7-3.7L3.8 7.3" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><text x="16" y="11" font-size="9" fill="#1f2937" font-family="Helvetica,Arial" font-weight="bold">${m.files.length}</text></g>`}return h});
H.exportPage.push(async(doc)=>{for(const m of S.markups)for(const f of(m.files||[])){try{const b64=f.dataUrl.split(',')[1],bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await doc.attach(bytes,f.name,{mimeType:f.type,description:`Attached to "${m.subject}" on page ${m.page}`})}catch(e){console.warn(e)}}});

/* =====================================================================================
   8. Locking (signatures and anything the user locks)
   ===================================================================================== */
H.down=(prev=>(e,p,pt)=>{if(S.tool==='image'&&p&&(sigPending||snapPending)&&S.imageSrc){const w=snapPending?snapPending.w:200,h=snapPending?snapPending.h:200*(S.imageAR||1);snapPending=null;
  const m=newMarkup('image',p.num,[pt,[pt[0]+w,pt[1]+h]],toolStyle('image'));m.img=S.imageSrc;if(!m.locked)m.subject=m.subject==='Image'?'Snapshot':m.subject;pushUndo();S.markups.push(m);afterCreate(m);return true}
 if(S.tool==='pan'&&p&&!(e.target.closest&&e.target.closest('.mk'))){const f=fieldAt(p.num,pt);if(f){editField(f);return true}} // form fields can be filled with the default Pan tool too
 if(S.tool==='select'&&p){const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);if(m&&m.locked){if(e.shiftKey||e.ctrlKey||e.metaKey)toggleSel(m.id);else setSel([m.id]);return true}
  if(!mk&&!(e.target.closest&&e.target.closest('[data-h]'))&&!/corner|Align overlay|Auto-label/.test($('#hint').textContent)){const f=fieldAt(p.num,pt);if(f){editField(f);return true}}}
 return prev?prev(e,p,pt):false})(H.down);

/* =====================================================================================
   9. Forms — fill existing AcroForm fields, create new ones, auto-detect blanks
   ===================================================================================== */
/* Forms moved to js/forms3.js (fill, create, properties, calculations, actions, data import/export, JavaScript, scripts).
   These shims keep the drawing tools and page clicks above working with it. */
let formShow=ls('pm:formshow',true);
const F3=()=>window.PMForms||{};
function fieldAt(pg,pt){return F3().fieldAt?F3().fieldAt(pg,pt):null}
function editField(f){if(F3().editField)F3().editField(f)}
function fieldDialog(pg,box,c){if(F3().fieldDialog)F3().fieldDialog(pg,box,c)}

/* =====================================================================================
   10. Signatures & seals (visual; certificate signing is out of scope)
   ===================================================================================== */
const sigs=()=>ls('pm:sigs',[]);
function trimCanvas(c){const x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
 for(let y=0;y<c.height;y++)for(let i=0;i<c.width;i++){if(d[(y*c.width+i)*4+3]>8){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;if(y>y1)y1=y}}if(x1<0)return null;
 const pad=4,w=x1-x0+1+pad*2,h=y1-y0+1+pad*2,o=document.createElement('canvas'),k=Math.min(1,700/w);o.width=Math.round(w*k);o.height=Math.round(h*k);o.getContext('2d').drawImage(c,x0-pad,y0-pad,w,h,0,0,o.width,o.height);return o}
function sealCanvas(name,lic,state,color){const c=document.createElement('canvas'),R=260;c.width=c.height=R*2+20;const x=c.getContext('2d'),cx=R+10,cy=R+10;x.strokeStyle=x.fillStyle=color;x.lineWidth=6;
 x.beginPath();x.arc(cx,cy,R,0,Math.PI*2);x.stroke();x.lineWidth=3;x.beginPath();x.arc(cx,cy,R*.72,0,Math.PI*2);x.stroke();
 const ring=(txt,r,top)=>{x.save();x.font='bold 34px Helvetica, Arial, sans-serif';x.textAlign='center';x.textBaseline='middle';const chars=[...txt],span=Math.min(Math.PI*.95,chars.length*.11),st=(top?-Math.PI/2:Math.PI/2)-(top?span/2:-span/2);
  chars.forEach((ch,i)=>{const a=st+(top?1:-1)*span*(i+.5)/chars.length;x.save();x.translate(cx+r*Math.cos(a),cy+r*Math.sin(a));x.rotate(a+(top?Math.PI/2:-Math.PI/2));x.fillText(ch,0,0);x.restore()});x.restore()};
 ring(String(name||'').toUpperCase(),R*.86,true);ring(String(state||'').toUpperCase(),R*.86,false);x.font='bold 40px Helvetica, Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('No. '+(lic||''),cx,cy);
 x.font='26px Helvetica, Arial';x.fillText('LICENSED',cx,cy-52);x.fillText('PROFESSIONAL',cx,cy+52);return c}
function sigManager(){const list=sigs();
 modal('Signatures & seals',`<div class="hint" style="margin-bottom:8px">Visual signatures and seals placed on the drawing. (Certificate-based digital signing isn't supported.)</div>
 <div id="sgList" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">${list.map((s,i)=>`<div style="border:1px solid var(--line);border-radius:8px;padding:6px;background:#fff;position:relative"><img src="${s.dataUrl}" style="max-width:100%;max-height:60px;display:block;margin:auto"><div style="font-size:11px;color:#374151;text-align:center">${esc(s.name)} · ${s.kind}</div>
  <div class="row" style="gap:4px;margin-top:4px"><button class="btn pri" data-sgp="${i}" style="height:24px;font-size:11px">Place</button><button class="btn" data-sgx="${i}" style="height:24px;font-size:11px;color:#b91c1c;border:1px solid #fca5a5">✕</button></div></div>`).join('')||'<div class="hint">No signatures saved yet.</div>'}</div>
 <label class="chk fld"><input type="checkbox" id="sgDate" checked> Add date under the signature</label>
 <div class="sec">Create</div><div class="row" style="gap:4px;margin-bottom:6px"><button class="btn" data-sgt="draw" style="border:1px solid var(--line)">Draw</button><button class="btn" data-sgt="type" style="border:1px solid var(--line)">Type</button><button class="btn" data-sgt="upload" style="border:1px solid var(--line)">Upload</button><button class="btn" data-sgt="seal" style="border:1px solid var(--line)">Seal</button></div>
 <div id="sgMk"></div><div class="sec">Batch Sign & Seal</div><div class="row" style="gap:6px"><button class="btn" id="sgBatch" style="border:1px solid var(--line)" ${list.length?'':'disabled'}>Place on many pages…</button></div>`,[{label:'Close',cancel:1}]);
 const md=$('#modal');md.onclick=e=>{const p=e.target.closest('[data-sgp]');if(p){const s=sigs()[+p.dataset.sgp];const date=$('#sgDate').checked;closeModal();placeSig(s,date);return}
  const x=e.target.closest('[data-sgx]');if(x){const L=sigs();L.splice(+x.dataset.sgx,1);LS.set('pm:sigs',L);sigManager();return}
  const t=e.target.closest('[data-sgt]');if(t)sigMaker(t.dataset.sgt);if(e.target.id==='sgBatch')batchSign()}}
function saveSig(c,name,kind){const t=trimCanvas(c);if(!t){toast('Nothing to save');return}const L=sigs();L.push({id:uid(),name:name||'Signature',kind,dataUrl:t.toDataURL('image/png'),w:t.width,h:t.height});LS.set('pm:sigs',L);toast('Saved');sigManager()}
function sigMaker(kind){const box=$('#sgMk');if(!box)return;
 if(kind==='draw'){box.innerHTML=`<canvas id="sgPad" width="520" height="170" style="width:100%;background:#fff;border-radius:6px;touch-action:none;cursor:crosshair"></canvas><div class="row" style="gap:6px;margin-top:6px"><input class="ti" id="sgN" placeholder="Name" value="${esc(settings.author||'')}"><button class="btn" id="sgClr" style="flex:0;border:1px solid var(--line)">Clear</button><button class="btn pri" id="sgSv" style="flex:0">Save</button></div>`;
  const c=$('#sgPad'),x=c.getContext('2d');x.lineWidth=2.6;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#0b1f5c';let drawing=false,last=null;
  const pos=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
  c.onpointerdown=e=>{drawing=true;last=pos(e);c.setPointerCapture(e.pointerId)};c.onpointermove=e=>{if(!drawing)return;const p=pos(e);x.beginPath();x.moveTo(...last);x.quadraticCurveTo(last[0],last[1],(last[0]+p[0])/2,(last[1]+p[1])/2);x.lineTo(...p);x.stroke();last=p};c.onpointerup=()=>{drawing=false};
  $('#sgClr').onclick=()=>x.clearRect(0,0,c.width,c.height);$('#sgSv').onclick=()=>saveSig(c,$('#sgN').value,'signature')}
 else if(kind==='type'){box.innerHTML=`<div class="row" style="gap:6px"><input class="ti" id="sgN" value="${esc(settings.author||'')}" placeholder="Your name"><button class="btn pri" id="sgSv" style="flex:0">Save</button></div><canvas id="sgPrev" width="620" height="130" style="width:100%;background:#fff;border-radius:6px;margin-top:6px"></canvas>`;
  const draw=()=>{const c=$('#sgPrev'),x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.fillStyle='#0b1f5c';x.font='italic 64px "Brush Script MT","Segoe Script","Lucida Handwriting","Apple Chancery",cursive';x.textBaseline='middle';x.fillText($('#sgN').value||'',16,65)};draw();$('#sgN').oninput=draw;$('#sgSv').onclick=()=>saveSig($('#sgPrev'),$('#sgN').value,'signature')}
 else if(kind==='upload'){box.innerHTML=`<input type="file" class="ti" id="sgF" accept="image/png,image/jpeg"><label class="chk" style="margin:6px 0"><input type="checkbox" id="sgW" checked> Remove white background</label><div class="row" style="gap:6px"><input class="ti" id="sgN" placeholder="Name"><select class="ti" id="sgK"><option value="signature">Signature</option><option value="seal">Seal</option></select><button class="btn pri" id="sgSv" style="flex:0">Save</button></div>`;
  $('#sgSv').onclick=async()=>{const f=$('#sgF').files[0];if(!f)return toast('Choose an image');const url=await readURL(f),im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=url});const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');x.drawImage(im,0,0);
   if($('#sgW').checked){const id=x.getImageData(0,0,c.width,c.height),d=id.data;for(let i=0;i<d.length;i+=4){const l=(d[i]+d[i+1]+d[i+2])/3;if(l>225)d[i+3]=0;else if(l>180)d[i+3]=Math.round(255*(225-l)/45)}x.putImageData(id,0,0)}saveSig(c,$('#sgN').value||f.name.replace(/\.\w+$/,''),$('#sgK').value)}}
 else if(kind==='seal'){box.innerHTML=`<div class="row fld"><input class="ti" id="slN" placeholder="Name" value="${esc(settings.author||'')}"><input class="ti" id="slL" placeholder="License no."></div><div class="row fld"><input class="ti" id="slS" placeholder="State / title" value="New Jersey"><input type="color" id="slC" value="#1e3a8a" style="flex:0 0 60px"><button class="btn pri" id="sgSv" style="flex:0">Save seal</button></div>`;
  $('#sgSv').onclick=()=>saveSig(sealCanvas($('#slN').value,$('#slL').value,$('#slS').value,$('#slC').value),($('#slN').value||'Seal')+' seal','seal')}}
let sigPending=null,snapPending=null;
function placeSig(s,date){S.imageSrc=s.dataUrl;S.imageAR=s.h/s.w;sigPending={s,date};setTool('image');toast('Click where the '+(s.kind==='seal'?'seal':'signature')+' goes')}
const _newMarkup=newMarkup;newMarkup=function(type,page,pts,style){const m=_newMarkup.apply(this,arguments);
 if(type==='image'&&sigPending){const s=sigPending.s;m.subject=s.kind==='seal'?'Seal':'Signature';m.label=s.name;m.locked=true;m.sigDate=sigPending.date;
  if(dist(pts[0],pts[1])<1e-6||Math.abs((pts[1][0]-pts[0][0])-200)<1e-6){const w=s.kind==='seal'?110:150;m.pts=[pts[0],[pts[0][0]+w,pts[0][1]+w*(s.h/s.w)]]}}return m};
const _afterCreate=afterCreate;afterCreate=function(m){const r=_afterCreate.apply(this,arguments);
 if(m.type==='image'&&sigPending){const p=sigPending;sigPending=null;if(p.date&&p.s.kind!=='seal'){const b=normBox(m.pts[0],m.pts[1]);const t=newMarkup('typewriter',m.page,[[b[0],b[3]+2]],Object.assign({},S.defaults.typewriter,{fontSize:9,stroke:'#1f2937',color:'#1f2937'}));t.text='Signed '+new Date().toLocaleDateString();t.subject='Signature date';t.locked=true;S.markups.push(t);commit()}}return r};
function batchSign(){const L=sigs();const ref=byId([...S.sel][0]);const hasRef=ref&&ref.type==='image';
 modal('Batch Sign & Seal',`<div class="fld"><label>Signature / seal</label><select class="ti" id="bsS">${L.map((s,i)=>`<option value="${i}">${esc(s.name)} (${s.kind})</option>`).join('')}</select></div>
 <div class="fld"><label>Position</label><select class="ti" id="bsP">${hasRef?'<option value="ref">Same spot as the selected image</option>':''}<option value="br">Bottom right (title block)</option><option value="bl">Bottom left</option><option value="tr">Top right</option><option value="c">Center</option></select></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Width (pt)</label><input class="ti" type="number" id="bsW" value="${hasRef?Math.round(Math.abs(ref.pts[1][0]-ref.pts[0][0])):140}"></div><div><label style="font-size:11px;color:var(--mut)">Pages</label><input class="ti" id="bsR" value="all"></div></div>
 <label class="chk"><input type="checkbox" id="bsD" checked> Add date (signatures)</label>`,
 [{label:'Cancel',cancel:1},{label:'Place',pri:1,fn:md=>{const s=L[+md.querySelector('#bsS').value];if(!s)return false;const pos=md.querySelector('#bsP').value,w=Math.max(10,+md.querySelector('#bsW').value||140),h=w*s.h/s.w,v=md.querySelector('#bsR').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v),date=md.querySelector('#bsD').checked;
  if(!pages.length){toast('Enter pages');return false}pushUndo();let n=0;
  for(const pg of pages){const P=S.pages[pg-1];let x,y;if(pos==='ref'){const b=normBox(ref.pts[0],ref.pts[1]);x=b[0];y=b[1]}else{const ins=36;x=pos==='bl'?ins:pos==='c'?P.w/2-w/2:P.w-ins-w;y=pos==='tr'?ins:pos==='c'?P.h/2-h/2:P.h-ins-h-(date?14:0)}
   if(pos==='ref'&&pg===ref.page)continue;const m=_newMarkup('image',pg,[[x,y],[x+w,y+h]],Object.assign({},S.defaults.image));m.img=s.dataUrl;m.subject=s.kind==='seal'?'Seal':'Signature';m.label=s.name;m.locked=true;S.markups.push(m);n++;
   if(date&&s.kind!=='seal'){const t=_newMarkup('typewriter',pg,[[x,y+h+2]],Object.assign({},S.defaults.typewriter,{fontSize:9,stroke:'#1f2937',color:'#1f2937'}));t.text='Signed '+new Date().toLocaleDateString();t.subject='Signature date';t.locked=true;S.markups.push(t)}}
  commit();toast(`Placed on ${n} page${n===1?'':'s'}`)}}])}
H.ribbon.push({label:'Sign',title:'Signatures, seals and Batch Sign & Seal',icon:'<path d="M3 17c3-1 4-8 6-8s0 7 2 7 3-4 4-4 1 3 3 3"/><path d="M3 21h18"/>',fn:sigManager});
window.PMSign={sigManager,placeSig,batchSign,sealCanvas,saveSig};

/* =====================================================================================
   11. Snapshot — copy a region (page + markups) as an image
   ===================================================================================== */
async function primsToCanvas(ctx,list){for(const p of list){if(p.k==='p'){let path;try{path=new Path2D(p.d)}catch(e){continue}
  if(p.fill){ctx.globalAlpha=(p.fo??1)*(p.so??1);ctx.fillStyle=p.fill;ctx.fill(path,'evenodd')}if(p.stroke&&p.w>0){ctx.globalAlpha=p.so??1;ctx.strokeStyle=p.stroke;ctx.lineWidth=p.w;ctx.lineJoin=ctx.lineCap='round';const da=p.dash&&window.dashArr?dashArr(p):null;ctx.setLineDash(da||[]);ctx.stroke(path);ctx.setLineDash([])}}
 else if(p.k==='t'){ctx.save();ctx.globalAlpha=p.o??1;ctx.translate(p.x,p.y);if(p.ang)ctx.rotate(p.ang*Math.PI/180);ctx.font=`${p.italic?'italic ':''}${p.bold?'bold ':''}${p.size}px ${(typeof FONTS!=='undefined'&&FONTS[p.font])||'Helvetica,Arial,sans-serif'}`;ctx.textAlign=p.align==='middle'?'center':'left';ctx.textBaseline='middle';
  if(p.halo){ctx.strokeStyle='#fff';ctx.lineWidth=p.size*.28;ctx.lineJoin='round';ctx.strokeText(p.s,0,0)}ctx.fillStyle=p.color;ctx.fillText(p.s,0,0);ctx.restore()}
 else if(p.k==='img'&&p.src){const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=p.src});if(im){ctx.globalAlpha=p.o??1;ctx.drawImage(im,p.b[0],p.b[1],p.b[2]-p.b[0],p.b[3]-p.b[1])}}}ctx.globalAlpha=1}
async function renderRegion(pg,box,k){const page=await S.pdf.getPage(pg),W=Math.max(1,Math.round((box[2]-box[0])*k)),Hh=Math.max(1,Math.round((box[3]-box[1])*k)),vp=page.getViewport({scale:k,offsetX:-box[0]*k,offsetY:-box[1]*k});
 const c=document.createElement('canvas');c.width=W;c.height=Hh;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,Hh);await page.render({canvasContext:ctx,viewport:vp}).promise;
 ctx.save();ctx.setTransform(k,0,0,k,-box[0]*k,-box[1]*k);for(const m of S.markups)if(m.page===pg&&!m.hidden)await primsToCanvas(ctx,prims(m));ctx.restore();return c}
window.PMSnapshot={renderRegion};
async function snapshot(){if(!S.pages.length)return toast('Open a PDF first');const r=await PMAuto.pickRegion('Snapshot: pick the area to capture');const b=r.box;if(b[2]-b[0]<3||b[3]-b[1]<3)return toast('Area too small');
 const k=Math.min(4,Math.sqrt(16e6/((b[2]-b[0])*(b[3]-b[1]))));const c=await renderRegion(r.page,b,k);const url=c.toDataURL('image/png');
 modal('Snapshot',`<img src="${url}" style="max-width:100%;max-height:50vh;border:1px solid var(--line);border-radius:6px;background:#fff"><div class="hint" style="margin-top:6px">${c.width} × ${c.height} px</div>`,
 [{label:'Copy',fn:()=>{c.toBlob(async bl=>{try{await navigator.clipboard.write([new ClipboardItem({'image/png':bl})]);toast('Copied — paste into email, Word, Excel…')}catch(e){toast("Copying images isn't allowed here — use Save PNG")}},'image/png');return false}},
  {label:'Save PNG',fn:()=>{c.toBlob(bl=>saveFile(baseName()+'-snapshot.png',bl),'image/png');return false}},
  {label:'Paste as image markup',pri:1,fn:()=>{S.imageSrc=url;S.imageAR=c.height/c.width;snapPending={w:(b[2]-b[0]),h:(b[3]-b[1])};setTool('image');toast('Click where to place the snapshot')}}])}
H.ribbon.push({label:'Snapshot',title:'Copy a region of the sheet as an image',icon:'<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><circle cx="12" cy="12" r="3"/>',fn:snapshot});
window.PMSnap2={snapshot};
const _export=exportPDF;exportPDF=async function(){S.exporting=true;try{return await _export.apply(this,arguments)}finally{S.exporting=false}};

/* =====================================================================================
   12. Measurements panel: viewports list & angle snap setting
   ===================================================================================== */
function vpSection(){const L=vpList(S.cur);return`<div id="mpVP"><div class="sec">Viewports on page ${S.cur}</div>
 ${L.map((v,i)=>`<div class="res" style="display:flex;justify-content:space-between;gap:6px"><span><b style="font-weight:600">${esc(v.name)}</b><br><small style="color:var(--mut)">${esc(v.scale.label)}</small></span><span><a href="#" data-vpe="${i}" style="color:#7dd3fc">Edit</a> · <a href="#" data-vpd="${i}" style="color:#fca5a5">Delete</a></span></div>`).join('')||'<div class="hint">None. Add one where a detail is drawn at a different scale.</div>'}
 <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn" data-vpadd style="border:1px solid var(--line)">+ Viewport</button><label class="chk"><input type="checkbox" data-vpshow ${vpShow?'checked':''}> Show outlines</label></div>
 <div class="row fld" style="margin-top:8px"><label style="font-size:11px;color:var(--mut);flex:2">Shift angle snap</label><select class="ti" data-angsnap>${[5,10,15,22.5,30,45,90].map(a=>`<option ${a===angleStep?'selected':''}>${a}</option>`).join('')}</select></div>
 <div class="hint">While drawing, type a length (e.g. 12'6" or 3.2m) to place the next point exactly.</div></div>`}
H.ready.push(()=>{const pane=$('#pane-measure');if(!pane)return;const ensure=()=>{if(!S.pages.length)return;if(!$('#mpVP',pane))pane.insertAdjacentHTML('beforeend',vpSection())};
 new MutationObserver(()=>ensure()).observe(pane,{childList:true});ensure();
 pane.addEventListener('click',e=>{const ed=e.target.closest('[data-vpe]'),dl=e.target.closest('[data-vpd]');if(ed||dl)e.preventDefault();
  if(ed){const v=vpList(S.cur)[+ed.dataset.vpe];if(v)vpDialog(S.cur,v.box,v)}if(dl){S.scales.vp[S.cur].splice(+dl.dataset.vpd,1);saveScales();commit();const s=$('#mpVP');if(s)s.remove();ensure()}
  if(e.target.closest('[data-vpadd]')){setTool('viewport');toast('Drag a box around the detail')}});
 pane.addEventListener('change',e=>{if(e.target.matches('[data-vpshow]')){vpShow=e.target.checked;LS.set('pm:vpshow',vpShow);redrawAll()}if(e.target.matches('[data-angsnap]')){angleStep=+e.target.value;LS.set('pm:anglesnap',angleStep)}});
 H.change.push(()=>{const s=$('#mpVP');if(s){s.remove();ensure()}});
 H.prefs.push(()=>{vpShow=ls('pm:vpshow',true);angleStep=ls('pm:anglesnap',45);formShow=ls('pm:formshow',true);redrawAll()})});
})();
