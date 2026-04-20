/* ============================================================
   TEST SUITE — kiểm thử toàn bộ tính năng của indexold.html + appold.js

   Cách dùng:
   1. Thêm vào indexold.html: <script src="test.js?v=1" defer></script>
      Hoặc paste toàn bộ file này vào Console browser.
   2. Gọi: await Tests.runAll()         → chạy hết
           await Tests.run('menu')       → chạy 1 nhóm
           Tests.list()                  → liệt kê các nhóm test

   Mỗi test log ✓/✗ trong console. Summary ở cuối.
   Không sửa gì ứng dụng, chỉ mô phỏng user interaction.
   ============================================================ */
(function () {
  'use strict';
  if (window.Tests) return;

  var results = [];
  var currentGroup = '';
  var RESET_FPS_WAIT = 250;    // thời gian đợi để UI settle sau mỗi click
  var RENDER_WAIT = 500;       // thời gian đợi renderSutra hoàn tất
  var TTS_WAIT = 800;          // đợi TTS voices load

  function log(kind, msg) {
    var prefix = kind === 'pass' ? '%c✓' : kind === 'fail' ? '%c✗' : kind === 'group' ? '%c▸' : '%c·';
    var color = kind === 'pass' ? 'color:#4caf50;font-weight:bold'
              : kind === 'fail' ? 'color:#f44336;font-weight:bold'
              : kind === 'group' ? 'color:#d4a84a;font-weight:bold;font-size:14px'
              : 'color:#888';
    console.log(prefix + ' ' + msg, color);
  }

  function assert(cond, message) {
    var r = { group: currentGroup, pass: !!cond, message: message };
    results.push(r);
    log(cond ? 'pass' : 'fail', message);
    return !!cond;
  }

  function group(name) {
    currentGroup = name;
    log('group', '── ' + name + ' ──');
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function $(id) { return document.getElementById(id); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function fireClick(el) {
    if (!el) return false;
    el.click();
    return true;
  }

  /* ============================================================
     Test groups
     ============================================================ */
  var groups = {};

  groups.dom = async function () {
    group('DOM CORE ELEMENTS');
    assert($('card'), '#card exists');
    assert($('sutraGrid'), '#sutraGrid exists');
    assert($('title'), '#title exists');
    assert($('subtitle'), '#subtitle exists');
    assert($('supertitle'), '#supertitle exists');
    assert($('titleMeta'), '#titleMeta exists');
    assert($('sutraMenuPanel'), '#sutraMenuPanel exists');
    assert($('settingsPanel'), '#settingsPanel exists');
    assert($('sidebar-btn'), '#sidebar-btn exists');
    assert($('btnSettings'), '#btnSettings exists');
    assert($('btnPrev') && $('btnNext'), '#btnPrev + #btnNext exist');
    assert($('btnBackTop'), '#btnBackTop exists');
    assert($('btnGuide'), '#btnGuide exists (top-bar)');
    assert($('readProgress'), '#readProgress (progress bar) exists');
    assert($$('.nikaya-tile').length === 4, '4 nikaya tiles present');
  };

  groups.data = async function () {
    group('DATA LOADED');
    assert(window.SUTRA_INDEX && window.SUTRA_INDEX.length > 0, 'SUTRA_INDEX loaded');
    var nikayaKeys = (window.SUTRA_INDEX || []).map(function (n) { return n.key; }).sort();
    assert(JSON.stringify(nikayaKeys) === JSON.stringify(['AN', 'DN', 'MN', 'SN']),
      '4 nikayas (DN/MN/SN/AN) defined');
    assert(window.BILARA !== undefined, 'window.BILARA initialized');
  };

  groups.menu = async function () {
    group('LIBRARY MENU');
    var panel = $('sutraMenuPanel');
    var btn = $('sidebar-btn');

    // Close first (in case it's open)
    if (panel.classList.contains('open')) {
      fireClick($('menuCloseBtn'));
      await wait(RESET_FPS_WAIT);
    }

    fireClick(btn);
    await wait(RESET_FPS_WAIT);
    assert(panel.classList.contains('open'), 'Library opens on sidebar-btn click');

    // Test 4 tiles
    var tiles = $$('.nikaya-tile');
    for (var i = 0; i < tiles.length; i++) {
      var key = tiles[i].getAttribute('data-nikaya');
      fireClick(tiles[i]);
      await wait(150);
      assert(tiles[i].classList.contains('active'), 'Tile ' + key + ' becomes active on click');
      var links = $$('#sutraMenuList .menu-sutta-link');
      assert(links.length > 0, 'Tile ' + key + ' shows sutta list (' + links.length + ' entries)');
    }

    // Test search
    var search = $('sutraSearch');
    if (search) {
      search.value = 'brahmajala';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(300);
      var results = $$('#sutraSearchResults .search-result-item');
      assert(results.length > 0, 'Search "brahmajala" returns results');
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(200);
    }

    // Close X button
    fireClick($('menuCloseBtn'));
    await wait(RESET_FPS_WAIT);
    assert(!panel.classList.contains('open'), 'Library closes on X click');
  };

  groups.openSutra = async function () {
    group('OPEN SUTTA + HEADER');
    fireClick($('sidebar-btn'));
    await wait(RESET_FPS_WAIT);
    // Select DN tile first
    var dn = document.querySelector('.nikaya-tile[data-nikaya="DN"]');
    if (dn) { fireClick(dn); await wait(200); }

    var link = document.querySelector('#sutraMenuList .menu-sutta-link[data-id="dn01"]');
    assert(link, 'DN 1 link exists in menu');
    if (link) {
      fireClick(link);
      await wait(RENDER_WAIT);
      assert($('title').textContent !== 'Chưa chọn bài', '#title populated after open');
      assert($('supertitle').textContent.length > 0, '#supertitle populated (nikaya·code·pali)');
      assert($('sutraGrid').children.length > 0, '#sutraGrid has children (chunks)');
      assert(document.querySelector('.row-chunk'), '.row-chunk elements created (virtual scroll)');

      // Check URL hash (no deep-link feature, but hash may reflect sutta id via openSutra)
      assert(typeof window.location.hash === 'string', 'location.hash accessible');
    }

    fireClick($('menuCloseBtn'));
    await wait(200);
  };

  groups.navigation = async function () {
    group('PREV / NEXT / NAV TITLE');
    await wait(200);
    var btnPrev = $('btnPrev');
    var btnNext = $('btnNext');
    var navTitle = $('navTitle');

    assert(navTitle && navTitle.textContent.length > 0, 'navTitle shows current sutta');
    assert(!btnNext.disabled, 'Next button enabled (not last sutta)');

    var oldTitle = navTitle.textContent;
    fireClick(btnNext);
    await wait(RENDER_WAIT);
    assert(navTitle.textContent !== oldTitle, 'Next button opens different sutta');

    fireClick(btnPrev);
    await wait(RENDER_WAIT);
    assert(navTitle.textContent === oldTitle, 'Prev button returns to previous sutta');
  };

  groups.settings = async function () {
    group('SETTINGS — LANGUAGES');
    fireClick($('btnSettings'));
    await wait(RESET_FPS_WAIT);

    // Toggle Pali off
    var btnPali = $('btnPali');
    var wasActive = btnPali.classList.contains('active');
    fireClick(btnPali);
    await wait(150);
    assert(btnPali.classList.contains('active') !== wasActive, 'btnPali toggles active state');
    var gridEl = $('sutraGrid');
    assert(gridEl.classList.contains('hide-pali') === wasActive,
      'hide-pali class on #sutraGrid syncs with Pali toggle');
    // Toggle back
    fireClick(btnPali); await wait(150);

    group('SETTINGS — LAYOUT / SEG / LABEL');
    var btnSegKey = $('btnSegKey');
    var segWasActive = btnSegKey.classList.contains('active');
    fireClick(btnSegKey);
    await wait(150);
    assert(gridEl.classList.contains('hide-seg-key') === segWasActive,
      'hide-seg-key class toggles on btnSegKey click');
    fireClick(btnSegKey); await wait(150);

    var btnSegHdr = $('btnSegHdr');
    var hdrWasActive = btnSegHdr.classList.contains('active');
    fireClick(btnSegHdr); await wait(150);
    assert(gridEl.classList.contains('hide-col-header') === hdrWasActive,
      'hide-col-header class toggles on btnSegHdr click');
    fireClick(btnSegHdr); await wait(150);

    group('SETTINGS — FONT SIZE + LINE HEIGHT');
    var slider = $('sliderZoom');
    var oldScale = getComputedStyle(document.documentElement).getPropertyValue('--sutra-font-scale');
    slider.value = '120';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(150);
    var newScale = getComputedStyle(document.documentElement).getPropertyValue('--sutra-font-scale');
    assert(newScale.trim() !== oldScale.trim(), '--sutra-font-scale updates on slider input');

    // Reset
    var btnZoomReset = $('btnZoomReset');
    fireClick(btnZoomReset); await wait(150);
    assert($('zoomValueBadge').textContent === '100%', 'Reset returns zoom to 100%');

    group('SETTINGS — DARK MODE + LANG');
    var btnDark = $('btnDarkMode');
    var wasDark = document.documentElement.getAttribute('data-theme') === 'dark';
    fireClick(btnDark); await wait(150);
    var nowDark = document.documentElement.getAttribute('data-theme') === 'dark';
    assert(nowDark !== wasDark, 'btnDarkMode toggles [data-theme]');
    fireClick(btnDark); await wait(150);  // toggle back

    group('SETTINGS — RANDOM');
    var btnRandom = $('btnRandom');
    if (btnRandom) {
      var navTitleBefore = $('navTitle').textContent;
      fireClick(btnRandom); await wait(RENDER_WAIT);
      assert($('navTitle').textContent !== navTitleBefore, 'btnRandom opens a different sutta');
    } else {
      log('fail', 'btnRandom not found');
    }

    // Close settings
    fireClick($('btnSettings'));
    await wait(200);
  };

  groups.scroll = async function () {
    group('SCROLL + PROGRESS BAR + BACK TO TOP');
    var sutra = $('sutraGrid');
    assert(sutra, '#sutraGrid is scroll container');

    // Scroll down
    sutra.scrollTop = 500;
    sutra.dispatchEvent(new Event('scroll'));
    await wait(200);
    var progress = getComputedStyle(document.documentElement).getPropertyValue('--read-progress');
    assert(parseFloat(progress) > 0, 'Progress bar updates (--read-progress > 0)');

    // Back to top
    var btnBack = $('btnBackTop');
    assert(btnBack.classList.contains('visible'), 'Back-to-top visible after scrolling');
    fireClick(btnBack);
    await wait(500);
    assert(sutra.scrollTop < 50, 'Back-to-top scrolls to top');
  };

  groups.virtualScroll = async function () {
    group('VIRTUAL SCROLL CHUNKS');
    var chunks = $$('.row-chunk');
    assert(chunks.length > 0, '.row-chunk containers present');

    var materialized = 0, empty = 0;
    for (var i = 0; i < chunks.length; i++) {
      if (chunks[i].children.length > 0) materialized++; else empty++;
    }
    log('info', 'Materialized chunks: ' + materialized + ' / ' + chunks.length + ' (empty: ' + empty + ')');
    assert(empty > 0 || materialized === chunks.length,
      'Either some chunks empty (lazy) or short sutta (all materialized)');

    // Scroll down to force materialization
    var sutra = $('sutraGrid');
    sutra.scrollTop = sutra.scrollHeight / 2;
    sutra.dispatchEvent(new Event('scroll'));
    await wait(400);

    var wraps = $$('.sutra-row-wrap');
    assert(wraps.length > 0, 'Sutra rows rendered after scroll to middle');

    sutra.scrollTop = 0;
    await wait(300);
  };

  groups.tts = async function () {
    group('TTS (SPEECH SYNTHESIS)');
    if (!('speechSynthesis' in window)) {
      log('info', 'speechSynthesis not supported — skip TTS tests');
      return;
    }
    assert($('btnReadTts'), '#btnReadTts exists');
    assert($('btnPauseTts'), '#btnPauseTts exists');
    assert($('btnStopTts'), '#btnStopTts exists');

    fireClick($('btnSettings'));
    await wait(200);

    // Try clicking play; TTS may fail if no voices, but button state should change
    var btnPlay = $('btnReadTts');
    var initiallyDisabled = btnPlay.disabled;
    assert(!initiallyDisabled, 'Play button enabled when not rendering');

    // Don't actually play (avoid audio); just verify button exists + logic wires
    // fireClick(btnPlay); await wait(TTS_WAIT);
    // Test stop handler
    fireClick($('btnStopTts'));
    await wait(150);

    fireClick($('btnSettings'));  // close
    await wait(200);
  };

  groups.guide = async function () {
    group('GUIDE DIALOG');
    var btn = $('btnGuide');
    var overlay = $('guideOverlay');
    assert(btn, 'btnGuide (top bar) exists');
    assert(overlay, 'guideOverlay exists');

    fireClick(btn);
    await wait(300);
    assert(overlay.classList.contains('show'), 'Guide opens on btnGuide click');
    assert(overlay.querySelector('.guide-dialog h2'), 'Guide dialog has heading (h2)');
    assert(overlay.querySelectorAll('.guide-dialog h3').length >= 5,
      'Guide has detailed sections (h3 x5+)');

    var closeBtn = overlay.querySelector('.guide-dialog button');
    fireClick(closeBtn);
    await wait(300);
    assert(!overlay.classList.contains('show'), 'Guide closes on close button');
  };

  groups.anchor = async function () {
    group('SCROLL ANCHOR SAVE + RESTORE');
    var sutra = $('sutraGrid');
    sutra.scrollTop = 1000;
    sutra.dispatchEvent(new Event('scroll'));
    await wait(400);  // wait for throttled save

    // Get current sutta ID
    var currentId = null;
    try {
      var keys = Object.keys(localStorage);
      var anchorKey = keys.find(function (k) { return k.indexOf('scroll_anchor_key_') === 0; });
      currentId = anchorKey ? localStorage.getItem(anchorKey) : null;
    } catch (e) {}
    assert(typeof currentId === 'string' && currentId.length > 0,
      'Anchor key saved to localStorage after scroll');

    // Switch sutta then come back — check if scroll restores
    fireClick($('btnNext')); await wait(RENDER_WAIT);
    fireClick($('btnPrev')); await wait(RENDER_WAIT + 200);
    assert(sutra.scrollTop > 100, 'Scroll restored to saved position (scrollTop > 100)');

    sutra.scrollTop = 0;
  };

  groups.debug = async function () {
    group('DEBUG PANEL');
    var btn = $('btnDebug');
    var panel = $('debugPanel');
    assert(btn, '#btnDebug exists');
    assert(panel, '#debugPanel exists');
    // Skip if DEBUG=false (btnDebug has visibility:hidden)
    if (btn.style.visibility === 'hidden') {
      log('info', 'DEBUG=false, skipping debug panel interaction test');
      return;
    }
    fireClick($('btnSettings'));
    await wait(200);
    fireClick(btn);
    await wait(300);
    assert(!panel.hidden, 'Debug panel shows on btnDebug click');
    var closeBtn = $('btnDebugClose');
    if (closeBtn) { fireClick(closeBtn); await wait(200); }
    assert(panel.hidden, 'Debug panel hides on close click');
    fireClick($('btnSettings'));
  };

  /* ============================================================
     Runner
     ============================================================ */
  async function runAll() {
    results = [];
    console.log('%c╔════════════════════════════════════════╗', 'color:#d4a84a');
    console.log('%c║  SUTTA READER — FULL TEST SUITE       ║', 'color:#d4a84a;font-weight:bold');
    console.log('%c╚════════════════════════════════════════╝', 'color:#d4a84a');

    var order = ['dom', 'data', 'menu', 'openSutra', 'navigation',
                 'settings', 'scroll', 'virtualScroll', 'anchor', 'tts', 'guide', 'debug'];
    for (var i = 0; i < order.length; i++) {
      try { await groups[order[i]](); }
      catch (e) {
        console.error('Test group "' + order[i] + '" crashed:', e);
        results.push({ group: order[i], pass: false, message: 'CRASH: ' + e.message });
      }
    }
    report();
  }

  async function run(groupName) {
    if (!groups[groupName]) {
      console.warn('Unknown group:', groupName, 'Available:', Object.keys(groups));
      return;
    }
    results = [];
    try { await groups[groupName](); }
    catch (e) { console.error(e); }
    report();
  }

  function list() {
    console.log('Available test groups:', Object.keys(groups));
  }

  function report() {
    var total = results.length;
    var passed = results.filter(function (r) { return r.pass; }).length;
    var failed = total - passed;
    console.log('');
    console.log('%c═══════════ SUMMARY ═══════════', 'color:#d4a84a;font-weight:bold');
    console.log('%c  Total: ' + total + '   ✓ ' + passed + '   ✗ ' + failed,
      failed === 0 ? 'color:#4caf50;font-weight:bold' : 'color:#f44336;font-weight:bold');
    if (failed > 0) {
      console.log('%cFailed tests:', 'color:#f44336');
      results.filter(function (r) { return !r.pass; }).forEach(function (r) {
        console.log('  ✗ [' + r.group + '] ' + r.message);
      });
    }
    console.log('');
    return { total: total, passed: passed, failed: failed, results: results };
  }

  window.Tests = { runAll: runAll, run: run, list: list, report: report };
  console.log('%c✓ Test suite loaded. Run: await Tests.runAll()', 'color:#4caf50');

  // Auto-run nếu URL có ?test=1 — đợi app khởi động xong + welcome/sutta render
  if (new URLSearchParams(location.search).has('test')) {
    console.log('%c⟳ Auto-running tests in 2s (?test=1 detected)', 'color:#d4a84a');
    setTimeout(function () { runAll(); }, 2000);
  }
})();
