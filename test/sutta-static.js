/* ============================================================
   sutta-static.js
   Settings panel for pre-rendered static sutta pages.
   All toggles map to CSS classes / CSS variables — NO re-render of rows.
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var grid = document.getElementById('sutraGrid');
    var card = document.querySelector('.card');
    var html = document.documentElement;
    var body = document.body;
    var panel = document.getElementById('ss-panel');
    var toggleBtn = document.getElementById('ss-toggle');
    if (!grid || !card || !panel || !toggleBtn) {
      console.warn('[static] missing required elements', {grid:!!grid, card:!!card, panel:!!panel, toggleBtn:!!toggleBtn});
      return;
    }

    // Visible marker: turn ⚙ button green so user can confirm JS loaded.
    body.classList.add('js-ready');

    // ── panel show/hide ──
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
      panel.classList.remove('open');
    });

    // ── set initial checkbox states from current grid/card classes ──
    function syncInitialState() {
      var cbs = panel.querySelectorAll('input[type=checkbox][data-checked-when]');
      cbs.forEach(function (cb) {
        var cls = cb.getAttribute('data-toggle-grid') || cb.getAttribute('data-toggle-card');
        var target = cb.hasAttribute('data-toggle-grid') ? grid : card;
        var has = target.classList.contains(cls);
        var checkedWhen = cb.getAttribute('data-checked-when');
        cb.checked = checkedWhen === 'on' ? has : !has;
      });
    }
    syncInitialState();

    // ── event delegation: catch checkbox change anywhere in panel ──
    panel.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'INPUT' || t.type !== 'checkbox') return;
      var clsGrid = t.getAttribute('data-toggle-grid');
      var clsCard = t.getAttribute('data-toggle-card');
      if (!clsGrid && !clsCard) return;
      var cls = clsGrid || clsCard;
      var target = clsGrid ? grid : card;
      var checkedWhen = t.getAttribute('data-checked-when');
      var want = checkedWhen === 'on' ? t.checked : !t.checked;
      target.classList.toggle(cls, want);
    });

    // ── dark mode ──
    var darkBtn = document.getElementById('ss-dark');
    if (darkBtn) {
      var applyDark = function (on) {
        if (on) html.setAttribute('data-theme', 'dark');
        else html.removeAttribute('data-theme');
        darkBtn.classList.toggle('active', !!on);
      };
      applyDark(html.getAttribute('data-theme') === 'dark');
      darkBtn.addEventListener('click', function () {
        applyDark(html.getAttribute('data-theme') !== 'dark');
      });
    }

    // ── range sliders → CSS vars on :root ──
    function bindRange(rangeId, valId, cssVar) {
      var r = document.getElementById(rangeId);
      var v = document.getElementById(valId);
      if (!r || !v) return;
      var apply = function () {
        html.style.setProperty(cssVar, r.value);
        v.textContent = parseFloat(r.value).toFixed(2);
      };
      r.addEventListener('input', apply);
      apply();
    }
    bindRange('ss-font', 'ss-font-val', '--sutra-font-scale');
    bindRange('ss-lh',   'ss-lh-val',   '--sutra-line-height');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
