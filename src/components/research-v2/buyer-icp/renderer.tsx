'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { BuyerICPArtifact } from '@/types/buyer-icp-artifact';

import { AwarenessLevelCard } from './awareness-level-card';
import { ClusterVenueCard } from './cluster-venue-card';
import { FirmographicCutCard } from './firmographic-cut-card';
import { PersonaCard } from './persona-card';
import { BuyerICPSubSection } from './sub-section';
import { TriggerCard } from './trigger-card';

export interface BuyerICPArtifactRendererProps {
  artifact: BuyerICPArtifact;
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 8) return 'border-[color:var(--green)] text-[color:var(--green)]';
  if (confidence >= 5) return 'border-[color:var(--amber)] text-[color:var(--amber)]';
  return 'border-[color:var(--red)] text-[color:var(--red)]';
}

export function BuyerICPArtifactRenderer({
  artifact,
}: BuyerICPArtifactRendererProps): React.ReactElement {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold leading-tight text-[color:var(--text-1)]">
            {artifact.sectionTitle}
          </h2>
          <Badge
            variant="outline"
            className={cn('shrink-0 border', getConfidenceClass(artifact.confidence))}
          >
            Confidence {artifact.confidence}/10
          </Badge>
        </div>
        <p className="text-base leading-relaxed text-[color:var(--text-1)]">
          {artifact.verdict}
        </p>
        <p className="text-sm leading-relaxed text-[color:var(--text-2)]">
          {artifact.statusSummary}
        </p>
      </header>

      <BuyerICPSubSection
        title="ICP existence check"
        prose={artifact.icpExistenceCheck.prose}
        gridLabel="ICP existence check cards"
      >
        {artifact.icpExistenceCheck.firmographicCuts.map((cut) => (
          <FirmographicCutCard
            key={`${cut.cutType}-${cut.value}-${cut.sourceUrl}`}
            cut={cut}
          />
        ))}
      </BuyerICPSubSection>

      <BuyerICPSubSection
        title="Persona reality"
        prose={artifact.personaReality.prose}
        gridLabel="Persona reality cards"
      >
        {artifact.personaReality.personas.map((persona) => (
          <PersonaCard
            key={`${persona.name}-${persona.company}-${persona.sourceUrl}`}
            persona={persona}
          />
        ))}
      </BuyerICPSubSection>

      <BuyerICPSubSection
        title="Awareness distribution"
        prose={artifact.awarenessDistribution.prose}
        gridLabel="Awareness distribution cards"
      >
        {artifact.awarenessDistribution.levels.map((level) => (
          <AwarenessLevelCard key={level.level} level={level} />
        ))}
      </BuyerICPSubSection>

      <BuyerICPSubSection
        title="Buying context"
        prose={artifact.buyingContext.prose}
        gridLabel="Buying context cards"
      >
        {artifact.buyingContext.triggers.map((trigger) => (
          <TriggerCard key={`${trigger.name}-${trigger.window}`} trigger={trigger} />
        ))}
      </BuyerICPSubSection>

      <BuyerICPSubSection
        title="Where they cluster"
        prose={artifact.clusters.prose}
        gridLabel="Cluster venue cards"
      >
        {artifact.clusters.venues.map((venue) => (
          <ClusterVenueCard key={`${venue.bucketType}-${venue.name}`} venue={venue} />
        ))}
      </BuyerICPSubSection>

      <Separator />

      <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-[color:var(--text-1)] hover:text-[color:var(--accent)]">
          {sourcesOpen ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
          Sources ({artifact.sources.length})
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <ul
            role="list"
            aria-label="Buyer ICP sources"
            className="space-y-3 text-sm"
          >
            {artifact.sources.map((source) => (
              <li
                key={source.url}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-2)] p-3"
              >
                <div className="flex flex-col gap-2">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open source: ${source.title}`}
                    className="inline-flex w-fit items-center gap-1 font-medium text-[color:var(--accent)] hover:underline"
                  >
                    {source.title}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  <span className="break-all text-xs text-[color:var(--text-3)]">
                    {source.url}
                  </span>
                  {source.accessedAt ? (
                    <span className="text-xs text-[color:var(--text-3)]">
                      {source.accessedAt}
                    </span>
                  ) : null}
                  {source.whyItMatters ? (
                    <p className="text-xs leading-relaxed text-[color:var(--text-2)]">
                      {source.whyItMatters}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
