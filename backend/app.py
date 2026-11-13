"""Parakh API: phone review -> phone_review_v1 JSON.

Endpoints
  GET  /health        model status
  POST /v1/extract    one review
  POST /v1/batch      many reviews
  POST /v1/analyze    many reviews + star ratings -> per-review JSON, tags and panel summary

PARAKH_MODE=auto (default) loads the LoRA model from the Hub and falls back to
keyword rules if loading fails; =model fails hard; =mock never loads the model.
"""
import hashlib
import importlib.util
import inspect
import os
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import aggregate
import mock_extract
import postprocess

REPO = os.getenv("PARAKH_REPO", "Prachi076/parakh-gliner2.5-small-lora")
MODE = os.getenv("PARAKH_MODE", "auto")
DEFAULT_THRESHOLD = float(os.getenv("PARAKH_THRESHOLD", "0.5"))  # Track A: 0.5 for per-review display
POSTPROCESS = os.getenv("PARAKH_POSTPROCESS", "1") != "0"
MAX_CHARS = 4000
MAX_REVIEWS = 60

state = {"backend": "loading", "error": None, "mod": None, "model": None, "load_seconds": None}
lock = threading.Lock()  # one inference at a time; CPU-bound anyway
cache: "OrderedDict[str, dict]" = OrderedDict()
CACHE_MAX = 5000


def load_model():
    if state["backend"] in ("model", "mock"):  # already loaded (Modal calls this before startup too)
        return
    t0 = time.time()
    if MODE == "mock":
        state.update(backend="mock")
        return
    try:
        from huggingface_hub import hf_hub_download
        path = hf_hub_download(REPO, "parakh_extract.py")
        spec = importlib.util.spec_from_file_location("parakh_extract", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        model = mod.load_parakh(REPO)
        state.update(backend="model", mod=mod, model=model, load_seconds=round(time.time() - t0, 1))
    except Exception as e:  # noqa: BLE001
        if MODE == "model":
            raise
        state.update(backend="mock", error=f"{type(e).__name__}: {e}")


def _key(text, thr):
    return hashlib.sha1(f"{thr}|{text}".encode()).hexdigest()


def _run(texts, thr):
    """Extract many texts, using the cache, the batch call when available."""
    texts = [t[:MAX_CHARS] for t in texts]
    out, todo = [None] * len(texts), []
    for i, t in enumerate(texts):
        hit = cache.get(_key(t, thr))
        if hit is not None:
            out[i] = hit
        else:
            todo.append(i)
    if todo:
        batch = [texts[i] for i in todo]
        with lock:
            if state["backend"] == "model":
                mod, model = state["mod"], state["model"]
                be = getattr(mod, "batch_extract", None)
                if be and "threshold" in inspect.signature(be).parameters:
                    res = be(batch, model, threshold=thr)
                elif be and thr == 0.5:
                    res = be(batch, model)
                else:
                    res = [mod.extract(t, model, thr) for t in batch]
            else:
                res = [mock_extract.extract(t, None, thr) for t in batch]
        for i, r in zip(todo, res):
            r = aggregate.normalise(r)
            fixes = []
            if POSTPROCESS:
                r, fixes = postprocess.fix(r)
            r = {"ex": r, "fixes": fixes}
            out[i] = r
            cache[_key(texts[i], thr)] = r
            if len(cache) > CACHE_MAX:
                cache.popitem(last=False)
    return out


@asynccontextmanager
async def lifespan(app):
    load_model()
    yield


app = FastAPI(title="Parakh API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ExtractIn(BaseModel):
    text: str = Field(..., min_length=1)
    threshold: Optional[float] = None


class BatchIn(BaseModel):
    texts: List[str]
    threshold: Optional[float] = None


class ReviewIn(BaseModel):
    id: str
    text: str
    rating: Optional[float] = None


class AnalyzeIn(BaseModel):
    product: Optional[str] = None
    url: Optional[str] = None
    reviews: List[ReviewIn]
    threshold: Optional[float] = None


def _meta(t0):
    return {"backend": state["backend"], "schema": "phone_review_v1", "ms": round((time.time() - t0) * 1000)}


@app.get("/")
def root():
    return {"name": "Parakh API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {k: state[k] for k in ("backend", "error", "load_seconds")} | {"repo": REPO, "cached": len(cache)}


@app.post("/v1/extract")
def extract(body: ExtractIn):
    t0 = time.time()
    res = _run([body.text], body.threshold or DEFAULT_THRESHOLD)[0]
    return {"meta": _meta(t0), "result": res["ex"], "fixes": res["fixes"]}


@app.post("/v1/batch")
def batch(body: BatchIn):
    if len(body.texts) > MAX_REVIEWS:
        raise HTTPException(413, f"max {MAX_REVIEWS} texts per call")
    t0 = time.time()
    res = _run(body.texts, body.threshold or DEFAULT_THRESHOLD)
    return {"meta": _meta(t0), "results": [r["ex"] for r in res], "fixes": [r["fixes"] for r in res]}


@app.post("/v1/analyze")
def analyze(body: AnalyzeIn):
    if len(body.reviews) > MAX_REVIEWS:
        raise HTTPException(413, f"max {MAX_REVIEWS} reviews per call")
    t0 = time.time()
    revs = [r for r in body.reviews if r.text.strip()]
    outs = _run([r.text for r in revs], body.threshold or DEFAULT_THRESHOLD)
    exs = [o["ex"] for o in outs]
    items = [(r.rating, ex) for r, ex in zip(revs, exs)]
    return {
        "meta": _meta(t0) | {"n_reviews": len(revs), "product": body.product, "postprocess": POSTPROCESS},
        "reviews": [{"id": r.id, "extraction": o["ex"], "fixes": o["fixes"], "tags": aggregate.review_tags(o["ex"])}
                    for r, o in zip(revs, outs)],
        "summary": aggregate.analyze(items),
    }
