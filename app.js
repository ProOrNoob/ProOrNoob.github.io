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
  return keys.sort(function (x, y) {
    var strX = String(x).toLowerCase();
    var strY = String(y).toLowerCase();

    // 1. LUẬT TUYỆT ĐỐI: Thẻ nào có chữ "source" thì ép văng xuống dưới đáy
    var isSourceX = strX.includes('source');
    var isSourceY = strY.includes('source');
    
    if (isSourceX && !isSourceY) return 1;  // X có source -> đẩy X xuống dưới
    if (!isSourceX && isSourceY) return -1; // Y có source -> đẩy Y xuống dưới
    if (isSourceX && isSourceY) return strX.localeCompare(strY, 'en', { numeric: true });

    // 2. Logic xử lý các thẻ chuẩn (cắt qua dấu :)
    var partsX = x.split(':');
    var partsY = y.split(':');

    var idX = partsX[0] || '';
    var idY = partsY[0] || '';

    // So sánh ID bài kinh (ví dụ: sn1.1 vs sn1.2)
    var idCmp = idX.localeCompare(idY, 'en', { numeric: true });
    if (idCmp !== 0) return idCmp;

    // So sánh phân cấp Segment (ví dụ: 1.1 vs 1.2)
    var segX = partsX[1] || '';
    var segY = partsY[1] || '';

    var sx = segX.split('.');
    var sy = segY.split('.');
    var maxLen = Math.max(sx.length, sy.length);

    for (var i = 0; i < maxLen; i++) {
      var pX = sx[i];
      var pY = sy[i];

      if (pX === undefined) return -1;
      if (pY === undefined) return 1;

      var numX = parseInt(pX, 10);
      var numY = parseInt(pY, 10);
      var isNumX = !isNaN(numX);
      var isNumY = !isNaN(numY);

      if (isNumX && isNumY) {
        // Cả 2 đều là số học
        if (numX !== numY) return numX - numY;
      } else if (isNumX && !isNumY) {
        // Số luôn đứng TRƯỚC chữ
        return -1;
      } else if (!isNumX && isNumY) {
        return 1;
      } else {
        var strCmp = pX.localeCompare(pY, 'en', { numeric: true });
        if (strCmp !== 0) return strCmp;
      }
    }
    return 0;
  });
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
  var readerArea  = $('readerArea') || grid;  // scroll container; fallback to grid

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
  var btnSegKey    = $('btnSegKey');
  var btnSegHdr    = $('btnSegHdr');
  var superTitleEl = $('supertitle');
  var titleMetaEl  = $('titleMeta');

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
  var SEG_KEY_STORAGE_KEY = 'sutra_hide_seg_key';
  var SEG_HDR_STORAGE_KEY = 'sutra_hide_seg_hdr';
  var hideSegKey = storage.get(SEG_KEY_STORAGE_KEY) === '1';
  // Column headers (PALI/ENG/TIẾNG VIỆT) default hidden — nhãn lặp lại quá nhiều.
  // Lần đầu visit (storage === null) → ẩn; sau đó tôn trọng lựa chọn người dùng.
  var rawSegHdr  = storage.get(SEG_HDR_STORAGE_KEY);
  var hideSegHdr = rawSegHdr === null ? true : rawSegHdr === '1';

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

  // Lấy "scope" của segment để phân paragraph: "sn1.11:3.5" → "sn1.11:3"
  // Khi scope thay đổi (major section hoặc sub-sutta khác), ngắt đoạn mới.
  function getMajorScope(key) {
    var m = String(key || '').match(/^(.+):(\d+)/);
    return m ? (m[1] + ':' + m[2]) : null;
  }

  function mergeRowsToParagraphRows(rows, lang) {
    var out = [];
    if (!Array.isArray(rows)||!rows.length) return out;
    var buf = '', bufKey = null, currentScope = null;
    var flush = function () {
      var text = (buf||'').trim();
      if (!text) { buf=''; bufKey=null; return; }
      var r = { key: bufKey||'', pali:'', eng:'', vie:'' };
      if (lang==='pali') r.pali=text;
      if (lang==='eng') r.eng=text;
      if (lang==='vie') r.vie=text;
      out.push(r); buf=''; bufKey=null;
    };
    var pushStandalone = function (key, t) {
      var rr = { key: key, pali:'', eng:'', vie:'' };
      if (lang==='pali') rr.pali=t;
      if (lang==='eng') rr.eng=t;
      if (lang==='vie') rr.vie=t;
      out.push(rr);
    };
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = String(r.key||'');
      var raw = lang==='pali'?(r.pali||''):lang==='eng'?(r.eng||''):(r.vie||'');
      var t = (raw||'').trim();
      if (!t) continue;

      // Metadata/title rows (vd :0.3 sub-sutta title) → standalone, không merge
      if (/:0\.\d/.test(key)) {
        flush();
        pushStandalone(key, t);
        currentScope = null;
        continue;
      }
      // Heading "1. Paribbājakakathā" → standalone
      if (isNumberedHeadingLine(t)) {
        flush();
        pushStandalone(key, t);
        currentScope = null;
        continue;
      }

      // Ngắt paragraph khi scope đổi (major section hoặc sub-sutta mới)
      var scope = getMajorScope(key);
      if (currentScope !== null && scope !== currentScope) flush();
      currentScope = scope;

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
  // Ngôi sao 5 cánh đều: R=10 (outer), r≈3.82 (inner = R·(3−√5)/2), tâm (24,16)
  // UI language toggle — hiển thị text "VI" / "EN" trong mono uppercase để hòa vào typography,
  // không dùng cờ màu (quá nổi bật so với aesthetic monastic minimal).
  function renderUiLangFlag() {
    if (!btnUiLang) return;
    btnUiLang.innerHTML = '<span class="lang-code">' + (uiLang === 'en' ? 'EN' : 'VI') + '</span>';
    btnUiLang.setAttribute('aria-label', uiLang === 'en'
      ? 'Interface: English — click to switch to Vietnamese'
      : 'Giao diện: Tiếng Việt — bấm để chuyển sang English');
    btnUiLang.setAttribute('title', uiLang === 'en' ? 'Switch to Tiếng Việt' : 'Chuyển sang English');
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
    setText('settingsSegmentLabel',   isEn ? 'Segments'             : 'Phân đoạn');
    setText('settingsSegmentSub',     isEn ? 'Show / hide'          : 'Hiện / ẩn');
    setText('settingsInterfaceLabel', isEn ? 'Interface'            : 'Giao diện');

    var note = $('settingsTtsNote');
    if (note) note.innerHTML = isEn
      ? '* Uses browser built-in voices, quality may vary by device.'
      : '* TTS dùng giọng có sẵn của trình duyệt, có thể khác nhau giữa thiết bị.';

    if (btnLayout) btnLayout.innerHTML = isEn
      ? '<span class="pill-icon">☰</span> Stacked'
      : '<span class="pill-icon">☰</span> Xếp dọc';

    if (btnSegHdr) btnSegHdr.innerHTML = isEn
      ? '<span class="pill-icon">▦</span> Segment'
      : '<span class="pill-icon">▦</span> Phân đoạn';
    if (btnSegKey) btnSegKey.innerHTML = isEn
      ? '<span class="pill-icon">#</span> Segment ID'
      : '<span class="pill-icon">#</span> Mã đoạn';

    if (btnGuide)     btnGuide.setAttribute('aria-label',     isEn ? 'User guide'       : 'Hướng dẫn sử dụng');
    if (btnSutraMenu) btnSutraMenu.setAttribute('aria-label', isEn ? 'Sutta Index'      : 'Danh mục bài kinh');
    if (btnSettings)  btnSettings.setAttribute('aria-label',  isEn ? 'Display settings'  : 'Cài đặt hiển thị');
    if (btnBackTop)   btnBackTop.setAttribute('aria-label',   isEn ? 'Back to top'       : 'Lên đầu trang');
    if (btnPauseTts)  btnPauseTts.setAttribute('aria-label',
      isEn ? 'Pause (current sentence will restart)' : 'Tạm dừng (câu hiện tại sẽ đọc lại từ đầu)');

    setText('sidebarBtnLabel',  isEn ? 'Library'  : 'Thư viện');
    setText('btnSettingsLabel', isEn ? 'Settings' : 'Cài đặt');
    setText('btnPrevLabel',     isEn ? 'Prev'     : 'Trước');
    setText('btnNextLabel',     isEn ? 'Next'     : 'Sau');

    var sidebarBtn = $('sidebar-btn');
    if (sidebarBtn) sidebarBtn.setAttribute('title', isEn ? 'Library' : 'Thư viện');
    if (btnSettings) btnSettings.setAttribute('title', isEn ? 'Settings' : 'Cài đặt');
  }

  function renderGuideDialog() {
    if (!guideOverlay) return;
    var dlg = guideOverlay.querySelector('.guide-dialog');
    if (!dlg) return;
    var isEn = uiLang === 'en';
    dlg.innerHTML = isEn
      ? '<h2>Quick guide</h2>' +
        '<em>Trilingual sutta reader — Pāli · English · Vietnamese</em>' +
        '<h3>Navigation</h3>' +
        '<ul>' +
          '<li>📚 <strong>Library</strong> (bottom-left): open catalogue. Nikāya headers stick at top; click to collapse.</li>' +
          '<li>🔎 <strong>Search</strong>: type sutta name, code (e.g. "DN 7", "MN 10"), or Pāli title.</li>' +
          '<li>‹ TRƯỚC / SAU › <strong>Prev / Next</strong>: navigate to neighbouring sutta within same nikāya.</li>' +
          '<li>🎯 <strong>Sutta path</strong> (centre of footer): click to reveal current sutta in Library.</li>' +
          '<li>🔗 <strong>Share</strong>: URL hash updates live (<code>#dn16</code>). Copy URL to share — recipient lands on the exact sutta. Segment-level citation inside the epigraph under Namo tassa opens source sutta on click.</li>' +
        '</ul>' +
        '<h3>Settings panel (⚙ bottom-right)</h3>' +
        '<ul>' +
          '<li><strong>Row 1 — Interface</strong>: 🌙/☀ theme toggle · <strong>VI/EN</strong> UI language · <strong>?</strong> this guide.</li>' +
          '<li><strong>Row 2 — Languages</strong>: Pāli · English · Việt. Toggle column visibility (at least one must stay on).</li>' +
          '<li><strong>Row 3 — Layout &amp; Segments</strong>: ☰ <em>Stacked</em> puts language columns vertically · ▦ <em>Segment</em> shows PALI/ENGLISH/… labels · # <em>ID</em> shows segment codes like "DN16.1.1".</li>' +
          '<li><strong>Row 4 — Display</strong>: font size slider (A) · line-height slider (☰). ↺ buttons below reset each to default.</li>' +
          '<li><strong>Row 5 — Read aloud (TTS)</strong>: ▶ play · ⏸ pause · ⏹ stop. Uses browser speech engine. <em>Note:</em> pausing restarts the current sentence (browser limitation). Vietnamese TTS on Android needs Google TTS engine installed.</li>' +
        '</ul>' +
        '<h3>Keyboard (desktop)</h3>' +
        '<ul>' +
          '<li><kbd>J</kbd> / <kbd>K</kbd> — next / previous segment</li>' +
          '<li><kbd>N</kbd> / <kbd>P</kbd> — next / previous sutta</li>' +
          '<li><kbd>g</kbd> / <kbd>G</kbd> — jump to top / bottom of sutta</li>' +
          '<li><kbd>/</kbd> — open Library + focus search · <kbd>?</kbd> — this guide · <kbd>Esc</kbd> — close any panel</li>' +
        '</ul>' +
        '<em>Feedback / typo reports: tuanctvn199@gmail.com</em>' +
        '<button id="btnCloseGuide" type="button">Close</button>'
      : '<h2>Hướng dẫn nhanh</h2>' +
        '<em>Trang đọc kinh song ngữ — Pāli · English · Tiếng Việt</em>' +
        '<h3>Điều hướng</h3>' +
        '<ul>' +
          '<li>📚 <strong>Thư viện</strong> (góc dưới trái): mở mục lục. Tên Nikāya dính trên cùng; click vào để thu/mở cả Nikāya.</li>' +
          '<li>🔎 <strong>Tìm kiếm</strong>: gõ tên bài, mã (ví dụ "DN 7", "MN 10"), hoặc tên Pāli để lọc.</li>' +
          '<li>‹ TRƯỚC / SAU › <strong>Chuyển bài</strong>: sang bài kế tiếp trong cùng Nikāya.</li>' +
          '<li>🎯 <strong>Tên bài ở giữa footer</strong>: click để xem vị trí bài hiện tại trong Thư viện.</li>' +
          '<li>🔗 <strong>Chia sẻ link</strong>: URL tự cập nhật theo bài (<code>#dn16</code>). Copy URL gửi — người nhận mở trúng bài. Dải câu Pāli dưới Namo tassa có nút "DN 16"… click sẽ mở đến bài kinh nguồn của câu đó.</li>' +
        '</ul>' +
        '<h3>Bảng Cài đặt (⚙ góc dưới phải)</h3>' +
        '<ul>' +
          '<li><strong>Hàng 1 — Giao diện</strong>: 🌙/☀ sáng/tối · <strong>VI/EN</strong> ngôn ngữ giao diện · <strong>?</strong> Hướng dẫn này.</li>' +
          '<li><strong>Hàng 2 — Ngôn ngữ</strong>: Pāli · English · Việt. Bật/tắt từng cột (phải giữ tối thiểu 1).</li>' +
          '<li><strong>Hàng 3 — Bố cục &amp; Phân đoạn</strong>: ☰ <em>Xếp dọc</em> gom cột ngôn ngữ theo chiều dọc · ▦ <em>Segment</em> hiện nhãn PALI/ENGLISH/… trên mỗi đoạn · # <em>ID</em> hiện mã đoạn dạng "DN16.1.1".</li>' +
          '<li><strong>Hàng 4 — Hiển thị</strong>: slider cỡ chữ (A) · slider giãn dòng (☰). Nút ↺ phía dưới để đưa về mặc định.</li>' +
          '<li><strong>Hàng 5 — Đọc kinh (TTS)</strong>: ▶ phát · ⏸ tạm dừng · ⏹ dừng. Dùng giọng đọc có sẵn của trình duyệt. <em>Lưu ý:</em> tạm dừng sẽ đọc lại câu hiện tại từ đầu (giới hạn browser). TTS tiếng Việt trên Android cần cài Google TTS Engine.</li>' +
        '</ul>' +
        '<h3>Phím tắt (desktop)</h3>' +
        '<ul>' +
          '<li><kbd>J</kbd> / <kbd>K</kbd> — đoạn sau / đoạn trước</li>' +
          '<li><kbd>N</kbd> / <kbd>P</kbd> — bài sau / bài trước</li>' +
          '<li><kbd>g</kbd> / <kbd>G</kbd> — nhảy đầu / cuối bài kinh</li>' +
          '<li><kbd>/</kbd> — mở Thư viện + focus ô tìm · <kbd>?</kbd> — Hướng dẫn · <kbd>Esc</kbd> — đóng panel</li>' +
        '</ul>' +
        '<em>Góp ý / báo lỗi dịch: tuanctvn199@gmail.com</em>' +
        '<button id="btnCloseGuide" type="button">Đóng</button>';
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
    };
  }

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

