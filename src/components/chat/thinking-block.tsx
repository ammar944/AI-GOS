"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  state?: 'streaming' | 'done';
  defaultOpen?: boolean;
}

export function ThinkingBlock({
  content,
  state,
  defaultOpen = false,
}: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Self-managed timer: starts on mount, ticks while streaming, freezes on done
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const frozenElapsedRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === 'streaming') {
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);
      return () => clearInterval(interval);
    } else if (state === 'done' && frozenElapsedRef.current === null) {
      frozenElapsedRef.current = Date.now() - startTimeRef.current;
      setElapsed(frozenElapsedRef.current);
    }
  }, [state]);

  const label = (() => {
    if (state === 'streaming') {
      return `Thinking for ${(elapsed / 1000).toFixed(1)}s`;
    }
    if (state === 'done') {
      const finalElapsed = frozenElapsedRef.current ?? elapsed;
      return `Thought for ${(finalElapsed / 1000).toFixed(1)}s`;
    }
    return 'Thinking';
  })();

  return (
    <div
      style={{
        borderLeft: "2px solid var(--accent-blue, rgb(54, 94, 255))",
        paddingLeft: "12px",
        margin: "8px 0",
      }}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 outline-none"
        aria-expanded={isOpen}
      >
        <ChevronRight
          className="w-3 h-3"
          style={{
            color: "var(--text-tertiary, #666666)",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
        <span
          style={{
            fontSize: "11.5px",
            color: "var(--text-tertiary, #666666)",
          }}
        >
          {label}
        </span>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <p
              style={{
                fontStyle: "italic",
                fontSize: "12.5px",
                color: "var(--text-tertiary, #666666)",
                whiteSpace: "pre-wrap",
                marginTop: "6px",
              }}
            >
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
