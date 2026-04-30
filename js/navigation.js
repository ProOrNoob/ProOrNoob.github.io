'use strict';
var btnPrev = $('btnPrev');
var btnNext = $('btnNext');
function updateNavButtons() {
var idx = SUTRA_ORDER.indexOf(currentSutraId);
var navTitle = $('navTitle');
if (!currentSutraId || !Array.isArray(SUTRA_ORDER) || !SUTRA_ORDER.length || idx === -1) {
if (btnPrev)  btnPrev.disabled  = true;
if (btnNext)  btnNext.disabled  = true;
if (navTitle) navTitle.textContent = '—';
return;
}
if (btnPrev) btnPrev.disabled = !(idx > 0);
if (btnNext) btnNext.disabled = !(idx < SUTRA_ORDER.length - 1);
if (navTitle) {
var meta  = findMetaById(currentSutraId);
var shortCode = extractGroupKey(meta && meta.code);
var title = uiLang === 'en'
? (meta && meta.titleEn) || (meta && meta.titleVi) || (meta && meta.titlePali) || currentSutraId
: (meta && meta.titleVi) || (meta && meta.titleEn) || (meta && meta.titlePali) || currentSutraId;
navTitle.textContent = shortCode ? (shortCode + ' · ' + title) : title;
navTitle.style.cursor = 'pointer';
navTitle.setAttribute('role', 'button');
navTitle.setAttribute('title', (meta && meta.code ? meta.code + ' · ' : '') + title);
}
}
function revealCurrentSuttaInMenu() {
if (!currentSutraId || !sutraMenuPanel || !sutraMenuList) return;
togglePanel(settingsPanel, false);
var nikOfCurrent = findNikayaOfSutta(currentSutraId);
if (nikOfCurrent && nikOfCurrent !== activeNikayaKey) {
setActiveNikaya(nikOfCurrent, true);
}
togglePanel(sutraMenuPanel, true);
setTimeout(function () {
var link = sutraMenuList.querySelector('.menu-sutta-link[data-id="' + safeCssEscape(currentSutraId) + '"]');
if (!link) return;
var node = link.parentElement;
while (node && node !== sutraMenuList) {
if (node.classList && node.classList.contains('menu-list') && node.classList.contains('collapsed')) {
node.classList.remove('collapsed');
var panelId = node.id;
if (panelId) {
var toggle = sutraMenuList.querySelector('.menu-toggle[data-target="' + panelId + '"]');
if (toggle) {
toggle.setAttribute('aria-expanded', 'true');
var chev = toggle.querySelector('.chevron');
if (chev) chev.textContent = '▾';
}
}
}
node = node.parentElement;
}
try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { link.scrollIntoView(); }
}, 240);
}
var navTitleEl = $('navTitle');
if (navTitleEl) {
navTitleEl.setAttribute('tabindex', '0');
navTitleEl.addEventListener('click', function (e) {
e.stopPropagation();
if (currentSutraId) revealCurrentSuttaInMenu();
});
navTitleEl.addEventListener('keydown', function (e) {
if ((e.key === 'Enter' || e.key === ' ') && currentSutraId) {
e.preventDefault();
revealCurrentSuttaInMenu();
}
});
}
function _blurIfMouse(btn) {
try { if (!btn.matches(':focus-visible')) btn.blur(); } catch(_){}
}
if (btnPrev) btnPrev.onclick = function () {
var idx = SUTRA_ORDER.indexOf(currentSutraId);
if (idx > 0) openSutra(SUTRA_ORDER[idx - 1]);
_blurIfMouse(btnPrev);
};
if (btnNext) btnNext.onclick = function () {
var idx = SUTRA_ORDER.indexOf(currentSutraId);
if (idx !== -1 && idx < SUTRA_ORDER.length - 1) openSutra(SUTRA_ORDER[idx + 1]);
_blurIfMouse(btnNext);
};
var synthSupported = 'speechSynthesis' in window;
function setTtsUiState(state) {
if (!btnReadTts || !btnPauseTts || !btnStopTts) return;
if (!synthSupported || isRendering) {
btnReadTts.disabled = btnPauseTts.disabled = btnStopTts.disabled = true; return;
}
if (state === 'idle')    { btnReadTts.disabled=false; btnPauseTts.disabled=true;  btnStopTts.disabled=true; }
if (state === 'playing') { btnReadTts.disabled=true;  btnPauseTts.disabled=false; btnStopTts.disabled=false; }
if (state === 'paused')  { btnReadTts.disabled=false; btnPauseTts.disabled=true;  btnStopTts.disabled=false; }
}
function clearRowHighlight() {
if (!grid) return;
var reading = grid.querySelectorAll('.sutra-row.reading');
for (var k = 0; k < reading.length; k++) reading[k].classList.remove('reading');
}
function highlightRowAt(index) {
clearRowHighlight();
if (index < 0 || index >= virtAllRows.length) return;
ensureRowRendered(index);
var row = cachedRows[index];
if (!row) return;
row.classList.add('reading');
if (!scrollEl) return;
var rootRect = scrollEl.getBoundingClientRect();
var rowRect  = row.getBoundingClientRect();
var relativeTop = rowRect.top - rootRect.top + scrollEl.scrollTop;
var viewTop = scrollEl.scrollTop, viewBottom = viewTop + scrollEl.clientHeight;
if (relativeTop < viewTop || relativeTop + rowRect.height > viewBottom) {
scrollEl.scrollTo({ top: Math.max(0, relativeTop - 20), behavior: 'auto' });
}
}
var _ttsModulePromise = null;
var _ttsApi = null;
function loadScript(src) {
return new Promise(function (resolve, reject) {
var s = document.createElement('script');
s.src = src; s.async = true;
s.onload = function () { resolve(); };
s.onerror = function (e) { reject(e); };
document.head.appendChild(s);
});
}
function ensureTTSLoaded() {
if (_ttsApi) return Promise.resolve(_ttsApi);
if (!_ttsModulePromise) {
_ttsModulePromise = loadScript('js/tts.js').then(function () {
if (!window.TTSModule) throw new Error('TTSModule failed to load');
_ttsApi = window.TTSModule.init({
getVirtAllRows: function () { return virtAllRows; },
getCurrentSutraId: function () { return currentSutraId; },
getUiLang: function () { return uiLang; },
getIsRendering: function () { return isRendering; },
clearRowHighlight: clearRowHighlight,
highlightRowAt: highlightRowAt,
setTtsUiState: setTtsUiState,
storage: storage,
});
return _ttsApi;
});
}
return _ttsModulePromise;
}
function resetTts(clearHighlight, clearStorage) {
if (synthSupported && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch(e){} }
if (_ttsApi) { try { _ttsApi.reset(clearHighlight, clearStorage); return; } catch(e){} }
if (clearHighlight) clearRowHighlight();
if (clearStorage && currentSutraId) storage.remove('tts_state_' + currentSutraId);
setTtsUiState('idle');
}
if (btnReadTts) btnReadTts.onclick = async function () {
try { var api = await ensureTTSLoaded(); api.start(); } catch (e) { console.error('TTS load failed:', e); }
};
if (btnPauseTts) btnPauseTts.onclick = function () { if (_ttsApi) _ttsApi.pause(); };
if (btnStopTts)  btnStopTts.onclick  = function () { if (_ttsApi) _ttsApi.stop(); };
function initUiLang() {
renderUiLangFlag(); applyUiLanguageToSearchUi(); applyUiLanguageToSettingsPanel(); renderGuideDialog();
if (!btnUiLang) return;
btnUiLang.addEventListener('click', function (e) {
e.stopPropagation();
uiLang = uiLang === 'vi' ? 'en' : 'vi';
storage.set(LANG_STORAGE_KEY, uiLang); window.SUTRA_UI_LANG = uiLang;
renderUiLangFlag(); applyUiLanguageToSearchUi(); applyUiLanguageToSettingsPanel(); renderGuideDialog();
buildSutraMenuFromIndex(); highlightActiveInMenu(); updateNavButtons();
updateBookmarksCount(); applyTitleBookmarkState();
if (currentSutraId) renderSutra(currentSutraId); else renderWelcomeScreen();
});
}
