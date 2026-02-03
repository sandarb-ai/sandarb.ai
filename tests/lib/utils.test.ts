/**
 * Unit tests for lib/utils.ts — governance display and validation helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  formatApprovedBy,
  normalizeApprovedBy,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isValidResourceName,
  isValidContextName,
  RESOURCE_NAME_ERROR,
  slugify,
  safeJsonParse,
  truncate,
  substituteVariables,
  formatContent,
  cn,
} from '@/lib/utils';

describe('formatApprovedBy', () => {
  it('returns em dash for null/undefined/empty', () => {
    expect(formatApprovedBy(null)).toBe('—');
    expect(formatApprovedBy(undefined)).toBe('—');
    expect(formatApprovedBy('')).toBe('—');
  });

  it('returns value as-is when already starting with @', () => {
    expect(formatApprovedBy('@alice')).toBe('@alice');
    expect(formatApprovedBy('@compliance')).toBe('@compliance');
  });

  it('prepends @ when missing', () => {
    expect(formatApprovedBy('alice')).toBe('@alice');
    expect(formatApprovedBy('compliance@example.com')).toBe('@compliance@example.com');
  });
});

describe('normalizeApprovedBy', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeApprovedBy(null)).toBeNull();
    expect(normalizeApprovedBy(undefined)).toBeNull();
    expect(normalizeApprovedBy('')).toBeNull();
  });

  it('returns value as-is when already @username', () => {
    expect(normalizeApprovedBy('@alice')).toBe('@alice');
  });

  it('prepends @ when missing', () => {
    expect(normalizeApprovedBy('alice')).toBe('@alice');
  });
});

describe('formatDate', () => {
  it('formats ISO date string to readable date', () => {
    const iso = '2026-02-03T14:30:00.000Z';
    const result = formatDate(iso);
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/3/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatDateTime', () => {
  it('formats ISO date to full date and time', () => {
    const iso = '2026-02-03T14:30:00.000Z';
    const result = formatDateTime(iso);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Feb/);
  });
});

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent date', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('Just now');
  });

  it('returns "Xd ago" for past dates', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(formatRelativeTime(twoDaysAgo.toISOString())).toMatch(/ago/);
  });
});

describe('isValidResourceName / isValidContextName', () => {
  it('accepts lowercase alphanumeric, hyphens, underscores', () => {
    expect(isValidResourceName('foo')).toBe(true);
    expect(isValidResourceName('foo-bar')).toBe(true);
    expect(isValidResourceName('foo_bar')).toBe(true);
    expect(isValidResourceName('foo123')).toBe(true);
    expect(isValidContextName('ib-trading-limits')).toBe(true);
  });

  it('rejects empty, uppercase, spaces, special chars', () => {
    expect(isValidResourceName('')).toBe(false);
    expect(isValidResourceName('Foo')).toBe(false);
    expect(isValidResourceName('foo bar')).toBe(false);
    expect(isValidResourceName('foo.bar')).toBe(false);
  });

  it('RESOURCE_NAME_ERROR is defined', () => {
    expect(RESOURCE_NAME_ERROR).toContain('lowercase');
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces/special with hyphens', () => {
    expect(slugify('Wealth Management')).toBe('wealth-management');
    expect(slugify('  foo   bar  ')).toBe('foo-bar');
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('returns fallback on invalid JSON', () => {
    const fallback = { default: true };
    expect(safeJsonParse('not json', fallback)).toBe(fallback);
  });
});

describe('truncate', () => {
  it('returns full string when within maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis when over maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });
});

describe('substituteVariables', () => {
  it('replaces {{key}} in strings with variable values', () => {
    const result = substituteVariables('Hello {{name}}', { name: 'Alice' });
    expect(result).toBe('Hello Alice');
  });

  it('leaves placeholder when key missing', () => {
    const result = substituteVariables('Hello {{name}}', {});
    expect(result).toBe('Hello {{name}}');
  });

  it('processes nested objects', () => {
    const result = substituteVariables(
      { level: { msg: '{{x}}' } },
      { x: 'done' }
    ) as { level: { msg: string } };
    expect(result.level.msg).toBe('done');
  });
});

describe('formatContent', () => {
  const content = { greeting: 'Hello', count: 42 };

  it('formats as JSON by default', () => {
    const result = formatContent(content, 'json');
    expect(result).toContain('"greeting"');
    expect(result).toContain('"Hello"');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('formats as YAML when format is yaml', () => {
    const result = formatContent(content, 'yaml');
    expect(result).toMatch(/greeting|Hello|count|42/);
  });

  it('formats as text when format is text', () => {
    const result = formatContent(content, 'text');
    expect(result).toMatch(/greeting|Hello|count|42/);
  });

  it('defaults to JSON for unknown format', () => {
    const result = formatContent(content, 'unknown' as 'json');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe('cn (class names)', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toContain('a');
    expect(cn('a', 'b')).toContain('b');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toContain('base');
    expect(cn('base', false && 'hidden', 'visible')).toContain('visible');
  });
});
