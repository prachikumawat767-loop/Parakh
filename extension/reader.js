// Reads review cards from a Flipkart page.
// Flipkart's class names are generated and change often, so nothing here uses them.
// Flipkart serves two review layouts (classic, and a newer React Native Web build).
// Anchor: each review card shows "Certified Buyer" / "Verified Purchase" exactly once;
// if a page has none of those, each card's date ("3 months ago", "Aug, 2026") is used instead.
(() => {
  const BUYER = /^(certified buyer|verified purchase)/i;
  const DATE_ONLY = /^(\d+\s+(days?|months?|years?)\s+ago|[A-Z][a-z]{2},\s\d{4})$/;
  let MARKER = BUYER;
  const RATING = /^[1-5](\.0)?\s*[★•·]?$/;
  const RATING_TITLE = /^([1-5])(\.0)?\s*[★]?\s*[•·]\s*(.{2,80})$/; // "3.0 • Does the job" in one piece
  const MORE = /^(read more|more|… more|\.\.\. more)$/i;
  const META = /^(read more|read less|more|less|permalink|report abuse|helpful|\d+\s*(days?|months?|years?)\s+ago)$/i;
  // lines that are never the review text: "Review for: Color … • RAM …", "Helpful for 161", counts, separators, stars
  const SKIP = /^(review for\b|helpful for\b|\d+$|[•·|,★☆\s]+$)/i;
  const DATE = /(\d+\s+(?:days?|months?|years?)\s+ago|[A-Z][a-z]{2},\s\d{4})/;

  const ownText = (el) =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join("")
      .trim();

  // innerText keeps line breaks on a live page; parsed (fetched) pages only have textContent
  const textOf = (el, live) => ((live ? el.innerText : el.textContent) || "").replace(/\s+\n/g, "\n").trim();

  function markers(root) {
    const els = Array.from(root.querySelectorAll("span, p, div"));
    MARKER = BUYER;
    let found = els.filter((el) => BUYER.test(ownText(el)));
    if (!found.length) {
      MARKER = DATE_ONLY;
      found = els.filter((el) => DATE_ONLY.test(ownText(el)));
    }
    return found;
  }

  // Highest ancestor that still holds exactly one "Certified Buyer" and stays review-sized.
  function cardFor(marker, all) {
    let el = marker;
    while (el.parentElement && el.parentElement.tagName !== "BODY") {
      const p = el.parentElement;
      if (all.filter((m) => p.contains(m)).length > 1) break;
      if ((p.textContent || "").length > 4500) break;
      el = p;
    }
    return el;
  }

  const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && !a.contains(b);

  // Every layout seen so far has the same order inside a card:
  //   rating + title  ->  (optional "Review for: variant")  ->  review text  ->  name / helpful / buyer line
  // So the review text is the first real text after the title, not the longest block
  // (short reviews like "Nice" are shorter than the name or the variant line).
  function readCard(card, live) {
    const els = Array.from(card.querySelectorAll("div, span, p"));
    const marker = els.find((el) => MARKER.test(ownText(el)));
    // innermost "Review for: …" blocks; their pieces are skipped
    const variantBlocks = els.filter((el) => {
      const t = textOf(el, false);
      return /^review for\b/i.test(t) && t.length < 150;
    });
    const isText = (el) => {
      const t = ownText(el);
      return t && !META.test(t) && !SKIP.test(t) && !MORE.test(t) && !MARKER.test(t)
        && !variantBlocks.some((v) => v.contains(el))
        && !(marker && (el.contains(marker) || marker.contains(el)));
    };
    const leaves = els.filter((el) => ownText(el));

    let rating = null, title = null, ratingEl = null, titleEl = null;
    ratingEl = leaves.find((el) => RATING.test(ownText(el)));
    if (ratingEl) {
      rating = parseFloat(ownText(ratingEl));
      // title = first real text after the rating, in the same row (or one level up, if that
      // level is still only the header: no variant line, no buyer line)
      for (let row = ratingEl.parentElement, up = 0; row && up < 2 && !titleEl; row = row.parentElement, up++) {
        if (row === card || (marker && row.contains(marker)) || variantBlocks.some((v) => row.contains(v))) break;
        titleEl = leaves.find((el) => after(ratingEl, el) && row.contains(el) && isText(el)) || null;
      }
      if (titleEl) title = textOf(titleEl, live);
      if (title && title.length > 80) { title = null; titleEl = null; }
    } else {
      ratingEl = leaves.find((el) => RATING_TITLE.test(ownText(el)));
      if (ratingEl) {
        const m = ownText(ratingEl).match(RATING_TITLE);
        rating = parseFloat(m[1]);
        title = m[3].trim();
        titleEl = ratingEl;
      }
    }

    const start = titleEl || ratingEl;
    const bodyEl = leaves.find((el) => (!start || after(start, el)) && isText(el)) || null;
    let text = bodyEl ? textOf(bodyEl, live) : "";
    text = text.replace(/\s*(READ MORE|READ LESS|…\s*more|\.\.\.\s*more)\s*$/i, "").trim();
    text = text.replace(/^[.,;:\-–\s]+/, ""); // some reviews start with ". "
    if (title && text.startsWith(title)) text = text.slice(title.length).trim();
    // very short reviews ("Nice") carry their meaning in the title
    if (text.length < 15 && title) text = (title + ". " + text).replace(/\.\s*$/, "").trim() + ".";

    const dm = (card.textContent || "").match(DATE);
    return { rating, title, text, date: dm ? dm[1] : null, bodyEl };
  }

  function findReviews(root = document, live = true, idPrefix = "r") {
    const all = markers(root);
    const seen = new Set();
    const out = [];
    for (const m of all) {
      const card = cardFor(m, all);
      if (seen.has(card)) continue;
      seen.add(card);
      const r = readCard(card, live);
      if (r.text.replace(/[^\p{L}\p{N}]/gu, "").length < 3) continue;
      r.id = `${idPrefix}${out.length + 1}`;
      r.card = card;
      out.push(r);
    }
    return out;
  }

  // Flipkart truncates long reviews behind "READ MORE"; clicking expands in place.
  async function expandReadMore(cards) {
    let clicked = 0;
    for (const c of cards) {
      for (const el of c.querySelectorAll("span, div, a")) {
        if (MORE.test(ownText(el))) {
          el.click();
          clicked++;
        }
      }
    }
    if (clicked) await new Promise((r) => setTimeout(r, 400));
    return clicked;
  }

  function productName() {
    const h1 = document.querySelector("h1");
    const t = h1 ? h1.innerText.trim() : "";
    return t || document.title.split(/[-|]/)[0].trim();
  }

  // URL of the next page of reviews (same site, user-triggered, capped by the caller).
  function nextReviewsUrl(currentUrl) {
    const u = new URL(currentUrl || location.href);
    if (u.pathname.includes("/product-reviews/")) {
      const p = parseInt(u.searchParams.get("page") || "1", 10);
      u.searchParams.set("page", String(p + 1));
      return u.toString();
    }
    const a = document.querySelector('a[href*="/product-reviews/"]');
    return a ? new URL(a.getAttribute("href"), location.origin).toString() : null;
  }

  async function fetchReviews(url, idPrefix) {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) return [];
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    return findReviews(doc, false, idPrefix).map(({ card, bodyEl, ...rest }) => rest);
  }

  window.ParakhReader = { findReviews, expandReadMore, productName, nextReviewsUrl, fetchReviews };
})();
