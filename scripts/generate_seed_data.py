#!/usr/bin/env python3
"""
Generate realistic seed data for Sandarb AI Governance Agent platform.
Outputs SQL to project_root/data/sandarb.sql

Counts (configurable via CLI or env):
  ORGS=55, AGENTS=950, PROMPTS=2100, CONTEXTS=3200

Naming rules — Sandarb Resource Names (SRN), inspired by URNs (Uniform Resource Names):
  - Agents:   agent.{kebab-case-name}    e.g. agent.retail-banking-kyc-verification-bot-0001
  - Prompts:  prompt.{kebab-case-name}   e.g. prompt.americas-customer-support-playbook-0001
  - Contexts: context.{kebab-case-name}  e.g. context.americas-refund-policy
  - All names/slugs are strictly lowercase kebab-case
  - No double hyphens (--) or underscores
  - Realistic FinTech/Banking terminology

Usage:
  python scripts/generate_seed_data.py
  python scripts/generate_seed_data.py --orgs 55 --agents 950 --prompts 2100 --contexts 3200
"""

import argparse
import hashlib
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Defaults
DEFAULT_ORGS = 55
DEFAULT_AGENTS = 950
DEFAULT_PROMPTS = 2100
DEFAULT_CONTEXTS = 3200

# Output path
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "data" / "sandarb.sql"

# ============================================================================
# REALISTIC FINTECH/BANKING DATA BUILDING BLOCKS
# ============================================================================

# Organization divisions and departments (will be combined for variety)
ORG_DIVISIONS = [
    "retail-banking", "investment-banking", "wealth-management", "private-banking",
    "commercial-banking", "corporate-banking", "asset-management", "treasury",
    "risk-management", "compliance", "legal", "operations", "technology",
    "markets-trading", "fixed-income", "equities", "derivatives", "fx-commodities",
    "prime-brokerage", "securities-services", "client-onboarding", "documentation",
    "collateral-management", "valuation-control", "model-risk", "credit-risk",
    "market-risk", "operational-risk", "internal-audit", "regulatory-reporting",
    "financial-crime", "aml-compliance", "sanctions-screening", "fraud-prevention",
]

ORG_REGIONS = [
    "americas", "emea", "apac", "global", "north-america", "latam", "uk", "europe",
    "asia-pacific", "middle-east", "africa",
]

ORG_DESCRIPTIONS = {
    "retail-banking": "Consumer deposits, lending, branch operations, and digital banking channels.",
    "investment-banking": "M&A advisory, capital markets, underwriting, and corporate finance.",
    "wealth-management": "Private banking and portfolio management for high-net-worth clients.",
    "private-banking": "Exclusive banking services for ultra-high-net-worth individuals and families.",
    "commercial-banking": "Banking services for mid-market and corporate clients.",
    "corporate-banking": "Large corporate and institutional banking relationships.",
    "asset-management": "Institutional asset management and fund administration.",
    "treasury": "Liquidity management, funding, and balance sheet optimization.",
    "risk-management": "Enterprise risk oversight, limits, and risk appetite framework.",
    "compliance": "Regulatory compliance, policy, and control framework.",
    "legal": "Legal affairs, contracts, and regulatory liaison.",
    "operations": "Back-office, settlements, and operational processes.",
    "technology": "Technology infrastructure, platforms, and digital transformation.",
    "markets-trading": "Sales, trading, and market-making across asset classes.",
    "fixed-income": "Fixed income sales, trading, and research.",
    "equities": "Equity sales, trading, and research.",
    "derivatives": "Derivatives trading and structuring.",
    "fx-commodities": "Foreign exchange and commodities trading.",
    "prime-brokerage": "Prime services for hedge funds and institutional clients.",
    "securities-services": "Custody, clearing, and securities administration.",
    "client-onboarding": "KYC, CIP, and client lifecycle management.",
    "documentation": "Legal documentation and contract management.",
    "collateral-management": "Collateral optimization and margin management.",
    "valuation-control": "Independent price verification and valuation governance.",
    "model-risk": "Model validation, governance, and risk assessment.",
    "credit-risk": "Credit risk assessment, limits, and portfolio management.",
    "market-risk": "Market risk measurement, VaR, and stress testing.",
    "operational-risk": "Operational risk identification and control assessment.",
    "internal-audit": "Internal audit and assurance services.",
    "regulatory-reporting": "Regulatory filings and disclosure management.",
    "financial-crime": "Financial crime prevention and investigation.",
    "aml-compliance": "Anti-money laundering program and transaction monitoring.",
    "sanctions-screening": "Sanctions and watchlist screening operations.",
    "fraud-prevention": "Fraud detection, prevention, and investigation.",
}

# Agent roles and types
AGENT_ROLES = [
    "kyc-verification-bot", "aml-triage-agent", "trade-surveillance-agent",
    "customer-support-assistant", "onboarding-assistant", "compliance-checker",
    "document-reviewer", "risk-reporter", "limit-monitor", "exception-handler",
    "dispute-resolver", "identity-verifier", "transaction-monitor", "audit-logger",
    "suitability-advisor", "portfolio-analyzer", "settlement-agent", "recon-agent",
    "regulatory-filer", "alert-triage-agent", "sanctions-screener", "fraud-detector",
    "credit-assessor", "collateral-monitor", "valuation-agent", "model-validator",
]

AGENT_DESCRIPTIONS = {
    "kyc-verification-bot": "Verifies customer identity documents per CIP requirements. Validates government-issued IDs, address proof, and beneficial ownership for entities.",
    "aml-triage-agent": "Triages anti-money laundering alerts for compliance review. Applies CTR and structuring thresholds, escalates high-risk alerts within 24 hours.",
    "trade-surveillance-agent": "Monitors trading activity for potential market abuse, front-running, wash sales, and other prohibited patterns.",
    "customer-support-assistant": "Handles customer inquiries across digital channels. Verifies identity before sharing account details, escalates disputes and regulatory matters.",
    "onboarding-assistant": "Guides new customers through digital onboarding. Collects required KYC/AML information and documentation.",
    "compliance-checker": "Runs policy and regulatory compliance checks across processes, content, and third-party integrations.",
    "document-reviewer": "Validates identity and corporate documents per acceptance standards. Rejects expired or non-conforming documents.",
    "risk-reporter": "Produces risk and control reports for management, risk committees, and regulatory submissions.",
    "limit-monitor": "Monitors intraday limits and alerts on breaches. Escalates breaches within 15 minutes per policy.",
    "exception-handler": "Triages and escalates exceptions per severity matrix. Routes critical items to compliance and risk within 1 hour.",
    "dispute-resolver": "Resolves customer disputes per Reg E and network rules. Manages provisional credit and final determination timeframes.",
    "identity-verifier": "Verifies customer identity via documentary and non-documentary methods per CIP. Flags synthetic identity indicators.",
    "transaction-monitor": "Monitors transactions for suspicious patterns. Supports SAR identification and filing.",
    "audit-logger": "Maintains immutable audit trail and lineage for governance and regulatory examinations.",
    "suitability-advisor": "Assesses product suitability and risk appetite per Reg BI. Documents recommendation rationale.",
    "portfolio-analyzer": "Provides portfolio analysis, performance attribution, and risk metrics for advisory clients.",
    "settlement-agent": "Automates trade and position reconciliation. Resolves breaks and settlement instructions.",
    "recon-agent": "Performs daily reconciliation of cash and securities positions across systems.",
    "regulatory-filer": "Prepares and submits regulatory reports per jurisdiction and filing calendar.",
    "alert-triage-agent": "Triages compliance and risk alerts by severity. Routes to appropriate teams per escalation matrix.",
    "sanctions-screener": "Screens all parties against OFAC, UN, EU, and local sanctions lists. Blocks and reports matches.",
    "fraud-detector": "Detects potential fraud patterns in transactions and account activity. Escalates for investigation.",
    "credit-assessor": "Assesses creditworthiness and recommends credit limits for commercial and retail clients.",
    "collateral-monitor": "Monitors collateral positions and margin requirements. Alerts on collateral shortfalls.",
    "valuation-agent": "Performs independent price verification for trading positions and portfolios.",
    "model-validator": "Validates quantitative models and assesses model risk per governance framework.",
}

