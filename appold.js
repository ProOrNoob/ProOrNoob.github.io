(function () {
  'use strict';

  // ============================================================
  // DEBUG: đặt = false để ẩn nút + panel
  // ============================================================
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

    var viHtml =
      '<h2>Hướng dẫn sử dụng</h2>' +
      '<em>Trang đọc kinh tam ngữ: Pāli · English · Tiếng Việt.</em>' +

      '<h3>📖 Thư viện bài kinh</h3>' +
      '<ul>' +
        '<li>Bấm <strong>Thư viện</strong> ở góc dưới bên trái để mở mục lục.</li>' +
        '<li>Chọn 1 trong <strong>4 tile</strong>: <code>DN</code> Trường Bộ · <code>MN</code> Trung Bộ · <code>SN</code> Tương Ưng · <code>AN</code> Tăng Chi.</li>' +
        '<li><strong>DN/MN</strong> hiển thị phẳng toàn bộ bài kinh.</li>' +
        '<li><strong>SN</strong> hiển thị 56 Chủ đề (Saṁyutta), click chủ đề để mở danh sách Phẩm.</li>' +
        '<li><strong>AN</strong> hiển thị 11 nhóm AN 1 → AN 11, click để mở các Phẩm.</li>' +
        '<li>Gõ ô <strong>Tìm kiếm</strong> để lọc theo tên, mã (vd "mn 23"), hoặc từ khóa — tìm xuyên cả 4 bộ.</li>' +
        '<li>Bấm <strong>×</strong> hoặc click ngoài panel để đóng.</li>' +
      '</ul>' +

      '<h3>📜 Đọc kinh</h3>' +
      '<ul>' +
        '<li><strong>Header cố định</strong> trên cùng cho biết đang đọc bài nào (Nikāya · Mã · Tên Pāli · Tên Việt/Anh).</li>' +
        '<li>Nội dung kinh được chia thành <strong>đoạn (segment)</strong> — mỗi đoạn hiển thị mã ở góc trái (vd <code>MN23.1.1</code>).</li>' +
        '<li>Mặc định hiển thị 3 cột: <strong>Pāli trên cùng</strong> (full-width), <strong>English + Việt</strong> song song bên dưới.</li>' +
        '<li>Số thứ tự phẩm (ví dụ "7", "VII") được căn giữa, tô đậm để dễ phân đoạn.</li>' +
        '<li>Dòng <strong>SOURCE</strong> nằm cuối bài — liên kết tới bản gốc SuttaCentral.</li>' +
      '</ul>' +

      '<h3>⚙ Cài đặt hiển thị</h3>' +
      '<ul>' +
        '<li><strong>Ngôn ngữ</strong>: bật/tắt cột Pāli · English · Việt. Luôn giữ ít nhất 1 cột.</li>' +
        '<li><strong>Xếp dọc</strong>: chuyển từ 3 cột sang xếp 3 khối theo chiều dọc (đỡ chật trên màn hình hẹp).</li>' +
        '<li><strong>Cỡ chữ</strong>: slider 80-160% — <em>chỉ áp cho nội dung</em>, không thay đổi tiêu đề.</li>' +
        '<li><strong>Giãn dòng</strong>: slider 1.3-2.6 — khoảng cách giữa các dòng văn bản.</li>' +
        '<li>Nút <strong>↺</strong> bên cạnh mỗi slider = reset về mặc định.</li>' +
        '<li><strong>🌙 / ☀</strong>: chuyển nền sáng/tối.</li>' +
        '<li><strong>VI / EN</strong>: đổi ngôn ngữ giao diện (menu, nhãn, hướng dẫn).</li>' +
      '</ul>' +

      '<h3>🔊 Đọc to (TTS)</h3>' +
      '<ul>' +
        '<li>▶ <strong>Play</strong> — đọc kinh theo ngôn ngữ UI (Việt hoặc Anh). Pāli không hỗ trợ TTS.</li>' +
        '<li>⏸ <strong>Pause</strong> — giới hạn trình duyệt: khi tiếp tục sẽ đọc lại câu hiện tại từ đầu.</li>' +
        '<li>⏹ <strong>Stop</strong> — dừng hẳn, lần sau Play sẽ đọc lại từ đầu bài.</li>' +
        '<li>Android cần cài <strong>Google TTS Engine</strong> để có giọng tiếng Việt.</li>' +
      '</ul>' +

      '<h3>🎹 Phím tắt (desktop)</h3>' +
      '<ul>' +
        '<li><kbd>/</kbd> — focus ô tìm kiếm</li>' +
        '<li><kbd>N</kbd> / <kbd>P</kbd> — bài kế tiếp / bài trước</li>' +
        '<li><kbd>g</kbd> / <kbd>Shift+G</kbd> — về đầu bài / cuối bài</li>' +
        '<li><kbd>Esc</kbd> — đóng panel/guide</li>' +
        '<li><kbd>?</kbd> — mở guide</li>' +
      '</ul>' +

      '<h3>🔗 Chia sẻ & lưu vị trí</h3>' +
      '<ul>' +
        '<li>URL tự cập nhật mã bài kinh (vd <code>#mn23</code>) — copy URL để chia sẻ, người mở sẽ vào đúng bài.</li>' +
        '<li>Vị trí cuộn được lưu cho từng bài — quay lại bài đang đọc sẽ về đúng chỗ đã dừng.</li>' +
        '<li>Bộ kinh đang chọn (tile nào) cũng được lưu cho lần mở sau.</li>' +
      '</ul>' +

      '<h3>ℹ Nguồn dữ liệu</h3>' +
      '<p>Dữ liệu Pāli và bản dịch Bhikkhu Sujato từ <a href="https://suttacentral.net/" target="_blank" rel="noopener">SuttaCentral</a> — dự án Bilara. Bản dịch tiếng Việt tham khảo nhiều nguồn, có thể còn sai sót. Góp ý: <code>tuanctvn199@gmail.com</code></p>' +

      '<button id="btnCloseGuide" type="button">Đóng</button>';

    var enHtml =
      '<h2>User Guide</h2>' +
      '<em>Trilingual sutta reader: Pāli · English · Vietnamese.</em>' +

      '<h3>📖 Library</h3>' +
      '<ul>' +
        '<li>Tap <strong>Library</strong> (bottom-left) to open the catalogue.</li>' +
        '<li>Choose one of <strong>4 tiles</strong>: <code>DN</code> Long · <code>MN</code> Middle · <code>SN</code> Connected · <code>AN</code> Numerical.</li>' +
        '<li><strong>DN/MN</strong> show a flat list of all suttas.</li>' +
        '<li><strong>SN</strong> shows 56 Saṁyuttas — click to expand the vaggas inside.</li>' +
        '<li><strong>AN</strong> shows 11 groups AN 1 → AN 11, expand for vaggas.</li>' +
        '<li>Use <strong>Search</strong> to filter by title, code ("mn 23") or keyword — across all 4 nikāyas.</li>' +
        '<li>Tap <strong>×</strong> or outside the panel to close.</li>' +
      '</ul>' +

      '<h3>📜 Reading</h3>' +
      '<ul>' +
        '<li><strong>Fixed header</strong> always shows: Nikāya · Code · Pāli name · Vietnamese/English name.</li>' +
        '<li>Content is divided into <strong>segments</strong> — each shows its ID on the left (e.g. <code>MN23.1.1</code>).</li>' +
        '<li>Default 3-column layout: <strong>Pāli full-width on top</strong>, <strong>English + Vietnamese</strong> side-by-side below.</li>' +
        '<li>Section numbers ("7", "VII") are centered and highlighted as dividers.</li>' +
        '<li><strong>SOURCE</strong> line at the end links to the original SuttaCentral page.</li>' +
      '</ul>' +

      '<h3>⚙ Display settings</h3>' +
      '<ul>' +
        '<li><strong>Languages</strong>: toggle Pāli · English · Vietnamese. At least one must stay on.</li>' +
        '<li><strong>Stack</strong>: switch from 3-column to vertical stack (better for narrow screens).</li>' +
        '<li><strong>Font size</strong>: slider 80-160% — <em>applies to body text only</em>, not titles.</li>' +
        '<li><strong>Line height</strong>: slider 1.3-2.6 — spacing between text lines.</li>' +
        '<li><strong>↺</strong> next to each slider resets to default.</li>' +
        '<li><strong>🌙 / ☀</strong>: toggle dark/light background.</li>' +
        '<li><strong>VI / EN</strong>: switch interface language.</li>' +
      '</ul>' +

      '<h3>🔊 Text-to-Speech</h3>' +
      '<ul>' +
        '<li>▶ <strong>Play</strong> — reads the sutta in current UI language. Pāli is not supported.</li>' +
        '<li>⏸ <strong>Pause</strong> — browser limitation: resume restarts the current sentence.</li>' +
        '<li>⏹ <strong>Stop</strong> — stops completely; next Play starts from the beginning.</li>' +
        '<li>Android may need <strong>Google TTS Engine</strong> for Vietnamese voice.</li>' +
      '</ul>' +

      '<h3>🎹 Keyboard shortcuts (desktop)</h3>' +
      '<ul>' +
        '<li><kbd>/</kbd> — focus search</li>' +
        '<li><kbd>N</kbd> / <kbd>P</kbd> — next / previous sutta</li>' +
        '<li><kbd>g</kbd> / <kbd>Shift+G</kbd> — top / bottom of sutta</li>' +
        '<li><kbd>Esc</kbd> — close panel/guide</li>' +
        '<li><kbd>?</kbd> — open this guide</li>' +
      '</ul>' +

      '<h3>🔗 Share & bookmark</h3>' +
      '<ul>' +
        '<li>URL hash updates with sutta ID (e.g. <code>#mn23</code>) — copy URL to share; the link opens the exact sutta.</li>' +
        '<li>Scroll position is saved per sutta — returning to a sutta resumes where you stopped.</li>' +
        '<li>Selected nikāya tile is also persisted.</li>' +
      '</ul>' +

      '<h3>ℹ Sources</h3>' +
      '<p>Pāli text and Bhikkhu Sujato English translations from <a href="https://suttacentral.net/" target="_blank" rel="noopener">SuttaCentral</a> (Bilara project). Vietnamese translations compiled from multiple sources, may contain errors. Feedback: <code>tuanctvn199@gmail.com</code></p>' +

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

  /* ============================================================
     View prefs
     ============================================================ */
  // Toggle state cho Segment ID + Col Header (default: hiện cả 2)
  var showSegKey = true;
  var showColHdr = true;

  function saveViewPrefs() {
    storage.set(KEY_VIEW, JSON.stringify({
      showPali: showPali, showEng: showEng, showVie: showVie,
      stack: card ? card.classList.contains('stack') : false,
      showSegKey: showSegKey, showColHdr: showColHdr
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
    } catch(e){}
  }
  function applySegKeyHdrVis() {
    if (!grid) return;
    grid.classList.toggle('hide-seg-key', !showSegKey);
    grid.classList.toggle('hide-col-header', !showColHdr);
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

  // Toggle Segment ID (mã đoạn AN1.11.1.1)
  var btnSegKey = $('btnSegKey');
  if (btnSegKey) btnSegKey.onclick = function () {
    showSegKey = !showSegKey;
    btnSegKey.classList.toggle('active', showSegKey);
    btnSegKey.setAttribute('aria-pressed', String(showSegKey));
    applySegKeyHdrVis();
    saveViewPrefs();
  };

  // Toggle Col Header (nhãn PALI/ENGLISH/VIETNAMESE)
  var btnSegHdr = $('btnSegHdr');
  if (btnSegHdr) btnSegHdr.onclick = function () {
    showColHdr = !showColHdr;
    btnSegHdr.classList.toggle('active', showColHdr);
    btnSegHdr.setAttribute('aria-pressed', String(showColHdr));
    applySegKeyHdrVis();
    saveViewPrefs();
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
    // Ưu tiên #readerArea (title + content cuộn chung). Fallback #sutraGrid cho HTML cũ.
    return readerArea || grid;
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
      return;
    }
    if (!firstVisibleKey) return;
    // Chỉ lưu key của segment đang ở top viewport — KHÔNG lưu pixel offset
    // → restore luôn scroll segment đó về top, chính xác theo đoạn kinh.
    storage.set(KEY_ANCHOR_K(currentSutraId), firstVisibleKey);
  }

  function restoreScrollByAnchor(id) {
    var scrollRoot = getScrollRoot();
    if (!scrollRoot) return false;
    try {
      var key = storage.get(KEY_ANCHOR_K(id));
      if (!key) return false;

      // Tìm index của segment theo key
      var foundIdx = -1;
      for (var j = 0; j < virtAllRows.length; j++) {
        if (String(virtAllRows[j].key || '') === key) { foundIdx = j; break; }
      }
      if (foundIdx < 0) return false;

      // Materialize tất cả chunks TRƯỚC target → mọi row có chiều cao thật → offset chính xác
      ensureAllChunksUpTo(foundIdx);

      var safeKey = safeCssEscape(key);
      var row = scrollRoot.querySelector('.sutra-row[data-key="' + safeKey + '"]');
      if (!row) return false;
      var scrollTarget = row.closest('.sutra-row-wrap') || row;

      // Cuộn sao cho đầu segment nằm ngay top viewport (không offset pixel)
      function scrollToSegmentTop() {
        var rootRect = scrollRoot.getBoundingClientRect();
        var tgtRect  = scrollTarget.getBoundingClientRect();
        var y = tgtRect.top - rootRect.top + scrollRoot.scrollTop;
        var max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
        y = Math.max(0, Math.min(y, max));
        if (Math.abs(y - scrollRoot.scrollTop) > 1) scrollRoot.scrollTop = y;
      }

      scrollToSegmentTop();
      toggleBackTop(scrollRoot.scrollTop > 0);

      // Correction pass — sau khi scroll, IO có thể materialize thêm chunks gần viewport
      // → layout shift nhẹ → scroll lại cho segment về đúng top
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        scrollToSegmentTop();
        setTimeout(scrollToSegmentTop, 100);
      }); });
      return true;
    } catch(e) { return false; }
  }

  // FIX: Clean up observer on page unload to prevent memory leak
  window.addEventListener('pagehide', function () {
    saveScrollAnchorNow();
    if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
    teardownChunkObservers();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveScrollAnchorNow();
  });

  /* ============================================================
     Back to top
     ============================================================ */
  var suppressBackTop = false;
  function toggleBackTop(show) { if (!btnBackTop) return; btnBackTop.classList.toggle('visible', show); }

  // Progress bar update — chạy mỗi rAF frame khi scroll, không throttle để mượt
  var progressBarTicking = false;
  function updateProgressBar() {
    if (!scrollEl) return;
    var sh = scrollEl.scrollHeight, ch = scrollEl.clientHeight, st = scrollEl.scrollTop;
    var pct = sh > ch ? (st / (sh - ch)) * 100 : 0;
    document.documentElement.style.setProperty('--read-progress', pct.toFixed(1) + '%');
  }

  if (scrollEl) {
    scrollEl.addEventListener('scroll', function () {
      if (!progressBarTicking) {
        progressBarTicking = true;
        requestAnimationFrame(function () {
          updateProgressBar();
          progressBarTicking = false;
        });
      }
    }, { passive: true });

    scrollEl.addEventListener('scroll', throttle(function () {
      if (!suppressBackTop) toggleBackTop(scrollEl.scrollTop > 0);
      saveScrollAnchorNow();
    }, 120), { passive: true });
  }

  if (btnBackTop && scrollEl) btnBackTop.onclick = function () {
    suppressBackTop = true;
    toggleBackTop(false);
    setMobileHeaderHidden(false);  // Show header when going back to top
    mobileLastScrollTop = 0;
    scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    var done = function () {
      suppressBackTop = false;
      toggleBackTop(false);
      if (currentSutraId) {
        storage.remove(KEY_ANCHOR_K(currentSutraId));
        storage.remove(KEY_ANCHOR_O(currentSutraId));
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

  /* ============================================================
     Mobile auto-hide header
     Ẩn header khi cuộn xuống, hiện lại khi cuộn lên hoặc ở đầu trang.
     Chỉ hoạt động trên mobile (≤500px).
     ============================================================ */
  var headerEl = card ? card.querySelector('.header') : null;
  var mobileLastScrollTop = 0;
  var mobileHeaderHidden = false;
  var MOBILE_SCROLL_THRESHOLD = 1;  // Ngưỡng pixel tối thiểu để trigger

  function isMobileViewport() {
    return window.innerWidth <= 500;
  }

function setMobileHeaderHidden(/* hide */) {
    // Header giờ nằm TRONG scroll container (#readerArea) và cuộn tự nhiên cùng content
    // → không cần ẩn bằng JS nữa. No-op để không vỡ các caller cũ.
  }

if (scrollEl) {
    var isHeaderScrollTicking = false;

    // 1. Logic UI cần mượt mà (ẩn/hiện header) — header giờ cuộn cùng content nên skip mobile auto-hide
    // (giữ structure để không vỡ các hàm setMobileHeaderHidden cũ)
    scrollEl.addEventListener('scroll', function () {
      if (!isHeaderScrollTicking) {
        window.requestAnimationFrame(function () {
          if (isMobileViewport() && headerEl) {
            var st = scrollEl.scrollTop;
            if (st >= 0 && st <= scrollEl.scrollHeight - scrollEl.clientHeight) {
              if (st <= 10) {
                setMobileHeaderHidden(false);
              } else if (st > 50 && st > mobileLastScrollTop) {
                setMobileHeaderHidden(true);
              }
              mobileLastScrollTop = st;
            }
          }
          isHeaderScrollTicking = false;
        });
        isHeaderScrollTicking = true;
      }
    }, { passive: true });

    // 2. Logic tác vụ ngầm (Save anchor, Back to top)
    scrollEl.addEventListener('scroll', throttle(function () {
      if (!suppressBackTop) toggleBackTop(scrollEl.scrollTop > 0);
      saveScrollAnchorNow();
    }, 120), { passive: true });
  }

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
    // (FLAT_SUTTAS được populate 1 lần bởi populateFlatSuttas — không push ở đây tránh trùng)
    return '<a href="#" class="menu-sutta-link" role="treeitem" data-id="' + escapeAttr(s.id) + '" aria-label="' + escapeAttr(mainText) + '">' +
        '<div class="sutra-label">' +
          '<div class="sutra-label-main">' + escapeHtml(mainText) + '</div>' +
          (subText ? '<div class="sutra-label-sub">' + escapeHtml(subText) + '</div>' : '') +
        '</div></a>';
  }

  // Trích "AN 1" từ "AN 1 – Vagga 3" / "SN 7 – Vagga 2" — dùng cho auto-grouping.
  // Với code chỉ có "DN 7" (không có dấu –) sẽ trả chính mã đó → mỗi key độc nhất → không group.
  function extractGroupKey(code) {
    var m = String(code || '').match(/^([A-Za-z]+\s*\d+)\s*[–\-]/);
    return m ? m[1].trim() : String(code || '').trim();
  }

  function buildMenuChildren(children, parentId) {
    if (!children || !children.length) return '';

    // Case 1: Tất cả là sutta flat (AN/DN/MN trong toc) — thử auto-group theo code prefix
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
      // Chỉ auto-group khi có >=2 key VÀ ít nhất 1 key có >1 vagga (AN 1 có vagga 1..20+)
      // DN: mỗi code unique (DN 1, DN 2...) → hasMultiChild=false → flat.
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
      // Không đủ điều kiện auto-group → render flat như DN/MN
      return children.map(buildSuttaLinkHtml).join('');
    }

    // Case 2: Đã có group định nghĩa sẵn trong toc (SN với "Chủ đề 1..." etc.)
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

  // Nikaya đang active (tile nào đang được chọn). null = chưa chọn (list rỗng, gợi ý user).
  var activeNikayaKey = null;
  var KEY_ACTIVE_NIKAYA = 'active_nikaya_tile';

  // Tính SUTRA_ORDER toàn cục từ tất cả 4 nikaya — để prev/next hoạt động xuyên bộ kinh
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
    // Không còn expand/collapse outer nikaya nữa — tile thay thế. Chỉ render children bên trong.
    sutraMenuList.innerHTML = buildMenuChildren(nik.children || [], secId);
    highlightActiveInMenu();
  }

  function setActiveNikaya(nikKey, persist) {
    activeNikayaKey = nikKey;
    // Update tile active state
    var tiles = document.querySelectorAll('.nikaya-tile');
    for (var i = 0; i < tiles.length; i++) {
      var isActive = tiles[i].getAttribute('data-nikaya') === nikKey;
      tiles[i].classList.toggle('active', isActive);
      tiles[i].setAttribute('aria-selected', String(isActive));
    }
    renderNikayaList(nikKey);
    if (persist) storage.set(KEY_ACTIVE_NIKAYA, nikKey);
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

  // Populate FLAT_SUTTAS từ TOÀN BỘ 4 nikaya (search xuyên bộ) — chạy 1 lần lúc build
  // Strip diacritics: "Brahmajāla" → "brahmajala", "Kinh Phạm Võng" → "kinh pham vong"
  // Cho phép user gõ không dấu vẫn tìm thấy (VD: "brahmajala" match "Brahmajāla Sutta")
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
            // flat đã strip dấu → search không cần gõ dấu
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

    rebuildGlobalSutraOrder();  // SUTRA_ORDER = tất cả suttas (cho prev/next)
    populateFlatSuttas();       // FLAT_SUTTAS = tất cả suttas (cho search xuyên bộ)
    applyTileLabels();

    // Wire click tile BẰNG event delegation trên sutraMenuPanel (chắc chắn hơn querySelectorAll)
    // Tránh lỗi trường hợp tiles chưa kịp render hoặc bị query sai timing.
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

    // Khởi tạo: ưu tiên nikaya của bài kinh đang đọc → nikaya đã lưu → DN mặc định
    var initial = null;
    if (currentSutraId) initial = findNikayaOfSutta(currentSutraId);
    if (!initial) initial = storage.get(KEY_ACTIVE_NIKAYA);
    if (!initial && index[0]) initial = index[0].key;
    setActiveNikaya(initial, false);
  }

  function highlightActiveInMenu() {
    if (!sutraMenuList) return;
    // Chỉ highlight link trong list hiện tại. KHÔNG tự chuyển tile — user click tile là ý định rõ ràng.
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(function (a) {
      var isActive = a.getAttribute('data-id') === currentSutraId;
      a.classList.toggle('active', isActive);
      a.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  // Gọi trong openSutra/renderSutra khi đổi bài — tile theo bài (prev/next qua biên nikaya).
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
    var q = normStr((query || '').trim());   // strip dấu query → match không phụ thuộc dấu
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
    // rootNikaya = nikaya ngoài cùng; parentGroup = group/nikaya ngay trên bài kinh
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
    // Phát hiện row là "số thứ tự phẩm/chủ đề" kiểu "7", "VII", "1." — style căn giữa, to hơn
    var tp = (r.pali || '').trim();
    var te = (r.eng  || '').trim();
    var tv = (r.vie  || '').trim();
    var isSectionNum = (tp.length <= 6 && te.length <= 6 && tv.length <= 6) &&
      /^[IVXLCDM]+\.?$|^\d+\.?$/.test(tp || te || tv);
    if (isSectionNum) wrap.classList.add('is-section-num');
    // Row là "source" (url) — thêm class để style mờ/gạch đầu
    if (/:source$/i.test(keyRaw)) wrap.classList.add('is-source');
    // Sub-chapter header: :0.1 (Nikāya + số), :0.2 (tên Vagga), :0.3 (tên sub-sutta)
    // Áp class .is-subtitle để render style heading (căn giữa, italic, to hơn nội dung)
    if (/:0\.[123]$/.test(keyRaw)) wrap.classList.add('is-subtitle');
    // Set data-key trên wrap (để CSS selector [data-key$=":0.1"] match được cho border phân cách chương)
    wrap.setAttribute('data-key', keyRaw);

    var keyShort = '';
    if (keyRaw.includes(':')) {
      var parts = keyRaw.split(':');
      var prefix = parts[0].replace(/([a-zA-Z]+)(\d*)/, function (_, letters, nums) { return letters.toUpperCase() + nums; });
      keyShort = parts[1] ? prefix + '.' + parts[1] : prefix;
    } else { keyShort = keyRaw.toUpperCase(); }
    if (keyShort) {
      var seg = document.createElement('div');
      seg.className = 'sutra-seg-key'; seg.textContent = keyShort;
      seg.setAttribute('aria-hidden', 'true');
      wrap.appendChild(seg);
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
      if (subtitleEl) subtitleEl.textContent = 'Tap "Library" to select a sutta, or ❓ for the guide.';
      grid.innerHTML = '<div class="welcome-screen"><div class="welcome-box"><strong>Welcome!</strong><br><br>• Tap  <strong>"Library"</strong> to choose a sutta.<br>• Tap ⚙ <strong>Settings</strong> to adjust layout/TTS.<br>• Tap ❓ <strong>Guide</strong> for help.</div></div>';
    } else {
      if (titleEl) titleEl.textContent = 'Chào mừng bạn đến với trang lưu trữ kinh';
      if (subtitleEl) subtitleEl.textContent = 'Bấm vào "Thư Viện" để chọn bài kinh, hoặc ❓ để xem hướng dẫn.';
      grid.innerHTML = '<div class="welcome-screen"><div class="welcome-box"><strong>Xin chào!</strong><br><br>• Bấm  <strong>"Thư Viện"</strong> để chọn bài.<br>• Bấm ⚙ <strong>Cài đặt</strong> để chỉnh bố cục/TTS.<br>• Bấm ❓ <strong>Hướng dẫn</strong> trong Setting để xem cách dùng.</div></div>';
    }
  }

  /* ============================================================
     Virtual scroll helpers: chunk materialize / dematerialize + observers
     ============================================================ */
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
  }

  function dematerializeChunk(chunkInfo) {
    if (!chunkInfo || !chunkInfo.materialized) return;
    // Đo height thật trước khi remove để giữ vị trí cuộn
    if (!chunkInfo.measuredH) chunkInfo.measuredH = chunkInfo.div.offsetHeight || ((chunkInfo.rowEnd - chunkInfo.rowStart) * 120);
    while (chunkInfo.div.firstChild) chunkInfo.div.removeChild(chunkInfo.div.firstChild);
    chunkInfo.div.style.minHeight = chunkInfo.measuredH + 'px';
    chunkInfo.materialized = false;
    // Clear cachedRows range
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
    // Materialize: khi chunk xuất hiện trong vùng ±1 viewport
    virtMatObs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var idx = parseInt(entries[i].target.getAttribute('data-chunk-idx'), 10);
          if (Number.isFinite(idx) && virtChunks[idx]) materializeChunk(virtChunks[idx]);
        }
      }
    }, { root: scrollEl, rootMargin: '100% 0px 100% 0px', threshold: 0 });

    // Dematerialize: khi chunk ra khỏi ±3 viewport (hysteresis tránh thrash)
    virtDemObs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) {
          var idx = parseInt(entries[i].target.getAttribute('data-chunk-idx'), 10);
          if (Number.isFinite(idx) && virtChunks[idx]) dematerializeChunk(virtChunks[idx]);
        }
      }
    }, { root: scrollEl, rootMargin: '300% 0px 300% 0px', threshold: 0 });

    // Attach observers tới tất cả chunks
    for (var k = 0; k < virtChunks.length; k++) {
      virtMatObs.observe(virtChunks[k].div);
      virtDemObs.observe(virtChunks[k].div);
    }
  }

  // Đảm bảo 1 row cụ thể (theo index) được materialize — dùng cho TTS / anchor restore
  function ensureRowRendered(rowIdx) {
    for (var k = 0; k < virtChunks.length; k++) {
      var c = virtChunks[k];
      if (rowIdx >= c.rowStart && rowIdx < c.rowEnd) {
        if (!c.materialized) materializeChunk(c);
        return;
      }
    }
  }

  // Materialize TẤT CẢ chunks có rowStart <= rowIdx → dùng khi restore anchor:
  // các chunk ở trên target phải có chiều cao thật (không còn placeholder 120px/row)
  // để offset của target row được tính chính xác → scroll khớp vị trí cũ.
  function ensureAllChunksUpTo(rowIdx) {
    for (var k = 0; k < virtChunks.length; k++) {
      var c = virtChunks[k];
      if (c.rowStart > rowIdx) break;
      if (!c.materialized) materializeChunk(c);
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
    teardownChunkObservers();  // tắt observer chunks của bài cũ
    virtChunks = [];
    virtAllRows = [];

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
    syncTileToCurrentSutta();   // đổi bài → tile tự theo nikaya của bài mới (nếu khác)
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

    // Nikaya gốc + parent group (cho supertitle trang trọng)
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

    // H1 title (ngôn ngữ chính: VI khi ui=vi, EN khi ui=en)
    if (titleEl) titleEl.textContent = titleFromBilara || titleFallback;

    // Supertitle: "TRUNG BỘ KINH · MN 15 · VAMMIKA SUTTA"
    // Cả 3 phần cùng style mono uppercase accent → đồng nhất, gọn, trang nhã.
    var paliName = (meta.titlePali || subtitleFromBilara || '').trim();
    if (superTitleEl) {
      var superParts = [];
      if (rootShort) superParts.push(rootShort);
      if (parentShort && parentShort !== rootShort) superParts.push(parentShort);
      var codeTxt = (meta.code || '').trim();
      if (codeTxt) superParts.push(codeTxt);
      if (paliName) superParts.push(paliName);
      // Plain text — CSS text-transform: uppercase sẽ uppercase hết
      superTitleEl.textContent = superParts.join(' · ');
    }

    // Subtitle cũ (Pali italic) — để trống vì đã gộp vào supertitle
    if (subtitleEl) subtitleEl.textContent = '';

    // Title meta: tên ngôn ngữ đối lập (EN khi ui=vi, VI khi ui=en)
    if (titleMetaEl) {
      var altName = uiLang === 'en' ? (meta.titleVi || '') : (meta.titleEn || '');
      titleMetaEl.textContent = altName;
    }

    // Partition rows:
    //   - :0.1/:0.2 của CHÍNH bài (id) → bỏ (đã hiển thị ở header)
    //   - :0.1/:0.2 của sub-chapter (vd an1.11:0.1 khi id=an1_v1) → GIỮ làm phân đoạn
    //   - :source → đẩy cuối
    //   - Còn lại giữ thứ tự
    var normId = String(id).replace(/([A-Za-z]+)0*(\d)/g, '$1$2');
    var mainPrefix1 = id + ':0.';
    var mainPrefix2 = normId + ':0.';
    var mainRows = [];
    var sourceRows = [];
    (merged.rows || []).forEach(function (r) {
      var k = String(r.key || '');
      // Chỉ skip :0.X của main sutta id (tiêu đề chính đã ở header)
      if (k.startsWith(mainPrefix1) || k.startsWith(mainPrefix2)) return;
      if (/:source$/i.test(k)) sourceRows.push(r);
      else mainRows.push(r);
    });
    var rowsForViewRaw = mainRows.concat(sourceRows);
    var singleLang = getSingleVisibleLang(); lastSingleLangMode = singleLang;
    var rowsForView = singleLang ? mergeRowsToParagraphRows(rowsForViewRaw, singleLang) : rowsForViewRaw;

    grid.innerHTML = '';
    cachedRows = [];
    applyVisibility();

    // ============================================================
    // VIRTUAL SCROLL (lazy chunks): Thay vì tạo 96k DOM elements ngay,
    //   1. Tạo N placeholder .row-chunk divs với min-height ước tính
    //   2. IntersectionObserver materialize chunk khi vào gần viewport
    //   3. Far-observer dematerialize chunk khi ra xa (giữ height measured)
    // Kết quả: ban đầu chỉ có ~120 div placeholder → render gần tức thì,
    // mobile với AN 4 (6000+ rows) không còn blocking main thread.
    // ============================================================
    var CHUNK_SIZE = 50;
    var EST_ROW_H = 120;  // px ước lượng cho 1 row chưa materialize
    virtChunks = [];       // {div, rowStart, rowEnd, materialized, measuredH}
    virtAllRows = rowsForView;

    // Bước 1: tạo TẤT CẢ placeholder chunks cùng lúc (rẻ — chỉ div + min-height)
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

    // Bước 2+3: Setup observers + initial render ở frame kế tiếp
    requestAnimationFrame(function () {
      if (token !== renderToken) { isRendering = false; return; }
      setupChunkObservers();
      isRendering = false; grid.setAttribute('aria-busy', 'false');
      requestAnimationFrame(function () {
        updateVisibleCols(); restoreScrollByAnchor(id);
        setupAnchorObserver(); setTtsUiState('idle'); updateNavButtons();
      });
      scheduleNextPreload(id);
    });
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

  // ============================================================
  // Random sutta — mở bài ngẫu nhiên
  // ============================================================
  var btnRandom = $('btnRandom');
  if (btnRandom) btnRandom.onclick = function () {
    if (!SUTRA_ORDER.length) return;
    var i = Math.floor(Math.random() * SUTRA_ORDER.length);
    openSutra(SUTRA_ORDER[i]);
    // Đóng Settings panel
    togglePanel(settingsPanel, false);
  };

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
      // Prefix code ngắn "AN 1" / "MN 136" / "DN 4" + tên bài kinh (bỏ phần "– Vagga 3")
      var meta  = findMetaById(currentSutraId);
      var shortCode = extractGroupKey(meta && meta.code);  // "AN 1 – Vagga 3" → "AN 1", "MN 136" → "MN 136"
      var title = uiLang === 'en'
        ? (meta && meta.titleEn) || (meta && meta.titleVi) || (meta && meta.titlePali) || currentSutraId
        : (meta && meta.titleVi) || (meta && meta.titleEn) || (meta && meta.titlePali) || currentSutraId;
      navTitle.textContent = shortCode ? (shortCode + ' · ' + title) : title;
      navTitle.style.cursor = 'pointer';
      navTitle.setAttribute('role', 'button');
      navTitle.setAttribute('title', (meta && meta.code ? meta.code + ' · ' : '') + title);
    }
  }

  // Click navTitle → mở panel Thư viện và scroll đến bài kinh hiện tại
  function revealCurrentSuttaInMenu() {
    if (!currentSutraId || !sutraMenuPanel || !sutraMenuList) return;
    togglePanel(settingsPanel, false);
    // Chuyển sang tile nikaya chứa bài kinh hiện tại (nếu khác)
    var nikOfCurrent = findNikayaOfSutta(currentSutraId);
    if (nikOfCurrent && nikOfCurrent !== activeNikayaKey) {
      setActiveNikaya(nikOfCurrent, true);
    }
    togglePanel(sutraMenuPanel, true);
    // Đợi panel mở xong rồi mở group chứa bài kinh + scroll đến link
    setTimeout(function () {
      var link = sutraMenuList.querySelector('.menu-sutta-link[data-id="' + safeCssEscape(currentSutraId) + '"]');
      if (!link) return;
      // Mở hết menu-list ancestor (bỏ collapsed + update aria của toggle)
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

  function clearRowHighlight() {
    if (!grid) return;
    var reading = grid.querySelectorAll('.sutra-row.reading');
    for (var k = 0; k < reading.length; k++) reading[k].classList.remove('reading');
  }
  function highlightRowAt(index) {
    clearRowHighlight();
    if (index < 0 || index >= virtAllRows.length) return;
    // Lazy materialize chunk chứa row này (nếu chưa rendered)
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
    if (ttsState.index >= virtAllRows.length) return resetTts(true, true);
    // Đọc text từ data (virtAllRows) — không query DOM vì chunk có thể chưa materialize
    var rowData = virtAllRows[ttsState.index];
    var raw = ttsState.activeLang === 'vi' ? (rowData && rowData.vie) : (rowData && rowData.eng);
    var text = (raw || '').trim();
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
    // Áp state cho btnSegKey + btnSegHdr theo prefs đã load
    var _bsk = $('btnSegKey'); if (_bsk) { _bsk.classList.toggle('active', showSegKey); _bsk.setAttribute('aria-pressed', String(showSegKey)); }
    var _bsh = $('btnSegHdr'); if (_bsh) { _bsh.classList.toggle('active', showColHdr); _bsh.setAttribute('aria-pressed', String(showColHdr)); }
    applyVisibility(); applySegKeyHdrVis(); loadZoom(); loadLineHeight(); buildSutraMenuFromIndex(); initDelegations();
    var startId = storage.get(KEY_LAST);
    if (startId) openSutra(startId); else renderWelcomeScreen();
    if (!synthSupported) {
      [btnReadTts, btnPauseTts, btnStopTts].forEach(function (b) { if (b) b.disabled = true; });
    } else {
      setTtsUiState('idle');
    }
    updateMenuPanelTop();
    initDebugPanel();
  }

  // ============================================================
  // DEBUG PANEL — hiện/ẩn qua DEBUG flag ở đầu file. Dùng để so sánh FPS/DOM
  // giữa phiên bản OLD (appold.js, không virtual scroll) và NEW (app.js).
  // Giúp xác định lag iPad do kiến trúc hay do code mới thêm.
  // ============================================================
  function initDebugPanel() {
    var btnDebug = $('btnDebug');
    var debugPanel = $('debugPanel');
    var debugBody = $('debugBody');
    var btnDebugClose = $('btnDebugClose');
    if (!btnDebug || !debugPanel || !debugBody) return;
    if (!DEBUG) {
      // Dùng visibility: hidden (không phải display:none / hidden attr) để giữ chỗ →
      // khi tắt DEBUG, 2 nút reset bên phải không bị dịch chuyển.
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
      // Old version: scroll container là #sutraGrid (không phải #readerArea)
      var sc = grid;
      var sh = sc ? sc.scrollHeight : 0;
      var st = sc ? sc.scrollTop : 0;
      var ch = sc ? sc.clientHeight : 0;
      var scrollPct = sh > ch ? Math.round(st / (sh - ch) * 100) : 0;
      var mem = (performance && performance.memory) ? performance.memory : null;
      var lines = [
        '--- OLD VERSION (appold.js) ---',
        'Sutta: ' + (currentSutraId || '-'),
        'Langs: ' + (showPali?'P':'') + (showEng?'E':'') + (showVie?'V':''),
        '',
        '── DOM ──',
        'Total elements:   ' + allDom,
        'Row wraps:        ' + wraps.length,
        'cachedRows len:   ' + cachedRows.length,
        '(old không có virtual scroll — tất cả row đều trong DOM đầy đủ)',
        '',
        '── Scroll (#sutraGrid) ──',
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
        'Lang/index:       ' + (ttsState.activeLang || '-') + ' / ' + ttsState.index,
        'Playing/Paused:   ' + ttsState.isPlaying + ' / ' + ttsState.isPaused,
      ];
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