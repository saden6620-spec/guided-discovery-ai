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
  const configuredPort = Number.parseInt(environment.SERVICE_PORT ?? String(defaultPort), 10);

  if (!Number.isInteger(configuredPort) || configuredPort <= 0) {
    throw new Error("SERVICE_PORT must be a positive integer.");
  }

  return {
    name: environment.SERVICE_NAME ?? defaultName,
    port: configuredPort,
    ...(environment.DATABASE_URL === undefined ? {} : { databaseUrl: environment.DATABASE_URL }),
  };
}
