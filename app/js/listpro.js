/* PlanMark — Markups List pro (custom columns & formulas, filters, statuses, replies) and markup-editing parity
   (lock, hide, group, format painter, lasso, select same/invert, forward/backward, rotate/flip, custom shortcuts). */
(function(){
window.PM_EXTRA_SYNC_KEYS=['pm:cols','pm:statuses','pm:filters','pm:keys'];
const DEF_STATUSES=[{name:'Open',color:'#3b82f6'},{name:'Accepted',color:'#16a34a'},{name:'Rejected',color:'#dc2626'},{name:'Completed',color:'#0d9488'},{name:'Cancelled',color:'#6b7280'},{name:'In Progress',color:'#f59e0b'},{name:'Field Verify',color:'#a855f7'}];
const BUILTIN=[['check','✓'],['subject','Subject'],['page','Page'],['space','Space'],['label','Label'],['measure','Measurement'],['comment','Comments'],['author','Author'],['date','Date'],['status','Status']];
const LP={cols:Object.assign({custom:[],hidden:[],order:null},LS.get('pm:cols',{})),statuses:LS.get('pm:statuses',null)||clone(DEF_STATUSES),filters:LS.get('pm:filters',[]),
 f:{},painter:null,lasso:{on:false,drag:false,pts:[],page:0},expanded:new Set()};
const saveCols=()=>LS.set('pm:cols',LP.cols),saveStatuses=()=>{LS.set('pm:statuses',LP.statuses);syncStatusList()};
function syncStatusList(){STATUSES.length=0;STATUSES.push('',...LP.statuses.map(s=>s.name));for(const m of S.markups)if(m.status&&!STATUSES.includes(m.status))STATUSES.push(m.status)}
syncStatusList();
const stColor=n=>(LP.statuses.find(s=>s.name===n)||{}).color||'#9aa3b2';
function colOrder(){const keys=[...BUILTIN.map(b=>b[0]),...LP.cols.custom.map(c=>'c:'+c.id)];let o=(LP.cols.order||[]).filter(k=>keys.includes(k));for(const k of keys)if(!o.includes(k))o.push(k);return o}
const colLabel=k=>k.startsWith('c:')?((LP.cols.custom.find(c=>'c:'+c.id===k)||{}).name||'?'):(BUILTIN.find(b=>b[0]===k)||[k,k])[1];
const visibleCols=()=>colOrder().filter(k=>!LP.cols.hidden.includes(k));
const cdef=id=>LP.cols.custom.find(c=>c.id===id);
/* ---------- safe formula evaluator ---------- */
function tokenize(s){const t=[];let i=0;while(i<s.length){const c=s[i];if(/\s/.test(c)){i++;continue}
 if(/[0-9.]/.test(c)){let j=i;while(j<s.length&&/[0-9.]/.test(s[j]))j++;const v=parseFloat(s.slice(i,j));if(isNaN(v))throw new Error('Bad number');t.push({t:'n',v});i=j;continue}
 if(c==='['){const j=s.indexOf(']',i);if(j<0)throw new Error('Missing ]');t.push({t:'id',v:s.slice(i+1,j).trim()});i=j+1;continue}
 if(c==='"'||c==="'"){const j=s.indexOf(c,i+1);if(j<0)throw new Error('Missing quote');t.push({t:'s',v:s.slice(i+1,j)});i=j+1;continue}
 if(/[A-Za-z_]/.test(c)){let j=i;while(j<s.length&&/[A-Za-z0-9_]/.test(s[j]))j++;t.push({t:'id',v:s.slice(i,j)});i=j;continue}
 const two=s.slice(i,i+2);if(['<=','>=','!=','==','<>'].includes(two)){t.push({t:'op',v:two});i+=2;continue}
 if('+-*/(),<>=^%'.includes(c)){t.push({t:'op',v:c});i++;continue}throw new Error('Unexpected "'+c+'"')}return t}
function parse(src){const t=tokenize(String(src||''));let i=0;const pk=()=>t[i],nx=()=>t[i++],isOp=v=>pk()&&pk().t==='op'&&pk().v===v;
 const expr=()=>cmp();
 const cmp=()=>{let a=add();while(pk()&&pk().t==='op'&&['<','>','<=','>=','=','==','!=','<>'].includes(pk().v)){const op=nx().v;a={k:'bin',op,a,b:add()}}return a};
 const add=()=>{let a=mul();while(isOp('+')||isOp('-')){const op=nx().v;a={k:'bin',op,a,b:mul()}}return a};
 const mul=()=>{let a=una();while(isOp('*')||isOp('/')||isOp('%')){const op=nx().v;a={k:'bin',op,a,b:una()}}return a};
 const una=()=>{if(isOp('-')){nx();return{k:'neg',a:una()}}if(isOp('+')){nx();return una()}return pow()};
 const pow=()=>{const a=prim();if(isOp('^')){nx();return{k:'bin',op:'^',a,b:una()}}return a};
 const prim=()=>{const x=nx();if(!x)throw new Error('Formula ends too early');if(x.t==='n')return{k:'n',v:x.v};if(x.t==='s')return{k:'s',v:x.v};
  if(x.t==='op'&&x.v==='('){const e=expr();if(!isOp(')'))throw new Error('Missing )');nx();return e}
  if(x.t==='id'){if(isOp('(')){nx();const args=[];if(!isOp(')')){args.push(expr());while(isOp(',')){nx();args.push(expr())}}if(!isOp(')'))throw new Error('Missing ) after '+x.v);nx();return{k:'call',name:x.v.toUpperCase(),args}}return{k:'id',name:x.v}}
  throw new Error('Unexpected "'+x.v+'"')};
 const e=expr();if(i<t.length)throw new Error('Unexpected "'+t[i].v+'"');return e}
const FN={ROUND:(a)=>{const n=a[1]===undefined?0:num(a[1]),f=Math.pow(10,n);return Math.round(num(a[0])*f)/f},MIN:a=>Math.min(...a.map(num)),MAX:a=>Math.max(...a.map(num)),ABS:a=>Math.abs(num(a[0])),
 SUM:a=>a.reduce((s,v)=>s+num(v),0),SQRT:a=>Math.sqrt(num(a[0])),CEILING:a=>Math.ceil(num(a[0])),CEIL:a=>Math.ceil(num(a[0])),FLOOR:a=>Math.floor(num(a[0])),AND:a=>a.every(Boolean)?1:0,OR:a=>a.some(Boolean)?1:0,NOT:a=>a[0]?0:1};
function num(v){if(typeof v==='number')return v;if(v===''||v==null)return 0;const n=parseFloat(String(v).replace(/,/g,''));return isNaN(n)?0:n}
function qty(m){const r=measOf(m),o={length:0,area:0,volume:0,count:m.type==='count'?m.pts.length:1,value:r?r.v:0,depth:0,height:0,page:m.page,perimeter:0};
 if(r){const sc=r.sc,lu=sc.unit==='ftin'?0.3048:UNITS[sc.unit].m;if(r.kind==='len')o.length=r.v;if(r.kind==='area')o.area=r.v;if(r.kind==='count')o.value=r.v;
  if(r.extra&&r.extra.kind==='vol')o.volume=r.extra.v;if(r.extra&&(r.extra.kind==='warea'||r.extra.kind==='carea'))o.area=r.extra.v;
  if(['area','volume','perimeter'].includes(m.type)&&m.pts.length>2){o.perimeter=lenNum(polyLen(m.pts,true)*sc.perPt,sc);if(m.type==='perimeter')o.length=r.v}
  o.depth=m.depth>0?m.depth/lu:0;o.height=m.height>0?m.height/lu:0}return o}
function evalNode(n,m,depth){switch(n.k){case'n':return n.v;case's':return n.v;case'neg':return -num(evalNode(n.a,m,depth));
 case'id':{const key=n.name.toLowerCase(),q=qty(m);if(key in q)return q[key];const c=LP.cols.custom.find(c=>c.name.toLowerCase()===key||c.name.toLowerCase().replace(/\s+/g,'')===key);if(!c)throw new Error('Unknown name: '+n.name);return colValue(m,c,depth+1)}
 case'call':{if(n.name==='IF'){const c=evalNode(n.args[0],m,depth);return evalNode(truthy(c)?n.args[1]:n.args[2]||{k:'n',v:0},m,depth)}const f=FN[n.name];if(!f)throw new Error('Unknown function: '+n.name);return f(n.args.map(a=>evalNode(a,m,depth)))}
 case'bin':{const a=evalNode(n.a,m,depth),b=evalNode(n.b,m,depth);switch(n.op){case'+':return(typeof a==='string'&&isNaN(+a))||(typeof b==='string'&&isNaN(+b))?String(a)+String(b):num(a)+num(b);case'-':return num(a)-num(b);case'*':return num(a)*num(b);
  case'/':{const d=num(b);if(d===0)throw new Error('Divide by zero');return num(a)/d}case'%':return num(a)%num(b);case'^':return Math.pow(num(a),num(b));
  case'<':return cmpv(a,b)<0?1:0;case'>':return cmpv(a,b)>0?1:0;case'<=':return cmpv(a,b)<=0?1:0;case'>=':return cmpv(a,b)>=0?1:0;case'=':case'==':return cmpv(a,b)===0?1:0;case'!=':case'<>':return cmpv(a,b)!==0?1:0}}}
 throw new Error('Bad formula')}
const truthy=v=>typeof v==='string'?v!==''&&v!=='0':!!v;
function cmpv(a,b){const na=typeof a==='number'||!isNaN(parseFloat(a)),nb=typeof b==='number'||!isNaN(parseFloat(b));if(na&&nb){const x=num(a),y=num(b);return x<y?-1:x>y?1:0}const x=String(a).toLowerCase(),y=String(b).toLowerCase();return x<y?-1:x>y?1:0}
const parseCache=new Map();function compiled(src){if(!parseCache.has(src)){try{parseCache.set(src,{ast:parse(src)})}catch(e){parseCache.set(src,{err:e.message})}}return parseCache.get(src)}
function colValue(m,c,depth=0){if(c.type!=='formula'){const v=(m.cols||{})[c.id];return c.type==='number'?(v===''||v==null?'':num(v)):c.type==='checkbox'?(v?1:0):(v??'')}
 if(depth>8)throw new Error('Circular formula');const p=compiled(c.formula||'');if(p.err)throw new Error(p.err);return evalNode(p.ast,m,depth)}
function colDisplay(m,c){try{const v=colValue(m,c);if(c.type==='checkbox')return v?'☑':'☐';if(typeof v==='number'){const d=c.dec??2;return isFinite(v)?fmtNum(v,c.type==='number'&&c.dec==null&&Number.isInteger(v)?0:d):'#ERR'}return String(v)}catch(e){return'#ERR'}}
function colNumber(m,c){try{const v=colValue(m,c);return typeof v==='number'&&isFinite(v)?v:(c.type==='number'&&v!==''?num(v):null)}catch(e){return null}}
window.PMFormula={parse,evalFormula:(src,m)=>evalNode(parse(src),m,0),colValue};
/* ---------- filtering & sorting ---------- */
const FIELDS=[['subject','Subject',m=>m.subject||''],['status','Status',m=>m.status||'(none)'],['author','Author',m=>m.author||''],['page','Page',m=>String(m.page)],['type','Type',m=>T[m.type]?T[m.type].label:m.type],['space','Space',m=>spaceOf(m)||'(none)'],['color','Color',m=>(m.style.stroke||'').toLowerCase()]];
function passes(m){const f=LP.f;for(const[k,,get]of FIELDS)if(f[k]&&get(m)!==f[k])return false;if(f.ids&&!f.ids.includes(m.id))return false;if(f.checked==='yes'&&!m.checked)return false;if(f.checked==='no'&&m.checked)return false;return true}
const filtering=()=>Object.keys(LP.f).some(k=>LP.f[k]!==''&&LP.f[k]!=null);
const _lr=listRows;listRows=function(){let rows=_lr.apply(this,arguments).filter(({m})=>passes(m));const{k,dir}=S.listSort;
 if(k&&(k.startsWith('c:')||k==='check')){const c=k.startsWith('c:')?cdef(k.slice(2)):null;const key=({m})=>k==='check'?(m.checked?1:0):(()=>{if(!c)return'';const n=colNumber(m,c);return n!=null?n:String(colDisplay(m,c)).toLowerCase()})();
  rows.sort((a,b)=>{const x=key(a),y=key(b);return(x<y?-1:x>y?1:0)*dir||a.m.created-b.m.created})}return rows};
/* ---------- the list ---------- */
const _rl=renderList;
renderList=function(){const body=$('#mlBody');updHead();if(S.summary||!S.markups.length){_rl.apply(this,arguments);if(!S.summary)return;appendSummaryCustom(body);return}
 const rows=listRows(),cols=visibleCols(),{k,dir}=S.listSort;$('#mlCount').textContent=filtering()?`${rows.length} of ${S.markups.length}`:String(S.markups.length);
 const cell=(m,r,c)=>{switch(c){
  case'check':return`<td><input type="checkbox" data-ck="${m.id}" ${m.checked?'checked':''}></td>`;
  case'subject':return`<td>${esc(m.subject)}</td>`;case'page':return`<td class="num">${m.page}</td>`;case'space':return`<td>${esc(spaceOf(m))}</td>`;case'label':return`<td>${esc(m.label||m.text)}</td>`;
  case'measure':return`<td class="num">${r?esc(r.text+(r.extra?' · '+r.extra.text:'')):''}</td>`;case'comment':return`<td>${esc(m.comment)}${m.replies&&m.replies.length?` <small style="color:#7dd3fc">💬${m.replies.length}</small>`:''}</td>`;
  case'author':return`<td>${esc(m.author)}</td>`;case'date':return`<td>${esc(fmtDT(m.created))}</td>`;
  case'status':return`<td><span class="dot" style="background:${m.status?stColor(m.status):'transparent'};border-radius:50%"></span> <select class="lpst" data-st="${m.id}" style="background:transparent;border:0;color:inherit;font-size:12px">${STATUSES.map(s=>`<option value="${esc(s)}" ${s===(m.status||'')?'selected':''}>${esc(s||'—')}</option>`).join('')}</select></td>`;
  default:{const cd=cdef(c.slice(2));if(!cd)return'<td></td>';const isNum=cd.type==='number'||cd.type==='formula';return`<td class="${isNum?'num ':''}lpcc" data-cc="${cd.id}" data-mid="${m.id}" title="${cd.type==='formula'?'Formula: '+esc(cd.formula):'Double-click to edit'}">${esc(colDisplay(m,cd))}</td>`}}};
 const totals=cols.map(c=>{if(!c.startsWith('c:'))return null;const cd=cdef(c.slice(2));if(!cd||!['number','formula','checkbox'].includes(cd.type))return null;let s=0,any=false;for(const{m}of rows){const v=colNumber(m,cd);if(v!=null){s+=v;any=true}}return any?fmtNum(s,cd.dec??2):null});
 body.innerHTML=`<table class="ml"><thead><tr><th style="width:46px"></th>${cols.map(c=>`<th data-sort="${c}">${esc(colLabel(c))}${k===c?(dir>0?' ▲':' ▼'):''}</th>`).join('')}</tr></thead><tbody>${rows.map(({m,r})=>{
  const rr=`<tr data-id="${m.id}" class="${S.sel.has(m.id)?'sel':''}" style="${m.hidden?'opacity:.45':''}"><td style="white-space:nowrap"><span class="dot" style="background:${m.style.stroke}"></span><span data-exp="${m.id}" title="Replies" style="cursor:pointer;padding:0 3px;color:var(--mut)">${LP.expanded.has(m.id)?'▾':'▸'}</span><span data-eye="${m.id}" title="${m.hidden?'Show':'Hide'}" style="cursor:pointer">${m.hidden?'🚫':'👁'}</span>${m.locked?'<span title="Locked">🔒</span>':''}${m.group?'<span title="Grouped" style="color:#7dd3fc">⛓</span>':''}</td>${cols.map(c=>cell(m,r,c)).join('')}</tr>`;
  if(!LP.expanded.has(m.id))return rr;
  return rr+`<tr class="lprep"><td></td><td colspan="${cols.length}" style="white-space:normal;background:var(--bg)">${(m.replies||[]).map(x=>`<div style="margin:2px 0"><b>${esc(x.author)}</b> <small style="color:var(--mut)">${esc(fmtDT(x.at))}</small><br>${esc(x.text)}</div>`).join('')||'<span class="hint">No replies yet.</span>'}
   <div class="row" style="gap:6px;margin-top:4px"><input class="ti" data-rin="${m.id}" placeholder="Write a reply…"><button class="btn" data-rsend="${m.id}" style="flex:0;border:1px solid var(--line)">Reply</button></div>${(m.statusLog||[]).length?`<div class="hint" style="margin-top:4px">Status history: ${m.statusLog.map(x=>`${esc(x.status||'—')} (${esc(x.by)}, ${esc(fmtDT(x.at))})`).join(' → ')}</div>`:''}</td></tr>`}).join('')}</tbody>
  ${totals.some(Boolean)?`<tfoot><tr><td style="font-weight:600;padding:4px 8px">Total</td>${totals.map(t=>`<td class="num" style="font-weight:600;padding:4px 8px;border-top:1px solid var(--line)">${t??''}</td>`).join('')}</tr></tfoot>`:''}</table>`};
function appendSummaryCustom(body){const nums=LP.cols.custom.filter(c=>['number','formula','checkbox'].includes(c.type));if(!nums.length)return;const groups=summaryGroups();const tb=body.querySelector('table');if(!tb)return;
 tb.querySelectorAll('thead tr').forEach(tr=>tr.insertAdjacentHTML('beforeend',nums.map(c=>`<th>${esc(c.name)}</th>`).join('')));
 tb.querySelectorAll('tbody tr').forEach((tr,i)=>{const g=groups[i];tr.insertAdjacentHTML('beforeend',nums.map(c=>`<td class="num">${g?fmtNum(g.sums[c.id]||0,c.dec??2):''}</td>`).join(''))})}
function summaryGroups(){const g=new Map();for(const{m,r}of listRows()){const unit=r?r.unit:'—',kk=m.subject+'|'+(r?r.kind:'none')+'|'+unit;if(!g.has(kk))g.set(kk,{sums:{}});const o=g.get(kk);for(const c of LP.cols.custom){const v=colNumber(m,c);if(v!=null)o.sums[c.id]=(o.sums[c.id]||0)+v}}return[...g.values()]}
const uniq=(hdr,n)=>{let x=n,i=2;while(hdr.includes(x))x=n+(i===2?' (column)':' ('+i+')'),i++;return x};
const _td=tableData;tableData=function(){const out=_td.apply(this,arguments);const cs=LP.cols.custom;if(!cs.length)return out;
 if(S.summary){const nums=cs.filter(c=>['number','formula','checkbox'].includes(c.type)),gs=summaryGroups();nums.forEach(c=>out[0].push(uniq(out[0],c.name)));for(let i=1;i<out.length;i++){const g=gs[i-1];out[i].push(...nums.map(c=>g?+(g.sums[c.id]||0).toFixed(c.dec??2):''))}return out}
 out[0].push(uniq(out[0],'Checked'));cs.forEach(c=>out[0].push(uniq(out[0],c.name)));const rows=listRows();for(let i=1;i<out.length;i++){const m=rows[i-1]&&rows[i-1].m;out[i].push(m&&m.checked?'Yes':'',...cs.map(c=>{if(!m)return'';const n=colNumber(m,c);return n!=null&&c.type!=='checkbox'?+n.toFixed(c.dec??4):colDisplay(m,c)}))}return out};
/* list interactions (capture: handled before the row-select click) */
const mlb=$('#mlBody');
mlb.addEventListener('click',e=>{const t=e.target;
 if(t.matches('[data-ck],[data-st],[data-rin]')||t.closest('select.lpst')){e.stopPropagation();return}
 if(t.closest('.lpedit')){e.stopPropagation();return}
 const td=t.closest('td[data-cc]');if(td&&S.sel.size===1&&S.sel.has(td.dataset.mid)&&!td.querySelector('.lpedit')){e.stopPropagation();const c=cdef(td.dataset.cc),m=byId(td.dataset.mid);if(c&&m){if(c.type==='formula'){toast('Formula: '+c.formula);return}if(m.locked){toast('This markup is locked');return}editCell(td,m,c)}return}
 const x=t.closest('[data-exp],[data-eye],[data-rsend]');if(!x)return;e.stopPropagation();
 if(x.dataset.exp){const id=x.dataset.exp;LP.expanded.has(id)?LP.expanded.delete(id):LP.expanded.add(id);renderList();return}
 if(x.dataset.eye){const m=byId(x.dataset.eye);if(m){pushUndo();m.hidden=!m.hidden;if(m.hidden)S.sel.delete(m.id);commit()}return}
 if(x.dataset.rsend){addReply(x.dataset.rsend,$(`[data-rin="${x.dataset.rsend}"]`).value)}},true);
mlb.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.rin){addReply(e.target.dataset.rin,e.target.value)}});
mlb.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.ck){const m=byId(t.dataset.ck);if(m){pushUndo();m.checked=t.checked;m.modified=Date.now();commit()}}
 if(t.dataset.st){const m=byId(t.dataset.st);if(m){pushUndo();setStatus(m,t.value);commit()}}});
