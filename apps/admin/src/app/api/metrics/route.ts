import { NextRequest, NextResponse } from 'next/server';

// Mock metrics data for demo - in production, this would fetch from services
const generateMockMetrics = (timeRange: { start: string; end: string }) => {
  // Generate timestamps for the time range
  const start = new Date(timeRange.start);
  const end = new Date(timeRange.end);
  const diff = end.getTime() - start.getTime();
  const hoursBetween = Math.floor(diff / (1000 * 60 * 60));

  // Generate time series data
  const generateTimeSeries = (
    name: string,
    baseValue: number,
    volatility: number,
  ) => {
    const data = [];
    let lastValue = baseValue;

    for (let i = 0; i <= hoursBetween; i++) {
      const timestamp = new Date(
        start.getTime() + i * 60 * 60 * 1000,
      ).toISOString();
      // Random walk with trend
      const change = (Math.random() - 0.5) * volatility * baseValue;
      lastValue = Math.max(0, lastValue + change);

      data.push({
        timestamp,
        value: Math.round(lastValue * 100) / 100,
      });
    }

    return {
      name,
      data,
    };
  };

  // Generate KPI metric
  const generateKpi = (
    baseValue: number,
    trend: 'up' | 'down' | 'flat' = 'up',
  ) => {
    const trendFactor = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
    const change =
      Math.round(baseValue * (0.05 + Math.random() * 0.1) * trendFactor * 100) /
      100;

    return {
      value: Math.round(baseValue * 100) / 100,
      change,
      trend,
      target: Math.round(baseValue * 1.2 * 100) / 100,
    };
  };

  // Business metrics
  const businessMetrics = {
    userEngagement: {
      dailyActiveUsers: generateKpi(1250, 'up'),
      monthlyActiveUsers: generateKpi(5800, 'up'),
      newUserRegistrations: generateKpi(87, 'up'),
      dau_mau_ratio: generateKpi(0.22, 'up'),
      sessionCount: generateTimeSeries('Sessions', 500, 0.2),
      retentionRates: {
        day1: 65,
        day7: 42,
        day30: 28,
        day90: 15,
      },
    },
    transactions: {
      total: generateKpi(4285, 'up'),
      volume: {
        KES: generateKpi(1250000, 'up'),
        BTC: generateKpi(0.78, 'up'),
      },
      successRate: generateKpi(97.5, 'up'),
      averageDuration: generateKpi(1.8, 'down'),
      byType: {
        deposit: 1285,
        withdrawal: 985,
        transfer: 1830,
        exchange: 185,
      },
      timeline: generateTimeSeries('Transactions', 180, 0.3),
    },
    features: {
      usage: {
        wallet: {
          count: generateKpi(3250, 'up'),
          successRate: generateKpi(99.1, 'up'),
          averageDuration: generateKpi(0.8, 'down'),
        },
        swap: {
          count: generateKpi(850, 'up'),
          successRate: generateKpi(97.3, 'up'),
          averageDuration: generateKpi(2.2, 'down'),
        },
        chama: {
          count: generateKpi(420, 'up'),
          successRate: generateKpi(98.5, 'up'),
          averageDuration: generateKpi(1.5, 'down'),
        },
      },
      timeline: generateTimeSeries('Feature Usage', 220, 0.25),
    },
  };

  // Operational metrics
  const operationalMetrics = {
    api: {
      requests: {
        total: generateKpi(28500, 'up'),
        success: generateKpi(27800, 'up'),
        failed: generateKpi(700, 'down'),
        byEndpoint: {
          '/api/auth': 4250,
          '/api/wallet': 7850,
          '/api/swap': 3200,
          '/api/user': 5800,
          '/api/chama': 2500,
          '/api/shares': 4900,
        },
        byMethod: {
          GET: 18500,
          POST: 6800,
          PUT: 2200,
          DELETE: 1000,
        },
        timeline: generateTimeSeries('API Requests', 1200, 0.3),
      },
      latency: {
        p50: generateKpi(85, 'down'),
        p95: generateKpi(235, 'down'),
        p99: generateKpi(450, 'down'),
        timeline: generateTimeSeries('API Latency', 100, 0.15),
      },
      errors: {
        count: generateKpi(700, 'down'),
        byType: {
          auth: 180,
          validation: 245,
          timeout: 125,
          server: 150,
        },
        byEndpoint: {
          '/api/auth': 150,
          '/api/wallet': 220,
          '/api/swap': 180,
          '/api/user': 85,
          '/api/chama': 65,
        },
        timeline: generateTimeSeries('API Errors', 35, 0.4),
      },
    },
  };

  // Service-specific metrics
  const serviceMetrics = {
    auth: {
      loginAttempts: generateKpi(2850, 'up'),
      successfulLogins: generateKpi(2760, 'up'),
      failedLogins: generateKpi(90, 'down'),
      tokenOperations: generateKpi(3500, 'up'),
      timeline: generateTimeSeries('Auth Operations', 120, 0.25),
    },
    swap: {
      volume: {
        onramp: generateKpi(850000, 'up'),
        offramp: generateKpi(720000, 'up'),
      },
      count: {
        onramp: generateKpi(560, 'up'),
        offramp: generateKpi(480, 'up'),
      },
      successRate: generateKpi(96.5, 'up'),
      timeline: generateTimeSeries('Swap Operations', 45, 0.3),
    },
    shares: {
      volume: generateKpi(2500000, 'up'),
      count: generateKpi(1850, 'up'),
      successRate: generateKpi(98.2, 'up'),
      timeline: generateTimeSeries('Shares Operations', 80, 0.2),
    },
  };

  return {
    business: businessMetrics,
    operational: operationalMetrics,
    services: serviceMetrics,
    timeRange: {
      startDate: start,
      endDate: end,
    },
    lastUpdated: new Date().toISOString(),
  };
};

