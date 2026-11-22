/* PlanMark — Forms (complete): fill, create, auto-detect, field properties, tab order, radio groups, list boxes,
   buttons with actions, calculations (sum/product/average/min/max, simplified field notation, custom JavaScript),
   formats & validation (number, currency, percent, date, zip/phone/SSN, ranges, keystroke limits),
   form data import/export/merge (FDF, XFDF, CSV, XML), reset, highlight preferences, migrate typewritten text,
   document JavaScript + JavaScript console (Alt+J) running a SAFE sandboxed subset of Acrobat form JavaScript,
   Script Manager (record / edit / run multi-step command scripts) and Batch Script.
   Form JavaScript never reaches eval/new Function: it runs in the small interpreter below, which can only touch
   the form values and a handful of whitelisted helpers. */
(function(){
/* =====================================================================================
   0. helpers
   ===================================================================================== */
const PREF_DEF={hl:'#3b82f6',op:10,js:true,keys:true,reqHl:true};
const prefs=()=>Object.assign({},PREF_DEF,LS.get('pm:formprefs',{}));
const setPrefs=p=>{LS.set('pm:formprefs',Object.assign(prefs(),p));redrawAll()};
window.PM_EXTRA_SYNC_KEYS_FM=['pm:scripts','pm:formprefs'];
let formShow=LS.get('pm:formshow',true);
const FM={fields:[],byName:{},loaded:false,pdfInfo:{},docJS:[],coNames:[]};
const FS=()=>{const s=S.scales;s.forms=s.forms||{values:{},created:[],flatten:false};const F=s.forms;F.values=F.values||{};F.created=F.created||[];F.props=F.props||{};F.order=F.order||[];F.calcOrder=F.calcOrder||null;F.docJS=F.docJS||null;F.hidden=F.hidden||{};return F};
const KINDS=[['text','Text'],['multiline','Multi-line text'],['checkbox','Checkbox'],['radio','Radio button'],['dropdown','Dropdown'],['list','List box'],['date','Date'],['signature','Signature'],['button','Button']];
const KLAB=Object.fromEntries(KINDS);
const isNumStr=s=>typeof s==='string'&&/^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(s);
function num(v){if(typeof v==='number')return v;if(v==null||v===''||v===true||v===false)return v===true?1:0;let s=String(v).trim();const neg=/^\(.*\)$/.test(s)||/^-/.test(s.replace(/[^\d\-().]/g,''));
 // 1.234,56 → 1234.56 when a comma is the decimal mark
 if(/^\D*\d{1,3}(\.\d{3})+,\d+\D*$/.test(s)||/^\D*\d+,\d{1,2}\D*$/.test(s))s=s.replace(/\./g,'').replace(',','.');
 s=s.replace(/[^\d.]/g,'');if(!s||s==='.')return NaN;let n=parseFloat(s);if(String(v).includes('%'))n/=100;return neg?-n:n}
const clean=n=>typeof n==='number'&&isFinite(n)?String(+n.toFixed(10)):'';
const csvCell=v=>{v=v==null?'':String(v);return/[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function parseCSV(t){const rows=[];let row=[],cur='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
 else if(c==='"')q=true;else if(c===','){row.push(cur);cur=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
 if(cur!==''||row.length){row.push(cur);rows.push(row)}return rows.filter(r=>r.some(c=>c!==''))}
function pickFiles(accept,multiple){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept||'';i.multiple=!!multiple;i.onchange=()=>res([...i.files]);i.click()})}
const btn=(id,label,extra)=>`<button class="btn" id="${id}" style="border:1px solid var(--line)${extra?';'+extra:''}">${label}</button>`;
async function download(name,text,type){await saveFile(name,new Blob([text],{type:type||'text/plain'}))}
const baseNm=()=>String(S.fileName||'form').replace(/\.pdf$/i,'');

/* =====================================================================================
   1. Safe form JavaScript interpreter (subset of ES3 used by Acrobat form scripts)
   ===================================================================================== */
const JSI=(()=>{
 const PUN=['===','!==','==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','=','+','-','*','/','%','<','>','!','?',':','(',')','[',']','{','}',',',';','.'];
 const RNUM=/0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y,RID=/[A-Za-z_$][\w$]*/y;
 function lex(src){const t=[];let i=0;const n=src.length;
  while(i<n){const c=src[i];
   if(c===' '||c==='\t'||c==='\n'||c==='\r'||c==='\f'||c==='\v'||c===' '){i++;continue}
   if(c==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n')i++;continue}
   if(c==='/'&&src[i+1]==='*'){const j=src.indexOf('*/',i+2);i=j<0?n:j+2;continue}
   RNUM.lastIndex=i;let m=RNUM.exec(src);if(m&&m.index===i&&/[\d.]/.test(c)){t.push({t:'num',v:Number(m[0])});i+=m[0].length;continue}
   RID.lastIndex=i;m=RID.exec(src);if(m&&m.index===i){t.push({t:'id',v:m[0]});i+=m[0].length;continue}
   if(c==='"'||c==="'"){let j=i+1,s='';while(j<n&&src[j]!==c){let ch=src[j];if(ch==='\\'){j++;const e=src[j];ch=e==='n'?'\n':e==='t'?'\t':e==='r'?'\r':e==='b'?'\b':e==='f'?'\f':e==='u'?(()=>{const h=src.substr(j+1,4);j+=4;return String.fromCharCode(parseInt(h,16))})():e==='x'?(()=>{const h=src.substr(j+1,2);j+=2;return String.fromCharCode(parseInt(h,16))})():e==='\n'?'':e}s+=ch;j++}
    t.push({t:'str',v:s});i=j+1;continue}
   const p=PUN.find(p=>src.startsWith(p,i));if(!p)throw new SyntaxError('Unexpected character "'+c+'"');t.push({t:'p',v:p});i+=p.length}
  t.push({t:'eof'});return t}
 function parse(src){const T=lex(src);let k=0;
  const pk=()=>T[k],nx=()=>T[k++],is=(v)=>T[k].t==='p'&&T[k].v===v,isk=v=>T[k].t==='id'&&T[k].v===v;
  const eat=v=>{if(!is(v))throw new SyntaxError(`Expected "${v}"`+(T[k].v!=null?` near "${T[k].v}"`:''));k++};
  const semi=()=>{if(is(';'))k++};
  function program(){const b=[];while(pk().t!=='eof')b.push(stmt());return{type:'Block',body:b}}
  function block(){eat('{');const b=[];while(!is('}')){if(pk().t==='eof')throw new SyntaxError('Missing "}"');b.push(stmt())}eat('}');return{type:'Block',body:b}}
  function stmt(){
   if(is('{'))return block();if(is(';')){k++;return{type:'Empty'}}
   if(isk('var')||isk('let')||isk('const')){k++;const d=decls();semi();return d}
   if(isk('function')){k++;const name=nx().v;return{type:'FuncDecl',name,fn:func()}}
   if(isk('if')){k++;eat('(');const test=expr();eat(')');const cons=stmt();let alt=null;if(isk('else')){k++;alt=stmt()}return{type:'If',test,cons,alt}}
   if(isk('while')){k++;eat('(');const test=expr();eat(')');return{type:'While',test,body:stmt()}}
   if(isk('do')){k++;const body=stmt();if(!isk('while'))throw new SyntaxError('Expected while');k++;eat('(');const test=expr();eat(')');semi();return{type:'DoWhile',test,body}}
   if(isk('for')){k++;eat('(');let init=null;if(!is(';')){if(isk('var')||isk('let')||isk('const')){k++;init=decls()}else init={type:'Expr',e:expr()}}
    if(isk('in')){k++;const obj=expr();eat(')');const v=init.type==='Var'?init.d[0].id:init.e.name;return{type:'ForIn',v,obj,body:stmt()}}
    eat(';');const test=is(';')?null:expr();eat(';');const upd=is(')')?null:expr();eat(')');return{type:'For',init,test,upd,body:stmt()}}
   if(isk('return')){k++;let a=null;if(!is(';')&&!is('}')&&pk().t!=='eof')a=expr();semi();return{type:'Return',a}}
   if(isk('break')){k++;semi();return{type:'Break'}}if(isk('continue')){k++;semi();return{type:'Continue'}}
   if(isk('try')){k++;const b=block();let param=null,h=null,fin=null;if(isk('catch')){k++;eat('(');param=nx().v;eat(')');h=block()}if(isk('finally')){k++;fin=block()}return{type:'Try',b,param,h,fin}}
   if(isk('throw')){k++;const a=expr();semi();return{type:'Throw',a}}
   if(isk('switch')){k++;eat('(');const d=expr();eat(')');eat('{');const cases=[];while(!is('}')){let test=null;if(isk('case')){k++;test=expr()}else{if(!isk('default'))throw new SyntaxError('Expected case');k++}eat(':');const body=[];while(!is('}')&&!isk('case')&&!isk('default'))body.push(stmt());cases.push({test,body})}eat('}');return{type:'Switch',d,cases}}
   const e=expr();semi();return{type:'Expr',e}}
  function decls(){const d=[];do{const id=nx().v;let init=null;if(is('=')){k++;init=assign()}d.push({id,init})}while(is(',')&&++k);return{type:'Var',d}}
  function func(){eat('(');const params=[];while(!is(')')){params.push(nx().v);if(is(','))k++}eat(')');return{params,body:block()}}
  function expr(){let e=assign();while(is(',')){k++;e={type:'Seq',a:e,b:assign()}}return e}
  function assign(){const l=cond();if(T[k].t==='p'&&['=','+=','-=','*=','/=','%='].includes(T[k].v)){const op=nx().v;if(l.type!=='Id'&&l.type!=='Mem')throw new SyntaxError('Invalid assignment');return{type:'Assign',op,l,r:assign()}}return l}
  function cond(){const t=bin(0);if(is('?')){k++;const a=assign();eat(':');return{type:'Cond',t,a,b:assign()}}return t}
  const LV=[['||'],['&&'],['==','!=','===','!=='],['<','>','<=','>=','in','instanceof'],['+','-'],['*','/','%']];
  function bin(l){if(l>=LV.length)return unary();let a=bin(l+1);for(;;){const tk=T[k];const op=(tk.t==='p'||tk.t==='id')&&LV[l].includes(tk.v)?tk.v:null;if(!op)return a;k++;a={type:'Bin',op,a,b:bin(l+1)}}}
  function unary(){if(T[k].t==='p'&&['!','-','+'].includes(T[k].v)){const op=nx().v;return{type:'Un',op,a:unary()}}
   if(isk('typeof')){k++;return{type:'Un',op:'typeof',a:unary()}}
   if(is('++')||is('--')){const op=nx().v;return{type:'Upd',op,pre:true,a:unary()}}
   let e=post();return e}
  function post(){let e=call();if(is('++')||is('--')){const op=nx().v;e={type:'Upd',op,pre:false,a:e}}return e}
  function call(){let e;if(isk('new')){k++;const c=member(primary());let args=[];if(is('(')){args=argList()}e={type:'New',c,args}}else e=primary();
   for(;;){if(is('.')){k++;e={type:'Mem',o:e,p:{type:'Lit',v:nx().v}}}else if(is('[')){k++;const p=expr();eat(']');e={type:'Mem',o:e,p}}else if(is('(')){e={type:'Call',c:e,args:argList()}}else return e}}
  function member(e){for(;;){if(is('.')){k++;e={type:'Mem',o:e,p:{type:'Lit',v:nx().v}}}else if(is('[')){k++;const p=expr();eat(']');e={type:'Mem',o:e,p}}else return e}}
  function argList(){eat('(');const a=[];while(!is(')')){a.push(assign());if(is(','))k++;else if(!is(')'))throw new SyntaxError('Expected ","')}eat(')');return a}
  function primary(){const tk=nx();
   if(tk.t==='num'||tk.t==='str')return{type:'Lit',v:tk.v};
   if(tk.t==='id'){if(tk.v==='true')return{type:'Lit',v:true};if(tk.v==='false')return{type:'Lit',v:false};if(tk.v==='null')return{type:'Lit',v:null};if(tk.v==='undefined')return{type:'Lit',v:undefined};
    if(tk.v==='this')return{type:'This'};if(tk.v==='function'){let nm=null;if(T[k].t==='id')nm=nx().v;return{type:'Func',fn:func(),name:nm}}return{type:'Id',name:tk.v}}
   if(tk.t==='p'&&tk.v==='('){const e=expr();eat(')');return e}
   if(tk.t==='p'&&tk.v==='['){const el=[];while(!is(']')){el.push(assign());if(is(','))k++}eat(']');return{type:'Arr',el}}
   if(tk.t==='p'&&tk.v==='{'){const pr=[];while(!is('}')){const kt=nx();const key=kt.v;eat(':');pr.push([String(key),assign()]);if(is(','))k++}eat('}');return{type:'Obj',pr}}
   throw new SyntaxError('Unexpected '+(tk.t==='eof'?'end of script':'"'+tk.v+'"'))}
  return program()}
 // ---------- runtime ----------
 const HOST=new WeakSet(),OWN=new WeakSet();const BAD=new Set(['__proto__','constructor','prototype','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','valueOf','toString','call','apply','bind']);
 const hf=fn=>{HOST.add(fn);return fn};
 const obj=()=>{const o=Object.create(null);OWN.add(o);return o};
 const arr=a=>{OWN.add(a);return a};
 class Brk{}class Cnt{}class Ret{constructor(v){this.v=v}}class Thr{constructor(v){this.v=v}}
 const BRK=new Brk(),CNT=new Cnt();
 function Scope(parent){this.v=new Map();this.p=parent}
 Scope.prototype.find=function(n){let s=this;while(s){if(s.v.has(n))return s;s=s.p}return null};
 const SM={length:1,toUpperCase:1,toLowerCase:1,substr:1,substring:1,indexOf:1,lastIndexOf:1,charAt:1,charCodeAt:1,trim:1,split:1,slice:1,replace:1,concat:1,search:0,match:0};
 const AM={length:1,push:1,pop:1,join:1,indexOf:1,slice:1,concat:1,reverse:1,shift:1,unshift:1,sort:0,splice:1};
 function getM(o,key,ctx){key=String(key);if(BAD.has(key))return undefined;
  if(typeof o==='string'){if(key==='length')return o.length;if(/^\d+$/.test(key))return o[+key];if(SM[key])return hf(function(a){if(key==='replace'){const f=String(a[0]),r=String(a[1]);return o.split(f).length>1?o.replace(f,r):o}return String.prototype[key].apply(o,a.map(x=>typeof x==='object'&&x?String(x):x))});return undefined}
  if(typeof o==='number'){if(key==='toFixed')return hf(a=>o.toFixed(Math.max(0,Math.min(20,+a[0]||0))));if(key==='toString')return hf(()=>String(o));return undefined}
  if(Array.isArray(o)&&OWN.has(o)){if(key==='length')return o.length;if(/^\d+$/.test(key))return o[+key];if(AM[key])return hf(a=>{const r=Array.prototype[key].apply(o,a);return Array.isArray(r)?arr(r):r});return undefined}
  if(o&&typeof o==='object'&&(OWN.has(o)||ctx.hostObjs.has(o))){return Object.prototype.hasOwnProperty.call(o,key)||(ctx.hostObjs.has(o)&&key in o)?o[key]:undefined}
  if(o==null)throw new TypeError(`Cannot read "${key}" of ${o}`);return undefined}
 function setM(o,key,v,ctx){key=String(key);if(BAD.has(key))throw new TypeError('Not allowed');
  if(Array.isArray(o)&&OWN.has(o)){if(key==='length')o.length=Math.max(0,Math.min(1e5,+v||0));else if(/^\d+$/.test(key)&&+key<1e5)o[+key]=v;return v}
  if(o&&OWN.has(o)){o[key]=v;return v}
  if(o&&ctx.hostObjs.has(o)){const d=Object.getOwnPropertyDescriptor(o,key);if(d&&(d.set||d.writable)){o[key]=v;return v}throw new TypeError(`"${key}" is read-only`)}
  throw new TypeError(`Cannot set "${key}"`)}
 const toS=v=>v==null?String(v):typeof v==='object'?(Array.isArray(v)?v.map(toS).join(','):'[object]'):String(v);
 const prim=v=>typeof v==='object'&&v!==null?toS(v):v;
 function binop(op,a,b){a=prim(a);b=prim(b);switch(op){case'+':return(typeof a==='string'||typeof b==='string')?toS(a)+toS(b):a+b;case'-':return a-b;case'*':return a*b;case'/':return a/b;case'%':return a%b;
  case'<':return a<b;case'>':return a>b;case'<=':return a<=b;case'>=':return a>=b;case'==':return a==b;case'!=':return a!=b;case'===':return a===b;case'!==':return a!==b}throw new SyntaxError('Unsupported operator '+op)}
 function run(code,env,limit){const ast=typeof code==='string'?parse(code):code;const ctx={steps:0,limit:limit||300000,hostObjs:env.hostObjs||new WeakSet(),depth:0};const G=new Scope(null);
  for(const[k,v]of Object.entries(env.globals||{}))G.v.set(k,v);
  hoist(ast,G,ctx);const r=exec(ast,G,env.thisv,ctx);if(r instanceof Thr)throw new Error('Script error: '+toS(r.v));return{scope:G}}
 function hoist(b,sc,ctx){for(const s of b.body||[])if(s.type==='FuncDecl')sc.v.set(s.name,{fn:s.fn,sc,closure:1})}
 function exec(n,sc,th,ctx){if(++ctx.steps>ctx.limit)throw new Error('Script took too long');
  switch(n.type){
   case'Block':{for(const s of n.body){const r=exec(s,sc,th,ctx);if(r)return r}return}
   case'Empty':case'FuncDecl':return;
   case'Var':for(const d of n.d)sc.v.set(d.id,d.init?ev(d.init,sc,th,ctx):(sc.v.has(d.id)?sc.v.get(d.id):undefined));return;
   case'Expr':ev(n.e,sc,th,ctx);return;
   case'If':return ev(n.test,sc,th,ctx)?exec(n.cons,sc,th,ctx):n.alt?exec(n.alt,sc,th,ctx):undefined;
   case'While':while(ev(n.test,sc,th,ctx)){const r=exec(n.body,sc,th,ctx);if(r===BRK)break;if(r===CNT)continue;if(r)return r}return;
   case'DoWhile':do{const r=exec(n.body,sc,th,ctx);if(r===BRK)break;if(r===CNT)continue;if(r)return r}while(ev(n.test,sc,th,ctx));return;
   case'For':{if(n.init)exec(n.init,sc,th,ctx);for(;!n.test||ev(n.test,sc,th,ctx);n.upd&&ev(n.upd,sc,th,ctx)){const r=exec(n.body,sc,th,ctx);if(r===BRK)break;if(r===CNT)continue;if(r)return r}return}
   case'ForIn':{const o=ev(n.obj,sc,th,ctx);const keys=Array.isArray(o)?o.map((_,i)=>String(i)):o&&OWN.has(o)?Object.keys(o):[];for(const key of keys){(sc.find(n.v)||sc).v.set(n.v,key);const r=exec(n.body,sc,th,ctx);if(r===BRK)break;if(r===CNT)continue;if(r)return r}return}
   case'Return':return new Ret(n.a?ev(n.a,sc,th,ctx):undefined);
   case'Break':return BRK;case'Continue':return CNT;
   case'Throw':return new Thr(ev(n.a,sc,th,ctx));
   case'Try':{let r;try{r=exec(n.b,sc,th,ctx);if(r instanceof Thr&&n.h){const s2=new Scope(sc);s2.v.set(n.param,r.v);r=exec(n.h,s2,th,ctx)}}catch(e){if(/took too long/.test(e.message))throw e;if(n.h){const s2=new Scope(sc);s2.v.set(n.param,(()=>{const o=obj();o.message=e.message;o.name=e.name;return o})());r=exec(n.h,s2,th,ctx)}else r=undefined}finally{if(n.fin){const f=exec(n.fin,sc,th,ctx);if(f)r=f}}return r}
   case'Switch':{const d=ev(n.d,sc,th,ctx);let hit=false;for(const c of n.cases){if(!hit&&(c.test===null||ev(c.test,sc,th,ctx)===d))hit=true;if(hit)for(const s of c.body){const r=exec(s,sc,th,ctx);if(r===BRK)return;if(r)return r}}
    if(!hit){const df=n.cases.find(c=>c.test===null);if(df){let go=false;for(const c of n.cases){if(c===df)go=true;if(go)for(const s of c.body){const r=exec(s,sc,th,ctx);if(r===BRK)return;if(r)return r}}}}return}
  }throw new SyntaxError('Unsupported statement '+n.type)}
 function lval(n,sc,th,ctx){if(n.type==='Id'){const s=sc.find(n.name);return{get:()=>{if(!s)throw new ReferenceError(n.name+' is not defined');return s.v.get(n.name)},set:v=>{(s||root(sc)).v.set(n.name,v);return v}}}
  const o=ev(n.o,sc,th,ctx),p=ev(n.p,sc,th,ctx);return{get:()=>getM(o,p,ctx),set:v=>setM(o,p,v,ctx)}}
 const root=sc=>{while(sc.p)sc=sc.p;return sc};
 function callFn(f,args,th,ctx){if(typeof f==='function'&&HOST.has(f))return f(args,th);
  if(f&&f.closure){if(++ctx.depth>60)throw new Error('Too much recursion');const s=new Scope(f.sc);f.fn.params.forEach((p,i)=>s.v.set(p,args[i]));const a=arr(args.slice());s.v.set('arguments',a);hoist(f.fn.body,s,ctx);const r=exec(f.fn.body,s,th,ctx);ctx.depth--;if(r instanceof Thr)throw new Error(toS(r.v));return r instanceof Ret?r.v:undefined}
  throw new TypeError('Not a function')}
 function ev(n,sc,th,ctx){if(++ctx.steps>ctx.limit)throw new Error('Script took too long');
  switch(n.type){
   case'Lit':return n.v;case'This':return th;
   case'Id':{const s=sc.find(n.name);if(!s)throw new ReferenceError(n.name+' is not defined');return s.v.get(n.name)}
   case'Arr':return arr(n.el.map(e=>ev(e,sc,th,ctx)));
   case'Obj':{const o=obj();for(const[k,v]of n.pr){if(BAD.has(k))continue;o[k]=ev(v,sc,th,ctx)}return o}
   case'Func':{if(!n.name)return{fn:n.fn,sc,closure:1};const s2=new Scope(sc);const c={fn:n.fn,sc:s2,closure:1};s2.v.set(n.name,c);return c}
   case'Seq':ev(n.a,sc,th,ctx);return ev(n.b,sc,th,ctx);
   case'Mem':return getM(ev(n.o,sc,th,ctx),ev(n.p,sc,th,ctx),ctx);
   case'Call':{let th2=th,f;if(n.c.type==='Mem'){const o=ev(n.c.o,sc,th,ctx);f=getM(o,ev(n.c.p,sc,th,ctx),ctx);th2=o}else f=ev(n.c,sc,th,ctx);return callFn(f,n.args.map(a=>ev(a,sc,th,ctx)),th2,ctx)}
   case'New':{const c=ev(n.c,sc,th,ctx);const args=n.args.map(a=>ev(a,sc,th,ctx));if(c&&c.__ctor)return c.__ctor(args);if(c&&c.closure){const o=obj();callFn(c,args,o,ctx);return o}throw new TypeError('Not a constructor')}
   case'Un':{if(n.op==='typeof'){if(n.a.type==='Id'&&!sc.find(n.a.name))return'undefined';const v=ev(n.a,sc,th,ctx);return v&&v.closure||HOST.has(v)?'function':v===null?'object':typeof v}
    const v=prim(ev(n.a,sc,th,ctx));return n.op==='!'?!v:n.op==='-'?-v:+v}
   case'Upd':{const L=lval(n.a,sc,th,ctx);const o=+prim(L.get());const nv=n.op==='++'?o+1:o-1;L.set(nv);return n.pre?nv:o}
   case'Bin':{if(n.op==='&&'){const a=ev(n.a,sc,th,ctx);return a?ev(n.b,sc,th,ctx):a}if(n.op==='||'){const a=ev(n.a,sc,th,ctx);return a?a:ev(n.b,sc,th,ctx)}
    if(n.op==='in'){const a=ev(n.a,sc,th,ctx),b=ev(n.b,sc,th,ctx);return getM(b,a,ctx)!==undefined}if(n.op==='instanceof')return false;
    return binop(n.op,ev(n.a,sc,th,ctx),ev(n.b,sc,th,ctx))}
   case'Cond':return ev(n.t,sc,th,ctx)?ev(n.a,sc,th,ctx):ev(n.b,sc,th,ctx);
   case'Assign':{const L=lval(n.l,sc,th,ctx);const r=ev(n.r,sc,th,ctx);if(n.op==='=')return L.set(r);return L.set(binop(n.op[0],L.get(),r))}
  }throw new SyntaxError('Unsupported expression '+n.type)}
 return{parse,run,hf,obj,arr,toS}})();

/* =====================================================================================
   2. Formats, validation, Acrobat AF* script recognition
   ===================================================================================== */
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmtDate(d,f){const p=(n,w)=>String(n).padStart(w,'0');const H=d.getHours(),h12=H%12||12;
 return f.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|HH|H|hh|h|MM|M|ss|tt/g,t=>({yyyy:d.getFullYear(),yy:p(d.getFullYear()%100,2),mmmm:MON[d.getMonth()],mmm:MON[d.getMonth()].slice(0,3),mm:p(d.getMonth()+1,2),m:d.getMonth()+1,
  dddd:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()],ddd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],dd:p(d.getDate(),2),d:d.getDate(),HH:p(H,2),H,hh:p(h12,2),h:h12,MM:p(d.getMinutes(),2),M:d.getMinutes(),ss:p(d.getSeconds(),2),tt:H<12?'am':'pm'})[t])}
function parseDate(s,f){s=String(s||'').trim();if(!s)return null;let m;
 if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
 const nums=s.match(/\d+/g)||[];const mo=MON.findIndex(x=>new RegExp('\\b'+x.slice(0,3),'i').test(s));
 const order=(f||'mm/dd/yyyy').replace(/[^dmy]/g,' ').split(/\s+/).filter(Boolean).map(t=>t[0]).filter(t=>mo<0||t!=='m');
 if(mo>=0&&nums.length>=1){const y=nums.find(n=>n.length===4)||nums[1]||new Date().getFullYear();const d=nums.find(n=>n.length<=2)||1;return new Date(+y,mo,+d)}
 if(nums.length>=3){const o={};order.forEach((t,i)=>o[t]=+nums[i]);let y=o.y,M=o.m,d=o.d;if(y<100)y+=2000;if(M>12&&d<=12)[M,d]=[d,M];const dt=new Date(y,M-1,d);return isNaN(dt)?null:dt}
 const t=Date.parse(s);return isNaN(t)?null:new Date(t)}
function grp(intStr,sep){return intStr.replace(/\B(?=(\d{3})+(?!\d))/g,sep)}
function fmtNumber(n,o){if(!isFinite(n))return'';const dec=o.dec??2,st=+o.sep||0,neg=n<0;let s=Math.abs(n).toFixed(dec);let[i,d]=s.split('.');
 const thou=[',','','.',''][st]??',',dp=st>=2?',':'.';i=thou?grp(i,thou):i;s=d?i+dp+d:i;if(o.cur)s=o.curAfter?s+' '+o.cur:o.cur+s;
 const ns=+o.neg||0;if(neg)s=ns>=2?'('+s+')':'-'+s;return s}
// display text for a value under a format
function display(v,p){const f=p&&p.format;if(v==null||v==='')return'';if(!f||!f.type||f.type==='none')return typeof v==='string'?v:String(v);
 if(f.type==='number'){const n=num(v);return isNaN(n)?String(v):fmtNumber(n,f)}
 if(f.type==='percent'){const n=num(v);return isNaN(n)?String(v):fmtNumber(n*100,{dec:f.dec??2,sep:f.sep})+'%'}
 if(f.type==='date'){const d=parseDate(v,f.date);return d?fmtDate(d,f.date||'mm/dd/yyyy'):String(v)}
 if(f.type==='special'){const dg=String(v).replace(/\D/g,'');if(f.special==='zip')return dg.slice(0,5);if(f.special==='zip4')return dg.length>5?dg.slice(0,5)+'-'+dg.slice(5,9):dg;
  if(f.special==='phone')return dg.length===10?`(${dg.slice(0,3)}) ${dg.slice(3,6)}-${dg.slice(6)}`:dg.length===7?dg.slice(0,3)+'-'+dg.slice(3):String(v);if(f.special==='ssn')return dg.length===9?`${dg.slice(0,3)}-${dg.slice(3,5)}-${dg.slice(5)}`:String(v);return String(v)}
 if(f.type==='js'&&f.code&&prefs().js){try{const ev=runFieldJS(f.code,p._name,v,'Format');return ev.value==null?'':String(ev.value)}catch(e){return String(v)}}
 return String(v)}
// normalise what the user typed into the stored value; returns {ok,value,msg}
function accept(input,p){const f=p.format||{},vd=p.validate||{};let v=input;if(typeof v==='string')v=v.trim();
 if(v===''||v==null)return{ok:true,value:''};
 if(p.maxLen&&typeof v==='string'&&v.length>p.maxLen)v=v.slice(0,p.maxLen);
 if(f.type==='number'||f.type==='percent'){let n=num(v);if(isNaN(n))return{ok:false,msg:`"${p._name}" must be a number`};if(f.type==='percent'&&!/%/.test(String(input)))n=num(String(input).replace(/[^\d.\-]/g,''));v=clean(n)}
 else if(f.type==='date'){const d=parseDate(v,f.date);if(!d)return{ok:false,msg:`"${p._name}" needs a valid date (${f.date||'mm/dd/yyyy'})`};v=fmtDate(d,f.date||'mm/dd/yyyy')}
 else if(f.type==='special'){const dg=String(v).replace(/\D/g,''),need={zip:[5],zip4:[5,9],phone:[7,10],ssn:[9]}[f.special]||[];if(need.length&&!need.includes(dg.length))return{ok:false,msg:`"${p._name}": enter ${{zip:'a 5-digit ZIP code',zip4:'a ZIP+4 code',phone:'a 7 or 10 digit phone number',ssn:'a 9 digit number'}[f.special]}`};v=dg}
 if(vd.min!==''&&vd.min!=null||vd.max!==''&&vd.max!=null){const n=num(v);const lo=vd.min===''||vd.min==null?-Infinity:+vd.min,hi=vd.max===''||vd.max==null?Infinity:+vd.max;
  if(isNaN(n)||n<lo||n>hi)return{ok:false,msg:`"${p._name}" must be ${isFinite(lo)&&isFinite(hi)?`between ${lo} and ${hi}`:isFinite(lo)?`at least ${lo}`:`at most ${hi}`}`}}
 if(vd.code&&prefs().js){try{const ev=runFieldJS(vd.code,p._name,v,'Validate');if(ev.rc===false)return{ok:false,msg:`"${p._name}": value not accepted`};if(ev.value!==undefined)v=ev.value}catch(e){}}
 return{ok:true,value:v}}
const keyFilter=p=>{const f=p.format||{};if(f.type==='number'||f.type==='percent')return/[0-9.,\-()$%€£\s]/;if(f.type==='special')return/[0-9\-()\s]/;return null};
// Acrobat AF* functions → structured properties (so third-party forms show and keep their formats/calculations)
const OPN={SUM:'sum',PRD:'product',AVG:'avg',MIN:'min',MAX:'max'};
function splitArgs(s){const out=[];let cur='',q=null,d=0;for(const c of s){if(q){cur+=c;if(c===q)q=null;continue}if(c==='"'||c==="'"){q=c;cur+=c;continue}if(c==='('||c==='[')d++;if(c===')'||c===']')d--;if(c===','&&!d){out.push(cur.trim());cur='';continue}cur+=c}if(cur.trim())out.push(cur.trim());return out}
const unq=s=>{s=String(s||'').trim();return/^["'].*["']$/.test(s)?s.slice(1,-1):s};
function afCalc(js){js=String(js||'').trim();if(!js)return null;let m=js.match(/BVCALC([\s\S]*?)EVCALC/);if(m)return{op:'sfn',expr:m[1].trim()};
 m=js.match(/^AFSimple_Calculate\s*\(\s*["'](\w+)["']\s*,\s*(new\s+Array\s*\(([\s\S]*?)\)|\[([\s\S]*?)\]|["']([^"']*)["'])\s*\)\s*;?\s*$/);
 if(m&&OPN[m[1].toUpperCase()]){const list=m[3]??m[4];const names=list!=null?splitArgs(list).map(unq):String(m[5]).split(',').map(s=>s.trim());return{op:OPN[m[1].toUpperCase()],fields:names.filter(Boolean)}}
 return{op:'js',code:js}}
function afFormat(js){js=String(js||'').trim();if(!js)return null;let m;
 if((m=js.match(/^AFNumber_Format\s*\(([^)]*)\)\s*;?\s*$/))){const a=splitArgs(m[1]);return{type:'number',dec:+a[0]||0,sep:+a[1]||0,neg:+a[2]||0,cur:unq(a[4]||''),curAfter:a[5]==='false'}}
 if((m=js.match(/^AFPercent_Format\s*\(([^)]*)\)\s*;?\s*$/))){const a=splitArgs(m[1]);return{type:'percent',dec:+a[0]||0,sep:+a[1]||0}}
 if((m=js.match(/^AFDate_Format(Ex)?\s*\(([^)]*)\)\s*;?\s*$/))){const a=unq(splitArgs(m[2])[0]);const old=['m/d','m/d/yy','mm/dd/yy','mm/yy','d-mmm','d-mmm-yy','dd-mmm-yy','yy-mm-dd','mmm-yy','mmmm-yy','mmm d, yyyy','mmmm d, yyyy','m/d/yy h:MM tt','m/d/yy HH:MM'];return{type:'date',date:m[1]?a:(old[+a]||'mm/dd/yyyy')}}
 if((m=js.match(/^AFSpecial_Format\s*\(\s*(\d)\s*\)\s*;?\s*$/)))return{type:'special',special:['zip','zip4','phone','ssn'][+m[1]]||'zip'};
 return{type:'js',code:js}}
function afValidate(js){js=String(js||'').trim();if(!js)return null;const m=js.match(/^AFRange_Validate\s*\(([^)]*)\)\s*;?\s*$/);if(m){const a=splitArgs(m[1]);return{min:a[0]==='true'?+a[1]:'',max:a[2]==='true'?+a[3]:''}}return{code:js}}
// structured → Acrobat JavaScript (written into saved PDFs)
const jq=s=>JSON.stringify(String(s));
function calcJS(c){if(!c||!c.op)return'';if(['sum','product','avg','min','max'].includes(c.op))return`AFSimple_Calculate(${jq({sum:'SUM',product:'PRD',avg:'AVG',min:'MIN',max:'MAX'}[c.op])}, new Array (${(c.fields||[]).map(jq).join(', ')}));`;
 if(c.op==='sfn'){let js='';try{js=sfnToJS(c.expr)}catch(e){js='0'}return`/*** BVCALC ${c.expr} EVCALC ***/ event.value = ${js};`}return c.code||''}
function formatJS(f){if(!f||!f.type||f.type==='none')return null;if(f.type==='number')return[`AFNumber_Format(${f.dec??2}, ${+f.sep||0}, ${+f.neg||0}, 0, ${jq(f.cur||'')}, ${f.curAfter?'false':'true'});`,`AFNumber_Keystroke(${f.dec??2}, ${+f.sep||0}, ${+f.neg||0}, 0, ${jq(f.cur||'')}, ${f.curAfter?'false':'true'});`];
 if(f.type==='percent')return[`AFPercent_Format(${f.dec??2}, ${+f.sep||0});`,`AFPercent_Keystroke(${f.dec??2}, ${+f.sep||0});`];
 if(f.type==='date')return[`AFDate_FormatEx(${jq(f.date||'mm/dd/yyyy')});`,`AFDate_KeystrokeEx(${jq(f.date||'mm/dd/yyyy')});`];
 if(f.type==='special'){const i=['zip','zip4','phone','ssn'].indexOf(f.special);return[`AFSpecial_Format(${i<0?0:i});`,`AFSpecial_Keystroke(${i<0?0:i});`]}
 if(f.type==='js')return[f.code||'',null];return null}
function validateJS(v){if(!v)return'';if(v.code)return v.code;const lo=v.min!==''&&v.min!=null,hi=v.max!==''&&v.max!=null;if(!lo&&!hi)return'';return`AFRange_Validate(${lo}, ${lo?+v.min:0}, ${hi}, ${hi?+v.max:0});`}

/* ---------- simplified field notation ---------- */
function sfnParse(src){let i=0;const s=String(src||'');const sp=()=>{while(i<s.length&&/\s/.test(s[i]))i++};
 function prim(){sp();if(s[i]==='('){i++;const e=add();sp();if(s[i]!==')')throw new SyntaxError('Missing )');i++;return e}
  if(s[i]==='-'){i++;return{op:'neg',a:prim()}}
  let m=/^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));if(m){i+=m[0].length;return{n:+m[0]}}
  let name='';while(i<s.length&&!/[\s+\-*/()]/.test(s[i])){if(s[i]==='\\'&&i+1<s.length){name+=s[i+1];i+=2}else name+=s[i++]}
  if(!name)throw new SyntaxError('Expected a field name or number');return{f:name}}
 function mul(){let a=prim();for(;;){sp();const c=s[i];if(c==='*'||c==='/'){i++;a={op:c,a,b:prim()}}else return a}}
 function add(){let a=mul();for(;;){sp();const c=s[i];if(c==='+'||c==='-'){i++;a={op:c,a,b:mul()}}else return a}}
 const e=add();sp();if(i<s.length)throw new SyntaxError('Unexpected "'+s[i]+'"');return e}
function sfnEval(e,get){if('n'in e)return e.n;if('f'in e)return get(e.f);if(e.op==='neg')return-sfnEval(e.a,get);const a=sfnEval(e.a,get),b=sfnEval(e.b,get);return e.op==='+'?a+b:e.op==='-'?a-b:e.op==='*'?a*b:b===0?0:a/b}
function sfnNames(e,out=new Set()){if(e.f)out.add(e.f);if(e.a)sfnNames(e.a,out);if(e.b)sfnNames(e.b,out);return out}
function sfnToJS(expr){const t=e=>'n'in e?String(e.n):'f'in e?`AFMakeNumber(getField(${jq(e.f)}).value)`:e.op==='neg'?`-(${t(e.a)})`:`(${t(e.a)} ${e.op} ${t(e.b)})`;return t(sfnParse(expr))}

/* =====================================================================================
   3. Field model: PDF fields + PlanMark-created fields, merged properties
   ===================================================================================== */
async function loadFields(){FM.fields=[];FM.byName={};FM.loaded=false;FM.pdfInfo={};FM.docJS=[];FM.coNames=[];const doc=S.pdf;if(!doc)return;
 const idName={};
 for(const p of S.pages){let an=[];try{an=await(await doc.getPage(p.num)).getAnnotations()}catch(e){}if(doc!==S.pdf)return;
  for(const a of an){if(a.subtype!=='Widget'||!a.fieldName)continue;const r=p.vp.convertToViewportRectangle(a.rect),box=normBox([r[0],r[1]],[r[2],r[3]]);idName[a.id]=a.fieldName;
   const kind=a.fieldType==='Tx'?'text':a.fieldType==='Sig'?'signature':a.fieldType==='Ch'?(a.combo?'dropdown':'list'):a.checkBox?'checkbox':a.radioButton?'radio':'button';
   let f=FM.byName[a.fieldName];if(!f){f=FM.byName[a.fieldName]={name:a.fieldName,kind,widgets:[],options:(a.options||[]).map(o=>o.displayValue??o.exportValue),
    value:kind==='checkbox'?(a.fieldValue&&a.fieldValue!=='Off'):kind==='radio'?(a.fieldValue&&a.fieldValue!=='Off'?a.fieldValue:''):(Array.isArray(a.fieldValue)?a.fieldValue[0]:(a.fieldValue||'')),
    readOnly:!!a.readOnly,multiline:!!a.multiLine,pdf:{tooltip:a.alternativeText||'',required:!!a.required,maxLen:a.maxLen||0,align:['left','center','right'][a.textAlignment||0]||'left',
     default:Array.isArray(a.defaultFieldValue)?a.defaultFieldValue[0]:(a.defaultFieldValue||''),hidden:!!a.hidden,caption:a.buttonValue||'',url:a.url||'',resetForm:a.resetForm||null}};FM.fields.push(f)}
   f.widgets.push({page:p.num,box,exportValue:a.exportValue||a.buttonValue||''})}}
 try{const ids=await doc.getCalculationOrderIds();if(ids)FM.coNames=ids.map(id=>idName[id]).filter(Boolean)}catch(e){}
 if(FM.fields.length)await readPdfScripts();
 try{const js=await doc.getJavaScript();if(js&&js.length&&!FM.docJS.length)FM.docJS=js.map((code,i)=>({name:'Script '+(i+1),code}))}catch(e){}
 FM.loaded=true;runDocJS();recalc(true);renderForms();redrawAll()}
// field-level actions and document JavaScript read with pdf-lib (pdf.js does not expose them all)
async function readPdfScripts(){if(!window.PDFLib||!S.bytes)return;try{const L=PDFLib,d=await L.PDFDocument.load(S.bytes,{ignoreEncryption:true,updateMetadata:false});
 const str=o=>{if(!o)return'';if(o instanceof L.PDFString||o instanceof L.PDFHexString)return o.decodeText();if(o instanceof L.PDFRawStream){try{return new TextDecoder('latin1').decode(L.decodePDFRawStream(o).decode())}catch(e){return''}}if(o instanceof L.PDFName)return o.decodeText?o.decodeText():o.asString();return''};
 const L_=(dict,k)=>{try{return dict.lookup(L.PDFName.of(k))}catch(e){return null}};
 const jsOf=a=>{if(!a||!(a instanceof L.PDFDict))return'';const s=L_(a,'S');if(s&&s.asString&&s.asString()==='/JavaScript')return str(L_(a,'JS'));return''};
 for(const fld of d.getForm().getFields()){const name=fld.getName(),info=FM.pdfInfo[name]={};const dicts=[fld.acroField.dict,...fld.acroField.getWidgets().map(w=>w.dict)];
  for(const dict of dicts){const aa=L_(dict,'AA');if(aa instanceof L.PDFDict){for(const[k,key]of[['C','calc'],['F','format'],['K','keystroke'],['V','validate']]){const j=jsOf(L_(aa,k));if(j&&!info[key])info[key]=j}}
   const a=L_(dict,'A');if(a instanceof L.PDFDict&&!info.action){const s=L_(a,'S'),sn=s&&s.asString?s.asString().slice(1):'';
    if(sn==='ResetForm')info.action={type:'reset'};else if(sn==='URI')info.action={type:'url',arg:str(L_(a,'URI'))};else if(sn==='SubmitForm'){const ff=L_(a,'F');info.action={type:'submit',arg:ff instanceof L.PDFDict?str(L_(ff,'F')):str(ff)}}
    else if(sn==='Hide'){const t=L_(a,'T'),h=L_(a,'H');info.action={type:'showhide',arg:t?str(t):'',show:h&&h.asBoolean?!h.asBoolean():false}}
    else if(sn==='GoTo'){const D=L_(a,'D');let pg=1;try{const ref=D.get(0);const pages=d.getPages();const i=pages.findIndex(p=>p.ref===ref||String(p.ref)===String(ref));if(i>=0)pg=i+1}catch(e){}info.action={type:'page',arg:String(pg)}}
    else if(sn==='JavaScript'){const j=str(L_(a,'JS'));const m=j.match(/PlanMark script:\s*(.+?)\s*\*\//);info.action=m?{type:'script',arg:m[1]}:{type:'js',code:j}}}
   const da=L_(dict,'DA');if(da&&!info.fontSize){const m=str(da).match(/([\d.]+)\s+Tf/);if(m&&+m[1])info.fontSize=+m[1]}
   const tu=L_(dict,'TU');if(tu&&!info.tooltip)info.tooltip=str(tu);const ml=L_(dict,'MaxLen');if(ml&&ml.asNumber&&!info.maxLen)info.maxLen=ml.asNumber();const dv=L_(dict,'DV');if(dv&&info.default==null)info.default=str(dv)}
  try{info.required=fld.isRequired();info.readOnly=fld.isReadOnly()}catch(e){}}
 const co=L_(d.getForm().acroForm.dict,'CO');if(co instanceof L.PDFArray){const byRef=new Map(d.getForm().getFields().map(x=>[String(x.ref),x.getName()]));FM.coNames=co.asArray().map(r=>byRef.get(String(r))).filter(Boolean)}
 // document-level JavaScript (Names → JavaScript)
 const names=L_(d.catalog,'Names');if(names instanceof L.PDFDict){const walk=node=>{if(!(node instanceof L.PDFDict))return;const nm=L_(node,'Names');if(nm instanceof L.PDFArray){for(let i=0;i+1<nm.size();i+=2){const n=str(nm.lookup(i)),act=nm.lookup(i+1);const j=jsOf(act);if(j)FM.docJS.push({name:n||'Script',code:j})}}const kids=L_(node,'Kids');if(kids instanceof L.PDFArray)for(let i=0;i<kids.size();i++)walk(kids.lookup(i))};walk(L_(names,'JavaScript'))}
 }catch(e){console.warn('form scripts',e)}}
// created fields, grouped by name (radio buttons share a name)
function createdGroups(){const g=new Map();for(const c of FS().created){if(!g.has(c.name))g.set(c.name,[]);g.get(c.name).push(c)}return g}
function allFieldsRaw(){const out=FM.fields.map(f=>({f,created:false}));
 for(const[name,cs]of createdGroups()){const c=cs[0];out.push({f:Object.assign({},c,{widgets:cs.map(x=>({page:x.page,box:x.box,exportValue:x.exportValue||'',cid:x.id})),value:c.kind==='checkbox'?false:'',ids:cs.map(x=>x.id)}),created:true})}return out}
function geomOrder(list){return list.slice().sort((a,b)=>{const wa=a.f.widgets[0],wb=b.f.widgets[0];if(wa.page!==wb.page)return wa.page-wb.page;const ya=wa.box[1],yb=wb.box[1];if(Math.abs(ya-yb)>4)return ya-yb;return wa.box[0]-wb.box[0]})}
function allFields(){const list=allFieldsRaw(),ord=FS().order;if(!ord.length)return list;const pos=new Map(ord.map((n,i)=>[n,i]));const known=list.filter(x=>pos.has(x.f.name)).sort((a,b)=>pos.get(a.f.name)-pos.get(b.f.name));return[...known,...list.filter(x=>!pos.has(x.f.name))]}
function fieldByName(n){return allFieldsRaw().find(x=>x.f.name===n)}
// effective properties: PDF → PlanMark overrides
function propsOf(f){const F=FS(),o=F.props[f.name]||{},info=FM.pdfInfo[f.name]||{},pdf=f.pdf||{};
 const p={_name:f.name,tooltip:info.tooltip||pdf.tooltip||'',required:!!(pdf.required||info.required),readOnly:!!(f.readOnly||info.readOnly),default:info.default??pdf.default??'',fontSize:info.fontSize||0,align:pdf.align||'left',maxLen:pdf.maxLen||info.maxLen||0,multiline:!!f.multiline,hidden:!!pdf.hidden,caption:pdf.caption||f.caption||'',
  format:afFormat(info.format)||null,calc:afCalc(info.calc)||null,validate:afValidate(info.validate)||null,action:info.action||(pdf.url?{type:'url',arg:pdf.url}:pdf.resetForm?{type:'reset'}:null)};
 if(f.kind==='date'&&!p.format)p.format={type:'date',date:'mm/dd/yyyy'};
 for(const[k,v]of Object.entries(o))if(v!==undefined)p[k]=v;
 if(F.hidden[f.name]!==undefined)p.hidden=F.hidden[f.name];return p}
const valOf=f=>{const v=FS().values;return f.name in v?v[f.name]:f.value};
function fieldAt(pg,pt){if(!formShow||!pt)return null;for(const{f}of allFields()){if(propsOf(f).hidden)continue;for(const w of f.widgets)if(w.page===pg&&pt[0]>=w.box[0]&&pt[0]<=w.box[2]&&pt[1]>=w.box[1]&&pt[1]<=w.box[3])return Object.assign({},f,{_w:w})}return null}

/* =====================================================================================
   4. Values, calculation, JavaScript runtime bindings
   ===================================================================================== */
let calcBusy=false;
function setRaw(name,v){FS().values[name]=v}
function setVal(name,v,o){o=o||{};const x=fieldByName(name);if(x&&!o.force){const p=propsOf(x.f);if(['text','date'].includes(x.f.kind)||x.f.kind==='multiline'){const r=accept(v,p);if(!r.ok){toast(r.msg);if(o.ui!==false)renderForms();return false}v=r.value}}
 FS().values[name]=v;recalc();saveScales();hook('change');redrawAll();if(o.render!==false)renderForms();return true}
function calcNames(){const F=FS(),list=allFieldsRaw().filter(x=>propsOf(x.f).calc).map(x=>x.f.name);const ord=F.calcOrder||FM.coNames||[];const pos=new Map(ord.map((n,i)=>[n,i]));return list.sort((a,b)=>(pos.has(a)?pos.get(a):1e6)-(pos.has(b)?pos.get(b):1e6))}
function fieldNum(n){const x=fieldByName(n);if(!x)return 0;const v=valOf(x.f);if(x.f.kind==='checkbox')return v?1:0;const k=num(v);return isNaN(k)?0:k}
function calcValue(c,name){if(c.op==='sfn'){const e=sfnParse(c.expr);return sfnEval(e,fieldNum)}
 if(c.op==='js'){if(!prefs().js)return undefined;const ev=runFieldJS(c.code,name,valOf(fieldByName(name).f),'Calculate');return ev.value}
 const vals=(c.fields||[]).filter(n=>fieldByName(n)).map(fieldNum);if(!vals.length)return'';
 return c.op==='sum'?vals.reduce((a,b)=>a+b,0):c.op==='product'?vals.reduce((a,b)=>a*b,1):c.op==='avg'?vals.reduce((a,b)=>a+b,0)/vals.length:c.op==='min'?Math.min(...vals):Math.max(...vals)}
function recalc(silent){if(calcBusy)return;calcBusy=true;try{for(const name of calcNames()){const x=fieldByName(name);if(!x)continue;let r;try{r=calcValue(propsOf(x.f).calc,name)}catch(e){r='';if(!silent)console.warn('calc',name,e.message)}
  if(r===undefined)continue;FS().values[name]=typeof r==='number'?clean(r):r==null?'':String(r)}}finally{calcBusy=false}}
// host environment for form JavaScript
const JSOUT=[];
const HOSTSET=new WeakSet();
function jsEnv(evt){const host=HOSTSET;const H_=o=>{host.add(o);return o};const hf=JSI.hf;
 const fieldObj=name=>{const x=fieldByName(name);if(!x)return null;const f=x.f;const o=Object.create(null);
  Object.defineProperty(o,'name',{get:()=>f.name,enumerable:true});
  Object.defineProperty(o,'value',{get:()=>{const v=valOf(f);if(f.kind==='checkbox')return v?'Yes':'Off';return typeof v==='string'&&isNumStr(v)?+v:(v==null?'':v)},set:v=>{setRaw(f.name,f.kind==='checkbox'?(v&&v!=='Off'):JSI.toS(v))},enumerable:true});
  Object.defineProperty(o,'valueAsString',{get:()=>String(valOf(f)??''),enumerable:true});
  Object.defineProperty(o,'type',{get:()=>({text:'text',date:'text',checkbox:'checkbox',radio:'radiobutton',dropdown:'combobox',list:'listbox',button:'button',signature:'signature'}[f.kind]||'text'),enumerable:true});
  Object.defineProperty(o,'display',{get:()=>propsOf(f).hidden?1:0,set:v=>{FS().hidden[f.name]=+v===1||+v===3},enumerable:true});
  Object.defineProperty(o,'hidden',{get:()=>propsOf(f).hidden,set:v=>{FS().hidden[f.name]=!!v},enumerable:true});
  Object.defineProperty(o,'readonly',{get:()=>propsOf(f).readOnly,set:v=>{FS().props[f.name]=Object.assign(FS().props[f.name]||{},{readOnly:!!v})},enumerable:true});
  Object.defineProperty(o,'required',{get:()=>propsOf(f).required,set:v=>{FS().props[f.name]=Object.assign(FS().props[f.name]||{},{required:!!v})},enumerable:true});
  Object.defineProperty(o,'textColor',{get:()=>JSI.arr(['RGB',0,0,0]),set:()=>{},enumerable:true});Object.defineProperty(o,'fillColor',{get:()=>JSI.arr(['T']),set:()=>{},enumerable:true});
  o.setFocus=hf(()=>undefined);o.clearItems=hf(()=>undefined);
  return H_(o)};
 const getField=hf(a=>fieldObj(String(a[0])));
 const doc=H_(Object.assign(Object.create(null),{getField,calculateNow:hf(()=>{recalc();return undefined}),resetForm:hf(a=>{resetForm(a[0]&&Array.isArray(a[0])?a[0]:null,true);return undefined})}));
 Object.defineProperty(doc,'numFields',{get:()=>allFieldsRaw().length,enumerable:true});
 doc.getNthFieldName=hf(a=>{const l=allFieldsRaw();return(l[+a[0]]||{f:{}}).f.name});
 const util=H_(Object.assign(Object.create(null),{printf:hf(a=>printf(String(a[0]??''),a.slice(1))),printd:hf(a=>{const d=a[1]&&a[1].__date?a[1].__date:new Date();return fmtDate(d,String(a[0]||'mm/dd/yyyy'))}),
  scand:hf(a=>{const d=parseDate(a[1],String(a[0]));return d?mkDate(d):null})}));
 const mkDate=d=>{const o=Object.create(null);o.__date=d;for(const k of['getFullYear','getMonth','getDate','getDay','getHours','getMinutes','getSeconds','getTime'])o[k]=hf(()=>d[k]());return H_(o)};
 const M=H_(Object.create(null));for(const k of['abs','round','floor','ceil','min','max','pow','sqrt','log','exp','sin','cos','tan','atan','atan2','random'])M[k]=hf(a=>Math[k](...a.map(x=>+JSI.toS(x))));M.PI=Math.PI;M.E=Math.E;
 const ev=evt;host.add(ev);
 const AF={
  AFMakeNumber:hf(a=>{const n=num(a[0]);return isNaN(n)?null:n}),
  AFSimple_Calculate:hf(a=>{const op=OPN[String(a[0]).toUpperCase()];const list=Array.isArray(a[1])?a[1].map(String):String(a[1]).split(',').map(s=>s.trim());ev.value=calcValue({op,fields:list});return undefined}),
  AFNumber_Format:hf(a=>{const n=num(ev.value);if(ev.value===''||isNaN(n))return;ev.value=fmtNumber(n,{dec:+a[0],sep:+a[1],neg:+a[2],cur:a[4]||'',curAfter:a[5]===false})}),
  AFNumber_Keystroke:hf(a=>{if(ev.change&&!/^[0-9.,\-]*$/.test(ev.change))ev.rc=false}),
  AFPercent_Format:hf(a=>{const n=num(ev.value);if(ev.value===''||isNaN(n))return;ev.value=fmtNumber(n*100,{dec:+a[0],sep:+a[1]})+'%'}),
  AFPercent_Keystroke:hf(a=>{if(ev.change&&!/^[0-9.,\-%]*$/.test(ev.change))ev.rc=false}),
  AFDate_FormatEx:hf(a=>{const d=parseDate(ev.value,String(a[0]));if(d)ev.value=fmtDate(d,String(a[0]))}),AFDate_KeystrokeEx:hf(a=>{if(ev.willCommit&&ev.value&&!parseDate(ev.value,String(a[0])))ev.rc=false}),
  AFDate_Format:hf(a=>undefined),AFSpecial_Format:hf(a=>{ev.value=display(ev.value,{format:{type:'special',special:['zip','zip4','phone','ssn'][+a[0]]}})}),AFSpecial_Keystroke:hf(()=>undefined),
  AFRange_Validate:hf(a=>{const n=num(ev.value);if(ev.value==='')return;if((a[0]&&n<+a[1])||(a[2]&&n>+a[3])){ev.rc=false;JSOUT.push('Value out of range')}})};
 const app=H_(Object.assign(Object.create(null),{alert:hf(a=>{toast(JSI.toS(a[0]&&a[0].cMsg!==undefined?a[0].cMsg:a[0]));return 1}),beep:hf(()=>undefined)}));
 Object.defineProperty(app,'viewerType',{get:()=>'Exchange-Pro',enumerable:true});Object.defineProperty(app,'viewerVersion',{get:()=>21,enumerable:true});
 const consoleO=H_(Object.assign(Object.create(null),{println:hf(a=>{JSOUT.push(JSI.toS(a[0]));return undefined}),clear:hf(()=>{JSOUT.length=0}),show:hf(()=>undefined)}));
 const display_=H_(Object.assign(Object.create(null),{visible:0,hidden:1,noPrint:2,noView:3}));
 const ArrayCtor=H_(Object.assign(Object.create(null),{__ctor:a=>JSI.arr(a.length===1&&typeof a[0]==='number'?new Array(Math.min(1e4,a[0])).fill(undefined):a.slice())}));
 const DateCtor=H_(Object.assign(Object.create(null),{__ctor:a=>mkDate(a.length?new Date(...a.map(x=>typeof x==='object'?NaN:x)):new Date())}));
 const globals=Object.assign({getField,event:ev,util,Math:M,app,console:consoleO,display:display_,Array:ArrayCtor,Date:DateCtor,
  Number:hf(a=>+JSI.toS(a[0])),String:hf(a=>JSI.toS(a[0])),parseFloat:hf(a=>parseFloat(JSI.toS(a[0]))),parseInt:hf(a=>parseInt(JSI.toS(a[0]),a[1]||10)),isNaN:hf(a=>isNaN(+JSI.toS(a[0]))),isFinite:hf(a=>isFinite(+JSI.toS(a[0])))},AF);
 for(const fn of docFns)globals[fn[0]]=fn[1];
 return{globals,thisv:doc,hostObjs:host}}
function printf(fmt,args){let i=0;return fmt.replace(/%([,]?)(\d)?(?:\.(\d+))?([dfsx%])/g,(m,c,sep,dec,t)=>{if(t==='%')return'%';const a=args[i++];
 if(t==='s')return JSI.toS(a);if(t==='x')return(+a>>>0).toString(16);const n=+JSI.toS(a);if(t==='d')return fmtNumber(Math.trunc(n),{dec:0,sep:c?+(sep||0):1});return fmtNumber(n,{dec:dec==null?6:+dec,sep:c?+(sep||0):1})})}
// document-level functions defined by document JavaScript (kept as closures from a sandboxed run)
let docFns=[];
function runDocJS(){docFns=[];if(!prefs().js)return;const list=docScripts();if(!list.length)return;
 for(const s of list){try{const env=jsEnv(JSI.obj());const r=JSI.run(s.code,env);for(const[k,v]of r.scope.v)if(v&&v.closure)docFns.push([k,v])}catch(e){console.warn('document JavaScript',s.name,e.message)}}}
function docScripts(){const F=FS();return F.docJS||FM.docJS||[]}
function runFieldJS(code,name,value,kind){const ev=JSI.obj();ev.value=value==null?'':(typeof value==='string'&&isNumStr(value)&&kind!=='Format'?+value:value);ev.rc=true;ev.name=kind;ev.type='Field';ev.willCommit=true;ev.change='';
 const x=fieldByName(name);ev.target=x?jsEnv(ev).globals.getField([name]):null;const env=jsEnv(ev);JSI.run(code,env);return ev}

/* =====================================================================================
   5. Drawing fields on the page
   ===================================================================================== */
H.over.push(n=>{if(!formShow)return'';const pf=prefs(),op=Math.max(0,Math.min(100,+pf.op))/100;let h='';const k=1/S.zoom;
 for(const{f,created}of allFields()){const p=propsOf(f);if(p.hidden)continue;for(const w of f.widgets){if(w.page!==n)continue;const b=w.box,v=valOf(f),hgt=b[3]-b[1],wid=b[2]-b[0];
  const empty=v===''||v==null||v===false;const req=p.required&&empty&&pf.reqHl;
  h+=`<rect x="${b[0]}" y="${b[1]}" width="${wid}" height="${hgt}" fill="${f.kind==='button'?'#e5e7eb':esc(pf.hl)}" fill-opacity="${f.kind==='button'?.95:op}" stroke="${req?'#dc2626':esc(pf.hl)}" stroke-opacity="${req?1:.6}" stroke-width="${req?2*k:k}" ${created?`stroke-dasharray="${4*k} ${3*k}"`:''} ${f.kind==='radio'?`rx="${hgt/2}"`:''} pointer-events="none"/>`;
  if(f.kind==='checkbox'&&v)h+=`<path d="M${b[0]+hgt*.2} ${b[1]+hgt*.55} L${b[0]+hgt*.42} ${b[1]+hgt*.78} L${b[0]+hgt*.82} ${b[1]+hgt*.22}" stroke="#1d4ed8" stroke-width="${Math.max(1,hgt*.12)}" fill="none" pointer-events="none"/>`;
  else if(f.kind==='radio'){if(v&&v===w.exportValue)h+=`<circle cx="${(b[0]+b[2])/2}" cy="${(b[1]+b[3])/2}" r="${Math.min(hgt,wid)*.25}" fill="#1d4ed8" pointer-events="none"/>`}
  else if(f.kind==='button'){const cap=p.caption||f.name,fs=p.fontSize||Math.min(11,hgt*.6);h+=`<text x="${(b[0]+b[2])/2}" y="${(b[1]+b[3])/2}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="#111827" font-family="Helvetica,Arial" pointer-events="none">${esc(cap)}</text>`}
  else if(f.kind==='list'){const fs=p.fontSize||Math.min(10,hgt*.25);(f.options||[]).slice(0,Math.max(1,Math.floor(hgt/(fs*1.3)))).forEach((o,i)=>{const y=b[1]+fs*1.3*(i+.5);if(o===v)h+=`<rect x="${b[0]+1}" y="${y-fs*.65}" width="${wid-2}" height="${fs*1.3}" fill="#1d4ed8" fill-opacity=".85" pointer-events="none"/>`;h+=`<text x="${b[0]+3}" y="${y}" font-size="${fs}" dominant-baseline="central" fill="${o===v?'#fff':'#1e3a8a'}" font-family="Helvetica,Arial" pointer-events="none">${esc(o)}</text>`})}
  else if(!empty&&f.kind!=='signature'){const t=display(v,p),fs=p.fontSize||Math.min(11,hgt*.7),al=p.align;const x=al==='center'?(b[0]+b[2])/2:al==='right'?b[2]-2:b[0]+2;
   h+=`<text x="${x}" y="${(b[1]+b[3])/2}" font-size="${fs}" text-anchor="${al==='center'?'middle':al==='right'?'end':'start'}" dominant-baseline="central" fill="#1e3a8a" font-family="Helvetica,Arial" pointer-events="none">${esc(String(t).slice(0,200))}</text>`}
  if(created&&f.widgets.indexOf(w)===0)h+=`<text x="${b[0]}" y="${b[1]-2*k}" font-size="${8*k}" fill="#2563eb" font-family="Helvetica,Arial" pointer-events="none">${esc(f.name)}${p.calc?' ∑':''}</text>`}}return h});

/* =====================================================================================
   6. Filling: in-place editor on the page (Tab / Shift+Tab follow the tab order)
   ===================================================================================== */
let ed=null;
function closeEditor(commit){if(!ed)return;const e=ed;ed=null;if(commit&&e.input){const v=e.input.value;if(v!==String(e.orig??'')){if(setVal(e.name,v)===false){/* rejected: reopen so the user can fix it */setTimeout(()=>openEditor(e.f,e.w,v),0);e.el.remove();return}}}e.el.remove()}
function widgetScreen(w){const p=S.pages[w.page-1];if(!p||!p.el)return null;const r=p.el.getBoundingClientRect(),k=r.width/p.w;return{x:r.left+w.box[0]*k,y:r.top+w.box[1]*k,w:(w.box[2]-w.box[0])*k,h:(w.box[3]-w.box[1])*k,k}}
function openEditor(f,w,preset){closeEditor(true);const p=propsOf(f);if(p.readOnly){toast('That field is read-only');return}
 const sc=widgetScreen(w);if(!sc){return editDialog(f)}const el=document.createElement('div');el.id='f3Ed';
 el.style.cssText=`position:fixed;left:${sc.x}px;top:${sc.y}px;width:${Math.max(40,sc.w)}px;height:${Math.max(18,sc.h)}px;z-index:60`;
 const ml=p.multiline||f.kind==='multiline';const v=preset!==undefined?preset:valOf(f);let input;
 if(f.kind==='dropdown'||f.kind==='list'){input=document.createElement('select');input.innerHTML=['',...(f.options||[])].map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('');if(f.kind==='list')input.size=Math.min(6,(f.options||[]).length+1)}
 else{input=document.createElement(ml?'textarea':'input');input.value=v==null?'':String(v);if(p.maxLen)input.maxLength=p.maxLen;const kf=keyFilter(p);if(kf)input.addEventListener('beforeinput',e=>{if(e.data&&[...e.data].some(ch=>!kf.test(ch))){e.preventDefault();toast('Numbers only in this field')}})}
 input.style.cssText=`width:100%;height:${f.kind==='list'?'auto':'100%'};box-sizing:border-box;border:2px solid #2563eb;border-radius:2px;background:#fff;color:#111;font:${Math.max(10,(p.fontSize||Math.min(11,(w.box[3]-w.box[1])*.7))*sc.k)}px Helvetica,Arial;padding:0 3px;text-align:${p.align||'left'};outline:none;resize:none`;
 if(p.tooltip)input.title=p.tooltip;el.appendChild(input);document.body.appendChild(el);ed={f,w,name:f.name,el,input,orig:v};
 input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeEditor(false)}else if(e.key==='Enter'&&!ml&&f.kind!=='list'){e.preventDefault();closeEditor(true)}else if(e.key==='Tab'){e.preventDefault();const cur=f.name;closeEditor(true);nextField(cur,e.shiftKey?-1:1)}});
 if(f.kind==='dropdown'||f.kind==='list')input.addEventListener('change',()=>closeEditor(true));
 input.addEventListener('blur',()=>setTimeout(()=>{if(ed&&ed.input===input&&!el.contains(document.activeElement))closeEditor(true)},80));
 setTimeout(()=>{input.focus();if(input.select&&f.kind!=='dropdown'&&f.kind!=='list')input.select()},0)}
function nextField(cur,dir){const list=allFields().filter(x=>{const p=propsOf(x.f);return!p.hidden&&!p.readOnly&&x.f.kind!=='signature'});const i=list.findIndex(x=>x.f.name===cur);if(i<0||!list.length)return;
 const nx=list[(i+dir+list.length)%list.length];const w=nx.f.widgets[0];scrollToBox(w.page,w.box);setTimeout(()=>{if(['checkbox','radio','button'].includes(nx.f.kind)){S.flash={page:w.page,r:w.box};redrawPage(w.page);setTimeout(()=>{S.flash=null;redrawPage(w.page)},900);focusBtn(nx.f,w)}else openEditor(nx.f,w)},120)}
// checkboxes/radios/buttons reached by Tab: Space toggles/presses, Tab moves on
function focusBtn(f,w){const sc=widgetScreen(w);if(!sc)return;const el=document.createElement('div');el.id='f3Ed';el.tabIndex=0;el.style.cssText=`position:fixed;left:${sc.x-2}px;top:${sc.y-2}px;width:${sc.w+4}px;height:${sc.h+4}px;z-index:60;border:2px solid #2563eb;border-radius:3px;outline:none`;
 document.body.appendChild(el);ed={f,w,name:f.name,el,input:null};el.addEventListener('keydown',e=>{e.stopPropagation();if(e.key===' '||e.key==='Enter'){e.preventDefault();activate(Object.assign({},f,{_w:w}))}else if(e.key==='Tab'){e.preventDefault();closeEditor(false);nextField(f.name,e.shiftKey?-1:1)}else if(e.key==='Escape')closeEditor(false)});
 el.addEventListener('blur',()=>setTimeout(()=>{if(ed&&ed.el===el)closeEditor(false)},80));el.focus()}
function editDialog(f){const p=propsOf(f);modal(f.name,`<${p.multiline?'textarea':'input'} class="ti" id="fdV">${p.multiline?esc(valOf(f)||''):''}${p.multiline?'</textarea>':''}`,[{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>setVal(f.name,md.querySelector('#fdV').value)}]);if(!p.multiline)$('#fdV').value=valOf(f)||''}
// a click on a field on the page
function activate(f){const p=propsOf(f);if(f.kind==='button')return runAction(p.action,f.name);
 if(p.readOnly){toast('That field is read-only');return}
 if(f.kind==='checkbox')return setVal(f.name,!valOf(f));if(f.kind==='radio')return setVal(f.name,f._w&&f._w.exportValue||'');
 if(f.kind==='signature'){toast('Use Sign & Seal to place a signature here');return}
 openEditor(f,f._w||f.widgets[0])}
['scroll','wheel'].forEach(t=>addEventListener(t,e=>{if(ed&&!ed.el.contains(e.target))closeEditor(true)},true));

/* =====================================================================================
   7. Actions (buttons)
   ===================================================================================== */
const ACTIONS=[['none','No action'],['reset','Reset form'],['submit','Submit (save form data)'],['page','Go to page'],['url','Open web address'],['showhide','Show / hide a field'],['script','Run a PlanMark script'],['js','Run JavaScript']];
async function runAction(a,from){if(!a||!a.type||a.type==='none'){toast('This button has no action');return}
 if(a.type==='reset'){resetForm(null);return}
 if(a.type==='submit'){const miss=missingRequired();if(miss.length){toast('Fill in the required fields: '+miss.slice(0,4).join(', ')+(miss.length>4?'…':''));redrawAll();return}
  if(a.arg&&/^https?:/i.test(a.arg)){toast('Form data saved as XFDF — send it to '+a.arg)}await exportData(a.fmt||'xfdf');return}
 if(a.type==='page'){const n=parseInt(a.arg,10);if(n>=1&&n<=S.pages.length)gotoPage(n);else toast('That page does not exist');return}
 if(a.type==='url'){let u=String(a.arg||'').trim();if(!u)return;if(!/^(https?|mailto):/i.test(u))u='https://'+u;window.open(u,'_blank','noopener');return}
 if(a.type==='showhide'){const names=String(a.arg||'').split(',').map(s=>s.trim()).filter(Boolean);for(const n of names){const x=fieldByName(n);if(!x)continue;const show=a.show==='toggle'?propsOf(x.f).hidden:!!a.show;FS().hidden[n]=!show}saveScales();redrawAll();renderForms();return}
 if(a.type==='script'){const sc=scripts().find(s=>s.name===a.arg);if(!sc){toast('No script named "'+a.arg+'"');return}return runScriptOnCurrent(sc)}
 if(a.type==='js'){if(!prefs().js){toast('Form JavaScript is turned off in Forms settings');return}try{runFieldJS(a.code||'',from,valOf(fieldByName(from).f),'Mouse Up');recalc();saveScales();redrawAll();renderForms()}catch(e){toast('Script error: '+e.message)}}}
function missingRequired(){return allFieldsRaw().filter(x=>{const p=propsOf(x.f);const v=valOf(x.f);return p.required&&!p.hidden&&(v===''||v==null||v===false)}).map(x=>x.f.name)}
function resetForm(names,quiet){const F=FS();for(const x of allFieldsRaw()){if(names&&!names.includes(x.f.name))continue;const p=propsOf(x.f);if(p.default!==''&&p.default!=null)F.values[x.f.name]=p.default;else if(x.created)delete F.values[x.f.name];else F.values[x.f.name]=x.f.kind==='checkbox'?false:''}
 recalc();saveScales();hook('change');redrawAll();renderForms();if(!quiet)toast('Form reset')}

/* =====================================================================================
   8. Creating fields and editing their properties
   ===================================================================================== */
let pendingKind=null;const FKEYS={t:'text',m:'multiline',c:'checkbox',r:'radio',d:'dropdown',l:'list',b:'button',s:'signature',a:'date'};
function uniqueName(base,except){const taken=new Set([...FM.fields.map(f=>f.name),...FS().created.filter(x=>!except||!except.includes(x)).map(x=>x.name)]);let nn=base,i=2;while(taken.has(nn))nn=base+'_'+i++;return nn}
function fieldDialog(pg,box,existing){const c=existing;const kind0=c?(c.multiline&&c.kind==='text'?'multiline':c.kind):(pendingKind||'text');pendingKind=null;
 const radios=[...new Set(FS().created.filter(x=>x.kind==='radio').map(x=>x.name))];
 modal(c?'Edit form field':'New form field',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Type</label><select class="ti" id="ffT">${KINDS.map(([v,l])=>`<option value="${v}" ${kind0===v?'selected':''}>${l}</option>`).join('')}</select></div>
 <div><label style="font-size:11px;color:var(--mut)">Name</label><input class="ti" id="ffN" list="ffRG" value="${esc(c?c.name:(kind0==='radio'&&radios.length?radios[radios.length-1]:(kind0==='button'?'Button':'Field')+(FS().created.length+1)))}"><datalist id="ffRG">${radios.map(r=>`<option value="${esc(r)}">`).join('')}</datalist></div></div>
 <div class="fld" id="ffOW"><label id="ffOL">Options (comma separated)</label><input class="ti" id="ffO" value="${esc(c?(c.kind==='radio'?c.exportValue||'':c.kind==='button'?c.caption||'':(c.options||[]).join(', ')):'')}"></div>
 <div class="hint" id="ffH"></div>`,
 [{label:'Cancel',cancel:1},...(c?[{label:'Delete',fn:()=>{const F=FS();F.created=F.created.filter(x=>x!==c);if(!F.created.some(x=>x.name===c.name))delete F.values[c.name];saveScales();commit();renderForms()}}]:[]),{label:c?'Save':'Add field',pri:1,fn:md=>{
  let kind=md.querySelector('#ffT').value,ml=false;if(kind==='multiline'){kind='text';ml=true}
  let name=md.querySelector('#ffN').value.trim().replace(/[.\s]+/g,'_')||'Field';const opt=md.querySelector('#ffO').value;
  // radio buttons join an existing group of the same name
  const sameGroup=kind==='radio'&&FS().created.some(x=>x.kind==='radio'&&x.name===name&&x!==c);
  const nn=sameGroup?name:uniqueName(name,c?FS().created.filter(x=>x.name===c.name):null);
  const extra=kind==='radio'?{exportValue:opt.trim()||('Choice'+(FS().created.filter(x=>x.name===nn).length+1)),options:[]}:kind==='button'?{caption:opt.trim()||nn,options:[]}:{options:opt.split(',').map(s=>s.trim()).filter(Boolean)};
  if(c){const old=c.name;if(old!==nn){for(const x of FS().created)if(x.name===old)x.name=nn;const F=FS();if(old in F.values){F.values[nn]=F.values[old];delete F.values[old]}if(F.props[old]){F.props[nn]=F.props[old];delete F.props[old]}F.order=F.order.map(n=>n===old?nn:n)}Object.assign(c,{kind,multiline:ml},extra)}
  else FS().created.push(Object.assign({id:uid(),name:nn,kind,multiline:ml,page:pg,box},extra));
  saveScales();commit();renderForms();switchTab('forms')}}]);
 const upd=()=>{const k=$('#ffT').value;$('#ffOW').style.display=['dropdown','list','radio','button'].includes(k)?'':'none';$('#ffOL').textContent=k==='radio'?'Export value of this button (e.g. Yes, No, N/A)':k==='button'?'Button caption':'Options (comma separated)';
  $('#ffH').textContent=k==='signature'?'Signature fields are real signature fields in the saved PDF, ready for a certificate-based signing app.':k==='radio'?'Give radio buttons the same name to make them one group — only one can be on.':k==='button'?'Set what the button does in its Properties (✎ in the Forms panel).':''};
 $('#ffT').onchange=upd;upd()}
const fmtSel=(cur,opts)=>opts.map(([v,l])=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${l}</option>`).join('');
const DATEF=['mm/dd/yyyy','m/d/yyyy','mm/dd/yy','dd/mm/yyyy','yyyy-mm-dd','d-mmm-yyyy','mmm d, yyyy','mmmm d, yyyy','mm/yyyy','m/d/yy h:MM tt'];
function propsDialog(name){const x=fieldByName(name);if(!x)return;const f=x.f,p=propsOf(f),created=x.created,fo=p.format||{type:'none'},cv=p.calc||{op:'none'},vd=p.validate||{},ac=p.action||{type:'none'};
 const others=allFieldsRaw().map(y=>y.f.name).filter(n=>n!==name);const textish=['text','date','multiline'].includes(f.kind)||f.kind==='text';
 const sec=t=>`<div style="font-weight:600;margin:12px 0 4px;color:var(--text)">${t}</div>`;const L=t=>`<label style="font-size:11px;color:var(--mut)">${t}</label>`;
 modal('Field properties — '+name,`<div style="max-height:62vh;overflow:auto;padding-right:4px">
 ${sec('General')}<div class="row fld"><div>${L('Name')}<input class="ti" id="fpN" value="${esc(name)}" ${created?'':'disabled title="Names of fields already in the PDF stay as they are"'}></div><div>${L('Type')}<input class="ti" value="${esc(KLAB[f.kind]||f.kind)}" disabled></div></div>
 <div class="fld">${L('Tooltip')}<input class="ti" id="fpTip" value="${esc(p.tooltip)}"></div>
 <div class="row" style="gap:12px;flex-wrap:wrap"><label class="chk"><input type="checkbox" id="fpReq" ${p.required?'checked':''}> Required</label><label class="chk"><input type="checkbox" id="fpRO" ${p.readOnly?'checked':''}> Read-only</label><label class="chk"><input type="checkbox" id="fpHid" ${p.hidden?'checked':''}> Hidden</label>${textish?`<label class="chk"><input type="checkbox" id="fpML" ${p.multiline?'checked':''}> Multi-line</label>`:''}</div>
 ${sec('Appearance')}<div class="row fld"><div>${L('Font size (0 = auto)')}<input class="ti" type="number" min="0" id="fpFS" value="${esc(p.fontSize||0)}"></div><div>${L('Alignment')}<select class="ti" id="fpAl">${fmtSel(p.align,[['left','Left'],['center','Center'],['right','Right']])}</select></div>${textish?`<div>${L('Max characters (0 = none)')}<input class="ti" type="number" min="0" id="fpMax" value="${esc(p.maxLen||0)}"></div>`:''}</div>
 ${f.kind==='button'?`<div class="fld">${L('Caption')}<input class="ti" id="fpCap" value="${esc(p.caption||name)}"></div>`:''}
 ${['dropdown','list'].includes(f.kind)?`<div class="fld">${L('Options (comma separated)')}<input class="ti" id="fpOpt" value="${esc((f.options||[]).join(', '))}" ${created?'':'disabled'}></div>`:''}
 ${f.kind!=='button'&&f.kind!=='signature'?`<div class="fld">${L('Default value')}<input class="ti" id="fpDef" value="${esc(p.default??'')}"></div>`:''}
 ${textish?`${sec('Format')}<div class="row fld"><div>${L('Category')}<select class="ti" id="fpFT">${fmtSel(fo.type||'none',[['none','None'],['number','Number / currency'],['percent','Percent'],['date','Date'],['special','Special (ZIP, phone, SSN)'],['js','Custom JavaScript']])}</select></div>
  <div data-ft="number percent">${L('Decimals')}<input class="ti" type="number" min="0" max="10" id="fpDec" value="${esc(fo.dec??2)}"></div>
  <div data-ft="number percent">${L('Separator')}<select class="ti" id="fpSep">${fmtSel(fo.sep||0,[[0,'1,234.56'],[1,'1234.56'],[2,'1.234,56'],[3,'1234,56']])}</select></div></div>
  <div class="row fld" data-ft="number"><div>${L('Currency symbol')}<input class="ti" id="fpCur" value="${esc(fo.cur||'')}" placeholder="$"></div><div>${L('Negative numbers')}<select class="ti" id="fpNeg">${fmtSel(fo.neg||0,[[0,'-1,234.56'],[2,'(1,234.56)']])}</select></div></div>
  <div class="fld" data-ft="date">${L('Date format')}<select class="ti" id="fpDate">${fmtSel(fo.date||'mm/dd/yyyy',[...new Set([...DATEF,fo.date||'mm/dd/yyyy'])].map(d=>[d,d+'  ('+fmtDate(new Date(2026,10,22,14,5),d)+')']))}</select></div>
  <div class="fld" data-ft="special">${L('Special format')}<select class="ti" id="fpSpec">${fmtSel(fo.special||'zip',[['zip','ZIP code'],['zip4','ZIP + 4'],['phone','Phone number'],['ssn','Social Security number']])}</select></div>
  <div class="fld" data-ft="js">${L('Format script')}<textarea class="ti" id="fpFJ" rows="3" style="font-family:monospace">${esc(fo.code||'')}</textarea></div>
  ${sec('Validation')}<div class="row fld"><div>${L('Minimum')}<input class="ti" type="number" id="fpMin" value="${esc(vd.min??'')}"></div><div>${L('Maximum')}<input class="ti" type="number" id="fpMaxV" value="${esc(vd.max??'')}"></div></div>
  ${sec('Calculation')}<div class="fld"><select class="ti" id="fpCT">${fmtSel(cv.op||'none',[['none','Not calculated'],['sum','Sum (+) of fields'],['product','Product (×) of fields'],['avg','Average of fields'],['min','Minimum of fields'],['max','Maximum of fields'],['sfn','Simplified field notation (e.g. qty * price)'],['js','Custom JavaScript']])}</select></div>
  <div class="fld" data-ct="sum product avg min max"><div id="fpCF" style="max-height:120px;overflow:auto;border:1px solid var(--line);border-radius:4px;padding:4px">${others.map(n=>`<label class="chk" style="display:block"><input type="checkbox" value="${esc(n)}" ${(cv.fields||[]).includes(n)?'checked':''}> ${esc(n)}</label>`).join('')||'<span class="hint">No other fields</span>'}</div></div>
  <div class="fld" data-ct="sfn"><input class="ti" id="fpSFN" value="${esc(cv.expr||'')}" placeholder="qty * price"><div class="hint">Use field names with + − × ÷ and brackets. Put \\ before a space or symbol inside a name.</div></div>
  <div class="fld" data-ct="js"><textarea class="ti" id="fpCJ" rows="4" style="font-family:monospace">${esc(cv.code||'')}</textarea><div class="hint">Acrobat-style: event.value = this.getField("a").value * 2;</div></div>`:''}
 ${f.kind==='button'?`${sec('Action when clicked')}<div class="fld"><select class="ti" id="fpAT">${fmtSel(ac.type||'none',ACTIONS)}</select></div>
  <div class="fld" data-at="page">${L('Page number')}<input class="ti" type="number" min="1" id="fpAP" value="${esc(ac.type==='page'?ac.arg:1)}"></div>
  <div class="fld" data-at="url">${L('Web address')}<input class="ti" id="fpAU" value="${esc(ac.type==='url'?ac.arg:'')}" placeholder="https://"></div>
  <div class="fld" data-at="submit">${L('Data format')}<select class="ti" id="fpAF">${fmtSel(ac.fmt||'xfdf',[['xfdf','XFDF'],['fdf','FDF'],['csv','CSV'],['xml','XML']])}</select></div>
  <div class="row fld" data-at="showhide"><div>${L('Fields (comma separated)')}<input class="ti" id="fpAH" list="fpAHL" value="${esc(ac.type==='showhide'?ac.arg:'')}"><datalist id="fpAHL">${others.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div><div>${L('Do')}<select class="ti" id="fpAS">${fmtSel(String(ac.show??'toggle'),[['true','Show'],['false','Hide'],['toggle','Toggle']])}</select></div></div>
  <div class="fld" data-at="script">${L('Script')}<select class="ti" id="fpASc">${scripts().map(s=>`<option ${ac.arg===s.name?'selected':''}>${esc(s.name)}</option>`).join('')||'<option value="">(make one in Script Manager)</option>'}</select></div>
  <div class="fld" data-at="js"><textarea class="ti" id="fpAJ" rows="3" style="font-family:monospace">${esc(ac.code||'')}</textarea></div>`:''}
 </div>`,[{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>{const q=s=>md.querySelector(s),val=s=>q(s)?q(s).value:undefined,chk=s=>q(s)?q(s).checked:undefined;
  const o={tooltip:val('#fpTip'),required:chk('#fpReq'),readOnly:chk('#fpRO'),hidden:chk('#fpHid'),fontSize:+val('#fpFS')||0,align:val('#fpAl')};
  if(q('#fpML'))o.multiline=chk('#fpML');if(q('#fpMax'))o.maxLen=+val('#fpMax')||0;if(q('#fpCap'))o.caption=val('#fpCap');if(q('#fpDef'))o.default=val('#fpDef');
  if(q('#fpFT')){const t=val('#fpFT');o.format=t==='none'?{type:'none'}:t==='number'?{type:'number',dec:+val('#fpDec'),sep:+val('#fpSep'),cur:val('#fpCur'),neg:+val('#fpNeg')}:t==='percent'?{type:'percent',dec:+val('#fpDec'),sep:+val('#fpSep')}:t==='date'?{type:'date',date:val('#fpDate')}:t==='special'?{type:'special',special:val('#fpSpec')}:{type:'js',code:val('#fpFJ')};
   o.validate={min:val('#fpMin'),max:val('#fpMaxV')};const ct=val('#fpCT');
   if(ct==='sfn'){try{const e=sfnParse(val('#fpSFN'));const bad=[...sfnNames(e)].filter(n=>!fieldByName(n));if(bad.length){toast('Unknown field: '+bad.join(', '));return false}}catch(e){toast('Calculation: '+e.message);return false}}
   if(ct==='js'){try{JSI.parse(val('#fpCJ'))}catch(e){toast('Script: '+e.message);return false}}
   o.calc=ct==='none'?null:['sum','product','avg','min','max'].includes(ct)?{op:ct,fields:[...md.querySelectorAll('#fpCF input:checked')].map(i=>i.value)}:ct==='sfn'?{op:'sfn',expr:val('#fpSFN')}:{op:'js',code:val('#fpCJ')}}
  if(q('#fpAT')){const t=val('#fpAT');o.action=t==='none'?{type:'none'}:t==='page'?{type:'page',arg:val('#fpAP')}:t==='url'?{type:'url',arg:val('#fpAU')}:t==='submit'?{type:'submit',fmt:val('#fpAF')}:t==='showhide'?{type:'showhide',arg:val('#fpAH'),show:val('#fpAS')==='toggle'?'toggle':val('#fpAS')==='true'}:t==='script'?{type:'script',arg:val('#fpASc')}:t==='js'?{type:'js',code:val('#fpAJ')}:{type:t}}
  const F=FS();delete F.hidden[name];
  let nm=name;if(created){const nn=String(val('#fpN')||'').trim().replace(/[.\s]+/g,'_');if(nn&&nn!==name){const cs=F.created.filter(c=>c.name===name);nm=uniqueName(nn,cs);for(const c of cs)c.name=nm;if(name in F.values){F.values[nm]=F.values[name];delete F.values[name]}F.order=F.order.map(n=>n===name?nm:n)}
   if(q('#fpOpt')){const opts=val('#fpOpt').split(',').map(s=>s.trim()).filter(Boolean);for(const c of F.created.filter(c=>c.name===nm))c.options=opts}if(o.caption!=null)for(const c of F.created.filter(c=>c.name===nm))c.caption=o.caption}
  F.props[nm]=o;if(name!==nm)delete F.props[name];if(o.calc&&!(F.calcOrder||[]).includes(nm)&&F.calcOrder)F.calcOrder.push(nm);
  recalc();saveScales();commit();redrawAll();renderForms()}}]);
 const md=$('#modal');const sync=()=>{const ft=q2('#fpFT'),ct=q2('#fpCT'),at=q2('#fpAT');md.querySelectorAll('[data-ft]').forEach(e=>e.style.display=ft&&e.dataset.ft.split(' ').includes(ft)?'':'none');md.querySelectorAll('[data-ct]').forEach(e=>e.style.display=ct&&e.dataset.ct.split(' ').includes(ct)?'':'none');md.querySelectorAll('[data-at]').forEach(e=>e.style.display=at&&e.dataset.at===at?'':'none')};
 const q2=s=>{const e=md.querySelector(s);return e?e.value:null};md.addEventListener('change',sync);sync()}

/* =====================================================================================
   9. Form data: FDF, XFDF, CSV, XML — export, import, merge
   ===================================================================================== */
function dataPairs(){return allFields().filter(x=>!['button','signature'].includes(x.f.kind)).map(x=>{const v=valOf(x.f);return[x.f.name,x.f.kind==='checkbox'?(v?'Yes':'Off'):v==null?'':String(v)]})}
const pdfStr=s=>'('+String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r/g,'\\r').replace(/\n/g,'\\n')+')';
const xmlEsc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function makeData(fmt,pairs,fileName){pairs=pairs||dataPairs();const fn=fileName||S.fileName||'form.pdf';
 if(fmt==='fdf')return`%FDF-1.2\n%âãÏÓ\n1 0 obj\n<< /FDF << /F ${pdfStr(fn)} /Fields [\n${pairs.map(([n,v])=>`<< /T ${pdfStr(n)} /V ${v==='Yes'||v==='Off'?'/'+v:pdfStr(v)} >>`).join('\n')}\n] >> >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
 if(fmt==='xfdf')return`<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n<f href="${xmlEsc(fn)}"/>\n<fields>\n${pairs.map(([n,v])=>`<field name="${xmlEsc(n)}"><value>${xmlEsc(v)}</value></field>`).join('\n')}\n</fields>\n</xfdf>\n`;
 if(fmt==='csv')return pairs.map(p=>csvCell(p[0])).join(',')+'\r\n'+pairs.map(p=>csvCell(p[1])).join(',')+'\r\n';
 if(fmt==='xml')return`<?xml version="1.0" encoding="UTF-8"?>\n<fields xmlns:xfdf="http://ns.adobe.com/xfdf-transition/">\n${pairs.map(([n,v])=>/^[A-Za-z_][\w.\-]*$/.test(n)?`<${n}>${xmlEsc(v)}</${n}>`:`<field xfdf:original="${xmlEsc(n)}">${xmlEsc(v)}</field>`).join('\n')}\n</fields>\n`;
 return''}
async function exportData(fmt){if(!S.pdf)return toast('Open a PDF first');await download(baseNm()+'-data.'+fmt,makeData(fmt),{fdf:'application/vnd.fdf',xfdf:'application/vnd.adobe.xfdf',csv:'text/csv',xml:'application/xml'}[fmt]);toast('Form data exported')}
function unPdfStr(s){return s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g,(m,c)=>c==='n'?'\n':c==='r'?'\r':c==='t'?'\t':c==='b'?'\b':c==='f'?'\f':/^[0-7]/.test(c)?String.fromCharCode(parseInt(c,8)):/\n/.test(c)?'':c)}
function parseFDF(t){const out=[];const re=/\/T\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>)\s*\/V\s*(\((?:\\.|[^\\)])*\)|\/[^\s/>\]]+|<[0-9A-Fa-f\s]*>|\[[^\]]*\])/g;let m;
 const dec=s=>{if(s[0]==='('){let r=unPdfStr(s.slice(1,-1));if(r.charCodeAt(0)===0xfe&&r.charCodeAt(1)===0xff){let o='';for(let i=2;i+1<r.length;i+=2)o+=String.fromCharCode(r.charCodeAt(i)*256+r.charCodeAt(i+1));r=o}return r}
  if(s[0]==='<'){const h=s.slice(1,-1).replace(/\s/g,'');let r='';for(let i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));if(r.charCodeAt(0)===0xfe){let o='';for(let i=2;i+1<r.length;i+=2)o+=String.fromCharCode(r.charCodeAt(i)*256+r.charCodeAt(i+1));r=o}return r}
  if(s[0]==='/')return s.slice(1).replace(/#([0-9a-f]{2})/gi,(m,h)=>String.fromCharCode(parseInt(h,16)));if(s[0]==='[')return(s.match(/\((?:\\.|[^\\)])*\)/)||['()'])[0].slice(1,-1);return s};
 while((m=re.exec(t)))out.push([dec(m[1]),dec(m[2])]);return out}
function parseXFDF(t){const d=new DOMParser().parseFromString(t,'application/xml');const out=[];
 const walk=(el,prefix)=>{for(const c of el.children){if(c.localName!=='field')continue;const n=(prefix?prefix+'.':'')+c.getAttribute('name');const v=[...c.children].find(x=>x.localName==='value');if(v)out.push([n,v.textContent]);walk(c,n)}};
 const fields=[...d.getElementsByTagNameNS('*','fields')][0];if(fields)walk(fields,'');return out}
function parseXML(t){const d=new DOMParser().parseFromString(t,'application/xml');if(d.querySelector('parsererror'))throw new Error('Not valid XML');const root=d.documentElement;const out=[];
 for(const c of root.children){const orig=c.getAttributeNS('http://ns.adobe.com/xfdf-transition/','original')||c.getAttribute('xfdf:original');out.push([orig||c.localName,c.textContent])}return out}
function applyPairs(pairs){const F=FS();let n=0;const miss=[];for(const[name,v]of pairs){const x=fieldByName(name);if(!x){miss.push(name);continue}
 F.values[name]=x.f.kind==='checkbox'?(v&&v!=='Off'&&v!=='false'&&v!=='0'&&v!==''):v;n++}
 recalc();saveScales();hook('change');redrawAll();renderForms();toast(`Filled ${n} field${n===1?'':'s'}${miss.length?` — ${miss.length} not on this form`:''}`);return n}
async function importData(){if(!S.pdf)return toast('Open a PDF first');const[f]=await pickFiles('.fdf,.xfdf,.csv,.xml,.txt',false);if(!f)return;const t=await f.text();const ext=(f.name.match(/\.(\w+)$/)||[])[1]||'';
 try{if(/fdf/i.test(ext)&&/^%FDF/.test(t))return applyPairs(parseFDF(t));if(/xfdf/i.test(ext)||/<xfdf/.test(t))return applyPairs(parseXFDF(t));if(/xml/i.test(ext)||/^\s*</.test(t))return applyPairs(parseXML(t));
  const rows=parseCSV(t);if(rows.length<2)return toast('The CSV needs a header row of field names and a row of values');if(rows.length===2)return applyPairs(rows[0].map((h,i)=>[h,rows[1][i]??'']));
  csvRowsDialog(rows)}catch(e){toast('Import failed: '+e.message)}}
// CSV with many rows: fill from one row, or make one filled PDF per row (merge)
function csvRowsDialog(rows){const hdr=rows[0],data=rows.slice(1);const fileCol=hdr.findIndex(h=>/^(file|filename|file name)$/i.test(h));
 modal('Import form data',`<div class="hint">${data.length} rows found.</div><div class="fld"><label>Fill this form with row</label><select class="ti" id="f3Row">${data.map((r,i)=>`<option value="${i}">${i+1}: ${esc(r.filter(Boolean).slice(0,3).join(' · ').slice(0,60))}</option>`).join('')}</select></div>`,
 [{label:'Cancel',cancel:1},{label:'One PDF per row',fn:()=>{setTimeout(()=>mergeRows(hdr,data,fileCol),0)}},{label:'Fill with row',pri:1,fn:md=>{const r=data[+md.querySelector('#f3Row').value];applyPairs(hdr.map((h,i)=>[h,r[i]??'']).filter((p,i)=>i!==fileCol))}}])}
async function captureExport(flat){const orig=window.saveFile;let got=null;window.saveFile=async(name,data)=>{got={name,bytes:new Uint8Array(await data.arrayBuffer())}};try{await exportPDF(!!flat)}finally{window.saveFile=orig}return got}
async function mergeRows(hdr,data,fileCol){const F=FS(),keep=JSON.parse(JSON.stringify(F.values)),out=[];const pg=progress('One PDF per row');
 try{for(let i=0;i<data.length;i++){if(pg.cancelled)break;pg.msg(`Row ${i+1} of ${data.length}`);pg.bar(i/data.length);F.values=JSON.parse(JSON.stringify(keep));
   for(let j=0;j<hdr.length;j++){if(j===fileCol)continue;const x=fieldByName(hdr[j]);if(!x)continue;const v=data[i][j]??'';F.values[hdr[j]]=x.f.kind==='checkbox'?(v&&v!=='Off'&&v!=='0'):v}recalc(true);
   const r=await captureExport(false);if(r){let nm=fileCol>=0&&data[i][fileCol]?String(data[i][fileCol]).replace(/[\\/:*?"<>|]/g,'_'):baseNm()+'-'+String(i+1).padStart(3,'0');if(!/\.pdf$/i.test(nm))nm+='.pdf';out.push({name:nm,bytes:r.bytes})}}}
 finally{F.values=keep;recalc(true);saveScales();redrawAll();renderForms();pg.done()}
 if(out.length)await PMBatch2.deliver(out,baseNm()+'-merged.zip');toast(`Made ${out.length} filled PDF${out.length===1?'':'s'}`);return out}
// export data from many PDFs into one spreadsheet (one row per file)
async function valuesOfPdf(bytes,name){const vals={};try{const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;const fo=await doc.getFieldObjects();
  if(fo)for(const[n,arr]of Object.entries(fo)){const w=arr.find(a=>a.value!==undefined&&a.value!==null&&a.value!=='')||arr[0];let v=w.value;if(w.type==='checkbox')v=v&&v!=='Off'?'Yes':'Off';if(w.type==='radiobutton'){const on=arr.find(a=>a.value&&a.value!=='Off');v=on?on.value:''}vals[n]=Array.isArray(v)?v.join('|'):v==null?'':String(v)}}catch(e){}
 try{const pm=await PMBatch2.readPM(bytes,name);const fv=pm&&pm.scales&&pm.scales.forms&&pm.scales.forms.values;if(fv)for(const[n,v]of Object.entries(fv))vals[n]=v===true?'Yes':v===false?'Off':String(v??'')}catch(e){}
 return vals}
async function exportMany(){const files=await pickFiles('application/pdf,.pdf',true);if(!files.length)return;const pg=progress('Export form data');const rows=[],cols=new Set();
 try{for(let i=0;i<files.length;i++){pg.msg(files[i].name);pg.bar(i/files.length);const v=await valuesOfPdf(new Uint8Array(await files[i].arrayBuffer()),files[i].name);Object.keys(v).forEach(k=>cols.add(k));rows.push([files[i].name,v])}}finally{pg.done()}
 const C=[...cols];const csv=['File',...C].map(csvCell).join(',')+'\r\n'+rows.map(([n,v])=>[n,...C.map(c=>v[c]??'')].map(csvCell).join(',')).join('\r\n')+'\r\n';await download('form-data.csv',csv,'text/csv');toast(`Exported ${rows.length} file${rows.length===1?'':'s'} to one spreadsheet`);return csv}
// typewriter / text box markups that sit on top of empty text fields become the field values
function migrateTyped(){let n=0;const F=FS();const kill=new Set();const fields=allFieldsRaw().filter(x=>['text','date','multiline'].includes(x.f.kind)||x.f.kind==='text');
 for(const m of S.markups){if(!['text','typewriter','callout'].includes(m.type)||!m.text||!String(m.text).trim()||m.type==='callout')continue;const xs=m.pts.map(p=>p[0]),ys=m.pts.map(p=>p[1]);let cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  if(m.pts.length===1){cx=m.pts[0][0]+4;cy=m.pts[0][1]+3}
  const hit=fields.find(x=>x.f.widgets.some(w=>w.page===m.page&&cx>=w.box[0]-2&&cx<=w.box[2]+2&&cy>=w.box[1]-4&&cy<=w.box[3]+4));if(!hit)continue;
  const cur=valOf(hit.f);F.values[hit.f.name]=cur&&String(cur).trim()?String(cur)+' '+String(m.text).trim():String(m.text).trim();kill.add(m.id);n++}
 if(!n){toast('No typed text found on top of form fields');return 0}pushUndo();S.markups=S.markups.filter(m=>!kill.has(m.id));recalc();saveScales();commit();redrawAll();renderForms();toast(`Moved ${n} typed text${n===1?'':'s'} into form fields`);return n}

/* =====================================================================================
   10. Saving into the PDF: real AcroForm fields, properties, formats, calculations, actions, JavaScript
   ===================================================================================== */
H.exportPage.push(async(doc,pages,font)=>{const F=S.scales.forms;const hasDoc=(F&&F.docJS&&F.docJS.length);
 if(!F||(!Object.keys(F.values||{}).length&&!(F.created||[]).length&&!F.flatten&&!Object.keys(F.props||{}).length&&!Object.keys(F.hidden||{}).length&&!F.order.length&&!hasDoc&&!F.calcOrder))return;
 const L=PDFLib,form=doc.getForm(),ctx=doc.context,N=n=>L.PDFName.of(n),HS=t=>L.PDFHexString.fromText(String(t));
 const jsA=code=>ctx.obj({S:'JavaScript',JS:HS(code)});const done=new Set(),post=[];
 const getF=name=>{try{return form.getFieldMaybe?form.getFieldMaybe(name):form.getField(name)}catch(e){return null}};
 // 1) create PlanMark fields
 for(const[name,cs]of createdGroups()){const c=cs[0],v=(F.values||{})[name],p=propsOf(Object.assign({},c,{widgets:[]}));
  const geo=x=>{const vp=S.pages[x.page-1]&&S.pages[x.page-1].vp;if(!pages[x.page-1]||!vp)return null;const q=[vp.convertToPdfPoint(x.box[0],x.box[1]),vp.convertToPdfPoint(x.box[2],x.box[3])];return{page:pages[x.page-1],x:Math.min(q[0][0],q[1][0]),y:Math.min(q[0][1],q[1][1]),width:Math.abs(q[1][0]-q[0][0]),height:Math.abs(q[1][1]-q[0][1])}};
  try{if(c.kind==='checkbox'){const g=geo(c);if(!g)continue;const cb=form.createCheckBox(name);cb.addToPage(g.page,{x:g.x,y:g.y,width:g.width,height:g.height});if(v)cb.check()}
   else if(c.kind==='radio'){const rg=form.createRadioGroup(name);for(const x of cs){const g=geo(x);if(!g)continue;rg.addOptionToPage(x.exportValue||'Choice',g.page,{x:g.x,y:g.y,width:g.width,height:g.height})}if(v)try{rg.select(String(v))}catch(e){}}
   else if(c.kind==='dropdown'){const g=geo(c);if(!g)continue;const dd=form.createDropdown(name);dd.addOptions(c.options&&c.options.length?c.options:[' ']);dd.addToPage(g.page,{x:g.x,y:g.y,width:g.width,height:g.height,font});if(v)try{dd.select(String(v))}catch(e){}}
   else if(c.kind==='list'){const g=geo(c);if(!g)continue;const ol=form.createOptionList(name);ol.addOptions(c.options&&c.options.length?c.options:[' ']);ol.addToPage(g.page,{x:g.x,y:g.y,width:g.width,height:g.height,font});if(v)try{ol.select(String(v))}catch(e){}}
   else if(c.kind==='signature'){const g=geo(c);if(!g)continue;const ref=ctx.register(ctx.obj({Type:'Annot',Subtype:'Widget',FT:'Sig',T:L.PDFString.of(name),Rect:[g.x,g.y,g.x+g.width,g.y+g.height],F:4,P:g.page.ref,MK:ctx.obj({BC:[0,0,.6]})}));g.page.node.addAnnot(ref);form.acroForm.addField(ref)}
   else if(c.kind==='button'){const g=geo(c);if(!g)continue;const b=form.createButton(name);b.addToPage(p.caption||c.caption||name,g.page,{x:g.x,y:g.y,width:g.width,height:g.height,font,backgroundColor:L.rgb(.9,.91,.92),borderColor:L.rgb(.45,.47,.5),borderWidth:1})}
   else{const g=geo(c);if(!g)continue;const tf=form.createTextField(name);if(c.multiline||p.multiline)tf.enableMultiline();tf.addToPage(g.page,{x:g.x,y:g.y,width:g.width,height:g.height,font})}}catch(e){console.warn('create field',name,e)}}
 // 2) values, properties, formats, calculations and actions for every field
 const coRefs=[];
 for(const x of allFieldsRaw()){const name=x.f.name,fld=getF(name);if(!fld)continue;const p=propsOf(x.f),v=valOf(x.f),d=fld.acroField.dict;
  try{if(fld instanceof L.PDFTextField){if(p.multiline)fld.enableMultiline();if(p.maxLen)try{fld.setMaxLength(p.maxLen)}catch(e){}else if(x.created)try{fld.removeMaxLength()}catch(e){}
    try{fld.setAlignment({left:L.TextAlignment.Left,center:L.TextAlignment.Center,right:L.TextAlignment.Right}[p.align]||L.TextAlignment.Left)}catch(e){}
    if(p.fontSize)try{fld.setFontSize(p.fontSize)}catch(e){}
    const raw=v==null?'':String(v),shown=display(raw,p);const txt=p.maxLen?shown.slice(0,Math.max(p.maxLen,shown.length)):shown;
    try{if(p.maxLen&&txt.length>p.maxLen)fld.removeMaxLength();fld.setText(txt);if(p.maxLen&&txt.length>p.maxLen)fld.setMaxLength(p.maxLen)}catch(e){fld.setText(raw)}
    if(txt!==raw)post.push(()=>{d.set(N('V'),HS(raw))})}
   else if(fld instanceof L.PDFCheckBox){v?fld.check():fld.uncheck()}
   else if(fld instanceof L.PDFRadioGroup){if(v)try{fld.select(String(v))}catch(e){}else fld.clear()}
   else if(fld instanceof L.PDFDropdown||fld instanceof L.PDFOptionList){if(v)try{fld.select(String(v))}catch(e){}else fld.clear()}
   p.required?fld.enableRequired():fld.disableRequired();p.readOnly?fld.enableReadOnly():fld.disableReadOnly();
   if(p.tooltip)d.set(N('TU'),HS(p.tooltip));else d.delete(N('TU'));
   if(p.default!==''&&p.default!=null&&!(fld instanceof L.PDFCheckBox)&&!(fld instanceof L.PDFButton))d.set(N('DV'),HS(p.default));
   // hidden: widget annotation flag (2 = Hidden), print flag otherwise
   for(const w of fld.acroField.getWidgets()){const fl=(w.dict.lookup(N('F'))||{}).asNumber?w.dict.lookup(N('F')).asNumber():4;w.dict.set(N('F'),ctx.obj(p.hidden?((fl|2)&~4):((fl&~2)|4)))}
   // additional actions
   const aa={};const fj=formatJS(p.format);if(fj){if(fj[0])aa.F=jsA(fj[0]);if(fj[1])aa.K=jsA(fj[1])}const cj=calcJS(p.calc);if(cj){aa.C=jsA(cj);coRefs.push([name,fld.ref])}const vj=validateJS(p.validate);if(vj)aa.V=jsA(vj);
   if(Object.keys(aa).length)d.set(N('AA'),ctx.obj(aa));else if(x.created)d.delete(N('AA'));
   if(fld instanceof L.PDFButton&&p.action&&p.action.type&&p.action.type!=='none'){const a=p.action;let act=null;
    if(a.type==='reset')act=ctx.obj({S:'ResetForm'});else if(a.type==='url'){let u=String(a.arg||'');if(u&&!/^(https?|mailto):/i.test(u))u='https://'+u;act=ctx.obj({S:'URI',URI:L.PDFString.of(u)})}
    else if(a.type==='page'){const pi=Math.max(1,Math.min(pages.length,parseInt(a.arg,10)||1));act=ctx.obj({S:'GoTo',D:[pages[pi-1].ref,N('Fit')]})}
    else if(a.type==='showhide'){const ns=String(a.arg||'').split(',').map(s=>s.trim()).filter(Boolean);act=a.show==='toggle'?jsA(ns.map(n=>`var f=this.getField(${jq(n)});if(f)f.display=f.display==display.hidden?display.visible:display.hidden;`).join('\n')):ctx.obj({S:'Hide',T:ns.length===1?HS(ns[0]):ctx.obj(ns.map(HS)),H:!a.show})}
    else if(a.type==='submit')act=jsA('this.exportAsXFDF();');else if(a.type==='script')act=jsA(`/* PlanMark script: ${String(a.arg||'').replace(/\*\//g,'')} */`);else if(a.type==='js')act=jsA(a.code||'');
    if(act)for(const w of fld.acroField.getWidgets())w.dict.set(N('A'),act)}
  }catch(e){console.warn('field props',name,e)}}
 // calculation order
 if(coRefs.length){const order=calcNames();coRefs.sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));form.acroForm.dict.set(N('CO'),ctx.obj(coRefs.map(r=>r[1])))}
 // document JavaScript
 if(F.docJS){try{const cat=doc.catalog;let names=cat.lookup(N('Names'));if(!(names instanceof L.PDFDict)){names=ctx.obj({});cat.set(N('Names'),names)}
  const arr=[];for(const s of F.docJS){arr.push(HS(s.name||'Script'));arr.push(ctx.register(jsA(s.code||'')))}names.set(N('JavaScript'),ctx.obj({Names:ctx.obj(arr)}))}catch(e){console.warn('doc js',e)}}
 try{form.updateFieldAppearances(font)}catch(e){}
 for(const f of post)try{f()}catch(e){}
 if(F.flatten)try{form.flatten()}catch(e){console.warn('flatten',e)}});

/* =====================================================================================
   11. Forms panel
   ===================================================================================== */
let fmode=false;
function renderForms(){const pane=$('#pane-forms');if(!pane)return;if(!S.pdf){pane.innerHTML='<div class="hint">Open a PDF to fill or build forms.</div>';return}const F=FS(),all=allFields(),pf=prefs(),miss=new Set(missingRequired());
 const keep=pane.scrollTop;
 pane.innerHTML=`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px">${btn('fmAdd','+ Field')}${btn('fmAuto','Auto-detect')}<button class="btn ${fmode?'on':''}" id="fmMode" style="border:1px solid var(--line)" title="Form editing mode: press T text, M multi-line, C checkbox, R radio, D dropdown, L list, B button, S signature, A date, then drag">Edit mode${fmode?' ✓':''}</button></div>
 <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:6px">${btn('fmImp','Import data…')}<select class="ti" id="fmExp" style="flex:1;min-width:120px"><option value="">Export data…</option><option value="fdf">FDF</option><option value="xfdf">XFDF</option><option value="csv">CSV</option><option value="xml">XML</option><option value="many">Many PDFs → one CSV…</option></select></div>
 <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px">${btn('fmReset','Reset form')}${btn('fmMig','Typed text → fields')}${btn('fmCalc','Calculation order')}${btn('fmJS','JavaScript…')}${btn('fmScr','Scripts…')}${btn('fmPref','⚙')}</div>
 <label class="chk fld"><input type="checkbox" id="fmShow" ${formShow?'checked':''}> Highlight fields</label><label class="chk fld"><input type="checkbox" id="fmFlat" ${F.flatten?'checked':''}> Flatten form when saving</label>
 ${all.length?`<div class="hint" style="margin:4px 0">Fields in tab order — drag or use ↑ ↓ to change it.${miss.size?` <b style="color:#f87171">${miss.size} required field${miss.size>1?'s':''} empty.</b>`:''}</div>`:'<div class="hint">This PDF has no form fields yet. Add fields, or Auto-detect blanks on a static form.</div>'}
 <div id="fmList">${all.map(({f,created},i)=>{const p=propsOf(f),v=valOf(f);let inp='';
  if(f.kind==='checkbox')inp=`<input type="checkbox" data-fv="${esc(f.name)}" ${v?'checked':''} ${p.readOnly?'disabled':''}>`;
  else if(f.kind==='radio')inp=`<select class="ti" data-fv="${esc(f.name)}" ${p.readOnly?'disabled':''}>${['',...new Set(f.widgets.map(w=>w.exportValue))].map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(f.kind==='dropdown'||f.kind==='list')inp=`<select class="ti" data-fv="${esc(f.name)}" ${p.readOnly?'disabled':''}>${['',...(f.options||[])].map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(f.kind==='signature')inp='<span class="hint">signature field</span>';else if(f.kind==='button')inp=`<button class="btn" data-fbtn="${esc(f.name)}" style="border:1px solid var(--line);height:24px">${esc(p.caption||f.name)}</button> <small class="hint">${esc((ACTIONS.find(a=>a[0]===(p.action&&p.action.type))||['','no action'])[1])}</small>`;
  else inp=`<input class="ti" data-fv="${esc(f.name)}" value="${esc(display(v,p))}" ${p.readOnly||p.calc?'readonly':''} ${p.tooltip?`title="${esc(p.tooltip)}"`:''} ${p.maxLen?`maxlength="${p.maxLen}"`:''}>`;
  return`<div class="f3Row" data-fname="${esc(f.name)}" style="border-bottom:1px solid #30363f;padding:5px 0;${p.hidden?'opacity:.5':''}"><div class="row" style="gap:4px;margin-bottom:3px;align-items:center"><span class="f3Grip" draggable="true" data-fdrag="${esc(f.name)}" style="cursor:grab;color:var(--mut);flex:0;padding:0 2px" title="Drag to change tab order">⋮⋮</span><a href="#" data-fgo="${esc(f.name)}" style="color:${miss.has(f.name)?'#f87171':'#7dd3fc'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}${p.required?' *':''}</a><small style="color:var(--mut);flex:0;white-space:nowrap">${f.kind}${p.calc?' ∑':''}${p.hidden?' hidden':''}${created?' · new':''}</small><button class="btn" data-fup="${i}" style="flex:0;height:22px;padding:0 4px" title="Earlier in tab order">↑</button><button class="btn" data-fdn="${i}" style="flex:0;height:22px;padding:0 4px" title="Later in tab order">↓</button><button class="btn" data-fprop="${esc(f.name)}" style="flex:0;height:22px;padding:0 5px" title="Properties">✎</button>${created?`<button class="btn" data-fed="${esc(f.id)}" style="flex:0;height:22px;padding:0 5px" title="Type, name, delete">⋯</button>`:''}</div>${inp}</div>`}).join('')}</div>`;
 pane.scrollTop=keep;
 $('#fmAdd').onclick=()=>{setTool('formfield');toast('Drag a box where the field goes')};$('#fmAuto').onclick=autoDetect;
 $('#fmShow').onchange=e=>{formShow=e.target.checked;LS.set('pm:formshow',formShow);redrawAll()};$('#fmFlat').onchange=e=>{FS().flatten=e.target.checked;saveScales()};
 $('#fmMode').onclick=()=>{fmode=!fmode;toast(fmode?'Form editing: press T, M, C, R, D, L, B, S or A, then drag a box':'Form editing off');renderForms()};
 $('#fmImp').onclick=importData;$('#fmExp').onchange=e=>{const v=e.target.value;e.target.value='';if(v==='many')exportMany();else if(v)exportData(v)};
 $('#fmReset').onclick=()=>modal('Reset form','<div class="hint">Clear every field (fields with a default value go back to it)?</div>',[{label:'Cancel',cancel:1},{label:'Reset',pri:1,fn:()=>resetForm(null)}]);
 $('#fmMig').onclick=migrateTyped;$('#fmCalc').onclick=calcOrderDialog;$('#fmJS').onclick=docJSDialog;$('#fmScr').onclick=scriptManager;$('#fmPref').onclick=prefsDialog}
function moveOrder(from,to){const names=allFields().map(x=>x.f.name);if(to<0||to>=names.length)return;const[n]=names.splice(from,1);names.splice(to,0,n);FS().order=names;saveScales();renderForms()}
function calcOrderDialog(){const names=calcNames();if(!names.length){toast('No calculated fields yet — set one up in a field’s Properties (✎)');return}let list=names.slice();
 const draw=()=>{const el=$('#f3CO');if(el)el.innerHTML=list.map((n,i)=>`<div class="row" style="gap:4px;padding:3px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${i+1}. ${esc(n)}</span><button class="btn" data-cu="${i}" style="flex:0;padding:0 5px">↑</button><button class="btn" data-cd="${i}" style="flex:0;padding:0 5px">↓</button></div>`).join('')};
 modal('Calculation order','<div class="hint">Fields are calculated top to bottom. Put a field after the fields it uses.</div><div id="f3CO" style="margin-top:6px"></div>',[{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:()=>{FS().calcOrder=list;recalc();saveScales();redrawAll();renderForms()}}]);
 draw();$('#f3CO').onclick=e=>{const u=e.target.closest('[data-cu]'),d=e.target.closest('[data-cd]');if(u){const i=+u.dataset.cu;if(i>0)[list[i-1],list[i]]=[list[i],list[i-1]]}if(d){const i=+d.dataset.cd;if(i<list.length-1)[list[i+1],list[i]]=[list[i],list[i+1]]}draw()}}
function prefsDialog(){const p=prefs();modal('Forms settings',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Highlight color</label><input type="color" class="ti" id="fpHl" value="${esc(p.hl)}"></div><div><label style="font-size:11px;color:var(--mut)">Highlight opacity %</label><input class="ti" type="number" min="0" max="100" id="fpOp" value="${esc(p.op)}"></div></div>
 <label class="chk fld"><input type="checkbox" id="fpRq" ${p.reqHl?'checked':''}> Outline empty required fields in red</label>
 <label class="chk fld"><input type="checkbox" id="fpKs" ${p.keys?'checked':''}> Single-key shortcuts in form editing mode (T, M, C, R, D, L, B, S, A)</label>
 <label class="chk fld"><input type="checkbox" id="fpJs" ${p.js?'checked':''}> Enable form JavaScript (safe subset: field values, calculations, formats, util, AF functions)</label>`,
 [{label:'Cancel',cancel:1},{label:'OK',pri:1,fn:md=>{setPrefs({hl:md.querySelector('#fpHl').value,op:+md.querySelector('#fpOp').value,reqHl:md.querySelector('#fpRq').checked,keys:md.querySelector('#fpKs').checked,js:md.querySelector('#fpJs').checked});runDocJS();recalc();redrawAll();renderForms()}}])}

/* =====================================================================================
   12. Document JavaScript + JavaScript console (Alt+J)
   ===================================================================================== */
function docJSDialog(){let list=JSON.parse(JSON.stringify(docScripts()));let cur=0;
 const draw=()=>{const l=$('#f3DL'),t=$('#f3DC'),n=$('#f3DN');if(!l)return;l.innerHTML=list.map((s,i)=>`<div data-di="${i}" style="padding:4px 6px;cursor:pointer;border-radius:4px;${i===cur?'background:var(--panel2)':''}">${esc(s.name)}</div>`).join('')||'<div class="hint">No document scripts</div>';
  const s=list[cur];t.value=s?s.code:'';n.value=s?s.name:'';t.disabled=n.disabled=!s};
 const save=()=>{const s=list[cur];if(s){s.code=$('#f3DC').value;s.name=$('#f3DN').value||'Script'}};
 modal('Document JavaScript',`<div class="row" style="gap:8px;align-items:stretch"><div style="flex:0 0 150px"><div id="f3DL" style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:4px;padding:3px"></div><div class="row" style="gap:4px;margin-top:4px">${btn('f3DA','Add')}${btn('f3DD','Delete')}</div></div>
 <div style="flex:1;min-width:0"><input class="ti" id="f3DN" placeholder="Name" style="margin-bottom:4px"><textarea class="ti" id="f3DC" rows="10" style="font-family:monospace;width:100%"></textarea></div></div>
 <div class="hint" style="margin-top:6px">Runs when the document opens, in PlanMark's safe sandbox: functions defined here can be used in field calculations and formats. Scripts cannot reach your files, the network or the rest of the app.</div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:()=>{save();for(const s of list){try{JSI.parse(s.code)}catch(e){toast(`"${s.name}": ${e.message}`);return false}}FS().docJS=list;runDocJS();recalc();saveScales();redrawAll();renderForms();toast('Document JavaScript saved')}}]);
 draw();$('#f3DL').onclick=e=>{const d=e.target.closest('[data-di]');if(!d)return;save();cur=+d.dataset.di;draw()};
 $('#f3DA').onclick=()=>{save();list.push({name:'Script '+(list.length+1),code:'function addTax(v) {\n  return v * 1.06625;\n}'});cur=list.length-1;draw()};
 $('#f3DD').onclick=()=>{list.splice(cur,1);cur=Math.max(0,cur-1);draw()}}
function jsConsole(){JSOUT.length=0;modal('JavaScript console',`<textarea class="ti" id="f3JC" rows="7" style="font-family:monospace;width:100%" placeholder='this.getField("Total").value;'></textarea>
 <div class="row" style="gap:4px;margin:6px 0">${btn('f3JR','Run (Ctrl+Enter)')}${btn('f3JX','Clear')}</div><pre id="f3JO" style="background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:6px;max-height:180px;overflow:auto;white-space:pre-wrap;font-size:12px;margin:0"></pre>
 <div class="hint" style="margin-top:6px">Safe sandbox: reads and sets form fields, calculations, util.printf, Math, AF functions and console.println. It cannot run arbitrary code against PlanMark or your computer.</div>`,[{label:'Close',cancel:1}]);
 const out=$('#f3JO');const run=()=>{const src=$('#f3JC').value;if(!src.trim())return;JSOUT.length=0;try{let last;const env=jsEnv(JSI.obj());
  // show the value of a final expression, like a console
  const ast=JSI.parse(src);const lastS=ast.body[ast.body.length-1];if(lastS&&lastS.type==='Expr'){ast.body[ast.body.length-1]={type:'Var',d:[{id:'__last',init:lastS.e}]}}
  const r=JSI.run(ast,env);last=r.scope.v.get('__last');recalc();saveScales();redrawAll();renderForms();out.textContent+=(JSOUT.length?JSOUT.join('\n')+'\n':'')+(last!==undefined?'⇒ '+JSI.toS(last)+'\n':'⇒ done\n')}
  catch(e){out.textContent+='✗ '+e.message+'\n'}out.scrollTop=1e9};
 $('#f3JR').onclick=run;$('#f3JX').onclick=()=>{out.textContent=''};$('#f3JC').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run()}});setTimeout(()=>$('#f3JC').focus(),30)}

/* =====================================================================================
   13. Script Manager + Batch Script (multi-step command scripts built from PlanMark's batch actions)
   ===================================================================================== */
const scripts=()=>LS.get('pm:scripts',[]);const saveScripts=l=>LS.set('pm:scripts',l);
const STEP_EXTRA={save:{label:'Save a copy',form:()=>'<div class="hint">Saves the file as it is at this point in the script (the final result is always saved too).</div>'},fillcsv:{label:'Fill form fields',form:o=>`<div class="fld"><label>Field = value, one per line</label><textarea class="ti" data-b="pairs" rows="4" style="font-family:monospace">${esc(o.pairs||'')}</textarea></div>`}};
function stepDefs(){const O=(window.PMBatch2&&PMBatch2.OPS)||{};const d={};for(const[k,v]of Object.entries(O)){if(v.agg&&k!=='summary')continue;d[k]=v}return Object.assign(d,STEP_EXTRA)}
const stepLabel=s=>{const d=stepDefs()[s.op];return(d?d.label:s.op)+(s.o&&Object.keys(s.o).length?' — '+Object.entries(s.o).filter(([k,v])=>v!==''&&v!=null&&!/user|owner|pass/i.test(k)).slice(0,3).map(([k,v])=>`${k}: ${String(v).slice(0,18)}`).join(', '):'')};
function readB(root){const o={};root.querySelectorAll('[data-b]').forEach(el=>{o[el.getAttribute('data-b')]=el.type==='checkbox'?el.checked:el.value});return o}
function progress(title){let cancel=false;modal(title,`<div class="hint" id="f3PM">Starting…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="f3PB" style="height:100%;width:0;background:var(--acc)"></div></div><div class="hint" id="f3PL" style="max-height:140px;overflow:auto;margin-top:8px;font-size:11px"></div>`,[{label:'Cancel',cancel:1,fn:()=>{cancel=true}}]);
 return{get cancelled(){return cancel},msg(t){const e=$('#f3PM');if(e)e.textContent=t},bar(f){const e=$('#f3PB');if(e)e.style.width=Math.round(Math.max(0,Math.min(1,f))*100)+'%'},log(t){const e=$('#f3PL');if(e){e.insertAdjacentHTML('beforeend',`<div>${esc(t)}</div>`);e.scrollTop=1e9}},done(){if($('#f3PM'))closeModal()}}}
// run steps over one file → list of output files
async function runSteps(steps,file,pg,st){let files=[file];const saved=[];
 for(let i=0;i<steps.length;i++){const s=steps[i];if(pg&&pg.cancelled)break;const d=stepDefs()[s.op];if(!d)throw new Error('Unknown step '+s.op);pg&&pg.log(`${i+1}. ${d.label}`);
  if(s.op==='save'){for(const f of files)saved.push({name:f.name.replace(/\.pdf$/i,'')+`-step${i+1}.pdf`,bytes:f.bytes});continue}
  if(s.op==='fillcsv'){const pairs=String((s.o||{}).pairs||'').split(/\r?\n/).map(l=>l.split('=')).filter(p=>p.length>=2).map(p=>[p[0].trim(),p.slice(1).join('=').trim()]);const nf=[];for(const f of files)nf.push({name:f.name,bytes:await fillBytes(f.bytes,pairs)});files=nf;continue}
  if(d.agg){files=await d.agg(files,s.o||{},pg||progressStub());continue}
  const nf=[];for(const f of files)nf.push(...await d.run(f,s.o||{},st,pg||progressStub()));files=nf}
 return[...saved,...files]}
const progressStub=()=>({cancelled:false,msg(){},bar(){},log(){},done(){}});
async function fillBytes(bytes,pairs){const d=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true});const form=d.getForm();for(const[n,v]of pairs){try{const f=form.getField(n);if(f instanceof PDFLib.PDFTextField)f.setText(v);else if(f instanceof PDFLib.PDFCheckBox)(v&&v!=='Off'&&v!=='0'?f.check():f.uncheck());else if(f.select)f.select(v)}catch(e){}}
 try{form.updateFieldAppearances(await d.embedFont(PDFLib.StandardFonts.Helvetica))}catch(e){}return d.save()}
