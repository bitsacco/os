import { Injectable, Logger } from '@nestjs/common';
import { BusinessMetricsService } from '../common/monitoring/business.metrics';
import { SharesMetricsService } from '../shares/shares.metrics';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { TransactionMetricsService } from '../common/monitoring/transaction.metrics';
import { SwapMetricsService } from '../swap/metrics/swap.metrics';
import { PersonalMetricsService } from '../personal/services/personal.metrics';
import { NotificationMetrics } from '../notifications/notification.metrics';
import { NostrMetricsService } from '../nostr/nostr.metrics';
import { LnurlMetricsService } from '../lnurl/lnurl.metrics';
import { AuthMetricsService } from '../auth/metrics/auth.metrics';

/**
 * Dashboard Overview Response Interface
 */
export interface DashboardOverviewResponse {
  summary: {
    totalMembers: number;
    activeMembersToday: number;
    activeChamas: number;
    totalChamas: number;
    totalVolume: {
      amount: number;
      currency: 'KES';
      period: 'all-time' | '30d' | '7d';
    };
    transactionCount: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
    };
  };
  trends: {
    memberGrowth: TrendDataPoint[];
    volumeTrend: TrendDataPoint[];
    transactionTrend: TrendDataPoint[];
    chamaGrowth: TrendDataPoint[];
  };
  alerts: {
    systemHealth: 'healthy' | 'warning' | 'critical';
    errorRate: number;
    avgResponseTime: number;
    criticalAlerts: AlertItem[];
  };
  quickStats: {
    todayTransactions: number;
    todayVolume: number;
    activeSessionsNow: number;
    newMembersToday: number;
  };
}

export interface TrendDataPoint {
  date: string;
  value: number;
  change?: number;
  label?: string;
}

export interface AlertItem {
  id: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  service?: string;
}

/**
 * User Analytics Response Interface
 */
export interface UserAnalyticsResponse {
  engagement: {
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    weeklyActiveUsers: number;
    dau_mau_ratio: number;
    sessionMetrics: {
      averageDuration: number;
      totalSessions: number;
      sessionsToday: number;
      peakConcurrentUsers: number;
    };
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
    day90: number;
    cohortData: CohortData[];
  };
  demographics: {
    byRegion: Record<string, number>;
    byDeviceType: Record<string, number>;
    byAppVersion: Record<string, number>;
    registrationTrend: TrendDataPoint[];
  };
  featureUsage: {
    topFeatures: FeatureUsageData[];
    adoption: FeatureAdoptionData[];
    successRates: Record<string, number>;
  };
  membershipActivity: {
    newRegistrations: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    chamaParticipation: {
      activeMembersInChamas: number;
      averageChamasPerMember: number;
      chamaMembershipTrend: TrendDataPoint[];
    };
  };
}

export interface CohortData {
  cohortMonth: string;
  newUsers: number;
  retention: {
    month1: number;
    month2: number;
    month3: number;
    month6: number;
  };
}

export interface FeatureUsageData {
  featureId: string;
  featureName: string;
  usageCount: number;
  uniqueUsers: number;
  averageDuration: number;
  successRate: number;
}

export interface FeatureAdoptionData {
  featureId: string;
  featureName: string;
  adoptionRate: number;
  timeToAdoption: number;
}

/**
 * Financial Analytics Response Interface
 */
export interface FinancialAnalyticsResponse {
  transactions: {
    volume: {
      total: number;
      today: number;
      thisWeek: number;
      thisMonth: number;
      byCurrency: Record<string, CurrencyVolume>;
      byOperation: Record<string, OperationVolume>;
      trend: TrendDataPoint[];
    };
    counts: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
      averagePerDay: number;
    };
    performance: {
      averageDuration: number;
      successRate: number;
      errorsByType: Record<string, number>;
      durationTrend: TrendDataPoint[];
    };
  };
  swaps: {
    onramp: SwapAnalytics;
    offramp: SwapAnalytics;
    fxRates: {
      current: {
        buyRate: number;
        sellRate: number;
        spread: number;
        lastUpdated: string;
      };
      history: FxRateHistory[];
    };
    volume: {
      totalOnrampKes: number;
      totalOfframpKes: number;
      totalOnrampSats: number;
      totalOfframpSats: number;
    };
  };
  chamas: {
    financial: {
      totalBalance: number;
      totalDeposits: number;
      totalWithdrawals: number;
      netFlow: number;
    };
    distribution: {
      balanceDistribution: DistributionData[];
      memberBalanceDistribution: DistributionData[];
      depositPatterns: PatternData[];
    };
    activity: {
      depositsToday: number;
      withdrawalsToday: number;
      pendingWithdrawals: number;
      averageBalance: number;
    };
  };
  shares: {
    ownership: {
      totalShares: number;
      distributedShares: number;
      availableShares: number;
      ownershipConcentration: number;
    };
    trading: {
      totalTransfers: number;
      transferVolume: number;
      averageTransferSize: number;
      transferTrend: TrendDataPoint[];
    };
  };
}

