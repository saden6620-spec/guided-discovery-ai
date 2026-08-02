const { NestFactory } = require("@nestjs/core"),
  { Pool } = require("pg"),
  request = require("supertest");
const owner = "123e4567-e89b-42d3-a456-426614174000",
  producer = "a23e4567-e89b-42d3-a456-426614174000",
  traceparent = "00-123e4567e89b42d3a456426614174000-123e4567e89b42d3-01";
describe("Recommendation Service integration", () => {
  let app, server;
  beforeAll(async () => {
    process.env.APP_ENV = "test";
    process.env.PERMISSION_TEST_ALLOW = "true";
    process.env.PERMISSION_TEST_VERSION = "1";
    process.env.NODE_ENV = "test-bootstrap";
    const { AppModule } = await import("../../dist/app.module.js"),
      { ApiExceptionFilter } = await import("../../dist/presentation/http.js"),
      { RequestObservabilityInterceptor } =
        await import("../../dist/presentation/observability.interceptor.js");
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(app.get(RequestObservabilityInterceptor));
    await app.init();
    server = app.getHttpServer();
    const pool = new Pool({ connectionString: process.env.RECOMMENDATION_DATABASE_URL });
    await pool.query(
      "TRUNCATE idempotency_records,outbox_events,inbox_events,dead_letter_events,recommendation_history,recommendation_scores,recommendations CASCADE",
    );
    await pool.end();
  }, 120000);
  afterAll(async () => app?.close());
  it("ingests, lists, accepts, and enforces lifecycle/idempotency/privacy", async () => {
    const body = {
        ownerId: owner,
        category: "TRAVEL",
        title: "Quiet museum",
        summary: "A calm visit",
        rationale: "Matches the supplied non-sensitive constraints",
        confidence: 0.8,
        availableAt: "2026-08-01T00:00:00.000Z",
        expiresAt: "2030-08-02T00:00:00.000Z",
        permissionPolicyRef: "recommendation.owner.v1",
        permissionVersion: 1,
        provenance: { producer, sourceType: "TEST_FIXTURE", sourceVersion: 1 },
        scores: [
          { factor: "SAFETY", score: 0.9 },
          { factor: "ACCESSIBILITY", score: 0.8 },
        ],
      },
      internal = {
        Authorization: `Bearer service:${producer}:recommendation.ingest`,
        "X-Request-ID": "recommendation-create-1",
        traceparent,
        "Idempotency-Key": "recommendation-create-0001",
      };
    const created = await request(server)
      .post("/internal/v1/recommendations")
      .set(internal)
      .send(body)
      .expect(201);
    expect(created.body.data.status).toBe("AVAILABLE");
    const replay = await request(server)
      .post("/internal/v1/recommendations")
      .set(internal)
      .send(body)
      .expect(201);
    expect(replay.body.data.id).toBe(created.body.data.id);
    await request(server)
      .post("/internal/v1/recommendations")
      .set({
        ...internal,
        Authorization: "Bearer service:intruder:other.scope",
        "Idempotency-Key": "recommendation-create-0002",
      })
      .send({ ...body, provenance: { ...body.provenance, producer: "intruder" } })
      .expect(403);
    process.env.PERMISSION_TEST_VERSION = "2";
    await request(server)
      .post("/internal/v1/recommendations")
      .set({ ...internal, "Idempotency-Key": "recommendation-create-0003" })
      .send(body)
      .expect(403);
    process.env.PERMISSION_TEST_VERSION = "1";
    const headers = {
      Authorization: `Bearer test:${owner}`,
      "X-Request-ID": "recommendation-list-1",
      traceparent,
    };
    const listed = await request(server)
      .get("/api/v1/recommendations?category=TRAVEL&limit=25")
      .set(headers)
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain("permissionPolicyRef");
    const accepted = await request(server)
      .post(`/api/v1/recommendations/${created.body.data.id}/accept`)
      .set({ ...headers, "Idempotency-Key": "recommendation-accept-0001" })
      .send({ expectedVersion: 1 });
    if (accepted.status !== 200) throw new Error(JSON.stringify(accepted.body));
    expect(accepted.body.data.status).toBe("ACCEPTED");
    await request(server)
      .post(`/api/v1/recommendations/${created.body.data.id}/accept`)
      .set({ ...headers, "Idempotency-Key": "recommendation-accept-0001" })
      .send({ expectedVersion: 1 })
      .expect(200);
    await request(server)
      .post(`/api/v1/recommendations/${created.body.data.id}/dismiss`)
      .set({ ...headers, "Idempotency-Key": "recommendation-dismiss-001" })
      .send({ expectedVersion: 2 })
      .expect(409);
    const pool = new Pool({ connectionString: process.env.RECOMMENDATION_DATABASE_URL }),
      history = await pool.query("select * from recommendation_history order by subject_version"),
      events = await pool.query("select event_type,payload::text from outbox_events");
    expect(history.rows).toHaveLength(2);
    expect(events.rows.map((r) => r.event_type)).toEqual(["RecommendationAccepted"]);
    expect(events.rows[0].payload).not.toContain("Quiet museum");
    await pool.end();
  });
});
