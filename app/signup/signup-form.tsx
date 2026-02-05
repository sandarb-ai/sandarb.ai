'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { ShieldCheck } from 'lucide-react';
import { startDemo } from './actions';
import { Button } from '@/components/ui/button';

const SESSION_KEY = 'sandarb_human_verified';
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full h-12 justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg text-[15px]"
      disabled={disabled || pending}
    >
      {pending ? 'Taking you to the demo…' : 'Continue to demo'}
    </Button>
  );
}

export function SignupForm({ from, onContinueClick }: { from?: string; onContinueClick?: () => void } = {}) {
  const [verified, setVerified] = useState(false);

  const handleSuccess = () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, '1');
      }
    } catch {
      // ignore
    }
    setVerified(true);
  };

  const canContinue = verified || !SITE_KEY;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (onContinueClick && canContinue) {
      e.preventDefault();
      onContinueClick();
      return;
    }
  };

  return (
    <form action={startDemo} onSubmit={handleSubmit} className="space-y-6">
      {from && <input type="hidden" name="from" value={from} />}
      {SITE_KEY ? (
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-violet-500 dark:text-violet-400 shrink-0" aria-hidden />
            <span>Complete the check below to continue</span>
          </div>
          <div className="flex justify-center w-full min-h-[65px]">
            <Turnstile
              siteKey={SITE_KEY}
              onSuccess={handleSuccess}
              options={{
                theme: 'auto',
                size: 'normal',
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Turnstile not configured — you can continue to the demo.
        </p>
      )}
      <SubmitButton disabled={!canContinue} />
    </form>
  );
}
