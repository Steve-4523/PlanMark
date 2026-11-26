/* qa2.js — markup-tool fixes from the QA sweep (area 2), to behave like Bluebeam Revu.
   1. Text box / typewriter / callout / cloud+ text is typed right on the page (no dialog).
      Click away, Esc or Ctrl+Enter finishes; Enter is a new line. An empty new one is removed.
   2. Double-click a text markup to edit its text in place; double-click a note opens its note.
   3. Esc closes any open dialog, wherever the focus is.
   4. Dragging with click tools (typewriter, note, stamp, symbol, flag…) places them instead of doing nothing;
      dragging with Callout goes arrow tip → text box; dragging with Polyline draws the first segment. */
(function(){
'use strict';
const INPLACE=new Set(['text','callout','typewriter','cloudplus']);
let ED=null; // {m,ta,isNew,orig:{text,pts},undone}

function pageOf(m){return S.pages[m.page-1]}
function geom(m){const s=m.style,fs=s.fontSize||(m.type==='text'||m.type==='typewriter'||m.type==='callout'||m.type==='cloudplus'?12:10);
 if(m.type==='typewriter'){const g=typeGeom(m);return{b:g.b,pad:0,fs,wrap:false}}
 if(m.type==='cloudplus'){const g=cloudTag(Object.assign({},m,{text:m.text||' '}));return{b:g.b,pad:g.pad,fs,wrap:false}}
 const b=m.type==='callout'?normBox(m.pts[1],m.pts[2]):normBox(m.pts[0],m.pts[1]);return{b,pad:Math.max(3,fs*.35),fs,wrap:true}}

// grow the box so the text fits (text box and callout grow downward, like Bluebeam)
function fit(m){if(m.type!=='text'&&m.type!=='callout')return;const s=m.style,fs=s.fontSize||12,ft={font:s.font,bold:!!s.bold,italic:!!s.italic};
 const i0=m.type==='callout'?1:0,b=normBox(m.pts[i0],m.pts[i0+1]),pad=Math.max(3,fs*.35);
 const need=wrap(m.text||' ',b[2]-b[0]-pad*2,fs,ft).length*fs*1.2+pad*2;
 const h=Math.max(ED&&ED.m===m?ED.minH:0,need);if(Math.abs(h-(b[3]-b[1]))<.01)return;
 const nb=[[b[0],b[1]],[b[2],b[1]+h]];if(m.type==='callout')m.pts=[m.pts[0],nb[0],nb[1]];else m.pts=nb}

function place(){if(!ED)return;const{m,ta}=ED,p=pageOf(m);if(!p||!p.el.isConnected){finish();return}
 const r=p.el.getBoundingClientRect(),k=r.width/p.w,g=geom(m),s=m.style,b=g.b;
 const st=ta.style;st.left=(r.left+b[0]*k)+'px';st.top=(r.top+b[1]*k)+'px';
 st.width=Math.max(8,(b[2]-b[0])*k)+'px';st.height=Math.max(g.fs*1.2*k,(b[3]-b[1])*k)+'px';
 st.padding=(g.pad*k)+'px';st.fontSize=(g.fs*k)+'px';st.lineHeight=(g.fs*1.2*k)+'px';
 st.fontFamily=FONTS[s.font]||FONTS.Helvetica;st.fontWeight=s.bold?'bold':'normal';st.fontStyle=s.italic?'italic':'normal';
 st.color=s.color||s.stroke||'#000';st.whiteSpace=g.wrap?'pre-wrap':'pre';
 // keep it inside the viewer (no drawing over the toolbars when scrolled)
 const v=document.getElementById('viewer');if(v){const vr=v.getBoundingClientRect(),L=r.left+b[0]*k,T0=r.top+b[1]*k,W=ta.offsetWidth,Hh=ta.offsetHeight;
  const ct=Math.max(0,vr.top-T0),cl=Math.max(0,vr.left-L),cb=Math.max(0,T0+Hh-vr.bottom),cr=Math.max(0,L+W-vr.right);
  st.clipPath=(ct||cl||cb||cr)?`inset(${ct}px ${cr}px ${cb}px ${cl}px)`:''}}

function loop(){if(!ED)return;place();ED.raf=requestAnimationFrame(loop)}

function start(m,isNew){if(ED)finish();if(!m||!pageOf(m))return false;
 const ta=document.createElement('textarea');ta.className='qaEdit';ta.spellcheck=true;ta.value=m.text||'';ta.setAttribute('aria-label','Markup text');
 Object.assign(ta.style,{position:'fixed',zIndex:60,margin:0,border:'0',outline:'1px dashed rgba(37,99,235,.9)',outlineOffset:'0',background:'transparent',resize:'none',overflow:'hidden',boxSizing:'border-box',caretColor:'#2563eb',minWidth:'8px'});
 document.body.appendChild(ta);
 const i0=m.type==='callout'?1:0,b0=(m.type==='text'||m.type==='callout')?normBox(m.pts[i0],m.pts[i0+1]):null;
 ED={m,ta,isNew,orig:{text:m.text||'',pts:JSON.parse(JSON.stringify(m.pts))},undone:isNew,minH:b0?b0[3]-b0[1]:0};
 m._qaEdit=true;redrawPage(m.page);place();ta.focus();const n=ta.value.length;ta.setSelectionRange(n,n);if(!isNew)ta.select();
 ta.addEventListener('input',()=>{if(!ED)return;if(!ED.undone){pushUndo();ED.undone=true}m.text=ta.value;fit(m);m.modified=Date.now();redrawPage(m.page);place()});
 ta.addEventListener('keydown',e=>{e.stopPropagation();
  if(e.key==='Escape'||(e.key==='Enter'&&(e.ctrlKey||e.metaKey))){e.preventDefault();finish();return}
  const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(mod&&(k==='b'||k==='i')){e.preventDefault();if(!ED.undone){pushUndo();ED.undone=true}m.style[k==='b'?'bold':'italic']=!m.style[k==='b'?'bold':'italic'];fit(m);redrawPage(m.page);place();renderProps()}
  if(mod&&(k==='z'||k==='y'))e.stopPropagation()});// native textarea undo while typing
 ta.addEventListener('blur',()=>setTimeout(()=>{if(ED&&ED.ta===ta&&document.activeElement!==ta)finish()},0));
 loop();return true}

function finish(){if(!ED)return;const{m,ta,isNew}=ED;cancelAnimationFrame(ED.raf);const e=ED;ED=null;
 m.text=ta.value.replace(/\s+$/,'');delete m._qaEdit;ta.remove();
 if(!m.text&&isNew){S.markups=S.markups.filter(x=>x!==m);S.sel.delete(m.id);if(S.undo.length)S.undo.pop();commit0();renderProps();return}
 if(m.text===e.orig.text&&!e.undone){redrawPage(m.page);return}
 fit(m);m.modified=Date.now();commit0();renderProps()}
const commit0=()=>commit();

// public
window.QA2={start,finish,get editing(){return ED&&ED.m.id}};

// hide the drawn text of the markup being edited (the textarea shows it)
const _prims=prims;prims=function(m){const out=_prims.apply(this,arguments);return m&&m._qaEdit?out.filter(p=>p.k!=='t'):out};

// 1. no dialog for text box / typewriter / callout / cloud+
const _td=textDialog;textDialog=function(m,isNew,field){if(field==='text'&&m&&INPLACE.has(m.type)&&start(m,!!isNew))return;return _td.apply(this,arguments)};

// finish editing before anything else happens
document.addEventListener('pointerdown',e=>{if(ED&&e.target!==ED.ta)finish()},true);
const _st=setTool;setTool=function(){if(ED)finish();return _st.apply(this,arguments)};
['undo','redo'].forEach(f=>{const o=window[f];if(typeof o==='function')window[f]=function(){if(ED)finish();return o.apply(this,arguments)}});

// 2. double-click to edit
// (the page redraws between the two clicks, so the event lands on the viewer: hit-test by position)
function hitAt(x,y){const el=document.elementFromPoint(x,y),mk=el&&el.closest&&el.closest('.mk');if(mk&&byId(mk.dataset.id))return byId(mk.dataset.id);
 const p=S.pages.find(q=>{const r=q.el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});if(!p)return null;const pt=toPt({clientX:x,clientY:y},p),tol=4/S.zoom;
 const c=S.markups.filter(m=>m.page===p.num&&S.sel.has(m.id)).concat(S.markups.filter(m=>m.page===p.num&&INPLACE.has(m.type)).reverse());
 return c.find(m=>{const b=bboxOf(m);return pt[0]>=b[0]-tol&&pt[0]<=b[2]+tol&&pt[1]>=b[1]-tol&&pt[1]<=b[3]+tol})||null}
document.addEventListener('dblclick',e=>{if(S.tool!=='select'||ED||!S.pages.length)return;if(e.target.closest&&e.target.closest('input,textarea,select,button,#right,#left,#ribbon,#modal'))return;
 const m=hitAt(e.clientX,e.clientY);if(!m||m.lock||m.locked)return;
 if(INPLACE.has(m.type)){e.preventDefault();e.stopPropagation();setSel([m.id],true);start(m,false)}
 else if(m.type==='note'||m.type==='flag'){e.preventDefault();e.stopPropagation();setSel([m.id],true);_td(m,false,'comment')}});
// the right-click menu's "Edit text" does what a double-click does
window.PMInlineText={types:INPLACE,edit(m){if(!m||m.lock||m.locked)return false;if(S.tool!=='select')setTool('select');setSel([m.id],true);if(INPLACE.has(m.type)){start(m,false);return true}if(m.type==='note'||m.type==='flag'){_td(m,false,'comment');return true}return false}};

// 3. Esc closes dialogs even when focus is outside the dialog
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!modalCb||!$('#modalBg').classList.contains('on'))return;if($('#modal').contains(e.target))return;
 e.preventDefault();e.stopImmediatePropagation();const i=modalCb.findIndex(b=>b.cancel);if(i>=0)$(`#modal [data-b="${i}"]`).click();else closeModal()},true);

