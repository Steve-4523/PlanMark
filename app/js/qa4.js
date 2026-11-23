/* qa4.js — QA sweep area 4 fixes (markups list, tool chest, properties, settings). Loaded last. */
(function(){
'use strict';
/* settings added by this sweep follow the login like the rest */
window.PM_EXTRA_SYNC_KEYS_QA4=['pm:qa4:toolModes','pm:qa4:reuse','pm:dl','pm:dl:ml','pm:dl:props','pm:dl:pw','pm:dl:col'];
/* 1. Markups list filter box: core bound the ORIGINAL renderList, so typing rebuilt the list
      without the check, status, hide and reply columns and ignored the page scope. */
document.addEventListener('input',e=>{if(e.target&&e.target.id==='mlFilter'){e.stopImmediatePropagation();renderList()}},true);
/* 2. Markups list: clicking a row goes to that markup and zooms to it when it is off-screen, tiny or under the
      floating Properties panel (core only scrolled toward it). A markup already in full view stays put. */
/* the part of the drawing not covered by the floating Properties panel */
function openRect(){const v=viewer.getBoundingClientRect(),r=$('#right'),o={left:v.left,top:v.top,right:v.right,bottom:v.bottom};
 if(r&&document.body.classList.contains('dl')&&getComputedStyle(r).position==='absolute'&&getComputedStyle(r).display!=='none'){const rr=r.getBoundingClientRect();if(rr.left<o.right&&rr.left>o.left+200)o.right=rr.left}
 o.width=o.right-o.left;o.height=o.bottom-o.top;return o}
function zoomToMarkup(m){const p=S.pages[m.page-1];if(!p)return;const b=bboxOf(m),vr=openRect();
 const rot=(window.PMViews&&PMViews.curRot)||0,bw=Math.max(b[2]-b[0],4),bh=Math.max(b[3]-b[1],4),[w,h]=rot%180?[bh,bw]:[bw,bh];
 const z=clamp(Math.min(vr.width*.6/w,vr.height*.6/h),.1,4);if(m.page!==S.cur){S.cur=m.page;try{updateCurUI()}catch(e){}}
 setZoom(z,{p,pt:[(b[0]+b[2])/2,(b[1]+b[3])/2],cx:vr.left+vr.width/2,cy:vr.top+vr.height/2})}
window.PMqa4={zoomToMarkup};
$('#mlBody').addEventListener('click',e=>{if(e.shiftKey||e.ctrlKey||e.metaKey||e.button)return;const t=e.target;
 if(t.closest('input,select,textarea,button,[data-exp],[data-eye],[data-rsend],.lpedit,th'))return;
 const tr=t.closest('tr[data-id]');if(!tr)return;const m=byId(tr.dataset.id);if(!m||!S.sel.has(m.id)||S.sel.size!==1)return;
 const o=openRect(),pr=S.pages[m.page-1]&&S.pages[m.page-1].el.getBoundingClientRect(),b=bboxOf(m);if(pr&&m.page===S.cur){const L=pr.left+b[0]*S.zoom,R=pr.left+b[2]*S.zoom,T=pr.top+b[1]*S.zoom,B=pr.top+b[3]*S.zoom;
  if(L>=o.left&&R<=o.right&&T>=o.top&&B<=o.bottom&&Math.max(R-L,B-T)>=40){viewer.scrollTo({left:viewer.scrollLeft,top:viewer.scrollTop,behavior:'instant'});return}}/* already in full view: just select */
 viewer.scrollTo({left:viewer.scrollLeft,top:viewer.scrollTop,behavior:'instant'});zoomToMarkup(m)});
/* 2b. The floating Properties panel must not hide the markup it is editing: slide the drawing left. */
let btnDown=false;window.addEventListener('pointerdown',()=>{btnDown=true},true);window.addEventListener('pointerup',()=>{btnDown=false;if(needPeek)setTimeout(peek,0)},true);
let needPeek=false;
function selScreenBox(){const ms=[...S.sel].map(byId).filter(m=>m&&m.page);if(!ms.length)return null;let L=1e9,T=1e9,R=-1e9,B=-1e9;
 for(const m of ms){const p=S.pages[m.page-1];if(!p||!p.el)continue;const pr=p.el.getBoundingClientRect(),b=bboxOf(m),sx=pr.width/(p.w||1),sy=pr.height/(p.h||1);
  const xs=[b[0],b[2]].map(x=>pr.left+x*sx),ys=[b[1],b[3]].map(y=>pr.top+y*sy);L=Math.min(L,...xs);R=Math.max(R,...xs);T=Math.min(T,...ys);B=Math.max(B,...ys)}
 return R>L?{L,T,R,B}:null}
function peek(){needPeek=false;if(!document.body.classList.contains('dlSel')||document.body.classList.contains('dlProps'))return;const o=openRect(),v=viewer.getBoundingClientRect();if(o.right>=v.right)return;
 let b=selScreenBox();if(!b||b.R<o.right-12||b.B<v.top||b.T>v.bottom)return;
 const room=b.L-(o.left+24),want=Math.min(b.R-(o.right-24),Math.max(room,0));if(want<=0)return;
 const avail=viewer.scrollWidth-viewer.clientWidth-viewer.scrollLeft,pg=$('#pages');
 if(avail<want&&pg){pg.style.minWidth=(pg.getBoundingClientRect().width+2*(want-avail)+8)+'px';peek.spacer=true;b=selScreenBox()}
 viewer.scrollBy({left:Math.min(b.R-(o.right-24),b.L-(o.left+24)),top:0,behavior:'instant'})}
function unpeek(){if(!peek.spacer)return;peek.spacer=false;const pg=$('#pages');if(pg)pg.style.minWidth=''}
new MutationObserver(()=>{const on=document.body.classList.contains('dlSel');if(on&&!peek.was){needPeek=true;if(!btnDown)setTimeout(peek,0)}if(!on&&peek.was)unpeek();peek.was=on}).observe(document.body,{attributes:true,attributeFilter:['class']});
/* 4. Properties panel in Revu's order: General, Appearance, Layout, Action, then the rest.
      Modules each appended their own sections, so Hatch sat above everything, Subject/Status were buried
      under Layout, there were two Lock buttons and two separate "Line style" boxes. */
const GROUP={'hatch':'app','appearance':'app','text layout':'app','line style':'app','blend':'app','measurement options':'app','count':'app',
 'discipline / scope':'gen','info':'gen','layer':'gen','layout':'lay','action':'act'};
function regroupProps(){const pr=$('#props');if(!pr||!S.sel.size)return;const s2=$('#s2Props',pr);
 if(s2)while(s2.firstChild)pr.insertBefore(s2.firstChild,s2);
 const kids=[...pr.children];const first=kids.findIndex(k=>k.classList.contains('sec'));if(first<0)return;
 const title=kids[first];const blocks=[];let cur=null;
 for(const k of kids.slice(first+1)){if(k.classList.contains('sec')&&k.id!=='s2Props'){cur={h:k,name:k.textContent.trim().toLowerCase().replace(/\s*\(\d+\)$/,''),n:[]};blocks.push(cur)}else if(cur&&k.id!=='s2Props')cur.n.push(k)}
 if(!blocks.length)return;
 const tools=kids.slice(first+1).filter(k=>k.querySelector&&k.querySelector('[data-lp="lock"],[data-lp="hide"]')&&!k.classList.contains('sec'));
 pr.querySelectorAll('[data-mpact="lock"]').forEach(b=>{if(tools.length)b.remove()});
 const genRows=[];for(const b of blocks)for(const n of [...b.n])if(n.querySelector&&n.querySelector('[data-f=subject],[data-f=text],[data-f=label],[data-f=comment],[data-f=status]')){genRows.push(n);b.n.splice(b.n.indexOf(n),1)}
 for(const t of tools)for(const b of blocks){const i=b.n.indexOf(t);if(i>=0)b.n.splice(i,1)}
 const by=g=>blocks.filter(b=>(GROUP[b.name]||'rest')===g);const mk=t=>{const d=document.createElement('div');d.className='sec';d.textContent=t;return d};
 const out=[title,...tools,mk('General'),...genRows],endRows=[];
 const geo=[];for(const b of blocks)for(const n of [...b.n])if(n.querySelector&&n.querySelector('[data-to=centroid]')){geo.push(n);b.n.splice(b.n.indexOf(n),1)}
 const hp=[];for(const b of blocks)for(const n of [...b.n])if(n.querySelector&&[...n.querySelectorAll('button')].some(x=>/^Hatch patterns/.test(x.textContent.trim()))&&b.name!=='hatch'){hp.push(n);b.n.splice(b.n.indexOf(n),1)}
 for(const b of by('gen')){if(b.name==='info'){for(const n of b.n)(n.querySelector&&n.querySelector('button')?endRows:out).push(n)}else if(b.name==='layer'){const lab=document.createElement('label');lab.className='qa4lab';lab.textContent='Layer';lab.style.cssText='display:block;font-size:11px;color:var(--mut);margin:2px 0 3px';out.push(lab,...b.n)}else out.push(b.h,...b.n)}
 const app=by('app'),ap=app.find(b=>b.name==='appearance');if(ap)out.push(ap.h,...ap.n);
 const ls=app.find(b=>b.name==='line style');if(ls){const dash=ap&&ap.n.find(n=>n.querySelector&&n.querySelector('[data-f=dash]'));const lsSel=ls.n.find(n=>n.querySelector&&n.querySelector('[data-s2=lineStyle]'));
  if(dash&&lsSel){mergeLineStyle(dash,lsSel);out.push(...ls.n.filter(n=>n!==lsSel),lsSel)}else out.push(ls.h,...ls.n)}
 for(const b of app)if(b!==ap&&b!==ls){out.push(b.h,...b.n);if(b.name==='hatch')out.push(...hp.splice(0))}out.push(...hp);
 for(const g of ['lay','act','rest'])for(const b of by(g)){out.push(b.h,...b.n);if(g==='lay')out.push(...geo.splice(0))}out.push(...geo,...endRows);
 const tail=kids.filter(k=>!out.includes(k)&&k!==s2&&!blocks.some(b=>b.h===k||b.n.includes(k))&&!kids.slice(0,first).includes(k)&&k.isConnected&&!k.classList.contains('sec'));
 for(const b of blocks)if(!out.includes(b.h))b.h.remove();
 const frag=document.createDocumentFragment();for(const n of [...out,...tail])frag.appendChild(n);if(s2)frag.appendChild(s2);pr.appendChild(frag)}
/* one "Line style" box, like Revu: the dash patterns and the custom line styles in one list */
function mergeLineStyle(dashRow,lsRow){const d=dashRow.querySelector('[data-f=dash]'),l=lsRow.querySelector('[data-s2=lineStyle]');if(!d||!l||dashRow.querySelector('.qa4ls'))return;
 const m=new Select(d,l);l.style.display='none';d.style.display='none';d.insertAdjacentElement('afterend',m)}
function Select(d,l){const x=document.createElement('select');x.className=(d.className||'ti')+' qa4ls';x.dataset.qa4ls='1';
 const o=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
 x.innerHTML=[...d.options].map(op=>o('d:'+op.value,op.textContent)).join('')+[...l.options].filter(op=>op.value).map(op=>o('l:'+op.value,op.textContent)).join('');
 x.value=l.value?'l:'+l.value:'d:'+d.value;
 x.addEventListener('change',e=>{e.stopPropagation();const v=x.value,fire=el=>{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
  if(v.startsWith('l:')){l.value=v.slice(2);fire(l)}else{if(l.value){l.value='';fire(l)}const dd=$('#props [data-f=dash]')||d;dd.value=v.slice(2);fire(dd)}});
 x.addEventListener('input',e=>e.stopPropagation());return x}
/* several markups selected: a field whose values differ is shown blank ("Varies"), as in Revu, instead of the first markup's value */
function markVaries(){if(S.sel.size<2)return;const ms=[...S.sel].map(byId).filter(Boolean);const pr=$('#props');
 const get={subject:m=>m.subject||'',label:m=>m.label||'',comment:m=>m.comment||'',status:m=>m.status||'',width:m=>m.style.width,fontSize:m=>m.style.fontSize};
 for(const[k,g]of Object.entries(get)){const el=pr.querySelector(`[data-f=${k}]`);if(!el)continue;const vals=new Set(ms.map(g));if(vals.size<2)continue;
  if(el.tagName==='SELECT'){if(![...el.options].some(o=>o.value==='__varies')){const o=document.createElement('option');o.value='__varies';o.textContent='(varies)';o.disabled=true;el.insertBefore(o,el.firstChild)}el.value='__varies'}else{el.value='';el.placeholder='(varies)'}}
 pr.querySelectorAll('.hint').forEach(h=>{if(/^Author:/.test(h.textContent.trim()))h.style.display='none'})}
const _rp=renderProps;renderProps=function(){const r=_rp.apply(this,arguments);try{regroupProps();markVaries()}catch(e){console.error('qa4 regroup',e)}return r};
/* 5. Tool Chest: double-click keeps the tool on. The pane is rebuilt on the first click, so the
      browser never delivered the dblclick; detect the second click ourselves. */
let chLast={i:null,t:0};
$('#pane-chest').addEventListener('click',e=>{const it=e.target.closest('.chest');if(!it||e.target.closest('[data-x],button'))return;const i=+it.dataset.i,now=performance.now();const cc=chestAll()[i];if(cc&&toolMode(cc,i)==='props')return;
 if(chLast.i===i&&now-chLast.t<450){chLast={i:null,t:0};e.stopImmediatePropagation();useChest(i,true);toast('Tool locked on — Esc to stop');return}chLast={i,t:now}},true);
/* 6. Dialogs take keyboard focus, so Enter confirms and Esc cancels (as in Revu) even when the dialog has no text box. */
const _modal=modal;modal=function(){const r=_modal.apply(this,arguments);const md=$('#modal');
 setTimeout(()=>{if(!$('#modalBg.on')||md.contains(document.activeElement))return;const b=md.querySelector('.mf .btn.pri')||md.querySelector('.mf .btn:last-child');if(b)b.focus({preventScroll:true})},60);return r};
/* 7. Manage tool sets stays open after Rename / Delete / Duplicate (they open a small dialog first). */
let backToSets=false;
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#modal [data-mop="ren"],#modal [data-mop="del"],#modal [data-mop="dup"]'))backToSets=true},true);
const _cm=closeModal;closeModal=function(){const r=_cm.apply(this,arguments);if(backToSets&&!/Manage tool sets/.test(($('#modal h3')||{}).textContent||'')){backToSets=false;setTimeout(()=>{if(!$('#modalBg.on')&&$('#tcMgr'))$('#tcMgr').click()},0)}return r};
/* 8. Tool Chest like Revu: choose the tool set when adding, create an empty set, right-click a tool for
      Drawing mode / Properties mode, rename, move or delete. Properties mode applies the tool's look to the
      selected markups instead of drawing. */
const chestAll=()=>{const B=(window.PMToolbox&&PMToolbox.BUILTIN)||[];return[...S.chest.map(c=>Object.assign({set:c.set||'My Tools'},c)),...B,...(S.recent||[]).map(c=>Object.assign({},c,{set:'Recent Tools'}))]};
const userSetNames=()=>{const o=[];for(const c of S.chest){const n=c.set||'My Tools';if(!o.includes(n))o.push(n)}if(!o.includes('My Tools'))o.unshift('My Tools');return o};
const tkey=c=>(c.set||'My Tools')+'|'+c.name;
const modeMap=()=>LS.get('pm:qa4:toolModes',{});
function toolMode(c,i){if(i<S.chest.length)return S.chest[i].mode||'draw';return modeMap()[tkey(c)]||'draw'}
function setToolMode(i,mode){const c=chestAll()[i];if(!c)return;if(i<S.chest.length){if(mode==='props')S.chest[i].mode='props';else delete S.chest[i].mode;LS.set('pm:chest',S.chest)}
 else{const mm=modeMap();if(mode==='props')mm[tkey(c)]='props';else delete mm[tkey(c)];LS.set('pm:qa4:toolModes',mm)}renderChest();toast(c.name+': '+(mode==='props'?'Properties mode — click it to restyle the selected markups':'Drawing mode'))}
const STYLE_KEYS=['stroke','fill','fillOpacity','opacity','width','dash','lineStyle','fontSize','font','color','bold','italic','underline','align','headS','headE','leadHead','hatch','hatchColor','blend','cloud','border','marker','radius'];
function applyToolProps(c){const ms=[...S.sel].map(byId).filter(m=>m&&!m.locked);if(!ms.length){toast('Select markups first — this tool is in Properties mode');return}
 pushUndo();for(const m of ms){const base=(S.defaults&&S.defaults[m.type])||{};for(const k of STYLE_KEYS){if(c.style&&c.style[k]!==undefined&&(k in m.style||k in base||['dash','lineStyle','hatch','blend','font','bold','italic'].includes(k)))m.style[k]=clone(c.style[k])}
  if(c.subject)m.subject=c.subject;if(c.depth&&T[m.type]&&T[m.type].meas==='area')m.depth=c.depth;if(c.height&&T[m.type]&&T[m.type].meas==='len')m.height=c.height;m.modified=Date.now()}
 commit();renderProps();toast(`Applied "${c.name}" to ${ms.length} markup${ms.length>1?'s':''}`)}
$('#pane-chest').addEventListener('click',e=>{const it=e.target.closest('.chest');if(!it||e.target.closest('[data-x],button'))return;const i=+it.dataset.i,c=chestAll()[i];if(!c||c._qa4empty)return e.stopImmediatePropagation();
 if(toolMode(c,i)==='props'){e.stopImmediatePropagation();chLast={i:null,t:0};applyToolProps(c)}},true);
$('#pane-chest').addEventListener('dblclick',e=>{const it=e.target.closest('.chest');if(!it)return;const i=+it.dataset.i,c=chestAll()[i];if(c&&(c._qa4empty||toolMode(c,i)==='props'))e.stopImmediatePropagation()},true);
$('#pane-chest').addEventListener('contextmenu',e=>{const it=e.target.closest('.chest');if(!it||!window.PMWorkspace)return;e.preventDefault();const i=+it.dataset.i,c=chestAll()[i];if(!c||c._qa4empty)return;const mine=i<S.chest.length,md=toolMode(c,i);
 PMWorkspace.ctx(e.clientX,e.clientY,[{label:'Drawing mode',check:md!=='props',run:()=>setToolMode(i,'draw')},{label:'Properties mode',check:md==='props',run:()=>setToolMode(i,'props')},'-',
  {label:'Use once',run:()=>useChest(i,false)},{label:'Keep on (lock)',run:()=>useChest(i,true)},'-',
  {label:'Rename…',dis:!mine,run:()=>modalPrompt('Rename tool','Tool name',c.name,n=>{S.chest[i].name=n;LS.set('pm:chest',S.chest);renderChest()})},
  {label:'Move to tool set…',dis:!mine,run:()=>setPicker('Move to tool set',c.set,n=>{S.chest[i].set=n;LS.set('pm:chest',S.chest);renderChest()})},
  {label:'Copy to My Tools',dis:mine,run:()=>{const x=clone(c);delete x._qa4empty;x.set='My Tools';S.chest.push(x);LS.set('pm:chest',S.chest);renderChest();toast('Copied to My Tools')}},
  {label:'Delete',dis:!mine,run:()=>{pushChestUndo();S.chest.splice(i,1);LS.set('pm:chest',S.chest);renderChest()}}])});
function pushChestUndo(){}
function setPicker(title,cur,cb,extra=''){const sets=userSetNames();modal(title,`${extra}<div class="fld"><label>Tool set</label><input class="ti" id="qa4Set" list="qa4SetL" value="${esc(cur||'My Tools')}"><datalist id="qa4SetL">${sets.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div>`,
 [{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>{const n=md.querySelector('#qa4Set').value.trim();if(!n||n==='Recent Tools'){toast('Pick another name');return false}cb(n,md)}}])}
/* Add to Tool Chest: name + tool set */
const _mp=modalPrompt;modalPrompt=function(title,label,val,cb){if(title!=='Add to Tool Chest')return _mp.apply(this,arguments);
 setPicker('Add to Tool Chest','My Tools',(set,md)=>{const name=md.querySelector('#qa4Nm').value.trim()||val;const n0=S.chest.length;cb(name);if(S.chest.length>n0){S.chest[S.chest.length-1].set=set;LS.set('pm:chest',S.chest);dropEmpty();renderChest();toast(`Added to "${set}"`)}},
  `<div class="fld"><label>${esc(label)}</label><input class="ti" id="qa4Nm" value="${esc(val)}"></div>`)};
/* empty tool sets are kept as a hidden placeholder so they sync with the rest of the Tool Chest */
function dropEmpty(){if(!S.chest.some(c=>c._qa4empty))return;const real=new Set(S.chest.filter(c=>!c._qa4empty).map(c=>c.set||'My Tools'));for(let i=S.chest.length-1;i>=0;i--){const c=S.chest[i];if(c._qa4empty&&real.has(c.set))S.chest.splice(i,1)}LS.set('pm:chest',S.chest)}
function newSet(){modalPrompt('New tool set','Name','New Tool Set',n=>{if(userSetNames().includes(n)||n==='Recent Tools'){toast('That tool set already exists');return}
 S.chest.push({set:n,name:'(empty)',type:'rect',_qa4empty:1,style:{stroke:'#888888',width:1,opacity:1}});LS.set('pm:chest',S.chest);renderChest();toast(`Tool set "${n}" created — add tools with right-click → Add to Tool Chest`)})}
const _rc=renderChest;renderChest=function(){dropEmpty();const r=_rc.apply(this,arguments);const pane=$('#pane-chest');if(!pane)return r;const all=chestAll();
 pane.querySelectorAll('.chest').forEach(row=>{const i=+row.dataset.i,c=all[i];if(!c)return;if(c._qa4empty){row.innerHTML='<span class="hint" style="padding:2px 4px">No tools yet. Select a markup → right-click → Add to Tool Chest.</span>';row.style.cursor='default';return}
  if(toolMode(c,i)==='props'){const nm=row.querySelector('.nm');if(nm&&!row.querySelector('.qa4pm')){const b=document.createElement('small');b.className='qa4pm';b.title='Properties mode: click to apply to the selected markups';b.textContent=' ⟲ Properties';b.style.cssText='color:#7dd3fc';nm.appendChild(b)}}});
 return r};
const _modal2=modal;modal=function(title){const r=_modal2.apply(this,arguments);if(title==='Manage tool sets'){const imp=$('#moImp');if(imp&&!$('#qa4NewSet')){const b=document.createElement('button');b.className='btn';b.id='qa4NewSet';b.style.border='1px solid var(--line)';b.textContent='New tool set…';b.onclick=()=>{closeModal();newSet();backToSets=true};imp.parentElement.insertBefore(b,imp)}}return r};
/* 9. Markups list columns like Revu: the header row stays put while the rows scroll, drag a header's right edge to resize, drag a header to move it,
      right-click a header to show/hide columns. Widths and order are saved with the other column settings. */
const LPX=()=>window.PMListPro&&PMListPro.LP;
const saveColsX=()=>{const L=LPX();if(L)LS.set('pm:cols',L.cols)};
let swallowSort=false;
document.addEventListener('click',e=>{if(swallowSort&&e.target.closest&&e.target.closest('#mlBody th')){swallowSort=false;e.stopImmediatePropagation();e.preventDefault()}},true);
function decorateHead(){const L=LPX();const ths=[...$$('#mlBody thead th[data-sort]')];if(!L||!ths.length)return;const W=L.cols.widths||{};
 const th0=$('#mlBody thead th');if(th0){th0.style.position='sticky';th0.style.top='0';th0.style.zIndex='3';th0.style.background='var(--panel,#252525)'}
 ths.forEach(th=>{const k=th.dataset.sort;th.style.position='sticky';th.style.top='0';th.style.zIndex='3';th.style.background=th.style.background||'var(--panel,#252525)';th.draggable=true;th.title=th.title||'Drag to move · drag the edge to resize · right-click for columns';
  if(W[k]){th.style.width=W[k]+'px';th.style.minWidth=W[k]+'px';th.style.maxWidth=W[k]+'px';th.style.overflow='hidden';th.style.textOverflow='ellipsis'}
  if(!th.querySelector('.qa4grip')){const g=document.createElement('span');g.className='qa4grip';g.style.cssText='position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:2';th.appendChild(g)}});
 const idx=Object.fromEntries(ths.map((th,i)=>[th.dataset.sort,i+2]));let css='';for(const[k,w]of Object.entries(W))if(idx[k])css+=`#mlBody table.ml tbody tr:not(.lprep):not(.tgrp) > td:nth-child(${idx[k]}){max-width:${w}px;overflow:hidden;text-overflow:ellipsis}`;
 let st=$('#qa4colcss');if(!st){st=document.createElement('style');st.id='qa4colcss';document.head.appendChild(st)}st.textContent=css}
$('#mlBody').addEventListener('pointerdown',e=>{const g=e.target.closest('.qa4grip');if(!g)return;e.preventDefault();e.stopPropagation();const th=g.parentElement,k=th.dataset.sort,x0=e.clientX,w0=th.getBoundingClientRect().width;let moved=false;
 const mv=ev=>{const w=Math.max(28,Math.round(w0+ev.clientX-x0));moved=true;th.style.width=w+'px';th.style.minWidth=w+'px';th.style.maxWidth=w+'px'};
 const up=ev=>{window.removeEventListener('pointermove',mv,true);window.removeEventListener('pointerup',up,true);if(!moved)return;swallowSort=true;setTimeout(()=>swallowSort=false,300);const L=LPX();if(!L)return;L.cols.widths=Object.assign({},L.cols.widths,{[k]:Math.max(28,Math.round(w0+ev.clientX-x0))});saveColsX();renderList()};
 window.addEventListener('pointermove',mv,true);window.addEventListener('pointerup',up,true)},true);
$('#mlBody').addEventListener('dragstart',e=>{const th=e.target.closest&&e.target.closest('th[data-sort]');if(!th)return;e.stopPropagation();e.dataTransfer.setData('text/pm-col',th.dataset.sort);e.dataTransfer.effectAllowed='move'},true);
$('#mlBody').addEventListener('dragover',e=>{if(e.target.closest&&e.target.closest('th[data-sort]')&&[...e.dataTransfer.types].includes('text/pm-col')){e.preventDefault();e.dataTransfer.dropEffect='move'}});
$('#mlBody').addEventListener('drop',e=>{const th=e.target.closest&&e.target.closest('th[data-sort]');const k=e.dataTransfer.getData('text/pm-col');if(!th||!k)return;e.preventDefault();const L=LPX();if(!L)return;
 const vis=[...$$('#mlBody thead th[data-sort]')].map(t=>t.dataset.sort).filter(x=>x!==k);const r=th.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;let i=vis.indexOf(th.dataset.sort);if(i<0)return;vis.splice(after?i+1:i,0,k);
 const rest=(L.cols.order||[]).filter(x=>!vis.includes(x));L.cols.order=[...vis,...rest];saveColsX();renderList()});
$('#mlBody').addEventListener('contextmenu',e=>{const th=e.target.closest('thead th');if(!th||!window.PMWorkspace)return;e.preventDefault();e.stopPropagation();const L=LPX();if(!L)return;
 const head=[...$$('#mlBody thead th[data-sort]')].map(t=>[t.dataset.sort,t.textContent.replace(/[▲▼]/g,'').trim()]);const hid=L.cols.hidden||[];
 const names={check:'✓ Checked',subject:'Subject',page:'Page',space:'Space',label:'Label',measure:'Measurement',comment:'Comments',author:'Author',date:'Date',status:'Status',type:'Type',color:'Color',layer:'Layer',modified:'Modified'};
 const all=[...head.map(x=>x[0]),...hid.filter(k=>!head.some(x=>x[0]===k))];
 PMWorkspace.ctx(e.clientX,e.clientY,[...all.map(k=>({label:(k==='check'?'Check mark':0)||(head.find(x=>x[0]===k)||[])[1]||names[k]||(k.startsWith('c:')?(L.cols.custom.find(c=>'c:'+c.id===k)||{}).name||k:k),check:!hid.includes(k),run:()=>{L.cols.hidden=hid.includes(k)?hid.filter(x=>x!==k):[...hid,k];saveColsX();renderList()}})),'-',
  {label:'Reset column widths',run:()=>{delete L.cols.widths;saveColsX();renderList()}},{label:'Columns…',run:()=>PMListPro.columnsDialog()}])},true);
const _rl4=renderList;renderList=function(){const r=_rl4.apply(this,arguments);try{decorateHead()}catch(e){console.error('qa4 cols',e)}return r};
/* 10. Profiles also keep the drafting layout: Markups list open/closed, Properties pinned, which side panel is showing. */
function dlState(){const b=document.body.classList,on=$('#left .tabs [data-tab].on');return{ml:b.contains('dlML'),props:b.contains('dlProps'),tab:on?on.dataset.tab:null,leftOpen:$('#left').getBoundingClientRect().width>100}}
function applyDl(d){if(!d)return;const b=document.body.classList;
 if(d.ml!=null&&b.contains('dlML')!==d.ml){const x=$('#dlMLBtn');if(x)x.click()}
 if(d.props!=null&&b.contains('dlProps')!==d.props&&b.contains('dl')){const x=$('#bRight');if(x)x.click()}
 if(d.tab){const t=$(`#left .tabs [data-tab="${d.tab}"]`);if(t&&!t.classList.contains('on'))t.click()}
 setTimeout(()=>{if(d.leftOpen!=null&&($('#left').getBoundingClientRect().width>100)!==d.leftOpen){const t=$('#left .tabs [data-tab].on');if(t)t.click()}},50)}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
 if(t.closest('#vwPS')){const n=($('#vwPN')||{}).value;const snap=dlState();if(n&&n.trim())setTimeout(()=>{const p=LS.get('pm:profiles',{});if(p[n.trim()]){p[n.trim()].dl=snap;LS.set('pm:profiles',p)}},0)}
 if(t.closest('#vwPL')){const n=($('#vwP')||{}).value;const p=LS.get('pm:profiles',{})[n];if(p&&p.dl)setTimeout(()=>applyDl(p.dl),0)}},true);
/* 11. "Reuse" (keep the tool after each markup) is remembered like the other status-bar toggles. */
const saveReuse=()=>setTimeout(()=>LS.set('pm:qa4:reuse',!!S.lock),0);
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#wsReuse,#bLock'))saveReuse()},true);
document.addEventListener('change',e=>{const r=e.target.closest&&e.target.closest('#wsPL .wsprow');if(r&&/Reuse tool/.test(r.textContent))saveReuse()},true);
if(LS.get('pm:qa4:reuse',false)){S.lock=true;try{updateRibbon();if(typeof updStatus==='function')updStatus()}catch(e){}}
/* 12. Settings pulled from the account apply straight away (not only after a reload). */
H.prefs.push(()=>{
 const r=!!LS.get('pm:qa4:reuse',false);if(S.lock!==r&&LS.get('pm:qa4:reuse',null)!==null){S.lock=r;try{updateRibbon();updStatus()}catch(e){}}
 const b=document.body.classList;if(b.contains('dl')){const ml=!!LS.get('pm:dl:ml',false),pr=!!LS.get('pm:dl:props',false);if(b.contains('dlML')!==ml){b.toggle('dlML',ml);const x=$('#dlMLBtn');if(x)x.classList.toggle('on',ml)}if(b.contains('dlProps')!==pr)b.toggle('dlProps',pr);setTimeout(()=>window.dispatchEvent(new Event('resize')),30)}});
/* 13. Layers panel counts (per layer and "Unassigned markups") follow drawing/deleting markups. */
let lyT=0;H.change.push(()=>{clearTimeout(lyT);lyT=setTimeout(()=>{const sec=$('#s2Layers');if(!sec||!sec.offsetParent||sec.contains(document.activeElement)||!window.PMStyles2||!PMStyles2.renderMLayers)return;PMStyles2.renderMLayers()},150)});
/* 14. Next/Previous page pressed quickly (or PageDown twice) moves two pages. While the smooth scroll to the
       first target was running, the scroll tracker reset the current page, so the second press went to the same page. */
let navT=null;const _gp=gotoPage;gotoPage=function(n,instant){const r=_gp.apply(this,arguments);navT=instant?null:{n:S.cur,until:performance.now()+900};return r};
const _uc=updateCur;updateCur=function(){if(navT&&performance.now()<navT.until){const keep=navT.n;const r=_uc.apply(this,arguments);if(S.cur!==keep){S.cur=keep;try{updateCurUI()}catch(e){}}return r}navT=null;return _uc.apply(this,arguments)};
['wheel','pointerdown','touchstart'].forEach(ev=>viewer.addEventListener(ev,()=>{navT=null},{passive:true,capture:true}));
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#bBack,#bFwd'))navT=null},true);window.addEventListener('keydown',e=>{if(e.altKey&&/Arrow(Left|Right)/.test(e.key))navT=null},true);
/* 3. Callout by click-and-drag (arrow point -> text box), as well as click, click. Core dropped the drag. */
let coDown=null;const pageAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&S.pages.find(p=>p.el&&p.el.contains(el))};
viewer.addEventListener('pointerdown',e=>{coDown=null;if(S.tool!=='callout'||S.drawing||e.button!==0||e.pointerType!=='mouse')return;const p=pageAt(e.clientX,e.clientY);if(p)coDown={x:e.clientX,y:e.clientY,p,tip:toPt(e,p)}},true);
window.addEventListener('pointerup',e=>{const d=coDown;coDown=null;if(!d||S.tool!=='callout'||Math.hypot(e.clientX-d.x,e.clientY-d.y)<8)return;
 setTimeout(()=>{if(S.tool!=='callout')return;const dr=S.drawing;if(dr&&(dr.type!=='callout'||dr.pts.length!==1))return;
  if(!dr)S.drawing={type:'callout',page:d.p.num,pts:[d.tip],style:toolStyle('callout')};S.drawing.pts.push(toPt(e,d.p));S.lastUp=0;finishDrawing()},0)},true);
})();
