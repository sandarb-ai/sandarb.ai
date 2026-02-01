import { NextResponse } from 'next/server';
import { getRootOrganization, getOrganizationBySlug, createOrganization, getAllOrganizations } from '@/lib/organizations';
import { createAgent, getAgentCount } from '@/lib/agents';
import { createContext, getContextByName, getContextCount } from '@/lib/contexts';
import { proposeRevision, approveRevision, getProposedRevisions, getRevisionsByContextId } from '@/lib/revisions';
import { createTemplate, getTemplateByName } from '@/lib/templates';
import { usePg } from '@/lib/pg';
import { getPool } from '@/lib/pg';
import type { LineOfBusiness, DataClassification, TemplateSchema } from '@/types';

/** Bootstrap targets: 30 orgs, 420 agents (14 per org), 3009 contexts. Used on GCP deploy and local. */
const TARGET_ORGS = 30;
const TARGET_AGENTS = 420;
const TARGET_CONTEXTS = 3009;
const AGENTS_PER_ORG = 14; // 30 * 14 = 420
/** For each of first N contexts: History 2–26 (approved), Pending 1–5 (proposed). */
const CONTEXTS_WITH_FULL_REVISIONS = 80;
const HISTORY_MIN = 2;
const HISTORY_MAX = 26;
const PENDING_MIN = 1;
const PENDING_MAX = 5;

/**
 * POST /api/seed
 * Seeds bootstrap data: 30 orgs, 420 agents, 3009 contexts.
 * Plus templates, settings, scan_targets, activity/audit samples.
 * Idempotent: skips creating resources that already exist. Runs on container start (e.g. GCP Cloud Run).
 */

export const maxDuration = 60;

const LOB_OPTIONS: LineOfBusiness[] = ['retail', 'investment_banking', 'wealth_management'];
const DATA_CLASS_OPTIONS: DataClassification[] = ['public', 'internal', 'confidential', 'restricted'];

