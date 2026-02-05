#!/usr/bin/env python3
"""
Generate real-world scale seed data: 50+ orgs, 1000+ agents, 5000+ prompts, 10000+ contexts.
Run after init_postgres (and optionally after loading data/sandarb.sql for templates/settings).
Uses deterministic variety so the same counts produce the same realistic data.

Defaults (can override via env or CLI):
  SEED_ORGS=50, SEED_AGENTS=1000, SEED_PROMPTS=5000, SEED_CONTEXTS=10000

Usage:
  python scripts/seed_scale.py [--orgs 50] [--agents 1000] [--prompts 5000] [--contexts 10000]
  npm run db:seed-scale
"""
import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url

load_dotenv()

# Default scale (real-world targets)
DEFAULT_ORGS = 50
DEFAULT_AGENTS = 1000
DEFAULT_PROMPTS = 5000
DEFAULT_CONTEXTS = 10000

# Top-level org (slug 'root' for lookups; display name and description are real-world)
ROOT_ORG_NAME = "Sandarb HQ"
ROOT_ORG_DESCRIPTION = "Corporate headquarters and group-level governance."

# Real-world building blocks (deterministic pick via index)
ORG_NAMES = [
    ROOT_ORG_NAME,
    "Retail Banking", "Investment Banking", "Wealth Management", "Legal & Compliance", "Risk Management", "Operations",
    "North America Retail", "APAC Capital Markets", "EMEA Compliance", "Product Control", "Treasury", "Middle Office",
    "Consumer Lending", "Commercial Banking", "Markets & Trading", "Private Banking", "Asset Management",
    "Financial Crime Compliance", "Regulatory Reporting", "Internal Audit", "Technology & Operations",
    "North America Markets", "EMEA Markets", "APAC Wealth", "Latin America Operations", "Global Trade Finance",
    "Securities Services", "Prime Brokerage", "Structured Products", "Equity Research", "Fixed Income",
    "FX & Commodities", "Derivatives", "Client Onboarding", "Documentation", "Collateral Management",
    "Valuation Control", "Model Risk", "Operational Risk", "Credit Risk", "Market Risk",
    "Regional Operations EMEA", "Regional Operations APAC", "Group Finance", "Group Risk",
]
ORG_DESCRIPTIONS = [
    ROOT_ORG_DESCRIPTION,
    "Consumer deposits, lending, and branch operations.",
    "M&A, capital markets, and advisory.",
    "Private banking, advisory, and portfolio management.",
    "Legal, regulatory, and compliance oversight.",
    "Enterprise risk, credit risk, and operational risk.",
    "Back-office, settlements, and operations.",
    "Regional retail distribution and digital channels.",
    "Asia-Pacific capital markets and sales.",
    "EMEA regulatory and compliance programs.",
    "Product control and P&L.",
    "Treasury and liquidity management.",
    "Trade support and middle office.",
    "Consumer and mortgage lending.",
    "Commercial and corporate banking.",
    "Sales, trading, and market-making.",
    "High-net-worth and family office.",
    "Institutional asset management.",
    "AML, sanctions, and financial crime.",
    "Regulatory reporting and disclosure.",
    "Internal audit and assurance.",
    "Technology and operations shared services.",
    "Regional operations and governance for EMEA.",
    "Regional operations and governance for APAC.",
    "Group-level finance and reporting.",
    "Group-level risk oversight.",
]
# Real-world context names (no generic topic-0)
CONTEXT_NAME_STEMS = [
    "ib-trading-limits-policy", "aml-ctr-thresholds", "kyc-cip-requirements", "reg-e-dispute-resolution",
    "reg-bi-suitability-policy", "pre-trade-concentration-checks", "cip-identity-verification",
    "concentration-single-name-limits", "var-risk-limits-desk", "client-onboarding-cip",
    "document-acceptance-standards", "ofac-sanctions-screening", "sar-escalation-filing",
    "reg-e-provisional-credit", "reg-bi-suitability-docs", "volcker-desk-limits",
    "trade-surveillance-exceptions", "intraday-limit-monitoring", "exception-escalation-procedures",
    "audit-retention-requirements",
]
# Real-world prompt names (no generic topic-0)
PROMPT_NAME_STEMS = [
    "retail-customer-support-playbook", "kyc-identity-verification-standard", "aml-alert-triage-playbook",
    "pre-trade-compliance-playbook", "suitability-advisor-reg-bi", "dispute-resolution-reg-e",
    "client-reporting-playbook", "limit-monitoring-escalation", "document-review-policy",
    "regulatory-reporting-playbook", "exception-handling-procedures", "identity-verification-cip",
    "transaction-review-sar", "audit-trail-governance", "risk-reporting-playbook",
]
AGENT_ROLES = [
    "Portfolio Analyst Agent", "Trade Surveillance Agent", "KYC Verification Agent", "Customer Onboarding Agent",
    "AML Alert Triage Agent", "Suitability Advisor Agent", "Settlement Reconciliation Agent", "Risk Reporting Agent",
    "Compliance Check Agent", "Client Reporting Agent", "Document Verification Agent", "Pre-Trade Compliance Agent",
    "Post-Trade Control Agent", "Limit Monitoring Agent", "Exception Handling Agent", "Dispute Resolution Agent",
    "Identity Verification Agent", "Transaction Monitoring Agent", "Regulatory Reporting Agent", "Audit Trail Agent",
]
AGENT_DESCRIPTIONS = [
    "Provides portfolio analysis and performance attribution for this line of business.",
    "Monitors activity in real time and flags exceptions for compliance and risk.",
    "Performs know-your-customer verification and document checks for onboarding and compliance.",
    "Supports digital onboarding and identity verification for new customers.",
    "Triage and escalation of anti-money laundering alerts for compliance review.",
    "Assesses product suitability and risk appetite for advisory and distribution.",
    "Automates settlement and reconciliation for trades and positions.",
    "Produces risk and control reports for management and regulators.",
    "Runs policy and regulatory compliance checks across processes and content.",
    "Generates automated client reports and dashboards for advisory and operations.",
    "Validates and processes identity and corporate documents per CIP.",
    "Enforces pre-trade limits and concentration checks per desk policy.",
    "Validates post-trade breaks and settlement instructions.",
    "Monitors intraday limits and alerts on breaches.",
    "Handles exceptions and escalations per operating procedures.",
    "Resolves customer disputes per Reg E and network rules.",
    "Verifies customer identity and document authenticity.",
    "Monitors transactions for suspicious activity and SAR escalation.",
    "Prepares and submits regulatory reports per jurisdiction.",
    "Maintains audit trail and lineage for governance.",
]
REG_SCOPES = [
    '["Reg E","Reg Z","TILA"]', '["FINRA","SEC","Volcker"]', '["FINRA 2111","Reg BI","MiFID II"]',
    '["BSA","FinCEN","GDPR","SOX"]', '["FINRA","SEC"]', '["Reg E","Reg Z"]', '["BSA","CIP","PATRIOT Act"]',
]
DATA_SCOPES = [
    '["accounts","transactions","customers"]', '["positions","trades","counterparties"]', '["transactions","kyc","alerts"]',
]
LOB_TAGS = ("Wealth-Management", "Investment-Banking", "Retail-Banking", "Legal-Compliance")
DATA_CLASS = ("Public", "Internal", "Confidential", "Restricted")
CONTEXT_TOPICS = [
    "trading-limits", "aml-thresholds", "kyc-rules", "dispute-rules", "suitability-matrix", "pre-trade-checks",
    "cip-requirements", "concentration-limits", "var-limits", "client-onboarding", "document-acceptance",
    "ofac-screening", "sar-escalation", "reg-e-timeframes", "reg-bi-suitability", "volcker-desk",
    "trade-surveillance", "limit-monitoring", "exception-handling", "audit-retention",
]
CONTEXT_DESCRIPTIONS = [
    "Trading desk limits and pre-trade controls.",
    "AML transaction monitoring thresholds and alert rules.",
    "KYC identity verification requirements and document acceptance.",
    "Dispute handling rules and resolution timeframes.",
    "Suitability and best interest policy.",
    "Pre-trade compliance and concentration checks.",
    "Customer Identification Program requirements.",
    "Concentration and single-name limits.",
    "VaR and risk limits by desk.",
    "Client onboarding and CIP documentation.",
    "Document acceptance and verification standards.",
    "OFAC and sanctions screening rules.",
    "SAR escalation and filing procedures.",
    "Reg E dispute timeframes and provisional credit.",
    "Reg BI and suitability documentation.",
    "Volcker Rule desk and product limits.",
    "Trade surveillance and exception monitoring.",
    "Intraday limit monitoring and breach alerts.",
    "Exception handling and escalation procedures.",
    "Audit trail and record retention requirements.",
]
PROMPT_TOPICS = [
    "customer-support", "kyc-verification", "aml-triage", "trade-desk-compliance", "suitability-advisor",
    "dispute-resolution", "client-reporting", "limit-monitoring", "document-review", "regulatory-reporting",
    "exception-handling", "identity-verification", "transaction-review", "audit-trail", "risk-reporting",
]
# Real-world product-style agent names (no repeated "Org + Role" pattern)
REAL_WORLD_AGENT_NAMES = [
    "Alpha Portfolio Optimizer", "TradeBloc Surveillance", "KYC Gateway", "Onboarding Assist", "Alert Triage Americas",
    "Suitability Advisor Pro", "Settlement Recon Engine", "Risk Report Hub", "Compliance Checkpoint", "Client Report Builder",
    "DocVerify Suite", "Pre-Trade Guard", "Post-Trade Control", "Limit Monitor EMEA", "Exception Handler APAC",
    "Dispute Resolver", "Identity Verify", "Transaction Watch", "Regulatory Reporter", "Audit Trail Manager",
    "Wealth Portfolio Analyst", "Markets Surveillance Desk", "CIP Verification Agent", "Digital Onboarding Flow", "AML Triage Runbook",
    "Reg BI Suitability Engine", "Recon & Settlements", "Risk & Control Reports", "Policy Compliance Scanner", "Advisory Report Generator",
    "Corporate Doc Verifier", "Concentration Check Agent", "Break & Settlement Validator", "Intraday Limit Alert", "Escalation Router",
    "Reg E Dispute Handler", "CIP Identity Check", "SAR Triage & Escalation", "Filing & Disclosure Agent", "Governance Audit Logger",
    "North America KYC Agent", "EMEA Trade Surveillance", "APAC Limit Monitor", "Americas AML Triage", "Global Suitability Advisor",
    "Prime Reconciliation", "VaR Limit Monitor", "Concentration Guard", "Client Onboarding Flow", "Document Acceptance Agent",
    "OFAC Screening Agent", "SAR Filing Assistant", "Provisional Credit Handler", "Reg BI Doc Agent", "Volcker Desk Monitor",
    "Surveillance Exceptions", "Breach Alert Agent", "Exception Triage", "Retention & Audit Agent", "CTR Threshold Monitor",
    "Structuring Detection", "Beneficial Ownership Verifier", "Chargeback Handler", "Best Interest Assessor", "Concentration Pre-Check",
    "CIP Onboarding", "Single-Name Limit Check", "Desk VaR Monitor", "KYC & AML Onboarding", "ID Verification Standards",
    "Sanctions Screening", "30-Day SAR Procedures", "Reg E Timeframes", "Suitability Documentation", "Market-Making Compliance",
    "Front-Running Monitor", "15-Min Breach Escalation", "1-Hour Critical Triage", "7-Year Retention", "Equities Concentration Policy",
    "Fixed Income VaR", "FX Desk Limits", "Commodities Limits", "Retail Dispute Rules", "Wealth Suitability Matrix",
    "Institutional KYC", "Prime Brokerage Limits", "Securities Services KYC", "Trade Finance AML", "Structured Products Suitability",
    "Equity Research Compliance", "Derivatives Desk Limits", "Collateral Document Check", "Valuation Control Agent", "Model Risk Reviewer",
    "Operational Risk Reporter", "Credit Risk Monitor", "Market Risk Reporter", "Regional EMEA Ops", "Regional APAC Ops",
    "Group Finance Reporter", "Group Risk Reporter",
]
# Real-world agent descriptions (varied, no repeated "Provides... for this line of business")
REAL_WORLD_AGENT_DESCRIPTIONS = [
    "Optimizes portfolio construction and performance attribution for institutional clients.",
    "Monitors trading activity in real time; flags potential market abuse and policy breaches.",
    "Verifies customer identity and documents per CIP; supports onboarding and periodic refresh.",
    "Guides new customers through digital onboarding and collects required KYC/AML information.",
    "Triages AML alerts for the Americas; escalates to compliance per severity and SLA.",
    "Assesses product suitability and documents recommendations under Reg BI and firm policy.",
    "Automates trade and position reconciliation; resolves breaks and settlement instructions.",
    "Produces risk and control reports for desk heads, risk, and regulatory submissions.",
    "Runs policy and regulatory checks on processes, content, and third-party integrations.",
    "Generates client-facing reports and dashboards from approved data sources only.",
    "Validates identity and corporate documents per CIP; rejects expired or non-conforming docs.",
    "Enforces pre-trade concentration and single-name limits per desk and product.",
    "Validates post-trade breaks and settlement instructions before release to custodian.",
    "Monitors intraday VaR and limit usage; escalates breaches within 15 minutes.",
    "Triages exceptions per severity; routes critical items to compliance and risk within 1 hour.",
    "Resolves Reg E and network disputes; applies provisional credit and final determination rules.",
    "Verifies customer identity via documentary and non-documentary methods per CIP.",
    "Monitors transactions for suspicious patterns; supports SAR identification and filing.",
    "Prepares and submits regulatory reports per jurisdiction and filing calendar.",
    "Maintains immutable audit trail and lineage for governance and regulatory exams.",
    "Wealth and advisory portfolio analytics and client reporting.",
    "Markets surveillance for front-running, wash sales, and other abusive patterns.",
    "Customer Identification Program verification and document acceptance.",
    "End-to-end digital onboarding with identity and address verification.",
    "AML alert triage runbook; CTR and structuring thresholds applied by region.",
    "Reg BI suitability assessment and documentation for retail recommendations.",
    "Settlement and reconciliation for cash and securities; break resolution.",
    "Risk metrics and control reporting for management and regulators.",
    "Compliance checks across trading, onboarding, and reporting workflows.",
    "Advisory and operations report generation from approved sources.",
    "Corporate and beneficial ownership document verification.",
    "Pre-trade concentration and VaR checks; blocks orders that breach limits.",
    "Post-trade break validation and settlement instruction checks.",
    "Intraday limit monitoring with 15-minute breach escalation.",
    "Exception routing by severity; critical to compliance/risk within 1 hour.",
    "Reg E dispute handling; provisional credit and final determination timeframes.",
    "CIP identity verification; synthetic and fraud indicators flagged.",
    "SAR triage and escalation; filing within 30 days; no disclosure to subject.",
    "Regulatory filing preparation and submission per jurisdiction.",
    "Audit trail and record retention per policy (e.g. 7 years).",
    "North America KYC and onboarding support.",
    "EMEA trade surveillance and exception monitoring.",
    "APAC limit monitoring and breach escalation.",
    "Americas AML alert triage and escalation.",
    "Global suitability and best-interest assessment.",
    "Prime brokerage reconciliation and position breaks.",
    "VaR and risk limit monitoring by desk.",
    "Concentration and single-name limit enforcement.",
    "Client onboarding and CIP documentation collection.",
    "Document acceptance and verification standards.",
    "OFAC and sanctions screening before onboarding and ongoing.",
    "SAR escalation and filing procedures; 30-day timeline.",
    "Reg E provisional credit and final determination handling.",
    "Reg BI suitability documentation and care obligation.",
    "Volcker desk and product limit compliance.",
    "Trade surveillance exception review and escalation.",
    "Limit breach alerting and remediation logging.",
    "Exception handling and escalation by severity.",
    "Record retention and audit governance.",
    "CTR threshold monitoring and reporting.",
    "Structuring detection and SAR referral.",
    "Beneficial ownership identification and verification.",
    "Chargeback and dispute handling per network rules.",
    "Best interest and suitability assessment.",
    "Pre-trade concentration check and block.",
    "CIP requirements and onboarding verification.",
    "Single-name and sector concentration limits.",
    "Desk VaR and risk limit monitoring.",
    "KYC and AML onboarding for new clients.",
    "ID verification and document standards.",
    "Sanctions screening and block/report.",
    "SAR procedures and 30-day filing.",
    "Reg E timeframes and provisional credit.",
    "Suitability and recommendation documentation.",
    "Market-making and hedging compliance.",
    "Front-running and abusive pattern detection.",
    "15-minute breach escalation to risk.",
    "Critical exception 1-hour escalation.",
    "7-year retention and audit trail.",
    "Equities concentration and single-name limits.",
    "Fixed income VaR and desk limits.",
    "FX desk limit monitoring.",
    "Commodities limit and breach handling.",
    "Retail dispute and Reg E handling.",
    "Wealth suitability matrix and documentation.",
    "Institutional KYC and onboarding.",
    "Prime brokerage limit and exposure.",
    "Securities services KYC and AML.",
    "Trade finance AML and screening.",
    "Structured products suitability.",
    "Equity research compliance and disclosure.",
    "Derivatives desk limits and Volcker.",
    "Collateral and document verification.",
    "Valuation control and independent price.",
    "Model risk review and validation.",
    "Operational risk reporting.",
    "Credit risk monitoring and reporting.",
    "Market risk reporting and limits.",
    "EMEA regional operations support.",
    "APAC regional operations support.",
    "Group finance reporting.",
    "Group risk reporting.",
]

