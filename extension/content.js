// Wires reader + panel + API together on Flipkart pages.
(() => {
  const R = window.ParakhReader, P = window.ParakhPanel;
  const MAX_REVIEWS = 60, MAX_EXTRA_PAGES = 3;
  const isReviewPage = () => /\/p\/|\/product-reviews\//.test(location.pathname);

  let panel = null;
  let st = { live: [], extra: [], pages: 1, nextUrl: null, url: null };

  const api = (path, body) =>
    new Promise((resolve) => chrome.runtime.sendMessage({ type: "parakh-api", path, body }, resolve));

  async function analyse() {
    const all = [...st.live, ...st.extra].slice(0, MAX_REVIEWS);
    if (!all.length) {
      panel.error("No reviews found on this page. Scroll down to the reviews, or open “All reviews”, then press the Parakh tab again.", "");
      return;
    }
    panel.loading(`Reading ${all.length} reviews…`);
    const resp = await api("/v1/analyze", {
      product: R.productName(),
      url: location.href,
      reviews: all.map((r) => ({ id: r.id, text: r.text, rating: r.rating })),
    });
    if (!resp || !resp.ok) {
      panel.error(resp ? resp.error : "Extension background not responding.", resp && resp.base);
      return;
    }
    const byId = Object.fromEntries(resp.data.reviews.map((r) => [r.id, r]));
    for (const r of st.live) {
      const out = byId[r.id];
      if (out) P.drawTags(r.card, r.bodyEl, out.tags, () => panel.showAnatomy(r, out), out.extraction);
    }
    st.last = resp.data;
    showSummary();
  }

  function showSummary() {
    const all = st.live.length + st.extra.length;
    panel.render(st.last, { pages: st.pages, canLoadMore: !!st.nextUrl && st.pages <= MAX_EXTRA_PAGES && all < MAX_REVIEWS });
  }

  async function scanPage() {
    st.url = location.href;
    const first = R.findReviews(document, true, "r");
    await R.expandReadMore(first.map((r) => r.card));
    st.live = R.findReviews(document, true, "r");
    st.extra = [];
    st.pages = 1;
    st.nextUrl = R.nextReviewsUrl(location.href);
  }

  async function onOpen() {
    panel.open(R.productName());
    if (st.url !== location.href || !st.live.length) await scanPage();
    await analyse();
  }

  async function onRescan() {
    await scanPage();
    await analyse();
  }

  async function onMore() {
    if (!st.nextUrl) return;
    panel.loading("Loading the next page of reviews…");
    let got = [];
    try {
      got = await R.fetchReviews(st.nextUrl, `p${st.pages + 1}-`);
    } catch (e) {
      got = [];
    }
    if (!got.length) {
      // page had no readable reviews (end of list, or Flipkart rendered them with script)
      st.nextUrl = null;
      await analyse();
      return;
    }
    // product page -> "All reviews" page 1 repeats the reviews already shown
    const have = new Set([...st.live, ...st.extra].map((r) => r.text));
    got = got.filter((r) => !have.has(r.text));
    st.extra.push(...got);
    st.pages += 1;
    st.nextUrl = R.nextReviewsUrl(st.nextUrl);
    await analyse();
  }

  function init() {
    if (panel || !isReviewPage()) return;
    panel = new P.Panel({ onOpen, onRescan, onMore, onBack: showSummary });
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
