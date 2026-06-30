import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'mehdi',
  description: 'Personal financial intelligence',
};

// Set the theme before first paint to avoid a flash of the wrong palette.
const themeInit = `(function(){try{var t=localStorage.getItem('mehdi-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
