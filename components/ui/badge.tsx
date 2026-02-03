import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-rose-500 text-white shadow hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700',
        outline: 'text-foreground',
        success:
          'border-transparent bg-emerald-500 text-white shadow hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700',
        draft: 'border-transparent bg-gray-600 text-gray-100 shadow hover:bg-gray-700',
        pending_review: 'border-transparent bg-amber-400 text-amber-950 shadow hover:bg-amber-500 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-600',
        warning: 'border-transparent bg-amber-400 text-amber-950 shadow hover:bg-amber-500 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-600',
        approved: 'border-transparent bg-emerald-500 text-white shadow hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700',
        rejected: 'border-transparent bg-rose-500 text-white shadow hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };