/* PlanMark — easier to use (1.5.8)
   - Find a command (Ctrl+Shift+P): type what you want, every menu command and setting comes up with its shortcut
   - Start screen: recent files, your name for markups, the three first steps
   - One Export… window instead of five export items in the File menu
   - Measurement labels and count dots stay readable when zoomed far out
   - The Bluebeam-layout tool strip shows that more tools are below
   - Panels that only work inside claude.ai are hidden in the desktop app and website */
(function(){
const onClaude=()=>!!(window.claude&&window.claude.use);
const W=()=>window.PMWorkspace||{};
const isDL=()=>document.body.classList.contains('dl');

/* ---------- first run: one welcome, no "What's new" list, no tip on top of it ---------- */
const FIRST=(()=>{try{return localStorage.getItem('pm:ws:seen')===null&&localStorage.getItem('pm:tipN')===null&&localStorage.getItem('pm:easy')===null}catch(e){return false}})();
window.PM_FIRST_RUN=FIRST;
try{if(FIRST){LS.set('pm:ws:seen',(window.PMWorkspace||{}).wsVer||'');LS.set('pm:tipN',0)}LS.set('pm:easy',1)}catch(e){}

const css=document.createElement('style');css.textContent=`
#empty .card{max-width:520px}
#empty .ezSteps{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:14px 0 0;font-size:12px;color:var(--mut)}
#empty .ezSteps span{border:1px solid var(--line);border-radius:12px;padding:3px 10px}
#empty .ezRec{margin-top:18px;text-align:left}
#empty .ezRec .h{font-size:11.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;display:flex}
#empty .ezRec .h a{margin-left:auto;text-transform:none;letter-spacing:0;cursor:pointer;color:var(--mut)}
#empty .ezRow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer}
#empty .ezRow:hover{background:var(--accbg)}
#empty .ezRow .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
#empty .ezRow small{color:var(--mut);white-space:nowrap}
#empty .ezRow .x{opacity:0;background:none;border:0;color:var(--mut);cursor:pointer;font-size:13px}
#empty .ezRow:hover .x{opacity:1}
#empty .ezName{margin-top:16px;display:flex;gap:8px;align-items:center;justify-content:center;font-size:12.5px;color:var(--mut)}
#empty .ezName input{width:180px;height:28px}
#empty .ezFind{margin-top:12px;font-size:12px;color:var(--mut)}
#empty .ezFind a{color:var(--acc);cursor:pointer}
#ezCmd{position:fixed;left:50%;top:70px;transform:translateX(-50%);width:560px;max-width:calc(100vw - 30px);z-index:300;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.5);overflow:hidden}
#ezCmd input{width:100%;box-sizing:border-box;height:42px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);padding:0 14px;font-size:15px;outline:none}
#ezCmd .l{max-height:min(420px,60vh);overflow:auto;padding:4px}
#ezCmd .r{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:5px;cursor:pointer;font-size:13px}
#ezCmd .r.on{background:var(--accbg)}
#ezCmd .r .m{color:var(--mut);font-size:11.5px;min-width:74px}
#ezCmd .r .t{flex:1}
#ezCmd .r kbd{font-size:11px}
#ezCmd .r.dis{opacity:.45}
#ezCmd .e{padding:14px;color:var(--mut);font-size:12.5px}
#ezCmd .f{padding:6px 12px;border-top:1px solid var(--line);color:var(--mut);font-size:11px}
body.dl #ribbon .ezMore{position:sticky;z-index:2;width:42px;min-height:22px;flex:0 0 auto;display:none;align-items:center;justify-content:center;border:0;border-radius:4px;cursor:pointer;color:var(--text);background:var(--rvBg,#1f1f1f);font-size:11px;line-height:1;padding:3px 0}
body.dl #ribbon .ezMore.on{display:flex}
body.dl #ribbon .ezMore:hover{background:var(--rvOn,#333)}
body.dl #ribbon .ezMore.dn{bottom:-4px;box-shadow:0 -8px 10px -4px rgba(0,0,0,.45);flex-direction:column}
body.dl #ribbon .ezMore.up{top:-4px;box-shadow:0 8px 10px -4px rgba(0,0,0,.45)}
body.dl #dlNav #rvNavScale{display:none!important}
#rvPB .ezHint{color:var(--mut);font-size:12px;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dlSc.ezSays{color:#d29922!important}
`;document.head.appendChild(css);

/* ---------- recent files (the same list as the Files panel, kept on this device) ---------- */
const R=()=>window.PMRecent;
async function recentList(){try{return R()?await R().list():[]}catch(e){return[]}}
async function openRecent(key){try{const f=R()&&await R().get(key);if(!f)return toast('That file is no longer kept here — open it again with Open PDF');await openBytes(new Uint8Array(f.bytes),f.name)}catch(e){toast('Could not reopen that file')}}
async function forget(key){try{await R().del(key)}catch(e){}renderStart()}
const ago=t=>{const s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';const d=Math.round(s/86400);return d===1?'yesterday':d<30?d+' days ago':new Date(t).toLocaleDateString()};
const mb=n=>n>=1048576?(n/1048576).toFixed(n>=1e8?0:1)+' MB':Math.max(1,Math.round(n/1024))+' KB';

/* ---------- start screen ---------- */
let renderT=0;
function renderStart(){clearTimeout(renderT);renderT=setTimeout(async()=>{const card=$('#empty .card');if(!card)return;
 let ex=card.querySelector('.ezExtra');if(!ex){ex=document.createElement('div');ex.className='ezExtra';card.appendChild(ex)}
 const list=(await recentList()).slice(0,8);
 const needName=!settings.author||settings.author==='User';
 ex.innerHTML=`${list.length?'':`<div class="ezSteps"><span>1 · Open a set</span><span>2 · Check the scale</span><span>3 · Pick Length and click two points</span></div>`}
  ${list.length?`<div class="ezRec"><div class="h">Recent files<a data-a="all">Files panel</a></div>${list.map(f=>`<div class="ezRow" data-k="${esc(f.key)}" title="${esc(f.name)}"><span class="n">${esc(f.name)}</span><small>${f.pages?f.pages+' pages · ':''}${mb(f.size)} · ${ago(f.at)}</small><button class="x" data-x="${esc(f.key)}" title="Remove from this list">✕</button></div>`).join('')}</div>`:''}
  ${needName?`<div class="ezName">Your name on markups <input class="ti" id="ezName" placeholder="e.g. Steve" maxlength="60"></div>`:''}
  <div class="ezFind">Looking for something? <a data-a="find">Find a command</a> <kbd>Ctrl+Shift+P</kbd></div>`;
 ex.onclick=e=>{const x=e.target.closest('[data-x]');if(x){e.stopPropagation();return forget(x.dataset.x)}
  const r=e.target.closest('[data-k]');if(r)return openRecent(r.dataset.k);
  const a=e.target.closest('[data-a]');if(!a)return;if(a.dataset.a==='find')return find();if(a.dataset.a==='all'){const b=$('#left .tabs [data-tab="files"]');if(b){$('#left').classList.remove('dlCollapsed');b.click()}}};
 const nm=ex.querySelector('#ezName');if(nm){const save=()=>{const v=nm.value.trim();if(!v)return;settings.author=v;LS.set('pm:settings',settings);toast('Markups will show “'+v+'”');renderStart()};nm.addEventListener('change',save);nm.addEventListener('keydown',e=>{if(e.key==='Enter')save()})}
 },60)}
H.ready.push(()=>setTimeout(renderStart,200));
addEventListener('pm:recent',()=>renderStart());   // the file just opened goes to the top of the list (saved once its sheets are drawn)
new MutationObserver(()=>{const e=$('#empty');if(e&&e.style.display!=='none')renderStart()}).observe($('#empty'),{attributes:true,attributeFilter:['style']});

/* ---------- Find a command ---------- */
let box=null,sel=0,shown=[];
const norm=s=>String(s||'').toLowerCase().replace(/[…▸•]/g,' ').replace(/\s+/g,' ').trim();
// words people use for things that have another name in the menus
const ALIAS={calibrate:'scale',scale:'calibrate',count:'tally',excel:'export xlsx spreadsheet',csv:'export',compare:'overlay difference revision',overlay:'compare',rotate:'turn',
 delete:'remove',flatten:'burn',bookmark:'outline',stamp:'approved',cloud:'revision',area:'square feet sf',length:'distance measure lf',
 print:'plot',signature:'sign',hyperlink:'link',crop:'trim',ocr:'text recognition searchable',split:'side by side',email:'send mail'};
function allItems(){const out=[];const cmds=(W().CMDS||[]);const keyOf=c=>{try{const ck=LS.get('pm:keys',{});const v=ck['ws:'+c.id];return v!==undefined?v:c.key}catch(e){return c.key}};
 for(const c of cmds){if(c.hidden&&!c.ezFind)continue;if(c.id==='ez:find')continue;const lab=String(c.label||'').replace(/^Export ▸ /,'Export to ').replace(/^Import ▸ /,'Import ');
  out.push({menu:c.menu==='Panels'?'Panel':c.menu==='PlanMark'?'Settings':c.menu,label:lab,key:keyOf(c),run:c.run,when:c.when,txt:norm(lab+' '+c.menu+' '+(ALIAS[norm(lab).split(' ')[0]]||''))})}
 // preferences, so "line weight" or "author" finds the setting
 try{for(const d of (W().prefDefs?W().prefDefs():[]))if(d&&d.l)out.push({menu:'Setting',label:d.l,key:'',run:()=>openPref(d.l),txt:norm(d.l+' '+(d.s||'')+' '+(d.h||'')+' setting preference option')})}catch(e){}
 return out}
// Preferences, already searched for the setting you picked
function openPref(l){if(!W().prefsDialog)return;W().prefsDialog();setTimeout(()=>{const q=$('#wsPQ');if(!q)return;q.value=l.toLowerCase();q.dispatchEvent(new Event('input'))},0)}
function score(it,q){if(!q)return 1;const ws=q.split(' ');let s=0;for(const w of ws){const i=it.txt.indexOf(w);if(i<0)return 0;s+=i===0?6:it.txt[i-1]===' '?4:1}
 if(norm(it.label).startsWith(q))s+=10;return s}
function list(q){q=norm(q);const items=allItems().map(it=>({it,s:score(it,q)})).filter(x=>x.s>0);
 if(!q){const rec=LS.get('pm:ez:recent',[]);return rec.map(l=>items.find(x=>x.it.label===l)).filter(Boolean).map(x=>x.it).concat(items.filter(x=>!rec.includes(x.it.label)&&/^(Open|Save|Print|Set scale|Calibrate|Check scale|Length|Area|Count|Markups list|Compare|Export…)/.test(x.it.label)).map(x=>x.it)).slice(0,14)}
 return items.sort((a,b)=>b.s-a.s).slice(0,40).map(x=>x.it)}
function draw(){const l=box.querySelector('.l');if(!shown.length){l.innerHTML=`<div class="e">Nothing matches. Try another word, like “scale”, “excel” or “rotate”.</div>`;return}
 l.innerHTML=shown.map((it,i)=>{const dis=it.when&&!safe(it.when);return`<div class="r${i===sel?' on':''}${dis?' dis':''}" data-i="${i}"><span class="m">${esc(it.menu)}</span><span class="t">${esc(it.label)}</span>${it.key?`<kbd>${esc(it.key)}</kbd>`:''}</div>`}).join('');
 const on=l.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'})}
const safe=f=>{try{return f()}catch(e){return false}};
function run(i){const it=shown[i];if(!it)return;if(it.when&&!safe(it.when))return toast('Not available right now'+(S.pages.length?'':' — open a PDF first'));close();
 LS.set('pm:ez:recent',[it.label,...LS.get('pm:ez:recent',[]).filter(x=>x!==it.label)].slice(0,6));setTimeout(()=>{try{it.run()}catch(e){console.error(e)}},0)}
function close(){if(box){box.remove();box=null;removeEventListener('pointerdown',outside,true)}}
const outside=e=>{if(box&&!box.contains(e.target))close()};
function find(){if(box)return close();box=document.createElement('div');box.id='ezCmd';
 box.innerHTML=`<input placeholder="Type a command or setting — scale, count, export excel, rotate…" spellcheck="false"><div class="l"></div><div class="f">↑ ↓ to choose · Enter to run · Esc to close</div>`;document.body.appendChild(box);
 const inp=box.querySelector('input');shown=list('');sel=0;draw();inp.focus();
 inp.addEventListener('input',()=>{shown=list(inp.value);sel=0;draw()});
 inp.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(shown.length-1,sel+1);draw()}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);draw()}
  else if(e.key==='Enter'){e.preventDefault();run(sel)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}});
 box.querySelector('.l').addEventListener('click',e=>{const r=e.target.closest('[data-i]');if(r)run(+r.dataset.i)});
 box.querySelector('.l').addEventListener('mousemove',e=>{const r=e.target.closest('[data-i]');if(r&&+r.dataset.i!==sel){sel=+r.dataset.i;box.querySelectorAll('.r').forEach((x,i)=>x.classList.toggle('on',i===sel))}});
 setTimeout(()=>addEventListener('pointerdown',outside,true),0)}