# Context (policy) topics
CONTEXT_TOPICS = [
    "trading-limits-policy", "aml-transaction-thresholds", "kyc-cip-requirements",
    "dispute-resolution-policy", "suitability-standards", "pre-trade-compliance",
    "concentration-limits", "var-risk-limits", "client-onboarding-policy",
    "document-acceptance-standards", "sanctions-screening-policy", "sar-escalation-procedures",
    "reg-e-timeframes", "reg-bi-documentation", "volcker-rule-compliance",
    "trade-surveillance-policy", "limit-breach-escalation", "exception-handling-procedures",
    "audit-retention-policy", "data-classification-policy", "pii-handling-guidelines",
    "third-party-risk-policy", "model-governance-framework", "credit-risk-policy",
    "market-risk-limits", "operational-risk-framework", "business-continuity-policy",
    "information-security-policy", "vendor-management-policy", "conflict-of-interest-policy",
]

CONTEXT_CONTENT_TEMPLATES = [
    (
        "# Pre-Trade Limits Policy — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Desk: {{ desk_name }}\n\n"
        "## Concentration Limits\n"
        "- Single-name limit: {{ single_name_limit }} {{ currency }}\n"
        "- Single-name concentration must not exceed {{ concentration_pct }}% of portfolio.\n"
        "- Sector concentration capped at {{ sector_cap_pct }}%.\n"
        "- All breaches must be reported to Risk within {{ breach_notify_minutes }} minutes.\n\n"
        "## VaR Limits\n"
        "- Value-at-Risk limit: {{ var_limit }} {{ currency }} at 99% confidence, 1-day horizon.\n"
        "- Intraday breaches require immediate escalation to the trading desk head and Risk Management.\n\n"
        "## Escalation\n"
        "- Any limit breach must be logged in the exception management system.\n"
        "- Critical breaches require sign-off from {{ escalation_authority }} before remediation.\n"
        "- Escalation contact: {{ escalation_contact }}"
    ),
    (
        "# AML Transaction Monitoring — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Risk Tier: {{ risk_tier }}\n\n"
        "## Currency Transaction Reports\n"
        "Cash and cash-equivalent transactions over {{ ctr_threshold }} {{ currency }} in a single business day\n"
        "require a Currency Transaction Report (CTR) filed with {{ regulator }} within {{ ctr_filing_days }} days.\n\n"
        "## Structuring Detection\n"
        "Multiple transactions below {{ structuring_threshold }} {{ currency }} within a {{ monitoring_window_hours }}-hour period\n"
        "are flagged for potential structuring. Do not advise customers on how to avoid reporting thresholds.\n\n"
        "## SAR Filing\n"
        "Suspicious Activity Reports must be filed within {{ sar_filing_days }} days of detection.\n"
        "Do not disclose SAR filing status to any party including the customer.\n"
        "Escalation: {{ escalation_contact }}"
    ),
    (
        "# KYC Identity Verification — {{ jurisdiction }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Customer Type: {{ customer_type }}\n\n"
        "## Customer Identification Program\n"
        "Obtain and verify name, date of birth, address, and identification number before account opening.\n"
        "Government-issued photo ID required for all {{ customer_type }} customers.\n\n"
        "## Address Verification\n"
        "Address must be verified via utility bill, bank statement, or government correspondence\n"
        "dated within {{ address_verification_days }} days.\n\n"
        "## Beneficial Ownership\n"
        "For legal entities, identify and verify all beneficial owners holding {{ beneficial_ownership_pct }}% or more equity.\n"
        "Enhanced due diligence required for complex ownership structures.\n"
        "Regulatory framework: {{ regulatory_framework }}\n"
        "Review frequency: every {{ review_frequency_months }} months"
    ),
    (
        "# Reg E Dispute Resolution — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Processor: {{ processor_name }}\n\n"
        "## Error Resolution\n"
        "Consumer must report error within {{ error_report_days }} days of statement.\n"
        "Bank must investigate and resolve within {{ investigation_days }} business days or provide provisional credit.\n\n"
        "## Provisional Credit\n"
        "Provisional credit must be provided within {{ provisional_credit_days }} business days if investigation requires more time.\n"
        "Extended to {{ new_account_days }} days for new accounts.\n\n"
        "## Final Determination\n"
        "Final determination must be communicated within {{ final_determination_days }} days\n"
        "({{ extended_determination_days }} days for POS, foreign transactions, or new accounts).\n"
        "Contact: {{ compliance_contact }}"
    ),
    (
        "# Suitability and Best Interest — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Applicable Regulation: {{ regulation }}\n\n"
        "## Care Obligation\n"
        "Recommendations must be in the best interest of the {{ customer_type }} customer.\n"
        "Consider customer's investment profile, financial situation, and risk tolerance.\n\n"
        "## Documentation Requirements\n"
        "Document the basis for each recommendation including:\n"
        "- Customer profile assessment\n"
        "- Product features, costs, and risks considered\n"
        "- Suitability determination rationale\n\n"
        "## Conflict Disclosure\n"
        "Disclose all material conflicts of interest at or before the time of recommendation.\n"
        "Maintain CRS (Customer Relationship Summary) current.\n"
        "Review cycle: every {{ review_cycle_months }} months"
    ),
    (
        "# Volcker Rule Compliance — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Business Unit: {{ business_unit }}\n\n"
        "## Proprietary Trading Prohibition\n"
        "Proprietary trading for the firm's own account is prohibited.\n"
        "Permitted activities: market-making, hedging, and underwriting.\n"
        "Maximum inventory holding period: {{ max_holding_days }} days.\n\n"
        "## Covered Funds\n"
        "Investment in or sponsorship of covered funds (hedge funds, PE funds) is restricted.\n"
        "De minimis threshold: {{ de_minimis_pct }}% of Tier 1 capital.\n\n"
        "## Compliance Program\n"
        "Maintain written compliance policies, internal controls, and independent testing.\n"
        "Report metrics to {{ regulator }} as required.\n"
        "Testing frequency: {{ testing_frequency }}"
    ),
    (
        "# Sanctions Screening Policy — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Screening Provider: {{ screening_provider }}\n\n"
        "## Screening Requirements\n"
        "All customers, counterparties, and transactions must be screened against:\n"
        "{% for list_name in sanctions_lists %}"
        "- {{ list_name }}\n"
        "{% endfor %}\n"
        "## Match Handling\n"
        "Potential matches must be reviewed within {{ match_review_hours }} hours.\n"
        "True matches must be blocked and reported to {{ regulator }} within {{ report_days }} business days.\n\n"
        "## Ongoing Monitoring\n"
        "Screening must occur at onboarding, upon list updates, and periodically for existing relationships.\n"
        "Rescreening cycle: every {{ rescreen_months }} months.\n"
        "Document all screening results."
    ),
    (
        "# Model Risk Management — {{ region }}\n"
        "Effective Date: {{ effective_date }}\n"
        "Model Risk Officer: {{ model_risk_officer }}\n\n"
        "## Model Inventory\n"
        "All quantitative models must be registered in the model inventory with:\n"
        "- Assigned ownership\n"
        "- Risk tier (1–{{ max_risk_tier }})\n"
        "- Validation schedule\n\n"
        "## Validation Requirements\n"
        "- Tier 1 models: {{ tier1_validation_months }}-month independent validation cycle\n"
        "- Tier 2 models: {{ tier2_validation_months }}-month validation cycle\n"
        "- All material changes trigger re-validation.\n\n"
        "## Model Use\n"
        "Models may only be used for approved purposes.\n"
        "Any use outside approved scope requires documented exception and approval from {{ approval_authority }}."
    ),
]

