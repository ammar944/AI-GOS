'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Package, TrendingUp, Target, Gauge, FileUp, Loader2, FileText, X, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { PendingMeeting, MeetingType } from '@/lib/meeting-intel/types';
import { cn } from '@/lib/utils';
import { FieldCard } from '@/components/journey/field-card';
import {
  JOURNEY_FIELD_GROUPS,
  JOURNEY_FIELD_LABELS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
  JOURNEY_MULTILINE_FIELDS,
  getManualBlockerMeta,
} from '@/lib/journey/field-catalog';

// Order matches JOURNEY_FIELD_GROUPS in src/lib/journey/field-catalog.ts.
// When a new group is added there, append a matching icon here.
const GROUP_ICONS = [
  <Building2 key="biz" className="h-3.5 w-3.5" />,
  <Users key="cust" className="h-3.5 w-3.5" />,
  <Package key="offer" className="h-3.5 w-3.5" />,
  <TrendingUp key="comp" className="h-3.5 w-3.5" />,
  <Target key="goals" className="h-3.5 w-3.5" />,
  <Gauge key="perf" className="h-3.5 w-3.5" />,
];

// Human-readable labels for section tags shown on uploaded doc chips
const TAG_LABELS: Record<string, string> = {
  industryMarket: 'Market Overview',
  icpValidation: 'ICP',
  competitors: 'Competitors',
  offerAnalysis: 'Offer',
  crossAnalysis: 'Synthesis',
  keywordIntel: 'Keywords',
  mediaPlan: 'Media Plan',
  identityResolution: 'Identity',
};

export interface UnifiedFieldReviewProps {
  extractedFields: Record<string, string>;
  onStart: (onboardingData: Record<string, string>) => void;
  pendingMeetings?: PendingMeeting[];
  onPendingMeetingsChange?: (meetings: PendingMeeting[]) => void;
}