/* ---------- one Export… window ---------- */
const EXP=[['takeoff','Takeoff to Excel','Every measurement with page, subject and quantity (.xlsx)',/^Export takeoff to Excel$/],
 ['csv','Markups list (CSV)','The Markups list as it is filtered and sorted now',/^Export markups list \(CSV\)$/],
 ['summary','Markup summary report','PDF or spreadsheet report of the markups, grouped',/^Markup summary report/],
 ['word','Word document','The PDF\'s text and pictures in a .docx',/Word \(\.docx\)/],
 ['xltext','Excel (text tables)','Tables of text found on the pages',/Excel \(text tables\)/],
 ['img','Images','Pages as PNG, JPEG or TIFF',/Images \(PNG/],
 ['xfdf','Markups as XFDF','For Bluebeam, Acrobat and other PDF apps',/^Export ▸ Markups as XFDF$/],
 ['data','Markup data (import / export)','Markups as JSON to move between files',/^Markup data \(import/]];
const isExp=c=>c.menu==='File'&&EXP.some(e=>e[3].test(c.label));
function exportDialog(){if(!S.pages.length)return toast('Open a PDF first');const cmds=W().CMDS||[];
 const rows=EXP.map(([id,lab,hint,re])=>({id,lab,hint,c:cmds.find(c=>c.menu==='File'&&re.test(c.label))})).filter(r=>r.c);
 modal('Export',`<div class="hint" style="margin-bottom:8px">Choose what to export. The Markups list exports follow its current filter.</div>
  <div style="display:flex;flex-direction:column;gap:4px">${rows.map(r=>`<button class="btn" data-ex="${r.id}" style="justify-content:flex-start;text-align:left;height:auto;padding:7px 10px;border:1px solid var(--line);display:block"><b style="font-weight:600">${esc(r.lab)}</b><br><small style="color:var(--mut)">${esc(r.hint)}</small></button>`).join('')}</div>`,[{label:'Close',cancel:1}]);
 $('#modal').querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.ex);closeModal();setTimeout(()=>{try{r.c.run()}catch(e){console.error(e)}},0)})}

