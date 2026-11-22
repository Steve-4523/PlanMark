/* PlanMark — "Max" tools: AutoCount (visual search), Dynamic Fill, Magic Markups (duplicate-as, offset, cutouts,
   align/distribute, copy to pages), Legends, Redaction, AI drawing review (web) */
(function(){
/* ---------- shared: pick a rectangle with two clicks ---------- */
let pick=null;
function pickRegion(msg){return new Promise(res=>{if(S.tool!=='select')setTool('select');pick={msg,pts:[],res};$('#hint').textContent=msg+' — click the first corner';toast(msg)})}
H.down=(prev=>(e,p,pt)=>{
 if(pick&&p){pick.pts.push({p:p.num,x:pt[0],y:pt[1]});if(pick.pts.length<2){$('#hint').textContent=pick.msg+' — click the opposite corner';SNAPI={page:p.num,x:pt[0],y:pt[1],k:'end'};redrawPage(p.num);return true}
  const[a,b]=pick.pts,r=pick.res;pick=null;SNAPI=null;updateRibbon();redrawPage(a.p);r({page:a.p,box:normBox([a.x,a.y],[b.x,b.y])});return true}
 if(S.tool==='dfill'&&p){dynamicFill(p,pt);return true}
 if(S.tool==='legend'&&p){const m=newMarkup('legend',p.num,[pt],toolStyle('legend'));pushUndo();S.markups.push(m);afterCreate(m);return true}
 return prev?prev(e,p,pt):false})(H.down);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pick){pick=null;updateRibbon();toast('Cancelled')}},true);
/* ---------- raster helpers ---------- */
async function grayPage(n,k){const pg=await S.pdf.getPage(n),vp=pg.getViewport({scale:k}),W=Math.ceil(vp.width),Hh=Math.ceil(vp.height),c=document.createElement('canvas');c.width=W;c.height=Hh;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,W,Hh);await pg.render({canvasContext:ctx,viewport:vp}).promise;return{c,ctx,W,H:Hh}}
function toGray(ctx,W,Hh){const d=ctx.getImageData(0,0,W,Hh).data,g=new Float32Array(W*Hh);for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(d[j]*.3+d[j+1]*.59+d[j+2]*.11)/255;return g}
// light 3x3 box blur, applied twice (~gaussian): makes matching tolerant of sub-pixel placement
function blur(g,W,Hh,passes=2){let a=g,b=new Float32Array(g.length);for(let p=0;p<passes;p++){for(let y=0;y<Hh;y++){const r=y*W;for(let x=0;x<W;x++){const l=x>0?a[r+x-1]:a[r+x],c=a[r+x],rr=x<W-1?a[r+x+1]:c;b[r+x]=(l+c+rr)/3}}
 for(let y=0;y<Hh;y++){const u=y>0?(y-1)*W:y*W,c=y*W,d=y<Hh-1?(y+1)*W:y*W;for(let x=0;x<W;x++)a[c+x]=(b[u+x]+b[c+x]+b[d+x])/3}}return a}
const grayB=(R)=>blur(toGray(R.ctx,R.W,R.H),R.W,R.H);
const tick=()=>new Promise(r=>setTimeout(r,0));
/* ---------- AutoCount / visual search ---------- */
async function autoCount(){if(!S.pages.length)return toast('Open a PDF first');const r=await pickRegion('AutoCount: draw a box tightly around ONE symbol');
 const sb=r.box,bw=sb[2]-sb[0],bh=sb[3]-sb[1];if(bw<3||bh<3)return toast('That box is too small');
 modal('AutoCount',`<div class="hint" style="margin-bottom:8px">Finds every place that looks like the symbol you boxed and counts it.</div>
 <div class="fld"><label>Subject / name</label><input class="ti" id="acS" value="Count"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Search</label><select class="ti" id="acP"><option value="cur">This page</option><option value="all">All pages</option></select></div>
 <div><label style="font-size:11px;color:var(--mut)">Match</label><select class="ti" id="acT"><option value=".9">Exact (90%)</option><option value=".82" selected>Close (82%)</option><option value=".74">Loose (74%)</option></select></div></div>
 <label class="chk fld"><input type="checkbox" id="acR" checked> Also find it rotated 90° / 180° / 270°</label>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Color</label><input type="color" id="acC" value="#f08c00"></div></div>`,
 [{label:'Cancel',cancel:1},{label:'Find & count',pri:1,fn:md=>{const o={subject:md.querySelector('#acS').value.trim()||'Count',all:md.querySelector('#acP').value==='all',thr:+md.querySelector('#acT').value,rot:md.querySelector('#acR').checked,color:md.querySelector('#acC').value};setTimeout(()=>runAutoCount(r.page,sb,o),0)}}])}
