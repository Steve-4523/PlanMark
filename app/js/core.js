
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=()=>'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc=new URL('lib/pdf.worker.min.js',location.href).href;
/* hooks used by feature modules (js/*.js) */
const H={under:[],over:[],open:[],change:[],ready:[],prefs:[],snap:null,down:null,props:[],measExtra:null,exportPage:[],ribbon:[],keys:[]};
const hook=(k,...a)=>{for(const f of H[k])try{f(...a)}catch(e){console.warn(k,e)}};

/* ---------- icons ---------- */
const IC={
 select:'<path d="M6 3l12 8.5-5.5 1.2L10 18z"/>',
 pan:'<path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v8c0 4-2.7 7-6.3 7-2.6 0-4.3-1.4-5.3-3.6L3.6 13a1.5 1.5 0 012.6-1.4L8 14"/>',
 pen:'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
 highlight:'<path d="M5 21h6"/><path d="M8 17l-2 2 2 0 1.5-1.5"/><path d="M8.5 15.5l9-12 3.5 3-9 11.5-3.5.5z"/>',
 line:'<path d="M5 19L19 5"/>',
 arrow:'<path d="M5 19L19 5M11 5h8v8"/>',
 polyline:'<path d="M3 18l5-9 6 6 7-10"/>',
 rect:'<rect x="4" y="6" width="16" height="12" rx="1"/>',
 ellipse:'<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
 polygon:'<path d="M12 3.5l8 6-3 10H7l-3-10z"/>',
 cloud:'<path d="M6 9a2.5 2.5 0 014-2 2.5 2.5 0 014.5 0A2.5 2.5 0 0118 10a2.5 2.5 0 010 4 2.5 2.5 0 01-3.5 3 2.5 2.5 0 01-5 0A2.5 2.5 0 016 14a2.5 2.5 0 010-5z"/>',
 text:'<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
 callout:'<rect x="9" y="3" width="12" height="9" rx="1"/><path d="M9 10L3 20"/>',
 note:'<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5M8 9h8M8 13h5"/>',
 stamp:'<path d="M9.5 3h5l-.8 7H18l1 5H5l1-5h4.3zM5 19h14"/>',
 calibrate:'<path d="M3 15L15 3l6 6L9 21z"/><path d="M7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2"/>',
 length:'<path d="M3 12h18M3 8v8M21 8v8"/>',
 polylength:'<path d="M3 18l5-8 5 5 8-9"/><path d="M2 16v4M20 4l2 3"/>',
 area:'<path d="M4 5h11l5 6-4 8H4z" fill="currentColor" fill-opacity=".25"/>',
 perimeter:'<path d="M4 5h11l5 6-4 8H4z" stroke-dasharray="3 2.2"/>',
 count:'<circle cx="7" cy="7.5" r="3"/><circle cx="17" cy="7.5" r="3"/><circle cx="12" cy="16.5" r="3"/>',
 angle:'<path d="M4 20h16M4 20L15 6"/><path d="M10.5 20a6.5 6.5 0 00-2.3-5"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
 redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
 open:'<path d="M3 6.5V19h18V8.5h-9L10 6.5z"/>',
 save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
 more:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 zin:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6M11 8v6"/>',
 zout:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6"/>',
 fitw:'<path d="M3 5v14M21 5v14M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
 fitp:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 8h6v8H9z"/>',
 prev:'<path d="M15 6l-6 6 6 6"/>',
 next:'<path d="M9 6l6 6-6 6"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
 lpanel:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 4v16"/>',
 rpanel:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M15 4v16"/>',
};
const icon=(k,extra='')=>`<svg viewBox="0 0 24 24" ${extra}>${IC[k]||''}</svg>`;

/* ---------- tool definitions ---------- */
const T={
 select:{label:'Select',kind:'nav'}, pan:{label:'Pan',kind:'nav'},
 pen:{label:'Pen',kind:'free'}, highlight:{label:'Highlight',kind:'free'},
 line:{label:'Line',kind:'drag'}, arrow:{label:'Arrow',kind:'drag'},
 polyline:{label:'Polyline',kind:'multi'},
 rect:{label:'Rectangle',kind:'drag',closed:1,box:1}, ellipse:{label:'Ellipse',kind:'drag',closed:1,box:1},
 polygon:{label:'Polygon',kind:'multi',closed:1}, cloud:{label:'Cloud',kind:'multi',closed:1},
 text:{label:'Text Box',kind:'drag',box:1,closed:1,txt:1}, callout:{label:'Callout',kind:'callout',txt:1},
 note:{label:'Note',kind:'click'}, stamp:{label:'Stamp',kind:'click',txt:1},
 calibrate:{label:'Calibrate',kind:'drag',meas:'len'},
 length:{label:'Length',kind:'drag',meas:'len'}, polylength:{label:'Polylength',kind:'multi',meas:'len'},
 area:{label:'Area',kind:'multi',closed:1,meas:'area'}, perimeter:{label:'Perimeter',kind:'multi',closed:1,meas:'len'},
 count:{label:'Count',kind:'count',meas:'count'}, angle:{label:'Angle',kind:'multi',max:3,meas:'angle'},
 typewriter:{label:'Typewriter',kind:'click',txt:1}, cloudplus:{label:'Cloud+',kind:'multi',closed:1,txt:1},
 texthl:{label:'Text HL',kind:'drag',textm:1}, underline:{label:'Underline',kind:'drag',textm:1}, strikeout:{label:'Strikeout',kind:'drag',textm:1},
 image:{label:'Image',kind:'drag',box:1,closed:1}, eraser:{label:'Eraser',kind:'erase'}, symbol:{label:'Symbol',kind:'click'},
 dimension:{label:'Dimension',kind:'drag',meas:'len'}, space:{label:'Space',kind:'multi',closed:1,txt:1}, legend:{label:'Legend',kind:'click'}, redact:{label:'Redact',kind:'drag',box:1,closed:1}, dfill:{label:'Fill Area',kind:'click'}, circle:{label:'Diameter',kind:'drag',meas:'circle'}, volume:{label:'Volume',kind:'multi',closed:1,meas:'area'},
};
const RIBBON=[
 ['Nav',['select','pan']],
 ['Markup',['pen','highlight','eraser','line','arrow','polyline','rect','ellipse','polygon','cloud','cloudplus','text','typewriter','callout','note','stamp','image','texthl','underline','strikeout']],
 ['Measure',['calibrate','length','dimension','polylength','area','perimeter','volume','circle','count','angle']],
];
const KEYS={select:'V',pan:'Space',pen:'Shift+P',highlight:'H',line:'L',arrow:'A',polyline:'Shift+N',rect:'R',ellipse:'E',polygon:'P',cloud:'C',text:'T',callout:'Q',note:'N',stamp:'S',calibrate:'Shift+Alt+K',length:'Shift+Alt+L',polylength:'Shift+Alt+N',area:'Shift+Alt+A',perimeter:'Shift+Alt+P',count:'Shift+Alt+C',angle:'Shift+Alt+G'};
const HINTS={typewriter:'Click where the text goes, then type',cloudplus:'Click points around the revision · Enter to finish · then type the tag',texthl:'Drag across PDF text to highlight it',underline:'Drag across PDF text to underline it',strikeout:'Drag across PDF text to strike it out',image:'Drag a box (or click) to place the image',eraser:'Click or drag over markups to erase them',symbol:'Click to place the symbol',dimension:'Drag, or click both ends · Shift = 45°',circle:'Drag from the center to the edge',volume:'Click the boundary · Enter to finish · set depth in Properties',
 select:'Click a markup to select · drag to move · drag handles to edit · drag empty space to box-select (mouse) or pan (touch)',
 pan:'Drag to pan · pinch or Ctrl+wheel to zoom',
 pen:'Drag to draw freehand', highlight:'Drag to highlight',
 line:'Drag, or click start and end · Shift = 45°', arrow:'Drag, or click start and end · Shift = 45°',
 polyline:'Click points · double-click / Enter to finish', polygon:'Click points · double-click / Enter or click first point to close',
 cloud:'Click points around the area · double-click / Enter to finish', rect:'Drag a rectangle · Shift = square', ellipse:'Drag an ellipse · Shift = circle',
 text:'Drag a box or click to place, then type', callout:'Click the arrow point, then click where the text box goes',
 note:'Click to place a note', stamp:'Click to place the stamp',
 calibrate:'Draw a line over a known dimension, then enter its real length',
 length:'Drag, or click start and end', polylength:'Click points · double-click / Enter to finish',
 area:'Click the boundary points · double-click / Enter to finish', perimeter:'Click the boundary points · double-click / Enter to finish',
 count:'Click each item to count · Enter / Finish when done', angle:'Click 3 points: start, vertex, end',
};
const RED='#e0312b',BLUE='#1f6fe5',GREEN='#2e9e44',ORANGE='#f08c00',PURPLE='#8e3fd1',TEAL='#0f9488';
const BASE_DEF={
 pen:{stroke:RED,width:2,opacity:1}, highlight:{stroke:'#ffd400',width:14,opacity:.45},
 line:{stroke:RED,width:2,opacity:1}, arrow:{stroke:RED,width:2,opacity:1,headE:'arrow'}, polyline:{stroke:RED,width:2,opacity:1},
 rect:{stroke:RED,width:2,opacity:1,fill:'none',fillOpacity:.3}, ellipse:{stroke:RED,width:2,opacity:1,fill:'none',fillOpacity:.3},
 polygon:{stroke:RED,width:2,opacity:1,fill:'none',fillOpacity:.3}, cloud:{stroke:RED,width:2,opacity:1,fill:'none',fillOpacity:.3,cloud:9},
 text:{stroke:RED,width:1,opacity:1,fill:'#ffffff',fillOpacity:1,color:RED,fontSize:12},
 callout:{stroke:RED,width:1,opacity:1,fill:'#ffffff',fillOpacity:1,color:RED,fontSize:12},
 note:{stroke:'#a67c00',width:1,opacity:1,fill:'#ffd84d',fillOpacity:1},
 stamp:{stroke:'#c62828',width:2,opacity:.9,fontSize:20},
 calibrate:{stroke:'#ff00aa',width:1.5,opacity:1,fontSize:10},
 length:{stroke:BLUE,width:1.5,opacity:1,fontSize:10}, polylength:{stroke:BLUE,width:1.5,opacity:1,fontSize:10},
 area:{stroke:GREEN,width:1.5,opacity:1,fill:GREEN,fillOpacity:.25,fontSize:10},
 perimeter:{stroke:PURPLE,width:1.5,opacity:1,fill:'none',fillOpacity:.25,fontSize:10},
 count:{stroke:ORANGE,width:1.5,opacity:1,fill:ORANGE,fillOpacity:.35,fontSize:8},
 angle:{stroke:TEAL,width:1.5,opacity:1,fontSize:10},
 typewriter:{stroke:RED,width:0,opacity:1,color:RED,fontSize:12}, cloudplus:{stroke:RED,width:2,opacity:1,fill:'none',fillOpacity:.3,cloud:9,fontSize:12},
 texthl:{stroke:'#ffd400',width:1,opacity:.45}, underline:{stroke:RED,width:1.5,opacity:1}, strikeout:{stroke:RED,width:1.5,opacity:1},
 image:{stroke:'#000000',width:0,opacity:1}, symbol:{stroke:RED,width:1.5,opacity:1,fill:'#ffffff',fillOpacity:1,fontSize:12},
 dimension:{stroke:BLUE,width:1,opacity:1,fontSize:10,headS:'arrow',headE:'arrow'}, circle:{stroke:'#0891b2',width:1.5,opacity:1,fill:'#0891b2',fillOpacity:.15,fontSize:10},
 space:{stroke:'#7c3aed',width:1.5,opacity:1,fill:'#7c3aed',fillOpacity:.1,fontSize:14,dash:'dash'}, legend:{stroke:'#111827',width:1,opacity:1,fill:'#ffffff',fillOpacity:1,fontSize:9}, redact:{stroke:'#dc2626',width:1.5,opacity:1,fill:'#000000',fillOpacity:.25,dash:'dash'},
 volume:{stroke:'#b45309',width:1.5,opacity:1,fill:'#b45309',fillOpacity:.22,fontSize:10,depth:0.3048},
};
const STAMPS=['APPROVED','APPROVED AS NOTED','REVISE & RESUBMIT','REJECTED','REVIEWED','FOR CONSTRUCTION','NOT FOR CONSTRUCTION','PRELIMINARY','VOID','AS-BUILT','COMPLETED','CONFIDENTIAL'];
const STATUSES=['','Accepted','Rejected','Cancelled','Completed','Open','In Progress'];

/* ---------- units & scale ---------- */
const PT_M=0.0254/72;
const UNITS={
 ftin:{m:0.0254,abbr:'ft-in',name:'Feet-Inches',area:'sf',aream:0.09290304},
 ft:{m:0.3048,abbr:'ft',name:'Feet',area:'sf',aream:0.09290304},
 in:{m:0.0254,abbr:'in',name:'Inches',area:'sq in',aream:0.00064516},
 yd:{m:0.9144,abbr:'yd',name:'Yards',area:'sy',aream:0.83612736},
 m:{m:1,abbr:'m',name:'Meters',area:'m²',aream:1},
 cm:{m:0.01,abbr:'cm',name:'Centimeters',area:'cm²',aream:1e-4},
 mm:{m:0.001,abbr:'mm',name:'Millimeters',area:'mm²',aream:1e-6},
};
const DEF_SCALE={perPt:PT_M,unit:'in',dec:2,prec:16,label:'1:1 (not calibrated)',none:true};
const ARCH=[['1/32',1/32],['1/16',1/16],['3/32',3/32],['1/8',1/8],['3/16',3/16],['1/4',1/4],['3/8',3/8],['1/2',1/2],['3/4',3/4],['1',1],['1-1/2',1.5],['3',3]];
const ENG=[10,20,30,40,50,60,100,200,500];
const METRIC=[1,2,5,10,20,25,50,100,200,250,500,1000,2000];
function gcd(a,b){return b?gcd(b,a%b):a}
function fmtNum(v,d){return Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtFtIn(inches,den){
 den=den||8;const neg=inches<0;inches=Math.abs(inches);
 const tot=Math.round(inches*den)/den;let ft=Math.floor(tot/12+1e-9);let rem=tot-ft*12;let wh=Math.floor(rem+1e-9);let fr=Math.round((rem-wh)*den);
 if(fr>=den){wh++;fr=0}if(wh>=12){ft++;wh-=12}
 let s=`${ft}'-${wh}`;if(fr){const g=gcd(fr,den);s+=` ${fr/g}/${den/g}`}return(neg?'-':'')+s+'"';
}
function fmtLen(meters,sc){if(sc.unit==='ftin')return fmtFtIn(meters/0.0254,sc.prec);const U=UNITS[sc.unit];return fmtNum(meters/U.m,sc.dec??2)+' '+U.abbr}
function lenNum(meters,sc){return sc.unit==='ftin'?meters/0.3048:meters/UNITS[sc.unit].m}
function lenUnit(sc){return sc.unit==='ftin'?'ft':UNITS[sc.unit].abbr}
function scaleFor(pg){return S.scales[pg]||S.scales.all||DEF_SCALE}

/* ---------- geometry ---------- */
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function polyLen(pts,closed){let s=0;for(let i=1;i<pts.length;i++)s+=dist(pts[i-1],pts[i]);if(closed&&pts.length>2)s+=dist(pts[pts.length-1],pts[0]);return s}
function polyArea(pts){let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1]}return a/2}
function centroid(pts){const A=polyArea(pts);if(Math.abs(A)<1e-6){let x=0,y=0;pts.forEach(p=>{x+=p[0];y+=p[1]});return[x/pts.length,y/pts.length]}
 let cx=0,cy=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length],c=p[0]*q[1]-q[0]*p[1];cx+=(p[0]+q[0])*c;cy+=(p[1]+q[1])*c}return[cx/(6*A),cy/(6*A)]}
function normBox(a,b){return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]}
function ptsBox(pts){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of pts){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}return[x0,y0,x1,y1]}
function snap45(a,p){const ang=Math.atan2(p[1]-a[1],p[0]-a[0]);const s=Math.round(ang/(Math.PI/4))*(Math.PI/4);const L=dist(a,p);return[a[0]+Math.cos(s)*L,a[1]+Math.sin(s)*L]}
function constrain(a,p,e,type){if(!e||!e.shiftKey)return p;if(T[type]&&T[type].box){const dx=p[0]-a[0],dy=p[1]-a[1],s=Math.max(Math.abs(dx),Math.abs(dy));return[a[0]+Math.sign(dx||1)*s,a[1]+Math.sign(dy||1)*s]}return snap45(a,p)}
function simplify(pts,eps){if(pts.length<3)return pts;const keep=new Array(pts.length).fill(false);keep[0]=keep[pts.length-1]=true;const st=[[0,pts.length-1]];
 while(st.length){const[a,b]=st.pop();let md=0,mi=-1;const A=pts[a],B=pts[b],L=dist(A,B)||1e-9;
  for(let i=a+1;i<b;i++){const P=pts[i];const d=Math.abs((B[0]-A[0])*(A[1]-P[1])-(A[0]-P[0])*(B[1]-A[1]))/L;if(d>md){md=d;mi=i}}
  if(md>eps&&mi>0){keep[mi]=true;st.push([a,mi],[mi,b])}}return pts.filter((_,i)=>keep[i])}
