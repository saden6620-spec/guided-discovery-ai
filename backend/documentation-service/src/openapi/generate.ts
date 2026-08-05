import { readFile, writeFile, mkdir } from "node:fs/promises";
import YAML from "yaml";
const source = YAML.parse(await readFile("../../docs/api/m2/openapi.yaml", "utf8")) as Record<
  string,
  unknown
> & { paths: Record<string, unknown> };
const artifact = {
  ...source,
  info: { ...(source.info as object), title: "Guided Discovery Documentation Service API" },
  paths: {
    "/journals": source.paths["/journals"],
    "/journals/{id}": source.paths["/journals/{id}"],
  },
};
await mkdir("openapi", { recursive: true });
await writeFile(
  "openapi/documentation-service.openapi.json",
  `${JSON.stringify(artifact, null, 2)}\n`,
);
