'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowDown, ArrowUp } from '@phosphor-icons/react/dist/ssr';

interface MetricSummaryProps {
  title: string;
  value: number;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
  suffix?: string;
  prefix?: string;
  format?: 'number' | 'currency' | 'percent';
}

/**
 * Format number based on format type
 */
const formatNumber = (
  value: number,
  format?: 'number' | 'currency' | 'percent',
  prefix?: string,
  suffix?: string,
): string => {
  let formattedValue = '';

  switch (format) {
    case 'currency':
      formattedValue = new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
      break;

    case 'percent':
      formattedValue = `${value.toFixed(1)}%`;
      break;

    default:
      // For large numbers, use compact notation
      if (value >= 1000) {
        formattedValue = new Intl.NumberFormat('en', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value);
      } else {
        formattedValue = value.toLocaleString();
      }
  }

  // Add prefix and suffix if provided
  if (prefix) {
    formattedValue = `${prefix}${formattedValue}`;
  }

  if (suffix && format !== 'currency') {
    formattedValue = `${formattedValue}${suffix}`;
  }

  return formattedValue;
};

/**
 * Metric summary card component for dashboard
 */
export function MetricSummary({
  title,
  value,
  change = 0,
  trend = 'flat',
  suffix,
  prefix,
  format = 'number',
}: MetricSummaryProps): React.JSX.Element {
  const formattedValue = formatNumber(value, format, prefix, suffix);
  const trendColor =
    trend === 'up'
      ? 'success.main'
      : trend === 'down'
        ? 'error.main'
        : 'text.secondary';

  // Format the change value with a + or - sign
  const formattedChange =
    change === 0 ? '0' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;

  return (
    <Card>
      <CardContent>
        <Stack
          alignItems="flex-start"
          direction="row"
          justifyContent="space-between"
          spacing={3}
        >
          <Stack spacing={1}>
            <Typography color="text.secondary" variant="overline">
              {title}
            </Typography>
            <Typography variant="h4">{formattedValue}</Typography>
          </Stack>
          <Box sx={{ alignSelf: 'center' }}>
            {trend === 'up' && (
              <ArrowUp size={24} color="var(--mui-palette-success-main)" />
            )}
            {trend === 'down' && (
              <ArrowDown size={24} color="var(--mui-palette-error-main)" />
            )}
          </Box>
        </Stack>
        {change !== 0 && (
          <Stack alignItems="center" direction="row" spacing={1} sx={{ mt: 2 }}>
            <Typography color={trendColor} variant="body2">
              {formattedChange}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              since last period
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
