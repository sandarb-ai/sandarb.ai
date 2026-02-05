#!/usr/bin/env python3
"""
Enrich all prompts with detailed descriptions and link them to the organizations
whose agents use each prompt (via agent_prompts -> agents -> org_id -> organizations).
Loads .env; uses DATABASE_URL. Run from repo root: python scripts/update_prompt_descriptions.py
"""
import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv

load_dotenv()

from backend.db import query, execute

# Prompt name stem (substring in prompt name) -> rich description
# Format: What it governs | Regulatory context | Key boundaries | Use case
RICH_PROMPT_DESCRIPTIONS = {
    "retail-customer-support-playbook": (
        "Governs AI agents handling retail customer inquiries across digital and voice channels. "
        "Enforces identity verification before disclosing account details, prohibits financial/legal/tax advice, "
        "and requires escalation to human agents for disputes, fraud suspicion, or regulatory matters. "
        "Aligned with Reg E (electronic fund transfers), Reg Z (credit disclosures), and TILA. "
        "Tone must be polite, professional, and empathetic while maintaining firm compliance boundaries."
    ),
    "kyc-identity-verification-standard": (
        "Governs AI agents performing Know Your Customer (KYC) and Customer Identification Program (CIP) verification. "
        "Defines acceptable government-issued ID types, 90-day address verification window, and beneficial ownership "
        "requirements for entities (25%+ threshold per FinCEN CDD rule). Agents must reject expired documents, "
        "flag inconsistencies for compliance review, and never approve accounts without complete required documentation. "
        "Supports onboarding, periodic refresh, and enhanced due diligence for PEPs and high-risk customers."
    ),
    "aml-alert-triage-playbook": (
        "Governs AI agents triaging Anti-Money Laundering (AML) alerts for compliance review. "
        "Enforces Currency Transaction Report (CTR) thresholds ($10K+), structuring detection rules, "
        "and Suspicious Activity Report (SAR) escalation procedures. Critical requirement: agents must NEVER "
        "disclose to any party that a SAR has been, may be, or will be filed (BSA/FinCEN). "
        "High-risk alerts must be escalated within 24 hours; all triage decisions require documented rationale."
    ),
    "pre-trade-compliance-playbook": (
        "Governs AI agents enforcing pre-trade compliance checks on trading desks. "
        "Ensures orders are blocked when they would breach single-name concentration limits, sector limits, "
        "or Value-at-Risk (VaR) thresholds defined per desk policy. Breaches must be escalated to Risk and Compliance "
        "immediately. Agents must not provide advice on circumventing limits or structuring trades to avoid controls. "
        "Aligned with Volcker Rule (proprietary trading), MiFID II (EU), and firm risk appetite frameworks."
    ),
    "suitability-advisor-reg-bi": (
        "Governs AI agents providing investment recommendations under SEC Regulation Best Interest (Reg BI). "
        "Requires agents to assess customer risk tolerance, investment objectives, and financial situation before "
        "any recommendation. All recommendations must be documented with rationale showing the product is in the "
        "customer's best interest—not merely suitable. Agents must disclose conflicts of interest and must never "
        "recommend products that are unsuitable for the customer's profile. Supports wealth, advisory, and retail distribution."
    ),
    "dispute-resolution-reg-e": (
        "Governs AI agents handling consumer disputes under Regulation E (Electronic Fund Transfer Act). "
        "Enforces provisional credit timelines (10 business days for most disputes), final determination deadlines "
        "(45 days standard, 90 days for new accounts/POS/foreign transactions), and Visa/Mastercard chargeback rules. "
        "Agents must never disclose internal escalation status or SAR-related information to customers. "
        "Escalate to Compliance when fraud patterns emerge or regulatory reporting may be required."
    ),
    "client-reporting-playbook": (
        "Governs AI agents generating client-facing reports for advisory, wealth, and institutional clients. "
        "Reports must use only approved, reconciled data sources and follow disclosed methodology consistently. "
        "Material Non-Public Information (MNPI) must never be included. Agents must ensure accuracy, clarity, "
        "and compliance with client agreements and regulatory disclosure requirements. "
        "Supports portfolio performance, holdings, transaction history, and fee transparency reporting."
    ),
    "limit-monitoring-escalation": (
        "Governs AI agents monitoring intraday trading limits and escalating breaches in real time. "
        "VaR, concentration, and position limits must be tracked continuously; any breach triggers immediate alert. "
        "Escalation to Risk must occur within 15 minutes of detection. All breaches and remediation actions "
        "must be logged with timestamps for audit trail. No limit override is permitted without documented, "
        "pre-approved exception from Risk or senior management."
    ),
    "document-review-policy": (
        "Governs AI agents reviewing identity and corporate documents for onboarding and compliance verification. "
        "Acceptable documents: government-issued photo ID (passport, driver's license), utility bills or bank statements "
        "for address (within 90 days), certificate of incorporation and board resolutions for entities. "
        "Agents must reject expired, damaged, or illegible documents and flag potential forgeries or inconsistencies. "
        "Aligned with CIP requirements, firm document acceptance standards, and regional regulatory variations."
    ),
    "regulatory-reporting-playbook": (
        "Governs AI agents preparing and validating regulatory submissions across jurisdictions. "
        "Ensures accuracy of data, adherence to approved calculation methodologies, and compliance with filing deadlines. "
        "Draft filings and work-in-progress reports must never be disclosed externally. "
        "Supports Form PF, Form ADV, MiFID II transaction reporting, EMIR, and other jurisdictional requirements. "
        "All submissions must maintain complete audit trail from source data to final filing."
    ),
    "exception-handling-procedures": (
        "Governs AI agents triaging and escalating operational exceptions across business processes. "
        "Exceptions must be classified by severity (Low/Medium/High/Critical) per the firm's exception matrix. "
        "Critical exceptions require escalation to Compliance and Risk within 1 hour; all others per SLA. "
        "Every exception must be documented with root cause, resolution, and preventive measures. "
        "Agents must never suppress, hide, or downgrade exception severity without documented approval."
    ),
    "identity-verification-cip": (
        "Governs AI agents performing Customer Identification Program (CIP) verification per BSA/PATRIOT Act. "
        "Verification must use approved documentary methods (government ID) or non-documentary methods (credit bureau, "
        "public records) where permitted. Agents must flag synthetic identity indicators, fraud patterns, "
        "and inconsistencies for Compliance review. No account may be approved without successful identity verification. "
        "Enhanced due diligence required for PEPs, high-risk geographies, and complex ownership structures."
    ),
    "transaction-review-sar": (
        "Governs AI agents reviewing transactions for suspicious activity and potential SAR filing. "
        "Applies AML transaction monitoring rules, sanctions screening (OFAC, UN, EU lists), and structuring detection. "
        "When suspicious activity is identified, agents must document findings and escalate to BSA/AML Compliance. "
        "CRITICAL: Agents must NEVER disclose to any party—including the customer—that a SAR has been, may be, "
        "or will be filed. SAR filing decisions and timelines (30 days from detection) are handled by Compliance only."
    ),
    "audit-trail-governance": (
        "Governs AI agents maintaining audit trail and data lineage for governance and regulatory examinations. "
        "All material decisions, data transformations, and rationale must be recorded with timestamps and user attribution. "
        "Audit records must be immutable—no alteration or deletion permitted. Retention period: minimum 7 years "
        "or per jurisdictional requirements (whichever is longer). Supports SEC, FINRA, FCA, and internal audit "
        "examination readiness. Lineage must trace from source systems through all transformations to final output."
    ),
    "risk-reporting-playbook": (
        "Governs AI agents producing risk and control reports for management, risk committees, and regulators. "
        "Reports must use approved risk models, validated data sources, and documented methodologies. "
        "Material breaches, model limitations, and data quality issues must be disclosed and escalated promptly. "
        "Agents must never misrepresent risk metrics or omit material information. "
        "Supports VaR reporting, stress testing, credit risk, operational risk, and regulatory capital calculations."
    ),
}


