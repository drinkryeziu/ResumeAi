import type { ProviderName } from "./providers/types";

export type WorkflowName =
  | "resume_parser"
  | "job_analyzer"
  | "candidate_match"
  | "resume_optimizer"
  | "master_resume"
  | "cover_letter"
  | "ats_check";

export interface ModelRoute {
  provider: Exclude<ProviderName, "mock">;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * maxTokens is a ceiling, not a cost: only the tokens actually written are billed. It is generous on purpose, because an answer
 * that is cut off mid-way cannot be read at all and the whole step fails.
 *
 * Which model runs which workflow. Extraction and analysis use the fast tier; writing uses the
 * stronger tier. Change a line here (or, later, from the admin page) to switch models or vendors.
 */
export const MODEL_ROUTES: Record<WorkflowName, ModelRoute> = {
  resume_parser: { provider: "anthropic", model: "claude-haiku-5-5", maxTokens: 4000, temperature: 0 },
  job_analyzer: { provider: "anthropic", model: "claude-haiku-5-5", maxTokens: 6000, temperature: 0 },
  candidate_match: { provider: "anthropic", model: "claude-haiku-5-5", maxTokens: 10000, temperature: 0 },
  master_resume: { provider: "anthropic", model: "claude-sonnet-5-5", maxTokens: 10000, temperature: 0.3 },
  resume_optimizer: { provider: "anthropic", model: "claude-sonnet-5-5", maxTokens: 10000, temperature: 0.3 },
  cover_letter: { provider: "anthropic", model: "claude-sonnet-5-5", maxTokens: 3000, temperature: 0.5 },
  ats_check: { provider: "anthropic", model: "claude-haiku-5-5", maxTokens: 2000, temperature: 0 },
};