// the open document with its markups burned in (the editable copy carries PlanMark's embedded original, which would reopen instead of the result)
async function currentFile(){const r=await captureExport(true);return r?{name:S.fileName||'document.pdf',bytes:r.bytes}:{name:S.fileName,bytes:S.bytes}}
async function runScriptOnCurrent(sc){if(!S.bytes)return toast('Open a PDF first');if(!sc.steps.length)return toast('This script has no steps');const pg=progress('Script: '+sc.name);let out=[];
 try{const f=await currentFile();out=await runSteps(sc.steps,f,pg,{bates:1})}catch(e){console.error(e);pg.log('✗ '+(e.message||e));toast('Script failed: '+(e.message||e))}finally{pg.done()}
 if(!out.length)return[];const main=out[out.length-1];
 // the result opens in PlanMark; extra outputs (split files, saved copies) are delivered as files
 if(out.length>1)await PMBatch2.deliver(out.slice(0,-1),'script-'+sc.name.replace(/\W+/g,'_')+'.zip');
 if(/\.pdf$/i.test(main.name)){await openBytes(main.bytes,main.name.replace(/(-markup)?\.pdf$/i,'')+'.pdf');toast(`"${sc.name}" finished`)}else await PMBatch2.deliver([main],main.name);return out}
async function runScriptBatch(sc,files){const pg=progress('Batch script: '+sc.name);const out=[];const st={bates:1};
 try{for(let i=0;i<files.length;i++){if(pg.cancelled)break;pg.msg(`${files[i].name} (${i+1} of ${files.length})`);pg.bar(i/files.length);try{out.push(...await runSteps(sc.steps,files[i],pg,st))}catch(e){pg.log(`✗ ${files[i].name}: ${e.message||e}`)}}}finally{pg.done()}
 if(out.length)await PMBatch2.deliver(out,'script-'+sc.name.replace(/\W+/g,'_')+'.zip');toast(`Processed ${files.length} file${files.length===1?'':'s'}`);return out}
