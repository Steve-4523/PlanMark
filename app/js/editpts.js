/* PlanMark — editing the corners of areas, polygons, polylines and clouds, like Bluebeam.
   • Dragging the handle in the middle of a side adds a corner there: the side becomes two straight lines.
     (Hold Alt while dragging it to bend the side into a curve instead.)
   • C with the mouse on a side of a markup adds a control point there.
   • D with the mouse on a control point deletes it.
   • Esc always leaves the tool in hand and goes back to Pan, and clears the magenta snap mark. */
(function(){
const EDIT=new Set(['polyline','polygon','area','perimeter','polylength','volume','space','cloud','cloudplus','wallarea']);
const CLOSED=new Set(['polygon','area','perimeter','volume','space','cloud','cloudplus']);
const MIN=m=>CLOSED.has(m.type)?3:2;
const closed=m=>CLOSED.has(m.type)||(m.closed===true);
let alt=false,mx=null,my=null;
addEventListener('keydown',e=>{if(e.key==='Alt')alt=true},true);addEventListener('keyup',e=>{if(e.key==='Alt')alt=false},true);addEventListener('blur',()=>{alt=false});
addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;alt=e.altKey},true);

// 1 — the middle handle of a side adds a corner (Alt keeps the old bend-into-a-curve behaviour)
let drag=null;
// installed after everything else has wrapped applyHandle (the curve handles are added once the page is ready)
// (other modules keep wrapping applyHandle as they load; ours must be the outermost, so it is re-installed
// right before any drag starts if something wrapped it again)
let mine=null;
function install(){if(applyHandle===mine)return;const _ah=applyHandle;
mine=applyHandle=function(m,k,pt,orig){
 if(k&&k[0]==='b'&&EDIT.has(m.type)&&!alt&&Array.isArray(orig)){const i=+k.slice(1);
  if(!drag||drag.orig!==orig){drag={orig,curves:m.curves?Object.assign({},m.curves):null}}
  m.pts=orig.map(p=>p.slice());m.pts.splice(i+1,0,[pt[0],pt[1]]);
  if(drag.curves)m.curves=shiftCurves(drag.curves,i,+1);
  return}
 return _ah.apply(this,arguments)}}
H.ready.push(()=>setTimeout(install,0));addEventListener('pointerdown',install,true);
// curves are kept per side ({side index: bend}); after adding / removing a corner the sides behind it move up / down
function shiftCurves(c,i,d){const o={};for(const k in c){const j=+k;if(d>0){if(j<i)o[j]=c[k];else if(j>i)o[j+1]=c[k]}else{if(j<i-1)o[j]=c[k];else if(j>i)o[j-1]=c[k]}}return Object.keys(o).length?o:undefined}

// helpers: which markup and side / corner is under the mouse
function pageAt(x,y){const el=document.elementFromPoint(x,y);const pe=el&&el.closest&&el.closest('#viewer .page');if(!pe)return null;return S.pages[+pe.dataset.p-1]||null}
function near(a,b,p){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));const q=[a[0]+t*dx,a[1]+t*dy];return{q,d:Math.hypot(p[0]-q[0],p[1]-q[1]),t}}
function candidates(p){const sel=[...S.sel].map(byId).filter(m=>m&&m.page===p.num&&EDIT.has(m.type)&&!m.locked);
 const rest=S.markups.filter(m=>m.page===p.num&&EDIT.has(m.type)&&!m.locked&&!S.sel.has(m.id)).reverse();return[...sel,...rest]}
function sideAt(p,pt,tol){for(const m of candidates(p)){const n=m.pts.length,segs=closed(m)?n:n-1;let best=null;
  for(let i=0;i<segs;i++){const r=near(m.pts[i],m.pts[(i+1)%n],pt);if(r.d<=tol&&r.t>0.02&&r.t<0.98&&(!best||r.d<best.d))best={m,i,q:r.q,d:r.d}}
  if(best)return best}return null}
function cornerAt(p,pt,tol){for(const m of candidates(p)){let best=null;m.pts.forEach((v,i)=>{const d=Math.hypot(v[0]-pt[0],v[1]-pt[1]);if(d<=tol&&(!best||d<best.d))best={m,i,d}});if(best)return best}return null}
const typing=()=>{const a=document.activeElement;return a&&(a.matches('input,textarea,select,[contenteditable],[contenteditable] *'))};
// 2 / 3 — C adds, D deletes (only when the mouse is on a side or a corner; otherwise C is still the Cloud tool)
addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||typing()||mx==null||S.drawing)return;const k=e.key.toLowerCase();if(k!=='c'&&k!=='d')return;
 const p=pageAt(mx,my);if(!p)return;const pt=toPt({clientX:mx,clientY:my},p),tol=9/S.zoom;
 if(k==='c'){const s=sideAt(p,pt,tol);if(!s)return;e.preventDefault();e.stopImmediatePropagation();
  pushUndo();const m=s.m;m.pts.splice(s.i+1,0,[s.q[0],s.q[1]]);if(m.curves){m.curves=shiftCurves(m.curves,s.i,+1);if(!m.curves)delete m.curves}
  m.modified=Date.now();if(!S.sel.has(m.id)){try{if(S.tool!=='select')setTool('select')}catch(_){}setSel([m.id])}commit();toast('Control point added');return}
 if(k==='d'){const c=cornerAt(p,pt,tol);if(!c)return;e.preventDefault();e.stopImmediatePropagation();const m=c.m;
  if(m.pts.length<=MIN(m)){toast(`A ${T[m.type]?T[m.type].label.toLowerCase():'shape'} needs at least ${MIN(m)} points`);return}
  pushUndo();m.pts.splice(c.i,1);if(m.curves){m.curves=shiftCurves(m.curves,c.i,-1);if(!m.curves)delete m.curves}
  m.modified=Date.now();commit();toast('Control point deleted')}},true);

// 4 — Esc: leave any tool for Pan in one press (and drop the selection), and clear the snap mark
addEventListener('keydown',e=>{if(e.key!=='Escape'||typing()||document.querySelector('#modalBg.on'))return;
 const n=SNAPI&&SNAPI.page;SNAPI=null;if(n)redrawPage(n);
 if(!S.drawing&&!S.countId&&S.tool!=='pan'&&S.tool!=='select'){e.preventDefault();e.stopImmediatePropagation();if(S.sel.size)setSel([]);setTool('pan')}},true);
// the snap mark also goes when the mouse leaves the drawing or a drag ends
addEventListener('pointerup',()=>{setTimeout(()=>{if(SNAPI&&!S.drawing&&(S.tool==='select'||S.tool==='pan')){const n=SNAPI.page;SNAPI=null;redrawPage(n)}},0)},true);
viewer.addEventListener('pointerleave',()=>{if(SNAPI&&!S.drawing){const n=SNAPI.page;SNAPI=null;redrawPage(n)}});
window.PMEditPts={sideAt,cornerAt};
})();
