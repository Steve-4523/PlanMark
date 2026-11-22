/* PlanMark — CAD & BIM viewer (view only).
   DWG via LibreDWG (GPL-3.0, WebAssembly), DXF via LibreDWG with dxf-parser (MIT) fallback,
   IFC (Revit / any BIM export) via web-ifc (MPL-2.0) + three.js (MIT).
   All libraries live in lib/cad/ and load only when a CAD/BIM file is opened. */
(function(){
const BASE=()=>new URL('lib/cad/',location.href).href;
const ACI_HEX='000000ff0000ffff0000ff0000ffff0000ffff00ffffffff808080c0c0c0ff0000ff7f7fcc0000cc6666990000994c4c7f00007f3f3f4c00004c2626ff3f00ff9f7fcc3300cc7f66992600995f4c7f1f007f4f3f4c13004c2f26ff7f00ffbf7fcc6600cc9966994c0099724c7f3f007f5f3f4c26004c3926ffbf00ffdf7fcc9900ccb26699720099854c7f5f007f6f3f4c39004c4226ffff00ffff7fcccc00cccc6698980098984c7f7f007f7f3f4c4c004c4c26bfff00dfff7f99cc00b2cc6672980085984c5f7f006f7f3f394c00424c267fff00bfff7f66cc0099cc664c980072984c3f7f005f7f3f264c00394c263fff009fff7f33cc007fcc662698005f984c1f7f004f7f3f134c002f4c2600ff007fff7f00cc0066cc660098004c984c007f003f7f3f004c00264c2600ff3f7fff9f00cc3366cc7f0098264c985f007f1f3f7f4f004c13264c2f00ff7f7fffbf00cc6666cc9900984c4c9872007f3f3f7f5f004c26264c3900ffbf7fffdf00cc9966ccb20098724c9885007f5f3f7f6f004c39264c4200ffff7fffff00cccc66cccc0098984c9898007f7f3f7f7f004c4c264c4c00bfff7fdfff0099cc66b2cc0072984c8598005f7f3f6f7f00394c26424c007fff7fbfff0066cc6699cc004c984c7298003f7f3f5f7f00264c26394c003fff7f9fff0033cc667fcc0026984c5f98001f7f3f4f7f00134c262f4c0000ff7f7fff0000cc6666cc0000984c4c9800007f3f3f7f00004c26264c3f00ff9f7fff3300cc7f66cc2600985f4c981f007f4f3f7f13004c2f264c7f00ffbf7fff6600cc9966cc4c0098724c983f007f5f3f7f26004c39264cbf00ffdf7fff9900ccb266cc720098854c985f007f6f3f7f39004c42264cff00ffff7fffcc00cccc66cc980098984c987f007f7f3f7f4c004c4c264cff00bfff7fdfcc0099cc66b2980072984c857f005f7f3f6f4c00394c2642ff007fff7fbfcc0066cc669998004c984c727f003f7f3f5f4c00264c2639ff003fff7f9fcc0033cc667f980026984c5f7f001f7f3f4f4c00134c262f3333335b5b5b848484adadadd6d6d6ffffff';
const aci=i=>'#'+ACI_HEX.substr((i|0)*6,6);
const UNITS={0:['units',null],1:['in',0.0254],2:['ft',0.3048],3:['mi',1609.344],4:['mm',0.001],5:['cm',0.01],6:['m',1],7:['km',1000],8:['µin',2.54e-8],9:['mil',2.54e-5],10:['yd',0.9144],11:['Å',1e-10],12:['nm',1e-9],13:['µm',1e-6],14:['dm',0.1],15:['dam',10],16:['hm',100],17:['Gm',1e9],18:['AU',1.496e11],19:['ly',9.461e15],20:['pc',3.086e16]};
const CAD={docs:[],cur:null,seq:1,visible:false};
const tick=()=>new Promise(r=>setTimeout(r,0));
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
let libP=null,threeP=null,ifcP=null;
function getLibreDwg(){if(!libP)libP=(async()=>{const m=await import(BASE()+'libredwg/dist/libredwg-web.js');const lib=await m.LibreDwg.create(BASE()+'libredwg/wasm');return{lib,FT:m.Dwg_File_Type}})().catch(e=>{libP=null;throw e});return libP}
function getThree(){if(!threeP)threeP=Promise.all([import(BASE()+'three.module.min.js'),import(BASE()+'OrbitControls.js')]).then(([T,O])=>({THREE:T,OrbitControls:O.OrbitControls})).catch(e=>{threeP=null;throw e});return threeP}
function getIfc(){if(!ifcP)ifcP=(async()=>{const W=await import(BASE()+'web-ifc/web-ifc-api.js');const api=new W.IfcAPI();api.SetWasmPath(BASE()+'web-ifc/',true);await api.Init(undefined,true);return{W,api}})().catch(e=>{ifcP=null;throw e});return ifcP}
/* =====================================================================
   2D: read DWG / DXF into one normalized document
   ===================================================================== */
async function readCad(bytes,name){const ext=name.split('.').pop().toLowerCase();
 if(ext==='dwg'){const{lib,FT}=await getLibreDwg();let dwg=null;try{dwg=lib.dwg_read_data(bytes,FT.DWG)}catch(e){}
  if(!dwg)throw new Error('This DWG version could not be read. In AutoCAD, use Save As → DXF (or an older DWG version) and open that instead.');
  const db=lib.convert(dwg);try{lib.dwg_free(dwg)}catch(e){}const d=fromLibre(db,'DWG');if(!d.layouts.some(l=>l.ents.some(e=>e.type!=='VIEWPORT')))throw new Error('No drawing content could be read from this DWG (it may be damaged, encrypted or a newer version). In AutoCAD, use Save As → DXF and open that instead.');return d}
 // DXF: LibreDWG first (handles hatches, layouts), dxf-parser as fallback
 try{const{lib,FT}=await getLibreDwg();const dwg=lib.dwg_read_data(bytes,FT.DXF);if(dwg){const db=lib.convert(dwg);try{lib.dwg_free(dwg)}catch(e){}const d=fromLibre(db,'DXF');const miss=d.layouts[0].ents.some(e=>(e.type==='INSERT'||e.type==='DIMENSION'&&e.name)&&!d.blocks[e.name]);if(!miss&&d.layouts.some(l=>l.ents.length))return d}}catch(e){console.warn('libredwg dxf',e)}
 if(!window.DxfParser)await loadScript(BASE()+'dxf-parser.js');const txt=new TextDecoder().decode(bytes);let d;try{d=new DxfParser().parseSync(txt)}catch(e){throw new Error('This DXF file could not be read: '+e.message)}const doc=fromDxfParser(d);try{const ln=txt.split(/\r?\n/);let inL=false,cur=null;for(let i=0;i+1<ln.length;i+=2){const c=ln[i].trim(),v=ln[i+1].trim();if(c==='0'){if(v==='LAYER'){inL=true;cur={}}else{if(cur&&cur.n&&cur.lt&&doc.layers.get(cur.n))doc.layers.get(cur.n).ltype=cur.lt;cur=null;if(v==='ENDTAB')inL=false;if(v==='ENDSEC'&&inL)break}}else if(inL&&cur){if(c==='2')cur.n=v;if(c==='6')cur.lt=v}}}catch(e){}return doc}
function layerColor(ci,c){if(ci>=1&&ci<=255)return aci(ci);if(typeof c==='number'&&c>=0&&c<=0xffffff)return'#'+c.toString(16).padStart(6,'0');return'#ffffff'}
function fromLibre(db,fmt){const doc={fmt,layers:new Map(),ltypes:{},blocks:{},blocksByHandle:{},layouts:[],units:(db.header&&db.header.INSUNITS)||0,ltscale:(db.header&&db.header.LTSCALE)||1};
 for(const l of (db.tables.LAYER&&db.tables.LAYER.entries)||[])doc.layers.set(l.name,{name:l.name,col:layerColor(Math.abs(l.colorIndex),l.color),on:!(l.off||l.colorIndex<0),frozen:!!l.frozen,ltype:l.lineType||'Continuous'});
 for(const t of (db.tables.LTYPE&&db.tables.LTYPE.entries)||[]){const p=(t.pattern||[]).map(x=>typeof x==='number'?x:(x.elementLength!=null?x.elementLength:x.length)).filter(v=>typeof v==='number');if(p.length)doc.ltypes[t.name.toUpperCase()]=p}
 const brs=(db.tables.BLOCK_RECORD&&db.tables.BLOCK_RECORD.entries)||[];
 for(const b of brs){const blk={name:b.name,base:b.basePoint||{x:0,y:0},ents:b.entities||[],handle:b.handle};doc.blocks[b.name]=blk;doc.blocksByHandle[b.handle]=blk}
 const lays=((db.objects&&db.objects.LAYOUT)||[]).slice().sort((a,b)=>(a.tabOrder||0)-(b.tabOrder||0));
 const modelBR=brs.find(b=>/^\*model_space$/i.test(b.name));
 let modelEnts=modelBR&&modelBR.entities&&modelBR.entities.length?modelBR.entities:(modelBR?db.entities.filter(e=>e.ownerBlockRecordSoftId===modelBR.handle):db.entities);
 if(!modelEnts.length&&db.entities.length)modelEnts=db.entities.filter(e=>!brs.some(b=>b!==modelBR&&!/^\*paper_space/i.test(b.name)&&b.handle===e.ownerBlockRecordSoftId));
 doc.layouts.push({name:'Model',paper:false,ents:modelEnts});
 for(const L of lays){if(/^model$/i.test(L.layoutName))continue;const br=doc.blocksByHandle[L.paperSpaceTableId];if(!br)continue;const ents=br.ents.length?br.ents:db.entities.filter(e=>e.ownerBlockRecordSoftId===br.handle);
  doc.layouts.push({name:L.layoutName,paper:true,ents,limits:[L.minLimit,L.maxLimit]})}
 return doc}
function fromDxfParser(d){const doc={fmt:'DXF',layers:new Map(),ltypes:{},blocks:{},blocksByHandle:{},layouts:[],units:(d.header&&d.header.$INSUNITS)||0,ltscale:(d.header&&d.header.$LTSCALE)||1};
 const L=(d.tables&&d.tables.layer&&d.tables.layer.layers)||{};for(const k in L){const l=L[k];doc.layers.set(k,{name:k,col:layerColor(l.colorIndex,l.color),on:l.visible!==false,frozen:!!l.frozen,ltype:l.lineType||'CONTINUOUS'})}
 const LT=(d.tables&&d.tables.lineType&&d.tables.lineType.lineTypes)||{};for(const k in LT)if(LT[k].pattern&&LT[k].pattern.length)doc.ltypes[k.toUpperCase()]=LT[k].pattern;
 const R=Math.PI/180,P=v=>v?{x:v.x||0,y:v.y||0}:{x:0,y:0};
 const conv=e=>{const b={type:e.type,layer:e.layer||'0',colorIndex:e.colorIndex!=null?e.colorIndex:256,lineType:e.lineType||'',lineTypeScale:e.lineTypeScale||1,handle:e.handle,isVisible:e.visible!==false};
  switch(e.type){case'LINE':return Object.assign(b,{startPoint:P(e.vertices[0]),endPoint:P(e.vertices[1])});
   case'LWPOLYLINE':case'POLYLINE':return Object.assign(b,{type:'LWPOLYLINE',vertices:(e.vertices||[]).map(v=>({x:v.x,y:v.y,bulge:v.bulge||0})),flag:e.shape?1:0});
   case'CIRCLE':return Object.assign(b,{center:P(e.center),radius:e.radius});
   case'ARC':return Object.assign(b,{center:P(e.center),radius:e.radius,startAngle:e.startAngle,endAngle:e.endAngle});
   case'ELLIPSE':return Object.assign(b,{center:P(e.center),majorAxisEndPoint:P(e.majorAxisEndPoint),axisRatio:e.axisRatio,startAngle:e.startAngle,endAngle:e.endAngle});
   case'TEXT':case'ATTRIB':return Object.assign(b,{type:'TEXT',text:e.text,startPoint:P(e.startPoint),endPoint:P(e.endPoint),textHeight:e.textHeight,rotation:(e.rotation||0)*R,halign:e.halign||0,valign:e.valign||0});
   case'MTEXT':return Object.assign(b,{insertionPoint:P(e.position),textHeight:e.height,rectWidth:e.width,text:e.text,rotation:(e.rotation||0)*R,attachmentPoint:e.attachmentPoint||1});
   case'INSERT':return Object.assign(b,{name:e.name,insertionPoint:P(e.position),xScale:e.xScale||1,yScale:e.yScale||1,rotation:(e.rotation||0)*R,columnCount:e.columnCount||1,rowCount:e.rowCount||1,columnSpacing:e.columnSpacing||0,rowSpacing:e.rowSpacing||0});
   case'DIMENSION':return Object.assign(b,{name:e.block});
   case'SPLINE':return Object.assign(b,{controlPoints:(e.controlPoints||[]).map(P),fitPoints:(e.fitPoints||[]).map(P),knots:e.knotValues||[],degree:e.degreeOfSplineCurve||3,flag:e.closed?1:0});
   case'SOLID':case'3DFACE':{const v=(e.points||e.vertices||[]).map(P);return Object.assign(b,{type:'SOLID',corner1:v[0],corner2:v[1],corner3:v[2]||v[1],corner4:v[3]||v[2]||v[1]})}
   case'POINT':return Object.assign(b,{position:P(e.position)});
  }return null};
 const cl=a=>(a||[]).map(conv).filter(Boolean);
 for(const k in d.blocks||{}){const B=d.blocks[k];const blk={name:k,base:P(B.position),ents:cl(B.entities)};doc.blocks[k]=blk}
 const all=d.entities||[];doc.layouts.push({name:'Model',paper:false,ents:cl(all.filter(e=>!e.inPaperSpace))});const ps=cl(all.filter(e=>e.inPaperSpace));if(ps.length)doc.layouts.push({name:'Layout1',paper:true,ents:ps});
 return doc}
/* ---------- geometry helpers ---------- */
const mul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
const ap=(M,x,y)=>[M[0]*x+M[2]*y+M[4],M[1]*x+M[3]*y+M[5]];
const I=[1,0,0,1,0,0];
function arcPts(cx,cy,r,a0,a1,ccw=true){if(!ccw){[a0,a1]=[a1,a0]}while(a1<=a0)a1+=Math.PI*2;const n=Math.max(8,Math.min(180,Math.ceil((a1-a0)/(Math.PI/36))));const o=[];for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n;o.push(cx+r*Math.cos(t),cy+r*Math.sin(t))}if(!ccw){const r2=[];for(let i=o.length-2;i>=0;i-=2)r2.push(o[i],o[i+1]);return r2}return o}
function bulgePts(x0,y0,x1,y1,b){if(!b)return[x1,y1];const th=4*Math.atan(b),d=Math.hypot(x1-x0,y1-y0);if(d<1e-12)return[x1,y1];const r=d/(2*Math.sin(th/2)),mx=(x0+x1)/2,my=(y0+y1)/2,h=r*Math.cos(th/2);
 const nx=-(y1-y0)/d,ny=(x1-x0)/d,cx=mx+nx*h*Math.sign(b)*Math.sign(r),cy=my+ny*h*Math.sign(b)*Math.sign(r);
 const R=Math.abs(r),a0=Math.atan2(y0-cy,x0-cx),n=Math.max(4,Math.ceil(Math.abs(th)/(Math.PI/36))),o=[];for(let i=1;i<=n;i++){const t=a0+th*i/n;o.push(cx+R*Math.cos(t),cy+R*Math.sin(t))}o[o.length-2]=x1;o[o.length-1]=y1;return o}
function deBoor(ctrl,knots,deg,n){const m=ctrl.length;if(m<2)return[];let k=knots&&knots.length===m+deg+1?knots:null;if(!k){k=[];for(let i=0;i<=m+deg;i++)k.push(i<=deg?0:i>=m?m-deg:i-deg)}
 const lo=k[deg],hi=k[m],o=[];for(let s=0;s<=n;s++){let u=lo+(hi-lo)*s/n;if(u>=hi)u=hi-1e-9;let span=deg;while(span<m-1&&u>=k[span+1])span++;const dx=[],dy=[];for(let j=0;j<=deg;j++){const c=ctrl[span-deg+j]||ctrl[ctrl.length-1];dx.push(c.x);dy.push(c.y)}
  for(let r=1;r<=deg;r++)for(let j=deg;j>=r;j--){const i=span-deg+j,den=k[i+deg-r+1]-k[i];const a=den?(u-k[i])/den:0;dx[j]=(1-a)*dx[j-1]+a*dx[j];dy[j]=(1-a)*dy[j-1]+a*dy[j]}o.push(dx[deg],dy[deg])}return o}
function catmull(p,closed){const o=[];const n=p.length;if(n<2)return[];const get=i=>closed?p[(i+n)%n]:p[Math.max(0,Math.min(n-1,i))];const segs=closed?n:n-1;
 for(let i=0;i<segs;i++){const p0=get(i-1),p1=get(i),p2=get(i+1),p3=get(i+2);for(let t=0;t<(i===segs-1?1.0001:1);t+=1/12){const t2=t*t,t3=t2*t;o.push(.5*(2*p1.x+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),.5*(2*p1.y+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3))}}return o}
function cleanMText(s){return String(s||'').replace(/\\P/g,'\n').replace(/\\[Ll]|\\[Oo]|\\[Kk]/g,'').replace(/\\[ACFHQTWfcp][^;\\]*;/g,'').replace(/\\S([^;^#\/]*)[\^#\/]([^;]*);/g,'$1/$2').replace(/\\~/g,' ').replace(/\\\\/g,'\\').replace(/[{}]/g,'').replace(/%%[cC]/g,'Ø').replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±')}
/* ---------- compile a layout into display primitives (world coords) ---------- */
function compile(doc,ents){const out=[];const lt=(name,layer,blk)=>{let n=(name||'').toUpperCase();if(!n||n==='BYLAYER'){const L=doc.layers.get(layer);n=(L&&L.ltype||'').toUpperCase()}else if(n==='BYBLOCK')n=(blk&&blk.lt||'').toUpperCase();return doc.ltypes[n]||null};
 const push=(p,M,top,path)=>{p.top=top;p.path=path;p.bb=bbOf(p);out.push(p)};
 function emit(e,M,blk,top,path,depth){if(!e||e.isVisible===false||depth>24)return;top=top||e;
  const layer=(e.layer==='0'&&blk)?blk.layer:(e.layer||'0');const L=doc.layers.get(layer);
  const ci=e.colorIndex;let col=ci===0?(blk?blk.col:'BL'):(ci>=1&&ci<=255)?aci(ci):'BL';if(col==='BL')col=L?L.col:'#ffffff';
  const dash=lt(e.lineType,layer,blk),ds=dash?(e.lineTypeScale||1)*(doc.ltscale||1)*Math.max(Math.abs(M[0]),Math.abs(M[1])):1;
  const P=(arr,closed,extra)=>{const pts=new Float64Array(arr.length);for(let i=0;i<arr.length;i+=2){const q=ap(M,arr[i],arr[i+1]);pts[i]=q[0];pts[i+1]=q[1]}push(Object.assign({k:'pl',pts,closed:!!closed,L:layer,col,dash:dash?dash.map(v=>v*ds):null},extra||{}),M,top,path)};
  const T=(x,y,h,rot,s,ha,va,extra)=>{const q=ap(M,x,y),sc=Math.hypot(M[0],M[1]),r=rot+Math.atan2(M[1],M[0]);push(Object.assign({k:'tx',x:q[0],y:q[1],h:h*sc,rot:r,s,ha:ha||0,va:va||0,L:layer,col},extra||{}),M,top,path)};
  const ocs=e.extrusionDirection&&e.extrusionDirection.z<-0.5;const MX=ocs?mul(M,[-1,0,0,1,0,0]):M;
  switch(e.type){
  case'LINE':P([e.startPoint.x,e.startPoint.y,e.endPoint.x,e.endPoint.y]);break;
  case'XLINE':case'RAY':break;
  case'CIRCLE':{const c=e.center,o=arcPts(c.x,c.y,e.radius,0,Math.PI*2);const Ms=M;M=MX;P(o,true,{cen:ap(MX,c.x,c.y),rad:e.radius*Math.hypot(MX[0],MX[1])});M=Ms;break}
  case'ARC':{const c=e.center;const Ms=M;M=MX;P(arcPts(c.x,c.y,e.radius,e.startAngle,e.endAngle),false,{cen:ap(MX,c.x,c.y)});M=Ms;break}
  case'ELLIPSE':{const c=e.center,mj=e.majorAxisEndPoint,r=e.axisRatio||1,ma=Math.atan2(mj.y,mj.x),a=Math.hypot(mj.x,mj.y),b=a*r;let t0=e.startAngle||0,t1=e.endAngle||Math.PI*2;while(t1<=t0)t1+=Math.PI*2;const n=Math.max(16,Math.ceil((t1-t0)/(Math.PI/45))),o=[];
   for(let i=0;i<=n;i++){const t=t0+(t1-t0)*i/n,x=a*Math.cos(t),y=b*Math.sin(t);o.push(c.x+x*Math.cos(ma)-y*Math.sin(ma),c.y+x*Math.sin(ma)+y*Math.cos(ma))}const Ms=M;M=MX;P(o,Math.abs(t1-t0-Math.PI*2)<1e-6,{cen:ap(MX,c.x,c.y)});M=Ms;break}
  case'LWPOLYLINE':case'POLYLINE2D':case'POLYLINE3D':case'POLYLINE':{const v=(e.vertices||[]).filter(q=>!(q.flag&16));if(v.length<2)break;const closed=!!((e.flag||0)&1);const o=[v[0].x,v[0].y];
   for(let i=0;i<v.length-1+(closed?1:0);i++){const a=v[i],b=v[(i+1)%v.length];o.push(...bulgePts(a.x,a.y,b.x,b.y,a.bulge||0))}if(closed){o.pop();o.pop()}const Ms=M;M=MX;P(o,closed);M=Ms;break}
  case'SPLINE':{let o=[];const cp=e.controlPoints||[];if(cp.length>1)o=deBoor(cp,e.knots,Math.max(1,Math.min(e.degree||3,cp.length-1)),Math.max(32,cp.length*12));else if((e.fitPoints||[]).length>1)o=catmull(e.fitPoints,!!(e.flag&1));if(o.length)P(o,false);break}
  case'TEXT':case'ATTRIB':{const t=e.type==='ATTRIB'&&e.text&&typeof e.text==='object'?e.text:e;if(!t.text)break;const al=(t.halign||t.valign)&&t.endPoint&&(t.endPoint.x||t.endPoint.y)?t.endPoint:t.startPoint;T(al.x,al.y,t.textHeight||1,t.rotation||0,cleanMText(t.text),t.halign||0,t.valign||0);break}
  case'MTEXT':{const p=e.insertionPoint||{x:0,y:0};const rot=e.direction&&(e.direction.x||e.direction.y)?Math.atan2(e.direction.y,e.direction.x):(e.rotation||0);T(p.x,p.y,e.textHeight||1,rot,cleanMText(e.text),0,0,{mt:e.attachmentPoint||1,w:e.rectWidth||0});break}
  case'INSERT':{const b=doc.blocks[e.name];if(!b)break;const ip=e.insertionPoint||{x:0,y:0},sx=e.xScale||1,sy=e.yScale||1,r=e.rotation||0,cs=Math.cos(r),sn=Math.sin(r);
   const nc=Math.max(1,e.columnCount||1),nr=Math.max(1,e.rowCount||1);const sub={layer,col,lt:(lt(e.lineType,layer,blk)?(e.lineType||''):(doc.layers.get(layer)||{}).ltype)};
   for(let ri=0;ri<nr;ri++)for(let ci2=0;ci2<nc;ci2++){const ox=ci2*(e.columnSpacing||0),oy=ri*(e.rowSpacing||0);
    const Mi=mul(MX,[cs,sn,-sn,cs,ip.x,ip.y]);const Mj=mul(Mi,[sx,0,0,sy,0,0]);const Mk=mul(Mj,[1,0,0,1,ox/sx-b.base.x,oy/sy-b.base.y]);
    for(const s of b.ents){if(s.type==='ATTDEF')continue;emit(s,Mk,sub,top===e?e:top,path.concat(e.name),depth+1)}}
   for(const a of e.attribs||[])emit(a,M,blk,top,path,depth+1);break}
  case'DIMENSION':{const b=doc.blocks[e.name];if(b){const sub={layer,col};for(const s of b.ents)emit(s,M,sub,top,path.concat(e.name),depth+1)}else if(e.subDefinitionPoint1&&e.subDefinitionPoint2){P([e.subDefinitionPoint1.x,e.subDefinitionPoint1.y,e.subDefinitionPoint2.x,e.subDefinitionPoint2.y]);if(e.textPoint)T(e.textPoint.x,e.textPoint.y,2.5,0,e.text||String(+(e.measurement||0).toFixed(2)),1,2)}break}
  case'ACAD_TABLE':{const b=doc.blocksByHandle[e.blockRecordHandle];if(b){const sub={layer,col};for(const s of b.ents)emit(s,M,sub,top,path.concat(b.name),depth+1)}break}
  case'HATCH':{const rings=[];for(const bp of e.boundaryPaths||[]){const o=[];
    if(bp.edges&&bp.edges.length){for(const ed of bp.edges){if(ed.type===1){if(!o.length)o.push(ed.start.x,ed.start.y);o.push(ed.end.x,ed.end.y)}
      else if(ed.type===2){const pts=arcPts(ed.center.x,ed.center.y,ed.radius,ed.startAngle,ed.endAngle,ed.isCCW!==false&&ed.isCCW!==0);o.push(...pts)}
      else if(ed.type===3){const mj=ed.end||ed.majorAxisEndPoint||{x:1,y:0},a=Math.hypot(mj.x,mj.y),b=a*(ed.lengthOfMinorAxis||ed.axisRatio||1),ma=Math.atan2(mj.y,mj.x);let t0=ed.startAngle||0,t1=ed.endAngle||Math.PI*2;if(ed.isCCW===false||ed.isCCW===0){[t0,t1]=[-t1,-t0]}while(t1<=t0)t1+=Math.PI*2;for(let i=0;i<=24;i++){const t=t0+(t1-t0)*i/24,x=a*Math.cos(t),y=b*Math.sin(t);o.push(ed.center.x+x*Math.cos(ma)-y*Math.sin(ma),ed.center.y+x*Math.sin(ma)+y*Math.cos(ma))}}
      else if(ed.type===4){const cp=ed.controlPoints||[];if(cp.length>1)o.push(...deBoor(cp,ed.knots,ed.degree||3,24))}}}
    else if(bp.vertices&&bp.vertices.length){const v=bp.vertices;o.push(v[0].x,v[0].y);for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];o.push(...bulgePts(a.x,a.y,b.x,b.y,a.bulge||0))}}
    if(o.length>=6){const r=new Float64Array(o.length);for(let i=0;i<o.length;i+=2){const q=ap(MX,o[i],o[i+1]);r[i]=q[0];r[i+1]=q[1]}rings.push(r)}}
   if(rings.length)push({k:'fill',rings,solid:!!e.solidFill,pat:e.patternName||'',L:layer,col},M,top,path);break}
  case'SOLID':case'TRACE':case'3DFACE':{const c=[e.corner1,e.corner2,e.corner4||e.corner3,e.corner3].filter(Boolean);if(e.type==='3DFACE'){const q=[e.corner1,e.corner2,e.corner3,e.corner4].filter(Boolean);P(q.flatMap(p=>[p.x,p.y]),true);break}
   const r=new Float64Array(c.length*2);c.forEach((p,i)=>{const q=ap(MX,p.x,p.y);r[i*2]=q[0];r[i*2+1]=q[1]});push({k:'fill',rings:[r],solid:true,L:layer,col},M,top,path);break}
  case'POINT':{const p=e.position||e.point;if(p)push({k:'pt',x:ap(M,p.x,p.y)[0],y:ap(M,p.x,p.y)[1],L:layer,col},M,top,path);break}
  case'MLINE':{const vs=e.vertices||[];const nl=e.numberOfLines||((vs[0]&&vs[0].lines)||[]).length;for(let li=0;li<nl;li++){const o=[];for(const v of vs){const off=(v.lines&&v.lines[li]&&v.lines[li].segmentParams&&v.lines[li].segmentParams[0])||0,md=v.miterDirection||{x:0,y:0};o.push(v.vertex.x+md.x*off,v.vertex.y+md.y*off)}if(o.length>=4)P(o,!!((e.flags||0)&2))}break}
  case'MULTILEADER':case'MLEADER':{const cd=e.contextData||e;for(const sec of cd.leaderSections||[]){for(const ln of sec.leaderLines||[]){const o=[];for(const v of ln.vertices||[])o.push(v.x,v.y);if(sec.lastLeaderLinePoint)o.push(sec.lastLeaderLinePoint.x,sec.lastLeaderLinePoint.y);if(o.length>=4)P(o,false,{arrow:1})}
    if(sec.lastLeaderLinePoint&&sec.doglegVector&&sec.doglegLength){const p=sec.lastLeaderLinePoint;P([p.x,p.y,p.x+sec.doglegVector.x*sec.doglegLength,p.y+sec.doglegVector.y*sec.doglegLength])}}
   if(cd.textAnchor&&cd.textContent&&cd.hasMText!==false)T(cd.textAnchor.x,cd.textAnchor.y,cd.textHeight||2.5,cd.textRotation||0,cleanMText(cd.textContent),0,0,{mt:1});break}
  case'LEADER':{const v=e.vertices||[];if(v.length>1)P(v.flatMap(p=>[p.x,p.y]),false,{arrow:1});break}
  case'VIEWPORT':{if((e.viewportId||0)<=1||!e.width)break;const c=e.viewportCenter,w=e.width/2,h=e.height/2;push({k:'vp',x0:c.x-w,y0:c.y-h,x1:c.x+w,y1:c.y+h,vc:e.displayCenter||e.viewCenter||{x:0,y:0},vh:e.viewHeight||e.height,twist:e.viewTwistAngle||0,L:layer,col:'#888888'},M,top,path);break}
  default:break}}
 for(const e of ents)emit(e,I,null,null,[],0);
 return out}
function bbOf(p){if(p.k==='pl'){let a=1e300,b=1e300,c=-1e300,d=-1e300;const s=p.pts;for(let i=0;i<s.length;i+=2){const x=s[i],y=s[i+1];if(x<a)a=x;if(y<b)b=y;if(x>c)c=x;if(y>d)d=y}return[a,b,c,d]}
 if(p.k==='fill'){let a=1e300,b=1e300,c=-1e300,d=-1e300;for(const s of p.rings)for(let i=0;i<s.length;i+=2){const x=s[i],y=s[i+1];if(x<a)a=x;if(y<b)b=y;if(x>c)c=x;if(y>d)d=y}return[a,b,c,d]}
 if(p.k==='tx'){const lines=p.s.split('\n'),w=Math.max(...lines.map(l=>l.length))*p.h*.6,h=lines.length*p.h*1.3;return[p.x-w,p.y-h,p.x+w,p.y+h]}
 if(p.k==='vp')return[p.x0,p.y0,p.x1,p.y1];return[p.x,p.y,p.x,p.y]}
function extents(prims,doc){const bs=[];for(const p of prims){if(p.k==='tx'&&prims.length>3)continue;if(p.k==='vp')continue;const L=doc.layers.get(p.L);if(L&&(L.frozen||!L.on))continue;const q=p.bb;if(!isFinite(q[0])||!isFinite(q[3])||Math.abs(q[0])>1e12||Math.abs(q[2])>1e12||Math.abs(q[1])>1e12||Math.abs(q[3])>1e12)continue;bs.push(q)}
 if(!bs.length)return[0,0,100,100];
 // robust: ignore stray objects far outside where the bulk of the drawing is
 if(bs.length>=8){const cx=bs.map(q=>(q[0]+q[2])/2).sort((a,b)=>a-b),cy=bs.map(q=>(q[1]+q[3])/2).sort((a,b)=>a-b),pc=(a,f)=>a[Math.min(a.length-1,Math.max(0,Math.round((a.length-1)*f)))];
  const x0=pc(cx,.05),x1=pc(cx,.95),y0=pc(cy,.05),y1=pc(cy,.95),rx=Math.max(x1-x0,y1-y0,1e-9);
  const f=bs.filter(q=>(q[0]+q[2])/2>=x0-rx*1.5&&(q[0]+q[2])/2<=x1+rx*1.5&&(q[1]+q[3])/2>=y0-rx*1.5&&(q[1]+q[3])/2<=y1+rx*1.5&&(q[2]-q[0])<rx*6&&(q[3]-q[1])<rx*6);if(f.length>=bs.length*.8)bs.splice(0,bs.length,...f)}
 let a=1e300,b=1e300,c=-1e300,d=-1e300;for(const q of bs){if(q[0]<a)a=q[0];if(q[1]<b)b=q[1];if(q[2]>c)c=q[2];if(q[3]>d)d=q[3]}
 if(c-a<1e-9){a-=1;c+=1}if(d-b<1e-9){b-=1;d+=1}return[a,b,c,d]}
/* =====================================================================
   UI shell: CAD pane + document chips on the tab bar
   ===================================================================== */
const css=`#cadPane{display:none;flex:1;min-height:0;flex-direction:column;background:var(--bg);position:relative}
#cadPane.on{display:flex}#cadPane.abs{position:absolute;inset:0;z-index:25}
.cadBar{display:flex;align-items:center;gap:3px;padding:4px 6px;background:var(--panel);border-bottom:1px solid var(--line);overflow-x:auto;flex-shrink:0}
.cadBar .btn{height:28px;border:1px solid var(--line);padding:0 8px;font-size:12px}.cadBar .btn.on{background:var(--accbg);border-color:var(--acc)}
.cadBody{flex:1;display:flex;min-height:0}.cadSide{width:240px;background:var(--panel);border-right:1px solid var(--line);overflow:auto;padding:8px;flex-shrink:0;font-size:12px}
.cadSide.r{border-right:0;border-left:1px solid var(--line)}.cadView{flex:1;position:relative;min-width:0;overflow:hidden;touch-action:none}
.cadView canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.cadStat{display:flex;gap:12px;padding:3px 10px;font-size:11.5px;color:var(--mut);background:#15181d;border-top:1px solid var(--line);white-space:nowrap;overflow:hidden}
.cadLay{display:flex;align-items:center;gap:6px;padding:3px 2px;cursor:pointer}.cadLay .sw{width:12px;height:12px;border-radius:2px;border:1px solid rgba(255,255,255,.3);flex-shrink:0}.cadLay .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cadTabs{display:flex;gap:2px;padding:0 6px;background:var(--panel);border-top:1px solid var(--line);flex-shrink:0;overflow-x:auto}.cadTabs button{border:0;background:none;color:var(--mut);padding:5px 10px;cursor:pointer;font-size:12px;border-top:2px solid transparent}.cadTabs button.on{color:var(--text);border-top-color:var(--acc)}
.cadProp{width:100%;border-collapse:collapse;font-size:11.5px}.cadProp td{padding:3px 4px;border-bottom:1px solid #30363f;vertical-align:top;word-break:break-word}.cadProp td:first-child{color:var(--mut);width:42%}
.cadTree{font-size:12px}.cadTree .nd{padding:2px 0 2px calc(var(--d)*12px);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:4px;align-items:center}.cadTree .nd.sel{background:var(--accbg)}.cadTree .tg{width:12px;display:inline-block;color:var(--mut)}
#tabBar .dtab.cadtab .nm::before{content:'📐 '}#tabBar .dtab.cadtab.ifc .nm::before{content:'🏢 '}
.cadLbl{position:absolute;background:rgba(0,0,0,.75);color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;pointer-events:none;white-space:nowrap;transform:translate(-50%,-130%)}`;
function ensureShell(){let p=$('#cadPane');if(p)return p;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
 p=document.createElement('div');p.id='cadPane';const vw=$('#viewWrap');if(vw){const sb=$('#splitBox');vw.insertBefore(p,sb?sb.nextSibling:null)}else{p.classList.add('abs');$('#main').appendChild(p)}
 const bar=$('#tabBar');if(bar){new MutationObserver(()=>chips()).observe(bar,{childList:true});bar.addEventListener('click',e=>{const c=e.target.closest('[data-cad]');if(c){e.stopPropagation();if(e.target.closest('[data-cadx]'))closeDoc(+c.dataset.cad);else showDoc(+c.dataset.cad);return}if(e.target.closest('.dtab')&&!e.target.closest('.cadtab'))hidePane()},true)}
 return p}
function chips(){const bar=$('#tabBar');if(!bar)return;const want=CAD.docs.map(d=>d.id).join(',');const have=[...bar.querySelectorAll('.cadtab')].map(x=>x.dataset.cad).join(',');
 if(want!==have){bar.querySelectorAll('.cadtab').forEach(x=>x.remove());const plus=bar.querySelector('.tplus');for(const d of CAD.docs){const c=document.createElement('div');c.className='dtab cadtab'+(d.kind==='ifc'?' ifc':'');c.dataset.cad=d.id;c.title=d.name;c.innerHTML=`<span class="nm">${esc(d.name)}</span><button class="cx" data-cadx title="Close">✕</button>`;bar.insertBefore(c,plus||null)}}
 bar.querySelectorAll('.cadtab').forEach(c=>c.classList.toggle('on',CAD.visible&&+c.dataset.cad===CAD.cur));if(CAD.visible)bar.querySelectorAll('.dtab:not(.cadtab)').forEach(x=>x.classList.remove('on'))}
let hidden={};
function showPane(){const p=ensureShell();if(!CAD.visible){hidden={sb:$('#splitBox'),left:$('#left'),right:$('#right'),ml:$('#mlist')};for(const k in hidden){const el=hidden[k];if(el){hidden[k+'Prev']=el.style.display;el.style.display='none'}}}
 CAD.visible=true;p.classList.add('on');chips()}
function hidePane(){const p=$('#cadPane');if(!p||!CAD.visible)return;CAD.visible=false;p.classList.remove('on');for(const k of['sb','left','right','ml']){const el=hidden[k];if(el)el.style.display=hidden[k+'Prev']||''}const d=docOf(CAD.cur);if(d&&d.pause)d.pause();chips();try{scheduleRender()}catch(e){}}
const docOf=id=>CAD.docs.find(d=>d.id===id);
function showDoc(id){const d=docOf(id);if(!d)return;const p=ensureShell();if(CAD.cur!==id){const o=docOf(CAD.cur);if(o&&o.pause)o.pause()}CAD.cur=id;p.innerHTML='';p.appendChild(d.el);showPane();if(d.resume)d.resume();d.onShow&&d.onShow();chips()}
function closeDoc(id){const d=docOf(id);if(!d)return;try{d.dispose&&d.dispose()}catch(e){}CAD.docs=CAD.docs.filter(x=>x!==d);if(CAD.cur===id){CAD.cur=null;const n=CAD.docs[CAD.docs.length-1];if(n)showDoc(n.id);else{$('#cadPane').innerHTML='';hidePane()}}chips()}
async function openCadFile(file){const name=file.name,ext=name.split('.').pop().toLowerCase();const bytes=new Uint8Array(await file.arrayBuffer());return openCadBytes(bytes,name,ext)}
async function openCadBytes(bytes,name,ext){ext=ext||name.split('.').pop().toLowerCase();
 if(ext==='rvt'||ext==='rfa'||ext==='rte'){modal('Revit file',`<div class="hint">Native Revit files can only be opened by Autodesk software. In Revit use <b>File → Export → IFC</b> and open the .ifc file here — PlanMark shows the full 3D model, levels, element properties and quantities, offline.</div>`,[{label:'OK',cancel:1}]);return}
 const prog=progressModal('Opening '+name+'…');
 try{const d=ext==='ifc'?await IfcDoc(bytes,name,prog):await CadDoc(bytes,name,prog);closeModal();CAD.docs.push(d);showDoc(d.id);return d}
 catch(e){console.warn(e);closeModal();modal("Couldn't open "+name,`<div class="hint">${esc(e.message||String(e))}</div>${ext==='dwg'?'<div class="hint" style="margin-top:8px">Tip: AutoCAD → Save As → AutoCAD 2018 DXF (or DWG 2013) usually fixes this.</div>':''}`,[{label:'OK',cancel:1}])}}
function progressModal(msg){modal('CAD / BIM viewer',`<div class="hint" id="cadPMsg">${esc(msg)}</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="cadPBar" style="height:100%;width:3%;background:var(--acc);transition:width .2s"></div></div>`,[]);
 return(f,t)=>{const b=$('#cadPBar');if(b&&f!=null)b.style.width=Math.max(3,Math.round(f*100))+'%';const m=$('#cadPMsg');if(m&&t)m.textContent=t}}
/* =====================================================================
   2D document view
   ===================================================================== */
async function CadDoc(bytes,name,prog){prog(.1,'Loading the CAD reader…');const doc=await readCad(bytes,name);prog(.6,'Building the drawing…');await tick();
 const d={id:CAD.seq++,name,kind:'cad',doc,layout:0,bg:LS.get('pm:cadbg','dark'),cross:false,mode:'pan',mpts:[],sel:null,flash:null,unitsOverride:null};
 d.compiled={};const getPrims=i=>{if(!d.compiled[i]){const L=doc.layouts[i];d.compiled[i]=compile(doc,L.ents);if(L.paper&&!d.compiled.model)d.compiled.model=d.compiled[0]||(d.compiled[0]=compile(doc,doc.layouts[0].ents))}return d.compiled[i]};
 d.prims=()=>getPrims(d.layout);
 const el=document.createElement('div');el.style.cssText='display:flex;flex-direction:column;flex:1;min-height:0';d.el=el;
 const U=()=>{const u=d.unitsOverride!=null?d.unitsOverride:doc.units;return UNITS[u]||UNITS[0]};
 el.innerHTML=`<div class="cadBar"><b style="padding:0 6px;font-size:12px;white-space:nowrap">${esc(name)}</b><span style="color:var(--mut);font-size:11px">${doc.fmt} · view only</span>
  <button class="btn" data-c="fit" title="Zoom extents (F)">Fit</button><button class="btn on" data-c="pan" title="Pan / select (click an object for its info)">Select</button><button class="btn" data-c="dist" title="Measure distance (snaps to ends, midpoints, centers, intersections)">Distance</button><button class="btn" data-c="area" title="Measure area">Area</button>
  <input class="ti" data-c="find" placeholder="Find text…" style="width:130px;height:28px"><button class="btn" data-c="bg" title="Dark / light background">◐</button><button class="btn" data-c="cross" title="Crosshair cursor">┼</button>
  <select class="ti" data-c="units" style="width:auto;height:28px" title="Drawing units"></select><button class="btn" data-c="pdf" title="Make a scaled PDF of this layout and open it for markup and takeoff">→ PDF for markup</button><button class="btn" data-c="about" title="About the CAD viewer">ⓘ</button><button class="btn" data-c="close" title="Close">✕</button></div>
  <div class="cadBody"><div class="cadSide"><div class="sec" style="margin-top:0">Layers <a href="#" data-c="allon" style="color:#7dd3fc;font-size:11px;text-transform:none">all on</a> · <a href="#" data-c="alloff" style="color:#7dd3fc;font-size:11px;text-transform:none">all off</a></div><div data-r="layers"></div><div class="sec">Find</div><div data-r="found" class="hint">Type in "Find text…"</div></div>
  <div class="cadView"><canvas></canvas><div data-r="lbl"></div></div><div class="cadSide r"><div class="sec" style="margin-top:0">Info</div><div data-r="info" class="hint">Click any object to see its layer, type and size.</div><div class="sec">Measure</div><div data-r="meas" class="hint">Choose Distance or Area, then click points. Double-click or Enter to finish, Esc to clear.</div></div></div>
  <div class="cadTabs" data-r="tabs"></div><div class="cadStat"><span data-r="xy">x — y —</span><span data-r="snap"></span><span data-r="cnt"></span><span style="flex:1"></span><span data-r="zoomt"></span></div>`;
 const q=s=>el.querySelector(s),cv=q('canvas'),view=q('.cadView'),ctx=cv.getContext('2d');
 const us=q('[data-c=units]');us.innerHTML=Object.entries(UNITS).filter(([k])=>[0,1,2,4,5,6,10].includes(+k)).map(([k,[n]])=>`<option value="${k}" ${+k===doc.units?'selected':''}>${k==0?'Unitless':n}${+k===doc.units?' (file)':''}</option>`).join('');
 us.onchange=()=>{d.unitsOverride=+us.value;renderMeas();renderInfo()};
 let V={cx:0,cy:0,z:1},W=0,Hh=0,dpr=1;
 function size(){const r=view.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=r.width;Hh=r.height;cv.width=Math.max(1,Math.round(W*dpr));cv.height=Math.max(1,Math.round(Hh*dpr))}
 const w2s=(x,y)=>[(x-V.cx)*V.z+W/2,Hh/2-(y-V.cy)*V.z],s2w=(x,y)=>[(x-W/2)/V.z+V.cx,(Hh/2-y)/V.z+V.cy];
 function fit(){size();const L=doc.layouts[d.layout];let e;if(L.paper&&L.limits&&L.limits[1]&&L.limits[1].x>L.limits[0].x)e=[L.limits[0].x,L.limits[0].y,L.limits[1].x,L.limits[1].y];else e=extents(d.prims(),doc);V.cx=(e[0]+e[2])/2;V.cy=(e[1]+e[3])/2;V.z=Math.min(W/(e[2]-e[0]),Hh/(e[3]-e[1]))*.92||1;draw()}
 d.fit=fit;d.view=()=>V;d.w2s=w2s;d.s2w=s2w;
 const light=()=>d.bg==='light';
 const colFor=c=>{const l=light();if(l&&/^#f{6}$/i.test(c))return'#000000';if(!l&&/^#0{6}$/i.test(c))return'#ffffff';return c};
 const visible=Lname=>{const L=doc.layers.get(Lname);return!L||(L.on&&!L.frozen)};
 function drawPrims(prims,T,clip){// T: world->screen transform fn ; clip: screen rect
  const vw=s2w(0,Hh),vw2=s2w(W,0);
  for(const p of prims){if(!visible(p.L))continue;const b=p.bb;if(!clip&&(b[2]<vw[0]||b[0]>vw2[0]||b[3]<vw[1]||b[1]>vw2[1]))continue;
   const sel=d.sel&&p.top===d.sel;ctx.strokeStyle=ctx.fillStyle=sel?'#22d3ee':colFor(p.col);ctx.lineWidth=sel?2.5:1;
   if(p.k==='pl'){const s=p.pts;ctx.beginPath();let[x,y]=T(s[0],s[1]);ctx.moveTo(x,y);for(let i=2;i<s.length;i+=2){[x,y]=T(s[i],s[i+1]);ctx.lineTo(x,y)}if(p.closed)ctx.closePath();
    if(p.dash){const dd=p.dash.map(v=>Math.max(1,Math.abs(v)*V.z*(T===w2s?1:d._vpz||1)));if(dd.some(v=>v>2))ctx.setLineDash(dd)}ctx.stroke();ctx.setLineDash([])}
   else if(p.k==='fill'){ctx.beginPath();for(const r of p.rings){let[x,y]=T(r[0],r[1]);ctx.moveTo(x,y);for(let i=2;i<r.length;i+=2){[x,y]=T(r[i],r[i+1]);ctx.lineTo(x,y)}ctx.closePath()}
    if(p.solid){ctx.globalAlpha=sel?.6:1;ctx.fill('evenodd');ctx.globalAlpha=1}else{ctx.save();ctx.clip('evenodd');ctx.globalAlpha=.55;const[x0,y0]=T(b[0],b[3]),[x1,y1]=T(b[2],b[1]);ctx.beginPath();for(let k=Math.min(x0,x1)-Math.abs(y1-y0);k<Math.max(x0,x1);k+=7){ctx.moveTo(k,Math.max(y0,y1));ctx.lineTo(k+Math.abs(y1-y0),Math.min(y0,y1))}ctx.stroke();ctx.restore();ctx.stroke()}}
   else if(p.k==='tx'){const sc=T===w2s?V.z:(d._vpz||V.z),hp=p.h*sc;if(hp<1.5)continue;const[x,y]=T(p.x,p.y);ctx.save();ctx.translate(x,y);ctx.rotate(-p.rot);ctx.font=`${hp}px Arial, Helvetica, sans-serif`;
    const lines=p.s.split('\n');let ha=p.ha,vb='alphabetic',dy=0;if(p.mt){const c=(p.mt-1)%3,r=Math.floor((p.mt-1)/3);ha=c;vb='top';dy=r===1?-lines.length*hp*1.3/2:r===2?-lines.length*hp*1.3:0}else{if(p.ha===4){ha=1;vb='middle'}else if(p.ha>=3)ha=1;vb=p.va===3?'top':p.va===2?'middle':p.va===1?'bottom':'alphabetic'}
    ctx.textAlign=ha===1?'center':ha===2?'right':'left';ctx.textBaseline=vb;lines.forEach((l,i)=>ctx.fillText(l,0,dy+i*hp*1.3));ctx.restore()}
   else if(p.k==='pt'){const[x,y]=T(p.x,p.y);ctx.fillRect(x-1.5,y-1.5,3,3)}
   else if(p.k==='vp'&&T===w2s){const[x0,y0]=w2s(p.x0,p.y1),[x1,y1]=w2s(p.x1,p.y0);ctx.strokeStyle='#888';ctx.strokeRect(x0,y0,x1-x0,y1-y0);
    const mp=d.compiled.model||(d.compiled.model=compile(doc,doc.layouts[0].ents));const s=(p.y1-p.y0)/p.vh,cx=(p.x0+p.x1)/2,cy=(p.y0+p.y1)/2;d._vpz=V.z*s;
    ctx.save();ctx.beginPath();ctx.rect(x0,y0,x1-x0,y1-y0);ctx.clip();drawPrims(mp,(X,Y)=>w2s(cx+(X-p.vc.x)*s,cy+(Y-p.vc.y)*s),true);ctx.restore();d._vpz=null}}}
 function draw(){if(!W)size();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=light()?'#ffffff':'#1d2024';ctx.fillRect(0,0,W,Hh);
  const L=doc.layouts[d.layout];if(L.paper&&L.limits&&L.limits[1]){const[x0,y0]=w2s(L.limits[0].x,L.limits[1].y),[x1,y1]=w2s(L.limits[1].x,L.limits[0].y);ctx.fillStyle=light()?'#f8f8f8':'#2a2e34';ctx.fillRect(x0,y0,x1-x0,y1-y0);ctx.strokeStyle='#666';ctx.strokeRect(x0,y0,x1-x0,y1-y0)}
  ctx.lineJoin='round';drawPrims(d.prims(),w2s);
  // measurement overlay
  if(d.mpts.length){ctx.strokeStyle='#f59e0b';ctx.fillStyle='rgba(245,158,11,.18)';ctx.lineWidth=2;ctx.beginPath();const pts=d.mpts.concat(d.hover&&d.mode!=='pan'&&!d.mdone?[d.hover]:[]);pts.forEach((p,i)=>{const[x,y]=w2s(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});if(d.mode==='area'&&pts.length>2){ctx.closePath();ctx.fill()}ctx.stroke();
   for(const p of d.mpts){const[x,y]=w2s(p[0],p[1]);ctx.fillStyle='#f59e0b';ctx.fillRect(x-3,y-3,6,6)}}
  if(d.snapPt){const[x,y]=w2s(d.snapPt[0],d.snapPt[1]);ctx.strokeStyle='#ff00ff';ctx.lineWidth=1.5;ctx.strokeRect(x-5,y-5,10,10)}
  if(d.flash){const b=d.flash,[x0,y0]=w2s(b[0],b[3]),[x1,y1]=w2s(b[2],b[1]);ctx.strokeStyle='#facc15';ctx.lineWidth=2;ctx.strokeRect(x0-4,y0-4,x1-x0+8,y1-y0+8)}
  if(d.cross&&d.mouse){ctx.strokeStyle=light()?'rgba(0,0,0,.45)':'rgba(255,255,255,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,d.mouse[1]+.5);ctx.lineTo(W,d.mouse[1]+.5);ctx.moveTo(d.mouse[0]+.5,0);ctx.lineTo(d.mouse[0]+.5,Hh);ctx.stroke()}
  q('[data-r=zoomt]').textContent=`${doc.layouts[d.layout].name} · zoom ${V.z<1?V.z.toPrecision(2):V.z.toFixed(1)} px/${U()[0]}`}
 d.draw=draw;
 let rafp=0;const redraw=()=>{if(!rafp)rafp=requestAnimationFrame(()=>{rafp=0;draw()})};
 /* layers */
 function renderLayers(){const cnt={};for(const p of d.prims())cnt[p.L]=(cnt[p.L]||0)+1;const names=[...doc.layers.keys()].filter(n=>cnt[n]||doc.layers.size<60).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  q('[data-r=layers]').innerHTML=names.map(n=>{const L=doc.layers.get(n);return`<label class="cadLay" title="${esc(n)}"><input type="checkbox" data-l="${esc(n)}" ${L.on&&!L.frozen?'checked':''}><span class="sw" style="background:${L.col}"></span><span class="n">${esc(n)}</span><small style="color:var(--mut)">${cnt[n]||0}</small></label>`}).join('')||'<div class="hint">No layers.</div>';
  q('[data-r=cnt]').textContent=d.prims().length+' objects · '+doc.layers.size+' layers'}
 q('[data-r=layers]').addEventListener('change',e=>{const n=e.target.dataset.l;if(n==null)return;const L=doc.layers.get(n);L.on=e.target.checked;L.frozen=false;draw()});
 function renderTabs(){q('[data-r=tabs]').innerHTML=doc.layouts.map((L,i)=>`<button class="${i===d.layout?'on':''}" data-lay="${i}">${esc(L.name)}</button>`).join('')}
 q('[data-r=tabs]').addEventListener('click',e=>{const b=e.target.closest('[data-lay]');if(!b)return;d.layout=+b.dataset.lay;d.sel=null;d.mpts=[];d.snapIdx=null;renderTabs();renderLayers();fit()});
 /* info & measure */
 const fmtU=v=>{const[u,m]=U();if(u==='in'||u==='ft'){const inch=u==='ft'?v*12:v;return`${v.toFixed(3)} ${u}  (${fmtFtIn(inch,16)})`}return`${v.toFixed(3)} ${u}`};
 const fmtA=v=>{const[u]=U();return`${v.toFixed(3)} sq ${u}`+(u==='in'?` (${(v/144).toFixed(2)} sf)`:u==='ft'?` (${(v/9).toFixed(2)} sy)`:u==='mm'?` (${(v/1e6).toFixed(3)} m²)`:'')};
 const plLen=p=>{let s=0;const a=p.pts;for(let i=2;i<a.length;i+=2)s+=Math.hypot(a[i]-a[i-2],a[i+1]-a[i-1]);if(p.closed&&a.length>4)s+=Math.hypot(a[0]-a[a.length-2],a[1]-a[a.length-1]);return s};
 const ringArea=a=>{let s=0;for(let i=0;i<a.length;i+=2){const j=(i+2)%a.length;s+=a[i]*a[j+1]-a[j]*a[i+1]}return Math.abs(s/2)};
 function renderInfo(){const e=d.sel,box=q('[data-r=info]');if(!e){box.innerHTML='<div class="hint">Click any object to see its layer, type and size.</div>';return}
  const ps=d.prims().filter(p=>p.top===e),rows=[['Type',e.type],['Layer',e.layer||'0'],['Color',e.colorIndex===256?'ByLayer':e.colorIndex===0?'ByBlock':'ACI '+e.colorIndex],['Linetype',e.lineType||'ByLayer'],['Handle',e.handle||'—']];
  if(e.name)rows.push([e.type==='DIMENSION'?'Dimension block':'Block',e.name]);const path=ps[0]&&ps[0].path;if(path&&path.length)rows.push(['Nested in',path.join(' › ')]);
  const len=ps.filter(p=>p.k==='pl').reduce((s,p)=>s+plLen(p),0);if(len)rows.push(['Length',fmtU(len)]);
  const cl=ps.filter(p=>p.k==='pl'&&p.closed);if(cl.length===1)rows.push(['Area',fmtA(ringArea(cl[0].pts))]);
  if(e.radius)rows.push(['Radius',fmtU(e.radius)]);if(e.type==='DIMENSION'&&e.measurement)rows.push(['Measurement',fmtU(e.measurement)]);
  const tx=ps.find(p=>p.k==='tx');if(tx)rows.push(['Text',tx.s]);if(e.insertionPoint)rows.push(['Insertion',`${(+e.insertionPoint.x).toFixed(3)}, ${(+e.insertionPoint.y).toFixed(3)}`]);
  if(e.type==='INSERT'&&e.rotation)rows.push(['Rotation',(e.rotation*180/Math.PI).toFixed(2)+'°']);if(e.type==='INSERT'&&(e.xScale!==1||e.yScale!==1))rows.push(['Scale',`${e.xScale} × ${e.yScale}`]);
  for(const a of e.attribs||[]){const t=a.text&&typeof a.text==='object'?a.text:a;rows.push(['Attribute',t.text||''])}
  box.innerHTML=`<table class="cadProp">${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`}
 function measResult(){const m=d.mpts;if(m.length<2)return null;let L=0;for(let i=1;i<m.length;i++)L+=Math.hypot(m[i][0]-m[i-1][0],m[i][1]-m[i-1][1]);if(d.mode==='area'&&m.length>2){const a=new Float64Array(m.flat());return{len:L+Math.hypot(m[0][0]-m.at(-1)[0],m[0][1]-m.at(-1)[1]),area:ringArea(a)}}return{len:L}}
 function renderMeas(){const r=measResult(),box=q('[data-r=meas]');if(!r){box.innerHTML='<div class="hint">Choose Distance or Area, then click points. Double-click or Enter to finish, Esc to clear.</div>';return}
  box.innerHTML=`<table class="cadProp">${d.mode==='area'&&r.area!=null?`<tr><td>Area</td><td><b>${esc(fmtA(r.area))}</b></td></tr><tr><td>Perimeter</td><td>${esc(fmtU(r.len))}</td></tr>`:`<tr><td>Distance</td><td><b>${esc(fmtU(r.len))}</b></td></tr>`}<tr><td>Points</td><td>${d.mpts.length}</td></tr></table>`;d.lastMeasure=r}
 d.measure=()=>measResult();
 /* snapping */
 function buildSnap(){const prims=d.prims(),e=extents(prims,doc),cell=Math.max((e[2]-e[0]),(e[3]-e[1]))/256||1,grid=new Map(),key=(i,j)=>i*1000003+j,segs=[],pts=[];
  const addP=(x,y,k)=>{const id=pts.length;pts.push([x,y,k]);const g=key(Math.floor(x/cell),Math.floor(y/cell));let a=grid.get(g);if(!a)grid.set(g,a=[]);a.push(-1-id)};
  for(const p of prims){if(!visible(p.L))continue;if(p.cen)addP(p.cen[0],p.cen[1],'center');if(p.k==='pt')addP(p.x,p.y,'end');if(p.k!=='pl')continue;const s=p.pts,n=s.length;
   if(p.cen){if(!p.closed){addP(s[0],s[1],'end');addP(s[n-2],s[n-1],'end')}continue}for(let i=0;i<n;i+=2){addP(s[i],s[i+1],'end')}
   for(let i=2;i<n;i+=2){const x0=s[i-2],y0=s[i-1],x1=s[i],y1=s[i+1];addP((x0+x1)/2,(y0+y1)/2,'mid');const id=segs.length;segs.push([x0,y0,x1,y1]);
    const ns=Math.min(4000,Math.ceil(Math.hypot(x1-x0,y1-y0)/cell*2)+1);let lastg=null;for(let k=0;k<=ns;k++){const t=k/ns,g=key(Math.floor((x0+(x1-x0)*t)/cell),Math.floor((y0+(y1-y0)*t)/cell));if(g===lastg)continue;lastg=g;let arr=grid.get(g);if(!arr)grid.set(g,arr=[]);if(arr[arr.length-1]!==id)arr.push(id)}}}
  d.snapIdx={cell,grid,key,segs,pts}}
 function snapAt(wx,wy){if(!d.snapIdx)buildSnap();const S2=d.snapIdx,tol=10/V.z,ci=Math.floor(wx/S2.cell),cj=Math.floor(wy/S2.cell),r=Math.max(1,Math.ceil(tol/S2.cell));let best=null,bd=tol,kind='',cand=[];
  for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){const a=S2.grid.get(S2.key(i,j));if(!a)continue;for(const v of a){if(v<0){const p=S2.pts[-1-v],dd=Math.hypot(p[0]-wx,p[1]-wy)*(p[2]==='mid'?1.1:1);if(dd<bd){bd=dd;best=[p[0],p[1]];kind=p[2]}}else cand.push(v)}}
  if(!best||kind==='mid'){cand=[...new Set(cand)].slice(0,80);for(let a=0;a<cand.length;a++)for(let b=a+1;b<cand.length;b++){const s=S2.segs[cand[a]],t=S2.segs[cand[b]];const rx=s[2]-s[0],ry=s[3]-s[1],sx=t[2]-t[0],sy=t[3]-t[1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-12)continue;
   const u=((t[0]-s[0])*sy-(t[1]-s[1])*sx)/den,w=((t[0]-s[0])*ry-(t[1]-s[1])*rx)/den;if(u<0||u>1||w<0||w>1)continue;const x=s[0]+u*rx,y=s[1]+u*ry,dd=Math.hypot(x-wx,y-wy);if(dd<bd*1.05){bd=dd;best=[x,y];kind='intersection'}}}
  return best?{p:best,kind}:null}
 d.snapAt=snapAt;
 /* hit test */
 function hit(sx,sy){const[wx,wy]=s2w(sx,sy),tol=6/V.z;let best=null,bd=tol;
  for(const p of d.prims()){if(!visible(p.L))continue;const b=p.bb;if(wx<b[0]-tol||wx>b[2]+tol||wy<b[1]-tol||wy>b[3]+tol)continue;let dd=1e300;
   if(p.k==='pl'){const s=p.pts;for(let i=2;i<s.length+(p.closed?2:0);i+=2){const x0=s[(i-2)%s.length],y0=s[(i-1)%s.length],x1=s[i%s.length],y1=s[(i+1)%s.length],dx=x1-x0,dy=y1-y0,L2=dx*dx+dy*dy;let t=L2?((wx-x0)*dx+(wy-y0)*dy)/L2:0;t=Math.max(0,Math.min(1,t));dd=Math.min(dd,Math.hypot(x0+t*dx-wx,y0+t*dy-wy))}}
   else if(p.k==='fill'){let inside=false;for(const r of p.rings)for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){if((r[i+1]>wy)!==(r[j+1]>wy)&&wx<(r[j]-r[i])*(wy-r[i+1])/(r[j+1]-r[i+1])+r[i])inside=!inside}dd=inside?tol*.9:1e300}
   else if(p.k==='tx'){dd=(wx>=b[0]&&wx<=b[2]&&wy>=b[1]&&wy<=b[3])?tol*.5:1e300}else if(p.k==='pt')dd=Math.hypot(p.x-wx,p.y-wy);
   if(dd<bd){bd=dd;best=p}}return best}
 /* pointer handling */
 const ptr=new Map();let drag=null,pinch=null,lastClick=0;
 view.addEventListener('pointerdown',e=>{view.setPointerCapture(e.pointerId);ptr.set(e.pointerId,[e.offsetX,e.offsetY]);if(ptr.size===2){const[a,b]=[...ptr.values()];pinch={d0:Math.hypot(a[0]-b[0],a[1]-b[1]),z0:V.z,c:s2w((a[0]+b[0])/2,(a[1]+b[1])/2)};drag=null;return}
  drag={x:e.offsetX,y:e.offsetY,cx:V.cx,cy:V.cy,moved:false,btn:e.button}});
 view.addEventListener('pointermove',e=>{if(ptr.has(e.pointerId))ptr.set(e.pointerId,[e.offsetX,e.offsetY]);d.mouse=[e.offsetX,e.offsetY];
  if(pinch&&ptr.size>=2){const[a,b]=[...ptr.values()];const dd=Math.hypot(a[0]-b[0],a[1]-b[1]);V.z=pinch.z0*dd/pinch.d0;const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];V.cx=pinch.c[0]-(m[0]-W/2)/V.z;V.cy=pinch.c[1]+(m[1]-Hh/2)/V.z;redraw();return}
  const[wx,wy]=s2w(e.offsetX,e.offsetY);q('[data-r=xy]').textContent=`x ${wx.toFixed(3)}  y ${wy.toFixed(3)}  ${U()[0]}`;
  if(drag&&(drag.moved||Math.hypot(e.offsetX-drag.x,e.offsetY-drag.y)>4)){drag.moved=true;V.cx=drag.cx-(e.offsetX-drag.x)/V.z;V.cy=drag.cy+(e.offsetY-drag.y)/V.z;redraw();return}
  if(d.mode!=='pan'&&!d.mdone){const sn=snapAt(wx,wy);d.snapPt=sn&&sn.p;q('[data-r=snap]').textContent=sn?'snap: '+sn.kind:'';d.hover=sn?sn.p:[wx,wy];redraw()}else if(d.cross)redraw()});
 const end=e=>{ptr.delete(e.pointerId);if(pinch){if(ptr.size<2)pinch=null;drag=null;return}const g=drag;drag=null;if(!g||g.moved||g.btn!==0)return;
  const now=performance.now(),dbl=now-lastClick<320;lastClick=now;const[wx,wy]=s2w(e.offsetX,e.offsetY);
  if(d.mode==='pan'){const h=hit(e.offsetX,e.offsetY);d.sel=h?h.top:null;renderInfo();draw();return}
  if(dbl){d.mdone=true;d.snapPt=null;renderMeas();draw();return}
  if(d.mdone){d.mpts=[];d.mdone=false}const sn=snapAt(wx,wy);d.mpts.push(sn?sn.p:[wx,wy]);renderMeas();draw()};
 view.addEventListener('pointerup',end);view.addEventListener('pointercancel',e=>{ptr.delete(e.pointerId);drag=null;pinch=null});
 view.addEventListener('pointerleave',()=>{d.mouse=null;if(d.cross)redraw()});
 view.addEventListener('wheel',e=>{e.preventDefault();const f=Math.exp(-(e.deltaMode===1?e.deltaY*30:e.deltaY)*(e.ctrlKey?.01:.0016));const[wx,wy]=s2w(e.offsetX,e.offsetY);V.z*=f;V.cx=wx-(e.offsetX-W/2)/V.z;V.cy=wy+(e.offsetY-Hh/2)/V.z;redraw()},{passive:false});
 const setMode=m=>{d.mode=m;d.mpts=[];d.mdone=false;d.snapPt=null;el.querySelectorAll('[data-c=pan],[data-c=dist],[data-c=area]').forEach(b=>b.classList.toggle('on',b.dataset.c===m));renderMeas();draw()};
 d.setMode=setMode;
 el.addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b||b.tagName==='INPUT'||b.tagName==='SELECT')return;const c=b.dataset.c;e.preventDefault();
  if(c==='fit')fit();if(c==='pan'||c==='dist'||c==='area')setMode(c);if(c==='bg'){d.bg=light()?'dark':'light';LS.set('pm:cadbg',d.bg);draw()}if(c==='cross'){d.cross=!d.cross;b.classList.toggle('on',d.cross);view.style.cursor=d.cross?'none':'';draw()}
  if(c==='allon'||c==='alloff'){for(const L of doc.layers.values()){L.on=c==='allon';if(c==='allon')L.frozen=false}renderLayers();draw()}
  if(c==='pdf')pdfDialog(d);if(c==='about')aboutDialog();if(c==='close')closeDoc(d.id)});
 const fi=q('[data-c=find]');fi.addEventListener('input',()=>{const t=fi.value.trim().toLowerCase(),box=q('[data-r=found]');if(!t){box.innerHTML='<div class="hint">Type in "Find text…"</div>';return}
  const hits=d.prims().filter(p=>p.k==='tx'&&p.s.toLowerCase().includes(t)).slice(0,200);d.found=hits;box.innerHTML=hits.length?hits.map((p,i)=>`<div class="res" data-fd="${i}">${esc(p.s.slice(0,60))}<br><small style="color:var(--mut)">${esc(p.L)}</small></div>`).join(''):'<div class="hint">No matches.</div>'});
 q('[data-r=found]').addEventListener('click',e=>{const r=e.target.closest('[data-fd]');if(!r)return;const p=d.found[+r.dataset.fd];V.cx=p.x;V.cy=p.y;V.z=Math.max(V.z,30/Math.max(p.h,1e-9));d.flash=p.bb;d.sel=p.top;renderInfo();draw();setTimeout(()=>{d.flash=null;draw()},1800)});
 d.keys=e=>{if(e.target.closest('input,textarea,select'))return false;const k=e.key;if(k==='Escape'){d.mpts=[];d.mdone=false;d.snapPt=null;renderMeas();draw();return true}if(k==='Enter'&&d.mpts.length){d.mdone=true;d.snapPt=null;renderMeas();draw();return true}
  if(k==='f'||k==='F'){fit();return true}return false};
 const ro=new ResizeObserver(()=>{if(!CAD.visible||CAD.cur!==d.id)return;const pv=[V.cx,V.cy];size();V.cx=pv[0];V.cy=pv[1];draw()});ro.observe(view);
 d.dispose=()=>ro.disconnect();d.onShow=()=>{requestAnimationFrame(()=>{if(!d.shown){d.shown=true;fit()}else{size();draw()}})};
 renderTabs();renderLayers();prog(1,'Done');return d}
/* ---------- CAD → scaled vector PDF ---------- */
const SHEETS={'ARCH A (9×12)':[9,12],'ARCH B (12×18)':[12,18],'ARCH C (18×24)':[18,24],'ARCH D (24×36)':[24,36],'ARCH E (36×48)':[36,48],'ANSI A (8.5×11)':[8.5,11],'ANSI B (11×17)':[11,17],'ANSI C (17×22)':[17,22],'ANSI D (22×34)':[22,34],'ANSI E (34×44)':[34,44],'ISO A3':[11.69,16.54],'ISO A1':[23.39,33.11],'ISO A0':[33.11,46.81]};
function pdfDialog(d){const u=(d.unitsOverride!=null?d.unitsOverride:d.doc.units);const um=(UNITS[u]||UNITS[0])[1];
 const arch=ARCH.map(([l,v])=>`<option value="a:${v}">${l}" = 1'-0"</option>`).join(''),eng=ENG.map(n=>`<option value="e:${n}">1" = ${n}'</option>`).join(''),met=METRIC.map(n=>`<option value="m:${n}">1:${n}</option>`).join('');
 modal('Convert to PDF for markup',`<div class="hint" style="margin-bottom:8px">Creates a vector PDF of the <b>${esc(d.doc.layouts[d.layout].name)}</b> layout (visible layers only) and opens it in PlanMark with its scale already set, so every takeoff tool measures correctly.</div>
 <div class="fld"><label>Drawing units ${um?'':'(file says unitless — pick the real unit)'}</label><select class="ti" id="cpU">${[1,2,4,5,6,10].map(k=>`<option value="${k}" ${k===u?'selected':''}>${UNITS[k][0]}</option>`).join('')}</select></div>
 <div class="fld"><label>Scale</label><select class="ti" id="cpS"><option value="fit">Fit to sheet (scale computed)</option><optgroup label="Architectural">${arch}</optgroup><optgroup label="Engineering">${eng}</optgroup><optgroup label="Metric">${met}</optgroup><option value="f:1">Full size 1:1</option></select></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Sheet</label><select class="ti" id="cpP">${Object.keys(SHEETS).map(k=>`<option ${k.startsWith('ARCH D')?'selected':''}>${k}</option>`).join('')}<option value="extents">Drawing extents (no fixed sheet)</option></select></div>
 <div><label style="font-size:11px;color:var(--mut)">Area</label><select class="ti" id="cpA"><option value="ext">Whole drawing</option><option value="view">Current view</option></select></div></div>
 <label class="chk"><input type="checkbox" id="cpM" checked> Black lines (plot style)</label>`,
 [{label:'Cancel',cancel:1},{label:'Create & open',pri:1,fn:md=>{const o={units:+md.querySelector('#cpU').value,scale:md.querySelector('#cpS').value,sheet:md.querySelector('#cpP').value,area:md.querySelector('#cpA').value,mono:md.querySelector('#cpM').checked};setTimeout(()=>cadToPdf(d,o).catch(e=>{console.error(e);toast('PDF failed: '+e.message)}),0)}}]);
 if(!um)$('#cpU').value='2';$('#cpS').value=um===0.0254||um===0.3048||!um?'a:0.25':'m:100'}
async function cadToPdf(d,o){toast('Creating PDF…');const doc=d.doc,prims=d.prims().filter(p=>{const L=doc.layers.get(p.L);return!L||(L.on&&!L.frozen)});
 const um=UNITS[o.units][1];let ext;if(o.area==='view'){const v=d.view(),a=d.s2w(0,d.el.querySelector('.cadView').clientHeight),b=d.s2w(d.el.querySelector('.cadView').clientWidth,0);ext=[a[0],a[1],b[0],b[1]]}else{const L=doc.layouts[d.layout];ext=L.paper&&L.limits&&L.limits[1]&&L.limits[1].x>L.limits[0].x?[L.limits[0].x,L.limits[0].y,L.limits[1].x,L.limits[1].y]:extents(prims,doc)}
 const ew=ext[2]-ext[0],eh=ext[3]-ext[1],margin=36;let pw,ph,ptPerUnit,label;
 const sheetPts=()=>{const s=SHEETS[o.sheet];let a=s[0]*72,b=s[1]*72;if((ew>eh)!==(b>a))[a,b]=[b,a];if(ew>eh&&a<b)[a,b]=[b,a];return[a,b]};
 if(o.scale==='fit'){if(o.sheet==='extents'){pw=Math.min(14400,Math.max(200,ew/Math.max(ew,eh)*2592));ph=pw*eh/ew}else[pw,ph]=sheetPts();ptPerUnit=Math.min((pw-2*margin)/ew,(ph-2*margin)/eh);label='Fit (from CAD)'}
 else{const[k,v]=o.scale.split(':'),n=+v;const ratio=k==='a'?12/n:k==='e'?12*n:n;// real per paper
  ptPerUnit=um/0.0254*72/ratio;label=k==='a'?$('#cpS')?ARCH.find(x=>x[1]===n)[0]+'" = 1\'-0"':'':k==='e'?`1" = ${n}'`:k==='m'?'1:'+n:'1:1';
  if(k==='a')label=ARCH.find(x=>x[1]===n)[0]+'" = 1\'-0"';
  if(o.sheet==='extents'){pw=ew*ptPerUnit+2*margin;ph=eh*ptPerUnit+2*margin}else[pw,ph]=sheetPts();
  if(ew*ptPerUnit>pw-2*margin+1||eh*ptPerUnit>ph-2*margin+1)toast('Note: at this scale the drawing is larger than the sheet — it will be cropped. Try a smaller scale or "Drawing extents".')}
 if(pw>14400||ph>14400){const f=14400/Math.max(pw,ph);pw*=f;ph*=f;ptPerUnit*=f;label+=' (reduced)'}
 const cx=(ext[0]+ext[2])/2,cy=(ext[1]+ext[3])/2;const X=x=>pw/2+(x-cx)*ptPerUnit,Y=y=>ph/2+(y-cy)*ptPerUnit;
 const{PDFDocument,StandardFonts,rgb,degrees,pushGraphicsState,popGraphicsState,moveTo,lineTo,closePath,stroke,fill,setStrokingRgbColor,setFillingRgbColor,setLineWidth,setLineCap,setLineJoin,setDashPattern,fillEvenOdd,rectangle,clip,endPath}=PDFLib;
 const pdf=await PDFDocument.create(),page=pdf.addPage([pw,ph]),font=await pdf.embedFont(StandardFonts.Helvetica);
 const hex=c=>{const n=parseInt(String(c).replace('#',''),16)||0;return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
 const colOf=c=>{if(o.mono)return[0,0,0];const v=hex(c);return(v[0]>.92&&v[1]>.92&&v[2]>.92)?[0,0,0]:v};
 const ops=[pushGraphicsState(),rectangle(margin*.5,margin*.5,pw-margin,ph-margin),clip(),endPath(),setLineWidth(.35),setLineCap(1),setLineJoin(1)];
 const emitPrims=(ps,TX,TY,scl)=>{for(const p of ps){if(p.k==='pl'){const s=p.pts;if(s.length<4)continue;const c=colOf(p.col);ops.push(setStrokingRgbColor(...c));if(p.dash)ops.push(setDashPattern(p.dash.map(v=>Math.max(.5,Math.abs(v)*scl)),0));
    ops.push(moveTo(TX(s[0]),TY(s[1])));for(let i=2;i<s.length;i+=2)ops.push(lineTo(TX(s[i]),TY(s[i+1])));if(p.closed)ops.push(closePath());ops.push(stroke());if(p.dash)ops.push(setDashPattern([],0))}
   else if(p.k==='fill'){const c=colOf(p.col);for(const r of p.rings){ops.push(moveTo(TX(r[0]),TY(r[1])));for(let i=2;i<r.length;i+=2)ops.push(lineTo(TX(r[i]),TY(r[i+1])));ops.push(closePath())}
    if(p.solid){ops.push(setFillingRgbColor(...c),fillEvenOdd())}else{ops.push(setStrokingRgbColor(...c),stroke())}}}};
 const vps=prims.filter(p=>p.k==='vp');emitPrims(prims.filter(p=>p.k!=='vp'),X,Y,ptPerUnit);
 for(const v of vps){const mp=d.compiled.model||compile(doc,doc.layouts[0].ents),s=(v.y1-v.y0)/v.vh,vcx=(v.x0+v.x1)/2,vcy=(v.y0+v.y1)/2;ops.push(pushGraphicsState(),rectangle(X(v.x0),Y(v.y0),(v.x1-v.x0)*ptPerUnit,(v.y1-v.y0)*ptPerUnit),clip(),endPath());
  emitPrims(mp.filter(p=>{const L=doc.layers.get(p.L);return!L||(L.on&&!L.frozen)}),x=>X(vcx+(x-v.vc.x)*s),y=>Y(vcy+(y-v.vc.y)*s),ptPerUnit*s);ops.push(popGraphicsState())}
 ops.push(popGraphicsState());page.pushOperators(...ops);
 for(const p of prims){if(p.k!=='tx')continue;const sz=p.h*ptPerUnit;if(sz<1.2)continue;const c=colOf(p.col);const lines=p.s.split('\n');const ang=p.rot*180/Math.PI;
  lines.forEach((l,i)=>{const str=safeTxt(l);if(!str.trim())return;const w=font.widthOfTextAtSize(str,sz);let dx=0,dy=-i*sz*1.3;let ha=p.ha;if(p.mt){ha=(p.mt-1)%3;dy-=sz*.9;const r=Math.floor((p.mt-1)/3);if(r===1)dy+=lines.length*sz*1.3/2;if(r===2)dy+=lines.length*sz*1.3}else if(p.ha===4){ha=1;dy-=sz*.35}else if(p.va===2)dy-=sz*.35;else if(p.va===3)dy-=sz*.8;
   if(ha===1||ha>=3)dx=-w/2;else if(ha===2)dx=-w;const r=p.rot,ox=X(p.x)+dx*Math.cos(r)-dy*Math.sin(r),oy=Y(p.y)+dx*Math.sin(r)+dy*Math.cos(r);
   if(ox<-50||oy<-50||ox>pw+50||oy>ph+50)return;try{page.drawText(str,{x:ox,y:oy,size:sz,font,color:rgb(...c),rotate:degrees(ang)})}catch(e){}})}
 page.drawText(safeTxt(`${d.name} · ${doc.layouts[d.layout].name} · ${label} · PlanMark CAD export`),{x:margin*.5,y:margin*.25,size:6,font,color:rgb(.45,.45,.45)});
 const bytes=new Uint8Array(await pdf.save());const nm=d.name.replace(/\.(dwg|dxf)$/i,'')+(doc.layouts.length>1?' - '+doc.layouts[d.layout].name:'')+'.pdf';
 hidePane();await openBytes(bytes,nm);
 const perPt=um/ptPerUnit,imperial=[1,2,10].includes(o.units);S.scales={all:{perPt,unit:imperial?'ftin':'m',label,prec:16,dec:2}};saveScales();commit();updateScaleBtn();renderProps();
 toast('Opened '+nm+' — scale set to '+label);return{ptPerUnit,perPt,pw,ph}}
/* =====================================================================
   IFC (BIM) 3D viewer
   ===================================================================== */
async function IfcDoc(bytes,name,prog){prog(.05,'Loading the 3D engine…');const[{THREE,OrbitControls},{api}]=await Promise.all([getThree(),getIfc()]);
 prog(.15,'Reading the IFC model…');await tick();const modelID=api.OpenModel(bytes,{COORDINATE_TO_ORIGIN:true});if(modelID<0)throw new Error('This IFC file could not be read.');
 const d={id:CAD.seq++,name,kind:'ifc',api,modelID,THREE,byId:new Map(),meta:new Map(),hidden:new Set(),sel:null,mode:'orbit',mpts:[],views:LS.get('pm:ifcviews:'+name,[])};
 const el=document.createElement('div');el.style.cssText='display:flex;flex-direction:column;flex:1;min-height:0';d.el=el;
 el.innerHTML=`<div class="cadBar"><b style="padding:0 6px;font-size:12px;white-space:nowrap">${esc(name)}</b><span style="color:var(--mut);font-size:11px">IFC · view only</span>
  <button class="btn" data-i="fit">Fit</button><button class="btn" data-i="home" title="3D view">3D</button><button class="btn" data-i="top">Top</button><button class="btn" data-i="front">Front</button><button class="btn" data-i="right">Right</button>
  <button class="btn" data-i="xray" title="See-through">X-ray</button><button class="btn" data-i="hide" title="Hide selected">Hide</button><button class="btn" data-i="iso" title="Show only selected">Isolate</button><button class="btn" data-i="all">Show all</button>
  <select class="ti" data-i="secax" style="width:auto;height:28px" title="Section plane"><option value="">No section</option><option value="y">Plan cut (horizontal)</option><option value="x">Section X</option><option value="z">Section Z</option></select><input type="range" data-i="secpos" min="0" max="1000" value="500" style="width:110px" disabled><button class="btn" data-i="secflip" title="Flip section">⇅</button>
  <button class="btn" data-i="measure" title="Click two points on the model">Measure</button><button class="btn" data-i="views" title="Saved views">Views</button><button class="btn" data-i="plan" title="Plan of a level as a scaled PDF for markup">Level → PDF</button><button class="btn" data-i="about">ⓘ</button><button class="btn" data-i="close">✕</button></div>
  <div class="cadBody"><div class="cadSide"><div class="sec" style="margin-top:0">Levels</div><select class="ti" data-i="storey"><option value="">All levels</option></select><label class="chk" style="margin-top:6px"><input type="checkbox" data-i="spaces"> Show spaces (rooms)</label><div class="sec">Model tree</div><div data-r="tree" class="cadTree"></div></div>
  <div class="cadView" data-r="v3"><div data-r="lbls"></div></div><div class="cadSide r"><div class="sec" style="margin-top:0">Properties</div><div data-r="props" class="hint">Click an element to see its properties and quantities.</div></div></div>
  <div class="cadStat"><span data-r="cnt"></span><span data-r="mres"></span><span style="flex:1"></span><span data-r="hint3">Drag to orbit · right-drag to pan · wheel to zoom</span></div>`;
 const q=s=>el.querySelector(s),view=q('[data-r=v3]');
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.localClippingEnabled=false;view.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x2a2f37);const cam=new THREE.PerspectiveCamera(45,1,.05,20000);cam.position.set(20,20,20);
 scene.add(new THREE.HemisphereLight(0xffffff,0x444455,1.1));const dl=new THREE.DirectionalLight(0xffffff,1.2);dl.position.set(30,60,20);scene.add(dl);
 const controls=new OrbitControls(cam,renderer.domElement);controls.enableDamping=false;controls.screenSpacePanning=true;
 const group=new THREE.Group();scene.add(group);d.group=group;d.scene=scene;d.cam=cam;d.renderer=renderer;d.controls=controls;
 const mats=new Map();const matFor=c=>{const k=[c.x,c.y,c.z,c.w].map(v=>v.toFixed(3)).join(',');let m=mats.get(k);if(!m){m=new THREE.MeshLambertMaterial({color:new THREE.Color(c.x,c.y,c.z),transparent:c.w<.999,opacity:c.w,side:THREE.DoubleSide,depthWrite:c.w>=.999});m.userData.base={opacity:c.w,transparent:c.w<.999};mats.set(k,m)}return m};
 const selMat=new THREE.MeshLambertMaterial({color:0x22d3ee,emissive:0x0e7490,side:THREE.DoubleSide});
 let tris=0;
 const addFlat=fm=>{const id=fm.expressID,gs=fm.geometries;for(let i=0;i<gs.size();i++){const pg=gs.get(i);const g=api.GetGeometry(modelID,pg.geometryExpressID);const v=api.GetVertexArray(g.GetVertexData(),g.GetVertexDataSize()),ix=api.GetIndexArray(g.GetIndexData(),g.GetIndexDataSize());
  const n=v.length/6,pos=new Float32Array(n*3),nor=new Float32Array(n*3);for(let k=0,j=0;k<v.length;k+=6,j+=3){pos[j]=v[k];pos[j+1]=v[k+1];pos[j+2]=v[k+2];nor[j]=v[k+3];nor[j+1]=v[k+4];nor[j+2]=v[k+5]}
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(pos,3));bg.setAttribute('normal',new THREE.BufferAttribute(nor,3));bg.setIndex(new THREE.BufferAttribute(new Uint32Array(ix),1));
  const mesh=new THREE.Mesh(bg,matFor(pg.color));mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(pg.flatTransformation);mesh.userData.id=id;mesh.userData.mat=mesh.material;group.add(mesh);
  let arr=d.byId.get(id);if(!arr)d.byId.set(id,arr=[]);arr.push(mesh);tris+=ix.length/3;try{g.delete&&g.delete()}catch(e){}}};
 // spatial structure first, then stream meshes element by element (keeps the UI responsive)
 prog(.25,'Reading levels and elements…');await tick();let tree=null;try{tree=await api.properties.getSpatialStructure(modelID,false)}catch(e){console.warn(e)}
 const ids=[],typeOf=new Map(),storeyOf=new Map();
 const walk=(n,st)=>{if(!n)return;typeOf.set(n.expressID,n.type);if(/IFCBUILDINGSTOREY/i.test(n.type))st=n.expressID;if(st)storeyOf.set(n.expressID,st);ids.push(n.expressID);for(const c of n.children||[])walk(c,st)};walk(tree,null);
 const tName=t=>String(t||'').replace(/^IFC/,'Ifc');d.typeOf=typeOf;d.storeyOf=storeyOf;d.tree=tree;
 const B=250;let done=0;for(let i=0;i<ids.length;i+=B){const batch=ids.slice(i,i+B);try{api.StreamMeshes(modelID,batch,addFlat)}catch(e){console.warn('stream',e)}done+=batch.length;prog(.3+.6*done/Math.max(1,ids.length),`Loading geometry… ${done} / ${ids.length}`);await tick()}
 if(!d.byId.size){prog(.9,'Loading geometry…');api.StreamAllMeshes(modelID,addFlat)}
 // spaces hidden by default
 const isSpace=id=>/IFCSPACE/i.test(typeOf.get(id)||'');for(const[id,ms]of d.byId)if(isSpace(id))ms.forEach(m=>m.visible=false);
 if(tris<400000){const em=new THREE.LineBasicMaterial({color:0x111111,transparent:true,opacity:.35});for(const[id,ms]of d.byId){if(isSpace(id))continue;for(const m of ms){const eg=new THREE.EdgesGeometry(m.geometry,35);const ls=new THREE.LineSegments(eg,em);ls.matrixAutoUpdate=false;ls.matrix.copy(m.matrix);ls.userData.edgeOf=m;m.userData.edges=ls;group.add(ls)}}}
 prog(.95,'Finishing…');
 let W=0,Hh=0;const size=()=>{const r=view.getBoundingClientRect();W=r.width;Hh=r.height;if(!W||!Hh)return;renderer.setSize(W,Hh,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';cam.aspect=W/Hh;cam.updateProjectionMatrix()};
 let raf=0,running=false;const render=()=>{renderer.render(scene,cam);drawLabels()};const loop=()=>{if(!running)return;render();raf=requestAnimationFrame(loop)};
 controls.addEventListener('change',()=>{if(!running)render()});
 d.pause=()=>{running=false;cancelAnimationFrame(raf)};d.resume=()=>{size();render()};d.render=render;
 const visibleMeshes=()=>{const a=[];group.traverse(o=>{if(o.isMesh&&o.visible)a.push(o)});return a};
 const bbox=(list)=>{const b=new THREE.Box3();for(const m of list||visibleMeshes()){m.geometry.computeBoundingBox();const bb=m.geometry.boundingBox.clone().applyMatrix4(m.matrix);b.union(bb)}return b};
 const fitTo=(dir,list)=>{const b=bbox(list);if(b.isEmpty())return;const c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()).length()||10;const v=(dir||new THREE.Vector3(1,.8,1)).clone().normalize();cam.position.copy(c).addScaledVector(v,s*1.35);cam.near=s/1000;cam.far=s*20;cam.up.set(0,1,0);if(Math.abs(v.y)>.99)cam.up.set(0,0,-1);cam.lookAt(c);cam.updateProjectionMatrix();controls.target.copy(c);controls.update();render()};
 d.fitTo=fitTo;d.bbox=bbox;
 /* tree */
 const names=new Map();const nameOf=id=>{if(names.has(id))return names.get(id);let n='';try{const l=api.GetLine(modelID,id);n=(l.Name&&l.Name.value)||(l.LongName&&l.LongName.value)||''}catch(e){}names.set(id,n);return n};
 const open=new Set();if(tree){open.add(tree.expressID);(tree.children||[]).forEach(c=>{open.add(c.expressID);(c.children||[]).forEach(cc=>open.add(cc.expressID))})}
 function renderTree(){const out=[];const rec=(n,dep)=>{if(!n)return;const kids=n.children||[];out.push(`<div class="nd ${d.sel===n.expressID?'sel':''}" style="--d:${dep}" data-nid="${n.expressID}"><span class="tg" data-tog="${n.expressID}">${kids.length?(open.has(n.expressID)?'▾':'▸'):''}</span><input type="checkbox" data-vis="${n.expressID}" ${subtreeHidden(n)?'':'checked'}><span>${esc(tName(n.type))}${nameOf(n.expressID)?' — '+esc(nameOf(n.expressID)):''}</span></div>`);
   if(open.has(n.expressID)){const lim=kids.slice(0,400);for(const c of lim)rec(c,dep+1);if(kids.length>400)out.push(`<div class="nd" style="--d:${dep+1}" class="hint">… ${kids.length-400} more</div>`)}};rec(tree,0);q('[data-r=tree]').innerHTML=out.join('')||'<div class="hint">No spatial structure in this file.</div>'}
 const subtreeIds=n=>{const a=[];const r=x=>{a.push(x.expressID);(x.children||[]).forEach(r)};r(n);return a};
 const findNode=(n,id)=>{if(!n)return null;if(n.expressID===id)return n;for(const c of n.children||[]){const f=findNode(c,id);if(f)return f}return null};
 const subtreeHidden=n=>{const ms=subtreeIds(n).flatMap(i=>d.byId.get(i)||[]);return ms.length&&ms.every(m=>!m.visible)};
 const setVis=(id,v)=>{for(const m of d.byId.get(id)||[]){m.visible=v;if(m.userData.edges)m.userData.edges.visible=v}};
 q('[data-r=tree]').addEventListener('click',e=>{const t=e.target.closest('[data-tog]');if(t){const id=+t.dataset.tog;open.has(id)?open.delete(id):open.add(id);renderTree();return}
  const v=e.target.closest('[data-vis]');if(v){const n=findNode(tree,+v.dataset.vis);subtreeIds(n).forEach(i=>setVis(i,v.checked));render();return}
  const nd=e.target.closest('[data-nid]');if(nd){const id=+nd.dataset.nid;const n=findNode(tree,id);const list=subtreeIds(n).flatMap(i=>d.byId.get(i)||[]).filter(m=>m.visible);select(id);if(list.length)fitTo(cam.position.clone().sub(controls.target),list)}});
 /* selection & properties */
 const ray=new THREE.Raycaster();const pick=(e)=>{const r=renderer.domElement.getBoundingClientRect();const m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(m,cam);const hits=ray.intersectObjects(visibleMeshes(),false).filter(h=>!renderer.clippingPlanes.length||renderer.clippingPlanes.every(p=>p.distanceToPoint(h.point)>=-1e-6));return hits[0]||null};
 d.pick=pick;
 function select(id){if(d.sel!=null)for(const m of d.byId.get(d.sel)||[])m.material=d.xray?xrayMat(m):m.userData.mat;d.sel=id;if(id!=null)for(const m of d.byId.get(id)||[])m.material=selMat;render();renderProps(id);renderTree()}
 d.select=select;
 const val=v=>{if(v==null)return'';if(typeof v!=='object')return String(v);if('value'in v)return val(v.value);if(Array.isArray(v))return v.map(val).join(', ');return''};
 async function renderProps(id){const box=q('[data-r=props]');if(id==null){box.innerHTML='<div class="hint">Click an element to see its properties and quantities.</div>';return}
  box.innerHTML='<div class="hint">Loading…</div>';let rows=[],sets=[];
  try{const a=await api.properties.getItemProperties(modelID,id,false);rows=[['Type',tName(typeOf.get(id)||(a&&a.constructor&&a.constructor.name)||'')],['Name',val(a.Name)],['Description',val(a.Description)],['Object type',val(a.ObjectType)],['Tag',val(a.Tag)],['GlobalId',val(a.GlobalId)],['Express ID',id]].filter(r=>r[1]!==''&&r[1]!=null);
   const st=storeyOf.get(id);if(st)rows.push(['Level',nameOf(st)||'#'+st]);
   const ps=await api.properties.getPropertySets(modelID,id,true);for(const p of ps||[]){const items=[];for(const h of p.HasProperties||[])items.push([val(h.Name),val(h.NominalValue)+(h.Unit?'':'')]);for(const qn of p.Quantities||[]){const v=qn.LengthValue||qn.AreaValue||qn.VolumeValue||qn.CountValue||qn.WeightValue;items.push([val(qn.Name),val(v)])}sets.push([val(p.Name)||'Properties',items])}
   const mt=await api.properties.getMaterialsProperties(modelID,id,true).catch(()=>[]);if(mt&&mt.length)rows.push(['Material',mt.map(m=>val(m.Name)||val(m.ForLayerSet&&m.ForLayerSet.LayerSetName)||'').filter(Boolean).join(', ')||'—'])}catch(e){console.warn(e)}
  d.lastProps={rows,sets};box.innerHTML=`<table class="cadProp">${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`+sets.map(([n,it])=>`<div class="sec">${esc(n)}</div><table class="cadProp">${it.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')||'<tr><td colspan=2 class="hint">(empty)</td></tr>'}</table>`).join('')}
 /* x-ray */
 const xmats=new Map();const xrayMat=m=>{let x=xmats.get(m.userData.mat);if(!x){x=m.userData.mat.clone();x.transparent=true;x.opacity=.12;x.depthWrite=false;xmats.set(m.userData.mat,x)}return x};
 const setXray=on=>{d.xray=on;group.traverse(o=>{if(o.isMesh&&o.userData.id!=null&&o.userData.id!==d.sel)o.material=on?xrayMat(o):o.userData.mat});q('[data-i=xray]').classList.toggle('on',on);render()};
 /* section */
 const sec={ax:'',pos:.5,flip:false};const applySec=()=>{if(!sec.ax){renderer.clippingPlanes=[];q('[data-i=secpos]').disabled=true;render();return}q('[data-i=secpos]').disabled=false;const b=bbox([...d.byId.values()].flat());const lo=b.min[sec.ax],hi=b.max[sec.ax],v=lo+(hi-lo)*sec.pos;const n=new THREE.Vector3(sec.ax==='x'?1:0,sec.ax==='y'?1:0,sec.ax==='z'?1:0);if(!sec.flip)n.negate();renderer.clippingPlanes=[new THREE.Plane(n,sec.flip?-v:v)];render()};
 d.setSection=(ax,pos,flip)=>{sec.ax=ax;if(pos!=null)sec.pos=pos;if(flip!=null)sec.flip=flip;q('[data-i=secax]').value=ax;q('[data-i=secpos]').value=Math.round(sec.pos*1000);applySec()};
 /* measure */
 const mGroup=new THREE.Group();scene.add(mGroup);const lbls=q('[data-r=lbls]');let mLabels=[];
 function drawLabels(){for(const L of mLabels){const v=L.p.clone().project(cam);L.el.style.left=((v.x+1)/2*W)+'px';L.el.style.top=((1-v.y)/2*Hh)+'px';L.el.style.display=v.z<1?'':'none'}}
 const addMeasure=(a,b)=>{const g=new THREE.BufferGeometry().setFromPoints([a,b]);const ln=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xf59e0b,depthTest:false}));ln.renderOrder=10;mGroup.add(ln);
  for(const p of[a,b]){const s=new THREE.Mesh(new THREE.SphereGeometry(bbox().getSize(new THREE.Vector3()).length()/400||.05,10,8),new THREE.MeshBasicMaterial({color:0xf59e0b,depthTest:false}));s.position.copy(p);s.renderOrder=11;mGroup.add(s)}
  const dist=a.distanceTo(b),e=document.createElement('div');e.className='cadLbl';const ft=dist/0.3048;e.textContent=`${dist.toFixed(3)} m · ${fmtFtIn(ft*12,16)}`;lbls.appendChild(e);mLabels.push({el:e,p:a.clone().add(b).multiplyScalar(.5)});q('[data-r=mres]').textContent='Last: '+e.textContent;d.lastMeasure=dist;render()};
 d.addMeasure=addMeasure;
 /* pointer */
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,e.button]});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||down[2]!==0){down=null;return}down=null;const h=pick(e);
  if(d.mode==='measure'){if(!h)return;d.mpts.push(h.point.clone());if(d.mpts.length===2){addMeasure(d.mpts[0],d.mpts[1]);d.mpts=[]}return}select(h?h.object.userData.id:null)});
 /* toolbar */
 const views={home:new THREE.Vector3(1,.8,1),top:new THREE.Vector3(0,1,0),front:new THREE.Vector3(0,0,1),right:new THREE.Vector3(1,0,0)};
 el.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b||b.tagName==='SELECT'||b.tagName==='INPUT')return;const c=b.dataset.i;
  if(c==='fit')fitTo(cam.position.clone().sub(controls.target));if(views[c])fitTo(views[c]);if(c==='xray')setXray(!d.xray);
  if(c==='hide'&&d.sel!=null){setVis(d.sel,false);const s=d.sel;select(null);d.hidden.add(s);renderTree()}
  if(c==='iso'&&d.sel!=null){for(const id of d.byId.keys())setVis(id,id===d.sel);render();renderTree()}
  if(c==='all'){for(const id of d.byId.keys())setVis(id,!isSpace(id)||q('[data-i=spaces]').checked);q('[data-i=storey]').value='';render();renderTree()}
  if(c==='secflip'){sec.flip=!sec.flip;applySec()}
  if(c==='measure'){d.mode=d.mode==='measure'?'orbit':'measure';d.mpts=[];b.classList.toggle('on',d.mode==='measure');q('[data-r=hint3]').textContent=d.mode==='measure'?'Click two points on the model to measure':'Drag to orbit · right-drag to pan · wheel to zoom';if(d.mode!=='measure'){mGroup.clear();mLabels.forEach(l=>l.el.remove());mLabels=[];render()}}
  if(c==='views')viewsDialog();if(c==='plan')planDialog();if(c==='about')aboutDialog();if(c==='close')closeDoc(d.id)});
 q('[data-i=secax]').onchange=e=>{sec.ax=e.target.value;applySec()};q('[data-i=secpos]').oninput=e=>{sec.pos=e.target.value/1000;applySec()};
 const stSel=q('[data-i=storey]');const storeys=[...new Set(storeyOf.values())];stSel.innerHTML='<option value="">All levels</option>'+storeys.map(s=>`<option value="${s}">${esc(nameOf(s)||'Level #'+s)}</option>`).join('');
 const showStorey=sid=>{for(const id of d.byId.keys())setVis(id,(!sid||storeyOf.get(id)===sid)&&(!isSpace(id)||q('[data-i=spaces]').checked));render();renderTree()};d.showStorey=showStorey;
 stSel.onchange=()=>showStorey(+stSel.value||null);q('[data-i=spaces]').onchange=()=>showStorey(+stSel.value||null);
 function viewsDialog(){modal('Saved views',`${d.views.map((v,i)=>`<div class="res" data-vw="${i}" style="display:flex;justify-content:space-between"><span>${esc(v.name)}</span><span data-vx="${i}">✕</span></div>`).join('')||'<div class="hint">No saved views yet.</div>'}<div class="row" style="gap:6px;margin-top:8px"><input class="ti" id="vwN" placeholder="Name this view"><button class="btn pri" id="vwS" style="flex:0">Save</button></div>`,[{label:'Close',cancel:1}]);
  $('#vwS').onclick=()=>{const n=$('#vwN').value.trim()||'View '+(d.views.length+1);d.views.push({name:n,pos:cam.position.toArray(),tgt:controls.target.toArray(),sec:{...sec},storey:stSel.value});LS.set('pm:ifcviews:'+name,d.views);closeModal();toast('View saved')};
  $('#modal').addEventListener('click',e=>{const x=e.target.closest('[data-vx]');if(x){e.stopPropagation();d.views.splice(+x.dataset.vx,1);LS.set('pm:ifcviews:'+name,d.views);closeModal();viewsDialog();return}const r=e.target.closest('[data-vw]');if(r){const v=d.views[+r.dataset.vw];cam.position.fromArray(v.pos);controls.target.fromArray(v.tgt);controls.update();Object.assign(sec,v.sec);stSel.value=v.storey||'';showStorey(+stSel.value||null);d.setSection(sec.ax,sec.pos,sec.flip);closeModal()}})}
 function planDialog(){modal('Level plan → PDF',`<div class="hint" style="margin-bottom:8px">Cuts the model horizontally (like a floor plan), renders it from above at a true scale, and opens it as a PDF with the scale set so you can mark up and take off.</div>
  <div class="fld"><label>Level</label><select class="ti" id="plS">${storeys.map(s=>`<option value="${s}">${esc(nameOf(s)||'Level #'+s)}</option>`).join('')}</select></div>
  <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Cut height above level</label><input class="ti" id="plC" type="number" step="0.1" value="1.2"><small style="color:var(--mut)">meters</small></div><div><label style="font-size:11px;color:var(--mut)">Scale</label><select class="ti" id="plK">${ARCH.slice(2,8).map(([l,v])=>`<option value="a:${v}" ${v===0.25?'selected':''}>${l}" = 1'-0"</option>`).join('')}${[50,100,200].map(n=>`<option value="m:${n}">1:${n}</option>`).join('')}</select></div></div>`,
  [{label:'Cancel',cancel:1},{label:'Create & open',pri:1,fn:md=>{const o={storey:+md.querySelector('#plS').value,cut:+md.querySelector('#plC').value||1.2,scale:md.querySelector('#plK').value};setTimeout(()=>levelToPdf(o).catch(e=>{console.error(e);toast('Plan failed: '+e.message)}),0)}}])}
 async function levelToPdf(o){toast('Rendering plan…');const sid=o.storey;const els=[...d.byId.keys()].filter(id=>storeyOf.get(id)===sid&&!isSpace(id));const list=els.flatMap(i=>d.byId.get(i));if(!list.length)return toast('That level has no elements');
  const b=bbox(list);const cutY=b.min.y+o.cut;const[k,v]=o.scale.split(':'),n=+v,ratio=k==='a'?12/n:n;const ptPerM=72/0.0254/ratio,dpi=150,pxPerM=ptPerM*dpi/72;
  const wM=b.max.x-b.min.x,dM=b.max.z-b.min.z;let pxW=Math.ceil(wM*pxPerM)+80,pxH=Math.ceil(dM*pxPerM)+80;const lim=8000;let f=1;if(Math.max(pxW,pxH)>lim){f=lim/Math.max(pxW,pxH);pxW=Math.ceil(pxW*f);pxH=Math.ceil(pxH*f)}
  const oc=new THREE.OrthographicCamera(-pxW/2/(pxPerM*f),pxW/2/(pxPerM*f),pxH/2/(pxPerM*f),-pxH/2/(pxPerM*f),.01,1000);const cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2;oc.position.set(cx,cutY+50,cz);oc.up.set(0,0,-1);oc.lookAt(cx,cutY,cz);oc.updateProjectionMatrix();
  const prevVis=new Map();group.traverse(o2=>{if(o2.isMesh||o2.isLineSegments){prevVis.set(o2,o2.visible);const id=o2.isMesh?o2.userData.id:o2.userData.edgeOf&&o2.userData.edgeOf.userData.id;o2.visible=storeyOf.get(id)===sid&&!isSpace(id)}});
  const rt=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});rt.setSize(pxW,pxH,false);rt.setPixelRatio(1);rt.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),cutY)];const bgc=scene.background;scene.background=new THREE.Color(0xffffff);
  const pm=new THREE.MeshBasicMaterial({color:0xeeeeee,side:THREE.FrontSide}),bm=new THREE.MeshBasicMaterial({color:0x2b2b2b,side:THREE.BackSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-8});
  const lm=new THREE.LineBasicMaterial({color:0x000000});const saved=[];group.traverse(o2=>{if(o2.isMesh||o2.isLineSegments){saved.push([o2,o2.material,o2.visible]);o2.material=o2.isMesh?pm:lm}});
  rt.render(scene,oc);rt.autoClear=false;scene.background=null;for(const[o2]of saved){if(o2.isMesh)o2.material=bm;else o2.visible=false}rt.render(scene,oc);for(const[o2,m,v]of saved){o2.material=m;o2.visible=v}pm.dispose();bm.dispose();lm.dispose();const url=rt.domElement.toDataURL('image/png');scene.background=bgc;rt.dispose();for(const[o2,vv]of prevVis)o2.visible=vv;render();
  const pdf=await PDFLib.PDFDocument.create(),pw=pxW*72/dpi,ph=pxH*72/dpi,page=pdf.addPage([pw,ph]);const png=await pdf.embedPng(url);page.drawImage(png,{x:0,y:0,width:pw,height:ph});
  const font=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);const label=k==='a'?ARCH.find(x=>x[1]===n)[0]+'" = 1\'-0"':'1:'+n;page.drawText(safeTxt(`${name} · ${nameOf(sid)||'Level'} · cut at ${o.cut} m · ${label}${f<1?' (reduced)':''}`),{x:12,y:8,size:7,font,color:PDFLib.rgb(.4,.4,.4)});
  const bytes=new Uint8Array(await pdf.save());const nm=name.replace(/\.ifc$/i,'')+' - '+(nameOf(sid)||'Level')+'.pdf';hidePane();await openBytes(bytes,nm);
  const perPt=1/(ptPerM*f);S.scales={all:{perPt,unit:'ftin',label:label+(f<1?' (reduced)':''),prec:16,dec:2}};saveScales();commit();updateScaleBtn();toast('Opened '+nm+' — scale '+label);return{perPt,pxW,pxH}}
 d.levelToPdf=levelToPdf;
 const ro=new ResizeObserver(()=>{if(CAD.visible&&CAD.cur===d.id){size();render()}});ro.observe(view);
 d.dispose=()=>{ro.disconnect();d.pause();try{renderer.dispose()}catch(e){}try{api.CloseModel(modelID)}catch(e){}};
 d.onShow=()=>requestAnimationFrame(()=>{size();if(!d.shown){d.shown=true;fitTo(views.home)}else render()});
 d.keys=e=>{if(e.target.closest('input,textarea,select'))return false;if(e.key==='Escape'){d.mpts=[];select(null);return true}if(e.key==='f'||e.key==='F'){fitTo(cam.position.clone().sub(controls.target));return true}return false};
 q('[data-r=cnt]').textContent=`${d.byId.size} elements · ${Math.round(tris).toLocaleString()} triangles · ${storeys.length} level${storeys.length===1?'':'s'}`;
 renderTree();return d}
