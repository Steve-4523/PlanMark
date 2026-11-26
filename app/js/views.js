/* PlanMark — views: document tabs, split screen with sync, page display modes, rotate view,
   rulers, dimmer, navigation history, zoom box / actual size / zoom to selection, light theme, magnifier */
(function(){
const V=Object.assign({rulers:false,dim:0,theme:'dark',cover:false,splitRatio:.5,orient:'v'},settings.view||{});
function saveV(){settings.view=Object.assign({},V);LS.set('pm:settings',settings)}
const css=document.createElement('style');document.head.appendChild(css);
css.textContent=`
#viewWrap{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
#tabBar{display:flex;align-items:stretch;gap:1px;background:var(--bg);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:thin;flex-shrink:0;min-height:30px}
#tabBar .dtab,.tabBar2 .dtab{display:flex;align-items:center;gap:6px;padding:0 6px 0 12px;max-width:220px;min-width:90px;background:var(--panel);color:var(--mut);cursor:pointer;border-top:2px solid transparent;font-size:12px;user-select:none}
#tabBar .dtab.on,.tabBar2 .dtab.on{background:var(--panel2);color:var(--text);border-top-color:var(--acc)}
#tabBar .dtab .nm,.tabBar2 .dtab .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tabBar .dtab .cx,.tabBar2 .dtab .cx{border:0;background:none;color:inherit;opacity:.55;cursor:pointer;padding:2px 4px;border-radius:4px}
#tabBar .dtab .cx:hover,.tabBar2 .dtab .cx:hover{opacity:1;background:rgba(127,127,127,.25)}
#tabBar .dtab.dragover,.tabBar2 .dtab.dragover{box-shadow:inset 3px 0 0 var(--acc)}
#tabBar .tplus,.tabBar2 .tplus{border:0;background:none;color:var(--mut);font-size:18px;padding:0 12px;cursor:pointer}
#splitBox{flex:1;display:flex;min-height:0;min-width:0;position:relative}
#splitBox.h{flex-direction:column}
#mainCol{flex:1 1 0;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative}
/* split view: the pane you are working in is shown by its tab only (blue line, bright name); the other pane's tab is grey.
   The blue box that went round the whole pane was taken out (1.6.4). */
#splitBox.on #tabBar .dtab.on{border-top:3px solid var(--acc);font-weight:600}
#splitBox.on .vw2{cursor:default}
.tabBar2{display:flex;align-items:stretch;gap:1px;overflow-x:auto;scrollbar-width:thin;flex:1;min-width:0;min-height:30px}
#tabBar.dragin,.tabBar2.dragin{box-shadow:inset 0 0 0 2px var(--acc)}
#splitBox.on .vw2wrap .tabBar2 .dtab.on{border-top-color:var(--mut);color:var(--mut)}
body.dl .p2bar{background:#1f1f1f}
#mainPane{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative}
#mainPane.ruled{padding:20px 0 0 20px}
.vw2wrap{display:none;flex-direction:column;min-width:0;min-height:0;position:absolute}
#splitBox.on .vw2wrap.pnOn{display:flex}
.pnDiv{display:none;background:var(--line);cursor:col-resize;touch-action:none;z-index:7}
.pnDiv.h{cursor:row-resize}
.p2bar{display:flex;align-items:stretch;background:var(--bg);border-bottom:1px solid var(--line);flex-shrink:0}
.vw2{flex:1;overflow:auto;background:var(--canvas);position:relative;min-height:0}
.pages2{display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px;width:max-content;min-width:100%;position:relative}
.pg2{position:relative;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.45);flex-shrink:0}
.pg2 canvas,.pg2 svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.pg2 svg{overflow:visible}
.page.rv90>canvas,.page.rv90>svg.ov,.pg2.rv90>canvas,.pg2.rv90>svg{inset:auto;left:0;top:0;width:var(--pw);height:var(--ph);transform-origin:0 0;transform:translate(var(--ph),0) rotate(90deg)}
.page.rv180>canvas,.page.rv180>svg.ov,.pg2.rv180>canvas,.pg2.rv180>svg{inset:auto;left:0;top:0;width:var(--pw);height:var(--ph);transform-origin:0 0;transform:translate(var(--pw),var(--ph)) rotate(180deg)}
.page.rv270>canvas,.page.rv270>svg.ov,.pg2.rv270>canvas,.pg2.rv270>svg{inset:auto;left:0;top:0;width:var(--pw);height:var(--ph);transform-origin:0 0;transform:translate(0,var(--pw)) rotate(270deg)}
#pages.m-2up,#pages.m-2upc{display:grid;grid-template-columns:repeat(2,max-content);justify-content:center;align-items:start;gap:18px}
#pages.m-cover .page:first-child{grid-column:2}
#pages.m-2up .page:not(.vis2){display:none}
#rulerT,#rulerL{position:absolute;display:none;background:var(--panel);z-index:6;pointer-events:none}
#mainPane.ruled #rulerT{display:block;left:20px;top:0;width:calc(100% - 20px);height:20px;border-bottom:1px solid var(--line)}
#mainPane.ruled #rulerL{display:block;left:0;top:20px;height:calc(100% - 20px);width:20px;border-right:1px solid var(--line)}
#rulerC{position:absolute;left:0;top:0;width:20px;height:20px;background:var(--panel);display:none;z-index:6}
#mainPane.ruled #rulerC{display:block}
#zoomRect{position:fixed;border:1.5px dashed #3d8bfd;background:rgba(61,139,253,.12);pointer-events:none;z-index:40;display:none}
#loupe{position:fixed;width:220px;height:220px;border-radius:50%;overflow:hidden;border:3px solid #3d8bfd;box-shadow:0 8px 30px rgba(0,0,0,.45);pointer-events:none;z-index:45;display:none;background:#fff}
#loupe canvas,#loupe svg{position:absolute;left:0;top:0;width:220px;height:220px}
#viewer.c-zoombox,#viewer.c-zoombox .page svg.ov{cursor:zoom-in!important}
.vbtn-on{background:var(--accbg)!important;border-color:var(--acc)!important}
body.light{--bg:#eef0f4;--panel:#ffffff;--panel2:#e9edf3;--line:#d3d8e0;--text:#1d2430;--mut:#5c6675;--accbg:#dbe8ff;--canvas:#c5cad3}
body.light #status{background:#f6f7f9;color:#4b5563}
body.light table.ml td{border-bottom-color:#e5e7eb}
body.light table.ml tbody tr:hover td{background:#eef2f7}
body.light table.ml tr.sel td,body.light table.ml tr.sel:hover td{background:#dbe8ff}
body.light .res:hover,body.light .chest:hover{background:#eef2f7}
body.light #toast{background:#1f2937;color:#fff}
body.light .page .pn{color:#374151}
body.light .meas b{color:#0369a1}
body.light #live{color:#0369a1}
body.light .stamps button:hover{background:#fde8e8}
body.light .tabs button.on{color:#1d2430}
`;
const dimCss=document.createElement('style');document.head.appendChild(dimCss);
/* ================= geometry under rotation ================= */
let curRot=0;// rotation of the current document's view (0/90/180/270)
function ptToPx(w,h,rot,pt,z){const[x,y]=pt;switch(rot){case 90:return[(h-y)*z,x*z];case 180:return[(w-x)*z,(h-y)*z];case 270:return[y*z,(w-x)*z];default:return[x*z,y*z]}}
function pxToPt(w,h,rot,rx,ry,z){switch(rot){case 90:return[ry/z,h-rx/z];case 180:return[w-rx/z,h-ry/z];case 270:return[w-ry/z,rx/z];default:return[rx/z,ry/z]}}
function boxDims(p,rot){return rot%180?[p.h,p.w]:[p.w,p.h]}
function sizePageEl(el,p,z,rot){const[bw,bh]=boxDims(p,rot);el.style.width=bw*z+'px';el.style.height=bh*z+'px';el.style.setProperty('--pw',p.w*z+'px');el.style.setProperty('--ph',p.h*z+'px');
 el.classList.toggle('rv90',rot===90);el.classList.toggle('rv180',rot===180);el.classList.toggle('rv270',rot===270)}
toPt=function(e,p){const r=p.el.getBoundingClientRect();const z=(curRot%180?r.height:r.width)/p.w||S.zoom;return pxToPt(p.w,p.h,curRot,e.clientX-r.left,e.clientY-r.top,z)};
anchorAt=function(cx,cy){let best=null,bd=1e18;for(const p of S.pages){if(!p.el.offsetParent&&p.el.style.display!=='')continue;const r=p.el.getBoundingClientRect();if(!r.width&&!r.height)continue;
  const dx=cx<r.left?r.left-cx:cx>r.right?cx-r.right:0,dy=cy<r.top?r.top-cy:cy>r.bottom?cy-r.bottom:0,d=dx+dy;if(d<bd){bd=d;best={p,r}}if(d===0)break}
 if(!best)return null;return{p:best.p,pt:pxToPt(best.p.w,best.p.h,curRot,cx-best.r.left,cy-best.r.top,S.zoom),cx,cy}};
let zoomRecT=0,lockSync=false;
setZoom=function(z,anchor){if(!S.pages.length)return;z=clamp(z,.05,64);const vr=viewer.getBoundingClientRect();if(!anchor)anchor=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);
 S.zoom=z;for(const p of S.pages)sizePageEl(p.el,p,z,curRot);
 if(anchor&&anchor.p){const px=ptToPx(anchor.p.w,anchor.p.h,curRot,anchor.pt,z);viewer.scrollLeft=anchor.p.el.offsetLeft+px[0]-(anchor.cx-vr.left);viewer.scrollTop=anchor.p.el.offsetTop+px[1]-(anchor.cy-vr.top)}
 $('#zoomv').value=Math.round(z*100)+'%';scheduleRender();clearTimeout(setZoom.t);setZoom.t=setTimeout(redrawAll,150);
 clearTimeout(zoomRecT);zoomRecT=setTimeout(recordNav,700);drawRulers();syncFromMain()};
gotoPage=function(n,instant){n=clamp(n|0,1,S.pages.length);const p=S.pages[n-1];if(!p)return;if(n!==S.cur)recordNav();S.cur=n;updateCurUI();
 viewer.scrollTo({top:p.el.offsetTop-14,left:Math.max(0,p.el.offsetLeft+p.el.offsetWidth/2-viewer.clientWidth/2),behavior:instant?'auto':'smooth'});
 setTimeout(recordNav,650)};
scrollToBox=function(n,b){const p=S.pages[n-1];if(!p)return;if(n!==S.cur){S.cur=n;updateCurUI()}const px=ptToPx(p.w,p.h,curRot,[(b[0]+b[2])/2,(b[1]+b[3])/2],S.zoom);
 viewer.scrollTo({left:p.el.offsetLeft+px[0]-viewer.clientWidth/2,top:p.el.offsetTop+px[1]-viewer.clientHeight/2,behavior:'smooth'})};
const isTwo=()=>['2up','2upc'].includes(mode());
fitWidth=function(){if(!S.pages.length)return;const p=S.pages[S.cur-1]||S.pages[0];const[bw]=boxDims(p,curRot);setZoom(isTwo()?(viewer.clientWidth-48-18)/(2*bw):(viewer.clientWidth-48)/bw);gotoPage(S.cur,true)};
fitPage=function(){if(!S.pages.length)return;const p=S.pages[S.cur-1]||S.pages[0];const[bw,bh]=boxDims(p,curRot);const k=isTwo()?2:1;setZoom(Math.min((viewer.clientWidth-48-(k-1)*18)/(k*bw),(viewer.clientHeight-48)/bh));gotoPage(S.cur,true)};
function rotateView(d){if(!S.pages.length)return;const vr=viewer.getBoundingClientRect(),a=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);curRot=((curRot+d)%360+360)%360;
 if(a)a.cx=vr.left+vr.width/2,a.cy=vr.top+vr.height/2;setZoom(S.zoom,a);if(P2.on)for(const P of panesOn())if(P.tabId===curTab)p2Layout(P,true);redrawAll();renderTabs();toast('View rotated '+curRot+'° (the PDF itself is unchanged)')}
