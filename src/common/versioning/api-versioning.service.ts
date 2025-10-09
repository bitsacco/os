import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import {
  API_VERSIONS,
  ApiVersion,
  supportsFeature,
} from './api-versioning.config';

/**
 * Service for managing API versioning functionality
 */
@Injectable()
export class ApiVersioningService {
  private readonly logger = new Logger(ApiVersioningService.name);
  private readonly versionMetrics = new Map<string, number>();

  /**
   * Extract API version from request
   */
  getVersionFromRequest(request: Request): ApiVersion {
    const path = request.path || request.url;
    const versionMatch = path.match(/^\/v(\d+)\//);

    if (versionMatch) {
      const version = versionMatch[1];
      this.trackVersionUsage(version);
      return version as ApiVersion;
    }

    return API_VERSIONS.V2; // Default to v2
  }

  /**
   * Track version usage for monitoring
   */
  private trackVersionUsage(version: string): void {
    const key = `v${version}`;
    const current = this.versionMetrics.get(key) || 0;
    this.versionMetrics.set(key, current + 1);
  }

  /**
   * Get version usage metrics
   */
  getVersionMetrics(): Record<string, number> {
    return Object.fromEntries(this.versionMetrics);
  }

  /**
   * Validate if a feature is supported in the given version
   */
  isFeatureSupported(
    version: ApiVersion,
    feature:
      | 'strictRestCompliance'
      | 'allowBodyResourceIds'
      | 'supportLegacyPatterns',
  ): boolean {
    return supportsFeature(version as string, feature);
  }
}
