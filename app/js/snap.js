/* PlanMark — snap to content (PDF vector geometry) and to markup points */
(function(){
const SNP=Object.assign({content:true,markup:true,grid:false,show:false,spacing:0.25,sub:1},LS.get('pm:snapopts',{}));const SN={cache:{},cell:16};window.PMSnap=SNP;
function mul(m1,m2){return[m1[0]*m2[0]+m1[2]*m2[1],m1[1]*m2[0]+m1[3]*m2[1],m1[0]*m2[2]+m1[2]*m2[3],m1[1]*m2[2]+m1[3]*m2[3],m1[0]*m2[4]+m1[2]*m2[5]+m1[4],m1[1]*m2[4]+m1[3]*m2[5]+m1[5]]}
async function build(n){
 const doc=S.pdf,page=await doc.getPage(n),ol=await page.getOperatorList(),O=pdfjsLib.OPS,vp=S.pages[n-1].vp;
 let ctm=vp.transform.slice();const st=[],segs=[];const MAX=400000;
 const ap=(x,y)=>[ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]];
 const add=(a,b)=>{if(segs.length>=MAX*4)return;const dx=a[0]-b[0],dy=a[1]-b[1];if(dx*dx+dy*dy<0.09)return;segs.push(a[0],a[1],b[0],b[1])};
 for(let i=0;i<ol.fnArray.length;i++){const fn=ol.fnArray[i],args=ol.argsArray[i];
  if(fn===O.save)st.push(ctm.slice());else if(fn===O.restore){ctm=st.pop()||ctm}
  else if(fn===O.transform)ctm=mul(ctm,args);
  else if(fn===O.paintFormXObjectBegin){st.push(ctm.slice());if(args&&args[0])ctm=mul(ctm,args[0])}
  else if(fn===O.paintFormXObjectEnd){ctm=st.pop()||ctm}
  else if(fn===O.constructPath){const ops=args[0],c=args[1];let j=0,cur=null,start=null;
   for(const op of ops){
    if(op===O.moveTo){cur=ap(c[j],c[j+1]);start=cur;j+=2}
    else if(op===O.lineTo){const q=ap(c[j],c[j+1]);j+=2;if(cur)add(cur,q);cur=q}
    else if(op===O.curveTo){const q=ap(c[j+4],c[j+5]);j+=6;if(cur)add(cur,q);cur=q}
    else if(op===O.curveTo2||op===O.curveTo3){const q=ap(c[j+2],c[j+3]);j+=4;if(cur)add(cur,q);cur=q}
    else if(op===O.closePath){if(cur&&start)add(cur,start);cur=start}
    else if(op===O.rectangle){const x=c[j],y=c[j+1],w=c[j+2],h=c[j+3];j+=4;const a=ap(x,y),b=ap(x+w,y),cc=ap(x+w,y+h),d=ap(x,y+h);add(a,b);add(b,cc);add(cc,d);add(d,a);cur=a;start=a}
   }}
 }
 const grid=new Map(),cell=SN.cell,key=(i,j)=>i*100003+j;
 const f=new Float32Array(segs);
 for(let s=0;s<f.length;s+=4){const x0=Math.min(f[s],f[s+2]),x1=Math.max(f[s],f[s+2]),y0=Math.min(f[s+1],f[s+3]),y1=Math.max(f[s+1],f[s+3]);
  const i0=Math.floor(x0/cell),i1=Math.floor(x1/cell),j0=Math.floor(y0/cell),j1=Math.floor(y1/cell);if((i1-i0+1)*(j1-j0+1)>400)continue;
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(s)}}
 return{f,grid,key}}
