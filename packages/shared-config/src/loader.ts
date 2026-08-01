import type { z } from "zod";

import {
  ApplicationEnvironmentSchema,
  CommonConfigurationSchema,
  type CommonConfiguration,
} from "./schema.js";

export interface ConfigurationNamespace<TValue extends object> {
  readonly name: string;
  readonly schema: z.ZodType<TValue>;
  readonly load: (environment: Readonly<NodeJS.ProcessEnv>) => unknown;
}

export type LoadedNamespaces<TNamespaces extends readonly ConfigurationNamespace<object>[]> = {
  readonly [
    Namespace in TNamespaces[number] as Namespace["name"]
  ]: Namespace extends ConfigurationNamespace<infer Value> ? Readonly<Value> : never;
};

export interface LoadConfigurationOptions<
  TNamespaces extends readonly ConfigurationNamespace<object>[],
> {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly defaultPort: number;
  readonly environment?: Readonly<NodeJS.ProcessEnv>;
  readonly namespaces?: TNamespaces;
}

function deepFreeze<TValue>(value: TValue): Readonly<TValue> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) return Number.NaN;
  return Number(value);
}

export function defineConfigurationNamespace<TValue extends object>(
  namespace: ConfigurationNamespace<TValue>,
): ConfigurationNamespace<TValue> {
  if (!/^[a-z][a-zA-Z0-9]*$/u.test(namespace.name)) {
    throw new Error("Configuration namespace names must be lower camel case.");
  }
  return Object.freeze(namespace);
}

export function loadConfiguration<
  const TNamespaces extends readonly ConfigurationNamespace<object>[] = readonly [],
>(
  options: LoadConfigurationOptions<TNamespaces>,
): Readonly<CommonConfiguration & LoadedNamespaces<TNamespaces>> {
  const environment = options.environment ?? process.env;
  const applicationEnvironment = ApplicationEnvironmentSchema.parse(
    environment.APP_ENV ?? "development",
  );
  const common = CommonConfigurationSchema.parse({
    environment: applicationEnvironment,
    serviceName: environment.SERVICE_NAME ?? options.serviceName,
    serviceVersion: environment.SERVICE_VERSION ?? options.serviceVersion,
    port: parseInteger(environment.PORT ?? environment.SERVICE_PORT, options.defaultPort),
    logLevel: environment.LOG_LEVEL ?? (applicationEnvironment === "production" ? "info" : "debug"),
  });

  const namespaceValues: Record<string, object> = {};
  for (const namespace of options.namespaces ?? []) {
    if (Object.hasOwn(namespaceValues, namespace.name)) {
      throw new Error(`Duplicate configuration namespace: ${namespace.name}`);
    }
    namespaceValues[namespace.name] = namespace.schema.parse(namespace.load(environment));
  }

  return deepFreeze({ ...common, ...namespaceValues }) as Readonly<
    CommonConfiguration & LoadedNamespaces<TNamespaces>
  >;
}

/** Compatibility wrapper for M1 service skeletons. */
export interface ServiceConfiguration {
  readonly name: string;
  readonly port: number;
  readonly databaseUrl?: string;
}

export function loadServiceConfiguration(
  defaultName: string,
  defaultPort: number,
  environment: NodeJS.ProcessEnv = process.env,
): ServiceConfiguration {
  const loaded = loadConfiguration({
    serviceName: defaultName,
    serviceVersion: "0.1.0",
    defaultPort,
    environment,
  });
  return deepFreeze({
    name: loaded.serviceName,
    port: loaded.port,
    ...(environment.DATABASE_URL === undefined ? {} : { databaseUrl: environment.DATABASE_URL }),
  });
}
