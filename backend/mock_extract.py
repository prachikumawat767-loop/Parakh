"""Keyword-rule stand-in for the Parakh model.

Used only when the real model cannot load (or PARAKH_MODE=mock), so the
extension can be developed and demoed offline. Output follows
phone_review_v1 and every evidence string is copied from the review.
"""
import re

CATEGORY_WORDS = {
    "battery": ["battery", "backup", "charging", "charge", "drain", "mah", "charger"],
    "camera": ["camera", "photo", "photos", "picture", "selfie", "video", "pics"],
    "display": ["display", "screen", "amoled", "brightness", "refresh rate"],
    "performance": ["performance", "lag", "laggy", "hang", "hangs", "smooth", "processor", "speed", "slow"],
    "thermals": ["heat", "heating", "heats", "hot", "warm", "overheat", "overheating"],
    "sound": ["speaker", "sound", "audio", "volume", "earpiece"],
    "connectivity": ["network", "signal", "wifi", "wi-fi", "bluetooth", "5g", "4g", "sim", "call drop"],
    "build": ["build", "body", "design", "plastic", "glass", "weight", "heavy", "back panel"],
    "software": ["software", "update", "ui", "ads", "bloatware", "android", "os", "bug", "bugs"],
    "service": ["service", "service centre", "service center", "customer care", "warranty", "replacement", "return", "delivery"],
    "value": ["price", "value", "money", "worth", "budget", "cost"],
}

POS_WORDS = ["good", "great", "excellent", "awesome", "amazing", "best", "nice", "superb", "smooth",
             "fast", "love", "happy", "perfect", "decent", "solid", "worth", "bright", "clear", "fine"]
NEG_WORDS = ["bad", "poor", "worst", "terrible", "slow", "lag", "laggy", "hang", "hangs", "drain",
             "drains", "heating", "heats", "hot", "dead", "died", "issue", "problem", "waste",
             "useless", "disappointed", "not good", "not working", "stopped", "broke", "broken", "average"]

DEAD_PAT = re.compile(r"\b(stopped working|not turning on|won'?t turn on|died|dead|completely stopped|not charging at all|bricked)\b", re.I)
DEGRADED_PAT = re.compile(r"\b(heat(s|ing)? up|heating|overheat\w*|hangs?|lag\w*|drains?|draining|green line|flicker\w*|restarts?|"
                          r"not charging|slow charging|call drops?|network issue|stopped)\b", re.I)
AFTER_PAT = re.compile(r"\b(?:after|within|in)\s+(?:just\s+|only\s+)?(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(day|week|month|year)s?\b", re.I)
USING_PAT = re.compile(r"\b(?:using|used|use)\b[^.]{0,30}?\b(?:for|since)\s+(?:the\s+)?(?:last\s+|past\s+)?(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(day|week|month|year)s?\b", re.I)
TRIGGER_PAT = re.compile(r"\bafter\s+(?:the\s+)?(?:latest\s+|recent\s+|new\s+)?(\w+\s+)?(update|software update|os update)\b", re.I)
SERVICE_PAT = re.compile(r"\b(service cent(?:re|er)|replacement|replaced|repair|warranty|returned|return)\b", re.I)
SERVICE_DAYS_PAT = re.compile(r"\b(\d+)\s+days\b", re.I)

NUM_WORDS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
             "seven": 7, "eight": 8, "nine": 9, "ten": 10, "twelve": 12}
UNIT_DAYS = {"day": 1, "week": 7, "month": 30, "year": 365}

USE_CASES = {
    "gaming": ["bgmi", "pubg", "gaming", "games", "game", "cod", "free fire"],
    "photography": ["photography", "photographer", "photos", "instagram"],
    "work": ["office", "work", "meetings", "business"],
    "students": ["student", "college", "classes", "studies"],
    "elderly_parent": ["my mother", "my father", "my mom", "my dad", "my parents", "for mom", "for dad", "grandfather", "grandmother"],
    "basic_use": ["basic use", "calls and whatsapp", "normal use", "daily use"],
}


def to_days(num, unit):
    n = NUM_WORDS.get(num.lower(), None) if not num.isdigit() else int(num)
    return None if n is None else n * UNIT_DAYS[unit.lower()]


def _sentences(text):
    out, start = [], 0
    for m in re.finditer(r"[.!?\n]+", text):
        s = text[start:m.start()].strip()
        if s:
            out.append(s)
        start = m.end()
    tail = text[start:].strip()
    if tail:
        out.append(tail)
    return out


