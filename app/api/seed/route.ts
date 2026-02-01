import { NextResponse } from 'next/server';
import { getRootOrganization, getOrganizationBySlug, createOrganization } from '@/lib/organizations';
import { createAgent, getAgentCount } from '@/lib/agents';
import { createContext, getContextByName } from '@/lib/contexts';
import { proposeRevision, approveRevision } from '@/lib/revisions';
import { createTemplate, getTemplateByName } from '@/lib/templates';
import { usePg } from '@/lib/pg';
import { getPool } from '@/lib/pg';
import type { LineOfBusiness, DataClassification, RegulatoryHook, TemplateSchema } from '@/types';

/**
 * POST /api/seed
 * Seeds sample data for a financial services target (bank / wealth / IB):
 * - Orgs: Retail Banking, Investment Banking, Wealth Management
 * - Agents per org (KYC, Trade Desk, Portfolio Advisor, etc.)
 * - Contexts with real-world content for AI agents
 * - Version history (multiple revisions per context) for testing diff UI like GitHub
 * - Templates, settings, scan_targets, activity/audit samples
 * Idempotent: skips creating resources that already exist.
 */

// Real-world context content with multiple versions for diff UI testing
const CONTEXTS_WITH_VERSIONS: Record<
  string,
  {
    name: string;
    description: string;
    slug: string;
    lob: LineOfBusiness;
    dataClass: DataClassification;
    regulatoryHooks: RegulatoryHook[];
    versions: Array<{ content: Record<string, unknown>; commitMessage: string }>;
  }
> = {
  'ib-trading-limits': {
    name: 'ib-trading-limits',
    description: 'Trading and position limits for Investment Banking desk',
    slug: 'investment-banking',
    lob: 'investment_banking',
    dataClass: 'confidential',
    regulatoryHooks: ['FINRA', 'SEC'],
    versions: [
      {
        content: {
          policy: 'Trading Limits',
          effectiveDate: '2024-01-01',
          varLimit: 1000000,
          singleNameLimit: 500000,
          maxPositionPct: 0.02,
          reviewFrequency: 'daily',
        },
        commitMessage: 'Initial trading limits policy',
      },
      {
        content: {
          policy: 'Trading Limits',
          effectiveDate: '2024-01-01',
          varLimit: 1500000,
          singleNameLimit: 500000,
          maxPositionPct: 0.02,
          reviewFrequency: 'daily',
        },
        commitMessage: 'Raised VAR limit to $1.5M per desk',
      },
      {
        content: {
          policy: 'Trading Limits',
          effectiveDate: '2024-06-01',
          varLimit: 1500000,
          singleNameLimit: 500000,
          maxPositionPct: 0.02,
          concentrationLimitPct: 0.05,
          reviewFrequency: 'daily',
          notes: 'Added single-name concentration cap (5%) for risk diversification',
        },
        commitMessage: 'Added concentration limit and effective date update',
      },
    ],
  },
  'wm-suitability-policy': {
    name: 'wm-suitability-policy',
    description: 'Wealth suitability and risk appetite policy',
    slug: 'wealth-management',
    lob: 'wealth_management',
    dataClass: 'confidential',
    regulatoryHooks: ['FINRA', 'GDPR'],
    versions: [
      {
        content: {
          policy: 'Suitability',
          riskBands: ['conservative', 'moderate', 'growth', 'aggressive'],
          kycTier: 'standard',
          minAge: 18,
        },
        commitMessage: 'Initial suitability policy',
      },
      {
        content: {
          policy: 'Suitability',
          riskBands: ['conservative', 'moderate', 'growth', 'aggressive'],
          kycTier: 'enhanced',
          minAge: 18,
          minAumForGrowth: 100000,
        },
        commitMessage: 'Enhanced KYC tier and minimum AUM for growth band',
      },
      {
        content: {
          policy: 'Suitability',
          riskBands: ['conservative', 'moderate', 'growth', 'aggressive'],
          kycTier: 'enhanced',
          minAge: 18,
          minAumForGrowth: 100000,
          rebalanceThreshold: 0.05,
          requireAdvisorSignOff: true,
        },
        commitMessage: 'Added rebalance threshold and advisor sign-off requirement',
      },
    ],
  },
  'retail-compliance-policy': {
    name: 'retail-compliance-policy',
    description: 'Retail compliance and conduct policy',
    slug: 'retail-banking',
    lob: 'retail',
    dataClass: 'confidential',
    regulatoryHooks: ['FINRA'],
    versions: [
      {
        content: {
          scope: 'retail',
          policyVersion: '2024.1',
          kycRequired: true,
          conductRules: ['fair dealing', 'suitability'],
        },
        commitMessage: 'Initial retail compliance policy',
      },
      {
        content: {
          scope: 'retail',
          policyVersion: '2024.1',
          kycRequired: true,
          conductRules: ['fair dealing', 'suitability', 'best execution'],
          complaintHandling: '48h acknowledgment',
        },
        commitMessage: 'Added best execution and complaint handling SLA',
      },
      {
        content: {
          scope: 'retail',
          policyVersion: '2024.2',
          kycRequired: true,
          conductRules: ['fair dealing', 'suitability', 'best execution'],
          complaintHandling: '48h acknowledgment',
          escalationThreshold: '7 days',
        },
        commitMessage: 'Policy v2024.2: escalation threshold for complaints',
      },
    ],
  },
};

