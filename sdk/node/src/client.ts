/**
 * Sandarb Node/TypeScript Client (Unified Interface).
 *
 * Implements: get_context, get_prompt, log_activity.
 * Authentication via API Key (maps to service_accounts table).
 */

import { randomUUID } from "crypto";
import type { GetContextResult, GetPromptResult } from "./models.js";
import { GetContextResultSchema, GetPromptResultSchema } from "./models.js";

export class SandarbError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public body?: string
  ) {
    super(message);
    this.name = "SandarbError";
  }
}

export interface SandarbClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

const DEFAULT_BASE_URL = "https://api.sandarb.ai";
const DEFAULT_TIMEOUT = 30_000;

/**
 * Sandarb SDK client. Same interface as Python and Go SDKs.
 */
export class SandarbClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;

  constructor(options: SandarbClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.SANDARB_URL ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      ""
    );
    this.apiKey = options.apiKey ?? process.env.SANDARB_API_KEY;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extra,
    };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: {
      params?: Record<string, string>;
      body?: object;
      agentId?: string;
      traceId?: string;
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (opts.params) {
      Object.entries(opts.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const headers = this.headers({
      ...(opts.agentId && { "X-Sandarb-Agent-ID": opts.agentId }),
      ...(opts.traceId && { "X-Sandarb-Trace-ID": opts.traceId }),
    });
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) {
      throw new SandarbError(
        `Sandarb API error: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  /**
   * Fetch context by name for the given agent.
   * Returns content + context_version_id (from context_versions).
   */
  async getContext(contextName: string, agentId: string): Promise<GetContextResult> {
    const traceId = randomUUID();
    const res = await fetch(
      `${this.baseUrl}/api/inject?name=${encodeURIComponent(contextName)}&format=json`,
      {
        method: "GET",
        headers: this.headers({
          "X-Sandarb-Agent-ID": agentId,
          "X-Sandarb-Trace-ID": traceId,
        }),
        signal: AbortSignal.timeout(this.timeout),
      }
    );
    if (!res.ok) {
      throw new SandarbError(
        `Sandarb API error: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const content = (await res.json()) as Record<string, unknown>;
    const contextVersionId = res.headers.get("X-Context-Version-ID") ?? undefined;
    return GetContextResultSchema.parse({
      content: content ?? {},
      context_version_id: contextVersionId || null,
    });
  }

  /**
   * Fetch compiled prompt by name with optional variable substitution.
   */
  async getPrompt(
    promptName: string,
    variables?: Record<string, unknown>,
    opts?: { agentId?: string; traceId?: string }
  ): Promise<GetPromptResult> {
    const agentId = opts?.agentId ?? process.env.SANDARB_AGENT_ID;
    if (!agentId) {
      throw new Error("agent_id is required for get_prompt (or set SANDARB_AGENT_ID)");
    }
    const traceId = opts?.traceId ?? randomUUID();
    const params: Record<string, string> = { name: promptName };
    if (variables && Object.keys(variables).length > 0) {
      params.vars = JSON.stringify(variables);
    }
    const qs = new URLSearchParams(params).toString();
    const data = await this.request<{ success?: boolean; data?: unknown }>(
      "GET",
      `/api/prompts/pull?${qs}`,
      { agentId, traceId }
    );
    if (!data?.success || typeof (data as { data?: unknown }).data !== "object") {
      throw new SandarbError("Invalid get_prompt response", undefined, JSON.stringify(data));
    }
    const d = (data as { data: Record<string, unknown> }).data;
    return GetPromptResultSchema.parse({
      content: d.content ?? "",
      version: d.version ?? 0,
      model: d.model ?? null,
      system_prompt: d.systemPrompt ?? null,
    });
  }

  /**
   * Write an activity record to sandarb_access_logs (metadata = { inputs, outputs }).
   */
  async logActivity(
    agentId: string,
    traceId: string,
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>
  ): Promise<void> {
    await this.request("POST", "/api/audit/activity", {
      body: { agent_id: agentId, trace_id: traceId, inputs, outputs },
      agentId,
      traceId,
    });
  }
}
