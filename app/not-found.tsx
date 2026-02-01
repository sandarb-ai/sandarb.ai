import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link href="/">
          <Button>Go to home</Button>
        </Link>
      </div>
    </div>
  );
}
