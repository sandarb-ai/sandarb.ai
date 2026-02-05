#!/usr/bin/env python3
"""
Update all organizations with more detailed names and descriptions.
Loads .env; uses DATABASE_URL. Run from repo root: python scripts/update_org_descriptions.py
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv

load_dotenv()

from backend.db import query, execute

# Slug -> (detailed name, detailed description) for known org types
DETAILED_ORGS = {
    "root": (
        "Sandarb HQ",
        "Corporate headquarters and group-level governance. Sets enterprise-wide AI agent policies, approves cross-LOB contexts and prompts, and oversees the agent registry and compliance framework.",
    ),
    "retail-banking": (
        "Retail Banking",
        "Consumer banking division responsible for deposits, lending, branch operations, and digital channels. Governs AI agents used for customer support, onboarding, dispute resolution, and retail product recommendations under Reg E, Reg Z, and TILA.",
    ),
    "investment-banking": (
        "Investment Banking",
        "M&A, capital markets, and advisory. Covers underwriting, syndication, and corporate finance. AI agents here are governed for pre-trade compliance, trading limits, Volcker Rule adherence, and deal-related context and prompts.",
    ),
    "wealth-management": (
        "Wealth Management",
        "Private banking, advisory, and portfolio management for high-net-worth and family office clients. Governs suitability and Reg BI–aligned agents, client reporting, and investment recommendation prompts and context.",
    ),
    "legal-compliance": (
        "Legal & Compliance",
        "Legal, regulatory, and compliance oversight across the firm. Owns KYC/CIP, AML, sanctions, regulatory reporting, and policy. AI agents are governed for document verification, alert triage, and compliance-check prompts and context.",
    ),
    "legal-and-compliance": (
        "Legal & Compliance",
        "Legal, regulatory, and compliance oversight across the firm. Owns KYC/CIP, AML, sanctions, regulatory reporting, and policy. AI agents are governed for document verification, alert triage, and compliance-check prompts and context.",
    ),
    "risk-management": (
        "Risk Management",
        "Enterprise risk, credit risk, operational risk, and model risk. Sets risk limits, VaR, and concentration policies. Governs AI agents used for risk reporting, limit monitoring, and risk-related context and prompts.",
    ),
    "operations": (
        "Operations",
        "Back-office, settlements, confirmations, and operations. Governs AI agents for settlement reconciliation, trade support, exception handling, and operational procedures and context.",
    ),
    "north-america-retail": (
        "North America Retail",
        "Regional retail distribution and digital channels for North America. Governs agents for regional customer support, onboarding, and retail product context and prompts.",
    ),
    "apac-capital-markets": (
        "APAC Capital Markets",
        "Asia-Pacific capital markets and sales. Governs agents for regional trading, client onboarding, and APAC-specific compliance and context.",
    ),
    "emea-compliance": (
        "EMEA Compliance",
        "EMEA regulatory and compliance programs. Governs agents for MiFID II, GDPR, and regional KYC/AML context and prompts.",
    ),
    "product-control": (
        "Product Control",
        "Product control and P&L. Governs agents used for P&L attribution, valuation, and control reporting context.",
    ),
    "treasury": (
        "Treasury",
        "Treasury and liquidity management. Governs agents for liquidity reporting, funding, and treasury operations context.",
    ),
    "middle-office": (
        "Middle Office",
        "Trade support and middle office. Governs agents for confirmations, settlement instructions, and middle-office procedures.",
    ),
    "consumer-lending": (
        "Consumer Lending",
        "Consumer and mortgage lending. Governs agents for application intake, underwriting support, and lending policy context under TILA, RESPA, and QM.",
    ),
    "commercial-banking": (
        "Commercial Banking",
        "Commercial and corporate banking. Governs agents for commercial onboarding, credit, and corporate banking context.",
    ),
    "markets-trading": (
        "Markets & Trading",
        "Sales, trading, and market-making. Governs agents for pre-trade compliance, limit monitoring, and trading-desk context and prompts.",
    ),
    "markets-and-trading": (
        "Markets & Trading",
        "Sales, trading, and market-making. Governs agents for pre-trade compliance, limit monitoring, and trading-desk context and prompts.",
    ),
    "private-banking": (
        "Private Banking",
        "High-net-worth and family office. Governs suitability and advisory agents and client-specific context.",
    ),
    "asset-management": (
        "Asset Management",
        "Institutional asset management. Governs agents for portfolio management, reporting, and investment context.",
    ),
    "financial-crime-compliance": (
        "Financial Crime Compliance",
        "AML, sanctions, and financial crime. Governs agents for alert triage, SAR filing, OFAC screening, and AML context and prompts.",
    ),
    "regulatory-reporting": (
        "Regulatory Reporting",
        "Regulatory reporting and disclosure. Governs agents for regulatory filings and reporting context.",
    ),
    "internal-audit": (
        "Internal Audit",
        "Internal audit and assurance. Governs agents used for audit support and audit-trail context.",
    ),
    "technology-operations": (
        "Technology & Operations",
        "Technology and operations shared services. Governs agents for platform, data, and operations context.",
    ),
    "technology-and-operations": (
        "Technology & Operations",
        "Technology and operations shared services. Governs agents for platform, data, and operations context.",
    ),
    "north-america-markets": (
        "North America Markets",
        "Regional markets operations and governance for North America. Governs agents for regional trading and compliance context.",
    ),
    "emea-markets": (
        "EMEA Markets",
        "Regional markets operations and governance for EMEA. Governs agents for regional trading and MiFID context.",
    ),
    "apac-wealth": (
        "APAC Wealth",
        "Asia-Pacific wealth management. Governs agents for regional advisory and suitability context.",
    ),
    "latin-america-operations": (
        "Latin America Operations",
        "Latin America operations and governance. Governs agents for regional onboarding and compliance context.",
    ),
    "global-trade-finance": (
        "Global Trade Finance",
        "Global trade finance and trade services. Governs agents for trade documentation and trade-finance context.",
    ),
    "securities-services": (
        "Securities Services",
        "Securities services, custody, and clearing. Governs agents for settlement and custody context.",
    ),
    "prime-brokerage": (
        "Prime Brokerage",
        "Prime brokerage and prime services. Governs agents for margin, financing, and prime context.",
    ),
    "structured-products": (
        "Structured Products",
        "Structured products and solutions. Governs agents for structuring and product context.",
    ),
    "equity-research": (
        "Equity Research",
        "Equity research and analysis. Governs agents for research and disclosure context.",
    ),
    "fixed-income": (
        "Fixed Income",
        "Fixed income sales and trading. Governs agents for fixed income limits and context.",
    ),
    "fx-commodities": (
        "FX & Commodities",
        "FX and commodities. Governs agents for FX/commodity limits and context.",
    ),
    "fx-and-commodities": (
        "FX & Commodities",
        "FX and commodities. Governs agents for FX/commodity limits and context.",
    ),
    "derivatives": (
        "Derivatives",
        "Derivatives trading and risk. Governs agents for derivatives limits and context.",
    ),
    "client-onboarding": (
        "Client Onboarding",
        "Client onboarding and KYC. Governs agents for CIP, document acceptance, and onboarding context.",
    ),
    "documentation": (
        "Documentation",
        "Documentation and legal documentation. Governs agents for document generation and review context.",
    ),
    "collateral-management": (
        "Collateral Management",
        "Collateral management and margin. Governs agents for collateral and margin context.",
    ),
    "valuation-control": (
        "Valuation Control",
        "Valuation control and independent price verification. Governs agents for valuation context.",
    ),
    "model-risk": (
        "Model Risk",
        "Model risk management. Governs agents for model validation and model-risk context.",
    ),
    "operational-risk": (
        "Operational Risk",
        "Operational risk and control. Governs agents for op risk reporting and context.",
    ),
    "credit-risk": (
        "Credit Risk",
        "Credit risk and counterparty risk. Governs agents for credit limits and context.",
    ),
    "market-risk": (
        "Market Risk",
        "Market risk and VaR. Governs agents for VaR, limits, and market-risk context.",
    ),
    "regional-operations-emea": (
        "Regional Operations EMEA",
        "Regional operations and governance for EMEA. Governs agents for regional settlements and operations context.",
    ),
    "regional-operations-apac": (
        "Regional Operations APAC",
        "Regional operations and governance for APAC. Governs agents for regional operations context.",
    ),
    "group-finance": (
        "Group Finance",
        "Group-level finance and reporting. Governs agents for group P&L and reporting context.",
    ),
    "group-risk": (
        "Group Risk",
        "Group-level risk oversight. Governs agents for group risk reporting and context.",
    ),
}


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().strip()).strip("-")


def get_detailed(slug: str, current_name: str, current_desc: str | None) -> tuple[str, str]:
    if slug in DETAILED_ORGS:
        return DETAILED_ORGS[slug]
    # Fallback: keep name, expand description from name or generic
    name = current_name
    if current_desc and len(current_desc) > 80:
        return name, current_desc
    base = current_name.strip()
    desc = (
        f"{base} line of business. Governs AI agents, contexts, and prompts for this unit. "
        "Ensures agent registry entries, approved contexts, and prompts align with compliance and risk policies."
    )
    return name, desc


def main() -> None:
    rows = query("SELECT id, name, slug, description FROM organizations ORDER BY slug")
    if not rows:
        print("No organizations found.")
        return

    updated = 0
    for r in rows:
        oid, name, slug, desc = r["id"], r["name"], r["slug"], r.get("description")
        new_name, new_desc = get_detailed(slug, name, desc)
        execute(
            "UPDATE organizations SET name = %s, description = %s, updated_at = NOW() WHERE id = %s",
            (new_name, new_desc, oid),
        )
        updated += 1
        print(f"  {slug}: {new_name[:50]}...")

    print(f"Updated {updated} organization(s).")


if __name__ == "__main__":
    main()
