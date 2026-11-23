/* PlanMark — Length and Dimension handles, the way they work in Bluebeam.
   • Square-ish end handles move each end; the measurement updates live; snapping still applies.
   • Hold Shift while dragging an end to keep the line level, plumb or at 45°.
   • A yellow leader handle in the middle of the line: drag it away from the measured edge to offset the
     dimension line, with extension (leader) lines drawn back to the measured points. Drag it back onto the
     edge to remove the offset. (Same value as Properties → Leader length.)
   • Measurements don't get the curve handle (Bluebeam measurements can't be bent). */
(function(){
const LEADT=new Set(['length','dimension']);
let shift=false;
addEventListener('keydown',e=>{if(e.key==='Shift')shift=true},true);
addEventListener('keyup',e=>{if(e.key==='Shift')shift=false},true);
addEventListener('blur',()=>{shift=false});
addEventListener('pointermove',e=>{shift=!!e.shiftKey},true);
const norm=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[-dy/l,dx/l]};

const _ho=handlesOf;
handlesOf=function(m){let h=_ho.apply(this,arguments);if(!m||!LEADT.has(m.type)||m.pts.length<2||!h.length)return h;
 h=h.filter(x=>!(typeof x[2]==='string'&&x[2][0]==='b'));            // no curve handle on measurements
 const[a,b]=m.pts,[nx,ny]=norm(a,b),ll=+(m.style&&m.style.leadLen)||0;
 h.push([(a[0]+b[0])/2+nx*ll,(a[1]+b[1])/2+ny*ll,'L']);return h};

const _ah=applyHandle;
applyHandle=function(m,k,pt,orig){
 if(k==='L'&&m&&LEADT.has(m.type)){const[a,b]=m.pts,[nx,ny]=norm(a,b);let ll=(pt[0]-a[0])*nx+(pt[1]-a[1])*ny;
  if(Math.abs(ll)<3/(S.zoom||1))ll=0;                                  // snap back onto the edge
  m.style=Object.assign({},m.style,{leadLen:Math.round(ll*10)/10});return}
 if(shift&&m&&k&&k[0]==='p'&&m.pts.length===2&&['length','dimension','line','arrow','calibrate'].includes(m.type)){
  const i=+k.slice(1),o=m.pts[1-i],dx=pt[0]-o[0],dy=pt[1]-o[1],r=Math.hypot(dx,dy),an=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4);
  pt=[o[0]+Math.cos(an)*r,o[1]+Math.sin(an)*r]}
 return _ah.call(this,m,k,pt,orig)};

const st=document.createElement('style');
st.textContent=`.hd[data-h$="|L"]{fill:#ffd400;stroke:#7a5c00}`;
document.head.appendChild(st);
window.PMDimHandles={LEADT};
})();