const P2=p=>p[0].toFixed(2)+' '+p[1].toFixed(2);
function dPoly(pts,closed){if(!pts.length)return'';return'M'+pts.map(P2).join(' L')+(closed?' Z':'')}
function dBox(b){return dPoly([[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],true)}
function dEll(b){const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,rx=(b[2]-b[0])/2,ry=(b[3]-b[1])/2,a=[];for(let i=0;i<72;i++){const t=i/72*Math.PI*2;a.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t)])}return dPoly(a,true)}
function dCircle(p,r){return`M${(p[0]-r).toFixed(2)} ${p[1].toFixed(2)} A${r} ${r} 0 1 0 ${(p[0]+r).toFixed(2)} ${p[1].toFixed(2)} A${r} ${r} 0 1 0 ${(p[0]-r).toFixed(2)} ${p[1].toFixed(2)} Z`}
function dCloud(pts,r){const A=polyArea(pts),sw=A>=0?1:0,n=pts.length;let d='M'+P2(pts[0]);
 for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],L=dist(a,b);if(L<0.01)continue;const k=Math.max(1,Math.round(L/(r*2))),rr=(L/k/2*1.0001).toFixed(2);
  for(let j=1;j<=k;j++){d+=` A${rr} ${rr} 0 0 ${sw} ${(a[0]+(b[0]-a[0])*j/k).toFixed(2)} ${(a[1]+(b[1]-a[1])*j/k).toFixed(2)}`}}return d+' Z'}
function readable(a,b){let ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;return ang}

/* ---------- text measuring ---------- */
const mctx=document.createElement('canvas').getContext('2d');
const FONTS={Helvetica:'Helvetica,Arial,sans-serif',Times:'"Times New Roman",Times,serif',Courier:'"Courier New",Courier,monospace'};
function tw(t,fs,bold,font,italic){mctx.font=`${italic?'italic ':''}${bold?'bold ':''}${fs}px ${FONTS[font]||FONTS.Helvetica}`;return mctx.measureText(t).width}
function wrap(text,maxW,fs,st){st=st||{};const out=[];for(const para of String(text||'').split('\n')){let line='';for(const w of para.split(' ')){const t=line?line+' '+w:w;if(!line||tw(t,fs,st.bold,st.font,st.italic)<=maxW)line=t;else{out.push(line);line=w}}out.push(line)}return out}
const fmtDate=t=>{const d=new Date(t);return d.toLocaleDateString(undefined,{year:'numeric',month:'2-digit',day:'2-digit'})};
const fmtDT=t=>{const d=new Date(t);return d.toLocaleDateString(undefined,{month:'2-digit',day:'2-digit',year:'2-digit'})+' '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};

/* ---------- state ---------- */
const settings=Object.assign({author:'User',wheelZoom:true},LS.get('pm:settings',{}));
const S={pdf:null,bytes:null,fileName:'',fileKey:'',pages:[],markups:[],sel:new Set(),tool:'pan',lock:false,zoom:1,scales:{},
 defaults:(()=>{const d=clone(BASE_DEF),u=LS.get('pm:defaults',{});for(const k in u)if(d[k])Object.assign(d[k],u[k]);return d})(),
 chest:LS.get('pm:chest',null),chestSel:null,chestStyle:null,toolSubject:null,stampText:'APPROVED',
 undo:[],redo:[],drawing:null,countId:null,clip:null,listSort:{k:'page',dir:1},summary:false,pinch:null,cur:1,flash:null,textCache:{},lastUp:0};
if(!S.chest)S.chest=[
 {name:'Revision Cloud',type:'cloud',subject:'Revision',style:{stroke:RED,width:2,opacity:1,fill:'none',fillOpacity:.3,cloud:9}},
 {name:'Wall Length',type:'polylength',subject:'Wall',style:{stroke:BLUE,width:2,opacity:1,fontSize:10}},
 {name:'Floor Area',type:'area',subject:'Flooring',style:{stroke:GREEN,width:1.5,opacity:1,fill:GREEN,fillOpacity:.25,fontSize:10}},
 {name:'Drywall Area',type:'area',subject:'Drywall',style:{stroke:'#7c3aed',width:1.5,opacity:1,fill:'#7c3aed',fillOpacity:.2,fontSize:10}},
 {name:'Outlets',type:'count',subject:'Electrical Outlet',style:{stroke:ORANGE,width:1.5,opacity:1,fill:ORANGE,fillOpacity:.35,fontSize:8}},
 {name:'Light Fixtures',type:'count',subject:'Light Fixture',style:{stroke:'#0284c7',width:1.5,opacity:1,fill:'#0284c7',fillOpacity:.35,fontSize:8}},
 {name:'RFI Callout',type:'callout',subject:'RFI',style:{stroke:'#d97706',width:1,opacity:1,fill:'#fff7ed',fillOpacity:1,color:'#b45309',fontSize:11}},
 {name:'Approved Stamp',type:'stamp',subject:'Stamp',text:'APPROVED',style:{stroke:'#15803d',width:2,opacity:.9,fontSize:20}},
];
const byId=id=>S.markups.find(m=>m.id===id);
function toolStyle(t){return Object.assign({},S.defaults[t]||{},S.chestStyle&&S.tool===t?S.chestStyle:{})}
function defSubject(t){return T[t].meas?T[t].label+' Measurement':T[t].label}

/* ---------- primitives (shared by screen + PDF export) ---------- */
function measOf(m){const t=T[m.type];if(!t||!t.meas)return null;const sc=m.scale||scaleFor(m.page),pts=m.pts;
 if(t.meas==='circle'){if(pts.length<2)return null;const r=dist(pts[0],pts[1])*sc.perPt,U=UNITS[sc.unit],a=Math.PI*r*r;return{kind:'len',raw:2*r,v:lenNum(2*r,sc),unit:lenUnit(sc),text:'Ø '+fmtLen(2*r,sc),sc,extra:{kind:'carea',raw:a,v:a/U.aream,unit:U.area,text:fmtNum(a/U.aream,sc.dec??2)+' '+U.area}}}
 if(t.meas==='len'){if(pts.length<2)return null;const meters=polyLen(pts,m.type==='perimeter')*sc.perPt;const r={kind:'len',raw:meters,v:lenNum(meters,sc),unit:lenUnit(sc),text:fmtLen(meters,sc),sc};if(m.height>0&&m.type!=='calibrate'){const a=meters*m.height,U=UNITS[sc.unit];r.extra={kind:'warea',raw:a,v:a/U.aream,unit:U.area,text:fmtNum(a/U.aream,sc.dec??2)+' '+U.area+' wall'}}return r}
 if(t.meas==='area'){if(pts.length<3)return null;const U=UNITS[sc.unit],a=(Math.abs(polyArea(pts))-(m.holes||[]).reduce((s,h)=>s+Math.abs(polyArea(h)),0))*sc.perPt*sc.perPt;const r={kind:'area',raw:a,v:a/U.aream,unit:U.area,text:fmtNum(a/U.aream,sc.dec??2)+' '+U.area,sc};if(m.depth>0)r.extra=volOf(a*m.depth,sc);return r}
 if(t.meas==='count')return{kind:'count',raw:pts.length,v:pts.length,unit:'ea',text:pts.length+' ea',sc};
 if(t.meas==='angle'){if(pts.length<3)return null;const[a,v,b]=pts;let d=Math.atan2(b[1]-v[1],b[0]-v[0])-Math.atan2(a[1]-v[1],a[0]-v[0]);while(d>Math.PI)d-=2*Math.PI;while(d<=-Math.PI)d+=2*Math.PI;const deg=Math.abs(d)*180/Math.PI;return{kind:'angle',raw:deg,v:deg,unit:'°',text:deg.toFixed(1)+'°',sc}}
 return null}
function volOf(m3,sc){const imp=['ftin','ft','yd','in'].includes(sc.unit),d=sc.dec??2;if(sc.unit==='in'){const v=m3/1.6387064e-5;return{kind:'vol',raw:m3,v,unit:'cu in',text:fmtNum(v,d)+' cu in'}}
 if(imp){const cf=m3/0.028316846592,cy=cf/27;return{kind:'vol',raw:m3,v:cf,unit:'cu ft',text:fmtNum(cf,d)+' cu ft ('+fmtNum(cy,d)+' cu yd)'}}const U={m:[1,'m³'],cm:[1e-6,'cm³'],mm:[1e-9,'mm³']}[sc.unit]||[1,'m³'];return{kind:'vol',raw:m3,v:m3/U[0],unit:U[1],text:fmtNum(m3/U[0],d)+' '+U[1]}}
function measLabel(m){const r=measOf(m);if(!r)return'';return(m.label?m.label+': ':'')+r.text+(r.extra?' · '+r.extra.text:'')}
function arrowHead(from,to,s){const w=s.width??1,sz=Math.max(7,w*4.5),a=Math.atan2(to[1]-from[1],to[0]-from[0]);
 const p1=[to[0]-sz*Math.cos(a-0.4),to[1]-sz*Math.sin(a-0.4)],p2=[to[0]-sz*Math.cos(a+0.4),to[1]-sz*Math.sin(a+0.4)];
 return{k:'p',d:dPoly([to,p1,p2],true),stroke:s.stroke,w,so:s.opacity??1,fill:s.stroke,fo:1}}
function leaderEnd(tip,b){const c=[[(b[0]+b[2])/2,b[1]],[(b[0]+b[2])/2,b[3]],[b[0],(b[1]+b[3])/2],[b[2],(b[1]+b[3])/2]];let best=c[0],bd=1e18;for(const p of c){const d=dist(p,tip);if(d<bd){bd=d;best=p}}return best}
function stampGeom(m){const fs=m.style.fontSize||20,text=m.text||'STAMP',sub=`${m.author||''}  ${fmtDT(m.created||Date.now())}`.trim();
 const w=Math.max(tw(text,fs,true),tw(sub,fs*.38))+fs*1.4,h=fs*2.15,[cx,cy]=m.pts[0];return{b:[cx-w/2,cy-h/2,cx+w/2,cy+h/2],cx,cy,sub,text}}
function prims(m){
 const s=m.style,pts=m.pts,fs=s.fontSize||10,o=s.opacity??1,out=[];
 const fill=(s.fill&&s.fill!=='none')?s.fill:null,fo=s.fillOpacity??1;
 const L=(d,x={})=>out.push(Object.assign({k:'p',d,stroke:s.stroke,w:s.width??1,so:o,fill:null,fo:1,dash:s.dash===true?'dash':(s.dash||'')},x));
 const heads=(P)=>{if(P.length<2)return;const hs=s.headS||'',he=s.headE||'';if(hs)headPrim(out,P[1],P[0],s,hs);if(he)headPrim(out,P[P.length-2],P[P.length-1],s,he)};
 const TX=(x,y,str,e={})=>out.push(Object.assign({k:'t',x,y,s:str,size:fs,color:s.stroke,bold:true,ang:0,align:'middle',halo:true,o},e));
 const ft={font:s.font,bold:!!s.bold,italic:!!s.italic};
 const boxText=(b)=>{const pad=Math.max(3,fs*.35),lines=wrap(m.text,b[2]-b[0]-pad*2,fs,ft);lines.forEach((ln,i)=>TX(b[0]+pad,b[1]+pad+fs*1.2*(i+.5),ln,Object.assign({color:s.color||s.stroke,align:'start',halo:false},ft)))};
 const ticks=(a,b)=>{const an=Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2,t=fs*.6,dx=Math.cos(an)*t,dy=Math.sin(an)*t;L(dPoly([[a[0]-dx,a[1]-dy],[a[0]+dx,a[1]+dy]]),{dash:false});L(dPoly([[b[0]-dx,b[1]-dy],[b[0]+dx,b[1]+dy]]),{dash:false})};
 const along=(a,b,str)=>{const ang=readable(a,b),r=ang*Math.PI/180,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;TX(mx+Math.sin(r)*fs*.85,my-Math.cos(r)*fs*.85,str,{ang})};
 switch(m.type){
 case'pen':L(dPoly(pts));break;
 case'highlight':L(dPoly(pts),{blend:1});break;
 case'line':case'polyline':case'arrow':L(dPoly(pts));if(pts.length>1&&dist(pts[0],pts[pts.length-1])>0.1)heads(pts);break;
 case'typewriter':{const g=typeGeom(m);g.lines.forEach((ln,i)=>TX(g.b[0],g.b[1]+fs*1.2*(i+.5),ln,Object.assign({color:s.color||s.stroke,align:'start',halo:false},ft)));if((s.width||0)>0)L(dBox(g.b),{dash:''});break}
 case'cloudplus':{L(pts.length>2?dCloud(pts,s.cloud||9):dPoly(pts),{fill,fo,dash:''});if(pts.length>2&&m.text){const g=cloudTag(m);L(dBox(g.b),{fill:'#ffffff',fo:1,dash:''});g.lines.forEach((ln,i)=>TX(g.b[0]+g.pad,g.b[1]+g.pad+fs*1.2*(i+.5),ln,Object.assign({align:'start',halo:false},ft)))}break}
 case'texthl':case'underline':case'strikeout':{const R=m.rects||[normBox(pts[0],pts[1])];for(const r of R){if(m.type==='texthl')L(dBox(r),{fill:s.stroke,fo:1,stroke:null,blend:1});else{const y=m.type==='underline'?r[3]-(r[3]-r[1])*.06:(r[1]+r[3])/2;L(dPoly([[r[0],y],[r[2],y]]),{dash:''})}}break}
 case'image':{const b=normBox(pts[0],pts[1]);out.push({k:'img',b,src:m.img,o});if((s.width||0)>0)L(dBox(b),{dash:''});break}
 case'space':{L(dPoly(pts,pts.length>2),{fill,fo});if(pts.length>2&&m.text){const c=centroid(pts);TX(c[0],c[1],m.text,{halo:true,size:fs})}break}
 case'redact':{const b=normBox(pts[0],pts[1]);L(dBox(b),{fill,fo});L(dPoly([[b[0],b[1]],[b[2],b[3]]]),{w:.6,dash:''});L(dPoly([[b[2],b[1]],[b[0],b[3]]]),{w:.6,dash:''});break}
 case'legend':if(H.legendPrims)H.legendPrims(m,out,L,TX);break;
 case'symbol':if(H.symbolPrims)H.symbolPrims(m,out,L,TX);break;
 case'dimension':{if(pts.length<2)break;const[a,b]=pts,an=Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2,ex=fs*1.1,dx=Math.cos(an)*ex,dy=Math.sin(an)*ex;L(dPoly([a,b]));heads([a,b]);L(dPoly([[a[0]-dx,a[1]-dy],[a[0]+dx*.4,a[1]+dy*.4]]),{dash:''});L(dPoly([[b[0]-dx,b[1]-dy],[b[0]+dx*.4,b[1]+dy*.4]]),{dash:''});along(a,b,measLabel(m));break}
 case'circle':{if(pts.length<2)break;const[c,e]=pts,r=dist(c,e);L(dCircle(c,r),{fill,fo});L(dPoly([c,e]),{dash:'dash'});L(dCircle(c,Math.max(1,fs*.12)),{fill:s.stroke,fo:1});TX(c[0],c[1]-fs*.9,measLabel(m));break}
 case'volume':{L(dPoly(pts,pts.length>2)+(m.holes||[]).map(h=>' '+dPoly(h,true)).join(''),{fill,fo});if(pts.length>2){const c=centroid(pts);TX(c[0],c[1],measLabel(m))}break}
 case'rect':case'text':{const b=normBox(pts[0],pts[1]);L(dBox(b),{fill,fo,stroke:(s.width??1)>0?s.stroke:null});if(m.type==='text')boxText(b);break}
 case'ellipse':L(dEll(normBox(pts[0],pts[1])),{fill,fo});break;
 case'polygon':L(dPoly(pts,pts.length>2),{fill,fo});break;
 case'cloud':L(pts.length>2?dCloud(pts,s.cloud||9):dPoly(pts),{fill,fo,dash:false});break;
 case'callout':{const tip=pts[0];if(pts.length<3){L(dPoly(pts));break}const b=normBox(pts[1],pts[2]),e=leaderEnd(tip,b);L(dPoly([e,tip]));out.push(arrowHead(e,tip,s));L(dBox(b),{fill,fo});boxText(b);break}
 case'note':{const[x,y]=pts[0];L(dPoly([[x,y],[x+18,y],[x+18,y+13],[x+13,y+18],[x,y+18]],true),{fill:fill||'#ffd84d',fo:1,w:1,dash:false});
  L(dPoly([[x+4,y+5],[x+14,y+5]]),{w:1,dash:false});L(dPoly([[x+4,y+9],[x+14,y+9]]),{w:1,dash:false});L(dPoly([[x+4,y+13],[x+10,y+13]]),{w:1,dash:false});break}
 case'stamp':{const g=stampGeom(m),b=g.b,w=s.width??2,ins=w*1.8;L(dBox(b),{w,dash:false});L(dBox([b[0]+ins,b[1]+ins,b[2]-ins,b[3]-ins]),{w:w*.5,dash:false});
  TX(g.cx,b[1]+ins+fs*.78,g.text,{halo:false});TX(g.cx,b[3]-ins-fs*.33,g.sub,{size:fs*.38,bold:false,halo:false});break}
 case'calibrate':case'length':{if(pts.length<2)break;const[a,b]=pts;L(dPoly([a,b]));ticks(a,b);const t=m.type==='calibrate'?(S.drawing&&S.drawing===m?fmtLen(dist(a,b)*scaleFor(m.page).perPt,scaleFor(m.page)):''):measLabel(m);if(t)along(a,b,t);break}
 case'polylength':{if(pts.length<2)break;L(dPoly(pts));ticks(pts[0],pts[1]);if(pts.length>2){const n=pts.length;ticks(pts[n-2],pts[n-1])}
  let bi=1,bl=0;for(let i=1;i<pts.length;i++){const d=dist(pts[i-1],pts[i]);if(d>bl){bl=d;bi=i}}along(pts[bi-1],pts[bi],measLabel(m));break}
 case'area':case'perimeter':{L(dPoly(pts,pts.length>2)+(m.holes||[]).map(h=>' '+dPoly(h,true)).join(''),{fill,fo});if(pts.length>2){const c=centroid(pts);TX(c[0],c[1],measLabel(m))}else if(pts.length===2&&m.type==='perimeter'){}break}
 case'count':{const r=fs*.7;pts.forEach(p=>L(dCircle(p,r),{fill,fo,dash:false}));pts.forEach(p=>L(dPoly([[p[0]-r*.45,p[1]+r*.02],[p[0]-r*.1,p[1]+r*.38],[p[0]+r*.48,p[1]-r*.35]]),{w:Math.max(.8,(s.width??1)*.8),dash:false}));
  if(pts.length)TX(pts[0][0]+r*1.3,pts[0][1]-r*1.5,(m.label?m.label+' ':'')+pts.length,{align:'start',size:fs*1.1});break}
 case'angle':{L(dPoly(pts));if(pts.length===3){const[a,v,b]=pts,r=Math.min(fs*3,dist(a,v)*.45,dist(b,v)*.45),t1=Math.atan2(a[1]-v[1],a[0]-v[0]),t2=Math.atan2(b[1]-v[1],b[0]-v[0]);
  let d=t2-t1;while(d>Math.PI)d-=2*Math.PI;while(d<=-Math.PI)d+=2*Math.PI;const p1=[v[0]+r*Math.cos(t1),v[1]+r*Math.sin(t1)],p2=[v[0]+r*Math.cos(t2),v[1]+r*Math.sin(t2)];
  if(r>0.5)L(`M${P2(p1)} A${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${d>0?1:0} ${P2(p2)}`,{dash:false});const bis=t1+d/2,lr=r+fs*1.3;TX(v[0]+lr*Math.cos(bis),v[1]+lr*Math.sin(bis),measLabel(m))}break}
 }
 return out}
