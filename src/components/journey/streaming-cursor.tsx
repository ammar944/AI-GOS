'use client';

import { motion } from 'framer-motion';

export function StreamingCursor() {
  return (
    <motion.span
      aria-hidden="true"
      className="inline-block ml-0.5 align-middle"
      style={{
        width: 2,
        height: 16,
        background: 'var(--accent-blue)',
        borderRadius: 1,
        boxShadow: '0 0 6px var(--accent-blue-glow)',
      }}
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
