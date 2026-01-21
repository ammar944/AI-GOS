// Ad Library Service Barrel Export
// Re-exports all public types and the service

export { AdLibraryService, createAdLibraryService } from './service';
export type {
  AdPlatform,
  AdFormat,
  AdCreative,
  AdLibraryOptions,
  AdLibraryResponse,
  MultiPlatformAdResponse,
} from './types';

// Export name matching utilities (useful for testing and validation)
export {
  normalizeCompanyName,
  calculateSimilarity,
  isAdvertiserMatch,
  generateCompanyAliases,
  extractCompanyFromDomain,
} from './name-matcher';

// Export logger utilities and types (useful for custom logging)
export type { AdFetchContext } from './logger';
export { createAdFetchContext } from './logger';
