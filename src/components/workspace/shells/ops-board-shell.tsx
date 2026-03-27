'use client';

import { OPS_BOARD_ZONES } from '@/lib/workspace/section-shells';
import type { CardState } from '@/lib/workspace/types';

interface OpsBoardShellProps {
  cards: CardState[];
  renderCard: (card: CardState, index: number) => React.ReactNode;
}

// ── Platform table (2+ platform cards) ─────────────────────────────────────

interface PlatformRow {
  platform: string;
  role: string;
  budgetAllocation: string;
}

function extractPlatformRow(card: CardState): PlatformRow {
  const c = card.content;
  return {
    platform: (c.platform as string) ?? (c.name as string) ?? card.label,
    role: (c.role as string) ?? '',
    budgetAllocation: (c.budgetAllocation as string) ?? (c.budget as string) ?? '',
  };
}

const TH_CLASS =
  'font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-quaternary)] text-left px-3 py-2';

function PlatformTable({ cards }: { cards: CardState[] }) {
  const rows = cards.map(extractPlatformRow);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th className={TH_CLASS}>Platform</th>
          <th className={TH_CLASS}>Role</th>
          <th className={TH_CLASS}>Budget Allocation</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <PlatformRow key={i} row={row} />
        ))}
      </tbody>
    </table>
  );
}

function PlatformRow({ row }: { row: PlatformRow }) {
  return (
    <tr
      style={{ borderBottom: '1px solid transparent' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
          'var(--bg-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '';
      }}
    >
      <td className="px-3 py-2 text-[13px] font-medium text-[var(--text-primary)]">
        {row.platform}
      </td>
      <td className="px-3 py-2">
        {row.role ? (
          <span className="bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[var(--text-quaternary)] rounded">
            {row.role}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
        {row.budgetAllocation}
      </td>
    </tr>
  );
}

// ── Campaign table (2+ campaign cards) ─────────────────────────────────────

interface CampaignRow {
  name: string;
  platform: string;
  objective: string;
  adSets: string;
}

function extractCampaignRow(card: CardState): CampaignRow {
  const c = card.content;
  const adSetsRaw = c.adSets;
  const adSetsCount = Array.isArray(adSetsRaw)
    ? String(adSetsRaw.length)
    : adSetsRaw != null
      ? String(adSetsRaw)
      : '';
  return {
    name: (c.name as string) ?? (c.campaign as string) ?? card.label,
    platform: (c.platform as string) ?? '',
    objective: (c.objective as string) ?? '',
    adSets: adSetsCount,
  };
}

function CampaignTable({ cards }: { cards: CardState[] }) {
  const rows = cards.map(extractCampaignRow);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th className={TH_CLASS}>Campaign</th>
          <th className={TH_CLASS}>Platform</th>
          <th className={TH_CLASS}>Objective</th>
          <th className={TH_CLASS}>Ad Sets</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <CampaignRow key={i} row={row} />
        ))}
      </tbody>
    </table>
  );
}

