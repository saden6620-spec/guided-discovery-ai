# Initial Memory Service migration

Classification: additive, losslessly reversible in empty/development environments.

The generated SQL was hand-audited to add lifecycle checks, deferrable current-version integrity, stable category provisioning, active-link uniqueness, and service-local foreign keys. Production rollback uses application rollback or a reviewed forward compensation; automatic production down migration is prohibited by ADR-0009.

Development down removes only the Memory Service-owned schema objects created here and is tested exclusively against an isolated database.
