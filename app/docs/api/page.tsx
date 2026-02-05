import { getApiBase } from '@/lib/api';
import { DocsLayout } from '../docs-layout';
import { DocsSwaggerUI } from '../docs-swagger-ui';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export const metadata = {
  title: 'API Reference - Sandarb',
  description: 'Interactive API reference (Swagger UI) for Sandarb REST API. Test endpoints against localhost or your deployed API.',
};

const tocGroups = [
  {
    label: 'API Reference',
    items: [{ id: 'swagger-ui', label: 'Swagger UI' }],
  },
];

export const dynamic = 'force-dynamic';

export default function ApiReferencePage() {
  const initialApiBase = getApiBase() || 'http://localhost:8000';

  return (
    <DocsLayout tocGroups={tocGroups}>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">API Reference</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Interactive Swagger UI for the Sandarb FastAPI backend. Set the API base URL to{' '}
            <code className="rounded bg-muted px-1">http://localhost:8000</code> when running locally, or to your
            deployed API URL (e.g. GCP Cloud Run) to test against production.
          </p>
          <div className="mt-4">
            <Link href="/docs#rest-api">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Home className="h-4 w-4" />
                Back to Documentation
              </Button>
            </Link>
          </div>
        </div>

        <section id="swagger-ui" className="scroll-mt-24">
          <DocsSwaggerUI initialApiBase={initialApiBase} />
        </section>
      </div>
    </DocsLayout>
  );
}
