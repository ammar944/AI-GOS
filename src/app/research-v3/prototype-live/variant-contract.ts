// variant-contract.ts — PROTOTYPE. Shared props every live-run variant receives.
import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import type { NarrationItem } from './phase-narration';

export interface VariantProps {
  state: AuditStateResponse;
  narration: NarrationItem[];
  elapsedMs: number;
  totalMs: number;
  playing: boolean;
}

// Canonical pipeline display order (paid media is terminal, shown last).
export const ZONE_ORDER = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
] as const;
