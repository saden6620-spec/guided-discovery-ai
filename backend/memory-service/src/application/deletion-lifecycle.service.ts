import { Inject, Injectable } from "@nestjs/common";

import type { DomainEvent } from "@guided-discovery/events";

import { MEMORY_REPOSITORY, type MemoryRepository } from "./ports.js";

@Injectable()
export class DeletionLifecycleService {
  private readonly requiredConsumers = (process.env.MEMORY_DELETION_CONSUMERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  constructor(@Inject(MEMORY_REPOSITORY) private readonly repository: MemoryRepository) {}

  acknowledge(event: DomainEvent): Promise<boolean> {
    return this.repository.acknowledgeDeletion(event);
  }

  purge(limit = 100): Promise<number> {
    return this.repository.purgeDue(this.requiredConsumers, Math.max(1, Math.min(limit, 1000)));
  }
}
