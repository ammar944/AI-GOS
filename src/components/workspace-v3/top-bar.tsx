"use client";

import type { ReactNode } from "react";
import { Kbd } from "./kbd";

export interface Crumb {
  label: string;
  dim?: boolean;
  onClick?: () => void;
}

export interface TopBarProps {
  crumbs: Crumb[];
  center?: ReactNode;
  usage?: string;
  onCommandMenuOpen?: () => void;
}

export function TopBar({
  crumbs,
  center,
  usage,
  onCommandMenuOpen,
}: TopBarProps) {
  return (
    <header className="v3-topbar" role="banner">
      <div className="v3-breadcrumb">
        <span className="v3-wordmark">AIGOS</span>
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="v3-breadcrumb-segment">
            {i > 0 && <span className="v3-sep">›</span>}
            <span
              className={c.dim ? "v3-dim" : undefined}
              onClick={c.onClick}
              role={c.onClick ? "button" : undefined}
              tabIndex={c.onClick ? 0 : undefined}
              onKeyDown={
                c.onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        c.onClick?.();
                      }
                    }
                  : undefined
              }
            >
              {c.label}
            </span>
          </span>
        ))}
      </div>

      <div className="v3-topbar-center">{center}</div>

      <div className="v3-topbar-chips">
        {usage && <button className="v3-chip" type="button">{usage}</button>}
        <button
          className="v3-chip"
          type="button"
          onClick={onCommandMenuOpen}
          aria-label="Open command menu"
        >
          <Kbd keyChar="K" />
        </button>
      </div>
    </header>
  );
}
