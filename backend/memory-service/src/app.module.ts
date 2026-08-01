import { Module } from "@nestjs/common";

import { MemoryApplicationService } from "./application/memory.service.js";
import { DeletionLifecycleService } from "./application/deletion-lifecycle.service.js";
import {
  ENCRYPTION_ADAPTER,
  MEMORY_REPOSITORY,
  PERMISSION_GATEWAY,
  PRINCIPAL_RESOLVER,
} from "./application/ports.js";
import { HealthController } from "./health/health.controller.js";
import { AesGcmEncryptionAdapter } from "./infrastructure/encryption.js";
import { PostgresMemoryRepository } from "./infrastructure/postgres-memory.repository.js";
import { ConfiguredPrincipalResolver, HttpPermissionGateway } from "./infrastructure/security.js";
import { MemoryCategoryController, MemoryController } from "./presentation/http.js";
import { RequestObservabilityInterceptor } from "./presentation/observability.interceptor.js";

@Module({
  controllers: [MemoryController, MemoryCategoryController, HealthController],
  providers: [
    MemoryApplicationService,
    DeletionLifecycleService,
    RequestObservabilityInterceptor,
    { provide: MEMORY_REPOSITORY, useClass: PostgresMemoryRepository },
    { provide: ENCRYPTION_ADAPTER, useClass: AesGcmEncryptionAdapter },
    { provide: PERMISSION_GATEWAY, useClass: HttpPermissionGateway },
    { provide: PRINCIPAL_RESOLVER, useClass: ConfiguredPrincipalResolver },
  ],
})
export class AppModule {}
