# ADR-0007: Domain Lifecycle and Disposition Semantics

- Status: Accepted
- Date: 2026-08-01
- Decision scope: M2 Navigation, Recommendation, and Notification lifecycles

## Context

M2 exposes Navigation, Recommendation, and Notification APIs, but the existing documents name operations and logical entities without defining complete lifecycle semantics. ADR-0003 supplies private ingestion boundaries, and ADR-0006 supplies reliable event mechanics; neither decides the domain states or transitions.

## Problem

The draft contracts leave ambiguous whether navigation creates a trip, when trip events occur, whether recommendation dismissal means rejection, and how notification delivery states can be reached without a real provider. Ambiguous transitions produce conflicting APIs, histories, events, and idempotency behavior.

## Decision drivers

- Preserve the public endpoints in `API_SPEC.md`.
- Keep M2 free of AI generation and real external delivery integrations.
- Use explicit, auditable terminal states.
- Do not infer user intent from a generic stop or dismissal action.
- Keep repeated identical actions idempotent.
- Emit lifecycle events only after the owning transaction commits through ADR-0006.
- Retain service ownership and avoid cross-service database access.

## Viable options

### Option A: Minimal binary states

Navigation is active/stopped, recommendations are available/resolved, and notifications are pending/done.

Tradeoffs:

- Small implementation surface.
- Cannot distinguish completion from cancellation, acceptance from dismissal, or delivery from expiry.
- Cannot emit the documented lifecycle events accurately.

### Option B: Implement every future lifecycle state in M2

All navigation pause/resume/replacement behavior, recommendation dispositions, and notification delivery-provider states become operational immediately.

Tradeoffs:

- Complete state models from the beginning.
- Expands M2 into provider integration and product workflows that are not authorized.
- Creates endpoints and behavior not present in `API_SPEC.md`.

### Option C: Define complete canonical lifecycles but activate only documented M2 transitions

The canonical models reserve future states while M2 exposes only the transitions supported by existing public endpoints and private ingestion contracts.

Tradeoffs:

- Prevents later schema redesign.
- Keeps M2 narrow and testable.
- Requires explicit distinction between canonical and M2-reachable states.

## Tradeoff analysis

The minimal-state option cannot distinguish user intent from system outcomes. A comprehensive future-state machine would overcommit M2 to providers and behavior that do not exist. The bounded canonical model preserves durable vocabulary and history while restricting M2 to transitions its skeleton can genuinely execute.

## Recommended decision

Adopt **Option C**.

## Detailed rules

### Navigation ownership and relationships

1. Navigation cannot exist without a Trip.
2. `POST /navigation/start` atomically creates a Trip and its first Navigation Session. M2 does not accept a client-selected Trip ID on this endpoint.
3. A Trip owns one or more Navigation Sessions over its lifetime. Each Navigation Session belongs to exactly one Trip.
4. A Trip may later contain multiple sessions, but M2 creates only one session because pause, resume, and replacement operations are deferred.
5. A route and destination must already be provisioned through ADR-0003 private commands. Starting navigation does not generate either.

### Navigation canonical states

Trip states:

- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `CANCELLED`

Navigation Session states:

- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `CANCELLED`
- `REPLACED`

### Navigation M2 states and transitions

M2 activates only:

- none -> `ACTIVE` through `/navigation/start`.
- `ACTIVE` -> `ACTIVE` through `/navigation/reroute`; the route reference and version change.
- `ACTIVE` -> `COMPLETED` through `/navigation/stop` with `outcome=COMPLETED`.
- `ACTIVE` -> `CANCELLED` through `/navigation/stop` with `outcome=CANCELLED`.

M2 does not activate pause, resume, or replace. `PAUSED` and `REPLACED` are reserved canonical states and must not appear in M2 DTOs, migrations, or events. `REPLACED` is removed as an M2 stop reason.

### Navigation events

- `TripStarted` is written to the outbox in the same transaction that creates the non-null Trip and active session.
- `NavigationRerouted` is emitted after a successful route-reference change.
- `NavigationStopped` is emitted for either terminal outcome and includes the outcome.
- `TripCompleted` is emitted only for `outcome=COMPLETED`.
- `TripCancelled` is emitted only for `outcome=CANCELLED`.
- Stopping navigation never guesses completion; the caller must supply the outcome.

### Navigation idempotency and conflicts

- Repeating start with the same idempotency key and canonical body returns the original Trip/session response.
- A different start while the owner has an active Trip returns `409 NAVIGATION_ALREADY_ACTIVE`.
- Repeating the same reroute against the current route returns the current resource without a second event.
- Repeating the same stop outcome returns the terminal resource.
- Applying a different terminal outcome after completion/cancellation returns `409 NAVIGATION_TERMINAL_STATE_CONFLICT`.

### Recommendation canonical states

- `AVAILABLE`: eligible for presentation/action.
- `ACCEPTED`: user explicitly accepts.
- `REJECTED`: user explicitly states the recommendation is unsuitable.
- `DISMISSED`: user hides or declines to act without asserting that it is unsuitable.
- `IGNORED`: system records that an available recommendation received no user disposition before its attention window ended.
- `EXPIRED`: system determines the recommendation is no longer valid because its validity deadline passed.

Dismissal and rejection are distinct. No terminal state transitions to another terminal state.

### Recommendation M2 transitions

M2 activates:

- none -> `AVAILABLE` through ADR-0003 `CreateRecommendation`.
- `AVAILABLE` -> `ACCEPTED` through `/recommendations/{id}/accept`.
- `AVAILABLE` -> `DISMISSED` through `/recommendations/{id}/dismiss`.
- `AVAILABLE` -> `EXPIRED` through an owning-service expiry job when `expiresAt` passes.

