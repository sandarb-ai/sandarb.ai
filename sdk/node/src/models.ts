/**
 * Sandarb SDK data models (Unified Interface).
 * Zod schemas aligned with schema/sandarb.sql: contexts, context_versions,
 * prompts, prompt_versions, sandarb_access_logs.
 */

import { z } from "zod";

export const GetContextResultSchema = z.object({
  content: z.record(z.unknown()).default({}),
  context_version_id: z.string().uuid().nullable().optional(),
});
export type GetContextResult = z.infer<typeof GetContextResultSchema>;

export const GetPromptResultSchema = z.object({
  content: z.string(),
  version: z.number().int().nonnegative(),
  model: z.string().nullable().optional(),
  system_prompt: z.string().nullable().optional(),
});
export type GetPromptResult = z.infer<typeof GetPromptResultSchema>;
