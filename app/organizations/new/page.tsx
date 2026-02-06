'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import type { Organization } from '@/types';

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [parents, setParents] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/organizations?limit=500&offset=0'))
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        // Handle paginated { organizations, total, ... } or bare array
        const payload = d.data;
        const list = Array.isArray(payload)
          ? payload
          : (payload?.organizations && Array.isArray(payload.organizations))
            ? payload.organizations
            : [];
        setParents(list);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/organizations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          parentId: parentId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/organizations');
        return;
      }
      alert(data.error || 'Failed to create organization');
    } catch {
      alert('Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <Breadcrumb items={[{ label: 'Organizations', href: '/organizations' }, { label: 'New organization' }]} className="mb-2" />
            <h1 className="text-2xl font-semibold tracking-tight">New organization</h1>
            <p className="text-sm text-muted-foreground">
              Create a sub-org under root or another org (e.g. Data, Marketing, Ops).
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Name and optional parent. Slug is auto-generated from name if left blank.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                    }}
                    placeholder="e.g. Data Engineering"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="data-engineering"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Team or department description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent">Parent organization</Label>
                  <select
                    id="parent"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={parentId ?? ''}
                    onChange={(e) => setParentId(e.target.value || null)}
                  >
                    <option value="">Top-level</option>
                    {parents.filter((o) => !o.isRoot).map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating…' : 'Create organization'}
                  </Button>
                  <Link href="/organizations">
                    <Button type="button" variant="outline">Cancel</Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
