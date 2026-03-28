FROM python:3.11-slim

WORKDIR /app

# Install curl for healthcheck (python:3.11-slim doesn't include it)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create data directory for experiment persistence
RUN mkdir -p /app/data

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
