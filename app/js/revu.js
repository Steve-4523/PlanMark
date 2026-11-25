/* PlanMark — Revu frame.
   Makes the drafting layout look and sit like Bluebeam Revu 21 (checked against a real Revu 21 screenshot):
   • one menu row at the very top (File … Help) with the account button at its right end
   • under it the Properties toolbar: colour, fill, line width, line style, opacity and font of whatever is selected
     or of the tool in hand; empty when nothing is
   • document tabs with a list button at the right end (no "+" tab)
   • the drawing fills the work area: no page caption above the sheet, panels start closed
   • Navigation bar: MultiView | Pan, Select, Select Text, Zoom | first, previous, page box, next, last | back, forward
     … Dimmer, page size, scale
   • Status bar: "Ready" / help text on the left; Show grid, Snap to grid, Snap to content, Snap to markup, Reuse,
     Sync as icon toggles, then scale, page size and cursor position on the right
   • Revu's dark colours: one flat grey (#2e2e2e), black hairlines between bars, blue for buttons that are on
   Everything that moved out of sight is still in the menus and on the same keyboard shortcuts. */
(function(){
const on=()=>document.body.classList.contains('dl');
const I={
 grid:'<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
 snapg:'<path d="M4 4h16v16H4zM4 12h16M12 4v16"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
 snapc:'<path d="M5 19V8h11"/><circle cx="16" cy="8" r="2.3"/><path d="M14 17l5-5"/>',
 snapm:'<rect x="4" y="9" width="9" height="9"/><circle cx="13" cy="9" r="2.3"/><path d="M15 6l4-2"/>',
 reuse:'<path d="M4 20l3-1 11-11-2-2L5 17z"/><path d="M14 4l2-2 4 4-2 2"/><path d="M15 15a4 4 0 104 4"/>',
 sync:'<path d="M4 9a8 8 0 0114-3l2-2v6h-6l2-2a5 5 0 00-9 1M20 15a8 8 0 01-14 3l-2 2v-6h6l-2 2a5 5 0 009-1"/>',
 dim:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>',
 list:'<path d="M6 9l6 6 6-6"/>',
 single:'<rect x="5" y="4" width="14" height="16"/>',
 user:'<circle cx="12" cy="9" r="4" fill="currentColor"/><path d="M4.5 20a7.5 7.5 0 0115 0z" fill="currentColor"/>'};
const svg=(k,s=18)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const css=`
body.dl{--rvBg:#2e2e2e;--rvLine:#000;--rvOn:#24618b;--rvOnLine:#4c9ad6}
body.dl.light{--rvBg:#f3f3f3;--rvLine:#c8c8c8;--rvOn:#cfe3f6;--rvOnLine:#5b9bd5}
/* menu row: the whole top line, like Revu's title bar */
body.dl #wsMenu{height:26px;min-height:26px;background:#000;border:0;display:flex;align-items:center;padding:0 0 0 4px}
body.dl.light #wsMenu{background:#fff;border-bottom:1px solid var(--rvLine)}
body.dl #wsMenu .wm{height:26px;line-height:26px;padding:0 9px;font-size:13px}
body.dl #rvTR{margin-left:auto;display:flex;align-items:center;gap:2px;padding-right:6px}
body.dl #rvTR .btn{height:24px;min-width:26px;padding:0 4px;background:none;border:0}
body.dl #rvTR #bAcct .hide-m,body.dl #rvTR #bAcct span:not(.av){display:none}
body.dl #rvTR #bAcct svg{width:18px;height:18px}
body.rvWCO #wsMenu{display:flex!important;-webkit-app-region:drag;app-region:drag;height:26px;min-height:26px;padding-right:calc(100vw - env(titlebar-area-x,0px) - env(titlebar-area-width,100vw))!important}
#rvLogo{display:none}body.rvWCO #rvLogo{display:block;width:18px;height:18px;margin:0 6px 0 4px;border-radius:3px}
body.rvWCO #wsMenu .wm,body.rvWCO #rvTR,body.rvWCO #rvTR *{-webkit-app-region:no-drag;app-region:no-drag}
body.rvWCO:not(.dl) #wsMenu{background:#000}body.rvWCO.light:not(.dl) #wsMenu{background:#fff}
/* Properties toolbar takes the old document bar's place */
body.dl #topbar{height:34px;min-height:34px;padding:0 8px;background:var(--rvBg);border-bottom:1px solid var(--rvLine);gap:0}
body.dl #topbar>*:not(#rvPB){display:none!important}
#rvPB{display:none}
body.dl #rvPB{display:flex;align-items:center;gap:10px;height:100%;font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden}
#rvPB .pf{display:flex;align-items:center;gap:4px}
#rvPB .pf>i{font-style:normal;color:var(--mut);font-size:11px}
#rvPB input[type=color]{width:26px;height:20px;padding:0;border:1px solid #6a6a6a;background:none;cursor:pointer}
#rvPB input[type=number]{width:52px;height:22px;background:var(--panel2);color:var(--text);border:1px solid #6a6a6a;border-radius:2px;padding:0 4px}
#rvPB input[type=range]{width:70px}
#rvPB select{height:22px;font-size:12px;padding:0 2px;max-width:130px;background:var(--panel2);color:var(--text);border:1px solid #6a6a6a;border-radius:2px}
#rvPB .tg{min-width:22px;height:22px;border:1px solid transparent;border-radius:2px;background:none;color:var(--text);cursor:pointer;font:600 13px/1 serif}
#rvPB .tg.on{background:var(--rvOn);border-color:var(--rvOnLine)}
#rvPB .vs{width:1px;height:18px;background:#555}
/* selecting a markup fills the Properties toolbar; the Properties panel stays shut unless opened */
body.dl.dlSel:not(.dlProps) #right{display:none!important}
/* tabs */
body.dl #tabBar{background:var(--rvBg);border-bottom:1px solid var(--rvLine)}
body.dl #tabBar .tplus{display:none!important}
body.dl #tabBar .dtab{background:transparent;border:0;border-radius:0}
body.dl #tabBar .dtab.on{background:#4e4e4e}
body.dl.light #tabBar .dtab.on{background:#fff}
#rvTabs{display:none}
body.dl #rvTabs{display:flex;margin-left:auto;align-items:center;justify-content:center;width:28px;height:100%;background:none;border:0;color:var(--text);cursor:pointer;flex-shrink:0}
/* the drawing fills the work area */
body.dl #viewer,body.dl .vw2{background:var(--rvBg)}
body.dl .page>.pn,body.dl .pg2>.pn{display:none!important}
body.dl #ribbon{background:var(--rvBg);border-left:1px solid var(--rvLine)}
body.dl #ribbon .rvNavGrp{display:none!important}
body.dl #ribbon .tb.on{background:var(--rvOn);border:1px solid var(--rvOnLine)}
body.dl #left .tabs{background:var(--rvBg);border-right:1px solid var(--rvLine)}
/* Navigation bar */
body.dl #dlNav{height:32px;background:var(--rvBg);border-top:1px solid var(--rvLine);padding:0 6px;gap:1px}
body.dl #dlNav .btn{height:26px;min-width:28px;padding:0 4px;border:1px solid transparent;border-radius:2px;background:none}
body.dl #dlNav .btn svg{width:17px;height:17px}
body.dl #dlNav .btn.on{background:var(--rvOn);border-color:var(--rvOnLine)}
body.dl #dlNav .sep{width:10px;background:none;border:0}
body.dl #dlNav #pageIn{width:230px!important;flex:0 1 230px;min-width:110px;height:22px;background:var(--rvBg);border:1px solid #8a8a8a;border-radius:0;font-size:12px}
body.dl.light #dlNav #pageIn{background:#fff}
body.dl #dlNav .rvHide{display:none!important}
body.dl #dlNav{display:grid!important;grid-template-columns:minmax(max-content,1fr) minmax(0,auto) minmax(0,1fr);align-items:center;overflow:hidden}
body.dl #dlNav .rvNP{display:flex;align-items:center;gap:1px;min-width:0}body.dl #dlNav .rvNC{overflow:hidden}body.dl #dlNav .rvNC>.btn{flex-shrink:0}
body.dl #dlNav .rvNL{justify-self:start}body.dl #dlNav .rvNC{justify-self:center}body.dl #dlNav .rvNR{justify-self:end}
body.dl #dlNav .dlInfo{font-size:12.5px;padding:0 6px}
body.dl #dlNav #rvNavScale{font-size:12.5px;padding:0 8px 0 10px;white-space:nowrap}
/* Status bar */
body.dl #status{height:25px;min-height:25px;background:var(--rvBg);border-top:1px solid var(--rvLine);padding:0 6px;gap:2px;font-size:12px}
body.dl #status #hint,body.dl #status #wsStat,body.dl #status #snapBtn,body.dl #status #orthoBtn,body.dl #status #scaleBtn,body.dl #status #coords{display:none!important}
#rvReady,#rvSR{display:none}
body.dl #rvReady{display:block;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);padding-left:2px}
body.dl #rvSR{display:flex;align-items:center;gap:1px;white-space:nowrap}
#rvSR .sb{width:26px;height:21px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:2px;background:none;color:var(--text);cursor:pointer;padding:0}
#rvSR .sb svg{width:16px;height:16px}
#rvSR .sb.on{background:var(--rvOn);border-color:var(--rvOnLine)}
#rvSR .tx{padding:0 9px;color:var(--text)}
#rvSR #rvScale{background:none;border:0;color:var(--text);cursor:pointer;font:inherit;padding:0 8px;display:flex;align-items:center;gap:3px}
#rvSR #rvScale svg{width:12px;height:12px}
body.dl #status #dlMLBtn{height:21px;min-width:26px;padding:0 4px;border:1px solid transparent;border-radius:2px;background:none;margin-right:4px}
body.dl #status #dlMLBtn svg{width:16px;height:16px}
body.dl.dlML #status #dlMLBtn{background:var(--rvOn);border-color:var(--rvOnLine)}
`;
let built=false;
function build(){
 if(built||!on()||!$('#dlNav'))return;built=true;
 const st=document.createElement('style');st.id='rvCss';st.textContent=css;document.head.appendChild(st);
 // --- menu row: account (and notifications) at the right end
 const mb=$('#wsMenu');if(mb){const tr=document.createElement('div');tr.id='rvTR';mb.appendChild(tr);
  const lg=document.createElement('img');lg.id='rvLogo';lg.src='img/icon-32.png';lg.alt='';mb.prepend(lg);
  const mv=()=>{['clBell','bAcct'].forEach(id=>{const e=$('#'+id);if(e&&e.parentElement!==tr)tr.appendChild(e)});const a=$('#bAcct');if(a){const t=a.textContent.trim()||'Account';if(a.title!==t)a.title=t}};mv();setInterval(mv,1500);
  new MutationObserver(mv).observe($('#topbar'),{childList:true})}
 // --- Properties toolbar
 const pb=document.createElement('div');pb.id='rvPB';$('#topbar').appendChild(pb);
 const props=$('#props');let pT=0;const later=()=>{if(!pT)pT=setTimeout(()=>{pT=0;syncPB()},40)};
 new MutationObserver(later).observe(props,{childList:true,subtree:true});
 props.addEventListener('input',e=>{if(!e.isTrusted)return;valuesPB()});H.change&&H.change.push(later);
 // --- tabs: list of open documents at the right end
 const tb=$('#tabBar');if(tb){const b=document.createElement('button');b.id='rvTabs';b.title='Open documents';b.innerHTML=svg('list',15);tb.appendChild(b);
  b.onclick=e=>{const v=window.PMViews;if(!v||!v.tabs)return;const r=b.getBoundingClientRect();
   window.PMWorkspace&&PMWorkspace.ctx(r.right-220,r.bottom,v.tabs.map(t=>({label:t.name,check:t.id===v.curTab,run:()=>v.switchTo&&v.switchTo(t.id)})))};
  new MutationObserver(()=>{if(b.parentElement===tb&&tb.lastElementChild!==b)tb.appendChild(b)}).observe(tb,{childList:true})}
 // --- Navigation bar in Revu's order, in three parts: views on the left, tools and pages in the centre,
 //     dimmer / page size / scale on the right
 const nav=$('#dlNav');const part=c=>{const d=document.createElement('div');d.className='rvNP '+c;return d};
 const NL=part('rvNL'),NC=part('rvNC'),NR=part('rvNR');
 const LEFT=['dlSingle','dlSplitV','dlSplitH','dlCont'],CENTER=['dlPan','dlSel','dlSelT','bZbox','|','dlFirst','bPrev','pageIn','bNext','dlLast','|','bBack','bFwd'];
 const ml=$('#dlMLBtn');
 [...nav.children].forEach(e=>{if(e.classList.contains('sep')||e.classList.contains('sp'))e.remove();else e.classList.add('rvHide')});
 nav.append(NL,NC,NR);
 const put=(box,id)=>{if(id==='|'){const s=document.createElement('div');s.className='sep';box.appendChild(s);return}const e=$('#'+id);if(e){e.classList.remove('rvHide');box.appendChild(e)}};
 LEFT.forEach(k=>put(NL,k));CENTER.forEach(k=>put(NC,k));
 const dim=document.createElement('button');dim.className='btn';dim.id='rvDim';dim.title='Dimmer (Ctrl+F5)';dim.innerHTML=svg('dim',17);NR.appendChild(dim);
 dim.onclick=()=>{const v=window.PMViews;const cur=+(window.__rvDim||0);window.__rvDim=cur?0:.45;v&&v.setDim&&v.setDim(window.__rvDim);dim.classList.toggle('on',!!window.__rvDim)};
 put(NR,'dlInfo');const ns=document.createElement('span');ns.id='rvNavScale';NR.appendChild(ns);
 // on a narrow window the page size and scale on the right go first (the Status bar shows them too)
 const fit=()=>{const ids=['dlInfo','rvNavScale','rvDim','dlFirst','dlLast','bZbox','bFwd','bBack'];   // on a very narrow bar the first/last-page, zoom and back/forward buttons go too (keys and menus still do them)ids.forEach(id=>{const e=$('#'+id);if(e)e.style.display=''});
  const room=()=>nav.clientWidth-(NL.scrollWidth+NC.scrollWidth+NR.scrollWidth)-8;
  for(const id of ids){const ok=room()>=0&&(ids.indexOf(id)>2||NR.scrollWidth<=(nav.clientWidth-NC.scrollWidth)/2);if(ok)break;const e=$('#'+id);if(e)e.style.display='none'}};
 new ResizeObserver(fit).observe(nav);setInterval(fit,1500);
 // buttons that arrive later from their own modules (Select Text) go to their place; anything else stays out of the bar
 new MutationObserver(()=>{const t=$('#dlSelT'),s=$('#dlSel');if(t&&s&&t.previousElementSibling!==s){t.classList.remove('rvHide');s.after(t)}
  [...nav.children].forEach(e=>{if(!e.classList.contains('rvNP'))e.classList.add('rvHide')})}).observe(nav,{childList:true});
 // --- Status bar
 const sb=$('#status');const ready=document.createElement('span');ready.id='rvReady';
 if(ml){ml.classList.remove('rvHide');sb.prepend(ml)}
 (ml?ml.after(ready):sb.prepend(ready));
 const sr=document.createElement('span');sr.id='rvSR';sb.appendChild(sr);
 const SN=()=>window.PMSnap||{};
 const tgl=(id,title,icon,get,set)=>{const b=document.createElement('button');b.className='sb';b.id=id;b.title=title;b.innerHTML=svg(icon,16);b.onclick=()=>{set();updStat()};b._get=get;sr.appendChild(b);return b};
 const snap=k=>()=>{const s=SN();s[k]=!s[k];LS.set('pm:snapopts',s);hook('prefs');redrawAll()};
 tgl('rvGrid','Show Grid (Shift+F8)','grid',()=>SN().show,snap('show'));
 tgl('rvSnapG','Snap To Grid (F8)','snapg',()=>SN().grid,snap('grid'));
 tgl('rvSnapC','Snap To Content (Ctrl+Shift+F9)','snapc',()=>SN().content,snap('content'));
 tgl('rvSnapM','Snap To Markup','snapm',()=>SN().markup,snap('markup'));
 tgl('rvReuse','Reuse: keep the tool after each markup','reuse',()=>!!S.lock,()=>{S.lock=!S.lock;updateRibbon();LS.set('pm:qa4:reuse',!!S.lock)});
 tgl('rvSync','Synchronize views','sync',()=>{const v=window.PMViews;return!!(v&&v.P2&&v.P2.on&&v.P2.sync)},()=>{const v=window.PMViews;if(!v||!v.P2||!v.P2.on)return toast('Split the view first');v.setSync()});
 const sc=document.createElement('button');sc.id='rvScale';sc.title='Scale (calibrate or pick a scale)';sr.appendChild(sc);sc.onclick=()=>scaleMenu(sc);
 const sz=document.createElement('span');sz.className='tx';sz.id='rvSize';sr.appendChild(sz);
 const xy=document.createElement('span');xy.className='tx';xy.id='rvXY';xy.style.minWidth='92px';sr.appendChild(xy);
 // cursor position in page inches from the sheet's lower-left corner, like Revu
 viewer.addEventListener('pointermove',e=>{if(!S.pages.length)return;try{const p=pageFromEvent(e);if(!p){xy.textContent='';return}const q=toPt(e,p);xy.textContent=`(${(q[0]/72).toFixed(2)}, ${((p.h-q[1])/72).toFixed(2)})`}catch(_){}});
 viewer.addEventListener('pointerleave',()=>{xy.textContent=''});
 // panels start closed, like a fresh Revu (a choice already made is kept)
 if(localStorage.getItem('pm:dl:col')===null){$('#left').classList.add('dlCollapsed');LS.set('pm:dl:col',true)}
 orderStrip();setTimeout(orderStrip,500);
 updStat();setInterval(updStat,400);syncPB();
}
/* the vertical tool strip in Revu's order (Select, Pan and Select Text live in the Navigation bar) */
const STRIP=[['Markup',['text','highlight','pen','note','cloud','callout','stamp','image']],['Lines',['line','arrow','arc','polyline','dimension']],['Shapes',['rect','ellipse','polygon']],
 ['Measure',['length','area','perimeter','count','polylength','angle','circle','volume','calibrate']]];
function orderStrip(){const rb=$('#ribbon');if(!rb||rb.dataset.rv)return;const btn=t=>rb.querySelector(`.grp [data-tool="${t}"]`);if(!btn('text'))return;rb.dataset.rv='1';
 const old=[...rb.querySelectorAll(':scope > .grp')],used=new Set(['select','pan','seltext']);const frag=[];
 for(const[name,tools]of STRIP){const g=document.createElement('div');g.className='grp';g.innerHTML=`<span class="glab hide-m">${name}</span>`;for(const t of tools){const b=btn(t);if(b){g.appendChild(b);used.add(t)}}if(g.children.length>1)frag.push(g)}
 const more=document.createElement('div');more.className='grp';more.innerHTML='<span class="glab hide-m">More</span>';
 old.forEach(g=>[...g.querySelectorAll('.btn')].forEach(b=>{const t=b.dataset.tool;if(t&&used.has(t)){if(['select','pan','seltext'].includes(t))b.classList.add('rvNav');return}more.appendChild(b)}));
 if(more.children.length>1)frag.push(more);
 const first=old[0];frag.forEach((g,i)=>{if(i){const sp=document.createElement('div');sp.className='sep';first.before(sp)}first.before(g)});
 // the old groups now only hold Select / Pan / Select Text, kept (hidden) so their shortcuts and states still work
 old.forEach(g=>{g.classList.add('rvNavGrp');const pv=g.previousElementSibling;if(pv&&pv.classList.contains('sep'))pv.remove()});
 try{window.PMWorkspace&&PMWorkspace.applyTB&&PMWorkspace.applyTB()}catch(e){}}
// the scale button in the status bar: a short menu, like Bluebeam's
function scaleMenu(btn){const W=window.PMWorkspace;if(!S.pdf||!W||!W.ctx){const b=$('#scaleBtn');b&&b.click();return}const r=btn.getBoundingClientRect(),SD=window.PMScaleDetect,n=S.cur,cur=scaleFor(n),p=SD&&SD.lastFor&&SD.lastFor(n);
 const items=[];if(p&&p.sc&&(cur.none||p.sc.label!==cur.label)){const t=p.test||{},tot=t.agree+(t.other||0);items.push({label:`Use ${p.sc.label} (${p.source==='sheet'?'printed on the sheet':'from the dimensions'}${t.tested?(SD.passes(p)?' ✓':' ⚠'):''})`,run:()=>{const v=SD.applyProposal(p);if(v===false)return toast('This page has a protected scale');SD.afterApply();toast('Scale set: '+p.sc.label+(v?` · ${v} detail viewport${v>1?'s':''} added`:''))}},'-')}
 items.push({label:'Set scale…',run:()=>scaleDialog()},{label:'Calibrate',run:()=>{setTool('calibrate');toast('Draw a line over a known dimension')}},'-',{label:'Check scale against the dimensions',dis:!SD,run:()=>SD.checkNow()},{label:'Set every page from its sheet…',dis:!SD,run:()=>SD.allPages()});
 W.ctx(r.left,r.top-8-items.length*28,items)}
function scaleTxt(n){try{const s=scaleFor(n);return s.none?'Scale Not Set':(s.label||'Scaled')}catch(e){return''}}
function updStat(){if(!built)return;const p=S.pages[S.cur-1];
 const sz=p?`${(p.w/72).toFixed(2)} x ${(p.h/72).toFixed(2)} in`:'',sct=p?scaleTxt(S.cur):'';
 const t=$('#rvSize');if(t&&t.textContent!==sz)t.textContent=sz;
 const sc=$('#rvScale');const h=p?`${svg('list',12)}${esc(sct)}`:'';if(sc&&sc.dataset.h!==h){sc.dataset.h=h;sc.innerHTML=h}
 const ns=$('#rvNavScale');if(ns&&ns.textContent!==sct)ns.textContent=sct;
 const di=$('#dlInfo');if(di&&di.textContent!==sz)di.textContent=sz;
 $$('#rvSR .sb').forEach(b=>b.classList.toggle('on',!!b._get()));
 // left of the status bar: what Revu shows — "Open PDF to markup.", "Ready", or the current tool's help
 const hint=($('#hint')||{}).textContent||'';const quiet=!S.sel.size&&(S.tool==='pan'||S.tool==='select')&&!S.drawing;
 const r=!S.pages.length?'Open PDF to markup.':quiet?'Ready':hint;const rd=$('#rvReady');if(rd&&rd.textContent!==r)rd.textContent=r}
/* Properties toolbar: a compact copy of the main fields of the Properties panel; editing here edits there */
const PF=[['stroke','Line'],['fill','Fill'],['fillOpacity','Fill opacity'],['width','Width'],['dash','Style'],['s2:lineStyle','Line style'],['opacity','Opacity'],['headS','Start'],['headE','End'],['s2:leadHead','Leader'],['|'],
 ['font','Font'],['fontSize','Size'],['bold',''],['italic',''],['color','Text'],['s2:align','Align']];
const SEL=f=>f.startsWith('s2:')?`[data-s2="${f.slice(3)}"]`:`[data-f="${f}"]`;
// the Properties panel redraws itself after some edits, so always talk to its current field
const liveSrc=f=>document.querySelector('#props '+SEL(f));
function syncPB(){const pb=$('#rvPB');if(!pb)return;if(pb.contains(document.activeElement))return;const box=$('#props');pb.innerHTML='';let last=null;
 for(const[f,lab]of PF){if(f==='|'){if(last&&last.className==='pf'){const v=document.createElement('span');v.className='vs';pb.appendChild(v);last=v}continue}
  const src=box.querySelector(SEL(f));if(!src)continue;if(f==='dash'&&box.querySelector('[data-s2="lineStyle"]'))continue;   // one line-style list, like the panel
  const w=document.createElement('label');w.className='pf';if(lab)w.innerHTML=`<i>${lab}</i>`;let c;
  if(src.type==='checkbox'&&(f==='bold'||f==='italic')){c=document.createElement('button');c.type='button';c.className='tg'+(src.checked?' on':'');c.textContent=f==='bold'?'B':'I';if(f==='italic')c.style.fontStyle='italic';c.title=f==='bold'?'Bold':'Italic';
   c.onclick=()=>{const sr=liveSrc(f)||src;sr.checked=!sr.checked;sr.dispatchEvent(new Event('input',{bubbles:true}));sr.dispatchEvent(new Event('change',{bubbles:true}));c.classList.toggle('on',sr.checked)}}
  else if(src.type==='range'){const nb=document.createElement('input');nb.type='number';nb.min=0;nb.max=100;nb.step=5;nb.value=src.value;nb.dataset.pf=f;nb.style.width='50px';
   nb.title={opacity:'Opacity',fillOpacity:'Fill opacity'}[f]||'';
   const pass=t=>()=>{if(nb.value==='')return;const sr=liveSrc(f)||src;sr.value=Math.max(+sr.min||0,Math.min(100,+nb.value||0));sr.dispatchEvent(new Event(t,{bubbles:true}))};nb.addEventListener('input',pass('input'));nb.addEventListener('change',pass('change'));w.append(nb);const pc=document.createElement('i');pc.textContent='%';w.append(pc);c=null}
  else{c=src.cloneNode(true);c.removeAttribute('id');c.removeAttribute('data-f');c.removeAttribute('data-s2');c.dataset.pf=f;c.style.cssText='';
   if(src.tagName==='SELECT')c.value=src.value;else if(src.type==='checkbox')c.checked=src.checked;else c.value=src.value;
   const pass=t=>()=>{const sr=liveSrc(f)||src;if(sr.type==='checkbox')sr.checked=c.checked;else sr.value=c.value;sr.dispatchEvent(new Event(t,{bubbles:true}))};
   c.addEventListener('input',pass('input'));c.addEventListener('change',pass('change'))}
  if(!c){pb.appendChild(w);last=w;continue}
  c.title=c.title||({headS:'Line start',headE:'Line end','s2:align':'Text alignment','s2:lineStyle':'Line style','s2:leadHead':'Leader end',stroke:'Line color',fill:'Fill color',fillOpacity:'Fill on/off',width:'Line width',dash:'Line style',opacity:'Opacity',font:'Font',fontSize:'Font size',color:'Text color'}[f]||'');
  w.appendChild(c);pb.appendChild(w);last=w}
 if(last&&last.className==='vs')last.remove()}
function valuesPB(){const box=$('#props');$$('#rvPB [data-pf]').forEach(c=>{const s=box.querySelector(SEL(c.dataset.pf));if(!s||c===document.activeElement)return;if(s.type==='checkbox')c.checked=s.checked;else c.value=s.value})}
/* Windows app: the menu row is the window's title bar (drag it to move the window, double-click to maximise);
   the minimise / maximise / close buttons sit on its right end in the same colours */
function titleBar(){const wco=navigator.windowControlsOverlay;const d=window.pmDesktop;if(!wco||!d||!d.setTitleBar)return;
 const set=()=>{document.body.classList.toggle('rvWCO',!!wco.visible);const light=document.body.classList.contains('light');
  const want=light?'#ffffff|#1e1f21':'#000000|#ffffff';if(set.last===want)return;set.last=want;const[c,sc]=want.split('|');d.setTitleBar({color:c,symbolColor:sc,height:26}).catch(()=>{})};
 set();wco.addEventListener('geometrychange',set);new MutationObserver(set).observe(document.body,{attributes:true,attributeFilter:['class']})}
H.ready.push(()=>setTimeout(titleBar,0));
H.ready.push(()=>setTimeout(build,0));
// the layout can be switched on later (Preferences or after the window grows)
new MutationObserver(()=>{if(on()&&!built)setTimeout(build,0)}).observe(document.body,{attributes:true,attributeFilter:['class']});
/* panels you don't use can be taken off the left strip (right-click an icon, or Window > Show / hide panels…), like
   closing a panel in Revu; the choice follows your sign-in */
const HP='pm:rv:hidePanels';window.PM_EXTRA_SYNC_KEYS_RV=[HP];
const hidden=()=>{try{return LS.get(HP,[])||[]}catch(e){return[]}};
function panelList(){return[...$$('#left .tabs [data-tab]')].map(b=>({id:b.dataset.tab,name:(b.title||b.dataset.dl||b.textContent||b.dataset.tab).replace(/\s*\(.*\)$/,'').trim()}))}
function applyHidden(){const h=hidden();let st=$('#rvPanelHide');if(!st){st=document.createElement('style');st.id='rvPanelHide';document.head.appendChild(st)}
 st.textContent=h.map(id=>`#left .tabs [data-tab="${CSS.escape(id)}"],.dlMenuItem[data-t="${CSS.escape(id)}"]{display:none!important}`).join('\n');
 // if the open panel was just hidden, close the side panel
 const cur=$('#left .tabs [data-tab].on');if(cur&&h.includes(cur.dataset.tab)){$('#left').classList.add('dlCollapsed');LS.set('pm:dl:col',true)}}
function setHidden(h){LS.set(HP,[...new Set(h)]);applyHidden();hook('prefs')}
function panelsDialog(){const h=hidden();const L=panelList();
 modal('Show / hide panels',`<div style="columns:2;column-gap:24px;min-width:360px">${L.map(p=>`<label style="display:flex;gap:8px;align-items:center;padding:4px 0;break-inside:avoid"><input type="checkbox" data-pp="${esc(p.id)}" ${h.includes(p.id)?'':'checked'}>${esc(p.name)}</label>`).join('')}</div><div style="font-size:11px;color:var(--mut);margin-top:8px">Unticked panels leave the left strip. Their tools still work from the menus.</div>`,
  [{label:'Show all',fn:md=>{md.querySelectorAll('[data-pp]').forEach(c=>c.checked=true);return false}},{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>setHidden([...md.querySelectorAll('[data-pp]')].filter(c=>!c.checked).map(c=>c.dataset.pp))}])}
document.addEventListener('contextmenu',e=>{const b=e.target.closest&&e.target.closest('#left .tabs [data-tab]');if(!b||!on())return;e.preventDefault();e.stopPropagation();
 const p=panelList().find(x=>x.id===b.dataset.tab)||{name:b.dataset.tab};
 window.PMWorkspace&&PMWorkspace.ctx(e.clientX,e.clientY,[{label:`Hide ${p.name}`,run:()=>setHidden([...hidden(),b.dataset.tab])},{label:'Show / hide panels…',run:panelsDialog}])},true);
// the panel title's drop-down list gets the same choice at its end
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1||!n.querySelector||!n.querySelector('.dlMenuItem')||n.querySelector('[data-rvpp]'))continue;
 const it=document.createElement('div');it.className='dlMenuItem';it.dataset.rvpp='1';it.style.cssText='display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:4px;cursor:pointer;border-top:1px solid var(--line);margin-top:4px';it.textContent='Show / hide panels…';
 it.onclick=ev=>{ev.stopPropagation();n.remove();panelsDialog()};n.appendChild(it)}}).observe(document.body,{childList:true});
H.ready.push(()=>setTimeout(applyHidden,0));H.prefs&&H.prefs.push(applyHidden);
window.PM_EXTRA_CMDS_RV=()=>[{id:'rv:panels',menu:'Window',label:'Show / hide panels…',key:'',run:panelsDialog},{id:'rv:classic',menu:'View',label:'Classic layout',key:'',run:()=>window.PMDrafting&&PMDrafting.setOn(false)}];
// the Properties panel opens only when asked for (Alt+P, right-click > Properties), docked on the right like Revu
function props(show){if(!on())return false;const b=document.body,want=show===true?true:!b.classList.contains('dlProps');b.classList.toggle('dlProps',want);$('#right').classList.remove('hide');LS.set('pm:dl:props',want);renderProps();setTimeout(()=>window.dispatchEvent(new Event('resize')),30);return true}
window.PMRevu={rebuild:syncPB,status:updStat,props};
})();