export interface CurrencyVolume {
  total: number;
  today: number;
  currency: string;
}

export interface OperationVolume {
  total: number;
  count: number;
  averageAmount: number;
}

export interface SwapAnalytics {
  count: number;
  successful: number;
  successRate: number;
  totalKes: number;
  totalSats: number;
  averageAmount: number;
  trend: TrendDataPoint[];
  byPaymentMethod: Record<string, number>;
}

export interface FxRateHistory {
  timestamp: string;
  buyRate: number;
  sellRate: number;
  spread: number;
  volume?: number;
}

export interface DistributionData {
  range: string;
  count: number;
  percentage: number;
}

export interface PatternData {
  pattern: string;
  frequency: number;
  averageAmount: number;
}

/**
 * Operational Metrics Response Interface
 */
export interface OperationalMetricsResponse {
  system: {
    health: {
      status: 'healthy' | 'warning' | 'critical';
      uptime: number;
      lastRestart: string;
      version: string;
    };
    performance: {
      responseTime: {
        average: number;
        p50: number;
        p95: number;
        p99: number;
        trend: TrendDataPoint[];
      };
      throughput: {
        requestsPerSecond: number;
        requestsPerMinute: number;
        peakRps: number;
        trend: TrendDataPoint[];
      };
      errors: {
        errorRate: number;
        totalErrors: number;
        errorsByType: Record<string, number>;
        errorsByEndpoint: Record<string, number>;
        trend: TrendDataPoint[];
      };
    };
  };
  services: {
    [serviceName: string]: {
      status: 'online' | 'offline' | 'degraded';
      responseTime: number;
      errorRate: number;
      lastHealthCheck: string;
      dependencies: ServiceDependency[];
    };
  };
  resources: {
    server: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      networkActivity: {
        bytesIn: number;
        bytesOut: number;
        connectionsActive: number;
      };
    };
    database: {
      connectionPool: {
        active: number;
        idle: number;
        waiting: number;
        maxConnections: number;
      };
      performance: {
        queryTime: number;
        slowQueries: number;
        deadlocks: number;
      };
    };
    cache: {
      hitRate: number;
      memoryUsage: number;
      evictions: number;
      keyCount: number;
    };
  };
  infrastructure: {
    loadBalancer: {
      activeServers: number;
      totalServers: number;
      requestDistribution: Record<string, number>;
    };
    monitoring: {
      alertsActive: number;
      alertsResolved: number;
      monitoringCoverage: number;
    };
  };
}

export interface ServiceDependency {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  critical: boolean;
  lastChecked: string;
}

/**
 * Live Metrics Update Interface
 */
export interface LiveMetricsUpdate {
  timestamp: string;
  metrics: {
    activeUsers: number;
    transactionsInProgress: number;
    systemLoad: number;
    errorRate: number;
    responseTime: number;
  };
  alerts?: AlertItem[];
  type: 'metrics-update' | 'alert' | 'system-event';
}

