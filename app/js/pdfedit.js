/* PlanMark — PDF content editing (edit / add / delete text, search & replace, erase, cut/copy/paste content),
   document properties, annotation import (unflatten), XFDF, and document conversions/exports.
   Content edits are stored as hidden "pdfedit" markups (undoable, saved with the file, synced in Studio) and are
   applied to the real page content streams whenever a PDF is written (save, flatten, print, reports). */
(function(){
'use strict';
const PL=()=>window.PDFLib;
const N=k=>PDFLib.PDFName.of(k);
/* ---------------- small utilities ---------------- */
const lat=u8=>{let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return s};
const unlat=s=>{const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u};
const b64=u8=>btoa(lat(u8)),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];
const app=(m,x,y)=>[x*m[0]+y*m[2]+m[4],x*m[1]+y*m[3]+m[5]];
const ID=[1,0,0,1,0,0];
function wrapStreams(page,pre,post){const P=PL(),node=page.node,c=node.get(N('Contents'));if(c&&!(c instanceof P.PDFArray)&&!(page.doc.context.lookup(c) instanceof P.PDFArray))node.set(N('Contents'),page.doc.context.obj([c]));return node.wrapContentStreams(pre,post)}
const hex=a=>Array.from(a,b=>(b<16?'0':'')+b.toString(16)).join('').toUpperCase();
const fmt=v=>{const r=Math.round(v*1000)/1000;return Object.is(r,-0)?'0':String(r)};
const rgbHex=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
const hexRgb01=h=>{const n=parseInt(String(h||'#000').replace('#',''),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
const isWS=c=>c===32||c===10||c===13||c===9||c===12||c===0;
const isDel=c=>c===40||c===41||c===60||c===62||c===91||c===93||c===123||c===125||c===47||c===37;
/* ---------------- content stream parser ---------------- */
function parseContent(s){const ops=[],n=s.length,stack=[];let i=0,args=[],argStart=-1;
 const push=(tok,st)=>{if(stack.length)stack[stack.length-1].v.push(tok);else{if(!args.length)argStart=st;args.push(tok)}};
 while(i<n){const c=s.charCodeAt(i);
  if(isWS(c)){i++;continue}
  if(c===37){while(i<n&&s.charCodeAt(i)!==10&&s.charCodeAt(i)!==13)i++;continue}
  const st=i;
  if(c===40){let depth=1,j=i+1;const by=[];
   while(j<n){const ch=s.charCodeAt(j);
    if(ch===92){j++;const e=s.charCodeAt(j);
     if(e===110)by.push(10);else if(e===114)by.push(13);else if(e===116)by.push(9);else if(e===98)by.push(8);else if(e===102)by.push(12);
     else if(e>=48&&e<=55){let o=0,k=0;while(k<3&&j<n&&s.charCodeAt(j)>=48&&s.charCodeAt(j)<=55){o=o*8+s.charCodeAt(j)-48;j++;k++}by.push(o&255);continue}
     else if(e===13){if(s.charCodeAt(j+1)===10)j++}else if(e!==10)by.push(e);
     j++;continue}
    if(ch===40)depth++;else if(ch===41&&--depth===0){j++;break}
    by.push(ch);j++}
   push({t:'str',v:Uint8Array.from(by)},st);i=j;continue}
  if(c===60){if(s.charCodeAt(i+1)===60){stack.push({t:'dict',v:[],st});i+=2;continue}
   let j=s.indexOf('>',i);if(j<0)j=n;let h=s.slice(i+1,j).replace(/[^0-9a-fA-F]/g,'');if(h.length%2)h+='0';const u=new Uint8Array(h.length/2);for(let k=0;k<u.length;k++)u[k]=parseInt(h.substr(k*2,2),16);
   push({t:'str',v:u,hex:1},st);i=j+1;continue}
  if(c===62&&s.charCodeAt(i+1)===62){const d=stack.pop();i+=2;if(d)push({t:'dict',v:d.v},d.st);continue}
  if(c===91){stack.push({t:'arr',v:[],st});i++;continue}
  if(c===93){const a=stack.pop();i++;if(a)push({t:'arr',v:a.v},a.st);continue}
  if(c===123||c===125){i++;continue}
  if(c===47){let j=i+1;while(j<n){const d=s.charCodeAt(j);if(isWS(d)||isDel(d))break;j++}push({t:'name',v:s.slice(i+1,j)},st);i=j;continue}
  let j=i;while(j<n){const d=s.charCodeAt(j);if(isWS(d)||isDel(d))break;j++}if(j===i){i++;continue}
  const w=s.slice(i,j);i=j;
  if(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)){push({t:'num',v:parseFloat(w)},st);continue}
  if(w==='true'||w==='false'){push({t:'bool',v:w==='true'},st);continue}
  if(w==='null'){push({t:'null'},st);continue}
  if(stack.length){push({t:'kw',v:w},st);continue}
  if(w==='BI'){const m=/\sID[\s]/g;m.lastIndex=i-1;const r=m.exec(s);let end=n;if(r){const dataStart=r.index+4;const e=/\sEI(?=[\s]|$)/g;e.lastIndex=dataStart;const r2=e.exec(s);end=r2?r2.index+3:n}
   ops.push({op:'BI',args:[],s:st,e:end});args=[];argStart=-1;i=end;continue}
  ops.push({op:w,args,s:argStart>=0?argStart:st,e:j});args=[];argStart=-1}
 return ops}
/* ---------------- fonts ---------------- */
let WIN=null,MAC=null;function tables(){if(WIN)return;WIN=[];MAC=[];let dw,dm;try{dw=new TextDecoder('windows-1252');dm=new TextDecoder('macintosh')}catch(e){}
 for(let i=0;i<256;i++){WIN[i]=dw?dw.decode(Uint8Array.of(i)):String.fromCharCode(i);MAC[i]=dm?dm.decode(Uint8Array.of(i)):String.fromCharCode(i)}}
const AGL={space:' ',exclam:'!',quotedbl:'"',numbersign:'#',dollar:'$',percent:'%',ampersand:'&',quotesingle:"'",quoteright:'’',quoteleft:'‘',parenleft:'(',parenright:')',asterisk:'*',plus:'+',comma:',',hyphen:'-',minus:'−',period:'.',slash:'/',
 zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',colon:':',semicolon:';',less:'<',equal:'=',greater:'>',question:'?',at:'@',bracketleft:'[',backslash:'\\',bracketright:']',asciicircum:'^',underscore:'_',grave:'`',
 braceleft:'{',bar:'|',braceright:'}',asciitilde:'~',endash:'–',emdash:'—',bullet:'•',degree:'°',plusminus:'±',multiply:'×',divide:'÷',quotedblleft:'“',quotedblright:'”',ellipsis:'…',copyright:'©',registered:'®',trademark:'™',fi:'fi',fl:'fl',
 section:'§',paragraph:'¶',cent:'¢',sterling:'£',yen:'¥',Euro:'€',onehalf:'½',onequarter:'¼',threequarters:'¾',twosuperior:'²',threesuperior:'³',mu:'µ',nbspace:' ',periodcentered:'·',dagger:'†',daggerdbl:'‡'};
const glyphUni=n=>{if(!n)return'';if(AGL[n]!=null)return AGL[n];if(/^[A-Za-z]$/.test(n))return n;let m=n.match(/^uni([0-9A-Fa-f]{4,})$/);if(m)return String.fromCharCode(...m[1].match(/.{4}/g).map(h=>parseInt(h,16)));m=n.match(/^u([0-9A-Fa-f]{4,6})$/);if(m)return String.fromCodePoint(parseInt(m[1],16));
 const base=n.split('.')[0];if(base!==n)return glyphUni(base);return''};
const STD={Helvetica:1,'Helvetica-Bold':1,'Helvetica-Oblique':1,'Helvetica-BoldOblique':1,'Times-Roman':1,'Times-Bold':1,'Times-Italic':1,'Times-BoldItalic':1,Courier:1,'Courier-Bold':1,'Courier-Oblique':1,'Courier-BoldOblique':1,Symbol:1,ZapfDingbats:1};
function stdFor(base,bold,italic){const b=String(base||'').replace(/^[A-Z]{6}\+/,'');const B=bold!=null?bold:/bold|black|heavy|semibold|demi/i.test(b),I=italic!=null?italic:/italic|oblique/i.test(b);
 const fam=/times|serif|roman|georgia|garamond|book|minion|cambria/i.test(b)&&!/sans/i.test(b)?'Times':/courier|mono|consol|code/i.test(b)?'Courier':'Helvetica';
 const k={Helvetica:['Helvetica','HelveticaBold','HelveticaOblique','HelveticaBoldOblique'],Times:['TimesRoman','TimesRomanBold','TimesRomanItalic','TimesRomanBoldItalic'],Courier:['Courier','CourierBold','CourierOblique','CourierBoldOblique']}[fam][(B?1:0)+(I?2:0)];return{fam,std:k,bold:B,italic:I}}
let scratch=null;const stdCache={};
async function stdMetrics(name){const s=stdFor(name);if(stdCache[s.std])return stdCache[s.std];if(!scratch)scratch=await PDFLib.PDFDocument.create();return stdCache[s.std]=await scratch.embedFont(PDFLib.StandardFonts[s.std])}
function parseToUnicode(str){const map=new Map();let len=1;
 for(const blk of str.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)){for(const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)){len=Math.max(len,m[1].length/2|0);map.set(parseInt(m[1],16),u16(m[2]))}}
 for(const blk of str.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)){const body=blk[1];const re=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g;let m;
  while((m=re.exec(body))){const lo=parseInt(m[1],16),hi=parseInt(m[2],16);len=Math.max(len,m[1].length/2|0);if(hi-lo>65535)continue;
   if(m[4]!=null){const base=m[4];for(let c=lo;c<=hi;c++){const v=parseInt(base.slice(-4),16)+(c-lo);map.set(c,u16(base.slice(0,-4)+v.toString(16).padStart(4,'0')))}}
   else{const arr=[...m[5].matchAll(/<([0-9A-Fa-f]*)>/g)].map(x=>u16(x[1]));for(let c=lo;c<=hi&&c-lo<arr.length;c++)map.set(c,arr[c-lo])}}}
 return{map,len}}
function u16(h){let s='';for(let i=0;i+3<h.length;i+=4)s+=String.fromCharCode(parseInt(h.substr(i,4),16));if(h.length===2)s=String.fromCharCode(parseInt(h,16));return s}
function streamBytes(obj){const P=PL();if(obj instanceof P.PDFRawStream)return P.decodePDFRawStream(obj).decode();if(obj&&obj.getUnencodedContents)return obj.getUnencodedContents();if(obj&&obj.getContents)return obj.getContents();return new Uint8Array(0)}
async function fontInfo(ctx,fobj,cache){const P=PL();const ref=fobj instanceof P.PDFRef?fobj:null,key=ref?ref.toString():'d'+Math.random();if(ref&&cache.has(key))return cache.get(key);
 const fd=ctx.lookup(fobj);const L=o=>o instanceof P.PDFRef?ctx.lookup(o):o;const nm=k=>{const v=L(fd.get(N(k)));return v&&v.decodeText?v.decodeText():v?String(v).replace(/^\//,''):''};
 const sub=nm('Subtype'),base=nm('BaseFont');const info={key,obj:fobj,ref,base,sub,twoByte:sub==='Type0',subset:/^[A-Z]{6}\+/.test(base),embedded:false,toU:null,fromU:new Map(),widths:{},dw:1,std:null,fm:1};
 let desc=null;
 if(sub==='Type0'){const df=L(L(fd.get(N('DescendantFonts')))?.get(0));if(df){desc=L(df.get(N('FontDescriptor')));const dw=L(df.get(N('DW')));info.dw=(dw?dw.asNumber():1000)/1000;
   const W=L(df.get(N('W')));if(W){const a=W.asArray().map(L);for(let i=0;i<a.length;){const c=a[i].asNumber();const nx=a[i+1];if(nx instanceof P.PDFArray){nx.asArray().map(L).forEach((w,k)=>info.widths[c+k]=w.asNumber()/1000);i+=2}else{const c2=nx.asNumber(),w=a[i+2].asNumber()/1000;for(let k=c;k<=c2&&k-c<65536;k++)info.widths[k]=w;i+=3}}}}}
 else{desc=L(fd.get(N('FontDescriptor')));const fc=L(fd.get(N('FirstChar'))),W=L(fd.get(N('Widths')));
  if(sub==='Type3'){const fmx=L(fd.get(N('FontMatrix')));info.fm=fmx?fmx.asArray()[0].asNumber():0.001}
  if(fc&&W){const f0=fc.asNumber();W.asArray().forEach((w,k)=>info.widths[f0+k]=L(w).asNumber()*(sub==='Type3'?info.fm:0.001))}
  const mw=desc&&L(desc.get(N('MissingWidth')));info.dw=mw?mw.asNumber()/1000:0}
 if(desc){info.embedded=!!(desc.get(N('FontFile'))||desc.get(N('FontFile2'))||desc.get(N('FontFile3')))}
 if(!info.embedded&&STD[base.replace(/^[A-Z]{6}\+/,'')]!==undefined)info.std=base;
 if(!info.embedded&&!info.std&&sub!=='Type0'&&sub!=='Type3')info.std=base; // non-embedded TrueType etc: viewer substitutes
 const tu=L(fd.get(N('ToUnicode')));if(tu&&tu.dict){try{const r=parseToUnicode(lat(streamBytes(tu)));info.toU=r.map}catch(e){}}
 // simple-font encoding
 let enc=null;if(sub!=='Type0'){tables();const e=L(fd.get(N('Encoding')));let baseT=WIN,diff=null;
  if(e instanceof P.PDFName){const en=e.decodeText();baseT=en==='MacRomanEncoding'?MAC:WIN}
  else if(e instanceof P.PDFDict){const be=L(e.get(N('BaseEncoding')));if(be&&be.decodeText&&be.decodeText()==='MacRomanEncoding')baseT=MAC;const d=L(e.get(N('Differences')));if(d){diff={};let c=0;for(const x of d.asArray().map(L)){if(x instanceof P.PDFNumber)c=x.asNumber();else{diff[c++]=glyphUni(x.decodeText())}}}}
  enc=c=>diff&&diff[c]!=null?diff[c]:baseT[c]}
 info.enc=enc;
 info.toUni=c=>{if(info.toU&&info.toU.has(c))return info.toU.get(c);if(enc){const ch=enc(c);if(ch)return ch}return info.twoByte?'�':String.fromCharCode(c)};
 // reverse map for re-using the font with new text
 if(info.toU){for(const[c,u]of info.toU)if(u.length===1&&!info.fromU.has(u))info.fromU.set(u,c)}
 else if(enc&&(!info.subset)){for(let c=0;c<256;c++){const u=enc(c);if(u&&u.length===1&&!info.fromU.has(u)&&(info.widths[c]>0||info.std||!Object.keys(info.widths).length))info.fromU.set(u,c)}}
 if(info.std&&!Object.keys(info.widths).length){try{info.stdFont=await stdMetrics(info.std)}catch(e){}}
 info.widthOf=c=>{if(info.widths[c]!=null)return info.widths[c];if(info.stdFont){const ch=info.toUni(c);try{return info.stdFont.widthOfTextAtSize(ch,1000)/1000}catch(e){return .5}}return info.dw||(info.twoByte?1:.5)};
 if(ref)cache.set(key,info);return info}
/* ---------------- page analysis ---------------- */
function resourcesOf(ctx,node){const P=PL();let r=node.get(N('Resources'));let cur=node;while(!r&&cur){const par=cur.get(N('Parent'));if(!par)break;cur=ctx.lookup(par);r=cur&&cur.get(N('Resources'))}return r?ctx.lookup(r):ctx.obj({})}
async function analyzePage(doc,pi){const P=PL(),ctx=doc.context,page=doc.getPage(pi),node=page.node;
 const L=o=>o instanceof P.PDFRef?ctx.lookup(o):o;
 const res0=resourcesOf(ctx,node);const cont=node.get(N('Contents'));let refs=[];
 if(cont instanceof P.PDFArray)refs=cont.asArray();else if(cont)refs=[cont];
 const A={streams:[],glyphs:[],runs:[],paths:[],images:[],forms:[]},fcache=new Map(),visitedForms=new Map();
 let gs={ctm:ID,fill:[0,0,0],font:null,size:0,Tc:0,Tw:0,Th:1,TL:0,Ts:0,Tr:0};const gstack=[];let Tm=ID,Tlm=ID;
 let path=null;const addPt=(x,y)=>{const p=app(gs.ctm,x,y);if(!path.b)path.b=[p[0],p[1],p[0],p[1]];else{path.b[0]=Math.min(path.b[0],p[0]);path.b[1]=Math.min(path.b[1],p[1]);path.b[2]=Math.max(path.b[2],p[0]);path.b[3]=Math.max(path.b[3],p[1])}};
 const boxOf=m=>{const c=[app(m,0,0),app(m,1,0),app(m,0,1),app(m,1,1)];return[Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))]};
 const show=(si,oi,tok,el)=>{const f=gs.font;if(!f||!tok||tok.t!=='str')return;const by=tok.v,step=f.twoByte?2:1;
  for(let p=0;p+step<=by.length;p+=step){const code=step===2?(by[p]<<8)|by[p+1]:by[p];const w=f.widthOf(code);const M=mul(Tm,gs.ctm);
   const o=app(M,0,gs.Ts),e=app(M,w*gs.size*gs.Th,gs.Ts),up=app(M,0,gs.Ts+gs.size);
   const ws=step===1&&code===32?gs.Tw:0;const tx=(w*gs.size+gs.Tc+ws)*gs.Th;
   A.glyphs.push({s:si,o:oi,el,b:p,len:step,code,uni:f.toUni(code),x:o[0],y:o[1],ex:e[0],ey:e[1],ux:up[0]-o[0],uy:up[1]-o[1],font:f,size:gs.size,color:gs.fill.slice(),Tr:gs.Tr,tx,Th:gs.Th});
   Tm=mul([1,0,0,1,tx,0],Tm)}};
 async function run(si,ops,res,depth){const fonts=L(res.get(N('Font'))),xo=L(res.get(N('XObject')));
  for(let k=0;k<ops.length;k++){const o=ops[k],a=o.args,op=o.op,nv=i=>a[i]&&a[i].t==='num'?a[i].v:0;
   switch(op){
   case'q':gstack.push(Object.assign({},gs,{fill:gs.fill.slice()}));break;
   case'Q':if(gstack.length)gs=gstack.pop();break;
   case'cm':if(a.length>=6)gs.ctm=mul(a.slice(0,6).map(x=>x.v||0),gs.ctm);break;
   case'rg':gs.fill=[nv(0),nv(1),nv(2)];break;case'g':gs.fill=[nv(0),nv(0),nv(0)];break;
   case'k':{const c=nv(0),m=nv(1),y=nv(2),kk=nv(3);gs.fill=[(1-c)*(1-kk),(1-m)*(1-kk),(1-y)*(1-kk)];break}
   case'sc':case'scn':{const nums=a.filter(x=>x.t==='num').map(x=>x.v);if(nums.length===1)gs.fill=[nums[0],nums[0],nums[0]];else if(nums.length===3)gs.fill=nums;else if(nums.length===4)gs.fill=[(1-nums[0])*(1-nums[3]),(1-nums[1])*(1-nums[3]),(1-nums[2])*(1-nums[3])];break}
   case'BT':Tm=ID;Tlm=ID;break;
   case'Tf':{const fn=a[0]&&a[0].v;gs.size=nv(1);let fo=fonts&&fonts.get(N(fn));gs.font=fo?await fontInfo(ctx,fo,fcache):null;break}
   case'Tc':gs.Tc=nv(0);break;case'Tw':gs.Tw=nv(0);break;case'Tz':gs.Th=nv(0)/100;break;case'TL':gs.TL=nv(0);break;case'Ts':gs.Ts=nv(0);break;case'Tr':gs.Tr=nv(0);break;
   case'Td':Tlm=mul([1,0,0,1,nv(0),nv(1)],Tlm);Tm=Tlm;break;
   case'TD':gs.TL=-nv(1);Tlm=mul([1,0,0,1,nv(0),nv(1)],Tlm);Tm=Tlm;break;
   case'Tm':Tlm=a.slice(0,6).map(x=>x.v||0);Tm=Tlm;break;
   case'T*':Tlm=mul([1,0,0,1,0,-gs.TL],Tlm);Tm=Tlm;break;
   case'Tj':show(si,k,a[0],0);break;
   case"'":Tlm=mul([1,0,0,1,0,-gs.TL],Tlm);Tm=Tlm;show(si,k,a[0],0);break;
   case'"':gs.Tw=nv(0);gs.Tc=nv(1);Tlm=mul([1,0,0,1,0,-gs.TL],Tlm);Tm=Tlm;show(si,k,a[2],0);break;
   case'TJ':{const arr=a[0]&&a[0].t==='arr'?a[0].v:[];arr.forEach((el,ei)=>{if(el.t==='num')Tm=mul([1,0,0,1,-el.v/1000*gs.size*gs.Th,0],Tm);else show(si,k,el,ei)});break}
   case'm':case'l':if(!path)path={o0:k,b:null,clip:false};addPt(nv(0),nv(1));break;
   case'c':if(!path)path={o0:k,b:null,clip:false};addPt(nv(0),nv(1));addPt(nv(2),nv(3));addPt(nv(4),nv(5));break;
   case'v':case'y':if(!path)path={o0:k,b:null,clip:false};addPt(nv(0),nv(1));addPt(nv(2),nv(3));break;
   case're':{if(!path)path={o0:k,b:null,clip:false};const x=nv(0),y=nv(1),w=nv(2),h=nv(3);addPt(x,y);addPt(x+w,y);addPt(x,y+h);addPt(x+w,y+h);break}
   case'h':break;
   case'W':case'W*':if(path)path.clip=true;break;
   case'S':case's':case'f':case'F':case'f*':case'B':case'B*':case'b':case'b*':case'n':if(path){if(path.b)A.paths.push({s:si,o0:path.o0,o1:k,b:path.b,clip:path.clip,noPaint:op==='n'});path=null}break;
   case'BI':A.images.push({s:si,o0:k,o1:k,b:boxOf(gs.ctm)});break;
   case'Do':{const nm=a[0]&&a[0].v;const xr=xo&&xo.get(N(nm));const x=xr&&L(xr);if(!x||!x.dict)break;const st=L(x.dict.get(N('Subtype')));const stn=st&&st.decodeText?st.decodeText():'';
    if(stn==='Image')A.images.push({s:si,o0:k,o1:k,b:boxOf(gs.ctm)});
    else if(stn==='Form'){const mx=L(x.dict.get(N('Matrix')));const M=mx?mx.asArray().map(v=>L(v).asNumber()):ID;const bb=L(x.dict.get(N('BBox')));
     let fb=null;if(bb){const v=bb.asArray().map(q=>L(q).asNumber());const MM=mul(M,gs.ctm);const c=[app(MM,v[0],v[1]),app(MM,v[2],v[1]),app(MM,v[0],v[3]),app(MM,v[2],v[3])];fb=[Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))]}
     A.forms.push({s:si,o0:k,o1:k,b:fb});
     if(depth<4&&xr instanceof P.PDFRef){const key=xr.toString();visitedForms.set(key,(visitedForms.get(key)||0)+1);let fsi=A.streams.findIndex(q=>q.key===key);
      if(fsi<0){const str=lat(streamBytes(x));A.streams.push({ref:xr,key,obj:x,form:true,str,ops:parseContent(str)});fsi=A.streams.length-1}
      const saved=Object.assign({},gs,{fill:gs.fill.slice()}),sTm=Tm,sTlm=Tlm;gs.ctm=mul(M,gs.ctm);const fres=L(x.dict.get(N('Resources')))||res;
      await run(fsi,A.streams[fsi].ops,fres,depth+1);gs=saved;Tm=sTm;Tlm=sTlm}}break}
   }}}
 for(const r of refs){const obj=L(r);if(!obj||!obj.dict&&!obj.getContents)continue;const str=lat(streamBytes(obj));A.streams.push({ref:r instanceof P.PDFRef?r:null,key:r.toString(),obj,form:false,str,ops:parseContent(str)})}
 const pageStreams=A.streams.length;for(let i=0;i<pageStreams;i++)await run(i,A.streams[i].ops,res0,0);
 A.sharedForms=[...visitedForms].filter(([k,v])=>v>1).map(([k])=>k);
 buildRuns(A);return A}
function buildRuns(A){let r=null;const runs=A.runs;
 for(let gi=0;gi<A.glyphs.length;gi++){const g=A.glyphs[gi];const h=Math.hypot(g.ux,g.uy)||1;let dx=g.ex-g.x,dy=g.ey-g.y,L=Math.hypot(dx,dy);
  let ok=false;if(r&&g.font===r.font&&Math.abs(g.size-r.size)<=r.size*.01+.01&&g.color.every((v,i)=>Math.abs(v-r.color[i])<.02)&&Math.abs(h-r.h)<r.h*.05){
   const ax=g.x-r.ox,ay=g.y-r.oy,along=ax*r.dx+ay*r.dy,perp=-ax*r.dy+ay*r.dx,endAlong=(r.ex-r.ox)*r.dx+(r.ey-r.oy)*r.dy,gap=along-endAlong;
   ok=Math.abs(perp)<.25*r.h&&gap>-.6*r.h&&gap<1.3*r.h;if(ok&&gap>.22*r.h&&!/\s$/.test(r.text)&&g.uni!==' ')r.text+=' '}
  if(!ok){if(r)runs.push(r);const ux=L>1e-6?dx/L:(h?g.uy/h:0)?1:1,uy=L>1e-6?dy/L:0;r={glyphs:[],text:'',font:g.font,size:g.size,color:g.color,h,ox:g.x,oy:g.y,dx:L>1e-6?dx/L:1,dy:L>1e-6?dy/L:0,nx:g.ux/h,ny:g.uy/h,ex:g.x,ey:g.y}}
  r.glyphs.push(gi);r.text+=g.uni;r.ex=g.ex;r.ey=g.ey}
 if(r)runs.push(r);
 runs.forEach((r,i)=>{r.idx=i;r.text=r.text.replace(/\s+$/,'');const lo=-.22*r.h,hi=.82*r.h;r.poly=[[r.ox+r.nx*lo,r.oy+r.ny*lo],[r.ex+r.nx*lo,r.ey+r.ny*lo],[r.ex+r.nx*hi,r.ey+r.ny*hi],[r.ox+r.nx*hi,r.oy+r.ny*hi]];
  r.bbox=[Math.min(...r.poly.map(p=>p[0])),Math.min(...r.poly.map(p=>p[1])),Math.max(...r.poly.map(p=>p[0])),Math.max(...r.poly.map(p=>p[1]))]})}
const inPoly=(x,y,P)=>{let ins=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>y)!==(P[j][1]>y)&&x<(P[j][0]-P[i][0])*(y-P[i][1])/(P[j][1]-P[i][1])+P[i][0])ins=!ins;return ins};
/* ---------------- client-side analysis cache (for picking runs on screen) ---------------- */
const CACHE=new WeakMap();
async function clientAnalysis(n){const by=S.bytes;if(!by)return null;let c=CACHE.get(by);if(!c){c={doc:PDFLib.PDFDocument.load(by,{ignoreEncryption:true,updateMetadata:false}),pages:{}};CACHE.set(by,c)}
 if(!c.pages[n])c.pages[n]=c.doc.then(d=>analyzePage(d,n-1));return c.pages[n]}
function cachedAnalysis(n){const c=S.bytes&&CACHE.get(S.bytes);return c&&c.pages[n]&&c.pages[n].__v}
async function getRuns(n){const p=clientAnalysis(n);const A=await p;p.__v=A;return A}
function runAt(A,x,y,tol){let best=null,ba=1e18;for(const r of A.runs){if(!r.text.trim())continue;const t=tol||1.5;const P=r.poly.map(q=>q.slice());
 const cx=(P[0][0]+P[2][0])/2,cy=(P[0][1]+P[2][1])/2;const grow=P.map(q=>[q[0]+Math.sign(q[0]-cx)*t,q[1]+Math.sign(q[1]-cy)*t]);
 if(inPoly(x,y,grow)){const ar=(r.bbox[2]-r.bbox[0])*(r.bbox[3]-r.bbox[1]);if(ar<ba){ba=ar;best=r}}}return best}
/* ---------------- edits as hidden markups ---------------- */
T.pdfedit={label:'Content Edit',kind:'nav',closed:1};
T.edittext={label:'Edit Text',kind:'click'};T.addtext={label:'Add Text',kind:'click'};T.deltext={label:'Delete Text',kind:'click'};
IC.edittext='<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/><path d="M15 20h5"/>';IC.addtext='<path d="M5 7V5h10v2M10 5v12M7 17h6"/><path d="M18 14v6M15 17h6"/>';IC.deltext='<path d="M5 7V5h10v2M10 5v12M7 17h6"/><path d="M15 15l5 5M20 15l-5 5"/>';
HINTS.edittext='Click any PDF text to edit it · the original is replaced when you save';HINTS.addtext='Click where the new text goes';HINTS.deltext='Click PDF text to delete it';
const vpOf=n=>S.pages[n-1].vp,toVp=(n,x,y)=>vpOf(n).convertToViewportPoint(x,y),toPdf=(n,x,y)=>vpOf(n).convertToPdfPoint(x,y);
let EXPORTING=0;
const peList=(n)=>S.markups.filter(m=>m.type==='pdfedit'&&(n==null||m.page===n));
function famOf(base){return stdFor(base).fam}
function edPrims(m){const e=m.edit||{},out=[],n=m.page;if(!S.pages[n-1])return out;
 const b=ptsBox(m.pts);out.push({k:'p',d:dBox(b),stroke:null,w:0,so:1,fill:null,fo:1});
 const white=poly=>out.push({k:'p',d:dPoly(poly,true),stroke:null,w:0,so:1,fill:'#ffffff',fo:1});
 if(e.kind==='replace'||e.kind==='delete'){white(e.vpoly)}
 if(e.kind==='erase'){white(e.vpoly)}
 if(e.kind==='replace'||e.kind==='add'){const dx=m.pts[0][0]-e.p0[0],dy=m.pts[0][1]-e.p0[1];const lines=String(e.text||'').split('\n');const a=e.vang||0,r=a*Math.PI/180,ux=Math.sin(r),uy=-Math.cos(r);
  lines.forEach((ln,i)=>{const bx=e.vo[0]+dx-ux*e.size*1.2*i*-1,by=e.vo[1]+dy-uy*e.size*1.2*i*-1;// line i is below line 0
   const lx=e.vo[0]+dx+(-ux)*e.size*1.2*i,ly=e.vo[1]+dy+(-uy)*e.size*1.2*i;
   out.push({k:'t',x:lx+ux*e.size*.35,y:ly+uy*e.size*.35,s:ln,size:e.size,color:e.color||'#000000',bold:!!e.bold,italic:!!e.italic,font:e.fam||'Helvetica',ang:a,align:'start',halo:false,o:1})})}
 if(e.kind==='paste'&&e.png)out.push({k:'img',b,src:e.png,o:1});
 return out}
const _prims=prims;prims=function(m){if(m&&m.type==='pdfedit'){if(EXPORTING)return[];if(m.edit&&m.edit.kind==='props')return[];return edPrims(m)}return _prims.apply(this,arguments)};
const _ho=handlesOf;handlesOf=function(m){if(m&&m.type==='pdfedit')return[];return _ho.apply(this,arguments)};
const _lr=listRows;listRows=function(){return _lr.apply(this,arguments).filter(r=>r.m.type!=='pdfedit')};
const _sr=summaryRows;summaryRows=function(rows){return _sr.call(this,(rows||[]).filter(r=>r.m&&r.m.type!=='pdfedit'))};
const _rl=renderList;renderList=function(){const r=_rl.apply(this,arguments);const c=$('#mlCount');if(c){const tot=S.markups.filter(m=>m.type!=='pdfedit').length,mm=/^(\d+) of \d+$/.exec(c.textContent.trim());c.textContent=mm?`${mm[1]} of ${tot}`:String(tot)}return r};
function addEdit(n,pts,edit,label){const m=newMarkup('pdfedit',n,pts,{stroke:'#000000',width:0,opacity:1});m.edit=edit;m.subject='Content Edit';m.label=label||'';pushUndo();S.markups.push(m);commit();return m}
function vpPoly(n,poly){return poly.map(p=>toVp(n,p[0],p[1]))}
function runEditData(n,r){const vpoly=vpPoly(n,r.poly),vo=toVp(n,r.ox,r.oy),ve=toVp(n,r.ex,r.ey);let vang=Math.atan2(ve[1]-vo[1],ve[0]-vo[0])*180/Math.PI;if(Math.hypot(ve[0]-vo[0],ve[1]-vo[1])<.01)vang=0;
 const h=Math.hypot(r.nx*r.h,r.ny*r.h);return{run:r.idx,runText:r.text,pbox:r.bbox,vpoly,vo,vang,size:+(r.h).toFixed(2),color:rgbHex(r.color),fam:famOf(r.font.base),bold:stdFor(r.font.base).bold,italic:stdFor(r.font.base).italic,fontName:r.font.base}}
function bbOfPoly(P){return[[Math.min(...P.map(q=>q[0])),Math.min(...P.map(q=>q[1]))],[Math.max(...P.map(q=>q[0])),Math.max(...P.map(q=>q[1]))]]}
/* ---------------- on-screen tools: Edit / Add / Delete text ---------------- */
let HOV=null,panel=null;
H.over.push(n=>{let h='';if(HOV&&HOV.page===n)h+=`<path d="${dPoly(HOV.vpoly,true)}" fill="rgba(61,139,253,.10)" stroke="#3d8bfd" stroke-width="${1.2/S.zoom}" stroke-dasharray="${4/S.zoom} ${3/S.zoom}" pointer-events="none"/>`;return h});
viewer.addEventListener('pointermove',e=>{if(!['edittext','deltext'].includes(S.tool)||!S.pages.length){if(HOV){const pg=HOV.page;HOV=null;redrawPage(pg)}return}
 const p=pageFromEvent(e);if(!p)return;const pt=toPt(e,p),pp=toPdf(p.num,pt[0],pt[1]);const A=cachedAnalysis(p.num);if(!A){getRuns(p.num);return}
 const r=runAt(A,pp[0],pp[1]);const key=r?p.num+':'+r.idx:null;if((HOV&&HOV.key)===key)return;const old=HOV&&HOV.page;HOV=r?{page:p.num,key,vpoly:vpPoly(p.num,r.poly)}:null;if(old)redrawPage(old);if(HOV)redrawPage(p.num)});
H.down=(prev=>(e,p,pt)=>{
 if(PASTE&&p){doPaste(p,pt);return true}
 if(p&&['edittext','addtext','deltext'].includes(S.tool)){const pp=toPdf(p.num,pt[0],pt[1]);const cx=e.clientX,cy=e.clientY;
  if(S.tool==='addtext'){openPanel({mode:'add',n:p.num,pt,cx,cy});return true}
  getRuns(p.num).then(A=>{const r=runAt(A,pp[0],pp[1]);if(!r){toast('No PDF text there'+(S.ocr&&S.ocr[p.num]?' (OCR text from scans can\'t be edited — it is recognized from an image)':''));return}
   const ex=peList(p.num).find(m=>m.edit&&(m.edit.kind==='replace'||m.edit.kind==='delete')&&m.edit.run===r.idx);
   if(S.tool==='deltext'){if(ex){pushUndo();ex.edit=Object.assign({},ex.edit,{kind:'delete',text:''});ex.modified=Date.now();commit()}else{const d=runEditData(p.num,r);d.kind='delete';addEdit(p.num,bbOfPoly(d.vpoly),Object.assign(d,{p0:bbOfPoly(d.vpoly)[0]}),'Deleted: '+r.text)}toast('Text deleted (Ctrl+Z to undo)');return}
   openPanel({mode:ex?'edit':'new',n:p.num,run:r,m:ex,cx,cy})}).catch(err=>{console.error(err);toast('Could not read this page\'s text: '+err.message)});return true}
 return prev?prev(e,p,pt):false})(H.down);
function closePanel(){if(panel){panel.remove();panel=null}}
function openPanel(o){closePanel();const r=o.run,m=o.m,e=m?m.edit:null;const f=r?r.font:null;
 const text=e?(e.kind==='delete'?'':e.text):r?r.text:'',size=e?e.size:r?+r.h.toFixed(2):12,color=e?e.color:r?rgbHex(r.color):'#000000',bold=e?!!e.bold:r?stdFor(r.font.base).bold:false;
 const reuse=r?canReuse(f,text):false;
 panel=document.createElement('div');panel.id='pePanel';panel.style.cssText=`position:fixed;z-index:65;left:${clamp(o.cx-20,8,innerWidth-330)}px;top:${clamp(o.cy+18,8,innerHeight-260)}px;width:320px;background:var(--panel);border:1px solid var(--acc);border-radius:10px;padding:10px;box-shadow:0 12px 40px rgba(0,0,0,.5)`;
 panel.innerHTML=`<div style="font-weight:600;margin-bottom:6px">${o.mode==='add'?'Add text to the page':'Edit PDF text'}</div>
 <textarea class="ti" id="peT" rows="3" style="min-height:60px">${esc(text)}</textarea>
 <div class="row" style="gap:6px;margin-top:6px"><div><label style="font-size:11px;color:var(--mut)">Size (pt)</label><input class="ti" type="number" step="0.5" min="2" id="peS" value="${size}"></div><div><label style="font-size:11px;color:var(--mut)">Color</label><input type="color" id="peC" value="${color}"></div><label class="chk" style="margin-top:16px"><input type="checkbox" id="peB" ${bold?'checked':''}><b>B</b></label>
 ${o.mode==='add'?`<div><label style="font-size:11px;color:var(--mut)">Font</label><select class="ti" id="peF">${['Helvetica','Times','Courier'].map(x=>`<option>${x}</option>`).join('')}</select></div>`:''}</div>
 ${r?`<div class="hint" id="peFont" style="font-size:11px;margin-top:6px">Font: ${esc(f.base||'?')}${f.subset?' (subset)':''} — <span id="peReuse">${reuse?'new text uses the original font':'some characters are not in the original font; a close standard font will be used'}</span></div>`:''}
 <div class="row" style="gap:6px;margin-top:8px;justify-content:flex-end">${r?'<button class="btn" id="peDel" style="border:1px solid var(--line)">Delete text</button>':''}${m?'<button class="btn" id="peRev" style="border:1px solid var(--line)">Revert</button>':''}<button class="btn" id="peX" style="border:1px solid var(--line)">Cancel</button><button class="btn pri" id="peOk">Apply</button></div>`;
 document.body.appendChild(panel);const ta=$('#peT');ta.focus();ta.select();
 ta.oninput=()=>{if(r&&$('#peReuse'))$('#peReuse').textContent=canReuse(f,ta.value)?'new text uses the original font':'some characters are not in the original font; a close standard font will be used'};
 panel.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Escape')closePanel();if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey))$('#peOk').click()});
 $('#peX').onclick=closePanel;if($('#peRev'))$('#peRev').onclick=()=>{pushUndo();S.markups=S.markups.filter(x=>x!==m);S.sel.delete(m.id);commit();closePanel();toast('Reverted to the original text')};
 if($('#peDel'))$('#peDel').onclick=()=>{if(m){pushUndo();m.edit=Object.assign({},m.edit,{kind:'delete',text:''});m.modified=Date.now();commit()}else{const d=runEditData(o.n,r);d.kind='delete';addEdit(o.n,bbOfPoly(d.vpoly),Object.assign(d,{p0:bbOfPoly(d.vpoly)[0]}),'Deleted: '+r.text)}closePanel()};
 $('#peOk').onclick=()=>{const t=ta.value,sz=Math.max(1,+$('#peS').value||size),c=$('#peC').value,b=$('#peB').checked;
  if(o.mode==='add'){if(!t.trim()){closePanel();return}const fam=$('#peF').value,lines=t.split('\n'),w=Math.max(...lines.map(l=>tw(l,sz,b,fam))),x=o.pt[0],y=o.pt[1];
   addEdit(o.n,[[x,y-sz*.85],[x+w,y-sz*.85+lines.length*sz*1.2]],{kind:'add',text:t,size:sz,color:c,bold:b,fam,vo:[x,y],p0:[x,y-sz*.85],vang:0},'Added: '+t.slice(0,40));closePanel();return}
  if(m){pushUndo();Object.assign(m.edit,{kind:'replace',text:t,size:sz,color:c,bold:b});m.label='Edited: '+t.slice(0,40);m.modified=Date.now();commit()}
  else{const d=runEditData(o.n,r);Object.assign(d,{kind:'replace',text:t,size:sz,color:c,bold:b});const bb=bbOfPoly(d.vpoly);d.p0=bb[0];addEdit(o.n,bb,d,'Edited: '+t.slice(0,40))}
  closePanel()}}
function canReuse(f,text){if(!f)return false;for(const ch of String(text).replace(/\n/g,'')){if(!f.fromU.has(ch))return false}return true}
document.addEventListener('pointerdown',e=>{if(panel&&!panel.contains(e.target)&&!e.target.closest('#viewer'))closePanel()},true);
const _st=setTool;setTool=function(t){if(!['edittext','addtext','deltext'].includes(t)){closePanel();if(HOV){const pg=HOV.page;HOV=null;redrawPage(pg)}}if(t!=='pdfpaste')PASTE=null;return _st.apply(this,arguments)};
/* properties panel for a selected content edit */
H.props.push((m,mode)=>{if(mode!=='sel'||!m||m.type!=='pdfedit'||!m.edit)return'';const e=m.edit;
 if(e.kind==='replace'||e.kind==='add')return`<div class="sec">Content edit</div><div class="hint" style="margin-bottom:6px">${e.kind==='add'?'Text added to the page':'Original: '+esc(e.runText||'')}</div><div class="fld"><label>New text</label><textarea class="ti" data-pe="text">${esc(e.text||'')}</textarea></div><div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Size</label><input class="ti" type="number" step="0.5" data-pe="size" value="${e.size}"></div><div><label style="font-size:11px;color:var(--mut)">Color</label><input type="color" data-pe="color" value="${e.color||'#000000'}"></div><label class="chk" style="margin-top:16px"><input type="checkbox" data-pe="bold" ${e.bold?'checked':''}><b>B</b></label></div><div class="hint">Delete this item to restore the original.</div>`;
 return`<div class="sec">Content edit</div><div class="hint">${e.kind==='delete'?'Deleted text: '+esc(e.runText||''):e.kind==='erase'?'Erased content area':e.kind==='paste'?'Pasted content':'Document properties'} — delete this item to undo it.</div>`});
let peUndo=false;$('#props').addEventListener('input',ev=>{const f=ev.target.dataset&&ev.target.dataset.pe;if(!f)return;const m=byId([...S.sel][0]);if(!m||m.type!=='pdfedit')return;if(!peUndo){pushUndo();peUndo=true}
 m.edit[f]=ev.target.type==='checkbox'?ev.target.checked:ev.target.type==='number'?+ev.target.value:ev.target.value;m.modified=Date.now();redrawPage(m.page);clearTimeout(sT);sT=setTimeout(()=>{if(S.fileKey)LS.set(S.fileKey,{markups:S.markups,scales:S.scales})},400)});
$('#props').addEventListener('change',()=>{peUndo=false;hook('change')});
/* ---------------- Search & Replace (content) ---------------- */
async function findInContent(q,cs,whole){const out=[];const esc_=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp((whole?'\\b':'')+esc_(q)+(whole?'\\b':''),cs?'g':'gi');
 for(const p of S.pages){const A=await getRuns(p.num);for(const r of A.runs){const ex=peList(p.num).find(m=>m.edit&&m.edit.run===r.idx&&m.edit.kind==='replace');const base=ex?ex.edit.text:r.text;re.lastIndex=0;if(re.test(base))out.push({page:p.num,run:r,base,ex})}}
 let pdfjsCount=0;for(const p of S.pages){const{items}=await pageText(p.num);re.lastIndex=0;for(const it of items){const m=(it.str||'').match(re);if(m)pdfjsCount+=m.length}}return{hits:out,re,pdfjsCount}}
function replaceDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Search & Replace (page content)',`<div class="row fld"><input class="ti" id="srQ" placeholder="Find"><input class="ti" id="srR" placeholder="Replace with"></div>
 <div class="row fld"><label class="chk"><input type="checkbox" id="srC"> Match case</label><label class="chk"><input type="checkbox" id="srW"> Whole word</label><button class="btn" id="srF" style="flex:0;border:1px solid var(--line)">Find</button></div>
 <div id="srL" class="hint" style="max-height:240px;overflow:auto"></div>`,[{label:'Close',cancel:1},{label:'Replace selected',pri:1,fn:()=>{doReplace(false);return false}}]);
 let found=null;const run=async()=>{const q=$('#srQ').value;if(!q)return;$('#srL').textContent='Searching…';found=await findInContent(q,$('#srC').checked,$('#srW').checked);
  const n=found.hits.length;$('#srL').innerHTML=`${n} editable run${n===1?'':'s'} found${found.pdfjsCount>found.hits.length?` · ${found.pdfjsCount-found.hits.length} other match${found.pdfjsCount-found.hits.length>1?'es':''} can't be edited here (split across fonts/lines, or scanned text)`:''}<br>`+found.hits.map((h,i)=>`<label class="chk res" style="display:flex"><input type="checkbox" data-sr="${i}" checked> <span><small>p${h.page}</small> ${esc(h.base)}</span></label>`).join('')};
 $('#srF').onclick=run;$('#srQ').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run()}};
 window.__peDoReplace=doReplace;
 function doReplace(all){if(!found||!found.hits.length)return toast('Find something first');const rep=$('#srR').value;let n=0;pushUndo();
  found.hits.forEach((h,i)=>{const cb=$(`[data-sr="${i}"]`);if(!all&&cb&&!cb.checked)return;found.re.lastIndex=0;const t=h.base.replace(found.re,rep);
   if(h.ex){h.ex.edit.text=t;h.ex.label='Edited: '+t.slice(0,40);h.ex.modified=Date.now()}else{const d=runEditData(h.page,h.run);Object.assign(d,{kind:'replace',text:t});const bb=bbOfPoly(d.vpoly);d.p0=bb[0];const m=newMarkup('pdfedit',h.page,bb,{stroke:'#000000',width:0,opacity:1});m.edit=d;m.subject='Content Edit';m.label='Edited: '+t.slice(0,40);S.markups.push(m)}n++});
  commit();toast(`Replaced in ${n} place${n===1?'':'s'} — applied to the PDF when you save`);run()}}
async function replaceAll(q,rep,cs,whole){const f=await findInContent(q,cs,whole);pushUndo();let n=0;for(const h of f.hits){f.re.lastIndex=0;const t=h.base.replace(f.re,rep);if(h.ex){h.ex.edit.text=t}else{const d=runEditData(h.page,h.run);Object.assign(d,{kind:'replace',text:t});const bb=bbOfPoly(d.vpoly);d.p0=bb[0];const m=newMarkup('pdfedit',h.page,bb,{stroke:'#000000',width:0,opacity:1});m.edit=d;m.subject='Content Edit';S.markups.push(m)}n++}commit();return{replaced:n,notEditable:Math.max(0,f.pdfjsCount-f.hits.length)}}
/* ---------------- Erase / Cut / Copy / Paste content ---------------- */
let CLIP=null,PASTE=null;
async function regionPick(msg){return PMAuto.pickRegion(msg)}
function regionPdf(n,box){const c=[toPdf(n,box[0],box[1]),toPdf(n,box[2],box[1]),toPdf(n,box[0],box[3]),toPdf(n,box[2],box[3])];return[Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))]}
async function eraseContent(opt={}){const r=opt.region||await regionPick('Erase content: pick the area');const n=r.page,box=r.box,pb=regionPdf(n,box);
 const poly=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]];return addEdit(n,[[box[0],box[1]],[box[2],box[3]]],{kind:'erase',pbox:pb,vpoly:poly,p0:[box[0],box[1]],whiteout:!!opt.whiteout},'Erased area')}
async function makeClip(n,pb){const src=await PDFLib.PDFDocument.load(S.bytes,{ignoreEncryption:true,updateMetadata:false});const mini=await PDFLib.PDFDocument.create();
 const emb=await mini.embedPage(src.getPage(n-1),{left:pb[0],bottom:pb[1],right:pb[2],top:pb[3]});const pg=mini.addPage([pb[2]-pb[0],pb[3]-pb[1]]);pg.drawPage(emb,{x:0,y:0});const bytes=await mini.save();
 const d=await pdfjsLib.getDocument({data:bytes.slice()}).promise,p1=await d.getPage(1),v=p1.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await p1.render({canvasContext:c.getContext('2d'),viewport:v,background:'rgba(0,0,0,0)'}).promise;d.destroy();
 return{pdf:b64(bytes),png:c.toDataURL('image/png'),w:pb[2]-pb[0],h:pb[3]-pb[1],from:S.fileName}}
async function copyContent(cut,region){const r=region||await regionPick((cut?'Cut':'Copy')+' content: pick the area');const pb=regionPdf(r.page,r.box);toast('Copying…');CLIP=await makeClip(r.page,pb);
 if(cut)await eraseContent({region:r});toast((cut?'Cut':'Copied')+' — choose Paste, then click where it goes');return CLIP}
function pasteContent(){if(!CLIP)return toast('Copy or cut some content first');PASTE=CLIP;setTool('select');PASTE=CLIP;$('#hint').textContent='Paste: click where the top-left corner goes';toast('Click where the content goes')}
function doPaste(p,pt){const c=PASTE;PASTE=null;const n=p.num,x=pt[0],y=pt[1];// size in viewport units == pdf units at scale 1 (unrotated pages)
 const m=addEdit(n,[[x,y],[x+c.w,y+c.h]],{kind:'paste',pdf:c.pdf,png:c.png,w:c.w,h:c.h,p0:[x,y]},'Pasted content');updateRibbon();return m}
/* ---------------- applying edits to a real PDF (runs inside every save/export) ---------------- */
async function applyEdits(doc){const P=PL(),ctx=doc.context;const report={replaced:0,deleted:0,added:0,erased:0,pasted:0,fallbacks:[],reused:0,unmatched:0,whiteouts:0,props:false};
 const all=S.markups.filter(m=>m.type==='pdfedit'&&m.edit);if(!all.length)return report;
 const props=all.find(m=>m.edit.kind==='props');if(props){const p=props.edit;try{if(p.title!=null)doc.setTitle(p.title);if(p.author!=null)doc.setAuthor(p.author);if(p.subject!=null)doc.setSubject(p.subject);if(p.keywords!=null)doc.setKeywords(String(p.keywords).split(/[,;]\s*/).filter(Boolean));if(p.creator!=null)doc.setCreator(p.creator);if(p.producer)doc.setProducer(p.producer);doc.setModificationDate(new Date());report.props=true}catch(e){console.warn(e)}}
 const pages=[...new Set(all.filter(m=>m.edit.kind!=='props').map(m=>m.page))];
 for(const n of pages){const page=doc.getPage(n-1);if(!page)continue;const eds=all.filter(m=>m.page===n&&m.edit.kind!=='props');const A=await analyzePage(doc,n-1);
  const rmG=new Set(),rmOps=[];// rmOps: {s,o0,o1}
  const runFor=e=>{let r=A.runs[e.run];if(r&&r.text===e.runText)return r;r=A.runs.find(q=>q.text===e.runText&&Math.abs(q.bbox[0]-e.pbox[0])<2&&Math.abs(q.bbox[1]-e.pbox[1])<2);return r||null};
  const draws=[];
  for(const m of eds){const e=m.edit;
   if(e.kind==='replace'||e.kind==='delete'){const r=runFor(e);if(!r){report.unmatched++;continue}r.glyphs.forEach(g=>rmG.add(g));if(e.kind==='delete')report.deleted++;else draws.push({m,r})}
   else if(e.kind==='add')draws.push({m});
   else if(e.kind==='erase'){const b=e.pbox,inside=q=>q&&q[0]>=b[0]-.5&&q[1]>=b[1]-.5&&q[2]<=b[2]+.5&&q[3]<=b[3]+.5;
    A.glyphs.forEach((g,i)=>{const xs=[g.x,g.ex,g.x+g.ux*.8,g.ex+g.ux*.8],ys=[g.y,g.ey,g.y+g.uy*.8,g.ey+g.uy*.8];if(inside([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]))rmG.add(i)});
    let partial=false;for(const p of A.paths){if(p.clip)continue;if(inside(p.b))rmOps.push(p);else if(p.b[0]<b[2]&&p.b[2]>b[0]&&p.b[1]<b[3]&&p.b[3]>b[1])partial=true}
    for(const im of A.images.concat(A.forms)){if(!im.b)continue;if(inside(im.b))rmOps.push(im);else if(im.b[0]<b[2]&&im.b[2]>b[0]&&im.b[1]<b[3]&&im.b[3]>b[1])partial=true}
    report.erased++;if(e.whiteout||partial&&e.whiteout!==false&&e.autoWhite){draws.push({m,white:b});report.whiteouts++}}
   else if(e.kind==='paste')draws.push({m,paste:true})}
  // rewrite the content streams
  const byOp=new Map();for(const gi of rmG){const g=A.glyphs[gi];const k=g.s+':'+g.o;if(!byOp.has(k))byOp.set(k,[]);byOp.get(k).push(gi)}
  const repl=new Map();// stream index -> [{s,e,text}]
  const addRepl=(si,s,e,text)=>{if(!repl.has(si))repl.set(si,[]);repl.get(si).push({s,e,text})};
  for(const[k,gis]of byOp){const[si,oi]=k.split(':').map(Number);const st=A.streams[si],op=st.ops[oi];const glyphsOfOp=A.glyphs.map((g,i)=>[g,i]).filter(([g])=>g.s===si&&g.o===oi);
   const rm=new Set(gis);const elems=op.op==='TJ'?(op.args[0]&&op.args[0].v||[]):[op.args[op.args.length-1]];const out=[];let buf=[],pend=0;
   const flush=()=>{if(buf.length){if(pend){out.push(fmt(pend));pend=0}out.push('<'+hex(buf)+'>');buf=[]}};
   elems.forEach((el,ei)=>{if(!el)return;if(el.t==='num'){flush();pend+=el.v;return}if(el.t!=='str')return;const eg=glyphsOfOp.filter(([g])=>g.el===(op.op==='TJ'?ei:0));let used=0;
    for(const[g,gi]of eg){if(rm.has(gi)){flush();if(g.size&&g.Th)pend+=-g.tx*1000/(g.size*g.Th)}else{if(pend&&!buf.length){out.push(fmt(pend));pend=0}else if(pend){flush()}buf.push(...el.v.subarray(g.b,g.b+g.len))}used=g.b+g.len}});
   flush();if(pend)out.push(fmt(pend));
   let pre='';if(op.op==="'")pre='T* ';if(op.op==='"')pre=`${fmt(op.args[0].v)} Tw ${fmt(op.args[1].v)} Tc T* `;
   addRepl(si,op.s,op.e,pre+'['+out.join(' ')+'] TJ')}
  for(const r of rmOps){const st=A.streams[r.s];addRepl(r.s,st.ops[r.o0].s,st.ops[r.o1].e,'')}
  for(const[si,list]of repl){const st=A.streams[si];list.sort((a,b)=>b.s-a.s);let s=st.str;let last=Infinity;for(const x of list){if(x.e>last)continue;s=s.slice(0,x.s)+x.text+s.slice(x.e);last=x.s}
   const bytes=unlat(s);const ns=ctx.flateStream(bytes);if(st.form&&st.obj.dict){for(const[key,val]of st.obj.dict.entries()){const kn=key.decodeText();if(['Filter','Length','DecodeParms','DL'].includes(kn))continue;ns.dict.set(key,val)}}
   if(st.ref)ctx.assign(st.ref,ns)}
  // draw replacement / added text, white-outs and pastes in default user space
  if(draws.length){try{const q=ctx.register(ctx.contentStream([PDFLib.pushGraphicsState()])),Q=ctx.register(ctx.contentStream([PDFLib.popGraphicsState()]));wrapStreams(page,q,Q)}catch(e){}
   const vp=vpOf(n);let fi=0;const res=page.node.Resources();
   for(const d of draws){const m=d.m,e=m.edit;
    if(d.white){page.drawRectangle({x:d.white[0],y:d.white[1],width:d.white[2]-d.white[0],height:d.white[3]-d.white[1],color:PDFLib.rgb(1,1,1),borderWidth:0});continue}
    if(d.paste){try{const src=await PDFLib.PDFDocument.load(unb64(e.pdf));const[emb]=await doc.embedPdf(src,[0]);const b=ptsBox(m.pts);const c1=vp.convertToPdfPoint(b[0],b[3]),c2=vp.convertToPdfPoint(b[2],b[1]);
      page.drawPage(emb,{x:Math.min(c1[0],c2[0]),y:Math.min(c1[1],c2[1]),width:Math.abs(c2[0]-c1[0]),height:Math.abs(c2[1]-c1[1])});report.pasted++}catch(err){console.warn(err)}continue}
    const text=String(e.text||'');if(!text.trim())continue;const dx=m.pts[0][0]-e.p0[0],dy=m.pts[0][1]-e.p0[1];
    const vo=[e.vo[0]+dx,e.vo[1]+dy],a=(e.vang||0)*Math.PI/180,ve=[vo[0]+Math.cos(a)*10,vo[1]+Math.sin(a)*10];
    const po=vp.convertToPdfPoint(vo[0],vo[1]),pe=vp.convertToPdfPoint(ve[0],ve[1]);let ang=Math.atan2(pe[1]-po[1],pe[0]-po[0]);const cos=Math.cos(ang),sin=Math.sin(ang);
    const col=hexRgb01(e.color||'#000000'),lines=text.split('\n');const f=d.r?d.r.font:null;
    if(f&&canReuse(f,text)&&(f.ref||f.obj)){const nm='PMF'+(++fi)+Math.random().toString(36).slice(2,5);let fd=res.lookup(N('Font'));if(!(fd instanceof P.PDFDict)){fd=ctx.obj({});res.set(N('Font'),fd)}fd.set(N(nm),f.obj);
     let ops='q '+col.map(fmt).join(' ')+' rg ';if(e.bold)ops+=`${col.map(fmt).join(' ')} RG ${fmt(e.size*.035)} w 2 Tr `;ops+='BT /'+nm+' '+fmt(e.size)+' Tf ';
     lines.forEach((ln,i)=>{const ox=po[0]+sin*e.size*1.2*i,oy=po[1]-cos*e.size*1.2*i;const codes=[];for(const ch of ln){const c=f.fromU.get(ch);if(f.twoByte){codes.push(c>>8&255,c&255)}else codes.push(c&255)}
      ops+=`${fmt(cos)} ${fmt(sin)} ${fmt(-sin)} ${fmt(cos)} ${fmt(ox)} ${fmt(oy)} Tm <${hex(codes)}> Tj `});ops+='ET Q';
     const st=ctx.flateStream(unlat(ops));page.node.addContentStream(ctx.register(st));report.reused++}
    else{const sf=stdFor(e.fontName||e.fam,!!e.bold,!!e.italic);const font=await doc.embedFont(PDFLib.StandardFonts[sf.std]);if(f)report.fallbacks.push({text:text.slice(0,40),font:f.base,used:sf.std});
     lines.forEach((ln,i)=>{const ox=po[0]+sin*e.size*1.2*i,oy=po[1]-cos*e.size*1.2*i;page.drawText(safeTxt(ln),{x:ox,y:oy,size:e.size,font,color:PDFLib.rgb(...col),rotate:PDFLib.degrees(ang*180/Math.PI)})})}
    if(e.kind==='add')report.added++;else report.replaced++}}}
 window.PM_LAST_EDIT_REPORT=report;return report}
// hook: every PDF built from S.bytes during an export gets the content edits applied right after loading
const _load=PDFLib.PDFDocument.load;let LOADHOOK=null;
PDFLib.PDFDocument.load=async function(bytes,opts){const d=await _load.call(this,bytes,opts);if(LOADHOOK&&(bytes===LOADHOOK.bytes)&&!LOADHOOK.done){LOADHOOK.done=true;try{LOADHOOK.report=await applyEdits(d)}catch(e){console.error('content edits',e);LOADHOOK.err=e}}return d};
const _exp=exportPDF;exportPDF=async function(){const has=S.markups.some(m=>m.type==='pdfedit');if(!has)return _exp.apply(this,arguments);EXPORTING++;const hk=LOADHOOK={bytes:S.bytes,done:false};
 try{const r=await _exp.apply(this,arguments);const rep=hk.report;if(rep&&rep.fallbacks.length&&!window.__pmQuietEdits)toast(`Saved. ${rep.fallbacks.length} edited text item${rep.fallbacks.length>1?'s':''} used a standard font (characters missing from the original subset font).`);if(hk.err)toast('Some content edits could not be applied: '+hk.err.message);return r}finally{EXPORTING--;LOADHOOK=null}};
/* ---------------- Document properties ---------------- */
async function fontsList(){const d=await PDFLib.PDFDocument.load(S.bytes,{ignoreEncryption:true,updateMetadata:false}),P=PL(),ctx=d.context,L=o=>o instanceof P.PDFRef?ctx.lookup(o):o,seen=new Map();
 const walk=(res,depth)=>{if(!res||depth>4)return;const F=L(res.get(N('Font')));if(F)for(const[k,v]of F.entries()){const key=v.toString();if(seen.has(key))continue;const fd=L(v);if(!fd||!fd.get)continue;const nm=x=>{const y=L(fd.get(N(x)));return y&&y.decodeText?y.decodeText():''};
   const base=nm('BaseFont'),sub=nm('Subtype');let desc=L(fd.get(N('FontDescriptor')));if(sub==='Type0'){const df=L(L(fd.get(N('DescendantFonts')))?.get(0));desc=df&&L(df.get(N('FontDescriptor')))}
   seen.set(key,{name:base.replace(/^[A-Z]{6}\+/,''),type:sub,embedded:!!(desc&&(desc.get(N('FontFile'))||desc.get(N('FontFile2'))||desc.get(N('FontFile3')))),subset:/^[A-Z]{6}\+/.test(base)})}
  const X=L(res.get(N('XObject')));if(X)for(const[k,v]of X.entries()){const x=L(v);if(x&&x.dict){const st=L(x.dict.get(N('Subtype')));if(st&&st.decodeText&&st.decodeText()==='Form')walk(L(x.dict.get(N('Resources'))),depth+1)}}};
 d.getPages().forEach(p=>walk(resourcesOf(ctx,p.node),0));return{doc:d,fonts:[...seen.values()]}}
async function propsDialog(){if(!S.bytes)return toast('Open a PDF first');const{doc,fonts}=await fontsList();const pm=peList().find(m=>m.edit&&m.edit.kind==='props');const pe=pm?pm.edit:{};
 const g=(k,f)=>pe[k]!=null?pe[k]:(f()||'');const ver=(lat(S.bytes.subarray(0,16)).match(/%PDF-(\d\.\d)/)||[])[1]||'?';const p0=S.pages[0];const inch=v=>(v/72).toFixed(2);
 const v={title:g('title',()=>doc.getTitle()),author:g('author',()=>doc.getAuthor()),subject:g('subject',()=>doc.getSubject()),keywords:g('keywords',()=>doc.getKeywords()),creator:g('creator',()=>doc.getCreator()),producer:g('producer',()=>doc.getProducer())};
 const dt=x=>{try{const d=x();return d?d.toLocaleString():'—'}catch(e){return'—'}};
 modal('Document properties',`<div class="row fld"><div style="flex:2"><label style="font-size:11px;color:var(--mut)">Title</label><input class="ti" id="dpTitle" value="${esc(v.title)}"></div><div><label style="font-size:11px;color:var(--mut)">Author</label><input class="ti" id="dpAuthor" value="${esc(v.author)}"></div></div>
 <div class="fld"><label>Subject</label><input class="ti" id="dpSubject" value="${esc(v.subject)}"></div><div class="fld"><label>Keywords (comma separated)</label><input class="ti" id="dpKeywords" value="${esc(v.keywords)}"></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Creator</label><input class="ti" id="dpCreator" value="${esc(v.creator)}"></div><div><label style="font-size:11px;color:var(--mut)">Producer</label><input class="ti" id="dpProducer" value="${esc(v.producer)}"></div></div>
 <div class="hint">File: ${esc(S.fileName)} · ${(S.bytes.length/1048576).toFixed(2)} MB · PDF ${esc(ver)} · ${S.pages.length} page${S.pages.length>1?'s':''} · page 1: ${inch(p0.w)}" × ${inch(p0.h)}" (${Math.round(p0.w)} × ${Math.round(p0.h)} pt)<br>Created: ${esc(dt(()=>doc.getCreationDate()))} · Modified: ${esc(dt(()=>doc.getModificationDate()))}</div>
 <div class="sec">Fonts (${fonts.length})</div><div style="max-height:150px;overflow:auto">${fonts.map(f=>`<div class="hint">${esc(f.name)} <small>· ${esc(f.type)} · ${f.embedded?(f.subset?'embedded subset':'embedded'):'<span style="color:#fbbf24">not embedded</span>'}</small></div>`).join('')||'<div class="hint">No fonts.</div>'}</div>`,
 [{label:'Cancel',cancel:1},{label:'Save properties',pri:1,fn:md=>{const nv={kind:'props'};for(const k of['title','author','subject','keywords','creator','producer'])nv[k]=md.querySelector('#dp'+k[0].toUpperCase()+k.slice(1)).value;
  if(pm){pushUndo();pm.edit=nv;pm.modified=Date.now();commit()}else addEdit(1,[[-20,-20],[-19,-19]],nv,'Document properties');toast('Properties will be written when you save')}}])}
/* ---------------- Import PDF annotations as editable markups ("unflatten") ---------------- */
const MARKUP_SUBTYPES=['Square','Circle','Line','PolyLine','Polygon','Ink','FreeText','Text','Highlight','Underline','StrikeOut','Squiggly','Stamp'];
function colorOf(arr){if(!arr)return null;const v=arr.asArray().map(x=>x.asNumber());if(v.length===1)return rgbHex([v[0],v[0],v[0]]);if(v.length===3)return rgbHex(v);if(v.length===4)return rgbHex([(1-v[0])*(1-v[3]),(1-v[1])*(1-v[3]),(1-v[2])*(1-v[3])]);return null}
function pdfDate(s){const m=String(s||'').match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);if(!m)return Date.now();return new Date(+m[1],(+m[2]||1)-1,+m[3]||1,+m[4]||0,+m[5]||0,+m[6]||0).getTime()}
const LEMAP={OpenArrow:'open',ClosedArrow:'arrow',Circle:'dot',Slash:'tick',Butt:'bar',Square:'bar',Diamond:'arrow',ROpenArrow:'open',RClosedArrow:'arrow'};
async function countImportable(){const pdf=S.pdf;if(!pdf)return 0;let n=0;for(let i=1;i<=Math.min(pdf.numPages,60);i++){if(S.pdf!==pdf)return 0;try{const a=await (await pdf.getPage(i)).getAnnotations();n+=a.filter(x=>MARKUP_SUBTYPES.includes(x.subtype)).length}catch(e){}}return n}
async function renderStampImage(n,rect){// difference between page rendered with and without annotations = the stamp itself
 const pg=await S.pdf.getPage(n),k=2,vp=pg.getViewport({scale:k}),mk=async mode=>{const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp,annotationMode:mode}).promise;return c};
 const AM=pdfjsLib.AnnotationMode||{ENABLE:1,DISABLE:0};const a=await mk(AM.ENABLE),b=await mk(AM.DISABLE);const c1=vp.convertToViewportPoint(rect[0],rect[1]),c2=vp.convertToViewportPoint(rect[2],rect[3]);
 const x=Math.floor(Math.min(c1[0],c2[0])),y=Math.floor(Math.min(c1[1],c2[1])),w=Math.max(1,Math.ceil(Math.abs(c2[0]-c1[0]))),h=Math.max(1,Math.ceil(Math.abs(c2[1]-c1[1])));
 const da=a.getContext('2d').getImageData(x,y,w,h),db=b.getContext('2d').getImageData(x,y,w,h);for(let i=0;i<da.data.length;i+=4){const d=Math.abs(da.data[i]-db.data[i])+Math.abs(da.data[i+1]-db.data[i+1])+Math.abs(da.data[i+2]-db.data[i+2]);if(d<12)da.data[i+3]=0}
 const o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').putImageData(da,0,0);return o.toDataURL('image/png')}
async function importAnnotations(opts={}){if(!S.bytes)return toast('Open a PDF first');const by0=S.bytes;const P=PL();const doc=await _load.call(PDFLib.PDFDocument,S.bytes,{ignoreEncryption:true,updateMetadata:false});const ctx=doc.context,L=o=>o instanceof P.PDFRef?ctx.lookup(o):o;
 const ms=[];let removed=0;const nmOf=v=>{const x=L(v);return x&&x.decodeText?x.decodeText():''};const txt=v=>{const x=L(v);return x&&x.decodeText?x.decodeText():''};const num=v=>{const x=L(v);return x&&x.asNumber?x.asNumber():null};
 for(let pi=0;pi<doc.getPageCount();pi++){const node=doc.getPage(pi).node,n=pi+1;const annots=L(node.get(N('Annots')));if(!annots)continue;const keep=[],dropRefs=new Set();
  const arr=annots.asArray();for(const ar of arr){const a=L(ar);if(!a||!a.get){keep.push(ar);continue}const st=nmOf(a.get(N('Subtype')));if(!MARKUP_SUBTYPES.includes(st)){keep.push(ar);continue}
   const rect=(L(a.get(N('Rect')))||ctx.obj([0,0,0,0])).asArray().map(q=>L(q).asNumber());const V=(x,y)=>toVp(n,x,y);const color=colorOf(L(a.get(N('C'))))||'#e0312b',fill=colorOf(L(a.get(N('IC'))));
   const bs=L(a.get(N('BS'))),bw=bs&&num(bs.get(N('W')))!=null?num(bs.get(N('W'))):(L(a.get(N('Border')))?(L(a.get(N('Border'))).asArray()[2]&&L(L(a.get(N('Border'))).asArray()[2]).asNumber()):1);
   const dash=bs&&nmOf(bs.get(N('S')))==='D'?'dash':'';const ca=num(a.get(N('CA')));const it=nmOf(a.get(N('IT')));const measure=!!a.get(N('Measure'))||/Dimension/.test(it);const be=L(a.get(N('BE')));const cloudy=be&&nmOf(be.get(N('S')))==='C';
   const base={stroke:color,width:bw==null?1:bw,opacity:ca==null?1:ca};if(dash)base.dash=dash;const meta={comment:txt(a.get(N('Contents'))),author:txt(a.get(N('T')))||'Imported',created:pdfDate(txt(a.get(N('CreationDate')))||txt(a.get(N('M')))),subject:txt(a.get(N('Subj')))};
   const vr=[V(rect[0],rect[3]),V(rect[2],rect[1])];const pts4=(v)=>{const p=[];for(let i=0;i+1<v.length;i+=2)p.push(V(v[i],v[i+1]));return p};const nums=k=>{const x=L(a.get(N(k)));return x?x.asArray().map(q=>L(q).asNumber()):null};
   const add=(type,pts,extra={})=>{const m=newMarkup(type,n,pts,Object.assign({},S.defaults[type]||{},base,extra.style||{}));delete extra.style;Object.assign(m,meta,extra);if(!m.subject)m.subject=defSubject(type);m.imported=st;ms.push(m)};
   try{switch(st){
    case'Square':add('rect',vr,{style:{fill:fill||'none',fillOpacity:fill?(ca==null?1:ca):.3}});break;
    case'Circle':add('ellipse',vr,{style:{fill:fill||'none'}});break;
    case'Line':{const l=nums('L');const le=L(a.get(N('LE')));const les=le?le.asArray().map(nmOf):[];add(measure?'length':(LEMAP[les[1]]?'arrow':'line'),[V(l[0],l[1]),V(l[2],l[3])],{style:{headS:LEMAP[les[0]]||'',headE:LEMAP[les[1]]||''}});break}
    case'PolyLine':add(measure?'polylength':'polyline',pts4(nums('Vertices')));break;
    case'Polygon':add(measure?'area':cloudy?'cloud':'polygon',pts4(nums('Vertices')),{style:{fill:fill||(measure?S.defaults.area.fill:'none')}});break;
    case'Ink':{const il=L(a.get(N('InkList')));if(il)il.asArray().forEach(s=>{const v=L(s).asArray().map(q=>L(q).asNumber());const p=pts4(v);if(p.length>1)add('pen',p)});break}
    case'FreeText':{const da=txt(a.get(N('DA')))||'';const fs=+(da.match(/([\d.]+)\s+Tf/)||[])[1]||12;const cm=da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);const tc=cm?rgbHex([+cm[1],+cm[2],+cm[3]]):color;
     const cl=nums('CL');if(cl&&cl.length>=4)add('callout',[V(cl[0],cl[1]),vr[0],vr[1]],{text:meta.comment,comment:'',style:{fontSize:fs,color:tc,stroke:color,fill:fill||'#ffffff'}});else add('text',vr,{text:meta.comment,comment:'',style:{fontSize:fs,color:tc,fill:fill||'#ffffff',width:bw==null?1:bw}});break}
    case'Text':add('note',[V(rect[0],rect[3])]);break;
    case'Highlight':case'Underline':case'StrikeOut':case'Squiggly':{const qp=nums('QuadPoints')||[rect[0],rect[3],rect[2],rect[3],rect[0],rect[1],rect[2],rect[1]];const rects=[];for(let i=0;i+7<qp.length;i+=8){const c=[V(qp[i],qp[i+1]),V(qp[i+2],qp[i+3]),V(qp[i+4],qp[i+5]),V(qp[i+6],qp[i+7])];rects.push([Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))])}
     const type=st==='Highlight'?'texthl':st==='StrikeOut'?'strikeout':'underline';const bb=ptsBox(rects.flatMap(r=>[[r[0],r[1]],[r[2],r[3]]]));add(type,[[bb[0],bb[1]],[bb[2],bb[3]]],{rects,style:st==='Squiggly'?{dash:'dot'}:{}});break}
    case'Stamp':{const png=await renderStampImage(n,rect);add('image',vr,{img:png,style:{width:0}});break}}
    dropRefs.add(ar.toString());removed++;const pop=a.get(N('Popup'));if(pop)dropRefs.add(pop.toString())}catch(err){console.warn('import annot',st,err);keep.push(ar)}}
  const kept=keep.filter(r=>!dropRefs.has(r.toString())&&!(L(r)&&nmOf(L(r).get&&L(r).get(N('Subtype')))==='Popup'&&dropRefs.has((L(r).get(N('Parent'))||'').toString())));
  node.set(N('Annots'),ctx.obj(kept))}
 if(!ms.length){toast('No comments/markups from other apps found in this PDF');return{imported:0}}
 const bytes=new Uint8Array(await doc.save());if(S.bytes!==by0)return{imported:0,stale:true};const markups=S.markups.concat(ms),scales=S.scales;
 await openBytes(bytes,S.fileName,{markups,scales});toast(`Imported ${ms.length} markup${ms.length>1?'s':''} from other apps — they are now editable`);return{imported:ms.length,removed}}
let _impBusy=false;H.open.push(info=>{const by=S.bytes;setTimeout(async()=>{if(S.bytes!==by||_impBusy)return;const n=await countImportable();if(!n||S.bytes!==by||_impBusy)return;_impBusy=true;try{await importAnnotations({auto:true})}catch(e){showImportBanner(n)}finally{_impBusy=false}},info&&info.switched?150:900)});
function showImportBanner(n){let b=$('#peImp');if(b)b.remove();b=document.createElement('div');b.id='peImp';b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:110px;z-index:60;background:var(--panel);border:1px solid var(--acc);border-radius:10px;padding:8px 12px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.4)';
 b.innerHTML=`<span>This PDF has ${n} comment${n>1?'s':''} from another app.</span><button class="btn pri" id="peImpGo">Make editable</button><button class="btn" id="peImpX">✕</button>`;document.body.appendChild(b);$('#peImpGo').onclick=()=>{b.remove();importAnnotations()};$('#peImpX').onclick=()=>b.remove();setTimeout(()=>{if(b.isConnected)b.remove()},15000)}
/* ---------------- XFDF export / import ---------------- */
const xe=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pdfD=t=>{const d=new Date(t||Date.now()),p=v=>String(v).padStart(2,'0');return`D:${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`};
function toXfdf(){const P=(n,q)=>{const r=toPdf(n,q[0],q[1]);return[+r[0].toFixed(2),+r[1].toFixed(2)]};let out='';
 for(const m of S.markups){if(m.type==='pdfedit'||!S.pages[m.page-1])continue;const n=m.page,pi=n-1,s=m.style||{},b=bboxOf(m),c1=P(n,[b[0],b[3]]),c2=P(n,[b[2],b[1]]),rect=`${Math.min(c1[0],c2[0])},${Math.min(c1[1],c2[1])},${Math.max(c1[0],c2[0])},${Math.max(c1[1],c2[1])}`;
  const common=`page="${pi}" rect="${rect}" color="${xe(s.stroke||'#FF0000')}" width="${s.width??1}" opacity="${s.opacity??1}" title="${xe(m.author||'')}" subject="${xe(m.subject||'')}" date="${pdfD(m.modified)}" creationdate="${pdfD(m.created)}" name="${xe(m.id)}" planmark="${xe(encodeURIComponent(JSON.stringify(m)))}"`;
  const contents=`<contents>${xe([m.text,m.comment,(measOf(m)||{}).text].filter(Boolean).join('\n'))}</contents>`;const fill=s.fill&&s.fill!=='none'?` interior-color="${xe(s.fill)}"`:'';const verts=m.pts.map(q=>P(n,q).join(',')).join(';');
  if(['rect','text','image','redact'].includes(m.type)&&m.type!=='text')out+=`<square ${common}${fill}>${contents}</square>`;
  else if(m.type==='ellipse'||m.type==='circle')out+=`<circle ${common}${fill}>${contents}</circle>`;
  else if(['line','arrow','length','dimension','calibrate'].includes(m.type)){const a=P(n,m.pts[0]),z=P(n,m.pts[m.pts.length-1]);const H={arrow:'ClosedArrow',open:'OpenArrow',dot:'Circle',tick:'Slash',bar:'Butt'};out+=`<line ${common} start="${a.join(',')}" end="${z.join(',')}" head="${H[s.headS]||'None'}" tail="${H[s.headE]||'None'}">${contents}</line>`}
  else if(['polyline','polylength','angle','arc'].includes(m.type))out+=`<polyline ${common}><vertices>${verts}</vertices>${contents}</polyline>`;
  else if(['polygon','area','perimeter','volume','cloud','cloudplus','space'].includes(m.type))out+=`<polygon ${common}${fill}${m.type.startsWith('cloud')?' style="cloudy" intensity="1"':''}><vertices>${verts}</vertices>${contents}</polygon>`;
  else if(['pen','highlight'].includes(m.type))out+=`<ink ${common}><inklist><gesture>${verts}</gesture></inklist>${contents}</ink>`;
  else if(['text','callout','typewriter'].includes(m.type))out+=`<freetext ${common}${fill}>${contents}<defaultappearance>/Helv ${s.fontSize||12} Tf</defaultappearance></freetext>`;
  else if(m.type==='note')out+=`<text ${common} icon="Note">${contents}</text>`;
  else if(['texthl','underline','strikeout'].includes(m.type)){const R=m.rects||[b];const coords=R.map(r=>{const a=P(n,[r[0],r[1]]),bq=P(n,[r[2],r[1]]),c=P(n,[r[0],r[3]]),d=P(n,[r[2],r[3]]);return[...a,...bq,...c,...d].join(',')}).join(',');out+=`<${m.type==='texthl'?'highlight':m.type} ${common} coords="${coords}">${contents}</${m.type==='texthl'?'highlight':m.type}>`}
  else out+=`<stamp ${common}>${contents}</stamp>`}
 return`<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve"><f href="${xe(S.fileName)}"/><annots>${out}</annots></xfdf>`}
function exportXfdf(){if(!S.pages.length)return toast('Open a PDF first');saveFile(baseName()+'-markups.xfdf',toXfdf())}
function fromXfdf(xml){const dom=new DOMParser().parseFromString(xml,'application/xml');if(dom.querySelector('parsererror'))throw new Error('Not a valid XFDF file');const ann=dom.getElementsByTagName('annots')[0];if(!ann)return[];const ms=[];
 for(const el of Array.from(ann.children)){const pg=(+el.getAttribute('page')||0)+1;if(!S.pages[pg-1])continue;const pm=el.getAttribute('planmark');
  if(pm){try{const m=JSON.parse(decodeURIComponent(pm));m.id=uid();m.page=pg;ms.push(m);continue}catch(e){}}
  const V=(x,y)=>toVp(pg,x,y),nums=s=>String(s||'').split(/[,; ]+/).filter(Boolean).map(Number),pairs=s=>{const v=nums(s),o=[];for(let i=0;i+1<v.length;i+=2)o.push(V(v[i],v[i+1]));return o};
  const r=nums(el.getAttribute('rect')),vr=r.length===4?[V(r[0],r[3]),V(r[2],r[1])]:[[0,0],[10,10]];const col=el.getAttribute('color')||'#e0312b',w=+(el.getAttribute('width')||1),op=+(el.getAttribute('opacity')||1),fill=el.getAttribute('interior-color');
  const ct=(el.getElementsByTagName('contents')[0]||{}).textContent||'';const meta={author:el.getAttribute('title')||'Imported',subject:el.getAttribute('subject')||'',comment:ct};const vtx=(el.getElementsByTagName('vertices')[0]||{}).textContent||'';
  const add=(type,pts,extra={})=>{const m=newMarkup(type,pg,pts,Object.assign({},S.defaults[type]||{},{stroke:col,width:w,opacity:op},extra.style||{}));delete extra.style;Object.assign(m,meta,extra);if(!m.subject)m.subject=defSubject(type);ms.push(m)};
  const tag=el.tagName.toLowerCase();
  if(tag==='square')add('rect',vr,{style:{fill:fill||'none'}});else if(tag==='circle')add('ellipse',vr,{style:{fill:fill||'none'}});
  else if(tag==='line'){const a=nums(el.getAttribute('start')),z=nums(el.getAttribute('end'));add(/Length|Dimension/i.test(meta.subject)?'length':'line',[V(a[0],a[1]),V(z[0],z[1])])}
  else if(tag==='polyline')add(/Length/i.test(meta.subject)?'polylength':'polyline',pairs(vtx));
  else if(tag==='polygon')add(/Area/i.test(meta.subject)?'area':el.getAttribute('style')==='cloudy'?'cloud':'polygon',pairs(vtx),{style:{fill:fill||'none'}});
  else if(tag==='ink'){for(const gst of Array.from(el.getElementsByTagName('gesture')))add('pen',pairs(gst.textContent))}
  else if(tag==='freetext')add('text',vr,{text:ct,comment:''});else if(tag==='text')add('note',[vr[0]]);
  else if(['highlight','underline','strikeout','squiggly'].includes(tag)){const v=nums(el.getAttribute('coords')),R=[];for(let i=0;i+7<v.length;i+=8){const c=[V(v[i],v[i+1]),V(v[i+2],v[i+3]),V(v[i+4],v[i+5]),V(v[i+6],v[i+7])];R.push([Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))])}
   const bb=R.length?ptsBox(R.flatMap(q=>[[q[0],q[1]],[q[2],q[3]]])):ptsBox(vr);add(tag==='highlight'?'texthl':tag==='strikeout'?'strikeout':'underline',[[bb[0],bb[1]],[bb[2],bb[3]]],{rects:R})}
  else add('rect',vr,{style:{fill:'none'}})}
 return ms}
function importXfdfText(xml){const ms=fromXfdf(xml);if(!ms.length){toast('No markups found in that XFDF');return 0}pushUndo();S.markups.push(...ms);commit();toast(`Imported ${ms.length} markups from XFDF`);return ms.length}
function importXfdf(){const i=document.createElement('input');i.type='file';i.accept='.xfdf,.xml,application/xml';i.onchange=async()=>{const f=i.files[0];if(!f)return;try{importXfdfText(await f.text())}catch(e){toast(e.message)}};i.click()}
/* ---------------- text extraction helpers ---------------- */
async function pageLines(n){const{items,vp}=await pageText(n);const its=[];for(const it of items){if(!it.str||!it.str.trim())continue;let x,y,h;if(it.vb){x=it.vb[0];y=it.vb[3];h=it.vb[3]-it.vb[1]}else{const p=vp.convertToViewportPoint(it.x,it.y);x=p[0];y=p[1];h=it.h||10}
  its.push({s:it.str,x,y,h,w:it.vb?it.vb[2]-it.vb[0]:it.w||it.str.length*h*.5})}
 its.sort((a,b)=>a.y-b.y||a.x-b.x);const lines=[];for(const it of its){const L=lines.find(l=>Math.abs(l.y-it.y)<Math.max(2,it.h*.45));if(L){L.items.push(it)}else lines.push({y:it.y,h:it.h,items:[it]})}
 lines.forEach(l=>{l.items.sort((a,b)=>a.x-b.x);let s='',end=null;for(const it of l.items){if(end!=null&&it.x-end>it.h*.25&&!/\s$/.test(s))s+=' ';s+=it.s;end=it.x+it.w}l.text=s.replace(/\s+/g,' ').trim();l.x=l.items[0].x});lines.sort((a,b)=>a.y-b.y);return lines}
function paragraphs(lines){const out=[];let cur=null,prev=null;for(const l of lines){if(cur&&prev&&l.y-prev.y<Math.max(prev.h,l.h)*1.8&&Math.abs(l.x-prev.x)<l.h*6)cur.text+=' '+l.text;else{cur={text:l.text};out.push(cur)}prev=l}return out}
/* ---------------- exports & conversions ---------------- */
async function renderPageCanvas(n,dpi,withMarks){const pg=await S.pdf.getPage(n),k=dpi/72,v=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 await pg.render({canvasContext:ctx,viewport:v}).promise;if(withMarks&&window.drawPrimsCanvas){ctx.save();ctx.scale(k,k);for(const m of S.markups)if(m.page===n&&!m.hidden)drawPrimsCanvas(ctx,prims(m));ctx.restore()}return c}
const blobOf=(c,type,q)=>new Promise(r=>c.toBlob(r,type,q));
async function exportImages(o={}){const dpi=o.dpi||150,fmt_=o.format||'png',type=fmt_==='jpg'?'image/jpeg':'image/png',pages=o.pages||S.pages.map(p=>p.num);
 if(pages.length===1){const c=await renderPageCanvas(pages[0],dpi,o.marks!==false);return saveFile(`${baseName()}-p${pages[0]}.${fmt_}`,await blobOf(c,type,.9))}
 const z=new JSZip();for(const n of pages){const c=await renderPageCanvas(n,dpi,o.marks!==false);z.file(`${baseName()}-p${String(n).padStart(3,'0')}.${fmt_}`,await blobOf(c,type,.9))}return saveFile(baseName()+'-images.zip',await z.generateAsync({type:'blob'}))}
async function exportText(kind){const parts=[];for(const p of S.pages)parts.push(paragraphs(await pageLines(p.num)));
 if(kind==='html'){const body=parts.map((ps,i)=>`<section class="page"><h2>Page ${i+1}</h2>${ps.map(p=>`<p>${xe(p.text)}</p>`).join('')}</section>`).join('\n');return saveFile(baseName()+'.html',`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${xe(baseName())}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:820px;margin:30px auto;padding:0 16px}.page{page-break-after:always;border-bottom:1px solid #ddd;padding-bottom:20px}</style></head><body>${body}</body></html>`)}
 return saveFile(baseName()+'.txt',parts.map(ps=>ps.map(p=>p.text).join('\n\n')).join('\n\f\n'))}
async function exportDocx(o={}){const z=new JSZip(),rels=[],media=[];let body='';
 for(let i=0;i<S.pages.length;i++){const n=i+1;if(o.images){const c=await renderPageCanvas(n,110,true);const id='rIdImg'+n,file=`media/page${n}.png`;z.file('word/'+file,await blobOf(c,'image/png'));rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${file}"/>`);
   const cx=Math.round(6.5*914400),cy=Math.round(cx*c.height/c.width);body+=`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Page ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="page${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`}
  for(const p of paragraphs(await pageLines(n)))body+=`<w:p><w:r><w:t xml:space="preserve">${xe(p.text)}</w:t></w:r></w:p>`;
  if(i<S.pages.length-1)body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>'}
 z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 z.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
 z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`);
 return saveFile(baseName()+'.docx',await z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))}
async function tableRows(n){const lines=await pageLines(n);const xs=[];lines.forEach(l=>l.items.forEach(it=>xs.push(it.x)));xs.sort((a,b)=>a-b);const cols=[];for(const x of xs){if(!cols.length||x-cols[cols.length-1].max>14)cols.push({min:x,max:x,n:1});else{const c=cols[cols.length-1];c.max=x;c.n++}}
 const starts=cols.filter(c=>c.n>=2||cols.length<4).map(c=>c.min);if(!starts.length)starts.push(0);
 return lines.map(l=>{const row=new Array(starts.length).fill('');for(const it of l.items){let ci=0;for(let k=0;k<starts.length;k++)if(it.x>=starts[k]-6)ci=k;row[ci]=(row[ci]?row[ci]+' ':'')+it.s.trim()}return row.map(v=>{const t=v.replace(/\s+/g,' ').trim();const num=t.replace(/[$,]/g,'');return t!==''&&/^-?\d+(\.\d+)?$/.test(num)?+num:t})})}
async function exportXlsx(){const sheets=[];for(const p of S.pages){const rows=await tableRows(p.num);if(!rows.length)rows.push(['']);const w=Math.max(...rows.map(r=>r.length));sheets.push({name:'Page '+p.num,rows:rows.map(r=>r.concat(new Array(w-r.length).fill('')))})}
 if(!window.PMOutput||!PMOutput.xlsx)return toast('Excel engine missing');return saveFile(baseName()+'-tables.xlsx',await PMOutput.xlsx(sheets))}
const SIZES={Letter:[612,792],Legal:[612,1008],Tabloid:[792,1224],'ARCH A':[648,864],'ARCH B':[864,1296],'ARCH C':[1296,1728],'ARCH D':[1728,2592],'ARCH E':[2592,3456],A4:[595.28,841.89],A3:[841.89,1190.55],A1:[1683.78,2383.94]};
function newPdfDialog(){modal('New PDF',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Page size</label><select class="ti" id="npS">${Object.keys(SIZES).map(k=>`<option ${k==='Letter'?'selected':''}>${k}</option>`).join('')}</select></div><div><label style="font-size:11px;color:var(--mut)">Orientation</label><select class="ti" id="npO"><option value="p">Portrait</option><option value="l">Landscape</option></select></div><div><label style="font-size:11px;color:var(--mut)">Pages</label><input class="ti" type="number" min="1" max="500" id="npN" value="1"></div></div>
 <div class="sec">…or from images</div><input type="file" class="ti" id="npI" multiple accept="image/png,image/jpeg"><label class="chk" style="margin-top:6px"><input type="checkbox" id="npFit"> Put each image on a page of the size above (otherwise page = image size)</label>`,
 [{label:'Cancel',cancel:1},{label:'Create',pri:1,fn:md=>{const files=[...md.querySelector('#npI').files];const sz=SIZES[md.querySelector('#npS').value].slice();if(md.querySelector('#npO').value==='l')sz.reverse();
  setTimeout(()=>files.length?pdfFromImages(files,md.querySelector('#npFit').checked?sz:null):blankPdf(sz,+md.querySelector('#npN').value||1),0)}}])}
async function blankPdf(sz,count){const d=await PDFLib.PDFDocument.create();for(let i=0;i<count;i++)d.addPage(sz);d.setTitle('Untitled');await openBytes(new Uint8Array(await d.save()),'New Document.pdf')}
async function pdfFromImages(files,fit){const d=await PDFLib.PDFDocument.create();for(const f of files){const by=new Uint8Array(await f.arrayBuffer());const img=/png$/i.test(f.type)||/\.png$/i.test(f.name)?await d.embedPng(by):await d.embedJpg(by);
  if(fit){const pg=d.addPage(fit);const s=Math.min((fit[0]-36)/img.width,(fit[1]-36)/img.height);pg.drawImage(img,{x:(fit[0]-img.width*s)/2,y:(fit[1]-img.height*s)/2,width:img.width*s,height:img.height*s})}
  else{const pg=d.addPage([img.width*.72,img.height*.72]);pg.drawImage(img,{x:0,y:0,width:img.width*.72,height:img.height*.72})}}
 await openBytes(new Uint8Array(await d.save()),(files.length===1?files[0].name.replace(/\.\w+$/,''):'Images')+'.pdf');return d.getPageCount()}
async function detectSkew(n){const pg=await S.pdf.getPage(n),v1=pg.getViewport({scale:1}),k=Math.min(1.6,1400/Math.max(v1.width,v1.height)),c=await renderPageCanvas(n,72*k,false);const W=c.width,H=c.height,d=c.getContext('2d').getImageData(0,0,W,H).data;
 const xs=[],ys=[];for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){const i=(y*W+x)*4;if(d[i]*.3+d[i+1]*.59+d[i+2]*.11<140){xs.push(x-W/2);ys.push(y-H/2)}}
 const step=Math.max(1,Math.floor(xs.length/80000));const score=deg=>{const r=deg*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r),bins=new Float64Array(H*2+10);for(let i=0;i<xs.length;i+=step){const yy=Math.round(ys[i]*cs-xs[i]*sn+H);if(yy>=0&&yy<bins.length)bins[yy]++}let s=0;for(const b of bins)s+=b*b;return s};
 let best=0,bs=-1;for(let a=-8;a<=8.001;a+=.25){const s=score(a);if(s>bs){bs=s;best=a}}const center=best;for(let a=center-.25;a<=center+.25;a+=.025){const s=score(a);if(s>bs){bs=s;best=a}}
 return+best.toFixed(2)}// degrees the text lines are rotated on screen (clockwise positive)
