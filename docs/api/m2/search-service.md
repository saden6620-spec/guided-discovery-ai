# Search Service Contract

Status: Final

Search Service owns OpenSearch indexes, index metadata, versioned reindex jobs, and privacy-safe aggregate metrics. It never reads source databases and never stores raw queries, query hashes, reversible query derivatives, user-linked Search logs, or result-linked analytics.

M2 indexes `MEMORY`, `TRIP`, `JOURNAL`, and `LANDMARK` from approved events. Omitting `types` requests those four types. `LEARNING` and `COMMUNITY` remain recognized but unavailable. Responses explicitly report each safely disclosable requested type as `AVAILABLE`, `UNAVAILABLE`, or `UNAUTHORIZED`; unauthorized entries are omitted when their presence would disclose protected information. `partial` is true when at least one safely disclosed requested type is not available. Partial success is 200 when at least one type is available, all operationally unavailable types produce 503, and all unauthorized types produce an empty 200 response.

Ranking is lexical BM25 with title boost 3.0 and body boost 1.0; tie order is score descending, updated time descending, source resource ID ascending. Score is internal and absent from the public response. Public identity is `(type, sourceResourceId)` only. Signed cursors expire in 15 minutes and bind query cache digest, filters, ranking profile, index versions, and continuation state.

Every protected candidate passes synchronous current authorization and deletion checks. Uncertainty fails closed. Older events cannot overwrite a greater source/deletion version. Reindex builds a new version then atomically changes the alias. Search query, result, event, index, and aggregate schemas are in the authoritative OpenAPI, AsyncAPI, database, internal, validation, and operational documents.
