"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  ArrowRight,
  Wand2,
  MoreHorizontal,
  Trash2,
  Users,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { staggerItem, springs } from "@/lib/motion";
import type { BlueprintRecord } from "@/lib/actions/blueprints";

interface BlueprintCardProps {
  blueprint: BlueprintRecord;
  linkedMediaPlanCount: number;
  showTypeBadge?: boolean;
  isDeleting?: boolean;
  onDelete: (id: string) => void;
  formatDate: (dateString: string) => string;
}

export function BlueprintCard({
  blueprint,
  linkedMediaPlanCount,
  showTypeBadge = false,
  isDeleting = false,
  onDelete,
  formatDate,
}: BlueprintCardProps) {
  const router = useRouter();
  const competitorCount =
    blueprint.output?.competitorAnalysis?.competitors?.length ?? 0;

  return (
    <motion.div
      variants={staggerItem}
      transition={springs.smooth}
      layout
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      className={isDeleting ? "opacity-40 pointer-events-none scale-[0.98]" : ""}
    >
      <Link href={`/blueprint/${blueprint.id}`} className="block">
        <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.10]">
          <div className="p-4">
            <div className="flex flex-col gap-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="inline-flex items-center justify-center size-8 rounded-full bg-blue-500/[0.08] text-blue-400/80 shrink-0">
                    <BarChart3 className="size-3.5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-medium text-white/90 truncate leading-tight">
                        {blueprint.title}
                      </h3>
                      {showTypeBadge && (
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-blue-400/60 bg-blue-500/[0.06] px-1.5 py-0.5 rounded">
                          Blueprint
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 tabular-nums">
                      {formatDate(blueprint.created_at)}
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
                        onDelete(blueprint.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Metadata + actions row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                  {competitorCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      <span className="tabular-nums text-white/60">{competitorCount}</span>
                      competitors
                    </span>
                  )}
                  {linkedMediaPlanCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileCheck className="size-3" />
                      <span className="tabular-nums text-white/60">{linkedMediaPlanCount}</span>
                      {linkedMediaPlanCount === 1 ? "plan" : "plans"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-blue-400 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/generate?blueprintId=${blueprint.id}&action=media-plan`);
                    }}
                  >
                    <Wand2 className="size-3" />
                    Media Plan
                  </button>
                  <ArrowRight className="size-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