def _has(words, s):
    s = s.lower()
    return [w for w in words if re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", s)]


def _span(s, word):
    """The word as it is written in the sentence (keeps original case)."""
    m = re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", s, re.I)
    return s[m.start():m.end()] if m else word


def _opinion_span(s, aspect):
    """Shortest stretch of the sentence covering the aspect word and the nearest sentiment word."""
    a = re.search(r"(?<![a-z])" + re.escape(aspect) + r"(?![a-z])", s, re.I)
    best = None
    for w in POS_WORDS + NEG_WORDS:
        for m in re.finditer(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", s, re.I):
            d = abs(m.start() - a.start()) if a else 0
            if best is None or d < best[0]:
                best = (d, m)
    if not a or not best or best[0] > 40:
        return s
    m = best[1]
    lo, hi = min(a.start(), m.start()), max(a.end(), m.end())
    return s[lo:hi]


def _polarity(s):
    p, n = len(_has(POS_WORDS, s)), len(_has(NEG_WORDS, s))
    if re.search(r"\bnot (good|great|happy|worth)\b", s, re.I):
        n += 2
    return "pos" if p > n else "neg" if n > p else "neu"


def extract(text, model=None, threshold=0.5):
    res = {
        "opinions": [], "failure_events": [],
        "reviewer_context": {"use_case": [], "prior_device": None, "buyer_is_user": None, "evidence": ""},
        "comparisons": [], "service_experience": None,
        "usage_duration": {"value_days": None, "evidence": ""},
        "review_type": "first_impression",
    }
    for s in _sentences(text):
        cats = [(c, _has(w, s)) for c, w in CATEGORY_WORDS.items()]
        cats = [(c, hits) for c, hits in cats if hits]
        pol = _polarity(s)
        for c, hits in cats[:2]:
            res["opinions"].append({"aspect": _span(s, hits[0]), "category": c, "opinion": _opinion_span(s, hits[0]),
                                    "polarity": pol, "implicit": False, "evidence": s})
        if not cats and pol != "neu":
            res["opinions"].append({"aspect": "", "category": "overall", "opinion": s, "polarity": pol,
                                    "implicit": True, "evidence": s})
        dead, degr = DEAD_PAT.search(s), DEGRADED_PAT.search(s)
        if (dead or degr) and pol != "pos":
            m = AFTER_PAT.search(s)
            trig = TRIGGER_PAT.search(s)
            comp = cats[0][0] if cats else "phone"
            res["failure_events"].append({
                "component": comp, "symptom": (dead or degr).group(0),
                "severity": "dead" if dead else "degraded",
                "after_days": to_days(m.group(1), m.group(2)) if m else None,
                "trigger": trig.group(0) if trig else None, "evidence": s})
        m = USING_PAT.search(s)
        if m and res["usage_duration"]["value_days"] is None:
            res["usage_duration"] = {"value_days": to_days(m.group(1), m.group(2)), "evidence": m.group(0)}
        if SERVICE_PAT.search(s) and res["service_experience"] is None:
            d = SERVICE_DAYS_PAT.search(s)
            kind = SERVICE_PAT.search(s).group(1).lower()
            kind = "repair" if "cent" in kind or "repair" in kind else "replacement" if "replac" in kind \
                else "return" if "return" in kind else "warranty"
            res["service_experience"] = {"type": kind, "days_taken": int(d.group(1)) if d else None,
                                         "resolved": None, "evidence": s}
        for uc, words in USE_CASES.items():
            hit = _has(words, s)
            if hit and uc not in res["reviewer_context"]["use_case"]:
                res["reviewer_context"]["use_case"].append(uc)
                res["reviewer_context"]["evidence"] = res["reviewer_context"]["evidence"] or s
        cm = re.search(r"\b(better|worse)\s+than\s+(?:my\s+)?(?:old\s+|previous\s+)?([A-Z][\w]+(?:\s[\w]+)?)", s)
        if cm:
            res["comparisons"].append({"other_product": cm.group(2), "aspect": cats[0][1][0] if cats else "",
                                       "verdict": cm.group(1).lower(), "evidence": s})
    if re.search(r"\b(update|edit)\s*[:\-]", text, re.I):
        res["review_type"] = "update"
    elif (res["usage_duration"]["value_days"] or 0) > 30 or any((f["after_days"] or 0) > 30 for f in res["failure_events"]):
        res["review_type"] = "long_term"
    return res