# ============================================================================
# JINJA2 TEMPLATED CONTEXT EXAMPLES
# These demonstrate Sandarb's Templated Context feature: context content
# stored as Jinja2 templates with {{ variable }} placeholders that are
# rendered at injection time with agent-provided variables.
# ============================================================================

JINJA2_CONTEXT_TEMPLATES = [
    {
        "name": "refund-policy",
        "description": "Regional refund policy template. Rendered at injection time with region, currency, and compliance code.",
        "template": (
            "# Refund Policy for {{ region }}\n"
            "Current Date: {{ current_date }}\n"
            "Customer ID: {{ customer_id }}\n\n"
            "RULES:\n"
            "1. Refunds are processed in {{ currency }}.\n"
            "2. Strictly follow the {{ compliance_code }} protocol.\n"
            "3. Maximum refund amount: {{ max_refund_amount }} {{ currency }}.\n"
            "4. Refund window: {{ refund_window_days }} days from purchase date.\n"
            "5. Escalate any refund above {{ escalation_threshold }} {{ currency }} to manager."
        ),
        "example_variables": {
            "region": "EU", "current_date": "2026-02-06", "customer_id": "CUST-90210",
            "currency": "EUR", "compliance_code": "GDPR-22",
            "max_refund_amount": "5000", "refund_window_days": "30",
            "escalation_threshold": "2500",
        },
    },
    {
        "name": "trading-limits-dynamic",
        "description": "Dynamic trading limits policy rendered per desk and region at injection time.",
        "template": (
            "# Trading Limits for {{ desk_name }} — {{ region }}\n"
            "Effective Date: {{ effective_date }}\n"
            "Approved By: {{ approved_by }}\n\n"
            "## Position Limits\n"
            "- Single-name limit: {{ single_name_limit }} {{ currency }}\n"
            "- Sector concentration cap: {{ sector_cap_pct }}%\n"
            "- VaR limit (99%, 1-day): {{ var_limit }} {{ currency }}\n\n"
            "## Escalation\n"
            "- Breach notification: within {{ breach_notify_minutes }} minutes\n"
            "- Escalation contact: {{ escalation_contact }}\n"
            "- Override authority: {{ override_authority }}"
        ),
        "example_variables": {
            "desk_name": "Equities APAC", "region": "APAC",
            "effective_date": "2026-01-15", "approved_by": "Chief Risk Officer",
            "single_name_limit": "500000", "currency": "USD",
            "sector_cap_pct": "25", "var_limit": "5000000",
            "breach_notify_minutes": "15",
            "escalation_contact": "risk-apac@bank.com",
            "override_authority": "CRO or Regional Head of Risk",
        },
    },
    {
        "name": "kyc-verification-checklist",
        "description": "KYC verification checklist rendered per customer type and jurisdiction.",
        "template": (
            "# KYC Verification Checklist\n"
            "Jurisdiction: {{ jurisdiction }}\n"
            "Customer Type: {{ customer_type }}\n"
            "Risk Rating: {{ risk_rating }}\n"
            "Relationship Manager: {{ relationship_manager }}\n\n"
            "## Required Documents\n"
            "{% for doc in required_documents %}"
            "- {{ doc }}\n"
            "{% endfor %}\n"
            "## Compliance Notes\n"
            "- Regulatory framework: {{ regulatory_framework }}\n"
            "- Review frequency: Every {{ review_frequency_months }} months\n"
            "- Data retention: {{ retention_years }} years"
        ),
        "example_variables": {
            "jurisdiction": "United Kingdom",
            "customer_type": "Corporate Entity",
            "risk_rating": "Medium",
            "relationship_manager": "alice.johnson@bank.com",
            "required_documents": [
                "Certificate of Incorporation",
                "Board Resolution",
                "Proof of Registered Address",
                "Beneficial Ownership Declaration",
                "Source of Funds Documentation",
            ],
            "regulatory_framework": "FCA / MLR 2017",
            "review_frequency_months": "12",
            "retention_years": "7",
        },
    },
    {
        "name": "aml-alert-triage",
        "description": "AML alert triage instructions rendered per alert type and risk tier.",
        "template": (
            "# AML Alert Triage — {{ alert_type }}\n"
            "Alert ID: {{ alert_id }}\n"
            "Risk Tier: {{ risk_tier }}\n"
            "Generated: {{ generated_date }}\n\n"
            "## Thresholds\n"
            "- CTR threshold: {{ ctr_threshold }} {{ currency }}\n"
            "- Structuring detection: {{ structuring_threshold }} {{ currency }}\n"
            "- Rapid movement window: {{ rapid_movement_hours }} hours\n\n"
            "## Investigation Steps\n"
            "1. Review transaction history for the past {{ lookback_days }} days.\n"
            "2. Check customer profile against {{ sanctions_list }}.\n"
            "3. Verify source of funds if amount exceeds {{ enhanced_dd_threshold }} {{ currency }}.\n"
            "4. Document findings in case management system.\n"
            "5. Escalate to {{ escalation_team }} if SAR criteria met.\n\n"
            "## Regulatory Deadline\n"
            "SAR must be filed within {{ sar_filing_days }} days of detection."
        ),
        "example_variables": {
            "alert_type": "Unusual Transaction Pattern",
            "alert_id": "AML-2026-00847",
            "risk_tier": "HIGH",
            "generated_date": "2026-02-06",
            "ctr_threshold": "10000", "currency": "USD",
            "structuring_threshold": "3000",
            "rapid_movement_hours": "24",
            "lookback_days": "90",
            "sanctions_list": "OFAC SDN + EU Consolidated",
            "enhanced_dd_threshold": "50000",
            "escalation_team": "BSA/AML Compliance Unit",
            "sar_filing_days": "30",
        },
    },
    {
        "name": "credit-assessment-policy",
        "description": "Credit assessment policy rendered per product type, region, and risk appetite.",
        "template": (
            "# Credit Assessment Policy — {{ product_type }}\n"
            "Region: {{ region }}\n"
            "Effective: {{ effective_date }}\n"
            "Segment: {{ customer_segment }}\n\n"
            "## Eligibility Criteria\n"
            "- Minimum credit score: {{ min_credit_score }}\n"
            "- Maximum DTI ratio: {{ max_dti_pct }}%\n"
            "- Minimum income: {{ min_income }} {{ currency }}/year\n"
            "- Employment verification: {{ employment_verification }}\n\n"
            "## Pricing\n"
            "- Base rate: {{ base_rate_pct }}%\n"
            "- Risk premium range: {{ risk_premium_min }}% — {{ risk_premium_max }}%\n"
            "- Maximum exposure: {{ max_exposure }} {{ currency }}\n\n"
            "## Approval Authority\n"
            "- Up to {{ auto_approve_limit }} {{ currency }}: Automated\n"
            "- {{ auto_approve_limit }} — {{ senior_approve_limit }} {{ currency }}: Senior Credit Officer\n"
            "- Above {{ senior_approve_limit }} {{ currency }}: Credit Committee"
        ),
        "example_variables": {
            "product_type": "Personal Loan",
            "region": "North America",
            "effective_date": "2026-01-01",
            "customer_segment": "Retail Banking",
            "min_credit_score": "680",
            "max_dti_pct": "43",
            "min_income": "35000", "currency": "USD",
            "employment_verification": "Required for amounts > $25,000",
            "base_rate_pct": "5.25",
            "risk_premium_min": "0.5", "risk_premium_max": "4.0",
            "max_exposure": "100000",
            "auto_approve_limit": "10000",
            "senior_approve_limit": "50000",
        },
    },
    {
        "name": "fraud-detection-rules",
        "description": "Fraud detection rules rendered per channel and risk profile.",
        "template": (
            "# Fraud Detection Rules — {{ channel }}\n"
            "Region: {{ region }}\n"
            "Last Updated: {{ last_updated }}\n\n"
            "## Transaction Velocity Rules\n"
            "- Max transactions per hour: {{ max_txn_per_hour }}\n"
            "- Max daily amount: {{ max_daily_amount }} {{ currency }}\n"
            "- Decline threshold: {{ decline_threshold }} {{ currency }} single transaction\n\n"
            "## Geographic Rules\n"
            "- Blocked countries: {{ blocked_countries }}\n"
            "- Cross-border alert threshold: {{ cross_border_threshold }} {{ currency }}\n\n"
            "## Device & Session\n"
            "- Max devices per account: {{ max_devices }}\n"
            "- Session timeout: {{ session_timeout_minutes }} minutes\n"
            "- Alert on new device: {{ alert_new_device }}"
        ),
        "example_variables": {
            "channel": "Mobile Banking",
            "region": "EMEA",
            "last_updated": "2026-02-01",
            "max_txn_per_hour": "10",
            "max_daily_amount": "25000", "currency": "GBP",
            "decline_threshold": "5000",
            "blocked_countries": "North Korea, Iran, Syria",
            "cross_border_threshold": "10000",
            "max_devices": "3",
            "session_timeout_minutes": "15",
            "alert_new_device": "Yes — push notification + email",
        },
    },
]

