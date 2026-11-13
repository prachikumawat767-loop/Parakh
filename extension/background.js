// Calls the Parakh API on behalf of the content script.
// (Requests from the service worker use host_permissions, so no CORS trouble on flipkart.com.)
const DEFAULT_API = "http://localhost:7860";

async function apiBase() {
  const { apiBase } = await chrome.storage.sync.get("apiBase");
  return (apiBase || DEFAULT_API).replace(/\/+$/, "");
}

async function call(path, body, tries = 3) {
  const base = await apiBase();
  for (let i = 0; i < tries; i++) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    // a sleeping HF Space answers 503 while it wakes up
    if (r.status === 503 && i < tries - 1) {
      await new Promise((res) => setTimeout(res, 5000));
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${base}${path}`);
    return { data: await r.json(), base };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "parakh-api") return;
  call(msg.path, msg.body)
    .then(({ data, base }) => sendResponse({ ok: true, data, base }))
    .catch(async (e) => sendResponse({ ok: false, error: String(e.message || e), base: await apiBase() }));
  return true; // keep the channel open for the async reply
});
