import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// AI-GOS Design System V2 — "Strategic Intelligence"
// Inspired by: Grok (focused clarity), Notion (content hierarchy), Railway (premium dark)
// ═══════════════════════════════════════════════════════════════════════════════

// Design Tokens
const tokens = {
  // Background layers — blue-tinted blacks with more depth separation
  bg: {
    void: "#050709",       // deepest — page bg
    base: "#080a10",       // section bg
    raised: "#0c0f17",     // card bg
    elevated: "#111520",   // hover / nested card
    overlay: "#161b28",    // modals, popovers
    spotlight: "#1a2035",  // active/selected states
  },
  // Text — warm whites with clear hierarchy
  text: {
    primary: "#f0f0ed",    // headings — warm off-white
    secondary: "#b8bcc6",  // body text
    tertiary: "#6b7080",   // labels, metadata
    quaternary: "#3d4255",  // disabled, hints
    inverse: "#080a10",    // text on light bg
  },
  // Section accent colors — each research section gets a unique hue
  section: {
    market:     { base: "#3b7aff", dim: "rgba(59,122,255,0.12)", glow: "rgba(59,122,255,0.06)", text: "#6fa0ff" },
    icp:        { base: "#10b981", dim: "rgba(16,185,129,0.12)", glow: "rgba(16,185,129,0.06)", text: "#5edead" },
    offer:      { base: "#a78bfa", dim: "rgba(167,139,250,0.12)", glow: "rgba(167,139,250,0.06)", text: "#c4b1fc" },
    competitor: { base: "#f59e0b", dim: "rgba(245,158,11,0.12)", glow: "rgba(245,158,11,0.06)", text: "#fbbf4d" },
    synthesis:  { base: "#ec4899", dim: "rgba(236,72,153,0.12)", glow: "rgba(236,72,153,0.06)", text: "#f472b6" },
    keyword:    { base: "#06b6d4", dim: "rgba(6,182,212,0.12)", glow: "rgba(6,182,212,0.06)", text: "#38d6f0" },
  },
  // Semantic
  semantic: {
    success: "#22c55e",
    warning: "#f59e0b",
    danger:  "#ef4444",
    info:    "#3b82f6",
  },
  // Borders
  border: {
    subtle:  "rgba(255,255,255,0.04)",
    default: "rgba(255,255,255,0.07)",
    strong:  "rgba(255,255,255,0.12)",
    accent:  "rgba(59,122,255,0.25)",
  },
  // Radius
  radius: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "18px",
    pill: "999px",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE COMPONENTS — The New Design Language
// ═══════════════════════════════════════════════════════════════════════════════

function SectionChip({ label, accent, icon }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "4px 10px 4px 8px",
      background: accent.dim,
      border: `1px solid ${accent.base}22`,
      borderRadius: tokens.radius.pill,
      fontSize: "11px", fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: accent.text,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <span style={{ fontSize: "13px" }}>{icon}</span>
      {label}
    </span>
  );
}

function MetricTile({ label, value, sublabel, accent }) {
  return (
    <div style={{
      padding: "16px 18px",
      background: tokens.bg.raised,
      border: `1px solid ${tokens.border.default}`,
      borderRadius: tokens.radius.md,
      display: "flex", flexDirection: "column", gap: "6px",
      transition: "all 0.2s ease",
      cursor: "default",
      position: "relative",
      overflow: "hidden",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = accent ? `${accent}44` : tokens.border.strong;
      e.currentTarget.style.background = tokens.bg.elevated;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = tokens.border.default;
      e.currentTarget.style.background = tokens.bg.raised;
    }}
    >
      {accent && <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: `linear-gradient(90deg, ${accent}, transparent)`,
        opacity: 0.5,
      }} />}
      <span style={{
        fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.08em", color: tokens.text.tertiary,
        fontFamily: "'DM Sans', sans-serif",
      }}>{label}</span>
      <span style={{
        fontSize: "15px", fontWeight: 600, color: tokens.text.primary,
        fontFamily: "'Instrument Sans', 'DM Sans', sans-serif",
        letterSpacing: "-0.01em",
      }}>{value}</span>
      {sublabel && <span style={{
        fontSize: "11px", color: tokens.text.quaternary,
        fontFamily: "'DM Mono', monospace",
      }}>{sublabel}</span>}
    </div>
  );
}

function DataRow({ label, value, accent }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 0",
      borderBottom: `1px solid ${tokens.border.subtle}`,
    }}>
      <span style={{
        fontSize: "13px", color: tokens.text.secondary,
        fontFamily: "'DM Sans', sans-serif",
      }}>{label}</span>
      <span style={{
        fontSize: "13.5px", fontWeight: 600,
        color: accent || tokens.text.primary,
        fontFamily: "'Instrument Sans', 'DM Sans', sans-serif",
        letterSpacing: "-0.01em",
      }}>{value}</span>
    </div>
  );
}

