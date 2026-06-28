import { z } from "zod";

export const InputSchema = z.object({
  json: z.string().min(1).describe("JSON string to infer TypeScript types from"),
  root_type_name: z
    .string()
    .min(1)
    .default("ApiResponse")
    .describe("Name for the root interface (default: ApiResponse)"),
});

export type Input = z.infer<typeof InputSchema>;
