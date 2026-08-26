import type { Metadata } from 'next';
import './globals.css';

import { RELEASE_ROBOTS, SITE_NAME, SITE_ORIGIN } from './site-metadata';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: 'Naturalis Historia — The Living Codex',
    template: '%s — Naturalis Historia',
  },
  description:
    'The complete thirty-seven books of Pliny the Elder’s Natural History in Latin and English, reimagined as an illustrated living codex.',
  alternates: { canonical: '/' },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: ['/favicon.svg'],
  },
  robots: RELEASE_ROBOTS,
  openGraph: {
    title: 'Naturalis Historia — The Living Codex',
    description:
      'All thirty-seven books in an ancient illustrated codex whose Latin diffuses and reforms as English.',
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Naturalis Historia — The Living Codex',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Naturalis Historia — The Living Codex',
    description:
      'All thirty-seven books in an ancient illustrated codex whose Latin diffuses and reforms as English.',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
