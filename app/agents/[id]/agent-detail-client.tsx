'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Bot, ExternalLink, RefreshCw, Check, XCircle, GitPullRequest } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RegisteredAgent } from '@/types';
import type { AgentCard, AgentSkill } from '@/types';

interface AgentDetailClientProps {
  initialAgent: RegisteredAgent;
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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
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
          <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>{agent.status}</Badge>
          <Badge
            variant={
              (agent.approvalStatus ?? 'draft') === 'approved'
                ? 'success'
                : (agent.approvalStatus ?? 'draft') === 'pending_approval'
                  ? 'secondary'
                  : (agent.approvalStatus ?? 'draft') === 'rejected'
                    ? 'destructive'
                    : 'outline'
            }
            className="capitalize"
          >
            {(agent.approvalStatus ?? 'draft') === 'pending_approval' ? (
              <><GitPullRequest className="h-3 w-3 mr-1 inline" /> Pending review</>
            ) : (
              agent.approvalStatus ?? 'draft'
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
              A2A endpoint
            </Button>
          </a>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {agent.description && (
          <p className="text-muted-foreground">{agent.description}</p>
        )}

        {card ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Agent Card (A2A)</CardTitle>
                <Button variant="ghost" size="sm" onClick={refreshAgentCard}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{card.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">v{card.version}</Badge>
                  {card.capabilities &&
                    typeof card.capabilities === 'object' &&
                    !Array.isArray(card.capabilities) &&
                    Object.entries(card.capabilities)
                      .filter(([, v]) => v === true)
                      .map(([k]) => (
                        <Badge key={k} variant="secondary">
                          {k}
                        </Badge>
                      ))}
                </div>
              </CardContent>
            </Card>

            {card.skills && card.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {(card.skills as AgentSkill[]).map((skill) => (
                      <li key={skill.id} className="border-b last:border-0 pb-4 last:pb-0">
                        <div className="font-medium">{skill.name}</div>
                        <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                        <code className="text-xs bg-muted px-1 rounded mt-2 inline-block">{skill.id}</code>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No Agent Card cached. This agent was added manually. Endpoint: {agent.a2aUrl}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
