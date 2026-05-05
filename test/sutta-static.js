/* ============================================================
   sutta-static.js
   Settings panel + anchor save/restore for pre-rendered static
   sutta pages. Reuses styles.css class names (.panel, .pill...).
   All toggles are CSS class flips — NO row re-render.
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var grid = document.getElementById('sutraGrid');
    var card = document.querySelector('.card');
    var html = document.documentElement;
    var body = document.body;
    var panel = document.getElementById('settingsPanel');
    var toggleBtn = document.getElementById('btnSettings');
    if (!grid || !card || !panel || !toggleBtn) {
      console.warn('[static] missing elements', {grid:!!grid, card:!!card, panel:!!panel, toggleBtn:!!toggleBtn});
      return;
    }

    body.classList.add('js-ready');
    var suttaId = body.getAttribute('data-sutta-id') || 'unknown';

    /* ── panel show/hide ── */
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
      panel.setAttribute('aria-hidden', panel.classList.contains('open') ? 'false' : 'true');
    });
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    });

    /* ── pill toggles (lang/display/layout) ── */
    function pillIsActive(btn) {
      var clsGrid = btn.getAttribute('data-toggle-grid');
      var clsCard = btn.getAttribute('data-toggle-card');
      if (!clsGrid && !clsCard) return false;
      var cls = clsGrid || clsCard;
      var target = clsGrid ? grid : card;
      var has = target.classList.contains(cls);
      var when = btn.getAttribute('data-checked-when') || 'off';
      return when === 'on' ? has : !has;
    }
    function syncPill(btn) {
      var on = pillIsActive(btn);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    var pills = panel.querySelectorAll('.pill[data-toggle-grid], .pill[data-toggle-card]');
    pills.forEach(syncPill);

    panel.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.pill[data-toggle-grid], .pill[data-toggle-card]');
      if (!btn) return;
      var clsGrid = btn.getAttribute('data-toggle-grid');
      var clsCard = btn.getAttribute('data-toggle-card');
      var cls = clsGrid || clsCard;
      var target = clsGrid ? grid : card;

      // Preserve top-visible row before layout change
      var topKey = findTopVisibleKey();
      target.classList.toggle(cls);
      syncPill(btn);
      if (topKey) requestAnimationFrame(function () { scrollToKey(topKey); });
    });

    /* ── dark mode ── */
    var darkBtn = document.getElementById('btnDarkMode');
    if (darkBtn) {
      var applyDark = function (on) {
        if (on) html.setAttribute('data-theme', 'dark');
        else html.removeAttribute('data-theme');
        darkBtn.classList.toggle('active', !!on);
        darkBtn.setAttribute('aria-pressed', String(!!on));
      };
      // Pick up system preference / storage on first load
      var storedTheme = null;
      try { storedTheme = localStorage.getItem('sutra_theme'); } catch (_) {}
      if (storedTheme === 'dark') applyDark(true);
      else if (!storedTheme && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) applyDark(true);
      else applyDark(html.getAttribute('data-theme') === 'dark');
      darkBtn.addEventListener('click', function () {
        var on = html.getAttribute('data-theme') !== 'dark';
        applyDark(on);
        try { localStorage.setItem('sutra_theme', on ? 'dark' : 'light'); } catch (_) {}
      });
    }

    /* ── sliders: zoom + line-height (reuse styles.css IDs) ──
       Slider thay CSS var global → mỗi pixel di chuyển sẽ reflow toàn bộ rows.
       Coalesce qua rAF: apply CSS var và lưu storage CHỈ 1 lần/frame, dù slider
       fire `input` event 50-100 lần khi user kéo. */
    function bindSlider(rangeId, badgeId, resetId, cssVar, divisor, suffix, defaultVal, storageKey) {
      var r = document.getElementById(rangeId);
      var b = document.getElementById(badgeId);
      var reset = document.getElementById(resetId);
      if (!r) return;
      var rafId = 0;
      var apply = function () {
        rafId = 0;
        var v = parseFloat(r.value);
        var cssV = (v / divisor).toFixed(2);
        html.style.setProperty(cssVar, cssV);
        if (b) b.textContent = suffix === '%' ? Math.round(v) + '%' : cssV;
      };
      var schedule = function () { if (!rafId) rafId = requestAnimationFrame(apply); };
      // Restore from storage
      try {
        var saved = localStorage.getItem(storageKey);
        if (saved !== null) r.value = saved;
      } catch (_) {}
      r.addEventListener('input', schedule);
      // Persist to storage on release (not every tick) → less localStorage churn
      r.addEventListener('change', function () {
        try { localStorage.setItem(storageKey, r.value); } catch (_) {}
      });
      if (reset) reset.addEventListener('click', function () {
        r.value = defaultVal;
        apply();
        try { localStorage.removeItem(storageKey); } catch (_) {}
      });
      apply();
    }
    bindSlider('sliderZoom',       'zoomValueBadge',       'btnZoomReset',       '--sutra-font-scale',  100, '%', 100, 'sutra_zoom');
    bindSlider('sliderLineHeight', 'lineHeightValueBadge', 'btnLineHeightReset', '--sutra-line-height', 100, '',  175, 'sutra_lh');

    /* ============================================================
       Anchor save/restore — single source of truth.
       - On scroll (debounced): save key of top-visible row to storage
       - On load: read saved key + URL hash, scrollIntoView
       - URL hash format: #<segment-key> for share-link support
       ============================================================ */
    var ANCHOR_KEY = 'static_anchor_' + suttaId;

    function findTopVisibleKey() {
      var rows = document.querySelectorAll('.sutra-row-wrap[data-key]');
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (r.bottom > 0) return rows[i].getAttribute('data-key');
      }
      return null;
    }
    function scrollToKey(key) {
      if (!key) return false;
      var safe = (window.CSS && CSS.escape) ? CSS.escape(key) : key.replace(/([^\w-])/g, '\\$1');
      var row = document.querySelector('.sutra-row-wrap[data-key="' + safe + '"]');
      if (!row) return false;
      row.scrollIntoView({ block: 'start', behavior: 'instant' });
      return true;
    }

    // Debounced scroll save
    var saveTimer = null;
    window.addEventListener('scroll', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        if (window.scrollY === 0) {
          try { localStorage.removeItem(ANCHOR_KEY); } catch (_) {}
          if (location.hash) history.replaceState(null, '', location.pathname + location.search);
          return;
        }
        var k = findTopVisibleKey();
        if (!k) return;
        try { localStorage.setItem(ANCHOR_KEY, k); } catch (_) {}
        history.replaceState(null, '', '#' + encodeURIComponent(k));
      }, 200);
    }, { passive: true });

    // Save on hide too (mobile address bar / app switcher)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden') return;
      var k = findTopVisibleKey();
      if (k) {
        try { localStorage.setItem(ANCHOR_KEY, k); } catch (_) {}
      }
    });

    // Restore: hash > localStorage
    var hashKey = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
    var storedKey = null;
    try { storedKey = localStorage.getItem(ANCHOR_KEY); } catch (_) {}
    var restoreKey = hashKey || storedKey;
    if (restoreKey) scrollToKey(restoreKey);

    /* ── share segment link (click on .sutra-seg-key copies URL with hash) ── */
    grid.addEventListener('click', function (e) {
      var keyEl = e.target.closest && e.target.closest('.sutra-seg-key');
      if (!keyEl) return;
      var wrap = keyEl.closest('.sutra-row-wrap');
      if (!wrap) return;
      var key = wrap.getAttribute('data-key');
      if (!key) return;
      var url = location.origin + location.pathname + '#' + encodeURIComponent(key);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          flashHint(keyEl, 'Đã copy link');
        }).catch(function () { flashHint(keyEl, key); });
      } else {
        flashHint(keyEl, key);
      }
    });
    function flashHint(el, msg) {
      var hint = document.createElement('span');
      hint.textContent = msg;
      hint.style.cssText = 'position:absolute;background:var(--accent);color:var(--bg);padding:2px 6px;border-radius:3px;font-size:10px;z-index:1000;pointer-events:none;margin-top:-22px;';
      var rect = el.getBoundingClientRect();
      hint.style.left = (rect.left + window.scrollX) + 'px';
      hint.style.top = (rect.top + window.scrollY) + 'px';
      document.body.appendChild(hint);
      setTimeout(function () { hint.remove(); }, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
