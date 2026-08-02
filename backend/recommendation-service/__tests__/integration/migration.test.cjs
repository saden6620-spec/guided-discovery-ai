const { Pool } = require("pg");
describe("Recommendation migration", () => {
  it("creates approved owned entities and constraints", async () => {
    const pool = new Pool({ connectionString: process.env.RECOMMENDATION_DATABASE_URL });
    try {
      const tables = await pool.query("select tablename from pg_tables where schemaname='public'");
      const names = tables.rows.map((r) => r.tablename);
      for (const name of [
        "recommendations",
        "recommendation_scores",
        "recommendation_history",
        "outbox_events",
        "inbox_events",
        "dead_letter_events",
        "idempotency_records",
      ])
        expect(names).toContain(name);
      for (const forbidden of [
        "memories",
        "itineraries",
        "trips",
        "safety_attributes",
        "accessibility_attributes",
      ])
        expect(names).not.toContain(forbidden);
      const fields = await pool.query(
        "select column_name,is_nullable from information_schema.columns where table_name='recommendations' and column_name in ('permission_policy_ref','permission_version') order by column_name",
      );
      expect(fields.rows).toEqual([
        { column_name: "permission_policy_ref", is_nullable: "NO" },
        { column_name: "permission_version", is_nullable: "NO" },
      ]);
    } finally {
      await pool.end();
    }
  });
});
