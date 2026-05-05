/* ============================================================
   sutta-static.js
   Settings panel for pre-rendered static sutta pages.
   Pure click handlers + CSS class toggle. NO re-render of rows.
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

    // ── helpers ──
    function isActiveFor(btn) {
      var clsGrid = btn.getAttribute('data-toggle-grid');
      var clsCard = btn.getAttribute('data-toggle-card');
      if (!clsGrid && !clsCard) return false;
      var cls = clsGrid || clsCard;
      var target = clsGrid ? grid : card;
      var has = target.classList.contains(cls);
      var checkedWhen = btn.getAttribute('data-checked-when') || 'off';
      return checkedWhen === 'on' ? has : !has;
    }

    function syncPillState(btn) {
      btn.classList.toggle('active', isActiveFor(btn));
    }

    // Init: set .active state on every pill from current grid/card classes
    panel.querySelectorAll('.ss-pill[data-toggle-grid], .ss-pill[data-toggle-card]').forEach(syncPillState);

    // ── click delegation: any pill toggles its target class ──
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.ss-pill[data-toggle-grid], .ss-pill[data-toggle-card]');
      if (!btn) return;
      var clsGrid = btn.getAttribute('data-toggle-grid');
      var clsCard = btn.getAttribute('data-toggle-card');
      var cls = clsGrid || clsCard;
      var target = clsGrid ? grid : card;
      target.classList.toggle(cls);
      syncPillState(btn);
    });

    // ── dark mode (separate — uses html data-theme, not card/grid class) ──
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