// Additional contexts (single version)
const CONTEXTS_SIMPLE: Record<
  string,
  {
    name: string;
    description: string;
    slug: string;
    lob: LineOfBusiness;
    dataClass: DataClassification;
    regulatoryHooks: RegulatoryHook[];
    content: Record<string, unknown>;
  }
> = {
  'retail-product-limits': {
    name: 'retail-product-limits',
    description: 'Retail product and exposure limits',
    slug: 'retail-banking',
    lob: 'retail',
    dataClass: 'internal',
    regulatoryHooks: [],
    content: { maxUnsecured: 50000, maxSecured: 2000000, maxMortgage: 5000000 },
  },
  'retail-faq-context': {
    name: 'retail-faq-context',
    description: 'Standard FAQs for branch agents',
    slug: 'retail-banking',
    lob: 'retail',
    dataClass: 'public',
    regulatoryHooks: [],
    content: { categories: ['accounts', 'loans', 'cards'], locale: 'en', supportHours: '9-5 ET' },
  },
  'ib-compliance-policy': {
    name: 'ib-compliance-policy',
    description: 'IB compliance and Chinese Wall policy',
    slug: 'investment-banking',
    lob: 'investment_banking',
    dataClass: 'restricted',
    regulatoryHooks: ['FINRA', 'SEC'],
    content: { scope: 'investment-banking', restrictedList: true, insiderPolicy: true, wallCrossing: 'compliance approval' },
  },
  'ib-deal-context': {
    name: 'ib-deal-context',
    description: 'Deal pipeline and mandate context',
    slug: 'investment-banking',
    lob: 'investment_banking',
    dataClass: 'restricted',
    regulatoryHooks: ['SEC'],
    content: { stages: ['pitch', 'mandate', 'execution', 'close'], confidential: true, ndaRequired: true },
  },
  'wm-portfolio-context': {
    name: 'wm-portfolio-context',
    description: 'Portfolio and benchmark context',
    slug: 'wealth-management',
    lob: 'wealth_management',
    dataClass: 'internal',
    regulatoryHooks: [],
    content: { benchmarks: ['MSCI World', 'Agg'], rebalanceThreshold: 0.05, reportingCurrency: 'USD' },
  },
  'wm-advisory-context': {
    name: 'wm-advisory-context',
    description: 'Advisory and product context',
    slug: 'wealth-management',
    lob: 'wealth_management',
    dataClass: 'confidential',
    regulatoryHooks: ['GDPR'],
    content: { products: ['discretionary', 'advisory', 'execution-only'], mifid: true, costDisclosure: true },
  },
};

