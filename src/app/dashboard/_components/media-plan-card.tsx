"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileCheck,
  ArrowRight,
  MoreHorizontal,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { staggerItem, springs } from "@/lib/motion";
import type { MediaPlanRecord } from "@/lib/actions/media-plans";

interface MediaPlanCardProps {
  mediaPlan: MediaPlanRecord;
  blueprintTitle?: string;
  showTypeBadge?: boolean;
  isDeleting?: boolean;
  onDelete: (id: string) => void;
  formatDate: (dateString: string) => string;
}

export function MediaPlanCard({
  mediaPlan,
  blueprintTitle,
  showTypeBadge = false,
  isDeleting = false,
  onDelete,
  formatDate,
}: MediaPlanCardProps) {
  const isApproved = mediaPlan.status === "approved";
  const hasAdCopy = mediaPlan.ad_copy != null;

  return (
    <motion.div
      variants={staggerItem}
      transition={springs.smooth}
      layout
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      className={isDeleting ? "opacity-40 pointer-events-none scale-[0.98]" : ""}
    >
      <Link href={`/media-plan/${mediaPlan.id}`} className="block">
        <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.10]">
          <div className="p-4">
            <div className="flex flex-col gap-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`inline-flex items-center justify-center size-8 rounded-full shrink-0 ${
                    isApproved
                      ? "bg-emerald-500/[0.08] text-emerald-400/80"
                      : "bg-amber-500/[0.08] text-amber-400/80"
                  }`}>
                    <FileCheck className="size-3.5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-medium text-white/90 truncate leading-tight">
                        {mediaPlan.title}
                      </h3>
                      {showTypeBadge && (
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-sky-400/60 bg-sky-500/[0.06] px-1.5 py-0.5 rounded">
                          Plan
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 tabular-nums">
                      {formatDate(mediaPlan.created_at)}
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-[var(--text-tertiary)] show-on-card-hover hover:text-white hover:bg-white/[0.06]"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    <DropdownMenuItem
                      className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete(mediaPlan.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Source blueprint link */}
              {mediaPlan.blueprint_id && blueprintTitle && (
                <span
                  role="link"
                  tabIndex={0}
                  className="group/link inline-flex items-center gap-1 w-fit text-[11px] -mt-1"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `/blueprint/${mediaPlan.blueprint_id}`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      window.location.href = `/blueprint/${mediaPlan.blueprint_id}`;
                    }
                  }}
                >
                  <span className="text-[var(--text-tertiary)] opacity-60">from</span>
                  <span className="text-[var(--text-tertiary)] group-hover/link:text-blue-400 truncate max-w-[180px] transition-colors">
                    {blueprintTitle}
                  </span>
                  <ArrowUpRight className="size-2.5 text-[var(--text-tertiary)] opacity-0 group-hover/link:opacity-100 transition-opacity" />
                </span>
              )}

              {/* Bottom row: badges + arrow */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isApproved
                      ? "bg-emerald-500/[0.08] text-emerald-400/80"
                      : "bg-amber-500/[0.08] text-amber-400/80"
                  }`}>
                    {isApproved ? <CheckCircle2 className="size-2.5" /> : <Clock className="size-2.5" />}
                    {isApproved ? "Approved" : "Draft"}
                  </span>
                  {hasAdCopy && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400/60">
                      <Sparkles className="size-2.5" />
                      Ad Copy
                    </span>
                  )}
                </div>

                <ArrowRight className="size-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
