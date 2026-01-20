# Requirements: AI-GOS v2.1

**Defined:** 2026-01-20
**Core Value:** Users get polished, shareable strategic blueprints with intuitive AI-assisted editing

## v2.1 Requirements

Requirements for UX Polish milestone. Each maps to roadmap phases.

### Output Page

- [x] **OUT-01**: Complete page displays blueprint in polished card-based layout (not markdown document editor)
- [x] **OUT-02**: Section cards show all 5 strategic research sections with same content renderers as review page
- [x] **OUT-03**: Header includes success indicator, metadata (time, cost, sections), and action buttons
- [x] **OUT-04**: Share button generates shareable link with copy functionality
- [x] **OUT-05**: Export PDF button generates PDF matching polished layout
- [x] **OUT-06**: New Blueprint and Back to Review buttons navigate correctly
- [x] **OUT-07**: Design follows SaaSLaunch design language (colors, typography, spacing)

### Chat Panel

- [x] **CHAT-01**: Review page uses 30/70 split layout (chat left, blueprint right) instead of overlay
- [x] **CHAT-02**: Chat panel is permanently visible sidebar during review (not triggered by button)
- [x] **CHAT-03**: Blueprint content scrolls independently within 70% right panel
- [x] **CHAT-04**: Chat panel includes input, message history, and suggestion pills
- [x] **CHAT-05**: Responsive layout: vertical stack on mobile (chat above/below blueprint), side-by-side on desktop (lg breakpoint)
- [x] **CHAT-06**: Chat panel hidden on complete page (only visible during review)
- [x] **CHAT-07**: Design follows SaaSLaunch design language with v0/Lovable inspiration

## v2.2 Requirements (Deferred)

### Persistence

- **PERS-01**: Save blueprints to Supabase with user association
- **PERS-02**: User project history with list view
- **PERS-03**: Re-generate from saved inputs

### E2E Testing

- **E2E-01**: Critical user flow E2E tests with Playwright

## Out of Scope

| Feature | Reason |
|---------|--------|
| Chat on complete page | User specified review-only |
| Media plan generation | Future milestone |
| Mobile-first chat | Desktop focus for v2.1, basic responsive stacking sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OUT-01 | Phase 33 | Complete |
| OUT-02 | Phase 33 | Complete |
| OUT-03 | Phase 33 | Complete |
| OUT-04 | Phase 33 | Complete |
| OUT-05 | Phase 33 | Complete |
| OUT-06 | Phase 33 | Complete |
| OUT-07 | Phase 33 | Complete |
| CHAT-01 | Phase 34 | Complete |
| CHAT-02 | Phase 34 | Complete |
| CHAT-03 | Phase 34 | Complete |
| CHAT-04 | Phase 34 | Complete |
| CHAT-05 | Phase 34 | Complete |
| CHAT-06 | Phase 34 | Complete |
| CHAT-07 | Phase 34 | Complete |

**Coverage:**
- v2.1 requirements: 14 total
- Mapped to phases: 14
- Complete: 14 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after Phase 34 completion (v2.1 UX Polish complete)*
