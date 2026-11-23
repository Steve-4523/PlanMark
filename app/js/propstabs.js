/* PlanMark — Properties in tabs.
   Clicking a markup used to list 15+ sections (General, Appearance, Layout, Action, Attachments, Replies, Convert,
   Scale, Pop-up note, Media…) in one long column that needed a lot of scrolling. Now the panel keeps the markup's
   name, Lock / Hide and its measurement at the top, the Delete / Tool Chest buttons at the bottom, and puts the
   sections into tabs (General · Appearance · Measure · Layout · More), like Bluebeam's properties.
   It works on whatever the other modules put in the panel: each section goes to a tab by its heading, and
   anything without a known heading goes to More. The last tab you used stays open as you click other markups. */
(function(){
const box=document.getElementById('props');if(!box)return;
const TABS=[['general','General'],['look','Style'],['meas','Measure'],['layout','Layout'],['more','More']];
const tabOf=title=>{const t=title.toLowerCase();
 if(/^(general|discipline|status|author)/.test(t))return 'general';
 if(/^(appearance|hatch|font|text|line|fill|style|color|colour)/.test(t))return 'look';
 if(/^(measure|scale|convert|depth|slope|takeoff|quantity)/.test(t))return 'meas';
 if(/^(layout|position|size|rotation)/.test(t))return 'layout';
 return 'more'};
let cur=(()=>{try{return localStorage.getItem('pm:propsTab')||'general'}catch(e){return 'general'}})();

const st=document.createElement('style');
st.textContent=`#props.ptOn{display:flex;flex-direction:column;overflow:hidden;padding-bottom:0}
#props .ptTop{flex-shrink:0}
#props .ptBar{flex-shrink:0;display:flex;gap:2px;margin:6px -2px 6px;border-bottom:1px solid var(--line)}
#props .ptBar button{flex:1 1 auto;min-width:0;padding:5px 4px 6px;background:none;border:0;border-bottom:2px solid transparent;color:var(--mut);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#props .ptBar button:hover{color:var(--text)}
#props .ptBar button.on{color:var(--text);border-bottom-color:var(--acc,#3d8bfd);font-weight:600}
#props .ptBody{flex:1;min-height:0;overflow:auto;padding-bottom:8px}
#props .ptPanel{display:none}#props .ptPanel.on{display:block}
#props .ptFoot{flex-shrink:0;border-top:1px solid var(--line);padding:6px 0 8px;display:flex;flex-direction:column;gap:4px}
#props .ptFoot>.row{margin:0}
#props .ptTop>.meas{margin:6px 0 0}
#props .ptBar button{padding:5px 2px 6px}
#props .ptFoot>.row{display:contents}
#props .ptFoot{flex-direction:row;flex-wrap:wrap}
#props .ptFoot button{flex:1 1 auto;height:26px;padding:0 6px;font-size:12px;min-width:0}
#props .fld.ptInline{display:grid;grid-template-columns:84px minmax(0,1fr);align-items:center;column-gap:8px}
#props .fld.ptInline>label{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#props .ptPanel textarea{min-height:44px;height:44px}
#props .ptPanel .fld{margin-bottom:5px}
#props .ptPanel>.sec{margin-top:10px}
#props .ptPanel>.sec:first-child{margin-top:0}
#props .ptTop>.row button{padding-left:6px;padding-right:6px}`;
document.head.appendChild(st);

const WRAP=['ptTop','ptBar','ptBody','ptFoot'];
const isWrap=n=>n.nodeType===1&&WRAP.some(c=>n.classList.contains(c));
let flat=[],busy=false;
const isFoot=n=>n.nodeType===1&&n.classList.contains('row')&&!n.classList.contains('fld')&&/^(Delete|To front|Add to Tool Chest)/.test((n.textContent||'').trim());

function group(){
 const kids=[...box.childNodes];const stray=kids.filter(n=>!isWrap(n));
 if(!kids.some(isWrap))flat=[];                                       // the panel was redrawn from scratch
 if(!stray.length)return;
 flat=flat.filter(n=>!stray.includes(n)&&box.contains(n)).concat(stray);
 const els=flat.filter(n=>n.nodeType===1||(n.nodeType===3&&n.textContent.trim()));
 const secs=els.filter(n=>n.nodeType===1&&n.classList.contains('sec'));
 busy=true;
 try{
  if(secs.length<3){unwrap(els);return}                               // nothing long enough to need tabs
  const top=document.createElement('div');top.className='ptTop';
  const foot=document.createElement('div');foot.className='ptFoot';
  const body=document.createElement('div');body.className='ptBody';
  const panels={};for(const[k]of TABS){const d=document.createElement('div');d.className='ptPanel';d.dataset.k=k;panels[k]=d}
  let sec=0,target=top,measTail=false;
  for(const n of els){
   if(n.nodeType===1&&n.id==='measBox'){top.appendChild(n);measTail=true;continue}
   if(n.nodeType===1&&n.classList.contains('sec')){measTail=false;sec++;
    if(sec===1){target=top;top.appendChild(n);continue}                 // the markup's name, with Lock / Hide under it
    target=panels[tabOf((n.textContent||'').trim())];target.appendChild(n);continue}
   if(measTail&&n.nodeType===1&&n.classList.contains('fld')){top.appendChild(n);continue}   // depth etc. right under the measurement
   measTail=false;
   if(isFoot(n)){foot.appendChild(n);continue}
   if(n.nodeType===1&&n.classList.contains('hint')&&/^Author:/.test((n.textContent||'').trim())){panels.more.appendChild(n);continue}   // who/when made it: rarely needed
   if(n.nodeType===1&&n.classList.contains('fld')&&n.children.length===2&&n.children[0].tagName==='LABEL'&&/^(INPUT|SELECT)$/.test(n.children[1].tagName)&&!/^(checkbox|radio)$/i.test(n.children[1].type||''))n.classList.add('ptInline');   // label beside its box
   target.appendChild(n)}
  const used=TABS.filter(([k])=>panels[k].childNodes.length);
  if(!used.some(([k])=>k===cur))cur=used.length?used[0][0]:'general';
  const bar=document.createElement('div');bar.className='ptBar';
  bar.innerHTML=used.map(([k,l])=>`<button type="button" data-k="${k}" class="${k===cur?'on':''}">${l}</button>`).join('');
  for(const[k]of used){panels[k].classList.toggle('on',k===cur);body.appendChild(panels[k])}
  const sb=box.querySelector('.ptBody'),keep=sb&&sb.dataset.k===cur?sb.scrollTop:0;
  box.replaceChildren(top,bar,body,...(foot.childNodes.length?[foot]:[]));body.dataset.k=cur;body.scrollTop=keep;
  box.classList.add('ptOn')}
 finally{mo.takeRecords();busy=false}}
function unwrap(els){box.replaceChildren(...els);box.classList.remove('ptOn')}

box.addEventListener('click',e=>{const b=e.target.closest('.ptBar button');if(!b)return;cur=b.dataset.k;try{localStorage.setItem('pm:propsTab',cur)}catch(_){}
 box.querySelectorAll('.ptBar button').forEach(x=>x.classList.toggle('on',x===b));box.querySelectorAll('.ptPanel').forEach(p=>p.classList.toggle('on',p.dataset.k===cur));
 const body=box.querySelector('.ptBody');if(body){body.dataset.k=cur;body.scrollTop=0}});

const mo=new MutationObserver(()=>{if(!busy)group()});
mo.observe(box,{childList:true});
group();
window.PMPropsTabs={group,get tab(){return cur}};
})();
