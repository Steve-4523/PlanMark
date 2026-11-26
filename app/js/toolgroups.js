/* PlanMark — grouped tool strip (Bluebeam layout, 1.5.9)
   The right-hand toolbar showed 67 buttons, so on a laptop most were below the edge. Like Bluebeam, related tools now
   share one button: the small corner mark means there are more. Click the button to use the tool; click the corner
   mark, right-click, or press and hold to pick another tool of that kind. The one you pick stays on top.
   Shortcut keys still go straight to any tool, and the button switches to show it. */
(function(){
const FAM=[
 ['text','Text',['text','typewriter','note','callout']],
 ['highlight','Highlight',['highlight','texthl','underline','strikeout','squiggly','review']],
 ['pen','Pen',['pen','eraser']],
 ['cloud','Cloud',['cloud','cloudplus']],
 ['stamp','Stamps and attachments',['stamp','cstamp','symbol','image','fattach','flag','hlink']],
 ['line','Lines',['line','arrow','arc','polyline','dimension']],
 ['shape','Shapes',['rect','ellipse','polygon']],
 ['length','Length',['length','polylength','perimeter','arclen','qmeasure']],
 ['area','Area',['area','volume']],
 ['count','Count',['count']],
 ['angle','Angles and circles',['angle','radius','circle','rad3']],
 ['calibrate','Scale',['calibrate','viewport']]];
const famOf=t=>FAM.find(f=>f[2].includes(t));
const isDL=()=>document.body.classList.contains('dl');
const faceKey='pm:tg:face';
let face=Object.assign({},LS.get(faceKey,{}));
let hiddenFam=new Set();   // families a setup (Estimating / PM / Field) leaves out
let hiddenRib=null;        // Document buttons a setup leaves out (null = all shown)

const css=document.createElement('style');css.textContent=`
/* the highlighter and the pen show in colour, as in Bluebeam (1.6.6); the same wherever their buttons are */
.tb[data-tool=highlight] svg,[data-t=highlight] svg{color:#f2c230}
.tb[data-tool=pen] svg,[data-t=pen] svg{color:#3d8bfd}
body.dl.tg #ribbon .tgOff,body.dl.tg #ribbon .tgOut{display:none!important}
body.dl.tg #ribbon .sep{margin:3px 0}
body.dl.tg #ribbon .tb.tgFam{position:relative}
body.dl.tg #ribbon .tb.tgFam::after{content:'';position:absolute;right:2px;bottom:2px;border-style:solid;border-width:0 0 6px 6px;border-color:transparent transparent var(--mut,#9aa) transparent;opacity:.85}
body.dl.tg #ribbon .tb.tgFam:hover::after{border-color:transparent transparent var(--text,#eee) transparent}
#tgFly{position:fixed;z-index:260;min-width:200px;max-width:300px;background:var(--panel,#252525);color:var(--text);border:1px solid var(--line);border-radius:7px;box-shadow:0 12px 34px rgba(0,0,0,.5);padding:4px;font-size:12.5px}
#tgFly .h{font-size:11px;color:var(--mut);padding:4px 8px 3px;text-transform:uppercase;letter-spacing:.04em}
#tgFly .r{display:flex;align-items:center;gap:9px;padding:5px 8px;border-radius:5px;cursor:pointer;white-space:nowrap}
#tgFly .r:hover,#tgFly .r.k{background:var(--accbg,#2b3a4d)}
#tgFly .r.on{font-weight:600}
#tgFly .r svg{width:18px;height:18px;flex:0 0 18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
#tgFly .r .t{flex:1}
#tgFly .r kbd{font-size:10.5px;opacity:.75}
#tgFly .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 4px}
`;document.head.appendChild(css);

const rb=()=>$('#ribbon');
const btn=t=>rb()&&rb().querySelector(`:scope>.grp:not(.rvNavGrp) .tb[data-tool="${t}"]`);   // (the Revu nav group keeps hidden copies of some tools)
const ttl=b=>b?(b.dataset.qt!=null?b.dataset.qt:(b.title||'')):'';   // (hover help holds the title while the mouse is on a button)
const keyOf=b=>{const m=/\(([^)]+)\)/.exec(ttl(b));return m?m[1]:''};
const nameOf=b=>(b.querySelector('span')||{}).textContent||ttl(b)||'';

/* show one button per family (the one last picked, or the tool in use), hide the rest */
function apply(){const r=rb();if(!r)return;const on0=isDL()&&r.dataset.rv==='1';document.body.classList.toggle('tg',on0);if(!on0)return;   // after the Bluebeam layout has put the strip in order
 r.querySelectorAll('.rvNavGrp .tgSlot').forEach(x=>x.remove());
 const on=(r.querySelector(':scope>.grp:not(.rvNavGrp) .tb.on[data-tool]')||{}).dataset;const cur=on&&on.tool;
 for(const[id,,tools] of FAM){const live=tools.filter(t=>btn(t));if(!live.length)continue;
  let f=face[id];if(cur&&live.includes(cur))f=cur;if(!live.includes(f))f=live[0];face[id]=f;
  // the family keeps its place in the strip whichever of its tools is showing
  let slot=r.querySelector(`.tgSlot[data-f="${id}"]`);if(!slot){slot=document.createElement('i');slot.className='tgSlot';slot.dataset.f=id;slot.hidden=true;btn(live[0]).before(slot)}
  const fb=btn(f);if(fb&&slot.nextElementSibling!==fb)slot.after(fb);
  for(const t of live){const b=btn(t);if(!b)continue;b.classList.toggle('tgOff',t!==f);b.classList.toggle('tgFam',t===f&&live.length>1);b.classList.toggle('tgOut',hiddenFam.has(id)&&!(cur&&live.includes(cur)));   // a hidden kind still shows while its tool is in use (picked by key or Find a command)
   if(t===f&&live.length>1&&!b.dataset.tgT&&b.dataset.qt==null){b.dataset.tgT=1;b.title=b.title.replace(/ — double-click to lock$/,'')+' — double-click to lock · right-click or hold for more '+FAM.find(x=>x[0]===id)[1].toLowerCase()+' tools'}}}
 // the Document buttons (Print, Compare, Overlay, OCR…) become one “More” button
 const docs=[...r.querySelectorAll('.tb[data-rib]')];
 if(docs.length){let more=r.querySelector('#tgMore');const g=docs[0].parentElement;
  if(!more){more=document.createElement('button');more.className='btn tb tgFam';more.id='tgMore';more.title='More';
   more.innerHTML='<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>More</span>';g.appendChild(more)}
  for(const d of docs)d.classList.add('tgOff')}
 // separators only between families that are showing
 r.querySelectorAll('.grp').forEach(g=>{const shown=[...g.querySelectorAll('.tb')].some(b=>!b.classList.contains('tgOff')&&!b.classList.contains('tgOut')&&getComputedStyle(b).display!=='none');g.classList.toggle('tgOut',!shown&&!g.classList.contains('rvNavGrp'));
  const s=g.previousElementSibling;if(s&&s.classList.contains('sep'))s.classList.toggle('tgOut',!shown)});
 setTimeout(()=>window.PMEasy&&PMEasy.strip&&PMEasy.strip(),0)}

/* the little list of tools of one kind */
let fly=null,flyFor=null;
function closeFly(){if(fly){fly.remove();fly=null;flyFor=null;removeEventListener('pointerdown',outside,true);removeEventListener('keydown',flyKey,true);removeEventListener('keyup',escUp,true)}}
const escUp=e=>{if(e.key==='Escape')closeFly()};   // (some Esc handlers stop the keydown before it gets here)
const outside=e=>{if(fly&&!fly.contains(e.target)&&!(flyFor&&flyFor.contains(e.target)))closeFly()};
let sel=-1;
function flyKey(e){if(!fly)return;const rows=[...fly.querySelectorAll('.r')];
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFly()}
 else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();sel=(sel+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows.forEach((r,i)=>r.classList.toggle('k',i===sel))}
 else if(e.key==='Enter'&&sel>=0){e.preventDefault();e.stopPropagation();rows[sel].click()}}
