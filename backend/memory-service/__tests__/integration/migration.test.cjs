const pg = require("pg");

describe("Memory Service migration", () => {
  it("creates only the approved tombstone persistence and exact category catalog", async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const tables = await pool.query("select tablename from pg_tables where schemaname='public'");
      const names = tables.rows.map((row) => row.tablename);
      expect(names).toContain("memory_deletion_ledger");
      expect(names).not.toContain("memory_tombstones");
      const categories = await pool.query("select id,key from memory_categories order by key");
      expect(categories.rowCount).toBe(11);
      expect(categories.rows).toContainEqual({
        id: "00708797-403a-5bc2-bb85-fe8378c50eb9",
        key: "HEALTH",
      });
      const currentVersion = await pool.query(
        "select condeferrable, condeferred from pg_constraint where conname='memories_current_version_fkey'",
      );
      expect(currentVersion.rows[0]).toEqual({ condeferrable: true, condeferred: true });
    } finally {
      await pool.end();
    }
  });
});
