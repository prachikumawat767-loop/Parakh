// Draws the Parakh side panel and the tags under each store review.
// Everything lives in shadow roots so Flipkart's CSS can't touch it (and ours can't leak).
(() => {
  const C = { pos: "#1e7d3a", neg: "#c0392b", degraded: "#e39b17", dead: "#b3261e", ink: "#1f2328", mute: "#6a737d", line: "#e4e7eb" };

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .launch { position: fixed; right: 0; top: 42%; z-index: 2147483000; background: #2b3a67; color: #fff;
    border: 0; border-radius: 8px 0 0 8px; padding: 10px 8px; cursor: pointer; font-size: 13px; font-weight: 600;
    writing-mode: vertical-rl; transform: rotate(180deg); box-shadow: 0 2px 8px rgba(0,0,0,.25); letter-spacing: .5px; }
  .panel { position: fixed; top: 0; right: 0; width: 370px; height: 100vh; z-index: 2147483001; background: #fff;
    border-left: 1px solid ${C.line}; box-shadow: -4px 0 18px rgba(0,0,0,.12); display: flex; flex-direction: column; color: ${C.ink}; }
  .panel[hidden] { display: none; }
  header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid ${C.line}; }
  header b { font-size: 15px; }
  header .prod { font-size: 12px; color: ${C.mute}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
  header button { border: 0; background: none; font-size: 20px; cursor: pointer; color: ${C.mute}; line-height: 1; }
  .body { overflow-y: auto; padding: 12px 14px 20px; flex: 1; font-size: 13px; line-height: 1.45; }
  .status { font-size: 11px; color: ${C.mute}; margin-bottom: 10px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 4px; }
  .badge.model { background: #e6f4ea; color: ${C.pos}; } .badge.mock { background: #fff4e0; color: #8a5a00; }
  .verdict { font-size: 14px; font-weight: 600; margin: 0 0 14px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: ${C.mute}; margin: 16px 0 6px; font-weight: 700; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 1px solid ${C.line}; border-radius: 14px; padding: 3px 9px; font-size: 12px; }
  .chip .lo { color: ${C.neg}; font-weight: 700; } .chip .hi { color: ${C.pos}; font-weight: 700; }
  .row { display: grid; grid-template-columns: 108px 1fr 38px; align-items: center; gap: 8px; padding: 5px 0; font-size: 12.5px; border-bottom: 1px solid #f0f2f4; }
  .row .l small { color: ${C.mute}; margin-left: 3px; }
  .row.few { opacity: .45; }
  .progress { font-size: 11.5px; color: #2b3a67; background: #eef2fb; border-radius: 5px; padding: 4px 8px; margin: -4px 0 10px; }
  .stack { display: flex; height: 9px; border-radius: 2px; overflow: hidden; background: #eef0f2; }
  .stack .n { background: #e4572e; } .stack .p { background: #2f54d9; }
  .row .pct { text-align: right; font-variant-numeric: tabular-nums; }
  .axis { display: flex; justify-content: flex-end; gap: 8px; font-size: 10.5px; color: ${C.mute}; margin-bottom: 2px; }
  .axis i { font-style: normal; } .axis .kn { color: #e4572e; } .axis .kp { color: #2f54d9; }
  .note { font-size: 11px; color: ${C.mute}; margin-top: 4px; }
  .actions { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
  .actions button { border: 1px solid #c9ced4; background: #fff; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  .actions button:hover { background: #f4f6f8; }
  .err { background: #fdecea; color: #7a1c14; padding: 8px 10px; border-radius: 6px; font-size: 12px; }
  .spin { color: ${C.mute}; }
  .back { border: 0; background: none; color: #2b3a67; cursor: pointer; padding: 0; font-size: 12px; margin-bottom: 8px; }
  .rv { font-size: 13.5px; line-height: 1.7; border: 1px solid ${C.line}; border-radius: 6px; padding: 10px; background: #fcfcfd; }
  .rv mark { color: inherit; border-radius: 2px; padding: 0 1px; cursor: pointer; }
  .rv mark.on, .fi.on { outline: 2px solid #2b3a67; }
  .rv sup { font-size: 9px; font-weight: 700; margin-left: 1px; color: #444; }
  .stars { font-size: 12px; color: ${C.mute}; margin-bottom: 6px; }
  .fi { display: grid; grid-template-columns: 20px 1fr; gap: 6px; padding: 6px; border-radius: 5px; margin: 3px 0; border-left: 4px solid; cursor: pointer; }
  .fi .num { font-weight: 700; font-size: 11px; }
  .fi .k { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: ${C.mute}; }
  .fi .v { font-weight: 600; } .fi .d { font-size: 12px; color: #444; }
  .fi.nospan { opacity: .75; } .fi.nospan .k::after { content: " · quote not found"; text-transform: none; }
  .vs { margin-top: 10px; border-top: 1px solid ${C.line}; }
  .vs h3 { margin-top: 10px; } .vs p { margin: 2px 0 0; } .vs .pp { font-weight: 600; }
  .levels { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .lv { border: 1px solid ${C.line}; border-radius: 6px; padding: 6px 8px; font-size: 11px; display: flex; flex-direction: column; }
  .lv b { font-size: 12px; color: #2b3a67; } .lv span { color: ${C.mute}; } .lv i { font-style: normal; margin-top: 2px; }
  details { margin-top: 12px; font-size: 12px; } pre { font-size: 10.5px; background: #f4f6f8; padding: 8px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
  svg text { font-size: 10px; fill: ${C.mute}; }
  `;

  const TAG_CSS = `
  :host { all: initial; }
  .tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 4px; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .t { font-size: 11px; padding: 2px 7px; border-radius: 10px; border: 1px solid; cursor: help; }
  .pos { color: ${C.pos}; border-color: #a8d5b5; background: #f1faf3; }
  .neg { color: ${C.neg}; border-color: #efb4ad; background: #fdf3f2; }
  .fail { color: #fff; border-color: ${C.dead}; background: ${C.dead}; }
  .info { color: #3d4b6b; border-color: #c8cfdf; background: #f3f5fa; }
  .meta { color: #555; border-color: #e1e4e8; background: #f6f7f8; font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; }
  .p { font-size: 10px; color: #8a93a3; align-self: center; }
  .bd { font-size: 11px; border: 0; background: none; color: #2b3a67; cursor: pointer; text-decoration: underline; padding: 2px 4px; }
  `;

  // field kinds in the anatomy view: colour + short name
  const KIND = {
    pos: { c: "#d7efdd", b: C.pos, n: "Opinion +" },
    neg: { c: "#f8dad6", b: C.neg, n: "Opinion −" },
    neu: { c: "#e9ecef", b: "#6a737d", n: "Opinion" },
    fail: { c: "#fde7c2", b: C.degraded, n: "Failure" },
    dur: { c: "#dde6fb", b: "#3b5bb5", n: "Usage time" },
    svc: { c: "#efe0f7", b: "#7b3fa0", n: "Service" },
    ctx: { c: "#d9f1f2", b: "#1b7f86", n: "Reviewer" },
    cmp: { c: "#fff3b0", b: "#8a7400", n: "Comparison" },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function aspectBars(aspects, sampling) {
    const rows = aspects.filter((a) => a.pos + a.neg > 0 && a.category !== "overall")
      .sort((a, b) => a.few - b.few || b.total - a.total).slice(0, 9);
    if (!rows.length) return `<div class="note">No aspect opinions found.</div>`;
    // one bar per aspect: complaints vs praise, as the (reweighted) share that is positive
    const weighted = sampling && sampling.reweighted;
    return (
      `<div class="axis"><i class="kn">■ complaints</i><i class="kp">■ praise</i><i>% positive</i></div>` +
      rows
        .map((a) => {
          const pct = a.pct_pos != null ? a.pct_pos : Math.round((100 * a.pos) / (a.pos + a.neg));
          return `<div class="row${a.few ? " few" : ""}"><span class="l">${esc(a.label)}<small>${a.total}</small></span>
            <div class="stack" title="${a.neg} complaints, ${a.pos} praise in the reviews read">
              <div class="n" style="width:${100 - pct}%"></div><div class="p" style="width:${pct}%"></div></div>
            <span class="pct">${a.few ? "few" : pct + "%"}</span></div>`;
        })
        .join("") +
      `<div class="note">Number = reviews that mention the aspect. Grey = fewer than ${(sampling && sampling.min_mentions) || 3}, too few to judge.` +
      (weighted ? ` % adjusted for the star mix of all ratings.` : "") + `</div>`
    );
  }

  function samplingLine(s, meta, pages) {
    if (!s) return "";
    const of = s.total_reviews ? ` of ${s.total_reviews.toLocaleString("en-IN")}` : "";
    const pg = pages > 1 ? ` · ${pages} pages` : "";
    const w = s.reweighted
      ? `<span title="Reviews from star levels we over-read count less, under-read ones count more (weights ${s.weight_range[0]}–${s.weight_range[1]}).">reweighted to the phone's star mix ✓</span>`
      : `<span title="The star breakdown wasn't found on this page, so every review counts the same.">not reweighted</span>`;
    return `<div class="status"><span class="badge ${meta.backend}">${meta.backend === "model" ? "MODEL" : "DEMO RULES"}</span>
      Based on ${s.n_read}${of} reviews${pg} · ${w}</div>`;
  }

  function durabilityChart(d, weighted) {
    const W = 336, H = 150, padL = 22, padB = 22, padT = 14;
    const b = d.buckets;
    const max = Math.max(1, ...b.map((x) => x.degraded + x.dead));
    const bw = (W - padL) / b.length;
    const y = (v) => H - padB - (v / max) * (H - padB - padT);
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Faults reported by time since purchase">`;
    for (let v = 0; v <= max; v += Math.max(1, Math.ceil(max / 4))) {
      s += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.line}"/><text x="${padL - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
    }
    b.forEach((x, i) => {
      const x0 = padL + i * bw + bw * 0.2, w = bw * 0.6;
      const yD = y(x.degraded), yT = y(x.degraded + x.dead);
      if (x.degraded) s += `<rect x="${x0}" y="${yD}" width="${w}" height="${H - padB - yD}" fill="${C.degraded}"><title>${x.degraded} degraded</title></rect>`;
      if (x.dead) s += `<rect x="${x0}" y="${yT}" width="${w}" height="${yD - yT}" fill="${C.dead}"><title>${x.dead} dead</title></rect>`;
      if (x.degraded + x.dead) s += `<text x="${x0 + w / 2}" y="${yT - 3}" text-anchor="middle" style="fill:${C.ink}">${x.degraded + x.dead}</text>`;
      s += `<text x="${x0 + w / 2}" y="${H - 7}" text-anchor="middle">${esc(x.label)}</text>`;
    });
    s += `</svg>`;
    const legend = `<span style="color:${C.degraded}">■</span> got worse &nbsp; <span style="color:${C.dead}">■</span> stopped working`;
    const ns = d.time_not_stated.degraded + d.time_not_stated.dead;
    const dated = b.reduce((a, x) => a + x.degraded + x.dead, 0);
    let note = `${d.n_reviews_with_failure} of ${d.n_reviews} reviews report a fault` +
      (weighted && d.n_reviews_with_failure ? ` (about ${Math.round(100 * d.fault_share)}% after adjusting for the star mix).` : ".");
    if (ns) note += ` ${ns} fault${ns > 1 ? "s" : ""} with no time given (not shown).`;
    if (!dated) return `<div class="note">${legend}</div><div class="note">No fault reports that say when it happened. ${esc(note)}</div>`;
    return `${s}<div class="note">${legend}</div><div class="note">${esc(note)} Time = days after purchase, as written in the review.</div>`;
  }

  function peopleLikeMe(p, weightedAvg) {
    if (!p.segments.length || p.overall_avg == null) return `<div class="note">Not enough reviews from any one kind of buyer yet.</div>`;
    return (
      `<div class="chips">` +
      p.segments
        .map((s) => {
          const cls = s.avg < p.overall_avg - 0.2 ? "lo" : s.avg > p.overall_avg + 0.2 ? "hi" : "";
          return `<span class="chip">${esc(s.label)}: <span class="${cls}">${s.avg}★</span> <span style="color:${C.mute}">(${s.n})</span></span>`;
        })
        .join("") +
      `</div><div class="note">vs ${p.overall_avg}★ ${weightedAvg ? "for the phone overall (all ratings)" : `across all ${p.n_rated} rated reviews here`}.</div>`
    );
  }

  // Find a quote in the review: exact first, then case-insensitive. Returns [start, end] or null.
  function locate(text, quote) {
    if (!quote) return null;
    let i = text.indexOf(quote);
    if (i < 0) i = text.toLowerCase().indexOf(quote.toLowerCase());
    return i < 0 ? null : [i, i + quote.length];
  }

  // Every JSON field -> one numbered item, with the span of text it came from.
  function anatomyItems(text, ex) {
    const items = [];
    const add = (kind, label, detail, quotes, json) => {
      // the model returns character offsets; trust them if they point at the same words
      const s = json && Array.isArray(json.span) ? json.span : null;
      // (Python counts emoji as 1 character, JavaScript as 2, so offsets can drift)
      const want = (json && (json.opinion || json.symptom)) || "";
      const fromModel = s && s[1] > s[0] && want && text.slice(s[0], s[1]) === want ? s : null;
      const span = fromModel || quotes.map((q) => locate(text, q)).find(Boolean) || null;
      items.push({ kind, label, detail, span, json });
    };
    ex.opinions.forEach((o) =>
      add(o.polarity || "neu", `${o.category}${o.implicit ? " (implied)" : ""}`,
        [o.aspect && `aspect “${o.aspect}”`, o.opinion && `“${o.opinion}”`].filter(Boolean).join(" · "),
        [o.opinion, o.evidence, o.aspect], o));
    ex.failure_events.forEach((f) =>
      add("fail", `${f.component || "phone"} · ${f.severity}`,
        [f.symptom && `“${f.symptom}”`, f.after_days != null && `after ${f.after_days} days`, f.trigger && `trigger: ${f.trigger}`]
          .filter(Boolean).join(" · "),
        [f.evidence, f.symptom], f));
    if (ex.usage_duration && ex.usage_duration.value_days != null)
      add("dur", `${ex.usage_duration.value_days} days of use`, "", [ex.usage_duration.evidence], ex.usage_duration);
    const se = ex.service_experience;
    if (se) add("svc", se.type || "service", se.days_taken != null ? `${se.days_taken} days` : "", [se.evidence], se);
    const rc = ex.reviewer_context;
    if (rc && (rc.use_case.length || rc.prior_device))
      add("ctx", rc.use_case.join(", ") || "reviewer", rc.prior_device ? `previous phone: ${rc.prior_device}` : "", [rc.evidence], rc);
    ex.comparisons.forEach((c) =>
      add("cmp", c.verdict === "same" ? `same as ${c.other_product}` : `${c.verdict} than ${c.other_product}`, c.aspect ? `on ${c.aspect}` : "", [c.evidence, c.other_product], c));
    return items;
  }

  // Paint spans onto characters; shorter (more specific) spans win where they overlap.
  function highlight(text, items) {
    const owner = new Array(text.length).fill(-1);
    items
      .map((it, i) => ({ i, s: it.span }))
      .filter((x) => x.s)
      .sort((a, b) => b.s[1] - b.s[0] - (a.s[1] - a.s[0]))
      .forEach(({ i, s }) => { for (let k = s[0]; k < s[1]; k++) owner[k] = i; });
    let html = "", k = 0;
    while (k < text.length) {
      let j = k;
      while (j < text.length && owner[j] === owner[k]) j++;
      const chunk = esc(text.slice(k, j));
      const o = owner[k];
      html += o < 0 ? chunk
        : `<mark data-i="${o}" style="background:${KIND[items[o].kind].c};border-bottom:2px solid ${KIND[items[o].kind].b}">${chunk}<sup>${o + 1}</sup></mark>`;
      k = j;
    }
    return html;
  }

  function levels(ex, items) {
    const l1 = items.filter((it) => it.span).length;
    // every opinion that links an aspect, an opinion phrase and a polarity is a tuple (implied ones too)
    const l2 = ex.opinions.filter((o) => o.aspect && o.opinion && o.polarity).length;
    const l3 = [
      ex.opinions.filter((o) => o.implicit).length && `${ex.opinions.filter((o) => o.implicit).length} implied aspect`,
      ex.failure_events.filter((f) => f.after_days != null).length + (ex.usage_duration.value_days != null ? 1 : 0)
        && "time → days",
      ex.failure_events.some((f) => f.trigger) && "trigger",
      ex.reviewer_context.use_case.length && "reviewer type",
    ].filter(Boolean);
    const l4 = [
      ex.opinions.length && "aspect bars",
      ex.failure_events.some((f) => f.after_days != null) && "durability chart",
      ex.reviewer_context.use_case.length && "people like me",
    ].filter(Boolean);
    const cell = (k, title, v) =>
      `<div class="lv"><b>${k}</b><span>${title}</span><i>${esc(v)}</i></div>`;
    return `<div class="levels">
      ${cell("L1", "spans", `${l1} copied from text`)}
      ${cell("L2", "tuples", `${l2} aspect–opinion–polarity`)}
      ${cell("L3", "inferred", l3.join(", ") || "none")}
      ${cell("L4", "across reviews", l4.length ? "feeds " + l4.join(", ") : "nothing")}
    </div>`;
  }

  // The pitch in one place: what a star rating / sentiment label says vs what the fields say.
  const LABEL = { battery: "battery", camera: "camera", display: "display", performance: "performance",
    thermals: "heating", sound: "sound", connectivity: "network", build: "build", software: "software",
    service: "service", value: "value for money" };
  const WHO = { gaming: "A gamer", photography: "A camera-first buyer", work: "Bought for work", students: "A student",
    elderly_parent: "Bought for a parent", basic_use: "A basic-use buyer" };
  const joinList = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function plainSentiment(rating) {
    if (!rating) return "Positive or negative. That's all.";
    const tone = rating >= 4 ? "Positive" : rating <= 2 ? "Negative" : "Mixed";
    return `${tone}, ${rating} star${rating === 1 ? "" : "s"}. That's all.`;
  }

  function pullsOut(ex) {
    const s = [];
    const rc = ex.reviewer_context;
    let who = rc.use_case.length ? WHO[rc.use_case[0]] || rc.use_case[0] : "";
    if (rc.buyer_is_user === false) who = who ? `${who}; the buyer isn't the user` : "The buyer isn't the user";
    if (who) s.push(who + ".");
    const cats = (p) => [...new Set(ex.opinions.filter((o) => o.polarity === p && LABEL[o.category]).map((o) => LABEL[o.category]))];
    const likes = cats("pos"), dislikes = cats("neg");
    const feel = [likes.length && `likes the ${joinList(likes)}`, dislikes.length && `unhappy with the ${joinList(dislikes)}`].filter(Boolean);
    if (feel.length) s.push(cap(feel.join("; ")) + ".");
    for (const f of ex.failure_events) {
      const part = LABEL[f.component] || f.component || "phone";
      s.push(cap(`${part} ${f.severity === "dead" ? "stopped working" : "got worse"}`) +
        (f.after_days != null ? ` after ${f.after_days} days` : "") + (f.trigger ? ` (${f.trigger})` : "") + ".");
    }
    for (const c of ex.comparisons)
      s.push(`${c.verdict === "same" ? "Same as" : cap(c.verdict) + " than"} ${c.other_product}${c.aspect ? ` on ${c.aspect}` : ""}.`);
    const se = ex.service_experience;
    if (se) s.push(`${cap(se.type || "service")}${se.days_taken != null ? ` took ${se.days_taken} days` : ""}.`);
    if (ex.usage_duration.value_days) s.push(`Used for ${ex.usage_duration.value_days} days.`);
    return s.length ? s.join(" ") : "Nothing beyond the overall tone for this one.";
  }

  class Panel {
    constructor(handlers) {
      this.host = document.createElement("div");
      this.host.id = "parakh-root";
      document.documentElement.appendChild(this.host);
      const root = this.host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <button class="launch" title="Open Parakh">Parakh</button>
        <aside class="panel" hidden>
          <header><b>Parakh</b><span class="prod"></span><button class="x" title="Close">×</button></header>
          <div class="body"></div>
        </aside>`;
      this.root = root;
      this.panel = root.querySelector(".panel");
      this.bodyEl = root.querySelector(".body");
      root.querySelector(".launch").onclick = () => handlers.onOpen();
      root.querySelector(".x").onclick = () => this.close();
      this.handlers = handlers;
    }
    open(product) {
      this.panel.hidden = false;
      this.root.querySelector(".launch").style.display = "none";
      this.root.querySelector(".prod").textContent = product || "";
    }
    close() {
      this.panel.hidden = true;
      this.root.querySelector(".launch").style.display = "";
    }
    loading(msg) {
      this.bodyEl.innerHTML = `<div class="spin">${esc(msg)}</div>`;
    }
    error(msg, base) {
      this.bodyEl.innerHTML = `<div class="err"><b>Couldn't analyse reviews.</b><br>${esc(msg)}<br><br>
        API: ${esc(base || "?")}<br>Change it from the Parakh toolbar icon.</div>${this._actions(false)}`;
      this._wire();
    }
    showAnatomy(review, out) {
      this.mode = "anatomy";
      this.panel.hidden = false;
      this.root.querySelector(".launch").style.display = "none";
      const ex = out.extraction, text = review.text;
      const items = anatomyItems(text, ex);
      const list = items.length
        ? items.map((it, i) => {
            const k = KIND[it.kind];
            return `<div class="fi${it.span ? "" : " nospan"}" data-i="${i}" style="border-color:${k.b};background:${k.c}55">
              <span class="num">${i + 1}</span><div><div class="k">${k.n}</div><div class="v">${esc(it.label)}</div>
              ${it.detail ? `<div class="d">${esc(it.detail)}</div>` : ""}</div></div>`;
          }).join("")
        : `<div class="note">The model found nothing to extract in this review.</div>`;
      this.bodyEl.innerHTML = `
        <button class="back">‹ Back to summary</button>
        <h3 style="margin-top:4px">One review, taken apart</h3>
        <div class="stars">${review.rating ? review.rating + "★" : ""} ${esc(review.title || "")} · ${esc(ex.review_type.replace("_", " "))}</div>
        <div class="rv">${highlight(text, items)}</div>
        <div class="note">Each highlight is the exact text a field came from. Click one to match it up.</div>
        <div class="vs">
          <div><h3>What a plain sentiment model would say</h3><p>${esc(plainSentiment(review.rating))}</p></div>
          <div><h3>What Parakh pulls out</h3><p class="pp">${esc(pullsOut(ex))}</p></div>
        </div>
        <h3>Extracted fields</h3>${list}
        ${(out.fixes || []).length ? `<h3>Changed after the model</h3><div class="note" style="color:#444">${out.fixes.map(esc).join("<br>")}</div>` : ""}
        <h3>Levels</h3>${levels(ex, items)}
        <details><summary>phone_review_v1 JSON</summary><pre>${esc(JSON.stringify(ex, null, 2))}</pre></details>`;
      this.bodyEl.querySelector(".back").onclick = () => this.handlers.onBack();
      const pick = (i) => {
        this.bodyEl.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
        this.bodyEl.querySelectorAll(`[data-i="${i}"]`).forEach((n) => n.classList.add("on"));
      };
      this.bodyEl.querySelectorAll("mark[data-i], .fi[data-i]").forEach((n) => {
        n.onclick = () => {
          pick(n.dataset.i);
          const twin = n.tagName === "MARK" ? this.bodyEl.querySelector(`.fi[data-i="${n.dataset.i}"]`)
            : this.bodyEl.querySelector(`mark[data-i="${n.dataset.i}"]`);
          if (twin) twin.scrollIntoView({ block: "nearest", behavior: "smooth" });
        };
      });
      this.bodyEl.scrollTop = 0;
    }
    render(res, opts) {
      const s = res.summary, m = res.meta;
      const sm = s.sampling; // missing if the API is older than this extension
      const weighted = !!(sm && sm.reweighted);
      const keepScroll = this.mode === "summary" ? this.bodyEl.scrollTop : 0;
      this.mode = "summary";
      this.bodyEl.innerHTML = `
        ${sm ? samplingLine(sm, m, opts.pages) : `<div class="status"><span class="badge ${m.backend}">${m.backend === "model" ? "MODEL" : "DEMO RULES"}</span>
          ${m.n_reviews} reviews read${opts.pages > 1 ? ` · ${opts.pages} pages` : ""}</div>`}
        ${opts.progress ? `<div class="progress">${esc(opts.progress)}</div>` : ""}
        <p class="verdict">${esc(s.verdict)}</p>
        <h3>Reviews from people like me</h3>${peopleLikeMe(s.people_like_me, weighted)}
        <h3>What reviewers talk about</h3>${aspectBars(s.aspects, sm)}
        <h3>When problems show up</h3>${durabilityChart(s.durability, weighted)}
        ${this._actions(opts.canLoadMore)}
        <div class="note" style="margin-top:12px">Reads only the phone you are viewing, up to 100 reviews. Hover a tag under a review to see the exact words it came from.</div>`;
      this._wire();
      this.bodyEl.scrollTop = keepScroll;
    }
    _actions(more) {
      return `<div class="actions"><button data-a="rescan">Re-read this page</button>${more ? `<button data-a="more">Read 30 more reviews</button>` : ""}</div>`;
    }
    _wire() {
      this.bodyEl.querySelectorAll("button[data-a]").forEach((b) => {
        b.onclick = () => (b.dataset.a === "more" ? this.handlers.onMore() : this.handlers.onRescan());
      });
    }
  }

  const USE = { gaming: "gaming", photography: "camera first", work: "work", students: "student",
    elderly_parent: "for parents", basic_use: "calls & WhatsApp" };
  const RTYPE = { first_impression: "first impression", long_term: "long-term", update: "update" };

  function drawTags(card, anchorEl, tags, onBreakdown, ex) {
    card.querySelectorAll(":scope .parakh-tags-host").forEach((n) => n.remove());
    // who wrote it and when: from the reviewer_context and review_type fields
    if (ex) {
      tags = tags.slice();
      for (const u of ex.reviewer_context.use_case || [])
        tags.push({ kind: "meta", text: `use: ${USE[u] || u}`, evidence: ex.reviewer_context.evidence || "" });
      if (RTYPE[ex.review_type]) tags.push({ kind: "meta", text: RTYPE[ex.review_type], evidence: "" });
    }
    const host = document.createElement("div");
    host.className = "parakh-tags-host";
    const sr = host.attachShadow({ mode: "open" });
    sr.innerHTML = `<style>${TAG_CSS}</style><div class="tags"><span class="p">Parakh</span>${tags
      .map((t) => `<span class="t ${t.kind}" title="&quot;${esc(t.evidence)}&quot;">${esc(t.text)}</span>`)
      .join("")}<button class="bd">Breakdown ›</button></div>`;
    sr.querySelector(".bd").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // Flipkart cards can be links
      onBreakdown();
    };
    if (anchorEl && card.contains(anchorEl)) anchorEl.insertAdjacentElement("afterend", host);
    else card.appendChild(host);
  }

  window.ParakhPanel = { Panel, drawTags };
})();
