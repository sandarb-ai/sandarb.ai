/**
 * Governance helpers: shadow AI discovery (scan targets, unauthenticated detections).
 * Blocked injections are in lib/audit.ts (activity_log type = inject_blocked).
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from './pg';
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

export async function getScanTargets(): Promise<ScanTarget[]> {
  const rows = await query<{ id: string; url: string; description: string | null; created_at: string }>(
    'SELECT id, url, description, created_at FROM scan_targets ORDER BY created_at ASC'
  );
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    description: r.description ?? null,
    createdAt: r.created_at,
  }));
}

export async function getUnauthenticatedDetections(limit: number = 50): Promise<UnauthenticatedDetection[]> {
  const rows = await query<{
    id: string;
    source_url: string;
    detected_agent_id: string | null;
    details: unknown;
    scan_run_at: string;
    created_at: string;
  }>(
    `SELECT id, source_url, detected_agent_id, details, scan_run_at, created_at
     FROM unauthenticated_detections
     ORDER BY scan_run_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    sourceUrl: r.source_url,
    detectedAgentId: r.detected_agent_id ?? null,
    details: (typeof r.details === 'object' && r.details !== null ? r.details : {}) as Record<string, unknown>,
    scanRunAt: r.scan_run_at,
    createdAt: r.created_at,
  }));
}

export async function recordUnauthenticatedAgent(input: {
  sourceUrl: string;
  detectedAgentId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO unauthenticated_detections (id, source_url, detected_agent_id, details, scan_run_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.sourceUrl,
      input.detectedAgentId ?? null,
      JSON.stringify(input.details ?? {}),
      now,
      now,
    ]
  );
}

/**
 * Run shadow AI discovery: probe scan targets; if we see an agent that isn't registered, record it.
 * Stub: today we just check each target URL (optional HEAD) and compare any discovered agent_id to registry.
 */
export async function runDiscoveryScan(): Promise<{ scanned: number; detected: number }> {
  const targets = await getScanTargets();
  let detected = 0;
  const now = new Date().toISOString();

  for (const target of targets) {
    try {
      const mockAgentIdFromScan = null as string | null;
      if (mockAgentIdFromScan) {
        const known = await getAgentByIdentifier(mockAgentIdFromScan);
        if (!known) {
          await recordUnauthenticatedAgent({
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
