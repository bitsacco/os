/**
 * API Versioning Configuration Module
 *
 * This module provides centralized configuration for API versioning across the application.
 * It manages version constants, routing, and migration utilities to support gradual
 * transition from v1 to v2 REST-compliant endpoints.
 */

import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';

/**
 * API Version Constants
 */
export const API_VERSIONS = {
  V2: '2',
  NEUTRAL: VERSION_NEUTRAL,
} as const;

export type ApiVersion = (typeof API_VERSIONS)[keyof typeof API_VERSIONS];

/**
 * Default API version for new endpoints
 */
export const DEFAULT_API_VERSION = API_VERSIONS.V2;

/**
 * API Path Constants
 * Centralized constant for the API prefix used in global configuration
 */
export const API_PREFIX = 'api';

/**
 * API versioning configuration for NestJS
 */
export const API_VERSIONING_CONFIG = {
  type: VersioningType.URI,
  defaultVersion: DEFAULT_API_VERSION,
  prefix: 'v',
} as const;

/**
 * Routes that should be excluded from versioning
 * These routes will not have version prefixes applied
 */
export const VERSION_EXCLUDED_ROUTES = [
  '.well-known/lnurlp/(.*)', // Lightning URL endpoints (LNURL spec requirement)
  'health', // Health check endpoints
  'metrics', // Metrics endpoints
] as const;

/**
 * Configuration for version-specific features
 */
export const VERSION_FEATURES = {
  v2: {
    strictRestCompliance: true,
    allowBodyResourceIds: false,
    supportLegacyPatterns: false,
  },
} as const;

/**
 * Helper to determine if a version supports a specific feature
 */
export function supportsFeature(
  version: string,
  feature: keyof typeof VERSION_FEATURES.v2,
): boolean {
  const versionKey = `v${version}` as keyof typeof VERSION_FEATURES;
  return VERSION_FEATURES[versionKey]?.[feature] ?? false;
}
