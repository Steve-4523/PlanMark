/* PlanMark — document tools: hyperlinks & Batch Link, bookmarks & table of contents, page labels & drawing log,
   headers/footers & Bates numbering, crop / insert blank / replace / slip sheet / resize pages,
   password-protected PDFs (decrypted on open so they can be marked up and saved), attachments, reduce file size. */
(function(){
const DP={labels:null,custom:false,outline:null,links:{},hoverLink:null,att:[],attAdd:[],attRemove:new Set(),encrypted:null,exporting:false,pending:null};
window.PMDoc=DP;
const PL=()=>window.PDFLib;
const lbKey=()=>'pm:pl:'+S.fileKey,bmKey=()=>'pm:bm:'+S.fileKey;

/* =====================================================================================
   1. ENCRYPTED PDFs — standard security handler (RC4 40/128, AES-128, AES-256 R5/R6)
   ===================================================================================== */
const PAD=new Uint8Array([0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A]);
const cat=(...a)=>{const n=a.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};
const eq=(a,b,n)=>{for(let i=0;i<n;i++)if(a[i]!==b[i])return false;return true};
function md5(data){const K=new Uint32Array(64),r=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
 for(let i=0;i<64;i++)K[i]=Math.floor(Math.abs(Math.sin(i+1))*4294967296);
 const len=data.length,nb=((len+8)>>6)+1,w=new Uint32Array(nb*16);for(let i=0;i<len;i++)w[i>>2]|=data[i]<<((i%4)*8);w[len>>2]|=0x80<<((len%4)*8);w[nb*16-2]=(len*8)>>>0;w[nb*16-1]=Math.floor(len/536870912);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 for(let j=0;j<nb*16;j+=16){let A=a0,B=b0,C=c0,D=d0;for(let i=0;i<64;i++){let F,g;if(i<16){F=(B&C)|(~B&D);g=i}else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)%16}else if(i<48){F=B^C^D;g=(3*i+5)%16}else{F=C^(B|~D);g=(7*i)%16}
  const t=D;D=C;C=B;const x=(A+F+K[i]+w[j+g])>>>0;B=(B+((x<<r[i])|(x>>>(32-r[i]))))>>>0;A=t}a0=(a0+A)>>>0;b0=(b0+B)>>>0;c0=(c0+C)>>>0;d0=(d0+D)>>>0}
 const o=new Uint8Array(16);[a0,b0,c0,d0].forEach((v,i)=>{for(let k=0;k<4;k++)o[i*4+k]=(v>>>(8*k))&255});return o}
function rc4(key,data){const s=new Uint8Array(256);for(let i=0;i<256;i++)s[i]=i;for(let i=0,j=0;i<256;i++){j=(j+s[i]+key[i%key.length])&255;[s[i],s[j]]=[s[j],s[i]]}
 const o=new Uint8Array(data.length);for(let k=0,i=0,j=0;k<data.length;k++){i=(i+1)&255;j=(j+s[i])&255;[s[i],s[j]]=[s[j],s[i]];o[k]=data[k]^s[(s[i]+s[j])&255]}return o}
const subtle=()=>crypto.subtle;
const aesKey=(k,use)=>subtle().importKey('raw',k,{name:'AES-CBC'},false,[use]);
async function aesEncNoPad(key,iv,data){const k=await aesKey(key,'encrypt');return new Uint8Array(await subtle().encrypt({name:'AES-CBC',iv},k,data)).slice(0,data.length)}
async function aesDecNoPad(key,iv,data){if(!data.length)return data;const ke=await aesKey(key,'encrypt'),kd=await aesKey(key,'decrypt');const last=data.slice(data.length-16),blk=new Uint8Array(16);for(let i=0;i<16;i++)blk[i]=0x10^last[i];
 const x=new Uint8Array(await subtle().encrypt({name:'AES-CBC',iv:new Uint8Array(16)},ke,blk)).slice(0,16);return new Uint8Array(await subtle().decrypt({name:'AES-CBC',iv},kd,cat(data,x)))}
async function aesDec(key,data){if(data.length<32||data.length%16)return data.length<=16?new Uint8Array(0):data;const iv=data.slice(0,16),ct=data.slice(16);
 try{const k=await aesKey(key,'decrypt');return new Uint8Array(await subtle().decrypt({name:'AES-CBC',iv},k,ct))}catch(e){const p=await aesDecNoPad(key,iv,ct),n=p[p.length-1];return n>0&&n<=16?p.slice(0,p.length-n):p}}
const sha=async(alg,d)=>new Uint8Array(await subtle().digest(alg,d));
async function hash2B(pw,salt,udata,R){let K=await sha('SHA-256',cat(pw,salt,udata));if(R===5)return K;
 for(let i=0;;){const unit=cat(pw,K,udata),K1=new Uint8Array(unit.length*64);for(let j=0;j<64;j++)K1.set(unit,j*unit.length);
  const E=await aesEncNoPad(K.slice(0,16),K.slice(16,32),K1);let s=0;for(let j=0;j<16;j++)s+=E[j];const m=s%3;
  K=await sha(m===0?'SHA-256':m===1?'SHA-384':'SHA-512',E);i++;if(i>=64&&E[E.length-1]<=i-32)break}return K.slice(0,32)}
