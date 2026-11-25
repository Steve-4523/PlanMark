/* PlanMark — a tip each time the app opens (Help > Tip of the day shows them any time).
   Tips come in order, so every start shows a new one. Untick "Show a tip when PlanMark opens" to stop them. */
(function(){
const TIPS=[
 ['Pan and zoom','The mouse wheel zooms where the mouse is. Over the scroll bar on the right it scrolls instead. Hold Shift to scroll sideways.'],
 ['Get back to normal','Press Esc to drop whatever tool you are in and go back to the hand (pan).'],
 ['Scale in one click','When a sheet has no scale yet, PlanMark reads the scale printed on it and checks it against the written dimensions. Press Use in the bar at the bottom of the drawing.'],
 ['Scale every page at once','Tools > Set scale on every page from its sheet reads each page\'s own scale, and adds viewports for details drawn at another scale.'],
 ['Calibrate faster','Calibrate (Shift+Alt+K): draw over a written dimension and the length is filled in for you. Then it switches to Dimension so you can check another length.'],
 ['Check a scale','Tools > Check scale measures every written dimension on the page and shows which ones match the scale you set.'],
 ['Details at their own scale','Measure > + Viewport: draw a box around a detail and give it its own scale. Measurements inside the box use it.'],
 ['Type exact lengths','While drawing a line or measurement, type a length such as 12\'6" and the next point goes exactly that far.'],
 ['Straight lines','Hold Shift while drawing to keep lines level, plumb or at 45°. The angle step is set in the Measurements panel.'],
 ['Snapping','The buttons at the bottom right turn snapping on and off: to the grid, to the drawing\'s lines, and to other markups.'],
 ['Measure tools','Length Shift+Alt+L · Area Shift+Alt+A · Perimeter Shift+Alt+P · Count Shift+Alt+C · Angle Shift+Alt+G.'],
 ['Count things','Count (Shift+Alt+C): click each fixture, outlet or door. The running total shows in the Markups list.'],
 ['Totals for a takeoff','The Markups list (Alt+L) adds up every measurement and count. Batch > Markup summary puts them in an Excel file.'],
 ['Change a shape','Select a polyline or area, hover over a side and press C to add a point. Hover over a corner and press D to delete it.'],
 ['Bend a line','Drag the small handle in the middle of a side to pull it into a new corner.'],
 ['Copy while moving','Hold Ctrl while you drag a markup to drop a copy instead of moving it.'],
 ['Keep a tool on','Double-click a tool to keep it on, so you can draw several markups in a row.'],
 ['Same style again','Format Painter (Ctrl+Shift+C): pick up the look of one markup and click others to give them the same look.'],
 ['Colors','Click any color box to pick from the color list. Your recent colors are kept there too.'],
 ['Properties toolbar','Select a markup and the bar under the menus shows its color, fill, opacity, line width and font. Alt+P opens the full Properties panel.'],
 ['Select many','Drag a box with the Select tool (V) to pick many markups. Shift+O draws a lasso around them.'],
 ['Line them up','Select several markups, then use Edit > Align (Ctrl+Alt+L, R, T, B) to line them up.'],
 ['Lock it down','Ctrl+Shift+L locks a markup so it cannot be moved by mistake.'],
 ['Group markups','Ctrl+G groups markups so they move together. Ctrl+Shift+G ungroups them.'],
 ['Split screen','Ctrl+2 splits side by side and Ctrl+3 splits top / bottom. Click into a pane and split again to compare more sheets. Ctrl+Shift+2 closes the split.'],
 ['Keep panes together','Turn on Sync in the bottom bar and the split panes scroll and zoom together.'],
 ['Jump to a sheet','Type a sheet name like A-101 in the page box at the bottom to go straight to it.'],
 ['Back where you were','Alt+Left goes back to where you were before a jump. Alt+Right goes forward again.'],
 ['Fit the page','Ctrl+9 fits the whole page. Ctrl+0 fits the width. Z zooms to a box you drag.'],
 ['Find text','Alt+1 opens Search, which finds words on every page. Scanned sheets can be made searchable with Document > OCR.'],
 ['Pick up text','Select Text (Shift+Alt+T) copies text from the drawing, and from markups too.'],
 ['Look it up','Select some text with Select Text, right-click it and choose Search Google.'],
 ['Hide panels you don\'t use','Right-click any icon on the left strip, or use Window > Show / hide panels.'],
 ['More room','Shift+F4 hides every panel at once. F11 is full screen.'],
 ['Light or dark','PlanMark > Preferences (Ctrl+K) switches between the dark and the light look.'],
 ['Rotate the view','Ctrl+Shift+= turns the view clockwise. The page itself is not changed.'],
 ['Pages','Thumbnails (Alt+T): drag pages to reorder them, and right-click a page for more page options.'],
 ['Clouds for changes','Cloud (C) marks revisions. Cloud+ (K) draws a cloud and a revision tag in one go.'],
 ['Stamps','Stamp (S) adds APPROVED, REVISE & RESUBMIT, FOR CONSTRUCTION and more, or your own text.'],
 ['Snapshot','Snapshot (G) copies part of a sheet so you can paste it onto another page.'],
 ['Save','Ctrl+S saves the same file with markups still editable. Ctrl+Shift+M saves a flattened copy to send out.'],
 ['Undo anything','Ctrl+Z undoes and Ctrl+Y redoes. Alt+H shows the full undo history.'],
 ['All the shortcuts','Help > Keyboard shortcuts lists every key. PlanMark > Keyboard shortcuts lets you change them.'],
];
const LSK='pm:tips',NK='pm:tipN';
const tipsOn=()=>{let v=null;try{v=localStorage.getItem(LSK)}catch(e){}return!(v==='off'||v==='"off"')};const setOn=on=>{try{localStorage.setItem(LSK,on?'on':'off')}catch(e){}};
const css=document.createElement('style');css.textContent=`#pmTip{position:absolute;top:12px;right:14px;z-index:31;width:330px;max-width:calc(100% - 28px);background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.4);padding:12px 14px 10px;font-size:12.5px;line-height:1.5}
#pmTip .h{display:flex;align-items:center;gap:7px;margin-bottom:4px}#pmTip .h b{font-size:13px}#pmTip .h .n{margin-left:auto;color:var(--mut);font-size:11px}
#pmTip .x{background:none;border:0;color:var(--mut);cursor:pointer;font-size:15px;padding:0 2px;line-height:1}#pmTip .x:hover{color:var(--text)}
#pmTip .f{display:flex;align-items:center;gap:8px;margin-top:10px}#pmTip .f label{display:flex;align-items:center;gap:5px;color:var(--mut);font-size:11.5px;margin-right:auto;cursor:pointer}
#pmTip .btn{height:26px;padding:0 10px}`;document.head.appendChild(css);
const bulb='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f5c542" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>';
let i=0,timer=0;
function hide(){const t=document.getElementById('pmTip');if(t)t.remove();clearTimeout(timer)}
function render(t){const[h,b]=TIPS[i%TIPS.length];t.innerHTML=`<div class="h">${bulb}<b>${esc(h)}</b><span class="n">Tip ${i%TIPS.length+1} of ${TIPS.length}</span><button class="x" data-a="x" title="Close">✕</button></div><div>${esc(b)}</div>
 <div class="f"><label><input type="checkbox" data-a="on" ${tipsOn()?'checked':''}> Show a tip when PlanMark opens</label><button class="btn" data-a="next">Next tip</button></div>`}
function show(n){hide();if(typeof n==='number')i=n;const host=document.getElementById('mainPane')||document.getElementById('viewWrap')||document.body;const t=document.createElement('div');t.id='pmTip';render(t);host.appendChild(t);
 LS.set(NK,(i+1)%TIPS.length);
 // it goes away on its own after a while, unless the mouse is on it
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(t.isConnected&&!t.matches(':hover'))hide()},30000)};arm();t.addEventListener('mouseleave',arm);
 t.onclick=e=>{const a=e.target.closest('[data-a]');if(!a)return;const k=a.dataset.a;
  if(k==='x')hide();else if(k==='next'){i=(i+1)%TIPS.length;LS.set(NK,(i+1)%TIPS.length);render(t);arm()}
  else if(k==='on')setOn(a.checked)}}
// at start: after the app is up, and after any "What's new" note has gone
function atStart(){if(!tipsOn()||window.PM_FIRST_RUN)return;   // a brand-new person gets the start screen first, tips from the next time
 i=+LS.get(NK,0)||0;let n=0;const go=()=>{if(document.getElementById('wsBanner')||document.querySelector('#modalBg.on')){if(++n<90)setTimeout(go,1000);return}show()};setTimeout(go,1500)}
H.ready.push(atStart);
window.PM_EXTRA_SYNC_KEYS_TIPS=[LSK,NK];
window.PM_EXTRA_CMDS_TIPS=()=>[{id:'tips:show',menu:'Help',label:'Tip of the day',key:'',run:()=>show()}];
window.PMTips={show,hide,TIPS};
})();
