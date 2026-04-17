"use client";

export interface PeekNavGroup {
  label: string;
  items: { label: string; active?: boolean; onClick?: () => void }[];
}

export interface PeekRailProps {
  groups: PeekNavGroup[];
}

export function PeekRail({ groups }: PeekRailProps) {
  return (
    <aside className="v3-peek" aria-label="Journey navigation">
      <div className="v3-peek-inner">
        {groups.map((group) => (
          <div key={group.label} className="v3-peek-group">
            <div className="v3-peek-label">{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`v3-peek-item${item.active ? " v3-peek-item-active" : ""}`}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
