"""L4 aggregation over many phone_review_v1 extractions.

Shared by the extension panel (via /v1/analyze) and, later, the website.
Pure Python, no model needed, so it can be tested on its own.
"""
from statistics import median

CATEGORIES = ["battery", "camera", "display", "performance", "thermals", "sound",
              "connectivity", "build", "software", "service", "value", "overall"]
CAT_LABEL = {"battery": "Battery", "camera": "Camera", "display": "Display", "performance": "Performance",
             "thermals": "Heating", "sound": "Sound", "connectivity": "Network", "build": "Build",
             "software": "Software", "service": "Service", "value": "Value", "overall": "Overall"}
USE_LABEL = {"gaming": "Gamers", "photography": "Photo lovers", "work": "Work users", "students": "Students",
             "elderly_parent": "Bought for parents", "basic_use": "Basic use"}
MIN_MENTIONS = 3  # aspects with fewer reviews are shown greyed and left out of the verdict
BUCKETS =[(0, 30, "<1 mo"), (31, 90, "1–3 mo"), (91, 180, "3–6 mo"), (181, 365, "6–12 mo"), (366, 10**6, "1 yr+")]

EMPTY = {
    "opinions": [], "failure_events": [],
    "reviewer_context": {"use_case": [], "prior_device": None, "buyer_is_user": None, "evidence": ""},
    "comparisons": [], "service_experience": None,
    "usage_duration": {"value_days": None, "evidence": ""},
    "review_type": "first_impression",
}


def normalise(ex):
    """Fill missing keys so clients never have to guard against them."""
    ex = dict(ex or {})
    for k, v in EMPTY.items():
        if ex.get(k) is None and v is not None:
            ex[k] = v.copy() if isinstance(v, (dict, list)) else v
        ex.setdefault(k, v)
    se = ex.get("service_experience")
    if isinstance(se, dict) and not se.get("type") and not se.get("evidence"):
        ex["service_experience"] = None
    ex["reviewer_context"].setdefault("use_case", [])
    ex["reviewer_context"]["use_case"] = ex["reviewer_context"]["use_case"] or []
    return ex


def _first_fail_day(ex):
    days = [f.get("after_days") for f in ex["failure_events"] if f.get("after_days") is not None]
    return min(days) if days else None


def review_tags(ex, max_tags=5):
    """Short chips drawn under each store review."""
    tags = []
    for f in ex["failure_events"]:
        comp = CAT_LABEL.get(f.get("component"), (f.get("component") or "Phone").capitalize())
        word = "died" if f.get("severity") == "dead" else "issue"
        when = f" after {f['after_days']} days" if f.get("after_days") is not None else ""
        trig = f" ({f['trigger']})" if f.get("trigger") else ""
        tags.append({"kind": "fail", "text": f"{comp} {word}{when}{trig}", "evidence": f.get("evidence", "")})
    seen = set()
    for o in ex["opinions"]:
        key = (o.get("category"), o.get("polarity"))
        if key in seen or o.get("polarity") not in ("pos", "neg") or o.get("category") == "overall":
            continue
        seen.add(key)
        sign = "+" if o["polarity"] == "pos" else "−"
        tags.append({"kind": o["polarity"], "text": f"{CAT_LABEL.get(o['category'], o['category'])} {sign}",
                     "evidence": o.get("evidence", "")})
    ud = ex["usage_duration"].get("value_days")
    if ud:
        tags.append({"kind": "info", "text": f"Used {ud} days", "evidence": ex["usage_duration"].get("evidence", "")})
    se = ex.get("service_experience")
    if se:
        d = f", {se['days_taken']} days" if se.get("days_taken") is not None else ""
        tags.append({"kind": "info", "text": f"{se['type'].capitalize()}{d}", "evidence": se.get("evidence", "")})
    return tags[:max_tags]