# Prompt topics and content
PROMPT_TOPICS = [
    "customer-support-playbook", "kyc-verification-standard", "aml-triage-runbook",
    "pre-trade-compliance-guide", "suitability-assessment-guide", "dispute-resolution-playbook",
    "client-reporting-standard", "limit-monitoring-procedures", "document-review-policy",
    "regulatory-reporting-guide", "exception-handling-runbook", "identity-verification-cip",
    "transaction-review-procedures", "audit-trail-governance", "risk-reporting-standard",
    "sanctions-screening-guide", "fraud-detection-playbook", "credit-assessment-guide",
    "collateral-management-procedures", "valuation-control-standard", "model-validation-guide",
]

PROMPT_CONTENT_TEMPLATES = [
    "You are a {role} agent operating under strict governance controls. {specific_instruction} Always verify authorization before accessing sensitive data. Log all material decisions for audit trail. Escalate to human oversight when uncertain or when regulatory thresholds are approached.",
    "You are a compliance-focused {role} assistant. {specific_instruction} Never provide advice on circumventing regulatory requirements. If asked to do something that may violate policy, politely decline and explain the relevant compliance boundary.",
    "You are a {role} specialist with access to governed data sources. {specific_instruction} Do not disclose internal escalation procedures or SAR filing status to external parties. Maintain confidentiality of compliance-sensitive information.",
    "You are an AI {role} operating within the firm's risk appetite framework. {specific_instruction} All outputs are subject to review and may be logged for regulatory examination. Do not make commitments on behalf of the firm without appropriate authorization.",
]

