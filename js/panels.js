'use strict';
/* ============================================================
Panel top position
============================================================ */
// Tạo một biến để theo dõi sự thay đổi kích thước
var resizeObserver = new ResizeObserver(entries => {
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
if (!isOpen && panel.contains(document.activeElement)) {
try {
if (btnSutraMenu) btnSutraMenu.focus();
else document.activeElement.blur();
} catch(_){}
}
try {
panel.classList.toggle('open', isOpen);
if (isOpen) {
panel.setAttribute('aria-hidden', 'false');
panel.removeAttribute('inert');
} else {
panel.setAttribute('aria-hidden', 'true');
panel.setAttribute('inert', '');
}
} finally {
if (panel === settingsPanel && btnSettings) {
btnSettings.setAttribute('aria-expanded', String(isOpen));
btnSettings.classList.toggle('active', isOpen);
if (!isOpen) _clearStickyHover(btnSettings);
document.body.classList.toggle('settings-open', isOpen);
}
if (panel === sutraMenuPanel && btnSutraMenu) {
btnSutraMenu.setAttribute('aria-expanded', String(isOpen));
btnSutraMenu.classList.toggle('is-open', isOpen);
if (!isOpen) _clearStickyHover(btnSutraMenu);
}
}
}
/* Touch device fix: khi user tap nút để đóng panel, browser giữ :hover/:active
   trên element vừa touch → ghost background quanh nút. Blur + force "no-hover"
   class trong 280ms → CSS sẽ override mọi state về transparent → hết ghost. */
function _clearStickyHover(btn) {
if (!btn) return;
try { btn.blur(); } catch(_){}
btn.classList.add('no-hover');
setTimeout(function () { btn.classList.remove('no-hover'); }, 280);
}
function positionSettingsPanel() {
if (!settingsPanel || !btnSettings) return;
var r = btnSettings.getBoundingClientRect();
var footer = document.querySelector('.status');
var footerH = footer ? footer.offsetHeight : (window.innerHeight - r.top);
settingsPanel.style.left   = r.left + 'px';
settingsPanel.style.bottom = (footerH + 8) + 'px';
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
// Defensive: nếu list rỗng khi mở (race condition / init chưa xong),
// re-render nikaya đang active để đảm bảo user luôn thấy danh sách.
if (willOpen && sutraMenuList && sutraMenuList.children.length === 0) {
var nikKey = activeNikayaKey || (window.SUTRA_INDEX && window.SUTRA_INDEX[0] && window.SUTRA_INDEX[0].key);
if (nikKey) {
if (!window.SUTRA_INDEX || !window.SUTRA_INDEX.length) return;
// Nếu buildSutraMenuFromIndex chưa chạy, chạy full flow
if (!FLAT_SUTTAS.length) buildSutraMenuFromIndex();
else setActiveNikaya(nikKey, false);
}
}
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
_blurIfMouse(btnSettings);
};
}
var btnSettingsClose = $('btnSettingsClose');
if (btnSettingsClose) {
btnSettingsClose.onclick = function (e) {
e.stopPropagation();
togglePanel(settingsPanel, false);
};
}
if (btnGuide && guideOverlay) {
btnGuide.onclick = function (e) {
e.stopPropagation();
openGuide();  // mở guide overlay, giữ nguyên sidebar
};
}
var dedTextEl = $('dedicationText');
if (dedTextEl) {
dedTextEl.classList.add('ded-clickable');
dedTextEl.setAttribute('title', uiLang === 'en' ? 'Double-click to return to home' : 'Nháy đôi để về trang chủ');
dedTextEl.addEventListener('dblclick', function (e) {
e.preventDefault();
try { storage.remove(KEY_LAST); } catch(_) {}
location.replace(location.pathname + location.search);
});
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
var showSegKey = true;
var showColHdr = true;
// 3 toggle riêng cho comment theo lang. Master = derived state: "any of 3 is ON".
var showCmtPli = true;
var showCmtEng = true;
var showCmtVie = true;
// 3 toggle nổi bật (italic + ink đậm, giống Pāli hiện tại)
var hlPli = true;   // default ON — Pāli theo convention kinh điển italic
var hlEng = false;
var hlVie = false;
