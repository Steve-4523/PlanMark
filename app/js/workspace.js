/* PlanMark — workspace: menu bar, customizable toolbars, context menus, undo history, presentation mode,
   preferences (searchable), navigation memory, thumbnails extras, Links & Flags panels, edit commands
   (selection cycle, paste in place, align size, center, control points, Bézier curves, round corners),
   spell check, auto-complete, status keys, Bluebeam-style keyboard shortcuts. */
(function(){
const WS_VER='1.4.0';   // the version the "What's new" list was last written for (not the app's version)
const APP_VER='1.6.5';  // the app's version, written in by the release script: the website's About box showed WS_VER, so it said 1.4.0 for ever
const DEF_P={menu:true,crosshair:false,docDark:false,viewMode:false,rememberPos:true,reopenLast:false,showFiles:false,defLayout:'',lockFitWidth:false,
 reverseWheel:false,wheelSens:1,maxZoom:64,snapSens:9,snapColor:'#ff00ff',autoSize:true,popups:true,popOpacity:.95,thumbSize:150,thumbMarkups:true,thumbView:true,
 noLineWeights:false,replyBadges:true,shortcutSet:'bluebeam',statusKeys:{1:'Open',2:'In Progress',3:'Completed',4:'Accepted',5:'Rejected',6:'Field Verify'},
 autocomplete:true,spellUnderline:true,banners:true,language:'en'};
const P=Object.assign(clone(DEF_P),LS.get('pm:ws:prefs',{}));if(+P.maxZoom===24)P.maxZoom=64; // old default was 2400%; Bluebeam goes to 6400%
const saveP=()=>{LS.set('pm:ws:prefs',P);applyPrefs()};
window.PM_EXTRA_SYNC_KEYS_WS=['pm:ws:prefs','pm:ws:tb','pm:ws:dict','pm:ws:words'];
const WS={lastPt:null,present:false,prevMode:null,dict:null,dictLoading:null,clipPt:null,openKeys:[]};
const rib=l=>H.ribbon.find(r=>r.label===l);
const runRib=l=>{const r=rib(l);if(r)r.fn();else toast(l+' is not available')};
const need=f=>(...a)=>{if(!S.pages.length){toast('Open a PDF first');return}return f(...a)};
const sel=()=>[...S.sel].map(byId).filter(Boolean);
const needSel=f=>(...a)=>{if(!S.sel.size){toast('Select a markup first');return}return f(...a)};
const V=()=>window.PMViews||{};

/* ===================== styles ===================== */
const css=document.createElement('style');css.textContent=`
#wsMenu{display:flex;gap:0;padding:0 4px;background:var(--panel2);border-bottom:1px solid var(--line);height:26px;align-items:stretch;flex-shrink:0;font-size:12.5px;position:relative;z-index:40}
#wsMenu .wm{padding:0 10px;display:flex;align-items:center;cursor:default;border-radius:4px}#wsMenu .wm:hover,#wsMenu .wm.on{background:var(--accbg)}
.wsDrop,#wsCtx{position:fixed;z-index:90;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 34px rgba(0,0,0,.45);padding:4px;min-width:230px;max-height:80vh;overflow:auto;font-size:12.5px}
.wsI{display:flex;align-items:center;gap:14px;padding:5px 10px;border-radius:5px;cursor:pointer;white-space:nowrap}.wsI:hover{background:var(--accbg)}.wsI.dis{opacity:.4;pointer-events:none}
.wsI .k{margin-left:auto;color:var(--mut);font-size:11px}.wsSep{height:1px;background:var(--line);margin:4px 2px}.wsI.sub::after{content:'▸';margin-left:auto;color:var(--mut)}.wsI.chk::before{content:'✓';width:10px}.wsI.unchk::before{content:'';width:10px}
#ribbon.wsSmall .tb{height:34px;min-width:32px}#ribbon.wsSmall .tb svg{width:16px;height:16px}#ribbon.wsSmall .tb span{display:none}
#ribbon.wsLarge .tb{height:58px;min-width:52px}#ribbon.wsLarge .tb svg{width:26px;height:26px}#ribbon.wsNoLabels .tb span{display:none}#ribbon.wsNoLabels .tb{height:36px}
.wsPin{display:flex;align-items:center;gap:2px;padding:2px 6px;background:var(--panel);border-bottom:1px solid var(--line);overflow-x:auto;flex-shrink:0}.wsPin .pl{font-size:10px;color:var(--mut);padding:0 6px;white-space:nowrap}
body.wsPresent #wsMenu,body.wsPresent #topbar,body.wsPresent #ribbon,body.wsPresent .wsPin,body.wsPresent #left,body.wsPresent #right,body.wsPresent #mlist,body.wsPresent #status,body.wsPresent #tabBar,body.wsPresent #finish,body.wsPresent #wsBanner{display:none!important}
body.wsPresent #viewer{background:#000!important;cursor:none}body.wsPresent .page{box-shadow:none}body.wsPresent .page .pn{display:none}
#wsLaser{position:fixed;width:14px;height:14px;border-radius:50%;background:radial-gradient(#ff3b30 35%,rgba(255,59,48,.25) 70%,transparent);pointer-events:none;z-index:95;transform:translate(-50%,-50%);display:none}
body.wsDocDark .page canvas{filter:invert(1) hue-rotate(180deg)}body.wsDocDark .page{background:#111}
body.wsNoLW .page svg.ov .mk path:not(.hit){stroke-width:1px!important;vector-effect:non-scaling-stroke}
.wsCross{position:fixed;pointer-events:none;z-index:30;background:rgba(239,68,68,.55);display:none}
#wsPop{position:fixed;z-index:85;max-width:280px;background:#fffbe6;color:#1f2937;border:1px solid #e5c55a;border-radius:6px;padding:7px 9px;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.3);pointer-events:none;display:none;white-space:pre-wrap}
#wsAC{position:fixed;z-index:120;background:var(--panel);border:1px solid var(--acc);border-radius:6px;padding:3px 8px;font-size:12px;pointer-events:none;display:none}
.thumb{position:relative}.thumb svg.wsTh{position:absolute;pointer-events:none}.thumb.wsDragOver canvas{outline:3px solid var(--acc)}
#wsBanner button{pointer-events:auto} #wsBanner{pointer-events:none;opacity:.96;position:fixed;left:calc(var(--wsLeft,260px) + 16px);bottom:48px;z-index:70;width:330px;max-width:calc(100vw - 32px);background:var(--panel);border:1px solid var(--acc);border-radius:12px;padding:12px 14px;box-shadow:0 14px 40px rgba(0,0,0,.45)}
.wsHist .res.cur{background:var(--accbg)}.wsHist .res.fut{opacity:.5}
.wsSB{background:none;border:1px solid var(--line);border-radius:4px;padding:1px 7px;cursor:pointer;color:var(--text)}.wsSB.on{border-color:var(--acc);background:var(--accbg)}
`;document.head.appendChild(css);

/* ===================== flag markup ===================== */
T.flag={label:'Flag',kind:'click'};BASE_DEF.flag={stroke:'#dc2626',width:1.5,opacity:1,fill:'#ef4444',fillOpacity:1};if(S.defaults&&!S.defaults.flag)S.defaults.flag=clone(BASE_DEF.flag);
IC.flag='<path d="M5 21V4"/><path d="M5 4h11l-2.5 4L16 12H5" fill="currentColor" fill-opacity=".25"/>';HINTS.flag='Click to drop a review flag, then type a note';KEYS.flag='Shift+F';
if(Array.isArray(RIBBON[1])&&RIBBON[1][1]&&!RIBBON[1][1].includes('flag'))RIBBON[1][1].push('flag');

/* ===================== geometry: curves & rounded corners ===================== */
const CURVABLE=new Set(['line','arrow','polyline','polygon','area','perimeter','polylength','volume','space']);
const ROUNDABLE=new Set(['rect','polygon','area','perimeter','volume','space']);
const VERTEXED=new Set(['polyline','polygon','area','perimeter','polylength','volume','space','cloud','cloudplus']);
const isClosed=m=>['polygon','area','perimeter','volume','space','cloud','cloudplus'].includes(m.type);
function hasCurves(m){return m.curves&&Object.keys(m.curves).length>0}
function needsGeom(m){return(CURVABLE.has(m.type)&&hasCurves(m))||(ROUNDABLE.has(m.type)&&(m.style&&m.style.radius>0))}
function segEnds(m,i){const n=m.pts.length;return[m.pts[i],m.pts[(i+1)%n]]}
function cubicOf(a,b,q){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],Q=[mid[0]+q[0],mid[1]+q[1]];return[a,[a[0]+2/3*(Q[0]-a[0]),a[1]+2/3*(Q[1]-a[1])],[b[0]+2/3*(Q[0]-b[0]),b[1]+2/3*(Q[1]-b[1])],b]}
function bez(c,t){const u=1-t;return[u*u*u*c[0][0]+3*u*u*t*c[1][0]+3*u*t*t*c[2][0]+t*t*t*c[3][0],u*u*u*c[0][1]+3*u*u*t*c[1][1]+3*u*t*t*c[2][1]+t*t*t*c[3][1]]}
function curvePts(m,steps=48){const pts=m.type==='rect'?rectCorners(m):m.pts,n=pts.length,closed=isClosed(m),segs=closed?n:n-1,out=[pts[0]];
 for(let i=0;i<segs;i++){const a=pts[i],b=pts[(i+1)%n],q=m.curves&&m.curves[i];if(q&&Math.hypot(q[0],q[1])>.01){const c=cubicOf(a,b,q);for(let k=1;k<=steps;k++)out.push(bez(c,k/steps))}else out.push(b)}
 if(closed&&out.length>1&&dist(out[0],out[out.length-1])<1e-6)out.pop();return out}
function rectCorners(m){const b=normBox(m.pts[0],m.pts[1]);return[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]}
function roundPoly(pts,r,closed,steps=12){const n=pts.length,out=[];for(let i=0;i<n;i++){const p=pts[i];if(!closed&&(i===0||i===n-1)){out.push(p);continue}
 const a=pts[(i-1+n)%n],b=pts[(i+1)%n],la=dist(a,p),lb=dist(b,p);if(la<1e-6||lb<1e-6){out.push(p);continue}const v1=[(a[0]-p[0])/la,(a[1]-p[1])/la],v2=[(b[0]-p[0])/lb,(b[1]-p[1])/lb];
 const cos=clamp(v1[0]*v2[0]+v1[1]*v2[1],-1,1),th=Math.acos(cos);if(th<1e-3||Math.PI-th<1e-3){out.push(p);continue}
 let t=r/Math.tan(th/2);const tmax=Math.min(la,lb)/2;let rr=r;if(t>tmax){t=tmax;rr=t*Math.tan(th/2)}
 const T1=[p[0]+v1[0]*t,p[1]+v1[1]*t],T2=[p[0]+v2[0]*t,p[1]+v2[1]*t],bis=[v1[0]+v2[0],v1[1]+v2[1]],bl=Math.hypot(...bis),d=rr/Math.sin(th/2),C=[p[0]+bis[0]/bl*d,p[1]+bis[1]/bl*d];
 let a1=Math.atan2(T1[1]-C[1],T1[0]-C[0]),a2=Math.atan2(T2[1]-C[1],T2[0]-C[0]),da=a2-a1;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
 for(let k=0;k<=steps;k++){const an=a1+da*k/steps;out.push([C[0]+rr*Math.cos(an),C[1]+rr*Math.sin(an)])}}return out}
function geomPts(m){if(hasCurves(m)&&CURVABLE.has(m.type))return curvePts(m);const base=m.type==='rect'?rectCorners(m):m.pts;return roundPoly(base,m.style.radius,m.type==='rect'||isClosed(m))}
function geomClone(m){const g=geomPts(m),c=Object.assign({},m,{pts:g,curves:null,_geom:1});c.style=Object.assign({},m.style,{radius:0});if(m.type==='rect')c.type='polygon';if(m.type==='length')c.type='polylength';return c}
function arcLenBez(c,steps=2000){let L=0,p=c[0];for(let k=1;k<=steps;k++){const q=bez(c,k/steps);L+=dist(p,q);p=q}return L}
window.PMGeom={curvePts,roundPoly,geomPts,cubicOf,arcLenBez,rectCorners};

/* ===================== spell check ===================== */
const BUILTIN_WORDS='drywall rebar hvac mep rfi rfis gyp osb lvl glulam sheetrock btu cmu typ dwg pdf planmark bluebeam sf lf cy sy ea qty ft in mm cm subfloor sheathing joist joists soffit fascia gable firestop firestopping fireproofing jamb jambs stud studs headers mullion mullions grout caulk caulking flashings ductwork luminaire luminaires gfci afci conduit epoxy formwork shoring underlayment backfill footings rebar millwork casework countertop countertops vapor substrate unistrut sprinkler sprinklers egress ada nfpa ibc ul ansi astm osha precast prestressed postensioned ok etc'.split(' ');
async function loadDict(){if(WS.dict)return WS.dict;if(WS.dictLoading)return WS.dictLoading;
 WS.dictLoading=(async()=>{const r=await fetch(new URL('lib/spell/words.txt',location.href).href);if(!r.ok)throw new Error('dictionary missing');const txt=await r.text();const s=new Set(txt.split(/\r?\n/));BUILTIN_WORDS.forEach(w=>s.add(w));(LS.get('pm:ws:dict',[])||[]).forEach(w=>s.add(String(w).toLowerCase()));WS.dict=s;return s})();
 try{return await WS.dictLoading}catch(e){WS.dictLoading=null;throw e}}
function okWord(w){if(!WS.dict)return true;if(w.length<=2||/\d/.test(w)||/^[A-Z]{2,6}s?$/.test(w))return true;const l=w.toLowerCase().replace(/[’']s$/,'').replace(/[’']/g,"'");if(WS.dict.has(l)||WS.dict.has(w))return true;
 for(const suf of['s','es','ed','ing','ly','er','ers']){if(l.endsWith(suf)&&WS.dict.has(l.slice(0,-suf.length)))return true}return false}
function edits1(w){const a='abcdefghijklmnopqrstuvwxyz',out=new Set();for(let i=0;i<=w.length;i++){const L=w.slice(0,i),R=w.slice(i);if(R)out.add(L+R.slice(1));if(R.length>1)out.add(L+R[1]+R[0]+R.slice(2));for(const c of a){if(R)out.add(L+c+R.slice(1));out.add(L+c+R)}}return out}
function suggest(w){if(!WS.dict)return[];const l=w.toLowerCase(),res=[];for(const e of edits1(l))if(WS.dict.has(e))res.push(e);
 if(res.length<3&&l.length<=9){for(const e of edits1(l))for(const e2 of edits1(e))if(WS.dict.has(e2)&&!res.includes(e2)){res.push(e2);if(res.length>12)break}}
 const cap=w[0]===w[0].toUpperCase()&&w.slice(1)===w.slice(1).toLowerCase();return[...new Set(res)].sort((a,b)=>{const pa=[...a].findIndex((c,i)=>c!==l[i]),pb=[...b].findIndex((c,i)=>c!==l[i]);return Math.abs(a.length-l.length)-Math.abs(b.length-l.length)||(pb-pa)}).slice(0,6).map(s=>cap?s[0].toUpperCase()+s.slice(1):s)}
const WORD_RE=/[A-Za-z][A-Za-z’']*[A-Za-z]|[A-Za-z]/g;
function misspelled(text){const out=[];if(!text)return out;let m;WORD_RE.lastIndex=0;while((m=WORD_RE.exec(text)))if(!okWord(m[0]))out.push({w:m[0],i:m.index});return out}
const TEXTISH=new Set(['text','callout','typewriter','cloudplus']);
function spellTargets(){const out=[];for(const m of S.markups){for(const f of['text','comment','label','subject']){const v=m[f];if(!v||(f==='subject'&&v===defSubject(m.type)))continue;for(const x of misspelled(v))out.push({m,f,w:x.w,i:x.i})}}return out}
async function spellDialog(){if(!S.pages.length)return toast('Open a PDF first');toast('Checking spelling…');try{await loadDict()}catch(e){return toast('Spelling dictionary could not be loaded')}
 let ignored=new Set();const step=()=>{const list=spellTargets().filter(x=>!ignored.has(x.w.toLowerCase()));if(!list.length){closeModal();toast('Spell check complete — no mistakes found');redrawAll();return}
  const x=list[0],sug=suggest(x.w),ctxt=x.m[x.f];const pre=esc(ctxt.slice(Math.max(0,x.i-30),x.i)),post=esc(ctxt.slice(x.i+x.w.length,x.i+x.w.length+30));
  setSel([x.m.id]);scrollToBox(x.m.page,bboxOf(x.m));
  modal('Check spelling',`<div class="hint" style="margin-bottom:6px">${esc(T[x.m.type].label)} on page ${x.m.page} · ${esc(x.f)} · ${list.length} issue${list.length>1?'s':''} left</div>
  <div class="meas" style="font-size:13px">…${pre}<b style="color:#f87171;text-decoration:underline wavy">${esc(x.w)}</b>${post}…</div>
  <div class="fld"><label>Change to</label><input class="ti" id="spTo" value="${esc(sug[0]||x.w)}"></div>
  <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px">${sug.map(s=>`<button class="btn" data-sg="${esc(s)}" style="border:1px solid var(--line)">${esc(s)}</button>`).join('')||'<span class="hint">No suggestions</span>'}</div>`,
  [{label:'Close',cancel:1},{label:'Add to dictionary',fn:()=>{const d=LS.get('pm:ws:dict',[]);d.push(x.w.toLowerCase());LS.set('pm:ws:dict',[...new Set(d)]);WS.dict.add(x.w.toLowerCase());setTimeout(step,0)}},
   {label:'Ignore',fn:()=>{ignored.add(x.w.toLowerCase());setTimeout(step,0)}},{label:'Change',pri:1,fn:md=>{const to=md.querySelector('#spTo').value;pushUndo();x.m[x.f]=x.m[x.f].slice(0,x.i)+to+x.m[x.f].slice(x.i+x.w.length);x.m.modified=Date.now();commit();setTimeout(step,0)}}]);
  $('#modal').querySelectorAll('[data-sg]').forEach(b=>b.onclick=()=>{$('#spTo').value=b.dataset.sg})};step()}
window.PMSpell={loadDict,okWord,suggest,misspelled,spellDialog};

/* ===================== core wrappers (installed when everything has loaded) ===================== */
function installWrappers(){
 const _prims=prims;prims=function(m){if(m&&!m._geom&&needsGeom(m))return _prims(geomClone(m));if(m&&m.type==='flag')return flagPrims(m);return _prims.apply(this,arguments)};
 const _meas=measOf;measOf=function(m){if(m&&!m._geom&&needsGeom(m)&&T[m.type]&&T[m.type].meas)return _meas(geomClone(m));return _meas.apply(this,arguments)};
 const _bb=bboxOf;bboxOf=function(m){if(m&&m.type==='flag'){const[x,y]=m.pts[0];return[x-2,y-24,x+18,y+2]}if(m&&needsGeom(m))return ptsBox(geomPts(m));return _bb.apply(this,arguments)};
 const _hd=handlesOf;handlesOf=function(m){if(m.type==='flag')return[];const h=_hd.apply(this,arguments);if(m.locked||!CURVABLE.has(m.type)||S.sel.size!==1||m.pts.length<2)return h;
  const n=m.pts.length,segs=isClosed(m)?n:n-1;for(let i=0;i<segs;i++){const[a,b]=segEnds(m,i),q=m.curves&&m.curves[i],c=q?cubicOf(a,b,q):null,p=c?bez(c,.5):[(a[0]+b[0])/2,(a[1]+b[1])/2];h.push([p[0],p[1],'b'+i])}return h};
 const _ah=applyHandle;applyHandle=function(m,k,pt,orig){if(k&&k[0]==='b'){const i=+k.slice(1),n=m.pts.length,a=m.pts[i],b=m.pts[(i+1)%n],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],q=[2*(pt[0]-mid[0]),2*(pt[1]-mid[1])];
   m.curves=Object.assign({},m.curves||{});if(Math.hypot(q[0],q[1])<1.5)delete m.curves[i];else m.curves[i]=q;if(!Object.keys(m.curves).length)delete m.curves;return}return _ah.apply(this,arguments)};
 const _ms=markupSvg;markupSvg=function(m,prev){let h=_ms.apply(this,arguments);if(prev)return h;let extra='';
  if(P.replyBadges&&m.replies&&m.replies.length){const b=bboxOf(m),k=1/S.zoom;extra+=`<g transform="translate(${b[2]} ${b[1]}) scale(${k})" pointer-events="none"><path d="M0 -14h16v10h-8l-4 4v-4h-4z" fill="#2563eb" stroke="#fff" stroke-width="1"/><text x="8" y="-7" font-size="8" fill="#fff" text-anchor="middle" font-family="Helvetica">${m.replies.length}</text></g>`}
  if(P.spellUnderline&&WS.dict&&TEXTISH.has(m.type)&&m.text){for(const p of prims(m)){if(p.k!=='t'||p.align!=='start'||!p.s)continue;for(const x of misspelled(p.s)){if(/^[A-Z]/.test(x.w))continue;   // names of people, towns and companies are not in the word list: not marked on the sheet (F7 still lists them)
   const x0=p.x+tw(p.s.slice(0,x.i),p.size,p.bold,p.font,p.italic),w=tw(x.w,p.size,p.bold,p.font,p.italic),y=p.y+p.size*.55,a=Math.max(.6,p.size*.08);let d=`M${x0.toFixed(2)} ${y.toFixed(2)}`;for(let xx=x0,s=1;xx<x0+w;xx+=a*2,s=-s)d+=` L${(xx+a*2).toFixed(2)} ${(y+s*a).toFixed(2)}`;extra+=`<path d="${d}" stroke="#e11d48" stroke-width="${(p.size*.06).toFixed(2)}" fill="none" pointer-events="none"/>`}}}
  return extra?h.replace(/<\/g>$/,extra+'</g>'):h};
 const _pu=pushUndo;pushUndo=function(){_pu.apply(this,arguments);const i=S.undo.length-1;if(i>=0&&typeof S.undo[i]==='string'){const o=new String(S.undo[i]);o.label=WS.nextLabel||null;o.at=Date.now();S.undo[i]=o;WS.nextLabel=null}};
 const _un=undo;undo=function(){const e=S.undo[S.undo.length-1],r=_un.apply(this,arguments);if(e&&S.redo.length){const k=S.redo.length-1,o=new String(S.redo[k]);o.label=e.label;o.at=e.at;S.redo[k]=o}renderHistory();return r};
 const _re=redo;redo=function(){const e=S.redo[S.redo.length-1],r=_re.apply(this,arguments);if(e&&S.undo.length){const k=S.undo.length-1,o=new String(S.undo[k]);o.label=e.label;o.at=e.at;S.undo[k]=o}renderHistory();return r};
 const _sz=setZoom;setZoom=function(z,a){const r=_sz.call(this,Math.min(z,Math.max(.25,(+P.maxZoom||64))),a);lockFit();schedulePos();updViewRect();return r};
 const _bt=buildThumbs;buildThumbs=async function(){const r=_bt.apply(this,arguments);setTimeout(decorateThumbs,30);setTimeout(decorateThumbs,900);return r};
 const _ac=afterCreate;afterCreate=function(m){const r=_ac.apply(this,arguments);if(m.type==='flag'){m.subject='Flag';textDialog(m,true,'comment')}return r};
 const _st=setTool;setTool=function(t,o){if(P.viewMode&&T[t]&&T[t].kind!=='nav'){toast('View mode — switch to Markup mode to edit (status bar)');return _st.call(this,'select')}return _st.apply(this,arguments)};
 // snap sensitivity & marker color
 if(H.snap){const _sn=H.snap;H.snap=function(p,pt,e){const r=_sn.apply(this,arguments);if(SNAPI&&P.snapSens<9){const d=Math.hypot(SNAPI.x-pt[0],SNAPI.y-pt[1])*S.zoom;if(d>P.snapSens){SNAPI=null;return pt}}return r}}
 H.over=H.over.map(f=>{const src=String(f);if(src.includes('SNAPI')&&src.includes('#ff00ff')){return(n,p)=>{const s=f(n,p);return s&&P.snapColor!=='#ff00ff'?s.split('#ff00ff').join(P.snapColor):s}}return f});
 // control points: Alt+click adds a vertex on a segment / removes a vertex
 H.down=(prev=>(e,p,pt)=>{
  if(P.viewMode&&p&&S.tool==='select'&&!e.altKey){const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);if(m&&m.type!=='hlink'){setSel([m.id]);return true}if(e.target.closest&&e.target.closest('[data-h]'))return true}
  if(e.altKey&&p&&S.tool==='select'&&S.sel.size===1){const m=sel()[0];if(m&&m.page===p.num&&VERTEXED.has(m.type)&&!m.locked){const tol=8/S.zoom,n=m.pts.length,closed=isClosed(m);
   const vi=m.pts.findIndex(q=>dist(q,pt)<=tol);if(vi>=0){if(n<=(closed?3:2)){toast('Needs at least '+(closed?3:2)+' points');return true}pushUndo();m.pts.splice(vi,1);if(m.curves){const c={};for(const k in m.curves){const j=+k;if(j<vi-1)c[j]=m.curves[k];else if(j>vi)c[j-1]=m.curves[k]}m.curves=c}m.modified=Date.now();commit();toast('Point removed');return true}
   const segs=closed?n:n-1;let best=-1,bd=tol,bp=null;for(let i=0;i<segs;i++){const a=m.pts[i],b=m.pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/L:0;t=clamp(t,0,1);const q=[a[0]+t*dx,a[1]+t*dy],d=dist(q,pt);if(d<bd){bd=d;best=i;bp=q}}
   if(best>=0){pushUndo();m.pts.splice(best+1,0,bp);if(m.curves){const c={};for(const k in m.curves){const j=+k;if(j<best)c[j]=m.curves[k];else if(j>best)c[j+1]=m.curves[k]}m.curves=c}m.modified=Date.now();commit();toast('Point added');return true}}}
  return prev?prev(e,p,pt):false})(H.down);
}
function flagPrims(m){const[x,y]=m.pts[0],s=m.style,o=s.opacity??1;return[{k:'p',d:dPoly([[x,y],[x,y-22]]),stroke:s.stroke,w:1.6,so:o,fill:null,fo:1},{k:'p',d:dPoly([[x,y-22],[x+15,y-22],[x+11,y-17],[x+15,y-12],[x,y-12]],true),stroke:s.stroke,w:1,so:o,fill:s.fill||'#ef4444',fo:s.fillOpacity??1}]}
T.flag.closed=1;

