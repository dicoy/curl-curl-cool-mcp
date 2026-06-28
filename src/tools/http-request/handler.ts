import type { IHistoryProvider } from "../../providers/history.js";
import type { HttpResponse, IHttpProvider } from "../../providers/http.js";
import { resolveAuthHeaders } from "../../utils/auth.js";
import { substituteVariables } from "../../utils/variables.js";
import type { Input } from "./schema.js";

const SHOWN_HEADERS = new Set([
  "content-type",
  "content-length",
  "cache-control",
  "x-request-id",
  "x-trace-id",
  "location",
  "retry-after",
  "www-authenticate",
]);

export async function httpRequestHandler(
  input: Input,
  httpProvider: IHttpProvider,
  historyProvider: IHistoryProvider,
): Promise<string> {
  const vars = input.variables;
  const url = vars !== undefined ? substituteVariables(input.url, vars) : input.url;
  const body =
    vars !== undefined && input.body !== undefined
      ? substituteVariables(input.body, vars)
      : input.body;

  const authHeaders = resolveAuthHeaders(input.auth);
  const mergedHeaders = { ...authHeaders, ...(input.headers ?? {}) };
  const response = await httpProvider.request({
    method: input.method,
    url,
    ...(Object.keys(mergedHeaders).length > 0 && { headers: mergedHeaders }),
    ...(body !== undefined && { body }),
    timeoutMs: input.timeout_ms,
  });

  historyProvider.push({
    timestamp: new Date().toISOString(),
    method: input.method,
    url,
    status: response.status,
    durationMs: response.durationMs,
    responseBody: response.body.slice(0, 500),
  });

  return formatResponse(input.method, url, response);
}

function formatResponse(method: string, url: string, res: HttpResponse): string {
  const size = formatBytes(res.body.length);
  const header = `${method} ${url}\n\nStatus: ${res.status} ${res.statusText}  ·  Time: ${res.durationMs}ms  ·  Size: ${size}`;

  const relevantHeaders = Object.entries(res.headers)
    .filter(([k]) => SHOWN_HEADERS.has(k.toLowerCase()))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const body = formatBody(res);
  const truncationNote = res.truncated ? "\n\n[response truncated at 50 KB]" : "";

  return [header, relevantHeaders, body + truncationNote].filter(Boolean).join("\n\n");
}

function formatBody(res: HttpResponse): string {
  const ct = res.headers["content-type"] ?? "";
  if (!res.body) return "(empty body)";
  if (ct.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(res.body), null, 2);
    } catch {
      // fall through to raw
    }
  }
  return res.body;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
