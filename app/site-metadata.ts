import type { Metadata } from 'next';

import policy from '../edition-policy.json';

export const SITE_NAME = 'Naturalis Historia — The Living Codex';
export const SITE_ORIGIN = policy.origin;
export const RELEASE_ROBOTS: Metadata['robots'] = policy.publicIndexing
  ? { index: true, follow: true }
  : {
      index: false,
      follow: false,
      noarchive: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    };

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: RELEASE_ROBOTS,
    openGraph: {
      title: `${title} — Naturalis Historia`,
      description,
      type: 'website',
      url: path,
      siteName: SITE_NAME,
      locale: 'en_US',
      images: [{ url: '/og.jpg', width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Naturalis Historia`,
      description,
      images: ['/og.jpg'],
    },
  };
}
