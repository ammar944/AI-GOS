"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staggerContainer, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BlueprintCard } from "./blueprint-card";
import { MediaPlanCard } from "./media-plan-card";
import { EmptyState } from "./empty-state";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import type { BlueprintRecord } from "@/lib/actions/blueprints";
import type { MediaPlanRecord } from "@/lib/actions/media-plans";

type TabValue = "all" | "blueprints" | "media-plans";
type SortValue = "newest" | "oldest" | "name-asc" | "name-desc";

type DashboardItem =
  | { type: "blueprint"; data: BlueprintRecord }
  | { type: "media-plan"; data: MediaPlanRecord };

interface DeleteTarget {
  id: string;
  title: string;
  type: "blueprint" | "media plan";
  linkedMediaPlanCount: number;
}

interface DocumentTabsProps {
  blueprints: BlueprintRecord[];
  mediaPlans: MediaPlanRecord[];
  onDeleteBlueprint: (id: string) => Promise<void>;
  onDeleteMediaPlan: (id: string) => Promise<void>;
  deletingBlueprintId: string | null;
  deletingMediaPlanId: string | null;
}

const tabs: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blueprints", label: "Blueprints" },
  { value: "media-plans", label: "Media Plans" },
];

const sortLabels: Record<SortValue, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "name-asc": "A \u2013 Z",
  "name-desc": "Z \u2013 A",
};

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

function getResultLabel(count: number, tab: TabValue): string {
  if (tab === "blueprints") return count === 1 ? "1 blueprint" : `${count} blueprints`;
  if (tab === "media-plans") return count === 1 ? "1 media plan" : `${count} media plans`;
  return count === 1 ? "1 document" : `${count} documents`;
}

