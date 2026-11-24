/* PlanMark — sharp at any zoom.
   A whole page can only be drawn up to a size limit (about 16 million pixels), so past that zoom the page used
   to be stretched and looked soft. Now, whenever the page is drawn below the screen's real sharpness, the part
   of the page you're looking at is drawn again at full sharpness into a layer on top (like Bluebeam, which
   draws only what's on screen). Scanned drawings show their true pixels instead of a blur. */
(function(){
const MAXPX=16e6;
const st=document.createElement('style');
st.textContent='.page canvas.pmSharp,.pg2 canvas.pmSharp{position:absolute;inset:auto;width:auto;height:auto;pointer-events:none;z-index:0}.page .ov{z-index:1}';
document.head.appendChild(st);
let T=0;const schedule=(ms)=>{clearTimeout(T);T=setTimeout(run,ms==null?160:ms)};
function want(z){return(z==null?S.zoom:z)*Math.min(window.devicePixelRatio||1,3)}
const MAIN={v:()=>viewer,z:()=>S.zoom,doc:()=>S.pdf};
function drop(p){if(p.sharp){try{p.sharpTask&&p.sharpTask.cancel()}catch(e){}p.sharp.remove();p.sharp=null;p.sharpKey=''}}
async function sharpen(p,C){C=C||MAIN;
 const s=want(C.z());if(!p.rs||s<=p.rs*1.05){drop(p);return}            // the whole-page drawing is already sharp enough
 const vr=C.v().getBoundingClientRect(),pr=p.el.getBoundingClientRect();
 const ix0=Math.max(vr.left,pr.left),iy0=Math.max(vr.top,pr.top),ix1=Math.min(vr.right,pr.right),iy1=Math.min(vr.bottom,pr.bottom);
 if(ix1<=ix0||iy1<=iy0){drop(p);return}
 const kx=p.w/pr.width,ky=p.h/pr.height;                             // page units per screen pixel
 let x0=(ix0-pr.left)*kx,y0=(iy0-pr.top)*ky,x1=(ix1-pr.left)*kx,y1=(iy1-pr.top)*ky;
 const mx=(x1-x0)*.15,my=(y1-y0)*.15;x0=Math.max(0,x0-mx);y0=Math.max(0,y0-my);x1=Math.min(p.w,x1+mx);y1=Math.min(p.h,y1+my);
 let sc=s;const area=(x1-x0)*(y1-y0)*sc*sc;if(area>MAXPX)sc=Math.sqrt(MAXPX/((x1-x0)*(y1-y0)));   // never bigger than the limit
 if(sc<=p.rs*1.05){drop(p);return}
 const key=[sc.toFixed(3),x0|0,y0|0,x1|0,y1|0].join(',');
 if(p.sharpKey===key)return;
 const doc=C.doc();if(!doc)return;const page=await doc.getPage(p.num);if(doc!==C.doc())return;
 const vp=page.getViewport({scale:sc,offsetX:-x0*sc,offsetY:-y0*sc});
 const c=document.createElement('canvas');c.className='pmSharp';c.width=Math.max(1,Math.ceil((x1-x0)*sc));c.height=Math.max(1,Math.ceil((y1-y0)*sc));
 try{p.sharpTask&&p.sharpTask.cancel()}catch(e){}
 const task=page.render({canvasContext:c.getContext('2d'),viewport:vp});p.sharpTask=task;
 try{await task.promise}catch(e){return}finally{if(p.sharpTask===task)p.sharpTask=null}
 if(doc!==C.doc()||!p.el.isConnected)return;
 Object.assign(c.style,{left:(x0/p.w*100)+'%',top:(y0/p.h*100)+'%',width:((x1-x0)/p.w*100)+'%',height:((y1-y0)/p.h*100)+'%'});
 if(p.sharp)p.sharp.replaceWith(c);else p.canvas.after(c);
 p.sharp=c;p.sharpKey=key}
function run(){if(!S.pdf)return;for(const p of S.pages){if(p.vis)sharpen(p).catch(()=>{});else drop(p)}}
viewer.addEventListener('scroll',()=>schedule(),{passive:true});
addEventListener('resize',()=>schedule());
const _rp=renderPage;renderPage=async function(p){const r=await _rp.apply(this,arguments);schedule(60);return r};
const _sz=setZoom;setZoom=function(){const r=_sz.apply(this,arguments);for(const p of S.pages)if(p.sharp)p.sharpKey='';schedule();return r};
H.open.push(()=>{for(const p of S.pages||[])p.sharp=null});
// the second split pane gets the same treatment
const ctxOf=P=>({v:()=>P.v||document.getElementById('viewer2'),z:()=>P.zoom,doc:()=>{const V=window.PMViews;if(!V||!V.P2.on)return null;const t=V.tabs.find(t=>t.id===P.tabId);return t?(t.id===V.curTab?S.pdf:t.st&&t.st.pdf):null}});
let T2=0;function run2(){clearTimeout(T2);T2=setTimeout(()=>{const V=window.PMViews;if(!V||!V.P2.on)return;for(const P of V.panes||[V.P2]){if(P.rot)continue;const c=ctxOf(P);for(const q of P.pages){if(q.vis)sharpen(q,c).catch(()=>{});else drop(q)}}},140)}
window.PMSharp={run,want,run2};
})();