let recording=null;
function scriptManager(){const list=scripts();let sel=list.length?0:-1;
 const draw=()=>{const l=$('#f3SL');if(!l)return;const L_=scripts();l.innerHTML=L_.map((s,i)=>`<div data-si="${i}" style="padding:5px 8px;cursor:pointer;border-radius:4px;${i===sel?'background:var(--panel2)':''}"><b>${esc(s.name)}</b> <small class="hint">${s.steps.length} step${s.steps.length===1?'':'s'}</small></div>`).join('')||'<div class="hint">No scripts yet. Make one, or record one while you work.</div>';
  const s=L_[sel];$('#f3SS').innerHTML=s?s.steps.map((st,i)=>`<div class="hint" style="padding:2px 0">${i+1}. ${esc(stepLabel(st))}</div>`).join('')||'<div class="hint">No steps</div>':''};
 modal('Script Manager',`<div class="row" style="gap:8px;align-items:stretch"><div style="flex:1;min-width:0"><div id="f3SL" style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:4px;padding:3px"></div></div><div style="flex:1;min-width:0"><div id="f3SS" style="max-height:200px;overflow:auto"></div></div></div>
 <div class="row" style="gap:4px;flex-wrap:wrap;margin-top:8px">${btn('f3SN','New')}${btn('f3SE','Edit')}${btn('f3SD','Delete')}${btn('f3SR','● Record')}${btn('f3SX','Run on this file')}${btn('f3SB','Batch Script…')}${btn('f3SI','Import')}${btn('f3SO','Export')}</div>
 <div class="hint" style="margin-top:6px">Scripts chain PlanMark actions — rotate, headers & footers, stamps, flatten, OCR, crop, reduce, split, security, signing, form filling, save. They follow your account to any computer.</div>`,[{label:'Close',cancel:1}]);
 draw();const L_=()=>scripts();
 $('#f3SL').onclick=e=>{const d=e.target.closest('[data-si]');if(d){sel=+d.dataset.si;draw()}};
 $('#f3SN').onclick=()=>{closeModal();scriptEditor(null)};$('#f3SE').onclick=()=>{const s=L_()[sel];if(!s)return toast('Pick a script');closeModal();scriptEditor(sel)};
 $('#f3SD').onclick=()=>{const l=L_();if(sel<0||!l[sel])return;l.splice(sel,1);saveScripts(l);sel=Math.min(sel,l.length-1);draw()};
 $('#f3SR').onclick=()=>{closeModal();startRecording()};
 $('#f3SX').onclick=()=>{const s=L_()[sel];if(!s)return toast('Pick a script');closeModal();runScriptOnCurrent(s)};
 $('#f3SB').onclick=async()=>{const s=L_()[sel];if(!s)return toast('Pick a script');const files=await pickFiles('application/pdf,.pdf',true);if(!files.length)return;closeModal();const fl=[];for(const f of files)fl.push({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())});runScriptBatch(s,fl)};
 $('#f3SO').onclick=()=>{const s=L_()[sel];if(!s)return toast('Pick a script');const clean_=JSON.parse(JSON.stringify(s));for(const st of clean_.steps)for(const k of Object.keys(st.o||{}))if(/user|owner|pass/i.test(k))delete st.o[k];download(s.name.replace(/\W+/g,'_')+'.pmscript.json',JSON.stringify(clean_,null,1),'application/json')};
 $('#f3SI').onclick=async()=>{const[f]=await pickFiles('.json,application/json',false);if(!f)return;try{const s=JSON.parse(await f.text());if(!s||!Array.isArray(s.steps))throw new Error('not a PlanMark script');const l=L_();let n=String(s.name||'Imported');while(l.some(x=>x.name===n))n+=' (2)';l.push({name:n,steps:s.steps.filter(st=>stepDefs()[st.op])});saveScripts(l);sel=l.length-1;draw();toast('Script imported')}catch(e){toast('Import failed: '+e.message)}}}
