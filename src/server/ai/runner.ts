import type { CreditService, Reservation } from "@/server/credits/service";
import { estimateCostUsd } from "./pricing";
import { resolveProvider } from "./providers/registry";
import { MODEL_ROUTES } from "./routing";
import type { WorkflowDefinition } from "./workflow";

export interface AIRunRecord {
  id: string;
  userId: string;
  workflow: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "SUCCEEDED" | "FAILED";
  error: string | null;
  createdAt: Date;
}

export interface AIRunStore {
  record(run: Omit<AIRunRecord, "id" | "createdAt">): Promise<AIRunRecord>;
}

export class WorkflowOutputError extends Error {
  constructor(readonly violations: string[]) {
    super("We couldn't produce a result that only uses facts from your profile. Your credits were refunded.");
    this.name = "WorkflowOutputError";
  }
}

export interface RunContext {
  userId: string;
  jobId?: string | null;
  /** Unique per user action (e.g. form submission id) — makes double-clicks charge once. */
  requestId: string;
  credits: CreditService;
  runs: AIRunStore;
}

export interface RunResult<O> {
  output: O;
  run: AIRunRecord;
  reservation: Reservation;
}

const MAX_ATTEMPTS = 2;

/**
 * reserve credits → call model → validate schema → fabrication guard → record run → settle.
 * A failed attempt is retried once with the violations appended; a second failure refunds credits.
 * Every model call (including failed attempts) is recorded as an AIRun for cost reporting.
 */
export async function runWorkflow<I, O>(wf: WorkflowDefinition<I, O>, input: I, ctx: RunContext): Promise<RunResult<O>> {
  const reservation = await ctx.credits.reserve(ctx.userId, wf.actionKey, {
    idempotencyKey: `${wf.name}:${ctx.requestId}`,
    jobId: ctx.jobId,
  });

  try {
    const route = MODEL_ROUTES[wf.name];
    const { provider, model } = resolveProvider(route, () => wf.mock(input));
    const { system, user } = wf.prompt(input);
    let feedback = "";
    let lastViolations: string[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      const res = await provider.generateStructured({
        model,
        system,
        user: user + feedback,
        schema: wf.schema,
        schemaName: wf.name,
        maxTokens: route.maxTokens,
        temperature: route.temperature,
      });
      const parsed = wf.schema.safeParse(res.raw);
      const violations = parsed.success
        ? (wf.check?.(input, parsed.data) ?? [])
        : parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

      const run = await ctx.runs.record({
        userId: ctx.userId,
        workflow: wf.name,
        provider: provider.name,
        model,
        promptVersion: wf.promptVersion,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        costUsd: estimateCostUsd(model, res.usage),
        latencyMs: Date.now() - started,
        status: violations.length ? "FAILED" : "SUCCEEDED",
        error: violations.length ? violations.join(" | ").slice(0, 2000) : null,
      });

      if (parsed.success && violations.length === 0) {
        await ctx.credits.settle(reservation, { aiRunId: run.id });
        return { output: parsed.data, run, reservation };
      }

      lastViolations = violations;
      feedback = `\n\nYour previous answer was rejected for these reasons. Fix them and answer again:\n- ${violations.join("\n- ")}`;
    }
    throw new WorkflowOutputError(lastViolations);
  } catch (err) {
    await ctx.credits.refund(reservation, err instanceof Error ? err.message.slice(0, 200) : "AI run failed");
    throw err;
  }
}
