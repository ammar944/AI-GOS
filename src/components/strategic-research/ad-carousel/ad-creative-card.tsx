"use client";

import * as React from "react";
import { ImageOff, ExternalLink, Play, Video, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnrichedAdCreative } from "@/lib/foreplay/types";
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  RELEVANCE_COLORS,
  FORMAT_LABELS,
  getSmartButtonLabel,
  formatDate,
} from "./constants";
import { AdImage } from "./ad-image";

interface AdCreativeCardProps {
  ad: EnrichedAdCreative;
}

export function AdCreativeCard({ ad }: AdCreativeCardProps) {
  const platformColor = PLATFORM_COLORS[ad.platform];
  const platformLabel = PLATFORM_LABELS[ad.platform];
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  // Relevance info
  const relevance = ad.relevance;
  const relevanceScore = relevance?.score ?? 50;
  const relevanceCategory = relevance?.category ?? 'unclear';
  const relevanceColor = RELEVANCE_COLORS[relevanceCategory];
  const isLowRelevance = relevanceScore < 40;

  // Foreplay enrichment info
  const hasEnrichment = !!ad.foreplay;

  // Handle play button click
  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle video error
  const handleVideoError = () => {
    setVideoError(true);
  };

  // Determine what media to show
  const hasVideo = ad.videoUrl && !videoError;
  const hasImage = ad.imageUrl;

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden transition-all",
        isLowRelevance
          ? "ring-2 ring-amber-500/50"
          : hasEnrichment
            ? "ring-1 ring-[var(--accent-blue)]/30"
            : "ring-1 ring-[var(--border-default)]"
      )}
      style={{
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* Media Section - Handles video, image, and text ads */}
      <div
        className="aspect-[4/3] relative flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        {/* TEXT/MESSAGE AD - Show message preview instead of image */}
        {(ad.format === 'text' || ad.format === 'message') && !hasVideo ? (
          <div className="w-full h-full p-6 flex flex-col justify-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
            {/* LinkedIn-style message preview */}
            <div className="max-w-md mx-auto space-y-4">
              {/* Sender info if available */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-semibold text-sm">
                  {ad.advertiser?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {ad.advertiser}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Sponsored
                  </p>
                </div>
              </div>

              {/* Message content preview */}
              {ad.headline && (
                <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--text-heading)' }}>
                  {ad.headline}
                </p>
              )}
              {ad.body && (
                <p className="text-sm leading-relaxed line-clamp-6" style={{ color: 'var(--text-secondary)' }}>
                  {ad.body}
                </p>
              )}

              {/* Message indicator */}
              <div className="flex items-center gap-2 pt-2" style={{ color: 'var(--text-tertiary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-xs">Sponsored InMail / Message Ad</span>
              </div>
            </div>
          </div>
        ) : hasVideo ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={ad.videoUrl}
              poster={ad.imageUrl}
              preload="metadata"
              controls={isPlaying}
              className="w-full h-full object-contain bg-black"
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors group"
                aria-label="Play video"
              >
                <div className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="h-10 w-10 text-gray-900 ml-1" fill="currentColor" />
                </div>
              </button>
            )}
          </div>
        ) : hasImage && !imageError ? (
          <div className="relative w-full h-full">
            <AdImage
              src={ad.imageUrl!}
              alt={ad.headline || ad.advertiser || "Ad Creative"}
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-8" style={{ color: 'var(--text-tertiary)' }}>
            <ImageOff className="h-16 w-16" />
            <span className="text-sm font-medium">No preview available</span>
          </div>
        )}

        {/* Platform Badge - Top Left */}
        <div className={cn(
          "absolute top-4 left-4 px-3 py-1.5 rounded-lg text-sm font-semibold backdrop-blur-md shadow-lg",
          platformColor.solid,
          "text-white"
        )}>
          {platformLabel}
        </div>

        {/* Format & Source Badges - Top Right */}
        <div className="absolute top-4 right-4 flex gap-2">
          {ad.source === 'foreplay' && (
            <Badge className="bg-cyan-500 text-white border-none backdrop-blur-md shadow-lg text-xs px-2.5 py-1">
              Foreplay
            </Badge>
          )}
          {ad.format && ad.format !== "unknown" && (
            <Badge
              className="backdrop-blur-md shadow-lg text-xs px-2.5 py-1"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                border: 'none'
              }}
            >
              {FORMAT_LABELS[ad.format]}
            </Badge>
          )}
        </div>

        {/* Enriched Indicator - Bottom Right */}
        {hasEnrichment && (
          <div
            className="absolute bottom-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md shadow-lg"
            style={{ backgroundColor: 'var(--accent-blue)' }}
            title="Foreplay Enriched"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="m2 17 10 5 10-5" />
              <path d="m2 12 10 5 10-5" />
            </svg>
          </div>
        )}

        {/* Active Status - Bottom Left */}
        {ad.isActive && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-md shadow-lg bg-green-500/90 text-white text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Active
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-4">
        {/* Header: Advertiser & Relevance */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {ad.advertiser && (
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-tertiary)' }}>
                {ad.advertiser}
              </p>
            )}
          </div>
          {relevance && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0",
                relevanceColor.bg,
                relevanceColor.text
              )}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {relevanceColor.label}
              <span className="opacity-70 ml-0.5">{relevanceScore}</span>
            </div>
          )}
        </div>

        {/* Headline - don't repeat for text/message ads since it's in the preview */}
        {ad.headline && ad.format !== 'text' && ad.format !== 'message' && (
          <h3 className="text-lg font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-heading)' }}>
            {ad.headline}
          </h3>
        )}

        {/* Body Text - don't repeat for text/message ads since it's in the preview */}
        {ad.body && ad.format !== 'text' && ad.format !== 'message' && (
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
            {ad.body}
          </p>
        )}

        {/* Expandable Details Section */}
        {(hasEnrichment || relevance) && (
          <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between py-2 group"
            >
              <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {hasEnrichment ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="m2 17 10 5 10-5" />
                      <path d="m2 12 10 5 10-5" />
                    </svg>
                    <span style={{ color: 'var(--accent-blue)' }}>View Intelligence & Details</span>
                  </>
                ) : (
                  'View Details'
                )}
              </span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 transition-transform",
                  showDetails && "rotate-180"
                )}
                style={{ color: 'var(--text-tertiary)' }}
              />
            </button>

            {showDetails && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Relevance Explanation */}
                {relevance && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-hover)' }}
                  >
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      Relevance Analysis
                    </p>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {relevance.explanation}
                    </p>
                    {relevance.signals && relevance.signals.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {relevance.signals.map((signal, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md text-xs"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-tertiary)'
                            }}
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Foreplay Intelligence */}
                {hasEnrichment && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: 'rgba(54, 94, 255, 0.05)' }}
                  >
                    <p className="text-xs font-medium mb-3" style={{ color: 'var(--accent-blue)' }}>
                      Foreplay Intelligence
                    </p>

                    {/* Hook Analysis */}
                    {ad.foreplay?.hook && (
                      <div className="mb-4">
                        <p className="text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Hook</p>
                        <p className="text-sm italic mb-2" style={{ color: 'var(--text-primary)' }}>
                          &ldquo;{ad.foreplay.hook.text}&rdquo;
                        </p>
                        <div className="flex gap-2">
                          <span className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>
                            {ad.foreplay.hook.type}
                          </span>
                          <span
                            className="px-2.5 py-1 rounded-md text-xs"
                            style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                          >
                            {ad.foreplay.hook.duration}s
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Emotional Tone */}
                    {ad.foreplay?.emotional_tone && ad.foreplay.emotional_tone.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Emotional Tone</p>
                        <div className="flex flex-wrap gap-2">
                          {ad.foreplay.emotional_tone.map((tone, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: 'var(--accent-cyan)', color: 'white' }}
                            >
                              {tone}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcript Preview */}
                    {ad.foreplay?.transcript && (
                      <div className="mb-4">
                        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Transcript</p>
                        <p
                          className="text-xs line-clamp-4 p-3 rounded-lg"
                          style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                        >
                          {ad.foreplay.transcript}
                        </p>
                      </div>
                    )}

                    {/* Match Confidence */}
                    {ad.foreplay?.match_confidence && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Match confidence: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{(ad.foreplay.match_confidence * 100).toFixed(0)}%</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Dates */}
                {(ad.firstSeen || ad.lastSeen) && (
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {ad.firstSeen && <span>First seen: {formatDate(ad.firstSeen)}</span>}
                    {ad.lastSeen && <span>Last seen: {formatDate(ad.lastSeen)}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {ad.detailsUrl && (
            <Button
              asChild
              size="lg"
              className="flex-1 text-sm h-11"
              style={{
                backgroundColor: 'var(--accent-blue)',
                color: 'white'
              }}
            >
              <a
                href={ad.detailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {getSmartButtonLabel(ad.detailsUrl, ad.source)}
              </a>
            </Button>
          )}
          {hasVideo && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.open(ad.videoUrl, '_blank', 'noopener,noreferrer')}
              className="h-11 w-11 p-0"
              style={{
                backgroundColor: 'var(--bg-hover)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              title="Open video"
            >
              <Video className="h-5 w-5" />
            </Button>
          )}
          {ad.imageUrl && ad.format !== 'video' && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.open(ad.imageUrl, '_blank', 'noopener,noreferrer')}
              className="h-11 w-11 p-0"
              style={{
                backgroundColor: 'var(--bg-hover)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              title="Open image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </Button>
          )}
          {ad.source === 'foreplay' && ad.foreplay?.landing_page_url && ad.detailsUrl !== ad.foreplay.landing_page_url && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.open(ad.foreplay?.landing_page_url, '_blank', 'noopener,noreferrer')}
              className="h-11 w-11 p-0"
              style={{
                backgroundColor: 'var(--bg-hover)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              title="Open landing page"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
