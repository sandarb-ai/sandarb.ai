'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import {
  ArrowLeft,
  Save,
  Trash2,
  History,
  GitPullRequest,
  Check,
  XCircle,
  FileEdit,
  Copy,
  ExternalLink,
  Bot,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { TextDiffView } from '@/components/text-diff-view';
import type { Prompt, PromptVersion, PromptVersionStatus } from '@/types';
import { formatDate, formatApprovedBy } from '@/lib/utils';

const STATUS_COLORS: Record<PromptVersionStatus, 'default' | 'success' | 'destructive' | 'secondary' | 'outline' | 'pending_review'> = {
  draft: 'secondary',
  proposed: 'pending_review',
  approved: 'success',
  rejected: 'destructive',
  archived: 'outline',
};

const STATUS_LABELS: Record<PromptVersionStatus, string> = {
  draft: 'Draft',
  proposed: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
};


export default function PromptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<PromptVersion | null>(null);
  const [description, setDescription] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCommitMessage, setNewCommitMessage] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');
  const [newModel, setNewModel] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) fetchPrompt();
  }, [id]);

  const fetchPrompt = async () => {
    try {
      const res = await fetch(apiUrl(`/api/prompts/${id}`));
      const data = await res.json();
      if (data.success) {
        const p = data.data;
        setPrompt(p);
        setDescription(p.description || '');
        setVersions(p.versions || []);
        setCurrentVersion(p.currentVersion || null);
        
        // Pre-fill editor with current version content
        if (p.currentVersion) {
          setNewContent(p.currentVersion.content || '');
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!newContent.trim()) {
      alert('Content is required');
      return;
    }
    if (!newCommitMessage.trim()) {
      alert('Commit message is required');
      return;
    }

    setCreatingVersion(true);
    try {
      const res = await fetch(apiUrl(`/api/prompts/${id}/versions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({
          content: newContent,
          systemPrompt: newSystemPrompt || undefined,
          model: newModel || undefined,
          commitMessage: newCommitMessage,
          autoApprove,
        }),
      });
      if (res.ok) {
        setNewCommitMessage('');
        setActiveTab(autoApprove ? 'history' : 'pending');
        fetchPrompt();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create version');
      }
    } catch {
      alert('Failed to create version');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleApprove = async (versionId: string) => {
    const approvedBy = window.prompt('Enter your name (for Approved By):');
    if (approvedBy == null || !approvedBy.trim()) return;
    try {
      const res = await fetch(apiUrl(`/api/prompts/${id}/versions/${versionId}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({ approvedBy: approvedBy.trim() }),
      });
      if (res.ok) {
        fetchPrompt();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.detail || 'Failed to approve version');
      }
    } catch {
      alert('Failed to approve version');
    }
  };

  const handleReject = async (versionId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/prompts/${id}/versions/${versionId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchPrompt();
      }
    } catch {
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prompt and all its versions?')) return;
    try {
      const res = await fetch(apiUrl(`/api/prompts/${id}`), { method: 'DELETE', headers: getWriteAuthHeaders() });
      if (res.ok) router.push('/prompts');
      else alert('Failed to delete prompt');
    } catch {
    }
  };

  const proposed = versions.filter((v) => v.status === 'proposed');
  const history = versions.filter((v) => v.status === 'approved' || v.status === 'rejected' || v.status === 'archived');
  const historyByVersion = [...history].sort((a, b) => b.version - a.version);

  function getPreviousVersionInHistory(v: PromptVersion): PromptVersion | null {
    const idx = historyByVersion.findIndex((x) => x.id === v.id);
    return idx >= 0 && idx < historyByVersion.length - 1 ? historyByVersion[idx + 1]! : null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">Prompt not found.</p>
        <Link href="/prompts">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to prompts
          </Button>
        </Link>
      </div>
    );
  }

  const apiPath = `/api/prompts/pull?name=${encodeURIComponent(prompt?.name || '')}&agentId=preview&traceId=test`;
  const fullUrl = apiUrl(apiPath);

  const handleCopyApi = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Clean header */}
      <header className="flex items-center justify-between border-b px-6 py-4 bg-background shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <Breadcrumb items={[{ label: 'Prompts', href: '/prompts' }, { label: prompt?.name ?? '…' }]} className="mb-1" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold font-mono truncate">{prompt?.name}</h1>
              {currentVersion && (
                <Badge variant="outline" className="font-mono">v{currentVersion.version}</Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentVersion ? (
            <Badge variant="success" className="h-8 px-3 text-xs">Active</Badge>
          ) : (
            <Badge variant="secondary" className="h-8 px-3 text-xs">Draft</Badge>
          )}
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

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Editor and tabs */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
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

            {/* Edit tab */}
            <TabsContent value="content" className="mt-0 flex-1 flex flex-col min-h-0 m-0">
              <div className="flex-1 min-h-0 p-6">
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full h-full p-5 font-mono text-sm leading-relaxed resize-none rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="You are a helpful assistant..."
                />
              </div>
              {/* Version & Commit section */}
              <div className="border-t bg-muted/20 px-6 py-4 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">Save Changes</h3>
                    <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">* Change documentation required</span>
                  </div>
                  {currentVersion && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Current:</span>
                      <Badge variant="outline" className="font-mono">v{currentVersion.version}</Badge>
                      <span>→</span>
                      <Badge variant="secondary" className="font-mono">v{currentVersion.version + 1}</Badge>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={newCommitMessage}
                    onChange={(e) => setNewCommitMessage(e.target.value)}
                    placeholder="Describe your changes (required)..."
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="rounded border-input h-4 w-4"
                    />
                    Auto-approve
                  </label>
                  <Button
                    onClick={handleCreateVersion}
                    disabled={creatingVersion || !newContent.trim() || !newCommitMessage.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {creatingVersion ? 'Saving...' : 'Save version'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="mt-0 flex-1 min-h-0 m-0 overflow-auto">
              <div className="p-6">
                {history.length === 0 ? (
                  <div className="text-center py-16">
                    <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No version history yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Save a version to see it here</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-4xl">
                    {historyByVersion.map((v, idx) => {
                      const isActive = v.status === 'approved' && idx === 0;
                      return (
                        <div 
                          key={v.id} 
                          className={`rounded-lg border p-4 transition-all hover:shadow-sm ${isActive ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono font-semibold">v{v.version}</span>
                                <Badge variant={STATUS_COLORS[v.status]}>{STATUS_LABELS[v.status]}</Badge>
                                {isActive && <Badge variant="outline" className="border-primary/50 text-primary">Active</Badge>}
                              </div>
                              <p className="text-sm font-medium mb-2">{v.commitMessage || 'No commit message'}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>{formatDate(v.createdAt)}</span>
                                {v.approvedBy && (
                                  <span className="flex items-center gap-1">
                                    <Check className="h-3 w-3 text-green-600" />
                                    {formatApprovedBy(v.approvedBy)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setDiffVersion(v)}>
                              View diff
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Pending tab */}
            <TabsContent value="pending" className="mt-0 flex-1 min-h-0 m-0 overflow-auto">
              <div className="p-6">
                {proposed.length === 0 ? (
                  <div className="text-center py-16">
                    <GitPullRequest className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending versions</p>
                    <p className="text-sm text-muted-foreground mt-1">Uncheck auto-approve when saving to create a pending version</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-4xl">
                    {proposed.map((v) => (
                      <div 
                        key={v.id} 
                        className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-mono font-semibold">v{v.version}</span>
                              <Badge variant="pending_review">Pending</Badge>
                            </div>
                            <p className="text-sm font-medium mb-2">{v.commitMessage || 'No commit message'}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setDiffVersion(v)}>
                              Diff
                            </Button>
                            <Button size="sm" variant="approve" onClick={() => handleApprove(v.id)}>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReject(v.id)}>
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar - minimal and clean */}
        <aside className="w-72 border-l bg-muted/10 p-5 overflow-auto shrink-0 hidden lg:block">
          <div className="space-y-6">
            {/* Active version */}
            {currentVersion && (
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Active Version</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="font-mono">v{currentVersion.version}</Badge>
                    {currentVersion.model && (
                      <span className="text-xs font-mono text-muted-foreground">{currentVersion.model}</span>
                    )}
                  </div>
                  {currentVersion.approvedBy && (
                    <p className="text-xs text-muted-foreground">
                      Approved by {formatApprovedBy(currentVersion.approvedBy)}
                    </p>
                  )}
                  {currentVersion.approvedAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(currentVersion.approvedAt)}</p>
                  )}
                </div>
              </section>
            )}

            {/* Organizations */}
            {(prompt?.organizations?.length ?? 0) > 0 && (
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Organizations
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {prompt.organizations!.map((org) => (
                    <Link
                      key={org.id}
                      href={`/organizations/${org.id}`}
                      className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
                    >
                      {org.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Linked agents */}
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Bot className="h-3 w-3" />
                Linked Agents
              </h3>
              {(prompt?.agents?.length ?? 0) > 0 ? (
                <ul className="space-y-1.5">
                  {prompt.agents!.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/agents/${a.id}`}
                        className="text-sm text-primary hover:underline"
                      >
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
            {prompt?.name && (
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">API Endpoint</h3>
                <code className="block text-[11px] font-mono bg-muted rounded px-2 py-2 break-all mb-3">
                  GET {fullUrl}
                </code>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleCopyApi}>
                    {copied ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => window.open(fullUrl, '_blank')}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Test
                  </Button>
                </div>
              </section>
            )}
          </div>
        </aside>
      </div>

      {/* Version diff dialog */}
      <Dialog open={!!diffVersion} onOpenChange={(open) => !open && setDiffVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Version diff
              {diffVersion && (
                <Badge variant="outline" className="font-mono">
                  {getPreviousVersionInHistory(diffVersion) ? `v${getPreviousVersionInHistory(diffVersion)!.version}` : '(none)'} → v{diffVersion.version}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {diffVersion && (
            <TextDiffView
              oldText={getPreviousVersionInHistory(diffVersion)?.content ?? ''}
              newText={diffVersion.content}
              oldLabel={getPreviousVersionInHistory(diffVersion) ? `v${getPreviousVersionInHistory(diffVersion)!.version}` : '(none)'}
              newLabel={`v${diffVersion.version}`}
              className="flex-1 min-h-0"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
