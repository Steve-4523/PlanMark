/* PlanMark — faster everyday use (1.6.0)
   1. Repeat the last tool: tap Space (holding Space still pans), or right-click an empty spot.
   2. Right-click menus that fit what was clicked: a measurement offers its value, its scale and "draw another";
      text offers "Edit text"; an empty spot offers the last tools, zoom and the scale; rows that cannot apply are left out.
   3. Hover help: rest the mouse on any button for its name, its shortcut key and one line on what it does. */
(function(){
const W=()=>window.PMWorkspace||{};
const isNav=t=>!T[t]||T[t].kind==='nav';
const lab=t=>(T[t]&&T[t].label)||t;
const toolBtn=t=>document.querySelector(`#ribbon .grp:not(.rvNavGrp) .tb[data-tool="${t}"]`)||document.querySelector(`#ribbon .tb[data-tool="${t}"]`);
const titleOf=el=>el?(el.dataset.qt!=null?el.dataset.qt:(el.getAttribute('title')||'')):'';
const KEYRX=/\(((?:Ctrl|Alt|Shift|Space|Esc|Del|Enter|Tab|F\d{1,2}|[A-Z0-9←→↑↓=\-\[\]])(?:\+[^)]+)?)\)/;
const toolKey=t=>{const m=KEYRX.exec(titleOf(toolBtn(t)));return m?m[1]:''};

/* ======================= 1. last tool ======================= */
let last=null;                                   // {t,style,subject,chest} — the last drawing tool and how it was set up
let recent=(LS.get('pm:qk:recent',[])||[]).filter(t=>T[t]&&!isNav(t));
{const _st=setTool;setTool=function(t){const r=_st.apply(this,arguments);
  try{if(T[t]&&!isNav(t)&&t!=='calibrate'){last={t,style:S.chestStyle,subject:S.toolSubject,chest:S.chestSel};recent=[t,...recent.filter(x=>x!==t)].slice(0,6);LS.set('pm:qk:recent',recent)}}catch(e){}return r}}
function useTool(t,o){if(!T[t]||!S.pages.length)return false;
 if(!o){if(t==='image'&&!S.imageSrc&&typeof imagePicker==='function'){imagePicker();return true}
  if(t==='stamp'&&!S.stampText&&typeof stampPicker==='function'){stampPicker();return true}}
 setTool(t,o||{});return true}
const lastTool=()=>last||(recent[0]?{t:recent[0]}:null);
function repeat(){if(!S.pages.length)return false;const l=lastTool();if(!l){toast('Nothing to repeat yet — pick a tool first');return false}
 return useTool(l.t,(l.style||l.subject||l.chest!=null)?{style:l.style,subject:l.subject,chest:l.chest}:null)}

// tap Space = last tool. Holding Space pans (as before), so a tap is: down and up within 0.3 s with no click, drag or wheel between.
const typing=el=>!!(el&&el.closest&&el.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"]'));
const busy=()=>!!(document.querySelector('#modalBg.on,#ezCmd,#wsCtx,.wsDrop,#tgFly,.qaEdit'));
let spT=0,spOK=false;
document.addEventListener('keydown',e=>{if(e.key!==' '||e.repeat)return;spOK=!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.shiftKey&&!typing(e.target)&&!busy();spT=performance.now()},true);
document.addEventListener('pointerdown',()=>{spOK=false},true);
document.addEventListener('wheel',()=>{spOK=false},{capture:true,passive:true});
document.addEventListener('keyup',e=>{if(e.key!==' ')return;const ok=spOK&&performance.now()-spT<300;spOK=false;
 if(!ok||!S.pages.length||S.drawing||S.countId||!isNav(S.tool)||typing(e.target)||busy())return;
 if(lastTool()){e.preventDefault();repeat()}},true);

// the first few times, say so right after a markup is finished
{const _ac=afterCreate;afterCreate=function(m){const r=_ac.apply(this,arguments);
  try{if(m&&!S.lock&&isNav(S.tool)&&!/^(text|callout|typewriter|cloudplus|note|flag|space|image|fattach)$/.test(m.type)){const n=LS.get('pm:qk:taught',0);
   if(n<3){LS.set('pm:qk:taught',n+1);setTimeout(()=>toast(`Tip: tap Space to draw another ${lab(m.type)}`),400)}}}catch(e){}return r}}

window.PM_EXTRA_CMDS_QUICK=()=>[{id:'qk:repeat',menu:'Edit',label:'Repeat last tool',key:'Space',run:repeat,when:()=>S.pages.length>0}];

/* ======================= 2. right-click menus ======================= */
const copyText=async(t,what)=>{try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;left:-999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(_){}ta.remove()}toast('Copied '+(what||t))};
function valueOf(m){if(m.type==='count')return{kind:'count',v:m.pts.length,unit:'',text:String(m.pts.length)};try{const r=measOf(m);return r&&r.text?r:null}catch(e){return null}}
const curPage=n=>{if(n!==S.cur){S.cur=n;try{updateCurUI()}catch(e){}}};
const NO_AGAIN=new Set(['image','fattach','symbol','cstamp','review','texthl','underline','strikeout','squiggly','hlink','viewport','space','calibrate']);
function another(m){if(m.type==='stamp'&&m.text)S.stampText=m.text;setTool(m.type,{style:clone(m.style),subject:m.subject})}
function continueCount(m){curPage(m.page);setTool('count',{style:clone(m.style),subject:m.subject});S.countId=m.id;try{showFinish()}catch(e){}toast('Click each item to add it to this count — press Enter when done')}
function showInList(m){try{if(document.body.classList.contains('dl')){if(!document.body.classList.contains('dlML'))$('#dlMLBtn').click()}else{const ml=$('#mlist');if(ml&&ml.style.display==='none'){ml.style.display='';scheduleRender()}}}catch(e){}
 setSel([m.id]);setTimeout(()=>{const tr=document.querySelector(`#mlBody tr[data-id="${m.id}"]`);if(!tr)return toast('That markup is not in the list right now — check the list’s filter');
  tr.scrollIntoView({block:'center'});tr.classList.add('qkFlash');setTimeout(()=>tr.classList.remove('qkFlash'),1600)},300)}
const plural=(n,w)=>n+' '+w+(n===1?'':'s');

function markupItems(items,{m,from}){
 const sel=[...S.sel].map(byId).filter(Boolean),n=sel.length||1,one=n===1,top=[];
 const take=l=>{const i=items.findIndex(x=>x&&x.label===l);return i<0?null:items.splice(i,1)[0]};
 const takeIf=(l,ok)=>{const it=take(l);return it&&ok&&!it.dis?it:null};
 const subj=m.subject||lab(m.type);
 if(one){const v=valueOf(m),sc=scaleFor(m.page),isMeas=!!(T[m.type]&&(T[m.type].meas||m.type==='count'));
  if(v){top.push({head:`${subj} · ${v.text}${v.kind==='count'?(v.v===1?' item':' items'):''}`});top.push({label:'Copy the value',run:()=>copyText(v.text,v.text)})}
  else top.push({head:subj});
  if(isMeas&&m.type!=='count'&&sc.none)top.push({label:'Scale is not set — set it…',run:()=>{curPage(m.page);scaleDialog()}});
  if(window.PMInlineText&&(PMInlineText.types.has(m.type)||m.type==='note'||m.type==='flag')&&!m.locked&&!m.lock)top.push({label:m.type==='note'||m.type==='flag'?'Edit note…':'Edit text',key:'Double-click',run:()=>PMInlineText.edit(m)});
  if(m.type==='count'&&!m.locked)top.push({label:'Add more to this count',run:()=>continueCount(m)});
  if(!NO_AGAIN.has(m.type)&&T[m.type]&&!isNav(m.type))top.push({label:m.type==='stamp'?'Place another like this':`Draw another like this`,run:()=>another(m)});
  if(isMeas&&m.type!=='count'&&!sc.none)top.push({label:`Scale: ${sc.label} — change…`,run:()=>{curPage(m.page);scaleDialog()}})}
 else{const vs=sel.map(valueOf),all=vs.every(Boolean)&&vs.every(v=>v.kind===vs[0].kind&&v.unit===vs[0].unit);
  if(all){const sum=vs.reduce((a,v)=>a+(+v.v||0),0),raw=vs.reduce((a,v)=>a+(+v.raw||0),0),v0=vs[0];
   // lengths add up in the page's own style (feet and inches stay feet and inches)
   let txt=String(sum);if(v0.kind==='len'&&v0.sc&&vs.every(v=>v.raw!=null)){try{txt=fmtLen(raw,v0.sc)}catch(e){txt=(fmtNum(sum,2)+' '+v0.unit).trim()}}else if(v0.kind!=='count')txt=(fmtNum(sum,(v0.sc&&v0.sc.dec)??2)+' '+v0.unit).trim();
   top.push({head:`${plural(n,'measurement')} · ${txt}${vs[0].kind==='count'?' items':''} in total`});top.push({label:'Copy the total',run:()=>copyText(txt,txt)})}
  else top.push({head:plural(n,'markup')+' selected'})}
 // others like it
 const like=x=>x.type===m.type&&(x.subject||'')===(m.subject||''),onPage=S.markups.filter(x=>x.page===m.page&&like(x)),inDoc=S.markups.filter(like);
 const pick=list=>()=>{if(S.tool!=='select')setTool('select');setSel(list.map(x=>x.id))};
 if(onPage.length>1&&onPage.length>n)top.push({label:`Select all ${onPage.length} “${subj}” on this page`,run:pick(onPage)});
 if(inDoc.length>onPage.length)top.push({label:`Select all ${inDoc.length} “${subj}” in the document`,run:pick(inDoc)});
 if(one)top.push(from==='list'?{label:'Show on the sheet',run:()=>{try{window.PMZoomTo?PMZoomTo(m):gotoPage(m.page)}catch(e){gotoPage(m.page)}}}:{label:'Show in the Markups list',run:()=>showInList(m)});
 // the rest, in a steady order; rows that cannot apply are left out instead of greyed
 const out=[...top,'-',take('Properties'),take('Status'),take('Reply…'),'-',
  take('Cut'),take('Copy'),takeIf('Paste',!!S.clip),takeIf('Paste in place',!!S.clip),take('Duplicate'),'-',
  take('Arrange'),take('Align & size'),takeIf('Convert to',true),take('Straighten curves'),take('Round corners…'),
  take('Lock')||take('Unlock'),takeIf('Group',n>1),takeIf('Ungroup',true),'-',
  take('Magic Markups…'),take('Add to Tool Chest'),take('Set as default style')];
 const del=take('Delete');const rest=items.filter(x=>x&&x!=='-');   // anything another part of the app added
 return tidy([...out,...(rest.length?['-',...rest]:[]),'-',del])}

function zoomAt(f,x,y){try{setZoom(S.zoom*f,anchorAt(x,y))}catch(e){zoomBy(f)}}
function pageItems(items,{p,pt,x,y}){const n=p.num,out=[];
 const take=l=>{const i=items.findIndex(z=>z&&z.label===l);return i<0?null:items.splice(i,1)[0]};
 if(!isNav(S.tool)){out.push({head:lab(S.tool)+' tool'},{label:'Stop — back to Select',key:'Esc',run:()=>setTool('select')},
   {label:'Keep it on after each markup',check:!!S.lock,run:()=>{S.lock=!S.lock;updateRibbon();try{window.PMRevu&&PMRevu.status()}catch(e){}}},'-')}
 else{const l=lastTool();if(l)out.push({label:'Draw another '+lab(l.t),key:'Space',run:repeat});
  const rec=recent.filter(t=>!l||t!==l.t).slice(0,5);if(rec.length)out.push({label:'Recent tools',sub:rec.map(t=>({label:lab(t),key:toolKey(t),run:()=>useTool(t)}))});
  if(out.length)out.push('-')}
 const paste=take('Paste here'),pip=take('Paste in place'),selAll=take('Select all on page');
 if(S.clip&&S.clip.length)out.push(paste,pip);
 if(S.markups.some(m=>m.page===n))out.push(selAll);
 out.push('-',take('Add note here'),take('Add flag here'),take('Add bookmark'),'-');
 out.push({label:'Zoom',sub:[{label:'Zoom in here',run:()=>zoomAt(2,x,y)},{label:'Zoom out',run:()=>zoomAt(.5,x,y)},'-',{label:'Fit page',key:'Ctrl+0',run:()=>{curPage(n);fitPage()}},{label:'Fit width',run:()=>{curPage(n);fitWidth()}},{label:'Actual size (100%)',run:()=>{try{setZoom(1,anchorAt(x,y))}catch(e){setZoom(1)}}}]});
 // scale of this page
 take('Set scale…');const sc=scaleFor(n),SD=window.PMScaleDetect;let prop=null;try{prop=SD&&SD.lastFor(n)}catch(e){}
 if(prop&&prop.sc&&sc.none)out.push({label:`Use the scale on the sheet: ${prop.sc.label}`,run:()=>{const v=SD.applyProposal(prop);if(v===false)return toast('This page has a protected scale');SD.afterApply();toast('Scale set: '+prop.sc.label)}});
 out.push({label:sc.none?'Set scale…':`Scale: ${sc.label} — change…`,run:()=>{curPage(n);scaleDialog()}},{label:'Calibrate from a known length',key:toolKey('calibrate'),run:()=>{curPage(n);setTool('calibrate')}},'-');
 const pg=['Rotate page ↻','Rotate page ↺','Extract page','Delete page…','Copy page as image','More page tools…'].map(take).filter(Boolean);
 if(pg.length)out.push({label:'This page',sub:pg});
 out.push(take('Document properties'));
 const rest=items.filter(z=>z&&z!=='-');return tidy([...out,...(rest.length?['-',...rest]:[])])}

function thumbItems(items,{n,pages}){items=items.filter(z=>z==='-'||(z&&!z.dis));if(pages&&pages.length>1)return tidy(items);const sc=scaleFor(n),SD=window.PMScaleDetect;let prop=null;try{prop=SD&&SD.lastFor(n)}catch(e){}const add=[];
 if(prop&&prop.sc&&sc.none)add.push({label:`Use the scale on the sheet: ${prop.sc.label}`,run:()=>{const v=SD.applyProposal(prop);if(v===false)return toast('This page has a protected scale');SD.afterApply();toast('Scale set: '+prop.sc.label)}});
 add.push({label:sc.none?'Set scale for this page…':`Scale: ${sc.label} — change…`,run:()=>{gotoPage(n,true);setTimeout(scaleDialog,40)}});
 if(W().copyPageImage)add.push({label:'Copy page as image',run:()=>W().copyPageImage(n)});
 const i=items.findIndex(z=>z==='-');items.splice(i<0?items.length:i+1,0,...add,'-');return tidy(items)}

function tabItems(items,{t,vw}){const go=f=>async()=>{try{if(vw.curTab!==t.id){vw.switchTo(t.id);await new Promise(r=>setTimeout(r,250))}f()}catch(e){console.error(e)}};
 const cmd=rx=>{const c=(W().CMDS||[]).find(c=>c.menu==='File'&&rx.test(c.label));return c&&c.run};const save=cmd(/^Save \(markups/)||(()=>exportPDF(false)),saveAs=cmd(/^Save As…$/),print=cmd(/^Print…$/);
 const add=[{label:'Save',key:'Ctrl+S',run:go(save)}];if(saveAs)add.push({label:'Save As…',key:'Ctrl+Shift+S',run:go(saveAs)});if(print)add.push({label:'Print…',key:'Ctrl+P',run:go(print)});
 return tidy([...items.filter(z=>z==='-'||!z||!z.dis),'-',...add])}

// no empty rows, no doubled or leading/trailing separators
function tidy(a){const out=[];for(const it of a){if(!it)continue;if(it==='-'){if(!out.length||out[out.length-1]==='-')continue}out.push(it)}while(out.length&&out[out.length-1]==='-')out.pop();return out}
function menu(kind,items,info){const f={markup:markupItems,page:pageItems,thumb:thumbItems,tab:tabItems}[kind];return f?f(items.slice(),info||{}):items}

// tool buttons: related tools open their list (toolgroups.js); a button on its own gets a short menu
document.addEventListener('contextmenu',e=>{const b=e.target.closest&&e.target.closest('#ribbon .tb[data-tool]');if(!b||!W().ctx||e.defaultPrevented)return;const t=b.dataset.tool;e.preventDefault();
 W().ctx(e.clientX,e.clientY,[{head:lab(t)},{label:'Use it',key:toolKey(t),run:()=>b.click()},isNav(t)||t==='stamp'?null:{label:'Keep it on until Esc',key:'Double-click',run:()=>setTool(t,{lock:true})},'-',{label:'Change shortcut keys…',run:()=>W().shortcutEditor&&W().shortcutEditor()}].filter(Boolean))});
// the scale in the status bar: right-click does what a click does
document.addEventListener('contextmenu',e=>{const b=e.target.closest&&e.target.closest('#rvScale');if(b&&S.pages.length){e.preventDefault();b.click()}});

// rows in the side panels (bookmarks, recent files, flags…): the little icons at the end of a row, as a menu with words
document.addEventListener('contextmenu',e=>{if(e.defaultPrevented||!W().ctx)return;const row=e.target.closest&&e.target.closest('#left .res,#left [data-rk],#empty .ezRow');if(!row)return;
 const acts=[...row.querySelectorAll('[title]')].filter(a=>a!==row&&a.offsetWidth>0&&titleOf(a).trim()&&titleOf(a).trim().length<40);if(!acts.length)return;
 e.preventDefault();const main=row.querySelector('[data-bgo],.n')||row.firstElementChild||row,name=(main.textContent||'').trim().replace(/\s+/g,' ');
 W().ctx(e.clientX,e.clientY,[{head:name.length>44?name.slice(0,43)+'…':name},{label:row.closest('#pane-bookmarks')?'Go to it':'Open',run:()=>main.click()},'-',...acts.map(a=>({label:titleOf(a).trim(),run:()=>a.click()}))])});

/* ======================= 3. hover help ======================= */
const TOOL={
 select:'Pick, move and resize markups. Drag a box to pick several.',pan:'Drag the sheet around. Holding Space does the same from any tool.',seltext:'Select and copy words from the PDF.',
 text:'Type words in a box on the sheet. Drag a box, then type.',typewriter:'Click and type right on the sheet, with no box.',note:'A small sticky note. Click a spot, then type.',callout:'A text box with an arrow pointing at something.',
 highlight:'A marker. Drag over anything to highlight it.',texthl:'Highlight words in the PDF. Drag across the text.',underline:'Underline words in the PDF. Drag across the text.',strikeout:'Cross out words in the PDF. Drag across the text.',squiggly:'A squiggly line under words in the PDF.',review:'Mark words to insert, delete or replace, like an editor’s pen.',
 pen:'Draw freehand.',eraser:'Rub out parts of pen and highlighter strokes.',
 cloud:'Revision cloud. Drag a box around what changed.',cloudplus:'A cloud with a text callout attached.',
 stamp:'Stamps such as APPROVED or REVIEWED. Pick one, then click to place it.',cstamp:'Your own stamps.',symbol:'Drawing symbols such as tags and section marks.',image:'Put a picture or photo on the sheet.',fattach:'Attach a file to a spot on the sheet.',flag:'Drop a flag on a spot you need to come back to.',hlink:'Make an area you can click to jump to a page, a sheet or a website.',
 line:'Straight line. Click the start, then the end.',arrow:'Arrow. Click the tail, then the tip.',arc:'A curved line through three points.',polyline:'A line with several segments. Click each corner, double-click to finish.',dimension:'A dimension line with the length written on it, using the page scale.',
 rect:'Rectangle. Drag from corner to corner.',ellipse:'Circle or oval. Drag to size it.',polygon:'A closed shape with any number of corners. Double-click to finish.',
 length:'Measure a straight distance between two points.',polylength:'Measure a path with several segments, such as a pipe or wall run.',perimeter:'Measure the distance all the way around a shape.',arclen:'Measure along a curve.',qmeasure:'Check a distance quickly without leaving a markup.',
 area:'Measure the area of a shape. Click each corner, double-click to finish.',volume:'Area times a depth, for concrete, fill or excavation.',count:'Count items. Click each one, then press Enter.',
 angle:'Measure the angle between two lines.',circle:'Measure a circle’s diameter.',radius:'Measure a circle’s radius.',rad3:'Find a curve’s radius from three points on it.',
 calibrate:'Set the scale by drawing over a known length, such as a written dimension.',viewport:'Give part of a sheet its own scale, for details drawn at another scale.'};
const BYID={
 dlSingle:'Show one page at a time.',dlCont:'Scroll through all the pages in one long strip.',dlSplitV:'Split the screen side by side. Click again to split the pane you are in.',dlSplitH:'Split the screen top and bottom. Click again to split the pane you are in.',
 dlPan:TOOL.pan,dlSel:TOOL.select,dlSelT:TOOL.seltext,bZbox:'Drag a box on the sheet to zoom into it.',
 dlFirst:'Go to the first page.',bPrev:'Go to the page before this one.',bNext:'Go to the next page.',dlLast:'Go to the last page.',pageIn:'Type a page number or a sheet number and press Enter.',
 bBack:'Go back to the view you were at before.',bFwd:'Go forward again.',rvDim:'Dim the drawing so your markups stand out.',dlSync:'Keep split panes scrolling and zooming together.',rvSync:'Keep split panes scrolling and zooming together.',
 bLoupe:'A magnifying glass that follows the mouse.',bZout:'Zoom out.',bZin:'Zoom in.',bFitW:'Fit the page’s width to the window.',bFitP:'Show the whole page.',bRotL:'Turn the view to the left. The file itself is not changed.',bRotR:'Turn the view to the right. The file itself is not changed.',bRul:'Show rulers along the top and left.',bSplit:'Show two views side by side.',
 dlMLBtn:'Open or close the Markups list: every markup and measurement in a table you can sort, filter and export.',rvGrid:'Show a grid over the sheet.',rvSnapG:'Points jump to the grid as you draw.',rvSnapC:'Points jump to lines and corners in the drawing. Best for accurate takeoffs.',rvSnapM:'Points jump to the corners of other markups.',rvReuse:'Keep the same tool after each markup, until you press Esc.',
 rvScale:'The scale of this page. Click to set it, change it or calibrate.',bLock:'Keep the tool on after each markup.',tgMore:'Print, compare, overlay, OCR, forms, signatures and the other document tools.',bAcct:'Your account and sign-in.',clBell:'Messages and updates.'};
const TAB={pages:'A small picture of every page. Click to jump, drag to reorder, right-click for page tools.',bookmarks:'Places in the set you can jump to.',search:'Find words in the drawings.',chest:'Your saved tools, such as a ready-made cloud or a “Sidewalk” area. One click to reuse.',
 measure:'The scale, the units and the totals for this page’s measurements.',layers:'Turn drawing layers and markup layers on and off.',sets:'Open several PDFs as one set of sheets.',files:'Recent files on this computer.',attach:'Files attached to this PDF.',spaces:'Named rooms or zones, so takeoffs can be sorted by where they are.',
 signatures:'Signature fields and who has signed.',field:'Punch items, RFIs and submittals pinned to the sheets.',forms:'Fill in or build PDF forms.',history:'Every step you took. Click one to go back to it.',links:'All the clickable links in this PDF.',flags:'Every flag you dropped, with its note.',cspell:'Checks the spelling of the drawing’s own text.',pkg:'PDF packages: several files held in one PDF.'};

const css=document.createElement('style');css.textContent=`
#qkTip{position:fixed;z-index:400;max-width:270px;background:var(--panel,#252525);color:var(--text,#eee);border:1px solid var(--line,#444);border-radius:7px;box-shadow:0 8px 26px rgba(0,0,0,.45);padding:7px 10px;font-size:12px;line-height:1.35;pointer-events:none;opacity:0;transition:opacity .08s}
#qkTip.on{opacity:1}
#qkTip .n{font-weight:600;font-size:12.5px;display:flex;align-items:center;gap:10px}
#qkTip .n kbd{margin-left:auto;font-weight:400;font-size:10.5px;white-space:nowrap}
#qkTip .d{margin-top:3px;color:var(--text,#eee);opacity:.86}
#qkTip .h{margin-top:4px;color:var(--mut,#999);font-size:11px}
.wsHd{padding:4px 10px 3px;font-size:11.5px;font-weight:600;color:var(--mut,#999);white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis}
#mlBody tr.qkFlash td{background:var(--accbg,#2b3a4d)!important;transition:background .3s}`;document.head.appendChild(css);

function tipData(el){const raw=titleOf(el).trim();if(!raw)return null;
 let name=raw,key='',desc='',hint='';
 const km=KEYRX.exec(raw);if(km){key=km[1];name=raw.slice(0,km.index).trim()||raw.replace(km[0],'').trim();const after=raw.slice(km.index+km[0].length).replace(/^\s*[—:·-]\s*/,'').trim();if(after)desc=after}
 else{const sp=/\s[—:]\s|:\s/.exec(raw);if(sp&&sp.index>1&&sp.index<40){name=raw.slice(0,sp.index).trim();desc=raw.slice(sp.index+sp[0].length).trim()}}
 const t=el.dataset.tool,tab=el.dataset.tab;
 if(t&&T[t]){name=lab(t);desc=TOOL[t]||'';const parts=[];if(!isNav(t)&&t!=='stamp')parts.push('Double-click to keep it on');
   if(el.classList.contains('tgFam')&&window.PMToolGroups){const f=PMToolGroups.famOf(t);const others=f?f[2].filter(x=>x!==t&&toolBtn(x)).map(lab):[];if(others.length)parts.push('Right-click or hold for '+others.slice(0,5).join(', ')+(others.length>5?'…':''))}
   hint=parts.join(' · ')}
 else if(el.dataset.rib!=null){const sp=el.querySelector('span');if(sp){name=sp.textContent;desc=raw===name?'':raw.replace(/\s*\((Ctrl|Alt|Shift)[^)]*\)\s*$/,'')}}
 else if(tab&&el.closest('#left .tabs')){name=raw.replace(KEYRX,'').trim()||name;desc=TAB[tab]||desc;hint='Right-click to hide this panel'}
 else if(el.closest('#tgFly')){const tx=el.querySelector('.t');if(tx){name=tx.textContent;desc=raw.replace(KEYRX,'').trim();key=''}}
 else if(el.id==='pageIn'){name='Page';desc=BYID.pageIn+(raw?' — '+raw:'')}
 else if(el.id&&BYID[el.id]){desc=BYID[el.id];name=el.id==='tgMore'?'More':name.replace(/\s*\([^)]*\)\s*$/,'')||name}
 desc=desc.replace(/^double-click to lock.*$/i,'').replace(/\s*—\s*double-click to lock.*$/i,'');
 if(!name)return null;if(desc&&desc.toLowerCase()===name.toLowerCase())desc='';
 return{name,key,desc,hint}}

