/* Light mode for the whole app, matching the Olympia portal's light theme (white surfaces, soft grey lines,
   near-black text). Many PlanMark modules carry their own dark colours in their style sheets, so instead of
   repeating every rule this reads the app's style sheets and writes a light version of each grey colour,
   under body.light. Coloured highlights become light tints; the drawing itself is never touched. */
(function(){
const VARS='body.light,body.light.dl{--bg:#f6f6f7;--panel:#ffffff;--panel2:#f3f2f2;--line:#dedee0;--text:#1e1f21;--mut:#5e5f61;--accbg:#dbe8ff;--canvas:#c9ccd1;color-scheme:light}'
 +'body.light ::-webkit-scrollbar-thumb{background:#c4c6ca}body.light ::-webkit-scrollbar-track{background:transparent}'
 +'body.light select option{background:#fff;color:#1e1f21}';
// parts that stay as they are in both themes (pop-up notices, the magnifier, colour swatches, the drawing)
const KEEP=/#toast|#loupe|tooltip|\.tip\b|#d3Ro|\.sw\b|swatch|\.page\b|\.ov\b|canvas|#pmGate .logo/i;
const cx=document.createElement('canvas').getContext('2d');
function rgba(v){v=(v||'').trim();if(!v||/var\(|gradient|url\(|inherit|initial|currentcolor|transparent|none/i.test(v))return null;
 cx.fillStyle='#010203';cx.fillStyle=v;let s=cx.fillStyle;if(s==='#010203'&&!/^#010203$/i.test(v))return null;
 if(s[0]==='#')return[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16),1];
 const m=s.match(/[\d.]+/g);return m?m.map(Number):null}
const lum=c=>(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255,sat=c=>Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]);
const css=(c,a)=>`rgba(${c.map(x=>Math.round(Math.max(0,Math.min(255,x)))).join(',')},${a})`,grey=l=>{const v=l*255;return[v,v,v+1]};
function mapBg(c){const a=c[3]??1,L=lum(c);if(L>=.5||a<.04)return null;
 if(sat(c)<28)return css(grey(1-L*.32),a);           // dark grey panel -> white / soft grey, keeping the steps between shades
 return css(c.slice(0,3).map(x=>x*.2+255*.8),a)}      // dark coloured fill (selected button...) -> light tint
function mapText(c){const a=c[3]??1,L=lum(c);if(L<=.55)return null;
 if(sat(c)<28)return css(grey(Math.max(.1,(1-L)*.95)),a);// light grey text -> near-black / mid grey
 if(L<.8&&sat(c)>120)return null;                       // strong colours (red warnings, blue links) read fine on white
 return css(c.slice(0,3).map(x=>x*.55),a)}             // pale coloured text -> deeper shade of the same colour
function mapLine(c){const a=c[3]??1,L=lum(c);if(L>=.5)return null;return sat(c)<28?css(grey(.87-L*.1),a):css(c.slice(0,3).map(x=>x*.45+255*.55),a)}
const PROPS={'background-color':mapBg,'background':mapBg,'color':mapText,'border-color':mapLine,'border-top-color':mapLine,'border-bottom-color':mapLine,'border-left-color':mapLine,'border-right-color':mapLine,'outline-color':mapLine};
function pre(sel){return sel.split(',').map(s=>{s=s.trim();if(!s||/^(html|:root)/.test(s)||/body\.light/.test(s))return null;
 return /^body\b/.test(s)?s.replace(/^body/,'body.light'):'body.light '+s}).filter(Boolean).join(',')}
function rules(list,out){for(const r of list){
  if(r.cssRules&&r.media){const inner=[];rules(r.cssRules,inner);if(inner.length)out.push(`@media ${r.media.mediaText}{${inner.join('')}}`);continue}
  if(!r.selectorText||!r.style||KEEP.test(r.selectorText))continue;const sel=pre(r.selectorText);if(!sel)continue;let decl='';
  for(const p in PROPS){let v=r.style.getPropertyValue(p);if(!v)continue;if(p==='background'&&!/^\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)\s*$/i.test(v))continue;
   const c=rgba(v);if(!c)continue;const n=PROPS[p](c);if(n)decl+=`${p==='background'?'background-color':p}:${n}${r.style.getPropertyPriority(p)?'!important':''};`}
  if(decl)out.push(`${sel}{${decl}}`)}}
let sheet=null,t=0;
function build(){t=0;const out=[VARS];for(const s of document.styleSheets){if(s.ownerNode===sheet)continue;let rs;try{rs=s.cssRules}catch(e){continue}if(rs)rules(rs,out)}
 if(!sheet){sheet=document.createElement('style');sheet.id='pmLight'}sheet.textContent=out.join('\n');document.head.appendChild(sheet)}
const later=()=>{if(!t)t=setTimeout(build,60)};
build();new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n!==sheet&&(n.tagName==='STYLE'||n.tagName==='LINK'))))later()}).observe(document.head,{childList:true});
addEventListener('load',later);window.PMLight={rebuild:build};
})();
