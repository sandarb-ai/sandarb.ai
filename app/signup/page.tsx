import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SignupCardOrTerminal } from './signup-card-or-terminal';
import { Button } from '@/components/ui/button';

const DEMO_COOKIE_NAME = 'sandarb_demo';

export const metadata = {
  title: 'Try Sandarb',
  description: 'Human verification to try the Sandarb demo. No account, no data stored.',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_COOKIE_NAME)) {
    redirect('/dashboard');
  }
  const { from } = await searchParams;
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-[420px] flex flex-col items-center">
        <Link
          href="/"
          className="flex items-center gap-2 mb-10 rounded-lg px-2 py-1.5 -m-2 hover:bg-muted/50 transition-colors"
          aria-label="Sandarb home"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Image src="/logo.svg" alt="" width={22} height={22} />
          </div>
          <span className="text-lg font-semibold text-foreground">Sandarb</span>
        </Link>

        <SignupCardOrTerminal from={from} />

        <Link href="/" className="mt-8">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            ← Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}
