const pg = require("pg");
describe("Navigation migration", () => {
  it("creates only approved entities and reliability tables", async () => {
    const pool = new pg.Pool({ connectionString: process.env.NAVIGATION_DATABASE_URL });
    try {
      const tables = await pool.query("select tablename from pg_tables where schemaname='public'");
      const names = tables.rows.map((row) => row.tablename);
      for (const table of [
        "destinations",
        "routes",
        "trips",
        "navigation_sessions",
        "visited_locations",
        "landmarks",
        "outbox_events",
        "inbox_events",
        "dead_letter_events",
        "idempotency_records",
      ])
        expect(names).toContain(table);
      expect(names).not.toContain("reroute_requests");
      const nullable = await pool.query(
        "select is_nullable from information_schema.columns where table_name='navigation_sessions' and column_name='trip_id'",
      );
      expect(nullable.rows[0].is_nullable).toBe("NO");
    } finally {
      await pool.end();
    }
  });
});
