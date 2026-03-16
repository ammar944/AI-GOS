'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { staggerItem, springs } from '@/lib/motion';
import type { JourneySessionRecord } from '@/lib/actions/journey-sessions';

interface ResearchCardProps {
  session: JourneySessionRecord;
  showTypeBadge?: boolean;
  formatDate: (dateString: string) => string;
}

export function ResearchCard({ session, showTypeBadge = false, formatDate }: ResearchCardProps) {
  return (
    <motion.div variants={staggerItem} transition={springs.smooth} layout>
      <Link href={`/research/${session.id}`} className="block">
        <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.10]">
          <div className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-500/[0.08] text-emerald-400/80 shrink-0">
                  <FlaskConical className="size-3.5" />
                </div>
                <div className="min-w-0 pt-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-white/90 truncate leading-tight">
                      {session.title}
                    </h3>
                    {showTypeBadge && (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-emerald-400/60 bg-emerald-500/[0.06] px-1.5 py-0.5 rounded">
                        Research
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 tabular-nums">
                    {formatDate(session.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--text-tertiary)] inline-flex items-center gap-1">
                  <span className="tabular-nums text-white/60">{session.completedSections.length}</span>
                  / 6 sections
                </span>
                <ArrowRight className="size-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
