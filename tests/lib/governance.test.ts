/**
 * Unit tests for lib/governance.ts — scan targets and unauthenticated detection types.
 * DB-dependent functions are not invoked here (use integration tests with real DB or mocks).
 */

import { describe, it, expect } from 'vitest';
import type { ScanTarget, UnauthenticatedDetection } from '@/lib/governance';

describe('governance types', () => {
  it('ScanTarget shape is valid', () => {
    const scanTarget: ScanTarget = {
      id: 'st-1',
      url: 'https://example.com/.well-known/agent.json',
      description: 'Test target',
      createdAt: new Date().toISOString(),
    };
    expect(scanTarget.url).toContain('well-known');
    expect(scanTarget.id).toBeDefined();
  });

  it('UnauthenticatedDetection shape is valid', () => {
    const detection: UnauthenticatedDetection = {
      id: 'det-1',
      sourceUrl: 'https://shadow.example.com',
      detectedAgentId: null,
      details: {},
      scanRunAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    expect(detection.detectedAgentId).toBeNull();
    expect(detection.details).toEqual({});
  });
});
