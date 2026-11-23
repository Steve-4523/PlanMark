/* PlanMark — open Revit (.rvt) files.
   Revit files can't be read outside Autodesk software, so the file is sent to Autodesk's converter
   (through planmark.olympiaholdings.com/api/revit, which holds the Autodesk keys). Autodesk turns it into
   one PDF per 2D view/sheet (Revit 2022 or newer) and an IFC 3D model. The sheets open here as a normal
   PDF for markup and takeoff; the 3D model opens in the BIM viewer. A file that was converted before
   (same contents) opens straight away without uploading again. Needs the Olympia sign-in. */
(function(){
const API=/^planmark\.olympiaholdings\.com$/.test(location.hostname)||/^planmark-[a-z0-9-]+\.vercel\.app$/.test(location.hostname)?'/api/revit':'https://planmark.olympiaholdings.com/api/revit';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmtMB=n=>(n/1048576).toFixed(n<10485760?1:0)+' MB';
let busy=false,cancelled=false;

async function call(q,opt){let t;try{t=await PMAccount.token()}catch(e){const er=new Error('signin');er.signin=true;throw er}
 const r=await fetch(API+'?'+new URLSearchParams(q),{...(opt||{}),headers:{Authorization:'Bearer '+t,...(opt&&opt.body?{'Content-Type':'application/json'}:{})}});
 if(r.status===401){const er=new Error('signin');er.signin=true;throw er}
 return r}
async function callJson(q,opt){const r=await call(q,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('Server error '+r.status));return j}

async function sha256(bytes){const h=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}

function progress(title){modal(title,`<div class="hint" id="rvMsg">Starting…</div><div style="height:8px;background:var(--bg);border-radius:4px;margin-top:10px;overflow:hidden"><div id="rvBar" style="height:100%;width:3%;background:var(--acc);transition:width .3s"></div></div><div class="hint" style="margin-top:10px;font-size:11px">Revit files are converted online by Autodesk. Big models can take a few minutes. You can keep working in other tabs.</div>`,[{label:'Cancel',cancel:1,fn:()=>{cancelled=true}}]);
 return(f,t)=>{const b=$('#rvBar');if(b&&f!=null)b.style.width=Math.max(3,Math.min(100,Math.round(f*100)))+'%';const m=$('#rvMsg');if(m&&t)m.textContent=t}}

async function upload(bytes,key,prog){const up=await callJson({a:'upload'},{method:'POST',body:JSON.stringify({key,size:bytes.length})});
 let sent=0;
 for(let i=0;i<up.urls.length;i++){if(cancelled)throw new Error('cancelled');const part=bytes.subarray(i*up.partSize,Math.min(bytes.length,(i+1)*up.partSize));
  let ok=false,err;for(let tr=0;tr<3&&!ok;tr++){try{const r=await fetch(up.urls[i],{method:'PUT',body:part});ok=r.ok;if(!ok)err=new Error('Upload refused ('+r.status+')')}catch(e){err=e;await sleep(1500*(tr+1))}}
  if(!ok)throw new Error('Could not send the file to Autodesk: '+(err&&err.message||err));
  sent+=part.length;prog(.05+.35*sent/bytes.length,'Sending to Autodesk… '+fmtMB(sent)+' of '+fmtMB(bytes.length))}
 await callJson({a:'finish'},{method:'POST',body:JSON.stringify({key,uploadKey:up.uploadKey})})}

async function waitDone(key,prog){let last=null,t0=Date.now();
 for(;;){if(cancelled)throw new Error('cancelled');const s=await callJson({a:'status',key});last=s;
  if(s.state==='success'||s.state==='failed'||s.state==='timeout')return s;
  const p=parseInt(s.progress,10);prog(.4+.5*((isNaN(p)?0:p)/100),'Autodesk is converting the model… '+(isNaN(p)?'':p+'%')+' ('+Math.round((Date.now()-t0)/1000)+'s)');
  await sleep(4000)}}

async function download(key,deriv,prog,label){const parts=[];let start=0,total=null;
 for(;;){if(cancelled)throw new Error('cancelled');const r=await call({a:'file',key,deriv,start,end:start+4*1024*1024-1});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||('Download failed '+r.status))}
  const b=new Uint8Array(await r.arrayBuffer());total=+r.headers.get('X-Total-Length')||total;parts.push(b);start+=b.length;
  if(prog&&total)prog(null,label+' '+fmtMB(start)+' of '+fmtMB(total));
  if(!b.length||(total&&start>=total)||(!total&&b.length<4*1024*1024))break}
 const out=new Uint8Array(start);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}