/* ===================== undo history ===================== */
function finalizeLabel(){const top=S.undo[S.undo.length-1];if(!top||typeof top!=='object'||top.label)return;let before=[];try{before=JSON.parse(String(top))}catch(e){return}
 const bm=new Map(before.map(m=>[m.id,m])),am=new Map(S.markups.map(m=>[m.id,m])),add=S.markups.filter(m=>!bm.has(m.id)),del=before.filter(m=>!am.has(m.id)),mod=S.markups.filter(m=>bm.has(m.id)&&JSON.stringify(bm.get(m.id))!==JSON.stringify(m));
 const nm=m=>(T[m.type]&&T[m.type].label)||m.type;let l;
 if(add.length&&!del.length&&!mod.length)l=add.length===1?'Add '+nm(add[0]):'Add '+add.length+' markups';
 else if(del.length&&!add.length&&!mod.length)l=del.length===1?'Delete '+nm(del[0]):'Delete '+del.length+' markups';
 else if(mod.length&&!add.length&&!del.length){const m=mod[0],b=bm.get(m.id);const onlyPts=mod.every(x=>{const y=bm.get(x.id);return JSON.stringify(Object.assign({},x,{pts:0,modified:0,curves:0}))===JSON.stringify(Object.assign({},y,{pts:0,modified:0,curves:0}))});
  l=(onlyPts?(JSON.stringify(m.pts.map(q=>[q[0]-m.pts[0][0],q[1]-m.pts[0][1]]))===JSON.stringify(b.pts.map(q=>[q[0]-b.pts[0][0],q[1]-b.pts[0][1]]))?'Move ':'Reshape '):'Edit ')+(mod.length===1?nm(m):mod.length+' markups')}
 else if(add.length||del.length||mod.length)l='Change '+(add.length+del.length+mod.length)+' markups';else l='No change';top.label=l}
function jumpHistory(target){// target = number of actions applied (0..undo+redo)
 const cur=S.undo.length;let guard=0;while(S.undo.length>target&&guard++<500)undo();while(S.undo.length<target&&S.redo.length&&guard++<500)redo();renderHistory()}
