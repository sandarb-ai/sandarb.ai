import { redirect } from 'next/navigation';

/**
 * /why redirects to / (marketing/why content is the root page).
 */
export default function WhyPage() {
  redirect('/');
}
