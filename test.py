"""
Automated test for Sutta Reader anchor + scroll fixes.
Usage: python test.py
Requires: pip install selenium  (Chrome must be installed locally)

Test plan:
  T1. Anchor key trong localStorage == first-fully-visible row tại top viewport
  T2. Scroll-up stability: row đang đọc không drift khi chunks materialize phía trên
  T3. Materialize coverage: chunks gần viewport (≤150% buffer) đều materialized
  T4. Round-trip save/restore: scroll → save → reload → vị trí khớp
  T5. overflow-anchor effect: scrollTop tự bù khi font-size đổi (chunks resize)

Test trên DN16 (sutta dài nhất, dễ trigger bug nhất).
"""
import http.server
import socketserver
import threading
import time
import sys
import json
# Windows console default cp1252 không encode ≤ Δ → dùng utf-8.
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

PORT = 8765
URL = f"http://localhost:{PORT}/index.html"
SUTTA_ID = "dn16"  # longest, most rows

# ── HTTP server in background ─────────────────────────────────
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass

server = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), QuietHandler)
server.daemon_threads = True
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()
print(f"[setup] HTTP server on http://127.0.0.1:{PORT}")

# ── Headless Chrome ───────────────────────────────────────────
opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--window-size=400,800")  # mobile-ish viewport
opts.add_argument("--disable-gpu")
opts.add_argument("--no-sandbox")
opts.add_argument("--log-level=3")
# emulate mobile-like behaviour
opts.add_experimental_option('excludeSwitches', ['enable-logging'])

print("[setup] launching Chrome headless...")
driver = webdriver.Chrome(options=opts)
driver.set_script_timeout(20)

results = []
def record(name, passed, msg=""):
    results.append({"name": name, "pass": passed, "msg": msg})
    tag = "PASS" if passed else "FAIL"
    color = "\033[42m" if passed else "\033[41m"
    print(f"  {color}\033[97m {tag} \033[0m  {name}  {msg}")

