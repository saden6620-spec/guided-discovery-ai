# @guided-discovery/errors

Standard application exceptions and safe HTTP error mapping matching the approved `{ success, error, metadata }` OpenAPI envelope.

The framework includes validation, conflict, authentication/authorization, infrastructure, and internal failures. Unknown exceptions become a content-free `500 INTERNAL_ERROR`; causes are retained internally but never serialized.