export async function POST() {
  try {
    const root = await getRootOrganization();
    if (!root) {
      return NextResponse.json(
        { success: false, error: 'Root organization not found. Start the app once to init DB.' },
        { status: 400 }
      );
    }

    const orgsToCreate = [
      { name: 'Retail Banking', slug: 'retail-banking', description: 'Consumer deposits, lending, and branch operations' },
      { name: 'Investment Banking', slug: 'investment-banking', description: 'M&A, capital markets, and advisory' },
      { name: 'Wealth Management', slug: 'wealth-management', description: 'Private banking, advisory, and portfolio management' },
    ];

    const createdOrgs: { id: string; slug: string }[] = [];
    for (const o of orgsToCreate) {
      const existing = await getOrganizationBySlug(o.slug);
      if (!existing) {
        const org = await createOrganization({ name: o.name, slug: o.slug, description: o.description, parentId: root.id });
        createdOrgs.push({ id: org.id, slug: org.slug });
      } else {
        createdOrgs.push({ id: existing.id, slug: existing.slug });
      }
    }

    const agentsBySlug: Record<string, Array<{ name: string; description: string; url: string }>> = {
      'retail-banking': [
        { name: 'KYC Onboarding Agent', description: 'Customer identity and onboarding checks', url: 'https://agents.example.com/retail/kyc' },
        { name: 'Loan Eligibility Agent', description: 'Credit and loan product eligibility', url: 'https://agents.example.com/retail/loans' },
        { name: 'Branch FAQ Agent', description: 'Branch and product FAQs', url: 'https://agents.example.com/retail/faq' },
      ],
      'investment-banking': [
        { name: 'Deal Pipeline Agent', description: 'M&A and deal pipeline tracking', url: 'https://agents.example.com/ib/deals' },
        { name: 'Trade Desk Agent', description: 'Trading limits and execution', url: 'https://agents.example.com/ib/trading' },
        { name: 'Research Summary Agent', description: 'Equity and macro research summaries', url: 'https://agents.example.com/ib/research' },
      ],
      'wealth-management': [
        { name: 'Portfolio Advisor Agent', description: 'Portfolio allocation and rebalancing', url: 'https://agents.example.com/wm/portfolio' },
        { name: 'Client Onboarding Agent', description: 'Wealth client KYC and suitability', url: 'https://agents.example.com/wm/onboarding' },
        { name: 'Advisory Context Agent', description: 'Market and product context for advisors', url: 'https://agents.example.com/wm/advisory' },
      ],
    };

    for (const { id: orgId, slug } of createdOrgs) {
      const agents = agentsBySlug[slug];
      if (!agents) continue;
      const existingCount = await getAgentCount(orgId);
      if (existingCount >= agents.length) continue;
      for (const a of agents) {
        try {
          await createAgent({ orgId, name: a.name, description: a.description, a2aUrl: a.url });
        } catch {
          // Duplicate or constraint; skip
        }
      }
    }

    // Contexts with multiple versions (for diff UI testing)
    for (const key of Object.keys(CONTEXTS_WITH_VERSIONS)) {
      const spec = CONTEXTS_WITH_VERSIONS[key];
      if (await getContextByName(spec.name)) continue;
      const [first, ...rest] = spec.versions;
      const ctx = await createContext({
        name: spec.name,
        description: spec.description,
        content: first.content,
        tags: [spec.slug],
        lineOfBusiness: spec.lob,
        dataClassification: spec.dataClass,
        regulatoryHooks: spec.regulatoryHooks,
      });
      for (const v of rest) {
        const rev = await proposeRevision({
          contextId: ctx.id,
          content: v.content,
          commitMessage: v.commitMessage,
          createdBy: 'seed@example.com',
        });
        await approveRevision(rev.id, 'compliance@example.com');
      }
    }

    // Simple contexts (single version)
    for (const key of Object.keys(CONTEXTS_SIMPLE)) {
      const c = CONTEXTS_SIMPLE[key];
      if (await getContextByName(c.name)) continue;
      try {
        await createContext({
          name: c.name,
          description: c.description,
          content: c.content,
          tags: [c.slug],
          lineOfBusiness: c.lob,
          dataClassification: c.dataClass,
          regulatoryHooks: c.regulatoryHooks,
        });
      } catch {
        // Duplicate; skip
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
             SELECT 'trade-desk-agent', 'trace-seed-1', jsonb_build_object('action_type', 'INJECT_SUCCESS', 'context_id', id, 'contextName', 'ib-trading-limits') 
             FROM contexts WHERE name = 'ib-trading-limits' LIMIT 1`
          );
          await pool.query(
            `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) 
             SELECT 'portfolio-advisor-agent', 'trace-seed-2', jsonb_build_object('action_type', 'INJECT_SUCCESS', 'context_id', id, 'contextName', 'wm-suitability-policy') 
             FROM contexts WHERE name = 'wm-suitability-policy' LIMIT 1`
          );
          await pool.query(
            `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) 
             VALUES ('unknown-shadow-agent', 'trace-seed-3', '{"action_type":"INJECT_DENIED","reason":"unauthenticated_agent","contextRequested":"ib-trading-limits"}'::jsonb)`
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
      message: 'Sample data seeded: orgs, agents, contexts (with version history for diff UI), templates, settings, scan targets, audit log, unauthenticated_detections. Open a context like ib-trading-limits or wm-suitability-policy and check Version History to see diffs.',
    });
  } catch (error) {
    console.error('Seed failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
