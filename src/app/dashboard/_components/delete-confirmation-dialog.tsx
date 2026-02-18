"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "blueprint" | "media plan";
  linkedMediaPlanCount?: number;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  title,
  type,
  linkedMediaPlanCount = 0,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-xl border-white/[0.08]">
        <AlertDialogHeader>
          <div className="flex items-start gap-3.5">
            <div className="inline-flex items-center justify-center size-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/15 shrink-0 mt-0.5">
              <AlertTriangle className="size-[18px]" />
            </div>
            <div>
              <AlertDialogTitle className="text-[15px] font-semibold">
                Delete {type}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
                This will permanently delete{" "}
                <span className="text-white font-medium">&ldquo;{title}&rdquo;</span>.
                This action cannot be undone.
                {type === "blueprint" && linkedMediaPlanCount > 0 && (
                  <span className="block mt-2.5 text-amber-400/80 text-[12px] leading-relaxed">
                    {linkedMediaPlanCount} linked media plan{linkedMediaPlanCount > 1 ? "s" : ""}{" "}
                    will lose their blueprint reference.
                  </span>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-2.5">
          <AlertDialogCancel className="text-[13px] font-medium border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.12]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="text-[13px] font-medium bg-red-500/90 text-white hover:bg-red-500 border-0"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