// --- tiny PDF object parser (enough for encryption and object-stream dictionaries)
const WS=c=>c===32||c===10||c===13||c===9||c===12||c===0,DL=c=>'()<>[]{}/%'.includes(String.fromCharCode(c));
function parseObj(t,p){const sk=()=>{for(;;){while(p<t.length&&WS(t.charCodeAt(p)))p++;if(t[p]==='%'){while(p<t.length&&t[p]!=='\n'&&t[p]!=='\r')p++}else break}};sk();
 const c=t[p];
 if(c==='<'&&t[p+1]==='<'){p+=2;const d={};for(;;){sk();if(t[p]==='>'&&t[p+1]==='>'){p+=2;break}if(t[p]!=='/')throw new Error('bad dict');const k=parseObj(t,p);p=k.p;const v=parseObj(t,p);p=v.p;d[k.v.name]=v.v}return{v:{dict:d},p}}
 if(c==='['){p++;const a=[];for(;;){sk();if(t[p]===']'){p++;break}const v=parseObj(t,p);p=v.p;a.push(v.v)}return{v:a,p}}
 if(c==='/'){let q=p+1;while(q<t.length&&!WS(t.charCodeAt(q))&&!DL(t.charCodeAt(q)))q++;return{v:{name:t.slice(p+1,q).replace(/#([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))},p:q}}
 if(c==='('){let q=p+1,depth=1;const out=[];while(q<t.length&&depth){let ch=t.charCodeAt(q);if(ch===92){q++;const e=t[q];const map={n:10,r:13,t:9,b:8,f:12,'(':40,')':41,'\\':92};
    if(e in map){out.push(map[e]);q++}else if(/[0-7]/.test(e)){let s='';while(s.length<3&&/[0-7]/.test(t[q]))s+=t[q++];out.push(parseInt(s,8)&255)}else if(e==='\r'){q++;if(t[q]==='\n')q++}else if(e==='\n'){q++}else{out.push(t.charCodeAt(q));q++}continue}
   if(ch===40)depth++;if(ch===41){depth--;if(!depth){q++;break}}out.push(ch);q++}return{v:{str:new Uint8Array(out)},p:q}}
 if(c==='<'){const q=t.indexOf('>',p);const h=t.slice(p+1,q).replace(/\s/g,'');const b=new Uint8Array(Math.ceil(h.length/2));for(let i=0;i<b.length;i++)b[i]=parseInt((h.substr(i*2,2)+'0').slice(0,2),16);return{v:{str:b},p:q+1}}
 const m=/^[+-]?(\d+\.?\d*|\.\d+)/.exec(t.slice(p,p+40));if(m){const n=+m[0];let q=p+m[0].length;const r=/^\s+(\d+)\s+R(?![A-Za-z])/.exec(t.slice(q,q+20));if(r&&/^\d+$/.test(m[0]))return{v:{ref:[n,+r[1]]},p:q+r[0].length};return{v:n,p:q}}
 if(t.startsWith('true',p))return{v:true,p:p+4};if(t.startsWith('false',p))return{v:false,p:p+5};if(t.startsWith('null',p))return{v:null,p:p+4};throw new Error('parse @'+p)}
const latin=b=>new TextDecoder('latin1').decode(b);
function findObj(t,n,g){const re=new RegExp('(?:^|[^0-9])'+n+'\\s+'+g+'\\s+obj\\b','g');let m,last=null;while((m=re.exec(t)))last=m;if(!last)return null;return last.index+last[0].length}
function readEncrypt(bytes){const t=latin(bytes);const i=t.lastIndexOf('/Encrypt');if(i<0)return null;
 let v=parseObj(t,i+8).v,ref=null;if(v&&v.ref){ref=v.ref;const p=findObj(t,ref[0],ref[1]);if(p==null)throw new Error('Encryption dictionary not found');v=parseObj(t,p).v}
 const di=t.lastIndexOf('/ID');let id0=new Uint8Array(0);if(di>=0){try{const a=parseObj(t,di+3).v;if(a&&a[0]&&a[0].str)id0=a[0].str}catch(e){}}
 const d=v.dict;const get=k=>d[k];const R=get('R')||2,V=get('V')||0;let method=V>=4?'?':'RC4',strM=method,stmM=method;
 if(V>=4){const cf=(get('CF')||{dict:{}}).dict;const mOf=nm=>{if(!nm||nm.name==='Identity')return'None';const f=cf[nm.name];const cfm=f&&f.dict.CFM&&f.dict.CFM.name;return cfm==='AESV2'?'AES':cfm==='AESV3'?'AES256':cfm==='V2'?'RC4':'None'};stmM=mOf(get('StmF'));strM=mOf(get('StrF'))}
 return{t,ref,id0,R,V,len:V>=5?32:V===1?5:((get('Length')||40)/8),O:get('O').str,U:get('U').str,OE:get('OE')&&get('OE').str,UE:get('UE')&&get('UE').str,P:get('P')|0,encMeta:get('EncryptMetadata')!==false,filter:(get('Filter')||{}).name,stmM,strM}}
async function deriveKey(E,pwStr){if(E.filter&&E.filter!=='Standard')throw new Error('This PDF uses a '+E.filter+' security handler (certificates), which PlanMark cannot open');
 if(E.R>=5){const pw=new TextEncoder().encode(pwStr).slice(0,127);
  if(eq(await hash2B(pw,E.U.slice(32,40),new Uint8Array(0),E.R),E.U,32))return{key:await aesDecNoPad(await hash2B(pw,E.U.slice(40,48),new Uint8Array(0),E.R),new Uint8Array(16),E.UE),owner:false};
  const u48=E.U.slice(0,48);if(eq(await hash2B(pw,E.O.slice(32,40),u48,E.R),E.O,32))return{key:await aesDecNoPad(await hash2B(pw,E.O.slice(40,48),u48,E.R),new Uint8Array(16),E.OE),owner:true};return null}
 const pad32=b=>{const o=new Uint8Array(32);const n=Math.min(32,b.length);o.set(b.slice(0,n));o.set(PAD.slice(0,32-n),n);return o};
 const pwb=new Uint8Array([...pwStr].map(c=>c.charCodeAt(0)&255));
 const keyFor=u=>{let h=md5(cat(pad32(u),E.O,new Uint8Array([E.P&255,(E.P>>8)&255,(E.P>>16)&255,(E.P>>>24)&255]),E.id0,E.R>=4&&!E.encMeta?new Uint8Array([255,255,255,255]):new Uint8Array(0)));
  if(E.R>=3)for(let i=0;i<50;i++)h=md5(h.slice(0,E.len));return h.slice(0,E.len)};
 const okUser=k=>{if(E.R===2)return eq(rc4(k,PAD),E.U,32);let x=rc4(k,md5(cat(PAD,E.id0)));for(let i=1;i<=19;i++)x=rc4(k.map(b=>b^i),x);return eq(x,E.U,16)};
 let k=keyFor(pwb);if(okUser(k))return{key:k,owner:false};
 let h=md5(pad32(pwb));if(E.R>=3)for(let i=0;i<50;i++)h=md5(h);const ok=h.slice(0,E.len);let up=E.O;if(E.R===2)up=rc4(ok,up);else for(let i=19;i>=0;i--)up=rc4(ok.map(b=>b^i),up);
 k=keyFor(up);if(okUser(k))return{key:k,owner:true};return null}
async function decObj(E,key,n,g,data,method){if(method==='None')return data;if(E.V>=5)return aesDec(key,data);
 const ok=md5(cat(key,new Uint8Array([n&255,(n>>8)&255,(n>>16)&255,g&255,(g>>8)&255]),method==='AES'?new Uint8Array([0x73,0x41,0x6C,0x54]):new Uint8Array(0))).slice(0,Math.min(E.len+5,16));
 return method==='AES'?aesDec(ok,data):rc4(ok,data)}
async function inflate(d){try{const ds=new DecompressionStream('deflate');const w=ds.writable.getWriter();w.write(d);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}catch(e){return null}}
async function decryptPdf(bytes,pw){const E=readEncrypt(bytes);if(!E)return{bytes};const K=await deriveKey(E,pw);if(!K)return null;const key=K.key,t=E.t;
 // pass 1: object streams are decrypted in the raw bytes so pdf-lib can read the objects inside them
 const inStm=new Set(),segs=[];let last=0;const re=/(\d+)\s+(\d+)\s+obj\s*<</g;let m;
 while((m=re.exec(t))){const n=+m[1],g=+m[2],ds=m.index+m[0].length-2;let pd;try{pd=parseObj(t,ds)}catch(e){continue}const d=pd.v.dict;if(!d||!d.Type||d.Type.name!=='ObjStm')continue;
  let q=pd.p;while(WS(t.charCodeAt(q)))q++;if(!t.startsWith('stream',q))continue;q+=6;if(t[q]==='\r')q++;if(t[q]==='\n')q++;
  let L=d.Length;if(L&&L.ref){const p2=findObj(t,L.ref[0],L.ref[1]);L=p2!=null?parseObj(t,p2).v:null}if(typeof L!=='number'){L=t.indexOf('endstream',q)-q;while(L>0&&(t[q+L-1]==='\n'||t[q+L-1]==='\r'))L--}
  const plain=await decObj(E,key,n,g,bytes.slice(q,q+L),E.stmM);
  const inf=d.Filter&&(d.Filter.name==='FlateDecode'||(Array.isArray(d.Filter)&&d.Filter[0]&&d.Filter[0].name==='FlateDecode'))?await inflate(plain):plain;
  if(inf){const hdr=latin(inf.slice(0,d.First||0)).trim().split(/\s+/);for(let i=0;i+1<hdr.length&&i/2<(d.N||0);i+=2)inStm.add(+hdr[i])}
  const dictTxt=t.slice(ds,pd.p).replace(/\/Length\s+\d+(\s+\d+\s+R)?/,'/Length '+plain.length);
  segs.push(bytes.slice(last,ds),new TextEncoder().encode(dictTxt),bytes.slice(pd.p,q),plain);last=q+L;re.lastIndex=q+L}
 segs.push(bytes.slice(last));const b2=segs.length>1?cat(...segs):bytes;
 // pass 2: every other string and stream, through pdf-lib
 const{PDFDocument,PDFDict,PDFArray,PDFString,PDFHexString,PDFRawStream,PDFName}=PL();
 const doc=await PDFDocument.load(b2,{ignoreEncryption:true,updateMetadata:false,throwOnInvalidObject:false});const ctx=doc.context;
 const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 const walk=async(o,n,g)=>{if(o instanceof PDFString||o instanceof PDFHexString)return PDFHexString.of(hex(await decObj(E,key,n,g,o.asBytes(),E.strM)));
  if(o instanceof PDFDict){for(const[k,v]of o.entries()){const nv=await walk(v,n,g);if(nv!==v)o.set(k,nv)}return o}
  if(o instanceof PDFArray){for(let i=0;i<o.size();i++){const v=o.get(i),nv=await walk(v,n,g);if(nv!==v)o.set(i,nv)}return o}return o};
 for(const[ref,obj]of ctx.enumerateIndirectObjects()){const n=ref.objectNumber,g=ref.generationNumber;if(inStm.has(n)||(E.ref&&n===E.ref[0]))continue;
  if(obj instanceof PDFRawStream){const ty=obj.dict.get(PDFName.of('Type'));if(ty===PDFName.of('XRef'))continue;await walk(obj.dict,n,g);
   if(!(ty===PDFName.of('Metadata')&&!E.encMeta))ctx.assign(ref,PDFRawStream.of(obj.dict,await decObj(E,key,n,g,obj.contents,E.stmM)))}
  else await walk(obj,n,g)}
 if(E.ref)try{ctx.delete(PL().PDFRef.of(E.ref[0],E.ref[1]))}catch(e){}delete ctx.trailerInfo.Encrypt;
 return{bytes:new Uint8Array(await doc.save({useObjectStreams:false})),owner:K.owner,P:E.P,R:E.R}}
function isEncrypted(bytes){const t=latin(bytes.length>8e6?cat(bytes.slice(0,4e6),bytes.slice(bytes.length-4e6)):bytes);return t.includes('/Encrypt')&&/\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(t)}
function askPassword(msg,name){return new Promise(res=>{modal('Password required',`<div class="hint" style="margin-bottom:8px">${esc(msg)}${name?'<br><b style="color:var(--text)">'+esc(name)+'</b>':''}</div><div class="fld"><input class="ti" type="password" id="dpPw" autocomplete="off" placeholder="Document password"></div>`,
 [{label:'Cancel',cancel:1,fn:()=>res(null)},{label:'Open',pri:1,fn:md=>res(md.querySelector('#dpPw').value)}])})}
async function unlock(bytes,name){let r=null;
 try{r=await decryptPdf(bytes,'')}catch(e){console.warn('decrypt',e);return{fallback:true,err:e}}
 if(r)return Object.assign(r,{pw:''});let msg='This PDF is password-protected. Enter its password to open it.';
 for(;;){const pw=await askPassword(msg,name);if(pw==null)return null;try{r=await decryptPdf(bytes,pw)}catch(e){console.warn('decrypt',e);return{fallback:true,err:e,pw}}if(r)return Object.assign(r,{pw});msg='That password is not correct. Try again.'}}
// every PDF opened by pdf.js (compare, overlay, sets…) can ask for its password too
if(window.pdfjsLib){const orig=window.pdfjsLib,_gd=orig.getDocument,lib={};for(const k in orig)lib[k]=orig[k];lib.getDocument=function(src){const task=_gd.call(orig,src);task.promise.then(doc=>{const ga=doc.getAttachments.bind(doc);doc.getAttachments=async()=>{const r=await ga();DP.lastAtt=r?Object.values(r):null;return r}}).catch(()=>{});if(!(src&&src.password!=null))task.onPassword=(update,reason)=>{askPassword(reason===2?'That password is not correct. Try again.':'This PDF is password-protected. Enter its password.').then(pw=>{if(pw==null){try{task.destroy()}catch(e){}}else update(pw)})};return task};window.pdfjsLib=lib}
const _open=openBytes;
openBytes=async function(bytes,name,restored){
 if(!restored&&window.PDFLib&&isEncrypted(bytes)){const r=await unlock(bytes,name);if(!r){toast('Not opened — password needed');return}
  if(r.fallback){toast("This PDF's protection can't be removed here; it opens read-only for saving");DP.encrypted={name,fallback:true}}
  else{const raw0=bytes;bytes=r.bytes;DP.encrypted={name,owner:r.owner,P:r.P,R:r.R,hadUserPw:r.pw!=='',pw:r.pw,raw:raw0};setTimeout(()=>toast(`Unlocked "${name}". When you save, it keeps the same password and permissions.`),1600)}}
 else if(!restored)DP.encrypted=null;
 // a PlanMark-saved PDF reopens from its embedded original: carry over what lives only in the outer file
 if(!restored){DP.outer=null;DP.lastAtt=null}
 else if(DP.lastAtt&&DP.lastAtt.some(a=>a.filename==='planmark-original.pdf')){const v=DP.lastAtt,meta=v.find(a=>a.filename==='planmark-docpro.json');let mj=null;try{mj=meta?JSON.parse(new TextDecoder().decode(meta.content)):null}catch(e){}
  DP.outer={att:v.filter(a=>!/^planmark-/.test(a.filename)).map(a=>({name:a.filename,bytes:a.content,desc:a.description||'',keep:true})),meta:mj};DP.lastAtt=null}
 return _open.call(this,bytes,name,restored)};

/* =====================================================================================
   2. PAGE LABELS
   ===================================================================================== */
async function loadLabels(){const doc=S.pdf;let l=null;try{l=await doc.getPageLabels()}catch(e){}if(doc!==S.pdf)return;const c=LS.get(lbKey(),null);
 if(c&&c.labels&&c.labels.length===S.pages.length){DP.labels=c.labels;DP.custom=true}else{DP.labels=l&&l.length===S.pages.length?l:null;DP.custom=false}showLabels()}
const labelOf=n=>(DP.labels&&DP.labels[n-1])||String(n);
window.PMLabels={labelOf:n=>labelOf(n),has:n=>!!(DP.labels&&DP.labels[n-1]&&DP.labels[n-1]!==String(n))};
const hasLabel=n=>DP.labels&&DP.labels[n-1]&&DP.labels[n-1]!==String(n);
function showLabels(){try{window.PMDrafting&&PMDrafting.decorateThumbs()}catch(e){}$$('.thumb').forEach(t=>{const n=+t.dataset.p,tn=[...t.childNodes].find(c=>c.nodeType===3);if(tn)tn.textContent='Page '+n+(hasLabel(n)?' · '+DP.labels[n-1]:'')});
 S.pages.forEach(p=>{const s=p.el.querySelector('.pn');if(s)s.textContent=p.num+(hasLabel(p.num)?' · '+DP.labels[p.num-1]:'')})}
const roman=n=>{const v=[[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];let s='';for(const[a,r]of v)while(n>=a){s+=r;n-=a}return s};
const alpha=n=>{const c=String.fromCharCode(97+((n-1)%26));return c.repeat(Math.floor((n-1)/26)+1)};
function fmtNumStyle(st,n){return st==='D'?String(n):st==='R'?roman(n).toUpperCase():st==='r'?roman(n):st==='A'?alpha(n).toUpperCase():st==='a'?alpha(n):''}
async function regionText(pdfDoc,n,r){const pg=await pdfDoc.getPage(n),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent(),box=[r[0]*vp.width,r[1]*vp.height,r[2]*vp.width,r[3]*vp.height],hits=[];
 for(const t of tc.items){if(!t.str||!t.str.trim())continue;const[x,y]=vp.convertToViewportPoint(t.transform[4],t.transform[5]);if(x>=box[0]-2&&x<=box[2]+2&&y>=box[1]-2&&y<=box[3]+4)hits.push({s:t.str.trim(),x,y})}
 if(pdfDoc===S.pdf&&S.ocr&&S.ocr[n])for(const w of S.ocr[n]){const[x0,y0,x1,y1]=w.vb;if(x0>=box[0]-2&&x1<=box[2]+2&&y0>=box[1]-2&&y1<=box[3]+4)hits.push({s:w.str,x:x0,y:y1})}
 hits.sort((a,b)=>Math.abs(a.y-b.y)>3?a.y-b.y:a.x-b.x);return hits.map(h=>h.s).join(' ').replace(/\s+/g,' ').trim()}
function normRegion(page,box){const p=S.pages[page-1];return[box[0]/p.w,box[1]/p.h,box[2]/p.w,box[3]/p.h]}
async function pickTitleBlock(msg){if(!window.PMAuto)throw new Error('Region picker missing');const r=await PMAuto.pickRegion(msg||'Draw a box around the sheet number in the title block');return normRegion(r.page,r.box)}
function labelsDialog(){if(!S.pages.length)return toast('Open a PDF first');const cur=S.pages.map(p=>labelOf(p.num));
 modal('Page labels',`<div class="hint" style="margin-bottom:8px">Labels name each page (for example A-101). They show on thumbnails, work in the page box, drive Batch Link and the drawing log, and are saved into the PDF.</div>
 <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" id="plTB" style="border:1px solid var(--line)">Read from title block…</button><button class="btn" id="plOrig" style="border:1px solid var(--line)">Use PDF's own labels</button><button class="btn" id="plClr" style="border:1px solid var(--line)">Clear (page numbers)</button></div>
 <div class="sec" style="margin-top:4px">Number a range</div><div class="row" style="gap:6px;flex-wrap:wrap"><input class="ti" id="plA" type="number" min="1" value="1" style="width:64px;flex:0 0 64px" title="From page"><input class="ti" id="plB" type="number" min="1" value="${S.pages.length}" style="width:64px;flex:0 0 64px" title="To page">
 <select class="ti" id="plS" style="flex:1"><option value="D">1, 2, 3</option><option value="R">I, II, III</option><option value="r">i, ii, iii</option><option value="A">A, B, C</option><option value="a">a, b, c</option><option value="">prefix only</option></select>
 <input class="ti" id="plP" placeholder="Prefix e.g. A-" style="width:90px;flex:0 0 90px"><input class="ti" id="plN" type="number" value="1" style="width:70px;flex:0 0 70px" title="Start number"><button class="btn" id="plGo" style="border:1px solid var(--line);flex:0">Apply</button></div>
 <div class="sec">Labels</div><div style="max-height:300px;overflow:auto">${cur.map((l,i)=>`<div class="row" style="gap:6px;margin-bottom:3px"><span style="flex:0 0 54px;color:var(--mut)">Page ${i+1}</span><input class="ti" data-pl="${i}" value="${esc(l)}"></div>`).join('')}</div>`,
 [{label:'Cancel',cancel:1},{label:'Save labels',pri:1,fn:md=>{const L=[...md.querySelectorAll('[data-pl]')].map(i=>i.value.trim()||String(+i.dataset.pl+1));saveLabels(L)}}]);
 $('#plGo').onclick=()=>{const a=clamp(+$('#plA').value||1,1,S.pages.length),b=clamp(+$('#plB').value||a,a,S.pages.length),st=$('#plS').value,pre=$('#plP').value,n0=+$('#plN').value||1;for(let i=a;i<=b;i++){const el=$(`[data-pl="${i-1}"]`);if(el)el.value=pre+fmtNumStyle(st,n0+i-a)}};
 $('#plOrig').onclick=async()=>{let l=null;try{l=await S.pdf.getPageLabels()}catch(e){}if(!l){toast('This PDF has no labels of its own');return}l.forEach((v,i)=>{const el=$(`[data-pl="${i}"]`);if(el)el.value=v})};
 $('#plClr').onclick=()=>$$('[data-pl]').forEach(el=>el.value=String(+el.dataset.pl+1));
 $('#plTB').onclick=async()=>{closeModal();try{const r=await pickTitleBlock();toast('Reading labels…');const L=[];let n=0;for(const p of S.pages){const s=await regionText(S.pdf,p.num,r);if(s)n++;L.push(s||labelOf(p.num))}saveLabels(L);toast(`Read ${n} of ${S.pages.length} labels — edit any in Page labels`)}catch(e){toast(e.message)}}}
function saveLabels(L){DP.labels=L;DP.custom=true;LS.set(lbKey(),{labels:L});showLabels();renderList();toast('Page labels saved')}
function drawingLog(){if(!S.pages.length)return;const rows=[['Page','Label','Width (in)','Height (in)','Sheet size','Rotation','Markups']];
 for(const p of S.pages){const w=p.w/72,h=p.h/72;rows.push([p.num,labelOf(p.num),w.toFixed(2),h.toFixed(2),sizeName(p.w,p.h),p.vp.rotation||0,S.markups.filter(m=>m.page===p.num).length])}
 const csv=rows.map(r=>r.map(c=>{c=String(c);return/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n');saveFile(baseName()+'-drawing-log.csv','﻿'+csv)}
const SIZES={Letter:[612,792],Legal:[612,1008],'Tabloid (ANSI B)':[792,1224],'ANSI C':[1224,1584],'ANSI D':[1584,2448],'ANSI E':[2448,3168],'ARCH A':[648,864],'ARCH B':[864,1296],'ARCH C':[1296,1728],'ARCH D':[1728,2592],'ARCH E1':[2160,3024],'ARCH E':[2592,3456]};
function sizeName(w,h){const a=Math.min(w,h),b=Math.max(w,h);for(const[k,[x,y]]of Object.entries(SIZES))if(Math.abs(a-x)<6&&Math.abs(b-y)<6)return k;return'Custom'}
// typing a label in the page box jumps to it
document.addEventListener('change',e=>{if(!e.target||e.target.id!=='pageIn')return;const v=e.target.value.trim();if(/^\d+$/.test(v)||!DP.labels)return;const i=DP.labels.findIndex(l=>l&&l.toLowerCase()===v.toLowerCase());e.stopImmediatePropagation();e.stopPropagation();if(i>=0)gotoPage(i+1);else{toast('No page labeled "'+v+'"');e.target.value=S.cur}},true);
const _bt=buildThumbs;buildThumbs=async function(){const r=_bt.apply(this,arguments);setTimeout(showLabels,0);setTimeout(showLabels,800);return r};
const _uc=updateCurUI;updateCurUI=function(){_uc.apply(this,arguments);const pi=$('#pageIn');if(pi&&hasLabel(S.cur))pi.title='Label: '+DP.labels[S.cur-1]};

/* =====================================================================================
   3. HYPERLINKS — PDF links, Hyperlink markups, Batch Link
   ===================================================================================== */
T.hlink={label:'Hyperlink',kind:'drag',box:1,closed:1};BASE_DEF.hlink={stroke:'#2563eb',width:1,opacity:1};S.defaults.hlink=Object.assign({},BASE_DEF.hlink,(LS.get('pm:defaults',{})||{}).hlink||{});
RIBBON[1][1].push('hlink');IC.hlink='<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>';KEYS.hlink='Shift+K';HINTS.hlink='Drag a box over the area that should be clickable, then choose where it goes';
const _prims=prims;prims=function(m){if(m.type==='hlink'){if(DP.exporting)return[];const b=normBox(m.pts[0],m.pts[1]);return[{k:'p',d:dBox(b),stroke:m.style.stroke||'#2563eb',w:m.style.width||1,so:.9,fill:'#3b82f6',fo:.07,dash:'dash'}]}return _prims.apply(this,arguments)};
const linkText=l=>!l?'(not set)':l.type==='url'?l.url:'Page '+l.page+(hasLabel(l.page)?' ('+DP.labels[l.page-1]+')':'');
function linkDialog(m,isNew){const l=m.link||{type:'page',page:Math.min(S.cur+1,S.pages.length)};
 modal('Hyperlink',`<div class="fld"><label class="chk"><input type="radio" name="lkT" value="page" ${l.type!=='url'?'checked':''}> Go to a page / sheet in this document</label>
 <select class="ti" id="lkP" style="margin-top:4px">${S.pages.map(p=>`<option value="${p.num}" ${l.page===p.num?'selected':''}>Page ${p.num}${hasLabel(p.num)?' — '+esc(DP.labels[p.num-1]):''}</option>`).join('')}</select></div>
 <div class="fld"><label class="chk"><input type="radio" name="lkT" value="url" ${l.type==='url'?'checked':''}> Open a web address</label><input class="ti" id="lkU" placeholder="https://…" value="${esc(l.url||'')}" style="margin-top:4px"></div>
 <div class="hint">Click a link to follow it. To select or move it instead, Shift+click it or drag a selection box around it.</div>`,
 [{label:isNew?'Discard':'Cancel',cancel:1,fn:()=>{if(isNew&&!m.link){S.markups=S.markups.filter(x=>x!==m);S.sel.delete(m.id);S.undo.pop();commit();renderProps()}}},
  {label:'OK',pri:1,fn:md=>{const t=md.querySelector('input[name=lkT]:checked').value;if(t==='url'){let u=md.querySelector('#lkU').value.trim();if(!u){toast('Enter a web address');return false}if(!/^[a-z]+:/i.test(u))u='https://'+u;m.link={type:'url',url:u}}else m.link={type:'page',page:+md.querySelector('#lkP').value};
   m.subject=m.subject==='Hyperlink'||!m.subject?'Hyperlink':m.subject;m.comment=m.comment||linkText(m.link);m.modified=Date.now();commit();renderProps()}}])}
const _ac=afterCreate;afterCreate=function(m){const r=_ac.apply(this,arguments);if(m.type==='hlink'){m.subject='Hyperlink';linkDialog(m,true)}return r};
H.props.push((m,mode,type)=>{if(mode!=='sel'||!m)return'';let h='';if(m.type==='hlink')h+=`<div class="sec">Link</div><div class="hint" style="margin-bottom:6px">→ ${esc(linkText(m.link))}</div><div class="row" style="gap:6px"><button class="btn" style="border:1px solid var(--line)" data-dp="editlink">Edit link…</button><button class="btn" style="border:1px solid var(--line)" data-dp="golink">Follow</button></div>`;
 if(m.locked)h+=`<div class="sec">Locked</div><div class="row"><button class="btn" style="border:1px solid var(--line)" data-dp="unlock">Unlock</button></div>`;return h});
$('#props').addEventListener('click',e=>{const b=e.target.closest('[data-dp]');if(!b)return;const m=byId([...S.sel][0]);if(!m)return;if(b.dataset.dp==='editlink')linkDialog(m,false);if(b.dataset.dp==='golink')followLink(m.link);if(b.dataset.dp==='unlock'){m.locked=false;commit();renderProps()}});
function openUrl(u){if(!/^(https?:|mailto:)/i.test(u)){toast('Link: '+u);return}if(window.pmDesktop){window.open(u,'_blank');return}
 const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();toast('Opening '+u)}
function followLink(l){if(!l)return;if(l.type==='url')return openUrl(l.url);if(l.page>=1&&l.page<=S.pages.length){gotoPage(l.page);if(l.rect){setTimeout(()=>scrollToBox(l.page,l.rect),350)}toast('→ '+linkText(l))}}
// existing link annotations in the PDF
async function loadLinks(n){if(DP.links[n])return DP.links[n];DP.links[n]=[];try{const doc=S.pdf,pg=await doc.getPage(n),an=await pg.getAnnotations({intent:'display'}),vp=S.pages[n-1].vp,out=[];
  for(const a of an){if(a.subtype!=='Link')continue;const q=vp.convertToViewportRectangle(a.rect),r=normBox([q[0],q[1]],[q[2],q[3]]);let l=null;
   if(a.url||a.unsafeUrl)l={type:'url',url:a.url||a.unsafeUrl};else if(a.dest){try{let d=a.dest;if(typeof d==='string')d=await doc.getDestination(d);if(d){const i=typeof d[0]==='number'?d[0]:await doc.getPageIndex(d[0]);l={type:'page',page:i+1}}}catch(e){}}
   if(l)out.push({r,l})}
  if(doc===S.pdf){DP.links[n]=out;if(out.length)redrawPage(n)}}catch(e){}return DP.links[n]}
H.over.push(n=>{if(!DP.links[n]&&S.pdf){loadLinks(n)}const hv=DP.hoverLink;if(!hv||hv.page!==n)return'';const b=hv.r;return`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="rgba(37,99,235,.10)" stroke="#2563eb" stroke-width="${1/S.zoom}" pointer-events="none"/>`});
const picking=()=>S.align||/click the (first|opposite) corner|Auto-label|Align overlay/.test(($('#hint')||{}).textContent||'');
function pdfLinkAt(p,pt){for(const k of DP.links[p.num]||[])if(pt[0]>=k.r[0]&&pt[0]<=k.r[2]&&pt[1]>=k.r[1]&&pt[1]<=k.r[3])return k;return null}
H.down=(prev=>(e,p,pt)=>{
 if(p&&(S.tool==='select'||S.tool==='pan')&&!picking()){const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);
  if(m&&m.locked&&S.tool==='select'&&!e.shiftKey){setSel([m.id]);return true}
  if(m&&m.type==='hlink'&&!(e.shiftKey||e.ctrlKey||e.metaKey))DP.pending={l:m.link,x:e.clientX,y:e.clientY};
  else if(!m){const k=pdfLinkAt(p,pt);if(k)DP.pending={l:k.l,x:e.clientX,y:e.clientY}}}
 return prev?prev(e,p,pt):false})(H.down);
window.addEventListener('pointerup',e=>{const pd=DP.pending;DP.pending=null;if(pd&&Math.hypot(e.clientX-pd.x,e.clientY-pd.y)<5)setTimeout(()=>followLink(pd.l),0)});
viewer.addEventListener('pointermove',e=>{if(!S.pages.length||(S.tool!=='select'&&S.tool!=='pan')||e.buttons)return;const p=pageFromEvent(e);let k=null,label='';
 if(p){const mk=e.target.closest&&e.target.closest('.mk'),m=mk&&byId(mk.dataset.id);if(m&&m.type==='hlink'){label=linkText(m.link)}else if(!mk){const q=toPt(e,p);k=pdfLinkAt(p,q);if(k){k=Object.assign({page:p.num},k);label=linkText(k.l)}}}
 const before=DP.hoverLink;if((before&&before.r)!==(k&&k.r)){DP.hoverLink=k;if(before)redrawPage(before.page);if(k)redrawPage(k.page)}
 viewer.style.cursor=label?'pointer':'';if(label)$('#hint').textContent='Link → '+label+'  (Shift+click to select)';else if(/^Link →/.test($('#hint').textContent))$('#hint').textContent=HINTS[S.tool]||''});
async function batchLink(){if(!S.pages.length)return toast('Open a PDF first');const useLabels=!!(DP.labels&&DP.labels.some((l,i)=>l&&l!==String(i+1)));
 modal('Batch Link',`<div class="hint" style="margin-bottom:8px">Finds every reference to another sheet (like "SEE A-201") and turns it into a link to that sheet.</div>
 <div class="fld"><label>Sheet numbers come from</label><select class="ti" id="blS">${useLabels?'<option value="labels">Page labels</option>':''}<option value="region">The title block (you'll box the sheet number)</option></select></div>
 <label class="chk fld"><input type="checkbox" id="blR" checked> Replace links made by an earlier Batch Link</label>`,
 [{label:'Cancel',cancel:1},{label:'Create links',pri:1,fn:md=>{const src=md.querySelector('#blS').value,rep=md.querySelector('#blR').checked;setTimeout(()=>runBatchLink(src,rep),0)}}])}
async function runBatchLink(src,rep){try{let L;if(src==='labels')L=S.pages.map(p=>labelOf(p.num));else{const r=await pickTitleBlock('Batch Link: box the sheet number in the title block');toast('Reading sheet numbers…');L=[];for(const p of S.pages)L.push(await regionText(S.pdf,p.num,r))}
 const targets=L.map((l,i)=>({label:(l||'').trim(),page:i+1})).filter(t=>t.label.length>=2&&!/^\d{1,3}$/.test(t.label));if(!targets.length){toast('No sheet numbers found');return}
 const made=[];const isWord=c=>c&&/[A-Za-z0-9]/.test(c);
 // with sheet numbers known, use the live sheet-reference finder (it also matches A-101 written as A101, and detail bubbles)
 if(src==='labels'&&window.PMSheetLinks){PMSheetLinks.SL.refs={};for(const p of S.pages)for(const r of await PMSheetLinks.refsOf(p.num)){const m=newMarkup('hlink',p.num,[[r.r[0],r.r[1]],[r.r[2],r.r[3]]],S.defaults.hlink);m.subject='Batch Link';m.link={type:'page',page:r.page};m.comment='→ '+r.label+(r.det?' · detail '+r.det:'');made.push(m)}}
 else for(const p of S.pages){const{items,vp}=await pageText(p.num);
  for(const it of items){const s=it.str||'';if(!s)continue;const up=s.toUpperCase();
   for(const t of targets){if(t.page===p.num)continue;const q=t.label.toUpperCase();let idx=up.indexOf(q);
    while(idx>=0){if(!isWord(up[idx-1])&&!isWord(up[idx+q.length])){let r;const n=s.length||1;
      if(it.vb){const w=it.vb[2]-it.vb[0];r=[it.vb[0]+w*idx/n,it.vb[1],it.vb[0]+w*(idx+q.length)/n,it.vb[3]]}
      else{const c=vp.convertToViewportRectangle([it.x+it.w*idx/n,it.y-it.h*.2,it.x+it.w*(idx+q.length)/n,it.y+it.h*.85]);r=normBox([c[0],c[1]],[c[2],c[3]])}
      const m=newMarkup('hlink',p.num,[[r[0]-1,r[1]-1],[r[2]+1,r[3]+1]],S.defaults.hlink);m.subject='Batch Link';m.link={type:'page',page:t.page};m.comment='→ '+t.label;made.push(m)}
     idx=up.indexOf(q,idx+1)}}}}
 pushUndo();if(rep)S.markups=S.markups.filter(m=>!(m.type==='hlink'&&m.subject==='Batch Link'));S.markups.push(...made);commit();toast(`Batch Link: ${made.length} link${made.length===1?'':'s'} created across ${new Set(made.map(m=>m.page)).size} page(s)`)}
 catch(e){console.error(e);toast('Batch Link failed: '+(e.message||e))}}

/* =====================================================================================
   4. BOOKMARKS & TABLE OF CONTENTS
   ===================================================================================== */
async function resolveOutline(doc){let ol=null;try{ol=await doc.getOutline()}catch(e){}if(!ol)return null;
 const rec=async items=>{const out=[];for(const it of items){let page=null;try{let d=it.dest;if(typeof d==='string')d=await doc.getDestination(d);if(d)page=(typeof d[0]==='number'?d[0]:await doc.getPageIndex(d[0]))+1}catch(e){}
  out.push({title:it.title||'',page,url:it.url||null,items:it.items&&it.items.length?await rec(it.items):[]})}return out};return rec(ol)}
const userBM=()=>LS.get(bmKey(),[])||[];const setBM=b=>{LS.set(bmKey(),b);injectBM(true)};
function injectBM(force){const pane=$('#pane-bookmarks');if(!pane||!S.pdf)return;if(!force&&pane.querySelector('[data-dpbm]'))return;
 pane.querySelectorAll('[data-ub],[data-dpbmrow],[data-dpbm]').forEach(e=>e.remove());[...pane.querySelectorAll('.sec')].filter(s=>s.textContent==='My bookmarks').forEach(s=>s.remove());
 const bm=userBM();const box=document.createElement('div');box.setAttribute('data-dpbm','1');
 box.innerHTML=`<div class="row" style="gap:6px;flex-wrap:wrap;margin:-2px 0 8px"><button class="btn" data-bma="labels" style="border:1px solid var(--line)">From page labels</button><button class="btn" data-bma="toc" style="border:1px solid var(--line)">Insert contents page</button></div>`+
  (bm.length?`<div class="sec">My bookmarks</div>`+bm.map((b,i)=>`<div class="res" data-dpbmrow="${i}" style="display:flex;gap:6px;align-items:center"><span data-bgo="${i}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(b.title)} <small style="color:var(--mut)">p${b.page}${hasLabel(b.page)?' · '+esc(DP.labels[b.page-1]):''}</small></span><span data-bren="${i}" title="Rename" style="opacity:.7">✎</span><span data-bup="${i}" title="Move up" style="opacity:.7">↑</span><span data-bdn="${i}" title="Move down" style="opacity:.7">↓</span><span data-bdel="${i}" title="Delete" style="opacity:.7">✕</span></div>`).join(''):'');
 const first=pane.firstElementChild;if(first&&first.nextSibling)pane.insertBefore(box,first.nextSibling);else pane.appendChild(box);
 const add=$('#bmAdd');if(add)add.onclick=()=>modalPrompt('Add bookmark','Name',hasLabel(S.cur)?DP.labels[S.cur-1]:'Page '+S.cur,t=>{const b=userBM();b.push({title:t,page:S.cur});setBM(b)})}
H.ready.push(()=>{const pane=$('#pane-bookmarks');if(!pane)return;new MutationObserver(()=>{if(!pane.querySelector('[data-dpbm]'))injectBM()}).observe(pane,{childList:true});
 pane.addEventListener('click',e=>{const g=k=>{const el=e.target.closest('['+k+']');return el?+el.getAttribute(k):null};let i;const bm=userBM();
  if((i=g('data-bgo'))!=null&&bm[i]){gotoPage(bm[i].page);return}
  if((i=g('data-bren'))!=null&&bm[i])return modalPrompt('Rename bookmark','Name',bm[i].title,t=>{bm[i].title=t;setBM(bm)});
  if((i=g('data-bup'))!=null&&i>0){[bm[i-1],bm[i]]=[bm[i],bm[i-1]];setBM(bm);return}
  if((i=g('data-bdn'))!=null&&i<bm.length-1){[bm[i+1],bm[i]]=[bm[i],bm[i+1]];setBM(bm);return}
  if((i=g('data-bdel'))!=null){bm.splice(i,1);setBM(bm);return}
  const a=e.target.closest('[data-bma]');if(a&&a.dataset.bma==='labels')bmFromLabels();if(a&&a.dataset.bma==='toc')tocDialog()})});
function bmFromLabels(){if(!S.pages.length)return;const bm=userBM(),have=new Set(bm.map(b=>b.page));let n=0;for(const p of S.pages){if(have.has(p.num))continue;bm.push({title:labelOf(p.num)+(hasLabel(p.num)?'':''),page:p.num});n++}
 bm.sort((a,b)=>a.page-b.page);setBM(bm);toast(`Added ${n} bookmark${n===1?'':'s'} from page labels`)}
function tocEntries(){const bm=userBM();if(bm.length)return bm.map(b=>({title:b.title,page:b.page}));if(DP.outline&&DP.outline.length){const out=[];const rec=(it,d)=>it.forEach(x=>{if(x.page)out.push({title:'  '.repeat(d)+x.title,page:x.page});rec(x.items||[],d+1)});rec(DP.outline,0);return out}
 return S.pages.map(p=>({title:labelOf(p.num),page:p.num}))}
function tocDialog(){if(!S.pages.length)return;const e=tocEntries();
 modal('Insert contents page',`<div class="hint" style="margin-bottom:8px">Adds a sheet index at the front of the document listing ${e.length} entr${e.length===1?'y':'ies'} (from ${userBM().length?'your bookmarks':DP.outline&&DP.outline.length?'the PDF bookmarks':'the page labels'}), each linked to its page.</div><div class="fld"><label>Title</label><input class="ti" id="tcT" value="SHEET INDEX"></div>`,
 [{label:'Cancel',cancel:1},{label:'Insert',pri:1,fn:md=>{const title=md.querySelector('#tcT').value.trim()||'CONTENTS';setTimeout(()=>insertTOC(title,e),0)}}])}
async function insertTOC(title,entries){const p1=S.pages[0],W=Math.max(612,Math.round(p1.w)),Hh=Math.max(792,Math.round(p1.h)),fs=Math.max(11,Math.round(Hh/60)),lh=fs*1.6,top=Hh-72-fs*3,per=Math.max(5,Math.floor((top-72)/lh)),nP=Math.ceil(entries.length/per)||1;
 await PMBatch.rebuild(async doc=>{const{StandardFonts,rgb,PDFName,PDFHexString}=PL();const f=await doc.embedFont(StandardFonts.Helvetica),fb=await doc.embedFont(StandardFonts.HelveticaBold),n0=doc.getPageCount(),tps=[];
  for(let k=0;k<nP;k++)tps.push(doc.insertPage(k,[W,Hh]));
  entries.forEach((en,i)=>{const pg=tps[Math.floor(i/per)],row=i%per,y=top-row*lh,np=en.page+nP,t=safeTxt(en.title).slice(0,90),num=String(np);
   pg.drawText(t,{x:72,y,size:fs,font:f,color:rgb(.1,.1,.1)});const nw=f.widthOfTextAtSize(num,fs),tw_=f.widthOfTextAtSize(t,fs);
   for(let x=72+tw_+6;x<W-72-nw-6;x+=fs*.5)pg.drawText('.',{x,y,size:fs,font:f,color:rgb(.6,.6,.6)});pg.drawText(num,{x:W-72-nw,y,size:fs,font:f});
   const target=doc.getPage(np-1);const ann=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[70,y-fs*.3,W-70,y+fs],Border:[0,0,0],Dest:[target.ref,'Fit']});const ar=doc.context.register(ann);
   const ex=pg.node.lookup(PDFName.of('Annots'));if(ex)ex.push(ar);else pg.node.set(PDFName.of('Annots'),doc.context.obj([ar]))});
  tps.forEach((pg,k)=>{pg.drawText(safeTxt(title)+(nP>1?` (${k+1}/${nP})`:''),{x:72,y:Hh-72-fs,size:fs*1.8,font:fb})});
  return Array.from({length:n0},(_,i)=>i+nP)},'Inserting contents page');
 const bm=userBM();bm.unshift({title:'Contents',page:1});setBM(bm)}
H.exportPage.push(async(doc,pages)=>{const{PDFName,PDFHexString,PDFString}=PL();const ctx=doc.context;
 // outline = the PDF's own bookmarks + yours
 const own=DP.outline||[],mine=userBM().filter(b=>b.page>=1&&b.page<=pages.length).map(b=>({title:b.title,page:b.page,items:[]}));
 if(mine.length){const all=[...own,...mine];const build=(items,parent)=>{const refs=items.map(()=>ctx.nextRef());items.forEach((it,i)=>{const d={Title:PDFHexString.fromText(it.title||'Untitled'),Parent:parent};if(i>0)d.Prev=refs[i-1];if(i<items.length-1)d.Next=refs[i+1];
   if(it.page&&pages[it.page-1])d.Dest=[pages[it.page-1].ref,'Fit'];else if(it.url)d.A={S:'URI',URI:PDFString.of(it.url)};if(it.items&&it.items.length){const k=build(it.items,refs[i]);d.First=k[0];d.Last=k[k.length-1];d.Count=k.length}ctx.assign(refs[i],ctx.obj(d))});return refs};
  const root=ctx.nextRef(),kids=build(all,root);ctx.assign(root,ctx.obj({Type:'Outlines',First:kids[0],Last:kids[kids.length-1],Count:kids.length}));doc.catalog.set(PDFName.of('Outlines'),root);doc.catalog.set(PDFName.of('PageMode'),PDFName.of('UseOutlines'))}
 // page labels
 if(DP.custom&&DP.labels&&DP.labels.length===pages.length){const nums=[];DP.labels.forEach((l,i)=>{nums.push(i,{P:PDFHexString.fromText(l||String(i+1))})});doc.catalog.set(PDFName.of('PageLabels'),ctx.obj({Nums:nums}))}
 // hyperlinks → real link annotations
 for(const m of S.markups){if(m.type!=='hlink'||!m.link)continue;const page=pages[m.page-1],vp=S.pages[m.page-1]&&S.pages[m.page-1].vp;if(!page||!vp)continue;const b=normBox(m.pts[0],m.pts[1]);
  const a=vp.convertToPdfPoint(b[0],b[1]),c=vp.convertToPdfPoint(b[2],b[3]);const rect=[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[0],c[0]),Math.max(a[1],c[1])];let d;
  if(m.link.type==='url')d={Type:'Annot',Subtype:'Link',Rect:rect,Border:[0,0,0],A:{S:'URI',URI:PDFString.of(m.link.url)}};else if(pages[m.link.page-1])d={Type:'Annot',Subtype:'Link',Rect:rect,Border:[0,0,0],Dest:[pages[m.link.page-1].ref,'Fit']};else continue;
  const ar=ctx.register(ctx.obj(d)),ex=page.node.lookup(PDFName.of('Annots'));if(ex&&ex.push)ex.push(ar);else page.node.set(PDFName.of('Annots'),ctx.obj([ar]))}
 // attachments added / removed
 for(const a of DP.attAdd)await doc.attach(a.bytes,a.name,{description:a.desc||'Added in PlanMark'});
 const meta={bookmarks:userBM(),labels:DP.custom?DP.labels:null};if(meta.bookmarks.length||meta.labels)await doc.attach(new TextEncoder().encode(JSON.stringify(meta)),'planmark-docpro.json',{mimeType:'application/json',description:'PlanMark bookmarks and page labels'});
 if(DP.attRemove.size){try{const names=doc.catalog.lookup(PDFName.of('Names'));const ef=names&&names.lookup(PDFName.of('EmbeddedFiles'));const prune=node=>{const arr=node.lookup(PDFName.of('Names'));if(arr){const keep=[];for(let i=0;i+1<arr.size();i+=2){const k=arr.lookup(i);const nm=k&&k.decodeText?k.decodeText():'';if(!DP.attRemove.has(nm))keep.push(arr.get(i),arr.get(i+1))}node.set(PDFName.of('Names'),ctx.obj(keep))}const kids=node.lookup(PDFName.of('Kids'));if(kids)for(let i=0;i<kids.size();i++)prune(kids.lookup(i))};if(ef)prune(ef)}catch(e){console.warn('att remove',e)}}});
const _exp=exportPDF;exportPDF=async function(){DP.exporting=true;try{return await _exp.apply(this,arguments)}finally{DP.exporting=false}};

/* =====================================================================================
   5. HEADERS, FOOTERS & BATES
   ===================================================================================== */
function hfDialog(){if(!S.pages.length)return toast('Open a PDF first');const sv=LS.get('pm:hf',{});const P=['tl','tc','tr','bl','bc','br'],NM={tl:'Top left',tc:'Top center',tr:'Top right',bl:'Bottom left',bc:'Bottom center',br:'Bottom right'};
 modal('Headers, footers & Bates',`<div class="hint" style="margin-bottom:8px">Tokens: <kbd>{page}</kbd> <kbd>{pages}</kbd> <kbd>{label}</kbd> <kbd>{date}</kbd> <kbd>{file}</kbd> <kbd>{bates}</kbd></div>
 <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">${P.map(k=>`<div><label style="font-size:11px;color:var(--mut)">${NM[k]}</label><input class="ti" data-hf="${k}" value="${esc(sv[k]||(k==='br'?'Page {page} of {pages}':''))}"></div>`).join('')}</div>
 <div class="row fld" style="margin-top:8px"><div><label style="font-size:11px;color:var(--mut)">Font size</label><input class="ti" type="number" id="hfS" value="${sv.size||9}"></div><div><label style="font-size:11px;color:var(--mut)">Color</label><input type="color" id="hfC" value="${sv.color||'#111111'}"></div><div><label style="font-size:11px;color:var(--mut)">Margin (in)</label><input class="ti" type="number" step="any" id="hfM" value="${sv.margin??0.4}"></div></div>
 <div class="sec">Bates numbering</div><div class="row fld"><input class="ti" id="hfBP" placeholder="Prefix" value="${esc(sv.bp||'')}"><input class="ti" type="number" id="hfBS" title="Start" value="${sv.bs||1}"><input class="ti" type="number" id="hfBD" title="Digits" value="${sv.bd||6}"><input class="ti" id="hfBX" placeholder="Suffix" value="${esc(sv.bx||'')}"></div>
 <div class="fld"><label>Pages</label><input class="ti" id="hfR" placeholder="all, or e.g. 2-10" value="all"></div><label class="chk fld"><input type="checkbox" id="hfX" checked> Replace headers/footers added earlier</label>`,
 [{label:'Cancel',cancel:1},{label:'Apply',pri:1,fn:md=>{const o={size:+md.querySelector('#hfS').value||9,color:md.querySelector('#hfC').value,margin:+md.querySelector('#hfM').value||0,bp:md.querySelector('#hfBP').value,bs:+md.querySelector('#hfBS').value||1,bd:+md.querySelector('#hfBD').value||6,bx:md.querySelector('#hfBX').value};
  P.forEach(k=>o[k]=md.querySelector(`[data-hf="${k}"]`).value);LS.set('pm:hf',o);const rv=md.querySelector('#hfR').value.trim().toLowerCase();const pages=!rv||rv==='all'?S.pages.map(p=>p.num):parseRange(rv);applyHF(o,pages,md.querySelector('#hfX').checked)}}])}
function applyHF(o,pages,replace){pushUndo();if(replace)S.markups=S.markups.filter(m=>!(m.subject==='Header/Footer'||m.subject==='Bates'));const date=new Date().toLocaleDateString();let made=0;
 pages.forEach((n,idx)=>{const p=S.pages[n-1];if(!p)return;const bates=o.bp+String(o.bs+idx).padStart(o.bd,'0')+o.bx;
  for(const k of['tl','tc','tr','bl','bc','br']){const raw=o[k];if(!raw||!raw.trim())continue;const txt=raw.replace(/\{page\}/g,n).replace(/\{pages\}/g,S.pages.length).replace(/\{label\}/g,labelOf(n)).replace(/\{date\}/g,date).replace(/\{file\}/g,S.fileName).replace(/\{bates\}/g,bates);
   const st=Object.assign({},S.defaults.typewriter,{color:o.color,stroke:o.color,fontSize:o.size,width:0});const w=tw(txt,o.size),mg=o.margin*72,x=k[1]==='l'?mg:k[1]==='c'?(p.w-w)/2:p.w-mg-w,y=k[0]==='t'?mg:p.h-mg-o.size*1.2;
   const m=newMarkup('typewriter',n,[[x,y]],st);m.text=txt;m.subject=/\{bates\}/.test(raw)?'Bates':'Header/Footer';m.locked=true;S.markups.push(m);made++}});
 commit();toast(`Added ${made} header/footer item${made===1?'':'s'} — they print with the PDF when you save`)}
function removeHF(){const n=S.markups.filter(m=>m.subject==='Header/Footer'||m.subject==='Bates').length;if(!n)return toast('No headers or footers to remove');pushUndo();S.markups=S.markups.filter(m=>!(m.subject==='Header/Footer'||m.subject==='Bates'));commit();toast(`Removed ${n}`)}

/* =====================================================================================
   6. PAGE TOOLS — crop, insert blank, replace, slip sheet, resize
   ===================================================================================== */
// keep bookmarks and labels attached to the right pages whenever a page operation rebuilds the document
if(window.PMBatch){const _rb=PMBatch.rebuild;PMBatch.rebuild=async function(op,label){const oldKey=S.fileKey,bm=LS.get('pm:bm:'+oldKey,null),pl=DP.labels&&DP.labels.some((l,i)=>l&&l!==String(i+1))?DP.labels.slice():null;let map=null;
 const r=await _rb.call(this,async doc=>{map=await op(doc);if(map)try{gc(doc)}catch(e){console.warn('gc',e)}return map},label);
 if(map&&S.fileKey!==oldKey){if(bm&&bm.length)LS.set(bmKey(),bm.map(b=>Object.assign({},b,{page:(map[b.page-1]??-2)+1})).filter(b=>b.page>0));
  if(pl){const nl=new Array(S.pages.length).fill(null);pl.forEach((l,i)=>{const ni=map[i];if(ni>=0&&ni<nl.length)nl[ni]=l});for(let i=0;i<nl.length;i++)if(nl[i]==null)nl[i]=String(i+1);LS.set(lbKey(),{labels:nl})}
  await loadLabels();injectBM(true)}return r}}
const ident=n=>Array.from({length:n},(_,i)=>i);
// drop objects nothing points to any more (old pages' images and fonts) so page operations don't bloat the file
function gc(doc){const{PDFRef,PDFDict,PDFArray}=PL();const ctx=doc.context,seen=new Set(),stack=[];
 const push=o=>{if(o)stack.push(o)};push(ctx.trailerInfo.Root);push(ctx.trailerInfo.Info);
 while(stack.length){const o=stack.pop();if(o instanceof PDFRef){const k=o.tag||o.toString();if(seen.has(k))continue;seen.add(k);push(ctx.lookup(o));continue}
  if(o instanceof PDFDict){for(const[,v]of o.entries())push(v)}else if(o instanceof PDFArray){for(let i=0;i<o.size();i++)push(o.get(i))}else if(o&&o.dict instanceof PDFDict)push(o.dict)}
 let n=0;for(const[ref]of ctx.enumerateIndirectObjects()){if(!seen.has(ref.tag||ref.toString())){ctx.delete(ref);n++}}return n}
async function cropDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Crop pages',`<div class="hint" style="margin-bottom:8px">You'll draw the area to keep on page ${S.cur}; the same area is kept on every page in the range. Markups stay where they are.</div><div class="fld"><label>Pages</label><input class="ti" id="crR" value="${S.cur}" placeholder="all, or e.g. 1-5"></div><label class="chk"><input type="checkbox" id="crU"> Remove crop (show whole pages)</label>`,
 [{label:'Cancel',cancel:1},{label:'Next',pri:1,fn:md=>{const v=md.querySelector('#crR').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v),un=md.querySelector('#crU').checked;if(!pages.length){toast('Enter pages');return false}setTimeout(()=>runCrop(pages,un),0)}}])}
async function runCrop(pages,un){let box=null,src=S.cur;if(!un){const r=await PMAuto.pickRegion('Crop: draw the area to keep');box=r.box;src=r.page;if(box[2]-box[0]<20||box[3]-box[1]<20)return toast('That area is too small')}
 const rects={};for(const n of pages){const p=S.pages[n-1];if(!p)continue;if(un){rects[n]=null;continue}const sp=S.pages[src-1],nb=[box[0]/sp.w*p.w,box[1]/sp.h*p.h,box[2]/sp.w*p.w,box[3]/sp.h*p.h];
  const a=p.vp.convertToPdfPoint(nb[0],nb[1]),c=p.vp.convertToPdfPoint(nb[2],nb[3]);rects[n]=[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.abs(c[0]-a[0]),Math.abs(c[1]-a[1])]}
 await PMBatch.rebuild(doc=>{for(const n in rects){const pg=doc.getPage(n-1),r=rects[n];if(r)pg.setCropBox(r[0],r[1],r[2],r[3]);else{const mb=pg.getMediaBox();pg.setCropBox(mb.x,mb.y,mb.width,mb.height)}}return ident(doc.getPageCount())},un?'Removing crop':'Cropping pages')}
function sizeOpts(sel){return Object.keys(SIZES).map(k=>`<option ${k===sel?'selected':''}>${k}</option>`).join('')+'<option value="match">Same as current page</option>'}
function blankDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Insert blank page',`<div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Size</label><select class="ti" id="bkS">${sizeOpts('Letter')}</select></div><div><label style="font-size:11px;color:var(--mut)">Orientation</label><select class="ti" id="bkO"><option value="p">Portrait</option><option value="l">Landscape</option></select></div></div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Insert after page (0 = start)</label><input class="ti" type="number" id="bkA" min="0" max="${S.pages.length}" value="${S.cur}"></div><div><label style="font-size:11px;color:var(--mut)">How many</label><input class="ti" type="number" id="bkN" min="1" value="1"></div></div>`,
 [{label:'Cancel',cancel:1},{label:'Insert',pri:1,fn:md=>{let s=md.querySelector('#bkS').value,o=md.querySelector('#bkO').value,after=clamp(+md.querySelector('#bkA').value||0,0,S.pages.length),cnt=clamp(+md.querySelector('#bkN').value||1,1,100);
  let[w,h]=s==='match'?[S.pages[S.cur-1].w,S.pages[S.cur-1].h]:SIZES[s];if(s!=='match'){if(o==='l'&&w<h)[w,h]=[h,w];if(o==='p'&&w>h)[w,h]=[h,w]}
  PMBatch.rebuild(doc=>{const n=doc.getPageCount();for(let k=0;k<cnt;k++)doc.insertPage(after+k,[w,h]);return ident(n).map(i=>i<after?i:i+cnt)},'Inserting blank page'+(cnt>1?'s':''))}}])}
async function pickPdf(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='application/pdf,.pdf';i.onchange=async()=>{const f=i.files[0];res(f?{name:f.name,bytes:new Uint8Array(await f.arrayBuffer())}:null)};i.click()})}
async function plainBytes(f){if(!isEncrypted(f.bytes))return f.bytes;const r=await unlock(f.bytes,f.name);if(!r||r.fallback)throw new Error("Couldn't unlock "+f.name);return r.bytes}
function replaceDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Replace pages',`<div class="hint" style="margin-bottom:8px">Swap pages for pages from another PDF (for example a revised sheet). Markups on the replaced pages are kept.</div>
 <div class="fld"><label>Replace pages of this document</label><input class="ti" id="rpR" value="${S.cur}" placeholder="e.g. 3 or 3-5"></div><div class="fld"><label>With pages of the other PDF, starting at</label><input class="ti" type="number" id="rpS" min="1" value="1"></div>`,
 [{label:'Cancel',cancel:1},{label:'Choose PDF…',pri:1,fn:md=>{const tg=parseRange(md.querySelector('#rpR').value),st=Math.max(1,+md.querySelector('#rpS').value||1);if(!tg.length){toast('Enter pages to replace');return false}
  setTimeout(async()=>{const f=await pickPdf();if(!f)return;try{const src=await plainBytes(f);await PMBatch.rebuild(async doc=>{const other=await PL().PDFDocument.load(src,{ignoreEncryption:true}),idx=tg.map((t,k)=>st-1+k).filter(i=>i<other.getPageCount());if(idx.length<tg.length)toast(`The other PDF only had ${idx.length} matching page(s)`);
   const cp=await doc.copyPages(other,idx);cp.forEach((pg,k)=>{const at=tg[k]-1;doc.removePage(at);doc.insertPage(at,pg)});return ident(doc.getPageCount())},'Replacing pages')}catch(e){toast(e.message)}},0)}}])}
async function slipDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Slip sheet a revision',`<div class="hint" style="margin-bottom:8px">Choose the new revision PDF, then box the sheet number in this document's title block. Sheets are matched by number; each matched page is replaced with the new one and keeps your markups.</div>
 <label class="chk fld"><input type="checkbox" id="slA" checked> Add new sheets that don't match any existing sheet to the end</label><label class="chk fld"><input type="checkbox" id="slD" checked> Download the replaced sheets stamped SUPERSEDED</label>`,
 [{label:'Cancel',cancel:1},{label:'Choose new revision…',pri:1,fn:md=>{const add=md.querySelector('#slA').checked,dl=md.querySelector('#slD').checked;setTimeout(async()=>{const f=await pickPdf();if(f)runSlip(f,add,dl)},0)}}])}
async function runSlip(f,addNew,dl){try{const nb=await plainBytes(f);const r=await pickTitleBlock('Slip sheet: box the sheet number in the title block');toast('Matching sheets…');
 const norm=s=>(s||'').toUpperCase().replace(/\s+/g,'');const nd=await pdfjsLib.getDocument({data:nb.slice(),isEvalSupported:false}).promise;const newL=[];for(let i=1;i<=nd.numPages;i++)newL.push(norm(await regionText(nd,i,r)));nd.destroy();
 const oldL=[];for(const p of S.pages)oldL.push(norm(await regionText(S.pdf,p.num,r)));
 const match=[],usedNew=new Set();oldL.forEach((l,i)=>{if(!l)return;const j=newL.findIndex((x,k)=>x===l&&!usedNew.has(k));if(j>=0){match.push([i,j]);usedNew.add(j)}});
 const unNew=newL.map((l,j)=>j).filter(j=>!usedNew.has(j)),unOld=oldL.map((l,i)=>i).filter(i=>!match.some(m=>m[0]===i));
 if(!match.length&&!(addNew&&unNew.length)){toast('No sheet numbers matched — check the box you drew');return}
 let sup=null;if(dl&&match.length){const{PDFDocument,StandardFonts,rgb,degrees}=PL();const src=await PDFDocument.load(S.bytes,{ignoreEncryption:true}),out=await PDFDocument.create(),fb=await out.embedFont(StandardFonts.HelveticaBold);
  for(const pg of await out.copyPages(src,match.map(m=>m[0]))){out.addPage(pg);const{width:w,height:h}=pg.getSize(),s=Math.min(w,h)/7;pg.drawText('SUPERSEDED',{x:w*.15,y:h*.3,size:s,font:fb,color:rgb(.85,.1,.1),opacity:.35,rotate:degrees(Math.atan2(h,w)*180/Math.PI)});pg.drawText('Superseded '+new Date().toLocaleDateString()+' by '+safeTxt(f.name),{x:36,y:36,size:Math.max(10,s/6),font:fb,color:rgb(.85,.1,.1)})}
  sup=new Blob([await out.save()],{type:'application/pdf'})}
 await PMBatch.rebuild(async doc=>{const other=await PL().PDFDocument.load(nb,{ignoreEncryption:true}),n0=doc.getPageCount();const cp=await doc.copyPages(other,match.map(m=>m[1]));cp.forEach((pg,k)=>{const at=match[k][0];doc.removePage(at);doc.insertPage(at,pg)});
  if(addNew&&unNew.length)for(const pg of await doc.copyPages(other,unNew))doc.addPage(pg);return ident(n0)},'Slip sheeting');
 if(sup)await saveFile(baseName()+'-superseded.pdf',sup);
 modal('Slip sheet complete',`<div class="hint"><b style="color:var(--text)">${match.length}</b> sheet${match.length===1?'':'s'} replaced: ${esc(match.map(m=>oldL[m[0]]).join(', '))}${addNew&&unNew.length?`<br><b style="color:var(--text)">${unNew.length}</b> new sheet(s) added at the end: ${esc(unNew.map(j=>newL[j]||'(no number) p'+(j+1)).join(', '))}`:''}${!addNew&&unNew.length?`<br>${unNew.length} new sheet(s) not used: ${esc(unNew.map(j=>newL[j]||'p'+(j+1)).join(', '))}`:''}${unOld.length?`<br>${unOld.length} existing sheet(s) had no new version: ${esc(unOld.map(i=>oldL[i]||'p'+(i+1)).join(', '))}`:''}</div>`,[{label:'OK',cancel:1}])}
 catch(e){console.error(e);toast('Slip sheet failed: '+(e.message||e))}}
function resizeDialog(){if(!S.pages.length)return toast('Open a PDF first');
 modal('Resize pages',`<div class="hint" style="margin-bottom:8px">Changes the paper size and scales each page's content to fit, centered. Markups move and scale with the drawing, and page scales are adjusted so measurements stay correct. Link annotations on resized pages are dropped.</div>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">New size</label><select class="ti" id="rzS">${sizeOpts('ARCH D')}</select></div><div><label style="font-size:11px;color:var(--mut)">Orientation</label><select class="ti" id="rzO"><option value="auto">Match each page</option><option value="p">Portrait</option><option value="l">Landscape</option></select></div></div>
 <div class="fld"><label>Pages</label><input class="ti" id="rzR" value="all"></div>`,
 [{label:'Cancel',cancel:1},{label:'Resize',pri:1,fn:md=>{const s=md.querySelector('#rzS').value,o=md.querySelector('#rzO').value,v=md.querySelector('#rzR').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v);if(!pages.length||s==='match'){toast('Pick a size and pages');return false}setTimeout(()=>runResize(pages,SIZES[s],o),0)}}])}
async function runResize(pages,size,orient){const plan={};for(const n of pages){const p=S.pages[n-1];let[w,h]=size;const land=orient==='l'||(orient==='auto'&&p.w>p.h);if(land&&w<h)[w,h]=[h,w];if(!land&&w>h)[w,h]=[h,w];const s=Math.min(w/p.w,h/p.h);plan[n]={W:w,H:h,s,ox:(w-p.w*s)/2,oy:(h-p.h*s)/2,rot:p.vp.rotation||0}}
 const finalPts={};for(const m of S.markups){const q=plan[m.page];if(!q)continue;const f=([x,y])=>[x*q.s+q.ox,y*q.s+q.oy];finalPts[m.id]={pts:m.pts.map(f),holes:m.holes&&m.holes.map(h=>h.map(f)),rects:m.rects&&m.rects.map(r=>[...f([r[0],r[1]]),...f([r[2],r[3]])]),fs:m.style.fontSize?m.style.fontSize*q.s:null}}
 const scales=JSON.parse(JSON.stringify(S.scales));
 await PMBatch.rebuild(async doc=>{for(const n of pages.slice().sort((a,b)=>a-b)){const q=plan[n],old=doc.getPage(n-1),emb=await doc.embedPage(old);const sw=q.rot%180?q.H:q.W,sh=q.rot%180?q.W:q.H;
   const np=doc.insertPage(n,[sw,sh]);const ew=emb.width*q.s,eh=emb.height*q.s;np.drawPage(emb,{x:(sw-ew)/2,y:(sh-eh)/2,xScale:q.s,yScale:q.s});if(q.rot)np.setRotation(PL().degrees(q.rot));doc.removePage(n-1)}return ident(doc.getPageCount())},'Resizing pages');
 for(const m of S.markups){const f=finalPts[m.id];if(!f)continue;m.pts=f.pts;if(f.holes)m.holes=f.holes;if(f.rects)m.rects=f.rects;if(f.fs)m.style.fontSize=+f.fs.toFixed(2)}
 for(const n of pages){const sc=scales[n]||(scales.all&&!scales[n]?scales.all:null);if(sc)S.scales[n]=Object.assign({},sc,{perPt:sc.perPt/plan[n].s,label:sc.label+' (resized)'})}
 saveScales();commit();updateScaleBtn();toast('Pages resized')}

/* =====================================================================================
   7. ATTACHMENTS, REDUCE FILE SIZE, SECURITY
   ===================================================================================== */
async function loadAtt(){DP.att=[];DP.attAdd=DP.outer&&DP.outer.att?DP.outer.att.slice():[];DP.attRemove=new Set();try{const a=await S.pdf.getAttachments();if(a)DP.att=Object.values(a).filter(x=>!/^planmark-(original\.pdf|markups\.json)$/.test(x.filename)).map(x=>({name:x.filename,bytes:x.content,desc:x.description||''}))}catch(e){}renderAtt()}
function renderAtt(){const pane=$('#pane-attach');if(!pane)return;if(!S.pdf){pane.innerHTML='<div class="hint">Open a PDF to see its attachments.</div>';return}
 const row=(a,kind,i)=>`<div class="res" style="display:flex;gap:6px;align-items:center"><span style="flex:1;min-width:0"><b style="font-weight:600">${esc(a.name)}</b><br><small style="color:var(--mut)">${(a.bytes.length/1024).toFixed(1)} KB${kind==='new'&&!a.keep?' · added, saved with the PDF':''}${kind==='gone'?' · will be removed':''}</small></span>${kind!=='gone'?`<span data-atd="${kind}:${i}" title="Download" style="opacity:.75">⤓</span>`:''}<span data-atx="${kind}:${i}" title="${kind==='gone'?'Keep':'Remove'}" style="opacity:.75">${kind==='gone'?'↺':'✕'}</span></div>`;
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn" id="atAdd" style="border:1px solid var(--line)">+ Attach files…</button></div>`+
  ((DP.att.length+DP.attAdd.length)?DP.att.map((a,i)=>row(a,DP.attRemove.has(a.name)?'gone':'old',i)).join('')+DP.attAdd.map((a,i)=>row(a,'new',i)).join(''):'<div class="hint">No files are attached to this PDF. Attach specs, photos or submittals and they travel inside the PDF when you save.</div>');
 $('#atAdd').onclick=()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.onchange=async()=>{for(const f of i.files)DP.attAdd.push({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())});renderAtt();toast('Attached — save the PDF to keep them')};i.click()}}
