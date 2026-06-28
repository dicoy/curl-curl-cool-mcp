import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import yaml from "js-yaml";
import { CollectionNotFoundError, CollectionParseError } from "../errors/index.js";

export type CollectionFormat = "openapi" | "postman" | "custom";

export interface CollectionRequest {
  name: string;
  method: string;
  path: string;
  description?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface Collection {
  name: string;
  format: CollectionFormat;
  baseUrl?: string;
  variables?: Record<string, string>;
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
      if (isOpenApi(parsed)) return parseOpenApi(parsed, filePath);
      if (isPostman(parsed)) return parsePostman(parsed, filePath);
      return parseCustom(parsed, filePath);
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

// ── Postman Collection v2.1 ──────────────────────────────────────────────────

function isPostman(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || !("info" in parsed)) return false;
  const info = (parsed as { info: unknown }).info;
  if (typeof info !== "object" || info === null) return false;
  const schema = (info as Record<string, unknown>).schema;
  return typeof schema === "string" && schema.includes("getpostman");
}

interface PostmanUrl {
  raw?: string;
}

interface PostmanHeader {
  key?: string;
  value?: string;
  disabled?: boolean;
}

interface PostmanBody {
  mode?: string;
  raw?: string;
}

interface PostmanRequestDef {
  method?: string;
  url?: string | PostmanUrl;
  header?: PostmanHeader[];
  body?: PostmanBody;
  description?: string | { content?: string };
}

interface PostmanItem {
  name?: string;
  request?: PostmanRequestDef;
  item?: PostmanItem[];
}

interface PostmanCollection {
  info?: { name?: string };
  item?: PostmanItem[];
  variable?: { key?: string; value?: string }[];
}

function parsePostman(doc: unknown, filePath: string): Collection {
  const col = doc as PostmanCollection;
  const requests = flattenPostmanItems(col.item ?? []);

  if (requests.length === 0) {
    throw new CollectionParseError(filePath, "no requests found in Postman collection");
  }

  const collection: Collection = {
    name: col.info?.name ?? "Postman Collection",
    format: "postman",
    requests,
  };

  const vars = (col.variable ?? [])
    .filter(
      (v): v is { key: string; value: string } =>
        typeof v.key === "string" && v.value !== undefined,
    )
    .map(({ key, value }) => [key, value] as [string, string]);
  if (vars.length > 0) collection.variables = Object.fromEntries(vars);

  return collection;
}

function parsePostmanDescription(desc: PostmanRequestDef["description"]): string | undefined {
  if (typeof desc === "string") return desc || undefined;
  if (typeof desc === "object" && desc !== null && "content" in desc) {
    return desc.content || undefined;
  }
  return undefined;
}

function parsePostmanHeaders(header: PostmanHeader[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of header ?? []) {
    if (!h.disabled && h.key && h.value) result[h.key] = h.value;
  }
  return result;
}

function toCollectionRequest(item: PostmanItem): CollectionRequest | null {
  if (!item.request) return null;
  const req = item.request;
  const rawUrl = typeof req.url === "string" ? req.url : (req.url?.raw ?? "");

  const collReq: CollectionRequest = {
    name: item.name ?? "Unnamed",
    method: (req.method ?? "GET").toUpperCase(),
    path: rawUrl,
  };

  const description = parsePostmanDescription(req.description);
  if (description !== undefined) collReq.description = description;

  const headers = parsePostmanHeaders(req.header);
  if (Object.keys(headers).length > 0) collReq.headers = headers;

  if (req.body?.mode === "raw" && req.body.raw) collReq.body = req.body.raw;

  return collReq;
}

function flattenPostmanItems(items: PostmanItem[]): CollectionRequest[] {
  return items.flatMap((item) => {
    if (item.item) return flattenPostmanItems(item.item);
    const req = toCollectionRequest(item);
    return req ? [req] : [];
  });
}
