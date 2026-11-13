"""Builds Flipkart-like HTML pages (generated class names, star badges,
"Certified Buyer", READ MORE truncation) for testing the extension offline."""
import html
import json
import sys
from pathlib import Path

here = Path(__file__).parent
revs = json.load(open(here / "sample_reviews.json"))

STAR = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTUgMGwxLjUgMy41TDEwIDRsLTIuNSAyLjVMOCAxMCA1IDggMiAxMGwuNS0zLjVMMCA0bDMuNS0uNXoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" class="Rza2QY">'


def card(r, truncate=False):
    t = html.escape(r["text"])
    if truncate:
        cut = 60
        body = (f'<div class="ZmyHeo"><div><div class="" data-full="{t}">{html.escape(r["text"][:cut])}…</div>'
                f'<span class="wTYmpv" onclick="var d=this.previousElementSibling;d.textContent=d.dataset.full;this.remove()">'
                f'<span>READ MORE</span></span></div></div>')
    else:
        body = f'<div class="ZmyHeo"><div><div class="">{t}</div></div></div>'
    color = "#388e3c" if r["rating"] >= 4 else "#ff9f00" if r["rating"] == 3 else "#ff6161"
    return f'''
<div class="col EPCmJX Ma1fCG"><div class="col">
  <div class="row"><div class="XQDdHH Ga3i8K" style="background:{color};color:#fff;display:inline-block;padding:2px 6px;border-radius:3px;font-size:12px">{r["rating"]}{STAR}</div>
  <p class="z9E0IG" style="display:inline;margin-left:8px;font-weight:600">{html.escape(r["title"])}</p></div>
  <div class="row" style="margin:8px 0">{body}</div>
  <div class="row gHqwa8"><div class="row">
    <p class="_2NsDsF AwS1CA" style="color:#878787;font-size:12px">{html.escape(r["name"])}</p>
    <p class="MztJPv" style="color:#878787;font-size:12px"><span>Certified Buyer</span><span>, Kota</span></p>
    <p class="_2NsDsF" style="color:#878787;font-size:12px">{r["date"]}</p>
  </div><div class="_7SvqLd"><div class="qhmk-f"><span class="tl9VpF">12</span></div></div></div>
</div></div>'''