function data(n){const c=SN.cache[n];if(c&&c!=='loading')return c;if(!c&&S.pdf){SN.cache[n]='loading';const doc=S.pdf;build(n).then(d=>{if(doc===S.pdf)SN.cache[n]=d}).catch(()=>{SN.cache[n]={f:new Float32Array(0),grid:new Map(),key:()=>0}})}return null}
function projSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return[a[0]+t*dx,a[1]+t*dy]}
function inter(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-9)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;if(t<-1e-6||t>1+1e-6||u<-1e-6||u>1+1e-6)return null;return[a[0]+t*r[0],a[1]+t*r[1]]}
H.snap=function(p,pt){
 SNAPI=null;if(!SNP.content&&!SNP.markup&&!SNP.grid)return pt;const tol=9/S.zoom;let best=null,bd=tol,kind='';
 const tryP=(q,k,w=1)=>{const d=dist(q,pt)*w;if(d<bd){bd=d;best=q;kind=k}};
 // markup vertices (other than the one being drawn)
 if(SNP.markup)for(const m of S.markups){if(m.page!==p.num||(G&&G.m===m))continue;for(const q of m.pts)tryP(q,'end')}
 if(S.drawing&&S.drawing.page===p.num&&T[S.drawing.type].closed&&S.drawing.pts.length>2)tryP(S.drawing.pts[0],'end');
 const d=SNP.content?data(p.num):null;
 if(d){const{f,grid,key}=d,cell=SN.cell,ci=Math.floor(pt[0]/cell),cj=Math.floor(pt[1]/cell),r=Math.ceil(tol/cell),seen=new Set(),cand=[];
  for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){const a=grid.get(key(i,j));if(!a)continue;for(const s of a){if(seen.has(s))continue;seen.add(s);
   const A=[f[s],f[s+1]],B=[f[s+2],f[s+3]];tryP(A,'end');tryP(B,'end');tryP([(A[0]+B[0])/2,(A[1]+B[1])/2],'mid',1.15);
   const pr=projSeg(pt,A,B);if(dist(pr,pt)<tol)cand.push([A,B,pr])}}
  if(!best||kind!=='end'){ // intersections
   const lim=Math.min(cand.length,60);for(let x=0;x<lim;x++)for(let y=x+1;y<lim;y++){const q=inter(cand[x][0],cand[x][1],cand[y][0],cand[y][1]);if(q)tryP(q,'int',1.05)}}
  if(!best){let bl=tol;for(const c of cand){const dd=dist(c[2],pt);if(dd<bl){bl=dd;best=c[2];kind='on'}}}
 }
 if(!best&&SNP.grid){const g=gridStep(p);if(g){best=[Math.round(pt[0]/g)*g,Math.round(pt[1]/g)*g];kind='grid'}}
 if(!best)return pt;SNAPI={page:p.num,x:best[0],y:best[1],k:kind};return[best[0],best[1]]};
