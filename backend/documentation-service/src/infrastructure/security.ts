import { Injectable } from "@nestjs/common";
import { AuthorizationException, InfrastructureException } from "@guided-discovery/errors";
import type { PermissionGateway, PrincipalResolver } from "../application/ports.js";
@Injectable()
export class ConfiguredPrincipalResolver implements PrincipalResolver {
  async resolveUser(value?: string) {
    if (!value?.startsWith("Bearer "))
      throw new AuthorizationException("AUTHENTICATION_REQUIRED", "Authentication is required.");
    const token = value.slice(7);
    if ((process.env.APP_ENV ?? "development") === "test" && token.startsWith("test:"))
      return { id: token.slice(5), kind: "USER" as const, scopes: new Set<string>() };
    throw new InfrastructureException(
      "AUTHENTICATION_UNAVAILABLE",
      "Authentication is unavailable.",
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
        policyRef: input.permissionPolicyRef ?? "journal.owner.private.v1",
        permissionVersion: Number(
          process.env.PERMISSION_TEST_VERSION ?? input.requestedPermissionVersion ?? 1,
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
            resourceType: "JOURNAL",
            resourceId: input.resourceId,
            ownerId: input.ownerId,
            purpose: input.purpose,
            permissionPolicyRef: input.permissionPolicyRef,
            permissionPolicyVersion: input.requestedPermissionVersion,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error();
      const value = (await response.json()) as {
        data?: { decision?: string; policyRef?: string; permissionVersion?: number };
      };
      if (value.data?.decision !== "ALLOW")
        throw new AuthorizationException("ACCESS_DENIED", "Access is denied.");
      if (
        !value.data.policyRef ||
        !Number.isInteger(value.data.permissionVersion) ||
        Number(value.data.permissionVersion) <= 0
      )
        throw new Error();
      return {
        policyRef: value.data.policyRef,
        permissionVersion: Number(value.data.permissionVersion),
      };
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
