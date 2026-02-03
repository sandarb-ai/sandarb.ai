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
      {/* LOB + Data Classification — side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Line of Business</Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm"
            value={lineOfBusiness ?? ''}
            onChange={(e) =>
              onLineOfBusinessChange((e.target.value as LineOfBusiness) || null)
            }
          >
            <option value="">— Select —</option>
            {LINE_OF_BUSINESS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {LOB_LABELS[opt]}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">Retail, IB, or Wealth. For compliance search.</p>
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
            <option value="">— Select —</option>
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
        <Label className="text-xs font-medium text-muted-foreground">Regulatory Hook</Label>
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
        <p className="text-[10px] text-muted-foreground">FINRA, SEC, or GDPR logging requirements.</p>
      </div>
    </div>
  );
}
