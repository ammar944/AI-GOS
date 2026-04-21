# Design Patterns & Conventions — AI-GOS

## CSS Tokens (Dark Theme)
- Backgrounds: `--bg-base` (7,9,14) → `--bg-elevated` (10,13,20) → `--bg-surface` (12,14,19) → `--bg-hover` (20,23,30)
- Text: `--text-primary` (252,252,250) → `--text-secondary` (205,208,213) → `--text-tertiary` (100,105,115)
- Accents: `--accent-blue` (54,94,255), `--accent-cyan` (80,248,228), `--accent-green` (34,197,94), `--accent-amber` (245,158,11), `--accent-purple` (167,139,250)
- Borders: `--border-default` (31,31,31), `--border-focus` (54,94,255)
- Radius: sm=8px, md=12px, lg=16px, xl=20px, full=999px

## Fonts
- Body: DM Sans (`--font-sans`) — 300/400/500/600
- Headings: Instrument Sans (`--font-heading`) — 400/500/600/700
- Mono: JetBrains Mono (`--font-mono`) — 400/500

## Component Patterns
- Named exports, PascalCase, Props interface suffixed with `Props`
- `cn()` from `@/lib/utils` for conditional classes
- `@/*` absolute imports always
- kebab-case files/directories
- shadcn/ui (new-york style, zinc base) + Radix primitives

## Animation Infrastructure
- framer-motion `^12.26.1` — used in blueprint-preview, typing-indicator
- tw-animate-css `^1.4.0` — Tailwind animation utilities
- Custom keyframes in globals.css: stream-fade-in, float, pulse-glow, gradient-shift

## Journey Page Structure
```
JourneyPage → JourneyLayout(phase) → JourneyHeader + ScrollArea + ChatMessage[] + TypingIndicator + JourneyChatInput
```

## Key DISCOVERY.md Decisions
- Vercel AI SDK (NOT Agent SDK)
- Model: claude-opus-4-6 with adaptive thinking
- Transport: DefaultChatTransport + streamText + toUIMessageStreamResponse
- Chat panel: 340px in review phase (CSS var `--chat-width`)
- Sprint 1: No tools, no blueprint panel
