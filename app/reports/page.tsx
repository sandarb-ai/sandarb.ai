'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  Scale,
  FileCheck,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';

const reportLinks = [
  {
    title: 'Risk & Controls',
    description: 'Registered vs un-registered agents, blocked injections, approved contexts & prompts, access trends.',
    href: '/reports/risk-controls',
    icon: ShieldCheck,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
  },
  {
    title: 'Un-Registered Agents',
    description: 'Agents discovered by the Sandarb AI Governance Agent at scan targets but not yet in the registry.',
    href: '/reports/unregistered',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    title: 'Regulatory',
    description: 'Context and prompt version status, data classification for compliance and audit.',
    href: '/reports/regulatory',
    icon: Scale,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-100 dark:bg-sky-900/30',
  },
  {
    title: 'Compliance',
    description: 'Access events, success vs denied injections, prompt usage and audit lineage.',
    href: '/reports/compliance',
    icon: FileCheck,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
  },
];

export default function ReportsIndexPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Reports"
        description="Reports and insights that demonstrate AI Governance for AI Agents: risk & controls, un-registered agents, regulatory, and compliance."
      />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground text-sm mb-6">
            Select a report to view stats, graphs, and detailed visualizations.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {reportLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Card className="border-border/80 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div className={`rounded-lg p-2.5 ${item.bg}`}>
                          <Icon className={`h-6 w-6 ${item.color}`} />
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                      <h3 className="font-semibold text-foreground mt-3">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 flex-1">{item.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <BarChart3 className="h-4 w-4" />
            <span>All data sourced from Sandarb AI Governance platform</span>
          </div>
        </div>
      </div>
    </div>
  );
}