function stepForm(op,o){const d=stepDefs()[op];return d&&d.form?d.form(o||{}):''}
function scriptEditor(idx){const l=scripts();const s=idx==null?{name:'Script '+(l.length+1),steps:[]}:JSON.parse(JSON.stringify(l[idx]));const defs=stepDefs();let editing=-1;
 const draw=()=>{$('#f3ES').innerHTML=s.steps.map((st,i)=>`<div class="row" style="gap:4px;padding:3px 0;border-bottom:1px solid var(--line);align-items:center"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i+1}. ${esc(stepLabel(st))}</span><button class="btn" data-eu="${i}" style="flex:0;padding:0 5px">↑</button><button class="btn" data-ed="${i}" style="flex:0;padding:0 5px">↓</button><button class="btn" data-ee="${i}" style="flex:0;padding:0 5px">✎</button><button class="btn" data-ex="${i}" style="flex:0;padding:0 5px">✕</button></div>`).join('')||'<div class="hint">No steps yet</div>';
  $('#f3EAdd').textContent=editing>=0?'Update step '+(editing+1):'Add step'};
 modal(idx==null?'New script':'Edit script',`<div class="fld"><label>Name</label><input class="ti" id="f3EN" value="${esc(s.name)}"></div><div id="f3ES" style="max-height:170px;overflow:auto;margin-bottom:8px"></div>
 <div style="border:1px solid var(--line);border-radius:6px;padding:8px"><div class="fld"><label>Step</label><select class="ti" id="f3EOp">${Object.entries(defs).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div><div id="f3EO"></div><button class="btn" id="f3EAdd" style="border:1px solid var(--line)">Add step</button></div>`,
 [{label:'Cancel',cancel:1},{label:'Save',pri:1,fn:md=>{s.name=md.querySelector('#f3EN').value.trim()||s.name;const L2=scripts();if(L2.some((x,i)=>x.name===s.name&&i!==idx)){toast('A script with that name already exists');return false}if(idx==null)L2.push(s);else L2[idx]=s;saveScripts(L2);toast('Script saved');setTimeout(scriptManager,0)}}]);
 const opSel=$('#f3EOp');const showForm=(o)=>{$('#f3EO').innerHTML=stepForm(opSel.value,o)};opSel.onchange=()=>{editing=-1;showForm({});draw()};showForm({});draw();
 $('#f3EAdd').onclick=()=>{const st={op:opSel.value,o:readB($('#f3EO'))};if(editing>=0){s.steps[editing]=st;editing=-1}else s.steps.push(st);showForm({});draw()};
 $('#f3ES').onclick=e=>{const g=k=>{const b=e.target.closest(`[data-${k}]`);return b?+b.dataset[k]:-1};let i;
  if((i=g('eu'))>0)[s.steps[i-1],s.steps[i]]=[s.steps[i],s.steps[i-1]];else if((i=g('ed'))>=0&&i<s.steps.length-1)[s.steps[i+1],s.steps[i]]=[s.steps[i],s.steps[i+1]];
  else if((i=g('ex'))>=0)s.steps.splice(i,1);else if((i=g('ee'))>=0){editing=i;opSel.value=s.steps[i].op;showForm(s.steps[i].o)}draw()}}