function openFly(anchor){closeFly();const r=rb();let rows=[],title='';
 if(anchor.id==='tgMore'){title='More tools';const onClaude=!!(window.claude&&window.claude.use);rows=[...r.querySelectorAll('.tb[data-rib]')].filter(b=>!(hiddenRib&&hiddenRib.has(nameOf(b)))&&(onClaude||!/Live shared markup sessions/.test(b.title))).map(b=>({b,name:nameOf(b),hint:ttl(b),key:''}))}
 else{const f=famOf(anchor.dataset.tool);if(!f)return;title=f[1];rows=f[2].map(btn).filter(Boolean).map(b=>({b,name:nameOf(b),key:keyOf(b),tool:b.dataset.tool,hint:(window.PMQuick&&PMQuick.TOOL[b.dataset.tool])||''}))}
 if(rows.length<2&&anchor.id!=='tgMore')return;
 fly=document.createElement('div');fly.id='tgFly';flyFor=anchor;sel=-1;
 const cur=(r.querySelector(':scope>.grp:not(.rvNavGrp) .tb.on[data-tool]')||{}).dataset;
 fly.innerHTML=`<div class="h">${esc(title)}</div><div class="${rows.length>12?'cols':''}">${rows.map((x,i)=>`<div class="r${cur&&x.tool&&cur.tool===x.tool?' on':''}" data-i="${i}" title="${esc(x.hint||'')}">${(x.b.querySelector('svg')||{}).outerHTML||''}<span class="t">${esc(x.name)}</span>${x.key?`<kbd>${esc(x.key)}</kbd>`:''}</div>`).join('')}</div>`;
 document.body.appendChild(fly);
 const a=anchor.getBoundingClientRect(),w=fly.offsetWidth,h=fly.offsetHeight;
 fly.style.left=Math.max(6,a.left-w-6)+'px';fly.style.top=Math.max(6,Math.min(innerHeight-h-6,a.top-4))+'px';
 fly.onclick=e=>{const row=e.target.closest('[data-i]');if(!row)return;const x=rows[+row.dataset.i];closeFly();
  if(x.tool){const f=famOf(x.tool);face[f[0]]=x.tool;LS.set(faceKey,face);apply()}x.b.click()};
 setTimeout(()=>{addEventListener('pointerdown',outside,true);addEventListener('keydown',flyKey,true);addEventListener('keyup',escUp,true)},0)}

