/**
 * Dev-only preview route for typed-artifact UI primitives + section renderers.
 *
 * Mounts each typed section renderer with fixtures so we can visually verify
 * the Arc 2 reader without running a full research pipeline. NOT linked in
 * navigation; access by typing the URL.
 */

import type { ReactElement } from 'react';

import {
  BuyerICPRenderer,
  CompetitorLandscapeRenderer,
  DemandIntentSignalsRenderer,
  MarketCategoryRenderer,
  OfferPerformanceDiagnosticRenderer,
  VoiceOfCustomerRenderer,
} from '@/components/research-v2/section-renderers';
import {
  buyerIcpArtifactFixture,
  competitorLandscapeArtifactFixture,
  demandIntentArtifactFixture,
  marketCategoryArtifactFixture,
  offerPerformanceArtifactFixture,
  voiceOfCustomerArtifactFixture,
} from '@/components/research-v2/section-renderers/fixtures';

export default function TypedArtifactPreviewPage(): ReactElement {
  return (
    <div className="mx-auto max-w-[960px] px-6 py-16">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--accent-blue)]">
          Dev preview — not user-facing
        </p>
        <h1 className="font-serif text-[36px] font-normal leading-[1.12] tracking-[0] text-[color:var(--text-primary)]">
          Typed Artifact Preview
        </h1>
        <p className="max-w-[70ch] text-[15px] leading-[1.75] text-[color:var(--text-secondary)]">
          Renders the six-section typed Audit Reader with fixtures so we can
          verify primitives and section renderers without running a real audit.
        </p>
      </header>

      <main className="mt-16 flex flex-col gap-24">
        <MarketCategoryRenderer artifact={marketCategoryArtifactFixture} />
        <BuyerICPRenderer artifact={buyerIcpArtifactFixture} />
        <CompetitorLandscapeRenderer artifact={competitorLandscapeArtifactFixture} />
        <VoiceOfCustomerRenderer artifact={voiceOfCustomerArtifactFixture} />
        <DemandIntentSignalsRenderer artifact={demandIntentArtifactFixture} />
        <OfferPerformanceDiagnosticRenderer
          artifact={offerPerformanceArtifactFixture}
        />
      </main>
    </div>
  );
}
