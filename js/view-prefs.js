'use strict';
var show3Cols = false;      // bố cục 3 cột bằng nhau (thay vì Pali trên, Eng+Việt dưới)
var paragraphBreak = true;  // luôn ON — paragraph đều đặn
var PARAGRAPH_BREAK_LEN = 5;
function saveViewPrefs() {
storage.set(KEY_VIEW, JSON.stringify({
showPali: showPali, showEng: showEng, showVie: showVie,
stack: card ? card.classList.contains('stack') : false,
showSegKey: showSegKey, showColHdr: showColHdr,
showCmtPli: showCmtPli, showCmtEng: showCmtEng, showCmtVie: showCmtVie,
hlPli: hlPli, hlEng: hlEng, hlVie: hlVie,
show3Cols: show3Cols
}));
}
function loadViewPrefs() {
try {
var raw = storage.get(KEY_VIEW);
if (!raw) return;
var v = JSON.parse(raw);
if (typeof v.showPali === 'boolean') showPali = v.showPali;
if (typeof v.showEng  === 'boolean') showEng  = v.showEng;
if (typeof v.showVie  === 'boolean') showVie  = v.showVie;
if (card && typeof v.stack === 'boolean') card.classList.toggle('stack', v.stack);
if (typeof v.showSegKey === 'boolean') showSegKey = v.showSegKey;
if (typeof v.showColHdr === 'boolean') showColHdr = v.showColHdr;
if (typeof v.showCmtPli === 'boolean') showCmtPli = v.showCmtPli;
if (typeof v.showCmtEng === 'boolean') showCmtEng = v.showCmtEng;
if (typeof v.showCmtVie === 'boolean') showCmtVie = v.showCmtVie;
if (typeof v.hlPli === 'boolean') hlPli = v.hlPli;
if (typeof v.hlEng === 'boolean') hlEng = v.hlEng;
if (typeof v.hlVie === 'boolean') hlVie = v.hlVie;
if (typeof v.show3Cols === 'boolean') show3Cols = v.show3Cols;
} catch(e){}
}
function applySegKeyHdrVis() {
if (!grid) return;
grid.classList.toggle('hide-seg-key', !showSegKey);
grid.classList.toggle('hide-col-header', !showColHdr);
grid.classList.toggle('hide-cmt-pli', !showCmtPli);
grid.classList.toggle('hide-cmt-eng', !showCmtEng);
grid.classList.toggle('hide-cmt-vie', !showCmtVie);
grid.classList.toggle('hl-pli', !!hlPli);
grid.classList.toggle('hl-eng', !!hlEng);
grid.classList.toggle('hl-vie', !!hlVie);
if (card) card.classList.toggle('grid-3cols', !!show3Cols);
}
var mql = window.matchMedia('(max-width: 500px)');
function updateVisibleCols() {
const isNarrow = mql.matches;
const isStack = card?.classList.contains('stack') || false;
let count = (showPali ? 1 : 0) + (showEng ? 1 : 0) + (showVie ? 1 : 0);
count = Math.max(1, count);
requestAnimationFrame(() => {
document.documentElement.style.setProperty('--visible-cols', isNarrow || isStack ? '1' : String(count));
});
}
mql.addEventListener('change', updateVisibleCols);
function applyVisibility() {
if (!grid) return;
grid.classList.toggle('hide-pali', !showPali);
grid.classList.toggle('hide-eng',  !showEng);
grid.classList.toggle('hide-vie',  !showVie);
updateVisibleCols();
}
window.addEventListener('resize', function () { updateVisibleCols(); updateMenuPanelTop(); });
// Khi ẩn 1 ngôn ngữ → tắt Highlight + Commentary của ngôn ngữ đó (đồng bộ),
// nhưng nhớ trạng thái cũ vào _langDepsBackup để khôi phục khi hiện lại.
var _langDepsBackup = { pli: null, eng: null, vie: null };
function _applyHlBtnUi(lang) {
var on = lang === 'pli' ? hlPli : lang === 'eng' ? hlEng : hlVie;
var id = lang === 'pli' ? 'btnHlPli' : lang === 'eng' ? 'btnHlEng' : 'btnHlVie';
var b = $(id);
if (b) { b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', String(!!on)); }
}
function _syncDepsOnLangHide(lang) {
if (lang === 'pli') {
_langDepsBackup.pli = { hl: hlPli, cmt: showCmtPli };
hlPli = false; showCmtPli = false;
} else if (lang === 'eng') {
_langDepsBackup.eng = { hl: hlEng, cmt: showCmtEng };
hlEng = false; showCmtEng = false;
} else if (lang === 'vie') {
_langDepsBackup.vie = { hl: hlVie, cmt: showCmtVie };
hlVie = false; showCmtVie = false;
}
_applyHlBtnUi(lang);
syncCmtButtons();
applySegKeyHdrVis();
}
function _syncDepsOnLangShow(lang) {
var bak = _langDepsBackup[lang];
if (!bak) return;  // không có backup → giữ nguyên (false)
if (lang === 'pli')      { hlPli = !!bak.hl; showCmtPli = !!bak.cmt; }
else if (lang === 'eng') { hlEng = !!bak.hl; showCmtEng = !!bak.cmt; }
else if (lang === 'vie') { hlVie = !!bak.hl; showCmtVie = !!bak.cmt; }
_langDepsBackup[lang] = null;
_applyHlBtnUi(lang);
syncCmtButtons();
applySegKeyHdrVis();
}
if (btnPali) btnPali.onclick = function () {
if (showPali && (showEng || showVie)) { /* will set false */ }
else if (!showPali) { /* will set true */ }
else { return; }
preserveTopAndSave(function () {
showPali = !showPali;
btnPali.classList.toggle('active', showPali);
btnPali.setAttribute('aria-pressed', String(showPali));
if (!showPali) _syncDepsOnLangHide('pli'); else _syncDepsOnLangShow('pli');
applyVisibility(); saveViewPrefs(); maybeRerenderIfModeChanged();
});
};
if (btnEng) btnEng.onclick = function () {
if (showEng && (showPali || showVie)) { /* will set false */ }
else if (!showEng) { /* will set true */ }
else { return; }
preserveTopAndSave(function () {
showEng = !showEng;
btnEng.classList.toggle('active', showEng);
btnEng.setAttribute('aria-pressed', String(showEng));
if (!showEng) _syncDepsOnLangHide('eng'); else _syncDepsOnLangShow('eng');
applyVisibility(); saveViewPrefs(); maybeRerenderIfModeChanged();
});
};
if (btnVie) btnVie.onclick = function () {
if (showVie && (showPali || showEng)) { /* will set false */ }
else if (!showVie) { /* will set true */ }
else { return; }
preserveTopAndSave(function () {
showVie = !showVie;
btnVie.classList.toggle('active', showVie);
btnVie.setAttribute('aria-pressed', String(showVie));
if (!showVie) _syncDepsOnLangHide('vie'); else _syncDepsOnLangShow('vie');
applyVisibility(); saveViewPrefs(); maybeRerenderIfModeChanged();
});
};
if (btnLayout) btnLayout.onclick = function () {
preserveTopAndSave(function () {
if (card) card.classList.toggle('stack');
var isStack = card ? card.classList.contains('stack') : false;
btnLayout.classList.toggle('active', isStack);
btnLayout.setAttribute('aria-pressed', String(isStack));
if (isStack && show3Cols) {
show3Cols = false;
if (card) card.classList.remove('grid-3cols');
var _b3c = $('btn3Cols');
if (_b3c) { _b3c.classList.remove('active'); _b3c.setAttribute('aria-pressed', 'false'); }
}
updateVisibleCols(); saveViewPrefs();
});
};
var btnSegKey = $('btnSegKey');
if (btnSegKey) btnSegKey.onclick = function () {
preserveTopAndSave(function () {
showSegKey = !showSegKey;
btnSegKey.classList.toggle('active', showSegKey);
btnSegKey.setAttribute('aria-pressed', String(showSegKey));
applySegKeyHdrVis();
saveViewPrefs();
});
};
var btnSegHdr = $('btnSegHdr');
if (btnSegHdr) btnSegHdr.onclick = function () {
preserveTopAndSave(function () {
showColHdr = !showColHdr;
btnSegHdr.classList.toggle('active', showColHdr);
btnSegHdr.setAttribute('aria-pressed', String(showColHdr));
applySegKeyHdrVis();
saveViewPrefs();
});
};
function anyCmtOn() { return showCmtPli || showCmtEng || showCmtVie; }
function syncCmtButtons() {
var pairs = [['btnCmtPli', showCmtPli], ['btnCmtEng', showCmtEng], ['btnCmtVie', showCmtVie]];
for (var i = 0; i < pairs.length; i++) {
var b = $(pairs[i][0]); if (!b) continue;
b.classList.toggle('active', pairs[i][1]);
b.setAttribute('aria-pressed', String(pairs[i][1]));
}
var m = $('btnCmtMaster');
if (m) {
var any = anyCmtOn();
m.classList.toggle('active', any);
m.setAttribute('aria-pressed', String(any));
}
}
function wireLangCmt(btnId, setter) {
var btn = $(btnId); if (!btn) return;
btn.onclick = function () {
preserveTopAndSave(function () {
setter();
syncCmtButtons();
applySegKeyHdrVis();
saveViewPrefs();
});
};
}
wireLangCmt('btnCmtPli', function(){ showCmtPli = !showCmtPli; });
wireLangCmt('btnCmtEng', function(){ showCmtEng = !showCmtEng; });
wireLangCmt('btnCmtVie', function(){ showCmtVie = !showCmtVie; });
var btnCmtMaster = $('btnCmtMaster');
if (btnCmtMaster) btnCmtMaster.onclick = function () {
preserveTopAndSave(function () {
var target = !anyCmtOn();
showCmtPli = target; showCmtEng = target; showCmtVie = target;
syncCmtButtons();
applySegKeyHdrVis();
saveViewPrefs();
});
};
function wireHlToggle(btnId, setter) {
var btn = $(btnId); if (!btn) return;
btn.onclick = function () {
preserveTopAndSave(function () {
setter();
applySegKeyHdrVis();
var active = (btnId === 'btnHlPli') ? hlPli : (btnId === 'btnHlEng') ? hlEng : hlVie;
btn.classList.toggle('active', active);
btn.setAttribute('aria-pressed', String(active));
saveViewPrefs();
});
};
}
wireHlToggle('btnHlPli', function(){ hlPli = !hlPli; });
wireHlToggle('btnHlEng', function(){ hlEng = !hlEng; });
wireHlToggle('btnHlVie', function(){ hlVie = !hlVie; });
var btn3Cols = $('btn3Cols');
if (btn3Cols) btn3Cols.onclick = function () {
preserveTopAndSave(function () {
show3Cols = !show3Cols;
btn3Cols.classList.toggle('active', show3Cols);
btn3Cols.setAttribute('aria-pressed', String(show3Cols));
if (card) card.classList.toggle('grid-3cols', show3Cols);
if (show3Cols && card && card.classList.contains('stack')) {
card.classList.remove('stack');
if (btnLayout) { btnLayout.classList.remove('active'); btnLayout.setAttribute('aria-pressed', 'false'); }
}
updateVisibleCols();
saveViewPrefs();
});
};
function applyWideLayout(on) {
isWide = !!on;
document.documentElement.classList.toggle('layout-wide', isWide);
if (btnFullWidth) {
btnFullWidth.classList.toggle('active', isWide);
btnFullWidth.setAttribute('aria-pressed', String(isWide));
}
}
if (btnFullWidth) {
applyWideLayout(isWide);
btnFullWidth.addEventListener('click', function () {
applyWideLayout(!isWide);
storage.set(WIDE_STORAGE_KEY, isWide ? '1' : '0');
});
}
var ZOOM_STORAGE_KEY = 'sutra_zoom';
var LH_STORAGE_KEY   = 'sutra_line_height';
var MIN_ZOOM=0.8, MAX_ZOOM=1.6, MIN_LH=1.3, MAX_LH=2.6;
var zoomLevel=1, lineHeightLevel=1.85;
var sliderZoom       = $('sliderZoom');
var sliderLineHeight = $('sliderLineHeight');
var zoomBadge        = $('zoomValueBadge');
var lhBadge          = $('lineHeightValueBadge');
var btnZoomReset     = $('btnZoomReset');
var btnLhReset       = $('btnLineHeightReset');
function clampZoom(z) { return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)); }
function clampLh(v)   { return Math.max(MIN_LH,   Math.min(MAX_LH, v)); }
function updateSliderFill(el, min, max, val) {
if (!el) return;
el.style.setProperty('--slider-pct', ((val - min) / (max - min) * 100).toFixed(1) + '%');
}
function applyZoom() {
document.documentElement.style.setProperty('--sutra-font-scale', String(zoomLevel));
var pct = Math.round(zoomLevel * 100);
if (zoomBadge) zoomBadge.textContent = pct + '%';
if (sliderZoom) { sliderZoom.value = String(pct); updateSliderFill(sliderZoom, 80, 160, pct); }
}
function applyLineHeight() {
document.documentElement.style.setProperty('--sutra-line-height', String(lineHeightLevel));
if (lhBadge) lhBadge.textContent = lineHeightLevel.toFixed(2);
if (sliderLineHeight) {
var val = Math.round(lineHeightLevel * 100);
sliderLineHeight.value = String(val);
updateSliderFill(sliderLineHeight, 130, 260, val);
}
}
function loadZoom() {
var s = storage.get(ZOOM_STORAGE_KEY);
if (s) { var v = parseFloat(s); if (!Number.isNaN(v)) zoomLevel = clampZoom(v); }
applyZoom();
}
function loadLineHeight() {
var s = storage.get(LH_STORAGE_KEY);
if (s) { var v = parseFloat(s); if (!Number.isNaN(v)) lineHeightLevel = clampLh(v); }
applyLineHeight();
}
function saveZoom()       { storage.set(ZOOM_STORAGE_KEY, String(zoomLevel)); }
function saveLineHeight() { storage.set(LH_STORAGE_KEY, String(lineHeightLevel)); }
if (sliderZoom) sliderZoom.addEventListener('input', function () {
zoomLevel = clampZoom(parseInt(sliderZoom.value, 10) / 100); applyZoom(); saveZoom();
});
if (sliderLineHeight) sliderLineHeight.addEventListener('input', function () {
lineHeightLevel = clampLh(parseInt(sliderLineHeight.value, 10) / 100); applyLineHeight(); saveLineHeight();
});
if (btnZoomReset) btnZoomReset.onclick = function () { zoomLevel = 1; applyZoom(); saveZoom(); };
if (btnLhReset)   btnLhReset.onclick   = function () { lineHeightLevel = 1.85; applyLineHeight(); saveLineHeight(); };
/* Reading progress toggle — persist via localStorage */
