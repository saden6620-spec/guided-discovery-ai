FROM python:3.13.14-slim-bookworm

WORKDIR /service

COPY ai/orchestrator/ ./

RUN python -m pip install --no-cache-dir .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:application", "--host", "0.0.0.0", "--port", "8000"]

