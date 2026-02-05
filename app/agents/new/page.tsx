'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Link2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Organization } from '@/types';

function RegisterAgentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrgId = searchParams.get('orgId') || '';

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [tab, setTab] = useState<'url' | 'manual'>('url');

  // Register by URL
  const [a2aUrl, setA2aUrl] = useState('');
  const [orgIdUrl, setOrgIdUrl] = useState(preselectedOrgId);
  const [nameOverride, setNameOverride] = useState('');
  const [descOverride, setDescOverride] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [error, setError] = useState('');

  // Manual
  const [nameManual, setNameManual] = useState('');
  const [descriptionManual, setDescriptionManual] = useState('');
  const [a2aUrlManual, setA2aUrlManual] = useState('');
  const [orgIdManual, setOrgIdManual] = useState(preselectedOrgId);
  const [loadingManual, setLoadingManual] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/organizations'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const allOrgs = (d.data as Organization[]) ?? [];
          setOrgs(allOrgs);
          const firstId = allOrgs[0]?.id;
          if (!orgIdUrl && firstId) setOrgIdUrl(firstId);
          if (!orgIdManual && firstId) setOrgIdManual(firstId);
        }
      });
  }, [preselectedOrgId]);

  const handleRegisterByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!a2aUrl.trim() || !orgIdUrl) return;
    setLoadingUrl(true);
    try {
      const res = await fetch(apiUrl('/api/agents/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: orgIdUrl,
          a2aUrl: a2aUrl.trim(),
          name: nameOverride.trim() || undefined,
          description: descOverride.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/agents/${data.data.id}`);
        return;
      }
      setError(data.error || 'Registration failed');
    } catch (err) {
      setError('Network error');
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nameManual.trim() || !a2aUrlManual.trim() || !orgIdManual) return;
    setLoadingManual(true);
    try {
      const res = await fetch(apiUrl('/api/agents'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: orgIdManual,
          name: nameManual.trim(),
          description: descriptionManual.trim() || undefined,
          a2aUrl: a2aUrlManual.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/agents/${data.data.id}`);
        return;
      }
      setError(data.error || 'Create failed');
    } catch (err) {
      setError('Network error');
    } finally {
      setLoadingManual(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <Breadcrumb items={[{ label: 'Agents', href: '/agents' }, { label: 'Register agent' }]} className="mb-2" />
            <h1 className="text-2xl font-semibold tracking-tight">Register agent</h1>
            <p className="text-sm text-muted-foreground">
              Add an agent by service URL (we fetch the Agent Card) or add manually. A2A-compatible.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-xl">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as 'url' | 'manual'); setError(''); }}>
            <TabsList>
              <TabsTrigger value="url">By service URL</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Register by URL
                  </CardTitle>
                  <CardDescription>
                    Enter the agent&apos;s service endpoint URL. We will try the URL and /.well-known/agent-card.json to fetch the Agent Card (A2A).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegisterByUrl} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="a2aUrl">Service URL *</Label>
                      <Input
                        id="a2aUrl"
                        value={a2aUrl}
                        onChange={(e) => setA2aUrl(e.target.value)}
                        placeholder="https://agent.example.com/api/a2a or https://agent.example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Organization *</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={orgIdUrl}
                        onChange={(e) => setOrgIdUrl(e.target.value)}
                      >
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nameOverride">Name override</Label>
                      <Input
                        id="nameOverride"
                        value={nameOverride}
                        onChange={(e) => setNameOverride(e.target.value)}
                        placeholder="Leave blank to use name from Agent Card"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descOverride">Description override</Label>
                      <Input
                        id="descOverride"
                        value={descOverride}
                        onChange={(e) => setDescOverride(e.target.value)}
                        placeholder="Leave blank to use from Agent Card"
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" disabled={loadingUrl}>
                      {loadingUrl ? 'Fetching Agent Card…' : 'Register agent'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Add agent manually
                  </CardTitle>
                  <CardDescription>
                    Add an agent without fetching the Agent Card. You can refresh the card later from the agent detail page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateManual} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nameManual">Name *</Label>
                      <Input
                        id="nameManual"
                        value={nameManual}
                        onChange={(e) => setNameManual(e.target.value)}
                        placeholder="My Agent"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descriptionManual">Description</Label>
                      <Input
                        id="descriptionManual"
                        value={descriptionManual}
                        onChange={(e) => setDescriptionManual(e.target.value)}
                        placeholder="What this agent does"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="a2aUrlManual">Service URL *</Label>
                      <Input
                        id="a2aUrlManual"
                        value={a2aUrlManual}
                        onChange={(e) => setA2aUrlManual(e.target.value)}
                        placeholder="https://agent.example.com/api/a2a"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Organization *</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={orgIdManual}
                        onChange={(e) => setOrgIdManual(e.target.value)}
                      >
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" disabled={loadingManual}>
                      {loadingManual ? 'Creating…' : 'Add agent'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function RegisterAgentPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-full"><header className="border-b bg-background px-6 py-4"><div className="h-8 w-48 bg-muted animate-pulse rounded" /></header><div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-xl" /></div></div>}>
      <RegisterAgentForm />
    </Suspense>
  );
}
