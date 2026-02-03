'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import type { Template } from '@/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(apiUrl('/api/templates'));
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable schemas and default values for context content. Link contexts to a template for consistent structure and governance. See <a href="/docs#templates" className="text-violet-600 dark:text-violet-400 hover:underline">Docs → Templates for context</a>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl border bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Templates define a JSON schema and default values for context content so all contexts of the same type (e.g. trading limits) follow the same structure. Run the seed (Load sample data on Dashboard) to add sample templates: compliance policy, trading limits, suitability policy, KYC config, disclosure policy."
            actionLabel="View docs"
            actionHref="/docs#templates"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {template.description || 'No description'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
