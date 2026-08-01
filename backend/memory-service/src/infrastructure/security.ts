import { Injectable } from "@nestjs/common";

import { AuthorizationException, InfrastructureException } from "@guided-discovery/errors";

import type { PermissionGateway, PrincipalResolver } from "../application/ports.js";
import type { Principal } from "../domain/memory.js";

@Injectable()
export class ConfiguredPrincipalResolver implements PrincipalResolver {
  async resolve(authorization: string | undefined): Promise<Principal> {
    if (authorization === undefined || !authorization.startsWith("Bearer "))
      throw new AuthorizationException("AUTHENTICATION_REQUIRED", "Authentication is required.");
    const credential = authorization.slice(7);
    if ((process.env.APP_ENV ?? "development") === "test" && credential.startsWith("test:")) {
      return { id: credential.slice(5), kind: "USER", scopes: new Set() };
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
  async authorize(
    input: Parameters<PermissionGateway["authorize"]>[0],
  ): ReturnType<PermissionGateway["authorize"]> {
    if (
      (process.env.APP_ENV ?? "development") === "test" &&
      process.env.PERMISSION_TEST_ALLOW === "true"
    )
      return {
        policyRef: input.policyRef ?? "memory.owner.v1",
        policyVersion: input.policyVersion ?? 1,
        permissionVersion: input.policyVersion ?? 1,
      };
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
            resourceType: "MEMORY",
            resourceId: input.resourceId,
            ownerId: input.ownerId,
            purpose: input.purpose,
            sensitivity: input.sensitivity,
            permissionPolicyRef: input.policyRef,
            permissionPolicyVersion: input.policyVersion,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`permission_status_${response.status}`);
      const envelope = (await response.json()) as {
        data?: {
          decision?: string;
          policyRef?: string;
          policyVersion?: number;
          permissionVersion?: number;
        };
      };
      const decision = envelope.data;
      if (decision?.decision !== "ALLOW")
        throw new AuthorizationException("ACCESS_DENIED", "Access is denied.");
      if (
        typeof decision.policyRef !== "string" ||
        typeof decision.policyVersion !== "number" ||
        typeof decision.permissionVersion !== "number"
      )
        throw new Error("permission_contract_invalid");
      return {
        policyRef: decision.policyRef,
        policyVersion: decision.policyVersion,
        permissionVersion: decision.permissionVersion,
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