/* ================= page display modes ================= */
function mode(){const L=window.PMLayout&&PMLayout.get();return(L&&L.mode)||'continuous'}
function spread(n){const N=S.pages.length;let a;if(V.cover){if(n===1)return[1];a=n%2===0?n:n-1}else a=n%2===1?n:n-1;return[a,a+1].filter(x=>x>=1&&x<=N)}
function applyMode(){const m=mode();pagesEl.classList.toggle('m-2up',m==='2up');pagesEl.classList.toggle('m-2upc',m==='2upc');pagesEl.classList.toggle('m-cover',V.cover&&isTwo());
 if(m==='2up'){const sp=spread(S.cur);S.pages.forEach(p=>p.el.classList.toggle('vis2',sp.includes(p.num)))}scheduleRender();drawRulers()}
function setMode(m){const L=PMLayout.get();PMLayout.set(Object.assign({},L,{mode:m}));applyMode();if(S.pages.length){S.pages.forEach(p=>p.el.classList.toggle('curp',p.num===S.cur));setTimeout(()=>{fitPage()},30)}}
const _uci=updateCurUI;updateCurUI=function(){_uci.apply(this,arguments);if(mode()==='2up'){const sp=spread(S.cur);S.pages.forEach(p=>p.el.classList.toggle('vis2',sp.includes(p.num)))}drawRulers();renderNavBtns()};
const _lsset=LS.set;LS.set=function(k,v){_lsset.apply(LS,arguments);if(k==='pm:layout')setTimeout(applyMode,0)};
function flip(dir){if(!S.pages.length)return;const m=mode();if(m==='2up'||m==='2upc'){const sp=spread(S.cur);const n=dir>0?sp[sp.length-1]+1:sp[0]-1;if(n>=1&&n<=S.pages.length)gotoPage(spread(n)[0],true)}else gotoPage(S.cur+dir,m==='single')}
/* ================= navigation history ================= */
let hist=[],hi=-1,navLock=false;
function navSnap(){return{tab:curTab,page:S.cur,zoom:S.zoom,sl:viewer.scrollLeft,st:viewer.scrollTop}}
function recordNav(){if(navLock||!S.pdf)return;const s=navSnap(),l=hist[hi];if(l&&l.tab===s.tab&&l.page===s.page&&Math.abs(l.zoom-s.zoom)<1e-3){hist[hi]=s;return}hist=hist.slice(0,hi+1);hist.push(s);if(hist.length>150)hist.shift();hi=hist.length-1;renderNavBtns()}
function restoreNav(s){if(!s)return;navLock=true;if(s.tab!==curTab){const t=tabs.find(x=>x.id===s.tab);if(!t){navLock=false;return}switchTo(t)}
 setZoom(s.zoom);viewer.scrollLeft=s.sl;viewer.scrollTop=s.st;S.cur=s.page;updateCurUI();clearTimeout(restoreNav.t);restoreNav.t=setTimeout(()=>{navLock=false;renderNavBtns()},800)}
/* zoom changes are views too (Revu's Previous View goes back through zooms); one entry per burst of wheel/zoom steps */
const _szNav=setZoom;let szNavT=0;setZoom=function(z){if(!navLock&&S.pdf&&typeof z==='number'&&Math.abs(z-S.zoom)>1e-3&&Date.now()-szNavT>700)recordNav();szNavT=Date.now();return _szNav.apply(this,arguments)};
function navBack(){recordNav();if(hi>0){hi--;restoreNav(hist[hi])}renderNavBtns()}
function navFwd(){if(hi<hist.length-1){hi++;restoreNav(hist[hi])}renderNavBtns()}
function renderNavBtns(){const b=$('#bBack'),f=$('#bFwd');if(b)b.disabled=!(hi>0||(hist.length&&hi===hist.length-1&&hist[hi]&&hist[hi].page!==S.cur));if(f)f.disabled=!(hi<hist.length-1)}
/* ================= document tabs ================= */
const FIELDS=['pdf','bytes','fileName','fileKey','pages','markups','scales','undo','redo','drawing','countId','textCache','flash','cur','zoom','layers','ocr','setFile','align'];
let tabs=[],curTab=null,tabSeq=1;
// S.layers is reset by the Layers module whenever a document "opens"; keep it per tab across tab switches
let layersVal=S.layers||[],swallowLayers=false;
Object.defineProperty(S,'layers',{get(){return layersVal},set(v){if(!swallowLayers)layersVal=v},configurable:true,enumerable:true});
const tabOf=id=>tabs.find(t=>t.id===id);
function blankS(){Object.assign(S,{pdf:null,bytes:null,fileName:'',fileKey:'',pages:[],markups:[],scales:{},undo:[],redo:[],drawing:null,countId:null,textCache:{},flash:null,cur:1,ocr:{},setFile:null,align:null});layersVal=[];S.sel=new Set()}
function stash(t){if(!t)return;if(S.drawing||S.countId)try{cancelActive()}catch(e){}
 const st={};for(const f of FIELDS)st[f]=S[f];st.sel=[...S.sel];st.sl=viewer.scrollLeft;st.st=viewer.scrollTop;t.rot=curRot;
 const ST=window.PMStudio&&PMStudio.ST;if(ST&&ST.sess){st.sess=ST.sess;ST.sess=null}
 const frag=document.createDocumentFragment();for(const p of S.pages)io.unobserve(p.el);while(pagesEl.firstChild)frag.appendChild(pagesEl.firstChild);t.frag=frag;t.st=st;t.name=S.fileName||t.name}
function unstash(t){const st=t.st;for(const f of FIELDS)if(f!=='layers')S[f]=st[f];layersVal=st.layers||[];S.sel=new Set(st.sel||[]);curRot=t.rot||0;
 if(t.frag){pagesEl.appendChild(t.frag);t.frag=null}for(const p of S.pages){p.vis=false;io.observe(p.el)}
 const ST=window.PMStudio&&PMStudio.ST;if(ST&&st.sess)ST.sess=st.sess;t.st=null}
function safeOpenHook(){const keepO=S.ocr,keepSF=S.setFile,rv=URL.revokeObjectURL,ST=window.PMStudio&&PMStudio.ST,j=ST&&ST.joining;
 URL.revokeObjectURL=()=>{};swallowLayers=true;if(ST)ST.joining=true;
 try{hook('open',{switched:true})}finally{URL.revokeObjectURL=rv;swallowLayers=false;if(ST)ST.joining=j;S.ocr=keepO;S.setFile=keepSF}}
function afterSwitchUI(t){$('#empty').style.display=S.pdf?'none':'';$('#pageTot').textContent='/ '+(S.pdf?S.pdf.numPages:0);['bSave','bMore'].forEach(id=>{const b=$('#'+id);if(b)b.disabled=!S.pdf});
 document.title=S.pdf?S.fileName+' — PlanMark':'PlanMark — PDF Markup & Takeoff';$('#zoomv').value=Math.round(S.zoom*100)+'%';
 try{searchHits=[];$('#sRes').innerHTML='';$('#sInfo').textContent=''}catch(e){}
 setTool('pan');applyMode();if(S.pdf)safeOpenHook();buildThumbs();commit(true);renderProps();updateCurUI();updateScaleBtn();updUndo();scheduleRender();renderTabs();drawRulers();p2Refresh()}
