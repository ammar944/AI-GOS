"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { springs } from "@/lib/motion";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ChatPanel({ isOpen, onClose, children }: ChatPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - solid dark, no blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.8)",
            }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={springs.smooth}
            className="fixed right-0 top-0 z-50 h-screen w-full sm:w-[400px] flex flex-col"
            style={{
              background: "var(--bg-base, #000000)",
              borderLeft: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
            }}
          >
            {/* Header - flat elevated surface, no gradient */}
            <div
              className="flex-shrink-0 p-5"
              style={{
                background: "var(--bg-elevated, #0a0a0a)",
                borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "var(--bg-surface, #101010)",
                      border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                    }}
                  >
                    <Sparkles className="w-4 h-4" style={{ color: "var(--text-secondary, #a0a0a0)" }} />
                  </div>
                  <div>
                    <h2
                      className="font-medium text-sm"
                      style={{ color: "var(--text-primary, #ffffff)" }}
                    >
                      AI Editor
                    </h2>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-tertiary, #666666)" }}
                    >
                      Refine your blueprint
                    </p>
                  </div>
                </div>

                <MagneticButton
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                    color: "var(--text-tertiary, #666666)",
                  }}
                >
                  <X className="w-4 h-4" />
                </MagneticButton>
              </div>
            </div>

            {/* Scrollable message area */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
