# Initial Navigation Service migration

Creates only Navigation-owned M2.4 entities and reliability tables. The migration is losslessly reversible on an empty/development database. Production rollback follows ADR-0009 forward compensation; no cross-service object is modified.
