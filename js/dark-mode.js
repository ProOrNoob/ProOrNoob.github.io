'use strict';
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