function switchTo(t){if(!t||t.id===curTab)return;recordNav();const old=tabOf(curTab);stash(old);curTab=t.id;unstash(t);
 // restore scroll once layout is back
 const sl=t.lastSl,stp=t.lastSt;afterSwitchUI(t);requestAnimationFrame(()=>{viewer.scrollLeft=sl||0;viewer.scrollTop=stp||0;updateCur();syncFromMain()});recordNav()}
// remember scroll per tab (stash() reads viewer scroll before DOM detaches)
const _stash=stash;stash=function(t){if(t){t.lastSl=viewer.scrollLeft;t.lastSt=viewer.scrollTop}return _stash(t)};
async function closeTab(id){let t=tabOf(id);if(!t)return;
 if(P2.on&&id===curTab){const ra=PN.ids[PN.act].filter(x=>x!==id&&tabOf(x));
  if(ra.length)switchTo(tabOf(lastOf(ra)));
  else{const s=passive().map(x=>x[0]).find(s=>PN.ids[s].some(x=>x!==id&&tabOf(x)));   // the active pane empties: work in another pane
   if(s==null)closeSplit();else{const P=PN.at[s];activatePane(P.tabId!==id?P.tabId:lastOf(PN.ids[s].filter(x=>x!==id)),s)}}}
 t=tabOf(id);if(!t)return;const i=tabs.indexOf(t);
 if(id===curTab){const ST=window.PMStudio&&PMStudio.ST;if(ST&&ST.sess)try{PMStudio.leave(false)}catch(e){}
  for(const p of S.pages)io.unobserve(p.el);pagesEl.innerHTML='';try{S.pdf&&S.pdf.destroy()}catch(e){}layersVal.forEach(L=>{try{URL.revokeObjectURL(L.url)}catch(e){}});
  tabs.splice(i,1);const nxt=tabs[i]||tabs[i-1];curTab=null;
  if(nxt){curTab=nxt.id;unstash(nxt);const sl=nxt.lastSl,st=nxt.lastSt;afterSwitchUI(nxt);requestAnimationFrame(()=>{viewer.scrollLeft=sl||0;viewer.scrollTop=st||0;updateCur()})}
  else{blankS();curRot=0;afterSwitchUI(null);$('#pane-pages').innerHTML='<div class="hint">Open a PDF to see page thumbnails.</div>';if(P2.on)closeSplit()}}
 else{tabs.splice(i,1);try{t.st&&t.st.pdf&&t.st.pdf.destroy()}catch(e){}(t.st&&t.st.layers||[]).forEach(L=>{try{URL.revokeObjectURL(L.url)}catch(e){}});t.frag=null}
 if(P2.on){PN.ids=PN.ids.map(L=>L.filter(x=>x!==id));const gone=[];for(const[s,P]of passive())if(P.tabId===id){const L=PN.ids[s];if(L.length)p2Show(P,lastOf(L));else gone.push(s)}
  gone.sort((a,b)=>b-a).forEach(s=>removeSlot(s))}
 hist=hist.filter(h=>h.tab!==id);hi=Math.min(hi,hist.length-1);renderTabs();renderNavBtns()}
// wrap openBytes: a plain open makes a new tab (or switches to an already-open copy); rebuilds/joins pass `restored` and stay in place
const _open=openBytes;
openBytes=async function(bytes,name,restored){
 if(restored||!curTab&&!tabs.length){if(!curTab){const t={id:tabSeq++,name};tabs.push(t);curTab=t.id}const r=await _open.apply(this,arguments);const t=tabOf(curTab);if(t){t.name=S.fileName||name}if(!S.pdf&&t&&tabs.length===1&&!restored){tabs=[];curTab=null}renderTabs();applyMode();recordNav();return r}
 const dup=tabs.find(t=>t.id!==curTab&&t.st&&t.st.fileName===name&&t.st.bytes&&t.st.bytes.length===bytes.length);
 if(dup){switchTo(dup);return}
 if(S.pdf&&S.fileName===name&&S.bytes&&S.bytes.length===bytes.length){toast(name+' is already open');return}
 const prev=tabOf(curTab);if(prev&&S.pdf){stash(prev);blankS()}else if(prev){tabs.splice(tabs.indexOf(prev),1)}
 const t={id:tabSeq++,name};tabs.push(t);curTab=t.id;curRot=0;renderTabs();
 await _open.apply(this,arguments);
 if(!S.pdf){tabs.splice(tabs.indexOf(t),1);curTab=null;if(prev&&tabs.includes(prev)){curTab=prev.id;unstash(prev);afterSwitchUI(prev)}else renderTabs();return}
 t.name=S.fileName;renderTabs();applyMode();recordNav()};
let dragTab=null,dragFrom=0;
function tabHtml(list,cur){return list.map(t=>`<div class="dtab ${t.id===cur?'on':''}" data-tid="${t.id}" draggable="true" title="${esc(t.name)}"><span class="nm">${esc(t.name||'Untitled')}</span>${(t.id===curTab?curRot:t.rot)?`<small title="View rotated">⟳${t.id===curTab?curRot:t.rot}°</small>`:''}<button class="cx" data-close="${t.id}" title="Close (Ctrl+W)">✕</button></div>`).join('')+`<button class="tplus" title="Open PDF in a new tab">+</button>`}
function renderTabs(){const bar=$('#tabBar');if(!bar)return;if(P2.on)paneTidy();
 bar.innerHTML=tabHtml(P2.on?tabs.filter(t=>PN.ids[PN.act].includes(t.id)):tabs,curTab);
 for(const P of pool)if(P.bar)P.bar.innerHTML='';if(P2.on)for(const[s,P]of passive())if(P.bar)P.bar.innerHTML=tabHtml(tabs.filter(t=>PN.ids[s].includes(t.id)),P.tabId)}
/* ================= split screen =================
   Works like Bluebeam: full viewers side by side or top / bottom, each with its own tabs, page, zoom and scroll,
   and any pane can be split again. Click a pane to make it the active one; everything else (thumbnails, markups list,
   properties, page box, zoom box, status bar) follows the active pane. The editing surface (#viewer, in #mainCol)
   always shows the ACTIVE pane and the other panes are drawn by passive viewers (.vw2). The layout is a tree of
   splits; every pane box is positioned over its spot, so when you click another pane the two boxes simply trade
   spots and documents, and what you see stays exactly where it was. */
const P2={on:false,sync:false,lock:false,tabId:null,zoom:1,pages:[],rot:0,io:null};   // P2 = the first passive pane (#viewer2) + the split-wide flags
const pool=[P2];                 // every passive pane box ever made (re-used)
const PN={act:0,ids:[[],[]],at:{},tree:null};   // ids[slot] = the tabs of each pane; at[slot] = the passive pane drawing it; tree = the layout
const passive=()=>Object.keys(PN.at).map(Number).filter(s=>s!==PN.act&&PN.at[s]).map(s=>[s,PN.at[s]]);
const panesOn=()=>passive().map(x=>x[1]);
const slotOf=P=>{for(const[s,Q]of passive())if(Q===P)return s;return null};
const nSlots=()=>{let n=0;const w=t=>{if(!t)return;if(t.t==='l')n++;else{w(t.a);w(t.b)}};w(PN.tree);return n};
const lastOf=L=>L[L.length-1];
function docFor(id){if(id===curTab)return{pdf:S.pdf,pages:S.pages,markups:S.markups,scales:S.scales,rot:curRot,cur:true};const t=tabOf(id);if(!t||!t.st)return null;return{pdf:t.st.pdf,pages:t.st.pages,markups:t.st.markups,scales:t.st.scales,rot:t.rot||0,cur:false}}
function paneTidy(){const live=new Set(tabs.map(t=>t.id));PN.ids=PN.ids.map(L=>(L||[]).filter(id=>live.has(id)));const a=PN.act;
 if(curTab!=null&&!PN.ids[a].includes(curTab))PN.ids[a].push(curTab);
 for(const[s,P]of passive())if(P.tabId!=null&&!PN.ids[s].includes(P.tabId))PN.ids[s].push(P.tabId);
 for(const t of tabs)if(!PN.ids.some(L=>L.includes(t.id)))PN.ids[a].push(t.id)}
function paneOf(id){if(!P2.on)return null;const a=PN.ids[PN.act].includes(id),b=PN.ids.some((L,s)=>s!==PN.act&&L.includes(id));return a&&b?'both':a?'active':b?'other':null}
function placeTabBar(){const bar=$('#tabBar'),mc=$('#mainCol'),sb=$('#splitBox'),vw=$('#viewWrap');if(!bar||!mc||!sb)return;
 const vis=P2.on&&sb.offsetWidth>0&&sb.offsetHeight>0;   // (another module may hide the split box, e.g. the CAD or web views)
 if(vis){if(bar.parentNode!==mc)mc.insertBefore(bar,mc.firstChild)}else if(bar.parentNode!==vw)vw.insertBefore(bar,sb)}
