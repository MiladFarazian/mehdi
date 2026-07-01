'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/merchants', label: 'Merchants' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/goals', label: 'Goals' },
  { href: '/insights', label: 'Insights' },
  { href: '/chat', label: 'Advisor' },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="top">
      <span className="brand">mehdi</span>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
      <Link href="/settings" className={path === '/settings' ? 'active' : ''} title="Settings" aria-label="Settings">⚙</Link>
      <ThemeToggle />
      <a onClick={signOut} style={{ cursor: 'pointer' }}>Sign out</a>
    </nav>
  );
}