PROMPT_SPECIFIC_INSTRUCTIONS = {
    "customer-support": "Be polite, professional, and empathetic. Verify customer identity before discussing account details. Escalate disputes, fraud concerns, and regulatory matters to appropriate teams.",
    "kyc-verification": "Review identity documents against CIP requirements. Accept only valid, unexpired government-issued IDs. Flag inconsistencies and refer to compliance for enhanced due diligence.",
    "aml-triage": "Evaluate alerts against CTR and structuring thresholds. Document your analysis rationale. Never disclose that a SAR has been or may be filed.",
    "pre-trade-compliance": "Check orders against concentration limits, VaR limits, and restricted lists. Block orders that would breach limits. Do not advise on circumventing controls.",
    "suitability-assessment": "Assess customer risk tolerance and investment objectives. Ensure recommendations align with customer profile. Document suitability rationale for each recommendation.",
    "dispute-resolution": "Follow Reg E timeframes for error resolution. Apply provisional credit rules correctly. Never disclose internal investigation status to third parties.",
    "client-reporting": "Generate reports only from approved data sources. Do not include MNPI or confidential information. Ensure methodology is consistent with client disclosures.",
    "limit-monitoring": "Monitor positions against approved limits. Alert on breaches within 15 minutes. Do not override limits without documented exception approval.",
    "document-review": "Validate documents against acceptance criteria. Reject expired or illegible documents. Flag potential forgeries for compliance review.",
    "regulatory-reporting": "Prepare filings using approved data and methodology. Do not disclose draft filings externally. Meet all submission deadlines.",
    "exception-handling": "Triage exceptions by severity. Route critical issues to compliance and risk within 1 hour. Document all exceptions and resolutions.",
    "identity-verification": "Verify identity using approved methods. Flag synthetic identity indicators. Do not approve accounts without required verification.",
    "transaction-review": "Review transactions for suspicious patterns. Apply AML screening rules. Escalate potential SARs to BSA compliance team.",
    "audit-trail": "Record all material decisions with timestamps and rationale. Ensure immutability of audit records. Support regulatory examination requests.",
    "risk-reporting": "Produce accurate risk metrics using validated models. Disclose model limitations and data quality issues. Escalate material findings promptly.",
    "sanctions-screening": "Screen against all required watchlists. Block and report true matches immediately. Do not process transactions for blocked parties.",
    "fraud-detection": "Analyze transaction patterns for fraud indicators. Protect customer accounts from unauthorized access. Escalate confirmed fraud immediately.",
    "credit-assessment": "Evaluate creditworthiness using approved criteria. Document credit decision rationale. Refer exceptions to credit committee.",
    "collateral-management": "Monitor collateral positions and margin requirements. Alert on shortfalls. Process margin calls per agreed procedures.",
    "valuation-control": "Perform independent price verification. Escalate valuation disputes to committee. Document all valuation adjustments.",
    "model-validation": "Validate models against governance framework. Document limitations and assumptions. Recommend remediation for identified issues.",
}

# Users for created_by, approved_by fields
USERS = [
    "alice.johnson", "bob.smith", "carol.williams", "david.chen", "emma.davis",
    "frank.miller", "grace.lee", "henry.wilson", "iris.taylor", "jack.anderson",
    "kate.thomas", "liam.jackson", "mia.white", "noah.harris", "olivia.martin",
    "peter.garcia", "quinn.martinez", "rachel.robinson", "sam.clark", "tina.rodriguez",
]

LOB_TAGS = ["Wealth-Management", "Investment-Banking", "Retail-Banking", "Legal-Compliance"]
DATA_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Restricted"]
APPROVAL_STATUSES = ["draft", "pending_approval", "approved", "rejected"]
REGULATORY_SCOPES = [
    '["Reg E", "Reg Z", "TILA"]',
    '["FINRA", "SEC", "Volcker"]',
    '["BSA", "FinCEN", "PATRIOT Act"]',
    '["MiFID II", "GDPR", "EMIR"]',
    '["SOX", "GLBA", "CCPA"]',
]


def slugify(s: str) -> str:
    """Convert to lowercase kebab-case, no double hyphens or underscores."""
    import re
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s)  # No double hyphens
    return s.strip("-")


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def random_date(start_days_ago: int = 365, end_days_ago: int = 0) -> str:
    """Random datetime between start_days_ago and end_days_ago."""
    start = datetime.now(timezone.utc) - timedelta(days=start_days_ago)
    end = datetime.now(timezone.utc) - timedelta(days=end_days_ago)
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    dt = start + timedelta(seconds=random_seconds)
    return dt.strftime("%Y-%m-%d %H:%M:%S+00")


def pick(items: list, index: int):
    return items[index % len(items)]


def escape_sql(s: str) -> str:
    """Escape single quotes for SQL."""
    if s is None:
        return "NULL"
    return s.replace("'", "''")


def generate_organizations(count: int) -> list[dict]:
    """Generate organization records."""
    orgs = []
    
    # First org is root
    root_id = str(uuid.uuid4())
    orgs.append({
        "id": root_id,
        "name": "Sandarb HQ",
        "slug": "sandarb-hq",
        "description": "Corporate headquarters and enterprise governance. Sets group-wide AI agent policies and oversees the agent registry.",
        "parent_id": None,
        "is_root": True,
    })
    
    # Generate child orgs by combining divisions and regions
    org_count = 1
    for i, division in enumerate(ORG_DIVISIONS):
        if org_count >= count:
            break
        
        # Create main division org
        div_id = str(uuid.uuid4())
        div_name = division.replace("-", " ").title()
        div_desc = ORG_DESCRIPTIONS.get(division, f"{div_name} division. Governs AI agents for this line of business.")
        orgs.append({
            "id": div_id,
            "name": div_name,
            "slug": division,
            "description": div_desc,
            "parent_id": root_id,
            "is_root": False,
        })
        org_count += 1
        
        # Create regional sub-orgs for some divisions
        if org_count < count and i % 3 == 0:
            for region in random.sample(ORG_REGIONS, min(3, count - org_count)):
                if org_count >= count:
                    break
                reg_id = str(uuid.uuid4())
                reg_name = f"{div_name} {region.replace('-', ' ').title()}"
                reg_slug = slugify(f"{division}-{region}")
                orgs.append({
                    "id": reg_id,
                    "name": reg_name,
                    "slug": reg_slug,
                    "description": f"{reg_name} regional operations. Governs agents for {region.upper()} market activities.",
                    "parent_id": div_id,
                    "is_root": False,
                })
                org_count += 1
    
    return orgs