export function DocumentTabs({
  blueprints,
  mediaPlans,
  onDeleteBlueprint,
  onDeleteMediaPlan,
  deletingBlueprintId,
  deletingMediaPlanId,
}: DocumentTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortValue, setSortValue] = useState<SortValue>("newest");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Debounced search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Relationship maps
  const mediaPlanCountByBlueprintId = useMemo(() => {
    const map = new Map<string, number>();
    for (const mp of mediaPlans) {
      if (mp.blueprint_id) {
        map.set(mp.blueprint_id, (map.get(mp.blueprint_id) ?? 0) + 1);
      }
    }
    return map;
  }, [mediaPlans]);

  const blueprintTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const bp of blueprints) {
      map.set(bp.id, bp.title);
    }
    return map;
  }, [blueprints]);

  // Sort function
  const sortItems = useCallback(
    <T extends { title: string; created_at: string }>(items: T[]): T[] => {
      return [...items].sort((a, b) => {
        switch (sortValue) {
          case "newest":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "oldest":
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case "name-asc":
            return a.title.localeCompare(b.title);
          case "name-desc":
            return b.title.localeCompare(a.title);
          default:
            return 0;
        }
      });
    },
    [sortValue]
  );

  // Filter by search
  const filterBySearch = useCallback(
    <T extends { title: string }>(items: T[]): T[] => {
      if (!debouncedQuery) return items;
      const q = debouncedQuery.toLowerCase();
      return items.filter((item) => item.title.toLowerCase().includes(q));
    },
    [debouncedQuery]
  );

  const filteredBlueprints = useMemo(
    () => sortItems(filterBySearch(blueprints)),
    [blueprints, filterBySearch, sortItems]
  );

  const filteredMediaPlans = useMemo(
    () => sortItems(filterBySearch(mediaPlans)),
    [mediaPlans, filterBySearch, sortItems]
  );

  const allItems = useMemo(() => {
    const items: DashboardItem[] = [
      ...filteredBlueprints.map((bp) => ({ type: "blueprint" as const, data: bp })),
      ...filteredMediaPlans.map((mp) => ({ type: "media-plan" as const, data: mp })),
    ];
    return items.sort((a, b) => {
      switch (sortValue) {
        case "newest":
          return new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
        case "oldest":
          return new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime();
        case "name-asc":
          return a.data.title.localeCompare(b.data.title);
        case "name-desc":
          return b.data.title.localeCompare(a.data.title);
        default:
          return 0;
      }
    });
  }, [filteredBlueprints, filteredMediaPlans, sortValue]);

  // Tab counts
  const tabCounts: Record<TabValue, number> = {
    all: blueprints.length + mediaPlans.length,
    blueprints: blueprints.length,
    "media-plans": mediaPlans.length,
  };

  // Delete handlers
  const handleRequestDelete = useCallback(
    (id: string, type: "blueprint" | "media plan") => {
      if (type === "blueprint") {
        const bp = blueprints.find((b) => b.id === id);
        setDeleteTarget({
          id,
          title: bp?.title ?? "Untitled",
          type,
          linkedMediaPlanCount: mediaPlanCountByBlueprintId.get(id) ?? 0,
        });
      } else {
        const mp = mediaPlans.find((m) => m.id === id);
        setDeleteTarget({
          id,
          title: mp?.title ?? "Untitled",
          type,
          linkedMediaPlanCount: 0,
        });
      }
    },
    [blueprints, mediaPlans, mediaPlanCountByBlueprintId]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    if (deleteTarget.type === "blueprint") {
      await onDeleteBlueprint(deleteTarget.id);
    } else {
      await onDeleteMediaPlan(deleteTarget.id);
    }
  }, [deleteTarget, onDeleteBlueprint, onDeleteMediaPlan]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  const isSearching = debouncedQuery.length > 0;

  // Get items for current tab
  const currentItems = useMemo((): DashboardItem[] => {
    switch (activeTab) {
      case "blueprints":
        return filteredBlueprints.map((bp) => ({ type: "blueprint" as const, data: bp }));
      case "media-plans":
        return filteredMediaPlans.map((mp) => ({ type: "media-plan" as const, data: mp }));
      default:
        return allItems;
    }
  }, [activeTab, allItems, filteredBlueprints, filteredMediaPlans]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.15 }}
        className="mt-8"
      >
        {/* Tab bar + controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {/* Underline tabs */}
          <div className="flex items-center gap-6 border-b border-white/[0.06]">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "relative pb-2.5 text-[13px] font-medium transition-colors duration-200 cursor-pointer",
                  activeTab === tab.value
                    ? "text-white"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                )}
              >
                {tab.label}
                {tabCounts[tab.value] > 0 && (
                  <span className={cn(
                    "ml-1.5 text-[11px] tabular-nums transition-colors",
                    activeTab === tab.value ? "text-white/40" : "text-white/20"
                  )}>
                    {tabCounts[tab.value]}
                  </span>
                )}
                {/* Active indicator */}
                {activeTab === tab.value && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-tertiary)] pointer-events-none" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-[13px] rounded-lg bg-white/[0.03] border-white/[0.07] placeholder:text-white/25 focus:border-blue-500/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_oklch(0.62_0.19_255_/_0.08)] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <Select value={sortValue} onValueChange={(v) => setSortValue(v as SortValue)}>
              <SelectTrigger size="sm" className="h-9 text-[13px] rounded-lg bg-white/[0.03] border-white/[0.07] text-[var(--text-tertiary)] gap-1.5 pl-2.5 pr-2 w-auto min-w-[100px]">
                <ArrowUpDown className="size-3.5 text-white/30 shrink-0" />
                <SelectValue>{sortLabels[sortValue]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name-asc">A &ndash; Z</SelectItem>
                <SelectItem value="name-desc">Z &ndash; A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count */}
        {currentItems.length > 0 && (
          <p className="text-[12px] text-[var(--text-tertiary)] mt-4 mb-1">
            Showing {getResultLabel(currentItems.length, activeTab)}
          </p>
        )}

        {/* Content */}
        <div className="mt-3">
          <AnimatePresence mode="wait">
            {currentItems.length === 0 ? (
              isSearching ? (
                <EmptyState
                  key="search-empty"
                  variant="search"
                  searchQuery={debouncedQuery}
                  onClearSearch={clearSearch}
                />
              ) : (
                <EmptyState
                  key={`${activeTab}-empty`}
                  variant={activeTab}
                  onSwitchTab={(tab) => setActiveTab(tab as TabValue)}
                />
              )
            ) : (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                key={`${activeTab}-${debouncedQuery}-${sortValue}`}
              >
                {currentItems.map((item) => {
                  if (item.type === "blueprint") {
                    return (
                      <BlueprintCard
                        key={`bp-${item.data.id}`}
                        blueprint={item.data}
                        linkedMediaPlanCount={mediaPlanCountByBlueprintId.get(item.data.id) ?? 0}
                        showTypeBadge={activeTab === "all"}
                        isDeleting={deletingBlueprintId === item.data.id}
                        onDelete={(id) => handleRequestDelete(id, "blueprint")}
                        formatDate={formatDate}
                      />
                    );
                  }
                  return (
                    <MediaPlanCard
                      key={`mp-${item.data.id}`}
                      mediaPlan={item.data as MediaPlanRecord}
                      blueprintTitle={
                        (item.data as MediaPlanRecord).blueprint_id
                          ? blueprintTitleById.get((item.data as MediaPlanRecord).blueprint_id!)
                          : undefined
                      }
                      showTypeBadge={activeTab === "all"}
                      isDeleting={deletingMediaPlanId === item.data.id}
                      onDelete={(id) => handleRequestDelete(id, "media plan")}
                      formatDate={formatDate}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <DeleteConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.title ?? ""}
        type={deleteTarget?.type ?? "blueprint"}
        linkedMediaPlanCount={deleteTarget?.linkedMediaPlanCount}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
