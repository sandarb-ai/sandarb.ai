import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SignupForm } from './signup-form';
import { Button } from '@/components/ui/button';

const DEMO_COOKIE_NAME = 'sandarb_demo';

export const metadata = {
  title: 'Try Sandarb',
  description: 'Get started with Sandarb. Sign in to see governance for AI agents in action.',
};

export default async function SignupPage() {
  const cookieStore = cookies();
  if (cookieStore.get(DEMO_COOKIE_NAME)) {
    redirect('/dashboard');
  }
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-muted/20">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Image src="/logo.svg" alt="Sandarb" width={24} height={24} />
          </div>
          <span className="text-lg font-semibold text-foreground">Sandarb</span>
        </Link>

        <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground text-center">
            Try Sandarb
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
            Sign in to try the full app—organizations, agents, contexts, and lineage.
          </p>

          <SignupForm />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 max-w-[320px]">
          Demo only. No account is created; you’ll get access to the Sandarb UI and features.
        </p>

        <Link href="/" className="mt-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}
