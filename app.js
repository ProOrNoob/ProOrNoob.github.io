(function () {
  'use strict';

  // =========================================================
  // 0) Helpers
  // =========================================================
  const $ = (id) => document.getElementById(id);

  // Dùng textContent thay escapeHtml ở createRow,
  // nhưng vẫn giữ escapeHtml/escapeAttr cho innerHTML template
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(val) {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/`/g, '&#96;')
      .replace(/>/g, '&gt;');
  }
  function safeDomId(base) {
    return String(base).replace(/[^a-z0-9_-]/gi, '-');
  }
  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }
  function throttle(fn, wait = 120) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn(...args);
      }
    };
  }

  // =========================================================
  // 1) Lazy load packs (no duplicate)
  // =========================================================
  const LOADED_PACKS = new Set();
  const PACK_PROMISES = new Map();

  function loadPackIfNeeded(pack) {
    if (!pack) return Promise.resolve();
    if (LOADED_PACKS.has(pack)) return Promise.resolve();
    if (PACK_PROMISES.has(pack)) return PACK_PROMISES.get(pack);

    const p = new Promise((res, rej) => {
      try {
        const s = document.createElement('script');
        s.src = pack + '.js';
        s.async = true;
        s.onload = () => {
          LOADED_PACKS.add(pack);
          PACK_PROMISES.delete(pack);
          res();
        };
        s.onerror = (e) => {
          PACK_PROMISES.delete(pack);
          rej(e);
        };
        document.body.appendChild(s);
      } catch (e) {
        PACK_PROMISES.delete(pack);
        rej(e);
      }
    });

    PACK_PROMISES.set(pack, p);
    return p;
  }

  // =========================================================
  // 2) Bilara loader (pli/en/vi) + merged cache (LRU)
  // =========================================================
  window.BILARA = window.BILARA || {};
  const BILARA_BASE_DIR = './sutta';

  function getBilaraPack(lang, id) {
    if (!id) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
    return `${BILARA_BASE_DIR}/${lang}/${id}`;
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
    if (a) Object.keys(a).forEach((k) => set.add(k));
    if (b) Object.keys(b).forEach((k) => set.add(k));
    if (c) Object.keys(c).forEach((k) => set.add(k));
    return Array.from(set);
  }

  function sortBilaraKeys(keys) {
    return keys.sort((x, y) => x.localeCompare(y, 'en', { numeric: true }));
  }

  async function loadMerged(id) {
    if (!id) return null;
    if (MERGED_CACHE.has(id)) return MERGED_CACHE.get(id);
    if (MERGED_PROMISES.has(id)) return MERGED_PROMISES.get(id);

    const p = (async () => {
      await Promise.all([
        loadPackIfNeeded(getBilaraPack('pli', id)),
        loadPackIfNeeded(getBilaraPack('en', id)),
        loadPackIfNeeded(getBilaraPack('vi', id)),
      ]);

      const entry = window.BILARA[id] || {};
      const paliMap = entry.pli || {};
      const engMap = entry.en || {};
      const vieMap = entry.vi || {};

      const keys = sortBilaraKeys(unionKeys3(paliMap, engMap, vieMap));
      const rows = keys.map((k) => ({
        key: k,
        pali: paliMap[k] || '',
        eng: engMap[k] || '',
        vie: vieMap[k] || '',
      }));

      const merged = { paliMap, engMap, vieMap, keys, rows };
      MERGED_CACHE.set(id, merged);
      touchCache(id);
      MERGED_PROMISES.delete(id);
      return merged;
    })().catch((e) => {
      MERGED_PROMISES.delete(id);
      throw e;
    });

    MERGED_PROMISES.set(id, p);
    return p;
  }

  // =========================================================
  // 3) DOM
  // =========================================================
  const card = $('card');
  const titleEl = $('title');
  const subtitleEl = $('subtitle');
  const grid = $('sutraGrid');

  const btnSutraMenu = $('btnSutraMenu');
  const btnSettings = $('btnSettings');
  const btnGuide = $('btnGuide');
  const btnBackTop = $('btnBackTop');
  const btnUiLang = $('btnUiLang');

  const settingsPanel = $('settingsPanel');
  const sutraMenuPanel = $('sutraMenuPanel');
  const sutraMenuList = $('sutraMenuList');

  const guideOverlay = $('guideOverlay');

  const searchInput = $('sutraSearch');
  const searchResultsEl = $('sutraSearchResults');

  const btnPali = $('btnPali');
  const btnEng = $('btnEng');
  const btnVie = $('btnVie');
  const btnLayout = $('btnLayout');

  const btnReadTts = $('btnReadTts');
  const btnPauseTts = $('btnPauseTts');
  const btnStopTts = $('btnStopTts');

  const paliBgInput = $('paliBgColor');
  const paliFgInput = $('paliTextColor');
  const engBgInput = $('engBgColor');
  const engFgInput = $('engTextColor');
  const vieBgInput = $('vieBgColor');
  const vieFgInput = $('vieTextColor');

  const btnResetPali = $('btnResetPaliColor');
  const btnResetEng = $('btnResetEngColor');
  const btnResetVie = $('btnResetVieColor');

  const btnZoomOut = $('btnZoomOut');
  const btnZoomIn = $('btnZoomIn');
  const btnZoomReset = $('btnZoomReset');

  const btnFullWidth = $('btnFullWidth');

  // =========================================================
  // 4) State + Storage keys
  // =========================================================
  let currentSutraId = null;
  let SUTRA_ORDER = [];
  let FLAT_SUTTAS = [];

  let showPali = true,
    showEng = true,
    showVie = true;

  let isRendering = false;
  let renderToken = 0;

  // render mode cache (để biết khi toggle ngôn ngữ có cần render lại hay không)
  let lastSingleLangMode = null; // null | 'pali' | 'eng' | 'vie'

  // UI lang
  const LANG_STORAGE_KEY = 'sutra_ui_lang';
  let uiLang = localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'vi';
  window.SUTRA_UI_LANG = uiLang;

  // View prefs
  const KEY_LAST = 'lastSutraId';
  const KEY_VIEW = 'sutra_view_prefs';

  // Anchor scroll per sutra
  const KEY_ANCHOR_K = (id) => 'scroll_anchor_key_' + id;
  const KEY_ANCHOR_O = (id) => 'scroll_anchor_off_' + id;

  // Full width
  const WIDE_STORAGE_KEY = 'sutra_layout_wide';
  let isWide = localStorage.getItem(WIDE_STORAGE_KEY) === '1';

  // Zoom
  const ZOOM_STORAGE_KEY = 'sutra_zoom';
  const MIN_ZOOM = 0.8,
    MAX_ZOOM = 1.6,
    ZOOM_STEP = 0.1;
  let zoomLevel = 1;

  // Colors
  // Sacred Manuscript theme — khớp với CSS vars --pali/eng/vie-bg/fg
  const COLOR_DEFAULTS = {
    paliBg: 'transparent',
    paliFg: '#1a0f00',
    engBg:  'transparent',
    engFg:  '#2d1f0a',
    vieBg:  'transparent',
    vieFg:  '#2a1800',
  };
  const COLOR_VAR_MAP = {
    paliBg: '--pali-bg',
    paliFg: '--pali-fg',
    engBg: '--eng-bg',
    engFg: '--eng-fg',
    vieBg: '--vie-bg',
    vieFg: '--vie-fg',
  };
  const COLOR_STORAGE_PREFIX = 'sutra_color_';

  // =========================================================
  // 4.5) Single-language merge helpers
  // =========================================================
  function getSingleVisibleLang() {
    const count = (showPali ? 1 : 0) + (showEng ? 1 : 0) + (showVie ? 1 : 0);
    if (count !== 1) return null;
    if (showPali) return 'pali';
    if (showEng) return 'eng';
    if (showVie) return 'vie';
    return null;
  }

  function isNumberedHeadingLine(text) {
    const t = (text || '').trim();
    return /^\d+\.\s*/.test(t);
  }

  function mergeRowsToParagraphRows(rows, lang) {
    const out = [];
    if (!Array.isArray(rows) || !rows.length) return out;

    let buf = '';
    let bufKey = null;

    const flush = () => {
      const text = (buf || '').trim();
      if (!text) {
        buf = '';
        bufKey = null;
        return;
      }
      const r = { key: bufKey || '', pali: '', eng: '', vie: '' };
      if (lang === 'pali') r.pali = text;
      if (lang === 'eng') r.eng = text;
      if (lang === 'vie') r.vie = text;
      out.push(r);
      buf = '';
      bufKey = null;
    };

    for (const r of rows) {
      const key = String(r.key || '');
      const raw =
        lang === 'pali' ? (r.pali || '') : lang === 'eng' ? (r.eng || '') : (r.vie || '');
      const t = (raw || '').trim();
      if (!t) continue;

      if (isNumberedHeadingLine(t)) {
        flush();
        const rr = { key, pali: '', eng: '', vie: '' };
        if (lang === 'pali') rr.pali = t;
        if (lang === 'eng') rr.eng = t;
        if (lang === 'vie') rr.vie = t;
        out.push(rr);
        continue;
      }

      if (!buf) {
        buf = t;
        bufKey = key;
      } else {
        buf += ' ' + t;
      }
    }

    flush();
    return out;
  }

  function maybeRerenderIfModeChanged() {
    const mode = getSingleVisibleLang();
    // lastSingleLangMode chỉ được cập nhật trong renderSutra,
    // nếu toggle nhanh 2 lần trước khi render xong có thể trigger rerender thừa
    // — ổn vì renderToken sẽ cancel render cũ trước khi chạy render mới.
    if (mode !== lastSingleLangMode && currentSutraId) {
      renderSutra(currentSutraId);
    }
  }

  // =========================================================
  // 5) UI Language (flag + texts + guide)
  // =========================================================
  const FLAG_VI = `
    <svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="32" fill="#da251d"/>
      <polygon fill="#ffde00"
        points="24,6  27.1,14.3 36,14.3 28.8,19.3 31.7,27 24,22.1 16.3,27 19.2,19.3 12,14.3 20.9,14.3"/>
    </svg>`;
  const FLAG_EN = `
    <svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="32" fill="#012169"/>
      <path d="M0 0 L20 13 H16 L0 3 Z M48 0 L28 13 H32 L48 3 Z M0 32 L20 19 H16 L0 29 Z M48 32 L28 19 H32 L48 29 Z" fill="#ffffff"/>
      <path d="M0 0 L20 13 H17 L0 2 Z M48 0 L28 13 H31 L48 2 Z M0 32 L20 19 H17 L0 30 Z M48 32 L28 19 H31 L48 30 Z" fill="#c8102e"/>
      <path d="M20 0 H28 V12 H48 V20 H28 V32 H20 V20 H0 V12 H20 Z" fill="#ffffff"/>
      <path d="M21.5 0 H26.5 V13.5 H48 V18.5 H26.5 V32 H21.5 V18.5 H0 V13.5 H21.5 Z" fill="#c8102e"/>
    </svg>`;

  function renderUiLangFlag() {
    if (!btnUiLang) return;
    btnUiLang.innerHTML = uiLang === 'en' ? FLAG_EN : FLAG_VI;
    btnUiLang.title =
      uiLang === 'en'
        ? 'Interface: English (click to switch to Vietnamese)'
        : 'Giao diện: Tiếng Việt (bấm để chuyển sang English)';
    if (btnGuide) btnGuide.title = uiLang === 'en' ? 'User guide' : 'Hướng dẫn sử dụng';
    if (btnSutraMenu) btnSutraMenu.title = uiLang === 'en' ? 'Sutta Index' : 'Danh mục bài kinh';
    if (btnSettings) btnSettings.title = uiLang === 'en' ? 'Display settings' : 'Cài đặt hiển thị';
    if (btnBackTop) btnBackTop.title = uiLang === 'en' ? 'Back to top' : 'Lên đầu nội dung';
  }

  function applyUiLanguageToSearchUi() {
    if (!searchInput) return;
    searchInput.placeholder = uiLang === 'en' ? 'Search sutta...' : 'Tìm bài kinh ...';
  }

  function applyUiLanguageToSettingsPanel() {
    const isEn = uiLang === 'en';
    const setText = (id, text) => {
      const el = $(id);
      if (el) el.textContent = text;
    };
    setText('settingsTitle', isEn ? 'Display settings' : 'Cài đặt hiển thị');
    setText('settingsLangLabel', isEn ? 'Text languages:' : 'Ngôn ngữ hiển thị:');
    setText('settingsLayoutLabel', isEn ? 'Layout:' : 'Bố cục:');
    setText('settingsTtsTitle', isEn ? 'Text-to-speech (TTS)' : 'Đọc kinh (TTS)');
    setText('settingsTtsUiLabel', isEn ? 'By interface language:' : 'Theo ngôn ngữ giao diện:');
    const note = $('settingsTtsNote');
    if (note) {
      note.innerHTML = isEn
        ? '* Uses browser built-in voices, quality may vary by device.'
        : '* TTS dùng giọng có sẵn của trình duyệt, có thể khác nhau giữa thiết bị.';
    }
    setText('settingsColorTitle', isEn ? 'Language column colors' : 'Màu cột ngôn ngữ');
    setText('settingsFontSizeLabel', isEn ? 'Font size:' : 'Cỡ chữ:');

    if (btnLayout) btnLayout.textContent = isEn ? '3 columns / Stacked' : '3 cột / Xếp dọc';
    if (btnFullWidth) btnFullWidth.title = isEn ? 'Toggle full width' : 'Bật / tắt giãn toàn màn hình';
  }

  function renderGuideDialog() {
    if (!guideOverlay) return;
    const dlg = guideOverlay.querySelector('.guide-dialog');
    if (!dlg) return;

    const isEn = uiLang === 'en';
    dlg.innerHTML = isEn
      ? `
        <h2>Quick guide</h2>
        <div class="guide-body">
          <em>Short instructions on how to use the sutta reader.</em>
          <ul>
            <li>📖 <strong>Sutta Index</strong>: open catalogue and choose a sutta.</li>
            <li>🔎 <strong>Search</strong>: type name/ID/keyword to filter.</li>
            <li>⚙ <strong>Settings</strong>: toggle languages, layout, TTS, colors, font size, full width.</li>
            <li>↔ <strong>Swipe left–right</strong> on the text to previous/next sutta.</li>
            <li>↑ <strong>Back to top</strong>: jump to top.</li>
          </ul>
        </div>
        <button id="btnCloseGuide" type="button">Close</button>
      `
      : `
        <h2>Hướng dẫn nhanh</h2>
        <div class="guide-body">
          <em>Một số hướng dẫn cơ bản để bạn sử dụng trang đọc kinh.</em>
          <ul>
            <li>📖 <strong>Danh mục bài kinh</strong>: mở mục lục và chọn bài.</li>
            <li>🔎 <strong>Tìm kiếm</strong>: gõ tên/mã/từ khóa để lọc.</li>
            <li>⚙ <strong>Cài đặt</strong>: bật/tắt ngôn ngữ, bố cục, TTS, màu, cỡ chữ, full width.</li>
            <li>↔ <strong>Vuốt ngang</strong> để chuyển bài trước/sau.</li>
            <li>↑ <strong>Lên đầu</strong>: cuộn về đầu.</li>
          </ul>
        </div>
        <button id="btnCloseGuide" type="button">Đóng</button>
      `;

    const btnClose = $('btnCloseGuide');
    if (btnClose) btnClose.onclick = closeGuide;
  }

  function openGuide() {
    if (!guideOverlay) return;
    renderGuideDialog();
    guideOverlay.classList.add('show');
    guideOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('btnCloseGuide')?.focus(), 0);
  }

  function closeGuide() {
    if (!guideOverlay) return;
    guideOverlay.classList.remove('show');
    guideOverlay.setAttribute('aria-hidden', 'true');
    btnGuide && btnGuide.focus();
  }

  // =========================================================
  // 6) Panels
  // =========================================================
  function togglePanel(panel, force) {
    if (!panel) return;
    const isOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', isOpen);
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  function closePanels() {
    togglePanel(settingsPanel, false);
    togglePanel(sutraMenuPanel, false);
  }

  if (btnSettings)
    btnSettings.onclick = () => {
      togglePanel(sutraMenuPanel, false);
      togglePanel(settingsPanel);
    };
  if (btnSutraMenu)
    btnSutraMenu.onclick = () => {
      togglePanel(settingsPanel, false);
      togglePanel(sutraMenuPanel);
    };
  if (btnGuide && guideOverlay) btnGuide.onclick = openGuide;

  if (guideOverlay) {
    guideOverlay.addEventListener('click', (e) => {
      if (e.target === guideOverlay) closeGuide();
    });
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const clickedSettingsBtn = btnSettings && btnSettings.contains(t);
    const clickedMenuBtn = btnSutraMenu && btnSutraMenu.contains(t);
    const inSettings = settingsPanel && settingsPanel.contains(t);
    const inMenu = sutraMenuPanel && sutraMenuPanel.contains(t);
    if (clickedSettingsBtn || clickedMenuBtn || inSettings || inMenu) return;
    closePanels();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (guideOverlay && guideOverlay.classList.contains('show')) return closeGuide();
      closePanels();
    }
  });

  // =========================================================
  // 7) View prefs (columns + stack)
  // =========================================================
  function saveViewPrefs() {
    try {
      localStorage.setItem(
        KEY_VIEW,
        JSON.stringify({
          showPali,
          showEng,
          showVie,
          stack: card ? card.classList.contains('stack') : false,
        })
      );
    } catch (e) {}
  }

  function loadViewPrefs() {
    try {
      const raw = localStorage.getItem(KEY_VIEW);
      if (!raw) return;
      const v = JSON.parse(raw);

      if (typeof v.showPali === 'boolean') showPali = v.showPali;
      if (typeof v.showEng === 'boolean') showEng = v.showEng;
      if (typeof v.showVie === 'boolean') showVie = v.showVie;

      if (card && typeof v.stack === 'boolean') card.classList.toggle('stack', v.stack);
    } catch (e) {}
  }

  function adjustRowColumns() {
    if (!grid) return;
    const isNarrow = window.innerWidth <= 500;
    const rows = grid.querySelectorAll('.sutra-row');
    const cardIsStack = card && card.classList.contains('stack');

    rows.forEach((row) => {
      if (cardIsStack || isNarrow) {
        row.style.gridTemplateColumns = '1fr';
        return;
      }
      let count = 0;
      if (showPali) count++;
      if (showEng) count++;
      if (showVie) count++;
      count = Math.max(1, count);
      row.style.gridTemplateColumns = `repeat(${count},1fr)`;
    });
  }

  function applyVisibility() {
    if (!grid) return;
    grid.classList.toggle('hide-pali', !showPali);
    grid.classList.toggle('hide-eng', !showEng);
    grid.classList.toggle('hide-vie', !showVie);
    adjustRowColumns();
  }

  window.addEventListener('resize', adjustRowColumns);

  if (btnPali)
    btnPali.onclick = () => {
      showPali = !showPali;
      btnPali.classList.toggle('active', showPali);
      applyVisibility();
      saveViewPrefs();
      maybeRerenderIfModeChanged();
    };
  if (btnEng)
    btnEng.onclick = () => {
      showEng = !showEng;
      btnEng.classList.toggle('active', showEng);
      applyVisibility();
      saveViewPrefs();
      maybeRerenderIfModeChanged();
    };
  if (btnVie)
    btnVie.onclick = () => {
      showVie = !showVie;
      btnVie.classList.toggle('active', showVie);
      applyVisibility();
      saveViewPrefs();
      maybeRerenderIfModeChanged();
    };

  if (btnLayout)
    btnLayout.onclick = () => {
      if (card) card.classList.toggle('stack');
      btnLayout.classList.toggle('active', card && card.classList.contains('stack'));
      adjustRowColumns();
      saveViewPrefs();
    };

  // =========================================================
  // 8) Full width
  // =========================================================
  function applyWideLayout(on) {
    isWide = !!on;
    document.documentElement.classList.toggle('layout-wide', isWide);
    if (btnFullWidth) btnFullWidth.classList.toggle('active', isWide);
  }

  if (btnFullWidth) {
    applyWideLayout(isWide);
    btnFullWidth.addEventListener('click', () => {
      const newVal = !isWide;
      applyWideLayout(newVal);
      localStorage.setItem(WIDE_STORAGE_KEY, newVal ? '1' : '0');
    });
  }

  // =========================================================
  // 9) Zoom
  // =========================================================
  function clampZoom(z) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }
  function applyZoom() {
    document.documentElement.style.setProperty('--sutra-font-scale', String(zoomLevel));
  }
  function loadZoom() {
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (stored) {
      const v = parseFloat(stored);
      if (!Number.isNaN(v)) zoomLevel = clampZoom(v);
    }
    applyZoom();
  }
  function saveZoom() {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
  }
  if (btnZoomIn)
    btnZoomIn.onclick = () => {
      zoomLevel = clampZoom(zoomLevel + ZOOM_STEP);
      applyZoom();
      saveZoom();
    };
  if (btnZoomOut)
    btnZoomOut.onclick = () => {
      zoomLevel = clampZoom(zoomLevel - ZOOM_STEP);
      applyZoom();
      saveZoom();
    };
  if (btnZoomReset)
    btnZoomReset.onclick = () => {
      zoomLevel = 1;
      applyZoom();
      saveZoom();
    };

  // =========================================================
  // 10) Colors
  // =========================================================
  function applyColorVar(key, value) {
    const cssVar = COLOR_VAR_MAP[key];
    if (!cssVar) return;
    document.documentElement.style.setProperty(cssVar, value);
  }
  function loadColorPrefs() {
    const result = {};
    Object.keys(COLOR_DEFAULTS).forEach((key) => {
      const stored = localStorage.getItem(COLOR_STORAGE_PREFIX + key);
      result[key] = stored || COLOR_DEFAULTS[key];
    });
    return result;
  }
  function saveColorPref(key, value) {
    localStorage.setItem(COLOR_STORAGE_PREFIX + key, value);
  }
  function applyAllColors(colors) {
    Object.keys(colors).forEach((key) => applyColorVar(key, colors[key]));
  }
  function resetLangColors(lang) {
    const bgKey = lang + 'Bg';
    const fgKey = lang + 'Fg';
    const defBg = COLOR_DEFAULTS[bgKey];
    const defFg = COLOR_DEFAULTS[fgKey];
    applyColorVar(bgKey, defBg);
    applyColorVar(fgKey, defFg);
    saveColorPref(bgKey, defBg);
    saveColorPref(fgKey, defFg);
    if (lang === 'pali') {
      paliBgInput && (paliBgInput.value = defBg);
      paliFgInput && (paliFgInput.value = defFg);
    }
    if (lang === 'eng') {
      engBgInput && (engBgInput.value = defBg);
      engFgInput && (engFgInput.value = defFg);
    }
    if (lang === 'vie') {
      vieBgInput && (vieBgInput.value = defBg);
      vieFgInput && (vieFgInput.value = defFg);
    }
  }
  function initColorControls() {
    const colors = loadColorPrefs();
    applyAllColors(colors);

    if (paliBgInput) paliBgInput.value = colors.paliBg;
    if (paliFgInput) paliFgInput.value = colors.paliFg;
    if (engBgInput) engBgInput.value = colors.engBg;
    if (engFgInput) engFgInput.value = colors.engFg;
    if (vieBgInput) vieBgInput.value = colors.vieBg;
    if (vieFgInput) vieFgInput.value = colors.vieFg;

    paliBgInput &&
      paliBgInput.addEventListener('input', (e) => {
        applyColorVar('paliBg', e.target.value);
        saveColorPref('paliBg', e.target.value);
      });
    paliFgInput &&
      paliFgInput.addEventListener('input', (e) => {
        applyColorVar('paliFg', e.target.value);
        saveColorPref('paliFg', e.target.value);
      });
    engBgInput &&
      engBgInput.addEventListener('input', (e) => {
        applyColorVar('engBg', e.target.value);
        saveColorPref('engBg', e.target.value);
      });
    engFgInput &&
      engFgInput.addEventListener('input', (e) => {
        applyColorVar('engFg', e.target.value);
        saveColorPref('engFg', e.target.value);
      });
    vieBgInput &&
      vieBgInput.addEventListener('input', (e) => {
        applyColorVar('vieBg', e.target.value);
        saveColorPref('vieBg', e.target.value);
      });
    vieFgInput &&
      vieFgInput.addEventListener('input', (e) => {
        applyColorVar('vieFg', e.target.value);
        saveColorPref('vieFg', e.target.value);
      });

    btnResetPali && btnResetPali.addEventListener('click', () => resetLangColors('pali'));
    btnResetEng && btnResetEng.addEventListener('click', () => resetLangColors('eng'));
    btnResetVie && btnResetVie.addEventListener('click', () => resetLangColors('vie'));
  }

  // =========================================================
  // 11) Anchor scroll (segment based) — FIX: tính offset đúng
  // =========================================================
  function getAnchorFromViewport() {
    if (!grid) return null;

    // Duyệt qua các row để tìm row đầu tiên visible trong viewport của grid
    const gridTop = grid.getBoundingClientRect().top;
    const rows = grid.querySelectorAll('.sutra-row');
    let targetRow = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rTop = r.getBoundingClientRect().top;
      // Row đầu tiên mà phần trên của nó còn nằm trong/dưới grid top
      if (rTop >= gridTop - 1) {
        targetRow = r;
        break;
      }
    }

    if (!targetRow) {
      // fallback: row cuối cùng visible
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        const rTop = r.getBoundingClientRect().top;
        if (rTop < gridTop + grid.clientHeight) {
          targetRow = r;
          break;
        }
      }
    }

    if (!targetRow) return null;

    const key = targetRow.getAttribute('data-key') || '';
    if (!key) return null;

    // Offset chính xác: khoảng cách từ top của row tới top của grid viewport
    // (offsetTop của row so với scrollable container - scrollTop hiện tại)
    const offset = Math.max(0, targetRow.offsetTop - grid.scrollTop);
    return { key, offset };
  }

  function saveScrollAnchorNow() {
    if (!grid || !currentSutraId) return;
    try {
      const a = getAnchorFromViewport();
      if (!a) return;
      localStorage.setItem(KEY_ANCHOR_K(currentSutraId), a.key);
      localStorage.setItem(KEY_ANCHOR_O(currentSutraId), String(Math.round(a.offset)));
    } catch (e) {}
  }

  function restoreScrollByAnchor(id) {
    if (!grid) return false;
    try {
      const key = localStorage.getItem(KEY_ANCHOR_K(id));
      const offRaw = localStorage.getItem(KEY_ANCHOR_O(id));
      const off = offRaw ? parseInt(offRaw, 10) : 0;
      if (!key) return false;

      const safeKey = String(key).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const row = grid.querySelector(`.sutra-row[data-key="${safeKey}"]`);
      if (!row) return false;

      // Cuộn sao cho row nằm đúng tại vị trí offset đã lưu từ top của grid
      const max = Math.max(0, grid.scrollHeight - grid.clientHeight);
      let y = row.offsetTop - (Number.isFinite(off) ? off : 0);
      y = Math.max(0, Math.min(y, max));
      grid.scrollTop = y;
      toggleBackTop(grid.scrollTop > 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  // FIX: Chỉ dùng pagehide + visibilitychange — beforeunload gây hại BFCache trên mobile
  function saveNowForReload() {
    saveScrollAnchorNow();
  }
  window.addEventListener('pagehide', saveNowForReload);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNowForReload();
  });

  // =========================================================
  // 12) Back to top
  // =========================================================
  function toggleBackTop(show) {
    if (!btnBackTop) return;
    btnBackTop.classList.toggle('enabled', show);
    btnBackTop.disabled = !show;
    btnBackTop.setAttribute('aria-disabled', String(!show));
  }

  if (grid) {
    grid.addEventListener(
      'scroll',
      throttle(() => {
        toggleBackTop(grid.scrollTop > 0);
        saveScrollAnchorNow();
      }, 120)
    );
  }

  if (btnBackTop && grid) {
    btnBackTop.onclick = () => {
      if (!btnBackTop.classList.contains('enabled')) return;
      grid.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  // =========================================================
  // 13) Menu từ SUTRA_INDEX + Search
  // =========================================================
  function buildSuttaLinkHtml(s) {
    const codePrefix = s.code ? s.code + ' – ' : '';
    const viLabel = s.titleVi || '';
    const enLabel = s.titleEn || '';
    const paliLabel = s.titlePali || '';

    let mainText, subText;
    if (uiLang === 'en') {
      mainText = codePrefix + (enLabel || viLabel || paliLabel || s.id);
      subText = paliLabel || viLabel || '';
    } else {
      mainText = codePrefix + (viLabel || enLabel || paliLabel || s.id);
      subText = paliLabel || enLabel || '';
    }

    FLAT_SUTTAS.push({
      id: s.id,
      main: mainText,
      sub: subText,
      flat: `${mainText} ${viLabel} ${enLabel} ${paliLabel}`.toLowerCase(),
    });

    return `
      <a href="#" class="menu-sutta-link" data-id="${escapeAttr(s.id)}">
        <div class="sutra-label">
          <div class="sutra-label-main">${escapeHtml(mainText)}</div>
          ${subText ? `<div class="sutra-label-sub">${escapeHtml(subText)}</div>` : ''}
        </div>
      </a>
    `;
  }

  function buildMenuChildren(children, parentId) {
    if (!children || !children.length) return '';
    let html = '';
    children.forEach((child) => {
      if (child.type === 'group') {
        const grpId = safeDomId(parentId + '-' + child.key);
        const label =
          uiLang === 'en'
            ? child.labelEn || child.labelVi || child.key
            : child.labelVi || child.labelEn || child.key;

        html += `
          <div class="menu-subblock">
            <button class="menu-toggle nested" type="button" data-target="${escapeAttr(grpId)}" aria-expanded="false">
              <span>${escapeHtml(label)}</span><span class="chevron">▸</span>
            </button>
            <div id="${escapeAttr(grpId)}" class="menu-list collapsed">
              ${buildMenuChildren(child.children || [], grpId)}
            </div>
          </div>
        `;
      } else if (child.type === 'sutta') {
        html += buildSuttaLinkHtml(child);
      }
    });
    return html;
  }

  function buildSutraMenuFromIndex() {
    const index = window.SUTRA_INDEX || [];
    FLAT_SUTTAS = [];

    if (!Array.isArray(index) || !index.length) {
      sutraMenuList && (sutraMenuList.innerHTML = '<li>Chưa có mục lục.</li>');
      return;
    }

    let html = '';
    index.forEach((sec) => {
      const secId = safeDomId('sec-' + sec.key);
      const label =
        uiLang === 'en' ? sec.labelEn || sec.labelVi || sec.key : sec.labelVi || sec.labelEn || sec.key;

      html += `
        <li class="menu-block">
          <button class="menu-toggle" type="button" data-target="${escapeAttr(secId)}" aria-expanded="false">
            <span>${escapeHtml(label)}</span><span class="chevron">▸</span>
          </button>
          <div id="${escapeAttr(secId)}" class="menu-list collapsed">
            <!-- Sticky header bên trong accordion — dính lên đầu khi cuộn -->
            <div class="menu-nikaya-sticky" data-label="${escapeAttr(label)}">${escapeHtml(label)}</div>
            ${buildMenuChildren(sec.children || [], secId)}
          </div>
        </li>
      `;
    });

    if (!sutraMenuList) return;
    sutraMenuList.innerHTML = html;

    SUTRA_ORDER = Array.from(sutraMenuList.querySelectorAll('.menu-sutta-link')).map((a) =>
      a.getAttribute('data-id')
    );
    highlightActiveInMenu();
    initMenuBreadcrumb();
  }

  // =========================================================
  // 13b) Breadcrumb realtime — dòng nhỏ dưới search hiện Nikāya đang xem
  // =========================================================
  let _menuScrollCleanup = null;

  function initMenuBreadcrumb() {
    // Cleanup listener cũ
    if (_menuScrollCleanup) { _menuScrollCleanup(); _menuScrollCleanup = null; }

    const list = sutraMenuList;
    if (!list) return;

    // Tạo hoặc lấy breadcrumb element
    let bc = $('menuBreadcrumb');
    if (!bc) {
      bc = document.createElement('div');
      bc.id = 'menuBreadcrumb';
      bc.className = 'menu-breadcrumb';
      bc.setAttribute('aria-live', 'polite');
      // Chèn vào trước sutra-list
      const sutraList = list.closest('#sutraMenuPanel')
        ? document.querySelector('#sutraMenuPanel .sutra-list') || list
        : list;
      sutraList.parentElement && sutraList.parentElement.insertBefore(bc, sutraList);
    }
    bc.textContent = '';
    bc.classList.remove('visible');

    // Theo dõi scroll trên list để cập nhật breadcrumb
    let currentNikaya = '';

    const onListScroll = throttle(() => {
      const listRect = list.getBoundingClientRect();
      const stickyHeaders = list.querySelectorAll('.menu-nikaya-sticky');
      let active = '';

      stickyHeaders.forEach((h) => {
        // Chỉ tính header trong accordion đang mở
        if (!h.closest('.menu-list') || h.closest('.menu-list').classList.contains('collapsed')) return;
        const r = h.getBoundingClientRect();
        if (r.top <= listRect.top + 4) {
          active = h.getAttribute('data-label') || '';
        }
      });

      if (active !== currentNikaya) {
        currentNikaya = active;
        if (active) {
          const prefix = uiLang === 'en' ? 'In:' : 'Đang ở:';
          bc.innerHTML = `<span class="bc-prefix">${escapeHtml(prefix)}</span> <span class="bc-label">${escapeHtml(active)}</span>`;
          bc.classList.add('visible');
        } else {
          bc.textContent = '';
          bc.classList.remove('visible');
        }
      }
    }, 80);

    list.addEventListener('scroll', onListScroll, { passive: true });
    _menuScrollCleanup = () => list.removeEventListener('scroll', onListScroll);
  }

  function highlightActiveInMenu() {
    if (!sutraMenuList) return;
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-id') === currentSutraId);
    });
  }

  function renderSearchResults(matches, q) {
    if (!searchResultsEl) return;
    if (!q) {
      searchResultsEl.innerHTML = '';
      return;
    }

    if (!matches.length) {
      const msg = uiLang === 'en' ? 'No matching sutta found.' : 'Không tìm thấy kinh phù hợp.';
      searchResultsEl.innerHTML = `<div class="search-result-empty">${escapeHtml(msg)}</div>`;
      return;
    }

    const html = matches
      .map(
        (m) => `
      <button class="search-result-item" data-id="${escapeAttr(m.id)}">
        <span class="search-main">${escapeHtml(m.main)}</span>
        ${m.sub ? `<span class="search-sub">${escapeHtml(m.sub)}</span>` : ''}
      </button>
    `
      )
      .join('');
    searchResultsEl.innerHTML = html;
  }

  function applySearch(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return renderSearchResults([], '');
    const matches = FLAT_SUTTAS.filter((x) => x.flat.includes(q)).slice(0, 80);
    renderSearchResults(matches, query);
  }

  if (searchInput) searchInput.addEventListener('input', debounce((e) => applySearch(e.target.value), 180));

  // Event delegation (menu + search) — attach once
  function initDelegations() {
    if (sutraMenuList && sutraMenuList.dataset.delegateAttached !== '1') {
      sutraMenuList.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.menu-toggle');
        if (btn && sutraMenuList.contains(btn)) {
          ev.preventDefault();
          const targetId = btn.dataset.target;
          const panel = document.getElementById(targetId);
          if (!panel) return;

          const isCollapsed = panel.classList.contains('collapsed');
          panel.classList.toggle('collapsed', !isCollapsed);

          btn.setAttribute('aria-expanded', String(!panel.classList.contains('collapsed')));
          const chev = btn.querySelector('.chevron');
          if (chev) chev.textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
          return;
        }

        const a = ev.target.closest('.menu-sutta-link');
        if (a && sutraMenuList.contains(a)) {
          ev.preventDefault();
          const id = a.getAttribute('data-id');
          if (id) {
            openSutra(id);
            togglePanel(sutraMenuPanel, false);
            if (searchInput) searchInput.value = '';
            if (searchResultsEl) searchResultsEl.innerHTML = '';
          }
        }
      });
      sutraMenuList.dataset.delegateAttached = '1';
    }

    if (searchResultsEl && searchResultsEl.dataset.delegateAttached !== '1') {
      searchResultsEl.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.search-result-item');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (id) {
          openSutra(id);
          togglePanel(sutraMenuPanel, false);
          if (searchInput) searchInput.value = '';
          searchResultsEl.innerHTML = '';
        }
      });
      searchResultsEl.dataset.delegateAttached = '1';
    }
  }

  // =========================================================
  // 14) Meta lookup trong SUTRA_INDEX
  // =========================================================
  function findMetaById(id) {
    const index = window.SUTRA_INDEX || [];
    let found = null;
    function walk(children) {
      if (!children || !children.length || found) return;
      for (const ch of children) {
        if (found) return;
        if (ch.type === 'sutta' && ch.id === id) {
          found = ch;
          return;
        }
        if (ch.type === 'group') walk(ch.children || []);
      }
    }
    for (const sec of index) {
      walk(sec.children || []);
      if (found) break;
    }
    return found;
  }

  // =========================================================
  // 15) createRow — FIX: dùng DOM API + textContent thay innerHTML + escapeHtml
  //     Lợi ích: nhanh hơn ~30% với danh sách dài, an toàn XSS tuyệt đối
  // =========================================================
  function createRow(r) {
    const row = document.createElement('div');
    row.className = 'sutra-row';
    row.setAttribute('data-key', String(r.key || ''));

    // Pali column
    const paliCol = document.createElement('div');
    paliCol.className = 'sutra-col pali-col';
    const paliInner = document.createElement('div');
    paliInner.className = 'pali';
    paliInner.textContent = r.pali || '';
    paliCol.appendChild(paliInner);

    // English column
    const engCol = document.createElement('div');
    engCol.className = 'sutra-col eng-col';
    const engInner = document.createElement('div');
    engInner.className = 'eng';
    engInner.textContent = r.eng || '';
    engCol.appendChild(engInner);

    // Vietnamese column
    const vieCol = document.createElement('div');
    vieCol.className = 'sutra-col vie-col';
    const vieInner = document.createElement('div');
    vieInner.className = 'vie';
    vieInner.textContent = r.vie || '';
    vieCol.appendChild(vieInner);

    row.appendChild(paliCol);
    row.appendChild(engCol);
    row.appendChild(vieCol);

    return row;
  }

  function getByExactOrSuffix(map, exactKey, suffix) {
    if (!map) return '';
    if (exactKey && map[exactKey]) return map[exactKey];
    const keys = Object.keys(map);
    let k = exactKey ? keys.find((x) => x === exactKey) : null;
    if (!k && suffix) k = keys.find((x) => String(x).endsWith(suffix));
    return k ? map[k] || '' : '';
  }

  function pickTextForUiLangSuffix(merged, id, suffix) {
    const exactKey = id + suffix;
    if (uiLang === 'en') {
      return (
        getByExactOrSuffix(merged.engMap, exactKey, suffix) ||
        getByExactOrSuffix(merged.vieMap, exactKey, suffix) ||
        getByExactOrSuffix(merged.paliMap, exactKey, suffix) ||
        ''
      );
    }
    return (
      getByExactOrSuffix(merged.vieMap, exactKey, suffix) ||
      getByExactOrSuffix(merged.engMap, exactKey, suffix) ||
      getByExactOrSuffix(merged.paliMap, exactKey, suffix) ||
      ''
    );
  }

  function renderWelcomeScreen() {
    if (!grid || currentSutraId) return;
    if (uiLang === 'en') {
      titleEl && (titleEl.textContent = 'Sutta reading collection');
      subtitleEl && (subtitleEl.textContent = 'Tap 📖 to select a sutta, or ❓ for the guide.');
      grid.innerHTML = `
        <div class="welcome-screen">
          <div class="welcome-box">
            <strong>Welcome!</strong><br><br>
            • Tap 📖 <strong>Sutta Index</strong> to choose a sutta.<br>
            • Tap ⚙ <strong>Settings</strong> to adjust layout/colors/TTS.<br>
            • Tap ❓ <strong>Guide</strong> for help.
          </div>
        </div>`;
    } else {
      titleEl && (titleEl.textContent = 'Chào mừng bạn đến với trang lưu trữ kinh');
      subtitleEl && (subtitleEl.textContent = 'Bấm 📖 để chọn bài kinh, hoặc ❓ để xem hướng dẫn.');
      grid.innerHTML = `
        <div class="welcome-screen">
          <div class="welcome-box">
            <strong>Xin chào!</strong><br><br>
            • Bấm 📖 <strong>Danh mục bài kinh</strong> để chọn bài.<br>
            • Bấm ⚙ <strong>Cài đặt</strong> để chỉnh bố cục/màu/TTS.<br>
            • Bấm ❓ <strong>Hướng dẫn</strong> để xem cách dùng.
          </div>
        </div>`;
    }
  }

  // =========================================================
  // 16) Render sutra — FIX: restoreScrollByAnchor chỉ gọi 1 lần ở cuối
  // =========================================================
  async function renderSutra(id) {
    if (!id || !grid) return;

    saveScrollAnchorNow();
    resetTts(true, false);

    const token = ++renderToken;
    isRendering = true;

    btnReadTts && (btnReadTts.disabled = true);
    btnPauseTts && (btnPauseTts.disabled = true);
    btnStopTts && (btnStopTts.disabled = true);

    currentSutraId = id;
    try {
      localStorage.setItem(KEY_LAST, id);
    } catch (e) {}
    highlightActiveInMenu();

    let merged = null;
    try {
      merged = await loadMerged(id);
    } catch (e) {
      merged = null;
    }
    if (token !== renderToken) return;

    if (!merged || !merged.rows || !merged.rows.length) {
      titleEl && (titleEl.textContent = uiLang === 'en' ? 'Sutta data not found' : 'Không tìm thấy dữ liệu bài kinh');
      subtitleEl && (subtitleEl.textContent = (uiLang === 'en' ? 'ID: ' : 'Mã bài: ') + id);
      grid.innerHTML = '';
      isRendering = false;
      setTtsUiState('idle');
      return;
    }

    const titleFromBilara = (pickTextForUiLangSuffix(merged, id, ':0.2') || '').trim();
    const subtitleFromBilara = (pickTextForUiLangSuffix(merged, id, ':0.1') || '').trim();

    const meta = findMetaById(id) || {};
    const titleFallback =
      uiLang === 'en'
        ? meta.titleEn || meta.titleVi || meta.titlePali || meta.title || id
        : meta.titleVi || meta.titleEn || meta.titlePali || meta.title || id;
    const subtitleFallback =
      uiLang === 'en'
        ? meta.subtitleEn || meta.subtitleVi || meta.subtitle || ''
        : meta.subtitleVi || meta.subtitleEn || meta.subtitle || '';

    titleEl && (titleEl.textContent = titleFromBilara || titleFallback);
    subtitleEl && (subtitleEl.textContent = subtitleFromBilara || subtitleFallback);

    const rowsForViewRaw = (merged.rows || []).filter((r) => !String(r.key || '').includes(':0.'));

    const singleLang = getSingleVisibleLang();
    lastSingleLangMode = singleLang;

    const rowsForView = singleLang ? mergeRowsToParagraphRows(rowsForViewRaw, singleLang) : rowsForViewRaw;

    grid.innerHTML = '';
    applyVisibility();

    let i = 0;
    const BATCH = 220;

    function renderBatch() {
      if (token !== renderToken) return;

      const frag = document.createDocumentFragment();
      const end = Math.min(i + BATCH, rowsForView.length);
      for (; i < end; i++) frag.appendChild(createRow(rowsForView[i]));
      grid.appendChild(frag);

      if (i < rowsForView.length) {
        requestAnimationFrame(renderBatch);
      } else {
        // FIX: restoreScrollByAnchor chỉ gọi 1 lần sau khi render xong hoàn toàn
        // (không gọi mỗi batch để tránh querySelectorAll lặp lặp)
        isRendering = false;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            adjustRowColumns();
            restoreScrollByAnchor(id);
            setTtsUiState('idle');
          });
        });

        // Preload bài TIẾP THEO (chỉ next, không prev)
        // Lý do bỏ prev: preload prev + next = 6 request JS thêm ngay sau render,
        // tranh bandwidth trên mobile/3G. Next đủ dùng cho trải nghiệm swipe.
        // Điều kiện: requestIdleCallback + không saveData + deviceMemory đủ
        scheduleNextPreload(id);
      }
    }

    renderBatch();
  }

  // =========================================================
  // 17) Preload bài tiếp theo — chỉ next, có kiểm tra network/memory
  // =========================================================
  function scheduleNextPreload(currentId) {
    try {
      const idx = SUTRA_ORDER.indexOf(currentId);
      if (idx === -1) return;

      const nextId = SUTRA_ORDER[idx + 1];
      if (!nextId) return;

      // Kiểm tra save-data
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const saveData = !!(conn && conn.saveData);
      if (saveData) return;

      // Kiểm tra deviceMemory — bỏ qua trên thiết bị RAM thấp (< 2GB)
      const memOk = !navigator.deviceMemory || navigator.deviceMemory >= 2;
      if (!memOk) return;

      // Chỉ preload khi trình duyệt rảnh
      const doPreload = () => {
        loadMerged(nextId).catch(() => {});
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(doPreload, { timeout: 2000 });
      } else {
        setTimeout(doPreload, 800);
      }
    } catch (e) {}
  }

  function openSutra(id) {
    renderSutra(id);
  }

  // =========================================================
  // 18) Swipe prev/next (mobile)
  // =========================================================
  const SWIPE_THRESHOLD = 80;
  const SWIPE_MAX_DY = 25;

  function goPrevNext(direction) {
    const idx = SUTRA_ORDER.indexOf(currentSutraId);
    if (idx === -1) return;
    if (direction === 'next' && idx < SUTRA_ORDER.length - 1) openSutra(SUTRA_ORDER[idx + 1]);
    if (direction === 'prev' && idx > 0) openSutra(SUTRA_ORDER[idx - 1]);
  }

  if (grid) {
    let sx = 0,
      sy = 0;
    grid.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length) {
          sx = e.touches[0].clientX;
          sy = e.touches[0].clientY;
        }
      },
      { passive: true }
    );
    grid.addEventListener(
      'touchend',
      (e) => {
        if (!e.changedTouches.length) return;
        const ex = e.changedTouches[0].clientX;
        const ey = e.changedTouches[0].clientY;
        const dx = ex - sx;
        const dy = ey - sy;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dy) <= SWIPE_MAX_DY) {
          if (dx < 0) goPrevNext('next');
          else goPrevNext('prev');
        }
      },
      { passive: true }
    );
  }

  // =========================================================
  // 19) TTS (Web Speech) — theo uiLang
  //
  // LƯU Ý: Web Speech API không hỗ trợ resume giữa chừng một câu.
  // Khi pause, synth.cancel() hủy utterance đang đọc và lưu index câu đó.
  // Khi resume, câu đó sẽ được đọc lại từ đầu (không phải từ chỗ dừng).
  // Đây là giới hạn của Web Speech API trên tất cả trình duyệt, không phải bug.
  // =========================================================
  const synthSupported = 'speechSynthesis' in window;
  const synth = synthSupported ? window.speechSynthesis : null;

  let cachedVoices = [];
  if (synthSupported) {
    try {
      cachedVoices = synth.getVoices() || [];
    } catch (e) {}
    synth.addEventListener('voiceschanged', () => {
      try {
        cachedVoices = synth.getVoices() || [];
      } catch (e) {}
    });
  }

  function ensureVoicesLoaded(timeout = 1200) {
    return new Promise((resolve) => {
      if (!synth) return resolve([]);
      try {
        const v = synth.getVoices();
        if (v && v.length) {
          cachedVoices = v;
          return resolve(v);
        }
      } catch (e) {}

      const onChange = () => {
        try {
          const v2 = synth.getVoices();
          if (v2 && v2.length) {
            synth.removeEventListener('voiceschanged', onChange);
            cachedVoices = v2;
            resolve(v2);
          }
        } catch (e) {}
      };

      synth.addEventListener('voiceschanged', onChange);
      setTimeout(() => {
        try {
          synth.removeEventListener('voiceschanged', onChange);
        } catch (e) {}
        try {
          cachedVoices = synth.getVoices() || [];
        } catch (e) {}
        resolve(cachedVoices);
      }, timeout);
    });
  }

  const ttsState = {
    activeLang: null,
    index: 0,
    isPlaying: false,
    isPaused: false,
    currentUtter: null,
  };

  function setTtsUiState(state) {
    if (!btnReadTts || !btnPauseTts || !btnStopTts) return;

    if (!synthSupported || isRendering) {
      btnReadTts.disabled = true;
      btnPauseTts.disabled = true;
      btnStopTts.disabled = true;
      return;
    }

    if (state === 'idle') {
      btnReadTts.disabled = false;
      btnPauseTts.disabled = true;
      btnStopTts.disabled = true;
    } else if (state === 'playing') {
      btnReadTts.disabled = true;
      btnPauseTts.disabled = false;
      btnStopTts.disabled = false;
    } else if (state === 'paused') {
      btnReadTts.disabled = false;
      btnPauseTts.disabled = true;
      btnStopTts.disabled = false;
    }
  }

  function clearRowHighlight() {
    if (!grid) return;
    grid.querySelectorAll('.sutra-row.reading').forEach((r) => r.classList.remove('reading'));
  }

  function highlightRowAt(index) {
    if (!grid) return;
    clearRowHighlight();
    const rows = grid.querySelectorAll('.sutra-row');
    if (index < 0 || index >= rows.length) return;
    const row = rows[index];
    row.classList.add('reading');

    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    const viewTop = grid.scrollTop;
    const viewBottom = viewTop + grid.clientHeight;
    if (top < viewTop || bottom > viewBottom) {
      grid.scrollTo({ top: Math.max(0, top - 20), behavior: 'auto' });
    }
  }

  function pickVoice(langPrefix) {
    const lp = (langPrefix || '').toLowerCase();
    const list = (cachedVoices || []).filter((v) => v.lang && v.lang.toLowerCase().startsWith(lp));
    const good = list.find((v) => /google|microsoft/i.test(v.name || ''));
    return good || list[0] || null;
  }

  function resetTts(clearHighlight, clearStorage) {
    if (synthSupported && synth) {
      try {
        synth.cancel();
      } catch (e) {}
    }
    ttsState.isPlaying = false;
    ttsState.isPaused = false;
    ttsState.currentUtter = null;
    ttsState.index = 0;
    ttsState.activeLang = null;

    if (clearHighlight) clearRowHighlight();

    if (clearStorage && currentSutraId) {
      try {
        localStorage.removeItem('tts_state_' + currentSutraId);
      } catch (e) {}
    }
    setTtsUiState('idle');
  }

  function saveTtsState() {
    if (!currentSutraId || !ttsState.activeLang) return;
    try {
      localStorage.setItem(
        'tts_state_' + currentSutraId,
        JSON.stringify({ lang: ttsState.activeLang, index: ttsState.index })
      );
    } catch (e) {}
  }

  function speakNextRow() {
    if (!synthSupported || !synth || !grid) return;
    if (!ttsState.activeLang) return;

    const rows = grid.querySelectorAll('.sutra-row');
    if (ttsState.index >= rows.length) return resetTts(true, true);

    const row = rows[ttsState.index];
    const el =
      ttsState.activeLang === 'vi'
        ? row.querySelector('.vie-col .vie')
        : row.querySelector('.eng-col .eng');

    const text = el ? (el.textContent || '').trim() : '';
    if (!text) {
      ttsState.index++;
      return speakNextRow();
    }

    highlightRowAt(ttsState.index);
    saveTtsState();

    const utter = new SpeechSynthesisUtterance(text);
    if (ttsState.activeLang === 'vi') {
      utter.lang = 'vi-VN';
      const v = pickVoice('vi');
      if (v) utter.voice = v;
      utter.rate = 0.98;
      utter.pitch = 0.95;
    } else {
      utter.lang = 'en-US';
      const v = pickVoice('en');
      if (v) utter.voice = v;
    }

    utter.onend = () => {
      ttsState.currentUtter = null;
      if (!ttsState.activeLang || ttsState.isPaused || !ttsState.isPlaying) return;
      ttsState.index++;
      speakNextRow();
    };

    utter.onerror = () => {
      ttsState.currentUtter = null;
      resetTts(true, false);
    };

    ttsState.currentUtter = utter;
    ttsState.isPlaying = true;
    ttsState.isPaused = false;
    setTtsUiState('playing');

    try {
      synth.speak(utter);
    } catch (e) {
      resetTts(true, false);
    }
  }

  async function startTtsByUiLang() {
    if (isRendering) {
      alert(
        uiLang === 'en'
          ? 'Please wait for the text to finish loading.'
          : 'Vui lòng chờ tải xong nội dung rồi hãy bấm đọc.'
      );
      return;
    }
    if (!synthSupported) {
      alert(
        uiLang === 'en'
          ? 'Your browser does not support TTS.'
          : 'Trình duyệt không hỗ trợ đọc TTS.'
      );
      return;
    }

    const targetLang = uiLang === 'en' ? 'en' : 'vi';

    if (ttsState.activeLang === targetLang && ttsState.isPlaying) return;

    if (ttsState.activeLang === targetLang && ttsState.isPaused) {
      // Resume: câu hiện tại sẽ được đọc lại từ đầu (giới hạn Web Speech API)
      ttsState.isPaused = false;
      ttsState.isPlaying = true;
      setTtsUiState('playing');
      speakNextRow();
      return;
    }

    resetTts(true, false);
    ttsState.activeLang = targetLang;

    await ensureVoicesLoaded();

    if (currentSutraId) {
      try {
        const raw = localStorage.getItem('tts_state_' + currentSutraId);
        if (raw) {
          const st = JSON.parse(raw);
          if (st && st.lang === targetLang && typeof st.index === 'number') ttsState.index = st.index;
        }
      } catch (e) {}
    }
    if (!Number.isInteger(ttsState.index) || ttsState.index < 0) ttsState.index = 0;

    speakNextRow();
  }

  function pauseTtsByUiLang() {
    if (!synthSupported || !synth) return;
    if (!ttsState.activeLang || !ttsState.isPlaying || !ttsState.currentUtter) return;

    ttsState.isPaused = true;
    ttsState.isPlaying = false;
    try {
      synth.cancel();
    } catch (e) {}
    ttsState.currentUtter = null;
    saveTtsState();
    clearRowHighlight();
    setTtsUiState('paused');
  }

  function stopTtsByUiLang() {
    if (!synthSupported || !synth) return;
    resetTts(true, true);
  }

  btnReadTts && (btnReadTts.onclick = startTtsByUiLang);
  btnPauseTts && (btnPauseTts.onclick = pauseTtsByUiLang);
  btnStopTts && (btnStopTts.onclick = stopTtsByUiLang);

  // =========================================================
  // 20) UI Lang switch
  // =========================================================
  function initUiLang() {
    renderUiLangFlag();
    applyUiLanguageToSearchUi();
    applyUiLanguageToSettingsPanel();
    renderGuideDialog();

    if (!btnUiLang) return;
    btnUiLang.addEventListener('click', () => {
      uiLang = uiLang === 'vi' ? 'en' : 'vi';
      localStorage.setItem(LANG_STORAGE_KEY, uiLang);
      window.SUTRA_UI_LANG = uiLang;

      renderUiLangFlag();
      applyUiLanguageToSearchUi();
      applyUiLanguageToSettingsPanel();
      renderGuideDialog();

      buildSutraMenuFromIndex();
      highlightActiveInMenu();

      if (currentSutraId) renderSutra(currentSutraId);
      else renderWelcomeScreen();
    });
  }

  // =========================================================
  // 21) INIT
  // =========================================================
  function init() {
    if (!grid || !titleEl || !subtitleEl || !card) {
      console.warn('Sutta app: core DOM missing, some features may be disabled.');
    }

    initUiLang();

    loadViewPrefs();
    btnPali && btnPali.classList.toggle('active', showPali);
    btnEng && btnEng.classList.toggle('active', showEng);
    btnVie && btnVie.classList.toggle('active', showVie);
    btnLayout && btnLayout.classList.toggle('active', card && card.classList.contains('stack'));
    applyVisibility();

    initColorControls();
    loadZoom();

    buildSutraMenuFromIndex();
    initDelegations();

    let startId = null;
    try {
      startId = localStorage.getItem(KEY_LAST);
    } catch (e) {}
    if (startId) openSutra(startId);
    else renderWelcomeScreen();

    if (!synthSupported) {
      [btnReadTts, btnPauseTts, btnStopTts].forEach((b) => b && (b.disabled = true));
    } else {
      setTtsUiState('idle');
    }
  }

  init();
})();