// place every pane box and divider over its spot in the layout tree (sizes are % of the split box + px, so no resize handling is needed)
const LIN=([f,p])=>`calc(${(f*100).toFixed(4)}% + ${p.toFixed(2)}px)`;
function placeEl(e,r){Object.assign(e.style,{position:'absolute',left:LIN(r[0]),top:LIN(r[1]),width:LIN(r[2]),height:LIN(r[3]),flex:'none',order:''})}
function layout(){const box=$('#splitBox'),mc=$('#mainCol'),sd=$('#splitDiv');if(!box||!mc)return;
 box.querySelectorAll('.pnDiv:not(#splitDiv)').forEach(d=>d.remove());
 if(!P2.on||!PN.tree||PN.tree.t!=='s'){Object.assign(mc.style,{position:'',left:'',top:'',width:'',height:'',flex:'',order:''});mc.classList.remove('pnAct');if(sd){sd.style.display='none';sd._node=null}
  for(const P of pool)if(P.wrap)P.wrap.classList.remove('pnOn');box.classList.remove('actB');return}
 const used=new Set();const add=(p,q)=>[p[0]+q[0],p[1]+q[1]];
 const walk=(n,r,root)=>{n._r=r;
  if(n.t==='l'){const el=n.s===PN.act?mc:PN.at[n.s]&&PN.at[n.s].wrap;if(el){placeEl(el,r);if(el!==mc)used.add(el)}return}
  const[x,y,w,h]=r,v=n.o==='v',T=v?w:h,a=[T[0]*(1-n.r),(T[1]-6)*(1-n.r)],b=[T[0]-a[0],T[1]-6-a[1]];
  const ra=v?[x,y,a,h]:[x,y,w,a],rd=v?[add(x,a),y,[0,6],h]:[x,add(y,a),w,[0,6]],rb=v?[add(add(x,a),[0,6]),y,b,h]:[x,add(add(y,a),[0,6]),w,b];
  let d=root?sd:null;if(!d){d=document.createElement('div');d.className='pnDiv';d.title='Drag to resize · double-click to make both panes the same size';box.appendChild(d);bindDiv(d)}
  d.classList.toggle('h',!v);d._node=n;placeEl(d,rd);d.style.display='block';walk(n.a,ra);walk(n.b,rb)};
 walk(PN.tree,[[0,0],[0,0],[1,0],[1,0]],true);
 box.classList.toggle('h',PN.tree.o==='h');mc.classList.add('pnAct');
 for(const P of pool)if(P.wrap)P.wrap.classList.toggle('pnOn',used.has(P.wrap));
 box.classList.toggle('actB',PN.act!==firstLeaf(PN.tree))}
const firstLeaf=n=>n.t==='l'?n.s:firstLeaf(n.a);
function nodeRect(n){const B=$('#splitBox').getBoundingClientRect(),r=n._r,f=(l,s)=>l[0]*s+l[1];return{x:B.left+f(r[0],B.width),y:B.top+f(r[1],B.height),w:f(r[2],B.width),h:f(r[3],B.height)}}
function bindDiv(d){d.addEventListener('pointerdown',e=>{const n=d._node;if(!n)return;e.preventDefault();const R=nodeRect(n);
  const mv=ev=>{const f=n.o==='h'?1-(ev.clientY-R.y)/R.h:1-(ev.clientX-R.x)/R.w;n.r=clamp(f,.15,.85);if(n===PN.tree)V.splitRatio=n.r;layout()};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);saveV();scheduleRender();p2RenderVisible();drawRulers()};addEventListener('pointermove',mv);addEventListener('pointerup',up)});
 d.addEventListener('dblclick',e=>{e.preventDefault();const n=d._node;if(!n)return;n.r=.5;if(n===PN.tree){V.splitRatio=.5;saveV()}layout();scheduleRender();p2RenderVisible();setTimeout(drawRulers,30)})}
function applyRatio(){layout()}
function navNotify(){try{window.PMDrafting&&PMDrafting.navState()}catch(e){}}
// a passive pane box: tabs strip + viewer
function getPane(){let P=pool.find(Q=>Q.wrap&&!Object.values(PN.at).includes(Q));if(P)return P;
 const w=document.createElement('div');w.className='vw2wrap';w.innerHTML='<div class="p2bar"><div class="tabBar2"></div></div><div class="vw2"><div class="pages2"></div></div>';$('#splitBox').appendChild(w);
 P={tabId:null,zoom:1,pages:[],rot:0,io:null};pool.push(P);bindPane(P,w);return P}
function freePane(P){if(!P)return;if(P.io)P.io.disconnect();P.io=null;if(P.cont)P.cont.innerHTML='';P.pages=[];P.tabId=null;if(P.wrap)P.wrap.classList.remove('pnOn')}
function openSplit(o){if(!S.pdf)return toast('Open a PDF first');
 if(P2.on)return splitActive(o||V.orient);   // already split: split the pane you are working in again
 if(o)V.orient=o;saveV();const box=$('#splitBox');
 P2.on=true;PN.act=0;box.classList.add('on');const other=tabs.find(t=>t.id!==curTab),id=other?other.id:curTab;
 PN.ids=[tabs.filter(t=>t.id!==id||id===curTab).map(t=>t.id),[id]];PN.at={1:P2};PN.tree={t:'s',o:V.orient,r:V.splitRatio,a:{t:'l',s:0},b:{t:'l',s:1}};
 layout();placeTabBar();p2Show(P2,id);renderTabs();scheduleRender();renderViewBtns();setTimeout(drawRulers,30)}
function findParent(n,s,par){if(!n)return null;if(n.t==='l')return n.s===s?{node:n,par}:null;return findParent(n.a,s,n)||findParent(n.b,s,n)}
function splitActive(o){const s=PN.act,f=findParent(PN.tree,s,null);if(!f)return;const r=$('#mainCol').getBoundingClientRect();
 if((o==='h'?r.height:r.width)<300)return toast('This pane is too small to split again');if(nSlots()>=8)return toast('That is as many panes as fit');
 const ids=PN.ids[s],other=ids.filter(x=>x!==curTab),id=other.length?lastOf(other):curTab,ns=PN.ids.length;
 PN.ids.push([id]);if(id!==curTab)PN.ids[s]=ids.filter(x=>x!==id);
 const P=getPane();PN.at[ns]=P;const nn={t:'s',o,r:.5,a:{t:'l',s},b:{t:'l',s:ns}};
 if(!f.par)PN.tree=nn;else if(f.par.a===f.node)f.par.a=nn;else f.par.b=nn;
 layout();p2Show(P,id);renderTabs();scheduleRender();p2RenderVisible();renderViewBtns();setTimeout(drawRulers,30)}
// take a passive pane out of the layout (its neighbour grows into the space)
function removeSlot(s){if(!P2.on||s===PN.act)return;if(nSlots()<=2)return closeSplit();
 freePane(PN.at[s]);delete PN.at[s];const f=findParent(PN.tree,s,null);if(f&&f.par){const keep=f.par.a===f.node?f.par.b:f.par.a;
  const g=(n,p)=>{if(!n||n.t==='l')return null;if(n.a===f.par||n.b===f.par)return n;return g(n.a)||g(n.b)};const gp=PN.tree===f.par?null:g(PN.tree);
  if(!gp){PN.tree=keep;if(keep.t==='s'){V.orient=keep.o;V.splitRatio=keep.r;saveV()}}else if(gp.a===f.par)gp.a=keep;else gp.b=keep}
 PN.ids.splice(s,1);const at={};for(const k in PN.at){const n=+k;at[n>s?n-1:n]=PN.at[k]}PN.at=at;if(PN.act>s)PN.act--;
 const rn=n=>{if(n.t==='l'){if(n.s>s)n.s--}else{rn(n.a);rn(n.b)}};rn(PN.tree);
 layout();renderTabs();scheduleRender();p2RenderVisible();renderViewBtns();setTimeout(()=>{drawRulers();window.dispatchEvent(new Event('resize'))},30)}
// closing keeps the ACTIVE pane's document (the editor already shows it)
function closeSplit(){const was=P2.on;P2.on=false;PN.act=0;PN.ids=[[],[]];PN.tree=null;for(const P of pool)freePane(P);PN.at={};$('#splitBox').classList.remove('on');layout();
 placeTabBar();renderTabs();scheduleRender();renderViewBtns();setTimeout(drawRulers,30);if(was)setTimeout(()=>{window.dispatchEvent(new Event('resize'))},30)}
function balance(){V.splitRatio=.5;saveV();const w=n=>{if(n&&n.t==='s'){n.r=.5;w(n.a);w(n.b)}};w(PN.tree);layout();scheduleRender();p2RenderVisible();setTimeout(drawRulers,30)}
function toggleOrient(){V.orient=V.orient==='v'?'h':'v';saveV();if(PN.tree&&PN.tree.t==='s')PN.tree.o=V.orient;$('#splitBox').classList.toggle('h',V.orient==='h');layout();scheduleRender();p2RenderVisible();renderViewBtns()}
function setSync(on){P2.sync=on==null?!P2.sync:!!on;renderViewBtns();if(P2.sync&&P2.on){syncFromMain(true);toast('Panes synchronized — scroll, zoom and page move together')}else if(P2.on)toast('Panes move on their own')}
// make another pane the active one (optionally showing tab `tid` of that pane). Nothing moves on screen.
function activatePane(tid,slot){if(!P2.on)return;
 if(slot==null||slot===PN.act||!PN.at[slot]){const ps=passive();if(!ps.length)return;
  const hit=tid!=null&&(ps.find(([s,P])=>P.tabId===tid)||ps.find(([s])=>PN.ids[s].includes(tid)));slot=hit?hit[0]:ps[0][0]}
 const P=PN.at[slot];if(tid==null||!tabOf(tid))tid=P.tabId;if(tid==null)return;
 const v2=P.v,vr=viewer.getBoundingClientRect(),mv=S.pages.length?anchorAt(vr.left+vr.width/2,vr.top+vr.height/2):null,mz=S.zoom,oldId=curTab,tool=S.tool;
 const same=tid===P.tabId,pv=same?p2Anchor(P):null,pz=P.zoom,inQ=same&&tid!==oldId?P.pages.filter(q=>q.rs&&q.canvas.width>1):[],oldPages=S.pages.slice();
 viewer.style.visibility='hidden';v2.style.visibility='hidden';
 delete PN.at[slot];PN.at[PN.act]=P;PN.act=slot;P.tabId=oldId;if(!PN.ids[slot].includes(tid))PN.ids[slot].push(tid);layout();
 if(tid!==oldId){switchTo(tabOf(tid));
  // the editor reuses what the pane had already drawn, and the pane reuses the editor's drawings, so nothing flashes white
  for(const q of inQ){const p=S.pages[q.num-1];if(!p)continue;const c=q.canvas,rs=q.rs,b=document.createElement('canvas');b.width=b.height=1;c.replaceWith(b);q.canvas=b;q.rs=0;p.canvas.replaceWith(c);p.canvas=c;p.rs=rs}
  p2Show(P,oldId,true)}
 else renderTabs();
 if(mv){P.zoom=mz;for(const q of P.pages)sizePageEl(q.el,q,P.zoom,P.rot);}
 if(tid!==oldId)for(const p of oldPages){const q=P.pages[p.num-1];if(!q||!p.rs||p.canvas.width<=1)continue;const c=p.canvas,b=document.createElement('canvas');b.width=b.height=1;c.replaceWith(b);p.canvas=b;const rs=p.rs;p.rs=0;q.canvas.replaceWith(c);q.canvas=c;q.rs=rs}
 const place=()=>{if(pv){const p=S.pages[clamp(pv.n,1,S.pages.length)-1],r=viewer.getBoundingClientRect();if(p){const keep=P2.sync;P2.sync=false;setZoom(pz,{p,pt:pv.pt,cx:r.left+r.width/2,cy:r.top+r.height/2});P2.sync=keep}}
  if(mv&&!P2.sync)p2ScrollTo(P,mv.p.num,mv.pt,v2.clientWidth/2,v2.clientHeight/2);else if(P2.sync)syncFromMain(true)};
 place();if(tool&&tool!==S.tool)try{setTool(tool)}catch(e){}
 requestAnimationFrame(()=>requestAnimationFrame(()=>{place();viewer.style.visibility='';v2.style.visibility='';p2RenderVisible();scheduleRender();updateCur&&updateCur();renderViewBtns();drawRulers()}))}
