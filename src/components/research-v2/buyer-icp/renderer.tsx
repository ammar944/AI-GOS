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
import {
  formatConfidenceToTen,
  getConfidenceToneClass,
} from '@/lib/research-v2/confidence-display';
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

export function BuyerICPArtifactRenderer({
  artifact,
}: BuyerICPArtifactRendererProps): React.ReactElement {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            {artifact.sectionTitle}
          </h2>
          <Badge
            variant="outline"
            className={cn('shrink-0 border', getConfidenceToneClass(artifact.confidence))}
          >
            Confidence {formatConfidenceToTen(artifact.confidence)}/10
          </Badge>
        </div>
        <p className="text-base leading-relaxed text-foreground">
          {artifact.verdict}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
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
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
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
                className="rounded-md border border-border bg-muted p-3"
              >
                <div className="flex flex-col gap-2">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open source: ${source.title}`}
                    className="inline-flex w-fit items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {source.title}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  <span className="break-all text-xs text-muted-foreground">
                    {source.url}
                  </span>
                  {source.accessedAt ? (
                    <span className="text-xs text-muted-foreground">
                      {source.accessedAt}
                    </span>
                  ) : null}
                  {source.whyItMatters ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
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
