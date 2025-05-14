import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMetrics, fetchServiceMetrics } from '@/lib/metrics/client';
import {
  MetricsQueryParams,
  MetricsResponse,
  TimeRange,
} from '@/types/metrics';

interface UseMetricsOptions extends MetricsQueryParams {
  refreshInterval?: number;
  service?: string;
}

interface UseMetricsResult {
  data: MetricsResponse | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage metrics data
 */
export function useMetrics(options: UseMetricsOptions = {}): UseMetricsResult {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const { service, refreshInterval = 60000, ...queryParams } = options;

  // Function to fetch data
  // Use refs to store current values for use in the memoized callback
  const serviceRef = useRef(service);
  const queryParamsRef = useRef(queryParams);

  // Update refs when props change without triggering callback recreation
  useEffect(() => {
    serviceRef.current = service;
    queryParamsRef.current = queryParams;
  }, [service, queryParams]);

  // Stable callback that doesn't change on every render
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let response: MetricsResponse;

      if (serviceRef.current) {
        // Fetch metrics for a specific service
        response = await fetchServiceMetrics(
          serviceRef.current,
          queryParamsRef.current,
        );
      } else {
        // Fetch all metrics
        response = await fetchMetrics(queryParamsRef.current);
      }

      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch with proper dependency tracking
  // Using a ref to prevent the effect from running on every render
  const initialFetchRef = useRef(false);

  useEffect(() => {
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      fetchData();
    }
  }, [fetchData]);

  // Set up auto-refresh with rate limiting
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(fetchData, refreshInterval);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [fetchData, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
}

/**
 * Helper hook to manage time range selection
 */
export function useTimeRange(initialPreset: '24h' = '24h') {
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    endDate: new Date(),
    preset: initialPreset,
  });

  const setTimePreset = useCallback(
    (preset: '1h' | '24h' | '7d' | '30d' | '90d') => {
      let startDate: Date;
      const endDate = new Date();

      switch (preset) {
        case '1h':
          startDate = new Date(endDate.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      }

      setTimeRange({
        startDate,
        endDate,
        preset,
      });
    },
    [],
  );

  const setCustomTimeRange = useCallback((startDate: Date, endDate: Date) => {
    setTimeRange({
      startDate,
      endDate,
      preset: 'custom',
    });
  }, []);

  return {
    timeRange,
    setTimePreset,
    setCustomTimeRange,
  };
}
