import { cn } from '@/lib/utils';

export interface SectionCoverageNoteProps {
  verified?: readonly string[];
  assumed?: readonly string[];
  missing?: readonly string[];
  className?: string;
}

function valuesOrDefault(
  values: readonly string[] | undefined,
  fallback: string,
): readonly string[] {
  const present = values?.filter((value) => value.trim().length > 0) ?? [];
  return present.length > 0 ? present : [fallback];
}

export function SectionCoverageNote({
  verified,
  assumed,
  missing,
  className,
}: SectionCoverageNoteProps): React.ReactElement {
  const groups = [
    {
      label: 'What we verified',
      values: valuesOrDefault(verified, 'The cited public sources available to this section.'),
    },
    {
      label: 'What we assumed',
      values: valuesOrDefault(assumed, 'Uncited strategy implications should be confirmed with the client.'),
    },
    {
      label: "What we couldn't find",
      values: valuesOrDefault(missing, 'No additional public gaps were declared by this renderer.'),
    },
  ];

  return (
    <section
      className={cn('grid gap-4 border-t border-border pt-5', className)}
      data-testid="section-coverage-note"
    >
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Coverage note
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.label} className="grid gap-2">
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {group.label}
            </div>
            <ul className="grid gap-1 text-[12px] leading-[1.5] text-muted-foreground">
              {group.values.slice(0, 3).map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
