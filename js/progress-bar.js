'use strict';
function toggleBackTop(show) { if (!btnBackTop) return; btnBackTop.classList.toggle('visible', show); }
// Throttle save (leading-edge) + debounce (trailing-edge) cho final stable top sau khi user dừng scroll.
// `pagehide` + `visibilitychange` đã đảm bảo save lúc rời trang nên debounce ngắn là đủ.
// Skip nếu _progScrollUntil > now (suppress window cho programmatic scroll).
var _saveAnchorThrottled = throttle(saveScrollAnchorNow, 250);
var _saveAnchorDebounced = debounce(saveScrollAnchorNow, 200);
var _backTopThrottled = throttle(function (v) { toggleBackTop(v); }, 120);
var _progressIdleTimer = null;
function _ensureProgressElements(wrap) {
var bar = wrap.querySelector('.rp-bar');
if (!bar) {
bar = document.createElement('span');
bar.className = 'rp-bar';
wrap.insertBefore(bar, wrap.firstChild);
}
var existing = wrap.querySelectorAll('.rp-dot');
if (existing.length !== 5) {
Array.prototype.forEach.call(existing, function (d) { d.remove(); });
for (var i = 0; i < 5; i++) {
var d = document.createElement('span');
d.className = 'rp-dot';
d.dataset.idx = String(i);
wrap.appendChild(d);
}
}
return { bar: bar, dots: wrap.querySelectorAll('.rp-dot') };
}
function updateReadingProgress() {
var wrap = document.getElementById('readingProgress');
var pctEl = document.getElementById('readingProgressPct');
if (!wrap || !scrollEl) return;
var max = scrollEl.scrollHeight - scrollEl.clientHeight;
if (max <= 10 || !currentSutraId) {
wrap.classList.remove('visible');
return;
}
var gridRect = scrollEl.getBoundingClientRect();
wrap.style.top = gridRect.top + 'px';
wrap.style.bottom = Math.max(0, window.innerHeight - gridRect.bottom) + 'px';
var pct = Math.min(1, Math.max(0, scrollEl.scrollTop / max));
// Snap to 100% chỉ khi scroll thực sự chạm đáy. Trước đây dùng
// `.sutra-row-wrap:last-of-type` nhưng selector này match row cuối của MỌI chunk
// (mỗi `.row-chunk` có toàn con là `.sutra-row-wrap` nên :last-of-type khớp last row
// của từng chunk), querySelector trả về match đầu tiên = row cuối của chunk-materialized
// đầu tiên ≠ row cuối sutta → snap 100% sớm rồi tụt lại khi chunk kế materialize.
// Geometry-based check không phụ thuộc virtualization state, tolerance 2px cho sub-pixel rounding.
if (scrollEl.scrollHeight - (scrollEl.scrollTop + scrollEl.clientHeight) <= 2) pct = 1;
var wrapH = gridRect.height;
var BAR_HEIGHT = 48;
var DOT_SIZE = 4;
var DOT_SPACING_INIT = (BAR_HEIGHT - DOT_SIZE) / 4;
var leadStart = 8 + (BAR_HEIGHT - DOT_SIZE);
var range = Math.max(0, wrapH - 16 - leadStart);
var leadY = leadStart + pct * range;
var els = _ensureProgressElements(wrap);
var bar = els.bar;
var dots = els.dots;
var BAR_FULL_END = 0.05;
var BAR_FADE_END = 0.08;
var BALL_START_PCT = 0.025;
var BALL_FULL_AT = 0.04;
var BALL_PHASE_TRIGGER = 0.05;
var initLead = leadStart + BALL_PHASE_TRIGGER * range;
var ballPct = Math.max(0, pct - BALL_PHASE_TRIGGER);
var SPEEDS = [1.00, 0.82, 0.64, 0.46, 0.28];
var FADE_WIN = [null, [0.65, 0.97], [0.50, 0.80], [0.35, 0.63], [0.20, 0.43]];
var topDotY = pct < BALL_PHASE_TRIGGER
? (leadY - 4 * DOT_SPACING_INIT)
: (initLead - 4 * DOT_SPACING_INIT) + ballPct * SPEEDS[4] * range;
var barOp;
if (pct <= BAR_FULL_END) barOp = 1;
else if (pct >= BAR_FADE_END) barOp = 0;
else barOp = (BAR_FADE_END - pct) / (BAR_FADE_END - BAR_FULL_END);
bar.style.top = topDotY.toFixed(1) + 'px';
bar.style.height = '';
bar.style.opacity = barOp.toFixed(2);
var gradientFactor = Math.max(0, Math.min(1, (pct - 0.03) / 0.02));
var bottomMix = (100 - 75 * gradientFactor).toFixed(0);
bar.style.background = 'linear-gradient(to bottom,var(--accent) 0%,var(--accent) 30%,color-mix(in oklab,var(--accent) ' + bottomMix + '%,transparent) 100%)';
var dotAppearOp;
if (pct < BALL_START_PCT) dotAppearOp = 0;
else if (pct >= BALL_FULL_AT) dotAppearOp = 1;
else dotAppearOp = (pct - BALL_START_PCT) / (BALL_FULL_AT - BALL_START_PCT);
for (var i = 0; i < 5; i++) {
var dot = dots[i];
var dotY = pct < BALL_PHASE_TRIGGER
? (leadY - i * DOT_SPACING_INIT)
: (initLead - i * DOT_SPACING_INIT) + ballPct * SPEEDS[i] * range;
dot.style.top = dotY.toFixed(1) + 'px';
var op;
var fw = FADE_WIN[i];
if (!fw) {
op = dotAppearOp;
} else if (pct < fw[0]) {
op = dotAppearOp;
} else if (pct >= fw[1]) {
op = 0;
} else {
op = dotAppearOp * (1 - (pct - fw[0]) / (fw[1] - fw[0]));
}
dot.style.opacity = Math.max(0, Math.min(1, op)).toFixed(2);
}
if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
// Sync progress vào nút back-to-top: ring + % text bên trong button.
if (btnBackTop) {
var pctRound = Math.round(pct * 100);
var ringFill = btnBackTop.querySelector('.ring-fill');
// Circle r=16 → circumference 2π*16 = 100.53. Set offset = (1 - pct) * C để đoạn fill đúng % perimeter.
if (ringFill) ringFill.style.strokeDashoffset = (100.53 * (1 - pct)).toFixed(2);
var btPctEl = btnBackTop.querySelector('.back-top-pct');
if (btPctEl) btPctEl.textContent = pctRound + '%';
}
wrap.classList.add('visible');
wrap.classList.remove('idle');
clearTimeout(_progressIdleTimer);
_progressIdleTimer = setTimeout(function () {
wrap.classList.add('idle');
}, 1500);
}
var _readingProgressThrottled = throttle(updateReadingProgress, 80);
if (scrollEl) scrollEl.addEventListener('scroll', function () {
if (!suppressBackTop) _backTopThrottled(scrollEl.scrollTop > 0);
_saveAnchorThrottled();
_saveAnchorDebounced();
_readingProgressThrottled();
}, { passive: true });
window.addEventListener('resize', updateReadingProgress);
if (btnBackTop && scrollEl) btnBackTop.onclick = function () {
suppressBackTop = true;
toggleBackTop(false);
// Suppress chunk scroll-compensation trong suốt animation. Nếu materialize/dematerialize
// mutate scrollTop trong lúc smooth-scroll chạy, browser huỷ animation → kẹt giữa đường.
// done() sẽ clear sớm khi scroll kết thúc; 8s là upper-bound safe cho sutta dài nhất.
_progScrollUntil = Date.now() + 8000;
scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
var done = function () {
_progScrollUntil = 0;
suppressBackTop = false;
toggleBackTop(false);
if (currentSutraId) {
storage.remove(KEY_ANCHOR_K(currentSutraId));
}
};
if ('onscrollend' in scrollEl) {
scrollEl.addEventListener('scrollend', done, { once: true });
} else {
var prev = -1;
var poll = function () {
var st = scrollEl.scrollTop;
if (st === 0 && st === prev) { done(); return; }
prev = st;
requestAnimationFrame(poll);
};
requestAnimationFrame(poll);
}
};
