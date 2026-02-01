/**
 * Governance helpers: shadow AI discovery (scan targets, unauthenticated detections).
 * Blocked injections are in lib/audit.ts (activity_log type = inject_blocked).
 */

import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { getAgentByIdentifier } from './agents';

export interface ScanTarget {
  id: string;
  url: string;
  description: string | null;
  createdAt: string;
}

export interface UnauthenticatedDetection {
  id: string;
  sourceUrl: string;
  detectedAgentId: string | null;
  details: Record<string, unknown>;
  scanRunAt: string;
  createdAt: string;
}

export function getScanTargets(): ScanTarget[] {
  const rows = db.prepare('SELECT id, url, description, created_at FROM scan_targets ORDER BY created_at ASC').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    url: r.url as string,
    description: (r.description as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export function getUnauthenticatedDetections(limit: number = 50): UnauthenticatedDetection[] {
  const rows = db.prepare(`
    SELECT id, source_url, detected_agent_id, details, scan_run_at, created_at
    FROM unauthenticated_detections
    ORDER BY scan_run_at DESC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    sourceUrl: r.source_url as string,
    detectedAgentId: (r.detected_agent_id as string) ?? null,
    details: (r.details ? JSON.parse(r.details as string) : {}) as Record<string, unknown>,
    scanRunAt: r.scan_run_at as string,
    createdAt: r.created_at as string,
  }));
}

export function recordUnauthenticatedAgent(input: {
  sourceUrl: string;
  detectedAgentId?: string | null;
  details?: Record<string, unknown>;
}): void {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO unauthenticated_detections (id, source_url, detected_agent_id, details, scan_run_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.sourceUrl,
    input.detectedAgentId ?? null,
    JSON.stringify(input.details ?? {}),
    now,
    now
  );
}

/**
 * Run shadow AI discovery: probe scan targets; if we see an agent that isn't registered, record it.
 * Stub: today we just check each target URL (optional HEAD) and compare any discovered agent_id to registry.
 */
export async function runDiscoveryScan(): Promise<{ scanned: number; detected: number }> {
  const targets = getScanTargets();
  let detected = 0;
  const now = new Date().toISOString();

  for (const target of targets) {
    try {
      // Placeholder: in production you would fetch the URL (e.g. A2A discovery or MCP endpoint),
      // parse response for agent identifier, then check getAgentByIdentifier(agentId).
      // Here we don't do network I/O; we only demonstrate the flow.
      const mockAgentIdFromScan = null as string | null;
      if (mockAgentIdFromScan) {
        const known = await getAgentByIdentifier(mockAgentIdFromScan);
        if (!known) {
          recordUnauthenticatedAgent({
            sourceUrl: target.url,
            detectedAgentId: mockAgentIdFromScan,
            details: { scanRunAt: now },
          });
          detected += 1;
        }
      }
    } catch {
      // Skip failed targets
    }
  }

  return { scanned: targets.length, detected };
}
