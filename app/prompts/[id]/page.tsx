'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  History,
  GitPullRequest,
  Check,
  XCircle,
  FileEdit,
  MessageSquare,
  Plus,
  Shield,
  Clock,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Prompt, PromptVersion, PromptVersionStatus } from '@/types';
import { formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<PromptVersionStatus, 'default' | 'success' | 'destructive' | 'secondary' | 'outline'> = {
  draft: 'secondary',
  proposed: 'default',
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

  useEffect(() => {
    if (id) fetchPrompt();
  }, [id]);

  const fetchPrompt = async () => {
    try {
      const res = await fetch(`/api/prompts/${id}`);
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
    } catch (error) {
      console.error('Failed to fetch prompt:', error);
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
      const res = await fetch(`/api/prompts/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (error) {
      console.error('Failed to create version:', error);
      alert('Failed to create version');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleApprove = async (versionId: string) => {
    try {
      const res = await fetch(`/api/prompts/${id}/versions/${versionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchPrompt();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (versionId: string) => {
    try {
      const res = await fetch(`/api/prompts/${id}/versions/${versionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchPrompt();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prompt and all its versions?')) return;
    try {
      const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/prompts');
      else alert('Failed to delete prompt');
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  const proposed = versions.filter((v) => v.status === 'proposed');
  const history = versions.filter((v) => v.status === 'approved' || v.status === 'rejected' || v.status === 'archived');

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

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/prompts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight font-mono">{prompt?.name}</h1>
              {currentVersion ? (
                <Badge variant="success">v{currentVersion.version}</Badge>
              ) : (
                <Badge variant="secondary">Draft</Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground truncate max-w-md">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleCreateVersion} disabled={creatingVersion || !newContent.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {creatingVersion ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mb-4 shrink-0">
            <TabsTrigger value="content" className="gap-2">
              <FileEdit className="h-4 w-4" />
              Edit
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
            <div className="grid gap-6 lg:grid-cols-[1fr,minmax(300px,360px)] min-h-0 h-[calc(100vh-160px)]">
              {/* Left: Prompt editor + New version bar */}
              <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                <div className="flex flex-col min-h-0 flex-1">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-semibold text-foreground">Edit Prompt</h3>
                    <p className="text-xs text-muted-foreground">
                      Instructions on behavior, tone, and safety. Versioned and auditable.
                    </p>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/80 overflow-hidden bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="flex-1 min-h-0 w-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring rounded-xl"
                      placeholder="You are a helpful assistant. Follow company guidelines..."
                    />
                  </div>
                </div>
                {/* New version: commit message + auto-approve + Save */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-4 py-3 shrink-0">
                  <input
                    type="text"
                    value={newCommitMessage}
                    onChange={(e) => setNewCommitMessage(e.target.value)}
                    placeholder="Commit message (required)"
                    className="flex-1 min-w-[200px] h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      id="autoApprove"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="rounded border-input"
                    />
                    <span className="text-xs text-muted-foreground">Auto-approve (skip review)</span>
                  </label>
                  <Button
                    size="sm"
                    onClick={handleCreateVersion}
                    disabled={creatingVersion || !newContent.trim() || !newCommitMessage.trim()}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {creatingVersion ? 'Saving...' : 'Save new version'}
                  </Button>
                </div>
              </div>

              {/* Right: Governance sidebar — current version, workflow, model */}
              <div className="flex flex-col min-h-0 lg:sticky lg:top-[57px] lg:self-start lg:max-h-[calc(100vh-100px)] overflow-auto">
                <Card className="border-l-4 border-l-primary shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Governance
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Versioning and approval for AI governance. All changes are auditable.
                    </p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-4">
                    {/* Current active version */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Current active version</h4>
                      {currentVersion ? (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="success">v{currentVersion.version}</Badge>
                            {currentVersion.model && (
                              <span className="text-xs text-muted-foreground font-mono">{currentVersion.model}</span>
                            )}
                          </div>
                          {currentVersion.approvedBy && (
                            <p className="text-xs text-muted-foreground">Approved by {currentVersion.approvedBy}</p>
                          )}
                          {currentVersion.approvedAt && (
                            <p className="text-xs text-muted-foreground">{formatDate(currentVersion.approvedAt)}</p>
                          )}
                          <pre className="text-xs font-mono whitespace-pre-wrap max-h-24 overflow-hidden mt-2 border-t border-border/40 pt-2">
                            {currentVersion.content.slice(0, 400)}{currentVersion.content.length > 400 ? '...' : ''}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/60 p-3">
                          No active version yet. Save a version with Auto-approve or submit for review.
                        </p>
                      )}
                    </div>
                    {/* Approval workflow */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Approval workflow</h4>
                      <p className="text-xs text-muted-foreground">
                        Draft → Pending Review → Approved. The latest approved version is what agents use. Require sign-off for production (uncheck Auto-approve).
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  All approved, rejected, and archived versions. The latest approved version is active.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center px-6">
                    No version history yet. Create and approve a version to see history.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Version</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Approved By</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Commit Message</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground max-w-md">Content Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((v) => (
                          <tr key={v.id} className="border-b border-border/80 hover:bg-muted/20 align-top">
                            <td className="py-3 px-4 font-mono">v{v.version}</td>
                            <td className="py-3 px-4">
                              <Badge variant={STATUS_COLORS[v.status]}>
                                {STATUS_LABELS[v.status]}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                              {formatDate(v.createdAt)}
                              {v.createdBy && <span className="block text-xs">by {v.createdBy}</span>}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {v.approvedBy || '—'}
                              {v.approvedAt && <span className="block text-xs text-muted-foreground">{formatDate(v.approvedAt)}</span>}
                            </td>
                            <td className="py-3 px-4 max-w-[12rem]">
                              <p className="truncate" title={v.commitMessage || undefined}>
                                {v.commitMessage || 'No message'}
                              </p>
                            </td>
                            <td className="py-3 px-4 max-w-md">
                              <pre className="text-xs font-mono bg-muted rounded p-2 overflow-hidden max-h-20 whitespace-pre-wrap">
                                {v.content.slice(0, 200)}{v.content.length > 200 ? '...' : ''}
                              </pre>
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
                  Pending Review
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Proposed versions waiting for approval. Review and approve or reject.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {proposed.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center px-6">
                    No pending versions. Use "Create New Version" on the Edit tab to propose changes.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Version</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Commit Message</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground max-w-md">Content</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposed.map((v) => (
                          <tr key={v.id} className="border-b border-border/80 hover:bg-muted/20 align-top">
                            <td className="py-3 px-4 font-mono">v{v.version}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                              {formatDate(v.createdAt)}
                              {v.createdBy && <span className="block text-xs">by {v.createdBy}</span>}
                            </td>
                            <td className="py-3 px-4 max-w-[12rem]">
                              <p className="truncate font-medium" title={v.commitMessage || undefined}>
                                {v.commitMessage || 'No message'}
                              </p>
                            </td>
                            <td className="py-3 px-4 max-w-md">
                              <pre className="text-xs font-mono bg-muted rounded p-2 overflow-hidden max-h-32 whitespace-pre-wrap">
                                {v.content}
                              </pre>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="approve"
                                className="mr-1"
                                onClick={() => handleApprove(v.id)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => handleReject(v.id)}
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
      </div>
    </div>
  );
}