def get_org_names_for_prompt(prompt_id: str) -> list[str]:
    """Return distinct organization names for agents that are linked to this prompt (via agent_prompts)."""
    try:
        rows = query(
            """
            SELECT DISTINCT o.name
            FROM organizations o
            JOIN agents a ON a.org_id = o.id
            JOIN agent_prompts ap ON ap.agent_id = a.id
            WHERE ap.prompt_id = %s
            ORDER BY o.name
            """,
            (prompt_id,),
        )
        return [r["name"] for r in rows]
    except Exception as e:
        if "agent_prompts" in str(e) and ("does not exist" in str(e) or "undefined_table" in str(e).lower()):
            return []
        raise


def extract_region_and_topic(name: str) -> tuple[str, str]:
    """Extract region and topic from prompt name like 'uk-transaction-review-sar-guide-4692'."""
    parts = name.lower().replace("_", "-").split("-")
    # Drop trailing numeric suffix
    while parts and parts[-1].isdigit():
        parts.pop()
    # Known regions
    regions = {"americas", "emea", "apac", "uk", "latam", "global", "north-america", "europe", "asia"}
    region = None
    if parts and parts[0] in regions:
        region = parts.pop(0).upper()
        if region == "UK":
            region = "UK/EMEA"
        elif region == "LATAM":
            region = "Latin America"
        elif region == "APAC":
            region = "Asia-Pacific"
    # Drop common suffixes like 'guide', 'playbook', 'runbook', 'standard', 'policy'
    suffixes = {"guide", "playbook", "runbook", "standard", "policy", "procedures", "handbook"}
    while parts and parts[-1] in suffixes:
        parts.pop()
    topic = " ".join(parts) if parts else "agent governance"
    return region, topic