function InsightBlock({ title, body, icon, accentColor }) {
  return (
    <div style={{
      padding: "16px 18px",
      background: tokens.bg.raised,
      border: `1px solid ${tokens.border.default}`,
      borderRadius: tokens.radius.md,
      borderLeft: `3px solid ${accentColor || tokens.section.market.base}`,
      display: "flex", flexDirection: "column", gap: "6px",
      transition: "border-color 0.2s ease",
    }}
    onMouseEnter={e => e.currentTarget.style.borderLeftColor = accentColor || tokens.section.market.text}
    onMouseLeave={e => e.currentTarget.style.borderLeftColor = accentColor || tokens.section.market.base}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {icon && <span style={{ fontSize: "14px" }}>{icon}</span>}
        <span style={{
          fontSize: "13.5px", fontWeight: 600, color: tokens.text.primary,
          fontFamily: "'Instrument Sans', 'DM Sans', sans-serif",
          letterSpacing: "-0.01em",
        }}>{title}</span>
      </div>
      <p style={{
        fontSize: "13px", lineHeight: 1.65, color: tokens.text.secondary,
        fontFamily: "'DM Sans', sans-serif", margin: 0,
      }}>{body}</p>
    </div>
  );
}

function TagList({ items, color }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {items.map((item, i) => (
        <span key={i} style={{
          padding: "5px 12px",
          background: `${color}10`,
          border: `1px solid ${color}22`,
          borderRadius: tokens.radius.pill,
          fontSize: "12px", color: tokens.text.secondary,
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.4,
        }}>{item}</span>
      ))}
    </div>
  );
}

function ScoreBar({ label, score, max = 10, accentColor }) {
  const pct = (score / max) * 100;
  const color = pct >= 70 ? tokens.semantic.success : pct >= 50 ? tokens.semantic.warning : tokens.semantic.danger;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 0",
      borderBottom: `1px solid ${tokens.border.subtle}`,
    }}>
      <span style={{
        flex: 1, fontSize: "13px", color: tokens.text.secondary,
        fontFamily: "'DM Sans', sans-serif",
      }}>{label}</span>
      <div style={{
        width: "120px", height: "4px",
        background: tokens.border.subtle,
        borderRadius: "2px", overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: `linear-gradient(90deg, ${accentColor || color}, ${accentColor || color}88)`,
          borderRadius: "2px",
          transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <span style={{
        fontSize: "12px", fontWeight: 600, color: accentColor || color,
        fontFamily: "'DM Mono', monospace",
        minWidth: "36px", textAlign: "right",
      }}>{score}/{max}</span>
    </div>
  );
}

function SubSectionHeader({ title, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: "12px", paddingBottom: "8px",
      borderBottom: `1px solid ${tokens.border.subtle}`,
    }}>
      <span style={{
        fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.06em", color: tokens.text.tertiary,
        fontFamily: "'DM Sans', sans-serif",
      }}>{title}</span>
      {count !== undefined && <span style={{
        fontSize: "10px", fontWeight: 600, color: tokens.text.quaternary,
        fontFamily: "'DM Mono', monospace",
        padding: "2px 7px",
        background: tokens.border.subtle,
        borderRadius: tokens.radius.pill,
      }}>{count}</span>}
    </div>
  );
}

function BoolIndicator({ value, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 0",
    }}>
      <div style={{
        width: "18px", height: "18px", borderRadius: "5px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: value ? `${tokens.semantic.success}18` : tokens.border.subtle,
        border: `1px solid ${value ? `${tokens.semantic.success}44` : tokens.border.default}`,
        fontSize: "10px", color: value ? tokens.semantic.success : tokens.text.quaternary,
        transition: "all 0.2s ease",
      }}>
        {value ? "✓" : "–"}
      </div>
      <span style={{
        fontSize: "13px",
        color: value ? tokens.text.secondary : tokens.text.quaternary,
        fontFamily: "'DM Sans', sans-serif",
      }}>{label}</span>
    </div>
  );
}

function WarningChip({ text }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "10px 14px",
      background: `${tokens.semantic.warning}08`,
      border: `1px solid ${tokens.semantic.warning}18`,
      borderRadius: tokens.radius.sm,
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: tokens.semantic.warning,
        marginTop: "6px", flexShrink: 0,
      }} />
      <span style={{
        fontSize: "12.5px", lineHeight: 1.55, color: tokens.text.secondary,
        fontFamily: "'DM Sans', sans-serif",
      }}>{text}</span>
    </div>
  );
}

