"use client";

import { Kbd } from "./kbd";

export interface ChatChipProps {
  onClick?: () => void;
  label?: string;
}

export function ChatChip({ onClick, label = "Ask" }: ChatChipProps) {
  return (
    <button
      type="button"
      className="v3-chat-chip"
      onClick={onClick}
      aria-label="Open side chat"
    >
      <Kbd keyChar=";" />
      <span className="v3-chat-chip-label">{label}</span>
    </button>
  );
}
