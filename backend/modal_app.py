"""Deploy the Parakh API on Modal (serverless, scales to zero, no Docker needed).

  pip install modal
  modal setup                      # opens the browser to log in (once)
  modal deploy modal_app.py        # run from this backend/ folder

Modal prints the public URL, like https://<you>--parakh-api-api.modal.run
Paste that into the Parakh extension popup.

The model weights are downloaded while the image is built, so a cold start only
has to load them from disk. The container shuts down after 5 idle minutes.
"""
import modal

BASE = "fastino/gliner2.5-small-v1"
ADAPTER = "Prachi076/parakh-gliner2.5-small-lora"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("torch", index_url="https://download.pytorch.org/whl/cpu")
    .pip_install("fastapi>=0.110", "pydantic>=2", "huggingface_hub", "peft", "gliner2[local]")
    .run_commands("pip uninstall -y torchao || true")  # PEFT breaks if torchao is present
    .run_commands(
        "python -c \"from huggingface_hub import snapshot_download as s; "
        f"s('{BASE}'); s('{ADAPTER}')\""
    )
    .add_local_file("app.py", "/root/app.py")
    .add_local_file("aggregate.py", "/root/aggregate.py")
    .add_local_file("postprocess.py", "/root/postprocess.py")
    .add_local_file("mock_extract.py", "/root/mock_extract.py")
)

app = modal.App("parakh-api", image=image)


@app.function(cpu=2.0, memory=4096, scaledown_window=300, timeout=600)
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def api():
    import app as parakh  # /root/app.py (the same FastAPI app used locally)

    parakh.load_model()
    return parakh.app
