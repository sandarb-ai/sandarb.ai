'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Scale,
  FileCheck,
  FileJson,
  ArrowRight,
} from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { Header } from '@/components/header';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { DataPipelineDiagram } from '@/components/data-pipeline-diagram';
import { InfoBubble } from '@/components/info-bubble';

/** Derive a sensible Superset default from the current hostname. */
function defaultSupersetUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8088';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8088';
  // Cloud Run / sandarb.ai — superset lives on GKE; platform config should have the URL
  return '';
}

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
    title: 'Context Governance',
    description: 'Proof-of-delivery, coverage matrix, staleness, rendering analytics, approval velocity, and classification access.',
    href: '/reports/context',
    icon: FileJson,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
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

export default function ReportsPage() {
  const [supersetUrl, setSupersetUrl] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/platform-config/superset'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.url?.value && !d.data.url.value.startsWith('****')) {
          setSupersetUrl(d.data.url.value);
        } else {
          setSupersetUrl(defaultSupersetUrl());
        }
      })
      .catch(() => {
        setSupersetUrl(defaultSupersetUrl());
      });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="AI Governance Reports"
        description="Sandarb Data Platform — event pipeline and analytics."
        breadcrumb={<Breadcrumb items={[{ label: 'Reports' }]} className="mb-2" />}
      />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              AGP<InfoBubble term="AGP" /> Pipeline — Sandarb Data Platform
            </h2>
            <p className="text-sm text-muted-foreground">
              AI Governance Proof (AGP)<InfoBubble term="AGP" /> events flow from AI Agents through Sandarb to Kafka, consumed by SKCC<InfoBubble term="SKCC" /> into ClickHouse, and visualized in Superset.
            </p>
          </div>

          {/* Animated pipeline diagram */}
          <div className="mb-10">
            <DataPipelineDiagram />
          </div>

          {/* Superset link card */}
          <div className="flex justify-center mb-12">
            {supersetUrl ? (
              <a
                href={supersetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="border-border/80 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-lg transition-all w-[400px] cursor-pointer">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/30 p-3 shrink-0">
                      <Image
                        src="/icons/superset.svg"
                        alt=""
                        width={36}
                        height={36}
                        aria-hidden
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          Open Superset
                        </span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Interactive dashboards and SQL Lab
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </a>
            ) : (
              <Card className="border-border/80 opacity-60 w-[400px]">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/30 p-3 shrink-0">
                    <Image
                      src="/icons/superset.svg"
                      alt=""
                      width={36}
                      height={36}
                      aria-hidden
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">
                      Superset
                    </span>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Configure Superset URL in Settings &rarr; Data Platform
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Governance report cards */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Governance Reports
            </h3>
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
          </div>
        </div>
      </div>
    </div>
  );
}
