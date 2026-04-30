'use strict';
function initDebugPanel() {
var btnDebug = $('btnDebug');
var debugPanel = $('debugPanel');
var debugBody = $('debugBody');
var btnDebugClose = $('btnDebugClose');
if (!btnDebug || !debugPanel || !debugBody) return;
if (!DEBUG) {
btnDebug.style.visibility = 'hidden';
btnDebug.setAttribute('aria-hidden', 'true');
btnDebug.setAttribute('tabindex', '-1');
debugPanel.hidden = true;
return;
}
btnDebug.style.visibility = '';
var visible = false;
var timer = null;
var lastFrameT = performance.now();
var fps = 0;
(function tickFps() {
var now = performance.now();
var dt = now - lastFrameT;
lastFrameT = now;
if (dt > 0) fps = Math.round(1000 / dt);
requestAnimationFrame(tickFps);
})();
// "Vùng đen" detector: periodic check for empty space at top of viewport while we have content.
// Khi phát hiện, log lại state để user chụp screenshot. Không tự xóa — chỉ giữ 5 entry mới nhất.
var voidLog = [];
var VOID_LOG_MAX = 5;
var VOID_TOP_THRESHOLD = 60;  // px empty above first visible row → coi là void
var lastVoidTs = 0;
function checkBlackVoid() {
if (!grid || !virtChunks || !virtChunks.length) return null;
var rootRect = grid.getBoundingClientRect();
var st = grid.scrollTop;
var sh = grid.scrollHeight;
var ch = grid.clientHeight;
// Bỏ qua nếu đang ở edge (top hoặc bottom) — natural empty space.
if (st < 50) return null;
if (st >= sh - ch - 50) return null;
// Tìm row đầu tiên giao với viewport.
var rows = grid.querySelectorAll('.sutra-row-wrap');
var firstVisible = null;
for (var i = 0; i < rows.length; i++) {
var rr = rows[i].getBoundingClientRect();
if (rr.bottom > rootRect.top && rr.top < rootRect.bottom) { firstVisible = rows[i]; break; }
}
if (!firstVisible) {
// Không có row nào trong viewport — chắc chắn void.
return { reason: 'no row in viewport', emptyAbovePx: ch, firstKey: null };
}
var fr = firstVisible.getBoundingClientRect();
var emptyAbove = Math.round(fr.top - rootRect.top);
if (emptyAbove > VOID_TOP_THRESHOLD) {
return { reason: 'empty above first row', emptyAbovePx: emptyAbove, firstKey: firstVisible.querySelector('.sutra-row')?.getAttribute('data-key') || null };
}
return null;
}
function snapshotState(detection) {
var st = grid.scrollTop, sh = grid.scrollHeight, ch = grid.clientHeight;
var matCnt = 0;
var chunkSummary = [];
var rootRect = grid.getBoundingClientRect();
for (var ci = 0; ci < virtChunks.length; ci++) {
var c = virtChunks[ci];
if (c.materialized) matCnt++;
var cr = c.div.getBoundingClientRect();
var topRel = Math.round(cr.top - rootRect.top);
var bottomRel = Math.round(cr.bottom - rootRect.top);
var inView = (cr.bottom > rootRect.top && cr.top < rootRect.bottom);
chunkSummary.push(
'  #' + ci + (c.materialized ? ' [M]' : ' [.]') +
' rows ' + c.rowStart + '-' + c.rowEnd +
' h=' + Math.round(cr.height) +
' rel=[' + topRel + ',' + bottomRel + ']' +
' measH=' + (c.measuredH || 0) +
(inView ? ' ←view' : '')
);
}
return {
ts: new Date().toISOString().slice(11, 19),
sutta: currentSutraId,
detection: detection,
scroll: { top: st, height: sh, client: ch, pct: sh > ch ? Math.round(st/(sh-ch)*100) : 0 },
chunks: 'Total ' + virtChunks.length + ', Materialized ' + matCnt,
chunkDetail: chunkSummary,
firstVisKey: firstVisibleKey,
mode: { pali: showPali, eng: showEng, vie: showVie, stack: card?.classList.contains('stack'), col3: card?.classList.contains('grid-3cols') },
zoom: zoomLevel
};
}
// Tick detector — chỉ chạy khi user tick checkbox trong debug panel.
// Default OFF để tiết kiệm performance. Khi bật, chạy nền 1s/lần (kể cả khi panel đóng).
function tickVoidDetector() {
var d = checkBlackVoid();
if (!d) return;
// Throttle: không log nếu cùng symptom < 2s (tránh spam khi giữ bug)
var now = Date.now();
if (now - lastVoidTs < 2000) return;
lastVoidTs = now;
voidLog.unshift(snapshotState(d));
if (voidLog.length > VOID_LOG_MAX) voidLog.pop();
// Console hint nếu user đang xem console
if (window.console && console.warn) console.warn('[VOID DETECTED]', voidLog[0]);
}
var _voidDetectorInterval = null;
var VOID_DETECTOR_KEY = 'sutra_debug_void_detector';
function startVoidDetector() {
if (_voidDetectorInterval) return;
_voidDetectorInterval = setInterval(tickVoidDetector, 1000);
}
function stopVoidDetector() {
if (_voidDetectorInterval) { clearInterval(_voidDetectorInterval); _voidDetectorInterval = null; }
}
window.startVoidDetector = startVoidDetector;
window.stopVoidDetector = stopVoidDetector;
function fmtBytes(n) {
if (!Number.isFinite(n)) return '-';
if (n > 1024*1024) return (n / (1024*1024)).toFixed(1) + ' MB';
if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
return n + ' B';
}
function update() {
if (!visible) return;
var allDom = document.getElementsByTagName('*').length;
var wraps = grid ? grid.querySelectorAll('.sutra-row-wrap') : [];
var sc = grid;
var sh = sc ? sc.scrollHeight : 0;
var st = sc ? sc.scrollTop : 0;
var ch = sc ? sc.clientHeight : 0;
var scrollPct = sh > ch ? Math.round(st / (sh - ch) * 100) : 0;
var mem = (performance && performance.memory) ? performance.memory : null;
var lsKey = currentSutraId ? ('scroll_anchor_key_' + currentSutraId) : '';
var lsRaw = null;
try { lsRaw = lsKey ? localStorage.getItem(lsKey) : null; } catch(e) {}
var anchorKey = currentSutraId ? storage.get(KEY_ANCHOR_K(currentSutraId)) : null;
var matChunks = 0, totalChunks = virtChunks ? virtChunks.length : 0;
if (virtChunks) {
for (var vc = 0; vc < virtChunks.length; vc++) {
if (virtChunks[vc].materialized) matChunks++;
}
}
var anchorIdx = -1;
if (anchorKey && virtAllRows) {
for (var ai = 0; ai < virtAllRows.length; ai++) {
if (String(virtAllRows[ai].key || '') === anchorKey) { anchorIdx = ai; break; }
}
}
var lines = [
'--- OLD VERSION (appold.js) ---',
'Sutta: ' + (currentSutraId || '-'),
'Langs: ' + (showPali?'P':'') + (showEng?'E':'') + (showVie?'V':''),
'',
'── DOM ──',
'Total elements:   ' + allDom,
'Row wraps:        ' + wraps.length,
'',
'── Virtual scroll ──',
'Total chunks:     ' + totalChunks,
'Materialized:     ' + matChunks + ' / ' + totalChunks,
'virtAllRows len:  ' + (virtAllRows ? virtAllRows.length : 0),
'',
'── Anchor ──',
'localStorage key: ' + (lsKey || '-'),
'RAW value:        ' + (lsRaw === null ? '(null)' : '"' + lsRaw + '"'),
'via storage.get:  ' + (anchorKey === null ? '(null)' : '"' + anchorKey + '"'),
'Match raw?        ' + (lsRaw === anchorKey ? '✓ yes' : '✗ DIFFERENT!'),
'Current top key:  ' + (firstVisibleKey || '-'),
'Saved idx:        ' + (anchorIdx >= 0 ? anchorIdx : 'not-found in virtAllRows'),
'Match chunk:      ' + (anchorIdx >= 0 ? Math.floor(anchorIdx / 50) : '-'),
'',
'── Scroll ──',
'scrollTop:        ' + st + ' px',
'scrollHeight:     ' + sh + ' px',
'clientHeight:     ' + ch + ' px',
'Progress:         ' + scrollPct + '%',
'FPS:              ' + fps,
'',
'── Cache ──',
'Merged suttas:    ' + MERGED_CACHE.size,
'Loaded packs:     ' + LOADED_PACKS.size,
'',
'── TTS ──',
'Module loaded:    ' + (_ttsApi ? 'yes' : 'no'),
];
if (mem) {
lines.push('');
lines.push('── Memory (JS heap) ──');
lines.push('used:   ' + fmtBytes(mem.usedJSHeapSize));
lines.push('total:  ' + fmtBytes(mem.totalJSHeapSize));
lines.push('limit:  ' + fmtBytes(mem.jsHeapSizeLimit));
}
// Vùng đen log — sticky để chụp screenshot.
lines.push('');
lines.push('── ⚠ VÙNG ĐEN log (' + voidLog.length + '/' + VOID_LOG_MAX + ') ──');
if (!voidLog.length) {
lines.push(_voidDetectorInterval
? '(đang chạy. Chưa phát hiện void.)'
: '(detector ĐANG TẮT. Tick checkbox bên dưới để bật.)');
} else {
for (var vi = 0; vi < voidLog.length; vi++) {
var entry = voidLog[vi];
lines.push('');
lines.push('[' + entry.ts + '] ' + (entry.sutta || '?') + '  zoom=' + entry.zoom);
lines.push('  reason: ' + entry.detection.reason + ' (' + entry.detection.emptyAbovePx + 'px empty)');
lines.push('  firstKey: ' + (entry.detection.firstKey || 'NONE') + '  topInView: ' + (entry.firstVisKey || '-'));
lines.push('  scroll: ' + entry.scroll.top + '/' + entry.scroll.height + ' (' + entry.scroll.pct + '%) ch=' + entry.scroll.client);
lines.push('  mode: P=' + entry.mode.pali + ' E=' + entry.mode.eng + ' V=' + entry.mode.vie + ' col3=' + entry.mode.col3 + ' stack=' + entry.mode.stack);
lines.push('  ' + entry.chunks);
for (var ci2 = 0; ci2 < entry.chunkDetail.length; ci2++) lines.push(entry.chunkDetail[ci2]);
}
lines.push('');
lines.push('(Tap nút Clear để xóa log. Tự động giữ 5 entry mới nhất.)');
}
debugBody.textContent = lines.join('\n');
}
// Expose clear function for user (Clear button trong debug panel hoặc qua console)
window.clearVoidLog = function () { voidLog = []; lastVoidTs = 0; if (visible) update(); };
function show() {
visible = true;
debugPanel.hidden = false;
debugPanel.setAttribute('aria-hidden', 'false');
update();
if (timer) clearInterval(timer);
timer = setInterval(update, 500);
}
function hide() {
visible = false;
debugPanel.hidden = true;
debugPanel.setAttribute('aria-hidden', 'true');
if (timer) { clearInterval(timer); timer = null; }
}
btnDebug.addEventListener('click', function (e) {
e.stopPropagation();
if (visible) hide(); else show();
});
if (btnDebugClose) btnDebugClose.addEventListener('click', hide);
var chkVoidDetector = $('chkVoidDetector');
if (chkVoidDetector) {
var saved = null;
try { saved = localStorage.getItem(VOID_DETECTOR_KEY); } catch(_){}
chkVoidDetector.checked = saved === '1';
if (chkVoidDetector.checked) startVoidDetector();
chkVoidDetector.addEventListener('change', function () {
try { localStorage.setItem(VOID_DETECTOR_KEY, chkVoidDetector.checked ? '1' : '0'); } catch(_){}
if (chkVoidDetector.checked) startVoidDetector(); else stopVoidDetector();
if (visible) update();
});
}
var btnClearVoidLog = $('btnClearVoidLog');
if (btnClearVoidLog) btnClearVoidLog.addEventListener('click', function (e) {
e.stopPropagation();
window.clearVoidLog && window.clearVoidLog();
});
var btnClearStorage = $('btnClearStorage');
if (btnClearStorage) btnClearStorage.addEventListener('click', function (e) {
e.stopPropagation();
var count = 0;
try { count = localStorage.length; } catch(_) {}
var msg = 'Xóa TOÀN BỘ ' + count + ' items trong localStorage?\n' +
'(anchor, settings, last sutta, cached theme…)\n\n' +
'Trang sẽ reload về trạng thái mặc định.';
if (!confirm(msg)) return;
try { localStorage.clear(); } catch(_) {}
location.replace(location.pathname + location.search);
});
}
