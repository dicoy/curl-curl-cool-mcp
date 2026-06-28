import { z } from "zod";

export const AuthSchema = z
  .object({
    type: z.enum(["bearer", "basic", "api-key"]).describe("Authentication mechanism"),
    token: z.string().optional().describe("Token (bearer only)"),
    username: z.string().optional().describe("Username (basic only)"),
    password: z.string().optional().describe("Password (basic only)"),
    header: z.string().optional().describe("Header name (api-key only, default: X-API-Key)"),
    value: z.string().optional().describe("Key value (api-key only)"),
  })
  .describe("Auth — bearer token, HTTP Basic, or API key header");

export type Auth = z.infer<typeof AuthSchema>;

export function resolveAuthHeaders(auth: Auth | undefined): Record<string, string> {
  if (auth === undefined) return {};
  if (auth.type === "bearer" && auth.token !== undefined) {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === "basic" && auth.username !== undefined && auth.password !== undefined) {
    const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }
  if (auth.type === "api-key" && auth.value !== undefined) {
    return { [auth.header ?? "X-API-Key"]: auth.value };
  }
  return {};
}
