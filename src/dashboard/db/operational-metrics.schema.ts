import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  BaseMetrics,
  BaseMetricsDocument,
} from '../../common/database/metrics.schema';

/**
 * System health sub-document
 */
@Schema({ _id: false })
export class SystemHealth {
  @Prop({
    type: String,
    enum: ['healthy', 'degraded', 'critical'],
    default: 'healthy',
  })
  status: 'healthy' | 'degraded' | 'critical';

  @Prop({ type: Number, default: 0 })
  uptime: number;

  @Prop({ type: Date })
  lastRestart: Date;

  @Prop({ type: String, default: '1.0.0' })
  version: string;

  @Prop({ type: Number, default: 0 })
  memoryUsage: number;

  @Prop({ type: Number, default: 0 })
  cpuUsage: number;
}

/**
 * Performance metrics sub-document
 */
@Schema({ _id: false })
export class PerformanceMetrics {
  @Prop({ type: Number, default: 0 })
  averageResponseTime: number;

  @Prop({ type: Number, default: 0 })
  p95ResponseTime: number;

  @Prop({ type: Number, default: 0 })
  p99ResponseTime: number;

  @Prop({ type: Number, default: 0 })
  requestsPerSecond: number;

  @Prop({ type: Object, default: {} })
  endpointMetrics: Record<
    string,
    {
      averageResponseTime: number;
      requestCount: number;
      errorCount: number;
    }
  >;
}

/**
 * Throughput metrics sub-document
 */
@Schema({ _id: false })
export class ThroughputMetrics {
  @Prop({ type: Number, default: 0 })
  totalRequests: number;

  @Prop({ type: Number, default: 0 })
  successfulRequests: number;

  @Prop({ type: Number, default: 0 })
  failedRequests: number;

  @Prop({ type: Number, default: 0 })
  requestsPerMinute: number;

  @Prop({ type: Object, default: {} })
  byService: Record<string, number>;
}

/**
 * Error metrics sub-document
 */
@Schema({ _id: false })
export class ErrorMetrics {
  @Prop({ type: Number, default: 0 })
  totalErrors: number;

  @Prop({ type: Number, default: 0 })
  errorRate: number;

  @Prop({ type: Object, default: {} })
  errorsByType: Record<string, number>;

  @Prop({ type: Object, default: {} })
  errorsByService: Record<string, number>;

  @Prop({ type: Object, default: {} })
  criticalErrors: Record<string, number>;
}

/**
 * System performance sub-document
 */
@Schema({ _id: false })
export class SystemPerformance {
  @Prop({ type: PerformanceMetrics, default: () => new PerformanceMetrics() })
  responseTime: PerformanceMetrics;

  @Prop({ type: ThroughputMetrics, default: () => new ThroughputMetrics() })
  throughput: ThroughputMetrics;

  @Prop({ type: ErrorMetrics, default: () => new ErrorMetrics() })
  errorMetrics: ErrorMetrics;
}

/**
 * Server resource metrics sub-document
 */
@Schema({ _id: false })
export class ServerResourceMetrics {
  @Prop({ type: Number, default: 0 })
  memoryUsedMB: number;

  @Prop({ type: Number, default: 0 })
  memoryTotalMB: number;

  @Prop({ type: Number, default: 0 })
  memoryUsagePercent: number;

  @Prop({ type: Number, default: 0 })
  cpuUsagePercent: number;

  @Prop({ type: Number, default: 0 })
  diskUsagePercent: number;

  @Prop({ type: Number, default: 0 })
  activeConnections: number;

  @Prop({ type: Number, default: 0 })
  loadAverage: number;
}

/**
 * Database metrics sub-document
 */
@Schema({ _id: false })
export class DatabaseMetrics {
  @Prop({ type: Number, default: 0 })
  connectionCount: number;

  @Prop({ type: Number, default: 0 })
  activeConnections: number;

  @Prop({ type: Number, default: 0 })
  queryExecutionTime: number;

  @Prop({ type: Number, default: 0 })
  slowQueries: number;

  @Prop({ type: Number, default: 0 })
  connectionPoolUsage: number;

  @Prop({ type: Boolean, default: true })
  isHealthy: boolean;

  @Prop({ type: Number, default: 0 })
  documentsRead: number;

