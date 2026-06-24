// Client-facing deck presentation of the paid-media plan — the same
// PaidMediaPlanArtifact rendered in the SaaSLaunch 13-page deck order
// (cover → campaign overview → phases → audiences → angles → creative
// strategy → creative framework → funnel ideation → sales process →
// competitor marketing → competitor reviews → current-funnel suggestions →
// KPIs). Visual register follows the agency template: pale-blue card fills,
// oversized blue stat callouts, one-sentence subtitles, verdict pills.
// No mono-uppercase analyst chrome, no sourceSection badges, no per-row
// provenance chips — provenance lives in ONE assumptions panel at the end.

import type {
  PaidMediaEvidencePack,
  PaidMediaPlanArtifact,
} from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import { cn } from '@/lib/utils';
import type { PositioningTypedArtifact } from '@/types/positioning-artifact';
import {
  BudgetBar,
  scrubReaderText,
  stripMoneyProvenanceSuffix,
} from '@/components/research-v2/primitives';
import { BodyProse, StatusPill } from '@/components/research-v2/ui-kit';
import {
  budgetSegments,
  formatUsdValue,
  getPaidMediaPlanBody,
  isMissingSalesAsset,
  PAID_MEDIA_TEST_BUDGET_LABEL,
  provenanceLabel,
  verdictTone,
} from './paid-media-plan';

export interface PaidMediaPlanDeckProps {
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact;
  /** Company / subject name for the cover band. */
  subjectName?: string;
  className?: string;
}

type PaidMediaBody = PaidMediaPlanArtifact['body'];
type CreativeSlot = PaidMediaBody['creativeFramework'][number];
type ProjectedResultRow = PaidMediaBody['projectedResults'][number];
type FeasibilityAudit = NonNullable<PaidMediaBody['feasibilityAudit']>;
type FeasibilityVerdict = FeasibilityAudit['verdicts'][number];

function money(value: string): string {
  return stripMoneyProvenanceSuffix(scrubReaderText(value));
}

function statValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (/^not available$/i.test(trimmed)) return null;
  return trimmed;
}

function numberStatValue(value: number | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : null;
}

function projectedCountStatValue(value: number | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value).toLocaleString()
    : null;
}

// Optional paid-CAC fields the composer attaches when a trial->paid bridge is
// modeled. Read defensively — absent on older artifacts or before the composer
// fills them.
interface DeckCustomerCacFields {
  impliedCacValue?: number;
  customerCacValue?: number;
  costPerTrialLabel?: string;
  customerCacBandLowValue?: number;
  customerCacBandHighValue?: number;
}

function readDeckCustomerCacFields(
  row: ProjectedResultRow,
): DeckCustomerCacFields {
  return row as ProjectedResultRow & DeckCustomerCacFields;
}

// ---------------------------------------------------------------------------
// Deck-local layout primitives
// ---------------------------------------------------------------------------

function DeckPage({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section className={cn('deck-page grid gap-6', className)}>
      <header>
        <h2 className="font-sans text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] leading-[1.5] text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

// Small blue smallcaps label, matching the template's card eyebrows
// ("BROAD PROSPECTING") — deck idiom, not the analyst mono register.
function DeckLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
      {children}
    </div>
  );
}

