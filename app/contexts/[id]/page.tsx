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
  Shield,
  Copy,
  ExternalLink,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContextEditor } from '@/components/context-editor';
import { ComplianceMetadataFields } from '@/components/compliance-metadata-fields';
import { apiUrl } from '@/lib/api';
import type { Context, ContextRevision, LineOfBusiness, DataClassification, RegulatoryHook } from '@/types';
import { formatDate, formatApprovedBy } from '@/lib/utils';
import { ContentDiffView } from '@/components/content-diff-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function InjectApiBar({ contextName }: { contextName: string }) {
  const [copied, setCopied] = useState(false);
  // Auditable injection requires agentId and traceId (headers or query). Use preview agent for Test API / Copy URL.
  const agentId = 'sandarb-context-preview';
  const traceId = 'test-1';
  const apiPath = `/api/inject?name=${encodeURIComponent(contextName)}&format=json&agentId=${encodeURIComponent(agentId)}&traceId=${encodeURIComponent(traceId)}`;
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${apiPath}` : apiPath;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = () => {
    if (typeof window !== 'undefined') window.open(fullUrl, '_blank', 'noopener');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-4 py-2.5">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          Live
        </span>
        What your agent receives
      </span>
      <code className="flex-1 min-w-0 truncate rounded bg-muted/80 px-2 py-1 text-xs font-mono" title={fullUrl}>
        GET {apiPath}
      </code>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy URL'}
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleTest}>
          <ExternalLink className="h-3.5 w-3.5" />
          Test API
        </Button>
      </div>
    </div>
  );
}

export default function EditContextPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const [description, setDescription] = useState('');
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [isActive, setIsActive] = useState(true);
  const [lineOfBusiness, setLineOfBusiness] = useState<LineOfBusiness | null>(null);
  const [dataClassification, setDataClassification] = useState<DataClassification | null>(null);
  const [regulatoryHooks, setRegulatoryHooks] = useState<RegulatoryHook[]>([]);
  const [revisions, setRevisions] = useState<ContextRevision[]>([]);
  const [activeTab, setActiveTab] = useState('content');
  const [diffRevision, setDiffRevision] = useState<ContextRevision | null>(null);

  const fetchContext = async () => {
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}`));
      const data = await res.json();
      if (data.success) {
        const ctx = data.data;
        setContext(ctx);
        setDescription(ctx.description || '');
        setContent(ctx.content ?? {});
        setIsActive(ctx.isActive);
        setLineOfBusiness(ctx.lineOfBusiness ?? null);
        setDataClassification(ctx.dataClassification ?? null);
        setRegulatoryHooks(ctx.regulatoryHooks ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async () => {
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}/revisions`));
      const data = await res.json();
      if (data.success) setRevisions(data.data);
    } catch {
    }
  };

  useEffect(() => {
    fetchContext();
  }, [id]);

  // Fetch revisions on load so History/Pending tab counts are correct without clicking
  useEffect(() => {
    if (id) fetchRevisions();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          content,
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
    } catch {
      alert('Failed to update context');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveRevision = async (revId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}/revisions/${revId}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchContext();
        fetchRevisions();
      }
    } catch {
    }
  };

  const handleRejectRevision = async (revId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}/revisions/${revId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) fetchRevisions();
    } catch {
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this context?')) return;
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}`), { method: 'DELETE' });
      if (res.ok) router.push('/contexts');
      else alert('Failed to delete context');
    } catch {
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

  if (!context) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">Context not found.</p>
        <Link href="/contexts">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to contexts
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/contexts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight font-mono">{context.name}</h1>
              <Badge variant={isActive ? 'success' : 'secondary'}>
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground truncate max-w-md">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsActive(!isActive)}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mb-4 shrink-0">
            <TabsTrigger value="content" className="gap-2">
              <FileEdit className="h-4 w-4" />
              Edit content
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-2">
              <Shield className="h-4 w-4" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History ({history.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <GitPullRequest className="h-4 w-4" />
              Pending ({proposed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-0 flex-1 min-h-0 flex flex-col">
            <div className="grid gap-6 lg:grid-cols-[1fr,minmax(300px,340px)] min-h-0 h-[calc(100vh-160px)]">
              {/* Left pane: Content editor + compact "What your agent receives" bar */}
              <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                {/* Content (JSON) — fills available height */}
                <div className="flex flex-col min-h-0 flex-1">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-semibold text-foreground">Content (JSON)</h3>
                    <p className="text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5">{'{{var}}'}</code> for variables
                    </p>
                  </div>
                  <div className="flex-1 min-h-0 rounded-xl border border-border/80 overflow-hidden bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                    <ContextEditor value={content} onChange={setContent} />
                  </div>
                </div>
                {/* Live — What your agent receives: copy + test API */}
                <InjectApiBar contextName={context.name} />
              </div>

              {/* Right pane: Regulatory & compliance only — resized for clarity */}
              <div className="flex flex-col min-h-0 lg:sticky lg:top-[57px] lg:self-start lg:max-h-[calc(100vh-100px)] overflow-auto">
                <Card className="border-l-4 border-l-primary shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Regulatory & compliance
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      LOB, data classification, and regulatory hooks for governance and search.
                    </p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
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
                {/* Linked agents: which agent(s) this context belongs to */}
                <Card className="border-l-4 border-l-muted shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      Linked agents
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      This context is available to these agents when they inject by name.
                    </p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    {(context.agents?.length ?? 0) > 0 ? (
                      <ul className="space-y-1.5">
                        {context.agents!.map((a) => (
                          <li key={a.id}>
                            <Link
                              href={`/agents/${a.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {a.name}
                              {a.agentId && (
                                <span className="text-muted-foreground font-normal ml-1 font-mono text-xs">
                                  ({a.agentId})
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not linked to any agent</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Regulatory & compliance
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Line of business, data classification, and regulatory hooks for governance and search.
                </p>
              </CardHeader>
              <CardContent>
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
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="h-4 w-4" />
                  Version history
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  All approved and rejected changes. Click on the diff to view full comparison.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center px-6">
                    No history yet. Save or approve a proposed change to see commits here.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Created</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Created by</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Submitted by</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Approved by</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Modified</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Modified by</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap w-40">Commit message</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[320px] lg:min-w-[480px]">Changes (diff)</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((rev) => (
                          <tr key={rev.id} className="border-b border-border/80 hover:bg-muted/20 align-top">
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">{formatDate(rev.createdAt)}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{formatApprovedBy(rev.createdBy)}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{formatApprovedBy(rev.submittedBy)}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{formatApprovedBy(rev.approvedBy)}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                              {rev.updatedAt ? formatDate(rev.updatedAt) : '—'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">{formatApprovedBy(rev.updatedBy)}</td>
                            <td className="py-3 px-4 max-w-[12rem]">
                              <p className="truncate font-medium text-foreground" title={rev.commitMessage || undefined}>
                                {rev.commitMessage || 'No message'}
                              </p>
                            </td>
                            <td className="py-2 px-4 min-w-[320px] lg:min-w-[480px]">
                              {context && (
                                <div 
                                  className="rounded border border-border/60 bg-muted/20 overflow-hidden max-h-40 overflow-y-auto cursor-pointer hover:border-primary/50 transition-colors"
                                  onClick={() => setDiffRevision(rev)}
                                  title="Click to view full diff"
                                >
                                  <ContentDiffView
                                    oldContent={rev.content}
                                    newContent={context.content ?? {}}
                                    oldLabel="Revision"
                                    newLabel="Current"
                                    className="!border-0 !rounded-none text-[11px]"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <Badge
                                variant={
                                  rev.status === 'approved'
                                    ? 'success'
                                    : rev.status === 'proposed'
                                      ? 'pending_review'
                                      : rev.status === 'rejected'
                                        ? 'destructive'
                                        : 'secondary'
                                }
                              >
                                {rev.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                  Proposed changes waiting for approval or rejection. Click on the diff to view full comparison.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {proposed.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center px-6">
                    No pending proposals. Use "Propose changes" on the Content tab.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Created</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Created by</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Submitted by</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Commit message</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[320px] lg:min-w-[480px]">Changes (diff)</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposed.map((rev) => (
                          <tr key={rev.id} className="border-b border-border/80 hover:bg-muted/20 align-top">
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">{formatDate(rev.createdAt)}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{formatApprovedBy(rev.createdBy)}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{formatApprovedBy(rev.submittedBy)}</td>
                            <td className="py-3 px-4 max-w-[12rem]">
                              <p className="truncate font-medium text-foreground" title={rev.commitMessage || undefined}>
                                {rev.commitMessage || 'No message'}
                              </p>
                            </td>
                            <td className="py-2 px-4 min-w-[320px] lg:min-w-[480px]">
                              {context && (
                                <div 
                                  className="rounded border border-border/60 bg-muted/20 overflow-hidden max-h-40 overflow-y-auto cursor-pointer hover:border-primary/50 transition-colors"
                                  onClick={() => setDiffRevision(rev)}
                                  title="Click to view full diff"
                                >
                                  <ContentDiffView
                                    oldContent={context.content ?? {}}
                                    newContent={rev.content}
                                    oldLabel="Current"
                                    newLabel="Proposed"
                                    className="!border-0 !rounded-none text-[11px]"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="approve"
                                className="mr-1"
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
