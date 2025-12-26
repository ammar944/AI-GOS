"use client";

import { useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EditableText } from "./editable-text";

export interface EditableListProps {
  items: string[];
  onSave: (newItems: string[]) => void;
  placeholder?: string;
  renderPrefix?: (index: number) => React.ReactNode;
  className?: string;
}

export function EditableList({
  items,
  onSave,
  placeholder = "Click to edit...",
  renderPrefix,
  className,
}: EditableListProps) {
  const handleItemChange = useCallback(
    (index: number, newValue: string) => {
      const updatedItems = [...items];
      updatedItems[index] = newValue;
      // Remove empty items on save
      const filteredItems = updatedItems.filter((item) => item.trim() !== "");
      onSave(filteredItems);
    },
    [items, onSave]
  );

  const handleRemoveItem = useCallback(
    (index: number) => {
      const updatedItems = items.filter((_, i) => i !== index);
      onSave(updatedItems);
    },
    [items, onSave]
  );

  const handleAddItem = useCallback(() => {
    onSave([...items, ""]);
  }, [items, onSave]);

  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item, index) => (
        <div key={index} className="group flex items-start gap-2">
          {/* Custom prefix (bullet, number, etc.) */}
          {renderPrefix ? (
            <span className="shrink-0 mt-0.5">{renderPrefix(index)}</span>
          ) : null}

          {/* Editable text */}
          <div className="flex-1 min-w-0">
            <EditableText
              value={item}
              onSave={(newValue) => handleItemChange(index, newValue)}
              placeholder={placeholder}
            />
          </div>

          {/* Remove button - visible on hover */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleRemoveItem(index)}
            className={cn(
              "h-6 w-6 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity",
              "hover:text-red-500 hover:bg-red-100/50",
              "group-hover:opacity-100 focus:opacity-100"
            )}
            aria-label={`Remove item ${index + 1}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add item button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleAddItem}
        className="h-7 px-2 text-muted-foreground hover:text-foreground mt-1"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add item
      </Button>
    </div>
  );
}
