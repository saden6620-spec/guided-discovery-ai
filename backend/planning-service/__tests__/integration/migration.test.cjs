const pg = require("pg");
describe("Planning migration", () => {
  it("creates the aggregate, constraints, and reliability tables", async () => {
    const pool = new pg.Pool({ connectionString: process.env.PLANNING_DATABASE_URL });
    try {
      const tables = await pool.query("select tablename from pg_tables where schemaname='public'");
      const names = tables.rows.map((row) => row.tablename);
      for (const table of [
        "itineraries",
        "itinerary_items",
        "reservations",
        "travel_checklists",
        "outbox_events",
        "inbox_events",
        "dead_letter_events",
        "idempotency_records",
      ])
        expect(names).toContain(table);
      const columns = await pool.query(
        "select table_name,column_name,character_maximum_length from information_schema.columns where (table_name='itinerary_items' and column_name='location_reference') or (table_name='reservations' and column_name='provider_name') order by table_name",
      );
      expect(columns.rows).toEqual([
        {
          table_name: "itinerary_items",
          column_name: "location_reference",
          character_maximum_length: 500,
        },
        { table_name: "reservations", column_name: "provider_name", character_maximum_length: 200 },
      ]);
    } finally {
      await pool.end();
    }
  });
});