function renderHistory(){const pane=$('#pane-history');if(!pane)return;finalizeLabel();const u=S.undo,r=S.redo,n=u.length;
 const lab=(e,i)=>esc((e&&e.label)||'Change');const t=e=>e&&e.at?new Date(e.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'';
 let h=`<div class="hint" style="margin-bottom:6px">Click a step to go back (or forward) to it.</div><div class="wsHist"><div class="res ${n===0?'cur':''}" data-hj="0"><b>Opened</b> <small style="color:var(--mut)">${esc(S.fileName||'')}</small></div>`;
 for(let i=0;i<n;i++)h+=`<div class="res ${i===n-1?'cur':''}" data-hj="${i+1}">${lab(u[i],i)} <small style="color:var(--mut)">${t(u[i])}</small></div>`;
 for(let j=r.length-1,k=1;j>=0;j--,k++)h+=`<div class="res fut" data-hj="${n+k}">${lab(r[j])} <small style="color:var(--mut)">undone</small></div>`;
 pane.innerHTML=h+'</div>';pane.querySelectorAll('[data-hj]').forEach(d=>d.onclick=()=>jumpHistory(+d.dataset.hj))}

/* ===================== context menus ===================== */
let ctxEl=null;
function closeCtx(){if(ctxEl){ctxEl.remove();ctxEl=null}$$('.wsDrop').forEach(d=>d.remove());$$('#wsMenu .wm.on').forEach(x=>x.classList.remove('on'))}
function menuEl(items,x,y,cls){const d=document.createElement('div');if(cls)d.className=cls;else d.id='wsCtx';
 d.innerHTML=items.map((it,i)=>it==='-'||it.sep?'<div class="wsSep"></div>':it.head?`<div class="wsHd">${esc(it.head)}</div>`:`<div class="wsI ${it.dis?'dis':''} ${it.sub?'sub':''} ${it.check===true?'chk':it.check===false?'unchk':''}" data-i="${i}">${esc(it.label)}${it.key?`<span class="k">${esc(it.key)}</span>`:''}</div>`).join('');
 document.body.appendChild(d);const r=d.getBoundingClientRect();d.style.left=Math.max(4,Math.min(x,innerWidth-r.width-4))+'px';d.style.top=Math.max(4,Math.min(y,innerHeight-r.height-4))+'px';
 d.addEventListener('click',e=>{const el=e.target.closest('[data-i]');if(!el)return;const it=items[+el.dataset.i];if(!it||it.dis)return;if(it.sub){const rr=el.getBoundingClientRect();$$('.wsDrop.subm').forEach(s=>s.remove());menuEl(typeof it.sub==='function'?it.sub():it.sub,rr.right-2,rr.top,'wsDrop subm');return}closeCtx();try{it.run&&it.run()}catch(err){console.error(err);toast('Could not run: '+(err.message||err))}});
 d.addEventListener('pointerover',e=>{const el=e.target.closest('[data-i]');if(!el)return;const it=items[+el.dataset.i];if(it&&it.sub&&!d.classList.contains('subm')){const rr=el.getBoundingClientRect();$$('.wsDrop.subm').forEach(s=>s.remove());menuEl(typeof it.sub==='function'?it.sub():it.sub,rr.right-2,rr.top,'wsDrop subm')}});
 return d}
function ctx(x,y,items){closeCtx();ctxEl=menuEl(items,x,y)}
const fit=(kind,items,info)=>{try{if(window.PMQuick&&PMQuick.menu)return PMQuick.menu(kind,items,info)||items}catch(e){console.error(e)}return items};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#wsCtx,.wsDrop,#wsMenu'))closeCtx()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(ctxEl||$('.wsDrop'))){closeCtx();e.stopPropagation()}},true);
function statusSub(){const L=(window.PMListPro&&PMListPro.LP.statuses)||[];return L.map(s=>({label:s.name,run:()=>PMListPro.setStatusSel(s.name)}))}
function alignSub(){return[{label:'Align left',key:'Ctrl+Alt+L',run:()=>align('l')},{label:'Align center',key:'Ctrl+Alt+E',run:()=>align('hc')},{label:'Align right',key:'Ctrl+Alt+R',run:()=>align('r')},{label:'Align top',key:'Ctrl+Alt+T',run:()=>align('t')},{label:'Align middle',key:'Ctrl+Alt+M',run:()=>align('vc')},{label:'Align bottom',key:'Ctrl+Alt+B',run:()=>align('b')},'-',
 {label:'Distribute horizontally',run:()=>align('dh')},{label:'Distribute vertically',run:()=>align('dv')},'-',{label:'Same width',run:()=>alignSize('w')},{label:'Same height',run:()=>alignSize('h')},{label:'Same size',run:()=>alignSize('wh')},'-',{label:'Center in document',run:centerInDoc}]}
function markupMenu(x,y,m,from){if(!S.sel.has(m.id))setSel([m.id]);const lp=window.PMListPro,n=S.sel.size;const cv=(typeof CONVERT!=='undefined'&&CONVERT[m.type])||[];
 ctx(x,y,fit('markup',[{label:'Properties',key:'Alt+P',run:()=>{if(window.PMRevu&&PMRevu.props(true))return;$('#right').classList.remove('hide');renderProps()}},
  {label:m.locked?'Unlock':'Lock',key:'Ctrl+Shift+L',run:()=>lp&&lp.cmd('lock'),dis:!lp},{label:'Group',key:'Ctrl+G',run:()=>lp.cmd('group'),dis:!lp||n<2},{label:'Ungroup',key:'Ctrl+Shift+G',run:()=>lp.cmd('ungroup'),dis:!lp||!m.group},
  {label:'Status',sub:statusSub,dis:!lp},{label:'Reply…',run:()=>{$('#right').classList.remove('hide');renderProps();setTimeout(()=>{const t=$('#props textarea[data-reply],#props [data-act=reply],#props textarea');if(t)t.focus()},50)}},'-',
  {label:'Cut',key:'Ctrl+X',run:cut},{label:'Copy',key:'Ctrl+C',run:copySel},{label:'Paste',key:'Ctrl+V',run:()=>paste(false),dis:!S.clip},{label:'Paste in place',key:'Ctrl+Shift+V',run:pasteInPlace,dis:!S.clip},{label:'Duplicate',run:()=>paste(true)},'-',
  {label:'Arrange',sub:[{label:'Bring to front',key:'Ctrl+J',run:()=>reorder(true)},{label:'Bring forward',key:'Ctrl+]',run:()=>lp.cmd('forward')},{label:'Send backward',key:'Ctrl+[',run:()=>lp.cmd('backward')},{label:'Send to back',key:'Ctrl+Shift+J',run:()=>reorder(false)},'-',
   {label:'Rotate 90° ↻',run:()=>lp.cmd('rotcw')},{label:'Rotate 90° ↺',run:()=>lp.cmd('rotccw')},{label:'Flip horizontal',run:()=>lp.cmd('fliph')},{label:'Flip vertical',run:()=>lp.cmd('flipv')}]},
  {label:'Align & size',sub:alignSub,dis:n<1},
  cv.length?{label:'Convert to',sub:cv.map(t=>({label:T[t].label,run:()=>convertMarkup(m,t)}))}:{label:'Convert to',dis:true},
  CURVABLE.has(m.type)&&hasCurves(m)?{label:'Straighten curves',run:()=>{pushUndo();delete m.curves;commit()}}:null,
  ROUNDABLE.has(m.type)?{label:'Round corners…',run:()=>roundDialog(m)}:null,
  {label:'Magic Markups…',run:()=>PMAuto.magicDialog(),dis:!window.PMAuto},{label:'Add to Tool Chest',run:()=>modalPrompt('Add to Tool Chest','Tool name',m.subject||T[m.type].label,name=>{S.chest.push({name,type:m.type,subject:m.subject,text:m.type==='stamp'?m.text:undefined,style:clone(m.style)});LS.set('pm:chest',S.chest);renderChest();toast('Added to Tool Chest')})},
  {label:'Set as default style',run:()=>{if(S.defaults[m.type]){Object.assign(S.defaults[m.type],clone(m.style));LS.set('pm:defaults',S.defaults);toast('Default updated')}}},'-',
  {label:'Delete',key:'Del',run:()=>delSel()}].filter(Boolean),{m,from:from||'sheet'}))}
function pageMenu(x,y,p,pt){WS.clipPt={page:p.num,pt};const n=p.num;
 ctx(x,y,fit('page',[{label:'Paste here',key:'Ctrl+V',run:()=>pasteAt(p.num,pt),dis:!S.clip},{label:'Paste in place',key:'Ctrl+Shift+V',run:pasteInPlace,dis:!S.clip},{label:'Select all on page',key:'Ctrl+A',run:()=>{if(S.tool!=='select')setTool('select');setSel(S.markups.filter(m=>m.page===n).map(m=>m.id))}},'-',
  {label:'Add note here',run:()=>{const m=newMarkup('note',n,[[pt[0]-9,pt[1]-9]],toolStyle('note'));pushUndo();S.markups.push(m);afterCreate(m)}},{label:'Add flag here',key:'Shift+F',run:()=>{const m=newMarkup('flag',n,[pt],toolStyle('flag'));pushUndo();S.markups.push(m);afterCreate(m)}},
  {label:'Add bookmark',key:'Ctrl+B',run:addBookmark},'-',
  {label:'Rotate page ↻',key:'Ctrl+Shift+R',run:()=>PMBatch.rotatePages([n],90)},{label:'Rotate page ↺',run:()=>PMBatch.rotatePages([n],-90)},{label:'Extract page',key:'Ctrl+Shift+X',run:()=>PMBatch.extract([n])},{label:'Delete page…',key:'Ctrl+Shift+D',run:()=>delPage(n)},{label:'More page tools…',run:()=>runRib('Document')},'-',
  {label:'Copy page as image',key:'Ctrl+Alt+C',run:()=>copyPageImage(n)},{label:'Document properties',key:'Ctrl+D',run:docProps},{label:'Set scale…',run:scaleDialog}],{p,pt,x,y}))}
function thumbMenu(x,y,n){if(window.PMQA5&&PMQA5.thumbMenu)return PMQA5.thumbMenu(x,y,n);ctx(x,y,[{label:'Go to page '+n,run:()=>gotoPage(n)},'-',{label:'Rotate ↻',run:()=>PMBatch.rotatePages([n],90)},{label:'Rotate ↺',run:()=>PMBatch.rotatePages([n],-90)},{label:'Move up',dis:n<=1,run:()=>movePageTo(n,n-1)},{label:'Move down',dis:n>=S.pages.length,run:()=>movePageTo(n,n+1)},{label:'Move to…',run:()=>modalPrompt('Move page '+n,'New position (1–'+S.pages.length+')',String(n),v=>movePageTo(n,clamp(parseInt(v)||n,1,S.pages.length)))},'-',
 {label:'Insert pages after…',run:()=>runRib('Batch')},{label:'Extract',run:()=>PMBatch.extract([n])},{label:'Delete…',run:()=>delPage(n)},'-',{label:'Add bookmark',run:()=>{gotoPage(n,true);addBookmark()}}])}
function tabMenu(x,y,tid,two,slot){if(slot==null)slot=two?1-V().act:V().act;const vw=V(),tabs=vw.tabs||[],t=tabs.find(t=>String(t.id)===String(tid));if(!t)return;const i=tabs.indexOf(t);const sp=!!(vw.P2&&vw.P2.on);
 ctx(x,y,fit('tab',[{label:'Close',key:'Ctrl+W',run:()=>sp&&vw.closeInPane?vw.closeInPane(t.id,slot):vw.closeTab(t.id)},{label:'Close others',dis:tabs.length<2,run:()=>tabs.filter(o=>o!==t).map(o=>o.id).forEach(id=>vw.closeTab(id))},{label:'Close tabs to the right',dis:i>=tabs.length-1,run:()=>tabs.slice(i+1).map(o=>o.id).forEach(id=>vw.closeTab(id))},'-',
  {label:'Duplicate tab',run:async()=>{if(vw.curTab!==t.id)vw.switchTo(t.id);await new Promise(r=>setTimeout(r,250));const b=S.bytes,nm=S.fileName.replace(/\.pdf$/i,'')+' (copy).pdf';await openBytes(b.slice(),nm)}},
  sp?{label:'Swap sides',run:()=>vw.swapPanes&&vw.swapPanes(slot)}:null,
  sp?{label:'Move to other pane',run:()=>vw.moveTab(t.id,two?vw.act:null,slot)}:{label:'Show in split view',run:()=>{if(!vw.openSplit)return;vw.openSplit();if(vw.P2&&vw.P2.on&&vw.P2.tabId!==t.id&&vw.moveTab)vw.moveTab(t.id,1-vw.act)}},{label:'Open in new window',dis:!(window.pmDesktop&&pmDesktop.newWindow),run:async()=>{if(vw.curTab!==t.id)vw.switchTo(t.id);await new Promise(r=>setTimeout(r,200));pmDesktop.newWindow({name:S.fileName,bytes:S.bytes})}}].filter(Boolean),{t,vw}))}

/* ===================== edit commands ===================== */
function cut(){if(!S.sel.size)return;copySel();delSel()}
function pasteInPlace(){if(!S.clip||!S.clip.length)return toast('Nothing to paste');pushUndo();const ids=[];for(const m of clone(S.clip)){m.id=uid();m.page=S.cur;m.created=m.modified=Date.now();m.author=settings.author;S.markups.push(m);ids.push(m.id)}setSel(ids);commit();toast('Pasted in place')}
function pasteAt(n,pt){if(!S.clip||!S.clip.length)return;const src=clone(S.clip),b=ptsBox(src.flatMap(m=>[[bboxOf(m)[0],bboxOf(m)[1]]])),dx=pt[0]-b[0],dy=pt[1]-b[1];pushUndo();const ids=[];
 for(const m of src){m.id=uid();m.page=n;m.pts=m.pts.map(q=>[q[0]+dx,q[1]+dy]);if(m.holes)m.holes=m.holes.map(h=>h.map(q=>[q[0]+dx,q[1]+dy]));if(m.rects)m.rects=m.rects.map(r=>[r[0]+dx,r[1]+dy,r[2]+dx,r[3]+dy]);m.created=m.modified=Date.now();m.author=settings.author;S.markups.push(m);ids.push(m.id)}setSel(ids);commit()}
function moveM(x,dx,dy){x.pts=x.pts.map(p=>[p[0]+dx,p[1]+dy]);if(x.holes)x.holes=x.holes.map(h=>h.map(p=>[p[0]+dx,p[1]+dy]));if(x.rects)x.rects=x.rects.map(r=>[r[0]+dx,r[1]+dy,r[2]+dx,r[3]+dy])}
function align(k){const ms=sel().filter(m=>!m.locked);if(ms.length<2&&k!=='hc'&&k!=='vc')return toast('Select two or more markups');const bb=ms.map(x=>({x,b:bboxOf(x)})),ref=bb[0].b;pushUndo();
 if(k==='l')bb.forEach(o=>moveM(o.x,ref[0]-o.b[0],0));if(k==='r')bb.forEach(o=>moveM(o.x,ref[2]-o.b[2],0));if(k==='t')bb.forEach(o=>moveM(o.x,0,ref[1]-o.b[1]));if(k==='b')bb.forEach(o=>moveM(o.x,0,ref[3]-o.b[3]));
 if(k==='hc')bb.forEach(o=>moveM(o.x,(ref[0]+ref[2])/2-(o.b[0]+o.b[2])/2,0));if(k==='vc')bb.forEach(o=>moveM(o.x,0,(ref[1]+ref[3])/2-(o.b[1]+o.b[3])/2));
 if(k==='dh'||k==='dv'){if(ms.length<3){S.undo.pop();return toast('Select three or more markups')}const i=k==='dh'?0:1;bb.sort((a,b)=>(a.b[i]+a.b[i+2])-(b.b[i]+b.b[i+2]));const c0=(bb[0].b[i]+bb[0].b[i+2])/2,c1=(bb.at(-1).b[i]+bb.at(-1).b[i+2])/2;bb.forEach((o,j)=>{const t=c0+(c1-c0)*j/(bb.length-1),c=(o.b[i]+o.b[i+2])/2;moveM(o.x,i?0:t-c,i?t-c:0)})}
 ms.forEach(x=>x.modified=Date.now());commit()}
function alignSize(k){const ms=sel().filter(m=>!m.locked);if(ms.length<2)return toast('Select two or more markups — the first one sets the size');const rb=bboxOf(ms[0]),rw=rb[2]-rb[0],rh=rb[3]-rb[1];pushUndo();
 for(const m of ms.slice(1)){const b=bboxOf(m),w=b[2]-b[0]||1,h=b[3]-b[1]||1,sx=k.includes('w')?rw/w:1,sy=k.includes('h')?rh/h:1,f=q=>[b[0]+(q[0]-b[0])*sx,b[1]+(q[1]-b[1])*sy];
  if(['note','stamp','symbol','typewriter','flag','legend'].includes(m.type)){if(m.style.fontSize&&k==='wh')m.style.fontSize=+(m.style.fontSize*Math.min(sx,sy)).toFixed(2);continue}
  m.pts=m.pts.map(f);if(m.holes)m.holes=m.holes.map(h=>h.map(f));if(m.curves)for(const i in m.curves)m.curves[i]=[m.curves[i][0]*sx,m.curves[i][1]*sy];m.modified=Date.now()}commit()}
function centerInDoc(){const ms=sel().filter(m=>!m.locked);if(!ms.length)return toast('Select a markup first');const p=S.pages[ms[0].page-1],b=ptsBox(ms.flatMap(m=>{const q=bboxOf(m);return[[q[0],q[1]],[q[2],q[3]]]}));pushUndo();
 const dx=p.w/2-(b[0]+b[2])/2,dy=p.h/2-(b[1]+b[3])/2;ms.forEach(m=>{moveM(m,dx,dy);m.modified=Date.now()});commit()}
function roundDialog(m){modal('Round corners',`<div class="fld"><label>Corner radius (paper points; 72 = 1 inch)</label><input class="ti" type="number" min="0" step="any" id="rcR" value="${m.style.radius||12}"></div><div class="hint">Areas and perimeters are measured along the rounded outline.</div>`,
 [{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{pushUndo();const v=Math.max(0,+md.querySelector('#rcR').value||0);sel().filter(x=>ROUNDABLE.has(x.type)).forEach(x=>{x.style.radius=v;x.modified=Date.now()});commit();renderProps()}}])}
function cycleSel(dir){if(!S.pages.length)return;if(S.tool!=='select')setTool('select');const lp=WS.lastPt;let cand=[];
 if(lp&&lp.page===S.cur){const pad=4/S.zoom;cand=S.markups.filter(m=>m.page===lp.page&&!m.hidden&&(()=>{const b=bboxOf(m);return lp.x>=b[0]-pad&&lp.x<=b[2]+pad&&lp.y>=b[1]-pad&&lp.y<=b[3]+pad})()).reverse()}
 if(cand.length<2)cand=S.markups.filter(m=>m.page===S.cur&&!m.hidden);if(!cand.length)return toast('No markups on this page');
 const cur=[...S.sel][0],i=cand.findIndex(m=>m.id===cur),next=cand[((i<0?(dir>0?-1:0):i)+dir+cand.length)%cand.length];setSel([next.id]);
 const p=S.pages[next.page-1],b=bboxOf(next),r=p.el.getBoundingClientRect(),vr=viewer.getBoundingClientRect(),cx=r.left+(b[0]+b[2])/2*S.zoom,cy=r.top+(b[1]+b[3])/2*S.zoom;if(cx<vr.left||cx>vr.right||cy<vr.top||cy>vr.bottom)scrollToBox(next.page,b)}
function delPage(n){modal('Delete page '+n+'?','<div class="hint">Markups on this page are removed too.</div>',[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:()=>{PMBatch.deletePages([n])}}])}
function movePageTo(from,to){if(from===to||!S.pages.length)return;to=clamp(to,1,S.pages.length);
 return PMBatch.rebuild(doc=>{const cnt=doc.getPageCount(),pg=doc.getPage(from-1);doc.removePage(from-1);doc.insertPage(to-1,pg);const order=Array.from({length:cnt},(_,i)=>i);order.splice(from-1,1);order.splice(to-1,0,from-1);const map=new Array(cnt);order.forEach((old,ni)=>map[old]=ni);return map},'Moving page')}
