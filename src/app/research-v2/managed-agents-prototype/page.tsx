import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import {
  CompetitorAdEvidence,
  type CompetitorAdEvidenceProps,
} from "@/components/research/competitor-ad-evidence";

export const dynamic = "force-dynamic";

const LEGACY_ARTIFACT_FILE = join(
  process.cwd(),
  "tmp/managed-agents-competitor-section-canary-1779132163305-artifact.json",
);

const LEGACY_TRANSCRIPT_FILE = join(
  process.cwd(),
  "tmp/managed-agents-competitor-section-canary-success-sesn_01CrNYjjfzSg5CKoHv5Fzmbo-full.json",
);

const AD_EVIDENCE_FILE_PATTERN = /^managed-agents-competitor-section-canary-(\d+)-ad-evidence\.json$/;

interface SourceRecord {
  title: string;
  url: string;
  whyItMatters: string;
}

interface CompetitorCard {
  name: string;
  url: string;
  competitorType: "direct" | "indirect" | "status-quo" | "diy";
  oneLinePositioning: string;
  verbatimHeroCopy: string;
  pricingPosition: string;
  sourceUrl: string;
}

interface PositioningAxis {
  axisName: string;
  ourPosition: string;
  competitorPositions: Array<{
    competitor: string;
    position: string;
  }>;
  evidenceUrl: string;
}

interface PricingDataPoint {
  competitor: string;
  tierName: string;
  monthlyPrice: string;
  packagingPattern: string;
  gatedSignals: string;
  sourceUrl: string;
}

interface ShareOfVoiceSlice {
  surface: string;
  winner: string;
  evidence: string;
  sourceUrl: string;
}

interface PublicWeakness {
  competitor: string;
  verbatimQuote: string;
  source: string;
  sourceUrl: string;
  whyItMatters: string;
}

interface NarrativeArc {
  competitor: string;
  villain: string;
  hero: string;
  transformationClaim: string;
  sourceUrl: string;
}

interface CompetitorLandscapeArtifact {
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  sources: SourceRecord[];
  competitorSet: {
    prose: string;
    competitors: CompetitorCard[];
  };
  positioningTaxonomy: {
    prose: string;
    axes: PositioningAxis[];
  };
  pricingReality: {
    prose: string;
    dataPoints: PricingDataPoint[];
  };
  shareOfVoice: {
    prose: string;
    slices: ShareOfVoiceSlice[];
  };
  publicWeaknesses: {
    prose: string;
    items: PublicWeakness[];
  };
  narrativeArcs: {
    prose: string;
    arcs: NarrativeArc[];
  };
}

interface TranscriptContent {
  type?: string;
  text?: string;
}

interface ManagedAgentEvent {
  type: string;
  id?: string;
  name?: string;
  processed_at?: string;
  input?: unknown;
  content?: TranscriptContent[];
}

interface ManagedAgentTranscript {
  fetchedAt?: string;
  sessionId?: string;
  session?: {
    id?: string;
    status?: string;
  };
  events?: ManagedAgentEvent[];
  transcript?: ManagedAgentEvent[];
}

interface ToolCount {
  name: string;
  count: number;
}

interface CompetitorAdRecord {
  id: string;
  advertiser: string;
  headline: string | null;
  body: string | null;
  landingUrl: string | null;
  creativeUrl: string | null;
  detailsUrl: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  totalDaysShown: number | null;
  format: string | null;
  region: string | null;
}

interface CompetitorAdsResult {
  advertiserName: string;
  advertiserId: string;
  platform: string;
  region: string;
  totalAvailable: number | null;
  returned: number;
  isVerified: boolean | null;
  ads: CompetitorAdRecord[];
}

interface PlatformCounts {
  google: number;
  linkedin: number;
  meta: number;
}

interface ManagedAgentsAdCreative {
  platform: "linkedin" | "meta" | "google";
  id: string;
  advertiser: string;
  headline: string | null;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  format: string;
  isActive: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  detailsUrl: string | null;
}

interface ManagedAgentsRawAdSample {
  platform: "linkedin" | "meta" | "google";
  id: string;
  advertiser: string | null;
  headline: string | null;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  detailsUrl: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  format: string | null;
  dataGap: string | null;
}