const isSheet=n=>/^(sheet:|[A-Z]{1,3}[-.]?\d)/i.test(n);
function pickDialog(name,s,key){const views=s.views.slice().sort((a,b)=>(isSheet(b.name)-isSheet(a.name)));
 const rows=views.map((v,i)=>`<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:12.5px"><input type="checkbox" data-rv="${i}" ${isSheet(v.name)||views.filter(x=>isSheet(x.name)).length===0?'checked':''}>${esc(v.name)}</label>`).join('');
 const why=!views.length?`<div class="hint">Autodesk didn't make any drawing sheets from this file. That happens when the file was saved in Revit 2021 or older, or has no sheets/views published.${s.messages&&s.messages.length?'<br><br>Autodesk said: '+esc(s.messages.join(' · ')):''}</div>`:'';
 modal('Revit: '+name,`${views.length?`<div class="hint" style="margin-bottom:6px">Pick the sheets and views to open. They open together as one PDF you can mark up and measure.</div><div style="margin-bottom:6px"><a href="#" id="rvAll" style="color:#7dd3fc;font-size:12px">all</a> · <a href="#" id="rvNone" style="color:#7dd3fc;font-size:12px">none</a> · <a href="#" id="rvSheets" style="color:#7dd3fc;font-size:12px">sheets only</a></div><div style="max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:6px 10px">${rows}</div>`:why}`,
  [{label:'Close',cancel:1},...(s.ifc?[{label:'Open 3D model',fn:()=>{setTimeout(()=>open3d(name,key,s.ifc),0)}}]:[]),...(views.length?[{label:'Open sheets',pri:1,fn:md=>{const sel=[...md.querySelectorAll('[data-rv]:checked')].map(x=>views[+x.dataset.rv]);if(!sel.length){toast('Pick at least one sheet');return false}setTimeout(()=>openSheets(name,key,sel),0)}}]:[])]);
 const all=v=>$$('#modal [data-rv]').forEach(x=>x.checked=v);
 if($('#rvAll'))$('#rvAll').onclick=e=>{e.preventDefault();all(true)};if($('#rvNone'))$('#rvNone').onclick=e=>{e.preventDefault();all(false)};
 if($('#rvSheets'))$('#rvSheets').onclick=e=>{e.preventDefault();$$('#modal [data-rv]').forEach(x=>x.checked=isSheet(views[+x.dataset.rv].name))}}

async function openSheets(name,key,sel){cancelled=false;const prog=progress('Opening sheets');
 try{const out=await PDFLib.PDFDocument.create();
  for(let i=0;i<sel.length;i++){prog(i/sel.length,'Getting '+sel[i].name+' ('+(i+1)+' of '+sel.length+')…');
   const b=await download(key,sel[i].urn);const src=await PDFLib.PDFDocument.load(b,{ignoreEncryption:true});
   const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p))}
  prog(1,'Opening…');const bytes=new Uint8Array(await out.save());closeModal();
  const base=name.replace(/\.(rvt|rfa|rte)$/i,'');await openBytes(bytes,base+(sel.length===1?' - '+sel[0].name.replace(/[\\/:*?"<>|]/g,'-'):' - sheets')+'.pdf');
  toast('Opened '+sel.length+' sheet'+(sel.length>1?'s':'')+' from '+name)}
 catch(e){closeModal();if(e.message!=='cancelled')fail(e)}}

async function open3d(name,key,urn){cancelled=false;const prog=progress('Opening 3D model');
 try{const b=await download(key,urn,prog,'Getting the 3D model…');closeModal();
  await PMCad.openCadBytes(b,name.replace(/\.(rvt|rfa|rte)$/i,'')+'.ifc','ifc')}
 catch(e){closeModal();if(e.message!=='cancelled')fail(e)}}

function fail(e){if(e&&e.signin){modal('Sign in first',`<div class="hint">Opening Revit files uses your Olympia account (the same sign-in as the Olympia portal). Sign in, then open the file again.</div>`,[{label:'Cancel',cancel:1},{label:'Sign in',pri:1,fn:()=>{setTimeout(()=>{try{PMAccount.showGate()}catch(x){}},0)}}]);return}
 modal("Couldn't open the Revit file",`<div class="hint">${esc(e&&e.message||String(e))}</div>`,[{label:'OK',cancel:1}])}

async function open(bytes,name){if(busy){toast('Already opening a Revit file');return}busy=true;cancelled=false;
 const prog=progress('Opening '+name);
 try{prog(.02,'Checking the file…');const key=(await sha256(bytes))+'.'+name.split('.').pop().toLowerCase();
  let s=await callJson({a:'status',key});
  if(s.state==='none'||s.state==='failed'){await upload(bytes,key,prog);await sleep(2000);s=await callJson({a:'status',key})}
  if(s.state!=='success')s=await waitDone(key,prog);
  closeModal();
  if(s.state!=='success'&&!(s.views&&s.views.length)&&!s.ifc)throw new Error('Autodesk could not convert this file.'+(s.messages&&s.messages.length?' '+s.messages.join(' · '):''));
  pickDialog(name,s,key)}
 catch(e){closeModal();if(e.message!=='cancelled')fail(e)}
 finally{busy=false}}

window.PMRevit={open};
})();
