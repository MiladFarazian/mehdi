'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/insights', label: 'Insights' },
  { href: '/chat', label: 'Advisor' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="top">
      <span className="brand">mehdi</span>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
    </nav>
  );
}
