# Initial Recommendation Service migration

Creates only Recommendation-owned domain and reliability tables. Apply with Prisma migrate. The reviewed reversal drops those tables in dependency order; production rollback uses ADR-0009 forward compensation after data exists.
