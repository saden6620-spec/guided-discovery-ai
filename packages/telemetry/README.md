# @guided-discovery/telemetry

Provider-neutral metrics and tracing interfaces, no-op implementations, request/health metric factories, and a single-use timing helper.

No exporter or external provider is selected in M2.1. Callers must use bounded labels and must never include users, resources, requests, traces, raw routes, Search text, or content as metric labels.
