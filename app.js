(function(){
  'use strict';

  /* ========== LAZY LOAD PACK JS ========== */
  const LOADED_PACKS = new Set();

  function loadPackIfNeeded(pack){
    return new Promise((resolve, reject)=>{
      if(!pack){
        resolve();
        return;
      }
      if(LOADED_PACKS.has(pack)) return resolve();

      const s = document.createElement('script');
      s.src = pack + '.js';
      s.onload = () => { LOADED_PACKS.add(pack); resolve(); };
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  // Map id -> tên file JS (không .js) – TUỲ BẠN CHỈNH
  function getPackBySutraId(id){
    if(id === 'mn131') return 'sutra-mn131';
    if(id === 'mn132') return 'sutra-mn132';
    // ... thêm mapping khác ở đây ...
    return null;
  }

  /* ========== BIẾN & DOM ========== */
  const card       = document.getElementById('card');
  const titleEl    = document.getElementById('title');
  const subtitleEl = document.getElementById('subtitle');
  const grid       = document.getElementById('sutraGrid');

  const btnSutraMenu = document.getElementById('btnSutraMenu');
  const btnSettings  = document.getElementById('btnSettings');
  const btnGuide     = document.getElementById('btnGuide');
  const btnBackTop   = document.getElementById('btnBackTop');

  const settingsPanel  = document.getElementById('settingsPanel');
  const sutraMenuPanel = document.getElementById('sutraMenuPanel');
  const sutraMenuList  = document.getElementById('sutraMenuList');
  const guideOverlay   = document.getElementById('guideOverlay');
  const btnCloseGuide  = document.getElementById('btnCloseGuide');

  const btnPali   = document.getElementById('btnPali');
  const btnEng    = document.getElementById('btnEng');
  const btnVie    = document.getElementById('btnVie');
  const btnLayout = document.getElementById('btnLayout');

  const searchInput     = document.getElementById('sutraSearch');
  const searchResultsEl = document.getElementById('sutraSearchResults');

  /* TTS buttons */
  const btnReadVi  = document.getElementById('btnReadVi');
  const btnPauseVi = document.getElementById('btnPauseVi');
  const btnStopVi  = document.getElementById('btnStopVi');

  const btnReadEn  = document.getElementById('btnReadEn');
  const btnPauseEn = document.getElementById('btnPauseEn');
  const btnStopEn  = document.getElementById('btnStopEn');

  /* Color controls */
  const paliBgInput   = document.getElementById('paliBgColor');
  const paliFgInput   = document.getElementById('paliTextColor');
  const engBgInput    = document.getElementById('engBgColor');
  const engFgInput    = document.getElementById('engTextColor');
  const vieBgInput    = document.getElementById('vieBgColor');
  const vieFgInput    = document.getElementById('vieTextColor');

  const btnResetPali = document.getElementById('btnResetPaliColor');
  const btnResetEng  = document.getElementById('btnResetEngColor');
  const btnResetVie  = document.getElementById('btnResetVieColor');

  /* Zoom controls */
  const btnZoomOut   = document.getElementById('btnZoomOut');
  const btnZoomIn    = document.getElementById('btnZoomIn');
  const btnZoomReset = document.getElementById('btnZoomReset');
  /* Layout & Theme controls */
  const btnFullWidth = document.getElementById('btnFullWidth');


  
  let currentSutraId = null;
  let showPali = true, showEng = true, showVie = true;

  /* Thứ tự bài dùng cho vuốt/kéo trái phải */
  let SUTRA_ORDER = [];

  /* Danh sách phẳng cho search */
  // FLAT_SUTTAS: { id, main, sub, flat }
  let FLAT_SUTTAS = [];
  /* ========== LAYOUT WIDE ONLY ========== */

const WIDE_STORAGE_KEY  = 'sutra_layout_wide';
let isWide = false;

function applyWideLayout(on){
  isWide = !!on;
  document.documentElement.classList.toggle('layout-wide', isWide);
  if(btnFullWidth){
    btnFullWidth.classList.toggle('active', isWide);
  }
}

function initLayoutWideControls(){
  const wideStored = localStorage.getItem(WIDE_STORAGE_KEY);
  if(wideStored === '1') applyWideLayout(true);

  if(btnFullWidth){
    btnFullWidth.addEventListener('click', ()=>{
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
    engBg:  '#ffffff',
    engFg:  '#111827',
    vieBg:  '#ffffff',
    vieFg:  '#111827'
  };

  const COLOR_VAR_MAP = {
    paliBg: '--pali-bg',
    paliFg: '--pali-fg',
    engBg:  '--eng-bg',
    engFg:  '--eng-fg',
    vieBg:  '--vie-bg',
    vieFg:  '--vie-fg'
  };

  const COLOR_STORAGE_PREFIX = 'sutra_color_';

  function applyColorVar(key, value){
    const cssVar = COLOR_VAR_MAP[key];
    if(!cssVar) return;
    document.documentElement.style.setProperty(cssVar, value);
  }

  function loadColorPrefs(){
    const result = {};
    Object.keys(COLOR_DEFAULTS).forEach(key=>{
      const stored = localStorage.getItem(COLOR_STORAGE_PREFIX + key);
      result[key] = stored || COLOR_DEFAULTS[key];
    });
    return result;
  }

  function saveColorPref(key, value){
    localStorage.setItem(COLOR_STORAGE_PREFIX + key, value);
  }

  function applyAllColors(colors){
    Object.keys(colors).forEach(key=>{
      applyColorVar(key, colors[key]);
    });
  }

  function resetLangColors(lang){
    // lang: 'pali' | 'eng' | 'vie'
    const bgKey = lang + 'Bg';
    const fgKey = lang + 'Fg';

    const defBg = COLOR_DEFAULTS[bgKey];
    const defFg = COLOR_DEFAULTS[fgKey];

    applyColorVar(bgKey, defBg);
    applyColorVar(fgKey, defFg);

    saveColorPref(bgKey, defBg);
    saveColorPref(fgKey, defFg);

    if(lang === 'pali'){
      if(paliBgInput) paliBgInput.value = defBg;
      if(paliFgInput) paliFgInput.value = defFg;
    }else if(lang === 'eng'){
      if(engBgInput) engBgInput.value = defBg;
      if(engFgInput) engFgInput.value = defFg;
    }else if(lang === 'vie'){
      if(vieBgInput) vieBgInput.value = defBg;
      if(vieFgInput) vieFgInput.value = defFg;
    }
  }

  function initColorControls(){
    const colors = loadColorPrefs();
    applyAllColors(colors);

    if(paliBgInput) paliBgInput.value = colors.paliBg;
    if(paliFgInput) paliFgInput.value = colors.paliFg;
    if(engBgInput)  engBgInput.value  = colors.engBg;
    if(engFgInput)  engFgInput.value  = colors.engFg;
    if(vieBgInput)  vieBgInput.value  = colors.vieBg;
    if(vieFgInput)  vieFgInput.value  = colors.vieFg;

    if(paliBgInput){
      paliBgInput.addEventListener('input', e=>{
        const val = e.target.value;
        applyColorVar('paliBg', val);
        saveColorPref('paliBg', val);
      });
    }
    if(paliFgInput){
      paliFgInput.addEventListener('input', e=>{
        const val = e.target.value;
        applyColorVar('paliFg', val);
        saveColorPref('paliFg', val);
      });
    }
    if(engBgInput){
      engBgInput.addEventListener('input', e=>{
        const val = e.target.value;
        applyColorVar('engBg', val);
        saveColorPref('engBg', val);
      });
    }
    if(engFgInput){
      engFgInput.addEventListener('input', e=>{
        const val = e.target.value;
        applyColorVar('engFg', val);
        saveColorPref('engFg', val);
      });
    }
    if(vieBgInput){
      vieBgInput.addEventListener('input', e=>{
        const val = e.target.value;
        applyColorVar('vieBg', val);
        saveColorPref('vieBg', val);
      });
    }
    if(vieFgInput){
      vieFgInput.addEventListener('input', e=>{
        const val = e.target.value;
        applyColorVar('vieFg', val);
        saveColorPref('vieFg', val);
      });
    }

    if(btnResetPali){
      btnResetPali.addEventListener('click', ()=> resetLangColors('pali'));
    }
    if(btnResetEng){
      btnResetEng.addEventListener('click', ()=> resetLangColors('eng'));
    }
    if(btnResetVie){
      btnResetVie.addEventListener('click', ()=> resetLangColors('vie'));
    }
  }

  /* ========== ZOOM CONFIG ========== */

  const ZOOM_STORAGE_KEY = 'sutra_zoom';
  const MIN_ZOOM = 0.8;
  const MAX_ZOOM = 1.6;
  const ZOOM_STEP = 0.1;
  let zoomLevel = 1;

  function clampZoom(z){
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }

  function applyZoom(){
    document.documentElement
      .style
      .setProperty('--sutra-font-scale', String(zoomLevel));
  }

  function loadZoom(){
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    if(stored){
      const v = parseFloat(stored);
      if(!Number.isNaN(v)){
        zoomLevel = clampZoom(v);
      }
    }
    applyZoom();
  }

  function saveZoom(){
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));
  }

  function initZoomControls(){
    loadZoom(); // áp dụng zoom lúc init

    if(btnZoomIn){
      btnZoomIn.addEventListener('click', ()=>{
        zoomLevel = clampZoom(zoomLevel + ZOOM_STEP);
        applyZoom();
        saveZoom();
      });
    }

    if(btnZoomOut){
      btnZoomOut.addEventListener('click', ()=>{
        zoomLevel = clampZoom(zoomLevel - ZOOM_STEP);
        applyZoom();
        saveZoom();
      });
    }

    if(btnZoomReset){
      btnZoomReset.addEventListener('click', ()=>{
        zoomLevel = 1;
        applyZoom();
        saveZoom();
      });
    }
  }

  /* ========== PANEL ========== */
  function togglePanel(panel, force){
    const isOpen = typeof force === 'boolean'
      ? force
      : !panel.classList.contains('open');
    panel.classList.toggle('open', isOpen);
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  btnSettings.onclick = ()=>{
    togglePanel(sutraMenuPanel, false);
    togglePanel(settingsPanel);
  };

  btnSutraMenu.onclick = ()=>{
    togglePanel(settingsPanel, false);
    togglePanel(sutraMenuPanel);
  };

  btnGuide.onclick = ()=>{
    guideOverlay.classList.add('show');
  };
  btnCloseGuide.onclick = ()=> guideOverlay.classList.remove('show');
  guideOverlay.addEventListener('click', (e)=>{
    if(e.target === guideOverlay) guideOverlay.classList.remove('show');
  });

  /* ========== MENU ACCORDION TỪ SUTRA_INDEX ========== */
  function buildSutraMenuFromIndex(){
    const index = window.SUTRA_INDEX || [];
    FLAT_SUTTAS = [];   // reset

    if(!Array.isArray(index) || !index.length){
      sutraMenuList.innerHTML = '<li>Chưa có mục lục.</li>';
      return;
    }

    let html = '';
    index.forEach(section=>{
      const secId = 'sec-' + section.key;
      html += `
        <li class="menu-block">
          <button class="menu-toggle" type="button"
                  data-target="${secId}">
            <span>${section.labelVi || section.labelEn || section.key}</span>
            <span class="chevron">▸</span>
          </button>
          <div id="${secId}" class="menu-list collapsed">
      `;

      (section.children || []).forEach(child=>{
        if(child.type === 'group'){
          const grpId = `${secId}-${child.key}`;
          html += `
            <div class="menu-subblock">
              <button class="menu-toggle nested" type="button"
                      data-target="${grpId}">
                <span>${child.labelVi || child.labelEn || child.key}</span>
                <span class="chevron">▸</span>
              </button>
              <div id="${grpId}" class="menu-list collapsed">
          `;

          (child.children || []).forEach(s=>{
            const mainText = `${s.code ? s.code + " – " : ""}${s.titlePali || s.titleVi || s.id}`;
            const subText  = (s.titleVi && s.titlePali) ? s.titleVi : '';
            const htmlLabel = `
              <div class="sutra-label">
                <div class="sutra-label-main">${mainText}</div>
                ${subText ? `<div class="sutra-label-sub">${subText}</div>` : ''}
              </div>
            `;
            const flatLabel = subText ? `${mainText} ${subText}` : mainText;

            html += `
              <a href="#" class="menu-sutta-link" data-id="${s.id}">
                ${htmlLabel}
              </a>
            `;
            FLAT_SUTTAS.push({
              id:   s.id,
              main: mainText,
              sub:  subText,
              flat: flatLabel
            });
          });

          html += `</div></div>`;
        }else if(child.type === 'sutta'){
          const mainText = `${child.code ? child.code + " – " : ""}${child.titlePali || child.titleVi || child.id}`;
          const subText  = (child.titleVi && child.titlePali) ? child.titleVi : '';
          const htmlLabel = `
            <div class="sutra-label">
              <div class="sutra-label-main">${mainText}</div>
              ${subText ? `<div class="sutra-label-sub">${subText}</div>` : ''}
            </div>
          `;
          const flatLabel = subText ? `${mainText} ${subText}` : mainText;

          html += `
            <a href="#" class="menu-sutta-link" data-id="${child.id}">
              ${htmlLabel}
            </a>
          `;
          FLAT_SUTTAS.push({
            id:   child.id,
            main: mainText,
            sub:  subText,
            flat: flatLabel
          });
        }
      });

      html += `</div></li>`;
    });

    sutraMenuList.innerHTML = html;

    /* helper: đóng 1 panel cấp 1 + tất cả nhóm con bên trong */
    function collapsePanelWithChildren(panelEl){
      if(!panelEl) return;

      panelEl.classList.add('collapsed');

      panelEl.querySelectorAll('.menu-toggle.nested').forEach(nestedBtn=>{
        const nestedId    = nestedBtn.dataset.target;
        if(!nestedId) return;
        const nestedPanel = document.getElementById(nestedId);
        if(nestedPanel && !nestedPanel.classList.contains('collapsed')){
          nestedPanel.classList.add('collapsed');
        }
        const ch = nestedBtn.querySelector('.chevron');
        if(ch) ch.textContent = '▸';
      });
    }

    /* accordion – tự đóng các nhóm cùng kiểu (top-level / nested) */
    sutraMenuList.querySelectorAll('.menu-toggle').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const targetId = btn.dataset.target;
        const panel    = document.getElementById(targetId);
        if(!panel) return;

        const isCollapsed = panel.classList.contains('collapsed');
        const isNested    = btn.classList.contains('nested');

        if(isCollapsed){
          const selector = isNested
            ? '.menu-toggle.nested'
            : '.menu-toggle:not(.nested)';

          sutraMenuList.querySelectorAll(selector).forEach(other=>{
            if(other === btn) return;
            const oId    = other.dataset.target;
            const oPanel = document.getElementById(oId);
            if(oPanel && !oPanel.classList.contains('collapsed')){
              if(!other.classList.contains('nested')){
                collapsePanelWithChildren(oPanel);
              }else{
                oPanel.classList.add('collapsed');
              }
              const ch2 = other.querySelector('.chevron');
              if(ch2) ch2.textContent = '▸';
            }
          });
        }

        if(isNested){
          panel.classList.toggle('collapsed', !isCollapsed);
        }else{
          if(isCollapsed){
            panel.classList.remove('collapsed');
          }else{
            collapsePanelWithChildren(panel);
          }
        }

        const chev = btn.querySelector('.chevron');
        if(chev) chev.textContent =
          panel.classList.contains('collapsed') ? '▸' : '▾';
      });
    });

    /* click bài kinh trong menu thường */
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(a=>{
      a.addEventListener('click',(e)=>{
        e.preventDefault();
        const id = a.dataset.id;
        openSutra(id);
        togglePanel(sutraMenuPanel,false);

        // clear search khi chọn kinh trong menu
        if(searchInput) searchInput.value = '';
        if(searchResultsEl) searchResultsEl.innerHTML = '';
      });
    });

    /* thứ tự cho swipe / kéo */
    SUTRA_ORDER = [];
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(a=>{
      SUTRA_ORDER.push(a.dataset.id);
    });
  }

  function highlightActiveInMenu(){
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(a=>{
      a.classList.toggle('active', a.dataset.id === currentSutraId);
    });
  }

  /* ========== SEARCH: kết quả riêng dưới ô search ========== */
  function renderSearchResults(matches, q){
    if(!searchResultsEl) return;
    if(!q){
      searchResultsEl.innerHTML = '';
      return;
    }

    if(!matches.length){
      searchResultsEl.innerHTML =
        '<div class="search-result-empty">Không tìm thấy kinh phù hợp.</div>';
      return;
    }

    const lowerQ = q.toLowerCase();

    function highlightPart(text, lowerQ){
      if(!text) return '';
      const lower = text.toLowerCase();
      const idx   = lower.indexOf(lowerQ);
      if(idx === -1) return text;
      const before = text.slice(0, idx);
      const mid    = text.slice(idx, idx + lowerQ.length);
      const after  = text.slice(idx + lowerQ.length);
      return `${before}<mark>${mid}</mark>${after}`;
    }

    const html = matches.map(m => {
      const mainHtml = highlightPart(m.main, lowerQ);
      const subHtml  = m.sub ? highlightPart(m.sub, lowerQ) : '';

      return `
        <button class="search-result-item" data-id="${m.id}">
          <span class="search-main">${mainHtml}</span>
          ${subHtml ? `<span class="search-sub">${subHtml}</span>` : ''}
        </button>
      `;
    }).join('');

    searchResultsEl.innerHTML = html;

    // gán click cho từng kết quả
    searchResultsEl.querySelectorAll('.search-result-item').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.id;
        if(id){
          openSutra(id);
          togglePanel(sutraMenuPanel, false);
          if(searchInput) searchInput.value = '';
          searchResultsEl.innerHTML = '';
        }
      });
    });
  }

  function applySearch(query){
    const q = (query || '').trim().toLowerCase();
    if(!q){
      renderSearchResults([], '');
      return;
    }

    const matches = FLAT_SUTTAS.filter(item =>
      item.flat.toLowerCase().includes(q)
    );

    renderSearchResults(matches, query);
  }

  if(searchInput){
    searchInput.addEventListener('input', e=>{
      applySearch(e.target.value);
    });
  }

  /* ========== RENDER BÀI ========== */
  async function renderSutra(id){
    if(!id) return;

    if(currentSutraId){
      localStorage.setItem('scroll_' + currentSutraId, grid.scrollTop || 0);
    }

    stopTtsAll(true); // dừng TTS khi đổi bài, xoá highlight cũ

    const pack = getPackBySutraId(id);
    await loadPackIfNeeded(pack);

    const data = (window.SUTRA_DATA || {})[id];
    if(!data){
      titleEl.textContent = 'Không tìm thấy dữ liệu bài kinh';
      subtitleEl.textContent = id;
      grid.innerHTML = '';
      currentSutraId = id;
      highlightActiveInMenu();
      return;
    }

    currentSutraId = id;
    localStorage.setItem('lastSutraId', id);

    titleEl.textContent    = data.title || id;
    subtitleEl.textContent = data.subtitle || '';

    let html = '';
    (data.rows || []).forEach(r=>{
      html += `
        <div class="sutra-row">
          <div class="sutra-col pali-col">
            <div class="col-head">Pāli</div>
            <div class="pali">${r.pali || ''}</div>
          </div>
          <div class="sutra-col eng-col">
            <div class="col-head">EN</div>
            <div class="eng">${r.eng || ''}</div>
          </div>
          <div class="sutra-col vie-col">
            <div class="col-head">VI</div>
            <div class="vie">${r.vie || ''}</div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    applyVisibility();
    highlightActiveInMenu();

    const saved = localStorage.getItem('scroll_' + id);
    grid.scrollTop = saved ? parseInt(saved,10) : 0;
    toggleBackTop(grid.scrollTop > 0);

    restoreTtsStateForCurrentSutra();
  }

  function openSutra(id){
    renderSutra(id);
  }

  /* ========== HIỂN THỊ CỘT & BỐ CỤC ========== */
  function adjustRowColumns(){
    const isNarrow = window.innerWidth <= 500;
    const rows = grid.querySelectorAll('.sutra-row');
    rows.forEach(row=>{
      if(card.classList.contains('stack') || isNarrow){
        row.style.gridTemplateColumns = '1fr';
        return;
      }
      let count = 0;
      if(showPali) count++;
      if(showEng)  count++;
      if(showVie)  count++;
      count = Math.max(1, count);
      row.style.gridTemplateColumns = `repeat(${count},1fr)`;
    });
  }

  function applyVisibility(){
    grid.classList.toggle('hide-pali', !showPali);
    grid.classList.toggle('hide-eng',  !showEng);
    grid.classList.toggle('hide-vie',  !showVie);
    adjustRowColumns();
  }

  window.addEventListener('resize', adjustRowColumns);

  btnPali.onclick = ()=>{
    showPali = !showPali;
    btnPali.classList.toggle('active', showPali);
    applyVisibility();
  };
  btnEng.onclick = ()=>{
    showEng = !showEng;
    btnEng.classList.toggle('active', showEng);
    applyVisibility();
  };
  btnVie.onclick = ()=>{
    showVie = !showVie;
    btnVie.classList.toggle('active', showVie);
    applyVisibility();
  };
  btnLayout.onclick = ()=>{
    card.classList.toggle('stack');
    btnLayout.classList.toggle('active', card.classList.contains('stack'));
    adjustRowColumns();
  };

  /* ========== BACK TO TOP ========== */
  function toggleBackTop(show){
    btnBackTop.classList.toggle('enabled', show);
  }

  grid.addEventListener('scroll', ()=>{
    toggleBackTop(grid.scrollTop > 0);
    if(currentSutraId){
      localStorage.setItem('scroll_' + currentSutraId, grid.scrollTop);
    }
  });

  btnBackTop.onclick = ()=>{
    if(!btnBackTop.classList.contains('enabled')) return;
    grid.scrollTo({top:0, behavior:'smooth'});
  };

  /* ========== SWIPE & MOUSE DRAG TRÁI/PHẢI ========== */
  const SWIPE_THRESHOLD = 60;

  function goPrevNext(direction){
    const idx = SUTRA_ORDER.indexOf(currentSutraId);
    if(idx === -1) return;
    if(direction === 'next' && idx < SUTRA_ORDER.length-1){
      openSutra(SUTRA_ORDER[idx+1]);
    }else if(direction === 'prev' && idx > 0){
      openSutra(SUTRA_ORDER[idx-1]);
    }
  }

  /* touch */
  let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;

  grid.addEventListener('touchstart', e=>{
    if(e.touches.length > 0){
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  },{passive:true});

  grid.addEventListener('touchend', e=>{
    if(e.changedTouches.length > 0){
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= SWIPE_THRESHOLD){
        if(dx < 0) goPrevNext('next');
        else goPrevNext('prev');
      }
    }
  },{passive:true});

  /* mouse drag */
  let mouseDown = false;
  let mouseStartX = 0;
  let mouseStartY = 0;

  grid.addEventListener('mousedown', e=>{
    if(e.button !== 0) return;
    mouseDown = true;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
  });

  grid.addEventListener('mouseup', e=>{
    if(!mouseDown) return;
    mouseDown = false;
    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= SWIPE_THRESHOLD){
      if(dx < 0) goPrevNext('next');
      else goPrevNext('prev');
    }
  });

  /* ========== TTS (Web Speech) – đọc từng hàng, lưu trạng thái ========== */
  const synthSupported = 'speechSynthesis' in window;
  const synth = synthSupported ? window.speechSynthesis : null;

  const ttsState = {
    lang:null,   // 'vi' | 'en'
    index:0,     // dòng đang/chuẩn bị đọc
    isPlaying:false,
    isPaused:false,
    currentUtter:null
  };

  function clearRowHighlight(){
    grid.querySelectorAll('.sutra-row.reading').forEach(r=>r.classList.remove('reading'));
  }

  function highlightRowAt(index){
    clearRowHighlight();
    const rows = grid.querySelectorAll('.sutra-row');
    if(index < 0 || index >= rows.length) return;
    const row = rows[index];
    row.classList.add('reading');

    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    const viewTop = grid.scrollTop;
    const viewBottom = viewTop + grid.clientHeight;
    if(top < viewTop || bottom > viewBottom){
      grid.scrollTo({top: Math.max(0, top-20), behavior:'smooth'});
    }
  }

  function saveTtsState(lang, index){
    if(!currentSutraId) return;
    if(!lang){
      localStorage.removeItem('tts_state_' + currentSutraId);
      return;
    }
    const obj = {lang, index};
    localStorage.setItem('tts_state_' + currentSutraId, JSON.stringify(obj));
  }

  function restoreTtsStateForCurrentSutra(){
    clearRowHighlight();
    ttsState.lang = null;
    ttsState.index = 0;
    ttsState.isPlaying = false;
    ttsState.isPaused  = false;
    ttsState.currentUtter = null;
    setTtsButtons('vi','idle');
    setTtsButtons('en','idle');

    if(!currentSutraId) return;
    const raw = localStorage.getItem('tts_state_' + currentSutraId);
    if(!raw) return;
    try{
      const st = JSON.parse(raw);
      if(!st || typeof st.index !== 'number' || !st.lang) return;
      const rows = grid.querySelectorAll('.sutra-row');
      if(st.index < 0 || st.index >= rows.length) return;
      ttsState.lang  = st.lang;
      ttsState.index = st.index;
      highlightRowAt(ttsState.index);
    }catch(e){}
  }

  function setTtsButtons(lang, state){
    const map = {
      vi: {play:btnReadVi, pause:btnPauseVi, stop:btnStopVi},
      en: {play:btnReadEn, pause:btnPauseEn, stop:btnStopEn}
    }[lang];

    if(!map) return;

    if(state === 'idle'){
      if (map.play)  map.play.disabled  = false;
      if (map.pause) map.pause.disabled = true;
      if (map.stop)  map.stop.disabled  = true;
    }else if(state === 'playing'){
      if (map.play)  map.play.disabled  = true;
      if (map.pause) map.pause.disabled = false;
      if (map.stop)  map.stop.disabled  = false;
    }else if(state === 'paused'){
      if (map.play)  map.play.disabled  = false;
      if (map.pause) map.pause.disabled = true;
      if (map.stop)  map.stop.disabled  = false;
    }
  }

  function pickVoice(langPrefix){
    if(!synthSupported) return null;
    const voices = synth.getVoices() || [];
    const list = voices.filter(v=>v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    return list[0] || null;
  }

  function speakNextRow(){
    if(!synthSupported) return;
    if(!ttsState.lang) return;

    const rows = grid.querySelectorAll('.sutra-row');
    if(ttsState.index >= rows.length){
      saveTtsState(null,0);
      clearRowHighlight();
      ttsState.isPlaying = false;
      ttsState.isPaused  = false;
      ttsState.lang      = null;
      ttsState.index     = 0;
      setTtsButtons('vi','idle');
      setTtsButtons('en','idle');
      return;
    }

    const row = rows[ttsState.index];
    if(!row){
      ttsState.index++;
      speakNextRow();
      return;
    }

    let el;
    if(ttsState.lang === 'vi'){
      el = row.querySelector('.vie-col .vie');
    }else if(ttsState.lang === 'en'){
      el = row.querySelector('.eng-col .eng');
    }
    const text = el ? el.innerText.trim() : '';
    if(!text){
      ttsState.index++;
      speakNextRow();
      return;
    }

    highlightRowAt(ttsState.index);
    saveTtsState(ttsState.lang, ttsState.index);

    const utter = new SpeechSynthesisUtterance(text);
    if(ttsState.lang === 'vi'){
      utter.lang = 'vi-VN';
      const v = pickVoice('vi');
      if(v) utter.voice = v;
      utter.rate  = 0.98;
      utter.pitch = 0.95;
    }else if(ttsState.lang === 'en'){
      utter.lang = 'en-US';
      const v = pickVoice('en');
      if(v) utter.voice = v;
    }

    utter.onend = ()=>{
      if(!ttsState.isPlaying || ttsState.isPaused) return;
      ttsState.index++;
      speakNextRow();
    };
    utter.onerror = ()=>{
      ttsState.isPlaying = false;
      ttsState.isPaused  = false;
      setTtsButtons('vi','idle');
      setTtsButtons('en','idle');
    };

    ttsState.currentUtter = utter;
    ttsState.isPlaying = true;
    ttsState.isPaused  = false;
    setTtsButtons(ttsState.lang,'playing');
    synth.speak(utter);
  }

  function stopTtsAll(clearHighlight){
    if(!synthSupported) return;
    synth.cancel();
    ttsState.isPlaying = false;
    ttsState.isPaused  = false;
    ttsState.currentUtter = null;
    if(clearHighlight){
      clearRowHighlight();
    }
    setTtsButtons('vi','idle');
    setTtsButtons('en','idle');
  }

  function startTts(lang){
    if(!synthSupported){
      alert('Trình duyệt không hỗ trợ đọc TTS.');
      return;
    }

    if (ttsState.lang === lang && ttsState.isPlaying) {
      return;
    }

    if(ttsState.lang === lang && ttsState.isPaused && ttsState.currentUtter){
      ttsState.isPaused = false;
      ttsState.isPlaying = true;
      synth.resume();
      setTtsButtons(lang,'playing');
      return;
    }

    if(ttsState.lang && ttsState.lang !== lang){
      stopTtsAll(false);
    }

    ttsState.lang = lang;

    if(currentSutraId){
      const raw = localStorage.getItem('tts_state_' + currentSutraId);
      if(raw){
        try{
          const st = JSON.parse(raw);
          if(st && st.lang === lang && typeof st.index === 'number'){
            ttsState.index = st.index;
          }else{
            ttsState.index = 0;
          }
        }catch(e){ ttsState.index = 0; }
      }else{
        ttsState.index = 0;
      }
    }else{
      ttsState.index = 0;
    }

    speakNextRow();
  }

  function pauseTts(lang){
    if(!synthSupported) return;
    if(ttsState.lang !== lang || !ttsState.isPlaying || !ttsState.currentUtter) return;
    synth.pause();
    ttsState.isPaused  = true;
    ttsState.isPlaying = false;
    setTtsButtons(lang,'paused');
  }

  function stopTts(lang){
    if(!synthSupported) return;
    if(lang && ttsState.lang && ttsState.lang !== lang) return;

    stopTtsAll(true);

    if(currentSutraId){
      localStorage.removeItem('tts_state_' + currentSutraId);
    }

    ttsState.lang  = null;
    ttsState.index = 0;
  }

  /* gán sự kiện TTS */
  if (btnReadVi)  btnReadVi.onclick  = ()=> startTts('vi');
  if (btnPauseVi) btnPauseVi.onclick = ()=> pauseTts('vi');
  if (btnStopVi)  btnStopVi.onclick  = ()=> stopTts('vi');

  if (btnReadEn)  btnReadEn.onclick  = ()=> startTts('en');
  if (btnPauseEn) btnPauseEn.onclick = ()=> pauseTts('en');
  if (btnStopEn)  btnStopEn.onclick  = ()=> stopTts('en');

  /* ========== INIT ========== */
  function init(){
    buildSutraMenuFromIndex();

    let startId = localStorage.getItem('lastSutraId');
    if(!startId && SUTRA_ORDER.length){
      startId = SUTRA_ORDER[0];
    }
    if(startId){
      openSutra(startId);
    }else{
      grid.innerHTML = '<div style="padding:8px 4px;font-size:13px;color:#6b7280;">Hãy mở 📖 để chọn bài kinh.</div>';
    }

    initColorControls();
    initZoomControls();
initLayoutWideControls();
    if(!synthSupported){
      [btnReadVi,btnPauseVi,btnStopVi,
       btnReadEn,btnPauseEn,btnStopEn].forEach(b=>{
        if (b) b.disabled = true;
      });
    }else{
      setTtsButtons('vi','idle');
      setTtsButtons('en','idle');
    }
  }

  init();
})();
