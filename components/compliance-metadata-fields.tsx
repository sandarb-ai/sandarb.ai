'use client';

import { Label } from '@/components/ui/label';
import {
  LINE_OF_BUSINESS_OPTIONS,
  DATA_CLASSIFICATION_OPTIONS,
  REGULATORY_HOOK_OPTIONS,
} from '@/types';
import type { LineOfBusiness, DataClassification, RegulatoryHook } from '@/types';

const LOB_LABELS: Record<LineOfBusiness, string> = {
  retail: 'Retail',
  investment_banking: 'Investment Banking',
  wealth_management: 'Wealth Management',
};

const DATA_CLASS_LABELS: Record<DataClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
};

interface ComplianceMetadataFieldsProps {
  lineOfBusiness: LineOfBusiness | null;
  dataClassification: DataClassification | null;
  regulatoryHooks: RegulatoryHook[];
  onLineOfBusinessChange: (v: LineOfBusiness | null) => void;
  onDataClassificationChange: (v: DataClassification | null) => void;
  onRegulatoryHooksChange: (v: RegulatoryHook[]) => void;
}

export function ComplianceMetadataFields({
  lineOfBusiness,
  dataClassification,
  regulatoryHooks,
  onLineOfBusinessChange,
  onDataClassificationChange,
  onRegulatoryHooksChange,
}: ComplianceMetadataFieldsProps) {
  const toggleRegulatoryHook = (hook: RegulatoryHook) => {
    if (regulatoryHooks.includes(hook)) {
      onRegulatoryHooksChange(regulatoryHooks.filter((h) => h !== hook));
    } else {
      onRegulatoryHooksChange([...regulatoryHooks, hook]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Line of Business (LOB)</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          value={lineOfBusiness ?? ''}
          onChange={(e) =>
            onLineOfBusinessChange(
              (e.target.value as LineOfBusiness) || null
            )
          }
        >
          <option value="">— Select —</option>
          {LINE_OF_BUSINESS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {LOB_LABELS[opt]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Retail, Investment Banking, or Wealth Management. Required for compliance search.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Data Classification</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          value={dataClassification ?? ''}
          onChange={(e) =>
            onDataClassificationChange(
              (e.target.value as DataClassification) || null
            )
          }
        >
          <option value="">— Select —</option>
          {DATA_CLASSIFICATION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {DATA_CLASS_LABELS[opt]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Public, Internal, Confidential, or Restricted. Ensures no MNPI leaks into general-purpose LLMs.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Regulatory Hook</Label>
        <div className="flex flex-wrap gap-4 rounded-md border border-input bg-background px-3 py-2">
          {REGULATORY_HOOK_OPTIONS.map((hook) => (
            <label key={hook} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={regulatoryHooks.includes(hook)}
                onChange={() => toggleRegulatoryHook(hook)}
                className="rounded border-input"
              />
              <span className="text-sm">{hook}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Is this context subject to FINRA, SEC, or GDPR logging requirements?
        </p>
      </div>
    </div>
  );
}
