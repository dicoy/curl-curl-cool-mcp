import { z } from "zod";

export const InputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      "Path to an OpenAPI 3.0 spec (.json or .yaml) or a custom JSON collection (array of request objects)",
    ),
});

export type Input = z.infer<typeof InputSchema>;
