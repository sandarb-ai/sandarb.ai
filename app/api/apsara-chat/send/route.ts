import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { OPENCLAW_AGENT_IDS, APSARA_AGENTS } from '@/lib/apsara-constants';
import type { ApsaraAgentId } from '@/lib/apsara-constants';

const PROJECT = path.resolve(process.cwd());
const LOG_DIR = path.join(PROJECT, 'logs');
const TEAM_CHAT_LOG = path.join(LOG_DIR, 'team-chat.log');

const RELAYABLE_APSARA_IDS = (Object.entries(OPENCLAW_AGENT_IDS) as [ApsaraAgentId, string | null][])
  .filter(([, v]) => v != null)
  .map(([id]) => id);

/** Resolve agent id to OpenClaw agent id (e.g. punjikasthala -> ai-governance). */
function toOpenClawAgentId(agentId: string): string | null {
  if (OPENCLAW_AGENT_IDS[agentId as ApsaraAgentId] != null) {
    return OPENCLAW_AGENT_IDS[agentId as ApsaraAgentId];
  }
  const known = new Set(Object.values(OPENCLAW_AGENT_IDS).filter(Boolean));
  return known.has(agentId) ? agentId : null;
}

function sendToOne(openclawId: string, message: string, env: NodeJS.ProcessEnv): { ok: boolean; out: string; err: string } {
  const result = spawnSync('openclaw', ['agent', '--agent', openclawId, '--message', message], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120000,
    env: { ...env, OPENCLAW_GATEWAY_TOKEN: env.OPENCLAW_GATEWAY_TOKEN || 'sandarb' },
    shell: false,
  });
  const out = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  const spawnError = result.error ? (result.error as NodeJS.ErrnoException).message || String(result.error) : '';
  const err = stderr || spawnError;
  const ok = !result.error && result.status === 0;
  return { ok, out: out || 'OK', err };
}

/**
 * POST /api/apsara-chat/send
 * Body: { agentId: string, message: string }
 * agentId can be 'all' to send to every OpenClaw agent (@all style).
 * Message can start with "@all " or "@everyone " to send to all (prefix is stripped).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let agentId = typeof body.agentId === 'string' ? body.agentId.trim() : '';
    let message = typeof body.message === 'string' ? body.message.trim() : '';

    // Chat-style: @all or @everyone at start of message → send to all
    const atAllMatch = message.match(/^(@all|@everyone)\s+/i);
    if (atAllMatch) {
      message = message.slice(atAllMatch[0].length).trim();
      agentId = agentId || 'all';
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'message is required' },
        { status: 400 }
      );
    }

    const env = { ...process.env };
    if (!env.OPENCLAW_GATEWAY_TOKEN) env.OPENCLAW_GATEWAY_TOKEN = 'sandarb';

    // Quick check: if OpenClaw CLI isn't available, fail fast instead of hanging
    const probe = spawnSync('openclaw', ['--version'], {
      encoding: 'utf8',
      timeout: 3000,
      env: { ...env, OPENCLAW_GATEWAY_TOKEN: env.OPENCLAW_GATEWAY_TOKEN || 'sandarb' },
      shell: false,
    });
    if (probe.error && (probe.error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenClaw CLI not found. Install OpenClaw and add it to PATH, then start the gateway (e.g. openclaw gateway --port 18789). See scripts/start-apsara-team.sh.',
        },
        { status: 503 }
      );
    }

    // Send to all OpenClaw agents (@all)
    if (agentId === 'all') {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
      const timestamp = new Date().toISOString();
      fs.appendFileSync(
        TEAM_CHAT_LOG,
        `[${timestamp}] 👤 You → @all: ${message.replace(/\n/g, ' ').substring(0, 300)}\n`
      );

      const responses: { agentId: string; name: string; ok: boolean; response?: string; error?: string }[] = [];
      for (const apsaraId of RELAYABLE_APSARA_IDS) {
        const openclawId = toOpenClawAgentId(apsaraId)!;
        const agent = APSARA_AGENTS[apsaraId];
        const { ok, out, err } = sendToOne(openclawId, message, env);
        const displayOut = ok
          ? out.replace(/\n/g, ' ').trim().substring(0, 400)
          : err.includes('ETIMEDOUT')
            ? 'OpenClaw gateway timed out. Start gateway: openclaw gateway --port 18789.'
            : (err || out).replace(/\n/g, ' ').trim().substring(0, 400);
        try {
          fs.appendFileSync(
            TEAM_CHAT_LOG,
            `[${new Date().toISOString()}] ${agent.emoji} ${agent.name}: ${displayOut || '(no output)'}\n`
          );
        } catch {
          // ignore
        }
        if (!ok && err && (err.includes('not found') || err.includes('ENOENT') || err.includes('openclaw') || err.includes('spawn') || err.includes('ETIMEDOUT'))) {
          const gatewayMsg = err.includes('ETIMEDOUT')
            ? 'OpenClaw gateway timed out. Start the gateway with: openclaw gateway --port 18789 (see scripts/start-apsara-team.sh).'
            : 'OpenClaw CLI not found or gateway not running. Install OpenClaw, add it to PATH, and start the gateway (e.g. openclaw gateway --port 18789). See README or scripts/start-apsara-team.sh.';
          return NextResponse.json(
            { success: false, error: gatewayMsg },
            { status: 503 }
          );
        }
        responses.push({
          agentId: apsaraId,
          name: agent.name,
          ok,
          response: ok ? out : undefined,
          error: !ok ? (err || out) : undefined,
        });
      }

      const sent = responses.filter((r) => r.ok).length;
      return NextResponse.json({
        success: true,
        sent,
        total: RELAYABLE_APSARA_IDS.length,
        responses: responses.map(({ agentId: id, name, ok, response, error }) => ({
          agentId: id,
          name,
          ok,
          response: response?.substring(0, 200),
          error: error?.substring(0, 200),
        })),
      });
    }

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId is required (or use @all in message to message everyone)' },
        { status: 400 }
      );
    }

    const openclawId = toOpenClawAgentId(agentId);
    if (!openclawId) {
      return NextResponse.json(
        { success: false, error: `Unknown agent: ${agentId}. Use an Apsara id, OpenClaw id, or @all in message.` },
        { status: 400 }
      );
    }

    const { ok, out, err } = sendToOne(openclawId, message, env);

    if (!ok) {
      return NextResponse.json({
        success: false,
        error: err || 'Command failed',
        response: out || undefined,
      }, { status: 200 });
    }

    const agentEntry = Object.entries(APSARA_AGENTS).find(
      ([_, a]) => OPENCLAW_AGENT_IDS[a.id as ApsaraAgentId] === openclawId
    );
    const agentName = agentEntry ? agentEntry[1].name : openclawId;
    const agentEmoji = agentEntry ? agentEntry[1].emoji : '🤖';
    const timestamp = new Date().toISOString();
    const safeOut = (out || 'OK').replace(/\n/g, ' ').trim().substring(0, 400);
    try {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(
        TEAM_CHAT_LOG,
        `[${timestamp}] 👤 You → ${agentName}: ${message.replace(/\n/g, ' ').trim().substring(0, 300)}\n`
      );
      fs.appendFileSync(
        TEAM_CHAT_LOG,
        `[${timestamp}] ${agentEmoji} ${agentName}: ${safeOut}\n`
      );
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      response: out || 'OK',
    });
  } catch (e) {
    console.error('apsara-chat/send:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed to send' },
      { status: 500 }
    );
  }
}
