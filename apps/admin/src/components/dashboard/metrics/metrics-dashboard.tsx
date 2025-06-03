'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import dynamic from 'next/dynamic';

// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Unstable_Grid2';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { ArrowClockwise as ArrowClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowClockwise';

import { useMetrics, useTimeRange } from '@/hooks/use-metrics';
import { TimeRangeSelector } from '@/components/dashboard/metrics/time-range-selector';
import { MetricSummary } from '@/components/dashboard/metrics/metric-summary';
import { MetricChart } from '@/components/dashboard/metrics/metric-chart';

// Service tabs for filtering
const SERVICES = [
  { id: 'all', label: 'All Services' },
  { id: 'auth', label: 'Authentication' },
  { id: 'swap', label: 'Swap' },
  { id: 'shares', label: 'Shares' },
];

export function MetricsDashboard(): React.JSX.Element {
  // State for service tabs
  const [activeService, setActiveService] = useState<string>('all');

  // Time range handling
  const { timeRange, setTimePreset } = useTimeRange('24h');

  // Fetch metrics data with no auto-refresh to prevent jitter
  // Manual refresh only
  const { data, isLoading, error, refresh } = useMetrics({
    timePreset: timeRange.preset,
    startDate: timeRange.startDate.toISOString(),
    endDate: timeRange.endDate.toISOString(),
    service: activeService === 'all' ? undefined : activeService,
    refreshInterval: 0, // Disable auto-refresh to prevent jitter
  });

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle service tab change with debounce
  const handleServiceChange = (
    event: React.SyntheticEvent,
    newValue: string,
  ) => {
    setActiveService(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for refresh
    debounceTimerRef.current = setTimeout(() => {
      refresh();
    }, 500); // 500ms debounce
  };

  // Handle time range change with debounce
  const handleTimeRangeChange = (
    preset: '1h' | '24h' | '7d' | '30d' | '90d',
  ) => {
    setTimePreset(preset);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for refresh
    debounceTimerRef.current = setTimeout(() => {
      refresh();
    }, 500); // 500ms debounce
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <Box component="main" sx={{ flexGrow: 1, py: 8 }}>
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" spacing={4}>
            <Stack spacing={1}>
              <Typography variant="h4">Dashboard Overview</Typography>
              <Stack alignItems="center" direction="row" spacing={1}>
                <Typography color="text.secondary" variant="body2">
                  Last updated:{' '}
                  {data?.lastUpdated
                    ? new Date(data.lastUpdated).toLocaleString()
                    : 'Never'}
                </Typography>
              </Stack>
            </Stack>
            <Button
              startIcon={
                <ArrowClockwiseIcon fontSize="var(--icon-fontSize-md)" />
              }
              variant="contained"
              onClick={refresh}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </Stack>

          {/* Filters */}
          <Card>
            <CardContent>
              <Box
                sx={{
                  alignItems: 'center',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <TimeRangeSelector
                  value={timeRange.preset}
                  onChange={handleTimeRangeChange}
                />

                <Tabs value={activeService} onChange={handleServiceChange}>
                  {SERVICES.map((service) => (
                    <Tab
                      key={service.id}
                      value={service.id}
                      label={service.label}
                    />
                  ))}
                </Tabs>
              </Box>
            </CardContent>
          </Card>

          {/* Loading state */}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error state */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Error loading metrics: {error.message}
            </Alert>
          )}

          {/* Dashboard content */}
          {data && !isLoading && (
            <React.Fragment>
              {/* KPI Summary Cards */}
              <Grid container spacing={3}>
                {/* User engagement KPIs */}
                <Grid xs={12} md={6} lg={3}>
                  <MetricSummary
                    title="Daily Active Users"
                    value={
                      data.business?.userEngagement.dailyActiveUsers.value || 0
                    }
                    change={
                      data.business?.userEngagement.dailyActiveUsers.change || 0
                    }
                    trend={
                      data.business?.userEngagement.dailyActiveUsers.trend ||
                      'flat'
                    }
                  />
                </Grid>
                <Grid xs={12} md={6} lg={3}>
                  <MetricSummary
                    title="Success Rate"
                    value={data.business?.transactions.successRate.value || 0}
                    change={data.business?.transactions.successRate.change || 0}
                    trend={
                      data.business?.transactions.successRate.trend || 'flat'
                    }
                    suffix="%"
                  />
                </Grid>
                <Grid xs={12} md={6} lg={3}>
                  <MetricSummary
                    title="Transaction Volume (KES)"
                    value={data.business?.transactions.volume.KES.value || 0}
                    change={data.business?.transactions.volume.KES.change || 0}
                    trend={
                      data.business?.transactions.volume.KES.trend || 'flat'
                    }
                    format="currency"
                  />
                </Grid>
                <Grid xs={12} md={6} lg={3}>
                  <MetricSummary
                    title="Transaction Count"
                    value={data.business?.transactions.total.value || 0}
                    change={data.business?.transactions.total.change || 0}
                    trend={data.business?.transactions.total.trend || 'flat'}
                  />
                </Grid>
              </Grid>

              {/* Charts */}
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {/* Transaction timeline */}
                <Grid xs={12} lg={8}>
                  <MetricChart
                    title="Transaction Volume Over Time"
                    data={
                      data?.business?.transactions?.timeline || {
                        name: 'Transactions',
                        data: [],
                      }
                    }
                    type="line"
                    height={360}
                  />
                </Grid>

                {/* Transaction by type */}
                <Grid xs={12} lg={4}>
                  <Card sx={{ height: '100%' }}>
                    <CardHeader title="Transactions by Type" />
                    <CardContent>
                      {/* Direct format for pie charts */}
                      {data?.business?.transactions?.byType && (
                        <Box sx={{ height: 300, position: 'relative' }}>
                          {typeof window !== 'undefined' && (
                            <ReactApexChart
                              options={{
                                chart: {
                                  background: 'transparent',
                                  type: 'pie',
                                },
                                labels: Object.keys(
                                  data.business.transactions.byType,
                                ),
                                legend: {
                                  position: 'bottom',
                                },
                                responsive: [
                                  {
                                    breakpoint: 480,
                                    options: {
                                      chart: {
                                        width: 200,
                                      },
                                      legend: {
                                        position: 'bottom',
                                      },
                                    },
                                  },
                                ],
                              }}
                              series={Object.values(
                                data.business.transactions.byType,
                              )}
                              type="pie"
                              width="100%"
                              height={300}
                            />
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Service-specific metrics */}
              {(activeService === 'auth' || activeService === 'all') &&
                data?.services?.auth && (
                  <Card sx={{ mt: 3 }}>
                    <CardHeader title="Authentication Metrics" />
                    <Divider />
                    <CardContent>
                      <Grid container spacing={3}>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Login Attempts"
                            value={data.services.auth.loginAttempts.value}
                            change={data.services.auth.loginAttempts.change}
                            trend={data.services.auth.loginAttempts.trend}
                          />
                        </Grid>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Successful Logins"
                            value={data.services.auth.successfulLogins.value}
                            change={data.services.auth.successfulLogins.change}
                            trend={data.services.auth.successfulLogins.trend}
                          />
                        </Grid>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Failed Logins"
                            value={data.services.auth.failedLogins.value}
                            change={data.services.auth.failedLogins.change}
                            trend={data.services.auth.failedLogins.trend}
                          />
                        </Grid>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Token Operations"
                            value={data.services.auth.tokenOperations.value}
                            change={data.services.auth.tokenOperations.change}
                            trend={data.services.auth.tokenOperations.trend}
                          />
                        </Grid>
                        <Grid xs={12}>
                          <MetricChart
                            title="Authentication Operations"
                            data={data.services.auth.timeline}
                            type="line"
                            height={300}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

              {/* Swap metrics */}
              {(activeService === 'swap' || activeService === 'all') &&
                data?.services?.swap && (
                  <Card sx={{ mt: 3 }}>
                    <CardHeader title="Swap Metrics" />
                    <Divider />
                    <CardContent>
                      <Grid container spacing={3}>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Onramp Volume (KES)"
                            value={data.services.swap.volume.onramp.value}
                            change={data.services.swap.volume.onramp.change}
                            trend={data.services.swap.volume.onramp.trend}
                            format="currency"
                          />
                        </Grid>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Offramp Volume (KES)"
                            value={data.services.swap.volume.offramp.value}
                            change={data.services.swap.volume.offramp.change}
                            trend={data.services.swap.volume.offramp.trend}
                            format="currency"
                          />
                        </Grid>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Onramp Count"
                            value={data.services.swap.count.onramp.value}
                            change={data.services.swap.count.onramp.change}
                            trend={data.services.swap.count.onramp.trend}
                          />
                        </Grid>
                        <Grid xs={12} md={6} lg={3}>
                          <MetricSummary
                            title="Offramp Count"
                            value={data.services.swap.count.offramp.value}
                            change={data.services.swap.count.offramp.change}
                            trend={data.services.swap.count.offramp.trend}
                          />
                        </Grid>
                        <Grid xs={12}>
                          <MetricChart
                            title="Swap Operations"
                            data={data.services.swap.timeline}
                            type="line"
                            height={300}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

              {/* Shares metrics */}
              {(activeService === 'shares' || activeService === 'all') &&
                data?.services?.shares && (
                  <Card sx={{ mt: 3 }}>
                    <CardHeader title="Shares Metrics" />
                    <Divider />
                    <CardContent>
                      <Grid container spacing={3}>
                        <Grid xs={12} md={4}>
                          <MetricSummary
                            title="Share Volume (KES)"
                            value={data.services.shares.volume.value}
                            change={data.services.shares.volume.change}
                            trend={data.services.shares.volume.trend}
                            format="currency"
                          />
                        </Grid>
                        <Grid xs={12} md={4}>
                          <MetricSummary
                            title="Share Operations"
                            value={data.services.shares.count.value}
                            change={data.services.shares.count.change}
                            trend={data.services.shares.count.trend}
                          />
                        </Grid>
                        <Grid xs={12} md={4}>
                          <MetricSummary
                            title="Success Rate"
                            value={data.services.shares.successRate.value}
                            change={data.services.shares.successRate.change}
                            trend={data.services.shares.successRate.trend}
                            suffix="%"
                          />
                        </Grid>
                        <Grid xs={12}>
                          <MetricChart
                            title="Share Operations"
                            data={data.services.shares.timeline}
                            type="line"
                            height={300}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}
            </React.Fragment>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
