"""Loads the unpacked extension in Chrome, serves the fixture pages in place of
flipkart.com, opens the panel and checks it end to end against a running API.

  PARAKH_MODE=mock uvicorn app:app --port 7860     (in backend/)
  python test/make_fixture.py /tmp/fx && python test/e2e_test.py /tmp/fx out_dir
"""
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
EXT = str(ROOT / "extension")
FX = Path(sys.argv[1])
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else ".")
CHROME = sys.argv[3] if len(sys.argv) > 3 else None


def serve(route):
    url = route.request.url
    if "/product-reviews/" in url:
        f = "reviews_p2.html" if "page=2" in url else "reviews_p1.html"
    elif "/p/" in url:
        f = "product_rnw.html" if "-rnw/" in url else "product.html"
    else:
        return route.fulfill(status=404, body="")
    route.fulfill(status=200, content_type="text/html; charset=utf-8", body=(FX / f).read_text())


with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        tempfile.mkdtemp(), headless=True, executable_path=CHROME,
        args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}", "--headless=new"],
        viewport={"width": 1366, "height": 900},
    )
    ctx.route("https://www.flipkart.com/**", serve)
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(m.text))
    page.goto("https://www.flipkart.com/aurora-x5-5g/p/itm123?pid=MOB1")
    page.wait_for_selector("#parakh-root", state="attached", timeout=10000)

    page.locator("#parakh-root >> .launch").click()
    page.wait_for_selector("#parakh-root >> .verdict", timeout=20000)
    first = page.locator("#parakh-root >> .status").inner_text()
    print("FIRST  :", first)
    # it keeps reading the next pages in the background; wait until the progress line is gone
    page.wait_for_function(
        "() => !document.querySelector('#parakh-root').shadowRoot.querySelector('.progress')", timeout=30000)
    page.wait_for_timeout(300)
    status = page.locator("#parakh-root >> .status").inner_text()
    verdict = page.locator("#parakh-root >> .verdict").inner_text()
    n_hosts = page.locator(".parakh-tags-host").count()
    expanded = page.locator("text=READ MORE").count()
    print("STATUS :", status)
    print("VERDICT:", verdict)
    print("tag rows drawn:", n_hosts, "| READ MORE left:", expanded)
    page.screenshot(path=str(OUT / "panel_product_page.png"))

    # first tags row, zoomed
    page.locator(".parakh-tags-host").nth(1).scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / "tags_under_reviews.png"))

    print("more button left:", page.locator("#parakh-root >> button[data-a=more]").count())
    print("greyed aspects:", page.locator("#parakh-root >> .row.few").count())
    page.locator("#parakh-root >> .panel").screenshot(path=str(OUT / "panel_after_more.png"))

    # review anatomy: open the breakdown of review 2, click highlight 1
    page.locator(".parakh-tags-host").nth(1).locator("button.bd").click()
    page.wait_for_selector("#parakh-root >> .rv", timeout=5000)
    marks = page.locator("#parakh-root >> .rv mark").count()
    fields = page.locator("#parakh-root >> .fi").count()
    nospan = page.locator("#parakh-root >> .fi.nospan").count()
    page.locator("#parakh-root >> .rv mark").first.click()
    on = page.locator("#parakh-root >> .on").count()
    print(f"anatomy: {marks} highlights, {fields} fields ({nospan} without a quote), linked on click: {on}")
    page.locator("#parakh-root >> .panel").screenshot(path=str(OUT / "anatomy.png"))
    page.locator("#parakh-root >> .back").click()
    print("back to summary:", page.locator("#parakh-root >> .verdict").count() == 1)

    # "Reviews read" list: every review, including ones read from other pages, has a Breakdown
    page.locator("#parakh-root >> details.rlist summary").click()
    n_list = page.locator("#parakh-root >> .rl").count()
    n_other = page.locator("#parakh-root >> .rl .off").count()
    page.locator("#parakh-root >> .rl:has(.off) button.bd2").first.click()
    page.wait_for_selector("#parakh-root >> .rv", timeout=5000)
    print(f"list: {n_list} reviews ({n_other} from other pages); breakdown of an other-page review opens:",
          page.locator("#parakh-root >> .rv").count() == 1)
    page.locator("#parakh-root >> .back").click()

    # infinite scroll: Flipkart adds a review card after the panel opened -> it gets tags + Breakdown
    before = page.locator(".parakh-tags-host").count()
    page.evaluate("""() => {
        const cards = document.querySelectorAll('.cPHDOP');
        const c = cards[cards.length - 1].cloneNode(true);
        c.querySelectorAll('.parakh-tags-host').forEach(n => n.remove());
        c.querySelector('.ZmyHeo div div').textContent =
            'Scrolled in later: the speaker crackles at full volume after 2 months and the charger heats up.';
        cards[cards.length - 1].after(c);
    }""")
    page.wait_for_timeout(4000)
    print("tag rows before/after a card is added:", before, "->", page.locator(".parakh-tags-host").count(),
          "| status:", page.locator("#parakh-root >> .status").inner_text())

    # newer React-Native-Web style layout: no "Certified Buyer", "4 ★" badges, "... more"
    page2 = ctx.new_page()
    page2.goto("https://www.flipkart.com/aurora-rnw/p/itm999?pid=MOB2")
    page2.wait_for_selector("#parakh-root", state="attached", timeout=10000)
    page2.locator("#parakh-root >> .launch").click()
    page2.wait_for_selector("#parakh-root >> .verdict", timeout=20000)
    print("RNW STATUS :", page2.locator("#parakh-root >> .status").inner_text())
    print("RNW VERDICT:", page2.locator("#parakh-root >> .verdict").inner_text())
    print("RNW tag rows:", page2.locator(".parakh-tags-host").count(), "| '... more' left:", page2.locator("text=... more").count())
    page2.screenshot(path=str(OUT / "panel_rnw_layout.png"))
    if logs:
        print("console:", logs[:10])
    ctx.close()
