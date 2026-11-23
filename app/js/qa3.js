// qa3.js — measurement & takeoff fixes from QA sweep 3. Loaded after sharp.js.
(function(){
'use strict';
// 1) After calibrating, name the scale the way it is printed on the drawing when it matches a standard one
//    (Bluebeam shows 1/4" = 1'-0", not "Custom 1:48"). Anything else reads like 1" = 4'-2 1/2".
function niceScaleLabel(perPt, unit){
  const ratio = perPt / PT_M, close = (a, b) => Math.abs(a - b) / b < 0.002;
  const metric = unit && UNITS[unit] && !['ftin', 'in', 'ft', 'yd', 'mi'].includes(unit);
  if (!metric) {
    for (const [l, v] of ARCH) if (close(ratio, 12 / v)) return `${l}" = 1'-0"`;
    for (const n of ENG) if (close(ratio, 12 * n)) return `1" = ${n}'`;
  }
  for (const n of METRIC) if (close(ratio, n)) return '1:' + n;
  if (close(ratio, 1)) return '1:1';
  if (metric) return '1:' + (ratio >= 10 ? Math.round(ratio) : ratio.toFixed(2));
  return '1" = ' + fmtFtIn(ratio, 16);
}
window.niceScaleLabel = niceScaleLabel;
const isCustom = l => typeof l === 'string' && /^Custom 1:/.test(l);
function relabel(sc){ if (sc && isCustom(sc.label) && sc.perPt > 0) sc.label = niceScaleLabel(sc.perPt, sc.unit); }
const _apply = applyScale;
applyScale = function(sc, md, page){ relabel(sc); return _apply.apply(this, arguments); };
const _save = saveScales;
saveScales = function(){
  try {
    for (const k in S.scales) { if (k !== 'vp') relabel(S.scales[k]); }
    if (S.scales.vp) for (const pg in S.scales.vp) for (const v of S.scales.vp[pg] || []) relabel(v.scale);
  } catch (e) {}
  return _save.apply(this, arguments);
};
// 2) The magnifier is see-through for the mouse: markups copied into it no longer swallow clicks under the cursor.
{ const st = document.createElement('style'); st.textContent = '#loupe,#loupe *{pointer-events:none!important}'; document.head.appendChild(st); }
const _usb = updateScaleBtn;
updateScaleBtn = function(){ try { relabel(scaleFor(S.cur)); } catch (e) {} return _usb.apply(this, arguments); };
})();
