# Model: training and evaluation

The trained adapter and `parakh_extract.py` live on Hugging Face:
[Prachi076/parakh-gliner2.5-small-lora](https://huggingface.co/Prachi076/parakh-gliner2.5-small-lora).

```python
from parakh_extract import load_parakh, extract
model = load_parakh("Prachi076/parakh-gliner2.5-small-lora")
print(extract("Battery died after 3 months. Service centre took 12 days.", model, 0.5))
```

## Pipeline

1. **Data** – Amazon Reviews 2023 (McAuley Lab), Cell_Phones_and_Accessories, joined with metadata to keep real phones (price > ~$80, no cases/cables/chargers), reviews over 30 words, oversampling reviews that mention time or service. Pool: 12,962 reviews from 2,381 phones.
2. **Silver labels** – Qwen2.5-7B-Instruct-AWQ via vLLM on Kaggle T4 ×2, temperature 0, 3 worked examples, forced-JSON mode. 7,800 labelled; 7,534 kept after filters (bad JSON, labels outside the allowed set, evidence not found in the review).
3. **Training** – GLiNER2.5-small + LoRA (fp16, T4), 23 entity labels + review_type classification, 6,672 train / 351 val / 300 held out, 8 epochs, ~18 min.
4. **Grouping** – spans → `phone_review_v1` (aspect attaches to the nearest opinion in the same sentence, one category per span, durations to days).
5. **Evaluation** – validation against teacher labels; zero-shot on the human-labelled ACOS-Laptop test set; rule-based baseline (spaCy POS + noun chunks + PMI bigrams, Hu & Liu lexicon, WordNet categories).

## Files to add here

From the Kaggle notebooks:

- `parakh_extract.py` – loading, extraction, grouping (v1.1)
- `classical_baseline.py` – rule-based baseline
- `acos_eval.py` – ACOS-Laptop evaluation
- `notebooks/` – data filtering, teacher labelling, training, evaluation

Datasets are not included in this repository; download them from their sources.