function ObjectionCard({ objection, response, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: "14px 16px",
        background: expanded ? tokens.bg.elevated : tokens.bg.raised,
        border: `1px solid ${expanded ? tokens.border.strong : tokens.border.default}`,
        borderRadius: tokens.radius.md,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = tokens.bg.elevated; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = tokens.bg.raised; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <span style={{
          fontSize: "10px", fontWeight: 700, color: tokens.text.quaternary,
          fontFamily: "'DM Mono', monospace",
          minWidth: "20px", paddingTop: "3px",
        }}>{String(index).padStart(2, "0")}</span>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: "13.5px", fontWeight: 500, color: tokens.text.primary,
            fontFamily: "'DM Sans', sans-serif",
            margin: 0, lineHeight: 1.4,
          }}>"{objection}"</p>
          {expanded && (
            <div style={{
              marginTop: "10px", paddingTop: "10px",
              borderTop: `1px solid ${tokens.border.subtle}`,
            }}>
              <span style={{
                fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.06em", color: tokens.section.market.text,
                display: "block", marginBottom: "4px",
              }}>Response Strategy</span>
              <p style={{
                fontSize: "12.5px", lineHeight: 1.6, color: tokens.text.secondary,
                fontFamily: "'DM Sans', sans-serif", margin: 0,
              }}>{response}</p>
            </div>
          )}
        </div>
        <span style={{
          fontSize: "14px", color: tokens.text.quaternary,
          transform: expanded ? "rotate(180deg)" : "rotate(0)",
          transition: "transform 0.2s ease",
        }}>▾</span>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION CARD WRAPPER — The new container for each research section
// ═══════════════════════════════════════════════════════════════════════════════

