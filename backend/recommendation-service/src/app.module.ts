import { Module } from "@nestjs/common";
import { RecommendationApplicationService } from "./application/recommendation.service.js";
import {
  ENCRYPTION_ADAPTER,
  PERMISSION_GATEWAY,
  PRINCIPAL_RESOLVER,
  RECOMMENDATION_REPOSITORY,
} from "./application/ports.js";
import { HealthController } from "./health/health.controller.js";
import { AesGcmEncryptionAdapter } from "./infrastructure/encryption.js";
import { PostgresRecommendationRepository } from "./infrastructure/postgres-recommendation.repository.js";
import { ConfiguredPrincipalResolver, HttpPermissionGateway } from "./infrastructure/security.js";
import { InternalRecommendationController, RecommendationController } from "./presentation/http.js";
import { RequestObservabilityInterceptor } from "./presentation/observability.interceptor.js";
@Module({
  controllers: [RecommendationController, InternalRecommendationController, HealthController],
  providers: [
    RecommendationApplicationService,
    RequestObservabilityInterceptor,
    { provide: RECOMMENDATION_REPOSITORY, useClass: PostgresRecommendationRepository },
    { provide: ENCRYPTION_ADAPTER, useClass: AesGcmEncryptionAdapter },
    { provide: PERMISSION_GATEWAY, useClass: HttpPermissionGateway },
    { provide: PRINCIPAL_RESOLVER, useClass: ConfiguredPrincipalResolver },
  ],
})
export class AppModule {}
