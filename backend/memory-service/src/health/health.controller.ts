import { Controller, Get, HttpException, Inject } from "@nestjs/common";

import { HealthAggregator, type DependencyHealthCheck } from "@guided-discovery/health";

import { MEMORY_REPOSITORY, type MemoryRepository } from "../application/ports.js";

@Controller()
export class HealthController {
  private readonly health: HealthAggregator;
  constructor(@Inject(MEMORY_REPOSITORY) repository: MemoryRepository) {
    const checks: DependencyHealthCheck[] = [
      {
        name: "postgresql",
        check: async (signal) => {
          await repository.ping(signal);
          return { status: "UP" as const };
        },
      },
      {
        name: "schema",
        check: async (signal) => ({
          status: (await repository.schemaIsCurrent(signal)) ? ("UP" as const) : ("DOWN" as const),
          ...((await repository.schemaIsCurrent(signal)) ? {} : { errorCode: "SCHEMA_MISMATCH" }),
        }),
      },
    ];
    this.health = new HealthAggregator({
      service: process.env.SERVICE_NAME ?? "memory-service",
      version: process.env.SERVICE_VERSION ?? "0.2.0",
      checks,
    });
  }
  @Get("health") legacy() {
    return {
      service: process.env.SERVICE_NAME ?? "memory-service",
      status: "ok",
      version: process.env.SERVICE_VERSION ?? "0.2.0",
    };
  }
  @Get("health/live") live() {
    return { success: true, data: this.health.liveness(), metadata: {} };
  }
  @Get("health/ready") async ready() {
    const data = await this.health.readiness();
    if (data.status === "DOWN") throw new HttpException({ success: true, data, metadata: {} }, 503);
    return { success: true, data, metadata: {} };
  }
  @Get("health/version") version() {
    return { success: true, data: this.health.versionInfo(), metadata: {} };
  }
}