// Simple in-memory cache with expiration
const metricsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

// Indicate that this route should be dynamically rendered
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // In a production app, we'd check authentication here
    // For now, we'll skip authentication checks for the demo
    // Instead of using headers(), get the authorization directly from request
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.split(' ')[1];

    // Simplified auth check for demo
    // If needed, add proper auth checks here

    // Create a cache key based on query parameters
    const url = request.nextUrl.toString();
    const cacheKey = url.split('?')[1] || 'default';

    // Check if we have a valid cache entry
    const cacheEntry = metricsCache.get(cacheKey);
    const now = Date.now();

    if (cacheEntry && now - cacheEntry.timestamp < CACHE_TTL) {
      // Return cached data if it's still fresh
      return NextResponse.json(cacheEntry.data);
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const timePreset = searchParams.get('timePreset') || '24h';
    const services = searchParams.getAll('service');

    // Parse custom date range if provided
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    // Default time ranges based on preset
    if (!startDate || !endDate) {
      const end = new Date();
      let start: Date;

      switch (timePreset) {
        case '1h':
          start = new Date(end.getTime() - 60 * 60 * 1000);
          break;
        case '7d':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default: // 24h
          start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      }

      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    // Generate mock metrics
    // In production, this would fetch from actual services
    const metrics = generateMockMetrics({
      start: startDate,
      end: endDate,
    });

    // Filter by service if specified
    if (services.length > 0 && services[0] !== 'all') {
      const filteredServices = {} as any;
      services.forEach((service) => {
        if (metrics.services[service]) {
          filteredServices[service] = metrics.services[service];
        }
      });
      metrics.services = filteredServices;
    }

    // Store the result in cache
    metricsCache.set(cacheKey, {
      data: metrics,
      timestamp: Date.now(),
    });

    // Create a response with the metrics
    const response = NextResponse.json(metrics);

    // Add cache header to response
    response.headers.set('Cache-Control', 'max-age=300'); // 5 minutes browser cache

    return response;
  } catch (error) {
    console.error('Error handling metrics request:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
