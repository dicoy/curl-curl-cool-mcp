import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import yaml from "js-yaml";
import { CollectionNotFoundError, CollectionParseError } from "../errors/index.js";

export type CollectionFormat = "openapi" | "custom";

export interface CollectionRequest {
  name: string;
  method: string;
  path: string;
  description?: string;
}

export interface Collection {
  name: string;
  format: CollectionFormat;
  baseUrl?: string;
  requests: CollectionRequest[];
}

export interface ICollectionProvider {
  load(filePath: string): Promise<Collection>;
}

export class FsCollectionProvider implements ICollectionProvider {
  async load(filePath: string): Promise<Collection> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      throw new CollectionNotFoundError(filePath);
    }

    const ext = extname(filePath).toLowerCase();
    try {
      const parsed = ext === ".yaml" || ext === ".yml" ? yaml.load(raw) : JSON.parse(raw);
      return isOpenApi(parsed) ? parseOpenApi(parsed, filePath) : parseCustom(parsed, filePath);
    } catch (err) {
      if (err instanceof CollectionNotFoundError || err instanceof CollectionParseError) throw err;
      throw new CollectionParseError(filePath, err instanceof Error ? err.message : String(err));
    }
  }
}

function isOpenApi(parsed: unknown): boolean {
  return typeof parsed === "object" && parsed !== null && "openapi" in parsed && "paths" in parsed;
}

interface OpenApiDoc {
  info?: { title?: string };
  servers?: { url?: string }[];
  paths?: Record<string, Record<string, { summary?: string; operationId?: string }>>;
}

function parseOpenApi(doc: unknown, filePath: string): Collection {
  const api = doc as OpenApiDoc;
  const paths = api.paths ?? {};
  const requests: CollectionRequest[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (typeof op !== "object" || op === null) continue;
      const req: CollectionRequest = {
        name: op.operationId ?? `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
      };
      if (op.summary !== undefined) req.description = op.summary;
      requests.push(req);
    }
  }

  if (requests.length === 0) {
    throw new CollectionParseError(filePath, "no paths found in OpenAPI document");
  }

  const collection: Collection = {
    name: api.info?.title ?? "API",
    format: "openapi",
    requests,
  };
  const baseUrl = api.servers?.[0]?.url;
  if (baseUrl !== undefined) collection.baseUrl = baseUrl;
  return collection;
}

interface CustomRequest {
  name?: string;
  method?: string;
  path?: string;
  url?: string;
  description?: string;
}

function parseCustom(parsed: unknown, filePath: string): Collection {
  if (!Array.isArray(parsed)) {
    throw new CollectionParseError(filePath, "custom collection must be a JSON array");
  }

  const requests: CollectionRequest[] = parsed.flatMap((item: unknown, i) => {
    if (typeof item !== "object" || item === null) return [];
    const r = item as CustomRequest;
    const path = r.path ?? r.url ?? "";
    if (!path) return [];
    const req: CollectionRequest = {
      name: r.name ?? `Request ${i + 1}`,
      method: (r.method ?? "GET").toUpperCase(),
      path,
    };
    if (r.description !== undefined) req.description = r.description;
    return [req];
  });

  return { name: "Custom collection", format: "custom", requests };
}
