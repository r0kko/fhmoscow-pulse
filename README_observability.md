Observability (Grafana + Loki + Prometheus)

Overview
- Grafana: dashboards, logs Explore, alerting.
- Loki: log storage with query language (LogQL).
- Prometheus: metrics scrape for `/metrics` (already implemented in this app).
 - Access logs: JSON structured via morgan; correlated by `req_id` and `service`.

Stack layout
- File: `infra/observability/docker-compose.observability.yml` — runs Grafana, Loki, Promtail, Prometheus, Alertmanager, and Tempo for local-only observability.
- File: `infra/observability/prometheus.yml` — scrapes the API at `host.docker.internal:3000/metrics`.
- File: `infra/observability/loki-config.yml` — single-binary Loki config with on-disk storage and 7-day retention.
- Folder: `infra/observability/grafana/*` — datasources + starter dashboard provisioning.
- Optional: `docker-compose.loki-logging.yml` — adds Loki logging driver to app/client containers.
- File: `infra/observability/promtail-config.yml` — parses Docker logs and JSON access/app logs; promotes `level` and `type` as Loki labels.
- File: `infra/observability/tempo.yaml` — Tempo config (OTLP gRPC) for distributed traces.

Quick start (now runs with your project)
1) Start the whole project (app + DB + observability):
   - docker compose up --build
   - Grafana: http://localhost:3001 (default admin/admin; change immediately!)
   - Prometheus: http://localhost:9090 | Alertmanager: http://localhost:9093
   - Loki API: http://localhost:3100 | cAdvisor: http://localhost:8081
   - Tempo traces API: http://localhost:3200 (UI & API) | Promtail metrics available on the Docker network at http://promtail:9080/metrics
   - Metrics/logs/traces survive container restarts via named volumes (`prometheus-data`, `loki-data`, `tempo-data`, `promtail-data`). Run `docker compose down -v` only when you intentionally want a clean slate.

2) Expose metrics and probes (already available):
   - API metrics: http://localhost:3000/metrics
     - Optional basic auth: set `METRICS_USER` and `METRICS_PASS` env vars.
      - Email delivery: `email_queue_depth`, `email_queue_enqueued_total`, `email_queue_retry_total`,
        `email_queue_failure_total`, `email_delivery_duration_seconds`.
   - Health: http://localhost:3000/health
   - Liveness: http://localhost:3000/live
   - Readiness: http://localhost:3000/ready (503 until core deps up)

3) Logs are collected via Promtail (no Docker logging plugin needed):
   - Explore logs: Grafana → Explore → Loki → filter `{service="api"}` or `{service="client"}`.
   - JSON fields: Promtail parses JSON access/app logs; you can filter by `level` label and see `req_id`, `status`, `rt_ms` in log details.
   - Derived field: `req_id` is extracted in Grafana and shown in log details for easier correlation.
   - Infra noise control: cAdvisor logs are excluded from Loki to avoid high‑volume, low‑signal messages.