// swap the two sides of a split (1.6.3): the panes change places on the screen. Nothing else moves: each keeps its tabs,
// its spot on its sheet, its zoom and its size. With more than two panes, the pane `slot` changes places with its neighbour.
function swapPanes(slot){if(!P2.on||!PN.tree||PN.tree.t!=='s')return false;if(slot==null||!PN.ids[slot])slot=PN.act;
 const find=n=>{if(!n||n.t!=='s')return null;if((n.a.t==='l'&&n.a.s===slot)||(n.b.t==='l'&&n.b.s===slot))return n;return find(n.a)||find(n.b)};
 const n=find(PN.tree)||PN.tree,a=n.a;n.a=n.b;n.b=a;n.r=1-n.r;if(n===PN.tree){V.splitRatio=n.r;saveV()}
 layout();renderTabs();scheduleRender();p2RenderVisible();setTimeout(drawRulers,30);return true}
// move a tab to another pane (`to` = slot; default: the other pane / the active one)
function moveTab(id,to,from){if(!P2.on||!tabOf(id))return;
 if(from==null||!PN.ids[from]||!PN.ids[from].includes(id))from=PN.ids[PN.act].includes(id)&&to!==PN.act?PN.act:PN.ids.findIndex((L,s)=>s!==to&&L.includes(id));
 if(from<0)return;if(to==null||!PN.ids[to])to=from===PN.act?passive()[0][0]:PN.act;if(to===from)return;
 if(!PN.ids[to].includes(id))PN.ids[to].push(id);PN.ids[from]=PN.ids[from].filter(x=>x!==id);const empty=!PN.ids[from].length;
 if(to===PN.act){const P=PN.at[from];if(P&&P.tabId===id&&!empty)p2Show(P,lastOf(PN.ids[from]));if(id!==curTab)switchTo(tabOf(id));if(empty)return removeSlot(from);renderTabs();return}
 if(from===PN.act){if(id===curTab){if(empty){if(nSlots()<=2)return closeSplit();const old=PN.act;activatePane(id,to);return removeSlot(old)}
   const keepV=P2.sync;switchTo(tabOf(lastOf(PN.ids[from])));P2.sync=keepV}}
 else{const P=PN.at[from];if(P&&P.tabId===id&&!empty)p2Show(P,lastOf(PN.ids[from]))}
 p2Show(PN.at[to],id);renderTabs();if(empty&&from!==PN.act)removeSlot(from)}
// close a tab in one pane; the document only closes when no pane shows it any more
function closeInPane(id,slot){if(!P2.on)return closeTab(id);if(slot==null||!PN.ids[slot])slot=PN.act;
 const elsewhere=PN.ids.findIndex((L,s)=>s!==slot&&L.includes(id));if(elsewhere<0)return closeTab(id);
 const rest=PN.ids[slot].filter(x=>x!==id);
 if(!rest.length){if(slot!==PN.act)return removeSlot(slot);if(nSlots()<=2){activatePane();return closeSplit()}
  const old=PN.act;activatePane(id,elsewhere);return removeSlot(old)}
 PN.ids[slot]=rest;if(slot===PN.act&&curTab===id)switchTo(tabOf(lastOf(rest)));else if(slot!==PN.act&&PN.at[slot].tabId===id)p2Show(PN.at[slot],lastOf(rest));renderTabs()}
function p2Show(P,id,quiet){const d=docFor(id);if(!d||!P)return;P.tabId=id;P.rot=d.rot;const cont=P.cont;cont.innerHTML='';if(P.io)P.io.disconnect();
 P.io=new IntersectionObserver(es=>{for(const e of es){const q=P.pages[+e.target.dataset.p-1];if(q)q.vis=e.isIntersecting}p2RenderVisible(P)},{root:P.v,rootMargin:'300px'});
 P.pages=d.pages.map(p=>{const el=document.createElement('div');el.className='pg2';el.dataset.p=p.num;el.innerHTML=`<canvas width="1" height="1"></canvas><svg viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="none"></svg>`;cont.appendChild(el);
  const q={num:p.num,w:p.w,h:p.h,el,canvas:el.querySelector('canvas'),svg:el.querySelector('svg'),rs:0,vis:false};P.io.observe(el);return q});
 const v2=P.v;const p0=P.pages[0];if(p0){const[bw]=boxDims(p0,P.rot);P.zoom=P2.sync?S.zoom:clamp((v2.clientWidth-48)/bw,.05,64)}p2Layout(P);renderTabs();p2Refresh(0,P);
 if(quiet)return;if(P2.sync)syncFromMain(true);else v2.scrollTop=0}
function p2Layout(P,keepView){const d=docFor(P.tabId);if(d)P.rot=d.rot;let a=null;if(keepView)a=p2Anchor(P);
 for(const q of P.pages)sizePageEl(q.el,q,P.zoom,P.rot);if(a)p2ScrollTo(P,a.n,a.pt,a.cx,a.cy);p2RenderVisible(P)}
function p2Anchor(P){const v2=P.v,vr=v2.getBoundingClientRect(),cx=vr.left+vr.width/2,cy=vr.top+vr.height/2;let best=null,bd=1e18;
 for(const q of P.pages){const r=q.el.getBoundingClientRect();const dx=cx<r.left?r.left-cx:cx>r.right?cx-r.right:0,dy=cy<r.top?r.top-cy:cy>r.bottom?cy-r.bottom:0,d=dx+dy;if(d<bd){bd=d;best={q,r}}if(d===0)break}
 if(!best)return null;return{n:best.q.num,pt:pxToPt(best.q.w,best.q.h,P.rot,cx-best.r.left,cy-best.r.top,P.zoom),cx:vr.width/2,cy:vr.height/2}}
function p2ScrollTo(P,n,pt,cx,cy){const q=P.pages[clamp(n,1,P.pages.length)-1];if(!q)return;const v2=P.v,px=ptToPx(q.w,q.h,P.rot,pt,P.zoom);v2.scrollLeft=q.el.offsetLeft+px[0]-cx;v2.scrollTop=q.el.offsetTop+px[1]-cy}
function p2Zoom(P,z,a){P.zoom=clamp(z,.05,64);const an=a||p2Anchor(P);for(const q of P.pages)sizePageEl(q.el,q,P.zoom,P.rot);if(an)p2ScrollTo(P,an.n,an.pt,an.cx,an.cy);p2RenderVisible(P);if(P2.sync)syncFromP2(P)}
function p2Kick(){try{window.PMSharp&&PMSharp.run2&&PMSharp.run2()}catch(e){}}
function p2RenderVisible(P){if(!P){for(const Q of panesOn())p2RenderVisible(Q);return}clearTimeout(P.rT);P.rT=setTimeout(()=>{const d=docFor(P.tabId);if(!d||!d.pdf)return;for(const q of P.pages){if(q.vis)p2RenderPage(P,q,d.pdf);else if(q.rs){q.canvas.width=1;q.canvas.height=1;q.rs=0}}p2Kick()},120)}
async function p2RenderPage(P,q,pdf){const dpr=Math.min(window.devicePixelRatio||1,3),s=Math.min(P.zoom*dpr,Math.sqrt(16e6/(q.w*q.h)),8192/Math.max(q.w,q.h));if(Math.abs((q.rs||0)-s)<1e-3)return;if(q.task){if(Math.abs(q.ts-s)<1e-3)return;try{q.task.cancel()}catch(e){}}
 const page=await pdf.getPage(q.num),vp=page.getViewport({scale:s}),c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);const task=page.render({canvasContext:c.getContext('2d'),viewport:vp});q.task=task;q.ts=s;
 try{await task.promise;if(!q.el.isConnected)return;q.canvas.replaceWith(c);q.canvas=c;q.rs=s;p2Kick()}catch(e){}finally{if(q.task===task)q.task=null}}