function headPrim(out,from,to,s,kind){const w=s.width??1,sz=Math.max(7,w*4.5),a=Math.atan2(to[1]-from[1],to[0]-from[0]),so=s.opacity??1;
 if(kind==='arrow'||kind==='open'){const p1=[to[0]-sz*Math.cos(a-.4),to[1]-sz*Math.sin(a-.4)],p2=[to[0]-sz*Math.cos(a+.4),to[1]-sz*Math.sin(a+.4)];out.push({k:'p',d:kind==='arrow'?dPoly([to,p1,p2],true):dPoly([p1,to,p2]),stroke:s.stroke,w,so,fill:kind==='arrow'?s.stroke:null,fo:1})}
 else if(kind==='dot')out.push({k:'p',d:dCircle(to,sz*.35),stroke:s.stroke,w,so,fill:s.stroke,fo:1});
 else if(kind==='tick'){const t=sz*.6,b=a+Math.PI/4;out.push({k:'p',d:dPoly([[to[0]-Math.cos(b)*t,to[1]-Math.sin(b)*t],[to[0]+Math.cos(b)*t,to[1]+Math.sin(b)*t]]),stroke:s.stroke,w,so,fill:null,fo:1})}
 else if(kind==='bar'){const t=sz*.6,b=a+Math.PI/2;out.push({k:'p',d:dPoly([[to[0]-Math.cos(b)*t,to[1]-Math.sin(b)*t],[to[0]+Math.cos(b)*t,to[1]+Math.sin(b)*t]]),stroke:s.stroke,w,so,fill:null,fo:1})}}
function typeGeom(m){const s=m.style,fs=s.fontSize||12,st={font:s.font,bold:s.bold,italic:s.italic},lines=String(m.text||' ').split('\n');const w=Math.max(fs,...lines.map(l=>tw(l,fs,st.bold,st.font,st.italic)));const[x,y]=m.pts[0];return{b:[x,y,x+w,y+lines.length*fs*1.2],lines}}
function cloudTag(m){const s=m.style,fs=s.fontSize||12,st={font:s.font,bold:s.bold,italic:s.italic},pad=fs*.35,lines=String(m.text||'').split('\n'),w=Math.max(...lines.map(l=>tw(l,fs,st.bold,st.font,st.italic)))+pad*2,h=lines.length*fs*1.2+pad*2,b=ptsBox(m.pts);return{b:[b[2]-w*.2,b[1]-h*.8,b[2]-w*.2+w,b[1]-h*.8+h],lines,pad}}
const DASH={dash:[4,3],dot:[.01,2.2],dashdot:[5,2,.01,2],longdash:[9,4]};
function dashArr(p){const d=DASH[p.dash];return d?d.map(v=>+(v*Math.max(p.w,.6)).toFixed(2)):null}
function primSvg(p){
 if(p.k==='p')return`<path d="${p.d}" fill-rule="evenodd" fill="${p.fill||'none'}"${p.fill?` fill-opacity="${(p.fo*p.so).toFixed(3)}"`:''} ${p.stroke?`stroke="${p.stroke}" stroke-width="${p.w}" stroke-opacity="${p.so}"`:'stroke="none"'}${p.dash&&p.stroke&&dashArr(p)?` stroke-dasharray="${dashArr(p).join(' ')}"`:''} stroke-linejoin="round" stroke-linecap="round"${p.blend?' style="mix-blend-mode:multiply"':''}/>`;
 if(p.k==='img')return`<image href="${p.src||''}" x="${p.b[0]}" y="${p.b[1]}" width="${p.b[2]-p.b[0]}" height="${p.b[3]-p.b[1]}" preserveAspectRatio="none" opacity="${p.o}"/>`;
 return`<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" font-size="${p.size}" fill="${p.color}" fill-opacity="${p.o}" text-anchor="${p.align==='middle'?'middle':'start'}" dominant-baseline="central" font-family='${FONTS[p.font]||FONTS.Helvetica}'${p.bold?' font-weight="bold"':''}${p.italic?' font-style="italic"':''}${p.ang?` transform="rotate(${p.ang.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})"`:''}${p.halo?` stroke="#fff" stroke-width="${(p.size*.28).toFixed(2)}" stroke-opacity="${p.o}" paint-order="stroke" stroke-linejoin="round"`:''}>${esc(p.s)}</text>`}
function bboxOf(m){if(m.type==='stamp')return stampGeom(m).b;if(m.type==='typewriter')return typeGeom(m).b;if(m.type==='legend'&&H.legendBox)return H.legendBox(m);if(m.type==='symbol'&&H.symbolBox)return H.symbolBox(m);if(m.type==='circle'&&m.pts.length>1){const r=dist(m.pts[0],m.pts[1]);return[m.pts[0][0]-r,m.pts[0][1]-r,m.pts[0][0]+r,m.pts[0][1]+r]}if(m.type==='cloudplus'&&m.text&&m.pts.length>2){const a=ptsBox(m.pts),b=cloudTag(m).b;return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]}if(T[m.type]&&T[m.type].textm&&m.rects&&m.rects.length)return ptsBox(m.rects.flatMap(r=>[[r[0],r[1]],[r[2],r[3]]]));if(m.type==='note'){const[x,y]=m.pts[0];return[x,y,x+18,y+18]}
 const b=ptsBox(m.pts);if(m.type==='count'){const r=(m.style.fontSize||8)*.7;return[b[0]-r,b[1]-r,b[2]+r,b[3]+r]}return b}
function markupSvg(m,prev){const ps=prims(m);let h=ps.map(primSvg).join('');
 if(prev)return`<g pointer-events="none" opacity=".9">${h}</g>`;
 const t=T[m.type];let hd='',all=t.closed||t.textm||['count','note','stamp','text','callout','typewriter','symbol','circle'].includes(m.type);
 if(['stamp','note','typewriter','symbol','image','legend'].includes(m.type)||t.textm)hd=dBox(bboxOf(m));else hd=ps.filter(p=>p.k==='p').map(p=>p.d).join(' ');
 const hw=Math.max((m.style.width||1)+4,10/S.zoom);
 return`<g class="mk" data-id="${m.id}">${h}<path class="hit" d="${hd}" stroke-width="${hw.toFixed(2)}" pointer-events="${all?'all':'stroke'}"/></g>`}
function handlesOf(m){const t=T[m.type];if(['pen','highlight','note','stamp','typewriter','symbol','legend'].includes(m.type)||t.textm)return[];
 const corners=(a,b,pre)=>{const x=normBox(a,b);return[[x[0],x[1],pre+'0'],[x[2],x[1],pre+'1'],[x[2],x[3],pre+'2'],[x[0],x[3],pre+'3']]};
 if(t.box)return corners(m.pts[0],m.pts[1],'c');if(m.type==='callout'&&m.pts.length>2)return[[m.pts[0][0],m.pts[0][1],'p0'],...corners(m.pts[1],m.pts[2],'c')];
 return m.pts.map((p,i)=>[p[0],p[1],'p'+i])}
function applyHandle(m,k,pt,orig){const i=+k.slice(1);
 if(k[0]==='p'){m.pts[i]=pt;return}
 const off=m.type==='callout'?1:0,b=normBox(orig[off],orig[off+1]);
 if(i===0||i===3)b[0]=pt[0];else b[2]=pt[0];if(i<2)b[1]=pt[1];else b[3]=pt[1];
 m.pts[off]=[b[0],b[1]];m.pts[off+1]=[b[2],b[3]]}

/* ---------- rendering pages ---------- */
const viewer=$('#viewer'),pagesEl=$('#pages');
function redrawPage(n){const p=S.pages[n-1];if(!p)return;let h='';
 for(const f of H.under)try{h+=f(n,p)||''}catch(e){console.warn(e)}
 for(const m of S.markups)if(m.page===n&&!m.hidden)h+=markupSvg(m);
 if(S.drawing&&S.drawing.page===n){const d=S.drawing,pm=Object.assign({},d,{pts:d.cursor?[...d.pts,d.cursor]:d.pts,author:settings.author,created:Date.now(),text:d.type==='stamp'?S.stampText:''});
  if(T[d.type].kind==='multi'||T[d.type].kind==='callout'){pm.type=(d.type==='cloud'&&pm.pts.length<3)?'polyline':d.type;if(d.type==='callout')pm.type='arrow';}
  h+=markupSvg(pm,true);
  const r=4/S.zoom;h+=d.pts.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="#fff" stroke="#3d8bfd" stroke-width="${1.5/S.zoom}" pointer-events="none"/>`).join('')}
 if(G&&G.k==='marquee'&&G.p===p){const b=normBox(G.a,G.b);h+=`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="rgba(61,139,253,.12)" stroke="#3d8bfd" stroke-width="${1/S.zoom}" stroke-dasharray="${4/S.zoom}"/>`}
 for(const id of S.sel){const m=byId(id);if(!m||m.page!==n)continue;const b=bboxOf(m),pd=4/S.zoom;
  h+=`<rect x="${b[0]-pd}" y="${b[1]-pd}" width="${b[2]-b[0]+2*pd}" height="${b[3]-b[1]+2*pd}" fill="none" stroke="#3d8bfd" stroke-width="${1/S.zoom}" stroke-dasharray="${4/S.zoom} ${3/S.zoom}" pointer-events="none"/>`;
  const r=5.5/S.zoom;for(const[x,y,k]of handlesOf(m))h+=`<circle class="hd" data-h="${m.id}|${k}" cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#3d8bfd" stroke-width="${1.6/S.zoom}"/>`}
 if(S.flash&&S.flash.page===n){const b=S.flash.r;h+=`<rect x="${b[0]-2}" y="${b[1]-2}" width="${b[2]-b[0]+4}" height="${b[3]-b[1]+4}" fill="rgba(250,204,21,.35)" stroke="#f59e0b" stroke-width="${2/S.zoom}" pointer-events="none"/>`}
 for(const f of H.over)try{h+=f(n,p)||''}catch(e){console.warn(e)}
 p.svg.innerHTML=h}
function redrawAll(){S.pages.forEach(p=>redrawPage(p.num))}
function targetScale(p){const dpr=Math.min(window.devicePixelRatio||1,3);return Math.min(S.zoom*dpr,Math.sqrt(16e6/(p.w*p.h)),8192/Math.max(p.w,p.h))}
async function renderPage(p){const s=targetScale(p);if(Math.abs((p.rs||0)-s)<1e-3)return;if(p.task){if(Math.abs(p.taskScale-s)<1e-3)return;try{p.task.cancel()}catch(e){}}
 const doc=S.pdf;const page=await doc.getPage(p.num);if(doc!==S.pdf)return;const vp=page.getViewport({scale:s});const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
 const task=page.render({canvasContext:c.getContext('2d'),viewport:vp});p.task=task;p.taskScale=s;
 try{await task.promise;if(doc!==S.pdf)return;p.canvas.replaceWith(c);p.canvas=c;p.rs=s}catch(e){}finally{if(p.task===task)p.task=null}}
let rT=0;function scheduleRender(){clearTimeout(rT);rT=setTimeout(renderVisible,140)}
function renderVisible(){for(const p of S.pages){if(p.vis)renderPage(p);else if(p.rs&&Math.abs(p.num-S.cur)>3){p.canvas.width=1;p.canvas.height=1;p.rs=0}}}
const io=new IntersectionObserver(es=>{for(const e of es){const p=S.pages[+e.target.dataset.p-1];if(p)p.vis=e.isIntersecting}scheduleRender()},{root:viewer,rootMargin:'400px'});

/* ---------- open / build ---------- */
async function openFile(f){if(!f)return;if(!/pdf$/i.test(f.type)&&!/\.pdf$/i.test(f.name)){toast('Please choose a PDF file');return}
 const b=new Uint8Array(await f.arrayBuffer());await openBytes(b,f.name)}
async function openBytes(bytes,name,restored){
 if(!window.pdfjsLib){toast('PDF engine failed to load — check your connection');return}
 toast('Opening '+name+'…');let pdf;
 try{pdf=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise}catch(e){toast('Could not open PDF: '+(e.message||e));return}
 let embedded=null;
 if(!restored){try{const att=await pdf.getAttachments();if(att){const vals=Object.values(att);const o=vals.find(a=>/planmark-original\.pdf$/.test(a.filename)),j=vals.find(a=>/planmark-markups\.json$/.test(a.filename));
  if(o&&j){embedded=JSON.parse(new TextDecoder().decode(j.content));await pdf.destroy();return openBytes(new Uint8Array(o.content),name,embedded)}}}catch(e){console.warn(e)}}
 if(S.pdf)try{S.pdf.destroy()}catch(e){}
 for(const p of S.pages)io.unobserve(p.el);
 Object.assign(S,{pdf,bytes,fileName:name,fileKey:'pm:doc:'+name+':'+bytes.length,pages:[],markups:[],scales:{},undo:[],redo:[],drawing:null,countId:null,textCache:{},flash:null,cur:1});S.sel.clear();
 pagesEl.innerHTML='';$('#empty').style.display='none';
 for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const vp=pg.getViewport({scale:1});
  const el=document.createElement('div');el.className='page';el.dataset.p=i;
  el.innerHTML=`<canvas width="1" height="1"></canvas><svg class="ov" viewBox="0 0 ${vp.width} ${vp.height}" preserveAspectRatio="none"></svg><span class="pn">${i}</span>`;
  pagesEl.appendChild(el);const p={num:i,vp,w:vp.width,h:vp.height,el,canvas:el.querySelector('canvas'),svg:el.querySelector('svg'),rs:0,vis:false};S.pages.push(p);io.observe(el)}
 const saved=restored||LS.get(S.fileKey,null);
 if(saved){S.markups=saved.markups||[];S.scales=saved.scales||{};if(S.markups.length)setTimeout(()=>toast(`${restored?'Loaded':'Restored'} ${S.markups.length} markup${S.markups.length===1?'':'s'}`),400)}
 $('#pageTot').textContent='/ '+pdf.numPages;['bSave','bMore'].forEach(id=>$('#'+id).disabled=false);
 document.title=name+' — PlanMark';
 fitWidth();commit(true);buildThumbs();updateCur();setTool('pan');hook('open',{restored});
}
async function blankSheet(){if(!window.PDFLib){toast('PDF engine failed to load');return}
 const d=await PDFLib.PDFDocument.create();const pg=d.addPage([2592,1728]);const f=await d.embedFont(PDFLib.StandardFonts.Helvetica);const g=PDFLib.rgb(.75,.78,.82);
 pg.drawRectangle({x:36,y:36,width:2520,height:1656,borderColor:PDFLib.rgb(.2,.2,.2),borderWidth:2});
 for(let x=72;x<2556;x+=72)pg.drawLine({start:{x,y:36},end:{x,y:1692},thickness:.35,color:g});
 for(let y=72;y<1692;y+=72)pg.drawLine({start:{x:36,y},end:{x:2556,y},thickness:.35,color:g});
 pg.drawRectangle({x:2196,y:36,width:360,height:150,borderColor:PDFLib.rgb(.2,.2,.2),borderWidth:1.5,color:PDFLib.rgb(1,1,1)});
 pg.drawText('BLANK SHEET  36" x 24"',{x:2212,y:150,size:16,font:f});pg.drawText('Grid: 1" squares',{x:2212,y:120,size:11,font:f});
 await openBytes(new Uint8Array(await d.save()),'Blank Sheet.pdf')}
