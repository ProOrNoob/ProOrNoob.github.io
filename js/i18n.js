'use strict';
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
setText('settingsHlLabel',        isEn ? 'Emphasize'           : 'Nổi bật');
setText('settingsHlSub',          isEn ? 'Italic + darker ink' : 'In nghiêng + đậm');
setText('settingsLayoutSub',      isEn ? 'Display options'     : 'Cách hiển thị');
setText('settingsCmtLabel',       isEn ? 'Commentary'          : 'Chú giải');
setText('settingsCmtSub',         isEn ? 'Show / hide by lang' : 'Hiện / ẩn theo ngôn ngữ');
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
var _btn3C = $('btn3Cols');
if (_btn3C) _btn3C.innerHTML = isEn
? '<span class="pill-icon">⫴</span> 3 columns'
: '<span class="pill-icon">⫴</span> 3 cột ngang';
var _btnCM = $('btnCmtMaster');
if (_btnCM) _btnCM.innerHTML = isEn
? '<span class="pill-icon">💬</span> Commentary'
: '<span class="pill-icon">💬</span> Chú giải';
var _btnCP = $('btnCmtPli');
if (_btnCP) _btnCP.innerHTML = '<span class="pill-icon">💬</span> Pāli';
var _btnCE = $('btnCmtEng');
if (_btnCE) _btnCE.innerHTML = '<span class="pill-icon">💬</span> Eng';
var _btnCV = $('btnCmtVie');
if (_btnCV) _btnCV.innerHTML = isEn
? '<span class="pill-icon">💬</span> Viet'
: '<span class="pill-icon">💬</span> Việt';
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
'<h3>📖 Thư viện bài kinh</h3>' +
'<ul>' +
'<li>Bấm <strong>Thư viện</strong> ở giữa footer để mở danh sách kinh. Hoặc nhập vào <strong>Tìm kiếm</strong> để tìm bài kinh.</li>' +
'</ul>' +
'<h3>⭐ Đánh dấu (Bookmark)</h3>' +
'<ul>' +
'<li>Bấm <strong>☆</strong> cạnh tiêu đề bài đang đọc (góc trên-trái) để lưu / bỏ lưu bài kinh yêu thích.</li>' +
'<li>Tile <strong>★ Đã lưu</strong> hiện số bài yêu thích đã lưu.</li>' +
'</ul>' +
'<h3>📜 Đọc kinh</h3>' +
'<ul>' +
'<li>Nút <strong>‹ TRƯỚC / SAU ›</strong>: dùng chuyển bài kinh.</li>' +
'<li><strong>⬆</strong>: về đầu bài kinh.</li>' +
'<li>Thanh tiến độ đọc dọc bên trái + badge <code>%</code> góc dưới-phải: cho biết đã đọc tới đâu. Tắt/bật trong Cài đặt (nút <code>▮ %</code>).</li>' +
'</ul>' +
'<h3>🔗 Chia sẻ & Sao chép</h3>' +
'<ul>' +
'<li><strong>🔗 Share đầu bài</strong> (góc trên-phải): chia sẻ link bài kinh.</li>' +
'<li><strong>🔗 Share đoạn</strong> (icon nhỏ cạnh mã đoạn): chia sẻ link đến đúng đoạn đó.</li>' +
'<li><strong>📋 Copy</strong> cạnh label <code>PĀLI</code> / <code>ENGLISH</code> / <code>VIỆT</code>: sao chép văn bản của cột đó cho đoạn hiện tại.</li>' +
'</ul>' +
'<h3>⚙ Cài đặt</h3>' +
'<ul>' +
'<li><strong>Giao diện</strong>: <strong>🌙/☀</strong> tối/sáng · <strong>VN/EN</strong> ngôn ngữ giao diện · <strong>🖨</strong> in / lưu PDF bài kinh hiện tại. Lưu ý: bài kinh dài (hàng ngàn đoạn) có thể mất vài giây đến vài chục giây để chuẩn bị — vui lòng đợi.</li>' +
'<li><strong>Ngôn ngữ</strong>: bật/tắt cột <code>PĀLI</code> · <code>ENGLISH</code> · <code>VIỆT</code>.</li>' +
'<li><strong>Bố cục</strong>: <code>☰ Xếp dọc</code> — stack 3 cột · <code># Segment</code> — ẩn/hiện mã đoạn · <code>▦ Label</code> — ẩn/hiện nhãn cột.</li>' +
'<li><strong>Cỡ chữ</strong>: slider 80–160% (chỉ áp cho nội dung). <strong>Giãn dòng</strong>: 1.3–2.6.</li>' +
'<li><strong>↺ A</strong> / <strong>↺ ☰</strong>: reset cỡ chữ / giãn dòng về mặc định.</li>' +
'<li><strong>▮ %</strong>: bật/tắt thanh tiến độ đọc (dọc bên trái + badge phần trăm).</li>' +
'<li><strong>🐞</strong>: debug.</li>' +
'</ul>' +
'<h3>🔊 Đọc to (TTS)</h3>' +
'<ul>' +
'<li><strong>▶ Play</strong>: đọc kinh theo ngôn ngữ giao diện (Việt hoặc Anh). Pāli chưa hỗ trợ.</li>' +
'<li><strong>⏸ Pause</strong>: giới hạn trình duyệt — khi tiếp tục sẽ đọc lại câu hiện tại từ đầu.</li>' +
'<li><strong>⏹ Stop</strong>: dừng hẳn, lần sau Play đọc từ đầu bài.</li>' +
'<li><em>*Một số thiết bị không hỗ trợ sẽ không đọc được.</em></li>' +
'</ul>' +
'<h3>ℹ Nguồn</h3>' +
'<p>Văn bản Pāli + bản dịch tiếng Anh Bhikkhu Sujato từ <a href="https://suttacentral.net/" target="_blank" rel="noopener">SuttaCentral</a> (dự án Bilara). Bản dịch tiếng Việt biên tập từ nhiều nguồn, có thể còn sai sót — vui lòng đối chiếu bản Pāli và tiếng Anh.</p>' +
'<p>Góp ý, báo lỗi: <a href="mailto:tuanctvn199@gmail.com">tuanctvn199@gmail.com</a></p>' +
'<button id="btnCloseGuide" type="button">Đóng</button>';
var enHtml =
'<h2>User Guide</h2>' +
'<h3>📖 Sutta Library</h3>' +
'<ul>' +
'<li>Tap <strong>Library</strong> in the footer center to open the sutta list. Or use <strong>Search</strong> to find a sutta.</li>' +
'</ul>' +
'<h3>⭐ Bookmarks</h3>' +
'<ul>' +
'<li>Tap <strong>☆</strong> next to the current sutta title (top-left) to save / unsave a favorite sutta.</li>' +
'<li>The <strong>★ Saved</strong> tile shows the count of saved suttas.</li>' +
'</ul>' +
'<h3>📜 Reading</h3>' +
'<ul>' +
'<li><strong>‹ PREV / NEXT ›</strong> buttons: navigate between suttas.</li>' +
'<li><strong>⬆</strong>: jump to the top of the sutta.</li>' +
'<li>Reading progress bar (left edge) + <code>%</code> badge (bottom-right): shows how far you have read. Toggle in Settings (<code>▮ %</code>).</li>' +
'</ul>' +
'<h3>🔗 Share & Copy</h3>' +
'<ul>' +
'<li><strong>🔗 Title share</strong> (top-right): share link to the sutta.</li>' +
'<li><strong>🔗 Segment share</strong> (small icon next to segment ID): share link to that exact segment.</li>' +
'<li><strong>📋 Copy</strong> next to <code>PĀLI</code> / <code>ENGLISH</code> / <code>VIỆT</code> labels: copy the text of that column for the current segment.</li>' +
'</ul>' +
'<h3>⚙ Settings</h3>' +
'<ul>' +
'<li><strong>Interface</strong>: <strong>🌙/☀</strong> dark/light · <strong>VN/EN</strong> interface language · <strong>🖨</strong> print / save current sutta to PDF. Note: long suttas (thousands of segments) may take a few seconds to tens of seconds to prepare — please wait.</li>' +
'<li><strong>Languages</strong>: toggle <code>PĀLI</code> · <code>ENGLISH</code> · <code>VIỆT</code> columns.</li>' +
'<li><strong>Layout</strong>: <code>☰ Stack</code> — stack 3 columns · <code># Segment</code> — show/hide segment IDs · <code>▦ Label</code> — show/hide column headers.</li>' +
'<li><strong>Font size</strong>: slider 80–160% (body text only). <strong>Line height</strong>: 1.3–2.6.</li>' +
'<li><strong>↺ A</strong> / <strong>↺ ☰</strong>: reset font size / line height.</li>' +
'<li><strong>▮ %</strong>: toggle reading progress bar.</li>' +
'<li><strong>🐞</strong>: debug.</li>' +
'</ul>' +
'<h3>🔊 Text-to-Speech (TTS)</h3>' +
'<ul>' +
'<li><strong>▶ Play</strong>: reads in UI language (VI or EN). Pāli not supported.</li>' +
'<li><strong>⏸ Pause</strong>: browser limitation — resume restarts the current sentence.</li>' +
'<li><strong>⏹ Stop</strong>: stops entirely; next Play starts from the beginning.</li>' +
'<li><em>*Some devices may not support TTS and won\'t read.</em></li>' +
'</ul>' +
'<h3>ℹ Sources</h3>' +
'<p>Pāli text and Bhikkhu Sujato English translations from <a href="https://suttacentral.net/" target="_blank" rel="noopener">SuttaCentral</a> (Bilara project). Vietnamese translations compiled from multiple sources — please cross-reference with Pāli and English originals.</p>' +
'<p>Feedback / bug reports: <a href="mailto:tuanctvn199@gmail.com">tuanctvn199@gmail.com</a></p>' +
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
var dialog = guideOverlay.querySelector('.guide-dialog');
if (dialog) dialog.scrollTop = 0;
setTimeout(function () { var b = $('btnCloseGuide'); if (b) b.focus({ preventScroll: true }); }, 50);
}
function closeGuide() {
if (!guideOverlay) return;
guideOverlay.classList.remove('show');
guideOverlay.setAttribute('aria-hidden', 'true');
if (btnGuide) btnGuide.focus();
}