async function deskew(pages,opts={}){const angles={};for(const n of pages)angles[n]=await detectSkew(n);const todo=pages.filter(n=>Math.abs(angles[n])>=.05&&Math.abs(angles[n])<8);
 if(!todo.length){if(!opts.quiet)toast('Pages are already straight');return angles}
 await PMBatch.rebuild(async doc=>{for(const n of todo){const page=doc.getPage(n-1),vp=vpOf(n),w=page.getWidth(),h=page.getHeight();const mb=page.getMediaBox();const cx=mb.x+w/2,cy=mb.y+h/2;
   // screen clockwise skew a  => rotate content by +a (counter-clockwise in PDF space) around the centre
   const sign=(vp.rotation||0)%180?-1:1,r=sign*angles[n]*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r);
   const pre=doc.context.register(doc.context.flateStream(unlat(`q ${fmt(cs)} ${fmt(sn)} ${fmt(-sn)} ${fmt(cs)} ${fmt(cx-cx*cs+cy*sn)} ${fmt(cy-cx*sn-cy*cs)} cm\n`))),post=doc.context.register(doc.context.flateStream(unlat('\nQ')));wrapStreams(page,pre,post)}
  return Array.from({length:doc.getPageCount()},(_,i)=>i)},'Straightening pages');if(!opts.quiet)toast('Straightened '+todo.map(n=>`p${n} (${angles[n]}°)`).join(', '));return angles}