let thumbTok=0;
// Thumbnails are drawn at the size they are actually shown on screen times the screen's sharpness (so they stay crisp
// on high-resolution screens and when the panel is widened), and drawn again whenever the panel gets wider.
function thumbWant(c){const w=c.getBoundingClientRect().width;return w>0?w*Math.min(window.devicePixelRatio||1,3):0}
async function drawThumb(p,c,tok){const want=thumbWant(c);if(!want)return;const sc=Math.min(want,1600)/p.w;
 if(c._sc&&Math.abs(c._sc-sc)/sc<.12)return;c._sc=sc;
 const pg=await S.pdf.getPage(p.num);if(tok!==thumbTok)return;const vp=pg.getViewport({scale:sc});
 const t=document.createElement('canvas');t.width=Math.max(1,Math.round(vp.width));t.height=Math.max(1,Math.round(vp.height));
 await pg.render({canvasContext:t.getContext('2d'),viewport:vp}).promise;if(tok!==thumbTok)return;
 c.width=t.width;c.height=t.height;c.getContext('2d').drawImage(t,0,0)}
async function drawThumbs(tok){const pane=$('#pane-pages');
 for(const p of S.pages){if(tok!==thumbTok)return;const c=pane.querySelector(`.thumb[data-p="${p.num}"] canvas`);if(!c)continue;try{await drawThumb(p,c,tok)}catch(e){c._sc=0}}}
let thumbRT=0;const thumbRO=new ResizeObserver(()=>{clearTimeout(thumbRT);thumbRT=setTimeout(()=>{if(S.pdf)drawThumbs(thumbTok)},250)});
async function buildThumbs(){const tok=++thumbTok,pane=$('#pane-pages');pane.innerHTML='';thumbRO.disconnect();thumbRO.observe(pane);
 for(const p of S.pages){const d=document.createElement('div');d.className='thumb';d.dataset.p=p.num;const sc=150/Math.max(p.w,p.h);const c=document.createElement('canvas');const w=Math.round(p.w*sc),h=Math.round(p.h*sc);c.width=w;c.height=h;c.style.width=w+'px';c.style.aspectRatio=w+'/'+h;d.appendChild(c);d.append('Page '+p.num);d.onclick=()=>gotoPage(p.num);pane.appendChild(d)}
 await new Promise(r=>setTimeout(r,600));
 await drawThumbs(tok)}

/* ---------- zoom / navigation ---------- */
function anchorAt(cx,cy){let best=null,bd=1e18;for(const p of S.pages){const r=p.el.getBoundingClientRect();const dx=cx<r.left?r.left-cx:cx>r.right?cx-r.right:0,dy=cy<r.top?r.top-cy:cy>r.bottom?cy-r.bottom:0,d=dx+dy;if(d<bd){bd=d;best={p,r}}if(d===0)break}
 if(!best)return null;return{p:best.p,pt:[(cx-best.r.left)/S.zoom,(cy-best.r.top)/S.zoom],cx,cy}}
function setZoom(z,anchor){if(!S.pages.length)return;z=clamp(z,.05,64);const vr=viewer.getBoundingClientRect();if(!anchor)anchor=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);
 S.zoom=z;for(const p of S.pages){p.el.style.width=p.w*z+'px';p.el.style.height=p.h*z+'px'}
 if(anchor){viewer.scrollLeft=anchor.p.el.offsetLeft+anchor.pt[0]*z-(anchor.cx-vr.left);viewer.scrollTop=anchor.p.el.offsetTop+anchor.pt[1]*z-(anchor.cy-vr.top)}
 $('#zoomv').value=Math.round(z*100)+'%';scheduleRender();clearTimeout(setZoom.t);setZoom.t=setTimeout(redrawAll,150)}
function zoomBy(f){setZoom(S.zoom*f)}
function fitWidth(){if(!S.pages.length)return;const p=S.pages[S.cur-1]||S.pages[0];setZoom((viewer.clientWidth-48)/p.w);gotoPage(S.cur,true)}
function fitPage(){if(!S.pages.length)return;const p=S.pages[S.cur-1]||S.pages[0];setZoom(Math.min((viewer.clientWidth-48)/p.w,(viewer.clientHeight-48)/p.h));gotoPage(S.cur,true)}
function gotoPage(n,instant){n=clamp(n|0,1,S.pages.length);const p=S.pages[n-1];if(!p)return;viewer.scrollTo({top:p.el.offsetTop-14,left:Math.max(0,p.el.offsetLeft+p.w*S.zoom/2-viewer.clientWidth/2),behavior:instant?'auto':'smooth'});S.cur=n;updateCurUI()}
function scrollToBox(n,b){const p=S.pages[n-1];if(!p)return;const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;viewer.scrollTo({left:p.el.offsetLeft+cx*S.zoom-viewer.clientWidth/2,top:p.el.offsetTop+cy*S.zoom-viewer.clientHeight/2,behavior:'smooth'})}
function updateCur(){if(!S.pages.length)return;const vr=viewer.getBoundingClientRect(),my=vr.top+vr.height/2;let best=1,bd=1e18;
 for(const p of S.pages){const r=p.el.getBoundingClientRect();if(r.bottom<vr.top-2000||r.top>vr.bottom+2000)continue;const d=my<r.top?r.top-my:my>r.bottom?my-r.bottom:0;if(d<bd){bd=d;best=p.num}}
 if(best!==S.cur){S.cur=best;updateCurUI()}else updateScaleBtn()}
function updateCurUI(){const pi=$('#pageIn');if(document.activeElement!==pi)pi.value=document.body.classList.contains('dl')&&window.PMQA1?PMQA1.curText():S.cur;$$('.thumb').forEach(t=>t.classList.toggle('on',+t.dataset.p===S.cur));updateScaleBtn()}
function updateScaleBtn(){const sc=scaleFor(S.cur);$('#scaleBtn').textContent='Scale: '+sc.label+(S.pages.length?` · ${sc.unit==='ftin'?'ft-in':UNITS[sc.unit].abbr}`:'')}
viewer.addEventListener('scroll',()=>{updateCur();scheduleRender()},{passive:true});
viewer.addEventListener('wheel',e=>{if(!S.pages.length)return;if(e.ctrlKey||e.metaKey||(settings.wheelZoom&&!e.shiftKey)){e.preventDefault();const k=e.ctrlKey&&Math.abs(e.deltaY)<40?0.01:0.0018;const dy=e.deltaMode===1?e.deltaY*30:e.deltaY;setZoom(S.zoom*Math.exp(-dy*k),anchorAt(e.clientX,e.clientY))}},{passive:false});
window.addEventListener('resize',()=>scheduleRender());

/* ---------- tools ---------- */
function buildRibbon(){const rb=$('#ribbon');let h='';
 RIBBON.forEach(([g,tools],gi)=>{if(gi)h+='<div class="sep"></div>';h+=`<div class="grp"><span class="glab hide-m">${g}</span>`;
  for(const t of tools)h+=`<button class="btn tb" data-tool="${t}" title="${T[t].label}${KEYS[t]?' ('+KEYS[t]+')':''}${T[t].kind!=='nav'?' — double-click to lock':''}">${icon(t)}<span>${T[t].label}</span><i class="lockdot"></i></button>`;h+='</div>'});
 if(H.ribbon.length){h+='<div class="sep"></div><div class="grp"><span class="glab hide-m">Document</span>'+H.ribbon.map((r,i)=>`<button class="btn tb" data-rib="${i}" title="${r.title||r.label}"><svg viewBox="0 0 24 24">${r.icon}</svg><span>${r.label}</span></button>`).join('')+'</div>'}
 h+=`<div class="sep"></div><button class="btn tb" id="bLock" title="Keep the tool active after each markup">${icon('lock')}<span>Lock</span></button>`;
 rb.innerHTML=h;
 rb.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b){const t=b.dataset.tool;if(t==='stamp')return stampPicker();if(t==='image')return imagePicker();if(t==='symbol'&&H.symbolPicker)return H.symbolPicker();setTool(t)}if(e.target.closest('#bLock')){S.lock=!S.lock;updateRibbon()}const rb2=e.target.closest('[data-rib]');if(rb2)H.ribbon[+rb2.dataset.rib].fn()});
 rb.addEventListener('dblclick',e=>{const b=e.target.closest('[data-tool]');if(b&&T[b.dataset.tool].kind!=='nav'&&b.dataset.tool!=='stamp'){setTool(b.dataset.tool,{lock:true})}})}
function updateRibbon(){$$('#ribbon [data-tool]').forEach(b=>{b.classList.toggle('on',b.dataset.tool===S.tool);b.classList.toggle('locked',b.dataset.tool===S.tool&&S.lock)});$('#bLock').classList.toggle('on',S.lock);
 viewer.className=S.tool==='select'?'c-select':S.tool==='pan'?'c-pan':'c-draw';$('#hint').textContent=S.pages.length?(HINTS[S.tool]||''):'Open a PDF to begin.';renderChest()}
function setTool(t,o={}){if(S.drawing||S.countId)finishActive(true);S.tool=t;if(o.lock!==undefined)S.lock=o.lock;S.chestStyle=o.style||null;S.toolSubject=o.subject||null;S.chestSel=o.chest??null;
 if(T[t].kind!=='nav')setSel([],true);$('#live').textContent='';updateRibbon();renderProps()}

/* ---------- pointer handling ---------- */
const ptrs=new Map();let G=null;let SNAPI=null;
function sp(p,pt,e){return H.snap&&pt?H.snap(p,pt,e):pt}
function toPt(e,p){const r=p.el.getBoundingClientRect();return[(e.clientX-r.left)/r.width*p.w,(e.clientY-r.top)/r.height*p.h]}
function pageFromEvent(e){const el=e.target.closest&&e.target.closest('.page');if(el)return S.pages[+el.dataset.p-1];
 for(const p of S.pages){const r=p.el.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)return p}return null}
viewer.addEventListener('dragstart',e=>e.preventDefault());
viewer.addEventListener('pointerdown',e=>{
 if(!S.pages.length)return;
 if(e.pointerType==='mouse'&&e.button===0){try{const sl=getSelection();if(sl&&sl.rangeCount)sl.removeAllRanges()}catch(_){}}
 if(e.button===1||(e.button===0&&S.space)){e.preventDefault();G={k:'pan',x:e.clientX,y:e.clientY,sl:viewer.scrollLeft,st:viewer.scrollTop};return}
 if(e.button!==0)return;
 ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptrs.size===2){startPinch();return}if(ptrs.size>2)return;
 try{viewer.setPointerCapture(e.pointerId)}catch(_){}
 const p=pageFromEvent(e),pt=p?toPt(e,p):null,tool=S.tool,t=T[tool];
 if(H.down&&H.down(e,p,pt))return;
 if(tool==='pan'){const mk0=e.target.closest('.mk');G={k:'pan',x:e.clientX,y:e.clientY,sl:viewer.scrollLeft,st:viewer.scrollTop,hit:mk0&&mk0.dataset.id,add:e.shiftKey||e.ctrlKey||e.metaKey};return}
 if(t.kind==='erase'){G={k:'erase',p,undone:false};eraseAt(e.clientX,e.clientY,G);return}
 if(tool==='select'){
  const h=e.target.closest('[data-h]');
  if(h){const[id,k]=h.dataset.h.split('|');const m=byId(id);if(m){G={k:'handle',m,key:k,orig:clone(m.pts),p:S.pages[m.page-1]};return}}
  const mk=e.target.closest('.mk');
  if(mk&&p){const id=mk.dataset.id;if(e.shiftKey||e.ctrlKey||e.metaKey){toggleSel(id)}else if(!S.sel.has(id))setSel([id]);
   G={k:'move',start:pt,p,orig:new Map([...S.sel].map(i=>[i,clone(byId(i).pts)]))};return}
  if(!e.shiftKey&&S.sel.size)setSel([]);
  if(e.pointerType==='mouse'&&p)G={k:'marquee',p,a:pt,b:pt,add:e.shiftKey};else G={k:'pan',x:e.clientX,y:e.clientY,sl:viewer.scrollLeft,st:viewer.scrollTop};return}
 if(!p)return;
 if(t.kind==='free'){S.drawing={type:tool,page:p.num,pts:[pt],style:toolStyle(tool)};G={k:'free',p};return}
 if(t.kind==='drag'){if(S.drawing&&S.drawing.clickMode){G={k:'drag2nd',p:S.pages[S.drawing.page-1]};return}
  {const q=sp(p,pt,e);S.drawing={type:tool,page:p.num,pts:[q,q.slice()],style:toolStyle(tool)}};G={k:'drag',p,cx:e.clientX,cy:e.clientY};return}
 G={k:'click',p,cx:e.clientX,cy:e.clientY};
});
window.addEventListener('pointermove',e=>{
 if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(S.pinch){if(ptrs.size>=2)movePinch();return}
 const hp=S.pages.length?pageFromEvent(e):null;if(hp){const q=toPt(e,hp),sc=scaleFor(hp.num);$('#coords').textContent=`x ${fmtLen(q[0]*sc.perPt,sc)}  y ${fmtLen(q[1]*sc.perPt,sc)}`}
 if(!G&&!S.drawing&&hp&&e.pointerType==='mouse'&&H.snap&&['drag','multi','count','callout'].includes(T[S.tool].kind)){const before=JSON.stringify(SNAPI);sp(hp,toPt(e,hp),e);if(JSON.stringify(SNAPI)!==before){if(before!=='null'){try{redrawPage(JSON.parse(before).page)}catch(_){}}redrawPage(hp.num)}}
 if(!G){const d=S.drawing;if(d&&(T[d.type].kind==='multi'||T[d.type].kind==='callout'||d.clickMode)&&e.pointerType==='mouse'){const p=S.pages[d.page-1];let pt=sp(p,toPt(e,p),e);
   if(d.clickMode)d.pts[1]=constrain(d.pts[0],pt,e,d.type);else{const last=d.pts[d.pts.length-1];d.cursor=e.shiftKey?snap45(last,pt):pt}redrawPage(p.num);liveMeasure()}return}
 const p=G.p,pt=p?toPt(e,p):null;
 switch(G.k){
 case'pan':viewer.scrollLeft=G.sl-(e.clientX-G.x);viewer.scrollTop=G.st-(e.clientY-G.y);break;
 case'free':{const d=S.drawing;if(!d)break;const last=d.pts[d.pts.length-1];if(dist(last,pt)*S.zoom>1.5){d.pts.push(pt);redrawPage(p.num)}break}
 case'drag':{const d=S.drawing;if(!d)break;d.pts[1]=constrain(d.pts[0],sp(p,pt,e),e,d.type);redrawPage(p.num);liveMeasure();break}
 case'drag2nd':{const d=S.drawing;if(d){d.pts[1]=constrain(d.pts[0],sp(p,pt,e),e,d.type);redrawPage(p.num)}break}
 case'handle':{if(!G.undone){pushUndo();G.undone=true}applyHandle(G.m,G.key,sp(p,pt,e),G.orig);redrawPage(p.num);liveMeasure(G.m);break}
 case'move':{const dx=pt[0]-G.start[0],dy=pt[1]-G.start[1];if(!G.moved&&Math.hypot(dx,dy)*S.zoom<3)break;if(!G.undone){pushUndo();G.undone=true}G.moved=true;
  const pg=new Set();for(const[id,o]of G.orig){const m=byId(id);if(!m)continue;m.pts=o.map(q=>[q[0]+dx,q[1]+dy]);pg.add(m.page)}pg.forEach(redrawPage);break}
 case'marquee':G.b=pt;redrawPage(p.num);break;
 case'erase':eraseAt(e.clientX,e.clientY,G);break;
 }});
