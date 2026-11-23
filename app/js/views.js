/* PlanMark — views: document tabs, split screen with sync, page display modes, rotate view,
   rulers, dimmer, navigation history, zoom box / actual size / zoom to selection, light theme, magnifier */
(function(){
const V=Object.assign({rulers:false,dim:0,theme:'dark',cover:false,splitRatio:.5,orient:'v'},settings.view||{});
function saveV(){settings.view=Object.assign({},V);LS.set('pm:settings',settings)}
const css=document.createElement('style');document.head.appendChild(css);
css.textContent=`
#viewWrap{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
#tabBar{display:flex;align-items:stretch;gap:1px;background:var(--bg);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:thin;flex-shrink:0;min-height:30px}
#tabBar .dtab,#tabBar2 .dtab{display:flex;align-items:center;gap:6px;padding:0 6px 0 12px;max-width:220px;min-width:90px;background:var(--panel);color:var(--mut);cursor:pointer;border-top:2px solid transparent;font-size:12px;user-select:none}
#tabBar .dtab.on,#tabBar2 .dtab.on{background:var(--panel2);color:var(--text);border-top-color:var(--acc)}
#tabBar .dtab .nm,#tabBar2 .dtab .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tabBar .dtab .cx,#tabBar2 .dtab .cx{border:0;background:none;color:inherit;opacity:.55;cursor:pointer;padding:2px 4px;border-radius:4px}
#tabBar .dtab .cx:hover,#tabBar2 .dtab .cx:hover{opacity:1;background:rgba(127,127,127,.25)}
#tabBar .dtab.dragover,#tabBar2 .dtab.dragover{box-shadow:inset 3px 0 0 var(--acc)}
#tabBar .tplus,#tabBar2 .tplus{border:0;background:none;color:var(--mut);font-size:18px;padding:0 12px;cursor:pointer}
#splitBox{flex:1;display:flex;min-height:0;min-width:0;position:relative}
#splitBox.h{flex-direction:column}
#mainCol{flex:1 1 0;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative}
#splitBox.on #mainCol::after{content:'';position:absolute;inset:0;border:2px solid var(--acc);pointer-events:none;z-index:6}
#splitBox.on #viewer2wrap{border:0}
#splitBox.on #viewer2{cursor:default}
#tabBar2{display:flex;align-items:stretch;gap:1px;overflow-x:auto;scrollbar-width:thin;flex:1;min-width:0;min-height:30px}
#tabBar.dragin,#tabBar2.dragin{box-shadow:inset 0 0 0 2px var(--acc)}
#splitBox.on #viewer2wrap #tabBar2 .dtab.on{border-top-color:var(--mut)}
body.dl #p2bar{background:#1f1f1f}
#mainPane{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative}
#mainPane.ruled{padding:20px 0 0 20px}
#viewer2wrap{display:none;flex-direction:column;min-width:0;min-height:0;position:relative;border-left:1px solid var(--line)}
#splitBox.h #viewer2wrap{border-left:0;border-top:1px solid var(--line)}
#splitBox.on #viewer2wrap{display:flex}
#splitDiv{display:none;flex:0 0 6px;background:var(--line);cursor:col-resize;touch-action:none}
#splitBox.on #splitDiv{display:block}
#splitBox.h #splitDiv{cursor:row-resize}
#p2bar{display:flex;align-items:stretch;background:var(--bg);border-bottom:1px solid var(--line);flex-shrink:0}
#p2bar select{max-width:180px;height:26px}
#p2bar .btn{height:26px;padding:0 6px;border:1px solid var(--line)}
#viewer2{flex:1;overflow:auto;background:var(--canvas);position:relative;min-height:0}
#pages2{display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px;width:max-content;min-width:100%;position:relative}
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
 if(a)a.cx=vr.left+vr.width/2,a.cy=vr.top+vr.height/2;setZoom(S.zoom,a);if(P2.on&&P2.tabId===curTab)p2Layout(true);redrawAll();renderTabs();toast('View rotated '+curRot+'° (the PDF itself is unchanged)')}
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
 setTool('select');applyMode();if(S.pdf)safeOpenHook();buildThumbs();commit(true);renderProps();updateCurUI();updateScaleBtn();updUndo();scheduleRender();renderTabs();drawRulers();p2Refresh()}
function switchTo(t){if(!t||t.id===curTab)return;recordNav();const old=tabOf(curTab);stash(old);curTab=t.id;unstash(t);
 // restore scroll once layout is back
 const sl=t.lastSl,stp=t.lastSt;afterSwitchUI(t);requestAnimationFrame(()=>{viewer.scrollLeft=sl||0;viewer.scrollTop=stp||0;updateCur();syncFromMain()});recordNav()}
// remember scroll per tab (stash() reads viewer scroll before DOM detaches)
const _stash=stash;stash=function(t){if(t){t.lastSl=viewer.scrollLeft;t.lastSt=viewer.scrollTop}return _stash(t)};
async function closeTab(id){let t=tabOf(id);if(!t)return;
 if(P2.on){const a=PN.act,ra=PN.ids[a].filter(x=>x!==id&&tabOf(x)),rb=PN.ids[1-a].filter(x=>x!==id&&tabOf(x));
  if(!ra.length&&!rb.length)closeSplit();
  else if(id===curTab&&!ra.length){activatePane(P2.tabId!==id?P2.tabId:rb[rb.length-1]);PN.ids[1-PN.act]=PN.ids[1-PN.act].filter(x=>x!==id);if(!PN.ids[1-PN.act].length)closeSplit()}
  else if(id===curTab)switchTo(tabOf(ra[ra.length-1]))}
 t=tabOf(id);if(!t)return;const i=tabs.indexOf(t);
 if(id===curTab){const ST=window.PMStudio&&PMStudio.ST;if(ST&&ST.sess)try{PMStudio.leave(false)}catch(e){}
  for(const p of S.pages)io.unobserve(p.el);pagesEl.innerHTML='';try{S.pdf&&S.pdf.destroy()}catch(e){}layersVal.forEach(L=>{try{URL.revokeObjectURL(L.url)}catch(e){}});
  tabs.splice(i,1);const nxt=tabs[i]||tabs[i-1];curTab=null;
  if(nxt){curTab=nxt.id;unstash(nxt);const sl=nxt.lastSl,st=nxt.lastSt;afterSwitchUI(nxt);requestAnimationFrame(()=>{viewer.scrollLeft=sl||0;viewer.scrollTop=st||0;updateCur()})}
  else{blankS();curRot=0;afterSwitchUI(null);$('#pane-pages').innerHTML='<div class="hint">Open a PDF to see page thumbnails.</div>';if(P2.on)closeSplit()}}
 else{tabs.splice(i,1);try{t.st&&t.st.pdf&&t.st.pdf.destroy()}catch(e){}(t.st&&t.st.layers||[]).forEach(L=>{try{URL.revokeObjectURL(L.url)}catch(e){}});t.frag=null}
 if(P2.on){for(const s of[0,1])PN.ids[s]=PN.ids[s].filter(x=>x!==id);if(P2.tabId===id){const L=PN.ids[1-PN.act];if(L.length)p2Show(L[L.length-1]);else closeSplit()}}
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
 const b2=$('#tabBar2');if(b2)b2.innerHTML=P2.on?tabHtml(tabs.filter(t=>PN.ids[1-PN.act].includes(t.id)),P2.tabId):''}
/* ================= split screen =================
   Works like Bluebeam: two full viewers side by side (or top / bottom), each with its own tabs, page, zoom and scroll.
   Click a pane to make it the active one; everything else (thumbnails, markups list, properties, page box, zoom box,
   status bar) follows the active pane. The panes never move: the editing surface (#viewer) always shows the ACTIVE
   pane and the second viewer (#viewer2) draws the other one; when you click the other pane the two boxes trade
   their slot on screen (CSS order) and their documents/views, so what you see stays exactly where it was. */
const P2={on:false,tabId:null,zoom:1,pages:[],sync:false,rot:0,io:null,lock:false};
const PN={act:0,ids:[[],[]]};   // slot 0 = left / top, slot 1 = right / bottom; ids = the tabs of each pane
function docFor(id){if(id===curTab)return{pdf:S.pdf,pages:S.pages,markups:S.markups,scales:S.scales,rot:curRot,cur:true};const t=tabOf(id);if(!t||!t.st)return null;return{pdf:t.st.pdf,pages:t.st.pages,markups:t.st.markups,scales:t.st.scales,rot:t.rot||0,cur:false}}
function paneTidy(){const live=new Set(tabs.map(t=>t.id));for(const s of[0,1])PN.ids[s]=PN.ids[s].filter(id=>live.has(id));const a=PN.act,b=1-a;
 if(curTab!=null&&!PN.ids[a].includes(curTab))PN.ids[a].push(curTab);if(P2.tabId!=null&&!PN.ids[b].includes(P2.tabId))PN.ids[b].push(P2.tabId);
 for(const t of tabs)if(!PN.ids[0].includes(t.id)&&!PN.ids[1].includes(t.id))PN.ids[a].push(t.id)}
function paneOf(id){if(!P2.on)return null;const a=PN.ids[PN.act].includes(id),b=PN.ids[1-PN.act].includes(id);return a&&b?'both':a?'active':b?'other':null}
function placeTabBar(){const bar=$('#tabBar'),mc=$('#mainCol'),sb=$('#splitBox'),vw=$('#viewWrap');if(!bar||!mc||!sb)return;
 const vis=P2.on&&sb.offsetWidth>0&&sb.offsetHeight>0;   // (another module may hide the split box, e.g. the CAD or web views)
 if(vis){if(bar.parentNode!==mc)mc.insertBefore(bar,mc.firstChild)}else if(bar.parentNode!==vw)vw.insertBefore(bar,sb)}
function applyRatio(){const mc=$('#mainCol'),w=$('#viewer2wrap'),d=$('#splitDiv');if(!mc||!w)return;const r=Math.round(V.splitRatio*1000)/10+'%',b=P2.on&&PN.act===1;
 mc.style.order=b?2:0;d.style.order=1;w.style.order=b?0:2;(b?mc:w).style.flex=P2.on?`0 0 calc(${r} - 3px)`:`0 0 ${r}`;(b?w:mc).style.flex='1 1 0';
 mc.classList.toggle('pnAct',P2.on);$('#splitBox').classList.toggle('actB',b)}
function navNotify(){try{window.PMDrafting&&PMDrafting.navState()}catch(e){}}
function openSplit(o){if(!S.pdf)return toast('Open a PDF first');if(o)V.orient=o;saveV();const box=$('#splitBox');box.classList.toggle('h',V.orient==='h');
 if(P2.on){applyRatio();scheduleRender();p2RenderVisible();renderViewBtns();return}
 P2.on=true;PN.act=0;box.classList.add('on');const other=tabs.find(t=>t.id!==curTab),id=other?other.id:curTab;
 PN.ids=[tabs.filter(t=>t.id!==id||id===curTab).map(t=>t.id),[id]];applyRatio();placeTabBar();p2Show(id);renderTabs();scheduleRender();renderViewBtns();setTimeout(drawRulers,30)}
// closing keeps the ACTIVE pane's document (the editor already shows it)
function closeSplit(){const was=P2.on;P2.on=false;PN.act=0;PN.ids=[[],[]];$('#splitBox').classList.remove('on');applyRatio();$('#pages2').innerHTML='';P2.pages=[];if(P2.io)P2.io.disconnect();P2.tabId=null;
 placeTabBar();renderTabs();scheduleRender();renderViewBtns();setTimeout(drawRulers,30);if(was)setTimeout(()=>{window.dispatchEvent(new Event('resize'))},30)}
function balance(){V.splitRatio=.5;saveV();applyRatio();scheduleRender();p2RenderVisible();setTimeout(drawRulers,30)}
function toggleOrient(){V.orient=V.orient==='v'?'h':'v';saveV();$('#splitBox').classList.toggle('h',V.orient==='h');scheduleRender();p2RenderVisible();renderViewBtns()}
function setSync(on){P2.sync=on==null?!P2.sync:!!on;renderViewBtns();if(P2.sync&&P2.on){syncFromMain(true);toast('Panes synchronized — scroll, zoom and page move together')}else if(P2.on)toast('Panes move on their own')}
// make the other pane the active one (optionally showing tab `tid` of that pane). Nothing moves on screen.
function activatePane(tid){if(!P2.on)return;const s=1-PN.act;if(tid==null||!tabOf(tid))tid=P2.tabId;if(tid==null)return;
 const v2=$('#viewer2'),vr=viewer.getBoundingClientRect(),mv=S.pages.length?anchorAt(vr.left+vr.width/2,vr.top+vr.height/2):null,mz=S.zoom,oldId=curTab,tool=S.tool;
 const same=tid===P2.tabId,pv=same?p2Anchor():null,pz=P2.zoom,inQ=same&&tid!==oldId?P2.pages.filter(q=>q.rs&&q.canvas.width>1):[],oldPages=S.pages.slice();
 viewer.style.visibility='hidden';v2.style.visibility='hidden';
 PN.act=s;P2.tabId=oldId;if(!PN.ids[s].includes(tid))PN.ids[s].push(tid);applyRatio();
 if(tid!==oldId){switchTo(tabOf(tid));
  // the editor reuses what pane 2 had already drawn, and pane 2 reuses the editor's drawings, so nothing flashes white
  for(const q of inQ){const p=S.pages[q.num-1];if(!p)continue;const c=q.canvas,rs=q.rs,b=document.createElement('canvas');b.width=b.height=1;c.replaceWith(b);q.canvas=b;q.rs=0;p.canvas.replaceWith(c);p.canvas=c;p.rs=rs}
  p2Show(oldId,true)}
 else renderTabs();
 if(mv){P2.zoom=mz;for(const q of P2.pages)sizePageEl(q.el,q,P2.zoom,P2.rot);}
 if(tid!==oldId)for(const p of oldPages){const q=P2.pages[p.num-1];if(!q||!p.rs||p.canvas.width<=1)continue;const c=p.canvas,b=document.createElement('canvas');b.width=b.height=1;c.replaceWith(b);p.canvas=b;const rs=p.rs;p.rs=0;q.canvas.replaceWith(c);q.canvas=c;q.rs=rs}
 const place=()=>{if(pv){const p=S.pages[clamp(pv.n,1,S.pages.length)-1],r=viewer.getBoundingClientRect();if(p){const keep=P2.sync;P2.sync=false;setZoom(pz,{p,pt:pv.pt,cx:r.left+r.width/2,cy:r.top+r.height/2});P2.sync=keep}}
  if(mv&&!P2.sync)p2ScrollTo(mv.p.num,mv.pt,v2.clientWidth/2,v2.clientHeight/2);else if(P2.sync)syncFromMain(true)};
 place();if(tool&&tool!==S.tool)try{setTool(tool)}catch(e){}
 requestAnimationFrame(()=>requestAnimationFrame(()=>{place();viewer.style.visibility='';v2.style.visibility='';p2RenderVisible();scheduleRender();updateCur&&updateCur();renderViewBtns();drawRulers()}))}
// move a tab to the other pane (or into the active one)
function moveTab(id,to){if(!P2.on||!tabOf(id))return;if(to==null)to=PN.ids[PN.act].includes(id)?1-PN.act:PN.act;const from=1-to;
 if(!PN.ids[to].includes(id))PN.ids[to].push(id);PN.ids[from]=PN.ids[from].filter(x=>x!==id);const empty=!PN.ids[from].length;
 if(to===PN.act){if(P2.tabId===id&&!empty)p2Show(PN.ids[from][PN.ids[from].length-1]);if(id!==curTab)switchTo(tabOf(id));if(empty)return closeSplit();renderTabs();return}
 if(id===curTab){if(empty)return closeSplit();const keepV=P2.sync;switchTo(tabOf(PN.ids[from][PN.ids[from].length-1]));P2.sync=keepV}
 p2Show(id);renderTabs()}
// close a tab in one pane; the document only closes when no pane shows it any more
function closeInPane(id,slot){if(!P2.on)return closeTab(id);if(slot==null)slot=PN.act;const o=1-slot;if(!PN.ids[o].includes(id))return closeTab(id);
 const rest=PN.ids[slot].filter(x=>x!==id);
 if(!rest.length){if(slot===PN.act)activatePane();return closeSplit()}
 PN.ids[slot]=rest;if(slot===PN.act&&curTab===id)switchTo(tabOf(rest[rest.length-1]));else if(slot!==PN.act&&P2.tabId===id)p2Show(rest[rest.length-1]);renderTabs()}
function p2Show(id,quiet){const d=docFor(id);if(!d)return;P2.tabId=id;P2.rot=d.rot;const cont=$('#pages2');cont.innerHTML='';if(P2.io)P2.io.disconnect();
 P2.io=new IntersectionObserver(es=>{for(const e of es){const q=P2.pages[+e.target.dataset.p-1];if(q)q.vis=e.isIntersecting}p2RenderVisible()},{root:$('#viewer2'),rootMargin:'300px'});
 P2.pages=d.pages.map(p=>{const el=document.createElement('div');el.className='pg2';el.dataset.p=p.num;el.innerHTML=`<canvas width="1" height="1"></canvas><svg viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="none"></svg>`;cont.appendChild(el);
  const q={num:p.num,w:p.w,h:p.h,el,canvas:el.querySelector('canvas'),svg:el.querySelector('svg'),rs:0,vis:false};P2.io.observe(el);return q});
 const v2=$('#viewer2');const p0=P2.pages[0];if(p0){const[bw]=boxDims(p0,P2.rot);P2.zoom=P2.sync?S.zoom:clamp((v2.clientWidth-48)/bw,.05,64)}p2Layout();renderTabs();p2Refresh();
 if(quiet)return;if(P2.sync)syncFromMain(true);else v2.scrollTop=0}
function p2Layout(keepView){const d=docFor(P2.tabId);if(d)P2.rot=d.rot;let a=null;if(keepView)a=p2Anchor();
 for(const q of P2.pages)sizePageEl(q.el,q,P2.zoom,P2.rot);if(a)p2ScrollTo(a.n,a.pt,a.cx,a.cy);p2RenderVisible()}
function p2Anchor(){const v2=$('#viewer2'),vr=v2.getBoundingClientRect(),cx=vr.left+vr.width/2,cy=vr.top+vr.height/2;let best=null,bd=1e18;
 for(const q of P2.pages){const r=q.el.getBoundingClientRect();const dx=cx<r.left?r.left-cx:cx>r.right?cx-r.right:0,dy=cy<r.top?r.top-cy:cy>r.bottom?cy-r.bottom:0,d=dx+dy;if(d<bd){bd=d;best={q,r}}if(d===0)break}
 if(!best)return null;return{n:best.q.num,pt:pxToPt(best.q.w,best.q.h,P2.rot,cx-best.r.left,cy-best.r.top,P2.zoom),cx:vr.width/2,cy:vr.height/2}}
function p2ScrollTo(n,pt,cx,cy){const q=P2.pages[clamp(n,1,P2.pages.length)-1];if(!q)return;const v2=$('#viewer2'),px=ptToPx(q.w,q.h,P2.rot,pt,P2.zoom);v2.scrollLeft=q.el.offsetLeft+px[0]-cx;v2.scrollTop=q.el.offsetTop+px[1]-cy}
function p2Zoom(z,a){P2.zoom=clamp(z,.05,64);const an=a||p2Anchor();for(const q of P2.pages)sizePageEl(q.el,q,P2.zoom,P2.rot);if(an)p2ScrollTo(an.n,an.pt,an.cx,an.cy);p2RenderVisible();if(P2.sync)syncFromP2()}
function p2Kick(){try{window.PMSharp&&PMSharp.run2&&PMSharp.run2()}catch(e){}}
let p2rT=0;function p2RenderVisible(){clearTimeout(p2rT);p2rT=setTimeout(()=>{const d=docFor(P2.tabId);if(!d||!d.pdf)return;for(const q of P2.pages){if(q.vis)p2RenderPage(q,d.pdf);else if(q.rs){q.canvas.width=1;q.canvas.height=1;q.rs=0}}p2Kick()},120)}
async function p2RenderPage(q,pdf){const dpr=Math.min(window.devicePixelRatio||1,3),s=Math.min(P2.zoom*dpr,Math.sqrt(16e6/(q.w*q.h)),8192/Math.max(q.w,q.h));if(Math.abs((q.rs||0)-s)<1e-3)return;if(q.task){if(Math.abs(q.ts-s)<1e-3)return;try{q.task.cancel()}catch(e){}}
 const page=await pdf.getPage(q.num),vp=page.getViewport({scale:s}),c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);const task=page.render({canvasContext:c.getContext('2d'),viewport:vp});q.task=task;q.ts=s;
 try{await task.promise;if(!q.el.isConnected)return;q.canvas.replaceWith(c);q.canvas=c;q.rs=s;p2Kick()}catch(e){}finally{if(q.task===task)q.task=null}}
// pane 2 shows the markups only (selection handles belong to the active pane)
function p2Svg(d,n){if(d.cur){const p=S.pages[n-1];return p?p.svg.innerHTML:''}const keep=S.scales;S.scales=d.scales||{};try{let h='';for(const m of d.markups||[])if(m.page===n&&!m.hidden)h+=markupSvg(m);return h}finally{S.scales=keep}}
function p2Refresh(n){if(!P2.on)return;const d=docFor(P2.tabId);if(!d)return;for(const q of P2.pages){if(n&&q.num!==n)continue;q.svg.innerHTML=p2Svg(d,q.num);if(d.cur)q.svg.querySelectorAll('.hd,[pointer-events="none"][stroke="#3d8bfd"]').forEach(e=>e.remove())}}
const _rp=redrawPage;redrawPage=function(n){_rp.apply(this,arguments);if(P2.on&&P2.tabId===curTab)p2Refresh(n)};
H.change.push(()=>{if(P2.on){clearTimeout(p2Refresh.t);p2Refresh.t=setTimeout(()=>p2Refresh(),60)}});
function syncFromMain(force){if(!P2.on||!(P2.sync||force)||P2.lock||!S.pages.length)return;const vr=viewer.getBoundingClientRect(),a=anchorAt(vr.left+vr.width/2,vr.top+vr.height/2);if(!a)return;
 P2.lock=true;if(Math.abs(P2.zoom-S.zoom)>1e-4){P2.zoom=S.zoom;for(const q of P2.pages)sizePageEl(q.el,q,P2.zoom,P2.rot)}
 const v2=$('#viewer2');p2ScrollTo(a.p.num,a.pt,v2.clientWidth/2,v2.clientHeight/2);p2RenderVisible();requestAnimationFrame(()=>requestAnimationFrame(()=>{P2.lock=false}))}
function syncFromP2(){if(!P2.on||!P2.sync||P2.lock||!S.pages.length)return;const a=p2Anchor();if(!a)return;const p=S.pages[clamp(a.n,1,S.pages.length)-1];
 P2.lock=true;const vr=viewer.getBoundingClientRect();lockSync=true;const keep=P2.sync;P2.sync=false;setZoom(P2.zoom,{p,pt:a.pt,cx:vr.left+vr.width/2,cy:vr.top+vr.height/2});P2.sync=keep;
 if(p.num!==S.cur){S.cur=p.num;updateCurUI()}
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
function setDim(v){V.dim=clamp(+v||0,0,.9);saveV();dimCss.textContent=V.dim?`#viewer .page>canvas,#viewer2 .pg2>canvas{opacity:${(1-V.dim).toFixed(2)}}`:''}
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
function setupDom(){const main=$('#main'),vw=$('#viewer');const wrap=document.createElement('div');wrap.id='viewWrap';
 wrap.innerHTML=`<div id="tabBar"></div><div id="splitBox"><div id="mainCol"><div id="mainPane"><canvas id="rulerT"></canvas><canvas id="rulerL"></canvas><div id="rulerC"></div></div></div><div id="splitDiv" title="Drag to resize · double-click to make both panes the same size"></div>
 <div id="viewer2wrap"><div id="p2bar"><div id="tabBar2"></div></div><div id="viewer2"><div id="pages2"></div></div></div></div>`;
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
 // tabs (in split view each pane has its own strip: #tabBar = the active pane, #tabBar2 = the other one)
 const bar=$('#tabBar'),bar2=$('#tabBar2');
 for(const[el,two]of[[bar,false],[bar2,true]]){
  el.addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c){e.stopPropagation();closeInPane(+c.dataset.close,two?1-PN.act:PN.act);return}
   if(e.target.closest('.tplus')){if(two)activatePane();$('#fileIn').click();return}const t=e.target.closest('[data-tid]');if(!t)return;
   if(two)activatePane(+t.dataset.tid);else switchTo(tabOf(+t.dataset.tid))});
  el.addEventListener('auxclick',e=>{if(e.button!==1)return;const t=e.target.closest('[data-tid]');if(t){e.preventDefault();closeInPane(+t.dataset.tid,two?1-PN.act:PN.act)}});
  el.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});
  el.addEventListener('dragstart',e=>{const t=e.target.closest('[data-tid]');if(t){dragTab=+t.dataset.tid;dragFrom=two?1:0;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain','tab')}catch(_){}}});
  el.addEventListener('dragover',e=>{if(dragTab==null)return;e.preventDefault();$$('.dtab.dragover').forEach(x=>x.classList.remove('dragover'));el.classList.toggle('dragin',(two?1:0)!==dragFrom);const t=e.target.closest('[data-tid]');if(t)t.classList.add('dragover')});
  el.addEventListener('dragleave',e=>{if(!el.contains(e.relatedTarget))el.classList.remove('dragin')});
  el.addEventListener('drop',e=>{if(dragTab==null)return;e.preventDefault();el.classList.remove('dragin');const id=dragTab,from=dragFrom;dragTab=null;
   if(P2.on&&(two?1:0)!==from){moveTab(id,two?1-PN.act:PN.act);return}   // dropped on the other pane's tabs: move it there
   const t=e.target.closest('[data-tid]');if(t){const fi=tabs.findIndex(x=>x.id===id),to=tabs.findIndex(x=>x.id===+t.dataset.tid);if(fi>=0&&to>=0){const[m]=tabs.splice(fi,1);tabs.splice(to,0,m)}}renderTabs()});
  el.addEventListener('dragend',()=>{dragTab=null;$$('.dtab.dragover').forEach(x=>x.classList.remove('dragover'));$$('.dragin').forEach(x=>x.classList.remove('dragin'))})}
 // split view: clicking anywhere in the other pane makes it the active pane
 const v2=$('#viewer2');
 v2.addEventListener('pointerdown',e=>{if(!P2.on||e.pointerType==='touch')return;const L=e.button===0;if(L){e.preventDefault();e.stopPropagation()}
  // like Bluebeam, one click both makes this pane active and does what the click means (draw, select, pan...):
  // the pane swaps into the editor, then the same press is replayed on what is now under the mouse
  const x=e.clientX,y=e.clientY,o0={shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,pointerId:e.pointerId,pointerType:e.pointerType,isPrimary:true};let up=false;const onUp=()=>{up=true};
  if(L)window.addEventListener('pointerup',onUp,true);activatePane();if(!L)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{window.removeEventListener('pointerup',onUp,true);if(P2.on&&$('#viewer2').contains(document.elementFromPoint(x,y)))return;
   const el=document.elementFromPoint(x,y);if(!el||!el.closest('#viewer'))return;const o={bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,button:0,buttons:up?0:1,...o0};
   el.dispatchEvent(new PointerEvent('pointerdown',o));if(up){window.dispatchEvent(new PointerEvent('pointerup',Object.assign({},o,{buttons:0})));el.dispatchEvent(new MouseEvent('click',o))}}))},true);
 v2.addEventListener('click',e=>{if(P2.on&&e.target.closest('#viewer2'))e.stopPropagation()},true);
 let tTap=null;v2.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'||!P2.on)return;if(tTap&&Math.hypot(e.clientX-tTap[0],e.clientY-tTap[1])<8)activatePane();tTap=null});
 v2.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')tTap=[e.clientX,e.clientY]});
 v2.addEventListener('scroll',()=>{p2RenderVisible();if(P2.sync&&!P2.lock){cancelAnimationFrame(v2._r);v2._r=requestAnimationFrame(syncFromP2)}},{passive:true});
 v2.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey||(settings.wheelZoom&&!e.shiftKey)){e.preventDefault();const vr=v2.getBoundingClientRect();const a=p2Anchor();// anchor at cursor
   let an=null;for(const q of P2.pages){const r=q.el.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){an={n:q.num,pt:pxToPt(q.w,q.h,P2.rot,e.clientX-r.left,e.clientY-r.top,P2.zoom),cx:e.clientX-vr.left,cy:e.clientY-vr.top};break}}
   const k=e.ctrlKey&&Math.abs(e.deltaY)<40?0.01:0.0018;p2Zoom(P2.zoom*Math.exp(-(e.deltaMode===1?e.deltaY*30:e.deltaY)*k),an||a)}},{passive:false});
 // pinch on pane 2
 const pp=new Map();let pin=null;v2.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pp.set(e.pointerId,[e.clientX,e.clientY]);if(pp.size===2){const[a,b]=[...pp.values()];pin={d:Math.hypot(a[0]-b[0],a[1]-b[1]),z:P2.zoom}}});
 v2.addEventListener('pointermove',e=>{if(!pp.has(e.pointerId))return;pp.set(e.pointerId,[e.clientX,e.clientY]);if(pin&&pp.size===2){const[a,b]=[...pp.values()];p2Zoom(pin.z*Math.hypot(a[0]-b[0],a[1]-b[1])/pin.d)}});
 const endp=e=>{pp.delete(e.pointerId);if(pp.size<2)pin=null};v2.addEventListener('pointerup',endp);v2.addEventListener('pointercancel',endp);
 // divider drag
 const dv=$('#splitDiv');dv.addEventListener('pointerdown',e=>{e.preventDefault();const box=$('#splitBox').getBoundingClientRect();const mv=ev=>{const h=V.orient==='h';const f=h?1-(ev.clientY-box.top)/box.height:1-(ev.clientX-box.left)/box.width;V.splitRatio=clamp(f,.15,.85);applyRatio()};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);saveV();scheduleRender();p2RenderVisible();drawRulers()};addEventListener('pointermove',mv);addEventListener('pointerup',up)});
 dv.addEventListener('dblclick',e=>{e.preventDefault();balance()});
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
window.PMViews={get tabs(){return tabs},get curTab(){return curTab},switchTo:id=>{if(P2.on&&PN.ids[1-PN.act].includes(id)&&!PN.ids[PN.act].includes(id))activatePane(id);else switchTo(tabOf(id))},closeTab,closeInPane,openSplit,closeSplit,activatePane,moveTab,paneOf,balance,toggleOrient,setSync,get act(){return PN.act},get paneIds(){return PN.ids.map(x=>x.slice())},rotateView,setMode,flip,navBack,navFwd,setRulers,setDim,setTheme,zoomBoxMode,actualSize,zoomToSelection,setLoupe,P2,V,get rot(){return curRot},ptToPx,pxToPt};
})();
