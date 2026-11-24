/* PlanMark — QA pass 1 (navigation & viewing). Loaded last, after sharp.js.
   Brings page navigation, the page box, thumbnails and keyboard/wheel scrolling in line with Bluebeam Revu. */
(function(){
'use strict';
const lab=n=>{try{const L=window.PMDoc&&PMDoc.labels;return(L&&L[n-1])||''}catch(e){return''}};
const inField=t=>t&&t.closest&&t.closest('input,textarea,select,[contenteditable],.modal');

// 1. Page jumps are instant (Bluebeam never animates First/Last/Next/typed page/thumbnail jumps).
//    Smooth scrolling made the counter run through every page in between and filled Back/Forward with them.
const _goto=gotoPage;
gotoPage=function(n){return _goto.call(this,n,true)};
const _box=scrollToBox;
scrollToBox=function(n,b){const r=_box.apply(this,arguments);try{viewer.scrollTo({left:viewer.scrollLeft,top:viewer.scrollTop,behavior:'auto'})}catch(e){}return r};

// 2. Sheet labels (A-101) on every page entry, so the page box reads "A-101 (1 of 50)" and thumbnails show them.
function syncLabels(){for(const p of S.pages){const l=lab(p.num);p.label=l&&l!==String(p.num)?l:''}}
function curText(){const n=S.pages.length,c=S.cur||0;if(!n)return'';const l=lab(c);return`${l&&l!==String(c)?l:c} (${c} of ${n})`}

// 3. Keep the current thumbnail in view (Bluebeam's Thumbnails panel follows the page).
function followThumb(){const pane=document.getElementById('pane-pages');if(!pane||!pane.offsetParent)return;
 const t=pane.querySelector(`.thumb[data-p="${S.cur}"]`);if(!t)return;
 const sc=(function f(e){while(e&&e!==document.body){const cs=getComputedStyle(e);if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1)return e;e=e.parentElement}return null})(pane);
 if(!sc)return;const r=t.getBoundingClientRect(),s=sc.getBoundingClientRect();
 if(r.top<s.top)sc.scrollTop-=s.top-r.top+6;else if(r.bottom>s.bottom)sc.scrollTop+=r.bottom-s.bottom+6}

const _u=updateCurUI;
updateCurUI=function(){syncLabels();const r=_u.apply(this,arguments);
 const pi=document.getElementById('pageIn');if(pi&&document.activeElement!==pi&&document.body.classList.contains('dl'))pi.value=curText();
 try{followThumb()}catch(e){}return r};
// labels arrive after the PDF opens (and when edited in Page labels): refresh the box and thumbnails then
let lastSig='';setInterval(()=>{if(!S.pages.length)return;const L=window.PMDoc&&PMDoc.labels,sig=S.pages.length+':'+(L?L.join('|'):'');if(sig===lastSig)return;lastSig=sig;
 syncLabels();try{window.PMDrafting&&PMDrafting.navState()}catch(e){}const pi=document.getElementById('pageIn');if(pi&&document.activeElement!==pi&&document.body.classList.contains('dl'))pi.value=curText()},400);

// 4. The page box: a page number, or a sheet label (any case, exact first, then the start of a label).
//    Anything else is refused and the box is put back. Escape and leaving the box put it back too.
function restoreBox(pi){if(document.body.classList.contains('dl'))pi.value=curText();else pi.value=S.cur||''}
function resolve(v){v=v.trim();if(!v)return 0;const n=S.pages.length,L=(window.PMDoc&&PMDoc.labels)||null,lv=v.toLowerCase();
 if(L){let i=L.findIndex(l=>l&&l.toLowerCase()===lv);if(i>=0)return i+1;}
 if(/^\d+$/.test(v)){const k=+v;return k>=1&&k<=n?k:-k}
 if(L){const i=L.findIndex(l=>l&&l.toLowerCase().startsWith(lv));if(i>=0)return i+1}
 return 0}
window.addEventListener('change',e=>{const pi=e.target;if(!pi||pi.id!=='pageIn')return;e.stopImmediatePropagation();
 const v=pi.value,k=resolve(v);if(k>0){gotoPage(k);pi.blur();restoreBox(pi);return}
 if(v.trim())toast(k<0?`There is no page ${-k} — this file has ${S.pages.length}`:`No page labeled "${v.trim()}"`);restoreBox(pi)},true);
window.addEventListener('keydown',e=>{const pi=e.target;if(!pi||pi.id!=='pageIn')return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();restoreBox(pi);pi.blur()}
 else if(e.key==='Enter'){e.stopImmediatePropagation()}},true);
document.addEventListener('focusout',e=>{const pi=e.target;if(pi&&pi.id==='pageIn')setTimeout(()=>{if(document.activeElement!==pi)restoreBox(pi)},0)});

