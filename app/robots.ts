import type { MetadataRoute } from 'next';

import policy from '../edition-policy.json';

export default function robots(): MetadataRoute.Robots {
  if (!policy.publicIndexing) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${policy.origin}/sitemap.xml`,
  };
}
