import { Module } from "@nestjs/common";
import { DocumentationApplicationService } from "./application/documentation.service.js";
import {
  ENCRYPTION_ADAPTER,
  JOURNAL_REPOSITORY,
  PERMISSION_GATEWAY,
  PRINCIPAL_RESOLVER,
} from "./application/ports.js";
import { HealthController } from "./health/health.controller.js";
import { AesGcmEncryptionAdapter } from "./infrastructure/encryption.js";
import { PostgresJournalRepository } from "./infrastructure/postgres-journal.repository.js";
import { ConfiguredPrincipalResolver, HttpPermissionGateway } from "./infrastructure/security.js";
import { DocumentationController } from "./presentation/http.js";
import { RequestObservabilityInterceptor } from "./presentation/observability.interceptor.js";
@Module({
  controllers: [DocumentationController, HealthController],
  providers: [
    DocumentationApplicationService,
    RequestObservabilityInterceptor,
    { provide: JOURNAL_REPOSITORY, useClass: PostgresJournalRepository },
    { provide: ENCRYPTION_ADAPTER, useClass: AesGcmEncryptionAdapter },
    { provide: PERMISSION_GATEWAY, useClass: HttpPermissionGateway },
    { provide: PRINCIPAL_RESOLVER, useClass: ConfiguredPrincipalResolver },
  ],
})
export class AppModule {}
