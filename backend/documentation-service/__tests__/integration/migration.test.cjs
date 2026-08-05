const { test, expect } = require("@jest/globals");
const { Pool } = require("pg");
test("Documentation migration creates owned entities and one-way media relation", async () => {
  const p = new Pool({ connectionString: process.env.DOCUMENTATION_DATABASE_URL });
  try {
    const t = await p.query("select tablename from pg_tables where schemaname='public'"),
      names = t.rows.map((v) => v.tablename);
    for (const n of [
      "journals",
      "journal_entries",
      "reflections",
      "journal_media_references",
      "outbox_events",
      "inbox_events",
      "dead_letter_events",
      "idempotency_records",
      "legal_holds",
      "legal_hold_resources",
    ])
      expect(names).toContain(n);
    const cols = await p.query(
      "select column_name from information_schema.columns where table_name='journal_media_references'",
    );
    expect(cols.rows.map((v) => v.column_name)).not.toContain("entry_id");
    const entries = await p.query(
      "select column_name from information_schema.columns where table_name='journal_entries'",
    );
    expect(entries.rows.map((v) => v.column_name)).toContain("media_reference_id");
  } finally {
    await p.end();
  }
});
