/* ============================================================
   sutta-static.js
   Settings panel for pre-rendered static sutta pages.
   All toggles map to CSS classes / CSS variables — NO re-render of rows.
   ============================================================ */
(function () {
  'use strict';

  var grid = document.getElementById('sutraGrid');
  var card = document.querySelector('.card');
  var html = document.documentElement;
  var panel = document.getElementById('ss-panel');
  var toggleBtn = document.getElementById('ss-toggle');
  if (!grid || !card || !panel || !toggleBtn) return;

  // ── panel show/hide — class on panel itself, not body, to avoid
  //    cascade invalidation across the entire row tree ──
  toggleBtn.addEventListener('click', function () {
    panel.classList.toggle('open');
  });
  // Click outside panel closes it
  document.addEventListener('click', function (e) {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
    panel.classList.remove('open');
  });

  // ── class-toggle checkboxes (no rerender) ──
  function bindClassToggle(cb, target) {
    var cls = cb.getAttribute('data-toggle-grid') || cb.getAttribute('data-toggle-card');
    var checkedWhen = cb.getAttribute('data-checked-when'); // "on" | "off"
    var has = target.classList.contains(cls);
    cb.checked = checkedWhen === 'on' ? has : !has;
    cb.addEventListener('change', function () {
      var want = checkedWhen === 'on' ? this.checked : !this.checked;
      target.classList.toggle(cls, want);
    });
  }
  document.querySelectorAll('[data-toggle-grid]').forEach(function (cb) {
    bindClassToggle(cb, grid);
  });
  document.querySelectorAll('[data-toggle-card]').forEach(function (cb) {
    bindClassToggle(cb, card);
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
  function bindRange(rangeId, valId, cssVar, fmt) {
    var r = document.getElementById(rangeId);
    var v = document.getElementById(valId);
    if (!r || !v) return;
    var apply = function () {
      html.style.setProperty(cssVar, r.value);
      v.textContent = fmt ? fmt(r.value) : parseFloat(r.value).toFixed(2);
    };
    r.addEventListener('input', apply);
    apply();
  }
  bindRange('ss-font', 'ss-font-val', '--sutra-font-scale');
  bindRange('ss-lh',   'ss-lh-val',   '--sutra-line-height');
})();
