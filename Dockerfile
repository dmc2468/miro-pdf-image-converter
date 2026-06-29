FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY webapp/requirements.txt /app/webapp/requirements.txt

RUN pip install --no-cache-dir -r /app/webapp/requirements.txt

COPY webapp /app/webapp

EXPOSE 8080

CMD ["uvicorn", "webapp.main:app", "--host", "0.0.0.0", "--port", "8080"]
