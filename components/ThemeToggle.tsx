'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('mehdi-theme')) as
      | 'dark'
      | 'light'
      | null;
    if (saved) setTheme(saved);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('mehdi-theme', next);
    } catch {}
  };

  return (
    <a onClick={toggle} style={{ cursor: 'pointer' }} title="Toggle light / dark" aria-label="Toggle theme">
      {theme === 'dark' ? '☀' : '☾'}
    </a>
  );
}
