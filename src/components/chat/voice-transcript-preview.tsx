'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, X } from 'lucide-react';
import { springs, easings } from '@/lib/motion';

interface VoiceTranscriptPreviewProps {
  transcript: string;
  onConfirm: (text: string) => void;
  onDismiss: () => void;
}

export function VoiceTranscriptPreview({
  transcript,
  onConfirm,
  onDismiss,
}: VoiceTranscriptPreviewProps) {
  const [editedText, setEditedText] = useState(transcript);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and select text on mount
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [editedText, autoResize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = editedText.trim();
      if (trimmed) onConfirm(trimmed);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={springs.smooth}
      className="voice-transcript-preview rounded-xl p-3"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Mic className="w-3 h-3" style={{ color: 'var(--accent-blue)' }} />
          <span
            className="text-[11px] font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Voice transcript
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="w-5 h-5 rounded flex items-center justify-center transition-colors duration-150"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Transcript text with blur-in */}
      <motion.div
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ ease: easings.out, duration: 0.3, delay: 0.08 }}
      >
        <textarea
          ref={textareaRef}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="w-full text-sm rounded-lg px-3 py-2 resize-none overflow-y-auto leading-5 outline-none transition-all duration-200"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            minHeight: '36px',
            maxHeight: '128px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-focus)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        />
      </motion.div>

      {/* Footer hint */}
      <div className="mt-1.5 flex items-center gap-1">
        <span className="text-[10px]" style={{ color: 'var(--text-quaternary)' }}>
          Enter to send
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          /
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-quaternary)' }}>
          Esc to dismiss
        </span>
      </div>
    </motion.div>
  );
}
