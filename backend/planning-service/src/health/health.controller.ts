import { Controller, Get, Inject } from "@nestjs/common";
import { PLAN_REPOSITORY, type PlanRepository } from "../application/ports.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(PLAN_REPOSITORY) private readonly repository: PlanRepository) {}
  @Get() legacy() {
    return {
      service: "planning-service",
      status: "ok",
      version: process.env.SERVICE_VERSION ?? "0.2.0",
    };
  }
  @Get("live") live() {
    return {
      success: true,
      data: {
        status: "UP",
        service: "planning-service",
        version: process.env.SERVICE_VERSION ?? "0.2.0",
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    };
  }
  @Get("ready") async ready() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 200);
    try {
      await this.repository.ping(controller.signal);
      const current = await this.repository.schemaIsCurrent(controller.signal);
      if (!current) throw new Error("schema_mismatch");
      return {
        success: true,
        data: {
          status: "UP",
          service: "planning-service",
          version: process.env.SERVICE_VERSION ?? "0.2.0",
          checks: [{ name: "postgresql", status: "UP" }],
          timestamp: new Date().toISOString(),
        },
        metadata: {},
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