/* clicks: the corner mark, right-click and press-and-hold open the list; a plain click uses the tool */
function bind(){const r=rb();if(!r||r.dataset.tg)return;r.dataset.tg=1;
 let hold=0,held=false;
 r.addEventListener('pointerdown',e=>{if(!isDL()||e.button!==0)return;const b=e.target.closest('.tb.tgFam');if(!b)return;held=false;
  const rc=b.getBoundingClientRect();if(b.id==='tgMore'||(e.clientX>rc.right-12&&e.clientY>rc.bottom-12)){e.preventDefault();e.stopPropagation();held=true;openFly(b);return}
  clearTimeout(hold);hold=setTimeout(()=>{held=true;openFly(b)},420)},true);
 const stop=()=>clearTimeout(hold);r.addEventListener('pointerup',stop,true);r.addEventListener('pointerleave',stop,true);
 r.addEventListener('click',e=>{if(!isDL())return;const b=e.target.closest('.tb.tgFam');if(b&&held){e.preventDefault();e.stopPropagation();held=false}},true);
 r.addEventListener('contextmenu',e=>{if(!isDL())return;const b=e.target.closest('.tb.tgFam');if(!b)return;e.preventDefault();e.stopPropagation();openFly(b)},true)}

/* keep it right when the toolbar is rebuilt, the layout changes or a key picks a hidden tool */
let t=0;const soon=()=>{clearTimeout(t);t=setTimeout(()=>{bind();apply()},30)};
H.ready.push(()=>{bind();apply();const r=rb();if(!r)return;
 new MutationObserver(ms=>{if(ms.some(m=>m.type==='childList'?[...m.addedNodes].some(n=>n.nodeType===1&&!n.classList.contains('ezMore')&&n.id!=='tgMore'&&!n.classList.contains('tgSlot')&&!(n.dataset&&n.dataset.tool)):m.attributeName==='class'&&m.target.dataset&&m.target.dataset.tool&&(m.target.classList.contains('on')&&m.target.classList.contains('tgOff')||hiddenFam.size>0)))soon()}).observe(r,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 new MutationObserver(soon).observe(document.body,{attributes:true,attributeFilter:['class']});new MutationObserver(soon).observe(r,{attributes:true,attributeFilter:['data-rv']});setTimeout(soon,600)});

window.PMToolGroups={FAM,apply,openFly,closeFly,famOf,
 /* used by the ready-made setups: which kinds of tools and which More items to show */
 setShown(fams,ribNames){hiddenFam=new Set(fams?FAM.map(f=>f[0]).filter(id=>!fams.includes(id)):[]);hiddenRib=ribNames?new Set([...rb().querySelectorAll('.tb[data-rib]')].map(nameOf).filter(n=>!ribNames.includes(n))):null;apply()},
 get face(){return face},get fly(){return fly}};
})();
