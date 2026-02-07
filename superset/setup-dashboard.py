#!/usr/bin/env python3
"""
Create Sandarb AI Governance Dashboard in Superset.

Connects ClickHouse, creates datasets, charts, and a dashboard
via the Superset REST API. Idempotent — safe to run multiple times.

Usage:
    python3 superset/setup-dashboard.py [--superset-url http://localhost:8088]
"""

import argparse
import json
import sys
import time
import requests

# ── Config ──────────────────────────────────────────────────────────

SUPERSET_USER = "admin"
SUPERSET_PASS = "admin"
CLICKHOUSE_URI = "clickhousedb://default:sandarb@host.docker.internal:8123/sandarb"
DB_NAME = "Sandarb ClickHouse"
DASHBOARD_TITLE = "Sandarb AI Governance"

# ── Helpers ─────────────────────────────────────────────────────────

class SupersetAPI:
    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.token = ""
        self.csrf = ""

    def login(self):
        r = self.session.post(f"{self.base}/api/v1/security/login", json={
            "username": SUPERSET_USER, "password": SUPERSET_PASS, "provider": "db"
        })
        r.raise_for_status()
        self.token = r.json()["access_token"]
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        })
        # CSRF
        r2 = self.session.get(f"{self.base}/api/v1/security/csrf_token/")
        r2.raise_for_status()
        self.csrf = r2.json()["result"]
        self.session.headers["X-CSRFToken"] = self.csrf
        # Need Referer for CSRF
        self.session.headers["Referer"] = self.base
        print(f"  Logged in to Superset at {self.base}")

    def get(self, path, **kw):
        r = self.session.get(f"{self.base}{path}", **kw)
        r.raise_for_status()
        return r.json()

    def post(self, path, **kw):
        r = self.session.post(f"{self.base}{path}", **kw)
        if r.status_code >= 400:
            print(f"  POST {path} => {r.status_code}: {r.text[:500]}")
        r.raise_for_status()
        return r.json()

    def put(self, path, **kw):
        r = self.session.put(f"{self.base}{path}", **kw)
        if r.status_code >= 400:
            print(f"  PUT {path} => {r.status_code}: {r.text[:500]}")
        r.raise_for_status()
        return r.json()


# ── Step 1: Database Connection ─────────────────────────────────────

def ensure_database(api: SupersetAPI) -> int:
    """Create or find the ClickHouse database connection."""
    dbs = api.get("/api/v1/database/")
    for db in dbs.get("result", []):
        if db["database_name"] == DB_NAME:
            print(f"  Database '{DB_NAME}' already exists (id={db['id']})")
            return db["id"]

    result = api.post("/api/v1/database/", json={
        "database_name": DB_NAME,
        "engine": "clickhousedb",
        "sqlalchemy_uri": CLICKHOUSE_URI,
        "expose_in_sqllab": True,
        "allow_ctas": False,
        "allow_cvas": False,
        "allow_dml": False,
        "allow_run_async": True,
        "extra": json.dumps({
            "engine_params": {"connect_args": {"verify": False}},
            "metadata_params": {},
            "schemas_allowed_for_file_upload": [],
        }),
    })
    db_id = result["id"]
    print(f"  Created database '{DB_NAME}' (id={db_id})")
    return db_id


# ── Step 2: Datasets ────────────────────────────────────────────────

DATASETS = [
    {"table_name": "events",           "description": "Core event log — all governance events"},
    {"table_name": "agent_activity",    "description": "Agent activity aggregated by hour"},
    {"table_name": "daily_kpis",        "description": "Daily KPIs per org/event_type/classification"},
    {"table_name": "denial_reasons",    "description": "Denial analytics by reason and day"},
    {"table_name": "governance_proofs", "description": "Governance hash delivery tracking"},
    {"table_name": "top_contexts",      "description": "Most-injected contexts by day"},
]


def ensure_datasets(api: SupersetAPI, db_id: int) -> dict[str, int]:
    """Create datasets for all ClickHouse tables. Returns {table_name: dataset_id}."""
    existing = api.get("/api/v1/dataset/", params={"q": json.dumps({"filters": [{"col": "database", "opr": "rel_o_m", "value": db_id}]})})
    existing_map = {d["table_name"]: d["id"] for d in existing.get("result", [])}

    result_map = {}
    for ds in DATASETS:
        name = ds["table_name"]
        if name in existing_map:
            print(f"  Dataset '{name}' already exists (id={existing_map[name]})")
            result_map[name] = existing_map[name]
            continue
        r = api.post("/api/v1/dataset/", json={
            "database": db_id,
            "table_name": name,
            "schema": "sandarb",
        })
        ds_id = r["id"]
        print(f"  Created dataset '{name}' (id={ds_id})")
        result_map[name] = ds_id

    return result_map


