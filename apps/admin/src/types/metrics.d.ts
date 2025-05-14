export interface MetricDataPoint {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  data: MetricDataPoint[];
}

export interface KpiMetric {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'flat';
  target?: number;
}

export interface BusinessMetrics {
  userEngagement: {
    dailyActiveUsers: KpiMetric;
    monthlyActiveUsers: KpiMetric;
    newUserRegistrations: KpiMetric;
    dau_mau_ratio: KpiMetric;
    sessionCount: MetricSeries;
    retentionRates: {
      day1: number;
      day7: number;
      day30: number;
      day90: number;
    };
  };
  transactions: {
    total: KpiMetric;
    volume: {
      KES: KpiMetric;
      BTC: KpiMetric;
    };
    successRate: KpiMetric;
    averageDuration: KpiMetric;
    byType: Record<string, number>;
    timeline: MetricSeries;
  };
  features: {
    usage: Record<
      string,
      {
        count: KpiMetric;
        successRate: KpiMetric;
        averageDuration: KpiMetric;
      }
    >;
    timeline: MetricSeries;
  };
}

export interface OperationalMetrics {
  api: {
    requests: {
      total: KpiMetric;
      success: KpiMetric;
      failed: KpiMetric;
      byEndpoint: Record<string, number>;
      byMethod: Record<string, number>;
      timeline: MetricSeries;
    };
    latency: {
      p50: KpiMetric;
      p95: KpiMetric;
      p99: KpiMetric;
      timeline: MetricSeries;
    };
    errors: {
      count: KpiMetric;
      byType: Record<string, number>;
      byEndpoint: Record<string, number>;
      timeline: MetricSeries;
    };
  };
}

export interface ServiceMetrics {
  auth?: {
    loginAttempts: KpiMetric;
    successfulLogins: KpiMetric;
    failedLogins: KpiMetric;
    tokenOperations: KpiMetric;
    timeline: MetricSeries;
  };
  swap?: {
    volume: {
      onramp: KpiMetric;
      offramp: KpiMetric;
    };
    count: {
      onramp: KpiMetric;
      offramp: KpiMetric;
    };
    successRate: KpiMetric;
    timeline: MetricSeries;
  };
  shares?: {
    volume: KpiMetric;
    count: KpiMetric;
    successRate: KpiMetric;
    timeline: MetricSeries;
  };
}

export interface TimeRange {
  startDate: Date;
  endDate: Date;
  preset?: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
}

export interface MetricsResponse {
  business?: BusinessMetrics;
  operational?: OperationalMetrics;
  services?: ServiceMetrics;
  timeRange: TimeRange;
  lastUpdated: string;
}

export interface MetricsQueryParams {
  startDate?: string;
  endDate?: string;
  timePreset?: '1h' | '24h' | '7d' | '30d' | '90d';
  services?: string[];
}
