(function () {
  'use strict';

  /* ========== LAZY LOAD PACK JS ========== */
  const LOADED_PACKS = new Set();

  function loadPackIfNeeded(pack) {
    return new Promise((resolve, reject) => {
      if (!pack) {
        resolve();
        return;
      }
      if (LOADED_PACKS.has(pack)) return resolve();

      const s = document.createElement('script');
      s.src = pack + '.js';
      s.onload = () => {
        LOADED_PACKS.add(pack);
        resolve();
      };
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  // Map id -> tên file JS (không .js) – TUỲ BẠN CHỈNH
  function getPackBySutraId(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return 'sutra-' + id;
  }

  /* ========== BIẾN & DOM ========== */
  const card = document.getElementById('card');
  const titleEl = document.getElementById('title');
  const subtitleEl = document.getElementById('subtitle');
  const grid = document.getElementById('sutraGrid');

  const btnSutraMenu = document.getElementById('btnSutraMenu');
  const btnSettings = document.getElementById('btnSettings');
  const btnGuide = document.getElementById('btnGuide');
  const btnBackTop = document.getElementById('btnBackTop');
  const btnUiLang = document.getElementById('btnUiLang');

  const settingsPanel = document.getElementById('settingsPanel');
  const sutraMenuPanel = document.getElementById('sutraMenuPanel');
  const sutraMenuList = document.getElementById('sutraMenuList');
  const guideOverlay = document.getElementById('guideOverlay');
  let btnCloseGuide = document.getElementById('btnCloseGuide'); // sẽ gắn lại sau khi render guide

  const searchInput = document.getElementById('sutraSearch');
  const searchResultsEl = document.getElementById('sutraSearchResults');

  const btnPali = document.getElementById('btnPali');
  const btnEng = document.getElementById('btnEng');
  const btnVie = document.getElementById('btnVie');
  const btnLayout = document.getElementById('btnLayout');

  /* TTS buttons */
  const btnReadTts = document.getElementById('btnReadTts');
  const btnPauseTts = document.getElementById('btnPauseTts');
  const btnStopTts = document.getElementById('btnStopTts');
  /* Color controls */
  const paliBgInput = document.getElementById('paliBgColor');
  const paliFgInput = document.getElementById('paliTextColor');
  const engBgInput = document.getElementById('engBgColor');
  const engFgInput = document.getElementById('engTextColor');
  const vieBgInput = document.getElementById('vieBgColor');
  const vieFgInput = document.getElementById('vieTextColor');

  const btnResetPali = document.getElementById('btnResetPaliColor');
  const btnResetEng = document.getElementById('btnResetEngColor');
  const btnResetVie = document.getElementById('btnResetVieColor');

  /* Zoom controls */
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomReset = document.getElementById('btnZoomReset');

  /* Layout wide control */
  const btnFullWidth = document.getElementById('btnFullWidth');

  let currentSutraId = null;
  let showPali = true,
    showEng = true,
    showVie = true;

  /* Thứ tự bài dùng cho vuốt/kéo trái phải */
  let SUTRA_ORDER = [];

  /* Danh sách phẳng cho search */
  // FLAT_SUTTAS: { id, main, sub, flat }
  let FLAT_SUTTAS = [];

  /* ========== UI LANGUAGE (VI / EN) ========== */

  const LANG_STORAGE_KEY = 'sutra_ui_lang';
  let uiLang = localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'vi';
  window.SUTRA_UI_LANG = uiLang;

  // SVG cờ Việt Nam
  const FLAG_VI = `
    <svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="32" fill="#da251d"/>
      <polygon fill="#ffde00"
        points="
          24,6  27.1,14.3 36,14.3
          28.8,19.3 31.7,27
          24,22.1 16.3,27 19.2,19.3
          12,14.3 20.9,14.3
        "
      />
    </svg>
  `;

  // SVG cờ Anh (đại diện English)
  const FLAG_EN = `
    <svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="48" height="32" fill="#012169"/>
      <path d="M0 0 L20 13 H16 L0 3 Z M48 0 L28 13 H32 L48 3 Z M0 32 L20 19 H16 L0 29 Z M48 32 L28 19 H32 L48 29 Z"
            fill="#ffffff"/>
      <path d="M0 0 L20 13 H17 L0 2 Z M48 0 L28 13 H31 L48 2 Z M0 32 L20 19 H17 L0 30 Z M48 32 L28 19 H31 L48 30 Z"
            fill="#c8102e"/>
      <path d="M20 0 H28 V12 H48 V20 H28 V32 H20 V20 H0 V12 H20 Z"
            fill="#ffffff"/>
      <path d="M21.5 0 H26.5 V13.5 H48 V18.5 H26.5 V32 H21.5 V18.5 H0 V13.5 H21.5 Z"
            fill="#c8102e"/>
    </svg>
  `;

  function renderUiLangFlag() {
    if (!btnUiLang) return;
    btnUiLang.innerHTML = uiLang === 'en' ? FLAG_EN : FLAG_VI;
    btnUiLang.title =
      uiLang === 'en'
        ? 'Interface: English (click to switch to Vietnamese)'
        : 'Giao diện: Tiếng Việt (bấm để chuyển sang English)';
    if (!btnGuide) return;
    btnGuide.title =
      uiLang === 'en'
        ? 'User guide'
        : 'Hướng dẫn sử dụng';
    if (!btnSutraMenu) return;
    btnSutraMenu.title =
      uiLang === 'en'
        ? 'Sutta Index'
        : 'Danh mục bài kinh';
    if (!btnSettings) return;
    btnSettings.title =
      uiLang === 'en'
        ? 'Display settings'
        : 'Cài đặt hiển thị';
    if (!btnBackTop) return;
    btnBackTop.title =
      uiLang === 'en'
        ? 'Back to top'
        : 'Lên đầu nội dung';
  }

  function applyUiLanguageToSettingsPanel() {
    const isEn = uiLang === 'en';

    const settingsTitle = document.getElementById('settingsTitle');
    if (settingsTitle) {
      settingsTitle.textContent = isEn ? 'Display settings' : 'Cài đặt hiển thị';
    }

    const langLabel = document.getElementById('settingsLangLabel');
    if (langLabel) {
      langLabel.textContent = isEn ? 'Text languages:' : 'Ngôn ngữ hiển thị:';
    }

    const layoutLabel = document.getElementById('settingsLayoutLabel');
    if (layoutLabel) {
      layoutLabel.textContent = isEn ? 'Layout:' : 'Bố cục:';
    }

    if (btnLayout) {
      btnLayout.textContent = isEn
        ? '3 columns / Stacked'
        : '3 cột / Xếp dọc';
    }

    const ttsTitle = document.getElementById('settingsTtsTitle');
    if (ttsTitle) {
      ttsTitle.textContent = isEn ? 'Text-to-speech (TTS)' : 'Đọc kinh (TTS)';
    }

    const ttsUiLabel = document.getElementById('settingsTtsUiLabel');
    if (ttsUiLabel) {
      ttsUiLabel.textContent = isEn
        ? 'By interface language:'
        : 'Theo ngôn ngữ giao diện:';
    }

    const ttsNote = document.getElementById('settingsTtsNote');
    if (ttsNote) {
      ttsNote.innerHTML = isEn
        ? '* Uses browser built-in voices, quality may vary by device.'
        : '* TTS dùng giọng có sẵn của trình duyệt, có thể khác nhau giữa thiết bị.';
    }

    const colorTitle = document.getElementById('settingsColorTitle');
    if (colorTitle) {
      colorTitle.textContent = isEn
        ? 'Language column colors'
        : 'Màu cột ngôn ngữ';
    }

    const fontSizeLabel = document.getElementById('settingsFontSizeLabel');
    if (fontSizeLabel) {
      fontSizeLabel.textContent = isEn ? 'Font size:' : 'Cỡ chữ:';
    }

    // Full width
    const fullWidthLabel = btnFullWidth
      ? btnFullWidth.previousElementSibling
      : null;

    if (fullWidthLabel) {
      fullWidthLabel.textContent = isEn
        ? 'Full width:'
        : 'Giãn toàn màn hình:';
    }

    if (btnFullWidth) {
      btnFullWidth.title = isEn
        ? 'Toggle full width reading mode'
        : 'Bật / tắt chế độ giãn toàn màn hình';
    }
  }

  function renderWelcomeScreen() {
    if (!grid || currentSutraId) return;

    if (uiLang === 'en') {
      titleEl.textContent = 'Sutta reading collection';
      subtitleEl.textContent =
        'Welcome! Tap 📖 to select a sutta, or ❓ for the guide.';

      grid.innerHTML = `
      <div class="welcome-screen">
  <div class="welcome-box">
    <strong>Welcome!</strong> This seems to be your first time using the app.<br><br>

    <em>
      👉 First, you may choose the <strong>display language (VI / EN)</strong> using the 🇻🇳 / 🇬🇧 button at the bottom.
    </em>
    <br><br>

    • Tap 📖 <strong>Sutta Index</strong> to choose a sutta to read.<br>
    • Tap ❓ <strong>Guide</strong> to see detailed instructions.
  </div>
</div>

      `;
    } else {
      titleEl.textContent = 'Chào mừng bạn đến với trang lưu trữ kinh';
      subtitleEl.textContent =
        'Xin chào! Hãy bấm 📖 để chọn bài kinh, hoặc ❓ để xem hướng dẫn.';

      grid.innerHTML = `
            <div class="welcome-screen">
        <div class="welcome-box">
          <strong>Xin chào!</strong> Có vẻ đây là lần đầu bạn dùng ứng dụng này.<br><br>

          <em>
            👉 Trước tiên, bạn có thể chọn <strong>ngôn ngữ hiển thị (VI / EN)</strong> bằng nút 🇻🇳 / 🇬🇧 ở góc dưới.
          </em>
          <br><br>

          • Bấm 📖 <strong>Danh mục bài kinh</strong> để chọn bài muốn đọc.<br>
          • Bấm ❓ <strong>Hướng dẫn</strong> để xem cách sử dụng chi tiết.
        </div>
      </div>

      `;
    }
  }

  function renderGuideDialog() {
    if (!guideOverlay) return;
    const dlg = guideOverlay.querySelector('.guide-dialog');
    if (!dlg) return;

    let html;
    if (uiLang === 'en') {
      html = `
        <h2>Quick guide</h2>
        <div class="guide-body">
          <em>Short instructions on how to use the sutta reader.</em>
          <ul>
            <li>
              📖 <strong>Sutta Index</strong>: open the catalogue and choose a sutta to display.
            </li>
            <li>
              🔎 <strong>Search</strong>: type name, ID or keyword to quickly filter suttas.
            </li>
            <li>
              ⚙ <strong>Display settings</strong>:
              <ul>
                <li>Language columns: toggle PLI / EN / VI.</li>
                <li>Layout: 3 columns or stacked view.</li>
                <li>TTS: ▶ ⏸ ⏹ to play / pause / stop the reading.</li>
                <li>Colors: adjust background & text color for each language.</li>
                <li>Font size: A− / A / A+ to zoom out / reset / zoom in.</li>
                <li>Full width: expand the reading area to full screen width.</li>
              </ul>
            </li>
            <li>
              ↔ <strong>Swipe left–right</strong> on the text to go to the previous / next sutta.
            </li>
            <li>
              ↑ <strong>Back to top</strong>: scroll quickly to the top of the current sutta.
            </li>
          </ul>
        </div>
        <button id="btnCloseGuide" type="button">Close</button>
      `;
    } else {
      html = `
        <h2>Hướng dẫn nhanh</h2>
        <div class="guide-body">
          <em>Một số hướng dẫn cơ bản để bạn sử dụng trang đọc kinh.</em>
          <ul>
            <li>
              📖 <strong>Danh mục bài kinh</strong>:
              mở mục lục và chọn bài kinh muốn hiển thị.
            </li>
            <li>
              🔎 <strong>Tìm kiếm</strong>:
              gõ tên, mã số hoặc từ khóa để lọc nhanh bài kinh.
            </li>
            <li>
              ⚙ <strong>Cài đặt hiển thị</strong>:
              <ul>
                <li>Ngôn ngữ: bật / tắt các cột PLI – EN – VI.</li>
                <li>Bố cục: hiển thị 3 cột hoặc xếp dọc.</li>
                <li>Đọc kinh (TTS): dùng ▶ ⏸ ⏹ để nghe / tạm dừng / dừng đọc.</li>
                <li>Màu cột: chỉnh màu nền & chữ cho từng ngôn ngữ.</li>
                <li>Cỡ chữ: A− / A / A+ để thu nhỏ / mặc định / phóng to.</li>
                <li>Toàn màn hình: giãn khung đọc chiếm hết chiều ngang màn hình.</li>
              </ul>
            </li>
            <li>
              ↔ <strong>Vuốt / kéo ngang</strong> trên nội dung kinh
              để chuyển sang bài trước hoặc bài sau.
            </li>
            <li>
              ↑ <strong>Lên đầu</strong>:
              cuộn nhanh về đầu bài kinh hiện tại.
            </li>
          </ul>
        </div>
        <button id="btnCloseGuide" type="button">Đóng</button>
      `;
    }

    dlg.innerHTML = html;

    // Gắn lại nút đóng sau khi thay innerHTML
    btnCloseGuide = document.getElementById('btnCloseGuide');
    if (btnCloseGuide) {
      btnCloseGuide.onclick = () => guideOverlay.classList.remove('show');
    }
  }

  function applyUiLanguageToSearchUi() {
    if (!searchInput) return;
    searchInput.placeholder =
      uiLang === 'en'
        ? 'Search sutta...'
        : 'Tìm bài kinh ...';
  }

  function initUiLangFlag() {
    if (!btnUiLang) return;

    // lần đầu
    renderUiLangFlag();
    applyUiLanguageToSearchUi();
    applyUiLanguageToSettingsPanel();
    renderGuideDialog();

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
      if (currentSutraId) {
        renderSutra(currentSutraId); // render lại để đổi title/subtitle theo UI
      } else {
        renderWelcomeScreen();
      }
    });
  }

  /* ========== LAYOUT WIDE ONLY ========== */

  const WIDE_STORAGE_KEY = 'sutra_layout_wide';
  let isWide = false;

  function applyWideLayout(on) {
    isWide = !!on;
    document.documentElement.classList.toggle('layout-wide', isWide);
    if (btnFullWidth) {
      btnFullWidth.classList.toggle('active', isWide);
    }
  }

  function initLayoutWideControls() {
    const wideStored = localStorage.getItem(WIDE_STORAGE_KEY);
    if (wideStored === '1') applyWideLayout(true);

    if (btnFullWidth) {
      btnFullWidth.addEventListener('click', () => {
        const newVal = !isWide;
        applyWideLayout(newVal);
        localStorage.setItem(WIDE_STORAGE_KEY, newVal ? '1' : '0');
      });
    }
  }

  /* ========== COLOR CONFIG ========== */

  const COLOR_DEFAULTS = {
    paliBg: '#ffffff',
    paliFg: '#111827',
    engBg: '#ffffff',
    engFg: '#111827',
    vieBg: '#ffffff',
    vieFg: '#111827',
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
    Object.keys(colors).forEach((key) => {
      applyColorVar(key, colors[key]);
    });
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
      if (paliBgInput) paliBgInput.value = defBg;
      if (paliFgInput) paliFgInput.value = defFg;
    } else if (lang === 'eng') {
      if (engBgInput) engBgInput.value = defBg;
      if (engFgInput) engFgInput.value = defFg;
    } else if (lang === 'vie') {
      if (vieBgInput) vieBgInput.value = defBg;
      if (vieFgInput) vieFgInput.value = defFg;
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

    if (paliBgInput) {
      paliBgInput.addEventListener('input', (e) => {
        const val = e.target.value;
        applyColorVar('paliBg', val);
        saveColorPref('paliBg', val);
      });
    }
    if (paliFgInput) {
      paliFgInput.addEventListener('input', (e) => {
        const val = e.target.value;
        applyColorVar('paliFg', val);
        saveColorPref('paliFg', val);
      });
    }
    if (engBgInput) {
      engBgInput.addEventListener('input', (e) => {
        const val = e.target.value;
        applyColorVar('engBg', val);
        saveColorPref('engBg', val);
      });
    }
    if (engFgInput) {
      engFgInput.addEventListener('input', (e) => {
        const val = e.target.value;
        applyColorVar('engFg', val);
        saveColorPref('engFg', val);
      });
    }
    if (vieBgInput) {
      vieBgInput.addEventListener('input', (e) => {
        const val = e.target.value;
        applyColorVar('vieBg', val);
        saveColorPref('vieBg', val);
      });
    }
    if (vieFgInput) {
      vieFgInput.addEventListener('input', (e) => {
        const val = e.target.value;
        applyColorVar('vieFg', val);
        saveColorPref('vieFg', val);
      });
    }

    if (btnResetPali) {
      btnResetPali.addEventListener('click', () => resetLangColors('pali'));
    }
    if (btnResetEng) {
      btnResetEng.addEventListener('click', () => resetLangColors('eng'));
    }
    if (btnResetVie) {
      btnResetVie.addEventListener('click', () => resetLangColors('vie'));
    }
  }

  /* ========== ZOOM CONFIG ========== */

  const ZOOM_STORAGE_KEY = 'sutra_zoom';
  const MIN_ZOOM = 0.8;
  const MAX_ZOOM = 1.6;
  const ZOOM_STEP = 0.1;
  let zoomLevel = 1;

  function clampZoom(z) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }

  function applyZoom() {
    document.documentElement.style.setProperty(
      '--sutra-font-scale',
      String(zoomLevel)
    );
  }

  function loadZoom() {
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (stored) {
      const v = parseFloat(stored);
      if (!Number.isNaN(v)) {
        zoomLevel = clampZoom(v);
      }
    }
    applyZoom();
  }

  function saveZoom() {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
  }

  function initZoomControls() {
    loadZoom();

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        zoomLevel = clampZoom(zoomLevel + ZOOM_STEP);
        applyZoom();
        saveZoom();
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        zoomLevel = clampZoom(zoomLevel - ZOOM_STEP);
        applyZoom();
        saveZoom();
      });
    }

    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        zoomLevel = 1;
        applyZoom();
        saveZoom();
      });
    }
  }

  /* ========== PANEL ========== */
  function togglePanel(panel, force) {
    if (!panel) return;
    const isOpen =
      typeof force === 'boolean'
        ? force
        : !panel.classList.contains('open');
    panel.classList.toggle('open', isOpen);
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  if (btnSettings) {
    btnSettings.onclick = () => {
      togglePanel(sutraMenuPanel, false);
      togglePanel(settingsPanel);
    };
  }

  if (btnSutraMenu) {
    btnSutraMenu.onclick = () => {
      togglePanel(settingsPanel, false);
      togglePanel(sutraMenuPanel);
    };
  }

  if (btnGuide && guideOverlay) {
    btnGuide.onclick = () => {
      renderGuideDialog(); // đảm bảo đúng ngôn ngữ hiện tại
      guideOverlay.classList.add('show');
    };
  }
  if (guideOverlay) {
    guideOverlay.addEventListener('click', (e) => {
      if (e.target === guideOverlay) guideOverlay.classList.remove('show');
    });
  }
  /* ========== DOUBLE CLICK ĐỂ ĐÓNG MENU BÀI KINH ========== */
  if (grid && sutraMenuPanel) {
    grid.addEventListener('dblclick', (e) => {
      if (e.target === grid) {
        if (sutraMenuPanel.classList.contains('open')) {
          togglePanel(sutraMenuPanel, false);
        }
        if (settingsPanel && settingsPanel.classList.contains('open')) {
          togglePanel(settingsPanel, false);
        }
      }
    });
  }
  /* ========== MENU ACCORDION TỪ SUTRA_INDEX ========== */

  // Tạo HTML cho 1 link sutta + push vào FLAT_SUTTAS (dùng cho search)
  function buildSuttaLinkHtml(s) {
    const codePrefix = s.code ? s.code + ' – ' : '';

    const viLabel = s.titleVi || '';
    const enLabel = s.titleEn || '';
    const paliLabel = s.titlePali || '';

    let mainText, subText;

    if (uiLang === 'en') {
      // UI tiếng Anh: ưu tiên EN trên, Pali/Việt xuống dưới
      mainText = codePrefix + (enLabel || viLabel || paliLabel || s.id);
      subText = paliLabel || viLabel || '';
    } else {
      // UI tiếng Việt: ưu tiên VI trên, Pali/Anh xuống dưới
      mainText = codePrefix + (viLabel || enLabel || paliLabel || s.id);
      subText = paliLabel || enLabel || '';
    }

    const htmlLabel = `
      <div class="sutra-label">
        <div class="sutra-label-main">${mainText}</div>
        ${subText ? `<div class="sutra-label-sub">${subText}</div>` : ''}
      </div>
    `;
    const flatLabel = `${mainText} ${viLabel} ${enLabel} ${paliLabel}`.trim();

    FLAT_SUTTAS.push({
      id: s.id,
      main: mainText,
      sub: subText,
      flat: flatLabel,
    });

    return `
      <a href="#" class="menu-sutta-link" data-id="${s.id}">
        ${htmlLabel}
      </a>
    `;
  }

  // Đệ quy render children (group + sutta), hỗ trợ nhiều cấp group lồng nhau
  function buildMenuChildren(children, parentId) {
    if (!children || !children.length) return '';
    let html = '';

    children.forEach((child) => {
      if (child.type === 'group') {
        const grpId = `${parentId}-${child.key}`;
        const grpLabel =
          uiLang === 'en'
            ? child.labelEn || child.labelVi || child.key
            : child.labelVi || child.labelEn || child.key;

        const innerHtml = buildMenuChildren(child.children || [], grpId);

        html += `
          <div class="menu-subblock">
            <button class="menu-toggle nested" type="button" data-target="${grpId}">
              <span>${grpLabel}</span>
              <span class="chevron">▸</span>
            </button>
            <div id="${grpId}" class="menu-list collapsed">
              ${innerHtml}
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
      if (sutraMenuList) {
        sutraMenuList.innerHTML = '<li>Chưa có mục lục.</li>';
      }
      return;
    }

    let html = '';

    index.forEach((section) => {
      const secId = 'sec-' + section.key;

      const secLabel =
        uiLang === 'en'
          ? section.labelEn || section.labelVi || section.key
          : section.labelVi || section.labelEn || section.key;

      const childrenHtml = buildMenuChildren(section.children || [], secId);

      html += `
        <li class="menu-block">
          <button class="menu-toggle" type="button" data-target="${secId}">
            <span>${secLabel}</span>
            <span class="chevron">▸</span>
          </button>
          <div id="${secId}" class="menu-list collapsed">
            ${childrenHtml}
          </div>
        </li>
      `;
    });

    if (!sutraMenuList) return;
    sutraMenuList.innerHTML = html;

    function collapsePanelWithChildren(panelEl) {
      if (!panelEl) return;

      panelEl.classList.add('collapsed');

      panelEl
        .querySelectorAll('.menu-toggle.nested')
        .forEach((nestedBtn) => {
          const nestedId = nestedBtn.dataset.target;
          if (!nestedId) return;
          const nestedPanel = document.getElementById(nestedId);
          if (
            nestedPanel &&
            !nestedPanel.classList.contains('collapsed')
          ) {
            nestedPanel.classList.add('collapsed');
          }
          const ch = nestedBtn.querySelector('.chevron');
          if (ch) ch.textContent = '▸';
        });
    }

    sutraMenuList.querySelectorAll('.menu-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const panel = document.getElementById(targetId);
        if (!panel) return;

        const isCollapsed = panel.classList.contains('collapsed');
        const isNested = btn.classList.contains('nested');

       if (isCollapsed) {
          if (isNested) {
            // Nested: chỉ đóng các group anh em trong cùng .menu-list
            const parentList = btn.closest('.menu-list');
            if (parentList) {
              parentList
                .querySelectorAll('.menu-toggle.nested')
                .forEach((other) => {
                  if (other === btn) return;
                  const oId = other.dataset.target;
                  const oPanel = document.getElementById(oId);
                  if (oPanel && !oPanel.classList.contains('collapsed')) {
                    oPanel.classList.add('collapsed');
                    const ch2 = other.querySelector('.chevron');
                    if (ch2) ch2.textContent = '▸';
                  }
                });
            }
          } else {
            // Cấp 1: vẫn giữ behavior cũ – chỉ mở 1 block nikaya / tập lớn
            sutraMenuList
              .querySelectorAll('.menu-toggle:not(.nested)')
              .forEach((other) => {
                if (other === btn) return;
                const oId = other.dataset.target;
                const oPanel = document.getElementById(oId);
                if (oPanel && !oPanel.classList.contains('collapsed')) {
                  collapsePanelWithChildren(oPanel);
                  const ch2 = other.querySelector('.chevron');
                  if (ch2) ch2.textContent = '▸';
                }
              });
          }
        }

        if (isNested) {
          panel.classList.toggle('collapsed', !isCollapsed);
        } else {
          if (isCollapsed) {
            panel.classList.remove('collapsed');
          } else {
            collapsePanelWithChildren(panel);
          }
        }

        const chev = btn.querySelector('.chevron');
        if (chev) {
          chev.textContent = panel.classList.contains('collapsed')
            ? '▸'
            : '▾';
        }
      });
    });

    sutraMenuList
      .querySelectorAll('.menu-sutta-link')
      .forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const id = a.dataset.id;
          openSutra(id);
          togglePanel(sutraMenuPanel, false);

          if (searchInput) searchInput.value = '';
          if (searchResultsEl) searchResultsEl.innerHTML = '';
        });
      });

    SUTRA_ORDER = [];
    sutraMenuList
      .querySelectorAll('.menu-sutta-link')
      .forEach((a) => {
        SUTRA_ORDER.push(a.dataset.id);
      });

    highlightActiveInMenu();
  }

  function highlightActiveInMenu() {
    if (!sutraMenuList) return;
    sutraMenuList
      .querySelectorAll('.menu-sutta-link')
      .forEach((a) => {
        a.classList.toggle('active', a.dataset.id === currentSutraId);
      });
  }

  /* ========== SEARCH ========== */

  function renderSearchResults(matches, q) {
    if (!searchResultsEl) return;
    if (!q) {
      searchResultsEl.innerHTML = '';
      return;
    }

    if (!matches.length) {
      const msg =
        uiLang === 'en'
          ? 'No matching sutta found.'
          : 'Không tìm thấy kinh phù hợp.';
      searchResultsEl.innerHTML =
        '<div class="search-result-empty">' + msg + '</div>';
      return;
    }

    const lowerQ = q.toLowerCase();

    function highlightPart(text, lowerQ2) {
      if (!text) return '';
      const lower = text.toLowerCase();
      const idx = lower.indexOf(lowerQ2);
      if (idx === -1) return text;
      const before = text.slice(0, idx);
      const mid = text.slice(idx, idx + lowerQ2.length);
      const after = text.slice(idx + lowerQ2.length);
      return `${before}<mark>${mid}</mark>${after}`;
    }

    const html = matches
      .map((m) => {
        const mainHtml = highlightPart(m.main, lowerQ);
        const subHtml = m.sub ? highlightPart(m.sub, lowerQ) : '';
        return `
          <button class="search-result-item" data-id="${m.id}">
            <span class="search-main">${mainHtml}</span>
            ${
              subHtml
                ? `<span class="search-sub">${subHtml}</span>`
                : ''
            }
          </button>
        `;
      })
      .join('');

    searchResultsEl.innerHTML = html;

    searchResultsEl
      .querySelectorAll('.search-result-item')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (id) {
            openSutra(id);
            togglePanel(sutraMenuPanel, false);
            if (searchInput) searchInput.value = '';
            searchResultsEl.innerHTML = '';
          }
        });
      });
  }

  function applySearch(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      renderSearchResults([], '');
      return;
    }

    const matches = FLAT_SUTTAS.filter((item) =>
      item.flat.toLowerCase().includes(q)
    );

    renderSearchResults(matches, query);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      applySearch(e.target.value);
    });
  }

  /* ========== RENDER BÀI ========== */

  async function renderSutra(id) {
    if (!id || !grid) return;

    if (currentSutraId) {
      localStorage.setItem('scroll_' + currentSutraId, grid.scrollTop || 0);
    }

    resetTts(true, false);

   const pack = getPackBySutraId(id);
  try {
    await loadPackIfNeeded(pack);
  } catch (err) {
    console.warn('Không load được file:', pack, err);
  }

    const data = (window.SUTRA_DATA || {})[id];
    if (!data) {
      titleEl.textContent =
        uiLang === 'en'
          ? 'Sutta data not found'
          : 'Không tìm thấy dữ liệu bài kinh';

      subtitleEl.textContent =
        uiLang === 'en'
          ? `ID: ${id}`
          : `Mã bài: ${id}`;

      grid.innerHTML = '';
      currentSutraId = id;
      highlightActiveInMenu();
      return;
    }

    currentSutraId = id;
    localStorage.setItem('lastSutraId', id);

    const title =
      uiLang === 'en'
        ? data.titleEn || data.titleVi || data.title || id
        : data.titleVi || data.titleEn || data.title || id;

    const subtitle =
      uiLang === 'en'
        ? data.subtitleEn || data.subtitleVi || data.subtitle || ''
        : data.subtitleVi || data.subtitleEn || data.subtitle || '';

    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
    let html = '';
    (data.rows || []).forEach((r) => {
      html += `
        <div class="sutra-row">
          <div class="sutra-col pali-col">
            <div class="pali">${r.pali || ''}</div>
          </div>
          <div class="sutra-col eng-col">
            <div class="eng">${r.eng || ''}</div>
          </div>
          <div class="sutra-col vie-col">
            <div class="vie">${r.vie || ''}</div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    applyVisibility();
    highlightActiveInMenu();

    const saved = localStorage.getItem('scroll_' + id);
    grid.scrollTop = saved ? parseInt(saved, 10) : 0;
    toggleBackTop(grid.scrollTop > 0);

    restoreTtsStateForCurrentSutra();
  }

  function openSutra(id) {
    renderSutra(id);
  }

  /* ========== HIỂN THỊ CỘT & BỐ CỤC ========== */

  function adjustRowColumns() {
    if (!grid) return;
    const isNarrow = window.innerWidth <= 500;
    const rows = grid.querySelectorAll('.sutra-row');
    rows.forEach((row) => {
      if (card.classList.contains('stack') || isNarrow) {
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

  if (btnPali) {
    btnPali.onclick = () => {
      showPali = !showPali;
      btnPali.classList.toggle('active', showPali);
      applyVisibility();
    };
  }
  if (btnEng) {
    btnEng.onclick = () => {
      showEng = !showEng;
      btnEng.classList.toggle('active', showEng);
      applyVisibility();
    };
  }
  if (btnVie) {
    btnVie.onclick = () => {
      showVie = !showVie;
      btnVie.classList.toggle('active', showVie);
      applyVisibility();
    };
  }
  if (btnLayout) {
    btnLayout.onclick = () => {
      card.classList.toggle('stack');
      btnLayout.classList.toggle(
        'active',
        card.classList.contains('stack')
      );
      adjustRowColumns();
    };
  }

  /* ========== BACK TO TOP ========== */

  function toggleBackTop(show) {
    if (!btnBackTop) return;
    btnBackTop.classList.toggle('enabled', show);
  }

  if (grid) {
    grid.addEventListener('scroll', () => {
      toggleBackTop(grid.scrollTop > 0);
      if (currentSutraId) {
        localStorage.setItem(
          'scroll_' + currentSutraId,
          grid.scrollTop
        );
      }
    });
  }

  if (btnBackTop && grid) {
    btnBackTop.onclick = () => {
      if (!btnBackTop.classList.contains('enabled')) return;
      grid.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  /* ========== SWIPE & MOUSE DRAG TRÁI/PHẢI ========== */

  const SWIPE_THRESHOLD = 60;

  function goPrevNext(direction) {
    const idx = SUTRA_ORDER.indexOf(currentSutraId);
    if (idx === -1) return;
    if (direction === 'next' && idx < SUTRA_ORDER.length - 1) {
      openSutra(SUTRA_ORDER[idx + 1]);
    } else if (direction === 'prev' && idx > 0) {
      openSutra(SUTRA_ORDER[idx - 1]);
    }
  }

  if (grid) {
    let touchStartX = 0,
      touchStartY = 0,
      touchEndX = 0,
      touchEndY = 0;

    grid.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    grid.addEventListener(
      'touchend',
      (e) => {
        if (e.changedTouches.length > 0) {
          touchEndX = e.changedTouches[0].clientX;
          touchEndY = e.changedTouches[0].clientY;
          const dx = touchEndX - touchStartX;
          const dy = touchEndY - touchStartY;
          if (
            Math.abs(dx) > Math.abs(dy) &&
            Math.abs(dx) >= SWIPE_THRESHOLD
          ) {
            if (dx < 0) goPrevNext('next');
            else goPrevNext('prev');
          }
        }
      },
      { passive: true }
    );

    let mouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;

    grid.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      mouseDown = true;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
    });

    grid.addEventListener('mouseup', (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      if (
        Math.abs(dx) > Math.abs(dy) &&
        Math.abs(dx) >= SWIPE_THRESHOLD
      ) {
        if (dx < 0) goPrevNext('next');
        else goPrevNext('prev');
      }
    });
  }

  /* ========== TTS (Web Speech) – đọc theo ngôn ngữ giao diện ========== */

  const synthSupported = 'speechSynthesis' in window;
  const synth = synthSupported ? window.speechSynthesis : null;

  const ttsState = {
    activeLang: null,   // 'vi' | 'en' – dựa trên uiLang
    index: 0,           // dòng đang/chuẩn bị đọc
    isPlaying: false,
    isPaused: false,
    currentUtter: null,
  };

  function clearRowHighlight() {
    if (!grid) return;
    grid
      .querySelectorAll('.sutra-row.reading')
      .forEach((r) => r.classList.remove('reading'));
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
      grid.scrollTo({ top: Math.max(0, top - 20), behavior: 'smooth' });
    }
  }

  function saveTtsState() {
    if (!currentSutraId || !ttsState.activeLang) return;
    const obj = { lang: ttsState.activeLang, index: ttsState.index };
    localStorage.setItem('tts_state_' + currentSutraId, JSON.stringify(obj));
  }

  function resetTts(clearHighlight, clearStorage) {
    if (synthSupported) {
      synth.cancel();
    }
    ttsState.isPlaying = false;
    ttsState.isPaused = false;
    ttsState.currentUtter = null;
    ttsState.index = 0;
    ttsState.activeLang = null;

    if (clearHighlight) {
      clearRowHighlight();
    }

    if (clearStorage && currentSutraId) {
      localStorage.removeItem('tts_state_' + currentSutraId);
    }

    setTtsUiState('idle');
  }

  function restoreTtsStateForCurrentSutra() {
    // Mỗi khi chuyển bài: xoá highlight, reset state (không auto đọc lại)
    resetTts(true, false);
  }

  function setTtsUiState(state) {
    if (!btnReadTts || !btnPauseTts || !btnStopTts) return;

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

  function pickVoice(langPrefix) {
    if (!synthSupported) return null;
    const voices = synth.getVoices() || [];
    const list = voices.filter(
      (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)
    );
    return list[0] || null;
  }

  function speakNextRow() {
    if (!synthSupported) return;
    if (!ttsState.activeLang) return;
    if (!grid) return;

    const rows = grid.querySelectorAll('.sutra-row');
    if (ttsState.index >= rows.length) {
      // Đọc xong bài → reset về đầu, xoá highlight
      resetTts(true, true);
      return;
    }

    const row = rows[ttsState.index];
    if (!row) {
      ttsState.index++;
      speakNextRow();
      return;
    }

    let el;
    if (ttsState.activeLang === 'vi') {
      el = row.querySelector('.vie-col .vie');
    } else if (ttsState.activeLang === 'en') {
      el = row.querySelector('.eng-col .eng');
    }

    const text = el ? el.innerText.trim() : '';
    if (!text) {
      ttsState.index++;
      speakNextRow();
      return;
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
    } else if (ttsState.activeLang === 'en') {
      utter.lang = 'en-US';
      const v = pickVoice('en');
      if (v) utter.voice = v;
    }

    utter.onend = () => {
      ttsState.currentUtter = null;

      if (!ttsState.activeLang) {
        clearRowHighlight();
        return;
      }

      if (ttsState.isPaused) {
        // Pause: giữ nguyên index, không nhảy dòng
        return;
      }

      if (!ttsState.isPlaying) {
        // Bị stop ở chỗ khác
        clearRowHighlight();
        return;
      }

      // Chuyển sang dòng tiếp theo
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

    synth.speak(utter);
  }

  function startTtsByUiLang() {
    if (!synthSupported) {
      alert(
        uiLang === 'en'
          ? 'Your browser does not support TTS.'
          : 'Trình duyệt không hỗ trợ đọc TTS.'
      );
      return;
    }

    const targetLang = uiLang === 'en' ? 'en' : 'vi';

    // Đang phát cùng lang → không làm gì
    if (ttsState.activeLang === targetLang && ttsState.isPlaying) {
      return;
    }

    // Đang pause cùng lang → tiếp tục từ dòng hiện tại
    if (ttsState.activeLang === targetLang && ttsState.isPaused) {
      ttsState.isPaused = false;
      ttsState.isPlaying = true;
      setTtsUiState('playing');
      speakNextRow();
      return;
    }

    // Đổi lang hoặc bắt đầu mới
    resetTts(true, false);
    ttsState.activeLang = targetLang;

    // Thử khôi phục index đã lưu cho bài này & lang này
    if (currentSutraId) {
      const raw = localStorage.getItem('tts_state_' + currentSutraId);
      if (raw) {
        try {
          const st = JSON.parse(raw);
          if (st && st.lang === targetLang && typeof st.index === 'number') {
            ttsState.index = st.index;
          }
        } catch (e) {
          ttsState.index = 0;
        }
      }
    }

    // Nếu chưa có, mặc định từ dòng 0
    if (!Number.isInteger(ttsState.index) || ttsState.index < 0) {
      ttsState.index = 0;
    }

    speakNextRow();
  }

  function pauseTtsByUiLang() {
    if (!synthSupported) return;
    if (!ttsState.activeLang || !ttsState.isPlaying || !ttsState.currentUtter)
      return;

    ttsState.isPaused = true;
    ttsState.isPlaying = false;

    // Cancel hiện tại → trigger onend nhưng sẽ không nhảy dòng vì isPaused = true
    synth.cancel();
    ttsState.currentUtter = null;

    saveTtsState();

    clearRowHighlight();
    setTtsUiState('paused');
  }

  function stopTtsByUiLang() {
    if (!synthSupported) return;
    // Stop thực sự: về đầu bài, xoá highlight & state
    resetTts(true, true);
  }

  // Gán handler cho TTS UI
  if (btnReadTts) btnReadTts.onclick = startTtsByUiLang;
  if (btnPauseTts) btnPauseTts.onclick = pauseTtsByUiLang;
  if (btnStopTts) btnStopTts.onclick = stopTtsByUiLang;

  /* ========== INIT ========== */

  function init() {
    // Ui language + flag + guide + search placeholder
    initUiLangFlag();

    // menu + search data
    buildSutraMenuFromIndex();

    let startId = localStorage.getItem('lastSutraId');

    if (startId) {
      openSutra(startId);
    } else {
      renderWelcomeScreen();
    }

    initColorControls();
    initZoomControls();
    initLayoutWideControls();

    if (!synthSupported) {
      [btnReadTts, btnPauseTts, btnStopTts].forEach((b) => {
        if (b) b.disabled = true;
      });
    } else {
      setTtsUiState('idle');
    }
  }

  init();
})();
