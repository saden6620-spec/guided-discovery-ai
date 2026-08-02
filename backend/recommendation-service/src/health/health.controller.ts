import { Controller, Get, Inject } from "@nestjs/common";
import { RECOMMENDATION_REPOSITORY, type RecommendationRepository } from "../application/ports.js";
@Controller("health")
export class HealthController {
  constructor(
    @Inject(RECOMMENDATION_REPOSITORY) private readonly repository: RecommendationRepository,
  ) {}
  @Get() legacy() {
    return {
      service: "recommendation-service",
      status: "ok",
      version: process.env.SERVICE_VERSION ?? "0.2.0",
    };
  }
  @Get("live") live() {
    return {
      success: true,
      data: {
        status: "UP",
        service: "recommendation-service",
        version: process.env.SERVICE_VERSION ?? "0.2.0",
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    };
  }
  @Get("version") version() {
    return {
      success: true,
      data: { service: "recommendation-service", version: process.env.SERVICE_VERSION ?? "0.2.0" },
      metadata: {},
    };
  }
  @Get("ready") async ready() {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 200);
    try {
      await this.repository.ping(controller.signal);
      if (!(await this.repository.schemaIsCurrent(controller.signal)))
        throw new Error("schema_mismatch");
      return {
        success: true,
        data: {
          status: "UP",
          service: "recommendation-service",
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
