"""
Build a static, pre-rendered HTML for one sutta.
Usage: python build-static-sutta.py sn22_v1
Output: <id>.html (e.g. sn22_v1.html) in the project root.

This bypasses the JS render pipeline entirely — browser just stream-parses HTML.
For benchmarking against the dynamic loader's render time on long suttas.
"""
import json
import re
import sys
import html as htmlmod
from pathlib import Path

ROOT = Path(__file__).parent
SUTTA_DIR = ROOT / "sutta"


def parse_bilara_js(path: Path) -> dict:
    """Read a sutta data file and extract the lang dict via brace-counting.

    Regex backtracks too hard on 500KB files; brace-count is linear time.
    """
    src = path.read_text(encoding="utf-8")
    m = re.search(r'\["(?:pli|en|vi)"\]\s*=\s*\{', src)
    if not m:
        raise ValueError(f"Could not locate dict opening in {path}")
    pos = m.end() - 1  # position of `{`
    depth, i = 0, pos
    in_str, escape = False, False
    end = -1
    while i < len(src):
        c = src[i]
        if escape:
            escape = False
        elif in_str:
            if c == "\\":
                escape = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
        i += 1
    if end < 0:
        raise ValueError(f"Unbalanced braces in {path}")
    return json.loads(src[pos:end])


def build_html(sutta_id: str) -> str:
    pli = parse_bilara_js(SUTTA_DIR / "pli" / f"{sutta_id}.js")
    eng = parse_bilara_js(SUTTA_DIR / "en" / f"{sutta_id}.js")
    vie = parse_bilara_js(SUTTA_DIR / "vi" / f"{sutta_id}.js")

    keys = sorted(set(list(pli.keys()) + list(eng.keys()) + list(vie.keys())),
                  key=lambda k: [int(p) if p.isdigit() else p
                                 for p in re.split(r'(\d+)', k)])

    rows_html = []
    for k in keys:
        tp = (pli.get(k) or "").strip()
        te = (eng.get(k) or "").strip()
        tv = (vie.get(k) or "").strip()
        if not (tp or te or tv):
            continue

        classes = ["sutra-row-wrap"]
        # Subtitle markers — :0.1, :0.2, :0.3
        if re.search(r":0\.[123]$", k):
            classes.append("is-subtitle")
        # Section number heuristic
        if max(len(tp), len(te), len(tv)) <= 6 and re.match(
            r"^[IVXLCDM]+\.?$|^\d+\.?$", tp or te or tv
        ):
            classes.append("is-section-num")

        # Short key for display: "SN22.1:1.1"
        if ":" in k:
            prefix, suffix = k.split(":", 1)
            short = re.sub(r"([a-zA-Z]+)", lambda m: m.group(1).upper(), prefix)
            short = f"{short}.{suffix}" if suffix else short
        else:
            short = k.upper()

        seg_key_html = (
            f'<div class="sutra-seg-keywrap"><div class="sutra-seg-key" '
            f'aria-hidden="true">{htmlmod.escape(short)}</div></div>'
        )

        cols = []
        if tp:
            cols.append(
                f'<div class="sutra-col pali-col"><div class="sutra-col-header">'
                f'<span class="sutra-col-header-label">PĀLI</span></div>'
                f'<div class="sutra-col-body"><div class="pali">{htmlmod.escape(tp)}</div></div></div>'
            )
        if te:
            cols.append(
                f'<div class="sutra-col eng-col"><div class="sutra-col-header">'
                f'<span class="sutra-col-header-label">ENGLISH</span></div>'
                f'<div class="sutra-col-body"><div class="eng">{htmlmod.escape(te)}</div></div></div>'
            )
        if tv:
            cols.append(
                f'<div class="sutra-col vie-col"><div class="sutra-col-header">'
                f'<span class="sutra-col-header-label">TIẾNG VIỆT</span></div>'
                f'<div class="sutra-col-body"><div class="vie">{htmlmod.escape(tv)}</div></div></div>'
            )

        row_html = (
            f'<div class="{" ".join(classes)}" data-key="{htmlmod.escape(k)}">'
            f'{seg_key_html if "is-subtitle" not in classes else ""}'
            f'<div class="sutra-row" data-key="{htmlmod.escape(k)}">{"".join(cols)}</div>'
            f'</div>'
        )
        rows_html.append(row_html)

    title_pli = pli.get(f"{sutta_id.split('_')[0]}.1:0.2") or sutta_id
    title_vi = vie.get(f"{sutta_id.split('_')[0]}.1:0.2") or sutta_id

    # Override layout via separate sutta-static.css (loaded AFTER styles.css).
    # Settings logic in sutta-static.js.
    # Keep .card wrapper for selectors like `.card:not(.stack) #sutraGrid:not(...)`.
    return f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{htmlmod.escape(sutta_id)} — static</title>
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="sutta-static.css?v=3">
</head>
<body>

<div class="card">
<header class="static-header">
  <h1>{htmlmod.escape(title_vi)}</h1>
  <div class="meta">{htmlmod.escape(title_pli)}</div>
</header>
<div id="sutraGrid">
{chr(10).join(rows_html)}
</div>
</div>

<button id="ss-toggle" type="button" aria-label="Settings">⚙</button>
<div id="ss-panel">
  <h4>Ngôn ngữ</h4>
  <div class="ss-pills">
    <button type="button" class="ss-pill" data-toggle-grid="hide-pali" data-checked-when="off">Pāli</button>
    <button type="button" class="ss-pill" data-toggle-grid="hide-eng"  data-checked-when="off">English</button>
    <button type="button" class="ss-pill" data-toggle-grid="hide-vie"  data-checked-when="off">Tiếng Việt</button>
  </div>

  <h4>Hiển thị</h4>
  <div class="ss-pills">
    <button type="button" class="ss-pill" data-toggle-grid="hide-seg-key"    data-checked-when="off">Mã đoạn</button>
    <button type="button" class="ss-pill" data-toggle-grid="hide-col-header" data-checked-when="off">Tiêu đề cột</button>
  </div>

  <h4>Bố cục</h4>
  <div class="ss-pills">
    <button type="button" class="ss-pill" data-toggle-card="stack"      data-checked-when="on">Xếp dọc</button>
    <button type="button" class="ss-pill" data-toggle-card="grid-3cols" data-checked-when="on">3 cột</button>
  </div>

  <h4>Giao diện</h4>
  <div class="ss-pills">
    <button type="button" class="ss-pill" id="ss-dark">Dark mode</button>
  </div>

  <h4>Cỡ chữ</h4>
  <div class="ss-row">
    <input type="range" id="ss-font" min="0.7" max="1.6" step="0.05" value="1">
    <span class="ss-val" id="ss-font-val">1.00</span>
  </div>

  <h4>Giãn dòng</h4>
  <div class="ss-row">
    <input type="range" id="ss-lh" min="1.3" max="2.2" step="0.05" value="1.75">
    <span class="ss-val" id="ss-lh-val">1.75</span>
  </div>
</div>

<script src="sutta-static.js?v=3" defer></script>

</body>
</html>
"""


def main():
    sutta_id = sys.argv[1] if len(sys.argv) > 1 else "sn22_v1"
    out = ROOT / f"{sutta_id}.html"
    out.write_text(build_html(sutta_id), encoding="utf-8")
    size_kb = out.stat().st_size / 1024
    print(f"Wrote {out.name}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
