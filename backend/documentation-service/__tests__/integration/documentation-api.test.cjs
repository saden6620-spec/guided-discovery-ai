const { beforeAll, afterAll, beforeEach, test, expect } = require("@jest/globals");
const request = require("supertest");
const { Pool } = require("pg");
let app, server, pool;
jest.setTimeout(30000);
const owner = "11111111-1111-4111-8111-111111111111",
  auth = `Bearer test:${owner}`;
beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.PERMISSION_TEST_ALLOW = "true";
  const { Test } = await import("@nestjs/testing"),
    { AppModule } = await import("../../dist/app.module.js"),
    { ApiExceptionFilter } = await import("../../dist/presentation/http.js");
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  server = app.getHttpServer();
  pool = new Pool({ connectionString: process.env.DOCUMENTATION_DATABASE_URL });
}, 30000);
beforeEach(async () => {
  await pool.query(
    "TRUNCATE legal_hold_resources,legal_holds,idempotency_records,outbox_events,inbox_events,dead_letter_events,reflections,journal_entries,journal_media_references,journals CASCADE",
  );
});
afterAll(async () => {
  if (app) await app.close();
  if (pool) await pool.end();
});
test("creates text journal, atomically adds media entry/reflection, preserves omitted children and deletes privately", async () => {
  const created = await request(server)
    .post("/api/v1/journals")
    .set("Authorization", auth)
    .set("Idempotency-Key", "create-journal-0001")
    .send({
      title: "Cairo journal",
      entries: [
        {
          type: "TEXT",
          content: "Arrived safely",
          occurredAt: "2026-08-05T10:00:00.000Z",
          position: 0,
        },
      ],
    })
    .expect(201);
  expect(created.body.data.permissionPolicyRef).toBeUndefined();
  const journal = created.body.data,
    textId = journal.entries[0].id;
  const mediaId = crypto.randomUUID();
  const updated = await request(server)
    .patch(`/api/v1/journals/${journal.id}`)
    .set("Authorization", auth)
    .send({
      expectedVersion: 1,
      mediaOperations: [
        {
          operation: "CREATE",
          clientReference: "photo-ref",
          value: { mediaId, mediaKind: "PHOTO", caption: "Museum exterior", position: 0 },
        },
      ],
      entryOperations: [
        {
          operation: "CREATE",
          clientReference: "photo-entry",
          value: {
            type: "PHOTO_REFERENCE",
            mediaReferenceClientReference: "photo-ref",
            occurredAt: "2026-08-05T11:00:00.000Z",
            position: 1,
          },
        },
      ],
      reflectionOperations: [
        {
          operation: "CREATE",
          clientReference: "reflection-1",
          value: {
            entryId: textId,
            text: "I learned to slow down.",
            occurredAt: "2026-08-05T12:00:00.000Z",
            position: 0,
          },
        },
      ],
    })
    .expect(200);
  expect(updated.body.data.entries).toHaveLength(2);
  expect(updated.body.data.entries[0].id).toBe(textId);
  const photoEntryId = updated.body.data.entries[1].id;
  expect(updated.body.data.entries[1].mediaReferenceId).toBe(updated.body.data.media[0].id);
  expect(updated.body.data.media[0].entryId).toBeUndefined();
  const titleOnly = await request(server)
    .patch(`/api/v1/journals/${journal.id}`)
    .set("Authorization", auth)
    .send({ expectedVersion: 2, title: "Updated title" })
    .expect(200);
  expect(titleOnly.body.data.entries).toHaveLength(2);
  await request(server)
    .patch(`/api/v1/journals/${journal.id}`)
    .set("Authorization", auth)
    .send({
      expectedVersion: 3,
      entryOperations: [{ operation: "DELETE", id: photoEntryId, expectedVersion: 1 }],
    })
    .expect(200);
  const child = await pool.query("select deleted_at from journal_entries where id=$1", [
    photoEntryId,
  ]);
  expect(child.rows[0].deleted_at).not.toBeNull();
  await request(server)
    .delete(`/api/v1/journals/${journal.id}`)
    .set("Authorization", auth)
    .expect(204);
  const listed = await request(server)
    .get("/api/v1/journals")
    .set("Authorization", auth)
    .expect(200);
  expect(listed.body.data).toEqual([]);
  const events = await pool.query(
    "select event_type,payload::text payload from outbox_events order by occurred_at",
  );
  expect(events.rows.map((v) => v.event_type)).toEqual([
    "JournalChanged",
    "JournalChanged",
    "JournalChanged",
    "JournalChanged",
    "JournalChanged",
  ]);
  expect(events.rows.some((v) => v.payload.includes("Arrived safely"))).toBe(false);
});
test("rejects duplicate or mismatched media dependencies atomically", async () => {
  const c = await request(server)
    .post("/api/v1/journals")
    .set("Authorization", auth)
    .set("Idempotency-Key", "create-journal-0002")
    .send({ title: "Private" })
    .expect(201);
  await request(server)
    .patch(`/api/v1/journals/${c.body.data.id}`)
    .set("Authorization", auth)
    .send({
      expectedVersion: 1,
      mediaOperations: [
        {
          operation: "CREATE",
          clientReference: "media-x",
          value: { mediaId: crypto.randomUUID(), mediaKind: "PHOTO", position: 0 },
        },
      ],
      entryOperations: [
        {
          operation: "CREATE",
          clientReference: "entry-x",
          value: {
            type: "VOICE_REFERENCE",
            mediaReferenceClientReference: "media-x",
            occurredAt: "2026-08-05T10:00:00.000Z",
            position: 0,
          },
        },
      ],
    })
    .expect(422);
  const counts = await pool.query(
    "select (select count(*) from journal_entries) entries,(select count(*) from journal_media_references) media",
  );
  expect(Number(counts.rows[0].entries)).toBe(0);
  expect(Number(counts.rows[0].media)).toBe(0);
});
test("replays creation idempotently and fails closed when Permission Service is unavailable", async () => {
  const body = { title: "Idempotent journal" };
  const first = await request(server)
    .post("/api/v1/journals")
    .set("Authorization", auth)
    .set("Idempotency-Key", "create-journal-0003")
    .send(body)
    .expect(201);
  const replay = await request(server)
    .post("/api/v1/journals")
    .set("Authorization", auth)
    .set("Idempotency-Key", "create-journal-0003")
    .send(body)
    .expect(201);
  expect(replay.body.data.id).toBe(first.body.data.id);
  process.env.PERMISSION_TEST_ALLOW = "false";
  await request(server)
    .post("/api/v1/journals")
    .set("Authorization", auth)
    .set("Idempotency-Key", "create-journal-0004")
    .send({ title: "Must fail" })
    .expect(503);
  process.env.PERMISSION_TEST_ALLOW = "true";
  const count = await pool.query("select count(*) from journals");
  expect(Number(count.rows[0].count)).toBe(1);
});
test("legal hold prevents purge scheduling while deletion stays immediately invisible", async () => {
  const created = await request(server)
    .post("/api/v1/journals")
    .set("Authorization", auth)
    .set("Idempotency-Key", "create-journal-0005")
    .send({ title: "Held journal" })
    .expect(201);
  const holdId = crypto.randomUUID();
  await pool.query(
    "insert into legal_holds(id,authority_ref,reason_category,actor_id,created_at,updated_at,version) values($1,'legal-case','LITIGATION',$2,now(),now(),1)",
    [holdId, owner],
  );
  await pool.query(
    "insert into legal_hold_resources(hold_id,resource_type,resource_id,created_at) values($1,'JOURNAL',$2,now())",
    [holdId, created.body.data.id],
  );
  await request(server)
    .delete(`/api/v1/journals/${created.body.data.id}`)
    .set("Authorization", auth)
    .expect(204);
  const row = await pool.query("select deleted_at,purge_after from journals where id=$1", [
    created.body.data.id,
  ]);
  expect(row.rows[0].deleted_at).not.toBeNull();
  expect(row.rows[0].purge_after).toBeNull();
  const list = await request(server).get("/api/v1/journals").set("Authorization", auth).expect(200);
  expect(list.body.data).toEqual([]);
});