export function UnifiedFieldReview({
  extractedFields,
  onStart,
  pendingMeetings = [],
  onPendingMeetingsChange,
}: UnifiedFieldReviewProps) {
  const [userEdits, setUserEdits] = useState<Record<string, string>>({});
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  // Document upload state
  interface UploadedDoc {
    id: string;
    fileName: string;
    docKind: string;
    sectionTags: string[];
    tokenCount: number;
  }
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Meeting transcript state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('discovery');
  const [meetingTranscript, setMeetingTranscript] = useState('');

  const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
    { value: 'discovery', label: 'Discovery' },
    { value: 'demo', label: 'Demo' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'closing', label: 'Closing' },
    { value: 'strategy', label: 'Strategy' },
    { value: 'kickoff', label: 'Kickoff' },
    { value: 'review', label: 'Review' },
    { value: 'other', label: 'Other' },
  ];

  const canSubmitMeeting = meetingTitle.trim().length > 0 && meetingTranscript.trim().length >= 50;

  const handleAddMeeting = useCallback(async () => {
    if (!canSubmitMeeting) return;
    const newMeeting: PendingMeeting = {
      id: crypto.randomUUID(),
      title: meetingTitle.trim(),
      meetingType,
      transcript: meetingTranscript.trim(),
      dateAdded: new Date().toISOString(),
    };
    onPendingMeetingsChange?.([...pendingMeetings, newMeeting]);
    setMeetingTitle('');
    setMeetingTranscript('');
    setMeetingType('discovery');
  }, [canSubmitMeeting, meetingTitle, meetingType, meetingTranscript, pendingMeetings, onPendingMeetingsChange]);

  const handleDocUpload = useCallback(async (files: FileList) => {
    if (isUploading || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const filePayloads: { storagePath: string; fileName: string; mimeType: string }[] = [];
      const skipped: string[] = [];

      const extMimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        md: 'text/markdown',
      };

      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) {
          skipped.push(`${file.name} exceeds 15MB limit`);
          continue;
        }

        const ext = file.name.split('.').pop()?.toLowerCase();
        const mimeType = (ext && extMimeMap[ext])
          ? extMimeMap[ext]
          : (file.type && file.type !== 'application/octet-stream')
            ? file.type
            : 'application/octet-stream';

        // 1. Get a signed upload URL from the server
        const urlRes = await fetch('/api/documents/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, mimeType, fileSize: file.size }),
        });
        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({ error: 'Failed to get upload URL' }));
          skipped.push(`${file.name}: ${err.error ?? 'upload URL failed'}`);
          continue;
        }
        const { signedUrl, token, storagePath } = await urlRes.json() as {
          signedUrl: string;
          token: string;
          storagePath: string;
        };

        // 2. Upload file directly to Supabase Storage (bypasses Vercel body limit)
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
            'x-upsert': 'true',
          },
          body: file,
        });
        if (!uploadRes.ok) {
          skipped.push(`${file.name}: storage upload failed (${uploadRes.status})`);
          continue;
        }

        filePayloads.push({ storagePath, fileName: file.name, mimeType });
      }

      if (filePayloads.length === 0) {
        setUploadError(skipped.length > 0 ? skipped.join(', ') : 'No supported files selected');
        return;
      }

      // 3. Send storage paths to the parsing API
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filePayloads }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        setUploadError(data.error ?? `Upload failed (${res.status})`);
        return;
      }

      const data = await res.json() as { documents: UploadedDoc[]; errors?: string[] };
      setUploadedDocs((prev) => [...prev, ...data.documents]);

      // Surface server-side errors (parse failures, token budget, etc.)
      const allErrors = [...skipped, ...(data.errors ?? [])];
      if (allErrors.length > 0) {
        setUploadError(allErrors.join(', '));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [isUploading]);

  const handleRemoveDoc = useCallback((docId: string) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  // Merged field values: extracted → user edits (user edits win)
  const fieldValues = useMemo(() => {
    const merged: Record<string, string> = {};
    for (const [key, val] of Object.entries(extractedFields)) {
      if (val) merged[key] = val;
    }
    for (const [key, val] of Object.entries(userEdits)) {
      merged[key] = val;
    }
    return merged;
  }, [extractedFields, userEdits]);

  // Track which keys came from scraping
  const scrapedKeys = useMemo(() => {
    return new Set(
      Object.entries(extractedFields)
        .filter(([, val]) => val?.trim())
        .map(([key]) => key),
    );
  }, [extractedFields]);

  // Gate logic — all required fields must be filled
  const gateStatus = useMemo(() => {
    const missing: string[] = [];
    for (const key of JOURNEY_REQUIRED_FIELD_KEYS) {
      if (!fieldValues[key]?.trim()) {
        missing.push(key);
      }
    }
    const hasPricing = Array.from(JOURNEY_PRICING_GROUP_KEYS).some(
      (key) => fieldValues[key]?.trim(),
    );
    if (!hasPricing) {
      missing.push('pricingContext');
    }
    return { ready: missing.length === 0, missing };
  }, [fieldValues]);

  // Progress per group
  const groupProgress = useMemo(() => {
    return JOURNEY_FIELD_GROUPS.map((group) => {
      let filled = 0;
      for (const key of group.fieldKeys) {
        if (fieldValues[key]?.trim()) filled++;
      }
      return { filled, total: group.fieldKeys.length };
    });
  }, [fieldValues]);

  // Overall progress
  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;
    for (const gp of groupProgress) {
      filled += gp.filled;
      total += gp.total;
    }
    return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [groupProgress]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setUserEdits((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStart = useCallback(async () => {
    if (!gateStatus.ready || isStarting) return;
    setIsStarting(true);
    try {
      await onStart(fieldValues);
    } catch {
      setIsStarting(false);
    }
  }, [gateStatus.ready, isStarting, fieldValues, onStart]);

  const activeGroup = JOURNEY_FIELD_GROUPS[activeGroupIndex];

  return (
    <section className="flex-1 flex flex-col min-h-0">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-12 pb-32">
        <div className="max-w-3xl mx-auto pt-8 sm:pt-12">
          {/* Header */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 0.45, 0.27, 0.9] }}
          >
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-foreground">
              Review your data
            </h2>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              We found {scrapedKeys.size} fields from your site. Review and fill any missing required fields.
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-medium text-[var(--text-secondary)]">
                Step {activeGroupIndex + 1} of {JOURNEY_FIELD_GROUPS.length}
              </span>
              <span className="text-[var(--text-quaternary)]">&middot;</span>
              <span className="text-[var(--text-tertiary)] font-mono tabular-nums">
                {progress.percent}% complete
              </span>
            </div>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--gradient-primary)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </motion.div>

          {/* Horizontal step indicators */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {/* Desktop: full step indicators with connecting lines.
                items-start (not items-center) keeps every column top-aligned so
                the circles + connector lines stay on the same page-y even when
                a label wraps to two lines (e.g. "Current Performance (optional)"). */}
            <div className="hidden sm:flex items-start justify-between relative" role="tablist" aria-label="Onboarding sections">
              {JOURNEY_FIELD_GROUPS.map((group, index) => {
                const isActive = index === activeGroupIndex;
                const gp = groupProgress[index];
                const isComplete = gp.filled === gp.total;

                return (
                  <div key={group.id} className="flex flex-col items-center gap-2 flex-1 relative z-10">
                    {/* Connector line (between circles) */}
                    {index > 0 && (
                      <div
                        className="absolute top-4 right-1/2 w-full h-0.5 -z-10"
                        style={{
                          background: groupProgress[index - 1].filled === groupProgress[index - 1].total
                            ? 'var(--accent-blue)'
                            : 'var(--border-hover)',
                        }}
                      />
                    )}

                    {/* Step circle */}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`${group.label} — ${gp.filled} of ${gp.total} filled`}
                      onClick={() => setActiveGroupIndex(index)}
                      className={cn(
                        'relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]',
                        'hover:scale-110',
                      )}
                      style={{
                        borderColor: isActive
                          ? 'var(--text-secondary)'
                          : isComplete
                            ? 'var(--accent-blue)'
                            : 'var(--border-hover)',
                        background: isActive
                          ? 'var(--text-secondary)'
                          : isComplete
                            ? 'var(--accent-blue)'
                            : 'var(--bg-hover)',
                        color: isActive
                          ? 'var(--bg-hover)'
                          : isComplete
                            ? '#fff'
                            : 'var(--text-tertiary)',
                      }}
                    >
                      {isComplete && !isActive ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        GROUP_ICONS[index]
                      )}

                      {/* Active pulse */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ border: '2px solid var(--text-secondary)' }}
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </button>

                    {/* Label */}
                    <span
                      className={cn(
                        'text-[11px] font-medium text-center leading-tight transition-colors duration-200',
                      )}
                      style={{
                        color: isActive
                          ? 'var(--text-primary)'
                          : isComplete
                            ? 'var(--accent-blue)'
                            : 'var(--text-tertiary)',
                      }}
                    >
                      {group.label}
                    </span>

                    {/* Fill count */}
                    <span className="text-[9px] font-mono tabular-nums" style={{ color: 'var(--text-quaternary)' }}>
                      {gp.filled}/{gp.total}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: scrollable pill buttons */}
            <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
              {JOURNEY_FIELD_GROUPS.map((group, index) => {
                const isActive = index === activeGroupIndex;
                const gp = groupProgress[index];
                const isComplete = gp.filled === gp.total;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroupIndex(index)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer',
                      isActive
                        ? 'bg-foreground text-background'
                        : isComplete
                          ? 'bg-[rgb(54,94,255)]/15 text-[rgb(54,94,255)] border border-[rgb(54,94,255)]/20'
                          : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-default)]',
                    )}
                  >
                    {isComplete && !isActive && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {group.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Active group fields */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGroup.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--accent-blue-subtle)',
                boxShadow: 'var(--shadow-glow-blue), var(--shadow-elevated)',
              }}
            >
              {/* Group header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--accent-blue-glow)',
                    border: '1px solid var(--accent-blue-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--accent-blue)' }}>
                    {GROUP_ICONS[activeGroupIndex]}
                  </span>
                </div>
                <div className="flex-1">
                  <h3
                    className="text-[15px] font-semibold tracking-[-0.01em]"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                  >
                    {activeGroup.label}
                  </h3>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {groupProgress[activeGroupIndex].filled} of {groupProgress[activeGroupIndex].total} filled
                  </p>
                </div>
              </div>

              {/* Field cards */}
              <div className="px-5 pb-4 space-y-1.5">
                {activeGroup.fieldKeys.map((key, i) => {
                  const fieldLabel = JOURNEY_FIELD_LABELS[key] || key;
                  const isRequired = JOURNEY_REQUIRED_FIELD_KEYS.has(key) || JOURNEY_PRICING_GROUP_KEYS.has(key);
                  const isScraped = scrapedKeys.has(key);
                  const isMultiline = JOURNEY_MULTILINE_FIELDS.has(key);
                  const blockerMeta = getManualBlockerMeta(key);

                  return (
                    <FieldCard
                      key={key}
                      fieldKey={key}
                      label={fieldLabel}
                      value={fieldValues[key] ?? ''}
                      placeholder={blockerMeta?.placeholder ?? ''}
                      helper={blockerMeta?.helper}
                      isRequired={isRequired}
                      isScraped={isScraped}
                      isMultiline={isMultiline}
                      onChange={(val) => handleFieldChange(key, val)}
                      autoFocus={i === 0}
                    />
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Document upload section */}
          <motion.div
            className="mt-8 rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div className="px-5 pt-5 pb-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <FileText className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div className="flex-1">
                  <h3
                    className="text-[15px] font-semibold tracking-[-0.01em]"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                  >
                    Supporting Documents
                    <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-quaternary)' }}>
                      optional
                    </span>
                  </h3>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Sales decks, brand books, ICP docs, case studies — enriches research quality
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5">
              {/* Uploaded docs list */}
              {uploadedDocs.length > 0 && (
                <div className="space-y-2 mb-4">
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-default)' }}
                    >
                      <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-blue)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                          {doc.fileName}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {doc.sectionTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                              style={{
                                background: 'var(--accent-blue-glow)',
                                color: 'var(--accent-blue)',
                                border: '1px solid var(--accent-blue-subtle)',
                              }}
                            >
                              {TAG_LABELS[tag] ?? tag}
                            </span>
                          ))}
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                            style={{ color: 'var(--text-quaternary)' }}
                          >
                            {doc.docKind.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="cursor-pointer p-1 rounded-md transition-colors hover:bg-[var(--bg-base)]"
                        style={{ color: 'var(--text-quaternary)' }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setUploadError(null);
                    handleDocUpload(e.target.files);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  'cursor-pointer w-full h-12 rounded-xl border border-dashed transition-all duration-200 text-[13px] font-medium',
                  'hover:border-[var(--accent-blue)]/40 hover:text-[var(--text-secondary)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                style={{
                  borderColor: 'var(--border-hover)',
                  color: 'var(--text-tertiary)',
                  background: 'transparent',
                }}
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <FileUp className="h-4 w-4" />
                    {uploadedDocs.length > 0 ? 'Upload more documents' : 'Upload documents'}
                  </span>
                )}
              </button>
              <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--text-quaternary)' }}>
                PDF, DOCX, TXT, MD &middot; up to 15MB each &middot; max 10 files
              </p>
              {uploadError && (
                <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--status-red, #ef4444)' }}>{uploadError}</p>
              )}

              {/* Meeting Transcript divider */}
              <div className="mt-5 mb-4 flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>
                  or enrich with meeting transcripts
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              </div>

              {/* Meeting transcript form */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-quaternary)' }} />
                    <input
                      type="text"
                      placeholder="Meeting title..."
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className={cn(
                        'w-full h-12 rounded-xl border pl-9 pr-3 text-[13px] font-medium transition-all duration-200',
                        'focus:outline-none focus:border-[var(--accent-blue)]/40',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                      style={{
                        borderStyle: 'dashed',
                        borderColor: 'var(--border-hover)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                      }}
                    />
                  </div>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                    disabled={false}
                    className={cn(
                      'h-12 px-3 rounded-xl border text-[13px] font-medium transition-all duration-200',
                      'focus:outline-none focus:border-[var(--accent-blue)]/40',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                    style={{
                      borderStyle: 'dashed',
                      borderColor: 'var(--border-hover)',
                      color: 'var(--text-secondary)',
                      background: 'transparent',
                    }}
                  >
                    {MEETING_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <textarea
                    placeholder="Paste meeting transcript here..."
                    value={meetingTranscript}
                    onChange={(e) => setMeetingTranscript(e.target.value)}
                    rows={6}
                    className={cn(
                      'w-full rounded-xl border p-3 text-[13px] font-medium transition-all duration-200 resize-y min-h-[120px]',
                      'focus:outline-none focus:border-[var(--accent-blue)]/40',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                    style={{
                      borderStyle: 'dashed',
                      borderColor: 'var(--border-hover)',
                      color: 'var(--text-secondary)',
                      background: 'transparent',
                    }}
                  />
                  {meetingTranscript.length > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
                        {meetingTranscript.length.toLocaleString()} chars · ~{Math.ceil(meetingTranscript.length / 4).toLocaleString()} tokens
                      </span>
                      {meetingTranscript.length > 200_000 && (
                        <span className="text-[10px] font-mono" style={{ color: 'var(--status-amber, #eab308)' }}>
                          Very long transcript — consider splitting into key sections
                        </span>
                      )}
                      {meetingTranscript.length > 100_000 && meetingTranscript.length <= 200_000 && (
                        <span className="text-[10px] font-mono" style={{ color: 'var(--status-amber, #eab308)' }}>
                          Long transcript — extraction may take a bit longer
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddMeeting}
                  disabled={!canSubmitMeeting}
                  className={cn(
                    'w-full h-12 rounded-xl text-[13px] font-medium transition-all duration-200',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                  )}
                  style={{
                    background: 'var(--accent-blue-glow)',
                    color: 'var(--accent-blue)',
                    border: '1px solid var(--accent-blue-subtle)',
                  }}
                >
                  Add Meeting
                </button>
              </div>

              {/* Pending meeting chips */}
              {pendingMeetings.length > 0 && (
                <div className="space-y-2 mt-4">
                  {pendingMeetings.map((meeting) => {
                    const typeLabel = MEETING_TYPE_OPTIONS.find((o) => o.value === meeting.meetingType)?.label ?? meeting.meetingType;

                    return (
                      <div key={meeting.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-default)' }}>
                        <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-blue)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                            {meeting.title}
                          </p>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
                            {typeLabel} · ~{Math.ceil(meeting.transcript.length / 4).toLocaleString()} tokens
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--status-green, #22c55e)' }}>
                          <CheckCircle2 className="h-3 w-3" /> Saved
                        </span>
                        <button
                          type="button"
                          onClick={() => onPendingMeetingsChange?.(pendingMeetings.filter((m) => m.id !== meeting.id))}
                          className="p-1 rounded-md hover:bg-[var(--bg-base)]/50 transition-colors"
                        >
                          <X className="h-3 w-3" style={{ color: 'var(--text-quaternary)' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 border-t border-[var(--border-default)] px-6 sm:px-12 py-4 bg-[var(--bg-base)]/95 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Status */}
          <div className="flex-1 min-w-0">
            {gateStatus.ready ? (
              <p className="text-[13px] flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Profile complete
              </p>
            ) : (
              <p className="text-[13px] flex items-center gap-2 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                {gateStatus.missing.length} required field{gateStatus.missing.length !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          {/* Navigation + Start buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {activeGroupIndex > 0 && (
              <button
                onClick={() => setActiveGroupIndex((prev) => prev - 1)}
                className="cursor-pointer h-10 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] font-medium text-[13px] px-5 transition-all hover:border-white/20 hover:text-[var(--text-secondary)]"
              >
                Back
              </button>
            )}

            {activeGroupIndex < JOURNEY_FIELD_GROUPS.length - 1 ? (
              <button
                onClick={() => setActiveGroupIndex((prev) => prev + 1)}
                className="cursor-pointer h-10 rounded-full bg-foreground text-background font-semibold text-[13px] px-6 transition-all hover:bg-foreground/90"
              >
                Next Section
              </button>
            ) : (
              <button
                disabled={!gateStatus.ready || isStarting}
                onClick={handleStart}
                className={cn(
                  'cursor-pointer h-10 rounded-full font-semibold text-[13px] px-6 transition-all',
                  gateStatus.ready && !isStarting
                    ? 'bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg'
                    : 'bg-[var(--bg-hover)] text-[var(--text-quaternary)] cursor-not-allowed',
                )}
              >
                {isStarting ? 'Starting...' : 'Start Research'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