4) Traces (Tempo + OpenTelemetry):
   - Enable in env: `OTEL_ENABLED=true`, `OTEL_SERVICE_NAME=api`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317`.
   - Explore → Tempo to browse traces; logs include `trace_id` to pivot between logs and traces.
   - Tempo listens for OTLP over gRPC (4317) and HTTP (4318) by default — point whichever exporter your SDK supports at the internal service URL.

Persistence & retention
- Prometheus keeps local metrics for 30 days (45 days in `docker-compose.prod.yml`). Adjust the `--storage.tsdb.retention.time` flag in the compose files if you need a different window.
- Loki retains logs for 7 days via `infra/observability/loki-config.yml`. Update `limits_config.retention_period` to change the policy. Log positions are stored on the `promtail-data` volume to avoid duplicates on restarts.
- Tempo stores trace blocks and WAL data on `tempo-data` and keeps traces for 7 days (`compactor -> block_retention`). Increase the retention window only if the disk budget allows it.
- `npm run obs:down` stops the local observability stack but keeps the volumes. Use `docker compose -f infra/observability/docker-compose.observability.yml down -v` only when you want to wipe stored metrics/logs/traces.

Notes
- macOS/Windows: `host.docker.internal` resolves from containers to the host. On Linux, set `loki-url` to the host IP or run all services in one compose project/network.
- Security: change Grafana admin password via `GRAFANA_ADMIN_PASSWORD` env or UI.
- Labels: logs include `service`, `env`, `container_name`, and env `NODE_ENV`, `VERSION`.
- Prometheus scrapes Grafana, Loki, Tempo, Promtail, and Alertmanager metrics. Keep those ports internal in production and rely on the compose defaults (only Grafana is published).
- Metrics endpoint: prefer to protect `/metrics` with basic auth in environments where the API port is exposed. Set `METRICS_USER` and `METRICS_PASS`. Prometheus inside Docker network scrapes internally without auth.

Performance and cAdvisor tuning
- cAdvisor is pinned (dev and prod) and launched with conservative flags:
  - `--docker_only=true`, `--housekeeping_interval=30s`
  - Disabled metrics: `advtcp,percpu,sched,tcp,udp,disk,hugetlb,cpuset,referenced_memory,accelerator`
  - `--store_container_labels=false`, `--event_storage_event_limit=default=0`, verbosity `--v=1`
- Rationale: dramatically reduces log noise and CPU usage without breaking dashboards/alerts that rely on CPU/memory/container limits.
- If you need more detail (e.g., per‑CPU metrics), remove items from `--disable_metrics` in `docker-compose*.yml` and re‑create the `cadvisor` service.

NPM scripts
- `npm run obs:up` — start Grafana/Loki/Prometheus
- `npm run obs:down` — stop and remove the observability stack
- `npm run obs:status` — list containers
- `npm run validate:dashboards` — validate all Grafana dashboards JSON

Troubleshooting
- If Grafana logs show "failed to load dashboard ... invalid character ...":
  - Run `npm run validate:dashboards` to pinpoint invalid JSON.
  - Most common cause is bad escaping inside Explore links; ensure quotes are percent-encoded (`%22`) inside URLs.

Production (docker-compose.prod.yml)
- Stack included: Loki, Promtail, Prometheus, Alertmanager, Grafana, Tempo, cAdvisor, Node Exporter, Postgres/Redis exporters, Blackbox exporter.
- App/client публикуются только через Nginx (80/443). Grafana вынесена на отдельный порт 3001.
- Prometheus/Alertmanager/Loki/Tempo не публикуются наружу (доступ только внутри Docker‑сети).
- Метрики, логи и трейсы сохраняются в именованных volume (`prometheus-data`, `loki-data`, `tempo-data`, `promtail-data`) и переживают рестарты контейнеров и хостов.
- DB 5432 публикуется — доступ ограничивайте файерволом.
- Metrics protection: в production `/metrics` требует Basic Auth — установите `METRICS_USER`/`METRICS_PASS` в `.env`.
- Nginx hardening: см. `infra/nginx/security.conf.example` (deny `/metrics` + заголовки безопасности).

Start production app only (как сейчас):
  docker compose -f docker-compose.prod.yml up -d --pull always --no-build --force-recreate nginx app client

Start with observability:
  docker compose -f docker-compose.prod.yml up -d --pull always --no-build --force-recreate nginx app client loki promtail prometheus alertmanager grafana tempo cadvisor node-exporter postgres-exporter redis-exporter blackbox-exporter

Grafana доступна на `https://<host>:3001` (открывайте доступ файерволом по необходимости).

Operational tips
- Keep log volume reasonable by structuring messages and avoiding high-cardinality labels.
- Prometheus scrapes every 15s by default; adjust in `prometheus.yml` as needed.
- Provisioned dashboards:
  - Pulse → "Pulse App Overview" (jobs + logs)
  - Pulse → "Pulse Email Delivery" (queue depth, DLQ, latency, throughput)
  - Pulse → "Pulse App HTTP" (latency, 5xx, RPS)
  - Pulse → "Pulse App HTTP (Drill)" (route/status variables, top 4xx, one-click log drill)
  - Pulse → "App Golden Signals" (RPS, errors, latency p50/p95/p99, inflight)
  - Pulse → "Runtime (Node.js)" (event loop, GC, memory, readiness)
  - Pulse → "Infra Overview" (container CPU/memory, node memory/load)
  - Pulse → "DB & Cache" (Postgres/Redis exporters, Sequelize pool, DB query p95)
  - Pulse → "Synthetics" (Blackbox probe for `/health`)
  - Pulse → "SLO: Availability (99%)" (burn rates and error ratios across windows)
  - Pulse → "Tracing Overview" (service latency and rates by operation)
  - Pulse → "Security & CSRF Overview" (CSRF accepted/rejected, top error codes, 403/CSRF logs)

- Alerts (Prometheus + Alertmanager)
- Burn-rate SLO (99%), 5xx spikes, event loop lag, process/container memory, CPU usage.
- CSRF: rejection ratio (>1%), EBADCSRFTOKEN spikes.
- Auth: invalid refresh ratio (>5%); Usage: rate-limited surge.
- Email queue: backlog >100, DLQ non-empty, delivery failures, latency p95>15s.
- Edit rules: `infra/observability/alerts.yml`. Receivers: `infra/observability/alertmanager.yml`.
  - To integrate Slack/Telegram/Email, edit `alertmanager.yml` and recreate containers.

Release annotations (Grafana)
- Create Grafana API token (Editor role) and set:
  - `GRAFANA_URL=http://localhost:3001`
  - `GRAFANA_TOKEN=<api-key>`
- Add annotation: `npm run obs:annotate -- "Deploy <short-sha>"`
- CSV reports (admin-only)
  - Job runs: `GET /reports/job-runs.csv?days=30`
  - HTTP errors aggregated by path/status: `GET /reports/http-errors.csv?days=7`
  - UI shortcuts: Admin → Системные операции → buttons “Экспорт запусков …”, “Экспорт ошибок …”

Deep drill UX
- Dashboard variables (route/status/code) allow slicing panels and the logs panel updates accordingly.
- Click any code in the 4xx table to jump to Explore with that `error_code` pre-filled (last 6h).
- Access logs include `req_id`, `route`, `error_code`, `trace_id` for correlation.
