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
          "cursor-text rounded px-1 py-0.5 -mx-1 transition-colors",
          "hover:bg-muted/50",
          !value && "text-muted-foreground italic",
          className
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
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
            "flex-1 min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "placeholder:text-muted-foreground resize-y"
          )}
          rows={3}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-7 text-sm"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleSave}
        className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-100/50"
        aria-label="Save"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleCancel}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
