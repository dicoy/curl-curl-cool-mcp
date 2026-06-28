import { describe, expect, it, vi } from "vitest";
import type { HttpResponse, IHttpProvider } from "../../providers/http.js";
import { diffEnvironmentsHandler } from "./handler.js";

const makeResponse = (overrides: Partial<HttpResponse> = {}): HttpResponse => ({
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  body: '{"version":"1.0"}',
  truncated: false,
  durationMs: 50,
  ...overrides,
});

const makeHttpProvider = (responses: HttpResponse[]): IHttpProvider => {
  let call = 0;
  return {
    request: vi.fn().mockImplementation(() => Promise.resolve(responses[call++] ?? responses[0])),
  };
};

const baseInput = {
  method: "GET" as const,
  path: "/api/version",
  environments: { dev: "https://dev.example.com", prod: "https://prod.example.com" },
  timeout_ms: 10000,
};

describe("diffEnvironmentsHandler", () => {
  it("requires at least two environments", async () => {
    const provider = makeHttpProvider([makeResponse()]);

    const result = await diffEnvironmentsHandler(
      { ...baseInput, environments: { dev: "https://dev.example.com" } },
      provider,
    );

    expect(result).toContain("at least two environments");
  });

  it("shows a summary table with status and timing for each environment", async () => {
    const provider = makeHttpProvider([
      makeResponse({ durationMs: 30 }),
      makeResponse({ durationMs: 80 }),
    ]);

    const result = await diffEnvironmentsHandler(baseInput, provider);

    expect(result).toContain("dev");
    expect(result).toContain("prod");
    expect(result).toContain("200");
  });

  it("reports identical responses when bodies and statuses match", async () => {
    const provider = makeHttpProvider([makeResponse(), makeResponse()]);

    const result = await diffEnvironmentsHandler(baseInput, provider);

    expect(result).toContain("identical");
  });

  it("highlights status code differences", async () => {
    const provider = makeHttpProvider([
      makeResponse({ status: 200 }),
      makeResponse({ status: 404 }),
    ]);

    const result = await diffEnvironmentsHandler(baseInput, provider);

    expect(result).toContain("status");
    expect(result).toContain("200");
    expect(result).toContain("404");
  });

  it("highlights body field differences", async () => {
    const provider = makeHttpProvider([
      makeResponse({ body: '{"version":"1.0","debug":false}' }),
      makeResponse({ body: '{"version":"2.0","debug":false}' }),
    ]);

    const result = await diffEnvironmentsHandler(baseInput, provider);

    expect(result).toContain("version");
    expect(result).toContain("1.0");
    expect(result).toContain("2.0");
  });

  it("marks an environment as ERROR when the request fails", async () => {
    const provider: IHttpProvider = {
      request: vi
        .fn()
        .mockResolvedValueOnce(makeResponse())
        .mockRejectedValueOnce(new Error("ECONNREFUSED")),
    };

    const result = await diffEnvironmentsHandler(baseInput, provider);

    expect(result).toContain("ERROR");
  });
});
