"use client";

import { Sparkles, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Undo/redo controls */
  undoRedo?: {
    canUndo: boolean;
    canRedo: boolean;
    undoDepth: number;
    onUndo: () => void;
    onRedo: () => void;
  };
}

export function ChatPanel({ isOpen, onClose, children, undoRedo }: ChatPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[400px] flex flex-col p-0"
        showCloseButton
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 p-5 border-b border-border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-border">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <SheetTitle className="font-medium text-sm">
                  AIGOS
                </SheetTitle>
                <SheetDescription className="text-xs">
                  AI Strategy Agent
                </SheetDescription>
              </div>
            </div>

            {/* Undo/Redo controls */}
            {undoRedo && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undoRedo.onUndo}
                  disabled={!undoRedo.canUndo}
                  className="w-8 h-8 relative"
                  title={undoRedo.canUndo ? `Undo (${undoRedo.undoDepth} available)` : "Nothing to undo"}
                >
                  <Undo2 className="w-4 h-4" />
                  {undoRedo.undoDepth > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center bg-green-500 text-white">
                      {undoRedo.undoDepth > 9 ? "9+" : undoRedo.undoDepth}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undoRedo.onRedo}
                  disabled={!undoRedo.canRedo}
                  className="w-8 h-8"
                  title={undoRedo.canRedo ? "Redo" : "Nothing to redo"}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable message area */}
        <ScrollArea className="flex-1">
          {children}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
