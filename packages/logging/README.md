# @guided-discovery/logging

Provider-neutral structured logging with severity, service, timestamp, request ID, W3C trace ID, correlation ID, bounded attributes, and recursive sensitive-key redaction.

Callers supply a sink; the package does not select a logger provider or write to the console. Authorization, cookies, credentials, content, bodies, queries, coordinates, and addresses are redacted by default.
