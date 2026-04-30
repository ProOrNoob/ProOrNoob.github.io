'use strict';
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
return _SEG_PREFIX_MAP[prefix]
|| _SEG_PREFIX_MAP[prefix.replace(/\.\d+$/, '')]
|| prefix;
}
function _parseAnchorHash() {
var h = String(location.hash || '').replace(/^#/, '');
if (!h) return null;
var m = h.match(/^([A-Za-z0-9._-]+)(?::.+)?$/);
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
