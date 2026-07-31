import "reflect-metadata";

import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "analytics-service";
const SERVICE_PORT = Number.parseInt(process.env.SERVICE_PORT ?? "3013", 10);

interface HealthResponse {
  readonly service: string;
  readonly status: "ok";
  readonly version: string;
}

@Controller()
class HealthController {
  @Get("health")
  getHealth(): HealthResponse {
    return {
      service: SERVICE_NAME,
      status: "ok",
      version: process.env.SERVICE_VERSION ?? "0.1.0",
    };
  }
}

@Module({
  controllers: [HealthController],
})
class AppModule {}

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule);
  application.enableShutdownHooks();
  await application.listen(SERVICE_PORT, "0.0.0.0");
}

void bootstrap();
