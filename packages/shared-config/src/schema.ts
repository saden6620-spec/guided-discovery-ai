import { z } from "zod";

export const ApplicationEnvironmentSchema = z.enum([
  "development",
  "test",
  "staging",
  "production",
]);
export type ApplicationEnvironment = z.infer<typeof ApplicationEnvironmentSchema>;

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const CommonConfigurationSchema = z.object({
  environment: ApplicationEnvironmentSchema,
  serviceName: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{2,63}$/u),
  serviceVersion: z.string().trim().min(1).max(64),
  port: z.number().int().min(1).max(65_535),
  logLevel: LogLevelSchema,
});

export type CommonConfiguration = Readonly<z.infer<typeof CommonConfigurationSchema>>;