// Oversized blue stat beside a bold label — the template's overview tiles.
function StatTile({
  value,
  label,
  detail,
}: {
  value: string | null | undefined;
  label: string;
  detail?: string;
}): React.ReactElement | null {
  const displayValue = statValue(value);
  if (displayValue === null) return null;

  return (
    <div className="flex items-center gap-5 rounded-md bg-primary/5 px-5 py-4">
      <div className="shrink-0 font-sans text-[26px] font-semibold leading-none tabular-nums text-primary">
        {displayValue}
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold leading-[1.3] text-foreground">
          {label}
        </div>
        {detail ? (
          <div className="mt-0.5 text-[12px] leading-[1.45] text-muted-foreground">
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BannerPill({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="rounded-md bg-primary px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.06em] text-primary-foreground">
      {children}
    </div>
  );
}

// A row whose evidencePack.status === 'gap' was synthesized without a row-level
// anchor match (cited at section level only). A grounded row ties to a real
// upstream committed row. The deck otherwise carries no per-row chrome — this
// minimal amber marker is a deliberate exception so an ungrounded synthesized
// row never reads identically to a grounded one. Read defensively: evidencePack
// is optional on every row, and the enum is only 'grounded' | 'gap'.
function GapStatusMarker({
  evidencePack,
}: {
  evidencePack?: PaidMediaEvidencePack;
}): React.ReactElement | null {
  if (evidencePack?.status !== 'gap') return null;
  const note = statValue(evidencePack.note);
  return (
    <p
      data-testid="paid-media-gap-marker"
      className="border-l-2 border-amber-500/60 pl-3 text-[11px] font-medium leading-[1.45] text-amber-700"
    >
      <span className="uppercase tracking-[0.04em]">
        Unverified — section-level citation only
      </span>
      {note ? (
        <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground">
          {scrubReaderText(note)}
        </span>
      ) : null}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Per-page helpers
// ---------------------------------------------------------------------------

function splitArchetype(archetype: string): { eyebrow: string | null; title: string } {
  const parts = archetype.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { eyebrow: parts[0].trim(), title: parts.slice(1).join(' — ').trim() };
  }
  return { eyebrow: null, title: archetype.trim() };
}

function isUgcSlot(slot: CreativeSlot): boolean {
  return /\b(ugc|video|usp|demo|before)\b|before\s*\/\s*after/i.test(
    `${slot.label} ${slot.angleType}`,
  );
}

function creativeSlotTypeLabel(slot: CreativeSlot): string {
  return isUgcSlot(slot) ? 'UGC' : 'Static';
}

interface CreativeSlotListProps {
  slots: CreativeSlot[];
  showTypeLabels?: boolean;
}

function CreativeSlotList({
  slots,
  showTypeLabels = false,
}: CreativeSlotListProps): React.ReactElement {
  return (
    <ul className="grid gap-2.5">
      {slots.map((slot) => (
        <li key={slot.label} className="text-[13px] leading-[1.55]">
          <span className="font-semibold text-primary">{slot.label}: </span>
          {showTypeLabels ? (
            <span className="mr-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {creativeSlotTypeLabel(slot)}
            </span>
          ) : null}
          <span className="text-foreground/90">
            {scrubReaderText(slot.hook)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function missingCreativeModalityNote(
  body: PaidMediaBody,
  missing: 'static' | 'ugc',
): string {
  const plannedCount =
    missing === 'ugc'
      ? body.creativeStrategy.videoCount
      : body.creativeStrategy.staticCount;
  const plannedCountText = numberStatValue(plannedCount);

  if (missing === 'ugc') {
    return plannedCountText === null
      ? 'No UGC concepts were framed this round.'
      : `UGC slots are planned in the creative strategy — ${plannedCountText} videos — but no UGC concepts were framed this round.`;
  }

  return plannedCountText === null
    ? 'No static concepts were framed this round.'
    : `Static slots are planned in the creative strategy — ${plannedCountText} static ads — but no static concepts were framed this round.`;
}

function funnelRankBadge(rank: string): {
  label: string;
  className: string;
} {
  if (/primary/i.test(rank)) {
    return { label: 'PRIMARY', className: 'bg-primary text-primary-foreground' };
  }
  if (/secondary/i.test(rank)) {
    return { label: 'SECONDARY', className: 'bg-primary/10 text-primary' };
  }
  if (/test/i.test(rank)) {
    return { label: 'TEST', className: 'bg-muted text-muted-foreground' };
  }
  return { label: rank, className: 'bg-muted text-muted-foreground' };
}

function isGapRecommendation(recommendation: string): boolean {
  return /^evidence gap/i.test(recommendation.trim());
}

interface ProvenanceRow {
  label: string;
  display: string;
  provenance: string;
}

function deckProvenanceLabel(value: string | undefined): string {
  return value === 'derived' ? 'computed' : provenanceLabel(value);
}

function collectProvenanceRows(body: PaidMediaBody): ProvenanceRow[] {
  const rows: ProvenanceRow[] = [
    {
      label: 'Monthly budget',
      display: money(body.campaignOverview.monthlyBudget),
      provenance: deckProvenanceLabel(body.campaignOverview.monthlyBudgetProvenance),
    },
    {
      label: 'Daily spend',
      display: money(body.campaignOverview.dailySpend),
      provenance: deckProvenanceLabel(body.campaignOverview.dailySpendProvenance),
    },
    ...body.campaignPhases.map((phase) => ({
      label: `${phase.phaseName} budget`,
      display: money(phase.monthlyBudget),
      provenance: deckProvenanceLabel(phase.monthlyBudgetProvenance),
    })),
    ...body.audienceTypes.map((audience) => ({
      label: `${audience.archetype} daily budget`,
      display: money(audience.dailyBudget),
      provenance: deckProvenanceLabel(audience.dailyBudgetProvenance),
    })),
    ...body.projectedResults.flatMap((row) => [
      {
        label: `${row.targetIcp} — ${row.kpi} cost`,
        display: formatUsdValue(row.kpiCostValue),
        provenance: deckProvenanceLabel(row.kpiCostProvenance),
      },
      {
        label: `${row.targetIcp} — phase budget`,
        display: formatUsdValue(row.phaseMonthlyBudgetValue),
        provenance: deckProvenanceLabel(row.phaseMonthlyBudgetProvenance),
      },
      ...(row.projectedCountValue === undefined
        ? []
        : [
            {
              label: `${row.targetIcp} — projected ${row.kpi}`,
              display: projectedCountStatValue(row.projectedCountValue) ?? '',
              provenance: deckProvenanceLabel(row.projectedCountProvenance),
            },
          ]),
    ]),
  ];

  return rows;
}

function feasibilityVerdictTone(
  verdict: FeasibilityVerdict['verdict'],
): { label: string; className: string } {
  if (verdict === 'fits') {
    return { label: 'FITS', className: 'bg-emerald-500/10 text-emerald-700' };
  }
  if (verdict === 'exceeds') {
    return { label: 'EXCEEDS SUPPLY', className: 'bg-amber-500/10 text-amber-700' };
  }
  return { label: 'UNKNOWN', className: 'bg-muted text-muted-foreground' };
}

// Budget feasibility audit — WHY each audience's spend is or is not deliverable
// against measured search supply. The composer computes verdicts (matched
// keywords, volume basis, budget provenance) but the deck otherwise never shows
// them; surface them here so the buyer sees the reasoning, not just the number.
// Renders nothing when the audit is absent — never crashes on legacy artifacts.
function FeasibilityAuditPanel({
  audit,
}: {
  audit: FeasibilityAudit | undefined;
}): React.ReactElement | null {
  if (audit === undefined || audit.verdicts.length === 0) return null;

  return (
    <section
      data-testid="paid-media-feasibility-audit"
      className="deck-page rounded-md border border-border bg-card p-6"
    >
      <h2 className="text-[15px] font-semibold text-foreground">
        Budget feasibility
      </h2>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">
        {scrubReaderText(audit.summary)}
      </p>
      <ul className="mt-4 grid gap-4">
        {audit.verdicts.map((verdict) => {
          const tone = feasibilityVerdictTone(verdict.verdict);
          return (
            <li key={verdict.audience} className="grid gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.06em]',
                    tone.className,
                  )}
                >
                  {tone.label}
                </span>
                <span className="text-[13px] font-semibold text-foreground">
                  {scrubReaderText(verdict.audience)}
                </span>
              </div>
              <p className="text-[12px] leading-[1.5] text-muted-foreground">
                Volume basis: {scrubReaderText(verdict.volumeBasis)}
              </p>
              <p className="text-[12px] leading-[1.5] text-muted-foreground">
                Budget basis: {scrubReaderText(verdict.allocationBasis)}
              </p>
              {verdict.matchedKeywords.length > 0 ? (
                <p className="text-[12px] leading-[1.5] text-muted-foreground">
                  Matched keywords:{' '}
                  {verdict.matchedKeywords
                    .map(
                      (keyword) =>
                        `${scrubReaderText(keyword.keyword)} (${keyword.monthlyVolume.toLocaleString()}/mo)`,
                    )
                    .join(', ')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaidMediaPlanDeck({
  artifact,
  subjectName,
  className,
}: PaidMediaPlanDeckProps): React.ReactElement {
  const body = getPaidMediaPlanBody(artifact);
  const overview = body.campaignOverview;

  const staticSlots = body.creativeFramework.filter((slot) => !isUgcSlot(slot));
  const ugcSlots = body.creativeFramework.filter(isUgcSlot);
  const projectedRowsWithCounts = body.projectedResults.filter(
    (row): row is ProjectedResultRow & { projectedCountValue: number } =>
      typeof row.projectedCountValue === 'number' &&
      Number.isFinite(row.projectedCountValue),
  );
  const linkedSalesAssets = body.salesProcess.filter(
    (asset) => !isMissingSalesAsset(asset),
  );
  const missingSalesAssets = body.salesProcess.filter(isMissingSalesAsset);
  const funnelSuggestions = body.channelSuggestions.filter(
    (row) => !isGapRecommendation(row.recommendation),
  );

  return (
    <div
      data-testid="paid-media-plan-deck"
      className={cn('space-y-12', className)}
    >
      {/* p1 — cover */}
      <section className="deck-page grid gap-5">
        <h1 className="font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
          Paid Media Plan
        </h1>
        {subjectName ? (
          <div className="rounded-md bg-primary px-6 py-3 text-center text-[16px] font-semibold text-primary-foreground sm:max-w-[420px]">
            {subjectName}
          </div>
        ) : null}
        <p className="text-[14px] text-muted-foreground">
          {scrubReaderText(overview.platform)}
          {' · '}
          {overview.phaseCount}-phase plan
          {' · '}
          {money(overview.monthlyBudget)} / month
        </p>
      </section>

      {/* p2 — campaign overview */}
      <DeckPage
        title="Campaign Overview"
        subtitle={`Monthly paid media budget · ${scrubReaderText(overview.platform)} · ${overview.totalMonths}-month, ${overview.phaseCount}-phase plan`}
      >
        <div className="grid gap-3">
          <StatTile
            value={money(overview.monthlyBudget)}
            label="Monthly Budget"
            detail="Paid media spend per month"
          />
          {body.campaignPhases.map((phase) => (
            <StatTile
              key={phase.phaseName}
              value={money(phase.monthlyBudget)}
              label={phase.phaseName}
              detail={phase.monthsLabel}
            />
          ))}
          <StatTile
            value={money(overview.dailySpend)}
            label="Daily Spend"
            detail={`Across test audiences · KPI: ${scrubReaderText(overview.primaryKpi)}`}
          />
        </div>
        <BudgetBar
          segments={budgetSegments(body)}
          totalLabel={`${money(overview.dailySpend)} daily spend · ${money(overview.monthlyBudget)} monthly`}
        />
      </DeckPage>

      {/* p3 — campaign phases */}
      <DeckPage
        title="Campaign Phases"
        subtitle="How the budget moves from testing to scale"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {body.campaignPhases.map((phase) => (
            <article
              key={phase.phaseName}
              className="grid content-start gap-4 rounded-md border border-border bg-card p-5"
            >
              <BannerPill>{phase.phaseName}</BannerPill>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-muted-foreground">
                  {phase.monthsLabel}
                </span>
                <span className="font-sans text-[20px] font-semibold tabular-nums text-primary">
                  {money(phase.monthlyBudget)}
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {' '}
                    / month
                  </span>
                </span>
              </div>
              <ul className="grid gap-1.5">
                {phase.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2 text-[13px] leading-[1.5] text-foreground/90"
                  >
                    <span aria-hidden="true" className="text-primary">
                      ✓
                    </span>
                    {scrubReaderText(bullet)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </DeckPage>

      {/* p4 — audience types */}
      <DeckPage
        title="Audience Types"
        subtitle={`${body.audienceTypes.length} audiences tested in parallel · KPI: ${scrubReaderText(overview.primaryKpi)}`}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {body.audienceTypes.map((audience, index) => {
            const { eyebrow, title } = splitArchetype(audience.archetype);
            return (
              <article
                key={audience.slot}
                className="grid content-start gap-3 rounded-md border border-border bg-card p-5"
              >
                <div className="font-sans text-[24px] font-semibold tabular-nums text-primary">
                  {audience.slot || String(index + 1).padStart(2, '0')}
                </div>
                {eyebrow ? <DeckLabel>{eyebrow}</DeckLabel> : null}
                <h3 className="text-[17px] font-semibold leading-[1.3] text-foreground">
                  {title}
                </h3>
                <p className="text-[13px] leading-[1.55] text-foreground/90">
                  {scrubReaderText(audience.detail)}
                </p>
                <p className="text-[12px] leading-[1.5] text-muted-foreground">
                  {scrubReaderText(audience.grounding)}
                </p>
                <GapStatusMarker evidencePack={audience.evidencePack} />
                {audience.evidencePack?.status === 'gap' ? (
                  // Ungrounded synthesized row — its dailyBudget is a probe, not a
                  // committed allocation. Never let it read as a confident "$X/day".
                  <div className="mt-auto rounded-md bg-amber-500/10 px-4 py-2 text-center text-[12px] font-semibold leading-[1.4] text-amber-700">
                    {PAID_MEDIA_TEST_BUDGET_LABEL}
                  </div>
                ) : (
                  <div className="mt-auto rounded-md bg-primary/5 px-4 py-2 text-center text-[14px] font-semibold tabular-nums text-primary">
                    {money(audience.dailyBudget)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </DeckPage>

      {/* p5 — angles to test */}
      <DeckPage
        title="Angles to Test"
        subtitle="The messaging bets the first creative round is built on"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {body.anglesToTest.map((angle) => (
            <article
              key={angle.shortName}
              className="grid content-start gap-2 rounded-md border border-border bg-card p-5"
            >
              <DeckLabel>{angle.angleType}</DeckLabel>
              <h3 className="text-[16px] font-semibold leading-[1.3] text-foreground">
                {scrubReaderText(angle.shortName)}
              </h3>
              <p className="text-[13px] leading-[1.55] text-foreground/90">
                {scrubReaderText(angle.description)}
              </p>
              <GapStatusMarker evidencePack={angle.evidencePack} />
            </article>
          ))}
        </div>
      </DeckPage>

      {/* p6 — creative strategy */}
      <DeckPage
        title="Creative Strategy"
        subtitle="Volume and mix per audience for the first test cycle"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <StatTile
            value={numberStatValue(body.creativeStrategy.staticCount)}
            label="Static ads"
            detail="Per audience"
          />
          <StatTile
            value={numberStatValue(body.creativeStrategy.videoCount)}
            label="UGC videos"
            detail="Per audience"
          />
          <StatTile
            value={numberStatValue(body.creativeStrategy.totalPerAudience)}
            label="Creatives total"
            detail="Per audience"
          />
        </div>
        <BodyProse>{scrubReaderText(body.creativeStrategy.prose)}</BodyProse>
      </DeckPage>

      {/* p7 — creative framework */}
      <DeckPage
        title="Creative Framework"
        subtitle="Every creative is built on a defined framework so test results are clear and repeatable"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {staticSlots.length === 0 || ugcSlots.length === 0 ? (
            <article className="grid content-start gap-4 rounded-md border border-border bg-card p-5 md:col-span-2">
              <BannerPill>{body.creativeFramework.length} creative slots</BannerPill>
              <h3 className="text-[16px] font-semibold text-foreground">
                Creative Framework
              </h3>
              <CreativeSlotList slots={body.creativeFramework} showTypeLabels />
              <p className="text-[12px] leading-[1.5] text-muted-foreground">
                {missingCreativeModalityNote(
                  body,
                  ugcSlots.length === 0 ? 'ugc' : 'static',
                )}
              </p>
            </article>
          ) : (
            <>
              <article className="grid content-start gap-4 rounded-md border border-border bg-card p-5">
                <BannerPill>{staticSlots.length} static ads</BannerPill>
                <h3 className="text-[16px] font-semibold text-foreground">
                  Static Creatives
                </h3>
                <CreativeSlotList slots={staticSlots} />
              </article>
              <article className="grid content-start gap-4 rounded-md border border-border bg-card p-5">
                <BannerPill>{ugcSlots.length} UGC videos</BannerPill>
                <h3 className="text-[16px] font-semibold text-foreground">
                  UGC Creatives
                </h3>
                <CreativeSlotList slots={ugcSlots} />
              </article>
            </>
          )}
        </div>
      </DeckPage>

      {/* p8 — funnel ideation */}
      <DeckPage
        title="Funnel Ideation"
        subtitle="Ranked funnel paths and what each one proves"
      >
        <div className="grid gap-3">
          {body.funnelIdeation.map((path) => {
            const badge = funnelRankBadge(path.rank);
            return (
              <article
                key={path.name}
                className="grid gap-2 rounded-md border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.06em]',
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {scrubReaderText(path.name)}
                  </h3>
                </div>
                <p className="text-[13px] leading-[1.55] text-foreground/90">
                  {scrubReaderText(path.description)}
                </p>
                <p className="text-[12px] leading-[1.5] text-muted-foreground">
                  Proves: {scrubReaderText(path.whatItProves)}
                </p>
              </article>
            );
          })}
        </div>
      </DeckPage>

      {/* p9 — projected results */}
      {projectedRowsWithCounts.length > 0 ? (
        <DeckPage
          title="Projected Results"
          subtitle="Count projections shown only where the plan has budget and KPI cost math"
        >
          <div className="grid gap-4">
            {projectedRowsWithCounts.map((row) => {
              const cac = readDeckCustomerCacFields(row);
              const trialLabel =
                cac.costPerTrialLabel ?? 'Cost per qualified trial (signup)';
              return (
                <div key={`${row.targetIcp}-${row.kpi}`} className="grid gap-2">
                  <StatTile
                    value={projectedCountStatValue(row.projectedCountValue)}
                    label={scrubReaderText(row.kpi)}
                    detail={`${scrubReaderText(row.targetIcp)} · KPI cost: ${formatUsdValue(row.kpiCostValue)}`}
                  />
                  {cac.impliedCacValue !== undefined ? (
                    <StatTile
                      value={formatUsdValue(cac.impliedCacValue)}
                      label={trialLabel}
                      detail="Per qualified trial / signup — not paid-customer CAC"
                    />
                  ) : null}
                  {cac.customerCacValue !== undefined ? (
                    <StatTile
                      value={formatUsdValue(cac.customerCacValue)}
                      label="Modeled customer CAC (after trial→paid)"
                      detail="After the trial→paid bridge — compare to your target CAC"
                    />
                  ) : cac.customerCacBandLowValue !== undefined &&
                    cac.customerCacBandHighValue !== undefined ? (
                    <StatTile
                      value={`${formatUsdValue(cac.customerCacBandLowValue)}–${formatUsdValue(cac.customerCacBandHighValue)}`}
                      label="Modeled customer CAC (after trial→paid)"
                      detail="Modeled range — trial→paid rate not disclosed; confirm with client"
                    />
                  ) : null}
                  {row.countBasis ? (
                    <p className="px-1 text-[12px] leading-[1.5] text-muted-foreground">
                      {scrubReaderText(row.countBasis)}
                    </p>
                  ) : null}
                  {row.goalGapNote ? (
                    <p className="border-l-2 border-amber-500/60 px-3 text-[12px] leading-[1.5] text-muted-foreground">
                      {scrubReaderText(row.goalGapNote)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DeckPage>
      ) : null}

      {/* p10 — sales process */}
      {linkedSalesAssets.length > 0 || missingSalesAssets.length > 0 ? (
        <DeckPage
          title="Sales Process"
          subtitle="The follow-up assets the campaign hands leads into"
        >
          {linkedSalesAssets.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {linkedSalesAssets.map((asset) => (
                <article
                  key={asset.label}
                  className="grid content-start gap-1.5 rounded-md bg-primary/5 p-5"
                >
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {asset.label}
                  </h3>
                  <p className="text-[13px] leading-[1.55] text-foreground/90">
                    {scrubReaderText(asset.note)}
                  </p>
                  {asset.url ? (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-medium text-primary hover:underline"
                    >
                      View document
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-primary/5 p-6">
              <h3 className="text-[15px] font-semibold text-foreground">
                Share your sales process to complete this page
              </h3>
              <p className="mt-1.5 max-w-[68ch] text-[13px] leading-[1.6] text-muted-foreground">
                Send over {missingSalesAssets.map((asset) => asset.label).join(', ')}{' '}
                and we will wire the campaign hand-off to the way your team
                actually sells.
              </p>
            </div>
          )}
        </DeckPage>
      ) : null}

      {/* p11 — competitor insights: marketing */}
      {body.competitorMarketingInsights.length > 0 ? (
        <DeckPage
          title="Competitor Insights — Marketing"
          subtitle="How competitors message, position, and package against you"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {body.competitorMarketingInsights.map((insight) => (
              <article
                key={insight.competitor}
                className="grid content-start gap-2.5 rounded-md border border-border bg-card p-5"
              >
                <h3 className="text-[16px] font-semibold text-foreground">
                  {insight.competitor}
                </h3>
                {(
                  [
                    ['Messaging', insight.messaging],
                    ['Ad platforms', insight.adPlatforms],
                    ['ICP', insight.icp],
                    ['Angles', insight.angles],
                    ['Positioning', insight.positioning],
                    ['Offer', insight.offer],
                  ] as const
                ).map(([label, value]) => (
                  <p key={label} className="text-[13px] leading-[1.55]">
                    <span className="font-semibold text-primary">{label}: </span>
                    <span className="text-foreground/90">
                      {scrubReaderText(value)}
                    </span>
                  </p>
                ))}
                <GapStatusMarker evidencePack={insight.evidencePack} />
              </article>
            ))}
          </div>
        </DeckPage>
      ) : null}

      {/* p12 — competitor insights: reviews */}
      {body.competitorReviewInsights.length > 0 ? (
        <DeckPage
          title="Competitor Insights — Reviews"
          subtitle="What their customers complain about, and how this plan uses it"
        >
          <div className="grid gap-3">
            {body.competitorReviewInsights.map((insight) => (
              <article
                key={insight.complaint}
                className="grid gap-1.5 rounded-md border border-border bg-card p-5"
              >
                <p className="text-[14px] font-medium leading-[1.5] text-foreground">
                  {scrubReaderText(insight.complaint)}
                </p>
                <p className="text-[13px] leading-[1.55]">
                  <span className="font-semibold text-primary">
                    How we leverage:{' '}
                  </span>
                  <span className="text-foreground/90">
                    {scrubReaderText(insight.howWeLeverage)}
                  </span>
                </p>
                <GapStatusMarker evidencePack={insight.evidencePack} />
              </article>
            ))}
          </div>
        </DeckPage>
      ) : null}

      {/* p13 — current funnel suggestions (gap rows never render; page is
          omitted entirely if nothing real survives) */}
      {funnelSuggestions.length > 0 ? (
        <DeckPage
          title="Suggestions on Current Funnels"
          subtitle="Quick recommendations on your existing channels — what to fix and what to leave"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {funnelSuggestions.map((suggestion) => (
              <article
                key={suggestion.channel}
                className="grid content-start gap-3 rounded-md border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[16px] font-semibold text-foreground">
                    {suggestion.channel}
                  </h3>
                  <StatusPill tone={verdictTone(suggestion.verdict)}>
                    {suggestion.verdict}
                  </StatusPill>
                </div>
                <p className="text-[13px] leading-[1.55]">
                  <span className="font-semibold text-primary">
                    Recommendation:{' '}
                  </span>
                  <span className="text-foreground/90">
                    {scrubReaderText(suggestion.recommendation)}
                  </span>
                </p>
                <GapStatusMarker evidencePack={suggestion.evidencePack} />
              </article>
            ))}
          </div>
        </DeckPage>
      ) : null}

      {/* p14 — KPIs */}
      <DeckPage
        title="KPIs & Success Metrics"
        subtitle="The core metrics we measure to define success across the campaign"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {body.kpis.map((kpi) => (
            <article
              key={kpi.metric}
              className="grid content-start gap-2 rounded-md bg-primary/5 p-5"
            >
              <div className="font-sans text-[24px] font-semibold leading-none text-primary">
                {scrubReaderText(kpi.metric)}
              </div>
              <div className="text-[13px] font-semibold text-foreground">
                {scrubReaderText(kpi.role)}
              </div>
              <p className="text-[13px] leading-[1.55] text-foreground/90">
                {scrubReaderText(kpi.definition)}
              </p>
            </article>
          ))}
        </div>
      </DeckPage>

      {/* Single assumptions & provenance footnote — the only place in the
          deck where a number's origin is spelled out. */}
      <section className="deck-page rounded-md border border-border bg-muted/20 p-6">
        <h2 className="text-[15px] font-semibold text-foreground">
          Assumptions &amp; provenance
        </h2>
        <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">
          Where each number in this plan comes from.
        </p>
        <ul className="mt-4 grid gap-1.5">
          {collectProvenanceRows(body).map((row) => (
            <li
              key={`${row.label}-${row.display}`}
              className="flex flex-wrap items-baseline gap-x-2 text-[12px] leading-[1.5]"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {row.display}
              </span>
              <span className="text-muted-foreground">· {row.provenance}</span>
            </li>
          ))}
        </ul>
      </section>

      <FeasibilityAuditPanel audit={body.feasibilityAudit} />
    </div>
  );
}