export async function POST() {
  try {
    const root = await getRootOrganization();
    if (!root) {
      return NextResponse.json(
        { success: false, error: 'Root organization not found. Start the app once to init DB.' },
        { status: 400 }
      );
    }

    // --- Bootstrap: 30 orgs (1 root + 29 divisions) ---
    let orgs = await getAllOrganizations();
    while (orgs.length < TARGET_ORGS) {
      const n = orgs.length;
      const slug = `division-${String(n).padStart(2, '0')}`;
      if (await getOrganizationBySlug(slug)) {
        orgs = await getAllOrganizations();
        continue;
      }
      try {
        await createOrganization({
          name: `Division ${n}`,
          slug,
          description: `Division ${n} for governance and agents`,
          parentId: root.id,
        });
      } catch {
        // Duplicate; skip
      }
      orgs = await getAllOrganizations();
    }

    // --- Bootstrap: 420 agents (14 per org) ---
    const totalAgentCount = await getAgentCount();
    if (totalAgentCount < TARGET_AGENTS) {
      for (let o = 0; o < orgs.length && (await getAgentCount()) < TARGET_AGENTS; o++) {
        const orgId = orgs[o].id;
        const currentInOrg = await getAgentCount(orgId);
        const toAdd = Math.min(AGENTS_PER_ORG - currentInOrg, TARGET_AGENTS - (await getAgentCount()));
        for (let a = 0; a < toAdd; a++) {
          const idx = currentInOrg + a + 1;
          const name = `Agent ${o + 1}-${idx}`;
          const a2aUrl = `https://agents.example.com/division-${String(o + 1).padStart(2, '0')}/agent-${idx}`;
          try {
            await createAgent({
              orgId,
              name,
              description: `Agent ${idx} in Division ${o + 1}`,
              a2aUrl,
            });
          } catch {
            // Duplicate; skip
          }
        }
      }
    }

    // --- Bootstrap: 3009 contexts ---
    const { total: contextTotal } = await getContextCount();
    if (contextTotal < TARGET_CONTEXTS) {
      const lob = LOB_OPTIONS[0];
      const dataClass = DATA_CLASS_OPTIONS[1];
      for (let i = contextTotal + 1; i <= TARGET_CONTEXTS; i++) {
        const name = `context-${String(i).padStart(4, '0')}`;
        if (await getContextByName(name)) continue;
        try {
          await createContext({
            name,
            description: `Context ${i} for AI governance`,
            content: { index: i, policy: 'sample', version: '1.0' },
            tags: ['bootstrap'],
            lineOfBusiness: lob,
            dataClassification: dataClass,
            regulatoryHooks: [],
          });
        } catch {
          // Duplicate; skip
        }
      }
    }

    // --- Seed History (2–26) and Pending (1–5) per context for first N contexts ---
    const historyRange = HISTORY_MAX - HISTORY_MIN + 1;
    const pendingRange = PENDING_MAX - PENDING_MIN + 1;
    for (let i = 1; i <= CONTEXTS_WITH_FULL_REVISIONS; i++) {
      const name = `context-${String(i).padStart(4, '0')}`;
      const ctx = await getContextByName(name);
      if (!ctx) continue;
      const existing = await getRevisionsByContextId(ctx.id);
      const approved = existing.filter((r) => r.status === 'approved');
      const proposed = existing.filter((r) => r.status === 'proposed');
      const historyCount = HISTORY_MIN + (i % historyRange);
      const pendingCount = PENDING_MIN + (i % pendingRange);
      if (approved.length >= historyCount && proposed.length >= pendingCount) continue;
      const toApprove = historyCount - approved.length;
      const toPropose = historyCount + pendingCount - existing.length;
      if (toPropose <= 0) continue;
      const createdRevisions: { id: string }[] = [];
      for (let k = 0; k < toPropose; k++) {
        try {
          const rev = await proposeRevision({
            contextId: ctx.id,
            content: { index: i, policy: 'sample', version: `1.${k + 1}`, updated: 'seed' },
            commitMessage: `Seed revision ${k + 1} for ${name}`,
            createdBy: 'seed@example.com',
          });
          createdRevisions.push({ id: rev.id });
        } catch {
          break;
        }
      }
      const toApproveNow = Math.min(toApprove, createdRevisions.length);
      for (let k = 0; k < toApproveNow; k++) {
        try {
          await approveRevision(createdRevisions[k].id, 'compliance@example.com');
        } catch {
          break;
        }
      }
    }

    // Templates (for financial services)
    const templatesToCreate: Array<{ name: string; description: string; schema: TemplateSchema; defaultValues: Record<string, unknown> }> = [
      { name: 'compliance-policy-template', description: 'Schema for compliance policy context', schema: { type: 'object', properties: { policy: { type: 'string' }, effectiveDate: { type: 'string' }, kycRequired: { type: 'boolean' } } }, defaultValues: {} },
      { name: 'trading-limits-template', description: 'Schema for trading limits context', schema: { type: 'object', properties: { varLimit: { type: 'number' }, singleNameLimit: { type: 'number' } } }, defaultValues: {} },
    ];
    for (const t of templatesToCreate) {
      if (!getTemplateByName(t.name)) {
        try {
          createTemplate({ name: t.name, description: t.description, schema: t.schema, defaultValues: t.defaultValues });
        } catch {
          // skip
        }
      }
    }

    // Settings (theme)
    try {
      const db = (await import('@/lib/db')).default;
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', '\"system\"')").run();
    } catch {
      // SQLite only; Postgres may not have same API here
    }
    if (usePg()) {
      const pool = await getPool();
      if (pool) {
        await pool.query("INSERT INTO settings (key, value) VALUES ('theme', '\"system\"') ON CONFLICT (key) DO NOTHING");
      }
    }

    // Scan targets for governance (shadow AI discovery)
    if (usePg()) {
      const pool = await getPool();
      if (pool) {
        const existing = await pool.query('SELECT id FROM scan_targets LIMIT 1');
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO scan_targets (id, url, description) VALUES (gen_random_uuid(), 'https://agents.example.com/ib/trading', 'IB Trade Desk agent'), (gen_random_uuid(), 'https://agents.example.com/wm/portfolio', 'WM Portfolio Agent')`
          );
        }
      }
    } else {
      const db = (await import('@/lib/db')).default;
      const { v4: uuidv4 } = await import('uuid');
      const scanExists = db.prepare('SELECT id FROM scan_targets LIMIT 1').get();
      if (!scanExists) {
        db.prepare('INSERT INTO scan_targets (id, url, description) VALUES (?, ?, ?)').run(uuidv4(), 'https://agents.example.com/ib/trading', 'IB Trade Desk agent');
        db.prepare('INSERT INTO scan_targets (id, url, description) VALUES (?, ?, ?)').run(uuidv4(), 'https://agents.example.com/wm/portfolio', 'WM Portfolio Agent');
      }
      const udExists = db.prepare('SELECT id FROM unauthenticated_detections LIMIT 1').get();
      if (!udExists) {
        const details = (o: Record<string, unknown>) => JSON.stringify(o);
        db.prepare('INSERT INTO unauthenticated_detections (id, source_url, detected_agent_id, details) VALUES (?, ?, ?, ?)').run(uuidv4(), 'https://agents.example.com/ib/trading', 'trade-desk-agent', details({ method: 'discovery_scan', risk: 'medium' }));
        db.prepare('INSERT INTO unauthenticated_detections (id, source_url, detected_agent_id, details) VALUES (?, ?, ?, ?)').run(uuidv4(), 'https://internal-tools.corp/chat', 'internal-chat-agent', details({ method: 'discovery_scan', risk: 'low' }));
        db.prepare('INSERT INTO unauthenticated_detections (id, source_url, detected_agent_id, details) VALUES (?, ?, ?, ?)').run(uuidv4(), 'https://shadow.example.com/assistant', null, details({ method: 'discovery_scan', risk: 'high', note: 'unregistered endpoint' }));
      }
    }

    // Sample access log entries (sandarb_access_logs: metadata holds action_type, context_id, contextName)
    if (usePg()) {
      const pool = await getPool();
      if (pool) {
        const count = await pool.query('SELECT COUNT(*)::int AS c FROM sandarb_access_logs');
        if ((count.rows[0] as { c: number })?.c === 0) {
          await pool.query(
            `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) 
             SELECT 'trade-desk-agent', 'trace-seed-1', jsonb_build_object('action_type', 'INJECT_SUCCESS', 'context_id', id, 'contextName', 'context-0001') 
             FROM contexts WHERE name = 'context-0001' LIMIT 1`
          );
          await pool.query(
            `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) 
             SELECT 'portfolio-advisor-agent', 'trace-seed-2', jsonb_build_object('action_type', 'INJECT_SUCCESS', 'context_id', id, 'contextName', 'context-0002') 
             FROM contexts WHERE name = 'context-0002' LIMIT 1`
          );
          await pool.query(
            `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) 
             VALUES ('unknown-shadow-agent', 'trace-seed-3', '{"action_type":"INJECT_DENIED","reason":"unauthenticated_agent","contextRequested":"context-0001"}'::jsonb)`
          );
        }
      }
    }

    // Sample unauthenticated detections (shadow AI discovery for Agent Pulse)
    if (usePg()) {
      const pool = await getPool();
      if (pool) {
        const udCount = await pool.query('SELECT COUNT(*)::int AS c FROM unauthenticated_detections');
        if ((udCount.rows[0] as { c: number })?.c === 0) {
          await pool.query(
            `INSERT INTO unauthenticated_detections (source_url, detected_agent_id, details) VALUES
             ('https://agents.example.com/ib/trading', 'trade-desk-agent', '{"method":"discovery_scan","risk":"medium"}'::jsonb),
             ('https://internal-tools.corp/chat', 'internal-chat-agent', '{"method":"discovery_scan","risk":"low"}'::jsonb),
             ('https://shadow.example.com/assistant', NULL, '{"method":"discovery_scan","risk":"high","note":"unregistered endpoint"}'::jsonb)`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bootstrap seeded: ${TARGET_ORGS} orgs, ${TARGET_AGENTS} agents, ${TARGET_CONTEXTS} contexts; ${CONTEXTS_WITH_FULL_REVISIONS} contexts with History(2–26) and Pending(1–5). Plus templates, settings, scan targets, audit log. Visible after login.`,
    });
  } catch (error) {
    console.error('Seed failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
