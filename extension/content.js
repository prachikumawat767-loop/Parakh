// Wires reader + panel + API together on Flipkart pages.
//
// Sampling: when the panel opens it analyses the reviews on screen, then keeps reading
// the next review pages in the background (one page at a time, short pause between
// pages) until about AUTO_TARGET reviews; "Read more reviews" goes up to MAX_REVIEWS.
// The panel updates after every page. Only the phone being viewed is read, and only
// while the panel is open.
(() => {
  const R = window.ParakhReader, P = window.ParakhPanel;
  const AUTO_TARGET = 50, MORE_STEP = 30, MAX_REVIEWS = 100, MAX_PAGES = 12, PAUSE_MS = 600;
  const isReviewPage = () => /\/p\/|\/product-reviews\//.test(location.pathname);

  let panel = null;
  let st = { live: [], extra: [], pages: 1, nextUrl: null, url: null, hist: null, totals: null, last: null,
    run: 0, busy: false, byId: {}, seq: 0 };

  const api = (path, body) =>
    new Promise((resolve) => chrome.runtime.sendMessage({ type: "parakh-api", path, body }, resolve));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const all = () => [...st.live, ...st.extra].slice(0, MAX_REVIEWS);

  async function analyse(progress) {
    const reviews = all();
    if (!reviews.length) {
      panel.error("No reviews found on this page. Scroll down to the reviews, or open “All reviews”, then press the Parakh tab again.", "");
      return false;
    }
    if (!st.last) panel.loading(`Reading ${reviews.length} reviews…`);
    const resp = await api("/v1/analyze", {
      product: R.productName(),
      url: location.href,
      reviews: reviews.map((r) => ({ id: r.id, text: r.text, rating: r.rating })),
      star_histogram: st.hist,
      total_reviews: st.totals ? st.totals.reviews : null,
    });
    if (!resp || !resp.ok) {
      panel.error(resp ? resp.error : "Extension background not responding.", resp && resp.base);
      return false;
    }
    st.byId = Object.fromEntries(resp.data.reviews.map((r) => [r.id, r]));
    tagLive();
    st.last = resp.data;
    showSummary(progress);
    return true;
  }

  // tags + "Breakdown ›" under every review card on screen that doesn't have them yet
  function tagLive() {
    for (const r of st.live) {
      const out = st.byId[r.id];
      if (out && (!r.tagged || !r.card.isConnected)) {
        P.drawTags(r.card, r.bodyEl, out.tags, () => panel.showAnatomy(r, out), out.extraction);
        r.tagged = true;
      }
    }
  }

  function showSummary(progress) {
    if (!st.last || panel.mode === "anatomy") return; // don't pull the user out of a breakdown
    panel.render(st.last, {
      pages: st.pages,
      progress: progress || null,
      canLoadMore: !st.busy && !!st.nextUrl && st.pages < MAX_PAGES && all().length < MAX_REVIEWS,
      // every review read (on screen + background pages), for the "Reviews read" list
      reviews: all().map((r) => ({ review: r, out: st.byId[r.id], onScreen: st.live.includes(r) }))
        .filter((x) => x.out),
    });
  }

  // Flipkart adds review cards as you scroll (and sometimes re-draws old ones). Pick them up,
  // analyse the new ones (earlier ones come back from the server cache) and tag them.
  let watchTimer = null;
  async function onPageChanged() {
    if (!st.url || st.url !== location.href || !st.last) return;
    const found = R.findReviews(document, true, "r");
    const byText = new Map(st.live.map((r) => [r.text, r]));
    const fresh = [];
    for (const f of found) {
      const old = byText.get(f.text);
      if (old) {
        if (old.card !== f.card) { old.card = f.card; old.bodyEl = f.bodyEl; old.tagged = false; } // re-drawn card
      } else fresh.push(f);
    }
    if (fresh.length) {
      await R.expandReadMore(fresh.map((f) => f.card));
      const again = R.findReviews(document, true, "r");
      for (const f of again) {
        if (byText.has(f.text) || !fresh.some((x) => x.card === f.card)) continue;
        f.id = `s${++st.seq}`;
        st.live.push(f);
        byText.set(f.text, f);
      }
      // a review we already read in the background is now on screen: count it once
      st.extra = st.extra.filter((r) => !byText.has(r.text));
      await analyse(st.busy ? `Reading more reviews… ${all().length} so far` : null);
    } else {
      tagLive();
    }
  }
  const observer = new MutationObserver((muts) => {
    // ignore our own tag rows and panel
    const real = muts.some((m) => Array.from(m.addedNodes).some((n) =>
      n.nodeType === 1 && n.id !== "parakh-root" && !(n.classList && n.classList.contains("parakh-tags-host"))));
    if (!real) return;
    clearTimeout(watchTimer);
    watchTimer = setTimeout(onPageChanged, 800);
  });

  async function scanPage() {
    st.run += 1;
    st.url = location.href;
    const first = R.findReviews(document, true, "r");
    await R.expandReadMore(first.map((r) => r.card));
    st.live = R.findReviews(document, true, "r");
    st.extra = [];
    st.pages = 1;
    st.last = null;
    st.nextUrl = R.nextReviewsUrl(location.href);
    st.hist = R.starHistogram(document, st.live.map((r) => r.card));
    st.totals = R.totals(document);
    st.byId = {};
    st.seq = 0;
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Fetch the next review page; returns how many review cards it had (0 = end).
  async function fetchNextPage() {
    let doc = null;
    try {
      doc = await R.fetchDoc(st.nextUrl);
    } catch (e) {
      doc = null;
    }
    if (!doc) return { found: 0, added: 0 };
    const found = R.findReviews(doc, false, `p${st.pages + 1}-`);
    if (!st.hist) st.hist = R.starHistogram(doc, found.map((r) => r.card));
    if (!st.totals) st.totals = R.totals(doc);
    // product page -> "All reviews" page 1 repeats the reviews already shown
    const have = new Set(all().map((r) => r.text));
    let added = 0;
    for (const { card, bodyEl, ...r } of found) if (!have.has(r.text)) { st.extra.push(r); added++; }
    st.pages += 1;
    st.nextUrl = R.nextReviewsUrl(st.nextUrl);
    return { found: found.length, added };
  }

  async function readUpTo(target) {
    const run = st.run;
    st.busy = true;
    let nothingNew = 0;
    try {
      while (all().length < target && st.nextUrl && st.pages < MAX_PAGES) {
        showSummary(`Reading more reviews… ${all().length} so far`);
        const { found, added } = await fetchNextPage();
        if (run !== st.run) return; // page was re-read meanwhile
        // stop at the end of the list (empty page, or Flipkart rendered it with script),
        // or when two pages in a row only repeat reviews we already have
        nothingNew = added ? 0 : nothingNew + 1;
        if (!found || nothingNew >= 2) {
          st.nextUrl = null;
          break;
        }
        if (!added) {
          await sleep(PAUSE_MS);
          continue;
        }
        if (!(await analyse(`Reading more reviews… ${all().length} so far`))) return;
        await sleep(PAUSE_MS);
      }
    } finally {
      if (run === st.run) {
        st.busy = false;
        showSummary();
      }
    }
  }

  async function onOpen() {
    panel.open(R.productName());
    if (st.url !== location.href || !st.live.length) await scanPage();
    if (await analyse()) await readUpTo(AUTO_TARGET);
  }

  async function onRescan() {
    await scanPage();
    if (await analyse()) await readUpTo(AUTO_TARGET);
  }

  async function onMore() {
    if (st.busy) return;
    await readUpTo(Math.min(all().length + MORE_STEP, MAX_REVIEWS));
  }

  function init() {
    if (panel || !isReviewPage()) return;
    panel = new P.Panel({ onOpen, onRescan, onMore, onBack: () => { panel.mode = "summary"; showSummary(); } });
  }

  init();
  // Flipkart navigates without full reloads; check for a product page when the URL changes.
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      init();
    }
  }, 1000);
})();