function onUp(e,cancel){
 ptrs.delete(e.pointerId);
 if(S.pinch){if(ptrs.size<2){S.pinch=null;scheduleRender();redrawAll()}G=null;return}
 if(!G)return;const g=G;G=null;
 // Pan is the default tool: a plain click on a markup (no drag) picks it up with Select, so it can be edited straight away
 if(!cancel&&g.k==='pan'&&g.hit&&S.tool==='pan'&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<4&&byId(g.hit)){setTool('select');if(g.add)toggleSel(g.hit);else setSel([g.hit]);return}
 if(cancel){if(g.k==='free'||g.k==='drag'){S.drawing=null;redrawAll()}return}
 const p=g.p;
 switch(g.k){
 case'free':finishDrawing();break;
 case'drag':{const d=S.drawing;if(!d)break;const moved=Math.hypot(e.clientX-g.cx,e.clientY-g.cy)>5;
  if(moved)finishDrawing();else if(d.type==='text'){const a=d.pts[0];d.pts=[a,[a[0]+180,a[1]+46]];finishDrawing()}else{d.clickMode=true;showFinish();liveMeasure()}break}
 case'drag2nd':{const d=S.drawing;if(d){const pp=S.pages[d.page-1];d.pts[1]=constrain(d.pts[0],sp(pp,toPt(e,pp),e),e,d.type);finishDrawing()}break}
 case'handle':case'move':if(g.undone){const ids=g.k==='handle'?[g.m.id]:[...g.orig.keys()];ids.forEach(i=>{const m=byId(i);if(m)m.modified=Date.now()});commit()}break;
 case'marquee':{const b=normBox(g.a,g.b);if((b[2]-b[0])*S.zoom>3||(b[3]-b[1])*S.zoom>3){const ids=S.markups.filter(m=>{if(m.page!==p.num)return false;const q=bboxOf(m);return q[0]<=b[2]&&q[2]>=b[0]&&q[1]<=b[3]&&q[3]>=b[1]}).map(m=>m.id);setSel(g.add?[...S.sel,...ids]:ids)}else redrawPage(p.num);break}
 case'click':handleClick(g,e);break;
 }}
window.addEventListener('pointerup',e=>onUp(e,false));window.addEventListener('pointercancel',e=>onUp(e,true));
function eraseAt(x,y,g){const el=document.elementFromPoint(x,y),mk=el&&el.closest&&el.closest('.mk');if(!mk)return;const m=byId(mk.dataset.id);if(!m)return;if(!g.undone){pushUndo();g.undone=true}S.markups=S.markups.filter(q=>q!==m);S.sel.delete(m.id);commit()}
function handleClick(g,e){
 if(Math.hypot(e.clientX-g.cx,e.clientY-g.cy)>10)return;
 const tool=S.tool,t=T[tool],p=g.p;let pt=sp(p,toPt(e,p),e);
 if(t.kind==='click'){const m=newMarkup(tool,p.num,[tool==='note'?[pt[0]-9,pt[1]-9]:pt],toolStyle(tool));if(tool==='symbol'){m.sym=S.symbol||'tag';if(S.symbolText!=null)m.text=S.symbolText}pushUndo();S.markups.push(m);afterCreate(m);return}
 if(t.kind==='count'){let m=S.countId&&byId(S.countId);pushUndo();if(m&&m.page===p.num){m.pts.push(pt);m.modified=Date.now()}else{m=newMarkup('count',p.num,[pt],toolStyle('count'));S.markups.push(m);S.countId=m.id}commit();showFinish();liveMeasure(m);return}
 const d=S.drawing,now=performance.now();
 if(d&&d.page!==p.num)return;
 if(d&&now-S.lastUp<350&&Math.hypot(e.clientX-S.lastX,e.clientY-S.lastY)<10){S.lastUp=0;finishDrawing();return}
 S.lastUp=now;S.lastX=e.clientX;S.lastY=e.clientY;
 if(!d)S.drawing={type:tool,page:p.num,pts:[pt],style:toolStyle(tool)};
 else{const last=d.pts[d.pts.length-1];if(e.shiftKey)pt=snap45(last,pt);
  if(t.closed&&d.pts.length>=3&&dist(pt,d.pts[0])*S.zoom<10){finishDrawing();return}d.pts.push(pt)}
 S.drawing.cursor=null;const max=t.kind==='callout'?2:t.max;if(max&&S.drawing.pts.length>=max){finishDrawing();return}
 showFinish();redrawPage(p.num);liveMeasure()}
function startPinch(){if(G&&(G.k==='free'||G.k==='drag')){S.drawing=null;redrawAll()}G=null;const[a,b]=[...ptrs.values()];
 S.pinch={d0:Math.hypot(a.x-b.x,a.y-b.y)||1,z0:S.zoom,anchor:anchorAt((a.x+b.x)/2,(a.y+b.y)/2)}}
function movePinch(){const[a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const an=S.pinch.anchor;if(!an)return;setZoom(S.pinch.z0*d/S.pinch.d0,{p:an.p,pt:an.pt,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2})}

/* ---------- create / finish ---------- */
function newMarkup(type,page,pts,style){const now=Date.now();return{depth:type==='volume'?(style.depth||0.3048):undefined,id:uid(),type,page,pts,style:Object.assign({},style),text:type==='stamp'?S.stampText:'',subject:S.toolSubject||defSubject(type),label:'',comment:'',author:settings.author,created:now,modified:now,status:''}}
function finishDrawing(){const d=S.drawing;if(!d)return;S.drawing=null;hideFinish();$('#live').textContent='';const t=T[d.type];let pts=d.pts.filter(Boolean);
 const need=t.kind==='multi'?(t.max||(t.closed?3:2)):2;
 if(t.kind==='free'){if(pts.length<2){redrawPage(d.page);return}pts=simplify(pts,.35/S.zoom)}
 if(d.type==='image'&&dist(pts[0],pts[1])*S.zoom<4){const a=pts[0],w=200;pts=[a,[a[0]+w,a[1]+w*(S.imageAR||1)]]}
 if(pts.length<need||(t.kind==='drag'&&dist(pts[0],pts[1])*S.zoom<2)){redrawPage(d.page);return}
 if(d.type==='calibrate'){redrawPage(d.page);calibrateDialog(d.page,dist(pts[0],pts[1]));return}
 if(T[d.type].textm){redrawPage(d.page);textMarkup(d,normBox(pts[0],pts[1]));return}
 if(d.type==='callout'){const tip=pts[0],b=pts[1],w=150,h=40;const x0=b[0]>=tip[0]?b[0]:b[0]-w;pts=[tip,[x0,b[1]-h/2],[x0+w,b[1]+h/2]]}
 const m=newMarkup(d.type,d.page,pts,d.style);if(d.type==='image'){if(!S.imageSrc){toast('Choose an image first');return}m.img=S.imageSrc}pushUndo();S.markups.push(m);afterCreate(m)}
async function textMarkup(d,box){const{items,vp}=await pageText(d.page);const rects=[];
 for(const it of items){let r;if(it.vb)r=it.vb;else{const q=vp.convertToViewportRectangle([it.x,it.y-it.h*.2,it.x+it.w,it.y+it.h*.85]);r=normBox([q[0],q[1]],[q[2],q[3]])}
  if(r[0]<box[2]&&r[2]>box[0]&&r[1]<box[3]&&r[3]>box[1]){const L=(it.str||'').length||1,cw=(r[2]-r[0])/L;let x0=r[0],x1=r[2];if(!it.vb&&!it.rot){const i0=Math.max(0,Math.floor((box[0]-r[0])/cw)),i1=Math.min(L,Math.ceil((box[2]-r[0])/cw));if(box[1]<=r[1]+2&&box[3]>=r[3]-2){}x0=r[0]+i0*cw;x1=r[0]+i1*cw}rects.push([Math.max(r[0],x0),r[1],Math.min(r[2],x1),r[3]])}}
 if(!rects.length){toast('No PDF text there — scanned sheets need OCR first');return}
 const m=newMarkup(d.type,d.page,[[box[0],box[1]],[box[2],box[3]]],d.style);m.rects=rects;m.text=items.filter(it=>{const r=it.vb||null;return true}).length?'':'';pushUndo();S.markups.push(m);afterCreate(m)}
function afterCreate(m){if(m.type==='stamp'&&S.chestSel!=null){const c=S.chest[S.chestSel];if(c&&c.text)m.text=c.text}
 if(!S.lock&&m.type!=='count')setTool('select');setSel(S.lock?[]:[m.id],true);commit();
 if(m.type==='text'||m.type==='callout'||m.type==='typewriter'||m.type==='cloudplus'||(m.type==='space'&&!m.text))textDialog(m,true,'text');else if(m.type==='note')textDialog(m,true,'comment')}
function finishActive(silent){if(S.countId){S.countId=null;hideFinish();if(!S.lock&&!silent)setTool('select');return}finishDrawing()}
function cancelActive(){const pg=S.drawing&&S.drawing.page;S.drawing=null;S.countId=null;hideFinish();$('#live').textContent='';if(pg)redrawPage(pg)}
function undoPoint(){const d=S.drawing;if(d&&d.pts.length>1){d.pts.pop();redrawPage(d.page);liveMeasure()}else if(d)cancelActive();else if(S.countId){const m=byId(S.countId);if(m){pushUndo();m.pts.pop();if(!m.pts.length){S.markups=S.markups.filter(x=>x!==m);S.countId=null;hideFinish()}commit()}}}
function showFinish(){$('#finish').classList.add('on')}function hideFinish(){$('#finish').classList.remove('on')}
$('#fDone').onclick=()=>finishActive();$('#fBack').onclick=undoPoint;$('#fCancel').onclick=()=>{if(S.countId){S.countId=null;hideFinish()}else cancelActive()};
function liveMeasure(m){const d=m||S.drawing;if(!d){$('#live').textContent='';return}const pm=Object.assign({},d,{pts:d.cursor?[...d.pts,d.cursor]:d.pts});
 const r=measOf(pm.type==='calibrate'?Object.assign(pm,{type:'length'}):pm);let s=r?r.text:'';if(pm.pts.length>1&&(pm.type==='area'||pm.type==='perimeter')){const sc=scaleFor(pm.page);s+=r&&pm.type==='area'?'  ·  perim '+fmtLen(polyLen(pm.pts,true)*sc.perPt,sc):''}$('#live').textContent=s}

/* ---------- selection / editing ---------- */
function setSel(ids,quiet){const before=new Set([...S.sel].map(i=>byId(i)?.page));S.sel=new Set(ids.filter(byId));const pg=new Set([...before,...[...S.sel].map(i=>byId(i).page)]);pg.forEach(n=>n&&redrawPage(n));
 if(!quiet)renderProps();else renderProps();renderList();$('#mlDel').disabled=!S.sel.size}
function toggleSel(id){const s=new Set(S.sel);s.has(id)?s.delete(id):s.add(id);setSel([...s])}
function delSel(){if(!S.sel.size)return;pushUndo();S.markups=S.markups.filter(m=>!S.sel.has(m.id));S.sel.clear();commit();renderProps()}
function copySel(){if(!S.sel.size)return;S.clip=clone(S.markups.filter(m=>S.sel.has(m.id)));toast(`Copied ${S.clip.length}`)}
function paste(dup){const src=dup?clone(S.markups.filter(m=>S.sel.has(m.id))):S.clip&&clone(S.clip);if(!src||!src.length)return;pushUndo();const ids=[],off=12;
 for(const m of src){m.id=uid();if(!dup)m.page=S.cur;m.pts=m.pts.map(p=>[p[0]+off,p[1]+off]);m.created=m.modified=Date.now();m.author=settings.author;S.markups.push(m);ids.push(m.id)}setSel(ids);commit()}
function reorder(front){const sel=S.markups.filter(m=>S.sel.has(m.id)),rest=S.markups.filter(m=>!S.sel.has(m.id));pushUndo();S.markups=front?[...rest,...sel]:[...sel,...rest];commit()}

/* ---------- undo / persistence ---------- */
function pushUndo(){S.undo.push(JSON.stringify(S.markups));if(S.undo.length>200)S.undo.shift();S.redo=[];updUndo()}
function undo(){if(!S.undo.length)return;S.redo.push(JSON.stringify(S.markups));S.markups=JSON.parse(S.undo.pop());afterHistory()}
function redo(){if(!S.redo.length)return;S.undo.push(JSON.stringify(S.markups));S.markups=JSON.parse(S.redo.pop());afterHistory()}
function afterHistory(){S.sel=new Set([...S.sel].filter(byId));S.countId=null;commit();renderProps()}
function updUndo(){$('#bUndo').disabled=!S.undo.length;$('#bRedo').disabled=!S.redo.length}
let sT=0,lT=0;
function commit(skipSave){redrawAll();clearTimeout(lT);lT=setTimeout(renderList,60);if(!$('#props').contains(document.activeElement))renderProps();else updMeasBox();updUndo();
hook('change');
 if(!skipSave){clearTimeout(sT);sT=setTimeout(()=>{if(S.fileKey)LS.set(S.fileKey,{markups:S.markups,scales:S.scales})},400)}}
function saveScales(){if(S.fileKey)LS.set(S.fileKey,{markups:S.markups,scales:S.scales})}

/* ---------- properties panel ---------- */
function updMeasBox(){const el=$('#measBox');if(!el)return;const m=byId([...S.sel][0]);if(!m)return;el.innerHTML=measHtml(m)}
function measHtml(m){const r=measOf(m);if(!r)return'';let x='';const sc=r.sc;
 if(m.type==='area')x=`<small>Perimeter ${fmtLen(polyLen(m.pts,true)*sc.perPt,sc)}</small>`;
 if(m.type==='polylength'||m.type==='perimeter')x=`<small>${m.pts.length-(m.type==='perimeter'?0:1)} segments</small>`;
if(r.extra)x+=`<small style="display:block;color:#a5f3fc">${esc(r.extra.text)}</small>`;
 return`<b>${esc(r.text)}</b>${x}${sc.none?'<small style="display:block;color:#fbbf24">Scale not calibrated — values are 1:1 paper size</small>':''}`}
function renderProps(){const box=$('#props');const sel=[...S.sel].map(byId).filter(Boolean);let mode,type,st,m=null;
 if(sel.length){mode='sel';m=sel[0];type=m.type;st=m.style}
 else if(T[S.tool].kind!=='nav'&&S.tool!=='calibrate'&&S.defaults[S.tool]){mode='tool';type=S.tool;st=toolStyle(type)}
 else{box.innerHTML=S.pages.length?`<div class="hint"><b style="color:var(--text)">${esc(S.fileName)}</b><br>${S.pages.length} page${S.pages.length>1?'s':''} · ${S.markups.length} markup${S.markups.length===1?'':'s'}<br><br>
  Select a markup to edit its properties, or pick a tool to set its defaults.<br><br><b style="color:var(--text)">Shortcuts</b><br>
  <kbd>V</kbd> Select · <kbd>Space</kbd> Pan · <kbd>L</kbd> Line · <kbd>A</kbd> Arrow · <kbd>R</kbd> Rect · <kbd>E</kbd> Ellipse · <kbd>P</kbd> Polygon · <kbd>C</kbd> Cloud · <kbd>T</kbd> Text · <kbd>Q</kbd> Callout · <kbd>N</kbd> Note · <kbd>H</kbd> Highlight<br>
  <kbd>Shift+Alt+L</kbd> Length · <kbd>+A</kbd> Area · <kbd>+C</kbd> Count · <kbd>+P</kbd> Perimeter<br><kbd>Enter</kbd> finish · <kbd>Esc</kbd> cancel · <kbd>Ctrl+Z/Y</kbd> · <kbd>Ctrl+C/V/D</kbd> · <kbd>Del</kbd></div>`:'<div class="hint">No document open.</div>';return}
 const t=T[type],hasFill=(t.closed&&type!=='image')||['count','callout','note','symbol'].includes(type),hasFont=!!t.meas||t.txt||['count','symbol'].includes(type),hasTC=['text','callout','typewriter'].includes(type),hasDash=!['pen','highlight','note','stamp','count','cloud','cloudplus','texthl','image','typewriter','symbol'].includes(type),hasHeads=['line','arrow','polyline','dimension'].includes(type),hasFace=['text','callout','typewriter','cloudplus'].includes(type);
 const fillOn=st.fill&&st.fill!=='none';const val=v=>esc(v??'');
 let h=`<div class="sec" style="margin-top:2px">${mode==='sel'?(sel.length>1?sel.length+' markups selected':esc(t.label)):'Tool defaults · '+esc(t.label)}</div>`;
 if(mode==='sel'&&sel.length===1&&t.meas)h+=`<div class="meas" id="measBox">${measHtml(m)}</div>`;
 if(mode==='sel'&&['area','length','polylength','perimeter'].includes(type)){const sc=scaleFor(m.page),um=sc.unit==='ftin'?0.3048:UNITS[sc.unit].m,un=sc.unit==='ftin'?'ft':UNITS[sc.unit].abbr,isA=type==='area',cur=isA?m.depth:m.height;
  h+=`<div class="fld"><label>${isA?'Depth / thickness (volume)':'Height (wall area)'} — ${un}</label><input class="ti" type="number" min="0" step="any" data-f="${isA?'depth':'height'}" data-um="${um}" value="${cur>0?+(cur/um).toFixed(4):''}" placeholder="none"></div>`}
 for(const f of H.props)try{h+=f(m,mode,type)||''}catch(e){}
 if(mode==='sel'){
  h+=`<div class="fld"><label>Subject</label><input class="ti" data-f="subject" value="${val(m.subject)}"></div>`;
  if(t.txt)h+=`<div class="fld"><label>${type==='stamp'?'Stamp text':'Text'}</label><textarea class="ti" data-f="text">${val(m.text)}</textarea></div>`;
  h+=`<div class="fld"><label>Label</label><input class="ti" data-f="label" value="${val(m.label)}"></div>`;
  h+=`<div class="fld"><label>Comments</label><textarea class="ti" data-f="comment">${val(m.comment)}</textarea></div>`;
  h+=`<div class="fld"><label>Status</label><select class="ti" data-f="status">${STATUSES.map(s=>`<option ${s===m.status?'selected':''} value="${s}">${s||'None'}</option>`).join('')}</select></div>`}
 h+=`<div class="sec">Appearance</div><div class="row fld"><div><label style="font-size:11px;color:var(--mut)">${type==='text'||type==='callout'?'Border':'Color'}</label><input type="color" data-f="stroke" value="${st.stroke}"></div>`;
 if(hasTC)h+=`<div><label style="font-size:11px;color:var(--mut)">Text</label><input type="color" data-f="color" value="${st.color||st.stroke}"></div>`;
 if(hasFill)h+=`<div><label class="chk" style="font-size:11px;color:var(--mut);margin-bottom:3px"><input type="checkbox" data-f="fillOn" ${fillOn?'checked':''}>Fill</label><input type="color" data-f="fill" value="${fillOn?st.fill:'#ffffff'}"></div>`;
 h+=`</div>`;
 if(type!=='note')h+=`<div class="fld"><label>Line width (pt)</label><input class="ti" type="number" min="0" max="50" step="0.5" data-f="width" value="${st.width??1}"></div>`;
 h+=`<div class="fld"><label>Opacity <span id="opv">${Math.round((st.opacity??1)*100)}%</span></label><input type="range" min="5" max="100" data-f="opacity" value="${Math.round((st.opacity??1)*100)}"></div>`;
 if(hasFill)h+=`<div class="fld"><label>Fill opacity <span id="fov">${Math.round((st.fillOpacity??1)*100)}%</span></label><input type="range" min="0" max="100" data-f="fillOpacity" value="${Math.round((st.fillOpacity??1)*100)}"></div>`;
 if(hasFont)h+=`<div class="fld"><label>${type==='count'?'Symbol size':'Font size'} (pt)</label><input class="ti" type="number" min="3" max="120" step="1" data-f="fontSize" value="${st.fontSize||10}"></div>`;
 if(type==='cloud')h+=`<div class="fld"><label>Arc size (pt)</label><input class="ti" type="number" min="2" max="60" step="1" data-f="cloud" value="${st.cloud||9}"></div>`;
 if(hasDash){const dv=st.dash===true?'dash':(st.dash||'');h+=`<div class="fld"><label>Line style</label><select class="ti" data-f="dash">${[['','Solid'],['dash','Dashed'],['dot','Dotted'],['dashdot','Dash-dot'],['longdash','Long dash']].map(([v,l])=>`<option value="${v}" ${dv===v?'selected':''}>${l}</option>`).join('')}</select></div>`}
 if(hasHeads){const HO=[['','None'],['arrow','Arrow'],['open','Open arrow'],['dot','Dot'],['tick','Slash'],['bar','Bar']];h+=`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Start</label><select class="ti" data-f="headS">${HO.map(([v,l])=>`<option value="${v}" ${(st.headS||'')===v?'selected':''}>${l}</option>`).join('')}</select></div><div><label style="font-size:11px;color:var(--mut)">End</label><select class="ti" data-f="headE">${HO.map(([v,l])=>`<option value="${v}" ${(st.headE||'')===v?'selected':''}>${l}</option>`).join('')}</select></div></div>`}
 if(hasFace)h+=`<div class="row fld"><div style="flex:2"><label style="font-size:11px;color:var(--mut)">Font</label><select class="ti" data-f="font">${Object.keys(FONTS).map(k=>`<option ${(st.font||'Helvetica')===k?'selected':''}>${k}</option>`).join('')}</select></div><label class="chk" style="margin-top:16px"><input type="checkbox" data-f="bold" ${st.bold?'checked':''}><b>B</b></label><label class="chk" style="margin-top:16px"><input type="checkbox" data-f="italic" ${st.italic?'checked':''}><i>I</i></label></div>`;
 if(mode==='sel'&&sel.length===1)h+=convertHtml(m);
 if(mode==='sel'&&sel.length===1&&t.meas&&t.meas!=='count'&&t.meas!=='angle'){const cur=m.scale?m.scale.label:'Page scale ('+scaleFor(m.page).label+')';h+=`<div class="sec">Scale</div><div class="hint" style="margin-bottom:6px">${esc(cur)}</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" style="border:1px solid var(--line)" data-act="mscale">Set scale for this markup…</button>${m.scale?'<button class="btn" style="border:1px solid var(--line)" data-act="mscale0">Use page scale</button>':''}</div>`}
 if(mode==='sel'){h+=`<div class="sec">Info</div><div class="hint">Author: ${esc(m.author)}<br>Created: ${esc(fmtDT(m.created))}<br>Modified: ${esc(fmtDT(m.modified))}<br>Page: ${m.page}</div>
  <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px"><button class="btn" style="border:1px solid var(--line)" data-act="front">To front</button><button class="btn" style="border:1px solid var(--line)" data-act="back">To back</button></div>
  <div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><button class="btn" style="border:1px solid var(--line)" data-act="chest">Add to Tool Chest</button><button class="btn" style="border:1px solid var(--line)" data-act="setdef">Set as default</button></div>
  <div class="row" style="margin-top:6px"><button class="btn" style="border:1px solid #7f1d1d;color:#fca5a5" data-act="del">Delete</button></div>`}
 else h+=`<div class="hint" style="margin-top:6px">Changes here apply to new ${esc(t.label)} markups.</div><div class="row" style="margin-top:8px"><button class="btn" style="border:1px solid var(--line)" data-act="resetdef">Reset to default</button></div>`;
 box.innerHTML=h}
const CONVERT={line:['length'],polyline:['polylength'],rect:['area','perimeter'],polygon:['area','perimeter','volume'],cloud:['area','perimeter'],ellipse:['area','circle'],length:['line'],dimension:['line','length'],polylength:['polyline'],area:['polygon','perimeter','volume'],perimeter:['polygon','area'],volume:['polygon','area'],circle:['ellipse']};
function convertHtml(m){const to=CONVERT[m.type];if(!to)return'';return`<div class="sec">Convert</div><div class="row" style="gap:6px;flex-wrap:wrap">${to.map(t=>`<button class="btn" style="border:1px solid var(--line)" data-conv="${t}">→ ${T[t].label}</button>`).join('')}</div>`}
function convertMarkup(m,to){pushUndo();let pts=m.pts.map(p=>p.slice());const from=m.type;
 if((from==='rect')&&['area','perimeter','volume','polygon'].includes(to)){const b=normBox(pts[0],pts[1]);pts=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]}
 if(from==='ellipse'&&to==='area'){const b=normBox(pts[0],pts[1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,rx=(b[2]-b[0])/2,ry=(b[3]-b[1])/2;pts=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pts.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a)])}}
 if(from==='ellipse'&&to==='circle'){const b=normBox(pts[0],pts[1]),c=[(b[0]+b[2])/2,(b[1]+b[3])/2];pts=[c,[b[2],c[1]]]}
 if(from==='circle'&&to==='ellipse'){const r=dist(pts[0],pts[1]),c=pts[0];pts=[[c[0]-r,c[1]-r],[c[0]+r,c[1]+r]]}
 const wasDefault=m.subject===defSubject(from);m.type=to;m.pts=pts;if(wasDefault)m.subject=defSubject(to);
 const keep={stroke:m.style.stroke,width:m.style.width,opacity:m.style.opacity,fill:m.style.fill,fillOpacity:m.style.fillOpacity,dash:m.style.dash};m.style=Object.assign({},S.defaults[to],Object.fromEntries(Object.entries(keep).filter(([k,v])=>v!==undefined)));
 if(T[to].meas&&!m.style.fontSize)m.style.fontSize=10;if(to==='volume'&&!(m.depth>0))m.depth=S.defaults.volume.depth||0.3048;m.modified=Date.now();commit();renderProps();toast('Converted to '+T[to].label)}
