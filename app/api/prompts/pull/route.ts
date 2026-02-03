/**
 * GET /api/prompts/pull - Pull approved prompt by name (single source of truth for agents).
 * Requires X-Sandarb-Agent-ID and X-Sandarb-Trace-ID (or query agentId/traceId) for audit lineage.
 * Use agentId=sandarb-prompt-preview for UI "Test API" (skips audit).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPromptByName, getCurrentPromptVersion, interpolatePrompt } from '@/lib/prompts';
import { logPromptUsage } from '@/lib/audit';

const AGENT_ID_HEADER = 'x-sandarb-agent-id';
const TRACE_ID_HEADER = 'x-sandarb-trace-id';
const PREVIEW_AGENT_ID = 'sandarb-prompt-preview';

function getAuditIds(
  request: NextRequest,
  searchParams: URLSearchParams
): { agentId: string | null; traceId: string | null } {
  const agentId =
    request.headers.get(AGENT_ID_HEADER) ??
    request.headers.get('X-Sandarb-Agent-ID') ??
    searchParams.get('agentId') ??
    null;
  const traceId =
    request.headers.get(TRACE_ID_HEADER) ??
    request.headers.get('X-Sandarb-Trace-ID') ??
    searchParams.get('traceId') ??
    null;
  return { agentId: agentId?.trim() || null, traceId: traceId?.trim() || null };
}

function requireAuditIds(agentId: string | null, traceId: string | null): NextResponse | null {
  if (!agentId || !traceId) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Auditable prompt pull requires X-Sandarb-Agent-ID and X-Sandarb-Trace-ID (headers or query agentId/traceId). Example: GET /api/prompts/pull?name=my-prompt -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: exec-123"',
      },
      { status: 400 }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "name" is required.' },
        { status: 400 }
      );
    }

    const { agentId, traceId } = getAuditIds(request, searchParams);
    const bad = requireAuditIds(agentId, traceId);
    if (bad) return bad;

    const prompt = await getPromptByName(name);
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: `Prompt not found: ${name}` },
        { status: 404 }
      );
    }

    const version = await getCurrentPromptVersion(prompt.id);
    if (!version) {
      return NextResponse.json(
        { success: false, error: `No approved version for prompt: ${name}` },
        { status: 404 }
      );
    }

    let content = version.content;
    const varsParam = searchParams.get('variables');
    if (varsParam) {
      try {
        const variables = JSON.parse(decodeURIComponent(varsParam)) as Record<string, unknown>;
        content = interpolatePrompt(content, variables);
      } catch {
        // ignore invalid variables
      }
    }

    const isPreview = agentId === PREVIEW_AGENT_ID;
    if (!isPreview) {
      await logPromptUsage({
        agentId: agentId!,
        traceId: traceId!,
        promptId: prompt.id,
        promptVersionId: version.id,
        promptName: prompt.name,
        intent: searchParams.get('intent') ?? undefined,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        name: prompt.name,
        content,
        version: version.version,
        model: version.model ?? null,
        systemPrompt: version.systemPrompt ?? null,
        temperature: version.temperature ?? null,
        maxTokens: version.maxTokens ?? null,
      },
    });
  } catch (error) {
    console.error('Prompts pull error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
