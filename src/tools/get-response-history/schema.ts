import { z } from "zod";

export const InputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Number of recent requests to return (max 20)"),
});

export type Input = z.infer<typeof InputSchema>;