/**
 * Dashboard Metrics Aggregation Service
 * Consolidates data from various metrics services for dashboard consumption
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly businessMetrics: BusinessMetricsService,
    private readonly sharesMetrics: SharesMetricsService,
    private readonly chamaMetrics: ChamaMetricsService,
    private readonly transactionMetrics: TransactionMetricsService,
    private readonly swapMetrics: SwapMetricsService,
    private readonly personalMetrics: PersonalMetricsService,
    private readonly notificationMetrics: NotificationMetrics,
    private readonly nostrMetrics: NostrMetricsService,
    private readonly lnurlMetrics: LnurlMetricsService,
    private readonly authMetrics: AuthMetricsService,
  ) {}

  /**
   * Get aggregated overview metrics for the dashboard
   */
  async getOverviewMetrics(): Promise<DashboardOverviewResponse> {
    try {
      this.logger.log('Aggregating overview metrics');

      // Get data from all metrics services
      const businessData = this.businessMetrics.getBusinessMetrics();

      // For now, we'll provide mock data for missing services
      // TODO: Add actual implementations when services are available
      const chamaData = this.getChamaMetricsMock();
      const transactionData = this.getTransactionMetricsMock();

      const overview: DashboardOverviewResponse = {
        summary: {
          totalMembers: businessData.userEngagement.monthlyActiveUsers,
          activeMembersToday: businessData.userEngagement.dailyActiveUsers,
          activeChamas: chamaData.activeChamas || 0,
          totalChamas: chamaData.totalChamas || 0,
          totalVolume: {
            amount: transactionData.volume?.total || 0,
            currency: 'KES',
            period: 'all-time',
          },
          transactionCount: {
            total: transactionData.counts?.total || 0,
            successful: transactionData.counts?.successful || 0,
            failed: transactionData.counts?.failed || 0,
            pending: transactionData.counts?.pending || 0,
          },
        },
        trends: await this.generateTrends(),
        alerts: await this.generateSystemAlerts(),
        quickStats: {
          todayTransactions: transactionData.counts?.today || 0,
          todayVolume: transactionData.volume?.today || 0,
          activeSessionsNow: businessData.sessions?.total || 0,
          newMembersToday: businessData.userEngagement.newUserRegistrations,
        },
      };

      this.logger.log('Overview metrics aggregated successfully');
      return overview;
    } catch (error) {
      this.logger.error('Failed to aggregate overview metrics', error);
      throw error;
    }
  }

  /**
   * Get user analytics data
   */
  async getUserAnalytics(): Promise<UserAnalyticsResponse> {
    try {
      this.logger.log('Aggregating user analytics');

      const businessData = this.businessMetrics.getBusinessMetrics();

      const analytics: UserAnalyticsResponse = {
        engagement: {
          dailyActiveUsers: businessData.userEngagement.dailyActiveUsers,
          monthlyActiveUsers: businessData.userEngagement.monthlyActiveUsers,
          weeklyActiveUsers: Math.round(
            businessData.userEngagement.dailyActiveUsers * 7,
          ), // Estimate
          dau_mau_ratio: businessData.userEngagement.dau_mau_ratio,
          sessionMetrics: {
            averageDuration: businessData.sessions.averageDuration,
            totalSessions: businessData.sessions.total,
            sessionsToday: businessData.sessions.total, // TODO: Get today's sessions
            peakConcurrentUsers: businessData.userEngagement.dailyActiveUsers, // Estimate
          },
        },
        retention: {
          day1: businessData.retention.day1,
          day7: businessData.retention.day7,
          day30: businessData.retention.day30,
          day90: businessData.retention.day90,
          cohortData: [], // TODO: Implement cohort analysis
        },
        demographics: {
          byRegion: {}, // TODO: Add region tracking
          byDeviceType: businessData.sessions.byDevice,
          byAppVersion: businessData.sessions.byVersion,
          registrationTrend: [], // TODO: Add registration trend
        },
        featureUsage: {
          topFeatures: this.formatFeatureUsage(businessData.featureUsage),
          adoption: [], // TODO: Add adoption metrics
          successRates: this.calculateFeatureSuccessRates(
            businessData.featureUsage,
          ),
        },
        membershipActivity: {
          newRegistrations: {
            today: businessData.userEngagement.newUserRegistrations,
            thisWeek: businessData.userEngagement.newUserRegistrations * 7, // Estimate
            thisMonth: businessData.userEngagement.newUserRegistrations * 30, // Estimate
          },
          chamaParticipation: {
            activeMembersInChamas: 0, // TODO: Get from chama metrics
            averageChamasPerMember: 0, // TODO: Calculate
            chamaMembershipTrend: [], // TODO: Add trend data
          },
        },
      };

      this.logger.log('User analytics aggregated successfully');
      return analytics;
    } catch (error) {
      this.logger.error('Failed to aggregate user analytics', error);
      throw error;
    }
  }

  /**
   * Get financial analytics data
   */
  async getFinancialAnalytics(): Promise<FinancialAnalyticsResponse> {
    try {
      this.logger.log('Aggregating financial analytics');

      const sharesData = this.sharesMetrics.getMetrics();
      const transactionData = this.getTransactionMetricsMock();
      const swapData = this.getSwapMetricsMock();

      const analytics: FinancialAnalyticsResponse = {
        transactions: {
          volume: {
            total: transactionData.volume?.total || 0,
            today: transactionData.volume?.today || 0,
            thisWeek: transactionData.volume?.thisWeek || 0,
            thisMonth: transactionData.volume?.thisMonth || 0,
            byCurrency: transactionData.volume?.byCurrency || {},
            byOperation: transactionData.volume?.byOperation || {},
            trend: [],
          },
          counts: {
            total: transactionData.counts?.total || 0,
            successful: transactionData.counts?.successful || 0,
            failed: transactionData.counts?.failed || 0,
            pending: transactionData.counts?.pending || 0,
            averagePerDay: transactionData.counts?.averagePerDay || 0,
          },
          performance: {
            averageDuration: transactionData.performance?.averageDuration || 0,
            successRate: transactionData.performance?.successRate || 0,
            errorsByType: transactionData.performance?.errorsByType || {},
            durationTrend: [],
          },
        },
        swaps: {
          onramp: swapData.onramp,
          offramp: swapData.offramp,
          fxRates: swapData.fxRates,
          volume: swapData.volume,
        },
        chamas: {
          financial: {
            totalBalance: 0, // TODO: Get from chama metrics
            totalDeposits: 0,
            totalWithdrawals: 0,
            netFlow: 0,
          },
          distribution: {
            balanceDistribution: [],
            memberBalanceDistribution: [],
            depositPatterns: [],
          },
          activity: {
            depositsToday: 0,
            withdrawalsToday: 0,
            pendingWithdrawals: 0,
            averageBalance: 0,
          },
        },
        shares: {
          ownership: {
            totalShares:
              sharesData.totalSharesSubscribed +
              sharesData.totalSharesTransferred,
            distributedShares: sharesData.totalSharesSubscribed,
            availableShares: 1000000 - sharesData.totalSharesSubscribed, // Assuming max 1M shares
            ownershipConcentration: 0, // TODO: Calculate Gini coefficient
          },
          trading: {
            totalTransfers: sharesData.totalTransfers,
            transferVolume: sharesData.totalSharesTransferred,
            averageTransferSize:
              sharesData.totalTransfers > 0
                ? sharesData.totalSharesTransferred / sharesData.totalTransfers
                : 0,
            transferTrend: [],
          },
        },
      };

      this.logger.log('Financial analytics aggregated successfully');
      return analytics;
    } catch (error) {
      this.logger.error('Failed to aggregate financial analytics', error);
      throw error;
    }
  }

  /**
   * Get operational metrics data
   */
  async getOperationalMetrics(): Promise<OperationalMetricsResponse> {
    try {
      this.logger.log('Aggregating operational metrics');

      const metrics: OperationalMetricsResponse = {
        system: {
          health: {
            status: 'healthy',
            uptime: process.uptime(),
            lastRestart: new Date(
              Date.now() - process.uptime() * 1000,
            ).toISOString(),
            version: process.env.npm_package_version || '1.0.0',
          },
          performance: {
            responseTime: {
              average: 150, // TODO: Get from actual metrics
              p50: 120,
              p95: 300,
              p99: 500,
              trend: [],
            },
            throughput: {
              requestsPerSecond: 10, // TODO: Get from actual metrics
              requestsPerMinute: 600,
              peakRps: 25,
              trend: [],
            },
            errors: {
              errorRate: 0.5, // TODO: Get from actual metrics
              totalErrors: 0,
              errorsByType: {},
              errorsByEndpoint: {},
              trend: [],
            },
          },
        },
        services: {
          database: {
            status: 'online',
            responseTime: 50,
            errorRate: 0,
            lastHealthCheck: new Date().toISOString(),
            dependencies: [],
          },
          auth: {
            status: 'online',
            responseTime: 30,
            errorRate: 0,
            lastHealthCheck: new Date().toISOString(),
            dependencies: [],
          },
        },
        resources: {
          server: {
            cpuUsage: Math.round(Math.random() * 50 + 20), // Mock data
            memoryUsage: Math.round(Math.random() * 30 + 40),
            diskUsage: Math.round(Math.random() * 20 + 50),
            networkActivity: {
              bytesIn: Math.round(Math.random() * 1000000),
              bytesOut: Math.round(Math.random() * 1000000),
              connectionsActive: Math.round(Math.random() * 100 + 50),
            },
          },
          database: {
            connectionPool: {
              active: 5,
              idle: 10,
              waiting: 0,
              maxConnections: 20,
            },
            performance: {
              queryTime: 25,
              slowQueries: 0,
              deadlocks: 0,
            },
          },
          cache: {
            hitRate: 85.5,
            memoryUsage: 128,
            evictions: 0,
            keyCount: 1500,
          },
        },
        infrastructure: {
          loadBalancer: {
            activeServers: 1,
            totalServers: 1,
            requestDistribution: { 'server-1': 100 },
          },
          monitoring: {
            alertsActive: 0,
            alertsResolved: 5,
            monitoringCoverage: 90,
          },
        },
      };

      this.logger.log('Operational metrics aggregated successfully');
      return metrics;
    } catch (error) {
      this.logger.error('Failed to aggregate operational metrics', error);
      throw error;
    }
  }

  /**
   * Get live metrics for real-time updates
   */
  async getLiveMetrics(): Promise<LiveMetricsUpdate> {
    try {
      const businessData = this.businessMetrics.getBusinessMetrics();

      return {
        timestamp: new Date().toISOString(),
        metrics: {
          activeUsers: businessData.userEngagement.dailyActiveUsers,
          transactionsInProgress: 0, // TODO: Get from transaction metrics
          systemLoad: Math.round(Math.random() * 50 + 20), // Mock data
          errorRate: 0.5,
          responseTime: 150,
        },
        type: 'metrics-update',
      };
    } catch (error) {
      this.logger.error('Failed to get live metrics', error);
      throw error;
    }
  }

  /**
   * Helper methods for data formatting and calculations
   */
  private formatFeatureUsage(featureUsage: any): FeatureUsageData[] {
    if (!featureUsage || typeof featureUsage !== 'object') return [];

    return Object.entries(featureUsage).map(
      ([featureId, usage]: [string, any]) => ({
        featureId,
        featureName: featureId
          .replace('_', ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        usageCount: usage.usageCount || 0,
        uniqueUsers: usage.usageCount || 0, // Estimate
        averageDuration: usage.averageDuration || 0,
        successRate:
          usage.successCount && usage.usageCount
            ? (usage.successCount / usage.usageCount) * 100
            : 0,
      }),
    );
  }

  private calculateFeatureSuccessRates(
    featureUsage: any,
  ): Record<string, number> {
    if (!featureUsage || typeof featureUsage !== 'object') return {};

    const successRates: Record<string, number> = {};

    Object.entries(featureUsage).forEach(
      ([featureId, usage]: [string, any]) => {
        if (usage.successCount && usage.usageCount) {
          successRates[featureId] =
            (usage.successCount / usage.usageCount) * 100;
        } else {
          successRates[featureId] = 0;
        }
      },
    );

    return successRates;
  }

  private async generateTrends(): Promise<DashboardOverviewResponse['trends']> {
    // TODO: Implement actual trend generation from historical data
    return {
      memberGrowth: [],
      volumeTrend: [],
      transactionTrend: [],
      chamaGrowth: [],
    };
  }

  private async generateSystemAlerts(): Promise<
    DashboardOverviewResponse['alerts']
  > {
    return {
      systemHealth: 'healthy',
      errorRate: 0.5,
      avgResponseTime: 150,
      criticalAlerts: [],
    };
  }

  // Mock data methods - TODO: Replace with actual service calls
  private getChamaMetricsMock() {
    return {
      activeChamas: 45,
      totalChamas: 52,
      totalBalance: 5000000,
      totalDeposits: 8000000,
      totalWithdrawals: 3000000,
    };
  }

  private getTransactionMetricsMock() {
    return {
      volume: {
        total: 10000000,
        today: 50000,
        thisWeek: 350000,
        thisMonth: 1500000,
        byCurrency: { KES: { total: 10000000, today: 50000, currency: 'KES' } },
        byOperation: {},
      },
      counts: {
        total: 2500,
        successful: 2450,
        failed: 45,
        pending: 5,
        today: 25,
        averagePerDay: 50,
      },
      performance: {
        averageDuration: 250,
        successRate: 98,
        errorsByType: { timeout: 20, validation: 15, network: 10 },
      },
    };
  }

  private getSwapMetricsMock() {
    return {
      onramp: {
        count: 150,
        successful: 145,
        successRate: 96.7,
        totalKes: 2000000,
        totalSats: 500000000,
        averageAmount: 13333,
        trend: [],
        byPaymentMethod: { mpesa: 120, card: 25, bank: 5 },
      },
      offramp: {
        count: 80,
        successful: 78,
        successRate: 97.5,
        totalKes: 1000000,
        totalSats: 250000000,
        averageAmount: 12500,
        trend: [],
        byPaymentMethod: { mpesa: 70, bank: 10 },
      },
      fxRates: {
        current: {
          buyRate: 4000,
          sellRate: 3950,
          spread: 1.25,
          lastUpdated: new Date().toISOString(),
        },
        history: [],
      },
      volume: {
        totalOnrampKes: 2000000,
        totalOfframpKes: 1000000,
        totalOnrampSats: 500000000,
        totalOfframpSats: 250000000,
      },
    };
  }
}
