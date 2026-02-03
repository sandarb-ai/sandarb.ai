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
  Calendar,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Bot className="h-6 w-6 text-muted-foreground" />
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
        <div className="flex items-center gap-4">
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

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Registry: all DB-backed agent fields */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Agent overview
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Identity, governance, and compliance fields stored in the registry.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User className="h-3 w-3" /> Identity
                </h4>
                <div className="rounded-md border border-border/50 bg-muted/30 p-3">
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
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Governance
                </h4>
                <div className="rounded-md border border-border/50 bg-muted/30 p-3">
                  <FieldRow
                    label="Status"
                    value={
                      (agent.approvalStatus ?? 'draft') === 'approved'
                        ? 'Active'
                        : (agent.approvalStatus ?? 'draft') === 'pending_approval'
                          ? 'Pending'
                          : (agent.approvalStatus ?? 'draft') === 'rejected'
                            ? 'Rejected'
                            : 'Draft'
                    }
                  />
                  <FieldRow label="Owner team" value={agent.ownerTeam ?? '—'} />
                  <FieldRow label="Created" value={formatDate(agent.createdAt)} />
                  <FieldRow label="Created by" value={formatApprovedBy(agent.createdBy)} />
                  <FieldRow label="Modified" value={formatDate(agent.updatedAt)} />
                  <FieldRow label="Modified by" value={formatApprovedBy(agent.updatedBy)} />
                  <FieldRow label="Submitted by" value={formatApprovedBy(agent.submittedBy)} />
                  {agent.approvedBy && (
                    <>
                      <FieldRow label="Approved by" value={formatApprovedBy(agent.approvedBy)} />
                      <FieldRow label="Approved at" value={agent.approvedAt ? formatDate(agent.approvedAt) : '—'} />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Capabilities & compliance
              </h4>
              <div className="rounded-md border border-border/50 bg-muted/30 p-3">
                <FieldRow
                  label="Tools used"
                  value={
                    agent.toolsUsed?.length
                      ? agent.toolsUsed.map((t) => <Badge key={t} variant="secondary" className="mr-1 mb-1">{t}</Badge>)
                      : '—'
                  }
                />
                <FieldRow
                  label="Data scopes"
                  value={
                    agent.allowedDataScopes?.length
                      ? agent.allowedDataScopes.map((s) => <Badge key={s} variant="outline" className="mr-1 mb-1">{s}</Badge>)
                      : '—'
                  }
                />
                <FieldRow label="PII handling" value={agent.piiHandling ? 'Yes' : 'No'} />
                <FieldRow
                  label="Regulatory scope"
                  value={
                    agent.regulatoryScope?.length
                      ? agent.regulatoryScope.map((r) => <Badge key={r} variant="outline" className="mr-1 mb-1">{r}</Badge>)
                      : '—'
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* A2A Agent Card: from service or placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Agent Card (A2A)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {card
                  ? 'Fetched from service endpoint. Version, capabilities, and skills.'
                  : 'Not cached. Fetch from Service URL to show protocol details.'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshAgentCard}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {card ? 'Refresh' : 'Fetch Agent Card'}
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
                Agent Card not fetched. Use <strong>Fetch Agent Card</strong> to load version, capabilities, and skills from the service URL.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Skills: only when we have cached card */}
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
      </div>
    </div>
  );
}
