Match Protocol Download Integration

- The protocol PDF is fetched server-to-server from the external FH Moscow integration API.
- `MATCH_PROTOCOL_API_KEY` is backend-only and must never be exposed in browser code, query params, or logs.
- Production access depends on both a valid `X-API-Key` and an agreed outbound IP/CIDR allowlist on the FH Moscow side.
- Cache revalidation uses `ETag` and `Last-Modified` from the upstream service.
- Signed protocol snapshots are stored in local S3-backed `files` and tracked in `match_protocol_snapshots`.
- Upstream `401`/`403` are treated as configuration/access failures and returned to clients as controlled `502` errors.
