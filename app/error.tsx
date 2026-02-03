'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          {error.message || 'An error occurred loading this page.'}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