// Tạo một listener cho màn hình hẹp (<= 500px)
const mql = window.matchMedia('(max-width: 500px)');

function updateVisibleCols() {
  const isNarrow = mql.matches; // Kiểm tra nhanh không gây reflow
  const isStack = card?.classList.contains('stack') || false;
  
  let count = (showPali ? 1 : 0) + (showEng ? 1 : 0) + (showVie ? 1 : 0);
  count = Math.max(1, count);

  // Dùng requestAnimationFrame để đảm bảo việc ghi style diễn ra mượt mà
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--visible-cols', isNarrow || isStack ? '1' : String(count));
  });
}

// Lắng nghe sự thay đổi màn hình một cách tối ưu
mql.addEventListener('change', updateVisibleCols);

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
     Segment visibility (column header + segment ID)
     ============================================================ */
  function applySegmentVisibility() {
    document.documentElement.classList.toggle('hide-seg-key', hideSegKey);
    document.documentElement.classList.toggle('hide-seg-hdr', hideSegHdr);
    if (btnSegKey) {
      btnSegKey.classList.toggle('active', !hideSegKey);
      btnSegKey.setAttribute('aria-pressed', String(!hideSegKey));
    }
    if (btnSegHdr) {
      btnSegHdr.classList.toggle('active', !hideSegHdr);
      btnSegHdr.setAttribute('aria-pressed', String(!hideSegHdr));
    }
  }
  if (btnSegKey) btnSegKey.onclick = function () {
    hideSegKey = !hideSegKey;
    storage.set(SEG_KEY_STORAGE_KEY, hideSegKey ? '1' : '0');
    applySegmentVisibility();
  };
  if (btnSegHdr) btnSegHdr.onclick = function () {
    hideSegHdr = !hideSegHdr;
    storage.set(SEG_HDR_STORAGE_KEY, hideSegHdr ? '1' : '0');
    applySegmentVisibility();
  };
  applySegmentVisibility();

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
     Anchor scroll + active segment + reading progress
     FIX: Properly disconnect observer on page unload to prevent memory leak
     ============================================================ */
  var anchorObserver = null;
  var currentSegObserver = null;
  var firstVisibleKey = null;
  var firstVisibleOffsetFromGrid = 0;
  var currentWrap = null;

  function getScrollRoot() {
    // Title block + sutraGrid cùng nằm trong #readerArea (scroll container).
    return readerArea || grid;
  }

  /* Progress bar đã bỏ — giữ function no-op để các caller cũ không lỗi */
  function updateReadingProgress() { /* no-op */ }

  function setupCurrentSegmentObserver() {
    if (currentSegObserver) { currentSegObserver.disconnect(); currentSegObserver = null; }
    var scrollRoot = getScrollRoot();
    if (!scrollRoot) return;
    currentSegObserver = new IntersectionObserver(function (entries) {
      // Pick the wrap closest to the viewport center
      var best = null, bestDist = Infinity;
      var rootRect = scrollRoot.getBoundingClientRect();
      var rootMid  = rootRect.top + rootRect.height / 2;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var r = e.target.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        var dist = Math.abs(mid - rootMid);
        if (dist < bestDist) { bestDist = dist; best = e.target; }
      });
      if (best && best !== currentWrap) {
        if (currentWrap) currentWrap.classList.remove('current');
        best.classList.add('current');
        currentWrap = best;
      }
    }, { root: scrollRoot, rootMargin: '-40% 0px -45% 0px', threshold: 0 });
    scrollRoot.querySelectorAll('.sutra-row-wrap').forEach(function (w) { currentSegObserver.observe(w); });
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
	  if (isRendering) return;
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
      
      // SỬA LỖI: Nếu bài kinh chưa từng lưu vị trí (bài mới), ép cuộn lên đầu
      if (!key) {
        scrollRoot.scrollTop = 0;
        toggleBackTop(false);
        return false;
      }
      
      var safeKey = safeCssEscape(key);
      var row = scrollRoot.querySelector('.sutra-row[data-key="' + safeKey + '"]');
      
      // SỬA LỖI: Nếu tìm không ra dòng đã lưu (do file bị đổi), ép cuộn lên đầu
      if (!row) {
        scrollRoot.scrollTop = 0;
        toggleBackTop(false);
        return false;
      }
      
      var scrollTarget = row.closest('.sutra-row-wrap') || row;
      // Dùng getBoundingClientRect để lấy offset chính xác so với scroll container
      // (sutraGrid giờ không còn là scroll root → offsetTop không còn tương thích).
      var rootRect = scrollRoot.getBoundingClientRect();
      var tgtRect  = scrollTarget.getBoundingClientRect();
      var relativeTop = tgtRect.top - rootRect.top + scrollRoot.scrollTop;
      var max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      var y = relativeTop - (Number.isFinite(off) ? off : 0);
      y = Math.max(0, Math.min(y, max));
      scrollRoot.scrollTop = y;
      toggleBackTop(scrollRoot.scrollTop > 0);
      return true;
    } catch(e) { 
      // SỬA LỖI: Bắt lỗi an toàn, ép về đầu
      scrollRoot.scrollTop = 0;
      toggleBackTop(false);
      return false; 
    }
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
     Back to top + scroll listener
     ============================================================ */
  var suppressBackTop = false;
  function toggleBackTop(show) { if (!btnBackTop) return; btnBackTop.classList.toggle('visible', show); }

  // Legacy stubs — title nay cuộn cùng nội dung nên không cần auto-hide header nữa
  var headerEl = card ? card.querySelector('.header') : null;
  var mobileLastScrollTop = 0;
  function setMobileHeaderHidden() { /* no-op; giữ để không vỡ các caller cũ */ }

  if (btnBackTop && readerArea) btnBackTop.onclick = function () {
    suppressBackTop = true;
    toggleBackTop(false);
    mobileLastScrollTop = 0;
    readerArea.scrollTo({ top: 0, behavior: 'smooth' });
    var done = function () {
      suppressBackTop = false;
      toggleBackTop(false);
      if (currentSutraId) {
        storage.remove(KEY_ANCHOR_K(currentSutraId));
        storage.remove(KEY_ANCHOR_O(currentSutraId));
      }
    };
    if ('onscrollend' in readerArea) {
      readerArea.addEventListener('scrollend', done, { once: true });
    } else {
      var prev = -1;
      var poll = function () {
        var st = readerArea.scrollTop;
        if (st === 0 && st === prev) { done(); return; }
        prev = st;
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }
  };

  if (readerArea) {
    // Scroll listener — throttled cho save anchor + back-to-top + progress
    readerArea.addEventListener('scroll', throttle(function () {
      if (!suppressBackTop) toggleBackTop(readerArea.scrollTop > 0);
      saveScrollAnchorNow();
      updateReadingProgress();
    }, 120), { passive: true });
  }

  /* ============================================================
     Menu build
     ============================================================ */
  // Rút gọn code bài kinh: "SN 1 – Vagga 1" → "SN 1.1", "DN 7" → "DN 7"
  function shortenCode(code) {
    if (!code) return '';
    var m = String(code).match(/^([A-Za-z]+)\s*(\d+)\s*[–\-]\s*Vagga\s+(\d+)/i);
    if (m) return m[1].toUpperCase() + ' ' + m[2] + '.' + m[3];
    return String(code).replace(/\s+/g, ' ').trim();
  }

  // Bỏ số thứ tự kiểu "01. " ở đầu title (trùng với vagga number đã có trong code).
  // Giữ số La Mã "I. " / "II. " vì là cấu trúc ngữ nghĩa, không trùng lặp.
  function cleanTitleLabel(t) {
    if (!t) return '';
    return String(t).replace(/^\d+\.\s+/, '').trim();
  }

  function buildSuttaLinkHtml(s) {
    var shortCode = shortenCode(s.code || '');
    var viLabel   = cleanTitleLabel(s.titleVi || '');
    var enLabel   = cleanTitleLabel(s.titleEn || '');
    var paliLabel = s.titlePali || '';
    var mainText, subText;
    if (uiLang === 'en') {
      mainText = enLabel || viLabel || paliLabel || s.id;
      subText  = paliLabel || viLabel || '';
    } else {
      mainText = viLabel || enLabel || paliLabel || s.id;
      subText  = paliLabel || enLabel || '';
    }
    // Search index giữ cả code gốc + tất cả label để tìm kiếm linh hoạt
    FLAT_SUTTAS.push({
      id: s.id, main: mainText, sub: subText,
      flat: ((s.code || '') + ' ' + shortCode + ' ' + mainText + ' ' + (s.titleVi||'') + ' ' + (s.titleEn||'') + ' ' + paliLabel).toLowerCase()
    });
    var ariaLabel = (shortCode ? shortCode + ' — ' : '') + mainText;
    return '<a href="#" class="menu-sutta-link" role="treeitem" data-id="' + escapeAttr(s.id) + '" aria-label="' + escapeAttr(ariaLabel) + '">' +
        '<span class="sutra-code">' + escapeHtml(shortCode) + '</span>' +
        '<span class="sutra-label">' +
          '<span class="sutra-label-main">' + escapeHtml(mainText) + '</span>' +
          (subText ? '<span class="sutra-label-sub">' + escapeHtml(subText) + '</span>' : '') +
        '</span></a>';
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
    // Rút gọn label nikaya: "Digha Nikaya - Trường Bộ Kinh" → "DN - Trường Bộ Kinh"
    function shortenNikayaLabel(fullLabel, key) {
      if (!fullLabel) return key || '';
      var parts = String(fullLabel).split(/\s+-\s+/);
      if (parts.length >= 2 && key) {
        return key + ' - ' + parts.slice(1).join(' - ');
      }
      return fullLabel;
    }

    var html = '';
    for (var i = 0; i < index.length; i++) {
      var sec = index[i];
      var secId = safeDomId('sec-' + sec.key);
      var label = uiLang === 'en'
        ? sec.labelEn || sec.labelVi || sec.key
        : sec.labelVi || sec.labelEn || sec.key;
      var shortLabel = shortenNikayaLabel(label, sec.key);
      html += '<li class="menu-block" role="treeitem" aria-expanded="false">' +
        '<button class="menu-toggle" type="button" data-target="' + escapeAttr(secId) + '" aria-expanded="false" aria-controls="' + escapeAttr(secId) + '">' +
        '<span class="nikaya-full">' + escapeHtml(label) + '</span>' +
        '<span class="nikaya-short">' + escapeHtml(shortLabel) + '</span>' +
        '<span class="chevron" aria-hidden="true">▸</span>' +
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

    // currentParent = group/nikaya ngay phía trên bài kinh
    // rootNikaya = nikaya gốc (ngoài cùng) — cần cho các bài lồng trong group,
    // ví dụ SN: Nikāya → Group "Chủ đề 1: Chư Thiên" → Sutta. Nếu không track
    // rootNikaya thì header sẽ mất tên "Tương Ưng Bộ".
    function walk(children, currentParent, rootNikaya) {
      if (!children || !children.length || found) return;
      for (var i = 0; i < children.length; i++) {
        if (found) return;
        var ch = children[i];

        if (ch.type === 'sutta' && ch.id === id) {
          found = Object.assign({}, ch);
          found.parentGroup = currentParent;
          found.rootNikaya = rootNikaya;
          return;
        }

        if (ch.type === 'group') {
          walk(ch.children || [], ch, rootNikaya);
        }
      }
    }

    // Vòng đầu: cha = nikaya, root cũng = nikaya
    for (var i = 0; i < index.length; i++) {
      walk(index[i].children || [], index[i], index[i]);
      if (found) break;
    }
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
    // Row kết thúc ":0.3" = tiêu đề sub-sutta trong vagga bundle → style riêng
    if (/:0\.3$/.test(keyRaw)) wrap.classList.add('is-subtitle');
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

  // Epigraphs — 2 lời kinh luân phiên trên footer (Pali + dịch + citation).
  // Cả 2 đều từ Kinh Đại Bát Niết-Bàn (DN 16). User click citation → mở đúng bài.
  var EPIGRAPHS = [
    {
      pali: 'Vayadhammā saṅkhārā, appamādena sampādetha',
      vi: 'Các pháp hữu vi đều vô thường, hãy tinh tấn — chớ có buông lung',
      en: 'All conditioned things are subject to decay. Strive on with diligence.',
      citeId: 'dn16',
      citeLabel: 'DN 16'
    },
    {
      pali: 'Attadīpā viharatha, attasaraṇā, anaññasaraṇā',
      vi: 'Hãy tự mình thắp đuốc lên mà đi, tự mình là chỗ nương tựa, không nương tựa gì khác',
      en: 'Dwell as your own island, your own refuge, with no other refuge',
      citeId: 'dn16',
      citeLabel: 'DN 16'
    }
  ];

  // Dedications — 3 câu Pāli kinh điển + dịch nghĩa, dùng cho welcome screen
  var DEDICATIONS = [
    {
      pali: 'Namo tassa bhagavato arahato sammāsambuddhassa',
      vi: 'Kính lễ Đức Thế Tôn, bậc A-la-hán, Chánh Đẳng Giác',
      en: 'Homage to the Blessed One, the Worthy, the Perfectly Self-Enlightened'
    },
    {
      pali: 'Sabbe saṅkhārā aniccā',
      vi: 'Tất cả các hành đều vô thường',
      en: 'All conditioned things are impermanent'
    },
    {
      pali: 'Attadīpā viharatha, attasaraṇā, anaññasaraṇā',
      vi: 'Hãy tự mình thắp đuốc lên mà đi, tự mình là chỗ nương tựa, không nương tựa gì khác',
      en: 'Dwell as your own island, your own refuge, with no other refuge'
    }
  ];

  var RECOMMENDED_SUTTAS = [
    { id: 'dn16', code: 'DN 16', vi: 'Kinh Đại Bát Niết-Bàn', en: 'The Great Passing',      pali: 'Mahāparinibbāna' },
    { id: 'dn22', code: 'DN 22', vi: 'Kinh Đại Niệm Xứ',      en: 'The Great Mindfulness', pali: 'Mahāsatipaṭṭhāna' },
    { id: 'mn10', code: 'MN 10', vi: 'Kinh Niệm Xứ',          en: 'Foundations of Mindfulness', pali: 'Satipaṭṭhāna' },
    { id: 'mn118',code: 'MN 118',vi: 'Kinh Nhập Tức Xuất Tức Niệm', en: 'Mindfulness of Breathing', pali: 'Ānāpānasati' }
  ];

  function buildDhammaWheelSvg() {
    return '<svg class="welcome-ornament" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="wheel-rim" cx="50" cy="50" r="34" stroke-width="1.4"/>' +
      '<circle class="wheel-rim" cx="50" cy="50" r="26" stroke-width="1"/>' +
      '<circle class="wheel-hub" cx="50" cy="50" r="4"/>' +
      '<g class="wheel-spoke" stroke-width="1.1">' +
        '<line x1="50" y1="16" x2="50" y2="84"/>' +
        '<line x1="16" y1="50" x2="84" y2="50"/>' +
        '<line x1="26" y1="26" x2="74" y2="74"/>' +
        '<line x1="74" y1="26" x2="26" y2="74"/>' +
      '</g>' +
      '</svg>';
  }

  function buildRecommendedHtml() {
    var isEn = uiLang === 'en';
    var heading = isEn ? 'Suggested readings' : 'Gợi ý bài đọc';
    var cards = RECOMMENDED_SUTTAS.map(function (r) {
      var main = isEn ? r.pali : r.vi;
      var sub  = isEn ? r.vi   : r.en;
      return '<button class="rec-card" type="button" data-id="' + escapeAttr(r.id) + '">' +
             '<span class="rec-code">' + escapeHtml(r.code) + '</span>' +
             '<span class="rec-name">' +
               '<span class="rec-name-main">' + escapeHtml(main) + '</span>' +
               '<span class="rec-name-sub">' + escapeHtml(sub) + '</span>' +
             '</span>' +
             '</button>';
    }).join('');
    return '<div class="rec-title">' + escapeHtml(heading) + '</div><div class="rec-list">' + cards + '</div>';
  }

  function buildDedicationHtml() {
    var isEn = uiLang === 'en';
    var items = DEDICATIONS.map(function (d) {
      var tr = isEn ? d.en : d.vi;
      return '<div class="ded-item">' +
               '<div class="ded-pali">' + escapeHtml(d.pali) + '</div>' +
               '<div class="ded-tr">' + escapeHtml(tr) + '</div>' +
             '</div>';
    }).join('');
    return '<div class="welcome-dedication" role="region" aria-label="Dedication">' + items + '</div>';
  }

  function renderWelcomeScreen() {
    if (!grid || currentSutraId) return;
    if (superTitleEl) superTitleEl.textContent = '';
    if (titleMetaEl)  titleMetaEl.textContent  = '';
    var isEn = uiLang === 'en';
    if (titleEl) titleEl.textContent = isEn ? 'Sutta Archive' : 'Kho lưu trữ Kinh';
    if (subtitleEl) subtitleEl.textContent = isEn
      ? 'A trilingual reader — Pāli · English · Vietnamese'
      : 'Đọc song ngữ — Pāli · English · Tiếng Việt';
    var welcomeText = isEn
      ? '<strong>Welcome</strong>Tap <em>Library</em> to choose a sutta, ⚙ <em>Settings</em> to adjust display and TTS, ❓ <em>Guide</em> for tips.'
      : '<strong>Xin chào</strong>Bấm <em>Thư viện</em> để chọn bài, ⚙ <em>Cài đặt</em> chỉnh hiển thị/TTS, ❓ <em>Hướng dẫn</em> xem cách dùng. Bản dịch có thể còn sai sót — vui lòng đối chiếu bản Pāli & English. Góp ý: tuanctvn199@gmail.com';
    var kbdHint = isEn
      ? 'Keys: <kbd>J</kbd>/<kbd>K</kbd> next/prev segment · <kbd>N</kbd>/<kbd>P</kbd> next/prev sutta · <kbd>/</kbd> search · <kbd>?</kbd> guide'
      : 'Phím: <kbd>J</kbd>/<kbd>K</kbd> đoạn sau/trước · <kbd>N</kbd>/<kbd>P</kbd> bài sau/trước · <kbd>/</kbd> tìm · <kbd>?</kbd> hướng dẫn';

    grid.innerHTML =
      '<div class="welcome-screen">' +
        buildDhammaWheelSvg() +
        buildDedicationHtml() +
        '<div class="welcome-box">' + welcomeText + '<div class="kbd-hint">' + kbdHint + '</div></div>' +
        buildRecommendedHtml() +
      '</div>';

    // Click recommended sutta → open
    grid.querySelectorAll('.rec-card').forEach(function (c) {
      c.addEventListener('click', function () {
        var id = c.getAttribute('data-id');
        if (id) openSutra(id);
      });
    });
  }

  /* ============================================================
     renderSutra
     FIX: Clear cachedRows immediately to prevent TTS reading stale data
     FIX: Reset isRendering when render token is invalidated
     ============================================================ */
  async function renderSutra(id) {
    if (!id || !grid) return;
    // Nếu đổi sang bài kinh KHÁC, chỉ save anchor của bài cũ.
    // Sau đó ép cuộn về đầu NGAY để tránh overflow-anchor của browser giữ vị trí cũ.
    var switchingSutra = currentSutraId && currentSutraId !== id;
    saveScrollAnchorNow(); resetTts(true, false);
    if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
    if (currentSegObserver) { currentSegObserver.disconnect(); currentSegObserver = null; }
    currentWrap = null;
    // Reset vị trí cuộn ngay lập tức khi chuyển bài — tránh "carry over" vị trí cũ
    if (switchingSutra && readerArea) readerArea.scrollTop = 0;

    // FIX: Clear cached rows immediately
    cachedRows = [];
   firstVisibleKey = null;
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
      if (superTitleEl) superTitleEl.textContent = '';
      if (titleMetaEl)  titleMetaEl.innerHTML  = '';
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

    // Parent group (mức ngay trên bài) — có thể là nhóm con (vd "Chủ đề 1: Chư Thiên") hoặc chính Nikaya (DN/MN flat)
    var parentLabelVi = meta.parentGroup ? (meta.parentGroup.labelVi || meta.parentGroup.key) : '';
    var parentLabelEn = meta.parentGroup ? (meta.parentGroup.labelEn || meta.parentGroup.key) : '';
    // Root Nikaya (ngoài cùng) — luôn giữ được tên "Tương Ưng Bộ"/"Trung Bộ"/…
    var rootLabelVi   = meta.rootNikaya  ? (meta.rootNikaya.labelVi  || meta.rootNikaya.key)  : '';
    var rootLabelEn   = meta.rootNikaya  ? (meta.rootNikaya.labelEn  || meta.rootNikaya.key)  : '';

    // Rút gọn label kiểu "X Nikāya - Y Kinh" → "Y Kinh" (vi) / "X Nikāya" (en).
    // Giữ nguyên hậu tố "Kinh" cho trang trọng ("Trường Bộ Kinh", "Trung Bộ Kinh", v.v.).
    function extractShortLabel(label, lang) {
      if (!label) return '';
      var parts = label.split(/\s+-\s+/);
      if (lang === 'vi') {
        return (parts[1] || parts[0] || '').trim();
      }
      return (parts[0] || label).trim();
    }
    var rootShort   = extractShortLabel(uiLang === 'en' ? rootLabelEn   : rootLabelVi,   uiLang);
    var parentShort = extractShortLabel(uiLang === 'en' ? parentLabelEn : parentLabelVi, uiLang);

    if (titleEl) titleEl.textContent = titleFromBilara || titleFallback;

    // Super-title: [Nikaya gốc · (Group con nếu khác Nikaya) · Mã bài]
    //   DN 7  → "Trường Bộ · DN 7"                           (group === nikaya → dedup)
    //   SN vagga → "Tương Ưng Bộ · Chủ đề 1: Chư Thiên · SN 1 – Vagga 3"  (lồng 2 tầng)
    if (superTitleEl) {
      var superParts = [];
      if (rootShort) superParts.push(rootShort);
      if (parentShort && parentShort !== rootShort) superParts.push(parentShort);
      var codeTxt = (meta.code || '').trim();
      if (codeTxt) superParts.push(codeTxt);
      superTitleEl.textContent = superParts.join(' · ');
    }

    // Subtitle: tên Pāli của bài (ví dụ "Jāliya Sutta") — italic, phía dưới H1
    if (subtitleEl) {
      var paliName = (meta.titlePali || subtitleFromBilara || '').trim();
      subtitleEl.textContent = paliName;
    }

    // Meta: tên đối lập ngôn ngữ (en khi ui=vi, vi khi ui=en) — dòng phụ dưới cùng
    if (titleMetaEl) {
      var altName = uiLang === 'en' ? (meta.titleVi || '') : (meta.titleEn || '');
      titleMetaEl.textContent = altName;
    }

    // Quy ước bilara:
    //   :0.1 = tên Nikāya + số bài  (vd "Saṁyutta Nikāya 1.11")
    //   :0.2 = tên Vagga            (vd "2. Nandanavagga")
    //   :0.3 = tên sub-sutta        (vd "Nandanasutta") — GIỮ vì đánh dấu đoạn đầu mỗi sub-sutta
    //   :N.M (N>=1) = nội dung
    // Cho vagga bundle (nhiều sub-sutta), :0.1 & :0.2 bị lặp cho từng sub-sutta →
    // ẩn tất cả :0.1/:0.2 bất kể prefix. Header đã hiển thị Nikāya & Vagga rồi.
    // Ngoài ra vẫn phòng vệ lọc chính id đang mở (single-sutta có thể đặt title ở :0.3).
    var normId = String(id).replace(/([A-Za-z]+)0*(\d)/g, '$1$2');
    var prefixA = id + ':0.';
    var prefixB = normId + ':0.';
    var rowsForViewRaw = (merged.rows || []).filter(function (r) {
      var k = String(r.key || '');
      if (/:0\.[12]$/.test(k)) return false;
      return !(k.startsWith(prefixA) || k.startsWith(prefixB));
    });
    var singleLang = getSingleVisibleLang(); lastSingleLangMode = singleLang;
    var rowsForView = singleLang ? mergeRowsToParagraphRows(rowsForViewRaw, singleLang) : rowsForViewRaw;

    grid.innerHTML = '';
    cachedRows = [];
    applyVisibility();
	if (readerArea) readerArea.scrollTop = 0;
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
         grid.setAttribute('aria-busy', 'false');
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          updateVisibleCols(); restoreScrollByAnchor(id);
          setupAnchorObserver(); setupCurrentSegmentObserver(); updateReadingProgress();
          setTtsUiState('idle'); updateNavButtons();
		  isRendering = false;
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

  function openSutra(id, opts) {
    if (!id) return;
    renderSutra(id);
    // Deep link: cập nhật URL hash (#dn9) để copy-paste được — không reload
    if (!opts || !opts.skipHash) {
      try {
        var desired = '#' + id;
        if (location.hash !== desired) {
          history.replaceState(null, '', desired);
        }
      } catch (e) { /* ignore */ }
    }
  }

  // Parse hash khi load lần đầu & khi nhấn back/forward: "#dn9" → dn09
  function readSuttaIdFromHash() {
    var h = (location.hash || '').replace(/^#/, '').trim();
    if (!h) return '';
    var raw = h.split(/[:?&]/)[0].toLowerCase();
    if (!raw) return '';
    // Khớp chính xác (ví dụ đã là "dn09")
    if (Array.isArray(SUTRA_ORDER) && SUTRA_ORDER.indexOf(raw) !== -1) return raw;
    // Cho phép nhập rút gọn: "dn9" → thử "dn09", "dn009"
    var m = raw.match(/^([a-z]+)(\d+)(.*)$/);
    if (m && Array.isArray(SUTRA_ORDER) && SUTRA_ORDER.length) {
      var prefix = m[1], num = m[2], suffix = m[3] || '';
      for (var pad = num.length + 1; pad <= 4; pad++) {
        var padded = prefix + num.padStart(pad, '0') + suffix;
        if (SUTRA_ORDER.indexOf(padded) !== -1) return padded;
      }
    }
    return raw;
  }
  window.addEventListener('hashchange', function () {
    var sid = readSuttaIdFromHash();
    if (sid && sid !== currentSutraId) openSutra(sid, { skipHash: true });
  });

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
      var meta = findMetaById(currentSutraId) || {};
      
      // 1. Lấy tên Chương (Group)
      var parentLabel = '';
      if (meta.parentGroup) {
        parentLabel = uiLang === 'en' 
          ? (meta.parentGroup.labelEn || meta.parentGroup.key) 
          : (meta.parentGroup.labelVi || meta.parentGroup.key);
      }

      // 2. Lấy Mã bài và Tên bài
      var code = meta.code ? meta.code : '';
      var title = uiLang === 'en'
        ? meta.titleEn || meta.titleVi || meta.titlePali || currentSutraId
        : meta.titleVi || meta.titleEn || meta.titlePali || currentSutraId;

      // ==========================================
      // CÁCH 1: HIỂN THỊ ĐẦY ĐỦ (Mã bài · Tên Chương · Tên Bài)
      // Ví dụ: SN 1 – Vagga 1 · Chương Một: Tương Ưng Chư Thiên · I. Phẩm Cây Lau
      // ==========================================
      // var finalNavText = (code ? code + ' · ' : '') + (parentLabel ? parentLabel + ' · ' : '') + title;

      // ==========================================
      // CÁCH 2: HIỂN THỊ GỌN GÀNG (Tên Chương · Tên Bài) - Khuyên dùng
      // Ví dụ: Chương Một: Tương Ưng Chư Thiên · I. Phẩm Cây Lau
      // Giấu mã code đi cho footer đỡ bị dài quá trên điện thoại
      // ==========================================
      var finalNavText = (parentLabel ? parentLabel + ' · ' : '') + title;

      // Wrap parent trong span để CSS ẩn trên mobile (chỉ giữ tên bài kinh cho gọn)
      var html = '';
      if (parentLabel) html += '<span class="nav-parent">' + escapeHtml(parentLabel) + ' · </span>';
      html += escapeHtml(title);
      navTitle.innerHTML = html;

      navTitle.setAttribute('title', uiLang === 'en'
        ? 'Click to locate in Library'
        : 'Bấm để xem vị trí trong Thư viện');
      navTitle.setAttribute('aria-label',
        finalNavText + ' — ' + (uiLang === 'en' ? 'click to open Library' : 'bấm để mở Thư viện'));
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

  // Click vào status-title giữa footer → mở Library + expand đúng nikaya/group chứa bài đang đọc,
  // rồi scroll tới mục đó để dễ định hướng & chọn bài lân cận.
  function revealCurrentSuttaInMenu() {
    if (!sutraMenuPanel || !sutraMenuList || !currentSutraId) return;
    togglePanel(settingsPanel, false);
    togglePanel(sutraMenuPanel, true);

    var safeId = safeCssEscape(currentSutraId);
    var link = sutraMenuList.querySelector('.menu-sutta-link[data-id="' + safeId + '"]');
    if (!link) return;

    // Mở hết menu-list ancestor (xoá .collapsed + cập nhật aria của toggle tương ứng)
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

    // Đợi panel hoàn tất animation mở (~220ms) rồi scroll
    setTimeout(function () {
      try { link.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { link.scrollIntoView(); }
    }, 240);
  }

  var navTitleEl = $('navTitle');
  if (navTitleEl) {
    navTitleEl.setAttribute('role', 'button');
    navTitleEl.setAttribute('tabindex', '0');
    navTitleEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!currentSutraId) return;
      revealCurrentSuttaInMenu();
    });
    navTitleEl.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && currentSutraId) {
        e.preventDefault();
        revealCurrentSuttaInMenu();
      }
    });
  }

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
    if (!readerArea) return;
    // readerArea là scroll container; dùng getBoundingClientRect cho offset chính xác
    var rootRect = readerArea.getBoundingClientRect();
    var rowRect  = row.getBoundingClientRect();
    var relativeTop = rowRect.top - rootRect.top + readerArea.scrollTop;
    var viewTop = readerArea.scrollTop, viewBottom = viewTop + readerArea.clientHeight;
    if (relativeTop < viewTop || relativeTop + rowRect.height > viewBottom) {
      readerArea.scrollTo({ top: Math.max(0, relativeTop - 20), behavior: 'auto' });
    }
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

  // Warm-up trick: Chrome Android / Safari iOS yêu cầu speechSynthesis.speak()
  // phải gọi ĐỒNG BỘ trong event handler. Nếu có await trước khi speak() thật,
  // user gesture bị mất → TTS fail âm thầm.
  // Giải pháp: speak() ngay 1 utterance rỗng (volume 0) để "unlock" TTS cho phiên này,
  // rồi mới chạy logic async như bình thường.
  var ttsUnlocked = false;
  function unlockTts() {
    if (ttsUnlocked || !synthSupported || !synth) return;
    try {
      var warm = new SpeechSynthesisUtterance('');
      warm.volume = 0;
      synth.speak(warm);
      ttsUnlocked = true;
    } catch (e) { /* ignore */ }
  }
  if (btnReadTts)  btnReadTts.onclick  = function () { unlockTts(); startTtsByUiLang(); };
  if (btnPauseTts) btnPauseTts.onclick = pauseTtsByUiLang;
  if (btnStopTts)  btnStopTts.onclick  = stopTtsByUiLang;

  /* ============================================================
     Keyboard shortcuts (j/k segment · p/n sutta · / search · ? guide)
     ============================================================ */
  function jumpSegment(delta) {
    if (!grid) return;
    var wraps = Array.from(grid.querySelectorAll('.sutra-row-wrap'));
    if (!wraps.length) return;
    var idx = currentWrap ? wraps.indexOf(currentWrap) : -1;
    if (idx < 0) idx = 0;
    var next = Math.max(0, Math.min(wraps.length - 1, idx + delta));
    if (next !== idx && wraps[next]) {
      wraps[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  document.addEventListener('keydown', function (e) {
    // Bỏ qua khi đang gõ trong input / textarea
    if (e.target && e.target.matches && e.target.matches('input, textarea, [contenteditable="true"]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Guide & panel vẫn dùng Escape riêng — không can thiệp ở đây
    var k = e.key;
    switch (k) {
      case 'j': case 'J':
        jumpSegment(1); e.preventDefault(); break;
      case 'k': case 'K':
        jumpSegment(-1); e.preventDefault(); break;
      case 'n': case 'N':
        if (btnNext && !btnNext.disabled) { btnNext.click(); e.preventDefault(); }
        break;
      case 'p': case 'P':
        if (btnPrev && !btnPrev.disabled) { btnPrev.click(); e.preventDefault(); }
        break;
      case '/':
        if (btnSutraMenu) {
          var isOpen = sutraMenuPanel && sutraMenuPanel.classList.contains('open');
          if (!isOpen) btnSutraMenu.click();
          setTimeout(function () { if (searchInput) searchInput.focus(); }, 80);
          e.preventDefault();
        }
        break;
      case '?':
        if (btnGuide) { btnGuide.click(); e.preventDefault(); }
        break;
      case 'g':
        if (readerArea) { readerArea.scrollTo({ top: 0, behavior: 'smooth' }); e.preventDefault(); }
        break;
      case 'G':
        if (readerArea) { readerArea.scrollTo({ top: readerArea.scrollHeight, behavior: 'smooth' }); e.preventDefault(); }
        break;
    }
  });

  /* ============================================================
     Epigraph rotation (above footer)
     ============================================================ */
  var epPaliEl  = $('epPali');
  var epTrEl    = $('epTr');
  var epCiteEl  = $('epCite');
  var epInnerEl = document.querySelector('.epigraph-inner');
  var epIdx = 0, epPaused = false, epTimer = null;

  function paintEpigraph() {
    if (!epPaliEl || !epTrEl || !epCiteEl) return;
    var e = EPIGRAPHS[epIdx];
    epPaliEl.textContent = e.pali;
    epTrEl.textContent   = uiLang === 'en' ? e.en : e.vi;
    epCiteEl.textContent = e.citeLabel;
    epCiteEl.setAttribute('data-id', e.citeId);
    epCiteEl.setAttribute('aria-label',
      (uiLang === 'en' ? 'Open source sutta ' : 'Mở bài kinh nguồn ') + e.citeLabel);
    epCiteEl.setAttribute('title',
      uiLang === 'en' ? 'Open source sutta' : 'Mở bài kinh nguồn');
  }
  function rotateEpigraph() {
    if (epPaused || !epInnerEl || EPIGRAPHS.length < 2) return;
    epIdx = (epIdx + 1) % EPIGRAPHS.length;
    epInnerEl.style.opacity = '0';
    setTimeout(function () {
      paintEpigraph();
      epInnerEl.style.opacity = '';
    }, 450);
  }
  function startEpigraph() {
    if (epTimer) clearInterval(epTimer);
    epTimer = setInterval(rotateEpigraph, 16000);
  }
  function stopEpigraph() {
    if (epTimer) { clearInterval(epTimer); epTimer = null; }
  }
  if (epCiteEl) {
    epCiteEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var id = epCiteEl.getAttribute('data-id');
      if (id) openSutra(id);
    });
  }
  if (epInnerEl) {
    epInnerEl.addEventListener('mouseenter', function () { epPaused = true; });
    epInnerEl.addEventListener('mouseleave', function () { epPaused = false; });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') stopEpigraph(); else startEpigraph();
  });
  paintEpigraph();
  startEpigraph();

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
      paintEpigraph();  // repaint dịch nghĩa epigraph theo ngôn ngữ mới
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
    // Ưu tiên ID trong URL hash (#dn9) > ID mở lần trước
    var hashId  = readSuttaIdFromHash();
    var startId = hashId || storage.get(KEY_LAST);
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
   Dark mode (separate IIFE) — icon moon/sun được swap qua CSS
   theo [data-theme="dark"], không cần đổi textContent nữa.
   ============================================================ */
(function () {
  var btn = document.getElementById('btnDarkMode');
  if (!btn) return;

  var STORAGE_KEY = 'sutra-dark-mode';
  var html = document.documentElement;

  function updateTitle() {
    var isDark = html.getAttribute('data-theme') === 'dark';
    btn.title = isDark ? 'Chế độ sáng' : 'Chế độ tối';
  }

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch(e){}

  if (saved === 'dark') html.setAttribute('data-theme', 'dark');
  if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    html.setAttribute('data-theme', 'dark');
    try { localStorage.setItem(STORAGE_KEY, 'dark'); } catch(e){}
  }
  updateTitle();

  btn.addEventListener('click', function () {
    var isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
      html.removeAttribute('data-theme');
      try { localStorage.setItem(STORAGE_KEY, 'light'); } catch(e){}
    } else {
      html.setAttribute('data-theme', 'dark');
      try { localStorage.setItem(STORAGE_KEY, 'dark'); } catch(e){}
    }
    updateTitle();
  });
})();

/* Top bar giữ cố định "Namo tassa..." — không rotate. */
