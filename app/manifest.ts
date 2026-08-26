import type { MetadataRoute } from 'next';

import { SITE_DESCRIPTION, SITE_NAME } from './site-metadata';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Naturalis Historia',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#17110c',
    theme_color: '#7a4d2d',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
