'use strict';
/* ============================================================
Single-language helpers
============================================================ */
function getSingleVisibleLang() {
var count = (showPali?1:0) + (showEng?1:0) + (showVie?1:0);
if (count !== 1) return null;
if (showPali) return 'pali';
if (showEng) return 'eng';
if (showVie) return 'vie';
return null;
}
function isNumberedHeadingLine(text) { return /^\d+\.\s*/.test((text||'').trim()); }
function mergeRowsToParagraphRows(rows, lang) {
var out = [];
if (!Array.isArray(rows)||!rows.length) return out;
var cmtField = lang==='pali' ? 'commentPli' : lang==='eng' ? 'commentEn' : 'commentVie';
var buf = '', bufKey = null;
var bufComments = [];
var bufSegCount = 0;
var flush = function () {
var text = (buf||'').trim();
if (!text) { buf=''; bufKey=null; bufComments=[]; bufSegCount=0; return; }
var r = { key: bufKey||'', pali:'', eng:'', vie:'', _merged: true };
if (lang==='pali') r.pali=text;
if (lang==='eng') r.eng=text;
if (lang==='vie') r.vie=text;
if (bufComments.length) r._mergedComments = bufComments.slice();
out.push(r); buf=''; bufKey=null; bufComments=[]; bufSegCount=0;
};
for (var i = 0; i < rows.length; i++) {
var r = rows[i];
var key = String(r.key||'');
var raw = lang==='pali'?(r.pali||''):lang==='eng'?(r.eng||''):(r.vie||'');
var t = (raw||'').trim();
if (!t) continue;
var cmtText = (r[cmtField] || '').trim();
// :0.1 = nikāya reference ("Tăng Chi Bộ Kinh 1" / "Saṁyutta Nikāya 3") — bỏ qua
// trong merged view, là metadata chứ không phải nội dung, không nên dính vào paragraph.
if (/:0\.1$/.test(key)) continue;
// :0.2 = numbered heading (vd "4. Phẩm Tâm Không Được Điều Phục") → flush, output riêng
if (isNumberedHeadingLine(t)) {
flush();
var rr = { key: key, pali:'', eng:'', vie:'', _merged: true, _isHeading: true };
if (lang==='pali') rr.pali=t;
if (lang==='eng') rr.eng=t;
if (lang==='vie') rr.vie=t;
if (cmtText) rr._mergedComments = [{ segKey: key, text: cmtText }];
out.push(rr); continue;
}
// :0.3 = sutta title → flush + output riêng như subtitle (NO _merged → createRow apply is-subtitle)
if (/:0\.3$/.test(key)) {
flush();
var ss = { key: key, pali:'', eng:'', vie:'' };
if (lang==='pali') ss.pali=t;
if (lang==='eng') ss.eng=t;
if (lang==='vie') ss.vie=t;
if (cmtText) ss._mergedComments = [{ segKey: key, text: cmtText }];
out.push(ss); continue;
}
if (!buf) { buf=t; bufKey=key; } else buf+=' '+t;
bufSegCount++;
if (cmtText) {
bufComments.push({ segKey: key, text: cmtText });
flush();
continue;
}
if (paragraphBreak && bufSegCount >= PARAGRAPH_BREAK_LEN) flush();
}
flush(); return out;
}
/* ============================================================
DOM mode cache — Phương án B: Cache cây DOM theo (suttaId, mode).
Khi user toggle giữa multi ↔ single (hoặc giữa các ngôn ngữ single),
detach chunk DIVs hiện tại, attach chunks đã cache → swap ~10ms thay vì rebuild ~150ms.
Lần đầu mỗi mode vẫn full build; lần 2+ instant.
============================================================ */
var DOM_MODE_CACHE = new Map();           // 'id|mode' → snapshot
var DOM_MODE_CACHE_MAX = 6;               // ~1.5 sutta × 4 mode
function _dmCacheKey(id, mode) { return id + '|' + (mode || 'multi'); }
function _dmSnapshotCurrent() {
if (!currentSutraId || !virtChunks || !virtChunks.length) return null;
return {
chunks: virtChunks.slice(),
rows: virtAllRows,
cachedRows: cachedRows.slice(),
keyToRowIdx: keyToRowIdx,
vaggaMarkers: vaggaMarkers,
suttaMarkers: suttaMarkers,
isAN: isAN, isSN: isSN,
fallbackTitle: fallbackTitle,
scrollTop: grid ? grid.scrollTop : 0,
scrollKey: firstVisibleKey
};
}
function _dmSaveCurrent() {
if (!currentSutraId) return;
var mode = lastSingleLangMode || 'multi';
var snap = _dmSnapshotCurrent();
if (!snap) return;
var k = _dmCacheKey(currentSutraId, mode);
DOM_MODE_CACHE.delete(k); DOM_MODE_CACHE.set(k, snap);
while (DOM_MODE_CACHE.size > DOM_MODE_CACHE_MAX) {
DOM_MODE_CACHE.delete(DOM_MODE_CACHE.keys().next().value);
}
}
function _dmInvalidateForSutta(id) {
if (!id) return;
var keys = [];
DOM_MODE_CACHE.forEach(function (_v, k) { if (k.indexOf(id + '|') === 0) keys.push(k); });
keys.forEach(function (k) { DOM_MODE_CACHE.delete(k); });
}
function _dmTryRestore(targetMode) {
if (!currentSutraId || !grid) return false;
var k = _dmCacheKey(currentSutraId, targetMode);
var snap = DOM_MODE_CACHE.get(k);
if (!snap) return false;
// Lưu state hiện tại trước khi swap (lần sau quay lại sẽ instant)
_dmSaveCurrent();
// Touch LRU cho entry sắp dùng
DOM_MODE_CACHE.delete(k); DOM_MODE_CACHE.set(k, snap);
// Tear down observers cũ
if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
teardownChunkObservers();
// Detach divs hiện tại — chúng đã được snap khác giữ reference
while (grid.firstChild) grid.removeChild(grid.firstChild);
// Restore module state
virtChunks = snap.chunks;
virtAllRows = snap.rows;
cachedRows = snap.cachedRows;
keyToRowIdx = snap.keyToRowIdx;
vaggaMarkers = snap.vaggaMarkers;
suttaMarkers = snap.suttaMarkers;
isAN = snap.isAN; isSN = snap.isSN;
fallbackTitle = snap.fallbackTitle;
lastAppliedVaggaIdx = -2; lastAppliedSuttaIdx = -2;
// Re-attach chunk DIVs
var frag = document.createDocumentFragment();
for (var i = 0; i < snap.chunks.length; i++) frag.appendChild(snap.chunks[i].div);
grid.appendChild(frag);
applyVisibility();
// Re-setup observers (chunk obs trigger materialize cho chunks visible)
setupChunkObservers();
setupAnchorObserver();
// Restore scroll
if (typeof snap.scrollTop === 'number') grid.scrollTop = snap.scrollTop;
firstVisibleKey = snap.scrollKey || null;
lastSingleLangMode = targetMode;
return true;
}
var _modeRerenderTimer = null;
function maybeRerenderIfModeChanged() {
var mode = getSingleVisibleLang();
if (mode === lastSingleLangMode) return;
// Debounce: gộp các toggle liên tục lại để tránh rerender chồng chất.
clearTimeout(_modeRerenderTimer);
_modeRerenderTimer = setTimeout(function () {
_modeRerenderTimer = null;
var modeNow = getSingleVisibleLang();
if (modeNow === lastSingleLangMode) return;
// Cache hit → swap DOM ~10ms thay vì rebuild ~150ms
if (_dmTryRestore(modeNow)) return;
if (currentSutraId) renderSutra(currentSutraId);
}, 180);
}
/* ============================================================
View-mode cache: pre-computed rowsForView + keyIndex + markers per (suttaId, mode).
Tránh chạy lại mergeRowsToParagraphRows + duyệt toàn bộ virtAllRows mỗi lần toggle
cột ngôn ngữ. LRU ~30 entries.
============================================================ */
var VIEW_CACHE = new Map();
var VIEW_CACHE_MAX = 30;
function buildViewData(rowsRaw, lang, isAN, isSN) {
var rows = lang ? mergeRowsToParagraphRows(rowsRaw, lang) : rowsRaw;
var keyIdx = Object.create(null);
var vagga = [];
var sutta = [];
// Lookup table cho title ngắn — luôn lấy từ raw segment data, kể cả ở merged mode
// (vì trong merged mode, rows[i].vie ở key :0.3 = TOÀN BỘ paragraph text, không phải title).
var rawByKey = Object.create(null);
for (var j = 0; j < rowsRaw.length; j++) {
rawByKey[String(rowsRaw[j].key || '')] = rowsRaw[j];
}
for (var i = 0; i < rows.length; i++) {
var k = String(rows[i].key || '');
keyIdx[k] = i;
if ((isAN || isSN) && /:0\.2$/.test(k)) {
var rv = rawByKey[k] || rows[i];
vagga.push({
rowIdx: i,
titleVi: (rv.vie || '').trim(),
titleEn: (rv.eng || '').trim(),
titlePali: (rv.pali || '').trim()
});
}
if (isSN && /:0\.3$/.test(k)) {
var rs = rawByKey[k] || rows[i];
sutta.push({
rowIdx: i,
titleVi: (rs.vie || '').trim(),
titleEn: (rs.eng || '').trim(),
titlePali: (rs.pali || '').trim()
});
}
}
return { rows: rows, keyToRowIdx: keyIdx, vaggaMarkers: vagga, suttaMarkers: sutta };
}
function getViewData(id, rowsRaw, lang, isAN, isSN) {
var cacheKey = id + '|' + (lang || 'multi');
if (VIEW_CACHE.has(cacheKey)) {
var cached = VIEW_CACHE.get(cacheKey);
// LRU touch
VIEW_CACHE.delete(cacheKey);
VIEW_CACHE.set(cacheKey, cached);
return cached;
}
var v = buildViewData(rowsRaw, lang, isAN, isSN);
VIEW_CACHE.set(cacheKey, v);
while (VIEW_CACHE.size > VIEW_CACHE_MAX) {
var firstKey = VIEW_CACHE.keys().next().value;
VIEW_CACHE.delete(firstKey);
}
return v;
}
