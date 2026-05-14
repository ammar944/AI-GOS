'use client';

import { ExternalLink, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Persona } from '@/types/buyer-icp-artifact';

export interface PersonaCardProps {
  persona: Persona;
}

export function PersonaCard({ persona }: PersonaCardProps): React.ReactElement {
  return (
    <Card role="listitem" className="h-full rounded-md">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-[color:var(--text-3)]"
          >
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold leading-tight text-[color:var(--text-1)]">
              {persona.name}
            </h4>
            <p className="text-sm leading-snug text-[color:var(--text-2)]">
              {persona.title}
            </p>
            <p className="text-xs text-[color:var(--text-3)]">{persona.company}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-[var(--border)]">
            {persona.seniority}
          </Badge>
          <Badge variant="secondary">{persona.role}</Badge>
        </div>

        {persona.teamSize ? (
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-2)] p-2 text-xs text-[color:var(--text-2)]">
            <span className="font-medium text-[color:var(--text-1)]">Team size</span>{' '}
            {persona.teamSize}
          </div>
        ) : null}

        <Collapsible className="mt-auto">
          <CollapsibleTrigger className="text-xs font-medium text-[color:var(--accent)] hover:underline">
            Evidence
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <p className="text-xs leading-relaxed text-[color:var(--text-2)]">
              {persona.evidence}
            </p>
          </CollapsibleContent>
        </Collapsible>

        <a
          href={persona.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source for ${persona.name}`}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[color:var(--accent)] hover:underline"
        >
          Source <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  );
}