function markupScaleDialog(m){const opts=`<optgroup label="Architectural">${ARCH.map(([l,v])=>`<option value="a:${v}">${l}" = 1'-0"</option>`).join('')}</optgroup><optgroup label="Engineering">${ENG.map(n=>`<option value="e:${n}">1" = ${n}'</option>`).join('')}</optgroup><optgroup label="Metric">${METRIC.map(n=>`<option value="m:${n}">1:${n}</option>`).join('')}</optgroup><optgroup label="Other"><option value="f:1">Full size 1:1</option></optgroup>`;
 const isLen=['length','dimension'].includes(m.type)&&m.pts.length===2;const cur=m.scale||scaleFor(m.page);
 modal('Scale for this markup',`<div class="hint" style="margin-bottom:10px">Use when a detail on the sheet is drawn at a different scale than the page.</div><div class="fld"><label>Preset</label><select class="ti" id="msP">${opts}</select></div>
 ${isLen?`<div class="fld"><label>…or this line's real length (calibrate from it)</label><div class="row"><input class="ti" id="msFt" type="number" step="any" placeholder="ft"><input class="ti" id="msIn" type="number" step="any" placeholder="in"></div></div>`:''}
 <div class="fld"><label>Display unit</label><select class="ti" id="msU">${unitOpts(cur.none?'ftin':cur.unit)}</select></div>
 <label class="chk"><input type="checkbox" id="msAll"> Apply to all selected-subject markups on this page</label>`,
 [{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{let perPt,label;const ft=md.querySelector('#msFt'),inch=md.querySelector('#msIn');const real=ft?((+ft.value||0)*12+(+inch.value||0))*0.0254:0;
  if(real>0){perPt=real/dist(m.pts[0],m.pts[1]);label='Custom (calibrated)'}else{const[k,v]=md.querySelector('#msP').value.split(':'),n=+v;if(k==='a'){perPt=12/n*PT_M;label=md.querySelector('#msP').selectedOptions[0].textContent}else if(k==='e'){perPt=12*n*PT_M;label=`1" = ${n}'`}else if(k==='m'){perPt=n*PT_M;label='1:'+n}else{perPt=PT_M;label='1:1'}}
  const sc={perPt,unit:md.querySelector('#msU').value,label,prec:cur.prec||8,dec:cur.dec??2};pushUndo();const tg=md.querySelector('#msAll').checked?S.markups.filter(x=>x.page===m.page&&x.subject===m.subject&&T[x.type].meas):[m];tg.forEach(x=>{x.scale=Object.assign({},sc);x.modified=Date.now()});commit();renderProps()}}]);$('#msP').value='a:0.25'}
let propUndo=false;
$('#props').addEventListener('input',e=>{const el=e.target,f=el.dataset.f;if(!f)return;let v=el.type==='checkbox'?el.checked:el.type==='range'?(+el.value)/100:el.type==='number'?+el.value:el.value;
 if(f==='opacity')$('#opv').textContent=Math.round(v*100)+'%';if(f==='fillOpacity')$('#fov').textContent=Math.round(v*100)+'%';applyProp(f,v)});
$('#props').addEventListener('change',()=>{propUndo=false;renderList()});
$('#props').addEventListener('focusout',()=>{propUndo=false});
$('#props').addEventListener('click',e=>{const cv=e.target.closest('[data-conv]');if(cv){const m=byId([...S.sel][0]);if(m)convertMarkup(m,cv.dataset.conv);return}const a=e.target.closest('[data-act]');if(!a)return;const act=a.dataset.act,m=byId([...S.sel][0]);
 if(act==='mscale'&&m)return markupScaleDialog(m);if(act==='mscale0'&&m){pushUndo();delete m.scale;commit();renderProps();return}
 if(act==='del')delSel();if(act==='front')reorder(true);if(act==='back')reorder(false);
 if(act==='chest'&&m)modalPrompt('Add to Tool Chest','Tool name',m.subject||T[m.type].label,name=>{S.chest.push({name,type:m.type,subject:m.subject,text:m.type==='stamp'?m.text:undefined,style:clone(m.style)});LS.set('pm:chest',S.chest);renderChest();switchTab('chest');toast('Added to Tool Chest')});
 if(act==='setdef'&&m){Object.assign(S.defaults[m.type],clone(m.style));LS.set('pm:defaults',S.defaults);toast(T[m.type].label+' default updated')}
 if(act==='resetdef'){S.defaults[S.tool]=clone(BASE_DEF[S.tool]);S.chestStyle=null;LS.set('pm:defaults',S.defaults);renderProps()}});
function applyProp(f,v){const sel=[...S.sel].map(byId).filter(Boolean);
 const setStyle=st=>{if(f==='fillOn')st.fill=v?($('#props [data-f=fill]').value):'none';else if(f==='fill'){st.fill=v;const c=$('#props [data-f=fillOn]');if(c)c.checked=true}else st[f]=v};
 if(sel.length){if(!propUndo){pushUndo();propUndo=true}for(const m of sel){if(f==='depth'||f==='height'){const um=+$('#props [data-f='+f+']').dataset.um;m[f]=v>0?v*um:0}else if(['subject','label','comment','text','status'].includes(f))m[f]=v;else setStyle(m.style);m.modified=Date.now()}
  const pg=new Set(sel.map(m=>m.page));pg.forEach(redrawPage);updMeasBox();hook('change');clearTimeout(lT);lT=setTimeout(renderList,250);clearTimeout(sT);sT=setTimeout(()=>LS.set(S.fileKey,{markups:S.markups,scales:S.scales}),400)}
 else if(S.chestStyle){setStyle(S.chestStyle)}else{setStyle(S.defaults[S.tool]);LS.set('pm:defaults',S.defaults)}}

