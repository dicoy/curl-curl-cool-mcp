import { describe, expect, it, vi } from "vitest";
import { HttpRequestError } from "../../errors/index.js";
import type { IHistoryProvider } from "../../providers/history.js";
import type { HttpResponse, IHttpProvider } from "../../providers/http.js";
import { httpRequestHandler } from "./handler.js";

const makeResponse = (overrides: Partial<HttpResponse> = {}): HttpResponse => ({
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  body: '{"id": 1, "name": "Alice"}',
  truncated: false,
  durationMs: 42,
  ...overrides,
});

const makeHttpProvider = (overrides: Partial<IHttpProvider> = {}): IHttpProvider => ({
  request: vi.fn().mockResolvedValue(makeResponse()),
  ...overrides,
});

const makeHistoryProvider = (overrides: Partial<IHistoryProvider> = {}): IHistoryProvider => ({
  push: vi.fn(),
  list: vi.fn().mockReturnValue([]),
  clear: vi.fn(),
  ...overrides,
});

describe("httpRequestHandler", () => {
  it("includes method, URL, status, and timing in output", async () => {
    const result = await httpRequestHandler(
      { method: "GET", url: "https://api.example.com/users/1", timeout_ms: 10000 },
      makeHttpProvider(),
      makeHistoryProvider(),
    );

    expect(result).toContain("GET https://api.example.com/users/1");
    expect(result).toContain("200 OK");
    expect(result).toContain("42ms");
  });

  it("pretty-prints JSON response bodies", async () => {
    const result = await httpRequestHandler(
      { method: "GET", url: "https://api.example.com/users/1", timeout_ms: 10000 },
      makeHttpProvider(),
      makeHistoryProvider(),
    );

    expect(result).toContain('"name": "Alice"');
  });

  it("records the request in history", async () => {
    const history = makeHistoryProvider();

    await httpRequestHandler(
      { method: "POST", url: "https://api.example.com/users", timeout_ms: 10000 },
      makeHttpProvider(),
      history,
    );

    expect(history.push).toHaveBeenCalledOnce();
    expect(history.push).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "https://api.example.com/users",
        status: 200,
      }),
    );
  });

  it("notes when the response body was truncated", async () => {
    const result = await httpRequestHandler(
      { method: "GET", url: "https://api.example.com/large", timeout_ms: 10000 },
      makeHttpProvider({ request: vi.fn().mockResolvedValue(makeResponse({ truncated: true })) }),
      makeHistoryProvider(),
    );

    expect(result).toContain("truncated");
  });

  it("shows (empty body) when response has no body", async () => {
    const result = await httpRequestHandler(
      { method: "HEAD", url: "https://api.example.com/ping", timeout_ms: 10000 },
      makeHttpProvider({ request: vi.fn().mockResolvedValue(makeResponse({ body: "" })) }),
      makeHistoryProvider(),
    );

    expect(result).toContain("empty body");
  });

  it("propagates HttpRequestError from the provider", async () => {
    await expect(
      httpRequestHandler(
        { method: "GET", url: "https://unreachable.example.com", timeout_ms: 10000 },
        makeHttpProvider({
          request: vi.fn().mockRejectedValue(new HttpRequestError("ECONNREFUSED")),
        }),
        makeHistoryProvider(),
      ),
    ).rejects.toThrow(HttpRequestError);
  });
});
