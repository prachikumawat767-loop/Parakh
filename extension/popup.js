const $ = (id) => document.getElementById(id);
const DEFAULT_API = "http://localhost:7860";

chrome.storage.sync.get("apiBase").then(({ apiBase }) => ($("api").value = apiBase || DEFAULT_API));

async function save() {
  const v = $("api").value.trim().replace(/\/+$/, "") || DEFAULT_API;
  $("api").value = v;
  await chrome.storage.sync.set({ apiBase: v });
  $("status").textContent = "Saved.";
}

async function check() {
  await save();
  $("status").textContent = "Checking…";
  chrome.runtime.sendMessage({ type: "parakh-api", path: "/health" }, (r) => {
    if (!r || !r.ok) return ($("status").textContent = "Not reachable: " + (r ? r.error : "no reply"));
    const h = r.data;
    $("status").textContent =
      h.backend === "model" ? `OK, real model loaded (${h.load_seconds}s).`
      : h.backend === "mock" ? `Reachable, but running demo rules${h.error ? " – model error: " + h.error : ""}.`
      : `Reachable, status: ${h.backend}`;
  });
}

$("save").onclick = save;
$("check").onclick = check;
$("local").onclick = () => { $("api").value = DEFAULT_API; check(); };
