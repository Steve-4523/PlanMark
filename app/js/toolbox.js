/* PlanMark — construction symbols, built-in Tool Chest sets, recent tools */
(function(){
// ---------- symbol library (original vector symbols; size follows Font size) ----------
const SYM={
 tag:{name:'Door tag',text:'101'},hex:{name:'Wall / window tag',text:'A'},delta:{name:'Revision delta',text:'1'},keynote:{name:'Keynote',text:'1'},
 section:{name:'Section marker',text:'1|A-301'},detail:{name:'Detail callout',text:'2|A-501'},elev:{name:'Elevation marker',text:'1|A-201'},
 grid:{name:'Grid bubble',text:'A'},north:{name:'North arrow',text:''},spot:{name:'Spot elevation',text:'+0\'-0"'},
 punch:{name:'Punch item',text:'1'},outlet:{name:'Duplex outlet',text:''},light:{name:'Light fixture',text:''},sw:{name:'Switch',text:''},
 smoke:{name:'Smoke detector',text:''},sprink:{name:'Sprinkler head',text:''},fe:{name:'Fire extinguisher',text:''},thermo:{name:'Thermostat',text:''},
 ok:{name:'Check mark',text:''},x:{name:'X mark',text:''},q:{name:'Question',text:'?'},hold:{name:'Hold / verify',text:'HOLD'},
};
const two=t=>{const[a,b]=String(t||'').split('|');return[a||'',b||'']};
function symGeom(m){const u=(m.style.fontSize||12)*1.1,c=m.pts[0];let w=u,h=u;if(m.sym==='hold'){w=Math.max(u*2,tw(m.text||'HOLD',m.style.fontSize||12,true)/2+u*.6);h=u*.8}if(m.sym==='spot'){w=u*.6+tw(m.text||'',m.style.fontSize||12)/2+u*.4}return{c,u,b:[c[0]-w,c[1]-h,c[0]+w,c[1]+h]}}
H.symbolBox=m=>{const g=symGeom(m);return g.b};
H.symbolPrims=(m,out,L,TX)=>{const s=m.style,{c,u}=symGeom(m),[x,y]=c,fill=(s.fill&&s.fill!=='none')?s.fill:'#ffffff',fo=s.fillOpacity??1,fs=s.fontSize||12,t=m.text??(SYM[m.sym]||{}).text??'';
 const P=(pts,cl,e={})=>L(dPoly(pts,cl),Object.assign({dash:''},e)),C=(r,e={})=>L(dCircle([x,y],r),Object.assign({dash:''},e)),T1=(xx,yy,str,e={})=>TX(xx,yy,str,Object.assign({halo:false,bold:true,size:fs*.85},e));
 const poly=(n,r,rot=0)=>Array.from({length:n},(_,i)=>{const a=rot+i/n*Math.PI*2;return[x+r*Math.cos(a),y+r*Math.sin(a)]});
 switch(m.sym){
 case'tag':C(u,{fill,fo});T1(x,y,t);break;
 case'hex':P(poly(6,u),true,{fill,fo});T1(x,y,t);break;
 case'delta':P([[x,y-u],[x+u*1.1,y+u*.8],[x-u*1.1,y+u*.8]],true,{fill,fo});T1(x,y+u*.25,t,{size:fs*.75});break;
 case'keynote':P([[x-u*.8,y-u*.8],[x+u*.8,y-u*.8],[x+u*.8,y+u*.8],[x-u*.8,y+u*.8]],true,{fill,fo});T1(x,y,t);break;
 case'section':{const[a,b]=two(t);C(u,{fill,fo});P([[x-u,y],[x+u,y]]);P([[x+u*.98,y-u*.2],[x+u*1.7,y],[x+u*.98,y+u*.2]],true,{fill:s.stroke,fo:1});T1(x,y-u*.45,a,{size:fs*.7});T1(x,y+u*.45,b,{size:fs*.55,bold:false});break}
 case'detail':{const[a,b]=two(t);C(u,{fill,fo});P([[x-u,y],[x+u,y]]);T1(x,y-u*.45,a,{size:fs*.7});T1(x,y+u*.45,b,{size:fs*.55,bold:false});break}
 case'elev':{const[a,b]=two(t);P([[x,y-u*1.6],[x+u*1.15,y-u*.6],[x-u*1.15,y-u*.6]],true,{fill:s.stroke,fo:1});C(u,{fill,fo});P([[x-u,y],[x+u,y]]);T1(x,y-u*.45,a,{size:fs*.7});T1(x,y+u*.45,b,{size:fs*.55,bold:false});break}
 case'grid':C(u,{fill,fo});T1(x,y,t,{size:fs});P([[x,y+u],[x,y+u*2.4]],false,{dash:'dashdot'});break;
 case'north':C(u,{fill:'#ffffff',fo:fo});P([[x,y-u*.95],[x+u*.45,y+u*.6],[x,y+u*.25]],true,{fill:s.stroke,fo:1});P([[x,y-u*.95],[x-u*.45,y+u*.6],[x,y+u*.25]],true);T1(x,y-u*1.45,'N',{size:fs*.8});break;
 case'spot':P([[x-u*.5,y],[x+u*.5,y]]);P([[x,y-u*.5],[x,y+u*.5]]);C(u*.25);TX(x+u*.6,y-u*.35,t,{halo:false,bold:false,align:'start',size:fs*.8});break;
 case'punch':C(u*.85,{fill:s.stroke,fo:1});TX(x,y,t,{halo:false,bold:true,color:'#ffffff',size:fs*.8});break;
 case'outlet':C(u*.6,{fill,fo});P([[x-u*.6,y-u*.25],[x-u*1.2,y-u*.25]]);P([[x-u*.6,y+u*.25],[x-u*1.2,y+u*.25]]);break;
 case'light':C(u*.8,{fill,fo});{const k=u*.8*.707;P([[x-k,y-k],[x+k,y+k]]);P([[x+k,y-k],[x-k,y+k]])}break;
 case'sw':T1(x,y,'S',{size:fs*1.1});break;
 case'smoke':C(u*.8,{fill,fo});T1(x,y,'SD',{size:fs*.6});break;
 case'sprink':C(u*.5,{fill,fo});P([[x-u,y],[x+u,y]]);P([[x,y-u],[x,y+u]]);break;
 case'fe':P([[x,y-u],[x+u,y+u*.8],[x-u,y+u*.8]],true,{fill:'#ffffff',fo});T1(x,y+u*.3,'FE',{size:fs*.55});break;
 case'thermo':C(u*.7,{fill,fo});T1(x,y,'T',{size:fs*.8});break;
 case'ok':P([[x-u*.8,y],[x-u*.2,y+u*.6],[x+u*.9,y-u*.7]],false,{w:(s.width||1.5)*1.6});break;
 case'x':P([[x-u*.7,y-u*.7],[x+u*.7,y+u*.7]],false,{w:(s.width||1.5)*1.6});P([[x+u*.7,y-u*.7],[x-u*.7,y+u*.7]],false,{w:(s.width||1.5)*1.6});break;
 case'q':C(u,{fill,fo});T1(x,y,t||'?',{size:fs*1.1});break;
 case'hold':{const g=symGeom(m),b=g.b;L(dCloud([[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],u*.35),{fill,fo,dash:''});T1(x,y,t||'HOLD',{size:fs*.8});break}
 default:C(u,{fill,fo});T1(x,y,t)}};
function symPreview(k){const m={type:'symbol',sym:k,pts:[[20,20]],style:Object.assign({},S.defaults.symbol,{fontSize:11}),text:SYM[k].text};
 return`<svg viewBox="0 0 40 40" width="40" height="40" style="background:#fff;border-radius:6px">${prims(m).map(primSvg).join('')}</svg>`}
H.symbolPicker=()=>{if(!S.pages.length){toast('Open a PDF first');return}
 modal('Symbols',`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${Object.keys(SYM).map(k=>`<button class="btn" data-sym="${k}" style="flex-direction:column;height:auto;padding:6px;border:1px solid var(--line);white-space:normal;font-size:10.5px;gap:3px">${symPreview(k)}${esc(SYM[k].name)}</button>`).join('')}</div>
 <div class="fld" style="margin-top:10px"><label>Text (use | to split top|bottom on section/detail markers)</label><input class="ti" id="symT" placeholder="leave blank for the default"></div>`,[{label:'Close',cancel:1}]);
 $('#modal').querySelector('div').parentElement.addEventListener('click',e=>{const b=e.target.closest('[data-sym]');if(!b)return;S.symbol=b.dataset.sym;const t=$('#symT').value;S.symbolText=t?t:SYM[S.symbol].text;closeModal();setTool('symbol');toast(SYM[S.symbol].name+': click to place')})};
T.symbol.label='Symbols';
RIBBON[1][1].push('symbol');IC.symbol='<circle cx="8" cy="8" r="4"/><path d="M15 4l5 8h-10z"/><rect x="5" y="15" width="6" height="6"/><path d="M15 15l5 5M20 15l-5 5"/>';
KEYS.symbol='Shift+Y';
// ---------- built-in Tool Chest sets ----------
const st=(o)=>Object.assign({opacity:1},o);
const BUILTIN=[
 ...['tag','hex','delta','keynote','section','detail','elev','grid','north','spot','punch','hold'].map(k=>({set:'Construction',name:SYM[k].name,type:'symbol',sym:k,text:SYM[k].text,subject:SYM[k].name,style:st({stroke:k==='punch'?'#dc2626':k==='hold'?'#d97706':'#1f2937',width:1.5,fill:'#ffffff',fillOpacity:1,fontSize:12})})),
 ...['outlet','light','sw','smoke','sprink','fe','thermo'].map(k=>({set:'MEP & Life Safety',name:SYM[k].name,type:'symbol',sym:k,text:'',subject:SYM[k].name,style:st({stroke:k==='fe'||k==='smoke'||k==='sprink'?'#dc2626':'#0369a1',width:1.5,fill:'#ffffff',fillOpacity:1,fontSize:10})})),
 {set:'Review',name:'Revision Cloud+',type:'cloudplus',subject:'Revision',style:st({stroke:'#e0312b',width:2,fill:'none',fillOpacity:.3,cloud:9,fontSize:12})},
 {set:'Review',name:'Field Verify cloud',type:'cloud',subject:'Field Verify',style:st({stroke:'#d97706',width:2,fill:'#fde68a',fillOpacity:.25,cloud:9})},
 {set:'Review',name:'Delete / Demo hatch',type:'rect',subject:'Demolish',style:st({stroke:'#dc2626',width:1.5,fill:'#dc2626',fillOpacity:.18,dash:'dash'})},
 {set:'Review',name:'Check mark',type:'symbol',sym:'ok',text:'',subject:'Checked',style:st({stroke:'#16a34a',width:2,fontSize:12})},
 {set:'Review',name:'X mark',type:'symbol',sym:'x',text:'',subject:'Rejected',style:st({stroke:'#dc2626',width:2,fontSize:12})},
 {set:'Review',name:'Question',type:'symbol',sym:'q',text:'?',subject:'Question',style:st({stroke:'#7c3aed',width:1.5,fill:'#ede9fe',fillOpacity:1,fontSize:12})},
 {set:'Review',name:'Approved stamp',type:'stamp',text:'APPROVED',subject:'Stamp',style:st({stroke:'#15803d',width:2,opacity:.9,fontSize:20})},
 {set:'Review',name:'Revise & Resubmit stamp',type:'stamp',text:'REVISE & RESUBMIT',subject:'Stamp',style:st({stroke:'#c2410c',width:2,opacity:.9,fontSize:18})},
 {set:'Takeoff',name:'Concrete slab (4" volume)',type:'volume',subject:'Concrete Slab',depth:0.1016,style:st({stroke:'#78716c',width:1.5,fill:'#a8a29e',fillOpacity:.3,fontSize:10})},
 {set:'Takeoff',name:'Footing (12" volume)',type:'volume',subject:'Footing',depth:0.3048,style:st({stroke:'#57534e',width:1.5,fill:'#78716c',fillOpacity:.3,fontSize:10})},
 {set:'Takeoff',name:'Interior wall (9\' high)',type:'polylength',subject:'Interior Wall',height:2.7432,style:st({stroke:'#2563eb',width:2.5,fontSize:10})},
 {set:'Takeoff',name:'Exterior wall (10\' high)',type:'polylength',subject:'Exterior Wall',height:3.048,style:st({stroke:'#1e3a8a',width:3,fontSize:10})},
 {set:'Takeoff',name:'Flooring area',type:'area',subject:'Flooring',style:st({stroke:'#16a34a',width:1.5,fill:'#16a34a',fillOpacity:.22,fontSize:10})},
 {set:'Takeoff',name:'Roofing area',type:'area',subject:'Roofing',style:st({stroke:'#9a3412',width:1.5,fill:'#9a3412',fillOpacity:.2,fontSize:10})},
 {set:'Takeoff',name:'Paint / wall area',type:'area',subject:'Paint',style:st({stroke:'#db2777',width:1.5,fill:'#db2777',fillOpacity:.15,fontSize:10})},
 {set:'Takeoff',name:'Baseboard / trim',type:'polylength',subject:'Trim',style:st({stroke:'#a16207',width:2,dash:'dash',fontSize:10})},
 {set:'Takeoff',name:'Doors',type:'count',subject:'Door',style:st({stroke:'#7c2d12',width:1.5,fill:'#ea580c',fillOpacity:.35,fontSize:8})},
 {set:'Takeoff',name:'Windows',type:'count',subject:'Window',style:st({stroke:'#0e7490',width:1.5,fill:'#06b6d4',fillOpacity:.35,fontSize:8})},
 {set:'Takeoff',name:'Plumbing fixtures',type:'count',subject:'Plumbing Fixture',style:st({stroke:'#1d4ed8',width:1.5,fill:'#3b82f6',fillOpacity:.35,fontSize:8})},
];
S.recent=LS.get('pm:recent',[]);
let chestFilter='All';
function combined(){return[...S.chest.map(c=>Object.assign({set:c.set||'My Tools'},c)),...BUILTIN,...S.recent.map(c=>Object.assign({},c,{set:'Recent Tools'}))]}
const rowIcon=c=>c.type==='symbol'?`<span style="width:22px;height:22px;display:inline-block;flex-shrink:0">${symPreview(c.sym).replace('width="40" height="40"','width="22" height="22"')}</span>`:icon(c.type,`style="stroke:${c.style.stroke}"`);
renderChest=function(){const pane=$('#pane-chest');if(!pane)return;const all=combined(),sets=['All',...new Set(all.map(c=>c.set))];if(!sets.includes(chestFilter))chestFilter='All';
 let h=`<div class="row" style="gap:6px;margin-bottom:8px"><select class="ti" id="chSet">${sets.map(x=>`<option ${x===chestFilter?'selected':''}>${esc(x)}</option>`).join('')}</select><input class="ti" id="chQ" placeholder="Find tool…"></div>`;
 let last='';all.forEach((c,i)=>{if(chestFilter!=='All'&&c.set!==chestFilter)return;if(c.set!==last){last=c.set;h+=`<div class="sec">${esc(c.set)}</div>`}
  h+=`<div class="chest ${S.chestSel===i?'on':''}" data-i="${i}" data-q="${esc((c.name+' '+(c.subject||'')+' '+c.set).toLowerCase())}">${rowIcon(c)}<span class="nm">${esc(c.name)}<br><small style="color:var(--mut)">${esc(T[c.type]?.label||'')}${c.subject?' · '+esc(c.subject):''}</small></span>${i<S.chest.length?`<button class="x" data-x="${i}" title="Remove">✕</button>`:''}</div>`});
 h+=`<div class="hint" style="margin-top:8px">Click a tool to use it once, double-click to keep it on. Add your own from any markup's Properties → "Add to Tool Chest".</div>
 <div class="row" style="gap:6px;margin-top:8px"><button class="btn" id="chExp" style="border:1px solid var(--line)">Export my tools</button><button class="btn" id="chImp" style="border:1px solid var(--line)">Import…</button></div>`;
 pane.innerHTML=h;
 $('#chSet').onchange=e=>{chestFilter=e.target.value;renderChest()};
 $('#chQ').oninput=e=>{const q=e.target.value.toLowerCase();$$('#pane-chest .chest').forEach(r=>r.style.display=r.dataset.q.includes(q)?'':'none')};
 $('#chExp').onclick=()=>saveFile('planmark-tools.json',JSON.stringify({app:'PlanMark',tools:S.chest},null,1));
 $('#chImp').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const j=JSON.parse(await i.files[0].text());const n=(j.tools||[]).filter(t=>T[t.type]);S.chest.push(...n);LS.set('pm:chest',S.chest);renderChest();toast(`Imported ${n.length} tools`)}catch(e){toast('Not a PlanMark tools file')}};i.click()}};
