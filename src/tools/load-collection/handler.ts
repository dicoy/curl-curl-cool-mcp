import type { Collection, ICollectionProvider } from "../../providers/collection.js";
import type { Input } from "./schema.js";

export async function loadCollectionHandler(
  input: Input,
  collectionProvider: ICollectionProvider,
): Promise<string> {
  const collection = await collectionProvider.load(input.path);
  return formatCollection(input.path, collection);
}

const FORMAT_LABELS: Record<string, string> = {
  openapi: "OpenAPI 3.0",
  postman: "Postman",
  custom: "Custom",
};

function formatCollection(filePath: string, collection: Collection): string {
  const formatLabel = FORMAT_LABELS[collection.format] ?? collection.format;
  const header = [
    `File: ${filePath}`,
    `Collection: ${collection.name} (${formatLabel})`,
    collection.baseUrl ? `Base URL: ${collection.baseUrl}` : null,
    `Endpoints: ${collection.requests.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  const variablesSection =
    collection.variables && Object.keys(collection.variables).length > 0
      ? `\nCollection variables:\n${Object.entries(collection.variables)
          .map(([k, v]) => `  {{${k}}} = ${v}`)
          .join("\n")}`
      : "";

  const hint =
    collection.format === "openapi" && collection.baseUrl
      ? `\nUse http_request with base URL "${collection.baseUrl}" and the path above.`
      : collection.format === "postman"
        ? "\nSubstitute {{variables}} with values from your environment, then pass the full URL to http_request."
        : "";

  if (collection.requests.length === 0) {
    return [header, variablesSection, "(no endpoints found)", hint].filter(Boolean).join("\n\n");
  }

  const methodWidth = Math.max(...collection.requests.map((r) => r.method.length));
  const pathWidth = Math.max(...collection.requests.map((r) => r.path.length));
  const nameWidth = Math.max(...collection.requests.map((r) => r.name.length));

  const rows = collection.requests.map((r) => {
    const extras: string[] = [];
    if (r.headers && Object.keys(r.headers).length > 0) extras.push("+headers");
    if (r.body) extras.push("+body");
    const extrasStr = extras.length > 0 ? `  [${extras.join(", ")}]` : "";
    const desc = r.description ? `  — ${r.description}` : "";
    return `${r.method.padEnd(methodWidth)}  ${r.path.padEnd(pathWidth)}  ${r.name.padEnd(nameWidth)}${extrasStr}${desc}`;
  });

  return [header, variablesSection, rows.join("\n"), hint].filter(Boolean).join("\n\n");
}
