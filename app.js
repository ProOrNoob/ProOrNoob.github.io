(function () {
  'use strict';

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
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
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

  function sortBilaraKeys(keys) {
    return keys.sort(function (x, y) { return x.localeCompare(y, 'en', { numeric: true }); });
  }

  async function loadMerged(id) {
    if (!id) return null;
    if (MERGED_CACHE.has(id)) return MERGED_CACHE.get(id);
    if (MERGED_PROMISES.has(id)) return MERGED_PROMISES.get(id);
    var p = (async function () {
      await Promise.all([
        loadPackIfNeeded(getBilaraPack('pli', id)),
        loadPackIfNeeded(getBilaraPack('en', id)),
        loadPackIfNeeded(getBilaraPack('vi', id)),
      ]);
      var entry = window.BILARA[id] || {};
      var paliMap = entry.pli || {};
      var engMap  = entry.en  || {};
      var vieMap  = entry.vi  || {};
      var keys = sortBilaraKeys(unionKeys3(paliMap, engMap, vieMap));
      var rows = keys.map(function (k) { return { key: k, pali: paliMap[k]||'', eng: engMap[k]||'', vie: vieMap[k]||'' }; });
      var merged = { paliMap: paliMap, engMap: engMap, vieMap: vieMap, keys: keys, rows: rows };
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
  var titleEl     = $('title');
  var subtitleEl  = $('subtitle');
  var grid        = $('sutraGrid');

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

  var LANG_STORAGE_KEY = 'sutra_ui_lang';
  var uiLang = storage.get(LANG_STORAGE_KEY) === 'en' ? 'en' : 'vi';
  window.SUTRA_UI_LANG = uiLang;

  var KEY_LAST     = 'lastSutraId';
  var KEY_VIEW     = 'sutra_view_prefs';
  var KEY_ANCHOR_K = function (id) { return 'scroll_anchor_key_' + id; };
  var KEY_ANCHOR_O = function (id) { return 'scroll_anchor_off_' + id; };
  var WIDE_STORAGE_KEY = 'sutra_layout_wide';
  var isWide = storage.get(WIDE_STORAGE_KEY) === '1';

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
    var buf = '', bufKey = null;
    var flush = function () {
      var text = (buf||'').trim();
      if (!text) { buf=''; bufKey=null; return; }
      var r = { key: bufKey||'', pali:'', eng:'', vie:'' };
      if (lang==='pali') r.pali=text;
      if (lang==='eng') r.eng=text;
      if (lang==='vie') r.vie=text;
      out.push(r); buf=''; bufKey=null;
    };
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = String(r.key||'');
      var raw = lang==='pali'?(r.pali||''):lang==='eng'?(r.eng||''):(r.vie||'');
      var t = (raw||'').trim();
      if (!t) continue;
      if (isNumberedHeadingLine(t)) {
        flush();
        var rr = { key: key, pali:'', eng:'', vie:'' };
        if (lang==='pali') rr.pali=t;
        if (lang==='eng') rr.eng=t;
        if (lang==='vie') rr.vie=t;
        out.push(rr); continue;
      }
      if (!buf) { buf=t; bufKey=key; } else buf+=' '+t;
    }
    flush(); return out;
  }

  function maybeRerenderIfModeChanged() {
    var mode = getSingleVisibleLang();
    if (mode === lastSingleLangMode) return;
    if (currentSutraId) renderSutra(currentSutraId);
  }

  /* ============================================================
     UI Language flags
     ============================================================ */
  var FLAG_VI = '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true"><rect width="48" height="32" fill="#da251d"/><polygon fill="#ffde00" points="24,6 27.1,14.3 36,14.3 28.8,19.3 31.7,27 24,22.1 16.3,27 19.2,19.3 12,14.3 20.9,14.3"/></svg>';
  var FLAG_EN = '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true"><rect width="48" height="32" fill="#012169"/><path d="M0 0 L20 13 H16 L0 3 Z M48 0 L28 13 H32 L48 3 Z M0 32 L20 19 H16 L0 29 Z M48 32 L28 19 H32 L48 29 Z" fill="#ffffff"/><path d="M0 0 L20 13 H17 L0 2 Z M48 0 L28 13 H31 L48 2 Z M0 32 L20 19 H17 L0 30 Z M48 32 L28 19 H31 L48 30 Z" fill="#c8102e"/><path d="M20 0 H28 V12 H48 V20 H28 V32 H20 V20 H0 V12 H20 Z" fill="#ffffff"/><path d="M21.5 0 H26.5 V13.5 H48 V18.5 H26.5 V32 H21.5 V18.5 H0 V13.5 H21.5 Z" fill="#c8102e"/></svg>';

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
    dlg.innerHTML = isEn
      ? '<h2>Quick guide</h2><em>Short instructions on how to use the sutta reader.</em><ul><li>📖 <strong>Sutta Index</strong>: open catalogue and choose a sutta.</li><li>🔎 <strong>Search</strong>: type name/ID/keyword to filter.</li><li>⚙ <strong>Settings</strong>: toggle languages, layout, TTS, font size, full width.</li><li>← → <strong>Prev / Next</strong>: navigate between suttas.</li><li>↑ <strong>Back to top</strong>: jump to top of sutta.</li><li>⏸ <strong>TTS note</strong>: pause restarts the current sentence (browser limitation).</li></ul><button id="btnCloseGuide" type="button">Close</button>'
      : '<h2>Hướng dẫn nhanh</h2><em>Một số hướng dẫn cơ bản để bạn sử dụng trang đọc kinh.</em><ul><li>📖 <strong>Danh mục bài kinh</strong>: mở mục lục và chọn bài.</li><li>🔎 <strong>Tìm kiếm</strong>: gõ tên/mã/từ khóa để lọc.</li><li>⚙ <strong>Cài đặt</strong>: bật/tắt ngôn ngữ, bố cục, TTS, cỡ chữ, full width.</li><li>← → <strong>Trước / Sau</strong>: chuyển bài kinh bằng nút điều hướng.</li><li>↑ <strong>Lên đầu</strong>: cuộn về đầu bài kinh.</li><li>⏸ <strong>Lưu ý TTS</strong>: tạm dừng sẽ đọc lại từ đầu câu (giới hạn của trình duyệt).</li></ul><button id="btnCloseGuide" type="button">Đóng</button>';
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
  function updateMenuPanelTop() {
    if (!sutraMenuPanel || !card) return;
    var topNote = card.querySelector('.top-note');
    var topH = topNote ? topNote.offsetHeight : 0;
    sutraMenuPanel.style.top = topH + 'px';
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

  /* ============================================================
     View prefs
     ============================================================ */
  function saveViewPrefs() {
    storage.set(KEY_VIEW, JSON.stringify({
      showPali: showPali, showEng: showEng, showVie: showVie,
      stack: card ? card.classList.contains('stack') : false
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
    } catch(e){}
  }

  function updateVisibleCols() {
    var isNarrow = window.innerWidth <= 500;
    var isStack  = card ? card.classList.contains('stack') : false;
    var count = (showPali?1:0) + (showEng?1:0) + (showVie?1:0);
    count = Math.max(1, count);
    document.documentElement.style.setProperty('--visible-cols', isNarrow || isStack ? '1' : String(count));
  }

  function applyVisibility() {
    if (!grid) return;
    grid.classList.toggle('hide-pali', !showPali);
    grid.classList.toggle('hide-eng',  !showEng);
    grid.classList.toggle('hide-vie',  !showVie);
    updateVisibleCols();
  }

  window.addEventListener('resize', function () { updateVisibleCols(); updateMenuPanelTop(); });

  if (btnPali) btnPali.onclick = function () {
    if (showPali && (showEng || showVie)) { showPali = false; }
    else if (!showPali) { showPali = true; }
    else { return; }
    btnPali.classList.toggle('active', showPali);
    btnPali.setAttribute('aria-pressed', String(showPali));
    applyVisibility(); saveViewPrefs(); maybeRerenderIfModeChanged();
  };

  if (btnEng) btnEng.onclick = function () {
    if (showEng && (showPali || showVie)) { showEng = false; }
    else if (!showEng) { showEng = true; }
    else { return; }
    btnEng.classList.toggle('active', showEng);
    btnEng.setAttribute('aria-pressed', String(showEng));
    applyVisibility(); saveViewPrefs(); maybeRerenderIfModeChanged();
  };

  if (btnVie) btnVie.onclick = function () {
    if (showVie && (showPali || showEng)) { showVie = false; }
    else if (!showVie) { showVie = true; }
    else { return; }
    btnVie.classList.toggle('active', showVie);
    btnVie.setAttribute('aria-pressed', String(showVie));
    applyVisibility(); saveViewPrefs(); maybeRerenderIfModeChanged();
  };

  if (btnLayout) btnLayout.onclick = function () {
    if (card) card.classList.toggle('stack');
    var isStack = card ? card.classList.contains('stack') : false;
    btnLayout.classList.toggle('active', isStack);
    btnLayout.setAttribute('aria-pressed', String(isStack));
    updateVisibleCols(); saveViewPrefs();
  };

  /* ============================================================
     Full width
     ============================================================ */
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

  /* ============================================================
     Zoom + Line height sliders
     ============================================================ */
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

  /* ============================================================
     Anchor scroll
     FIX: Properly disconnect observer on page unload to prevent memory leak
     ============================================================ */
  var anchorObserver = null;
  var firstVisibleKey = null;
  var firstVisibleOffsetFromGrid = 0;

  function getScrollRoot() {
    // FIX: On mobile (<=500px), if grid has overflow-y:auto it's still the scroll root.
    // We always use grid as scroll root since CSS fix keeps it scrollable.
    return grid;
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
        firstVisibleOffsetFromGrid = Math.max(0,
          topmost.target.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top);
      }
    }, { root: scrollRoot, rootMargin: '0px 0px -80% 0px', threshold: 0 });
    scrollRoot.querySelectorAll('.sutra-row').forEach(function (r) { anchorObserver.observe(r); });
  }

  function saveScrollAnchorNow() {
    if (!currentSutraId) return;
    var scrollRoot = getScrollRoot();
    if (!scrollRoot || scrollRoot.scrollTop === 0) {
      storage.remove(KEY_ANCHOR_K(currentSutraId));
      storage.remove(KEY_ANCHOR_O(currentSutraId));
      return;
    }
    if (!firstVisibleKey) return;
    storage.set(KEY_ANCHOR_K(currentSutraId), firstVisibleKey);
    storage.set(KEY_ANCHOR_O(currentSutraId), String(Math.round(firstVisibleOffsetFromGrid)));
  }

  function restoreScrollByAnchor(id) {
    var scrollRoot = getScrollRoot();
    if (!scrollRoot) return false;
    try {
      var key    = storage.get(KEY_ANCHOR_K(id));
      var offRaw = storage.get(KEY_ANCHOR_O(id));
      var off    = offRaw ? parseInt(offRaw, 10) : 0;
      if (!key) return false;
      // FIX: Use safeCssEscape instead of broken manual fallback
      var safeKey = safeCssEscape(key);
      var row = scrollRoot.querySelector('.sutra-row[data-key="' + safeKey + '"]');
      if (!row) return false;
      var scrollTarget = row.closest('.sutra-row-wrap') || row;
      var max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      var y = scrollTarget.offsetTop - (Number.isFinite(off) ? off : 0);
      y = Math.max(0, Math.min(y, max));
      scrollRoot.scrollTop = y;
      toggleBackTop(scrollRoot.scrollTop > 0);
      return true;
    } catch(e) { return false; }
  }

  // FIX: Clean up observer on page unload to prevent memory leak
  window.addEventListener('pagehide', function () {
    saveScrollAnchorNow();
    if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveScrollAnchorNow();
  });

  /* ============================================================
     Back to top
     ============================================================ */
  var suppressBackTop = false;
  function toggleBackTop(show) { if (!btnBackTop) return; btnBackTop.classList.toggle('visible', show); }

  if (grid) grid.addEventListener('scroll', throttle(function () {
    if (!suppressBackTop) toggleBackTop(grid.scrollTop > 0);
    saveScrollAnchorNow();
  }, 120));

  if (btnBackTop && grid) btnBackTop.onclick = function () {
    suppressBackTop = true;
    toggleBackTop(false);
    setMobileHeaderHidden(false);  // Show header when going back to top
    mobileLastScrollTop = 0;
    grid.scrollTo({ top: 0, behavior: 'smooth' });
    var done = function () {
      suppressBackTop = false;
      toggleBackTop(false);
      if (currentSutraId) {
        storage.remove(KEY_ANCHOR_K(currentSutraId));
        storage.remove(KEY_ANCHOR_O(currentSutraId));
      }
    };
    if ('onscrollend' in grid) {
      grid.addEventListener('scrollend', done, { once: true });
    } else {
      var prev = -1;
      var poll = function () {
        var st = grid.scrollTop;
        if (st === 0 && st === prev) { done(); return; }
        prev = st;
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }
  };

  /* ============================================================
     Mobile auto-hide header
     Ẩn header khi cuộn xuống, hiện lại khi cuộn lên hoặc ở đầu trang.
     Chỉ hoạt động trên mobile (≤500px).
     ============================================================ */
  var headerEl = card ? card.querySelector('.header') : null;
  var mobileLastScrollTop = 0;
  var mobileHeaderHidden = false;
  var MOBILE_SCROLL_THRESHOLD = 8;  // Ngưỡng pixel tối thiểu để trigger

  function isMobileViewport() {
    return window.innerWidth <= 500;
  }

  function setMobileHeaderHidden(hide) {
    if (!headerEl) return;
    if (hide === mobileHeaderHidden) return;
    mobileHeaderHidden = hide;
    if (hide) {
      headerEl.classList.add('header-hidden');
    } else {
      headerEl.classList.remove('header-hidden');
    }
  }

  if (grid && headerEl) {
    grid.addEventListener('scroll', throttle(function () {
      if (!isMobileViewport()) {
        // Desktop: luôn hiện header
        setMobileHeaderHidden(false);
        return;
      }

      var st = grid.scrollTop;

      // Ở đầu trang: luôn hiện header
      if (st <= 5) {
        setMobileHeaderHidden(false);
        mobileLastScrollTop = st;
        return;
      }

      var delta = st - mobileLastScrollTop;

      // Cuộn xuống đủ ngưỡng → ẩn header
      if (delta > MOBILE_SCROLL_THRESHOLD) {
        setMobileHeaderHidden(true);
      }
      // Cuộn lên đủ ngưỡng → hiện header
      else if (delta < -MOBILE_SCROLL_THRESHOLD) {
        setMobileHeaderHidden(false);
      }

      mobileLastScrollTop = st;
    }, 60));
  }

  // Khi resize từ mobile sang desktop → đảm bảo header hiện lại
  window.addEventListener('resize', function () {
    if (!isMobileViewport()) {
      setMobileHeaderHidden(false);
    }
  });

  /* ============================================================
     Menu build
     ============================================================ */
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
    FLAT_SUTTAS.push({
      id: s.id, main: mainText, sub: subText,
      flat: (mainText + ' ' + viLabel + ' ' + enLabel + ' ' + paliLabel).toLowerCase()
    });
    return '<a href="#" class="menu-sutta-link" role="treeitem" data-id="' + escapeAttr(s.id) + '" aria-label="' + escapeAttr(mainText) + '">' +
        '<div class="sutra-label">' +
          '<div class="sutra-label-main">' + escapeHtml(mainText) + '</div>' +
          (subText ? '<div class="sutra-label-sub">' + escapeHtml(subText) + '</div>' : '') +
        '</div></a>';
  }

  function buildMenuChildren(children, parentId) {
    if (!children || !children.length) return '';
    var html = '';
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.type === 'group') {
        var grpId = safeDomId(parentId + '-' + child.key);
        var label = uiLang === 'en'
          ? child.labelEn || child.labelVi || child.key
          : child.labelVi || child.labelEn || child.key;
        html += '<div class="menu-subblock" role="group">' +
            '<button class="menu-toggle nested" type="button" data-target="' + escapeAttr(grpId) + '"' +
            ' aria-expanded="false" aria-controls="' + escapeAttr(grpId) + '">' +
            '<span>' + escapeHtml(label) + '</span><span class="chevron" aria-hidden="true">▸</span>' +
            '</button>' +
            '<div id="' + escapeAttr(grpId) + '" class="menu-list collapsed">' + buildMenuChildren(child.children || [], grpId) + '</div>' +
          '</div>';
      } else if (child.type === 'sutta') {
        html += buildSuttaLinkHtml(child);
      }
    }
    return html;
  }

  function buildSutraMenuFromIndex() {
    var index = window.SUTRA_INDEX || [];
    FLAT_SUTTAS = [];
    if (!Array.isArray(index) || !index.length) {
      if (sutraMenuList) {
        var msg = uiLang === 'en' ? 'No sutta index found. Make sure toc.js is loaded.' : 'Chưa có mục lục. Hãy đảm bảo file toc.js đã được tải.';
        sutraMenuList.innerHTML = '<li style="padding:10px;color:var(--ink-light);font-style:italic">' + escapeHtml(msg) + '</li>';
      }
      return;
    }
    var html = '';
    for (var i = 0; i < index.length; i++) {
      var sec = index[i];
      var secId = safeDomId('sec-' + sec.key);
      var label = uiLang === 'en'
        ? sec.labelEn || sec.labelVi || sec.key
        : sec.labelVi || sec.labelEn || sec.key;
      html += '<li class="menu-block" role="treeitem" aria-expanded="false">' +
        '<button class="menu-toggle" type="button" data-target="' + escapeAttr(secId) + '" aria-expanded="false" aria-controls="' + escapeAttr(secId) + '">' +
        '<span>' + escapeHtml(label) + '</span><span class="chevron" aria-hidden="true">▸</span>' +
        '</button>' +
        '<div id="' + escapeAttr(secId) + '" class="menu-list collapsed" role="group">' +
        '<div class="menu-nikaya-sticky" data-label="' + escapeAttr(label) + '" aria-hidden="true">' + escapeHtml(label) + '</div>' +
        buildMenuChildren(sec.children || [], secId) +
        '</div></li>';
    }
    if (!sutraMenuList) return;
    sutraMenuList.innerHTML = html;
    SUTRA_ORDER = Array.from(sutraMenuList.querySelectorAll('.menu-sutta-link'))
      .map(function (a) { return a.getAttribute('data-id'); });
    highlightActiveInMenu();
  }

  function highlightActiveInMenu() {
    if (!sutraMenuList) return;
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(function (a) {
      var isActive = a.getAttribute('data-id') === currentSutraId;
      a.classList.toggle('active', isActive);
      a.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
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
    var q = (query || '').trim().toLowerCase();
    if (!q) return renderSearchResults([], '');
    var matches = FLAT_SUTTAS.filter(function (x) { return x.flat.includes(q); }).slice(0, 80);
    renderSearchResults(matches, query);
  }

  if (searchInput) searchInput.addEventListener('input', debounce(function (e) { applySearch(e.target.value); }, 180));

  /* ============================================================
     Event delegation
     ============================================================ */
  function initDelegations() {
    if (sutraMenuList && !sutraMenuList._del) {
      sutraMenuList.addEventListener('click', function (ev) {
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

  /* ============================================================
     Meta lookup
     ============================================================ */
  function findMetaById(id) {
    var index = window.SUTRA_INDEX || [];
    var found = null;
    function walk(children) {
      if (!children || !children.length || found) return;
      for (var i = 0; i < children.length; i++) {
        if (found) return;
        var ch = children[i];
        if (ch.type === 'sutta' && ch.id === id) { found = ch; return; }
        if (ch.type === 'group') walk(ch.children || []);
      }
    }
    for (var i = 0; i < index.length; i++) { walk(index[i].children || []); if (found) break; }
    return found;
  }

  /* ============================================================
     createRow
     ============================================================ */
  function getColHeaders() {
    return uiLang === 'en'
      ? { pali: 'Pali', eng: 'English', vie: 'Vietnamese' }
      : { pali: 'Pali', eng: 'English', vie: 'Tiếng Việt' };
  }

  function createRow(r) {
    var wrap = document.createElement('div'); wrap.className = 'sutra-row-wrap';
    var keyRaw = String(r.key || '');
    var keyShort = '';
    if (keyRaw.includes(':')) {
      var parts = keyRaw.split(':');
      var prefix = parts[0].replace(/([a-zA-Z]+)(\d*)/, function (_, letters, nums) { return letters.toUpperCase() + nums; });
      keyShort = parts[1] ? prefix + '.' + parts[1] : prefix;
    } else { keyShort = keyRaw.toUpperCase(); }
    if (keyShort) {
      var seg = document.createElement('div');
      seg.className = 'sutra-seg-key'; seg.textContent = keyShort;
      seg.setAttribute('aria-hidden', 'true'); wrap.appendChild(seg);
    }
    var row = document.createElement('div');
    row.className = 'sutra-row'; row.setAttribute('data-key', keyRaw);
    var headers = getColHeaders();
    function makeCol(className, headerText, contentText, contentClass) {
      var col  = document.createElement('div'); col.className = 'sutra-col ' + className;
      var hdr  = document.createElement('div'); hdr.className = 'sutra-col-header';
      hdr.textContent = headerText; hdr.setAttribute('aria-hidden', 'true');
      var body = document.createElement('div'); body.className = 'sutra-col-body';
      var inner = document.createElement('div'); inner.className = contentClass;
      inner.textContent = contentText || '';
      body.appendChild(inner); col.appendChild(hdr); col.appendChild(body); return col;
    }
    row.appendChild(makeCol('pali-col', headers.pali, r.pali, 'pali'));
    row.appendChild(makeCol('eng-col',  headers.eng,  r.eng,  'eng'));
    row.appendChild(makeCol('vie-col',  headers.vie,  r.vie,  'vie'));
    wrap.appendChild(row); return wrap;
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
    if (uiLang === 'en') {
      if (titleEl) titleEl.textContent = 'Sutta reading collection';
      if (subtitleEl) subtitleEl.textContent = 'Tap 📖 to select a sutta, or ❓ for the guide.';
      grid.innerHTML = '<div class="welcome-screen"><div class="welcome-box"><strong>Welcome!</strong><br><br>• Tap 📖 <strong>Sutta Index</strong> to choose a sutta.<br>• Tap ⚙ <strong>Settings</strong> to adjust layout/TTS.<br>• Tap ❓ <strong>Guide</strong> for help.</div></div>';
    } else {
      if (titleEl) titleEl.textContent = 'Chào mừng bạn đến với trang lưu trữ kinh';
      if (subtitleEl) subtitleEl.textContent = 'Bấm 📖 để chọn bài kinh, hoặc ❓ để xem hướng dẫn.';
      grid.innerHTML = '<div class="welcome-screen"><div class="welcome-box"><strong>Xin chào!</strong><br><br>• Bấm 📖 <strong>Danh mục bài kinh</strong> để chọn bài.<br>• Bấm ⚙ <strong>Cài đặt</strong> để chỉnh bố cục/TTS.<br>• Bấm ❓ <strong>Hướng dẫn</strong> để xem cách dùng.</div></div>';
    }
  }

  /* ============================================================
     renderSutra
     FIX: Clear cachedRows immediately to prevent TTS reading stale data
     FIX: Reset isRendering when render token is invalidated
     ============================================================ */
  async function renderSutra(id) {
    if (!id || !grid) return;
    saveScrollAnchorNow(); resetTts(true, false);
    if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }

    // FIX: Clear cached rows immediately
    cachedRows = [];

    // Show header when loading new sutta (mobile auto-hide reset)
    setMobileHeaderHidden(false);
    mobileLastScrollTop = 0;

    var token = ++renderToken;
    isRendering = true;
    grid.setAttribute('aria-busy', 'true');

    if (btnReadTts)  btnReadTts.disabled  = true;
    if (btnPauseTts) btnPauseTts.disabled = true;
    if (btnStopTts)  btnStopTts.disabled  = true;

    var merged = null;
    try { merged = await loadMerged(id); } catch(e) { merged = null; }

    // FIX: Also reset isRendering when token is stale
    if (token !== renderToken) {
      isRendering = false;
      return;
    }

    currentSutraId = id;
    storage.set(KEY_LAST, id);
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
    var titleFallback    = uiLang === 'en'
      ? meta.titleEn || meta.titleVi || meta.titlePali || meta.title || id
      : meta.titleVi || meta.titleEn || meta.titlePali || meta.title || id;
    var subtitleFallback = uiLang === 'en'
      ? meta.subtitleEn || meta.subtitleVi || meta.subtitle || ''
      : meta.subtitleVi || meta.subtitleEn || meta.subtitle || '';
    if (titleEl) titleEl.textContent = titleFromBilara || titleFallback;
    if (subtitleEl) subtitleEl.textContent = subtitleFromBilara || subtitleFallback;

    var rowsForViewRaw = (merged.rows || []).filter(function (r) { return !String(r.key || '').includes(':0.'); });
    var singleLang = getSingleVisibleLang(); lastSingleLangMode = singleLang;
    var rowsForView = singleLang ? mergeRowsToParagraphRows(rowsForViewRaw, singleLang) : rowsForViewRaw;

    grid.innerHTML = '';
    cachedRows = [];
    applyVisibility();

    var i = 0, BATCH = 220;
    function renderBatch() {
      // FIX: Also reset isRendering when token is stale
      if (token !== renderToken) {
        isRendering = false;
        return;
      }
      var frag = document.createDocumentFragment();
      var end  = Math.min(i + BATCH, rowsForView.length);
      for (; i < end; i++) {
        var wrap = createRow(rowsForView[i]); frag.appendChild(wrap);
        var innerRow = wrap.querySelector ? wrap.querySelector('.sutra-row') : wrap;
        cachedRows.push(innerRow || wrap);
      }
      grid.appendChild(frag);
      if (i < rowsForView.length) {
        requestAnimationFrame(renderBatch);
      } else {
        isRendering = false; grid.setAttribute('aria-busy', 'false');
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          updateVisibleCols(); restoreScrollByAnchor(id);
          setupAnchorObserver(); setTtsUiState('idle'); updateNavButtons();
        }); });
        scheduleNextPreload(id);
      }
    }
    renderBatch();
  }

  function scheduleNextPreload(currentId) {
    try {
      var idx = SUTRA_ORDER.indexOf(currentId); if (idx === -1) return;
      var nextId = SUTRA_ORDER[idx + 1]; if (!nextId) return;
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && conn.saveData) return;
      if (navigator.deviceMemory && navigator.deviceMemory < 2) return;
      var doPreload = function () { loadMerged(nextId).catch(function () {}); };
      if ('requestIdleCallback' in window) requestIdleCallback(doPreload, { timeout: 2000 });
      else setTimeout(doPreload, 800);
    } catch(e){}
  }

  function openSutra(id) { renderSutra(id); }

  /* ============================================================
     Prev / Next
     ============================================================ */
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
      var code  = meta && meta.code ? meta.code + ' · ' : '';
      var title = uiLang === 'en'
        ? (meta && meta.titleEn) || (meta && meta.titleVi) || (meta && meta.titlePali) || currentSutraId
        : (meta && meta.titleVi) || (meta && meta.titleEn) || (meta && meta.titlePali) || currentSutraId;
      navTitle.textContent = code + title;
    }
  }

  if (btnPrev) btnPrev.onclick = function () {
    var idx = SUTRA_ORDER.indexOf(currentSutraId);
    if (idx > 0) openSutra(SUTRA_ORDER[idx - 1]);
  };
  if (btnNext) btnNext.onclick = function () {
    var idx = SUTRA_ORDER.indexOf(currentSutraId);
    if (idx !== -1 && idx < SUTRA_ORDER.length - 1) openSutra(SUTRA_ORDER[idx + 1]);
  };

  /* ============================================================
     TTS
     ============================================================ */
  var synthSupported = 'speechSynthesis' in window;
  var synth = synthSupported ? window.speechSynthesis : null;
  var cachedVoices = [];
  if (synthSupported) {
    try { cachedVoices = synth.getVoices() || []; } catch(e){}
    synth.addEventListener('voiceschanged', function () { try { cachedVoices = synth.getVoices() || []; } catch(e){} });
  }

  function ensureVoicesLoaded(timeout) {
    timeout = timeout || 1200;
    return new Promise(function (resolve) {
      if (!synth) return resolve([]);
      try { var v = synth.getVoices(); if (v && v.length) { cachedVoices = v; return resolve(v); } } catch(e){}
      var onChange = function () {
        try {
          var v2 = synth.getVoices();
          if (v2 && v2.length) { synth.removeEventListener('voiceschanged', onChange); cachedVoices = v2; resolve(v2); }
        } catch(e){}
      };
      synth.addEventListener('voiceschanged', onChange);
      setTimeout(function () {
        try { synth.removeEventListener('voiceschanged', onChange); } catch(e){}
        try { cachedVoices = synth.getVoices() || []; } catch(e){}
        resolve(cachedVoices);
      }, timeout);
    });
  }

  var ttsState = { activeLang: null, index: 0, isPlaying: false, isPaused: false, currentUtter: null };

  function setTtsUiState(state) {
    if (!btnReadTts || !btnPauseTts || !btnStopTts) return;
    if (!synthSupported || isRendering) {
      btnReadTts.disabled = btnPauseTts.disabled = btnStopTts.disabled = true; return;
    }
    if (state === 'idle')    { btnReadTts.disabled=false; btnPauseTts.disabled=true;  btnStopTts.disabled=true; }
    if (state === 'playing') { btnReadTts.disabled=true;  btnPauseTts.disabled=false; btnStopTts.disabled=false; }
    if (state === 'paused')  { btnReadTts.disabled=false; btnPauseTts.disabled=true;  btnStopTts.disabled=false; }
  }

  function clearRowHighlight() { cachedRows.forEach(function (r) { r.classList.remove('reading'); }); }
  function highlightRowAt(index) {
    clearRowHighlight();
    if (index < 0 || index >= cachedRows.length) return;
    var row = cachedRows[index]; row.classList.add('reading');
    var top = row.offsetTop, bottom = top + row.offsetHeight;
    var viewTop = grid.scrollTop, viewBottom = viewTop + grid.clientHeight;
    if (top < viewTop || bottom > viewBottom)
      grid.scrollTo({ top: Math.max(0, top - 20), behavior: 'auto' });
  }

  function pickVoice(langPrefix) {
    var lp = (langPrefix || '').toLowerCase();
    var list = cachedVoices.filter(function (v) { return v.lang && v.lang.toLowerCase().startsWith(lp); });
    return list.find(function (v) { return /google|microsoft/i.test(v.name || ''); }) || list[0] || null;
  }

  function resetTts(clearHighlight, clearStorage) {
    if (synthSupported && synth) { try { synth.cancel(); } catch(e){} }
    ttsState.isPlaying = ttsState.isPaused = false;
    ttsState.currentUtter = null; ttsState.index = 0; ttsState.activeLang = null;
    if (clearHighlight) clearRowHighlight();
    if (clearStorage && currentSutraId) {
      storage.remove('tts_state_' + currentSutraId);
    }
    setTtsUiState('idle');
  }

  function saveTtsState() {
    if (!currentSutraId || !ttsState.activeLang) return;
    storage.set('tts_state_' + currentSutraId,
      JSON.stringify({ lang: ttsState.activeLang, index: ttsState.index }));
  }

  function speakNextRow() {
    if (!synthSupported || !synth || !ttsState.activeLang) return;
    if (ttsState.index >= cachedRows.length) return resetTts(true, true);
    var row = cachedRows[ttsState.index];
    var el  = ttsState.activeLang === 'vi'
      ? row.querySelector('.vie-col .vie')
      : row.querySelector('.eng-col .eng');
    var text = el ? (el.textContent || '').trim() : '';
    if (!text) { ttsState.index++; return speakNextRow(); }
    highlightRowAt(ttsState.index); saveTtsState();
    var utter = new SpeechSynthesisUtterance(text);
    if (ttsState.activeLang === 'vi') {
      utter.lang = 'vi-VN'; var v = pickVoice('vi'); if (v) utter.voice = v;
      utter.rate = 0.98; utter.pitch = 0.95;
    } else {
      utter.lang = 'en-US'; var v2 = pickVoice('en'); if (v2) utter.voice = v2;
    }
    utter.onend = function () {
      ttsState.currentUtter = null;
      if (!ttsState.activeLang || ttsState.isPaused || !ttsState.isPlaying) return;
      ttsState.index++; speakNextRow();
    };
    utter.onerror = function (e) {
      ttsState.currentUtter = null;
      if (e.error === 'canceled' || ttsState.isPaused) return;
      resetTts(true, false);
    };
    ttsState.currentUtter = utter; ttsState.isPlaying = true; ttsState.isPaused = false;
    setTtsUiState('playing');
    try { synth.speak(utter); } catch(e) { resetTts(true, false); }
  }

  async function startTtsByUiLang() {
    if (isRendering) {
      alert(uiLang === 'en' ? 'Please wait for the text to finish loading.' : 'Vui lòng chờ tải xong nội dung rồi hãy bấm đọc.');
      return;
    }
    if (!synthSupported) {
      alert(uiLang === 'en' ? 'Your browser does not support TTS.' : 'Trình duyệt không hỗ trợ đọc TTS.');
      return;
    }
    var targetLang = uiLang === 'en' ? 'en' : 'vi';
    if (ttsState.activeLang === targetLang && ttsState.isPlaying) return;
    if (ttsState.activeLang === targetLang && ttsState.isPaused) {
      ttsState.isPaused = false; ttsState.isPlaying = true;
      setTtsUiState('playing'); speakNextRow(); return;
    }
    resetTts(true, false); ttsState.activeLang = targetLang; await ensureVoicesLoaded();
    if (currentSutraId) {
      try {
        var raw = storage.get('tts_state_' + currentSutraId);
        if (raw) {
          var st = JSON.parse(raw);
          if (st && st.lang === targetLang && typeof st.index === 'number') ttsState.index = st.index;
        }
      } catch(e){}
    }
    if (!Number.isInteger(ttsState.index) || ttsState.index < 0) ttsState.index = 0;
    speakNextRow();
  }

  /* FIX: Set isPaused and isPlaying BEFORE calling synth.cancel()
     so the onend/onerror handlers see the correct state */
  function pauseTtsByUiLang() {
    if (!synthSupported || !synth) return;
    if (!ttsState.activeLang || !ttsState.isPlaying || !ttsState.currentUtter) return;
    ttsState.isPaused = true;
    ttsState.isPlaying = false;
    try { synth.cancel(); } catch(e){}
    ttsState.currentUtter = null; saveTtsState(); clearRowHighlight(); setTtsUiState('paused');
  }
  function stopTtsByUiLang() {
    if (!synthSupported || !synth) return;
    resetTts(true, true);
  }

  if (btnReadTts)  btnReadTts.onclick  = startTtsByUiLang;
  if (btnPauseTts) btnPauseTts.onclick = pauseTtsByUiLang;
  if (btnStopTts)  btnStopTts.onclick  = stopTtsByUiLang;

  /* ============================================================
     UI Lang switch
     ============================================================ */
  function initUiLang() {
    renderUiLangFlag(); applyUiLanguageToSearchUi(); applyUiLanguageToSettingsPanel(); renderGuideDialog();
    if (!btnUiLang) return;
    btnUiLang.addEventListener('click', function (e) {
      e.stopPropagation();  // giữ sidebar không đóng
      uiLang = uiLang === 'vi' ? 'en' : 'vi';
      storage.set(LANG_STORAGE_KEY, uiLang); window.SUTRA_UI_LANG = uiLang;
      renderUiLangFlag(); applyUiLanguageToSearchUi(); applyUiLanguageToSettingsPanel(); renderGuideDialog();
      buildSutraMenuFromIndex(); highlightActiveInMenu(); updateNavButtons();
      if (currentSutraId) renderSutra(currentSutraId); else renderWelcomeScreen();
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    if (!grid || !titleEl || !subtitleEl || !card) console.warn('Sutta app: core DOM missing.');
    initUiLang(); loadViewPrefs();
    if (btnPali) { btnPali.classList.toggle('active', showPali); btnPali.setAttribute('aria-pressed', String(showPali)); }
    if (btnEng)  { btnEng.classList.toggle('active',  showEng);  btnEng.setAttribute('aria-pressed',  String(showEng)); }
    if (btnVie)  { btnVie.classList.toggle('active',  showVie);  btnVie.setAttribute('aria-pressed',  String(showVie)); }
    if (btnLayout) { btnLayout.classList.toggle('active', card ? card.classList.contains('stack') : false); }
    applyVisibility(); loadZoom(); loadLineHeight(); buildSutraMenuFromIndex(); initDelegations();
    var startId = storage.get(KEY_LAST);
    if (startId) openSutra(startId); else renderWelcomeScreen();
    if (!synthSupported) {
      [btnReadTts, btnPauseTts, btnStopTts].forEach(function (b) { if (b) b.disabled = true; });
    } else {
      setTtsUiState('idle');
    }
    updateMenuPanelTop();
  }

  init();
})();

/* ============================================================
   Dark mode (separate IIFE)
   ============================================================ */
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
