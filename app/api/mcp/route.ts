/**
 * MCP (Model Context Protocol) HTTP Endpoint
 *
 * Implements MCP over HTTP for remote server access.
 * Compatible with Claude, ChatGPT, and other MCP clients.
 *
 * Endpoints:
 * - POST /api/mcp - JSON-RPC 2.0 handler
 * - GET /api/mcp - Server info
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getServerInfo,
  listResources,
  readResource,
  listTools,
  callTool,
  listMCPPrompts,
  getMCPPrompt,
} from '@/lib/mcp-server';
import { withSpan, logger } from '@/lib/otel';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// GET - Return server info
export async function GET() {
  const info = getServerInfo();
  return NextResponse.json(info);
}

// POST - Handle JSON-RPC requests
export async function POST(request: NextRequest) {
  return withSpan('POST /api/mcp', async () => {
    try {
      const body = await request.json() as JsonRpcRequest;

      if (body.jsonrpc !== '2.0') {
        return jsonRpcError(body.id, -32600, 'Invalid Request: jsonrpc must be "2.0"');
      }

      const result = await handleMethod(body.method, body.params || {});
      return jsonRpcSuccess(body.id, result);
    } catch (error) {
      logger.error('MCP error', { route: 'POST /api/mcp', error: String(error) });
      return jsonRpcError(
        0,
        -32603,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  });
}

async function handleMethod(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    // ========================================================================
    // Initialization
    // ========================================================================
    case 'initialize':
      return {
        ...getServerInfo(),
        instructions: 'OpenInt Sandarb - Prompt and context management for AI agents',
      };

    // ========================================================================
    // Resources
    // ========================================================================
    case 'resources/list':
      return { resources: await listResources() };

    case 'resources/read':
      return await readResource(params.uri as string);

    // ========================================================================
    // Tools
    // ========================================================================
    case 'tools/list':
      return { tools: listTools() };

    case 'tools/call':
      return await callTool(params.name as string, (params.arguments || {}) as Record<string, unknown>);

    // ========================================================================
    // Prompts
    // ========================================================================
    case 'prompts/list':
      return { prompts: listMCPPrompts() };

    case 'prompts/get':
      return getMCPPrompt(
        params.name as string,
        (params.arguments || {}) as Record<string, unknown>
      );

    // ========================================================================
    // Completion (for sampling)
    // ========================================================================
    case 'completion/complete':
      // Sandarb doesn't do completions - return empty
      return { completion: { values: [] } };

    // ========================================================================
    // Ping
    // ========================================================================
    case 'ping':
      return {};

    default:
      throw new Error(`Method not found: ${method}`);
  }
}

function jsonRpcSuccess(id: string | number, result: unknown): NextResponse {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id,
    result,
  };
  return NextResponse.json(response);
}

function jsonRpcError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown
): NextResponse {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
  return NextResponse.json(response, { status: code === -32600 ? 400 : 500 });
}
