import { NextRequest, NextResponse } from 'next/server';
import { getContextById, getContextByName, logInjection } from '@/lib/contexts';
import { logContextDelivery, logBlockedInjection } from '@/lib/audit';
import { getAgentByIdentifier } from '@/lib/agents';
import { checkInjectPolicy } from '@/lib/policy';
import { formatContent, substituteVariables } from '@/lib/utils';
import type { InjectionFormat } from '@/types';

const VARIABLES_HEADER = 'x-sandarb-variables';

/** Parse variables for {{client_name}} / {{portfolio_id}} injection from query, header, or body. */
function getInjectVariables(
  request: NextRequest,
  searchParams: URLSearchParams,
  body?: { variables?: Record<string, unknown> }
): Record<string, string | number | boolean | null | undefined> {
  const fromQuery = searchParams.get('vars');
  if (fromQuery) {
    try {
      const parsed = JSON.parse(decodeURIComponent(fromQuery)) as Record<string, unknown>;
      return normalizeVariables(parsed);
    } catch {
      // ignore invalid JSON
    }
  }
  const fromHeader = request.headers.get(VARIABLES_HEADER) ?? request.headers.get('X-Sandarb-Variables');
  if (fromHeader) {
    try {
      const parsed = JSON.parse(fromHeader) as Record<string, unknown>;
      return normalizeVariables(parsed);
    } catch {
      // ignore invalid JSON
    }
  }
  if (body?.variables && typeof body.variables === 'object') {
    return normalizeVariables(body.variables);
  }
  return {};
}

function normalizeVariables(
  obj: Record<string, unknown>
): Record<string, string | number | boolean | null | undefined> {
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) out[k] = v;
    else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else out[k] = String(v);
  }
  return out;
}

const AGENT_ID_HEADER = 'x-sandarb-agent-id';
const TRACE_ID_HEADER = 'x-sandarb-trace-id';

function getInjectAuditIds(
  request: NextRequest,
  searchParams: URLSearchParams,
  body?: { agentId?: string; traceId?: string }
): { agentId: string | null; traceId: string | null } {
  const agentId =
    request.headers.get(AGENT_ID_HEADER) ??
    request.headers.get('X-Sandarb-Agent-ID') ??
    searchParams.get('agentId') ??
    body?.agentId ??
    null;
  const traceId =
    request.headers.get(TRACE_ID_HEADER) ??
    request.headers.get('X-Sandarb-Trace-ID') ??
    searchParams.get('traceId') ??
    body?.traceId ??
    null;
  return { agentId: agentId?.trim() || null, traceId: traceId?.trim() || null };
}

function requireAuditIds(agentId: string | null, traceId: string | null): NextResponse | null {
  if (!agentId || !traceId) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Auditable injection requires X-Sandarb-Agent-ID and X-Sandarb-Trace-ID (headers or query agentId/traceId). Example: curl ".../api/inject?name=my-context" -H "X-Sandarb-Agent-ID: my-agent" -H "X-Sandarb-Trace-ID: exec-123"',
      },
      { status: 400 }
    );
  }
  return null;
}

// GET /api/inject - Get context for injection (bank-grade: requires Agent-ID + Trace-ID for lineage)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    const format = (searchParams.get('format') || 'json') as InjectionFormat;

    const { agentId, traceId } = getInjectAuditIds(request, searchParams);
    const bad = requireAuditIds(agentId, traceId);
    if (bad) return bad;

    // Validate format
    if (!['json', 'yaml', 'text'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use json, yaml, or text.' },
        { status: 400 }
      );
    }

    // Get context by ID or name
    let context;
    if (id) {
      context = await getContextById(id);
    } else if (name) {
      context = await getContextByName(name);
    } else {
      return NextResponse.json(
        { success: false, error: 'Either id or name parameter is required' },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Context not found' },
        { status: 404 }
      );
    }

    // Check if context is active
    if (!context.isActive) {
      return NextResponse.json(
        { success: false, error: 'Context is inactive' },
        { status: 403 }
      );
    }

    // Policy enforcement: agent must be registered; LOB must match context LOB (no cross-contamination)
    const agent = await getAgentByIdentifier(agentId!);
    if (!agent) {
      await logBlockedInjection({
        agentId: agentId!,
        traceId,
        contextId: context.id,
        contextName: context.name,
        reason: 'Agent not registered with Sandarb. Only registered agents may pull context.',
      });
      return NextResponse.json(
        { success: false, error: 'Agent not registered with Sandarb. Register this agent to pull context.' },
        { status: 403 }
      );
    }
    const policy = checkInjectPolicy(agent, context);
    if (!policy.allowed) {
      await logBlockedInjection({
        agentId: agentId!,
        traceId,
        contextId: context.id,
        contextName: context.name,
        reason: policy.reason ?? 'Policy violation',
      });
      return NextResponse.json(
        { success: false, error: policy.reason ?? 'Policy violation: cross-LOB access not allowed.' },
        { status: 403 }
      );
    }

    // Log the injection and lineage (agentId + traceId for dependency graph and trace-back)
    await logInjection(context.name);
    const sourceAgent = request.headers.get('X-Source-Agent') ?? searchParams.get('sourceAgent') ?? agentId;
    const intent = searchParams.get('intent') ?? undefined;
    await logContextDelivery({
      sourceAgent,
      contextId: context.id,
      contextName: context.name,
      intent,
      agentId,
      traceId,
    });

    // Variable injection: {{client_name}}, {{portfolio_id}}, etc. from query vars=, header X-Sandarb-Variables, or body variables
    const variables = getInjectVariables(request, searchParams);
    const contentToFormat = (Object.keys(variables).length > 0
      ? substituteVariables(context.content, variables)
      : context.content) as Record<string, unknown>;

    const fmt = format === 'xml' ? 'text' : format;
    const formattedContent = formatContent(contentToFormat, fmt);

    const contentType =
      format === 'json'
        ? 'application/json'
        : format === 'yaml'
          ? 'text/yaml'
          : 'text/plain';

    return new NextResponse(formattedContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Context-Name': context.name,
        'X-Context-ID': context.id,
        'X-Sandarb-Trace-ID': traceId!,
      },
    });
  } catch (error) {
    console.error('Failed to inject context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to inject context' },
      { status: 500 }
    );
  }
}

