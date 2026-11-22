/* PlanMark — Projects: shared project files with folders, check-out/check-in and version history
   (web version on claude.ai: files in this artifact's asset storage, records in its database) */
(function(){
const PJ={db:null,assets:null,user:null,me:null,canEdit:false,avail:false,checked:false,list:[],cur:LS.get('pm:proj:cur',null),files:[],unsubF:null,names:{},folder:''};
const ago=t=>{const s=(Date.now()-t)/1000;return s<60?'just now':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+' h ago':new Date(t).toLocaleDateString()};
async function names(ids){ids=[...new Set(ids.filter(i=>i&&!(i in PJ.names)))];if(ids.length&&PJ.user){try{const ps=await PJ.user.profiles(ids);ids.forEach(i=>PJ.names[i]=(ps&&ps[i]&&ps[i].name)||'Someone')}catch(e){}}}
const nm=i=>PJ.names[i]||'Someone';
const fileId=()=>'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function render(){const pane=$('#pane-projects');if(!pane)return;
 if(!PJ.checked){pane.innerHTML='<div class="hint">Connecting…</div>';return}
 if(!PJ.avail){pane.innerHTML=`<div class="hint"><b style="color:var(--text)">Projects</b><br><br>Shared project folders: upload drawings once, everyone on the project opens the same files, checks them out to edit, and checks in new versions with full history.<br><br>${window.pmDesktop?'Projects live in the web version of PlanMark on claude.ai (they use your Claude account to store and share files). Open the PlanMark link in your browser to use them.':'Sign in to claude.ai with this artifact open to use Projects.'}</div>`;return}
 const p=PJ.list.find(x=>x.id===PJ.cur);
 const folders=[...new Set(PJ.files.map(f=>f.folder||''))].sort();const fl=PJ.files.filter(f=>(f.folder||'')===PJ.folder).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 const sub=[...new Set(folders.filter(f=>f!==PJ.folder&&f.startsWith(PJ.folder?PJ.folder+'/':'')).map(f=>f.slice(PJ.folder?PJ.folder.length+1:0).split('/')[0]))];
 pane.innerHTML=`<div class="row" style="gap:6px;margin-bottom:8px"><select class="ti" id="pjSel">${PJ.list.map(x=>`<option value="${esc(x.id)}" ${x.id===PJ.cur?'selected':''}>${esc(x.name)}</option>`).join('')||'<option value="">No projects yet</option>'}</select>${PJ.canEdit?'<button class="btn" id="pjNew" style="flex:0;border:1px solid var(--line)" title="New project">+</button>':''}</div>
 ${p?`<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px">${PJ.assets?'<button class="btn" id="pjUp" style="border:1px solid var(--line)">Upload PDFs…</button>':''}${PJ.assets&&S.bytes?'<button class="btn" id="pjAddCur" style="border:1px solid var(--line)">Add open doc</button>':''}<button class="btn" id="pjFold" style="border:1px solid var(--line)">New folder</button></div>
 <div class="hint" style="margin-bottom:6px">📁 <a href="#" data-cd="" style="color:#7dd3fc">${esc(p.name)}</a>${PJ.folder?PJ.folder.split('/').map((seg,i,a)=>` / <a href="#" data-cd="${esc(a.slice(0,i+1).join('/'))}" style="color:#7dd3fc">${esc(seg)}</a>`).join(''):''}</div>
 ${sub.map(f=>`<div class="res" data-cd="${esc(PJ.folder?PJ.folder+'/'+f:f)}">📁 ${esc(f)}</div>`).join('')}
 ${fl.map(f=>{const mine=f.checkedOutBy===PJ.me,out=f.checkedOutBy&&!mine;return`<div class="res" data-fid="${esc(f.id)}" style="${S.projFile&&S.projFile.fid===f.id?'background:var(--accbg)':''}"><b style="font-weight:600">${esc(f.name)}</b> <small style="color:var(--mut)">v${f.version||1}</small>${f.checkedOutBy?`<span style="color:${mine?'#86efac':'#fbbf24'};font-size:11px"> · 🔒 ${mine?'checked out by you':'checked out by '+esc(nm(f.checkedOutBy))}</span>`:''}<br><small style="color:var(--mut)">${esc(nm(f.updatedBy))} · ${ago(f.updatedAt||0)} · ${((f.size||0)/1048576).toFixed(1)} MB</small>
  <div class="row" style="gap:4px;margin-top:4px;flex-wrap:wrap"><button class="btn" data-op="open" style="height:24px;border:1px solid var(--line)">Open</button>${!f.checkedOutBy&&PJ.assets?'<button class="btn" data-op="co" style="height:24px;border:1px solid var(--line)">Check out</button>':''}${mine?'<button class="btn" data-op="ci" style="height:24px;border:1px solid var(--line)">Check in</button><button class="btn" data-op="undo" style="height:24px;border:1px solid var(--line)">Undo check-out</button>':''}<button class="btn" data-op="hist" style="height:24px;border:1px solid var(--line)">History</button>${PJ.canEdit&&!out?'<button class="btn" data-op="del" style="height:24px;border:1px solid var(--line)">Delete</button>':''}</div></div>`}).join('')||(sub.length?'':'<div class="hint">No files here yet.</div>')}
 <div class="hint" style="margin-top:8px">Check out a file before marking it up so nobody overwrites your work; Check in saves your marked-up PDF as a new version (markups stay editable).</div>`:
 `<div class="hint">${PJ.canEdit?'Create a project to share drawings with your team.':'No projects have been shared with you yet.'}</div>`}`;
 const sel=$('#pjSel');sel.onchange=()=>openProject(sel.value);if($('#pjNew'))$('#pjNew').onclick=()=>modalPrompt('New project','Project name','',async n=>{const id='p'+Date.now().toString(36);await PJ.db.doc('projects/'+id).set({name:n,created:Date.now(),owner:PJ.me});openProject(id)});
 if(!p)return;
 if($('#pjUp'))$('#pjUp').onclick=()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='application/pdf,.pdf';i.onchange=()=>upload([...i.files]);i.click()};
 if($('#pjAddCur'))$('#pjAddCur').onclick=()=>upload([new File([S.bytes],S.fileName,{type:'application/pdf'})]);
 $('#pjFold').onclick=()=>modalPrompt('New folder','Folder name','',n=>{PJ.folder=(PJ.folder?PJ.folder+'/':'')+n.replace(/[\/\\]/g,'-');render();toast('Upload files into it to keep the folder')});
 pane.querySelectorAll('[data-cd]').forEach(a=>a.onclick=e=>{e.preventDefault();PJ.folder=a.dataset.cd;render()});
 pane.querySelectorAll('[data-op]').forEach(b=>b.onclick=e=>{e.stopPropagation();const f=PJ.files.find(x=>x.id===b.closest('[data-fid]').dataset.fid);if(f)fileOp(f,b.dataset.op)})}