interface ManagedAgentsAdEvidenceResult {
  ok: true;
  advertiser_name: string;
  domain: string | null;
  requested_platform: "all" | "linkedin" | "meta" | "google";
  region: "US" | "CA" | "UK" | "AU" | "ALL";
  raw_counts: PlatformCounts;
  displayable_counts: PlatformCounts;
  displayable_total: number;
  returned_creative_count: number;
  adCreatives: ManagedAgentsAdCreative[];
  libraryLinks: {
    metaLibraryUrl?: string;
    linkedInLibraryUrl?: string;
    googleAdvertiserUrl?: string;
  };
  raw_source_samples: ManagedAgentsRawAdSample[];
  data_gaps: string[];
  source_errors: Partial<Record<"linkedin" | "meta" | "google", string>>;
  observed_at: string;
}

interface AdEvidenceSidecar {
  generatedAt: string;
  sessionId?: string;
  args?: {
    company?: string;
    domain?: string;
    model?: string;
    adPlatform?: string;
    adCompetitorCount?: number;
  };
  agent?: {
    id?: string;
    version?: number;
    reused?: boolean;
  };
  skillProbe?: Record<string, unknown>;
  skillWiring?: {
    status?: string;
    evidence?: string;
    reason?: string;
    error?: string;
    skill?: Record<string, unknown>;
  };
  adEvidenceResults: ManagedAgentsAdEvidenceResult[];
}

interface PrototypeFiles {
  artifactFile: string;
  transcriptFile: string;
  adEvidenceFile: string | null;
}

function readJsonFile<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`Managed Agents prototype fixture is missing: ${filePath}`);
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function assertDevelopmentOnly(): void {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
}