/* ---------- commands ---------- */
window.PM_EXTRA_CMDS_EASY=()=>[
 {id:'ez:find',menu:'Help',label:'Find a command…',key:'Ctrl+Shift+P',run:find},
 {id:'ez:export',menu:'File',label:'Export…',key:'',run:exportDialog,when:()=>S.pages.length>0}];
// after the menus are built: the separate export items leave the File menu (still found by Find a command),
// Export… sits where they were, and panels that only work on claude.ai leave the desktop app and website
H.ready.push(()=>setTimeout(()=>{const cmds=W().CMDS;if(!cmds)return;
 const first=cmds.findIndex(isExp),ex=cmds.findIndex(c=>c.id==='ez:export');
 if(first>=0&&ex>first){const[e]=cmds.splice(ex,1);cmds.splice(first,0,e)}
 for(const c of cmds)if(isExp(c)){c.hidden=1;c.ezFind=1}
 const fi=cmds.findIndex(c=>c.id==='ez:find');if(fi>0){const[f]=cmds.splice(fi,1);const h=cmds.findIndex(c=>c.menu==='Help');cmds.splice(h<0?cmds.length:h,0,f)}
 if(!onClaude()){for(const c of cmds)if(/^(Studio|Projects|Studio sessions|AI drawing review…)$/.test(c.label)&&/^(Panels|Tools)$/.test(c.menu))c.hidden=1;
  const st=document.createElement('style');st.textContent=`#left .tabs [data-tab="studio"],#left .tabs [data-tab="projects"],.dlMenuItem[data-t="studio"],.dlMenuItem[data-t="projects"],#ribbon [title="Live shared markup sessions"]{display:none!important}`;document.head.appendChild(st)}
},0));

