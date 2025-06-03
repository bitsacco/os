'use client';

import * as React from 'react';
import { useTheme, ThemeProvider, createTheme } from '@mui/material/styles';

// Create a fallback theme to use if context is not available
const fallbackTheme = createTheme();
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { MetricSeries } from '@/types/metrics';
import dynamic from 'next/dynamic';

// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

interface MetricChartProps {
  title?: string;
  data: MetricSeries | MetricSeries[];
  type: 'line' | 'area' | 'bar' | 'pie' | 'donut';
  height?: number;
  stacked?: boolean;
}

/**
 * Chart component for visualization of metrics data
 */
export function MetricChart({
  title,
  data,
  type,
  height = 300,
  stacked = false,
}: MetricChartProps): React.JSX.Element {
  // Try to use theme from context, fall back to default if not available
  let theme;
  try {
    theme = useTheme();
  } catch (error) {
    console.warn('Theme context not available, using fallback theme');
    theme = fallbackTheme;
  }

  // Convert data to the format expected by ApexCharts
  const chartSeries = React.useMemo(() => {
    // Ensure data exists
    if (!data) {
      return [];
    }

    const dataArray = Array.isArray(data) ? data : [data];

    if (type === 'pie' || type === 'donut') {
      // For pie charts, extract the values directly
      if (
        dataArray[0]?.data &&
        dataArray[0].data.length > 0 &&
        'x' in dataArray[0].data[0]
      ) {
        // Data is already in x,y format suitable for pie charts
        return dataArray[0].data.map((point: any) => point.y);
      } else {
        // For pie/donut charts, we need to extract the latest value from each series
        return dataArray.map((series) =>
          series.data && series.data.length > 0
            ? series.data[series.data.length - 1].value || 0
            : 0,
        );
      }
    }

    // For other chart types, we need to format the time series data
    return dataArray.map((series) => ({
      name: series.name,
      data: Array.isArray(series.data)
        ? series.data.map((point) => {
            if (point.timestamp) {
              return {
                x: new Date(point.timestamp).getTime(),
                y: point.value,
              };
            } else {
              return point; // Already formatted
            }
          })
        : [],
    }));
  }, [data, type]);

  // Extract labels for pie/donut charts
  const chartLabels = React.useMemo(() => {
    if (!data) {
      return [];
    }

    if (type === 'pie' || type === 'donut') {
      const dataArray = Array.isArray(data) ? data : [data];

      // Check if data is in the x,y format
      if (
        dataArray[0]?.data &&
        dataArray[0].data.length > 0 &&
        'x' in dataArray[0].data[0]
      ) {
        // Extract x values as labels
        return dataArray[0].data.map((point: any) => point.x);
      }

      // Otherwise use series names
      return dataArray.map((series) => series.name);
    }
    return undefined;
  }, [data, type]);

  // Configure chart options based on type and theme
  const chartOptions = React.useMemo(() => {
    const baseOptions: any = {
      chart: {
        background: 'transparent',
        toolbar: {
          show: false,
        },
        stacked: stacked,
      },
      colors: [
        theme.palette.primary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
        theme.palette.info.main,
      ],
      dataLabels: {
        enabled: false,
      },
      theme: {
        mode: theme.palette.mode,
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: theme.palette.text.secondary,
          },
        },
      },
      yaxis: {
        labels: {
          formatter: (value: number) => {
            // Format large numbers
            if (value >= 1000000) {
              return `${(value / 1000000).toFixed(1)}M`;
            }
            if (value >= 1000) {
              return `${(value / 1000).toFixed(1)}K`;
            }
            return value.toFixed(0);
          },
          style: {
            colors: theme.palette.text.secondary,
          },
        },
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: {
          colors: theme.palette.text.primary,
        },
      },
      stroke: {
        curve: 'smooth',
        width: 2,
      },
      tooltip: {
        theme: theme.palette.mode,
        x: {
          format: 'dd MMM yyyy HH:mm',
        },
      },
      grid: {
        borderColor: theme.palette.divider,
        xaxis: {
          lines: {
            show: true,
          },
        },
        yaxis: {
          lines: {
            show: true,
          },
        },
      },
    };

    // Adjust options for different chart types
    if (type === 'pie' || type === 'donut') {
      return {
        ...baseOptions,
        labels: chartLabels,
        xaxis: {
          type: 'category',
        },
        yaxis: {
          show: false,
        },
        stroke: {
          width: 0,
        },
        plotOptions: {
          pie: {
            donut: {
              labels: {
                show: true,
                name: {
                  show: true,
                },
                value: {
                  show: true,
                  formatter: (val: number) => val.toLocaleString(),
                },
                total: {
                  show: true,
                  formatter: (w: any) => {
                    const total = w.globals.seriesTotals.reduce(
                      (a: number, b: number) => a + b,
                      0,
                    );
                    return total.toLocaleString();
                  },
                },
              },
            },
          },
        },
      };
    }

    return baseOptions;
  }, [theme, type, stacked, chartLabels]);

  // Wrap in ThemeProvider to ensure context is available
  return (
    <ThemeProvider theme={theme}>
      <Card>
        {title && <CardHeader title={title} />}
        <CardContent>
          <Box sx={{ height, position: 'relative' }}>
            {typeof window !== 'undefined' && (
              <ReactApexChart
                options={chartOptions}
                series={chartSeries as any}
                type={type}
                height={height}
                width="100%"
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </ThemeProvider>
  );
}
