import { HttpRequestError, HttpTimeoutError } from "../errors/index.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  durationMs: number;
}

export interface IHttpProvider {
  request(req: HttpRequest): Promise<HttpResponse>;
}

const MAX_BODY_BYTES = 50_000;

export class NodeFetchProvider implements IHttpProvider {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    const start = Date.now();

    try {
      const res = await fetch(req.url, {
        method: req.method,
        ...(req.headers !== undefined && { headers: req.headers }),
        ...(req.body !== undefined && { body: req.body }),
        signal: controller.signal,
      });

      const durationMs = Date.now() - start;
      const raw = await res.text();
      const truncated = raw.length > MAX_BODY_BYTES;

      return {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: truncated ? raw.slice(0, MAX_BODY_BYTES) : raw,
        truncated,
        durationMs,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new HttpTimeoutError(req.url, req.timeoutMs);
      }
      throw new HttpRequestError(
        `Request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