/* ---------- markups list ---------- */
function spaceOf(m){if(m.type==='space')return'';const c=(()=>{const b=bboxOf(m);return[(b[0]+b[2])/2,(b[1]+b[3])/2]})();for(const sp of S.markups){if(sp.type!=='space'||sp.page!==m.page)continue;let inside=false;const P=sp.pts;for(let i=0,j=P.length-1;i<P.length;j=i++){if((P[i][1]>c[1])!==(P[j][1]>c[1])&&c[0]<(P[j][0]-P[i][0])*(c[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])inside=!inside}if(inside)return sp.text||'Space'}return''}
const COLS=[['subject','Subject'],['page','Page'],['space','Space'],['label','Label'],['measure','Measurement'],['comment','Comments'],['author','Author'],['date','Date'],['status','Status']];
function listRows(){const q=$('#mlFilter').value.trim().toLowerCase();
 let rows=S.markups.map(m=>({m,r:measOf(m)})).filter(({m})=>!q||[m.subject,m.label,m.text,m.comment,m.author,m.status,T[m.type].label,'p'+m.page,spaceOf(m)].join(' ').toLowerCase().includes(q));
 const{k,dir}=S.listSort;const key=({m,r})=>k==='measure'?(r?r.v:-1):k==='page'?m.page:k==='date'?m.created:k==='space'?spaceOf(m).toLowerCase():k==='label'?(m.label||m.text||'').toLowerCase():String(m[k]||'').toLowerCase();
 rows.sort((a,b)=>{const x=key(a),y=key(b);return(x<y?-1:x>y?1:0)*dir||a.m.created-b.m.created});return rows}
function summaryRows(rows){const g=new Map();for(const{m,r}of rows){const unit=r?r.unit:'—';const kk=m.subject+'|'+(r?r.kind:'none')+'|'+unit;if(!g.has(kk))g.set(kk,{subject:m.subject,kind:r?r.kind:'',unit,count:0,total:0,raw:0,sc:r&&r.sc,color:m.style.stroke});const o=g.get(kk);o.count+=m.type==='count'?m.pts.length:1;if(r){o.total+=r.v;o.raw+=r.raw;if(r.extra){o.ex=o.ex||{kind:r.extra.kind,unit:r.extra.unit,v:0,raw:0};o.ex.v+=r.extra.v;o.ex.raw+=r.extra.raw}}}
 return[...g.values()].map(o=>({...o,extext:o.ex?(o.ex.kind==='vol'?volOf(o.ex.raw,o.sc).text:fmtNum(o.ex.v,o.sc.dec??2)+' '+o.ex.unit+' wall'):'',text:!o.kind?'':o.kind==='len'?fmtLen(o.raw,o.sc):o.kind==='area'?fmtNum(o.total,o.sc.dec??2)+' '+o.unit:o.kind==='count'?o.total+' ea':o.kind==='angle'?'—':''}))}
function renderList(){const body=$('#mlBody');$('#mlCount').textContent=S.markups.length;if(!S.markups.length){body.innerHTML='<div class="hint" style="padding:12px">No markups yet. Pick a tool above and draw on the sheet.</div>';return}
 const rows=listRows();
 if(S.summary){const sr=summaryRows(rows);body.innerHTML=`<table class="ml"><thead><tr><th></th><th>Subject</th><th>Count</th><th>Total</th><th>Unit</th><th>Volume / Wall area</th></tr></thead><tbody>${sr.map(o=>`<tr><td><span class="dot" style="background:${o.color}"></span></td><td>${esc(o.subject)}</td><td class="num">${o.count}</td><td class="num">${esc(o.text)}</td><td>${esc(o.unit)}</td><td class="num">${esc(o.extext)}</td></tr>`).join('')}</tbody></table>`;return}
 const{k,dir}=S.listSort;
 body.innerHTML=`<table class="ml"><thead><tr><th></th>${COLS.map(([c,l])=>`<th data-sort="${c}">${l}${k===c?(dir>0?' ▲':' ▼'):''}</th>`).join('')}</tr></thead><tbody>${rows.map(({m,r})=>`<tr data-id="${m.id}" class="${S.sel.has(m.id)?'sel':''}"><td><span class="dot" style="background:${m.style.stroke}"></span></td><td>${esc(m.subject)}</td><td class="num">${m.page}</td><td>${esc(spaceOf(m))}</td><td>${esc(m.label||m.text)}</td><td class="num">${r?esc(r.text+(r.extra?' · '+r.extra.text:'')):''}</td><td>${esc(m.comment)}</td><td>${esc(m.author)}</td><td>${esc(fmtDT(m.created))}</td><td>${esc(m.status)}</td></tr>`).join('')}</tbody></table>`}
$('#mlBody').addEventListener('click',e=>{const th=e.target.closest('[data-sort]');if(th){const c=th.dataset.sort;S.listSort=S.listSort.k===c?{k:c,dir:-S.listSort.dir}:{k:c,dir:1};renderList();return}
 const tr=e.target.closest('tr[data-id]');if(!tr)return;const m=byId(tr.dataset.id);if(!m)return;if(S.tool!=='select')setTool('select');
 if(e.shiftKey||e.ctrlKey||e.metaKey)toggleSel(m.id);else{setSel([m.id]);scrollToBox(m.page,bboxOf(m))}});
$('#mlFilter').addEventListener('input',renderList);
$('#mlSum').onclick=()=>{S.summary=!S.summary;$('#mlSum').classList.toggle('on',S.summary);renderList()};
$('#mlToggle').onclick=()=>{const c=$('#mlist').classList.toggle('col');$('#mlArrow').textContent=c?'▸':'▾';scheduleRender()};
$('#mlDel').onclick=delSel;
function tableData(){if(S.summary){return[['Subject','Count','Total','Unit','Volume/Wall','Volume/Wall unit'],...summaryRows(listRows()).map(o=>[o.subject,o.count,o.kind==='len'||o.kind==='area'?+o.total.toFixed(4):o.total,o.unit,o.ex?+o.ex.v.toFixed(4):'',o.ex?o.ex.unit:''])]}
 return[['Subject','Type','Page','Space','Label','Comments','Measurement','Value','Unit','Volume/Wall','Volume/Wall value','Volume/Wall unit','Author','Date','Status','Color'],...listRows().map(({m,r})=>[m.subject,T[m.type].label,m.page,spaceOf(m),m.label||m.text,m.comment,r?r.text:'',r?(+r.v.toFixed(4)):'',r?r.unit:'',r&&r.extra?r.extra.text:'',r&&r.extra?+r.extra.v.toFixed(4):'',r&&r.extra?r.extra.unit:'',m.author,new Date(m.created).toISOString(),m.status,m.style.stroke])]}
$('#mlCsv').onclick=()=>{const csv=tableData().map(r=>r.map(c=>{c=String(c??'');return/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n');saveFile(baseName()+(S.summary?'-summary':'-markups')+'.csv','﻿'+csv)};
$('#mlCopy').onclick=async()=>{const tsv=tableData().map(r=>r.map(c=>String(c??'').replace(/[\t\n]/g,' ')).join('\t')).join('\n');try{await navigator.clipboard.writeText(tsv);toast('Copied — paste into Excel')}catch(e){toast('Clipboard not available here')}};

/* ---------- tool chest ---------- */
function renderChest(){const pane=$('#pane-chest');if(!pane)return;
 pane.innerHTML=`<div class="hint" style="margin-bottom:6px">Saved tools with their colors and subjects. Click to use once, double-click to lock. Add your own from any selected markup's properties.</div>`+
 S.chest.map((c,i)=>`<div class="chest ${S.chestSel===i?'on':''}" data-i="${i}">${icon(c.type,`style="stroke:${c.style.stroke}"`)}<span class="nm">${esc(c.name)}<br><small style="color:var(--mut)">${esc(T[c.type]?.label||'')}${c.subject?' · '+esc(c.subject):''}</small></span><button class="x" data-x="${i}" title="Remove">✕</button></div>`).join('')}
$('#pane-chest').addEventListener('click',e=>{const x=e.target.closest('[data-x]');if(x){S.chest.splice(+x.dataset.x,1);LS.set('pm:chest',S.chest);renderChest();return}
 const it=e.target.closest('.chest');if(!it)return;useChest(+it.dataset.i,false)});
$('#pane-chest').addEventListener('dblclick',e=>{const it=e.target.closest('.chest');if(it)useChest(+it.dataset.i,true)});
function useChest(i,lock){const c=S.chest[i];if(!c||!S.pages.length)return;if(c.type==='stamp')S.stampText=c.text||S.stampText;setTool(c.type,{style:clone(c.style),subject:c.subject,chest:i,lock});if(innerWidth<=820)$('#left').classList.add('hide')}

/* ---------- search ---------- */
async function pageText(n){if(S.textCache[n])return S.textCache[n];const pg=await S.pdf.getPage(n);const tc=await pg.getTextContent();const vp=S.pages[n-1].vp;
 const items=tc.items.filter(i=>i.str).map(i=>{const[a,b,c,d,e,f]=i.transform;const h=Math.hypot(c,d)||Math.hypot(a,b);return{str:i.str,x:e,y:f,w:i.width,h,rot:Math.abs(b)>Math.abs(a)}});
 if(S.ocr&&S.ocr[n])for(const w of S.ocr[n])items.push(w);
 return S.textCache[n]={items,vp}}
let searchHits=[];
async function doSearch(){const q=$('#sq').value.trim();const cs=$('#sCase').checked;const out=$('#sRes');out.innerHTML='';searchHits=[];if(!q||!S.pdf)return;$('#sInfo').textContent='Searching…';
 const qq=cs?q:q.toLowerCase();
 for(const p of S.pages){const{items,vp}=await pageText(p.num);for(const it of items){const s=cs?it.str:it.str.toLowerCase();let idx=s.indexOf(qq);while(idx>=0){
   const L=it.str.length||1;let r;if(it.rot){r=vp.convertToViewportRectangle([it.x-it.h,it.y+it.w*idx/L,it.x,it.y+it.w*(idx+q.length)/L])}else r=vp.convertToViewportRectangle([it.x+it.w*idx/L,it.y-it.h*.2,it.x+it.w*(idx+q.length)/L,it.y+it.h*.85]);
   searchHits.push({page:p.num,r:normBox([r[0],r[1]],[r[2],r[3]]),str:it.str,idx,ql:q.length});idx=s.indexOf(qq,idx+1)}}}
 $('#sInfo').innerHTML=`${searchHits.length} result${searchHits.length===1?'':'s'}${searchHits.length?` · <a href="#" id="sMark" style="color:#7dd3fc">Highlight all</a>`:''}`;
 out.innerHTML=searchHits.slice(0,500).map((h,i)=>`<div class="res" data-i="${i}"><small style="color:var(--mut)">Page ${h.page}</small><br>${esc(h.str.slice(0,h.idx))}<mark>${esc(h.str.substr(h.idx,h.ql))}</mark>${esc(h.str.slice(h.idx+h.ql))}</div>`).join('')}
$('#sGo').onclick=doSearch;$('#sq').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch()});
$('#sRes').addEventListener('click',e=>{const r=e.target.closest('.res');if(!r)return;const h=searchHits[+r.dataset.i];const old=S.flash&&S.flash.page;S.flash={page:h.page,r:h.r};if(old)redrawPage(old);redrawPage(h.page);scrollToBox(h.page,h.r);clearTimeout(S.flashT);S.flashT=setTimeout(()=>{const pg=S.flash&&S.flash.page;S.flash=null;if(pg)redrawPage(pg)},2500)});
$('#sInfo').addEventListener('click',e=>{if(e.target.id!=='sMark')return;e.preventDefault();pushUndo();const st=Object.assign({},S.defaults.rect,{stroke:'#f59e0b',width:0,fill:'#ffd400',fillOpacity:.45});
 for(const h of searchHits){const m=newMarkup('rect',h.page,[[h.r[0],h.r[1]],[h.r[2],h.r[3]]],st);m.subject='Search: '+$('#sq').value.trim();S.markups.push(m)}commit();toast(`Highlighted ${searchHits.length} results`)});

/* ---------- dialogs ---------- */
let modalCb=null;
function modal(title,body,buttons){const md=$('#modal');md.innerHTML=`<h3>${esc(title)}</h3><div class="mb">${body}</div><div class="mf">${buttons.map((b,i)=>`<button class="btn ${b.pri?'pri':''}" data-b="${i}">${esc(b.label)}</button>`).join('')}</div>`;
 $('#modalBg').classList.add('on');modalCb=buttons;const f=md.querySelector('input:not([type=radio]):not([type=checkbox]),textarea');if(f)setTimeout(()=>{if(!f.isConnected||md.contains(document.activeElement))return;f.focus();if(f.select)f.select()},30)}
function closeModal(){$('#modalBg').classList.remove('on');modalCb=null}
$('#modal').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b||!modalCb)return;const btn=modalCb[+b.dataset.b];if(btn.fn&&btn.fn($('#modal'))===false)return;closeModal()});
$('#modal').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.target.matches('textarea')||e.key==='Enter'&&(e.ctrlKey||e.metaKey)){const i=modalCb?modalCb.findIndex(b=>b.pri):-1;if(i>=0){e.preventDefault();$(`#modal [data-b="${i}"]`).click()}}if(e.key==='Escape'){const i=modalCb?modalCb.findIndex(b=>b.cancel):-1;if(i>=0)$(`#modal [data-b="${i}"]`).click();else closeModal()}});
function modalPrompt(title,label,val,cb){modal(title,`<div class="fld"><label>${esc(label)}</label><input class="ti" id="mp" value="${esc(val)}"></div>`,[{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>{const v=md.querySelector('#mp').value.trim();if(v)cb(v)}}])}
function textDialog(m,isNew,field){modal(field==='comment'?'Note':m.type==='callout'?'Callout text':'Text box',`<div class="fld"><textarea class="ti" id="mt" rows="5" placeholder="Type here… (Ctrl+Enter to finish)">${esc(m[field])}</textarea></div>`,
 [{label:isNew?'Discard':'Cancel',cancel:1,fn:()=>{if(isNew&&!m[field]){S.markups=S.markups.filter(x=>x!==m);S.sel.delete(m.id);S.undo.pop();commit();renderProps()}}},
  {label:'OK',pri:1,fn:md=>{m[field]=md.querySelector('#mt').value;m.modified=Date.now();if(isNew&&m.type==='text'&&m[field]){const b=normBox(m.pts[0],m.pts[1]),fs=m.style.fontSize||12,need=wrap(m.text,b[2]-b[0]-fs*.7,fs).length*fs*1.2+fs*.8;if(need>b[3]-b[1])m.pts=[[b[0],b[1]],[b[2],b[1]+need]]}commit();renderProps()}}])}
function imagePicker(){if(!S.pages.length)return;const i=document.createElement('input');i.type='file';i.accept='image/png,image/jpeg';i.onchange=()=>{const f=i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{S.imageSrc=r.result;S.imageAR=im.naturalHeight/im.naturalWidth||1;setTool('image');toast('Drag a box or click to place the image')};im.src=r.result};r.readAsDataURL(f)};i.click()}
function stampPicker(){if(!S.pages.length)return;modal('Choose a stamp',`<div class="stamps">${STAMPS.map(s=>`<button data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="fld" style="margin-top:12px"><label>Custom stamp text</label><input class="ti" id="stc" placeholder="e.g. FIELD VERIFY"></div>`,
 [{label:'Cancel',cancel:1},{label:'Use custom',pri:1,fn:md=>{const v=md.querySelector('#stc').value.trim().toUpperCase();if(!v)return false;S.stampText=v;setTool('stamp')}}]);
 $('#modal .stamps').onclick=e=>{const b=e.target.closest('[data-st]');if(!b)return;S.stampText=b.dataset.st;closeModal();setTool('stamp')}}
function unitOpts(sel){return Object.entries(UNITS).map(([k,u])=>`<option value="${k}" ${k===sel?'selected':''}>${u.name}</option>`).join('')}
function precFields(sc){return`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Fraction precision (ft-in)</label><select class="ti" id="cPrec">${[1,2,4,8,16,32].map(d=>`<option value="${d}" ${d===(sc.prec||8)?'selected':''}>${d===1?'1"':'1/'+d+'"'}</option>`).join('')}</select></div>
 <div><label style="font-size:11px;color:var(--mut)">Decimals (others)</label><select class="ti" id="cDec">${[0,1,2,3,4].map(d=>`<option ${d===(sc.dec??2)?'selected':''}>${d}</option>`).join('')}</select></div></div>
 <div class="fld"><label>Apply to</label><label class="chk"><input type="radio" name="cAp" value="page" checked> This page (${S.cur})</label><label class="chk"><input type="radio" name="cAp" value="all"> All pages</label></div>`}
function applyScale(sc,md,page){const ap=md.querySelector('input[name=cAp]:checked').value;sc.prec=+md.querySelector('#cPrec').value;sc.dec=+md.querySelector('#cDec').value;
 if(ap==='all'){S.scales={all:sc}}else S.scales[page]=sc;saveScales();commit();updateScaleBtn();renderProps();toast('Scale set: '+sc.label)}
function calibrateDialog(page,ptLen){const cur=scaleFor(page);const paperIn=ptLen/72;
 modal('Calibrate',`<div class="hint" style="margin-bottom:10px">Line drawn: <b style="color:var(--text)">${paperIn.toFixed(3)}"</b> on paper. Enter the real-world length it represents.</div>
 <div class="fld"><label>Unit</label><select class="ti" id="cU">${unitOpts(cur.none?'ftin':cur.unit)}</select></div>
 <div class="row fld" id="cFI"><div><label style="font-size:11px;color:var(--mut)">Feet</label><input class="ti" type="number" id="cFt" value="10" step="any"></div><div><label style="font-size:11px;color:var(--mut)">Inches</label><input class="ti" type="number" id="cIn" value="0" step="any"></div></div>
 <div class="fld" id="cV" style="display:none"><label>Length</label><input class="ti" type="number" id="cVal" value="10" step="any"></div>${precFields(cur)}`,
 [{label:'Cancel',cancel:1},{label:'Calibrate',pri:1,fn:md=>{const u=md.querySelector('#cU').value;let meters;
  if(u==='ftin')meters=((+md.querySelector('#cFt').value||0)*12+(+md.querySelector('#cIn').value||0))*0.0254;else meters=(+md.querySelector('#cVal').value||0)*UNITS[u].m;
  if(!(meters>0)){toast('Enter a length greater than zero');return false}
  const perPt=meters/ptLen,ratio=perPt/PT_M;applyScale({perPt,unit:u,label:`Custom 1:${ratio>=10?Math.round(ratio):ratio.toFixed(2)}`},md,page)}}]);
 const sw=()=>{const ftin=$('#cU').value==='ftin';$('#cFI').style.display=ftin?'flex':'none';$('#cV').style.display=ftin?'none':'block'};$('#cU').onchange=sw;sw()}
function scaleDialog(){if(!S.pages.length)return;const cur=scaleFor(S.cur);
 const opts=`<optgroup label="Architectural">${ARCH.map(([l,v])=>`<option value="a:${v}">${l}" = 1'-0"</option>`).join('')}</optgroup><optgroup label="Engineering">${ENG.map(n=>`<option value="e:${n}">1" = ${n}'</option>`).join('')}</optgroup><optgroup label="Metric">${METRIC.map(n=>`<option value="m:${n}">1:${n}</option>`).join('')}</optgroup><optgroup label="Other"><option value="f:1">Full size 1:1</option></optgroup>`;
 modal('Scale',`<div class="hint" style="margin-bottom:10px">Current: <b style="color:var(--text)">${esc(cur.label)}</b> on page ${S.cur}</div>
 <div class="fld"><label>Preset scale</label><select class="ti" id="sP">${opts}</select></div>
 <div class="fld"><label>Display unit</label><select class="ti" id="sU">${unitOpts(cur.none?'ftin':cur.unit)}</select></div>${precFields(cur)}
 <div class="hint">Or <a href="#" id="sCal" style="color:#7dd3fc">calibrate by drawing</a> over a known dimension.</div>`,
 [{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{const[k,v]=md.querySelector('#sP').value.split(':'),n=+v;let perPt,label;
  if(k==='a'){perPt=12/n*PT_M;label=md.querySelector('#sP').selectedOptions[0].textContent}else if(k==='e'){perPt=12*n*PT_M;label=`1" = ${n}'`}else if(k==='m'){perPt=n*PT_M;label='1:'+n}else{perPt=PT_M;label='1:1'}
  applyScale({perPt,unit:md.querySelector('#sU').value,label},md,S.cur)}}]);
 $('#sP').value='a:0.25';$('#sP').onchange=()=>{const k=$('#sP').value[0];$('#sU').value=k==='a'?'ftin':k==='e'?'ft':k==='m'?'m':'in'};
 $('#sCal').onclick=e=>{e.preventDefault();closeModal();setTool('calibrate');toast('Draw a line over a known dimension')}}
