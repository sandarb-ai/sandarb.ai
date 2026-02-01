'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api';
import { Radio } from 'lucide-react';

export function AgentPulseScanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/governance/scan'), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={runScan}
      disabled={loading}
      className="gap-2"
    >
      <Radio className="h-4 w-4" />
      {loading ? 'Scanning…' : 'Run discovery scan'}
    </Button>
  );
}
