import { z } from "zod";
import { AuthSchema } from "../../utils/auth.js";

export const InputSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET").describe("HTTP method"),
  path: z
    .string()
    .min(1)
    .describe(
      "Path appended to each base URL (e.g. /api/users/1), or a full URL template with {{variable}} placeholders when environments are variable maps.",
    ),
  environments: z
    .record(
      z.string(),
      z.union([
        z.string().describe("Base URL — path is appended directly"),
        z
          .record(z.string(), z.string())
          .describe(
            "Variable map — {{placeholders}} in path are substituted per environment. Include base_url to set the host.",
          ),
      ]),
    )
    .describe(
      "Map of environment name to a base URL string or a variable map. " +
        'String: { "dev": "https://api-dev.example.com" } with path "/api/users". ' +
        'Variable map: { "dev": { "base_url": "https://api-dev.example.com" } } with path "{{base_url}}/api/users". At least two environments required.',
    ),
  headers: z.record(z.string(), z.string()).optional().describe("Headers sent to all environments"),
  body: z.string().optional().describe("Request body (for POST/PUT/PATCH)"),
  timeout_ms: z.number().int().min(100).max(30000).default(10000),
  auth: AuthSchema.optional(),
});

export type Input = z.infer<typeof InputSchema>;
