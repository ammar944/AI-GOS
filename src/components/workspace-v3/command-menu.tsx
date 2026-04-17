"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "./kbd";

export interface CommandAction {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface CommandMenuProps {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

export function CommandMenu({ open, onClose, actions }: CommandMenuProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [query, actions]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (selectedIdx >= filtered.length) setSelectedIdx(0);
  }, [filtered, selectedIdx]);

  if (!open) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const action = filtered[selectedIdx];
      if (action && !action.disabled) {
        action.onSelect();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const grouped = filtered.reduce<Record<string, CommandAction[]>>((acc, a) => {
    const g = a.group ?? "Actions";
    (acc[g] ??= []).push(a);
    return acc;
  }, {});

  let globalIdx = -1;

  return (
    <>
      <div
        className="v3-cmdk-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="v3-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onKeyDown={handleKey}
      >
        <div className="v3-cmdk-search">
          <span className="v3-cmdk-prompt">›</span>
          <input
            ref={inputRef}
            type="text"
            className="v3-cmdk-input"
            placeholder="Search actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd keyChar="K" />
        </div>

        <div className="v3-cmdk-list" role="listbox">
          {Object.entries(grouped).length === 0 ? (
            <div className="v3-cmdk-empty">No matches.</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="v3-cmdk-group">
                <div className="v3-cmdk-group-label">{group}</div>
                {items.map((action) => {
                  globalIdx += 1;
                  const isSelected = globalIdx === selectedIdx;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={action.disabled}
                      className={`v3-cmdk-item${isSelected ? " v3-cmdk-item-active" : ""}${action.disabled ? " v3-cmdk-item-disabled" : ""}`}
                      onClick={() => {
                        if (!action.disabled) {
                          action.onSelect();
                          onClose();
                        }
                      }}
                      onMouseEnter={() => {
                        const idx = filtered.indexOf(action);
                        if (idx >= 0) setSelectedIdx(idx);
                      }}
                    >
                      <span>{action.label}</span>
                      {action.shortcut && (
                        <span className="v3-cmdk-shortcut">
                          {action.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
