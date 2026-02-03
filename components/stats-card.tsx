import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  href?: string;
  className?: string;
  variant?: 'default' | 'indigo' | 'sky' | 'orange' | 'teal' | 'violet' | 'rose' | 'slate';
}

const variantStyles = {
  default: {
    title: 'text-muted-foreground',
    value: '',
    description: 'text-muted-foreground',
    iconBg: 'bg-muted',
    icon: 'text-muted-foreground',
  },
  indigo: {
    title: 'text-indigo-700 dark:text-indigo-400',
    value: 'text-indigo-700 dark:text-indigo-400',
    description: 'text-indigo-600/70 dark:text-indigo-400/70',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  sky: {
    title: 'text-sky-600 dark:text-sky-400',
    value: 'text-sky-600 dark:text-sky-400',
    description: 'text-sky-600/70 dark:text-sky-400/70',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  orange: {
    title: 'text-orange-600 dark:text-orange-400',
    value: 'text-orange-600 dark:text-orange-400',
    description: 'text-orange-600/70 dark:text-orange-400/70',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  teal: {
    title: 'text-teal-600 dark:text-teal-400',
    value: 'text-teal-600 dark:text-teal-400',
    description: 'text-teal-600/70 dark:text-teal-400/70',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    icon: 'text-teal-600 dark:text-teal-400',
  },
  violet: {
    title: 'text-violet-600 dark:text-violet-400',
    value: 'text-violet-600 dark:text-violet-400',
    description: 'text-violet-600/70 dark:text-violet-400/70',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    icon: 'text-violet-600 dark:text-violet-400',
  },
  rose: {
    title: 'text-rose-600 dark:text-rose-400',
    value: 'text-rose-600 dark:text-rose-400',
    description: 'text-rose-600/70 dark:text-rose-400/70',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  slate: {
    title: 'text-slate-700 dark:text-slate-300',
    value: 'text-slate-700 dark:text-slate-300',
    description: 'text-slate-600/70 dark:text-slate-400/70',
    iconBg: 'bg-slate-200 dark:bg-slate-700/50',
    icon: 'text-slate-600 dark:text-slate-400',
  },
};

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  href,
  className,
  variant = 'default',
}: StatsCardProps) {
  const styles = variantStyles[variant];
  
  const content = (
    <Card className={cn(href ? 'transition-colors hover:bg-muted/50 cursor-pointer' : '', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className={cn('text-sm font-medium', styles.title)}>{title}</p>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-3xl font-bold', styles.value)}>{value}</span>
              {trend && (
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p className={cn('text-xs', styles.description)}>{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn('rounded-full p-3', styles.iconBg)}>
              <Icon className={cn('h-6 w-6', styles.icon)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