// recording: each step you run from the recorder bar happens on the open file right away and is added to the script
function startRecording(){if(!S.bytes)return toast('Open a PDF to record a script on it');recording={name:'Recorded '+new Date().toLocaleDateString(),steps:[]};drawRecBar()}
function drawRecBar(){let b=$('#f3Rec');if(!recording){if(b)b.remove();return}if(!b){b=document.createElement('div');b.id='f3Rec';b.style.cssText='position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:70;background:#7f1d1d;color:#fff;border-radius:8px;padding:6px 10px;display:flex;gap:8px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.4);font-size:13px';document.body.appendChild(b)}
 b.innerHTML=`<span>● Recording “${esc(recording.name)}” — ${recording.steps.length} step${recording.steps.length===1?'':'s'}</span><button class="btn" id="f3RA" style="background:#fff;color:#7f1d1d;height:26px">Do a step…</button><button class="btn" id="f3RS" style="background:#fff;color:#7f1d1d;height:26px">Stop & save</button><button class="btn" id="f3RC" style="color:#fff;height:26px">Discard</button>`;
 $('#f3RA').onclick=recStep;$('#f3RC').onclick=()=>{recording=null;drawRecBar()};
 $('#f3RS').onclick=()=>{const r=recording;recording=null;drawRecBar();if(!r.steps.length)return toast('Nothing recorded');const l=scripts();let n=r.name,i=2;while(l.some(x=>x.name===n))n=r.name+' '+i++;l.push({name:n,steps:r.steps});saveScripts(l);toast(`Saved script "${n}"`)}}