// pane 2 shows the markups only (selection handles belong to the active pane)
function p2Svg(d,n){if(d.cur){const p=S.pages[n-1];return p?p.svg.innerHTML:''}const keep=S.scales;S.scales=d.scales||{};try{let h='';for(const m of d.markups||[])if(m.page===n&&!m.hidden)h+=markupSvg(m);return h}finally{S.scales=keep}}
function p2Refresh(n,only){if(!P2.on)return;for(const P of only?[only]:panesOn()){const d=docFor(P.tabId);if(!d)continue;for(const q of P.pages){if(n&&q.num!==n)continue;q.svg.innerHTML=p2Svg(d,q.num);if(d.cur)q.svg.querySelectorAll('.hd,[pointer-events="none"][stroke="#3d8bfd"]').forEach(e=>e.remove())}}}
const _rp=redrawPage;redrawPage=function(n){_rp.apply(this,arguments);if(P2.on)for(const P of panesOn())if(P.tabId===curTab)p2Refresh(n,P)};
H.change.push(()=>{if(P2.on){clearTimeout(p2Refresh.t);p2Refresh.t=setTimeout(()=>p2Refresh(),60)}});
function syncPane(P,a){if(Math.abs(P.zoom-S.zoom)>1e-4){P.zoom=S.zoom;for(const q of P.pages)sizePageEl(q.el,q,P.zoom,P.rot)}p2ScrollTo(P,a.p.num,a.pt,P.v.clientWidth/2,P.v.clientHeight/2);p2RenderVisible(P)}
function syncFromMain(force,except){if(!P2.on||!(P2.sync||force)||P2.lock||!S.pages.length)return;const vr=viewer.getBoundingClientRect(),a=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);if(!a)return;
 P2.lock=true;for(const P of panesOn())if(P!==except)syncPane(P,a);requestAnimationFrame(()=>requestAnimationFrame(()=>{P2.lock=false}))}
function syncFromP2(P){if(!P2.on||!P2.sync||P2.lock||!S.pages.length||!P)return;const a=p2Anchor(P);if(!a)return;const p=S.pages[clamp(a.n,1,S.pages.length)-1];
 P2.lock=true;const vr=viewer.getBoundingClientRect();lockSync=true;const keep=P2.sync;P2.sync=false;setZoom(P.zoom,{p,pt:a.pt,cx:vr.left+vr.width/2,cy:vr.top+vr.height/2});P2.sync=keep;
 if(p.num!==S.cur){S.cur=p.num;updateCurUI()}
 const ma=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);if(ma)for(const Q of panesOn())if(Q!==P)syncPane(Q,ma);
 requestAnimationFrame(()=>requestAnimationFrame(()=>{P2.lock=false;lockSync=false}))}
/* ================= rulers ================= */
let rulerRaf=0;function drawRulers(){if(!V.rulers)return;if(rulerRaf)return;rulerRaf=requestAnimationFrame(()=>{rulerRaf=0;_drawRulers()})}
function niceStep(min){const p=Math.pow(10,Math.floor(Math.log10(min))),f=min/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p}
function _drawRulers(){const T_=$('#rulerT'),L_=$('#rulerL');if(!T_||!S.pages.length){[T_,L_].forEach(c=>{if(c){const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height)}});return}
 const p=S.pages[S.cur-1];if(!p)return;const r=p.el.getBoundingClientRect(),sc=scaleFor(S.cur),um=sc.unit==='ftin'?0.3048:UNITS[sc.unit].m,ulab=sc.unit==='ftin'?"'":UNITS[sc.unit].abbr;
 const upx=sc.perPt/(S.zoom*um);// real units per screen px
 const step=niceStep(70*upx),minor=step/5,col=getComputedStyle(document.body).getPropertyValue('--mut')||'#999',txt=getComputedStyle(document.body).getPropertyValue('--text')||'#ddd';
 const dpr=window.devicePixelRatio||1;
 for(const[c,horiz]of[[T_,true],[L_,false]]){const br=c.getBoundingClientRect();c.width=Math.max(1,br.width*dpr);c.height=Math.max(1,br.height*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,br.width,br.height);
  const len=horiz?br.width:br.height,org=horiz?r.left-br.left:r.top-br.top;x.strokeStyle=col;x.fillStyle=txt;x.font='9px system-ui,sans-serif';x.lineWidth=1;x.beginPath();
  const v0=Math.floor((-org)*upx/minor)*minor,v1=(len-org)*upx;let i=0;
  for(let v=v0;v<=v1&&i<4000;v+=minor,i++){const s=org+v/upx;const major=Math.abs(v/step-Math.round(v/step))<1e-6;const tl=major?10:(Math.abs(v/(step/2)-Math.round(v/(step/2)))<1e-6?6:3);
   if(horiz){x.moveTo(s+.5,20);x.lineTo(s+.5,20-tl)}else{x.moveTo(20,s+.5);x.lineTo(20-tl,s+.5)}
   if(major){const lab=(Math.round(v*1000)/1000)+(Math.abs(v)<1e-9?'':ulab);if(horiz)x.fillText(lab,s+2,9);else{x.save();x.translate(9,s-2);x.rotate(-Math.PI/2);x.fillText(lab,0,0);x.restore()}}}
  x.stroke();if(rulerMouse){const m=horiz?rulerMouse[0]-br.left:rulerMouse[1]-br.top;x.strokeStyle='#ff3b6b';x.beginPath();if(horiz){x.moveTo(m+.5,0);x.lineTo(m+.5,20)}else{x.moveTo(0,m+.5);x.lineTo(20,m+.5)}x.stroke()}}}
let rulerMouse=null;
function setRulers(on){V.rulers=on;saveV();$('#mainPane').classList.toggle('ruled',on);renderViewBtns();setTimeout(()=>{scheduleRender();drawRulers()},30)}
/* ================= dimmer / theme ================= */
function setDim(v){V.dim=clamp(+v||0,0,.9);saveV();dimCss.textContent=V.dim?`#viewer .page>canvas,.vw2 .pg2>canvas{opacity:${(1-V.dim).toFixed(2)}}`:''}
function setTheme(t){V.theme=t;saveV();document.body.classList.toggle('light',t==='light');drawRulers();renderViewBtns()}
/* ================= zoom box, actual size, zoom to selection ================= */
let zbox=null,zboxOn=false;
function zoomBoxMode(on){zboxOn=on;viewer.classList.toggle('c-zoombox',on);renderViewBtns();if(on)$('#hint').textContent='Zoom: drag a box to zoom into · click to zoom in · Alt+click to zoom out · Esc to stop';else updateRibbon()}
viewer.addEventListener('pointerdown',e=>{if(!zboxOn||e.button!==0)return;e.preventDefault();e.stopPropagation();zbox={x:e.clientX,y:e.clientY,alt:e.altKey};const d=$('#zoomRect');d.style.display='block';Object.assign(d.style,{left:e.clientX+'px',top:e.clientY+'px',width:'0',height:'0'})},true);
window.addEventListener('pointermove',e=>{if(!zbox)return;const d=$('#zoomRect');Object.assign(d.style,{left:Math.min(zbox.x,e.clientX)+'px',top:Math.min(zbox.y,e.clientY)+'px',width:Math.abs(e.clientX-zbox.x)+'px',height:Math.abs(e.clientY-zbox.y)+'px'})},true);
window.addEventListener('pointerup',e=>{if(!zbox)return;const z=zbox;zbox=null;$('#zoomRect').style.display='none';const w=Math.abs(e.clientX-z.x),h=Math.abs(e.clientY-z.y),vr=viewer.getBoundingClientRect();
 if(w<6&&h<6){const a=anchorAt(e.clientX,e.clientY);setZoom(S.zoom*(z.alt||e.altKey?.5:2),a)}
 else{const cx=(z.x+e.clientX)/2,cy=(z.y+e.clientY)/2,a=anchorAt(cx,cy),f=Math.min(vr.width/w,vr.height/h)*.95;if(a){a.cx=vr.left+vr.width/2;a.cy=vr.top+vr.height/2}setZoom(S.zoom*f,a)}
 zoomBoxMode(false);e.stopPropagation()},true);
function actualSize(){setZoom(96/72);toast('Actual size — 1 inch on paper = 1 inch on screen (approx., depends on your monitor)')}
function zoomToSelection(){const ms=[...S.sel].map(byId).filter(Boolean);if(!ms.length)return toast('Select a markup first');const pg=ms[0].page,bs=ms.filter(m=>m.page===pg).map(bboxOf);
 const b=[Math.min(...bs.map(x=>x[0])),Math.min(...bs.map(x=>x[1])),Math.max(...bs.map(x=>x[2])),Math.max(...bs.map(x=>x[3]))],p=S.pages[pg-1];const[bw,bh]=curRot%180?[b[3]-b[1],b[2]-b[0]]:[b[2]-b[0],b[3]-b[1]];
 const vr=viewer.getBoundingClientRect(),z=clamp(Math.min(vr.width*.8/Math.max(bw,4),vr.height*.8/Math.max(bh,4)),.05,24);if(pg!==S.cur){S.cur=pg;updateCurUI()}
 setZoom(z,{p,pt:[(b[0]+b[2])/2,(b[1]+b[3])/2],cx:vr.left+vr.width/2,cy:vr.top+vr.height/2})}
