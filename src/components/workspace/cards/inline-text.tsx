'use client';

/**
 * Renders inline text with basic markdown bold (**text**) support
 * and strips raw <cite> tags from AI output.
 */
export function InlineText({ text, className }: { text: string; className?: string }) {
  // Strip <cite index="...">...</cite> tags, keeping inner text
  const stripped = text.replace(/<cite[^>]*>(.*?)<\/cite>/gi, '$1');

  // Split on **bold** markers
  const parts = stripped.split(/(\*\*[^*]+\*\*)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-[var(--text-primary)]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