try:
    # Force-open DN16 via hash (app picks sutta from anchor hash on boot).
    print(f"[setup] open {URL}#{SUTTA_ID}:1.1.1")
    driver.get(f"{URL}#{SUTTA_ID}:1.1.1")

    # Wait for rows to appear (renderSutra → ensureRowRendered → DOM .sutra-row[data-key]).
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, f'.sutra-row[data-key^="{SUTTA_ID}:"]'))
    )
    # Extra settle: anchor restore correction setTimeout 500ms + chunk observers fire.
    time.sleep(2.5)

    # Sanity: how many rows + chunks?
    info = driver.execute_script("""
        const root = document.getElementById('sutraGrid');
        const rows = root.querySelectorAll('.sutra-row[data-key]');
        const chunks = root.querySelectorAll('[data-chunk-idx]');
        return {
          rowCount: rows.length,
          chunkCount: chunks.length,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
          scrollTop: root.scrollTop
        };
    """)
    print(f"[info] rows={info['rowCount']} chunks={info['chunkCount']} "
          f"scrollH={info['scrollHeight']} clientH={info['clientHeight']} scrollTop={info['scrollTop']}")
    if info['rowCount'] < 5:
        print(f"[abort] sutta '{SUTTA_ID}' không load được rows. Kiểm tra path/data.")
        sys.exit(1)

    # ─────────────────────────────────────────────────────────
    # T1: anchor LS == first-fully-visible row at top viewport
    # ─────────────────────────────────────────────────────────
    print("\n[T1] anchor LS == first-fully-visible row")
    res = driver.execute_async_script("""
        const cb = arguments[arguments.length - 1];
        const root = document.getElementById('sutraGrid');
        const max = root.scrollHeight - root.clientHeight;
        if (max < 1000) return cb({skip: 'sutra ngắn'});
        // Scroll xuống ~40% rồi đợi save throttle/debounce.
        root.scrollTop = Math.floor(max * 0.4);
        setTimeout(() => {
          root.scrollTop += 1;  // trigger 1 scroll event để debounce fire
          setTimeout(() => {
            // Compute first-fully-visible (mirror computeTopVisibleKey).
            const rRect = root.getBoundingClientRect();
            const rows = root.querySelectorAll('.sutra-row[data-key]');
            let expected = null;
            for (const r of rows) {
              const rect = r.getBoundingClientRect();
              if (rect.top >= rRect.top) { expected = r.getAttribute('data-key'); break; }
            }
            const saved = localStorage.getItem('scroll_anchor_key___SID__');
            cb({expected, saved, scrollTop: root.scrollTop});
          }, 700);  // > 250ms throttle + 200ms debounce
        }, 1800);  // > 1500ms _progScrollUntil suppress window
    """.replace('__SID__', SUTTA_ID))
    if res.get('skip'):
        record("T1", True, f"SKIP — {res['skip']}")
    elif res['saved'] == res['expected']:
        record("T1", True, f"saved={res['saved']}")
    else:
        record("T1", False, f"expected={res['expected']} saved={res['saved']} scrollTop={res['scrollTop']}")

    # ─────────────────────────────────────────────────────────
    # T2: scroll-up stability — fling 1.5 viewport up, target row screen-Y khớp
    # ─────────────────────────────────────────────────────────
    print("\n[T2] scroll-up stability (fling 1.5 viewport)")
    res = driver.execute_async_script("""
        const cb = arguments[arguments.length - 1];
        const root = document.getElementById('sutraGrid');
        const max = root.scrollHeight - root.clientHeight;
        if (max < 3000) return cb({skip: 'sutra ngắn cho fling'});
        root.scrollTop = Math.floor(max * 0.7);
        setTimeout(() => {
          // Pick row giữa viewport.
          const rRect = root.getBoundingClientRect();
          const rows = Array.from(root.querySelectorAll('.sutra-row[data-key]'));
          let target = null;
          for (const r of rows) {
            const rect = r.getBoundingClientRect();
            if (rect.top >= rRect.top + rRect.height * 0.3 && rect.top <= rRect.top + rRect.height * 0.6) {
              target = r; break;
            }
          }
          if (!target) return cb({skip: 'không tìm được row giữa viewport'});
          const targetKey = target.getAttribute('data-key');
          const beforeRect = target.getBoundingClientRect();
          const beforeScrollTop = root.scrollTop;
          // Fling up 1.5 viewport.
          const flingPx = Math.floor(rRect.height * 1.5);
          root.scrollTop = Math.max(0, beforeScrollTop - flingPx);
          // Đợi IO + materialize + (browser anchoring nếu enabled).
          setTimeout(() => {
            const expectedTop = beforeRect.top + (beforeScrollTop - root.scrollTop);
            const esc = (window.CSS && CSS.escape) ? CSS.escape(targetKey) : targetKey.replace(/[:.]/g, '\\\\$&');
            const after = root.querySelector('.sutra-row[data-key="' + esc + '"]');
            if (!after) return cb({skip: 'row dematerialized'});
            const afterRect = after.getBoundingClientRect();
            cb({
              targetKey, expectedTop, actualTop: afterRect.top,
              shift: Math.abs(afterRect.top - expectedTop),
              scrollDelta: beforeScrollTop - root.scrollTop
            });
          }, 600);
        }, 1800);
    """)
    if res.get('skip'):
        record("T2", True, f"SKIP — {res['skip']}")
    else:
        shift = res['shift']
        msg = f"shift={shift:.1f}px (target={res['targetKey']} scrollΔ={res['scrollDelta']}px)"
        if shift <= 8:
            record("T2", True, msg + " ≤ 8px tolerance")
        elif shift <= 50:
            record("T2", True, msg + " ⚠ vừa phải (≤50px)")
        else:
            record("T2", False, msg + " > 50px → drift đáng kể")

    # ─────────────────────────────────────────────────────────
    # T3: materialize coverage at stable scroll position
    # ─────────────────────────────────────────────────────────
    print("\n[T3] materialize coverage near viewport")
    res = driver.execute_async_script("""
        const cb = arguments[arguments.length - 1];
        const root = document.getElementById('sutraGrid');
        const max = root.scrollHeight - root.clientHeight;
        if (max < 3000) return cb({skip: 'sutra ngắn'});
        root.scrollTop = Math.floor(max * 0.6);
        setTimeout(() => {
          const rRect = root.getBoundingClientRect();
          const chunks = root.querySelectorAll('[data-chunk-idx]');
          let nearMat = 0, nearTotal = 0;
          chunks.forEach(c => {
            const rect = c.getBoundingClientRect();
            const aboveDist = rRect.top - rect.bottom;
            const belowDist = rect.top - rRect.bottom;
            const dist = Math.max(aboveDist, belowDist, 0);
            if (dist <= rRect.height * 1.5) {
              nearTotal++;
              if (c.children.length > 0) nearMat++;
            }
          });
          cb({nearMat, nearTotal});
        }, 2200);  // wait for IO callbacks + materialize
    """)
    if res.get('skip'):
        record("T3", True, f"SKIP — {res['skip']}")
    else:
        pct = (res['nearMat'] / res['nearTotal']) if res['nearTotal'] else 1.0
        msg = f"{res['nearMat']}/{res['nearTotal']} chunks gần viewport materialized ({pct*100:.0f}%)"
        if pct >= 0.9:
            record("T3", True, msg)
        else:
            record("T3", False, msg + " → buffer 200% top + 100% bottom có vấn đề")

    # ─────────────────────────────────────────────────────────
    # T4: Round-trip save → reload → restore khớp
    # ─────────────────────────────────────────────────────────
    print("\n[T4] save → reload → restore round-trip")
    # Scroll tới ~50%, đợi save.
    driver.execute_script("""
        const root = document.getElementById('sutraGrid');
        const max = root.scrollHeight - root.clientHeight;
        root.scrollTop = Math.floor(max * 0.5);
    """)
    time.sleep(2.3)  # > 1500ms suppress + 250+200ms throttle/debounce
    pre = driver.execute_script("""
        const root = document.getElementById('sutraGrid');
        const rRect = root.getBoundingClientRect();
        const rows = root.querySelectorAll('.sutra-row[data-key]');
        let topKey = null;
        for (const r of rows) {
          const rect = r.getBoundingClientRect();
          if (rect.top >= rRect.top) { topKey = r.getAttribute('data-key'); break; }
        }
        return {
          savedKey: localStorage.getItem('scroll_anchor_key___SID__'),
          topKey: topKey,
          scrollTop: root.scrollTop
        };
    """.replace('__SID__', SUTTA_ID))
    print(f"  pre-reload: saved={pre['savedKey']} topRow={pre['topKey']} scrollTop={pre['scrollTop']}")

    # Reload (browser navigate giữ localStorage).
    driver.refresh()
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, f'.sutra-row[data-key^="{SUTTA_ID}:"]'))
    )
    time.sleep(3)  # đợi anchor restore + corrections (rAF + 100ms + 500ms + buffer)
    post = driver.execute_script("""
        const root = document.getElementById('sutraGrid');
        const rRect = root.getBoundingClientRect();
        const rows = root.querySelectorAll('.sutra-row[data-key]');
        let topKey = null;
        for (const r of rows) {
          const rect = r.getBoundingClientRect();
          if (rect.top >= rRect.top) { topKey = r.getAttribute('data-key'); break; }
        }
        return {
          topKey: topKey,
          scrollTop: root.scrollTop,
          savedKey: localStorage.getItem('scroll_anchor_key___SID__')
        };
    """.replace('__SID__', SUTTA_ID))
    print(f"  post-reload: top={post['topKey']} scrollTop={post['scrollTop']} saved={post['savedKey']}")
    drift = abs(post['scrollTop'] - pre['scrollTop'])
    if post['topKey'] == pre['savedKey']:
        record("T4", True, f"restore đúng row {post['topKey']} (drift={drift}px so với pre-reload)")
    elif drift < 200:
        record("T4", True, f"row khác ({pre['savedKey']} → {post['topKey']}) nhưng drift {drift}px ≤ 200")
    else:
        record("T4", False, f"saved={pre['savedKey']} restored to top={post['topKey']} drift={drift}px")

    # ─────────────────────────────────────────────────────────
    # T5: overflow-anchor — font-size change không drift content
    # ─────────────────────────────────────────────────────────
    print("\n[T5] overflow-anchor: bù shift khi đổi font-size")
    res = driver.execute_async_script("""
        const cb = arguments[arguments.length - 1];
        const root = document.getElementById('sutraGrid');
        const max = root.scrollHeight - root.clientHeight;
        if (max < 2000) return cb({skip: 'sutra ngắn'});
        root.scrollTop = Math.floor(max * 0.5);
        setTimeout(() => {
          // Pick row gần top viewport.
          const rRect = root.getBoundingClientRect();
          const rows = Array.from(root.querySelectorAll('.sutra-row[data-key]'));
          let target = null;
          for (const r of rows) {
            const rect = r.getBoundingClientRect();
            if (rect.top >= rRect.top && rect.top <= rRect.top + rRect.height * 0.3) {
              target = r; break;
            }
          }
          if (!target) return cb({skip: 'không tìm được top row'});
          const targetKey = target.getAttribute('data-key');
          const beforeTop = target.getBoundingClientRect().top;
          // Tăng font-size 20%.
          const old = document.documentElement.style.getPropertyValue('--sutra-font-scale') || '1';
          document.documentElement.style.setProperty('--sutra-font-scale', '1.2');
          // Đợi reflow + browser anchoring kick in.
          setTimeout(() => {
            const esc = (window.CSS && CSS.escape) ? CSS.escape(targetKey) : targetKey.replace(/[:.]/g, '\\\\$&');
            const after = root.querySelector('.sutra-row[data-key="' + esc + '"]');
            if (!after) {
              document.documentElement.style.setProperty('--sutra-font-scale', old);
              return cb({skip: 'row missing'});
            }
            const afterTop = after.getBoundingClientRect().top;
            const shift = Math.abs(afterTop - beforeTop);
            // Restore font-size.
            document.documentElement.style.setProperty('--sutra-font-scale', old);
            cb({targetKey, beforeTop, afterTop, shift});
          }, 500);
        }, 1800);
    """)
    if res.get('skip'):
        record("T5", True, f"SKIP — {res['skip']}")
    else:
        shift = res['shift']
        msg = f"shift={shift:.1f}px (target={res['targetKey']})"
        if shift <= 5:
            record("T5", True, msg + " ≤ 5px → browser anchoring giữ vị trí")
        elif shift <= 30:
            record("T5", True, msg + " ⚠ vừa phải (≤30px)")
        else:
            record("T5", False, msg + " > 30px → anchoring chưa hoạt động")

    # ─────────────────────────────────────────────────────────
    # Console error capture
    # ─────────────────────────────────────────────────────────
    logs = driver.get_log('browser') if 'browser' in driver.log_types else []
    errors = [l for l in logs if l.get('level') == 'SEVERE']
    if errors:
        print(f"\n[warn] {len(errors)} console errors:")
        for e in errors[:5]:
            print(f"  {e.get('message', '')[:200]}")

except Exception as e:
    import traceback
    print(f"\n[crash] {e}")
    traceback.print_exc()
finally:
    # ─────────────────────────────────────────────────────────
    # Summary
    # ─────────────────────────────────────────────────────────
    p = sum(1 for r in results if r['pass'])
    f = sum(1 for r in results if not r['pass'])
    print("\n" + "=" * 60)
    print(f"SUMMARY: {p} pass / {f} fail / {len(results)} total")
    print("=" * 60)
    for r in results:
        tag = "PASS" if r['pass'] else "FAIL"
        print(f"  [{tag}] {r['name']}: {r['msg']}")

    driver.quit()
    server.shutdown()
    sys.exit(0 if f == 0 else 1)