def aspect_summary(exs, weights=None):
    """Per aspect: raw counts of reviews (pos / neg / neu), weighted counts, and the
    weighted share that is positive. `few` marks aspects with under MIN_MENTIONS reviews."""
    weights = weights or [1.0] * len(exs)
    counts = {c: {"pos": 0, "neg": 0, "neu": 0} for c in CATEGORIES}
    wsum = {c: {"pos": 0.0, "neg": 0.0} for c in CATEGORIES}
    for ex, w in zip(exs, weights):
        # count each category at most once per review per polarity, so one long rant doesn't dominate
        seen = set()
        for o in ex["opinions"]:
            c, p = o.get("category"), o.get("polarity")
            if c in counts and p in ("pos", "neg", "neu") and (c, p) not in seen:
                seen.add((c, p))
                counts[c][p] += 1
                if p in ("pos", "neg"):
                    wsum[c][p] += w
    rows = []
    for c, v in counts.items():
        total = sum(v.values())
        if not total:
            continue
        wp, wn = wsum[c]["pos"], wsum[c]["neg"]
        rows.append({"category": c, "label": CAT_LABEL[c], **v, "total": total,
                     "pct_pos": round(100 * wp / (wp + wn)) if wp + wn else None,
                     "few": total < MIN_MENTIONS})
    rows.sort(key=lambda r: (r["category"] == "overall", -r["total"]))
    return rows


def star_weights(ratings, histogram, clip=(0.2, 5.0)):
    """Post-stratification: weight = (share of this star level among ALL ratings of the
    phone) / (share among the reviews we read). Reviews from over-sampled star levels
    count less, under-sampled ones more. Weights are clipped so a single review can't
    dominate; reviews without a rating get weight 1.

    Returns (weights, info). Without a usable histogram all weights are 1."""
    n = len(ratings)
    pop = {}
    if histogram:
        for k, v in histogram.items():
            try:
                s, cnt = int(round(float(k))), float(v)
            except (TypeError, ValueError):
                continue
            if 1 <= s <= 5 and cnt >= 0:
                pop[s] = pop.get(s, 0) + cnt
    pop_total = sum(pop.values())
    rated = [int(round(r)) for r in ratings if isinstance(r, (int, float))]
    samp = {s: rated.count(s) for s in range(1, 6)}
    info = {"reweighted": False, "sample_share": {}, "population_share": {}}
    if rated:
        info["sample_share"] = {s: round(samp[s] / len(rated), 3) for s in range(1, 6)}
    if pop_total <= 0 or len(rated) < 5:
        return [1.0] * n, info
    pshare = {s: pop.get(s, 0) / pop_total for s in range(1, 6)}
    info["population_share"] = {s: round(pshare[s], 3) for s in range(1, 6)}
    info["population_avg"] = round(sum(s * pshare[s] for s in range(1, 6)), 2)
    w = []
    for r in ratings:
        if not isinstance(r, (int, float)):
            w.append(1.0)
            continue
        s = int(round(r))
        sshare = samp[s] / len(rated)
        w.append(min(max(pshare[s] / sshare, clip[0]), clip[1]) if sshare else 1.0)
    info["reweighted"] = True
    info["weight_range"] = [round(min(w), 2), round(max(w), 2)]
    return w, info


def kaplan_meier(exs):
    """Share of reviewers still problem-free after t days.

    Event = first failure with a stated day. Censored = review states how long
    it has been used, with no failure. Reviews with no time info are skipped.
    """
    obs = []
    for ex in exs:
        t = _first_fail_day(ex)
        if t is not None:
            obs.append((t, 1))
        elif not ex["failure_events"] and ex["usage_duration"].get("value_days"):
            obs.append((ex["usage_duration"]["value_days"], 0))
    if len(obs) < 5:
        return {"n": len(obs), "points": []}
    obs.sort()
    at_risk, s, pts = len(obs), 1.0, [{"day": 0, "still_ok": 1.0}]
    i = 0
    while i < len(obs):
        t = obs[i][0]
        d = sum(1 for x in obs if x[0] == t and x[1] == 1)
        n_t = sum(1 for x in obs if x[0] == t)
        if d:
            s *= (1 - d / at_risk)
            pts.append({"day": t, "still_ok": round(s, 3)})
        at_risk -= n_t
        i += n_t
    return {"n": len(obs), "points": pts}