/* ---------- labels and count dots readable when zoomed out ----------
   On screen only: a measurement's label is drawn at least about 8 px tall (at most 3× its set size), like
   Bluebeam keeps text legible at fit-to-page. Printing, saving and flattening use the size you set. */
const MEAS=t=>!!(T[t]&&(T[t].meas||t==='count'));
{const orig=markupSvg;markupSvg=function(m,prev){try{if(m&&MEAS(m.type)&&S.zoom>0){const fs=(m.style&&m.style.fontSize)||10,want=8/S.zoom;
  if(fs<want)return orig.call(this,Object.assign({},m,{style:Object.assign({},m.style,{fontSize:Math.min(fs*3,want)})}),prev)}}catch(e){}return orig.apply(this,arguments)}}
// zooming changes the minimum, so markups are redrawn when the zoom settles
{let zt=0,lz=0;const chk=()=>{if(S.pages.length&&Math.abs(S.zoom-lz)>1e-6){const was=lz;lz=S.zoom;if(was&&S.markups.some(m=>MEAS(m.type))){clearTimeout(zt);zt=setTimeout(()=>{try{redrawAll()}catch(e){}},180)}}};
 const _sz=setZoom;setZoom=function(){const r=_sz.apply(this,arguments);chk();return r};H.open.push(()=>{lz=S.zoom})}

