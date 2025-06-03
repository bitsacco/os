'use client';

import dynamic from 'next/dynamic';
import React, { memo } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

// Dynamically import the metrics dashboard with no SSR
const MetricsDashboardDynamic = dynamic(
  () =>
    import('./metrics-dashboard').then((mod) => ({
      default: mod.MetricsDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    ),
  },
);

// Memoize the dashboard to prevent unnecessary re-renders
const MemoizedDashboard = memo(function MemoizedDashboard() {
  return <MetricsDashboardDynamic />;
});

// Export memoized client
export function MetricsDashboardClient(): React.JSX.Element {
  return <MemoizedDashboard />;
}
