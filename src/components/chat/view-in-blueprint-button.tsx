'use client';

import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';

interface ViewInBlueprintButtonProps {
  section: string;
  fieldPath: string;
  label?: string;
  onClick: () => void;
}

export function ViewInBlueprintButton({
  section,
  fieldPath,
  label = 'View in Blueprint',
  onClick,
}: ViewInBlueprintButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-125 active:scale-[0.98]"
      style={{
        background: 'rgba(96, 165, 250, 0.08)',
        border: '1px solid rgba(96, 165, 250, 0.2)',
        color: 'rgb(96, 165, 250)',
      }}
    >
      <Eye className="w-3 h-3" />
      <span>{label}</span>
      <span
        className="ml-0.5 text-[10px] font-normal"
        style={{ color: 'rgba(96, 165, 250, 0.5)' }}
      >
        {SECTION_LABELS[section] || section} / {fieldPath}
      </span>
    </motion.button>
  );
}
