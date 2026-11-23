/* PlanMark — easier Select Text.
   The Select Text tool (Shift+Alt+T, the "T" button at the top of the tool strip) used to work only by dragging a box, and
   it did not feel like selecting text anywhere else. Now:
   • with the tool on, the PDF's words get an invisible layer on top of the page, so you press on a word and drag
     to select exactly like in any PDF reader (the old box drag still works when you start on blank paper, and it
     also picks up OCR'd words on scans);
   • Ctrl+A selects every word on the current page; Ctrl+C and right-click (Search / Copy / Hyperlink) work as before. */
(function(){
const TOOL='seltext';
if(!T[TOOL])return;                                   // the tool itself comes from links3.js
const L3=()=>window.PMLinks3||{};
HINTS[TOOL]='Press on a word and drag to select text (or drag a box from blank paper) · Ctrl+A selects the page · Ctrl+C copies · right-click for Search / Copy / Hyperlink';
if(!KEYS[TOOL])KEYS[TOOL]='Shift+Alt+T';

const st=document.createElement('style');
st.textContent=`.page>.pmText{display:none}
body.pmSelText .page>.pmText{display:block}
.pmText{position:absolute;left:0;top:0;overflow:hidden;line-height:1;text-align:initial;-webkit-text-size-adjust:none;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:3;cursor:crosshair}
.pmText :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%;user-select:text;-webkit-user-select:text}
.pmText span.markedContent{top:0;height:0}
.pmText ::selection{background:rgba(61,139,253,.35);color:transparent}
.pmText br::selection{background:transparent}
.pmText .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:-1;cursor:default;user-select:text;-webkit-user-select:text}
.pmText .endOfContent.active{top:0}
.page.rv90>.pmText{transform:translate(var(--ph),0) rotate(90deg)}
.page.rv180>.pmText{transform:translate(var(--pw),var(--ph)) rotate(180deg)}
.page.rv270>.pmText{transform:translate(0,var(--pw)) rotate(270deg)}`;
document.head.appendChild(st);

const on=()=>S.tool===TOOL&&S.pages.length>0;
function setScale(){viewer.style.setProperty('--scale-factor',S.zoom)}

// the invisible word layer, built for pages on (or near) the screen
async function build(p){if(p.tl||p.tlBusy)return;const d=S.pdf;if(!d||!window.pdfjsLib||!pdfjsLib.renderTextLayer)return;p.tlBusy=true;
 try{const page=await d.getPage(p.num);if(d!==S.pdf)return;
  const div=document.createElement('div');div.className='pmText';
  await pdfjsLib.renderTextLayer({textContentSource:page.streamTextContent({includeMarkedContent:true}),container:div,viewport:p.vp,textDivs:[]}).promise;
  if(d!==S.pdf)return;const end=document.createElement('div');end.className='endOfContent';div.appendChild(end);
  p.el.appendChild(div);p.tl=div}
 catch(e){console.warn('text layer',e)}finally{p.tlBusy=false}}
function nearScreen(p){const vr=viewer.getBoundingClientRect(),r=p.el.getBoundingClientRect();return r.width>0&&r.bottom>vr.top-800&&r.top<vr.bottom+800&&r.right>vr.left-800&&r.left<vr.right+800}
async function buildVisible(){if(!on())return;setScale();
 const list=S.pages.filter(p=>!p.tl&&nearScreen(p)).sort((a,b)=>Math.abs(a.num-S.cur)-Math.abs(b.num-S.cur));
 for(const p of list){if(!on())return;await build(p)}}
let bT=0;const soon=()=>{clearTimeout(bT);bT=setTimeout(buildVisible,120)};
viewer.addEventListener('scroll',()=>{if(on())soon()},{passive:true});

function clearNative(){try{const sl=getSelection();if(sl&&sl.rangeCount&&viewer.contains(sl.anchorNode))sl.removeAllRanges()}catch(e){}}
function sync(){const a=on();document.body.classList.toggle('pmSelText',a);
 if(a){setScale();soon()}else clearNative()}
const _ur=updateRibbon;updateRibbon=function(){const r=_ur.apply(this,arguments);try{sync()}catch(e){}return r};
const _sz=setZoom;setZoom=function(){const r=_sz.apply(this,arguments);setScale();if(on())soon();return r};
H.open.push(()=>{setScale();sync()});

// pressing on a word: let the browser select text normally (instead of the box drag)
let drag=null;
viewer.addEventListener('pointerdown',e=>{if(!on()||e.button!==0||S.space||e.pointerType==='touch')return;
 const sp=e.target.closest&&e.target.closest('.pmText span');if(!sp)return;      // blank paper → the old box drag
 e.stopPropagation();const tl=sp.closest('.pmText'),p=S.pages[+tl.parentElement.dataset.p-1];if(!p)return;
 const L=L3();if(L.tsel){const n=L.tsel.page;L.tsel=null;redrawPage(n)}
 drag={p,end:tl.querySelector('.endOfContent')};if(drag.end)drag.end.classList.add('active')},true);
addEventListener('pointerup',()=>{if(!drag)return;const{p,end}=drag;drag=null;if(end)end.classList.remove('active');setTimeout(()=>take(p),0)},true);

// turn the browser's selection into the tool's selection (blue boxes; right-click menu and Ctrl+C use it)
function take(p){const L=L3();let sl;try{sl=getSelection()}catch(e){return}
 if(!sl||!sl.rangeCount||sl.isCollapsed){if(L.tsel){const n=L.tsel.page;L.tsel=null;redrawPage(n)}$('#hint').textContent=HINTS[TOOL];return}
 const text=String(sl).replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/[ \t]+/g,' ').trim();
 const rects=[];for(let i=0;i<sl.rangeCount;i++)for(const r of sl.getRangeAt(i).getClientRects()){if(r.width<.5||r.height<.5)continue;
  const pr=p.el.getBoundingClientRect();if(r.right<pr.left||r.left>pr.right||r.bottom<pr.top||r.top>pr.bottom)continue;
  const a=toPt({clientX:r.left,clientY:r.top},p),b=toPt({clientX:r.right,clientY:r.bottom},p);rects.push(normBox(a,b))}
 sl.removeAllRanges();
 if(!text||!rects.length)return;
 L.tsel={page:p.num,rects,text};redrawPage(p.num);
 $('#hint').textContent=`Selected: “${text.slice(0,60)}${text.length>60?'…':''}” · Ctrl+C to copy · right-click for Search / Copy / Hyperlink`}

// Ctrl+A selects every word on the current page
addEventListener('keydown',e=>{if(!on()||!(e.ctrlKey||e.metaKey)||e.shiftKey||e.altKey||e.key.toLowerCase()!=='a')return;
 if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]'))return;
 const p=S.pages[S.cur-1],L=L3();if(!p||!L.selectTextIn)return;e.preventDefault();e.stopImmediatePropagation();L.selectTextIn(p.num,[0,0,p.w,p.h])},true);

window.PMSelText={build,buildVisible};
})();