# Regions and variants for context/prompt names (real-world style: region + topic + variant)
REGIONS = ["APAC", "EMEA", "Americas", "North America", "LATAM", "Global", "UK", "EU", "Asia", "NA Retail", "NA Markets"]
CONTEXT_VARIANTS = ["2024", "2025", "Q1", "Q2", "H1", "v2", "Retail", "Wealth", "Markets", "Institutional", "Policy", "Runbook", "Standard"]
PROMPT_VARIANTS = ["Playbook", "Runbook", "Standard", "Guide", "Tier 1", "Tier 2", "Americas", "EMEA", "APAC", "v1", "v2"]

# Real-world usernames (deterministic pick by index for created_by, approved_by, submitted_by)
REAL_WORLD_USERNAMES = [
    "alice.wong", "bob.chen", "carol.santos", "dave.kim", "jane.smith", "mike.jones", "sarah.wilson",
    "james.lee", "priya.sharma", "alex.martinez", "emma.davis", "ryan.nguyen", "olivia.brown",
    "daniel.garcia", "sophia.patel", "chris.taylor", "jennifer.lopez", "david.park", "amy.zhang", "kevin.oconnor",
]

PROMPT_SYSTEMS = [
    "You are a helpful customer support agent. Be polite, professional, and empathetic.",
    "You are a KYC verification agent. Review and validate customer identity documents.",
    "You are an AML alert triage agent. Triage and escalate alerts for compliance review.",
    "You are a pre-trade compliance agent. Enforce limits and concentration checks.",
    "You are a suitability advisor. Assess product suitability and document recommendations.",
    "You are a dispute resolution agent. Resolve disputes per Reg E and network rules.",
    "You are a client reporting agent. Generate clear, accurate client reports.",
    "You are a limit monitoring agent. Monitor limits and escalate breaches.",
    "You are a document review agent. Validate documents per policy.",
    "You are a regulatory reporting agent. Prepare accurate regulatory submissions.",
    "You are an exception handling agent. Triage and escalate per procedures.",
    "You are an identity verification agent. Verify identity per CIP requirements.",
    "You are a transaction review agent. Review transactions for suspicious activity.",
    "You maintain audit trail and lineage. Record decisions and rationale.",
    "You are a risk reporting agent. Produce accurate risk and control reports.",
]