/* =====================================================================
   entry points: open dialog, ribbon, file input, keys
   ===================================================================== */
function aboutDialog(){modal('About the CAD / BIM viewer',`<div class="hint">View-only viewers built into PlanMark. Everything runs on this device — files are not uploaded.</div>
 <table class="cadProp" style="margin-top:8px"><tr><td>DWG reader</td><td>LibreDWG (GNU, via libredwg-web) — GPL-3.0. Fine for use inside your company; if PlanMark is ever sold or given to other companies, the GPL's source-code terms apply (or swap in a commercially licensed DWG reader).</td></tr>
 <tr><td>DXF reader</td><td>LibreDWG, with dxf-parser (MIT) as fallback</td></tr><tr><td>IFC / BIM</td><td>web-ifc (MPL-2.0) + three.js (MIT)</td></tr><tr><td>Revit</td><td>Native .rvt can't be read outside Autodesk software. Export IFC from Revit (File → Export → IFC).</td></tr></table>
 <div class="hint" style="margin-top:8px">License texts are in lib/cad/LICENSES.</div>`,[{label:'Close',cancel:1}])}
function openDialog(){modal('Open CAD / BIM file',`<div class="hint">View drawings and models alongside your PDFs. You can measure, check layers and properties, and convert a sheet or level into a scaled PDF for markup and takeoff.</div>
 <table class="cadProp" style="margin:10px 0"><tr><td>.dwg</td><td>AutoCAD drawings (R14 – 2018+ formats)</td></tr><tr><td>.dxf</td><td>AutoCAD exchange format (any CAD program)</td></tr><tr><td>.ifc</td><td>BIM models — export from Revit (File → Export → IFC), ArchiCAD, Tekla, etc.</td></tr><tr><td>.rvt</td><td>Not readable outside Autodesk — export IFC instead</td></tr></table>`,
 [{label:'About / licenses',fn:()=>{setTimeout(aboutDialog,0)}},{label:'Cancel',cancel:1},{label:'Choose file…',pri:1,fn:()=>{const i=document.createElement('input');i.type='file';i.accept='.dwg,.dxf,.ifc,.rvt';i.onchange=()=>{if(i.files[0])openCadFile(i.files[0])};i.click()}}])}
const isCad=n=>/\.(dwg|dxf|ifc|rvt|rfa)$/i.test(n||'');
const _of=openFile;openFile=async function(f){if(f&&isCad(f.name))return openCadFile(f);return _of.apply(this,arguments)};
H.ribbon.push({label:'CAD/BIM',title:'Open AutoCAD (DWG/DXF) drawings and Revit/IFC models',icon:'<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6M3 9h4M17 9h4"/>',fn:openDialog});
H.ready.push(()=>{const fi=$('#fileIn');if(fi)fi.setAttribute('accept','application/pdf,.pdf,.dwg,.dxf,.ifc');
 document.addEventListener('keydown',e=>{if(!CAD.visible||modalCb)return;const d=docOf(CAD.cur);if(d&&d.keys&&d.keys(e)){e.preventDefault();e.stopImmediatePropagation()}},true);
 if(window.pmDesktop&&window.pmDesktop.onOpenFile){}});
window.PMCad={CAD,openCadBytes,openCadFile,showDoc,closeDoc,hidePane,openDialog,docOf,readCad,compile,cadToPdf};
})();
