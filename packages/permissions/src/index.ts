export interface PermissionRequest {
  readonly subject: string;
  readonly capability: string;
}

export interface PermissionAuthorizer {
  authorize(request: PermissionRequest): Promise<boolean>;
}
