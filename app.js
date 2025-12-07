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

  // Map id -> tên file JS (không .js) – chỉnh cho đúng thực tế của bạn
  function getPackBySutraId(id){
    if(id === 'mn131') return 'sutra-mn131';
    if(id === 'mn132') return 'sutra-mn132';
    // ... thêm mapping khác ...
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

  const searchInput = document.getElementById('sutraSearch');

  /* TTS buttons */
  const btnReadVi    = document.getElementById('btnReadVi');
  const btnPauseVi   = document.getElementById('btnPauseVi');
  const btnRestartVi = document.getElementById('btnRestartVi');
  const btnStopVi    = document.getElementById('btnStopVi');

  const btnReadEn    = document.getElementById('btnReadEn');
  const btnPauseEn   = document.getElementById('btnPauseEn');
  const btnRestartEn = document.getElementById('btnRestartEn');
  const btnStopEn    = document.getElementById('btnStopEn');

  let currentSutraId = null;
  let showPali = true, showEng = true, showVie = true;

  /* Thứ tự bài dùng cho vuốt/kéo trái phải */
  let SUTRA_ORDER = [];

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
    if(sutraMenuPanel.classList.contains('open')){
      searchInput.focus();
    }
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
                  data-target="${secId}" data-level="1">
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
                      data-target="${grpId}" data-level="2">
                <span>${child.labelVi || child.labelEn || child.key}</span>
                <span class="chevron">▸</span>
              </button>
              <div id="${grpId}" class="menu-list collapsed">
          `;
          (child.children || []).forEach(s=>{
            html += `
              <a href="#" class="menu-sutta-link" data-id="${s.id}">
                ${s.code ? s.code + " – " : ""}${s.titleVi || s.titlePali || s.id}
              </a>
            `;
          });
          html += `</div></div>`;
        }else if(child.type === 'sutta'){
          html += `
            <a href="#" class="menu-sutta-link" data-id="${child.id}">
              ${child.code ? child.code + " – " : ""}${child.titleVi || child.titlePali || child.id}
            </a>
          `;
        }
      });

      html += `</div></li>`;
    });

    sutraMenuList.innerHTML = html;

    /* accordion */
    sutraMenuList.querySelectorAll('.menu-toggle').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const targetId = btn.dataset.target;
        const level    = btn.dataset.level || '1';
        const panel    = document.getElementById(targetId);
        if(!panel) return;

        const isCollapsed = panel.classList.contains('collapsed');

        if(isCollapsed){
          // thu tất cả cùng level
          sutraMenuList
            .querySelectorAll('.menu-toggle[data-level="'+level+'"]')
            .forEach(other=>{
              if(other === btn) return;
              const oId = other.dataset.target;
              const oPanel = document.getElementById(oId);
              if(oPanel && !oPanel.classList.contains('collapsed')){
                oPanel.classList.add('collapsed');
                const ch2 = other.querySelector('.chevron');
                if(ch2) ch2.textContent = '▸';
              }
            });
        }

        panel.classList.toggle('collapsed', !isCollapsed);
        const chev = btn.querySelector('.chevron');
        if(chev) chev.textContent = isCollapsed ? '▾' : '▸';
      });
    });

    /* click bài kinh */
    sutraMenuList.querySelectorAll('.menu-sutta-link').forEach(a=>{
      a.addEventListener('click',(e)=>{
        e.preventDefault();
        const id = a.dataset.id;
        openSutra(id);
        togglePanel(sutraMenuPanel,false);
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

  /* ========== SEARCH HIGHLIGHT ========== */
  function applySearch(query){
    const q = query.trim().toLowerCase();
    const links = sutraMenuList.querySelectorAll('.menu-sutta-link');

    if(!q){
      links.forEach(a=>a.classList.remove('match'));
      return;
    }

    links.forEach(a=>a.classList.remove('match'));

    links.forEach(a=>{
      const text = a.textContent.toLowerCase();
      if(text.includes(q)){
        a.classList.add('match');

        // mở section cha
        let parent = a.parentElement;
        while(parent && parent !== sutraMenuList){
          if(parent.classList.contains('menu-list')){
            parent.classList.remove('collapsed');

            const toggle = sutraMenuList.querySelector(
              `.menu-toggle[data-target="${parent.id}"]`
            );
            if(toggle){
              const ch = toggle.querySelector('.chevron');
              if(ch) ch.textContent = '▾';
            }
          }
          parent = parent.parentElement;
        }
      }
    });
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

    restoreTtsStateForCurrentSutra(); // highlight dòng TTS đang đọc dở nếu có
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

    // đảm bảo row trong viewport
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
      vi: {play:btnReadVi, pause:btnPauseVi, restart:btnRestartVi, stop:btnStopVi},
      en: {play:btnReadEn, pause:btnPauseEn, restart:btnRestartEn, stop:btnStopEn}
    }[lang];

    if(!map) return;

    if(state === 'idle'){
      map.play.disabled    = false;
      map.pause.disabled   = true;
      map.restart.disabled = true;
      map.stop.disabled    = true;
    }else if(state === 'playing'){
      map.play.disabled    = true;
      map.pause.disabled   = false;
      map.restart.disabled = false;
      map.stop.disabled    = false;
    }else if(state === 'paused'){
      map.play.disabled    = false;
      map.pause.disabled   = true;
      map.restart.disabled = false;
      map.stop.disabled    = false;
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
      // hết bài
      saveTtsState(null,0);
      clearRowHighlight();
      ttsState.isPlaying = false;
      ttsState.isPaused  = false;
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

    // nếu đang pause cùng lang -> resume
    if(ttsState.lang === lang && ttsState.isPaused && ttsState.currentUtter){
      ttsState.isPaused = false;
      ttsState.isPlaying = true;
      synth.resume();
      setTtsButtons(lang,'playing');
      return;
    }

    // nếu đang đọc lang khác -> dừng nhưng giữ highlight
    if(ttsState.lang && ttsState.lang !== lang){
      stopTtsAll(false);
    }

    ttsState.lang = lang;

    // lấy state cũ nếu có
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

  function restartTts(lang){
    if(!synthSupported) return;
    stopTtsAll(false);
    ttsState.lang  = lang;
    ttsState.index = 0;
    saveTtsState(lang, 0);
    speakNextRow();
  }

  function stopTts(lang){
    if(!synthSupported) return;
    if(lang && ttsState.lang && ttsState.lang !== lang) return;
    stopTtsAll(false); // giữ highlight & index
  }

  /* gán sự kiện TTS */
  btnReadVi.onclick    = ()=> startTts('vi');
  btnPauseVi.onclick   = ()=> pauseTts('vi');
  btnRestartVi.onclick = ()=> restartTts('vi');
  btnStopVi.onclick    = ()=> stopTts('vi');

  btnReadEn.onclick    = ()=> startTts('en');
  btnPauseEn.onclick   = ()=> pauseTts('en');
  btnRestartEn.onclick = ()=> restartTts('en');
  btnStopEn.onclick    = ()=> stopTts('en');

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

    if(!synthSupported){
      [btnReadVi,btnPauseVi,btnRestartVi,btnStopVi,
       btnReadEn,btnPauseEn,btnRestartEn,btnStopEn].forEach(b=>{
        b.disabled = true;
      });
    }else{
      setTtsButtons('vi','idle');
      setTtsButtons('en','idle');
    }
  }

  init();
})();
