'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/subscriptions', label: 'Subscriptions' },
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
      <a onClick={signOut} style={{ cursor: 'pointer' }}>Sign out</a>
    </nav>
  );
}
