"""Runs reader.js directly on each test page and prints what it reads from every review.

  python test/make_fixture.py /tmp/fx && python test/reader_test.py /tmp/fx [chrome_path]
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FX = Path(sys.argv[1])
CHROME = sys.argv[2] if len(sys.argv) > 2 else None
READER = (ROOT / "extension" / "reader.js").read_text()

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    page = b.new_page()
    for f in ["product.html", "product_rnw.html", "reviews_2026.html"]:
        page.set_content((FX / f).read_text())
        page.add_script_tag(content=READER)
        rows = page.evaluate("""async () => {
            const first = ParakhReader.findReviews(document, true, 'r');
            await ParakhReader.expandReadMore(first.map(r => r.card));
            return ParakhReader.findReviews(document, true, 'r').map(r => [r.rating, r.title, r.text, r.date]);
        }""")
        print(f"\n== {f}: {len(rows)} reviews")
        for rating, title, text, date in rows:
            print(f"  {rating} | {title!r:28} | {date!s:13} | {text[:90]!r}")
    b.close()
