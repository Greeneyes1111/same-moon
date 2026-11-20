"""Draws the link-preview picture (services/web/public/icons/og.png, 1200 x 630).

This is the picture LinkedIn, X, WhatsApp and Facebook show when someone shares
samemoon.world. It uses the app's own moon icon and colours. Run it again after
changing the icon or the wording:

    python3 tools/make_og.py

Needs Playwright with Chrome (pip install playwright).
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ICON = (ROOT / "services/web/public/icons/icon.svg").read_text(encoding="utf-8")
OUT = ROOT / "services/web/public/icons/og.png"

HTML = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
  * {{ box-sizing: border-box; margin: 0; }}
  html, body {{ width: 1200px; height: 630px; overflow: hidden; }}
  body {{
    background: radial-gradient(900px 520px at 50% -120px, #2d3a85 0%, #141a3d 70%), #141a3d;
    color: #f4f1ff; font-family: "DejaVu Sans", system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; position: relative;
  }}
  .star {{ position: absolute; border-radius: 50%; background: #fff6d5; }}
  .icon svg {{ width: 168px; height: 168px; display: block; filter: drop-shadow(0 10px 30px rgba(0,0,0,.35)); }}
  h1 {{ font-size: 86px; font-weight: 700; letter-spacing: .5px; margin-top: 22px; color: #ffe6a1; }}
  p {{ font-size: 36px; color: #f4f1ff; margin-top: 10px; }}
  ul {{ list-style: none; padding: 0; display: flex; gap: 14px; margin-top: 30px; }}
  li {{ background: #1d2558; border: 2px solid #36428a; border-radius: 999px;
        padding: 8px 22px; font-size: 25px; color: #b8bde3; }}
  li[lang="ar"] {{ font-size: 27px; }}
</style></head><body>
  <span class="star" style="left:96px;top:84px;width:10px;height:10px"></span>
  <span class="star" style="left:1070px;top:104px;width:8px;height:8px"></span>
  <span class="star" style="left:150px;top:572px;width:7px;height:7px"></span>
  <span class="star" style="left:1050px;top:566px;width:11px;height:11px"></span>
  <span class="star" style="left:310px;top:150px;width:5px;height:5px"></span>
  <span class="star" style="left:900px;top:178px;width:6px;height:6px"></span>
  <div class="icon">{ICON}</div>
  <h1>Same Moon</h1>
  <p>Free bedtime stories for children far from home</p>
  <ul>
    <li>Read aloud</li>
    <li>English · <span lang="ar">العربية</span> · Español</li>
    <li>Works offline</li>
    <li>No sign-up</li>
  </ul>
</body></html>"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path="/usr/bin/google-chrome") if Path("/usr/bin/google-chrome").exists() else pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.set_content(HTML)
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT), clip={"x": 0, "y": 0, "width": 1200, "height": 630})
    browser.close()

print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
