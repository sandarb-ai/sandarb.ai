'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ContextEditor } from '@/components/context-editor';
import { ContextPreview } from '@/components/context-preview';
import { ComplianceMetadataFields } from '@/components/compliance-metadata-fields';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import type { ContextContent, DataClassification, RegulatoryHook } from '@/types';
import type { Organization } from '@/types';

// Validate name: lowercase alphanumeric, hyphens, underscores only
const isValidName = (n: string) => /^[a-z0-9_-]+$/.test(n);
const NAME_ERROR = 'Name must be lowercase and contain only letters, numbers, hyphens (-), and underscores (_)';

export default function NewContextPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [dataClassification, setDataClassification] = useState<DataClassification | null>(null);
  const [regulatoryHooks, setRegulatoryHooks] = useState<RegulatoryHook[]>([]);
  const [content, setContent] = useState<ContextContent>(
    '# Context Template\n\nPolicy for {{ region }}\nCompliance: {{ compliance_code }}\nCurrency: {{ currency }}'
  );
  const [aiInstructions, setAiInstructions] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/organizations?limit=500&offset=0'))
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        // Handle paginated { organizations, total, ... } or bare array
        const payload = d.data;
        const list = Array.isArray(payload)
          ? payload
          : (payload?.organizations && Array.isArray(payload.organizations))
            ? payload.organizations
            : [];
        setOrganizations(list as Organization[]);
      });
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    if (value && !isValidName(value)) {
      setNameError(NAME_ERROR);
    } else {
      setNameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !isValidName(name)) {
      setNameError(NAME_ERROR);
      return;
    }
    
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/contexts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({
          name,
          description,
          content,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          orgId,
          dataClassification,
          regulatoryHooks,
        }),
      });

      if (res.ok) {
        router.push('/contexts');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create context');
      }
    } catch {
      alert('Failed to create context');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <Breadcrumb items={[{ label: 'Agent Context', href: '/contexts' }, { label: 'New context' }]} className="mb-2" />
            <h1 className="text-2xl font-semibold tracking-tight">
              New Agent Context
            </h1>
            <p className="text-sm text-muted-foreground">
              The "Reference Library": data and documents the agent can access at runtime.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleSubmit} disabled={loading || !name || !!nameError}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Context'}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor Side */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="my-context"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={nameError ? 'border-destructive' : ''}
                  />
                  {nameError ? (
                    <p className="text-xs text-destructive">{nameError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Lowercase letters, numbers, hyphens (-), and underscores (_) only.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="A brief description of this context..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    placeholder="agent, production, v1 (optional)"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional comma-separated labels. Use compliance fields below for searchable metadata.
                  </p>
                </div>
                <ComplianceMetadataFields
                  organizations={organizations}
                  orgId={orgId}
                  onOrgIdChange={setOrgId}
                  dataClassification={dataClassification}
                  regulatoryHooks={regulatoryHooks}
                  onDataClassificationChange={setDataClassification}
                  onRegulatoryHooksChange={setRegulatoryHooks}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent>
                <ContextEditor value={content} onChange={setContent} aiInstructions={aiInstructions} onAiInstructionsChange={setAiInstructions} />
              </CardContent>
            </Card>
          </div>

          {/* Preview Side */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <ContextPreview
                  content={content}
                  contextName={name || 'untitled'}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
