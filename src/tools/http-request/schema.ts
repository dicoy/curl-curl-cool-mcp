import { z } from "zod";

export const InputSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    .default("GET")
    .describe("HTTP method"),
  url: z.string().min(1).describe("Full URL including protocol (https://...)"),
  headers: z.record(z.string(), z.string()).optional().describe("Request headers"),
  body: z.string().optional().describe("Request body — pass JSON as a string"),
  timeout_ms: z
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(10000)
    .describe("Request timeout in milliseconds (default 10 000)"),
});

export type Input = z.infer<typeof InputSchema>;
