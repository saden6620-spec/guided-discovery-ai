export interface AuthenticationContext {
  readonly subject: string;
  readonly claims: Readonly<Record<string, unknown>>;
}

export interface AuthenticationProvider {
  verify(credential: string): Promise<AuthenticationContext>;
}
