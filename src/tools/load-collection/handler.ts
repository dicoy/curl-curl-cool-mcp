import type { Collection, ICollectionProvider } from "../../providers/collection.js";
import type { Input } from "./schema.js";

export async function loadCollectionHandler(
  input: Input,
  collectionProvider: ICollectionProvider,
): Promise<string> {
  const collection = await collectionProvider.load(input.path);
  return formatCollection(input.path, collection);
}

function formatCollection(filePath: string, collection: Collection): string {
  const formatLabel = collection.format === "openapi" ? "OpenAPI 3.0" : "Custom";
  const header = [
    `File: ${filePath}`,
    `Collection: ${collection.name} (${formatLabel})`,
    collection.baseUrl ? `Base URL: ${collection.baseUrl}` : null,
    `Endpoints: ${collection.requests.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  const methodWidth = Math.max(...collection.requests.map((r) => r.method.length));
  const pathWidth = Math.max(...collection.requests.map((r) => r.path.length));
  const nameWidth = Math.max(...collection.requests.map((r) => r.name.length));

  const rows = collection.requests.map((r) => {
    const desc = r.description ? `  — ${r.description}` : "";
    return `${r.method.padEnd(methodWidth)}  ${r.path.padEnd(pathWidth)}  ${r.name.padEnd(nameWidth)}${desc}`;
  });

  const hint =
    collection.format === "openapi" && collection.baseUrl
      ? `\nUse http_request with base URL "${collection.baseUrl}" and the path above.`
      : "";

  return `${header}\n\n${rows.join("\n")}${hint}`;
}
