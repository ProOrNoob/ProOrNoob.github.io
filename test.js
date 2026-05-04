/* ============================================================
 * Sutta Reader — Console test cho anchor + chunk fixes
 * Cách dùng:
 *   1. Mở app trong browser, vào 1 sutta dài (vd MN10, DN16, AN1).
 *   2. Mở DevTools Console.
 *   3. Paste TOÀN BỘ file này vào console + Enter.
 *   4. Đợi log xuất hiện. Mỗi test in PASS/FAIL + chi tiết.
 *
 * Test KHÔNG ghi đè state của bạn (snapshot scroll + restore lại sau khi xong).
 * ============================================================ */
(async function () {
'use strict';

const RESULTS = [];
const log = (...a) => console.log('[TEST]', ...a);
const ok  = (name, msg) => { RESULTS.push({ name, pass: true, msg });  console.log('%c PASS ', 'background:#1a7f37;color:#fff;padding:2px 6px;border-radius:3px', name, msg || ''); };
const bad = (name, msg) => { RESULTS.push({ name, pass: false, msg }); console.log('%c FAIL ', 'background:#cf222e;color:#fff;padding:2px 6px;border-radius:3px', name, msg || ''); };
const warn= (name, msg) => { console.log('%c WARN ', 'background:#9a6700;color:#fff;padding:2px 6px;border-radius:3px', name, msg || ''); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const scrollRoot = document.getElementById('sutraGrid');
if (!scrollRoot) { console.error('[TEST] #sutraGrid not found — app chưa load xong?'); return; }

const sutraId = localStorage.getItem('lastSutraId');
if (!sutraId) { console.error('[TEST] localStorage.lastSutraId trống — mở 1 sutta trước.'); return; }
log('sutta hiện tại:', sutraId);

const ANCHOR_KEY_LS = 'scroll_anchor_key_' + sutraId;
const ORIG_SCROLL = scrollRoot.scrollTop;
const ORIG_ANCHOR = localStorage.getItem(ANCHOR_KEY_LS);
log('snapshot scrollTop=' + ORIG_SCROLL, 'anchor=' + ORIG_ANCHOR);

// Helper: compute first-fully-visible row key (mirror computeTopVisibleKey).
function topVisibleKey() {
  const root = scrollRoot.getBoundingClientRect();
  const rows = scrollRoot.querySelectorAll('.sutra-row[data-key]');
  for (const r of rows) {
    const rect = r.getBoundingClientRect();
    if (rect.top >= root.top) return r.getAttribute('data-key');
  }
  for (const r of rows) {
    const rect = r.getBoundingClientRect();
    if (rect.bottom > root.top) return r.getAttribute('data-key');
  }
  return null;
}

function rowByKey(key) {
  if (!key) return null;
  const esc = window.CSS && CSS.escape ? CSS.escape(key) : key.replace(/[:.]/g, '\\$&');
  return scrollRoot.querySelector('.sutra-row[data-key="' + esc + '"]');
}

function chunkStats() {
  const chunks = scrollRoot.querySelectorAll('[data-chunk-idx]');
  let mat = 0, total = chunks.length;
  const matIdx = [];
  chunks.forEach((c, i) => {
    if (c.children.length > 0) { mat++; matIdx.push(parseInt(c.getAttribute('data-chunk-idx'), 10)); }
  });
  return { total, mat, matIdx };
}

// Wait for save (250ms throttle + 200ms debounce + small buffer).
async function waitForSave() { await sleep(550); }

// Programmatic scroll wait (suppress window 700-1500ms in app, plus a bit).
async function settleScroll() { await sleep(1700); }

// ─── TEST 1 ──────────────────────────────────────────────────
// Anchor LS phải trùng với first-fully-visible row TẠI thời điểm save.
async function testAnchorMatchesTopRow() {
  const t = 'T1: anchor LS == first-fully-visible row';
  // Scroll xuống 1 đoạn vừa phải để có rows trên viewport.
  const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
  if (max < 1000) { warn(t, 'sutra quá ngắn — skip'); return; }
  scrollRoot.scrollTop = Math.min(max - 200, Math.max(800, max * 0.4));
  await settleScroll();
  // Trigger 1 scroll event nhẹ để debounce/throttle fire chuẩn.
  scrollRoot.scrollTop += 1;
  await waitForSave();
  const expected = topVisibleKey();
  const saved = localStorage.getItem(ANCHOR_KEY_LS);
  if (!expected) { bad(t, 'computeTopVisibleKey trả null'); return; }
  if (saved === expected) ok(t, 'saved=' + saved);
  else bad(t, 'expected=' + expected + ' saved=' + saved);
}

// ─── TEST 2 ──────────────────────────────────────────────────
// Anchor KHÔNG được chọn row đang scroll-out top (top âm).
// Đặt scrollTop sao cho row N có top âm (chưa scroll hẳn ra), row N+1 có top >= 0.
// Saved anchor phải là N+1, không phải N.
async function testNotSelectingScrollOutRow() {
  const t = 'T2: anchor NOT picking row scrolling-out top';
  const root = scrollRoot.getBoundingClientRect();
  const rows = Array.from(scrollRoot.querySelectorAll('.sutra-row[data-key]'));
  if (rows.length < 5) { warn(t, 'ít row quá — skip'); return; }
  // Tìm 1 row "vừa phải" giữa document.
  let mid = rows[Math.floor(rows.length / 2)];
  let mr = mid.getBoundingClientRect();
  const rowH = mr.height || 60;
  // Scroll sao cho top của mid = root.top - rowH/2 (mid đang scroll-out 1 nửa).
  const wrap = mid.closest('.sutra-row-wrap') || mid;
  const wr = wrap.getBoundingClientRect();
  const targetY = wr.top - root.top + scrollRoot.scrollTop + rowH / 2;
  scrollRoot.scrollTop = Math.min(targetY, scrollRoot.scrollHeight - scrollRoot.clientHeight);
  await settleScroll();
  scrollRoot.scrollTop += 1;
  await waitForSave();
  const saved = localStorage.getItem(ANCHOR_KEY_LS);
  const expected = topVisibleKey();
  const midKey = mid.getAttribute('data-key');
  // Saved phải là expected (first-fully-visible), KHÔNG phải mid (đang scroll-out).
  if (saved === expected && saved !== midKey) {
    ok(t, 'saved=' + saved + ' (đúng first-fully-visible, không phải scroll-out row ' + midKey + ')');
  } else if (saved === midKey) {
    bad(t, 'saved=' + saved + ' = mid row đang scroll-out top → IO selection bug còn');
  } else {
    warn(t, 'saved=' + saved + ' expected=' + expected + ' mid=' + midKey + ' (cần check thủ công)');
  }
}

// ─── TEST 3 ──────────────────────────────────────────────────
// Round-trip: scroll → save → clear scroll → restore (giả lập reload).
// Vì app.js là IIFE nên không gọi restoreScrollByAnchor được; ta verify bằng:
// - read saved key, scroll về 0, gán scrollTop để align row của saved key về top.
// - compare với position TRƯỚC khi clear.
async function testAnchorRoundTrip() {
  const t = 'T3: round-trip scroll-save-restore (manual)';
  const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
  if (max < 1000) { warn(t, 'sutra quá ngắn — skip'); return; }
  scrollRoot.scrollTop = max * 0.5;
  await settleScroll();
  scrollRoot.scrollTop += 1;
  await waitForSave();
  const savedKey = localStorage.getItem(ANCHOR_KEY_LS);
  const beforeY = scrollRoot.scrollTop;
  const beforeRow = topVisibleKey();
  if (!savedKey) { bad(t, 'không có saved anchor'); return; }
  // Giả lập reload: scroll về 0 rồi align lại theo savedKey.
  scrollRoot.scrollTop = 0;
  await sleep(100);
  const row = rowByKey(savedKey);
  if (!row) { bad(t, 'savedKey=' + savedKey + ' không có DOM (chunk chưa materialize?)'); scrollRoot.scrollTop = beforeY; return; }
  const wrap = row.closest('.sutra-row-wrap') || row;
  const root = scrollRoot.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const targetY = wr.top - root.top + scrollRoot.scrollTop;
  scrollRoot.scrollTop = Math.max(0, Math.min(targetY, max));
  await sleep(150);
  const afterRow = topVisibleKey();
  const drift = Math.abs(scrollRoot.scrollTop - beforeY);
  if (afterRow === beforeRow) ok(t, 'restore đúng row=' + afterRow + ' drift=' + drift.toFixed(0) + 'px');
  else bad(t, 'before=' + beforeRow + ' after=' + afterRow + ' drift=' + drift.toFixed(0) + 'px');
}

// ─── TEST 4 ──────────────────────────────────────────────────
// Scroll-up shift: scroll to mid, mark row, fling-scroll lên, check row đó shift bao nhiêu.
// Nếu compensation hoạt động, row đã materialize giữ nguyên screen-Y (so với scroll delta).
async function testScrollUpStability() {
  const t = 'T4: scroll-up shift (chunks materialize phía trên)';
  const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
  if (max < 3000) { warn(t, 'sutra quá ngắn để fling — skip'); return; }
  scrollRoot.scrollTop = max * 0.7;
  await settleScroll();
  // Pick row gần giữa viewport (sẽ vẫn nằm trong viewport sau fling lên ~viewport-height).
  const root = scrollRoot.getBoundingClientRect();
  const rows = Array.from(scrollRoot.querySelectorAll('.sutra-row[data-key]'));
  let target = null;
  for (const r of rows) {
    const rect = r.getBoundingClientRect();
    if (rect.top >= root.top + root.height * 0.4 && rect.top <= root.top + root.height * 0.6) {
      target = r; break;
    }
  }
  if (!target) { warn(t, 'không tìm được row giữa viewport — skip'); return; }
  const targetKey = target.getAttribute('data-key');
  const beforeRect = target.getBoundingClientRect();
  const beforeScrollTop = scrollRoot.scrollTop;
  // Fling lên 1.5 viewport-height.
  const flingPx = Math.floor(root.height * 1.5);
  scrollRoot.scrollTop = Math.max(0, beforeScrollTop - flingPx);
  // Đợi IO + materialize + compensation.
  await sleep(400);
  // Tính screen-Y kỳ vọng: row dịch xuống đúng bằng flingPx (vì user scroll lên).
  const expectedTop = beforeRect.top + (beforeScrollTop - scrollRoot.scrollTop);
  const afterRow = rowByKey(targetKey);
  if (!afterRow) { warn(t, 'row biến mất khỏi DOM (dematerialized?) — skip'); scrollRoot.scrollTop = beforeScrollTop; return; }
  const afterRect = afterRow.getBoundingClientRect();
  const shift = Math.abs(afterRect.top - expectedTop);
  const tol = 8; // 8px tolerance cho subpixel + minor drift
  if (shift <= tol) ok(t, 'shift=' + shift.toFixed(1) + 'px ≤ ' + tol + 'px (compensation OK)');
  else if (shift <= 50) warn(t, 'shift=' + shift.toFixed(1) + 'px (chấp nhận được, không hoàn hảo)');
  else bad(t, 'shift=' + shift.toFixed(1) + 'px → chunks phía trên materialize gây drift');
}

// ─── TEST 5 ──────────────────────────────────────────────────
// Materialize coverage: tại scrollTop ổn định, chunks phía trên trong khoảng 200%
// viewport-height nên materialized; xa hơn 300% thì NÊN dematerialized.
async function testMaterializeCoverage() {
  const t = 'T5: materialize rootMargin 200% top / 100% bottom';
  const chunks = scrollRoot.querySelectorAll('[data-chunk-idx]');
  if (chunks.length < 5) { warn(t, 'ít chunk quá — skip'); return; }
  const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
  if (max < 3000) { warn(t, 'sutra quá ngắn — skip'); return; }
  scrollRoot.scrollTop = max * 0.6;
  await settleScroll();
  await sleep(500);
  const root = scrollRoot.getBoundingClientRect();
  const stats = chunkStats();
  // Tìm chunk gần viewport.
  let nearMatCount = 0, nearTotalCount = 0;
  let farMatCount = 0, farTotalCount = 0;
  chunks.forEach(c => {
    const rect = c.getBoundingClientRect();
    const aboveDist = root.top - rect.bottom; // >0 nếu chunk fully above viewport
    const belowDist = rect.top - root.bottom; // >0 nếu chunk fully below viewport
    const dist = Math.max(aboveDist, belowDist, 0);
    const isMat = c.children.length > 0;
    if (dist <= root.height * 1.5) { // gần viewport (trong 150%)
      nearTotalCount++;
      if (isMat) nearMatCount++;
    } else if (dist > root.height * 4) { // rất xa (>400%)
      farTotalCount++;
      if (isMat) farMatCount++;
    }
  });
  const nearPct = nearTotalCount ? (nearMatCount / nearTotalCount) : 1;
  log(t, 'near (≤150%): ' + nearMatCount + '/' + nearTotalCount,
       'far (>400%): ' + farMatCount + '/' + farTotalCount,
       'total mat: ' + stats.mat + '/' + stats.total);
  if (nearPct >= 0.9) ok(t, 'gần viewport materialize đầy đủ (' + (nearPct * 100).toFixed(0) + '%)');
  else bad(t, 'chỉ ' + (nearPct * 100).toFixed(0) + '% chunk gần viewport materialize → rootMargin hẹp?');
  if (farTotalCount > 0 && farMatCount === 0) ok(t + ' (dematerialize)', 'chunks rất xa đã dematerialized');
  else if (farTotalCount > 0) warn(t + ' (dematerialize)', farMatCount + '/' + farTotalCount + ' chunks rất xa vẫn materialize (chưa idle?)');
}

// ─── TEST 6 ──────────────────────────────────────────────────
// _legacyCopy không bật bàn phím: spy execCommand, simulate textarea pattern.
// Không gọi được _legacyCopy trực tiếp; ta verify pattern thủ công bằng cách
// kiểm tra DOM: tạo textarea giống bug-version vs fix-version, check focus behavior.
async function testLegacyCopyHasReadonly() {
  const t = 'T6: _legacyCopy fallback có readonly';
  // Spy: monkey-patch document.execCommand, trigger 1 share-link click, observe textarea.
  const origExec = document.execCommand;
  let observedReadonly = null;
  let observedFontSize = null;
  document.execCommand = function (cmd) {
    if (cmd === 'copy') {
      const tas = document.querySelectorAll('textarea');
      const last = tas[tas.length - 1];
      if (last && last.style.position === 'fixed') {
        observedReadonly = last.hasAttribute('readonly');
        observedFontSize = last.style.fontSize;
      }
    }
    return origExec.apply(this, arguments);
  };
  // Disable native clipboard tạm thời để force fallback path.
  const origClip = navigator.clipboard;
  try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch(_) {}
  // Trigger share button click.
  const shareBtn = scrollRoot.querySelector('.sutra-seg-share');
  if (!shareBtn) { warn(t, 'không tìm được .sutra-seg-share — skip'); document.execCommand = origExec; return; }
  shareBtn.click();
  await sleep(150);
  // Restore.
  document.execCommand = origExec;
  try { Object.defineProperty(navigator, 'clipboard', { value: origClip, configurable: true }); } catch(_) {}
  if (observedReadonly === null) warn(t, 'không observe được textarea (path không qua _legacyCopy?)');
  else if (observedReadonly === true && observedFontSize === '16px') ok(t, 'readonly=true font-size=16px → keyboard fix OK');
  else bad(t, 'readonly=' + observedReadonly + ' font-size=' + observedFontSize);
}

// ─── RUN ─────────────────────────────────────────────────────
log('====== RUN ======');
try {
  await testAnchorMatchesTopRow();
  await testNotSelectingScrollOutRow();
  await testAnchorRoundTrip();
  await testScrollUpStability();
  await testMaterializeCoverage();
  await testLegacyCopyHasReadonly();
} catch (e) {
  console.error('[TEST] crash', e);
}

// Restore scroll position user.
scrollRoot.scrollTop = ORIG_SCROLL;
if (ORIG_ANCHOR != null) localStorage.setItem(ANCHOR_KEY_LS, ORIG_ANCHOR);

log('====== DONE ======');
const pass = RESULTS.filter(r => r.pass).length;
const fail = RESULTS.filter(r => !r.pass).length;
console.log('%c SUMMARY ', 'background:#0969da;color:#fff;padding:2px 6px;border-radius:3px',
  pass + ' pass / ' + fail + ' fail / ' + RESULTS.length + ' total');
console.table(RESULTS);
})();
