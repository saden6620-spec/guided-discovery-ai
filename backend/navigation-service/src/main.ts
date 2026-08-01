import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadConfiguration } from "@guided-discovery/shared-config";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./presentation/http.js";
import { RequestObservabilityInterceptor } from "./presentation/observability.interceptor.js";
export async function bootstrap(): Promise<void> {
  const configuration = loadConfiguration({
    serviceName: "navigation-service",
    serviceVersion: process.env.SERVICE_VERSION ?? "0.2.0",
    environment: process.env,
    defaultPort: 3005,
  });
  const application = await NestFactory.create(AppModule, { bodyParser: true });
  application.useGlobalFilters(new ApiExceptionFilter());
  application.useGlobalInterceptors(application.get(RequestObservabilityInterceptor));
  application.enableShutdownHooks();
  await application.listen(configuration.port, "0.0.0.0");
}
if (process.env.NODE_ENV !== "test-bootstrap")
  void bootstrap().catch((error: unknown) => {
    Logger.error(error, "NavigationServiceBootstrap");
    process.exitCode = 1;
  });
