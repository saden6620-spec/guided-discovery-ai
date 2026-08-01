# @guided-discovery/events

Canonical event envelope plus publisher, subscriber, outbox, inbox, serialization, and major-version compatibility abstractions.

The JSON serializer performs minimum envelope validation. Domain-specific payload validation remains the owning event contract’s responsibility. No broker, queue, retry worker, persistence adapter, or domain event is implemented in M2.1.