function settingsDialog(){modal('Settings',`<div class="fld"><label>Author name (shown on markups)</label><input class="ti" id="stA" value="${esc(settings.author)}"></div>
 <label class="chk fld"><input type="checkbox" id="stW" ${settings.wheelZoom?'checked':''}> Mouse wheel zooms (Shift+wheel scrolls sideways; uncheck to scroll)</label>
 <div class="fld"><button class="btn" style="border:1px solid var(--line)" id="stR">Reset all tool defaults</button></div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:md=>{settings.author=md.querySelector('#stA').value.trim()||'User';settings.wheelZoom=md.querySelector('#stW').checked;LS.set('pm:settings',settings);toast('Settings saved')}}]);
 $('#stR').onclick=()=>{S.defaults=clone(BASE_DEF);LS.set('pm:defaults',S.defaults);toast('Tool defaults reset');renderProps()}}
function moreDialog(){modal('Markup data',`<div class="hint" style="margin-bottom:12px">Markups auto-save in this browser for this file. Saved PDFs from PlanMark also reopen with markups still editable.</div>
 <div style="display:flex;flex-direction:column;gap:8px"><button class="btn" style="border:1px solid var(--line);justify-content:flex-start" id="mxE">Export markups (.json)</button>
 <button class="btn" style="border:1px solid var(--line);justify-content:flex-start" id="mxI">Import markups (.json)…</button>
 <button class="btn" style="border:1px solid var(--line);justify-content:flex-start" id="mxF">Save flattened PDF (markups burned in, not editable)</button>
 <button class="btn" style="border:1px solid #7f1d1d;color:#fca5a5;justify-content:flex-start" id="mxC">Delete all markups</button></div>`,[{label:'Close',cancel:1}]);
 $('#mxE').onclick=()=>{closeModal();saveFile(baseName()+'-markups.json',JSON.stringify({app:'PlanMark',version:1,file:S.fileName,markups:S.markups,scales:S.scales},null,1))};
 $('#mxI').onclick=()=>{closeModal();$('#jsonIn').click()};
 $('#mxF').onclick=()=>{closeModal();exportPDF(true)};
 $('#mxC').onclick=()=>{closeModal();if(!S.markups.length)return;pushUndo();S.markups=[];S.sel.clear();commit();renderProps();toast('All markups deleted (Ctrl+Z to undo)')}}
$('#jsonIn').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());const ms=(j.markups||[]).filter(m=>T[m.type]&&m.page<=S.pages.length);pushUndo();
 const ids=new Set(S.markups.map(m=>m.id));for(const m of ms){if(ids.has(m.id))m.id=uid();S.markups.push(m)}if(j.scales)Object.assign(S.scales,j.scales);saveScales();commit();updateScaleBtn();toast(`Imported ${ms.length} markups`)}catch(err){toast('Not a valid markups file')}};

/* ---------- export ---------- */
let dlP=null;function getDL(){if(!dlP)dlP=(window.claude&&typeof window.claude.use==='function')?Promise.resolve(window.claude.use('downloads')).catch(()=>null):Promise.resolve(null);return dlP}
async function saveFile(name,data){const dl=await getDL();
 if(dl){try{await dl.save({filename:name,data});toast('Saved '+name)}catch(e){if(e&&e.code==='declined')return;fallbackDL(name,data)}return}fallbackDL(name,data)}
function fallbackDL(name,data){try{const a=document.createElement('a');a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));a.download=name;document.body.appendChild(a);a.click();a.remove();toast('Downloading '+name)}catch(e){toast('Downloads are not available in this view')}}
const baseName=()=>(S.fileName||'document').replace(/\.pdf$/i,'');
function hexRgb(h){h=(h||'#000').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return PDFLib.rgb((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)}
const safeTxt=s=>String(s||'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?');
function xfPath(d,vp){const tk=d.match(/[MLAZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);let o='',i=0;
 while(i<tk.length){const c=tk[i++];if(c==='Z'){o+='Z ';continue}
  if(c==='M'||c==='L'){const[x,y]=vp.convertToPdfPoint(+tk[i],+tk[i+1]);i+=2;o+=`${c}${x.toFixed(3)} ${(-y).toFixed(3)} `}
  else if(c==='A'){const[x,y]=vp.convertToPdfPoint(+tk[i+5],+tk[i+6]);o+=`A${tk[i]} ${tk[i+1]} ${tk[i+2]} ${tk[i+3]} ${tk[i+4]} ${x.toFixed(3)} ${(-y).toFixed(3)} `;i+=7}}return o}
async function exportPDF(flatOnly){if(!S.bytes)return;if(!window.PDFLib){toast('PDF engine failed to load');return}toast('Building PDF…');
 try{const{PDFDocument,StandardFonts,degrees,BlendMode,LineCapStyle,pushGraphicsState,popGraphicsState}=PDFLib;
  const doc=await PDFDocument.load(S.bytes,{ignoreEncryption:true,updateMetadata:false});const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const FCACHE={},FMAP={Helvetica:['Helvetica','HelveticaBold','HelveticaOblique','HelveticaBoldOblique'],Times:['TimesRoman','TimesRomanBold','TimesRomanItalic','TimesRomanBoldItalic'],Courier:['Courier','CourierBold','CourierOblique','CourierBoldOblique']};
  const fontFor=async p=>{const fam=FMAP[p.font]||FMAP.Helvetica,k=fam[(p.bold?1:0)+(p.italic?2:0)];return FCACHE[k]||(FCACHE[k]=await doc.embedFont(StandardFonts[k]))};const ICACHE={};
  const wrapped=new Set(),pages=doc.getPages();
  for(const m of S.markups){const page=pages[m.page-1],vp=S.pages[m.page-1]&&S.pages[m.page-1].vp;if(!page||!vp)continue;
   if(!wrapped.has(m.page)){wrapped.add(m.page);try{const ctx=doc.context;page.node.wrapContentStreams(ctx.register(ctx.contentStream([pushGraphicsState()])),ctx.register(ctx.contentStream([popGraphicsState()])))}catch(e){}}
   for(const p of prims(m)){try{
    if(p.k==='p'){const o={x:0,y:0,borderLineCap:LineCapStyle.Round};
     if(p.stroke&&p.w>0){o.borderColor=hexRgb(p.stroke);o.borderWidth=p.w;o.borderOpacity=p.so;const da=p.dash&&dashArr(p);if(da)o.borderDashArray=da}else o.borderWidth=0;
     if(p.fill){o.color=hexRgb(p.fill);o.opacity=p.fo*p.so}else o.color=undefined;if(p.blend)o.blendMode=BlendMode.Multiply;
     if(!p.fill&&!(p.stroke&&p.w>0))continue;page.drawSvgPath(xfPath(p.d,vp),o)}
 else if(p.k==='img'){if(!p.src)continue;let im=ICACHE[p.src];if(!im){const b64=p.src.split(',')[1],bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));im=ICACHE[p.src]=/^data:image\/png/.test(p.src)?await doc.embedPng(bytes):await doc.embedJpg(bytes)}
     const c=[[p.b[0],p.b[3]],[p.b[2],p.b[3]],[p.b[0],p.b[1]]].map(q=>vp.convertToPdfPoint(q[0],q[1]));const rot=(vp.rotation||0);page.drawImage(im,{x:c[0][0],y:c[0][1],width:Math.hypot(c[1][0]-c[0][0],c[1][1]-c[0][1]),height:Math.hypot(c[2][0]-c[0][0],c[2][1]-c[0][1]),rotate:degrees(rot),opacity:p.o})}
    else{const f=await fontFor(p),str=safeTxt(p.s);if(!str.trim())continue;const w=f.widthOfTextAtSize(str,p.size),a=(p.ang||0)*Math.PI/180,dir=[Math.cos(a),Math.sin(a)],dn=[-Math.sin(a),Math.cos(a)];
     let x=p.x,y=p.y;if(p.align==='middle'){x-=dir[0]*w/2;y-=dir[1]*w/2}
     if(p.halo){const pad=p.size*.18,c=[[x-dir[0]*pad-dn[0]*p.size*.6,y-dir[1]*pad-dn[1]*p.size*.6]];c.push([c[0][0]+dir[0]*(w+2*pad),c[0][1]+dir[1]*(w+2*pad)]);c.push([c[1][0]+dn[0]*p.size*1.2,c[1][1]+dn[1]*p.size*1.2]);c.push([c[0][0]+dn[0]*p.size*1.2,c[0][1]+dn[1]*p.size*1.2]);
      page.drawSvgPath(xfPath(dPoly(c,true),vp),{x:0,y:0,color:PDFLib.rgb(1,1,1),opacity:.8*p.o,borderWidth:0})}
     x+=dn[0]*p.size*.35;y+=dn[1]*p.size*.35;const[px,py]=vp.convertToPdfPoint(x,y);
     page.drawText(str,{x:px,y:py,size:p.size,font:f,color:hexRgb(p.color),opacity:p.o,rotate:degrees((vp.rotation||0)-(p.ang||0))})}
   }catch(e){console.warn('prim',e)}}}
  for(const f of H.exportPage)try{await f(doc,pages,font)}catch(e){console.warn(e)}
  if(!flatOnly){await doc.attach(S.bytes,'planmark-original.pdf',{mimeType:'application/pdf',description:'Original PDF (PlanMark)'});
   await doc.attach(new TextEncoder().encode(JSON.stringify({markups:S.markups,scales:S.scales})),'planmark-markups.json',{mimeType:'application/json',description:'Editable markups (PlanMark)'})}
  const out=await doc.save();await saveFile(baseName()+(flatOnly?'-flattened':'-markup')+'.pdf',new Blob([out],{type:'application/pdf'}))}
 catch(e){console.error(e);toast('Export failed: '+(e.message||e))}}

/* ---------- misc UI ---------- */
let toT=0;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toT);toT=setTimeout(()=>t.classList.remove('on'),2600)}
function switchTab(n){$$('#left .tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));TABS.forEach(k=>$('#pane-'+k).classList.toggle('hide',k!==n));$('#left').classList.remove('hide');if(n==='search')setTimeout(()=>$('#sq').focus(),30)}
const TABS=['pages','search','chest'];$$('#left .tabs button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
const setIcon=(id,k,label)=>{$(id).innerHTML=icon(k)+(label?`<span class="hide-m">${label}</span>`:'')};
setIcon('#bLeft','lpanel');setIcon('#bOpen','open','Open');setIcon('#bSave','save','Save');setIcon('#bMore','more');setIcon('#bUndo','undo');setIcon('#bRedo','redo');setIcon('#bZout','zout');setIcon('#bZin','zin');setIcon('#bFitW','fitw');setIcon('#bFitP','fitp');setIcon('#bPrev','prev');setIcon('#bNext','next');setIcon('#bSettings','gear');setIcon('#bRight','rpanel');
$('#bOpen').onclick=$('#eOpen').onclick=()=>$('#fileIn').click();$('#eBlank').onclick=blankSheet;
$('#fileIn').onchange=e=>{const f=e.target.files[0];e.target.value='';openFile(f)};
$('#bSave').onclick=()=>exportPDF(false);$('#bMore').onclick=moreDialog;$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;
$('#bZin').onclick=()=>zoomBy(1.25);$('#bZout').onclick=()=>zoomBy(.8);$('#bFitW').onclick=fitWidth;$('#bFitP').onclick=fitPage;
$('#bPrev').onclick=()=>gotoPage(S.cur-1);$('#bNext').onclick=()=>gotoPage(S.cur+1);
$('#pageIn').onchange=e=>gotoPage(+e.target.value);$('#zoomv').onchange=e=>{const v=parseFloat(e.target.value);if(v>0)setZoom(v/100);else $('#zoomv').value=Math.round(S.zoom*100)+'%'};
$('#bSettings').onclick=settingsDialog;$('#scaleBtn').onclick=scaleDialog;
$('#bLeft').onclick=()=>$('#left').classList.toggle('hide');$('#bRight').onclick=()=>$('#right').classList.toggle('hide');
['dragenter','dragover'].forEach(ev=>viewer.addEventListener(ev,e=>{e.preventDefault();$('#empty').classList.add('drag')}));
['dragleave','drop'].forEach(ev=>viewer.addEventListener(ev,e=>{e.preventDefault();$('#empty').classList.remove('drag')}));
viewer.addEventListener('drop',e=>{const fs=[...(e.dataTransfer.files||[])];fs.forEach((f,i)=>setTimeout(()=>openFile(f),i*400))});
viewer.addEventListener('contextmenu',e=>{if(S.drawing||S.countId){e.preventDefault();finishActive()}});

/* ---------- keyboard ---------- */
const KEYMAP={KeyV:'select',KeyH:'highlight',KeyL:'line',KeyA:'arrow',KeyR:'rect',KeyE:'ellipse',KeyP:'polygon',KeyC:'cloud',KeyT:'text',KeyQ:'callout',KeyN:'note',KeyS:'stamp'};
const KEYMAP_SA={KeyK:'calibrate',KeyL:'length',KeyN:'polylength',KeyA:'area',KeyP:'perimeter',KeyC:'count',KeyG:'angle'};
document.addEventListener('keydown',e=>{
 if(e.target.closest&&e.target.closest('input,textarea,select')){if(e.key==='Escape')e.target.blur();return}
 if(modalCb)return;const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
 if(mod&&k==='o'){e.preventDefault();$('#fileIn').click();return}
 if(!S.pages.length)return;
 if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
 if(mod&&k==='y'){e.preventDefault();redo();return}
 if(mod&&k==='c'){copySel();return}if(mod&&k==='v'){paste(false);return}if(mod&&k==='d'){e.preventDefault();paste(true);return}
 if(mod&&k==='a'){e.preventDefault();if(S.tool!=='select')setTool('select');setSel(S.markups.filter(m=>m.page===S.cur).map(m=>m.id));return}
 if(mod&&k==='s'){e.preventDefault();exportPDF(false);return}
 if(mod&&k==='f'){e.preventDefault();switchTab('search');return}
 if(mod&&(k==='='||k==='+')){e.preventDefault();zoomBy(1.25);return}if(mod&&k==='-'){e.preventDefault();zoomBy(.8);return}if(mod&&k==='0'){e.preventDefault();fitPage();return}
 if(mod)return;
 if(k==='delete'||k==='backspace'){e.preventDefault();if(S.drawing||S.countId)undoPoint();else delSel();return}
 if(k==='escape'){if(S.drawing||S.countId)cancelActive();else if(S.sel.size)setSel([]);else setTool('pan');return}
 if(k==='enter'){finishActive();return}
 if(e.key===' '){e.preventDefault();if(!S.space){S.space=true;viewer.classList.add('c-pan')}return}
 if(k==='pageup'){gotoPage(S.cur-1);return}if(k==='pagedown'){gotoPage(S.cur+1);return}
 if(S.sel.size&&k.startsWith('arrow')){e.preventDefault();const st=e.shiftKey?10:1,dx=k==='arrowleft'?-st:k==='arrowright'?st:0,dy=k==='arrowup'?-st:k==='arrowdown'?st:0;if(!e.repeat)pushUndo();for(const id of S.sel){const m=byId(id);m.pts=m.pts.map(p=>[p[0]+dx,p[1]+dy])}commit();return}
 let t=null;if(e.shiftKey&&e.altKey)t=KEYMAP_SA[e.code];else if(e.shiftKey&&!e.altKey){if(e.code==='KeyN')t='polyline';if(e.code==='KeyP')t='pen'}else if(!e.altKey)t=KEYMAP[e.code];
 if(t){e.preventDefault();if(t==='stamp')stampPicker();else setTool(t)}});
document.addEventListener('keyup',e=>{if(e.key===' '){S.space=false;updateRibbon()}});

/* ---------- init ---------- */
function addTab(name,label,html){const b=document.createElement('button');b.dataset.tab=name;b.textContent=label;b.onclick=()=>switchTab(name);$('#left .tabs').appendChild(b);const d=document.createElement('div');d.className='pane hide';d.id='pane-'+name;d.innerHTML=html||'';$('#left').appendChild(d);TABS.push(name);return d}
window.addEventListener('load',()=>{buildRibbon();updateRibbon();renderProps();renderList();renderChest();updUndo();
if(innerWidth<=820){$('#left').classList.add('hide');$('#right').classList.add('hide');$('#mlist').classList.add('col');$('#mlArrow').textContent='▸'}
if(!window.pdfjsLib)toast('Could not load the PDF engine. Check your connection and reload.');
hook('ready')});
