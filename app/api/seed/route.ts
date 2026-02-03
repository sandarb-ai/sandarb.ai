import { NextResponse } from 'next/server';
import { getRootOrganization, getOrganizationBySlug, createOrganization, getAllOrganizations } from '@/lib/organizations';
import { createAgent, getAgentCount } from '@/lib/agents';
import { createContext, getContextByName, getContextCount, getAllContexts } from '@/lib/contexts';
import { proposeRevision, approveRevision, getProposedRevisions, getRevisionsByContextId } from '@/lib/revisions';
import { createTemplate, getTemplateByName } from '@/lib/templates';
import { createPrompt, getPromptByName, createPromptVersion, approvePromptVersion } from '@/lib/prompts';
import { usePg } from '@/lib/pg';
import { getPool } from '@/lib/pg';
import type { LineOfBusiness, DataClassification, TemplateSchema } from '@/types';

/** Bootstrap targets: 30 orgs, 420 agents (14 per org), 5000 contexts. Used on GCP deploy and local. */
const TARGET_ORGS = 30;
const TARGET_AGENTS = 420;
const TARGET_CONTEXTS = 5000;
const AGENTS_PER_ORG = 14; // 30 * 14 = 420
/** Every context with no revisions gets at least 1 history (approved) + 1 pending (proposed). */
const MIN_HISTORY_PER_CONTEXT = 1;
const MIN_PENDING_PER_CONTEXT = 1;