  @Prop({ type: Number, default: 0 })
  documentsWritten: number;
}

/**
 * Cache metrics sub-document
 */
@Schema({ _id: false })
export class CacheMetrics {
  @Prop({ type: Number, default: 0 })
  hitCount: number;

  @Prop({ type: Number, default: 0 })
  missCount: number;

  @Prop({ type: Number, default: 0 })
  hitRate: number;

  @Prop({ type: Number, default: 0 })
  totalKeys: number;

  @Prop({ type: Number, default: 0 })
  memoryUsedMB: number;

  @Prop({ type: Number, default: 0 })
  evictionCount: number;

  @Prop({ type: Boolean, default: true })
  isHealthy: boolean;
}

/**
 * Resource metrics sub-document
 */
@Schema({ _id: false })
export class ResourceMetrics {
  @Prop({
    type: ServerResourceMetrics,
    default: () => new ServerResourceMetrics(),
  })
  server: ServerResourceMetrics;

  @Prop({ type: DatabaseMetrics, default: () => new DatabaseMetrics() })
  database: DatabaseMetrics;

  @Prop({ type: CacheMetrics, default: () => new CacheMetrics() })
  cache: CacheMetrics;
}

/**
 * Infrastructure metrics sub-document
 */
@Schema({ _id: false })
export class InfrastructureMetrics {
  @Prop({ type: Number, default: 0 })
  activeServices: number;

  @Prop({ type: Number, default: 0 })
  healthyServices: number;

  @Prop({ type: Number, default: 0 })
  unhealthyServices: number;

  @Prop({ type: Object, default: {} })
  serviceStatus: Record<string, 'healthy' | 'degraded' | 'critical'>;

  @Prop({ type: Object, default: {} })
  externalDependencies: Record<
    string,
    {
      status: 'healthy' | 'degraded' | 'critical';
      responseTime: number;
      lastChecked: Date;
    }
  >;

  @Prop({ type: Number, default: 0 })
  networkLatency: number;

  @Prop({ type: Number, default: 0 })
  totalNetworkRequests: number;

  @Prop({ type: Number, default: 0 })
  failedNetworkRequests: number;
}

/**
 * System metrics sub-document
 */
@Schema({ _id: false })
export class SystemMetrics {
  @Prop({ type: SystemHealth, default: () => new SystemHealth() })
  health: SystemHealth;

  @Prop({ type: SystemPerformance, default: () => new SystemPerformance() })
  performance: SystemPerformance;
}

/**
 * Operational metrics document interface
 */
export interface OperationalMetricsDocument extends BaseMetricsDocument {
  system: SystemMetrics;
  resources: ResourceMetrics;
  infrastructure: InfrastructureMetrics;
}

/**
 * Operational metrics MongoDB schema
 */
@Schema({
  collection: 'operational_metrics',
  timestamps: true,
})
export class OperationalMetrics
  extends BaseMetrics
  implements OperationalMetricsDocument
{
  @Prop({ type: SystemMetrics, default: () => new SystemMetrics() })
  system: SystemMetrics;

  @Prop({ type: ResourceMetrics, default: () => new ResourceMetrics() })
  resources: ResourceMetrics;

  @Prop({
    type: InfrastructureMetrics,
    default: () => new InfrastructureMetrics(),
  })
  infrastructure: InfrastructureMetrics;
}

export const OperationalMetricsSchema =
  SchemaFactory.createForClass(OperationalMetrics);

// Add compound indexes for efficient querying
OperationalMetricsSchema.index(
  { source: 1, period: 1, timestamp: -1 },
  { name: 'source_period_timestamp_idx' },
);

OperationalMetricsSchema.index(
  { timestamp: 1 },
  { name: 'timestamp_idx', expireAfterSeconds: 31536000 }, // 1 year TTL
);

OperationalMetricsSchema.index(
  { source: 1, period: 1 },
  { name: 'source_period_idx' },
);

// Add indexes for operational monitoring
OperationalMetricsSchema.index(
  { 'system.health.status': 1 },
  { name: 'system_health_idx' },
);

OperationalMetricsSchema.index(
  { 'system.performance.errorMetrics.errorRate': -1 },
  { name: 'error_rate_idx' },
);

export type OperationalMetricsModel = OperationalMetrics & Document;
