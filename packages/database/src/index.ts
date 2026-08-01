import type { PageMetadata, VersionedResource } from "@guided-discovery/shared-types";

export interface PageRequest {
  readonly cursor?: string;
  readonly limit: number;
}

export interface Page<TValue> {
  readonly items: readonly TValue[];
  readonly metadata: PageMetadata;
}

export interface Transaction {
  readonly id: string;
  readonly signal: AbortSignal;
}

export interface TransactionManager {
  run<TValue>(operation: (transaction: Transaction) => Promise<TValue>): Promise<TValue>;
}

export interface Repository<TEntity extends VersionedResource, TIdentifier> {
  findById(id: TIdentifier, transaction?: Transaction): Promise<TEntity | null>;
  list(page: PageRequest, transaction?: Transaction): Promise<Page<TEntity>>;
  insert(entity: TEntity, transaction: Transaction): Promise<TEntity>;
  update(entity: TEntity, expectedVersion: number, transaction: Transaction): Promise<TEntity>;
  delete(id: TIdentifier, expectedVersion: number, transaction: Transaction): Promise<void>;
}

export interface UnitOfWork {
  readonly transaction: Transaction;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface UnitOfWorkFactory {
  begin(signal?: AbortSignal): Promise<UnitOfWork>;
}

export interface MigrationContext {
  readonly service: string;
  readonly environment: string;
  readonly signal: AbortSignal;
}

export interface Migration {
  readonly id: string;
  readonly description: string;
  readonly reversible: boolean;
  up(context: MigrationContext): Promise<void>;
  down?(context: MigrationContext): Promise<void>;
}

export interface MigrationRunner {
  pending(context: MigrationContext): Promise<readonly Migration[]>;
  apply(migration: Migration, context: MigrationContext): Promise<void>;
  revert(migration: Migration, context: MigrationContext): Promise<void>;
}
