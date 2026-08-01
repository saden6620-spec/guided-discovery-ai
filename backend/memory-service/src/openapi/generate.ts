import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format, resolveConfig } from "prettier";
import { parse } from "yaml";

async function generate(): Promise<void> {
  const repositoryRoot = resolve(process.cwd(), "../..");
  const source = await readFile(resolve(repositoryRoot, "docs/api/m2/openapi.yaml"), "utf8");
  const document = parse(source) as {
    paths: Record<string, unknown>;
    components: unknown;
    info: unknown;
    openapi: string;
    servers: unknown;
    security: unknown;
    tags: readonly { name: string }[];
  };
  const memoryDocument = {
    openapi: document.openapi,
    info: { ...(document.info as object), title: "Guided Discovery AI Memory Service API" },
    servers: document.servers,
    security: document.security,
    tags: document.tags.filter((tag) => tag.name === "Memory"),
    paths: Object.fromEntries(
      Object.entries(document.paths).filter(([path]) => path.startsWith("/memories")),
    ),
    components: document.components,
  };
  const outputDirectory = resolve(process.cwd(), "openapi");
  await mkdir(outputDirectory, { recursive: true });
  const prettierConfig = await resolveConfig(resolve(repositoryRoot, "package.json"));
  const output = await format(JSON.stringify(memoryDocument), {
    ...prettierConfig,
    parser: "json",
  });
  await writeFile(resolve(outputDirectory, "memory-service.openapi.json"), output, `utf8`);
}

void generate();
