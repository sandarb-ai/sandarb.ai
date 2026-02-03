import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Sandarb - AI Governance for AI Agents',
  description:
    'Manage and govern your AI Agents prompts and context in a protocol first approach workflows (think A2A, API and Git). Every request logged; lineage and audit built in.',
};

/** Default landing page for demo is Dashboard. */
export default function RootPage() {
  redirect('/dashboard');
}
