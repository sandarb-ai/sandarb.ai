'use client';

import Link from 'next/link';
import { ArrowLeft, Building2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Organization } from '@/types';
import type { RegisteredAgent } from '@/types';

interface OrganizationDetailClientProps {
  org: Organization;
  children: Organization[];
  agents: RegisteredAgent[];
}

export function OrganizationDetailClient({ org, children, agents }: OrganizationDetailClientProps) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 border-b bg-background px-6 py-4">
        <Link href="/organizations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          {org.isRoot && <Badge variant="secondary">Root</Badge>}
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {org.description && (
          <p className="text-muted-foreground">{org.description}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sub-organizations</CardTitle>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sub-orgs. Create one from the Organizations page.</p>
              ) : (
                <ul className="space-y-2">
                  {children.map((c) => (
                    <li key={c.id}>
                      <Link href={`/organizations/${c.id}`} className="text-sm text-primary hover:underline">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Registered agents</CardTitle>
              <Link href={`/agents/new?orgId=${org.id}`}>
                <Button size="sm">Add agent</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents registered. Register an A2A agent for this org.</p>
              ) : (
                <ul className="space-y-2">
                  {agents.map((a) => (
                    <li key={a.id}>
                      <Link href={`/agents/${a.id}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Bot className="h-4 w-4" />
                        {a.name}
                        <Badge variant="outline" className="text-xs">{a.status}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