function SectionCard({ number, title, icon, accent, children, isExpanded, onToggle }) {
  return (
    <div style={{
      background: tokens.bg.base,
      border: `1px solid ${tokens.border.default}`,
      borderRadius: tokens.radius.lg,
      overflow: "hidden",
      transition: "all 0.3s ease",
      boxShadow: isExpanded ? `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px ${accent.base}15` : "none",
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
          background: isExpanded ? `linear-gradient(135deg, ${accent.glow}, transparent 60%)` : "transparent",
          transition: "background 0.3s ease",
          borderBottom: isExpanded ? `1px solid ${tokens.border.default}` : "none",
        }}
        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = tokens.bg.elevated; }}
        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? `linear-gradient(135deg, ${accent.glow}, transparent 60%)` : "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Section number — pill */}
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: accent.dim,
            border: `1px solid ${accent.base}33`,
            fontSize: "13px", fontWeight: 700,
            color: accent.text,
            fontFamily: "'DM Mono', monospace",
          }}>{number}</div>
          {/* Title */}
          <div>
            <h2 style={{
              fontSize: "16px", fontWeight: 650, color: tokens.text.primary,
              fontFamily: "'Instrument Sans', 'DM Sans', sans-serif",
              letterSpacing: "-0.02em", margin: 0, lineHeight: 1.3,
            }}>{title}</h2>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SectionChip label={icon.label} accent={accent} icon={icon.emoji} />
          <span style={{
            fontSize: "18px", color: tokens.text.quaternary,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
          }}>▾</span>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{
          padding: "24px",
          animation: "slideDown 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP — Design System Showcase with REAL Section 1 Data
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_DATA = {
  categorySnapshot: {
    category: "Marketing Intelligence SaaS",
    marketMaturity: "Growth",
    awarenessLevel: "Problem Aware",
    buyingBehavior: "Comparison Shopping",
    averageSalesCycle: "14–30 days",
    seasonality: "Q1 budget allocation spike",
  },
  marketDynamics: {
    demandDrivers: [
      "Rising CAC forcing agencies to prove ROI with data-driven strategy",
      "AI-powered tools reducing manual competitive research by 70%",
      "SMBs demanding agency-grade strategic documents at lower cost",
    ],
    buyingTriggers: [
      "New client onboarding — agencies need rapid research delivery",
      "Quarterly strategy reviews requiring fresh competitive data",
      "Lost pitch post-mortem driving demand for better intel tools",
    ],
    barriersToPurchase: [
      "Perceived overlap with existing tools (SEMrush, SpyFu, SimilarWeb)",
      "Uncertainty about AI-generated strategy quality vs. human consultants",
      "Budget gatekeeping — marketing ops tools compete for same line item",
    ],
  },
  painPoints: {
    primary: [
      "Manual research takes 15–20 hours per new client strategy",
      "No single tool synthesizes competitor, market, and ICP data together",
      "Pitch documents lack data-backed competitive positioning",
    ],
    secondary: [
      "Junior strategists lack frameworks to structure research effectively",
      "Client reporting lacks visual polish expected at enterprise level",
    ],
  },
  psychologicalDrivers: [
    { driver: "Fear of Irrelevance", description: "Agencies worry about being replaced by AI-native competitors who deliver faster, cheaper strategies. AI-GOS positions them as the AI-augmented agency." },
    { driver: "Expertise Signaling", description: "Producing a comprehensive strategic blueprint signals deep expertise to prospects, justifying premium retainers and reducing scope creep." },
    { driver: "Time Reclamation", description: "Strategists crave time back from tedious research to focus on creative ideation and client relationships — the work they actually enjoy." },
  ],
  audienceObjections: [
    { objection: "I can do this research myself with existing tools", response: "Individual tools provide raw data. AI-GOS synthesizes cross-channel intelligence into a decision-ready blueprint in minutes, not days." },
    { objection: "AI-generated strategy can't match human insight", response: "AI-GOS augments human strategists — it handles the 80% research grunt work so you focus on the 20% creative insight that wins pitches." },
    { objection: "Another AI tool that over-promises and under-delivers", response: "Unlike generic AI writers, AI-GOS uses live market data (Perplexity, SpyFu, Meta Library) to ground every recommendation in real competitive intelligence." },
  ],
  summaryRecommendations: [
    "Lead with the time-savings narrative: '15 hours → 15 minutes' for competitive research",
    "Position against the 'research stack' problem — too many tools, no synthesis",
    "Target agency new-business teams as initial wedge, expand to in-house marketing",
    "Offer a free blueprint for one prospect to prove value before subscription commitment",
  ],
};

export default function AIGOSDesignSystemV2() {
  const [expandedSection, setExpandedSection] = useState(true);
  const [activeTab, setActiveTab] = useState("redesign");
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimateIn(true), 100);
    return () => clearTimeout(t);
  }, []);

  const accent = tokens.section.market;

  return (
    <div style={{
      minHeight: "100vh",
      background: tokens.bg.void,
      color: tokens.text.primary,
      fontFamily: "'DM Sans', sans-serif",
      position: "relative",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${tokens.border.default}; border-radius: 3px; }
      `}</style>

      {/* Ambient background gradient */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "600px",
        background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${accent.base}08, transparent)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        maxWidth: "880px", margin: "0 auto", padding: "40px 24px",
        position: "relative", zIndex: 1,
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)",
      }}>

        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{
              fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.1em", color: accent.text,
              fontFamily: "'DM Mono', monospace",
            }}>AI-GOS</span>
            <span style={{ color: tokens.text.quaternary, fontSize: "10px" }}>·</span>
            <span style={{
              fontSize: "10px", fontWeight: 500, textTransform: "uppercase",
              letterSpacing: "0.06em", color: tokens.text.quaternary,
              fontFamily: "'DM Mono', monospace",
            }}>Design System V2</span>
          </div>
          <h1 style={{
            fontSize: "28px", fontWeight: 700,
            fontFamily: "'Instrument Sans', sans-serif",
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            background: `linear-gradient(135deg, ${tokens.text.primary}, ${accent.text})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "10px",
          }}>
            Strategic Research Redesign
          </h1>
          <p style={{
            fontSize: "14px", lineHeight: 1.6, color: tokens.text.tertiary,
            maxWidth: "600px",
          }}>
            A new design language for research sections — built around visual hierarchy,
            data storytelling, and progressive disclosure. Each section has its own accent color
            and content rhythm.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex", gap: "2px", marginBottom: "24px",
          background: tokens.bg.raised,
          border: `1px solid ${tokens.border.default}`,
          borderRadius: tokens.radius.md,
          padding: "3px",
          width: "fit-content",
        }}>
          {[
            { id: "redesign", label: "New Design" },
            { id: "tokens", label: "Design Tokens" },
            { id: "components", label: "Components" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: tokens.radius.sm,
                fontSize: "12px", fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.01em",
                border: "none", cursor: "pointer",
                background: activeTab === tab.id ? accent.dim : "transparent",
                color: activeTab === tab.id ? accent.text : tokens.text.tertiary,
                transition: "all 0.15s ease",
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* ═══════════════════════ TAB: NEW DESIGN ═══════════════════════ */}
        {activeTab === "redesign" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Section Navigation Bar */}
            <div style={{
              display: "flex", gap: "6px", flexWrap: "wrap",
              padding: "12px 16px",
              background: tokens.bg.raised,
              border: `1px solid ${tokens.border.default}`,
              borderRadius: tokens.radius.md,
            }}>
              {[
                { n: 1, label: "Market", color: tokens.section.market, active: true },
                { n: 2, label: "ICP", color: tokens.section.icp },
                { n: 3, label: "Offer", color: tokens.section.offer },
                { n: 4, label: "Competitors", color: tokens.section.competitor },
                { n: 5, label: "Synthesis", color: tokens.section.synthesis },
                { n: 6, label: "Keywords", color: tokens.section.keyword },
              ].map(s => (
                <div key={s.n} style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 12px",
                  borderRadius: tokens.radius.pill,
                  background: s.active ? s.color.dim : "transparent",
                  border: `1px solid ${s.active ? s.color.base + "33" : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                  <span style={{
                    width: "18px", height: "18px", borderRadius: "5px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: s.active ? s.color.base : tokens.border.subtle,
                    fontSize: "10px", fontWeight: 700,
                    color: s.active ? "#fff" : tokens.text.quaternary,
                    fontFamily: "'DM Mono', monospace",
                  }}>{s.n}</span>
                  <span style={{
                    fontSize: "12px", fontWeight: s.active ? 600 : 400,
                    color: s.active ? s.color.text : tokens.text.tertiary,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* ═══════ SECTION 1: Industry & Market Overview ═══════ */}
            <SectionCard
              number="01"
              title="Industry & Market Overview"
              icon={{ emoji: "📊", label: "Market" }}
              accent={accent}
              isExpanded={expandedSection}
              onToggle={() => setExpandedSection(!expandedSection)}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

                {/* Category Snapshot — Metric Tiles Grid */}
                <div>
                  <SubSectionHeader title="Category Snapshot" count="6 metrics" />
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                  }}>
                    <MetricTile label="Category" value={MOCK_DATA.categorySnapshot.category} accent={accent.base} />
                    <MetricTile label="Market Maturity" value={MOCK_DATA.categorySnapshot.marketMaturity} accent={accent.base} />
                    <MetricTile label="Awareness Level" value={MOCK_DATA.categorySnapshot.awarenessLevel} />
                    <MetricTile label="Buying Behavior" value="Comparison Shopping" />
                    <MetricTile label="Avg. Sales Cycle" value={MOCK_DATA.categorySnapshot.averageSalesCycle} />
                    <MetricTile label="Seasonality" value={MOCK_DATA.categorySnapshot.seasonality} sublabel="peak: jan–mar" />
                  </div>
                </div>

                {/* Market Dynamics — Two Column */}
                <div>
                  <SubSectionHeader title="Market Dynamics" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {/* Demand Drivers */}
                    <div style={{
                      padding: "16px",
                      background: tokens.bg.raised,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
                      }}>
                        <span style={{ fontSize: "14px" }}>📈</span>
                        <span style={{
                          fontSize: "12px", fontWeight: 600, color: tokens.semantic.success,
                          fontFamily: "'DM Sans', sans-serif",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>Demand Drivers</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {MOCK_DATA.marketDynamics.demandDrivers.map((d, i) => (
                          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                            <span style={{
                              width: "4px", height: "4px", borderRadius: "50%",
                              background: tokens.semantic.success, marginTop: "7px", flexShrink: 0,
                            }} />
                            <span style={{
                              fontSize: "12.5px", lineHeight: 1.55, color: tokens.text.secondary,
                              fontFamily: "'DM Sans', sans-serif",
                            }}>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Buying Triggers */}
                    <div style={{
                      padding: "16px",
                      background: tokens.bg.raised,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
                      }}>
                        <span style={{ fontSize: "14px" }}>🎯</span>
                        <span style={{
                          fontSize: "12px", fontWeight: 600, color: accent.text,
                          fontFamily: "'DM Sans', sans-serif",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>Buying Triggers</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {MOCK_DATA.marketDynamics.buyingTriggers.map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                            <span style={{
                              width: "4px", height: "4px", borderRadius: "50%",
                              background: accent.base, marginTop: "7px", flexShrink: 0,
                            }} />
                            <span style={{
                              fontSize: "12.5px", lineHeight: 1.55, color: tokens.text.secondary,
                              fontFamily: "'DM Sans', sans-serif",
                            }}>{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Barriers — Warning Cards */}
                  <div style={{ marginTop: "10px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      marginBottom: "8px",
                    }}>
                      <span style={{ fontSize: "14px" }}>⚠️</span>
                      <span style={{
                        fontSize: "12px", fontWeight: 600, color: tokens.semantic.warning,
                        fontFamily: "'DM Sans', sans-serif",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>Barriers to Purchase</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {MOCK_DATA.marketDynamics.barriersToPurchase.map((b, i) => (
                        <WarningChip key={i} text={b} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pain Points — Split Layout */}
                <div>
                  <SubSectionHeader title="Pain Points" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div style={{
                      padding: "16px",
                      background: tokens.bg.raised,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                      borderTop: `2px solid ${tokens.semantic.danger}55`,
                    }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: tokens.semantic.danger,
                        display: "block", marginBottom: "10px",
                      }}>Primary</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {MOCK_DATA.painPoints.primary.map((p, i) => (
                          <div key={i} style={{ display: "flex", gap: "10px" }}>
                            <span style={{
                              fontSize: "10px", fontWeight: 600, color: tokens.text.quaternary,
                              fontFamily: "'DM Mono', monospace", minWidth: "18px", paddingTop: "2px",
                            }}>{String(i + 1).padStart(2, "0")}</span>
                            <span style={{
                              fontSize: "12.5px", lineHeight: 1.55, color: tokens.text.secondary,
                            }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{
                      padding: "16px",
                      background: tokens.bg.raised,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                      borderTop: `2px solid ${tokens.semantic.warning}44`,
                    }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: tokens.semantic.warning,
                        display: "block", marginBottom: "10px",
                      }}>Secondary</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {MOCK_DATA.painPoints.secondary.map((p, i) => (
                          <div key={i} style={{ display: "flex", gap: "10px" }}>
                            <span style={{
                              fontSize: "10px", fontWeight: 600, color: tokens.text.quaternary,
                              fontFamily: "'DM Mono', monospace", minWidth: "18px", paddingTop: "2px",
                            }}>{String(i + 1).padStart(2, "0")}</span>
                            <span style={{
                              fontSize: "12.5px", lineHeight: 1.55, color: tokens.text.secondary,
                            }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Psychological Drivers — Insight Cards */}
                <div>
                  <SubSectionHeader title="Psychological Drivers" count={MOCK_DATA.psychologicalDrivers.length} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {MOCK_DATA.psychologicalDrivers.map((d, i) => (
                      <InsightBlock
                        key={i}
                        title={d.driver}
                        body={d.description}
                        icon={["🧠", "🏆", "⏰"][i]}
                        accentColor={accent.base}
                      />
                    ))}
                  </div>
                </div>

                {/* Audience Objections — Expandable */}
                <div>
                  <SubSectionHeader title="Audience Objections" count={MOCK_DATA.audienceObjections.length} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {MOCK_DATA.audienceObjections.map((o, i) => (
                      <ObjectionCard
                        key={i}
                        index={i + 1}
                        objection={o.objection}
                        response={o.response}
                      />
                    ))}
                  </div>
                </div>

                {/* Key Recommendations — Highlight Box */}
                <div>
                  <SubSectionHeader title="Key Recommendations" count={MOCK_DATA.summaryRecommendations.length} />
                  <div style={{
                    padding: "18px 20px",
                    background: `linear-gradient(135deg, ${accent.glow}, ${accent.dim})`,
                    border: `1px solid ${accent.base}25`,
                    borderRadius: tokens.radius.md,
                    borderLeft: `3px solid ${accent.base}`,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {MOCK_DATA.summaryRecommendations.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          <div style={{
                            width: "20px", height: "20px", borderRadius: "5px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `${accent.base}22`, flexShrink: 0,
                            fontSize: "10px", fontWeight: 700, color: accent.text,
                            fontFamily: "'DM Mono', monospace",
                          }}>{i + 1}</div>
                          <span style={{
                            fontSize: "13px", lineHeight: 1.55, color: tokens.text.secondary,
                          }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════════ TAB: DESIGN TOKENS ═══════════════════════ */}
        {activeTab === "tokens" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

            {/* Section Colors */}
            <div>
              <SubSectionHeader title="Section Accent Colors" count="6 sections" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {Object.entries(tokens.section).map(([name, colors]) => (
                  <div key={name} style={{
                    padding: "16px",
                    background: colors.dim,
                    border: `1px solid ${colors.base}22`,
                    borderRadius: tokens.radius.md,
                    borderLeft: `3px solid ${colors.base}`,
                  }}>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.06em", color: colors.text,
                      display: "block", marginBottom: "8px",
                    }}>{name}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[colors.base, colors.text, colors.dim].map((c, i) => (
                        <div key={i} style={{
                          width: "24px", height: "24px", borderRadius: "6px",
                          background: c, border: `1px solid ${tokens.border.default}`,
                        }} />
                      ))}
                    </div>
                    <span style={{
                      fontSize: "10px", color: tokens.text.quaternary,
                      fontFamily: "'DM Mono', monospace",
                      display: "block", marginTop: "6px",
                    }}>{colors.base}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Background Layers */}
            <div>
              <SubSectionHeader title="Background Layers" count="6 levels" />
              <div style={{ display: "flex", gap: "4px" }}>
                {Object.entries(tokens.bg).map(([name, color]) => (
                  <div key={name} style={{
                    flex: 1, height: "80px",
                    background: color,
                    border: `1px solid ${tokens.border.default}`,
                    borderRadius: tokens.radius.sm,
                    display: "flex", flexDirection: "column",
                    justifyContent: "flex-end", padding: "8px",
                  }}>
                    <span style={{
                      fontSize: "9px", fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.06em", color: tokens.text.tertiary,
                    }}>{name}</span>
                    <span style={{
                      fontSize: "9px", color: tokens.text.quaternary,
                      fontFamily: "'DM Mono', monospace",
                    }}>{color}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div>
              <SubSectionHeader title="Typography Scale" />
              <div style={{
                padding: "20px",
                background: tokens.bg.raised,
                border: `1px solid ${tokens.border.default}`,
                borderRadius: tokens.radius.md,
                display: "flex", flexDirection: "column", gap: "16px",
              }}>
                <div>
                  <span style={{
                    fontSize: "10px", color: tokens.text.quaternary,
                    fontFamily: "'DM Mono', monospace",
                  }}>28px / Instrument Sans / -0.03em</span>
                  <h1 style={{
                    fontSize: "28px", fontWeight: 700,
                    fontFamily: "'Instrument Sans', sans-serif",
                    letterSpacing: "-0.03em", color: tokens.text.primary,
                  }}>Section Title</h1>
                </div>
                <div>
                  <span style={{
                    fontSize: "10px", color: tokens.text.quaternary,
                    fontFamily: "'DM Mono', monospace",
                  }}>16px / Instrument Sans / -0.02em</span>
                  <h2 style={{
                    fontSize: "16px", fontWeight: 650,
                    fontFamily: "'Instrument Sans', sans-serif",
                    letterSpacing: "-0.02em", color: tokens.text.primary,
                  }}>Card Heading</h2>
                </div>
                <div>
                  <span style={{
                    fontSize: "10px", color: tokens.text.quaternary,
                    fontFamily: "'DM Mono', monospace",
                  }}>13px / DM Sans / normal</span>
                  <p style={{
                    fontSize: "13px", lineHeight: 1.6,
                    fontFamily: "'DM Sans', sans-serif",
                    color: tokens.text.secondary,
                  }}>Body text for descriptions, insights, and analysis content. Optimized for readability in dense data contexts.</p>
                </div>
                <div>
                  <span style={{
                    fontSize: "10px", color: tokens.text.quaternary,
                    fontFamily: "'DM Mono', monospace",
                  }}>11px / DM Sans / 0.06em / uppercase</span>
                  <p style={{
                    fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.06em", color: tokens.text.tertiary,
                  }}>Subsection Label</p>
                </div>
                <div>
                  <span style={{
                    fontSize: "10px", color: tokens.text.quaternary,
                    fontFamily: "'DM Mono', monospace",
                  }}>12px / DM Mono / tabular-nums</span>
                  <p style={{
                    fontSize: "12px", fontFamily: "'DM Mono', monospace",
                    color: tokens.text.tertiary,
                    fontVariantNumeric: "tabular-nums",
                  }}>7.8/10 · $2.4M · 14–30 days</p>
                </div>
              </div>
            </div>

            {/* Radius & Borders */}
            <div>
              <SubSectionHeader title="Radius Scale" />
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
                {Object.entries(tokens.radius).filter(([k]) => k !== "pill").map(([name, val]) => (
                  <div key={name} style={{ textAlign: "center" }}>
                    <div style={{
                      width: "48px", height: "48px",
                      background: tokens.bg.elevated,
                      border: `1px solid ${tokens.border.strong}`,
                      borderRadius: val,
                    }} />
                    <span style={{
                      fontSize: "9px", color: tokens.text.quaternary,
                      fontFamily: "'DM Mono', monospace",
                      display: "block", marginTop: "4px",
                    }}>{name}<br/>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ TAB: COMPONENTS ═══════════════════════ */}
        {activeTab === "components" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

            {/* Metric Tiles */}
            <div>
              <SubSectionHeader title="Metric Tiles" count="3 variants" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                <MetricTile label="Revenue" value="$2.4M ARR" sublabel="+18% yoy" accent={tokens.semantic.success} />
                <MetricTile label="Market Maturity" value="Growth Stage" accent={tokens.section.market.base} />
                <MetricTile label="Risk Score" value="Medium" sublabel="6.2/10" accent={tokens.semantic.warning} />
              </div>
            </div>

            {/* Insight Blocks */}
            <div>
              <SubSectionHeader title="Insight Blocks" count="color variants" />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <InsightBlock title="Market Insight" body="This is how insight blocks present analysis with a left accent border. Each section gets its own accent color." icon="💡" accentColor={tokens.section.market.base} />
                <InsightBlock title="ICP Insight" body="Green accent for ICP-related insights. The border color communicates which section this insight belongs to." icon="👥" accentColor={tokens.section.icp.base} />
                <InsightBlock title="Competitor Insight" body="Amber accent for competitive intelligence. Color coding makes scanning sections faster." icon="⚔️" accentColor={tokens.section.competitor.base} />
              </div>
            </div>

            {/* Data Rows */}
            <div>
              <SubSectionHeader title="Data Rows" />
              <div style={{
                padding: "4px 16px",
                background: tokens.bg.raised,
                border: `1px solid ${tokens.border.default}`,
                borderRadius: tokens.radius.md,
              }}>
                <DataRow label="Market Size" value="$8.2B" />
                <DataRow label="Growth Rate" value="+23% CAGR" accent={tokens.semantic.success} />
                <DataRow label="Avg. Deal Size" value="$4,200/mo" />
                <DataRow label="Competition Level" value="High" accent={tokens.semantic.warning} />
              </div>
            </div>

            {/* Score Bars */}
            <div>
              <SubSectionHeader title="Score Bars" />
              <div style={{
                padding: "4px 16px",
                background: tokens.bg.raised,
                border: `1px solid ${tokens.border.default}`,
                borderRadius: tokens.radius.md,
              }}>
                <ScoreBar label="Market Opportunity" score={8.2} accentColor={tokens.section.market.base} />
                <ScoreBar label="ICP Fit" score={7.5} accentColor={tokens.section.icp.base} />
                <ScoreBar label="Competitive Position" score={5.8} accentColor={tokens.section.competitor.base} />
                <ScoreBar label="Offer Viability" score={4.2} />
              </div>
            </div>

            {/* Bool Indicators */}
            <div>
              <SubSectionHeader title="Bool Indicators" />
              <div style={{
                padding: "8px 16px",
                background: tokens.bg.raised,
                border: `1px solid ${tokens.border.default}`,
                borderRadius: tokens.radius.md,
                display: "grid", gridTemplateColumns: "1fr 1fr",
              }}>
                <BoolIndicator value={true} label="Clearly Defined ICP" />
                <BoolIndicator value={true} label="Reachable via Paid Channels" />
                <BoolIndicator value={false} label="Adequate Market Scale" />
                <BoolIndicator value={true} label="Has Budget & Authority" />
              </div>
            </div>

            {/* Tags */}
            <div>
              <SubSectionHeader title="Tag Lists" />
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: tokens.text.quaternary, display: "block", marginBottom: "6px" }}>Keywords / Topics</span>
                  <TagList items={["paid media", "competitive intelligence", "market research", "SaaS strategy", "agency tools"]} color={tokens.section.market.base} />
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: tokens.text.quaternary, display: "block", marginBottom: "6px" }}>Platforms</span>
                  <TagList items={["Meta Ads", "Google Ads", "LinkedIn", "TikTok Ads"]} color={tokens.section.competitor.base} />
                </div>
              </div>
            </div>

            {/* Warning Chips */}
            <div>
              <SubSectionHeader title="Warning Items" />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <WarningChip text="Budget gatekeeping — marketing ops tools compete for same line item as analytics platforms" />
                <WarningChip text="Perceived overlap with existing SEMrush/SpyFu workflows may slow adoption" />
              </div>
            </div>

            {/* Section Chips */}
            <div>
              <SubSectionHeader title="Section Chips" />
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <SectionChip label="Market" accent={tokens.section.market} icon="📊" />
                <SectionChip label="ICP" accent={tokens.section.icp} icon="👥" />
                <SectionChip label="Offer" accent={tokens.section.offer} icon="📦" />
                <SectionChip label="Competitors" accent={tokens.section.competitor} icon="⚔️" />
                <SectionChip label="Synthesis" accent={tokens.section.synthesis} icon="💡" />
                <SectionChip label="Keywords" accent={tokens.section.keyword} icon="🔍" />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: "48px", paddingTop: "20px",
          borderTop: `1px solid ${tokens.border.subtle}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{
            fontSize: "10px", color: tokens.text.quaternary,
            fontFamily: "'DM Mono', monospace",
          }}>AI-GOS Design System V2 · Feb 2026</span>
          <div style={{ display: "flex", gap: "4px" }}>
            {Object.values(tokens.section).map((s, i) => (
              <div key={i} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: s.base, opacity: 0.6,
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