# Real-world context content (JSONB): policy text, limits, procedures. One per topic type.
CONTEXT_CONTENT_SAMPLES = [
    {"policyName": "Pre-Trade Limits Policy", "effectiveDate": "2024-01-01", "varLimit": 5000000, "singleNameLimit": 500000, "desk": "equities", "sections": [{"title": "Concentration", "body": "Single-name concentration must not exceed 5% of portfolio. Breaches must be reported within 15 minutes."}, {"title": "VaR", "body": "VaR limit $10M at 99% 1-day. Escalate to risk and compliance on breach."}]},
    {"policyName": "AML Transaction Monitoring", "effectiveDate": "2024-01-01", "ctrThreshold": 10000, "structuringThreshold": 3000, "sections": [{"title": "CTR", "body": "Cash equivalents over $10,000 in a single day require Currency Transaction Report."}, {"title": "Structuring", "body": "Multiple transactions below $3,000 within 24 hours are flagged for SAR review. Do not advise customers on structuring."}]},
    {"policyName": "KYC Identity Verification", "effectiveDate": "2024-01-01", "acceptableId": ["government-issued photo ID"], "addressVerificationDays": 90, "sections": [{"title": "CIP", "body": "Customer Identification Program: government-issued photo ID required. Address verification: utility bill or bank statement within 90 days."}, {"title": "Beneficial ownership", "body": "For entities, beneficial ownership 25% or more must be identified and verified."}]},
    {"policyName": "Dispute Resolution", "effectiveDate": "2024-01-01", "provisionalCreditDays": 10, "sections": [{"title": "Reg E", "body": "Reg E dispute timeframes: provisional credit within 10 business days for debit errors. Final determination within 45 days."}, {"title": "Network rules", "body": "Follow Visa/Mastercard chargeback timeframes where applicable."}]},
    {"policyName": "Suitability and Best Interest", "effectiveDate": "2024-01-01", "risk_tiers": ["conservative", "moderate", "growth", "aggressive"], "suitability_required": True, "sections": [{"title": "Reg BI", "body": "Recommendations must be in the best interest of the retail customer. Document suitability and care obligation."}]},
    {"policyName": "Pre-Trade Compliance", "effectiveDate": "2024-01-01", "concentrationLimitPct": 5, "sections": [{"title": "Concentration checks", "body": "Pre-trade concentration and single-name limits per desk policy. Block orders that would breach limits."}]},
    {"policyName": "Customer Identification Program", "effectiveDate": "2024-01-01", "sections": [{"title": "CIP requirements", "body": "Obtain name, date of birth, address, and identification number before opening an account. Verify through documentary or non-documentary methods."}]},
    {"policyName": "Concentration Limits", "effectiveDate": "2024-01-01", "singleNameLimitPct": 5, "sectorLimitPct": 25, "sections": [{"title": "Limits", "body": "Single-name concentration max 5%; sector concentration max 25%. Breach requires risk approval."}]},
    {"policyName": "VaR and Risk Limits", "effectiveDate": "2024-01-01", "varLimit": 10000000, "varConfidence": 0.99, "sections": [{"title": "VaR", "body": "VaR and risk limits by desk. 1-day 99% VaR limit as defined per desk. Intraday breaches escalate to risk."}]},
    {"policyName": "Client Onboarding", "effectiveDate": "2024-01-01", "sections": [{"title": "Onboarding", "body": "Client onboarding and CIP documentation. Collect KYC and AML information. Beneficial ownership for entities."}]},
    {"policyName": "Document Acceptance", "effectiveDate": "2024-01-01", "sections": [{"title": "Standards", "body": "Document acceptance and verification standards. Accept only originals or certified copies for identity. No expired IDs."}]},
    {"policyName": "OFAC and Sanctions", "effectiveDate": "2024-01-01", "sections": [{"title": "Screening", "body": "OFAC and sanctions screening rules. Screen all parties before onboarding and on ongoing basis. Block and report matches."}]},
    {"policyName": "SAR Escalation", "effectiveDate": "2024-01-01", "sections": [{"title": "Procedures", "body": "SAR escalation and filing procedures. File within 30 days of detection. Do not disclose SAR filing to the subject."}]},
    {"policyName": "Reg E Timeframes", "effectiveDate": "2024-01-01", "provisionalCreditDays": 10, "finalDeterminationDays": 45, "sections": [{"title": "Dispute timeframes", "body": "Reg E dispute timeframes and provisional credit. Debit errors: 10 business days provisional credit; 45 days final."}]},
    {"policyName": "Reg BI Suitability", "effectiveDate": "2024-01-01", "sections": [{"title": "Documentation", "body": "Reg BI and suitability documentation. Document recommendation rationale and customer profile. Care, conflict, and compliance obligations."}]},
    {"policyName": "Volcker Rule", "effectiveDate": "2024-01-01", "sections": [{"title": "Desk limits", "body": "Volcker Rule desk and product limits. No proprietary trading; permitted market-making and hedging per policy."}]},
    {"policyName": "Trade Surveillance", "effectiveDate": "2024-01-01", "sections": [{"title": "Monitoring", "body": "Trade surveillance and exception monitoring. Monitor for front-running, wash sales, and other abusive patterns. Escalate to compliance."}]},
    {"policyName": "Limit Monitoring", "effectiveDate": "2024-01-01", "sections": [{"title": "Intraday", "body": "Intraday limit monitoring and breach alerts. Escalate breaches within 15 minutes. Log all breaches."}]},
    {"policyName": "Exception Handling", "effectiveDate": "2024-01-01", "sections": [{"title": "Escalation", "body": "Exception handling and escalation procedures. Triage by severity. Critical exceptions to compliance and risk within 1 hour."}]},
    {"policyName": "Audit and Retention", "effectiveDate": "2024-01-01", "retentionYears": 7, "sections": [{"title": "Retention", "body": "Audit trail and record retention requirements. Retain records per regulatory minimum (e.g. 7 years). Immutable audit log for governance."}]},
    {"policyName": "EMEA Pre-Trade Limits", "effectiveDate": "2024-06-01", "varLimit": 8000000, "singleNameLimit": 400000, "desk": "fixed_income", "sections": [{"title": "Concentration", "body": "Single-name limit 4% of AUM. Sector limit 20%. Breach reported within 10 minutes."}, {"title": "VaR", "body": "1-day 99% VaR limit €8M. Escalate to risk on breach."}]},
    {"policyName": "APAC AML Thresholds", "effectiveDate": "2024-03-01", "ctrThreshold": 15000, "structuringThreshold": 2500, "sections": [{"title": "CTR", "body": "Cash equivalents over $15,000 in a single day require CTR. Local currency equivalents apply."}, {"title": "Structuring", "body": "Multiple transactions below $2,500 within 24 hours flagged for SAR. Do not advise on structuring."}]},
    {"policyName": "Americas KYC Standards", "effectiveDate": "2024-02-01", "acceptableId": ["passport", "driver license"], "addressVerificationDays": 60, "sections": [{"title": "CIP", "body": "Passport or state-issued driver license required. Address verification within 60 days."}, {"title": "Beneficial ownership", "body": "Entities: beneficial owners at 25% or more must be identified and verified per FinCEN CDD rule."}]},
    {"policyName": "LATAM Dispute Handling", "effectiveDate": "2024-04-01", "provisionalCreditDays": 5, "sections": [{"title": "Reg E", "body": "Provisional credit within 5 business days where applicable. Final determination 30 days."}, {"title": "Local rules", "body": "Follow local consumer protection and network rules."}]},
    {"policyName": "Wealth Suitability Policy", "effectiveDate": "2024-01-15", "risk_tiers": ["capital preservation", "income", "balanced", "growth", "aggressive"], "suitability_required": True, "sections": [{"title": "Reg BI", "body": "Recommendations in best interest of retail customer. Document suitability and care. Conflict disclosure."}]},
    {"policyName": "Markets Concentration Limits", "effectiveDate": "2024-05-01", "concentrationLimitPct": 4, "sections": [{"title": "Pre-trade", "body": "Pre-trade concentration and single-name limits per desk. Block orders breaching limits."}]},
    {"policyName": "Global CIP Requirements", "effectiveDate": "2024-01-01", "sections": [{"title": "Identification", "body": "Obtain name, DOB, address, ID number. Verify via documentary or non-documentary methods. Enhanced due diligence for PEPs."}]},
    {"policyName": "UK Concentration Limits", "effectiveDate": "2024-04-01", "singleNameLimitPct": 6, "sectorLimitPct": 30, "sections": [{"title": "Limits", "body": "Single-name max 6%; sector max 30%. Breach requires risk approval. MiFID II concentration rules apply."}]},
    {"policyName": "EU VaR and Risk Limits", "effectiveDate": "2024-01-01", "varLimit": 12000000, "varConfidence": 0.99, "sections": [{"title": "VaR", "body": "1-day 99% VaR per desk. Intraday breaches escalate to risk. CRR/CRD IV where applicable."}]},
    {"policyName": "Institutional Onboarding", "effectiveDate": "2024-03-01", "sections": [{"title": "Onboarding", "body": "Institutional client onboarding: KYC, AML, beneficial ownership. Entity verification and signatory authority."}]},
    {"policyName": "Document Verification Standards", "effectiveDate": "2024-02-01", "sections": [{"title": "Standards", "body": "Accept originals or certified copies. No expired IDs. Corporate: certificate of incorporation, board resolution."}]},
    {"policyName": "Sanctions Screening Policy", "effectiveDate": "2024-01-01", "sections": [{"title": "Screening", "body": "Screen all parties at onboarding and ongoing. OFAC, UN, EU, local lists. Block and report matches. No exceptions."}]},
    {"policyName": "SAR Filing Procedures", "effectiveDate": "2024-01-01", "sections": [{"title": "Procedures", "body": "File SAR within 30 days of detection. Do not disclose to subject. Document rationale and supporting evidence."}]},
    {"policyName": "Provisional Credit Policy", "effectiveDate": "2024-01-01", "provisionalCreditDays": 10, "finalDeterminationDays": 45, "sections": [{"title": "Reg E", "body": "Debit errors: 10 business days provisional credit; 45 days final. Credit errors: 45 days."}]},
    {"policyName": "Best Interest Documentation", "effectiveDate": "2024-01-01", "sections": [{"title": "Reg BI", "body": "Document recommendation rationale, customer profile, care and conflict obligations. Retain per retention policy."}]},
    {"policyName": "Proprietary Trading Limits", "effectiveDate": "2024-01-01", "sections": [{"title": "Volcker", "body": "No proprietary trading. Permitted market-making and hedging per Volcker rule. Document and monitor."}]},
    {"policyName": "Surveillance Exception Handling", "effectiveDate": "2024-01-01", "sections": [{"title": "Monitoring", "body": "Trade surveillance: front-running, wash sales, spoofing. Exception review and escalation to compliance."}]},
    {"policyName": "Intraday Limit Breach", "effectiveDate": "2024-01-01", "sections": [{"title": "Breach", "body": "Intraday limit breach: escalate within 15 minutes. Log breach and remediation. No override without approval."}]},
    {"policyName": "Critical Exception Escalation", "effectiveDate": "2024-01-01", "sections": [{"title": "Escalation", "body": "Critical exceptions to compliance and risk within 1 hour. Document outcome. Severity matrix per procedure."}]},
    {"policyName": "Record Retention Policy", "effectiveDate": "2024-01-01", "retentionYears": 7, "sections": [{"title": "Retention", "body": "Retain records per regulatory minimum (7 years). Immutable audit log. No alteration or deletion of audit records."}]},
]

