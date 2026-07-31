export interface ServiceHealth {
  readonly service: string;
  readonly status: "ok";
  readonly version: string;
}

export interface DatabaseConnectionConfiguration {
  readonly connectionUrl?: string;
  readonly connectOnStartup: boolean;
}

export interface AuthenticationVerifier {
  verifyCredential(credential: string): Promise<unknown>;
}

export interface PluginDescriptor {
  readonly id: string;
  readonly version: string;
}
