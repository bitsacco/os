import type { Metadata } from 'next';
import { config } from '@/config';

export const metadata: Metadata = {
  title: `Members | Dashboard | ${config.site.name}`,
  description: 'Manage members in the Bitsacco platform',
};
