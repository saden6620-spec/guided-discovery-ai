import { Controller, Get, Inject } from "@nestjs/common";
import { JOURNAL_REPOSITORY, type JournalRepository } from "../application/ports.js";
@Controller("health")
export class HealthController {
  constructor(@Inject(JOURNAL_REPOSITORY) private readonly repo: JournalRepository) {}
  private data() {
    return { service: "documentation-service", version: process.env.SERVICE_VERSION ?? "0.2.0" };
  }
  @Get() legacy() {
    return { ...this.data(), status: "ok" };
  }
  @Get("live") live() {
    return {
      success: true,
      data: { ...this.data(), status: "UP", timestamp: new Date().toISOString() },
      metadata: {},
    };
  }
  @Get("version") version() {
    return { success: true, data: this.data(), metadata: {} };
  }
  @Get("ready") async ready() {
    await this.repo.ping();
    if (!(await this.repo.schemaIsCurrent())) throw new Error("schema_mismatch");
    return {
      success: true,
      data: {
        ...this.data(),
        status: "UP",
        checks: [{ name: "postgresql", status: "UP" }],
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    };
  }
}