function getNewestAdEvidenceFile(): string | null {
  const tmpDir = join(process.cwd(), "tmp");
  if (!existsSync(tmpDir)) {
    return null;
  }

  const candidates = readdirSync(tmpDir)
    .filter((fileName) => AD_EVIDENCE_FILE_PATTERN.test(fileName))
    .map((fileName) => {
      const filePath = join(tmpDir, fileName);
      return {
        filePath,
        modifiedAt: statSync(filePath).mtimeMs,
      };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  return candidates[0]?.filePath ?? null;
}

function getStampFromAdEvidenceFile(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  return basename(filePath).match(AD_EVIDENCE_FILE_PATTERN)?.[1] ?? null;
}

function getPrototypeFiles(): PrototypeFiles {
  const adEvidenceFile = getNewestAdEvidenceFile();
  const stamp = getStampFromAdEvidenceFile(adEvidenceFile);
  const stampedArtifactFile = stamp
    ? join(process.cwd(), `tmp/managed-agents-competitor-section-canary-${stamp}-artifact.json`)
    : null;
  const stampedTranscriptFile = stamp
    ? join(process.cwd(), `tmp/managed-agents-competitor-section-canary-${stamp}.json`)
    : null;

  return {
    artifactFile:
      stampedArtifactFile && existsSync(stampedArtifactFile)
        ? stampedArtifactFile
        : LEGACY_ARTIFACT_FILE,
    transcriptFile:
      stampedTranscriptFile && existsSync(stampedTranscriptFile)
        ? stampedTranscriptFile
        : LEGACY_TRANSCRIPT_FILE,
    adEvidenceFile,
  };
}

function getTranscriptEvents(transcript: ManagedAgentTranscript): ManagedAgentEvent[] {
  return transcript.events ?? transcript.transcript ?? [];
}

function getTranscriptSessionId(transcript: ManagedAgentTranscript, sidecar: AdEvidenceSidecar | null): string {
  return transcript.sessionId ?? transcript.session?.id ?? sidecar?.sessionId ?? "unknown";
}

function getTranscriptFetchedAt(transcript: ManagedAgentTranscript, sidecar: AdEvidenceSidecar | null): string | undefined {
  return transcript.fetchedAt ?? sidecar?.generatedAt;
}

function eventText(event: ManagedAgentEvent): string {
  return event.content
    ?.map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseToolResult(event: ManagedAgentEvent): Record<string, unknown> | null {
  const text = eventText(event);

  if (text.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getBoolean(record: Record<string, unknown> | null, key: string): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function getNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" ? value : null;
}

function getRecord(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = record?.[key];
  return isRecord(value) ? value : null;
}

function getRecordArray(record: Record<string, unknown> | null, key: string): Record<string, unknown>[] {
  const value = record?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function shortText(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function stringifyInput(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  return shortText(JSON.stringify(value, null, 2), 420);
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function getToolCounts(events: ManagedAgentEvent[]): ToolCount[] {
  const counts = events
    .filter((event) => event.type === "agent.custom_tool_use" && event.name)
    .reduce<Record<string, number>>((accumulator, event) => {
      const name = event.name ?? "unknown_tool";
      return {
        ...accumulator,
        [name]: (accumulator[name] ?? 0) + 1,
      };
    }, {});

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getAcceptedSaveResult(events: ManagedAgentEvent[]): Record<string, unknown> | null {
  return events
    .filter((event) => event.type === "user.custom_tool_result")
    .map(parseToolResult)
    .find((result) => getBoolean(result, "accepted") === true) ?? null;
}

function toCompetitorAdRecord(record: Record<string, unknown>): CompetitorAdRecord {
  return {
    id: getString(record, "id") ?? "unknown-ad",
    advertiser: getString(record, "advertiser") ?? "unknown advertiser",
    headline: getString(record, "headline"),
    body: getString(record, "body"),
    landingUrl: getString(record, "landing_url"),
    creativeUrl: getString(record, "creative_url"),
    detailsUrl: getString(record, "details_url"),
    firstSeen: getString(record, "first_seen"),
    lastSeen: getString(record, "last_seen"),
    totalDaysShown: getNumber(record, "total_days_shown"),
    format: getString(record, "format"),
    region: getString(record, "region"),
  };
}

function getCompetitorAdsResult(events: ManagedAgentEvent[]): CompetitorAdsResult | null {
  const result = events
    .filter((event) => event.type === "user.custom_tool_result")
    .map(parseToolResult)
    .find((record) => getString(record, "advertiser_id") && getRecordArray(record, "ads").length > 0);

  if (!result) {
    return null;
  }

  const source = getRecord(result, "source");
  const selectedAdvertiser = getRecord(source, "selected_advertiser");

  return {
    advertiserName: getString(result, "advertiser_name") ?? "unknown advertiser",
    advertiserId: getString(result, "advertiser_id") ?? "unknown-id",
    platform: getString(result, "platform") ?? "unknown",
    region: getString(result, "region") ?? "unknown",
    totalAvailable: getNumber(result, "total_available"),
    returned: getNumber(result, "returned") ?? getRecordArray(result, "ads").length,
    isVerified: getBoolean(selectedAdvertiser, "is_verified"),
    ads: getRecordArray(result, "ads").map(toCompetitorAdRecord),
  };
}

function getRunMessage(events: ManagedAgentEvent[]): string {
  const finalMessage = [...events]
    .reverse()
    .find((event) => event.type === "agent.message" && eventText(event).length > 0);

  return finalMessage ? eventText(finalMessage) : "No final agent message was captured.";
}

function getTimelineEvents(events: ManagedAgentEvent[]): ManagedAgentEvent[] {
  return events.filter((event) =>
    event.type === "agent.message" ||
    event.type === "agent.custom_tool_use" ||
    event.type === "user.custom_tool_result" ||
    event.type === "session.status_idle" ||
    event.type === "session.status_running"
  );
}

function getEventTitle(event: ManagedAgentEvent): string {
  if (event.type === "agent.custom_tool_use") {
    return event.name ?? "custom tool";
  }

  if (event.type === "user.custom_tool_result") {
    const result = parseToolResult(event);
    const ok = getBoolean(result, "ok");
    const accepted = getBoolean(result, "accepted");
    const attempt = getNumber(result, "attempt");

    if (accepted === true) {
      return `save accepted${attempt ? ` on attempt ${attempt}` : ""}`;
    }

    if (ok === false) {
      return `tool result rejected${attempt ? ` on attempt ${attempt}` : ""}`;
    }

    return "tool result";
  }

  if (event.type === "agent.message") {
    return "agent message";
  }

  return event.type;
}

function getEventBody(event: ManagedAgentEvent): string {
  if (event.type === "agent.custom_tool_use") {
    return stringifyInput(event.input);
  }

  if (event.type === "user.custom_tool_result") {
    const result = parseToolResult(event);
    const repairFeedback = getString(result, "repair_feedback");
    const query = getString(result, "query");
    const companyName = getString(result, "company_name");

    if (repairFeedback) {
      return shortText(repairFeedback, 360);
    }

    if (query) {
      return `Query: ${query}`;
    }

    if (companyName) {
      return `Company: ${companyName}`;
    }

    return shortText(eventText(event), 360);
  }

  return shortText(eventText(event), 360);
}

function getEventTone(event: ManagedAgentEvent): string {
  if (event.type === "agent.custom_tool_use") {
    return "border-l-[#2563eb]";
  }

  if (event.type === "user.custom_tool_result") {
    const result = parseToolResult(event);
    return getBoolean(result, "accepted") === true ? "border-l-[#059669]" : "border-l-[#d97706]";
  }

  return "border-l-[#6b7280]";
}

function countTotal(counts: PlatformCounts): number {
  return counts.google + counts.linkedin + counts.meta;
}

function formatCounts(counts: PlatformCounts): string {
  return `Google ${counts.google} / LinkedIn ${counts.linkedin} / Meta ${counts.meta}`;
}

function platformLabel(platform: "linkedin" | "meta" | "google"): string {
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "meta") return "Meta";
  return "Google";
}

type UiAdCreative = NonNullable<CompetitorAdEvidenceProps["adCreatives"]>[number];

function toUiFormat(value: string): UiAdCreative["format"] {
  if (
    value === "video" ||
    value === "image" ||
    value === "carousel" ||
    value === "text" ||
    value === "message" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function toUiAdCreative(creative: ManagedAgentsAdCreative): UiAdCreative {
  return {
    platform: creative.platform,
    id: creative.id,
    advertiser: creative.advertiser,
    headline: creative.headline ?? undefined,
    body: creative.body ?? undefined,
    imageUrl: creative.imageUrl ?? undefined,
    videoUrl: creative.videoUrl ?? undefined,
    format: toUiFormat(creative.format),
    isActive: creative.isActive,
    firstSeen: creative.firstSeen ?? undefined,
    lastSeen: creative.lastSeen ?? undefined,
    detailsUrl: creative.detailsUrl ?? undefined,
  };
}

function toAdEvidenceProps(result: ManagedAgentsAdEvidenceResult): CompetitorAdEvidenceProps {
  const platformNames = (Object.entries(result.displayable_counts) as Array<[
    "google" | "linkedin" | "meta",
    number,
  ]>)
    .filter(([, count]) => count > 0)
    .map(([platform]) => platformLabel(platform));
  const rawTotal = countTotal(result.raw_counts);

  return {
    adActivity: {
      activeAdCount: result.displayable_total,
      platforms: platformNames,
      themes: [],
      evidence: `${rawTotal} raw ad-library rows; ${result.displayable_total} displayable creatives.`,
      sourceConfidence: result.displayable_total > 0 ? "medium" : "low",
    },
    adCreatives: result.adCreatives.map(toUiAdCreative),
    libraryLinks: result.libraryLinks,
  };
}

function summarizeSkillWiring(sidecar: AdEvidenceSidecar | null): string {
  const status = sidecar?.skillWiring?.status ?? "not captured";
  if (status === "attached") {
    return "AI-GOS competitive-positioning skill attached to this Managed Agent.";
  }
  if (status === "blocked") {
    return `Skill attachment blocked: ${sidecar?.skillWiring?.error ?? "unknown error"}`;
  }
  if (status === "not_requested") {
    return sidecar?.skillWiring?.reason ?? "Skill attachment was not requested.";
  }
  return "Skill wiring was not captured for this replay.";
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}): ReactElement {
  return (
    <div className="border border-[#d9dde7] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#111827]">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-[#667085]">{detail}</div> : null}
    </div>
  );
}

function SectionHeader({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
}): ReactElement {
  return (
    <div className="mb-4">
      {eyebrow ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]">{eyebrow}</div>
      ) : null}
      <h2 className="mt-1 text-lg font-semibold text-[#111827]">{title}</h2>
    </div>
  );
}

function CardGrid({ children }: { children: ReactElement | ReactElement[] }): ReactElement {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function CountStrip({ counts }: { counts: PlatformCounts }): ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.entries(counts) as Array<["google" | "linkedin" | "meta", number]>).map(([platform, count]) => (
        <div key={platform} className="border border-[#eceff5] bg-[#fbfcfe] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667085]">
            {platformLabel(platform)}
          </div>
          <div className="mt-1 text-lg font-semibold text-[#111827]">{count}</div>
        </div>
      ))}
    </div>
  );
}

function AdEvidenceGroup({ result }: { result: ManagedAgentsAdEvidenceResult }): ReactElement {
  const adEvidenceProps = toAdEvidenceProps(result);
  const hasDisplayableCreatives = result.returned_creative_count > 0;
  const googleRawSamples = result.raw_source_samples.filter((sample) => sample.platform === "google");

  return (
    <div className="border border-[#d9dde7] bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]">
            {result.requested_platform} / {result.region}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-[#111827]">{result.advertiser_name}</h3>
          <div className="mt-1 text-xs text-[#667085]">
            {result.domain ?? "domain not supplied"} / observed {formatTimestamp(result.observed_at)}
          </div>
        </div>
        <div className="text-sm leading-6 text-[#344054]">
          <span className="font-semibold text-[#111827]">{result.returned_creative_count}</span> returned creatives
          <span className="mx-2 text-[#98a2b3]">/</span>
          <span className="font-semibold text-[#111827]">{result.displayable_total}</span> displayable total
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Raw source counts</div>
          <CountStrip counts={result.raw_counts} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Displayable creative counts</div>
          <CountStrip counts={result.displayable_counts} />
        </div>
      </div>

      {result.data_gaps.length > 0 ? (
        <div className="mt-5 border-l-2 border-[#d97706] pl-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#92400e]">Sparse or missing fields</div>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-[#344054]">
            {result.data_gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasDisplayableCreatives ? (
        <CompetitorAdEvidence {...adEvidenceProps} />
      ) : (
        <div className="mt-5 border border-[#eceff5] bg-[#fbfcfe] px-4 py-3 text-sm leading-6 text-[#475467]">
          No displayable ad creatives were returned for this advertiser. Library links are still shown when SearchAPI can form them.
          <CompetitorAdEvidence {...adEvidenceProps} />
        </div>
      )}

      {googleRawSamples.length > 0 ? (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Google raw transparency samples</div>
          <div className="grid gap-2 md:grid-cols-2">
            {googleRawSamples.slice(0, 4).map((sample) => (
              <div key={`${sample.platform}-${sample.id}`} className="border border-[#eceff5] bg-[#fbfcfe] px-3 py-2 text-xs leading-5 text-[#475467]">
                <div className="font-mono text-[#111827]">{sample.id}</div>
                <div>Headline: {sample.headline ?? "not returned"}</div>
                <div>Body: {sample.body ?? "not returned"}</div>
                {sample.detailsUrl ? (
                  <a className="font-semibold text-[#0f766e]" href={sample.detailsUrl}>
                    Details
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MultiPlatformAdEvidenceSection({
  sidecar,
}: {
  sidecar: AdEvidenceSidecar;
}): ReactElement {
  const rawTotals = sidecar.adEvidenceResults.reduce<PlatformCounts>((counts, result) => ({
    google: counts.google + result.raw_counts.google,
    linkedin: counts.linkedin + result.raw_counts.linkedin,
    meta: counts.meta + result.raw_counts.meta,
  }), { google: 0, linkedin: 0, meta: 0 });
  const displayableTotals = sidecar.adEvidenceResults.reduce<PlatformCounts>((counts, result) => ({
    google: counts.google + result.displayable_counts.google,
    linkedin: counts.linkedin + result.displayable_counts.linkedin,
    meta: counts.meta + result.displayable_counts.meta,
  }), { google: 0, linkedin: 0, meta: 0 });

  return (
    <section className="py-8">
      <SectionHeader title="Multi-Platform Ad Evidence" eyebrow="ad creatives" />
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Metric
          label="Advertisers"
          value={String(sidecar.adEvidenceResults.length)}
          detail="Audited company plus direct competitors requested by the Managed Agent."
        />
        <Metric
          label="Raw counts"
          value={String(countTotal(rawTotals))}
          detail={formatCounts(rawTotals)}
        />
        <Metric
          label="Displayable"
          value={String(countTotal(displayableTotals))}
          detail={formatCounts(displayableTotals)}
        />
      </div>
      <div className="space-y-4">
        {sidecar.adEvidenceResults.map((result) => (
          <AdEvidenceGroup key={`${result.advertiser_name}-${result.observed_at}`} result={result} />
        ))}
      </div>
    </section>
  );
}

export default function ManagedAgentsPrototypePage(): ReactElement {
  assertDevelopmentOnly();

  const files = getPrototypeFiles();
  const artifact = readJsonFile<CompetitorLandscapeArtifact>(files.artifactFile);
  const transcript = readJsonFile<ManagedAgentTranscript>(files.transcriptFile);
  const adEvidenceSidecar = files.adEvidenceFile
    ? readJsonFile<AdEvidenceSidecar>(files.adEvidenceFile)
    : null;
  const transcriptEvents = getTranscriptEvents(transcript);
  const acceptedSave = getAcceptedSaveResult(transcriptEvents);
  const timelineEvents = getTimelineEvents(transcriptEvents);
  const finalMessage = getRunMessage(transcriptEvents);
  const toolCounts = getToolCounts(transcriptEvents);
  const competitorAds = adEvidenceSidecar ? null : getCompetitorAdsResult(transcriptEvents);
  const displayCompany = adEvidenceSidecar?.args?.company ?? "monday.com";
  const adEvidenceCount = adEvidenceSidecar?.adEvidenceResults.length ?? 0;

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#111827]">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-10">
        <header className="border-b border-[#d9dde7] pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]">
                Managed Agents replay
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[0] text-[#111827]">
                Section 03 competitor run for {displayCompany}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475467]">
                This page replays one saved Claude Managed Agents session, its accepted
                Competitor Landscape artifact, and any sidecar ad evidence. It does not start a new run.
              </p>
            </div>
            <div className="grid gap-2 text-xs text-[#475467] lg:min-w-[440px]">
              <div className="flex justify-between gap-4 border border-[#d9dde7] bg-white px-3 py-2">
                <span>Session</span>
                <span className="font-mono text-[#111827]">{getTranscriptSessionId(transcript, adEvidenceSidecar)}</span>
              </div>
              <div className="flex justify-between gap-4 border border-[#d9dde7] bg-white px-3 py-2">
                <span>Status</span>
                <span className="font-mono text-[#111827]">{transcript.session?.status ?? "unknown"}</span>
              </div>
              <div className="flex justify-between gap-4 border border-[#d9dde7] bg-white px-3 py-2">
                <span>Fetched</span>
                <span className="font-mono text-[#111827]">{formatTimestamp(getTranscriptFetchedAt(transcript, adEvidenceSidecar))}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Agent events" value={String(transcriptEvents.length)} detail="Captured from the Managed Agents session event log." />
          <Metric label="Custom tool calls" value={String(toolCounts.reduce((sum, item) => sum + item.count, 0))} detail="Local SearchAPI-backed tools plus the save validator." />
          <Metric label="Sources" value={String(artifact.sources.length)} detail="Source records persisted in the final artifact." />
          <Metric
            label="Ad evidence"
            value={String(adEvidenceSidecar ? adEvidenceCount : competitorAds?.returned ?? 0)}
            detail={adEvidenceSidecar ? "Advertiser groups in the latest multi-platform sidecar." : "Rows returned by Google Ads Transparency via SearchAPI."}
          />
          <Metric label="Confidence" value={`${artifact.confidence}/10`} detail="Self-rating from the accepted artifact." />
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <div className="border border-[#d9dde7] bg-white p-5">
              <SectionHeader title="Skill Wiring Status" eyebrow="current truth" />
              <div className="space-y-3 text-sm leading-6 text-[#344054]">
                <p>
                  {summarizeSkillWiring(adEvidenceSidecar)}
                </p>
                <p>
                  Skill source path:{" "}
                  <span className="font-mono text-xs text-[#111827]">
                    research-worker/platform-skills/ai-gos-competitive-positioning/SKILL.md
                  </span>
                </p>
                <p>
                  The replay uses local custom tools for SearchAPI calls and the real TypeScript schema/minimum validator.
                </p>
              </div>
            </div>

            <div className="border border-[#d9dde7] bg-white p-5">
              <SectionHeader title="Tool Calls" eyebrow="what created it" />
              <div className="space-y-2">
                {toolCounts.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-4 border border-[#eceff5] px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-[#344054]">{item.name}</span>
                    <span className="font-semibold text-[#111827]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#d9dde7] bg-white p-5">
              <SectionHeader title="Validation" eyebrow="save gate" />
              <div className="space-y-2 text-sm leading-6 text-[#344054]">
                <div className="flex justify-between gap-4">
                  <span>Accepted</span>
                  <span className="font-mono text-[#111827]">{String(getBoolean(acceptedSave, "accepted"))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Schema ok</span>
                  <span className="font-mono text-[#111827]">{String(getBoolean(acceptedSave, "schema_ok"))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Minimums ok</span>
                  <span className="font-mono text-[#111827]">{String(getBoolean(acceptedSave, "minimums_ok"))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Attempt</span>
                  <span className="font-mono text-[#111827]">{String(getNumber(acceptedSave, "attempt"))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[#d9dde7] bg-white p-5">
            <SectionHeader title="Run Timeline" eyebrow="managed agent event stream" />
            <div className="max-h-[720px] space-y-3 overflow-auto pr-1">
              {timelineEvents.map((event, index) => (
                <div
                  key={`${event.type}-${event.id ?? index}`}
                  className={`border border-[#eceff5] border-l-4 ${getEventTone(event)} bg-[#fbfcfe] px-4 py-3`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[#111827]">{getEventTitle(event)}</div>
                    <div className="font-mono text-[11px] text-[#667085]">{formatTimestamp(event.processed_at)}</div>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#475467]">
                    {getEventBody(event)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </section>

        {adEvidenceSidecar ? (
          <MultiPlatformAdEvidenceSection sidecar={adEvidenceSidecar} />
        ) : null}

        {!adEvidenceSidecar && competitorAds ? (
          <section className="py-8">
            <SectionHeader title="Observed Competitor Ads" eyebrow="google ads transparency" />
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <div className="border border-[#d9dde7] bg-white p-5">
                <div className="space-y-3 text-sm leading-6 text-[#344054]">
                  <div className="flex justify-between gap-4">
                    <span>Advertiser</span>
                    <span className="font-semibold text-[#111827]">{competitorAds.advertiserName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Advertiser ID</span>
                    <span className="font-mono text-xs text-[#111827]">{competitorAds.advertiserId}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Verified</span>
                    <span className="font-mono text-[#111827]">{String(competitorAds.isVerified)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Platform / region</span>
                    <span className="font-mono text-[#111827]">{competitorAds.platform} / {competitorAds.region}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Returned</span>
                    <span className="font-mono text-[#111827]">
                      {competitorAds.returned} of {competitorAds.totalAvailable ?? "unknown"}
                    </span>
                  </div>
                </div>
                <p className="mt-5 border-l-2 border-[#d97706] pl-3 text-sm leading-6 text-[#344054]">
                  These are observed ad records, not generated ad copy. Google Ads Transparency returned IDs,
                  timing, and detail links, but no headline, body, or landing URL fields for these rows.
                </p>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {competitorAds.ads.map((ad) => (
                  <div key={ad.id} className="border border-[#d9dde7] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#111827]">{ad.advertiser}</div>
                        <div className="mt-1 font-mono text-[11px] text-[#667085]">{ad.id}</div>
                      </div>
                      <div className="border border-[#d9dde7] px-2 py-1 text-[11px] font-semibold uppercase text-[#475467]">
                        {ad.format ?? "unknown"}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm leading-6 text-[#344054]">
                      <div>
                        <span className="font-semibold text-[#111827]">Headline: </span>
                        <span>{ad.headline ?? "not returned"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-[#111827]">Body: </span>
                        <span>{ad.body ?? "not returned"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-[#111827]">Landing URL: </span>
                        <span>{ad.landingUrl ?? "not returned"}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 border-t border-[#eceff5] pt-3 text-xs leading-5 text-[#667085]">
                      <div>First seen: {formatTimestamp(ad.firstSeen ?? undefined)}</div>
                      <div>Last seen: {formatTimestamp(ad.lastSeen ?? undefined)}</div>
                      <div>Total days shown: {ad.totalDaysShown ?? "unknown"}</div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {ad.detailsUrl ? (
                        <a className="border border-[#d9dde7] px-3 py-2 text-xs font-semibold text-[#0f766e] hover:border-[#0f766e]" href={ad.detailsUrl}>
                          Details
                        </a>
                      ) : null}
                      {ad.creativeUrl ? (
                        <a className="border border-[#d9dde7] px-3 py-2 text-xs font-semibold text-[#0f766e] hover:border-[#0f766e]" href={ad.creativeUrl}>
                          Creative asset
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="py-8">
          <SectionHeader title={artifact.sectionTitle} eyebrow="accepted artifact" />
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="border border-[#d9dde7] bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">Verdict</div>
              <p className="mt-2 text-base leading-7 text-[#111827]">{artifact.verdict}</p>
              <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">Status summary</div>
              <p className="mt-2 text-sm leading-6 text-[#344054]">{artifact.statusSummary}</p>
            </div>
            <div className="border border-[#d9dde7] bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">Final agent message</div>
              <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#344054]">
                {finalMessage}
              </pre>
            </div>
          </div>
        </section>

        <section className="space-y-7 pb-10">
          <div>
            <SectionHeader title="Competitor Set" />
            <p className="mb-4 max-w-5xl text-sm leading-6 text-[#344054]">{artifact.competitorSet.prose}</p>
            <CardGrid>
              {artifact.competitorSet.competitors.map((competitor) => (
                <div key={competitor.name} className="border border-[#d9dde7] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-base font-semibold text-[#111827]">{competitor.name}</div>
                    <div className="border border-[#d9dde7] px-2 py-1 text-[11px] font-semibold uppercase text-[#475467]">
                      {competitor.competitorType}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#344054]">{competitor.oneLinePositioning}</p>
                  <p className="mt-3 border-l-2 border-[#0f766e] pl-3 text-sm leading-6 text-[#111827]">
                    {competitor.verbatimHeroCopy}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-[#667085]">{competitor.pricingPosition}</p>
                </div>
              ))}
            </CardGrid>
          </div>

          <div>
            <SectionHeader title="Positioning Axes" />
            <p className="mb-4 max-w-5xl text-sm leading-6 text-[#344054]">{artifact.positioningTaxonomy.prose}</p>
            <CardGrid>
              {artifact.positioningTaxonomy.axes.map((axis) => (
                <div key={axis.axisName} className="border border-[#d9dde7] bg-white p-4">
                  <div className="text-base font-semibold text-[#111827]">{axis.axisName}</div>
                  <p className="mt-2 text-sm leading-6 text-[#344054]">{axis.ourPosition}</p>
                  <div className="mt-3 space-y-2">
                    {axis.competitorPositions.map((position) => (
                      <div key={`${axis.axisName}-${position.competitor}`} className="border border-[#eceff5] px-3 py-2 text-xs leading-5">
                        <span className="font-semibold text-[#111827]">{position.competitor}: </span>
                        <span className="text-[#475467]">{position.position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardGrid>
          </div>

          <div>
            <SectionHeader title="Pricing Reality" />
            <p className="mb-4 max-w-5xl text-sm leading-6 text-[#344054]">{artifact.pricingReality.prose}</p>
            <CardGrid>
              {artifact.pricingReality.dataPoints.map((point) => (
                <div key={`${point.competitor}-${point.tierName}`} className="border border-[#d9dde7] bg-white p-4">
                  <div className="text-base font-semibold text-[#111827]">{point.competitor}</div>
                  <div className="mt-2 text-sm font-semibold text-[#0f766e]">{point.monthlyPrice}</div>
                  <p className="mt-2 text-sm leading-6 text-[#344054]">{point.packagingPattern}</p>
                  <p className="mt-3 text-xs leading-5 text-[#667085]">{point.gatedSignals}</p>
                </div>
              ))}
            </CardGrid>
          </div>

          <div>
            <SectionHeader title="Share Of Voice" />
            <p className="mb-4 max-w-5xl text-sm leading-6 text-[#344054]">{artifact.shareOfVoice.prose}</p>
            <CardGrid>
              {artifact.shareOfVoice.slices.map((slice) => (
                <div key={`${slice.surface}-${slice.winner}`} className="border border-[#d9dde7] bg-white p-4">
                  <div className="text-sm font-semibold text-[#111827]">{slice.surface}</div>
                  <div className="mt-2 text-sm font-semibold text-[#0f766e]">{slice.winner}</div>
                  <p className="mt-2 text-sm leading-6 text-[#344054]">{slice.evidence}</p>
                </div>
              ))}
            </CardGrid>
          </div>

          <div>
            <SectionHeader title="Public Weaknesses" />
            <p className="mb-4 max-w-5xl text-sm leading-6 text-[#344054]">{artifact.publicWeaknesses.prose}</p>
            <CardGrid>
              {artifact.publicWeaknesses.items.map((item) => (
                <div key={`${item.competitor}-${item.verbatimQuote}`} className="border border-[#d9dde7] bg-white p-4">
                  <div className="text-base font-semibold text-[#111827]">{item.competitor}</div>
                  <p className="mt-3 border-l-2 border-[#d97706] pl-3 text-sm leading-6 text-[#111827]">{item.verbatimQuote}</p>
                  <p className="mt-3 text-xs leading-5 text-[#667085]">{item.whyItMatters}</p>
                </div>
              ))}
            </CardGrid>
          </div>

          <div>
            <SectionHeader title="Narrative Arcs" />
            <p className="mb-4 max-w-5xl text-sm leading-6 text-[#344054]">{artifact.narrativeArcs.prose}</p>
            <CardGrid>
              {artifact.narrativeArcs.arcs.map((arc) => (
                <div key={arc.competitor} className="border border-[#d9dde7] bg-white p-4">
                  <div className="text-base font-semibold text-[#111827]">{arc.competitor}</div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-[#344054]">
                    <p><span className="font-semibold text-[#111827]">Villain:</span> {arc.villain}</p>
                    <p><span className="font-semibold text-[#111827]">Hero:</span> {arc.hero}</p>
                    <p><span className="font-semibold text-[#111827]">Transformation:</span> {arc.transformationClaim}</p>
                  </div>
                </div>
              ))}
            </CardGrid>
          </div>

          <div>
            <SectionHeader title="Sources" />
            <div className="grid gap-2 md:grid-cols-2">
              {artifact.sources.map((source) => (
                <a
                  key={`${source.title}-${source.url}`}
                  href={source.url}
                  className="border border-[#d9dde7] bg-white p-3 text-sm leading-6 text-[#344054] hover:border-[#0f766e]"
                >
                  <div className="font-semibold text-[#111827]">{source.title}</div>
                  <div className="break-words font-mono text-[11px] text-[#0f766e]">{source.url}</div>
                  <div className="mt-1 text-xs leading-5 text-[#667085]">{source.whyItMatters}</div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