H.ready.push(()=>{const pane=addTab('attach','Attachments');renderAtt();
 pane.addEventListener('click',e=>{const d=e.target.closest('[data-atd]'),x=e.target.closest('[data-atx]');const pr=s=>{const[k,i]=s.split(':');return{k,a:k==='new'?DP.attAdd[+i]:DP.att[+i],i:+i}};
  if(d){const{a}=pr(d.dataset.atd);if(a)saveFile(a.name,new Blob([a.bytes]))}
  if(x){const{k,a,i}=pr(x.dataset.atx);if(k==='new')DP.attAdd.splice(i,1);else if(k==='gone')DP.attRemove.delete(a.name);else DP.attRemove.add(a.name);renderAtt()}})});
async function reduceDialog(){if(!S.bytes)return toast('Open a PDF first');const mb=b=>fmtSize(b);
 modal('Reduce file size',`<div class="hint" style="margin-bottom:8px">Current size: <b style="color:var(--text)">${mb(S.bytes.length)}</b></div>
 <label class="chk fld"><input type="radio" name="rdM" value="clean" checked> Clean up and compress (no quality loss)</label>
 <label class="chk fld"><input type="radio" name="rdM" value="jpeg"> Convert pages to compressed images — best for big scans. <b>Flattens</b> those pages: their text and lines become a picture (run OCR afterwards to make text searchable again).</label>
 <div class="row fld"><div><label style="font-size:11px;color:var(--mut)">Image resolution</label><select class="ti" id="rdD"><option>100</option><option selected>150</option><option>200</option><option>300</option></select></div><div><label style="font-size:11px;color:var(--mut)">Quality</label><select class="ti" id="rdQ"><option value=".55">Smaller</option><option value=".7" selected>Balanced</option><option value=".85">Sharper</option></select></div><div><label style="font-size:11px;color:var(--mut)">Pages</label><input class="ti" id="rdR" value="all"></div></div>`,
 [{label:'Cancel',cancel:1},{label:'Reduce',pri:1,fn:md=>{const mode=md.querySelector('input[name=rdM]:checked').value,dpi=+md.querySelector('#rdD').value,q=+md.querySelector('#rdQ').value,v=md.querySelector('#rdR').value.trim().toLowerCase(),pages=v==='all'?S.pages.map(p=>p.num):parseRange(v);setTimeout(()=>runReduce(mode,dpi,q,pages),0)}}])}
