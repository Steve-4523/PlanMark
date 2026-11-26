/* PlanMark — setups retired (1.6.3)
   1.5.9 asked "What kind of work do you do?" (Estimating / Project manager / Field / Everything) and hid the tools and
   side panels the chosen kind of work does not use. Taken out at the owner's request: every tool and panel is standard
   for everyone, with no chooser on the start screen and no Setup items in the View menu.
   What is left here only undoes a choice made before: the hidden side panels were remembered, so they are shown again,
   once, and the choice is forgotten. */
(function(){
const KEY='pm:setup';
H.ready.push(()=>setTimeout(()=>{let had=null;try{had=localStorage.getItem(KEY)}catch(e){}if(had===null)return;
 if(LS.get(KEY,'all')!=='all'){
  try{const L=JSON.parse(JSON.stringify(PMLayout.get()));for(const b of document.querySelectorAll('#left .tabs [data-tab]'))L.tabs[b.dataset.tab]=true;PMLayout.set(L)}catch(e){console.warn(e)}
  try{PMToolGroups.setShown(null,null)}catch(e){}}
 try{localStorage.removeItem(KEY)}catch(e){}},700));
})();