function addBookmark(){switchTab('bookmarks');setTimeout(()=>{const b=$('#bmAdd');if(b)b.click();else toast('Bookmarks panel not available')},60)}
async function renderPageCanvas(n,dpi=150){const pg=await S.pdf.getPage(n),k=Math.min(dpi/72,Math.sqrt(30e6/(S.pages[n-1].w*S.pages[n-1].h))),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const ctx2=c.getContext('2d');ctx2.fillStyle='#fff';ctx2.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx2,viewport:vp}).promise;
 if(window.drawPrimsCanvas){ctx2.save();ctx2.scale(k,k);for(const m of S.markups)if(m.page===n&&!m.hidden)drawPrimsCanvas(ctx2,prims(m));ctx2.restore()}return c}
async function copyPageImage(n){n=n||S.cur;toast('Rendering page…');const c=await renderPageCanvas(n,150),blob=await new Promise(r=>c.toBlob(r,'image/png'));
 try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('Page '+n+' copied as an image')}catch(e){await saveFile(baseName()+'-p'+n+'.png',blob)}}
async function docProps(){if(!S.pdf)return toast('Open a PDF first');let meta={};try{meta=await S.pdf.getMetadata()}catch(e){}const info=(meta&&meta.info)||{};
 const sizes={};S.pages.forEach(p=>{const k=(p.w/72).toFixed(2)+' × '+(p.h/72).toFixed(2)+' in';sizes[k]=(sizes[k]||0)+1});
 const fd=s=>{if(!s)return'—';const m=String(s).match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);return m?`${m[2]}/${m[3]}/${m[1]} ${m[4]||'00'}:${m[5]||'00'}`:esc(s)};
 const row=(k,v)=>`<tr><td style="color:var(--mut);padding:3px 10px 3px 0;white-space:nowrap">${k}</td><td>${v}</td></tr>`;
 modal('Document properties',`<table style="font-size:12.5px">${row('File',esc(S.fileName))}${row('Size',(S.bytes.length/1048576).toFixed(2)+' MB')}${row('Pages',S.pages.length)}${row('Page sizes',Object.entries(sizes).map(([k,v])=>esc(k)+(v>1?' ×'+v:'')).join('<br>'))}
 ${row('Title',esc(info.Title||'—'))}${row('Author',esc(info.Author||'—'))}${row('Subject',esc(info.Subject||'—'))}${row('Creator',esc(info.Creator||'—'))}${row('Producer',esc(info.Producer||'—'))}${row('Created',fd(info.CreationDate))}${row('Modified',fd(info.ModDate))}${row('PDF version',esc(info.PDFFormatVersion||'—'))}
 ${row('Markups',S.markups.length)}${row('Scale (this page)',esc(scaleFor(S.cur).label))}</table>`,[{label:'Close',cancel:1}])}

/* ===================== presentation, crosshair, pop-ups, modes ===================== */
const laser=document.createElement('div');laser.id='wsLaser';document.body.appendChild(laser);
const cH=document.createElement('div'),cV=document.createElement('div');cH.className=cV.className='wsCross';cH.style.cssText+='height:1px;left:0;right:0';cV.style.cssText+='width:1px;top:0;bottom:0';document.body.append(cH,cV);
const pop=document.createElement('div');pop.id='wsPop';document.body.appendChild(pop);let popT=0;
function present(on){if(on===WS.present)return;WS.present=on;document.body.classList.toggle('wsPresent',on);
 if(on){WS.prevMode=(window.PMLayout&&PMLayout.get().mode)||'continuous';if(V().setMode)V().setMode('single');try{document.documentElement.requestFullscreen()}catch(e){}setTimeout(()=>{fitPage();gotoPage(S.cur,true)},250);toast('Presentation — arrows to change page, Esc to exit')}
 else{laser.style.display='none';if(V().setMode&&WS.prevMode)V().setMode(WS.prevMode);try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}setTimeout(()=>{fitWidth()},250)}}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&WS.present)present(false)});
viewer.addEventListener('pointermove',e=>{const p=S.pages.length?pageFromEvent(e):null;if(p){const q=toPt(e,p);WS.lastPt={page:p.num,x:q[0],y:q[1]}}
 if(WS.present){laser.style.display='block';laser.style.left=e.clientX+'px';laser.style.top=e.clientY+'px'}
 if(P.crosshair&&!WS.present){const vr=viewer.getBoundingClientRect();cH.style.display=cV.style.display='block';cH.style.top=e.clientY+'px';cH.style.left=vr.left+'px';cH.style.right=(innerWidth-vr.right)+'px';cV.style.left=e.clientX+'px';cV.style.top=vr.top+'px';cV.style.bottom=(innerHeight-vr.bottom)+'px'}
 if(P.popups&&(S.tool==='select'||S.tool==='pan')&&!G){const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);clearTimeout(popT);
  if(m&&(m.comment||(m.replies&&m.replies.length))){popT=setTimeout(()=>{pop.style.opacity=P.popOpacity;pop.innerHTML=`<b>${esc(m.subject||'')}</b> · <small>${esc(m.author||'')} · ${esc(fmtDT(m.modified||m.created))}</small>\n${esc(m.comment||'')}${(m.replies||[]).map(r=>`\n↳ ${esc(r.author||'')}: ${esc(r.text||'')}`).join('')}`;pop.style.display='block';pop.style.left=Math.min(e.clientX+14,innerWidth-300)+'px';pop.style.top=(e.clientY+16)+'px'},450)}else pop.style.display='none'}});
viewer.addEventListener('pointerleave',()=>{cH.style.display=cV.style.display='none';pop.style.display='none';clearTimeout(popT)});
viewer.addEventListener('pointerdown',()=>{pop.style.display='none';clearTimeout(popT)},true);

/* ===================== navigation: memory, wheel, refresh ===================== */
let posT=0;function schedulePos(){if(!P.rememberPos||!S.fileKey)return;clearTimeout(posT);posT=setTimeout(()=>{const all=LS.get('pm:ws:pos',{});all[S.fileKey]={p:S.cur,z:+S.zoom.toFixed(4),t:Date.now()};const keys=Object.keys(all).sort((a,b)=>all[b].t-all[a].t);keys.slice(60).forEach(k=>delete all[k]);_lsSet('pm:ws:pos',all)},500)}
const _lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
viewer.addEventListener('scroll',()=>{schedulePos();updViewRect()},{passive:true});
function lockFit(){if(!P.lockFitWidth||!S.pages.length){viewer.style.overflowX='';return}const w=Math.max(...S.pages.map(p=>p.w))*S.zoom+52;viewer.style.overflowX=w<=viewer.clientWidth+2?'hidden':''}
window.addEventListener('resize',()=>{lockFit();updViewRect()});
viewer.addEventListener('wheel',e=>{if(!S.pages.length)return;
 if(Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.2&&!e.ctrlKey&&!e.metaKey){if(P.lockFitWidth&&viewer.style.overflowX==='hidden')return;viewer.scrollLeft+=e.deltaX;e.preventDefault();e.stopImmediatePropagation();return}
 const zoomy=e.ctrlKey||e.metaKey||(settings.wheelZoom&&!e.shiftKey);if(zoomy&&(P.reverseWheel||+P.wheelSens!==1)){e.preventDefault();e.stopImmediatePropagation();const k=(e.ctrlKey&&Math.abs(e.deltaY)<40?0.01:0.0018)*(+P.wheelSens||1);let dy=e.deltaMode===1?e.deltaY*30:e.deltaY;if(P.reverseWheel)dy=-dy;setZoom(S.zoom*Math.exp(-dy*k),anchorAt(e.clientX,e.clientY))}},{capture:true,passive:false});
function refresh(){S.pages.forEach(p=>{p.rs=0});renderVisible();redrawAll();renderList();toast('Refreshed')}
async function reloadDoc(){if(!S.bytes)return;const cur=S.cur,z=S.zoom;await openBytes(S.bytes,S.fileName,{markups:S.markups,scales:S.scales});setZoom(z);gotoPage(cur,true);toast('Document reloaded')}
function togglePanels(){const hid=$('#left').classList.contains('hide')&&$('#right').classList.contains('hide');$('#left').classList.toggle('hide',!hid);$('#right').classList.toggle('hide',!hid);$('#mlist').style.display=hid?'':'none';scheduleRender()}
function panelTab(t){if(!$('#pane-'+t))return toast('That panel is not available');const left=$('#left');if(!left.classList.contains('hide')&&!$('#pane-'+t).classList.contains('hide'))left.classList.add('hide');else switchTab(t)}

/* ===================== thumbnails ===================== */
function decorateThumbs(){const pane=$('#pane-pages');if(!pane)return;pane.style.setProperty('--wsTh',P.thumbSize+'px');
 if(!$('#wsThF')){const bar=document.createElement('div');bar.className='row';bar.style.cssText='gap:6px;margin:0 0 8px;align-items:center';bar.innerHTML=`<input class="ti" id="wsThF" placeholder="Filter pages by label…" style="height:26px"><input type="range" id="wsThS" min="60" max="240" value="${P.thumbSize}" title="Thumbnail size" style="flex:0 0 80px">`;
  const pgb=$('#pgBar');if(pgb)pgb.after(bar);else pane.prepend(bar);$('#wsThF').oninput=filterThumbs;$('#wsThS').oninput=e=>{P.thumbSize=+e.target.value;LS.set('pm:ws:prefs',P);sizeThumbs()}}
 sizeThumbs();$$('#pane-pages .thumb').forEach(t=>{if(t.dataset.wsd)return;t.dataset.wsd=1;t.draggable=true;
  t.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/x-pm-page',t.dataset.p);e.dataTransfer.effectAllowed='move'});
  t.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('text/x-pm-page')){e.preventDefault();t.classList.add('wsDragOver')}});t.addEventListener('dragleave',()=>t.classList.remove('wsDragOver'));
  t.addEventListener('drop',e=>{t.classList.remove('wsDragOver');const f=+e.dataTransfer.getData('text/x-pm-page');if(f){e.preventDefault();movePageTo(f,+t.dataset.p)}});
  t.addEventListener('contextmenu',e=>{e.preventDefault();thumbMenu(e.clientX,e.clientY,+t.dataset.p)})});
 filterThumbs();thumbMarkups();updViewRect()}
function sizeThumbs(){$$('#pane-pages .thumb canvas').forEach(c=>{c.style.width=P.thumbSize+'px';c.style.maxWidth='100%';c.style.height='auto'});setTimeout(()=>{thumbMarkups();updViewRect()},20)}
function filterThumbs(){const q=($('#wsThF')&&$('#wsThF').value||'').toLowerCase();$$('#pane-pages .thumb').forEach(t=>{t.style.display=!q||t.textContent.toLowerCase().includes(q)?'':'none'})}
function thumbSvg(t){let s=t.querySelector('svg.wsTh');const c=t.querySelector('canvas');if(!c)return null;if(!s){s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('class','wsTh');t.appendChild(s)}
 const p=S.pages[+t.dataset.p-1];if(!p)return null;s.setAttribute('viewBox',`0 0 ${p.w} ${p.h}`);s.setAttribute('preserveAspectRatio','none');s.style.left=c.offsetLeft+2+'px';s.style.top=c.offsetTop+2+'px';s.style.width=(c.clientWidth)+'px';s.style.height=(c.clientHeight)+'px';return s}
let thT=0;function thumbMarkups(){clearTimeout(thT);thT=setTimeout(()=>{if($('#pane-pages').classList.contains('hide'))return;$$('#pane-pages .thumb').forEach(t=>{const s=thumbSvg(t);if(!s)return;const n=+t.dataset.p;
 s.innerHTML=(P.thumbMarkups?S.markups.filter(m=>m.page===n&&!m.hidden).map(m=>{try{return prims(m).filter(q=>q.k==='p').map(primSvg).join('')}catch(e){return''}}).join(''):'')+'<rect class="wsView" fill="rgba(61,139,253,.07)" stroke="#3d8bfd" stroke-width="0" width="0" height="0"/>'});updViewRect()},120)}
let vrRaf=0;function updViewRect(){if(vrRaf)return;vrRaf=requestAnimationFrame(()=>{vrRaf=0;if(!P.thumbView||!S.pages.length)return;const vr=viewer.getBoundingClientRect();
 $$('#pane-pages .thumb').forEach(t=>{const s=t.querySelector('svg.wsTh'),r=s&&s.querySelector('.wsView');if(!r)return;const p=S.pages[+t.dataset.p-1];if(!p){return}const pr=p.el.getBoundingClientRect();
  const x0=clamp((vr.left-pr.left)/S.zoom,0,p.w),y0=clamp((vr.top-pr.top)/S.zoom,0,p.h),x1=clamp((vr.right-pr.left)/S.zoom,0,p.w),y1=clamp((vr.bottom-pr.top)/S.zoom,0,p.h);
  const vis=x1>x0&&y1>y0&&(x1-x0)*(y1-y0)<p.w*p.h*.8;/* no box when most of the page is in view */r.setAttribute('x',x0);r.setAttribute('y',y0);r.setAttribute('width',vis?x1-x0:0);r.setAttribute('height',vis?y1-y0:0);r.setAttribute('stroke-width',vis?p.w/90:0)})})}

/* ===================== Links & Flags panels ===================== */
const LK={list:[],doc:null,busy:false};
async function scanLinks(){if(!S.pdf){LK.list=[];return}LK.busy=true;const doc=S.pdf,out=[];
 for(const m of S.markups)if(m.link)out.push({kind:'markup',id:m.id,page:m.page,rect:bboxOf(m),target:m.link});
 for(const p of S.pages){try{const pg=await doc.getPage(p.num),an=await pg.getAnnotations({intent:'display'});for(const a of an){if(a.subtype!=='Link')continue;const q=p.vp.convertToViewportRectangle(a.rect),r=normBox([q[0],q[1]],[q[2],q[3]]);let tgt=null;
   if(a.url||a.unsafeUrl)tgt={type:'url',url:a.url||a.unsafeUrl};else if(a.dest){try{let d=a.dest;if(typeof d==='string')d=await doc.getDestination(d);if(d){const idx=typeof d[0]==='number'?d[0]:await doc.getPageIndex(d[0]);tgt={type:'page',page:idx+1}}else tgt={type:'page',page:0,bad:'Named destination not found'}}catch(e){tgt={type:'page',page:0,bad:'Destination could not be resolved'}}}
   else if(a.action)tgt={type:'action',action:a.action};else tgt={type:'none'};out.push({kind:'pdf',page:p.num,rect:r,target:tgt})}}catch(e){}if(doc!==S.pdf)return}
 for(const l of out)l.broken=linkProblem(l.target);LK.list=out;LK.doc=doc;LK.busy=false}
