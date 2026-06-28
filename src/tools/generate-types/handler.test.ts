import { describe, expect, it } from "vitest";
import { InvalidJsonError } from "../../errors/index.js";
import { generateTypesHandler } from "./handler.js";

describe("generateTypesHandler", () => {
  it("generates an interface for a flat object", () => {
    const result = generateTypesHandler({
      json: '{"id": 1, "name": "Alice", "active": true}',
      root_type_name: "User",
    });

    expect(result).toContain("interface User");
    expect(result).toContain("id: number");
    expect(result).toContain("name: string");
    expect(result).toContain("active: boolean");
  });

  it("generates nested interfaces for nested objects", () => {
    const result = generateTypesHandler({
      json: '{"user": {"id": 1, "name": "Alice"}, "total": 42}',
      root_type_name: "ApiResponse",
    });

    expect(result).toContain("interface ApiResponse");
    expect(result).toContain("interface User");
    expect(result).toContain("user: User");
    expect(result).toContain("total: number");
  });

  it("infers array item type from the first element", () => {
    const result = generateTypesHandler({
      json: '{"users": [{"id": 1, "name": "Alice"}]}',
      root_type_name: "Response",
    });

    expect(result).toContain("users: User[]");
    expect(result).toContain("interface User");
  });

  it("marks null fields as optional and string | null", () => {
    const result = generateTypesHandler({
      json: '{"id": 1, "deletedAt": null}',
      root_type_name: "Item",
    });

    expect(result).toContain("deletedAt?: string | null");
  });

  it("uses root_type_name for the top-level interface", () => {
    const result = generateTypesHandler({
      json: '{"ok": true}',
      root_type_name: "HealthCheck",
    });

    expect(result).toContain("interface HealthCheck");
  });

  it("throws InvalidJsonError for invalid JSON", () => {
    expect(() => generateTypesHandler({ json: "not valid json", root_type_name: "T" })).toThrow(
      InvalidJsonError,
    );
  });
});
