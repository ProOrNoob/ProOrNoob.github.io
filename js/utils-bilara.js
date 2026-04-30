'use strict';
var DEBUG = true;
var $ = (id) => document.getElementById(id);
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
var storage = {
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
var LOADED_PACKS = new Set();
var PACK_PROMISES = new Map();
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
var BILARA_BASE_DIR = './sutta';
function getBilaraPack(lang, id) {
if (!id) return null;
if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
return BILARA_BASE_DIR + '/' + lang + '/' + id;
}
var MERGED_CACHE = new Map();
var MERGED_PROMISES = new Map();
var CACHE_ORDER = [];
var MAX_CACHE_SUTTAS = 20;
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
function _cmpBilaraKey(a, b) {
if (_BILARA_COLLATOR) return _BILARA_COLLATOR.compare(a, b);
return String(a).localeCompare(String(b), 'en', { numeric: true });
}
// Khi anchor key không tồn tại trong virtAllRows hiện tại (vd cross multi ↔ single-lang
// vì single-lang merge nhiều segment thành 1 paragraph row có key = first segment),
// trả về idx của row có key LỚN NHẤT ≤ anchorKey.
// Ý nghĩa: row đó là paragraph CHỨA segment user đang đọc (vì paragraph absorb forward).
// Yêu cầu: rows phải sorted by Bilara key (đúng vì sortBilaraKeys + getViewData luôn sort).
function findClosestPrecedingRow(anchorKey, rows) {
if (!anchorKey || !rows || !rows.length) return -1;
var bestIdx = -1;
for (var i = 0; i < rows.length; i++) {
var rkey = String(rows[i].key || '');
if (!rkey) continue;
if (_cmpBilaraKey(rkey, anchorKey) <= 0) bestIdx = i;
else break; // sorted ascending → sau đây toàn key > anchor
}
return bestIdx;
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