// POST /api/inject - Get context with custom overrides (bank-grade: requires Agent-ID + Trace-ID)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    const format = (searchParams.get('format') || 'json') as InjectionFormat;

    const body = (await request.json()) as {
      overrides?: Record<string, unknown>;
      variables?: Record<string, unknown>;
      sourceAgent?: string;
      intent?: string;
      agentId?: string;
      traceId?: string;
    };
    const { overrides, variables: bodyVariables, sourceAgent: bodySourceAgent, intent: bodyIntent, agentId: bodyAgentId, traceId: bodyTraceId } = body;

    const { agentId, traceId } = getInjectAuditIds(request, searchParams, { agentId: bodyAgentId, traceId: bodyTraceId });
    const bad = requireAuditIds(agentId, traceId);
    if (bad) return bad;

    // Get context by ID or name
    let context;
    if (id) {
      context = await getContextById(id);
    } else if (name) {
      context = await getContextByName(name);
    } else {
      return NextResponse.json(
        { success: false, error: 'Either id or name parameter is required' },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Context not found' },
        { status: 404 }
      );
    }

    if (!context.isActive) {
      return NextResponse.json(
        { success: false, error: 'Context is inactive' },
        { status: 403 }
      );
    }

    // Policy enforcement: agent must be registered; LOB must match context LOB
    const agentPost = await getAgentByIdentifier(agentId!);
    if (!agentPost) {
      await logBlockedInjection({
        agentId: agentId!,
        traceId,
        contextId: context.id,
        contextName: context.name,
        reason: 'Agent not registered with Sandarb. Only registered agents may pull context.',
      });
      return NextResponse.json(
        { success: false, error: 'Agent not registered with Sandarb. Register this agent to pull context.' },
        { status: 403 }
      );
    }
    const policyPost = checkInjectPolicy(agentPost, context);
    if (!policyPost.allowed) {
      await logBlockedInjection({
        agentId: agentId!,
        traceId,
        contextId: context.id,
        contextName: context.name,
        reason: policyPost.reason ?? 'Policy violation',
      });
      return NextResponse.json(
        { success: false, error: policyPost.reason ?? 'Policy violation: cross-LOB access not allowed.' },
        { status: 403 }
      );
    }

    // Merge content with overrides
    const mergedContent = {
      ...context.content,
      ...overrides,
    };

    await logInjection(context.name);
    const sourceAgent =
      request.headers.get('X-Source-Agent') ?? searchParams.get('sourceAgent') ?? bodySourceAgent ?? agentId;
    const intent = searchParams.get('intent') ?? bodyIntent ?? undefined;
    await logContextDelivery({
      sourceAgent,
      contextId: context.id,
      contextName: context.name,
      intent,
      agentId,
      traceId,
    });

    // Variable injection: {{client_name}}, {{portfolio_id}}, etc.
    const variablesPost = getInjectVariables(request, searchParams, body);
    const contentToFormatPost = (Object.keys(variablesPost).length > 0
      ? substituteVariables(mergedContent, variablesPost)
      : mergedContent) as Record<string, unknown>;

    const fmt2 = format === 'xml' ? 'text' : format;
    const formattedContent = formatContent(contentToFormatPost, fmt2);

    const contentType =
      format === 'json'
        ? 'application/json'
        : format === 'yaml'
          ? 'text/yaml'
          : 'text/plain';

    return new NextResponse(formattedContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Context-Name': context.name,
        'X-Context-ID': context.id,
        'X-Sandarb-Trace-ID': traceId!,
      },
    });
  } catch (error) {
    console.error('Failed to inject context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to inject context' },
      { status: 500 }
    );
  }
}