function linkProblem(t){if(!t)return'No target';if(t.bad)return t.bad;if(t.type==='page')return t.page>=1&&t.page<=S.pages.length?'':'Page '+t.page+' does not exist';if(t.type==='url'){try{const u=new URL(t.url);return/^(https?|mailto|tel):$/.test(u.protocol)?'':'Unsupported link type'}catch(e){return'Invalid web address'}}if(t.type==='none')return'Link has no destination';return''}
const linkText=t=>!t?'—':t.type==='url'?t.url:t.type==='page'?('Page '+t.page):t.type==='action'?('Action: '+t.action):'(none)';
function followTarget(t){if(!t)return;if(t.type==='url'){const a=document.createElement('a');a.href=t.url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();toast('Opening '+t.url)}else if(t.type==='page'&&t.page>=1&&t.page<=S.pages.length){gotoPage(t.page)}else toast(linkProblem(t)||'Cannot follow this link')}
async function renderLinks(rescan){const pane=$('#pane-links');if(!pane)return;if(rescan||LK.doc!==S.pdf){pane.innerHTML='<div class="hint">Scanning links…</div>';await scanLinks()}
 const bad=LK.list.filter(l=>l.broken).length;
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn" id="lkScan" style="border:1px solid var(--line)">Check links</button><button class="btn" id="lkNew" style="border:1px solid var(--line)">+ Hyperlink</button></div>
 <div class="hint" style="margin-bottom:6px">${LK.list.length} link${LK.list.length===1?'':'s'}${bad?` · <b style="color:#f87171">${bad} broken</b>`:' · all OK'}${S.pages.length?'':''}</div>
 ${LK.list.map((l,i)=>`<div class="res" data-li="${i}" style="${l.broken?'border-left:3px solid #ef4444':''}"><b style="font-weight:600">p${l.page}</b> → ${esc(linkText(l.target))}<br><small style="color:${l.broken?'#fca5a5':'var(--mut)'}">${l.broken?esc(l.broken):l.kind==='pdf'?'Link in the PDF':'PlanMark hyperlink'}</small>
  <div class="row" style="gap:4px;margin-top:4px"><button class="btn" data-lo="go" style="height:22px;border:1px solid var(--line)">Show</button><button class="btn" data-lo="follow" style="height:22px;border:1px solid var(--line)" ${l.broken?'disabled':''}>Follow</button>${l.kind==='markup'?'<button class="btn" data-lo="edit" style="height:22px;border:1px solid var(--line)">Edit</button><button class="btn" data-lo="del" style="height:22px;border:1px solid var(--line)">Delete</button>':''}</div></div>`).join('')||'<div class="hint">No links in this document.</div>'}`;
 $('#lkScan').onclick=()=>renderLinks(true);$('#lkNew').onclick=()=>{if(T.hlink)setTool('hlink');else toast('Hyperlink tool not available')};
 pane.querySelectorAll('[data-lo]').forEach(b=>b.onclick=e=>{e.stopPropagation();const l=LK.list[+b.closest('[data-li]').dataset.li];if(!l)return;const op=b.dataset.lo;
  if(op==='go'){gotoPage(l.page,true);setTimeout(()=>{scrollToBox(l.page,l.rect);S.flash={page:l.page,r:l.rect};redrawPage(l.page);setTimeout(()=>{S.flash=null;redrawPage(l.page)},1800)},200);if(l.id)setSel([l.id])}
  if(op==='follow')followTarget(l.target);
  if(op==='del'){const m=byId(l.id);if(m){pushUndo();S.markups=S.markups.filter(x=>x!==m);commit();renderLinks(true)}}
  if(op==='edit'){const m=byId(l.id);if(!m)return;modalPrompt('Edit hyperlink','Page number or web address (https://…)',m.link.type==='url'?m.link.url:String(m.link.page||''),v=>{pushUndo();v=v.trim();m.link=/^\d+$/.test(v)?{type:'page',page:+v}:{type:'url',url:/^[a-z]+:/i.test(v)?v:'https://'+v};m.modified=Date.now();commit();renderLinks(true)})}})}
function renderFlags(){const pane=$('#pane-flags');if(!pane)return;const fl=S.markups.filter(m=>m.type==='flag');
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn" id="flNew" style="border:1px solid var(--line)">+ Flag (Shift+F)</button>${fl.length?'<button class="btn" id="flClr" style="border:1px solid var(--line)">Clear all</button>':''}</div>`+
 (fl.map(m=>`<div class="res" data-fl="${m.id}"><span style="color:#ef4444">⚑</span> <b style="font-weight:600">p${m.page}</b> ${esc(m.comment||'(no note)')}<br><small style="color:var(--mut)">${esc(m.author||'')} · ${esc(fmtDT(m.created))}</small> <a href="#" data-flx="${m.id}" style="color:#fca5a5;float:right">remove</a></div>`).join('')||'<div class="hint">Flags mark places to come back to. Press Shift+F, then click the sheet.</div>');
 $('#flNew').onclick=()=>setTool('flag');if($('#flClr'))$('#flClr').onclick=()=>{pushUndo();S.markups=S.markups.filter(m=>m.type!=='flag');commit()};
 pane.querySelectorAll('[data-flx]').forEach(a=>a.onclick=e=>{e.preventDefault();e.stopPropagation();const m=byId(a.dataset.flx);if(m){pushUndo();S.markups=S.markups.filter(x=>x!==m);commit()}});
 pane.querySelectorAll('[data-fl]').forEach(r=>r.onclick=()=>{const m=byId(r.dataset.fl);if(m){if(S.tool!=='select')setTool('select');setSel([m.id]);scrollToBox(m.page,bboxOf(m))}})}

