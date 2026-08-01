const { NestFactory } = require("@nestjs/core");
const { Pool } = require("pg");
const request = require("supertest");
const owner = "123e4567-e89b-42d3-a456-426614174000",
  producer = "223e4567-e89b-42d3-a456-426614174000",
  origin = "323e4567-e89b-42d3-a456-426614174000",
  destination = "423e4567-e89b-42d3-a456-426614174000",
  route1 = "523e4567-e89b-42d3-a456-426614174000",
  route2 = "623e4567-e89b-42d3-a456-426614174000";
const headers = {
  Authorization: `Bearer test:${owner}`,
  "X-Request-ID": "navigation-integration-1",
  traceparent: "00-123e4567e89b42d3a456426614174000-123e4567e89b42d3-01",
};
const internal = {
  Authorization: `Bearer service:${producer}:navigation.destination.write,navigation.route.write`,
  "X-Request-ID": "navigation-provisioning-1",
  traceparent: headers.traceparent,
  "Idempotency-Key": "navigation-provision-00001",
};
describe("Navigation Service integration", () => {
  let application, server;
  beforeAll(async () => {
    process.env.APP_ENV = "test";
    process.env.PERMISSION_TEST_ALLOW = "true";
    process.env.NODE_ENV = "test-bootstrap";
    const { AppModule } = await import("../../dist/app.module.js");
    const { ApiExceptionFilter } = await import("../../dist/presentation/http.js");
    const { RequestObservabilityInterceptor } =
      await import("../../dist/presentation/observability.interceptor.js");
    application = await NestFactory.create(AppModule, { logger: false });
    application.useGlobalFilters(new ApiExceptionFilter());
    application.useGlobalInterceptors(application.get(RequestObservabilityInterceptor));
    await application.init();
    server = application.getHttpServer();
    const pool = new Pool({ connectionString: process.env.NAVIGATION_DATABASE_URL });
    await pool.query(
      "TRUNCATE idempotency_records,outbox_events,inbox_events,dead_letter_events,visited_locations,landmarks,navigation_sessions,trips,routes,destinations CASCADE",
    );
    await pool.end();
  }, 120000);
  afterAll(async () => application?.close());
  it("provisions provider-neutral resources and runs the approved lifecycle atomically", async () => {
    const destinationBody = (reference, name, latitude) => ({
      provider: "TEST",
      providerReference: reference,
      name,
      latitude,
      longitude: 31.2357,
      timezone: "Africa/Cairo",
      accessibility: { wheelchairAccessible: true, stepFree: true },
      sourceVersion: 1,
    });
    await request(server)
      .put(`/internal/v1/destinations/${origin}`)
      .set(internal)
      .send(destinationBody("origin", "Origin", 30.01))
      .expect(201);
    await request(server)
      .put(`/internal/v1/destinations/${destination}`)
      .set(internal)
      .send(destinationBody("destination", "Destination", 30.02))
      .expect(201);
    const routeBody = (reference) => ({
      provider: "TEST",
      providerReference: reference,
      originDestinationId: origin,
      destinationId: destination,
      travelMode: "WALKING",
      distanceMeters: 1000,
      durationSeconds: 900,
      polyline: "private-precise-polyline",
      accessibility: { wheelchairAccessible: true, stepFree: true },
      validFrom: "2026-08-01T00:00:00.000Z",
      sourceVersion: 1,
    });
    await request(server)
      .put(`/internal/v1/routes/${route1}`)
      .set(internal)
      .send(routeBody("route-1"))
      .expect(201);
    await request(server)
      .put(`/internal/v1/routes/${route2}`)
      .set(internal)
      .send(routeBody("route-2"))
      .expect(201);
    const body = { destinationId: destination, routeId: route1, travelMode: "WALKING" };
    const started = await request(server)
      .post("/api/v1/navigation/start")
      .set(headers)
      .set("Idempotency-Key", "navigation-start-000001")
      .send(body)
      .expect(201);
    expect(started.body.data.tripId).toBeDefined();
    expect(started.body.data.sessionState).toBe("ACTIVE");
    const replay = await request(server)
      .post("/api/v1/navigation/start")
      .set(headers)
      .set("Idempotency-Key", "navigation-start-000001")
      .send(body)
      .expect(201);
    expect(replay.body.data.id).toBe(started.body.data.id);
    await request(server)
      .post("/api/v1/navigation/start")
      .set(headers)
      .set("Idempotency-Key", "navigation-start-000002")
      .send(body)
      .expect(409);
    const rerouted = await request(server)
      .post("/api/v1/navigation/reroute")
      .set(headers)
      .set("Idempotency-Key", "navigation-reroute-001")
      .send({ sessionId: started.body.data.id, replacementRouteId: route2, expectedVersion: 1 })
      .expect(200);
    expect(rerouted.body.data.routeId).toBe(route2);
    await request(server)
      .post("/api/v1/navigation/reroute")
      .set(headers)
      .set("Idempotency-Key", "navigation-reroute-001")
      .send({ sessionId: started.body.data.id, replacementRouteId: route1, expectedVersion: 2 })
      .expect(409);
    const stopped = await request(server)
      .post("/api/v1/navigation/stop")
      .set(headers)
      .set("Idempotency-Key", "navigation-stop-00001")
      .send({ sessionId: started.body.data.id, outcome: "COMPLETED", expectedVersion: 2 })
      .expect(200);
    expect(stopped.body.data.tripState).toBe("COMPLETED");
    const repeated = await request(server)
      .post("/api/v1/navigation/stop")
      .set(headers)
      .set("Idempotency-Key", "navigation-stop-00002")
      .send({ sessionId: started.body.data.id, outcome: "COMPLETED", expectedVersion: 2 })
      .expect(200);
    expect(repeated.body.data.version).toBe(3);
    await request(server)
      .post("/api/v1/navigation/stop")
      .set(headers)
      .set("Idempotency-Key", "navigation-stop-00003")
      .send({ sessionId: started.body.data.id, outcome: "CANCELLED", expectedVersion: 3 })
      .expect(409);
    const pool = new Pool({ connectionString: process.env.NAVIGATION_DATABASE_URL });
    const events = await pool.query(
      "select event_type,payload::text from outbox_events order by occurred_at,event_type",
    );
    expect(events.rows.map((row) => row.event_type).sort()).toEqual(
      ["NavigationRerouted", "NavigationStopped", "TripCompleted", "TripStarted"].sort(),
    );
    expect(events.rows.some((row) => row.payload.includes("private-precise-polyline"))).toBe(false);
    await pool.end();
  });
});