def generate_agents(count: int, orgs: list[dict]) -> list[dict]:
    """Generate agent records distributed across organizations."""
    agents = []
    non_root_orgs = [o for o in orgs if not o["is_root"]]
    seen_ids: set[str] = set()

    for i in range(count):
        org = pick(non_root_orgs, i)
        role = pick(AGENT_ROLES, i)
        role_name = role.replace("-", " ").title()

        # Create unique agent_id: org-slug + role (no numeric suffix)
        org_slug = slugify(org["slug"])
        agent_id = f"agent.{org_slug}-{role}"

        # Dedup: if collision, skip (org×role already covered)
        if agent_id in seen_ids:
            continue
        seen_ids.add(agent_id)

        # Human-friendly display name
        agent_name = f"{role_name} ({org['name'][:20]})"

        desc = AGENT_DESCRIPTIONS.get(role, f"{role_name} agent for {org['name']}.")
        user = pick(USERS, i)
        status = pick(APPROVAL_STATUSES, i)
        created = random_date(180, 30)

        agent = {
            "id": str(uuid.uuid4()),
            "org_id": org["id"],
            "agent_id": agent_id,
            "name": agent_name,
            "description": desc,
            "a2a_url": f"https://agent.sandarb.ai/{agent_id}",
            "status": "active",
            "approval_status": status,
            "approved_by": f"@{pick(USERS, i + 1)}" if status == "approved" else None,
            "approved_at": random_date(30, 1) if status == "approved" else None,
            "submitted_by": f"@{user}",
            "created_by": f"@{user}",
            "created_at": created,
            "updated_at": random_date(30, 0),
            "tools_used": json.dumps(random.sample(["web-search", "document-retrieval", "calculation", "database-query", "email"], random.randint(1, 3))),
            "allowed_data_scopes": json.dumps(random.sample(["accounts", "transactions", "customers", "positions", "trades"], random.randint(1, 3))),
            "pii_handling": random.choice([True, False]),
            "regulatory_scope": pick(REGULATORY_SCOPES, i),
        }
        agents.append(agent)

    return agents