// 5. Shift+wheel scrolls sideways (Bluebeam). Headless/Linux Chrome would otherwise scroll up and down.
viewer.addEventListener('wheel',e=>{if(!S.pages.length||!e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;if(Math.abs(e.deltaX)>=Math.abs(e.deltaY))return;
 e.preventDefault();e.stopImmediatePropagation();viewer.scrollLeft+=(e.deltaMode===1?e.deltaY*30:e.deltaY)},{passive:false,capture:true});

// 6. Arrow keys scroll the view when nothing is selected, wherever focus last landed on the toolbar.
document.addEventListener('keydown',e=>{if(e.defaultPrevented||!S.pages.length||e.ctrlKey||e.metaKey||e.altKey)return;
 if(!/^Arrow(Up|Down|Left|Right)$/.test(e.key)||inField(e.target)||(typeof modalCb!=='undefined'&&modalCb))return;
 if(S.sel&&S.sel.size)return;let mode='continuous';try{mode=(window.PMLayout&&PMLayout.get().mode)||'continuous'}catch(_){}
 if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&mode!=='continuous'&&mode!=='2upc')return;
 const st=e.shiftKey?200:40;e.preventDefault();
 if(e.key==='ArrowDown')viewer.scrollTop+=st;else if(e.key==='ArrowUp')viewer.scrollTop-=st;else if(e.key==='ArrowRight')viewer.scrollLeft+=st;else viewer.scrollLeft-=st});

// 7. Home / End (and Ctrl+Home / Ctrl+End) go to the first / last page wherever focus is
//    (natively they only worked while the drawing itself had focus).
document.addEventListener('keydown',e=>{if(e.defaultPrevented||!S.pages.length||e.altKey||e.shiftKey||e.metaKey)return;
 if((e.key!=='Home'&&e.key!=='End')||inField(e.target)||(typeof modalCb!=='undefined'&&modalCb))return;
 e.preventDefault();gotoPage(e.key==='Home'?1:S.pages.length)});

// 8. Smaller screens (1366×768 laptops): the navigation bar under the drawing used to run off the right edge,
//    hiding Rulers and Split. Tighter buttons there, and the sheet size (already in the status bar) drops out.
//    The left panel also starts narrower unless you've sized it yourself.
const css=document.createElement('style');css.textContent=`
@media (max-width:1600px){html body.dl #dlNav{gap:0;padding:0 4px}html body.dl #dlNav .btn{min-width:28px;width:28px;padding:0;justify-content:center}html body.dl #dlNav #pageIn{width:104px}html body.dl #dlNav .sep{margin:0 3px}}
@media (max-width:1440px){html body.dl #dlNav .dlInfo{display:none}}
@media (max-height:900px){html body.dl #left .tabs{gap:0;padding:3px 3px}html body.dl #left .tabs button{height:31px}}
html body.dl #left .tabs{scrollbar-width:thin}`;
document.head.appendChild(css);
try{if(!LS.get('pm:dl:pw',0)&&innerWidth<1600)document.body.style.setProperty('--dlPW',(innerWidth<1440?280:310)+'px')}catch(e){}

// 9. Bluebeam keys: Plus / Minus zoom (no Ctrl), Ctrl+Left / Ctrl+Right previous / next page.
const zoomAtCenter=f=>{const vr=viewer.getBoundingClientRect();setZoom(S.zoom*f,anchorAt(vr.left+viewer.clientWidth/2,vr.top+viewer.clientHeight/2))};
window.addEventListener('keydown',e=>{if(!S.pages.length||e.altKey||e.metaKey||inField(e.target)||(typeof modalCb!=='undefined'&&modalCb))return;
 if(S.drawing)return;
 if(!e.ctrlKey&&!e.shiftKey&&(e.code==='Equal'||e.code==='NumpadAdd'||e.key==='+')){e.preventDefault();e.stopImmediatePropagation();zoomAtCenter(1.25);return}
 if(!e.ctrlKey&&!e.shiftKey&&(e.code==='Minus'||e.code==='NumpadSubtract')){e.preventDefault();e.stopImmediatePropagation();zoomAtCenter(.8);return}
 if(e.ctrlKey&&!e.shiftKey&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();e.stopImmediatePropagation();gotoPage(S.cur+(e.key==='ArrowRight'?1:-1))}},true);