const fmtSize=b=>b>=1048576?(b/1048576).toFixed(2)+' MB':(b/1024).toFixed(0)+' KB';
async function runReduce(mode,dpi,q,pages){const before=S.bytes.length,prev={bytes:S.bytes,markups:JSON.parse(JSON.stringify(S.markups)),scales:JSON.parse(JSON.stringify(S.scales)),name:S.fileName,cur:S.cur};try{
 if(mode==='clean'){const doc=await PL().PDFDocument.load(S.bytes,{ignoreEncryption:true,updateMetadata:false});const out=new Uint8Array(await doc.save({useObjectStreams:true}));
  if(out.length>=before){toast('This file is already compact — no savings found');return}await PMBatch.rebuild(async d=>ident(d.getPageCount()),'Compressing')}
 else{const imgs={},keep={};for(const n of pages){const p=S.pages[n-1],k=Math.min(dpi/72,Math.sqrt(30e6/(p.w*p.h))),pg=await S.pdf.getPage(n),vp=pg.getViewport({scale:k}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;imgs[n]=await new Promise(r=>c.toBlob(async b=>r(new Uint8Array(await b.arrayBuffer())),'image/jpeg',q));toast(`Compressing page ${n}…`)}
  for(const m of S.markups)if(imgs[m.page])keep[m.id]={pts:m.pts.map(p=>p.slice()),holes:m.holes,rects:m.rects};
  await PMBatch.rebuild(async doc=>{for(const n of pages){const p=S.pages[n-1],jpg=await doc.embedJpg(imgs[n]),np=doc.insertPage(n,[p.w,p.h]);np.drawImage(jpg,{x:0,y:0,width:p.w,height:p.h});doc.removePage(n-1)}return ident(doc.getPageCount())},'Compressing pages');
  for(const m of S.markups){const k=keep[m.id];if(k){m.pts=k.pts;if(k.holes)m.holes=k.holes;if(k.rects)m.rects=k.rects}}commit()}
 const after=S.bytes.length;if(after>=before){await openBytes(prev.bytes,prev.name,{markups:prev.markups,scales:prev.scales});gotoPage(prev.cur,true);toast(`Converting to images would make this file bigger (${fmtSize(after)}), so the original was kept`);return}
 toast(`File size: ${fmtSize(before)} → ${fmtSize(after)} (${Math.round((1-after/before)*100)}% smaller). Save to keep it.`)}
 catch(e){console.error(e);toast('Could not reduce: '+(e.message||e))}}
function securityDialog(){const E=DP.encrypted;const perm=E&&E.P!=null?[[4,'Printing'],[8,'Changing the document'],[16,'Copying text and graphics'],[32,'Adding comments / markups'],[256,'Form filling'],[1024,'Assembling pages'],[2048,'High-quality printing']].map(([b,l])=>`${E.P&b?'✅':'⛔'} ${l}`).join('<br>'):'';
 modal('Security',`${E?`<div class="meas"><b style="font-size:13px;color:var(--text)">This PDF was password-protected</b><small>${E.fallback?'Its protection type is not supported for saving.':E.hadUserPw?'Opened with '+(E.owner?'the owner':'the open')+' password.':'It only had an owner (permissions) password, so it opened without asking.'}</small></div>${perm?'<div class="hint" style="margin-bottom:8px"><b style="color:var(--text)">Permissions set by the author</b><br>'+perm+'</div>':''}`:'<div class="hint" style="margin-bottom:8px">This PDF is not password-protected.</div>'}
 <div class="hint">PlanMark opens password-protected PDFs (after you enter the password) so you can mark them up. ${E&&!E.fallback?'When you save, the copy keeps the <b>same password and permissions</b> as the file you opened. Use Security ▸ Remove security if you need an unprotected copy.':'PlanMark can add a password when you save: Document tools ▸ Security.'} Please respect the author's permissions.</div>`,[{label:'OK',cancel:1}])}

/* =====================================================================================
   8. WIRING
   ===================================================================================== */
H.open.push(async()=>{DP.links={};DP.hoverLink=null;DP.outline=null;const mt=DP.outer&&DP.outer.meta;if(DP.outer)DP.outer.meta=null;if(mt){if(mt.bookmarks&&mt.bookmarks.length&&!(LS.get(bmKey(),[])||[]).length)LS.set(bmKey(),mt.bookmarks);if(mt.labels&&mt.labels.length===S.pages.length&&!LS.get(lbKey(),null))LS.set(lbKey(),{labels:mt.labels})}
 await loadLabels();try{DP.outline=await resolveOutline(S.pdf)}catch(e){}injectBM(true);loadAtt()});
function docDialog(){const b=(id,t,d)=>`<button class="btn" id="${id}" style="border:1px solid var(--line);justify-content:flex-start;height:auto;padding:7px 9px;flex-direction:column;align-items:flex-start;white-space:normal;text-align:left"><b>${t}</b><small style="color:var(--mut)">${d}</small></button>`;
 modal('Document tools',`<div class="sec" style="margin-top:0">Links</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">${b('dtHL','Hyperlink','Draw a clickable area')}${b('dtBL','Batch Link','Link every sheet reference')}${b('dtRL','Remove links','Delete Batch Link links')}</div>
 <div class="sec">Bookmarks & labels</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">${b('dtPL','Page labels','Name pages, e.g. A-101')}${b('dtBM','Bookmarks from labels','One bookmark per sheet')}${b('dtTOC','Contents page','Linked sheet index up front')}${b('dtLOG','Drawing log','Sheet list as CSV')}${b('dtHF','Headers & footers','Page numbers, dates, Bates')}${b('dtHX','Remove headers','Delete headers/footers')}</div>
 <div class="sec">Pages</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">${b('dtCR','Crop','Trim pages to an area')}${b('dtBK','Insert blank','Letter to ARCH E')}${b('dtRP','Replace pages','From another PDF')}${b('dtSL','Slip sheet','Swap in a revision by sheet number')}${b('dtRZ','Resize','Change paper size')}</div>
 <div class="sec">File</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">${b('dtAT','Attachments','Files inside the PDF')}${b('dtRD','Reduce size','Compress the PDF')}${b('dtSC','Security','Password & permissions')}</div>`,[{label:'Close',cancel:1}]);
 const go=(id,fn)=>{const el=$('#'+id);if(el)el.onclick=()=>{closeModal();fn()}};const need=fn=>()=>S.pages.length?fn():toast('Open a PDF first');
 go('dtHL',need(()=>setTool('hlink')));go('dtBL',batchLink);go('dtRL',()=>{const n=S.markups.filter(m=>m.type==='hlink'&&m.subject==='Batch Link').length;if(!n)return toast('No Batch Link links');pushUndo();S.markups=S.markups.filter(m=>!(m.type==='hlink'&&m.subject==='Batch Link'));commit();toast(`Removed ${n} links`)});
 go('dtPL',labelsDialog);go('dtBM',need(bmFromLabels));go('dtTOC',need(tocDialog));go('dtLOG',need(drawingLog));go('dtHF',hfDialog);go('dtHX',removeHF);
 go('dtCR',cropDialog);go('dtBK',blankDialog);go('dtRP',replaceDialog);go('dtSL',slipDialog);go('dtRZ',resizeDialog);go('dtAT',()=>switchTab('attach'));go('dtRD',reduceDialog);go('dtSC',securityDialog)}
H.ribbon.push({label:'Document',title:'Links, bookmarks, page labels, headers & footers, page tools, attachments, file size, security',icon:'<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><path d="M9 14a2 2 0 002.8 0l1.5-1.5a2 2 0 00-2.8-2.8l-.5.5"/><path d="M13 15.5l-.5.5a2 2 0 01-2.8-2.8"/>',fn:docDialog});
Object.assign(window.PMDoc,{showLabels,gc,decryptPdf,isEncrypted,batchLink,runBatchLink,labelsDialog,saveLabels,drawingLog,applyHF,removeHF,runCrop,runResize,runSlip,insertTOC,bmFromLabels,runReduce,securityDialog,followLink,loadLinks,labelOf,docDialog,md5,rc4,blankDialog,replaceDialog,cropDialog,slipDialog,hfDialog});
})();
