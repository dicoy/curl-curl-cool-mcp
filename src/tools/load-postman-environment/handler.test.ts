import { describe, expect, it, vi } from "vitest";
import { CollectionNotFoundError } from "../../errors/index.js";
import type {
  IPostmanEnvironmentProvider,
  PostmanEnvironmentData,
} from "../../providers/postman-environment.js";
import { loadPostmanEnvironmentHandler } from "./handler.js";

const makeProvider = (data: PostmanEnvironmentData): IPostmanEnvironmentProvider => ({
  load: vi.fn().mockResolvedValue(data),
});

const makeEnv = (overrides: Partial<PostmanEnvironmentData> = {}): PostmanEnvironmentData => ({
  name: "Development",
  variables: [
    { key: "base_url", value: "https://api-dev.example.com", enabled: true },
    { key: "api_token", value: "secret123", enabled: true },
    { key: "debug", value: "false", enabled: true },
  ],
  ...overrides,
});

describe("loadPostmanEnvironmentHandler", () => {
  it("shows the environment name and active variable count", async () => {
    const result = await loadPostmanEnvironmentHandler(
      { path: "dev.json" },
      makeProvider(makeEnv()),
    );
    expect(result).toContain("Development");
    expect(result).toContain("3 active");
  });

  it("shows non-secret variable values", async () => {
    const result = await loadPostmanEnvironmentHandler(
      { path: "dev.json" },
      makeProvider(makeEnv()),
    );
    expect(result).toContain("https://api-dev.example.com");
    expect(result).toContain("{{base_url}}");
  });

  it("masks secret variable values", async () => {
    const result = await loadPostmanEnvironmentHandler(
      { path: "dev.json" },
      makeProvider(makeEnv()),
    );
    expect(result).toContain("••••••••");
    expect(result).not.toContain("secret123");
  });

  it("reports disabled variables in the count but excludes them from the table", async () => {
    const env = makeEnv({
      variables: [
        { key: "base_url", value: "https://api.example.com", enabled: true },
        { key: "old_url", value: "https://old.example.com", enabled: false },
      ],
    });
    const result = await loadPostmanEnvironmentHandler({ path: "dev.json" }, makeProvider(env));
    expect(result).toContain("1 active");
    expect(result).toContain("1 disabled");
    expect(result).not.toContain("{{old_url}}");
  });

  it("includes a substitution hint", async () => {
    const result = await loadPostmanEnvironmentHandler(
      { path: "dev.json" },
      makeProvider(makeEnv()),
    );
    expect(result).toContain("http_request");
  });

  it("propagates CollectionNotFoundError from the provider", async () => {
    const provider: IPostmanEnvironmentProvider = {
      load: vi.fn().mockRejectedValue(new CollectionNotFoundError("missing.json")),
    };
    await expect(loadPostmanEnvironmentHandler({ path: "missing.json" }, provider)).rejects.toThrow(
      CollectionNotFoundError,
    );
  });
});
