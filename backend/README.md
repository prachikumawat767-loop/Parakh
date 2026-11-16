# Parakh API

Phone review text → `phone_review_v1` JSON, using the Parakh LoRA adapter
(`Prachi076/parakh-gliner2.5-small-lora`) on GLiNER2.5-small. Runs on CPU.

| Endpoint | Body | Returns |
|---|---|---|
| `GET /health` | – | `backend` = `model` or `mock`, load error if any |
| `POST /v1/extract` | `{"text": "..."}` | one extraction + list of post-processing fixes |
| `POST /v1/batch` | `{"texts": ["...", "..."]}` | list of extractions (max 60) |
| `POST /v1/analyze` | `{"product": "...", "reviews": [{"id": "r1", "text": "...", "rating": 4}], "star_histogram": {"5": 2101, "4": 800, "3": 300, "2": 120, "1": 214}, "total_reviews": 253}` (max 120 reviews; histogram optional) | per-review extraction, fixes and tags, plus the panel summary (verdict, aspects with weighted % positive, durability with weighted fault share, people-like-me, sampling info) |

Interactive docs at `/docs`.

## Files

- `app.py`: endpoints, model loading (downloads `parakh_extract.py` from the Hub), cache.
- `postprocess.py`: rule fixes after the model (heating → thermals; non-phones removed from comparisons / previous phone). Every change is returned in `fixes`.
- `aggregate.py`: verdict, aspect counts, durability buckets + Kaplan–Meier curve, ratings by use case, tags.
- `mock_extract.py`: keyword-rule stand-in used when the model cannot load (`PARAKH_MODE=mock`).
- `modal_app.py`: deployment on Modal. `Dockerfile`: deployment on any container host.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PARAKH_MODE` | `auto` | `auto` = model, fall back to rules if loading fails; `model` = fail hard; `mock` = rules only |
| `PARAKH_REPO` | `Prachi076/parakh-gliner2.5-small-lora` | adapter repo on Hugging Face |
| `PARAKH_THRESHOLD` | `0.5` | span confidence threshold |
| `PARAKH_POSTPROCESS` | `1` | `0` returns raw model output |

## Run

```bash
pip install -r requirements.txt
uvicorn app:app --port 7860
```

Deploy: `modal deploy modal_app.py` (see the main README).
