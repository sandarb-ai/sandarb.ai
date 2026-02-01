#!/usr/bin/env node
/**
 * Seed Postgres with sample data for Sandarb (financial services target).
 * Run after init-postgres: npm run db:init-pg && DATABASE_URL=... node scripts/seed-postgres.js
 * Or: export DATABASE_URL=postgresql://user:pass@host:5432/sandarb-dev && node scripts/seed-postgres.js
 *
 * Inserts: root org, Retail/IB/Wealth orgs, agents, contexts with version history,
 * templates, settings, scan_targets, audit log, unauthenticated_detections, activity_log.
 */

const { Client } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL (e.g. postgresql://user:pass@localhost:5432/sandarb-dev)');
  process.exit(1);
}

function sha256Hash(content) {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

const LOB_TO_DB = { retail: 'Retail-Banking', investment_banking: 'Investment-Banking', wealth_management: 'Wealth-Management', legal_compliance: 'Legal-Compliance' };
const DATA_CLASS_TO_DB = { public: 'Public', internal: 'Internal', confidential: 'Confidential', restricted: 'Restricted' };
function lobDb(lob) {
  return LOB_TO_DB[lob] || 'Retail-Banking';
}
function dataClassDb(dc) {
  return DATA_CLASS_TO_DB[dc] || 'Internal';
}

const ORGS = [
  { name: 'Retail Banking', slug: 'retail-banking', description: 'Consumer deposits, lending, and branch operations' },
  { name: 'Investment Banking', slug: 'investment-banking', description: 'M&A, capital markets, and advisory' },
  { name: 'Wealth Management', slug: 'wealth-management', description: 'Private banking, advisory, and portfolio management' },
  { name: 'Legal & Compliance', slug: 'legal-compliance', description: 'Legal, regulatory, and compliance oversight' },
  { name: 'Risk Management', slug: 'risk-management', description: 'Enterprise risk, credit risk, and operational risk' },
  { name: 'Operations', slug: 'operations', description: 'Back-office, settlements, and operations' },
  { name: 'Treasury', slug: 'treasury', description: 'Liquidity, funding, and treasury operations' },
  { name: 'Technology', slug: 'technology', description: 'Engineering, platform, and data' },
  { name: 'Product', slug: 'product', description: 'Product management and strategy' },
  { name: 'Customer Experience', slug: 'customer-experience', description: 'CX, support, and digital channels' },
  { name: 'Data & Analytics', slug: 'data-analytics', description: 'Data engineering, BI, and analytics' },
  { name: 'Security', slug: 'security', description: 'Cybersecurity, identity, and access' },
  { name: 'HR & People', slug: 'hr-people', description: 'Talent, compensation, and culture' },
  { name: 'Finance', slug: 'finance', description: 'Financial reporting, FP&A, and controllership' },
  { name: 'Marketing', slug: 'marketing', description: 'Brand, campaigns, and demand generation' },
  { name: 'Sales', slug: 'sales', description: 'Enterprise sales, SMB, and partnerships' },
  { name: 'Research', slug: 'research', description: 'Market and product research' },
  { name: 'Corporate Development', slug: 'corp-dev', description: 'M&A, strategy, and ventures' },
  { name: 'Real Estate', slug: 'real-estate', description: 'Property, facilities, and workplace' },
  { name: 'Procurement', slug: 'procurement', description: 'Vendor management and sourcing' },
  { name: 'Internal Audit', slug: 'internal-audit', description: 'Internal audit and assurance' },
  { name: 'Tax', slug: 'tax', description: 'Tax planning, compliance, and reporting' },
  { name: 'Trade Operations', slug: 'trade-ops', description: 'Trade capture, confirmation, and lifecycle' },
  { name: 'Client Services', slug: 'client-services', description: 'Client onboarding and servicing' },
  { name: 'Platform Engineering', slug: 'platform-eng', description: 'Platform, APIs, and developer experience' },
  { name: 'AI/ML', slug: 'ai-ml', description: 'AI/ML models, feature engineering, and MLOps' },
  { name: 'Digital', slug: 'digital', description: 'Digital channels and experience' },
  { name: 'Regulatory Affairs', slug: 'regulatory-affairs', description: 'Regulatory strategy and engagement' },
  { name: 'ESG', slug: 'esg', description: 'Environmental, social, and governance' },
  { name: 'Strategy', slug: 'strategy', description: 'Corporate strategy and planning' },
];

// 14 agents per org × 30 orgs = 420 agents
const AGENTS_PER_ORG = 14;
function buildAgentsBySlug() {
  const out = {};
  for (const o of ORGS) {
    out[o.slug] = [];
    for (let i = 1; i <= AGENTS_PER_ORG; i++) {
      const num = String(i).padStart(2, '0');
      out[o.slug].push({
        agentId: `${o.slug}-agent-${num}`,
        name: `${o.name} Agent ${num}`,
        description: `AI agent ${i} for ${o.name}`,
        url: `https://agents.example.com/${o.slug.replace(/-/g, '/')}/agent-${num}`,
      });
    }
  }
  return out;
}
const AGENTS_BY_SLUG = buildAgentsBySlug();

const CONTEXTS_WITH_VERSIONS = {
  'ib-trading-limits': {
    name: 'ib-trading-limits',
    description: 'Trading and position limits for Investment Banking desk',
    slug: 'investment-banking',
    lob: 'investment_banking',
    dataClass: 'confidential',
    regulatoryHooks: ['FINRA', 'SEC'],
    versions: [
      { content: { policy: 'Trading Limits', effectiveDate: '2024-01-01', varLimit: 1000000, singleNameLimit: 500000, maxPositionPct: 0.02, reviewFrequency: 'daily' }, commitMessage: 'Initial trading limits policy' },
      { content: { policy: 'Trading Limits', effectiveDate: '2024-01-01', varLimit: 1500000, singleNameLimit: 500000, maxPositionPct: 0.02, reviewFrequency: 'daily' }, commitMessage: 'Raised VAR limit to $1.5M per desk' },
      { content: { policy: 'Trading Limits', effectiveDate: '2024-06-01', varLimit: 1500000, singleNameLimit: 500000, maxPositionPct: 0.02, concentrationLimitPct: 0.05, reviewFrequency: 'daily', notes: 'Added single-name concentration cap (5%) for risk diversification' }, commitMessage: 'Added concentration limit and effective date update' },
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
      { content: { policy: 'Suitability', riskBands: ['conservative', 'moderate', 'growth', 'aggressive'], kycTier: 'standard', minAge: 18 }, commitMessage: 'Initial suitability policy' },
      { content: { policy: 'Suitability', riskBands: ['conservative', 'moderate', 'growth', 'aggressive'], kycTier: 'enhanced', minAge: 18, minAumForGrowth: 100000 }, commitMessage: 'Enhanced KYC tier and minimum AUM for growth band' },
      { content: { policy: 'Suitability', riskBands: ['conservative', 'moderate', 'growth', 'aggressive'], kycTier: 'enhanced', minAge: 18, minAumForGrowth: 100000, rebalanceThreshold: 0.05, requireAdvisorSignOff: true }, commitMessage: 'Added rebalance threshold and advisor sign-off requirement' },
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
      { content: { scope: 'retail', policyVersion: '2024.1', kycRequired: true, conductRules: ['fair dealing', 'suitability'] }, commitMessage: 'Initial retail compliance policy' },
      { content: { scope: 'retail', policyVersion: '2024.1', kycRequired: true, conductRules: ['fair dealing', 'suitability', 'best execution'], complaintHandling: '48h acknowledgment' }, commitMessage: 'Added best execution and complaint handling SLA' },
      { content: { scope: 'retail', policyVersion: '2024.2', kycRequired: true, conductRules: ['fair dealing', 'suitability', 'best execution'], complaintHandling: '48h acknowledgment', escalationThreshold: '7 days' }, commitMessage: 'Policy v2024.2: escalation threshold for complaints' },
    ],
  },
};

const CONTEXTS_SIMPLE = [
  { name: 'retail-product-limits', description: 'Retail product and exposure limits', slug: 'retail-banking', lob: 'retail', dataClass: 'internal', regulatoryHooks: [], content: { maxUnsecured: 50000, maxSecured: 2000000, maxMortgage: 5000000 } },
  { name: 'retail-faq-context', description: 'Standard FAQs for branch agents', slug: 'retail-banking', lob: 'retail', dataClass: 'public', regulatoryHooks: [], content: { categories: ['accounts', 'loans', 'cards'], locale: 'en', supportHours: '9-5 ET' } },
  { name: 'ib-compliance-policy', description: 'IB compliance and Chinese Wall policy', slug: 'investment-banking', lob: 'investment_banking', dataClass: 'restricted', regulatoryHooks: ['FINRA', 'SEC'], content: { scope: 'investment-banking', restrictedList: true, insiderPolicy: true, wallCrossing: 'compliance approval' } },
  { name: 'ib-deal-context', description: 'Deal pipeline and mandate context', slug: 'investment-banking', lob: 'investment_banking', dataClass: 'restricted', regulatoryHooks: ['SEC'], content: { stages: ['pitch', 'mandate', 'execution', 'close'], confidential: true, ndaRequired: true } },
  { name: 'wm-portfolio-context', description: 'Portfolio and benchmark context', slug: 'wealth-management', lob: 'wealth_management', dataClass: 'internal', regulatoryHooks: [], content: { benchmarks: ['MSCI World', 'Agg'], rebalanceThreshold: 0.05, reportingCurrency: 'USD' } },
  { name: 'wm-advisory-context', description: 'Advisory and product context', slug: 'wealth-management', lob: 'wealth_management', dataClass: 'confidential', regulatoryHooks: ['GDPR'], content: { products: ['discretionary', 'advisory', 'execution-only'], mifid: true, costDisclosure: true } },
];

// Generate 100 contexts per org = 3000 bulk contexts (1000s total with curated ones)
const CONTEXTS_PER_ORG = 100;
const LOB_KEYS = ['retail', 'investment_banking', 'wealth_management', 'legal_compliance'];
const BULK_LOB = {};
ORGS.forEach((o, i) => { BULK_LOB[o.slug] = LOB_KEYS[i % LOB_KEYS.length]; });
const CONTEXTS_BULK = [];
let idx = 0;
for (const o of ORGS) {
  const slug = o.slug;
  for (let i = 1; i <= CONTEXTS_PER_ORG; i++) {
    idx++;
    const name = `context-${slug}-${String(i).padStart(3, '0')}`;
    CONTEXTS_BULK.push({
      name,
      description: `AI agent context ${idx} for ${o.name}`,
      slug,
      lob: BULK_LOB[slug] || 'retail',
      dataClass: i % 3 === 0 ? 'confidential' : i % 3 === 1 ? 'internal' : 'public',
      regulatoryHooks: i % 4 === 0 ? ['FINRA'] : [],
      content: { scope: slug, version: `2024.${(i % 12) + 1}`, key: `value-${idx}` },
    });
  }
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // 1. Ensure root org exists
    let root = await client.query("SELECT id FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1");
    if (root.rows.length === 0) {
      const rootId = uuidv4();
      await client.query(
        `INSERT INTO organizations (id, name, slug, description, is_root) VALUES ($1, 'Root Organization', 'root', 'Company root.', true)`,
        [rootId]
      );
      root = { rows: [{ id: rootId }] };
      console.log('Created root organization');
    }
    const rootId = root.rows[0].id;

    // 2. Child orgs (idempotent: skip if slug exists)
    const orgIds = {};
    for (const o of ORGS) {
      const existing = await client.query('SELECT id FROM organizations WHERE slug = $1', [o.slug]);
      if (existing.rows.length > 0) {
        orgIds[o.slug] = existing.rows[0].id;
        continue;
      }
      const id = uuidv4();
      await client.query(
        `INSERT INTO organizations (id, name, slug, description, parent_id, is_root) VALUES ($1, $2, $3, $4, $5, false)`,
        [id, o.name, o.slug, o.description, rootId]
      );
      orgIds[o.slug] = id;
    }
    console.log('Created orgs:', Object.keys(orgIds).length, '(30 child orgs + root)');

    // 3. Agents: 14 per org × 30 orgs = 420 (idempotent via ON CONFLICT)
    let agentsCreated = 0;
    for (const [slug, agents] of Object.entries(AGENTS_BY_SLUG)) {
      const orgId = orgIds[slug];
      if (!orgId) continue;
      for (const a of agents) {
        const r = await client.query(
          `INSERT INTO agents (id, org_id, name, description, a2a_url, agent_id) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (org_id, agent_id) DO NOTHING`,
          [uuidv4(), orgId, a.name, a.description, a.url, a.agentId]
        );
        if (r.rowCount > 0) agentsCreated++;
      }
    }
    console.log('Created agents:', agentsCreated, '(420 total across 30 orgs)');

    const now = new Date().toISOString();
    const ownerTeam = 'system';

    // 4. Contexts with multiple versions
    for (const [key, spec] of Object.entries(CONTEXTS_WITH_VERSIONS)) {
      const exists = await client.query('SELECT id FROM contexts WHERE name = $1', [spec.name]);
      if (exists.rows.length > 0) continue;

      const ctxId = uuidv4();
      const tags = JSON.stringify([spec.slug]);
      const regHooks = JSON.stringify(spec.regulatoryHooks);
      await client.query(
        `INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [ctxId, spec.name, spec.description, lobDb(spec.lob), dataClassDb(spec.dataClass), ownerTeam, tags, regHooks, now]
      );

      let vn = 0;
      for (const v of spec.versions) {
        vn++;
        const contentJson = JSON.stringify(v.content);
        const hash = sha256Hash(v.content);
        const versionLabel = `v1.0.${vn}`;
        await client.query(
          `INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, status, commit_message, approved_by, approved_at, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4, $5, $6, 'Approved', $7, $8, $9, true)`,
          [ctxId, versionLabel, contentJson, hash, 'seed@example.com', now, v.commitMessage, 'compliance@example.com', now]
        );
      }
      await client.query(
        `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at) VALUES ($1, 'create', 'context', $2, $3, $4)`,
        [uuidv4(), ctxId, spec.name, now]
      );
      console.log('Created context with versions:', spec.name);
    }

    // 5. Simple contexts (single version)
    for (const c of CONTEXTS_SIMPLE) {
      const exists = await client.query('SELECT id FROM contexts WHERE name = $1', [c.name]);
      if (exists.rows.length > 0) continue;

      const ctxId = uuidv4();
      const tags = JSON.stringify([c.slug]);
      const regHooks = JSON.stringify(c.regulatoryHooks);
      await client.query(
        `INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [ctxId, c.name, c.description, lobDb(c.lob), dataClassDb(c.dataClass), ownerTeam, tags, regHooks, now]
      );
      const contentJson = JSON.stringify(c.content);
      const hash = sha256Hash(c.content);
      await client.query(
        `INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, status, commit_message, approved_by, approved_at, is_active)
         VALUES (gen_random_uuid(), $1, 'v1.0.0', $2::jsonb, $3, $4, $5, 'Approved', 'Initial version', $4, $5, true)`,
        [ctxId, contentJson, hash, ownerTeam, now]
      );
      await client.query(
        `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at) VALUES ($1, 'create', 'context', $2, $3, $4)`,
        [uuidv4(), ctxId, c.name, now]
      );
      console.log('Created context:', c.name);
    }

    // 5b. Bulk contexts (3000): batch insert for speed
    const BATCH_SIZE = 50;
    let bulkCreated = 0;
    for (let start = 0; start < CONTEXTS_BULK.length; start += BATCH_SIZE) {
      const batch = CONTEXTS_BULK.slice(start, start + BATCH_SIZE);
      const existing = await client.query(
        'SELECT name FROM contexts WHERE name = ANY($1::text[])',
        [batch.map((c) => c.name)]
      );
      const existingNames = new Set(existing.rows.map((r) => r.name));
      const toInsert = batch.filter((c) => !existingNames.has(c.name));
      if (toInsert.length === 0) continue;

      const ctxIds = [];
      const valueParts = [];
      const values = [];
      let p = 1;
      for (const c of toInsert) {
        const ctxId = uuidv4();
        ctxIds.push({ id: ctxId, name: c.name, content: c.content, slug: c.slug, regulatoryHooks: c.regulatoryHooks, lob: c.lob, dataClass: c.dataClass, description: c.description });
        valueParts.push(`($${p}, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, $${p + 8}, $${p + 8})`);
        const tags = JSON.stringify([c.slug]);
        const regHooks = JSON.stringify(c.regulatoryHooks);
        values.push(ctxId, c.name, c.description, lobDb(c.lob), dataClassDb(c.dataClass), ownerTeam, tags, regHooks, now);
        p += 9;
      }
      await client.query(
        `INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks, created_at, updated_at)
         VALUES ${valueParts.join(', ')}`,
        values
      );

      const versionParts = [];
      const versionParams = [];
      const activityParts = [];
      const activityParams = [];
      let vp = 1;
      let ap = 1;
      for (const row of ctxIds) {
        const c = toInsert.find((x) => x.name === row.name);
        if (!c) continue;
        const contentJson = JSON.stringify(c.content);
        const hash = sha256Hash(c.content);
        versionParts.push(`(gen_random_uuid(), $${vp}, 'v1.0.0', $${vp + 1}::jsonb, $${vp + 2}, $${vp + 3}, $${vp + 4}, 'Approved', 'Initial version', $${vp + 3}, $${vp + 4}, true)`);
        versionParams.push(row.id, contentJson, hash, ownerTeam, now);
        vp += 5;
        activityParts.push(`(gen_random_uuid(), 'create', 'context', $${ap}, $${ap + 1}, $${ap + 2})`);
        activityParams.push(row.id, row.name, now);
        ap += 3;
      }
      if (versionParts.length > 0) {
        await client.query(
          `INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, status, commit_message, approved_by, approved_at, is_active)
           VALUES ${versionParts.join(', ')}`,
          versionParams
        );
        await client.query(
          `INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at) VALUES ${activityParts.join(', ')}`,
          activityParams
        );
      }
      bulkCreated += toInsert.length;
      if (start + BATCH_SIZE < CONTEXTS_BULK.length) process.stdout.write(`\r  Bulk contexts: ${bulkCreated}/${CONTEXTS_BULK.length}...`);
    }
    if (CONTEXTS_BULK.length > 0) console.log(`\rCreated bulk contexts: ${bulkCreated}`);

    // 6. Templates
    const templates = [
      { name: 'compliance-policy-template', description: 'Schema for compliance policy context', schema: { type: 'object', properties: { policy: { type: 'string' }, effectiveDate: { type: 'string' }, kycRequired: { type: 'boolean' } } }, defaultValues: {} },
      { name: 'trading-limits-template', description: 'Schema for trading limits context', schema: { type: 'object', properties: { varLimit: { type: 'number' }, singleNameLimit: { type: 'number' } } }, defaultValues: {} },
    ];
    for (const t of templates) {
      await client.query(
        `INSERT INTO templates (id, name, description, schema, default_values) VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb) ON CONFLICT (name) DO NOTHING`,
        [t.name, t.description, JSON.stringify(t.schema), JSON.stringify(t.defaultValues)]
      );
    }
    console.log('Templates upserted');

    // 7. Settings
    await client.query(`INSERT INTO settings (key, value) VALUES ('theme', '"system"') ON CONFLICT (key) DO NOTHING`);
    console.log('Settings upserted');

    // 8. Scan targets
    const scanCount = await client.query('SELECT COUNT(*) AS c FROM scan_targets');
    if (parseInt(scanCount.rows[0].c, 10) === 0) {
      await client.query(
        `INSERT INTO scan_targets (id, url, description) VALUES (gen_random_uuid(), 'https://agents.example.com/ib/trading', 'IB Trade Desk agent'), (gen_random_uuid(), 'https://agents.example.com/wm/portfolio', 'WM Portfolio Agent')`
      );
      console.log('Scan targets inserted');
    }

    // 9. Access logs (sandarb_access_logs: metadata holds action_type, context_id, contextName)
    const auditCount = await client.query('SELECT COUNT(*)::int AS c FROM sandarb_access_logs');
    if (auditCount.rows[0].c === 0) {
      const ctx1 = await client.query("SELECT id FROM contexts WHERE name = 'ib-trading-limits' LIMIT 1");
      const ctx2 = await client.query("SELECT id FROM contexts WHERE name = 'wm-suitability-policy' LIMIT 1");
      if (ctx1.rows.length > 0) {
        await client.query(
          `INSERT INTO sandarb_access_logs (agent_id, trace_id, version_id, metadata) VALUES ('investment-banking-agent-01', 'trace-seed-1', NULL, $1::jsonb)`,
          [JSON.stringify({ action_type: 'INJECT_SUCCESS', context_id: ctx1.rows[0].id, contextName: 'ib-trading-limits' })]
        );
      }
      if (ctx2.rows.length > 0) {
        await client.query(
          `INSERT INTO sandarb_access_logs (agent_id, trace_id, version_id, metadata) VALUES ('wealth-management-agent-01', 'trace-seed-2', NULL, $1::jsonb)`,
          [JSON.stringify({ action_type: 'INJECT_SUCCESS', context_id: ctx2.rows[0].id, contextName: 'wm-suitability-policy' })]
        );
      }
      await client.query(
        `INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) VALUES ('unknown-shadow-agent', 'trace-seed-3', '{"action_type":"INJECT_DENIED","reason":"unauthenticated_agent","contextRequested":"ib-trading-limits"}'::jsonb)`
      );
      console.log('Access logs inserted');
    }

    // 10. Unauthenticated detections
    const udCount = await client.query('SELECT COUNT(*)::int AS c FROM unauthenticated_detections');
    if (udCount.rows[0].c === 0) {
      await client.query(
        `INSERT INTO unauthenticated_detections (source_url, detected_agent_id, details) VALUES
         ('https://agents.example.com/ib/trading', 'trade-desk-agent', '{"method":"discovery_scan","risk":"medium"}'::jsonb),
         ('https://internal-tools.corp/chat', 'internal-chat-agent', '{"method":"discovery_scan","risk":"low"}'::jsonb),
         ('https://shadow.example.com/assistant', NULL, '{"method":"discovery_scan","risk":"high","note":"unregistered endpoint"}'::jsonb)`
      );
      console.log('Unauthenticated detections inserted');
    }

    console.log('Seed complete. Postgres has: 30 orgs, 420 agents, 3000+ contexts (with version history), templates, settings, scan_targets, audit log, unauthenticated_detections.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