mlb.addEventListener('dblclick',e=>{const td=e.target.closest('td[data-cc]');if(!td||td.querySelector('.lpedit'))return;const c=cdef(td.dataset.cc),m=byId(td.dataset.mid);if(!c||!m)return;
 if(c.type==='formula'){toast('Formula: '+c.formula);return}if(m.locked){toast('This markup is locked');return}editCell(td,m,c)});
function editCell(td,m,c){const cur=(m.cols||{})[c.id];let el;
 if(c.type==='choice'){el=document.createElement('select');el.innerHTML=['',...(c.options||[])].map(o=>`<option ${o===cur?'selected':''}>${esc(o)}</option>`).join('')}
 else if(c.type==='checkbox'){pushUndo();m.cols=m.cols||{};m.cols[c.id]=!cur;m.modified=Date.now();commit();return}
 else{el=document.createElement('input');el.type=c.type==='number'?'number':c.type==='date'?'date':'text';if(c.type==='number')el.step='any';el.value=cur??''}
 el.className='ti lpedit';el.style.cssText='height:24px;padding:2px 4px;min-width:80px';td.innerHTML='';td.appendChild(el);el.focus();let done=false;
 const fin=ok=>{if(done)return;done=true;if(ok){const v=c.type==='number'?(el.value===''?'':+el.value):el.value;if(v!==(cur??'')){pushUndo();m.cols=m.cols||{};m.cols[c.id]=v;m.modified=Date.now()}}commit();renderList()};
 el.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')fin(true);if(e.key==='Escape')fin(false)});el.addEventListener('blur',()=>fin(true));if(c.type==='choice')el.addEventListener('change',()=>fin(true))}
function addReply(id,text){text=String(text||'').trim();const m=byId(id);if(!m||!text)return;pushUndo();m.replies=m.replies||[];m.replies.push({author:settings.author,text,at:Date.now()});m.modified=Date.now();LP.expanded.add(id);commit();renderList();if($('#props').contains(document.activeElement)||S.sel.has(id))renderProps()}
function setStatus(m,v){if((m.status||'')===(v||''))return;m.status=v;m.statusLog=m.statusLog||[];m.statusLog.push({status:v,by:settings.author,at:Date.now()});m.modified=Date.now()}
const _ap=applyProp;applyProp=function(f,v){if(f==='status'){const sel=[...S.sel].map(byId).filter(Boolean);const before=sel.map(m=>m.status||'');const r=_ap.apply(this,arguments);sel.forEach((m,i)=>{if((m.status||'')!==before[i]){m.statusLog=m.statusLog||[];m.statusLog.push({status:m.status,by:settings.author,at:Date.now()})}});return r}return _ap.apply(this,arguments)};
/* ---------- list header controls ---------- */
function updHead(){const h=$('.mlhead');if(!h)return;if(!$('#lpCols')){const sum=$('#mlSum');sum.insertAdjacentHTML('beforebegin','<button class="btn" id="lpFilt" title="Filter markups">Filter</button><button class="btn" id="lpCols" title="Columns">Columns</button><button class="btn" id="lpStat" title="Statuses">Statuses</button>');
  $('#lpFilt').onclick=filterDialog;$('#lpCols').onclick=columnsDialog;$('#lpStat').onclick=statusDialog}
 const on=filtering();$('#lpFilt').classList.toggle('on',on);$('#lpFilt').textContent=on?'Filter ✕':'Filter';$('#lpFilt').title=on?'Filter active — click to change':'Filter markups'}
function filterDialog(){const vals=k=>[...new Set(S.markups.map(m=>FIELDS.find(f=>f[0]===k)[2](m)))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
 modal('Filter markups',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${FIELDS.map(([k,l])=>`<div><label style="font-size:11px;color:var(--mut)">${l}</label><select class="ti" data-lf="${k}"><option value="">All</option>${vals(k).map(v=>`<option ${LP.f[k]===v?'selected':''} value="${esc(v)}">${k==='color'?'■ ':''}${esc(v)}</option>`).join('')}</select></div>`).join('')}
  <div><label style="font-size:11px;color:var(--mut)">Checked</label><select class="ti" data-lf="checked"><option value="">All</option><option value="yes" ${LP.f.checked==='yes'?'selected':''}>Checked</option><option value="no" ${LP.f.checked==='no'?'selected':''}>Not checked</option></select></div></div>
 <label class="chk" style="margin-top:8px"><input type="checkbox" id="lfSel" ${LP.f.ids?'checked':''}> Only the selected markups (${S.sel.size})</label>
 <div class="sec">Saved filters</div><div class="row" style="gap:6px"><select class="ti" id="lfSaved">${LP.filters.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('')||'<option value="">None saved</option>'}</select><button class="btn" id="lfLoad" style="flex:0;border:1px solid var(--line)">Apply</button><button class="btn" id="lfDel" style="flex:0;border:1px solid var(--line)">Delete</button></div>
 <div class="row" style="gap:6px;margin-top:6px"><input class="ti" id="lfName" placeholder="Name this filter"><button class="btn" id="lfSave" style="flex:0;border:1px solid var(--line)">Save</button></div>`,
 [{label:'Clear filter',fn:()=>{LP.f={};renderList()}},{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{readFilter(md);renderList()}}]);
 const md=$('#modal');$('#lfSave').onclick=()=>{const n=$('#lfName').value.trim();if(!n)return;readFilter(md);const f=clone(LP.f);delete f.ids;LP.filters=LP.filters.filter(x=>x.name!==n);LP.filters.push({name:n,f});LS.set('pm:filters',LP.filters);closeModal();renderList();toast('Filter "'+n+'" saved')};
 $('#lfLoad').onclick=()=>{const x=LP.filters[+$('#lfSaved').value];if(!x)return;LP.f=clone(x.f);closeModal();renderList()};
 $('#lfDel').onclick=()=>{const i=+$('#lfSaved').value;if(!LP.filters[i])return;LP.filters.splice(i,1);LS.set('pm:filters',LP.filters);closeModal();filterDialog()}}
function readFilter(md){const f={};md.querySelectorAll('[data-lf]').forEach(s=>{if(s.value)f[s.dataset.lf]=s.value});if(md.querySelector('#lfSel').checked)f.ids=[...S.sel];LP.f=f}
function columnsDialog(){const order=colOrder();
 modal('Markups list columns',`<div class="hint" style="margin-bottom:6px">Show, hide and reorder columns. Custom columns hold your own data — numbers, choices, dates, checkboxes, or formulas like <code>[Area]*[Depth]/27</code> or <code>IF(Area&gt;100,"Large","Small")</code>.</div>
 <div id="lcList">${order.map((k,i)=>{const c=k.startsWith('c:')?cdef(k.slice(2)):null;return`<div class="row" data-k="${k}" style="gap:6px;padding:3px 0;border-bottom:1px solid #30363f"><label class="chk" style="flex:1"><input type="checkbox" data-show="${k}" ${LP.cols.hidden.includes(k)?'':'checked'}> ${esc(colLabel(k))} ${c?`<small style="color:var(--mut)">(${c.type}${c.type==='formula'?': '+esc(c.formula):''})</small>`:''}</label>
  <button class="btn" data-up="${i}" style="flex:0;padding:0 6px" ${i===0?'disabled':''}>↑</button><button class="btn" data-dn="${i}" style="flex:0;padding:0 6px" ${i===order.length-1?'disabled':''}>↓</button>${c?`<button class="btn" data-ed="${c.id}" style="flex:0;padding:0 6px">Edit</button><button class="btn" data-rm="${c.id}" style="flex:0;padding:0 6px">✕</button>`:''}</div>`}).join('')}</div>
 <div class="row" style="margin-top:10px"><button class="btn pri" id="lcAdd" style="flex:0">+ Add custom column</button></div>`,[{label:'Done',cancel:1}]);
 const md=$('#modal');md.querySelector('#lcList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const o=colOrder();
  if(b.dataset.up){const i=+b.dataset.up;[o[i-1],o[i]]=[o[i],o[i-1]];LP.cols.order=o;saveCols();columnsDialog();renderList()}
  if(b.dataset.dn){const i=+b.dataset.dn;[o[i+1],o[i]]=[o[i],o[i+1]];LP.cols.order=o;saveCols();columnsDialog();renderList()}
  if(b.dataset.ed)colEditDialog(cdef(b.dataset.ed));if(b.dataset.rm){LP.cols.custom=LP.cols.custom.filter(c=>c.id!==b.dataset.rm);saveCols();columnsDialog();renderList()}});
 md.querySelector('#lcList').addEventListener('change',e=>{const k=e.target.dataset.show;if(!k)return;LP.cols.hidden=LP.cols.hidden.filter(x=>x!==k);if(!e.target.checked)LP.cols.hidden.push(k);saveCols();renderList()});
 $('#lcAdd').onclick=()=>colEditDialog(null)}
function colEditDialog(c){const isNew=!c;c=c||{id:'k'+Date.now().toString(36),name:'',type:'text',options:[],formula:'',dec:2};
 modal(isNew?'Add column':'Edit column',`<div class="fld"><label>Name</label><input class="ti" id="ceN" value="${esc(c.name)}" placeholder="e.g. Unit Cost"></div>
 <div class="fld"><label>Type</label><select class="ti" id="ceT">${[['text','Text'],['number','Number'],['choice','Choice (pick from a list)'],['date','Date'],['checkbox','Checkbox'],['formula','Formula']].map(([v,l])=>`<option value="${v}" ${c.type===v?'selected':''}>${l}</option>`).join('')}</select></div>
 <div class="fld" id="ceOw"><label>Choices (comma separated)</label><input class="ti" id="ceO" value="${esc((c.options||[]).join(', '))}"></div>
 <div class="fld" id="ceFw"><label>Formula</label><input class="ti" id="ceF" value="${esc(c.formula||'')}" placeholder="[Area] * [Unit Cost]"><div class="hint" style="margin-top:4px">Use other column names in [brackets] and Length, Area, Volume, Perimeter, Count, Value, Depth, Height, Page. Functions: ROUND(x,n) MIN MAX ABS SUM SQRT CEILING FLOOR IF(test,a,b) AND OR NOT. Compare with &lt; &gt; = &lt;&gt;.</div><div id="ceErr" style="color:#fca5a5;font-size:12px"></div></div>
 <div class="fld" id="ceDw"><label>Decimals</label><input class="ti" type="number" min="0" max="6" id="ceD" value="${c.dec??2}"></div>`,
 [{label:'Cancel',cancel:1,fn:()=>{setTimeout(columnsDialog,0)}},{label:isNew?'Add':'Save',pri:1,fn:md=>{const n=md.querySelector('#ceN').value.trim(),t=md.querySelector('#ceT').value;if(!n){toast('Give the column a name');return false}
  if(LP.cols.custom.some(x=>x.id!==c.id&&x.name.toLowerCase()===n.toLowerCase())||BUILTIN.some(b=>b[1].toLowerCase()===n.toLowerCase())){toast('A column with that name already exists');return false}
  if(t==='formula'){const f=md.querySelector('#ceF').value.trim();try{parse(f)}catch(e){md.querySelector('#ceErr').textContent=e.message;return false}c.formula=f;parseCache.delete(f)}
  c.name=n;c.type=t;c.options=md.querySelector('#ceO').value.split(',').map(s=>s.trim()).filter(Boolean);c.dec=Math.max(0,Math.min(6,+md.querySelector('#ceD').value||0));
  if(isNew)LP.cols.custom.push(c);saveCols();renderList();renderProps();setTimeout(columnsDialog,0)}}]);
 const sw=()=>{const t=$('#ceT').value;$('#ceOw').style.display=t==='choice'?'':'none';$('#ceFw').style.display=t==='formula'?'':'none';$('#ceDw').style.display=['number','formula'].includes(t)?'':'none'};$('#ceT').onchange=sw;sw()}
function statusDialog(){modal('Statuses',`<div class="hint" style="margin-bottom:6px">Your status list (used in the Markups list and Properties). Statuses follow your login.</div>
 <div id="sdL">${LP.statuses.map((s,i)=>`<div class="row" style="gap:6px;margin-bottom:4px"><input type="color" data-sc="${i}" value="${s.color}" style="flex:0 0 40px"><input class="ti" data-sn="${i}" value="${esc(s.name)}"><button class="btn" data-su="${i}" style="flex:0;padding:0 6px">↑</button><button class="btn" data-sx="${i}" style="flex:0;padding:0 6px">✕</button></div>`).join('')}</div>
 <div class="row" style="gap:6px;margin-top:6px"><button class="btn" id="sdAdd" style="border:1px solid var(--line)">+ Add status</button><button class="btn" id="sdReset" style="border:1px solid var(--line)">Reset to defaults</button></div>
 ${S.sel.size?`<div class="sec">Set status for ${S.sel.size} selected</div><div class="row" style="gap:4px;flex-wrap:wrap">${LP.statuses.map(s=>`<button class="btn" data-set="${esc(s.name)}" style="border:1px solid ${s.color}">${esc(s.name)}</button>`).join('')}<button class="btn" data-set="" style="border:1px solid var(--line)">None</button></div>`:''}`,
 [{label:'Close',cancel:1,fn:md=>{readStatuses(md)}}]);
 const md=$('#modal');md.querySelector('#sdL').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;readStatuses(md);if(b.dataset.sx){LP.statuses.splice(+b.dataset.sx,1)}if(b.dataset.su&&+b.dataset.su>0){const i=+b.dataset.su;[LP.statuses[i-1],LP.statuses[i]]=[LP.statuses[i],LP.statuses[i-1]]}saveStatuses();statusDialog();renderList()});
 $('#sdAdd').onclick=()=>{readStatuses(md);LP.statuses.push({name:'New status',color:'#64748b'});saveStatuses();statusDialog()};
 $('#sdReset').onclick=()=>{LP.statuses=clone(DEF_STATUSES);saveStatuses();statusDialog();renderList()};
 md.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>{readStatuses(md);setStatusSel(b.dataset.set);closeModal()})}
function readStatuses(md){const out=[];md.querySelectorAll('[data-sn]').forEach(inp=>{const i=+inp.dataset.sn,n=inp.value.trim();if(n)out.push({name:n,color:md.querySelector(`[data-sc="${i}"]`).value})});if(out.length){LP.statuses=out;saveStatuses();renderList()}}
function setStatusSel(v){const ms=[...S.sel].map(byId).filter(Boolean);if(!ms.length)return;pushUndo();ms.forEach(m=>setStatus(m,v));commit();renderProps();toast(`Status set on ${ms.length}`)}
/* ---------- Properties: lock/hide/group, custom fields, replies, history ---------- */
H.props.push((m,mode)=>{if(mode!=='sel'||!m)return'';const sel=[...S.sel].map(byId).filter(Boolean),cs=LP.cols.custom;
 let h=`<div class="row" style="gap:4px;flex-wrap:wrap;margin:2px 0 10px">${[['lock',m.locked?'🔓 Unlock':'🔒 Lock'],['hide','🚫 Hide'],[m.group?'ungroup':'group',m.group?'Ungroup':'Group'],['painter','🖌 Format Painter']].map(([a,l])=>`<button class="btn" data-lp="${a}" style="border:1px solid var(--line);height:26px;padding:0 7px" ${a==='group'&&sel.length<2?'disabled':''}>${l}</button>`).join('')}</div>`;
 if(m.locked)h+=`<div class="hint" style="color:#fbbf24;margin-bottom:8px">Locked — can't be moved, reshaped or deleted.</div>`;
 if(cs.length){h+=`<div class="sec">Custom fields</div>`;for(const c of cs){const v=(m.cols||{})[c.id]??'';
  if(c.type==='formula')h+=`<div class="fld"><label>${esc(c.name)} <small>(formula)</small></label><div class="ti" style="opacity:.85">${esc(colDisplay(m,c))}</div></div>`;
  else if(c.type==='choice')h+=`<div class="fld"><label>${esc(c.name)}</label><select class="ti" data-cf="${c.id}">${['',...c.options].map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  else if(c.type==='checkbox')h+=`<label class="chk fld"><input type="checkbox" data-cf="${c.id}" ${v?'checked':''}> ${esc(c.name)}</label>`;
  else h+=`<div class="fld"><label>${esc(c.name)}</label><input class="ti" data-cf="${c.id}" type="${c.type==='number'?'number':c.type==='date'?'date':'text'}" ${c.type==='number'?'step="any"':''} value="${esc(v)}"></div>`}}
 h+=`<div class="sec">Replies (${(m.replies||[]).length})</div>${(m.replies||[]).map(x=>`<div style="font-size:12px;margin-bottom:4px"><b>${esc(x.author)}</b> <small style="color:var(--mut)">${esc(fmtDT(x.at))}</small><br>${esc(x.text)}</div>`).join('')}<div class="row" style="gap:6px;margin-bottom:8px"><input class="ti" id="lpRep" placeholder="Reply…"><button class="btn" id="lpRepGo" style="flex:0;border:1px solid var(--line)">Reply</button></div>`;
 if((m.statusLog||[]).length)h+=`<div class="hint" style="margin-bottom:8px">Status history: ${m.statusLog.map(x=>`${esc(x.status||'—')} <small>(${esc(x.by)} ${esc(fmtDT(x.at))})</small>`).join(' → ')}</div>`;
 return h});
const props=$('#props');
props.addEventListener('click',e=>{const b=e.target.closest('[data-lp]');if(b){e.stopPropagation();cmd(b.dataset.lp);return}if(e.target.id==='lpRepGo'){const m=byId([...S.sel][0]);if(m)addReply(m.id,$('#lpRep').value)}},true);
props.addEventListener('keydown',e=>{if(e.target.id==='lpRep'&&e.key==='Enter'){const m=byId([...S.sel][0]);if(m)addReply(m.id,e.target.value)}});
props.addEventListener('change',e=>{const id=e.target.dataset.cf;if(!id)return;const c=cdef(id);const sel=[...S.sel].map(byId).filter(Boolean);if(!c||!sel.length)return;pushUndo();
 const v=c.type==='checkbox'?e.target.checked:c.type==='number'?(e.target.value===''?'':+e.target.value):e.target.value;sel.forEach(m=>{m.cols=m.cols||{};m.cols[id]=v;m.modified=Date.now()});commit();renderList()});
/* ---------- lock / hide / group ---------- */
const _ho=handlesOf;handlesOf=function(m){return m&&m.locked?[]:_ho.apply(this,arguments)};
const _ds=delSel;delSel=function(){const lk=[...S.sel].map(byId).filter(m=>m&&m.locked);if(lk.length){lk.forEach(m=>S.sel.delete(m.id));toast(lk.length+' locked markup'+(lk.length>1?'s':'')+' not deleted')}return _ds.apply(this,arguments)};
const _ea=eraseAt;eraseAt=function(x,y,g){const el=document.elementFromPoint(x,y),mk=el&&el.closest&&el.closest('.mk');const m=mk&&byId(mk.dataset.id);if(m&&m.locked)return;return _ea.apply(this,arguments)};
const _ss=setSel;setSel=function(ids,quiet){const out=new Set(ids);for(const id of ids){const m=byId(id);if(m&&m.group)for(const x of S.markups)if(x.group===m.group&&!x.hidden)out.add(x.id)}return _ss.call(this,[...out].filter(id=>{const m=byId(id);return m&&!m.hidden}),quiet)};
// after the core starts a move, leave locked markups where they are
viewer.addEventListener('pointerdown',()=>{if(typeof G!=='undefined'&&G){if(G.k==='move'&&G.orig){for(const id of[...G.orig.keys()]){const m=byId(id);if(m&&m.locked)G.orig.delete(id)}}if(G.k==='handle'&&G.m&&G.m.locked)G=null}});
function cmd(a){const sel=[...S.sel].map(byId).filter(Boolean);
 switch(a){
 case'lock':{if(!sel.length)return toast('Select markups first');const to=!sel.every(m=>m.locked);pushUndo();sel.forEach(m=>{m.locked=to;m.modified=Date.now()});commit();renderProps();toast(to?'Locked':'Unlocked');break}
 case'hide':{if(!sel.length)return;pushUndo();sel.forEach(m=>m.hidden=true);S.sel.clear();commit();renderProps();toast('Hidden — show again from the Markups list (eye icon)');break}
 case'showall':{pushUndo();S.markups.forEach(m=>m.hidden=false);commit();break}
 case'hidesubject':{if(!sel.length)return;const subs=new Set(sel.map(m=>m.subject));pushUndo();S.markups.forEach(m=>{if(subs.has(m.subject))m.hidden=true});S.sel.clear();commit();renderProps();break}
 case'group':{if(sel.length<2)return toast('Select two or more markups');const g='g'+uid();pushUndo();sel.forEach(m=>m.group=g);commit();renderProps();toast('Grouped '+sel.length);break}
 case'ungroup':{if(!sel.length)return;pushUndo();sel.forEach(m=>delete m.group);commit();renderProps();toast('Ungrouped');break}
 case'painter':{const m=sel[0];if(!m)return toast('Select a markup to copy its look');LP.painter=clone(m.style);if(S.tool!=='select')setTool('select');viewer.style.cursor='copy';$('#hint').textContent='Format Painter: click markups to apply the style · Esc to stop';toast('Format Painter on — click markups to apply');break}
 case'lasso':{if(S.tool!=='select')setTool('select');LP.lasso.on=true;$('#hint').textContent='Lasso: drag a loop around markups to select them · Esc to stop';toast('Lasso: drag around markups');break}
 case'samesubject':{const subs=new Set(sel.map(m=>m.subject));setSel(S.markups.filter(m=>subs.has(m.subject)&&!m.hidden).map(m=>m.id));break}
 case'sametype':{const ty=new Set(sel.map(m=>m.type));setSel(S.markups.filter(m=>ty.has(m.type)&&m.page===S.cur&&!m.hidden).map(m=>m.id));break}
 case'invert':{setSel(S.markups.filter(m=>m.page===S.cur&&!m.hidden&&!S.sel.has(m.id)).map(m=>m.id));break}
 case'forward':case'backward':{if(!sel.length)return;pushUndo();const arr=S.markups;const idx=sel.map(m=>arr.indexOf(m)).sort((x,y)=>a==='forward'?y-x:x-y);
  for(const i of idx){const m=arr[i];let j=i+(a==='forward'?1:-1);while(j>=0&&j<arr.length&&arr[j].page!==m.page)j+=a==='forward'?1:-1;if(j<0||j>=arr.length||S.sel.has(arr[j].id))continue;arr.splice(i,1);arr.splice(j,0,m)}commit();break}
 case'front':reorder(true);break;case'back':reorder(false);break;
 case'rotcw':case'rotccw':case'fliph':case'flipv':transformSel(a);break;
 }}
function transformSel(a){const sel=[...S.sel].map(byId).filter(m=>m&&!m.locked);if(!sel.length)return toast('Select (unlocked) markups first');pushUndo();
 const B=sel.map(bboxOf).reduce((b,x)=>[Math.min(b[0],x[0]),Math.min(b[1],x[1]),Math.max(b[2],x[2]),Math.max(b[3],x[3])]);const cx=(B[0]+B[2])/2,cy=(B[1]+B[3])/2;
 const f=a==='rotcw'?(p=>[cx-(p[1]-cy),cy+(p[0]-cx)]):a==='rotccw'?(p=>[cx+(p[1]-cy),cy-(p[0]-cx)]):a==='fliph'?(p=>[2*cx-p[0],p[1]]):(p=>[p[0],2*cy-p[1]]);
 for(const m of sel){if(['stamp','note','symbol','typewriter','legend'].includes(m.type)&&sel.length===1)continue;m.pts=m.pts.map(f);if(m.holes)m.holes=m.holes.map(h=>h.map(f));if(m.rects)m.rects=m.rects.map(r=>{const q=[f([r[0],r[1]]),f([r[2],r[3]])];return normBox(q[0],q[1])});m.modified=Date.now()}commit()}
/* ---------- format painter & lasso (pointer) ---------- */
H.down=(prev=>(e,p,pt)=>{
 if(LP.painter&&p){const mk=e.target.closest&&e.target.closest('.mk');if(mk){const m=byId(mk.dataset.id);if(m&&!m.locked){pushUndo();const keep={headS:m.style.headS,headE:m.style.headE};m.style=Object.assign({},clone(LP.painter));if(['line','arrow','polyline','dimension'].includes(m.type)){}m.modified=Date.now();commit()}}return true}
 if(LP.lasso.on&&p){LP.lasso.drag=true;LP.lasso.page=p.num;LP.lasso.pts=[pt];return true}
 return prev?prev(e,p,pt):false})(H.down);
window.addEventListener('pointermove',e=>{const L=LP.lasso;if(!L.drag)return;const p=S.pages[L.page-1];if(!p)return;const q=toPt(e,p),last=L.pts[L.pts.length-1];if(dist(q,last)*S.zoom>2){L.pts.push(q);redrawPage(L.page)}});
window.addEventListener('pointerup',()=>{const L=LP.lasso;if(!L.drag)return;L.drag=false;const P=L.pts;
 const inside=c=>{let r=false;for(let i=0,j=P.length-1;i<P.length;j=i++){if((P[i][1]>c[1])!==(P[j][1]>c[1])&&c[0]<(P[j][0]-P[i][0])*(c[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])r=!r}return r};
 if(P.length>2){const ids=S.markups.filter(m=>m.page===L.page&&!m.hidden&&(()=>{const b=bboxOf(m);return inside([(b[0]+b[2])/2,(b[1]+b[3])/2])})()).map(m=>m.id);L.pts=[];setSel(ids);toast(`Lasso selected ${ids.length}`)}else{L.pts=[];redrawPage(L.page)}});
H.over.push(n=>{const L=LP.lasso;if(!L.drag||L.page!==n||L.pts.length<2)return'';return`<path d="${dPoly(L.pts,true)}" fill="rgba(61,139,253,.08)" stroke="#3d8bfd" stroke-width="${1.2/S.zoom}" stroke-dasharray="${4/S.zoom}" pointer-events="none"/>`});
function endModes(){let any=false;if(LP.painter){LP.painter=null;viewer.style.cursor='';any=true}if(LP.lasso.on){LP.lasso={on:false,drag:false,pts:[],page:0};any=true}if(any){updateRibbon();toast('Done')}return any}
const _st=setTool;setTool=function(){if(LP.painter||LP.lasso.on){LP.painter=null;viewer.style.cursor='';LP.lasso={on:false,drag:false,pts:[],page:0}}return _st.apply(this,arguments)};
/* ---------- custom keyboard shortcuts ---------- */
const NEWDEF={lock:'Ctrl+L',group:'Ctrl+G',ungroup:'Ctrl+Shift+G',painter:'Ctrl+Shift+C',lasso:'Shift+L'};
function commands(){const tools=Object.keys(T).filter(k=>!['calibrate','dfill','legend'].includes(k)||true).map(k=>({id:'tool:'+k,label:'Tool: '+T[k].label,def:normCombo(KEYS[k]||''),run:()=>{if(k==='stamp')stampPicker();else if(k==='image')imagePicker();else if(k==='symbol'&&H.symbolPicker)H.symbolPicker();else setTool(k)}}));
 const c=(id,label,def,run)=>({id,label,def:normCombo(def),run});
 return[...tools,c('undo','Undo','Ctrl+Z',undo),c('redo','Redo','Ctrl+Y',redo),c('delete','Delete selected','Delete',()=>delSel()),c('copy','Copy','Ctrl+C',copySel),c('paste','Paste','Ctrl+V',()=>paste(false)),c('duplicate','Duplicate','Ctrl+D',()=>paste(true)),
  c('selectall','Select all on page','Ctrl+A',()=>{if(S.tool!=='select')setTool('select');setSel(S.markups.filter(m=>m.page===S.cur).map(m=>m.id))}),c('save','Save PDF','Ctrl+S',()=>exportPDF(false)),c('open','Open PDF','Ctrl+O',()=>$('#fileIn').click()),c('find','Search','Ctrl+F',()=>switchTab('search')),
  c('zoomin','Zoom in','Ctrl+=',()=>zoomBy(1.25)),c('zoomout','Zoom out','Ctrl+-',()=>zoomBy(.8)),c('fitpage','Fit page','Ctrl+0',fitPage),c('fitwidth','Fit width','',fitWidth),c('nextpage','Next page','PageDown',()=>gotoPage(S.cur+1)),c('prevpage','Previous page','PageUp',()=>gotoPage(S.cur-1)),
  c('lock','Lock / unlock','Ctrl+L',()=>cmd('lock')),c('group','Group','Ctrl+G',()=>cmd('group')),c('ungroup','Ungroup','Ctrl+Shift+G',()=>cmd('ungroup')),c('painter','Format Painter','Ctrl+Shift+C',()=>cmd('painter')),c('lasso','Lasso select','Shift+L',()=>cmd('lasso')),
  c('samesubject','Select same subject','',()=>cmd('samesubject')),c('invert','Invert selection','',()=>cmd('invert')),c('forward','Bring forward','Ctrl+]',()=>cmd('forward')),c('backward','Send backward','Ctrl+[',()=>cmd('backward')),
  c('rotcw','Rotate 90° clockwise','',()=>cmd('rotcw')),c('fliph','Flip horizontal','',()=>cmd('fliph')),c('scale','Set scale','',()=>scaleDialog()),c('columns','Markups list columns','',columnsDialog),c('filter','Filter markups','',filterDialog),c('shortcuts','Keyboard shortcuts','',shortcutsDialog)]}
function normCombo(s){if(!s)return'';const parts=String(s).split('+').map(x=>x.trim()).filter(Boolean);const mods=['Ctrl','Alt','Shift'].filter(m=>parts.some(p=>p.toLowerCase()===m.toLowerCase()));const key=parts.filter(p=>!['ctrl','alt','shift','cmd','meta'].includes(p.toLowerCase())).pop()||'';return[...mods,key.length===1?key.toUpperCase():key].join('+')}
function comboOf(e){const c=e.code||'';let key=c.startsWith('Key')?c.slice(3):c.startsWith('Digit')?c.slice(5):c==='Space'?'Space':c==='Equal'?'=':c==='Minus'?'-':c==='BracketRight'?']':c==='BracketLeft'?'[':c.startsWith('Numpad')?c:(e.key&&e.key.length===1?e.key.toUpperCase():e.key);
 if(['Control','Shift','Alt','Meta'].includes(e.key))return'';const m=[];if(e.ctrlKey||e.metaKey)m.push('Ctrl');if(e.altKey)m.push('Alt');if(e.shiftKey)m.push('Shift');return[...m,key].join('+')}
const customKeys=()=>LS.get('pm:keys',{});
function binding(){const map=new Map(),ck=customKeys(),list=commands();for(const c of list){const k=ck[c.id]!==undefined?ck[c.id]:(NEWDEF[c.id]||null);if(k)map.set(k,c)}return map}
let recording=null;
document.addEventListener('keydown',e=>{
 if(recording){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){recording.done(null);return}const c=comboOf(e);if(c)recording.done(c);return}
 if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(modalCb)return;
 if(e.key==='Escape'&&endModes()){e.preventDefault();e.stopImmediatePropagation();return}
 if(!S.pages.length)return;
 if(e.key.startsWith('Arrow')&&S.sel.size&&[...S.sel].some(id=>(byId(id)||{}).locked)){e.preventDefault();e.stopImmediatePropagation();const st=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,dy=e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0;if(!e.repeat)pushUndo();for(const id of S.sel){const m=byId(id);if(m&&!m.locked)m.pts=m.pts.map(p=>[p[0]+dx,p[1]+dy])}commit();return}
 const c=comboOf(e);if(!c)return;const hit=binding().get(c);if(hit){e.preventDefault();e.stopImmediatePropagation();hit.run()}},true);
function shortcutsDialog(){const ck=customKeys(),list=commands();
 modal('Keyboard shortcuts',`<div class="hint" style="margin-bottom:6px">Click a shortcut to change it, then press the new key combination (Esc cancels). Your shortcuts follow your login.</div><input class="ti" id="kbQ" placeholder="Find a command…" style="margin-bottom:6px">
 <div id="kbL" style="max-height:52vh;overflow:auto">${list.map(c=>{const cur=ck[c.id]!==undefined?ck[c.id]:(NEWDEF[c.id]||c.def);return`<div class="row kbrow" data-q="${esc(c.label.toLowerCase())}" style="padding:3px 0;border-bottom:1px solid #30363f"><span style="flex:2">${esc(c.label)}</span><button class="btn" data-kb="${c.id}" style="flex:1;border:1px solid var(--line);justify-content:center">${esc(cur||'—')}</button>${ck[c.id]!==undefined?`<button class="btn" data-kr="${c.id}" title="Back to default" style="flex:0;padding:0 6px">↺</button>`:''}</div>`}).join('')}</div>`,
 [{label:'Reset all',fn:()=>{LS.set('pm:keys',{});toast('Shortcuts reset')}},{label:'Close',cancel:1}]);
 $('#kbQ').oninput=e=>{const q=e.target.value.toLowerCase();$$('#kbL .kbrow').forEach(r=>r.style.display=r.dataset.q.includes(q)?'':'none')};
 $('#kbL').onclick=e=>{const r=e.target.closest('[data-kr]');if(r){const k=customKeys();delete k[r.dataset.kr];LS.set('pm:keys',k);shortcutsDialog();return}
  const b=e.target.closest('[data-kb]');if(!b)return;b.textContent='Press keys…';recording={done:combo=>{recording=null;if(combo){const k=customKeys();for(const id in k)if(k[id]===combo&&id!==b.dataset.kb)k[id]='';const clash=list.find(c=>c.id!==b.dataset.kb&&(k[c.id]===undefined?(NEWDEF[c.id]||c.def):k[c.id])===combo);k[b.dataset.kb]=combo;if(clash&&k[clash.id]===undefined)k[clash.id]='';LS.set('pm:keys',k);if(clash)toast(`${combo} moved from "${clash.label}"`)}shortcutsDialog()}}}}
/* ---------- Edit menu (ribbon) ---------- */
function editDialog(){const n=S.sel.size,b=(a,l,dis)=>`<button class="btn" data-ec="${a}" style="border:1px solid var(--line)" ${dis?'disabled':''}>${l}</button>`;
 modal('Edit markups',`<div class="hint" style="margin-bottom:6px">${n} selected</div>
 <div class="sec" style="margin-top:0">Protect & visibility</div><div class="row" style="gap:4px;flex-wrap:wrap">${b('lock','Lock / Unlock',!n)}${b('hide','Hide',!n)}${b('hidesubject','Hide this subject',!n)}${b('showall','Show all')}</div>
 <div class="sec">Group & style</div><div class="row" style="gap:4px;flex-wrap:wrap">${b('group','Group',n<2)}${b('ungroup','Ungroup',!n)}${b('painter','Format Painter',!n)}</div>
 <div class="sec">Select</div><div class="row" style="gap:4px;flex-wrap:wrap">${b('lasso','Lasso')}${b('samesubject','Same subject',!n)}${b('sametype','Same type (page)',!n)}${b('invert','Invert (page)')}</div>
 <div class="sec">Arrange</div><div class="row" style="gap:4px;flex-wrap:wrap">${b('front','To front',!n)}${b('forward','Forward',!n)}${b('backward','Backward',!n)}${b('back','To back',!n)}${b('rotcw','Rotate 90° ↻',!n)}${b('rotccw','Rotate 90° ↺',!n)}${b('fliph','Flip ↔',!n)}${b('flipv','Flip ↕',!n)}</div>
 <div class="sec">Status</div><div class="row" style="gap:4px;flex-wrap:wrap">${LP.statuses.map(s=>`<button class="btn" data-es="${esc(s.name)}" style="border:1px solid ${s.color}" ${!n?'disabled':''}>${esc(s.name)}</button>`).join('')}</div>
 <div class="sec">Setup</div><div class="row" style="gap:4px;flex-wrap:wrap">${b('x:columns','Columns…')}${b('x:filter','Filter…')}${b('x:statuses','Statuses…')}${b('x:keys','Keyboard shortcuts…')}</div>`,[{label:'Close',cancel:1}]);
 $('#modal').onclick=e=>{const x=e.target.closest('[data-ec],[data-es]');if(!x)return;if(x.dataset.es!==undefined){closeModal();setStatusSel(x.dataset.es);return}const a=x.dataset.ec;closeModal();
  if(a==='x:columns')columnsDialog();else if(a==='x:filter')filterDialog();else if(a==='x:statuses')statusDialog();else if(a==='x:keys')shortcutsDialog();else cmd(a)}}
H.ribbon.push({label:'Edit',title:'Lock, group, format painter, lasso, arrange, statuses, columns, shortcuts',icon:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',fn:editDialog});
// statuses may appear on imported markups
H.open.push(()=>{syncStatusList();LP.f={};LP.expanded.clear()});
H.prefs.push(()=>{LP.cols=Object.assign({custom:[],hidden:[],order:null},LS.get('pm:cols',{}));LP.statuses=LS.get('pm:statuses',null)||clone(DEF_STATUSES);LP.filters=LS.get('pm:filters',[]);syncStatusList();renderList()});
window.PMListPro={LP,cmd,columnsDialog,filterDialog,statusDialog,shortcutsDialog,editDialog,setStatusSel,addReply,colDisplay,binding};
})();
