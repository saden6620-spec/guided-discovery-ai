import { Injectable } from "@nestjs/common";
import {
  ApplicationException,
  AuthorizationException,
  InfrastructureException,
} from "@guided-discovery/errors";
import type { PermissionGateway, PrincipalResolver } from "../application/ports.js";
import type { Principal } from "../domain/recommendation.js";
@Injectable()
export class ConfiguredPrincipalResolver implements PrincipalResolver {
  resolveUser(v?: string) {
    return this.resolve(v, "USER");
  }
  resolveService(v?: string) {
    return this.resolve(v, "SERVICE");
  }
  private async resolve(v: string | undefined, kind: "USER" | "SERVICE"): Promise<Principal> {
    if (v === undefined || !v.startsWith("Bearer ")) {
      if (kind === "SERVICE")
        throw new ApplicationException({
          code: "SERVICE_AUTHENTICATION_REQUIRED",
          message: "Authentication is required.",
          httpStatus: 401,
        });
      throw new AuthorizationException("AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
    const token = v.slice(7);
    if ((process.env.APP_ENV ?? "development") === "test") {
      if (kind === "USER" && token.startsWith("test:"))
        return { id: token.slice(5), kind, scopes: new Set() };
      if (kind === "SERVICE" && token.startsWith("service:")) {
        const [, id, scopes = ""] = token.split(":");
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
  async authorize(input: Parameters<PermissionGateway["authorize"]>[0]) {
    if (
      (process.env.APP_ENV ?? "development") === "test" &&
      process.env.PERMISSION_TEST_ALLOW === "true"
    )
      return {
        policyRef: input.permissionPolicyRef,
        permissionVersion: Number(
          process.env.PERMISSION_TEST_VERSION ?? input.requestedPermissionVersion,
        ),
      };
    const endpoint = process.env.PERMISSION_SERVICE_URL;
    if (!endpoint)
      throw new InfrastructureException(
        "PERMISSION_UNAVAILABLE",
        "Permission validation is unavailable.",
        { retryable: true },
      );
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 250);
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
            resourceType: "RECOMMENDATION",
            resourceId: input.resourceId,
            ownerId: input.ownerId,
            purpose: input.purpose,
            permissionPolicyRef: input.permissionPolicyRef,
            permissionPolicyVersion: input.requestedPermissionVersion,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`permission_status_${response.status}`);
      const value = (await response.json()) as {
        data?: { decision?: string; policyRef?: string; permissionVersion?: number };
      };
      if (value.data?.decision !== "ALLOW")
        throw new AuthorizationException("ACCESS_DENIED", "Access is denied.");
      if (
        value.data.policyRef !== input.permissionPolicyRef ||
        !Number.isInteger(value.data.permissionVersion) ||
        Number(value.data.permissionVersion) <= 0
      )
        throw new Error("invalid_permission_decision");
      return {
        policyRef: value.data.policyRef,
        permissionVersion: Number(value.data.permissionVersion),
      };
    } catch (e) {
      if (e instanceof AuthorizationException) throw e;
      throw new InfrastructureException(
        "PERMISSION_UNAVAILABLE",
        "Permission validation is unavailable.",
        { cause: e, retryable: true },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
