'use strict';
function initDelegations() {
if (grid && !grid._shareDel) {
grid.addEventListener('click', function (ev) {
var btn = ev.target.closest('.sutra-seg-share');
if (btn && grid.contains(btn)) {
ev.preventDefault();
ev.stopPropagation();
shareSegment(btn.getAttribute('data-share-key'));
return;
}
var copyBtn = ev.target.closest('.sutra-col-copy');
if (copyBtn && grid.contains(copyBtn)) {
ev.preventDefault();
ev.stopPropagation();
var col = copyBtn.closest('.sutra-col');
if (!col) return;
var body = col.querySelector('.sutra-col-body');
var text = body ? (body.textContent || '').trim() : '';
if (!text) return;
var done = function () { _showToast(uiLang === 'en' ? 'Text copied' : 'Đã sao chép'); };
var fail = function () { _showToast(uiLang === 'en' ? 'Copy failed' : 'Sao chép thất bại'); };
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(text).then(done).catch(function () { _legacyCopy(text) ? done() : fail(); });
} else {
_legacyCopy(text) ? done() : fail();
}
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
if (/:0\.[123]$/.test(keyRaw) && (!r._merged || r._isHeading)) wrap.classList.add('is-subtitle');
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
shareBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="10" r="2.4"/><circle cx="15" cy="5" r="2.4"/><circle cx="15" cy="15" r="2.4"/><path d="M7.2 8.9l5.6-3.4M7.2 11.1l5.6 3.4"/></svg>';
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
var hdrLabel = document.createElement('span');
hdrLabel.className = 'sutra-col-header-label';
hdrLabel.textContent = headerText;
hdr.appendChild(hdrLabel);
var copyBtn = document.createElement('button');
copyBtn.type = 'button';
copyBtn.className = 'sutra-col-copy';
copyBtn.setAttribute('aria-label', uiLang === 'en' ? 'Copy this paragraph' : 'Sao chép đoạn này');
copyBtn.title = uiLang === 'en' ? 'Copy' : 'Sao chép';
copyBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1"/><path d="M2 9V3a1 1 0 0 1 1-1h6"/></svg>';
hdr.appendChild(copyBtn);
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
if (titleEl)      titleEl.textContent      = '';
if (subtitleEl)   subtitleEl.textContent   = '';
document.documentElement.classList.add('is-welcome');
applyTitleBookmarkState();
var heroSub = isEn
? 'Reverently saluting the Blessed One, the Worthy One, the Perfectly Self-Awakened.<br>A library of canonical suttas for practitioners and scholars.'
: 'Cung kính đảnh lễ Đức Thế Tôn, bậc A-la-hán, Chánh Đẳng Giác.<br>Một thư viện kinh điển dành cho người tu học và nghiên cứu Phật pháp.';
var mandalaSvg = '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" aria-hidden="true">' +
'<g class="welcome-ring r1"><circle cx="60" cy="60" r="54" stroke-width=".7" opacity=".55"/><circle cx="60" cy="60" r="54" stroke-width=".7" stroke-dasharray="1 6" opacity=".8"/></g>' +
'<g class="welcome-ring r2"><circle cx="60" cy="60" r="42" stroke-width=".6" stroke-dasharray="2 4" opacity=".6"/></g>' +
'<g class="welcome-particles" fill="currentColor" stroke="none">' +
'<g class="welcome-dot-wrap" transform="rotate(0 60 60)"><circle class="welcome-dot d1" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(45 60 60)"><circle class="welcome-dot d2" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(90 60 60)"><circle class="welcome-dot d3" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(135 60 60)"><circle class="welcome-dot d4" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(180 60 60)"><circle class="welcome-dot d5" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(225 60 60)"><circle class="welcome-dot d6" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(270 60 60)"><circle class="welcome-dot d7" cx="60" cy="12" r="2.2"/></g>' +
'<g class="welcome-dot-wrap" transform="rotate(315 60 60)"><circle class="welcome-dot d8" cx="60" cy="12" r="2.2"/></g>' +
'</g>' +
'<g class="welcome-core" stroke-width=".9"><g opacity=".95">' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(45 60 60)"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(90 60 60)"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(135 60 60)"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(180 60 60)"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(225 60 60)"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(270 60 60)"/>' +
'<path d="M60 30 C 70 42, 70 52, 60 60 C 50 52, 50 42, 60 30 Z" transform="rotate(315 60 60)"/>' +
'</g><circle cx="60" cy="60" r="4" fill="currentColor" stroke="none"/></g></svg>';
var verses = [
{ pali: 'Vayadhammā saṅkhārā, appamādena sampādetha',
  tr: isEn ? 'All conditioned things are subject to decay. Strive on with diligence' : 'Các pháp hữu vi đều vô thường, hãy tinh tấn chớ có buông lung',
  src: isEn ? "The Buddha's last words — Mahāparinibbāna Sutta (DN 16)" : 'Lời dạy cuối cùng của Đức Phật trước khi nhập Niết-bàn — Kinh Đại Bát Niết-bàn (DN 16)',
  segKey: 'dn16:3.51.4' },
{ pali: 'Attadīpā viharatha, attasaraṇā, anaññasaraṇā',
  tr: isEn ? 'Dwell as your own island, your own refuge, with no other refuge' : 'Hãy tự mình làm hòn đảo cho chính mình, hãy tự mình nương tựa chính mình, không nương tựa ai khác',
  src: isEn ? 'Mahāparinibbāna Sutta (DN 16)' : 'Kinh Đại Bát Niết-bàn (DN 16)',
  segKey: 'dn16:2.26.1' }
];
var versesHtml = verses.map(function (v) {
return '<article class="welcome-verse">' +
'<p class="welcome-verse-pali">' + escapeHtml(v.pali) + '</p>' +
'<p class="welcome-verse-tr">' + escapeHtml(v.tr) + '</p>' +
'<p class="welcome-verse-source">' + escapeHtml(v.src) + '</p>' +
'</article>';
}).join('');
var iconLib  = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M2 3v10M5 3v10M8 3v10M12 4l3 9M11 13h5"/></svg>';
var iconCog  = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>';
var iconHelp = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.4-.9 2-1.6 2.4-.7.4-1.1.7-1.1 1.6v.4"/><path d="M12 16.2h.01"/></svg>';
var helperRows = isEn
? [{action:'guide', text: '<em>Help</em> — view the guide', icon: iconHelp},
   {action:'library', text: '<em>Library</em> — browse suttas', icon: iconLib}]
: [{action:'guide', text: '<em>Trợ giúp</em> — xem hướng dẫn', icon: iconHelp},
   {action:'library', text: '<em>Thư viện</em> — chọn bài kinh', icon: iconLib}];
var helperHtml = helperRows.map(function (r) {
return '<button type="button" class="welcome-help-row" data-action="' + r.action + '">' +
'<span class="welcome-help-text">' + r.text + '</span>' +
'<span class="welcome-help-key">' + r.icon + '</span>' +
'</button>';
}).join('');
grid.innerHTML =
'<div class="welcome-screen">' +
'<div class="welcome-mandala">' + mandalaSvg + '</div>' +
'<h1 class="welcome-hero-title" data-action="library" tabindex="0" role="button" aria-label="' + (isEn ? 'Open library' : 'Mở thư viện') + '" title="' + (isEn ? 'Open library' : 'Mở thư viện') + '">' + (isEn ? 'The <em>Sutta</em><br>Nikāya' : 'Tạng <em>Kinh</em><br>Nikāya') + '</h1>' +
'<p class="welcome-hero-sub">' + heroSub + '</p>' +
'<div class="welcome-hero-langs" role="tablist" aria-label="' + (isEn ? 'Interface language' : 'Ngôn ngữ giao diện') + '">' +
'<button type="button" class="welcome-lang-btn' + (uiLang === 'vi' ? ' active' : '') + '" data-ui-lang="vi" role="tab" aria-selected="' + (uiLang === 'vi' ? 'true' : 'false') + '">Việt</button>' +
'<span class="dot" aria-hidden="true"></span>' +
'<button type="button" class="welcome-lang-btn' + (uiLang === 'en' ? ' active' : '') + '" data-ui-lang="en" role="tab" aria-selected="' + (uiLang === 'en' ? 'true' : 'false') + '">English</button>' +
'</div>' +
'<section class="welcome-verses">' + versesHtml + '</section>' +
'<div class="welcome-helper">' + helperHtml + '</div>' +
'</div>';
grid.querySelectorAll('.welcome-help-row[data-action], .welcome-hero-title[data-action]').forEach(function (el) {
el.addEventListener('click', function (e) {
e.stopPropagation();
var action = el.getAttribute('data-action');
if (action === 'library' && btnSutraMenu) btnSutraMenu.click();
else if (action === 'guide' && btnGuide) btnGuide.click();
});
});
var heroTitleEl = grid.querySelector('.welcome-hero-title[data-action]');
if (heroTitleEl) {
heroTitleEl.addEventListener('keydown', function (e) {
if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); heroTitleEl.click(); }
});
}
grid.querySelectorAll('.welcome-lang-btn[data-ui-lang]').forEach(function (el) {
el.addEventListener('click', function (e) {
e.stopPropagation();
var chosen = el.getAttribute('data-ui-lang');
if (chosen === uiLang) return;
if (btnUiLang) btnUiLang.click();
});
});
}
function materializeChunk(chunkInfo) {
if (!chunkInfo || chunkInfo.materialized) return;
// Capture chunk position trước khi materialize để bù scroll nếu chunk nằm TRƯỚC viewport.
// Skip compensation trong programmatic scroll window (preserveTopAndSave, anchor restore...)
// để không đè lên adjustments của các code path đó.
var scroller = scrollEl;
var needsCompensation = false;
var oldChunkBottom = 0;
if (scroller && chunkInfo.div.parentNode === scroller && Date.now() >= _progScrollUntil) {
var preRect = chunkInfo.div.getBoundingClientRect();
var preRootRect = scroller.getBoundingClientRect();
oldChunkBottom = preRect.bottom - preRootRect.top + scroller.scrollTop;
if (oldChunkBottom <= scroller.scrollTop) needsCompensation = true;
}
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
if (needsCompensation && scroller) {
var newChunkRect = chunkInfo.div.getBoundingClientRect();
var newRootRect  = scroller.getBoundingClientRect();
var newChunkBottom = newChunkRect.bottom - newRootRect.top + scroller.scrollTop;
var delta = newChunkBottom - oldChunkBottom;
if (Math.abs(delta) > 0.5) scroller.scrollTop += delta;
}
}
function dematerializeChunk(chunkInfo) {
if (!chunkInfo || !chunkInfo.materialized) return;
if (anchorObserver) {
var oldRows = chunkInfo.div.querySelectorAll('.sutra-row');
for (var k = 0; k < oldRows.length; k++) anchorObserver.unobserve(oldRows[k]);
}
// LUÔN re-measure trước khi dematerialize. Nếu chỉ set một lần (như cũ), giá trị sẽ
// stale khi user đổi zoom/line-height/dark-mode/font sau khi chunk đã được dematerialize
// một lần → placeholder height sai → scroll position drift sau nhiều lần dematerialize.
var realH = chunkInfo.div.offsetHeight;
if (realH > 0) chunkInfo.measuredH = realH;
else if (!chunkInfo.measuredH) chunkInfo.measuredH = (chunkInfo.rowEnd - chunkInfo.rowStart) * 120;
// Compensate scroll: nếu chunk này nằm TRƯỚC viewport hiện tại, sau khi shrink/grow
// (do measuredH khác height thật) sẽ đẩy content phía dưới trượt lên/xuống.
// `overflow-anchor: none` (đặt trên #sutraGrid trong CSS) khiến browser KHÔNG tự bù.
// Ta bù tay: trước khi sửa minHeight, lưu chunk's bottom relative to scroll. Sau khi sửa,
// adjust scrollTop để giữ vị trí viewport ổn định.
var scroller = scrollEl;
var needsCompensation = false;
var oldChunkBottom = 0;
if (scroller && chunkInfo.div.parentNode === scroller && Date.now() >= _progScrollUntil) {
var chunkRect = chunkInfo.div.getBoundingClientRect();
var rootRect  = scroller.getBoundingClientRect();
oldChunkBottom = chunkRect.bottom - rootRect.top + scroller.scrollTop;
// Chỉ compensate nếu chunk nằm hoàn toàn TRƯỚC viewport (bottom < scrollTop).
if (oldChunkBottom <= scroller.scrollTop) needsCompensation = true;
}
while (chunkInfo.div.firstChild) chunkInfo.div.removeChild(chunkInfo.div.firstChild);
chunkInfo.div.style.minHeight = chunkInfo.measuredH + 'px';
chunkInfo.materialized = false;
for (var i = chunkInfo.rowStart; i < chunkInfo.rowEnd; i++) {
cachedRows[i] = null;
}
if (needsCompensation && scroller) {
var newChunkRect = chunkInfo.div.getBoundingClientRect();
var newRootRect  = scroller.getBoundingClientRect();
var newChunkBottom = newChunkRect.bottom - newRootRect.top + scroller.scrollTop;
var delta = newChunkBottom - oldChunkBottom;
if (Math.abs(delta) > 0.5) scroller.scrollTop += delta;
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
// Khi đổi sutta → drop cache mode của sutta cũ để tiết kiệm memory.
// (Mode swap chỉ có ý nghĩa trong cùng 1 sutta.)
if (currentSutraId && currentSutraId !== id) _dmInvalidateForSutta(currentSutraId);
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
grid.innerHTML = '<div style="max-width:520px;margin:48px auto;padding:24px;text-align:center;font-family:var(--serif-vi);color:var(--ink-3);font-style:italic;border:1px dashed var(--rule);border-radius:6px">'
+ (uiLang === 'en'
? 'No data for this sutta yet. Please choose another.'
: 'Bài kinh chưa có dữ liệu — vui lòng chọn bài khác.')
+ '</div>';
isRendering = false;
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
// Trên iPad/3-cols rows ngắn hơn nhiều so với 2-cols default → cần estimate riêng.
var EST_ROW_H;
if (singleLang) EST_ROW_H = 130;
else if (card && card.classList.contains('stack')) EST_ROW_H = 220;
else if (card && card.classList.contains('grid-3cols')) EST_ROW_H = 110;
else EST_ROW_H = 180;
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
var anchorIdx = -1;
if (anchorKey && keyToRowIdx[anchorKey] != null) {
anchorIdx = keyToRowIdx[anchorKey];
} else if (anchorKey) {
// Cross-mode fallback: anchor key không tồn tại trong mode hiện tại (vd single-lang
// merge segments → key cụ thể như 'mn70:10.9' không còn). Tìm paragraph row chứa
// hoặc gần nhất TRƯỚC anchor (largest key ≤ anchorKey).
anchorIdx = findClosestPrecedingRow(anchorKey, virtAllRows);
}
if (anchorIdx < 0) anchorIdx = 0;
var anchorChunkIdx = Math.floor(anchorIdx / CHUNK_SIZE);
var lo = Math.max(0, anchorChunkIdx - 1);
var hi = Math.min(virtChunks.length - 1, anchorChunkIdx + 1);
for (var eci = lo; eci <= hi; eci++) materializeChunk(virtChunks[eci]);
// Sync pre-scroll: đưa viewport về vùng đã materialize TRƯỚC khi browser paint.
// Không có dòng này → frame paint đầu tiên ở scrollTop=0 nơi chunk 0 là placeholder rỗng,
// dark mode thấy body bg (#0b0c0e) → flash đen cho bài dài có anchor xa.
var scroller = getScrollRoot() || scrollEl;
if (anchorChunkIdx > 0 && scroller && virtChunks[anchorChunkIdx] && virtChunks[anchorChunkIdx].div) {
// `offsetTop` reference đến nearest positioned ancestor (.card có position:relative),
// KHÔNG phải scroller. Dùng getBoundingClientRect math để lấy đúng vị trí trong scroller,
// rồi clamp [0, maxScrollTop] để tránh scroll quá nội dung gây bottom-clamp.
var chunkRect = virtChunks[anchorChunkIdx].div.getBoundingClientRect();
var rootRect  = scroller.getBoundingClientRect();
var rawY = (chunkRect.top - rootRect.top) + scroller.scrollTop;
var maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
var targetY = Math.max(0, Math.min(rawY, maxY));
scroller.scrollTop = targetY;
if (window.DEBUG_ANCHOR) {
console.log('[EAGER-FIX]', 'anchorKey=', anchorKey, 'anchorIdx=', anchorIdx,
'chunkIdx=', anchorChunkIdx, 'rawY=', rawY.toFixed(0),
'maxY=', maxY.toFixed(0), 'targetY=', targetY.toFixed(0),
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
// Snapshot mode hiện tại vào DOM_MODE_CACHE → lần sau toggle về mode này sẽ instant
try { _dmSaveCurrent(); } catch (_) {}
try { updateReadingProgress(); } catch (_) {}
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
document.documentElement.classList.remove('is-welcome');
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
