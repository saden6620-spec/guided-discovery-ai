import { Controller, Get, Inject } from "@nestjs/common";
import { NAVIGATION_REPOSITORY, type NavigationRepository } from "../application/ports.js";
@Controller("health")
export class HealthController {
  constructor(@Inject(NAVIGATION_REPOSITORY) private readonly repository: NavigationRepository) {}
  @Get() legacy() {
    return {
      service: "navigation-service",
      status: "ok",
      version: process.env.SERVICE_VERSION ?? "0.2.0",
    };
  }
  @Get("live") live() {
    return {
      success: true,
      data: {
        status: "UP",
        service: "navigation-service",
        version: process.env.SERVICE_VERSION ?? "0.2.0",
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    };
  }
  @Get("version") version() {
    return {
      success: true,
      data: { service: "navigation-service", version: process.env.SERVICE_VERSION ?? "0.2.0" },
      metadata: {},
    };
  }
  @Get("ready") async ready() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 200);
    try {
      await this.repository.ping(controller.signal);
      if (!(await this.repository.schemaIsCurrent(controller.signal)))
        throw new Error("schema_mismatch");
      return {
        success: true,
        data: {
          status: "UP",
          service: "navigation-service",
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
