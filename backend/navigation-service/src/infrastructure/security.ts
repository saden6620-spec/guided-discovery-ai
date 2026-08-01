import { Injectable } from "@nestjs/common";
import {
  ApplicationException,
  AuthorizationException,
  InfrastructureException,
} from "@guided-discovery/errors";
import type { PermissionGateway, PrincipalResolver } from "../application/ports.js";
import type { Principal } from "../domain/navigation.js";
@Injectable()
export class ConfiguredPrincipalResolver implements PrincipalResolver {
  async resolveUser(value?: string): Promise<Principal> {
    return this.resolve(value, "USER");
  }
  async resolveService(value?: string): Promise<Principal> {
    return this.resolve(value, "SERVICE");
  }
  private async resolve(value: string | undefined, kind: "USER" | "SERVICE"): Promise<Principal> {
    if (value === undefined || !value.startsWith("Bearer ")) {
      if (kind === "SERVICE")
        throw new ApplicationException({
          code: "SERVICE_AUTHENTICATION_REQUIRED",
          message: "Authentication is required.",
          httpStatus: 401,
        });
      throw new AuthorizationException("AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
    const credential = value.slice(7);
    if ((process.env.APP_ENV ?? "development") === "test") {
      if (kind === "USER" && credential.startsWith("test:"))
        return { id: credential.slice(5), kind, scopes: new Set() };
      if (kind === "SERVICE" && credential.startsWith("service:")) {
        const [, id, scopes = ""] = credential.split(":");
        return { id: id ?? "", kind, scopes: new Set(scopes.split(",").filter(Boolean)) };
      }
    }
    throw new InfrastructureException(
      "AUTHENTICATION_UNAVAILABLE",
      "The authentication provider is unavailable.",
      { retryable: true },
    );
  }
}
@Injectable()
export class HttpPermissionGateway implements PermissionGateway {
  async authorize(input: Parameters<PermissionGateway["authorize"]>[0]): Promise<void> {
    if (
      (process.env.APP_ENV ?? "development") === "test" &&
      process.env.PERMISSION_TEST_ALLOW === "true"
    )
      return;
    const endpoint = process.env.PERMISSION_SERVICE_URL;
    if (endpoint === undefined)
      throw new InfrastructureException(
        "PERMISSION_UNAVAILABLE",
        "Permission validation is unavailable.",
        { retryable: true },
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);
    try {
      const response = await fetch(
        `${endpoint.replace(/\/$/u, "")}/internal/v1/authorization/check`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SERVICE_AUTH_TOKEN ?? ""}`,
            "Content-Type": "application/json",
            "X-Request-ID": crypto.randomUUID(),
            traceparent: "00-00000000000000000000000000000001-0000000000000001-01",
          },
          body: JSON.stringify({
            principalId: input.principal.id,
            actorType: input.principal.kind,
            action: input.action,
            resourceType: "NAVIGATION_SESSION",
            resourceId: input.resourceId,
            ownerId: input.ownerId,
            purpose: input.purpose,
            sensitivity: input.sensitivity ?? "HIGHLY_SENSITIVE",
            permissionPolicyRef: "navigation.owner.v1",
            permissionPolicyVersion: 1,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`permission_status_${response.status}`);
      const result = (await response.json()) as { data?: { decision?: string } };
      if (result.data?.decision !== "ALLOW")
        throw new AuthorizationException("ACCESS_DENIED", "Access is denied.");
    } catch (error) {
      if (error instanceof AuthorizationException) throw error;
      throw new InfrastructureException(
        "PERMISSION_UNAVAILABLE",
        "Permission validation is unavailable.",
        { cause: error, retryable: true },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
