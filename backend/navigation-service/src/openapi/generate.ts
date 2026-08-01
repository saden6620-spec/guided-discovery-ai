import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
const source = resolve(process.cwd(), "../../docs/api/m2/openapi.yaml");
const target = resolve(process.cwd(), "openapi/navigation-service.openapi.json");
const document = YAML.parse(await readFile(source, "utf8")) as {
  paths: Record<string, unknown>;
  components: unknown;
  openapi: string;
  info: unknown;
  servers?: unknown;
};
document.paths = Object.fromEntries(
  Object.entries(document.paths).filter(([path]) => path.startsWith("/navigation/")),
);
await mkdir(resolve(process.cwd(), "openapi"), { recursive: true });
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
