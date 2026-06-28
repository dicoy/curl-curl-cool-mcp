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

  it("substitutes {{variables}} in the URL before sending", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "GET",
        url: "{{base_url}}/api/{{version}}/users",
        timeout_ms: 10000,
        variables: { base_url: "https://api.example.com", version: "v2" },
      },
      provider,
      makeHistoryProvider(),
    );
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://api.example.com/api/v2/users" }),
    );
  });

  it("substitutes {{variables}} in the body before sending", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "POST",
        url: "https://api.example.com/users",
        timeout_ms: 10000,
        body: '{"env":"{{env}}"}',
        variables: { env: "staging" },
      },
      provider,
      makeHistoryProvider(),
    );
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ body: '{"env":"staging"}' }),
    );
  });

  it("keeps unresolved {{placeholders}} intact when variable is missing", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "GET",
        url: "{{base_url}}/api/users",
        timeout_ms: 10000,
        variables: {},
      },
      provider,
      makeHistoryProvider(),
    );
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: "{{base_url}}/api/users" }),
    );
  });

  it("sends a Bearer token in the Authorization header", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "GET",
        url: "https://api.example.com/protected",
        timeout_ms: 10000,
        auth: { type: "bearer", token: "my-token" },
      },
      provider,
      makeHistoryProvider(),
    );
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      }),
    );
  });

  it("sends Basic auth credentials encoded in the Authorization header", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "GET",
        url: "https://api.example.com/protected",
        timeout_ms: 10000,
        auth: { type: "basic", username: "user", password: "pass" },
      },
      provider,
      makeHistoryProvider(),
    );
    const expected = `Basic ${Buffer.from("user:pass").toString("base64")}`;
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expected }) }),
    );
  });

  it("sends an API key in the specified header", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "GET",
        url: "https://api.example.com/protected",
        timeout_ms: 10000,
        auth: { type: "api-key", header: "X-Auth-Token", value: "abc123" },
      },
      provider,
      makeHistoryProvider(),
    );
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ "X-Auth-Token": "abc123" }) }),
    );
  });

  it("explicit headers take precedence over auth headers", async () => {
    const provider = makeHttpProvider();
    await httpRequestHandler(
      {
        method: "GET",
        url: "https://api.example.com/protected",
        timeout_ms: 10000,
        auth: { type: "bearer", token: "auto-token" },
        headers: { Authorization: "Bearer override" },
      },
      provider,
      makeHistoryProvider(),
    );
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer override" }),
      }),
    );
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