// 4. drags with click-type tools
const RECTDRAG=new Set(['polygon','cloud','area','perimeter','cloudplus','space','volume']);
const _hc=handleClick;handleClick=function(g,e){const moved=Math.hypot(e.clientX-g.cx,e.clientY-g.cy)>10,t=T[S.tool];
 if(!moved||!t)return _hc.apply(this,arguments);
 const down={clientX:g.cx,clientY:g.cy,shiftKey:false,altKey:e.altKey,ctrlKey:false,metaKey:false};
 if(t.kind==='click'){return _hc.call(this,g,down)}
 if((t.kind==='callout'||(t.kind==='multi'&&!RECTDRAG.has(S.tool)))&&!S.drawing){_hc.call(this,g,down);S.lastUp=0;
  return _hc.call(this,Object.assign({},g,{cx:e.clientX,cy:e.clientY}),e)}
 return _hc.apply(this,arguments)};

// 5. handles like Bluebeam: side handles on boxes, Shift keeps proportions, corner handles to scale ink/stamps,
//    a rotate handle above rotatable markups.
let SHIFT=false;
addEventListener('pointermove',e=>{SHIFT=!!e.shiftKey},true);addEventListener('pointerdown',e=>{SHIFT=!!e.shiftKey},true);
addEventListener('keydown',e=>{if(e.key==='Shift')SHIFT=true},true);addEventListener('keyup',e=>{if(e.key==='Shift')SHIFT=false},true);addEventListener('blur',()=>{SHIFT=false});
const BOXT=m=>T[m.type]&&T[m.type].box;
const SCALET=new Set(['pen','highlight','stamp']);
const NOROT=new Set(['ellipse','text','image','hlink','stamp','typewriter','note','count','symbol','legend','callout','texthl','underline','strikeout','squiggly','circle','flag','redact','length','dimension','calibrate','viewport']);
const one=m=>S.sel.size===1&&S.sel.has(m.id)&&!m.locked&&!m.lock;
const _ho2=handlesOf;handlesOf=function(m){let h=_ho2.apply(this,arguments);if(!m||!T[m.type]||m.locked||m.lock||!one(m))return h;
 if((BOXT(m)||(m.type==='callout'&&m.pts.length>2))&&m.pts.length>=2){const o=m.type==='callout'?1:0,b=normBox(m.pts[o],m.pts[o+1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  h=h.concat([[cx,b[1],'c4'],[b[2],cy,'c5'],[cx,b[3],'c6'],[b[0],cy,'c7']])}
 if(SCALET.has(m.type)&&one(m)){const b=bboxOf(m);h=h.concat([[b[0],b[1],'s0'],[b[2],b[1],'s1'],[b[2],b[3],'s2'],[b[0],b[3],'s3']])}
 if(one(m)&&!NOROT.has(m.type)&&m.pts.length>=2&&!(T[m.type].textm)){const b=bboxOf(m);h.push([(b[0]+b[2])/2,b[1]-22/S.zoom,'R'])}
 return h};
function obox(m,orig){if(m.type==='callout')return normBox(orig[1],orig[2]);if(BOXT(m))return normBox(orig[0],orig[1]);return ptsBox(orig)}
const _ah2=applyHandle;applyHandle=function(m,k,pt,orig){
 if(!m||!k)return _ah2.apply(this,arguments);
 if(k==='c4'||k==='c5'||k==='c6'||k==='c7'){const o=m.type==='callout'?1:0,b=normBox(orig[o],orig[o+1]);
  if(k==='c4')b[1]=pt[1];if(k==='c6')b[3]=pt[1];if(k==='c5')b[2]=pt[0];if(k==='c7')b[0]=pt[0];
  m.pts[o]=[Math.min(b[0],b[2]),Math.min(b[1],b[3])];m.pts[o+1]=[Math.max(b[0],b[2]),Math.max(b[1],b[3])];return}
 if(/^c[0-3]$/.test(k)&&SHIFT){const o=m.type==='callout'?1:0,b=normBox(orig[o],orig[o+1]),i=+k[1],ax=(i===0||i===3)?b[2]:b[0],ay=i<2?b[3]:b[1];
  const w=b[2]-b[0]||1,hh=b[3]-b[1]||1,f=Math.max(Math.abs(pt[0]-ax)/w,Math.abs(pt[1]-ay)/hh);
  const sx=(i===0||i===3)?-1:1,sy=i<2?-1:1;return _ah2.call(this,m,k,[ax+sx*w*f,ay+sy*hh*f],orig)}
 if(/^s[0-3]$/.test(k)){const i=+k[1];if(m.type==='stamp'){if(m._qaFs0==null)m._qaFs0=m.style.fontSize||20;
   const b0=(()=>{const c=Object.assign({},m,{pts:orig,style:Object.assign({},m.style,{fontSize:m._qaFs0})});return stampGeom(c).b})(),ax=(i===0||i===3)?b0[2]:b0[0],ay=i<2?b0[3]:b0[1];
   const f=Math.max(.15,Math.max(Math.abs(pt[0]-ax)/(b0[2]-b0[0]),Math.abs(pt[1]-ay)/(b0[3]-b0[1])));
   m.style=Object.assign({},m.style,{fontSize:Math.round(m._qaFs0*f*10)/10});const g=stampGeom(m).b,w=g[2]-g[0],h=g[3]-g[1];
   m.pts=[[ax+((i===0||i===3)?-w/2:w/2),ay+(i<2?-h/2:h/2)]];return}
  const b=ptsBox(orig),ax=(i===0||i===3)?b[2]:b[0],ay=i<2?b[3]:b[1],ox=(i===0||i===3)?b[0]:b[2],oy=i<2?b[1]:b[3];
  let fx=(pt[0]-ax)/((ox-ax)||1),fy=(pt[1]-ay)/((oy-ay)||1);if(SHIFT){const f=Math.max(Math.abs(fx),Math.abs(fy));fx=f*Math.sign(fx||1);fy=f*Math.sign(fy||1)}
  if(Math.abs(fx)<.02)fx=.02*Math.sign(fx||1);if(Math.abs(fy)<.02)fy=.02*Math.sign(fy||1);
  m.pts=orig.map(q=>[ax+(q[0]-ax)*fx,ay+(q[1]-ay)*fy]);return}
 if(k==='R'){let src=orig;if(m._qaRot0==null){m._qaRot0=m.rotDeg||0;m._qaRotType=m.type}
  if(m._qaRotType==='rect'&&orig.length===2){const q=normBox(orig[0],orig[1]);src=[[q[0],q[1]],[q[2],q[1]],[q[2],q[3]],[q[0],q[3]]];m.type='polygon'}
  const b=ptsBox(src),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;let d=Math.atan2(pt[1]-cy,pt[0]-cx)*180/Math.PI+90;if(SHIFT)d=Math.round(d/15)*15;
  const a=d*Math.PI/180,co=Math.cos(a),si=Math.sin(a),tf=q=>[cx+(q[0]-cx)*co-(q[1]-cy)*si,cy+(q[0]-cx)*si+(q[1]-cy)*co];
  m.pts=src.map(tf);if(Array.isArray(m.curves)&&m._qaCurves0==null)m._qaCurves0=JSON.parse(JSON.stringify(m.curves));
  if(m._qaCurves0)m.curves=m._qaCurves0.map(c=>Array.isArray(c)&&c.length===2&&typeof c[0]==='number'?tf(c):Array.isArray(c)?c.map(x=>Array.isArray(x)&&typeof x[0]==='number'?tf(x):x):c);
  let r=((m._qaRot0+d)%360+360)%360;if(r>180)r-=360;m.rotDeg=Math.round(r*10)/10;return}
 return _ah2.apply(this,arguments)};
addEventListener('pointerup',()=>{for(const m of S.markups)if(m._qaRot0!=null||m._qaFs0!=null||m._qaCurves0!=null){delete m._qaRot0;delete m._qaRotType;delete m._qaFs0;delete m._qaCurves0}},true);
{const st=document.createElement('style');st.textContent='.hd[data-h$="|R"]{fill:#22c55e;cursor:grab}.hd[data-h$="|c4"],.hd[data-h$="|c6"]{cursor:ns-resize}.hd[data-h$="|c5"],.hd[data-h$="|c7"]{cursor:ew-resize}';document.head.appendChild(st)}

// 6. Ctrl+drag a markup makes a copy (Ctrl+click still adds/removes it from the selection)
let CD=null;
addEventListener('pointerdown',e=>{CD=null;if(!(e.ctrlKey||e.metaKey)||e.button!==0||S.tool!=='select'||ED||!S.pages.length)return;
 const mk=e.target.closest&&e.target.closest('.mk');if(!mk||e.target.closest('[data-h]'))return;const m=byId(mk.dataset.id);if(!m)return;
 if(m.link&&m.type!=='hlink'&&!e.shiftKey)return; // Ctrl+click on a markup with an action follows the action
 const p=S.pages[m.page-1];e.preventDefault();e.stopImmediatePropagation();CD={id:m.id,x:e.clientX,y:e.clientY,p,pt:toPt(e,p),on:false}},true);
addEventListener('pointermove',e=>{if(!CD||CD.on||!(e.buttons&1))return;if(Math.hypot(e.clientX-CD.x,e.clientY-CD.y)<4)return;CD.on=true;
 const base=S.sel.has(CD.id)?[...S.sel]:[CD.id];const src=S.markups.filter(m=>base.includes(m.id)&&!m.locked);if(!src.length){CD=null;return}
 pushUndo();const gmap={},now=Date.now(),copies=src.map(m=>{const c=clone(m);c.id=uid();c.created=now;c.modified=now;c.author=settings.author;if(c.group){gmap[c.group]=gmap[c.group]||uid();c.group=gmap[c.group]}delete c.replies;return c});
 S.markups.push(...copies);setSel(copies.map(c=>c.id),true);
 G={k:'move',start:CD.pt,p:CD.p,orig:new Map(copies.map(c=>[c.id,clone(c.pts)])),undone:true,moved:false}},true);
addEventListener('pointerup',e=>{const c=CD;CD=null;if(c&&!c.on)toggleSel(c.id)},true);

// 7. right-click on a selection handle opens the markup's menu (not the page menu)
viewer.addEventListener('contextmenu',e=>{const h=e.target.closest&&e.target.closest('[data-h]');if(!h||S.drawing||S.countId)return;const m=byId(h.dataset.h.split('|')[0]);
 if(!m||!window.PMWorkspace||!PMWorkspace.markupMenu)return;e.preventDefault();e.stopImmediatePropagation();PMWorkspace.markupMenu(e.clientX,e.clientY,m)},true);

// 8. Eraser works like Bluebeam: it rubs out the parts of pen / highlighter ink it passes over
//    (a stroke cut in two becomes two strokes) and leaves every other markup alone.
const INK=new Set(['pen','highlight']);
function segD(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
eraseAt=function(x,y,g){const p=S.pages.find(q=>{const r=q.el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});if(!p)return;
 const pt=toPt({clientX:x,clientY:y},p),prev=g.qaLast&&g.qaLast.page===p.num?g.qaLast.pt:pt;g.qaLast={page:p.num,pt};
 const R=7/S.zoom,changed=[];
 for(const m of S.markups.slice()){if(m.page!==p.num||!INK.has(m.type)||m.locked||m.lock||m.hidden)continue;
  const rr=R+((m.style&&m.style.width)||1)/2,b=ptsBox(m.pts);if(segD([Math.max(b[0],Math.min(b[2],pt[0])),Math.max(b[1],Math.min(b[3],pt[1]))],prev,pt)>rr+1)continue;
  // densify so a long straight stroke can be cut in the middle
  const P=[],PR=[],hasP=Array.isArray(m.press),step=rr/2;m.pts.forEach((q,i)=>{if(i){const a=m.pts[i-1],n=Math.ceil(Math.hypot(q[0]-a[0],q[1]-a[1])/step);for(let k=1;k<n;k++){const t=k/n;P.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);if(hasP)PR.push(m.press[i-1]+(m.press[i]-m.press[i-1])*t)}}P.push(q);if(hasP)PR.push(m.press[i])});
  const keep=P.map(q=>segD(q,prev,pt)>rr);if(keep.every(Boolean))continue;
  const runs=[];let cur=null;P.forEach((q,i)=>{if(keep[i]){if(!cur){cur={pts:[],pr:[]};runs.push(cur)}cur.pts.push(q);cur.pr.push(PR[i])}else cur=null});
  changed.push([m,runs.filter(r=>r.pts.length>=2)])}
 if(!changed.length)return;if(!g.undone){pushUndo();g.undone=true}
 for(const[m,runs]of changed){const at=S.markups.indexOf(m),pr=Array.isArray(m.press),pieces=runs.map((r,k)=>{const c=k?clone(m):m;if(k){c.id=uid()}c.pts=r.pts;if(pr)c.press=r.pr.map(v=>+(+v).toFixed(3));c.modified=Date.now();return c});
  S.markups.splice(at,1,...pieces);if(!pieces.length)S.sel.delete(m.id)}
 commit()};

// 9. Callout knee like Bluebeam: new callouts get a short horizontal landing (knee) and a handle to drag it.
function kneeOf(m){const tip=m.pts[0],b=normBox(m.pts[1],m.pts[2]),e=leaderEnd(tip,b),sx=e[0]===b[0]?-1:e[0]===b[2]?1:0,sy=sx?0:(e[1]===b[1]?-1:1),kn=+(m.style&&m.style.knee)||0;return{e,d:[sx,sy],kn,k:[e[0]+sx*kn,e[1]+sy*kn]}}
const _ac2=afterCreate;afterCreate=function(m){if(m&&m.type==='callout'&&m.style&&m.style.knee==null&&(!S.defaults.callout||S.defaults.callout.knee==null))m.style=Object.assign({},m.style,{knee:12});return _ac2.apply(this,arguments)};
const _ho3=handlesOf;handlesOf=function(m){const h=_ho3.apply(this,arguments);if(m&&m.type==='callout'&&m.pts.length>2&&one(m)&&!m.locked&&+(m.style.knee||0)>0){const q=kneeOf(m);h.push([q.k[0],q.k[1],'K'])}return h};
const _ah3=applyHandle;applyHandle=function(m,k,pt,orig){if(k==='K'&&m&&m.type==='callout'){const q=kneeOf(m);const v=(pt[0]-q.e[0])*q.d[0]+(pt[1]-q.e[1])*q.d[1];m.style=Object.assign({},m.style,{knee:Math.max(0,Math.round(v*10)/10)});return}return _ah3.apply(this,arguments)};
{const st=document.createElement('style');st.textContent='.hd[data-h$="|K"]{fill:#ffd400;stroke:#7a5c00}';document.head.appendChild(st)}

// 10. Ctrl+V pastes where the mouse is (Bluebeam); from a menu or with the mouse off the drawing it keeps the small offset.
let OVER=null;
viewer.addEventListener('pointermove',e=>{const p=S.pages.find(q=>{const r=q.el.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom});OVER=p?{page:p.num,x:e.clientX,y:e.clientY}:null});
viewer.addEventListener('pointerleave',()=>{OVER=null});
function shift(m,dx,dy){const tf=q=>[q[0]+dx,q[1]+dy];m.pts=m.pts.map(tf);if(Array.isArray(m.holes))m.holes=m.holes.map(h=>Array.isArray(h)?h.map(tf):h);
 if(Array.isArray(m.curves))m.curves=m.curves.map(c=>Array.isArray(c)&&c.length===2&&typeof c[0]==='number'?tf(c):Array.isArray(c)?c.map(x=>Array.isArray(x)&&typeof x[0]==='number'?tf(x):x):c);
 if(Array.isArray(m.rects))m.rects=m.rects.map(r=>[r[0]+dx,r[1]+dy,r[2]+dx,r[3]+dy]);if(Array.isArray(m.knot))m.knot=tf(m.knot)}
const _pa=paste;paste=function(dup){const ev=window.event,key=ev&&ev.type==='keydown',at=OVER;if(dup||!key||!at)return _pa.apply(this,arguments);
 const before=new Set(S.markups.map(m=>m.id)),r=_pa.apply(this,arguments),fresh=S.markups.filter(m=>!before.has(m.id));if(!fresh.length)return r;
 const p=S.pages[at.page-1],pt=toPt({clientX:at.x,clientY:at.y},p),bs=fresh.map(bboxOf),b=[Math.min(...bs.map(q=>q[0])),Math.min(...bs.map(q=>q[1])),Math.max(...bs.map(q=>q[2])),Math.max(...bs.map(q=>q[3]))];
 const dx=pt[0]-b[0],dy=pt[1]-b[1];for(const m of fresh){if(m.page!==at.page)m.page=at.page;shift(m,dx,dy)}setSel(fresh.map(m=>m.id),true);commit();return r};

})();
