export type BuyerICPPersonaRole =
  | 'champion'
  | 'economic-buyer'
  | 'decision-maker'
  | 'influencer'
  | 'end-user'
  | 'gatekeeper';

export type BuyerICPFirmographicCutType =
  | 'industry'
  | 'employeeBands'
  | 'revenueBands'
  | 'geography'
  | 'techStack';

export type BuyerICPAwarenessLevel =
  | 'unaware'
  | 'problem-aware'
  | 'solution-aware'
  | 'product-aware'
  | 'most-aware';

export type BuyerICPTriggerWindow = 'immediate' | 'weeks' | 'quarters';

export type BuyerICPClusterBucketType =
  | 'community'
  | 'newsletter'
  | 'conference'
  | 'podcast'
  | 'slack-group'
  | 'event';

export interface BuyerICPSource {
  title: string;
  url: string;
  whyItMatters?: string;
  accessedAt?: string;
}

export interface FirmographicCut {
  cutType: BuyerICPFirmographicCutType;
  value: string;
  accountCount?: string;
  source: string;
  sourceUrl: string;
  dateObserved: string;
}

export interface Persona {
  name: string;
  title: string;
  company: string;
  sourceUrl: string;
  role: BuyerICPPersonaRole;
  seniority: string;
  teamSize?: string;
  evidence: string;
}

export interface AwarenessLevelCard {
  level: BuyerICPAwarenessLevel;
  share: string;
  evidence: string;
  sampleQuery?: string;
}

export interface TriggerCard {
  name: string;
  detectionSignal: string;
  window: BuyerICPTriggerWindow;
  evidence: string;
  sourceUrl?: string;
}

export interface ClusterVenue {
  bucketType: BuyerICPClusterBucketType;
  name: string;
  audienceSize: string;
  sourceUrl: string;
  whyItMatters: string;
}

export interface BuyerICPSubSection<TCard> {
  prose: string;
  cards: TCard[];
}

export interface IcpExistenceCheckSubSection {
  prose: string;
  firmographicCuts: FirmographicCut[];
}

export interface PersonaRealitySubSection {
  prose: string;
  personas: Persona[];
}

export interface AwarenessDistributionSubSection {
  prose: string;
  levels: AwarenessLevelCard[];
}

export interface BuyingContextSubSection {
  prose: string;
  triggers: TriggerCard[];
}

export interface ClustersSubSection {
  prose: string;
  venues: ClusterVenue[];
}

export interface BuyerICPArtifact {
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  sources: BuyerICPSource[];
  icpExistenceCheck: IcpExistenceCheckSubSection;
  personaReality: PersonaRealitySubSection;
  awarenessDistribution: AwarenessDistributionSubSection;
  buyingContext: BuyingContextSubSection;
  clusters: ClustersSubSection;
}