function recStep(){const defs=stepDefs();modal('Do a step',`<div class="fld"><select class="ti" id="f3ROp">${Object.entries(defs).filter(([k])=>k!=='save').map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div><div id="f3RO"></div>`,
 [{label:'Cancel',cancel:1},{label:'Do it',pri:1,fn:md=>{const st={op:md.querySelector('#f3ROp').value,o:readB(md.querySelector('#f3RO'))};setTimeout(async()=>{const out=await runScriptOnCurrent({name:'step',steps:[st]});if(out&&out.length&&recording){recording.steps.push(st);drawRecBar()}},0)}}]);
 const sel=$('#f3ROp');const show=()=>{$('#f3RO').innerHTML=stepForm(sel.value,{})};sel.onchange=show;show()}

/* =====================================================================================
   14. Wiring: tab, ribbon, shortcuts, hooks
   ===================================================================================== */
H.ready.push(()=>{const pane=addTab('forms','Forms');renderForms();
 pane.addEventListener('change',e=>{const n=e.target.dataset.fv;if(n==null)return;const ok=setVal(n,e.target.type==='checkbox'?e.target.checked:e.target.value,{render:false});renderForms();if(ok===false)return});
 pane.addEventListener('click',e=>{const g=e.target.closest('[data-fgo]');if(g){e.preventDefault();const x=allFields().find(x=>x.f.name===g.dataset.fgo);if(x){const w=x.f.widgets[0];S.flash={page:w.page,r:w.box};redrawPage(w.page);scrollToBox(w.page,w.box);setTimeout(()=>{S.flash=null;redrawPage(w.page)},1800)}return}
  const ed=e.target.closest('[data-fed]');if(ed){const c=FS().created.find(x=>x.id===ed.dataset.fed);if(c)fieldDialog(c.page,c.box,c);return}
  const pr=e.target.closest('[data-fprop]');if(pr){propsDialog(pr.dataset.fprop);return}
  const bt=e.target.closest('[data-fbtn]');if(bt){const x=fieldByName(bt.dataset.fbtn);if(x)runAction(propsOf(x.f).action,x.f.name);return}
  const u=e.target.closest('[data-fup]'),d=e.target.closest('[data-fdn]');if(u){moveOrder(+u.dataset.fup,+u.dataset.fup-1);return}if(d){moveOrder(+d.dataset.fdn,+d.dataset.fdn+1);return}});
 let drag=null;pane.addEventListener('dragstart',e=>{const r=e.target.closest&&e.target.closest('[data-fdrag]');if(!r)return;drag=r.dataset.fdrag;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',drag)}catch(_){}});
 pane.addEventListener('dragover',e=>{if(drag){e.preventDefault()}});
 pane.addEventListener('drop',e=>{if(!drag)return;e.preventDefault();const r=e.target.closest('.f3Row');const names=allFields().map(x=>x.f.name);const from=names.indexOf(drag);let to=r?names.indexOf(r.dataset.fname):names.length-1;drag=null;if(from<0||to<0||from===to)return;moveOrder(from,to)});
 // Alt+J console; single-key field shortcuts in form editing mode
 addEventListener('keydown',e=>{const t=e.target,typing=t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='j'||e.key==='J'||e.code==='KeyJ')){e.preventDefault();e.stopPropagation();jsConsole();return}
  if(!fmode||typing||e.ctrlKey||e.metaKey||e.altKey||!prefs().keys||$('#modalBg').classList.contains('on'))return;
  const k=FKEYS[e.key.toLowerCase()];
  if(k){e.preventDefault();e.stopImmediatePropagation();pendingKind=k;setTool('formfield');toast(`Drag a box for a ${KLAB[k].toLowerCase()} field`)}
  else if(e.key==='Escape'){fmode=false;renderForms()}},true);
 // in form editing mode the letters create fields, even when another keyboard handler grabbed the letter first
 const _st=setTool;setTool=function(t){const e=window.event;if(fmode&&e&&e.type==='keydown'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&prefs().keys&&t!=='formfield'){const k=FKEYS[String(e.key||'').toLowerCase()];if(k){pendingKind=k;toast(`Drag a box for a ${KLAB[k].toLowerCase()} field`);return _st.call(this,'formfield')}}return _st.apply(this,arguments)};
 H.prefs.push(()=>{formShow=LS.get('pm:formshow',true);redrawAll()})});
