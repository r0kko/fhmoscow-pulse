Place Prometheus basic auth password for scraping `/metrics` in this directory:

- File: `prometheus_metrics_pass` — contains only the plaintext password (no newline required, but allowed).

Keep this file out of version control. The `docker-compose.prod.yml` mounts it as a Docker secret and Prometheus reads it via `password_file`.

Make sure the app’s `/metrics` credentials match:
- Set in `.env`: `METRICS_USER=metrics` and `METRICS_PASS=<same as file>`.

