/* PlanMark — sheet numbers that work like links, with nothing to set up (like Bluebeam's Batch Link, but live).
   1. Sheet numbers: when a PDF has no page labels, each page's sheet number is read from its title block
      (the big "A-101" in the corner), so thumbnails and the page box show A-101 and typing A-101 jumps there.
   2. Any mention of another sheet on the drawings ("SEE A-201", a detail bubble 3 over A-501, "3/A501", a sheet
      index) is clickable: hover shows it, a click goes to that sheet — and, for a detail bubble, to that detail.
      Alt+Left comes back. Batch Link (Document tools) still makes real PDF links for sending the file out. */
(function(){
const SL={refs:{},hover:null,pending:null,auto:false};
const norm=s=>String(s||'').toUpperCase().replace(/[\s.\-–_]/g,'');
// what a sheet number looks like: A101, A-101, A1.01, S-201, FP-1, M2.1, E001, C-1, A101A
const SHEET=/^([A-Z]{1,3})\s?[-.–]?\s?(\d{1,3}(?:\.\d{1,3})?[A-Z]?)$/;
const NOT=/^(REV|NO|DATE|ZONE|STE|UNIT|LOT|PH|RM|FL|EL|FT|IN|TYP|SIM|UL|R|W|HP|KW|NJ|NY|PA|CT|RT|RTE|BOX|APT|BLDG|PG|PP|SEC|ART|ITEM|NOTE|NOTES|TYPE|CL|SF|LF|CY|MIN|MAX|NTS)$/;
const looksSheet=t=>{const m=SHEET.exec(String(t).trim().toUpperCase());return!!m&&!NOT.test(m[1])};
const readPage=n=>window.PMScaleDetect?PMScaleDetect.readText(n):Promise.resolve({items:[],W:1,H:1});
const idle=()=>window.PMScaleDetect?PMScaleDetect.idle():Promise.resolve();

/* ---------- 1. sheet numbers from the title block ---------- */
function sheetOf(rd){const W=rd.W,H=rd.H;let best=null;
 const words=rd.items.filter(it=>/SHEET|DWG|DRAWING\s*(NO|NUMBER|#)/i.test(it.s));
 for(const it of rd.items){const s=it.s.trim();if(!looksSheet(s))continue;const cx=(it.x+it.x2)/2,cy=it.y;
  if(!(cx>W*.68||cy>H*.78))continue;   // title blocks run down the right side or along the bottom
  let sc=it.h;if(cx>W*.78&&cy>H*.7)sc*=1.3;if(words.some(w=>Math.hypot(w.x-it.x,w.y-it.y)<Math.max(140,it.h*8)))sc*=1.4;
  if(!best||sc>best.sc)best={s:s.toUpperCase().replace(/\s+/g,''),sc,h:it.h}}
 return best}
async function autoLabels(){const D=window.PMDoc;if(!S.pdf||!D||D.custom)return;const N=S.pages.length;
 if(D.labels&&D.labels.some((l,i)=>l&&l!==String(i+1)))return;   // the PDF has labels of its own
 const doc=S.pdf,found=[];for(let n=1;n<=N;n++){await idle();if(doc!==S.pdf)return;let r=null;try{r=sheetOf(await readPage(n))}catch(e){}if(doc!==S.pdf)return;found.push(r)}
 const got=found.filter(Boolean),uniq=new Set(got.map(f=>norm(f.s)));
 // trust it only when most pages have one and they are (nearly) all different; a single sheet needs a big, clear number
 const ok=N===1?got.length===1&&got[0].h>=12:got.length>=Math.ceil(N*.6)&&uniq.size>=got.length*.85;if(!ok)return;
 const seen=new Set();D.labels=found.map((f,i)=>{if(!f)return String(i+1);const k=norm(f.s);if(seen.has(k))return String(i+1);seen.add(k);return f.s});
 D.auto=true;SL.auto=true;SL.refs={};try{D.showLabels&&D.showLabels()}catch(e){}try{window.PMQA1&&PMQA1.syncLabels()}catch(e){}try{updateCurUI()}catch(e){}}

/* ---------- 2. references to other sheets ---------- */
function targets(){const D=window.PMDoc;if(!D||!D.labels)return[];return D.labels.map((l,i)=>({l,page:i+1})).filter(t=>t.l&&t.l!==String(t.page)&&looksSheet(t.l))}
function rxFor(l){const m=SHEET.exec(l.toUpperCase());if(!m)return null;const d=m[2].replace(/\./g,'[.\\-]?');return new RegExp(`(^|[^A-Z0-9])(${m[1]}\\s?[-.–]?\\s?${d})(?![0-9A-Z])`,'gi')}
function boxOf(it,i0,len,n){const L=Math.max(1,n),a=it.w*i0/L,b=it.w*(i0+len)/L,ux=Math.cos(it.ang),uy=Math.sin(it.ang),nx=Math.sin(it.ang),ny=-Math.cos(it.ang),h=it.h;
 const P=[[it.x+ux*a,it.y+uy*a],[it.x+ux*b,it.y+uy*b]],Q=P.flatMap(p=>[[p[0]+nx*h*.95,p[1]+ny*h*.95],[p[0]-nx*h*.22,p[1]-ny*h*.22]]);
 const xs=Q.map(q=>q[0]),ys=Q.map(q=>q[1]);return[Math.min(...xs)-1,Math.min(...ys)-1,Math.max(...xs)+1,Math.max(...ys)+1]}
async function refsOf(n){if(SL.refs[n])return SL.refs[n];SL.refs[n]=[];const T=targets();if(!T.length)return SL.refs[n];const doc=S.pdf;let rd;try{rd=await readPage(n)}catch(e){return SL.refs[n]}if(doc!==S.pdf)return[];
 const out=[];const RX=T.filter(t=>t.page!==n).map(t=>({t,rx:rxFor(t.l)})).filter(x=>x.rx);
 for(const it of rd.items){const s=it.s;if(!s||s.length>400)continue;const up=s.toUpperCase();
  for(const{t,rx}of RX){rx.lastIndex=0;let m;while((m=rx.exec(up))){const i0=m.index+m[1].length,len=m[2].length;
    // a detail number: "3/A501", "DETAIL 3/A501", or a bubble with the number just above the sheet number
    let det=null;const pre=/(\d{1,3}[A-Z]?)\s*\/\s*$/.exec(up.slice(0,i0));if(pre)det=pre[1];
    if(!det&&s.trim().length===m[2].length){const cx=(it.x+it.x2)/2;const up1=rd.items.find(o=>o!==it&&/^\d{1,3}[A-Z]?$/.test(o.s.trim())&&Math.abs((o.x+o.x2)/2-cx)<it.h*1.2&&it.y-o.y>it.h*.6&&it.y-o.y<it.h*2.6);if(up1)det=up1.s.trim()}
    out.push({r:boxOf(it,pre?i0-pre[0].length:i0,pre?len+pre[0].length:len,s.length),page:t.page,label:t.l,det})}}}
 if(doc===S.pdf){SL.refs[n]=out;if(out.length)redrawPage(n)}return out}
function refAt(n,pt){const L=SL.refs[n];if(!L){if(S.pdf)refsOf(n);return null}for(const r of L)if(pt[0]>=r.r[0]&&pt[0]<=r.r[2]&&pt[1]>=r.r[1]&&pt[1]<=r.r[3])return r;return null}
// go there — and to the detail, when the reference names one
async function go(ref){const from=S.cur;gotoPage(ref.page);let where='';
 if(ref.det){try{const rd=await readPage(ref.page),L=rd.items.filter(o=>o.s.trim().toUpperCase()===ref.det.toUpperCase());
   // the detail's title bubble: the number with a title or "SCALE:" right beside it
   const ttl=L.map(o=>({o,t:rd.items.find(q=>q!==o&&q.x>o.x2-2&&q.x-o.x2<o.h*8&&Math.abs(q.y-o.y)<o.h*2.2&&/[A-Z]{3,}/.test(q.s))})).find(x=>x.t)||(L[0]&&{o:L[0]});
   if(ttl){const o=ttl.o,W=rd.W,H=rd.H;let box=null;try{const t=ttl.t||o;box=await PMScaleDetect.areaOf(ref.page,{x:Math.min(o.x,t.x),x2:Math.max(o.x2,t.x2),y:Math.max(o.y,t.y),h:Math.max(o.h,t.h)})}catch(e){}
    if(!box||(box[2]-box[0])*(box[3]-box[1])>W*H*.5)box=[Math.max(0,o.x-W*.06),Math.max(0,o.y-H*.42),Math.min(W,o.x+W*.3),Math.min(H,o.y+o.h*3)];
    const fit=()=>{try{const vw=viewer.clientWidth,vh=viewer.clientHeight;setZoom(clamp(Math.min(vw/(box[2]-box[0]),vh/(box[3]-box[1]))*.9,.05,64));const pp=S.pages[ref.page-1];
      viewer.scrollTo({left:pp.el.offsetLeft+(box[0]+box[2])/2*S.zoom-vw/2,top:pp.el.offsetTop+(box[1]+box[3])/2*S.zoom-vh/2,behavior:'auto'})}catch(e){}};setTimeout(fit,380);setTimeout(fit,800);where=' · detail '+ref.det}}catch(e){}}
 toast(`→ ${ref.label}${where}  (Alt+← to go back)`)}

/* ---------- mouse ---------- */
const on=()=>!(window.PM_SHEETLINKS_OFF||LS.get('pm:sheetLinks',true)===false);
const _down=H.down;H.down=function(e,p,pt){SL.pending=null;const res=_down?_down(e,p,pt):false;
 // a real PDF link or a web address under the mouse wins
 const taken=(window.PMDoc&&PMDoc.pending)||(window.PMLinks3&&PMLinks3.pending);
 if(!taken&&on()&&p&&pt&&(S.tool==='pan'||S.tool==='select')&&!(e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)&&!(e.target.closest&&e.target.closest('.mk'))){const r=refAt(p.num,pt);if(r)SL.pending={r,x:e.clientX,y:e.clientY}}
 return res};
window.addEventListener('pointerup',e=>{const pd=SL.pending;SL.pending=null;if(pd&&Math.hypot(e.clientX-pd.x,e.clientY-pd.y)<5){setTimeout(()=>go(pd.r),0)}});
viewer.addEventListener('pointermove',e=>{if(!on()||!S.pages.length||e.buttons||(S.tool!=='select'&&S.tool!=='pan'))return;
 const mk=e.target.closest&&e.target.closest('.mk');const p=pageFromEvent(e);const r=!mk&&p?refAt(p.num,toPt(e,p)):null;const before=SL.hover;
 if((before&&before.r)!==(r&&r.r)){SL.hover=r?Object.assign({pg:p.num},r):null;if(before)redrawPage(before.pg);if(r)redrawPage(p.num)}
 if(r){viewer.style.cursor='pointer';const h=$('#hint');if(h)h.textContent=`Go to ${r.label}${r.det?' · detail '+r.det:''}`}
 else if(before&&!r){viewer.style.cursor='';const h=$('#hint');if(h&&/^Go to /.test(h.textContent))h.textContent=HINTS[S.tool]||''}});
H.over.push(n=>{const r=SL.hover;if(!r||r.pg!==n)return'';const b=r.r,k=1/S.zoom;
 return`<rect x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" fill="rgba(37,99,235,.10)" stroke="#2563eb" stroke-width="${1.2*k}" rx="${2*k}" pointer-events="none"/>`});
H.open.push(()=>{SL.refs={};SL.hover=null;SL.auto=false;setTimeout(autoLabels,500)});
// labels changed by hand (Page labels dialog): look for references again
{const D=window.PMDoc;if(D&&D.saveLabels){const _s=D.saveLabels;D.saveLabels=function(){const r=_s.apply(this,arguments);SL.refs={};return r}}}
window.PM_EXTRA_CMDS_SL=()=>[{id:'sl:toggle',menu:'View',label:'Sheet numbers on the drawings are links',key:'',check:()=>on(),run:()=>{LS.set('pm:sheetLinks',!on());SL.hover=null;try{for(const p of S.pages)redrawPage(p.num)}catch(e){}toast(on()?'Sheet references are clickable':'Sheet references are plain text')}}];
window.PM_EXTRA_SYNC_KEYS_SL=['pm:sheetLinks'];
window.PMSheetLinks={SL,autoLabels,refsOf,refAt,go,sheetOf,looksSheet};
})();
