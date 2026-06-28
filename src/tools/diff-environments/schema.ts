import { z } from "zod";

export const InputSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET").describe("HTTP method"),
  path: z
    .string()
    .min(1)
    .describe("Request path appended to each environment base URL (e.g. /api/users/1)"),
  environments: z
    .record(z.string(), z.string())
    .describe(
      'Map of environment name to base URL — e.g. { "dev": "https://api-dev.example.com", "prod": "https://api.example.com" }. At least two environments required.',
    ),
  headers: z.record(z.string(), z.string()).optional().describe("Headers sent to all environments"),
  body: z.string().optional().describe("Request body (for POST/PUT/PATCH)"),
  timeout_ms: z.number().int().min(100).max(30000).default(10000),
});

export type Input = z.infer<typeof InputSchema>;
