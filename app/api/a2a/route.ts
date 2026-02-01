/**
 * A2A (Agent-to-Agent Protocol) HTTP Endpoint
 *
 * Implements Google's A2A protocol for agent interoperability.
 * Allows other AI agents to discover and use Sandarb's capabilities.
 *
 * Endpoints:
 * - GET /api/a2a - Agent Card (discovery)
 * - POST /api/a2a - Execute skill / handle message
 * - GET /api/a2a/tasks/:id - Get task status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentCard,
  createTask,
  executeTask,
  getTask,
  executeSkill,
  processMessage,
} from '@/lib/a2a-server';
import type { A2AMessage } from '@/types';

// GET - Return Agent Card for discovery
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const card = getAgentCard(baseUrl);

  return NextResponse.json(card, {
    headers: {
      'Content-Type': 'application/json',
      'X-A2A-Version': '0.3',
    },
  });
}

// POST - Handle skill execution or message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if it's a JSON-RPC request
    if (body.jsonrpc === '2.0') {
      return handleJsonRpc(body);
    }

    // Check if it's a direct skill invocation
    if (body.skill) {
      return handleSkillInvocation(body);
    }

    // Check if it's a message
    if (body.message || body.messages) {
      return handleMessage(body);
    }

    // Check if it's a task creation
    if (body.action === 'create_task') {
      return handleTaskCreation(body);
    }

    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('A2A error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
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
      case 'agent/info':
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        result = getAgentCard(baseUrl);
        break;

      case 'skills/list':
        const card = getAgentCard('');
        result = { skills: card.skills };
        break;

      case 'skills/execute':
        result = await executeSkill(
          params?.skill as string,
          (params?.input || {}) as Record<string, unknown>
        );
        break;

      case 'tasks/create':
        const task = createTask(
          params?.skill as string,
          (params?.input || {}) as Record<string, unknown>
        );
        result = { taskId: task.id, status: task.status };
        break;

      case 'tasks/get':
        const existingTask = getTask(params?.taskId as string);
        if (!existingTask) {
          throw new Error(`Task not found: ${params?.taskId}`);
        }
        result = existingTask;
        break;

      case 'tasks/execute':
        const executedTask = await executeTask(params?.taskId as string);
        result = executedTask;
        break;

      case 'message/send':
        const response = await processMessage(params?.message as A2AMessage);
        result = { message: response };
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result,
    });
  } catch (error) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    });
  }
}

async function handleSkillInvocation(body: { skill: string; input?: Record<string, unknown> }) {
  const result = await executeSkill(body.skill, body.input || {});
  return NextResponse.json({ success: true, result });
}

async function handleMessage(body: { message?: A2AMessage; messages?: A2AMessage[] }) {
  const message = body.message || (body.messages && body.messages[body.messages.length - 1]);
  if (!message) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  }

  const response = await processMessage(message);
  return NextResponse.json({ message: response });
}

async function handleTaskCreation(body: { skill: string; input?: Record<string, unknown>; async?: boolean }) {
  const task = createTask(body.skill, body.input || {});

  if (body.async) {
    // Return immediately for async execution
    return NextResponse.json({
      taskId: task.id,
      status: task.status,
    });
  }

  // Execute synchronously
  const completedTask = await executeTask(task.id);
  return NextResponse.json(completedTask);
}
