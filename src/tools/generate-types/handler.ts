import { inferTypes } from "./infer.js";
import type { Input } from "./schema.js";

export function generateTypesHandler(input: Input): string {
  const types = inferTypes(input.json, input.root_type_name);
  return `// Inferred from JSON input\n\n${types}`;
}
