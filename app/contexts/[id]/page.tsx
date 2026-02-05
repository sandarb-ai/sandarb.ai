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
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import type { Context, ContextRevision, DataClassification, RegulatoryHook, Organization } from '@/types';
import { formatDate, formatApprovedBy } from '@/lib/utils';
import { ContentDiffView } from '@/components/content-diff-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Breadcrumb } from '@/components/ui/breadcrumb';

function InjectApiBar({ contextName }: { contextName: string }) {
  const [copied, setCopied] = useState(false);
  const apiPath = `/api/inject?name=${encodeURIComponent(contextName)}&format=json&agentId=preview&traceId=test`;
  const fullUrl = apiUrl(apiPath);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">API Endpoint</h4>
      <code className="block text-[11px] font-mono bg-muted rounded px-2 py-2 break-all mb-2">
        GET {fullUrl}
      </code>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => window.open(fullUrl, '_blank')}>
          <ExternalLink className="h-3 w-3 mr-1" />
          Test
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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [description, setDescription] = useState('');
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [isActive, setIsActive] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [dataClassification, setDataClassification] = useState<DataClassification | null>(null);
  const [regulatoryHooks, setRegulatoryHooks] = useState<RegulatoryHook[]>([]);
  const [revisions, setRevisions] = useState<ContextRevision[]>([]);
  const [activeTab, setActiveTab] = useState('content');
  const [diffRevision, setDiffRevision] = useState<ContextRevision | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [creatingRevision, setCreatingRevision] = useState(false);

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
        setOrgId(ctx.orgId ?? null);
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

  useEffect(() => {
    fetch(apiUrl('/api/organizations'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setOrganizations(d.data as Organization[]);
        }
      });
  }, []);

  // Fetch revisions on load so History/Pending tab counts are correct without clicking
  useEffect(() => {
    if (id) fetchRevisions();
  }, [id]);

  const handleSaveMetadata = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({
          description,
          isActive,
          orgId,
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

  const handleCreateRevision = async () => {
    if (!commitMessage.trim()) {
      alert('Commit message is required');
      return;
    }

    setCreatingRevision(true);
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}/revisions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({
          content,
          commitMessage,
          autoApprove,
        }),
      });
      if (res.ok) {
        setCommitMessage('');
        setActiveTab(autoApprove ? 'history' : 'pending');
        fetchContext();
        fetchRevisions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save revision');
      }
    } catch {
      alert('Failed to save revision');
    } finally {
      setCreatingRevision(false);
    }
  };

  const handleApproveRevision = async (revId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}/revisions/${revId}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({}),
      });
      if (res.ok) fetchRevisions();
    } catch {
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this context?')) return;
    try {
      const res = await fetch(apiUrl(`/api/contexts/${id}`), { method: 'DELETE', headers: getWriteAuthHeaders() });
      if (res.ok) router.push('/contexts');
      else alert('Failed to delete context');
    } catch {
    }
  };

  const proposed = revisions.filter((r) => r.status === 'proposed');
  const history = revisions.filter((r) => r.status === 'approved' || r.status === 'rejected');
  
  // Get current active version (latest approved)
  const currentVersion = history
    .filter((r) => r.status === 'approved')
    .sort((a, b) => (b.version || 0) - (a.version || 0))[0];
  const nextVersion = currentVersion ? (currentVersion.version || 0) + 1 : 1;

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
    <div className="flex flex-col h-full min-h-0">
      <header className="sticky top-0 z-10 shrink-0 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-3">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <Breadcrumb items={[{ label: 'Contexts', href: '/contexts' }, { label: context.name }]} className="mb-1" />
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight font-mono truncate">{context.name}</h1>
              {currentVersion && (
                <Badge variant="outline" className="font-mono">v{currentVersion.version}</Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground truncate max-w-md">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={isActive ? 'success' : 'secondary'} className="h-8 px-3 text-xs">
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setIsActive(!isActive); handleSaveMetadata(); }}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content area — same layout as prompt detail */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Editor and tabs */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 px-6 py-3 border-b bg-muted/30 shrink-0">
              <TabsList className="h-8 bg-transparent p-0 gap-1">
                <TabsTrigger value="content" className="h-8 px-3 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="history" className="h-8 px-3 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  History
                  {history.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({history.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="pending" className="h-8 px-3 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  <GitPullRequest className="h-3.5 w-3.5 mr-1.5" />
                  Pending
                  {proposed.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">{proposed.length}</span>}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Edit tab — editor scrolls in its own area; Save Changes bar fixed at bottom, never overlaps */}
            <TabsContent value="content" className="mt-0 flex-1 flex flex-col min-h-0 m-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto p-6">
                <div className="h-full min-h-[300px] rounded-lg border bg-background overflow-hidden">
                  <ContextEditor value={content} onChange={setContent} className="h-full min-w-0" />
                </div>
              </div>
              {/* Save Changes — always at bottom of tab, never overlaps editor */}
              <div className="flex-none border-t bg-muted/20 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">Save Changes</h3>
                    <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">* Change documentation required</span>
                  </div>
                  {currentVersion ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Current:</span>
                      <Badge variant="outline" className="font-mono">v{currentVersion.version}</Badge>
                      <span>→</span>
                      <Badge variant="secondary" className="font-mono">v{nextVersion}</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>New:</span>
                      <Badge variant="secondary" className="font-mono">v1</Badge>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 min-w-0">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Describe your changes (required)..."
                    className="min-w-[12rem] flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <label className="flex shrink-0 items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="rounded border-input h-4 w-4"
                    />
                    Auto-approve
                  </label>
                  <Button
                    type="button"
                    onClick={handleCreateRevision}
                    disabled={creatingRevision || !(commitMessage && commitMessage.trim())}
                    className="shrink-0"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {creatingRevision ? 'Saving...' : 'Save version'}
                  </Button>
                </div>
              </div>
            </TabsContent>

          <TabsContent value="history" className="mt-0 flex-1 min-h-0 flex flex-col px-6 pb-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <GitCommit className="h-5 w-5" />
                  Version History
                </h2>
                <p className="text-sm text-muted-foreground">
                  All approved and rejected changes. Click on a revision to view the full diff.
                </p>
              </div>
            </div>
            
            {history.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-12">
                  <GitCommit className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No history yet.</p>
                  <p className="text-sm text-muted-foreground">Save or approve a proposed change to see commits here.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto space-y-3">
                {[...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((rev, idx) => {
                  const isLatestApproved = rev.status === 'approved' && idx === 0;
                  return (
                    <div 
                      key={rev.id} 
                      className={`rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 cursor-pointer ${isLatestApproved ? 'border-l-4 border-l-primary' : ''}`}
                      onClick={() => setDiffRevision(rev)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header row: status badge, active indicator */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={
                                rev.status === 'approved'
                                  ? 'success'
                                  : rev.status === 'rejected'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {rev.status === 'approved' ? 'Approved' : rev.status === 'rejected' ? 'Rejected' : rev.status}
                            </Badge>
                            {isLatestApproved && (
                              <Badge variant="outline" className="text-primary border-primary/50">
                                Active
                              </Badge>
                            )}
                          </div>
                          
                          {/* Commit message */}
                          <p className="font-medium text-sm mb-2">
                            {rev.commitMessage || 'No commit message'}
                          </p>
                          
                          {/* Meta info row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Created {formatDate(rev.createdAt)}</span>
                            {rev.createdBy && <span>by {formatApprovedBy(rev.createdBy)}</span>}
                            {rev.approvedBy && (
                              <span className="flex items-center gap-1">
                                <Check className="h-3 w-3 text-green-600" />
                                Approved by {formatApprovedBy(rev.approvedBy)}
                              </span>
                            )}
                          </div>
                          
                          {/* Inline diff preview */}
                          {context && (
                            <div className="mt-3 rounded border border-border/60 bg-muted/20 overflow-hidden max-h-32 overflow-y-auto">
                              <ContentDiffView
                                oldContent={rev.content}
                                newContent={context.content ?? {}}
                                oldLabel="Revision"
                                newLabel="Current"
                                className="!border-0 !rounded-none text-[11px]"
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDiffRevision(rev);
                            }}
                            className="gap-1.5"
                          >
                            <FileEdit className="h-3.5 w-3.5" />
                            View diff
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-0 flex-1 min-h-0 flex flex-col px-6 pb-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <GitPullRequest className="h-5 w-5" />
                  Pending Review
                </h2>
                <p className="text-sm text-muted-foreground">
                  Proposed changes waiting for approval or rejection.
                </p>
              </div>
            </div>
            
            {proposed.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-12">
                  <GitPullRequest className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending proposals.</p>
                  <p className="text-sm text-muted-foreground">Use "Propose changes" on the Content tab.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto space-y-3">
                {proposed.map((rev) => (
                  <div 
                    key={rev.id} 
                    className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="pending_review">
                            Pending Review
                          </Badge>
                        </div>
                        
                        {/* Commit message */}
                        <p className="font-medium text-sm mb-2">
                          {rev.commitMessage || 'No commit message'}
                        </p>
                        
                        {/* Meta info row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                          <span>Created {formatDate(rev.createdAt)}</span>
                          {rev.createdBy && <span>by {formatApprovedBy(rev.createdBy)}</span>}
                          {rev.submittedBy && <span>Submitted by {formatApprovedBy(rev.submittedBy)}</span>}
                        </div>
                        
                        {/* Diff preview */}
                        {context && (
                          <div 
                            className="rounded border border-border/60 bg-background/80 overflow-hidden max-h-40 overflow-y-auto cursor-pointer hover:border-primary/50 transition-colors"
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
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="approve"
                          onClick={() => handleApproveRevision(rev.id)}
                          className="gap-1.5"
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive gap-1.5"
                          onClick={() => handleRejectRevision(rev.id)}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDiffRevision(rev)}
                          className="gap-1.5 text-xs"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          View diff
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar — same as prompt detail */}
        <aside className="w-72 border-l bg-muted/10 p-5 overflow-auto shrink-0 hidden lg:block">
          <div className="space-y-6">
            {/* Active version */}
            {currentVersion && (
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Active Version</h3>
                <div className="space-y-2">
                  <Badge variant="success" className="font-mono">v{currentVersion.version}</Badge>
                  {currentVersion.approvedBy && (
                    <p className="text-xs text-muted-foreground">Approved by {formatApprovedBy(currentVersion.approvedBy)}</p>
                  )}
                  {currentVersion.approvedAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(currentVersion.approvedAt)}</p>
                  )}
                </div>
              </section>
            )}

            {/* Compliance */}
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Compliance
              </h3>
              <ComplianceMetadataFields
                organizations={organizations}
                orgId={orgId}
                onOrgIdChange={setOrgId}
                dataClassification={dataClassification}
                regulatoryHooks={regulatoryHooks}
                onDataClassificationChange={setDataClassification}
                onRegulatoryHooksChange={setRegulatoryHooks}
              />
            </section>

            {/* Linked agents */}
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Bot className="h-3 w-3" />
                Linked Agents
              </h3>
              {(context.agents?.length ?? 0) > 0 ? (
                <ul className="space-y-1.5">
                  {context.agents!.map((a) => (
                    <li key={a.id}>
                      <Link href={`/agents/${a.id}`} className="text-sm text-primary hover:underline">
                        {a.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No linked agents</p>
              )}
            </section>

            {/* API endpoint */}
            <InjectApiBar contextName={context.name} />
          </div>
        </aside>
      </div>

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
  );
}