/* ===================== auto-complete ===================== */
const acBox=document.createElement('div');acBox.id='wsAC';document.body.appendChild(acBox);let acState=null;
function wordFreq(){const f=new Map(),add=s=>{if(!s)return;for(const w of String(s).match(/[A-Za-z][A-Za-z'-]{3,}/g)||[])f.set(w,(f.get(w)||0)+1)};for(const m of S.markups){add(m.text);add(m.comment);add(m.label);add(m.subject);(m.replies||[]).forEach(r=>add(r.text))}
 for(const[w,c]of Object.entries(LS.get('pm:ws:words',{})||{}))f.set(w,(f.get(w)||0)+c);return f}
function remember(s){if(!s)return;const o=LS.get('pm:ws:words',{})||{};for(const w of String(s).match(/[A-Za-z][A-Za-z'-]{3,}/g)||[])o[w]=(o[w]||0)+1;const ks=Object.keys(o);if(ks.length>2500)ks.sort((a,b)=>o[a]-o[b]).slice(0,ks.length-2500).forEach(k=>delete o[k]);LS.set('pm:ws:words',o)}
function acTarget(el){return el&&el.matches&&el.matches('#props textarea,#props input.ti[data-f],#mt,#modal textarea,#modal input.ti[type=text],#modal input.ti:not([type])')&&!el.matches('[type=number],[type=color],[type=range],#kbQ,#wsPQ,#spTo')}
document.addEventListener('input',e=>{if(!P.autocomplete||!acTarget(e.target)){acBox.style.display='none';acState=null;return}const el=e.target,pos=el.selectionStart,v=el.value.slice(0,pos),m=v.match(/([A-Za-z][A-Za-z'-]{2,})$/);
 if(!m){acBox.style.display='none';acState=null;return}const pre=m[1],pl=pre.toLowerCase();let best=null,bc=0;for(const[w,c]of wordFreq())if(w.length>pre.length&&w.toLowerCase().startsWith(pl)&&c>bc){best=w;bc=c}
 if(!best){acBox.style.display='none';acState=null;return}acState={el,pre,word:best};const r=el.getBoundingClientRect();acBox.innerHTML=`${esc(pre)}<b>${esc(best.slice(pre.length))}</b> <small style="color:var(--mut)">Tab ↹</small>`;acBox.style.display='block';acBox.style.left=r.left+'px';acBox.style.top=(r.bottom+3)+'px'},true);
document.addEventListener('keydown',e=>{if(acState&&e.key==='Tab'&&e.target===acState.el){e.preventDefault();e.stopImmediatePropagation();const el=acState.el,pos=el.selectionStart,rest=acState.word.slice(acState.pre.length);el.setRangeText(rest,pos,pos,'end');el.dispatchEvent(new Event('input',{bubbles:true}));acBox.style.display='none';acState=null}
 else if(acState&&(e.key==='Escape'||e.key==='Enter')){acBox.style.display='none';acState=null}},true);
document.addEventListener('focusout',e=>{if(acState&&e.target===acState.el){acBox.style.display='none';acState=null}if(acTarget(e.target))remember(e.target.value)},true);

/* ===================== commands & keyboard ===================== */
function toolCmd(k,key){return{id:'tool:'+k,menu:'Tools',sub:T[k]&&T[k].meas?'Measure':'Markup',label:(T[k]&&T[k].label)||k,key,run:()=>{if(!T[k])return toast('Not available');if(k==='stamp')return stampPicker();if(k==='image')return imagePicker();if(k==='symbol'&&H.symbolPicker)return H.symbolPicker();need(()=>setTool(k))()},when:()=>!!T[k]}}
const TOOLKEYS={select:'V',pan:'Shift+V',text:'T',typewriter:'W',callout:'Q',note:'N',pen:'P',highlight:'H',eraser:'Shift+E',line:'L',arrow:'A',arc:'Shift+C',polyline:'Shift+N',dimension:'Shift+L',rect:'R',ellipse:'E',polygon:'Shift+P',cloud:'C',cloudplus:'K',stamp:'S',image:'I',
 length:'Shift+Alt+L',polylength:'Shift+Alt+Q',perimeter:'Shift+Alt+P',area:'Shift+Alt+A',volume:'Shift+Alt+V',circle:'Shift+Alt+D',radius:'Shift+Alt+U',angle:'Shift+Alt+G',count:'Shift+Alt+C',calibrate:'Shift+Alt+K',underline:'U',strikeout:'D',texthl:'Shift+T',hlink:'Shift+H',flag:'Shift+F',symbol:'Shift+Y',arclen:'',cloud2:''};
let CMDS=[];
function buildCmds(){const c=(id,menu,label,key,run,o={})=>Object.assign({id,menu,label,key:key||'',run},o);const vw=V(),L=()=>window.PMListPro;
 const list=[
 c('open','File','Open…','Ctrl+O',()=>$('#fileIn').click()),c('blank','File','New blank sheet','',blankSheet),c('save','File','Save (markups stay editable)','Ctrl+S',need(()=>exportPDF(false))),c('flat','File','Save flattened copy','Ctrl+Shift+M',need(()=>exportPDF(true))),
 c('print','File','Print…','Ctrl+P',need(()=>window.PMBatch2&&PMBatch2.printDialog2?PMBatch2.printDialog2():window.PMOutput?PMOutput.printDialog():toast('Printing not available'))),c('report','File','Markup summary report…','',need(()=>PMOutput.reportDialog())),c('excel','File','Export takeoff to Excel','',need(()=>PMOutput.exportExcel())),
 c('csv','File','Export markups list (CSV)','',need(()=>$('#mlCsv').click())),c('mxjson','File','Markup data (import / export)…','',need(moreDialog)),c('copyimg','File','Copy page as image','Ctrl+Alt+C',need(()=>copyPageImage(S.cur))),c('docprops','File','Document properties…','Ctrl+D',need(docProps)),
 c('closetab','File','Close tab','Ctrl+W',()=>vw.closeTab?vw.closeTab(vw.curTab):null),c('newwin','File','New window','',()=>window.pmDesktop&&pmDesktop.newWindow?pmDesktop.newWindow(S.bytes?{name:S.fileName,bytes:S.bytes}:null):toast('New windows are available in the Windows app'),{when:()=>!!(window.pmDesktop&&pmDesktop.newWindow)}),
 c('prefs','PlanMark','Preferences…','Ctrl+K',prefsDialog),c('account','PlanMark','Account…','',()=>{const b=$('#bAcct');if(b)b.click()}),
 c('undo','Edit','Undo','Ctrl+Z',undo),c('redo','Edit','Redo','Ctrl+Y',redo),c('cut','Edit','Cut','Ctrl+X',cut),c('copy','Edit','Copy','Ctrl+C',copySel),c('paste','Edit','Paste','Ctrl+V',()=>paste(false)),c('pasteinplace','Edit','Paste in place','Ctrl+Shift+V',pasteInPlace),c('dup','Edit','Duplicate','',()=>paste(true)),c('del','Edit','Delete','Delete',()=>delSel()),
 c('selall','Edit','Select all on page','Ctrl+A',need(()=>{if(S.tool!=='select')setTool('select');setSel(S.markups.filter(m=>m.page===S.cur).map(m=>m.id))})),c('cycle','Edit','Select next markup (cycle)','Tab',()=>cycleSel(1)),c('cycleb','Edit','Select previous markup','Shift+Tab',()=>cycleSel(-1)),
 c('lock','Edit','Lock / unlock','Ctrl+Shift+L',()=>L()&&L().cmd('lock')),c('group','Edit','Group','Ctrl+G',()=>L()&&L().cmd('group')),c('ungroup','Edit','Ungroup','Ctrl+Shift+G',()=>L()&&L().cmd('ungroup')),c('painter','Edit','Format Painter','Ctrl+Shift+C',()=>L()&&L().cmd('painter')),c('lasso','Edit','Lasso select','Shift+O',()=>L()&&L().cmd('lasso')),
 c('front','Edit','Bring to front','Ctrl+J',()=>reorder(true)),c('back','Edit','Send to back','Ctrl+Shift+J',()=>reorder(false)),
 c('al','Edit','Align left','Ctrl+Alt+L',()=>align('l')),c('ar','Edit','Align right','Ctrl+Alt+R',()=>align('r')),c('at','Edit','Align top','Ctrl+Alt+T',()=>align('t')),c('ab','Edit','Align bottom','Ctrl+Alt+B',()=>align('b')),c('ac','Edit','Align center','Ctrl+Alt+E',()=>align('hc')),c('am','Edit','Align middle','Ctrl+Alt+M',()=>align('vc')),
 c('samew','Edit','Make same width','',()=>alignSize('w')),c('sameh','Edit','Make same height','',()=>alignSize('h')),c('samesz','Edit','Make same size','',()=>alignSize('wh')),c('center','Edit','Center in document','',centerInDoc),
 c('round','Edit','Round corners…','',needSel(()=>roundDialog(sel()[0]))),c('straight','Edit','Straighten curves','',needSel(()=>{pushUndo();sel().forEach(m=>delete m.curves);commit()})),
 c('magic','Edit','Magic Markups (offset, cutout, duplicate as)…','O',()=>window.PMAuto?PMAuto.magicDialog():null),c('editdlg','Edit','Markup editing tools…','',()=>L()&&L().editDialog()),
 c('spell','Edit','Check spelling…','F7',spellDialog),c('keys','PlanMark','Keyboard shortcuts…','',shortcutEditor),
 c('zin','View','Zoom in','Ctrl+=',()=>zoomBy(1.25)),c('zout','View','Zoom out','Ctrl+-',()=>zoomBy(.8)),c('zbox','View','Zoom to rectangle','Z',need(()=>vw.zoomBoxMode&&vw.zoomBoxMode(true))),c('actual','View','Actual size','Ctrl+8',need(()=>vw.actualSize&&vw.actualSize())),c('fitp','View','Fit page','Ctrl+9',need(fitPage)),c('fitw','View','Fit width','Ctrl+0',need(fitWidth)),c('zsel','View','Zoom to selection','Shift+Z',()=>vw.zoomToSelection&&vw.zoomToSelection()),
 c('single','View','Single page','Ctrl+4',()=>vw.setMode&&vw.setMode('single')),c('cont','View','Continuous','Ctrl+5',()=>vw.setMode&&vw.setMode('continuous')),c('twoup','View','Side by side','Ctrl+6',()=>vw.setMode&&vw.setMode('2up')),c('twoupc','View','Side by side continuous','Ctrl+7',()=>vw.setMode&&vw.setMode('2upc')),
 c('splitv','View','Split vertically','Ctrl+2',()=>vw.openSplit&&vw.openSplit('v')),c('splith','View','Split horizontally','Ctrl+3',()=>vw.openSplit&&vw.openSplit('h')),c('unsplit','View','Close split','Ctrl+Shift+2',()=>vw.closeSplit&&vw.closeSplit()),c('swapsplit','View','Swap split sides','',()=>{if(!(vw.swapPanes&&vw.swapPanes()))toast('Split the view first (Ctrl+2)')}),c('syncsplit','View','Synchronize split panes','',()=>vw.setSync&&vw.setSync()),c('togsplit','View','Toggle split','Ctrl+I',()=>{const on=$('#splitBox')&&$('#splitBox').classList.contains('on');on?vw.closeSplit():vw.openSplit()}),
 c('rotr','View','Rotate view clockwise','Ctrl+Shift+=',()=>vw.rotateView&&vw.rotateView(90)),c('rotl','View','Rotate view counter-clockwise','Ctrl+Shift+-',()=>vw.rotateView&&vw.rotateView(-90)),
 c('rulers','View','Rulers','Ctrl+R',()=>{const on=!!($('#rulerT')&&$('#rulerT').offsetParent);vw.setRulers&&vw.setRulers(!on)}),c('dimmer','View','Dimmer','Ctrl+F5',()=>{WS.dim=!WS.dim;vw.setDim&&vw.setDim(WS.dim?.45:0)}),
 c('present','View','Presentation','Ctrl+Enter',need(()=>present(!WS.present))),c('fullscreen','View','Full screen','F11',()=>{try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(e){}}),
 c('docdark','View','Dark mode for documents','',()=>{P.docDark=!P.docDark;saveP()},{check:()=>P.docDark}),c('crosshair','View','Full-screen crosshair','',()=>{P.crosshair=!P.crosshair;saveP()},{check:()=>P.crosshair}),c('nolw','View','Disable line weights','',()=>{P.noLineWeights=!P.noLineWeights;saveP()},{check:()=>P.noLineWeights}),
 c('viewmode','PlanMark','View mode (no editing)','',()=>{P.viewMode=!P.viewMode;saveP();if(P.viewMode)setTool('select');toast(P.viewMode?'View mode — editing is off':'Markup mode')},{check:()=>P.viewMode}),
 c('menubar','View','Menu bar','F9',()=>{P.menu=!P.menu;saveP()},{check:()=>P.menu}),c('hidepanels','View','Hide / show all panels','Shift+F4',togglePanels),c('refresh','View','Refresh','F5',refresh),c('reload','View','Reload document','Shift+F5',need(reloadDoc)),
 c('navback','View','Previous view','Alt+Left',()=>vw.navBack&&vw.navBack()),c('fwd','View','Next view','Alt+Right',()=>vw.navFwd&&vw.navFwd()),c('display','View','Display options…','',()=>runRib('Display')),c('panels','PlanMark','Profiles…','',()=>runRib('View')),c('toolbars','View','Customize toolbars…','',tbDialog),
 c('snapc','View','Snap to content','Ctrl+Shift+F9',()=>snapT('content'),{check:()=>window.PMSnap&&PMSnap.content}),c('snapm','View','Snap to markups','Ctrl+Shift+F7',()=>snapT('markup'),{check:()=>window.PMSnap&&PMSnap.markup}),c('snapg','View','Snap to grid','Ctrl+Shift+F8',()=>snapT('grid'),{check:()=>window.PMSnap&&PMSnap.grid}),c('grid','View','Show grid','Shift+F9',()=>snapT('show'),{check:()=>window.PMSnap&&PMSnap.show}),
 c('p:pages','Panels','Thumbnails','Alt+T',()=>panelTab('pages')),c('p:bookmarks','Panels','Bookmarks','Alt+B',()=>panelTab('bookmarks')),c('p:list','Panels','Markups list','Alt+L',()=>{const b=$('#dlMLBtn');if(document.body.classList.contains('dl')&&b){b.click();return}const ml=$('#mlist');ml.style.display=ml.style.display==='none'?'':'none';scheduleRender()}),c('p:chest','Panels','Tool Chest','Alt+X',()=>panelTab('chest')),
 c('p:props','Panels','Properties','Alt+P',()=>{if(window.PMRevu&&PMRevu.props())return;$('#right').classList.toggle('hide')}),c('p:measure','Panels','Measurements','Alt+U',()=>panelTab('measure')),c('p:layers','Panels','Layers','Alt+Y',()=>panelTab('layers')),c('p:sets','Panels','Sets','Alt+2',()=>panelTab('sets')),c('p:studio','Panels','Studio','Alt+C',()=>panelTab('studio')),
 c('p:search','Panels','Search','Alt+1',()=>panelTab('search')),c('p:links','Panels','Links','Alt+N',()=>panelTab('links')),c('p:files','Panels','File Access','Alt+A',()=>panelTab('files')),c('p:forms','Panels','Forms','Alt+Q',()=>panelTab('forms')),c('p:history','Panels','Undo history','Alt+H',()=>panelTab('history')),c('p:flags','Panels','Flags','Alt+F',()=>panelTab('flags')),
 c('p:projects','Panels','Projects','',()=>panelTab('projects')),c('p:attach','Panels','Attachments','',()=>panelTab('attach')),c('sigs','Panels','Signatures','Alt+4',()=>window.PMSign?PMSign.sigManager():toast('Not available')),
 c('d:rot','Document','Rotate page','Ctrl+Shift+R',need(()=>PMBatch.rotatePages([S.cur],90))),c('d:ins','Document','Insert pages…','Ctrl+Shift+I',need(()=>PMBatch.insertFrom?PMBatch.insertFrom(S.cur):runRib('Batch'))),c('d:blank','Document','Insert blank page…','Ctrl+Shift+N',need(()=>PMDoc.blankDialog?PMDoc.blankDialog():runRib('Document'))),c('d:ext','Document','Extract page','Ctrl+Shift+X',need(()=>PMBatch.extract([S.cur]))),
 c('d:del','Document','Delete page…','Ctrl+Shift+D',need(()=>delPage(S.cur))),c('d:rep','Document','Replace pages…','Ctrl+Shift+Y',need(()=>PMDoc.replaceDialog?PMDoc.replaceDialog():runRib('Document'))),c('d:ocr','Document','OCR…','Ctrl+Shift+O',need(()=>PMOCR.dialog())),c('d:sec','Document','Security & document tools…','',need(()=>runRib('Document'))),
 c('d:bm','Document','Add bookmark','Ctrl+B',need(addBookmark)),c('d:scale','Document','Set scale…','',need(scaleDialog)),c('d:compare','Document','Compare documents…','',()=>runRib('Compare')),c('d:overlay','Document','Overlay pages…','',()=>runRib('Overlay')),c('d:forms','Document','Forms…','',()=>runRib('Forms')),c('d:sign','Document','Sign & seal…','',()=>runRib('Sign')),
 c('b:batch','Batch','Batch & page tools…','',()=>runRib('Batch')),c('b:ocr','Batch','Batch OCR','',need(()=>PMOCR.run(S.pages.map(p=>p.num),true))),c('b:stamp','Batch','Batch stamp…','',()=>runRib('Batch')),c('b:sign','Batch','Batch sign & seal…','',()=>window.PMSign?PMSign.batchSign():toast('Not available')),c('b:redact','Batch','Apply redactions…','',need(()=>PMAuto.applyRedactions())),
 c('t:dfill','Tools','Dynamic Fill','J',need(()=>setTool('dfill',{lock:true}))),c('t:measure','Tools','Measure (length)','',need(()=>setTool('length'))),c('t:autocount','Tools','AutoCount…','',need(()=>PMAuto.autoCount())),c('t:snap','Tools','Snapshot','G',()=>runRib('Snapshot')),c('t:attach','Tools','Attach photo / file to markup','F',needSel(()=>window.PMCapture?PMCapture.attachFiles(sel()[0]):toast('Not available'))),
 c('t:max','Tools','Max tools…','',()=>runRib('Max')),c('t:ai','Tools','AI drawing review…','',need(()=>PMAuto.aiReview())),c('t:sets','Tools','Sets','',()=>panelTab('sets')),c('t:studio','Tools','Studio sessions','',()=>panelTab('studio')),c('t:chest','Tools','Tool Chest','',()=>panelTab('chest')),c('t:report','Tools','Reports…','',()=>runRib('Report')),
 c('h:keys','Help','Keyboard shortcuts','',shortcutSheet),c('h:new',"Help","What's new",'',()=>banner(true)),c('h:about','Help','About PlanMark','',about)];
 for(const k of Object.keys(window).filter(k=>/^PM_EXTRA_CMDS/.test(k)&&typeof window[k]==='function'))for(const x of window[k]())list.push(c(x.id,x.menu,x.label,x.key,x.run,x));
 for(const k of Object.keys(TOOLKEYS))if(T[k])list.push(toolCmd(k,TOOLKEYS[k]));
 for(const k of Object.keys(T))if(!TOOLKEYS.hasOwnProperty(k)&&T[k].kind!=='nav'&&!['calibrate','dfill','legend','vpcal'].includes(k))list.push(toolCmd(k,''));
 for(let d=1;d<=9;d++)list.push(c('status'+d,'Edit','Status key '+d,String(d),()=>statusKey(d),{hidden:1}));
 CMDS=list}
function snapT(k){if(!window.PMSnap)return;PMSnap[k]=!PMSnap[k];LS.set('pm:snapopts',PMSnap);hook('prefs');redrawAll();const b=$('#snapBtn');toast((k==='show'?'Grid ':'Snap to '+k+' ')+(PMSnap[k]?'on':'off'))}
function statusKey(d){const name=P.statusKeys[d];if(!name||!S.sel.size||!window.PMListPro)return false;PMListPro.setStatusSel(name);toast('Status: '+name);return true}
function keyOf(c){const ck=LS.get('pm:keys',{});const v=ck['ws:'+c.id];if(v!==undefined)return v;if(P.shortcutSet==='classic'&&/^(Shift\+)?[A-Z]$/.test(c.key)&&c.id.startsWith('tool:'))return'';return c.key}
function comboOf(e){const c=e.code||'';let key=c.startsWith('Key')?c.slice(3):c.startsWith('Digit')?c.slice(5):c==='Equal'?'=':c==='Minus'?'-':c==='BracketRight'?']':c==='BracketLeft'?'[':c==='ArrowLeft'?'Left':c==='ArrowRight'?'Right':c==='ArrowUp'?'Up':c==='ArrowDown'?'Down':c==='NumpadEnter'?'Enter':(e.key&&e.key.length===1?e.key.toUpperCase():e.key);
 if(['Control','Shift','Alt','Meta'].includes(e.key))return'';const m=[];if(e.ctrlKey||e.metaKey)m.push('Ctrl');if(e.altKey)m.push('Alt');if(e.shiftKey)m.push('Shift');return[...m,key].join('+')}
function norm(s){if(!s)return'';const parts=String(s).split('+').map(x=>x.trim());const mods=['Ctrl','Alt','Shift'].filter(m=>parts.includes(m));return[...mods,parts.filter(p=>!['Ctrl','Alt','Shift'].includes(p)).pop()].join('+')}
let recording=null;const NATIVE=new Set(['open','save','print','undo','redo','copy','paste','del','selall','zin','zout','closetab','navback','fwd','fullscreen']);
window.addEventListener('keydown',e=>{
 if(recording){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){recording(null);return}const c=comboOf(e);if(c)recording(c);return}
 if(WS.present){if(['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();V().flip?V().flip(1):gotoPage(S.cur+1,true);return}if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();V().flip?V().flip(-1):gotoPage(S.cur-1,true);return}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();present(false);return}}
 const combo=comboOf(e);if(!combo)return;const typing=e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]');
 if(typing&&!/^F\d+$|^Ctrl\+K$/.test(combo))return;if(modalCb)return;
 // a combo the user assigned to a list/edit command in the other shortcut editor wins
 try{const lb=window.PMListPro&&PMListPro.binding();if(lb&&lb.has(combo)&&!(combo==='Shift+L'&&P.shortcutSet==='bluebeam'&&lb.get(combo).id==='lasso'))return}catch(err){}
 if(/^[1-9]$/.test(combo)&&S.sel.size&&S.tool==='select'&&!S.drawing){if(statusKey(+combo)){e.preventDefault();e.stopImmediatePropagation()}return}
 if(combo==='Tab'||combo==='Shift+Tab'){if(S.drawing||!S.pages.length)return;e.preventDefault();e.stopImmediatePropagation();cycleSel(combo==='Tab'?1:-1);return}
 if(S.drawing&&/^[A-Z]$|^Shift\+[A-Z]$/.test(combo))return;
 if(P.viewMode&&(/^(Shift\+)?[A-Z]$/.test(combo)&&combo!=='V'&&combo!=='Z'||['Delete','Backspace','Ctrl+V','Ctrl+X','Ctrl+D','Ctrl+Shift+V'].includes(combo))){if(['Delete','Backspace','Ctrl+V','Ctrl+X','Ctrl+Shift+V'].includes(combo)||/^(Shift\+)?[A-Z]$/.test(combo)){e.preventDefault();e.stopImmediatePropagation();toast('View mode — switch to Markup mode to edit');return}}
 for(const c of CMDS){if(c.hidden)continue;const k=norm(keyOf(c));if(NATIVE.has(c.id)&&k===norm(c.key))continue;if(k&&k===combo&&(!c.when||c.when())){e.preventDefault();e.stopImmediatePropagation();try{c.run()}catch(err){console.error(err)}return}}},true);

/* ===================== menu bar ===================== */
const MENUS=['PlanMark','File','Edit','View','Document','Batch','Tools','Window','Help'];   // first menu = Revu's "Revu" menu
function menuItems(name){const cs=CMDS.filter(c=>!c.hidden&&(!c.when||c.when()));const it=c=>({label:c.label,key:keyOf(c),run:c.run,check:c.check?!!c.check():undefined});const grp=m=>cs.filter(c=>c.menu===m).map(it);
 if(name==='Tools'){const mk=cs.filter(c=>c.menu==='Tools'&&c.sub==='Markup').map(it),ms=cs.filter(c=>c.menu==='Tools'&&c.sub==='Measure').map(it);return[{label:'Markup',sub:mk},{label:'Measure',sub:ms},'-',...cs.filter(c=>c.menu==='Tools'&&!c.sub).map(it)]}
 if(name==='View'){const v=grp('View');return[...v.slice(0,7),'-',{label:'Page display',sub:v.filter(x=>/Single|Continuous|Side by side/.test(x.label))},{label:'Split',sub:v.filter(x=>/split/i.test(x.label))},{label:'Snap & grid',sub:v.filter(x=>/Snap|grid/.test(x.label))},{label:'Panels',sub:grp('Panels')},'-',
  ...v.filter(x=>!/^(Zoom|Actual|Fit)|Single|Continuous|Side by side|split|Snap|grid/i.test(x.label))]}
 if(name==='Window'){const vw=V(),tabs=vw.tabs||[];return[...tabs.map(t=>({label:(t.id===vw.curTab?'● ':'')+(t.name||'Untitled'),run:()=>vw.switchTo(t.id)})),tabs.length?'-':null,{label:'Split vertically',key:'Ctrl+2',run:()=>vw.openSplit&&vw.openSplit('v')},{label:'Split horizontally',key:'Ctrl+3',run:()=>vw.openSplit&&vw.openSplit('h')},{label:'Close split',run:()=>vw.closeSplit&&vw.closeSplit(),dis:!(vw.P2&&vw.P2.on)},{label:'Toggle split orientation',key:'Ctrl+I',run:()=>vw.toggleOrient&&vw.toggleOrient(),dis:!(vw.P2&&vw.P2.on)},{label:'Balance panes',key:'Shift+F12',run:()=>vw.balance&&vw.balance(),dis:!(vw.P2&&vw.P2.on)},{label:'Synchronize',check:!!(vw.P2&&vw.P2.sync),run:()=>vw.setSync&&vw.setSync(),dis:!(vw.P2&&vw.P2.on)},'-',
  {label:'New window',run:()=>window.pmDesktop&&pmDesktop.newWindow?pmDesktop.newWindow(null):toast('New windows are available in the Windows app'),dis:!(window.pmDesktop&&pmDesktop.newWindow)},{label:'Close tab',key:'Ctrl+W',run:()=>vw.closeTab&&vw.closeTab(vw.curTab),dis:!tabs.length},{label:'Close all tabs',run:()=>tabs.map(t=>t.id).forEach(id=>vw.closeTab(id)),dis:!tabs.length}].filter(Boolean)}
 if(name==='Edit'){const e2=grp('Edit');return[...e2.slice(0,10),'-',{label:'Arrange & align',sub:e2.filter(x=>/^(Align|Make same|Center|Bring|Send)/.test(x.label))},...e2.slice(10).filter(x=>!/^(Align|Make same|Center|Bring|Send)/.test(x.label))]}
 if(name==='File'){// Open Recent, right under Open: the files opened lately on this computer, newest first (the same list as the start screen)
  const f=grp('File'),i=f.findIndex(x=>/^Open\b/.test(x.label)),ago=t=>{const m=Math.max(0,(Date.now()-t)/60000);return m<1?'just now':m<60?Math.round(m)+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
  let rec=[];try{rec=(LS.get('pm:recentIdx',[])||[]).slice().sort((a,b)=>b.at-a.at).slice(0,12)}catch(e){}
  const short=n=>n.length>64?n.slice(0,40)+'…'+n.slice(-20):n;
  const sub=rec.length?rec.map(r=>({label:short(r.name||'Untitled'),key:ago(r.at),run:()=>window.PMEasy&&PMEasy.openRecent?PMEasy.openRecent(r.key):PMRecent.get(r.key).then(q=>q&&openBytes(new Uint8Array(q.bytes),q.name))})):[{label:'No recent files yet',dis:true}];
  f.splice(i<0?0:i+1,0,{label:'Open Recent',sub});return f}
 return grp(name)}
function buildMenu(){let bar=$('#wsMenu');if(!bar){bar=document.createElement('div');bar.id='wsMenu';$('#app').insertBefore(bar,$('#topbar'))}
 bar.innerHTML=MENUS.map(n=>`<div class="wm" data-m="${n}">${n}</div>`).join('');bar.style.display=P.menu?'':'none';
 const open=el=>{closeCtx();el.classList.add('on');const r=el.getBoundingClientRect();menuEl(menuItems(el.dataset.m),r.left,r.bottom+2,'wsDrop')};
 bar.onclick=e=>{const el=e.target.closest('[data-m]');if(!el)return;const was=el.classList.contains('on');if(was){closeCtx();return}open(el)};
 bar.onpointerover=e=>{const el=e.target.closest('[data-m]');if(el&&$('#wsMenu .wm.on')&&!el.classList.contains('on'))open(el)}}

/* ===================== toolbars ===================== */
const TB=Object.assign({hidden:[],order:{},size:'normal',labels:true,pinned:[]},LS.get('pm:ws:tb',{}));
const saveTB=()=>{LS.set('pm:ws:tb',TB);applyTB()};
function btnId(b){if(b.dataset.tool)return'tool:'+b.dataset.tool;if(b.dataset.rib!=null){const r=H.ribbon[+b.dataset.rib];return'rib:'+(r?r.label:b.dataset.rib)}if(b.id)return'id:'+b.id;return''}
function grpName(g){const l=g.querySelector('.glab');return l?l.textContent.trim():'Other'}
function applyTB(){const rb=$('#ribbon');if(!rb)return;rb.classList.toggle('wsSmall',TB.size==='small');rb.classList.toggle('wsLarge',TB.size==='large');rb.classList.toggle('wsNoLabels',!TB.labels);
 rb.querySelectorAll('.grp').forEach(g=>{const name=grpName(g),btns=[...g.querySelectorAll('.btn')];btns.forEach(b=>{b.style.display=TB.hidden.includes(btnId(b))?'none':''});const ord=TB.order[name];if(ord){ord.forEach(id=>{const b=btns.find(x=>btnId(x)===id);if(b)g.appendChild(b)});btns.filter(b=>!ord.includes(btnId(b))).forEach(b=>g.appendChild(b))}});
 renderPinned()}
function chestCombined(){const B=(window.PMToolbox&&PMToolbox.BUILTIN)||[];return[...S.chest.map(c=>Object.assign({set:c.set||'My Tools'},c)),...B,...(S.recent||[]).map(c=>Object.assign({},c,{set:'Recent Tools'}))]}
function renderPinned(){$$('.wsPin').forEach(x=>x.remove());const rb=$('#ribbon');if(!rb||!TB.pinned.length)return;const all=chestCombined();let after=rb;
 for(const set of TB.pinned){const items=all.map((c,i)=>({c,i})).filter(o=>o.c.set===set);if(!items.length)continue;const bar=document.createElement('div');bar.className='wsPin';bar.dataset.set=set;
  bar.innerHTML=`<span class="pl">${esc(set)}</span>`+items.map(({c,i})=>`<button class="btn tb" data-ci="${i}" title="${esc(c.name)}">${c.type==='symbol'?'<span style="font-size:16px">◎</span>':icon(c.type,`style="stroke:${c.style&&c.style.stroke||'currentColor'}"`)}<span>${esc(c.name.slice(0,14))}</span></button>`).join('')+`<button class="btn" data-unpin="${esc(set)}" title="Unpin" style="margin-left:auto">✕</button>`;
  bar.onclick=e=>{const b=e.target.closest('[data-ci]');if(b)useChest(+b.dataset.ci,false);const u=e.target.closest('[data-unpin]');if(u){TB.pinned=TB.pinned.filter(x=>x!==u.dataset.unpin);saveTB()}};
  bar.ondblclick=e=>{const b=e.target.closest('[data-ci]');if(b)useChest(+b.dataset.ci,true)};after.after(bar);after=bar}}
function tbDialog(){const rb=$('#ribbon');if(!rb)return;const groups=[...rb.querySelectorAll('.grp')].map(g=>({name:grpName(g),btns:[...g.querySelectorAll('.btn')].map(b=>({id:btnId(b),label:(b.querySelector('span')||b).textContent.trim()||b.title}))}));
 const sets=[...new Set(chestCombined().map(c=>c.set))];
 modal('Customize toolbars',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Icon size</label><select class="ti" id="tbS"><option value="small" ${TB.size==='small'?'selected':''}>Small</option><option value="normal" ${TB.size==='normal'?'selected':''}>Normal</option><option value="large" ${TB.size==='large'?'selected':''}>Large</option></select></div><label class="chk" style="margin-top:16px"><input type="checkbox" id="tbL" ${TB.labels?'checked':''}> Show labels</label></div>
 <div class="sec">Pin Tool Chest sets as toolbars</div><div style="display:flex;flex-wrap:wrap;gap:8px">${sets.map(s=>`<label class="chk"><input type="checkbox" data-pin="${esc(s)}" ${TB.pinned.includes(s)?'checked':''}> ${esc(s)}</label>`).join('')}</div>
 <div class="sec">Buttons (uncheck to hide, arrows to reorder)</div><div style="max-height:40vh;overflow:auto">${groups.map(g=>`<div class="hint" style="margin:6px 0 2px"><b>${esc(g.name)}</b></div>${g.btns.map((b,i)=>`<div class="row" style="gap:6px;padding:1px 0" data-g="${esc(g.name)}" data-tbb="${esc(b.id)}"><label class="chk" style="flex:1"><input type="checkbox" data-vis ${TB.hidden.includes(b.id)?'':'checked'}> ${esc(b.label)}</label><button class="btn" data-mv="-1" style="flex:0;padding:0 6px">↑</button><button class="btn" data-mv="1" style="flex:0;padding:0 6px">↓</button></div>`).join('')}`).join('')}</div>`,
 [{label:'Reset',fn:()=>{Object.assign(TB,{hidden:[],order:{},size:'normal',labels:true,pinned:[]});saveTB();location.reload()}},{label:'Close',cancel:1},{label:'Apply',pri:1,fn:md=>{TB.size=md.querySelector('#tbS').value;TB.labels=md.querySelector('#tbL').checked;TB.pinned=[...md.querySelectorAll('[data-pin]')].filter(c=>c.checked).map(c=>c.dataset.pin);
  TB.hidden=[...md.querySelectorAll('[data-tbb]')].filter(r=>!r.querySelector('[data-vis]').checked).map(r=>r.dataset.tbb);const ord={};md.querySelectorAll('[data-tbb]').forEach(r=>{(ord[r.dataset.g]=ord[r.dataset.g]||[]).push(r.dataset.tbb)});TB.order=ord;saveTB()}}]);
 $('#modal .mb').addEventListener('click',e=>{const mv=e.target.closest('[data-mv]');if(!mv)return;const row=mv.closest('[data-tbb]'),d=+mv.dataset.mv;if(d<0&&row.previousElementSibling&&row.previousElementSibling.dataset.tbb)row.parentNode.insertBefore(row,row.previousElementSibling);else if(d>0&&row.nextElementSibling&&row.nextElementSibling.dataset.tbb)row.parentNode.insertBefore(row.nextElementSibling,row)})}

/* ===================== preferences (searchable) ===================== */
function prefDefs(){const sn=window.PMSnap||{},vw=V();const sp=(k,v)=>{P[k]=v;saveP()};
 return[
 {s:'General',l:'Author name (shown on your markups)',t:'text',g:()=>settings.author,v:x=>{settings.author=x||'User';LS.set('pm:settings',settings)}},
 {s:'General',l:'Language',t:'select',o:window.PM_LANGS||[['en','English']],g:()=>P.language,v:x=>{sp('language',x);hook('prefs')}},
 {s:'General',l:'Keyboard shortcut set',t:'select',o:[['bluebeam','Bluebeam-style (single letters for tools)'],['classic','PlanMark classic']],g:()=>P.shortcutSet,v:x=>sp('shortcutSet',x)},
 {s:'General',l:'Show menu bar (F9)',t:'bool',g:()=>P.menu,v:x=>sp('menu',x)},
 {s:'General',l:"Show what's new after updates",t:'bool',g:()=>P.banners,v:x=>sp('banners',x)},
 {s:'Startup',l:'Reopen the files that were open last time',t:'bool',g:()=>P.reopenLast,v:x=>sp('reopenLast',x)},
 {s:'Startup',l:'Show the File Access panel on startup',t:'bool',g:()=>P.showFiles,v:x=>sp('showFiles',x)},
 {s:'Startup',l:'Remember last page & zoom for each file',t:'bool',g:()=>P.rememberPos,v:x=>sp('rememberPos',x)},
 {s:'Display',l:'Default page layout when opening',t:'select',o:[['','Keep current'],['continuous','Continuous'],['single','Single page'],['2up','Side by side'],['2upc','Side by side continuous']],g:()=>P.defLayout,v:x=>sp('defLayout',x)},
 {s:'Display',l:'Maximum zoom (%)',t:'number',min:100,max:6400,g:()=>Math.round(P.maxZoom*100),v:x=>sp('maxZoom',clamp((+x||6400)/100,1,64))},
 {s:'Display',l:'Dark mode for documents',t:'bool',g:()=>P.docDark,v:x=>sp('docDark',x)},
 {s:'Display',l:'Disable line weights (draw markups thin)',t:'bool',g:()=>P.noLineWeights,v:x=>sp('noLineWeights',x)},
 {s:'Display',l:'Always show reply indicators',t:'bool',g:()=>P.replyBadges,v:x=>sp('replyBadges',x)},
 {s:'Display',l:'Full-screen crosshair cursor',t:'bool',g:()=>P.crosshair,v:x=>sp('crosshair',x)},
 {s:'Display',l:'Interface theme',t:'select',o:[['dark','Dark'],['light','Light']],g:()=>(settings.view&&settings.view.theme)||'dark',v:x=>{if(vw.setTheme)vw.setTheme(x)}},
 {s:'Thumbnails',l:'Thumbnail size (px)',t:'number',min:60,max:240,g:()=>P.thumbSize,v:x=>{sp('thumbSize',clamp(+x||150,60,240));sizeThumbs()}},
 {s:'Thumbnails',l:'Show markups on thumbnails',t:'bool',g:()=>P.thumbMarkups,v:x=>{sp('thumbMarkups',x);thumbMarkups()}},
 {s:'Thumbnails',l:'Highlight the current view on thumbnails',t:'bool',g:()=>P.thumbView,v:x=>{sp('thumbView',x);thumbMarkups()}},
 {s:'Mouse & navigation',l:'Mouse wheel zooms (otherwise scrolls)',t:'bool',g:()=>settings.wheelZoom,v:x=>{settings.wheelZoom=x;LS.set('pm:settings',settings)}},
 {s:'Mouse & navigation',l:'Reverse wheel zoom direction',t:'bool',g:()=>P.reverseWheel,v:x=>sp('reverseWheel',x)},
 {s:'Mouse & navigation',l:'Wheel zoom sensitivity',t:'number',step:.25,min:.25,max:3,g:()=>P.wheelSens,v:x=>sp('wheelSens',clamp(+x||1,.25,3))},
 {s:'Mouse & navigation',l:'Lock panning in Fit Width',t:'bool',g:()=>P.lockFitWidth,v:x=>{sp('lockFitWidth',x);lockFit()}},
 {s:'Snapping',l:'Snap to content (drawing lines)',t:'bool',g:()=>!!sn.content,v:x=>{sn.content=x;LS.set('pm:snapopts',sn);hook('prefs')}},
 {s:'Snapping',l:'Snap to markups',t:'bool',g:()=>!!sn.markup,v:x=>{sn.markup=x;LS.set('pm:snapopts',sn);hook('prefs')}},
 {s:'Snapping',l:'Snap to grid',t:'bool',g:()=>!!sn.grid,v:x=>{sn.grid=x;LS.set('pm:snapopts',sn);hook('prefs')}},
 {s:'Snapping',l:'Show grid',t:'bool',g:()=>!!sn.show,v:x=>{sn.show=x;LS.set('pm:snapopts',sn);hook('prefs')}},
 {s:'Snapping',l:'Snap sensitivity (pixels, 3–9)',t:'number',min:3,max:9,g:()=>P.snapSens,v:x=>sp('snapSens',clamp(+x||9,3,9))},
 {s:'Snapping',l:'Snap marker color',t:'color',g:()=>P.snapColor,v:x=>sp('snapColor',x)},
 {s:'Markups',l:'Auto-size text boxes to fit their text',t:'bool',g:()=>P.autoSize,v:x=>sp('autoSize',x)},
 {s:'Markups',l:'Show comments as pop-ups on hover',t:'bool',g:()=>P.popups,v:x=>sp('popups',x)},
 {s:'Markups',l:'Pop-up opacity',t:'number',step:.05,min:.3,max:1,g:()=>P.popOpacity,v:x=>sp('popOpacity',clamp(+x||.95,.3,1))},
 {s:'Markups',l:'Reuse tool (keep the tool after each markup)',t:'bool',g:()=>!!S.lock,v:x=>{S.lock=x;updateRibbon();updStatus()}},
 {s:'Markups',l:'Auto-complete words while typing',t:'bool',g:()=>P.autocomplete,v:x=>sp('autocomplete',x)},
 {s:'Markups',l:'Underline spelling mistakes in text boxes',t:'bool',g:()=>P.spellUnderline,v:x=>{sp('spellUnderline',x);if(x)loadDict().then(redrawAll).catch(()=>{});else redrawAll()}},
 {s:'Markups',l:'View mode (no editing; clicks select and follow links)',t:'bool',g:()=>P.viewMode,v:x=>{sp('viewMode',x);if(x)setTool('select')}},
 ...[1,2,3,4,5,6,7,8,9].map(d=>({s:'Status keys',l:`Number key ${d} sets status`,t:'select',o:[['','(nothing)'],...(((window.PMListPro&&PMListPro.LP.statuses)||[]).map(x=>[x.name,x.name]))],g:()=>P.statusKeys[d]||'',v:x=>{P.statusKeys[d]=x;saveP()}})),
 {s:'Keyboard',l:'Edit keyboard shortcuts…',t:'button',run:shortcutEditor},{s:'Keyboard',l:'Markup editing shortcuts (lock, group, painter)…',t:'button',run:()=>window.PMListPro&&PMListPro.shortcutsDialog()},
 {s:'Toolbars',l:'Customize toolbars…',t:'button',run:tbDialog},{s:'Workspace',l:'Panels & profiles…',t:'button',run:()=>runRib('View')},{s:'Workspace',l:'Display options…',t:'button',run:()=>runRib('Display')},{s:'Account',l:'Account & sync…',t:'button',run:()=>{const b=$('#bAcct');if(b)b.click()}},...Object.keys(window).filter(k=>/^PM_EXTRA_PREFS/.test(k)&&typeof window[k]==='function').flatMap(k=>{try{return window[k]()}catch(e){return[]}})]}
function prefsDialog(){const defs=prefDefs();const row=(d,i)=>{const id='wsp'+i;let ctl='';
 if(d.t==='bool')ctl=`<input type="checkbox" id="${id}" ${d.g()?'checked':''}>`;else if(d.t==='select')ctl=`<select class="ti" id="${id}" style="max-width:210px">${d.o.map(([v,l])=>`<option value="${esc(v)}" ${String(d.g())===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
 else if(d.t==='number')ctl=`<input class="ti" type="number" id="${id}" value="${d.g()}" ${d.min!=null?'min="'+d.min+'"':''} ${d.max!=null?'max="'+d.max+'"':''} step="${d.step||1}" style="width:90px">`;else if(d.t==='color')ctl=`<input type="color" id="${id}" value="${d.g()}" style="width:60px">`;else if(d.t==='text')ctl=`<input class="ti" id="${id}" value="${esc(d.g())}" style="width:180px">`;else ctl=`<button class="btn" id="${id}" style="border:1px solid var(--line)">Open</button>`;
 return`<div class="row wsprow" data-q="${esc((d.s+' '+d.l+' '+(d.h||'')).toLowerCase())}" style="padding:5px 0;border-bottom:1px solid #30363f;gap:10px"><span style="flex:1"><small style="color:var(--mut)">${esc(d.s)}</small><br>${esc(d.l)}${d.h?`<br><small style="color:var(--mut)">${esc(d.h)}</small>`:''}</span><span style="flex:0 0 auto">${ctl}</span></div>`};
 modal('Preferences',`<input class="ti" id="wsPQ" placeholder="Search preferences…" style="margin-bottom:8px"><div id="wsPL" style="max-height:60vh;overflow:auto">${defs.map(row).join('')}</div>`,[{label:'Reset all preferences',fn:()=>{Object.assign(P,clone(DEF_P));saveP();toast('Preferences reset')}},{label:'Close',pri:1,cancel:1}]);
 $('#wsPQ').oninput=e=>{const q=e.target.value.toLowerCase().trim();$$('#wsPL .wsprow').forEach(r=>r.style.display=!q||q.split(/\s+/).every(w=>r.dataset.q.includes(w))?'':'none')};
 defs.forEach((d,i)=>{const el=$('#wsp'+i);if(!el)return;if(d.t==='button')el.onclick=()=>{closeModal();d.run()};else el.onchange=()=>{d.v(d.t==='bool'?el.checked:el.value)}})}
function applyPrefs(){document.body.classList.toggle('wsDocDark',!!P.docDark);document.body.classList.toggle('wsNoLW',!!P.noLineWeights);const mb=$('#wsMenu');if(mb)mb.style.display=P.menu?'':'none';if(!P.crosshair){cH.style.display=cV.style.display='none'}lockFit();updStatus();redrawAll()}

/* ===================== shortcuts sheet & editor, about, banner ===================== */
function shortcutSheet(){const rows=CMDS.filter(c=>!c.hidden&&keyOf(c)&&(!c.when||c.when()));const by={};rows.forEach(c=>{(by[c.menu]=by[c.menu]||[]).push(c)});
 modal('Keyboard shortcuts',`<input class="ti" id="kbS" placeholder="Find…" style="margin-bottom:8px"><div id="kbSL" style="max-height:58vh;overflow:auto;columns:2;column-gap:18px;font-size:12px">${Object.entries(by).map(([m,cs])=>`<div style="break-inside:avoid;margin-bottom:8px"><b>${esc(m)}</b>${cs.map(c=>`<div class="row kbr" data-q="${esc(c.label.toLowerCase())}" style="justify-content:space-between;gap:8px;padding:1px 0"><span>${esc(c.label)}</span><kbd style="background:var(--bg);border:1px solid var(--line);border-radius:3px;padding:0 4px;white-space:nowrap">${esc(keyOf(c))}</kbd></div>`).join('')}</div>`).join('')}
 <div style="break-inside:avoid"><b>Status keys</b>${Object.entries(P.statusKeys).filter(([,v])=>v).map(([k,v])=>`<div class="row" style="justify-content:space-between"><span>${esc(v)}</span><kbd>${k}</kbd></div>`).join('')}</div></div>`,[{label:'Edit shortcuts…',fn:()=>{setTimeout(shortcutEditor,0)}},{label:'Close',pri:1,cancel:1}]);
 $('#kbS').oninput=e=>{const q=e.target.value.toLowerCase();$$('#kbSL .kbr').forEach(r=>r.style.display=r.dataset.q.includes(q)?'':'none')}}
function shortcutEditor(){const list=CMDS.filter(c=>!c.hidden&&(!c.when||c.when()));
 modal('Edit keyboard shortcuts',`<div class="hint" style="margin-bottom:6px">Click a shortcut, then press the new keys (Esc cancels). Shortcuts follow your login.</div><input class="ti" id="keQ" placeholder="Find a command…" style="margin-bottom:6px">
 <div id="keL" style="max-height:52vh;overflow:auto">${list.map(c=>`<div class="row kerow" data-q="${esc((c.menu+' '+c.label).toLowerCase())}" style="padding:3px 0;border-bottom:1px solid #30363f"><span style="flex:2"><small style="color:var(--mut)">${esc(c.menu)}</small> ${esc(c.label)}</span><button class="btn" data-ke="${esc(c.id)}" style="flex:1;border:1px solid var(--line);justify-content:center">${esc(keyOf(c)||'—')}</button><button class="btn" data-kr="${esc(c.id)}" title="Default" style="flex:0">↺</button></div>`).join('')}</div>`,
 [{label:'Reset all',fn:()=>{const k=LS.get('pm:keys',{});for(const id in k)if(id.startsWith('ws:'))delete k[id];LS.set('pm:keys',k);toast('Shortcuts reset')}},{label:'Close',pri:1,cancel:1}]);
 $('#keQ').oninput=e=>{const q=e.target.value.toLowerCase();$$('#keL .kerow').forEach(r=>r.style.display=r.dataset.q.includes(q)?'':'none')};
 $('#keL').onclick=e=>{const rr=e.target.closest('[data-kr]');if(rr){const k=LS.get('pm:keys',{});delete k['ws:'+rr.dataset.kr];LS.set('pm:keys',k);const c=CMDS.find(x=>x.id===rr.dataset.kr);rr.previousElementSibling.textContent=keyOf(c)||'—';return}
  const b=e.target.closest('[data-ke]');if(!b)return;b.textContent='Press keys…';recording=combo=>{recording=null;const c=CMDS.find(x=>x.id===b.dataset.ke);if(!combo){b.textContent=keyOf(c)||'—';return}
   const k=LS.get('pm:keys',{});const clash=CMDS.find(x=>x!==c&&!x.hidden&&norm(keyOf(x))===combo);if(clash)k['ws:'+clash.id]='';k['ws:'+c.id]=combo;LS.set('pm:keys',k);b.textContent=combo;if(clash)toast('Removed it from "'+clash.label+'"')}}}
function about(){const v=(window.pmDesktop&&pmDesktop.webVersion)||APP_VER;modal('About PlanMark',`<div class="brand" style="padding:0;font-size:18px;margin-bottom:6px"><i></i>PlanMark</div><div class="hint">Version ${esc(v)}${window.pmDesktop?'<br>Windows installer version '+esc(pmDesktop.version||''):' · web'}<br>PDF markup, measurement and takeoff for construction.</div>
 <div class="sec">Open-source components</div><div class="hint" style="font-size:11.5px;line-height:1.6">pdf.js (Apache-2.0) · pdf-lib (MIT) · JSZip (MIT) · tesseract.js & tesseract.js-core (Apache-2.0) · English word list "word-list" by Sindre Sorhus (MIT)${window.pmDesktop?' · Electron (MIT)':''}</div>`,[{label:'Close',pri:1,cancel:1}])}
const NEWS=['Type right on the drawing in text boxes and callouts; click away to finish','8 resize handles, rotate handle and callout knee; Ctrl+drag copies','Split screen works like Bluebeam: one click on the other pane switches and acts','Sharper drawings at high zoom, now up to 6400%','Sheet names in the page box and thumbnails (type "s-14" to jump)','Markups list: drag columns to size and move them; click a row to go there','Tool Chest Properties mode, new tool sets, double-click to keep a tool on','Save As (Ctrl+Shift+S), Export to Word / Excel / images / XFDF','Dimension leader handle and exact Dynamic Fill like Bluebeam','Windows app: Ctrl+S saves the same file, asks before closing unsaved work, recovers after a crash'];
function banner(force){if(!force&&(!P.banners||LS.get('pm:ws:seen','')===WS_VER))return;const old=$('#wsBanner');if(old)old.remove();const b=document.createElement('div');b.id='wsBanner';
 b.innerHTML=`<b style="font-size:14px">What's new in PlanMark ${WS_VER}</b><ul style="margin:8px 0 10px;padding-left:18px;font-size:12.5px;line-height:1.55">${NEWS.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><div class="row" style="gap:6px"><button class="btn pri" id="wsBOk" style="flex:0">Got it</button><button class="btn" id="wsBKeys" style="flex:0;border:1px solid var(--line)">Shortcuts</button></div>`;
 document.body.appendChild(b);LS.set('pm:ws:seen',WS_VER);setTimeout(()=>{if(b.isConnected&&!b.matches(':hover'))b.remove()},15000);$('#wsBOk').onclick=()=>{LS.set('pm:ws:seen',WS_VER);b.remove()};$('#wsBKeys').onclick=()=>{LS.set('pm:ws:seen',WS_VER);b.remove();shortcutSheet()}}

/* ===================== status bar ===================== */
function updStatus(){const st=$('#status');if(!st)return;let w=$('#wsStat');if(!w){w=document.createElement('span');w.id='wsStat';w.style.cssText='display:flex;gap:6px;align-items:center';{const ref=[...st.children].find(x=>x.id==='snapBtn'||x.id==='scaleBtn'||x.contains($('#snapBtn')));ref?st.insertBefore(w,ref):st.appendChild(w)}}
 const p=S.pages[S.cur-1],sc=p?scaleFor(S.cur):null;
 w.innerHTML=`<span id="wsPgSz" class="hide-m" title="Page size">${p?((p.w/72).toFixed(2)+' × '+(p.h/72).toFixed(2)+' in'):''}</span><button class="wsSB ${S.lock?'on':''}" id="wsReuse" title="Reuse tool: keep the tool active after each markup">Reuse</button><button class="wsSB ${P.viewMode?'on':''}" id="wsMode" title="Markup mode / View mode">${P.viewMode?'View mode':'Markup mode'}</button>`;
 $('#wsReuse').onclick=()=>{S.lock=!S.lock;updateRibbon();updStatus()};$('#wsMode').onclick=()=>{P.viewMode=!P.viewMode;saveP();if(P.viewMode)setTool('select');toast(P.viewMode?'View mode — editing is off':'Markup mode')}}

/* ===================== text auto-size ===================== */
function autoSize(){if(!P.autoSize)return;let ch=false;for(const m of S.markups){if(m.type!=='text'||!m.text||m.locked)continue;const b=normBox(m.pts[0],m.pts[1]),fs=m.style.fontSize||12,pad=Math.max(3,fs*.35),need=wrap(m.text,b[2]-b[0]-pad*2,fs,{font:m.style.font,bold:m.style.bold,italic:m.style.italic}).length*fs*1.2+pad*2;
 if(m.boxText===m.text&&need<=b[3]-b[1]+.5)continue;   // a box read from another app keeps the size its author gave it, until its words are changed or no longer fit
 if(Math.abs((b[3]-b[1])-need)>.5&&need>fs){m.pts=[[b[0],b[1]],[b[2],b[1]+need]];ch=true;redrawPage(m.page)}}return ch}

/* ===================== session memory (reopen last files) ===================== */
function rememberSession(){try{const tabs=(V().tabs||[]).map(t=>t.name).filter(Boolean);LS.set('pm:ws:session',tabs.length?tabs:(S.fileName?[S.fileName]:[]))}catch(e){}}
async function reopenSession(){const names=LS.get('pm:ws:session',[]);if(!names.length)return;if(window.PMRecent){try{for(const n of names){const f=await PMRecent.newest(n);if(f)await openBytes(new Uint8Array(f.bytes),f.name)}}catch(e){console.warn('reopen',e)}return}try{const db=await new Promise((res,rej)=>{const r=indexedDB.open('planmark-recent',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'key'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
 const all=await new Promise((res,rej)=>{const t=db.transaction('files','readonly').objectStore('files').getAll();t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});
 for(const n of names){const f=all.filter(x=>x.name===n).sort((a,b)=>b.at-a.at)[0];if(f)await openBytes(new Uint8Array(f.bytes),f.name)}}catch(e){console.warn('reopen',e)}}

/* ===================== wiring ===================== */
H.open.push(info=>{const fresh=!(info&&(info.restored||info.switched));LK.doc=null;
 setTimeout(()=>{if(fresh&&P.defLayout&&V().setMode)V().setMode(P.defLayout);if(fresh&&P.rememberPos){const pos=(LS.get('pm:ws:pos',{})||{})[S.fileKey];if(pos&&pos.p<=S.pages.length){setZoom(pos.z);gotoPage(pos.p,true)}}lockFit();updStatus();rememberSession()},fresh?350:50);
 renderHistory();renderFlags();if(!$('#pane-links').classList.contains('hide'))renderLinks(true);if(P.spellUnderline&&S.markups.some(m=>TEXTISH.has(m.type)&&m.text))loadDict().then(()=>redrawAll()).catch(()=>{})});
let chT=0;H.change.push(()=>{finalizeLabel();clearTimeout(chT);chT=setTimeout(()=>{renderHistory();renderFlags();thumbMarkups();if(autoSize())redrawAll();if(P.spellUnderline&&!WS.dict&&S.markups.some(m=>TEXTISH.has(m.type)&&m.text))loadDict().then(()=>redrawAll()).catch(()=>{});
 const lp=$('#pane-links');if(lp&&!lp.classList.contains('hide'))renderLinks(true)},120)});
const _ucu=updateCurUI;updateCurUI=function(){_ucu.apply(this,arguments);updStatus();schedulePos()};
H.prefs.push(()=>{Object.assign(P,clone(DEF_P),LS.get('pm:ws:prefs',{}));Object.assign(TB,{hidden:[],order:{},size:'normal',labels:true,pinned:[]},LS.get('pm:ws:tb',{}));applyTB();applyPrefs()});
H.ready.push(()=>{setTimeout(()=>{installWrappers();buildCmds();buildMenu();applyTB();applyPrefs();updStatus();
 addTab('history','History');addTab('links','Links');addTab('flags','Flags');renderHistory();renderFlags();
 const tabsEl=$('#left .tabs');tabsEl.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;if(b.dataset.tab==='links')renderLinks(false);if(b.dataset.tab==='history')renderHistory();if(b.dataset.tab==='flags')renderFlags();if(b.dataset.tab==='pages')setTimeout(()=>{thumbMarkups();updViewRect()},30)});
 // context menus
 viewer.addEventListener('contextmenu',e=>{if(S.drawing||S.countId||!S.pages.length)return;e.preventDefault();const mk=e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);if(m)return markupMenu(e.clientX,e.clientY,m);const p=pageFromEvent(e);if(p)pageMenu(e.clientX,e.clientY,p,toPt(e,p))});
 $('#mlBody').addEventListener('contextmenu',e=>{const tr=e.target.closest('tr[data-id]');if(!tr)return;e.preventDefault();const m=byId(tr.dataset.id);if(m)markupMenu(e.clientX,e.clientY,m,'list')});
 document.addEventListener('contextmenu',e=>{const t=e.target.closest&&e.target.closest('#tabBar [data-tid],.tabBar2 [data-tid]');if(t){e.preventDefault();const vw=V();tabMenu(e.clientX,e.clientY,t.dataset.tid,!!t.closest('.tabBar2'),vw.slotOfBar?vw.slotOfBar(t.closest('#tabBar,.tabBar2')):null)}});
 document.addEventListener('keydown',e=>{if(e.key==='F10'&&e.shiftKey&&S.sel.size){e.preventDefault();const m=sel()[0],p=S.pages[m.page-1],b=bboxOf(m),r=p.el.getBoundingClientRect();markupMenu(r.left+b[2]*S.zoom,r.top+b[1]*S.zoom,m)}},true);
 decorateThumbs();banner(false);if(P.showFiles)switchTab('files');if(P.reopenLast&&!S.pages.length)reopenSession();
 if(P.spellUnderline)setTimeout(()=>loadDict().then(()=>redrawAll()).catch(()=>{}),3000)},0)});
window.addEventListener('beforeunload',rememberSession);
function addDictWord(w){const d=LS.get('pm:ws:dict',[]);d.push(String(w).toLowerCase());LS.set('pm:ws:dict',[...new Set(d)]);if(WS.dict)WS.dict.add(String(w).toLowerCase())}
window.PMWorkspace={wsVer:WS_VER,appVer:APP_VER,prefDefs,loadDict,okWord,suggest,misspelled,addDictWord,P,TB,get CMDS(){return CMDS},buildCmds,menuItems,ctx,markupMenu,pageMenu,thumbMenu,tabMenu,present,prefsDialog,tbDialog,shortcutSheet,shortcutEditor,about,banner,cycleSel,pasteInPlace,pasteAt,align,alignSize,centerInDoc,roundDialog,
 renderHistory,jumpHistory,renderLinks,scanLinks,LK,renderFlags,movePageTo,copyPageImage,docProps,refresh,reloadDoc,statusKey,spellDialog,geomPts,keyOf,comboOf,applyPrefs,decorateThumbs};
})();
