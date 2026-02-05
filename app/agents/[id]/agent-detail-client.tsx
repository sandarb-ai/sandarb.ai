'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  RefreshCw,
  Check,
  XCircle,
  GitPullRequest,
  Shield,
  Cpu,
  Database,
  User,
  Building2,
  FileText,
  FolderOpen,
  HeartPulse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { formatDate, formatApprovedBy } from '@/lib/utils';
import type { RegisteredAgent } from '@/types';
import type { AgentCard, AgentSkill } from '@/types';

interface AgentDetailClientProps {
  initialAgent: RegisteredAgent;
}

function FieldRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr] gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={mono ? 'text-sm font-mono break-all' : 'text-sm'}>{value}</span>
    </div>
  );
}

export function AgentDetailClient({ initialAgent }: AgentDetailClientProps) {
  const [agent, setAgent] = useState<RegisteredAgent>(initialAgent);
  const id = agent.id;

  const refreshAgentCard = async () => {
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setAgent(data.data);
      }
    } catch {
    }
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setAgent(data.data);
      }
    } catch {
    }
  };

  const handleReject = async () => {
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setAgent(data.data);
      }
    } catch {
    }
  };

  const card = agent.agentCard;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 border-b bg-background px-6 py-4">
        <div className="min-w-0 flex-1">
          <Breadcrumb items={[{ label: 'Agents', href: '/agents' }, { label: agent.name }]} className="mb-1" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {agent.organization && (
            <Link
              href={`/organizations/${agent.organization.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline w-fit"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              {agent.organization.name}
            </Link>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Bot className="h-6 w-6 text-muted-foreground shrink-0" />
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <Badge
            variant={
              (agent.approvalStatus ?? 'draft') === 'approved'
                ? 'success'
                : (agent.approvalStatus ?? 'draft') === 'pending_approval'
                  ? 'pending_review'
                  : (agent.approvalStatus ?? 'draft') === 'rejected'
                    ? 'rejected'
                    : 'secondary'
            }
            className="capitalize"
          >
            {(agent.approvalStatus ?? 'draft') === 'pending_approval' ? (
              <><GitPullRequest className="h-3 w-3 mr-1 inline" /> Pending</>
            ) : (agent.approvalStatus ?? 'draft') === 'approved' ? (
              'Active'
            ) : (
              (agent.approvalStatus ?? 'draft') === 'rejected' ? 'Rejected' : 'Draft'
            )}
          </Badge>
          </div>
        </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {(agent.approvalStatus ?? 'draft') === 'pending_approval' && (
            <>
              <Button size="sm" variant="approve" onClick={handleApprove}>
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={handleReject}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          <a href={agent.a2aUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Service URL
            </Button>
          </a>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
          {/* Left: Main content */}
          <div className="space-y-6">
            {/* Identity Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Agent Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 bg-muted/30 p-3">
                  {agent.organization && (
                    <FieldRow
                      label="Organization"
                      value={
                        <Link href={`/organizations/${agent.organization.id}`} className="font-medium text-primary hover:underline">
                          {agent.organization.name}
                        </Link>
                      }
                    />
                  )}
                  <FieldRow label="Agent ID" value={agent.agentId ?? '—'} mono />
                  <FieldRow label="Name" value={agent.name} />
                  <FieldRow label="Description" value={agent.description ?? '—'} />
                  <FieldRow
                    label="Service URL"
                    value={
                      <a
                        href={agent.a2aUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {agent.a2aUrl}
                      </a>
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* A2A Agent Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Agent Card (A2A)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {card
                      ? 'Fetched from service endpoint.'
                      : 'Not cached. Fetch to show protocol details.'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={refreshAgentCard}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {card ? 'Refresh' : 'Fetch'}
                </Button>
              </CardHeader>
              <CardContent>
                {card ? (
                  <div className="space-y-4">
                    <FieldRow label="Version" value={`v${card.version}`} />
                    {card.provider && (
                      <FieldRow
                        label="Provider"
                        value={`${card.provider.organization}${card.provider.url ? ` — ${card.provider.url}` : ''}`}
                      />
                    )}
                    {card.documentationUrl && (
                      <FieldRow
                        label="Documentation"
                        value={
                          <a href={card.documentationUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {card.documentationUrl}
                          </a>
                        }
                      />
                    )}
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                    {card.capabilities &&
                      typeof card.capabilities === 'object' &&
                      !Array.isArray(card.capabilities) && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capabilities</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(card.capabilities)
                              .filter(([, v]) => v === true)
                              .map(([k]) => (
                                <Badge key={k} variant="secondary">
                                  {k}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                    {(card.defaultInputModes?.length > 0 || card.defaultOutputModes?.length > 0) && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {card.defaultInputModes?.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Input modes</span>
                            <p className="text-sm font-mono mt-1">{card.defaultInputModes.join(', ')}</p>
                          </div>
                        )}
                        {card.defaultOutputModes?.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Output modes</span>
                            <p className="text-sm font-mono mt-1">{card.defaultOutputModes.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click <strong>Fetch</strong> to load version, capabilities, and skills from the service URL.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            {card?.skills && card.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Skills</CardTitle>
                  <p className="text-sm text-muted-foreground">A2A skills declared by this agent.</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {(card.skills as AgentSkill[]).map((skill) => (
                      <li key={skill.id} className="border-b border-border/50 last:border-0 pb-4 last:pb-0">
                        <div className="font-medium">{skill.name}</div>
                        <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{skill.id}</code>
                          {skill.tags?.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Linked Prompts and Contexts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Linked Prompts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agent.linkedPrompts && agent.linkedPrompts.length > 0 ? (
                    <ul className="space-y-2">
                      {agent.linkedPrompts.map((prompt) => (
                        <li key={prompt.id}>
                          <Link
                            href={`/prompts/${prompt.id}`}
                            className="flex items-center gap-2 text-sm text-primary hover:underline group"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="truncate">{prompt.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No prompts linked</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Linked Contexts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agent.linkedContexts && agent.linkedContexts.length > 0 ? (
                    <ul className="space-y-2">
                      {agent.linkedContexts.map((ctx) => (
                        <li key={ctx.id}>
                          <Link
                            href={`/contexts/${ctx.id}`}
                            className="flex items-center gap-2 text-sm text-primary hover:underline group"
                          >
                            <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="truncate">{ctx.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No contexts linked</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Last Communicated - Prominent */}
            <div className={`rounded-xl border-2 p-5 ${agent.lastAccessedAt ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`rounded-full p-2.5 ${agent.lastAccessedAt ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-muted'}`}>
                  <HeartPulse className={`h-6 w-6 ${agent.lastAccessedAt ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Last Communicated</h3>
                  <p className="text-xs text-muted-foreground">with Sandarb AI Governance Agent</p>
                </div>
              </div>
              {agent.lastAccessedAt ? (
                <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatDate(agent.lastAccessedAt)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Never communicated</p>
              )}
            </div>

            {/* Governance & Compliance - Merged */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Governance & Compliance</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      (agent.approvalStatus ?? 'draft') === 'approved' ? 'success' :
                      (agent.approvalStatus ?? 'draft') === 'pending_approval' ? 'pending_review' :
                      (agent.approvalStatus ?? 'draft') === 'rejected' ? 'rejected' : 'secondary'
                    }
                  >
                    {(agent.approvalStatus ?? 'draft') === 'approved' ? 'Active' :
                     (agent.approvalStatus ?? 'draft') === 'pending_approval' ? 'Pending' :
                     (agent.approvalStatus ?? 'draft') === 'rejected' ? 'Rejected' : 'Draft'}
                  </Badge>
                </div>

                {agent.ownerTeam && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Owner team</span>
                    <span className="font-medium">{agent.ownerTeam}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">PII handling</span>
                  <Badge variant={agent.piiHandling ? 'destructive' : 'outline'}>
                    {agent.piiHandling ? 'Yes' : 'No'}
                  </Badge>
                </div>

                {agent.toolsUsed && agent.toolsUsed.length > 0 && (
                  <div className="py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground text-xs block mb-2">Tools used</span>
                    <div className="flex flex-wrap gap-1">
                      {agent.toolsUsed.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {agent.allowedDataScopes && agent.allowedDataScopes.length > 0 && (
                  <div className="py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground text-xs block mb-2">Data scopes</span>
                    <div className="flex flex-wrap gap-1">
                      {agent.allowedDataScopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {agent.regulatoryScope && agent.regulatoryScope.length > 0 && (
                  <div className="py-1.5">
                    <span className="text-muted-foreground text-xs block mb-2">Regulatory scope</span>
                    <div className="flex flex-wrap gap-1">
                      {agent.regulatoryScope.map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 mt-2 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span>{formatDate(agent.createdAt)}</span>
                  </div>
                  {agent.createdBy && (
                    <div className="flex justify-between">
                      <span>Created by</span>
                      <span>{formatApprovedBy(agent.createdBy)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Modified</span>
                    <span>{formatDate(agent.updatedAt)}</span>
                  </div>
                  {agent.approvedBy && (
                    <div className="flex justify-between">
                      <span>Approved by</span>
                      <span>{formatApprovedBy(agent.approvedBy)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