# Full real-world prompt content (main instruction text) and system_prompt. One per prompt topic.
PROMPT_FULL_CONTENT = [
    "You are a helpful customer support agent. Be polite, professional, and empathetic. Never share sensitive account information without verification. Escalate to a human when the customer requests or when the issue involves disputes, fraud, or regulatory matters. Do not provide financial, legal, or tax advice.",
    "You are a KYC verification agent. Review and validate customer identity documents per CIP requirements. Accept only valid government-issued photo ID and address verification within 90 days. For entities, identify beneficial owners at 25% or more. Flag suspicious or inconsistent documents for compliance. Do not approve without required documents.",
    "You are an AML alert triage agent. Triage and escalate anti-money laundering alerts for compliance review. Apply CTR and structuring thresholds per policy. Do not disclose that a SAR may or will be filed. Escalate high-risk alerts within 24 hours. Document rationale for all decisions.",
    "You are a pre-trade compliance agent. Enforce pre-trade limits and concentration checks per desk policy. Block orders that would breach single-name or VaR limits. Escalate breaches to risk and compliance. Do not advise on how to circumvent limits.",
    "You are a suitability advisor. Assess product suitability and risk appetite per Reg BI. Document recommendation rationale and customer profile. Ensure recommendations are in the customer's best interest. Do not recommend products that are unsuitable for the customer's profile.",
    "You are a dispute resolution agent. Resolve customer disputes per Reg E and network rules. Follow provisional credit and final determination timeframes. Do not disclose internal escalation or SAR status. Escalate to compliance when required.",
    "You are a client reporting agent. Generate clear, accurate client reports. Use only approved data sources. Do not include MNPI or material non-public information. Ensure reports are consistent with disclosed methodology.",
    "You are a limit monitoring agent. Monitor intraday limits and alert on breaches. Escalate breaches within 15 minutes. Log all breaches and remediation. Do not override limits without approved exception.",
    "You are a document review agent. Validate identity and corporate documents per policy. Accept only originals or certified copies where required. Flag forgeries or inconsistencies. Do not approve expired or invalid documents.",
    "You are a regulatory reporting agent. Prepare accurate regulatory submissions per jurisdiction. Use only approved data and methodology. Do not disclose draft or confidential filings. Meet filing deadlines.",
    "You are an exception handling agent. Triage and escalate exceptions per procedures. Critical exceptions to compliance and risk within 1 hour. Document all exceptions and outcomes. Do not suppress or hide exceptions.",
    "You are an identity verification agent. Verify customer identity per CIP requirements. Use only approved verification methods. Flag synthetic identity or fraud indicators. Do not approve without verification.",
    "You are a transaction review agent. Review transactions for suspicious activity. Apply AML and sanctions screening. Escalate potential SARs. Do not disclose escalation or filing status to the subject.",
    "You maintain audit trail and lineage for governance. Record all material decisions, rationale, and data sources. Ensure immutability and retention per policy. Do not alter or delete audit records.",
    "You are a risk reporting agent. Produce accurate risk and control reports. Use approved models and data. Escalate material breaches and model issues. Do not misrepresent risk metrics.",
    "You are a customer support agent for the Americas. Be polite and professional. Verify identity before sharing account details. Escalate disputes, fraud, or regulatory matters. No financial or legal advice.",
    "You are an EMEA KYC verification agent. Validate identity documents per local CIP. Accept government-issued ID and address proof within 90 days. Beneficial owners 25%+. Flag suspicious docs.",
    "You are an APAC AML triage agent. Apply CTR and structuring thresholds per jurisdiction. Do not disclose SAR filing. Escalate high-risk within 24 hours. Document rationale.",
    "You are a pre-trade compliance agent for Markets. Enforce concentration and VaR limits per desk. Block breaching orders. Escalate to risk. No circumvention advice.",
    "You are a wealth suitability advisor. Assess suitability per Reg BI. Document rationale and customer profile. Best interest only. No unsuitable recommendations.",
    "You are a dispute resolution agent for Retail. Reg E and network rules. Provisional credit and final determination timeframes. No internal escalation disclosure.",
    "You are a client reporting agent. Clear, accurate reports from approved sources only. No MNPI. Methodology consistent with disclosure.",
    "You are an intraday limit monitoring agent. Escalate breaches within 15 minutes. Log breaches and remediation. No override without exception.",
    "You are a document review agent. Validate identity and corporate docs per policy. Originals or certified copies. Flag forgeries. No expired docs.",
    "You are a regulatory reporting agent. Accurate submissions per jurisdiction. Approved data only. No draft disclosure. Meet deadlines.",
    "You are an exception handling agent. Triage by severity. Critical to compliance/risk within 1 hour. Document exceptions. No suppression.",
    "You are an identity verification agent. CIP requirements. Approved methods only. Flag synthetic/fraud. No approval without verification.",
    "You are a transaction review agent. Suspicious activity review. AML and sanctions screening. Escalate SARs. No disclosure to subject.",
    "You maintain audit trail and lineage. Record decisions, rationale, sources. Immutability and retention per policy. No alteration of audit records.",
    "You are a risk reporting agent. Accurate risk and control reports. Approved models and data. Escalate breaches. No misrepresentation of metrics.",
    "You are a North America customer support agent. Polite, professional, empathetic. Verify before sharing account info. Escalate disputes/fraud/regulatory. No financial/legal/tax advice.",
    "You are a UK KYC agent. Verify identity per UK CIP. Government-issued ID and address within 90 days. Beneficial ownership for entities. Flag suspicious.",
    "You are a Global AML triage agent. CTR and structuring thresholds. No SAR disclosure. High-risk escalation 24h. Document rationale.",
    "You are a concentration check agent. Pre-trade single-name and sector limits. Block breaching orders. Escalate to risk.",
    "You are a Reg BI suitability agent. Document recommendation and customer profile. Best interest. No unsuitable products.",
    "You are a chargeback handler. Reg E and network timeframes. No internal/SAR disclosure. Escalate when required.",
    "You are an advisory report agent. Reports from approved sources. No MNPI. Methodology consistent.",
    "You are a breach alert agent. 15-minute escalation. Log all breaches. No override without approval.",
    "You are a corporate doc verifier. Identity and corporate docs per policy. Certified copies. No expired or invalid.",
    "You are a filing agent. Regulatory submissions per jurisdiction. Approved data. No draft disclosure. Deadlines.",
    "You are a critical exception router. 1-hour escalation for critical. Document outcome. No suppression.",
    "You are a CIP verifier. Identity per CIP. Approved methods. Synthetic/fraud flags. No approval without verification.",
    "You are a SAR triage agent. Suspicious activity. AML/sanctions. Escalate SARs. No subject disclosure.",
    "You are an audit logger. Decisions, rationale, sources. Immutable. Retention per policy. No alteration.",
    "You are a risk metrics reporter. Risk and control reports. Approved models. Escalate issues. No misrepresentation.",
]
PROMPT_FULL_SYSTEM = [
    "You are a customer support specialist. Be helpful and compliant.",
    "You are a KYC verification specialist. Verify identity per CIP.",
    "You are an AML triage specialist. Triage and escalate per policy.",
    "You are a pre-trade compliance specialist. Enforce limits.",
    "You are a suitability advisor. Act in the customer's best interest.",
    "You are a dispute resolution specialist. Follow Reg E and network rules.",
    "You are a client reporting specialist. Produce accurate reports.",
    "You are a limit monitoring specialist. Monitor and escalate breaches.",
    "You are a document review specialist. Validate per policy.",
    "You are a regulatory reporting specialist. Prepare accurate submissions.",
    "You are an exception handling specialist. Triage and escalate.",
    "You are an identity verification specialist. Verify per CIP.",
    "You are a transaction review specialist. Review for suspicious activity.",
    "You maintain audit trail and lineage. Record decisions and rationale.",
    "You are a risk reporting specialist. Report risk and control accurately.",
    "You are a customer support specialist (Americas). Helpful and compliant.",
    "You are a KYC specialist (EMEA). Verify identity per CIP.",
    "You are an AML triage specialist (APAC). Triage and escalate.",
    "You are a pre-trade specialist (Markets). Enforce limits.",
    "You are a suitability specialist (Wealth). Best interest.",
    "You are a dispute specialist (Retail). Reg E and network rules.",
    "You are a client reporting specialist. Accurate reports.",
    "You are a limit specialist. Escalate breaches.",
    "You are a document specialist. Validate per policy.",
    "You are a regulatory specialist. Accurate submissions.",
    "You are an exception specialist. Triage and escalate.",
    "You are an identity specialist. Verify per CIP.",
    "You are a transaction specialist. Suspicious activity.",
    "You maintain audit and lineage. Record and retain.",
    "You are a risk specialist. Report accurately.",
    "You are a North America support specialist.",
    "You are a UK KYC specialist.",
    "You are a Global AML triage specialist.",
    "You are a concentration check specialist.",
    "You are a Reg BI suitability specialist.",
    "You are a chargeback specialist.",
    "You are an advisory report specialist.",
    "You are a breach alert specialist.",
    "You are a corporate doc specialist.",
    "You are a filing specialist.",
    "You are a critical exception specialist.",
    "You are a CIP verifier specialist.",
    "You are a SAR triage specialist.",
    "You are an audit logger specialist.",
    "You are a risk metrics specialist.",
]


