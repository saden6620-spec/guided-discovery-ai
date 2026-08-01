import { Module } from "@nestjs/common";
import { NavigationApplicationService } from "./application/navigation.service.js";
import {
  ENCRYPTION_ADAPTER,
  NAVIGATION_REPOSITORY,
  PERMISSION_GATEWAY,
  PRINCIPAL_RESOLVER,
} from "./application/ports.js";
import { HealthController } from "./health/health.controller.js";
import { AesGcmEncryptionAdapter } from "./infrastructure/encryption.js";
import { PostgresNavigationRepository } from "./infrastructure/postgres-navigation.repository.js";
import { ConfiguredPrincipalResolver, HttpPermissionGateway } from "./infrastructure/security.js";
import { InternalNavigationController, NavigationController } from "./presentation/http.js";
import { RequestObservabilityInterceptor } from "./presentation/observability.interceptor.js";
@Module({
  controllers: [NavigationController, InternalNavigationController, HealthController],
  providers: [
    NavigationApplicationService,
    RequestObservabilityInterceptor,
    { provide: NAVIGATION_REPOSITORY, useClass: PostgresNavigationRepository },
    { provide: ENCRYPTION_ADAPTER, useClass: AesGcmEncryptionAdapter },
    { provide: PERMISSION_GATEWAY, useClass: HttpPermissionGateway },
    { provide: PRINCIPAL_RESOLVER, useClass: ConfiguredPrincipalResolver },
  ],
})
export class AppModule {}
