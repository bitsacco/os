import { MetricsQueryParams, MetricsResponse } from '@/types/metrics';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

/**
 * Fetches metrics data from the API with optional filtering
 */
export async function fetchMetrics(
  params: MetricsQueryParams = {},
): Promise<MetricsResponse> {
  const queryParams = new URLSearchParams();

  if (params.startDate) {
    queryParams.append('startDate', params.startDate);
  }

  if (params.endDate) {
    queryParams.append('endDate', params.endDate);
  }

  if (params.timePreset) {
    queryParams.append('timePreset', params.timePreset);
  }

  if (params.services && params.services.length > 0) {
    params.services.forEach((service) => {
      queryParams.append('service', service);
    });
  }

  const url = `/api/metrics?${queryParams.toString()}`;

  try {
    const response = await fetchWithAuth(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching metrics:', error);
    throw error;
  }
}

/**
 * Fetches metrics for a specific service
 */
export async function fetchServiceMetrics(
  service: string,
  params: Omit<MetricsQueryParams, 'services'> = {},
): Promise<MetricsResponse> {
  return fetchMetrics({
    ...params,
    services: [service],
  });
}
