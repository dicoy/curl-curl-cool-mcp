import { describe, expect, it, vi } from "vitest";
import { CollectionNotFoundError } from "../../errors/index.js";
import type { ICollectionProvider } from "../../providers/collection.js";
import { loadCollectionHandler } from "./handler.js";

const makeProvider = (overrides: Partial<ICollectionProvider> = {}): ICollectionProvider => ({
  load: vi.fn(),
  ...overrides,
});

describe("loadCollectionHandler", () => {
  it("shows collection name, format, and endpoint count", async () => {
    const provider = makeProvider({
      load: vi.fn().mockResolvedValue({
        name: "Petstore",
        format: "openapi",
        baseUrl: "https://petstore.example.com",
        requests: [
          { name: "listPets", method: "GET", path: "/pets" },
          { name: "createPet", method: "POST", path: "/pets" },
        ],
      }),
    });

    const result = await loadCollectionHandler({ path: "petstore.yaml" }, provider);

    expect(result).toContain("Petstore");
    expect(result).toContain("OpenAPI 3.0");
    expect(result).toContain("Endpoints: 2");
  });

  it("shows base URL for OpenAPI collections", async () => {
    const provider = makeProvider({
      load: vi.fn().mockResolvedValue({
        name: "API",
        format: "openapi",
        baseUrl: "https://api.example.com",
        requests: [{ name: "ping", method: "GET", path: "/ping" }],
      }),
    });

    const result = await loadCollectionHandler({ path: "api.yaml" }, provider);

    expect(result).toContain("https://api.example.com");
  });

  it("lists each endpoint with method and path", async () => {
    const provider = makeProvider({
      load: vi.fn().mockResolvedValue({
        name: "My API",
        format: "custom",
        requests: [
          { name: "Get user", method: "GET", path: "/users/1" },
          { name: "Delete user", method: "DELETE", path: "/users/1" },
        ],
      }),
    });

    const result = await loadCollectionHandler({ path: "collection.json" }, provider);

    expect(result).toContain("GET");
    expect(result).toContain("DELETE");
    expect(result).toContain("/users/1");
  });

  it("shows Postman format label and variable-style paths", async () => {
    const provider = makeProvider({
      load: vi.fn().mockResolvedValue({
        name: "My API",
        format: "postman",
        variables: { base_url: "https://api.example.com" },
        requests: [
          { name: "listUsers", method: "GET", path: "{{base_url}}/users" },
          {
            name: "createUser",
            method: "POST",
            path: "{{base_url}}/users",
            headers: { "Content-Type": "application/json" },
            body: '{"name":"Alice"}',
          },
        ],
      }),
    });

    const result = await loadCollectionHandler({ path: "my-api.json" }, provider);

    expect(result).toContain("Postman");
    expect(result).toContain("{{base_url}}");
    expect(result).toContain("Collection variables:");
    expect(result).toContain("+headers");
    expect(result).toContain("+body");
  });

  it("propagates CollectionNotFoundError from the provider", async () => {
    const provider = makeProvider({
      load: vi.fn().mockRejectedValue(new CollectionNotFoundError("missing.yaml")),
    });

    await expect(loadCollectionHandler({ path: "missing.yaml" }, provider)).rejects.toThrow(
      CollectionNotFoundError,
    );
  });
});