function tmplFrom(g,W,x0,y0,tw_,th){const t=new Float32Array(tw_*th);for(let y=0;y<th;y++)for(let x=0;x<tw_;x++)t[y*tw_+x]=g[(y0+y)*W+x0+x];return t}
function rot90(t,w,h){const o=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)o[x*h+(h-1-y)]=t[y*w+x];return o}
function prepT(t){let m=0;for(const v of t)m+=v;m/=t.length;let ss=0;const z=new Float32Array(t.length);for(let i=0;i<t.length;i++){z[i]=t[i]-m;ss+=z[i]*z[i]}return{z,norm:Math.sqrt(ss)}}
function integral(g,W,Hh){const I=new Float64Array((W+1)*(Hh+1)),I2=new Float64Array((W+1)*(Hh+1));for(let y=1;y<=Hh;y++){let s=0,s2=0;for(let x=1;x<=W;x++){const v=g[(y-1)*W+x-1];s+=v;s2+=v*v;I[y*(W+1)+x]=I[(y-1)*(W+1)+x]+s;I2[y*(W+1)+x]=I2[(y-1)*(W+1)+x]+s2}}return{I,I2}}
function nccAt(g,W,it,x,y,T,tw_,th){const W1=W+1,n=tw_*th,{I,I2}=it,s=I[(y+th)*W1+x+tw_]-I[y*W1+x+tw_]-I[(y+th)*W1+x]+I[y*W1+x],s2=I2[(y+th)*W1+x+tw_]-I2[y*W1+x+tw_]-I2[(y+th)*W1+x]+I2[y*W1+x];
 const v=s2-s*s/n;if(v<1e-3*n)return -1;let c=0,k=0;for(let j=0;j<th;j++){const row=(y+j)*W+x;for(let i=0;i<tw_;i++)c+=T.z[k++]*g[row+i]}return c/(T.norm*Math.sqrt(v))}
async function runAutoCount(srcPage,sb,o){const bw=sb[2]-sb[0],bh=sb[3]-sb[1];
 const kc=clamp(16/Math.max(bw,bh),.15,3),kf=clamp(40/Math.max(bw,bh),.3,5);
 modal('AutoCount',`<div class="hint" id="acMsg">Preparing…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="acBar" style="height:100%;width:0;background:var(--acc)"></div></div>`,[{label:'Cancel',cancel:1,fn:()=>{acCancel=true}}]);
 let acCancel=false;const msg=t=>{const e=$('#acMsg');if(e)e.textContent=t},bar=f=>{const e=$('#acBar');if(e)e.style.width=Math.round(f*100)+'%'};
 try{// templates at coarse and fine scale from the source page
  const mk=async k=>{const R=await grayPage(srcPage,k),g=grayB(R),x0=Math.round(sb[0]*k),y0=Math.round(sb[1]*k),w=Math.max(4,Math.round(bw*k)),h=Math.max(4,Math.round(bh*k));let t=tmplFrom(g,R.W,x0,y0,w,h);const out=[{t:prepT(t),w,h}];
   if(o.rot){let tt=t,ww=w,hh=h;for(let i=0;i<3;i++){tt=rot90(tt,ww,hh);[ww,hh]=[hh,ww];out.push({t:prepT(tt),w:ww,h:hh})}}return out};
  const TC=await mk(kc),TF=await mk(kf);if(TC[0].t.norm<0.5)throw new Error('The box looks empty — draw it around the symbol\'s lines');
  const pages=o.all?S.pages.map(p=>p.num):[srcPage];const created=[];
  for(let pi=0;pi<pages.length;pi++){if(acCancel)break;const n=pages[pi];msg(`Searching page ${n}${pages.length>1?` (${pi+1} of ${pages.length})`:''}…`);
   const C=await grayPage(n,kc),gc=grayB(C),itc=integral(gc,C.W,C.H);const cand=[];
   for(const tc of TC){for(let y=0;y+tc.h<=C.H;y++){if(y%40===0){bar((pi+y/C.H)/pages.length);await tick();if(acCancel)break}for(let x=0;x+tc.w<=C.W;x++){const v=nccAt(gc,C.W,itc,x,y,tc.t,tc.w,tc.h);if(v>o.thr-.17)cand.push([v,x,y,tc])}}}
   cand.sort((a,b)=>b[0]-a[0]);const top=[];for(const c of cand){const cx=(c[1]+c[3].w/2)/kc,cy=(c[2]+c[3].h/2)/kc;if(top.some(q=>Math.hypot(q[0]-cx,q[1]-cy)<Math.min(bw,bh)*.6))continue;top.push([cx,cy]);if(top.length>800)break}
   if(!top.length)continue;const F=await grayPage(n,kf),gf=grayB(F),itf=integral(gf,F.W,F.H),hits=[];
   for(const[cx,cy]of top){let best=-1,bp=null;for(const tf of TF){const bx=Math.round(cx*kf-tf.w/2),by=Math.round(cy*kf-tf.h/2),rr=Math.ceil(kf/kc)+2;
     for(let dy=-rr;dy<=rr;dy++)for(let dx=-rr;dx<=rr;dx++){const x=bx+dx,y=by+dy;if(x<0||y<0||x+tf.w>F.W||y+tf.h>F.H)continue;const v=nccAt(gf,F.W,itf,x,y,tf.t,tf.w,tf.h);if(v>best){best=v;bp=[(x+tf.w/2)/kf,(y+tf.h/2)/kf]}}}
    if(best>=o.thr&&!hits.some(q=>Math.hypot(q[0]-bp[0],q[1]-bp[1])<Math.min(bw,bh)*.6))hits.push(bp)}
   if(hits.length){const st=Object.assign({},S.defaults.count,{stroke:o.color,fill:o.color});const m=newMarkup('count',n,hits,st);m.subject=o.subject;m.comment='AutoCount';created.push(m)}}
  closeModal();if(created.length){pushUndo();S.markups.push(...created);commit();const tot=created.reduce((s,m)=>s+m.pts.length,0);toast(`AutoCount found ${tot} on ${created.length} page${created.length>1?'s':''} — review and delete any extras`);setSel(created.map(m=>m.id))}
  else toast('No matches found — try "Loose" matching')}
 catch(e){console.error(e);closeModal();toast('AutoCount failed: '+(e.message||e))}}
