'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  GitCommit,
  History,
  GitPullRequest,
  Check,
  XCircle,
  FileEdit,
  MessageSquare,
  GitCompare,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContextEditor } from '@/components/context-editor';
import { ContextPreview } from '@/components/context-preview';
import type { Context, ContextRevision, LineOfBusiness, DataClassification, RegulatoryHook } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { ComplianceMetadataFields } from '@/components/compliance-metadata-fields';
import { ContentDiffView } from '@/components/content-diff-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function EditContextPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [context, setContext] = useState<Context | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [lineOfBusiness, setLineOfBusiness] = useState<LineOfBusiness | null>(null);
  const [dataClassification, setDataClassification] = useState<DataClassification | null>(null);
  const [regulatoryHooks, setRegulatoryHooks] = useState<RegulatoryHook[]>([]);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [isActive, setIsActive] = useState(true);
  const [revisions, setRevisions] = useState<ContextRevision[]>([]);
  const [activeTab, setActiveTab] = useState('content');
  const [diffRevision, setDiffRevision] = useState<ContextRevision | null>(null);

  const fetchContext = async () => {
    try {
      const res = await fetch(`/api/contexts/${id}`);
      const data = await res.json();
      if (data.success) {
        const ctx = data.data;
        setContext(ctx);
        setName(ctx.name);
        setDescription(ctx.description || '');
        setTags(ctx.tags?.join(', ') ?? '');
        setLineOfBusiness(ctx.lineOfBusiness ?? null);
        setDataClassification(ctx.dataClassification ?? null);
        setRegulatoryHooks(ctx.regulatoryHooks ?? []);
        setContent(ctx.content ?? {});
        setIsActive(ctx.isActive);
      } else {
        alert('Context not found');
        router.push('/contexts');
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async () => {
    try {
      const res = await fetch(`/api/contexts/${id}/revisions`);
      const data = await res.json();
      if (data.success) setRevisions(data.data);
    } catch (e) {
      console.error('Failed to fetch revisions:', e);
    }
  };

  useEffect(() => {
    fetchContext();
  }, [id]);

  useEffect(() => {
    if (id && activeTab !== 'content') fetchRevisions();
  }, [id, activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contexts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          content,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          isActive,
          lineOfBusiness,
          dataClassification,
          regulatoryHooks,
        }),
      });
      if (res.ok) {
        fetchContext();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update context');
      }
    } catch (error) {
      console.error('Failed to update context:', error);
      alert('Failed to update context');
    } finally {
      setSaving(false);
    }
  };

  const handlePropose = async () => {
    if (!commitMessage.trim()) {
      alert('Commit message is required to propose changes.');
      return;
    }
    setProposing(true);
    try {
      const res = await fetch(`/api/contexts/${id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          commitMessage: commitMessage.trim(),
        }),
      });
      if (res.ok) {
        setCommitMessage('');
        setActiveTab('pending');
        fetchRevisions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to propose changes');
      }
    } catch (error) {
      console.error('Failed to propose revision:', error);
      alert('Failed to propose changes');
    } finally {
      setProposing(false);
    }
  };

  const handleApproveRevision = async (revId: string) => {
    try {
      const res = await fetch(`/api/contexts/${id}/revisions/${revId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchContext();
        fetchRevisions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRevision = async (revId: string) => {
    try {
      const res = await fetch(`/api/contexts/${id}/revisions/${revId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) fetchRevisions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this context?')) return;
    try {
      const res = await fetch(`/api/contexts/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/contexts');
      else alert('Failed to delete context');
    } catch (error) {
      console.error('Failed to delete context:', error);
    }
  };

  const proposed = revisions.filter((r) => r.status === 'proposed');
  const history = revisions.filter((r) => r.status === 'approved' || r.status === 'rejected');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/contexts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Edit context · changes tracked like git</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsActive(!isActive)}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={saving || !name}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="content" className="gap-2">
              <FileEdit className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
              {revisions.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {revisions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <GitPullRequest className="h-4 w-4" />
              Pending
              {proposed.length > 0 && (
                <Badge variant="default" className="ml-1 text-xs">
                  {proposed.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6 mt-0">
            {/* Request Review (4-eyes principle) */}
            <Card className="border-primary/20 bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  Request Review (4-eyes principle)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  In banks, context that changes model behavior often needs a second pair of eyes before going live. Add a commit message and request review; an approver can approve or reject.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="commitMessage" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Commit message
                  </Label>
                  <Input
                    id="commitMessage"
                    placeholder="e.g. Update API config for staging"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                </div>
                <Button onClick={handlePropose} disabled={proposing || !commitMessage.trim()}>
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  {proposing ? 'Requesting...' : 'Request Review'}
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags</Label>
                      <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Optional comma-separated labels" />
                    </div>
                    <ComplianceMetadataFields
                      lineOfBusiness={lineOfBusiness}
                      dataClassification={dataClassification}
                      regulatoryHooks={regulatoryHooks}
                      onLineOfBusinessChange={setLineOfBusiness}
                      onDataClassificationChange={setDataClassification}
                      onRegulatoryHooksChange={setRegulatoryHooks}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Content</CardTitle>
                    <p className="text-xs text-muted-foreground font-normal">
                      Use placeholders like <code className="rounded bg-muted px-1">{'{{client_name}}'}</code> or <code className="rounded bg-muted px-1">{'{{portfolio_id}}'}</code>; Sandarb injects values at request time from query <code className="rounded bg-muted px-1">vars=</code> or header <code className="rounded bg-muted px-1">X-Sandarb-Variables</code>.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ContextEditor value={content} onChange={setContent} />
                  </CardContent>
                </Card>
              </div>
              <div className="lg:sticky lg:top-6 lg:self-start">
                <Card>
                  <CardHeader>
                    <CardTitle>Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContextPreview content={content} contextName={name} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="h-4 w-4" />
                  Version history
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  All approved and rejected changes. View diff to see exactly what changed between versions.
                </p>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No history yet. Save or approve a proposed change to see commits here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {history.map((rev) => (
                      <li
                        key={rev.id}
                        className="flex items-center gap-4 rounded-lg border p-3 bg-muted/30"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background border">
                          <GitCommit className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{rev.commitMessage || 'No message'}</p>
                          <p className="text-xs text-muted-foreground">
                            {rev.createdBy || 'Unknown'} · {formatRelativeTime(rev.createdAt)}
                            {rev.approvedAt && rev.status === 'approved' && ` · Approved by ${rev.approvedBy || '—'}`}
                          </p>
                        </div>
                        <Badge variant={rev.status === 'approved' ? 'default' : 'secondary'}>
                          {rev.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 gap-1"
                          onClick={() => setDiffRevision(rev)}
                        >
                          <GitCompare className="h-4 w-4" />
                          View diff
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  Pending review
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Proposed changes waiting for approval or rejection.
                </p>
              </CardHeader>
              <CardContent>
                {proposed.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No pending proposals. Use “Propose changes” on the Content tab.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {proposed.map((rev) => (
                      <li
                        key={rev.id}
                        className="flex items-center gap-4 rounded-lg border p-3 bg-muted/30"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background border">
                          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{rev.commitMessage || 'No message'}</p>
                          <p className="text-xs text-muted-foreground">
                            {rev.createdBy || 'Unknown'} · {formatRelativeTime(rev.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveRevision(rev.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => handleRejectRevision(rev.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Version diff dialog: compare revision content vs current */}
        <Dialog open={!!diffRevision} onOpenChange={(open) => !open && setDiffRevision(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Version diff</DialogTitle>
            </DialogHeader>
            {diffRevision && context && (
              <ContentDiffView
                oldContent={diffRevision.content}
                newContent={context.content ?? {}}
                oldLabel={`Revision · ${diffRevision.commitMessage || diffRevision.id.slice(0, 8)}`}
                newLabel="Current (saved)"
                className="flex-1 min-h-0"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