/* ---------- tool strip: show that there are more tools below (Bluebeam layout) ---------- */
function strip(){const rb=$('#ribbon');if(!rb||!isDL())return;let up=rb.querySelector('.ezMore.up'),dn=rb.querySelector('.ezMore.dn');
 if(!up){up=document.createElement('button');up.className='ezMore up';up.title='More tools above';up.innerHTML='▲';rb.prepend(up);up.onclick=()=>rb.scrollBy({top:-rb.clientHeight*.7,behavior:'smooth'})}
 if(!dn){dn=document.createElement('button');dn.className='ezMore dn';dn.title='More tools below — click, or scroll the mouse wheel over the toolbar';dn.innerHTML='▼<span style="font-size:9px;margin-top:1px">more</span>';rb.appendChild(dn);dn.onclick=()=>rb.scrollBy({top:rb.clientHeight*.7,behavior:'smooth'})}
 else if(rb.lastElementChild!==dn)rb.appendChild(dn);
 const over=rb.scrollHeight>rb.clientHeight+4;up.classList.toggle('on',over&&rb.scrollTop>4);dn.classList.toggle('on',over&&rb.scrollTop+rb.clientHeight<rb.scrollHeight-4)}
H.ready.push(()=>setTimeout(()=>{const rb=$('#ribbon');if(!rb)return;rb.addEventListener('scroll',strip,{passive:true});addEventListener('resize',strip);
 new MutationObserver(()=>{clearTimeout(strip.t);strip.t=setTimeout(strip,60)}).observe(rb,{childList:true,subtree:false});
 new MutationObserver(()=>setTimeout(strip,60)).observe(document.body,{attributes:true,attributeFilter:['class']});strip()},400));

window.PMEasy={find,close,exportDialog,renderStart,recentList,openRecent,strip,get box(){return box}};
})();
