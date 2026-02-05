'use client';

import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DATA_CLASSIFICATION_OPTIONS,
  REGULATORY_HOOK_OPTIONS,
} from '@/types';
import type { DataClassification, RegulatoryHook } from '@/types';

const DATA_CLASS_LABELS: Record<DataClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
};

interface ComplianceMetadataFieldsProps {
  /** All organizations for the dropdown */
  organizations: { id: string; name: string; slug: string }[];
  orgId: string | null;
  onOrgIdChange: (v: string | null) => void;
  dataClassification: DataClassification | null;
  regulatoryHooks: RegulatoryHook[];
  onDataClassificationChange: (v: DataClassification | null) => void;
  onRegulatoryHooksChange: (v: RegulatoryHook[]) => void;
  /** If true, show read-only summary instead of editable fields */
  readOnly?: boolean;
}

export function ComplianceMetadataFields({
  organizations,
  orgId,
  onOrgIdChange,
  dataClassification,
  regulatoryHooks,
  onDataClassificationChange,
  onRegulatoryHooksChange,
  readOnly = false,
}: ComplianceMetadataFieldsProps) {
  const toggleRegulatoryHook = (hook: RegulatoryHook) => {
    if (regulatoryHooks.includes(hook)) {
      onRegulatoryHooksChange(regulatoryHooks.filter((h) => h !== hook));
    } else {
      onRegulatoryHooksChange([...regulatoryHooks, hook]);
    }
  };

  const hasAnyValue = orgId || dataClassification || regulatoryHooks.length > 0;
  const orgName = organizations.find((o) => o.id === orgId)?.name ?? null;

  // Read-only summary view
  if (readOnly) {
    if (!hasAnyValue) {
      return (
        <div className="text-sm text-muted-foreground italic">
          Not Applicable
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {orgName && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Organization:</span>
            <Badge variant="outline">{orgName}</Badge>
          </div>
        )}
        {dataClassification && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Classification:</span>
            <Badge variant="outline">{DATA_CLASS_LABELS[dataClassification]}</Badge>
          </div>
        )}
        {regulatoryHooks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Regulatory:</span>
            {regulatoryHooks.map((hook) => (
              <Badge key={hook} variant="secondary">{hook}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badge showing current status */}
      {!hasAnyValue && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-dashed border-muted-foreground/30">
          <Badge variant="outline" className="text-muted-foreground">Not Applicable</Badge>
          <span className="text-xs text-muted-foreground">No compliance metadata set. Select values below if applicable.</span>
        </div>
      )}

      {/* Organization + Data Classification — side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Organization</Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm"
            value={orgId ?? ''}
            onChange={(e) => onOrgIdChange(e.target.value || null)}
          >
            <option value="">No organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">Which org this context belongs to.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Data Classification</Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm"
            value={dataClassification ?? ''}
            onChange={(e) =>
              onDataClassificationChange((e.target.value as DataClassification) || null)
            }
          >
            <option value="">Not Applicable</option>
            {DATA_CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {DATA_CLASS_LABELS[opt]}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">Public → Restricted. MNPI control.</p>
        </div>
      </div>

      {/* Regulatory hooks — single compact row */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Regulatory Hooks</Label>
        <div className="flex flex-wrap gap-3 rounded-md border border-input bg-muted/30 px-2.5 py-2">
          {REGULATORY_HOOK_OPTIONS.map((hook) => (
            <label key={hook} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={regulatoryHooks.includes(hook)}
                onChange={() => toggleRegulatoryHook(hook)}
                className="rounded border-input h-3.5 w-3.5 accent-primary"
              />
              <span className="text-xs font-medium">{hook}</span>
            </label>
          ))}
        </div>
        {regulatoryHooks.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No regulatory hooks selected (Not Applicable).</p>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            {regulatoryHooks.length} hook{regulatoryHooks.length > 1 ? 's' : ''} selected: {regulatoryHooks.join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
}