def durability(exs, weights=None):
    buckets = [{"label": lab, "from_day": lo, "to_day": hi if hi < 10**6 else None, "degraded": 0, "dead": 0}
               for lo, hi, lab in BUCKETS]
    unknown = {"degraded": 0, "dead": 0}
    fail_days, n_fail_reviews = [], 0
    for ex in exs:
        if ex["failure_events"]:
            n_fail_reviews += 1
        for f in ex["failure_events"]:
            sev = "dead" if f.get("severity") == "dead" else "degraded"
            d = f.get("after_days")
            if d is None:
                unknown[sev] += 1
                continue
            fail_days.append(d)
            for b, (lo, hi, _) in zip(buckets, BUCKETS):
                if lo <= d <= hi:
                    b[sev] += 1
                    break
    triggers = {}
    for ex in exs:
        for f in ex["failure_events"]:
            if f.get("trigger"):
                triggers[f["trigger"]] = triggers.get(f["trigger"], 0) + 1
    weights = weights or [1.0] * len(exs)
    wall = sum(weights)
    wfail = sum(w for ex, w in zip(exs, weights) if ex["failure_events"])
    return {
        "n_reviews": len(exs),
        "n_reviews_with_failure": n_fail_reviews,
        # weighted share of reviewers reporting a fault (equals the raw share when not reweighted)
        "fault_share": round(wfail / wall, 3) if wall else 0.0,
        "buckets": buckets,
        "time_not_stated": unknown,
        "median_failure_day": median(fail_days) if fail_days else None,
        "top_triggers": sorted(triggers.items(), key=lambda kv: -kv[1])[:3],
        "survival": kaplan_meier(exs),
    }


def segments(items, min_n=2, population_avg=None):
    """Average star rating by reviewer use case ("reviews from people like me").
    Not reweighted by stars (the rating is what we are averaging). The "overall"
    comparison uses the phone's real average from all ratings when we have it."""
    rated = [(r, ex) for r, ex in items if isinstance(r, (int, float))]
    if not rated:
        return {"overall_avg": population_avg, "n_rated": 0, "segments": []}
    overall = population_avg if population_avg is not None else sum(r for r, _ in rated) / len(rated)
    groups = {}
    for r, ex in rated:
        for uc in ex["reviewer_context"]["use_case"]:
            groups.setdefault(uc, []).append(r)
    segs = [{"use_case": uc, "label": USE_LABEL.get(uc, uc), "avg": round(sum(v) / len(v), 1), "n": len(v)}
            for uc, v in groups.items() if len(v) >= min_n]
    segs.sort(key=lambda s: -s["n"])
    return {"overall_avg": round(overall, 1), "n_rated": len(rated), "segments": segs}


def _join(words):
    words = [w.lower() for w in words]
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def verdict(aspects, dur):
    n = dur["n_reviews"]
    if n == 0:
        return "No reviews found on this page."
    # only aspects with enough mentions, judged by the (weighted) share that is positive
    rows = [a for a in aspects if a["category"] != "overall" and not a["few"] and a["pct_pos"] is not None]
    liked = [a["label"] for a in sorted(rows, key=lambda a: -a["total"]) if a["pct_pos"] >= 70][:2]
    hated = [a["label"] for a in sorted(rows, key=lambda a: -a["total"]) if a["pct_pos"] <= 40][:2]
    parts = []
    if liked:
        parts.append(f"Liked for {_join(liked)}")
    if hated:
        parts.append(f"complaints about {_join(hated)}")
    s = "; ".join(parts) if parts else "Mixed opinions, no clear standout"
    s = s[0].upper() + s[1:] + "."
    f = dur["n_reviews_with_failure"]
    if f:
        s += f" About {round(100 * dur['fault_share'])}% of reviewers report a fault"
        md = dur["median_failure_day"]
        if md is not None:
            s += f", typically around {int(md)} days in"
        s += "."
    return s


def analyze(items, star_histogram=None, total_reviews=None):
    """items: list of (rating or None, normalised extraction).
    star_histogram: {"5": count, ..., "1": count} for ALL ratings of the phone, if known."""
    exs = [ex for _, ex in items]
    weights, info = star_weights([r for r, _ in items], star_histogram)
    asp = aspect_summary(exs, weights)
    dur = durability(exs, weights)
    return {
        "verdict": verdict(asp, dur),
        "aspects": asp,
        "durability": dur,
        "people_like_me": segments(items, population_avg=info.get("population_avg")),
        "review_types": {t: sum(1 for e in exs if e.get("review_type") == t)
                         for t in ("first_impression", "long_term", "update")},
        "sampling": {"n_read": len(exs), "total_reviews": total_reviews,
                     "min_mentions": MIN_MENTIONS, **info},
    }