def page(reviews, title, link=None, truncate_ids=()):
    cards = "\n".join(f'<div class="cPHDOP col-12-12">{card(r, r["id"] in truncate_ids)}</div>' for r in reviews)
    more = f'<a href="{link}"><div class="_23J90q RcXBOT"><span>All {len(revs) + 5} reviews</span></div></a>' if link else ""
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>{title} - Buy Online | Flipkart.com</title>
<style>body{{font-family:Arial;margin:0;background:#f1f3f6}} .hdr{{background:#2874f0;color:#fff;padding:14px 24px;font-weight:bold}}
.wrap{{background:#fff;margin:16px auto;max-width:1100px;padding:24px}} .cPHDOP{{border-bottom:1px solid #f0f0f0;padding:16px 0}}</style></head>
<body><div class="hdr">Flipkart</div><div class="wrap">
<h1 class="_6EBuvT"><span class="VU-ZEz">{title}</span></h1>
<div class="Nx9bqj CxhGGd" style="font-size:28px">₹17,999</div>
<div style="margin-top:24px"><div class="_8-rIO3">Ratings &amp; Reviews</div>
{cards}
{more}</div></div></body></html>'''


def rnw_page(reviews, title):
    """Newer React-Native-Web style: nested dir=auto divs, '4 ★' text badges,
    '... more' toggles, no 'Certified Buyer' line."""
    cards = []
    for r in reviews:
        full = html.escape(r["text"])
        short = html.escape(r["text"][:70])
        cards.append(f'''
<div class="css-175oi2r r-1awozwy" style="padding:16px 0;border-bottom:1px solid #eee">
  <div class="css-175oi2r r-18u37iz"><div dir="auto" class="css-1rynq56 r-op4f77" style="font-weight:600">{r["rating"]} ★</div>
    <div dir="auto" class="css-1rynq56 r-dnmrzs" style="margin-left:8px;font-weight:600">{html.escape(r["title"])}</div></div>
  <div class="css-175oi2r"><div dir="auto" class="css-1rynq56" data-full="{full}">{short}</div>
    <div dir="auto" class="css-1rynq56 r-1loqt21" style="color:#2874f0;cursor:pointer"
      onclick="var d=this.previousElementSibling;d.textContent=d.dataset.full;this.remove()">... more</div></div>
  <div class="css-175oi2r r-18u37iz" style="color:#878787;font-size:12px">
    <div dir="auto" class="css-1rynq56">{html.escape(r["name"])}</div><div dir="auto" class="css-1rynq56" style="margin-left:10px">{r["date"]}</div></div>
</div>''')
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>{title} | Flipkart</title></head>
<body style="font-family:Arial;margin:0"><div id="container"><div class="css-175oi2r" style="max-width:900px;margin:20px auto">
<h1 dir="auto" class="css-1rynq56">{title}</h1>{"".join(cards)}</div></div></body></html>'''


NEW_REVIEWS = [
    (3, "Does the job", "Color Cloudline Blue", "Don't buy 4g phone in 2026, push ur budget upgrade to 5G phone.", "Ratnesh Kumar , Gopalganj", "4 months ago"),
    (4, "Good quality product", "Color Sunlike Orange", "Nice", "Flipkart Customer, Bengaluru", "3 months ago"),
    (5, "Just wow!", "Color Shadow Black", "Design looking advance", "Amit Singh, Patna", "2 months ago"),
    (2, "Heating problem", "Color Shadow Black",
     "Phone heats up a lot while playing BGMI. After 3 months the battery drains very fast. Service centre took 12 days to fix it.",
     "Rahul Meena, Kota", "1 month ago"),
    (1, "Worst", "Color Cloudline Blue",
     "Display stopped working after 2 months. Replacement took 15 days and the new one also has a green line on the screen. Very disappointed with the service and the build quality of this phone, would not recommend it to anyone.",
     "Sneha Gupta, Jaipur", "5 months ago"),
]


def new_page(title):
    """Flipkart review page as seen on 2026-11-12: star icons + '3.0' + '•' + title in one row,
    'Review for: …' variant line, review text, name, helpful buttons, 'Verified Purchase· 4 months ago'."""
    star = '<svg width="14" height="14"><path d="M7 0l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" fill="#388e3c"/></svg>'
    cards = []
    for rating, ttl, color, text, who, when in NEW_REVIEWS:
        t = html.escape(text)
        long = len(text) > 120
        body = (f'<div class="a1"><span class="b2" data-full="{t}">{html.escape(text[:120])}</span>'
                f'<span class="c3" style="color:#2874f0;cursor:pointer" onclick="var d=this.previousElementSibling;d.textContent=d.dataset.full;this.remove()">... more</span></div>'
                if long else f'<div class="a1"><span class="b2">{t}</span></div>')
        cards.append(f'''
<div class="x9" style="padding:18px 0;border-bottom:1px solid #eee">
  <div class="r1"><div class="s1">{star * rating}</div><div class="v1" style="color:#388e3c;font-weight:600">{rating}.0</div><div class="d1">•</div><div class="t1">{html.escape(ttl)}</div></div>
  <div class="g1" style="color:#878787"><span>Review for: </span><span>{color}</span><span> • </span><span>RAM 4 GB</span><span> • </span><span>Storage 64 GB</span></div>
  {body}
  <div class="n1" style="color:#878787">{html.escape(who)}</div>
  <div class="h1x"><button>👍 Helpful for 9</button><button>👎 1</button></div>
  <div class="vp" style="color:#878787"><span>✔</span><span>Verified Purchase</span><span>· {when}</span></div>
</div>''')
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>{title} | Flipkart</title></head>
<body style="font-family:Arial;margin:0"><div style="max-width:1000px;margin:20px auto">
<h1>{title}</h1><div><button>Most Helpful</button><button>Latest</button></div>{"".join(cards)}</div></body></html>'''


name = "Aurora X5 5G (Midnight Blue, 128 GB) (8 GB RAM)"
out = Path(sys.argv[1] if len(sys.argv) > 1 else here)
out.mkdir(parents=True, exist_ok=True)
(out / "product.html").write_text(page(revs, name, "/aurora-x5-5g/product-reviews/itm123?pid=MOB1", {"r2", "r9"}))
extra = [
    {"id": "e1", "rating": 2, "title": "Battery weak", "name": "Ravi", "date": "Sep, 2026",
     "text": "Battery drains very fast after 5 months, now it barely lasts half a day."},
    {"id": "e2", "rating": 5, "title": "Superb", "name": "Divya", "date": "Oct, 2026",
     "text": "Superb display and great camera. Perfect for photos and Instagram."},
    {"id": "e3", "rating": 1, "title": "Dead phone", "name": "Arjun", "date": "Aug, 2026",
     "text": "Phone stopped working after 6 months, motherboard issue. Service centre took 20 days."},
    {"id": "e4", "rating": 3, "title": "Ok", "name": "Meena", "date": "Oct, 2026",
     "text": "Decent phone for basic use. Speaker is average and network signal drops sometimes."},
    {"id": "e5", "rating": 2, "title": "Gaming lag", "name": "Sahil", "date": "Jul, 2026",
     "text": "BGMI lags after 20 minutes and the phone gets hot. Not good for gaming."},
]
(out / "reviews_p1.html").write_text(page(revs, name, None))
(out / "product_rnw.html").write_text(rnw_page(revs, name))
(out / "reviews_2026.html").write_text(new_page("Infinix Smart 20 (Sunlike Orange, 64 GB)"))
(out / "reviews_p2.html").write_text(page(extra, name, None))
print("written to", out)
