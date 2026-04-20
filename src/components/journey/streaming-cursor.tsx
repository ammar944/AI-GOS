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
        background: 'var(--text-primary)',
        borderRadius: 1,
      }}
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