// 10. Ctrl toggles the wheel between zoom and scroll (Bluebeam). A trackpad pinch also arrives as a Ctrl+wheel,
//     but without the Ctrl key held — that one keeps zooming.
let ctrlHeld=false;
addEventListener('keydown',e=>{if(e.key==='Control')ctrlHeld=true},true);
addEventListener('keyup',e=>{if(e.key==='Control')ctrlHeld=false},true);
addEventListener('blur',()=>{ctrlHeld=false});
viewer.addEventListener('wheel',e=>{if(!S.pages.length||!e.ctrlKey||!ctrlHeld||e.shiftKey||e.altKey)return;
 const wz=typeof settings==='object'&&settings&&settings.wheelZoom;if(!wz)return;      // wheel scrolls → Ctrl+wheel zooms as before
 e.preventDefault();e.stopImmediatePropagation();const k=e.deltaMode===1?30:1;viewer.scrollTop+=e.deltaY*k;viewer.scrollLeft+=e.deltaX*k},{passive:false,capture:true});

// 11. Thumbnail size slider in the drafting layout (its CSS pinned every thumbnail to the grid cell, so the slider did nothing).
//     Big thumbnails are redrawn at their new size so they stay crisp.
const tcss=document.createElement('style');tcss.textContent=`html body.dl #pane-pages{grid-template-columns:repeat(auto-fill,minmax(calc(var(--wsTh,150px) * .8 + 12px),1fr))}
html body.dl #pane-pages .thumb canvas{width:100%!important;max-width:var(--wsTh,130px)!important}
html body.dl #pane-pages .thumb{min-width:0}html body.dl #pane-pages .thumb .dlSc,html body.dl #pane-pages .thumb .dlNum{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;document.head.appendChild(tcss);
function thumbW(){const s=document.getElementById('wsThS');return s?+s.value:130}
function applyThumbSize(){const pane=document.getElementById('pane-pages');if(!pane)return;const cw=pane.clientWidth;pane.style.setProperty('--wsTh',(cw?Math.min(thumbW(),Math.max(60,cw-40)):thumbW())+'px')}
// a panel that starts closed has no width yet: size the thumbnails again once it opens or is resized
try{const pn=document.getElementById('pane-pages');if(pn)new ResizeObserver(()=>applyThumbSize()).observe(pn)}catch(e){}
let thTok=0;async function sharpenThumbs(){const tok=++thTok,pane=document.getElementById('pane-pages');if(!pane||!S.pdf)return;const dpr=Math.min(devicePixelRatio||1,2);
 for(const t of pane.querySelectorAll('.thumb')){if(tok!==thTok)return;const c=t.querySelector('canvas'),p=S.pages[+t.dataset.p-1];if(!c||!p)continue;
  const need=Math.round(c.getBoundingClientRect().width*dpr);if(need<=c.width*1.08)continue;
  try{const pg=await S.pdf.getPage(p.num);if(tok!==thTok)return;const sc=need/p.w,vp=pg.getViewport({scale:sc});const o=document.createElement('canvas');o.width=Math.round(p.w*sc);o.height=Math.round(p.h*sc);
   await pg.render({canvasContext:o.getContext('2d'),viewport:vp}).promise;if(tok!==thTok)return;c.width=o.width;c.height=o.height;c.getContext('2d').drawImage(o,0,0)}catch(e){}}}
let thT=0;document.addEventListener('input',e=>{if(e.target&&e.target.id==='wsThS'){applyThumbSize();clearTimeout(thT);thT=setTimeout(sharpenThumbs,300)}});
setInterval(()=>{if(document.getElementById('wsThS'))applyThumbSize()},1000);

// 12. Escape closes a dialog even when the keyboard focus isn't inside it (dialogs opened from the menus
//     left focus on the page, so Escape did nothing and the dialog blocked everything after it).
window.addEventListener('keydown',e=>{if(e.key!=='Escape'||typeof modalCb==='undefined'||!modalCb)return;const md=document.getElementById('modal');
 if(!md||getComputedStyle(md).display==='none'||md.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();
 const i=modalCb.findIndex(b=>b.cancel);const btn=i>=0&&md.querySelector(`[data-b="${i}"]`);if(btn)btn.click();else closeModal()},true);

// 13. Clicking on the drawing takes the keyboard focus out of the page / zoom boxes (the drawing area cancels
//     mousedown, so focus used to stay there: half-typed text was left in the box and shortcut keys typed into it).
window.addEventListener('pointerdown',e=>{const a=document.activeElement;if(!a||(a.id!=='pageIn'&&a.id!=='zoomv'))return;if(a.contains(e.target))return;
 if(!viewer.contains(e.target))return;a.blur()},true);

window.PMQA1={syncLabels,curText,resolve};
})();
// clicking the drawing always leaves the page box (some tools stop the browser from moving the focus)
try{['viewer','viewer2'].forEach(id=>{const v=document.getElementById(id);if(v)v.addEventListener('pointerdown',()=>{const pi=document.getElementById('pageIn');if(pi&&document.activeElement===pi)pi.blur()},true)})}catch(e){}