/** Real-world division names (AI-curated for financial services / enterprise). Used for org bootstrap. */
const ORG_NAMES: Array<{ name: string; slug: string; description: string }> = [
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

/** Real-world agent / role names (AI-curated). Used for agent bootstrap; we cycle by index for variety. */
const AGENT_NAMES: Array<{ name: string; description: string }> = [
  { name: 'Portfolio Analyst', description: 'Portfolio analysis and performance attribution' },
  { name: 'KYC Verification Bot', description: 'Know-your-customer verification and document checks' },
  { name: 'Loan Origination Assistant', description: 'Loan application intake and initial underwriting support' },
  { name: 'Trade Surveillance Agent', description: 'Real-time trade surveillance and exception flagging' },
  { name: 'Customer Onboarding Bot', description: 'Digital onboarding and identity verification' },
  { name: 'Compliance Checker', description: 'Policy and regulatory compliance checks' },
  { name: 'Fraud Detection Agent', description: 'Transaction monitoring and fraud pattern detection' },
  { name: 'Document Extraction Bot', description: 'Extract and classify data from documents' },
  { name: 'Credit Scoring Assistant', description: 'Credit risk scoring and decision support' },
  { name: 'AML Alert Triage', description: 'Anti-money laundering alert triage and escalation' },
  { name: 'Client Reporting Bot', description: 'Automated client reports and dashboards' },
  { name: 'Research Summarizer', description: 'Summarize research and market commentary' },
  { name: 'Suitability Advisor', description: 'Product suitability and risk appetite assessment' },
  { name: 'Settlement Recon Agent', description: 'Settlement and reconciliation automation' },
  { name: 'Margin Calculator', description: 'Margin and collateral calculations' },
  { name: 'Limit Monitor', description: 'Position and limit monitoring' },
  { name: 'Disclosure Generator', description: 'Regulatory and product disclosure generation' },
  { name: 'Contract Analyzer', description: 'Contract extraction and clause analysis' },
  { name: 'Incident Triage Bot', description: 'Security and ops incident triage' },
  { name: 'Audit Sampler', description: 'Sample selection and audit support' },
  { name: 'Tax Classifier', description: 'Tax classification and reporting support' },
  { name: 'Order Router', description: 'Smart order routing and execution support' },
  { name: 'Client Outreach Bot', description: 'Scheduled client outreach and follow-up' },
  { name: 'NLP Document Reviewer', description: 'Natural language document review' },
  { name: 'Model Risk Validator', description: 'Model validation and back-testing support' },
  { name: 'Regulatory Reporter', description: 'Regulatory filing and reporting support' },
  { name: 'Chatbot for Support', description: 'Customer and internal support chatbot' },
  { name: 'Data Quality Monitor', description: 'Data quality checks and anomaly detection' },
  { name: 'Vendor Risk Scorer', description: 'Vendor risk assessment and monitoring' },
  { name: 'ESG Data Aggregator', description: 'ESG data collection and reporting' },
  { name: 'Strategy Research Agent', description: 'Strategy and market research support' },
];

/** Real-world AI Agent Prompts — the "Employee Handbook" for AI agents */
const SEED_PROMPTS: Array<{
  name: string;
  description: string;
  tags: string[];
  content: string;
  systemPrompt: string;
  model: string;
}> = [
  {
    name: 'customer-support-agent',
    description: 'System prompt for customer support chatbot',
    tags: ['support', 'retail', 'customer-facing'],
    content: `You are a helpful customer support agent for Open Bank.

## Guidelines
- Be polite, professional, and empathetic
- Never share sensitive account information without proper verification
- If you don't know the answer, offer to connect to a human agent
- Do not provide financial advice

## Capabilities
- Answer questions about account balances and transactions
- Help with password resets and account access
- Explain bank products and services

## Restrictions
- Never discuss other customers' information
- Do not make promises about loan approvals
- Always recommend speaking with a licensed advisor for investment questions`,
    systemPrompt: 'You are a customer support agent for Open Bank.',
    model: 'gpt-4',
  },
  {
    name: 'kyc-verification-agent',
    description: 'KYC document verification and identity checking',
    tags: ['compliance', 'kyc', 'verification'],
    content: `You are a KYC verification agent reviewing customer identity documents.

## Document Types
- Government-issued ID (passport, driver's license)
- Proof of address (utility bill, bank statement)
- Corporate documents (certificate of incorporation)

## Verification Steps
1. Check document authenticity
2. Verify information matches application
3. Flag discrepancies
4. Assign risk score

## Output: JSON with document_type, verification_status, confidence_score, flags`,
    systemPrompt: 'You are a KYC verification specialist.',
    model: 'gpt-4-vision',
  },
  {
    name: 'fraud-detection-agent',
    description: 'Real-time transaction fraud detection',
    tags: ['fraud', 'security', 'risk'],
    content: `You are a fraud detection agent analyzing transactions.

## Analysis Factors
- Transaction amount vs. customer profile
- Geographic anomalies
- Velocity checks
- Merchant category risk

## Risk Scoring (0-100)
- 0-30: Low risk - auto-approve
- 31-60: Medium - enhanced monitoring
- 61-80: High - step-up auth required
- 81-100: Critical - block and alert

## Output: JSON with risk_score, risk_factors, recommended_action`,
    systemPrompt: 'You are a fraud detection analyst.',
    model: 'gpt-4',
  },
  {
    name: 'wealth-advisor-agent',
    description: 'Wealth management advisor assistant',
    tags: ['wealth-management', 'advisory', 'portfolio'],
    content: `You are an AI assistant for wealth advisors.

## Suitability Framework
Before recommendations, verify:
1. Client risk profile
2. Investment time horizon
3. Liquidity needs
4. Tax situation

## Compliance
- Only recommend approved products
- Document suitability analysis
- Flag concentration risks (>10% single position)
- Include MiFID II cost disclosures

## Restrictions
- Never guarantee returns
- Do not recommend outside risk profile`,
    systemPrompt: 'You are a wealth advisory assistant.',
    model: 'gpt-4',
  },
  {
    name: 'compliance-review-agent',
    description: 'Communications surveillance for compliance',
    tags: ['compliance', 'surveillance', 'legal'],
    content: `You are a compliance surveillance agent.

## Review Scope
- Insider trading indicators
- Market manipulation language
- Unauthorized commitments
- Confidential information leaks

## Severity Levels
- INFO: Notable but not concerning
- WARNING: Requires supervisor review
- ALERT: Potential violation - escalate
- CRITICAL: Immediate escalation

## Output: JSON with severity, violation_type, key_phrases, recommended_action`,
    systemPrompt: 'You are a compliance surveillance analyst.',
    model: 'gpt-4',
  },
  {
    name: 'document-extraction-agent',
    description: 'Intelligent document processing and extraction',
    tags: ['document', 'extraction', 'automation'],
    content: `You are a document extraction agent.

## Supported Documents
- Account statements
- Tax forms (W-2, 1099)
- Loan documents
- Corporate filings
- Contracts

## Tasks
1. Identify document type
2. Extract key fields
3. Validate data consistency
4. Flag missing information

## Output: JSON with document_type, extracted_fields, validation_flags`,
    systemPrompt: 'You are a document processing specialist.',
    model: 'gpt-4-vision',
  },
  {
    name: 'research-summarizer-agent',
    description: 'Investment research summarization',
    tags: ['research', 'investment-banking', 'analysis'],
    content: `You are a research summarization agent.

## Summary Components
1. Key Takeaways (3-5 bullets)
2. Investment Thesis Changes
3. Price Target Changes
4. Risks and Concerns
5. Catalysts

## Output: JSON with source, key_takeaways, sentiment, rating_change, risks

## Guidelines
- Be objective and factual
- Do not add opinions beyond source
- Note conflicts of interest
- Flag MNPI`,
    systemPrompt: 'You are an investment research analyst.',
    model: 'gpt-4',
  },
  {
    name: 'trade-execution-agent',
    description: 'Trading desk order validation',
    tags: ['trading', 'investment-banking', 'execution'],
    content: `You are a trade execution validation agent.

## Pre-Trade Checks
1. Verify trader authorization
2. Check position limits
3. Validate instrument approved
4. Ensure counterparty approved
5. Check restricted list

## Order Validation
- Validate order parameters
- Check market hours
- Verify margin/collateral
- Apply best execution

## Output: JSON with validation_status, checks_passed, checks_failed`,
    systemPrompt: 'You are a trade execution validation agent.',
    model: 'gpt-4',
  },
  // Additional 42 prompts for 50 total
  { name: 'loan-underwriting-agent', description: 'Loan underwriting and credit decision support', tags: ['lending', 'credit', 'retail-banking'], content: 'Analyze loan applications against credit policy. Evaluate: credit score, DTI, employment, collateral. Output: recommendation, risk_tier, conditions.', systemPrompt: 'You are a loan underwriting specialist.', model: 'gpt-4' },
  { name: 'aml-transaction-monitor', description: 'AML transaction monitoring and SAR preparation', tags: ['aml', 'compliance', 'risk'], content: 'Monitor transactions for suspicious activity: large cash, structuring, geographic risk, unusual patterns. Output: alert_type, risk_score, SAR_narrative.', systemPrompt: 'You are an AML compliance analyst.', model: 'gpt-4' },
  { name: 'portfolio-rebalancing-agent', description: 'Portfolio rebalancing recommendations', tags: ['wealth-management', 'portfolio', 'trading'], content: 'Recommend rebalancing when drift >5%. Consider tax-loss harvesting, wash sales, costs. Output: trades, tax_impact, new_allocation.', systemPrompt: 'You are a portfolio management assistant.', model: 'gpt-4' },
  { name: 'regulatory-filing-agent', description: 'Regulatory filing preparation and validation', tags: ['compliance', 'regulatory', 'legal'], content: 'Prepare SEC, FINRA, state filings. Validate data, cross-reference sources. Output: filing_status, errors, sign_off_ready.', systemPrompt: 'You are a regulatory filing specialist.', model: 'gpt-4' },
  { name: 'client-onboarding-agent', description: 'New client onboarding and account opening', tags: ['onboarding', 'kyc', 'client-services'], content: 'Guide new account setup: collect info, verify identity, assess suitability, present products. Ensure KYC/AML compliance.', systemPrompt: 'You are a client onboarding specialist.', model: 'gpt-4' },
  { name: 'market-risk-analyst', description: 'Market risk analysis and VaR calculation', tags: ['risk', 'trading', 'quantitative'], content: 'Calculate VaR, ES, Greeks, stress tests. Flag breaches, explain risk drivers. Output: metrics, breaches, recommendations.', systemPrompt: 'You are a market risk analyst.', model: 'gpt-4' },
  { name: 'credit-risk-analyst', description: 'Credit risk assessment and rating', tags: ['risk', 'credit', 'lending'], content: 'Assess creditworthiness: financials, industry, management, collateral. Output: rating, PD, LGD, risk_factors.', systemPrompt: 'You are a credit risk analyst.', model: 'gpt-4' },
  { name: 'operational-risk-agent', description: 'Operational risk event tracking', tags: ['risk', 'operations', 'compliance'], content: 'Track OpRisk events: fraud, employment, business practices. Identify root cause, control gaps. Output: classification, remediation.', systemPrompt: 'You are an operational risk analyst.', model: 'gpt-4' },
  { name: 'treasury-cash-forecast', description: 'Cash flow forecasting and liquidity', tags: ['treasury', 'finance', 'liquidity'], content: 'Forecast cash: operating flows, maturities, debt service, capex. Output: daily/weekly forecast, funding needs.', systemPrompt: 'You are a treasury analyst.', model: 'gpt-4' },
  { name: 'trade-settlement-agent', description: 'Trade settlement and exceptions', tags: ['operations', 'trading', 'settlement'], content: 'Manage post-trade: match details, verify SSI, monitor status, handle fails. Output: status, exceptions, resolutions.', systemPrompt: 'You are a trade settlement specialist.', model: 'gpt-4' },
  { name: 'corporate-actions-agent', description: 'Corporate actions processing', tags: ['operations', 'securities', 'custody'], content: 'Process dividends, splits, rights, tenders, M&A, proxies. Output: event_details, client_impact, elections.', systemPrompt: 'You are a corporate actions specialist.', model: 'gpt-4' },
  { name: 'reconciliation-agent', description: 'Account and position reconciliation', tags: ['operations', 'finance', 'data-quality'], content: 'Reconcile cash, positions, P&L, collateral. Identify breaks, root cause. Output: match_status, breaks, resolution.', systemPrompt: 'You are a reconciliation specialist.', model: 'gpt-4' },
  { name: 'vendor-management-agent', description: 'Vendor risk assessment', tags: ['procurement', 'risk', 'compliance'], content: 'Assess vendor: financial stability, security, compliance, BCP. Output: risk_rating, findings, recommendations.', systemPrompt: 'You are a vendor management specialist.', model: 'gpt-4' },
  { name: 'contract-review-agent', description: 'Legal contract review', tags: ['legal', 'contracts', 'compliance'], content: 'Review contracts: key terms, risk allocation, liability, termination. Output: summary, risk_flags, negotiation_points.', systemPrompt: 'You are a legal contract analyst.', model: 'gpt-4' },
  { name: 'hr-policy-assistant', description: 'HR policy guidance', tags: ['hr', 'employee-services', 'policy'], content: 'Answer HR questions: benefits, leave, performance, compensation. Escalate discrimination concerns. Protect confidentiality.', systemPrompt: 'You are an HR policy assistant.', model: 'gpt-4' },
  { name: 'recruiting-screener', description: 'Resume screening and evaluation', tags: ['hr', 'recruiting', 'talent'], content: 'Screen candidates: qualifications, experience, skills, fit. Avoid bias. Output: match_score, strengths, concerns.', systemPrompt: 'You are a recruiting specialist.', model: 'gpt-4' },
  { name: 'expense-audit-agent', description: 'Employee expense auditing', tags: ['finance', 'compliance', 'audit'], content: 'Audit expenses: policy compliance, receipts, approvals, duplicates. Output: violations, adjustments, recommendations.', systemPrompt: 'You are an expense audit specialist.', model: 'gpt-4' },
  { name: 'budget-analyst-agent', description: 'Budget analysis and variance', tags: ['finance', 'planning', 'analysis'], content: 'Analyze actual vs budget, variances, trends. Output: variance_summary, explanations, forecast_adjustments.', systemPrompt: 'You are a financial planning analyst.', model: 'gpt-4' },
  { name: 'tax-preparation-agent', description: 'Tax return preparation support', tags: ['tax', 'finance', 'compliance'], content: 'Support tax filing: gather data, identify deductions, prepare forms. Flag complex issues for CPA.', systemPrompt: 'You are a tax preparation specialist.', model: 'gpt-4' },
  { name: 'internal-audit-agent', description: 'Internal audit testing support', tags: ['audit', 'compliance', 'risk'], content: 'Support audits: control testing, sampling, workpapers, findings. Output: test_results, exceptions, recommendations.', systemPrompt: 'You are an internal auditor.', model: 'gpt-4' },
  { name: 'data-privacy-agent', description: 'Data privacy and DSAR processing', tags: ['privacy', 'compliance', 'legal'], content: 'Handle privacy requests: DSAR, deletion, portability, consent. Output: request_type, data_inventory, compliance_status.', systemPrompt: 'You are a data privacy specialist.', model: 'gpt-4' },
  { name: 'cybersecurity-analyst', description: 'Security alert triage', tags: ['security', 'technology', 'risk'], content: 'Triage security alerts: malware, phishing, unauthorized access, exfiltration. Output: severity, threat, containment.', systemPrompt: 'You are a cybersecurity analyst.', model: 'gpt-4' },
  { name: 'it-helpdesk-agent', description: 'IT support and troubleshooting', tags: ['technology', 'support', 'operations'], content: 'Provide IT support: passwords, software, hardware, network. Output: issue_category, steps, resolution.', systemPrompt: 'You are an IT support specialist.', model: 'gpt-4' },
  { name: 'change-management-agent', description: 'IT change request evaluation', tags: ['technology', 'operations', 'risk'], content: 'Evaluate change requests: justification, feasibility, risk, rollback. Output: risk_rating, impact, recommendation.', systemPrompt: 'You are a change management analyst.', model: 'gpt-4' },
  { name: 'marketing-content-agent', description: 'Marketing content creation', tags: ['marketing', 'content', 'compliance'], content: 'Create marketing materials: emails, social, web copy. Include disclosures, avoid misleading claims.', systemPrompt: 'You are a marketing content specialist.', model: 'gpt-4' },
  { name: 'lead-qualification-agent', description: 'Sales lead qualification', tags: ['sales', 'marketing', 'crm'], content: 'Score leads: budget, authority, need, timeline, fit. Output: lead_score, status, next_actions.', systemPrompt: 'You are a sales development representative.', model: 'gpt-4' },
  { name: 'rfp-response-agent', description: 'RFP response preparation', tags: ['sales', 'proposals', 'content'], content: 'Prepare RFP responses: analyze requirements, match content, identify gaps. Output: compliance_matrix, sections, win_themes.', systemPrompt: 'You are a proposal specialist.', model: 'gpt-4' },
  { name: 'customer-success-agent', description: 'Customer health monitoring', tags: ['customer-success', 'retention', 'support'], content: 'Monitor account health: usage, tickets, NPS, renewal. Output: health_score, risk_flags, engagement_actions.', systemPrompt: 'You are a customer success manager.', model: 'gpt-4' },
  { name: 'product-feedback-agent', description: 'Customer feedback analysis', tags: ['product', 'feedback', 'analytics'], content: 'Analyze feedback: tickets, NPS, reviews, social. Output: theme_categories, sentiment, priority, recommendations.', systemPrompt: 'You are a product analyst.', model: 'gpt-4' },
  { name: 'requirements-analyst', description: 'Business requirements documentation', tags: ['product', 'engineering', 'analysis'], content: 'Document requirements: user stories, acceptance criteria, flows. Output: stories, criteria, dependencies.', systemPrompt: 'You are a business analyst.', model: 'gpt-4' },
  { name: 'qa-test-agent', description: 'Test case generation', tags: ['engineering', 'quality', 'testing'], content: 'Support testing: generate cases, prepare data, document defects. Output: test_cases, results, coverage.', systemPrompt: 'You are a QA engineer.', model: 'gpt-4' },
  { name: 'code-review-agent', description: 'Automated code review', tags: ['engineering', 'security', 'quality'], content: 'Review code: security, style, performance, error handling. Output: findings, severity, recommendations.', systemPrompt: 'You are a senior software engineer.', model: 'gpt-4' },
  { name: 'incident-commander', description: 'Production incident coordination', tags: ['engineering', 'operations', 'support'], content: 'Manage incidents: assess severity, coordinate team, communicate status. Output: severity, updates, postmortem.', systemPrompt: 'You are a site reliability engineer.', model: 'gpt-4' },
  { name: 'capacity-planning-agent', description: 'Infrastructure capacity planning', tags: ['technology', 'operations', 'planning'], content: 'Forecast capacity: compute, storage, network, database. Output: utilization, forecast, recommendations.', systemPrompt: 'You are a capacity planning analyst.', model: 'gpt-4' },
  { name: 'data-quality-agent', description: 'Data quality monitoring', tags: ['data', 'quality', 'operations'], content: 'Monitor data quality: completeness, accuracy, consistency, timeliness. Output: scores, issues, remediation.', systemPrompt: 'You are a data quality analyst.', model: 'gpt-4' },
  { name: 'etl-monitoring-agent', description: 'ETL pipeline monitoring', tags: ['data', 'engineering', 'operations'], content: 'Monitor ETL: job status, errors, validation, SLAs. Output: pipeline_status, errors, remediation.', systemPrompt: 'You are a data engineer.', model: 'gpt-4' },
  { name: 'bi-report-agent', description: 'Business intelligence reporting', tags: ['analytics', 'reporting', 'data'], content: 'Generate BI reports: dashboards, metrics, analytics. Output: key_metrics, trends, insights.', systemPrompt: 'You are a business intelligence analyst.', model: 'gpt-4' },
  { name: 'ml-model-monitor', description: 'ML model performance monitoring', tags: ['ai-ml', 'data-science', 'operations'], content: 'Monitor ML models: accuracy, drift, bias, latency. Output: metrics, drift_detected, retraining_needed.', systemPrompt: 'You are an ML engineer.', model: 'gpt-4' },
  { name: 'esg-reporting-agent', description: 'ESG data and sustainability reporting', tags: ['esg', 'compliance', 'reporting'], content: 'Prepare ESG reports: GRI, SASB, TCFD, SDGs. Output: metrics, disclosures, improvements.', systemPrompt: 'You are an ESG analyst.', model: 'gpt-4' },
  { name: 'strategy-research-agent', description: 'Competitive intelligence and market research', tags: ['strategy', 'research', 'analysis'], content: 'Conduct research: competitors, market sizing, trends, SWOT. Output: findings, implications, recommendations.', systemPrompt: 'You are a strategy analyst.', model: 'gpt-4' },
  { name: 'ma-due-diligence', description: 'M&A due diligence support', tags: ['corp-dev', 'finance', 'legal'], content: 'Support M&A: financial, legal, operational, tech due diligence. Output: findings, risks, valuation_inputs.', systemPrompt: 'You are an M&A analyst.', model: 'gpt-4' },
  { name: 'real-estate-analyst', description: 'Commercial real estate analysis', tags: ['real-estate', 'finance', 'analysis'], content: 'Evaluate properties: comparables, cap rates, cash flows, leases. Output: valuation, metrics, risks.', systemPrompt: 'You are a real estate analyst.', model: 'gpt-4' },
];

/**
 * POST /api/seed
 * Seeds bootstrap data: 30 orgs, 420 agents, 3009 contexts.
 * Plus templates, settings, scan_targets, activity/audit samples.
 * Idempotent: skips creating resources that already exist. Runs on container start (e.g. GCP Cloud Run).
 */

export const maxDuration = 120;

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
      const orgEntry = ORG_NAMES[(n - 1) % ORG_NAMES.length];
      const slug = orgEntry.slug;
      if (await getOrganizationBySlug(slug)) {
        orgs = await getAllOrganizations();
        continue;
      }
      try {
        await createOrganization({
          name: orgEntry.name,
          slug,
          description: orgEntry.description,
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
      let globalAgentIndex = 0;
      for (let o = 0; o < orgs.length && (await getAgentCount()) < TARGET_AGENTS; o++) {
        const orgId = orgs[o].id;
        const orgSlug = (orgs[o] as { slug?: string }).slug ?? `org-${o + 1}`;
        const currentInOrg = await getAgentCount(orgId);
        const toAdd = Math.min(AGENTS_PER_ORG - currentInOrg, TARGET_AGENTS - (await getAgentCount()));
        for (let a = 0; a < toAdd; a++) {
          const agentEntry = AGENT_NAMES[globalAgentIndex % AGENT_NAMES.length];
          globalAgentIndex += 1;
          const localIdx = currentInOrg + a + 1;
          const a2aUrl = `https://agents.example.com/${orgSlug.replace(/-/g, '/')}/agent-${String(localIdx).padStart(2, '0')}`;
          try {
            await createAgent({
              orgId,
              name: agentEntry.name,
              description: agentEntry.description,
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

    // --- Seed History + Pending for every context that has none (by ID, any name) ---
    const allContexts = await getAllContexts();
    let contextsWithRevisionsSeeded = 0;
    for (const ctx of allContexts) {
      const existing = await getRevisionsByContextId(ctx.id);
      const approved = existing.filter((r) => r.status === 'approved' || r.status === 'rejected');
      const proposed = existing.filter((r) => r.status === 'proposed');
      const needHistory = Math.max(0, MIN_HISTORY_PER_CONTEXT - approved.length);
      const needPending = Math.max(0, MIN_PENDING_PER_CONTEXT - proposed.length);
      if (needHistory === 0 && needPending === 0) continue;

      const contentBase = typeof ctx.content === 'object' && ctx.content !== null ? { ...ctx.content } : { policy: 'sample', version: '1.0' };
      const createdRevisions: { id: string }[] = [];

      for (let k = 0; k < needHistory + needPending; k++) {
        try {
          const rev = await proposeRevision({
            contextId: ctx.id,
            content: { ...contentBase, _revision: k + 1, _seed: true },
            commitMessage: `Seed revision for ${ctx.name}`,
            createdBy: 'seed@example.com',
          });
          createdRevisions.push({ id: rev.id });
        } catch {
          break;
        }
      }

      const toApprove = Math.min(needHistory, createdRevisions.length);
      for (let k = 0; k < toApprove; k++) {
        try {
          await approveRevision(createdRevisions[k].id, 'compliance@example.com');
        } catch {
          break;
        }
      }
      contextsWithRevisionsSeeded += 1;
    }

    // --- Bootstrap: Agent Prompts (the "Employee Handbook" for AI agents) ---
    let promptsSeeded = 0;
    for (const p of SEED_PROMPTS) {
      const existing = await getPromptByName(p.name);
      if (existing) continue;
      try {
        const prompt = await createPrompt({
          name: p.name,
          description: p.description,
          tags: p.tags,
        });
        await createPromptVersion({
          promptId: prompt.id,
          content: p.content,
          systemPrompt: p.systemPrompt,
          model: p.model,
          commitMessage: `Initial ${p.name} prompt`,
          autoApprove: true,
        });
        promptsSeeded++;
      } catch {
        // Skip if already exists
      }
    }

    // Templates (for financial services) – reusable schemas + default values for context content
    const templatesToCreate: Array<{ name: string; description: string; schema: TemplateSchema; defaultValues: Record<string, unknown> }> = [
      {
        name: 'compliance-policy',
        description: 'Compliance policy context: policy name, effective date, KYC and review settings.',
        schema: {
          type: 'object',
          properties: {
            policy: { type: 'string', description: 'Policy identifier or name' },
            effectiveDate: { type: 'string', description: 'Effective date (YYYY-MM-DD)' },
            kycRequired: { type: 'boolean', description: 'Whether KYC is required' },
            reviewFrequency: { type: 'string', description: 'e.g. daily, weekly, monthly', enum: ['daily', 'weekly', 'monthly', 'quarterly'] },
          },
          required: ['policy'],
        },
        defaultValues: { policy: 'Compliance Policy', kycRequired: true, reviewFrequency: 'monthly' },
      },
      {
        name: 'trading-limits',
        description: 'Trading and position limits for desks. Used by IB and trading agents.',
        schema: {
          type: 'object',
          properties: {
            policy: { type: 'string', description: 'Policy name' },
            varLimit: { type: 'number', description: 'VAR limit per desk' },
            singleNameLimit: { type: 'number', description: 'Single-name exposure limit' },
            maxPositionPct: { type: 'number', description: 'Max position as share of portfolio' },
            effectiveDate: { type: 'string' },
            reviewFrequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          },
          required: ['policy'],
        },
        defaultValues: { policy: 'Trading Limits', varLimit: 1000000, singleNameLimit: 500000, maxPositionPct: 0.02, reviewFrequency: 'daily' },
      },
      {
        name: 'suitability-policy',
        description: 'Wealth suitability and risk appetite. Used by WM and advisory agents.',
        schema: {
          type: 'object',
          properties: {
            policy: { type: 'string' },
            riskBands: { type: 'array', description: 'e.g. conservative, moderate, growth' },
            kycTier: { type: 'string', enum: ['standard', 'enhanced'] },
            minAge: { type: 'number' },
            minAumForGrowth: { type: 'number', description: 'Min AUM for growth band' },
            rebalanceThreshold: { type: 'number' },
            requireAdvisorSignOff: { type: 'boolean' },
          },
          required: ['policy'],
        },
        defaultValues: { policy: 'Suitability', riskBands: ['conservative', 'moderate', 'growth', 'aggressive'], kycTier: 'standard', minAge: 18, requireAdvisorSignOff: false },
      },
      {
        name: 'kyc-config',
        description: 'KYC verification and document requirements for onboarding.',
        schema: {
          type: 'object',
          properties: {
            tier: { type: 'string', enum: ['standard', 'enhanced', 'institutional'] },
            requiredDocuments: { type: 'array', description: 'Document types required (e.g. id, proof_of_address)' },
            maxPendingDays: { type: 'number' },
            amlCheckRequired: { type: 'boolean' },
          },
          required: ['tier'],
        },
        defaultValues: { tier: 'standard', requiredDocuments: ['id', 'proof_of_address'], maxPendingDays: 30, amlCheckRequired: true },
      },
      {
        name: 'disclosure-policy',
        description: 'Regulatory and product disclosure text and effective dates.',
        schema: {
          type: 'object',
          properties: {
            disclosureType: { type: 'string', description: 'e.g. product, regulatory' },
            effectiveDate: { type: 'string' },
            locale: { type: 'string' },
            body: { type: 'string', description: 'Disclosure text or reference' },
          },
          required: ['disclosureType'],
        },
        defaultValues: { disclosureType: 'regulatory', locale: 'en-US' },
      },
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
      message: `Bootstrap seeded: ${TARGET_ORGS} orgs, ${TARGET_AGENTS} agents, ${TARGET_CONTEXTS.toLocaleString()} contexts, ${promptsSeeded} agent prompts; ${contextsWithRevisionsSeeded} contexts with History + Pending revisions. Plus templates, settings, scan targets, audit log. Visible after login.`,
    });
  } catch (error) {
    console.error('Seed failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