/* ---------- Dynamic Fill: click inside a bounded region ---------- */
let dfillOut='area';
async function dynamicFill(p,pt){toast('Filling…');try{
 const k=Math.min(2,Math.sqrt(7e6/(p.w*p.h)));const R=await grayPage(p.num,k),ctx=R.ctx,W=R.W,Hh=R.H;
 ctx.save();ctx.scale(k,k);ctx.strokeStyle='#000';ctx.lineWidth=Math.max(1.5/k,1);ctx.lineCap='round';
 for(const m of S.markups){if(m.page!==p.num||['count','note','stamp','typewriter','symbol','legend','texthl','image'].includes(m.type))continue;for(const q of prims(m))if(q.k==='p'&&q.stroke)try{ctx.stroke(new Path2D(q.d))}catch(e){}}ctx.restore();
 const d=ctx.getImageData(0,0,W,Hh).data,N=W*Hh,ink=new Uint8Array(N);for(let i=0,j=0;i<N;i++,j+=4)ink[i]=(d[j]*.3+d[j+1]*.59+d[j+2]*.11)<175?1:0;
 const gap=Math.max(1,Math.round(k*1.5));const wall=new Uint8Array(N);for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){if(!ink[y*W+x])continue;for(let dy=-gap;dy<=gap;dy++){const yy=y+dy;if(yy<0||yy>=Hh)continue;for(let dx=-gap;dx<=gap;dx++){const xx=x+dx;if(xx>=0&&xx<W)wall[yy*W+xx]=1}}}
 const sx=Math.round(pt[0]*k),sy=Math.round(pt[1]*k);if(wall[sy*W+sx]){toast('Click inside the room, not on a line');return}
 const fill=new Uint8Array(N),st=[sy*W+sx];fill[sy*W+sx]=1;let cnt=0,edge=false;
 while(st.length){const i=st.pop();cnt++;const x=i%W,y=(i/W)|0;if(x===0||y===0||x===W-1||y===Hh-1){edge=true;break}for(const j of[i-1,i+1,i-W,i+W])if(!wall[j]&&!fill[j]){fill[j]=1;st.push(j)}}
 if(edge||cnt>N*.8){toast("That area isn't closed — draw a line across any opening (doorways), then click again");return}
 // trace the outer boundary (Moore neighbour tracing, clockwise on screen)
 let start=-1;for(let i=0;i<N;i++)if(fill[i]){start=i;break}
 const F=(x,y)=>x>=0&&y>=0&&x<W&&y<Hh&&fill[y*W+x]===1;const nb=[[-1,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1]];
 const sx0=start%W,sy0=(start/W)|0;let cx=sx0,cy=sy0,bx=cx-1,by=cy;const path=[[cx,cy]];
 for(let guard=0;guard<4e6;guard++){let k=nb.findIndex(d=>cx+d[0]===bx&&cy+d[1]===by);if(k<0)k=0;let found=false;
  for(let i=1;i<=8;i++){const d=nb[(k+i)%8],nx=cx+d[0],ny=cy+d[1];if(F(nx,ny)){const pd=nb[(k+i-1)%8];bx=cx+pd[0];by=cy+pd[1];cx=nx;cy=ny;found=true;break}}
  if(!found||(cx===sx0&&cy===sy0))break;path.push([cx,cy])}
 const grow=gap*.9;const c0=path.reduce((a,q)=>[a[0]+q[0],a[1]+q[1]],[0,0]).map(v=>v/path.length);
 let poly=simplify(path,1.3).map(q=>{const dx=q[0]-c0[0],dy=q[1]-c0[1],L=Math.hypot(dx,dy)||1;return[(q[0]+dx/L*grow)/k,(q[1]+dy/L*grow)/k]});if(poly.length>3&&dist(poly[0],poly[poly.length-1])<1)poly.pop();
 if(poly.length<3){toast('Could not trace that area');return}
 const out=dfillOut,m=newMarkup(out,p.num,poly,toolStyle(out));if(out==='volume')m.depth=S.defaults.volume.depth||0.3048;
 pushUndo();S.markups.push(m);commit();if(out==='space')textDialog(m,true,'text');else toast(measLabel(m)||'Area added')}
 catch(e){console.error(e);toast('Fill failed: '+(e.message||e))}}