`REJECTED` and `IGNORED` remain canonical but deferred because no documented M2 API or approved system rule produces them.

### Recommendation events and history

- Accept maps to `RecommendationAccepted`.
- Dismiss maps to `RecommendationDismissed`, not `RecommendationRejected`.
- Expiry maps to `RecommendationExpired`.
- `RecommendationRejected` is reserved for a future explicit reject operation.
- Every transition appends one immutable `recommendation_history` record containing recommendation ID, prior state, new state, actor type, actor ID when applicable, event ID, and timestamp.
- Repeating the same terminal action returns the current representation without another history row or event.
- A different action against a terminal recommendation returns `409 RECOMMENDATION_ALREADY_RESOLVED`.
- Reading an expired `AVAILABLE` recommendation first performs the idempotent expiry transition or excludes it from available results.

### Notification canonical states

- `DRAFT`
- `SCHEDULED`
- `QUEUED`
- `PROCESSING`
- `DELIVERED`
- `FAILED`
- `CANCELLED`
- `EXPIRED`

Read/unread is not a delivery state. It is represented by `readAt` and is valid only after a notification has become user-visible through successful delivery.

### Notification M2 transitions

M2 activates only:

- none -> `SCHEDULED` through ADR-0003 `ScheduleNotification`.
- `SCHEDULED` -> `QUEUED` when its schedule becomes due.
- `SCHEDULED` -> `CANCELLED` through the public PATCH action.
- `SCHEDULED` -> `EXPIRED` when its approved expiry deadline passes before queueing.

`DRAFT`, `PROCESSING`, `DELIVERED`, and `FAILED` are canonical but not reachable in the normal M2 runtime. `QUEUED` is an M2 terminal handoff state until a delivery adapter is approved.

M2 does not include a production no-op delivery adapter. Tests may use an isolated fake adapter, but it cannot be enabled by runtime configuration and cannot write production delivery state.

### Notification future delivery rules

- A future provider adapter claims `QUEUED -> PROCESSING`.
- `PROCESSING -> DELIVERED` on confirmed provider success.
- `PROCESSING -> FAILED` after a terminal provider failure or exhausted retries.
- A retryable failure may return to `QUEUED` while its attempt budget remains.
- `DELIVERED`, `FAILED`, `CANCELLED`, and `EXPIRED` are terminal.
- Delivered notifications cannot be cancelled.
- Read/unread updates are accepted only for `DELIVERED`; otherwise return `409 NOTIFICATION_NOT_DELIVERED`.

### Notification events and idempotency

Canonical events are `NotificationScheduled`, `NotificationQueued`, `NotificationProcessing`, `NotificationDelivered`, `NotificationFailed`, `NotificationCancelled`, and `NotificationExpired`.

- Schedule uses the internal command idempotency key.
- Repeating cancellation of a cancelled notification returns the current resource without another event.
- Cancelling queued or later states returns `409 NOTIFICATION_CANNOT_CANCEL` in M2.
- Repeating an identical provider result is deduplicated by event ID and provider operation reference.

## Consequences

### Positive

- Trip and navigation event semantics become unambiguous.
- Recommendation dismissal no longer silently means rejection.
- Notification states do not falsely claim external delivery in M2.
- Terminal-state history and idempotency are deterministic.

### Negative

- Pause, resume, replacement, explicit rejection, ignored disposition, and real delivery remain unavailable in M2.
- Existing draft DTOs and schemas require amendment after approval.
- Clients must provide an explicit navigation stop outcome.

## Security and privacy impact

- Lifecycle events contain identifiers and state metadata only, not routes, recommendation content, or notification bodies.
- Authorization is checked before every transition under ADR-0001.
- Notification recipient details remain opaque references.
- Expiry and cancellation do not bypass retention rules in ADR-0008.

## Failure behavior

- State and outbox event commit atomically under ADR-0006.
- Conflicting terminal actions return 409 without mutation.
- Unknown or unauthorized resources use the approved non-disclosure error behavior.
- Expiry jobs and queue handoffs are idempotent and retryable.

## M2 scope

- Navigation start, status, reroute, and explicit complete/cancel stop.
- Recommendation ingestion, list, accept, dismiss, and expiry.
- Notification scheduling, listing, cancellation, expiry, and queue handoff.

## Deferred scope

- Navigation pause, resume, and replacement.
- Explicit recommendation rejection and ignored-disposition rules.
- Production notification providers, delivery retries, and read/unread behavior.
- AI generation for routes, recommendations, or reminders.

## Affected services

- Navigation Service
- Recommendation Service
- Notification Service
- API Gateway
- Event bus consumers

## Affected documents

- `docs/api/m2/navigation-service.md`
- `docs/api/m2/recommendation-service.md`
- `docs/api/m2/notification-service.md`
- `docs/api/m2/openapi.yaml`
- ADR-0003
- ADR-0006
- `API_SPEC.md`
- `SERVICE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `PRODUCT_SPEC.md`
- `SYSTEM_ARCHITECTURE.md`
- `AI_PIPELINE.md`

## Required follow-up specifications

- Navigation start/stop/reroute DTO amendments.
- Trip and session entity fields and constraints.
- Recommendation state/history schema amendments.
- Notification M2 and deferred-state schema separation.
- Event payloads in the M2 event catalog.
- Explicit error responses in OpenAPI.

## Acceptance criteria

- Every M2 transition has one owner, command, validation rule, event, and idempotency rule.
- Trip events cannot contain a null Trip ID.
- Stopping navigation cannot infer completion.
- Dismissal and rejection remain distinct.
- M2 cannot record a notification as delivered without an approved provider adapter.
- Repeated identical actions do not duplicate history or events.
- Conflicting terminal actions return a documented 409 error.
