"""Product-layer fixes applied after the model (PARAKH_POSTPROCESS=0 turns them off).

Two known model weaknesses that show up in Indian phone reviews:
1. Thermals is a thin training class (62 examples), so heating complaints get
   other categories ("heats up a lot" -> display). Opinions/failures whose own
   text is about heat are moved to thermals.
2. Things that are not phones get read as phones: game names ("BGMI") and
   plain phrases ("a middle class family") as prior_device / compared product.
   A name is kept only if it has a phone brand or a capitalised word + model number.

Every change is listed in `fixes`, so the UI can show it and the report can
keep model accuracy separate from what the product layer adds.
"""
import re

HEAT = re.compile(r"\b(heat\w*|hot|warm\w*|overheat\w*|temperature|burn\w*)\b", re.I)
GAMES = {"bgmi", "pubg", "pubg mobile", "free fire", "freefire", "cod", "cod mobile", "call of duty",
         "genshin", "genshin impact", "valorant", "minecraft", "asphalt", "asphalt 9", "clash of clans",
         "fortnite", "roblox", "candy crush", "ludo", "ludo king"}


BRANDS = re.compile(
    r"\b(redmi|xiaomi|mi|poco|samsung|galaxy|iphone|apple|realme|narzo|oppo|vivo|iqoo|oneplus|nord|motorola|moto|"
    r"nokia|infinix|tecno|itel|pixel|google|nothing|cmf|lava|micromax|honor|huawei|asus|rog|sony|xperia|lg|"
    r"lenovo|meizu|zte|nubia|htc|blackberry)\b", re.I)


def _is_game(name):
    return bool(name) and name.strip().lower() in GAMES


def _looks_like_phone(name):
    """A phone name has a brand ("Redmi Note 10", "iPhone 12") or a model number
    with a capitalised word ("Note 10", "F23"). "a middle class family" has neither."""
    if not name:
        return False
    if BRANDS.search(name):
        return True
    return bool(re.search(r"\b[A-Z][\w+]*\s?\d", name))


def fix(ex):
    fixes = []
    for o in ex["opinions"]:
        if o.get("category") != "thermals" and HEAT.search(o.get("opinion") or ""):
            fixes.append(f"opinion “{o.get('opinion')}”: {o.get('category')} -> thermals")
            o["category"] = "thermals"
            if (o.get("aspect") or "").lower() not in (o.get("opinion") or "").lower():
                o["aspect"] = "heating"
    for f in ex["failure_events"]:
        if f.get("component") != "thermals" and HEAT.search(f.get("symptom") or ""):
            fixes.append(f"failure “{f.get('symptom')}”: {f.get('component')} -> thermals")
            f["component"] = "thermals"
    rc = ex["reviewer_context"]
    pd = rc.get("prior_device")
    if _is_game(pd):
        fixes.append(f"prior_device “{pd}” is a game -> removed")
        rc["prior_device"] = None
        if "gaming" not in rc["use_case"]:
            rc["use_case"].append("gaming")
    elif pd and not _looks_like_phone(pd):
        fixes.append(f"prior_device “{pd}” is not a phone name -> removed")
        rc["prior_device"] = None
    kept = []
    for c in ex["comparisons"]:
        op = c.get("other_product")
        if _is_game(op):
            fixes.append(f"comparison with “{op}” is a game -> removed")
        elif not _looks_like_phone(op):
            fixes.append(f"comparison with “{op}” is not a phone name -> removed")
        else:
            kept.append(c)
    ex["comparisons"] = kept
    return ex, fixes