function dfillStart(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Dynamic Fill',`<div class="hint" style="margin-bottom:8px">Click inside any closed room or shape to create a markup that follows its walls. Draw a line across door openings first if a room isn't closed.</div>
 <div class="fld"><label>Create</label><select class="ti" id="dfO">${[['area','Area measurement'],['perimeter','Perimeter measurement'],['volume','Volume measurement'],['space','Space (named room)'],['polygon','Polygon markup']].map(([v,l])=>`<option value="${v}" ${v===dfillOut?'selected':''}>${l}</option>`).join('')}</select></div>`,
 [{label:'Cancel',cancel:1},{label:'Start',pri:1,fn:md=>{dfillOut=md.querySelector('#dfO').value;setTool('dfill',{lock:true});toast('Click inside rooms to fill · Esc to stop')}}])}
/* ---------- Legend (live summary of a page's markups) ---------- */
function legendRows(m){const rows=summaryRows(S.markups.filter(x=>x.page===m.page&&x.type!=='legend'&&x.type!=='space').map(x=>({m:x,r:measOf(x)})));return rows}
function legendGeom(m){const fs=m.style.fontSize||9,rows=legendRows(m),pad=fs*.6,lh=fs*1.7,c1=fs*2,w1=Math.max(tw('Legend',fs*1.2,true),...rows.map(r=>tw(r.subject,fs))),w2=Math.max(tw('Qty',fs,true),...rows.map(r=>tw(r.text||String(r.count),fs)));
 const W=pad*2+c1+w1+pad*2+w2,Hh=pad*2+fs*1.6+Math.max(1,rows.length)*lh;const[x,y]=m.pts[0];return{b:[x,y,x+W,y+Hh],rows,fs,pad,lh,c1,w1,w2}}
H.legendBox=m=>legendGeom(m).b;
H.legendPrims=(m,out,L,TX)=>{const g=legendGeom(m),b=g.b,s=m.style;L(dBox(b),{fill:s.fill||'#fff',fo:s.fillOpacity??1,dash:''});TX(b[0]+g.pad,b[1]+g.pad+g.fs*.7,'Legend',{align:'start',halo:false,size:g.fs*1.2});
 g.rows.forEach((r,i)=>{const y=b[1]+g.pad+g.fs*1.6+g.lh*(i+.5);out.push({k:'p',d:dBox([b[0]+g.pad,y-g.fs*.45,b[0]+g.pad+g.fs*1.3,y+g.fs*.45]),stroke:r.color,w:1,so:1,fill:r.color,fo:.5});
  TX(b[0]+g.pad+g.c1,y,r.subject,{align:'start',halo:false,bold:false,color:'#111827'});TX(b[2]-g.pad-g.w2,y,r.text||String(r.count),{align:'start',halo:false,bold:false,color:'#111827'})});
 if(!g.rows.length)TX(b[0]+g.pad,b[1]+g.pad+g.fs*2.4,'(no markups on this page)',{align:'start',halo:false,bold:false,color:'#6b7280'})};
/* ---------- Magic Markups ---------- */
const sel=()=>[...S.sel].map(byId).filter(Boolean);
function offsetPoly(pts,d,closed){const n=pts.length,out=[];const A=closed?polyArea(pts):1,sgn=A>=0?-1:1;
 for(let i=0;i<n;i++){const p=pts[i],a=pts[(i-1+n)%n],b=pts[(i+1)%n];let n1=null,n2=null;/* outward = left of travel for clockwise (y-down) */
  if(closed||i>0){const dx=p[0]-a[0],dy=p[1]-a[1],L=Math.hypot(dx,dy)||1;n1=[-dy/L*sgn,dx/L*sgn]}if(closed||i<n-1){const dx=b[0]-p[0],dy=b[1]-p[1],L=Math.hypot(dx,dy)||1;n2=[-dy/L*sgn,dx/L*sgn]}
  let nx=(n1||n2)[0]+(n2||n1)[0],ny=(n1||n2)[1]+(n2||n1)[1];const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;const cos=n1&&n2?(n1[0]*nx+n1[1]*ny):1;const k=d/Math.max(.25,cos);out.push([p[0]+nx*k,p[1]+ny*k])}return out}
function magicDialog(){const ms=sel();if(!ms.length)return toast('Select one or more markups first');const m=ms[0],to=(CONVERT[m.type]||[]);
 const bt=(id,l,dis)=>`<button class="btn" id="${id}" style="border:1px solid var(--line)" ${dis?'disabled':''}>${l}</button>`;
 const closed=T[m.type].closed||['rect','ellipse'].includes(m.type),lineLike=['line','polyline','length','polylength','dimension','arrow','area','perimeter','polygon','cloud','volume','space'].includes(m.type)||T[m.type].box;
 const areas=ms.filter(x=>['area','volume'].includes(x.type));
 modal('Magic Markups',`<div class="sec" style="margin-top:0">Duplicate as…</div><div class="row" style="gap:6px;flex-wrap:wrap">${to.length?to.map(t=>`<button class="btn" data-dup="${t}" style="border:1px solid var(--line)">+ ${T[t].label}</button>`).join(''):'<span class="hint">Nothing to duplicate this as.</span>'}</div>
 <div class="sec">Offset by distance</div><div class="row" style="gap:6px"><input class="ti" type="number" step="any" id="mgD" value="1" ${lineLike?'':'disabled'}><select class="ti" id="mgU"><option value="ft">ft</option><option value="in">in</option><option value="m">m</option><option value="pt">paper pt</option></select>${bt('mgO','Offset copy',!lineLike)}</div><div class="hint">Positive = outward (closed shapes) or left side (lines). Uses the markup's scale.</div>
 <div class="sec">Cutout</div><div class="hint" style="margin-bottom:6px">Select an Area/Volume plus the shapes inside it (openings, shafts) to subtract them.</div>${bt('mgC','Cut out selected shapes',!(areas.length===1&&ms.length>1))}
 <div class="sec">Arrange (${ms.length} selected)</div><div class="row" style="gap:4px;flex-wrap:wrap">${[['l','Align left'],['hc','Center'],['r','Align right'],['t','Align top'],['vc','Middle'],['b','Align bottom'],['dh','Distribute ↔'],['dv','Distribute ↕']].map(([k,l])=>`<button class="btn" data-al="${k}" style="border:1px solid var(--line)" ${ms.length<2||(k[0]==='d'&&ms.length<3)?'disabled':''}>${l}</button>`).join('')}</div>
 <div class="sec">Copy to other pages</div><div class="row" style="gap:6px"><input class="ti" id="mgP" placeholder="e.g. 2-10 or all">${bt('mgCp','Copy')}</div>`,[{label:'Close',cancel:1}]);
 const md=$('#modal');
 md.querySelectorAll('[data-dup]').forEach(b=>b.onclick=()=>{const c=clone(m);c.id=uid();c.created=c.modified=Date.now();pushUndo();S.markups.push(c);S.undo.pop();convertMarkup(c,b.dataset.dup);closeModal();setSel([c.id])});
 if($('#mgO'))$('#mgO').onclick=()=>{const v=+$('#mgD').value||0,u=$('#mgU').value,sc=m.scale||scaleFor(m.page);const meters=u==='ft'?v*.3048:u==='in'?v*.0254:u==='m'?v:0;const dpt=u==='pt'?v:meters/sc.perPt;
  let pts=m.pts;if(T[m.type].box||m.type==='rect'){const b=normBox(pts[0],pts[1]);pts=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]}
  const c=clone(m);c.id=uid();c.created=c.modified=Date.now();const cl=closed||pts.length>2&&['area','perimeter','polygon','cloud','volume','space'].includes(m.type);c.pts=offsetPoly(pts,dpt,cl);delete c.holes;if(T[m.type].box||m.type==='rect'){c.type='polygon';c.subject=c.subject===defSubject(m.type)?defSubject('polygon'):c.subject}
  pushUndo();S.markups.push(c);commit();closeModal();setSel([c.id]);toast('Offset copy created')};
 if($('#mgC'))$('#mgC').onclick=()=>{const a=areas[0],cut=ms.filter(x=>x!==a);pushUndo();const so=polyArea(a.pts)>=0?1:-1;a.holes=a.holes||[];
  for(const x of cut){let h=x.pts;if(T[x.type].box||x.type==='rect'){const b=normBox(h[0],h[1]);h=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]}if(x.type==='ellipse'){const b=normBox(h[0],h[1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;h=Array.from({length:36},(_,i)=>[cx+(b[2]-b[0])/2*Math.cos(i/36*Math.PI*2),cy+(b[3]-b[1])/2*Math.sin(i/36*Math.PI*2)])}
   if(h.length<3)continue;if((polyArea(h)>=0?1:-1)===so)h=h.slice().reverse();a.holes.push(h)}
  S.markups=S.markups.filter(x=>!cut.includes(x));a.modified=Date.now();commit();closeModal();setSel([a.id]);toast('Cutout applied: '+measLabel(a))};
 md.querySelectorAll('[data-al]').forEach(b=>b.onclick=()=>{const k=b.dataset.al,bb=ms.map(x=>({x,b:bboxOf(x)}));pushUndo();const mv=(x,dx,dy)=>{x.pts=x.pts.map(p=>[p[0]+dx,p[1]+dy]);if(x.holes)x.holes=x.holes.map(h=>h.map(p=>[p[0]+dx,p[1]+dy]));if(x.rects)x.rects=x.rects.map(r=>[r[0]+dx,r[1]+dy,r[2]+dx,r[3]+dy])};
  const ref=bb[0].b;if(k==='l')bb.forEach(o=>mv(o.x,ref[0]-o.b[0],0));if(k==='r')bb.forEach(o=>mv(o.x,ref[2]-o.b[2],0));if(k==='t')bb.forEach(o=>mv(o.x,0,ref[1]-o.b[1]));if(k==='b')bb.forEach(o=>mv(o.x,0,ref[3]-o.b[3]));
  if(k==='hc')bb.forEach(o=>mv(o.x,(ref[0]+ref[2])/2-(o.b[0]+o.b[2])/2,0));if(k==='vc')bb.forEach(o=>mv(o.x,0,(ref[1]+ref[3])/2-(o.b[1]+o.b[3])/2));
  if(k==='dh'||k==='dv'){const i=k==='dh'?0:1;bb.sort((a,b)=>(a.b[i]+a.b[i+2])-(b.b[i]+b.b[i+2]));const c0=(bb[0].b[i]+bb[0].b[i+2])/2,c1=(bb.at(-1).b[i]+bb.at(-1).b[i+2])/2;bb.forEach((o,j)=>{const t=c0+(c1-c0)*j/(bb.length-1),c=(o.b[i]+o.b[i+2])/2;mv(o.x,i?0:t-c,i?t-c:0)})}
  ms.forEach(x=>x.modified=Date.now());commit()});
 $('#mgCp').onclick=()=>{const v=$('#mgP').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v);if(!pages.length)return toast('Enter pages');pushUndo();let n=0;
  for(const pg of pages)for(const x of ms){if(pg===x.page)continue;const c=clone(x);c.id=uid();c.page=pg;c.created=c.modified=Date.now();S.markups.push(c);n++}commit();closeModal();toast(`Copied to ${n} place${n===1?'':'s'}`)}}
/* ---------- Redaction ---------- */
async function applyRedactions(){const rs=S.markups.filter(m=>m.type==='redact');if(!rs.length)return toast('Draw Redact boxes first (or use Search → Redact all results)');
 modal('Apply redactions?',`<div class="hint">This permanently removes everything under ${rs.length} redaction box${rs.length>1?'es':''}. The affected pages are rebuilt as images with black boxes, so the hidden text and lines can't be recovered from the saved PDF. Other pages are untouched. Save a copy of the original first if you may need it.</div>
 <div class="fld" style="margin-top:8px"><label>Quality (dpi)</label><select class="ti" id="rdQ"><option>150</option><option selected>200</option><option>300</option></select></div><label class="chk"><input type="checkbox" id="rdO" checked> Run OCR afterwards so the rest of the page stays searchable</label>`,
 [{label:'Cancel',cancel:1},{label:'Redact permanently',pri:1,fn:md=>{const dpi=+md.querySelector('#rdQ').value,ocr=md.querySelector('#rdO').checked;setTimeout(()=>doRedact(rs,dpi,ocr),0)}}])}
async function doRedact(rs,dpi,ocr){try{toast('Redacting…');const byPage={};rs.forEach(m=>(byPage[m.page]=byPage[m.page]||[]).push(normBox(m.pts[0],m.pts[1])));
 const imgs={};for(const n in byPage){const p=S.pages[n-1],k=Math.min(dpi/72,Math.sqrt(30e6/(p.w*p.h)));const R=await grayPage(+n,k);R.ctx.fillStyle='#000';for(const b of byPage[n])R.ctx.fillRect(b[0]*k,b[1]*k,(b[2]-b[0])*k,(b[3]-b[1])*k);
  imgs[n]=await new Promise(r=>R.c.toBlob(async bl=>r(new Uint8Array(await bl.arrayBuffer())),'image/png'))}
 const keep=S.markups.filter(m=>m.type!=='redact');const pagesDone=Object.keys(byPage).map(Number);
 await PMBatch.rebuild(async doc=>{const out=doc;for(const n of pagesDone){const pg=out.getPage(n-1),vp=S.pages[n-1].vp,png=await out.embedPng(imgs[n]);
   const np=out.insertPage(n,[vp.width,vp.height]);np.drawImage(png,{x:0,y:0,width:vp.width,height:vp.height});out.removePage(n-1)}
  return Array.from({length:out.getPageCount()},(_,i)=>i)},'Applying redactions');
 // rebuild() reattaches markups from before; drop the redaction boxes
 S.markups=S.markups.filter(m=>m.type!=='redact');commit();toast('Redactions applied — save the PDF to keep it');if(ocr&&window.PMOCR)PMOCR.run(pagesDone,false)}
 catch(e){console.error(e);toast('Redaction failed: '+(e.message||e))}}
H.ready.push(()=>{const si=$('#sInfo');if(si)si.addEventListener('click',e=>{if(e.target.id!=='sRedact')return;e.preventDefault();pushUndo();for(const h of searchHits){const m=newMarkup('redact',h.page,[[h.r[0]-1,h.r[1]-1],[h.r[2]+1,h.r[3]+1]],S.defaults.redact);m.subject='Redaction';S.markups.push(m)}commit();toast(`Marked ${searchHits.length} results for redaction — Apply in Max tools`)});
 const _ds=doSearch;doSearch=async function(){await _ds.apply(this,arguments);if(searchHits.length){const si=$('#sInfo');si.insertAdjacentHTML('beforeend',' · <a href="#" id="sRedact" style="color:#fca5a5">Redact all</a>')}};
 $('#sGo').onclick=()=>doSearch()});
/* ---------- AI drawing review (web version, via Claude) ---------- */
let sampleNs=null;H.ready.push(async()=>{try{if(window.claude&&window.claude.use)sampleNs=await window.claude.use('sample')}catch(e){}});
async function aiReview(){if(!S.pages.length)return toast('Open a PDF first');if(!sampleNs){modal('AI drawing review','<div class="hint">AI review runs in the web version of PlanMark on claude.ai, using your Claude account. Open the same PlanMark link in your browser to use it.</div>',[{label:'OK',cancel:1}]);return}
 let lim={};try{lim=await sampleNs.limits()}catch(e){}
 modal('AI drawing review',`<div class="hint" style="margin-bottom:8px">Claude looks at page ${S.cur} and points out possible issues — missing dimensions, unclear notes, coordination conflicts, code concerns. Findings are placed as notes you can accept or reject.</div>
 <div class="fld"><label>Focus (optional)</label><input class="ti" id="aiF" placeholder="e.g. egress, door hardware, structural openings"></div>`,
 [{label:'Cancel',cancel:1},{label:'Review this page',pri:1,fn:md=>{const focus=md.querySelector('#aiF').value.trim();setTimeout(()=>runAi(focus,lim),0)}}])}
async function runAi(focus,lim){const n=S.cur,p=S.pages[n-1];modal('AI drawing review',`<div class="hint" id="aiMsg">Reading the sheet…</div>`,[{label:'Close',cancel:1}]);
 try{const{items}=await pageText(n);const text=items.map(i=>i.str).join(' ').slice(0,12000);let images;
  if(lim&&lim.images){const k=Math.min(1600/Math.max(p.w,p.h),2),R=await grayPage(n,k);images=[await new Promise(r=>R.c.toBlob(r,'image/png'))]}
  const prompt=`You are reviewing one construction drawing sheet for a project manager. ${focus?'Focus on: '+focus+'. ':''}The sheet is ${Math.round(p.w)} x ${Math.round(p.h)} points (origin top-left).${images?' The sheet image is attached.':''}
Text found on the sheet: """${text}"""
Return ONLY JSON: {"summary":"one or two sentences","findings":[{"title":"short","detail":"1-2 sentences","severity":"high|medium|low","x":number,"y":number}]} with up to 12 findings; x,y = approximate location in points (use the sheet center if unknown). Be specific and practical; don't invent facts that aren't supported by the sheet.`;
  const res=await sampleNs.json(prompt,{images,modelTier:'complex',onText:({text})=>{const e=$('#aiMsg');if(e)e.textContent='Reviewing…'}});
  const f=(res&&res.findings)||[];pushUndo();const col={high:'#dc2626',medium:'#d97706',low:'#2563eb'};
  f.forEach(x=>{const m=newMarkup('note',n,[[clamp(+x.x||p.w/2,0,p.w-18),clamp(+x.y||p.h/2,0,p.h-18)]],Object.assign({},S.defaults.note,{fill:col[x.severity]||'#ffd84d'}));m.subject='AI review: '+(x.severity||'note');m.label=x.title||'';m.comment=x.detail||'';m.status='Open';S.markups.push(m)});commit();
  modal('AI drawing review',`<div class="hint" style="margin-bottom:8px">${esc(res&&res.summary||'')}</div>${f.map(x=>`<div class="res"><b style="color:${col[x.severity]||'inherit'}">${esc(x.title||'')}</b><br><small>${esc(x.detail||'')}</small></div>`).join('')||'<div class="hint">No issues found.</div>'}<div class="hint" style="margin-top:8px">Added as notes on the sheet (subject "AI review"). AI can be wrong — verify before acting.</div>`,[{label:'Close',cancel:1}])}
 catch(e){console.error(e);closeModal();toast(e&&e.code==='rate_limited'?'Claude is busy — try again in a minute':'AI review failed: '+(e.message||e.code||e))}}
/* ---------- ribbon: Max tools ---------- */
function maxDialog(){const b=(id,t,d)=>`<button class="btn" id="${id}" style="border:1px solid var(--line);justify-content:flex-start;height:auto;padding:8px 10px;flex-direction:column;align-items:flex-start;white-space:normal;text-align:left"><b>${t}</b><small style="color:var(--mut)">${d}</small></button>`;
 modal('Max tools',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${b('mxAC','AutoCount','Box a symbol; find & count every match')}${b('mxDF','Dynamic Fill','Click inside rooms to measure them')}
 ${b('mxMM','Magic Markups','Duplicate as, offset, cutout, align, copy to pages')}${b('mxLG','Legend','Live table of the page\'s markups & totals')}
 ${b('mxSP','Spaces','Name rooms; markups inside get tagged')}${b('mxRD','Redact','Draw boxes, then permanently remove content')}
 ${b('mxRA','Apply redactions','Burn in all Redact boxes')}${b('mxAI','AI drawing review','Claude checks this sheet for issues')}</div>`,[{label:'Close',cancel:1}]);
 $('#mxAC').onclick=()=>{closeModal();autoCount()};$('#mxDF').onclick=()=>{closeModal();dfillStart()};$('#mxMM').onclick=()=>{closeModal();magicDialog()};
 $('#mxLG').onclick=()=>{closeModal();setTool('legend');toast('Click where the legend goes')};$('#mxSP').onclick=()=>{closeModal();setTool('space');toast('Click the room outline · Enter to finish — or use Dynamic Fill → Space')};
 $('#mxRD').onclick=()=>{closeModal();setTool('redact',{lock:true})};$('#mxRA').onclick=()=>{closeModal();applyRedactions()};$('#mxAI').onclick=()=>{closeModal();aiReview()}}