def base_enriched_description(name: str, current_desc: str | None) -> str:
    """Derive a rich description from prompt name (and optional current description)."""
    name_lower = name.lower()
    for stem, rich in RICH_PROMPT_DESCRIPTIONS.items():
        if stem in name_lower:
            return rich
    # Fallback: use current description if it's already substantial
    if current_desc and len(current_desc) > 200:
        return current_desc.strip()
    # Build a contextual description from the name
    region, topic = extract_region_and_topic(name)
    topic_title = topic.replace("-", " ").title()
    region_text = f" for {region} operations" if region else ""
    return (
        f"Governed system prompt for {topic_title}{region_text}. "
        f"Defines agent behavior boundaries, compliance requirements, and escalation procedures. "
        f"This prompt is versioned and approved under the firm's AI governance framework. "
        f"Agents using this prompt must adhere to the specified guardrails and may only access "
        f"data and perform actions within the defined scope. All interactions are logged for audit."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich prompt descriptions and link to org names.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be updated without writing.")
    args = parser.parse_args()

    rows = query("SELECT id, name, description FROM prompts ORDER BY name")
    if not rows:
        print("No prompts found.")
        return

    updated = 0
    for r in rows:
        pid, name, desc = r["id"], r["name"], r.get("description")
        base = base_enriched_description(name, desc)
        org_names = get_org_names_for_prompt(pid)
        if org_names:
            org_list = ", ".join(org_names)
            if len(org_list) > 200:
                org_list = ", ".join(org_names[:5]) + f" (+{len(org_names) - 5} more)"
            final_desc = f"{base} Used by agents in: {org_list}."
        else:
            final_desc = base

        if not args.dry_run:
            execute(
                "UPDATE prompts SET description = %s, updated_at = NOW() WHERE id = %s",
                (final_desc, pid),
            )
        updated += 1
        snippet = (name[:50] + "…") if len(name) > 50 else name
        org_info = f" → orgs: {len(org_names)}" if org_names else " (no linked orgs)"
        print(f"  {snippet}{org_info}")

    print(f"{'Would update' if args.dry_run else 'Updated'} {updated} prompt(s).")


if __name__ == "__main__":
    main()
