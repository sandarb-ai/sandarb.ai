/**
 * A2A (Agent-to-Agent Protocol) HTTP Endpoint
 *
 * How A2A URLs work in practice for the Sandarb AI agent:
 * - Discovery: Agent A uses this A2A URL to read Sandarb's capabilities (GET returns Agent Card).
 * - Interaction: Agent A sends JSON-RPC 2.0 over HTTP(S) to this URL to initiate a task (POST).
 * - Real-time updates: For long-running tasks, an A2A server may use SSE to send updates; Sandarb currently responds synchronously.
 *
 * - GET /api/a2a - Agent Card (discovery)
 * - POST /api/a2a - JSON-RPC 2.0 only: message/send, tasks/get, tasks/create, tasks/execute, skills/list, skills/execute, agent/info
 *
 * @see https://google.github.io/A2A/specification/
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentCard,
  createTask,
  executeTask,
  getTask,
  executeSkill,
  processMessage,
  taskToSpec,
} from '@/lib/a2a-server';
import { logA2ACall } from '@/lib/audit';

const JSON_RPC_HEADERS = {
  'Content-Type': 'application/json',
  'X-A2A-Version': '0.3',
};

// GET - Return Agent Card for discovery (A2A spec: well-known or direct)
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const card = getAgentCard(baseUrl);

  await logA2ACall({
    agentId: 'anonymous',
    traceId: `discovery-${Date.now()}`,
    method: 'GET',
    inputSummary: 'Agent Card discovery',
    resultSummary: 'ok',
    requestIp:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null,
  });

  return NextResponse.json(card, {
    headers: JSON_RPC_HEADERS,
  });
}

/** Build agentId/traceId/inputSummary for A2A log from JSON-RPC body and request. */
function buildA2ALogContext(
  body: { method?: string; id?: string | number; params?: Record<string, unknown> },
  request: NextRequest
): { agentId: string; traceId: string; inputSummary: string; requestIp: string | null } {
  const params = body?.params ?? {};
  const msg = params?.message as Record<string, unknown> | undefined;
  const meta = msg?.metadata as Record<string, unknown> | undefined;
  const agentId =
    (meta?.senderId as string) ??
    (params?.input && typeof params.input === 'object' && params.input !== null
      ? (params.input as Record<string, unknown>).agentId
      : undefined);
  const traceId =
    (meta?.traceId as string) ??
    (params?.traceId as string) ??
    `req-${body?.id ?? Date.now()}`;
  let inputSummary = '';
  if (body?.method === 'skills/execute' && params?.skill) inputSummary = `skill=${String(params.skill)}`;
  else if (body?.method === 'message/send') inputSummary = 'message/send';
  else if (body?.method === 'tasks/create' && params?.skill) inputSummary = `task skill=${String(params.skill)}`;
  else if (body?.method === 'tasks/get' && params?.taskId) inputSummary = `taskId=${String(params.taskId)}`;
  else if (body?.method === 'tasks/execute' && params?.taskId) inputSummary = `taskId=${String(params.taskId)}`;
  else if (body?.method) inputSummary = body.method;
  const requestIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;
  return {
    agentId: typeof agentId === 'string' ? agentId : 'anonymous',
    traceId: typeof traceId === 'string' ? traceId : `req-${body?.id ?? Date.now()}`,
    inputSummary: inputSummary.slice(0, 200),
    requestIp,
  };
}

// POST - JSON-RPC 2.0 only (A2A spec: request body MUST be JSONRPCRequest)
export async function POST(request: NextRequest) {
  let body: JsonRpcRequest | undefined;
  let logCtx: { agentId: string; traceId: string; inputSummary: string; requestIp: string | null } | undefined;

  try {
    body = (await request.json()) as JsonRpcRequest;

    if (body?.jsonrpc !== '2.0') {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32600,
            message: 'Invalid Request. A2A requires JSON-RPC 2.0; send body with jsonrpc: "2.0", method, id, and optional params.',
          },
        },
        { status: 400, headers: JSON_RPC_HEADERS }
      );
    }

    logCtx = buildA2ALogContext(body, request);
    const response = await handleJsonRpc(body);
    await logA2ACall({
      agentId: logCtx.agentId,
      traceId: logCtx.traceId,
      method: body.method ?? 'unknown',
      inputSummary: logCtx.inputSummary || undefined,
      resultSummary: 'ok',
      requestIp: logCtx.requestIp,
    });
    return response;
  } catch (error) {
    const method = body?.method ?? 'unknown';
    if (logCtx) {
      await logA2ACall({
        agentId: logCtx.agentId,
        traceId: logCtx.traceId,
        method,
        inputSummary: logCtx.inputSummary || undefined,
        error: error instanceof Error ? error.message : 'Internal error',
        requestIp: logCtx.requestIp,
      });
    }
    console.error('A2A error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: body?.id ?? null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      },
      { status: 500, headers: JSON_RPC_HEADERS }
    );
  }
}

// ============================================================================
// Request Handlers
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

async function handleJsonRpc(body: JsonRpcRequest) {
  const { id, method, params } = body;

  try {
    let result: unknown;

    switch (method) {
      case 'agent/info': {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        result = getAgentCard(baseUrl);
        break;
      }

      case 'skills/list': {
        const card = getAgentCard('');
        result = { skills: card.skills };
        break;
      }

      case 'skills/execute':
        result = await executeSkill(
          params?.skill as string,
          (params?.input || {}) as Record<string, unknown>
        );
        break;

      case 'tasks/create': {
        const task = createTask(
          params?.skill as string,
          (params?.input || {}) as Record<string, unknown>
        );
        result = taskToSpec(task);
        break;
      }

      case 'tasks/get': {
        const existingTask = getTask(params?.taskId as string);
        if (!existingTask) {
          throw new Error(`Task not found: ${params?.taskId}`);
        }
        result = taskToSpec(existingTask);
        break;
      }

      case 'tasks/execute': {
        const executedTask = await executeTask(params?.taskId as string);
        result = taskToSpec(executedTask);
        break;
      }

      case 'message/send': {
        const msg = params?.message as { parts?: unknown[] } | undefined;
        if (!msg || typeof msg !== 'object' || !Array.isArray(msg.parts) || msg.parts.length === 0) {
          throw new Error('message/send requires params.message with at least one part.');
        }
        result = await processMessage({
          message: params?.message as Parameters<typeof processMessage>[0]['message'],
          configuration: params?.configuration as Parameters<typeof processMessage>[0]['configuration'],
        });
        break;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return NextResponse.json(
      { jsonrpc: '2.0', id, result },
      { headers: JSON_RPC_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      },
      { status: 200, headers: JSON_RPC_HEADERS }
    );
  }
}