H.open.push(()=>{closeEditor(false);loadFields()});
H.ribbon.push({label:'Forms',title:'Fill, create and auto-detect PDF form fields',icon:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M7 8h10M7 12h4M13 12h4M7 16h6"/>',fn:()=>switchTab('forms')});
// commands for menus and the command search
try{H.ready.push(()=>{const W=window.PMWorkspace;if(!W||!Array.isArray(W.CMDS))return;W.CMDS.push({id:'f3:js',group:'Tools',label:'JavaScript console',key:'Alt+J',run:jsConsole},{id:'f3:scripts',group:'Batch',label:'Script Manager…',run:scriptManager},{id:'f3:docjs',group:'Tools',label:'Document JavaScript…',run:()=>{if(S.pdf)docJSDialog()}})})}catch(e){}

/* =====================================================================================
   15. Auto-detect blanks (unchanged behaviour, moved here with the rest of Forms)
   ===================================================================================== */
async function vectorLines(n){const page=await S.pdf.getPage(n),ol=await page.getOperatorList({annotationMode:pdfjsLib.AnnotationMode?pdfjsLib.AnnotationMode.DISABLE:0}),O=pdfjsLib.OPS,vp=S.pages[n-1].vp;let ctm=vp.transform.slice();const st=[],segs=[],rects=[];
 const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]],ap=(x,y)=>[ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]];
 for(let i=0;i<ol.fnArray.length;i++){const fn=ol.fnArray[i],a=ol.argsArray[i];if(fn===O.save)st.push(ctm.slice());else if(fn===O.restore)ctm=st.pop()||ctm;else if(fn===O.transform)ctm=mul(ctm,a);
  else if(fn===O.paintFormXObjectBegin){st.push(ctm.slice());if(a&&a[0])ctm=mul(ctm,a[0])}else if(fn===O.paintFormXObjectEnd)ctm=st.pop()||ctm;
  else if(fn===O.constructPath){const ops=a[0],c=a[1];let j=0,cur=null,start=null;for(const op of ops){if(op===O.moveTo){cur=ap(c[j],c[j+1]);start=cur;j+=2}else if(op===O.lineTo){const q=ap(c[j],c[j+1]);j+=2;if(cur)segs.push([cur,q]);cur=q}
   else if(op===O.curveTo){cur=ap(c[j+4],c[j+5]);j+=6}else if(op===O.curveTo2||op===O.curveTo3){cur=ap(c[j+2],c[j+3]);j+=4}else if(op===O.closePath){if(cur&&start)segs.push([cur,start]);cur=start}
   else if(op===O.rectangle){const x=c[j],y=c[j+1],w=c[j+2],h=c[j+3];j+=4;const p1=ap(x,y),p2=ap(x+w,y+h);rects.push(normBox(p1,p2))}}}}
 const hs=segs.filter(s=>Math.abs(s[0][1]-s[1][1])<.6).map(s=>[Math.min(s[0][0],s[1][0]),Math.max(s[0][0],s[1][0]),(s[0][1]+s[1][1])/2]),vs=segs.filter(s=>Math.abs(s[0][0]-s[1][0])<.6).map(s=>[Math.min(s[0][1],s[1][1]),Math.max(s[0][1],s[1][1]),(s[0][0]+s[1][0])/2]);
 for(const top of hs)for(const bot of hs){if(bot[2]<=top[2]+5||bot[2]-top[2]>400)continue;if(Math.abs(top[0]-bot[0])>1.5||Math.abs(top[1]-bot[1])>1.5)continue;const l=vs.some(v=>Math.abs(v[2]-top[0])<1.5&&v[0]<=top[2]+1.5&&v[1]>=bot[2]-1.5),r=vs.some(v=>Math.abs(v[2]-top[1])<1.5&&v[0]<=top[2]+1.5&&v[1]>=bot[2]-1.5);if(l&&r)rects.push([top[0],top[2],top[1],bot[2]])}
 return{hs,rects}}
