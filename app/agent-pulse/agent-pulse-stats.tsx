'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, Bot, Radio, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Animates from prev to target value over a short duration. */
function useAnimatedValue(target: number, durationMs = 400) {
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef({ value: target, time: 0 });

  useEffect(() => {
    if (target === prevTarget.current) return;
    const startValue = display;
    prevTarget.current = target;
    const startTime = performance.now();
    startRef.current = { value: startValue, time: startTime };

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.round(startValue + (target - startValue) * eased);
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}

interface AnimatedStatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 'blocked' = red pulse on increment; 'shadow' = subtle glow; default = no extra animation */
  variant?: 'default' | 'blocked' | 'shadow';
  className?: string;
}

function AnimatedStatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  className,
}: AnimatedStatCardProps) {
  const displayValue = useAnimatedValue(value);
  const prevValue = useRef(value);
  const [justIncremented, setJustIncremented] = useState(false);

  useEffect(() => {
    if (variant === 'blocked' && value > prevValue.current) {
      setJustIncremented(true);
      const t = setTimeout(() => setJustIncremented(false), 600);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
    prevValue.current = value;
  }, [value, variant]);

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300',
        variant === 'blocked' && justIncremented && 'agent-pulse-blocked-flash',
        variant === 'shadow' && 'agent-pulse-shadow-glow',
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  variant === 'blocked' && 'text-red-600 dark:text-red-400',
                  variant === 'shadow' && 'text-violet-600 dark:text-violet-400',
                  variant === 'default' && 'text-foreground'
                )}
              >
                {displayValue}
              </span>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={cn(
              'rounded-full p-3',
              variant === 'blocked' && 'bg-red-100 dark:bg-red-900/30',
              variant === 'shadow' && 'bg-violet-100 dark:bg-violet-900/30',
              variant === 'default' && 'bg-muted'
            )}
          >
            <Icon
              className={cn(
                'h-6 w-6',
                variant === 'blocked' && 'text-red-600 dark:text-red-400',
                variant === 'shadow' && 'text-violet-600 dark:text-violet-400',
                variant === 'default' && 'text-muted-foreground'
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface AgentPulseStatsCardsProps {
  agentsCount: number;
  blockedCount: number;
  shadowAICount: number;
  a2aCount: number;
}

export function AgentPulseStatsCards({
  agentsCount,
  blockedCount,
  shadowAICount,
  a2aCount,
}: AgentPulseStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <AnimatedStatCard
        title="Registered Agents"
        value={agentsCount}
        description="Active in Sandarb"
        icon={Users}
        variant="default"
      />
      <AnimatedStatCard
        title="Blocked Injections"
        value={blockedCount}
        description="Policy violations"
        icon={ShieldAlert}
        variant="blocked"
      />
      <AnimatedStatCard
        title="Shadow AI Detected"
        value={shadowAICount}
        description="Unauthenticated agents"
        icon={Bot}
        variant="shadow"
      />
      <AnimatedStatCard
        title="A2A Messages"
        value={a2aCount}
        description="Recent communications"
        icon={Radio}
        variant="default"
      />
    </div>
  );
}
