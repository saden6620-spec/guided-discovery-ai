import { Module } from "@nestjs/common";
import { PlanningApplicationService } from "./application/planning.service.js";
import {
  ENCRYPTION_ADAPTER,
  PERMISSION_GATEWAY,
  PLAN_REPOSITORY,
  PRINCIPAL_RESOLVER,
} from "./application/ports.js";
import { HealthController } from "./health/health.controller.js";
import { AesGcmEncryptionAdapter } from "./infrastructure/encryption.js";
import { PostgresPlanRepository } from "./infrastructure/postgres-plan.repository.js";
import { ConfiguredPrincipalResolver, HttpPermissionGateway } from "./infrastructure/security.js";
import { PlanningController } from "./presentation/http.js";
import { RequestObservabilityInterceptor } from "./presentation/observability.interceptor.js";

@Module({
  controllers: [PlanningController, HealthController],
  providers: [
    PlanningApplicationService,
    RequestObservabilityInterceptor,
    { provide: PLAN_REPOSITORY, useClass: PostgresPlanRepository },
    { provide: ENCRYPTION_ADAPTER, useClass: AesGcmEncryptionAdapter },
    { provide: PERMISSION_GATEWAY, useClass: HttpPermissionGateway },
    { provide: PRINCIPAL_RESOLVER, useClass: ConfiguredPrincipalResolver },
  ],
})
export class AppModule {}
