import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import yaml from 'js-yaml';

// Tailwind class merge helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Ensure value is an array of strings (API may return JSON string or non-array). */
export function toTagList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => (typeof x === 'string' ? x : String(x)));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((x: unknown) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Format content for injection
export function formatContent(
  content: Record<string, unknown>,
  format: 'json' | 'yaml' | 'text'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(content, null, 2);
    case 'yaml':
      return yaml.dump(content);
    case 'text':
      return flattenToText(content);
    default:
      return JSON.stringify(content, null, 2);
  }
}

/**
 * Substitute {{variable_name}} placeholders in context content with values from a map.
 * Used at inject time so banking APIs can pass client_name, portfolio_id, etc.
 * Recursively processes objects and arrays; string values are scanned for {{key}} and replaced.
 */
export function substituteVariables(
  content: unknown,
  variables: Record<string, string | number | boolean | null | undefined>
): unknown {
  if (content === null || content === undefined) return content;
  if (typeof content === 'string') {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (key in variables && variables[key] != null) return String(variables[key]);
      return `{{${key}}}`; // leave placeholder if not provided
    });
  }
  if (Array.isArray(content)) {
    return content.map((item) => substituteVariables(item, variables));
  }
  if (typeof content === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(content)) {
      out[k] = substituteVariables(v, variables);
    }
    return out;
  }
  return content;
}

// Flatten object to text format
function flattenToText(obj: Record<string, unknown>, prefix = ''): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(flattenToText(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      lines.push(`${fullKey}: ${value.join(', ')}`);
    } else {
      lines.push(`${fullKey}: ${value}`);
    }
  }

  return lines.join('\n');
}

// Validate resource name (lowercase alphanumeric, hyphens, underscores only)
export function isValidResourceName(name: string): boolean {
  return /^[a-z0-9_-]+$/.test(name) && name.length > 0;
}

// Alias for backward compatibility
export const isValidContextName = isValidResourceName;

// Error message for invalid names
export const RESOURCE_NAME_ERROR = 'Name must be lowercase and contain only letters, numbers, hyphens (-), and underscores (_)';

// Generate slug from name
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Parse JSON safely
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Truncate text with ellipsis (handles null/undefined)
export function truncate(text: string | null | undefined, maxLength: number): string {
  if (text == null || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Format date for display
export function formatDate(dateString: string | null | undefined): string {
  if (dateString == null || dateString === '') return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Format full date and time for chat logs (e.g. "Feb 3, 2026, 3:45:12 PM"). */
export function formatDateTime(dateString: string | null | undefined): string {
  if (dateString == null || dateString === '') return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Format approved-by for display: must show as @username (prepend @ if missing). */
export function formatApprovedBy(approvedBy: string | null | undefined): string {
  if (!approvedBy) return '—';
  return approvedBy.startsWith('@') ? approvedBy : `@${approvedBy}`;
}

/** Normalize approved-by for storage: must be @username. */
export function normalizeApprovedBy(approvedBy: string | null | undefined): string | null {
  if (approvedBy == null || approvedBy === '') return null;
  return approvedBy.startsWith('@') ? approvedBy : `@${approvedBy}`;
}

// Format relative time
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (dateString == null || dateString === '') return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(dateString);
}