/* ================= magnifier ================= */
let loupeOn=false;function setLoupe(on){loupeOn=on;$('#loupe').style.display='none';renderViewBtns();if(on)toast('Magnifier on — move over the drawing (M to turn off)')}
function drawLoupe(e){const lp=$('#loupe');if(!loupeOn||!S.pages.length){lp.style.display='none';return}const p=pageFromEvent(e);const r0=p&&p.el.getBoundingClientRect();
 if(!p||!(e.clientX>=r0.left&&e.clientX<=r0.right&&e.clientY>=r0.top&&e.clientY<=r0.bottom)){lp.style.display='none';return}
 const pt=toPt(e,p),mag=3,D=220,half=D/(2*S.zoom*mag);lp.style.display='block';lp.style.left=(e.clientX-D/2)+'px';lp.style.top=(e.clientY-D/2)+'px';
 let c=lp.querySelector('canvas'),sv=lp.querySelector('svg');if(!c){lp.innerHTML=`<canvas width="${D}" height="${D}"></canvas><svg preserveAspectRatio="none"></svg>`;c=lp.querySelector('canvas');sv=lp.querySelector('svg')}
 const x=c.getContext('2d'),rs=p.rs||0;x.setTransform(1,0,0,1,0,0);x.fillStyle='#fff';x.fillRect(0,0,D,D);x.translate(D/2,D/2);x.rotate(curRot*Math.PI/180);x.translate(-D/2,-D/2);
 if(rs&&p.canvas.width>1)x.drawImage(p.canvas,(pt[0]-half)*rs,(pt[1]-half)*rs,2*half*rs,2*half*rs,0,0,D,D);
 sv.setAttribute('viewBox',`${pt[0]-half} ${pt[1]-half} ${2*half} ${2*half}`);sv.style.transform=`rotate(${curRot}deg)`;sv.innerHTML=p.svg.innerHTML}
/* ================= toolbar, dialog, keys ================= */
function renderViewBtns(){const set=(id,on)=>{const b=$('#'+id);if(b)b.classList.toggle('vbtn-on',!!on)};set('bSplit',P2.on);set('bRul',V.rulers);set('bZbox',zboxOn);set('bLoupe',loupeOn);navNotify()}
function viewsDialog(){const m=mode();
 modal('Display',`<div class="sec" style="margin-top:0">Page display</div>
 <div class="row fld"><select class="ti" id="dvM">${[['continuous','Continuous'],['single','Single page'],['2up','Two pages side by side'],['2upc','Two pages, continuous']].map(([v,l])=>`<option value="${v}" ${m===v?'selected':''}>${l}</option>`).join('')}</select><label class="chk" style="flex:0 0 auto"><input type="checkbox" id="dvC" ${V.cover?'checked':''}> Cover page</label></div>
 <div class="sec">Split screen</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" id="dvSV" style="border:1px solid var(--line)">Side by side</button><button class="btn" id="dvSH" style="border:1px solid var(--line)">Top / bottom</button>${P2.on?'<button class="btn" id="dvSX" style="border:1px solid var(--line)">Close split</button>':''}</div>
 <div class="hint" style="margin-top:4px">Each pane has its own tabs — click a pane to work in it, drag a tab onto the other pane to move it there. Window ▸ Synchronize pans and zooms both together (great for comparing revisions).</div>
 <div class="sec">Rotate view</div><div class="row" style="gap:6px"><button class="btn" id="dvRL" style="border:1px solid var(--line)">⟲ 90° left</button><button class="btn" id="dvRR" style="border:1px solid var(--line)">⟳ 90° right</button><span class="hint">Now ${curRot}° · PDF unchanged</span></div>
 <div class="sec">Zoom</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" id="dvZB" style="border:1px solid var(--line)">Zoom box (Z)</button><button class="btn" id="dvAS" style="border:1px solid var(--line)">Actual size (Ctrl+1)</button><button class="btn" id="dvZS" style="border:1px solid var(--line)">Zoom to selection</button><button class="btn" id="dvMG" style="border:1px solid var(--line)">${loupeOn?'Magnifier off':'Magnifier (M)'}</button></div>
 <div class="sec">Appearance</div><label class="chk fld"><input type="checkbox" id="dvR" ${V.rulers?'checked':''}> Rulers (Ctrl+R)</label>
 <div class="fld"><label>Dimmer — fade the drawing so markups stand out (<span id="dvDv">${Math.round(V.dim*100)}%</span>)</label><input type="range" min="0" max="90" id="dvD" value="${Math.round(V.dim*100)}"></div>
 <div class="row fld"><label class="chk"><input type="radio" name="dvT" value="dark" ${V.theme!=='light'?'checked':''}> Dark</label><label class="chk"><input type="radio" name="dvT" value="light" ${V.theme==='light'?'checked':''}> Light</label></div>
 <div class="hint">Back / Forward: Alt+← / Alt+→ · Tabs: Ctrl+Tab, Ctrl+W · Rotate: Ctrl+Shift+= / Ctrl+Shift+-</div>`,[{label:'Close',cancel:1}]);
 $('#dvM').onchange=e=>setMode(e.target.value);$('#dvC').onchange=e=>{V.cover=e.target.checked;saveV();applyMode();if(mode()==='2up')gotoPage(S.cur,true)};
 $('#dvSV').onclick=()=>{closeModal();openSplit('v')};$('#dvSH').onclick=()=>{closeModal();openSplit('h')};if($('#dvSX'))$('#dvSX').onclick=()=>{closeModal();closeSplit()};
 $('#dvRL').onclick=()=>{closeModal();rotateView(-90)};$('#dvRR').onclick=()=>{closeModal();rotateView(90)};
 $('#dvZB').onclick=()=>{closeModal();zoomBoxMode(true)};$('#dvAS').onclick=()=>{closeModal();actualSize()};$('#dvZS').onclick=()=>{closeModal();zoomToSelection()};$('#dvMG').onclick=()=>{closeModal();setLoupe(!loupeOn)};
 $('#dvR').onchange=e=>setRulers(e.target.checked);$('#dvD').oninput=e=>{setDim(e.target.value/100);$('#dvDv').textContent=e.target.value+'%'};
 $$('#modal input[name=dvT]').forEach(r=>r.onchange=()=>setTheme(r.value))}
H.ribbon.push({label:'Display',title:'Page display, split screen, rotate view, rulers, dimmer, theme, magnifier',icon:'<rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/>',fn:viewsDialog});
document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(modalCb)return;const k=e.key,mod=e.ctrlKey||e.metaKey;
 const stop=()=>{e.preventDefault();e.stopPropagation()};
 if(mod&&(k==='Tab'||k==='PageDown'||k==='PageUp')&&tabs.length>1&&!(k!=='Tab'&&e.altKey)){const L=P2.on?tabs.filter(t=>PN.ids[PN.act].includes(t.id)):tabs;if(L.length<2)return;stop();const i=L.findIndex(t=>t.id===curTab),d=(k==='Tab'?(e.shiftKey?-1:1):k==='PageDown'?1:-1);switchTo(L[(i+d+L.length)%L.length]);return}
 if(mod&&(k==='w'||k==='W'||k==='F4')&&curTab!=null){stop();closeInPane(curTab,PN.act);return}
 if(e.altKey&&k==='ArrowLeft'){stop();navBack();return}if(e.altKey&&k==='ArrowRight'){stop();navFwd();return}
 if(!S.pages.length)return;
 if(mod&&e.shiftKey&&(k==='+'||k==='='||k==='Plus')){stop();rotateView(90);return}if(mod&&e.shiftKey&&(k==='_'||k==='-')){stop();rotateView(-90);return}
 if(mod&&!e.shiftKey&&(k==='r'||k==='R')){stop();setRulers(!V.rulers);return}
 if(mod&&k==='1'){stop();actualSize();return}if(mod&&k==='2'){stop();fitWidth();return}
 if(isTwo()&&!mod&&!e.altKey&&(k==='PageDown'||k==='PageUp')){stop();flip(k==='PageDown'?1:-1);return}
 if(isTwo()&&!mod&&!e.altKey&&!S.sel.size&&(k==='ArrowRight'||k==='ArrowLeft')){stop();flip(k==='ArrowRight'?1:-1);return}
 if(mod||e.altKey)return;
 if(k==='z'||k==='Z'){if(e.shiftKey){stop();zoomToSelection()}else{stop();zoomBoxMode(!zboxOn)}return}
 if(!e.shiftKey&&(k==='m'||k==='M')){stop();setLoupe(!loupeOn);return}
 if(k==='Escape'&&zboxOn){stop();zoomBoxMode(false);return}},true);
