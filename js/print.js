'use strict';
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
