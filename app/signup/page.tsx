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
      <div className="w-full max-w-[400px] flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Image src="/logo.svg" alt="Sandarb" width={24} height={24} />
          </div>
          <span className="text-lg font-semibold text-foreground">Sandarb</span>
        </Link>

        {/* Prominent demo notice */}
        <div
          className="w-full rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 p-4 mb-6"
          role="alert"
          aria-label="Demo information"
        >
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100 text-center mb-2">
            Demo only — no account is created
          </p>
          <p className="text-xs text-violet-800 dark:text-violet-200 text-center leading-relaxed mb-3">
            You’ll get full access to the Sandarb UI and features for evaluation. No signup, no password, no email stored.
          </p>
          <ul className="text-xs text-violet-700 dark:text-violet-300 space-y-1 list-disc list-inside">
            <li>Dashboard, Agent Registry, Organizations</li>
            <li>Contexts & Prompts (versioning, approve/reject)</li>
            <li>Lineage, blocked injections, Agent Pulse</li>
            <li>Docs, Inject API, Try API</li>
          </ul>
        </div>

        <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground text-center">
            Try Sandarb
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
            Sign in to try the full app—organizations, agents, contexts, and lineage.
          </p>

          <SignupForm />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 max-w-[360px]">
          By continuing, you get instant access to the demo. No account is created; data is for evaluation only.
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