/* ================= DOM setup ================= */
function bindBar(el,slotFn){
 el.addEventListener('click',e=>{const s=slotFn(),two=P2.on&&s!==PN.act;const c=e.target.closest('[data-close]');if(c){e.stopPropagation();closeInPane(+c.dataset.close,s);return}
  if(e.target.closest('.tplus')){if(two)activatePane(null,s);$('#fileIn').click();return}const t=e.target.closest('[data-tid]');if(!t)return;
  if(two)activatePane(+t.dataset.tid,s);else switchTo(tabOf(+t.dataset.tid))});
 el.addEventListener('auxclick',e=>{if(e.button!==1)return;const t=e.target.closest('[data-tid]');if(t){e.preventDefault();closeInPane(+t.dataset.tid,slotFn())}});
 el.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});
 el.addEventListener('dragstart',e=>{const t=e.target.closest('[data-tid]');if(t){dragTab=+t.dataset.tid;dragFrom=slotFn();e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain','tab')}catch(_){}}});
 el.addEventListener('dragover',e=>{if(dragTab==null)return;e.preventDefault();$$('.dtab.dragover').forEach(x=>x.classList.remove('dragover'));el.classList.toggle('dragin',slotFn()!==dragFrom);const t=e.target.closest('[data-tid]');if(t)t.classList.add('dragover')});
 el.addEventListener('dragleave',e=>{if(!el.contains(e.relatedTarget))el.classList.remove('dragin')});
 el.addEventListener('drop',e=>{if(dragTab==null)return;e.preventDefault();el.classList.remove('dragin');const id=dragTab,from=dragFrom,to=slotFn();dragTab=null;
  if(P2.on&&to!==from){moveTab(id,to,from);return}   // dropped on another pane's tabs: move it there
  const t=e.target.closest('[data-tid]');if(t){const fi=tabs.findIndex(x=>x.id===id),ti=tabs.findIndex(x=>x.id===+t.dataset.tid);if(fi>=0&&ti>=0){const[m]=tabs.splice(fi,1);tabs.splice(ti,0,m)}}renderTabs()});
 el.addEventListener('dragend',()=>{dragTab=null;$$('.dtab.dragover').forEach(x=>x.classList.remove('dragover'));$$('.dragin').forEach(x=>x.classList.remove('dragin'))})}
function bindPane(P,w){P.wrap=w;P.bar=w.querySelector('.tabBar2');P.v=w.querySelector('.vw2');P.cont=w.querySelector('.pages2');const v2=P.v;
 bindBar(P.bar,()=>{const s=slotOf(P);return s==null?-1:s});
 // clicking anywhere in another pane makes it the active pane
 v2.addEventListener('pointerdown',e=>{if(!P2.on||e.pointerType==='touch'||slotOf(P)==null)return;const L=e.button===0;if(L){e.preventDefault();e.stopPropagation()}
  // like Bluebeam, one click both makes this pane active and does what the click means (draw, select, pan...):
  // the pane swaps into the editor, then the same press is replayed on what is now under the mouse
  const x=e.clientX,y=e.clientY,o0={shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,pointerId:e.pointerId,pointerType:e.pointerType,isPrimary:true};let up=false;const onUp=()=>{up=true};
  if(L)window.addEventListener('pointerup',onUp,true);activatePane(null,slotOf(P));if(!L)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{window.removeEventListener('pointerup',onUp,true);const hit=document.elementFromPoint(x,y);if(P2.on&&hit&&hit.closest('.vw2'))return;
   const el=hit;if(!el||!el.closest('#viewer'))return;const o={bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,button:0,buttons:up?0:1,...o0};
   el.dispatchEvent(new PointerEvent('pointerdown',o));if(up){window.dispatchEvent(new PointerEvent('pointerup',Object.assign({},o,{buttons:0})));el.dispatchEvent(new MouseEvent('click',o))}}))},true);
 v2.addEventListener('click',e=>{if(P2.on&&e.target.closest('.vw2'))e.stopPropagation()},true);
 let tTap=null;v2.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'||!P2.on)return;if(tTap&&Math.hypot(e.clientX-tTap[0],e.clientY-tTap[1])<8)activatePane(null,slotOf(P));tTap=null});
 v2.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')tTap=[e.clientX,e.clientY]});
 v2.addEventListener('scroll',()=>{p2RenderVisible(P);if(P2.sync&&!P2.lock){cancelAnimationFrame(v2._r);v2._r=requestAnimationFrame(()=>syncFromP2(P))}},{passive:true});
 v2.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey||(settings.wheelZoom&&!e.shiftKey)){if(e.defaultPrevented)return;e.preventDefault();const vr=v2.getBoundingClientRect();const a=p2Anchor(P);// anchor at cursor
   let an=null;for(const q of P.pages){const r=q.el.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){an={n:q.num,pt:pxToPt(q.w,q.h,P.rot,e.clientX-r.left,e.clientY-r.top,P.zoom),cx:e.clientX-vr.left,cy:e.clientY-vr.top};break}}
   const k=e.ctrlKey&&Math.abs(e.deltaY)<40?0.01:0.0018;p2Zoom(P,P.zoom*Math.exp(-(e.deltaMode===1?e.deltaY*30:e.deltaY)*k),an||a)}},{passive:false});
 // pinch
 const pp=new Map();let pin=null;v2.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pp.set(e.pointerId,[e.clientX,e.clientY]);if(pp.size===2){const[a,b]=[...pp.values()];pin={d:Math.hypot(a[0]-b[0],a[1]-b[1]),z:P.zoom}}});
 v2.addEventListener('pointermove',e=>{if(!pp.has(e.pointerId))return;pp.set(e.pointerId,[e.clientX,e.clientY]);if(pin&&pp.size===2){const[a,b]=[...pp.values()];p2Zoom(P,pin.z*Math.hypot(a[0]-b[0],a[1]-b[1])/pin.d)}});
 const endp=e=>{pp.delete(e.pointerId);if(pp.size<2)pin=null};v2.addEventListener('pointerup',endp);v2.addEventListener('pointercancel',endp)}
function setupDom(){const main=$('#main'),vw=$('#viewer');const wrap=document.createElement('div');wrap.id='viewWrap';
 wrap.innerHTML=`<div id="tabBar"></div><div id="splitBox"><div id="mainCol"><div id="mainPane"><canvas id="rulerT"></canvas><canvas id="rulerL"></canvas><div id="rulerC"></div></div></div><div id="splitDiv" class="pnDiv" title="Drag to resize · double-click to make both panes the same size"></div>
 <div id="viewer2wrap" class="vw2wrap"><div id="p2bar" class="p2bar"><div id="tabBar2" class="tabBar2"></div></div><div id="viewer2" class="vw2"><div id="pages2" class="pages2"></div></div></div></div>`;
 main.insertBefore(wrap,vw);$('#mainPane').appendChild(vw);
 const z=document.createElement('div');z.id='zoomRect';document.body.appendChild(z);const l=document.createElement('div');l.id='loupe';document.body.appendChild(l);
 // top bar: back / forward / rotate / split / rulers / zoom box / magnifier
 const anchor=$('#bNext');const mk=(id,title,svg)=>{const b=document.createElement('button');b.className='btn';b.id=id;b.title=title;b.innerHTML=`<svg viewBox="0 0 24 24">${svg}</svg>`;return b};
 const sep=()=>{const s=document.createElement('div');s.className='sep';return s};
 const items=[sep(),mk('bBack','Back (Alt+←)','<path d="M11 6l-6 6 6 6M5 12h14"/>'),mk('bFwd','Forward (Alt+→)','<path d="M13 6l6 6-6 6M19 12H5"/>'),sep(),mk('bRotL','Rotate view left (Ctrl+Shift+-)','<path d="M4 9a8 8 0 112 8"/><path d="M4 4v5h5"/>'),mk('bRotR','Rotate view right (Ctrl+Shift+=)','<path d="M20 9a8 8 0 10-2 8"/><path d="M20 4v5h-5"/>'),
  mk('bSplit','Split screen','<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M12 4v16"/>'),mk('bRul','Rulers (Ctrl+R)','<path d="M3 3h18v5H8v13H3z"/><path d="M7 3v3M11 3v3M15 3v3M3 12h3M3 16h3"/>'),mk('bZbox','Zoom box (Z)','<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/><rect x="7" y="7" width="6" height="6" stroke-dasharray="2 1.5"/>'),mk('bLoupe','Magnifier (M)','<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5M10 7v6M7 10h6"/>')];
 let ref=anchor.nextSibling;for(const it of items)anchor.parentNode.insertBefore(it,ref);
 $('#bBack').onclick=navBack;$('#bFwd').onclick=navFwd;$('#bRotL').onclick=()=>rotateView(-90);$('#bRotR').onclick=()=>rotateView(90);$('#bSplit').onclick=()=>P2.on?closeSplit():openSplit();
 $('#bRul').onclick=()=>setRulers(!V.rulers);$('#bZbox').onclick=()=>zoomBoxMode(!zboxOn);$('#bLoupe').onclick=()=>setLoupe(!loupeOn);
 // tabs (in split view each pane has its own strip: #tabBar = the active pane, .tabBar2 = each other pane)
 bindBar($('#tabBar'),()=>PN.act);
 // the first passive pane already exists in the page
 bindPane(P2,$('#viewer2wrap'));
 bindDiv($('#splitDiv'));
 // keep things in step
 viewer.addEventListener('scroll',()=>{drawRulers();if(P2.on&&P2.sync&&!lockSync){cancelAnimationFrame(viewer._r2);viewer._r2=requestAnimationFrame(()=>syncFromMain())}},{passive:true});
 viewer.addEventListener('pointermove',e=>{if(V.rulers){rulerMouse=[e.clientX,e.clientY];drawRulers()}if(loupeOn)drawLoupe(e)},{passive:true});
 viewer.addEventListener('pointerleave',()=>{rulerMouse=null;drawRulers();$('#loupe').style.display='none'});
 window.addEventListener('resize',()=>{drawRulers();if(P2.on)p2RenderVisible()});
 new ResizeObserver(()=>{placeTabBar();drawRulers();scheduleRender();if(P2.on)p2RenderVisible()}).observe($('#splitBox'));
 const _us=updateScaleBtn;updateScaleBtn=function(){_us.apply(this,arguments);drawRulers()};
 $('#mainPane').classList.toggle('ruled',!!V.rulers);document.body.classList.toggle('light',V.theme==='light');setDim(V.dim);renderTabs();renderNavBtns();renderViewBtns()}
H.ready.push(setupDom);
H.prefs.push(()=>{Object.assign(V,settings.view||{});document.body.classList.toggle('light',V.theme==='light');setDim(V.dim);$('#mainPane')&&$('#mainPane').classList.toggle('ruled',!!V.rulers);applyMode();renderViewBtns()});
window.PMViews={get tabs(){return tabs},get curTab(){return curTab},switchTo:id=>{if(P2.on&&!PN.ids[PN.act].includes(id)&&PN.ids.some(L=>L.includes(id)))activatePane(id);else switchTo(tabOf(id))},closeTab,closeInPane,openSplit,closeSplit,activatePane,moveTab,swapPanes,paneOf,balance,toggleOrient,setSync,get act(){return PN.act},get panes(){return panesOn()},get slots(){return nSlots()},slotOfBar:el=>{if(!el)return PN.act;if(el.id==='tabBar')return PN.act;const P=pool.find(Q=>Q.bar===el);const s=P?slotOf(P):null;return s==null?PN.act:s},splitActive,removeSlot,get paneIds(){return PN.ids.map(x=>x.slice())},rotateView,setMode,flip,navBack,navFwd,setRulers,setDim,setTheme,zoomBoxMode,actualSize,zoomToSelection,setLoupe,P2,V,get rot(){return curRot},ptToPx,pxToPt};
})();
