/* PlanMark — Select Text also works on the words inside markups (text boxes, callouts, notes, typewriter…).
   textsel.js handles the PDF's own words; when the press lands on a markup's text instead, this selects the
   characters you drag across inside that markup, highlights them in the same blue, and Ctrl+C / right-click
   (Copy, Search, Hyperlink) use them exactly like PDF text. */
(function(){
const L3=()=>window.PMLinks3||{};
const on=()=>S.tool==='seltext'&&S.pages.length>0;
let drag=null;
// the markup <text> under a page point (in PDF points), searching the topmost markup first
function textAt(p,pt){const ts=[...p.el.querySelectorAll('.mk text')].reverse();
 for(const t of ts){let b;try{b=t.getBBox()}catch(e){continue}if(!b.width)continue;
  if(pt[0]>=b.x-3&&pt[0]<=b.x+b.width+3&&pt[1]>=b.y-3&&pt[1]<=b.y+b.height+3)return t}return null}
function charAt(t,pt){const n=t.getNumberOfChars();let best=0,bd=1e18;
 for(let i=0;i<n;i++){let r;try{r=t.getExtentOfChar(i)}catch(e){continue}
  const dx=pt[0]<r.x?r.x-pt[0]:pt[0]>r.x+r.width?pt[0]-r.x-r.width:0,dy=pt[1]<r.y?r.y-pt[1]:pt[1]>r.y+r.height?pt[1]-r.y-r.height:0;
  const d=dy*1000+dx;if(d<bd){bd=d;best=pt[0]>r.x+r.width/2&&dy===0?i+1:i}}return best}
function live(d){const g=d.p.el.querySelector(`.mk[data-id="${d.id}"]`);return g&&g.querySelectorAll('text')[d.k]||d.t}   // redraws replace the markup's elements
function select(d,i0,i1){const t=d.t=live(d),a=Math.min(i0,i1),b=Math.max(i0,i1);const L=L3();
 if(a===b){if(L.tsel&&L.tsel.page===d.p.num){L.tsel=null;redrawPage(d.p.num)}return}
 const rects=[];let txt='',lastY=null;
 for(let i=a;i<b;i++){let r;try{r=t.getExtentOfChar(i)}catch(e){continue}
  const ch=t.textContent[i]||'';const cur=rects[rects.length-1];
  if(cur&&Math.abs(r.y-lastY)<r.height*.5){cur[2]=Math.max(cur[2],r.x+r.width);cur[3]=Math.max(cur[3],r.y+r.height)}
  else{if(cur)txt+='\n';rects.push([r.x,r.y,r.x+r.width,r.y+r.height]);lastY=r.y}
  txt+=ch}
 L.tsel={page:d.p.num,rects,text:txt.replace(/[ \t]+\n/g,'\n').trim()};redrawPage(d.p.num);
 $('#hint').textContent=`Selected: “${L.tsel.text.slice(0,60)}${L.tsel.text.length>60?'…':''}” · Ctrl+C to copy · right-click for Search / Copy / Hyperlink`}
viewer.addEventListener('pointerdown',e=>{if(!on()||e.button!==0||S.space||e.pointerType==='touch')return;
 const p=pageFromEvent(e);if(!p)return;const pt=toPt(e,p);const t=textAt(p,pt);if(!t)return;
 e.stopPropagation();e.preventDefault();try{getSelection().removeAllRanges()}catch(_){}
 const g=t.closest('.mk');const i=charAt(t,pt);drag={p,t,i,id:g&&g.dataset.id,k:g?[...g.querySelectorAll('text')].indexOf(t):0};const L=L3();if(L.tsel){const n=L.tsel.page;L.tsel=null;redrawPage(n)}
 if(e.detail>=2){drag.i=0;select(drag,0,t.getNumberOfChars());drag.done=true}},true);
addEventListener('pointermove',e=>{if(!drag||drag.done)return;select(drag,drag.i,charAt(drag.t=live(drag),toPt(e,drag.p)))},true);
addEventListener('pointerup',()=>{drag=null},true);
window.PMMarkText={textAt};
})();