function CampaignRow({ row }: { row: CampaignRow }) {
  return (
    <tr
      style={{ borderBottom: '1px solid transparent' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
          'var(--bg-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '';
      }}
    >
      <td className="px-3 py-2 text-[13px] font-medium text-[var(--text-primary)]">
        {row.name}
      </td>
      <td className="px-3 py-2">
        {row.platform ? (
          <span className="bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[var(--text-quaternary)] rounded">
            {row.platform}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
        {row.objective}
      </td>
      <td className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
        {row.adSets}
      </td>
    </tr>
  );
}

// ── System-note detection ───────────────────────────────────────────────────

const SYSTEM_NOTE_RE =
  /^\[(Channel Mix|Creative System|Measurement|Rollout Roadmap)\]|^Cross-block/;

function isSystemNoteCard(card: CardState): boolean {
  const items = card.content.items;
  if (!Array.isArray(items) || items.length === 0) return false;
  const matches = items.filter((item: unknown) =>
    typeof item === 'string' ? SYSTEM_NOTE_RE.test(item) : false,
  ).length;
  return matches / items.length >= 0.6;
}

function stripPrefix(item: string): string {
  return item.replace(/^\[[^\]]+\]\s*/, '');
}

function SystemNotesSection({ cards }: { cards: CardState[] }) {
  if (cards.length === 0) return null;
  return (
    <div>
      <div className="border-t border-[var(--border-subtle)] mt-4 pt-3">
        <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em]">
          System Notes
        </span>
        <div className="mt-2 space-y-2">
          {cards.map(card => {
            const items = Array.isArray(card.content.items)
              ? (card.content.items as string[])
              : [];
            return (
              <div key={card.id}>
                {items.map((item, i) => (
                  <p
                    key={i}
                    className="text-[11px] font-mono text-[var(--text-quaternary)] leading-relaxed"
                  >
                    {stripPrefix(item)}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Shell ───────────────────────────────────────────────────────────────────

/**
 * Ops Board shell — Media Plan section layout.
 * Layout: hero strategy → stats/budget → charts → platforms (table) → campaigns → execution phases → risks.
 * Most complex section — structured zones prevent flat card dump.
 */
export function OpsBoardShell({ cards, renderCard }: OpsBoardShellProps) {
  const hero = cards.filter(c => OPS_BOARD_ZONES.hero.has(c.cardType));
  const stats = cards.filter(c => OPS_BOARD_ZONES.stats.has(c.cardType));
  const charts = cards.filter(c => OPS_BOARD_ZONES.charts.has(c.cardType));
  const platforms = cards.filter(c => OPS_BOARD_ZONES.platforms.has(c.cardType));
  const campaigns = cards.filter(c => OPS_BOARD_ZONES.campaigns.has(c.cardType));
  const execution = cards.filter(c => OPS_BOARD_ZONES.execution.has(c.cardType));
  const risks = cards.filter(c => OPS_BOARD_ZONES.risks.has(c.cardType));
  const allLists = cards.filter(c => OPS_BOARD_ZONES.lists.has(c.cardType));
  const prose = cards.filter(c => OPS_BOARD_ZONES.prose.has(c.cardType));

  // Partition lists into primary content vs system validation notes
  const primaryLists = allLists.filter(c => !isSystemNoteCard(c));
  const systemNoteLists = allLists.filter(c => isSystemNoteCard(c));

  let idx = 0;

  return (
    <div className="space-y-4">
      {/* Hero — strategy snapshot, most prominent */}
      {hero.length > 0 && (
        <section>
          {hero.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Stats — budget, KPIs, CAC model as inline stat rows */}
      {stats.length > 0 && (
        <section className="space-y-3">
          {stats.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Charts — visual data, 2-column grid where possible */}
      {charts.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Budget & Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map(card => (
              <div key={card.id}>
                {renderCard(card, idx++)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Platform breakdown — table when 2+ cards, card fallback otherwise */}
      {platforms.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Platform Strategy
          </h3>
          {platforms.length >= 2 ? (
            <PlatformTable cards={platforms} />
          ) : (
            <div className="space-y-2">
              {platforms.map(card => renderCard(card, idx++))}
            </div>
          )}
        </section>
      )}

      {/* Campaigns & segments — table when 2+ cards, card fallback otherwise */}
      {campaigns.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Campaigns & Targeting
          </h3>
          {campaigns.length >= 2 ? (
            <CampaignTable cards={campaigns} />
          ) : (
            <div className="space-y-2">
              {campaigns.map(card => renderCard(card, idx++))}
            </div>
          )}
        </section>
      )}

      {/* Execution — phases, format specs, testing plan */}
      {execution.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Execution Plan
          </h3>
          <div className="space-y-2">
            {execution.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Risk Assessment
          </h3>
          <div className="space-y-2">
            {risks.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Primary list cards */}
      {primaryLists.length > 0 && (
        <div className="space-y-2">
          {primaryLists.map(card => renderCard(card, idx++))}
        </div>
      )}

      {/* Prose */}
      {prose.length > 0 && (
        <div className="space-y-2">
          {prose.map(card => renderCard(card, idx++))}
        </div>
      )}

      {/* System validation notes — separated at the bottom */}
      <SystemNotesSection cards={systemNoteLists} />
    </div>
  );
}
