FROM python:3.11-slim

# HF Spaces runs the container as user 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface PYTHONUNBUFFERED=1
WORKDIR /home/user/app

# CPU-only torch first, so pip doesn't pull the 2 GB CUDA build
RUN pip install --no-cache-dir --user torch --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
# Track A gotcha: PEFT breaks if torchao is present
RUN pip uninstall -y torchao || true

COPY --chown=user . .
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
