(function () {
'use strict';
const DEBUG = true;
const $ = (id) => document.getElementById(id);
function escapeHtml(str) {
if (str === undefined || str === null) return '';
return String(str)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(val) {
if (val === undefined || val === null) return '';
return String(val)
.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
.replace(/</g, '&lt;').replace(/`/g, '&#96;').replace(/>/g, '&gt;');
}
function safeDomId(base) { return String(base).replace(/[^a-z0-9_-]/gi, '-'); }
function debounce(fn, wait = 200) {
let t;
const debounced = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
debounced.cancel = () => { clearTimeout(t); t = null; };
return debounced;
}
function throttle(fn, wait = 120) {
let last = 0;
return (...args) => { const now = Date.now(); if (now - last >= wait) { last = now; fn(...args); } };
}
/* ============================================================
FIX: Safe localStorage wrapper — handles private browsing / quota errors
============================================================ */
const storage = {
get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
set(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* ignore */ } },
remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
};
/* ============================================================
FIX: Safe CSS selector escape — handles colons in bilara keys like "sn1.1:1.1"
============================================================ */
function safeCssEscape(str) {
if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
return CSS.escape(str);
}
return String(str).replace(/([^\w-])/g, '\\$1');
}
/* ============================================================
Lazy load packs
============================================================ */
const LOADED_PACKS = new Set();
const PACK_PROMISES = new Map();
function loadPackIfNeeded(pack) {
if (!pack) return Promise.resolve();
if (LOADED_PACKS.has(pack)) return Promise.resolve();
if (PACK_PROMISES.has(pack)) return PACK_PROMISES.get(pack);
const p = new Promise((res, rej) => {
try {
const s = document.createElement('script');
s.src = pack + '.js'; s.async = true;
s.onload = () => { LOADED_PACKS.add(pack); PACK_PROMISES.delete(pack); res(); };
s.onerror = (e) => { PACK_PROMISES.delete(pack); rej(e); };
document.body.appendChild(s);
} catch (e) { PACK_PROMISES.delete(pack); rej(e); }
});
PACK_PROMISES.set(pack, p);
return p;
}
/* ============================================================
Bilara loader
============================================================ */
window.BILARA = window.BILARA || {};
const BILARA_BASE_DIR = './sutta';
function getBilaraPack(lang, id) {
if (!id) return null;
if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
return BILARA_BASE_DIR + '/' + lang + '/' + id;
}
const MERGED_CACHE = new Map();
const MERGED_PROMISES = new Map();
const CACHE_ORDER = [];
const MAX_CACHE_SUTTAS = 20;
function touchCache(id) {
const i = CACHE_ORDER.indexOf(id);
if (i !== -1) CACHE_ORDER.splice(i, 1);
CACHE_ORDER.push(id);
while (CACHE_ORDER.length > MAX_CACHE_SUTTAS) {
const old = CACHE_ORDER.shift();
if (old) MERGED_CACHE.delete(old);
}
}
function unionKeys3(a, b, c) {
const set = new Set();
if (a) Object.keys(a).forEach(function (k) { set.add(k); });
if (b) Object.keys(b).forEach(function (k) { set.add(k); });
if (c) Object.keys(c).forEach(function (k) { set.add(k); });
return Array.from(set);
}
var _BILARA_COLLATOR = (typeof Intl !== 'undefined' && Intl.Collator)
? new Intl.Collator('en', { numeric: true })
: null;
function sortBilaraKeys(keys) {
if (_BILARA_COLLATOR) return keys.sort(_BILARA_COLLATOR.compare);
return keys.sort(function (x, y) { return x.localeCompare(y, 'en', { numeric: true }); });
}
function getCommentPack(lang, id) {
// lang: 'pli' | 'en' | 'vi'  →  ./sutta/comment/<id>_<lang>
if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
return BILARA_BASE_DIR + '/comment/' + id + '_' + lang;
}
// Manifest (tùy chọn): nếu file sutta/comment/_index.js khai báo window.COMMENT_INDEX
// = { 'dn01': ['pli','en','vi'], 'sn3_v1': ['vi'], ... } thì chỉ load pack được khai báo.
// Không có manifest → fallback load-all (404-tolerant, có console noise nhưng vô hại).
function shouldLoadCommentPack(lang, id) {
var idx = window.COMMENT_INDEX;
if (!idx || typeof idx !== 'object') return true; // no manifest → try all
var entry = idx[id];
if (!entry) return false;
if (Array.isArray(entry)) return entry.indexOf(lang) !== -1;
return !!entry; // truthy value without array → load all for this id
}
async function loadMerged(id) {
if (!id) return null;
if (MERGED_CACHE.has(id)) return MERGED_CACHE.get(id);
if (MERGED_PROMISES.has(id)) return MERGED_PROMISES.get(id);
var p = (async function () {
var swallow = function (e) { /* 404/load-fail for optional packs → no data */ };
var tasks = [
loadPackIfNeeded(getBilaraPack('pli', id)),
loadPackIfNeeded(getBilaraPack('en', id)),
loadPackIfNeeded(getBilaraPack('vi', id))
];
// Chỉ load comment packs nếu manifest cho phép (hoặc không có manifest)
if (shouldLoadCommentPack('pli', id)) tasks.push(loadPackIfNeeded(getCommentPack('pli', id)).catch(swallow));
if (shouldLoadCommentPack('en', id))  tasks.push(loadPackIfNeeded(getCommentPack('en', id)).catch(swallow));
if (shouldLoadCommentPack('vi', id))  tasks.push(loadPackIfNeeded(getCommentPack('vi', id)).catch(swallow));
// Legacy single-file comment — only try if no manifest or explicitly allowed
if (!window.COMMENT_INDEX) tasks.push(loadPackIfNeeded(getBilaraPack('comment', id)).catch(swallow));
await Promise.all(tasks);
var entry = window.BILARA[id] || {};
var paliMap = entry.pli || {};
var engMap  = entry.en  || {};
var vieMap  = entry.vi  || {};
var cmtPli  = entry.commentPli || {};
var cmtEn   = entry.commentEn  || {};
var cmtVi   = entry.commentVi  || {};
var cmtLegacy = entry.comment  || {};
var keys = sortBilaraKeys(unionKeys3(paliMap, engMap, vieMap));
var rows = keys.map(function (k) {
return {
key: k,
pali: paliMap[k]||'',
eng:  engMap[k]||'',
vie:  vieMap[k]||'',
commentPli: cmtPli[k] || '',
commentEn:  cmtEn[k]  || '',
commentVie: cmtVi[k]  || '',
comment:    cmtLegacy[k] || ''
};
});
var merged = { paliMap: paliMap, engMap: engMap, vieMap: vieMap,
commentPliMap: cmtPli, commentEnMap: cmtEn, commentVieMap: cmtVi,
commentMap: cmtLegacy, keys: keys, rows: rows };
MERGED_CACHE.set(id, merged);
touchCache(id);
MERGED_PROMISES.delete(id);
return merged;
})().catch(function (e) { MERGED_PROMISES.delete(id); throw e; });
MERGED_PROMISES.set(id, p);
return p;
}
/* ============================================================
DOM refs
============================================================ */
var card        = $('card');
var titleEl      = $('title');
var subtitleEl   = $('subtitle');
var superTitleEl = $('supertitle');
var titleMetaEl  = $('titleMeta');
// readerArea (nếu có trong DOM) là scroll container. Fallback về grid cho HTML cũ.
var readerArea   = $('readerArea');
var scrollEl     = readerArea || null;  // gán lại sau khi grid khởi tạo
var grid        = $('sutraGrid');
if (!scrollEl) scrollEl = grid;  // fallback khi HTML cũ không có #readerArea
var btnSutraMenu  = $('sidebar-btn');
var btnSettings   = $('btnSettings');
var btnGuide      = $('btnGuide');
var btnBackTop    = $('btnBackTop');
var btnUiLang     = $('btnUiLang');
var settingsPanel  = $('settingsPanel');
var sutraMenuPanel = $('sutraMenuPanel');
var sutraMenuList  = $('sutraMenuList');
var guideOverlay   = $('guideOverlay');
var searchInput    = $('sutraSearch');
var searchResultsEl = $('sutraSearchResults');
var btnPali      = $('btnPali');
var btnEng       = $('btnEng');
var btnVie       = $('btnVie');
var btnLayout    = $('btnLayout');
var btnReadTts   = $('btnReadTts');
var btnPauseTts  = $('btnPauseTts');
var btnStopTts   = $('btnStopTts');
var btnFullWidth = $('btnFullWidth');
/* ============================================================
State
============================================================ */
var currentSutraId = null;
var SUTRA_ORDER = [];
var FLAT_SUTTAS = [];
var showPali = true, showEng = true, showVie = true;
var isRendering = false;
var renderToken = 0;
var lastSingleLangMode = null;
var cachedRows = [];
// Virtual scroll state
var virtChunks = [];    // [{div, rowStart, rowEnd, materialized, measuredH}]
var virtAllRows = [];   // row data array (cho TTS + anchor khi chunk chưa materialize)
var virtMatObs = null;
var virtDemObs = null;
var LANG_STORAGE_KEY = 'sutra_ui_lang';
var uiLang = storage.get(LANG_STORAGE_KEY) === 'en' ? 'en' : 'vi';
window.SUTRA_UI_LANG = uiLang;
var KEY_LAST     = 'lastSutraId';
var KEY_VIEW     = 'sutra_view_prefs';
var KEY_ANCHOR_K = function (id) { return 'scroll_anchor_key_' + id; };
// ── URL hash live sync ─────────────────────────────────────────────
// Format: #<segPrefix>:<path>  (vd  #dn1:2.3.4) — segment key chuẩn Bilara.
// segPrefix khác sutta id của file: dn1↔dn01, sn1↔sn1_v1, an10↔an10_v1...
var _SEG_PREFIX_MAP = null;
function _resolveSegPrefixToSuttaId(prefix) {
if (_SEG_PREFIX_MAP === null) {
_SEG_PREFIX_MAP = {};
if (window.SUTRA_INDEX) {
(function walk(arr) {
for (var i = 0; i < arr.length; i++) {
var n = arr[i];
if (n && n.type === 'sutta' && n.id) {
var p = String(n.id).replace(/_v\d+$/, '').replace(/^([a-z]+)0+(\d)/, '$1$2');
_SEG_PREFIX_MAP[p] = n.id;
}
if (n && n.children) walk(n.children);
}
})(window.SUTRA_INDEX);
}
}
return _SEG_PREFIX_MAP[prefix] || prefix;
}
function _parseAnchorHash() {
var h = String(location.hash || '').replace(/^#/, '');
if (!h) return null;
var m = h.match(/^([A-Za-z0-9_-]+)(?::.+)?$/);
if (!m) return null;
var rawPrefix = m[1].toLowerCase();
var suttaId = _resolveSegPrefixToSuttaId(rawPrefix);
return { sutta: suttaId, key: h };
}
function _writeAnchorHash(key) {
if (!key) return;
try { history.replaceState(null, '', '#' + key); } catch (e) { /* ignore */ }
}
function _clearAnchorHash() {
try {
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
} catch (e) { /* ignore */ }
}
// Hash ưu tiên hơn localStorage NẾU hash trỏ đúng sutta đang xem.
function getAnchorKeyFor(id) {
var h = _parseAnchorHash();
if (h && h.sutta === id && h.key) return h.key;
return storage.get(KEY_ANCHOR_K(id));
}
var WIDE_STORAGE_KEY = 'sutra_layout_wide';
var isWide = storage.get(WIDE_STORAGE_KEY) === '1';
/* ============================================================
Bookmarks (favorites)
============================================================ */
var KEY_BOOKMARKS = 'sutra_bookmarks';
var BOOKMARKS = new Set();
function loadBookmarks() {
var raw = storage.get(KEY_BOOKMARKS);
if (!raw) return;
try {
var arr = JSON.parse(raw);
if (Array.isArray(arr)) {
for (var i = 0; i < arr.length; i++) {
if (typeof arr[i] === 'string' && arr[i]) BOOKMARKS.add(arr[i]);
}
}
} catch (e) { /* ignore malformed */ }
}
function saveBookmarks() {
storage.set(KEY_BOOKMARKS, JSON.stringify(Array.from(BOOKMARKS)));
}
function isBookmarked(id) { return !!id && BOOKMARKS.has(id); }
function setBookmark(id, on) {
if (!id) return false;
if (on) BOOKMARKS.add(id); else BOOKMARKS.delete(id);
saveBookmarks();
return BOOKMARKS.has(id);
}
function toggleBookmark(id) { return setBookmark(id, !isBookmarked(id)); }
function bookmarkLabels() {
return uiLang === 'en'
? { on: 'Remove bookmark', off: 'Add bookmark', empty: 'No bookmarks yet. Tap ☆ next to any sutta to save it.' }
: { on: 'Bỏ đánh dấu', off: 'Lưu bài kinh', empty: 'Chưa có bài kinh nào được lưu. Bấm ☆ cạnh tên bài kinh để lưu.' };
}
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
var rr = { key: key, pali:'', eng:'', vie:'', _merged: true };
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
function maybeRerenderIfModeChanged() {
var mode = getSingleVisibleLang();
if (mode === lastSingleLangMode) return;
if (currentSutraId) renderSutra(currentSutraId);
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
/* ============================================================
UI Language flags
============================================================ */
// Lang icon dạng chữ đơn giản (Option C) — không dùng cờ màu → subtle, hợp theme dark
var FLAG_VI = '<span class="lang-letters">VN</span>';
var FLAG_EN = '<span class="lang-letters">EN</span>';
function renderUiLangFlag() {
if (!btnUiLang) return;
btnUiLang.innerHTML = uiLang === 'en' ? FLAG_EN : FLAG_VI;
btnUiLang.setAttribute('aria-label', uiLang === 'en'
? 'Interface: English — click to switch to Vietnamese'
: 'Giao diện: Tiếng Việt — bấm để chuyển sang English');
}
function applyUiLanguageToSearchUi() {
if (!searchInput) return;
searchInput.placeholder = uiLang === 'en' ? 'Search sutta...' : 'Tìm bài kinh...';
}
function applyUiLanguageToSettingsPanel() {
var isEn = uiLang === 'en';
var setText = function (id, text) { var el=$(id); if(el) el.textContent=text; };
setText('settingsTitle',          isEn ? 'Settings'            : 'Tuỳ chỉnh');
setText('settingsLangLabel',      isEn ? 'Languages'           : 'Ngôn ngữ');
setText('settingsLangSub',        isEn ? 'Show / hide columns' : 'Hiện / ẩn cột');
setText('settingsHlLabel',        isEn ? 'Emphasize'           : 'Nổi bật');
setText('settingsHlSub',          isEn ? 'Italic + darker ink' : 'In nghiêng + đậm');
setText('settingsLayoutSub',      isEn ? 'Display options'     : 'Cách hiển thị');
setText('settingsCmtLabel',       isEn ? 'Commentary'          : 'Chú giải');
setText('settingsCmtSub',         isEn ? 'Show / hide by lang' : 'Hiện / ẩn theo ngôn ngữ');
setText('settingsLayoutLabel',    isEn ? 'Layout'              : 'Bố cục');
setText('settingsDisplayLabel',   isEn ? 'Display'             : 'Hiển thị');
setText('settingsFontSizeLabel',  isEn ? 'Font size'           : 'Cỡ chữ');
setText('settingsLineHeightLabel',isEn ? 'Line spacing'        : 'Giãn dòng');
setText('settingsTtsTitle',       isEn ? 'Read aloud'          : 'Đọc kinh');
setText('settingsTtsUiLabel',     isEn ? 'Text-to-Speech'      : 'Text-to-Speech');
setText('settingsFullWidthLabel', isEn ? 'Full width'          : 'Toàn màn hình');
var note = $('settingsTtsNote');
if (note) note.innerHTML = isEn
? '* Uses browser built-in voices, quality may vary by device.'
: '* TTS dùng giọng có sẵn của trình duyệt, có thể khác nhau giữa thiết bị.';
if (btnLayout) btnLayout.innerHTML = isEn
? '<span class="pill-icon">☰</span> Stacked'
: '<span class="pill-icon">☰</span> Xếp dọc';
var _btn3C = $('btn3Cols');
if (_btn3C) _btn3C.innerHTML = isEn
? '<span class="pill-icon">⫴</span> 3 columns'
: '<span class="pill-icon">⫴</span> 3 cột ngang';
var _btnCM = $('btnCmtMaster');
if (_btnCM) _btnCM.innerHTML = isEn
? '<span class="pill-icon">💬</span> Commentary'
: '<span class="pill-icon">💬</span> Chú giải';
var _btnCP = $('btnCmtPli');
if (_btnCP) _btnCP.innerHTML = '<span class="pill-icon">💬</span> Pāli';
var _btnCE = $('btnCmtEng');
if (_btnCE) _btnCE.innerHTML = '<span class="pill-icon">💬</span> Eng';
var _btnCV = $('btnCmtVie');
if (_btnCV) _btnCV.innerHTML = isEn
? '<span class="pill-icon">💬</span> Viet'
: '<span class="pill-icon">💬</span> Việt';
var btnFW = $('btnFullWidth');
if (btnFW) btnFW.innerHTML = isEn
? '<span class="pill-icon">⛶</span> Full width'
: '<span class="pill-icon">⛶</span> Toàn màn hình';
if (btnGuide)     btnGuide.setAttribute('aria-label',     isEn ? 'User guide'       : 'Hướng dẫn sử dụng');
if (btnSutraMenu) btnSutraMenu.setAttribute('aria-label', isEn ? 'Sutta Index'      : 'Danh mục bài kinh');
if (btnSettings)  btnSettings.setAttribute('aria-label',  isEn ? 'Display settings'  : 'Cài đặt hiển thị');
if (btnBackTop)   btnBackTop.setAttribute('aria-label',   isEn ? 'Back to top'       : 'Lên đầu trang');
if (btnPauseTts)  btnPauseTts.setAttribute('aria-label',
isEn ? 'Pause (current sentence will restart)' : 'Tạm dừng (câu hiện tại sẽ đọc lại từ đầu)');
var sideLabel = document.querySelector('#sidebar-btn .sidebar-label');
if (sideLabel) sideLabel.textContent = isEn ? 'Library' : 'Thư viện';
}
function renderGuideDialog() {
if (!guideOverlay) return;
var dlg = guideOverlay.querySelector('.guide-dialog');
if (!dlg) return;
var isEn = uiLang === 'en';
var viHtml =
'<h2>Hướng dẫn sử dụng</h2>' +
'<em>Trang đọc kinh tam ngữ Pāli · English · Tiếng Việt — nguồn SuttaCentral.</em>' +
'<h3>📖 Thư viện bài kinh</h3>' +
'<ul>' +
'<li>Bấm <strong>Thư viện</strong> ở giữa footer để mở mục lục.</li>' +
'<li>Chọn 1 trong <strong>5 tile</strong>: <code>DN</code> Trường Bộ · <code>MN</code> Trung Bộ · <code>SN</code> Tương Ưng · <code>AN</code> Tăng Chi · <strong>★ Đã lưu</strong> (bài đã đánh dấu).</li>' +
'<li><strong>DN / MN</strong>: danh sách bài kinh phẳng. <strong>SN / AN</strong>: nhóm theo Chủ đề / Phẩm, bấm mở rộng.</li>' +
'<li><strong>Tìm kiếm</strong>: lọc theo tên, mã (vd <code>mn 23</code>), hoặc từ khóa — tìm xuyên cả 4 bộ. <em>Không cần gõ dấu</em> (gõ "pham vong" vẫn tìm thấy "Phạm Võng").</li>' +
'<li>Bấm <strong>×</strong> hoặc click ngoài panel để đóng.</li>' +
'</ul>' +
'<h3>⭐ Đánh dấu (Bookmark)</h3>' +
'<ul>' +
'<li>Bấm <strong>☆</strong> cạnh tiêu đề bài đang đọc (góc trên-phải header) để lưu / bỏ lưu.</li>' +
'<li>Bấm <strong>☆</strong> cạnh tên mỗi bài trong thư viện để lưu nhanh mà không cần mở bài.</li>' +
'<li>Tile <strong>★ Đã lưu</strong> hiện số bài đang lưu — bấm để xem danh sách. Sắp theo thứ tự tự nhiên trong bộ kinh.</li>' +
'<li>Danh sách lưu trong trình duyệt, không đồng bộ giữa thiết bị.</li>' +
'</ul>' +
'<h3>📜 Đọc kinh</h3>' +
'<ul>' +
'<li><strong>Header tiêu đề</strong>: Nikāya · Mã · Tên Pāli · Tên đối ngữ (VI/EN).</li>' +
'<li>Nội dung chia thành <strong>đoạn (segment)</strong> — mã hiển thị góc trái (vd <code>MN23.1.1</code>).</li>' +
'<li>Desktop: <strong>Pāli full-width trên</strong>, <strong>English + Việt</strong> song song bên dưới. Mobile / iPad tự xếp dọc.</li>' +
'<li><strong>Số phẩm / chương</strong> căn giữa, tô đậm làm dấu phân đoạn. Dòng <strong>SOURCE</strong> cuối bài ghi nguồn.</li>' +
'<li><strong>Nav title</strong> giữa footer — bấm để mở thư viện ngay bài đang đọc.</li>' +
'<li><strong>‹ TRƯỚC / SAU ›</strong> ở footer: chuyển bài tuần tự trong bộ kinh.</li>' +
'<li><strong>⬆ Back to top</strong> (FAB góc phải): về đầu bài, xoá vị trí đã lưu.</li>' +
'</ul>' +
'<h3>⚙ Cài đặt</h3>' +
'<ul>' +
'<li><strong>Giao diện</strong>: <strong>🌙/☀</strong> tối/sáng · <strong>VN/EN</strong> ngôn ngữ giao diện · <strong>🖨</strong> in / lưu PDF bài kinh hiện tại. Trên điện thoại/máy tính bảng, hộp thoại in cho phép <strong>"Save to Files"</strong> (iOS) hoặc <strong>"Save as PDF"</strong> (Android) để tải file về. Lưu ý: bài kinh dài (hàng ngàn đoạn) có thể <strong>mất vài giây đến vài chục giây</strong> để chuẩn bị — vui lòng đợi.</li>' +
'<li><strong>Ngôn ngữ</strong>: bật/tắt cột <code>PĀLI</code> · <code>ENGLISH</code> · <code>VIỆT</code> (luôn giữ tối thiểu 1 cột).</li>' +
'<li><strong>Bố cục</strong>: <code>☰ Xếp dọc</code> — stack 3 cột · <code># Segment</code> — ẩn/hiện mã đoạn · <code>▦ Label</code> — ẩn/hiện nhãn cột.</li>' +
'<li><strong>Cỡ chữ</strong>: slider 80–160% (chỉ áp cho nội dung). <strong>Giãn dòng</strong>: 1.3–2.6.</li>' +
'<li><strong>↺ A</strong> / <strong>↺ ☰</strong>: reset cỡ chữ / giãn dòng về mặc định.</li>' +
'<li><strong>🐞</strong>: debug.</li>' +
'</ul>' +
'<h3>🔊 Đọc to (TTS)</h3>' +
'<ul>' +
'<li><strong>▶ Play</strong>: đọc kinh theo ngôn ngữ giao diện (Việt hoặc Anh). Pāli chưa hỗ trợ.</li>' +
'<li><strong>⏸ Pause</strong>: giới hạn trình duyệt — khi tiếp tục sẽ đọc lại câu hiện tại từ đầu.</li>' +
'<li><strong>⏹ Stop</strong>: dừng hẳn, lần sau Play đọc từ đầu bài.</li>' +
'<li>Vị trí đọc lưu theo từng bài — mở lại sẽ tiếp tục từ đoạn trước.</li>' +
'<li>Android cần cài <strong>Google TTS Engine</strong> để có giọng tiếng Việt.</li>' +
'</ul>' +
'<h3>💾 Lưu tự động</h3>' +
'<ul>' +
'<li><strong>Vị trí cuộn</strong> theo từng bài · <strong>Bài mở gần nhất</strong> (mở lại app tự tiếp tục).</li>' +
'<li><strong>Danh sách đã lưu</strong> · <strong>Tile đang chọn</strong> (DN/MN/SN/AN/★).</li>' +
'<li><strong>Cài đặt</strong>: ngôn ngữ, cột hiển thị, bố cục, cỡ chữ, giãn dòng, dark mode, vị trí TTS.</li>' +
'</ul>' +
'<h3>🎹 Phím tắt</h3>' +
'<ul>' +
'<li><kbd>Esc</kbd> — đóng panel đang mở (Thư viện / Cài đặt / Guide)</li>' +
'</ul>' +
'<h3>ℹ Nguồn</h3>' +
'<p>Văn bản Pāli + bản dịch tiếng Anh Bhikkhu Sujato từ <a href="https://suttacentral.net/" target="_blank" rel="noopener">SuttaCentral</a> (dự án Bilara). Bản dịch tiếng Việt biên tập từ nhiều nguồn, có thể còn sai sót — vui lòng đối chiếu bản Pāli và tiếng Anh.</p>' +
'<p>Góp ý, báo lỗi: <code>tuanctvn199@gmail.com</code></p>' +
'<button id="btnCloseGuide" type="button">Đóng</button>';
var enHtml =
'<h2>User Guide</h2>' +
'<em>Trilingual sutta reader: Pāli · English · Vietnamese — source SuttaCentral.</em>' +
'<h3>📖 Library</h3>' +
'<ul>' +
'<li>Tap <strong>Library</strong> in the footer center to open the catalogue.</li>' +
'<li>Choose one of <strong>5 tiles</strong>: <code>DN</code> Long · <code>MN</code> Middle · <code>SN</code> Connected · <code>AN</code> Numerical · <strong>★ Saved</strong> (bookmarked suttas).</li>' +
'<li><strong>DN / MN</strong>: flat list of all suttas. <strong>SN / AN</strong>: grouped by Saṁyutta / Vagga — tap to expand.</li>' +
'<li><strong>Search</strong>: filter by name, code (<code>mn 23</code>) or keyword — across all 4 nikāyas. <em>Diacritics optional</em> ("pham vong" finds "Phạm Võng").</li>' +
'<li>Tap <strong>×</strong> or click outside to close.</li>' +
'</ul>' +
'<h3>⭐ Bookmarks</h3>' +
'<ul>' +
'<li>Tap <strong>☆</strong> next to the current sutta title (top-right of header) to save / unsave.</li>' +
'<li>Tap <strong>☆</strong> next to any sutta in the library to save it without opening.</li>' +
'<li>The <strong>★ Saved</strong> tile shows a count — tap to view the list. Sorted by natural order in each nikāya.</li>' +
'<li>Bookmarks are stored locally in the browser, not synced across devices.</li>' +
'</ul>' +
'<h3>📜 Reading</h3>' +
'<ul>' +
'<li><strong>Title header</strong>: Nikāya · Code · Pāli name · Counterpart name (VI/EN).</li>' +
'<li>Content split into <strong>segments</strong> — ID on the left (e.g. <code>MN23.1.1</code>).</li>' +
'<li>Desktop: <strong>Pāli full-width top</strong>, <strong>English + Vietnamese</strong> side-by-side below. Mobile / iPad auto-stacks vertically.</li>' +
'<li><strong>Chapter numbers</strong> centered as dividers. <strong>SOURCE</strong> row at the end.</li>' +
'<li><strong>Nav title</strong> in the footer center — tap to open the library at the current sutta.</li>' +
'<li><strong>‹ PREV / NEXT ›</strong>: navigate sequentially within the nikāya.</li>' +
'<li><strong>⬆ Back to top</strong> (bottom-right FAB): jump to top and clear the scroll anchor.</li>' +
'</ul>' +
'<h3>⚙ Settings</h3>' +
'<ul>' +
'<li><strong>Interface</strong>: <strong>🌙/☀</strong> dark/light · <strong>VN/EN</strong> interface language · <strong>🖨</strong> print / save current sutta to PDF. On phone/tablet, the native print sheet offers <strong>"Save to Files"</strong> (iOS) or <strong>"Save as PDF"</strong> (Android) to download the file. Note: long suttas (thousands of segments) may need <strong>a few seconds to tens of seconds</strong> to prepare — please wait.</li>' +
'<li><strong>Languages</strong>: toggle <code>PĀLI</code> · <code>ENGLISH</code> · <code>VIỆT</code> columns (at least one must stay on).</li>' +
'<li><strong>Layout</strong>: <code>☰ Stack</code> — vertical stack · <code># Segment</code> — show/hide segment IDs · <code>▦ Label</code> — show/hide column headers.</li>' +
'<li><strong>Font size</strong>: slider 80–160% (body text only). <strong>Line height</strong>: 1.3–2.6.</li>' +
'<li><strong>↺ A</strong> / <strong>↺ ☰</strong>: reset font size / line height.</li>' +
'<li><strong>🐞</strong>: debug.</li>' +
'</ul>' +
'<h3>🔊 Text-to-Speech</h3>' +
'<ul>' +
'<li><strong>▶ Play</strong>: reads in UI language (VI or EN). Pāli not supported.</li>' +
'<li><strong>⏸ Pause</strong>: browser limitation — resume restarts the current sentence.</li>' +
'<li><strong>⏹ Stop</strong>: stops entirely; next Play starts from the beginning.</li>' +
'<li>TTS position is saved per sutta — reopening resumes where you left off.</li>' +
'<li>Android may need <strong>Google TTS Engine</strong> for the Vietnamese voice.</li>' +
'</ul>' +
'<h3>💾 Auto-save</h3>' +
'<ul>' +
'<li><strong>Scroll position</strong> per sutta · <strong>Last opened sutta</strong> (auto-restored on reload).</li>' +
'<li><strong>Bookmarks</strong> · <strong>Active tile</strong> (DN/MN/SN/AN/★).</li>' +
'<li><strong>Settings</strong>: language, visible columns, layout, font size, line height, dark mode, TTS position.</li>' +
'</ul>' +
'<h3>🎹 Shortcuts</h3>' +
'<ul>' +
'<li><kbd>Esc</kbd> — close open panel (Library / Settings / Guide)</li>' +
'</ul>' +
'<h3>ℹ Sources</h3>' +
'<p>Pāli text and Bhikkhu Sujato English translations from <a href="https://suttacentral.net/" target="_blank" rel="noopener">SuttaCentral</a> (Bilara project). Vietnamese translations compiled from multiple sources — please cross-reference Pāli and English originals.</p>' +
'<p>Feedback / bug reports: <code>tuanctvn199@gmail.com</code></p>' +
'<button id="btnCloseGuide" type="button">Close</button>';
dlg.innerHTML = isEn ? enHtml : viHtml;
var btnClose = $('btnCloseGuide');
if (btnClose) btnClose.onclick = closeGuide;
}
function openGuide() {
if (!guideOverlay) return;
renderGuideDialog();
guideOverlay.classList.add('show');
guideOverlay.setAttribute('aria-hidden', 'false');
setTimeout(function () { var b = $('btnCloseGuide'); if (b) b.focus(); }, 50);
}
function closeGuide() {
if (!guideOverlay) return;
guideOverlay.classList.remove('show');
guideOverlay.setAttribute('aria-hidden', 'true');
if (btnGuide) btnGuide.focus();
}
/* ============================================================
Panel top position
============================================================ */
// Tạo một biến để theo dõi sự thay đổi kích thước
const resizeObserver = new ResizeObserver(entries => {
for (let entry of entries) {
// Chỉ cập nhật khi trình duyệt rảnh (requestAnimationFrame)
requestAnimationFrame(() => {
if (sutraMenuPanel) {
sutraMenuPanel.style.top = entry.contentRect.height + 'px';
}
});
}
});
function updateMenuPanelTop() {
if (!card) return;
const topNote = card.querySelector('.top-note');
if (topNote) {
resizeObserver.observe(topNote); // Bắt đầu theo dõi phần tử này
} else {
sutraMenuPanel.style.top = '0px';
}
}
/* ============================================================
PANEL LOGIC
============================================================ */
function togglePanel(panel, force) {
if (!panel) return;
var isOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
/* FIX: Before closing a panel, move focus OUT of it if it currently
contains the focused element. This prevents the browser error:
"Blocked aria-hidden on an element because its descendant retained focus" */
if (!isOpen && panel.contains(document.activeElement)) {
// Move focus to a safe element outside the panel
if (btnSutraMenu) {
btnSutraMenu.focus();
} else {
document.activeElement.blur();
}
}
panel.classList.toggle('open', isOpen);
if (isOpen) {
panel.setAttribute('aria-hidden', 'false');
panel.removeAttribute('inert');
} else {
panel.setAttribute('aria-hidden', 'true');
panel.setAttribute('inert', '');
}
if (panel === settingsPanel && btnSettings) {
btnSettings.setAttribute('aria-expanded', String(isOpen));
btnSettings.classList.toggle('active', isOpen);
}
if (panel === sutraMenuPanel && btnSutraMenu) {
btnSutraMenu.setAttribute('aria-expanded', String(isOpen));
btnSutraMenu.classList.toggle('is-open', isOpen);
}
}
function positionSettingsPanel() {
if (!settingsPanel || !btnSutraMenu || !card) return;
var left   = btnSutraMenu.offsetLeft + btnSutraMenu.offsetWidth + 6;
var cardH  = card.offsetHeight;
var btnBottom = btnSutraMenu.offsetTop + btnSutraMenu.offsetHeight;
var bottom = cardH - btnBottom;
settingsPanel.style.left   = left + 'px';
settingsPanel.style.bottom = bottom + 'px';
settingsPanel.style.top    = 'auto';
settingsPanel.style.right  = 'auto';
}
function closePanels() {
togglePanel(settingsPanel, false);
togglePanel(sutraMenuPanel, false);
}
if (btnSutraMenu) {
btnSutraMenu.onclick = function (e) {
e.stopPropagation();
var willOpen = !sutraMenuPanel.classList.contains('open');
togglePanel(settingsPanel, false);
togglePanel(sutraMenuPanel, willOpen);
// Defensive: nếu list rỗng khi mở (race condition / init chưa xong),
// re-render nikaya đang active để đảm bảo user luôn thấy danh sách.
if (willOpen && sutraMenuList && sutraMenuList.children.length === 0) {
var nikKey = activeNikayaKey || (window.SUTRA_INDEX && window.SUTRA_INDEX[0] && window.SUTRA_INDEX[0].key);
if (nikKey) {
if (!window.SUTRA_INDEX || !window.SUTRA_INDEX.length) return;
// Nếu buildSutraMenuFromIndex chưa chạy, chạy full flow
if (!FLAT_SUTTAS.length) buildSutraMenuFromIndex();
else setActiveNikaya(nikKey, false);
}
}
};
}
// Nút × đóng panel Thư viện (compat UI mới)
var menuCloseBtn = $('menuCloseBtn');
if (menuCloseBtn) {
menuCloseBtn.onclick = function (e) {
e.stopPropagation();
togglePanel(sutraMenuPanel, false);
};
}
if (btnSettings) {
btnSettings.onclick = function (e) {
e.stopPropagation();
var willOpen = !settingsPanel.classList.contains('open');
if (willOpen) {
/* Close sutraMenuPanel first (togglePanel will safely move focus
out of the panel before setting inert) */
togglePanel(sutraMenuPanel, false);
positionSettingsPanel();
}
togglePanel(settingsPanel, willOpen);
};
}
if (btnGuide && guideOverlay) {
btnGuide.onclick = function (e) {
e.stopPropagation();
openGuide();  // mở guide overlay, giữ nguyên sidebar
};
}
if (guideOverlay) {
guideOverlay.addEventListener('click', function (e) {
if (e.target === guideOverlay) closeGuide();
});
}
document.addEventListener('click', function (e) {
var t = e.target;
if (sutraMenuPanel && sutraMenuPanel.contains(t)) return;
if (settingsPanel && settingsPanel.contains(t)) return;
if (btnSutraMenu && btnSutraMenu.contains(t)) return;
// Don't close sidebar when interacting with guide overlay
if (guideOverlay && guideOverlay.contains(t)) return;
closePanels();
});
document.addEventListener('keydown', function (e) {
if (e.key === 'Escape') {
if (guideOverlay && guideOverlay.classList.contains('show')) return closeGuide();
closePanels();
}
});
var showSegKey = true;
var showColHdr = true;
// 3 toggle riêng cho comment theo lang. Master = derived state: "any of 3 is ON".
var showCmtPli = true;
var showCmtEng = true;
var showCmtVie = true;
// 3 toggle nổi bật (italic + ink đậm, giống Pāli hiện tại)
var hlPli = true;   // default ON — Pāli theo convention kinh điển italic
var hlEng = false;
var hlVie = false;
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
const mql = window.matchMedia('(max-width: 500px)');
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
var savedScopeMatch = String(key).match(/^(.+):(\d+)/);
if (savedScopeMatch) {
var savedScope = savedScopeMatch[1] + ':' + savedScopeMatch[2];
for (var sk = 0; sk < virtAllRows.length; sk++) {
var curKey = String(virtAllRows[sk].key || '');
var m = curKey.match(/^(.+):(\d+)/);
if (m && (m[1] + ':' + m[2]) === savedScope) {
foundIdx = sk;
if (window.DEBUG_ANCHOR) console.log('[ANCHOR RESTORE] fallback matched scope "' + savedScope + '" at idx=' + sk + ' key=' + curKey);
break;
}
}
}
}
if (window.DEBUG_ANCHOR) console.log('[ANCHOR RESTORE] foundIdx=' + foundIdx + ' in virtAllRows.length=' + virtAllRows.length);
if (foundIdx < 0) return false;
// Chỉ materialize chunk chứa anchor (eager-around-anchor đã render ±1 chunks).
// IntersectionObserver sẽ tự materialize neighbors khi user scroll. Tránh render
// hàng nghìn row sync khi anchor ở cuối file dài.
ensureRowRendered(foundIdx);
if (window.DEBUG_ANCHOR) {
var matCnt = 0;
for (var mc = 0; mc < virtChunks.length; mc++) if (virtChunks[mc].materialized) matCnt++;
console.log('[ANCHOR RESTORE] chunks materialized after ensureRowRendered: ' + matCnt + '/' + virtChunks.length);
}
var safeKey = safeCssEscape(key);
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
function toggleBackTop(show) { if (!btnBackTop) return; btnBackTop.classList.toggle('visible', show); }
// Throttle save (leading-edge) + debounce (trailing-edge) cho final stable top sau khi user dừng scroll.
// `pagehide` + `visibilitychange` đã đảm bảo save lúc rời trang nên debounce ngắn là đủ.
// Skip nếu _progScrollUntil > now (suppress window cho programmatic scroll).
var _saveAnchorThrottled = throttle(saveScrollAnchorNow, 250);
var _saveAnchorDebounced = debounce(saveScrollAnchorNow, 200);
var _backTopThrottled = throttle(function (v) { toggleBackTop(v); }, 120);
if (scrollEl) scrollEl.addEventListener('scroll', function () {
if (!suppressBackTop) _backTopThrottled(scrollEl.scrollTop > 0);
_saveAnchorThrottled();
_saveAnchorDebounced();
}, { passive: true });
if (btnBackTop && scrollEl) btnBackTop.onclick = function () {
suppressBackTop = true;
toggleBackTop(false);
scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
var done = function () {
suppressBackTop = false;
toggleBackTop(false);
if (currentSutraId) {
storage.remove(KEY_ANCHOR_K(currentSutraId));
}
};
if ('onscrollend' in scrollEl) {
scrollEl.addEventListener('scrollend', done, { once: true });
} else {
var prev = -1;
var poll = function () {
var st = scrollEl.scrollTop;
if (st === 0 && st === prev) { done(); return; }
prev = st;
requestAnimationFrame(poll);
};
requestAnimationFrame(poll);
}
};
function buildSuttaLinkHtml(s) {
var codePrefix = s.code ? s.code + ' – ' : '';
var viLabel = s.titleVi || '', enLabel = s.titleEn || '', paliLabel = s.titlePali || '';
var mainText, subText;
if (uiLang === 'en') {
mainText = codePrefix + (enLabel || viLabel || paliLabel || s.id);
subText  = paliLabel || viLabel || '';
} else {
mainText = codePrefix + (viLabel || enLabel || paliLabel || s.id);
subText  = paliLabel || enLabel || '';
}
var marked = isBookmarked(s.id);
var bl = bookmarkLabels();
var starTitle = marked ? bl.on : bl.off;
var starHtml =
'<button type="button" class="menu-bookmark-btn' + (marked ? ' is-on' : '') + '" ' +
'data-id="' + escapeAttr(s.id) + '" aria-pressed="' + (marked ? 'true' : 'false') + '" ' +
'aria-label="' + escapeAttr(starTitle) + '" title="' + escapeAttr(starTitle) + '">' +
'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
'<path d="M10 2.3l2.39 4.84 5.34.78-3.86 3.77.91 5.31L10 14.49l-4.78 2.51.91-5.31L2.27 7.92l5.34-.78z"/>' +
'</svg></button>';
return '<a href="#" class="menu-sutta-link" role="treeitem" data-id="' + escapeAttr(s.id) + '" aria-label="' + escapeAttr(mainText) + '">' +
'<div class="sutra-label">' +
'<div class="sutra-label-main">' + escapeHtml(mainText) + '</div>' +
(subText ? '<div class="sutra-label-sub">' + escapeHtml(subText) + '</div>' : '') +
'</div>' + starHtml + '</a>';
}
function extractGroupKey(code) {
var m = String(code || '').match(/^([A-Za-z]+\s*\d+)\s*[–\-]/);
return m ? m[1].trim() : String(code || '').trim();
}
function buildMenuChildren(children, parentId) {
if (!children || !children.length) return '';
var allSutta = true;
for (var k = 0; k < children.length; k++) {
if (children[k].type !== 'sutta') { allSutta = false; break; }
}
if (allSutta) {
var keys = [], groups = {};
for (var i = 0; i < children.length; i++) {
var gk = extractGroupKey(children[i].code);
if (!groups[gk]) { groups[gk] = []; keys.push(gk); }
groups[gk].push(children[i]);
}
var hasMultiChild = keys.some(function (kk) { return groups[kk].length > 1; });
if (keys.length >= 2 && hasMultiChild) {
var html = '';
for (var j = 0; j < keys.length; j++) {
var key = keys[j];
var grpId = safeDomId(parentId + '-' + key.replace(/\s+/g, '_'));
var subHtml = groups[key].map(buildSuttaLinkHtml).join('');
html += '<div class="menu-subblock" role="group">' +
'<button class="menu-toggle nested" type="button" data-target="' + escapeAttr(grpId) + '"' +
' aria-expanded="false" aria-controls="' + escapeAttr(grpId) + '">' +
'<span>' + escapeHtml(key) + '</span><span class="chevron" aria-hidden="true">▸</span>' +
'</button>' +
'<div id="' + escapeAttr(grpId) + '" class="menu-list collapsed">' + subHtml + '</div>' +
'</div>';
}
return html;
}
return children.map(buildSuttaLinkHtml).join('');
}
var html2 = '';
for (var m2 = 0; m2 < children.length; m2++) {
var child = children[m2];
if (child.type === 'group') {
var grpId2 = safeDomId(parentId + '-' + child.key);
var label = uiLang === 'en'
? child.labelEn || child.labelVi || child.key
: child.labelVi || child.labelEn || child.key;
html2 += '<div class="menu-subblock" role="group">' +
'<button class="menu-toggle nested" type="button" data-target="' + escapeAttr(grpId2) + '"' +
' aria-expanded="false" aria-controls="' + escapeAttr(grpId2) + '">' +
'<span>' + escapeHtml(label) + '</span><span class="chevron" aria-hidden="true">▸</span>' +
'</button>' +
'<div id="' + escapeAttr(grpId2) + '" class="menu-list collapsed">' + buildMenuChildren(child.children || [], grpId2) + '</div>' +
'</div>';
} else if (child.type === 'sutta') {
html2 += buildSuttaLinkHtml(child);
}
}
return html2;
}
var activeNikayaKey = null;
var KEY_ACTIVE_NIKAYA = 'active_nikaya_tile';
function rebuildGlobalSutraOrder() {
var index = window.SUTRA_INDEX || [];
var order = [];
function walk(children) {
if (!children || !children.length) return;
for (var i = 0; i < children.length; i++) {
var ch = children[i];
if (ch.type === 'sutta' && ch.id) order.push(ch.id);
else if (ch.type === 'group') walk(ch.children || []);
}
}
for (var i = 0; i < index.length; i++) walk(index[i].children || []);
SUTRA_ORDER = order;
}
function renderNikayaList(nikKey) {
if (!sutraMenuList) return;
var index = window.SUTRA_INDEX || [];
var nik = null;
for (var i = 0; i < index.length; i++) {
if (index[i].key === nikKey) { nik = index[i]; break; }
}
if (!nik) {
sutraMenuList.innerHTML = '';
return;
}
var secId = safeDomId('sec-' + nik.key);
sutraMenuList.innerHTML = buildMenuChildren(nik.children || [], secId);
highlightActiveInMenu();
}
function setActiveNikaya(nikKey, persist) {
activeNikayaKey = nikKey;
var tiles = document.querySelectorAll('.nikaya-tile');
for (var i = 0; i < tiles.length; i++) {
var isActive = tiles[i].getAttribute('data-nikaya') === nikKey;
tiles[i].classList.toggle('active', isActive);
tiles[i].setAttribute('aria-selected', String(isActive));
}
if (nikKey === 'BM') renderBookmarksList();
else renderNikayaList(nikKey);
if (persist) storage.set(KEY_ACTIVE_NIKAYA, nikKey);
}
function renderBookmarksList() {
if (!sutraMenuList) return;
var order = SUTRA_ORDER && SUTRA_ORDER.length ? SUTRA_ORDER : Array.from(BOOKMARKS);
var ids = order.filter(function (id) { return BOOKMARKS.has(id); });
if (!ids.length) {
var bl = bookmarkLabels();
sutraMenuList.innerHTML = '<li class="menu-empty" style="padding:18px 22px;color:var(--ink-light);font-style:italic;list-style:none">' + escapeHtml(bl.empty) + '</li>';
return;
}
var html = '';
for (var i = 0; i < ids.length; i++) {
var meta = findMetaById(ids[i]);
if (meta) html += buildSuttaLinkHtml(meta);
}
sutraMenuList.innerHTML = html;
highlightActiveInMenu();
}
function updateBookmarksCount() {
var el = $('bookmarksCount');
if (!el) return;
var n = BOOKMARKS.size;
el.textContent = n ? String(n) : '';
el.classList.toggle('is-empty', n === 0);
}
function reflectBookmarkState(id, on) {
var bl = bookmarkLabels();
var label = on ? bl.on : bl.off;
if (sutraMenuList) {
var starsInMenu = sutraMenuList.querySelectorAll('.menu-bookmark-btn[data-id="' + safeCssEscape(id) + '"]');
for (var i = 0; i < starsInMenu.length; i++) {
var b = starsInMenu[i];
b.classList.toggle('is-on', !!on);
b.setAttribute('aria-pressed', on ? 'true' : 'false');
b.setAttribute('aria-label', label);
b.setAttribute('title', label);
}
}
if (id === currentSutraId) applyTitleBookmarkState();
updateBookmarksCount();
}
function applyTitleBookmarkState() {
var btn = $('btnBookmarkCurrent');
if (!btn) return;
if (!currentSutraId) { btn.hidden = true; return; }
btn.hidden = false;
var on = isBookmarked(currentSutraId);
var bl = bookmarkLabels();
var label = on ? bl.on : bl.off;
btn.classList.toggle('is-on', on);
btn.setAttribute('aria-pressed', on ? 'true' : 'false');
btn.setAttribute('aria-label', label);
btn.setAttribute('title', label);
}
function findNikayaOfSutta(suttaId) {
var index = window.SUTRA_INDEX || [];
for (var i = 0; i < index.length; i++) {
var nik = index[i];
var found = false;
(function walk(children) {
if (!children || found) return;
for (var j = 0; j < children.length; j++) {
var ch = children[j];
if (ch.type === 'sutta' && ch.id === suttaId) { found = true; return; }
if (ch.type === 'group') walk(ch.children || []);
}
})(nik.children || []);
if (found) return nik.key;
}
return null;
}
function applyTileLabels() {
var tiles = document.querySelectorAll('.nikaya-tile .tile-label');
for (var i = 0; i < tiles.length; i++) {
var el = tiles[i];
el.textContent = uiLang === 'en' ? (el.getAttribute('data-en') || '') : (el.getAttribute('data-vi') || '');
}
}
function normStr(s) {
return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function populateFlatSuttas() {
FLAT_SUTTAS = [];
var index = window.SUTRA_INDEX || [];
function walk(children) {
if (!children || !children.length) return;
for (var i = 0; i < children.length; i++) {
var ch = children[i];
if (ch.type === 'sutta' && ch.id) {
var codePrefix = ch.code ? ch.code + ' – ' : '';
var viLabel = ch.titleVi || '', enLabel = ch.titleEn || '', paliLabel = ch.titlePali || '';
var mainText = uiLang === 'en'
? codePrefix + (enLabel || viLabel || paliLabel || ch.id)
: codePrefix + (viLabel || enLabel || paliLabel || ch.id);
var subText  = uiLang === 'en' ? (paliLabel || viLabel || '') : (paliLabel || enLabel || '');
FLAT_SUTTAS.push({
id: ch.id, main: mainText, sub: subText,
flat: normStr(mainText + ' ' + viLabel + ' ' + enLabel + ' ' + paliLabel + ' ' + ch.id)
});
}
else if (ch.type === 'group') walk(ch.children || []);
}
}
for (var i = 0; i < index.length; i++) walk(index[i].children || []);
}
function buildSutraMenuFromIndex() {
var index = window.SUTRA_INDEX || [];
if (!Array.isArray(index) || !index.length) {
if (sutraMenuList) {
var msg = uiLang === 'en' ? 'No sutta index found. Make sure toc.js is loaded.' : 'Chưa có mục lục. Hãy đảm bảo file toc.js đã được tải.';
sutraMenuList.innerHTML = '<li style="padding:10px;color:var(--ink-light);font-style:italic">' + escapeHtml(msg) + '</li>';
}
return;
}
rebuildGlobalSutraOrder();
populateFlatSuttas();
applyTileLabels();
if (sutraMenuPanel && !sutraMenuPanel._tileWired) {
sutraMenuPanel._tileWired = true;
sutraMenuPanel.addEventListener('click', function (e) {
var tile = e.target.closest('.nikaya-tile');
if (!tile || !sutraMenuPanel.contains(tile)) return;
e.stopPropagation();
var k = tile.getAttribute('data-nikaya');
if (k) setActiveNikaya(k, true);
});
}
var initial = null;
if (currentSutraId) initial = findNikayaOfSutta(currentSutraId);
if (!initial) initial = storage.get(KEY_ACTIVE_NIKAYA);
if (!initial && index[0]) initial = index[0].key;
setActiveNikaya(initial, false);
}
function highlightActiveInMenu() {
if (!sutraMenuList) return;
sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(function (a) {
var isActive = a.getAttribute('data-id') === currentSutraId;
a.classList.toggle('active', isActive);
a.setAttribute('aria-current', isActive ? 'page' : 'false');
});
}
function syncTileToCurrentSutta() {
if (!currentSutraId) return;
var nik = findNikayaOfSutta(currentSutraId);
if (nik && nik !== activeNikayaKey) {
setActiveNikaya(nik, true);
}
}
function renderSearchResults(matches, q) {
if (!searchResultsEl) return;
if (!q) { searchResultsEl.innerHTML = ''; return; }
if (!matches.length) {
var msg = uiLang === 'en' ? 'No matching sutta found.' : 'Không tìm thấy kinh phù hợp.';
searchResultsEl.innerHTML = '<div class="search-result-empty" role="status">' + escapeHtml(msg) + '</div>';
return;
}
var html = '';
for (var i = 0; i < matches.length; i++) {
var m = matches[i];
html += '<button class="search-result-item" data-id="' + escapeAttr(m.id) + '" role="option">' +
'<span class="search-main">' + escapeHtml(m.main) + '</span>' +
(m.sub ? '<span class="search-sub">' + escapeHtml(m.sub) + '</span>' : '') +
'</button>';
}
searchResultsEl.innerHTML = html;
}
function applySearch(query) {
var q = normStr((query || '').trim());
if (!q) return renderSearchResults([], '');
var matches = FLAT_SUTTAS.filter(function (x) { return x.flat.includes(q); }).slice(0, 80);
renderSearchResults(matches, query);
}
if (searchInput) searchInput.addEventListener('input', debounce(function (e) { applySearch(e.target.value); }, 180));
// ── Share / copy segment link ──────────────────────────────────────
function _showToast(msg) {
var t = document.getElementById('appToast');
if (!t) {
t = document.createElement('div');
t.id = 'appToast';
t.className = 'app-toast';
t.setAttribute('role', 'status');
t.setAttribute('aria-live', 'polite');
document.body.appendChild(t);
}
t.textContent = msg;
t.classList.add('show');
clearTimeout(_showToast._tm);
_showToast._tm = setTimeout(function () { t.classList.remove('show'); }, 1800);
}
function _buildShareUrl(keyRaw) {
return location.origin + location.pathname + '#' + keyRaw;
}
function shareSegment(keyRaw) {
if (!keyRaw) return;
var url = _buildShareUrl(keyRaw);
var titleText = (document.getElementById('title') || {}).textContent || 'Sutta Archive';
// Web Share API ưu tiên — chủ yếu mobile; user chọn Zalo/FB/Messenger từ system sheet.
if (navigator.share) {
navigator.share({ title: titleText, text: keyRaw, url: url }).catch(function () { /* user huỷ — không cần fallback */ });
return;
}
// Fallback: copy clipboard.
var done = function () { _showToast(uiLang === 'en' ? 'Link copied' : 'Đã sao chép link'); };
var fail = function () { _showToast(uiLang === 'en' ? 'Copy failed' : 'Sao chép thất bại'); };
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(url).then(done).catch(function () {
_legacyCopy(url) ? done() : fail();
});
} else {
_legacyCopy(url) ? done() : fail();
}
}
function _legacyCopy(text) {
try {
var ta = document.createElement('textarea');
ta.value = text;
ta.style.position = 'fixed'; ta.style.left = '-9999px';
document.body.appendChild(ta);
ta.select();
var ok = document.execCommand('copy');
document.body.removeChild(ta);
return ok;
} catch (e) { return false; }
}
function initDelegations() {
if (grid && !grid._shareDel) {
grid.addEventListener('click', function (ev) {
var btn = ev.target.closest('.sutra-seg-share');
if (btn && grid.contains(btn)) {
ev.preventDefault();
ev.stopPropagation();
shareSegment(btn.getAttribute('data-share-key'));
}
});
grid._shareDel = true;
}
if (sutraMenuList && !sutraMenuList._del) {
sutraMenuList.addEventListener('click', function (ev) {
var starBtn = ev.target.closest('.menu-bookmark-btn');
if (starBtn && sutraMenuList.contains(starBtn)) {
ev.preventDefault();
ev.stopPropagation();
var sid = starBtn.getAttribute('data-id');
if (sid) {
var now = toggleBookmark(sid);
reflectBookmarkState(sid, now);
if (activeNikayaKey === 'BM' && !now) renderBookmarksList();
}
return;
}
var btn = ev.target.closest('.menu-toggle');
if (btn && sutraMenuList.contains(btn)) {
ev.preventDefault();
var panel = document.getElementById(btn.dataset.target);
if (!panel) return;
var wasCollapsed = panel.classList.contains('collapsed');
var isNested = btn.classList.contains('nested');
if (wasCollapsed) {
var scope = isNested ? btn.closest('.menu-list') : sutraMenuList;
var sel   = isNested ? '.menu-toggle.nested' : '.menu-toggle:not(.nested)';
if (scope) scope.querySelectorAll(sel).forEach(function (o) {
if (o === btn) return;
var op = document.getElementById(o.dataset.target);
if (op && !op.classList.contains('collapsed')) {
op.classList.add('collapsed');
o.setAttribute('aria-expanded', 'false');
var c = o.querySelector('.chevron'); if (c) c.textContent = '▸';
if (!isNested) op.querySelectorAll('.menu-toggle.nested').forEach(function (nb) {
var np = document.getElementById(nb.dataset.target);
if (np && !np.classList.contains('collapsed')) np.classList.add('collapsed');
nb.setAttribute('aria-expanded', 'false');
var c2 = nb.querySelector('.chevron'); if (c2) c2.textContent = '▸';
});
}
});
}
panel.classList.toggle('collapsed', !wasCollapsed);
var isCollapsedNow = panel.classList.contains('collapsed');
btn.setAttribute('aria-expanded', isCollapsedNow ? 'false' : 'true');
var ch = btn.querySelector('.chevron');
if (ch) ch.textContent = isCollapsedNow ? '▸' : '▾';
return;
}
var a = ev.target.closest('.menu-sutta-link');
if (a && sutraMenuList.contains(a)) {
ev.preventDefault();
var id = a.getAttribute('data-id');
if (id) {
openSutra(id);
closePanels();
if (searchInput) searchInput.value = '';
if (searchResultsEl) searchResultsEl.innerHTML = '';
}
}
});
sutraMenuList._del = true;
}
if (searchResultsEl && !searchResultsEl._del) {
searchResultsEl.addEventListener('click', function (ev) {
var btn = ev.target.closest('.search-result-item');
if (btn) {
var id = btn.getAttribute('data-id');
if (id) {
openSutra(id);
closePanels();
if (searchInput) searchInput.value = '';
searchResultsEl.innerHTML = '';
}
}
});
searchResultsEl._del = true;
}
}
function findMetaById(id) {
var index = window.SUTRA_INDEX || [];
var found = null;
function walk(children, currentParent, rootNikaya) {
if (!children || !children.length || found) return;
for (var i = 0; i < children.length; i++) {
if (found) return;
var ch = children[i];
if (ch.type === 'sutta' && ch.id === id) {
found = Object.assign({}, ch);
found.parentGroup = currentParent;
found.rootNikaya  = rootNikaya;
return;
}
if (ch.type === 'group') walk(ch.children || [], ch, rootNikaya);
}
}
for (var i = 0; i < index.length; i++) {
walk(index[i].children || [], index[i], index[i]);
if (found) break;
}
return found;
}
function getColHeaders() {
return uiLang === 'en'
? { pali: 'Pali', eng: 'English', vie: 'Vietnamese' }
: { pali: 'Pali', eng: 'English', vie: 'Tiếng Việt' };
}
function createRow(r) {
var wrap = document.createElement('div'); wrap.className = 'sutra-row-wrap';
var keyRaw = String(r.key || '');
var tp = (r.pali || '').trim();
var te = (r.eng  || '').trim();
var tv = (r.vie  || '').trim();
var isSectionNum = (tp.length <= 6 && te.length <= 6 && tv.length <= 6) &&
/^[IVXLCDM]+\.?$|^\d+\.?$/.test(tp || te || tv);
if (isSectionNum) wrap.classList.add('is-section-num');
if (/:source$/i.test(keyRaw)) wrap.classList.add('is-source');
// Merged paragraph rows (từ mergeRowsToParagraphRows) giữ key :0.3 để marker tra cứu
// nhưng KHÔNG áp is-subtitle vì nội dung là cả đoạn văn, không phải tiêu đề ngắn.
if (/:0\.[123]$/.test(keyRaw) && !r._merged) wrap.classList.add('is-subtitle');
wrap.setAttribute('data-key', keyRaw);
var keyShort = '';
if (keyRaw.includes(':')) {
var parts = keyRaw.split(':');
var prefix = parts[0].replace(/([a-zA-Z]+)(\d*)/, function (_, letters, nums) { return letters.toUpperCase() + nums; });
keyShort = parts[1] ? prefix + '.' + parts[1] : prefix;
} else { keyShort = keyRaw.toUpperCase(); }
if (keyShort) {
var segWrap = document.createElement('div');
segWrap.className = 'sutra-seg-keywrap';
var seg = document.createElement('div');
seg.className = 'sutra-seg-key'; seg.textContent = keyShort;
seg.setAttribute('aria-hidden', 'true');
segWrap.appendChild(seg);
var shareBtn = document.createElement('button');
shareBtn.type = 'button';
shareBtn.className = 'sutra-seg-share';
shareBtn.setAttribute('data-share-key', keyRaw);
shareBtn.setAttribute('aria-label', uiLang === 'en' ? 'Share / copy link to this segment' : 'Chia sẻ / sao chép link đoạn này');
shareBtn.title = uiLang === 'en' ? 'Share / copy link' : 'Chia sẻ / sao chép link';
shareBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5l-3-3-3 3"/><path d="M8 2v9"/><path d="M3 9v3a2 2 0 002 2h6a2 2 0 002-2V9"/></svg>';
segWrap.appendChild(shareBtn);
wrap.appendChild(segWrap);
}
var row = document.createElement('div');
row.className = 'sutra-row'; row.setAttribute('data-key', keyRaw);
var headers = getColHeaders();
// Chú giải per-lang — nằm BÊN TRONG cột tương ứng. Ẩn cột → ẩn luôn comment cột đó.
var cPli = resolveCommentLang(r.commentPli);
var cEng = resolveCommentLang(r.commentEn);
var cVie = resolveCommentLang(r.commentVie);
function ensureCmtHeader(col) {
// Gắn header 1 lần cho col — text theo đúng ngôn ngữ của col (giống PĀLI/ENGLISH/VIETNAMESE).
// Pāli: Aṭṭhakathā (chú giải) · English: Commentary · Việt: Chú giải
if (col.querySelector('.sutra-col-comments-header')) return;
var h = document.createElement('div');
h.className = 'sutra-col-comments-header';
h.setAttribute('aria-hidden', 'true');
if (col.classList.contains('pali-col')) h.textContent = 'Aṭṭhakathā';
else if (col.classList.contains('eng-col')) h.textContent = 'Commentary';
else h.textContent = 'Chú giải';
col.appendChild(h);
}
function makeCol(className, headerText, contentText, contentClass, cmtText) {
var col  = document.createElement('div'); col.className = 'sutra-col ' + className;
var hdr  = document.createElement('div'); hdr.className = 'sutra-col-header';
hdr.textContent = headerText; hdr.setAttribute('aria-hidden', 'true');
var body = document.createElement('div'); body.className = 'sutra-col-body';
var inner = document.createElement('div'); inner.className = contentClass;
inner.textContent = contentText || '';
body.appendChild(inner); col.appendChild(hdr); col.appendChild(body);
if (cmtText) {
ensureCmtHeader(col);
var cmt = document.createElement('div');
cmt.className = 'sutra-col-comment';
var icon = document.createElement('span');
icon.className = 'sutra-col-comment-icon'; icon.setAttribute('aria-hidden', 'true');
icon.textContent = '💬';
var txt = document.createElement('span');
txt.className = 'sutra-col-comment-text'; txt.textContent = cmtText;
cmt.appendChild(icon); cmt.appendChild(txt);
col.appendChild(cmt);
}
return col;
}
var pcol = makeCol('pali-col', headers.pali, r.pali, 'pali', cPli);
var ecol = makeCol('eng-col',  headers.eng,  r.eng,  'eng', cEng);
var vcol = makeCol('vie-col',  headers.vie,  r.vie,  'vie', cVie);
row.appendChild(pcol); row.appendChild(ecol); row.appendChild(vcol);
wrap.appendChild(row);
// Merged mode: aggregated comments vào col có text (không còn seg tag)
if (r._merged && Array.isArray(r._mergedComments) && r._mergedComments.length) {
var targetCol = r.pali ? pcol : (r.eng ? ecol : (r.vie ? vcol : null));
if (targetCol) {
ensureCmtHeader(targetCol);
for (var mi = 0; mi < r._mergedComments.length; mi++) {
var mc = r._mergedComments[mi];
var cBlk = document.createElement('div');
cBlk.className = 'sutra-col-comment sutra-col-comment-merged';
var icon = document.createElement('span');
icon.className = 'sutra-col-comment-icon'; icon.setAttribute('aria-hidden', 'true');
icon.textContent = '💬';
var txt = document.createElement('span');
txt.className = 'sutra-col-comment-text'; txt.textContent = mc.text;
cBlk.appendChild(icon); cBlk.appendChild(txt);
targetCol.appendChild(cBlk);
}
}
}
// Legacy single-file `comment` (không phân lang) — hiện full-width dưới row, chỉ khi
// không có per-lang data để tránh trùng lặp.
var cLegacy = resolveCommentText(r.comment);
if (cLegacy && !cPli && !cEng && !cVie) {
var legacy = document.createElement('div');
legacy.className = 'sutra-comment-legacy';
var li = document.createElement('span');
li.className = 'sutra-comment-legacy-icon'; li.setAttribute('aria-hidden', 'true');
li.textContent = '💬';
var lt = document.createElement('span');
lt.className = 'sutra-comment-legacy-text'; lt.textContent = cLegacy;
legacy.appendChild(li); legacy.appendChild(lt);
wrap.appendChild(legacy);
}
return wrap;
}
function resolveCommentLang(v) {
if (!v) return '';
if (typeof v === 'string') return v.trim();
return '';
}
function shortenSegKey(raw) {
var s = String(raw || '');
if (s.indexOf(':') !== -1) {
var parts = s.split(':');
var prefix = parts[0].replace(/([a-zA-Z]+)(\d*)/, function (_, l, n) { return l.toUpperCase() + n; });
return parts[1] ? prefix + '.' + parts[1] : prefix;
}
return s.toUpperCase();
}
function resolveCommentText(cmt) {
if (!cmt) return '';
if (typeof cmt === 'string') return cmt.trim();
if (typeof cmt === 'object') {
var pref = uiLang === 'en' ? ['en','vi','pli'] : ['vi','en','pli'];
for (var i = 0; i < pref.length; i++) {
var v = cmt[pref[i]];
if (typeof v === 'string' && v.trim()) return v.trim();
}
}
return '';
}
function getByExactOrSuffix(map, exactKey, suffix) {
if (!map) return '';
if (exactKey && map[exactKey]) return map[exactKey];
var keys = Object.keys(map);
var k = exactKey ? keys.find(function (x) { return x === exactKey; }) : null;
if (!k && suffix) k = keys.find(function (x) { return String(x).endsWith(suffix); });
return k ? map[k] || '' : '';
}
function pickTextForUiLangSuffix(merged, id, suffix) {
var exactKey = id + suffix;
if (uiLang === 'en') return getByExactOrSuffix(merged.engMap, exactKey, suffix)
|| getByExactOrSuffix(merged.vieMap, exactKey, suffix)
|| getByExactOrSuffix(merged.paliMap, exactKey, suffix) || '';
return getByExactOrSuffix(merged.vieMap, exactKey, suffix)
|| getByExactOrSuffix(merged.engMap, exactKey, suffix)
|| getByExactOrSuffix(merged.paliMap, exactKey, suffix) || '';
}
function renderWelcomeScreen() {
if (!grid || currentSutraId) return;
var isEn = uiLang === 'en';
if (superTitleEl) superTitleEl.textContent = '';
if (titleMetaEl)  titleMetaEl.textContent  = '';
if (titleEl)      titleEl.textContent      = isEn ? 'Sutta Archive' : 'Kho lưu trữ Kinh';
if (subtitleEl)   subtitleEl.textContent   = '';
applyTitleBookmarkState();
var quotes = [
{
pali: 'Namo tassa bhagavato arahato sammāsambuddhassa',
vi:   'Kính lễ Đức Thế Tôn, bậc A-la-hán, Chánh Đẳng Giác',
en:   'Homage to the Blessed One, the Worthy, the Perfectly Self-Enlightened',
note: isEn ? 'Traditional homage recited before reading the suttas' : 'Câu cung kính truyền thống trước khi đọc Kinh'
},
{
pali: 'Vayadhammā saṅkhārā, appamādena sampādetha',
vi:   'Các pháp hữu vi đều vô thường, hãy tinh tấn chớ có buông lung',
en:   'All conditioned things are subject to decay. Strive on with diligence',
note: isEn ? 'The Buddha\'s last words — Mahāparinibbāna Sutta (DN 16)'
: 'Lời dạy cuối cùng của Đức Phật trước khi nhập Niết-bàn — Kinh Đại Bát Niết-bàn (DN 16)'
},
{
pali: 'Attadīpā viharatha, attasaraṇā, anaññasaraṇā',
vi:   'Hãy tự mình làm hòn đảo cho chính mình, hãy tự mình nương tựa chính mình, không nương tựa ai khác',
en:   'Dwell as your own island, your own refuge, with no other refuge',
note: isEn ? 'Mahāparinibbāna Sutta (DN 16)' : 'Kinh Đại Bát Niết-bàn (DN 16)'
}
];
var quotesHtml = quotes.map(function (q) {
var tr = isEn ? q.en : q.vi;
return '<div class="welcome-quote">' +
'<div class="wq-pali">' + escapeHtml(q.pali) + '</div>' +
'<div class="wq-tr">' + escapeHtml(tr) + '</div>' +
'<div class="wq-note">' + escapeHtml(q.note) + '</div>' +
'</div>';
}).join('<div class="wq-sep" aria-hidden="true">❧</div>');
var hintHtml = isEn
? '<strong>Begin reading</strong><br>Tap <strong>Library</strong> at the bottom left to choose a sutta · Tap <strong>⚙ Settings</strong> to adjust display · Tap <strong>?</strong> top-right for guide.'
: '<strong>Bắt đầu</strong><br>Bấm <strong>Thư viện</strong> (góc dưới trái) để chọn bài kinh · Bấm <strong>⚙ Cài đặt</strong> để chỉnh hiển thị · Bấm <strong>?</strong> góc trên phải để xem hướng dẫn.';
grid.innerHTML =
'<div class="welcome-screen">' +
'<div class="welcome-quotes">' + quotesHtml + '</div>' +
'<div class="welcome-box">' + hintHtml + '</div>' +
'</div>';
}
function materializeChunk(chunkInfo) {
if (!chunkInfo || chunkInfo.materialized) return;
var frag = document.createDocumentFragment();
for (var i = chunkInfo.rowStart; i < chunkInfo.rowEnd; i++) {
var rowData = virtAllRows[i];
if (!rowData) continue;
var wrap = createRow(rowData);
frag.appendChild(wrap);
var innerRow = wrap.querySelector ? wrap.querySelector('.sutra-row') : wrap;
cachedRows[i] = innerRow || wrap;
}
chunkInfo.div.appendChild(frag);
chunkInfo.div.style.minHeight = '';
chunkInfo.materialized = true;
if (anchorObserver) {
var newRows = chunkInfo.div.querySelectorAll('.sutra-row');
for (var k = 0; k < newRows.length; k++) anchorObserver.observe(newRows[k]);
}
}
function dematerializeChunk(chunkInfo) {
if (!chunkInfo || !chunkInfo.materialized) return;
if (anchorObserver) {
var oldRows = chunkInfo.div.querySelectorAll('.sutra-row');
for (var k = 0; k < oldRows.length; k++) anchorObserver.unobserve(oldRows[k]);
}
if (!chunkInfo.measuredH) chunkInfo.measuredH = chunkInfo.div.offsetHeight || ((chunkInfo.rowEnd - chunkInfo.rowStart) * 120);
while (chunkInfo.div.firstChild) chunkInfo.div.removeChild(chunkInfo.div.firstChild);
chunkInfo.div.style.minHeight = chunkInfo.measuredH + 'px';
chunkInfo.materialized = false;
for (var i = chunkInfo.rowStart; i < chunkInfo.rowEnd; i++) {
cachedRows[i] = null;
}
}
function teardownChunkObservers() {
if (virtMatObs) { virtMatObs.disconnect(); virtMatObs = null; }
if (virtDemObs) { virtDemObs.disconnect(); virtDemObs = null; }
}
function setupChunkObservers() {
teardownChunkObservers();
if (!scrollEl || !virtChunks.length) return;
virtMatObs = new IntersectionObserver(function (entries) {
for (var i = 0; i < entries.length; i++) {
if (entries[i].isIntersecting) {
var idx = parseInt(entries[i].target.getAttribute('data-chunk-idx'), 10);
if (Number.isFinite(idx) && virtChunks[idx]) materializeChunk(virtChunks[idx]);
}
}
}, { root: scrollEl, rootMargin: '100% 0px 100% 0px', threshold: 0 });
virtDemObs = new IntersectionObserver(function (entries) {
for (var i = 0; i < entries.length; i++) {
if (!entries[i].isIntersecting) {
var idx = parseInt(entries[i].target.getAttribute('data-chunk-idx'), 10);
if (Number.isFinite(idx) && virtChunks[idx]) dematerializeChunk(virtChunks[idx]);
}
}
}, { root: scrollEl, rootMargin: '300% 0px 300% 0px', threshold: 0 });
for (var k = 0; k < virtChunks.length; k++) {
virtMatObs.observe(virtChunks[k].div);
virtDemObs.observe(virtChunks[k].div);
}
}
function ensureRowRendered(rowIdx) {
for (var k = 0; k < virtChunks.length; k++) {
var c = virtChunks[k];
if (rowIdx >= c.rowStart && rowIdx < c.rowEnd) {
if (!c.materialized) materializeChunk(c);
return;
}
}
}
async function renderSutra(id) {
if (!id || !grid) return;
// KHÔNG save anchor ở đây nữa: layout có thể đã shift giữa lúc user scroll và click
// → recompute lúc này sẽ ghi đè giá trị scroll-save đúng bằng giá trị mới có thể sai lệch.
// Rely on scroll-triggered saves (throttled 120ms) để giữ anchor chính xác tại thời điểm user scroll.
resetTts(true, false);
if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
teardownChunkObservers();
virtChunks = [];
virtAllRows = [];
firstVisibleKey = null;
firstVisibleOffsetFromGrid = 0;
cachedRows = [];
var token = ++renderToken;
isRendering = true;
grid.setAttribute('aria-busy', 'true');
if (btnReadTts)  btnReadTts.disabled  = true;
if (btnPauseTts) btnPauseTts.disabled = true;
if (btnStopTts)  btnStopTts.disabled  = true;
var merged = null;
try { merged = await loadMerged(id); } catch(e) { merged = null; }
if (token !== renderToken) {
isRendering = false;
return;
}
currentSutraId = id;
storage.set(KEY_LAST, id);
syncTileToCurrentSutta();
highlightActiveInMenu();
updateNavButtons();
if (!merged || !merged.rows || !merged.rows.length) {
if (titleEl) titleEl.textContent = uiLang === 'en' ? 'Sutta data not found' : 'Không tìm thấy dữ liệu bài kinh';
if (subtitleEl) subtitleEl.textContent = (uiLang === 'en' ? 'ID: ' : 'Mã bài: ') + id;
grid.innerHTML = ''; isRendering = false;
grid.setAttribute('aria-busy', 'false'); setTtsUiState('idle'); return;
}
var titleFromBilara    = (pickTextForUiLangSuffix(merged, id, ':0.2') || '').trim();
var subtitleFromBilara = (pickTextForUiLangSuffix(merged, id, ':0.1') || '').trim();
var meta = findMetaById(id) || {};
var titleFallback = uiLang === 'en'
? meta.titleEn || meta.titleVi || meta.titlePali || meta.title || id
: meta.titleVi || meta.titleEn || meta.titlePali || meta.title || id;
var rootLabelVi = meta.rootNikaya  ? (meta.rootNikaya.labelVi  || meta.rootNikaya.key)  : '';
var rootLabelEn = meta.rootNikaya  ? (meta.rootNikaya.labelEn  || meta.rootNikaya.key)  : '';
var parentLabelVi = meta.parentGroup ? (meta.parentGroup.labelVi || meta.parentGroup.key) : '';
var parentLabelEn = meta.parentGroup ? (meta.parentGroup.labelEn || meta.parentGroup.key) : '';
function extractShortLabel(label, lang) {
if (!label) return '';
var parts = label.split(/\s+-\s+/);
return lang === 'vi' ? (parts[1] || parts[0] || '').trim() : (parts[0] || label).trim();
}
var rootShort   = extractShortLabel(uiLang === 'en' ? rootLabelEn   : rootLabelVi,   uiLang);
var parentShort = extractShortLabel(uiLang === 'en' ? parentLabelEn : parentLabelVi, uiLang);
var rootKey = meta.rootNikaya ? meta.rootNikaya.key : '';
var titleOverride = null, titleMetaOverride = null;
var AN_ORDINALS_EN = ['', 'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
'Sevens', 'Eights', 'Nines', 'Tens', 'Elevens'];
if (rootKey === 'SN') {
titleOverride     = uiLang === 'en' ? (meta.titleEn || meta.titleVi) : (meta.titleVi || meta.titleEn);
titleMetaOverride = uiLang === 'en' ? (meta.titleVi || '') : (meta.titleEn || '');
} else if (rootKey === 'AN' && meta.code) {
var anM = String(meta.code).match(/AN\s*(\d+)/);
if (anM) {
var n = parseInt(anM[1], 10);
var an_vi = 'Nhóm ' + n + ' Pháp';
var an_en = 'Book of ' + (AN_ORDINALS_EN[n] || n);
titleOverride     = uiLang === 'en' ? an_en : an_vi;
titleMetaOverride = uiLang === 'en' ? an_vi : an_en;
}
}
var resolvedTitle = titleOverride || titleFromBilara || titleFallback;
if (titleEl) titleEl.textContent = resolvedTitle;
applyTitleBookmarkState();
var paliName = (meta.titlePali || subtitleFromBilara || '').trim();
isAN = (rootKey === 'AN');
isSN = (rootKey === 'SN');
fallbackTitle = (resolvedTitle || '').trim();
superLastSlotEl = null;
if (superTitleEl) {
var superParts = [];
if (rootShort) superParts.push(rootShort);
if (parentShort && parentShort !== rootShort && rootKey !== 'SN') {
superParts.push(parentShort);
}
var codeTxt = (meta.code || '').trim();
if (codeTxt) superParts.push(codeTxt);
if (isSN) {
// SN hierarchy: Nikāya · SN-code · Saṁyutta (static) · [Vagga dynamic, appears on scroll into a vagga]
if (fallbackTitle) superParts.push(fallbackTitle);
superTitleEl.textContent = '';
for (var spi = 0; spi < superParts.length; spi++) {
if (spi > 0) superTitleEl.appendChild(document.createTextNode(' · '));
var spSpan = document.createElement('span');
spSpan.textContent = superParts[spi];
superTitleEl.appendChild(spSpan);
}
var sepNode = document.createElement('span');
sepNode.className = 'super-sep';
sepNode.textContent = ' · ';
sepNode.style.display = 'none';
superTitleEl.appendChild(sepNode);
var dynSpan = document.createElement('span');
dynSpan.id = 'superLastSlot';
dynSpan.textContent = '';
superTitleEl.appendChild(dynSpan);
superLastSlotEl = dynSpan;
superLastSlotEl._sep = sepNode;
} else {
// AN / DN / MN: last slot static
var lastSlotText = isAN ? fallbackTitle : paliName;
if (lastSlotText) superParts.push(lastSlotText);
superTitleEl.textContent = superParts.join(' · ');
}
}
lastAppliedVaggaIdx = -2;
lastAppliedSuttaIdx = -2;
if (subtitleEl) subtitleEl.textContent = '';
var altName = titleMetaOverride || (uiLang === 'en' ? (meta.titleVi || '') : (meta.titleEn || ''));
fallbackTitleMeta = (altName || '').trim();
if (titleMetaEl) {
titleMetaEl.textContent = altName;
}
var normId = String(id).replace(/([A-Za-z]+)0*(\d)/g, '$1$2');
var mainPrefix1 = id + ':0.';
var mainPrefix2 = normId + ':0.';
var mainRows = [];
var sourceRows = [];
(merged.rows || []).forEach(function (r) {
var k = String(r.key || '');
if (k.startsWith(mainPrefix1) || k.startsWith(mainPrefix2)) return;
if (/:source$/i.test(k)) sourceRows.push(r);
else mainRows.push(r);
});
var rowsForViewRaw = mainRows.concat(sourceRows);
var singleLang = getSingleVisibleLang(); lastSingleLangMode = singleLang;
// Lấy từ cache: rowsForView + keyToRowIdx + markers đã tính sẵn
var viewData = getViewData(id, rowsForViewRaw, singleLang, isAN, isSN);
var rowsForView = viewData.rows;
grid.innerHTML = '';
cachedRows = [];
applyVisibility();
var CHUNK_SIZE = 50;
// Heuristic chiều cao placeholder. Over-estimate tốt hơn under-estimate
// (tránh scrollbar nhảy khi chunk materialize từ 120 → ~200 trong layout thật).
var EST_ROW_H = singleLang ? 130 : (card && card.classList.contains('stack') ? 220 : 180);
virtChunks = [];
virtAllRows = rowsForView;
keyToRowIdx = viewData.keyToRowIdx;
vaggaMarkers = viewData.vaggaMarkers;
suttaMarkers = viewData.suttaMarkers;
lastAppliedVaggaIdx = -2;
lastAppliedSuttaIdx = -2;
var placeFrag = document.createDocumentFragment();
for (var ci = 0; ci < rowsForView.length; ci += CHUNK_SIZE) {
var ce = Math.min(ci + CHUNK_SIZE, rowsForView.length);
var cdiv = document.createElement('div');
cdiv.className = 'row-chunk';
cdiv.setAttribute('data-chunk-idx', String(virtChunks.length));
cdiv.style.minHeight = ((ce - ci) * EST_ROW_H) + 'px';
virtChunks.push({ div: cdiv, rowStart: ci, rowEnd: ce, materialized: false, measuredH: 0 });
placeFrag.appendChild(cdiv);
}
grid.appendChild(placeFrag);
/* Eager materialize vài chunks quanh anchor NGAY trong tick đồng bộ này,
TRƯỚC khi browser paint → hết flash đen. Anchor restore ở RAF kế tiếp
sẽ scroll đúng vị trí vì chunk chứa anchor đã render sẵn. */
(function eagerAroundAnchor() {
try {
var anchorKey = getAnchorKeyFor(id);
var anchorIdx = (anchorKey && keyToRowIdx[anchorKey] != null) ? keyToRowIdx[anchorKey] : 0;
var anchorChunkIdx = Math.floor(anchorIdx / CHUNK_SIZE);
var lo = Math.max(0, anchorChunkIdx - 1);
var hi = Math.min(virtChunks.length - 1, anchorChunkIdx + 1);
for (var eci = lo; eci <= hi; eci++) materializeChunk(virtChunks[eci]);
// Sync pre-scroll: đưa viewport về vùng đã materialize TRƯỚC khi browser paint.
// Không có dòng này → frame paint đầu tiên ở scrollTop=0 nơi chunk 0 là placeholder rỗng,
// dark mode thấy body bg (#0b0c0e) → flash đen cho bài dài có anchor xa.
var scroller = getScrollRoot ? getScrollRoot() : scrollEl;
if (anchorChunkIdx > 0 && scroller && virtChunks[anchorChunkIdx] && virtChunks[anchorChunkIdx].div) {
var targetY = virtChunks[anchorChunkIdx].div.offsetTop;
scroller.scrollTop = targetY;
if (window.DEBUG_ANCHOR) {
console.log('[EAGER-FIX]', 'anchorKey=', anchorKey, 'anchorIdx=', anchorIdx,
'chunkIdx=', anchorChunkIdx, 'targetY=', targetY,
'→ actual=', scroller.scrollTop);
}
}
} catch (e) { /* ignore */ }
})();
requestAnimationFrame(function () {
if (token !== renderToken) { isRendering = false; return; }
setupChunkObservers();
grid.setAttribute('aria-busy', 'false');
requestAnimationFrame(function () {
updateVisibleCols(); restoreScrollByAnchor(id);
setupAnchorObserver(); updateNavButtons();
setTimeout(function () {
isRendering = false;
setTtsUiState('idle');
}, 500);
});
scheduleNextPreload(id);
});
}
function scheduleNextPreload(currentId) {
try {
var idx = SUTRA_ORDER.indexOf(currentId); if (idx === -1) return;
var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (conn && conn.saveData) return;
if (navigator.deviceMemory && navigator.deviceMemory < 2) return;
var nextId = SUTRA_ORDER[idx + 1];
var prevId = idx > 0 ? SUTRA_ORDER[idx - 1] : null;
var doPreload = function () {
if (nextId) loadMerged(nextId).catch(function () {});
if (prevId) loadMerged(prevId).catch(function () {});
};
if (!nextId && !prevId) return;
if ('requestIdleCallback' in window) requestIdleCallback(doPreload, { timeout: 2000 });
else setTimeout(doPreload, 800);
} catch(e){}
}
function openSutra(id) {
// Self-heal: nếu caller truyền segment prefix (vd "dn1") thay vì sutta file id ("dn01"),
// resolve qua SUTRA_INDEX. Bảo vệ khỏi LS bị pollute, hash, legacy bookmarks.
if (id) id = _resolveSegPrefixToSuttaId(id);
renderSutra(id);
}
(function wireBookmarkCurrent() {
var btn = $('btnBookmarkCurrent');
if (!btn) return;
btn.addEventListener('click', function (e) {
e.stopPropagation();
if (!currentSutraId) return;
var now = toggleBookmark(currentSutraId);
reflectBookmarkState(currentSutraId, now);
if (activeNikayaKey === 'BM') renderBookmarksList();
});
})();
function buildSuttaPrintHtml(id, merged) {
var meta = findMetaById(id) || {};
var rootKey = meta.rootNikaya ? meta.rootNikaya.key : '';
var skipDupTitle = (rootKey === 'MN' || rootKey === 'DN');
var cmtOnPli = !!(showCmtPli && showPali);
var cmtOnEng = !!(showCmtEng && showEng);
var cmtOnVie = !!(showCmtVie && showVie);
var cmtHeaders = uiLang === 'en'
? { pali: 'Aṭṭhakathā', eng: 'Commentary', vie: 'Vietnamese Cmt' }
: { pali: 'Aṭṭhakathā', eng: 'Commentary', vie: 'Chú giải' };
var title = (titleEl && titleEl.textContent) || (meta.titleVi || meta.titleEn || id);
var subtitle = (subtitleEl && subtitleEl.textContent) || '';
var supertitle = (superTitleEl && superTitleEl.textContent) || '';
var titleMeta = (titleMetaEl && titleMetaEl.textContent) || '';
var headers = uiLang === 'en'
? { pali: 'Pali', eng: 'English', vie: 'Vietnamese' }
: { pali: 'Pali', eng: 'English', vie: 'Tiếng Việt' };
function esc(s) {
return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
});
}
function shortKey(raw) {
if (!raw) return '';
if (raw.indexOf(':') !== -1) {
var parts = raw.split(':');
var prefix = parts[0].replace(/([a-zA-Z]+)(\d*)/, function (_, l, n) { return l.toUpperCase() + n; });
return parts[1] ? prefix + '.' + parts[1] : prefix;
}
return String(raw).toUpperCase();
}
var activeLangCount = (showPali ? 1 : 0) + (showEng ? 1 : 0) + (showVie ? 1 : 0);
var singleLang = activeLangCount === 1;
function tag(name) { return singleLang ? '' : '<span class="lang-tag">' + esc(name) + '</span>'; }
function rowHtml(r) {
var tp = (r.pali || '').trim();
var te = (r.eng || '').trim();
var tv = (r.vie || '').trim();
var keyRaw = String(r.key || '');
if (skipDupTitle && /:0\.[12]$/.test(keyRaw)) return '';
var isSectionNum = (tp.length <= 6 && te.length <= 6 && tv.length <= 6) &&
/^[IVXLCDM]+\.?$|^\d+\.?$/.test(tp || te || tv);
if (isSectionNum) return '';
var isSource = /:source$/i.test(keyRaw);
var isSubtitle = /:0\.[123]$/.test(keyRaw);
var cls = 'prow';
if (isSource) cls += ' prow-source';
if (isSubtitle) cls += ' prow-subtitle';
var inner = [];
if (showSegKey !== false) {
inner.push('<div class="prow-key">' + esc(shortKey(keyRaw)) + '</div>');
}
if (showPali && tp) inner.push('<div class="prow-pali">' + tag(headers.pali) + esc(tp) + '</div>');
if (showEng && te) inner.push('<div class="prow-eng">' + tag(headers.eng) + esc(te) + '</div>');
if (showVie && tv) inner.push('<div class="prow-vie">' + tag(headers.vie) + esc(tv) + '</div>');
if (!isSubtitle) {
var cPli = cmtOnPli ? resolveCommentLang(r.commentPli) : '';
var cEng = cmtOnEng ? resolveCommentLang(r.commentEn)  : '';
var cVie = cmtOnVie ? resolveCommentLang(r.commentVie) : '';
if (cPli) inner.push('<div class="prow-cmt prow-cmt-pli">' + tag(cmtHeaders.pali) + esc(cPli) + '</div>');
if (cEng) inner.push('<div class="prow-cmt prow-cmt-eng">' + tag(cmtHeaders.eng) + esc(cEng) + '</div>');
if (cVie) inner.push('<div class="prow-cmt prow-cmt-vie">' + tag(cmtHeaders.vie) + esc(cVie) + '</div>');
if (r._merged && Array.isArray(r._mergedComments)) {
for (var mi = 0; mi < r._mergedComments.length; mi++) {
var mc = r._mergedComments[mi];
var mcText = mc && typeof mc.text === 'string' ? mc.text.trim() : '';
if (!mcText) continue;
var mcLang = mc && mc.lang;
var inclMc = (mcLang === 'pali' && cmtOnPli) || (mcLang === 'eng' && cmtOnEng) ||
(mcLang === 'vie' && cmtOnVie) || (!mcLang && (cmtOnPli || cmtOnEng || cmtOnVie));
if (!inclMc) continue;
var mcCls = mcLang === 'pali' ? 'prow-cmt prow-cmt-pli' :
mcLang === 'eng'  ? 'prow-cmt prow-cmt-eng' :
mcLang === 'vie'  ? 'prow-cmt prow-cmt-vie' : 'prow-cmt';
var mcHdr = mcLang === 'pali' ? cmtHeaders.pali :
mcLang === 'eng'  ? cmtHeaders.eng  :
mcLang === 'vie'  ? cmtHeaders.vie  : cmtHeaders.vie;
inner.push('<div class="' + mcCls + '">' + tag(mcHdr) + esc(mcText) + '</div>');
}
}
}
if (!inner.length) return '';
return '<div class="' + cls + '">' + inner.join('') + '</div>';
}
var bodyRows = [], sourceRows = [];
merged.rows.forEach(function (r) {
if (/:source$/i.test(String(r.key || ''))) sourceRows.push(r);
else bodyRows.push(r);
});
var rowsHtml = bodyRows.map(rowHtml).join('') + sourceRows.map(rowHtml).join('');
var docTitle = esc((meta.code ? meta.code + ' · ' : '') + title);
var footerText = uiLang === 'en'
? 'Sutta Archive · Pāli & English: SuttaCentral / Bilara · ID: ' + esc(id)
: 'Sutta Archive · Pāli & Anh: SuttaCentral / Bilara · Mã bài: ' + esc(id);
return '<!DOCTYPE html><html lang="' + uiLang + '"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>' + docTitle + '</title>' +
'<style>' +
'@page { size: A4; margin: 0; }' +
'* { box-sizing: border-box; }' +
'html, body { margin: 0; padding: 0; }' +
'body { font-family: Cambria, "Noto Serif", Georgia, "Times New Roman", serif; color: #111; line-height: 1.55; font-size: 11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
'.sheet { width: 100%; border-collapse: collapse; }' +
'.sheet > thead > tr > td, .sheet > tbody > tr > td, .sheet > tfoot > tr > td { padding: 0 22mm; vertical-align: top; }' +
'.pad-top { height: 20mm; }' +
'.pad-bot { height: 22mm; }' +
'.phdr { text-align: center; border-bottom: 1px solid #999; padding-bottom: 12px; margin-bottom: 18px; }' +
'.phdr .supertitle { font-size: 9pt; color: #666; letter-spacing: 1.5px; text-transform: uppercase; font-family: Consolas, "Courier New", monospace; }' +
'.phdr h1 { font-size: 20pt; margin: 6px 0 4px; font-weight: 500; letter-spacing: -0.3px; }' +
'.phdr .subtitle { font-size: 11pt; color: #444; font-style: italic; }' +
'.phdr .meta { font-size: 9.5pt; color: #777; margin-top: 4px; }' +
'.prow { margin: 0 0 10px; page-break-inside: avoid; break-inside: avoid; }' +
'.prow-key { font-family: Consolas, "Courier New", monospace; font-size: 7.5pt; color: #999; margin-bottom: 2px; letter-spacing: 0.3px; }' +
'.prow-pali { font-style: italic; color: #333; margin-bottom: 2px; }' +
'.prow-eng { color: #222; margin-bottom: 2px; }' +
'.prow-vie { color: #111; }' +
'.lang-tag { display: inline-block; font-family: Consolas, "Courier New", monospace; font-size: 7pt; text-transform: uppercase; color: #aaa; margin-right: 6px; letter-spacing: 0.5px; vertical-align: 1px; }' +
'.prow-subtitle { text-align: center; font-size: 12pt; margin-bottom: 14px; }' +
'.prow-subtitle .prow-key, .prow-subtitle .lang-tag { display: none; }' +
'.prow-cmt { font-size: 9.5pt; color: #555; margin: 2px 0 2px 12px; padding-left: 6px; border-left: 2px solid #ddd; }' +
'.prow-cmt-pli { font-style: italic; }' +
'.prow-source { font-size: 9pt; color: #888; margin-top: 18px; padding-top: 10px; border-top: 1px dashed #ccc; }' +
'.pftr { margin-top: 22px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8pt; color: #888; text-align: center; }' +
'@media print { .prow { margin-bottom: 9px; } }' +
'</style></head><body>' +
'<table class="sheet">' +
'<thead><tr><td><div class="pad-top"></div></td></tr></thead>' +
'<tbody><tr><td>' +
'<header class="phdr">' +
(supertitle ? '<div class="supertitle">' + esc(supertitle) + '</div>' : '') +
'<h1>' + esc(title) + '</h1>' +
(subtitle && subtitle !== '—' ? '<div class="subtitle">' + esc(subtitle) + '</div>' : '') +
(titleMeta ? '<div class="meta">' + esc(titleMeta) + '</div>' : '') +
'</header>' +
'<main>' + rowsHtml + '</main>' +
'<footer class="pftr">' + footerText + '</footer>' +
'</td></tr></tbody>' +
'<tfoot><tr><td><div class="pad-bot"></div></td></tr></tfoot>' +
'</table>' +
'</body></html>';
}
function printCurrentSuttaPdf() {
if (!currentSutraId) return;
var id = currentSutraId;
var merged = MERGED_CACHE.get(id);
var ensure = merged ? Promise.resolve(merged) : loadMerged(id);
Promise.resolve(ensure).then(function (m) {
if (!m || !m.rows || !m.rows.length) return;
var html = buildSuttaPrintHtml(id, m);
var iframe = document.createElement('iframe');
iframe.setAttribute('aria-hidden', 'true');
iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
document.body.appendChild(iframe);
var printed = false;
var cleanedUp = false;
var cleanup = function () {
if (cleanedUp) return; cleanedUp = true;
if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
};
var doPrint = function () {
if (printed) return; printed = true;
try {
iframe.contentWindow.focus();
iframe.contentWindow.onafterprint = function () { setTimeout(cleanup, 1000); };
window.addEventListener('focus', function onReturn() {
window.removeEventListener('focus', onReturn);
setTimeout(cleanup, 1500);
}, { once: true });
iframe.contentWindow.print();
} catch (e) { console.warn(e); cleanup(); }
setTimeout(cleanup, 180000);
};
iframe.onload = function () { setTimeout(doPrint, 400); };
var doc = iframe.contentWindow.document;
doc.open(); doc.write(html); doc.close();
setTimeout(doPrint, 2000);
}).catch(function (e) { console.warn('[PDF] generation failed', e); });
}
var btnPrintPdf = $('btnPrintPdf');
if (btnPrintPdf) btnPrintPdf.onclick = function () {
if (!currentSutraId) return;
togglePanel(settingsPanel, false);
printCurrentSuttaPdf();
};
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
if (btnPrev) btnPrev.onclick = function () {
var idx = SUTRA_ORDER.indexOf(currentSutraId);
if (idx > 0) openSutra(SUTRA_ORDER[idx - 1]);
};
if (btnNext) btnNext.onclick = function () {
var idx = SUTRA_ORDER.indexOf(currentSutraId);
if (idx !== -1 && idx < SUTRA_ORDER.length - 1) openSutra(SUTRA_ORDER[idx + 1]);
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
_ttsModulePromise = loadScript('tts1.js').then(function () {
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
}
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
var allAnchors = [];
try {
for (var lsi = 0; lsi < localStorage.length; lsi++) {
var k = localStorage.key(lsi);
if (k && k.indexOf('scroll_anchor_key_') === 0) {
allAnchors.push(k.replace('scroll_anchor_key_', '') + ' → ' + localStorage.getItem(k));
}
}
} catch(e) {}
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
'── ALL anchors in storage ──',
].concat(allAnchors.length ? allAnchors : ['(none)']).concat([
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
]);
if (mem) {
lines.push('');
lines.push('── Memory (JS heap) ──');
lines.push('used:   ' + fmtBytes(mem.usedJSHeapSize));
lines.push('total:  ' + fmtBytes(mem.totalJSHeapSize));
lines.push('limit:  ' + fmtBytes(mem.jsHeapSizeLimit));
}
debugBody.textContent = lines.join('\n');
}
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
location.reload();
});
}
init();
})();
(function () {
var btn = document.getElementById('btnDarkMode');
if (!btn) return;
var STORAGE_KEY = 'sutra-dark-mode';
var html = document.documentElement;
var saved = null;
try { saved = localStorage.getItem(STORAGE_KEY); } catch(e){}
if (saved === 'dark') {
html.setAttribute('data-theme', 'dark');
btn.textContent = '☀️'; btn.title = 'Chế độ sáng';
}
if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
html.setAttribute('data-theme', 'dark');
btn.textContent = '☀️'; btn.title = 'Chế độ sáng';
try { localStorage.setItem(STORAGE_KEY, 'dark'); } catch(e){}
}
btn.addEventListener('click', function () {
var isDark = html.getAttribute('data-theme') === 'dark';
if (isDark) {
html.removeAttribute('data-theme');
btn.textContent = '🌙'; btn.title = 'Chế độ tối';
try { localStorage.setItem(STORAGE_KEY, 'light'); } catch(e){}
} else {
html.setAttribute('data-theme', 'dark');
btn.textContent = '☀️'; btn.title = 'Chế độ sáng';
try { localStorage.setItem(STORAGE_KEY, 'dark'); } catch(e){}
}
});
})();