let tip=null,tipFor=null,tipT=0,warm=0;
function hideTip(){clearTimeout(tipT);if(tip&&tip.classList.contains('on')){tip.classList.remove('on');warm=performance.now()}
 if(tipFor){const el=tipFor;tipFor=null;if(el.dataset.qt!=null){if(!el.hasAttribute('title'))el.setAttribute('title',el.dataset.qt);delete el.dataset.qt}}}
function showTip(el){const d=tipData(el);if(!d||!document.contains(el))return;if(!tip){tip=document.createElement('div');tip.id='qkTip';tip.setAttribute('role','tooltip');document.body.appendChild(tip)}
 tip.innerHTML=`<div class="n"><span>${esc(d.name)}</span>${d.key?`<kbd>${esc(d.key)}</kbd>`:''}</div>${d.desc?`<div class="d">${esc(d.desc)}</div>`:''}${d.hint?`<div class="h">${esc(d.hint)}</div>`:''}`;
 const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;let x,y;
 if(r.right>innerWidth-90&&r.width<120&&r.height<120&&r.top>60){x=r.left-w-8;y=r.top+(r.height-h)/2}                       // right-hand strip: to its left
 else if(r.left<64&&r.width<64&&el.closest('#left .tabs')&&r.height<64&&getComputedStyle(el.parentElement).flexDirection==='column'){x=r.right+8;y=r.top+(r.height-h)/2}   // left strip: to its right
 else{x=r.left+(r.width-w)/2;y=r.bottom+8;if(y+h>innerHeight-6)y=r.top-h-8}
 tip.style.left=Math.max(6,Math.min(innerWidth-w-6,x))+'px';tip.style.top=Math.max(6,Math.min(innerHeight-h-6,y))+'px';tip.classList.add('on')}
const skipTip=el=>!(el instanceof HTMLElement)||!!el.closest('#qkTip,.page,.qaEdit,#wsCtx,.wsDrop');
document.addEventListener('pointerover',e=>{if(e.pointerType==='touch'||e.buttons)return;const el=e.target.closest&&e.target.closest('[title],[data-qt]');if(el===tipFor)return;hideTip();
 if(!el||skipTip(el)||!titleOf(el).trim())return;tipFor=el;if(el.hasAttribute('title')){el.dataset.qt=el.getAttribute('title');el.removeAttribute('title')}
 tipT=setTimeout(()=>{if(tipFor===el)showTip(el)},performance.now()-warm<700?90:480)},true);
document.addEventListener('pointerout',e=>{if(tipFor&&(!e.relatedTarget||!tipFor.contains(e.relatedTarget)))hideTip()},true);
for(const ev of ['pointerdown','keydown','wheel','contextmenu'])document.addEventListener(ev,hideTip,{capture:true,passive:true});
addEventListener('blur',hideTip);document.addEventListener('scroll',hideTip,true);

window.PMQuick={menu,repeat,useTool,lastTool,get recent(){return recent.slice()},tipData,showTip,hideTip,titleOf,TOOL};
})();
