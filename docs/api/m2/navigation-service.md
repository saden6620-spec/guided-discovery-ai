# Navigation Service Contract

Status: Final

Navigation Service owns destinations, routes, trips, navigation sessions, visited locations, and landmarks. It consumes provider-neutral provisioned routes and never computes a route in M2.

`POST /navigation/start` atomically creates a Trip and its first active Navigation Session using an existing destination and route, then emits `TripStarted`. A session never exists without a Trip. Only one active Trip/session is allowed per owner. `POST /navigation/reroute` replaces the route reference on the active session and emits `NavigationRerouted`.

`POST /navigation/stop` requires outcome `COMPLETED` or `CANCELLED`. Completed emits `NavigationStopped` and `TripCompleted`; cancelled emits `NavigationStopped` and `TripCancelled`. Stop does not implicitly mean completion. `PAUSED` and `REPLACED` are canonical future states but do not appear in M2 DTOs, migrations, or events. Pause, resume, and session replacement are deferred. Exact DTOs, provisioning, states, conflicts, entities, and events are in the machine-readable and normative contracts.
