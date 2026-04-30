'use strict';
(function _wireProgressToggle() {
var btn = $('btnProgressToggle');
if (!btn) return;
var KEY = 'sutra_show_progress';
function apply(on) {
document.documentElement.classList.toggle('hide-reading-progress', !on);
btn.setAttribute('aria-pressed', String(!!on));
btn.classList.toggle('active', !!on);
}
var saved = null;
try { saved = storage.get(KEY); } catch(_){}
var isOn = saved !== '0';  // default ON
apply(isOn);
btn.addEventListener('click', function () {
isOn = !isOn;
apply(isOn);
try { storage.set(KEY, isOn ? '1' : '0'); } catch(_){}
if (isOn) try { updateReadingProgress(); } catch(_){}
});
})();
var anchorObserver = null;
var firstVisibleKey = null;
var firstVisibleOffsetFromGrid = 0;
var vaggaMarkers = [];
var suttaMarkers = [];
var keyToRowIdx = Object.create(null);
var isAN = false;
var isSN = false;
var fallbackTitle = '';
var fallbackTitleMeta = '';
var superLastSlotEl = null;
var lastAppliedVaggaIdx = -2;
var lastAppliedSuttaIdx = -2;
function getScrollRoot() {
return readerArea || grid;
}
function findActiveMarkerIdx(markers, curIdx) {
var idx = -1;
for (var v = 0; v < markers.length; v++) {
if (markers[v].rowIdx <= curIdx) idx = v;
else break;
}
return idx;
}
function pickPrimaryByLang(marker) {
return uiLang === 'en'
? (marker.titleEn || marker.titlePali || marker.titleVi || '').trim()
: (marker.titleVi || marker.titleEn || marker.titlePali || '').trim();
}
function pickAltByLang(marker) {
return uiLang === 'en'
? (marker.titleVi || marker.titlePali || '').trim()
: (marker.titleEn || marker.titlePali || '').trim();
}
function updateDynamicTitles() {
if (!isAN && !isSN) return;
var curIdx = firstVisibleKey ? (keyToRowIdx[firstVisibleKey]) : undefined;
if (curIdx === undefined) curIdx = -1;
if (isAN) {
var anIdx = findActiveMarkerIdx(vaggaMarkers, curIdx);
if (anIdx !== lastAppliedSuttaIdx) {
if (anIdx < 0) {
if (titleEl) titleEl.textContent = fallbackTitle;
if (titleMetaEl) titleMetaEl.textContent = fallbackTitleMeta;
} else {
var vmA = vaggaMarkers[anIdx];
if (titleEl) titleEl.textContent = pickPrimaryByLang(vmA) || fallbackTitle;
if (titleMetaEl) titleMetaEl.textContent = pickAltByLang(vmA) || fallbackTitleMeta;
}
lastAppliedSuttaIdx = anIdx;
}
return;
}
// SN: vagga appended AFTER Saṁyutta (not replacing) — sub-sutta drives h1 + titleMeta
var vIdx = findActiveMarkerIdx(vaggaMarkers, curIdx);
if (vIdx !== lastAppliedVaggaIdx && superLastSlotEl) {
var vaggaText = vIdx < 0 ? '' : (pickPrimaryByLang(vaggaMarkers[vIdx]) || '');
superLastSlotEl.textContent = vaggaText;
if (superLastSlotEl._sep) superLastSlotEl._sep.style.display = vaggaText ? '' : 'none';
lastAppliedVaggaIdx = vIdx;
}
var sIdx = findActiveMarkerIdx(suttaMarkers, curIdx);
if (sIdx !== lastAppliedSuttaIdx) {
if (sIdx < 0) {
if (titleEl) titleEl.textContent = fallbackTitle;
if (titleMetaEl) titleMetaEl.textContent = fallbackTitleMeta;
} else {
var sm = suttaMarkers[sIdx];
if (titleEl) titleEl.textContent = pickPrimaryByLang(sm) || fallbackTitle;
if (titleMetaEl) titleMetaEl.textContent = pickAltByLang(sm) || fallbackTitleMeta;
}
lastAppliedSuttaIdx = sIdx;
}
}
function setupAnchorObserver() {
if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
var scrollRoot = getScrollRoot();
if (!scrollRoot) return;
anchorObserver = new IntersectionObserver(function (entries) {
var topmost = null;
for (var i = 0; i < entries.length; i++) {
var entry = entries[i];
if (!entry.isIntersecting) continue;
if (!topmost || entry.boundingClientRect.top < topmost.boundingClientRect.top) topmost = entry;
}
if (topmost) {
firstVisibleKey = topmost.target.getAttribute('data-key') || '';
updateDynamicTitles();
}
}, { root: scrollRoot, rootMargin: '0px 0px -80% 0px', threshold: 0 });
scrollRoot.querySelectorAll('.sutra-row').forEach(function (r) { anchorObserver.observe(r); });
}
function computeTopVisibleKey() {
// Compute đồng bộ từ DOM — tránh lag của IntersectionObserver.
// Strict "first fully visible": row đầu tiên có top >= viewport.top.
// Matches test definition — không dùng tolerance để tránh off-by-1 mismatch.
var scrollRoot = getScrollRoot();
if (!scrollRoot) return null;
var rootRect = scrollRoot.getBoundingClientRect();
var topBoundary = rootRect.top;
var rows = scrollRoot.querySelectorAll('.sutra-row[data-key]');
for (var i = 0; i < rows.length; i++) {
var rect = rows[i].getBoundingClientRect();
if (rect.top >= topBoundary) {
return rows[i].getAttribute('data-key') || null;
}
}
// Fallback: first row with any visibility at top (only if no row fully visible)
for (var j = 0; j < rows.length; j++) {
var rect2 = rows[j].getBoundingClientRect();
if (rect2.bottom > topBoundary) {
return rows[j].getAttribute('data-key') || null;
}
}
return null;
}
var _progScrollUntil = 0; // timestamp sau đó scroll save resume
function preserveTopAndSave(action) {
var topKey = computeTopVisibleKey();
// Cancel mọi pending debounce save để không overwrite topKey mình sắp save
if (typeof _saveAnchorDebounced !== 'undefined' && _saveAnchorDebounced && _saveAnchorDebounced.cancel) {
_saveAnchorDebounced.cancel();
}
if (topKey && currentSutraId) {
_progScrollUntil = Date.now() + 800;  // suppress rộng hơn để cover reflow + correction
firstVisibleKey = topKey;
storage.set(KEY_ANCHOR_K(currentSutraId), topKey);
}
action();
if (!topKey || !currentSutraId) return;
requestAnimationFrame(function () {
var scrollRoot = getScrollRoot();
if (!scrollRoot) return;
var safeKey = safeCssEscape(topKey);
var row = scrollRoot.querySelector('.sutra-row[data-key="' + safeKey + '"]');
if (!row) return;
var tgt = row.closest('.sutra-row-wrap') || row;
var rootRect = scrollRoot.getBoundingClientRect();
var tgtRect = tgt.getBoundingClientRect();
var y = tgtRect.top - rootRect.top + scrollRoot.scrollTop;
var max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
var targetY = Math.max(0, Math.min(y, max));
if (Math.abs(targetY - scrollRoot.scrollTop) > 1) {
_progScrollUntil = Date.now() + 800;
scrollRoot.scrollTop = targetY;
}
if (_saveAnchorDebounced && _saveAnchorDebounced.cancel) _saveAnchorDebounced.cancel();
});
}
function saveScrollAnchorNow() {
if (!currentSutraId) return;
if (Date.now() < _progScrollUntil) {
if (window.DEBUG_ANCHOR) console.log('[ANCHOR SAVE] skip — programmatic scroll window');
return;
}
if (isRendering) {
if (window.DEBUG_ANCHOR) console.log('[ANCHOR SAVE] skip — isRendering=true');
return;
}
var scrollRoot = getScrollRoot();
if (!scrollRoot || scrollRoot.scrollTop === 0) {
storage.remove(KEY_ANCHOR_K(currentSutraId));
_clearAnchorHash();
if (window.DEBUG_ANCHOR) console.log('[ANCHOR SAVE] cleared (scrollTop=0) for', currentSutraId);
return;
}
// Ưu tiên cache từ IntersectionObserver (O(1)) — chỉ scan DOM khi cache trống.
// Trên file lớn (hàng nghìn rows), DOM scan + getBoundingClientRect loop là bottleneck chính.
var topKey = firstVisibleKey || computeTopVisibleKey();
if (!topKey) {
if (window.DEBUG_ANCHOR) console.log('[ANCHOR SAVE] skip — no top key computable');
return;
}
firstVisibleKey = topKey; // sync cache để updateDynamicTitles nhất quán
storage.set(KEY_ANCHOR_K(currentSutraId), topKey);
_writeAnchorHash(topKey);
if (window.DEBUG_ANCHOR) console.log('[ANCHOR SAVE]', currentSutraId, '→', topKey, 'scrollTop=' + scrollRoot.scrollTop);
}
function restoreScrollByAnchor(id) {
var scrollRoot = getScrollRoot();
if (!scrollRoot) return false;
try {
var key = getAnchorKeyFor(id);
if (window.DEBUG_ANCHOR) console.log('[ANCHOR RESTORE] id=' + id + ' key=' + key);
if (!key) return false;
var foundIdx = -1;
for (var j = 0; j < virtAllRows.length; j++) {
if (String(virtAllRows[j].key || '') === key) { foundIdx = j; break; }
}
if (foundIdx < 0) {
// Cross-mode fallback: key cụ thể không tồn tại (vd single-lang merge segments).
// Tìm paragraph row chứa hoặc gần nhất TRƯỚC anchor (largest key ≤ anchorKey).
foundIdx = findClosestPrecedingRow(key, virtAllRows);
if (window.DEBUG_ANCHOR && foundIdx >= 0) {
console.log('[ANCHOR RESTORE] cross-mode fallback to closest preceding idx=' + foundIdx + ' key=' + virtAllRows[foundIdx].key);
}
}
if (window.DEBUG_ANCHOR) console.log('[ANCHOR RESTORE] foundIdx=' + foundIdx + ' in virtAllRows.length=' + virtAllRows.length);
if (foundIdx < 0) return false;
// Sau cross-mode fallback, key thực tế của row trong DOM có thể khác key gốc.
// Phải dùng key của ROW TÌM ĐƯỢC để query DOM, không phải key gốc.
var resolvedKey = String(virtAllRows[foundIdx].key || key);
// Chỉ materialize chunk chứa anchor (eager-around-anchor đã render ±1 chunks).
// IntersectionObserver sẽ tự materialize neighbors khi user scroll. Tránh render
// hàng nghìn row sync khi anchor ở cuối file dài.
ensureRowRendered(foundIdx);
if (window.DEBUG_ANCHOR) {
var matCnt = 0;
for (var mc = 0; mc < virtChunks.length; mc++) if (virtChunks[mc].materialized) matCnt++;
console.log('[ANCHOR RESTORE] chunks materialized after ensureRowRendered: ' + matCnt + '/' + virtChunks.length + ' resolvedKey=' + resolvedKey);
}
var safeKey = safeCssEscape(resolvedKey);
var row = scrollRoot.querySelector('.sutra-row[data-key="' + safeKey + '"]');
if (window.DEBUG_ANCHOR) console.log('[ANCHOR RESTORE] DOM row found:', !!row);
if (!row) return false;
var scrollTarget = row.closest('.sutra-row-wrap') || row;
function scrollToSegmentTop(label) {
var rootRect = scrollRoot.getBoundingClientRect();
var tgtRect  = scrollTarget.getBoundingClientRect();
var y = tgtRect.top - rootRect.top + scrollRoot.scrollTop;
var max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
y = Math.max(0, Math.min(y, max));
var oldTop = scrollRoot.scrollTop;
if (Math.abs(y - oldTop) > 1) scrollRoot.scrollTop = y;
if (window.DEBUG_ANCHOR) {
console.log('[ANCHOR RESTORE ' + label + '] tgt.top=' + tgtRect.top.toFixed(0) +
' root.top=' + rootRect.top.toFixed(0) +
' relTop=' + (tgtRect.top - rootRect.top).toFixed(0) +
' targetY=' + y.toFixed(0) + ' oldScrollTop=' + oldTop + ' → newScrollTop=' + scrollRoot.scrollTop);
}
}
scrollToSegmentTop('initial');
toggleBackTop(scrollRoot.scrollTop > 0);
requestAnimationFrame(function () { requestAnimationFrame(function () {
scrollToSegmentTop('rAF-correction');
setTimeout(function () { scrollToSegmentTop('timeout-correction'); }, 100);
}); });
return true;
} catch(e) {
if (window.DEBUG_ANCHOR) console.error('[ANCHOR RESTORE] error:', e);
return false;
}
}
window.addEventListener('pagehide', function () {
saveScrollAnchorNow();
if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
teardownChunkObservers();
});
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') saveScrollAnchorNow();
});
var suppressBackTop = false;
