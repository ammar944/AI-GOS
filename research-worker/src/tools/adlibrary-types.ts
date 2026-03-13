export type WorkerAdPlatform = 'linkedin' | 'meta' | 'google';

export interface WorkerAdCreative {
  platform: WorkerAdPlatform;
  id: string;
  advertiser: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  format: 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown';
  isActive: boolean;
  firstSeen?: string;
  lastSeen?: string;
  platforms?: string[];
  detailsUrl?: string;
}

export interface WorkerLibraryLinks {
  metaLibraryUrl: string;
  linkedInLibraryUrl: string;
  googleAdvertiserUrl?: string;
}

export interface WorkerAdInsight {
  summary: {
    activeAdCount: number;
    platforms: string[];
    themes: string[];
    evidence: string;
    sourceConfidence: 'high' | 'medium' | 'low';
    sampleMessages: string[];
  };
  adCreatives: WorkerAdCreative[];
  libraryLinks: WorkerLibraryLinks;
  sourcesUsed: {
    linkedin: number;
    meta: number;
    google: number;
    foreplay: number;
  };
}