async function repairPdf(){toast('Repairing…');let bytes=null,how='';try{const d=await _load.call(PDFLib.PDFDocument,S.bytes,{ignoreEncryption:true,throwOnInvalidObject:false,updateMetadata:false});bytes=await d.save({useObjectStreams:true});how='rebuilt the file structure'}
 catch(e){const d=await PDFLib.PDFDocument.create();for(const p of S.pages){const c=await renderPageCanvas(p.num,200,false);const img=await d.embedJpg(new Uint8Array(await (await blobOf(c,'image/jpeg',.9)).arrayBuffer()));const pg=d.addPage([p.w,p.h]);pg.drawImage(img,{x:0,y:0,width:p.w,height:p.h})}bytes=await d.save();how='re-created every page from its rendered image (the original structure was unreadable)'}
 await openBytes(new Uint8Array(bytes),baseName()+'-repaired.pdf');toast('Repaired: '+how);return how}
function loadIcc(){return new Promise((res,rej)=>{if(window.PM_SRGB_ICC)return res(unb64(window.PM_SRGB_ICC));const s=document.createElement('script');s.src='lib/pdfedit/srgb-icc.js';s.onload=()=>res(unb64(window.PM_SRGB_ICC));s.onerror=()=>rej(new Error('ICC profile missing'));document.head.appendChild(s)})}
async function archivePdfa(o={}){toast('Building archive copy…');const base=await PMOutput.markedPdf(true);const d=await _load.call(PDFLib.PDFDocument,base,{updateMetadata:false});const ctx=d.context,P=PL();
 const title=d.getTitle()||baseName(),now=new Date();d.setTitle(title);d.setProducer('PlanMark');d.setModificationDate(now);if(!d.getCreationDate())d.setCreationDate(now);
 const iso=x=>x.toISOString().replace(/\.\d+Z$/,'Z');
 const xmp=`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xe(title)}</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>${xe(d.getAuthor()||settings.author||'')}</rdf:li></rdf:Seq></dc:creator><xmp:CreateDate>${iso(d.getCreationDate()||now)}</xmp:CreateDate><xmp:ModifyDate>${iso(now)}</xmp:ModifyDate><pdf:Producer>PlanMark</pdf:Producer></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
 const meta=ctx.stream(new TextEncoder().encode(xmp),{Type:'Metadata',Subtype:'XML'});d.catalog.set(N('Metadata'),ctx.register(meta));
 let icc=null;try{icc=await loadIcc()}catch(e){}
 if(icc){const iccS=ctx.flateStream(icc,{N:3});const oi=ctx.obj({Type:'OutputIntent',S:'GTS_PDFA1',OutputConditionIdentifier:PDFLib.PDFString.of('sRGB IEC61966-2.1'),Info:PDFLib.PDFString.of('sRGB IEC61966-2.1'),DestOutputProfile:ctx.register(iccS)});d.catalog.set(N('OutputIntents'),ctx.obj([ctx.register(oi)]))}
 // fonts that are not embedded are not allowed in PDF/A: rasterize those pages
 const issues=[];const L=x=>x instanceof P.PDFRef?ctx.lookup(x):x;const bad=new Set();
 d.getPages().forEach((p,i)=>{const res=resourcesOf(ctx,p.node);const F=L(res.get(N('Font')));if(!F)return;for(const[k,v]of F.entries()){const fd=L(v);let desc=L(fd.get(N('FontDescriptor')));const st=L(fd.get(N('Subtype')));if(st&&st.decodeText&&st.decodeText()==='Type0'){const df=L(L(fd.get(N('DescendantFonts')))?.get(0));desc=df&&L(df.get(N('FontDescriptor')))}
  if(!(desc&&(desc.get(N('FontFile'))||desc.get(N('FontFile2'))||desc.get(N('FontFile3')))))bad.add(i)}});
 let rasterized=[];if(bad.size&&o.rasterize!==false){const pdfjs=await pdfjsLib.getDocument({data:base.slice()}).promise;for(const i of[...bad].sort((a,b)=>b-a)){const pg=await pdfjs.getPage(i+1),v=pg.getViewport({scale:200/72}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:cx,viewport:v}).promise;
   const img=await d.embedJpg(new Uint8Array(await (await blobOf(c,'image/jpeg',.88)).arrayBuffer()));const old=d.getPage(i),w=v.width*72/200,h=v.height*72/200;const np=d.insertPage(i+1,[w,h]);np.drawImage(img,{x:0,y:0,width:w,height:h});d.removePage(i);rasterized.push(i+1)}pdfjs.destroy()}
 else if(bad.size)issues.push(`${bad.size} page(s) use fonts that are not embedded`);
 if(!icc)issues.push('no sRGB output intent');
 const bytes=await d.save({useObjectStreams:false});await saveFile(baseName()+'-archive-PDFA.pdf',new Blob([bytes],{type:'application/pdf'}));
 toast(`Saved a PDF/A-style archive copy (PDF/A-2b metadata + sRGB output intent${rasterized.length?`; pages ${rasterized.join(', ')} converted to images to remove non-embedded fonts`:''}). Not a certified PDF/A — validate with a PDF/A checker if it is required.`);return{rasterized,issues,bytes}}
async function saveVariant(compressed){toast('Building…');const by=await PMOutput.markedPdf(false);const d=await _load.call(PDFLib.PDFDocument,by,{updateMetadata:false});const out=await d.save({useObjectStreams:!!compressed,objectsPerTick:200});
 return saveFile(baseName()+(compressed?'-compressed':'-compatible')+'.pdf',new Blob([out],{type:'application/pdf'}))}
/* ---------------- Content dialog, ribbon, shortcuts ---------------- */
function contentDialog(){const b=(id,t,d)=>`<button class="btn" id="${id}" style="border:1px solid var(--line);justify-content:flex-start;height:auto;padding:7px 9px;flex-direction:column;align-items:flex-start;white-space:normal;text-align:left"><b>${t}</b><small style="color:var(--mut)">${d}</small></button>`;
 modal('Content & conversion',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
 ${b('ceEdit','Edit Text','Click PDF text to change it (Ctrl+Shift+T)')}${b('ceAdd','Add Text','Write new text into the page')}
 ${b('ceDel','Delete Text','Click PDF text to remove it')}${b('ceRep','Search & Replace','Find and replace text in the page content')}
 ${b('ceErase','Erase Content','Remove drawing content inside an area')}${b('ceCopy','Copy Content','Copy vector content from an area')}
 ${b('ceCut','Cut Content','Copy and remove content in an area')}${b('cePaste','Paste Content','Place copied content (any page or document)')}
 ${b('ceProps','Document Properties','Title, author, keywords, fonts (Ctrl+D)')}${b('ceImp','Import comments','Make markups from other apps editable')}
 ${b('ceXo','Export XFDF','Markups for Bluebeam / Acrobat')}${b('ceXi','Import XFDF','Load markups from Bluebeam / Acrobat')}
 ${b('ceImg','Export images','PNG / JPEG pages, zipped')}${b('ceTxt','Export text','Plain text or HTML')}
 ${b('ceDoc','Export to Word','Text in reading order (.docx)')}${b('ceXls','Export to Excel','Text tables by rows & columns')}
 ${b('ceNew','New PDF','Blank pages or from images')}${b('ceSkew','Deskew','Straighten scanned pages')}
 ${b('ceRep2','Repair PDF','Rebuild a damaged file')}${b('ceA','Archive (PDF/A)','PDF/A-style archive copy')}
 ${b('ceC1','Save compressed','Smallest file (object streams)')}${b('ceC2','Save compatible','Without object streams, for old viewers')}</div>`,[{label:'Close',cancel:1}]);
 const go=(id,fn)=>{const el=$('#'+id);if(el)el.onclick=()=>{closeModal();if(!S.pages.length&&!['ceNew'].includes(id))return toast('Open a PDF first');fn()}};
 go('ceEdit',()=>setTool('edittext'));go('ceAdd',()=>setTool('addtext'));go('ceDel',()=>setTool('deltext'));go('ceRep',replaceDialog);go('ceErase',()=>modal('Erase content',`<div class="hint">Pick the area. Lines, shapes, images and text that lie completely inside it are removed from the page. Content that only crosses the edge stays — tick below to also white it out.</div><label class="chk" style="margin-top:8px"><input type="checkbox" id="erW"> Also white out the whole area</label>`,[{label:'Cancel',cancel:1},{label:'Pick area',pri:1,fn:md=>{const w=md.querySelector('#erW').checked;setTimeout(()=>eraseContent({whiteout:w}),0)}}]));
 go('ceCopy',()=>copyContent(false));go('ceCut',()=>copyContent(true));go('cePaste',pasteContent);go('ceProps',propsDialog);go('ceImp',importAnnotations);go('ceXo',exportXfdf);go('ceXi',importXfdf);
 go('ceImg',()=>modal('Export images',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Format</label><select class="ti" id="eiF"><option value="png">PNG</option><option value="jpg">JPEG</option></select></div><div><label style="font-size:11px;color:var(--mut)">Resolution (dpi)</label><select class="ti" id="eiD"><option>72</option><option>96</option><option selected>150</option><option>200</option><option>300</option></select></div></div><div class="fld"><label>Pages</label><select class="ti" id="eiP"><option value="cur">Current page</option><option value="all">All pages (zip)</option></select></div><label class="chk"><input type="checkbox" id="eiM" checked> Include markups</label>`,[{label:'Cancel',cancel:1},{label:'Export',pri:1,fn:md=>{const o={format:md.querySelector('#eiF').value,dpi:+md.querySelector('#eiD').value,pages:md.querySelector('#eiP').value==='cur'?[S.cur]:null,marks:md.querySelector('#eiM').checked};setTimeout(()=>exportImages(o),0)}}]));
 go('ceTxt',()=>modal('Export text',`<div class="hint">Includes text recognized by OCR.</div>`,[{label:'Cancel',cancel:1},{label:'HTML',fn:()=>{exportText('html')}},{label:'Plain text',pri:1,fn:()=>{exportText('txt')}}]));
 go('ceDoc',()=>modal('Export to Word',`<label class="chk"><input type="checkbox" id="dxI"> Also include an image of each page (with markups)</label>`,[{label:'Cancel',cancel:1},{label:'Export',pri:1,fn:md=>{const im=md.querySelector('#dxI').checked;setTimeout(()=>exportDocx({images:im}),0)}}]));
 go('ceXls',exportXlsx);go('ceNew',newPdfDialog);go('ceSkew',()=>modal('Deskew',`<div class="fld"><label>Pages</label><select class="ti" id="dsP"><option value="cur">Current page</option><option value="all">All pages</option></select></div><div class="hint">Detects how much each scanned page is tilted and turns its content straight (vector content stays sharp).</div>`,[{label:'Cancel',cancel:1},{label:'Straighten',pri:1,fn:md=>{const all=md.querySelector('#dsP').value==='all';setTimeout(()=>deskew(all?S.pages.map(p=>p.num):[S.cur]),0)}}]));
 go('ceRep2',repairPdf);go('ceA',archivePdfa);go('ceC1',()=>saveVariant(true));go('ceC2',()=>saveVariant(false))}
H.ribbon.push({label:'Content',title:'Edit PDF text & content, document properties, conversions',icon:'<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><path d="M8 17l6-6 2 2-6 6H8z"/>',fn:contentDialog});
Object.assign(KEYS,{edittext:'Ctrl+Shift+T',addtext:'Ctrl+Shift+A',deltext:''});
document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select'))return;if(modalCb)return;const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
 if(mod&&e.shiftKey&&k==='t'){e.preventDefault();e.stopPropagation();if(S.pages.length)setTool('edittext')}
 else if(mod&&!e.shiftKey&&k==='d'&&e.altKey){e.preventDefault();propsDialog()}
 else if(k==='escape'&&(PASTE||panel)){PASTE=null;closePanel();updateRibbon()}},true);
window.PM_EXTRA_SYNC_KEYS_PDFEDIT=[];
window.PMPdfEdit={parseContent,analyzePage,applyEdits,getRuns,runAt,clientAnalysis,eraseContent,copyContent,pasteContent,doPaste:(n,pt)=>doPaste(S.pages[n-1],pt),replaceAll,replaceDialog,propsDialog,importAnnotations,importXfdfText,toXfdf,exportXfdf,
 exportImages,exportText,exportDocx,exportXlsx,blankPdf,pdfFromImages,detectSkew,deskew,repairPdf,archivePdfa,saveVariant,contentDialog,addEdit,runEditData,canReuse,openPanel,closePanel,setClip:c=>{CLIP=c},getClip:()=>CLIP};
})();
