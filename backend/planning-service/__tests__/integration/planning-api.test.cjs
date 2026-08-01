const { NestFactory } = require("@nestjs/core");
const { Pool } = require("pg");
const request = require("supertest");
const ownerId = "123e4567-e89b-42d3-a456-426614174000";
const headers = {
  Authorization: `Bearer test:${ownerId}`,
  "X-Request-ID": "planning-integration-1",
  traceparent: "00-123e4567e89b42d3a456426614174000-123e4567e89b42d3-01",
};
describe("Planning Service integration", () => {
  let application;
  let server;
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
    const pool = new Pool({ connectionString: process.env.PLANNING_DATABASE_URL });
    await pool.query(
      "TRUNCATE idempotency_records,outbox_events,inbox_events,dead_letter_events,travel_checklists,reservations,itinerary_items,itineraries CASCADE",
    );
    await pool.end();
  }, 120000);
  afterAll(async () => application?.close());
  it("creates, replays, lists, mutates children and lifecycle, then deletes", async () => {
    const body = {
      title: "Cairo weekend",
      startDate: "2026-08-10",
      endDate: "2026-08-12",
      budgetAmount: "100.00",
      budgetCurrency: "USD",
      notes: "private",
      items: [{ title: "Museum", position: 0 }],
      reservations: [{ providerName: "Rail provider" }],
      checklistItems: [{ title: "Passport", position: 0 }],
    };
    const created = await request(server)
      .post("/api/v1/plans")
      .set(headers)
      .set("Idempotency-Key", "planning-create-00000001")
      .send(body)
      .expect(201);
    expect(created.body.data.version).toBe(1);
    const id = created.body.data.id;
    const replay = await request(server)
      .post("/api/v1/plans")
      .set(headers)
      .set("Idempotency-Key", "planning-create-00000001")
      .send(body)
      .expect(201);
    expect(replay.body.data.id).toBe(id);
    await request(server)
      .post("/api/v1/plans")
      .set(headers)
      .set("Idempotency-Key", "planning-create-00000001")
      .send({ ...body, title: "Other" })
      .expect(409);
    const listed = await request(server).get("/api/v1/plans?limit=25").set(headers).expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.headers["ratelimit-limit"]).toBeDefined();
    const updated = await request(server)
      .patch(`/api/v1/plans/${id}`)
      .set(headers)
      .send({
        expectedVersion: 1,
        status: "ACCEPTED",
        itemOperations: [
          {
            operation: "UPDATE",
            id: created.body.data.items[0].id,
            expectedVersion: 1,
            value: { title: "Museum tour", position: 0 },
          },
          {
            operation: "CREATE",
            clientReference: "dinner",
            value: { title: "Dinner", position: 1 },
          },
        ],
      })
      .expect(200);
    expect(updated.body.data.version).toBe(2);
    expect(updated.body.data.items).toHaveLength(2);
    await request(server)
      .patch(`/api/v1/plans/${id}`)
      .set(headers)
      .send({ expectedVersion: 2, status: "DRAFT" })
      .expect(409);
    await request(server).delete(`/api/v1/plans/${id}`).set(headers).expect(204);
    const after = await request(server).get("/api/v1/plans").set(headers).expect(200);
    expect(after.body.data).toHaveLength(0);
    const pool = new Pool({ connectionString: process.env.PLANNING_DATABASE_URL });
    const events = await pool.query("select payload from outbox_events order by occurred_at");
    expect(events.rowCount).toBe(3);
    await pool.end();
  });
});
