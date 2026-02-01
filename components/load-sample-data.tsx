'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiUrl } from '@/lib/api';

export function LoadSampleDataCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/seed'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Seed failed');
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Load sample data</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Financial services demo: Retail Banking, Investment Banking, Wealth Management; agents (KYC, Trade Desk, Portfolio Advisor, etc.); contexts with real-world AI agent content and version history for diff UI.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={handleSeed} disabled={loading} className="w-fit">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </>
          ) : (
            'Load sample data'
          )}
        </Button>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
