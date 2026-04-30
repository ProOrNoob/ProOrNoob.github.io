'use strict';
function init() {
if (!grid || !titleEl || !subtitleEl || !card) console.warn('Sutta app: core DOM missing.');
initUiLang(); loadViewPrefs();
if (btnPali) { btnPali.classList.toggle('active', showPali); btnPali.setAttribute('aria-pressed', String(showPali)); }
if (btnEng)  { btnEng.classList.toggle('active',  showEng);  btnEng.setAttribute('aria-pressed',  String(showEng)); }
if (btnVie)  { btnVie.classList.toggle('active',  showVie);  btnVie.setAttribute('aria-pressed',  String(showVie)); }
if (btnLayout) { btnLayout.classList.toggle('active', card ? card.classList.contains('stack') : false); }
var _bsk = $('btnSegKey'); if (_bsk) { _bsk.classList.toggle('active', showSegKey); _bsk.setAttribute('aria-pressed', String(showSegKey)); }
var _bsh = $('btnSegHdr'); if (_bsh) { _bsh.classList.toggle('active', showColHdr); _bsh.setAttribute('aria-pressed', String(showColHdr)); }
syncCmtButtons();
var _bhp = $('btnHlPli'); if (_bhp) { _bhp.classList.toggle('active', hlPli); _bhp.setAttribute('aria-pressed', String(hlPli)); }
var _bhe = $('btnHlEng'); if (_bhe) { _bhe.classList.toggle('active', hlEng); _bhe.setAttribute('aria-pressed', String(hlEng)); }
var _bhv = $('btnHlVie'); if (_bhv) { _bhv.classList.toggle('active', hlVie); _bhv.setAttribute('aria-pressed', String(hlVie)); }
var _b3c = $('btn3Cols'); if (_b3c) { _b3c.classList.toggle('active', show3Cols); _b3c.setAttribute('aria-pressed', String(show3Cols)); }
loadBookmarks();
applyVisibility(); applySegKeyHdrVis(); loadZoom(); loadLineHeight(); buildSutraMenuFromIndex(); initDelegations();
updateBookmarksCount();
var startId = storage.get(KEY_LAST);
var _bootHash = _parseAnchorHash();
if (_bootHash && _bootHash.sutta) startId = _bootHash.sutta;
if (startId) openSutra(startId); else renderWelcomeScreen();
window.addEventListener('hashchange', function () {
var h = _parseAnchorHash();
if (!h) return;
if (h.sutta !== currentSutraId) openSutra(h.sutta);
else restoreScrollByAnchor(currentSutraId);
});
if (!synthSupported) {
[btnReadTts, btnPauseTts, btnStopTts].forEach(function (b) { if (b) b.disabled = true; });
} else {
setTtsUiState('idle');
}
updateMenuPanelTop();
initDebugPanel();
// Touch device: sau khi tap vào button/link, focus + active state stick → shadow/highlight
// kẹt cho tới khi user tap chỗ khác. Listen pointerup với pointerType='touch' và blur
// ngay (chỉ khi không phải keyboard focus) để clear sticky shadow.
document.addEventListener('pointerup', function (e) {
if (e.pointerType !== 'touch') return;
var t = e.target.closest('button, a');
if (!t) return;
try { if (!t.matches(':focus-visible')) t.blur(); } catch(_) {}
}, { passive: true, capture: true });
}
init();