function gridStep(p){const v=+SNP.spacing||0.25;if(SNP.unit==='real'){const sc=scaleFor(p.num);return v*(sc.unit==='ftin'?0.3048:UNITS[sc.unit].m)/sc.perPt}return v*72}
window.gridStep=gridStep;
H.over.push(n=>{if(!SNAPI||SNAPI.page!==n)return'';const{x,y,k}=SNAPI,r=5/S.zoom,w=1.6/S.zoom,c='#ff00ff';
 let g='';if(k==='end')g=`<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
 else if(k==='mid')g=`<path d="M${x} ${y-r*1.2} L${x+r*1.1} ${y+r*.8} L${x-r*1.1} ${y+r*.8}Z" fill="none" stroke="${c}" stroke-width="${w}"/>`;
 else if(k==='grid')g=`<path d="M${x-r} ${y}L${x+r} ${y}M${x} ${y-r}L${x} ${y+r}" stroke="${c}" stroke-width="${w}"/>`;
 else if(k==='int')g=`<path d="M${x-r} ${y-r}L${x+r} ${y+r}M${x+r} ${y-r}L${x-r} ${y+r}" stroke="${c}" stroke-width="${w}"/>`;
 else g=`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/><circle cx="${x}" cy="${y}" r="${r*.25}" fill="${c}"/>`;
 return`<g pointer-events="none">${g}</g>`});
H.open.push(()=>{SN.cache={};SNAPI=null});
H.under.push((n,p)=>{if(!SNP.show)return'';const g=gridStep(p);if(!g||g*S.zoom<4)return'';const id='pmgrid'+n;const maj=g*(+SNP.major||4);
 return`<defs><pattern id="${id}" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="M${g} 0H0V${g}" fill="none" stroke="#3d8bfd" stroke-opacity=".22" stroke-width="${.6/S.zoom}"/></pattern><pattern id="${id}M" width="${maj}" height="${maj}" patternUnits="userSpaceOnUse"><path d="M${maj} 0H0V${maj}" fill="none" stroke="#3d8bfd" stroke-opacity=".4" stroke-width="${.9/S.zoom}"/></pattern></defs><rect width="${p.w}" height="${p.h}" fill="url(#${id})" pointer-events="none"/><rect width="${p.w}" height="${p.h}" fill="url(#${id}M)" pointer-events="none"/>`});
// clear indicator when finishing / leaving
viewer.addEventListener('pointerleave',()=>{if(SNAPI){const pg=SNAPI.page;SNAPI=null;redrawPage(pg)}});
H.ready.push(()=>{const b=document.createElement('button');b.id='snapBtn';b.title='Snap and grid options';b.style.cssText='background:none;border:1px solid var(--line);border-radius:4px;padding:1px 7px;cursor:pointer;color:var(--text)';
 const save=()=>{LS.set('pm:snapopts',SNP);upd();redrawAll()};
 const upd=()=>{const on=[SNP.content&&'Content',SNP.markup&&'Markup',SNP.grid&&'Grid'].filter(Boolean);b.textContent='Snap: '+(on.length?on.join('+'):'Off')+(SNP.show?' · Grid shown':'');b.style.borderColor=on.length?'var(--acc)':'var(--line)'};upd();
 b.onclick=()=>{modal('Snap & grid',`<label class="chk fld"><input type="checkbox" id="snC" ${SNP.content?'checked':''}> Snap to content (drawing lines, ends, midpoints, intersections) <kbd>Ctrl+Shift+F9</kbd></label>
  <label class="chk fld"><input type="checkbox" id="snM" ${SNP.markup?'checked':''}> Snap to markups (corners of other markups)</label>
  <label class="chk fld"><input type="checkbox" id="snG" ${SNP.grid?'checked':''}> Snap to grid <kbd>F8</kbd></label>
  <label class="chk fld"><input type="checkbox" id="snS" ${SNP.show?'checked':''}> Show grid <kbd>Shift+F8</kbd></label>
  <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Grid spacing</label><input class="ti" type="number" step="any" min="0.01" id="snSp" value="${SNP.spacing}"></div>
  <div><label style="font-size:11px;color:var(--mut)">Units</label><select class="ti" id="snU"><option value="paper" ${SNP.unit!=='real'?'selected':''}>Paper inches</option><option value="real" ${SNP.unit==='real'?'selected':''}>Real units (page scale: ft / m)</option></select></div>
  <div><label style="font-size:11px;color:var(--mut)">Major every</label><input class="ti" type="number" min="1" step="1" id="snMj" value="${SNP.major||4}"></div></div>`,
  [{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{SNP.content=md.querySelector('#snC').checked;SNP.markup=md.querySelector('#snM').checked;SNP.grid=md.querySelector('#snG').checked;SNP.show=md.querySelector('#snS').checked;SNP.spacing=Math.max(.01,+md.querySelector('#snSp').value||.25);SNP.unit=md.querySelector('#snU').value;SNP.major=Math.max(1,+md.querySelector('#snMj').value||4);save()}}])};
 $('#status').insertBefore(b,$('#scaleBtn'));
 document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(e.key==='F9'&&e.ctrlKey&&e.shiftKey){e.preventDefault();SNP.content=!SNP.content;save();toast('Snap to content '+(SNP.content?'on':'off'))}
  if(e.key==='F8'&&!e.shiftKey){e.preventDefault();SNP.grid=!SNP.grid;save();toast('Snap to grid '+(SNP.grid?'on':'off'))}if(e.key==='F8'&&e.shiftKey){e.preventDefault();SNP.show=!SNP.show;save()}});
 H.prefs=H.prefs||[];H.prefs.push(()=>{Object.assign(SNP,LS.get('pm:snapopts',{}));upd();redrawAll()})});
})();
