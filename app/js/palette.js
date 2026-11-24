/* PlanMark — colour list like Bluebeam's.
   Clicking any colour box (Properties toolbar, Properties panel, tool settings…) opens a drop-down grid of standard
   colours instead of the system colour picker: the same 40 colours Revu shows, the colours you used lately, and
   "More colors…" for the full picker. Fill boxes also get "No fill". */
(function(){
const GRID=['#000000','#993300','#333300','#003300','#003366','#000080','#333399','#333333',
 '#800000','#FF6600','#808000','#008000','#008080','#0000FF','#666699','#808080',
 '#FF0000','#FF9900','#99CC00','#339966','#33CCCC','#3366FF','#800080','#969696',
 '#FF00FF','#FFCC00','#FFFF00','#00FF00','#00FFFF','#00CCFF','#993366','#C0C0C0',
 '#FF99CC','#FFCC99','#FFFF99','#CCFFCC','#CCFFFF','#99CCFF','#CC99FF','#FFFFFF'];
const RK='pm:recentColors';window.PM_EXTRA_SYNC_KEYS_PAL=[RK];
const recent=()=>{try{return(LS.get(RK,[])||[]).slice(0,8)}catch(e){return[]}};
function remember(c){c=c.toLowerCase();if(GRID.some(g=>g.toLowerCase()===c))return;LS.set(RK,[c,...recent().filter(x=>x!==c)].slice(0,8))}
const st=document.createElement('style');st.textContent=`
#pmPal{position:fixed;z-index:200;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:12px;color:var(--text);user-select:none}
#pmPal .g{display:grid;grid-template-columns:repeat(8,18px);gap:3px}
#pmPal .s{width:18px;height:18px;border:1px solid rgba(128,128,128,.55);cursor:pointer;box-sizing:border-box}
#pmPal .s:hover{outline:2px solid var(--acc,#3d8bfd);outline-offset:1px}
#pmPal .s.on{outline:2px solid var(--text);outline-offset:1px}
#pmPal .lb{color:var(--mut);font-size:11px;margin:8px 0 4px}
#pmPal .it{padding:5px 6px;margin-top:6px;border-radius:3px;cursor:pointer}
#pmPal .it:hover{background:var(--accbg,rgba(61,139,253,.2))}
#pmPal .none{display:flex;align-items:center;gap:8px}
#pmPal .none i{width:18px;height:18px;border:1px solid #888;background:linear-gradient(to top right,transparent 45%,#e0312b 45% 55%,transparent 55%)}`;
document.head.appendChild(st);
let cur=null;
function close(){const p=document.getElementById('pmPal');if(p)p.remove();cur=null;removeEventListener('pointerdown',outside,true);removeEventListener('keydown',esc,true)}
const outside=e=>{const p=document.getElementById('pmPal');if(p&&!p.contains(e.target)&&e.target!==cur)close()};
const esc=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};
function pick(inp,c){inp.value=c;remember(c);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))}
// a fill colour box sits next to its on/off switch: "No fill" turns that switch off
function fillSwitch(inp){const f=inp.dataset.f||inp.dataset.pf;if(f!=='fill'||!inp.closest('#props,#rvPB'))return null;
 return document.querySelector('#props [data-f="fillOn"]')}
function open(inp){close();cur=inp;const v=(inp.value||'').toLowerCase();const r=inp.getBoundingClientRect();
 const p=document.createElement('div');p.id='pmPal';const sw=c=>`<div class="s${c.toLowerCase()===v?' on':''}" data-c="${c}" title="${c}" style="background:${c}"></div>`;
 const rc=recent();const fs=fillSwitch(inp);
 p.innerHTML=(fs?`<div class="it none" data-none="1" style="margin:0 0 6px"><i></i>No fill</div>`:'')+`<div class="g">${GRID.map(sw).join('')}</div>`+
  (rc.length?`<div class="lb">Recent colors</div><div class="g">${rc.map(sw).join('')}</div>`:'')+`<div class="it" data-more="1">More colors…</div>`;
 document.body.appendChild(p);const w=p.offsetWidth,h=p.offsetHeight;
 p.style.left=Math.max(4,Math.min(innerWidth-w-4,r.left))+'px';p.style.top=(r.bottom+h+4<innerHeight?r.bottom+3:Math.max(4,r.top-h-3))+'px';
 p.onclick=e=>{const s=e.target.closest('[data-c]');if(s){pick(inp,s.dataset.c.toLowerCase());close();return}
  if(e.target.closest('[data-none]')){if(fs){if(fs.type==='checkbox'){fs.checked=false;fs.dispatchEvent(new Event('input',{bubbles:true}));fs.dispatchEvent(new Event('change',{bubbles:true}))}else{fs.value=0;fs.dispatchEvent(new Event('input',{bubbles:true}));fs.dispatchEvent(new Event('change',{bubbles:true}))}}close();return}
  if(e.target.closest('[data-more]')){close();inp.dataset.pmNative='1';const back=()=>{delete inp.dataset.pmNative;remember(inp.value)};inp.addEventListener('change',back,{once:true});
   try{inp.showPicker()}catch(_){inp.click()}setTimeout(()=>{if(inp.dataset.pmNative)delete inp.dataset.pmNative},60000)}};
 setTimeout(()=>{addEventListener('pointerdown',outside,true);addEventListener('keydown',esc,true)},0)}
// every colour box in the app opens the list (the full picker is one click away under "More colors…")
document.addEventListener('click',e=>{const inp=e.target.closest&&e.target.closest('input[type=color]');if(!inp||inp.disabled||inp.dataset.pmNative)return;
 e.preventDefault();e.stopPropagation();if(cur===inp){close();return}open(inp)},true);
window.PMPalette={open,close,GRID};
})();
