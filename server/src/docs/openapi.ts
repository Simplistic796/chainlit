import fs from "fs";
import path from "path";
import YAML from "yaml";

let cached: any = null;

export function loadOpenApiV1() {
  if (cached) return cached;
  const p = path.join(process.cwd(), "openapi", "chainlit.v1.yaml");
  const raw = fs.readFileSync(p, "utf8");
  cached = YAML.parse(raw);
  return cached;
}


