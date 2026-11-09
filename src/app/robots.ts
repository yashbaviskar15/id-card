import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

/** Social preview bots must be able to fetch the public share and profile shells. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    host: siteUrl,
  };
}