async function openProject(id){PJ.cur=id;LS.set('pm:proj:cur',id);PJ.folder='';if(PJ.unsubF)PJ.unsubF();PJ.files=[];render();if(!id)return;
 PJ.unsubF=PJ.db.collection(`projects/${id}/files`).onSnapshot(snap=>{PJ.files=snap.docs.map(d=>Object.assign({id:d.id},d.data()));names(PJ.files.flatMap(f=>[f.updatedBy,f.checkedOutBy])).then(render);render()},e=>toast('Project files unavailable: '+e.code))}
async function upload(files){if(!PJ.assets)return toast('Only Editors can upload project files');let n=0;
 for(const f of files){if(f.size>20*1024*1024){toast(f.name+' is over 20 MB — skipped');continue}toast('Uploading '+f.name+'…');
  try{const a=await PJ.assets.upload(new Blob([await f.arrayBuffer()],{type:'application/pdf'}));const ex=PJ.files.find(x=>x.name===f.name&&(x.folder||'')===PJ.folder);
   if(ex){const v=(ex.version||1)+1;await PJ.db.doc(`projects/${PJ.cur}/files/${ex.id}`).set(Object.assign({},ex,{id:undefined,asset:a.id,size:f.size,version:v,versions:[...(ex.versions||[]),{asset:a.id,v,at:Date.now(),by:PJ.me,note:'Uploaded'}],updatedAt:Date.now(),updatedBy:PJ.me}))}
   else{const id=fileId();await PJ.db.doc(`projects/${PJ.cur}/files/${id}`).set({name:f.name,folder:PJ.folder,asset:a.id,size:f.size,version:1,versions:[{asset:a.id,v:1,at:Date.now(),by:PJ.me,note:'Uploaded'}],updatedAt:Date.now(),updatedBy:PJ.me,checkedOutBy:null})}n++}
  catch(e){toast('Upload failed: '+(e.message||e.code))}}if(n)toast(`Uploaded ${n} file${n>1?'s':''}`)}
async function openFile(f,asset){toast('Opening '+f.name+'…');const r=await fetch('/_blob/'+(asset||f.asset));if(!r.ok)return toast('Could not download ('+r.status+')');
 await openBytes(new Uint8Array(await r.arrayBuffer()),f.name);S.projFile={pid:PJ.cur,fid:f.id};render()}
