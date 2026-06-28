import { z } from "zod";

export const InputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe("Path to the Postman environment file (.postman_environment.json)"),
});

export type Input = z.infer<typeof InputSchema>;