async function autoDetect(){if(!S.pdf)return toast('Open a PDF first');const pages=[S.cur];let n=0;const F=FS();
 const occupied=(pg,b)=>allFieldsRaw().some(({f})=>f.widgets.some(w=>w.page===pg&&!(w.box[2]<b[0]||w.box[0]>b[2]||w.box[3]<b[1]||w.box[1]>b[3])));
 for(const pg of pages){const{hs,rects}=await vectorLines(pg),{items,vp}=await pageText(pg);
  const tb=items.map(it=>{if(it.vb)return it.vb;const q=vp.convertToViewportRectangle([it.x,it.y-it.h*.2,it.x+it.w,it.y+it.h*.85]);return normBox([q[0],q[1]],[q[2],q[3]])});
  const textIn=b=>tb.some(t=>t[0]<b[2]-1&&t[2]>b[0]+1&&t[1]<b[3]-1&&t[3]>b[1]+1);const props=[];
  const uniq=new Set();for(const r of rects){const w=r[2]-r[0],h=r[3]-r[1],key=r.map(v=>Math.round(v)).join(',');if(uniq.has(key))continue;uniq.add(key);
   if(w>=5&&w<=16&&h>=5&&h<=16&&Math.abs(w-h)<3){if(!textIn(r))props.push({kind:'checkbox',box:r})}
   else if(w>=40&&h>=10&&h<=120&&!textIn(r)){props.push({kind:'text',box:[r[0]+1,r[1]+1,r[2]-1,r[3]-1],multiline:h>30})}}
  const L=hs.slice().sort((a,b)=>a[2]-b[2]||a[0]-b[0]),merged=[];for(const s of L){const m=merged[merged.length-1];if(m&&Math.abs(m[2]-s[2])<.8&&s[0]<=m[1]+2)m[1]=Math.max(m[1],s[1]);else merged.push(s.slice())}
  for(const s of merged){if(s[1]-s[0]<50)continue;const b=[s[0]+1,s[2]-14,s[1]-1,s[2]-1];if(rects.some(r=>Math.abs(r[3]-s[2])<1.5||Math.abs(r[1]-s[2])<1.5))continue;
   const overlap=tb.filter(t=>t[0]<b[2]&&t[2]>b[0]&&t[1]<b[3]&&t[3]>b[1]).reduce((a,t)=>a+Math.min(t[2],b[2])-Math.max(t[0],b[0]),0);if(overlap<(b[2]-b[0])*.3)props.push({kind:'text',box:b})}
  for(const pz of props){if(occupied(pg,pz.box))continue;n++;let base=pz.kind==='checkbox'?'Check':'Text',i=F.created.length+1;const taken=new Set([...FM.fields.map(f=>f.name),...F.created.map(c=>c.name)]);while(taken.has(base+i))i++;
   F.created.push({id:uid(),name:base+i,kind:pz.kind,multiline:!!pz.multiline,options:[],page:pg,box:pz.box,auto:true})}}
 saveScales();commit();renderForms();toast(n?`Found ${n} field${n>1?'s':''} — check them in the Forms panel`:'No blank fields found on this page')}

window.PMForms={FM,FS,JSI,loadFields,allFields,allFieldsRaw,fieldByName,propsOf,valOf,setVal,fieldAt,editField:activate,fieldDialog,propsDialog,renderForms,recalc,display,accept,
 makeData,parseFDF,parseXFDF,parseXML,applyPairs,exportData,importData,exportMany,mergeRows,migrateTyped,resetForm,runAction,jsConsole,docJSDialog,runFieldJS,
 sfnParse,sfnToJS,afCalc,afFormat,calcOrderDialog,prefsDialog,scriptManager,scriptEditor,runScriptOnCurrent,runScriptBatch,runSteps,startRecording,captureExport,valuesOfPdf,
 get formShow(){return formShow},set formShow(v){formShow=v},get fmode(){return fmode},set fmode(v){fmode=v;renderForms()}};
})();