def generate_contexts(count: int, orgs: list[dict]) -> list[dict]:
    """Generate context (policy) records; assign random non-root org per context.

    All contexts use Jinja2 template strings.  The first batch
    (one per JINJA2_CONTEXT_TEMPLATES entry) use dedicated showcase templates.
    Remaining contexts use CONTEXT_CONTENT_TEMPLATES (also Jinja2 strings).
    """
    contexts = []
    non_root_orgs = [o for o in orgs if not o.get("is_root", True)]
    if not non_root_orgs:
        non_root_orgs = orgs

    # --- First: create one context per Jinja2 template (to showcase the feature) ---
    for j, jinja_tpl in enumerate(JINJA2_CONTEXT_TEMPLATES):
        org = pick(non_root_orgs, j)
        region = pick(ORG_REGIONS, j)
        tpl_name = jinja_tpl["name"]
        ctx_name = f"context.{slugify(f'{region}-{tpl_name}')}"
        user = pick(USERS, j)
        classification = pick(DATA_CLASSIFICATIONS, j)
        created = random_date(365, 60)
        ctx = {
            "id": str(uuid.uuid4()),
            "name": ctx_name,
            "description": jinja_tpl["description"],
            "org_id": org["id"],
            "data_classification": classification,
            "owner_team": org.get("slug", "governance") + "-governance",
            "created_by": f"@{user}",
            "created_at": created,
            "is_active": True,
            "updated_at": random_date(60, 0),
            "tags": json.dumps([jinja_tpl["name"].split("-")[0], region, "templated"]),
            "regulatory_hooks": json.dumps(["pre-response-check", "audit-log"]),
            "_is_jinja2": True,
            "_jinja2_index": j,
        }
        contexts.append(ctx)

    # --- Then: fill the rest with static content ---
    seen_names: set[str] = {c["name"] for c in contexts}
    for i in range(len(JINJA2_CONTEXT_TEMPLATES), count):
        topic = pick(CONTEXT_TOPICS, i)
        region = pick(ORG_REGIONS, i // 10)
        org = pick(non_root_orgs, i)
        # Unique name: region + topic (no numeric suffix)
        ctx_name = f"context.{slugify(f'{region}-{topic}')}"
        # Dedup: skip if already seen (region×topic already covered)
        if ctx_name in seen_names:
            continue
        seen_names.add(ctx_name)
        template = pick(CONTEXT_CONTENT_TEMPLATES, i)
        content = json.dumps(template)
        user = pick(USERS, i)
        classification = pick(DATA_CLASSIFICATIONS, i)
        created = random_date(365, 60)
        ctx = {
            "id": str(uuid.uuid4()),
            "name": ctx_name,
            "description": f"{topic.replace('-', ' ').title()} for {region.upper()} operations.",
            "org_id": org["id"],
            "data_classification": classification,
            "owner_team": org.get("slug", "governance") + "-governance",
            "created_by": f"@{user}",
            "created_at": created,
            "is_active": True,
            "updated_at": random_date(60, 0),
            "tags": json.dumps([topic.split("-")[0], region, org.get("slug", "")]),
            "regulatory_hooks": json.dumps(["pre-response-check", "audit-log"]),
        }
        contexts.append(ctx)
    return contexts


def generate_context_versions(contexts: list[dict]) -> list[dict]:
    """Generate context versions for each context.

    All context content is stored as a Jinja2 template string (with
    ``{{ variable }}`` placeholders) inside a JSONB column.  The governance
    hash is computed from ``context_name:template_content`` for a stable,
    version-specific fingerprint.
    """
    versions = []

    for ctx in contexts:
        user = ctx["created_by"]

        if ctx.get("_is_jinja2"):
            # Showcase Jinja2 templates
            jinja_tpl = JINJA2_CONTEXT_TEMPLATES[ctx["_jinja2_index"]]
            template_str = jinja_tpl["template"]
        else:
            # Standard Jinja2 template from CONTEXT_CONTENT_TEMPLATES (now strings)
            template_str = pick(CONTEXT_CONTENT_TEMPLATES, hash(ctx["id"]) % len(CONTEXT_CONTENT_TEMPLATES))

        content = json.dumps(template_str)  # JSON string → valid JSONB
        gov_hash = sha256(f"{ctx['name']}:{template_str}")
        commit_msg = "Initial Jinja2 templated version"

        version = {
            "id": str(uuid.uuid4()),
            "context_id": ctx["id"],
            "version": 1,  # Integer version starting from 1
            "content": content,
            "sha256_hash": gov_hash,
            "status": "Approved",
            "created_by": user,
            "created_at": ctx["created_at"],
            "submitted_by": user,
            "approved_by": f"@{pick(USERS, hash(ctx['id']) % len(USERS))}",
            "approved_at": ctx["updated_at"],
            "is_active": True,
            "commit_message": commit_msg,
        }
        versions.append(version)

    return versions


def generate_prompts(count: int) -> list[dict]:
    """Generate prompt records."""
    prompts = []
    seen_names: set[str] = set()

    for i in range(count):
        topic = pick(PROMPT_TOPICS, i)
        region = pick(ORG_REGIONS, i // 15)

        # Unique name: region + topic (no numeric suffix)
        prompt_name = f"prompt.{slugify(f'{region}-{topic}')}"
        # Dedup: skip if already seen (region×topic already covered)
        if prompt_name in seen_names:
            continue
        seen_names.add(prompt_name)
        
        topic_key = topic.replace("-playbook", "").replace("-standard", "").replace("-guide", "").replace("-runbook", "").replace("-procedures", "")
        specific = PROMPT_SPECIFIC_INSTRUCTIONS.get(topic_key, "Follow all governance policies and compliance requirements.")
        
        user = pick(USERS, i)
        created = random_date(300, 30)
        
        prompt = {
            "id": str(uuid.uuid4()),
            "name": prompt_name,
            "description": f"Governed system prompt for {topic.replace('-', ' ')} in {region.upper()}. Defines agent behavior, compliance boundaries, and escalation procedures.",
            "tags": json.dumps([topic.split("-")[0], region]),
            "created_by": f"@{user}",
            "created_at": created,
            "updated_at": random_date(30, 0),
        }
        prompts.append(prompt)
    
    return prompts


def generate_prompt_versions(prompts: list[dict]) -> list[dict]:
    """Generate prompt versions for each prompt."""
    versions = []
    
    for prompt in prompts:
        # Strip SRN prefix (prompt.) before extracting topic
        raw_name = prompt["name"].removeprefix("prompt.")
        topic_parts = raw_name.split("-")
        # Extract topic from name (skip region prefix and numeric suffix)
        topic_key = "-".join(topic_parts[1:-1]) if len(topic_parts) > 2 else "compliance"
        topic_key = topic_key.replace("-playbook", "").replace("-standard", "").replace("-guide", "").replace("-runbook", "").replace("-procedures", "").replace("-policy", "").replace("-cip", "")
        
        specific = PROMPT_SPECIFIC_INSTRUCTIONS.get(topic_key, "Follow all governance policies.")
        role = topic_key.replace("-", " ")
        
        template = pick(PROMPT_CONTENT_TEMPLATES, hash(prompt["id"]) % len(PROMPT_CONTENT_TEMPLATES))
        content = template.format(role=role, specific_instruction=specific)
        
        user = prompt["created_by"]
        
        version = {
            "id": str(uuid.uuid4()),
            "prompt_id": prompt["id"],
            "version": 1,
            "content": content,
            "system_prompt": f"You are a governed {role} assistant.",
            "model": pick(["gpt-4", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet"], hash(prompt["id"]) % 4),
            "status": "Approved",  # Title-case per prompt_versions_status_check constraint
            "created_by": user,
            "created_at": prompt["created_at"],
            "submitted_by": user,
            "approved_by": f"@{pick(USERS, hash(prompt['id']) % len(USERS))}",
            "approved_at": prompt["updated_at"],
            "sha256_hash": sha256(content),
            "commit_message": "Initial prompt version",
        }
        versions.append(version)
        
        # Update prompt with current_version_id
        prompt["current_version_id"] = version["id"]
    
    return versions


def generate_agent_links(agents: list[dict], contexts: list[dict], prompts: list[dict]) -> tuple[list[dict], list[dict]]:
    """Generate agent-context and agent-prompt links. Each agent gets 2-5 of each."""
    agent_contexts = []
    agent_prompts = []
    
    for agent in agents:
        # Link 2-5 contexts
        num_contexts = random.randint(2, min(5, len(contexts)))
        linked_contexts = random.sample(contexts, num_contexts)
        for ctx in linked_contexts:
            agent_contexts.append({
                "agent_id": agent["id"],
                "context_id": ctx["id"],
                "created_at": random_date(60, 0),
            })
        
        # Link 2-5 prompts
        num_prompts = random.randint(2, min(5, len(prompts)))
        linked_prompts = random.sample(prompts, num_prompts)
        for prompt in linked_prompts:
            agent_prompts.append({
                "agent_id": agent["id"],
                "prompt_id": prompt["id"],
                "created_at": random_date(60, 0),
            })
    
    return agent_contexts, agent_prompts


def generate_access_logs(agents: list[dict], contexts: list[dict], prompts: list[dict], count_per_agent: int = 5) -> list[dict]:
    """Generate sandarb_access_logs entries for agents."""
    logs = []
    
    for agent in agents:
        # Generate several access log entries per agent
        num_logs = random.randint(1, count_per_agent)
        for _ in range(num_logs):
            ctx = random.choice(contexts) if random.random() > 0.3 else None
            prompt = random.choice(prompts) if random.random() > 0.3 else None
            
            log = {
                "agent_id": agent["agent_id"],  # External identifier
                "trace_id": f"trace-{uuid.uuid4().hex[:16]}",
                "context_id": ctx["id"] if ctx else None,
                "prompt_id": prompt["id"] if prompt else None,
                "accessed_at": random_date(30, 0),
                "request_ip": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}",
                "metadata": json.dumps({"source": "api", "action": random.choice(["inject", "pull", "query"])}),
            }
            logs.append(log)
    
    return logs


def generate_sql(orgs, agents, contexts, context_versions, prompts, prompt_versions, agent_contexts, agent_prompts, access_logs) -> str:
    """Generate SQL INSERT statements."""
    lines = [
        "-- Sandarb Seed Data",
        f"-- Generated: {datetime.now(timezone.utc).isoformat()}",
        f"-- Organizations: {len(orgs)}, Agents: {len(agents)}, Prompts: {len(prompts)}, Contexts: {len(contexts)}",
        "",
        "-- Clear existing data (safe for fresh or existing DBs)",
        "DELETE FROM sandarb_access_logs;",
        "DELETE FROM agent_prompts;",
        "DELETE FROM agent_contexts;",
        "DELETE FROM prompt_versions;",
        "DELETE FROM prompts;",
        "DELETE FROM context_versions;",
        "DELETE FROM contexts;",
        "DELETE FROM agents;",
        "DELETE FROM organizations;",
        "",
        "-- Organizations",
    ]
    
    for o in orgs:
        parent = f"'{o['parent_id']}'" if o["parent_id"] else "NULL"
        lines.append(
            f"INSERT INTO organizations (id, name, slug, description, parent_id, is_root) VALUES "
            f"('{o['id']}', '{escape_sql(o['name'])}', '{o['slug']}', '{escape_sql(o['description'])}', {parent}, {str(o['is_root']).lower()});"
        )
    
    lines.append("\n-- Agents")
    for a in agents:
        approved_by = f"'{a['approved_by']}'" if a["approved_by"] else "NULL"
        approved_at = f"'{a['approved_at']}'" if a["approved_at"] else "NULL"
        lines.append(
            f"INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, status, approval_status, approved_by, approved_at, submitted_by, created_by, created_at, updated_at, tools_used, allowed_data_scopes, pii_handling, regulatory_scope) VALUES "
            f"('{a['id']}', '{a['org_id']}', '{a['agent_id']}', '{escape_sql(a['name'])}', '{escape_sql(a['description'])}', '{a['a2a_url']}', '{a['status']}', '{a['approval_status']}', {approved_by}, {approved_at}, '{a['submitted_by']}', '{a['created_by']}', '{a['created_at']}', '{a['updated_at']}', '{a['tools_used']}', '{a['allowed_data_scopes']}', {str(a['pii_handling']).lower()}, '{a['regulatory_scope']}');"
        )
    
    lines.append("\n-- Contexts (org_id from non-root orgs; Jinja2-templated contexts marked with 'templated' tag)")
    for c in contexts:
        lines.append(
            f"INSERT INTO contexts (id, name, description, org_id, data_classification, owner_team, created_by, created_at, is_active, updated_at, tags, regulatory_hooks) VALUES "
            f"('{c['id']}', '{escape_sql(c['name'])}', '{escape_sql(c['description'])}', '{c['org_id']}', '{c['data_classification']}', '{c['owner_team']}', '{c['created_by']}', '{c['created_at']}', {str(c['is_active']).lower()}, '{c['updated_at']}', '{c['tags']}', '{c['regulatory_hooks']}');"
        )
    
    lines.append("\n-- Context Versions")
    for v in context_versions:
        approved_by = f"'{v['approved_by']}'" if v.get("approved_by") else "NULL"
        approved_at = f"'{v['approved_at']}'" if v.get("approved_at") else "NULL"
        lines.append(
            f"INSERT INTO context_versions (id, context_id, version, content, sha256_hash, status, created_by, created_at, submitted_by, approved_by, approved_at, is_active, commit_message) VALUES "
            f"('{v['id']}', '{v['context_id']}', {v['version']}, '{escape_sql(v['content'])}', '{v['sha256_hash']}', '{v['status']}', '{v['created_by']}', '{v['created_at']}', '{v['submitted_by']}', {approved_by}, {approved_at}, {str(v['is_active']).lower()}, '{escape_sql(v['commit_message'])}');"
        )
    
    # Insert prompts first WITHOUT current_version_id to avoid FK violation
    lines.append("\n-- Prompts (without current_version_id)")
    for p in prompts:
        lines.append(
            f"INSERT INTO prompts (id, name, description, current_version_id, tags, created_by, created_at, updated_at) VALUES "
            f"('{p['id']}', '{escape_sql(p['name'])}', '{escape_sql(p['description'])}', NULL, '{p['tags']}', '{p['created_by']}', '{p['created_at']}', '{p['updated_at']}');"
        )
    
    # Insert prompt_versions (can reference prompts now)
    lines.append("\n-- Prompt Versions")
    for v in prompt_versions:
        approved_by = f"'{v['approved_by']}'" if v.get("approved_by") else "NULL"
        approved_at = f"'{v['approved_at']}'" if v.get("approved_at") else "NULL"
        lines.append(
            f"INSERT INTO prompt_versions (id, prompt_id, version, content, system_prompt, model, status, created_by, created_at, submitted_by, approved_by, approved_at, sha256_hash, commit_message) VALUES "
            f"('{v['id']}', '{v['prompt_id']}', {v['version']}, '{escape_sql(v['content'])}', '{escape_sql(v['system_prompt'])}', '{v['model']}', '{v['status']}', '{v['created_by']}', '{v['created_at']}', '{v['submitted_by']}', {approved_by}, {approved_at}, '{v['sha256_hash']}', '{escape_sql(v['commit_message'])}');"
        )
    
    # Now update prompts with their current_version_id (FK can now be resolved)
    lines.append("\n-- Update prompts with current_version_id")
    for p in prompts:
        if p.get("current_version_id"):
            lines.append(
                f"UPDATE prompts SET current_version_id = '{p['current_version_id']}' WHERE id = '{p['id']}';"
            )
    
    lines.append("\n-- Agent-Context Links")
    for ac in agent_contexts:
        lines.append(
            f"INSERT INTO agent_contexts (agent_id, context_id, created_at) VALUES "
            f"('{ac['agent_id']}', '{ac['context_id']}', '{ac['created_at']}') ON CONFLICT DO NOTHING;"
        )
    
    lines.append("\n-- Agent-Prompt Links")
    for ap in agent_prompts:
        lines.append(
            f"INSERT INTO agent_prompts (agent_id, prompt_id, created_at) VALUES "
            f"('{ap['agent_id']}', '{ap['prompt_id']}', '{ap['created_at']}') ON CONFLICT DO NOTHING;"
        )
    
    lines.append("\n-- Access Logs (for Last Communicated with Sandarb)")
    for log in access_logs:
        context_id = f"'{log['context_id']}'" if log["context_id"] else "NULL"
        prompt_id = f"'{log['prompt_id']}'" if log["prompt_id"] else "NULL"
        lines.append(
            f"INSERT INTO sandarb_access_logs (agent_id, trace_id, context_id, prompt_id, accessed_at, request_ip, metadata) VALUES "
            f"('{log['agent_id']}', '{log['trace_id']}', {context_id}, {prompt_id}, '{log['accessed_at']}', '{log['request_ip']}', '{log['metadata']}');"
        )
    
    lines.append("\n-- Done")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate Sandarb seed data SQL.")
    parser.add_argument("--orgs", type=int, default=int(os.environ.get("SEED_ORGS", DEFAULT_ORGS)))
    parser.add_argument("--agents", type=int, default=int(os.environ.get("SEED_AGENTS", DEFAULT_AGENTS)))
    parser.add_argument("--prompts", type=int, default=int(os.environ.get("SEED_PROMPTS", DEFAULT_PROMPTS)))
    parser.add_argument("--contexts", type=int, default=int(os.environ.get("SEED_CONTEXTS", DEFAULT_CONTEXTS)))
    args = parser.parse_args()
    
    print(f"Generating seed data: {args.orgs} orgs, {args.agents} agents, {args.prompts} prompts, {args.contexts} contexts...")
    
    # Generate data
    orgs = generate_organizations(args.orgs)
    agents = generate_agents(args.agents, orgs)
    contexts = generate_contexts(args.contexts, orgs)
    context_versions = generate_context_versions(contexts)
    prompts = generate_prompts(args.prompts)
    prompt_versions = generate_prompt_versions(prompts)
    agent_contexts, agent_prompts = generate_agent_links(agents, contexts, prompts)
    access_logs = generate_access_logs(agents, contexts, prompts)
    
    # Generate SQL
    sql = generate_sql(orgs, agents, contexts, context_versions, prompts, prompt_versions, agent_contexts, agent_prompts, access_logs)
    
    # Write to file
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(sql)
    
    print(f"Generated {len(orgs)} organizations")
    print(f"Generated {len(agents)} agents")
    print(f"Generated {len(contexts)} contexts with {len(context_versions)} versions")
    print(f"Generated {len(prompts)} prompts with {len(prompt_versions)} versions")
    print(f"Generated {len(agent_contexts)} agent-context links")
    print(f"Generated {len(agent_prompts)} agent-prompt links")
    print(f"Generated {len(access_logs)} access log entries")
    print(f"Output written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
