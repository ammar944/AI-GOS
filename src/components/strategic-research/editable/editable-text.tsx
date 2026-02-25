"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}

export function EditableText({
  value,
  onSave,
  placeholder = "Click to edit...",
  multiline = false,
  className,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmedValue = editValue.trim();
    onSave(trimmedValue);
    setIsEditing(false);
  }, [editValue, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        if (multiline) {
          // For multiline, require Cmd/Ctrl+Enter to save
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSave();
          }
        } else {
          e.preventDefault();
          handleSave();
        }
      }
    },
    [multiline, handleSave, handleCancel]
  );

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Display mode
  if (!isEditing) {
    return (
      <span
        onClick={handleClick}
        className={cn(
          // Base styles
          "cursor-text rounded px-1.5 py-0.5 -mx-1 transition-all duration-150",
          // Editable indicator - subtle dashed underline with SaaSLaunch blue
          "border-b border-dashed",
          // Empty placeholder styling
          !value && "italic",
          className
        )}
        style={{
          borderBottomColor: value ? 'color-mix(in srgb, var(--accent-blue) 30%, transparent)' : 'var(--border-default)',
          color: value ? 'inherit' : 'var(--text-tertiary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
          e.currentTarget.style.borderBottomStyle = 'solid';
          e.currentTarget.style.borderBottomColor = 'var(--accent-blue)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderBottomStyle = 'dashed';
          e.currentTarget.style.borderBottomColor = value ? 'color-mix(in srgb, var(--accent-blue) 30%, transparent)' : 'var(--border-default)';
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onFocus={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
          e.currentTarget.style.borderBottomStyle = 'solid';
          e.currentTarget.style.borderBottomColor = 'var(--accent-blue)';
          e.currentTarget.style.outline = 'none';
        }}
        onBlur={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderBottomStyle = 'dashed';
          e.currentTarget.style.borderBottomColor = value ? 'color-mix(in srgb, var(--accent-blue) 30%, transparent)' : 'var(--border-default)';
        }}
      >
        {value || placeholder}
      </span>
    );
  }

  // Edit mode
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex-1 min-h-[80px] rounded-md border px-3 py-2 text-sm resize-y",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          )}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-heading)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
            e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--accent-blue) 20%, transparent)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          rows={3}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-7 text-sm rounded-md border px-2 transition-all"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-heading)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
            e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--accent-blue) 20%, transparent)';
            e.currentTarget.style.outline = 'none';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleSave}
        className="h-7 w-7 shrink-0 transition-colors"
        aria-label="Save"
        style={{
          color: 'var(--accent-blue)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-blue-subtle)';
          e.currentTarget.style.color = 'var(--accent-blue-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--accent-blue)';
        }}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleCancel}
        className="h-7 w-7 shrink-0"
        aria-label="Cancel"
        style={{
          color: 'var(--text-tertiary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-heading)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
