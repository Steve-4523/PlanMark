/* PlanMark — ready-made setups (1.5.9)
   Estimating, Project manager and Field each show only the tools, side panels and "More" items that person uses,
   so the screen is simpler. "Everything" shows it all. Pick one on the start screen or under View ▸ Setup; nothing
   is removed — any tool is still one Find a command (Ctrl+Shift+P) or shortcut key away, and switching back is instant. */
(function(){
const SETUPS={
 all:{name:'Everything',hint:'Every tool and panel'},
 est:{name:'Estimating',hint:'Measure, count and price takeoffs',
  fams:['text','pen','cloud','line','shape','length','area','count','angle','calibrate'],
  panels:['pages','bookmarks','search','chest','measure','layers','sets','files','spaces'],
  more:['View','Print','Report','Compare','Overlay','OCR','Max','Snapshot','Display','Takeoff','Search+'],list:true},
 pm:{name:'Project manager',hint:'Review, comment, stamp and compare',
  fams:['text','highlight','pen','cloud','stamp','line','shape','length','area','count','calibrate'],
  panels:['pages','bookmarks','search','chest','measure','sets','files','attach','signatures','history','links','flags'],
  more:['View','Print','Report','Compare','Overlay','OCR','Batch','Sign','Snapshot','Edit','Document','Display','Content','Styles','Secure','Field','Forms','Search+'],list:true},
 field:{name:'Field',hint:'Simple markups, photos and punch items',
  fams:['text','pen','cloud','stamp','line','shape','length','count','calibrate'],
  panels:['pages','bookmarks','search','field','measure','files'],
  more:['View','Print','Compare','Snapshot','Field'],list:false}};
const KEY='pm:setup';
const cur=()=>{const k=LS.get(KEY,'all');return SETUPS[k]?k:'all'};

function use(k,quiet){if(!SETUPS[k])return;LS.set(KEY,k);const s=SETUPS[k];
 // side panels
 try{const L=JSON.parse(JSON.stringify(PMLayout.get()));const all=[...document.querySelectorAll('#left .tabs [data-tab]')].map(b=>b.dataset.tab);
  for(const t of all)L.tabs[t]=s.panels?s.panels.includes(t):true;
  if(s.panels&&!s.panels.includes(L.tab))L.tab='pages';PMLayout.set(L);
  const on=document.querySelector('#left .tabs [data-tab].on');if(on&&getComputedStyle(on).display==='none')switchTab('pages')}catch(e){console.warn(e)}
 // tools and More items
 try{PMToolGroups.setShown(s.fams||null,s.more||null)}catch(e){}
 // Markups list open for estimating and review, closed in the field
 try{if(s.list!==undefined&&document.body.classList.contains('dl')&&document.body.classList.contains('dlML')!==s.list){const b=$('#dlMLBtn');b&&b.click()}}catch(e){}
 try{window.PMEasy&&PMEasy.renderStart()}catch(e){}
 if(!quiet)toast(k==='all'?'Showing every tool and panel':`${s.name} setup — fewer tools and panels. View ▸ Setup ▸ Everything shows them all again`)}

window.PM_EXTRA_CMDS_SETUP=()=>Object.entries(SETUPS).map(([k,s])=>({id:'su:'+k,menu:'View',label:'Setup: '+s.name,run:()=>use(k),check:()=>cur()===k}));

// keep the chosen setup when the toolbar or panels are rebuilt, and when the app starts
H.ready.push(()=>setTimeout(()=>{const k=cur();if(k!=='all'){const s=SETUPS[k];try{PMToolGroups.setShown(s.fams,s.more)}catch(e){}}},700));

// on the start screen: "What kind of work do you do?" until someone picks
const css=document.createElement('style');css.textContent=`
#empty .suPick{margin-top:16px;text-align:center}
#empty .suPick .q{font-size:12.5px;color:var(--mut);margin-bottom:6px}
#empty .suPick .bs{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
#empty .suPick button{border:1px solid var(--line);border-radius:6px;padding:6px 10px;background:transparent;color:var(--text);cursor:pointer;font-size:12.5px;text-align:left;line-height:1.25}
#empty .suPick button:hover{background:var(--accbg)}
#empty .suPick button small{display:block;color:var(--mut);font-size:11px}
#empty .suPick button.on{border-color:var(--acc)}
#empty .suNow{margin-top:10px;font-size:12px;color:var(--mut)}#empty .suNow a{color:var(--acc);cursor:pointer}`;document.head.appendChild(css);
function startCard(){const ex=document.querySelector('#empty .ezExtra');if(!ex)return;let d=ex.querySelector('.suBox');if(!d){d=document.createElement('div');d.className='suBox';ex.prepend(d)}
 const picked=localStorage.getItem(KEY)!==null,k=cur();
 d.innerHTML=picked?`<div class="suNow">Setup: <b>${esc(SETUPS[k].name)}</b> · <a data-su="change">change</a></div>`
  :`<div class="suPick"><div class="q">What kind of work do you do? PlanMark will show the tools you need.</div><div class="bs">${['est','pm','field','all'].map(x=>`<button data-su="${x}">${esc(SETUPS[x].name)}<small>${esc(SETUPS[x].hint)}</small></button>`).join('')}</div></div>`;
 d.onclick=e=>{const b=e.target.closest('[data-su]');if(!b)return;if(b.dataset.su==='change'){d.innerHTML=`<div class="suPick"><div class="bs">${['est','pm','field','all'].map(x=>`<button data-su="${x}" class="${x===k?'on':''}">${esc(SETUPS[x].name)}<small>${esc(SETUPS[x].hint)}</small></button>`).join('')}</div></div>`;return}use(b.dataset.su)}}
new MutationObserver(()=>{const ex=document.querySelector('#empty .ezExtra');if(ex&&!ex.querySelector('.suBox'))startCard()}).observe(document.querySelector('#empty'),{childList:true,subtree:true});

window.PMSetups={SETUPS,use,cur};
})();