def slug(s: str) -> str:
    return s.lower().replace(" ", "-").replace("&", "and").replace(",", "").replace(".", "").replace("'", "")


def pick(items: tuple | list, index: int) -> str:
    return items[index % len(items)]


def sha64(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:64]


def real_world_agent_name(k: int, org_display: str) -> str:
    """Unique real-world agent name; avoids repeated 'Org + Role' pattern."""
    base = pick(REAL_WORLD_AGENT_NAMES, k)
    if k < len(REAL_WORLD_AGENT_NAMES):
        return base
    return "{} — {}".format(base, org_display)


def real_world_agent_description(k: int) -> str:
    """Unique real-world agent description."""
    return pick(REAL_WORLD_AGENT_DESCRIPTIONS, k)


def real_world_context_name(k: int) -> str:
    """Unique real-world context name: region-topic-variant-id (no stem-0, stem-1)."""
    region = pick(REGIONS, k)
    topic = pick(CONTEXT_TOPICS, k)
    variant = pick(CONTEXT_VARIANTS, k // 2)
    base = "{}-{}-{}".format(slug(region), slug(topic), slug(variant))
    return "{}-{:04d}".format(base, k)  # unique for 10k+ contexts


def real_world_context_description(k: int) -> str:
    """Varied context description."""
    desc = pick(CONTEXT_DESCRIPTIONS, k)
    region = pick(REGIONS, k)
    if k % 3 == 0:
        return "{} ({}).".format(desc.rstrip("."), region)
    return desc


def real_world_prompt_name(k: int) -> str:
    """Unique real-world prompt name: region-stem-variant-id."""
    region = pick(REGIONS, k)
    variant = pick(PROMPT_VARIANTS, k // 2)
    stem = pick(PROMPT_NAME_STEMS, k)
    base = "{}-{}-{}".format(slug(region), stem, slug(variant))
    return "{}-{:04d}".format(base, k)  # unique for 5k+ prompts


def real_world_prompt_description(k: int) -> str:
    """Varied prompt description (no repeated 'System prompt for X')."""
    topic = pick(PROMPT_TOPICS, k).replace("-", " ")
    region = pick(REGIONS, k)
    templates = [
        "{} playbook for {}.",
        "Standard instructions for {} ({}).",
        "{} runbook — {}.",
        "Governed system prompt for {} in {}.",
    ]
    t = pick(templates, k)
    if "{}" in t and t.count("{}") == 2:
        return t.format(topic, region)
    if "{}" in t and t.count("{}") == 1:
        return t.format(topic)
    return "System prompt for {} ({}).".format(topic, region)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate real-world scale seed data.")
    parser.add_argument("--orgs", type=int, default=int(os.environ.get("SEED_ORGS", DEFAULT_ORGS)))
    parser.add_argument("--agents", type=int, default=int(os.environ.get("SEED_AGENTS", DEFAULT_AGENTS)))
    parser.add_argument("--prompts", type=int, default=int(os.environ.get("SEED_PROMPTS", DEFAULT_PROMPTS)))
    parser.add_argument("--contexts", type=int, default=int(os.environ.get("SEED_CONTEXTS", DEFAULT_CONTEXTS)))
    args = parser.parse_args()
    n_orgs = max(1, args.orgs)
    n_agents = max(1, args.agents)
    n_prompts = max(1, args.prompts)
    n_contexts = max(1, args.contexts)

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    url = get_database_url()
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Resolve root org (must exist from init or data/sandarb.sql)
        cur.execute("SELECT id FROM organizations WHERE is_root = true LIMIT 1")
        root_row = cur.fetchone()
        if not root_row:
            print("No root organization found. Run init_postgres (and optionally load data/sandarb.sql) first.", file=sys.stderr)
            sys.exit(1)
        root_id = root_row[0]

        # 1. Organizations (root exists; add children up to n_orgs)
        cur.execute("SELECT COUNT(*) FROM organizations")
        existing_orgs = cur.fetchone()[0]
        if existing_orgs < n_orgs:
            for i in range(existing_orgs, n_orgs):
                name = pick(ORG_NAMES, i) if i < len(ORG_NAMES) else "Division {}".format(i + 1)
                desc = pick(ORG_DESCRIPTIONS, i) if i < len(ORG_DESCRIPTIONS) else "Organization unit {}.".format(i + 1)
                sl = "root" if i == 0 else slug(name)
                cur.execute(
                    "INSERT INTO organizations (id, name, slug, description, parent_id, is_root) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (slug) DO NOTHING",
                    (str(uuid.uuid4()), name, sl, desc, root_id, i == 0),
                )
            conn.commit()
            print(f"Organizations: ensured {n_orgs} (added {n_orgs - existing_orgs})")
        else:
            print(f"Organizations: already {existing_orgs}")

        # 2. Agents (spread across orgs; real-world names)
        cur.execute("SELECT id, slug FROM organizations WHERE is_root = false ORDER BY slug LIMIT %s", (n_orgs,))
        org_rows = cur.fetchall()
        if not org_rows:
            org_rows = [(root_id, "root")]
        cur.execute("SELECT COUNT(*) FROM agents")
        existing_agents = cur.fetchone()[0]
        agents_to_add = max(0, n_agents - existing_agents)
        if agents_to_add > 0:
            batch = []
            for k in range(agents_to_add):
                o_idx = k % len(org_rows)
                org_id, org_slug = org_rows[o_idx]
                org_display = ROOT_ORG_NAME if org_slug == "root" else org_rows[o_idx][1].replace("-", " ").title()
                name = real_world_agent_name(k, org_display)
                desc = real_world_agent_description(k)
                agent_slug = slug(name)
                agent_id_val = "{}-{}".format(org_slug, agent_slug)
                a2a_url = "https://agents.sandarb-demo.com/{}/{}".format(org_slug, agent_slug)
                approval = "approved" if k % 3 != 2 else "draft"
                reg = pick(REG_SCOPES, k)
                data_scope = pick(DATA_SCOPES, k)
                pii = (k % 2 == 0)
                u = pick(REAL_WORLD_USERNAMES, k)
                approver = f"@{u}" if approval == "approved" else None
                approved_at = datetime.now(timezone.utc) if approver else None
                batch.append((
                    str(uuid.uuid4()), org_id, agent_id_val, name, desc, a2a_url,
                    approval, approver, approved_at,
                    f"@{u}", f"@{u}" if approval == "approved" else None,
                    '["llm","api"]' if k % 3 == 0 else '["llm","api","db"]', data_scope, pii, reg,
                ))
                if len(batch) >= 200:
                    for row in batch:
                        cur.execute("""
                            INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, approval_status, approved_by, approved_at, created_by, submitted_by, tools_used, allowed_data_scopes, pii_handling, regulatory_scope)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)
                            ON CONFLICT (org_id, agent_id) DO NOTHING
                        """, (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13], row[14]))
                    batch = []
            for row in batch:
                cur.execute("""
                    INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, approval_status, approved_by, approved_at, created_by, submitted_by, tools_used, allowed_data_scopes, pii_handling, regulatory_scope)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)
                    ON CONFLICT (org_id, agent_id) DO NOTHING
                """, (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13], row[14]))
            conn.commit()
            print(f"Agents: added up to {agents_to_add} (total target {n_agents})")
        else:
            print(f"Agents: already {existing_agents}")

        # 3. Contexts (real-world names and one version each)
        cur.execute("SELECT COUNT(*) FROM contexts")
        existing_ctx = cur.fetchone()[0]
        contexts_to_add = max(0, n_contexts - existing_ctx)
        if contexts_to_add > 0:
            lobs = LOB_TAGS
            for k in range(contexts_to_add):
                name = real_world_context_name(k)
                desc = real_world_context_description(k)
                lob = pick(lobs, k)
                data_cls = pick(DATA_CLASS, k)
                tags_json = json.dumps([topic.replace("-", "_"), lob.lower()])
                reg_json = json.dumps(["FINRA", "SEC"] if k % 2 == 0 else ["BSA", "Reg E"])
                cur.execute("""
                    INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks)
                    VALUES (%s, %s, %s, %s, %s, 'system', %s, %s)
                    ON CONFLICT (name) DO NOTHING
                """, (str(uuid.uuid4()), name, desc, lob, data_cls, tags_json, reg_json))
            conn.commit()
            # Context versions (one v1.0.0 per context we just care about; do for all contexts for simplicity)
            cur.execute("SELECT c.id, c.name FROM contexts c WHERE NOT EXISTS (SELECT 1 FROM context_versions cv WHERE cv.context_id = c.id)")
            new_ctx = cur.fetchall()
            for idx, (ctx_id, ctx_name) in enumerate(new_ctx):
                content = pick(CONTEXT_CONTENT_SAMPLES, idx) if CONTEXT_CONTENT_SAMPLES else {"policy": f"Policy {ctx_name}", "effectiveDate": "2024-01-01"}
                content_json = json.dumps(content)
                h = sha64(content_json)
                approver_u = pick(REAL_WORLD_USERNAMES, hash(ctx_name) % (2**31))
                cur.execute("""
                    INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, submitted_by, status, commit_message, approved_by, approved_at, is_active)
                    VALUES (%s, %s, 'v1.0.0', %s::jsonb, %s, 'system', 'system', 'Approved', 'Initial version', %s, NOW(), true)
                    ON CONFLICT (context_id, version_label) DO NOTHING
                """, (str(uuid.uuid4()), ctx_id, content_json, h, f"@{approver_u}"))
            conn.commit()
            print(f"Contexts: added {contexts_to_add} with versions (target {n_contexts})")
        else:
            print(f"Contexts: already {existing_ctx}")

        # 4. Prompts (real-world names and one approved version each)
        cur.execute("SELECT COUNT(*) FROM prompts")
        existing_pr = cur.fetchone()[0]
        prompts_to_add = max(0, n_prompts - existing_pr)
        if prompts_to_add > 0:
            for k in range(prompts_to_add):
                name = real_world_prompt_name(k)
                desc = real_world_prompt_description(k)
                tags_json = json.dumps([topic, "governance"])
                created_u = pick(REAL_WORLD_USERNAMES, k)
                cur.execute("""
                    INSERT INTO prompts (id, name, description, tags, created_by)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (name) DO NOTHING
                """, (str(uuid.uuid4()), name, desc, tags_json, f"@{created_u}"))
            conn.commit()
            cur.execute("SELECT p.id, p.name FROM prompts p WHERE NOT EXISTS (SELECT 1 FROM prompt_versions pv WHERE pv.prompt_id = p.id)")
            new_prompts = cur.fetchall()
            for idx, (pr_id, pr_name) in enumerate(new_prompts):
                content = pick(PROMPT_FULL_CONTENT, idx) if PROMPT_FULL_CONTENT else (pick(PROMPT_SYSTEMS, idx) + " Never share sensitive data without verification. Do not provide financial advice.")
                sys_p = pick(PROMPT_FULL_SYSTEM, idx) if PROMPT_FULL_SYSTEM else pick(PROMPT_SYSTEMS, idx)
                h = sha64(content)
                ver_u = pick(REAL_WORLD_USERNAMES, hash(pr_name) % (2**31))
                cur.execute("""
                    INSERT INTO prompt_versions (id, prompt_id, version, content, system_prompt, model, status, approved_by, approved_at, sha256_hash, created_by, submitted_by, commit_message)
                    VALUES (%s, %s, 1, %s, %s, 'gpt-4', 'approved', %s, NOW(), %s, %s, %s, 'Initial prompt')
                    ON CONFLICT (prompt_id, version) DO NOTHING
                """, (str(uuid.uuid4()), pr_id, content, sys_p, f"@{ver_u}", h, f"@{ver_u}", f"@{ver_u}"))
            conn.commit()
            cur.execute("UPDATE prompts SET current_version_id = (SELECT id FROM prompt_versions pv WHERE pv.prompt_id = prompts.id ORDER BY version DESC LIMIT 1) WHERE current_version_id IS NULL")
            conn.commit()
            print(f"Prompts: added {prompts_to_add} with versions (target {n_prompts})")
        else:
            print(f"Prompts: already {existing_pr}")

        # 5. Agent–Context and Agent–Prompt links (Governance serves prompt/context by linking to the calling agent)
        cur.execute("SELECT 1 FROM agent_contexts LIMIT 1")
        has_agent_contexts = cur.fetchone() is not None
        if not has_agent_contexts:
            cur.execute("SELECT id FROM agents ORDER BY created_at LIMIT %s", (min(n_agents, 5000),))
            agent_ids = [r[0] for r in cur.fetchall()]
            cur.execute("SELECT id FROM contexts ORDER BY name LIMIT %s", (min(n_contexts, 2000),))
            context_ids = [r[0] for r in cur.fetchall()]
            cur.execute("SELECT id FROM prompts ORDER BY name LIMIT %s", (min(n_prompts, 2000),))
            prompt_ids = [r[0] for r in cur.fetchall()]
            links_ctx = 0
            links_pr = 0
            for i, a_id in enumerate(agent_ids):
                # Each agent gets a few contexts and prompts (deterministic) so inject/pull work
                for j in range(min(5, len(context_ids))):
                    c_id = context_ids[(i + j) % len(context_ids)]
                    cur.execute(
                        "INSERT INTO agent_contexts (agent_id, context_id) VALUES (%s, %s) ON CONFLICT (agent_id, context_id) DO NOTHING",
                        (a_id, c_id),
                    )
                    links_ctx += cur.rowcount
                for j in range(min(5, len(prompt_ids))):
                    p_id = prompt_ids[(i + j) % len(prompt_ids)]
                    cur.execute(
                        "INSERT INTO agent_prompts (agent_id, prompt_id) VALUES (%s, %s) ON CONFLICT (agent_id, prompt_id) DO NOTHING",
                        (a_id, p_id),
                    )
                    links_pr += cur.rowcount
            conn.commit()
            print(f"Agent links: added {links_ctx} agent-context and {links_pr} agent-prompt links")
        else:
            print("Agent links: already populated")

        # Activity log for new contexts (sample; no unique constraint so insert only if we want to avoid dupes we could skip)
        cur.execute("SELECT COUNT(*) FROM activity_log")
        if cur.fetchone()[0] < 1000:
            cur.execute("SELECT id, name FROM contexts ORDER BY created_at DESC NULLS LAST LIMIT 1000")
            for ctx_id, ctx_name in cur.fetchall():
                cur.execute("INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_by) VALUES (%s, 'create', 'context', %s, %s, 'system')", (str(uuid.uuid4()), str(ctx_id), ctx_name))
            conn.commit()
        print("Activity log: sample entries ensured")
    except Exception as e:
        conn.rollback()
        print(f"seed_scale failed: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