H.ribbon.push({label:'Max',title:'AutoCount, Dynamic Fill, Magic Markups, Legends, Spaces, Redaction, AI review',icon:'<path d="M12 2l2.4 6.6L21 9l-5.2 4.3L17.5 21 12 17.3 6.5 21l1.7-7.7L3 9l6.6-.4z"/>',fn:maxDialog});
IC.space='<path d="M4 4h10v6h6v10H4z" stroke-dasharray="3 2"/>';IC.legend='<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M7 9h2M11 9h6M7 13h2M11 13h6M7 17h2M11 17h6"/>';IC.redact='<rect x="3" y="7" width="18" height="10" fill="currentColor" fill-opacity=".6"/>';IC.dfill='<path d="M5 5h14v14H5z"/><path d="M9 13l2 2 4-5" />';
IC.typewriter='<path d="M5 7V5h14v2M9 19h6M12 5v14" /><path d="M3 21h18"/>';IC.cloudplus=IC.cloud+'<path d="M17 3v4M15 5h4"/>';IC.texthl='<rect x="3" y="8" width="18" height="8" fill="currentColor" fill-opacity=".35"/><path d="M7 14l2-5 2 5M7.8 12h2.4M14 9h3a1.5 1.5 0 010 3h-3zm0 3h3.4a1.5 1.5 0 010 3H14z"/>';
IC.underline='<path d="M7 4v7a5 5 0 0010 0V4M5 20h14"/>';IC.strikeout='<path d="M5 12h14M16 6.5A4 3 0 008 7c0 4 8 2 8 6a4 3 0 01-8 .5"/>';IC.image='<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>';
IC.eraser='<path d="M7 21h12M3.5 14.5l9-9a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L11 19H7.5z"/>';IC.dimension='<path d="M4 9v6M20 9v6M4 12h16M7 10l-3 2 3 2M17 10l3 2-3 2"/>';IC.circle='<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/>';IC.volume='<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>';
Object.assign(KEYS,{eraser:'Shift+E',typewriter:'W',cloudplus:'Shift+C',dimension:'Shift+Alt+D',circle:'Shift+Alt+R',volume:'Shift+Alt+V'});
window.PMAuto={autoCount,dynamicFill,magicDialog,applyRedactions,aiReview,pickRegion};
})();