# ── Step 3: Charts ──────────────────────────────────────────────────

def build_charts(datasets: dict[str, int]) -> list[dict]:
    """Define all chart specs. Returns list of chart payloads."""
    ev = datasets["events"]
    aa = datasets["agent_activity"]
    dk = datasets["daily_kpis"]
    dr = datasets["denial_reasons"]
    gp = datasets["governance_proofs"]
    tc = datasets["top_contexts"]

    charts = []

    # 1. Event Timeline — line chart showing events over time
    charts.append({
        "slice_name": "Event Timeline",
        "description": "All governance events over time, broken down by event type",
        "viz_type": "echarts_timeseries_line",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "echarts_timeseries_line",
            "x_axis": "event_time",
            "time_grain_sqla": "PT1H",
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Event Count"}],
            "groupby": ["event_type"],
            "row_limit": 10000,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "rich_tooltip": True,
            "show_legend": True,
            "legendType": "scroll",
            "legendOrientation": "top",
            "x_axis_title": "",
            "y_axis_title": "Events",
            "y_axis_title_margin": 40,
            "truncate_metric": True,
            "show_empty_columns": True,
        }),
    })

    # 2. Events by Type — pie/donut chart
    charts.append({
        "slice_name": "Events by Type",
        "description": "Distribution of governance events by type",
        "viz_type": "pie",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "pie",
            "groupby": ["event_type"],
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Count"},
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "donut": True,
            "show_labels": True,
            "show_legend": True,
            "label_type": "key_percent",
            "number_format": "SMART_NUMBER",
            "outerRadius": 80,
            "innerRadius": 40,
        }),
    })

    # 3. Agent Activity Heatmap — events per agent per hour
    charts.append({
        "slice_name": "Agent Activity Over Time",
        "description": "Agent event counts aggregated by hour",
        "viz_type": "echarts_timeseries_bar",
        "datasource_id": aa,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{aa}__table",
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "hour",
            "time_grain_sqla": "PT1H",
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "event_count"}, "aggregate": "SUM", "label": "Events"}],
            "groupby": ["agent_name"],
            "row_limit": 10000,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "stack": True,
            "show_legend": True,
            "legendType": "scroll",
            "legendOrientation": "top",
            "rich_tooltip": True,
            "x_axis_title": "",
            "y_axis_title": "Events",
            "show_empty_columns": True,
        }),
    })

    # 4. Top Agents — bar chart
    charts.append({
        "slice_name": "Top Agents by Events",
        "description": "Most active agents by total event count",
        "viz_type": "echarts_timeseries_bar",
        "datasource_id": aa,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{aa}__table",
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "hour",
            "time_grain_sqla": "P1D",
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "event_count"}, "aggregate": "SUM", "label": "Total Events"}],
            "groupby": ["agent_name"],
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "show_legend": True,
            "legendOrientation": "top",
            "rich_tooltip": True,
            "stack": False,
        }),
    })

    # 5. Inject Success vs Denied — pie
    charts.append({
        "slice_name": "Inject Success vs Denied",
        "description": "Ratio of successful context injections to denied ones",
        "viz_type": "pie",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "pie",
            "adhoc_filters": [{"expressionType": "SIMPLE", "subject": "event_type", "operator": "IN", "comparator": ["INJECT_SUCCESS", "INJECT_DENIED"], "clause": "WHERE"}],
            "groupby": ["event_type"],
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Count"},
            "row_limit": 10,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "donut": True,
            "show_labels": True,
            "show_legend": True,
            "label_type": "key_value_percent",
            "number_format": "SMART_NUMBER",
        }),
    })

    # 6. Denial Reasons — bar chart (stacked by reason over time)
    charts.append({
        "slice_name": "Denial Reasons",
        "description": "Why context injections or prompts were denied",
        "viz_type": "echarts_timeseries_bar",
        "datasource_id": dr,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{dr}__table",
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "day",
            "time_grain_sqla": "P1D",
            "groupby": ["denial_reason"],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "denial_count"}, "aggregate": "SUM", "label": "Denials"}],
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "show_legend": True,
            "legendOrientation": "top",
            "rich_tooltip": True,
            "stack": True,
            "show_empty_columns": True,
        }),
    })

    # 7. Top Contexts — bar chart (stacked by context over time)
    charts.append({
        "slice_name": "Most Injected Contexts",
        "description": "Most frequently injected contexts across all agents",
        "viz_type": "echarts_timeseries_bar",
        "datasource_id": tc,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{tc}__table",
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "day",
            "time_grain_sqla": "P1D",
            "groupby": ["context_name"],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "inject_count"}, "aggregate": "SUM", "label": "Injections"}],
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "show_legend": True,
            "legendOrientation": "top",
            "rich_tooltip": True,
            "stack": True,
            "show_empty_columns": True,
        }),
    })

    # 8. Governance Proofs by Context — table view
    charts.append({
        "slice_name": "Governance Proof Delivery",
        "description": "Governance hash delivery counts per context and agent",
        "viz_type": "table",
        "datasource_id": gp,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{gp}__table",
            "viz_type": "table",
            "groupby": ["context_name", "agent_id"],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "delivery_count"}, "aggregate": "SUM", "label": "Deliveries"}],
            "row_limit": 100,
            "time_range": "No filter",
            "order_desc": True,
            "table_timestamp_format": "smart_date",
            "page_length": 20,
            "include_search": True,
            "show_cell_bars": True,
            "color_pn": True,
        }),
    })

    # 9. Events by Category — pie
    charts.append({
        "slice_name": "Events by Category",
        "description": "Distribution of events by category (inject, audit, prompt-lifecycle)",
        "viz_type": "pie",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "pie",
            "groupby": ["event_category"],
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Count"},
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "donut": True,
            "show_labels": True,
            "show_legend": True,
            "label_type": "key_percent",
        }),
    })

    # 10. Data Classification Distribution — pie
    charts.append({
        "slice_name": "Data Classification Distribution",
        "description": "Events broken down by data classification level",
        "viz_type": "pie",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "pie",
            "groupby": ["data_classification"],
            "adhoc_filters": [{"expressionType": "SIMPLE", "subject": "data_classification", "operator": "IS NOT NULL", "comparator": "", "clause": "WHERE"}],
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Count"},
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "donut": True,
            "show_labels": True,
            "show_legend": True,
            "label_type": "key_percent",
        }),
    })

    # 11. Total Events — big number
    charts.append({
        "slice_name": "Total Events",
        "description": "Total governance events recorded",
        "viz_type": "big_number_total",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "big_number_total",
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Total Events"},
            "time_range": "No filter",
            "header_font_size": 0.4,
            "subheader_font_size": 0.15,
        }),
    })

    # 12. Inject Success Count — big number
    charts.append({
        "slice_name": "Successful Injections",
        "description": "Total successful context injections",
        "viz_type": "big_number_total",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "big_number_total",
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Injections"},
            "adhoc_filters": [{"expressionType": "SIMPLE", "subject": "event_type", "operator": "==", "comparator": "INJECT_SUCCESS", "clause": "WHERE"}],
            "time_range": "No filter",
            "header_font_size": 0.4,
            "subheader_font_size": 0.15,
        }),
    })

    # 13. Denied Count — big number
    charts.append({
        "slice_name": "Denied Injections",
        "description": "Total denied context injections",
        "viz_type": "big_number_total",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "big_number_total",
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Denied"},
            "adhoc_filters": [{"expressionType": "SIMPLE", "subject": "event_type", "operator": "==", "comparator": "INJECT_DENIED", "clause": "WHERE"}],
            "time_range": "No filter",
            "header_font_size": 0.4,
            "subheader_font_size": 0.15,
        }),
    })

    # 14. Unique Agents — big number
    charts.append({
        "slice_name": "Unique Agents",
        "description": "Number of distinct agents with governance events",
        "viz_type": "big_number_total",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "big_number_total",
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "agent_id"}, "aggregate": "COUNT_DISTINCT", "label": "Agents"},
            "time_range": "No filter",
            "header_font_size": 0.4,
            "subheader_font_size": 0.15,
        }),
    })

    # 15. Recent Events — table
    charts.append({
        "slice_name": "Recent Events",
        "description": "Latest governance events with details",
        "viz_type": "table",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "table",
            "all_columns": ["event_time", "event_type", "event_category", "agent_id", "context_name", "data_classification", "denial_reason"],
            "row_limit": 50,
            "time_range": "No filter",
            "order_by_cols": [json.dumps(["event_time", False])],
            "order_desc": True,
            "table_timestamp_format": "smart_date",
            "page_length": 15,
            "include_search": True,
            "show_cell_bars": False,
        }),
    })

    # 16. Prompt Usage — bar chart over time
    charts.append({
        "slice_name": "Prompt Usage",
        "description": "Most used prompts by agents",
        "viz_type": "echarts_timeseries_bar",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "event_time",
            "time_grain_sqla": "P1D",
            "adhoc_filters": [{"expressionType": "SIMPLE", "subject": "event_type", "operator": "==", "comparator": "PROMPT_USED", "clause": "WHERE"}],
            "groupby": ["prompt_name"],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Uses"}],
            "row_limit": 20,
            "time_range": "No filter",
            "color_scheme": "supersetColors",
            "show_legend": True,
            "legendOrientation": "top",
            "rich_tooltip": True,
            "stack": True,
            "show_empty_columns": True,
        }),
    })

    # 17. Events with Trend — big number with trendline
    charts.append({
        "slice_name": "Events Trend",
        "description": "Event count with trend over time",
        "viz_type": "big_number",
        "datasource_id": ev,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{ev}__table",
            "viz_type": "big_number",
            "metric": {"expressionType": "SIMPLE", "column": {"column_name": "event_id"}, "aggregate": "COUNT", "label": "Events"},
            "time_range": "No filter",
            "granularity_sqla": "event_time",
            "time_grain_sqla": "PT1H",
            "header_font_size": 0.4,
            "subheader_font_size": 0.15,
        }),
    })

    # 18. Agent Events Table — detailed agent breakdown
    charts.append({
        "slice_name": "Agent Event Breakdown",
        "description": "Event counts per agent and event type",
        "viz_type": "table",
        "datasource_id": aa,
        "datasource_type": "table",
        "params": json.dumps({
            "datasource": f"{aa}__table",
            "viz_type": "table",
            "groupby": ["agent_name", "event_type"],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "event_count"}, "aggregate": "SUM", "label": "Events"}],
            "row_limit": 100,
            "time_range": "No filter",
            "order_desc": True,
            "page_length": 15,
            "include_search": True,
            "show_cell_bars": True,
        }),
    })

    return charts