useChest=function(i,lock){const c=combined()[i];if(!c||!S.pages.length)return;
 if(c.type==='stamp')S.stampText=c.text||S.stampText;if(c.type==='symbol'){S.symbol=c.sym;S.symbolText=c.text}
 S.chestItem=c;setTool(c.type,{style:clone(c.style),subject:c.subject,chest:i,lock});if(innerWidth<=820)$('#left').classList.add('hide')};
// apply chest extras (depth/height/text) to new markups, and track recent tools
const _ac=afterCreate;afterCreate=function(m){const c=S.chestItem;if(c&&S.chestSel!=null&&c.type===m.type){if(c.depth)m.depth=c.depth;if(c.height)m.height=c.height;if(c.text!=null&&m.type!=='symbol'&&m.type!=='stamp'&&!m.text)m.text=c.text}
 try{const r={name:(m.subject||T[m.type].label),type:m.type,subject:m.subject,style:clone(m.style),sym:m.sym,text:m.type==='symbol'||m.type==='stamp'?m.text:undefined,depth:m.depth,height:m.height};
  S.recent=[r,...S.recent.filter(x=>!(x.type===r.type&&x.subject===r.subject&&x.style.stroke===r.style.stroke))].slice(0,10);LS.set('pm:recent',S.recent)}catch(e){}
 return _ac.apply(this,arguments)};
const _st=setTool;setTool=function(t,o={}){if(o.chest==null)S.chestItem=null;return _st.apply(this,arguments)};
window.PMToolbox={SYM,BUILTIN};
})();
