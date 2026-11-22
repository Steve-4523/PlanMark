/* PlanMark — Drafting layout (default on desktop-size screens).
   Near-black workspace with the drawing taking most of the screen:
   • top: menu bar + a slim document bar (file name, page count, file actions, account)
   • left: a narrow strip of panel icons; the chosen panel opens beside it (thumbnails in a grid with each page's scale)
   • right: a vertical strip of markup and measure tools
   • under the drawing: a navigation bar (page layout and split, pan/select/zoom, page arrows and box, back/forward, zoom, page size, scale)
   • bottom: slim status bar.
   View → "Classic toolbar layout" (or the button in the document bar) switches back to the older layout. */
(function(){
const KEY='pm:dl';
// Default on. Automated test browsers (navigator.webdriver) default to the classic layout so the older
// test suites keep exercising the screens they were written for; test_drafting.py turns this layout on explicitly.
const on=()=>LS.get(KEY,!navigator.webdriver)!==false&&innerWidth>900;
const ICON={
 pages:'<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
 bookmarks:'<path d="M7 3h10v18l-5-4-5 4z"/>',
 search:'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
 chest:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M9 8V5h6v3M3 13h18"/>',
 measure:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
 sets:'<rect x="6" y="3" width="13" height="16" rx="1"/><path d="M4 7v14h12"/>',
 files:'<path d="M3 6h7l2 2h9v11H3z"/>',
 studio:'<path d="M7 18a4 4 0 010-8 6 6 0 0111.5 1.5A3.5 3.5 0 0118 18z"/>',
 projects:'<path d="M3 7h18v13H3zM8 7V4h8v3"/>',
 forms:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 attach:'<path d="M20 12l-8 8a5 5 0 01-7-7l9-9a3.3 3.3 0 014.7 4.7L10 17.4a1.7 1.7 0 01-2.4-2.4L15 7.6"/>',
 spaces:'<path d="M3 3h18v18H3zM3 12h9V3M12 12v9"/>',
 signatures:'<path d="M3 17c3 0 4-8 7-8s1 8 4 8 3-4 5-4"/><path d="M3 21h18"/>',
 field:'<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 history:'<path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
 links:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
 flags:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
 props:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
 _:'<circle cx="12" cy="12" r="7"/>'};
const NAME={pages:'Thumbnails',chest:'Tool Chest',attach:'Attachments'};
const svg=(p,w)=>`<svg viewBox="0 0 24 24" width="${w||20}" height="${w||20}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const NAV={
 single:'<rect x="6" y="3" width="12" height="18" rx="1"/>',
 cont:'<rect x="6" y="2" width="12" height="9" rx="1"/><rect x="6" y="13" width="12" height="9" rx="1"/>',
 splitv:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/>',
 splith:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 12h18"/>',
 first:'<path d="M6 5v14M18 6l-8 6 8 6"/>', last:'<path d="M18 5v14M6 6l8 6-8 6"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
 pan:'<path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v8c0 4-2.7 7-6.3 7-2.6 0-4.3-1.4-5.3-3.6L3.6 13a1.5 1.5 0 012.6-1.4L8 14"/>',
 select:'<path d="M6 3l12 8.5-5.5 1.2L10 18z"/>'};

const css=`
@media (min-width:901px){
body.dl{--bg:#1c1c1c;--panel:#252525;--panel2:#323232;--line:#3a3a3a;--text:#e9e9e9;--mut:#a3a3a3;--canvas:#3e3e3e}
body.dl #wsMenu{background:#121212}
body.dl #topbar{height:38px;padding:2px 8px;background:#1f1f1f;gap:2px}
body.dl #topbar>.dlMoved{display:none!important}
body.dl #dlDoc{display:flex;align-items:center;gap:6px;padding:0 10px;white-space:nowrap;overflow:hidden;font-size:13px;min-width:0}
body.dl #dlDoc b{font-weight:700}
body.dl #dlDoc .mut{color:var(--mut)}
body.dl #topbar .brand{font-size:13px}
/* tools rail on the right */
body.dl #ribbon{order:9;flex-direction:column;align-items:center;width:46px;padding:4px 2px;overflow-x:hidden;overflow-y:auto;border-bottom:0;border-left:1px solid var(--line);background:#1f1f1f;gap:1px;scrollbar-width:thin}
body.dl #ribbon .grp{display:flex;flex-direction:column;align-items:center;gap:1px}
body.dl #ribbon .glab{display:none}
body.dl #ribbon .sep{width:28px;height:1px;align-self:center;margin:5px 0}
body.dl #ribbon .tb{width:38px;height:34px;min-width:0;padding:0;justify-content:center;border-radius:5px}
body.dl #ribbon .tb>span{display:none}
body.dl #ribbon .tb svg{width:19px;height:19px}
body.dl #ribbon select,body.dl #ribbon input{max-width:40px}
/* left: icon strip + panel */
body.dl #left{flex-direction:row;width:auto;max-width:none;border-right:1px solid var(--line);background:#1f1f1f}
body.dl #left .tabs{display:flex;flex-direction:column;flex-wrap:nowrap;width:46px;flex:0 0 46px;padding:6px 3px;gap:2px;border:0;border-right:1px solid var(--line);overflow-y:auto;overflow-x:hidden;scrollbar-width:none;background:#1f1f1f}
body.dl #left .tabs button{width:38px;height:36px;min-width:0;padding:0;display:flex;align-items:center;justify-content:center;border-radius:5px;flex:0 0 auto;color:var(--mut);border:0;background:none}
body.dl #left .tabs button>.dlTx{display:none}
body.dl #left .tabs button.on{background:#2b4c7e;color:#fff}
body.dl #left .tabs button:hover{background:var(--panel2);color:var(--text)}
body.dl #dlPanes{display:flex;flex-direction:column;width:var(--dlPW,340px);min-width:220px;max-width:640px;min-height:0;background:var(--panel);position:relative}
body.dl #left.dlCollapsed #dlPanes{display:none}
body.dl #dlPHead{display:flex;align-items:center;gap:6px;height:40px;padding:0 12px;font-weight:700;font-size:15px;border-bottom:1px solid var(--line);flex-shrink:0;cursor:pointer;user-select:none}
body.dl #dlPHead .car{font-size:11px;color:var(--mut)}
body.dl #dlGrip{position:absolute;top:0;right:-3px;bottom:0;width:6px;cursor:ew-resize;z-index:3}
body.dl #dlPanes .pane{flex:1;min-height:0}
body.dl #pane-pages.hide{display:none}
/* thumbnails in a grid, with page number and scale */
body.dl #pane-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));align-content:start;gap:14px 12px;padding:10px 12px}
body.dl #pane-pages>:not(.thumb){grid-column:1/-1}
body.dl #pane-pages .thumb{display:flex;flex-direction:column;align-items:center;text-align:center;font-size:12px;line-height:1.3;color:var(--text);margin:0;padding:6px 4px;border-radius:4px;border:2px solid transparent;background:none}
body.dl #pane-pages .thumb canvas{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);margin-bottom:6px;width:100%!important;height:auto!important}
body.dl #pane-pages .thumb.on,body.dl #pane-pages .thumb.cur{background:#2b4c7e55;border-color:#3d8bfd}
body.dl #pane-pages .thumb .dlSc{display:block;color:var(--mut);font-size:11.5px}
/* properties: shown while something is selected, or when pinned */
body.dl #right{display:none}
body.dl.dlProps #right:not(.hide),body.dl.dlSel #right:not(.hide){display:flex}
/* while a markup is selected, properties float over the drawing so the page doesn't jump; pinned, it takes its own column */
body.dl.dlSel:not(.dlProps) #right{position:absolute;right:47px;top:0;bottom:38px;z-index:20;box-shadow:-8px 0 24px rgba(0,0,0,.45)}
/* navigation bar under the drawing */
#dlNav{display:none}
body.dl #dlNav{display:flex;align-items:center;gap:2px;height:38px;padding:0 8px;background:#1f1f1f;border-top:1px solid var(--line);flex-shrink:0;overflow-x:auto;scrollbar-width:none;white-space:nowrap}
body.dl #dlNav .btn{height:30px;padding:0 6px}
body.dl #dlNav .btn svg{width:18px;height:18px}
body.dl #dlNav .btn.on{background:#2b4c7e;border-color:transparent}
body.dl #dlNav #pageIn{width:110px;text-align:center;height:26px;background:#2a2a2a;border:1px solid var(--line);border-radius:4px}
body.dl #dlNav #pageTot{display:none}
body.dl #dlNav #zoomv{width:58px;text-align:center;height:26px;background:#2a2a2a;border:1px solid var(--line);border-radius:4px}
body.dl #dlNav .sp{flex:1}
body.dl #dlNav .dlInfo{color:var(--text);padding:0 8px;font-size:13px}
/* markups list: opened from the list button in the navigation bar */
body.dl:not(.dlML) #mlist{display:none}
body.dl #status{height:26px;min-height:26px;padding:0 8px;background:#141414;font-size:12px}
body.dl #status #hint{color:var(--mut)}
body.dl #tabBar{background:#1f1f1f}
}`;
let built=false,lastTab='pages';
function build(){
 if(built)return;built=true;
 const st=document.createElement('style');st.id='dlCss';st.textContent=css;document.head.appendChild(st);
 // tools strip goes to the right edge of the work area
 $('#main').appendChild($('#ribbon'));
 // document bar
 const tb=$('#topbar');const doc=document.createElement('div');doc.id='dlDoc';
 const brand=tb.querySelector('.brand');brand.after(doc);
 const sp=document.createElement('div');sp.style.flex='1';sp.id='dlSp';doc.after(sp);
 // navigation bar under the drawing: move the existing controls (their handlers come along)
 const nav=document.createElement('div');nav.id='dlNav';$('#viewWrap').appendChild(nav);
 const mk=(id,title,icon,fn)=>{const b=document.createElement('button');b.className='btn';b.id=id;b.title=title;b.innerHTML=svg(icon,18);b.onclick=fn;return b};
 const sep=()=>{const s=document.createElement('div');s.className='sep';return s};
 const L=()=>window.PMViews;
 nav.append(
  mk('dlMLBtn','Markups list',NAV.list,()=>{document.body.classList.toggle('dlML');LS.set('pm:dl:ml',document.body.classList.contains('dlML'));setTimeout(()=>{try{fitIfNeeded()}catch(e){}},30)}),sep(),
  mk('dlSingle','Single page',NAV.single,()=>{L()&&L().setMode('single');navState()}),
  mk('dlCont','Continuous',NAV.cont,()=>{L()&&L().setMode('continuous');navState()}),
  mk('dlSplitV','Split vertically',NAV.splitv,()=>splitToggle('v')),
  mk('dlSplitH','Split horizontally',NAV.splith,()=>splitToggle('h')),sep(),
  mk('dlPan','Pan (Space)',NAV.pan,()=>setTool('pan')),
  mk('dlSel','Select (V)',NAV.select,()=>setTool('select')));
 const move=(...ids)=>ids.forEach(id=>{const e=$('#'+id);if(e)nav.appendChild(e)});
 move('bZbox','bLoupe');nav.appendChild(sep());
 nav.appendChild(mk('dlFirst','First page',NAV.first,()=>S.pages.length&&gotoPage(1)));
 move('bPrev','pageIn','pageTot','bNext');
 nav.appendChild(mk('dlLast','Last page',NAV.last,()=>S.pages.length&&gotoPage(S.pages.length)));
 move('bBack','bFwd');nav.appendChild(sep());
 move('bZout','zoomv','bZin','bFitW','bFitP');nav.appendChild(sep());
 move('bRotL','bRotR','bRul','bSplit');
 const spc=document.createElement('div');spc.className='sp';nav.appendChild(spc);
 const info=document.createElement('span');info.className='dlInfo';info.id='dlInfo';nav.appendChild(info);
 // leftover separators in the document bar
 [...tb.children].forEach(e=>{if(e.classList.contains('sep'))e.classList.add('dlMoved')});
 $('#bLeft')&&$('#bLeft').classList.add('dlMoved');
 // classic layout switch + properties pin, in the document bar
 const cl=document.createElement('button');cl.className='btn';cl.id='dlClassic';cl.title='Switch to the classic toolbar layout';cl.textContent='Classic layout';cl.style.cssText='font-size:12px;color:var(--mut)';
 cl.onclick=()=>setOn(false);$('#bSettings').before(cl);
 // the page box reads "5 (5 of 14)" and accepts a page number or label
 const pi=$('#pageIn');pi.addEventListener('focus',()=>{pi.value=S.cur||''; setTimeout(()=>pi.select(),0)});
 // left: wrap panes, decorate tabs
 const left=$('#left'),tabs=left.querySelector('.tabs');const wrap=document.createElement('div');wrap.id='dlPanes';
 const head=document.createElement('div');head.id='dlPHead';head.innerHTML='<span id="dlPName">Thumbnails</span><span class="car">▼</span>';
 const grip=document.createElement('div');grip.id='dlGrip';wrap.append(head,grip);
 tabs.after(wrap);[...left.querySelectorAll(':scope > .pane')].forEach(p=>wrap.appendChild(p));
 new MutationObserver(()=>{[...left.querySelectorAll(':scope > .pane')].forEach(p=>wrap.appendChild(p));decorateTabs()}).observe(left,{childList:true});
 new MutationObserver(decorateTabs).observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 // the properties panel gets its own icon at the bottom of the strip
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;
  if(b.dataset.tab===lastTab&&!left.classList.contains('dlCollapsed')&&e.isTrusted){left.classList.add('dlCollapsed');LS.set('pm:dl:col',true)}
  else{left.classList.remove('dlCollapsed');LS.set('pm:dl:col',false)}
  lastTab=b.dataset.tab;setTimeout(decorateTabs,0)},true);
 head.onclick=e=>panelMenu(e);
 // resize the panel by dragging its right edge
 grip.onpointerdown=e=>{e.preventDefault();const x0=e.clientX,w0=wrap.getBoundingClientRect().width;grip.setPointerCapture(e.pointerId);
  grip.onpointermove=m=>{const w=Math.max(220,Math.min(640,w0+m.clientX-x0));document.body.style.setProperty('--dlPW',w+'px')};
  grip.onpointerup=()=>{grip.onpointermove=null;LS.set('pm:dl:pw',parseInt(getComputedStyle(document.body).getPropertyValue('--dlPW'))||340)}};
 const pw=LS.get('pm:dl:pw',0);if(pw)document.body.style.setProperty('--dlPW',pw+'px');
 if(LS.get('pm:dl:col',false))left.classList.add('dlCollapsed');
 if(LS.get('pm:dl:ml',false))document.body.classList.add('dlML');
 if(LS.get('pm:dl:props',false))document.body.classList.add('dlProps');
 // properties: the existing toggle pins it open in this layout
 const br=$('#bRight');br.addEventListener('click',e=>{if(!document.body.classList.contains('dl'))return;e.stopImmediatePropagation();$('#right').classList.remove('hide');
  document.body.classList.toggle('dlProps');LS.set('pm:dl:props',document.body.classList.contains('dlProps'));setTimeout(()=>window.dispatchEvent(new Event('resize')),30)},true);
 decorateTabs();
}
function decorateTabs(){const tabs=$('#left .tabs');if(!tabs)return;
 tabs.querySelectorAll('[data-tab]').forEach(b=>{const t=b.dataset.tab;if(!b.dataset.dl){const tx=b.textContent.trim();b.dataset.dl=tx;b.innerHTML=svg(ICON[t]||ICON._)+`<span class="dlTx">${esc(tx)}</span>`;b.title=NAME[t]||tx}
  if(b.classList.contains('on')){lastTab=t;const n=$('#dlPName');if(n)n.textContent=NAME[t]||b.dataset.dl}})}
function panelMenu(e){const tabs=[...$$('#left .tabs [data-tab]')];const m=document.createElement('div');
 m.style.cssText=`position:fixed;left:${e.clientX-20}px;top:${e.clientY+14}px;z-index:90;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px;box-shadow:0 10px 30px rgba(0,0,0,.5);max-height:70vh;overflow:auto;min-width:180px`;
 m.innerHTML=tabs.map(b=>`<div data-t="${esc(b.dataset.tab)}" style="display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:4px;cursor:pointer" onmouseover="this.style.background='var(--panel2)'" onmouseout="this.style.background=''">${svg(ICON[b.dataset.tab]||ICON._,16)}${esc(NAME[b.dataset.tab]||b.dataset.dl||b.textContent)}</div>`).join('');
 document.body.appendChild(m);const close=ev=>{if(!m.contains(ev.target)){m.remove();removeEventListener('pointerdown',close,true)}};setTimeout(()=>addEventListener('pointerdown',close,true),0);
 m.onclick=ev=>{const d=ev.target.closest('[data-t]');if(!d)return;const b=$(`#left .tabs [data-tab="${d.dataset.t}"]`);b&&b.click();m.remove()}}
function splitToggle(o){const v=window.PMViews;if(!v)return;const box=$('#splitBox');const isOn=box&&box.classList.contains('on');const same=isOn&&box.classList.contains('h')===(o==='h');
 if(same)v.closeSplit();else v.openSplit(o);navState()}
function fitIfNeeded(){window.dispatchEvent(new Event('resize'))}
function scaleText(n){try{const s=scaleFor(n);return s.none?'Scale Not Set':(s.label||'Scaled')}catch(e){return''}}
function decorateThumbs(){if(!document.body.classList.contains('dl'))return;
 $$('#pane-pages .thumb').forEach(t=>{const n=+t.dataset.p;if(!n)return;
  // the page number on its own line, the scale under it
  for(const node of [...t.childNodes])if(node.nodeType===3&&/Page\s*\d+/.test(node.textContent)){const s=document.createElement('span');s.className='dlNum';s.textContent=String(n);node.replaceWith(s)}
  let lab=t.querySelector('.dlNum');const pl=(S.pages[n-1]&&S.pages[n-1].label)||'';if(lab&&pl&&pl!==String(n))lab.textContent=n+' · '+pl;
  let sc=t.querySelector('.dlSc');if(!sc){sc=document.createElement('span');sc.className='dlSc';(lab||t).after?lab?lab.after(sc):t.appendChild(sc):t.appendChild(sc)}
  const tx=scaleText(n);if(sc.textContent!==tx)sc.textContent=tx;
  t.classList.toggle('cur',n===S.cur)})}
function navState(){if(!document.body.classList.contains('dl'))return;
 const n=S.pages.length,c=S.cur||0,pi=$('#pageIn');
 if(pi&&document.activeElement!==pi){const lab=(S.pages[c-1]&&S.pages[c-1].label)||'';pi.value=n?`${lab&&lab!==String(c)?lab:c} (${c} of ${n})`:''}
 const d=$('#dlDoc');if(d)d.innerHTML=S.fileName?`<span class="mut">Name:</span> <b>${esc(S.fileName.replace(/\.pdf$/i,''))}</b> <span class="mut" style="margin-left:10px">Pages:</span> <b>${n}</b>`:'';
 const p=S.pages[c-1];const i=$('#dlInfo');if(i)i.textContent=p?`${(p.w/72).toFixed(2)} x ${(p.h/72).toFixed(2)} in      ${scaleText(c)==='Scale Not Set'?'':scaleText(c)}`:'';
 let mode='continuous';try{mode=(window.PMLayout&&PMLayout.get().mode)||'continuous'}catch(e){}
 const box=$('#splitBox'),sOn=box&&box.classList.contains('on');
 const set=(id,v)=>{const e=$('#'+id);if(e)e.classList.toggle('on',!!v)};
 set('dlSingle',mode==='single');set('dlCont',mode==='continuous');set('dlSplitV',sOn&&!box.classList.contains('h'));set('dlSplitH',sOn&&box.classList.contains('h'));
 set('dlPan',S.tool==='pan');set('dlSel',S.tool==='select');set('dlMLBtn',document.body.classList.contains('dlML'));
 document.body.classList.toggle('dlSel',S.sel&&S.sel.size>0);
 decorateThumbs()}
function setOn(v){LS.set(KEY,!!v);location.reload()}
window.PMDrafting={setOn,isOn:()=>document.body.classList.contains('dl'),navState,decorateThumbs};
H.ready.push(()=>{if(!on())return;document.body.classList.add('dl');
 // runs after the other modules have built their panels and menus
 setTimeout(()=>{build();
  const cur=$('#left .tabs [data-tab].on');if(cur)lastTab=cur.dataset.tab;
  // "Classic toolbar layout" in the View menu
  try{const W=window.PMWorkspace;if(W&&W.CMDS&&Array.isArray(W.CMDS))W.CMDS.push({id:'dl-classic',label:'Classic toolbar layout',menu:'View',run:()=>setOn(false)})}catch(e){}
  navState();setTimeout(()=>window.dispatchEvent(new Event('resize')),60)},0);
 const _u=updateCurUI;updateCurUI=function(){const r=_u.apply(this,arguments);navState();return r};
 const _st=setTool;setTool=function(){const r=_st.apply(this,arguments);navState();return r};
 const _rp=renderProps;renderProps=function(){const r=_rp.apply(this,arguments);document.body.classList.toggle('dlSel',!!(S.sel&&S.sel.size));return r};
 new MutationObserver(()=>decorateThumbs()).observe($('#pane-pages'),{childList:true});
 setInterval(navState,1500)});
H.open.push(()=>setTimeout(navState,60));
H.change.push(()=>setTimeout(navState,30));
// when the classic layout is chosen, offer the way back
H.ready.push(()=>{if(on()||innerWidth<=900)return;setTimeout(()=>{const s=$('#bSettings');if(!s||$('#dlBack'))return;const b=document.createElement('button');b.className='btn';b.id='dlBack';b.title='Switch to the drafting layout';b.textContent='Drafting layout';b.style.cssText='font-size:12px;color:var(--mut)';b.onclick=()=>setOn(true);s.before(b)},0)});
})();