def ensure_charts(api: SupersetAPI, chart_specs: list[dict]) -> list[int]:
    """Create charts, skip if names already exist. Returns list of chart IDs."""
    existing = api.get("/api/v1/chart/", params={"q": json.dumps({"page_size": 100})})
    existing_map = {c["slice_name"]: c["id"] for c in existing.get("result", [])}

    chart_ids = []
    for spec in chart_specs:
        name = spec["slice_name"]
        if name in existing_map:
            print(f"  Chart '{name}' already exists (id={existing_map[name]})")
            chart_ids.append(existing_map[name])
            continue
        r = api.post("/api/v1/chart/", json=spec)
        cid = r["id"]
        print(f"  Created chart '{name}' (id={cid})")
        chart_ids.append(cid)

    return chart_ids


# ── Step 4: Dashboard ───────────────────────────────────────────────

def ensure_dashboard(api: SupersetAPI, chart_ids: list[int], chart_specs: list[dict]) -> int:
    """Create or update the governance dashboard."""
    existing = api.get("/api/v1/dashboard/", params={"q": json.dumps({"filters": [{"col": "dashboard_title", "opr": "eq", "value": DASHBOARD_TITLE}]})})
    dash_id = None
    for d in existing.get("result", []):
        if d["dashboard_title"] == DASHBOARD_TITLE:
            dash_id = d["id"]
            print(f"  Dashboard '{DASHBOARD_TITLE}' already exists (id={dash_id}), updating...")
            break

    # Build position map with a nice layout
    # Row 1: 4 KPI big numbers (Total Events, Injections, Denied, Unique Agents)
    # Row 2: Event Timeline (full width)
    # Row 3: Events by Type | Inject Success vs Denied | Events by Category
    # Row 4: Agent Activity Over Time (full width)
    # Row 5: Top Agents | Denial Reasons
    # Row 6: Most Injected Contexts | Prompt Usage
    # Row 7: Data Classification | Governance Proof Delivery
    # Row 8: Recent Events (full width)
    # Row 9: Agent Event Breakdown (full width)

    # Map chart names to IDs
    name_to_id = {}
    for spec, cid in zip(chart_specs, chart_ids):
        name_to_id[spec["slice_name"]] = cid

    # Dashboard layout using Superset's position JSON
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": [
            "ROW-kpi", "ROW-timeline", "ROW-pies", "ROW-activity",
            "ROW-bars1", "ROW-bars2", "ROW-class", "ROW-events", "ROW-agents"
        ]},
        "HEADER_ID": {"id": "HEADER_ID", "type": "HEADER", "meta": {"text": DASHBOARD_TITLE}},
    }

    def add_row(row_id, children_specs):
        """Add a row with chart children. children_specs = [(chart_name, width)]"""
        child_ids = []
        for i, (chart_name, width) in enumerate(children_specs):
            cid = name_to_id.get(chart_name)
            if not cid:
                continue
            comp_id = f"CHART-{row_id}-{i}"
            position[comp_id] = {
                "type": "CHART",
                "id": comp_id,
                "children": [],
                "meta": {"chartId": cid, "width": width, "height": 50, "sliceName": chart_name},
            }
            child_ids.append(comp_id)
        position[row_id] = {"type": "ROW", "id": row_id, "children": child_ids, "meta": {"background": "BACKGROUND_TRANSPARENT"}}

    # Build rows
    add_row("ROW-kpi", [("Total Events", 3), ("Successful Injections", 3), ("Denied Injections", 3), ("Unique Agents", 3)])
    add_row("ROW-timeline", [("Events Trend", 4), ("Event Timeline", 8)])
    add_row("ROW-pies", [("Events by Type", 4), ("Inject Success vs Denied", 4), ("Events by Category", 4)])
    add_row("ROW-activity", [("Agent Activity Over Time", 12)])
    add_row("ROW-bars1", [("Top Agents by Events", 6), ("Denial Reasons", 6)])
    add_row("ROW-bars2", [("Most Injected Contexts", 6), ("Prompt Usage", 6)])
    add_row("ROW-class", [("Data Classification Distribution", 4), ("Governance Proof Delivery", 8)])
    add_row("ROW-events", [("Recent Events", 12)])
    add_row("ROW-agents", [("Agent Event Breakdown", 12)])

    payload = {
        "dashboard_title": DASHBOARD_TITLE,
        "published": True,
        "position_json": json.dumps(position),
        "json_metadata": json.dumps({
            "refresh_frequency": 30,
            "timed_refresh_immune_slices": [],
            "color_scheme": "supersetColors",
            "label_colors": {},
            "shared_label_colors": {},
            "cross_filters_enabled": True,
        }),
    }

    if dash_id:
        api.put(f"/api/v1/dashboard/{dash_id}", json=payload)
        print(f"  Updated dashboard '{DASHBOARD_TITLE}' (id={dash_id})")
    else:
        r = api.post("/api/v1/dashboard/", json=payload)
        dash_id = r["id"]
        print(f"  Created dashboard '{DASHBOARD_TITLE}' (id={dash_id})")

    # Link each chart to the dashboard (required for Superset to resolve chart refs)
    for cid in chart_ids:
        api.put(f"/api/v1/chart/{cid}", json={"dashboards": [dash_id]})
    print(f"  Linked {len(chart_ids)} charts to dashboard {dash_id}")

    return dash_id


# ── Main ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Setup Sandarb AI Governance Dashboard in Superset")
    parser.add_argument("--superset-url", default="http://localhost:8088", help="Superset base URL")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print("  Sandarb AI Governance — Superset Dashboard Setup")
    print(f"{'='*60}\n")

    api = SupersetAPI(args.superset_url)

    print("[1/4] Authenticating...")
    api.login()

    print("\n[2/4] Setting up ClickHouse database connection...")
    db_id = ensure_database(api)

    print("\n[3/4] Creating datasets...")
    datasets = ensure_datasets(api, db_id)

    print("\n[4/4] Creating charts and dashboard...")
    chart_specs = build_charts(datasets)
    chart_ids = ensure_charts(api, chart_specs)

    dash_id = ensure_dashboard(api, chart_ids, chart_specs)

    print(f"\n{'='*60}")
    print(f"  Done! {len(chart_ids)} charts created on dashboard.")
    print(f"  Dashboard: {args.superset_url}/superset/dashboard/{dash_id}/")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
