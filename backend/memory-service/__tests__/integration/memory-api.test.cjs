const { NestFactory } = require("@nestjs/core");
const { Pool } = require("pg");
const request = require("supertest");

const ownerId = "123e4567-e89b-42d3-a456-426614174000";
const headers = {
  Authorization: `Bearer test:${ownerId}`,
  "X-Request-ID": "integration-request-1",
  traceparent: "00-123e4567e89b42d3a456426614174000-123e4567e89b42d3-01",
};

describe("Memory Service integration", () => {
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
    const testing = await import("@guided-discovery/testing");
    globalThis.memoryTestingUtilities = testing;
    application = await NestFactory.create(AppModule, { logger: false });
    application.useGlobalFilters(new ApiExceptionFilter());
    application.useGlobalInterceptors(application.get(RequestObservabilityInterceptor));
    await application.init();
    server = application.getHttpServer();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      "TRUNCATE idempotency_records,outbox_events,inbox_events,dead_letter_events,legal_hold_resources,legal_holds,memory_links,memory_versions,memories,memory_deletion_ledger CASCADE",
    );
    await pool.end();
  });

  afterAll(async () => application?.close());

  it("creates, reads, corrects, archives, restores, links, lists, and idempotently deletes", async () => {
    const created = await request(server)
      .post("/api/v1/memories")
      .set(headers)
      .set("Idempotency-Key", "integration-create-memory-0001")
      .send({
        title: "Museum preference",
        summary: "Prefers quiet museums",
        purpose: "Remember an explicit travel preference",
        categoryId: "c753a23d-78e3-5f91-b9f8-e6de97c0128f",
        sensitivity: "STANDARD",
      })
      .expect(201);
    globalThis.memoryTestingUtilities.assertApiSuccess(created.body);
    expect(created.headers["x-request-id"]).toBe(headers["X-Request-ID"]);
    const memoryId = created.body.data.id;
    expect(created.body.data.version).toBe(1);

    const replay = await request(server)
      .post("/api/v1/memories")
      .set(headers)
      .set("Idempotency-Key", "integration-create-memory-0001")
      .send({
        title: "Museum preference",
        summary: "Prefers quiet museums",
        purpose: "Remember an explicit travel preference",
        categoryId: "c753a23d-78e3-5f91-b9f8-e6de97c0128f",
        sensitivity: "STANDARD",
      })
      .expect(201);
    expect(replay.body.data.id).toBe(memoryId);

    await request(server)
      .post("/api/v1/memories")
      .set(headers)
      .set("Idempotency-Key", "integration-create-memory-0001")
      .send({
        title: "Different",
        summary: "Different",
        purpose: "Different",
        categoryId: "c753a23d-78e3-5f91-b9f8-e6de97c0128f",
        sensitivity: "STANDARD",
      })
      .expect(409);

    const target = await request(server)
      .post("/api/v1/memories")
      .set(headers)
      .set("Idempotency-Key", "integration-create-memory-0002")
      .send({
        title: "Historic districts",
        summary: "Enjoys historic districts",
        purpose: "Connect a related explicit preference",
        categoryId: "c753a23d-78e3-5f91-b9f8-e6de97c0128f",
        sensitivity: "STANDARD",
      })
      .expect(201);

    await request(server).get(`/api/v1/memories/${memoryId}`).set(headers).expect(200);
    const corrected = await request(server)
      .patch(`/api/v1/memories/${memoryId}`)
      .set(headers)
      .send({
        expectedVersion: 1,
        summary: "Prefers quiet history museums",
        correctionReason: "Clarified museum type",
      })
      .expect(200);
    expect(corrected.body.data.verificationStatus).toBe("CORRECTED");
    expect(corrected.body.data.version).toBe(2);
    const linked = await request(server)
      .patch(`/api/v1/memories/${memoryId}`)
      .set(headers)
      .send({
        expectedVersion: 2,
        linkOperations: [
          {
            operation: "CREATE",
            clientReference: "related-historic-districts",
            targetMemoryId: target.body.data.id,
            relationshipType: "RELATED_TO",
          },
        ],
      })
      .expect(200);
    expect(linked.body.data.links).toHaveLength(1);
    await request(server)
      .patch(`/api/v1/memories/${memoryId}`)
      .set(headers)
      .send({
        expectedVersion: 3,
        linkOperations: [
          { operation: "DELETE", id: linked.body.data.links[0].id, expectedVersion: 1 },
        ],
      })
      .expect(200);
    await request(server)
      .patch(`/api/v1/memories/${memoryId}`)
      .set(headers)
      .send({ expectedVersion: 4, state: "ARCHIVED" })
      .expect(200);
    await request(server)
      .patch(`/api/v1/memories/${memoryId}`)
      .set(headers)
      .send({ expectedVersion: 5, state: "ACTIVE" })
      .expect(200);
    await request(server)
      .patch(`/api/v1/memories/${memoryId}`)
      .set(headers)
      .send({ expectedVersion: 1, summary: "stale" })
      .expect(409);

    const listed = await request(server).get("/api/v1/memories?limit=25").set(headers).expect(200);
    globalThis.memoryTestingUtilities.assertApiSuccess(listed.body);
    globalThis.memoryTestingUtilities.assertPageMetadata(listed.body.metadata, 25);
    expect(listed.body.data.some((memory) => memory.id === memoryId)).toBe(true);

    await request(server).delete(`/api/v1/memories/${memoryId}`).set(headers).expect(204);
    await request(server).delete(`/api/v1/memories/${memoryId}`).set(headers).expect(204);
    await request(server).get(`/api/v1/memories/${memoryId}`).set(headers).expect(404);
    const afterDelete = await request(server).get("/api/v1/memories").set(headers).expect(200);
    expect(afterDelete.body.data.some((memory) => memory.id === memoryId)).toBe(false);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const persisted = await pool.query(
      "SELECT count(*) AS ledger_count FROM memory_deletion_ledger WHERE memory_id=$1",
      [memoryId],
    );
    expect(Number(persisted.rows[0].ledger_count)).toBe(1);
    const tombstones = await pool.query(
      "SELECT to_regclass('public.memory_tombstones') AS table_name",
    );
    expect(tombstones.rows[0].table_name).toBeNull();
    const events = await pool.query(
      "SELECT event_type FROM outbox_events ORDER BY created_at,event_id",
    );
    expect(events.rows.map((row) => row.event_type)).toEqual(
      expect.arrayContaining([
        "MemorySaved",
        "MemoryLinkCreated",
        "MemoryLinkDeleted",
        "MemoryArchived",
        "MemoryRestored",
        "MemoryDeletionRequired",
      ]),
    );
    const { MEMORY_REPOSITORY } = await import("../../dist/application/ports.js");
    const reliability = application.get(MEMORY_REPOSITORY);
    const pending = await reliability.pending(100);
    expect(pending.length).toBeGreaterThan(0);
    await reliability.markFailed(pending[0].event.eventId, "TEST_RETRY");
    await reliability.markPublished(pending[0].event.eventId, new Date().toISOString());
    await reliability.recordProcessed("memory-service", pending[0].event, "PROCESSED");
    await reliability.recordProcessed("memory-service", pending[0].event, "PROCESSED");
    expect(await reliability.hasProcessed("memory-service", pending[0].event.eventId)).toBe(true);
    const inboxCount = await pool.query(
      "SELECT count(*) AS count FROM inbox_events WHERE consumer_name='memory-service' AND event_id=$1",
      [pending[0].event.eventId],
    );
    expect(Number(inboxCount.rows[0].count)).toBe(1);
    await pool.end();
  });

  it("returns the immutable system category catalog", async () => {
    const response = await request(server)
      .get("/internal/v1/memory-categories")
      .set(headers)
      .expect(200);
    expect(response.body.data).toHaveLength(11);
  });
});