const clean=f=>{const o=Object.assign({},f);delete o.id;return o};
async function fileOp(f,op){const ref=PJ.db.doc(`projects/${PJ.cur}/files/${f.id}`);
 if(op==='open')return openFile(f);
 if(op==='co'){const l=await ref.acquire({holder:PJ.me,ttlMs:5000});if(!l.acquired)return toast('Someone else is checking it out right now');const cur=(await ref.get()).data();if(cur.checkedOutBy&&cur.checkedOutBy!==PJ.me)return toast('Already checked out by '+nm(cur.checkedOutBy));
  await ref.set(Object.assign(clean(cur),{checkedOutBy:PJ.me,checkedOutAt:Date.now()}));if(!(S.projFile&&S.projFile.fid===f.id))await openFile(f);toast('Checked out — mark it up, then Check in')}
 if(op==='undo'){const cur=(await ref.get()).data();await ref.set(Object.assign(clean(cur),{checkedOutBy:null,checkedOutAt:null}));toast('Check-out released')}
 if(op==='ci'){if(!(S.projFile&&S.projFile.fid===f.id))return toast('Open this file first (Open), then Check in');
  modal('Check in '+f.name,`<div class="fld"><label>What changed? (optional)</label><input class="ti" id="ciN" placeholder="e.g. Added RFI clouds on A-101"></div><label class="chk"><input type="checkbox" id="ciK"> Keep it checked out</label>`,[{label:'Cancel',cancel:1},{label:'Check in',pri:1,fn:md=>{const note=md.querySelector('#ciN').value.trim(),keep=md.querySelector('#ciK').checked;setTimeout(async()=>{
   try{toast('Saving new version…');const bytes=await PMOutput.markedPdf(false);if(bytes.length>20*1024*1024)return toast('Marked-up PDF is over 20 MB — cannot check in');const a=await PJ.assets.upload(new Blob([bytes],{type:'application/pdf'}));const cur=(await ref.get()).data(),v=(cur.version||1)+1;
    await ref.set(Object.assign(clean(cur),{asset:a.id,size:bytes.length,version:v,versions:[...(cur.versions||[]),{asset:a.id,v,at:Date.now(),by:PJ.me,note:note||'Checked in'}],updatedAt:Date.now(),updatedBy:PJ.me,checkedOutBy:keep?PJ.me:null}));toast('Checked in as version '+v)}catch(e){toast('Check-in failed: '+(e.message||e.code))}},0)}}])}
 if(op==='hist'){await names((f.versions||[]).map(v=>v.by));modal('History — '+f.name,(f.versions||[]).slice().reverse().map(v=>`<div class="res" data-asset="${esc(v.asset)}"><b>v${v.v}</b> · ${esc(nm(v.by))} · ${new Date(v.at).toLocaleString()}<br><small style="color:var(--mut)">${esc(v.note||'')}</small></div>`).join('')||'<div class="hint">No history.</div>',[{label:'Close',cancel:1}]);
  $('#modal').addEventListener('click',e=>{const r=e.target.closest('[data-asset]');if(r){closeModal();openFile(f,r.dataset.asset)}})}
 if(op==='del')modal('Delete '+f.name+'?','<div class="hint">Removes the file and its history from the project for everyone.</div>',[{label:'Cancel',cancel:1},{label:'Delete',pri:1,fn:async()=>{for(const v of f.versions||[])try{await PJ.assets.delete(v.asset)}catch(e){}await ref.delete();toast('Deleted')}}])}
H.ready.push(async()=>{addTab('projects','Projects');render();
 if(!(window.claude&&typeof window.claude.use==='function')){PJ.checked=true;render();return}
 const use=n=>Promise.resolve(window.claude.use(n)).catch(()=>null);[PJ.db,PJ.assets,PJ.user]=await Promise.all([use('db'),use('assets'),use('user')]);
 PJ.avail=!!PJ.db;PJ.checked=true;if(PJ.user){try{PJ.me=await PJ.user.id();PJ.canEdit=!!(await PJ.user.canEdit())}catch(e){}}
 if(PJ.db){PJ.db.collection('projects').orderBy('created','desc').limit(100).onSnapshot(snap=>{PJ.list=snap.docs.map(d=>Object.assign({id:d.id},d.data()));if(!PJ.cur&&PJ.list[0])openProject(PJ.list[0].id);else render()},e=>{});if(PJ.cur)openProject(PJ.cur)}
 render()});
H.open.push(()=>{if(S.projFile&&!S.projFile.keep)S.projFile=null;setTimeout(render,50)});
window.PMProjects={PJ,openProject,upload};
})();
